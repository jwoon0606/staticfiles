/* ============================================================================
 * hero.js — 히어로 6슬라이드 캐러셀
 *   배경(Light Find 3 + Light Design 3) 전환 + 전경 텍스트(제목/리드/설명/CTA)를
 *   슬라이드에 맞춰 Light Find ↔ Light Design 으로 교체합니다.
 *   화살표·도트 클릭 / 자동재생(6s) / 키보드 좌우 / hover·focus 시 일시정지 지원.
 *
 * 사용법: <body> 끝에서  <script src="js/hero.js" defer></script>
 * ========================================================================== */
(function () {
  "use strict";

  // 슬라이드별 전경 카피 (Figma: Light Find 6661:10599 / Light Design 7126:21883~21886)
  var LIGHT_FIND = {
    title: "Light Find",
    lead: "Enter your space requirements and get a lighting layout and recommendations in 3 minutes.",
    desc: "Find suitable lighting specifications in 3 minutes with layout tips based on your space’s height, finishes, furnitures, budget, and etc.",
    // 모바일 전용 문구 (Figma 4755:7743)
    leadMobile: "The best lighting solutions with just a few clicks",
    descMobile: "Find your light fixture quickly and efficiently based on project lead time, the best lighting system recommendations for you considering ceiling height, finishing materials, furnitures, budget, etc.",
    href: "/light-find",
  };
  var LIGHT_DESIGN = {
    title: "Light Design",
    lead: "A data-driven service to provide tailor-made lighting solutions",
    desc: "A smart lighting design service that provides fast and accurate, space-optimized lighting solutions, reducing design time and costs.",
    href: "/light-design",
  };
  // 배경 순서: LF1·LF2·LF3·LD1·LD2·LD3
  var CONTENT = [LIGHT_FIND, LIGHT_FIND, LIGHT_FIND, LIGHT_DESIGN, LIGHT_DESIGN, LIGHT_DESIGN];

  var AUTOPLAY_MS = 6000;

  function initHero() {
    var hero = document.querySelector("[data-hero]");
    if (!hero) return;

    var slides = hero.querySelectorAll(".hero__slide");
    var dots = hero.querySelectorAll("[data-hero-dot]");
    var titleEl = hero.querySelector("[data-hero-title]");
    var leadEl = hero.querySelector("[data-hero-lead]");
    var descEl = hero.querySelector("[data-hero-desc]");
    var ctaEl = hero.querySelector("[data-hero-cta]");
    var prevBtn = hero.querySelector("[data-hero-prev]");
    var nextBtn = hero.querySelector("[data-hero-next]");

    var count = slides.length;
    if (count === 0) return;

    var index = 0;
    var timer = null;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function render() {
      for (var i = 0; i < count; i++) {
        slides[i].classList.toggle("is-active", i === index);
        if (dots[i]) {
          dots[i].classList.toggle("is-active", i === index);
          dots[i].setAttribute("aria-selected", i === index ? "true" : "false");
        }
      }
      var c = CONTENT[index] || CONTENT[0];
      var mobile = window.matchMedia("(max-width: 1023.98px)").matches;
      if (titleEl) titleEl.textContent = c.title;
      if (leadEl) leadEl.textContent = mobile && c.leadMobile ? c.leadMobile : c.lead;
      if (descEl) descEl.textContent = mobile && c.descMobile ? c.descMobile : c.desc;
      if (ctaEl) ctaEl.setAttribute("href", c.href);
      // 섹션 라벨도 현재 제품으로 갱신
      hero.setAttribute("aria-label", c.title);
    }

    function goTo(i) {
      index = ((i % count) + count) % count; // 순환
      render();
    }
    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    function startAuto() {
      if (reduceMotion || timer) return;
      timer = window.setInterval(next, AUTOPLAY_MS);
    }
    function stopAuto() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }
    function restartAuto() { stopAuto(); startAuto(); }

    if (nextBtn) nextBtn.addEventListener("click", function () { next(); restartAuto(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { prev(); restartAuto(); });

    Array.prototype.forEach.call(dots, function (dot, i) {
      dot.addEventListener("click", function () { goTo(i); restartAuto(); });
    });

    // 키보드 좌우 (히어로에 포커스가 있을 때)
    hero.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { prev(); restartAuto(); }
      else if (e.key === "ArrowRight") { next(); restartAuto(); }
    });

    // hover / focus 시 자동재생 일시정지
    hero.addEventListener("mouseenter", stopAuto);
    hero.addEventListener("mouseleave", startAuto);
    hero.addEventListener("focusin", stopAuto);
    hero.addEventListener("focusout", startAuto);

    // 데스크톱↔모바일 전환 시 문구 갱신
    window.addEventListener("resize", render);

    render();
    startAuto();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHero);
  } else {
    initHero();
  }
})();
