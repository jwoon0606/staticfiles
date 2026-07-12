/* ============================================================
   privacy.js — 공통 개인정보처리방침 모달
   모든 페이지의 footer "개인정보처리방침" 텍스트 클릭 시 팝업으로
   방침 전문을 표시한다. 마크업·스타일을 스스로 주입하므로 페이지마다
   <script src="../js/privacy.js"></script> 한 줄만 추가하면 동작한다.
   바인딩 대상 클래스:
     .footer-privacy / .mo-footer-privacy / .cf-privacy
     .mcn-footer-privacy / .pc-footer-privacy / .ent-footer-privacy
   ============================================================ */
(function () {
  'use strict';

  var TRIGGER_SELECTOR =
    '.footer-privacy, .mo-footer-privacy, .cf-privacy, .mcn-footer-privacy, .pc-footer-privacy, .ent-footer-privacy';

  /* ---- 스타일 주입 ---- */
  var STYLE = ''
    + '.pp-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;'
    + 'justify-content:center;padding:24px;background:rgba(0,0,0,.55);opacity:0;visibility:hidden;'
    + 'transition:opacity .25s ease,visibility .25s ease;}'
    + '.pp-overlay.is-open{opacity:1;visibility:visible;}'
    + '.pp-dialog{position:relative;width:100%;max-width:880px;max-height:84vh;background:#fff;'
    + 'border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.3);display:flex;flex-direction:column;'
    + 'overflow:hidden;'
    + 'transform:translateY(12px);transition:transform .25s ease;'
    + "font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;}"
    + '.pp-overlay.is-open .pp-dialog{transform:translateY(0);}'
    + '.pp-close{position:absolute;top:24px;right:24px;width:40px;height:40px;border:0;border-radius:50%;'
    + 'background:#212121;color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;'
    + 'align-items:center;justify-content:center;transition:background .2s ease;z-index:1;}'
    + '.pp-close:hover{background:#000;}'
    + '.pp-title{margin:0;padding:40px 56px 24px;text-align:center;font-size:28px;font-weight:700;'
    + 'color:#111;}'
    + '.pp-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;'
    + 'padding:0 56px 48px;color:#333;font-size:15px;line-height:1.7;'
    + '-webkit-overflow-scrolling:touch;}'
    + '.pp-body::-webkit-scrollbar{width:6px;}'
    + '.pp-body::-webkit-scrollbar-thumb{background:#cfcfcf;border-radius:3px;}'
    + '.pp-body::-webkit-scrollbar-track{background:transparent;}'
    + '.pp-intro{margin:0 0 8px;color:#555;}'
    + '.pp-h{margin:32px 0 12px;font-size:18px;font-weight:700;color:#111;}'
    + '.pp-sub{margin:0 0 8px;color:#555;}'
    + '.pp-list{margin:0 0 8px;padding-left:20px;}'
    + '.pp-list li{margin:2px 0;}'
    + '.pp-note{margin:8px 0 0;color:#888;font-size:13px;font-style:italic;}'
    + '.pp-table{width:100%;border-collapse:collapse;margin:8px 0 4px;font-size:14px;'
    + 'line-height:1.55;table-layout:fixed;}'
    + '.pp-table th,.pp-table td{border:1px solid #e0e0e0;padding:12px 14px;text-align:left;'
    + 'vertical-align:top;word-break:keep-all;}'
    + '.pp-table th{background:#f5f5f5;font-weight:600;color:#222;text-align:center;}'
    + '.pp-table td.pp-center{text-align:center;white-space:nowrap;}'
    + '.pp-table .pp-ml{white-space:pre-line;}'
    + 'body.pp-lock{overflow:hidden;}'
    + '@media (max-width:768px){'
    + '.pp-title{padding:32px 20px 18px;font-size:21px;}'
    + '.pp-close{top:18px;right:18px;width:34px;height:34px;font-size:17px;}'
    + '.pp-body{padding:0 20px 32px;font-size:14px;}'
    + '.pp-h{font-size:16px;}'
    + '.pp-table{font-size:12.5px;}'
    + '.pp-table th,.pp-table td{padding:8px 9px;}'
    + '}';

  /* ---- 모달 본문 (개인정보처리방침 전문) ---- */
  var BODY_HTML = ''
    + '<p class="pp-intro">주식회사 링컴즈(이하 "회사")는 「개인정보 보호법」 및 관련 법령을 준수하며, '
    + '이용자의 개인정보를 소중히 보호합니다. 본 방침은 회사 홈페이지를 통해 수집되는 개인정보의 처리에 '
    + '관한 사항을 규정합니다.</p>'

    + '<h3 class="pp-h">제1조 (개인정보의 수집 항목 및 수집 방법)</h3>'
    + '<table class="pp-table">'
    + '<colgroup><col style="width:18%"><col style="width:34%"><col style="width:48%"></colgroup>'
    + '<thead><tr><th>구분</th><th>수집·이용 목적</th><th>수집 항목</th></tr></thead>'
    + '<tbody>'
    + '<tr><td>채용 지원시</td>'
    + '<td class="pp-ml">- 본인확인 및 본인 식별\n- 서비스 부정이용 방지\n- 중복지원 확인\n- 내부 인재 관리\n- 각종 고지 및 안내</td>'
    + '<td class="pp-ml">[필수] 이름, 생년월일, 전화번호(휴대전화번호), 이메일, 경력사항, 자기소개서\n\n[선택] 선택 학력정보, 자격증정보, 외국어시험정보, 병역 등 취업우대사항, 기타 경력사항, 포트폴리오 파일, 첨부 사진·영상 등</td></tr>'
    + '<tr><td>크리에이터 지원시</td>'
    + '<td class="pp-ml">- 본인 확인 및 본인 식별\n- 서비스 부정이용 방지\n- 각종 고지 및 안내\n- 분쟁조정을 위한 기록 보존</td>'
    + '<td class="pp-ml">[필수] 이름, 연락처(휴대전화번호), 생년월일, 성별, 이메일 주소, SNS 계정 링크, 자기소개</td></tr>'
    + '<tr><td>배우 지원시</td>'
    + '<td class="pp-ml">- 본인 확인 및 본인 식별\n- 서비스 부정이용 방지\n- 각종 고지 및 안내</td>'
    + '<td class="pp-ml">[필수] 오디션 지원서내 개인정보 및 자기소개, 사진, 영상 등\n\n[선택] 보호자 동의서 및 보호자 정보</td></tr>'
    + '<tr><td>제휴/협업 문의시</td>'
    + '<td class="pp-ml">- 문의 의사확인 및 본인식별\n- 서비스 부정이용 방지\n- 각종 고지 및 안내\n- 분쟁 조정을 위한 기록보존</td>'
    + '<td class="pp-ml">[필수] 담당자 이름, 기업(단체)명칭, 연락처, 이메일\n\n[선택] 첨부 파일</td></tr>'
    + '</tbody></table>'

    + '<h3 class="pp-h">제2조 (개인정보의 보유 및 이용 기간)</h3>'
    + '<p class="pp-sub">① 원칙: 수집일로부터 2년 이내 파기</p>'
    + '<p class="pp-sub">② 예외: 지원자가 파기를 요청하는 경우 요청일로부터 즉시 파기합니다.</p>'
    + '<p class="pp-sub">③ 단, 다음 법령에 해당하는 경우 해당 기간 동안 보관합니다.</p>'
    + '<table class="pp-table">'
    + '<colgroup><col style="width:50%"><col style="width:32%"><col style="width:18%"></colgroup>'
    + '<thead><tr><th>관계 법령</th><th>보존 항목</th><th>보존 기간</th></tr></thead>'
    + '<tbody>'
    + '<tr><td>전자상거래 등에서의 소비자 보호에 관한 법률</td><td>계약·청약철회 기록</td><td class="pp-center">5년</td></tr>'
    + '<tr><td>전자상거래 등에서의 소비자 보호에 관한 법률</td><td>불만·분쟁 처리 기록</td><td class="pp-center">3년</td></tr>'
    + '<tr><td>통신비밀보호법</td><td>로그인 기록</td><td class="pp-center">3개월</td></tr>'
    + '<tr><td>국세기본법</td><td>세금 관련 서류</td><td class="pp-center">5년</td></tr>'
    + '</tbody></table>'

    + '<h3 class="pp-h">제3조 (개인정보의 제3자 제공)</h3>'
    + '<p class="pp-sub">회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다음의 경우는 예외로 합니다.</p>'
    + '<ol class="pp-list">'
    + '<li>이용자가 사전에 동의한 경우</li>'
    + '<li>법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>'
    + '<li>계약 이행을 위해 불가피하게 필요한 경우로서 별도 동의를 받은 경우</li>'
    + '</ol>'

    + '<h3 class="pp-h">제4조 (개인정보 처리의 위탁)</h3>'
    + '<p class="pp-sub">회사는 이용자의 개인정보를 타인 또는 타기업이나 기관 등 제3자에게 제공하지 않습니다.</p>'
    + '<p class="pp-sub">회사는 이용자의 개인정보를 위탁하고 있지 않습니다. 다만 추후 서비스 향상을 위하여 이용자의 개인정보를 위탁하여 처리하게 되는 경우 사전에 이를 고지하고 위탁 계약 등을 통하여 수탁자를 관리하도록 하겠습니다.</p>'
    + '<p class="pp-note">※ 수탁사 변경 시 홈페이지 공지사항을 통해 사전 안내합니다.</p>'

    + '<h3 class="pp-h">제5조 (개인정보의 파기 절차 및 방법)</h3>'
    + '<p class="pp-sub">회사는 개인정보 보유 기간 경과 또는 처리 목적 달성 후 지체 없이 파기합니다.</p>'
    + '<ul class="pp-list">'
    + '<li>파기 절차: 별도 DB에 이전 후 내부 방침에 따라 일정 기간 보관 뒤 파기</li>'
    + '<li>파기 방법 (전자적 파일): 복구 불가능한 방법으로 영구 삭제</li>'
    + '<li>파기 방법 (출력물 등): 분쇄 또는 소각 처리</li>'
    + '</ul>'

    + '<h3 class="pp-h">제6조 (이용자의 권리와 행사 방법)</h3>'
    + '<p class="pp-sub">이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>'
    + '<ol class="pp-list">'
    + '<li>개인정보 열람 요청</li>'
    + '<li>개인정보 정정·삭제 요청</li>'
    + '<li>개인정보 처리 정지 요청</li>'
    + '<li>동의 철회(지원 취소 포함)</li>'
    + '</ol>'
    + '<p class="pp-sub">권리 행사는 서면, 이메일, 유선 등을 통해 가능하며, 회사는 요청 접수 후 10일 이내에 조치 결과를 안내합니다.</p>'

    + '<h3 class="pp-h">제7조 (개인정보 보호책임자)</h3>'
    + '<p class="pp-sub">회사는 개인정보 처리에 관한 업무를 총괄하고 불만 처리 및 피해 구제를 위해 아래와 같이 개인정보 보호책임자를 지정합니다.</p>'
    + '<table class="pp-table">'
    + '<colgroup><col style="width:18%"><col style="width:82%"></colgroup>'
    + '<thead><tr><th>구분</th><th>내용</th></tr></thead>'
    + '<tbody>'
    + '<tr><td>성명</td><td>최은경 실장</td></tr>'
    + '<tr><td>연락처</td><td>031-784-8478 / ringcoms@ringcoms.com</td></tr>'
    + '</tbody></table>'
    + '<p class="pp-note">※ 개인정보 보호 담당부서로 연결됩니다.</p>'

    + '<h3 class="pp-h">제8조 (개인정보 자동 수집 장치의 운영)</h3>'
    + '<p class="pp-sub">회사는 이용자에게 개인화된 서비스를 제공하기 위해 쿠키(Cookie)를 사용할 수 있습니다.</p>'
    + '<ul class="pp-list">'
    + '<li>쿠키 설치·운영 및 거부: 이용자는 웹브라우저 설정을 통해 쿠키 저장을 허용하거나 거부할 수 있습니다.</li>'
    + '<li>거부 시 불이익: 쿠키 저장을 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</li>'
    + '</ul>'

    + '<h3 class="pp-h">제9조 (개인정보처리방침의 변경)</h3>'
    + '<p class="pp-sub">본 방침은 법령·정책의 변경 또는 서비스 내용의 변화에 따라 개정될 수 있으며, 변경 시 홈페이지 공지사항을 통해 시행일 7일 전부터 사전 고지합니다.</p>';

  var overlay = null;
  var lastFocused = null;

  function buildModal() {
    var style = document.createElement('style');
    style.id = 'pp-style';
    style.textContent = STYLE;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'pp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pp-title');
    overlay.innerHTML =
      '<div class="pp-dialog">'
      + '<button type="button" class="pp-close" aria-label="닫기">&times;</button>'
      + '<h2 class="pp-title" id="pp-title">개인정보처리방침</h2>'
      + '<div class="pp-body">' + BODY_HTML + '</div>'
      + '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('.pp-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });
  }

  function open() {
    if (!overlay) buildModal();
    lastFocused = document.activeElement;
    overlay.classList.add('is-open');
    document.body.classList.add('pp-lock');
    overlay.querySelector('.pp-body').scrollTop = 0;
    overlay.querySelector('.pp-close').focus();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('pp-lock');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest(TRIGGER_SELECTOR);
      if (!trigger) return;
      e.preventDefault();
      open();
    });
    // 트리거에 포인터 커서 표시
    var nodes = document.querySelectorAll(TRIGGER_SELECTOR);
    for (var i = 0; i < nodes.length; i++) nodes[i].style.cursor = 'pointer';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
