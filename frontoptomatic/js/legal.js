/* ============================================================================
 * legal.js — 약관/개인정보처리방침 페이지의 EN/KR 본문 전환.
 *   · [data-legal-lang="en|kr"] 블록(제목 span·본문 article)을 언어에 맞춰 노출.
 *   · nav 언어 옵션([data-lang]) 클릭 시 전환하고 localStorage 에 저장.
 *   · 다른 페이지의 전역 i18n 이 붙기 전까지 이 두 페이지에서만 동작.
 * ========================================================================== */
(function () {
  "use strict";
  var KEY = "optomatic.lang";

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(l) { try { localStorage.setItem(KEY, l); } catch (e) {} }

  function apply(lang) {
    lang = lang === "kr" ? "kr" : "en";
    document.querySelectorAll("[data-legal-lang]").forEach(function (el) {
      el.hidden = el.getAttribute("data-legal-lang") !== lang;
    });
    document.documentElement.setAttribute("lang", lang === "kr" ? "ko" : "en");

    // nav 언어 라벨/선택표시 동기화
    var label = lang.toUpperCase();
    document.querySelectorAll('.nav__lang-current, .nav__menu-lang [data-i18n="nav.lang"]')
      .forEach(function (el) { el.textContent = label; });
    document.querySelectorAll("[data-lang]").forEach(function (opt) {
      opt.setAttribute("aria-current", opt.getAttribute("data-lang") === lang ? "true" : "false");
    });
    store(lang);
  }

  apply(saved() || "en");

  document.addEventListener("click", function (e) {
    var opt = e.target && e.target.closest ? e.target.closest("[data-lang]") : null;
    if (opt) apply(opt.getAttribute("data-lang"));
  });
})();
