/* ============================================================================
 * footer.js — 푸터 동작
 * 상단 퍼플 "BACK TO TOP" 바를 클릭하면 페이지 맨 위로 스크롤합니다.
 *
 * 사용법: <body> 끝에서  <script src="footer.js" defer></script>
 * (defer 로 불러오면 DOM 이 준비된 뒤 실행됩니다.)
 * ========================================================================== */
(function () {
  "use strict";

  function initBackToTop() {
    // 한 페이지에 푸터가 여러 개일 수 있으니 전부 처리
    var buttons = document.querySelectorAll("[data-back-to-top]");

    // 사용자가 "동작 줄이기" 설정 시 부드러운 스크롤 대신 즉시 이동
    var prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener("click", function () {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBackToTop);
  } else {
    initBackToTop();
  }
})();
