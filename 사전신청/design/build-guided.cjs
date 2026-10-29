// 함께 해 보기 보드(M3·M5·M7·M8)를 실제 화면 구조대로 만든다. node build-guided.cjs
const L = require('./build-lib.cjs');
const { TOTAL, doc, write, svg, header, nav, navButton, halo, bubble, pageTitle, cardOpen, card, rows, notice, statusBadge, nextStep, detailHeader, progressList, DISCLAIMER, CONFIRMED, BTN, BTN_GHOST, sheet, ACCEPT_BODY, DIRECT_CARD, REFUND_HELPER, TERMS_NOTICE, contactCard } = L;

const TITLE = '레드 하트 앙코르 콘서트';
const DATE = '요청 2026. 10. 10. 오후 2:10';
const SUB = '김이용 이용자 · NOL 티켓';
const REQUEST = [
  ['공연명', TITLE], ['분야', '콘서트'], ['공연 일시', '2026-12-26 19:00'], ['티켓 오픈', '2026-11-20 20:00 · 일반 예매'], ['예매처', 'NOL 티켓'],
  ['공연장·위치', '올림픽공원 KSPO DOME'], ['매수', '2매'], ['희망 좌석·요청 내용', '1층 R석 2매, 통로 쪽이면 좋아요'], ['성공 요건', 'R석 이상 2매 연석'],
  ['희망 수고비', '25,000원'], ['최대 수고비', '30,000원'], ['기타 사항', '오픈 직후 연락 가능해요'], ['도우미 응답 기한', '2026. 10. 12. 오후 2:10'],
];
const TERMS = {
  requirements: '1층 R석 2매, 통로 쪽이면 좋아요', success: 'R석 이상 2매 연석',
  refund: '- 시도했지만 예매 실패: 착수비는 도우미 몫, 수고비는 받지 않음\n- 도우미 사정으로 취소: 받은 금액 전액 돌려줌\n- 공연·예매 공식 취소: 받은 금액 전액 돌려줌',
  note: '오픈 직후 연락 가능해요', deadline: '예매 종료 후 30분 이내',
};
// 최종 조건 항목(transactions/requestRows.tsx agreementRows). 직접 거래의 예매 시도 방식은 앱이 고정 문구로 채운다.
const AGREEMENT = [
  ['착수비', '10,000원'], ['수고비(성공보수)', '30,000원'], ['거래 방식', '직접 거래(수수료 없음)'], ['희망 좌석·요청 내용', TERMS.requirements],
  ['성공 요건', TERMS.success], ['예매 시도 방식', '직접 거래: 착수 증빙을 플랫폼에 제출하지 않음'], ['실패·환불 처리', TERMS.refund], ['결과 연락 기한', TERMS.deadline],
  ['기타 사항', TERMS.note], ['수정 사유', '미입력'],
];
const HELPER_NAV = ['leads', 'matches', 'my'];
// 스크롤해서 목표(ref)가 보이면 다음 단계로 넘어가는 공통 로직
const scrollLogic = (from, to) => `
    this.boxRef = (el) => { this.box = el; };
    this.targetRef = (el) => { this.target = el; };
    this.onScroll = () => {
      const b = this.box;
      const t = this.target;
      if (this.state.step !== '${from}' || !b || !t) return;
      if (t.offsetTop + t.offsetHeight <= b.scrollTop + b.clientHeight - 8) this.setState({ step: '${to}' });
    };`;

// ── M5 요청 상세: 요청서 확인 → 수락 ─────────────────────────────
{
  const body = `${header()}
${L.scroller(`    <sc-if value="{{pending}}" hint-placeholder-val="{{ true }}">
      ${pageTitle('받은 요청', '요청 상세')}
      ${detailHeader({ date: DATE, badge: statusBadge('도우미 응답 대기', 'amber'), title: TITLE, sub: SUB, next: nextStep('도우미가 요청을 확인할 차례예요', '요청을 확인하고 수락하거나 거절해 주세요.') })}
    </sc-if>
    <sc-if value="{{accepted}}" hint-placeholder-val="{{ false }}">
      ${pageTitle('매칭 관리', '요청 상세')}
      ${detailHeader({ date: DATE, badge: statusBadge('최종 조건 작성 필요'), title: TITLE, sub: SUB, next: nextStep('도우미가 첫 최종 조건을 작성할 차례예요', '비용과 진행 조건을 정해 첫 제안을 보내 주세요.') })}
    </sc-if>
    <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">
      <div style="margin-top: 16px">${bubble({ title: '요청서를 확인해요', sub: '다 읽고 아래로 내려요', justify: 'flex-start', arrow: 'down', at: { left: 30 } })}</div>
    </sc-if>
    <div style="position: relative; margin-top: 16px; border-radius: 16px">
      ${card('이용자가 보낸 요청', rows(REQUEST), 0)}
      <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">${halo(20)}</sc-if>
    </div>
    <sc-if value="{{pending}}" hint-placeholder-val="{{ true }}">${contactCard(false)}</sc-if>
    <sc-if value="{{accepted}}" hint-placeholder-val="{{ false }}">${contactCard(true)}</sc-if>
    ${L.cardOpen('진행 상황', 16)}
      <sc-if value="{{pending}}" hint-placeholder-val="{{ true }}">
        ${progressList(0)}
        <div ref="{{targetRef}}" style="position: relative; border-radius: 10px">
          <button type="button" onClick="{{accept}}" style="${BTN}">요청 수락하기</button>
          <sc-if value="{{accStep}}" hint-placeholder-val="{{ false }}">${halo(14)}</sc-if>
        </div>
        <sc-if value="{{accStep}}" hint-placeholder-val="{{ false }}">${bubble({ title: '요청을 수락해요' })}</sc-if>
        <button type="button" style="${BTN_GHOST}">요청 거절</button>
      </sc-if>
      <sc-if value="{{accepted}}" hint-placeholder-val="{{ false }}">
        ${progressList(1)}
        <div style="position: relative; border-radius: 10px">
          <a href="M7-terms.dc.html" style="${BTN}">최종 조건 작성하기</a>
          ${halo(14)}
        </div>
        ${bubble({ title: '조건을 작성해요', sub: '좌석·비용을 정해 보내요' })}
      </sc-if>
    </section>
    ${DISCLAIMER}`)}

${nav(HELPER_NAV, 'leads')}

  <sc-if value="{{sheet}}" hint-placeholder-val="{{ false }}">
    ${sheet({ label: '요청 수락 확인', title: '요청을 수락할까요?', body: ACCEPT_BODY(TITLE), cancel: '{{cancelSheet}}', confirmBtn: `<div style="position: relative; flex: 1; border-radius: 10px"><button type="button" onClick="{{confirm}}" style="${BTN}">수락하기</button>${halo(14)}</div>` })}
      ${bubble({ title: '한 번 더 눌러요', sub: '매칭권 1장이 쓰여요', justify: 'flex-end', at: { right: 128 } })}
    </div>
  </sc-if>`;
  const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { step: 'read' };${scrollLogic('read', 'accept')}
  }
  renderVals() {
    const s = this.state.step;
    const set = (p) => this.setState(p);
    const n = s === 'sheet' ? 7 : s === 'accepted' ? 8 : 6;
    return {
      progN: n,
      progW: n / ${TOTAL} * 100 + '%',
      boxRef: this.boxRef,
      targetRef: this.targetRef,
      onScroll: this.onScroll,
      read: s === 'read',
      accStep: s === 'accept',
      sheet: s === 'sheet',
      pending: s !== 'accepted',
      accepted: s === 'accepted',
      accept: () => set({ step: 'sheet' }),
      confirm: () => set({ step: 'accepted' }),
      cancelSheet: () => set({ step: 'accept' }),
    };
  }
}`;
  write('M5-detail.dc.html', doc('요청 상세 · 함께 해 보기', body, script));
}

// ── M7 최종 조건 작성(직접 거래) ─────────────────────────────────
const label = (text, required, helper) => `<div style="margin-top: 16px; font-size: 13px; font-weight: 700">${text}${required ? ' <em style="font-style: normal; font-size: 10px; color: #B42318">*</em>' : ''}</div>${helper ? `<div style="margin-top: 2px; font-size: 12px; line-height: 1.6; color: #6B7180">${helper}</div>` : ''}`;
const box = (text, tall) => `<div style="margin-top: 6px; ${tall ? 'min-height: 76px; ' : ''}padding: 12px 14px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-size: 14px; line-height: 1.5; white-space: pre-line; box-sizing: border-box">${text}</div>`;
const money = (text) => `<div style="position: relative; margin-top: 6px; padding: 12px 36px 12px 14px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-size: 14px; box-sizing: border-box">${text}<span aria-hidden="true" style="position: absolute; right: 14px; top: 12px; color: #4B5160">원</span></div>`;
const sumRow = (k, v) => `<div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4B5160"><span>${k}</span><strong style="color: #16181D">${v}</strong></div>`;
{
  const body = `${header()}
${L.scroller(`    ${pageTitle('요청 상세', '최종 조건 작성')}
    <p role="status" style="margin: -6px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">작성 내용은 이 탭에 자동으로 임시저장돼요. 요청 상세를 확인하고 돌아와도 이어 쓸 수 있어요.</p>
    <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">
      <div style="margin-top: 16px">${bubble({ title: '조건을 확인해요', sub: '요청서 내용이 미리 들어 있어요', justify: 'flex-start', arrow: 'down', at: { left: 30 } })}</div>
    </sc-if>
    ${card('진행 조건', `<p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">최초 요청이나 최근 합의안을 바탕으로 조건을 조정해 서로에게 제안할 수 있어요.</p>
  ${label('희망 좌석·요청 내용', true)}${box(TERMS.requirements, true)}
  ${label('성공 요건', true)}${box(TERMS.success, true)}
  ${notice(TERMS_NOTICE)}`)}
    ${L.cardOpen('비용과 결과 안내', 16)}
    ${label('착수비', true, '예매 시도에 대한 비용이에요.')}${money('10,000')}
    ${label('수고비(성공보수)', true, '성공 요건을 충족했을 때 받는 비용이에요.')}${money('30,000')}
    <div style="margin-top: 12px">${sumRow('착수비', '10,000원')}${sumRow('수고비', '30,000원')}</div>
    <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 8px; padding-top: 12px; border-top: 1px solid #E6E9EF"><span style="font-size: 14px; color: #4B5160">정산 방식</span><strong style="font-size: 16px; font-weight: 800">당사자끼리 직접 정산</strong></div>
    ${label('실패·환불 처리', true, REFUND_HELPER)}${box(TERMS.refund, true)}
    ${label('기타 사항', false, '꼭 알려야 할 내용이 있으면 적어 주세요.')}${box(TERMS.note, true)}
    ${label('결과 연락 기한', true)}${box(TERMS.deadline)}
    <p role="status" style="margin: 18px 0 10px; font-size: 13px; line-height: 1.6; color: #4B5160">이용자가 확인하고 확정하면 매칭이 완료돼요. 이후 착수·결과 등록은 필요 없어요.</p>
    <sc-if value="{{editing}}" hint-placeholder-val="{{ true }}">
      <div ref="{{targetRef}}" style="position: relative; border-radius: 10px">
        <button type="button" onClick="{{send}}" style="${BTN}">최종 조건 작성하기</button>
        <sc-if value="{{sendStep}}" hint-placeholder-val="{{ false }}">${halo(14)}</sc-if>
      </div>
      <sc-if value="{{sendStep}}" hint-placeholder-val="{{ false }}">${bubble({ title: '확인하고 보내요', sub: '이용자가 확정하면 매칭 완료' })}</sc-if>
    </sc-if>
    <sc-if value="{{sent}}" hint-placeholder-val="{{ false }}">
      <div role="status" class="pk-pop" style="padding: 14px 16px; border: 1px solid #E6E9EF; border-radius: 16px; background: #FFFFFF; box-shadow: 0 6px 16px rgba(22,24,29,0.08)">
        <div style="display: flex; align-items: center; gap: 10px">${L.MASCOT(32)}<div><div style="font-size: 12px; font-weight: 700; color: #2D48D6">잠시 뒤</div><div style="margin-top: 1px; font-size: 16px; font-weight: 800; letter-spacing: -0.3px">이용자가 조건을 확정했어요</div></div></div>
        <a href="M8-matched.dc.html" style="${BTN}; margin-top: 12px">다음</a>
      </div>
    </sc-if>
    </section>
    ${card('이용자의 최초 요청', rows([['공연명', TITLE], ['티켓 오픈', '2026-11-20 20:00'], ['예매처', 'NOL 티켓'], ['희망 좌석·요청 내용', TERMS.requirements], ['성공 요건', TERMS.success], ['희망 수고비', '25,000원'], ['최대 수고비', '30,000원'], ['기타 사항', TERMS.note]]))}`)}

${nav(HELPER_NAV, 'leads')}`;
  const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { step: 'read' };${scrollLogic('read', 'send')}
  }
  renderVals() {
    const s = this.state.step;
    return {
      progN: 9,
      progW: 9 / ${TOTAL} * 100 + '%',
      boxRef: this.boxRef,
      targetRef: this.targetRef,
      onScroll: this.onScroll,
      read: s === 'read',
      sendStep: s === 'send',
      editing: s !== 'sent',
      sent: s === 'sent',
      send: () => this.setState({ step: 'sent' }),
    };
  }
}`;
  write('M7-terms.dc.html', doc('최종 조건 작성 · 함께 해 보기', body, script));
}

// ── M8 요청 상세: 직접 거래 매칭 완료 ────────────────────────────
{
  const body = `${header()}
${L.scroller(`    ${pageTitle('매칭 관리', '요청 상세')}
    ${detailHeader({ date: DATE, badge: statusBadge('직접 거래 매칭 완료', 'muted'), title: TITLE, sub: SUB, next: nextStep('직접 거래 매칭을 마쳤어요', '착수·결과 등록 없이 이용자와 직접 진행해 주세요.', '', true) })}
    <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">
      <div style="margin-top: 16px">${bubble({ title: '매칭이 완료됐어요', sub: '확정된 조건과 연락처를 확인해요', justify: 'flex-start', arrow: 'down', at: { left: 30 } })}</div>
    </sc-if>
    <div style="position: relative; margin-top: 16px; border-radius: 16px">
      ${card('확정된 최종 조건', `${notice('양측이 1차 제안에 동의해 확정됐어요. (2026. 10. 10. 오후 3:20)', 'success')}
  ${rows(AGREEMENT)}`, 0)}
      <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">${halo(20)}</sc-if>
    </div>
    ${card('이용자가 보낸 요청', rows(REQUEST))}
    ${contactCard(true)}
    ${DIRECT_CARD}
    ${L.cardOpen('진행 상황', 16)}
      ${progressList(4)}
      ${notice('직접 거래 매칭을 완료했어요. 착수·결과 등록 없이 당사자끼리 진행해 주세요.', 'success').replace('margin-top: 12px', 'margin-top: 0')}
      <div ref="{{targetRef}}">${CONFIRMED}</div>
      <sc-if value="{{done}}" hint-placeholder-val="{{ false }}">
        <div role="status" class="pk-pop" style="margin-top: 16px; padding: 14px 16px; border: 1px solid #E6E9EF; border-radius: 16px; background: #FFFFFF; box-shadow: 0 6px 16px rgba(22,24,29,0.08)">
          <div style="display: flex; align-items: center; gap: 10px">${L.MASCOT(32)}<div><div style="font-size: 18px; font-weight: 800; letter-spacing: -0.3px">잘했어요!</div><div style="margin-top: 1px; font-size: 14px; color: #4B5160">이제 이용자와 연락해 예매를 진행해요</div></div></div>
          <a href="M10-cases.dc.html" style="${BTN}; margin-top: 12px">다음</a>
        </div>
      </sc-if>
    </section>
    ${DISCLAIMER}`)}

${nav(HELPER_NAV, 'matches')}`;
  const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { step: 'read' };
    this.boxRef = (el) => { this.box = el; };
    this.targetRef = (el) => { this.target = el; };
    // 끝까지 내리면 마침 카드를 띄우고, 카드가 하단 메뉴에 가리지 않게 맨 아래로 내린다.
    this.onScroll = () => {
      const b = this.box;
      const t = this.target;
      if (this.state.step !== 'read' || !b || !t) return;
      if (t.offsetTop + t.offsetHeight <= b.scrollTop + b.clientHeight - 8) {
        this.setState({ step: 'done' });
        setTimeout(() => { if (this.box) this.box.scrollTo({ top: this.box.scrollHeight, behavior: 'smooth' }); }, 30);
      }
    };
  }
  renderVals() {
    const s = this.state.step;
    const n = s === 'done' ? 11 : 10;
    return {
      progN: n,
      progW: n / ${TOTAL} * 100 + '%',
      boxRef: this.boxRef,
      targetRef: this.targetRef,
      onScroll: this.onScroll,
      read: s === 'read',
      done: s === 'done',
    };
  }
}`;
  write('M8-matched.dc.html', doc('직접 거래 매칭 완료 · 함께 해 보기', body, script));
}

// ── M3 마이페이지: 역할 바꾸기 ───────────────────────────────────
// 안전거래를 제공하지 않는 동안 이용자 거래 내역 메뉴는 숨겨져 있다(MyPage).
const MENU_USER = [['이용자 프로필', '닉네임 · 연락처 · 계정 인증 · 아이디·비밀번호']];
const MENU_HELPER = [['도우미 프로필', '닉네임 · 연락처 · 계정 인증 · 아이디·비밀번호'], ['공개 프로필', '도우미 소개와 활동 정보 · 공개 설정'], ['거래 내역', '매칭권 충전 · 사용']];
const MENU_REST = [['좋아요한 도우미', '저장한 도우미 보기'], ['신고 내역', '접수한 신고와 처리 결과'], ['이용 방법', '서비스 이용 안내'], ['문의 작성', '궁금한 내용 문의하기'], ['문의 현황', '작성한 문의와 답변 확인'], ['이용약관', '서비스 이용 기준'], ['개인정보 안내', '정보 처리 안내']];
const menu = (items) => `<div style="margin-top: 12px">${items.map(([t, d], i) => `
      <button type="button" style="display: block; width: 100%; padding: 19px 0; border: 0; ${i < items.length - 1 ? 'border-bottom: 1px solid #EEF1F5; ' : ''}background: none; font-family: inherit; text-align: left; color: #16181D"><strong style="display: block; font-size: 14px; font-weight: 600">${t}</strong><small style="display: block; margin-top: 4px; font-size: 12px; color: #6B7180">${d}</small></button>`).join('')}
    </div>`;
{
  const body = `${header({ avatar: '{{avatarStyle}}' })}
${L.scroller(`    ${pageTitle('', '마이페이지')}
    <section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px 22px">
        <span style="flex: 0 0 56px; height: 56px; border-radius: 50%; background: #EEF2FF; color: #2D48D6; font-size: 20px; font-weight: 800; display: flex; align-items: center; justify-content: center">체</span>
        <div style="flex: 1 1 160px; min-width: 0">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800">체험 계정</h2>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 6px">
            <span style="font-size: 13px; color: #6B7180">trial@example.com</span>
            <div style="display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: #F5F7FA">
              <button type="button" aria-pressed="{{isUser}}" style="{{userBtn}}">이용자</button>
              <div style="position: relative; border-radius: 8px">
                <button type="button" aria-pressed="{{helper}}" onClick="{{toHelper}}" style="{{helperBtn}}">도우미</button>
                <sc-if value="{{s2}}" hint-placeholder-val="{{ true }}">${halo(12)}</sc-if>
              </div>
            </div>
          </div>
          <sc-if value="{{s2}}" hint-placeholder-val="{{ true }}">${bubble({ title: '도우미로 바꿔요', justify: 'flex-start', at: { left: 102 } })}</sc-if>
        </div>
        <button type="button" style="margin-left: auto; min-height: 40px; padding: 0 14px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 12px; font-weight: 600; color: #4B5160">로그아웃</button>
      </div>
      <sc-if value="{{isUser}}" hint-placeholder-val="{{ true }}">${menu(MENU_USER.concat(MENU_REST))}</sc-if>
      <sc-if value="{{helper}}" hint-placeholder-val="{{ false }}">${menu(MENU_HELPER.concat(MENU_REST))}</sc-if>
    </section>
    <sc-if value="{{isUser}}" hint-placeholder-val="{{ true }}">
      ${card('나의 티켓팅', `<div style="display: flex; align-items: baseline; gap: 10px; margin-top: 12px"><strong style="font-size: 28px; font-weight: 800">0</strong><span style="font-size: 14px; color: #4B5160">개의 요청과 거래</span></div>
  <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #4B5160">보낸 요청부터 완료된 예매까지<br>내 활동에서 확인하세요.</p>
  <button type="button" style="${BTN}; margin-top: 14px">내 활동 보기</button>`)}
    </sc-if>
    <sc-if value="{{helper}}" hint-placeholder-val="{{ false }}">
      ${card('나의 매칭권', `<div style="margin-top: 12px; font-size: 28px; font-weight: 800">10<small style="margin-left: 2px; font-size: 14px; font-weight: 600">장</small></div>
  <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #4B5160">요청을 수락할 때 1장씩 사용해요.</p>
  <button type="button" style="${BTN}; margin-top: 14px">매칭권 충전</button>
  <button type="button" style="${BTN_GHOST}">충전 내역 보기</button>`)}
    </sc-if>
    ${card('연락처 공개 안내', '<p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #4B5160">선택한 연락처는 요청 수락 후 해당 상대방에게만 공개돼요. 공개 프로필에는 포함되지 않아요.</p>')}`, '{{boxBottom}}')}

  <nav aria-label="하단 메뉴" style="position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; height: 66px; background: #FFFFFF; border-top: 1px solid #E6E9EF; display: flex">
    <sc-if value="{{isUser}}" hint-placeholder-val="{{ true }}">
      ${navButton('find', false)}
      ${navButton('activity', false)}
    </sc-if>
    <sc-if value="{{helper}}" hint-placeholder-val="{{ false }}">
      <div style="position: relative; flex: 1">
        <a href="M4-leads.dc.html" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; font-weight: 600; color: #5F6575; text-decoration: none">${svg('inbox', 22, 'currentColor', 1.7)}받은 요청</a>
        <span aria-hidden="true" class="pk-halo" style="position: absolute; inset: 4px 14px; border: 2px solid #3A5BFF; border-radius: 14px; pointer-events: none"></span>
        <span aria-hidden="true" style="position: absolute; top: 2px; right: 30px; width: 12px; height: 12px; pointer-events: none"><span class="pk-ring" style="position: absolute; inset: 0; border-radius: 50%; background: #3A5BFF"></span><span style="position: absolute; inset: 0; border-radius: 50%; background: #3A5BFF; box-shadow: 0 0 0 3px #FFFFFF"></span></span>
      </div>
      ${navButton('matches', false)}
    </sc-if>
    ${navButton('my', true)}
  </nav>

  <sc-if value="{{helper}}" hint-placeholder-val="{{ false }}">
    <div style="position: absolute; left: 12px; bottom: 76px">${bubble({ title: '받은 요청을 눌러요', sub: '새 요청이 여기로 와요', justify: 'flex-start', arrow: 'down', at: { left: 48 }, gap: 0 })}</div>
  </sc-if>`;
  const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { helper: false };
    this.boxRef = (el) => { this.box = el; };
    this.onScroll = () => {};
  }
  renderVals() {
    const helper = this.state.helper;
    const seg = (on) => 'min-height: 34px; width: 66px; border: 0; border-radius: 8px; font-family: inherit; font-size: 12px; cursor: pointer; ' + (on ? 'background: #3A5BFF; font-weight: 700; color: #FFFFFF' : 'background: transparent; font-weight: 600; color: #4B5160');
    return {
      progN: helper ? 3 : 2,
      progW: (helper ? 3 : 2) / ${TOTAL} * 100 + '%',
      boxRef: this.boxRef,
      onScroll: this.onScroll,
      boxBottom: helper ? '132px' : '66px',
      avatarStyle: 'width: 34px; height: 34px; border-radius: 50%; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; ' + (helper ? 'background: #E6F7F3; color: #0B7A67' : 'background: #EEF2FF; color: #2D48D6'),
      s2: !helper,
      isUser: !helper,
      helper: helper,
      userBtn: seg(!helper),
      helperBtn: seg(helper),
      toHelper: () => this.setState({ helper: true }),
    };
  }
}`;
  write('M3-my.dc.html', doc('마이 · 도우미로 바꾸기', body, script));
}
console.log('built M3 M5 M7 M8');
