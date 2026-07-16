/* mcn.js — PC 스크롤 엔진 (동적 측정 방식)
   화면 순서: hero → vision → creator → AD → production → studio → apply
   - 모든 섹션이 스냅 페이지(메인 페이지와 동일한 "휠 한 번 = 한 칸" 감각).
   - creator: 뷰포트(1080px)보다 키가 커서 예전엔 자유 스크롤이었으나,
     자유 스크롤 ↔ 스냅 전환 경계에서 관성이 미끄러져 감각이 무너지는 문제로
     "뷰포트 단위 스텝 스냅"으로 변경. 섹션 높이를 균등 스텝으로 나눠 끊어
     내려가므로(스텝끼리 겹침) 잘리거나 건너뛰는 콘텐츠 없이 딱딱 끊긴다.
   슬라이드 좌표는 하드코딩하지 않고 각 슬라이드의 누적 높이(offsetHeight)로
   런타임 측정한다. DOM 순서만 바꾸면 좌표가 자동으로 따라온다.               */

const container     = document.getElementById('mcnContainer');
const prodContainer = document.getElementById('prodContainer');

/* 슬라이드 요소 (DOM 순서 = 화면 순서) */
const EL = {
  hero:    document.querySelector('.mcn-1'),
  vision:  document.querySelector('.mcn-2'),
  ad:      document.querySelector('.mcn-3'),
  prod:    document.querySelector('.mcn-4'),
  studio:  document.querySelector('.mcn-5'),
  creator: document.querySelector('.mcn-6'),
  apply:   document.querySelector('.mcn-7'),
  footer:  document.querySelector('.mcn-footer'),
};

/* 스냅 페이지 순서. creator는 섹션 내부를 스텝 스냅으로 나눠 이동(creatorSteps).
   footer는 .mcn-slide가 아니고(짧은 바) apply 뒤에 붙으므로, 맨 아래로 스냅해 노출. */
const PAGES = ['hero', 'vision', 'creator', 'ad', 'prod', 'studio', 'apply', 'footer'];
const idx   = (name) => PAGES.indexOf(name);

/* 컨테이너 내부 슬라이드(스케일 적용 전 좌표 기준) */
const SLIDES = Array.from(container.children).filter(
  (el) => el.classList && el.classList.contains('mcn-slide')
);

/* 슬라이드의 컨테이너 내부 세로 위치(=스크롤 목표값, 미축소 px).
   .mcn-slide 사이에 margin이 없으므로 앞 슬라이드 높이 누적과 동일. */
function topOf(el) {
  let t = 0;
  for (const s of SLIDES) {
    if (s === el) return t;
    t += s.offsetHeight;
  }
  return t;
}
const vh      = () => container.clientHeight;          /* 현재 보이는 뷰포트 높이(미축소 px). PC 세로가 16:9보다 짧으면 1080 미만 */
/* 페이지 스크롤 목표값. footer는 짧은 바라 맨 아래(최대 스크롤)로 보내 뷰포트 하단에 붙인다. */
const pageTop = (i) => (PAGES[i] === 'footer'
  ? container.scrollHeight - container.clientHeight
  : topOf(EL[PAGES[i]]));

/* creator 하단 정렬점 계산에 쓰는 다음 섹션 참조.
   (PAGES 상의 뒤 페이지를 동적으로 참조 → 순서 바꿔도 자동 추종) */
const creatorNext   = () => PAGES[idx('creator') + 1];   /* 현재 순서: ad */
const creatorBottom = () => topOf(EL[creatorNext()]) - vh();   /* creator 하단이 뷰포트 하단에 닿는 지점 */

/* ── creator 스텝 스냅 ──
   creator(기본 2234px, 전체보기 시 더 커짐)를 균등 스텝으로 나눈 스냅 좌표 목록.
   이동 횟수 n = ceil(구간 길이 / 뷰포트) → 스텝 간격이 항상 뷰포트 이하가 되어
   어떤 스텝에서도 이전 스텝과 화면이 겹친다(건너뛰어 못 보는 콘텐츠 없음).
   높이가 바뀌어도(전체보기/필터) 매 휠마다 다시 계산하므로 자동 추종. */
function creatorSteps() {
  const top   = topOf(EL.creator);
  const range = Math.max(0, creatorBottom() - top);
  if (range < 5) return [top];                 /* 뷰포트 안에 다 들어오면 단일 스냅 */
  const n    = Math.ceil(range / vh());
  const step = range / n;
  const steps = [];
  for (let i = 0; i <= n; i++) steps.push(Math.round(top + step * i));
  return steps;
}
/* 현재 scrollTop에서 가장 가까운 creator 스텝 인덱스 */
function creatorStepAt(scrollTop) {
  const steps = creatorSteps();
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i] - scrollTop) < Math.abs(steps[best] - scrollTop)) best = i;
  }
  return best;
}

let currentPage = 0;

const PROD_TOTAL = 1;   /* 3단 카드를 한 화면에 모두 노출 → 가로 캐러셀 폐기, 단일 스냅 페이지 */
let   prodCurrent = 0;

let locked = false;
let timer  = null;
function unlock() { locked = false; }

function snapTo(i) {
  i = Math.max(0, Math.min(PAGES.length - 1, i));
  locked = true;
  currentPage = i;
  container.scrollTo({ top: pageTop(i), behavior: 'smooth' });
  clearTimeout(timer);
  timer = setTimeout(unlock, 700);
}

/* creator 내부 스텝 이동 — 페이지(currentPage)는 creator 그대로, 좌표만 스냅 */
function snapToY(top) {
  locked = true;
  container.scrollTo({ top, behavior: 'smooth' });
  clearTimeout(timer);
  timer = setTimeout(unlock, 700);
}

function prodGoTo(index, dir) {
  if (!prodContainer || index < 0 || index >= PROD_TOTAL) return;
  const slides = prodContainer.querySelectorAll('.prod-slide');
  slides.forEach(s => s.classList.remove('entering', 'entering-rev'));
  prodContainer.style.transform = `translateX(-${index * 1920}px)`;
  const target = slides[index];
  if (target) {
    void target.offsetWidth;
    target.classList.add(dir >= 0 ? 'entering' : 'entering-rev');
  }
  prodCurrent = index;
  locked = true;
  clearTimeout(timer);
  timer = setTimeout(unlock, 700);
}

/* creator 마지막 스텝(하단 정렬)으로 진입 — 아래 섹션에서 위로 올라올 때 */
function enterCreatorBottom() {
  currentPage = idx('creator');
  snapToY(creatorBottom());
}

/* ── Wheel handler ─────────────────────────────────────────── */
container.addEventListener('wheel', (e) => {
  /* 드롭다운 메뉴 / 길어진 신청 폼 내부는 네이티브 스크롤 허용(스냅 가로채기 제외) */
  const t = e.target;
  if (t && t.closest) {
    if (t.closest('.mcn7-pmenu')) return;
    /* 자세히보기 동의서 박스: 자체 내부 스크롤 허용. 끝에 닿으면 스냅 엔진으로 넘긴다. */
    const dbox = t.closest('.mcn7-terms-detail-box');
    if (dbox && dbox.scrollHeight > dbox.clientHeight + 1) {
      const dTop    = dbox.scrollTop <= 0;
      const dBottom = dbox.scrollTop + dbox.clientHeight >= dbox.scrollHeight - 1;
      if (e.deltaY > 0 ? !dBottom : !dTop) return;
    }
    const box = t.closest('.mcn7-container');
    if (box && box.scrollHeight > box.clientHeight + 1) {
      /* 폼 내부에 더 스크롤할 여지가 있을 때만 네이티브 스크롤을 허용하고,
         위/아래 끝에 닿으면 스냅 엔진으로 넘긴다
         (apply에서 위로 못 올라가던 버그 방지). */
      const atTop    = box.scrollTop <= 0;
      const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 1;
      if (e.deltaY > 0 ? !atBottom : !atTop) return;
    }
  }

  const scrollTop = container.scrollTop;
  const dir = e.deltaY > 0 ? 1 : -1;

  /* ── Snap ── (creator 포함 전 구간. creator는 내부 스텝으로 나눠 끊는다) */
  e.preventDefault();
  if (locked) return;
  if (Math.abs(e.deltaY) < 15) return;

  const name = PAGES[currentPage];

  if (name === 'hero') {
    if (dir > 0) snapTo(idx('vision'));

  } else if (name === 'vision') {
    if (dir > 0) snapTo(idx('creator'));   /* ↓ → creator 첫 스텝(상단) */
    else         snapTo(idx('hero'));

  } else if (name === 'creator') {
    /* 섹션 내부 스텝을 한 칸씩 스냅. 끝 스텝에서 한 번 더 굴리면 이웃 섹션으로 */
    const steps = creatorSteps();
    const cur   = creatorStepAt(scrollTop);
    if (dir > 0) {
      if (cur < steps.length - 1) snapToY(steps[cur + 1]);
      else                        snapTo(idx('ad'));       /* ↓ 마지막 스텝 → ad */
    } else {
      if (cur > 0) snapToY(steps[cur - 1]);
      else         snapTo(idx('vision'));                  /* ↑ 첫 스텝 → vision */
    }

  } else if (name === 'ad') {
    if (dir > 0) snapTo(idx('prod'));
    else         enterCreatorBottom();     /* ↑ → creator 마지막 스텝(하단 정렬) */

  } else if (name === 'prod') {
    if (dir > 0) {
      if (prodCurrent < PROD_TOTAL - 1) { prodGoTo(prodCurrent + 1, 1); }
      else                               { snapTo(idx('studio')); }
    } else {
      if (prodCurrent > 0) { prodGoTo(prodCurrent - 1, -1); }
      else                  { snapTo(idx('ad')); }
    }

  } else if (name === 'studio') {
    if (dir > 0) snapTo(idx('apply'));     /* ↓ → apply */
    else         snapTo(idx('prod'));      /* ↑ → prod */

  } else if (name === 'apply') {
    if (dir > 0)      snapTo(idx('footer'));   /* ↓ → footer */
    else              snapTo(idx('studio'));   /* ↑ → studio */

  } else if (name === 'footer') {
    if (dir < 0) snapTo(idx('apply'));         /* ↑ → apply */
  }
}, { passive: false });

/* ── Unlock triggers ───────────────────────────────────────── */
container.addEventListener('scrollend', () => {
  clearTimeout(timer);
  timer = setTimeout(unlock, 80);
});

if (prodContainer) {
  prodContainer.addEventListener('transitionend', () => {
    clearTimeout(timer);
    timer = setTimeout(unlock, 100);
  });
}

/* ── Scroll listener ───────────────────────────────────────── */
container.addEventListener('scroll', () => {
  /* 프로그래밍 스냅 중(locked)에는 동기화하지 않는다.
     hero에서 아래로 스냅할 때 애니메이션 초반 scrollTop이 잠깐 ≤5라
     currentPage가 0(hero)으로 되돌아가 vision에 갇히던 버그 방지. */
  if (locked) return;
  const scrollTop = container.scrollTop;
  if (scrollTop <= 5 && currentPage !== 0) {
    currentPage = 0;
  }
}, { passive: true });


/* ── 해시 딥링크 ───────────────────────────────────────────────
   메인 GNB 서브메뉴에서 mcn.html#creator / #apply 로 진입 시
   해당 섹션으로 이동한다(데스크탑: 스냅, 모바일: 섹션 스크롤). */
function mcnNavFromHash(fromTop) {
  const key = (location.hash || '').replace('#', '');
  if (key !== 'creator' && key !== 'apply') return;

  if (window.matchMedia('(max-width: 768px)').matches) {
    const sel = key === 'creator' ? '.mo-sec-6' : '.mo-sec-7';
    const sec = document.querySelector(sel);
    if (!sec) return;
    if (fromTop) {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else {
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

  const target = idx(key);
  if (fromTop) {
    // 다른 페이지에서 진입: 맨 위(hero)에서 시작해 해당 섹션까지 부드럽게.
    currentPage = 0;
    container.scrollTop = 0;
    requestAnimationFrame(() => snapTo(target));
  } else {
    // 같은 페이지: 현재 위치에서 부드럽게.
    snapTo(target);
  }
}
if (location.hash) {
  window.addEventListener('load', () => requestAnimationFrame(() => mcnNavFromHash(true)));
}
window.addEventListener('hashchange', () => mcnNavFromHash(false));


/* ── CREATOR filters (slide 6) ────────────────────────────────
   구분 탭(전체/스트리머/크리에이터) + 활동 플랫폼 필터로 카드를 실제 show/hide.
   각 카드의 data-category / data-platform(공백 구분 복수) 기준으로 매칭한다.
   백엔드 렌더(renderDesktop) 후에도 다시 적용할 수 있게 전역으로 노출.        */
const MCN6_LIMIT = 6;          /* 한 번에 노출할 최대 카드 수 */
let   mcn6Expanded = false;    /* 전체보기(펼침) 상태 */

function mcn6ActiveValue(selector, attr) {
  const el = document.querySelector(selector + '.is-active');
  return el ? (el.dataset[attr] || 'all') : 'all';
}

/* 슬라이드(.mcn-6)는 고정 높이(2234px)의 절대배치 구간이라,
   카드를 펼치면 콘텐츠가 높이를 넘어 overflow:hidden 으로 잘린다.
   펼침 상태에서는 리스트 실제 높이에 맞춰 슬라이드 높이를 키워
   APPLY 와의 간격이 자동으로 따라오게 한다(스텝 스냅 좌표는 offsetHeight 기반이라
   높이가 바뀌면 creatorSteps 가 다음 휠부터 자동으로 다시 계산한다).
   접힘 상태에서는 인라인 높이를 비워 CSS 기본값(2234px)으로 되돌린다. */
function mcn6Relayout() {
  const slide = document.querySelector('.mcn-6');
  const inner = slide && slide.querySelector('.mcn');
  const list  = document.querySelector('.mcn6-list');
  if (!slide || !inner || !list) return;
  if (mcn6Expanded) {
    const BOTTOM_PAD = 160;    /* 마지막 카드 행 ↔ APPLY 사이 여백 */
    const h = list.offsetTop + list.offsetHeight + BOTTOM_PAD;
    slide.style.height = h + 'px';
    inner.style.height = h + 'px';
  } else {
    slide.style.height = '';
    inner.style.height = '';
  }
}

function mcn6ApplyFilter() {
  const grid = document.querySelector('.mcn6-grid');
  if (!grid) return;
  const cat  = mcn6ActiveValue('.mcn6-cat-item', 'category');
  const plat = mcn6ActiveValue('.mcn6-platform .mcn6-plat-item', 'platform');
  let shown = 0;   /* 필터를 통과한(매칭) 카드 수 */
  grid.querySelectorAll('.mcn6-card').forEach((card) => {
    const cCat   = card.dataset.category || '';
    const cPlats = (card.dataset.platform || '').split(/\s+/).filter(Boolean);
    const okCat  = cat  === 'all' || cCat === cat;
    const okPlat = plat === 'all' || cPlats.indexOf(plat) !== -1;
    const match  = okCat && okPlat;
    let visible  = match;
    if (match) {
      shown += 1;
      /* 접힘 상태에서는 매칭 카드 중 6번째까지만 노출 */
      if (!mcn6Expanded && shown > MCN6_LIMIT) visible = false;
    }
    card.classList.toggle('is-hidden', !visible);
  });
  /* 매칭 수가 6을 넘고 아직 접혀 있을 때만 전체보기 버튼 노출 */
  const moreBtn = document.querySelector('.mcn6-more');
  if (moreBtn) moreBtn.style.display = (!mcn6Expanded && shown > MCN6_LIMIT) ? '' : 'none';
  mcn6Relayout();
}
window.mcn6ApplyFilter = mcn6ApplyFilter;

const mcn6MoreBtn = document.querySelector('.mcn6-more');
if (mcn6MoreBtn) {
  mcn6MoreBtn.addEventListener('click', () => {
    mcn6Expanded = true;       /* 나머지 크리에이터 모두 노출 + 버튼 숨김 + 높이 확장 */
    mcn6ApplyFilter();
  });
}

function bindFilterGroup(selector) {
  const items = document.querySelectorAll(selector);
  items.forEach((item) => {
    item.addEventListener('click', () => {
      items.forEach((el) => el.classList.remove('is-active'));
      item.classList.add('is-active');
      mcn6Expanded = false;    /* 필터를 바꾸면 다시 6명으로 접는다 */
      mcn6ApplyFilter();
    });
  });
}
bindFilterGroup('.mcn6-cat-item');
bindFilterGroup('.mcn6-platform .mcn6-plat-item');
mcn6ApplyFilter();             /* 초기 적용: 6명 초과면 접고 버튼 노출 */


/* ── CREATOR filter dropdowns (mobile, slide 6) ──────────────────
   모바일은 필터를 드롭다운으로 제공. 선택 시 라벨 갱신 + 활성 상태만 토글.
   실제 필터링은 백엔드 연동 시 data-filter·data-value 기준으로 확장.       */
/* ── CREATOR(mo-sec-6) 전체 내부 스크롤 토글 ──────────────────────────────
   true  = CREATOR 섹션 전체(제목·CTA·필터·그리드·전체보기)를 내부 스크롤(요청 사항).
   false = 원래대로(제목·필터는 화면 고정 + 그리드만 내부 스크롤)로 즉시 복귀.
   구현: 제목(.tit)·필터(.mo-mcn6-filter)를 스크롤 컨테이너(.mo-sec6-scroll) 맨 앞으로
   옮기고 섹션에 .is-fullscroll 를 붙인다(나머지 배치는 mcn.css 의 .is-fullscroll 규칙).
   HTML·원본 CSS 는 건드리지 않으므로 이 값만 false 로 바꾸면 원상복귀. */
const MO_MCN6_FULLSCROLL = true;
(function moMcn6FullScroll() {
  if (!MO_MCN6_FULLSCROLL) return;
  const sec = document.querySelector('.mo-sec-6');
  if (!sec) return;
  const scroll = sec.querySelector('.mo-sec6-scroll');
  const tit    = sec.querySelector('.tit');
  const filter = sec.querySelector('.mo-mcn6-filter');
  if (!scroll || !tit || !filter) return;
  /* 스크롤 컨테이너 맨 앞에 [제목 → 필터] 순으로 삽입(그리드·전체보기 앞) */
  scroll.insertBefore(filter, scroll.firstChild);
  scroll.insertBefore(tit, scroll.firstChild);
  sec.classList.add('is-fullscroll');
})();

/* ── APPLY(mo-sec-7) 전체 내부 스크롤 토글 ───────────────────────────────────
   true  = 섹션 전체(히어로 .tit + 폼 카드 .con)를 내부 스크롤(요청 사항). 배경 .bg 는 고정.
   false = 원래대로(히어로·배경 고정 + 폼 카드만 내부 스크롤)로 즉시 복귀.
   구현: .tit·.con 을 새 스크롤 래퍼(.mo-sec7-scroll) 안으로 옮기고 섹션에 .is-fullscroll 를
   붙인다(배치는 mcn.css 의 .is-fullscroll 규칙, mo-snap EXEMPT 는 :not(.is-fullscroll) 로 분기).
   HTML·원본 CSS 는 무수정 → 이 값만 false 로 바꾸면 원상복귀. */
const MO_MCN7_FULLSCROLL = true;
(function moMcn7FullScroll() {
  if (!MO_MCN7_FULLSCROLL) return;
  const sec = document.querySelector('.mo-sec-7');
  if (!sec) return;
  const frame = sec.querySelector('.frame-wrap');
  const tit   = sec.querySelector('.tit');
  const con   = sec.querySelector('.con');
  if (!frame || !tit || !con) return;
  const scroll = document.createElement('div');
  scroll.className = 'mo-sec7-scroll';
  frame.appendChild(scroll);            /* 배경(.bg) 뒤(위)에 투명 스크롤 래퍼 추가 */
  scroll.appendChild(tit);              /* 히어로 → 폼 순으로 래퍼 안에서 함께 스크롤 */
  scroll.appendChild(con);
  sec.classList.add('is-fullscroll');
})();

const moFilterDropdowns = document.querySelectorAll('.mo-mcn6-dd');

function mcn6MobileValue(filter) {
  const it = document.querySelector('.mo-mcn6-dd[data-filter="' + filter + '"] .mo-mcn6-dd-item.is-active');
  return it ? (it.dataset.value || 'all') : 'all';
}
let mcn6MoExpanded = false;    /* 모바일 전체보기(펼침) 상태 */

function mcn6ApplyMobileFilter() {
  const list = document.querySelector('.mo-sec-6 .con-list');
  if (!list) return;
  const cat  = mcn6MobileValue('category');
  const plat = mcn6MobileValue('platform');
  let shown = 0;
  list.querySelectorAll('.con').forEach((card) => {
    const cCat   = card.dataset.category || '';
    const cPlats = (card.dataset.platform || '').split(/\s+/).filter(Boolean);
    const okCat  = cat  === 'all' || cCat === cat;
    const okPlat = plat === 'all' || cPlats.indexOf(plat) !== -1;
    const match  = okCat && okPlat;
    let visible  = match;
    if (match) {
      shown += 1;
      if (!mcn6MoExpanded && shown > MCN6_LIMIT) visible = false;
    }
    card.classList.toggle('is-hidden', !visible);
  });
  /* 모바일은 일반 흐름 레이아웃이라 reflow 가 자동 → 높이 보정 불필요 */
  const moreBtn = document.querySelector('.mo-mcn6-more');
  if (moreBtn) moreBtn.style.display = (!mcn6MoExpanded && shown > MCN6_LIMIT) ? '' : 'none';
}
window.mcn6ApplyMobileFilter = mcn6ApplyMobileFilter;

const moMcn6MoreBtn = document.querySelector('.mo-mcn6-more');
if (moMcn6MoreBtn) {
  moMcn6MoreBtn.addEventListener('click', () => {
    mcn6MoExpanded = true;
    mcn6ApplyMobileFilter();
  });
}

moFilterDropdowns.forEach((dd) => {
  const btn   = dd.querySelector('.mo-mcn6-dd-btn');
  const label = dd.querySelector('.mo-mcn6-dd-label');
  const items = dd.querySelectorAll('.mo-mcn6-dd-item');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dd.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    moFilterDropdowns.forEach((o) => { if (o !== dd) o.classList.remove('is-open'); });
  });

  items.forEach((item) => {
    item.addEventListener('click', () => {
      items.forEach((el) => el.classList.remove('is-active'));
      item.classList.add('is-active');
      label.textContent = item.textContent;
      dd.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      mcn6MoExpanded = false;   /* 필터를 바꾸면 다시 6명으로 접는다 */
      mcn6ApplyMobileFilter();
    });
  });
});
mcn6ApplyMobileFilter();        /* 초기 적용: 6명 초과면 접고 버튼 노출 */

/* 바깥 클릭 시 모바일 드롭다운 닫기 */
if (moFilterDropdowns.length) {
  document.addEventListener('click', () => {
    moFilterDropdowns.forEach((o) => {
      o.classList.remove('is-open');
      const b = o.querySelector('.mo-mcn6-dd-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ── AD BUSINESS chapters (slide 3) — 마우스 오버 시 해당 챕터 문구 노출 ──
   각 챕터에 마우스를 올리면 그 챕터가 활성화되어 하단 설명이 펼쳐짐.
   리스트를 벗어나면 기본값(01)으로 복귀.                                    */
const mcn3List  = document.querySelector('.mcn-3 .mcn3-list');
const mcn3Items = document.querySelectorAll('.mcn-3 .mcn3-item');
if (mcn3List && mcn3Items.length) {
  const activate = (target) => {
    mcn3Items.forEach((el) => el.classList.toggle('is-active', el === target));
  };
  mcn3Items.forEach((item) => {
    item.addEventListener('mouseenter', () => activate(item));
  });
  /* 리스트 영역을 벗어나면 모두 닫힘 (기본 활성 없음) */
  mcn3List.addEventListener('mouseleave', () => activate(null));
}

/* ── CONTENTS PRODUCTION (slide 4) — 하단 문구는 기본으로 항상 노출 ──
   (예전에는 메뉴 클릭 시에만 노출했으나, 바로 보이도록 변경) 스크롤 동작은 그대로. */

/* 좌측 탭(Growth Hack / 1:1 Exclusive PD / Multi-Channel) 클릭 시 해당 슬라이드로 이동.
   각 prod-slide 안에 탭이 한 벌씩 있으므로 모든 탭에 바인딩한다.                  */
(function () {
  function tabIndex(tab) {
    if (tab.classList.contains('mcn4-tab-1')) return 0;
    if (tab.classList.contains('mcn4-tab-2')) return 1;
    if (tab.classList.contains('mcn4-tab-3')) return 2;
    return -1;
  }
  document.querySelectorAll('.mcn-4 .mcn4-tab').forEach(function (tab) {
    tab.style.cursor = 'pointer';
    tab.addEventListener('click', function () {
      var i = tabIndex(tab);
      if (i < 0 || i === prodCurrent) return;
      prodGoTo(i, i > prodCurrent ? 1 : -1);
    });
  });
})();

/* ── CONTENTS PRODUCTION (mo-sec-4) 모바일 슬라이더 — 도트 동기화 ──
   scroll-snap 슬라이더로 교체. 스크롤 위치로 현재 슬라이드를 감지하고
   하단 도트를 동기화. 도트 클릭 시 해당 슬라이드로 smooth scroll. */
(function () {
  var slider = document.getElementById('moProdSlider');
  var dots = document.querySelectorAll('.mo-sec-4 .mo-prod-dot');
  if (!slider || !dots.length) return;

  function setActive(i) {
    dots.forEach(function (d, idx) { d.classList.toggle('is-active', idx === i); });
  }
  function currentIndex() {
    var w = slider.clientWidth;
    return w ? Math.round(slider.scrollLeft / w) : 0;
  }

  slider.addEventListener('scroll', function () { setActive(currentIndex()); }, { passive: true });

  dots.forEach(function (d, i) {
    d.addEventListener('click', function () {
      slider.scrollTo({ left: slider.clientWidth * i, behavior: 'smooth' });
    });
  });
})();

/* ── STUDIO (mo-sec-5) 모바일 카드 캐러셀 — 도트 동기화 ──
   카드가 한 화면 꽉 차게 스냅되며, 하단 도트가 현재 카드를 표시한다.
   도트를 누르면 해당 카드로 스크롤. (스와이프 가능 힌트) */
(function () {
  var row  = document.querySelector('.mo-sec-5 .con-row');
  var dots = document.querySelectorAll('.mo-sec-5 .mo5-dot');
  if (!row || !dots.length) return;

  function setActive(i) {
    dots.forEach(function (d, idx) { d.classList.toggle('is-active', idx === i); });
  }
  function currentIndex() {
    var w = row.clientWidth;
    return w ? Math.round(row.scrollLeft / w) : 0;
  }

  var ticking = false;
  row.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      setActive(currentIndex());
      ticking = false;
    });
  });

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      row.scrollTo({ left: row.clientWidth * i, behavior: 'smooth' });
    });
  });
})();

/* STUDIO (mcn-5) 데스크탑 — 3단 카드 정적 표시로 전환, carousel JS 불필요 */

/* ============================================================
   CREATOR (slide 6 / mo-sec-6) — 백엔드 연동 (점진적 향상)
   - /api/creator + /api/creatorsns 를 불러와 데스크탑 그리드(.mcn6-grid)와
     모바일 리스트(.con-list)를 DB 데이터로 교체한다.
   - 데이터가 없거나 호출 실패 시: HTML 에 박혀있는 기존 정적 카드를 그대로 둔다
     (홈페이지가 빈 화면이 되지 않도록 하는 폴백).
   - 밑줄(특정 SNS) 은 디자인 규칙이 데이터로 표현돼 있지 않아 적용하지 않음.
   ============================================================ */
(function () {
  var escEl = document.createElement('div');
  function esc(s) { escEl.textContent = (s == null ? '' : String(s)); return escEl.innerHTML; }

  /* 필터 매칭용 정규화: DB 카테고리/플랫폼 문자열 → 필터 버튼 값 */
  function catKey(c) {
    var s = (c == null ? '' : String(c)).toLowerCase();
    if (s.indexOf('stream') >= 0 || s.indexOf('스트리머') >= 0) return 'streamer';
    if (s.indexOf('creator') >= 0 || s.indexOf('크리에이터') >= 0) return 'creator';
    return s;
  }
  function platKey(name) {
    var s = (name || '').toLowerCase();
    if (s.indexOf('youtube') >= 0 || s.indexOf('유튜브') >= 0) return 'youtube';
    if (s.indexOf('soop') >= 0 || s.indexOf('숲') >= 0) return 'soop';
    if (s.indexOf('chzzk') >= 0 || s.indexOf('치지직') >= 0) return 'chzzk';
    if (s.indexOf('insta') >= 0 || s.indexOf('인스타') >= 0) return 'instagram';
    if (s.indexOf('tiktok') >= 0 || s.indexOf('틱톡') >= 0) return 'tiktok';
    return 'etc';
  }
  function platList(sns) {
    var seen = {}, out = [];
    (sns || []).forEach(function (s) {
      var k = platKey(s.platform);
      if (!seen[k]) { seen[k] = 1; out.push(k); }
    });
    return out.join(' ');
  }

  function getJSON(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
  }

  /* DB 에 "/images/..." 로 저장된 정적 이미지는 Vercel 정적 호스트에서 서빙된다.
     단, 아래 3명(호미호·쩌리쪼리·액티브)은 기존 호스트(staticfile-three) 관리자와
     연락이 닿지 않아 직접 올린 별도 호스트(ringcoms-nine)의 /images/mcn/ 에서 서빙한다.
     DB 경로 폴더(/images/creator/)와 무관하게 파일명만 떼어 새 호스트로 보낸다. 임시 조치이며,
     원래 호스트가 복구되면 이 예외 처리만 지우면 된다. */
  var OWN_HOST = 'https://staticfiles-seven.vercel.app/frontringcoms/images/mcn/';
  var OWN_HOST_FILES = ['creator_14', 'creator_22', 'creator_23'];
  function assetUrl(p) {
    if (!p || p.indexOf('/images/') !== 0) return p;
    var file = p.substring(p.lastIndexOf('/') + 1);   /* 예: creator_14.jpg */
    for (var i = 0; i < OWN_HOST_FILES.length; i++) {
      if (file.indexOf(OWN_HOST_FILES[i]) === 0) return OWN_HOST + file;
    }
    return 'https://staticfiles-seven.vercel.app/frontringcoms' + p;
  }

  function bySeq(a, b) {
    var as = a.sequence == null ? 1e9 : a.sequence;
    var bs = b.sequence == null ? 1e9 : b.sequence;
    return as - bs || (a.id - b.id);
  }

  /* 일부 크리에이터 사진은 머리 위 여백이 커서 center top crop 시 카드 상단이 비어 보인다.
     해당 이미지만 background-position-y 를 내려 얼굴을 위로 올린다. (테니·김다예·이나현·추유경·박고은) */
  var IMG_POS = {
    'creator_17.jpg': '50% 72%',  // 테니
    'creator_19.jpg': '50% 72%',  // 김다예
    'creator_20.jpg': '50% 72%',  // 이나현
    'creator_21.jpg': '50% 72%',  // 추유경
    'creator_05.jpg': '50% 72%'   // 박고은
  };
  function imgStyle(img) {
    var style = "background-image:url('" + esc(assetUrl(img)) + "')";
    var pos = null;
    for (var key in IMG_POS) {
      if (IMG_POS.hasOwnProperty(key) && img && img.indexOf(key) >= 0) { pos = IMG_POS[key]; break; }
    }
    if (pos) style += ';background-position:' + pos;
    return style;
  }

  function snsHtml(list, linkClass, sepClass, withArrow) {
    return (list || []).slice().sort(bySeq).map(function (s) {
      var inner = esc(s.platform) + (withArrow ? '<span class="arrow">↗</span>' : '');
      if (s.url) {
        return '<a class="' + linkClass + '" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + inner + '</a>';
      }
      return '<span class="' + linkClass + '">' + inner + '</span>';
    }).join('<span class="' + sepClass + '">I</span>');
  }

  function renderDesktop(creators, snsByCreator) {
    var grid = document.querySelector('.mcn6-grid');
    if (!grid) return;
    grid.innerHTML = creators.map(function (c) {
      var sns = snsByCreator[c.id];
      return '' +
        '<div class="mcn6-card" data-creator-id="' + esc(c.id) + '" data-category="' + esc(catKey(c.category)) + '" data-platform="' + esc(platList(sns)) + '">' +
          '<div class="mcn6-img" style="' + imgStyle(c.img) + '"></div>' +
          '<div class="mcn6-txt">' +
            '<p class="mcn6-name">' + esc(c.name) + '</p>' +
            '<div class="mcn6-sns">' + snsHtml(sns, 'mcn6-sns-link', 'mcn6-sns-sep', false) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
    var moreBtn = document.querySelector('.mcn6-more');
    if (moreBtn) moreBtn.style.display = creators.length > 6 ? '' : 'none';
    if (window.mcn6ApplyFilter) window.mcn6ApplyFilter();
  }

  function renderMobile(creators, snsByCreator) {
    var list = document.querySelector('.mo-sec-6 .con-list');
    if (!list) return;
    list.innerHTML = creators.map(function (c) {
      var sns = snsByCreator[c.id];
      return '' +
        '<div class="con" data-creator-id="' + esc(c.id) + '" data-category="' + esc(catKey(c.category)) + '" data-platform="' + esc(platList(sns)) + '">' +
          '<div class="con-img" style="' + imgStyle(c.img) + '"></div>' +
          '<div class="con-txt">' +
            '<p class="name">' + esc(c.name) + '</p>' +
            '<div class="sns">' + snsHtml(sns, 'sns-item', 'sns-sep', false) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
    var moreBtn = document.querySelector('.mo-mcn6-more');
    if (moreBtn) moreBtn.style.display = creators.length > 6 ? '' : 'none';
    if (window.mcn6ApplyMobileFilter) window.mcn6ApplyMobileFilter();
  }

  /* 카드 클릭 팝업이 참조할 레지스트리: creatorId → { creator, sns[] } */
  var POP_DATA = {};

  function init() {
    Promise.all([
      getJSON('/api/creator/scrollList?perpage=100&deleted=false'),
      getJSON('/api/creatorsns/scrollList?perpage=100')
    ]).then(function (res) {
      var creators = (res[0] || []).slice().sort(bySeq);
      if (!creators.length) return; // 데이터 없으면 정적 카드 유지
      var snsByCreator = {};
      (res[1] || []).forEach(function (s) {
        (snsByCreator[s.creatorId] = snsByCreator[s.creatorId] || []).push(s);
      });
      POP_DATA = {};
      creators.forEach(function (c) {
        POP_DATA[c.id] = { creator: c, sns: (snsByCreator[c.id] || []).slice().sort(bySeq) };
      });
      renderDesktop(creators, snsByCreator);
      renderMobile(creators, snsByCreator);
    }).catch(function () { /* 실패 시 정적 카드 유지 */ });
  }

  /* ── 프로필 팝업 ─────────────────────────────────────────────
     카드(.mcn6-card / .con)를 클릭하면 이미지·소개·플랫폼별 팔로워를
     작은 팝업으로 띄운다. 팝업은 스케일 컨테이너 밖(body)에 한 번만 만든다.
     데이터가 없는 정적 폴백 카드(data-creator-id 없음)는 클릭해도 무시. */
  var pop = null;
  function buildPop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'mcn-pop';
    pop.setAttribute('aria-hidden', 'true');
    pop.innerHTML =
      '<div class="mcn-pop-dim" data-pop-close></div>' +
      '<div class="mcn-pop-card" role="dialog" aria-modal="true" aria-label="크리에이터 정보">' +
        '<button class="mcn-pop-close" type="button" data-pop-close aria-label="닫기">' +
          '<span>CLOSE</span>' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M6 6L18 18M18 6L6 18" stroke="#212121" stroke-width="2" stroke-linecap="round"/>' +
          '</svg>' +
        '</button>' +
        '<div class="mcn-pop-img"></div>' +
        '<div class="mcn-pop-body">' +
          '<p class="mcn-pop-name"></p>' +
          '<div class="mcn-pop-sns"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', function (e) {
      if (e.target.closest('[data-pop-close]')) closePop();
    });
    return pop;
  }

  function snsRowsHtml(sns) {
    return (sns || []).map(function (s) {
      var plat = esc(s.platform || '');
      var foll = s.followers
        ? '<span class="mcn-pop-foll"><b>' + esc(s.followers) + '</b>Followers</span>'
        : '';
      var inner =
        '<span class="mcn-pop-plat">' + plat +
          (s.url ? '<span class="mcn-pop-ext" aria-hidden="true">↗</span>' : '') +
        '</span>' + foll;
      if (s.url) {
        return '<a class="mcn-pop-sns-row" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + inner + '</a>';
      }
      return '<div class="mcn-pop-sns-row">' + inner + '</div>';
    }).join('');
  }

  function openPop(id) {
    var entry = POP_DATA[id];
    if (!entry) return;
    var c = entry.creator;
    var el = buildPop();
    el.querySelector('.mcn-pop-img').style.backgroundImage = c.img ? "url('" + assetUrl(c.img) + "')" : '';
    el.querySelector('.mcn-pop-name').textContent = c.name || '';
    /* 소개글은 표기하지 않고 팔로워/구독자 수까지만 노출 */
    el.querySelector('.mcn-pop-sns').innerHTML = snsRowsHtml(entry.sns);
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
  }
  function closePop() {
    if (!pop) return;
    pop.classList.remove('is-open');
    pop.setAttribute('aria-hidden', 'true');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePop();
  });
  /* 카드 클릭 위임 — 그리드/리스트가 재렌더되어도 동작. SNS 링크 클릭은 통과. */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.mcn6-sns a, .con .sns a')) return;
    var card = e.target.closest('.mcn6-card[data-creator-id], .con[data-creator-id]');
    if (card) openPop(card.getAttribute('data-creator-id'));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============================================================
   APPLY (slide 7 / mo-sec-7) — 백엔드 연동 (공개 제출)
   - 디자인에 제출 버튼이 없어서 '신청하기' 버튼을 새로 추가한다(임시 스타일).
   - 입력칸에 id/name 이 없어 클래스/구조로 값을 수집한다.
   - 성별(버튼 토글)·동의(체크박스) 상태를 읽어 /api/mcnapply 로 POST.
   - 데스크탑(.mcn7-container)과 모바일(.mo-sec-7 form) 양쪽 모두 처리.
   ============================================================ */
(function () {
  function val(el) { return el ? (el.value || '').trim() : ''; }

  function validate(p) {
    if (!p.name || !p.birth || !p.gender || !p.phone || !p.email || !p.intro) {
      alert('필수 항목(이름·생년월일·성별·연락처·이메일·자기소개)을 모두 입력해주세요.');
      return false;
    }
    if (!p.agree) { alert('개인정보 수집 및 이용에 동의해주세요.'); return false; }
    return true;
  }

  function submitApply(payload, onOk) {
    // 최초 진입 경로(유입 채널)를 함께 전송 → 서버가 source 계산해 저장
    var ft = (window.ureferFirstTouch && window.ureferFirstTouch()) || {};
    payload.referrer  = ft.referrer  || '';
    payload.utmSource = ft.utmSource || '';
    fetch('/api/mcnapply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function () {
        // GTM 전환 이벤트. alert 이 스레드를 막는 동안 이탈해도 기록되도록 alert 앞에서 push 한다.
        window.dataLayer = window.dataLayer || [];
        dataLayer.push({ 'event': 'mcn_apply_success', 'applyType': 'mcn' });
        alert('신청이 접수되었습니다. 감사합니다.');
        if (onOk) onOk();
      })
      .catch(function () { alert('접수에 실패했습니다. 잠시 후 다시 시도해주세요.'); });
  }

  function addSubmitButton(parent, className, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = '신청하기';
    btn.addEventListener('click', onClick);
    parent.appendChild(btn);
  }

  /* ── 데스크탑 ── */
  var dc = document.querySelector('.mcn7-container');
  if (dc) {
    dc.querySelectorAll('.mcn7-gender-btn').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        dc.querySelectorAll('.mcn7-gender-btn').forEach(function (x) { x.classList.remove('active'); });
        this.classList.add('active');
      });
    });
    var dchk = dc.querySelector('.mcn7-chkbox');
    if (dchk) dchk.addEventListener('click', function () { this.classList.toggle('checked'); });

    /* 자세히보기: 동의서 전문 박스 열고/닫기 (열리면 컨테이너 높이 재계산) */
    var ddetail = dc.querySelector('.mcn7-terms-detail');
    var dbox = dc.querySelector('.mcn7-terms-detail-box');
    if (ddetail && dbox) ddetail.addEventListener('click', function () {
      dbox.classList.toggle('open');
      relayoutForm();
    });

    /* ── 운영 중인 플랫폼: select 드롭다운 + 행 추가(+)/삭제(−) ── */
    var PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'SOOP', '치지직', 'ETC'];
    var platformField = dc.querySelector('.mcn7-f-platform');

    function buildPmenu(pselect) {
      if (!pselect || pselect.querySelector('.mcn7-pmenu')) return;
      var menu = document.createElement('div');
      menu.className = 'mcn7-pmenu';
      menu.innerHTML = PLATFORMS.map(function (p) {
        return '<button type="button" class="mcn7-pmenu-item">' + p + '</button>';
      }).join('');
      pselect.appendChild(menu);
      menu.querySelectorAll('.mcn7-pmenu-item').forEach(function (it) {
        it.addEventListener('click', function (e) {
          e.stopPropagation();
          var nm = pselect.querySelector('.mcn7-pname');
          nm.textContent = it.textContent;
          nm.classList.add('is-selected');
          pselect.classList.remove('is-open');
        });
      });
    }
    function bindPselect(pselect) {
      buildPmenu(pselect);
      pselect.addEventListener('click', function (e) {
        e.stopPropagation();
        pselect.classList.toggle('is-open');
        if (platformField) {
          platformField.querySelectorAll('.mcn7-pselect.is-open').forEach(function (o) {
            if (o !== pselect) o.classList.remove('is-open');
          });
        }
      });
    }
    function bindPadd(btn) {
      if (!btn) return;
      var isAdd = !!btn.querySelector('.mcn7-plus-v');   /* +(세로선 있음)=추가, −=삭제 */
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (isAdd) {
          if (platformField) platformField.appendChild(makePlatformRow());
        } else {
          var row = btn.closest('.mcn7-prow');
          if (row) row.remove();
        }
        relayoutForm();
      });
    }
    /* 플랫폼 행 수에 따라 아래 필드(자기소개·약관·제출)를 다시 배치 */
    function relayoutForm() {
      if (!platformField) return;
      var bio    = dc.querySelector('.mcn7-f-bio');
      var terms  = dc.querySelector('.mcn7-terms');
      var submit = dc.querySelector('.mcn7-submit');
      if (!bio) return;
      var bioTop = platformField.offsetTop + platformField.offsetHeight + 32;
      bio.style.top = bioTop + 'px';
      var termsTop = bioTop + bio.offsetHeight + 16;
      if (terms)  terms.style.top  = termsTop + 'px';
      if (submit) submit.style.top = (termsTop - 8) + 'px';

      /* 컨테이너 높이를 콘텐츠에 맞춤 — 플랫폼이 1행이면 아래 빈 공간이 크게
         남으므로 마지막 요소(약관/제출) 하단 + 상단과 동일한 여백(60px)으로 줄인다.
         행이 많아 길어지면 기본 960px를 상한으로 두어 내부 스크롤을 유지한다. */
      /* 자세히보기 박스가 열려 있으면 그 하단까지 컨테이너를 늘려 박스 전체가 보이도록 한다.
         (박스는 terms 기준 절대배치 / 열렸을 때는 상한을 슬라이드 높이(1080)에 맞춰 키워
          컨테이너 내부 스크롤이 생기지 않게 → 페이지 스냅 스크롤과 충돌 방지) */
      var detail = dc.querySelector('.mcn7-terms-detail-box');
      var detailOpen = !!(terms && detail && detail.classList.contains('open'));
      var PAD = detailOpen ? 30 : 60, MAX_H = detailOpen ? 1060 : 960;
      var contentBottom = 0;
      if (terms)  contentBottom = Math.max(contentBottom, terms.offsetTop + terms.offsetHeight);
      if (submit) contentBottom = Math.max(contentBottom, submit.offsetTop + submit.offsetHeight);
      if (detailOpen) {
        contentBottom = Math.max(contentBottom, terms.offsetTop + detail.offsetTop + detail.offsetHeight);
      }
      var h = Math.min(contentBottom + PAD, MAX_H);
      dc.style.height = h + 'px';
      dc.style.top = 'calc(50% - ' + (h / 2) + 'px)';
    }
    function makePlatformRow() {
      var row = document.createElement('div');
      row.className = 'mcn7-prow';
      row.innerHTML =
        '<div class="mcn7-pselect">' +
          '<span class="mcn7-pname">Instagram</span>' +
          '<svg class="mcn7-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none">' +
            '<path d="M6 9L12 15L18 9" stroke="#D9D9D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<div class="mcn7-purl-wrap">' +
          '<input class="mcn7-purl" type="url" placeholder="운영 중인 플랫폼의 url을 입력해주세요.">' +
          '<button class="mcn7-padd" type="button"><div class="mcn7-plus"><div class="mcn7-plus-h"></div></div></button>' +
        '</div>';
      bindPselect(row.querySelector('.mcn7-pselect'));
      bindPadd(row.querySelector('.mcn7-padd'));
      return row;
    }
    dc.querySelectorAll('.mcn7-f-platform .mcn7-pselect').forEach(bindPselect);
    dc.querySelectorAll('.mcn7-f-platform .mcn7-padd').forEach(bindPadd);
    document.addEventListener('click', function () {
      if (!platformField) return;
      platformField.querySelectorAll('.mcn7-pselect.is-open').forEach(function (o) {
        o.classList.remove('is-open');
      });
    });

    addSubmitButton(dc, 'mcn7-submit', function () {
      var g = dc.querySelector('.mcn7-gender-btn.active');
      var platforms = [];
      dc.querySelectorAll('.mcn7-f-platform .mcn7-prow').forEach(function (row) {
        var nm = (row.querySelector('.mcn7-pname') || {}).textContent || '';
        var url = val(row.querySelector('.mcn7-purl'));
        if (url) platforms.push(nm.trim() + ': ' + url);
      });
      var p = {
        name: val(dc.querySelector('.mcn7-f-name .mcn7-input')),
        birth: val(dc.querySelector('.mcn7-f-birth .mcn7-input')),
        gender: g ? g.textContent.trim() : '',
        phone: val(dc.querySelector('.mcn7-f-contact .mcn7-input')),
        email: val(dc.querySelector('.mcn7-f-email .mcn7-input')),
        platforms: platforms.join('\n'),
        intro: val(dc.querySelector('.mcn7-textarea')),
        agree: !!(dchk && dchk.classList.contains('checked'))
      };
      if (!validate(p)) return;
      submitApply(p, function () {
        dc.querySelectorAll('.mcn7-input, .mcn7-purl, .mcn7-textarea').forEach(function (i) { i.value = ''; });
        dc.querySelectorAll('.mcn7-gender-btn').forEach(function (x) { x.classList.remove('active'); });
        if (dchk) dchk.classList.remove('checked');
      });
    });

    /* 시작 1행 기준으로 아래 필드 위치 보정 */
    relayoutForm();
  }

  /* ── 모바일 (성별/체크박스 토글은 mcn.html 인라인 스크립트가 처리, 여기선 값만 읽음) ── */
  var mf = document.querySelector('.mo-sec-7 form');
  if (mf) {
    /* ── 운영 중인 플랫폼: 드롭다운 선택 + 행 추가(+)/삭제(−) ── */
    var PLATFORMS_M = ['Instagram', 'TikTok', 'YouTube', 'SOOP', '치지직', 'ETC'];
    var platRows = mf.querySelector('.plat-rows');
    var addBtn = mf.querySelector('.platform .add-btn');

    function buildPmenuM(sel) {
      if (!sel || sel.querySelector('.pmenu')) return;
      var menu = document.createElement('div');
      menu.className = 'pmenu';
      menu.innerHTML = PLATFORMS_M.map(function (p) {
        return '<button type="button" class="pmenu-item">' + p + '</button>';
      }).join('');
      sel.appendChild(menu);
      menu.querySelectorAll('.pmenu-item').forEach(function (it) {
        it.addEventListener('click', function (e) {
          e.stopPropagation();
          var inp = sel.querySelector('input');
          if (inp) inp.value = it.textContent;
          sel.classList.remove('is-open');
        });
      });
    }
    function bindSelectM(sel) {
      buildPmenuM(sel);
      sel.addEventListener('click', function (e) {
        if (e.target.closest('.pmenu')) return;   /* 메뉴 항목 클릭은 위에서 처리 */
        e.stopPropagation();
        var wasOpen = sel.classList.contains('is-open');
        if (platRows) platRows.querySelectorAll('.input-select.is-open').forEach(function (o) { o.classList.remove('is-open'); });
        if (!wasOpen) sel.classList.add('is-open');
      });
    }
    function makeRowM() {
      var row = document.createElement('div');
      row.className = 'prow';
      row.innerHTML =
        '<button type="button" class="prow-remove" aria-label="삭제">−</button>' +
        '<div class="input input-select">' +
          '<input type="text" value="Instagram" readonly>' +
          '<span class="chevron"></span>' +
        '</div>' +
        '<div class="input input-url"><input type="text" placeholder="운영 중인 플랫폼의 url을 입력해주세요."></div>';
      bindSelectM(row.querySelector('.input-select'));
      row.querySelector('.prow-remove').addEventListener('click', function () { row.remove(); });
      return row;
    }
    if (platRows) mf.querySelectorAll('.plat-rows .input-select').forEach(bindSelectM);
    if (addBtn && platRows) addBtn.addEventListener('click', function (e) {
      e.preventDefault();
      platRows.appendChild(makeRowM());
    });
    /* 바깥 클릭 시 열린 드롭다운 닫기 */
    document.addEventListener('click', function () {
      if (platRows) platRows.querySelectorAll('.input-select.is-open').forEach(function (o) { o.classList.remove('is-open'); });
    });

    addSubmitButton(mf, 'mo-mcn7-submit', function () {
      var g = mf.querySelector('.segmented .seg.active');
      var mchk = mf.querySelector('.checkbox');
      var platforms = [];
      mf.querySelectorAll('.plat-rows .prow').forEach(function (row) {
        var nm = val(row.querySelector('.input-select input'));
        var url = val(row.querySelector('.input-url input'));
        if (url) platforms.push((nm || 'Instagram') + ': ' + url);
      });
      var p = {
        name: val(mf.querySelector('input[placeholder*="이름"]')),
        birth: val(mf.querySelector('input[placeholder="YYMMDD"]')),
        gender: g ? g.textContent.trim() : '',
        phone: val(mf.querySelector('input[placeholder*="연락"]')),
        email: val(mf.querySelector('input[type="email"]')),
        platforms: platforms.join('\n'),
        intro: val(mf.querySelector('.intro textarea')),
        agree: !!(mchk && mchk.classList.contains('checked'))
      };
      if (!validate(p)) return;
      submitApply(p, function () {
        /* 추가된 플랫폼 행 제거 후 나머지 입력 초기화 */
        mf.querySelectorAll('.plat-rows .prow:not(:first-child)').forEach(function (r) { r.remove(); });
        mf.querySelectorAll('input:not([readonly]), textarea').forEach(function (i) { i.value = ''; });
        mf.querySelectorAll('.seg').forEach(function (x) { x.classList.remove('active'); });
        if (mchk) mchk.classList.remove('checked');
      });
    });
  }
})();
