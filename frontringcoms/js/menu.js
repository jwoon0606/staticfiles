/* ============================================================
   menu.js — 공통 GNB 펼침 메뉴 (Figma menu_open 452:435)
   서브 페이지(mcn / entertainment / career / press_center)의
   - 데스크탑: .btn-hamburger hover/클릭 시 펼쳐지는 흰색 패널(site-menu)
   - 모바일(≤768px): .mo-hbtn--menu 클릭 시 전체화면 다크 메뉴(mo-menu)
   메뉴 항목은 아래 데이터(SITE_MENU / MO_MENU)로 렌더된다.

   대메뉴별 하위 메뉴:
   - 데스크탑: 대메뉴 hover/포커스 시 그 아래 fade/slide 로 펼쳐짐(한 번에 하나).
   - 모바일: hover 가 없으므로 대메뉴 탭 시 펼침/접힘(아코디언, 한 번에 하나).
   대시(–) 마커는 사용하지 않는다.
   ============================================================ */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── 메뉴 데이터 (항목 추가·수정은 여기서만) ──────────────────
   entry: { label, href, disabled?, sub: [{ label, href }] }
   - 하위 항목 텍스트가 미정인 곳은 placeholder 이니 그대로 교체.
   - Cosmetics 는 하위 없이 메인 Cosmetics 화면으로 이동(데스크탑 #cosmetics / 모바일 #moCosmetics).
   - 모바일은 About 만 앵커가 달라(#moAbout/#moHistory) MO_MENU 로 분리.
   ------------------------------------------------------------ */
const SITE_MENU = [
  {
    label: 'About',
    href: '/main#about',
    sub: [
      { label: 'About Company', href: '/main#about' },
      { label: 'History', href: '/main#history' },
      { label: 'Location', href: '/main#location' },
    ],
  },
  {
    label: 'Entertainment',
    href: '/main#entertainment',   // 대메뉴: 메인페이지 Entertainment 패널로 이동
    sub: [
      { label: 'Artist', href: '/entertainment#artist' },
      { label: 'Audition', href: '/entertainment#audition' },
    ],
  },
  {
    label: 'MCN',
    href: '/main#mcn',             // 대메뉴: 메인페이지 MCN 패널로 이동
    sub: [
      { label: 'Creator', href: '/mcn#creator' },
      { label: 'Apply', href: '/mcn#apply' },
    ],
  },
  {
    label: 'Cosmetics',
    href: '/main#cosmetics',    // 메인페이지 Cosmetics 패널로 이동
  },
  {
    label: 'Career',
    href: '/career',            // 메인페이지에 Career 패널이 없어 그대로 둠
    sub: [
      { label: 'Process', href: '/career#process' },
      { label: 'FAQ', href: '/career#faq' },
    ],
  },
];

const MO_MENU = [
  {
    label: 'About',
    href: '/main#moAbout',
    sub: [
      { label: 'About Company', href: '/main#moAbout' },
      { label: 'History', href: '/main#moHistory' },
      { label: 'Location', href: '/main#moLocation' },
    ],
  },
  {
    label: 'Entertainment',
    href: '/entertainment',
    sub: [
      { label: 'Artist', href: '/entertainment#artist' },
      { label: 'Audition', href: '/entertainment#audition' },
    ],
  },
  {
    label: 'MCN',
    href: '/mcn',
    sub: [
      { label: 'Creator', href: '/mcn#creator' },
      { label: 'Apply', href: '/mcn#apply' },
    ],
  },
  { label: 'Cosmetics', href: '/main#moCosmetics' },
  {
    label: 'Career',
    href: '/career',
    sub: [
      { label: 'Process', href: '/career#process' },
      { label: 'FAQ', href: '/career#faq' },
    ],
  },
];

/* ── 데이터 → DOM 렌더 헬퍼 ────────────────────────────────── */
function buildGroups(menu, prefix) {
  // prefix: 'site-menu' | 'mo-menu'
  return menu.map((item) => {
    const hasSub = !item.disabled && Array.isArray(item.sub) && item.sub.length > 0;
    let main;
    if (item.disabled) {
      main =
        `<span class="${prefix}-item ${prefix}-item--disabled">` +
          `<span class="${prefix}-text">${esc(item.label)}</span></span>`;
    } else {
      const cls = `${prefix}-item${hasSub ? ` ${prefix}-item--has-sub` : ''}`;
      const expanded = hasSub ? ' aria-expanded="false"' : '';
      // 모바일 대메뉴(하위 있음)는 "첫 탭=펼침"이 항상 보장되도록 실제 href 를 두지 않는다.
      // 일부 모바일(특히 iOS)에서 click 의 preventDefault 가 새어 네이티브 <a> 이동이
      // 먼저 일어나는 것을 구조적으로 차단. 이동은 두 번째 탭에서 JS(data-nav-href)로 처리한다.
      // 데스크탑(site-menu)·하위 없는 항목은 종전대로 href 로 이동.
      const mobileHasSub = prefix === 'mo-menu' && hasSub;
      const linkAttr = mobileHasSub
        ? ` role="button" data-nav-href="${esc(item.href)}"`
        : ` href="${esc(item.href)}"`;
      main =
        `<a class="${cls}"${linkAttr}${expanded}>` +
          `<span class="${prefix}-text">${esc(item.label)}</span></a>`;
    }
    const sub = hasSub
      ? `<div class="${prefix}-sub">` +
          item.sub.map((s) =>
            `<a class="${prefix}-subitem" href="${esc(s.href)}">${esc(s.label)}</a>`
          ).join('') +
        `</div>`
      : '';
    return `<div class="${prefix}-group">${main}${sub}</div>`;
  }).join('');
}

/* ── PC 사이드 CTA(문의하기 / 지원하기) 렌더 ──────────────────
   메인(main.html)에만 있던 우측 세로 버튼을 모든 서브페이지에도 노출.
   서브페이지는 공통 GNB(site-menu)가 있는 페이지로 판별하며, 메인은
   menu.js 를 로드하지 않으므로 영향이 없다. 스타일은 menu.css 참고.
   - 문의하기 → main.html#contact (Business Contact 패널 딥링크)
   - 지원하기 → CSS hover 로 ARTIST/CREATOR/RINGCREW 플라이아웃 (JS 불필요) */
(function renderCtaButtons() {
  if (!document.querySelector('[data-menu-overlay]')) return;  // 서브페이지에만
  if (document.querySelector('.cta-btns')) return;             // 중복 방지
  const wrap = document.createElement('div');
  wrap.className = 'cta-btns';
  wrap.innerHTML =
    '<a class="cta-btn cta-inquire" href="/main#contact">' +
      '<div class="cta-text-wrap"><p class="cta-text">문의하기</p></div>' +
      '<div class="cta-arrow"><img src="https://staticfiles-seven.vercel.app/frontringcoms/images/main/about/ic-arrow.svg" alt=""></div>' +
    '</a>' +
    '<div class="cta-btn cta-apply" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false">' +
      '<div class="cta-text-wrap"><p class="cta-text">지원하기</p></div>' +
      '<div class="cta-arrow"><img src="https://staticfiles-seven.vercel.app/frontringcoms/images/main/about/ic-arrow.svg" alt=""></div>' +
      '<div class="cta-apply-flyout">' +
        '<a class="cta-apply-item" href="/entertainment#audition">ARTIST</a>' +
        '<a class="cta-apply-item" href="/mcn#apply">CREATOR</a>' +
        '<a class="cta-apply-item" href="/joinus">RINGCREW</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);

  // 같은 페이지의 동일 해시로 이동할 때는 브라우저가 hashchange 를 쏘지 않아
  // (URL 변화 없음) 스크롤이 다시 동작하지 않는다 → 수동으로 hashchange 발생시켜
  // 각 페이지의 해시 핸들러(mcn/entertainment/career)가 다시 스크롤하게 한다.
  wrap.querySelectorAll('.cta-apply-item').forEach((a) => {
    a.addEventListener('click', (e) => {
      const url = new URL(a.href, location.href);
      if (url.pathname === location.pathname && url.hash && url.hash === location.hash) {
        e.preventDefault();
        window.dispatchEvent(new Event('hashchange'));
      }
    });
  });

  // 모바일(터치)은 hover/focus-within 이 불안정 → 탭으로 플라이아웃 토글.
  // 데스크탑은 CSS hover 로 처리하므로 ≤768px 에서만 동작시킨다.
  const applyBtn = wrap.querySelector('.cta-apply');
  if (applyBtn) {
    const mq = window.matchMedia('(max-width: 768px)');
    applyBtn.addEventListener('click', (e) => {
      if (!mq.matches) return;
      if (e.target.closest('.cta-apply-item')) return;   // 메뉴 링크 탭은 통과
      const open = applyBtn.classList.toggle('is-open');
      applyBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!mq.matches || !applyBtn.classList.contains('is-open')) return;
      if (!applyBtn.contains(e.target)) {
        applyBtn.classList.remove('is-open');
        applyBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();

/* ── 데스크탑 패널 렌더 ────────────────────────────────────── */
(function renderSiteMenu() {
  const overlays = [...document.querySelectorAll('[data-menu-overlay]')];
  if (!overlays.length) return;
  const html = buildGroups(SITE_MENU, 'site-menu');
  overlays.forEach((overlay) => {
    let list = overlay.querySelector('.site-menu-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'site-menu-list';
      overlay.appendChild(list);
    }
    list.innerHTML = html;
  });
})();

/* ── 모바일 메뉴 렌더 ──────────────────────────────────────── */
(function renderMoMenu() {
  const overlay = document.getElementById('moMenu');
  if (!overlay) return;
  let list = overlay.querySelector('.mo-menu-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'mo-menu-list';
    overlay.appendChild(list);
  }
  list.innerHTML = buildGroups(MO_MENU, 'mo-menu');
})();

/* ── 데스크탑 패널 열기/닫기 (hover 그룹 + 클릭/ESC) ──────────
   햄버거 버튼은 슬라이드마다 하나씩 있고, 아티스트 슬라이드는 데이터 로드
   후 동적으로 생성된다(entertainment.js). 따라서 로드 시점에 버튼을 직접
   바인딩하면 나중에 생긴 버튼은 hover가 안 먹는다 → 위임(delegation)으로
   처리해 현재/미래의 모든 .btn-hamburger 에서 동작하게 한다. */
(function () {
  const overlay = document.querySelector('[data-menu-overlay]');
  if (!overlay) return;

  const isOpen = () => document.body.classList.contains('site-menu-open');
  const setExpanded = (v) =>
    document.querySelectorAll('.btn-hamburger')
      .forEach((b) => b.setAttribute('aria-expanded', v));
  function open() {
    document.body.classList.add('site-menu-open');
    overlay.setAttribute('aria-hidden', 'false');
    setExpanded('true');
  }
  function close() {
    document.body.classList.remove('site-menu-open');
    overlay.setAttribute('aria-hidden', 'true');
    setExpanded('false');
  }

  // 버튼(들) + 오버레이는 하나의 hover 그룹. 그룹 내부로 이동하면 닫지 않는다.
  // 버튼↔오버레이 6px 틈은 .site-menu::after 투명 브리지가 메워 relatedTarget 유지.
  const inGroup = (node) =>
    !!node && node.nodeType === 1 &&
    (overlay.contains(node) || !!(node.closest && node.closest('.btn-hamburger')));

  // 위임: 어떤 햄버거 버튼 위로 들어와도 열림.
  // (열린 뒤 hover 를 벗어나도 닫지 않는다 — 닫기는 X 버튼(열린 상태의 햄버거)
  //  클릭 / 바깥 클릭 / ESC 로만 한다.)
  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('.btn-hamburger')) open();
  });

  // 위임: 햄버거 클릭 토글(터치 등 hover 불가 환경) / 바깥 클릭 닫기
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.btn-hamburger');
    if (btn) { e.stopPropagation(); isOpen() ? close() : open(); return; }
    if (isOpen() && !inGroup(e.target)) close();
  });

  // 하위 항목 클릭 → 메뉴 닫기(오버레이는 1개·정적이라 직접 바인딩).
  // 같은 페이지 해시 이동(예: entertainment.html 안에서 #audition)은
  // 새로고침이 없어 hover-leave 만으로는 안 닫히므로 명시적으로 닫는다.
  overlay.querySelectorAll('.site-menu-subitem').forEach((a) =>
    a.addEventListener('click', close));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });
})();

/* ============================================================
   모바일 전체화면 메뉴 (Figma MO_Main_GNB 452:3921)
   .mo-hbtn--menu 클릭 시 전체화면 다크 메뉴(#moMenu) 토글.
   대메뉴(하위 있음) 탭 → 아코디언 펼침/접힘(한 번에 하나).
   하위 항목 탭 → 페이지/앵커 이동 후 메뉴 닫힘. ESC 로 닫힘.
   ============================================================ */
(function () {
  const overlay = document.getElementById('moMenu');
  const btns    = [...document.querySelectorAll('.mo-hbtn--menu')];
  if (!overlay || !btns.length) return;

  const isOpen = () => document.body.classList.contains('mo-menu-open');
  function open() {
    document.body.classList.add('mo-menu-open');
    overlay.setAttribute('aria-hidden', 'false');
    btns.forEach((b) => b.setAttribute('aria-expanded', 'true'));
  }
  function close() {
    document.body.classList.remove('mo-menu-open');
    overlay.setAttribute('aria-hidden', 'true');
    btns.forEach((b) => b.setAttribute('aria-expanded', 'false'));
    // 다음 오픈 시 접힌 상태로 시작
    overlay.querySelectorAll('.mo-menu-group.is-open').forEach((g) => {
      g.classList.remove('is-open');
      const a = g.querySelector('.mo-menu-item--has-sub');
      if (a) a.setAttribute('aria-expanded', 'false');
    });
  }

  btns.forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen() ? close() : open();
  }));

  // 대메뉴(하위 있음) 탭 동작:
  //  - 첫 탭: 이동을 막고 하위 메뉴를 펼친다(아코디언, 한 번에 하나).
  //  - 이미 펼쳐진 대메뉴를 한 번 더 탭: 기본 동작을 허용해 해당 페이지로 이동
  //    (메인의 섹션이 아니라 각 페이지 href — MO_MENU 참고).
  overlay.querySelectorAll('.mo-menu-item--has-sub').forEach((item) => {
    item.addEventListener('click', (e) => {
      const group = item.closest('.mo-menu-group');
      // 이미 펼쳐진 상태면 두 번째 탭 → 해당 페이지/섹션으로 이동(href 가 없으므로 JS 로 이동).
      if (group.classList.contains('is-open')) {
        e.preventDefault();
        close();                 // 같은-페이지 앵커(main 의 #moAbout 등)면 안 닫히므로 명시적으로 닫음
        const target = item.dataset.navHref || item.getAttribute('href') || '';
        const url = new URL(target, location.href);
        if (url.pathname === location.pathname && url.hash) {
          // 같은 페이지: 동일 해시면 hashchange 가 안 떠서 스크롤이 안 되므로 수동 발생,
          // 다른 해시면 해시만 바꿔 각 페이지 핸들러가 스크롤하게 한다.
          if (url.hash === location.hash) window.dispatchEvent(new Event('hashchange'));
          else location.hash = url.hash;
        } else {
          location.href = url.href;   // 다른 페이지로 이동
        }
        return;
      }
      // 첫 탭 → 이동 막고 펼침
      e.preventDefault();
      overlay.querySelectorAll('.mo-menu-group.is-open').forEach((g) => {
        g.classList.remove('is-open');
        const a = g.querySelector('.mo-menu-item--has-sub');
        if (a) a.setAttribute('aria-expanded', 'false');
      });
      group.classList.add('is-open');
      item.setAttribute('aria-expanded', 'true');
    });
  });

  // 하위 항목 탭 → 이동(브라우저 처리) 후 메뉴 닫기
  overlay.querySelectorAll('.mo-menu-subitem').forEach((a) =>
    a.addEventListener('click', close));

  // 하위 없는 대메뉴(예: Cosmetics) 탭 → 이동(브라우저 처리) 후 메뉴 닫기.
  // 메인의 같은-페이지 앵커(#moCosmetics)는 페이지 전환이 없어 자동으로 안 닫히므로 명시 처리.
  overlay.querySelectorAll('a.mo-menu-item:not(.mo-menu-item--has-sub)').forEach((a) =>
    a.addEventListener('click', close));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });
})();

/* ============================================================
   GNB 로고 바(.gnb-logo-float) 투명 → 다크 전환
   - 히어로(첫 화면) 위에서는 투명, 스크롤해 히어로를 벗어나면 #212121.
   - 데스크탑은 .mcn-container/.career-container 가 스크롤 주체, 모바일은 window.
     (모바일은 바 자체가 숨김이라 영향 없음)
   ============================================================ */
(function () {
  const bar = document.querySelector('.gnb-logo-float');
  if (!bar) return;
  const scroller = document.querySelector('.mcn-container, .career-container');

  function currentTop() {
    if (scroller) return scroller.scrollTop;
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }
  /* 히어로(첫 화면) 절반쯤 내려가면 다크로 전환 — 그 전까지는 투명 유지 */
  function threshold() {
    const h = scroller ? scroller.clientHeight : window.innerHeight;
    return h * 0.5;
  }
  function update() {
    bar.classList.toggle('is-scrolled', currentTop() > threshold());
  }

  if (scroller) scroller.addEventListener('scroll', update, { passive: true });
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

/* ============================================================
   스크롤 최상단 이동 버튼 (.scroll-top-btn)
   - mcn / career 는 .mcn-container / .career-container 가 내부 스크롤한다.
     (모바일 ≤768px 은 window 스크롤 → 둘 다 처리)
   - 일정 거리 이상 내려가면 버튼을 보이고, 클릭하면 맨 위로 올린다.
   ============================================================ */
(function () {
  const btn = document.querySelector('.scroll-top-btn');
  if (!btn) return;

  /* 데스크탑은 스케일·스크롤되는 컨테이너, 모바일은 window 가 스크롤 주체 */
  const scroller = document.querySelector('.mcn-container, .career-container');
  const SHOW_AT = 300; /* 이만큼 내려가면 노출 */

  function currentTop() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile && scroller) return scroller.scrollTop;
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function update() {
    btn.classList.toggle('is-visible', currentTop() > SHOW_AT);
  }

  function toTop() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile && scroller) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (scroller) scroller.addEventListener('scroll', update, { passive: true });
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  btn.addEventListener('click', toTop);
  update();
})();

/* ============================================================
   이전 페이지로 돌아가기 버튼 (.go-back-btn)
   - 같은 사이트의 "다른 페이지(문서)"에서 넘어온 경우에만 좌하단에 노출.
     (예: 메인 → MORE/지원하기/메뉴 → 서브페이지,
      MCN 서브 → "크리에이터 협업 문의하기" → 메인)
   - 같은 페이지 내 슬라이드(메인 패널 전환, #contact 등 해시 이동)는 제외 —
     pagehide 가 안 떠 직전 페이지로 기록되지 않으므로 자연히 버튼이 안 뜬다.
   - 클릭하면 직전 페이지로 돌아가고, 페이지가 이동하므로 버튼은 자연히 사라진다.
   - 외부 유입·직접 접속(북마크 등)에는 돌아갈 직전 페이지가 없으므로 표시하지 않는다.
   - 표시 여부는 최초 + bfcache 복원(pageshow)마다 재평가 → 한 번 숨겨도 다시 노출.
   ============================================================ */
(function () {
  /* iframe 안(예: 메인의 Career 패널이 /career 를 iframe 으로 임베드)에서는
     만들지 않는다. 만들면 부모 페이지 위에 겹쳐 버튼이 이중으로 보인다. */
  if (window.self !== window.top) return;

  /* ── 직전 "페이지"(문서) URL 기록 ──────────────────────────────
     referrer 한 번만 보던 기존 방식은 ① 로드 시 1회만 평가하고 ② 클릭 시
     display:none 으로 숨겨, bfcache(앞/뒤로가기 캐시)로 페이지가 복원되면
     버튼이 다시 안 나오는 문제가 있었다. 그래서 직접 기록 + 매 표시마다 재평가.

     pagehide 는 "다른 문서로 실제 이동(다른 페이지/리로드)" 할 때만 발생한다.
     같은 페이지 내 해시 슬라이드(메인 패널 goTo, #contact 등)는 문서 언로드가
     없어 pagehide 가 안 떠 기록되지 않는다 → "같은 페이지 슬라이드"는 자연 제외. */
  const PREV_KEY = 'rc:prevPage';
  window.addEventListener('pagehide', function () {
    try { sessionStorage.setItem(PREV_KEY, window.location.href); } catch (e) {}
  });

  /* 돌아갈 직전 페이지(같은 origin & 다른 pathname)를 구한다.
     1순위: 우리가 직접 기록한 값, 2순위: referrer(첫 이동 등 기록이 없을 때). */
  function getPrevPage() {
    let candidates = [];
    try { candidates.push(sessionStorage.getItem(PREV_KEY)); } catch (e) {}
    candidates.push(document.referrer);
    for (const raw of candidates) {
      if (!raw) continue;
      let u;
      try { u = new URL(raw, window.location.href); } catch (e) { continue; }
      if (u.origin !== window.location.origin) continue;
      /* 같은 pathname = 같은 페이지 내 이동 → 돌아갈 "이전 페이지" 아님 */
      if (u.pathname === window.location.pathname) continue;
      return u;
    }
    return null;
  }

  /* 버튼 크기·위치 CSS 주입 — menu.css 를 로드하지 않는 페이지(메인)에서도
     동일하게 보이도록 menu.js 가 직접 넣는다. (메인은 menu.css 미로드라
     예전엔 버튼이 좌상단에 쪼그라들어 모양이 깨졌다.)
     모바일 크기는 버튼 자체에 전용 단위를 고정해 모든 페이지에서 동일하게 계산한다.
     360px 기준 48px, 작은 화면에서는 줄고 큰 화면에서도 48px을 넘지 않게 제한해
     페이지별 --u 공식 차이로 버튼 크기가 들쭉날쭉하던 문제를 없앤다. */
  if (!document.getElementById('rc-go-back-style')) {
    const style = document.createElement('style');
    style.id = 'rc-go-back-style';
    style.textContent =
      ".go-back-btn{left:24px;bottom:24px;width:48px;height:48px;" +
      "font:400 22px/1 'Pretendard',system-ui,sans-serif;}" +
      ".go-back-arrow{display:block;}" +
      "@media (max-width:768px){.go-back-btn{" +
      "--rc-floating-u:min(1px, 100vw / 360, 100dvh / 780);" +
      "left:calc(16 * var(--rc-floating-u));bottom:calc(16 * var(--rc-floating-u));" +
      "width:calc(48 * var(--rc-floating-u));height:calc(48 * var(--rc-floating-u));" +
      "font-size:calc(22 * var(--rc-floating-u));}}";
    document.head.appendChild(style);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'go-back-btn';
  btn.setAttribute('aria-label', '이전 페이지로 돌아가기');
  btn.innerHTML = '<span class="go-back-arrow" aria-hidden="true">&#8592;</span>';

  /* 크기·위치·폰트는 menu.css(.go-back-btn)에서 — 모바일은 맨 위로 버튼과
     동일하게 --u 비례로 스케일해 두 버튼 크기를 일치시킨다. 여기선 색/테두리 등 외형만. */
  Object.assign(btn.style, {
    position: 'fixed',
    zIndex: '2000',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    border: '1px solid rgba(0,0,0,.15)',
    borderRadius: '50%',
    background: 'rgba(255,255,255,.92)',
    color: '#1a1a1a',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,.18)',
    backdropFilter: 'blur(4px)',
  });

  /* 현재 서브페이지 → 메인의 해당 사업부 패널(해시) 매핑.
     메인은 단일 페이지 패널 시스템이라 해시 없이 /main 으로만 돌아가면 맨 위(KV)로
     초기화된다. 메인에서 넘어온 경우엔 눌렀던 사업부 패널로 복귀시킨다. */
  const SUB_TO_SECTION = {
    '/entertainment': 'entertainment',
    '/mcn':           'mcn',
    '/career':        'career',
    '/press_center':  'press',
  };

  /* 표시 여부 재평가 — 최초 + bfcache 복원(pageshow)마다 호출해
     "한 번 숨기면 다시 안 나오는" 문제를 없앤다. */
  function refresh() {
    btn.style.display = getPrevPage() ? 'inline-flex' : 'none';
  }

  btn.addEventListener('click', function () {
    btn.style.display = 'none'; /* 클릭 즉시 숨김 */

    /* 모바일: 직전 화면을 그대로(스크롤 위치 포함) 복원하는 게 자연스럽다.
       모바일 메인은 세로 스냅 구조라 #mcn 같은 패널 해시가 없어, prev.href 로
       이동하면 그냥 /main 맨 위로 떨어진다. history.back() 이 bfcache 로 직전
       화면 상태를 그대로 되살리므로 모바일은 항상 이쪽을 쓴다. (PC 미영향) */
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      window.history.back();
      return;
    }

    /* ── 이하 PC 전용 (데스크탑 패널 시스템) ── */
    const prev = getPrevPage();
    const prevIsMain = prev && (prev.pathname === '/main' || prev.pathname === '/');
    const section = SUB_TO_SECTION[window.location.pathname];

    /* 메인에서 넘어온 사업부 서브페이지 → 그 서브페이지에 대응하는 패널로 복귀.
       메인 URL 에는 이전 메뉴/패널 이동으로 생긴 낡은 해시(예: #mcn)가 남아 있을 수
       있어 prev.hash 를 신뢰하면 안 된다 → 현재 서브페이지 기준 SUB_TO_SECTION 으로 매핑. */
    if (prevIsMain && section) {
      window.location.href = '/main#' + section;
    } else if (prev) {
      /* 기록된 직전 페이지로 직접 이동 — 중간에 해시 슬라이드가 history 에
         쌓여 있어도 정확히 "이전 페이지"로 돌아간다. */
      window.location.href = prev.href;
    } else {
      window.history.back();
    }
  });

  document.body.appendChild(btn);
  refresh();
  window.addEventListener('pageshow', refresh);
})();
