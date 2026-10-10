// 시안 보드 생성용 공통 조각. 실제 앱(web/src)의 화면 구조·문구를 따른다.
const fs = require('fs');

const FONT = "@font-face{font-family:'Pretendard Variable';src:url('/_blob/21fe0ac276d3b307f537ac0bfb44ce92') format('woff2');font-weight:45 920;font-style:normal;font-display:swap}";
const CSS = [
  FONT,
  'body{margin:0}',
  'a{color:#2D48D6}a:hover{color:#1F37B0}',
  'input::placeholder,textarea::placeholder{color:#8A90A0}',
  'input:focus-visible,textarea:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid #3A5BFF;outline-offset:2px}',
  '.pk-halo{animation:pk-halo 1.6s ease-out infinite}',
  '.pk-ring{animation:pk-ring 1.6s ease-out infinite}',
  '.pk-pop{animation:pk-pop .35s cubic-bezier(.2,.8,.2,1) both}',
  '@keyframes pk-halo{0%{transform:scale(1);opacity:.9}70%{transform:scale(1.05);opacity:0}100%{transform:scale(1.05);opacity:0}}',
  '@keyframes pk-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.8);opacity:0}}',
  '@keyframes pk-pop{0%{transform:translateY(12px);opacity:0}100%{transform:none;opacity:1}}',
  '@media (prefers-reduced-motion: reduce){.pk-halo,.pk-ring,.pk-pop{animation:none}}',
].join('\n');

const doc = (title, body, script) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
${CSS}
</style>
</helmet>
<div style="position: relative; width: 390px; height: 844px; overflow: hidden; background: #F5F7FA; color: #16181D; font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; word-break: keep-all">
${body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
${script.trim()}
</script>
</body>
</html>
`;

const write = (name, html) => fs.writeFileSync(__dirname + '/project/' + name, html);

const MASCOT = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 96 96" aria-hidden="true" style="flex: 0 0 ${s}px"><path d="M24 18H72A16 16 0 0 1 88 34V41A9 9 0 0 0 88 59V66A16 16 0 0 1 72 82H24A16 16 0 0 1 8 66V59A9 9 0 0 0 8 41V34A16 16 0 0 1 24 18Z" fill="#3A5BFF"></path><circle cx="30" cy="46" r="6" fill="#FFFFFF"></circle><circle cx="48" cy="46" r="6" fill="#FFFFFF"></circle><circle cx="31" cy="47" r="3" fill="#16181D"></circle><circle cx="49" cy="47" r="3" fill="#16181D"></circle><path d="M32 58Q39 64 46 58" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none"></path></svg>`;
const ICON = {
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4 4"></path>',
  ticket: '<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"></path><path d="M16 6v2m0 3v2m0 3v2"></path>',
  inbox: '<path d="m3 3-2 12v6h22v-6L21 3ZM1 15h6l2 3h6l2-3h6"></path>',
  user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21v-2a8 8 0 0 1 16 0v2"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
  check: '<path d="m5 12 4 4L19 6"></path>',
  chevron: '<path d="m9 5 7 7-7 7"></path>',
  close: '<path d="m6 6 12 12M6 18 18 6"></path>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5"></path><path d="M4 16v4h16v-4"></path>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="m3 16 5-5 4 4 3-3 6 6"></path>',
};
const svg = (name, size, color, width = 1.8, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${ICON[name]}</svg>`;

// 헤더: progress=true면 함께 해 보기 진행 막대(progN/progW 값 필요). avatar는 고정 스타일 또는 {{hole}}.
const AVATAR_USER = 'width: 34px; height: 34px; border-radius: 50%; background: #EEF2FF; color: #2D48D6; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center';
const AVATAR_HELPER = 'width: 34px; height: 34px; border-radius: 50%; background: #E6F7F3; color: #0B7A67; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center';
const header = ({ avatar = AVATAR_HELPER, progress = true } = {}) => `  <header style="position: relative; height: 56px; background: #FFFFFF; border-bottom: 1px solid #E6E9EF; display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 20px; box-sizing: border-box">
    <span style="font-size: 19px; font-weight: 800; letter-spacing: -0.4px">PICO</span>
    <div style="display: flex; align-items: center; gap: 4px">
      <button type="button" aria-label="알림" style="width: 44px; height: 44px; border: 0; border-radius: 50%; background: none; display: flex; align-items: center; justify-content: center">${svg('bell', 22, '#4B5160', 1.7)}</button>
      <span style="${avatar}">체</span>
    </div>${progress ? `
    <span role="progressbar" aria-label="체험 진행" aria-valuemin="0" aria-valuemax="15" aria-valuenow="{{progN}}" style="position: absolute; left: 0; bottom: -1px; width: {{progW}}; height: 3px; background: #3A5BFF; transition: width 0.3s"></span>` : ''}
  </header>`;

const NAV = { find: ['도우미 찾기', 'search'], activity: ['내 활동', 'ticket'], leads: ['받은 요청', 'inbox'], matches: ['매칭 관리', 'ticket'], my: ['마이', 'user'] };
const navItemStyle = (active) => `flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border: 0; background: none; font-family: inherit; font-size: 11px; font-weight: ${active ? 700 : 600}; color: ${active ? '#3A5BFF' : '#5F6575'}`;
const navButton = (key, active, attrs = '') => `<button type="button"${active ? ' aria-current="page"' : ''}${attrs} style="${navItemStyle(active)}">
      ${svg(NAV[key][1], 22, 'currentColor', 1.7)}
      ${NAV[key][0]}
    </button>`;
const nav = (keys, active) => `  <nav aria-label="하단 메뉴" style="position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; height: 66px; background: #FFFFFF; border-top: 1px solid #E6E9EF; display: flex">
    ${keys.map((k) => navButton(k, k === active)).join('\n    ')}
  </nav>`;

const halo = (radius = 16) => `<span aria-hidden="true" class="pk-halo" style="position: absolute; inset: -6px; border: 2px solid #3A5BFF; border-radius: ${radius}px; pointer-events: none"></span>
<span aria-hidden="true" style="position: absolute; top: -7px; right: -7px; width: 12px; height: 12px; pointer-events: none"><span class="pk-ring" style="position: absolute; inset: 0; border-radius: 50%; background: #3A5BFF"></span><span style="position: absolute; inset: 0; border-radius: 50%; background: #3A5BFF; box-shadow: 0 0 0 3px #FFFFFF"></span></span>`;

// 문서 흐름 안의 말풍선. arrow 'up'은 위 요소를, 'down'은 아래 요소를 가리킨다. at: 'center' | {left} | {right}
const bubble = ({ title, sub, justify = 'center', arrow = 'up', at = 'center', gap = 14, pad = '' }) => {
  const pos = at === 'center' ? 'left: 50%; margin-left: -5px' : at.left !== undefined ? `left: ${at.left}px` : `right: ${at.right}px`;
  const tip = arrow === 'up' ? 'top: -5px' : 'bottom: -5px';
  const text = sub
    ? `<span><span style="display: block; font-size: 15px; font-weight: 700">${title}</span><span style="display: block; margin-top: 1px; font-size: 13px; color: #C9CDD6">${sub}</span></span>`
    : `<span style="font-size: 15px; font-weight: 700">${title}</span>`;
  return `<div style="display: flex; justify-content: ${justify}; ${arrow === 'up' ? 'margin-top' : 'margin-bottom'}: ${gap}px${pad ? '; ' + pad : ''}">
  <div role="status" class="pk-pop" style="position: relative; display: flex; align-items: center; gap: 8px; background: #16181D; color: #FFFFFF; border-radius: 12px; padding: 10px 16px 10px 10px; box-shadow: 0 6px 16px rgba(0,0,0,0.16); white-space: nowrap">
    <span aria-hidden="true" style="position: absolute; ${tip}; ${pos}; width: 10px; height: 10px; background: #16181D; transform: rotate(45deg)"></span>
    ${MASCOT(24)}
    ${text}
  </div>
</div>`;
};

const pageTitle = (crumb, title) => `${crumb ? `<nav aria-label="현재 위치" style="margin-bottom: 8px; font-size: 13px; color: #6B7180">${crumb} <span aria-hidden="true">›</span> <span aria-current="page">${title}</span></nav>` : ''}
<h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px">${title}</h1>`;

const cardOpen = (title, mt = 0) => `<section style="${mt ? `margin-top: ${mt}px; ` : ''}background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
  <h2 style="margin: 0; font-size: 16px; font-weight: 800">${title}</h2>`;
const card = (title, inner, mt = 16) => `${cardOpen(title, mt)}
  ${inner}
</section>`;

const rows = (pairs) => `<dl style="margin: 6px 0 0">${pairs
  .map(([k, v], i) => `
    <div style="padding: 12px 0;${i ? ' border-top: 1px solid #F0F2F6;' : ''}"><dt style="margin-bottom: 4px; font-size: 12px; color: #6B7180">${k}</dt><dd style="margin: 0; font-size: 14px; line-height: 1.5; color: #4B5160; white-space: pre-line">${v}</dd></div>`)
  .join('')}
  </dl>`;

const notice = (text, tone = '') => {
  const t = { '': ['#EEF2FF', '#E0E6FF', '#3A5BFF', 'info'], success: ['#E6F7F3', '#C8ECE3', '#0B7A67', 'check'], error: ['#FFF4F2', '#F4D9D4', '#B42318', 'info'] }[tone];
  return `<div style="display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; padding: 14px 16px; background: ${t[0]}; border: 1px solid ${t[1]}; border-radius: 12px; font-size: 13px; line-height: 1.65; color: #4B5160">${svg(t[3], 18, t[2], 2, ' style="flex: 0 0 18px; margin-top: 2px"')}<span>${text}</span></div>`;
};

const statusBadge = (text, amber) => `<span style="flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; ${amber ? 'background: #FFF5DF; color: #8A5300' : 'background: #EEF2FF; color: #2D48D6'}">${svg('clock', 13, 'currentColor', 2)}${text}</span>`;

const nextStep = (title, text, idle) => `<div style="display: flex; align-items: flex-start; gap: 13px; margin-top: 18px; padding: 16px; border-radius: 12px; background: linear-gradient(120deg, #F0F3FF, #F7F9FF)">
    <span style="flex: 0 0 42px; height: 42px; border-radius: 12px; background: #FFFFFF; display: flex; align-items: center; justify-content: center">${svg('clock', 22, '#3A5BFF')}</span>
    <div><strong style="font-size: 15px">${title}</strong><p style="margin: 6px 0 0; font-size: 12px; line-height: 1.7; color: #4B5160">${text}</p>${idle ? `<p style="margin: 6px 0 0; font-size: 12px; line-height: 1.7; color: #4B5160">${idle}</p>` : ''}</div>
  </div>`;

// 요청 상세 머리 카드(.tx-detail-header)
const detailHeader = ({ date, badge, title, sub, next }) => `<section style="background: #FFFFFF; border: 1px solid #E6E9EF; border-radius: 16px; padding: 20px 16px">
  <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px">
    <small style="font-size: 12px; color: #6B7180; white-space: nowrap">${date}</small>
    ${badge}
  </div>
  <h2 style="margin: 12px 0 0; font-size: 22px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px">${title}</h2>
  <p style="margin: 4px 0 0; font-size: 14px; color: #4B5160">${sub}</p>
  ${next}
</section>`;

const STEP_NAMES = ['요청 보내기', '요청 수락 · 조건 작성', '이용자 조건 확인', '안전거래 결제', '착수 · 예매 · 결과 등록', '이용자 결과 확인'];
const progressList = (cur) => `<ol aria-label="거래 진행 상황" style="list-style: none; margin: 16px 0 20px; padding: 0">${STEP_NAMES.map((label, i) => {
  const done = i < cur;
  const current = i === cur;
  return `
    <li${current ? ' aria-current="step"' : ''} style="position: relative; display: flex; align-items: center; gap: 11px; min-height: 48px; font-size: 13px; ${current ? 'color: #3A5BFF; font-weight: 650' : done ? 'color: #4B5160' : 'color: #6B7180'}">${i < 5 ? '<span aria-hidden="true" style="position: absolute; left: 13px; top: 37px; bottom: -10px; border-left: 1px solid #E6E9EF"></span>' : ''}<b style="flex: 0 0 27px; height: 27px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; ${current ? 'background: #3A5BFF; color: #FFFFFF' : done ? 'background: #EEF2FF; color: #3A5BFF' : 'background: #F0F2F6; color: #6B7180'}">${done ? svg('check', 14, '#3A5BFF', 2.4) : i + 1}</b><span>${label}${current ? '<small style="display: block; margin-top: 2px; font-size: 11px; font-weight: 500; color: #6B7180">현재 진행 단계예요</small>' : ''}</span></li>`;
}).join('')}
  </ol>`;

const DISCLAIMER = '<p style="margin: 12px 4px 0; font-size: 12px; line-height: 1.6; color: #6B7180">이용자와 도우미 모두 조건을 제안할 수 있어요. 도우미가 보낸 조건은 이용자가, 이용자가 보낸 조건은 도우미가 확정하거나 수정을 요청해요.</p>';
const CONFIRMED = `<p style="display: flex; align-items: center; justify-content: center; gap: 5px; margin: 16px 0 0; font-size: 12px; color: #0B7A67">${svg('check', 15, '#0B7A67', 2.2)} 이용자 최종 확인 완료</p>`;

const BTN = 'display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; border: 0; border-radius: 10px; background: #3A5BFF; font-family: inherit; font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none; cursor: pointer; box-sizing: border-box';
const BTN_GHOST = 'display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; margin-top: 10px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 15px; font-weight: 600; color: #4B5160; cursor: pointer; box-sizing: border-box';

// 바닥 시트(ConfirmModal의 휴대폰 모양)
const sheet = ({ label, title, body, cancel, confirmBtn }) => `<div style="position: absolute; inset: 0; z-index: 50; background: rgba(12,14,22,0.45)"></div>
    <div role="dialog" aria-label="${label}" style="position: absolute; left: 0; right: 0; bottom: 0; z-index: 51; background: #FFFFFF; border-radius: 24px 24px 0 0; padding: 10px 20px 24px; box-shadow: 0 -8px 32px rgba(22,24,29,0.12); box-sizing: border-box">
      <span style="display: block; width: 40px; height: 4px; margin: 0 auto 12px; border-radius: 4px; background: #D5D9E2"></span>
      <div style="display: flex; align-items: center; justify-content: space-between">
        <h2 style="margin: 0; font-size: 19px; font-weight: 800">${title}</h2>
        <button type="button" aria-label="닫기" onClick="${cancel}" style="width: 44px; height: 44px; margin-right: -10px; border: 0; background: none; display: flex; align-items: center; justify-content: center; cursor: pointer">${svg('close', 20, '#4B5160')}</button>
      </div>
      ${body}
      <div style="display: flex; gap: 8px; margin-top: 16px">
        <button type="button" onClick="${cancel}" style="min-height: 48px; padding: 0 22px; border: 1px solid #D5D9E2; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 15px; font-weight: 700; color: #16181D; cursor: pointer">취소</button>
        ${confirmBtn}
      </div>`;

const ACCEPT_BODY = (title) => `<p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #4B5160"><strong style="color: #16181D">${title}</strong><br>수락하면 연락처가 공개되고 최종 조건을 작성할 수 있어요.</p>
      <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px; background: #F5F7FA; border-radius: 12px; padding: 12px 14px; font-size: 14px">
        <div style="display: flex; justify-content: space-between"><span style="color: #4B5160">현재 매칭권</span><strong>10장</strong></div>
        <div style="display: flex; justify-content: space-between"><span style="color: #4B5160">수락에 필요한 매칭권</span><strong>1장</strong></div>
      </div>
      <p style="margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: #5F6575">수락하면 연락처 공유 동의 약관에 동의한 것으로 처리돼요.</p>`;
const START_BODY = '<p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #4B5160">착수하면 거래가 진행 중으로 바뀌어요. 예매를 시도한 화면(대기열·좌석 선택·매진 화면 등)은 꼭 캡처하거나 녹화해 두세요. 실패로 결과를 등록하려면 시도 증빙이 반드시 필요해요. 안전거래라서 착수 후 시도 증빙을 올려 이용자가 승인하면, 결과 전이라도 착수비 지급을 요청해요(정산 계좌 등록 필요).</p>';

const PAYMENT_CARD = (total) => card('안전거래 결제', `<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px"><strong style="display: flex; align-items: center; gap: 5px; font-size: 15px; color: #0B7A67">${svg('check', 18, '#0B7A67', 2.2)} 이용자 결제 완료</strong><strong style="font-size: 15px">${total}</strong></div>
  ${notice('결제 금액을 보관하는 단계예요. 착수비는 착수 후 시도 증빙이 승인되거나 결과가 확정되면 도우미에게 지급을 요청해요(운영팀이 예매 시도 미확인·결과 미제출로 종결하면 지급하지 않고 환불). 성공보수는 성공이면 전액, 부분 성공이면 정산한 금액만 지급돼요. 이용료는 환불되지 않아요.')}`);

const contactCard = (show, phone = '010-1234-5678', kakao = 'redheart_fan') => card('연락방법', show
  ? `${rows([['전화번호', phone], ['카카오톡', kakao]])}
  <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: #6B7180">매칭한 이용자에게만 공개되는 정보예요. 예매처 계정정보는 공유하지 마세요.</p>`
  : notice('요청을 수락하면 매칭한 이용자의 연락처가 공개돼요.'));

// 결과 등록 화면의 결과 선택지·결과별 문구(EvidencePage)
const RESULT_CHOICES = [
  ['SUCCESS', '성공', '성공 요건을 모두 충족했어요. 예매 내역 화면을 첨부하면 이용자가 바로 확인해요(선택).', '#E6F7F3', '#0B7A67', 'check'],
  ['PARTIAL', '부분 성공', '일부만 충족했어요. 증빙은 선택이에요. 안전거래는 완료 후 부분성공 정산으로 금액을 정해요.', '#FFF4E0', '#8A5300', 'half'],
  ['FAILURE', '실패', '예매하지 못했어요. 예매를 시도한 화면(시도 증빙)이 반드시 필요해요.', '#FDECEA', '#B42318', 'close'],
];
const resultIcon = (kind, color) => kind === 'half'
  ? `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="${color}" stroke-width="2.2"></circle><path d="M12 4a8 8 0 0 1 0 16Z" fill="${color}"></path></svg>`
  : svg(kind, 18, color, 2.4);
const resultOption = ([, label, desc, bg, color, icon], handler) => `<button type="button" onClick="${handler}" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 16px 14px; border: 1px solid #E6E9EF; border-radius: 12px; background: #FFFFFF; font-family: inherit; text-align: left; color: #16181D; cursor: pointer; box-sizing: border-box">
        <span aria-hidden="true" style="flex: 0 0 36px; height: 36px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center">${resultIcon(icon, color)}</span>
        <span style="flex: 1; min-width: 0"><strong style="display: block; font-size: 15px">${label}</strong><small style="display: block; margin-top: 4px; font-size: 12px; line-height: 1.5; color: #6B7180">${desc}</small></span>
        ${svg('chevron', 18, '#8A90A0', 2)}
      </button>`;
const RESULT_NOTICE = notice('계정정보 등 민감한 내용은 가려 주세요. 결과는 한 번만 제출할 수 있어요. 이용자가 동의하면 거래가 완료되고, 이의를 제기하면 운영팀이 증빙을 보고 정해요. 이용자가 3일 동안 답하지 않으면 운영팀이 확정할 수 있어요.');
const UPLOAD_BOX = (handler) => `<button type="button" onClick="${handler}" style="display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 10px 14px; border: 1.5px dashed #B4BAC6; border-radius: 12px; background: #FAFBFC; font-family: inherit; text-align: left; color: #16181D; cursor: pointer; box-sizing: border-box">
          ${svg('upload', 22, '#3A5BFF')}
          <span><span style="display: block; font-size: 14px; font-weight: 700">파일 선택 또는 추가 첨부</span><span style="display: block; font-size: 12px; color: #5F6575">파일당 최대 20MB</span></span>
        </button>`;
const FILE_CHIP = `<div style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 14px; border: 1px solid #D5D9E2; border-radius: 12px; box-sizing: border-box">
          <span aria-hidden="true" style="flex: 0 0 40px; height: 40px; border-radius: 8px; background: #DDE3F5; display: flex; align-items: center; justify-content: center">${svg('image', 20, '#2D48D6')}</span>
          <span style="flex: 1; min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700">{{fileName}}</span><span style="display: block; font-size: 12px; color: #0B7A67">첨부했어요</span></span>
        </div>`;

// 스크롤 영역: ref로 스크롤 위치를 보고 다음 단계로 넘긴다.
const scroller = (inner, bottom = '66px') => `  <div ref="{{boxRef}}" onScroll="{{onScroll}}" style="position: absolute; top: 56px; left: 0; right: 0; bottom: ${bottom}; overflow-y: auto; padding: 16px 20px 24px; box-sizing: border-box">
${inner}
  </div>`;

module.exports = {
  doc, write, MASCOT, svg, header, AVATAR_USER, AVATAR_HELPER, nav, navButton, navItemStyle, halo, bubble, pageTitle, cardOpen, card, rows, notice,
  statusBadge, nextStep, detailHeader, progressList, DISCLAIMER, CONFIRMED, BTN, BTN_GHOST, sheet, ACCEPT_BODY, START_BODY, PAYMENT_CARD,
  contactCard, RESULT_CHOICES, resultOption, RESULT_NOTICE, UPLOAD_BOX, FILE_CHIP, scroller,
};
