/* 유입 기록 (urefer) — 세션당 1회, 첫 진입 시 "어디서 왔는지" 서버에 저장.
   source·ad·ip 는 서버(/api/urefer)가 계산/취득하므로, 여기선 referrer + utm/click-id 만 보낸다. */
(function () {
    var q = new URLSearchParams(location.search);
    var payload = {
        referrer:    document.referrer || '',
        utmSource:   q.get('utm_source')   || '',
        utmMedium:   q.get('utm_medium')   || '',
        utmCampaign: q.get('utm_campaign') || '',
        gclid:       q.get('gclid')        || '',
        fbclid:      q.get('fbclid')       || ''
    };

    // 최초 진입 경로(first-touch) : localStorage 에 "없을 때만" 저장 → 최초 1회로 고정.
    // 이후 지원 제출 시 이 값을 실어 "어디서 온 지원자인지" 기록한다. (세션 아니라 브라우저에 계속 남음)
    if (!localStorage.getItem('ureferFirstTouch')) {
        try { localStorage.setItem('ureferFirstTouch', JSON.stringify(payload)); } catch (e) {}
    }
    // 지원 폼 스크립트가 최초 진입 경로를 읽어가는 헬퍼.
    window.ureferFirstTouch = function () {
        try { return JSON.parse(localStorage.getItem('ureferFirstTouch') || '{}'); }
        catch (e) { return {}; }
    };

    // ── 방문자 통계 전송 : 세션당 1회 (같은 탭 세션의 재방문·내부 이동은 skip → 1방문 = 1건) ──
    if (sessionStorage.getItem('ureferSent')) return;
    sessionStorage.setItem('ureferSent', '1');   // 먼저 세워 중복 발사 방지

    // fire-and-forget: 실패해도 페이지 영향 없음. keepalive로 즉시 이동해도 전송 보장.
    fetch('/api/urefer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
    }).catch(function () {});
})();