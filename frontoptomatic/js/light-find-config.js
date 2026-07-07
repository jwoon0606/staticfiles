/* ============================================================================
 * light-find-config.js — "Light Find" 설정 위저드 동작 (데이터 구동)
 *
 * 조명 타입(메인 폼 Step 3) 선택 후 NEXT 하면, 그 조명 타입의 세부 스텝을
 * PDF 알고리즘대로 보여준다. 스텝 정의는 light-find-steps.js(window.LF_STEPS).
 *   · 카드 스텝(천장타입/천장고/배치/개구부 등)을 순서대로 + 마지막에 Fixture Price.
 *   · 조명 타입마다 스텝 수가 다르고, 일부는 이전 선택에 따라 분기/생략된다.
 *
 * 이 스크립트가 담당:
 *   1) 선택한 (project/space/lighting) 으로 스텝 흐름을 만들고 카드/점/제목을 렌더
 *   2) 카드 단일 선택, NEXT/BACK 단계 이동(분기 재계산)
 *   3) Fixture Price 스텝의 비교 모달, 비로그인 안내 모달
 *   4) Fixture Preview(결과)·Contact·제출완료 화면의 보조 동작(기존 유지)
 * ========================================================================== */
(function () {
  "use strict";

  var lfc = document.querySelector(".lfc");
  if (!lfc) return;

  var cardsWrap = lfc.querySelector("[data-lfc-cards]");
  var pricePanel = lfc.querySelector(".lfc-price");
  var dotsList = lfc.querySelector(".lfc-dots");
  var title = lfc.querySelector(".lfc-steptitle");
  var backBtn = lfc.querySelector("[data-lfc-back]");
  var nextBtn = lfc.querySelector("[data-lfc-next]");
  var crumbs = lfc.querySelector("[data-lfc-crumbs]");

  // --- 위저드 상태 ---------------------------------------------------------
  var flow = [];            // 카드 스텝 factory 배열 (light-find-steps.js)
  var selections = {};      // {스텝제목: 선택라벨}
  var ctx = { project: "", venue: "", space: "", lighting: "" };
  var current = 0;          // 0..N-1 = 카드 스텝, N = Fixture Price
  var priceAutoShown = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // 현재 선택값 기준으로 카드 스텝들을 해석(분기/생략 반영). 가격 스텝은 별도.
  function resolvedSteps() {
    var out = [];
    for (var i = 0; i < flow.length; i++) {
      var s = flow[i](selections);
      if (s) out.push(s);
    }
    return out;
  }

  // 현재 위저드 선택을 라벨 그대로 노출(결과 조회용). light-find-data.js 가 이름 경로로 변환한다.
  //   { project, venue, space, group, lighting, steps:[순서대로 선택한 카드 라벨] }
  window.LF_SELECTION = function () {
    var steps = [];
    resolvedSteps().forEach(function (s) {
      var v = selections[s.title];
      if (v != null && v !== "") steps.push(v);
    });
    return {
      project: ctx.project, venue: ctx.venue, space: ctx.space,
      group: lightingGroup(), lighting: ctx.lighting, steps: steps
    };
  };

  // 조명 타입이 General/Additional 중 어디 그룹인지 (브레드크럼용)
  function lightingGroup() {
    var proj = (window.LF_PROJECTS || {})[ctx.project];
    if (!proj) return "";
    for (var i = 0; i < proj.spaces.length; i++) {
      var sp = proj.spaces[i];
      if (sp.label !== ctx.space) continue;
      if ((sp.general || []).some(function (o) { return o.label === ctx.lighting; })) return "General light";
      if ((sp.additional || []).some(function (o) { return o.label === ctx.lighting; })) return "Additional light";
    }
    return "";
  }

  // 선택된 폼 버튼(Project/Venue/Space/Lighting)의 아이콘 SVG 를 가져와 크럼 아이콘으로
  // 재사용(원본 디자인: 각 단계 크럼 앞에 해당 아이콘). 폼은 숨겨져 있어도 DOM 에 남아 있다.
  function crumbIcon(stepSelector) {
    var el = document.querySelector(stepSelector + " .lf-option.is-selected .lf-option__icon");
    if (!el) return "";
    var clone = el.cloneNode(true);
    clone.setAttribute("class", "lfc-crumb__icon");   // 40px → 20px(크럼 규격)
    return clone.outerHTML;
  }

  function renderCrumbs() {
    // 위저드(step2)·결과(step3)·문의(step4)·완료(step5) 화면의 브레드크럼을 모두 같은 선택으로 채운다.
    // (결과/문의/완료 화면 마크업의 크럼은 정적 예시였어서 선택과 달라 보이던 문제 수정.)
    var navs = document.querySelectorAll(".lfc-crumbs");
    if (!navs.length) return;
    // Region/그룹(General·Additional light)은 아이콘 없음. Project/Venue/Space/Lighting 은
    // 해당 단계의 선택 버튼 아이콘을 붙인다.
    var items = [
      { label: "Korea, Republic of" },
      { label: ctx.project, icon: crumbIcon(".lf-step--1") },
      { label: ctx.venue,   icon: crumbIcon(".lf-step--venue") },
      { label: ctx.space,   icon: crumbIcon(".lf-step--2") },
      { label: lightingGroup() },
      { label: ctx.lighting, icon: crumbIcon(".lf-step--3") }
    ].filter(function (it) { return it.label; });
    var html = items.map(function (it, i) {
      return (i ? '<span class="lfc-sep" aria-hidden="true">/</span>' : "") +
        '<span class="lfc-crumb">' + (it.icon || "") + esc(it.label) + "</span>";
    }).join("");
    navs.forEach(function (nav) { nav.innerHTML = html; });
  }

  function renderDots(total) {
    if (!dotsList) return;
    var html = "";
    for (var n = 1; n <= total; n++) {
      var cls = "lfc-dot" + (n < current + 1 ? " is-done" : "") + (n === current + 1 ? " is-active" : "");
      html += '<li class="' + cls + '" data-dot="' + n + '"' + (n === current + 1 ? ' aria-current="step"' : "") + ">" + n + "</li>";
      if (n < total) {
        var t = n < current + 1 ? " is-done" : "";
        html += '<li class="lfc-tick' + t + '"></li><li class="lfc-tick' + t + '"></li>';
      }
    }
    dotsList.innerHTML = html;
    dotsList.setAttribute("aria-label", "Step " + (current + 1) + " of " + total);
  }

  function cardHTML(card, selected) {
    var fig = '<span class="lfc-card__figure">' +
      (card.img ? '<img src="' + card.img + '" alt="" />' : "") + "</span>";
    var sub = card.sub ? '<span class="lfc-card__range">' + esc(card.sub) + "</span>" : "";
    // disabled 카드(예: Night light→Trimless, Wall mtd @Mirror→Round) — 흐리게 + 클릭 불가.
    var dis = !!card.disabled;
    return '<button type="button" class="lfc-card' + (selected ? " is-selected" : "") +
      (dis ? " is-disabled" : "") + '"' + (dis ? ' disabled aria-disabled="true"' : "") +
      ' aria-pressed="' + (selected ? "true" : "false") + '">' + fig +
      '<span class="lfc-card__text"><span class="lfc-card__title">' + esc(card.title) + "</span>" + sub +
      "</span></button>";
  }

  // 행(list) 스텝 — Figma node 6:603 (조명 타입: 아이콘 + 라벨 + ⓘ). 메인폼 .lf-option 재사용.
  var INFO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11.25 16.75H12.75V11H11.25V16.75ZM12 9.2885C12.2288 9.2885 12.4207 9.21108 12.5755 9.05625C12.7303 8.90142 12.8077 8.70958 12.8077 8.48075C12.8077 8.25192 12.7303 8.06008 12.5755 7.90525C12.4207 7.75058 12.2288 7.67325 12 7.67325C11.7712 7.67325 11.5793 7.75058 11.4245 7.90525C11.2697 8.06008 11.1923 8.25192 11.1923 8.48075C11.1923 8.70958 11.2697 8.90142 11.4245 9.05625C11.5793 9.21108 11.7712 9.2885 12 9.2885ZM12.0017 21.5C10.6877 21.5 9.45267 21.2507 8.2965 20.752C7.14033 20.2533 6.13467 19.5766 5.2795 18.7218C4.42433 17.8669 3.74725 16.8617 3.24825 15.706C2.74942 14.5503 2.5 13.3156 2.5 12.0017C2.5 10.6877 2.74933 9.45267 3.248 8.2965C3.74667 7.14033 4.42342 6.13467 5.27825 5.2795C6.13308 4.42433 7.13833 3.74725 8.294 3.24825C9.44967 2.74942 10.6844 2.5 11.9982 2.5C13.3122 2.5 14.5473 2.74933 15.7035 3.248C16.8597 3.74667 17.8653 4.42342 18.7205 5.27825C19.5757 6.13308 20.2528 7.13833 20.7518 8.294C21.2506 9.44967 21.5 10.6844 21.5 11.9982C21.5 13.3122 21.2507 14.5473 20.752 15.7035C20.2533 16.8597 19.5766 17.8653 18.7218 18.7205C17.8669 19.5757 16.8617 20.2528 15.706 20.7518C14.5503 21.2506 13.3156 21.5 12.0017 21.5ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20Z" fill="currentColor" /></svg>';

  function rowHTML(card, selected) {
    var info = card.info ? '<span class="lf-option__info" aria-hidden="true">' + INFO_SVG + "</span>" : "";
    return '<button type="button" class="lf-option lf-option--info' + (selected ? " is-selected" : "") +
      '" aria-pressed="' + (selected ? "true" : "false") + '">' +
      '<span class="lf-option__main">' + (card.icon || "") +
      '<span class="lf-option__label">' + esc(card.title) + "</span></span>" + info + "</button>";
  }

  // NEXT 활성/비활성: 자동선택 없는 스텝(조명 타입)에서 선택 전이면 막는다.
  function updateNext() {
    if (!nextBtn) return;
    var steps = resolvedSteps();
    var blocked = false;
    if (current < steps.length) {
      var step = steps[current];
      if (step && step.variant === "list" && selections[step.title] == null) blocked = true;
    }
    nextBtn.disabled = blocked;
    nextBtn.classList.toggle("is-disabled", blocked);
    nextBtn.setAttribute("aria-disabled", blocked ? "true" : "false");
  }

  function render() {
    var steps = resolvedSteps();
    var total = steps.length + 1;            // +Fixture Price
    if (current > total - 1) current = total - 1;
    if (current < 0) current = 0;

    renderDots(total);

    var isPrice = current === steps.length;
    if (title) title.textContent = "Step " + (current + 1) + ": " + (isPrice ? "Fixture Price" : steps[current].title);

    if (isPrice) {
      if (cardsWrap) cardsWrap.hidden = true;
      if (pricePanel) pricePanel.hidden = false;
      if (!priceAutoShown) { priceAutoShown = true; openPrice(null); }
    } else {
      if (pricePanel) pricePanel.hidden = true;
      var step = steps[current];
      // 조명 타입(list) 스텝은 자동 선택하지 않는다(사용자가 직접 골라야 NEXT 활성).
      var noAuto = step.variant === "list";
      var titles = step.cards.map(function (c) { return c.title; });
      // 분기로 목록이 바뀌어 더는 유효치 않은 선택은 해제
      if (selections[step.title] != null && titles.indexOf(selections[step.title]) < 0) {
        selections[step.title] = null;
      }
      // 일반 카드 스텝만 첫 항목으로 기본 선택(단, disabled 카드는 건너뜀)
      if (selections[step.title] == null && !noAuto) {
        var firstEnabled = null;
        for (var fi = 0; fi < step.cards.length; fi++) {
          if (!step.cards[fi].disabled) { firstEnabled = step.cards[fi].title; break; }
        }
        selections[step.title] = firstEnabled;
      }
      var chosen = selections[step.title];
      var isList = step.variant === "list";
      cardsWrap.classList.toggle("lfc-cards--list", isList);
      cardsWrap.innerHTML = step.cards.map(function (c) {
        return isList ? rowHTML(c, c.title === chosen) : cardHTML(c, c.title === chosen);
      }).join("");
      cardsWrap.hidden = false;
      cardsWrap.setAttribute("aria-label", step.title);
      cardsWrap.setAttribute("data-step", step.key || "");   // CSS 훅(예: 천장고=ch 는 박스 꽉 채움)
      var itemSel = isList ? ".lf-option" : ".lfc-card";
      var labelSel = isList ? ".lf-option__label" : ".lfc-card__title";
      cardsWrap.querySelectorAll(itemSel).forEach(function (el) {
        el.addEventListener("click", function () {
          cardsWrap.querySelectorAll(itemSel).forEach(function (o) {
            o.classList.remove("is-selected"); o.setAttribute("aria-pressed", "false");
          });
          el.classList.add("is-selected"); el.setAttribute("aria-pressed", "true");
          selections[step.title] = el.querySelector(labelSel).textContent;
          updateNext();
        });
      });
    }
    updateNext();
    if (typeof lfc.scrollIntoView === "function") lfc.scrollIntoView({ block: "start" });
  }

  // 메인 폼에서 NEXT → 위저드 시작(선택값 전달). light-find.js 가 dispatch.
  document.addEventListener("lf:configstart", function (e) {
    ctx = (e.detail) || ctx;
    flow = (window.LF_STEPS && window.LF_STEPS(ctx.project, ctx.space, ctx.lighting, ctx.venue)) || [];
    selections = {};
    current = 0;
    priceAutoShown = false;
    renderCrumbs();
    render();
  });

  // --- 단계 이동 -----------------------------------------------------------
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (nextBtn.disabled) return;
      var steps = resolvedSteps();
      var total = steps.length + 1;
      if (current === total - 1) {
        // Fixture Price 에서 NEXT → 결과(로그인 시) / 로그인 안내(비로그인)
        var loggedIn = window.OptomaticAuth && window.OptomaticAuth.isLoggedIn();
        if (loggedIn) document.dispatchEvent(new CustomEvent("lf:gostep", { detail: { step: 3 } }));
        else openSignin(nextBtn);
        return;
      }
      current += 1;
      render();
    });
  }
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (current > 0) { current -= 1; render(); }
      else document.dispatchEvent(new CustomEvent("lf:gostep", { detail: { step: 1 } }));
    });
  }

  // --- 가격 비교 모달 (Step Fixture Price) ---------------------------------
  var priceModal = document.getElementById("lf-price-modal");
  var priceLastFocus = null;
  function openPrice(trigger) {
    if (!priceModal) return;
    priceLastFocus = trigger || null;
    priceModal.classList.add("is-open");
    var closeBtn = priceModal.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.focus();
  }
  function closePrice() {
    if (!priceModal) return;
    priceModal.classList.remove("is-open");
    if (priceLastFocus && typeof priceLastFocus.focus === "function") priceLastFocus.focus();
  }
  if (priceModal) {
    document.querySelectorAll("[data-price-info]").forEach(function (btn) {
      btn.addEventListener("click", function () { openPrice(btn); });
    });
    priceModal.querySelectorAll("[data-modal-close]").forEach(function (btn) {
      btn.addEventListener("click", closePrice);
    });
    priceModal.addEventListener("click", function (e) { if (e.target === priceModal) closePrice(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && priceModal.classList.contains("is-open")) closePrice();
    });
  }

  // --- 비로그인 안내 모달 --------------------------------------------------
  var signinModal = document.getElementById("lf-signin-modal");
  var signinLastFocus = null;
  function openSignin(trigger) {
    if (!signinModal) return;
    signinLastFocus = trigger || null;
    signinModal.classList.add("is-open");
    var closeBtn = signinModal.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.focus();
  }
  function closeSignin() {
    if (!signinModal) return;
    signinModal.classList.remove("is-open");
    if (signinLastFocus && typeof signinLastFocus.focus === "function") signinLastFocus.focus();
  }
  if (signinModal) {
    signinModal.querySelectorAll("[data-modal-close]").forEach(function (btn) {
      btn.addEventListener("click", closeSignin);
    });
    signinModal.addEventListener("click", function (e) { if (e.target === signinModal) closeSignin(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && signinModal.classList.contains("is-open")) closeSignin();
    });
  }

  // --- Fixture Preview(결과) — 카드 선택 · BACK · Refresh 누적 -------------
  var results = document.querySelector(".lf-results");
  var currentRow = document.querySelector("[data-pcards-current]");
  var prevWrap = document.querySelector("[data-pcards-prev]");
  var prevToggle = document.querySelector("[data-prev-toggle]");
  var prevCountEl = prevToggle && prevToggle.querySelector("[data-prev-count]");

  function deselectAllCards() {
    if (!results) return;
    results.querySelectorAll(".lf-pcard").forEach(function (c) {
      c.classList.remove("is-selected"); c.setAttribute("aria-pressed", "false");
    });
  }
  if (results) {
    results.querySelectorAll(".lf-pcard").forEach(function (c) {
      c.setAttribute("aria-pressed", c.classList.contains("is-selected") ? "true" : "false");
    });
    results.addEventListener("click", function (e) {
      var card = e.target.closest(".lf-pcard");
      if (!card || !results.contains(card)) return;
      deselectAllCards();
      card.classList.add("is-selected");
      card.setAttribute("aria-pressed", "true");
    });
  }

  if (prevToggle && prevWrap) {
    prevToggle.addEventListener("click", function () {
      var expanded = prevToggle.getAttribute("aria-expanded") !== "true";
      prevToggle.setAttribute("aria-expanded", String(expanded));
      prevToggle.classList.toggle("is-expanded", expanded);
      prevWrap.hidden = !expanded;
    });
  }

  var previewBack = document.querySelector("[data-preview-back]");
  if (previewBack) {
    previewBack.addEventListener("click", function () {
      document.dispatchEvent(new CustomEvent("lf:gostep", { detail: { step: 2 } }));
    });
  }
  // 선택한 fixture 카드의 이미지·스펙을 Contact/Submit 요약 카드에 반영한다.
  function applySelectedFixture() {
    var card = document.querySelector(".lf-pcard.is-selected");
    if (!card) return;

    var srcImg = card.querySelector(".lf-pcard__figure img");
    var specs = {};
    card.querySelectorAll(".lf-pcard__row").forEach(function (row) {
      var dt = row.querySelector("dt");
      var dd = row.querySelector("dd");
      if (dt && dd) specs[dt.textContent.trim()] = dd.innerHTML;
    });

    document.querySelectorAll(".lf-cd-summary").forEach(function (summary) {
      var destImg = summary.querySelector(".lf-cd-summary__figure img");
      if (destImg && srcImg) {
        destImg.src = srcImg.getAttribute("src");
        destImg.alt = srcImg.getAttribute("alt") || "";
      }
      summary.querySelectorAll(".lf-cd-summary__row").forEach(function (row) {
        var dt = row.querySelector("dt");
        var dd = row.querySelector("dd");
        if (!dt || !dd) return;
        var val = specs[dt.textContent.trim()];
        if (val != null) dd.innerHTML = val.replace(/<br\s*\/?>/gi, " ");
      });
    });
  }

  var previewNext = document.querySelector("[data-preview-next]");
  if (previewNext) {
    previewNext.addEventListener("click", function () {
      applySelectedFixture();
      document.dispatchEvent(new CustomEvent("lf:gostep", { detail: { step: 4 } }));
    });
  }
  var contactBack = document.querySelector("[data-contact-back]");
  if (contactBack) {
    contactBack.addEventListener("click", function () {
      document.dispatchEvent(new CustomEvent("lf:gostep", { detail: { step: 3 } }));
    });
  }
  // Contact Distributer SUBMIT — 요청 1건을 서버(Ldesign, service="Light Find")에 저장한다.
  // 저장되면 My projects / 대시보드(Recent projects) 목록에 "Light Find" 카드로 나타난다.
  // (Light Design 완료 화면과 동일한 저장 방식 — light-design-complete.html 참고)
  // 저장 실패/비로그인이어도 감사(Step 5) 화면 전환은 막지 않는다.
  var contactSubmit = document.querySelector("[data-contact-submit]");
  if (contactSubmit) {
    var submitting = false;
    contactSubmit.addEventListener("click", function (e) {
      e.preventDefault();
      if (submitting) return;
      submitting = true;
      saveLightFindRequest().then(function () {
        submitting = false;
        document.dispatchEvent(new CustomEvent("lf:gostep", { detail: { step: 5 } }));
      });
    });
  }

  function contactFieldVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  // 선택한 fixture 카드의 스펙(라벨→값)을 읽는다.
  function selectedFixtureSpecs() {
    var card = document.querySelector(".lf-pcard.is-selected");
    var out = {};
    if (!card) return out;
    card.querySelectorAll(".lf-pcard__row").forEach(function (row) {
      var dt = row.querySelector("dt");
      var dd = row.querySelector("dd");
      if (dt && dd) out[dt.textContent.trim()] = dd.textContent.replace(/\s+/g, " ").trim();
    });
    return out;
  }

  // 선택 fixture 이미지 경로(있으면).
  function selectedFixtureImg() {
    var card = document.querySelector(".lf-pcard.is-selected");
    var img = card && card.querySelector(".lf-pcard__figure img");
    return img ? (img.getAttribute("src") || "") : "";
  }

  // 문의 폼 + 선택 fixture 를 Lfind(Light Find 전용 테이블) 한 건으로 저장.
  // ldesign(디자인요청)과는 별개 테이블/엔드포인트(/api/lfind). 로그인/성공 시 id, 아니면 null.
  async function saveLightFindRequest() {
    if (!window.OptomaticAuth || !OptomaticAuth.getAccessToken) return null;
    var at = null;
    try { at = await OptomaticAuth.getAccessToken(); } catch (e) {}
    if (!at) return null;

    var specs = selectedFixtureSpecs();
    var fileInput = document.querySelector(".lf-cd-dropzone__input");
    var cardFile = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0].name : "";

    try {
      var res = await fetch("/api/lfind", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": at },
        body: JSON.stringify({
          status: "todo",
          projectName: contactFieldVal("lf-cd-project-name"),
          projectLocation: contactFieldVal("lf-cd-project-location"),
          projectSchedule: contactFieldVal("lf-cd-project-schedule"),
          fixturesQuantity: contactFieldVal("lf-cd-quantity"),
          company: contactFieldVal("lf-cd-company"),
          companyLocation: contactFieldVal("lf-cd-company-location"),
          remarks: contactFieldVal("lf-cd-remarks"),
          businessCard: cardFile,
          fixtureManufacturer: specs["Manufacturer"] || "",
          fixtureHousing: specs["Housing finish"] || "",
          fixtureDimensions: specs["Dimensions"] || "",
          fixtureWattage: specs["Total Luminaire Wattage"] || "",
          fixtureControl: specs["Control"] || "",
          fixtureImg: selectedFixtureImg()
        })
      });
      if (!res.ok) return null;
      var data = await res.json();
      return (data && data.id != null) ? data.id : null;
    } catch (e) { return null; }
  }

  document.querySelectorAll(".lf-doc").forEach(function (doc) {
    var previewBtn = doc.querySelector(".lf-doc__btn");
    var panel = doc.querySelector("[data-doc-preview-panel]");
    if (!previewBtn || !panel) return;
    previewBtn.setAttribute("aria-expanded", "false");
    previewBtn.addEventListener("click", function () {
      var willOpen = panel.hidden;
      panel.hidden = !willOpen;
      previewBtn.setAttribute("aria-expanded", String(willOpen));
    });
  });

  var refreshBtn = document.querySelector("[data-preview-refresh]");
  if (refreshBtn) {
    var refreshCount = refreshBtn.querySelector("[data-refresh-count]");
    var refreshNote = document.querySelector("[data-refresh-note]");
    var REFRESH_MAX = 3;
    var refreshUsed = 0;
    refreshBtn.addEventListener("click", function () {
      if (refreshUsed >= REFRESH_MAX) return;
      refreshUsed++;
      if (currentRow && prevWrap) {
        var clone = currentRow.cloneNode(true);
        clone.removeAttribute("data-pcards-current");
        clone.removeAttribute("role");
        clone.removeAttribute("aria-label");
        clone.querySelectorAll(".lf-pcard").forEach(function (c) {
          c.classList.remove("is-selected");
          c.setAttribute("aria-pressed", "false");
        });
        prevWrap.insertBefore(clone, prevWrap.firstChild);
      }
      deselectAllCards();
      if (refreshCount) refreshCount.textContent = "Refresh " + refreshUsed + "/" + REFRESH_MAX;
      if (prevCountEl) prevCountEl.textContent = String(refreshUsed * 3);
      if (prevToggle) prevToggle.hidden = false;
      if (refreshUsed >= REFRESH_MAX && refreshNote) refreshNote.hidden = false;
    });
  }
})();
