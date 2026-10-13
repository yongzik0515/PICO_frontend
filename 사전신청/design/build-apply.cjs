// 도우미 신청 화면(신청 전 상태)에 사전 신청 혜택과 회원가입 버튼을 둔 보드(M11). node build-apply.cjs
const L = require('./build-lib.cjs');
const { doc, write, svg, header, AVATAR_USER, nav, pageTitle, card, notice, BTN, MASCOT } = L;

const benefit = (icon, title, desc) => `<li style="display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.12)">
          <span aria-hidden="true" style="flex: 0 0 36px; height: 36px; border-radius: 10px; background: #FFFFFF; display: flex; align-items: center; justify-content: center">${svg(icon, 20, '#2D48D6', 2)}</span>
          <span><strong style="display: block; font-size: 15px">${title}</strong><span style="display: block; margin-top: 3px; font-size: 13px; line-height: 1.5; color: #E3E8FF">${desc}</span></span>
        </li>`;
const step = (n, title, desc, last) => `<li style="position: relative; display: flex; gap: 12px; padding-bottom: ${last ? 0 : 16}px">${last ? '' : '<span aria-hidden="true" style="position: absolute; left: 13px; top: 30px; bottom: 0; border-left: 1px solid #E6E9EF"></span>'}
          <b style="flex: 0 0 27px; height: 27px; border-radius: 50%; background: ${n === 1 ? '#3A5BFF' : '#F0F2F6'}; color: ${n === 1 ? '#FFFFFF' : '#4B5160'}; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700">${n}</b>
          <span><strong style="display: block; font-size: 14px">${title}</strong><span style="display: block; margin-top: 2px; font-size: 12px; line-height: 1.5; color: #6B7180">${desc}</span></span>
        </li>`;
const cta = (light) => `<sc-if value="{{ready}}" hint-placeholder-val="{{ true }}">
        <button type="button" onClick="{{apply}}" style="${BTN}; margin-top: 16px${light ? '; background: #FFFFFF; color: #2D48D6' : ''}">사전 신청하고 회원가입하기</button>
      </sc-if>
      <sc-if value="{{applied}}" hint-placeholder-val="{{ false }}">
        <p role="status" class="pk-pop" style="margin: 16px 0 0; padding: 14px 16px; border-radius: 12px; background: ${light ? 'rgba(255,255,255,0.16)' : '#EEF2FF'}; font-size: 14px; line-height: 1.5; color: ${light ? '#FFFFFF' : '#2D48D6'}"><strong style="display: block">회원가입 화면으로 넘어가요</strong><span style="display: block; margin-top: 2px; font-size: 12px; ${light ? 'color: #E3E8FF' : 'color: #4B5160'}">실제 사이트에서는 여기서 회원가입(/signup)으로 이동해요.</span></p>
      </sc-if>`;

const body = `${header({ avatar: AVATAR_USER, progress: false })}
  <div style="position: absolute; top: 56px; left: 0; right: 0; bottom: 66px; overflow-y: auto; padding: 16px 20px 24px; box-sizing: border-box">
    ${pageTitle('', '도우미 신청')}
    <section style="padding: 22px 18px; border-radius: 16px; background: linear-gradient(135deg, #3A5BFF, #2D48D6); color: #FFFFFF">
      <div style="display: flex; align-items: center; gap: 12px">
        ${MASCOT(44)}
        <div>
          <span style="display: inline-block; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 11px; font-weight: 700">오픈 전 사전 신청</span>
          <h2 style="margin: 6px 0 0; font-size: 20px; line-height: 1.35; font-weight: 800; letter-spacing: -0.4px">지금 신청하면 이런 혜택이 있어요</h2>
        </div>
      </div>
      <ul style="list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px">
        ${benefit('ticket', '매칭권 OO장 무료', '오픈하면 바로 요청을 수락할 수 있게 넣어 드려요.')}
        ${benefit('check', '심사 먼저 진행', '오픈 전에 공개 프로필과 인증 자료를 먼저 확인해요.')}
        ${benefit('search', '도우미 목록 상단 노출', '오픈 후 OO일 동안 이용자에게 먼저 보여요.')}
      </ul>
      ${cta(true)}
    </section>

    <section style="margin-top: 16px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 22px 16px; text-align: center">
      <span aria-hidden="true" style="display: inline-flex; width: 56px; height: 56px; border-radius: 50%; background: #EEF2FF; align-items: center; justify-content: center">${svg('info', 30, '#3A5BFF', 1.8)}</span>
      <div style="margin-top: 10px"><span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: #F0F2F6; font-size: 12px; font-weight: 600; color: #4B5160">신청 전</span></div>
      <h2 style="margin: 10px 0 0; font-size: 19px; font-weight: 800">아직 도우미 신청 전이에요</h2>
      <p style="margin: 6px 0 0; font-size: 13px; line-height: 1.6; color: #4B5160">공개 프로필과 인증·경력 자료를 준비해 신청해 주세요. 단계마다 저장돼서 나눠서 작성해도 돼요.</p>
    </section>

    ${card('가입 후 이렇게 진행돼요', `<ol style="list-style: none; margin: 16px 0 0; padding: 0">
        ${step(1, '회원가입', '사전 신청을 누르면 바로 시작해요.')}
        ${step(2, '공개 프로필', '이용자가 보게 될 소개를 만들어요.')}
        ${step(3, '인증과 경력', '본인인증·연락 방법·정산 계좌와 경력 자료를 확인해요.')}
        ${step(4, '미리보기·제출', '공개 프로필을 확인하고 심사를 신청해요.', true)}
      </ol>
      ${notice('요청 수락 시 매칭권 1장을 사용해요. 이용자의 안전거래 결제와는 별개입니다. 예매처의 이용 기준을 준수하고, 계정정보 수집·매크로·재판매·티켓 양도를 요구하거나 제공할 수 없어요.')}
      ${cta(false)}`)}
  </div>

${nav(['find', 'activity', 'my'], 'my')}`;

const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { applied: false };
  }
  renderVals() {
    return {
      ready: !this.state.applied,
      applied: this.state.applied,
      apply: () => this.setState({ applied: true }),
    };
  }
}`;
write('M11-apply.dc.html', doc('도우미 신청 · 사전 신청', body, script));
console.log('built M11');
