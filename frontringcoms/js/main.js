const wrapper = document.querySelector('.horizontal-wrapper');
const panels = [...document.querySelectorAll('.panel')];
const aboutInner = document.querySelector('.about-inner');
const aboutLocation = document.querySelector('.about-location');
const visionInner = document.querySelector('.vision-inner');
const mcnInner = document.querySelector('.mcn-inner');
const fixedUI = document.querySelector('.fixed-ui');
const brandOverlay = document.getElementById('brandTransitionOverlay');
const brandFilmVideo = document.getElementById('brandFilmVideo');       // 패널(정착 상태) 영상
const brandOverlayVideo = document.getElementById('brandOverlayVideo'); // 확대 전환 중 영상

// 영상 안전 재생/정지 헬퍼 (autoplay 정책상 play() 가 거부될 수 있으므로 catch)
function playVideoFromStart(v) {
  if (!v) return;
  try { v.currentTime = 0; } catch (e) {}
  const p = v.play();
  if (p && p.catch) p.catch(() => {});
}
const ABOUT_INDEX   = panels.findIndex(p => p.classList.contains('panel-about'));
const VISION_INDEX  = panels.findIndex(p => p.classList.contains('panel-vision'));
const MCN_INDEX     = panels.findIndex(p => p.classList.contains('panel-mcn'));
const ENTERTAINMENT_INDEX = panels.findIndex(p => p.classList.contains('panel-entertainment'));
const BRAND_INDEX   = panels.findIndex(p => p.classList.contains('panel-brand-film'));
const CONTACT_INDEX = panels.findIndex(p => p.classList.contains('panel-contact'));
const COSMETICS_INDEX = panels.findIndex(p => p.classList.contains('panel-cosmetics'));
const CAREER_INDEX = panels.findIndex(p => p.classList.contains('panel-career'));

// Career 패널(iframe)은 자체 career.js 가 세로 스크롤/페이징을 담당한다.
// career 맨 위에서 위로 스크롤하면 iframe 이 'career:prev' 를 보내오고,
// 그때만 이전 패널(Business Contact)로 슬라이드해 되돌아간다.
window.addEventListener('message', (e) => {
  if (e.data === 'career:prev' && panelIndex === CAREER_INDEX) onScrollUp();
});
// 문의 폼 영역(우측, 세로 스크롤) 위에서 일어난 입력인지 — 그렇다면 패널(좌우)
// 이동에 관여하지 않고 폼만 세로 스크롤되도록 분리한다.
function isInContactForm(target) {
  return !!(target && target.closest && target.closest('.contact-form-wrap'));
}
// 데스크탑 비즈니스 문의 폼에 한 글자라도 입력됐는지 — 이탈(이전 패널 이동) 시 확인용
function contactHasInput() {
  const dc = document.querySelector('.contact-form');
  if (!dc) return false;
  return [...dc.querySelectorAll('.cf-input, .cf-textarea')]
    .some((f) => f.value && f.value.trim() !== '');
}
const ABOUT_SUB_COUNT  = 3;
// Location(마지막 sub)은 스크롤로 진입하지 않고 좌측 'Location' 메뉴 클릭으로만 연다.
// 스크롤로 도달 가능한 마지막 sub = history(1).
const ABOUT_SCROLL_MAX_SUB = ABOUT_SUB_COUNT - 2;
const VISION_SUB_COUNT = 1;
const MCN_SUB_COUNT    = 1;

let panelIndex = 0;
let aboutSubIndex = 0;
let visionSubIndex = 0;
let mcnSubIndex = 0;
let isAnimating = false;

/* ── 패널 이미지 미리 디코딩 (슬라이드 렉 방지) ──
   vision/brand-film(4096px·9.5MB), about/disc(4096×4096) 등 대용량 이미지는
   해당 패널이 처음 화면에 들어오는 순간 디코딩되는데, 디코딩이 한 프레임을 넘겨
   "한 칸 넘어갈 때마다" 끊김이 생긴다. 로드 후 한가한 시점(idle)에 패널 순서대로
   미리 디코딩해 비트맵을 캐시에 올려두면 전환은 합성(composite)만 하므로 부드러워진다. */
(function warmDecodePanelImages() {
  const imgs = panels.flatMap((p) => [...p.querySelectorAll('img')]);
  if (!imgs.length) return;
  const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 0 }), 1));
  let i = 0;
  function decodeNext() {
    if (i >= imgs.length) return;
    const img = imgs[i++];
    const done = () => idle(decodeNext);
    // decode()는 비트맵 디코딩을 메인 스레드 밖에서 미리 끝내준다(실패해도 무시).
    if (img.decode) img.decode().then(done, done);
    else done();
  }
  const start = () => idle(decodeNext);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();

const BRAND_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';
const BRAND_DUR  = '0.85s';
// width/height 애니메이션 → object-fit:cover 가 매 프레임 재계산되어 프레이밍이
// 점진적으로 바뀜. 카드(전체 이미지)에서 시작해 풀스크린 크롭으로 자연스럽게 이어짐.
const BRAND_TRANS =
  `top ${BRAND_DUR} ${BRAND_EASE}, left ${BRAND_DUR} ${BRAND_EASE}, ` +
  `width ${BRAND_DUR} ${BRAND_EASE}, height ${BRAND_DUR} ${BRAND_EASE}, ` +
  `border-radius ${BRAND_DUR} ${BRAND_EASE}`;

// Vision 카드의 실제 화면 위치/크기 (getBoundingClientRect = 뷰포트 기준)
function getVisionCardRect() {
  const imgWrap = panels[VISION_INDEX]?.querySelector('.vision-img-wrap');
  return imgWrap ? imgWrap.getBoundingClientRect() : null;
}

// 오버레이를 카드 크기 / 풀스크린 상태로 (transition 은 호출 측에서 제어)
function setOverlayToCard(r) {
  brandOverlay.style.top          = r.top + 'px';
  brandOverlay.style.left         = r.left + 'px';
  brandOverlay.style.width        = r.width + 'px';
  brandOverlay.style.height       = r.height + 'px';
  brandOverlay.style.borderRadius = '20px';
}
// 콘텐츠 프레임(fill-width 스케일된 1920×1080 스테이지)의 화면상 사각형.
// 브랜드 필름은 이 프레임 크기에 맞춰 확대된다 — 확대 완료 시 그 자리에 등장하는
// brand-film 패널과 정확히 일치하도록 .content-stage 와 동일한 fill-width 스케일(vw/1920)을 쓴다.
// (예전엔 cover=max(vw/1920,vh/1080) 였으나, 스테이지가 fill-width 로 바뀐 뒤로는
//  16:9 보다 세로로 긴 창에서 오버레이만 화면 전체로 과확대되어 정착 패널(가로 밴드)과 어긋났다.)
function getStageRect() {
  const scale = window.innerWidth / 1920;   // .content-stage 의 --mcn-scale 과 동일
  const w = window.innerWidth;              // 폭을 꽉 채움(mcn-x = 0)
  const h = 1080 * scale;
  return {
    left: 0,
    top:  (window.innerHeight - h) / 2,     // --mcn-y = (vh - 1080*scale)/2
    width: w,
    height: h,
  };
}
// 오버레이를 콘텐츠 프레임 크기로 확장 (전체 화면이 아니라 스테이지 영역에 맞춤)
function setOverlayToFull() {
  const s = getStageRect();
  brandOverlay.style.top          = s.top + 'px';
  brandOverlay.style.left         = s.left + 'px';
  brandOverlay.style.width        = s.width + 'px';
  brandOverlay.style.height       = s.height + 'px';
  brandOverlay.style.borderRadius = '0px';
}
function hideBrandOverlay() {
  if (brandOverlayVideo) brandOverlayVideo.pause();
  brandOverlay.style.transition   = 'none';
  brandOverlay.style.opacity      = '0';
  brandOverlay.style.top          = '';
  brandOverlay.style.left         = '';
  brandOverlay.style.width        = '';
  brandOverlay.style.height       = '';
  brandOverlay.style.borderRadius = '';
}

// wrapper 를 transition 없이 즉시 점프 (강제 reflow 로 슬라이드 방지)
function jumpWrapperTo(index) {
  wrapper.style.transition = 'none';
  wrapper.style.transform  = `translateX(-${index * 1920}px)`;
  void wrapper.offsetWidth;           // 강제 reflow → transition 없는 상태로 즉시 커밋
  wrapper.style.transition = '';
}

// 정방향: 카드 → 풀스크린 확장 (Vision 패널 위에서 카드가 자라남)
// 내부 이미지는 object-fit:cover 이므로 박스가 커지면 이미지도 함께 자라남
function brandExpand() {
  if (!brandOverlay) return;
  const r = getVisionCardRect();
  if (!r) return;

  brandOverlay.style.transition = 'none';
  setOverlayToCard(r);
  brandOverlay.style.opacity = '1';
  playVideoFromStart(brandOverlayVideo);   // 확대되는 동안 영상 재생

  // double RAF — 초기 상태가 실제 페인트된 후 풀스크린으로 확장
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      brandOverlay.style.transition = BRAND_TRANS;
      setOverlayToFull();
    });
  });

  setTimeout(hideBrandOverlay, 980);
}

// 역방향: 풀스크린 → 카드 축소 (호출 전에 wrapper 가 Vision 으로 점프되어 있어야 함)
function brandShrink() {
  if (!brandOverlay) return;
  const r = getVisionCardRect();
  if (!r) return;

  brandOverlay.style.transition = 'none';
  setOverlayToFull();
  brandOverlay.style.opacity = '1';
  playVideoFromStart(brandOverlayVideo);   // 축소되는 동안에도 영상 재생

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      brandOverlay.style.transition = BRAND_TRANS;
      setOverlayToCard(r);
    });
  });

  setTimeout(hideBrandOverlay, 980);
}

function updateScrollProgress(nextPanel) {
  const el = document.getElementById('scrollProgress');
  if (!el) return;
  // Brand Film(panel 1)은 풀스크린 전환용 패널이라 진행바를 숨김 →
  // 진행바 단계에서 제외하고, 그 이후 패널은 한 단계씩 당겨서 표시.
  const step = nextPanel > BRAND_INDEX ? nextPanel - 1 : nextPanel;
  // 패널당 14px: KV=0px, BrandFilm 제외, About=14px, Vision=28px, Entertainment=42px …
  el.style.width = (step * 14) + 'px';
}

function updateFixedUI(nextPanel, nextSub) {
  fixedUI.dataset.panel = nextPanel;

  // MCN 패널: 세 번째(다크 배경 C)만 남음 — 기본(흰색) 푸터/스크롤/로고 색상 유지
  delete fixedUI.dataset.mcnSub;

  // About 사이드 메뉴 active 토글 (슬라이드 중간 시점)
  if (nextPanel === ABOUT_INDEX) {
    setTimeout(() => {
      const items = fixedUI.querySelectorAll('.side-menu p');
      items.forEach((el, i) => {
        el.className = i === nextSub ? 'side-active' : 'side-inactive';
      });
    }, 400);
  }

  // Location(밝은 배경) 활성 시에만 고정 UI(로고·좌측 메뉴·SCROLL·푸터)를 차콜로 전환.
  // 위치/크기/폰트는 그대로(.theme-light 는 색상만 바꿈), 벗어나면 자동 해제되어 흰색 복귀.
  const isLocation = nextPanel === ABOUT_INDEX && nextSub === ABOUT_SUB_COUNT - 1;
  fixedUI.classList.toggle('theme-light', isLocation);
  if (aboutLocation) {
    if (isLocation) {
      // 섹션이 자리에 들어오는 시점에 맞춰 진입 애니메이션(opacity+translateY) 트리거
      setTimeout(() => {
        if (panelIndex === ABOUT_INDEX && aboutSubIndex === ABOUT_SUB_COUNT - 1) {
          aboutLocation.classList.add('is-active');
        }
      }, 420);
    } else {
      aboutLocation.classList.remove('is-active');
    }
  }

  updateScrollProgress(nextPanel);
}

// 브랜드 필름 영상 프리로드: brandFilm/overlay 가 같은 파일(index.mp4)을 쓰므로 둘이
// 동시에 받으면 캐시 재사용이 안 돼 중복 다운로드가 된다. brandFilm 을 먼저 받아 캐시를
// 채운 뒤 overlay 가 그 캐시를 재사용하도록 '순차'로 로드한다. PC 에서만(모바일은 자기
// 영상만 따로 로드). 모바일→PC 전환 케이스 대비: 모바일이면 플래그를 세우지 않고 통과시켜
// 이후 PC 로 전환해 비전에 도달하면 다시 시도되게 한다.
let brandVideosPreloaded = false;
function preloadBrandVideos() {
  if (brandVideosPreloaded || !brandFilmVideo) return;
  if (isMobileView()) return;                 // 모바일이면 아직 받지 않음(나중에 재시도)
  brandVideosPreloaded = true;
  brandFilmVideo.preload = 'auto';
  brandFilmVideo.load();
  if (brandOverlayVideo) {
    let overlayStarted = false;
    const startOverlay = () => {
      if (overlayStarted) return;
      overlayStarted = true;
      brandOverlayVideo.preload = 'auto';
      brandOverlayVideo.load();               // brandFilm 캐시가 생긴 뒤 시작 → 중복 다운로드 회피
    };
    brandFilmVideo.addEventListener('loadeddata', startOverlay, { once: true });
    setTimeout(startOverlay, 5000);           // loadeddata 가 안 와도 결국 받도록 안전망
  }
}

function goTo(nextPanel, nextSub = 0) {
  if (isAnimating) return;
  isAnimating = true;

  const prevPanel = panelIndex;
  panelIndex = nextPanel;
  if (panelIndex === ABOUT_INDEX)  aboutSubIndex  = nextSub;
  if (panelIndex === VISION_INDEX) visionSubIndex = nextSub;
  if (panelIndex === MCN_INDEX)    mcnSubIndex    = nextSub;

  // 비전/브랜드 패널에 도달하면 브랜드 영상을 미리(순차로) 받아둔다 — 진입 시 버퍼링 완화
  if (panelIndex === VISION_INDEX || panelIndex === BRAND_INDEX) preloadBrandVideos();

  if (nextPanel === BRAND_INDEX && prevPanel === VISION_INDEX) {
    // 정방향 Vision → Brand Film: 카드가 풀스크린으로 확장.
    // wrapper 는 Vision 패널에 그대로 둔 채(목적지 풀스크린이 먼저 보이지 않도록)
    // 카드가 화면을 다 덮은 뒤에야 그 아래에서 Brand Film 로 즉시 점프한다.
    brandExpand();
    setTimeout(() => {
      jumpWrapperTo(BRAND_INDEX); // 풀스크린 오버레이 뒤에서 슬라이드 없이 즉시 이동
    }, 920); // 확장(double RAF + 0.85s ≈ 882ms) 완료 후, 오버레이 제거(980ms) 전
  } else if (nextPanel === VISION_INDEX && prevPanel === BRAND_INDEX) {
    // 역방향 Brand Film → Vision: 풀스크린이 카드로 축소.
    // ① 오버레이를 풀스크린으로 즉시 띄워 Brand Film 을 덮고
    // ② 그 아래에서 wrapper 를 Vision 으로 즉시 점프시킨 뒤
    // ③ 오버레이를 카드 크기로 축소 → Vision 패널이 드러남
    brandOverlay.style.transition = 'none';
    setOverlayToFull();
    brandOverlay.style.opacity = '1';
    jumpWrapperTo(VISION_INDEX);
    brandShrink();
  } else {
    wrapper.style.transform = `translateX(-${panelIndex * 1920}px)`;
  }

  // 현재 패널에만 panel-active 부여 (brand-film 확대 애니메이션 트리거)
  panels.forEach((p, i) => p.classList.toggle('panel-active', i === panelIndex));

  // Brand Film 패널 영상: 확대로 진입하는 순간부터 재생, 떠나면 정지.
  // 처음부터 소리 켜서 재생을 시도하고(클릭으로 들어온 사용자는 정책상 허용),
  // 사용자 동작이 없어 거부되면 무음으로 폴백해 영상만이라도 재생한다.
  if (brandFilmVideo) {
    if (panelIndex === BRAND_INDEX) {
      try { brandFilmVideo.currentTime = 0; } catch (e) {}
      brandFilmVideo.muted = false;
      const p = brandFilmVideo.play();
      if (p && p.catch) p.catch(() => {
        brandFilmVideo.muted = true;
        brandFilmVideo.play().catch(() => {});
      });
    } else {
      brandFilmVideo.pause();
    }
  }

  // 해당 패널에 있을 때만 내부 이동 (떠날 때 건드리지 않음 → 글리치 방지)
  if (aboutInner && panelIndex === ABOUT_INDEX) {
    aboutInner.style.transform = `translateY(-${aboutSubIndex * 1080}px)`;
  }
  if (visionInner && panelIndex === VISION_INDEX) {
    visionInner.style.transform = `translateY(-${visionSubIndex * 1080}px)`;
  }
  if (mcnInner && panelIndex === MCN_INDEX) {
    mcnInner.style.transform = `translateY(-${mcnSubIndex * 1080}px)`;
    panels[MCN_INDEX].dataset.sub = mcnSubIndex;   // 고정 타이틀 색 전환용
  }

  updateFixedUI(panelIndex, aboutSubIndex);

  setTimeout(() => { isAnimating = false; }, 900);
}

// 명시적 이동(메뉴/로고/해시 딥링크)은 슬라이드 잠금(isAnimating) 중이면 goTo 가
// 조용히 무시돼 "눌러도 안 가는" 문제가 생긴다(예: 폴더블 펼침 직후 로고→히어로
// 전환 900ms 안에 햄버거의 Cosmetics 를 누르면 KV 화면에 그대로 멈춤). 스크롤 한
// 칸 이동과 달리 메뉴 선택은 버려지면 안 되므로, 잠금이 풀릴 때까지 기다렸다가 실행한다.
// (가장 최근에 요청된 이동만 살린다 — 여러 번 눌러도 마지막 것으로 수렴.)
let pendingNavTimer = null;
function navWhenReady(fn) {
  if (!isAnimating) { fn(); return; }
  if (pendingNavTimer) clearInterval(pendingNavTimer);
  let waited = 0;
  pendingNavTimer = setInterval(() => {
    waited += 50;
    if (!isAnimating) { clearInterval(pendingNavTimer); pendingNavTimer = null; fn(); }
    else if (waited >= 2000) { clearInterval(pendingNavTimer); pendingNavTimer = null; }  // 안전망
  }, 50);
}

// 폴더블 펼침(모바일 기기의 PC 버전)에서는 맨 끝 Career 패널(iframe /career)을
// 노출하지 않는다 — Business Contact 가 마지막. 실제 데스크탑 PC 에는 영향 없음
// (isFoldablePc 는 600~768 세로형에서만 true → 그 외에는 기존대로 Career 까지 이동).
function lastNavPanel() {
  if (CAREER_INDEX >= 0 && window.isFoldablePc && window.isFoldablePc()) return CAREER_INDEX - 1;
  return panels.length - 1;
}

function onScrollDown() {
  if (panelIndex === ABOUT_INDEX && aboutSubIndex < ABOUT_SCROLL_MAX_SUB) {
    goTo(ABOUT_INDEX, aboutSubIndex + 1);
  } else if (panelIndex === VISION_INDEX && visionSubIndex < VISION_SUB_COUNT - 1) {
    goTo(VISION_INDEX, visionSubIndex + 1);
  } else if (panelIndex === MCN_INDEX && mcnSubIndex < MCN_SUB_COUNT - 1) {
    goTo(MCN_INDEX, mcnSubIndex + 1);
  } else if (panelIndex < lastNavPanel()) {
    goTo(panelIndex + 1, 0);
  }
}

function onScrollUp() {
  if (panelIndex === ABOUT_INDEX && aboutSubIndex > 0) {
    goTo(ABOUT_INDEX, aboutSubIndex - 1);
  } else if (panelIndex === VISION_INDEX && visionSubIndex > 0) {
    goTo(VISION_INDEX, visionSubIndex - 1);
  } else if (panelIndex === MCN_INDEX && mcnSubIndex > 0) {
    goTo(MCN_INDEX, mcnSubIndex - 1);
  } else if (panelIndex > 0) {
    // 비즈니스 문의 패널에서 위로 나갈 때, 작성 중인 내용이 있으면 이탈 확인
    if (panelIndex === CONTACT_INDEX && contactHasInput()) {
      if (!window.confirm('작성 중인 문의 내용이 있습니다. 페이지를 벗어나시겠습니까?')) return;
    }
    const prevIsAbout  = panelIndex - 1 === ABOUT_INDEX;
    const prevIsVision = panelIndex - 1 === VISION_INDEX;
    const prevIsMcn    = panelIndex - 1 === MCN_INDEX;
    const prevSub = prevIsAbout  ? ABOUT_SCROLL_MAX_SUB
                  : prevIsVision ? VISION_SUB_COUNT - 1
                  : prevIsMcn    ? MCN_SUB_COUNT    - 1
                  : 0;
    goTo(panelIndex - 1, prevSub);
  }
}

// 관성 스크롤 대응: 한 번의 스크롤 제스처 = 한 번의 이동. (entertainment.js 방식)
// 첫 이벤트만 처리하고 잠근 뒤, 슬라이드가 정착할 고정 시간 후에만 해제한다.
// 잠겨 있는 동안 들어오는 관성 이벤트는 무시할 뿐 잠금을 "연장하지 않는다".
// 모바일(≤768px)에서는 가로 패널 내비게이션을 끄고 일반 세로 스크롤을 사용한다.
// 단, 폴더블 펼침(가로 600~768 + 세로형)은 PC 버전(가로 패널)이므로 모바일에서 제외.
const isMobileView = () => window.matchMedia('(max-width: 768px) and (not ((min-width: 600px) and (orientation: portrait)))').matches;

let wheelLocked = false;
let wheelTimer = null;
window.addEventListener('wheel', (e) => {
  if (isMobileView()) return;
  // SKINEGO 팝업이 열려 있으면 배경(메인) 페이지 전환을 막는다 — 스크롤은 팝업이 처리.
  const skPopup = document.getElementById('skinegoPopup');
  if (skPopup && skPopup.classList.contains('is-open')) return;
  // 문의 폼 영역 위에서의 휠은 항상 폼 세로 스크롤만 — 섹션(좌우) 이동 없음.
  // (터치 핸들러의 폼 처리와 동일하게, 위/아래·스크롤 위치와 무관하게 패널 이동을 막는다.
  //  이전/다음 섹션 이동은 좌측 다크 박스 영역이나 CTA·메뉴로 한다.)
  if (isInContactForm(e.target)) return;
  if (wheelLocked) return;
  wheelLocked = true;

  if (e.deltaY > 0) onScrollDown();
  else if (e.deltaY < 0) onScrollUp();

  // 슬라이드 전환(약 0.9s) + 남은 관성 흡수용 버퍼 후 한 번만 해제
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { wheelLocked = false; }, 1000);
}, { passive: true });

let touchStartX = 0;
let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
  if (isMobileView()) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (isMobileView()) return;
  // SKINEGO 팝업이 열려 있으면 스와이프로 배경(메인) 패널이 넘어가지 않게 막는다 — X 닫기 전까지.
  const skPopup = document.getElementById('skinegoPopup');
  if (skPopup && skPopup.classList.contains('is-open')) return;
  const dx = touchStartX - e.changedTouches[0].clientX;
  const dy = touchStartY - e.changedTouches[0].clientY;
  // 문의 폼 영역 위 세로 스와이프는 폼 스크롤만 — 패널 이동 안 함
  if (isInContactForm(e.target) && Math.abs(dy) > Math.abs(dx)) return;
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
    if (dy > 0) onScrollDown(); else onScrollUp();
  } else if (Math.abs(dx) > 50) {
    if (dx > 0) onScrollDown(); else onScrollUp();
  }
}, { passive: true });

// 클릭으로도 영상 재생 — 스크롤(휠/터치) 동작은 그대로 두고, Vision 패널에서 화면을
// 클릭하면 스크롤다운과 동일하게 다음(Brand Film)으로 넘어가 영상이 재생되도록 한다.
// Vision 패널에서만 동작하며, 고정 UI/메뉴/버튼·링크·폼 등 인터랙티브 요소 클릭은 제외.
window.addEventListener('click', (e) => {
  if (isMobileView()) return;
  if (panelIndex !== VISION_INDEX) return;            // Vision 패널에서만
  const skPopup = document.getElementById('skinegoPopup');
  if (skPopup && skPopup.classList.contains('is-open')) return;
  if (e.target.closest('.fixed-ui, .menu-overlay, a, button, input, textarea, select, label, [role="button"]')) return;
  onScrollDown();   // Vision → Brand Film(영상 재생)
});

/* ── 폴더블 접기→펴기(모바일→PC) 시 "보던 단락" 유지 ──
   폴더폰을 접고(=모바일 세로 스크롤) 보다가 펴면(=PC 가로 패널) 지금까지 PC
   패널은 항상 KV(panel 0)로 남아 있어 보던 위치를 잃었다. 모바일에서 세로로
   보던 단락을 계속 추적해 두었다가, PC 로 전환되는 순간 같은 내용의 가로 패널로
   애니메이션 없이 즉시 점프시킨다. (전환 시점엔 이미 .mo-root 가 display:none 이라
   단락 위치를 읽을 수 없으므로 "모바일에 있는 동안" 미리 추적한다.) */
(function () {
  // 모바일 단락 class → PC 패널 class (같은 내용끼리 매핑)
  const MO_TO_PANEL = [
    ['mo-kv',        'panel-kv'],
    ['mo-vision',    'panel-vision'],
    ['mo-about',     'panel-about'],
    ['mo-biz-ent',   'panel-entertainment'],
    ['mo-mcn',       'panel-mcn'],
    ['mo-cosmetics', 'panel-cosmetics'],
    ['mo-press',     'panel-press'],
    ['mo-contact',   'panel-contact'],
    ['mo-footer',    'panel-contact'],   // 푸터는 마지막(Contact)으로
  ];
  const panelIndexOf = (cls) => panels.findIndex((p) => p.classList.contains(cls));

  // 현재 모바일 헤더 아래에 걸려 있는 단락의 PC 패널 index (mo-snap context 와 동일 규칙)
  function currentMobilePanel() {
    const hdr = document.querySelector('.mo-header');
    const line = (hdr ? hdr.getBoundingClientRect().height : 60) + 6;  // 헤더 밑선(viewport)
    let picked = 'panel-kv';
    for (const [moCls, panelCls] of MO_TO_PANEL) {
      const el = document.querySelector('.' + moCls);
      if (!el || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 1) continue;
      if (r.top <= line) picked = panelCls;   // 라인 위/걸친 마지막 단락 = 현재
    }
    const idx = panelIndexOf(picked);
    return idx < 0 ? 0 : idx;
  }

  // PC 패널을 애니메이션 없이 그 위치로 즉시 맞춘다(goTo 의 상태 반영을 축약).
  function jumpPcToPanel(idx) {
    isAnimating = false;
    panelIndex = idx;
    aboutSubIndex = 0; visionSubIndex = 0; mcnSubIndex = 0;
    jumpWrapperTo(idx);
    panels.forEach((p, i) => p.classList.toggle('panel-active', i === idx));
    if (aboutInner)  aboutInner.style.transform  = 'translateY(0)';
    if (visionInner) visionInner.style.transform = 'translateY(0)';
    if (mcnInner) {
      mcnInner.style.transform = 'translateY(0)';
      if (panels[MCN_INDEX]) panels[MCN_INDEX].dataset.sub = 0;
    }
    updateFixedUI(idx, 0);
  }

  // 모바일 브랜드 필름(mo-vision 세로 영상)이 재생 중이면, 펼침 시 PC 브랜드 필름
  // 패널로 가서 "같은 지점부터" 이어 재생한다. 모바일은 brandfilm_mo.mp4(세로),
  // PC 는 index.mp4(가로) 로 파일은 다르지만 같은 영상이라 currentTime 이 이어진다.
  // (펼침은 사용자 제스처가 아니라 소리 자동재생이 막힐 수 있어 muted 폴백 — 소리는
  //  브랜드 필름의 소리 버튼으로 켤 수 있다.)
  function continueBrandFilm(t, wantSound) {
    if (!brandFilmVideo) return;
    const seekPlay = () => {
      try {
        const d = brandFilmVideo.duration;
        brandFilmVideo.currentTime = (d && t > d) ? d : t;   // 길이 차이 대비 클램프
      } catch (e) {}
      brandFilmVideo.muted = !wantSound;
      const p = brandFilmVideo.play();
      if (p && p.catch) p.catch(() => { brandFilmVideo.muted = true; brandFilmVideo.play().catch(() => {}); });
    };
    if (brandFilmVideo.readyState >= 1) seekPlay();          // 메타데이터 있음 → 바로 seek
    else {
      brandFilmVideo.preload = 'auto';
      brandFilmVideo.addEventListener('loadedmetadata', seekPlay, { once: true });
      brandFilmVideo.load();
    }
  }

  // ── PC → 모바일(접기) 방향 ──
  // PC 패널 class → 대응 모바일 단락 selector (같은 내용끼리). brand-film·career 는
  // 모바일에 전용 단락이 없어 각각 vision·contact 로 보낸다.
  const PANEL_TO_MO = {
    'panel-kv': '.mo-kv', 'panel-vision': '.mo-vision', 'panel-brand-film': '.mo-vision',
    'panel-about': '.mo-about', 'panel-entertainment': '.mo-biz-ent', 'panel-mcn': '.mo-mcn',
    'panel-cosmetics': '.mo-cosmetics', 'panel-press': '.mo-press',
    'panel-contact': '.mo-contact', 'panel-career': '.mo-contact',
  };
  // 모바일 단락을 고정 헤더 아래에 맞춰 스크롤(레이아웃이 흔들릴 수 있어 rAF 로 한 번 더 보정).
  function scrollMobileToEl(el) {
    if (!el) return;
    const hdr = document.querySelector('.mo-header');
    const H = hdr ? hdr.getBoundingClientRect().height : 60;
    const y = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0) - H;
    window.scrollTo(0, Math.max(0, Math.round(y)));
  }
  function scrollMobileToElStable(el) {
    scrollMobileToEl(el);
    requestAnimationFrame(() => scrollMobileToEl(el));
  }
  function scrollMobileToPanel(idx) {
    const panel = panels[idx];
    if (!panel) return;
    let sel = null;
    for (const cls in PANEL_TO_MO) { if (panel.classList.contains(cls)) { sel = PANEL_TO_MO[cls]; break; } }
    scrollMobileToElStable(sel && document.querySelector(sel));
  }
  // PC 브랜드 필름을 모바일 Vision 세로 영상으로 이어재생(같은 영상, 다른 파일).
  function continueMoBrandFilm(t, wantSound) {
    const v = document.querySelector('.mo-vision-video--tall');
    scrollMobileToElStable(document.querySelector('.mo-vision'));
    if (!v) return;
    const seekPlay = () => {
      try { const d = v.duration; v.currentTime = (d && t > d) ? d : t; } catch (e) {}
      v.muted = !wantSound;
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); });
    };
    if (v.readyState >= 1) seekPlay();
    else { v.preload = 'auto'; v.addEventListener('loadedmetadata', seekPlay, { once: true }); v.load(); }
  }

  // 모바일에 있는 동안 "보던 단락"을 계속 추적(전환 순간엔 못 읽으므로 미리 저장)
  let lastMobilePanel = 0;
  const trackMobile = () => { if (isMobileView()) lastMobilePanel = currentMobilePanel(); };
  window.addEventListener('scroll', trackMobile, { passive: true });

  let wasMobile = isMobileView();
  if (wasMobile) trackMobile();
  window.addEventListener('resize', () => {
    const nowMobile = isMobileView();
    if (wasMobile && !nowMobile) {                           // 모바일 → PC
      // 브랜드 필름 재생 중이면 PC 브랜드 필름 패널로 이어서 재생, 아니면 보던 단락 유지.
      const moFilm = document.querySelector('.mo-vision-video--tall');
      if (moFilm && !moFilm.paused && !moFilm.ended && BRAND_INDEX >= 0) {
        const t = moFilm.currentTime || 0;
        const wantSound = !moFilm.muted;
        try { moFilm.pause(); } catch (e) {}
        document.body.classList.remove('mo-vision-expanded');  // 모바일 세로 전체화면 잠금 해제
        jumpPcToPanel(BRAND_INDEX);
        continueBrandFilm(t, wantSound);
      } else {
        jumpPcToPanel(lastMobilePanel);
      }
    } else if (!wasMobile && nowMobile) {                    // PC → 모바일(접기)
      // PC 브랜드 필름 재생 중이면 모바일 Vision 영상으로 이어재생, 아니면 보던 패널 단락으로 스크롤.
      if (panelIndex === BRAND_INDEX && brandFilmVideo && !brandFilmVideo.paused && !brandFilmVideo.ended) {
        const t = brandFilmVideo.currentTime || 0;
        const wantSound = !brandFilmVideo.muted;
        try { brandFilmVideo.pause(); } catch (e) {}
        continueMoBrandFilm(t, wantSound);
      } else {
        scrollMobileToPanel(panelIndex);
      }
    }
    wasMobile = nowMobile;
  });
})();


/* ── KV 대각(↘) 와이프 리빌 (데모 ↘대각 모드 이식) ──
   합성 사진 위를 검은 커버로 덮었다가 좌상단→우하단 대각으로 쓸어 노출한다. */
(function () {
  const stage = document.getElementById('kvStage');
  if (!stage) return;
  const panelKv = stage.closest('.panel-kv');
  // 덮개는 패널 전체를 덮도록 .kv-bg 밖, .panel-kv 직속에 위치
  const canvas = (panelKv || document).querySelector('.kv-scratch');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = 110;                  // 와이프 프레임 수 (≈ 1.8s @60fps)
  let W = 0, H = 0;
  let raf = 0;
  let revealed = false;             // 노출 완료되면 다시 덮지 않음(리사이즈 대비)

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // 캔버스를 표시 크기 × DPR 로 맞춤(디바이스 픽셀로 그림). 가려져(모바일) 크기가 0이면 false.
  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    // r 은 스테이지 스케일이 반영된 렌더 크기 → 백킹스토어(해상도)만 여기에 맞춘다.
    // 캔버스 엘리먼트 크기는 CSS(width/height:100% = 패널 1920×1080)에 맡긴다.
    // (style.width 를 r.width 로 덮으면 스테이지가 한 번 더 스케일해 2중 확대됨)
    W = Math.round(r.width * dpr);
    H = Math.round(r.height * dpr);
    canvas.width = W;
    canvas.height = H;
    return true;
  }

  // 사진 전체를 검정으로 덮음(미세한 노이즈 점으로 표면감)
  function paintCover() {
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0f0d10');
    g.addColorStop(0.5, '#171116');
    g.addColorStop(1, '#0b0b0d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 170; i++) {
      ctx.fillStyle = i % 2 ? '#3a2a30' : '#000';
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function clearAll() { ctx.clearRect(0, 0, W, H); }

  // 남은 커버(이음매 등)를 몇 프레임에 걸쳐 서서히 지워 자연스럽게 채운다.
  // destination-out 전체 칠을 매 프레임 점점 진하게 적용 → 잔여 알파가 0으로 수렴.
  function fadeOutCover(done) {
    const FADE = 20;                       // 페이드 프레임 수 (≈ 0.33s)
    let f = 0;
    (function step() {
      f++;
      ctx.globalCompositeOperation = 'destination-out';
      const a = Math.min(1, (f / FADE) * (f / FADE));   // ease-in
      ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
      ctx.fillRect(0, 0, W, H);
      if (f < FADE) { raf = requestAnimationFrame(step); }
      else { clearAll(); raf = 0; if (done) done(); }   // 마지막에 완전 제거
    })();
  }

  // 붓 한 점(dab)으로 커버를 긁어냄(destination-out → 투명 → 사진 노출).
  // 둥근 본체로 확실히 지우고(완전 노출 보장), 스트로크(세로) 방향으로 길쭉한 붓털
  // 줄무늬를 얹어 칠한 질감을 준다. 회전된 컨텍스트 안에서 호출되므로 로컬 y축이 붓의 진행 방향.
  function dab(x, y, rad) {
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 7);
    ctx.fill();

    // 붓털 가닥 — 스트로크(세로) 방향으로 길쭉한 타원. 칠한 듯한 결을 만든다.
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * rad * 1.7;      // 폭 방향 분산
      const ll = rad * (1.2 + Math.random() * 1.5);      // 가닥 길이(세로)
      const ww = rad * (0.10 + Math.random() * 0.14);    // 가닥 두께
      const a  = 0.5 + Math.random() * 0.5;              // 가닥 농도
      const gb = ctx.createLinearGradient(x + ox, y - ll / 2, x + ox, y + ll / 2);
      gb.addColorStop(0,   'rgba(0,0,0,0)');
      gb.addColorStop(0.5, 'rgba(0,0,0,' + a + ')');
      gb.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = gb;
      ctx.beginPath();
      ctx.ellipse(x + ox, y, ww, ll / 2, 0, 0, 7);
      ctx.fill();
    }
  }

  // 서펜타인(↕) 붓칠: 붓이 위↔아래로 몇 번만(≈3~5) 굵게 왕복하면서 좌→우로 전진해
  // 사진을 칠하듯 벗긴다. 왕복이 적은 만큼 가로 이동 폭이 넓고, 붓도 그만큼 굵다.
  // 전체 프레임을 살짝 기울여(rotate) 진행 방향이 대각선으로 보이게 한다.
  function runStroke() {
    cancelAnimationFrame(raf);
    paintCover();
    const DUR_S = 150;                                   // 스트로크 길이(프레임 ≈ 2.5s)
    const ang = (20 + rnd(-6, 6)) * Math.PI / 180;       // 대각 기울기
    const cos = Math.abs(Math.cos(ang)), sin = Math.abs(Math.sin(ang));
    const baseX = W * cos + H * sin;                     // 회전 바운딩 박스(가로)
    const baseY = W * sin + H * cos;                     // 〃(세로)
    const cycles = rnd(3, 5);                            // 위아래 왕복 횟수(대략 3~5)
    const passes = Math.max(5, Math.round(cycles * 2));  // 세로 스트로크 수
    const spacing = baseX / passes;                      // 스트로크 간 가로 간격
    const R = spacing * 0.8;                             // 붓 반지름(인접 스트로크가 겹치도록 굵게)
    const spanX = baseX + R * 2;                         // 양끝 여유 포함 가로 총거리
    const spanY = baseY;

    // 서펜타인 꺾임점(로컬 좌표). 각 점에 흔들림을 줘 "너무 균일함"을 깬다.
    // 위/아래 끝은 항상 화면 밖까지 넘겨(over) 가장자리를 확실히 덮는다.
    const pts = [];
    for (let k = 0; k <= passes; k++) {
      const jx = (Math.random() - 0.5) * spacing * 0.4;          // 가로 위치 흔들림
      const x = -spanX / 2 + (k / passes) * spanX + jx;
      const over = R * rnd(0.4, 1.3);                            // 끝 넘김(랜덤)
      const y = (k % 2 === 0) ? (-spanY / 2 - over) : (spanY / 2 + over);
      pts.push({ x, y });
    }

    // 경로를 누적 길이로 분할 → 길이 기준으로 일정 간격(dab)으로 찍는다.
    const seg = [];
    let total = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      seg.push({ a, b, len, acc: total });
      total += len;
    }
    const dabStep = R * 0.4;                             // dab 간격

    function dabAtLen(d) {
      for (let i = 0; i < seg.length; i++) {
        const s = seg[i];
        if (d <= s.acc + s.len || i === seg.length - 1) {
          const f = s.len ? (d - s.acc) / s.len : 0;
          const x = s.a.x + (s.b.x - s.a.x) * f;
          const y = s.a.y + (s.b.y - s.a.y) * f;
          const wob = Math.sin(d / R) * R * 0.12;        // 진행 중 살짝 떨림
          dab(x + wob, y, R * rnd(0.9, 1.08));           // 붓 굵기도 미세하게 변동
          return;
        }
      }
    }

    let t = 0;
    (function frame() {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(ang);
      const dPrev = Math.max(0, ((t - 1) / DUR_S) * total);
      const dNow = (t / DUR_S) * total;
      for (let d = dPrev; d <= dNow; d += dabStep) dabAtLen(d);
      ctx.restore();
      t++;
      if (t <= DUR_S) { raf = requestAnimationFrame(frame); }
      else { fadeOutCover(() => { revealed = true; }); }  // 잔여 이음매를 서서히 지워 완전 노출
    })();
  }

  function runReveal() {
    cancelAnimationFrame(raf);
    raf = 0; revealed = false;
    if (!sizeCanvas()) return false;     // 보이지 않으면(모바일) 연출 생략
    if (reduceMotion) { clearAll(); revealed = true; return true; }
    runStroke();                         // 첫 줄에서 커버를 동기적으로 칠해 사진을 즉시 가림
    return true;
  }

  // 최초 진입 시 KV(panel 0)가 바로 보이므로 자동 재생.
  // window 'load'(모든 이미지 로드 완료)를 기다리면 사진이 먼저 노출됐다가 뒤늦게
  // 커버+와이프가 적용되어 어색하다. DOM 준비 즉시 커버를 칠하고 와이프를 시작하며,
  // 캔버스 크기가 아직 0이면(레이아웃 미완) 다음 프레임에 재시도한다.
  (function autoReveal() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoReveal, { once: true });
      return;
    }
    if (!runReveal()) requestAnimationFrame(autoReveal);
  })();

  // 다른 패널로 갔다가 KV 로 돌아오면(panel-active 재부여) 다시 재생
  if (panelKv && 'MutationObserver' in window) {
    new MutationObserver(() => {
      if (panelKv.classList.contains('panel-active')) runReveal();
    }).observe(panelKv, { attributes: true, attributeFilter: ['class'] });
  }

  // 리사이즈: 노출 완료 상태면 커버를 비워 사진 유지, 아니면 재생
  let rzTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => {
      if (!sizeCanvas()) return;
      if (revealed) clearAll();
      else runReveal();
    }, 200);
  });
})();

/* ── KV2: 시계방향 라인 드로잉 + 오브제 순차 등장 + 로고 피날레 ──
   라인(빛 궤도)을 conic 마스크로 정면(아래)에서 시계방향으로 그려 나가며,
   라인이 각 오브제의 각도를 지날 때 해당 오브제가 떠오른다. 한 바퀴를 마치면
   중앙 로고가 피어오른다. --sweep(0→1) 한 값으로 마스크와 등장 타이밍을 함께 구동. */
(function () {
  const root = document.getElementById('kv2');
  if (!root) return;
  const panelKv = root.closest('.panel-kv');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logo = root.querySelector('.kv2-logo');
  const halo = root.querySelector('.kv2-logo-halo');

  // [선택자, 등장 진행도] — 진행도는 정면(아래)에서 시계방향 한 바퀴(0→1) 기준.
  // 정면(아래)→왼쪽(0.25)→위(0.5)→오른쪽(0.75)→정면 순.
  const OBJS = [
    ['.o-book',    0.25],   // 좌측
    ['.o-clapper', 0.37],   // 좌상
    ['.o-camera',  0.47],   // 상단 좌
    ['.o-mic',     0.58],   // 우상
    ['.o-media',   0.70],   // 우측(헤드폰·재생·라이브)
    ['.o-palette', 0.85],   // 우하
    ['.o-cream',   0.95],   // 정면 하단(루프가 정면으로 돌아오며)
  ].map(([sel, p]) => ({ el: root.querySelector(sel), p }));

  const SWEEP_MS = 2100;       // 라인 한 바퀴 시간 (체감 속도 ↑)
  let raf = 0;
  let running = false;         // 재생 중 재진입(스크롤 스크립트의 class 재부여) 방지

  function setSweep(v) { root.style.setProperty('--sweep', v.toFixed(4)); }

  function showLogo() {
    if (logo) logo.classList.add('show');
    if (halo) halo.classList.add('show');
  }

  function showAll() {
    setSweep(1);
    OBJS.forEach(o => o.el && o.el.classList.add('show'));
    showLogo();
  }

  function play() {
    if (running) return;       // 이미 재생 중이면 무시(중간 리셋 방지)
    running = true;
    cancelAnimationFrame(raf);
    root.classList.add('kv2-anim');
    // 초기화: 라인 0, 오브제/로고 숨김
    setSweep(0);
    OBJS.forEach(o => o.el && o.el.classList.remove('show'));
    if (logo) logo.classList.remove('show');
    if (halo) halo.classList.remove('show');

    if (reduce) { showAll(); running = false; return; }

    // 강제 리플로우로 숨김 상태를 확정한 뒤 트랜지션이 먹도록 함
    void root.offsetWidth;

    let start = 0;
    raf = requestAnimationFrame(function step(ts) {
      if (!start) start = ts;
      let p = (ts - start) / SWEEP_MS;
      if (p > 1) p = 1;
      setSweep(p);
      OBJS.forEach(o => { if (o.el && p >= o.p) o.el.classList.add('show'); });
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        showLogo();                              // 라인 완주 후 로고 피날레
        raf = 0;
        running = false;                         // 완료 — 다음 진입 시 재생 허용
      }
    });
  }

  // 최초 진입 시 KV 가 바로 보이므로 자동 재생 (레이아웃 준비되면)
  (function auto() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', auto, { once: true });
      return;
    }
    requestAnimationFrame(play);
  })();

  // 다른 패널로 갔다가 KV 로 돌아오면 다시 재생
  if (panelKv && 'MutationObserver' in window) {
    new MutationObserver(() => {
      if (panelKv.classList.contains('panel-active')) play();
    }).observe(panelKv, { attributes: true, attributeFilter: ['class'] });
  }
})();

// ===== 문의 폼 드롭다운 (비지니스 문의 종류) — 클릭 시 목록 패널 펼침 =====
const cfDropdown = document.querySelector('.cf-dropdown');
const cfList     = document.querySelector('.cf-dropdown-list');
const cfLabel    = document.querySelector('.cf-dropdown-label');
if (cfDropdown && cfList && cfLabel) {
  const setOpen = (open) => {
    cfList.hidden = !open;
    cfDropdown.setAttribute('aria-expanded', String(open));
  };
  cfDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(cfList.hidden);
  });

  // 카테고리 아코디언 — 한 번에 하나만 펼침
  cfList.querySelectorAll('.cf-cat-head').forEach((head) => {
    head.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = head.getAttribute('aria-expanded') !== 'true';
      cfList.querySelectorAll('.cf-cat-head').forEach((h) => {
        h.setAttribute('aria-expanded', 'false');
        const s = h.nextElementSibling;
        if (s) s.hidden = true;
      });
      if (willOpen) {
        head.setAttribute('aria-expanded', 'true');
        const sub = head.nextElementSibling;
        if (sub) sub.hidden = false;
      }
    });
  });

  // 하위 항목 선택 → 라벨에 "카테고리 · 항목" 반영 후 닫기
  cfList.querySelectorAll('.cf-cat-sub li').forEach((li) => {
    li.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = li.closest('.cf-cat').querySelector('.cf-cat-head span').textContent;
      cfLabel.textContent = cat + ' · ' + li.textContent;
      cfLabel.style.color = '#ffffff';
      setOpen(false);
    });
  });

  // 바깥 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cf-select')) setOpen(false);
  });
}


// ===== GNB_open: 메뉴 버튼(hover/선택) → 펼침 메뉴 (Figma 452:435 / 452:458) =====
const menuBtn      = document.getElementById('kvMenuBtn');
const menuOverlay  = document.getElementById('menuOverlay');
const menuBackdrop = document.getElementById('menuBackdrop');

if (menuBtn && menuOverlay && fixedUI) {
  // data-nav 값 → 동작 (About은 메인 내부 패널 이동, 사업부는 전용 페이지로 이동
  // → 대상 페이지가 최상단에서 해당 섹션까지 부드럽게 스크롤한다)
  const navActions = {
    'about':                  () => goTo(ABOUT_INDEX, 0),
    'about-company':          () => goTo(ABOUT_INDEX, 0),
    'about-history':          () => goTo(ABOUT_INDEX, 1),
    'about-location':         () => goTo(ABOUT_INDEX, 2),
    'entertainment':          () => goTo(ENTERTAINMENT_INDEX, 0),   // 대메뉴: 메인 Entertainment 패널
    'entertainment-artist':   () => { window.location.href = '/entertainment#artist'; },
    'entertainment-audition': () => { window.location.href = '/entertainment#audition'; },
    'mcn':                    () => goTo(MCN_INDEX, 0),             // 대메뉴: 메인 MCN 패널
    'mcn-creator':            () => { window.location.href = '/mcn#creator'; },
    'mcn-apply':              () => { window.location.href = '/mcn#apply'; },
    'career':                 () => { window.location.href = '/career'; },   // 메인에 Career 패널 없음 → 그대로
    'career-process':         () => { window.location.href = '/career#process'; },
    'career-faq':             () => { window.location.href = '/career#faq'; },
    'cosmetics':              () => goTo(COSMETICS_INDEX, 0),
  };

  const isMenuOpen = () => fixedUI.classList.contains('menu-open');
  function openMenu() {
    fixedUI.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuOverlay.setAttribute('aria-hidden', 'false');
  }
  function closeMenu() {
    fixedUI.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuOverlay.setAttribute('aria-hidden', 'true');
  }

  // Hover 동작: 버튼에 들어오면 메뉴를 연다. (열린 뒤 hover 를 벗어나도
  // 닫지 않는다 — 닫기는 X 버튼(열린 상태의 햄버거) 클릭 / 바깥 클릭 / ESC 로만.)
  menuBtn.addEventListener('mouseenter', openMenu);

  // 클릭(터치 등 hover 불가 환경 대비) — 토글
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isMenuOpen() ? closeMenu() : openMenu();
  });

  // 메뉴 항목 선택 → 이동 후 닫기 (슬라이드 잠금 중이면 풀린 뒤 실행 — 눌러도 안 가는 것 방지)
  menuOverlay.querySelectorAll('[data-nav]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = navActions[item.dataset.nav];
      closeMenu();
      if (action) navWhenReady(action);
    });
  });

  // About 사업부 유닛(데스크톱): 클릭 시 해당 사업부 패널로 이동
  document.querySelectorAll('.about-unit-link[data-nav]').forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const action = navActions[el.dataset.nav];
      if (action) navWhenReady(action);
    });
  });

  // 바깥(백드롭) 클릭 · ESC 로 닫기 (hover 불가 환경 대비)
  if (menuBackdrop) menuBackdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen()) closeMenu();
  });
}

// About 사이드 메뉴(데스크톱): About Company(0) / History(1) 클릭 → 해당 서브로 이동
if (fixedUI) {
  fixedUI.querySelectorAll('.side-menu p').forEach((el, i) => {
    el.addEventListener('click', () => goTo(ABOUT_INDEX, i));
  });
}

// 로고(데스크톱): 클릭 시 메인 KV(패널 0)로 이동
const kvLogoSmall = document.querySelector('.kv-logo-small');
if (kvLogoSmall) {
  kvLogoSmall.style.cursor = 'pointer';
  kvLogoSmall.addEventListener('click', () => navWhenReady(() => goTo(0, 0)));
}

// ===== 모바일 전체화면 메뉴 =====
// 동작은 공통 menu.js(MO_MENU 렌더 + 열기/닫기/아코디언/두 번째 탭 이동)로 단일화했다.
// 서브페이지와 같은 구현을 쓰도록 main.html 도 menu.js 를 로드한다 → 한 곳만 고치면 된다.

// ===== 모바일 지원하기 버튼 → ARTIST/CREATOR/RINGCREW 플라이아웃 =====
// 우측 고정 CTA(.mo-side-cta) 의 지원하기 버튼. 터치는 hover 가 불안정하므로 탭으로 토글.
(function () {
  const moApply = document.querySelector('.mo-side-cta .cta-apply');
  if (!moApply) return;
  const close = () => {
    moApply.classList.remove('is-open');
    moApply.setAttribute('aria-expanded', 'false');
  };
  moApply.addEventListener('click', (e) => {
    // 플라이아웃 항목 클릭은 해당 페이지로 이동
    if (e.target.closest('.cta-apply-item')) return;
    e.preventDefault();
    e.stopPropagation();
    const willOpen = !moApply.classList.contains('is-open');
    moApply.classList.toggle('is-open', willOpen);
    moApply.setAttribute('aria-expanded', String(willOpen));
  });
  moApply.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      moApply.click();
    } else if (e.key === 'Escape') {
      close();
    }
  });
  document.addEventListener('click', (e) => {
    if (!moApply.contains(e.target)) close();
  });
})();

// ===== 모바일 Vision 카드 영상 =====
// 기본(카드) 상태: 세로 브랜드 필름(brandfilm_mo.mp4)이 제목 아래 세로 카드에서 음소거·루프 자동재생.
// 전체화면(⛶) 탭: 카드가 휴대폰 화면 전체(세로)를 덮도록 확대되고 소리와 함께 재생.
// 닫기(X) 탭: 카드로 축소 — 같은 영상이 그대로 이어서 재생(소리 상태 유지).
(function () {
  const wrap = document.querySelector('.mo-vision-video-wrap');
  if (!wrap) return;
  const video = wrap.querySelector('.mo-vision-video--tall'); // 세로 브랜드 필름 (단일 영상)
  const playBtn = wrap.querySelector('.mo-vision-play');
  const fsBtn = wrap.querySelector('.mo-vision-fs');
  if (!video || !playBtn) return;

  let expanded = false;
  const setPlaying = () => wrap.classList.toggle('is-playing', !video.paused);

  const playMuted = () => { video.muted = true; const p = video.play(); if (p && p.catch) p.catch(() => {}); };
  // 사용자 탭 재생 — 진짜 제스처라 소리 켜서 재생, 막히면 무음 폴백
  const playWithSound = () => {
    video.muted = false;
    const p = video.play();
    if (p && p.catch) p.catch(() => { video.muted = true; video.play().catch(() => {}); });
  };

  // 중앙 재생 버튼 → 소리와 함께 재생
  playBtn.addEventListener('click', () => playWithSound());
  // 영상 탭 → 재생/일시정지 토글
  video.addEventListener('click', () => { video.paused ? playWithSound() : video.pause(); });
  video.addEventListener('play', setPlaying);
  video.addEventListener('pause', setPlaying);

  // ── 세로 전체화면: 카드(.mo-vision-img)를 fixed 로 띄워 휴대폰 화면 전체를 덮는다(CSS 담당).
  //    확장 중에는 단락 페이징을 멈춘다(mo-snap.js 가 body.mo-vision-expanded 를 예외 처리). ──
  const visionSection = wrap.closest('.mo-vision') || wrap;
  const setExpanded = (on) => {
    expanded = on;
    visionSection.classList.toggle('is-expanded', on);
    wrap.classList.toggle('is-expanded', on);
    document.body.classList.toggle('mo-vision-expanded', on);
    if (fsBtn) fsBtn.setAttribute('aria-label', on ? '전체화면 닫기' : '세로 전체화면으로 보기');
    // 전체화면 진입은 사용자 제스처 → 소리 켜서 재생. 닫을 때는 그대로 이어서 재생.
    if (on) playWithSound();
    setPlaying();
  };
  if (fsBtn) fsBtn.addEventListener('click', (e) => {
    e.stopPropagation();                            // 영상 탭(재생/일시정지) 핸들러로 전파 방지
    setExpanded(!expanded);
  });

  // 섹션이 화면에 보이면 자동재생(음소거·루프), 벗어나면 정지.
  //  - 모바일 자동재생 정책상 음소거로 시작한다.
  //  - 전체화면 중에는 fixed 오버레이가 항상 화면에 있으므로 건드리지 않는다.
  if ('IntersectionObserver' in window) {
    let preloaded = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (expanded) return;
        if (en.isIntersecting) {
          if (!preloaded) { preloaded = true; video.preload = 'auto'; video.load(); }
          if (en.intersectionRatio >= 0.5 && video.paused) playMuted();  // 진입 → 음소거 자동재생
        } else if (!video.paused) {
          video.pause();                            // 다음 페이지로 → 정지
        }
      });
    }, { threshold: [0, 0.5] });
    io.observe(video);
  }
})();

// ===== PC Brand Film 소리 토글 (자동재생은 음소거, 클릭 시 소리 켜기/끄기) =====
(function () {
  const btn = document.getElementById('brandFilmSound');
  if (!btn || !brandFilmVideo) return;
  const sync = () => {
    const muted = brandFilmVideo.muted;
    btn.classList.toggle('is-muted', muted);
    btn.setAttribute('aria-pressed', String(!muted));
    btn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
  };
  btn.addEventListener('click', () => {
    brandFilmVideo.muted = !brandFilmVideo.muted;
    if (!brandFilmVideo.muted) {
      const p = brandFilmVideo.play();   // 정책상 클릭(사용자 동작) 안에서 소리 재생 허용
      if (p && p.catch) p.catch(() => {});
    }
    sync();
  });
  // 패널 진입 재생(소리 우선/무음 폴백)으로 muted 가 바뀌어도 버튼 아이콘이 따라가도록
  brandFilmVideo.addEventListener('volumechange', sync);
  sync();
})();

// ===== PC Brand Film 중앙 재생 버튼: 클릭 → 재생 / 영상 클릭 → 일시정지(버튼 다시 노출) =====
// 모바일 Vision 카드 영상과 동일 패턴. 패널 진입 시 자동재생(음소거)되며, 자동재생이
// 막히거나 사용자가 영상을 클릭해 멈추면 중앙 버튼이 다시 노출된다.
(function () {
  const wrap = document.querySelector('.panel-brand-film .brand-film-img');
  const playBtn = document.getElementById('brandFilmPlay');
  if (!wrap || !brandFilmVideo || !playBtn) return;

  const setPlaying = (on) => wrap.classList.toggle('is-playing', on);
  const playVideo = () => {
    const p = brandFilmVideo.play();
    if (p && p.catch) p.catch(() => {});
  };

  playBtn.addEventListener('click', playVideo);
  // 재생 중 영상을 클릭하면 일시정지하고 재생 버튼 다시 노출(소리 토글 버튼은 별도)
  brandFilmVideo.addEventListener('click', () => {
    brandFilmVideo.paused ? playVideo() : brandFilmVideo.pause();
  });
  brandFilmVideo.addEventListener('play', () => setPlaying(true));
  brandFilmVideo.addEventListener('pause', () => setPlaying(false));

  setPlaying(!brandFilmVideo.paused);   // 초기 상태 동기화
})();

// ===== PC 문의하기 버튼 → Business Contact 패널로 이동 =====
(function () {
  // 모바일 고정 CTA(.mo-side-cta)가 DOM 상 먼저 나오므로 PC 버튼을 명시적으로 선택
  const inquireBtn = document.querySelector('.cta-btns:not(.mo-side-cta) .cta-inquire');
  if (!inquireBtn || CONTACT_INDEX < 0) return;
  inquireBtn.addEventListener('click', () => goTo(CONTACT_INDEX, 0));
})();

/* ── 모바일 About 탭 전환 (About Company / History) ──
   History 텍스트를 누르면 오른쪽에서 슬라이드되며 History 화면으로 전환 */
(function () {
  const moAbout = document.getElementById('moAbout');
  if (!moAbout) return;
  const moTabs = moAbout.querySelectorAll('.mo-about-tab');
  const paneCompany = moAbout.querySelector('.mo-about-pane--company');
  const paneHistory = moAbout.querySelector('.mo-about-pane--history');
  const paneLocation = moAbout.querySelector('.mo-about-pane--location');
  moTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const which = tab.dataset.motab;
      moTabs.forEach((t) => t.classList.toggle('mo-about-tab--active', t.dataset.motab === which));
      if (paneCompany) paneCompany.hidden = which !== 'company';
      if (paneHistory) paneHistory.hidden = which !== 'history';
      if (paneLocation) paneLocation.hidden = which !== 'location';
      // About Company 로 전환 시에도 슬라이드 등장 효과(왼쪽에서). History 는
      // hidden→표시 시 CSS 가 자동 재생하지만, company 는 최초 로드 때 이미 보이는
      // 상태라 클릭 시에만 클래스를 부여해 재생한다. 재클릭 시 재생되도록 먼저 제거.
      if (which === 'company' && paneCompany) {
        paneCompany.classList.remove('mo-pane-in');
        void paneCompany.offsetWidth;        // 강제 reflow → 애니메이션 재시작
        paneCompany.classList.add('mo-pane-in');
      }
    });
  });
})();

/* ── 해시 딥링크 ──
   다른 페이지(서브 GNB 메뉴)에서 main.html#about / #history 로 진입 시
   해당 패널(About Company / History)로 자동 이동한다. */
(function () {
  const ENT = panels.findIndex((p) => p.classList.contains('panel-entertainment'));
  const MCN = panels.findIndex((p) => p.classList.contains('panel-mcn'));
  const PRESS = panels.findIndex((p) => p.classList.contains('panel-press'));
  const map = {
    'about':         () => goTo(ABOUT_INDEX, 0),
    'about-company': () => goTo(ABOUT_INDEX, 0),
    'history':          () => goTo(ABOUT_INDEX, 1),
    'about-history':    () => goTo(ABOUT_INDEX, 1),
    'location':         () => goTo(ABOUT_INDEX, 2),
    'about-location':   () => goTo(ABOUT_INDEX, 2),
    'entertainment': () => { if (ENT >= 0) goTo(ENT, 0); },
    'mcn':           () => { if (MCN >= 0) goTo(MCN, 0); },
    'contact':       () => { if (CONTACT_INDEX >= 0) goTo(CONTACT_INDEX, 0); },
    'cosmetics':     () => { if (COSMETICS_INDEX >= 0) goTo(COSMETICS_INDEX, 0); },
    // 폴더블 펼침에선 Career 패널을 노출하지 않으므로 딥링크도 무시(데스크탑은 그대로).
    'career':        () => { if (CAREER_INDEX >= 0 && CAREER_INDEX <= lastNavPanel()) goTo(CAREER_INDEX, 0); },
    'press':         () => { if (PRESS >= 0) goTo(PRESS, 0); },
  };
  // 폴더블 펼침에서 main 은 PC 버전이지만 mcn·career 등 서브페이지는 모바일 버전이라,
  // 그 모바일 햄버거 메뉴의 Cosmetics 는 /main#moCosmetics(모바일 해시)로 들어온다.
  // PC 뷰에선 mo-* 섹션이 display:none 이라 네이티브 앵커 스크롤이 안 먹어 KV(로고)에
  // 그대로 멈춘다 → PC 뷰일 때만 모바일 해시를 대응 PC 패널 키로 번역한다.
  // (모바일 뷰에선 번역하지 않는다 — mo-* 섹션이 보이므로 네이티브 앵커/모바일 딥링크가 처리.)
  const moAlias = {
    'moCosmetics': 'cosmetics',
    'moAbout': 'about', 'moHistory': 'history', 'moLocation': 'location',
    'moContact': 'contact', 'moMcn': 'mcn', 'moPress': 'press',
  };
  function navFromHash() {
    let key = location.hash.replace('#', '');
    if (!isMobileView() && moAlias[key]) key = moAlias[key];
    if (map[key]) navWhenReady(map[key]);
  }
  if (location.hash) requestAnimationFrame(navFromHash);
  window.addEventListener('hashchange', navFromHash);
})();

/* ── 모바일 About 딥링크 ──
   모바일 햄버거 메뉴에서 #moAbout / #moHistory 로 진입(또는 같은 페이지 이동)
   시 해당 탭(About Company / History)을 활성화하고 섹션으로 스크롤한다.
   데스크탑 딥링크와 해시 키가 달라(서로 'moAbout'/'moHistory') 충돌하지 않는다. */
(function () {
  const moAbout = document.getElementById('moAbout');
  if (!moAbout) return;
  function activate(which) {
    const tab = moAbout.querySelector(`.mo-about-tab[data-motab="${which}"]`);
    if (tab) tab.click();   // 기존 탭 전환 로직(페인 전환 + 애니메이션) 재사용
    moAbout.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function fromHash() {
    if (location.hash === '#moHistory') activate('history');
    else if (location.hash === '#moLocation') activate('location');
    else if (location.hash === '#moAbout') activate('company');
  }
  if (location.hash) requestAnimationFrame(fromHash);
  window.addEventListener('hashchange', fromHash);
})();

/* ── 모바일 Contact 딥링크 ──
   서브페이지의 문의하기는 main.html#contact 로 링크된다. 데스크탑은 위 해시
   맵이 Business Contact 패널로 이동하지만, 모바일은 가로 패널이 숨겨져 있고
   '#contact' id 요소도 없어 첫 화면(KV)만 보인다 → 모바일 Contact 섹션
   (#moContact)으로 스크롤한다. (#moContact 직접 진입도 동일 처리) */
(function () {
  const moContact = document.getElementById('moContact');
  if (!moContact) return;
  function fromHash() {
    if (location.hash === '#contact' || location.hash === '#moContact') {
      moContact.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  if (location.hash) requestAnimationFrame(fromHash);
  window.addEventListener('hashchange', fromHash);
})();

/* ── BUSINESS CONTACT(mo-contact) 전체 내부 스크롤 토글 ──────────────────────
   true  = 섹션 전체(히어로 + 폼)를 내부 스크롤(요청 사항). CREATOR full-scroll 과 동일 패턴.
   false = 원래대로(히어로 화면 고정 + 폼만 내부 스크롤)로 즉시 복귀.
   구현: 히어로(.mo-contact-hero)를 스크롤 컨테이너(.mo-contact-form) 맨 앞으로 옮기고
   섹션에 .is-fullscroll 를 붙인다(나머지 배치는 main.css 의 .is-fullscroll 규칙).
   HTML·원본 CSS 는 무수정 → 이 값만 false 로 바꾸면 원상복귀. */
const MO_CONTACT_FULLSCROLL = true;
(function moContactFullScroll() {
  if (!MO_CONTACT_FULLSCROLL) return;
  const sec  = document.querySelector('.mo-contact');
  if (!sec) return;
  const form = sec.querySelector('.mo-contact-form');
  const hero = sec.querySelector('.mo-contact-hero');
  if (!form || !hero) return;
  form.insertBefore(hero, form.firstChild);   /* 히어로를 폼 스크롤 영역 맨 앞으로 */
  sec.classList.add('is-fullscroll');
})();

/* ============================================================
   BUSINESS CONTACT (Panel 8 / mo-contact) — 백엔드 연동 (공개 제출)
   - 디자인을 건드리지 않기 위해 숨김 <input type="file"> 를 기존 버튼으로 트리거한다.
   - 데스크탑 카테고리 드롭다운(열기·아코디언·선택)을 동작시키고, 파일 첨부와
     SEND REQUEST 를 /api/contact 로 multipart POST 한다.
   - 데스크탑(.contact-form)·모바일(.mo-contact-form) 양쪽 모두 처리.
   ============================================================ */
(function () {
  var ALLOWED = ['zip', 'doc', 'docx', 'ppt', 'pptx', 'pdf', 'hwp'];
  var MAX_SIZE = 10 * 1024 * 1024; // 10MB
  var CATEGORY_PLACEHOLDER = '비지니스 문의 종류';

  function val(el) { return el ? (el.value || '').trim() : ''; }

  /* 드롭다운 라벨에서 선택된 카테고리 읽기 (미선택=placeholder 면 빈 값) */
  function categoryFromLabel(labelEl) {
    if (!labelEl) return '';
    var t = labelEl.textContent.trim();
    return (t && t !== CATEGORY_PLACEHOLDER) ? t : '';
  }

  function checkFile(file) {
    if (!file) return true;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ALLOWED.indexOf(ext) === -1) {
      alert('허용되지 않은 파일 형식입니다. (zip, doc, docx, ppt, pptx, pdf, hwp)');
      return false;
    }
    if (file.size > MAX_SIZE) { alert('파일은 10MB 이내로 업로드해주세요.'); return false; }
    return true;
  }

  function validate(p) {
    if (!p.category) { 
      alert('비즈니스 문의 종류를 선택해주세요.'); 
      return false; 
    }
    if (!p.name || !p.company || !p.phone || !p.email || !p.title || !p.content) {
      alert('필수 항목(이름/직함·기업(단체)명·연락처·이메일·문의 제목·문의 요청 내용)을 모두 입력해주세요.');
      return false;
    }
    if (!p.agree) { alert('개인정보 수집 및 이용에 동의해주세요.'); return false; }
    return true;
  }

  function submitContact(payload, file, onOk) {
    var fd = new FormData();
    fd.append('params', new Blob([JSON.stringify(payload)], { type: 'application/json; charset=utf-8' }));
    if (file) { fd.append('file', file); }
    fetch('/api/contact', { method: 'POST', body: fd })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function () { alert('문의가 접수되었습니다. 감사합니다.'); if (onOk) onOk(); })
      .catch(function () { alert('접수에 실패했습니다. 잠시 후 다시 시도해주세요.'); });
  }

  /* 파일 버튼 → 숨김 input 트리거 + 선택 파일명 표시 */
  function bindFile(btn, input, nameEl) {
    if (!btn || !input) return;
    btn.addEventListener('click', function (e) { e.preventDefault(); input.click(); });
    input.addEventListener('change', function () {
      var f = input.files[0];
      if (f && !checkFile(f)) { input.value = ''; if (nameEl) nameEl.textContent = ''; return; }
      if (nameEl) nameEl.textContent = f ? f.name : '';
    });
  }

  /* 카테고리 드롭다운(열기·아코디언·항목 선택) 바인딩. 선택값은 cfg.store.value 에 저장.
     데스크탑(.cf-*)·모바일(.mo-contact-*) 이 클래스명만 다르고 구조가 같아 공통 처리. */
  function bindCategoryDropdown(cfg) {
    if (!cfg.dropBtn || !cfg.list) return;
    function close() {
      cfg.list.setAttribute('hidden', '');
      cfg.dropBtn.setAttribute('aria-expanded', 'false');
    }
    cfg.dropBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var willOpen = cfg.list.hasAttribute('hidden');
      if (willOpen) { cfg.list.removeAttribute('hidden'); } else { cfg.list.setAttribute('hidden', ''); }
      cfg.dropBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    cfg.list.querySelectorAll(cfg.catHeadSel).forEach(function (head) {
      head.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var sub = head.parentElement.querySelector(cfg.subSel);
        if (!sub) return;
        var willOpen = sub.hasAttribute('hidden');
        if (willOpen) { sub.removeAttribute('hidden'); } else { sub.setAttribute('hidden', ''); }
        head.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });
    cfg.list.querySelectorAll(cfg.subSel + ' li').forEach(function (li) {
      li.addEventListener('click', function (e) {
        e.stopPropagation();
        var cat = li.closest(cfg.catSel);
        var headSpan = cat ? cat.querySelector(cfg.catHeadSel + ' span') : null;
        var group = headSpan ? headSpan.textContent.trim() : '';
        var item = li.textContent.trim();
        cfg.store.value = group ? (group + ' · ' + item) : item;
        if (cfg.label) cfg.label.textContent = cfg.store.value;
        close();
      });
    });
    document.addEventListener('click', function (ev) {
      if (!cfg.list.contains(ev.target) && ev.target !== cfg.dropBtn && !cfg.dropBtn.contains(ev.target)) {
        close();
      }
    });
    cfg.reset = function () {
      cfg.store.value = '';
      if (cfg.label) cfg.label.textContent = CATEGORY_PLACEHOLDER;
    };
  }

  /* ── 데스크탑 (.contact-form) ── */
  var dc = document.querySelector('.contact-form');
  if (dc) {
    // 데스크탑 카테고리 드롭다운은 위쪽(line 427~)에서 이미 바인딩되어 있으므로
    // 여기서 다시 붙이면 열고-닫고가 상쇄된다. 선택 결과는 라벨 텍스트에서 읽는다.
    var dLabel = dc.querySelector('.cf-dropdown-label');

    var dFileInput = dc.querySelector('.cf-file-input');
    var dFileName = dc.querySelector('.cf-file-name');
    bindFile(dc.querySelector('.cf-file-btn'), dFileInput, dFileName);

    var dSend = dc.querySelector('.cf-send');
    if (dSend) {
      dSend.addEventListener('click', function (e) {
        e.preventDefault();
        var chk = dc.querySelector('.cf-agree input[type="checkbox"]');
        var file = (dFileInput && dFileInput.files.length) ? dFileInput.files[0] : null;
        if (file && !checkFile(file)) return;
        var p = {
          category: categoryFromLabel(dLabel),
          name: val(dc.querySelector('.cf-input[placeholder*="이름"]')),
          company: val(dc.querySelector('.cf-input[placeholder*="기업"]')),
          phone: val(dc.querySelector('.cf-input[placeholder*="연락"]')),
          email: val(dc.querySelector('.cf-input[type="email"]')),
          title: val(dc.querySelector('.cf-input[placeholder*="제목"]')),
          content: val(dc.querySelector('.cf-textarea')),
          agree: !!(chk && chk.checked)
        };
        if (!validate(p)) return;
        submitContact(p, file, function () {
          dc.querySelectorAll('.cf-input, .cf-textarea').forEach(function (i) { i.value = ''; });
          if (chk) chk.checked = false;
          if (dFileInput) dFileInput.value = '';
          if (dFileName) dFileName.textContent = '';
          if (dLabel) { dLabel.textContent = CATEGORY_PLACEHOLDER; dLabel.style.color = ''; }
        });
      });
    }
  }

  /* ── 모바일 (.mo-contact-form) ── */
  var mc = document.querySelector('.mo-contact-form');
  if (mc) {
    var mCategory = { value: '' };
    var mDrop = {
      store: mCategory,
      label: mc.querySelector('.mo-contact-select-label'),
      dropBtn: mc.querySelector('.mo-contact-select'),
      list: mc.querySelector('.mo-contact-dd-list'),
      catSel: '.mo-contact-cat', catHeadSel: '.mo-contact-cat-head', subSel: '.mo-contact-cat-sub'
    };
    bindCategoryDropdown(mDrop);

    var mFileInput = mc.querySelector('.mo-contact-file-input');
    var mFileName = mc.querySelector('.mo-contact-file-name');
    bindFile(mc.querySelector('.mo-contact-file'), mFileInput, mFileName);

    var mSend = mc.querySelector('.mo-contact-submit');
    if (mSend) {
      mSend.addEventListener('click', function (e) {
        e.preventDefault();
        var chk = mc.querySelector('.mo-contact-agree input[type="checkbox"]');
        var file = (mFileInput && mFileInput.files.length) ? mFileInput.files[0] : null;
        if (file && !checkFile(file)) return;
        var p = {
          category: mCategory.value,
          name: val(mc.querySelector('.mo-contact-input[placeholder*="이름"]')),
          company: val(mc.querySelector('.mo-contact-input[placeholder*="기업"]')),
          phone: val(mc.querySelector('.mo-contact-input[placeholder*="연락"]')),
          email: val(mc.querySelector('.mo-contact-input[type="email"]')),
          title: val(mc.querySelector('.mo-contact-input[placeholder*="제목"]')),
          content: val(mc.querySelector('.mo-contact-textarea')),
          agree: !!(chk && chk.checked)
        };
        if (!validate(p)) return;
        submitContact(p, file, function () {
          mc.querySelectorAll('.mo-contact-input, .mo-contact-textarea').forEach(function (i) { i.value = ''; });
          if (chk) chk.checked = false;
          if (mFileInput) mFileInput.value = '';
          if (mFileName) mFileName.textContent = '';
          if (mDrop.reset) mDrop.reset();
        });
      });
    }
  }
})();

/* ===== SKINEGO 제품 라인업 팝업 (2페이지) ===== */
(function () {
  var popup = document.getElementById('skinegoPopup');
  if (!popup) return;
  var box = popup.querySelector('.skinego-popup-box');
  var slides = popup.querySelectorAll('.skinego-slide');
  var dots = popup.querySelectorAll('.skinego-dot');
  var idx = 0;

  function pauseVideos() {
    popup.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
  }
  function goTo(i) {
    if (!slides.length) return;
    pauseVideos();   // 페이지 전환 시 영상이 숨겨진 채 소리만 재생되는 것 방지
    idx = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('is-active', k === idx); });
    dots.forEach(function (d, k) { d.classList.toggle('is-active', k === idx); });
    popup.classList.toggle('skinego-popup--p2', idx === 1);  // 2페이지에선 박스 높이 20px 축소
    if (box) box.scrollTop = 0;   // 페이지 전환 시 위로
  }
  function open() {
    goTo(0);                      // 열 때 항상 1페이지부터
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    // 모바일: 배경(메인) 스크롤 잠금 → 팝업 내부만 스크롤되게.
    // (mo-snap.js 는 body.skinego-open 일 때 페이징을 멈추고, CSS 는 스크롤 루트를 overflow:hidden 으로 고정한다.)
    document.documentElement.classList.add('skinego-open');
    document.body.classList.add('skinego-open');
  }
  function close() {
    pauseVideos();   // 닫을 때 영상 정지
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('skinego-open');
    document.body.classList.remove('skinego-open');
  }

  document.querySelectorAll('[data-skinego-soon]').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.preventDefault(); open(); });
  });
  popup.querySelectorAll('[data-skinego-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });
  popup.querySelectorAll('[data-skinego-prev]').forEach(function (el) {
    el.addEventListener('click', function () { goTo(idx - 1); });
  });
  popup.querySelectorAll('[data-skinego-next]').forEach(function (el) {
    el.addEventListener('click', function () { goTo(idx + 1); });
  });
  popup.querySelectorAll('[data-skinego-goto]').forEach(function (el) {
    el.addEventListener('click', function () { goTo(parseInt(el.getAttribute('data-skinego-goto'), 10) || 0); });
  });
  document.addEventListener('keydown', function (e) {
    if (!popup.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') goTo(idx - 1);
    else if (e.key === 'ArrowRight') goTo(idx + 1);
  });

  // 슬라이드(페이지) 전환은 오직 < > 버튼(과 점)으로만 한다.
  // 스크롤/스와이프는 현재 슬라이드 내부 콘텐츠 스크롤에만 쓰이고, 페이지를 넘기지 않는다.
  // 배경(메인) 스크롤 차단: 박스가 실제로 스크롤 가능한 곳(2페이지)에서만 네이티브 터치
  // 스크롤을 허용하고, 그 외(1페이지처럼 박스가 안 넘치거나 dim 영역)에선 touchmove 를
  // 막아 배경이 따라 스크롤되지 않게 한다. (iOS 는 overflow:hidden 만으론 터치 스크롤이 샌다)
  popup.addEventListener('touchmove', function (e) {
    if (!popup.classList.contains('is-open')) return;
    var inBox = box && box.contains(e.target);
    var canScroll = inBox && box.scrollHeight > box.clientHeight + 1;
    if (!canScroll) e.preventDefault();   // 배경으로 새는 스크롤 차단
  }, { passive: false });
})();
