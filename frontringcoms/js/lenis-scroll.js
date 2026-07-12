/* ============================================================
   lenis-scroll.js — 모바일(≤768px) 스크롤을 Lenis 로 구동한다(mcn·career 공용).

   Lenis(syncTouch:true, 실제 스크롤) +
   - 짧은 섹션: 공식 lenis/snap 플러그인(A, type:'lock') — 강한 한 칸 스냅.
   - 긴 섹션 진입: 직접 구현한 "경계 게이트" — 관성 세기와 무관하게 진입 시 한 번 턱 멈춤.
   - 그 외(푸터 등): 자유 스크롤.

   [페이지별 설정 — window 전역으로 주입]
   - window.LENIS_SNAP_SEL : 짧은 섹션(스냅) 셀렉터 배열.  예 mcn: ['.mo-sec-1'..'.mo-sec-5']
   - window.LENIS_GATE_SEL : 긴 섹션 진입 경계 셀렉터 배열. 예 mcn: ['.mo-sec-6','.mo-sec-7']
   (미주입 시 스냅/게이트 없이 Lenis 스무스 스크롤만)

   [경계 게이트]
   - 경계선 = 긴 섹션 상단 스크롤 좌표(sectionTop − headerH, 라이브).
   - lenis.on('scroll') 매 프레임(관성 포함) 현재 위치를 직전과 비교, 경계선을 straddle
     (양쪽에 걸침)하면 통과로 판정 → 그 경계로 즉시 정착 + 관성 kill
     (lenis.scrollTo(B,{immediate:true,force:true}) → velocity=0, animate.stop()).
   - 손가락 직접 드래그 중(touching)엔 게이트 안 함(자유). 관성 구간(!touching)만.
   - consumed[i]: 이번 제스처에서 그 경계 소비 여부. touchstart 에서 리셋 → 정착 후
     다음 제스처엔 그 경계 벗어나 이동하므로 straddle 없이 자유 통과. 방향 무관.

   [주소창 토글 재스냅] svh 라 좌표는 안 어긋나지만 주소창이 scrollY 를 밀어 스냅점에서
   벗어난다. 손 뗀 상태에서 스냅점 근처(±RESNAP_TOL)면 vv 안정 뒤 가장 가까운 스냅/경계로 재정착.

   [격리] matchMedia('(max-width:768px)') 뒤에서만 생성. 데스크탑 진입 시 destroy, 모바일
   재진입 시 재생성. PC 스크롤 엔진(각 페이지 .*-container)은 안 건드린다. mo-snap 은
   페이지가 MO_SNAP_DISABLE 로 opt-out. 가로 캐러셀은 마크업에 data-lenis-prevent.
   ============================================================ */
(function () {
  'use strict';

  if (typeof window.Lenis !== 'function') return;         // core 로드 실패 → 네이티브 폴백
  var hasSnap = (typeof window.Snap === 'function');       // snap 플러그인 유무(A 용)

  var HEADER    = 60;   // 헤더 폴백 높이(px)
  var SEL_SHORT = window.LENIS_SNAP_SEL || [];  // 짧은 섹션(스냅) — 페이지에서 주입
  var SEL_GATE  = window.LENIS_GATE_SEL || [];  // 긴 섹션 진입 경계 — 페이지에서 주입
  var GATE_TOL  = 2;    // straddle 판정 여유(px)
  var RESNAP_TOL = 100; // 주소창 밀림(≈주소창 높이) 복귀용 — 스냅점에서 이 이내면 재스냅 대상

  /* 짧은 섹션 페이징 전환 곡선 — 메인페이지(네이티브 smooth) 측정치 매칭:
     SNAP_DUR = 0.55s, easeInOutQuad(시작·끝 완만). */
  var SNAP_DUR  = 0.55;
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var MQ = window.matchMedia('(max-width: 768px)');
  var lenis = null, snapA = null, rafId = 0;
  var removers = [], refreshT = 0, ro = null;
  /* 경계 게이트 상태 */
  var touching = false, gating = false, lastScroll = 0, consumed = [];
  /* 재스냅 상태 */
  var isSettled = false, resnapping = false, resnapT = 0;

  function headerH() {
    var h = document.querySelector('.mo-header');
    return h ? (h.getBoundingClientRect().height || HEADER) : HEADER;
  }
  function topY(el) {
    return Math.max(0, Math.ceil(el.getBoundingClientRect().top + window.scrollY - headerH()));
  }
  /* 경계선 좌표(라이브) — 보이는 것만 */
  function gateYs() {
    var ys = [], el;
    for (var i = 0; i < SEL_GATE.length; i++) {
      el = document.querySelector(SEL_GATE[i]);
      if (el && el.offsetParent !== null) ys.push(topY(el));
    }
    return ys;
  }
  /* 짧은 섹션 스냅점 + 긴 섹션 진입 경계 전체(라이브). 재스냅 대상 후보 */
  function settleYs() {
    var ys = [], e, i;
    for (i = 0; i < SEL_SHORT.length; i++) { e = document.querySelector(SEL_SHORT[i]); if (e && e.offsetParent !== null) ys.push(topY(e)); }
    return ys.concat(gateYs());
  }
  function nearestSettleY(y) {
    var ys = settleYs(), best = null;
    for (var i = 0; i < ys.length; i++) if (best === null || Math.abs(ys[i] - y) < Math.abs(best - y)) best = ys[i];
    return best;
  }

  /* A(짧은 섹션) 스냅점 (재)등록 */
  function registerSnaps() {
    for (var i = 0; i < removers.length; i++) { try { removers[i](); } catch (e) {} }
    removers = [];
    if (!snapA) return;
    for (var s = 0; s < SEL_SHORT.length; s++) {
      var el = document.querySelector(SEL_SHORT[s]);
      if (el && el.offsetParent !== null) removers.push(snapA.add(topY(el)));
    }
  }

  function scheduleRefresh() {
    if (refreshT) clearTimeout(refreshT);
    refreshT = setTimeout(function () { refreshT = 0; registerSnaps(); }, 150);
  }

  /* 주소창/하단 바 show·hide 는 대개 window.resize 를 안 쏘고 visualViewport.resize 만 쏜다.
     lenis.resize() 로 치수/스크롤 재동기 + 좌표 재등록 + 재스냅. */
  function onViewportResize() {
    if (lenis && lenis.resize) lenis.resize();
    scheduleRefresh();
    scheduleReSnap();
  }

  /* 주소창 토글은 애니메이션 동안 vv resize/scroll 을 여러 번 쏘므로, 매번 타이머 리셋 → 멎은 뒤 1회 */
  function scheduleReSnap() {
    if (resnapT) clearTimeout(resnapT);
    resnapT = setTimeout(reSnap, 220);
  }
  /* 주소창 밀림으로 스냅점에서 벗어났으면 가장 가까운 스냅/경계로 재정착.
     touching / 아직 움직임(velocity) → 대기. 스냅점 근처(±RESNAP_TOL)만 대상(자유 구간 제외). */
  function reSnap() {
    resnapT = 0;
    if (!lenis) return;
    if (touching || Math.abs(lenis.velocity || 0) > 0.05) { scheduleReSnap(); return; }
    var cur = lenis.scroll;
    var target = nearestSettleY(cur);
    if (target == null) return;
    var off = Math.abs(cur - target);
    if (off <= GATE_TOL) return;                          // 이미 스냅점
    if (off > 200) return;                                // 예상 밖 큰 이탈 무시
    if (!isSettled && off > RESNAP_TOL) return;           // 자유 구간(경계에서 TOL 밖) → 안 함
    resnapping = true;
    lenis.scrollTo(target, { duration: 0.3, lock: true, force: true, onComplete: function () { resnapping = false; } });
  }

  /* ── 경계 게이트: 관성 구간에서 경계 straddle 시 즉시 정착 + 관성 kill ── */
  function onGateScroll() {
    if (gating || resnapping || !lenis) return;
    var cur = lenis.scroll;
    if (!touching) {
      var ys = gateYs();
      for (var i = 0; i < ys.length; i++) {
        if (consumed[i]) continue;
        var b = ys[i];
        var straddle = (lastScroll < b - GATE_TOL && cur > b - GATE_TOL) ||
                       (lastScroll > b + GATE_TOL && cur < b + GATE_TOL);
        if (straddle) {
          gating = true;
          lenis.scrollTo(b, { immediate: true, force: true });
          gating = false;
          consumed[i] = true;
          lastScroll = b;
          isSettled = true;
          return;
        }
      }
    }
    lastScroll = cur;
  }
  function onGateTouchStart() {
    touching = true; consumed = []; lastScroll = lenis ? lenis.scroll : 0;
    isSettled = false;
    if (resnapT) { clearTimeout(resnapT); resnapT = 0; }
  }
  function onGateTouchEnd()   { touching = false; }
  function onViewportScroll() { scheduleReSnap(); }

  function raf(time) { if (!lenis) return; lenis.raf(time); rafId = requestAnimationFrame(raf); }

  function initLenis() {
    if (lenis) return;
    lenis = new Lenis({ syncTouch: true });
    rafId = requestAnimationFrame(raf);

    if (hasSnap && SEL_SHORT.length) {
      snapA = new Snap(lenis, {
        type: 'lock',
        distanceThreshold: '90%',
        duration: SNAP_DUR,
        easing: easeInOutQuad,
        debounce: 0,
        onSnapComplete: function () { isSettled = true; }
      });
      registerSnaps();
    }

    lastScroll = lenis.scroll;
    lenis.on('scroll', onGateScroll);
    document.addEventListener('touchstart', onGateTouchStart, { passive: true });
    document.addEventListener('touchend', onGateTouchEnd, { passive: true });

    window.addEventListener('load', scheduleRefresh);
    window.addEventListener('resize', scheduleRefresh);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportResize);
      window.visualViewport.addEventListener('scroll', onViewportScroll);
    }
    if (window.ResizeObserver) {
      ro = new ResizeObserver(scheduleRefresh);
      ro.observe(document.documentElement);
    }
  }

  function destroyLenis() {
    if (!lenis) return;
    window.removeEventListener('load', scheduleRefresh);
    window.removeEventListener('resize', scheduleRefresh);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewportResize);
      window.visualViewport.removeEventListener('scroll', onViewportScroll);
    }
    document.removeEventListener('touchstart', onGateTouchStart);
    document.removeEventListener('touchend', onGateTouchEnd);
    if (ro) { ro.disconnect(); ro = null; }
    if (refreshT) { clearTimeout(refreshT); refreshT = 0; }
    if (resnapT) { clearTimeout(resnapT); resnapT = 0; }
    for (var i = 0; i < removers.length; i++) { try { removers[i](); } catch (e) {} }
    removers = [];
    lenis.off('scroll', onGateScroll);
    if (snapA) { snapA.destroy(); snapA = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    touching = false; gating = false; consumed = []; isSettled = false; resnapping = false;
    var dead = lenis; lenis = null;
    dead.destroy();
  }

  function sync() { if (MQ.matches) initLenis(); else destroyLenis(); }
  if (MQ.addEventListener) MQ.addEventListener('change', sync);
  else if (MQ.addListener) MQ.addListener(sync);
  sync();
})();
