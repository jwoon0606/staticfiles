/* ============================================================================
 * light-design.js — Light Design 페이지 전체 동작 (단일 파일 통합)
 *
 * light-design.html 한 파일에서만 쓰이던 4개 조각을 하나로 합쳤습니다.
 * 각 섹션은 독립 IIFE 라 로드 순서에 영향을 주지 않습니다:
 *   1) Step 1: Project Type 카드 라디오
 *   2) Step 2: Further Information 업로드 + 진행 모달
 *   3) Step 3: Service Options 티어 라디오
 *   4) Wizard: NEXT/BACK/DONE 단계 전환 + 로그인 요청 모달
 *
 * 사용법: <body> 끝에서  <script src="js/light-design.js" defer></script>
 * ========================================================================== */

(function () {
  "use strict";

  function initOptions() {
    var group = document.querySelector(".ld-options[role='radiogroup']");
    if (!group) return;

    var cards = Array.prototype.slice.call(
      group.querySelectorAll(".ld-card[role='radio']")
    );
    if (!cards.length) return;

    // 한 카드를 선택 상태로 만들고 나머지는 해제 (라디오 동작)
    function select(card, focus) {
      cards.forEach(function (c) {
        var on = c === card;
        c.classList.toggle("ld-card--selected", on);
        c.setAttribute("aria-checked", on ? "true" : "false");
      });
      if (focus) card.focus();
    }

    cards.forEach(function (card, index) {
      card.addEventListener("click", function () {
        select(card, false);
      });

      // ←/↑ 이전, →/↓ 다음 카드로 이동하며 즉시 선택 (radiogroup 표준)
      card.addEventListener("keydown", function (event) {
        var key = event.key;
        var next = null;
        if (key === "ArrowRight" || key === "ArrowDown") {
          next = cards[(index + 1) % cards.length];
        } else if (key === "ArrowLeft" || key === "ArrowUp") {
          next = cards[(index - 1 + cards.length) % cards.length];
        }
        if (next) {
          event.preventDefault();
          select(next, true);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOptions);
  } else {
    initOptions();
  }
})();

/* ===== [2] Step 2: Further Information 업로드 ============================= */
(function () {
  "use strict";

  // 허용 확장자(소문자). MIME 가 비는 CAD 까지 커버하려고 확장자로 검사.
  var ACCEPT_EXT = ["jpg", "jpeg", "png", "pdf", "dwg", "dxf", "dwf"];

  // 파일 행 아이콘 (Material "article" 문서 / "close" X) — 24px
  var ICON_ARTICLE =
    'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z';
  var ICON_CLOSE =
    'M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z';

  function extOf(name) {
    var dot = name.lastIndexOf(".");
    return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
  }

  function init() {
    var zone = document.querySelector("[data-dropzone]");
    if (!zone) return;
    var input = zone.querySelector("[data-file-input]");
    var nameOut = zone.querySelector("[data-file-name]");
    var fileListEl = zone.querySelector("[data-filelist]");
    var fieldEl = document.querySelector(".ld-field");
    var nextBtn = document.querySelector("[data-next]");   // 스텝 버튼 (NEXT↔DONE)

    // ── 업로드 모달 요소 ──────────────────────────────────────────────────
    var modal = document.querySelector("[data-upload-modal]");
    var fill = modal && modal.querySelector("[data-upload-fill]");
    var pctOut = modal && modal.querySelector("[data-upload-pct]");
    var track = modal && modal.querySelector(".ld-progress__track");
    var closeBtn = modal && modal.querySelector("[data-upload-close]");

    var uploaded = [];                                  // 업로드 완료된 파일들 [{name}]
    var pending = [];                                   // 이번 업로드에 올릴 유효 파일들
    var timer = null;                                   // 진행률 증가 인터벌
    var closeTimer = null;                              // 100% 후 자동 닫힘 타이머
    var AUTO_CLOSE_MS = 700;                            // 완료 후 잠깐 보여주고 닫음
    var prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // ── 진행 모달 ─────────────────────────────────────────────────────────
    function setProgress(p) {
      p = Math.max(0, Math.min(100, Math.round(p)));
      if (fill) fill.style.width = p + "%";
      if (pctOut) pctOut.textContent = p + "%";
      if (track) track.setAttribute("aria-valuenow", String(p));
    }

    function clearTimers() {
      if (timer) { clearInterval(timer); timer = null; }
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    }

    function closeModal() {
      clearTimers();
      if (modal) modal.hidden = true;
    }

    // ── 업로드 후 상태 전환 (node 5091:1143) ──────────────────────────────
    // 버튼: NEXT(회색 #b6bbc5) ↔ DONE(검정). 필드: 회색 placeholder ↔ 검정.
    function setUploaded(on) {
      if (nextBtn) {
        nextBtn.classList.toggle("ld-steps__nav--disabled", !on);
        nextBtn.setAttribute("aria-disabled", on ? "false" : "true");
        var label = nextBtn.querySelector("span");
        if (label) label.textContent = on ? "DONE" : "NEXT";
      }
      // 추가 정보 입력(textarea)은 업로드 상태와 독립적이므로 여기서 건드리지 않는다.
    }

    function svgIcon(cls, path) {
      return (
        '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="' + path + '" fill="currentColor" /></svg>'
      );
    }

    function renderFileList() {
      if (!fileListEl) return;
      fileListEl.innerHTML = "";
      if (!uploaded.length) {
        fileListEl.hidden = true;
        return;
      }
      fileListEl.hidden = false;
      uploaded.forEach(function (item, idx) {
        var li = document.createElement("li");
        li.className = "ld-fileitem";
        li.innerHTML =
          '<span class="ld-fileitem__main">' +
          svgIcon("ld-fileitem__icon", ICON_ARTICLE) +
          '<span class="ld-fileitem__name"></span></span>' +
          '<button type="button" class="ld-fileitem__remove" aria-label="Remove file">' +
          svgIcon("", ICON_CLOSE) +
          "</button>";
        li.querySelector(".ld-fileitem__name").textContent = item.name;
        li.querySelector(".ld-fileitem__remove").addEventListener("click", function () {
          removeFile(idx);
        });
        fileListEl.appendChild(li);
      });
    }

    // 업로드된 파일 목록을 sessionStorage 에 저장({name, path}[]) → 완료/상세 페이지에서
    // 다운로드 링크로 사용한다. path 는 서버 저장 경로(/image/<파일명>).
    function persist() {
      try { sessionStorage.setItem("optomatic_ld_files", JSON.stringify(uploaded)); } catch (e) {}
    }

    function removeFile(idx) {
      uploaded.splice(idx, 1);
      renderFileList();
      persist();
      if (!uploaded.length) setUploaded(false);         // 모두 제거 → 업로드 전 상태로
    }

    // 업로드 완료(100%) → 목록 갱신·DONE 활성·필드 채움, 잠깐 뒤 모달 자동 닫힘
    function finish() {
      setProgress(100);
      pending.forEach(function (f) {
        var dup = uploaded.some(function (u) { return u.path === f.path; });
        if (!dup) uploaded.push({ name: f.name, path: f.path });
      });
      pending = [];
      renderFileList();
      persist();
      setUploaded(uploaded.length > 0);
      clearTimers();
      closeTimer = setTimeout(closeModal, AUTO_CLOSE_MS);
    }

    // 단일 파일 업로드(XHR). fetch 와 달리 upload.onprogress 로 "올라가는 중" 진행률을
    // 0~1 로 전달받을 수 있어, 진행바(초록)가 실제로 차오른다. onProgress(frac) 호출.
    function uploadOne(file, onProgress) {
      return new Promise(function (resolve) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/default/uploadFile");
          if (xhr.upload) {
            xhr.upload.onprogress = function (e) {
              if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
            };
          }
          xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              var fname = (xhr.responseText || "").trim();
              resolve(fname ? { name: file.name, path: "/image/" + fname } : null);
            } else {
              resolve(null);
            }
          };
          xhr.onerror = function () { resolve(null); };
          var fd = new FormData();
          fd.append("file", file);
          xhr.send(fd);
        } catch (e) { resolve(null); }
      });
    }

    // 실제 업로드: pending 의 원본 File 들을 서버(/api/default/uploadFile)로 올리고
    // 저장 경로를 받아 {name, path} 로 모은 뒤 finish() 로 목록에 반영한다.
    async function openUpload() {
      clearTimers();
      var rawFiles = pending.slice();                   // 이번에 올릴 원본 File 들
      if (modal) { modal.hidden = false; if (closeBtn) closeBtn.focus(); }
      setProgress(0);

      var results = [];
      var total = rawFiles.length || 1;
      for (var i = 0; i < rawFiles.length; i++) {
        var base = i;                                   // 이미 끝난 파일 수
        // 전체 진행률 = (끝난 파일 수 + 현재 파일 업로드 비율) / 전체 파일 수
        var r = await uploadOne(rawFiles[i], function (frac) {
          setProgress(((base + frac) / total) * 100);
        });
        if (r) results.push(r);
        setProgress(((i + 1) / total) * 100);
      }
      pending = results;                                // 업로드 결과({name,path})로 교체
      if (!results.length && nameOut) {
        nameOut.textContent = "Upload failed — please try again.";
      }
      finish();
    }

    // 선택/드롭된 파일들 처리: 유효한 것만 모아 업로드 시작
    function handleFiles(fileList) {
      if (!fileList || !fileList.length) return;
      var valid = [];
      for (var i = 0; i < fileList.length; i++) {
        if (ACCEPT_EXT.indexOf(extOf(fileList[i].name)) !== -1) valid.push(fileList[i]);
      }
      if (!valid.length) {
        if (nameOut) nameOut.textContent = "Unsupported file type — use JPG, PNG, PDF, or CAD.";
        return;
      }
      if (nameOut) nameOut.textContent = "";
      pending = valid;
      openUpload();
    }

    // ── 입력: BROWSE FILE / 드래그&드롭 ──────────────────────────────────
    if (input) {
      input.addEventListener("change", function () {
        handleFiles(input.files);
      });
    }

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
    zone.addEventListener("drop", function (event) {
      var dt = event.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      if (input) {
        try {
          input.files = dt.files;                       // 최신 브라우저: 할당 가능
        } catch (e) {
          /* 구형 브라우저는 할당 불가 — 파일 처리만 진행 */
        }
      }
      handleFiles(dt.files);
    });

    // ── 비활성(회색) NEXT 는 클릭해도 이동 안 함 ─────────────────────────
    if (nextBtn) {
      nextBtn.addEventListener("click", function (event) {
        if (nextBtn.getAttribute("aria-disabled") === "true") event.preventDefault();
      });
    }

    // ── 모달 닫기: X 버튼 · 배경 클릭 · ESC ──────────────────────────────
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeModal();       // 배경(오버레이) 클릭만
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal && !modal.hidden) closeModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ===== [2b] Step 2: 추가 정보 — 라벨(고정) 삭제 방지 ===================== */
(function () {
  "use strict";
  function isLabel(node) {
    return node && node.nodeType === 1 && node.classList && node.classList.contains("ld-field__label");
  }
  function labelAncestor(node, root) {
    while (node && node !== root) {
      if (isLabel(node)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function init() {
    var list = document.querySelector(".ld-field__list[contenteditable]");
    if (!list) return;

    // 삭제(backspace/delete) 가 라벨(공백 포함)을 건드리려 하면 막는다.
    list.addEventListener("beforeinput", function (e) {
      var type = e.inputType || "";
      if (type.indexOf("delete") !== 0) return;          // 삭제 계열만 검사

      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var range = sel.getRangeAt(0);

      // 1) 선택 영역 삭제: 라벨이 끼어 있으면 차단
      if (!range.collapsed) {
        if (labelAncestor(range.startContainer, list) || labelAncestor(range.endContainer, list)) {
          e.preventDefault(); return;
        }
        var frag = range.cloneContents();
        if (frag.querySelector && frag.querySelector(".ld-field__label")) { e.preventDefault(); return; }
        return;
      }

      // 2) 커서 위치에서의 삭제
      var node = range.startContainer;
      var offset = range.startOffset;
      var backward = type.indexOf("Backward") !== -1;

      if (backward) {
        // 값의 맨 앞에서 Backspace → 바로 앞 라벨(또는 줄 시작) 보호
        if (node.nodeType === 3) {
          if (offset === 0) {
            var prev = node.previousSibling;
            if (isLabel(prev) || !prev) { e.preventDefault(); return; }
          }
        } else if (node.nodeType === 1) {
          var beforeNode = node.childNodes[offset - 1];
          if (isLabel(beforeNode) || offset === 0) { e.preventDefault(); return; }
        }
      } else {
        // 정방향 Delete: 줄 끝에서 다음 줄(라벨)로 병합되는 것 차단
        if (node.nodeType === 3 && offset === node.length && !node.nextSibling) {
          e.preventDefault(); return;
        }
        if (node.nodeType === 1) {
          var afterNode = node.childNodes[offset];
          if (isLabel(afterNode)) { e.preventDefault(); return; }
        }
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ===== [3] Step 3: Service Options 티어 ================================== */
(function () {
  "use strict";

  function init() {
    var group = document.querySelector(".ld-tiers[role='radiogroup']");
    if (!group) return;

    var tiers = Array.prototype.slice.call(
      group.querySelectorAll(".ld-tier[role='radio']")
    ).filter(function (t) {
      // 선택 불가(disabled / aria-disabled) 카드는 라디오 동작에서 제외
      return !t.disabled && t.getAttribute("aria-disabled") !== "true";
    });
    if (!tiers.length) return;

    // 한 카드를 선택 상태로, 나머지는 해제 (라디오 동작) + 로빙 tabindex
    function select(tier, focus) {
      tiers.forEach(function (t) {
        var on = t === tier;
        t.classList.toggle("ld-tier--selected", on);
        t.setAttribute("aria-checked", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tier.focus();
    }

    // 초기: 현재 선택(aria-checked=true)에 포커스 가능하도록 tabindex 설정
    var current = tiers.filter(function (t) {
      return t.getAttribute("aria-checked") === "true";
    })[0] || tiers[0];
    tiers.forEach(function (t) {
      t.tabIndex = t === current ? 0 : -1;
    });

    tiers.forEach(function (tier, index) {
      tier.addEventListener("click", function () {
        select(tier, false);
      });

      // ←/↑ 이전, →/↓ 다음 카드로 이동하며 즉시 선택 (radiogroup 표준)
      tier.addEventListener("keydown", function (event) {
        var key = event.key;
        var next = null;
        if (key === "ArrowRight" || key === "ArrowDown") {
          next = tiers[(index + 1) % tiers.length];
        } else if (key === "ArrowLeft" || key === "ArrowUp") {
          next = tiers[(index - 1 + tiers.length) % tiers.length];
        }
        if (next) {
          event.preventDefault();
          select(next, true);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ===== [4] Wizard: 단계 전환 + 로그인 요청 모달 ========================== */
(function () {
  "use strict";

  function init() {
    var panels = Array.prototype.slice.call(
      document.querySelectorAll(".light-design [data-step]")
    );
    if (panels.length < 2) return;                      // 단계가 하나면 전환 불필요

    function showStep(n) {
      var target = null;
      panels.forEach(function (panel) {
        var on = panel.getAttribute("data-step") === String(n);
        panel.hidden = !on;
        if (on) target = panel;
      });
      if (!target) return;

      // 위저드 상단으로 스크롤하고, 접근성을 위해 패널에 포커스
      var hero = document.querySelector(".ld-hero");
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

    // BACK/NEXT(=data-go) 클릭 → 해당 단계로. 비활성 버튼은 무시.
    document.querySelectorAll(".light-design [data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.getAttribute("aria-disabled") === "true") return;
        showStep(btn.getAttribute("data-go"));
      });
    });

    // ── 로그인 요청 모달 (node 7126:19235) ───────────────────────────────
    var signinModal = document.querySelector("[data-signin-modal]");
    function openSignin() {
      if (!signinModal) return;
      signinModal.hidden = false;
      var c = signinModal.querySelector("[data-signin-close]");
      if (c) c.focus();
    }
    function closeSignin() {
      if (signinModal) signinModal.hidden = true;
    }
    if (signinModal) {
      var closeBtn = signinModal.querySelector("[data-signin-close]");
      if (closeBtn) closeBtn.addEventListener("click", closeSignin);
      signinModal.addEventListener("click", function (event) {
        if (event.target === signinModal) closeSignin();   // 배경(오버레이) 클릭만
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !signinModal.hidden) closeSignin();
      });
    }

    // DONE(최종): 로그인했으면 완료/확인 페이지로, 로그아웃이면 로그인 요청 모달.
    var DONE_URL = "/light-design-complete";
    var auth = window.OptomaticAuth;
    document.querySelectorAll(".light-design [data-done]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        var loggedIn = auth && auth.isLoggedIn && auth.isLoggedIn();
        if (!loggedIn) {
          openSignin();                                  // 로그인 후 모달의 SIGN IN NOW
          return;                                        // → data-return 으로 완료 페이지 복귀
        }
        // Step 2 업로드 파일({name,path}[])은 업로드 시점에 sessionStorage(optomatic_ld_files)
        // 에 이미 저장돼 있으므로 여기서 덮어쓰지 않는다(경로 정보 보존).
        // Step 2 추가 정보(Further Information) 텍스트도 완료 페이지로 넘긴다.
        // contenteditable <ul> 은 .value 가 없으므로 innerText(줄바꿈 보존)로 읽는다.
        try {
          var remarksEl = document.querySelector("[data-remarks]");
          if (remarksEl) {
            var remarksVal;
            if (typeof remarksEl.value === "string") {
              remarksVal = remarksEl.value;
            } else {
              // contenteditable <ul> 은 DONE 클릭 시점(Step 3 활성)에는 화면에 그려져 있지
              // 않다(Step 2 hidden). 그 상태의 innerText 는 줄바꿈이 사라져 라벨/값이 한 줄로
              // 붙어버리므로, 각 <li> 를 직접 순회해 줄바꿈으로 합친다(렌더 상태와 무관하게 안전).
              var items = remarksEl.querySelectorAll("li");
              if (items.length) {
                remarksVal = Array.prototype.map.call(items, function (li) {
                  return (li.textContent || "").replace(/\s+/g, " ").trim();
                }).filter(Boolean).join("\n");
              } else {
                remarksVal = remarksEl.innerText;
              }
            }
            sessionStorage.setItem("optomatic_ld_remarks", (remarksVal || "").trim());
          }
        } catch (e) {}
        // Step 1 의 선택한 프로젝트 타입과 Step 3 의 선택한 서비스 티어를 완료 페이지로 넘긴다.
        try {
          var sel = document.querySelector(".ld-options .ld-card--selected .ld-card__title");
          if (sel) sessionStorage.setItem("optomatic_ld_project_type", sel.textContent.trim());
        } catch (e) {}
        try {
          var tier = document.querySelector(".ld-tiers .ld-tier--selected[role='radio']");
          if (tier) sessionStorage.setItem("optomatic_ld_tier", tier.getAttribute("data-tier") || "");
        } catch (e) {}
        // 완료 페이지에서 "새 제출"임을 알 수 있게 표시(새 프로젝트 1건 생성).
        try { sessionStorage.setItem("optomatic_new_submission", "1"); } catch (e) {}
        window.location.href = DONE_URL;                 // 로그인 상태 → 완료/확인 페이지
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
