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
ok(m2.renderVals().tour, 'M2 starts on the tour'); steps.push(1);

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

const m8 = new (load('M8-matched.dc.html'))({});
fakeScroll(m8);
ok(m8.renderVals().read && !m8.renderVals().done, 'M8 starts on confirmed terms'); steps.push(m8.renderVals().progN);
m8.renderVals().onScroll(); ok(m8.renderVals().read, 'M8 stays before scrolling');
m8.box.scrollTop = 1200; m8.renderVals().onScroll(); ok(m8.renderVals().done, 'M8 done after scrolling'); steps.push(m8.renderVals().progN);
ok(steps.join(',') === '1,2,3,4,5,6,7,8,9,10,11', 'guided steps ' + steps.join(','));

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
p().toTerms(); ok(p().onTerms && c.box.scrollTop === 0, 'terms empty, top');
p().sendTerms(); ok(p().termsErr && p().termsErrText === '빈칸을 모두 채워 주세요.' && p().seatStyle.includes('#D92D20') && p().refundStyle.includes('#D92D20'), 'empty terms blocked');
p().setSeat(ev('2층 앞열 1매')); p().setCond(ev('2층 5열 이내'));
p().setUpfront(ev('만원')); p().setSuccess(ev('20000')); p().setRefund(ev('실패하면 수고비는 받지 않아요')); p().setDeadline(ev('30분 이내'));
ok(!p().seatStyle.includes('#D92D20'), 'filled field not red');
v = p(); ok(v.upWon === '0원' && v.suWon === '20,000원', 'fee rows read numbers only ' + v.upWon);
p().sendTerms(); v = p();
ok(v.onDetail && v.actSent && v.showProposed && !v.showRequest && v.idle && v.badgeText === '최종 조건 확인 대기' && v.prog2 && v.noteV === '미입력' && !v.matched, 'sent detail');
p().skipTime(); v = p();
ok(v.matched && v.stageN === 4 && v.showFinal && v.badgeText === '직접 거래 매칭 완료' && v.nextTitle === '직접 거래 매칭을 마쳤어요' && v.contactsShown && !v.actSent && !v.idle, 'matched');
p().finish(); ok(p().onDone && !p().showNav, 'done after matching');

console.log(process.exitCode ? 'some checks failed' : 'all checks passed', '| guided steps', steps.join(','));

const m11 = new (load('M11-apply.dc.html'))({}); ok(m11.renderVals().ready, 'M11 ready'); m11.renderVals().apply(); ok(m11.renderVals().applied && !m11.renderVals().ready, 'M11 applied');
console.log(process.exitCode ? 'M11 failed' : 'M11 ok');

// ── 이용자 함께 해 보기 ──
const ustep = [];
const u1 = new (load('U1-main.dc.html'))({}); ustep.push(u1.renderVals().progN);
const u2 = new (load('U2-profile.dc.html'))({}); fakeScroll(u2);
ok(u2.renderVals().read, 'U2 read'); ustep.push(u2.renderVals().progN);
u2.box.scrollTop = 1200; u2.renderVals().onScroll(); ok(u2.renderVals().tabStep && u2.renderVals().about, 'U2 review tab step after scroll'); ustep.push(u2.renderVals().progN);
u2.renderVals().showReviews(); ok(u2.renderVals().askStep && u2.renderVals().reviews && !u2.renderVals().about, 'U2 reviews shown, ask step'); ustep.push(u2.renderVals().progN);
const u3 = new (load('U3-quote.dc.html'))({}); fakeScroll(u3);
ok(u3.renderVals().read && u3.renderVals().notAgreed, 'U3 read'); ustep.push(u3.renderVals().progN);
u3.renderVals().send(); ok(!u3.renderVals().sent, 'U3 send blocked before agreeing');
u3.box.scrollTop = 1200; u3.renderVals().onScroll(); ok(u3.renderVals().agreeStep, 'U3 agree step'); ustep.push(u3.renderVals().progN);
u3.renderVals().agree(); ok(u3.renderVals().sendStep && u3.renderVals().agreed, 'U3 agreed'); ustep.push(u3.renderVals().progN);
u3.renderVals().send(); ok(u3.renderVals().sent, 'U3 sent'); ustep.push(u3.renderVals().progN);
const u4 = new (load('U4-request.dc.html'))({}); fakeScroll(u4);
ok(u4.renderVals().waiting, 'U4 waiting'); ustep.push(u4.renderVals().progN);
u4.renderVals().arrive(); ok(u4.renderVals().read && u4.renderVals().reviewing, 'U4 terms arrived'); ustep.push(u4.renderVals().progN);
u4.box.scrollTop = 1200; u4.renderVals().onScroll(); ok(u4.renderVals().confirmStep, 'U4 confirm step'); ustep.push(u4.renderVals().progN);
u4.renderVals().openSheet(); ok(u4.renderVals().sheet, 'U4 sheet'); ustep.push(u4.renderVals().progN);
u4.renderVals().closeSheet(); ok(u4.renderVals().confirmStep, 'U4 sheet cancel');
u4.renderVals().openSheet(); u4.renderVals().confirm(); ok(u4.renderVals().matched && !u4.renderVals().reviewing, 'U4 matched'); ustep.push(u4.renderVals().progN);
ok(ustep.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13', 'user steps ' + ustep.join(','));
console.log(process.exitCode ? 'user checks failed' : 'user checks passed', '| user steps', ustep.join(','));

// ── 이용자 혼자 해 보기 ──
const up = new (load('U6-practice.dc.html'))({});
up.boxRef({ scrollTop: 300 });
const q = () => up.renderVals();
ok(q().onMain && q().stageN === 1 && q().mission === '도우미를 골라 보세요', 'U6 main');
q().pickSky(); ok(q().onProfile && q().agentName === '하늘도우미' && q().isSky && q().agentFee === '5,000원', 'U6 sky profile');
q().toMain(); q().pickStar(); ok(q().onProfile && up.box.scrollTop === 0 && q().agentName === '별빛티켓' && q().isStar, 'U6 star profile');
q().toQuote(); ok(q().onQuote && q().stageN === 2, 'U6 quote');
q().sendQuote(); ok(q().quoteErr && q().quoteErrText === '빈칸을 모두 채워 주세요.' && q().titleStyle.includes('#D92D20'), 'U6 empty blocked');
['setTitle', 'setOpen', 'setSite', 'setSeat', 'setCond', 'setPhone'].forEach((k) => q()[k](ev('아무 내용')));
q().sendQuote(); ok(q().quoteErr && q().quoteErrText === '약관에 동의해 주세요.', 'U6 needs agreement');
q().toggleAgree(); q().sendQuote(); ok(q().onSent && !q().showNav, 'U6 sent');
q().toDetail(); v = q(); ok(v.onDetail && v.waiting && v.stageN === 3 && v.badgeText === '도우미 응답 대기' && v.titleV === '아무 내용', 'U6 waiting');
q().skipTime(); v = q(); ok(v.showProposed && v.badgeText === '최종 조건 확인 대기' && !v.waiting, 'U6 terms');
q().tryRevise(); ok(q().reviseNote, 'U6 revise nudge');
q().openConfirm(); ok(q().onConfirmSheet, 'U6 sheet'); q().closeSheet(); ok(!q().onConfirmSheet && q().showProposed, 'U6 sheet cancel');
q().openConfirm(); q().confirmTerms(); v = q(); ok(v.matched && v.stageN === 4 && v.badgeText === '직접 거래 매칭 완료', 'U6 matched');
q().finish(); ok(q().onDone && !q().showNav, 'U6 done');
console.log(process.exitCode ? 'U6 checks failed' : 'U6 checks passed');
