import { useState, type FormEvent, type ReactNode } from 'react';
import { api, unwrap } from '../api/client';
import { list, num, str, type Raw } from '../api/pick';
import { banks } from '../agent/profile';
import { Modal } from '../ui/Modal';
import { money } from '../ui/format';
import type { Agreement, RequestResult, TxRequest } from './model';
import { MediationCard } from './Mediation';
import { Field, MoneyInput, Notice, Rows, TxCard, useAction, utcToLocal, won } from './ui';

// 백엔드 서비스 흐름 가이드 11장: 성공보수·부분성공 정산·환불. 안전거래(결제가 있는 거래)에서만 쓴다.
// - SUCCESS: 성공보수 전액 자동 지급(이용자가 즉시 지급 시도 가능)
// - PARTIAL: 도우미가 자기 몫 X를 제안 → 이용자 동의(잔액 환불) / 반려 → 재제안. 운영팀이 개입하면 조정안(양측 수락)으로 확정
// - FAILURE: 이용자가 성공보수 환불 요청
// - 착수 전(MATCHED, PAID, 지급 없음): 이용자가 전액 환불 요청 가능
// 가상계좌 환불은 환불 받을 계좌 3개 필드가 필수이고 서버는 저장하지 않는다.

const partialNames: Record<string, string> = { PROPOSED: '이용자 확인 대기', ACCEPTED: '이용자 동의', REJECTED: '협의 중 · 이용자가 반려했어요', ADMIN_DECIDED: '운영팀 조정·결정' };
const refundNames: Record<string, string> = { REQUESTED: '환불 요청', PROCESSING: '환불 처리 중', SUCCEEDED: '환불 완료', FAILED: '환불 실패', CANCELLED: '환불 취소' };
const componentNames: Record<string, string> = { UPFRONT: '착수비', SUCCESS: '성공보수', SAFETY_FEE: '안전거래 이용료' };

/** 환불 받을 계좌(가상계좌 결제 환불 필수, 저장하지 않음) */
function RefundAccount({ value, onChange }: { value: { bank: string; number: string; holder: string }; onChange: (v: { bank: string; number: string; holder: string }) => void }) {
  return (
    <>
      <div className="form-grid">
        <Field label="환불 받을 은행" required>
          <select value={value.bank} onChange={(e) => onChange({ ...value, bank: e.target.value })}>
            {banks.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="예금주" required>
          <input required maxLength={30} value={value.holder} onChange={(e) => onChange({ ...value, holder: e.target.value })} />
        </Field>
      </div>
      <Field label="계좌번호" required helper="숫자만 6~20자리. 환불에만 쓰고 저장하지 않아요.">
        <input required inputMode="numeric" pattern="[0-9]{6,20}" value={value.number} onChange={(e) => onChange({ ...value, number: e.target.value.replace(/[^0-9]/g, '') })} />
      </Field>
    </>
  );
}

const emptyAccount = { bank: '004', number: '', holder: '' };

const roleNames: Record<string, string> = { REQUESTER: '이용자', AGENT: '도우미' };
const offerResultNames: Record<string, string> = { PENDING: '응답 대기', ACCEPTED: '동의', REJECTED: '반려', SUPERSEDED: '운영팀 조정·결정으로 대체' };

/**
 * 부분 성공 정산 카드. 흐름: 도우미 제안 → 이용자 동의 / 반려 → (반려하면) 도우미가 새 금액을 계속 제안.
 * 운영팀은 마지막 활동 후 24시간 동안 변화가 없거나 도우미·이용자가 '운영팀에 넘기기'를 눌렀을 때 조정안을 제시할 수 있다.
 * 조정이 시작되면 당사자끼리의 직접 제안·동의·반려는 막히고, 조정안에 양측이 수락해야 확정된다(최대 2회).
 */
/** refund: 이용자의 남은 성공보수 환불 요청·내역. 정산 결과 바로 아래(카드 맨 아래)에 둔다. */
export function PartialSettlementCard({ r, a, partial, agent, reload, refund }: { r: TxRequest; a: Agreement; partial: Raw | null; agent: boolean; reload: () => void; refund?: ReactNode }) {
  const [amountInput, setAmountInput] = useState<number | null>(null);
  const [amountMissing, setAmountMissing] = useState(false);
  const [note, setNote] = useState('');
  const [reviewed, setReviewed] = useState<{ requestId: number; round: number; proposed: number; remainder: number } | null>(null);
  const [dialog, setDialog] = useState<'' | 'propose' | 'accept' | 'reject' | 'escalate'>('');
  // 409(상대방이 먼저 처리·운영팀에 넘어감 등): 서버 메시지를 보여 주고 최신 상세로 다시 불러온다.
  const { pending, run } = useAction({
    onConflict: () => {
      setDialog('');
      reload();
    },
  });
  const [account, setAccount] = useState(emptyAccount);
  const [rejectNote, setRejectNote] = useState('');
  const [counterInput, setCounterInput] = useState('');
  const [escalateNote, setEscalateNote] = useState('');
  const path = { params: { path: { requestId: r.id } } };
  const status = str(partial?.status) ?? '';
  const proposed = num(partial?.proposedAmountKrw);
  const decided = num(partial?.decidedAmountKrw);
  const refundAmount = num(partial?.refundAmountKrw);
  const counter = num(partial?.counterAmountKrw);
  const round = num(partial?.round) ?? 0;
  const offers = list(partial?.offers);
  const escalatedAt = str(partial?.escalatedAt);
  const escalatedBy = str(partial?.escalatedByRole);
  const escalated = !!escalatedAt;
  const adminOpen = partial?.adminDecisionAvailable === true;
  const mediationStatus = str(partial?.mediationStatus) ?? 'NONE';
  const mediating = mediationStatus !== 'NONE'; // 조정이 시작된 뒤에는 금액을 직접 주고받지 않는다
  const remainder = proposed !== undefined ? a.successFeeKrw - proposed : 0;
  // 합의한 성공보수가 0원이면 서버도 제안을 받지 않는다(409). 입력창을 보여 주지 않고 이유를 알려 준다.
  const noFee = a.successFeeKrw <= 0;
  const settled = status === 'ACCEPTED' || status === 'ADMIN_DECIDED';
  const hasProposal = !!partial && status !== 'NOT_PROPOSED';
  const canPropose = agent && !escalated && !settled && !mediating && (!hasProposal || status === 'REJECTED');
  const canEscalate = !settled && !escalated && !mediating;
  // 새 제안의 기본값: 이용자가 바라는 금액 → 직전 제안 금액 → 0원
  const amount = amountInput ?? (status === 'REJECTED' ? (counter ?? proposed ?? 0) : 0);
  const done = (message: string) => (ok: boolean) => {
    if (ok) {
      setDialog('');
      setAmountInput(null);
      setNote('');
      reload();
    }
    return message;
  };

  /** 제안은 응답이 올 때까지 바꿀 수 없다. 빈칸을 0원으로 보내지 않도록 금액을 꼭 입력받고, 확인 창에서 한 번 더 보여 준다. */
  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('amountKrw') as HTMLInputElement | null;
    if (!input || input.validity.valueMissing || input.validity.badInput) {
      setAmountMissing(true);
      input?.focus();
      return;
    }
    if (amount > a.successFeeKrw) return;
    setDialog('propose');
  }

  async function propose() {
    const ok = await run(
      () => unwrap(api.POST('/api/requests/{requestId}/partial-settlement', { ...path, body: { amountKrw: amount, note: note.trim() || null } })),
      round > 0 ? '새 금액을 제안했어요.' : '정산 금액을 제안했어요.',
    );
    done('')(ok);
  }

  const escalateButton = canEscalate && (
    <div className="tx-request-actions">
      <button type="button" className="btn ghost" disabled={pending} onClick={() => setDialog('escalate')}>
        운영팀에 넘기기
      </button>
    </div>
  );

  return (
    <>
    <TxCard title="부분 성공 정산">
      {noFee ? (
        <p className="prose">결과가 부분 성공으로 확정됐어요.{a.upfrontFeeKrw > 0 && ` 착수비 ${won(a.upfrontFeeKrw)}은 결과가 확정돼 도우미 몫이고, 이 정산과 별개예요.`}</p>
      ) : (
        <p className="prose">
          결과가 부분 성공이라 성공보수 {won(a.successFeeKrw)} 중 도우미 몫을 정해요. 나머지는 이용자에게 환불돼요. 먼저 도우미와 이용자가 금액을 맞춰 보고, 합의가 어려우면 운영팀에 넘길 수 있고, 운영팀은 조정안을 제안해요(이용자와 도우미가 모두 수락해야 확정).
          {a.upfrontFeeKrw > 0 && ` 착수비 ${won(a.upfrontFeeKrw)}은 결과가 확정돼 도우미 몫이고, 이 정산에 포함되지 않아요.`}
        </p>
      )}
      {noFee ? (
        <Notice>합의한 성공보수가 0원이라 나눌 금액이 없어요. 정산 금액을 제안하거나 환불할 일 없이 거래가 마무리돼요.</Notice>
      ) : (
        <>
          {escalated && !settled && (
            <Notice>
              {roleNames[escalatedBy ?? ''] ?? '당사자'}가 운영팀에 넘겼어요{str(partial?.escalationNote) ? ` ("${str(partial?.escalationNote)}")` : ''}. 이제 운영팀이 조정안을 제안해요.
              {status === 'PROPOSED' && !agent ? ' 이미 온 제안에는 계속 동의하거나 반려할 수 있어요.' : ''}
            </Notice>
          )}
          {hasProposal && (
            <Rows
              rows={[
                ['상태', status === 'REJECTED' ? '협의 중 · 이용자가 반려했어요' : (partialNames[status] ?? status)],
                ['협의 회차', round > 0 ? `${round}차` : '-'],
                ['도우미 제안', proposed !== undefined ? `${won(proposed)}${partial?.proposalNote ? ` · ${str(partial.proposalNote)}` : ''}` : '-'],
                ...(status === 'REJECTED' ? ([['반려 사유', str(partial?.rejectionNote) ?? '']] as [string, string][]) : []),
                ...(status === 'REJECTED' && counter !== undefined ? ([['이용자가 바라는 금액', won(counter)]] as [string, string][]) : []),
                // 정산의 결론이라 다른 줄보다 굵게·강조색으로 보여 준다.
                ...(decided !== undefined ? ([['확정된 도우미 몫', <strong key="decided" className="settlement-key">{won(decided)}</strong>]] as [string, ReactNode][]) : []),
                ...(refundAmount !== undefined ? ([['이용자 환불', <strong key="refund" className="settlement-key">{won(refundAmount)}</strong>]] as [string, ReactNode][]) : []),
                ...(partial?.decisionNote ? ([['조정·결정 사유', str(partial.decisionNote) ?? '']] as [string, string][]) : []),
                ...(partial?.decidedAt ? ([['확정 시각', utcToLocal(str(partial.decidedAt) ?? '')]] as [string, string][]) : []),
              ]}
            />
          )}
          {offers.length > 1 && (
            <details className="tx-versions">
              <summary>지난 제안 보기 ({offers.length - 1}건)</summary>
              {offers.slice(0, -1).map((o) => (
                <p key={String(num(o.round))} className="record-note">
                  {num(o.round)}차 · 도우미 {won(num(o.proposedAmountKrw) ?? 0)} 제안 → {offerResultNames[str(o.result) ?? ''] ?? str(o.result)}
                  {str(o.rejectionNote) ? ` (사유: ${str(o.rejectionNote)})` : ''}
                  {num(o.counterAmountKrw) !== undefined ? ` · 이용자가 바라는 금액 ${won(num(o.counterAmountKrw) ?? 0)}` : ''}
                </p>
              ))}
            </details>
          )}

          {canPropose && (
            <form noValidate onSubmit={review}>
              {status === 'REJECTED' && <p className="record-note">이용자의 사유를 보고 새 금액을 제안해 보세요. 합의가 어려우면 아래에서 운영팀에 넘길 수 있어요.</p>}
              <Field label={status === 'REJECTED' ? '새로 제안할 내 몫(원)' : '내 몫(원)'} required helper={`0원 ~ ${money(a.successFeeKrw)}원. 이용자가 답하기 전에는 바꿀 수 없어요. 받지 않으려면 0을 입력해 주세요.`}>
                <MoneyInput
                  name="amountKrw"
                  required
                  max={a.successFeeKrw}
                  value={amount}
                  onChange={(n) => {
                    setAmountInput(n);
                    setAmountMissing(false);
                  }}
                />
              </Field>
              <Field label="근거">
                <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="최종 조건의 성공 요건 중 무엇을 충족했는지 적어 주세요." />
              </Field>
              {amountMissing && <Notice tone="error">제안할 금액을 입력해 주세요.</Notice>}
              {amount > a.successFeeKrw && <Notice tone="error">성공보수보다 많이 제안할 수 없어요.</Notice>}
              <button type="submit" className="btn primary" disabled={pending || amount > a.successFeeKrw}>
                {status === 'REJECTED' ? '새 금액 제안' : '정산 금액 제안'}
              </button>
            </form>
          )}
          {!hasProposal && !escalated && !agent && <Notice>도우미가 정산 금액을 제안하면 알려드릴게요. 24시간 안에 제안이 없으면 운영팀이 조정안을 제안할 수 있어요.</Notice>}
          {status === 'PROPOSED' && agent && !escalated && !mediating && <Notice>이용자가 금액을 확인하고 있어요. 24시간 동안 답이 없으면 운영팀이 조정안을 제안할 수 있어요.</Notice>}
          {status === 'REJECTED' && !agent && !escalated && !mediating && <Notice>도우미가 새 금액을 제안할 수 있어요. 기다리거나, 합의가 어렵다면 운영팀에 넘길 수 있어요. 24시간 동안 변화가 없으면 운영팀이 조정안을 제안할 수 있어요.</Notice>}
          {!escalated && !settled && !mediating && adminOpen && <Notice>마지막 활동 후 24시간이 지나 운영팀이 조정안을 제안할 수 있어요.</Notice>}
          {mediating && !settled && mediationStatus !== 'FAILED' && <Notice>운영팀 조정이 진행 중이라 금액을 직접 제안하거나 동의·반려할 수 없어요. 아래 조정안에 응답해 주세요.</Notice>}
          {status === 'PROPOSED' && !agent && !mediating && (
            <div className="tx-request-actions">
              <button type="button" className="btn primary" disabled={pending} onClick={() => { if (round < 1 || proposed === undefined) return; setReviewed({ requestId: r.id, round, proposed, remainder }); setDialog('accept'); }}>
                동의하기
              </button>
              <button type="button" className="btn ghost" disabled={pending} onClick={() => { if (round < 1 || proposed === undefined) return; setReviewed({ requestId: r.id, round, proposed, remainder }); setDialog('reject'); }}>
                반려하고 다시 협의
              </button>
            </div>
          )}
          {escalateButton}
        </>
      )}
      {dialog === 'propose' && (
        <Modal title="이 금액으로 제안할까요?" onClose={() => setDialog('')}>
          <Rows
            rows={[
              ['내 몫(제안 금액)', won(amount)],
              ['이용자 환불 예정', won(Math.max(0, a.successFeeKrw - amount))],
            ]}
          />
          <p className="prose">
            이용자가 답하기 전에는 바꿀 수 없어요. 이용자가 동의하면 {won(amount)}이 지급되고 나머지는 이용자에게 환불돼요. 이용자가 반려하면 새 금액을 다시 제안할 수 있어요.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={() => setDialog('')}>
              금액 다시 보기
            </button>
            <button type="button" className="btn primary" disabled={pending} onClick={propose}>
              {pending ? '처리 중…' : `${won(amount)} 제안하기`}
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'accept' && reviewed && reviewed.requestId === r.id && (
        <Modal title="정산 금액에 동의할까요?" onClose={() => setDialog('')}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (reviewed.remainder > 0 && !e.currentTarget.checkValidity()) return;
              const body = reviewed.remainder > 0 ? { expectedRound: reviewed.round, refundBankCode: account.bank, refundAccountNumber: account.number, refundAccountHolder: account.holder.trim() } : { expectedRound: reviewed.round };
              done('')(await run(() => unwrap(api.POST('/api/requests/{requestId}/partial-settlement/accept', { ...path, body })), '정산 금액에 동의했어요.'));
            }}
          >
            <p className="prose">
              도우미 몫 {won(reviewed.proposed)}이 지급되고, {reviewed.remainder > 0 ? `나머지 ${won(reviewed.remainder)}은 아래 계좌로 환불돼요.` : '환불할 금액은 없어요.'}
            </p>
            {reviewed.remainder > 0 && <RefundAccount value={account} onChange={setAccount} />}
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setDialog('')}>
                돌아가기
              </button>
              <button type="submit" className="btn primary" disabled={pending}>
                동의하기
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'reject' && reviewed && reviewed.requestId === r.id && (
        <Modal title="정산 금액을 반려할까요?" onClose={() => setDialog('')}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const counterValue = counterInput.trim() === '' ? undefined : Number(counterInput);
              if (!rejectNote.trim() || (counterValue !== undefined && (!Number.isInteger(counterValue) || counterValue < 0 || counterValue > a.successFeeKrw))) return;
              done('')(
                await run(
                  () => unwrap(api.POST('/api/requests/{requestId}/partial-settlement/reject', { ...path, body: { expectedRound: reviewed.round, note: rejectNote.trim(), counterAmountKrw: counterValue } })),
                  '반려했어요. 도우미가 새 금액을 제안할 수 있어요.',
                ),
              );
              setRejectNote('');
              setCounterInput('');
            }}
          >
            <Rows rows={[['제안', `${reviewed.round}차 · 도우미 몫 ${won(reviewed.proposed)}`]]} />
            <Field label="반려 사유" required>
              <textarea rows={3} required maxLength={1000} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            </Field>
            <Field label="바라는 도우미 몫(원)" helper={`0원 ~ ${money(a.successFeeKrw)}원. 도우미가 참고하는 금액이고, 이 금액으로 확정되지는 않아요.`}>
              <input inputMode="numeric" maxLength={12} value={counterInput} onChange={(e) => setCounterInput(e.target.value.replace(/[^0-9]/g, ''))} placeholder="예: 6000" />
            </Field>
            {counterInput.trim() !== '' && Number(counterInput) > a.successFeeKrw && <Notice tone="error">성공보수보다 많은 금액은 적을 수 없어요.</Notice>}
            <p className="record-note">반려해도 바로 운영팀에 넘어가지 않아요. 도우미가 새 금액을 제안하고, 합의가 어렵다면 언제든 운영팀에 넘길 수 있어요. 사유는 도우미와 운영팀에 공개돼요.</p>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setDialog('')}>
                돌아가기
              </button>
              <button type="submit" className="btn danger" disabled={pending || !rejectNote.trim() || (counterInput.trim() !== '' && Number(counterInput) > a.successFeeKrw)}>
                반려하기
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === 'escalate' && (
        <Modal title="정산을 운영팀에 넘길까요?" onClose={() => setDialog('')}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              done('')(await run(() => unwrap(api.POST('/api/requests/{requestId}/partial-settlement/escalate', { ...path, body: { note: escalateNote.trim() || undefined } })), `운영팀에 넘겼어요. ${agent ? '이용자' : '도우미'}에게 알림이 가요.`));
              setEscalateNote('');
            }}
          >
            <p className="prose">
              넘기면 운영팀이 조정안을 제안해요. 도우미는 더 이상 새 금액을 제안할 수 없고, 이미 온 제안에는 이용자가 계속 동의하거나 반려할 수 있어요. 넘기지 않아도 마지막 활동 후 24시간 동안 변화가 없으면 운영팀이 조정안을 제안할 수 있어요. 이용자와 도우미가 모두 수락해야 확정돼요.
            </p>
            <Field label="운영팀에 전할 말">
              <textarea rows={3} maxLength={1000} value={escalateNote} onChange={(e) => setEscalateNote(e.target.value)} placeholder="예: 서로 금액이 맞지 않아요." />
            </Field>
            <p className="record-note">남긴 말은 {agent ? '이용자' : '도우미'}와 운영팀에 공개돼요.</p>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setDialog('')}>
                돌아가기
              </button>
              <button type="submit" className="btn primary" disabled={pending}>
                운영팀에 넘기기
              </button>
            </div>
          </form>
        </Modal>
      )}
      {refund && <div className="settlement-refund">{refund}</div>}
    </TxCard>
    {mediating && <MediationCard requestId={r.id} kind="SETTLEMENT" feeKrw={a.successFeeKrw} agent={agent} reloadDetail={reload} />}
    </>
  );
}

/** 이용자가 요청할 수 있는 환불(가이드 11-3). 어떤 경우인지 판단해 버튼 문구를 정한다. 금액은 서버가 계산한다. */
export function refundCase(r: TxRequest, final: RequestResult | undefined, partial: Raw | null, paymentStatus: string, upfrontFeeKrw = 0) {
  if (!['PAID', 'PARTIALLY_REFUNDED'].includes(paymentStatus.toUpperCase())) return null;
  if (r.status === 'MATCHED') return { label: '착수 전 전액 환불 요청', text: '착수 전이라 착수비·성공보수·이용료 전액이 환불돼요.' };
  if (r.status === 'COMPLETED' && final === 'FAILURE' && r.upfrontForfeited)
    return upfrontFeeKrw > 0
      ? { label: '착수비·성공보수 환불 요청', text: '운영팀 종결로 착수비와 성공보수가 환불돼요. 이용료는 환불되지 않아요.' }
      : { label: '성공보수 환불 요청', text: '운영팀 종결로 성공보수가 환불돼요. 이용료는 환불되지 않아요.' };
  if (r.status === 'COMPLETED' && final === 'FAILURE') return { label: '성공보수 환불 요청', text: '예매 실패로 성공보수가 환불돼요. 착수비와 이용료는 환불되지 않아요.' };
  // 부분 성공: 이용자가 동의하면 서버가 환불을 자동 요청하고, 조정·결정으로 확정된 경우에만 이용자가 직접 요청한다.
  if (r.status === 'COMPLETED' && final === 'PARTIAL' && str(partial?.status) === 'ADMIN_DECIDED')
    return { label: '남은 성공보수 환불 요청', text: '조정·결정으로 확정된 도우미 몫을 뺀 성공보수가 환불돼요.' };
  return null;
}

export function RefundCard({ paymentId, refunds, can, reload }: { paymentId: number; refunds: Raw[]; can: { label: string; text: string } | null; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction({
    onConflict: () => {
      setOpen(false);
      reload();
    },
  });
  const [reason, setReason] = useState('');
  const [account, setAccount] = useState(emptyAccount);
  const active = refunds.some((x) => ['REQUESTED', 'PROCESSING'].includes(str(x.status) ?? ''));
  if (!refunds.length && !can) return null;
  return (
    <>
      {refunds.length > 0 && (
        <Rows
          rows={refunds.map((x) => [
            `${componentNames[str(x.component) ?? ''] ?? '환불'} · ${refundNames[str(x.status) ?? ''] ?? str(x.status)}`,
            `${won(num(x.amountKrw))} · ${utcToLocal(str(x.completedAt ?? x.requestedAt) ?? '')}`,
          ])}
        />
      )}
      {can && !active && (
        <button type="button" className="btn secondary" disabled={pending} onClick={() => setOpen(true)}>
          {can.label}
        </button>
      )}
      {open && can && (
        <Modal title={can.label} onClose={() => setOpen(false)}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (!e.currentTarget.checkValidity() || !reason.trim()) return;
              const ok = await run(
                () =>
                  unwrap(
                    api.POST('/api/payments/{paymentId}/refund', {
                      params: { path: { paymentId } },
                      body: { reason: reason.trim(), refundBankCode: account.bank, refundAccountNumber: account.number, refundAccountHolder: account.holder.trim() },
                    }),
                  ),
                '환불을 요청했어요. 처리되면 알려드릴게요.',
              );
              if (ok) {
                setOpen(false);
                reload();
              }
            }}
          >
            <p className="prose">{can.text} 금액은 서버가 계산해요.</p>
            <Field label="환불 사유" required helper="도우미에게도 공개돼요.">
              <textarea rows={3} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <RefundAccount value={account} onChange={setAccount} />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setOpen(false)}>
                돌아가기
              </button>
              <button type="submit" className="btn primary" disabled={pending || !reason.trim()}>
                환불 요청
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
