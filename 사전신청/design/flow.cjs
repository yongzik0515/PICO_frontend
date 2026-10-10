// Fake DCLogic runtime: setState merges synchronously so the flow can be driven step by step.
const fs = require('fs');
const dir = __dirname + '/project/';
class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(p) { Object.assign(this.state, typeof p === 'function' ? p(this.state) : p); }
}
const timers = [];
const load = (f) => {
  const s = fs.readFileSync(dir + f, 'utf8');
  const code = s.split('data-dc-script')[1].split('>').slice(1).join('>').split('</script>')[0];
  return new Function('DCLogic', 'setTimeout', 'clearTimeout', code + '\nreturn Component;')(DCLogic, (fn) => timers.push(fn), () => {});
};
const ok = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exitCode = 1; } };
const ev = (value) => ({ target: { value } });
// 스크롤 영역과 목표를 흉내 낸다: 목표가 화면 아래에 있다가 끝까지 내리면 보인다.
const fakeScroll = (c) => {
  c.boxRef({ scrollTop: 0, clientHeight: 700, scrollTo(o) { this.scrollTop = o.top; } });
  if (c.targetRef) c.targetRef({ offsetTop: 1800, offsetHeight: 48 });
};

// ── 함께 해 보기 ──
const steps = [];
const m2 = new (load('M2-welcome-character.dc.html'))({});
ok(m2.renderVals().welcome, 'M2 welcome'); m2.renderVals().start(); ok(m2.renderVals().tour, 'M2 tour'); steps.push(1);

const m3 = new (load('M3-my.dc.html'))({});
ok(m3.renderVals().s2 && m3.renderVals().boxBottom === '66px', 'M3 start'); steps.push(m3.renderVals().progN);
m3.renderVals().toHelper(); ok(m3.renderVals().helper && m3.renderVals().boxBottom === '132px', 'M3 helper leaves room for nav bubble'); steps.push(m3.renderVals().progN);

const m4 = new (load('M4-leads.dc.html'))({});
steps.push(m4.renderVals().progN); m4.renderVals().toggle(); ok(m4.renderVals().s6, 'M4 card step'); steps.push(m4.renderVals().progN);

const m5 = new (load('M5-detail.dc.html'))({});
fakeScroll(m5);
let v = m5.renderVals();
ok(v.read && !v.accStep && v.progN === 6, 'M5 starts reading the request sheet');
v.onScroll(); ok(m5.renderVals().read, 'M5 stays on read before scrolling');
m5.box.scrollTop = 1200; v.onScroll(); ok(m5.renderVals().accStep, 'M5 scrolled to accept');
steps.push(m5.renderVals().progN);
m5.renderVals().accept(); ok(m5.renderVals().sheet, 'M5 sheet'); steps.push(m5.renderVals().progN);
m5.renderVals().cancelSheet(); ok(m5.renderVals().accStep, 'M5 cancel returns to accept');
m5.renderVals().accept(); m5.renderVals().confirm(); ok(m5.renderVals().accepted && !m5.renderVals().pending, 'M5 accepted'); steps.push(m5.renderVals().progN);
const m5b = new (load('M5-detail.dc.html'))({});
m5b.renderVals().accept(); ok(m5b.renderVals().sheet, 'M5 accept works without scrolling too');

const m7 = new (load('M7-terms.dc.html'))({});
fakeScroll(m7);
ok(m7.renderVals().read, 'M7 read'); m7.box.scrollTop = 1200; m7.renderVals().onScroll(); ok(m7.renderVals().sendStep, 'M7 scrolled to send');
steps.push(m7.renderVals().progN); m7.renderVals().send(); ok(m7.renderVals().sent && !m7.renderVals().editing, 'M7 sent');

const m8 = new (load('M8-start.dc.html'))({});
fakeScroll(m8);
ok(m8.renderVals().read && m8.renderVals().ready, 'M8 read'); m8.box.scrollTop = 1200; m8.renderVals().onScroll(); ok(m8.renderVals().startStep, 'M8 scrolled to start');
steps.push(m8.renderVals().progN); m8.renderVals().openSheet(); steps.push(m8.renderVals().progN);
m8.renderVals().start(); ok(m8.renderVals().started, 'M8 started'); steps.push(m8.renderVals().progN);

const m9 = new (load('M9-result.dc.html'))({});
fakeScroll(m9);
ok(m9.renderVals().onPick, 'M9 pick'); steps.push(m9.renderVals().progN);
m9.renderVals().pickFAILURE(); v = m9.renderVals();
ok(v.onForm && v.kindLabel === '실패' && v.noteLabel === '실패 사유' && v.evTag === '*' && !v.showSeats && v.blockNote !== '', 'M9 failure screen');
v.submit(); ok(!m9.renderVals().done, 'M9 failure blocked without file');
m9.renderVals().backToPick(); ok(m9.renderVals().onPick, 'M9 back');
m9.renderVals().pickPARTIAL(); v = m9.renderVals(); ok(v.kindLabel === '부분 성공' && v.showSeats && v.evTag === '선택', 'M9 partial screen');
m9.renderVals().backToPick(); m9.renderVals().pickSUCCESS(); steps.push(m9.renderVals().progN);
m9.renderVals().attach(); timers.splice(0).forEach((fn) => fn()); ok(m9.box.scrollTop === 1480, 'M9 scrolls to submit after attach ' + m9.box.scrollTop);
steps.push(m9.renderVals().progN); ok(m9.renderVals().s15, 'M9 s15');
m9.renderVals().submit(); ok(m9.renderVals().done, 'M9 done');
ok(steps.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15', 'guided steps ' + steps.join(','));

// ── 혼자 해 보기: 전 과정 ──
const C = load('M6-practice.dc.html');
const c = new C({});
c.boxRef({ scrollTop: 500 });
const p = () => c.renderVals();
ok(p().onMain && p().stageN === 1 && p().mission === '도우미로 바꿔 보세요', 'start on main');
p().toMy(); ok(p().onMy && c.box.scrollTop === 0, 'my, scrolled to top');
p().toHelper(); ok(p().helper && p().mission === '받은 요청으로 가 보세요', 'helper');
p().toLeads(); ok(p().onLeads && p().off && p().pendingCount === 0, 'leads empty while off');
p().toggleOn(); ok(p().on && p().pendingCount === 1 && p().stageN === 2, 'on shows request');
p().openDetail(); v = p();
ok(v.onDetail && v.actPending && v.badgeText === '도우미 응답 대기' && v.showRequest && v.contactsHidden && v.prog0 && v.crumb === '받은 요청', 'detail pending');
p().tryReject(); ok(p().rejectNote, 'reject nudge');
c.box.scrollTop = 900; p().openAccept(); ok(p().onAcceptSheet && c.box.scrollTop === 900, 'accept sheet keeps scroll');
p().confirmAccept(); v = p();
ok(v.actAccepted && v.stageN === 3 && v.crumb === '매칭 관리' && v.contactsShown && v.prog1 && v.balance === 9 && c.box.scrollTop === 900, 'accepted in place');
p().toTerms(); ok(p().onTerms && p().total === '—' && c.box.scrollTop === 0, 'terms empty, top');
p().sendTerms(); ok(p().termsErr && p().termsErrText === '빈칸을 모두 채워 주세요.' && p().seatStyle.includes('#D92D20') && p().refundStyle.includes('#D92D20'), 'empty terms blocked');
p().setSeat(ev('2층 앞열 1매')); p().setCond(ev('2층 5열 이내')); p().setMethod(ev('PC 1대'));
p().setUpfront(ev('만원')); p().setSuccess(ev('20000')); p().setRefund(ev('수고비 전액 환불')); p().setDeadline(ev('30분 이내'));
ok(!p().seatStyle.includes('#D92D20'), 'filled field not red');
p().pickDirect(); p().sendTerms(); v = p();
ok(v.termsErr && v.termsErrText === '혼자 해 보기에서는 안전거래를 골라 주세요.' && v.onTerms && v.total === '직접 정산' && v.feeShown === '0원', 'direct blocked');
p().pickSafe(); v = p(); ok(v.total === '21,000원' && v.feeShown === '1,000원', 'safe total with free-text upfront ' + v.total);
p().sendTerms(); v = p();
ok(v.onDetail && v.actSent && v.showProposed && !v.showRequest && v.idle && v.badgeText === '최종 조건 확인 대기' && v.prog2 && v.noteV === '미입력', 'sent detail');
p().skipTime(); v = p();
ok(v.actReady && v.stageN === 4 && v.showFinal && v.showPayment && v.payTotal === '21,000원' && v.finalized && v.prog4, 'ready');
p().openStart(); ok(p().onStartSheet, 'start sheet');
p().closeSheet(); ok(p().actReady && !p().onStartSheet, 'close start sheet');
p().openStart(); p().confirmStart(); v = p(); ok(v.actStarted && v.stageN === 5 && v.badgeText === '예매 진행 중', 'started');
p().toResultPick(); ok(p().onResultPick && !p().onResult, 'result pick');
p().pickFAILURE(); v = p(); ok(v.onResult && v.kindLabel === '실패' && v.submitBlocked && !v.showSeats && v.evTag === '*', 'failure screen');
p().submitResult(); ok(p().onResult && !p().resultErr, 'blocked submit does nothing');
p().attach(); ok(!p().submitBlocked, 'file unblocks');
p().submitResult(); ok(p().resultErr && p().resultNoteStyle.includes('#D92D20'), 'note required');
p().backToPick(); p().pickPARTIAL(); v = p(); ok(v.kindLabel === '부분 성공' && !v.file && !v.resultErr && v.showSeats, 'partial resets');
p().backToPick(); p().pickSUCCESS(); p().setResultNote(ev('예매했어요')); p().submitResult(); ok(p().onDone && !p().showNav, 'done without optional evidence');

console.log(process.exitCode ? 'some checks failed' : 'all checks passed', '| guided steps', steps.join(','));

const m11 = new (load('M11-apply.dc.html'))({}); ok(m11.renderVals().ready, 'M11 ready'); m11.renderVals().apply(); ok(m11.renderVals().applied && !m11.renderVals().ready, 'M11 applied');
console.log(process.exitCode ? 'M11 failed' : 'M11 ok');
