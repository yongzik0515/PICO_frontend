// 처음 화면(이용자·도우미 고르기 U0)과 이용자 함께 해 보기 보드(U1~U5)를 실제 화면 구조대로 만든다. node build-user.cjs
const L = require('./build-lib.cjs');
const { doc, write, svg, header, AVATAR_USER, nav, halo, bubble, cardOpen, card, rows, notice, statusBadge, nextStep, detailHeader, progressList, DISCLAIMER, CONFIRMED, BTN, BTN_GHOST, sheet, DIRECT_CARD, MASCOT } = L;

const TOTAL = 13; // 이용자 함께 해 보기 단계 수
const SIGNUP_URL = 'https://pico-kr.app/login';
const USER_NAV = ['find', 'activity', 'my'];
const userHeader = (progress = true) => header({ avatar: AVATAR_USER, progress, total: TOTAL });
const prog = (n) => `progN: ${n},\n      progW: ${n} / ${TOTAL} * 100 + '%',`;

const AGENT = '하늘도우미';
const TITLE = '레드 하트 앙코르 콘서트';
const DATE = '요청 2026. 10. 10. 오후 2:10';
const SUB = `${AGENT} 도우미 · NOL 티켓`;
const REQUEST = [
  ['공연명', TITLE], ['분야', '콘서트'], ['공연 일시', '2026-12-26 19:00'], ['티켓 오픈', '2026-11-20 20:00 · 일반 예매'], ['예매처', 'NOL 티켓'],
  ['희망 좌석·요청 내용', '1층 R석 2매, 통로 쪽이면 좋아요'], ['성공 요건', 'R석 이상 2매 연석'], ['희망 수고비', '25,000원'],
  ['기타 사항', '오픈 직후 연락 가능해요'], ['도우미 응답 기한', '2026. 10. 12. 오후 2:10'],
];
// 도우미가 보낸 최종 조건(agreementRows). 직접 거래의 예매 시도 방식은 앱이 고정 문구로 채운다.
const AGREEMENT = [
  ['착수비', '10,000원'], ['수고비(성공보수)', '30,000원'], ['거래 방식', '직접 거래(수수료 없음)'], ['희망 좌석·요청 내용', '1층 R석 2매, 통로 쪽이면 좋아요'],
  ['성공 요건', 'R석 이상 2매 연석'], ['예매 시도 방식', '직접 거래: 착수 증빙을 플랫폼에 제출하지 않음'],
  ['실패·환불 처리', '- 시도했지만 예매 실패: 착수비는 도우미 몫, 수고비는 받지 않음\n- 도우미 사정으로 취소: 받은 금액 전액 돌려줌\n- 공연·예매 공식 취소: 받은 금액 전액 돌려줌'],
  ['결과 연락 기한', '예매 종료 후 30분 이내'], ['기타 사항', '오픈 직후 연락 가능해요'], ['수정 사유', '미입력'],
];
// 이용자 쪽 연락방법 카드: 수락 전에는 안내, 수락 후에는 도우미 연락처
const contact = (show) => card('연락방법', show
  ? `${rows([['전화번호', '010-9876-5432'], ['카카오톡', 'sky_helper']])}
  <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">매칭한 도우미에게만 공개되는 정보예요. 예매처 계정정보는 공유하지 마세요.</p>`
  : notice('도우미가 요청을 수락하면 서로의 연락처가 공개돼요.'));
const scrollLogic = (from, to) => `
    this.boxRef = (el) => { this.box = el; };
    this.targetRef = (el) => { this.target = el; };
    this.onScroll = () => {
      const b = this.box;
      const t = this.target;
      if (this.state.step !== '${from}' || !b || !t) return;
      if (t.offsetTop + t.offsetHeight <= b.scrollTop + b.clientHeight - 8) this.setState({ step: '${to}' });
    };`;
const crumbTitle = (crumb, current, title) => `<nav aria-label="현재 위치" style="margin-bottom: 8px; font-size: 13px; color: #6B7180">${crumb} <span aria-hidden="true">›</span> <span aria-current="page">${current}</span></nav>
<h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px">${title}</h1>`;
const popCard = (title, sub, button) => `<div role="status" class="pk-pop" style="margin-top: 16px; padding: 14px 16px; border: 1px solid #E6E9EF; border-radius: 16px; background: #FFFFFF; box-shadow: 0 6px 16px rgba(22,24,29,0.08)">
        <div style="display: flex; align-items: center; gap: 10px">${MASCOT(32)}<div>${sub ? `<div style="font-size: 12px; font-weight: 700; color: #2D48D6">${sub}</div>` : ''}<div style="margin-top: 1px; font-size: 16px; font-weight: 800; letter-spacing: -0.3px">${title}</div></div></div>
        ${button}
      </div>`;
const AGENT_AVATAR = (size, radius, font) => `<span style="flex: 0 0 ${size}px; height: ${size}px; border-radius: ${radius}px; background: #E6F7F3; color: #0B7A67; font-size: ${font}px; font-weight: 800; display: flex; align-items: center; justify-content: center">하</span>`;
const BADGES = '<span style="font-size: 11px; font-weight: 700; color: #0B7A67; background: #E6F7F3; padding: 3px 8px; border-radius: 999px">본인인증</span><span style="font-size: 11px; font-weight: 700; color: #0B7A67; background: #E6F7F3; padding: 3px 8px; border-radius: 999px">계좌인증</span>';

// ── U0 처음 화면: 이용자·도우미 고르기 ─────────────────────────────
{
  const choice = (href, icon, title, sub) => `<a href="${href}" style="display: flex; align-items: center; gap: 14px; margin-top: 12px; padding: 20px 16px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; color: #16181D; text-decoration: none">
      <span aria-hidden="true" style="flex: 0 0 48px; height: 48px; border-radius: 14px; background: #EEF2FF; display: flex; align-items: center; justify-content: center">${svg(icon, 24, '#3A5BFF')}</span>
      <span style="flex: 1; min-width: 0"><strong style="display: block; font-size: 17px; font-weight: 800">${title}</strong><small style="display: block; margin-top: 4px; font-size: 13px; line-height: 1.5; color: #4B5160">${sub}</small></span>
      ${svg('chevron', 20, '#8A90A0', 2)}
    </a>`;
  const body = `${userHeader(false)}
  <div style="position: absolute; top: 56px; left: 0; right: 0; bottom: 0; overflow-y: auto; padding: 40px 20px 24px; box-sizing: border-box">
    <div style="text-align: center">
      <span class="pk-bob" style="display: inline-flex">${MASCOT(72)}</span>
      <h1 style="margin: 16px 0 0; font-size: 24px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px">PICO를 미리 써 보세요</h1>
      <p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #4B5160">실제 화면에서 표시된 곳을 눌러 보며 익혀요.<br>입력한 내용은 저장되지 않아요.</p>
    </div>
    <h2 style="margin: 32px 0 0; font-size: 14px; font-weight: 700; color: #4B5160">어떤 쪽으로 체험할까요?</h2>
    ${choice('U1-main.dc.html', 'search', '이용자로 체험하기', '티켓팅을 도와줄 도우미를 찾고 요청을 보내요')}
    ${choice('M2-welcome-character.dc.html', 'inbox', '도우미로 체험하기', '요청을 받아 수락하고 최종 조건을 보내요')}
  </div>`;
  const script = `
class Component extends DCLogic {
  renderVals() {
    return {};
  }
}`;
  write('U0-role.dc.html', doc('처음 화면 · 이용자·도우미 고르기', body, script));
}

// ── U1 메인: 도우미 고르기 ─────────────────────────────────────────
// 메인 구성 라벨(도우미 메인 소개와 같은 모양): 테두리와 왼쪽 위 이름표
const LABEL = (radius, text) => `<span aria-hidden="true" style="position: absolute; inset: -4px; border: 2px solid #3A5BFF; border-radius: ${radius}px; pointer-events: none"></span><span class="pk-pop" style="position: absolute; top: -11px; left: 12px; font-size: 12px; font-weight: 700; line-height: 16px; color: #FFFFFF; background: #3A5BFF; padding: 3px 9px; border-radius: 999px">${text}</span>`;
{
  const body = `${userHeader()}
  <div style="position: absolute; top: 56px; left: 0; right: 0; bottom: 66px; overflow-y: auto; padding: 16px 20px 24px; box-sizing: border-box">
    <div style="position: relative; margin-top: 8px; border-radius: 20px">
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
    ${LABEL(23, '곧 열리는 공연')}
    </div>
    <div style="position: relative; margin-top: 18px; border-radius: 12px">
    <div style="height: 52px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E6E9EF; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box">
      <span style="font-size: 14px; color: #6B7180">공연명, 도우미 이름, 예매처를 검색해 보세요</span>
      ${svg('search', 20, '#3A5BFF', 2)}
    </div>
    ${LABEL(15, '공연·도우미 검색')}
    </div>
    <h2 style="margin: 22px 0 0; font-size: 17px; font-weight: 800">이번 주, 주목할 도우미</h2>
    <div style="position: relative; margin-top: 18px; border-radius: 16px">
      <a href="U2-profile.dc.html" style="display: flex; gap: 12px; padding: 16px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; color: #16181D; text-decoration: none">
        ${AGENT_AVATAR(52, 14, 18)}
        <span style="min-width: 0">
          <span style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px"><strong style="font-size: 16px">${AGENT}</strong>${BADGES}</span>
          <span style="display: block; margin-top: 6px; font-size: 13px; color: #4B5160">★ 4.8 · 거래 32회 · 착수비 5,000원부터</span>
        </span>
      </a>
      ${halo(20)}
      <span class="pk-pop" style="position: absolute; top: -11px; left: 12px; font-size: 12px; font-weight: 700; line-height: 16px; color: #FFFFFF; background: #3A5BFF; padding: 3px 9px; border-radius: 999px">도우미 목록</span>
    </div>
    ${bubble({ title: '도우미를 골라 봐요', sub: '프로필에서 조건과 후기를 봐요' })}
    <div style="margin-top: 12px; display: flex; gap: 12px; padding: 16px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; opacity: 0.6">
      <span style="flex: 0 0 52px; height: 52px; border-radius: 14px; background: #EEF2FF; color: #2D48D6; font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center">별</span>
      <span style="min-width: 0"><strong style="display: block; font-size: 16px">별빛티켓</strong><span style="display: block; margin-top: 6px; font-size: 13px; color: #4B5160">★ 4.6 · 거래 18회 · 착수비 7,000원부터</span></span>
    </div>
  </div>

${nav(USER_NAV, 'find')}`;
  const script = `
class Component extends DCLogic {
  renderVals() {
    return {
      ${prog(1)}
    };
  }
}`;
  write('U1-main.dc.html', doc('메인 · 도우미 고르기 · 이용자', body, script));
}

// ── U2 도우미 프로필: 확인 → 거래 후기 보기 → 요청하기 ──────────────
{
  const tabBtn = (on, text, extra = '') => `<button type="button" role="tab" aria-selected="{{${on}}}"${extra} style="{{${on}Style}}">${text}</button>`;
  const bar = (score, count) => `<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #4B5160"><span style="flex: 0 0 26px">${score}점</span><span role="meter" aria-label="${score}점 후기" aria-valuemin="0" aria-valuemax="27" aria-valuenow="${count}" style="flex: 1; height: 6px; border-radius: 999px; background: #EEF1F5; overflow: hidden"><span style="display: block; width: ${Math.round((count / 27) * 100)}%; height: 100%; background: #F5A524"></span></span><small style="flex: 0 0 26px; text-align: right; color: #6B7180">${count}개</small></div>`;
  const review = (stars, date, result, text) => `<article style="padding: 14px 0; border-top: 1px solid #F0F2F6">
          <div style="display: flex; align-items: center; gap: 6px"><strong style="font-size: 13px">이용자</strong><span style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: #0B7A67; background: #E6F7F3; padding: 2px 7px; border-radius: 999px">${svg('check', 12, '#0B7A67', 2.4)}매칭 내역 확인</span></div>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 12px"><span aria-label="${stars}점" style="color: #F5A524">${'★'.repeat(stars)}<span style="color: #D5D9E2">${'☆'.repeat(5 - stars)}</span></span><time style="color: #6B7180">${date}</time></div>
          <p style="margin: 6px 0 0; font-size: 12px; color: #6B7180">이용자 후기 결과: ${result}</p>
          <p style="margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: #16181D">${text}</p>
        </article>`;
  const FEEDBACK = `<section style="margin-top: 16px; background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 8px 16px 18px">
      <div role="tablist" aria-label="프로필 정보" style="display: flex; gap: 20px; border-bottom: 1px solid #E6E9EF">
        ${tabBtn('about', '도우미 소개')}
        <div ref="{{targetRef}}" style="position: relative; border-radius: 8px">
          ${tabBtn('reviews', '거래 후기 27', ' onClick="{{showReviews}}"')}
          <sc-if value="{{tabStep}}" hint-placeholder-val="{{ false }}">${halo(10)}</sc-if>
        </div>
      </div>
      <sc-if value="{{tabStep}}" hint-placeholder-val="{{ false }}">${bubble({ title: '후기도 확인해요', sub: '실제 이용자가 남긴 후기예요', justify: 'flex-start', at: { left: 150 } })}</sc-if>
      <sc-if value="{{about}}" hint-placeholder-val="{{ true }}">
        <h3 style="margin: 16px 0 0; font-size: 15px">공연을 기다리는 마음, 함께할게요.</h3>
        <p style="margin: 8px 0 0; font-size: 14px; line-height: 1.7; color: #4B5160">희망하는 공연과 좌석 조건을 꼼꼼히 확인하고, 충분히 이야기한 뒤 예매를 준비해요.</p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #6B7180">도우미가 직접 작성한 소개예요.</p>
      </sc-if>
      <sc-if value="{{reviews}}" hint-placeholder-val="{{ false }}">
        <div class="pk-pop" style="display: flex; align-items: center; gap: 16px; margin-top: 16px; padding: 14px; border-radius: 12px; background: #F5F7FA">
          <div style="flex: 0 0 auto; text-align: center"><strong style="display: block; font-size: 28px; font-weight: 800">4.8</strong><span style="color: #F5A524; font-size: 13px">★★★★★</span><small style="display: block; margin-top: 2px; font-size: 11px; color: #6B7180">거래 후기 27개</small></div>
          <div aria-label="별점 분포" style="flex: 1; display: flex; flex-direction: column; gap: 4px">${bar(5, 22)}${bar(4, 4)}${bar(3, 1)}${bar(2, 0)}${bar(1, 0)}</div>
        </div>
        <div style="margin-top: 8px">
        ${review(5, '2026.10.02', '성공', '오픈 전에 진행 방식을 꼼꼼히 설명해 주셔서 믿고 맡겼어요. 원하던 1층 좌석으로 예매됐어요.')}
        ${review(5, '2026.09.21', '성공', '연락이 빠르고 친절했어요. 다음 공연도 부탁드리려고요.')}
        ${review(4, '2026.09.08', '부분 성공', '2매 중 1매만 잡혔지만 미리 정한 대로 깔끔하게 정리해 주셨어요.')}
        </div>
        <p role="status" style="margin: 8px 0 0; text-align: center; font-size: 12px; color: #6B7180">아래로 스크롤하면 후기가 이어져요.</p>
      </sc-if>
    </section>`;
  const tile = (k, v) => `<div style="flex: 1; padding: 12px 10px; border-radius: 12px; background: #F5F7FA; text-align: center"><span style="display: block; font-size: 12px; color: #6B7180">${k}</span><strong style="display: block; margin-top: 4px; font-size: 16px">${v}</strong></div>`;
  const body = `${userHeader()}
${L.scroller(`    ${crumbTitle('목록', '상세 프로필', '도우미 프로필')}
    <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">
      <div>${bubble({ title: '프로필을 확인해요', sub: '조건과 후기를 보고 골라요', justify: 'flex-start', arrow: 'down', at: { left: 30 }, gap: 12 })}</div>
    </sc-if>
    <div style="position: relative; border-radius: 16px">
      <section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
        <div style="display: flex; gap: 14px">
          ${AGENT_AVATAR(64, 18, 22)}
          <div style="min-width: 0">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px"><h2 style="margin: 0; font-size: 20px; font-weight: 800">${AGENT}</h2>${BADGES}</div>
            <p style="margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: #4B5160">공연을 기다리는 마음, 함께할게요.</p>
            <span style="display: block; margin-top: 6px; font-size: 13px"><b style="color: #F5A524">★</b> <strong>4.8</strong> · <button type="button" onClick="{{showReviews}}" style="padding: 0; border: 0; background: none; font-family: inherit; font-size: 13px; color: #2D48D6; cursor: pointer">후기 27개</button></span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 16px">${tile('성공률', '92%')}${tile('거래 횟수', '32회')}${tile('평균 응답', '10분 이내')}</div>
        <p style="display: flex; align-items: center; gap: 4px; margin: 12px 0 0; font-size: 12px; color: #6B7180">${svg('info', 13, '#6B7180', 2)} 플랫폼 거래 기록 기준 · 소개와 경력은 도우미가 직접 작성해요.</p>
      </section>
      <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">${halo(20)}</sc-if>
    </div>
    ${card('함께하기 전에 확인하세요', `${rows([['가능 예매처', 'NOL 티켓 · YES24 티켓 · 멜론티켓'], ['주로 맡는 분야', '콘서트'], ['활동 가능 시간', '평일 저녁 · 주말'], ['최소 착수비', '5,000원'], ['수고비', '20,000 ~ 40,000원 · 최종 조건에서 확정'], ['활동 경력', '3년 · 본인 작성']])}
  ${notice('연락처는 요청을 수락한 상대방에게만 공개돼요.')}`)}
    ${FEEDBACK}`, '142px')}

  <div style="position: absolute; left: 0; right: 0; bottom: 66px; z-index: 11; display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #FFFFFF; border-top: 1px solid #E6E9EF; box-sizing: border-box">
    <span style="flex: 0 0 auto"><span style="display: block; font-size: 12px; color: #6B7180">최소 착수비</span><strong style="font-size: 16px">5,000원부터</strong></span>
    <div style="position: relative; flex: 1; border-radius: 10px">
      <a href="U3-quote.dc.html" style="${BTN}">이 도우미에게 요청하기</a>
      <sc-if value="{{askStep}}" hint-placeholder-val="{{ false }}">${halo(14)}</sc-if>
    </div>
  </div>
  <sc-if value="{{askStep}}" hint-placeholder-val="{{ false }}">
    <div style="position: absolute; right: 12px; bottom: 150px; z-index: 12">${bubble({ title: '요청을 보내 봐요', sub: '요청은 무료예요', justify: 'flex-end', arrow: 'down', at: { right: 60 }, gap: 0 })}</div>
  </sc-if>

${nav(USER_NAV, 'find')}`;
  const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { step: 'read', tab: 'about' };${scrollLogic('read', 'tab')}
  }
  renderVals() {
    const s = this.state.step;
    const reviews = this.state.tab === 'reviews';
    const tab = (on) => 'min-height: 44px; padding: 0 2px; border: 0; border-bottom: 2px solid ' + (on ? '#3A5BFF' : 'transparent') + '; margin-bottom: -1px; background: none; font-family: inherit; font-size: 15px; cursor: pointer; ' + (on ? 'font-weight: 700; color: #16181D' : 'font-weight: 600; color: #4B5160');
    const n = { read: 2, tab: 3, ask: 4 }[s];
    return {
      progN: n,
      progW: n / ${TOTAL} * 100 + '%',
      boxRef: this.boxRef,
      targetRef: this.targetRef,
      onScroll: this.onScroll,
      read: s === 'read',
      tabStep: s === 'tab',
      askStep: s === 'ask',
      about: !reviews,
      reviews: reviews,
      aboutStyle: tab(!reviews),
      reviewsStyle: tab(reviews),
      showReviews: () => this.setState({ tab: 'reviews', step: s === 'read' || s === 'tab' ? 'ask' : s }),
    };
  }
}`;
  write('U2-profile.dc.html', doc('도우미 프로필 · 이용자', body, script));
}

// ── U3 요청 보내기: 요청서 확인 → 동의 → 보내기 → 전송 완료 ─────────
{
  const label = (text, required, helper) => `<div style="margin-top: 16px; font-size: 13px; font-weight: 700">${text}${required ? ' <em style="font-style: normal; font-size: 10px; color: #B42318">*</em>' : ' <small style="font-size: 11px; font-weight: 400; color: #8A90A0">선택</small>'}</div>${helper ? `<div style="margin-top: 2px; font-size: 12px; line-height: 1.6; color: #6B7180">${helper}</div>` : ''}`;
  const box = (text, tall) => `<div style="margin-top: 6px; ${tall ? 'min-height: 76px; ' : ''}padding: 12px 14px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-size: 14px; line-height: 1.5; white-space: pre-line; box-sizing: border-box">${text}</div>`;
  const pair = (a, b) => `<div style="display: flex; gap: 10px"><div style="flex: 1; min-width: 0">${a}</div><div style="flex: 1; min-width: 0">${b}</div></div>`;
  const ghostSmall = (t) => `<button type="button" style="min-height: 36px; padding: 0 12px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 13px; font-weight: 600; color: #4B5160">${t}</button>`;
  const agreeRow = (t) => `<div style="display: flex; align-items: center; justify-content: space-between; min-height: 36px; font-size: 13px; color: #4B5160"><span style="display: flex; align-items: center; gap: 8px"><span aria-hidden="true" style="{{boxStyle}}">${svg('check', 12, '#FFFFFF', 3)}</span>${t} (필수)</span><span style="font-size: 12px; color: #2D48D6; text-decoration: underline">보기</span></div>`;
  const body = `${userHeader()}
${L.scroller(`    ${crumbTitle('도우미 프로필', '요청 보내기', '요청 보내기')}
    <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">
      <div>${bubble({ title: '요청서를 확인해요', sub: '이번엔 미리 채워 뒀어요', justify: 'flex-start', arrow: 'down', at: { left: 30 }, gap: 12 })}</div>
    </sc-if>
    <div style="position: relative; border-radius: 16px">
      ${cardOpen('요청서')}
        <div style="display: flex; gap: 8px; margin-top: 10px">${ghostSmall('불러오기')}${ghostSmall('임시저장')}</div>
        ${label('공연명', true)}${box(TITLE)}
        ${label('분야', true)}${box('콘서트')}
        ${pair(label('공연 날짜') + box('2026-12-26'), label('공연 시작 시간') + box('19:00'))}
        ${pair(label('티켓 오픈 날짜', true) + box('2026-11-20'), label('티켓 오픈 시간') + box('20:00'))}
        ${label('예매 회차')}${box('일반 예매')}
        ${label('예매처', true)}${box('NOL 티켓')}
        ${label('희망 좌석·요청 내용', true, '원하는 좌석과 요청 사항을 적어 주세요. 도우미가 어떻게 진행할지 참고하는 내용이에요.')}${box('1층 R석 2매, 통로 쪽이면 좋아요', true)}
        ${label('성공 요건', true, '어디까지 잡아야 성공으로 볼지 적어 주세요. 성공 요건은 수고비 지급의 최소 기준이 됩니다.')}${box('R석 이상 2매 연석', true)}
        ${label('희망 수고비', false, '도우미에게 제안하고 싶은 수고비예요. 최종 금액은 서로 합의해요.')}${box('25,000원')}
        ${label('기타 사항')}${box('오픈 직후 연락 가능해요', true)}
        ${label('도우미 응답 기한', true, '티켓 오픈 전이어야 해요. 이 시간까지 도우미가 수락하지 않으면 요청이 만료돼요.')}${box('2026-10-12 14:10')}
      </section>
      <sc-if value="{{read}}" hint-placeholder-val="{{ true }}">${halo(20)}</sc-if>
    </div>
    ${card('연락처', `${notice('요청을 보내려면 상대방에게 공개할 연락처가 필요해요. 수락한 도우미에게만 공개돼요.')}
  ${pair(label('종류', true) + box('휴대폰'), label('연락처', true) + box('010-1234-5678'))}`)}
    ${cardOpen('선택한 도우미', 16)}
      <h3 style="margin: 10px 0 0; font-size: 18px; font-weight: 800">${AGENT}</h3>
      <p style="margin: 4px 0 0; font-size: 14px; color: #4B5160">공연을 기다리는 마음, 함께할게요.</p>
      <div style="margin-top: 10px; font-size: 13px; color: #4B5160"><div style="display: flex; justify-content: space-between; padding: 6px 0"><span>최소 착수비</span><strong style="color: #16181D">5,000원</strong></div><div style="display: flex; justify-content: space-between; padding: 6px 0"><span>성공비</span><strong style="color: #16181D">최종 조건에서 확정</strong></div></div>
      ${notice('PICO에서는 결제하지 않아요. 도우미가 보낸 최종 조건을 확정하면 매칭이 완료되고, 비용은 도우미와 직접 정산해요.')}
      <div ref="{{targetRef}}" style="position: relative; margin-top: 14px; border-radius: 10px">
        <button type="button" role="checkbox" aria-checked="{{agreed}}" onClick="{{agree}}" style="display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid #E6E9EF; border-radius: 10px; background: #F5F7FA; font-family: inherit; font-size: 14px; font-weight: 700; color: #16181D; cursor: pointer"><span aria-hidden="true" style="{{boxStyle}}">${svg('check', 12, '#FFFFFF', 3)}</span>전체 동의</button>
        <sc-if value="{{agreeStep}}" hint-placeholder-val="{{ false }}">${halo(14)}</sc-if>
      </div>
      <sc-if value="{{agreeStep}}" hint-placeholder-val="{{ false }}">${bubble({ title: '약관에 동의해요', sub: '요청하려면 꼭 필요해요' })}</sc-if>
      <div style="margin-top: 6px; padding: 0 4px">${agreeRow('서비스 이용약관')}${agreeRow('개인정보 수집·이용')}${agreeRow('연락처 제공 동의')}</div>
      <p style="margin: 8px 4px 0; font-size: 13px; color: #2D48D6; text-decoration: underline">예매처 약관 및 유의사항 보기</p>
      <div style="position: relative; margin-top: 14px; border-radius: 10px">
        <button type="button" onClick="{{send}}" aria-disabled="{{notAgreed}}" style="{{sendStyle}}">요청 보내기</button>
        <sc-if value="{{sendStep}}" hint-placeholder-val="{{ false }}">${halo(14)}</sc-if>
      </div>
      <sc-if value="{{sendStep}}" hint-placeholder-val="{{ false }}">${bubble({ title: '요청을 보내요', sub: '요청은 무료예요' })}</sc-if>
    </section>`)}

${nav(USER_NAV, 'find')}

  <sc-if value="{{sent}}" hint-placeholder-val="{{ false }}">
    <div class="pk-pop" style="position: absolute; top: 56px; left: 0; right: 0; bottom: 0; z-index: 70; background: #F5F7FA; display: flex; flex-direction: column; padding: 0 24px 24px; box-sizing: border-box">
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center">
        <span style="display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 50%; background: #3A5BFF">${svg('check', 34, '#FFFFFF', 2.4)}</span>
        <span style="margin-top: 18px; font-size: 12px; font-weight: 700; color: #2D48D6">요청 전송 완료</span>
        <h1 style="margin: 8px 0 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px">도우미에게 마음이 도착했어요</h1>
        <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.7; color: #4B5160">요청 내용을 자동으로 확인한 뒤 도우미에게 전달해요. 추가 확인이 필요하면 운영팀이 검토해요.<br>수락과 최종 조건 도착 소식은 알림으로 알려드릴게요.</p>
      </div>
      <div style="position: relative; border-radius: 10px">
        <a href="U4-request.dc.html" style="${BTN}">보낸 요청 확인</a>
        ${halo(14)}
      </div>
      ${bubble({ title: '보낸 요청을 확인해요', sub: '도우미의 응답이 여기로 와요', arrow: 'up', gap: 12 })}
      <button type="button" style="${BTN_GHOST}">내 활동으로</button>
      <small style="display: block; margin-top: 14px; text-align: center; font-size: 12px; color: #6B7180">PICO에서는 결제하지 않아요. 최종 조건을 확정하면 매칭이 완료돼요.</small>
    </div>
  </sc-if>`;
  const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { step: 'read' };${scrollLogic('read', 'agree')}
  }
  renderVals() {
    const s = this.state.step;
    const set = (p) => this.setState(p);
    const agreed = s === 'send' || s === 'sent';
    const n = { read: 5, agree: 6, send: 7, sent: 8 }[s];
    return {
      progN: n,
      progW: n / ${TOTAL} * 100 + '%',
      boxRef: this.boxRef,
      targetRef: this.targetRef,
      onScroll: this.onScroll,
      read: s === 'read',
      agreeStep: s === 'agree',
      sendStep: s === 'send',
      sent: s === 'sent',
      agreed: agreed,
      notAgreed: !agreed,
      boxStyle: 'flex: 0 0 18px; width: 18px; height: 18px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; ' + (agreed ? 'background: #3A5BFF; border: 0' : 'background: #FFFFFF; border: 1.5px solid #B4BAC6'),
      sendStyle: '${BTN}' + (agreed ? '' : '; opacity: 0.45; cursor: not-allowed'),
      agree: () => set({ step: agreed ? 'agree' : 'send' }),
      send: () => { if (agreed) set({ step: 'sent' }); },
    };
  }
}`;
  write('U3-quote.dc.html', doc('요청 보내기 · 이용자', body, script));
}

// ── U4 요청 상세: 응답 대기 → 최종 조건 확인·확정 → 매칭 완료 ───────
{
  const body = `${userHeader()}
${L.scroller(`    ${L.pageTitle('내 활동', '요청 상세')}
    <sc-if value="{{waiting}}" hint-placeholder-val="{{ true }}">
      ${detailHeader({ date: DATE, badge: statusBadge('도우미 응답 대기', 'amber'), title: TITLE, sub: SUB, next: nextStep('도우미가 요청을 확인할 차례예요', '수락 전에는 요청 내용을 수정하거나 취소할 수 있어요.', '체험님은 지금 따로 하실 일이 없어요. 편하게 기다려 주세요.') })}
      ${popCard('도우미가 수락하고 최종 조건을 보냈어요', '잠시 뒤', `<div style="position: relative; margin-top: 12px; border-radius: 10px"><button type="button" onClick="{{arrive}}" style="${BTN}">다음</button>${halo(14)}</div>`)}
      ${card('이용자가 보낸 요청', rows(REQUEST))}
      ${contact(false)}
      ${cardOpen('진행 상황', 16)}
        ${progressList(0)}
        ${notice('도우미의 응답을 기다리고 있어요.').replace('margin-top: 12px', 'margin-top: 0')}
        <button type="button" style="${BTN_GHOST}">요청 내용 수정</button>
        <button type="button" style="${BTN_GHOST}; color: #B42318">요청 취소</button>
      </section>
    </sc-if>
    <sc-if value="{{reviewing}}" hint-placeholder-val="{{ false }}">
      ${detailHeader({ date: DATE, badge: statusBadge('최종 조건 확인 대기'), title: TITLE, sub: SUB, next: nextStep('이용자가 최종 조건을 확인할 차례예요', '변경된 내용을 확인하고 확정하거나 수정을 요청해 주세요.') })}
      <sc-if value="{{read}}" hint-placeholder-val="{{ false }}">
        <div style="margin-top: 16px">${bubble({ title: '도착한 조건을 확인해요', sub: '비용과 실패·환불 처리를 꼭 봐요', justify: 'flex-start', arrow: 'down', at: { left: 30 } })}</div>
      </sc-if>
      <div style="position: relative; margin-top: 16px; border-radius: 16px">
        ${card('도우미가 보낸 최종 조건', `${notice('1차 제안 · 2026. 10. 10. 오후 3:20 · 이용자 확인을 기다리고 있어요.')}
  ${rows(AGREEMENT)}`, 0)}
        <sc-if value="{{read}}" hint-placeholder-val="{{ false }}">${halo(20)}</sc-if>
      </div>
      ${contact(true)}
      ${cardOpen('진행 상황', 16)}
        ${progressList(2)}
        <div ref="{{targetRef}}" style="position: relative; border-radius: 10px">
          <button type="button" onClick="{{openSheet}}" style="${BTN}">확인하고 확정하기</button>
          <sc-if value="{{confirmStep}}" hint-placeholder-val="{{ false }}">${halo(14)}</sc-if>
        </div>
        <sc-if value="{{confirmStep}}" hint-placeholder-val="{{ false }}">${bubble({ title: '조건을 확정해요', sub: '바꾸고 싶으면 수정을 요청해요' })}</sc-if>
        <button type="button" style="${BTN_GHOST}">조건 수정해서 제안하기</button>
        <button type="button" style="${BTN_GHOST}">수정 요청하기</button>
      </section>
    </sc-if>
    <sc-if value="{{matched}}" hint-placeholder-val="{{ false }}">
      ${detailHeader({ date: DATE, badge: statusBadge('직접 거래 매칭 완료', 'muted'), title: TITLE, sub: SUB, next: nextStep('직접 거래 매칭을 마쳤어요', '착수·결과 등록 없이 당사자끼리 진행해요. 이용자는 거래 경험과 예매 결과를 후기로 남길 수 있어요.', '', true) })}
      ${popCard('매칭이 완료됐어요', '잘했어요!', `<p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: #4B5160">이제 도우미 연락처로 직접 연락하고, 비용도 직접 주고받아요. 예매가 끝나면 후기를 남겨요.</p>
        <div style="position: relative; margin-top: 12px; border-radius: 10px"><a href="U5-end.dc.html" style="${BTN}">다음</a>${halo(14)}</div>`)}
      ${card('확정된 최종 조건', `${notice('양측이 1차 제안에 동의해 확정됐어요. (2026. 10. 10. 오후 3:40)', 'success')}
  ${rows(AGREEMENT)}`)}
      ${contact(true)}
      ${DIRECT_CARD}
      ${cardOpen('진행 상황', 16)}
        ${progressList(4)}
        <button type="button" style="${BTN}">후기 작성</button>
        ${CONFIRMED}
      </section>
    </sc-if>
    ${DISCLAIMER}`)}

${nav(USER_NAV, 'activity')}

  <sc-if value="{{sheet}}" hint-placeholder-val="{{ false }}">
    ${sheet({ label: '최종 조건 확정 확인', title: '최종 조건을 확정할까요?', body: '<p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #4B5160">확정하면 직접 거래 매칭이 완료돼요. 착수·결과 등록 없이 당사자끼리 진행하고, 이용자는 후기를 남길 수 있어요.</p>', cancel: '{{closeSheet}}', confirmBtn: `<div style="position: relative; flex: 1; border-radius: 10px"><button type="button" onClick="{{confirm}}" style="${BTN}">확정하기</button>${halo(14)}</div>` })}
      ${bubble({ title: '한 번 더 눌러요', sub: '확정하면 매칭이 완료돼요', justify: 'flex-end', at: { right: 128 } })}
    </div>
  </sc-if>`;
  const script = `
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { step: 'waiting' };${scrollLogic('read', 'confirm')}
  }
  renderVals() {
    const s = this.state.step;
    const set = (p) => this.setState(p);
    const top = () => { if (this.box) this.box.scrollTop = 0; };
    const n = { waiting: 9, read: 10, confirm: 11, sheet: 12, matched: 13 }[s];
    return {
      progN: n,
      progW: n / ${TOTAL} * 100 + '%',
      boxRef: this.boxRef,
      targetRef: this.targetRef,
      onScroll: this.onScroll,
      waiting: s === 'waiting',
      reviewing: s === 'read' || s === 'confirm' || s === 'sheet',
      read: s === 'read',
      confirmStep: s === 'confirm',
      sheet: s === 'sheet',
      matched: s === 'matched',
      arrive: () => { set({ step: 'read' }); top(); },
      openSheet: () => set({ step: 'sheet' }),
      closeSheet: () => set({ step: 'confirm' }),
      confirm: () => { set({ step: 'matched' }); top(); },
    };
  }
}`;
  write('U4-request.dc.html', doc('요청 상세 · 조건 확정 · 이용자', body, script));
}

// ── U5 함께 해 보기 마침: 혼자 해 보기로 ─────────────────────────────
{
  const body = `${userHeader(false)}
  <div class="pk-pop" style="position: absolute; top: 56px; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; padding: 0 24px 24px; background: #FFFFFF; box-sizing: border-box">
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center">
      ${MASCOT(80)}
      <h1 style="margin: 18px 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px">함께 해 보기를 마쳤어요</h1>
      <p style="margin: 8px 0 0; font-size: 16px; line-height: 1.5; color: #4B5160">도우미를 고르고 요청을 보내<br>매칭까지 해 봤어요.<br>이번엔 표시 없이 혼자 해 봐요.</p>
    </div>
    <a href="U6-practice.dc.html" style="${BTN}">혼자 해 보기</a>
    <a href="${SIGNUP_URL}" style="${BTN_GHOST}; color: #16181D; text-decoration: none">회원가입하기</a>
    <a href="U0-role.dc.html" style="${BTN_GHOST}; color: #16181D; text-decoration: none">첫 화면으로</a>
  </div>`;
  const script = `
class Component extends DCLogic {
  renderVals() {
    return {};
  }
}`;
  write('U5-end.dc.html', doc('함께 해 보기 마침 · 이용자', body, script));
}
require('./build-user-practice.cjs');
console.log('built U0 U1 U2 U3 U4 U5 U6');
