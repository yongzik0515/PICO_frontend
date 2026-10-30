import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { useLoad } from '../transactions/model';
import { Notice, TxCard, useAction, utcToLocal, won } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';

// 도우미가 요청을 수락할 때 매칭권 1장이 차감된다. 판매 상품은 그로블 결제창의 10장 5,000원 하나다.
// 결제는 그로블 결제창에서 하고, 서버가 그로블의 서명된 결제 완료 알림(웹훅)을 받아 매칭권을 지급한다.
const PRODUCT = { units: 10, price: 5000 };
const PENDING_KEY = 'pico.pendingGroblePass';
const CONFIRM_LIMIT_MS = 180_000;

/** orderNumber: 그로블 주문번호. 결제가 확인되지 않을 때 문의에 적도록 안내한다(이전 버전에서 저장한 값에는 없을 수 있다). */
type Pending = { purchaseId: number; units: number; orderNumber?: string };
const savePending = (p: Pending | null) => {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // 저장 불가(사생활 보호 모드 등)면 돌아왔을 때 자동 확인만 못 한다. 충전 내역에는 그대로 반영된다.
  }
};
const loadPending = (): Pending | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
};

const STATUS_NAMES: Record<string, string> = { FAILED: '결제 실패', EXPIRED: '결제 만료', CANCELLED: '결제 취소', PROCESSING: '결제 확인 중', REFUNDED: '환불 완료', PARTIALLY_REFUNDED: '부분 환불' };
// 충전 내역에 함께 보여 주는 최근 결제 상태(payment.status)
const PAYMENT_NAMES: Record<string, string> = { ...STATUS_NAMES, PENDING: '결제 대기', PAID: '결제 완료', CANCEL_REQUESTED: '취소 진행 중' };

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
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  // 그로블에서 돌아온 뒤 결제 완료 알림을 기다리는 구매(이 탭에서 시작한 주문)
  const [waiting, setWaiting] = useState<Pending | null>(() => loadPending());
  const [charged, setCharged] = useState<number | null>(null);

  // 결제 확인을 기다리는 동안 4초마다 다시 불러온다(최대 3분). 지급되면 안내를 바꾸고, 만료·실패면 기다림을 멈춘다.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(reload, 4000);
    const stop = setTimeout(() => {
      clearInterval(timer);
      setWaiting(null);
      savePending(null);
      toast(`결제 확인이 늦어지고 있어요. 결제를 마쳤다면 잠시 후 충전 내역에서 확인해 주세요.${waiting.orderNumber ? ` 주문번호: ${waiting.orderNumber}` : ''}`);
    }, CONFIRM_LIMIT_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [waiting, reload, toast]);
  useEffect(() => {
    if (!waiting || load.status !== 'done') return;
    const hit = load.data.purchases.find((p) => num(p.purchaseId) === waiting.purchaseId);
    if (!hit) return;
    if (hit.grantedAt) {
      savePending(null);
      setWaiting(null);
      setCharged(num(hit.purchasedUnits) ?? waiting.units);
      toast('결제가 확인돼 매칭권이 충전됐어요.');
      return;
    }
    const status = str(pick(hit, 'payment.status'))?.toUpperCase();
    if (status === 'FAILED' || status === 'CANCELLED') {
      savePending(null);
      setWaiting(null);
    }
  }, [waiting, load, toast]);

  async function buy() {
    setCharged(null);
    const target = { url: '', purchaseId: 0, orderNumber: '' };
    const ok = await run(async () => {
      const checkout = await unwrap<Raw>(api.POST('/api/matching-passes/groble-checkouts'));
      const purchaseId = num(pick(checkout, 'purchaseId'));
      const url = str(pick(checkout, 'checkoutUrl'));
      if (!purchaseId || !url || !url.startsWith('https://')) throw new Error('결제 주문을 만들지 못했어요.');
      target.url = url;
      target.purchaseId = purchaseId;
      target.orderNumber = str(pick(checkout, 'payment.orderNumber', 'orderNumber')) ?? '';
    });
    if (!ok) return;
    // 결제를 마치면 그로블 결제 완료 화면의 '매칭권 확인하기'로 이 화면에 돌아온다. 돌아오면 이 주문의 지급을 확인한다.
    savePending({ purchaseId: target.purchaseId, units: PRODUCT.units, orderNumber: target.orderNumber || undefined });
    window.location.assign(target.url);
  }

  function stopWaiting() {
    savePending(null);
    setWaiting(null);
    reload();
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
            <p className="record-note">
              매칭권 {PRODUCT.units}장 {won(PRODUCT.price)}(1장당 500원) · 결제 완료 확인 후 지급일부터 330일간 사용 · 요청을 수락할 때 1장씩 사용해요. 수락에 쓴 매칭권은 거래가 취소돼도 돌아오지 않고, 공식 공연·예매 취소나 예매처·PICO 장애일 때만 <Link to="/inquiries?type=PASS_RESTORATION">매칭권 복원 요청</Link>을 받아 운영팀이 확인한 뒤 복원해요.
            </p>
            <p className="record-note">
              사용하지 않은 매칭권은 유효기간 안에 남은 장수 × 500원으로 환불돼요. 구매 후 7일 안에는 그로블 주문조회에서 취소를 요청하고, 그 뒤에는 <Link to="/inquiries?type=PASS_REFUND">매칭권 환불 요청</Link>으로 요청해 주세요.
            </p>
            {charged !== null && (
              <Notice tone="success">
                매칭권 {charged}장을 충전했어요. 지금 보유 {load.status === 'done' ? load.data.balance : '-'}장이에요.
                {(window.history.state?.idx ?? 0) > 0 && (
                  <>
                    {' '}
                    <button type="button" className="text-link" onClick={() => navigate(-1)}>
                      이전 화면으로 돌아가기
                    </button>
                  </>
                )}
              </Notice>
            )}
          </TxCard>
          <TxCard title="충전 내역">
            {load.status === 'done' && load.data.purchases.length ? (
              <div className="tx-history">
                {load.data.purchases.map((p) => (
                  <article key={String(p.purchaseId)} className="content-card">
                    <div>
                      <span className={`tx-status ${p.grantedAt ? 'blue' : 'amber'}`}>
                        {STATUS_NAMES[str(pick(p, 'payment.status')) ?? ''] ?? (p.grantedAt ? '충전 완료' : '결제 대기')}
                      </span>
                      <h3>매칭권 {num(p.purchasedUnits)}장</h3>
                      <p>{utcToLocal(str(p.createdAt) ?? '')}</p>
                      {(str(pick(p, 'payment.orderNumber')) || str(pick(p, 'payment.status'))) && (
                        <small>
                          {[
                            str(pick(p, 'payment.orderNumber')) && `주문번호 ${str(pick(p, 'payment.orderNumber'))}`,
                            str(pick(p, 'payment.status')) && `결제 상태: ${PAYMENT_NAMES[str(pick(p, 'payment.status')) ?? ''] ?? str(pick(p, 'payment.status'))}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
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
            <p className="record-note">
              결제했는데 매칭권이 들어오지 않았다면 주문번호를 적어 <Link to="/inquiries">문의</Link>해 주세요.
            </p>
          </TxCard>
        </div>
        <aside className="tx-side">
          <section className="content-card">
            <h2>충전 금액</h2>
            <div className="total-row">
              <span>
                매칭권 <b>{PRODUCT.units}</b>장
              </span>
              <strong>{won(PRODUCT.price)}</strong>
            </div>
            <div className="quote-agreements">
              <label className="check-row">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                매칭권 충전 및 사용 조건 동의 (필수)
              </label>
            </div>
            <button type="button" className="btn primary full" disabled={!agreed || pending || !!waiting} onClick={buy}>
              {pending ? '결제창으로 이동 중…' : '그로블에서 결제하기'}
            </button>
            {waiting ? (
              <Notice>
                결제 결과를 확인하고 있어요. 그로블에서 결제를 마쳤다면 잠시 후 매칭권이 자동으로 충전돼요. 다시 결제하지 마세요.
                {waiting.orderNumber ? ` 주문번호: ${waiting.orderNumber}.` : ''}{' '}
                <button type="button" className="text-link" onClick={stopWaiting}>
                  결제하지 않았어요
                </button>
              </Notice>
            ) : (
              <Notice>그로블 결제창으로 이동해요. 카드·카카오페이·네이버페이로 결제할 수 있고, 결제를 마치면 이 화면으로 돌아와요.</Notice>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
