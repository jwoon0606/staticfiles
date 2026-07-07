/* ============================================================================
 * light-find-data.js — "Light Find" 결과(Fixture Preview)를 실제 DB 와 연결.
 *
 * 동작:
 *   1) Fixture Preview(패널 data-step="3") 진입 시(lf:gostep step 3) 위저드에서
 *      고른 값(프로젝트/공간/조명타입/천장고/배치/프레임)을 DOM 에서 읽어
 *      GET /api/lbrand/lightfind 로 등기구를 조회한다.
 *   2) 결과를 3개씩 카드로 렌더한다. 첫 카드는 선택 상태.
 *   3) Refresh 를 누르면 다음 3개 세트로 넘어가고, 직전 세트는 "view previous
 *      N options" 아래에 누적된다(최대 3회 또는 남은 결과가 없을 때까지).
 *
 * 비고:
 *   · 이 스크립트는 light-find-config.js 보다 "뒤에" 로드되어, 정적 Refresh
 *     동작(같은 3종 복제)을 실제 데이터 페이징으로 대체한다(버튼 노드 교체로
 *     기존 리스너 제거). 카드 단일 선택은 .lf-results 위임이라 그대로 작동.
 *   · 가격 단계(Step 4)는 분포 차트만 있고 tier 선택 UI 가 없어 가격대 필터는
 *     보내지 않는다(모든 tier 를 가격 오름차순으로 반환).
 * ========================================================================== */
(function () {
  "use strict";

  var resultsWrap = document.querySelector(".lf-results");
  var currentRow = document.querySelector("[data-pcards-current]");
  if (!resultsWrap || !currentRow) return;

  var prevWrap = document.querySelector("[data-pcards-prev]");
  var prevToggle = document.querySelector("[data-prev-toggle]");
  var prevCountEl = prevToggle && prevToggle.querySelector("[data-prev-count]");
  var refreshBtn = document.querySelector("[data-preview-refresh]");
  var refreshNote = document.querySelector("[data-refresh-note]");
  var refreshWrap = document.querySelector(".lf-preview__refresh-wrap");

  var PAGE = 3;          // 한 번에 보여줄 카드 수
  var REFRESH_MAX = 3;   // 디자인상 Refresh 상한

  // 위저드 라벨 → DB 값 매핑 ------------------------------------------------
  var PROJECT_MAP = {
    "Office": "Office", "Residential": "Residential",
    "Hotel / Resorts": "Hotel", "Museum / Gallery": "Museum / Gallery", "Commercial": "Commercial"
  };
  var LIGHTING_MAP = {
    "Recessed downlight": "Recessed downlight",
    "Recessed multi-downlight": "Recessed multi spot downlight",
    "Semi-recessed downlight": "Seim Recessed DL",
    "Ceiling indirect light": "Ceiling indirect linear light",
    "Bed headboard linear up-light": "Linear uplight @Headboard",
    "Pendant + Table light @Bed": "Pendant light @Bedside table",
    "Reading light @Bed": "Reading light @Headboard",
    "Floor light": "Floor light",
    "Night light": "Night light"
  };
  var LAYOUT_MAP = { "Single Layout": "Single layout", "Double Layout": "Double layout" };
  var PLACEHOLDERS = ["assets/lf-fixture-01.png", "assets/lf-fixture-02.png", "assets/lf-fixture-03.png"];

  // Refresh 는 아래 장식/부가(Additional) 조명 타입에서만 노출한다.
  // 일반광(Recessed downlight/linear/track 등 결정적 산출물)은 새로고침이 불필요.
  // 키는 "@Bedside table/@Mirror/@Headboard" 등 변형을 제거한 기본 타입(소문자).
  var REFRESH_TYPES = {
    "task light": 1, "pendant light": 1, "table light": 1, "night light": 1,
    "floor light": 1, "reading light": 1, "wall mounted light": 1
  };
  function isRefreshType(lighting) {
    if (!lighting) return false;
    var base = String(lighting).split("@")[0].trim().toLowerCase();
    return !!REFRESH_TYPES[base];
  }

  // 상태
  var all = [];          // 조회된 전체 등기구
  var page = 0;          // 현재 페이지(0-base)
  var lastKey = "";      // 동일 선택 재조회 방지용 키

  function text(el) { return el ? (el.textContent || "").trim() : ""; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 위저드(light-find-config.js)의 현재 선택을 LightCategory 트리의 "이름 경로"로 변환한다.
  //   [project, (venue), space, group, lighting, …steps]
  // 백엔드(/api/lbrand/by-path)가 이 경로를 따라 잎 노드를 찾고 연결된 등기구를 돌려준다.
  function buildNames() {
    var s = (window.LF_SELECTION && window.LF_SELECTION()) || null;
    if (!s) return [];
    var names = [];
    var proj = PROJECT_MAP[s.project] || s.project;
    if (proj) names.push(proj);
    if (s.venue) names.push(s.venue);            // Museum/Commercial 만 존재(Hotel 은 없음)
    if (s.space) names.push(s.space);
    if (s.group) names.push(s.group);            // General light / Additional light
    // "Select a type"(Office Workspace 알고리즘 자리표시자)는 트리 노드가 아니므로 경로에서 제외 →
    // 천장타입/천장고까지만 내려가고, 백엔드가 그 하위 모든 등기구를 모아 돌려준다.
    if (s.lighting && s.lighting !== "Select a type") names.push(LIGHTING_MAP[s.lighting] || s.lighting);
    (s.steps || []).forEach(function (st) { if (st) names.push(st); });
    return names;
  }

  function cardHtml(item, idx, selected) {
    var num = ("0" + (idx + 1)).slice(-2);
    var img = item.img || PLACEHOLDERS[idx % PLACEHOLDERS.length];
    function row(label, value) {
      return '<div class="lf-pcard__row"><dt>' + label + "</dt><dd>" +
        (value ? esc(value) : "&mdash;") + "</dd></div>";
    }
    return '<button type="button" class="lf-pcard' + (selected ? " is-selected" : "") +
      '" aria-pressed="' + (selected ? "true" : "false") + '">' +
      '<span class="lf-pcard__num">' + num + "</span>" +
      '<span class="lf-pcard__figure"><img src="' + esc(img) + '" alt="' + esc(item.manufacture || "") + '" /></span>' +
      '<dl class="lf-pcard__specs">' +
      row("Manufacturer", item.manufacture) +
      row("Housing finish", item.housingColor) +
      row("Dimensions", item.dimensions) +
      row("Total Luminaire Wattage", item.wattage) +
      row("Control", item.driverType) +
      "</dl></button>";
  }

  // 조회 중(fetch 대기) 안내 — 정적 플레이스홀더 카드가 잠깐 비치는 깜빡임을 막는다.
  function renderLoading() {
    currentRow.innerHTML =
      '<p class="lf-results__empty" role="status" style="padding:24px;text-align:center;color:#888;">' +
      "Finding fixtures&hellip;</p>";
  }

  // page 번째 3개를 currentRow 에 렌더(첫 카드 선택). 빈 결과면 안내 표시.
  function renderCurrent() {
    var slice = all.slice(page * PAGE, page * PAGE + PAGE);
    if (!all.length) {
      currentRow.innerHTML =
        '<p class="lf-results__empty" role="status" style="padding:24px;text-align:center;color:#888;">' +
        "No matching fixtures yet for this selection.</p>";
      updateRefreshUi(refreshUsed);
      return;
    }
    currentRow.innerHTML = slice.map(function (item, i) {
      return cardHtml(item, page * PAGE + i, i === 0);
    }).join("");
    updateRefreshUi(refreshUsed);
  }

  function totalPages() { return Math.max(1, Math.ceil(all.length / PAGE)); }
  // 아직 안 본 다음 세트가 있고(마지막 페이지 전) 새로고침 한도가 남았는가.
  // 순환(%)하지 않으므로 같은 세트가 다시 나오지 않는다.
  function canRefresh() { return refreshUsed < REFRESH_MAX && page < totalPages() - 1; }

  function setRefreshEnabled(on) {
    if (!refreshBtn) return;
    refreshBtn.disabled = !on;
    refreshBtn.classList.toggle("is-disabled", !on);
    refreshBtn.setAttribute("aria-disabled", on ? "false" : "true");
  }

  function updateRefreshUi(used) {
    if (refreshBtn) {
      var c = refreshBtn.querySelector("[data-refresh-count]");
      if (c) c.textContent = "Refresh " + used + "/" + REFRESH_MAX;
    }
    if (prevCountEl) prevCountEl.textContent = String(used * PAGE);
    if (prevToggle && used > 0) prevToggle.hidden = false;
    if (refreshNote) refreshNote.hidden = (used < REFRESH_MAX);
    setRefreshEnabled(canRefresh());
  }

  // 기존 refresh 버튼을 교체해 light-find-config.js 의 리스너를 제거하고,
  // 실제 데이터 페이징으로 다시 배선한다.
  var refreshUsed = 0;
  if (refreshBtn) {
    var fresh = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(fresh, refreshBtn);
    refreshBtn = fresh;
    refreshBtn.addEventListener("click", function () {
      if (!canRefresh()) return;
      // 직전(현재) 세트를 이전 목록 맨 위에 누적
      if (prevWrap) {
        var clone = currentRow.cloneNode(true);
        clone.removeAttribute("data-pcards-current");
        clone.querySelectorAll(".lf-pcard").forEach(function (c) {
          c.classList.remove("is-selected");
          c.setAttribute("aria-pressed", "false");
        });
        prevWrap.insertBefore(clone, prevWrap.firstChild);
      }
      refreshUsed++;
      page = page + 1;   // 다음(아직 안 본) 세트로만 진행 — 마지막에 닿으면 canRefresh 가 막는다
      renderCurrent();
    });
  }

  function resetPaging() {
    page = 0;
    refreshUsed = 0;
    if (prevWrap) prevWrap.innerHTML = "";
    if (prevToggle) {
      prevToggle.hidden = true;
      prevToggle.setAttribute("aria-expanded", "false");
      prevToggle.classList.remove("is-expanded");
    }
    if (prevWrap) prevWrap.hidden = true;
    if (refreshNote) refreshNote.hidden = true;
    updateRefreshUi(0);
  }

  function load() {
    // Refresh 버튼 노출 여부: 선택한 조명 타입이 장식/부가 타입일 때만.
    var sel = (window.LF_SELECTION && window.LF_SELECTION()) || null;
    if (refreshWrap) refreshWrap.hidden = !(sel && isRefreshType(sel.lighting));

    var names = buildNames();
    var key = names.join(" / ");
    if (key === lastKey && all.length) { return; } // 같은 선택이면 재조회 생략
    lastKey = key;

    if (names.length < 2) { all = []; resetPaging(); renderCurrent(); return; }

    // 정적 플레이스홀더/직전 결과가 잠깐 보이는 깜빡임 방지: 조회 시작 즉시 로딩 표시.
    renderLoading();

    var qs = names.map(function (n) { return "names=" + encodeURIComponent(n); }).join("&");

    function applyAuthThenFetch(at) {
      var opts = at ? { headers: { Authorization: at } } : {};
      fetch("/api/lbrand/by-path?" + qs, opts)
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) {
          all = Array.isArray(list) ? list : [];
          resetPaging();
          renderCurrent();
        })
        .catch(function () { all = []; resetPaging(); renderCurrent(); });
    }

    if (window.OptomaticAuth && window.OptomaticAuth.getAccessToken) {
      Promise.resolve(window.OptomaticAuth.getAccessToken())
        .then(applyAuthThenFetch).catch(function () { applyAuthThenFetch(null); });
    } else {
      applyAuthThenFetch(null);
    }
  }

  // Fixture Preview 진입 시 조회
  document.addEventListener("lf:gostep", function (e) {
    var n = e.detail && e.detail.step;
    if (n === 3) load();
  });
})();
