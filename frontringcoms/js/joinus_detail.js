/* ============================================================
   Join Us — 채용 공고 상세 (joinus_detail.html)
   - /joinus/{id} 경로에서 id 를 읽어 /api/joinus?id={id} 로 공고를 로드.
   - 헤더/내용을 렌더하고, 하단 APPLY 폼으로 /api/joinusapply 에 지원 제출.
   - status===100(마감) 이면 폼 대신 마감 안내를 표시.
   ============================================================ */
(function () {
  // 경로 /joinus/123 → "123"
  var id = (location.pathname.split('/').filter(Boolean).pop() || '').trim();

  var escEl = document.createElement('div');
  function esc(s) { escEl.textContent = (s == null ? '' : String(s)); return escEl.innerHTML; }

  function reflow() {
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }

  var els = {
    tag: document.getElementById('jdTag'),
    state: document.getElementById('jdState'),
    title: document.getElementById('jdTitle'),
    meta: document.getElementById('jdMeta'),
    content: document.getElementById('jdContent'),
    apply: document.getElementById('jdApply'),
    form: document.getElementById('jdForm'),
    closed: document.getElementById('jdClosedNotice'),
    msg: document.getElementById('jdFormMsg'),
    submit: document.getElementById('jfSubmit'),
    photoInput: document.getElementById('jfPhoto'),
    photoName: document.getElementById('jfPhotoName')
  };

  var joinus = null;

  function metaItem(k, v) {
    if (!v) return '';
    return '<li><span class="jd-meta-k">' + esc(k) + '</span><span>' + esc(v) + '</span></li>';
  }

  function render(r) {
    document.title = 'RINGCOMS - ' + (r.title || '채용 공고');
    if (els.tag) els.tag.textContent = r.tag || '';
    var closed = r.status === 100;
    if (els.state) {
      els.state.textContent = closed ? '마감' : '모집중';
      els.state.className = 'jd-state ' + (closed ? 'jd-state--closed' : 'jd-state--open');
    }
    if (els.title) els.title.textContent = r.title || '';
    if (els.meta) {
      els.meta.innerHTML =
        metaItem('고용형태', r.employmentType) +
        metaItem('경력', r.career) +
        metaItem('근무지', r.location) +
        metaItem('마감일', r.deadline);
    }
    if (els.content) els.content.textContent = r.content || '';

    // 지원분야 드롭다운: 공고의 모집분야(fields, 쉼표구분)로 채움
    var fieldSel = document.getElementById('jfField');
    if (fieldSel && r.fields) {
      r.fields.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (f) {
        var o = document.createElement('option'); o.value = f; o.textContent = f; fieldSel.appendChild(o);
      });
    }

    // 마감 공고: 폼 숨기고 안내 표시
    if (closed) {
      if (els.form) els.form.setAttribute('hidden', '');
      if (els.closed) els.closed.removeAttribute('hidden');
    }
    reflow();
  }

  function renderError() {
    if (els.title) els.title.textContent = '공고를 찾을 수 없습니다.';
    if (els.apply) els.apply.style.display = 'none';
    reflow();
  }

  // 사진 선택 시 파일명 표시
  if (els.photoInput) {
    els.photoInput.addEventListener('change', function () {
      var fs = els.photoInput.files;
      if (els.photoName) els.photoName.textContent = (fs && fs.length) ? fs[0].name : '선택된 파일 없음';
    });
  }

  // 경력구분 '경력'일 때만 총경력·현재연봉 표시
  var careerTypeEl = document.getElementById('jfCareerType');
  var careerWrap = document.getElementById('jfCareerWrap');
  var salaryWrap = document.getElementById('jfCurrentSalaryWrap');
  function syncCareer() {
    var isExp = careerTypeEl && careerTypeEl.value === '경력';
    if (careerWrap) careerWrap.hidden = !isExp;
    if (salaryWrap) salaryWrap.hidden = !isExp;
  }
  if (careerTypeEl) careerTypeEl.addEventListener('change', syncCareer);

  // 거주지 주소검색 (다음 우편번호)
  var regionSearchBtn = document.getElementById('jfRegionSearch');
  if (regionSearchBtn) {
    regionSearchBtn.addEventListener('click', function () {
      if (!window.daum || !window.daum.Postcode) { alert('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); return; }
      new window.daum.Postcode({
        oncomplete: function (data) {
          var addr = data.roadAddress || data.jibunAddress || data.address || '';
          var regionEl = document.getElementById('jfRegion');
          if (regionEl) regionEl.value = addr;
          var detailEl = document.getElementById('jfRegionDetail');
          if (detailEl) detailEl.focus();
        }
      }).open();
    });
  }

  function setMsg(text, kind) {
    if (!els.msg) return;
    els.msg.textContent = text || '';
    els.msg.className = 'jd-form-msg' + (kind ? ' is-' + kind : '');
  }

  function submit(e) {
    e.preventDefault();
    setMsg('');

    var name = (document.getElementById('jfName').value || '').trim();
    var birth = (document.getElementById('jfBirth').value || '').trim();
    var gender = (document.getElementById('jfGender').value || '').trim();
    var phone = (document.getElementById('jfPhone').value || '').trim();
    var email = (document.getElementById('jfEmail').value || '').trim();
    var region = (document.getElementById('jfRegion').value || '').trim();
    var regionDetail = (document.getElementById('jfRegionDetail').value || '').trim();
    if (regionDetail) region = (region + ' ' + regionDetail).trim();
    var field = (document.getElementById('jfField').value || '').trim();
    var careerType = (document.getElementById('jfCareerType').value || '').trim();
    var career = (document.getElementById('jfCareer').value || '').trim();
    var currentSalary = (document.getElementById('jfCurrentSalary').value || '').trim();
    var desiredSalary = (document.getElementById('jfDesiredSalary').value || '').trim();
    var disability = (document.getElementById('jfDisability').value || '').trim();
    var veteran = (document.getElementById('jfVeteran').value || '').trim();
    var agree = document.getElementById('jfAgree').checked;
    var photoFile = (els.photoInput && els.photoInput.files && els.photoInput.files.length) ? els.photoInput.files[0] : null;

    if (!name || !birth || !gender || !phone || !email || !region || !field || !careerType || !desiredSalary || !disability || !veteran) {
      setMsg('모든 항목을 입력해 주세요.', 'error'); return;
    }
    if (careerType === '경력' && (!career || !currentSalary)) {
      setMsg('경력 선택 시 총 경력과 현재연봉을 입력해 주세요.', 'error'); return;
    }
    if (!agree) { setMsg('개인정보 수집·이용에 동의해 주세요.', 'error'); return; }

    var ft = (window.ureferFirstTouch && window.ureferFirstTouch()) || {};
    var payload = {
      joinusId: joinus ? joinus.id : (id ? Number(id) : null),
      name: name, phone: phone, email: email,
      field: field, birth: birth, gender: gender,
      careerType: careerType, career: (careerType === '경력' ? career : ''),
      region: region,
      currentSalary: (careerType === '경력' ? currentSalary : ''),
      desiredSalary: desiredSalary, disability: disability, veteran: veteran,
      referrer: ft.referrer || '', utmSource: ft.utmSource || ''   // 최초 진입 경로
    };

    var fd = new FormData();
    fd.append('params', new Blob([JSON.stringify(payload)], { type: 'application/json; charset=utf-8' }));
    if (photoFile) fd.append('photo', photoFile);

    if (els.submit) { els.submit.disabled = true; }
    fetch('/api/joinusapply', { method: 'POST', body: fd })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function () {
        if (els.form) els.form.reset();
        if (els.photoName) els.photoName.textContent = '선택된 파일 없음';
        syncCareer();
        setMsg('지원이 접수되었습니다. 감사합니다.', 'ok');
        alert('지원이 접수되었습니다. 감사합니다.');
      })
      .catch(function () {
        setMsg('접수에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
        alert('접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      })
      .finally(function () { if (els.submit) els.submit.disabled = false; });
  }

  if (els.form) els.form.addEventListener('submit', submit);

  // 공고 로드
  if (!id) { renderError(); return; }
  fetch('/api/joinus?id=' + encodeURIComponent(id), { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      if (!res || !res.id) { renderError(); return; }
      joinus = res;
      render(res);
    })
    .catch(function () { renderError(); });
})();
