// 이용자 혼자 해 보기(U6) 보드: 강조 없이 미션과 힌트만 보고 도우미 고르기부터 매칭 완료까지 해 본다.
// build-user.cjs가 불러서 함께 만든다. 화면 구조·문구는 실제 앱(도우미 프로필·요청 보내기·요청 상세)을 따른다.
const L = require('./build-lib.cjs');
const { profileFeedback, doc, write, svg, header, AVATAR_USER, cardOpen, card, rows, notice, progressList, DISCLAIMER, CONFIRMED, BTN, BTN_GHOST, sheet, DIRECT_CARD, MASCOT } = L;

const SIGNUP_URL = 'https://pico-kr.app/login';
const AGENT = '별빛티켓';
const crumbTitle = (crumb, current, title) => `<nav aria-label="현재 위치" style="margin-bottom: 8px; font-size: 13px; color: #6B7180">${crumb} <span aria-hidden="true">›</span> <span aria-current="page">${current}</span></nav>
      <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px">${title}</h1>`;
const label = (text, required, helper) => `<div style="margin-top: 16px; font-size: 13px; font-weight: 700">${text}${required ? ' <em style="font-style: normal; font-size: 10px; color: #B42318">*</em>' : ' <small style="font-size: 11px; font-weight: 400; color: #8A90A0">선택</small>'}</div>${helper ? `<div style="margin-top: 2px; font-size: 12px; line-height: 1.6; color: #6B7180">${helper}</div>` : ''}`;
const area = (handler, style, ph) => `<textarea rows="3" onInput="${handler}" placeholder="${ph}" style="${style}"></textarea>`;
const input = (handler, style, ph) => `<input onInput="${handler}" placeholder="${ph}" style="${style}">`;
const fieldL = (text, required, helper, control) => `<label style="display: block">${label(text, required, helper)}${control}</label>`;
const BADGE = `<span style="{{badgeStyle}}"><sc-if value="{{matched}}" hint-placeholder-val="{{ false }}">${svg('check', 13, 'currentColor', 2)}</sc-if><sc-if value="{{notMatched}}" hint-placeholder-val="{{ true }}">${svg('clock', 13, 'currentColor', 2)}</sc-if>{{badgeText}}</span>`;
const NEXT = `<div style="display: flex; align-items: flex-start; gap: 13px; margin-top: 18px; padding: 16px; border-radius: 12px; background: {{nextBg}}">
        <span style="flex: 0 0 42px; height: 42px; border-radius: 12px; background: #FFFFFF; display: flex; align-items: center; justify-content: center"><sc-if value="{{matched}}" hint-placeholder-val="{{ false }}">${svg('check', 22, '#3A5BFF')}</sc-if><sc-if value="{{notMatched}}" hint-placeholder-val="{{ true }}">${svg('clock', 22, '#3A5BFF')}</sc-if></span>
        <div><strong style="font-size: 15px">{{nextTitle}}</strong><p style="margin: 6px 0 0; font-size: 12px; line-height: 1.7; color: #4B5160">{{nextText}}</p><sc-if value="{{waiting}}" hint-placeholder-val="{{ false }}"><p style="margin: 6px 0 0; font-size: 12px; line-height: 1.7; color: #4B5160">체험님은 지금 따로 하실 일이 없어요. 편하게 기다려 주세요.</p></sc-if></div>
      </div>`;
// 이용자가 쓴 요청과 도우미가 보낸 최종 조건(agreementRows). 비용·처리 방식은 도우미가 정한 체험용 값이다.
const REQUEST = [['공연명', '{{titleV}}'], ['티켓 오픈', '{{openV}}'], ['예매처', '{{siteV}}'], ['희망 좌석·요청 내용', '{{seatV}}'], ['성공 요건', '{{condV}}'], ['희망 수고비', '{{budgetV}}'], ['기타 사항', '{{noteV}}']];
const AGREEMENT = [
  ['착수비', '7,000원'], ['수고비(성공보수)', '25,000원'], ['거래 방식', '직접 거래(수수료 없음)'], ['희망 좌석·요청 내용', '{{seatV}}'], ['성공 요건', '{{condV}}'],
  ['예매 시도 방식', '직접 거래: 착수 증빙을 플랫폼에 제출하지 않음'], ['실패·환불 처리', '- 시도했지만 예매 실패: 착수비는 도우미 몫, 수고비는 받지 않음\n- 도우미 사정으로 취소: 받은 금액 전액 돌려줌'],
  ['결과 연락 기한', '예매 종료 후 30분 이내'], ['기타 사항', '{{noteV}}'], ['수정 사유', '미입력'],
];
const contact = (show) => card('연락방법', show
  ? `${rows([['전화번호', '010-2468-1357'], ['카카오톡', 'starlight_ticket']])}
  <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">매칭한 도우미에게만 공개되는 정보예요. 예매처 계정정보는 공유하지 마세요.</p>`
  : notice('도우미가 요청을 수락하면 서로의 연락처가 공개돼요.'));
const agentCard = (name, letter, bg, color, meta, handler) => `<button type="button"${handler ? ` onClick="${handler}"` : ''} style="display: flex; gap: 12px; width: 100%; margin-top: 12px; padding: 16px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; font-family: inherit; text-align: left; color: #16181D; cursor: pointer; box-sizing: border-box">
        <span style="flex: 0 0 52px; height: 52px; border-radius: 14px; background: ${bg}; color: ${color}; font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center">${letter}</span>
        <span style="min-width: 0"><strong style="display: block; font-size: 16px">${name}</strong><span style="display: block; margin-top: 6px; font-size: 13px; color: #4B5160">${meta}</span></span>
      </button>`;

const MAIN = `<sc-if value="{{onMain}}" hint-placeholder-val="{{ true }}">
      <div style="height: 52px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E6E9EF; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box">
        <span style="font-size: 14px; color: #6B7180">공연명, 도우미 이름, 예매처를 검색해 보세요</span>
        ${svg('search', 20, '#3A5BFF', 2)}
      </div>
      <h2 style="margin: 22px 0 0; font-size: 17px; font-weight: 800">이번 주, 주목할 도우미</h2>
      ${agentCard('하늘도우미', '하', '#E6F7F3', '#0B7A67', '★ 4.8 · 거래 32회 · 착수비 5,000원부터', '{{pickSky}}')}
      ${agentCard(AGENT, '별', '#EEF2FF', '#2D48D6', '★ 4.6 · 거래 18회 · 착수비 7,000원부터', '{{pickStar}}')}
    </sc-if>`;

const PROFILE = `<sc-if value="{{onProfile}}" hint-placeholder-val="{{ false }}">
      ${crumbTitle('목록', '상세 프로필', '도우미 프로필')}
      <section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
        <div style="display: flex; gap: 14px">
          <span style="flex: 0 0 64px; height: 64px; border-radius: 18px; background: #EEF2FF; color: #2D48D6; font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center">{{agentLetter}}</span>
          <div style="min-width: 0"><h2 style="margin: 0; font-size: 20px; font-weight: 800">{{agentName}}</h2><p style="margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: #4B5160">오픈 시각에 맞춰 꼼꼼하게 준비해요.</p></div>
        </div>
      </section>
      ${card('함께하기 전에 확인하세요', `${rows([['가능 예매처', 'NOL 티켓 · YES24 티켓'], ['주로 맡는 분야', '콘서트 · 뮤지컬'], ['최소 착수비', '{{agentFee}}'], ['수고비', '최종 조건에서 확정']])}
  ${notice('연락처는 요청을 수락한 상대방에게만 공개돼요.')}`)}
      <sc-if value="{{isSky}}" hint-placeholder-val="{{ false }}">${profileFeedback(false)}</sc-if>
      <sc-if value="{{isStar}}" hint-placeholder-val="{{ true }}">${profileFeedback(false, { avg: '4.6', count: 18, bars: [13, 3, 1, 1, 0] })}</sc-if>
      <div style="display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 12px 16px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px">
        <span style="flex: 0 0 auto"><span style="display: block; font-size: 12px; color: #6B7180">최소 착수비</span><strong style="font-size: 16px">{{agentFee}}부터</strong></span>
        <button type="button" onClick="{{toQuote}}" style="${BTN}; flex: 1; width: auto">이 도우미에게 요청하기</button>
      </div>
    </sc-if>`;

const QUOTE = `<sc-if value="{{onQuote}}" hint-placeholder-val="{{ false }}">
      ${crumbTitle('도우미 프로필', '요청 보내기', '요청 보내기')}
      ${notice('체험이라 아무 내용이나 적어도 돼요. 빈칸만 채우면 다음으로 넘어가요.').replace('margin-top: 12px', 'margin-top: 0')}
      ${cardOpen('요청서', 16)}
        ${fieldL('공연명', true, '', input('{{setTitle}}', '{{titleStyle}}', '예: 태연 콘서트'))}
        ${fieldL('티켓 오픈 날짜', true, '', input('{{setOpen}}', '{{openStyle}}', '예: 2026-11-20'))}
        ${fieldL('예매처', true, '', input('{{setSite}}', '{{siteStyle}}', '예: NOL 티켓'))}
        ${fieldL('희망 좌석·요청 내용', true, '원하는 좌석과 요청 사항을 적어 주세요. 도우미가 어떻게 진행할지 참고하는 내용이에요.', area('{{setSeat}}', '{{seatStyle}}', '예: 1층 지정석, 연석 2매'))}
        ${fieldL('성공 요건', true, '어디까지 잡아야 성공으로 볼지 적어 주세요. 성공 요건은 수고비 지급의 최소 기준이 됩니다.', area('{{setCond}}', '{{condStyle}}', '예: 1층 A~C구역 연석 2매를 확보하면 성공'))}
        ${fieldL('희망 수고비', false, '도우미에게 제안하고 싶은 수고비예요. 최종 금액은 서로 합의해요.', input('{{setBudget}}', '{{budgetStyle}}', '예: 20000'))}
        ${fieldL('기타 사항', false, '', area('{{setNote}}', '{{noteStyle}}', '예: 오픈 직후 연락 가능해요'))}
      </section>
      ${card('연락처', `${notice('요청을 보내려면 상대방에게 공개할 연락처가 필요해요. 수락한 도우미에게만 공개돼요.')}
  ${fieldL('연락처', true, '', input('{{setPhone}}', '{{phoneStyle}}', '예: 010-1234-5678'))}`)}
      ${cardOpen('선택한 도우미', 16)}
        <h3 style="margin: 10px 0 0; font-size: 18px; font-weight: 800">{{agentName}}</h3>
        ${notice('PICO에서는 결제하지 않아요. 도우미가 보낸 최종 조건을 확정하면 매칭이 완료되고, 비용은 도우미와 직접 정산해요.')}
        <button type="button" role="checkbox" aria-checked="{{agreed}}" onClick="{{toggleAgree}}" style="display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; margin-top: 14px; padding: 0 12px; border: 1px solid {{agreeBorder}}; border-radius: 10px; background: #F5F7FA; font-family: inherit; font-size: 14px; font-weight: 700; color: #16181D; cursor: pointer"><span aria-hidden="true" style="{{boxStyle}}">${svg('check', 12, '#FFFFFF', 3)}</span>전체 동의 (서비스 이용약관 · 개인정보 수집·이용 · 연락처 제공 동의)</button>
        <sc-if value="{{quoteErr}}" hint-placeholder-val="{{ false }}"><p role="alert" style="margin: 12px 0 0; font-size: 13px; font-weight: 600; color: #B42318">{{quoteErrText}}</p></sc-if>
        <button type="button" onClick="{{sendQuote}}" style="${BTN}; margin-top: 14px">요청 보내기</button>
      </section>
    </sc-if>`;

const DETAIL = `<sc-if value="{{onDetail}}" hint-placeholder-val="{{ false }}">
      ${L.pageTitle('내 활동', '요청 상세')}
      <section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px">
          <small style="font-size: 12px; color: #6B7180; white-space: nowrap">요청 2026. 10. 10. 오후 2:10</small>
          ${BADGE}
        </div>
        <h2 style="margin: 12px 0 0; font-size: 22px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px">{{titleV}}</h2>
        <p style="margin: 4px 0 0; font-size: 14px; color: #4B5160">{{agentName}} 도우미 · {{siteV}}</p>
        ${NEXT}
      </section>
      <sc-if value="{{waiting}}" hint-placeholder-val="{{ false }}">
        <div class="pk-pop" style="margin-top: 16px; padding: 14px 16px; border: 1px solid #E6E9EF; border-radius: 16px; background: #FFFFFF; box-shadow: 0 6px 16px rgba(22,24,29,0.08)">
          <div style="font-size: 12px; font-weight: 700; color: #2D48D6">잠시 뒤</div>
          <div style="margin-top: 1px; font-size: 16px; font-weight: 800; letter-spacing: -0.3px">도우미가 수락하고 최종 조건을 보냈어요</div>
          <button type="button" onClick="{{skipTime}}" style="${BTN}; margin-top: 12px">다음</button>
        </div>
      </sc-if>
      <sc-if value="{{showProposed}}" hint-placeholder-val="{{ false }}">${card('도우미가 보낸 최종 조건', `${notice('1차 제안 · 이용자 확인을 기다리고 있어요.')}
  ${rows(AGREEMENT)}`)}</sc-if>
      <sc-if value="{{matched}}" hint-placeholder-val="{{ false }}">${card('확정된 최종 조건', `${notice('양측이 1차 제안에 동의해 확정됐어요.', 'success')}
  ${rows(AGREEMENT)}`)}</sc-if>
      <sc-if value="{{waiting}}" hint-placeholder-val="{{ false }}">${card('이용자가 보낸 요청', rows(REQUEST))}</sc-if>
      <sc-if value="{{waiting}}" hint-placeholder-val="{{ false }}">${contact(false)}</sc-if>
      <sc-if value="{{notWaiting}}" hint-placeholder-val="{{ true }}">${contact(true)}</sc-if>
      <sc-if value="{{matched}}" hint-placeholder-val="{{ false }}">${DIRECT_CARD}</sc-if>
      ${cardOpen('진행 상황', 16)}
        <sc-if value="{{waiting}}" hint-placeholder-val="{{ false }}">
          ${progressList(0)}
          ${notice('도우미의 응답을 기다리고 있어요.').replace('margin-top: 12px', 'margin-top: 0')}
        </sc-if>
        <sc-if value="{{showProposed}}" hint-placeholder-val="{{ false }}">
          ${progressList(2)}
          <button type="button" onClick="{{openConfirm}}" style="${BTN}">확인하고 확정하기</button>
          <button type="button" onClick="{{tryRevise}}" style="${BTN_GHOST}">수정 요청하기</button>
          <sc-if value="{{reviseNote}}" hint-placeholder-val="{{ false }}"><p role="status" style="margin: 8px 0 0; text-align: center; font-size: 13px; color: #4B5160">이번엔 확정해 볼까요?</p></sc-if>
        </sc-if>
        <sc-if value="{{matched}}" hint-placeholder-val="{{ false }}">
          ${progressList(4)}
          ${notice('직접 거래 매칭을 완료했어요. 도우미와 직접 연락해 진행하고, 예매가 끝나면 후기를 남겨 주세요.', 'success').replace('margin-top: 12px', 'margin-top: 0')}
          <button type="button" onClick="{{finish}}" style="${BTN}; margin-top: 12px">혼자 해 보기 마치기</button>
          ${CONFIRMED}
        </sc-if>
      </section>
      ${DISCLAIMER}
    </sc-if>`;

const SENT = `<sc-if value="{{onSent}}" hint-placeholder-val="{{ false }}">
    <div class="pk-pop" style="position: absolute; top: 56px; left: 0; right: 0; bottom: 0; z-index: 70; background: #F5F7FA; display: flex; flex-direction: column; padding: 0 24px 24px; box-sizing: border-box">
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center">
        <span style="display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 50%; background: #3A5BFF">${svg('check', 34, '#FFFFFF', 2.4)}</span>
        <span style="margin-top: 18px; font-size: 12px; font-weight: 700; color: #2D48D6">요청 전송 완료</span>
        <h1 style="margin: 8px 0 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px">도우미에게 마음이 도착했어요</h1>
        <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.7; color: #4B5160">수락과 최종 조건 도착 소식은 알림으로 알려드릴게요.</p>
      </div>
      <button type="button" onClick="{{toDetail}}" style="${BTN}">보낸 요청 확인</button>
      <button type="button" style="${BTN_GHOST}">내 활동으로</button>
    </div>
  </sc-if>`;

const DONE = `<sc-if value="{{onDone}}" hint-placeholder-val="{{ false }}">
    <div class="pk-pop" style="position: absolute; top: 56px; left: 0; right: 0; bottom: 0; z-index: 70; background: #FFFFFF; display: flex; flex-direction: column; padding: 0 24px 24px; box-sizing: border-box">
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center">
        ${MASCOT(80)}
        <h1 style="margin: 18px 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px">혼자서도 해냈어요</h1>
        <p style="margin: 8px 0 0; font-size: 16px; line-height: 1.5; color: #4B5160">도우미 고르기부터 매칭 완료까지 마쳤어요.</p>
      </div>
      <a href="${SIGNUP_URL}" style="${BTN}">회원가입하기</a>
      <a href="U0-role.dc.html" style="${BTN_GHOST}; color: #16181D; text-decoration: none">첫 화면으로</a>
    </div>
  </sc-if>`;

const body = `  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">
${header({ avatar: AVATAR_USER, progress: false }).replace('<header style="position: relative; height: 56px;', '<header style="position: relative; flex: 0 0 56px; height: 56px;')}
    <div style="flex: 0 0 auto; padding: 12px 20px 0">
      <div style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 14px; padding: 4px 6px 4px 12px; display: flex; align-items: center; gap: 8px">
        <span style="flex: 0 0 auto; font-size: 11px; font-weight: 800; color: #2D48D6; background: #EEF2FF; padding: 3px 8px; border-radius: 999px">혼자 해 보기 {{stageN}}/4</span>
        <span style="flex: 1; min-width: 0; font-size: 14px; font-weight: 700">{{mission}}</span>
        <button type="button" aria-expanded="{{hint}}" onClick="{{toggleHint}}" style="flex: 0 0 auto; min-height: 44px; padding: 0 10px; border: 0; background: none; font-family: inherit; font-size: 13px; font-weight: 600; color: #4B5160; cursor: pointer">힌트</button>
      </div>
      <sc-if value="{{hint}}" hint-placeholder-val="{{ false }}"><p role="status" style="margin: 6px 4px 0; font-size: 13px; color: #4B5160">{{hintText}}</p></sc-if>
    </div>
    <div ref="{{boxRef}}" style="flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px 90px">
    ${MAIN}
    ${PROFILE}
    ${QUOTE}
    ${DETAIL}
    </div>
  </div>

  <sc-if value="{{showNav}}" hint-placeholder-val="{{ true }}">
    <nav aria-label="하단 메뉴" style="position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; height: 66px; background: #FFFFFF; border-top: 1px solid #E6E9EF; display: flex">
      <button type="button" aria-current="{{curFind}}" onClick="{{toMain}}" style="{{navFind}}">${svg('search', 22, 'currentColor', 1.7)}도우미 찾기</button>
      <button type="button" aria-current="{{curActivity}}" style="{{navActivity}}">${svg('ticket', 22, 'currentColor', 1.7)}내 활동</button>
      <button type="button" style="{{navOff}}">${svg('user', 22, 'currentColor', 1.7)}마이</button>
    </nav>
  </sc-if>

  <sc-if value="{{onConfirmSheet}}" hint-placeholder-val="{{ false }}">
    ${sheet({ label: '최종 조건 확정 확인', title: '최종 조건을 확정할까요?', body: '<p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #4B5160">확정하면 직접 거래 매칭이 완료돼요. 착수·결과 등록 없이 당사자끼리 진행하고, 이용자는 후기를 남길 수 있어요.</p>', cancel: '{{closeSheet}}', confirmBtn: `<button type="button" onClick="{{confirmTerms}}" style="${BTN}; flex: 1; width: auto">확정하기</button>` })}
    </div>
  </sc-if>

  ${SENT}
  ${DONE}`;

const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      screen: 'main', hint: false, reviseNote: false, agent: '', fee: '', tab: 'about',
      title: '', open: '', site: '', seat: '', cond: '', budget: '', note: '', phone: '', agreed: false, tried: false,
    };
    this.boxRef = (el) => { this.box = el; };
  }
  renderVals() {
    const st = this.state;
    const sc = st.screen;
    const set = (p) => this.setState(p);
    // 화면이 바뀌면 맨 위부터 보여 준다. 같은 화면 안에서 단계만 바뀌면 그대로 둔다.
    const go = (screen, extra, keep) => {
      set(Object.assign({ screen: screen, hint: false, reviseNote: false }, extra || {}));
      if (!keep && this.box) this.box.scrollTop = 0;
    };
    const has = (v) => String(v || '').trim() !== '';
    const or = (v) => (has(v) ? v : '미입력');
    const num = (v) => Number(String(v || '').replace(/[^0-9]/g, '')) || 0;

    // 요청 상세 단계: W 응답 대기 → T 최종 조건 확인 대기 → M 직접 거래 매칭 완료
    const phase = { waiting: 'W', terms: 'T', confirmSheet: 'T', matched: 'M' }[sc] || '';
    const stage = { main: 1, profile: 1, quote: 2, sent: 2, waiting: 3, terms: 3, confirmSheet: 3, matched: 4, done: 4 }[sc];
    const missions = ['', '도우미를 골라 보세요', '요청서를 써서 보내 보세요', '도착한 조건을 확정해 보세요', '매칭 완료를 확인해 보세요'];
    const hints = {
      main: '‘이번 주, 주목할 도우미’에서 아무 도우미나 눌러요.',
      profile: '아래 ‘이 도우미에게 요청하기’를 눌러요.',
      quote: '빈칸에 아무 내용이나 적고, 전체 동의를 누른 뒤 ‘요청 보내기’를 눌러요.',
      sent: '‘보낸 요청 확인’을 눌러요.',
      waiting: '‘잠시 뒤’ 카드의 ‘다음’을 눌러요.',
      terms: '조건을 읽고 맨 아래 ‘확인하고 확정하기’를 눌러요.',
      confirmSheet: '‘확정하기’를 눌러요.',
      matched: '도우미 연락처를 보고 맨 아래 버튼을 눌러요.',
    };
    const fieldBase = 'display: block; width: 100%; margin-top: 6px; padding: 12px 14px; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 16px; font-weight: 400; line-height: 1.5; color: #16181D; box-sizing: border-box; resize: vertical; ';
    const field = (ok) => fieldBase + 'border: 1px solid ' + (ok ? '#D5D9E2' : '#D92D20');
    const req = (v) => !st.tried || has(v);
    const missing = !has(st.title) || !has(st.open) || !has(st.site) || !has(st.seat) || !has(st.cond) || !has(st.phone);

    const badge = { W: ['도우미 응답 대기', 'background: #FFF5DF; color: #8A5300'], T: ['최종 조건 확인 대기', 'background: #EEF2FF; color: #2D48D6'], M: ['직접 거래 매칭 완료', 'background: #F0F2F6; color: #4B5160'] }[phase] || ['', ''];
    const next = {
      W: ['도우미가 요청을 확인할 차례예요', '수락 전에는 요청 내용을 수정하거나 취소할 수 있어요.'],
      T: ['이용자가 최종 조건을 확인할 차례예요', '변경된 내용을 확인하고 확정하거나 수정을 요청해 주세요.'],
      M: ['직접 거래 매칭을 마쳤어요', '착수·결과 등록 없이 당사자끼리 진행해요. 이용자는 거래 경험과 예매 결과를 후기로 남길 수 있어요.'],
    }[phase] || ['', ''];
    const navItem = (active) => 'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border: 0; background: none; font-family: inherit; font-size: 11px; cursor: pointer; ' + (active ? 'font-weight: 700; color: #3A5BFF' : 'font-weight: 600; color: #5F6575');
    const inActivity = phase !== '';
    const tabStyle = (on) => 'min-height: 44px; padding: 0 2px; border: 0; border-bottom: 2px solid ' + (on ? '#3A5BFF' : 'transparent') + '; margin-bottom: -1px; background: none; font-family: inherit; font-size: 15px; cursor: pointer; ' + (on ? 'font-weight: 700; color: #16181D' : 'font-weight: 600; color: #4B5160');

    return {
      boxRef: this.boxRef,
      stageN: stage,
      mission: missions[stage],
      hint: st.hint,
      hintText: hints[sc] || '',
      toggleHint: () => set({ hint: !st.hint }),

      onMain: sc === 'main',
      onProfile: sc === 'profile',
      onQuote: sc === 'quote',
      onSent: sc === 'sent',
      onDetail: phase !== '',
      onConfirmSheet: sc === 'confirmSheet',
      onDone: sc === 'done',

      pickSky: () => go('profile', { agent: '하늘도우미', fee: '5,000원', tab: 'about' }),
      pickStar: () => go('profile', { agent: '${AGENT}', fee: '7,000원', tab: 'about' }),
      isSky: st.agent === '하늘도우미',
      isStar: st.agent !== '하늘도우미',
      agentName: st.agent || '${AGENT}',
      agentLetter: (st.agent || '${AGENT}').slice(0, 1),
      agentFee: st.fee || '7,000원',
      toQuote: () => go('quote'),
      about: st.tab !== 'reviews',
      reviews: st.tab === 'reviews',
      aboutStyle: tabStyle(st.tab !== 'reviews'),
      reviewsStyle: tabStyle(st.tab === 'reviews'),
      showReviews: () => set({ tab: 'reviews' }),
      showAbout: () => set({ tab: 'about' }),

      setTitle: (e) => set({ title: e.target.value }),
      setOpen: (e) => set({ open: e.target.value }),
      setSite: (e) => set({ site: e.target.value }),
      setSeat: (e) => set({ seat: e.target.value }),
      setCond: (e) => set({ cond: e.target.value }),
      setBudget: (e) => set({ budget: e.target.value }),
      setNote: (e) => set({ note: e.target.value }),
      setPhone: (e) => set({ phone: e.target.value }),
      titleStyle: field(req(st.title)),
      openStyle: field(req(st.open)),
      siteStyle: field(req(st.site)),
      seatStyle: field(req(st.seat)),
      condStyle: field(req(st.cond)),
      budgetStyle: field(true),
      noteStyle: field(true),
      phoneStyle: field(req(st.phone)),
      agreed: st.agreed,
      agreeBorder: st.tried && !st.agreed ? '#D92D20' : '#E6E9EF',
      boxStyle: 'flex: 0 0 18px; width: 18px; height: 18px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; ' + (st.agreed ? 'background: #3A5BFF; border: 0' : 'background: #FFFFFF; border: 1.5px solid #B4BAC6'),
      toggleAgree: () => set({ agreed: !st.agreed }),
      quoteErr: st.tried && (missing || !st.agreed),
      quoteErrText: missing ? '빈칸을 모두 채워 주세요.' : '약관에 동의해 주세요.',
      sendQuote: () => {
        if (missing || !st.agreed) {
          set({ tried: true });
          return;
        }
        go('sent');
      },
      toDetail: () => go('waiting'),

      titleV: or(st.title),
      openV: or(st.open),
      siteV: or(st.site),
      seatV: or(st.seat),
      condV: or(st.cond),
      budgetV: has(st.budget) ? (num(st.budget) ? num(st.budget).toLocaleString('ko-KR') + '원' : st.budget) : '미입력',
      noteV: or(st.note),

      badgeText: badge[0],
      badgeStyle: 'flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; ' + badge[1],
      nextTitle: next[0],
      nextText: next[1],
      nextBg: phase === 'M' ? '#E6F7F3' : 'linear-gradient(120deg, #F0F3FF, #F7F9FF)',
      waiting: phase === 'W',
      notWaiting: phase !== 'W',
      showProposed: phase === 'T',
      matched: phase === 'M',
      notMatched: phase !== 'M',
      skipTime: () => go('terms'),
      openConfirm: () => go('confirmSheet', null, true),
      closeSheet: () => go('terms', null, true),
      confirmTerms: () => go('matched'),
      reviseNote: st.reviseNote,
      tryRevise: () => set({ reviseNote: true }),
      finish: () => go('done'),

      showNav: sc !== 'done' && sc !== 'sent',
      curFind: inActivity ? 'false' : 'page',
      curActivity: inActivity ? 'page' : 'false',
      navFind: navItem(!inActivity),
      navActivity: navItem(inActivity),
      navOff: navItem(false),
      toMain: () => { if (sc === 'profile') go('main'); },
    };
  }
}`;
write('U6-practice.dc.html', doc('혼자 해 보기 · 이용자 · 강조 없음', body, script));
