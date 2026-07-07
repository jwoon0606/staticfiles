/* ============================================================================
 * auth.js — 간단한 로그인 상태 관리 (정적 사이트, localStorage 기반)
 *
 * 동작:
 *   · localStorage["optomatic_auth"] === "in"  → 로그인 상태
 *   · 페이지의 [data-auth="out"] 요소 = 로그아웃 상태에서만 표시 (예: SIGN IN 링크)
 *   · 페이지의 [data-auth="in"]  요소 = 로그인 상태에서만 표시 (예: 알림·프로필 아이콘)
 *   · SIGN IN 링크(login.html 로 가는 a) 클릭 시 현재 페이지를 기억해 두었다가
 *     로그인 완료 후 그 페이지로 복귀(없으면 index.html).
 *
 * login.html 의 폼에서:
 *   window.OptomaticAuth.login()  호출 → 로그인 상태 저장 후 이전 페이지로 이동
 *
 * 사용법: <body> 끝에서  <script src="js/auth.js" defer></script>
 *   (nav.js 보다 먼저/나중 무관하지만 모든 nav 페이지에 포함)
 * ========================================================================== */
(function () {
  "use strict";

  var KEY = "optomatic_auth";
  var RETURN_KEY = "optomatic_return";

  function isLoggedIn() {
    try {
      return localStorage.getItem(KEY) === "in";
    } catch (e) {
      return false;
    }
  }

  function setLoggedIn(on) {
    try {
      if (on) localStorage.setItem(KEY, "in");
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  // ── 토큰 / 권한 ───────────────────────────────────────────────────────────
  // 프로젝트 표준 토큰 키 — admin·구 페이지(func_ajax)와 동일하게 공유한다.
  var ACCESS_KEY = "accessToken";
  var REFRESH_KEY = "refreshToken";
  var accessTokenCache = null; // access 토큰은 짧게 살아서 메모리에만 캐시

  function getRefreshToken() {
    try { return localStorage.getItem(REFRESH_KEY); } catch (e) { return null; }
  }

  // refresh 토큰 저장 (로그인 직후 호출).
  function storeRefreshToken(refresh) {
    try { localStorage.setItem(REFRESH_KEY, refresh); } catch (e) {}
  }

  // 저장된 refresh 토큰으로 access 토큰을 발급받는다(POST /api/auth).
  async function getAccessToken() {
    if (accessTokenCache) return accessTokenCache;
    var refresh = getRefreshToken();
    if (!refresh) return null;
    try {
      var res = await fetch("/api/auth", { method: "POST", headers: { RefreshToken: refresh } });
      if (!res.ok) return null;
      accessTokenCache = res.headers.get("Authorization");
      try { localStorage.setItem(ACCESS_KEY, accessTokenCache); } catch (e) {}
      return accessTokenCache;
    } catch (e) {
      return null;
    }
  }

  // 현재 로그인 사용자 정보(GET /api/user/me). 실패 시 null.
  async function fetchMe() {
    var at = await getAccessToken();
    if (!at) return null;
    try {
      var res = await fetch("/api/user/me", { headers: { Authorization: at } });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // 관리자일 때만 [data-admin] 요소를 보여준다(기본 숨김).
  //   비로그인·비관리자는 항상 숨김. 관리자만 노출한다.
  function applyAdminVisibility() {
    var adminEls = document.querySelectorAll("[data-admin]");
    if (!adminEls.length) return;
    function setShow(show) {
      Array.prototype.forEach.call(adminEls, function (el) {
        el.style.display = show ? "" : "none";
      });
    }
    if (!isLoggedIn()) { setShow(false); return; }
    fetchMe().then(function (me) {
      setShow(!!(me && me.admin));
    });
  }

  // nav 의 로그인 전/후 요소 전환.
  //   inline style.display 로 직접 제어해 CSS 우선순위 문제를 피한다.
  function applyAuthState() {
    var loggedIn = isLoggedIn();
    var els = document.querySelectorAll("[data-auth]");
    Array.prototype.forEach.call(els, function (el) {
      var want = el.getAttribute("data-auth"); // "in" | "out"
      var show = (want === "in") === loggedIn;
      el.style.display = show ? "" : "none";
    });
  }

  // SIGN IN 링크 클릭 시, 로그인 후 돌아올 페이지를 저장.
  //   기본은 현재 페이지. 단, 링크에 data-return="..." 이 있으면 그 주소로 복귀한다.
  //   (예: Light Design 의 로그인 요청 모달은 완료 페이지로 바로 보내고 싶음)
  function trackReturn() {
    var links = document.querySelectorAll('a[href$="/login"]');
    Array.prototype.forEach.call(links, function (link) {
      link.addEventListener("click", function () {
        try {
          var override = link.getAttribute("data-return");
          var url = override ? new URL(override, location.href).href : location.href;
          sessionStorage.setItem(RETURN_KEY, url);
        } catch (e) {}
      });
    });
  }

  // 전역 노출 — login.html 폼에서 사용.
  window.OptomaticAuth = {
    isLoggedIn: isLoggedIn,
    getAccessToken: getAccessToken,
    storeRefreshToken: storeRefreshToken,
    fetchMe: fetchMe,
    login: function () {
      setLoggedIn(true);
      var back = null;
      try {
        back = sessionStorage.getItem(RETURN_KEY);
        sessionStorage.removeItem(RETURN_KEY);
      } catch (e) {}
      location.href = back || "/";
    },
    logout: function () {
      setLoggedIn(false);
      accessTokenCache = null;
      try {
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(ACCESS_KEY);
      } catch (e) {}
    },
    // 로그아웃 후 메인으로 이동
    logoutAndGoHome: function () {
      this.logout();
      location.href = "/";
    },
  };

  function init() {
    applyAuthState();
    applyAdminVisibility();
    trackReturn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
