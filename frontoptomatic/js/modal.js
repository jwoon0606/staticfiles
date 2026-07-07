/* ============================================================================
 * modal.js — ERCO 신제품 프로모 팝업 (Figma node 7126:13814)
 *   페이지 로드 시 표시. 닫기(X·배경·ESC). 제품 캐러셀(화살표·도트).
 *   "Do not show this for next 24 hours" 체크 후 닫으면 24시간 동안 표시 안 함.
 *
 * 제품 추가: 아래 PRODUCTS 배열에 { img, name, desc } 를 더하면
 *   도트·화살표가 자동으로 늘어납니다. (현재 Iku 1종만 디자인에 있음)
 *
 * 사용법: <body> 끝에서  <script src="js/modal.js" defer></script>
 * ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "ercoModalDismissedUntil";
  var DAY_MS = 24 * 60 * 60 * 1000;

  // ERCO 제품 목록 (Figma 에는 Iku 1종만 있음 — 나머지는 데이터 확보 시 추가)
  var PRODUCTS = [
    { img: "assets/erco-iku.png", name: "Iku", desc: "Universal for architectural lighting" },
  ];

  function readDismissedUntil() {
    try {
      return parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    } catch (e) {
      return 0; // localStorage 불가(시크릿/파일제한) 시 항상 표시
    }
  }
  function writeDismissedUntil(ts) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(ts));
    } catch (e) {
      /* 저장 불가 시 무시 */
    }
  }

  function initModal() {
    var overlay = document.querySelector("[data-modal]");
    if (!overlay) return;

    // 24시간 숨김 기간이면 표시하지 않음
    if (Date.now() < readDismissedUntil()) return;

    var imgEl = overlay.querySelector("[data-modal-img]");
    var nameEl = overlay.querySelector("[data-modal-name]");
    var descEl = overlay.querySelector("[data-modal-desc]");
    var dotsWrap = overlay.querySelector("[data-modal-dots]");
    var prevBtn = overlay.querySelector("[data-modal-prev]");
    var nextBtn = overlay.querySelector("[data-modal-next]");
    var dismissChk = overlay.querySelector("[data-modal-dismiss]");
    var closeBtns = overlay.querySelectorAll("[data-modal-close]");

    var index = 0;
    var dots = [];

    // 슬라이드 수: 제품이 2개 이상이면 제품 수, 1개여도 캐러셀 UI를 보이려
    // 디자인 기준 5칸을 자리로 둠 (제품 추가되면 제품 수만큼으로 바뀜)
    var slideCount = PRODUCTS.length > 1 ? PRODUCTS.length : 5;

    // 도트 생성 (슬라이드 수만큼)
    for (var di = 0; di < slideCount; di++) {
      (function (i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "modal__dot";
        b.setAttribute("aria-label", "Slide " + (i + 1));
        b.addEventListener("click", function () { goTo(i); });
        dotsWrap.appendChild(b);
        dots.push(b);
      })(di);
    }

    function render() {
      var p = PRODUCTS[index % PRODUCTS.length]; // 제품이 적으면 순환
      if (imgEl) { imgEl.src = p.img; imgEl.alt = p.name; }
      if (nameEl) nameEl.textContent = p.name;
      if (descEl) descEl.textContent = p.desc;
      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === index); });
    }
    function goTo(i) {
      index = ((i % slideCount) + slideCount) % slideCount;
      render();
    }

    // 화살표는 항상 표시 (제품이 1개여도 UI 유지)
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(index + 1); });
    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(index - 1); });

    function open() {
      render();
      overlay.hidden = false;
      document.body.style.overflow = "hidden"; // 배경 스크롤 잠금
    }
    function close() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      if (dismissChk && dismissChk.checked) {
        writeDismissedUntil(Date.now() + DAY_MS);
      }
    }

    Array.prototype.forEach.call(closeBtns, function (b) {
      b.addEventListener("click", close);
    });
    // 배경(오버레이) 클릭 시 닫기 (모달 내부 클릭은 제외)
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    // ESC 로 닫기
    document.addEventListener("keydown", function (e) {
      if (!overlay.hidden && e.key === "Escape") close();
    });

    open();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModal);
  } else {
    initModal();
  }
})();
