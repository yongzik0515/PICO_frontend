import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api, unwrap } from '../api/client';
import { loadPortOne } from '../api/portone';
import { list, num, pick, str, type Raw } from '../api/pick';
import { useLoad } from '../transactions/model';
import { Notice, TxCard, useAction, utcToLocal, won } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';

// 프로토타입 transactions.js의 creditsPage(). 도우미가 요청을 수락할 때 매칭권 1장이 차감된다.
// 명세: 판매 패키지는 10회 5,000원 하나. 구매 생성(POST /purchases) → PortOne 결제창 → 승인(POST /purchases/{id}/payment, txId를 pgPaymentKey로)
const PACK_UNITS = 10;
const PACK_PRICE = 5000;

/** PortOne 결제창을 띄우고 txId를 돌려준다. */
async function payWithPortOne(orderNumber: string, amount: number) {
  const config = await unwrap<{ storeId: string; channelKey: string }>(api.GET('/api/payments/checkout-config'));
  const PortOne = await loadPortOne();
  const res = await PortOne.requestPayment({
    storeId: config.storeId,
    channelKey: config.channelKey,
    paymentId: orderNumber,
    orderName: `PICO 매칭권 ${PACK_UNITS}회`,
    totalAmount: amount,
    currency: 'CURRENCY_KRW',
    payMethod: 'CARD',
  });
  if (!res || res.code) throw new Error(res?.message || '결제를 완료하지 못했어요.');
  if (!res.txId) throw new Error('결제 결과를 확인하지 못했어요.');
  return res.txId;
}

export function CreditsPage() {
  const [load, reload] = useLoad(async () => {
    const [balance, purchases] = await Promise.all([
      unwrap(api.GET('/api/matching-passes/balance')).then((b) => num(pick(b, 'remainingUnits')) ?? 0),
      unwrap<unknown>(api.GET('/api/matching-passes/purchases', { params: { query: { page: 0, size: 20 } } })).then(list, () => [] as Raw[]),
    ]);
    return { balance, purchases };
  }, []);
  const { pending, run } = useAction();
  const toast = useToast();
  const [agreed, setAgreed] = useState(false);
  // 결제창에서 카드 결제를 마쳤는데 서버가 PG 결과를 아직 확인하지 못한 상태(승인 API 503·PROCESSING)
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();

  async function buy() {
    const result = { processing: false };
    const ok = await run(async () => {
      const purchase = await unwrap<Raw>(api.POST('/api/matching-passes/purchases', { body: { purchasedUnits: PACK_UNITS } }));
      const purchaseId = num(pick(purchase, 'purchaseId'));
      const orderNumber = str(pick(purchase, 'payment.orderNumber'));
      const amount = num(pick(purchase, 'payment.amountKrw', 'priceKrw')) ?? PACK_PRICE;
      if (!purchaseId || !orderNumber) throw new Error('구매 주문을 만들지 못했어요.');
      const pgPaymentKey = await payWithPortOne(orderNumber, amount);
      try {
        const paid = await unwrap<Raw>(api.POST('/api/matching-passes/purchases/{purchaseId}/payment', { params: { path: { purchaseId } }, body: { pgPaymentKey } }));
        result.processing = str(pick(paid, 'status'))?.toUpperCase() === 'PROCESSING';
      } catch (e) {
        // 명세: PG 결과를 확인하지 못하면 결제는 PROCESSING으로 남고 503이다. 카드 결제는 이미 끝났으니 다시 결제하게 하면 안 된다.
        if (e instanceof ApiError && e.status === 503) result.processing = true;
        else throw e;
      }
    });
    if (!ok) return;
    if (result.processing) {
      setConfirming(true);
      reload();
      return;
    }
    toast(`매칭권 ${PACK_UNITS}장을 충전했어요.`);
    // 충전은 보통 요청을 수락하려고 하므로, 충전을 마치면 들어오기 전 화면(받은 요청·매칭 관리·요청 상세)으로 돌아간다.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate('/leads', { replace: true });
  }

  return (
    <>
      <PageTitle title="매칭권 충전" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <div className="detail-layout tx-layout">
        <div>
          <TxCard title="충전할 매칭권">
            <div className="tx-credit-balance">
              <span>현재 보유 매칭권</span>
              <strong>
                {load.status === 'done' ? load.data.balance : '-'}
                <small>장</small>
              </strong>
            </div>
            {load.status === 'error' && <Notice tone="error">{load.message}</Notice>}
            <div className="pack-grid">
              <label className="pack selected">
                <input type="radio" name="pack" checked readOnly />
                <span>매칭권</span>
                <strong>{PACK_UNITS}장</strong>
                <b>{won(PACK_PRICE)}</b>
              </label>
            </div>
            <p className="record-note">1장당 500원 · 유효기간 없음 · 요청을 수락할 때 1장씩 사용해요.</p>
          </TxCard>
          <TxCard title="충전 내역">
            {load.status === 'done' && load.data.purchases.length ? (
              <div className="tx-history">
                {load.data.purchases.map((p) => (
                  <article key={String(p.purchaseId)} className="content-card">
                    <div>
                      <span className={`tx-status ${p.grantedAt ? 'blue' : 'amber'}`}>
                        {p.grantedAt ? '충전 완료' : str(pick(p, 'payment.status')) === 'FAILED' ? '결제 실패' : str(pick(p, 'payment.status')) === 'PROCESSING' ? '결제 확인 중' : '결제 대기'}
                      </span>
                      <h3>매칭권 {num(p.purchasedUnits)}장</h3>
                      <p>{utcToLocal(str(p.createdAt) ?? '')}</p>
                    </div>
                    <div>
                      <strong>{won(num(p.priceKrw))}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="tx-file-empty">아직 충전 내역이 없어요.</p>
            )}
          </TxCard>
        </div>
        <aside className="tx-side">
          <section className="content-card">
            <h2>충전 금액</h2>
            <div className="total-row">
              <span>
                매칭권 <b>{PACK_UNITS}</b>장
              </span>
              <strong>{won(PACK_PRICE)}</strong>
            </div>
            <div className="quote-agreements">
              <label className="check-row">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                매칭권 충전 및 사용 조건 동의 (필수)
              </label>
            </div>
            <button type="button" className="btn primary full" disabled={!agreed || pending || confirming} onClick={buy}>
              {pending ? '결제 진행 중…' : '매칭권 충전하기'}
            </button>
            {confirming ? (
              <Notice tone="error">
                카드 결제는 마쳤고 결제 결과를 확인하고 있어요. 다시 결제하지 마세요. 결제가 확인되면 매칭권이 자동으로 충전돼요. 잠시 후 충전 내역에서 확인해 주세요.
              </Notice>
            ) : (
              <Notice>카드 결제창(PortOne)이 열려요.</Notice>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
