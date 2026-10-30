import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import type { components } from '../api/schema';
import { useAuth } from '../auth/AuthContext';
import { inquiryTypeNames, privacyActionNames, restorableStatusNames, restorationReasonNames, type InquiryType, type PrivacyAction, type RestorationReason } from '../transactions/inquiry';
import { useLoad } from '../transactions/model';
import { Field, Notice, useAction, utcToLocal, won } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';

type Inquiry = components['schemas']['InquiryDetail'];
type RestorationTarget = components['schemas']['PassRestorationTarget'];

const types = Object.keys(inquiryTypeNames) as InquiryType[];
// 유형을 고르면 제목을 채워 둔다. 직접 고친 제목은 유형을 바꿔도 덮어쓰지 않는다.
const defaultSubject: Record<InquiryType, string> = { GENERAL: '', PASS_RESTORATION: '매칭권 복원 요청', PASS_REFUND: '매칭권 환불 요청', PRIVACY: '개인정보 요청' };
const placeholders: Record<InquiryType, string> = {
  GENERAL: '거래 관련 문의라면 공연명과 요청 날짜를 함께 적어 주세요.',
  PASS_RESTORATION: '언제 어떤 일이 있었는지, 거래 진행에 어떤 영향을 줬는지 적어 주세요. 공식 공지 링크가 있으면 함께 적어 주세요.',
  PASS_REFUND: '환불받을 장수나 사유가 있으면 적어 주세요.',
  PRIVACY: '열람·정정·삭제를 원하는 정보와 내용을 적어 주세요.',
};
// 환불은 결제가 끝난 구매만 요청할 수 있다(서버 PASS_REFUND 검증과 같음).
const refundable = new Set(['PAID', 'PARTIALLY_REFUNDED']);

export function InquiryWritePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { pending, run } = useAction();
  // 거래 상세·매칭권 화면에서 ?type=PASS_RESTORATION&requestId=… 로 들어오면 미리 골라 둔다.
  const initialType = types.find((t) => t === params.get('type')) ?? 'GENERAL';
  const [type, setType] = useState<InquiryType>(initialType);
  const [subject, setSubject] = useState(defaultSubject[initialType]);
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(params.get('requestId') ?? '');
  const [purchaseId, setPurchaseId] = useState(params.get('purchaseId') ?? '');
  const [reason, setReason] = useState<RestorationReason | ''>('');
  const [privacyAction, setPrivacyAction] = useState<PrivacyAction | ''>('');
  const [targets] = useLoad<RestorationTarget[]>(
    () => (type === 'PASS_RESTORATION' ? unwrap<RestorationTarget[]>(api.GET('/api/inquiries/pass-restoration-targets')) : Promise.resolve([])),
    [type],
  );
  const [purchases] = useLoad<Raw[]>(
    () => (type === 'PASS_REFUND' ? unwrap<unknown>(api.GET('/api/matching-passes/purchases', { params: { query: { page: 0, size: 100 } } })).then(list) : Promise.resolve([])),
    [type],
  );
  const refundTargets = purchases.status === 'done' ? purchases.data.filter((p) => refundable.has(str(pick(p, 'payment.status')) ?? '')) : [];
  const restorationTargets = targets.status === 'done' ? targets.data : [];

  function changeType(next: InquiryType) {
    if (!subject.trim() || subject === defaultSubject[type]) setSubject(defaultSubject[next]);
    setType(next);
  }
  // 주소로 받은 번호가 목록에 없거나 답변 대기 중이면 고르지 않은 것으로 본다.
  const requestChosen = restorationTargets.some((t) => String(t.requestId) === requestId && !t.inquiryOpen);
  const purchaseChosen = refundTargets.some((p) => String(num(pick(p, 'purchaseId'))) === purchaseId);
  const missingTarget =
    (type === 'PASS_RESTORATION' && (!requestChosen || !reason)) || (type === 'PASS_REFUND' && !purchaseChosen) || (type === 'PRIVACY' && !privacyAction);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    if (!subject.trim() || !message.trim() || missingTarget) return;
    const body: components['schemas']['InquiryCreate'] = { type, subject: subject.trim(), message: message.trim() };
    if (type === 'PASS_RESTORATION' && reason) Object.assign(body, { requestId: Number(requestId), restorationReason: reason });
    if (type === 'PASS_REFUND') body.passPurchaseId = Number(purchaseId);
    if (type === 'PRIVACY' && privacyAction) body.privacyAction = privacyAction;
    const ok = await run(() => unwrap(api.POST('/api/inquiries', { body })), '문의를 접수했어요.');
    if (ok) navigate('/inquiries/history');
  }

  return <div className="account-contained">
    <PageTitle title="문의 작성" crumbs={[{ label: '마이페이지', to: '/my' }]} />
    <section className="content-card">
      <div className="account-title-row"><h2>문의 작성</h2><Link className="btn ghost" to="/inquiries/history">문의 현황</Link></div>
      <form onSubmit={submit}>
        <Field label="문의 유형" required>
          <select value={type} onChange={(e) => changeType(e.target.value as InquiryType)}>
            {types.map((t) => <option key={t} value={t}>{inquiryTypeNames[t]}</option>)}
          </select>
        </Field>
        {type === 'GENERAL' && <p className="record-note">거래 상대와의 분쟁이나 신고는 해당 거래 상세의 신고하기를 이용해 주세요. 증빙 자료를 함께 올릴 수 있어요.</p>}

        {type === 'PASS_RESTORATION' && <>
          <p className="record-note">수락할 때 사용한 매칭권은 거래가 취소돼도 돌아오지 않아요. 공식 공연·예매 취소나 예매처·PICO 장애로 거래를 진행할 수 없었을 때만 운영팀이 확인한 뒤 1회 복원해요. 질병·사고 같은 개인 사정은 해당하지 않아요. 매칭권을 사용한 도우미가 취소됐거나 직접 거래 매칭이 완료된 거래로 요청할 수 있어요.</p>
          <Field label="대상 거래" required>
            {targets.status === 'loading' ? <p className="prose">불러오는 중이에요.</p> : targets.status === 'error' ? <Notice tone="error">{targets.message}</Notice> : restorationTargets.length ? (
              <select required value={requestId} onChange={(e) => setRequestId(e.target.value)}>
                <option value="">거래를 골라 주세요</option>
                {restorationTargets.map((t) => <option key={t.requestId} value={String(t.requestId)} disabled={t.inquiryOpen}>
                  {[t.targetName, t.scheduledUseDate ?? '', restorableStatusNames[t.status ?? ''] ?? t.status, t.inquiryOpen ? '답변 대기 중' : ''].filter(Boolean).join(' · ')}
                </option>)}
              </select>
            ) : <p className="prose">복원을 요청할 수 있는 거래가 없어요. 진행 중인 거래는 먼저 거래를 취소해 주세요.</p>}
          </Field>
          <Field label="복원 사유" required>
            <select required value={reason} onChange={(e) => setReason(e.target.value as RestorationReason | '')}>
              <option value="">사유를 골라 주세요</option>
              {(Object.keys(restorationReasonNames) as RestorationReason[]).map((r) => <option key={r} value={r}>{restorationReasonNames[r]}</option>)}
            </select>
          </Field>
        </>}

        {type === 'PASS_REFUND' && <>
          <p className="record-note">사용하지 않은 매칭권은 유효기간 안에 남은 장수 × 500원으로 환불돼요. 구매 후 7일 안이라면 그로블 주문조회에서 바로 취소할 수도 있어요.</p>
          <Field label="대상 구매" required>
            {purchases.status === 'loading' ? <p className="prose">불러오는 중이에요.</p> : refundTargets.length ? (
              <select required value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
                <option value="">구매를 골라 주세요</option>
                {refundTargets.map((p) => {
                  const id = num(pick(p, 'purchaseId'));
                  const partial = str(pick(p, 'payment.status')) === 'PARTIALLY_REFUNDED';
                  return <option key={id} value={String(id)}>
                    {[utcToLocal(str(pick(p, 'grantedAt')) ?? str(pick(p, 'createdAt')) ?? ''), `${num(pick(p, 'purchasedUnits')) ?? '-'}장`, won(num(pick(p, 'priceKrw'))), partial ? '일부 환불됨' : ''].filter(Boolean).join(' · ')}
                  </option>;
                })}
              </select>
            ) : <p className="prose">환불을 요청할 수 있는 구매가 없어요. 결제가 완료된 매칭권 구매만 요청할 수 있어요.</p>}
          </Field>
        </>}

        {type === 'PRIVACY' && <>
          <p className="record-note">닉네임·연락처처럼 마이페이지에서 바로 바꿀 수 있는 정보는 마이페이지에서 수정할 수 있어요. 탈퇴도 마이페이지에서 할 수 있어요.</p>
          <Field label="요청 종류" required>
            <select required value={privacyAction} onChange={(e) => setPrivacyAction(e.target.value as PrivacyAction | '')}>
              <option value="">종류를 골라 주세요</option>
              {(Object.keys(privacyActionNames) as PrivacyAction[]).map((a) => <option key={a} value={a}>{privacyActionNames[a]}</option>)}
            </select>
          </Field>
        </>}

        <Field label="제목" required><input name="subject" required maxLength={100} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 결제한 금액을 확인하고 싶어요" /></Field>
        <Field label="문의 내용" required helper={type === 'PASS_RESTORATION' ? '진단서 등 건강 정보나 예매처 비밀번호는 적지 마세요.' : undefined}>
          <textarea name="message" rows={6} required maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={placeholders[type]} />
        </Field>
        <p className="record-note">접수한 문의와 운영팀 답변은 본인만 확인할 수 있어요.</p>
        <div className="account-form-footer"><button type="submit" className="btn primary" disabled={pending || missingTarget}>{pending ? '접수 중…' : '문의 접수'}</button></div>
      </form>
    </section>
  </div>;
}

/** 문의가 가리키는 거래·구매·요청 종류 한 줄 */
function inquiryTarget(q: Inquiry) {
  if (q.type === 'PASS_RESTORATION') return [q.targetName ? `대상 거래: ${q.targetName}` : '', q.restorationReason ? `사유: ${restorationReasonNames[q.restorationReason]}` : ''].filter(Boolean).join(' · ');
  if (q.type === 'PASS_REFUND' && q.passPurchaseId) return `대상 구매: #${q.passPurchaseId}`;
  if (q.type === 'PRIVACY' && q.privacyAction) return `요청 종류: ${privacyActionNames[q.privacyAction]}`;
  return '';
}

export function InquiryHistoryPage() {
  const { userKey } = useAuth();
  const [page, setPage] = useState(0);
  const [load, reload] = useLoad(() => unwrap<Inquiry[]>(api.GET('/api/inquiries', { params: { query: { page, size: 20 } } })), [userKey, page], { refreshOnFocus: true });
  return <div className="account-contained">
    <PageTitle title="문의 현황" crumbs={[{ label: '마이페이지', to: '/my' }]} />
    <section className="content-card">
      <div className="account-title-row"><h2>내 문의</h2><button type="button" className="btn ghost" onClick={reload}>새로 고침</button></div>
      {load.status === 'loading' ? <p>불러오는 중이에요.</p> : load.status === 'error' ? <Notice tone="error">{load.message}</Notice> : load.data.length ? load.data.map((q) => <details key={q.id} className="inquiry-item">
        <summary>{q.subject} <small>{[q.type && q.type !== 'GENERAL' && q.subject !== inquiryTypeNames[q.type] ? inquiryTypeNames[q.type] : '', q.status === 'ANSWERED' ? '답변 완료' : '답변 대기'].filter(Boolean).join(' · ')}</small></summary>
        <small>{utcToLocal(q.createdAt ?? '')}</small>
        {inquiryTarget(q) && <p className="record-note">{inquiryTarget(q)}</p>}
        <p style={{ whiteSpace: 'pre-wrap' }}>{q.message}</p>
        {q.reply && <><h3>운영팀 답변</h3><small>{utcToLocal(q.answeredAt ?? '')}</small><p style={{ whiteSpace: 'pre-wrap' }}>{q.reply}</p></>}
      </details>) : <p className="prose">접수한 문의가 없어요.</p>}
      <div className="account-form-footer">
        <button type="button" className="btn ghost" disabled={page === 0 || load.status !== 'done'} onClick={() => setPage(page - 1)}>이전</button>
        <span>{page + 1}페이지</span>
        <button type="button" className="btn ghost" disabled={load.status !== 'done' || load.data.length < 20} onClick={() => setPage(page + 1)}>다음</button>
        <Link className="btn primary" to="/inquiries">문의 작성</Link>
      </div>
    </section>
  </div>;
}
