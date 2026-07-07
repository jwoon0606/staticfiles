/* ============================================================================
 * light-find-price.js — Step 4 "Fixture Price" 분포 차트(코드 구현).
 *
 * 기존 정적 PNG(lf-price-chart.png)를 대체. 원본 에셋에서 픽셀로 추출한 막대
 * 높이/좌표를 그대로 코드로 렌더하고, price range 슬라이더의 두 핸들을 드래그해
 * 가격 구간을 좁힐 수 있게 한다. "number of products" 옆 숫자는 선택 구간 안에
 * 들어오는 막대 값의 합으로 실시간 갱신되고, 구간 밖 막대는 회색으로 흐려진다.
 *
 * 비고: 막대 분포는 원본 이미지를 그대로 옮긴 대표값이다(실데이터 바인딩은 추후).
 *   Basic/Standard/Premium ⓘ(비교 모달)는 light-find-config.js 가 계속 담당.
 * ========================================================================== */
(function () {
  "use strict";

  var chart = document.querySelector("[data-pricechart]");
  if (!chart) return;

  var barsWrap = chart.querySelector("[data-pc-bars]");
  var track = chart.querySelector("[data-pc-track]");
  var fill = chart.querySelector("[data-pc-fill]");
  var thumbMin = chart.querySelector('[data-pc-thumb="min"]');
  var thumbMax = chart.querySelector('[data-pc-thumb="max"]');
  var countEl = chart.querySelector("[data-pc-count]");
  if (!barsWrap || !track || !thumbMin || !thumbMax) return;

  // 원본 PNG 에서 추출한 22개 막대의 상대 높이(%) ----------------------------
  var BAR_VALUES = [7, 5, 10, 5, 25, 55, 85, 100, 91, 91, 79, 91, 51, 71, 79, 75, 51, 43, 24, 5, 12, 7];

  // 막대 렌더 ---------------------------------------------------------------
  var barEls = BAR_VALUES.map(function (v) {
    var b = document.createElement("span");
    b.className = "lfc-pc__bar";
    b.style.height = Math.max(v, 2) + "%";
    barsWrap.appendChild(b);
    return b;
  });

  // 막대 i 의 "트랙상 위치"(0=Basic … 1=Premium).
  //   막대는 컨테이너 28.4%~87.8% 에 균등 배치, 트랙은 11.2%~87.8%.
  var BARS_L = 28.4, BARS_R = 87.8, TRACK_L = 11.2, TRACK_R = 87.8;
  var n = BAR_VALUES.length;
  var barPos = BAR_VALUES.map(function (_, i) {
    var containerPct = BARS_L + ((i + 0.5) / n) * (BARS_R - BARS_L);
    return (containerPct - TRACK_L) / (TRACK_R - TRACK_L); // 0..1
  });

  // 슬라이더 상태(트랙 기준 0..1). 기본값은 원본 핸들 위치(≈0.23 / 1.0).
  var GAP = 0.04; // 두 핸들 최소 간격
  var state = { min: 0.232, max: 1.0 };

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function render() {
    thumbMin.style.left = (state.min * 100) + "%";
    thumbMax.style.left = (state.max * 100) + "%";
    if (fill) {
      fill.style.left = (state.min * 100) + "%";
      fill.style.width = ((state.max - state.min) * 100) + "%";
    }
    var sum = 0;
    barEls.forEach(function (b, i) {
      var inRange = barPos[i] >= state.min - 1e-6 && barPos[i] <= state.max + 1e-6;
      b.classList.toggle("is-dim", !inRange);
      if (inRange) sum += BAR_VALUES[i];
    });
    thumbMin.setAttribute("aria-valuetext", Math.round(state.min * 100) + "%");
    thumbMax.setAttribute("aria-valuetext", Math.round(state.max * 100) + "%");
    if (countEl) countEl.textContent = String(sum);
    // 선택 구간을 외부(결과 필터 등)에서 쓸 수 있게 보관
    chart.dataset.pcMin = String(state.min);
    chart.dataset.pcMax = String(state.max);
  }

  // 포인터 x → 트랙상 0..1
  function fracFromEvent(e) {
    var rect = track.getBoundingClientRect();
    if (!rect.width) return 0;
    return clamp((e.clientX - rect.left) / rect.width);
  }

  function startDrag(which, e) {
    e.preventDefault();
    var thumb = which === "min" ? thumbMin : thumbMax;
    try { thumb.setPointerCapture(e.pointerId); } catch (err) {}

    function move(ev) {
      var f = fracFromEvent(ev);
      if (which === "min") state.min = Math.min(f, state.max - GAP);
      else state.max = Math.max(f, state.min + GAP);
      state.min = clamp(state.min); state.max = clamp(state.max);
      render();
    }
    function up(ev) {
      try { thumb.releasePointerCapture(e.pointerId); } catch (err) {}
      thumb.removeEventListener("pointermove", move);
      thumb.removeEventListener("pointerup", up);
      thumb.removeEventListener("pointercancel", up);
    }
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", up);
    thumb.addEventListener("pointercancel", up);
  }

  thumbMin.addEventListener("pointerdown", function (e) { startDrag("min", e); });
  thumbMax.addEventListener("pointerdown", function (e) { startDrag("max", e); });

  // 트랙 클릭 → 가까운 핸들을 그 지점으로 이동
  track.addEventListener("pointerdown", function (e) {
    if (e.target === thumbMin || e.target === thumbMax) return;
    var f = fracFromEvent(e);
    if (Math.abs(f - state.min) <= Math.abs(f - state.max)) {
      state.min = clamp(Math.min(f, state.max - GAP));
    } else {
      state.max = clamp(Math.max(f, state.min + GAP));
    }
    render();
  });

  // 키보드 접근성(←/→) -----------------------------------------------------
  function keyNudge(which, e) {
    var step = (e.key === "ArrowLeft" || e.key === "ArrowDown") ? -0.02
             : (e.key === "ArrowRight" || e.key === "ArrowUp") ? 0.02 : 0;
    if (!step) return;
    e.preventDefault();
    if (which === "min") state.min = clamp(Math.min(state.min + step, state.max - GAP));
    else state.max = clamp(Math.max(state.max + step, state.min + GAP));
    render();
  }
  thumbMin.addEventListener("keydown", function (e) { keyNudge("min", e); });
  thumbMax.addEventListener("keydown", function (e) { keyNudge("max", e); });
  thumbMin.setAttribute("role", "slider");
  thumbMax.setAttribute("role", "slider");
  thumbMin.setAttribute("tabindex", "0");
  thumbMax.setAttribute("tabindex", "0");

  render();
})();
