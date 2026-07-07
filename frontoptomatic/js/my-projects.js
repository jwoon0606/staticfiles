/* ============================================================================
 * my-projects.js — My projects 뷰 토글 + 빈 상태
 *
 * /my-projects 는 한 페이지에 4개 상태를 모두 담는다:
 *   - 뷰 토글(list / grid / analytics): 같은 데이터의 다른 레이아웃. 기본 list.
 *   - 빈 상태(empty): 프로젝트 0건. 어떤 뷰를 골라도 보여줄 데이터가 없다.
 *
 * 정적 프로토타입이라 데이터 유무는 URL 쿼리(?state=empty)로 시뮬레이션한다.
 * 백엔드 연동 시 isEmpty 를 "서버가 내려준 프로젝트 개수 === 0" 으로 대체하면 된다.
 *
 * 사용법: <body> 끝에서  <script src="js/my-projects.js" defer></script>
 * ========================================================================== */
(function () {
  "use strict";

  function init() {
    var body = document.querySelector(".mp-body");
    var buttons = Array.prototype.slice.call(
      document.querySelectorAll(".mp-view__btn[data-view]")
    );
    var panels = Array.prototype.slice.call(
      document.querySelectorAll("[data-view-panel]")
    );
    if (!body || !buttons.length || !panels.length) return;

    // 해당 패널만 보이고 나머지는 숨김
    function showPanel(name) {
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-view-panel") !== name;
      });
    }

    // 토글 버튼 활성 표시(외형 + aria) 갱신
    function setActiveButton(view) {
      buttons.forEach(function (btn) {
        var active = btn.getAttribute("data-view") === view;
        btn.classList.toggle("mp-view__btn--active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    var params = new URLSearchParams(window.location.search);
    var isEmpty = params.get("state") === "empty";

    if (isEmpty) {
      // 데이터 0건: 본문 상단/하단 패딩(mp-body--empty) + 빈 패널만 표시.
      // 뷰 토글은 의미가 없으므로 기본(list) 강조만 유지하고 빈 패널을 고정한다.
      body.classList.add("mp-body--empty");
      setActiveButton("list");
      showPanel("empty");
      return;
    }

    // 기본 뷰: 목록형(list)
    setActiveButton("list");
    showPanel("list");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-view");
        setActiveButton(view);
        showPanel(view);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
