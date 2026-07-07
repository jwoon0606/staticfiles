/* ============================================================================
 * light-find-one.js — "Light Find one (beta)" 페이지 전체 동작 (단일 파일 통합)
 *
 * light-find-one.html 한 파일에서만 쓰이던 2개 조각을 하나로 합쳤습니다.
 * 각 섹션은 독립 IIFE 입니다:
 *   1) Step 1: 파일 업로드 + 진행 모달 → 완료 시 Step 2 로 전환
 *   2) Step 2: Fixture Proposal (대기 → 추천 결과, 카드 선택)
 *
 * 두 섹션은 window.lfRevealProposal() 로 연결됩니다(Step 2 가 정의, Step 1 이 호출).
 * 호출은 사용자 동작 이후라 두 IIFE 의 초기화 순서와 무관합니다.
 *
 * 사용법: <body> 끝에서  <script src="js/light-find-one.js" defer></script>
 * ========================================================================== */

/* ===== [1] Step 1: 업로드 + 단계 전환 =================================== */
(function () {
  "use strict";

  var MAX_BYTES = 50 * 1024 * 1024;                    // 50MB
  var ACCEPT = ["image/jpeg", "image/png", "application/pdf"];

  // Material 아이콘 (24x24) — 행 안에 인라인으로 삽입
  var ICON_ARTICLE =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M5.308 20.5c-.505 0-.933-.175-1.283-.525S3.5 19.197 3.5 18.692V5.308c0-.505.175-.933.525-1.283S4.803 3.5 5.308 3.5h13.384c.505 0 .933.175 1.283.525s.525.778.525 1.283v13.384c0 .505-.175.933-.525 1.283s-.778.525-1.283.525H5.308ZM7.25 16.75h6.5v-1.5h-6.5v1.5Zm0-4h9.5v-1.5h-9.5v1.5Zm0-4h9.5v-1.5h-9.5v1.5Z"/>' +
    "</svg>";
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M8.392 16.679 7.321 15.616 10.93 12 7.321 8.41 8.392 7.346 12 10.952l3.583-3.606 1.071 1.063L13.046 12l3.608 3.616-1.071 1.063L12 13.073l-3.608 3.606Z"/>' +
    "</svg>";

  function isAllowed(file) {
    return ACCEPT.indexOf(file.type) !== -1;
  }

  function init() {
    var zone = document.querySelector("[data-dropzone]");
    if (!zone) return;
    var input = zone.querySelector("[data-file-input]");
    var list = zone.querySelector("[data-file-list]");
    var errorOut = zone.querySelector("[data-file-error]");
    var next = document.querySelector("[data-next]");   // NEXT (파일 있을 때만 활성)

    var files = [];                                     // 선택된 파일들 (검증 통과분)

    // 파일 유무에 따라 NEXT 활성/비활성 (Light Find 의 .lf-next 와 동일 패턴)
    function syncNext() {
      if (!next) return;
      var enabled = files.length > 0;
      next.classList.toggle("is-enabled", enabled);
      next.setAttribute("aria-disabled", enabled ? "false" : "true");
    }

    // ── 단일 페이지 단계 전환 ──────────────────────────────────────────────
    // 업로드 화면(.lf-wizard[data-step="1"])과 Fixture Proposal(.lf-wizard
    // [data-step="2"])이 같은 페이지에 있고, 패널을 show/hide 로 전환한다
    // (예전엔 light-find-two.html 로 이동).
    var panels = Array.prototype.slice.call(
      document.querySelectorAll("main [data-step]")
    );

    function showStep(n) {
      var target = null;
      panels.forEach(function (panel) {
        var on = panel.getAttribute("data-step") === String(n);
        panel.hidden = !on;
        if (on) target = panel;
      });
      if (!target) return;
      var hero = document.querySelector(".lf-hero");
      if (hero && typeof hero.scrollIntoView === "function") {
        hero.scrollIntoView({ block: "start" });
      } else {
        window.scrollTo(0, 0);
      }
      if (typeof target.focus === "function") {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }

    // BACK 등 [data-go] 버튼 → 해당 단계로 (비활성 버튼은 무시).
    // Step 2 의 BACK 은 추천 결과가 나오기 전(대기 중)엔 aria-disabled 라 무시된다.
    document.querySelectorAll("main [data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.getAttribute("aria-disabled") === "true") return;
        showStep(btn.getAttribute("data-go"));
      });
    });

    // ── 업로드 진행 모달 ("Uploading files") ───────────────────────────────
    var modal = document.querySelector("[data-upload-modal]");
    var fill = modal && modal.querySelector("[data-progress-fill]");
    var pct = modal && modal.querySelector("[data-progress-pct]");
    var closeBtn = modal && modal.querySelector("[data-upload-close]");
    var timer = null;

    function setProgress(value) {
      var v = Math.max(0, Math.min(100, Math.round(value)));
      if (fill) fill.style.width = v + "%";
      if (pct) pct.textContent = v + "%";
    }

    function closeModal() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (modal) modal.setAttribute("hidden", "");
    }

    function openModal() {
      if (!modal) return;
      if (timer) clearInterval(timer);
      setProgress(0);
      modal.removeAttribute("hidden");
      if (closeBtn) closeBtn.focus();

      // 업로드 진행 시뮬레이션: 0 → 100% 후 자동으로 닫힘
      var value = 0;
      timer = setInterval(function () {
        value += 4 + Math.floor(value / 12);             // 끝으로 갈수록 약간 빨라짐
        if (value >= 100) {
          setProgress(100);
          clearInterval(timer);
          timer = null;
          // 업로드 완료 → 진행 창 닫고 같은 페이지에서 Step 2(Fixture Proposal)로 전환
          // (memo: "끝나면 진행도 창 꺼지도록" + 완료 후 다음 단계로)
          window.setTimeout(function () {
            closeModal();
            showStep(2);
            // Step 2 진입 → 대기 → 추천 결과 데모 시작(Step 2 섹션 제공)
            if (typeof window.lfRevealProposal === "function") {
              window.lfRevealProposal();
            }
          }, 500);
          return;
        }
        setProgress(value);
      }, 120);
    }

    // NEXT 클릭: 비활성이면 막고, 활성이면 진행 모달 표시 (href="#" 이동 방지)
    if (next) {
      next.addEventListener("click", function (event) {
        event.preventDefault();
        if (next.getAttribute("aria-disabled") === "true") return;
        openModal();
      });
    }

    // 닫기(×) · 오버레이 클릭 · Esc 로 모달 닫기
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeModal();        // 딤 영역(다이얼로그 바깥) 클릭
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal && !modal.hasAttribute("hidden")) closeModal();
    });

    function key(f) {
      return f.name + "::" + f.size;
    }

    function render() {
      if (!list) return;
      list.textContent = "";
      files.forEach(function (file, index) {
        var li = document.createElement("li");
        li.className = "lf-file";

        var main = document.createElement("span");
        main.className = "lf-file__main";

        var icon = document.createElement("span");
        icon.className = "lf-file__icon";
        icon.innerHTML = ICON_ARTICLE;                  // 정적 아이콘 마크업

        var name = document.createElement("span");
        name.className = "lf-file__name";
        name.textContent = file.name;                   // 파일명은 textContent 로 (XSS 방지)

        main.appendChild(icon);
        main.appendChild(name);

        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "lf-file__remove";
        remove.setAttribute("aria-label", "Remove " + file.name);
        remove.innerHTML = ICON_CLOSE;
        remove.addEventListener("click", function () {
          files.splice(index, 1);
          render();
        });

        li.appendChild(main);
        li.appendChild(remove);
        list.appendChild(li);
      });

      if (files.length) {
        list.removeAttribute("hidden");
      } else {
        list.setAttribute("hidden", "");
      }

      syncNext();
    }

    function addFiles(fileList) {
      if (!fileList || !fileList.length) return;
      var rejected = [];
      Array.prototype.forEach.call(fileList, function (file) {
        if (!isAllowed(file)) {
          rejected.push(file.name + " (unsupported type)");
          return;
        }
        if (file.size > MAX_BYTES) {
          rejected.push(file.name + " (over 50MB)");
          return;
        }
        var dup = files.some(function (f) {
          return key(f) === key(file);
        });
        if (!dup) files.push(file);
      });

      if (errorOut) {
        errorOut.textContent = rejected.length
          ? "Skipped: " + rejected.join(", ")
          : "";
      }
      render();
    }

    // BROWSE FILE 로 고른 파일 (value 초기화로 같은 파일 재선택도 감지)
    if (input) {
      input.addEventListener("change", function () {
        addFiles(input.files);
        input.value = "";
      });
    }

    // 드래그 강조 (.is-dragover)
    ["dragenter", "dragover"].forEach(function (type) {
      zone.addEventListener(type, function (event) {
        event.preventDefault();
        zone.classList.add("is-dragover");
      });
    });
    ["dragleave", "dragend", "drop"].forEach(function (type) {
      zone.addEventListener(type, function (event) {
        event.preventDefault();
        zone.classList.remove("is-dragover");
      });
    });

    // 드롭한 파일 추가
    zone.addEventListener("drop", function (event) {
      var dt = event.dataTransfer;
      if (dt && dt.files) addFiles(dt.files);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ===== [2] Step 2: Fixture Proposal ==================================== */
(function () {
  "use strict";

  var DELAY = 2000;                                     // 2초 후 결과 표시
  var started = false;                                  // 중복 시작 방지

  function init() {
    var waiting = document.querySelector("[data-waiting]");
    var result = document.querySelector("[data-result]");
    var back = document.querySelector("[data-back]");

    // 비활성(대기) 상태의 BACK 클릭은 이동 막기 (standalone <a> 호환)
    if (back) {
      back.addEventListener("click", function (event) {
        if (back.getAttribute("aria-disabled") === "true") event.preventDefault();
      });
    }

    if (!result) return;

    // 대기 → 결과 전환. Step 2 진입 시 호출(또는 standalone 에선 자동).
    function reveal() {
      if (started) return;                               // 한 번만
      started = true;
      window.setTimeout(function () {
        if (waiting) waiting.setAttribute("hidden", "");
        result.removeAttribute("hidden");
        if (back) {
          back.classList.add("is-enabled");              // BACK 활성(검정)
          back.setAttribute("aria-disabled", "false");
        }
      }, DELAY);
    }

    // 다른 스크립트(light-find-one.js)가 단계 진입 시 호출할 수 있게 노출
    window.lfRevealProposal = reveal;

    // ── 추천 카드 선택 (UI_06) ─────────────────────────────────────────────
    // 카드를 클릭하면 선택(검정 테두리) + Step 2 의 NEXT 활성(검정).
    var panel = result.closest("[data-step]");
    var select = result.hasAttribute("data-select") ? result : result.querySelector("[data-select]");
    // Step 2 영역의 NEXT 만 대상으로 (Step 1 NEXT 와 구분)
    var next = (panel || document).querySelector(".lf-steps__nav--next");

    function setSelected(on) {
      if (!select) return;
      select.classList.toggle("is-selected", on);
      select.setAttribute("aria-pressed", on ? "true" : "false");
      if (next) {
        next.classList.toggle("is-enabled", on);         // NEXT 활성(검정)/비활성(회색)
        next.setAttribute("aria-disabled", on ? "false" : "true");
      }
    }

    if (select) {
      select.addEventListener("click", function () {
        setSelected(!select.classList.contains("is-selected"));
      });
      // 키보드(Enter/Space)로도 선택 토글
      select.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          setSelected(!select.classList.contains("is-selected"));
        }
      });
    }

    // 비활성(미선택) NEXT 클릭은 막기
    if (next) {
      next.addEventListener("click", function (event) {
        if (next.getAttribute("aria-disabled") === "true") event.preventDefault();
      });
    }

    // Step 2 패널이 처음부터 보이면(=standalone) 자동 시작.
    // [data-step] 래퍼가 hidden 이면(=통합 페이지) 진입 시점까지 대기.
    if (!panel || !panel.hidden) reveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
