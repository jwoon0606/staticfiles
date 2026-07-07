/* ============================================================================
 * coming-soon.js — "Coming Soon" 이메일 등록 동작
 *
 * GET NOTIFIED 폼([data-notify-form])을 제출하면:
 *   · 폼을 숨기고(감사 메시지로 교체)
 *   · 감사 메시지([data-notify-thanks])를 표시합니다.
 *     → Figma "Desktop - 189(입력) → Desktop - 204(Thank you…)" 전환을
 *       같은 페이지 안의 상태 변경으로 구현.
 *
 * 실제 이메일 등록(서버/API 연동)은 후속 작업에서 연결하세요.
 * 사용법: <body> 끝에서  <script src="js/coming-soon.js" defer></script>
 * ========================================================================== */
(function () {
  "use strict";

  function init() {
    var form = document.querySelector("[data-notify-form]");
    if (!form) return;
    var thanks = document.querySelector("[data-notify-thanks]");

    function showThanks() {
      form.setAttribute("hidden", "");
      if (thanks) {
        thanks.removeAttribute("hidden");
        thanks.setAttribute("tabindex", "-1");
        thanks.focus();                                // 전환 후 메시지로 포커스 이동(접근성)
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      // 기본 이메일 유효성 검사 (type="email" + required)
      if (typeof form.checkValidity === "function" && !form.checkValidity()) {
        if (typeof form.reportValidity === "function") form.reportValidity();
        return;
      }

      var emailInput = form.querySelector('input[type="email"], input[name="email"]');
      var email = emailInput ? emailInput.value.trim() : "";

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // 서버에 이메일 등록 (DB 저장). 실패해도 사용자에게는 감사 메시지 표시.
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      })
        .catch(function () {
          // 네트워크 오류는 콘솔에만 기록
        })
        .then(function () {
          showThanks();
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
