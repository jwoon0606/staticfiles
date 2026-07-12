/* ============================================================
   Panel 0 인터랙티브 히어로 (ringcoms_hero_v3 이식)
   - 데스크탑 전용(.pc-stage). 모바일은 기존 .mo-kv 사용.
   - panel 0 에 있을 때만 활성: 커스텀 커서 / Ambient / Ripple / 3D 틸트 / 로고 드로잉.
   - 클릭하면 큰 파동 + 다크 오버레이 전환 후 다음 패널(About)로 이동.
   - main.js 이후 로드되어 전역 goTo() 를 호출한다.
   ============================================================ */
(function () {
  // 모바일(≤768, 폴더블 펼침 제외) 매처. 데스크탑 히어로는 "데스크탑/폴더블 펼침 + panel 0"
  // 일 때만 활성이다. 예전엔 로드 시 모바일이면 즉시 return 했으나, 폴더폰을 접은 채
  // (모바일) 로드한 뒤 펴서(PC) panel 0(로고 클릭 등)으로 오면 히어로가 한 번도
  // 초기화되지 않아 베이지 배경만 덩그러니 남았다. 이제 항상 초기화하고 active 를
  // isDesktop() && panel 0 으로 게이트하며, 접기/펴기(resize) 때 재평가한다.
  // (모바일에선 active=false 로 유휴 — 화면은 아래 mo-kv 히어로가 담당한다.)
  const mmMobile  = window.matchMedia('(max-width: 768px) and (not ((min-width: 600px) and (orientation: portrait)))');
  const isDesktop = () => !mmMobile.matches;

  const pcStage   = document.querySelector('.pc-stage');
  const fixedUI   = document.querySelector('.fixed-ui');
  const hero      = document.getElementById('pcHero');
  const ambient   = document.getElementById('heroAmbient');
  const logoWrap  = document.getElementById('heroLogoWrap');
  const logoVisual= document.getElementById('heroLogoVisual');
  const cursor    = document.getElementById('heroCursor');
  const follower  = document.getElementById('heroFollower');
  const transition= document.getElementById('heroTransition');
  const canvas    = document.getElementById('heroRipple');
  if (!pcStage || !fixedUI || !hero || !canvas) return;

  const ctx = canvas.getContext('2d');
  const BURGUNDY = '74, 16, 40';

  let active = false;
  let ripples = [];
  let hoverInterval = null;
  let transitioning = false;

  // 활성 시 한 번 캡처해 둔 로고 마크업 — 재진입 시 재주입해 드로잉을 재시작
  const logoHTML = logoVisual.innerHTML;

  // ── 캔버스 리사이즈 ──
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ── Ripple ──
  class Ripple {
    constructor(x, y, isClick = false) {
      this.x = x;
      this.y = y;
      this.radius = 0;
      this.maxRadius = isClick ? Math.max(window.innerWidth, window.innerHeight) * 1.5 : 120;
      this.opacity = 0.4;
      this.speed = isClick ? 18 : 3.5;
      this.isClick = isClick;
      this.lineWidth = isClick ? 8 : 2;
    }
    update() {
      this.radius += this.speed;
      if (!this.isClick) this.opacity = 1 - (this.radius / this.maxRadius);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${BURGUNDY}, ${this.opacity})`;
      ctx.lineWidth = this.lineWidth;
      ctx.stroke();
      ctx.closePath();
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ripples.forEach((ripple, index) => {
      ripple.update();
      ripple.draw();
      if (ripple.radius >= ripple.maxRadius || ripple.opacity <= 0) ripples.splice(index, 1);
    });
    requestAnimationFrame(animate);
  }
  animate();

  // ── 마우스 무브: 커서 / Ambient / 3D 틸트 ──
  window.addEventListener('mousemove', (e) => {
    if (!active) return;
    const x = e.clientX, y = e.clientY;
    cursor.style.left = `${x}px`;   cursor.style.top = `${y}px`;
    follower.style.left = `${x}px`; follower.style.top = `${y}px`;
    ambient.style.background =
      `radial-gradient(circle 350px at ${x}px ${y}px, rgba(${BURGUNDY}, 0.05), transparent 100%)`;

    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const rotateX = -((y - cy) / cy) * 12;
    const rotateY =  ((x - cx) / cx) * 12;
    logoWrap.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  document.addEventListener('mouseleave', () => {
    logoWrap.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });

  // ── 로고 호버 시 은은한 Ripple 자동 생성 ──
  logoWrap.addEventListener('mouseenter', () => {
    if (!active) return;
    hoverInterval = setInterval(() => {
      const rect = logoWrap.getBoundingClientRect();
      ripples.push(new Ripple(rect.left + rect.width / 2, rect.top + rect.height / 2 - 20, false));
    }, 600);
  });
  logoWrap.addEventListener('mouseleave', () => clearInterval(hoverInterval));

  // ── 클릭 → 전환 → 다음 패널 ──
  function trigger(x, y) {
    if (transitioning) return;
    transitioning = true;
    ripples.push(new Ripple(x, y, true));
    follower.style.transform = 'translate(-50%, -50%) scale(0.6)';
    setTimeout(() => { follower.style.transform = 'translate(-50%, -50%) scale(1)'; }, 150);
    setTimeout(() => transition.classList.add('active'), 180);
    setTimeout(() => { if (typeof goTo === 'function') goTo(1, 0); }, 650);
    setTimeout(() => { transition.classList.remove('active'); transitioning = false; }, 1500);
  }
  window.addEventListener('click', (e) => {
    if (!active) return;
    if (e.target.closest('.gnb, .menu-overlay, .menu-backdrop')) return; // 메뉴는 예외
    trigger(e.clientX, e.clientY);
  });

  // ── panel 0 진입/이탈에 맞춰 활성 토글 ──
  function replayLogo() { logoVisual.innerHTML = logoHTML; }

  function setActive(on) {
    if (on === active) return;
    active = on;
    pcStage.classList.toggle('hero-on', on);
    if (on) {
      replayLogo();
    } else {
      clearInterval(hoverInterval);
      logoWrap.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
  }

  // fixed-ui[data-panel] 을 관찰해 (데스크탑 && panel 0) 일 때만 히어로 활성
  const isPanelZero = () => (fixedUI.dataset.panel || '0') === '0';
  const sync = () => setActive(isPanelZero() && isDesktop());
  sync();
  new MutationObserver(sync)
    .observe(fixedUI, { attributes: true, attributeFilter: ['data-panel'] });
  // 접기/펴기(모바일 ↔ PC)로 모드가 바뀌면 활성 여부를 다시 판정한다.
  window.addEventListener('resize', sync);
})();

/* ============================================================
   모바일 히어로 — 세로 스크롤 페이지의 첫 화면(.mo-kv)에 동일 연출 이식.
   데스크탑 로고 SVG(#heroLogoVisual)를 복제해 사용(마크업 중복 방지).
   탭(진짜 탭) → 큰 파동 + 다음 섹션(About)으로 부드럽게 이동.
   ============================================================ */
(function () {
  // 폴더블 펼침도 PC 버전이므로 모바일 히어로(mo-kv) 스킵(제외).
  if (!window.matchMedia('(max-width: 768px) and (not ((min-width: 600px) and (orientation: portrait)))').matches) return; // 데스크탑은 .pc-hero 사용

  const moKv       = document.getElementById('moKv');
  const ambient    = document.getElementById('moHeroAmbient');
  const logoVisual = document.getElementById('moHeroLogoVisual');
  const canvas     = document.getElementById('moHeroRipple');
  const srcVisual  = document.getElementById('heroLogoVisual'); // 데스크탑 SVG 원본
  if (!moKv || !logoVisual || !canvas) return;

  // 데스크탑 로고(선드로잉 SVG + PNG) 복제 → 모바일 컨테이너에 주입
  if (srcVisual) logoVisual.innerHTML = srcVisual.innerHTML;

  const ctx = canvas.getContext('2d');
  const BURGUNDY = '74, 16, 40';
  let ripples = [];

  function resizeCanvas() {
    const r = moKv.getBoundingClientRect();
    canvas.width = Math.round(r.width);
    canvas.height = Math.round(r.height);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Ripple {
    constructor(x, y, isClick = false) {
      this.x = x;
      this.y = y;
      this.radius = 0;
      this.maxRadius = isClick ? Math.max(canvas.width, canvas.height) * 1.6 : 90;
      this.opacity = 0.4;
      this.speed = isClick ? 16 : 3;
      this.isClick = isClick;
      this.lineWidth = isClick ? 6 : 2;
    }
    update() {
      this.radius += this.speed;
      if (!this.isClick) this.opacity = 1 - (this.radius / this.maxRadius);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${BURGUNDY}, ${this.opacity})`;
      ctx.lineWidth = this.lineWidth;
      ctx.stroke();
      ctx.closePath();
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ripples.forEach((rp, i) => {
      rp.update();
      rp.draw();
      if (rp.radius >= rp.maxRadius || rp.opacity <= 0) ripples.splice(i, 1);
    });
    requestAnimationFrame(animate);
  }
  animate();

  function localXY(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return [clientX - r.left, clientY - r.top];
  }

  // 터치 이동: Ambient 라이트 추종
  const u = () => window.innerWidth / 360;
  moKv.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    const [x, y] = localXY(t.clientX, t.clientY);
    ambient.style.background =
      `radial-gradient(circle ${200 * u()}px at ${x}px ${y}px, rgba(${BURGUNDY}, 0.06), transparent 100%)`;
  }, { passive: true });

  // 탭(스크롤이 아닌 진짜 탭에서만 click 이 발생) → 큰 파동 + 바로 아래 브랜드 필름 섹션
  moKv.addEventListener('click', (e) => {
    if (e.target.closest('.mo-header, .mo-menu, .mo-side-cta')) return;
    const [x, y] = localXY(e.clientX, e.clientY);
    ripples.push(new Ripple(x, y, true));
    const next = document.querySelector('.mo-vision');
    if (next) {
      const headerH = (document.querySelector('.mo-header') || {}).offsetHeight || 0;
      const top = next.getBoundingClientRect().top + window.pageYOffset - headerH;
      setTimeout(() => window.scrollTo({ top, behavior: 'smooth' }), 160);
    }
  });
})();
