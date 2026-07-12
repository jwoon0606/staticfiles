/* ============================================================
   Press Center (press_center.html) — 백엔드 연동 (점진적 향상)
   - /api/press/pagedList (공개) 로 보도자료 목록 + 페이지네이션 + 제목검색.
   - 데이터가 있으면 정적 목록을 DB 데이터로 교체, 없으면 정적 유지(폴백).
   - 검색창은 디자인에 실제 input 이 없어 press_center.html 에서 input 을 추가했다.
   ============================================================ */
(function () {
  var PER = 20;
  var state = { page: 1, keyword: '', searchType: 'title' };
  var listEl = document.querySelector('.pc-news-list');
  var numsEl = document.querySelector('.pc-pagi-nums');
  if (!listEl) return;

  /* 목록(개수)이 바뀌면 흰색 영역 높이가 변하므로, press_center.html 의
     스케일·body 높이 보정 로직(resize 리스너)을 다시 실행시킨다. */
  function reflow() {
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }

  var escEl = document.createElement('div');
  function esc(s) { escEl.textContent = (s == null ? '' : String(s)); return escEl.innerHTML; }

  function renderList(items) {
    if (!items.length) {
      listEl.innerHTML = '<li class="pc-news-item"><div class="pc-news-txt"><p class="pc-news-title">검색 결과가 없습니다.</p></div></li>';
      return;
    }
    listEl.innerHTML = items.map(function (it) {
      return '<li class="pc-news-item"' + (it.url ? ' data-url="' + esc(it.url) + '" style="cursor:pointer"' : '') + '>' +
          '<div class="pc-news-txt">' +
            '<span class="pc-news-tag">' + esc(it.tag || 'News') + '</span>' +
            '<p class="pc-news-title">' + esc(it.title) + '</p>' +
          '</div>' +
          '<span class="material-symbols-outlined pc-news-arrow">arrow_back</span>' +
        '</li>';
    }).join('');
    listEl.querySelectorAll('.pc-news-item[data-url]').forEach(function (li) {
      li.addEventListener('click', function () { window.open(li.getAttribute('data-url'), '_blank', 'noopener'); });
    });
  }

  function bindArrow(sel, page) {
    var el = document.querySelector(sel);
    if (el) el.onclick = function () { load(page); };
  }

  function renderPagination(totalpage, callpage) {
    if (!numsEl) return;
    totalpage = totalpage || 1;
    callpage = callpage || 1;
    var WIN = 7;
    var start = Math.max(1, callpage - Math.floor(WIN / 2));
    var endp = Math.min(totalpage, start + WIN - 1);
    start = Math.max(1, endp - WIN + 1);
    var html = '';
    for (var p = start; p <= endp; p++) {
      html += '<button class="' + (p === callpage ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    numsEl.innerHTML = html;
    numsEl.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { load(parseInt(b.getAttribute('data-page'), 10)); });
    });
    bindArrow('.pc-pagi-first', 1);
    bindArrow('.pc-pagi-prev', Math.max(1, callpage - 1));
    bindArrow('.pc-pagi-next', Math.min(totalpage, callpage + 1));
    bindArrow('.pc-pagi-last', totalpage);
  }

  function load(page) {
    state.page = page;
    var q = '?callpage=' + page + '&perpage=' + PER +
        (state.keyword ? ('&searchType=' + state.searchType + '&keyword=' + encodeURIComponent(state.keyword)) : '');
    fetch('/api/press/pagedList' + q, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res) return;
        renderList(res.list || []);
        renderPagination(res.totalpage, res.callpage);
        reflow();
      }).catch(function () {});
  }

  var TYPE_LABEL = { title: '제목', content: '내용', title_content: '제목+내용' };

  function wireSearch() {
    var input = document.getElementById('pcSearchInput');
    var btn = document.getElementById('pcSearchBtn');
    function doSearch() { state.keyword = (input && input.value || '').trim(); load(1); }
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
    if (btn) btn.addEventListener('click', doSearch);

    // 검색 조건 드롭다운 (제목 / 내용 / 제목+내용)
    var typeEl = document.getElementById('pcSearchType');
    var labelEl = document.getElementById('pcSearchTypeLabel');
    var menuEl = document.getElementById('pcSearchTypeMenu');
    if (!typeEl || !labelEl || !menuEl) return;

    function close() { typeEl.classList.remove('is-open'); typeEl.setAttribute('aria-expanded', 'false'); }
    function toggle() {
      var open = typeEl.classList.toggle('is-open');
      typeEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    typeEl.addEventListener('click', function (e) {
      var li = e.target.closest('li[role="option"]');
      if (li) {
        var val = li.getAttribute('data-value');
        state.searchType = val;
        labelEl.textContent = TYPE_LABEL[val] || '제목';
        labelEl.setAttribute('data-value', val);
        menuEl.querySelectorAll('li').forEach(function (o) {
          o.setAttribute('aria-selected', o === li ? 'true' : 'false');
        });
        if (input) input.placeholder = (TYPE_LABEL[val] || '제목') + ' 검색';
        close();
        if (state.keyword) load(1); // 키워드가 이미 있으면 조건만 바꿔 재검색
        return;
      }
      toggle();
    });
    typeEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('click', function (e) { if (!typeEl.contains(e.target)) close(); });
  }

  // 초기 로드: 목록은 항상 DB 데이터로 채운다(정적 하드코딩 없음).
  wireSearch();
  fetch('/api/press/pagedList?callpage=1&perpage=' + PER, { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      if (!res) { renderList([]); return; }
      renderList(res.list || []);
      renderPagination(res.totalpage, res.callpage);
      reflow();
    }).catch(function () {});
})();
