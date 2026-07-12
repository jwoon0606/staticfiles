/* ============================================================
   mo-snap.js — 모바일(≤768px) 단락 페이징
   PC의 "휠 한 번 = 단락 한 칸 이동"을 모바일 터치로 옮긴 것.

   동작(fullpage 방식):
   - 짧은 단락(뷰포트 이내): 세로 스와이프 한 번 = 다음/이전 단락으로 슥 이동.
   - 긴 단락(뷰포트보다 큼): 단락 "안"에서는 평소처럼 자유 스크롤.
     윗끝/아랫끝에 닿은 상태에서 더 스와이프하면 그때 이전/다음 단락으로 넘어감.
   - 가로 스와이프(스튜디오 캐러셀 등)는 네이티브 동작 유지.
   - 메뉴 오버레이 / 드롭다운 / 입력폼 / 신청폼 위에서는 페이징 끄고 네이티브 스크롤.

   페이지별 단락 셀렉터는 window.MO_SNAP_SELECTOR 로 주입(없으면 공용 fallback).

   window.MO_SNAP_STEP_LONG = true (mcn 페이지에서 주입):
   긴 단락도 자유 스크롤 대신 "뷰포트 단위 균등 스텝"으로 나눠 페이징한다.
   자유 스크롤 ↔ 페이징 전환 경계에서 관성이 미끄러져 스냅 감각이 무너지는
   문제를 없애고, 페이지 전체가 스와이프 한 번 = 한 칸으로 딱딱 끊긴다.
   스텝 간격은 항상 가시 높이(뷰포트-헤더) 이하 → 화면이 겹쳐 건너뛰는
   콘텐츠 없음. EXEMPT 영역(신청 폼 등)은 기존대로 네이티브 스크롤.

   window.MO_SNAP_FREE_TAIL = '.mo-footer' (main/mcn/career 에서 주입):
   이 요소가 보이기 시작하는 지점(요소 상단 = 뷰포트 하단)부터 문서 끝까지는
   "자유 꼬리" 구간 — 푸터에 슬라이드 경계를 두지 않는다. 양방향 완전 자유:
   - 아래로: 마지막 단락에서 관성이 경계를 넘어 푸터로 자연스럽게 흘러
     들어가고(정착/관성 컷/되끌기 없음), 문서 끝까지 자유 스크롤.
   - 위로: 마찬가지로 아무 정착 없이 마지막 단락 내부(자유 구간)로 흘러
     나간다. 정착/페이징 복귀는 그 단락 "상단"(진짜 스냅 경계)에서만.
     (경계(tail) 정착을 걸면 관성 되끌기+보정 이중 이동이 실기기에서
      "출렁임"으로 보였음 — 자유 구간 안에서는 관성과 싸우지 않는다.)
   ============================================================ */
(function () {
  'use strict';

  // opt-out: 이 페이지가 스크롤을 다른 엔진으로 전담하거나(정적), 뷰 모드에 따라
  // 동적으로(예: main 의 폴더블 펼침=PC 버전) mo-snap 을 꺼야 할 때 사용.
  // 예전엔 로드 시점에 한 번만 검사(if (MO_SNAP_DISABLE) return)해서, 폴더블을 펼친 채
  // (PC) 로드한 뒤 접으면(모바일) 스냅이 영영 안 붙었다. 이제 boolean 뿐 아니라 함수
  // 플래그도 허용하고 "제스처마다" 재검사한다 → 접기/펴기로 실시간 토글된다.
  function snapDisabled() {
    var d = window.MO_SNAP_DISABLE;
    return typeof d === 'function' ? !!d() : !!d;
  }

  var mq = window.matchMedia('(max-width: 768px)');
  // 모바일 페이징이 지금 활성이어야 하는가(≤768 && 비활성 플래그 아님).
  function snapOff() { return !mq.matches || snapDisabled(); }

  var HEADER = 60;            // 고정 헤더 높이(px)
  var SWIPE_MIN = 24;         // 페이징으로 인정할 최소 세로 이동(px) — 작은 플릭도 다음 단락으로
  var DECIDE_MIN = 8;         // 가로/세로 방향 판정 임계(px)
  var LOCK_MS = 700;          // 한 번 이동 후 잠금(애니메이션 정착 시간)
  var EDGE_TOL = 4;           // 스냅 위치 비교 허용 오차(px)
  var EDGE_AT = 6;            // "단락 끝에 닿음" 판정 허용 오차(px)
  var EDGE_REACH = 72;        // 긴 단락의 끝 "근처" 도달로 인정할 범위(px)
                              // — iOS 관성 스크롤이 끝점에 못 미쳐도 다음 단락으로 확실히 넘어가도록
                              //   (값↑ = 경계 전환이 더 확실/공격적, 단락 하단 마지막 일부는 페이징으로 통과)
  var SETTLE_MS = 110;        // 자유 스크롤이 멈춘 뒤 "경계 정착" 검사까지의 디바운스(px 아님, ms)
  var MAX_OVER = 90;          // 긴 단락 끝을 이만큼 넘어가면 관성을 끊고 끝으로 정착.
                             // → 관성이 멀리 흐르기 전에 잘라 "너무 많이 갔다 오는" 것 방지(값↑ = 더 멀리 감)

  var SELECTOR = window.MO_SNAP_SELECTOR ||
    '.mo-kv, .mo-about, .mo-vision, .mo-company, .mo-biz-ent, .mo-mcn,' +
    '.mo-cosmetics, .mo-press, .mo-contact,' +     /* main */
    '.mo-sec,' +                                   /* mcn */
    '.slide-1, .mo-slide-2, .mo-slide-3, .mo-slide-4'; /* career */

  /* 페이징을 끄고 네이티브 스크롤을 허용할 영역(스크롤되는 오버레이/폼/드롭다운) */
  // 아래 스크롤 컨테이너들은 full-scroll 토글 여부와 무관하게 항상 "그 섹션의 내부
  // 스크롤 영역"을 가리킨다. APPLY 만 full-scroll 시 스크롤러가 폼 카드(.con)에서
  // 래퍼(.mo-sec7-scroll)로 바뀌므로 :not(.is-fullscroll) 로 모드 분기(둘 다 안전).
  // (main Contact/career Process·FAQ/mcn 크리에이터는 full-scroll 이어도 스크롤러 요소가
  //  그대로라 selector 변경 불필요 — 제목만 그 안으로 들어와 함께 스크롤됨.)
  var EXEMPT = '.mo-menu, .mo-ent-dropdown-menu, .mo-mcn6-dd-menu,' +
               '.mo-contact-form,' +          /* main Contact: 히어로+폼 내부 스크롤 */
               '.mo-sec6-scroll,' +           /* mcn 크리에이터: 제목·필터+그리드 내부 스크롤 */
               '.mo-sec-7:not(.is-fullscroll) .con,' +   /* mcn APPLY(기본): 폼 카드만 내부 스크롤 */
               '.mo-sec-7.is-fullscroll .mo-sec7-scroll,' + /* mcn APPLY(full-scroll): 히어로+폼 래퍼 */
               '.mo-s3-list,' +               /* career Process: 제목+리스트 내부 스크롤 */
               '.mo-s4-scroll';               /* career FAQ: 제목·탭+패널 내부 스크롤 */

  // 입력 편집 중(키보드 열림) 판정 — "포커스 상태" 기준.
  // 예전처럼 form 컨테이너를 통째로 EXEMPT 하면 폼 위에서 시작한 위쪽 플릭이
  // 정착 검사 없이 단락 경계를 넘어 아무 데나 멈췄다(경계 미스얼라인의 주원인).
  // 편집 중에만 네이티브로 풀어주면 그 문제 없이 작성 UX는 유지된다.
  var EDITING = 'textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=button])';

  // "하드 exempt": 페이징을 아예 끄고 완전 네이티브로 두는 상태
  // (메뉴/팝업 오버레이, Vision 확장, 입력 편집 중). 여기 걸리면 스크롤 체이닝도 안 한다.
  function hardExempt() {
    if (document.body.classList.contains('mo-menu-open')) return true;
    // SKINEGO 팝업이 열려 있으면 배경 페이징을 멈추고 팝업 내부 스크롤만 허용.
    if (document.body.classList.contains('skinego-open')) return true;
    // 개인정보처리방침 모달(privacy.js)이 열려 있으면 배경 페이징을 멈추고
    // 모달 본문(.pp-body) 내부 스크롤만 허용.
    if (document.body.classList.contains('pp-lock')) return true;
    // Vision 카드 세로 전체화면(페이지 내 확장) 중에는 단락 페이징을 멈춘다.
    if (document.body.classList.contains('mo-vision-expanded')) return true;
    var ae = document.activeElement;
    if (ae && ae.matches && ae.matches(EDITING)) return true;
    return false;
  }

  // 이 노드가 들어있는 내부 스크롤 컨테이너(EXEMPT) — 없으면 null.
  function exemptScrollerOf(node) {
    return (node && node.closest) ? node.closest(EXEMPT) : null;
  }

  function isExempt(node) {
    return hardExempt() || !!exemptScrollerOf(node);
  }

  // 내부 스크롤러가 스와이프 방향의 "끝"에 닿아 있는지 — 닿아 있으면 이 스와이프를
  // 컨테이너 안에 가두지 않고 섹션 페이징으로 넘긴다(스크롤 체이닝).
  // forward=true(손가락 위로=아래로 읽음) → 하단 끝, false → 상단 끝 기준.
  function scrollerAtEdge(sc, forward) {
    var st = sc.scrollTop;
    if (forward) return st + sc.clientHeight >= sc.scrollHeight - 1;  // 하단 끝
    return st <= 0;                                                   // 상단 끝
  }

  // 이 요소가 세로 스크롤 컨테이너인지(overflow 스크롤 + 실제로 넘치는 내용).
  function isScrollableY(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    var oy = getComputedStyle(el).overflowY;
    return oy === 'auto' || oy === 'scroll';
  }

  // 터치 지점(node)부터 exempt 컨테이너(stop)까지 거슬러 올라가며, 스와이프 방향으로
  // 아직 스크롤 여지가 남은 내부 스크롤러가 하나라도 있으면 true.
  // EXEMPT(.con) 안에 중첩된 스크롤 영역(자세히보기 동의서 박스 등)까지 훑어
  // "가장 안쪽부터 순서대로" 스크롤을 소진시키고, 전부 끝에 닿았을 때만 페이징한다.
  function innerCanScroll(node, stop, forward) {
    var el = node;
    while (el && el.nodeType === 1) {
      if (isScrollableY(el) && !scrollerAtEdge(el, forward)) return true;
      if (el === stop) break;
      el = el.parentElement;
    }
    return false;
  }

  function headerH() {
    // 실측 소수값 그대로 사용(ceil/floor 금지). 헤더 높이가 소수(calc(60*var(--u)),
    // 폭≠360 일 때 51.3px 등)일 때 여기서 올림하면 목적지가 최대 ~1.7px 덜
    // 스크롤되어 섹션 상단이 헤더 밑선 아래로 처지고, 그 틈으로 이전 섹션
    // 하단이 띠로 보였다. 반올림 방향은 목적지 계산(snapStarts/context)에서
    // ceil(상단 정착)·floor(하단 정착)로 일괄 처리한다.
    var h = document.querySelector('.mo-header');
    return h ? (h.getBoundingClientRect().height || HEADER) : HEADER;
  }

  function scrollY() {
    return window.scrollY || window.pageYOffset || 0;
  }

  /* 자유 꼬리 구간 시작 스크롤 위치 — FREE_TAIL 요소 상단이 뷰포트 하단에 닿는
     지점(= 직전 긴 단락의 하단 정착점과 같은 floor 규칙). 이 지점부터 문서 끝까지는
     스냅 경계 없이 자유 스크롤. 미설정/미존재면 Infinity(기능 꺼짐). */
  function tailStartY() {
    var sel = window.MO_SNAP_FREE_TAIL;
    if (!sel) return Infinity;
    var el = document.querySelector(sel);
    if (!el || el.offsetParent === null) return Infinity;
    var vh = window.innerHeight;
    var max = Math.max(0, document.documentElement.scrollHeight - vh);
    var absTop = el.getBoundingClientRect().top + scrollY();
    return Math.min(max, Math.max(0, Math.floor(absTop - vh)));
  }

  function sections() {
    var out = [];
    var els = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < els.length; i++) {
      if (els[i].offsetParent === null) continue;           // 숨김 제외
      var r = els[i].getBoundingClientRect();
      if (r.height < 1) continue;
      out.push(els[i]);
    }
    return out;
  }

  /* 각 단락의 시작 Y(헤더 아래에 맞춤) 목록 — 페이징 목적지 */
  function snapStarts() {
    var H = headerH();
    var top = scrollY();
    var vh = window.innerHeight;
    var max = Math.max(0, document.documentElement.scrollHeight - vh);
    var els = sections();
    var pts = [0];
    var stepLong = !!window.MO_SNAP_STEP_LONG;
    var visible = vh - H;                        // 헤더 아래 실제 가시 높이
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      var absTop = r.top + top;
      // ceil: 목적지를 올림 → 섹션 상단이 헤더 밑선과 같거나 살짝 위(헤더 뒤에
      // 숨음)에 정착. floor 면 최대 ~1px 덜 스크롤되어 섹션 상단이 헤더 아래로
      // 처지고 그 틈으로 "이전 섹션 하단"이 1~5 물리픽셀 띠로 보였다(폭≠360 등
      // 헤더 높이가 소수인 모든 화면). ceil 의 대가는 화면 맨 아래 1px 미만의
      // 다음 섹션 노출뿐인데, 섹션 배경이 모두 어두워 보이지 않는다.
      var startY = Math.max(0, Math.ceil(absTop - H));
      pts.push(startY);
      // 스텝 모드: 긴 단락(가시 높이 초과)은 상단→하단을 균등 스텝으로 나눠
      // 중간 목적지를 추가한다. n = ceil(구간/가시높이) → 스텝 간격이 항상
      // 가시 높이 이하가 되어 이전 스텝과 화면이 겹친다(건너뛰는 콘텐츠 없음).
      // EXEMPT(신청 폼 등 네이티브 스크롤 영역)는 중간 스텝을 만들지 않는다.
      if (stepLong && r.height > visible + EDGE_TOL &&
          !(els[i].closest && els[i].closest(EXEMPT))) {
        var bottomY = Math.min(max, Math.max(startY, Math.floor(absTop + r.height - vh)));
        var range = bottomY - startY;
        if (range > EDGE_TOL) {
          var n = Math.ceil(range / visible);
          for (var s = 1; s <= n; s++) pts.push(startY + Math.round(range * s / n));
        }
      }
    }
    var tail = tailStartY();
    if (tail === Infinity) {
      pts.push(max);
    } else {
      // 자유 꼬리 구간 안에는 스냅 목적지를 두지 않는다 → go()가 푸터로 페이징하지 않음.
      pts = pts.filter(function (p) { return p <= tail + EDGE_TOL; });
    }
    pts = pts.map(function (p) { return Math.min(p, max); });
    pts.sort(function (a, b) { return a - b; });
    var u = [];
    for (var j = 0; j < pts.length; j++) {
      if (j === 0 || pts[j] !== pts[j - 1]) u.push(pts[j]);
    }
    return u;
  }

  /* 현재 헤더 아래에 걸려 있는 단락과, 그 단락의 끝 도달 여부 */
  function context() {
    var H = headerH();
    var vh = window.innerHeight;
    var visible = vh - H;
    var top = scrollY();
    var line = top + H;                  // 헤더 바로 아래 라인(문서 좌표)
    var els = sections();

    var cur = null, curTop = 0, curH = 0;
    for (var i = 0; i < els.length; i++) {
      var absTop = els[i].getBoundingClientRect().top + top;
      if (absTop <= line + EDGE_AT) { cur = els[i]; curTop = absTop; curH = els[i].getBoundingClientRect().height; }
    }
    if (!cur) return { overflowing: false, atTop: true, atBottom: true, startY: 0, bottomY: 0 };

    var max = Math.max(0, document.documentElement.scrollHeight - vh);
    var overflowing = curH > visible + EDGE_TOL;
    // 상단 정착점은 ceil(섹션 상단이 헤더 뒤로 숨는 방향), 하단 정착점은
    // floor(섹션 하단이 뷰포트 밑선 아래로 남는 방향) — snapStarts 와 동일 규칙.
    // 반대로 반올림되면 정착 후 이전/다음 섹션이 서브픽셀 띠로 샌다.
    var startY = Math.max(0, Math.ceil(curTop - H));   // 이 단락의 시작 스크롤 위치(상단 정착점)
    // 이 단락 하단을 뷰포트 하단에 맞춘 위치(하단 정착점). startY..max 로 클램프.
    var bottomY = Math.min(max, Math.max(startY, Math.floor(curTop + curH - vh)));
    // 끝 근처(EDGE_REACH 이내)면 "끝에 닿음"으로 인정 — 관성 오버슈트/미달로
    // 끝에 딱 안 멈춰도 다음 스와이프가 자유 스크롤 대신 페이징되도록.
    var atTop = top <= startY + EDGE_REACH;
    var atBottom = top >= bottomY - EDGE_REACH;
    return { overflowing: overflowing, atTop: atTop, atBottom: atBottom, startY: startY, bottomY: bottomY };
  }

  var locked = false;
  function go(dir) {
    if (locked) return;
    var y = scrollY();
    var pts = snapStarts();
    var target = null;
    if (dir > 0) {
      for (var i = 0; i < pts.length; i++) {
        if (pts[i] > y + EDGE_TOL) { target = pts[i]; break; }
      }
    } else {
      for (var k = pts.length - 1; k >= 0; k--) {
        if (pts[k] < y - EDGE_TOL) { target = pts[k]; break; }
      }
    }
    if (target == null) return;
    locked = true;
    window.scrollTo({ top: target, behavior: 'smooth' });
    setTimeout(function () {
      // 정착 재검증: 스크롤 중 브라우저 주소창이 접히거나 펼쳐지면 100dvh 기반
      // 단락(KV 등)의 높이가 변해 목적지가 낡은 값이 되고, 못 미친 채 정착
      // → 헤더 밑으로 이전 단락 하단이 띠로 남는다. 새 레이아웃 기준으로
      // 가장 가까운 목적지를 다시 찾아 어긋나 있으면 한 번만 보정한다.
      if (active) { locked = false; return; }   // 손가락이 다시 닿았으면 손 우선
      var pts2 = snapStarts();
      var y2 = scrollY();
      var best = null;
      for (var m = 0; m < pts2.length; m++) {
        if (best == null || Math.abs(pts2[m] - y2) < Math.abs(best - y2)) best = pts2[m];
      }
      if (best != null && Math.abs(best - y2) > EDGE_TOL) {
        window.scrollTo({ top: best, behavior: 'smooth' });
        setTimeout(function () { locked = false; }, LOCK_MS);
      } else {
        locked = false;
      }
    }, LOCK_MS);
  }

  /* ── 터치 제스처 ──
     active   : 페이징 후보 제스처인지
     decided  : 방향(가로/세로) 판정 끝났는지
     vertical : 세로 제스처인지
     paging   : 이번 제스처를 페이징으로 처리할지(아니면 네이티브 자유 스크롤) */
  // tailFree : 이번 제스처가 자유 꼬리(푸터) 구간의 네이티브 자유 스크롤인지
  // scroller : 이번 제스처가 시작된 내부 스크롤 컨테이너(EXEMPT). 없으면 null.
  //   내부가 아직 끝에 안 닿았으면 네이티브 스크롤, 끝에 닿았으면 섹션 페이징으로 넘긴다.
  var sx = 0, sy = 0, active = false, decided = false, vertical = false, paging = false, tailFree = false, scroller = null;
  // y0          : 이번 제스처 시작 시 스크롤 위치(경계 정착 기준점)
  // pendingSettle: 자유 스크롤 제스처 직후라 멈추면 경계 정착을 검사해야 하는지
  //               (앵커 점프 등 비-터치 스크롤은 false로 둬서 가로채지 않음)
  // freeBottom   : 이번 자유 스크롤이 머무는 "긴 단락"의 하단 정착점(아래 방향 전용).
  //   제스처 시작(onMove) 때 한 번 잡아두고 settle/관성 컷이 그 값으로 되돌린다.
  //   위 방향은 고정 기준점을 쓰지 않는다 — 관성이 멈춘 위치에서 context 로
  //   다시 판단해 "가장 가까운 스냅점"으로만 정착(아래 settle 참고).
  var y0 = 0, pendingSettle = false, settleT = null, freeBottom = 0;

  function onStart(e) {
    if (snapOff()) return;
    var t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    y0 = scrollY();
    decided = false; vertical = false; paging = false; tailFree = false;
    // 새 제스처 시작 → 이전 제스처의 정착/홀드는 폐기(손이 항상 우선).
    // 관성을 손으로 멈추고 다시 스와이프할 때 옛 settle/hold가 끼어드는 것 방지.
    pendingSettle = false;
    if (settleT) { clearTimeout(settleT); settleT = null; }
    // 하드 exempt(메뉴/팝업/편집)면 완전 네이티브. 그 외엔 제스처를 살려두고,
    // 내부 스크롤 컨테이너(EXEMPT)면 캡처해 두었다가 onMove에서 끝 도달 시 페이징으로 넘긴다.
    active = !hardExempt();
    scroller = active ? exemptScrollerOf(e.target) : null;
  }

  function onMove(e) {
    if (snapOff() || !active) return;
    var t = e.touches[0];
    if (!decided) {
      var dx = Math.abs(t.clientX - sx);
      var dy = Math.abs(t.clientY - sy);
      if (dx < DECIDE_MIN && dy < DECIDE_MIN) return;
      decided = true;
      vertical = dy > dx;
      if (!vertical) { active = false; return; }   // 가로 → 네이티브에 양보

      var forward = (sy - t.clientY) > 0;           // 손가락 위로 = 아래(다음)로 이동
      var y = scrollY();

      // 내부 스크롤 컨테이너(EXEMPT)에서 시작한 제스처: 아직 그 방향 끝에 안 닿았으면
      // 컨테이너를 네이티브로 스크롤(active off). 이미 끝에 닿아 있으면 컨테이너에 더
      // 가두지 않고 이 스와이프로 섹션을 페이징한다(스크롤 체이닝 — 내부 스크롤이 화면을
      // 크게 차지해도 끝에서 한 번 더 밀면 바로 다음/이전 섹션으로 넘어감).
      if (scroller) {
        // 터치 지점~exempt(.con) 체인에 아직 스크롤 여지가 있으면 네이티브에 양보
        // (내부 중첩 스크롤러 = 자세히보기 동의서 박스가 끝에 안 닿았으면 그게 먼저 스크롤).
        if (innerCanScroll(e.target, scroller, forward)) { active = false; return; }
        paging = true; e.preventDefault(); return;
      }

      // 자유 꼬리(푸터) 구간: 구간 안에서 시작했거나, 경계(tail)에서 아래로
      // 들어가는 제스처는 스냅 경계 없이 네이티브 자유 스크롤.
      var tail = tailStartY();
      if (tail !== Infinity &&
          (y > tail + EDGE_TOL || (forward && y >= tail - EDGE_TOL))) {
        paging = false; tailFree = true;
        // 완전 네이티브 자유 스크롤 — 경계 정착/관성 컷 없음.
        // (처음엔 위로 나갈 때 경계(tail)에 정착시켰지만, 관성 도중 되끌기 +
        //  잠금 해제 후 보정의 이중 이동이 실기기에서 "화면이 출렁이는" 오작동처럼
        //  보여 제거. 위로 흘러나가면 마지막 단락 내부(자유 구간)로 그대로
        //  이어진다. 자유 구간을 완전히 벗어나 멈춘 경우의 정렬은 settle 이
        //  "멈춘 위치에서 가장 가까운 스냅점"으로 한 번만 처리.)
        freeBottom = Infinity;      // 아래 방향 정착/관성 컷 비활성화
        return;
      }

      // 스텝 모드: 긴 단락도 snapStarts 의 중간 스텝으로 페이징하므로
      // 자유 스크롤 판정 없이 모든 세로 스와이프를 페이징으로 처리한다.
      if (window.MO_SNAP_STEP_LONG) { paging = true; e.preventDefault(); return; }

      var ctx = context();
      // 긴 단락은 "정확히 그 끝(상/하단)에 정착해 있을 때만" 다음/이전 단락으로 페이징한다.
      // 끝 근처(loose)에 불과하면 페이징하지 않고 자유 스크롤 → 관성이 먼저 단락 끝
      // (freeBottom)에 정착하고, 거기서 "한 번 더" 스와이프해야 다음 단락으로 넘어간다.
      // (Press 하단 근처에서 스와이프 한 번에 곧장 Contact 로 건너뛰던 문제 수정)
      var atBottomExact = y >= ctx.bottomY - EDGE_TOL;
      var atTopExact = y <= ctx.startY + EDGE_TOL;
      if (forward) paging = !ctx.overflowing || atBottomExact;
      else         paging = !ctx.overflowing || atTopExact;
      // 자유 스크롤로 결정되면(긴 단락 내부) 이 단락의 하단 정착점을 잡아둔다.
      if (!paging) {
        freeBottom = ctx.bottomY;
        // 자유 꼬리가 있고 이 단락이 그 앞 "마지막" 단락이면(하단 정착점 너머에
        // 스냅 목적지가 없으면) 아래쪽을 열어둔다 → 관성이 푸터로 자연스럽게
        // 흘러 들어가고, 경계에서 되끌려오지 않는다(푸터 슬라이드 경계 제거).
        // 단락 하단과 푸터 사이 여백(main 은 76px) 때문에 bottomY==tail 직접
        // 비교로는 판정할 수 없어 "너머에 스냅점 없음"으로 판정한다.
        if (tail !== Infinity) {
          var ptsF = snapStarts();
          if (!ptsF.length || ptsF[ptsF.length - 1] <= freeBottom + EDGE_TOL) freeBottom = Infinity;
        }
      }
      // 단락 내부 → 네이티브 자유 스크롤. active는 끄지 않는다:
      // 꺼버리면 onEnd가 첫 줄(!active)에서 빠져나가 pendingSettle 예약이
      // 죽고, 관성으로 경계를 넘어가도 정착(settle)이 안 걸려 "호로록" 통과함.
      // paging=false면 아래 preventDefault는 어차피 안 불려 네이티브 스크롤 유지.
      if (!paging) return;
    }
    if (vertical && paging) e.preventDefault();      // 경계/짧은 단락 → 우리가 페이징
  }

  function onEnd(e) {
    if (snapOff() || !active) return;
    active = false;
    if (!vertical) return;
    if (paging) {
      // 짧은 단락/경계 → 즉시 한 칸 페이징
      pendingSettle = false;
      var dy = sy - e.changedTouches[0].clientY;
      if (Math.abs(dy) > SWIPE_MIN) go(dy > 0 ? 1 : -1);
    } else {
      // 자유 스크롤(긴 단락 내부/자유 꼬리) → 관성이 완전히 멈춘 뒤 정착 검사.
      // (tailFree 도 켜 둔다: 위로 자유 구간을 완전히 벗어나 멈춘 경우
      //  가장 가까운 스냅점 정렬이 필요. 구간 안에서 멈추면 settle 이 통과시킴.)
      pendingSettle = true;
    }
  }

  /* ── 경계 정착(scroll-settle) ──
     자유 스크롤의 관성이 "완전히 멈춘 뒤" 딱 한 번만 정렬한다(관성과 싸우지 않음).
     - 아래 방향: 이번 제스처가 머문 긴 단락의 하단 정착점(freeBottom)에 정착.
       다음 단락으로는 넘기지 않는다 — 한 번 더 스와이프해야 페이징(go)된다.
       (긴 단락 하단에 일단 멈춰 마지막 콘텐츠를 보여주는 기존 감각 유지.)
     - 위 방향: 고정 기준점 없이 "멈춘 위치"에서 다시 판단한다.
       자유 꼬리(푸터) 구간이거나 긴 단락 내부(상단에서 EDGE_REACH 밖)면 그대로,
       그 외(단락 상단을 지났거나 짧은 단락 위)는 가장 가까운 스냅점으로 정착.
       원래 단락 상단으로 길게 되끌지 않으므로 자유 스크롤 → 섹션 스냅 전환이
       출렁임 없이 이어진다(위로 가던 화면을 아래로 확 되돌리는 이동이 없음). */
  function settle() {
    pendingSettle = false;
    if (locked || snapOff()) return;
    if (document.body.classList.contains('mo-menu-open')) return;
    if (isExempt(document.activeElement)) return;

    var y1 = scrollY();
    var d = y1 - y0;
    if (Math.abs(d) < SWIPE_MIN) return;          // 미세 이동(가로 스와이프 등)은 무시

    var target;
    if (d > 0) {
      if (y1 < freeBottom - EDGE_REACH) return;    // 아래로 읽는 중 → 자유
      target = freeBottom;                         // 이 단락 하단에 정착(다음 단락은 한 번 더 스와이프)
    } else {
      if (y1 >= tailStartY() - EDGE_TOL) return;   // 자유 꼬리(푸터) 안 → 자유
      var c = context();
      // 긴 단락의 "읽기 구간"(상단 정착점+REACH ~ 하단 정착점 사이) → 자유.
      // 하단 정착점 초과(= 이 단락 하단과 다음 단락 사이에 걸침)는 읽기 구간이
      // 아니므로 아래의 정렬 대상이다(career slide-3 처럼 연속된 긴 단락 사이
      // 틈에 멈춰 화면이 경계에 걸친 채 방치되던 문제).
      if (c.overflowing && y1 > c.startY + EDGE_REACH && y1 <= c.bottomY + EDGE_TOL) return;
      // 그 외: 멈춘 곳에서 가장 가까운 정렬점으로 딱 한 번 이동.
      // 후보 = 스냅점들 + (긴 단락 위라면) 그 단락의 하단 정착점 —
      // 하단 정착점~다음 단락 틈에 멈췄을 때 멀리 있는 스냅점으로 크게
      // 점프하지 않고 제일 가까운 자연스러운 정렬로 끝낸다.
      var pts = snapStarts(), best = null;
      if (c.overflowing) pts = pts.concat([c.bottomY]);
      for (var i = 0; i < pts.length; i++) {
        if (best == null || Math.abs(pts[i] - y1) < Math.abs(best - y1)) best = pts[i];
      }
      if (best == null) return;
      target = best;
    }

    if (Math.abs(y1 - target) <= EDGE_TOL) { y0 = target; return; }  // 이미 정렬됨
    // 딱 한 번만 부드럽게 이동(되끌기/재보정 없음 → 흔들림 없이 "한 번만" 왔다갔다).
    locked = true;
    window.scrollTo({ top: target, behavior: 'smooth' });
    setTimeout(function () { locked = false; y0 = target; }, LOCK_MS);
  }

  /* 모바일 관성(momentum) 스크롤을 끊는다.
     관성 중 scrollTo(smooth)는 기기가 씹어 무시되므로, 스크롤 루트의 overflow 를
     같은 task 안에서 hidden→복구로 토글해 리플로우를 강제하면 진행 중인 관성이 취소된다.
     토글과 복구가 한 task(동기) 안에서 일어나 중간 상태는 화면에 그려지지 않으므로
     맨 위로 튀는 점프는 보이지 않는다. 관성을 끊은 뒤엔 smooth 가 정상 동작한다. */
  function killMomentum() {
    var root = document.scrollingElement || document.documentElement;
    var ov = root.style.overflow;
    root.style.overflow = 'hidden';
    void root.offsetHeight;            // 강제 리플로우 → 관성 취소
    root.style.overflow = ov;
  }

  function onScroll() {
    if (!pendingSettle || locked || snapOff()) return;

    // 아래 방향 한정: 관성이 단락 하단을 MAX_OVER 이상 지나치려 하면, 멀리 흐르기
    // 전에 관성을 끊고 하단으로 한 번만 정착시킨다(다음 단락으로 호로록 새는 것 방지).
    // 위 방향은 관성을 절대 끊지 않는다 — 관성 도중 개입(컷+되끌기+보정)이
    // 실기기에서 "화면이 출렁이는" 오작동으로 보임. 멈춘 뒤 settle 이 가장
    // 가까운 스냅점으로만 정렬한다.
    var y = scrollY();
    var d = y - y0;
    if (Math.abs(d) >= SWIPE_MIN) {
      var over = (d > 0 && y > freeBottom + MAX_OVER) ? freeBottom : null;
      if (over != null) {
        pendingSettle = false;
        if (settleT) { clearTimeout(settleT); settleT = null; }
        locked = true;
        killMomentum();
        window.scrollTo({ top: over, behavior: 'smooth' });
        var t = over;
        setTimeout(function () {
          locked = false; y0 = t;
          // 혹시 기기가 관성을 못 끊어 끝에 못 닿았으면(이 시점엔 관성도 끝남) 마지막 보정.
          if (Math.abs(scrollY() - t) > EDGE_REACH) window.scrollTo({ top: t, behavior: 'smooth' });
        }, LOCK_MS);
        return;
      }
    }

    // 끝 근처(MAX_OVER 이내)에서 멈춘 경우는 관성이 멈춘 뒤(디바운스) settle 로 정착.
    // (관성이 멈춘 뒤라 smooth 가 안 씹힘 → 한 번만 왔다갔다)
    if (settleT) clearTimeout(settleT);
    settleT = setTimeout(settle, SETTLE_MS);
  }

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', function () { active = false; }, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true });
})();
