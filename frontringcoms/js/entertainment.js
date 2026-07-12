/* entertainment.js
   아티스트 + 필모그라피를 DB(/api/artist/publicList, /api/artistfilmo/publicList)에서
   불러와 데스크탑 슬라이드와 모바일 상세 뷰를 동적으로 생성한다.
   생성이 끝난 뒤 기존의 슬라이드 스크롤 / 모바일 드롭다운 / 사진 슬라이드쇼를 초기화한다. */

const container = document.getElementById('entContainer');
const SLIDE_W   = 1920;
const SLIDE_H   = 1080;

/* ──────────────────────────────────────────────────────────────
   Scale-to-fit: 데스크탑 1920×1080 캔버스를 뷰포트에 맞춰 축소.
   ────────────────────────────────────────────────────────────── */
function fitCanvas() {
  /* --ent-* 는 root(:root)에 설정 → 컨테이너(transform)는 상속받아 쓴다. */
  const root = document.documentElement;
  if (window.innerWidth <= 768) {
    root.style.removeProperty('--ent-scale');
    root.style.removeProperty('--ent-x');
    root.style.removeProperty('--ent-y');
    root.style.removeProperty('--ent-vis-h');
    root.style.removeProperty('--ent-vclip');
    root.style.removeProperty('--ent6-btn-lift');
    root.style.removeProperty('--ent1-logo-lift');
    root.style.removeProperty('--ent1-email-lift');
    root.style.removeProperty('--ent1-quote-lift');
    root.style.removeProperty('--ent2-info-lift');
    return;
  }
  /* 폭에 꽉 맞춰 채운다(fill-width) → 좌우 여백 없음. scale = vw/1920, --ent-x = 0.
     세로는 상단 정렬(--ent-y 는 와이드일 때 0) → 잘림을 전부 "아래쪽"으로 몰아서
     상단 콘텐츠(탭·아티스트 메뉴·서브내브·포트레이트 상단)는 절대 안 잘린다.
     (이 페이지의 기존 --ent-vis-h 로직이 상단 정렬 전제로 설계돼 있어 그대로 호환된다.)
     아래로 잘리는 양을 --ent-vclip 로 노출 → 하단 고정 요소(CONTACT 등)를 그만큼 위로
     끌어올려 잘리지 않게 한다. 세로로 긴 화면은 위/아래 레터박스로 중앙 정렬(잘림 없음). */
  const scale = window.innerWidth / SLIDE_W;
  root.style.setProperty('--ent-scale', scale);
  root.style.setProperty('--ent-x', '0px');
  root.style.setProperty('--ent-y', Math.max(0, (window.innerHeight - SLIDE_H * scale) / 2) + 'px');
  /* 캔버스 좌표로 환산해 "실제로 보이는 높이"(세로 충분하면 1080). 아티스트 썸네일/사진 CSS가 사용. */
  const visH = Math.min(SLIDE_H, window.innerHeight / scale);
  root.style.setProperty('--ent-vis-h', visH + 'px');
  /* 아래로 잘리는 양(= 1080 - 보이는 높이). 안 잘리면 0. 하단 요소를 이만큼 위로 올린다. */
  const vclip = Math.max(0, SLIDE_H - visH);
  root.style.setProperty('--ent-vclip', vclip + 'px');

  /* 하단 고정 푸터(60px)를 캔버스 좌표로 환산한 두께 + 푸터 윗선(=보이는 영역에서 푸터를 뺀 바닥) */
  const footerCanvas = 60 / scale;
  const footerTop = visH - footerCanvas;        /* 이 아래(캔버스 y)는 푸터에 가린다 */

  /* 슬라이드6 오디션 버튼(캔버스 750~800)이 푸터에 가리는 만큼만 위로. 위쪽 프레임(끝 684px)과
     10px 간격 유지 위해 최대 56px. */
  root.style.setProperty('--ent6-btn-lift', Math.min(Math.max(0, 800 - footerTop), 56) + 'px');

  /* 슬라이드1 히어로(인용문·이메일·로고)는 로고(하단 892~940)가 푸터에 가리지 않도록 올린다.
     로고는 필요한 만큼 전부 올리고(항상 안 잘림), 그 양이 로고-이메일 간격(178px)을 넘으면
     이메일을, 이메일-인용문 간격(56px)을 넘으면 인용문을 연쇄로 올려 서로 안 겹치게 한다.
     (16:9 등 충분한 높이에선 footerTop≥940 → 보정 0 → 원래 디자인 그대로) */
  const logoLift  = Math.max(0, 940 - footerTop);
  const emailLift = Math.max(0, logoLift - 178);
  const quoteLift = Math.max(0, emailLift - 56);
  root.style.setProperty('--ent1-logo-lift', logoLift + 'px');
  root.style.setProperty('--ent1-email-lift', emailLift + 'px');
  root.style.setProperty('--ent1-quote-lift', quoteLift + 'px');

  /* 아티스트 정보 블록(이름 534 / 생년 592 / 소개 698~817)이 푸터에 가리지 않도록 위로.
     단, 위쪽 배우 리스트(.ent2-menu, top 160)와 20px 간격을 유지하도록 올림 양을 제한한다.
     (메뉴 높이는 배우 수에 따라 달라 JS로 측정) */
  const menuEl = document.querySelector('.entertainment-artist .ent2-menu');
  const menuBottom = menuEl ? 160 + menuEl.offsetHeight : 160;
  const infoMaxLift = Math.max(0, 534 - menuBottom - 20);   /* 이름(534) 위로 메뉴와 충돌 방지 */
  const infoLift = Math.min(Math.max(0, 817 - footerTop), infoMaxLift);   /* 소개 하단 817 이 푸터를 넘는 만큼 */
  root.style.setProperty('--ent2-info-lift', infoLift + 'px');

  fitFilmographies(visH);
}

/* 세로 축소 시, 필모그라피(우측, left:912)가 위로 올라온 썸네일과 겹치지 않도록
   사용 가능한 세로 공간에 맞춰 통째로 축소(transform:scale)한다. 세로가 충분하면
   기존 위치(썸네일 top:770) 위에 그대로 들어가므로 scale=1 → 변화 없음.
   필모 높이는 아티스트마다 달라 CSS만으로는 비율을 못 구하므로 JS로 측정·계산. */
function fitFilmographies(visH) {
  const films = document.querySelectorAll('.entertainment-artist .ent2-film');
  if (!films.length) return;
  if (window.innerWidth <= 768) {
    films.forEach(function (f) { f.style.transform = ''; f.style.transformOrigin = ''; });
    return;
  }
  const FILM_TOP = 160;                          /* .ent2-film top */
  const GAP = 24;                                /* 썸네일과의 최소 간격 */
  const thumbTop = Math.min(770, visH - 310);    /* CSS의 썸네일 top 과 동일 */
  const avail = thumbTop - FILM_TOP - GAP;       /* 필모가 쓸 수 있는 세로 높이 */
  films.forEach(function (film) {
    film.style.transformOrigin = 'top left';
    film.style.transform = 'none';               /* 자연 높이 측정용으로 초기화 */
    const natural = film.offsetHeight;
    let s = natural > 0 ? avail / natural : 1;
    s = Math.max(0.2, Math.min(1, s));
    film.style.transform = s < 1 ? 'scale(' + s + ')' : '';
  });
}
fitCanvas();
window.addEventListener('resize', fitCanvas);


/* ──────────────────────────────────────────────────────────────
   데이터 로드 + 그룹핑
   ────────────────────────────────────────────────────────────── */
function slugOf(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'artist';
}

function getJSON(url) {
  return fetch(url, { headers: { 'Accept': 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
}

/* DB 는 디자인 이미지 경로를 "/images/..." 로 저장한다. 해당 정적 이미지는
   Vercel 정적 호스트에서 서빙되므로, 표시 직전 호스트 주소를 앞에 붙인다. */
function assetUrl(p) {
  return (p && p.indexOf('/images/') === 0)
    ? '' + p
    : p;
}

/* filmo[] → Map(artistId → [{category, categorySeq, years:[{year, titles:[]}]}]) */
function groupFilmo(filmos) {
  const byArtist = new Map();
  filmos.forEach(function (f) {
    if (!byArtist.has(f.artistId)) byArtist.set(f.artistId, new Map());
    const cats = byArtist.get(f.artistId);
    const key = (f.categorySeq != null ? f.categorySeq : 0);
    if (!cats.has(key)) cats.set(key, { category: f.category, categorySeq: key, years: new Map() });
    const cat = cats.get(key);
    const yr = (f.year != null ? f.year : 0);
    if (!cat.years.has(yr)) cat.years.set(yr, []);
    cat.years.get(yr).push(f);
  });

  const out = new Map();
  byArtist.forEach(function (cats, artistId) {
    const catArr = Array.from(cats.values()).sort(function (a, b) { return a.categorySeq - b.categorySeq; });
    catArr.forEach(function (c) {
      c.yearArr = Array.from(c.years.entries())
        .sort(function (a, b) { return b[0] - a[0]; })          // 연도 내림차순
        .map(function (e) {
          const items = e[1].sort(function (x, y) { return (x.sequence || 0) - (y.sequence || 0); });
          return { year: e[0], titles: items.map(function (i) { return i.title; }) };
        });
    });
    out.set(artistId, catArr);
  });
  return out;
}


/* ──────────────────────────────────────────────────────────────
   DOM 헬퍼
   ────────────────────────────────────────────────────────────── */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* 데스크탑 필모: .ent2-film 안에 섹션(.ent2-cat) 채우기 */
function fillDesktopFilmo(filmRoot, cats) {
  filmRoot.innerHTML = '';
  (cats || []).forEach(function (c) {
    const sec  = el('div', 'ent2-cat');
    sec.appendChild(el('div', 'ent2-cat-label', c.category));
    const list = el('div', 'ent2-cat-list');
    c.yearArr.forEach(function (y) {
      const entry = el('div', 'ent2-entry');
      entry.appendChild(el('div', 'ent2-entry-year', String(y.year)));
      const works = el('div', 'ent2-entry-works');
      y.titles.forEach(function (t) { works.appendChild(el('span', null, t)); });
      entry.appendChild(works);
      list.appendChild(entry);
    });
    sec.appendChild(list);
    filmRoot.appendChild(sec);
  });
}

/* 모바일 필모: .mo-art-film 안에 섹션(.mo-art-cat) 채우기 */
function fillMobileFilmo(filmRoot, cats) {
  filmRoot.innerHTML = '';
  (cats || []).forEach(function (c) {
    const sec = el('div', 'mo-art-cat');
    sec.appendChild(el('div', 'mo-art-cat-label', c.category));
    const list = el('div', 'mo-art-cat-list');
    c.yearArr.forEach(function (y) {
      const entry = el('div', 'mo-art-entry');
      entry.appendChild(el('span', 'mo-art-year', String(y.year)));
      const work = el('div', 'mo-art-work');
      y.titles.forEach(function (t) { work.appendChild(el('span', null, t)); });
      entry.appendChild(work);
      list.appendChild(entry);
    });
    sec.appendChild(list);
    filmRoot.appendChild(sec);
  });
}


/* ──────────────────────────────────────────────────────────────
   데스크탑 슬라이드 생성
   ────────────────────────────────────────────────────────────── */
function buildDesktop(artists, filmoMap) {
  const tpl = document.getElementById('deskArtistTpl');
  const auditionSlide = document.querySelector('.entertainment-slide.entertainment-6');
  if (!tpl || !auditionSlide) return;

  artists.forEach(function (art, idx) {
    const slide = tpl.content.firstElementChild.cloneNode(true);

    // 좌측 아티스트 선택 메뉴 (전체 이름, 현재 아티스트 활성)
    const menu = slide.querySelector('.ent2-menu');
    artists.forEach(function (a, i) {
      const name = el('span', 'ent2-menu-name' + (i === idx ? ' ent2-menu-active' : ''), a.name);
      name.addEventListener('click', function () { goTo(idx === i ? idx + 1 : i + 1, true); });
      menu.appendChild(name);
    });

    // 좌측 하단 정보
    setText(slide, '.ent2-bigname', art.name);
    setText(slide, '.ent2-date', art.birth);
    setText(slide, '.ent2-desc', art.description);
    setText(slide, '.ent2-subnav-name', art.name);

    // 포트레이트 + 썸네일 4장
    // 썸네일은 클릭 시 큰 자리(584×780)로 확대되므로, 저해상도 thumb(128×170) 대신
    // 같은 컷의 고해상도 모바일 이미지(360×480)를 우선 사용해 확대 화질을 개선한다.
    setImg(slide, '.ent2-img1 img', art.img, art.name);
    setImg(slide, '.ent2-thumb2 img', art.moThumb1 || art.thumb1);
    setImg(slide, '.ent2-thumb3 img', art.moThumb2 || art.thumb2);
    setImg(slide, '.ent2-thumb4 img', art.moThumb3 || art.thumb3);
    setImg(slide, '.ent2-thumb5 img', art.moThumb4 || art.thumb4);

    // 필모그라피
    fillDesktopFilmo(slide.querySelector('.ent2-film'), filmoMap.get(art.id));

    // 썸네일 클릭 → 큰 사진 자리로 슬라이드되며 교체 (데스크탑 전용)
    enableThumbSwap(slide);

    container.insertBefore(slide, auditionSlide);
  });
}


/* ──────────────────────────────────────────────────────────────
   데스크탑 — 썸네일 클릭 시 큰 사진과 자리 교체 (FLIP 애니메이션)
   클릭한 썸네일이 옆으로 슬라이드되며 큰 사진 자리로 커지고,
   기존 큰 사진은 그 썸네일 자리로 줄어든다. 모바일(≤768px)은 제외.
   ────────────────────────────────────────────────────────────── */
function rectOf(el) {
  /* .ent2-frame 기준 로컬 좌표 (캔버스 scale 영향 없음) */
  return { l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}

/* 자연 위치 `from`인 el을, transform으로 `to` 위치/크기에 겹쳐 보이게 */
function setFlip(el, from, to) {
  el.style.transformOrigin = 'top left';
  el.style.transform =
    'translate(' + (to.l - from.l) + 'px,' + (to.t - from.t) + 'px) ' +
    'scale(' + (to.w / from.w) + ',' + (to.h / from.h) + ')';
}

function enableThumbSwap(slide) {
  const main = slide.querySelector('.ent2-img1');
  if (!main) return;
  const thumbs = slide.querySelectorAll('.ent2-thumb2, .ent2-thumb3, .ent2-thumb4, .ent2-thumb5');
  let animating = false;

  thumbs.forEach(function (thumb) {
    thumb.classList.add('ent2-thumb-clickable');
    thumb.addEventListener('click', function () {
      if (window.innerWidth <= 768 || animating) return;
      const mImg = main.querySelector('img');
      const tImg = thumb.querySelector('img');
      if (!mImg || !tImg || !tImg.getAttribute('src')) return;
      animating = true;

      // FLIP: 이동 전 두 요소의 위치/크기 기록
      const a = rectOf(main);
      const b = rectOf(thumb);

      // 이미지 교체 (큰 사진 ↔ 클릭한 썸네일)
      const ms = mImg.src, mAlt = mImg.alt;
      mImg.src = tImg.src; mImg.alt = tImg.alt;
      tImg.src = ms;       tImg.alt = mAlt;

      // 시작 상태: 큰 사진은 썸네일 자리에서, 썸네일은 큰 사진 자리에서 출발
      setFlip(main, a, b);
      setFlip(thumb, b, a);
      main.style.zIndex = '30';
      thumb.style.zIndex = '29';

      // 다음 프레임에 제자리로 트랜지션 → 슬라이드 + 확대/축소
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          const ease = 'transform .6s cubic-bezier(.22,.61,.36,1)';
          main.style.transition = ease;
          thumb.style.transition = ease;
          main.style.transform = 'none';
          thumb.style.transform = 'none';
        });
      });

      let done = 0;
      function cleanup(e) {
        if (e && e.target !== main && e.target !== thumb) return;
        if (++done < 2) return;
        [main, thumb].forEach(function (el) {
          el.style.transition = '';
          el.style.transform = '';
          el.style.transformOrigin = '';
          el.style.zIndex = '';
        });
        main.removeEventListener('transitionend', cleanup);
        thumb.removeEventListener('transitionend', cleanup);
        animating = false;
      }
      main.addEventListener('transitionend', cleanup);
      thumb.addEventListener('transitionend', cleanup);
      // 안전장치: 트랜지션 이벤트 누락 시 강제 정리
      setTimeout(function () { if (animating) { done = 1; cleanup(null); } }, 800);
    });
  });
}


/* ──────────────────────────────────────────────────────────────
   모바일 뷰 + 드롭다운 항목 생성
   ────────────────────────────────────────────────────────────── */
function buildMobile(artists, filmoMap) {
  const tpl = document.getElementById('moArtistTpl');
  const ddMenu = document.querySelector('.mo-ent-dropdown-menu');
  const auditionView = document.querySelector('.mo-ent-view--audition');
  if (!tpl || !ddMenu || !auditionView) return;

  artists.forEach(function (art, idx) {
    const view = tpl.content.firstElementChild.cloneNode(true);
    const slug = slugOf(art.name);
    view.setAttribute('data-view', slug);

    // 인물 사진 (대표 + 모바일 슬라이드 4장)
    const photo = view.querySelector('.mo-art-photo');
    [art.img, art.moThumb1, art.moThumb2, art.moThumb3, art.moThumb4].forEach(function (src, i) {
      if (!src) return;
      const im = el('img', i === 0 ? 'is-active' : null);
      im.src = assetUrl(src);
      im.alt = art.name;
      photo.appendChild(im);
    });
    // 인디케이터 점은 슬라이드쇼 초기화가 사진 수에 맞춰 생성한다.

    setText(view, '.mo-art-name', art.name);
    setText(view, '.mo-art-birth', art.birth);
    setText(view, '.mo-art-desc', art.description);
    fillMobileFilmo(view.querySelector('.mo-art-film'), filmoMap.get(art.id));

    auditionView.parentNode.insertBefore(view, auditionView);

    // 드롭다운 항목
    const li = document.createElement('li');
    const btn = el('button', 'mo-ent-dropdown-item' + (idx === 0 ? ' is-active' : ''), art.name);
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.setAttribute('data-view', slug);
    li.appendChild(btn);
    ddMenu.appendChild(li);
  });
}

function setText(root, sel, text) {
  const n = root.querySelector(sel);
  if (n) n.textContent = (text != null ? text : '');
}
function setImg(root, sel, src, alt) {
  const n = root.querySelector(sel);
  if (n && src) { n.src = assetUrl(src); if (alt != null) n.alt = alt; }
}

/* 인트로 슬라이드의 페이지 인디케이터 점을 슬라이드 수에 맞춤 */
function buildIndicator(total) {
  const ind = document.querySelector('.slide-indicator');
  if (!ind) return;
  ind.innerHTML = '';
  for (let i = 0; i < total; i++) {
    ind.appendChild(el('div', 'slide-dot' + (i === 0 ? ' active' : '')));
  }
}


/* ──────────────────────────────────────────────────────────────
   슬라이드 스크롤 (한 번에 한 슬라이드) — 생성 후 TOTAL 확정
   ────────────────────────────────────────────────────────────── */
let current = 0;
let locked  = false;
let timer   = null;
let TOTAL   = 1;

function unlock() { locked = false; }

function goTo(index, instant) {
  if (locked) return;
  index = Math.max(0, Math.min(TOTAL - 1, index));
  locked  = true;
  current = index;
  container.scrollTo({ left: current * SLIDE_W, behavior: instant ? 'auto' : 'smooth' });
  clearTimeout(timer);
  timer = setTimeout(unlock, instant ? 0 : 1500);
}

/* 다른 페이지(메인 GNB 서브메뉴)에서 #artist / #audition 으로 진입 시
   해당 슬라이드(데스크탑) 또는 뷰(모바일)로 이동한다. */
function navFromHash(fromTop) {
  const key = (location.hash || '').replace('#', '');
  if (key !== 'artist' && key !== 'audition') return;

  if (window.matchMedia('(max-width: 768px)').matches) {
    // 모바일: Audition 만 탭 전환이 필요(Artist 는 기본 노출 뷰)
    if (key === 'audition') {
      const btn = document.querySelector('.mo-ent-tab-item--audition');
      if (btn) btn.click();
    }
    return;
  }

  const slides = Array.from(document.querySelectorAll('.entertainment-slide'));
  const cls = key === 'audition' ? 'entertainment-6' : 'entertainment-artist';
  let target = slides.findIndex((s) => s.classList.contains(cls));
  if (target < 0) target = 0;

  if (fromTop) {
    // 다른 페이지에서 진입(최초 로드): 맨 앞(슬라이드 0)에서 시작해
    // 해당 섹션까지 부드럽게 스크롤(About 처럼).
    current = 0;
    container.scrollLeft = 0;
    requestAnimationFrame(function () { goTo(target); });
  } else {
    // 같은 페이지에서 nav 클릭(해시 변경): 현재 위치에서 부드럽게.
    goTo(target);
  }
}

function initScroll() {
  TOTAL = document.querySelectorAll('.entertainment-slide').length || 1;

  container.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (locked) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    const target = Math.max(0, Math.min(TOTAL - 1, current + dir));
    if (target !== current) goTo(target);
  }, { passive: false });

  container.addEventListener('scrollend', function () {
    clearTimeout(timer);
    timer = setTimeout(unlock, 400);
  });
}


/* ──────────────────────────────────────────────────────────────
   데스크탑 — 상단 ARTIST / AUDITION 탭 클릭 시 해당 슬라이드로 이동
   모든 슬라이드의 .tab .tab-item 에 위임 처리(동적 생성 슬라이드 포함).
   ────────────────────────────────────────────────────────────── */
function slideIndexOf(cls) {
  const slides = Array.from(document.querySelectorAll('.entertainment-slide'));
  const idx = slides.findIndex(function (s) { return s.classList.contains(cls); });
  return idx < 0 ? 0 : idx;
}

function initTabNav() {
  container.addEventListener('click', function (e) {
    const tab = e.target.closest('.tab .tab-item');
    if (!tab) return;
    const label = (tab.textContent || '').trim().toUpperCase();
    if (label === 'AUDITION') {
      goTo(slideIndexOf('entertainment-6'));
    } else if (label === 'ARTIST') {
      goTo(slideIndexOf('entertainment-artist'));
    }
  });
}


/* ──────────────────────────────────────────────────────────────
   모바일 — 탭 드롭다운으로 아티스트 뷰 전환
   ────────────────────────────────────────────────────────────── */
function initMobileDropdown() {
  const dd = document.getElementById('moEntDropdown');
  if (!dd) return;

  const btn   = dd.querySelector('.mo-ent-tab-item--dropdown');
  const label = document.getElementById('moEntTabLabel');
  const items = dd.querySelectorAll('.mo-ent-dropdown-item');
  const views = document.querySelectorAll('.mo-ent-view');
  const auditionBtn = document.querySelector('.mo-ent-tab-item--audition');

  function setOpen(open) {
    dd.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function showView(view) {
    const target = document.querySelector('.mo-ent-view[data-view="' + view + '"]');
    if (!target) return false;
    views.forEach(function (v) { v.hidden = (v !== target); });
    window.scrollTo({ top: 0 });
    return true;
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(!dd.classList.contains('is-open'));
  });

  items.forEach(function (item) {
    item.addEventListener('click', function () {
      setOpen(false);
      if (!showView(item.dataset.view)) return;
      label.textContent = item.textContent.trim();
      dd.classList.add('is-artist');
      if (auditionBtn) auditionBtn.classList.remove('is-active');
      items.forEach(function (i) { i.classList.toggle('is-active', i === item); });
    });
  });

  if (auditionBtn) {
    auditionBtn.addEventListener('click', function () {
      setOpen(false);
      if (!showView('audition')) return;
      label.textContent = 'ARTIST';
      dd.classList.remove('is-artist');
      auditionBtn.classList.add('is-active');
    });
  }

  document.addEventListener('click', function (e) {
    if (!dd.contains(e.target)) setOpen(false);
  });
}


/* ──────────────────────────────────────────────────────────────
   모바일 — 아티스트 인물 사진 슬라이드 (자동 전환 없음, 스와이프로 넘김)
   ────────────────────────────────────────────────────────────── */
function initMobileSlideshow() {
  const views = document.querySelectorAll('.mo-ent-view--artist');
  if (!views.length) return;

  function setActive(view, idx) {
    const imgs = view._imgs, dots = view._dots;
    if (!imgs.length) return;
    idx = ((idx % imgs.length) + imgs.length) % imgs.length;
    view._idx = idx;
    // 현재 사진은 제자리(0), 이전 사진은 왼쪽(-100%), 다음 사진은 오른쪽(100%)으로
    // 밀어 한 줄로 늘어놓는다 → 인덱스가 바뀌면 가로로 슬라이드된다.
    imgs.forEach(function (im, i) {
      im.classList.toggle('is-active', i === idx);
      im.style.transform = 'translateX(' + ((i - idx) * 100) + '%)';
    });
    dots.forEach(function (d, i) { d.classList.toggle('mo-art-dot--active', i === idx); });
  }

  views.forEach(function (view) {
    view._imgs = view.querySelectorAll('.mo-art-photo img');
    const ind = view.querySelector('.mo-art-indicator');
    if (ind) {
      ind.innerHTML = '';
      view._imgs.forEach(function (im, i) {
        const d = document.createElement('span');
        d.className = 'mo-art-dot' + (i === 0 ? ' mo-art-dot--active' : '');
        d.addEventListener('click', function () { setActive(view, i); });
        ind.appendChild(d);
      });
    }
    view._dots = view.querySelectorAll('.mo-art-dot');
    view._idx  = 0;
    setActive(view, 0);

    // 터치 스와이프: 좌→우(다음), 우→좌(이전). 가로 이동이 세로보다 클 때만 처리.
    const photo = view.querySelector('.mo-art-photo');
    if (photo && view._imgs.length > 1) {
      let startX = 0, startY = 0, tracking = false;
      const THRESHOLD = 40;   // px
      photo.addEventListener('touchstart', function (e) {
        const t = e.changedTouches[0];
        startX = t.clientX; startY = t.clientY; tracking = true;
      }, { passive: true });
      photo.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX, dy = t.clientY - startY;
        if (Math.abs(dx) < THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
        setActive(view, view._idx + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }
  });
}


/* ──────────────────────────────────────────────────────────────
   지원서 다운로드 — 데스크탑/모바일 버튼 모두 오디션 지원서 PDF 내려받기
   ────────────────────────────────────────────────────────────── */
function initDownloadButtons() {
  const PDF_URL   = '/files/audition_application.docx';
  const FILE_NAME = '링컴즈_오디션_지원서.docx';
  const btns = document.querySelectorAll('.ent6-btn-download, .moa-btn--download');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const a = document.createElement('a');
      a.href = PDF_URL;
      a.download = FILE_NAME;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  });
}


/* ──────────────────────────────────────────────────────────────
   부트스트랩
   ────────────────────────────────────────────────────────────── */
function init() {
  Promise.all([
    getJSON('/api/artist/publicList'),
    getJSON('/api/artistfilmo/publicList')
  ]).then(function (res) {
    const artists = (res[0] || []).slice().sort(function (a, b) {
      return (a.sequence || 0) - (b.sequence || 0) || (a.id - b.id);
    });
    const filmoMap = groupFilmo(res[1] || []);

    buildDesktop(artists, filmoMap);
    buildMobile(artists, filmoMap);
    buildIndicator(document.querySelectorAll('.entertainment-slide').length);
    fitCanvas();   /* 슬라이드 생성 후 필모/이미지 세로 맞춤 재계산 */
  }).catch(function (e) {
    console.error('[entertainment] 아티스트 로드 실패:', e);
  }).finally(function () {
    initScroll();
    initTabNav();
    initMobileDropdown();
    initMobileSlideshow();
    initDownloadButtons();
    if (location.hash) requestAnimationFrame(function () { navFromHash(true); });
    window.addEventListener('hashchange', function () { navFromHash(false); });
  });
}

init();
