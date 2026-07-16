/* career.js — KV는 career.png 풀블리드 정적 이미지(중앙 헤딩).
   별도 확대/축소 제스처 없이 일반 스크롤로 다음 섹션으로 넘어간다. */

/* ── 메인 패널(iframe) 임베드 시 상단 헤더 클립 보정 ────────────────
   부모 스테이지는 16:9 보다 낮은(가로로 긴) 화면에서 위/아래를 잘라낸다
   (--mcn-y 음수). career 의 상단 고정 헤더(로고/햄버거)는 iframe 내부
   최상단(top:0)에 있어 그 잘림에 먹혀 사라지므로, 부모와 동일한 클립량
   (vclip, 1920 프레임 px)을 계산해 헤더를 그만큼 아래로 내려 항상 보이게
   한다. (Press/Contact 의 --vclip 보정과 동일 패턴. 같은 오리진이라
   window.parent 의 뷰포트를 직접 읽는다.) 단독 실행 시엔 동작하지 않는다. */
(function () {
  if (!(window.parent && window.parent !== window)) return;
  const root = document.documentElement;
  function applyEmbedClip() {
    let vclip = 0;
    try {
      const vw = window.parent.innerWidth;
      const vh = window.parent.innerHeight;
      if (vw > 768) {
        const scale = vw / 1920;                          /* 부모: fill-width */
        vclip = Math.max(0, 540 - vh / (2 * scale));      /* 한쪽 잘림량(프레임 px) */
      }
    } catch (e) { /* cross-origin 등 — 보정 없이 둔다 */ }
    root.style.setProperty('--embed-clip-top', vclip + 'px');
  }
  applyEmbedClip();
  window.addEventListener('resize', applyEmbedClip);
  try { window.parent.addEventListener('resize', applyEmbedClip); } catch (e) {}
})();

const container = document.getElementById('careerContainer');

/* ── Floating left menu — slides 2~4 동안만 떠 있게 표시 ─────────────
   뷰포트 세로 중앙이 Join Us(슬라이드 2) 상단에 닿으면 보이고,
   Footer 상단에 닿으면 사라진다. (.career-container 가 스크롤·스케일을
   담당하므로 모든 좌표를 컨테이너의 레이아웃 좌표계로 비교한다.) */
const floatMenu = document.querySelector('.career-float-menu');
function updateFloatMenu() {
  if (!floatMenu) return;
  const slide2 = document.querySelector('.career-2');
  const footer = document.querySelector('.career-footer');
  if (!slide2) return;
  const center = container.scrollTop + container.clientHeight / 2;
  /* 뷰포트 세로 중앙으로 직접 이동시켜 "떠 있는" 효과 (transform:translateY(-50%) 가 중앙정렬) */
  floatMenu.style.top = center + 'px';
  const start = slide2.offsetTop;
  const end   = footer ? footer.offsetTop : Infinity;
  floatMenu.classList.toggle('is-visible', center >= start && center < end);
}
container.addEventListener('scroll', updateFloatMenu, { passive: true });
window.addEventListener('resize', updateFloatMenu);
window.addEventListener('load', updateFloatMenu);
updateFloatMenu();

/* ── PC 섹션 스냅 (mcn 과 동일한 휠 단위 페이징) ───────────────────
   휠 한 번 = 다음/이전 섹션으로 스냅. FAQ(career-4)처럼 뷰포트보다 큰
   섹션은 자유 스크롤 구간으로 두고 끝에 닿으면 다음/이전 섹션으로 넘긴다.
   (.career-container 는 모바일에서 display:none 이라 모바일엔 영향 없음 —
    모바일 페이징은 mo-snap.js 가 담당.) 좌표는 offsetHeight 로 런타임 측정. */
(function () {
  /* DOM 순서 = 화면 순서. 플로팅 메뉴 등은 제외하고 섹션만. */
  const SECTIONS = Array.from(
    container.querySelectorAll('.career-1, .career-2, .career-3, .career-4, .career-footer')
  );
  if (SECTIONS.length < 2) return;

  const vh = () => container.clientHeight;                 /* 미축소 뷰포트 높이 */
  const maxScroll = () => container.scrollHeight - container.clientHeight;
  function topOf(i) {
    let t = 0;
    for (let k = 0; k < i; k++) t += SECTIONS[k].offsetHeight;
    return t;
  }
  const isTall = (i) => SECTIONS[i].offsetHeight > vh() + 5;
  /* 섹션의 스크롤 목표값. 마지막(footer)은 뷰포트보다 짧아 맨 아래로 붙인다. */
  const pageTop = (i) => (i === SECTIONS.length - 1
    ? maxScroll()
    : Math.min(topOf(i), maxScroll()));
  /* 자유 스크롤 섹션의 하단(하단이 뷰포트 하단에 닿는 지점) */
  const sectionBottom = (i) => (i === SECTIONS.length - 1
    ? maxScroll()
    : topOf(i + 1) - vh());

  let locked = false;
  let timer  = null;
  const unlock = () => { locked = false; };

  function snapTop(i) {
    i = Math.max(0, Math.min(SECTIONS.length - 1, i));
    locked = true;
    container.scrollTo({ top: pageTop(i), behavior: 'smooth' });
    clearTimeout(timer);
    timer = setTimeout(unlock, 700);
  }
  function snapBottom(i) {
    locked = true;
    container.scrollTo({ top: sectionBottom(i), behavior: 'smooth' });
    clearTimeout(timer);
    timer = setTimeout(unlock, 700);
  }
  /* 위로 진입하는 긴 섹션은 하단에서 시작(전체를 거꾸로 훑게), 그 외엔 상단으로. */
  function snapToSection(target, dir) {
    target = Math.max(0, Math.min(SECTIONS.length - 1, target));
    if (dir < 0 && isTall(target)) snapBottom(target);
    else snapTop(target);
  }

  /* 메인페이지 패널 안(iframe)에 실렸을 때: career 맨 위에서 위로 스크롤하면
     메인으로 'career:prev' 를 보내 이전 패널(Business Contact)로 되돌아가게 한다. */
  const inParentFrame = window.parent && window.parent !== window;

  container.addEventListener('wheel', (e) => {
    const scrollTop = container.scrollTop;
    const dir = e.deltaY > 0 ? 1 : -1;

    if (inParentFrame && dir < 0 && scrollTop <= 2) {
      e.preventDefault();
      window.parent.postMessage('career:prev', '*');
      return;
    }

    /* 현재 스크롤 위치가 속한 섹션 (위치 기반이라 상태 드리프트가 없다) */
    let i = 0;
    for (let k = 0; k < SECTIONS.length; k++) {
      if (scrollTop >= topOf(k) - 5) i = k;
    }

    /* ── 자유 스크롤 섹션(뷰포트보다 큰 섹션: 예) FAQ) ── */
    if (isTall(i)) {
      e.preventDefault();
      if (locked) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
      const next  = scrollTop + delta;
      const top   = topOf(i);
      const bot   = sectionBottom(i);
      if (dir < 0) {
        if (next <= top + 5) snapToSection(i - 1, -1);   /* ↑ 상단 → 이전 섹션 */
        else container.scrollTop = next;
      } else {
        if (next >= bot - 5) snapToSection(i + 1, 1);    /* ↓ 하단 → 다음 섹션 */
        else container.scrollTop = Math.min(next, bot);
      }
      return;
    }

    /* ── 스냅 섹션(뷰포트 이내) ── */
    e.preventDefault();
    if (locked) return;
    if (Math.abs(e.deltaY) < 15) return;                 /* 트랙패드 미세 스크롤 무시 */
    snapToSection(i + dir, dir);
  }, { passive: false });

  /* ── 터치(아이패드 등): 메인으로 되돌아가는 길만 복원 ────────────────
     이 페이지의 페이징은 전부 wheel 기반인데 터치 기기는 wheel 을 만들지
     않는다. 게다가 메인에 iframe 으로 실렸을 땐 iframe 안의 터치가 부모로
     전파되지 않아(브라우징 컨텍스트 격리) main.js 의 스와이프 내비게이션
     (window touchstart/touchend)도 닿지 않는다 → Career 에 한번 들어오면
     Business Contact 로 되돌아갈 방법이 아예 사라진다.
     상하 스크롤은 .career-container 의 네이티브 스크롤이 이미 처리하므로
     여기서 섹션 스냅까지 흉내내지 않는다 — 네이티브와 이중으로 움직여 튄다.
     'career:prev' 복귀 경로만 터치로 열어 준다(wheel 로직은 무변경).
       · 맨 위에서 아래로 스와이프 → 이전 패널
       · 오른쪽으로 스와이프       → 이전 패널 (Career 는 마지막이라 '다음'은 없음)
     방향 부호는 main.js 의 터치 내비와 같은 의미가 되도록 맞췄다.
     passive:true — 네이티브 스크롤을 절대 막지 않는다. */
  if (inParentFrame) {
    const SWIPE_MIN = 60;                  /* px — main.js(50)보다 살짝 보수적 */
    let sx = 0, sy = 0, startTop = 0, tracking = false;

    container.addEventListener('touchstart', (e) => {
      tracking = e.touches.length === 1;   /* 핀치 줌 등 멀티터치는 무시 */
      if (!tracking) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      startTop = container.scrollTop;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      const back = () => window.parent.postMessage('career:prev', '*');

      if (Math.abs(dy) > Math.abs(dx)) {
        /* 세로: 맨 위에서 아래로 당길 때만 (wheel 의 scrollTop<=2 조건과 동일).
           시작·끝 both 를 보는 건 중간에서 위로 훑어 올라온 관성을 복귀로
           오인하지 않기 위함. */
        if (dy > SWIPE_MIN && startTop <= 2 && container.scrollTop <= 2) back();
        return;
      }
      /* 가로: 위치와 무관하게 오른쪽 스와이프 = 이전 패널. FAQ 깊숙한 곳에서도
         맨 위까지 올라가지 않고 빠져나올 수 있어야 한다. */
      if (dx > SWIPE_MIN) back();
    }, { passive: true });
  }

  /* 스냅 정착 후 잠금 해제 (Safari 등 scrollend 미지원 환경 대비 setTimeout 병행) */
  container.addEventListener('scrollend', () => {
    clearTimeout(timer);
    timer = setTimeout(unlock, 80);
  });
})();

/* ── FAQ slide height — tracks number of items in the active tab ──── */
/* career-4 의 .c4-list 들은 position:absolute 라서 슬라이드 높이를 직접
   잡아줘야 한다. 활성 탭의 항목 수(+아코디언 펼침 높이)에 맞춰 슬라이드
   길이를 다시 계산해 footer 위치까지 자연스럽게 따라오게 한다. */
const FAQ_LIST_TOP = 341;  /* .c4-list 시작 top */
const FAQ_BOTTOM   = 120;  /* 마지막 항목과 footer 사이 여백 */
function layoutFaq() {
  if (window.matchMedia('(max-width: 768px)').matches) return;
  const slide = document.querySelector('.career-4');
  if (!slide) return;
  let active = null;
  document.querySelectorAll('.c4-list').forEach(list => {
    if (list.style.display !== 'none') active = list;
  });
  if (!active) return;
  slide.style.height = (FAQ_LIST_TOP + active.offsetHeight + FAQ_BOTTOM) + 'px';
}
window.layoutFaq = layoutFaq;

/* 아코디언 펼침/접힘 애니메이션(max-height)이 끝나면 높이 재계산 */
const careerFaqSlide = document.querySelector('.career-4');
if (careerFaqSlide) {
  careerFaqSlide.addEventListener('transitionend', e => {
    if (e.propertyName === 'max-height') layoutFaq();
  });
}

/* ── FAQ accordion toggle ──────────────────────────────────────── */
document.querySelectorAll('.c4-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.c4-item');
    item.classList.toggle('c4-item-open');
    layoutFaq();
  });
});

/* ── FAQ tab switching ─────────────────────────────────────────── */
document.querySelectorAll('.c4-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const idx = tab.dataset.tab;
    document.querySelectorAll('.c4-tab').forEach(t => t.classList.remove('c4-tab-active'));
    tab.classList.add('c4-tab-active');
    document.querySelectorAll('.c4-list').forEach(list => {
      list.style.display = list.dataset.panel === idx ? 'flex' : 'none';
    });
    layoutFaq();
  });
});

/* 최초 1회 + 폰트 로드 후 높이 계산 */
layoutFaq();
window.addEventListener('load', layoutFaq);
window.addEventListener('resize', layoutFaq);

/* ── 해시 딥링크 ───────────────────────────────────────────────
   메인 GNB 서브메뉴에서 career.html#process / #faq 로 진입 시
   해당 섹션으로 이동한다(데스크탑: 컨테이너 스크롤, 모바일: 섹션 스크롤). */
function careerNavFromHash(fromTop) {
  const key = (location.hash || '').replace('#', '');
  if (key !== 'process' && key !== 'faq') return;

  if (window.matchMedia('(max-width: 768px)').matches) {
    const sel = key === 'process' ? '.mo-slide-3' : '.mo-slide-4';
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

  layoutFaq();   // FAQ 슬라이드 높이 확정 후 위치 계산
  const slide = document.querySelector(key === 'process' ? '.career-3' : '.career-4');
  if (!slide) return;
  if (fromTop) {
    // 다른 페이지에서 진입: 맨 위(KV)에서 시작해 해당 섹션까지 부드럽게.
    container.scrollTop = 0;
    requestAnimationFrame(() => container.scrollTo({ top: slide.offsetTop, behavior: 'smooth' }));
  } else {
    // 같은 페이지: 현재 위치에서 부드럽게.
    container.scrollTo({ top: slide.offsetTop, behavior: 'smooth' });
  }
}
if (location.hash) {
  window.addEventListener('load', () => requestAnimationFrame(() => careerNavFromHash(true)));
}
window.addEventListener('hashchange', () => careerNavFromHash(false));

/* ── Mobile FAQ accordion toggle ───────────────────────────────── */
/* 행(.mo-c4-con) 전체를 눌러도 펼쳐지게 한다 (+버튼이 가려 못 누르는 경우 대비) */
document.querySelectorAll('.mo-c4-con').forEach(con => {
  con.addEventListener('click', () => {
    con.closest('.mo-c4-item').classList.toggle('mo-c4-item-open');
  });
});

/* ── Mobile FAQ tab switching ──────────────────────────────────── */
document.querySelectorAll('.mo-c4-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const idx = tab.dataset.tab;
    document.querySelectorAll('.mo-c4-tab').forEach(t => t.classList.remove('mo-c4-tab-active'));
    tab.classList.add('mo-c4-tab-active');
    document.querySelectorAll('.mo-c4-list').forEach(list => {
      list.style.display = list.dataset.panel === idx ? 'flex' : 'none';
    });
  });
});

/* ============================================================
   FAQ (career-4 / mo-sec FAQ) — 백엔드 연동 (점진적 향상)
   - /api/faq/publicList 를 불러와 4개 탭 패널(데스크탑 .c4-list / 모바일 .mo-c4-list)을
     category 별로 채운다. 아코디언 토글은 렌더 후 다시 바인딩한다.
   - 데이터가 없거나 실패하면 HTML 의 정적 FAQ 를 그대로 둔다(폴백).
   - category 코드 → 탭 인덱스: apply 0 / process 1 / offer 2 / etc 3
   ============================================================ */
(function () {
  var CAT_TO_PANEL = { apply: 0, process: 1, offer: 2, etc: 3 };
  var escEl = document.createElement('div');
  function esc(s) { escEl.textContent = (s == null ? '' : String(s)); return escEl.innerHTML; }
  function nl2br(s) { return s.replace(/\n/g, '<br>'); }

  function renderItems(container, items, mobile) {
    var p = mobile ? 'mo-c4' : 'c4';
    container.innerHTML = items.map(function (it, i) {
      return '' +
        '<div class="' + p + '-item">' +
          '<div class="' + p + '-con">' +
            '<div class="' + p + '-txt">' +
              '<span class="' + p + '-q-label">Q' + (i + 1) + '.</span>' +
              '<div class="' + p + '-qa-right">' +
                '<span class="' + p + '-q-text">' + esc(it.title) + '</span>' +
                '<div class="' + p + '-a"><p class="' + p + '-a-text">' + nl2br(esc(it.content)) + '</p></div>' +
              '</div>' +
            '</div>' +
            '<button class="' + p + '-btn" aria-label="Toggle"></button>' +
          '</div>' +
        '</div>';
    }).join('');
    /* 모바일은 행 전체(.mo-c4-con)를, 데스크탑은 기존대로 +버튼을 토글 트리거로 */
    var trigger = mobile ? '.' + p + '-con' : '.' + p + '-btn';
    container.querySelectorAll(trigger).forEach(function (el) {
      el.addEventListener('click', function () {
        el.closest('.' + p + '-item').classList.toggle(p + '-item-open');
        if (!mobile && window.layoutFaq) window.layoutFaq();
      });
    });
  }

  fetch('/api/faq/publicList', { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (list) {
      if (!list || !list.length) return; // 데이터 없으면 정적 FAQ 유지
      var byPanel = { 0: [], 1: [], 2: [], 3: [] };
      list.forEach(function (f) {
        var idx = CAT_TO_PANEL[f.category];
        if (idx != null) byPanel[idx].push(f);
      });
      [0, 1, 2, 3].forEach(function (idx) {
        byPanel[idx].sort(function (a, b) {
          var as = a.sequence == null ? 1e9 : a.sequence;
          var bs = b.sequence == null ? 1e9 : b.sequence;
          return as - bs;
        });
        var d = document.querySelector('.c4-list[data-panel="' + idx + '"]');
        if (d) renderItems(d, byPanel[idx], false);
        var m = document.querySelector('.mo-c4-list[data-panel="' + idx + '"]');
        if (m) renderItems(m, byPanel[idx], true);
      });
      /* 동적 데이터로 항목 수가 바뀌었으니 슬라이드 높이 재계산 */
      if (window.layoutFaq) window.layoutFaq();
    })
    .catch(function () { /* 실패 시 정적 유지 */ });
})();

/* ── PROCESS(slide-3) / FAQ(slide-4) 전체 내부 스크롤 토글 ──────────────────────
   true  = 섹션 전체(제목·설명·탭 + 본문)를 내부 스크롤(요청 사항). CREATOR full-scroll 과 동일 패턴.
   false = 원래대로(제목·탭 화면 고정 + 본문만 내부 스크롤)로 즉시 복귀.
   구현: 제목/설명/탭을 스크롤 컨테이너(.mo-s3-list / .mo-s4-scroll) 맨 앞으로 옮기고
   섹션에 .is-fullscroll 를 붙인다(나머지 배치는 career.css 의 .is-fullscroll 규칙).
   HTML·원본 CSS 는 무수정 → 이 값만 false 로 바꾸면 원상복귀. */
const MO_CAREER_FULLSCROLL = true;
(function moCareerFullScroll() {
  if (!MO_CAREER_FULLSCROLL) return;

  /* PROCESS: 제목(.mo-s3-title)을 리스트(.mo-s3-list) 맨 앞으로 */
  const s3 = document.querySelector('.mo-slide-3');
  if (s3) {
    const list  = s3.querySelector('.mo-s3-list');
    const title = s3.querySelector('.mo-s3-title');
    if (list && title) {
      list.insertBefore(title, list.firstChild);
      s3.classList.add('is-fullscroll');
    }
  }

  /* FAQ: 제목·설명·탭(.mo-s4-title/.mo-s4-desc/.mo-s4-tabs-wrap)을
     스크롤 컨테이너(.mo-s4-scroll) 맨 앞으로(제목 → 설명 → 탭 → 패널 순) */
  const s4 = document.querySelector('.mo-slide-4');
  if (s4) {
    const scroll = s4.querySelector('.mo-s4-scroll');
    const title  = s4.querySelector('.mo-s4-title');
    const desc   = s4.querySelector('.mo-s4-desc');
    const tabs   = s4.querySelector('.mo-s4-tabs-wrap');
    if (scroll && title && desc && tabs) {
      scroll.insertBefore(tabs,  scroll.firstChild);
      scroll.insertBefore(desc,  scroll.firstChild);
      scroll.insertBefore(title, scroll.firstChild);
      s4.classList.add('is-fullscroll');
    }
  }
})();
