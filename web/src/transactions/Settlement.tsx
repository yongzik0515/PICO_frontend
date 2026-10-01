import { useState, type FormEvent } from 'react';
import { api, unwrap } from '../api/client';
import { num, str, type Raw } from '../api/pick';
import { banks } from '../agent/profile';
import { Modal } from '../ui/Modal';
import { money } from '../ui/format';
import type { Agreement, RequestResult, TxRequest } from './model';
import { Field, MoneyInput, Notice, Rows, TxCard, useAction, utcToLocal, won } from './ui';

// 백엔드 서비스 흐름 가이드 11장: 성공보수·부분성공 정산·환불. 안전거래(결제가 있는 거래)에서만 쓴다.
// - SUCCESS: 성공보수 전액 자동 지급(이용자가 즉시 지급 시도 가능)
// - PARTIAL: 도우미가 자기 몫 X를 한 번 제안 → 이용자 동의(잔액 환불) / 거절 → 관리자 결정
// - FAILURE: 이용자가 성공보수 환불 요청
// - 착수 전(MATCHED, PAID, 지급 없음): 이용자가 전액 환불 요청 가능
// 가상계좌 환불은 환불 받을 계좌 3개 필드가 필수이고 서버는 저장하지 않는다.

const partialNames: Record<string, string> = { PROPOSED: '이용자 확인 대기', ACCEPTED: '이용자 동의', REJECTED: '이용자 거절 · 운영팀 결정 대기', ADMIN_DECIDED: '운영팀 결정' };
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

export function PartialSettlementCard({ r, a, partial, agent, reload }: { r: TxRequest; a: Agreement; partial: Raw | null; agent: boolean; reload: () => void }) {
  const [amount, setAmount] = useState(0);
  const [amountMissing, setAmountMissing] = useState(false);
  const [note, setNote] = useState('');
  const [dialog, setDialog] = useState<'' | 'propose' | 'accept' | 'reject'>('');
  // 409(상대방이 먼저 처리·기한 경과 등): 서버 메시지를 보여 주고 최신 상세로 다시 불러온다.
  const { pending, run } = useAction({
    onConflict: () => {
      setDialog('');
      reload();
    },
  });
  const [account, setAccount] = useState(emptyAccount);
  const [rejectNote, setRejectNote] = useState('');
  const path = { params: { path: { requestId: r.id } } };
  const status = str(partial?.status) ?? '';
  const proposed = num(partial?.proposedAmountKrw);
  const decided = num(partial?.decidedAmountKrw);
  const refundAmount = num(partial?.refundAmountKrw);
  const remainder = proposed !== undefined ? a.successFeeKrw - proposed : 0;
  // 합의한 성공보수가 0원이면 서버도 제안을 받지 않는다(409). 입력창을 보여 주지 않고 이유를 알려 준다.
  const noFee = a.successFeeKrw <= 0;
  const done = (message: string) => (ok: boolean) => {
    if (ok) {
      setDialog('');
      reload();
    }
    return message;
  };

  /** 제안은 한 번뿐이라 되돌릴 수 없다. 빈칸을 0원으로 보내지 않도록 금액을 꼭 입력받고, 확인 창에서 한 번 더 보여 준다. */
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
    const ok = await run(() => unwrap(api.POST('/api/requests/{requestId}/partial-settlement', { ...path, body: { amountKrw: amount, note: note.trim() || null } })), '정산 금액을 제안했어요.');
    done('')(ok);
  }

  return (
    <TxCard title="부분 성공 정산">
      {noFee ? (
        <p className="prose">결과가 부분 성공으로 확정됐어요.{a.upfrontFeeKrw > 0 && ` 착수비 ${won(a.upfrontFeeKrw)}은 결과가 확정돼 도우미 몫이고, 이 정산과 별개예요.`}</p>
      ) : (
        <p className="prose">
          결과가 부분 성공이라 성공보수 {won(a.successFeeKrw)} 중 도우미 몫을 정해요. 나머지는 이용자에게 환불돼요.
          {a.upfrontFeeKrw > 0 && ` 착수비 ${won(a.upfrontFeeKrw)}은 결과가 확정돼 도우미 몫이고, 이 정산에 포함되지 않아요.`}
        </p>
      )}
      {noFee ? (
        <Notice>합의한 성공보수가 0원이라 나눌 금액이 없어요. 정산 금액을 제안하거나 환불할 일 없이 거래가 마무리돼요.</Notice>
      ) : !partial || status === 'NOT_PROPOSED' ? (
        agent ? (
          <form noValidate onSubmit={review}>
            <Field label="내 몫(원)" required helper={`0원 ~ ${money(a.successFeeKrw)}원. 한 번만 제안할 수 있어요. 받지 않으려면 0을 입력해 주세요.`}>
              <MoneyInput
                name="amountKrw"
                required
                max={a.successFeeKrw}
                value={amount}
                onChange={(n) => {
                  setAmount(n);
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
              정산 금액 제안
            </button>
          </form>
        ) : (
          <Notice>도우미가 정산 금액을 제안하면 알려드릴게요. 24시간 안에 제안이 없으면 운영팀이 정해요.</Notice>
        )
      ) : (
        <>
          <Rows
            rows={[
              ['상태', partialNames[status] ?? status],
              ['도우미 제안', proposed !== undefined ? `${won(proposed)}${partial.proposalNote ? ` · ${str(partial.proposalNote)}` : ''}` : '-'],
              ...(status === 'REJECTED' ? ([['거절 사유', str(partial.rejectionNote) ?? '']] as [string, string][]) : []),
              ...(decided !== undefined ? ([['확정된 도우미 몫', won(decided)]] as [string, string][]) : []),
              ...(refundAmount !== undefined ? ([['이용자 환불', won(refundAmount)]] as [string, string][]) : []),
              ...(partial.decisionNote ? ([['운영팀 결정 사유', str(partial.decisionNote) ?? '']] as [string, string][]) : []),
              ...(partial.decidedAt ? ([['확정 시각', utcToLocal(str(partial.decidedAt) ?? '')]] as [string, string][]) : []),
            ]}
          />
          {!agent && status === 'PROPOSED' && (
            <div className="tx-request-actions">
              <button type="button" className="btn primary" disabled={pending} onClick={() => setDialog('accept')}>
                동의하기
              </button>
              <button type="button" className="btn ghost" disabled={pending} onClick={() => setDialog('reject')}>
                거절
              </button>
            </div>
          )}
          {status === 'REJECTED' && <Notice>금액이 맞지 않아 운영팀이 증빙을 보고 결정해요. 결정되면 이용자가 환불을 요청할 수 있어요.</Notice>}
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
            제안은 한 번만 할 수 있고 보낸 뒤에는 바꿀 수 없어요. 이용자가 동의하면 {won(amount)}이 지급되고 나머지는 이용자에게 환불돼요. 이용자가 거절하면 운영팀이 증빙을 보고 금액을 정해요.
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
      {dialog === 'accept' && (
        <Modal title="정산 금액에 동의할까요?" onClose={() => setDialog('')}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (remainder > 0 && !e.currentTarget.checkValidity()) return;
              const body = remainder > 0 ? { refundBankCode: account.bank, refundAccountNumber: account.number, refundAccountHolder: account.holder.trim() } : {};
              done('')(await run(() => unwrap(api.POST('/api/requests/{requestId}/partial-settlement/accept', { ...path, body })), '정산 금액에 동의했어요.'));
            }}
          >
            <p className="prose">
              도우미 몫 {won(proposed)}이 지급되고, {remainder > 0 ? `나머지 ${won(remainder)}은 아래 계좌로 환불돼요.` : '환불할 금액은 없어요.'}
            </p>
            {remainder > 0 && <RefundAccount value={account} onChange={setAccount} />}
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
      {dialog === 'reject' && (
        <Modal title="정산 금액을 거절할까요?" onClose={() => setDialog('')}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rejectNote.trim()) return;
              done('')(await run(() => unwrap(api.POST('/api/requests/{requestId}/partial-settlement/reject', { ...path, body: { note: rejectNote.trim() } })), '거절했어요. 운영팀이 금액을 결정해요.'));
            }}
          >
            <Field label="거절 사유" required>
              <textarea rows={3} required maxLength={1000} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            </Field>
            <p className="record-note">사유는 도우미와 운영팀에 공개돼요.</p>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setDialog('')}>
                돌아가기
              </button>
              <button type="submit" className="btn danger" disabled={pending || !rejectNote.trim()}>
                거절하기
              </button>
            </div>
          </form>
        </Modal>
      )}
    </TxCard>
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
  // 부분 성공: 이용자가 동의하면 서버가 환불을 자동 요청하고, 운영팀이 결정한 경우에만 이용자가 직접 요청한다.
  if (r.status === 'COMPLETED' && final === 'PARTIAL' && str(partial?.status) === 'ADMIN_DECIDED')
    return { label: '남은 성공보수 환불 요청', text: '운영팀이 정한 도우미 몫을 뺀 성공보수가 환불돼요.' };
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
