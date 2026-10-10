// 혼자 해 보기(M6) 보드: 강조 없이 빈칸을 채우며 전 과정을 해 본다. 화면 구조·문구는 실제 앱을 따른다. node build-practice.cjs
const L = require('./build-lib.cjs');
const { doc, write, svg, navButton, pageTitle, cardOpen, card, rows, notice, progressList, DISCLAIMER, CONFIRMED, BTN, BTN_GHOST, sheet, ACCEPT_BODY, START_BODY, PAYMENT_CARD, contactCard, RESULT_CHOICES, resultOption, RESULT_NOTICE, UPLOAD_BOX, FILE_CHIP } = L;

const TITLE = '여름 편지 팬미팅';
const REQUEST = [
  ['공연명', TITLE], ['분야', '기타'], ['공연 일시', '2026-12-05 14:00'], ['티켓 오픈', '2026-11-10 20:00 · 선예매'], ['예매처', 'YES24 티켓'],
  ['공연장·위치', '블루스퀘어'], ['매수', '1매'], ['희망 좌석·요청 내용', '2층 앞열 1매'], ['성공 요건', '2층 5열 이내 1매'],
  ['희망 수고비', '15,000원'], ['최대 수고비', '20,000원'], ['기타 사항', '미입력'], ['도우미 응답 기한', '2026. 10. 11. 오전 11:40'],
];
const AGREEMENT = [
  ['착수비', '{{upWon}}'], ['수고비(성공보수)', '{{suWon}}'], ['거래 방식', '안전거래 · 수수료 {{feeWon}}'], ['희망 좌석·요청 내용', '{{seatV}}'], ['성공 요건', '{{condV}}'],
  ['예매 시도 방식', '{{methodV}}'], ['실패·환불 처리', '{{refundV}}'], ['결과 연락 기한', '{{deadlineV}}'], ['기타 사항', '{{noteV}}'], ['수정 사유', '미입력'],
];
const BADGE = `<span style="{{badgeStyle}}">${svg('clock', 13, 'currentColor', 2)}{{badgeText}}</span>`;
const NEXT = `<div style="display: flex; align-items: flex-start; gap: 13px; margin-top: 18px; padding: 16px; border-radius: 12px; background: linear-gradient(120deg, #F0F3FF, #F7F9FF)">
    <span style="flex: 0 0 42px; height: 42px; border-radius: 12px; background: #FFFFFF; display: flex; align-items: center; justify-content: center">${svg('clock', 22, '#3A5BFF')}</span>
    <div><strong style="font-size: 15px">{{nextTitle}}</strong><p style="margin: 6px 0 0; font-size: 12px; line-height: 1.7; color: #4B5160">{{nextText}}</p><sc-if value="{{idle}}" hint-placeholder-val="{{ false }}"><p style="margin: 6px 0 0; font-size: 12px; line-height: 1.7; color: #4B5160">체험님은 지금 따로 하실 일이 없어요. 편하게 기다려 주세요.</p></sc-if></div>
  </div>`;
const label = (text, required, helper) => `<div style="margin-top: 16px; font-size: 13px; font-weight: 700">${text}${required ? ' <em style="font-style: normal; font-size: 10px; color: #B42318">*</em>' : ''}</div>${helper ? `<div style="margin-top: 2px; font-size: 12px; color: #6B7180">${helper}</div>` : ''}`;
const area = (handler, style, ph = '') => `<textarea rows="3" onInput="${handler}"${ph ? ` placeholder="${ph}"` : ''} style="${style}"></textarea>`;
const input = (handler, style, ph = '', mode = '') => `<input onInput="${handler}"${ph ? ` placeholder="${ph}"` : ''}${mode ? ` inputmode="${mode}"` : ''} style="${style}">`;
const fieldL = (text, required, helper, control) => `<label style="display: block">${label(text, required, helper)}${control}</label>`;
const sumRow = (k, v) => `<div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4B5160"><span>${k}</span><strong style="color: #16181D">${v}</strong></div>`;
const radio = (checked, handler, title, desc) => `<label style="{{${checked}Style}}">
      <input type="radio" name="pk-deal" checked="{{${checked}}}" onChange="${handler}" style="flex: 0 0 18px; width: 18px; height: 18px; margin: 0; accent-color: #3A5BFF">
      <span><strong style="display: block; font-size: 14px">${title}</strong><small style="display: block; margin-top: 5px; font-size: 12px; line-height: 1.5; color: #6B7180">${desc}</small></span>
    </label>`;
const MENU = (items) => `<div style="margin-top: 12px">${items.map(([t, d], i) => `
      <button type="button" style="display: block; width: 100%; padding: 19px 0; border: 0; ${i < items.length - 1 ? 'border-bottom: 1px solid #EEF1F5; ' : ''}background: none; font-family: inherit; text-align: left; color: #16181D"><strong style="display: block; font-size: 14px; font-weight: 600">${t}</strong><small style="display: block; margin-top: 4px; font-size: 12px; color: #6B7180">${d}</small></button>`).join('')}
    </div>`;
const MENU_REST = [['좋아요한 도우미', '저장한 도우미 보기'], ['신고 내역', '접수한 신고와 처리 결과'], ['이용 방법', '서비스 이용 안내'], ['문의 작성', '궁금한 내용 문의하기'], ['문의 현황', '작성한 문의와 답변 확인'], ['이용약관', '서비스 이용 기준'], ['개인정보 안내', '정보 처리 안내']];

const MAIN = `<sc-if value="{{onMain}}" hint-placeholder-val="{{ true }}">
      <div aria-label="공연 배너" style="height: 220px; border-radius: 20px; background: #2B2F6E; color: #FFFFFF; display: flex; flex-direction: column; overflow: hidden">
        <div style="flex: 1; padding: 18px 20px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px">
          <span style="align-self: flex-start; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.18); padding: 4px 10px; border-radius: 999px">콘서트</span>
          <span style="font-size: 21px; font-weight: 800; letter-spacing: -0.5px">네온 펄스 라이브</span>
        </div>
        <div style="height: 56px; border-top: 2px dashed rgba(255,255,255,0.35); display: flex; align-items: center; gap: 12px; padding: 0 20px">
          <strong style="font-size: 22px; font-weight: 800">D-3</strong>
          <span style="font-size: 13px; color: #D9DCF5">2026.10.13 (화) 20:00</span>
        </div>
      </div>
      <div style="margin-top: 14px; height: 52px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E6E9EF; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box">
        <span style="font-size: 14px; color: #6B7180">공연명, 도우미 이름, 예매처를 검색해 보세요</span>
        ${svg('search', 20, '#3A5BFF', 2)}
      </div>
      <h2 style="margin: 22px 0 0; font-size: 17px; font-weight: 800">이번 주, 주목할 도우미</h2>
      <div style="margin-top: 12px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 16px; display: flex; gap: 12px">
        <span style="flex: 0 0 52px; height: 52px; border-radius: 14px; background: #E6F7F3; color: #0B7A67; font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center">하</span>
        <div style="min-width: 0">
          <div style="font-size: 16px; font-weight: 700">하늘도우미</div>
          <div style="margin-top: 6px; font-size: 13px; color: #4B5160">★ 4.8 · 거래 32회 · 착수비 5,000원부터</div>
        </div>
      </div>
    </sc-if>`;

const MY = `<sc-if value="{{onMy}}" hint-placeholder-val="{{ false }}">
      ${pageTitle('', '마이페이지')}
      <section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px 22px">
          <span style="flex: 0 0 56px; height: 56px; border-radius: 50%; background: #EEF2FF; color: #2D48D6; font-size: 20px; font-weight: 800; display: flex; align-items: center; justify-content: center">체</span>
          <div style="flex: 1 1 160px; min-width: 0">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800">체험 계정</h2>
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 6px">
              <span style="font-size: 13px; color: #6B7180">trial@example.com</span>
              <div style="display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: #F5F7FA">
                <button type="button" aria-pressed="{{isUser}}" onClick="{{toUser}}" style="{{userBtn}}">이용자</button>
                <button type="button" aria-pressed="{{helper}}" onClick="{{toHelper}}" style="{{helperBtn}}">도우미</button>
              </div>
            </div>
          </div>
          <button type="button" style="margin-left: auto; min-height: 40px; padding: 0 14px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 12px; font-weight: 600; color: #4B5160">로그아웃</button>
        </div>
        <sc-if value="{{isUser}}" hint-placeholder-val="{{ true }}">${MENU([['이용자 프로필', '닉네임 · 연락처 · 계정 인증 · 아이디·비밀번호'], ['거래 내역', '안전거래 결제']].concat(MENU_REST))}</sc-if>
        <sc-if value="{{helper}}" hint-placeholder-val="{{ false }}">${MENU([['도우미 프로필', '닉네임 · 연락처 · 계정 인증 · 아이디·비밀번호'], ['공개 프로필', '도우미 소개와 활동 정보 · 공개 설정'], ['거래 내역', '매칭권 충전 · 사용 · 정산']].concat(MENU_REST))}</sc-if>
      </section>
      <sc-if value="{{isUser}}" hint-placeholder-val="{{ true }}">
        ${card('나의 티켓팅', `<div style="display: flex; align-items: baseline; gap: 10px; margin-top: 12px"><strong style="font-size: 28px; font-weight: 800">0</strong><span style="font-size: 14px; color: #4B5160">개의 요청과 거래</span></div>
  <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #4B5160">보낸 요청부터 완료된 예매까지<br>내 활동에서 확인하세요.</p>
  <button type="button" style="${BTN}; margin-top: 14px">내 활동 보기</button>`)}
      </sc-if>
      <sc-if value="{{helper}}" hint-placeholder-val="{{ false }}">
        ${card('나의 매칭권', `<div style="margin-top: 12px; font-size: 28px; font-weight: 800">{{balance}}<small style="margin-left: 2px; font-size: 14px; font-weight: 600">장</small></div>
  <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #4B5160">요청을 수락할 때 1장씩 사용해요.</p>
  <button type="button" style="${BTN}; margin-top: 14px">매칭권 충전</button>
  <button type="button" style="${BTN_GHOST}">충전 내역 보기</button>`)}
      </sc-if>
    </sc-if>`;

const LEADS = `<sc-if value="{{onLeads}}" hint-placeholder-val="{{ false }}">
      ${pageTitle('', '받은 요청')}
      <section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 16px">
        <div style="display: flex">
          <div style="flex: 1; padding-right: 10px; border-right: 1px solid #E6E9EF"><div style="font-size: 12px; color: #4B5160">답변할 요청</div><div style="margin-top: 2px; font-size: 22px; font-weight: 800">{{pendingCount}}<span style="margin-left: 2px; font-size: 13px; font-weight: 600">건</span></div></div>
          <div style="flex: 1; padding: 0 10px; border-right: 1px solid #E6E9EF"><div style="font-size: 12px; color: #4B5160">결과 확인 중</div><div style="margin-top: 2px; font-size: 22px; font-weight: 800">0<span style="margin-left: 2px; font-size: 13px; font-weight: 600">건</span></div></div>
          <div style="flex: 1; padding-left: 10px"><div style="font-size: 12px; color: #4B5160">보유 매칭권</div><div style="margin-top: 2px; font-size: 22px; font-weight: 800">{{balance}}<span style="margin-left: 2px; font-size: 13px; font-weight: 600">장</span></div></div>
        </div>
        <div style="margin-top: 14px; display: flex; gap: 8px">
          <button type="button" style="flex: 1; min-height: 44px; border: 1px solid #D5D9E2; border-radius: 12px; background: #FFFFFF; font-family: inherit; font-size: 14px; font-weight: 700; color: #16181D">매칭권 충전</button>
          <button type="button" role="switch" aria-checked="{{on}}" onClick="{{toggleOn}}" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border: 1px solid #D5D9E2; border-radius: 12px; background: #FFFFFF; font-family: inherit; font-size: 14px; font-weight: 700; color: #16181D; cursor: pointer">
            <span style="{{trackStyle}}"><span style="{{knobStyle}}"></span></span>
            활동 중 {{onLabel}}
          </button>
        </div>
      </section>
      <div role="tablist" aria-label="받은 요청 분류" style="margin-top: 16px; display: flex; gap: 20px; border-bottom: 1px solid #E6E9EF">
        <button type="button" role="tab" aria-selected="true" style="min-height: 44px; padding: 0 2px; border: 0; border-bottom: 2px solid #3A5BFF; margin-bottom: -1px; background: none; font-family: inherit; font-size: 15px; font-weight: 700; color: #16181D">미응답</button>
        <button type="button" role="tab" aria-selected="false" style="min-height: 44px; padding: 0 2px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; font-family: inherit; font-size: 15px; font-weight: 600; color: #4B5160">응답 종료</button>
      </div>
      <sc-if value="{{on}}" hint-placeholder-val="{{ false }}">
        <article class="pk-pop" style="margin-top: 12px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px">
          <header style="display: flex; align-items: center; gap: 12px; padding: 14px 16px">
            <span style="flex: 0 0 40px; height: 40px; border-radius: 12px; background: #EEF2FF; color: #2D48D6; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center">박</span>
            <span style="display: flex; flex-direction: column; gap: 2px"><span style="display: flex; align-items: baseline; gap: 8px"><strong style="font-size: 15px">박관람</strong><span style="font-size: 12px; color: #5F6575">요청 2026-10-09</span></span><span style="font-size: 12px; color: #6B7180">신청한 이용자</span></span>
            <span style="margin-left: auto; font-size: 12px; font-weight: 700; color: #8A5300; background: #FFF4E0; padding: 5px 10px; border-radius: 999px">요청 대기중</span>
          </header>
          <button type="button" onClick="{{openDetail}}" style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 16px; border: 0; border-top: 1px dashed #DDE1E8; background: none; font-family: inherit; text-align: left; color: #16181D; cursor: pointer">
            <span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 17px; font-weight: 800; letter-spacing: -0.3px">${TITLE}</span><span style="font-size: 13px; color: #4B5160">2026-12-05 · YES24 티켓</span></span>
            ${svg('chevron', 18, '#8A90A0', 2)}
          </button>
        </article>
      </sc-if>
      <sc-if value="{{off}}" hint-placeholder-val="{{ true }}">
        <div style="margin-top: 28px; text-align: center"><div style="font-size: 15px; font-weight: 700">아직 받은 요청이 없어요</div><div style="margin-top: 4px; font-size: 13px; color: #5F6575">활동을 켜면 요청이 와요</div></div>
      </sc-if>
      ${notice('요청 수락 시 매칭권 1장이 사용돼요. 안전거래 결제는 이용자가 최종 조건을 확정한 뒤 별도로 진행해요.')}
    </sc-if>`;

const DETAIL = `<sc-if value="{{onDetail}}" hint-placeholder-val="{{ false }}">
      ${pageTitle('{{crumb}}', '요청 상세')}
      <section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px">
          <small style="font-size: 12px; color: #6B7180; white-space: nowrap">요청 2026. 10. 9. 오전 11:40</small>
          ${BADGE}
        </div>
        <h2 style="margin: 12px 0 0; font-size: 22px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px">${TITLE}</h2>
        <p style="margin: 4px 0 0; font-size: 14px; color: #4B5160">박관람 이용자 · YES24 티켓</p>
        ${NEXT}
      </section>
      <sc-if value="{{showProposed}}" hint-placeholder-val="{{ false }}">${card('도우미가 보낸 최종 조건', `${notice('1차 제안 · 이용자 확인을 기다리고 있어요.')}
  ${rows(AGREEMENT)}`)}</sc-if>
      <sc-if value="{{showFinal}}" hint-placeholder-val="{{ false }}">${card('확정된 최종 조건', `${notice('양측이 1차 제안에 동의해 확정됐어요.', 'success')}
  ${rows(AGREEMENT)}`)}</sc-if>
      <sc-if value="{{showRequest}}" hint-placeholder-val="{{ true }}">${card('이용자가 보낸 요청', rows(REQUEST))}</sc-if>
      <sc-if value="{{contactsHidden}}" hint-placeholder-val="{{ true }}">${contactCard(false)}</sc-if>
      <sc-if value="{{contactsShown}}" hint-placeholder-val="{{ false }}">${contactCard(true, '010-2345-6789', 'summer_letter')}</sc-if>
      <sc-if value="{{showPayment}}" hint-placeholder-val="{{ false }}">${PAYMENT_CARD('{{payTotal}}')}</sc-if>
      ${cardOpen('진행 상황', 16)}
        <sc-if value="{{prog0}}" hint-placeholder-val="{{ true }}">${progressList(0)}</sc-if>
        <sc-if value="{{prog1}}" hint-placeholder-val="{{ false }}">${progressList(1)}</sc-if>
        <sc-if value="{{prog2}}" hint-placeholder-val="{{ false }}">${progressList(2)}</sc-if>
        <sc-if value="{{prog4}}" hint-placeholder-val="{{ false }}">${progressList(4)}</sc-if>
        <sc-if value="{{actPending}}" hint-placeholder-val="{{ true }}">
          <button type="button" onClick="{{openAccept}}" style="${BTN}">요청 수락하기</button>
          <button type="button" onClick="{{tryReject}}" style="${BTN_GHOST}">요청 거절</button>
          <sc-if value="{{rejectNote}}" hint-placeholder-val="{{ false }}"><p role="status" style="margin: 8px 0 0; text-align: center; font-size: 13px; color: #4B5160">이번엔 수락해 볼까요?</p></sc-if>
        </sc-if>
        <sc-if value="{{actAccepted}}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{toTerms}}" style="${BTN}">최종 조건 작성하기</button></sc-if>
        <sc-if value="{{actSent}}" hint-placeholder-val="{{ false }}">
          ${notice('이용자의 최종 확인을 기다리고 있어요.').replace('margin-top: 12px', 'margin-top: 0')}
          <div class="pk-pop" style="margin-top: 12px; padding: 14px 16px; border: 1px solid #E6E9EF; border-radius: 16px; background: #FFFFFF; box-shadow: 0 6px 16px rgba(22,24,29,0.08)">
            <div style="font-size: 12px; font-weight: 700; color: #2D48D6">잠시 뒤</div>
            <div style="margin-top: 1px; font-size: 16px; font-weight: 800; letter-spacing: -0.3px">이용자가 확정하고 결제했어요</div>
            <button type="button" onClick="{{skipTime}}" style="${BTN}; margin-top: 12px">다음</button>
          </div>
        </sc-if>
        <sc-if value="{{actReady}}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{openStart}}" style="${BTN}">예매 착수하기</button></sc-if>
        <sc-if value="{{actStarted}}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{toResultPick}}" style="${BTN}">결과 등록</button></sc-if>
        <sc-if value="{{finalized}}" hint-placeholder-val="{{ false }}">${CONFIRMED}</sc-if>
      </section>
      ${DISCLAIMER}
    </sc-if>`;

const TERMS = `<sc-if value="{{onTerms}}" hint-placeholder-val="{{ false }}">
      ${pageTitle('요청 상세', '최종 조건 작성')}
      <p role="status" style="margin: -6px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">작성 내용은 이 탭에 자동으로 임시저장돼요. 요청 상세를 확인하고 돌아와도 이어 쓸 수 있어요.</p>
      ${notice('체험이라 아무 내용이나 적어도 돼요. 빈칸만 채우면 다음으로 넘어가요.')}
      ${card('진행 조건', `<p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">최초 요청이나 최근 합의안을 바탕으로 조건을 조정해 서로에게 제안할 수 있어요.</p>
  ${fieldL('희망 좌석·요청 내용', true, '', area('{{setSeat}}', '{{seatStyle}}'))}
  ${fieldL('성공 요건', true, '', area('{{setCond}}', '{{condStyle}}'))}
  ${fieldL('예매 시도 방식', true, '', area('{{setMethod}}', '{{methodStyle}}', '예: 티켓 오픈 시각에 PC 1대로 예매를 시도하고, 대기열 화면을 증빙으로 남겨요.'))}`)}
      ${cardOpen('비용과 결과 안내', 16)}
        ${fieldL('착수비', true, '예매 시도에 대한 비용이에요.', `<span style="position: relative; display: block">${input('{{setUpfront}}', '{{upfrontStyle}}', '0', 'numeric')}<span aria-hidden="true" style="position: absolute; right: 14px; top: 50%; margin-top: -6px; font-size: 14px; color: #4B5160">원</span></span>`)}
        ${fieldL('수고비(성공보수)', true, '성공 요건을 충족했을 때 받는 비용이에요.', `<span style="position: relative; display: block">${input('{{setSuccess}}', '{{successStyle}}', '0', 'numeric')}<span aria-hidden="true" style="position: absolute; right: 14px; top: 50%; margin-top: -6px; font-size: 14px; color: #4B5160">원</span></span>`)}
        <div role="radiogroup" aria-label="거래 방식" style="margin-top: 4px">
        ${radio('safe', '{{pickSafe}}', '안전거래', '이용자가 PICO에 결제하고, 조건에 따라 정산돼요. 수수료 {{feeWon}}(수고비의 3%, 최소 1,000원)')}
        ${radio('direct', '{{pickDirect}}', '직접 거래', '조건 확정으로 매칭이 완료돼요. 착수·결과 등록 없이 당사자끼리 진행하고 이용자가 후기를 남겨요. 결제·환불은 직접 처리해요.')}
        </div>
        <sc-if value="{{direct}}" hint-placeholder-val="{{ false }}"><p role="status" style="margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: #4B5160">혼자 해 보기에서는 안전거래로 진행해요. 직접 거래는 착수·결과 등록 없이 끝나요.</p></sc-if>
        <div style="margin-top: 12px">${sumRow('착수비', '{{upWon}}')}${sumRow('수고비', '{{suWon}}')}${sumRow('안전거래 수수료', '{{feeShown}}')}</div>
        <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 8px; padding-top: 12px; border-top: 1px solid #E6E9EF"><span style="font-size: 14px; color: #4B5160">이용자 결제 금액</span><strong style="font-size: 18px; font-weight: 800">{{total}}</strong></div>
        ${fieldL('실패·환불 처리', true, '', area('{{setRefund}}', '{{refundStyle}}'))}
        ${fieldL('기타 사항', false, '꼭 알려야 할 내용이 있으면 적어 주세요.', area('{{setNote2}}', '{{note2Style}}', '예: 예매 당일 연락 가능한 시간대'))}
        ${fieldL('결과 연락 기한', true, '', input('{{setDeadline}}', '{{deadlineStyle}}'))}
        <p role="status" style="margin: 18px 0 10px; font-size: 13px; color: #4B5160">{{footerNote}}</p>
        <sc-if value="{{termsErr}}" hint-placeholder-val="{{ false }}"><p role="alert" style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #B42318">{{termsErrText}}</p></sc-if>
        <button type="button" onClick="{{sendTerms}}" style="${BTN}">최종 조건 작성하기</button>
      </section>
      ${card('이용자의 최초 요청', rows([['공연명', TITLE], ['티켓 오픈', '2026-11-10 20:00'], ['예매처', 'YES24 티켓'], ['희망 좌석·요청 내용', '2층 앞열 1매'], ['성공 요건', '2층 5열 이내 1매'], ['희망 수고비', '15,000원'], ['최대 수고비', '20,000원'], ['기타 사항', '미입력']]))}
    </sc-if>`;

const CONDITIONS = card('확정된 조건', `<h3 style="margin: 10px 0 0; font-size: 15px">${TITLE}</h3>
  ${rows([['희망 좌석·요청 내용', '{{seatV}}'], ['성공 요건', '{{condV}}'], ['실패·환불 처리', '{{refundV}}']])}`);
const chosenIcon = RESULT_CHOICES.map(([k, , , bg, color, icon]) => `<sc-if value="{{is${k}}}" hint-placeholder-val="{{ false }}"><span aria-hidden="true" style="flex: 0 0 36px; height: 36px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center">${icon === 'half' ? `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="${color}" stroke-width="2.2"></circle><path d="M12 4a8 8 0 0 1 0 16Z" fill="${color}"></path></svg>` : svg(icon, 18, color, 2.4)}</span></sc-if>`).join('');
const RESULT = `<sc-if value="{{onResultPick}}" hint-placeholder-val="{{ false }}">
      ${pageTitle('요청 상세', '예매 결과 등록')}
      ${cardOpen('1. 예매 결과')}
        <div role="group" aria-label="예매 결과" style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px">
          ${resultOption(RESULT_CHOICES[0], '{{pickSUCCESS}}')}
          ${resultOption(RESULT_CHOICES[1], '{{pickPARTIAL}}')}
          ${resultOption(RESULT_CHOICES[2], '{{pickFAILURE}}')}
        </div>
      </section>
      ${CONDITIONS}
    </sc-if>
    <sc-if value="{{onResult}}" hint-placeholder-val="{{ false }}">
      ${pageTitle('요청 상세', '예매 결과 등록')}
      ${notice('체험이라 아무 내용이나 적어도 돼요. 빈칸만 채우면 다음으로 넘어가요.')}
      ${cardOpen('1. 예매 결과')}
        <div style="display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 14px; border: 1px solid #3A5BFF; border-radius: 12px; background: #F8F9FF">
          ${chosenIcon}
          <span style="flex: 1; min-width: 0"><strong style="display: block; font-size: 15px">{{kindLabel}}</strong><small style="display: block; margin-top: 4px; font-size: 12px; line-height: 1.5; color: #6B7180">{{kindDesc}}</small></span>
        </div>
        <button type="button" onClick="{{backToPick}}" style="display: inline-flex; align-items: center; min-height: 44px; margin-top: 4px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: #2D48D6; cursor: pointer">다른 결과 고르기</button>
      </section>
      ${cardOpen('2. 결과 설명', 16)}
        ${fieldL('{{noteLabel}}', true, '', area('{{setResultNote}}', '{{resultNoteStyle}}', '{{notePh}}'))}
        <sc-if value="{{showSeats}}" hint-placeholder-val="{{ true }}">${fieldL('확보한 좌석과 수량', false, '', input('{{noop}}', '{{seatsStyle}}', '예: 1층 5구역 8열, 연석 2매'))}</sc-if>
        <h3 style="margin: 20px 0 0; font-size: 14px">{{evLabel}} <span style="{{evTagStyle}}">{{evTag}}</span></h3>
        <p style="margin: 4px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">{{evDesc}}</p>
        <div style="margin-top: 10px">
          <sc-if value="{{noFile}}" hint-placeholder-val="{{ true }}">${UPLOAD_BOX('{{attach}}')}</sc-if>
          <sc-if value="{{file}}" hint-placeholder-val="{{ false }}">${FILE_CHIP}</sc-if>
        </div>
        ${RESULT_NOTICE}
        <p role="status" style="margin: 16px 0 10px; font-size: 13px; color: #B42318">{{blockNote}}</p>
        <sc-if value="{{resultErr}}" hint-placeholder-val="{{ false }}"><p role="alert" style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #B42318">필수 항목이에요. 입력해 주세요.</p></sc-if>
        <button type="button" onClick="{{submitResult}}" aria-disabled="{{submitBlocked}}" style="{{submitStyle}}">결과 등록</button>
      </section>
      ${CONDITIONS}
    </sc-if>`;

const DONE = `<sc-if value="{{onDone}}" hint-placeholder-val="{{ false }}">
    <div class="pk-pop" style="position: absolute; top: 56px; left: 0; right: 0; bottom: 0; z-index: 70; background: #FFFFFF; display: flex; flex-direction: column; padding: 0 24px 24px; box-sizing: border-box">
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center">
        ${L.MASCOT(80)}
        <h1 style="margin: 18px 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px">혼자서도 해냈어요</h1>
        <p style="margin: 8px 0 0; font-size: 16px; line-height: 1.5; color: #4B5160">요청 수락부터 결과 등록까지 마쳤어요.</p>
      </div>
      <a href="M11-apply.dc.html" style="${BTN}">사전 신청하러 가기</a>
      <a href="M2-welcome-character.dc.html" style="${BTN_GHOST}; color: #16181D; text-decoration: none">처음부터 다시 보기</a>
    </div>
  </sc-if>`;

const body = `  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">
${L.header({ avatar: '{{avatarStyle}}', progress: false }).replace('<header style="position: relative; height: 56px;', '<header style="position: relative; flex: 0 0 56px; height: 56px;')}
    <div style="flex: 0 0 auto; padding: 12px 20px 0">
      <div style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 14px; padding: 4px 6px 4px 12px; display: flex; align-items: center; gap: 8px">
        <span style="flex: 0 0 auto; font-size: 11px; font-weight: 800; color: #2D48D6; background: #EEF2FF; padding: 3px 8px; border-radius: 999px">혼자 해 보기 {{stageN}}/5</span>
        <span style="flex: 1; min-width: 0; font-size: 14px; font-weight: 700">{{mission}}</span>
        <button type="button" aria-expanded="{{hint}}" onClick="{{toggleHint}}" style="flex: 0 0 auto; min-height: 44px; padding: 0 10px; border: 0; background: none; font-family: inherit; font-size: 13px; font-weight: 600; color: #4B5160; cursor: pointer">힌트</button>
      </div>
      <sc-if value="{{hint}}" hint-placeholder-val="{{ false }}"><p role="status" style="margin: 6px 4px 0; font-size: 13px; color: #4B5160">{{hintText}}</p></sc-if>
    </div>
    <div ref="{{boxRef}}" style="flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px 90px">
    ${MAIN}
    ${MY}
    ${LEADS}
    ${DETAIL}
    ${TERMS}
    ${RESULT}
    </div>
  </div>

  <sc-if value="{{showNav}}" hint-placeholder-val="{{ true }}">
    <nav aria-label="하단 메뉴" style="position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; height: 66px; background: #FFFFFF; border-top: 1px solid #E6E9EF; display: flex">
      <sc-if value="{{isUser}}" hint-placeholder-val="{{ true }}">
        <button type="button" aria-current="{{curFind}}" onClick="{{toMain}}" style="{{navFind}}">${svg('search', 22, 'currentColor', 1.7)}도우미 찾기</button>
        <button type="button" style="{{navOff}}">${svg('ticket', 22, 'currentColor', 1.7)}내 활동</button>
      </sc-if>
      <sc-if value="{{helper}}" hint-placeholder-val="{{ false }}">
        <button type="button" aria-current="{{curLeads}}" onClick="{{toLeads}}" style="{{navLeads}}">${svg('inbox', 22, 'currentColor', 1.7)}받은 요청</button>
        <button type="button" style="{{navOff}}">${svg('ticket', 22, 'currentColor', 1.7)}매칭 관리</button>
      </sc-if>
      <button type="button" aria-current="{{curMy}}" onClick="{{toMy}}" style="{{navMy}}">${svg('user', 22, 'currentColor', 1.7)}마이</button>
    </nav>
  </sc-if>

  <sc-if value="{{onAcceptSheet}}" hint-placeholder-val="{{ false }}">
    ${sheet({ label: '요청 수락 확인', title: '요청을 수락할까요?', body: ACCEPT_BODY(TITLE), cancel: '{{closeSheet}}', confirmBtn: `<button type="button" onClick="{{confirmAccept}}" style="${BTN}; flex: 1; width: auto">수락하기</button>` })}
    </div>
  </sc-if>

  <sc-if value="{{onStartSheet}}" hint-placeholder-val="{{ false }}">
    ${sheet({ label: '예매 착수 확인', title: '예매를 시작할까요?', body: START_BODY, cancel: '{{closeSheet}}', confirmBtn: `<button type="button" onClick="{{confirmStart}}" style="${BTN}; flex: 1; width: auto">착수하기</button>` })}
    </div>
  </sc-if>

  ${DONE}`;

const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      screen: 'main', helper: false, on: false, hint: false, rejectNote: false, balance: 10,
      seat: '', cond: '', method: '', upfront: '', success: '', deal: '', refund: '', note2: '', deadline: '', termsTried: false,
      kind: '', resultNote: '', file: false, resultTried: false,
    };
    this.boxRef = (el) => { this.box = el; };
  }
  renderVals() {
    const st = this.state;
    const sc = st.screen;
    const set = (p) => this.setState(p);
    // 화면이 바뀌면 맨 위부터 보여 준다(실제 앱의 페이지 이동과 같다). 같은 화면 안에서 단계만 바뀌면 그대로 둔다.
    const go = (screen, extra, keep) => {
      set(Object.assign({ screen: screen, hint: false, rejectNote: false }, extra || {}));
      if (!keep && this.box) this.box.scrollTop = 0;
    };
    const num = (v) => Number(String(v || '').replace(/[^0-9]/g, '')) || 0;
    const won = (n) => n.toLocaleString('ko-KR') + '원';
    const has = (v) => String(v || '').trim() !== '';
    const or = (v) => (has(v) ? v : '미입력');

    const phase = { detail: 'P', acceptSheet: 'P', accepted: 'A', sent: 'S', ready: 'R', startSheet: 'R', started: 'G' }[sc] || '';
    const stage = { main: 1, my: 1, leads: 2, detail: 2, acceptSheet: 2, accepted: 3, terms: 3, sent: 3, ready: 4, startSheet: 4, started: 5, resultPick: 5, result: 5, done: 5 }[sc];
    const missions = ['', st.helper ? '받은 요청으로 가 보세요' : '도우미로 바꿔 보세요', '요청을 수락해 보세요', '최종 조건을 보내 보세요', '예매를 시작해 보세요', '결과를 등록해 보세요'];
    const failure = st.kind === 'FAILURE';
    const hints = {
      main: '아래 ‘마이’를 눌러요.',
      my: st.helper ? '아래 ‘받은 요청’을 눌러요.' : '‘도우미’를 눌러요.',
      leads: st.on ? '새로 온 요청을 눌러요.' : '‘활동 중’ 스위치를 켜요.',
      detail: '요청서를 확인하고 맨 아래 ‘요청 수락하기’를 눌러요.',
      acceptSheet: '‘수락하기’를 눌러요.',
      accepted: '맨 아래 ‘최종 조건 작성하기’를 눌러요.',
      terms: '빈칸에 아무 내용이나 적고, 거래 방식을 고른 뒤 맨 아래 버튼을 눌러요.',
      sent: '맨 아래 ‘다음’을 눌러요.',
      ready: '맨 아래 ‘예매 착수하기’를 눌러요.',
      startSheet: '‘착수하기’를 눌러요.',
      started: '맨 아래 ‘결과 등록’을 눌러요.',
      resultPick: '예매 결과를 하나 골라요.',
      result: failure ? '실패 사유를 쓰고 시도 증빙을 올려요.' : '결과 설명을 쓰고 ‘결과 등록’을 눌러요.',
    };

    const fieldBase = 'display: block; width: 100%; margin-top: 6px; padding: 12px 14px; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 16px; font-weight: 400; line-height: 1.5; color: #16181D; box-sizing: border-box; resize: vertical; ';
    const field = (ok, extra) => fieldBase + (extra || '') + 'border: 1px solid ' + (ok ? '#D5D9E2' : '#D92D20');
    const tOk = (v) => !st.termsTried || has(v);
    const mOk = (v) => !st.termsTried || has(v);
    const up = num(st.upfront);
    const su = num(st.success);
    const fee = st.deal === 'direct' ? 0 : Math.max(1000, Math.ceil(su * 0.03));
    const termsMissing = !has(st.seat) || !has(st.cond) || !has(st.method) || !has(st.upfront) || !has(st.success) || !st.deal || !has(st.refund) || !has(st.deadline);
    const methodStyle = (on) => 'display: flex; align-items: center; gap: 14px; margin-top: 12px; padding: 16px; border-radius: 12px; cursor: pointer; ' +
      (on ? 'border: 1px solid #3A5BFF; background: #F8F9FF' : 'border: 1px solid ' + (st.termsTried && !st.deal ? '#D92D20' : '#E6E9EF') + '; background: #FFFFFF');

    const kinds = {
      SUCCESS: { label: '성공', desc: '성공 요건을 모두 충족했어요. 예매 내역 화면을 첨부하면 이용자가 바로 확인해요(선택).', noteLabel: '결과 설명', notePh: '예: 요청하신 1층 좌석 2매를 예매했어요.', evLabel: '성공 증빙 자료', evDesc: '성공한 예매 내역 화면을 첨부할 수 있어요.', fileName: '예매내역.png' },
      PARTIAL: { label: '부분 성공', desc: '일부만 충족했어요. 증빙은 선택이에요. 안전거래는 완료 후 부분성공 정산으로 금액을 정해요.', noteLabel: '결과 설명', notePh: '예: 요청하신 1층 좌석 2매를 예매했어요.', evLabel: '결과 증빙 자료', evDesc: '확보한 만큼의 예매 내역 화면을 첨부할 수 있어요.', fileName: '예매내역.png' },
      FAILURE: { label: '실패', desc: '예매하지 못했어요. 예매를 시도한 화면(시도 증빙)이 반드시 필요해요.', noteLabel: '실패 사유', notePh: '예: 오픈 3분 만에 전석 매진됐어요.', evLabel: '시도 증빙 자료', evDesc: '예매 대기·좌석 선택·매진 화면처럼 예매를 시도한 화면을 1개 이상 첨부해 주세요.', fileName: '시도화면.png' },
    };
    const k = kinds[st.kind] || kinds.SUCCESS;
    const blocked = failure && !st.file;
    const pickKind = (kind) => () => go('result', { kind: kind, resultNote: '', file: false, resultTried: false });

    const badge = { P: ['도우미 응답 대기', true], A: ['최종 조건 작성 필요'], S: ['최종 조건 확인 대기'], R: ['착수 대기'], G: ['예매 진행 중'] }[phase] || ['', false];
    const next = {
      P: ['도우미가 요청을 확인할 차례예요', '요청을 확인하고 수락하거나 거절해 주세요.'],
      A: ['도우미가 첫 최종 조건을 작성할 차례예요', '비용과 진행 조건을 정해 첫 제안을 보내 주세요.'],
      S: ['이용자가 최종 조건을 확인할 차례예요', '이용자의 확인을 기다려 주세요.'],
      R: ['도우미가 착수할 차례예요', '예매를 시작할 때 착수 버튼을 눌러 주세요.'],
      G: ['도우미가 예매 결과를 등록할 차례예요', '시도 증빙을 올리고, 예매가 끝나면 결과 증빙을 올려 주세요. 운영팀 파일 검토 후 결과를 제출할 수 있어요.'],
    }[phase] || ['', ''];

    const navItem = (active) => 'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border: 0; background: none; font-family: inherit; font-size: 11px; cursor: pointer; ' + (active ? 'font-weight: 700; color: #3A5BFF' : 'font-weight: 600; color: #5F6575');
    const tab = sc === 'main' ? 'find' : sc === 'my' ? 'my' : 'leads';
    const seg = (on) => 'min-height: 34px; width: 66px; border: 0; border-radius: 8px; font-family: inherit; font-size: 12px; cursor: pointer; ' + (on ? 'background: #3A5BFF; font-weight: 700; color: #FFFFFF' : 'background: transparent; font-weight: 600; color: #4B5160');
    const BTN = '${BTN}';

    return {
      boxRef: this.boxRef,
      stageN: stage,
      mission: missions[stage],
      hint: st.hint,
      hintText: hints[sc] || '',
      toggleHint: () => set({ hint: !st.hint }),
      avatarStyle: 'width: 34px; height: 34px; border-radius: 50%; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; ' + (st.helper ? 'background: #E6F7F3; color: #0B7A67' : 'background: #EEF2FF; color: #2D48D6'),
      balance: st.balance,

      onMain: sc === 'main',
      onMy: sc === 'my',
      onLeads: sc === 'leads',
      onDetail: phase !== '',
      onTerms: sc === 'terms',
      onResultPick: sc === 'resultPick',
      onResult: sc === 'result',
      onAcceptSheet: sc === 'acceptSheet',
      onStartSheet: sc === 'startSheet',
      onDone: sc === 'done',

      isUser: !st.helper,
      helper: st.helper,
      userBtn: seg(!st.helper),
      helperBtn: seg(st.helper),
      toHelper: () => set({ helper: true, hint: false }),
      toUser: () => set({ helper: false, hint: false }),

      on: st.on,
      off: !st.on,
      onLabel: st.on ? 'ON' : 'OFF',
      pendingCount: st.on ? 1 : 0,
      trackStyle: 'position: relative; display: inline-block; width: 36px; height: 22px; border-radius: 999px; transition: background 0.2s; background: ' + (st.on ? '#3A5BFF' : '#C2C8D3'),
      knobStyle: 'position: absolute; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 2px rgba(0,0,0,0.25); transition: left 0.2s; left: ' + (st.on ? '17px' : '3px'),
      toggleOn: () => set({ on: !st.on, hint: false }),
      openDetail: () => go('detail'),

      crumb: phase === 'P' ? '받은 요청' : '매칭 관리',
      badgeText: badge[0],
      badgeStyle: 'flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; ' + (badge[1] ? 'background: #FFF5DF; color: #8A5300' : 'background: #EEF2FF; color: #2D48D6'),
      nextTitle: next[0],
      nextText: next[1],
      idle: phase === 'S',
      showProposed: phase === 'S',
      showFinal: phase === 'R' || phase === 'G',
      showRequest: phase !== 'S',
      contactsHidden: phase === 'P',
      contactsShown: phase !== 'P',
      showPayment: phase === 'R' || phase === 'G',
      payTotal: won(up + su + fee),
      prog0: phase === 'P',
      prog1: phase === 'A',
      prog2: phase === 'S',
      prog4: phase === 'R' || phase === 'G',
      actPending: phase === 'P',
      actAccepted: phase === 'A',
      actSent: phase === 'S',
      actReady: phase === 'R',
      actStarted: phase === 'G',
      finalized: phase === 'R' || phase === 'G',
      rejectNote: st.rejectNote,
      tryReject: () => set({ rejectNote: true }),
      openAccept: () => go('acceptSheet', null, true),
      confirmAccept: () => go('accepted', { balance: st.balance - 1 }, true),
      closeSheet: () => go(sc === 'startSheet' ? 'ready' : 'detail', null, true),
      toTerms: () => go('terms'),
      skipTime: () => go('ready'),
      openStart: () => go('startSheet', null, true),
      confirmStart: () => go('started', null, true),
      toResultPick: () => go('resultPick'),

      setSeat: (e) => set({ seat: e.target.value }),
      setCond: (e) => set({ cond: e.target.value }),
      setMethod: (e) => set({ method: e.target.value }),
      setUpfront: (e) => set({ upfront: e.target.value }),
      setSuccess: (e) => set({ success: e.target.value }),
      setRefund: (e) => set({ refund: e.target.value }),
      setNote2: (e) => set({ note2: e.target.value }),
      setDeadline: (e) => set({ deadline: e.target.value }),
      seatStyle: field(tOk(st.seat)),
      condStyle: field(tOk(st.cond)),
      methodStyle: field(tOk(st.method)),
      upfrontStyle: field(mOk(st.upfront), 'padding-right: 36px; '),
      successStyle: field(mOk(st.success), 'padding-right: 36px; '),
      refundStyle: field(tOk(st.refund)),
      note2Style: field(true),
      deadlineStyle: field(tOk(st.deadline)),
      safe: st.deal === 'safe',
      direct: st.deal === 'direct',
      safeStyle: methodStyle(st.deal === 'safe'),
      directStyle: methodStyle(st.deal === 'direct'),
      pickSafe: () => set({ deal: 'safe' }),
      pickDirect: () => set({ deal: 'direct' }),
      upWon: won(up),
      suWon: won(su),
      feeWon: won(Math.max(1000, Math.ceil(su * 0.03))),
      feeShown: won(fee),
      total: st.deal === 'safe' ? won(up + su + fee) : st.deal === 'direct' ? '직접 정산' : '—',
      footerNote: st.deal === 'direct' ? '이용자가 확인하고 확정하면 매칭이 완료돼요. 이후 착수·결과 등록은 필요 없어요.' : '이용자가 확인하고 확정하면 결제 단계로 넘어가요.',
      termsErr: st.termsTried && (termsMissing || st.deal === 'direct'),
      termsErrText: termsMissing ? '빈칸을 모두 채워 주세요.' : '혼자 해 보기에서는 안전거래를 골라 주세요.',
      sendTerms: () => {
        if (termsMissing || st.deal === 'direct') {
          set({ termsTried: true });
          return;
        }
        go('sent');
      },
      seatV: or(st.seat),
      condV: or(st.cond),
      methodV: or(st.method),
      refundV: or(st.refund),
      deadlineV: or(st.deadline),
      noteV: or(st.note2),

      pickSUCCESS: pickKind('SUCCESS'),
      pickPARTIAL: pickKind('PARTIAL'),
      pickFAILURE: pickKind('FAILURE'),
      backToPick: () => go('resultPick'),
      isSUCCESS: st.kind === 'SUCCESS',
      isPARTIAL: st.kind === 'PARTIAL',
      isFAILURE: failure,
      kindLabel: k.label,
      kindDesc: k.desc,
      noteLabel: k.noteLabel,
      notePh: k.notePh,
      setResultNote: (e) => set({ resultNote: e.target.value }),
      resultNoteStyle: field(!st.resultTried || has(st.resultNote)),
      noop: () => {},
      seatsStyle: field(true),
      showSeats: !failure,
      evLabel: k.evLabel,
      evTag: failure ? '*' : '선택',
      evTagStyle: failure ? 'font-weight: 700; color: #B42318' : 'font-size: 12px; font-weight: 500; color: #6B7180',
      evDesc: k.evDesc,
      file: st.file,
      noFile: !st.file,
      fileName: k.fileName,
      attach: () => set({ file: true }),
      blockNote: blocked ? '실패 결과는 시도 증빙 파일을 첨부해야 제출할 수 있어요.' : '',
      submitBlocked: blocked,
      submitStyle: BTN + (blocked ? '; opacity: 0.45; cursor: not-allowed' : ''),
      resultErr: st.resultTried && !has(st.resultNote),
      submitResult: () => {
        if (blocked) return;
        if (!has(st.resultNote)) {
          set({ resultTried: true });
          return;
        }
        go('done');
      },

      showNav: sc !== 'done',
      curFind: tab === 'find' ? 'page' : 'false',
      curLeads: tab === 'leads' ? 'page' : 'false',
      curMy: tab === 'my' ? 'page' : 'false',
      navFind: navItem(tab === 'find'),
      navLeads: navItem(tab === 'leads'),
      navMy: navItem(tab === 'my'),
      navOff: navItem(false),
      toMain: () => { if (!st.helper && sc !== 'main') go('main'); },
      toMy: () => { if (sc === 'main' || sc === 'leads') go('my'); },
      toLeads: () => { if (sc === 'my' || phase === 'P') go('leads'); },
    };
  }
}`;
write('M6-practice.dc.html', doc('혼자 해 보기 · 강조 없음', body, script));
console.log('built M6');
