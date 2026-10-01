import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { str, pick } from '../api/pick';
import { fetchDetail, latestAgreement, safetyFee, useLoad, type AgreementBody } from '../transactions/model';
import { Field, MoneyInput, Notice, Rows, TxCard, useAction, won } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';
import { money } from '../ui/format';

// 프로토타입 transactions.js의 finalTermsPage(). 도우미가 최종 조건(합의안)을 제안한다: POST /api/requests/{id}/agreements
// 수정 요청을 받은 뒤 다시 보내면 새 버전이 된다.
export function TermsPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const [load] = useLoad(() => fetchDetail(requestId), [requestId]);
  const { pending, run } = useAction();
  const [fees, setFees] = useState<{ upfront: number; success: number; safe: boolean } | null>(null);

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

  const { request: r, stage, changeRequests, agreements } = load.data;
  // 가이드 7장: 합의안 제안은 MATCHED에서 도우미만. 확정 후라도 진행 중인 결제가 없으면 새 버전을 제안할 수 있다(서버가 409로 막음).
  const reproposing = stage === 'ready' || stage === 'payment';
  if (r.status !== 'MATCHED' || !(stage === 'terms_needed' || stage === 'revision_requested' || reproposing)) return <Navigate to={`/requests/${requestId}`} replace />;
  const prev = latestAgreement(agreements);
  const current = fees ?? { upfront: prev?.upfrontFeeKrw ?? 0, success: prev?.successFeeKrw ?? r.agencyBudgetMax ?? 0, safe: prev?.safePayment ?? true };
  const fee = safetyFee(current.success, current.safe);
  const MAX_FEE = 100_000_000; // 가이드 7-1: 착수비·성공보수 최대 1억
  const tooMuch = current.upfront > MAX_FEE || current.success > MAX_FEE;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    if (tooMuch) return;
    const d = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
    const body: AgreementBody = {
      upfrontFeeKrw: current.upfront,
      successFeeKrw: current.success,
      safePayment: current.safe,
      requirements: d.requirements,
      successConditions: d.successConditions,
      attemptRule: current.safe ? d.attemptRule : '직접 거래: 착수 증빙을 플랫폼에 제출하지 않음',
      refundRule: d.refundRule,
      contactDeadlineRule: d.contactDeadlineRule,
    };
    const ok = await run(() => unwrap(api.POST('/api/requests/{requestId}/agreements', { params: { path: { requestId } }, body })), '최종 조건을 보냈어요. 이용자의 확인을 기다려 주세요.');
    if (ok) navigate(`/requests/${requestId}`, { replace: true });
  }

  return (
    <>
      <PageTitle title="최종 조건 작성" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
      <div className="detail-layout tx-layout">
        <form id="tx-terms-form" noValidate onSubmit={submit}>
          {(stage === 'revision_requested' || r.agreementChangePending) &&
            changeRequests.map((c, i) => <Notice key={i}>이용자 수정 요청: {str(pick(c, 'reason', 'message', 'body'))}</Notice>)}
          <TxCard title="진행 조건">
            <p className="record-note">이용자의 요청이 기본값이에요. 필요한 부분을 조정해 보내 주세요.</p>
            <Field label="희망 좌석·요청 내용" required>
              <textarea name="requirements" rows={3} required maxLength={10000} defaultValue={prev?.requirements || r.requirements} />
            </Field>
            <Field label="성공 요건" required>
              <textarea name="successConditions" rows={3} required maxLength={10000} defaultValue={prev?.successConditions || r.successConditions} />
            </Field>
            {current.safe ? (
              <Field label="예매 시도 방식" required>
                <textarea name="attemptRule" rows={3} required maxLength={10000} defaultValue={prev?.attemptRule} placeholder="예: 티켓 오픈 시각에 PC 1대로 예매를 시도하고, 대기열 화면을 증빙으로 남겨요." />
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
              <textarea name="refundRule" rows={3} required maxLength={10000} defaultValue={prev?.refundRule || '수고비 전액 환불, 착수비는 시도 증빙 검토 후 처리'} />
            </Field>
            <Field label="결과 연락 기한" required>
              <input name="contactDeadlineRule" required maxLength={500} defaultValue={prev?.contactDeadlineRule || r.contactDeadlineRule || '예매 종료 후 30분 이내'} />
            </Field>
            <div className="tx-form-footer">
              <span role="status">
                {reproposing ? `확정된 ${prev?.version}차 조건을 대신할 새 조건이에요. 이용자가 다시 확정해야 해요.` : prev ? `${prev.version + 1}차 제안으로 보내요.` : current.safe ? '이용자가 확인하고 확정하면 결제 단계로 넘어가요.' : '이용자가 확인하고 확정하면 매칭이 완료돼요. 이후 착수·결과 등록은 필요 없어요.'}
              </span>
              <button type="submit" className="btn primary" disabled={pending}>
                {pending ? '보내는 중…' : '최종 조건 보내기'}
              </button>
            </div>
          </TxCard>
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
                ['희망 수고비(최대)', won(r.agencyBudgetMax)],
                ['기타 사항', r.additionalNote],
              ]}
            />
          </TxCard>
        </aside>
      </div>
    </>
  );
}
