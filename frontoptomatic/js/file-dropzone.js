/* ============================================================================
 * file-dropzone.js — 재사용 파일 업로드 드롭존
 *
 * [data-dropzone-auto] 를 가진 모든 영역에 Step 1(업로드 화면)과 "똑같은"
 * 동작을 붙인다:
 *   · 드래그&드롭 / 클릭(혹은 BROWSE)으로 파일 선택
 *   · 안내 블록 아래 목록([data-file-list])에 파일 행이 쌓임
 *     (.lf-files / .lf-file — article 아이콘 + 파일명 + 닫기 ×, hover 시 #ebeff9)
 *   · .jpg/.png/.pdf · 50MB 검증, 위반 시 [data-file-error] 에 알림
 *   · × 로 해당 파일만 제거
 *
 * 영역 옵션(속성):
 *   · data-click-browse  — 영역 아무 곳이나 클릭하면 파일 선택창 열기
 *                          (목록/버튼 클릭은 제외)
 *
 * 필요한 자식: [data-file-input](숨긴 input), [data-file-list](ul),
 *   [data-file-error](선택). 사용법: <body> 끝에서 defer 로 로드.
 *
 * 주의: Step 1 의 [data-dropzone] 은 light-find-one.js 가 따로 처리하므로,
 *   이 모듈은 [data-dropzone-auto] 만 잡아 충돌을 피한다.
 * ========================================================================== */
(function () {
  "use strict";

  var MAX_BYTES = 50 * 1024 * 1024;                    // 50MB
  var ACCEPT = ["image/jpeg", "image/png", "application/pdf"];

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

  function initZone(zone) {
    var input = zone.querySelector("[data-file-input]");
    var list = zone.querySelector("[data-file-list]");
    var errorOut = zone.querySelector("[data-file-error]");
    var files = [];

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
        icon.innerHTML = ICON_ARTICLE;

        var name = document.createElement("span");
        name.className = "lf-file__name";
        name.textContent = file.name;                    // textContent (XSS 방지)

        main.appendChild(icon);
        main.appendChild(name);

        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "lf-file__remove";
        remove.setAttribute("aria-label", "Remove " + file.name);
        remove.innerHTML = ICON_CLOSE;
        remove.addEventListener("click", function (event) {
          event.stopPropagation();                       // 영역 클릭(브라우즈) 막기
          files.splice(index, 1);
          render();
        });

        li.appendChild(main);
        li.appendChild(remove);
        list.appendChild(li);
      });
      if (files.length) list.removeAttribute("hidden");
      else list.setAttribute("hidden", "");
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
        errorOut.textContent = rejected.length ? "Skipped: " + rejected.join(", ") : "";
      }
      render();
    }

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
    zone.addEventListener("drop", function (event) {
      var dt = event.dataTransfer;
      if (dt && dt.files) addFiles(dt.files);
    });

    // 영역 클릭 → 파일 선택창 (목록/버튼 클릭은 제외)
    if (zone.hasAttribute("data-click-browse") && input) {
      zone.addEventListener("click", function (event) {
        if (event.target.closest("[data-file-list]")) return;
        if (event.target.closest("button")) return;
        input.click();
      });
    }
  }

  function init() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-dropzone-auto]"),
      initZone
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
