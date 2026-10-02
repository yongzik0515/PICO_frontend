import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { useAuth } from '../auth/AuthContext';
import { fetchDetail, latestAgreement, myUserId, uploadAttemptFile, uploadResultFile, useLoad, type RequestResult } from '../transactions/model';
import { EvidenceFileNames, Field, FilePicker, Notice, Rows, TxCard, useAction, utcToLocal } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';

// 프로토타입 transactions.js의 attachmentPage(). 도우미 전용.
// attempt(시도 증빙): POST /api/files/upload-url(ATTEMPT_EVIDENCE) → 업로드 → POST /api/requests/{id}/attempt-evidences → 이용자 승인
// result(결과): 결과 선택 → 결과별 증빙 → 제출을 한 번에 한다.
//   성공·부분성공: 결과 증빙(선택, /api/evidence-files/upload-url RESULT → POST /result/evidence) → POST /result
//   실패: 최신 시도 증빙이 없으면 먼저 올리고(POST /attempt-evidences) → POST /result
//   분쟁 중에는 결과 증빙만 추가한다.
// 결과 증빙은 운영팀 파일 검토 없이 이용자에게 바로 보인다(차단된 파일만 제외).
const scanNames: Record<string, string> = { PENDING: '이용자에게 공개', CLEAN: '이용자에게 공개', BLOCKED: '차단됨' };

function latestOf(rows: Raw[]) {
  return [...rows].sort((a, b) => (num(pick(b, 'revision')) ?? 0) - (num(pick(a, 'revision')) ?? 0) || String(pick(b, 'submittedAt') ?? '').localeCompare(String(pick(a, 'submittedAt') ?? '')))[0];
}

/** 최신 결과 증빙의 첨부 검사 상태: clean(모두 CLEAN) · pending · blocked · unknown(응답에 검사 상태 없음) */
function scanState(e: Raw | undefined) {
  if (!e) return 'none';
  const files = list(pick(e, 'attachments'));
  const states = files.length ? files.map((f) => str(f.scanStatus) ?? '') : [str(pick(e, 'scanStatus')) ?? ''];
  if (states.some((x) => x === 'BLOCKED')) return 'blocked';
  if (states.every((x) => x === 'CLEAN')) return 'clean';
  if (states.every((x) => !x)) return 'unknown';
  return 'pending';
}

export function EvidencePage({ type }: { type: 'attempt' | 'result' }) {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const { me } = useAuth();
  const isResult = type === 'result';
  // 운영팀 파일 검토 결과를 보려고 창으로 돌아오면 다시 불러온다.
  const [load, reload] = useLoad(() => fetchDetail(requestId), [requestId], { refreshOnFocus: isResult });
  const { pending, run } = useAction();
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<RequestResult>('SUCCESS');
  const [progress, setProgress] = useState('');

  if (load.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>요청을 불러오는 중이에요.</p>
      </div>
    );
  if (load.status === 'error')
    return (
      <div className="empty">
        <h1>요청을 불러오지 못했어요</h1>
        <p>{load.message}</p>
      </div>
    );

  const { request: r, stage, agreements, resultEvidences, evidences } = load.data;
  // 결과를 낸 뒤 이용자 확인 중에도 추가 자료(결과 증빙)를 올릴 수 있다. 반려된 시도 증빙에 답할 때 쓴다.
  const confirming = isResult && stage === 'result_submitted';
  // 분쟁 중 자료는 요청 상세의 '분쟁 소명·추가 자료'(운영팀만 열람)로 받으므로 이 화면은 열지 않는다.
  if (stage !== 'in_progress' && !confirming) return <Navigate to={`/requests/${requestId}`} replace />;
  // 도우미 전용 화면이다(서버도 403으로 막는다). 이용자가 주소로 들어오면 상세로 보낸다.
  const myId = myUserId(me);
  if (myId && r.agentId !== myId) return <Navigate to={`/requests/${requestId}`} replace />;
  const a = latestAgreement(agreements);
  if (!a?.safePayment) return <Navigate to={`/requests/${requestId}`} replace />;
  const path = { params: { path: { requestId } } };
  const latestResult = latestOf(resultEvidences);
  const scan = scanState(latestResult);
  // 실패 결과는 최신 시도 증빙이 제출·승인·반려 중 하나면 낼 수 있다(반려돼도 가능). 성공·부분성공은 증빙 없이도 된다.
  const latestAttempt = [...evidences].sort((x, y) => (y.revision ?? 0) - (x.revision ?? 0))[0];
  const attemptRejected = latestAttempt?.status === 'REJECTED';
  const attemptOnRecord = latestAttempt?.status === 'SUBMITTED' || latestAttempt?.status === 'APPROVED' || attemptRejected;
  // 시도 증빙은 처음이거나 최신 증빙이 반려됐을 때만 새로 낼 수 있다(아니면 서버 409).
  if (!isResult && latestAttempt && !attemptRejected) return <Navigate to={`/requests/${requestId}`} replace />;
  // 착수비 선지급 안내는 안전거래이고 착수비가 있을 때만 맞는 말이다.
  const upfrontApplies = !!a?.safePayment && (a?.upfrontFeeKrw ?? 0) > 0;

  async function upload(uploader: (f: File) => Promise<string>) {
    const keys: string[] = [];
    for (const [i, f] of files.entries()) {
      setProgress(`파일 올리는 중 (${i + 1}/${files.length})`);
      keys.push(await uploader(f));
    }
    setProgress('');
    return keys;
  }

  async function submitAttempt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await run(async () => {
      const keys = await upload(uploadAttemptFile);
      await unwrap(api.POST('/api/requests/{requestId}/attempt-evidences', { ...path, body: { description: description.trim() || null, attachments: keys.map((storageKey, sortOrder) => ({ storageKey, sortOrder })) } }));
    }, '시도 증빙을 올렸어요. 이용자가 확인하면 알려드릴게요.');
    setProgress('');
    if (ok) navigate(`/requests/${requestId}`, { replace: true });
    else reload(); // 응답만 유실됐을 수 있으니 최신 상태로 다시 판단한다
  }

  async function submitResultEvidence(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!files.length) return;
    const ok = await run(async () => {
      const storageKeys = await upload(uploadResultFile);
      await unwrap(api.POST('/api/requests/{requestId}/result/evidence', { ...path, body: { description: description.trim() || undefined, storageKeys } }));
    }, '추가 자료를 올렸어요. 이용자도 바로 볼 수 있어요.');
    setProgress('');
    if (ok) {
      setFiles([]);
      setDescription('');
    }
    reload(); // 실패해도 서버에 저장됐을 수 있어 다시 불러온다
  }

  const conditions = (
    <aside className="tx-side">
      <TxCard title="확정된 조건">
        <h3>{r.targetName}</h3>
        <Rows
          rows={[
            ['희망 좌석·요청 내용', a?.requirements ?? r.requirements],
            ['성공 요건', a?.successConditions ?? r.successConditions],
            ['실패·환불 처리', a?.refundRule ?? ''],
          ]}
        />
      </TxCard>
      {!isResult && (
        <Notice>
          실패로 결과를 등록하려면 시도 증빙이 반드시 필요해요.
          {upfrontApplies && ' 안전거래라서 이용자가 승인하면 결과 전이라도 착수비 지급을 요청해요(정산 계좌 등록 필요). 운영팀이 예매 시도를 확인하지 못해 종결하면 착수비는 지급되지 않아요.'}
        </Notice>
      )}
    </aside>
  );

  if (!isResult)
    return (
      <>
        <PageTitle title="시도 증빙 등록" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
        <div className="detail-layout tx-layout">
          <form id="tx-evidence-form" noValidate onSubmit={submitAttempt}>
            <TxCard title="시도 증빙">
              <Notice>예매 대기·좌석 선택·예매 시도 화면을 첨부할 수 있어요. 계정정보 등 민감한 내용은 가려 주세요.</Notice>
              <Field label="설명">
                <textarea name="description" rows={3} maxLength={16000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 20:00 대기열 진입, 20:07 좌석 선택 화면까지 진행했어요." />
              </Field>
              <div className="tx-upload-heading">
                <h3>
                  시도 증빙 자료 <em>*</em>
                </h3>
                <span>예매를 시도한 화면이나 화면 녹화를 첨부해 주세요.</span>
              </div>
              <FilePicker kind="attempt" files={files} onChange={setFiles} />
              <Notice>파일은 비공개 저장소에 올라가며, 거래 당사자와 운영팀만 확인할 수 있어요.</Notice>
              <div className="tx-form-footer">
                <span role="status">{progress}</span>
                <button type="submit" className="btn primary" disabled={pending || !files.length}>
                  {pending ? '제출 중…' : '시도 증빙 제출'}
                </button>
              </div>
            </TxCard>
          </form>
          {conditions}
        </div>
      </>
    );

  const evidenceList = (
    resultEvidences.length > 0 && (
      <div className="tx-file-list">
        {resultEvidences.map((e, i) => {
          const attached = list(pick(e, 'attachments'));
          return (
            <div key={String(pick(e, 'evidenceId', 'id') ?? i)} className="tx-file-view">
              <div>
                <strong>
                  {num(pick(e, 'revision')) ? `${num(pick(e, 'revision'))}차 제출` : '결과 증빙'}
                  {e === latestResult && ' · 최신'}
                </strong>
                <small>{[str(pick(e, 'description')), utcToLocal(str(pick(e, 'submittedAt')) ?? '')].filter(Boolean).join(' · ') || '설명 없음'}</small>
                <small>
                  {attached.length ? (
                    <EvidenceFileNames files={attached} status={(f) => scanNames[str(f.scanStatus) ?? ''] ?? str(f.scanStatus) ?? '검토 상태 미확인'} />
                  ) : (
                    scanNames[str(pick(e, 'scanStatus')) ?? ''] ?? '검토 상태 미확인'
                  )}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    )
  );

  // 이용자 확인 중: 결과는 이미 냈으므로 추가 자료(결과 증빙)만 올린다.
  if (confirming)
    return (
      <>
        <PageTitle title="추가 자료 올리기" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
        <div className="detail-layout tx-layout">
          <TxCard title="추가 자료">
            <p className="prose">이용자가 결과를 확인하고 있어요. 시도 증빙이 반려됐거나 더 보여 줄 자료가 있으면 올려 주세요. 이용자가 바로 볼 수 있고, 이의가 생기면 운영팀 판단 자료가 돼요.</p>
            {evidenceList}
            {scan === 'blocked' && <Notice tone="error">운영팀이 차단한 파일이 있어요. 다른 파일로 다시 올려 주세요.</Notice>}
            <form noValidate onSubmit={submitResultEvidence}>
              <Field label="설명">
                <textarea name="evidenceDescription" rows={2} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 예매 완료 화면, 좌석 1층 B구역 8열" />
              </Field>
              <FilePicker kind="result" files={files} onChange={setFiles} />
              <div className="tx-form-footer">
                <span role="status">{progress}</span>
                <button type="submit" className="btn primary" disabled={pending || !files.length}>
                  추가 자료 올리기
                </button>
              </div>
            </form>
          </TxCard>
          {conditions}
        </div>
      </>
    );

  // 결과 등록: ① 결과 선택 → ② 결과별 증빙(성공·부분성공은 선택, 실패는 시도 증빙 필수) → ③ 내용 입력 후 한 번에 제출
  const failure = result === 'FAILURE';
  const needAttemptFile = failure && !attemptOnRecord;
  const resultChoices: [RequestResult, string, string][] = [
    ['SUCCESS', '성공', '성공 요건을 모두 충족했어요. 예매 내역 화면을 첨부하면 이용자가 바로 확인해요(선택).'],
    ['PARTIAL', '부분 성공', '일부만 충족했어요. 증빙은 선택이에요. 안전거래는 완료 후 부분성공 정산으로 금액을 정해요.'],
    ['FAILURE', '실패', '예매하지 못했어요. 예매를 시도한 화면(시도 증빙)이 반드시 필요해요.'],
  ];

  async function submitAll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    if (needAttemptFile && !files.length) return;
    const d = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
    const ok = await run(async () => {
      if (files.length) {
        // 증빙을 먼저 올린다. 결과 제출이 실패해도 올린 증빙은 남으므로 파일 선택을 비워 중복 업로드를 막는다.
        // 시도 증빙은 없거나 반려됐을 때만 새로 낼 수 있다. 확인 대기·승인 상태면 추가 자료는 결과 증빙으로 올린다.
        if (needAttemptFile || (failure && attemptRejected)) {
          const keys = await upload(uploadAttemptFile);
          await unwrap(api.POST('/api/requests/{requestId}/attempt-evidences', { ...path, body: { description: description.trim() || null, attachments: keys.map((storageKey, sortOrder) => ({ storageKey, sortOrder })) } }));
        } else {
          const storageKeys = await upload(uploadResultFile);
          await unwrap(api.POST('/api/requests/{requestId}/result/evidence', { ...path, body: { description: description.trim() || undefined, storageKeys } }));
        }
        setFiles([]);
        setDescription('');
        reload();
      }
      await unwrap(api.POST('/api/requests/{requestId}/result', { ...path, body: { result, note: d.note, actualOutcomeDescription: d.outcome || undefined } }));
    }, '예매 결과를 등록했어요. 이용자가 3일 안에 확인해요.');
    setProgress('');
    if (ok) navigate(`/requests/${requestId}`, { replace: true });
    else reload();
  }

  return (
    <>
      <PageTitle title="예매 결과 등록" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
      <div className="detail-layout tx-layout">
        <form id="tx-evidence-form" noValidate onSubmit={submitAll}>
          <TxCard title="1. 예매 결과">
            <fieldset className="tx-methods">
              <legend>예매 결과</legend>
              {resultChoices.map(([value, label, desc]) => (
                <label key={value}>
                  <input type="radio" name="result" checked={result === value} onChange={() => { setResult(value); setFiles([]); }} />
                  <span>
                    <strong>{label}</strong>
                    <small>{desc}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          </TxCard>

          {failure ? (
            <TxCard title="2. 시도 증빙 (필수)">
              {attemptRejected ? (
                <>
                  <Notice tone="error">
                    {latestAttempt?.revision}차 시도 증빙을 이용자가 반려했어요{latestAttempt?.reviewNote ? ` (사유: ${latestAttempt.reviewNote})` : ''}. 반려된 증빙으로도 실패를 등록할 수 있고, 이용자가 동의하지 않으면 운영팀이 반려 사유와 함께 보고 정해요.
                  </Notice>
                  <p className="prose">반려 사유를 반박할 자료가 있으면 새 시도 증빙으로 올려 주세요(선택). 결과와 함께 제출돼요.</p>
                  <Field label="설명">
                    <textarea name="evidenceDescription" rows={2} maxLength={16000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 20:00 대기열 진입 화면(시각 표시 포함)" />
                  </Field>
                  <FilePicker kind="attempt" files={files} onChange={setFiles} />
                </>
              ) : attemptOnRecord ? (
                <>
                  {/* 시도 증빙 단계에서는 추가 자료 업로드를 보이지 않는다. 결과를 낸 뒤 필요하면 요청 상세의 '추가 자료 올리기'로 올린다. */}
                  <Notice tone="success">
                    {latestAttempt?.revision}차 시도 증빙이 올라가 있어요({latestAttempt?.status === 'APPROVED' ? '이용자 승인' : '확인 대기'}). 이 증빙으로 실패 결과를 제출할 수 있어요.
                  </Notice>
                </>
              ) : (
                <>
                  <p className="prose">예매 대기·좌석 선택·매진 화면처럼 예매를 시도한 화면을 올려 주세요. 계정정보 등 민감한 내용은 가려 주세요.</p>
                  <Field label="설명">
                    <textarea name="evidenceDescription" rows={2} maxLength={16000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 20:00 대기열 진입, 20:03 전석 매진" />
                  </Field>
                  <FilePicker kind="attempt" files={files} onChange={setFiles} />
                </>
              )}
            </TxCard>
          ) : (
            <TxCard title="2. 성공 증빙 (선택)">
              <p className="prose">예매 내역 화면을 올려 두면 이용자가 결과를 확인할 때 함께 봐요. 이의가 생기면 운영팀 판단 자료가 돼요.</p>
              {evidenceList}
              {scan === 'blocked' && <Notice tone="error">운영팀이 차단한 파일이 있어요. 이용자에게 보이지 않으니 다른 파일로 다시 올려 주세요.</Notice>}
              <Field label="설명">
                <textarea name="evidenceDescription" rows={2} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 예매 완료 화면, 좌석 1층 B구역 8열" />
              </Field>
              <FilePicker kind="result" files={files} onChange={setFiles} />
            </TxCard>
          )}

          <TxCard title="3. 결과 내용">
            <Field label={failure ? '실패 사유' : '결과 설명'} required>
              <textarea name="note" rows={3} required maxLength={10000} placeholder={failure ? '예: 오픈 3분 만에 전석 매진됐어요.' : '예: 요청하신 1층 좌석 2매를 예매했어요.'} />
            </Field>
            {!failure && (
              <Field label="실제 확보 내용">
                <input name="outcome" maxLength={10000} placeholder="예: 1층 5구역 8열, 연석 2매" />
              </Field>
            )}
            <Notice>결과는 한 번만 제출할 수 있어요. 이용자가 동의하면 거래가 완료되고, 이의를 제기하면 운영팀이 증빙을 보고 정해요. 이용자가 3일 동안 답하지 않으면 운영팀이 확정할 수 있어요.</Notice>
            <div className="tx-form-footer">
              <span role="status">{progress || (needAttemptFile && !files.length ? '실패 결과는 시도 증빙 파일을 첨부해야 제출할 수 있어요.' : '')}</span>
              <button type="submit" className="btn primary" disabled={pending || (needAttemptFile && !files.length)}>
                {pending ? '제출 중…' : '결과 등록'}
              </button>
            </div>
          </TxCard>
        </form>
        {conditions}
      </div>
    </>
  );
}
