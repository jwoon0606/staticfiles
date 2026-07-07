/* ============================================================================
 * partners.js — Brand Partners "VIEW MORE" 펼치기/접기
 * 버튼([data-partners-toggle])을 누르면 섹션에 .is-expanded 를 토글해
 * 추가 로고 행(.partners__row--extra)을 펼치거나 접습니다. (CSS가 표시 제어)
 *
 * 사용법: <body> 끝에서  <script src="js/partners.js" defer></script>
 * ========================================================================== */
(function () {
  "use strict";

  function initPartnersToggle() {
    var buttons = document.querySelectorAll("[data-partners-toggle]");

    Array.prototype.forEach.call(buttons, function (button) {
      var section = button.closest(".landing-partners");
      if (!section) return;

      button.addEventListener("click", function () {
        var expanded = section.classList.toggle("is-expanded");
        button.setAttribute("aria-expanded", String(expanded));
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPartnersToggle);
  } else {
    initPartnersToggle();
  }
})();
