/* ============================================================================
 * projects.js — 사용자가 만든 프로젝트(주문) 보관/표시 (정적 사이트, localStorage)
 *
 * 백엔드 연동 전 단계라, Light Design 완료 시 만들어지는 프로젝트를
 * 브라우저(localStorage)에 쌓아두고 My projects / 대시보드 목록 "맨 위"에 보여준다.
 *
 *   · 기존 예시(하드코딩 카드)는 그대로 두고, 새로 추가된 것만 위에 끼워 넣는다.
 *   · 새 프로젝트의 상태(badge)는 "to do" 로 고정 — 자동으로 바뀌지 않는다.
 *   · 승인(approved) 전에는 상세의 "다음 단계"가 열리지 않는다(상세 페이지에서 처리).
 *
 * 전역: window.OptomaticProjects
 * ========================================================================== */
(function () {
  "use strict";

  var LIST_KEY = "optomatic_projects";
  var COUNTER_KEY = "optomatic_project_counter";

  function read() {
    try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; }
    catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // 프로젝트 번호: 그냥 1씩 증가시키며 계속 추가한다.
  function nextNumber() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(COUNTER_KEY), 10) || 0; } catch (e) {}
    n += 1;
    try { localStorage.setItem(COUNTER_KEY, String(n)); } catch (e) {}
    return n;
  }
  function formatNumber(n) {
    return String(n).padStart(5, "0"); // 예: 00001
  }

  // 맨 앞(위)에 새 프로젝트를 추가.
  function add(rec) {
    var list = read();
    list.unshift(rec);
    write(list);
    return rec;
  }
  function get(id) {
    var list = read();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  // 저장된 프로젝트의 일부 필드를 갱신(예: 로그인 사용자 이름을 뒤늦게 채울 때).
  function update(id, patch) {
    var list = read();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        for (var k in patch) { if (patch.hasOwnProperty(k)) list[i][k] = patch[k]; }
        write(list);
        return list[i];
      }
    }
    return null;
  }

  // 상태 → badge 표시(class 접미사 + 라벨)
  function statusInfo(status) {
    var map = {
      "todo": "to do",
      "proposed": "proposed",
      "in-progress": "in progress",
      "approved": "approved",
      "shipped": "shipped",
      "done": "done"
    };
    var key = map[status] ? status : "todo";
    return { cls: key, label: map[key] };
  }

  // dash-card(list view) 한 장을 DOM 으로 생성. (사용자 입력은 textContent 로 안전 처리)
  function buildDashCard(p) {
    var s = statusInfo(p.status);

    var li = document.createElement("li");
    li.className = "dash-card";
    li.setAttribute("data-project-id", p.id);

    var link = document.createElement("a");
    link.className = "dash-card__link";
    link.href = detailUrl(p);
    link.setAttribute("aria-label", "Open project: " + (p.service || "Light Design"));
    li.appendChild(link);

    var left = document.createElement("div");
    left.className = "dash-card__left";

    var thumb = document.createElement("div");
    thumb.className = "dash-card__thumb";
    var img = document.createElement("img");
    img.src = "assets/dashboard-project-thumb.png";
    img.alt = "";
    thumb.appendChild(img);
    var badge = document.createElement("span");
    badge.className = "dash-status dash-status--" + s.cls;
    badge.textContent = s.label;
    thumb.appendChild(badge);
    left.appendChild(thumb);

    var info = document.createElement("div");
    info.className = "dash-card__info";
    info.appendChild(row("User name", p.userName));
    info.appendChild(row("Project number", p.projectNumber));
    info.appendChild(row("Date of request", p.date));
    left.appendChild(info);

    li.appendChild(left);

    var right = document.createElement("div");
    right.className = "dash-card__right";
    var svc = document.createElement("span");
    svc.className = "dash-card__service";
    svc.textContent = p.service || "Light Design";
    right.appendChild(svc);
    var more = document.createElement("button");
    more.type = "button";
    more.className = "dash-card__more";
    more.setAttribute("aria-label", "More options");
    more.innerHTML = '<img src="assets/icon-more-vert.svg" alt="" width="24" height="24" />';
    right.appendChild(more);
    li.appendChild(right);

    return li;

    function row(key, val) {
      var r = document.createElement("div");
      r.className = "dash-card__row";
      var k = document.createElement("span");
      k.className = "dash-card__key";
      k.textContent = key;
      var v = document.createElement("span");
      v.className = "dash-card__val";
      v.textContent = (val == null || val === "") ? "-" : val;
      r.appendChild(k);
      r.appendChild(v);
      return r;
    }
  }

  // 저장된 프로젝트들을 list view(.dash-projects) 맨 위에 끼워 넣는다.
  function renderIntoList(ul) {
    if (!ul) return;
    var list = read();
    // unshift 로 저장되어 list[0] 이 가장 최신 → 역순으로 prepend 하면 최신이 맨 위
    for (var i = list.length - 1; i >= 0; i--) {
      ul.insertBefore(buildDashCard(list[i]), ul.firstChild);
    }
  }

  /* ── 서버(DB) 연동: 내 Light Design 요청만 불러와 카드로 렌더 + load more ────── */

  var MORE_ICON = '<img src="assets/icon-more-vert.svg" alt="" width="24" height="24" />';

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    function p2(n) { return String(n).padStart(2, "0"); }
    return p2(d.getMonth() + 1) + "." + p2(d.getDate()) + "." + d.getFullYear();
  }

  // 서버 DetailResDto → 카드용 표준 객체 (디자인요청 ldesign)
  function mapDr(dr) {
    return {
      id: dr.id,
      userName: dr.userName || dr.userUsername || "",
      projectNumber: String(dr.id).padStart(5, "0"),
      date: fmtDate(dr.createdAt),
      status: dr.status || "todo",
      service: dr.service || "Light Design",
      _sort: dr.createdAt || ""
    };
  }

  // Light Find(lfind) 행 → 카드용 표준 객체. service 는 항상 "Light Find", isLfind 플래그로 구분.
  function mapLf(dr) {
    return {
      id: dr.id,
      userName: dr.userName || dr.userUsername || "",
      projectNumber: String(dr.id).padStart(5, "0"),
      date: fmtDate(dr.createdAt),
      status: dr.status || "todo",
      service: "Light Find",
      isLfind: true,
      _sort: dr.createdAt || ""
    };
  }

  // 카드 상세 링크: Light Find 는 전용 상세 페이지, 그 외(디자인요청)는 기존 상세 페이지.
  function detailUrl(p) {
    var base = p && p.isLfind ? "/light-find-detail" : "/light-design-detail";
    return base + "?id=" + encodeURIComponent(p.id);
  }

  async function fetchOne(url, at, mapFn) {
    try {
      var res = await fetch(url, { headers: { Authorization: at } });
      if (!res.ok) return [];
      var data = await res.json();
      return ((data && data.list) || []).map(mapFn);
    } catch (e) { return []; }
  }

  // 로그인 사용자의 요청 전체(디자인요청 + Light Find, 최신순, 각 최대 100)를 병합해 반환.
  //   비로그인/실패 시 null(=예시 없이 비움), 0건이면 빈 배열.
  async function fetchMyProjects() {
    if (!window.OptomaticAuth || !OptomaticAuth.fetchMe) return null;
    var me = null, at = null;
    try {
      me = await OptomaticAuth.fetchMe();
      at = await OptomaticAuth.getAccessToken();
    } catch (e) {}
    if (!me || !me.id || !at) return null;
    var base = "perpage=100&orderby=id&orderway=DESC&deleted=false&userId=" + me.id;
    var results = await Promise.all([
      fetchOne("/api/ldesign/pagedList?" + base, at, mapDr),
      fetchOne("/api/lfind/pagedList?" + base, at, mapLf)
    ]);
    var merged = results[0].concat(results[1]);
    // created_at(ISO 문자열) 기준 내림차순 — 두 테이블의 id 시퀀스가 달라 날짜로 정렬한다.
    merged.sort(function (a, b) { return String(b._sort).localeCompare(String(a._sort)); });
    return merged;
  }

  // 그리드(mp-card) 한 장
  function buildGridCard(p) {
    var s = statusInfo(p.status);
    var li = document.createElement("li");
    li.className = "mp-card";
    li.setAttribute("data-project-id", p.id);
    li.innerHTML =
      '<a class="mp-card__link"></a>' +
      '<div class="mp-card__head">' +
        '<span class="mp-card__service"></span>' +
        '<button type="button" class="mp-card__more" aria-label="More options">' + MORE_ICON + '</button>' +
      '</div>' +
      '<div class="mp-card__media">' +
        '<div class="mp-card__image"><img src="assets/project-fixture.png" alt="Project fixture" /></div>' +
        '<span class="mp-status mp-status--' + s.cls + '">' + s.label + '</span>' +
      '</div>' +
      '<div class="mp-card__info">' +
        '<div class="mp-card__keys"><p>User name</p><p>Project number</p><p>Date</p></div>' +
        '<div class="mp-card__vals"><p></p><p></p><p></p></div>' +
      '</div>';
    var link = li.querySelector(".mp-card__link");
    link.href = detailUrl(p);
    link.setAttribute("aria-label", "Open project: " + (p.service || "Light Design"));
    li.querySelector(".mp-card__service").textContent = p.service || "Light Design";
    var vals = li.querySelectorAll(".mp-card__vals p");
    vals[0].textContent = p.userName || "-";
    vals[1].textContent = p.projectNumber || "-";
    vals[2].textContent = p.date || "-";
    return li;
  }

  // 애널리틱스(mp-acard) 한 장
  function buildAcard(p) {
    var div = document.createElement("div");
    div.className = "mp-acard";
    div.setAttribute("data-project-id", p.id);
    div.innerHTML =
      '<a class="mp-acard__link"></a>' +
      '<div class="mp-acard__head">' +
        '<span class="mp-acard__service"></span>' +
        '<button type="button" class="mp-card__more" aria-label="More options">' + MORE_ICON + '</button>' +
      '</div>' +
      '<div class="mp-acard__body">' +
        '<div class="mp-acard__thumb"><img src="assets/project-fixture.png" alt="" /></div>' +
        '<div class="mp-acard__info">' +
          '<div class="mp-acard__row"><span class="mp-acard__key">User name</span><span class="mp-acard__val"></span></div>' +
          '<div class="mp-acard__row"><span class="mp-acard__key">Project number</span><span class="mp-acard__val"></span></div>' +
          '<div class="mp-acard__row"><span class="mp-acard__key">Date of request</span><span class="mp-acard__val"></span></div>' +
        '</div>' +
      '</div>';
    var link = div.querySelector(".mp-acard__link");
    link.href = detailUrl(p);
    link.setAttribute("aria-label", "Open project: " + (p.service || "Light Design"));
    div.querySelector(".mp-acard__service").textContent = p.service || "Light Design";
    var vals = div.querySelectorAll(".mp-acard__val");
    vals[0].textContent = p.userName || "-";
    vals[1].textContent = p.projectNumber || "-";
    vals[2].textContent = p.date || "-";
    return div;
  }

  // 카드 배열을 컨테이너에 pageSize(기본 6)개씩 그리고, load more 로 다음 묶음을 펼친다.
  //   builder(p) 가 카드 1장을 만든다. items 가 비면 emptyText(선택)를 보여준다.
  function mountPager(opts) {
    var container = opts.container;
    var loadMoreBtn = opts.loadMoreBtn || null;
    var items = opts.items || [];
    var builder = opts.builder;
    var pageSize = opts.pageSize || 6;
    if (!container || !builder) return;

    container.innerHTML = "";

    // 중복 핸들러 방지를 위해 버튼을 복제 교체(이전 바인딩 제거)
    if (loadMoreBtn) {
      var fresh = loadMoreBtn.cloneNode(true);
      loadMoreBtn.parentNode.replaceChild(fresh, loadMoreBtn);
      loadMoreBtn = fresh;
    }

    if (!items.length) {
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      if (opts.emptyText) {
        var empty = document.createElement(opts.emptyTag || "li");
        empty.className = opts.emptyClass || "dash-empty";
        empty.textContent = opts.emptyText;
        container.appendChild(empty);
      }
      return;
    }

    var shown = 0;
    function more() {
      items.slice(shown, shown + pageSize).forEach(function (p) {
        container.appendChild(builder(p));
      });
      shown = Math.min(shown + pageSize, items.length);
      if (loadMoreBtn) loadMoreBtn.hidden = shown >= items.length;
    }
    more();
    if (loadMoreBtn) {
      loadMoreBtn.hidden = shown >= items.length;
      loadMoreBtn.addEventListener("click", more);
    }
  }

  window.OptomaticProjects = {
    read: read,
    add: add,
    get: get,
    update: update,
    nextNumber: nextNumber,
    formatNumber: formatNumber,
    statusInfo: statusInfo,
    buildDashCard: buildDashCard,
    buildGridCard: buildGridCard,
    buildAcard: buildAcard,
    renderIntoList: renderIntoList,
    fetchMyProjects: fetchMyProjects,
    mountPager: mountPager
  };
})();
