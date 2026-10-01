import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, num, str, type Raw } from '../api/pick';
import type { components } from '../api/schema';
import { uploadReportFile, useLoad } from '../transactions/model';
import { EvidenceFileNames, Field, FilePicker, Notice, useAction, utcToLocal } from '../transactions/ui';
import { AccountCard, AccountNote } from '../ui/account';
import { PageTitle } from '../ui/PageTitle';

// 백엔드 서비스 흐름 가이드 12-2: 신고. 프로토타입에는 없던 화면이라 계정 화면 마크업을 쓴다.
// POST /api/reports → OPEN → 운영팀 조사(INVESTIGATING) → 처리(RESOLVED/DISMISSED, 사유 공개)
// 거래를 연결하면 신고자가 그 거래의 당사자여야 한다.
// 증빙: POST /api/files/upload-url(REPORT_EVIDENCE) → 업로드 → POST /api/reports/{id}/evidences. 처리 중(OPEN·INVESTIGATING) 신고에만 추가할 수 있다.
type Reason = components['schemas']['ReportReason'];
const reasons: [Reason, string][] = [
  ['FRAUD', '사기·금전 피해'],
  ['MACRO', '매크로 등 부정한 예매'],
  ['RESALE', '재판매·티켓 양도'],
  ['FALSE_REVIEW', '거짓 후기'],
  ['OTHER', '기타'],
];
const reasonNames = Object.fromEntries(reasons) as Record<string, string>;
const statusNames: Record<string, string> = { OPEN: '접수', INVESTIGATING: '조사 중', RESOLVED: '처리 완료', DISMISSED: '처리 안 함' };

export function ReportPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reportedUserId = Number(params.get('userId'));
  const requestId = Number(params.get('requestId')) || null;
  const name = params.get('name') ?? '상대방';
  // 요청 상세의 '도우미가 결과를 등록하지 않나요?'에서 온 경우: 결과 미제출 신고로 채워 둔다.
  const noResult = params.get('topic') === 'no-result' && !!requestId;
  const [reason, setReason] = useState<Reason>(noResult ? 'OTHER' : 'FRAUD');
  const [description, setDescription] = useState(noResult ? '도우미가 착수한 뒤 예매 결과를 등록하지 않고 있어요.\n마지막으로 연락된 시각과 상황: ' : '');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState('');
  const { pending, run } = useAction();

  if (!reportedUserId)
    return (
      <div className="account-contained">
        <PageTitle title="신고하기" />
        <div className="empty">
          <p>신고할 거래 상세에서 '신고하기'를 눌러 주세요.</p>
          <button type="button" className="btn secondary" onClick={() => navigate('/requests')}>
            내 활동으로
          </button>
        </div>
      </div>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    let reportId: number | undefined;
    const ok = await run(async () => {
      // 증빙 업로드가 실패해도 신고가 두 번 접수되지 않게, 이미 접수했으면 증빙만 다시 올린다.
      if (!reportId) reportId = num((await unwrap<unknown>(api.POST('/api/reports', { body: { reportedUserId, requestId, reason, description: description.trim() } })) as Raw)?.reportId);
      if (files.length && reportId) await submitReportEvidence(reportId, files, '', setProgress);
    }, files.length ? '신고와 증빙을 접수했어요. 처리 결과는 신고 내역에서 확인할 수 있어요.' : '신고를 접수했어요. 처리 결과는 신고 내역에서 확인할 수 있어요.');
    setProgress('');
    // 신고는 접수됐는데 증빙만 실패했으면 신고 내역에서 다시 올리도록 보낸다.
    if (ok || reportId) navigate('/reports', { replace: true });
  }

  return (
    <div className="account-contained">
      <PageTitle title="신고하기" crumbs={requestId ? [{ label: '요청 상세', to: `/requests/${requestId}` }] : [{ label: '마이페이지', to: '/my' }]} />
      <AccountCard title={noResult ? `${name} 결과 미제출 신고` : `${name} 신고`}>
        <form noValidate onSubmit={submit}>
          {noResult && (
            <Notice>
              운영팀이 확인한 뒤 도우미 결과 미제출로 거래를 실패 종결할 수 있어요. 안전거래라면 성공보수를 환불받고, 착수비는 도우미의 시도 증빙이 승인됐거나 지급이 시작됐으면 도우미 몫이라 환불되지 않고, 그렇지 않으면 착수비도 환불받아요(이용료 제외).
            </Notice>
          )}
          <Field label="신고 사유" required>
            <select value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
              {reasons.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="신고 내용" required helper="언제, 어떤 일이 있었는지 구체적으로 적어 주세요.">
            <textarea rows={6} required maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="증빙 파일" helper="대화 캡처, 입금 내역 등. 신고 내역에서 나중에 추가할 수도 있어요.">
            <FilePicker kind="report" files={files} onChange={setFiles} />
          </Field>
          <AccountNote>신고 내용은 운영팀만 확인해요. 처리 결과와 사유는 신고 내역에서 볼 수 있어요. 이용 정지 등 제재는 조사 후 운영팀이 따로 결정해요.</AccountNote>
          <div className="account-form-footer">
            <span role="status">{progress}</span>
            <button type="submit" className="btn primary" disabled={pending || !description.trim()}>
              {pending ? '접수 중…' : '신고 접수'}
            </button>
          </div>
        </form>
      </AccountCard>
    </div>
  );
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [load] = useLoad(() => unwrap<unknown>(api.GET('/api/reports/me', { params: { query: { page: 0, size: 50 } } })).then(list), []);
  return (
    <>
      <PageTitle title="신고 내역" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <div className="tx-history">
        {load.status === 'loading' ? (
          <div className="empty" role="status">
            <p>신고 내역을 불러오는 중이에요.</p>
          </div>
        ) : load.status === 'error' ? (
          <div className="empty">
            <p>{load.message}</p>
          </div>
        ) : load.data.length ? (
          load.data.map((x) => (
            <article key={String(x.reportId)} className="content-card">
              <div>
                <span className={`tx-status ${['RESOLVED', 'DISMISSED'].includes(str(x.status) ?? '') ? 'muted' : 'amber'}`}>{statusNames[str(x.status) ?? ''] ?? str(x.status)}</span>
                <h3>{reasonNames[str(x.reason) ?? ''] ?? str(x.reason)}</h3>
                <p>
                  {utcToLocal(str(x.createdAt) ?? '')} · {str(x.description)}
                </p>
                {str(x.resolutionNote) && <small>처리 사유: {str(x.resolutionNote)}</small>}
                <ReportEvidence reportId={num(x.reportId)!} open={['OPEN', 'INVESTIGATING'].includes(str(x.status) ?? '')} />
              </div>
              <div>
                {num(x.requestId) && (
                  <button type="button" className="btn secondary" onClick={() => navigate(`/requests/${num(x.requestId)}`)}>
                    거래 상세 보기
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            <h2>접수한 신고가 없어요</h2>
            <p>거래 상세 화면에서 상대방을 신고할 수 있어요.</p>
          </div>
        )}
      </div>
    </>
  );
}

async function submitReportEvidence(reportId: number, files: File[], description: string, setProgress: (s: string) => void) {
  const keys: string[] = [];
  for (const [i, f] of files.entries()) {
    setProgress(`파일 올리는 중 (${i + 1}/${files.length})`);
    keys.push(await uploadReportFile(f));
  }
  setProgress('');
  await unwrap(
    api.POST('/api/reports/{reportId}/evidences', {
      params: { path: { reportId } },
      body: { description: description || null, attachments: keys.map((storageKey, sortOrder) => ({ storageKey, sortOrder })) },
    }),
  );
}

/** 신고 증빙: 제출 이력(최신 차수부터)과 추가 제출. 열람 URL은 5분짜리라 누를 때마다 목록을 다시 받는다. */
function ReportEvidence({ reportId, open }: { reportId: number; open: boolean }) {
  const [shown, setShown] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState('');
  const { pending, run } = useAction();
  const [load, reload] = useLoad(
    () => (shown ? unwrap<unknown>(api.GET('/api/reports/{reportId}/evidences', { params: { path: { reportId }, query: { page: 0, size: 50 } } })).then(list) : Promise.resolve([] as Raw[])),
    [reportId, shown],
  );

  if (!shown)
    return (
      <button type="button" className="btn ghost" onClick={() => setShown(true)}>
        증빙 보기{open ? '·추가' : ''}
      </button>
    );

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    const ok = await run(() => submitReportEvidence(reportId, files, description.trim(), setProgress), '증빙을 추가했어요.');
    setProgress('');
    if (ok) {
      setFiles([]);
      setDescription('');
      reload();
    }
  }

  return (
    <div className="report-evidence">
      {load.status === 'loading' ? (
        <p className="prose">증빙을 불러오는 중이에요.</p>
      ) : load.status === 'error' ? (
        <Notice tone="error">{load.message}</Notice>
      ) : load.data.length ? (
        <div className="tx-file-list">
          {load.data.map((ev) => (
            <div key={String(ev.evidenceId)} className="tx-file-view">
              <div>
                <strong>
                  {num(ev.revision)}차 제출 · {utcToLocal(str(ev.submittedAt) ?? '')}
                </strong>
                {str(ev.description) && <small>{str(ev.description)}</small>}
                <EvidenceFileNames files={list(ev.attachments)} status={() => ''} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="prose">제출한 증빙이 없어요.</p>
      )}
      {open ? (
        <form noValidate onSubmit={add}>
          <Field label="증빙 설명">
            <textarea rows={2} maxLength={16000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <FilePicker kind="report" files={files} onChange={setFiles} />
          <div className="tx-form-footer">
            <span role="status">{progress}</span>
            <button type="submit" className="btn secondary" disabled={pending || !files.length}>
              증빙 추가
            </button>
          </div>
        </form>
      ) : (
        <small>처리가 끝난 신고에는 증빙을 추가할 수 없어요.</small>
      )}
    </div>
  );
}
