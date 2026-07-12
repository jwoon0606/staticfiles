/* ============================================================
   Join Us (joinus.html) — 채용 공고 목록 백엔드 연동
   - /api/joinus/pagedList (공개) 로 공고 목록 + 페이지네이션 + 검색.
   - press_center 와 동일한 DOM(.pc-*)을 재사용하되 데이터원만 공고(joinus)로.
   - status: 0 모집중 / 100 마감 → 카드에 배지로 표기.
   - 상세 페이지 연결은 다음 단계 (지금은 data-id 만 심어둠).
   ============================================================ */
(function () {
  var PER = 20;
  var state = { page: 1, keyword: '', searchType: 'title', tag: '', career: '', location: '' };
  var listEl = document.querySelector('.pc-news-list');
  var numsEl = document.querySelector('.pc-pagi-nums');
  if (!listEl) return;

  /* 목록(개수)이 바뀌면 흰색 영역 높이가 변하므로, joinus.html 의
     스케일·body 높이 보정 로직(resize 리스너)을 다시 실행시킨다. */
  function reflow() {
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }

  var escEl = document.createElement('div');
  function esc(s) { escEl.textContent = (s == null ? '' : String(s)); return escEl.innerHTML; }

  function statusBadge(status) {
    if (status === 100) return '<span class="pc-news-state pc-news-state--closed">마감</span>';
    return '<span class="pc-news-state pc-news-state--open">모집중</span>';
  }

  function renderList(items) {
    if (!items.length) {
      listEl.innerHTML = '<li class="pc-news-item"><div class="pc-news-txt"><p class="pc-news-title">등록된 공고가 없습니다.</p></div></li>';
      return;
    }
    listEl.innerHTML = items.map(function (it) {
      var closed = it.status === 100;
      return '<li class="pc-news-item' + (closed ? ' pc-news-item--closed' : '') + '" data-id="' + esc(it.id) + '" style="cursor:pointer">' +
          '<div class="pc-news-txt">' +
            statusBadge(it.status) +
            '<span class="pc-news-tag">' + esc(it.tag || '채용') + '</span>' +
            '<p class="pc-news-title">' + esc(it.title) + '</p>' +
          '</div>' +
          '<span class="material-symbols-outlined pc-news-arrow">arrow_back</span>' +
        '</li>';
    }).join('');
    // 항목 클릭 → 공고 상세(/joinus/{id})
    listEl.querySelectorAll('.pc-news-item[data-id]').forEach(function (li) {
      li.addEventListener('click', function () {
        var rid = li.getAttribute('data-id');
        if (rid) location.href = '/joinus/' + rid;
      });
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
    var q = '?callpage=' + page + '&perpage=' + PER + '&deleted=false' +
        (state.keyword ? ('&searchType=' + state.searchType + '&keyword=' + encodeURIComponent(state.keyword)) : '') +
        (state.tag ? ('&tag=' + encodeURIComponent(state.tag)) : '') +
        (state.career ? ('&career=' + encodeURIComponent(state.career)) : '') +
        (state.location ? ('&location=' + encodeURIComponent(state.location)) : '');
    fetch('/api/joinus/pagedList' + q, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res) return;
        renderList(res.list || []);
        renderPagination(res.totalpage, res.callpage);
        reflow();
      }).catch(function () {});
  }

  // 제목 드롭다운(pc-search-type)과 동일한 동작으로 사업부/경력/근무지 필터 드롭다운 처리
  function wireFilters() {
    var dds = document.querySelectorAll('#jfFilter .jf-dd');
    if (!dds.length) return;
    dds.forEach(function (dd) {
      var key = dd.getAttribute('data-key');           // tag / career / location
      var label = dd.querySelector('.jf-dd-label');
      function close() { dd.classList.remove('is-open'); dd.setAttribute('aria-expanded', 'false'); }
      function toggle() {
        var open = dd.classList.toggle('is-open');
        dd.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      dd.addEventListener('click', function (e) {
        var li = e.target.closest('li[role="option"]');
        if (li) {
          var val = li.getAttribute('data-value') || '';
          state[key] = val;
          if (label) { label.textContent = li.textContent; label.setAttribute('data-value', val); }
          dd.querySelectorAll('li').forEach(function (o) { o.setAttribute('aria-selected', o === li ? 'true' : 'false'); });
          close();
          load(1);
          return;
        }
        toggle();
      });
      dd.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        else if (e.key === 'Escape') { close(); }
      });
      document.addEventListener('click', function (e) { if (!dd.contains(e.target)) close(); });
    });
  }

  // 초기 로드: 항상 DB 데이터로 렌더(정적 placeholder 제거), 없으면 안내 문구
  wireFilters();
  load(1);
})();
