import { num, pick, str, type Raw } from '../api/pick';
import { won } from './ui';

import { passPaymentNames } from './passPaymentNames';

export function PassPurchaseStatus({ purchase }: { purchase: Raw }) {
  const status = str(pick(purchase, 'payment.status'));
  const charged = status === 'PAID' && !!purchase.grantedAt;
  const label = charged ? '충전 완료' : status ? (passPaymentNames[status] ?? status) : '결제 대기';
  return <span className={`tx-status ${charged ? 'blue' : 'amber'}`}>{label}</span>;
}

export function PassPurchaseRefundSummary({ purchase }: { purchase: Raw }) {
  const unitPrice = num(purchase.unitPriceKrw);
  const amount = num(purchase.refundedAmountKrw);
  const units = num(purchase.refundedUnits);
  const status = str(pick(purchase, 'payment.status'));
  return (
    <p>
      {unitPrice != null && <small>구매 당시 1장 {won(unitPrice)}</small>}
      {amount != null && amount > 0 ? (
        <><br /><small>환불 완료 기록: {won(amount)}{units != null ? ` · 매칭권 ${units}장 회수` : ''}</small></>
      ) : (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') ? (
        <><br /><small>환불 상세 금액은 문의로 확인해 주세요.</small></>
      ) : null}
    </p>
  );
}
