import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, unwrap } from '../api/client';
import { str, pick } from '../api/pick';
import { fetchDetail, latestAgreement, safetyFee, useLoad, type AgreementBody, type Detail } from '../transactions/model';
import { Field, MoneyInput, Notice, Rows, TxCard, useAction, won } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';
import { money } from '../ui/format';

// Each party may propose. Drafts are isolated by account and request, including their base agreement version.
export function TermsPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const { userKey } = useAuth();
  return <TermsLoader key={`${userKey}:${requestId}`} requestId={requestId} userKey={userKey} />;
}

function TermsLoader({ requestId, userKey }: { requestId: number; userKey: string }) {
  const [load, reload] = useLoad(() => fetchDetail(requestId), [requestId, userKey], { refreshOnFocus: true });
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);
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

  return <TermsEditor key={`${userKey}:${requestId}`} requestId={requestId} detail={load.data} reload={reload} />;
}

type Draft = Required<AgreementBody>;
function TermsEditor({ requestId, detail, reload }: { requestId: number; detail: Detail; reload: () => void }) {
  const navigate = useNavigate();
  const { userKey } = useAuth();
  const { pending, run } = useAction();
  const { request: r, stage, changeRequests, agreements } = detail;
  const prev = latestAgreement(agreements);
  const version = prev?.version ?? 0;
  const storageKey = `pico:terms-draft:${userKey}:${requestId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    const initial: Draft = {
      upfrontFeeKrw: prev?.upfrontFeeKrw ?? 0, successFeeKrw: prev?.successFeeKrw ?? r.agencyBudgetDesired ?? r.agencyBudgetMax ?? 0,
      safePayment: prev?.safePayment ?? true, requirements: prev?.requirements || r.requirements,
      successConditions: prev?.successConditions || r.successConditions, attemptRule: prev?.attemptRule || '',
      refundRule: prev?.refundRule || '수고비 전액 환불, 착수비는 시도 증빙 검토 후 처리',
      contactDeadlineRule: prev?.contactDeadlineRule || r.contactDeadlineRule || '예매 종료 후 30분 이내', expectedAgreementVersion: version,
    };
    try {
      const cached = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Draft | null;
      if (cached && Number.isInteger(cached.expectedAgreementVersion) && cached.expectedAgreementVersion >= 0
          && Number.isSafeInteger(cached.upfrontFeeKrw) && cached.upfrontFeeKrw >= 0
          && Number.isSafeInteger(cached.successFeeKrw) && cached.successFeeKrw >= 0 && typeof cached.safePayment === 'boolean'
          && ['requirements', 'successConditions', 'attemptRule', 'refundRule', 'contactDeadlineRule'].every((k) => typeof cached[k as keyof Draft] === 'string')) return cached;
    } catch { /* Start with the server's conditions when local storage is unavailable or invalid. */ }
    return initial;
  });
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); setSaveFailed(false); }
    catch { setSaveFailed(true); }
  }, [draft, storageKey]);
  const current = { upfront: draft.upfrontFeeKrw, success: draft.successFeeKrw, safe: draft.safePayment };
  const setFees = (next: typeof current) => setDraft((old) => ({ ...old, upfrontFeeKrw: next.upfront, successFeeKrw: next.success, safePayment: next.safe }));
  const reproposing = stage === 'ready' || stage === 'payment';
  const canPropose = r.status === 'MATCHED' && (stage === 'terms_needed' || stage === 'revision_requested' || reproposing);
  const newConditions = version !== draft.expectedAgreementVersion;
  const blocked = !canPropose || newConditions;
  const fee = safetyFee(current.success, current.safe);
  const MAX_FEE = 100_000_000;
  const tooMuch = current.upfront > MAX_FEE || current.success > MAX_FEE;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    if (tooMuch || blocked) return;
    const body: AgreementBody = {
      ...draft,
      requirements: draft.requirements.trim(), successConditions: draft.successConditions.trim(),
      attemptRule: current.safe ? draft.attemptRule.trim() : '직접 거래: 착수 증빙을 플랫폼에 제출하지 않음',
      refundRule: draft.refundRule.trim(), contactDeadlineRule: draft.contactDeadlineRule.trim(),
    };
    const ok = await run(() => unwrap(api.POST('/api/requests/{requestId}/agreements', { params: { path: { requestId } }, body })), '최종 조건을 보냈어요. 상대방의 확인을 기다려 주세요.');
    if (ok) {
      try { sessionStorage.removeItem(storageKey); } catch { /* Saving is optional. */ }
      navigate(`/requests/${requestId}`, { replace: true });
    } else reload();
  }

  return (
    <>
      <PageTitle title="최종 조건 작성" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
      <div className="detail-layout tx-layout">
        <form id="tx-terms-form" noValidate onSubmit={submit}>
          {saveFailed ? <Notice tone="error">이 브라우저에서 임시저장하지 못했어요. 화면을 떠나기 전에 작성 내용을 복사해 주세요.</Notice> : <p className="record-note" role="status">작성 내용은 이 탭에 자동으로 임시저장돼요. 요청 상세를 확인하고 돌아와도 이어 쓸 수 있어요.</p>}
          {blocked && <Notice>{newConditions ? '새 조건이 도착했어요.' : '상대방의 제안을 먼저 검토하거나 확인을 기다려 주세요.'} 작성한 내용은 보존돼요. <Link to={`/requests/${requestId}`}>요청 상세에서 제안 검토하기</Link></Notice>}
          {newConditions && canPropose && <button type="button" className="btn secondary" onClick={() => setDraft((old) => ({ ...old, expectedAgreementVersion: version }))}>최신 조건 확인 후 임시저장 내용으로 이어 쓰기</button>}
          <fieldset disabled={blocked || pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {(stage === 'revision_requested' || r.agreementChangePending) &&
            changeRequests.map((c, i) => <Notice key={i}>수정 요청: {str(pick(c, 'reason', 'message', 'body'))}</Notice>)}
          <TxCard title="진행 조건">
            <p className="record-note">최초 요청이나 최근 합의안을 바탕으로 조건을 조정해 서로에게 제안할 수 있어요.</p>
            <Field label="희망 좌석·요청 내용" required>
              <textarea name="requirements" rows={3} required maxLength={10000} value={draft.requirements} onChange={(e) => setDraft((old) => ({ ...old, requirements: e.target.value }))} />
            </Field>
            <Field label="성공 요건" required>
              <textarea name="successConditions" rows={3} required maxLength={10000} value={draft.successConditions} onChange={(e) => setDraft((old) => ({ ...old, successConditions: e.target.value }))} />
            </Field>
            {current.safe ? (
              <Field label="예매 시도 방식" required>
                <textarea name="attemptRule" rows={3} required maxLength={10000} value={draft.attemptRule} onChange={(e) => setDraft((old) => ({ ...old, attemptRule: e.target.value }))} placeholder="예: 티켓 오픈 시각에 PC 1대로 예매를 시도하고, 대기열 화면을 증빙으로 남겨요." />
              </Field>
            ) : <Notice>직접 거래는 착수·결과 증빙을 플랫폼에 등록하지 않아요.</Notice>}
          </TxCard>
          <TxCard title="비용과 결과 안내">
            <div className="form-grid">
              <Field label="착수비" required helper="예매 시도에 대한 비용이에요.">
                <MoneyInput required max={MAX_FEE} value={current.upfront} onChange={(n) => setFees({ ...current, upfront: n })} />
              </Field>
              <Field label="수고비(성공보수)" required helper="성공 요건을 충족했을 때 받는 비용이에요.">
                <MoneyInput required max={MAX_FEE} value={current.success} onChange={(n) => setFees({ ...current, success: n })} />
              </Field>
            </div>
            <fieldset className="tx-methods">
              <legend>거래 방식</legend>
              <label>
                <input type="radio" name="safePayment" checked={current.safe} onChange={() => setFees({ ...current, safe: true })} />
                <span>
                  <strong>안전거래</strong>
                  <small>이용자가 PICO에 결제하고, 조건에 따라 정산돼요. 수수료 {money(safetyFee(current.success))}원(수고비의 3%, 최소 1,000원)</small>
                </span>
              </label>
              <label>
                <input type="radio" name="safePayment" checked={!current.safe} onChange={() => setFees({ ...current, safe: false })} />
                <span>
                  <strong>직접 거래</strong>
                  <small>조건 확정으로 매칭이 완료돼요. 착수·결과 등록 없이 당사자끼리 진행하고 이용자가 후기를 남겨요. 결제·환불은 직접 처리해요.</small>
                </span>
              </label>
            </fieldset>
            <div className="summary-rows">
              <div>
                <span>착수비</span>
                <strong>{won(current.upfront)}</strong>
              </div>
              <div>
                <span>수고비</span>
                <strong>{won(current.success)}</strong>
              </div>
              <div>
                <span>안전거래 수수료</span>
                <strong>{won(fee)}</strong>
              </div>
            </div>
            {tooMuch && <Notice tone="error">착수비와 성공보수는 각각 1억 원까지 정할 수 있어요.</Notice>}
            <div className="total-row">
              <span>이용자 결제 금액</span>
              <strong>{current.safe ? won(current.upfront + current.success + fee) : '직접 정산'}</strong>
            </div>
            <Field label="실패·환불 처리" required>
              <textarea name="refundRule" rows={3} required maxLength={10000} value={draft.refundRule} onChange={(e) => setDraft((old) => ({ ...old, refundRule: e.target.value }))} />
            </Field>
            <Field label="결과 연락 기한" required>
              <input name="contactDeadlineRule" required maxLength={500} value={draft.contactDeadlineRule} onChange={(e) => setDraft((old) => ({ ...old, contactDeadlineRule: e.target.value }))} />
            </Field>
            <div className="tx-form-footer">
              <span role="status">
                {reproposing ? `확정된 ${prev?.version}차 조건을 대신할 새 조건이에요. 상대방이 다시 확정해야 해요.` : prev ? `${prev.version + 1}차 제안으로 보내요.` : current.safe ? '상대방이 확인하고 확정하면 결제 단계로 넘어가요.' : '상대방이 확인하고 확정하면 매칭이 완료돼요. 이후 착수·결과 등록은 필요 없어요.'}
              </span>
              <button type="submit" className="btn primary" disabled={pending || blocked}>
                {pending ? '보내는 중…' : '최종 조건 보내기'}
              </button>
            </div>
          </TxCard>
          </fieldset>
        </form>
        <aside className="tx-side">
          <TxCard title="이용자의 최초 요청">
            <Rows
              rows={[
                ['공연명', r.targetName],
                ['티켓 오픈', [r.applicationOpenDate, r.applicationOpenTime].filter(Boolean).join(' ')],
                ['예매처', r.platformName || r.otherPlatformName],
                ['희망 좌석·요청 내용', r.requirements],
                ['성공 요건', r.successConditions],
                ['희망 수고비', won(r.agencyBudgetDesired)],
                ['최대 수고비', won(r.agencyBudgetMax)],
                ['기타 사항', r.additionalNote],
              ]}
            />
          </TxCard>
        </aside>
      </div>
    </>
  );
}
