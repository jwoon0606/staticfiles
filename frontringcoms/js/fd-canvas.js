/* ============================================================
   강제 다크모드(삼성 인터넷) 최종 방어 — canvas 페인트
   실기기 테스트(/css/darktest.html) 결과: 단색·그라데이션은 반전,
   이미지(타일/JPEG/SVG패턴)는 톤다운되지만 canvas 만 절대 안 건드린다.
   → 밝은 배경과 밝은 사진을 canvas 로 다시 그려 원색 그대로 표시.
   일반 브라우저에서도 동일하게 렌더링되므로 UA 분기 없이 전원 적용.
   ============================================================ */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.textContent =
    '.fd-cv{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;border-radius:inherit;}' +
    '.fd-cv-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;}' +
    /* 플라이아웃 항목 hover(#c9ab8a·데스크탑)가 canvas 에 가려지지 않게 */
    '.cta-apply-item:hover .fd-cv{opacity:0;}' +
    /* 햄버거/X 아이콘 canvas — 기존 svg·pseudo X 를 대체 */
    '.fd-menu-cv{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;transition:opacity .2s ease;}' +
    '.fd-menu-cv--x{opacity:0;}' +
    'body.mo-menu-open .fd-menu-cv--bars{opacity:0;}' +
    'body.mo-menu-open .fd-menu-cv--x{opacity:1;}' +
    'body.mo-menu-open .mo-hbtn--menu::before,body.mo-menu-open .mo-hbtn--menu::after{content:none!important;}';
  document.head.appendChild(style);

  /* 단색(또는 반투명) 배경을 canvas 레이어로. z-index:-1 + isolation 으로
     요소 자기 배경 위·콘텐츠 아래에 깔린다. */
  function solid(sel, color, clearBg) {
    document.querySelectorAll(sel).forEach(function (el) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.style.isolation = 'isolate';
      if (clearBg) el.style.background = 'none';
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var g = c.getContext('2d');
      g.fillStyle = color;
      g.fillRect(0, 0, 32, 32);
      c.className = 'fd-cv';
      c.setAttribute('aria-hidden', 'true');
      el.insertBefore(c, el.firstChild);
    });
  }

  /* 밝은 <img> → 같은 자리에 canvas 복제(원본은 투명화, 레이아웃 유지).
     크로스오리진 이미지도 표시용 drawImage 는 동작한다(캔버스 tainted 는 무관). */
  function imgToCanvas(sel) {
    document.querySelectorAll(sel).forEach(function (img) {
      function apply() {
        if (!img.naturalWidth) return;
        var wrap = img.parentElement;
        if (!wrap || wrap.querySelector('.fd-cv-img')) return;
        var c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        try {
          c.getContext('2d').drawImage(img, 0, 0);
        } catch (e) { return; }
        c.className = 'fd-cv-img';
        c.setAttribute('aria-hidden', 'true');
        if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
        wrap.insertBefore(c, img.nextSibling);
        img.style.opacity = '0';
      }
      if (img.complete) apply();
      else img.addEventListener('load', apply, { once: true });
    });
  }

  function run() {
    /* 밝은 배경 — 강제 다크가 회색으로 톤다운시키던 면들 */
    solid('.mo-kv, .panel-kv, .pc-hero', '#f9f6ef');
    solid('.cta-inquire', '#f2e7d5');
    solid('.cta-apply, .cta-apply-item, .mo-contact-submit', '#d6bea4');
    solid('.mo-mcn-more, .mo-press-more', '#ffffff');
    solid('.mo-about-pane--location', '#f5f4f2');
    solid('.mo-cosmetics', '#d0d0d0');
    solid('.mo-cos-btn--soon', 'rgba(255,255,255,0.4)', true);

    /* 밝은 사진 — 톤다운 방지 */
    imgToCanvas('.mo-cosmetics-bg img, .mo-location-map-wrap img');

    /* 햄버거 버튼 — 내부 svg rect(#212121)가 반전되므로 canvas 아이콘으로 대체 */
    var btn = document.querySelector('.mo-hbtn--menu');
    if (btn) {
      var svg = btn.querySelector('svg');
      if (svg) svg.style.display = 'none';
      var mk = function (cls, draw) {
        var c = document.createElement('canvas');
        c.width = 120; c.height = 120;   /* 2x 해상도 */
        var g = c.getContext('2d');
        g.scale(2, 2);
        draw(g);
        c.className = 'fd-menu-cv ' + cls;
        c.setAttribute('aria-hidden', 'true');
        btn.appendChild(c);
      };
      mk('fd-menu-cv--bars', function (g) {
        g.fillStyle = '#212121';
        g.fillRect(0, 0, 60, 60);
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(14, 21); g.lineTo(46, 21);
        g.moveTo(14, 37); g.lineTo(46, 37);
        g.stroke();
      });
      mk('fd-menu-cv--x', function (g) {
        g.fillStyle = '#212121';
        g.fillRect(0, 0, 60, 60);
        /* 22px 바 2개를 ±45° — pseudo X 와 동일 치수 */
        var r = 11 * Math.SQRT1_2;
        g.translate(30, 30);
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-r, -r); g.lineTo(r, r);
        g.moveTo(r, -r); g.lineTo(-r, r);
        g.stroke();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
