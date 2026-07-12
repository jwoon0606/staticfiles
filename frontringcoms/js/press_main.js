/* ============================================================
   메인 페이지 Press Center 섹션 — 점진적 향상(progressive enhancement)
   - 데스크탑(.press-list) / 모바일(.mo-press-list) 두 목록을 함께 처리.
   - /api/press/pagedList 가 응답하면 DB 데이터로 목록을 교체(최신화),
     실패/미배포(404)면 main.html 의 정적 기본값을 그대로 유지(폴백).
   - 모바일 항목(li[data-url])은 클릭 시 원문을 새 탭으로 연다(데스크탑은 a[href]).
   - 메인은 "티저"이므로 상위 N(perpage)건만 노출한다.
   ============================================================ */
(function () {
  var PER = 10;
  var MO_MAX = 3;   // 모바일은 최신 3건만 노출(한 화면, 자유 스크롤 없도록)
  var ARROW = '/images/main/press/ic-news-arrow.svg';
  var deskEl = document.querySelector('.press-list');
  var moEl = document.querySelector('.mo-press-list');
  if (!deskEl && !moEl) return;

  var escEl = document.createElement('div');
  function esc(s) { escEl.textContent = (s == null ? '' : String(s)); return escEl.innerHTML; }

  // 모바일 항목 클릭 → 원문 열기 (정적/동적 항목 모두, 이벤트 위임)
  if (moEl) {
    moEl.addEventListener('click', function (e) {
      var li = e.target.closest('.mo-press-item[data-url]');
      if (li) window.open(li.getAttribute('data-url'), '_blank', 'noopener');
    });
  }

  function renderDesktop(items) {
    deskEl.innerHTML = items.map(function (it) {
      var href = it.url ? esc(it.url) : '/press_center';
      var target = it.url ? ' target="_blank" rel="noopener"' : '';
      return '<a class="press-item" href="' + href + '"' + target + '>' +
          '<div class="press-item-txt">' +
            '<span class="press-tag">' + esc(it.tag || 'News') + '</span>' +
            '<span class="press-item-title">' + esc(it.title) + '</span>' +
          '</div>' +
          '<img class="press-item-arrow" src="' + ARROW + '" alt=""></a>';
    }).join('');
  }

  function renderMobile(items) {
    moEl.innerHTML = items.slice(0, MO_MAX).map(function (it) {
      var du = it.url ? ' data-url="' + esc(it.url) + '" style="cursor:pointer"' : '';
      return '<li class="mo-press-item"' + du + '>' +
          '<div class="mo-press-txt">' +
            '<span class="mo-press-tag">' + esc(it.tag || 'News') + '</span>' +
            '<p class="mo-press-item-title">' + esc(it.title) + '</p>' +
          '</div>' +
          '<span class="mo-press-arrow"><img src="' + ARROW + '" alt=""></span></li>';
    }).join('');
  }

  fetch('/api/press/pagedList?callpage=1&perpage=' + PER, { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var items = res && res.list;
      if (!items || !items.length) return;   // 데이터 없으면 정적 기본값 유지
      if (deskEl) renderDesktop(items);
      if (moEl) renderMobile(items);
    })
    .catch(function () {});                   // 네트워크 오류 시 정적 기본값 유지
})();
