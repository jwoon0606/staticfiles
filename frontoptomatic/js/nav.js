/* ============================================================================
 * nav.js — 내비게이션 토글 동작
 *
 * 두 가지 토글을 같은 방식으로 처리합니다(둘 다 [data-nav-toggle]):
 *   1) 모바일 햄버거(dehaze) → 메뉴 드롭다운(#nav-menu) 열고 닫기
 *   2) 데스크톱 언어 버튼(EN) → 언어 선택 드롭다운(#nav-lang-menu) 열고 닫기
 *
 * 공통 동작:
 *   · 버튼이 aria-controls 로 가리키는 대상의 hidden / aria-expanded 토글
 *   · 대상 밖 클릭, Esc 키로 닫힘
 *   · data-label-open / data-label-close 가 있으면 그 값으로 aria-label 갱신
 *     (햄버거는 "Open/Close menu"; 언어 버튼은 label 미지정이라 aria-label 유지)
 *
 * 추가로 언어 옵션([data-lang]) 클릭 시:
 *   · 버튼 라벨(EN/KR)을 선택값으로 갱신, aria-current 이동 후 드롭다운 닫기
 *
 * 사용법: <body> 끝에서  <script src="js/nav.js" defer></script>
 * ========================================================================== */
(function () {
  "use strict";

  function initToggle(toggle) {
    var menuId = toggle.getAttribute("aria-controls");
    var menu = menuId ? document.getElementById(menuId) : null;
    if (!menu) return;

    var labelOpen = toggle.getAttribute("data-label-open");
    var labelClose = toggle.getAttribute("data-label-close");

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (labelOpen && labelClose) {
        toggle.setAttribute("aria-label", open ? labelClose : labelOpen);
      }
      if (open) {
        menu.removeAttribute("hidden");
      } else {
        menu.setAttribute("hidden", "");
      }
    }

    toggle.addEventListener("click", function (event) {
      event.stopPropagation();
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    // 대상 밖 클릭 시 닫기
    document.addEventListener("click", function (event) {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });

    // Esc 로 닫고 포커스 복귀
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      setOpen(false);
      toggle.focus();
    });

    return { menu: menu, setOpen: setOpen };
  }

  // 언어 옵션 클릭 → 버튼 라벨/aria-current 갱신 후 닫기
  function initLangSelection(controller) {
    var menu = controller.menu;
    var options = menu.querySelectorAll("[data-lang]");
    if (!options.length) return;

    var wrap = menu.closest(".nav__lang-wrap");
    var current = wrap ? wrap.querySelector(".nav__lang-current") : null;

    Array.prototype.forEach.call(options, function (option) {
      option.addEventListener("click", function () {
        var label = option.getAttribute("data-lang-label");
        if (current && label) current.textContent = label;

        Array.prototype.forEach.call(options, function (o) {
          o.setAttribute("aria-current", o === option ? "true" : "false");
        });

        controller.setOpen(false);
        // ※ 실제 페이지 언어 전환(i18n 적용)은 후속 작업에서 연결하세요.
      });
    });
  }

  // 로그인 상태 우측 아이콘(알림/프로필) 선택 토글.
  //   Figma 변형 select2 = no | notification | profile (단일 선택)에 대응.
  //   · 클릭 시 aria-pressed 토글 → CSS 가 회색(#5b5d62)→검정(#1a1b1b) 전환
  //   · 한 번에 하나만 선택(서로 배타) — 다른 아이콘 누르면 이전 선택 해제
  //   · 그룹 밖 클릭 / Esc 로 모두 해제
  //   ※ 펼쳐지는 패널은 이 디자인 세트에 없어 선택 상태만 처리합니다
  //     (패널이 생기면 위 initToggle 패턴으로 aria-controls 를 연결하세요).
  //   · 예외) 프로필 아이콘은 토글이 아니라 대시보드(dashboard.html)로 이동합니다.
  //     로그인 후 프로필 진입 화면(260429_dashboard_UI_02)으로 연결.
  //   · 예외) 알림(벨) 아이콘도 토글이 아니라 알림 페이지(notifications.html)로
  //     이동합니다. 알림 진입 화면(260429_dashboard_UI_13)으로 연결.
  function initAccountIcons() {
    var icons = document.querySelectorAll(".nav__icon-btn[data-account-icon]");
    if (!icons.length) return;

    function clearAll(except) {
      Array.prototype.forEach.call(icons, function (icon) {
        if (icon !== except) icon.setAttribute("aria-pressed", "false");
      });
    }

    Array.prototype.forEach.call(icons, function (icon) {
      icon.addEventListener("click", function (event) {
        event.stopPropagation();
        // 프로필: 선택 토글 대신 대시보드로 이동
        if (icon.getAttribute("data-account-icon") === "profile") {
          location.href = "/dashboard";
          return;
        }
        // 알림(벨): 선택 토글 대신 알림 페이지로 이동
        if (icon.getAttribute("data-account-icon") === "notifications") {
          location.href = "/notifications";
          return;
        }
        var pressed = icon.getAttribute("aria-pressed") === "true";
        clearAll(icon);
        icon.setAttribute("aria-pressed", pressed ? "false" : "true");
      });
    });

    // 그룹 밖 클릭 시 해제
    document.addEventListener("click", function (event) {
      var inside = false;
      Array.prototype.forEach.call(icons, function (icon) {
        if (icon.contains(event.target)) inside = true;
      });
      if (!inside) clearAll(null);
    });

    // Esc 로 해제
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") clearAll(null);
    });
  }

  function init() {
    var toggles = document.querySelectorAll("[data-nav-toggle]");
    Array.prototype.forEach.call(toggles, function (toggle) {
      var controller = initToggle(toggle);
      if (controller) initLangSelection(controller);
    });
    initAccountIcons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
