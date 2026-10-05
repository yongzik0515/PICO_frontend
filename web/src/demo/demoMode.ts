// 데모 모드: 백엔드(특히 결제) 없이 안전거래 플로우 화면을 클릭만으로 둘러보기 위한 개발 전용 목업.
//
// 끄고 켜기:
//   - 주소에 ?demo=1 → 켜짐(이후 저장됨), ?demo=0 → 꺼짐
//   - 콘솔: localStorage.setItem('pico_demo','1') 후 새로고침
//   - 화면 우하단 배지의 "데모 초기화"로 진행 상태를 처음으로 되돌림
//
// 동작: 거래 흐름·도우미 신청(본인인증·정산계좌) 관련 API만 가짜 응답으로 가로채고
//       (진행 상태는 dev 서버 /__demo/state에 저장 → 이용자·도우미가 공유, 실패 시 localStorage 폴백),
//       그 외(로그인·목록·프로필 등)는 실제 백엔드로 그대로 보낸다. import.meta.env.DEV 에서만 설치된다.
//
// 지우는 법: main.tsx의 installDemoMode() 호출과 이 파일(src/demo/)을 삭제하면 끝. 실제 로직엔 영향 없음.

type DemoStage = 'payment' | 'ready' | 'in_progress' | 'result_submitted' | 'disputed' | 'completed' | 'completed_partial';
type DemoResult = 'SUCCESS' | 'PARTIAL' | 'FAILURE';
type DemoMessage = { id: number; kind: string; body: string; createdAt: string; attachments: unknown[] };
type DemoEntry = { stage: DemoStage; result?: DemoResult; messages?: DemoMessage[]; successFee?: number; upfront?: number; ordered?: boolean;
  // 도우미가 등록한 결과 설명·확보 내용, 이용자 후기(삭제해도 reviewWritten은 남아 다시 쓸 수 없다)
  resultNote?: string; resultOutcome?: string; reviewData?: Record<string, unknown> | null; reviewWritten?: boolean;
  // 올린 파일 정보(업로드 키별)와 제출한 시도·결과 증빙. 파일 본문은 dev 서버 /__demo/file/{key}에 있다.
  fileMeta?: Record<string, { name: string; mime: string; size: number }>; attemptEvidences?: DemoEvidence[]; resultEvidences?: DemoEvidence[] };
type DemoEvidence = Record<string, unknown> & { evidenceId: number; status: string };
// 'agent' 키에 저장하는 도우미 신청 데모 상태(계좌 인증·심사중·승인). DemoEntry와 같은 저장소를 쓴다.
type AgentEntry = {
  payoutVerified?: boolean; payoutMasked?: string; approved?: boolean; review?: boolean;
  // 운영팀 심사 결과(데모): 보완 요청(사유 + 고칠 항목) · 반려(사유). 실제 백엔드는 승인/미승인만 있다(USER_FLOW.md 11번).
  changes?: { note: string; fields: string[] } | null; rejected?: { note: string } | null;
  // 공개 설정(활동 중): 목록 공개 · 새 요청 받기
  listed?: boolean; acceptsRequests?: boolean;
};

const FLAG = 'pico_demo';
const STATE = 'pico_demo_state'; // localStorage 폴백용(서버 공유 상태를 못 쓸 때)

// 진행 상태는 dev 서버(/__demo/state)에 저장해 이용자·도우미(다른 브라우저/프로필)가 공유한다.
// 서버에 못 붙으면 localStorage로 폴백한다(단일 브라우저에서만 공유됨).
let rawFetch: typeof fetch = fetch;

function enabled(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('demo');
    if (q === '1') localStorage.setItem(FLAG, '1');
    if (q === '0') localStorage.removeItem(FLAG);
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

function localRead(): Record<string, DemoEntry> {
  try {
    return JSON.parse(localStorage.getItem(STATE) || '{}');
  } catch {
    return {};
  }
}
function localWrite(s: Record<string, DemoEntry>) {
  try {
    localStorage.setItem(STATE, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

async function readState(): Promise<Record<string, DemoEntry>> {
  try {
    const r = await rawFetch('/__demo/state');
    if (r.ok) return (await r.json()) as Record<string, DemoEntry>;
  } catch {
    /* 서버 공유 실패 → 폴백 */
  }
  return localRead();
}

async function setStage(rid: string | undefined, stage: DemoStage, result?: DemoResult) {
  if (!rid) return;
  try {
    await rawFetch('/__demo/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rid, stage, result }) });
    return;
  } catch {
    /* 폴백 */
  }
  const s = localRead();
  s[rid] = { ...s[rid], stage, result: result ?? s[rid]?.result };
  localWrite(s);
}

async function addMessage(rid: string | undefined, msg: DemoMessage) {
  if (!rid) return;
  try {
    await rawFetch('/__demo/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rid, addMessage: msg }) });
    return;
  } catch {
    /* 폴백 */
  }
  const s = localRead();
  const prev = s[rid] ?? ({ stage: 'disputed' } as DemoEntry);
  s[rid] = { ...prev, messages: [...(prev.messages ?? []), msg] };
  localWrite(s);
}

async function setFields(rid: string | undefined, fields: Partial<DemoEntry & AgentEntry>) {
  if (!rid) return;
  try {
    await rawFetch('/__demo/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rid, ...fields }) });
    return;
  } catch {
    /* 폴백 */
  }
  const s = localRead();
  s[rid] = { ...s[rid], ...fields } as DemoEntry & AgentEntry;
  localWrite(s);
}

async function resetState() {
  try {
    await rawFetch('/__demo/state', { method: 'DELETE' });
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(STATE);
  } catch {
    /* ignore */
  }
}

const ridInUrl = () => location.pathname.match(/requests\/(\d+)/)?.[1];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: status < 400, data }), { status, headers: { 'Content-Type': 'application/json' } });

// 거래 상세(GET /api/requests/{id})에 덮어쓸 필드
function patchRequest(data: Record<string, unknown>, entry: DemoEntry) {
  const r = entry.result ?? 'SUCCESS';
  const base = { paymentStatus: 'PAID' } as Record<string, unknown>;
  const map: Record<DemoStage, Record<string, unknown>> = {
    // 가상계좌를 발급했으면(ordered) 입금 대기 주문을 내려 준다.
    payment: { stage: 'PAYMENT_WAITING', status: 'MATCHED', paymentStatus: entry.ordered ? 'PENDING' : '', paymentId: entry.ordered ? 990000 : undefined },
    ready: { ...base, stage: 'READY_TO_START', status: 'MATCHED', agentResult: null },
    in_progress: { ...base, stage: 'IN_PROGRESS', status: 'IN_PROGRESS', agentResult: null },
    result_submitted: { ...base, stage: 'RESULT_CONFIRMATION', status: 'IN_PROGRESS', agentResult: r },
    disputed: { ...base, stage: 'DISPUTED', status: 'DISPUTED', agentResult: r, disputeNote: '결과에 이의를 제기했어요(데모).' },
    // 이용자 승: 실패로 확정 → 성공보수 환불(착수비·이용료는 환불 안 됨)
    completed: { ...base, stage: 'COMPLETED', status: 'COMPLETED', agentResult: r, requesterResult: r, finalResult: r },
    // 부분 성공으로 확정 → 성공보수를 도우미 몫/이용자 환불로 나눔
    completed_partial: { paymentStatus: 'PARTIALLY_REFUNDED', stage: 'COMPLETED', status: 'COMPLETED', agentResult: 'PARTIAL', requesterResult: 'PARTIAL', finalResult: 'PARTIAL' },
  };
  Object.assign(data, map[entry.stage]);
  if (entry.resultNote) data.agentResultNote = entry.resultNote;
  if (entry.resultOutcome) data.agentActualOutcomeDescription = entry.resultOutcome;
  if (entry.reviewWritten) data.reviewWritten = true;
}

export function installDemoMode() {
  // DEV가 아니거나 플래그가 꺼져 있으면 아무것도 하지 않는다.
  if (!import.meta.env.DEV || !enabled()) return;
  const w = window as unknown as { __picoDemo?: boolean };
  if (w.__picoDemo) return;
  w.__picoDemo = true;

  const real = window.fetch.bind(window);
  rawFetch = real; // 공유 상태 조회/저장은 가로채지 않은 원본 fetch로 한다.

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const req = input instanceof Request ? input : null;
    const url = req ? req.url : String(input);
    const method = (req ? req.method : init?.method || 'GET').toUpperCase();
    let path = url;
    try {
      path = new URL(url, location.origin).pathname;
    } catch {
      /* keep raw */
    }
    const body = async (): Promise<Record<string, unknown>> => {
      try {
        if (req) return await req.clone().json();
        if (typeof init?.body === 'string') return JSON.parse(init.body);
      } catch {
        /* ignore */
      }
      return {};
    };
    const rid = ridInUrl();

    // 가짜 파일 업로드 대상: 실제로 올리지 않는다.
    if (url.startsWith('https://pico-demo.invalid/')) return new Response(null, { status: 200 });

    // ── 결제 ──────────────────────────────────────────────
    if (method === 'POST' && /\/api\/agreements\/\d+\/safe-payment$/.test(path)) {
      await setFields(rid, { stage: 'payment', ordered: true });
      return json({ paymentId: 990000, status: 'PENDING' });
    }
    if (method === 'GET' && /\/api\/payments\/\d+\/virtual-account$/.test(path))
      return json({ bankName: '데모은행', accountNumber: '000-데모-000000', accountHolder: '피코(데모)', depositDueAt: new Date(Date.now() + 2 * 86400000).toISOString() });
    if (method === 'POST' && /\/api\/payments\/\d+\/confirm$/.test(path)) {
      await setFields(rid, { stage: 'ready', ordered: false });
      return json({ status: 'PAID' });
    }
    if (method === 'POST' && /\/api\/payments\/\d+\/cancel$/.test(path)) {
      if (rid && (await readState())[rid]?.stage === 'payment') await setFields(rid, { ordered: false });
      return json({ status: 'CANCELLED' });
    }

    // ── 착수 · 결과 ───────────────────────────────────────
    if (method === 'POST' && /\/api\/requests\/\d+\/start$/.test(path)) {
      await setStage(rid, 'in_progress');
      return json({});
    }
    if (method === 'POST' && /\/api\/requests\/\d+\/result$/.test(path)) {
      const b = await body();
      await setFields(rid, { stage: 'result_submitted', result: (b.result as DemoResult) || 'SUCCESS', resultNote: String(b.note ?? ''), resultOutcome: String(b.actualOutcomeDescription ?? '') });
      return json({});
    }
    if (method === 'POST' && /\/api\/requests\/\d+\/result\/confirm$/.test(path)) {
      const b = await body();
      await setStage(rid, b.agreed === false ? 'disputed' : 'completed'); // 이의 제기 → 분쟁 단계
      return json({});
    }
    // 이의 철회 → 도우미가 등록한 결과로 확정(완료)
    if (method === 'POST' && /\/api\/requests\/\d+\/dispute\/withdraw$/.test(path)) {
      await setStage(rid, 'completed');
      return json({});
    }
    // 분쟁 소명 메시지: 조회 · 제출
    if (method === 'GET' && rid && /\/api\/requests\/\d+\/dispute\/messages$/.test(path)) {
      const entry = (await readState())[rid];
      return json(entry?.messages ?? []);
    }
    if (method === 'POST' && /\/api\/requests\/\d+\/dispute\/messages$/.test(path)) {
      const b = await body();
      // 첨부: 업로드 때 기록해 둔 파일 정보로 목록을 만든다(파일 본문은 dev 서버 /__demo/file/{key}).
      const meta = rid ? (await readState())[rid]?.fileMeta : undefined;
      const attachments = ((b.storageKeys as string[] | undefined) ?? []).map((k, i) => ({ attachmentId: i + 1, originalName: meta?.[k]?.name ?? k, mimeType: meta?.[k]?.mime ?? '', url: '/__demo/file/' + encodeURIComponent(k) }));
      const msg = { id: Date.now(), kind: 'STATEMENT', body: String(b.body ?? ''), createdAt: new Date().toISOString(), attachments };
      await addMessage(rid, msg);
      return json(msg);
    }
    // 운영팀 조정은 데모에서 없음으로 둔다(관리자 영역).
    if (method === 'GET' && /\/api\/requests\/\d+\/mediation$/.test(path)) return json({ status: 'NONE' });

    // 부분 성공 정산: 완료(부분) 상태에서 "도우미는 착수비만, 성공보수는 전액 환불"로 확정된 모습을 보여 준다.
    if (method === 'GET' && rid && /\/api\/requests\/\d+\/partial-settlement$/.test(path)) {
      const entry = (await readState())[rid];
      if (entry?.stage !== 'completed_partial') return json({ status: 'NOT_PROPOSED' });
      const fee = entry.successFee ?? 7000;
      return json({
        status: 'ADMIN_DECIDED',
        round: 1,
        proposedAmountKrw: 0,
        decidedAmountKrw: 0, // 도우미 성공보수 몫 0
        refundAmountKrw: fee, // 성공보수 전액 이용자 환불
        decisionNote: '운영팀 조정 결과: 도우미는 착수비만 받고, 성공보수는 전액 이용자에게 환불돼요.',
        decidedAt: new Date().toISOString(),
        paymentId: 990000,
        mediationStatus: 'NONE',
      });
    }
    // 환불 내역: 완료(부분)·완료(실패)일 때 성공보수 환불 완료 행을 보여 준다(착수비는 도우미 몫이라 환불 없음).
    if (method === 'GET' && rid && /\/api\/payments\/\d+\/refunds$/.test(path)) {
      const entry = (await readState())[rid];
      const refundable = entry?.stage === 'completed_partial' || (entry?.stage === 'completed' && entry.result === 'FAILURE');
      if (!refundable) return json([]);
      const fee = entry?.successFee ?? 7000;
      return json([{ component: 'SUCCESS', status: 'SUCCEEDED', amountKrw: fee, requestedAt: new Date().toISOString(), completedAt: new Date().toISOString() }]);
    }
    if (method === 'POST' && (/\/api\/requests\/\d+\/attempt-evidences$/.test(path) || /\/api\/requests\/\d+\/result\/evidence$/.test(path))) {
      const attempt = path.endsWith('/attempt-evidences');
      const b = await body();
      const keys = attempt ? ((b.attachments as { storageKey: string }[] | undefined) ?? []).map((x) => x.storageKey) : ((b.storageKeys as string[] | undefined) ?? []);
      const entry = rid ? (await readState())[rid] : undefined;
      const prev = (attempt ? entry?.attemptEvidences : entry?.resultEvidences) ?? [];
      const evidence: DemoEvidence = {
        evidenceId: Date.now(), requestId: Number(rid), purpose: attempt ? 'ATTEMPT_EVIDENCE' : 'RESULT', revision: prev.length + 1, status: 'SUBMITTED',
        description: b.description ?? null, submittedAt: new Date().toISOString().slice(0, 19),
        attachments: keys.map((k, i) => {
          const m = entry?.fileMeta?.[k];
          return { attachmentId: i + 1, originalName: m?.name ?? k, mimeType: m?.mime ?? '', sizeBytes: m?.size ?? 0, sortOrder: i, scanStatus: 'CLEAN', url: '/__demo/file/' + encodeURIComponent(k) };
        }),
      };
      await setFields(rid, attempt ? { attemptEvidences: [...prev, evidence] } : { resultEvidences: [...prev, evidence] });
      return json(evidence);
    }
    if (method === 'GET' && rid && (/\/api\/requests\/\d+\/attempt-evidences$/.test(path) || /\/api\/requests\/\d+\/result\/evidence$/.test(path))) {
      const entry = (await readState())[rid];
      const saved = path.endsWith('/attempt-evidences') ? entry?.attemptEvidences : entry?.resultEvidences;
      if (saved) return json(saved);
    }
    // 이용자의 시도 증빙 승인·반려
    const review = path.match(/\/api\/attempt-evidences\/(\d+)\/(approve|reject)$/);
    if (method === 'POST' && rid && review) {
      const entry = (await readState())[rid];
      if (entry?.attemptEvidences) {
        const b = await body();
        const attemptEvidences = entry.attemptEvidences.map((e) =>
          e.evidenceId === Number(review[1]) ? { ...e, status: review[2] === 'approve' ? 'APPROVED' : 'REJECTED', reviewNote: b.reviewNote ?? null, reviewedAt: new Date().toISOString().slice(0, 19) } : e,
        );
        await setFields(rid, { attemptEvidences });
        return json(attemptEvidences.find((e) => e.evidenceId === Number(review[1])));
      }
    }
    // 후기: 작성한 내용을 저장해 상세에서 보여 주고, 같은 거래에 다시 쓰지 못하게 한다(거래당 1개, 삭제 후에도 재작성 불가).
    if (method === 'POST' && /\/api\/requests\/\d+\/review$/.test(path)) {
      if (rid && (await readState())[rid]?.reviewWritten) return new Response(JSON.stringify({ success: false, message: '이 거래의 후기는 이미 작성했어요.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      const b = await body();
      const reviewData = { requestId: Number(rid), rating: Number(b.rating) || 5, comment: b.comment ?? null, imageUrl: null, status: 'VISIBLE', reviewedAt: new Date().toISOString().slice(0, 19), bookingResult: b.bookingResult ?? null };
      await setFields(rid, { reviewData, reviewWritten: true });
      return json(reviewData);
    }
    if (rid && /\/api\/requests\/\d+\/review$/.test(path) && (method === 'GET' || method === 'DELETE')) {
      const entry = (await readState())[rid];
      if (entry?.reviewWritten) {
        if (method === 'DELETE') {
          await setFields(rid, { reviewData: null });
          return json({});
        }
        return entry.reviewData ? json(entry.reviewData) : json(null, 404);
      }
    }

    // ── 도우미 신청: 본인인증 · 정산 계좌 (데모) ──────────────
    // 본인인증은 완료로 간주(포트원 인증창 없이). 계좌는 입력 → 확인 → 등록완료가 되게 한다.
    if (method === 'GET' && /\/api\/me\/identity$/.test(path)) return json({ verified: true });
    if (method === 'POST' && /\/api\/me\/identity\/(verification-session|verify)$/.test(path))
      return json({ verified: true, identityVerificationId: 'demo', storeId: 'demo', channelKey: 'demo' });
    if (method === 'GET' && /\/api\/me\/payout-account$/.test(path)) {
      const ag = (await readState())['agent'] as { payoutVerified?: boolean; payoutMasked?: string } | undefined;
      return ag?.payoutVerified ? json({ verified: true, masked: ag.payoutMasked }) : json({ verified: false });
    }
    if (method === 'PUT' && /\/api\/me\/payout-account$/.test(path)) {
      const b = await body();
      const acct = String(b.accountNumber ?? '');
      const masked = acct ? `****${acct.slice(-4)}` : '****';
      await setFields('agent', { payoutVerified: true, payoutMasked: masked });
      return json({ verified: true, masked });
    }
    // 사업자번호 저장 · 심사 제출(데모): 503 없이 통과시킨다.
    if (method === 'PUT' && /\/api\/me\/agent\/profiles\/\d+\/business$/.test(path)) return json({});
    if (method === 'POST' && /\/api\/me\/agent\/profiles\/\d+\/submit$/.test(path)) {
      await setFields('agent', { review: true, approved: false, changes: null, rejected: null });
      return json({ status: 'IN_REVIEW' });
    }

    if (method === 'PUT' && path === '/api/me/agent/visibility') {
      const ag = (await readState())['agent'] as AgentEntry | undefined;
      if (ag?.approved) {
        const b = await body();
        await setFields('agent', { listed: !!b.listed, acceptsRequests: !!b.acceptsRequests });
        return json({ listed: !!b.listed, acceptsRequests: !!b.acceptsRequests });
      }
    }
    if (method === 'GET' && path === '/api/me') {
      const ag = (await readState())['agent'] as AgentEntry | undefined;
      if (ag?.approved && ag.listed !== undefined) {
        const res = await real(input, init);
        const b = await res.clone().json().catch(() => null);
        if (!b?.data) return res;
        return json({ ...b.data, isListed: ag.listed, acceptsRequests: ag.acceptsRequests });
      }
    }

    // 도우미 신청 현황: 제출(심사중=IN_REVIEW) 또는 운영팀 승인(PUBLISHED) 상태로 프로필 목록을 바꿔 현황 페이지를 보여 준다.
    if (method === 'GET' && /\/api\/me\/agent\/profiles$/.test(path)) {
      const ag = (await readState())['agent'] as AgentEntry | undefined;
      const want = ag?.approved ? 'PUBLISHED' : ag?.changes ? 'CHANGES_REQUESTED' : ag?.rejected ? 'REJECTED' : ag?.review ? 'IN_REVIEW' : null;
      const reviewNote = ag?.changes?.note ?? ag?.rejected?.note ?? null;
      const changeFields = ag?.changes?.fields ?? [];
      if (!want) return real(input, init);
      const res = await real(input, init);
      const b = await res.clone().json().catch(() => null);
      let arr = Array.isArray(b?.data) ? b.data : Array.isArray(b?.data?.content) ? b.data.content : [];
      if (!arr || arr.length === 0) {
        arr = [
          {
            profileId: 70001, id: 70001, version: 1, status: want,
            activityName: '데모 도우미', headline: '티켓팅 도와드려요', bio: '데모용 공개 프로필이에요.',
            primaryCategory: 'CONCERT', categories: [{ category: 'CONCERT' }], platforms: [],
            submittedAt: new Date().toISOString(), upfrontFeeKrw: 2000, successFeeMin: 5000, successFeeMax: 10000,
            listed: want === 'PUBLISHED', acceptsRequests: want === 'PUBLISHED', reviewNote, changeFields,
          },
        ];
      } else {
        arr.forEach((p: Record<string, unknown>) => Object.assign(p, { status: want, reviewNote, changeFields }));
      }
      return json(arr);
    }

    // 업로드 URL 발급: 데모 전용 가짜 주소
    if (method === 'POST' && /\/api\/(files|evidence-files)\/upload-url$/.test(path)) {
      const b = await body();
      const key = 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      if (rid) {
        const entry = (await readState())[rid];
        await setFields(rid, { fileMeta: { ...entry?.fileMeta, [key]: { name: String(b.originalName ?? key), mime: String(b.mimeType ?? ''), size: Number(b.sizeBytes) || 0 } } });
      }
      return json({ uploadUrl: '/__demo/file/' + encodeURIComponent(key), method: 'PUT', requiredHeaders: {}, storageKey: key });
    }

    // ── 조회 결과 덮어쓰기(실제 응답을 받아 단계만 바꾼다) ──
    // 내 활동 등 요청 목록: 데모로 진행한 요청은 상세와 같은 단계로 보이게 한다.
    if (method === 'GET' && path === '/api/requests') {
      const state = await readState();
      const res = await real(input, init);
      const b = await res.clone().json().catch(() => null);
      const items = Array.isArray(b?.data) ? b.data : Array.isArray(b?.data?.items) ? b.data.items : Array.isArray(b?.data?.content) ? b.data.content : null;
      if (!items) return res;
      for (const item of items as Record<string, unknown>[]) {
        const entry = state[String(item.requestId ?? item.id)];
        if (entry?.stage) patchRequest(item, entry);
      }
      return json(b.data);
    }
    if (method === 'GET' && rid && new RegExp(`/api/requests/${rid}$`).test(path)) {
      const entry = (await readState())[rid];
      if (!entry?.stage) return real(input, init); // 파일 정보만 있는 항목은 단계를 덮어쓰지 않는다
      const res = await real(input, init);
      const b = await res.clone().json().catch(() => null);
      if (b?.data) patchRequest(b.data, entry);
      return json(b?.data ?? {});
    }
    if (method === 'GET' && rid && new RegExp(`/api/requests/${rid}/agreements$`).test(path)) {
      const entry = (await readState())[rid];
      if (!entry?.stage) return real(input, init); // 파일 정보만 있는 항목은 단계를 덮어쓰지 않는다
      const res = await real(input, init);
      const b = await res.clone().json().catch(() => null);
      const arr = Array.isArray(b?.data) ? b.data : Array.isArray(b?.data?.content) ? b.data.content : null;
      if (arr) {
        const paying = entry.stage === 'payment';
        const ordered = paying && !!entry.ordered;
        arr.forEach((a: Record<string, unknown>) =>
          Object.assign(a, { status: 'FINALIZED', safePayment: true, paymentStatus: paying ? (ordered ? 'PENDING' : '') : 'PAID', paymentId: paying && !ordered ? a.paymentId : (a.paymentId ?? 990000) }),
        );
        // 환불·정산 금액 표시에 쓰려고 성공보수·착수비를 공유 상태에 저장해 둔다.
        const latest = [...arr].sort((x, y) => (Number(y.version) || 0) - (Number(x.version) || 0))[0] as Record<string, unknown> | undefined;
        const sf = Number(latest?.successFeeKrw);
        const uf = Number(latest?.upfrontFeeKrw);
        if ((Number.isFinite(sf) && sf !== entry.successFee) || (Number.isFinite(uf) && uf !== entry.upfront))
          void setFields(rid, { successFee: Number.isFinite(sf) ? sf : entry.successFee, upfront: Number.isFinite(uf) ? uf : entry.upfront });
      }
      return json(b?.data ?? []);
    }

    return real(input, init);
  };

  badge();
}

// 화면 우하단 데모 배지 + 상태 점프 버튼. /requests/{id} 화면에서 원하는 단계로 바로 이동할 수 있다.
function badge() {
  const el = document.createElement('div');
  // 휴대폰(767px 이하): 하단 탭바·도우미 프로필의 하단 요청 바를 가리지 않게 헤더(64px) 바로 아래에 띄우고,
  // 처음엔 '● 데모'만 보이게 접어 둔다(누르면 버튼이 펼쳐진다).
  const phone = matchMedia('(max-width:767px)').matches;
  el.style.cssText = 'position:fixed;right:12px;' + (phone ? 'top:72px' : 'bottom:12px') + ';z-index:99999;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:min(92vw,560px);justify-content:flex-end;background:#111;color:#fff;font:12px/1.4 system-ui;padding:8px 10px;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.35);opacity:.95';
  const label = document.createElement('span');
  label.textContent = '● 데모';
  label.style.cssText = 'font-weight:700';
  el.append(label);

  const mkBtn = (text: string, bg: string, on: () => void) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = `all:unset;cursor:pointer;background:${bg};color:#111;padding:3px 9px;border-radius:999px;font-weight:600`;
    b.onclick = on;
    return b;
  };

  // 라우트가 바뀔 때마다 다시 그리는 버튼 영역(요청 상세에서만 점프 버튼 표시).
  const area = document.createElement('span');
  area.style.cssText = 'display:contents';
  el.append(area);
  if (phone) {
    area.style.display = 'none';
    label.textContent = '● 데모 ▸';
    label.style.cursor = 'pointer';
    label.onclick = () => {
      const open = area.style.display === 'none';
      area.style.display = open ? 'contents' : 'none';
      label.textContent = open ? '● 데모 ▾' : '● 데모 ▸';
    };
  }

  const render = () => {
    area.textContent = '';
    const rid = ridInUrl();
    if (rid) {
      const jump = (stage: DemoStage, result?: DemoResult) => () => void setStage(rid, stage, result).finally(() => location.reload());
      const steps: [string, DemoStage, DemoResult?][] = [
        ['결제완료', 'ready'],
        ['진행중', 'in_progress'],
        ['결과:성공', 'result_submitted', 'SUCCESS'],
        ['결과:부분', 'result_submitted', 'PARTIAL'],
        ['결과:실패', 'result_submitted', 'FAILURE'],
        ['분쟁', 'disputed', 'FAILURE'],
        ['부분정산', 'completed_partial'],
        ['이용자승(실패환불)', 'completed', 'FAILURE'],
        ['완료:성공', 'completed', 'SUCCESS'],
      ];
      const sep = document.createElement('span');
      sep.textContent = `요청 ${rid} →`;
      sep.style.cssText = 'opacity:.7';
      area.append(sep);
      steps.forEach(([t, s, r]) => area.append(mkBtn(t, '#e9eefc', jump(s, r))));
    }
    // 도우미 신청 현황(어느 화면에서나): 심사중 / 승인
    area.append(mkBtn('신청 제출(심사중)', '#fdeecf', () => void setFields('agent', { review: true, approved: false }).finally(() => location.reload())));
    area.append(mkBtn('도우미 승인', '#d7f5e3', () => void setFields('agent', { approved: true, changes: null, rejected: null }).finally(() => location.reload())));
    area.append(
      mkBtn('보완 요청', '#fff1d6', () =>
        void setFields('agent', {
          approved: false, review: true, rejected: null,
          changes: { note: '한 줄 소개가 짧아 어떤 도움을 주는지 알기 어려워요. 경력 자료에는 예매 완료 화면과 날짜가 함께 보이게 다시 첨부해 주세요.', fields: ['headline', 'career'] },
        }).finally(() => location.reload()),
      ),
    );
    area.append(
      mkBtn('반려', '#fde2e2', () =>
        void setFields('agent', { approved: false, review: true, changes: null, rejected: { note: '제출한 경력 자료로 예매 대행 경험을 확인할 수 없어 승인하지 않았어요. 활동 기준에 맞는 자료를 준비해 새로 신청해 주세요.' } }).finally(() => location.reload()),
      ),
    );
    area.append(mkBtn('초기화', '#fff', () => void resetState().finally(() => location.reload())));
  };

  // SPA 라우트 변경 감지: history.pushState/replaceState + popstate
  const fire = () => window.dispatchEvent(new Event('pico-demo-nav'));
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<History['pushState']>) {
      const ret = orig.apply(this, args);
      fire();
      return ret;
    } as History[typeof m];
  }
  window.addEventListener('popstate', fire);
  window.addEventListener('pico-demo-nav', render);

  render();
  const mount = () => document.body && document.body.appendChild(el);
  if (document.body) mount();
  else window.addEventListener('DOMContentLoaded', mount);
}
