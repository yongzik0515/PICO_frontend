import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api, unwrap } from '../api/client';
import { loadPortOne } from '../api/portone';
import { list, num, pick, str, type Raw } from '../api/pick';
import { useLoad } from '../transactions/model';
import { Field, Notice, TxCard, useAction, utcToLocal, won } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';

// 프로토타입 transactions.js의 creditsPage(). 도우미가 요청을 수락할 때 매칭권 1장이 차감된다.
// 명세: 판매 패키지는 1회 500원(단건)과 10회 5,000원. 구매 생성(POST /purchases) → PortOne 결제창 → 승인(POST /purchases/{id}/payment, txId를 pgPaymentKey로)
// 금액은 서버가 수량으로 정한다. 화면의 금액은 안내용이며, 결제창에는 서버가 돌려준 주문 금액을 쓴다.
const PACKS = [
  { units: 1, price: 500 },
  { units: 10, price: 5000 },
] as const;
const PENDING_KEY = 'pico.pendingPassPayment';

type Pending = { purchaseId: number; orderNumber: string; units: number };
const savePending = (p: Pending | null) => {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // 저장 불가(사생활 보호 모드 등)면 모바일 결제창에서 돌아왔을 때 자동 승인만 못 한다.
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

type Buyer = { email: string; name: string; phone: string };
const validPhone = (v: string) => /^\+?[0-9 ()-]{8,25}$/.test(v.trim()) && v.replace(/\D/g, '').length >= 9;

/**
 * PortOne 결제창을 띄우고 txId를 돌려준다.
 * KG이니시스 일반결제는 구매자 이름·휴대폰 번호·이메일이 모두 필수다(없으면 결제창 호출이 실패한다).
 * 모바일 등 결제창이 페이지를 이동하는 환경에서는 redirectUrl로 돌아오고, 결과는 주소의 paymentId·txId·code로 전달된다(아래 useEffect가 이어서 승인한다).
 */
async function payWithPortOne(orderNumber: string, amount: number, units: number, buyer: Buyer) {
  const config = await unwrap<{ storeId: string; channelKey: string }>(api.GET('/api/payments/checkout-config'));
  const PortOne = await loadPortOne();
  const res = await PortOne.requestPayment({
    storeId: config.storeId,
    channelKey: config.channelKey,
    paymentId: orderNumber,
    orderName: `PICO 매칭권 ${units}회`,
    totalAmount: amount,
    currency: 'CURRENCY_KRW',
    payMethod: 'CARD',
    customer: { fullName: buyer.name, phoneNumber: buyer.phone.trim(), email: buyer.email },
    redirectUrl: `${window.location.origin}/credits`,
  });
  if (!res || res.code) throw new Error(res?.message || '결제를 완료하지 못했어요.');
  if (!res.txId) throw new Error('결제 결과를 확인하지 못했어요.');
  return res.txId;
}

export function CreditsPage() {
  const [load, reload] = useLoad(async () => {
    const [balance, purchases, me, contacts] = await Promise.all([
      unwrap(api.GET('/api/matching-passes/balance')).then((b) => num(pick(b, 'remainingUnits')) ?? 0),
      unwrap<unknown>(api.GET('/api/matching-passes/purchases', { params: { query: { page: 0, size: 20 } } })).then(list, () => [] as Raw[]),
      unwrap<Raw>(api.GET('/api/me')).catch(() => ({}) as Raw),
      unwrap<unknown>(api.GET('/api/me/contacts')).then(list, () => [] as Raw[]),
    ]);
    // 결제창에 보낼 구매자 정보: 로그인 이메일, 닉네임, 등록한 휴대폰 번호(공개용 우선)
    const phones = contacts.filter((c) => str(c.kind) === 'PHONE');
    const phone = str((phones.find((c) => c.isPrimary === true) ?? phones[0])?.value) ?? '';
    const buyer: Buyer = { email: str(pick(me, 'email')) ?? '', name: str(pick(me, 'nickname')) ?? '', phone };
    return { balance, purchases, buyer };
  }, []);
  const { pending, run } = useAction();
  const toast = useToast();
  const [agreed, setAgreed] = useState(false);
  // 결제창에서 카드 결제를 마쳤는데 서버가 PG 결과를 아직 확인하지 못한 상태(승인 API 503·PROCESSING)
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();
  const [units, setUnits] = useState<number>(10);
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const savedBuyer = load.status === 'done' ? load.data.buyer : null;
  const phone = phoneInput ?? savedBuyer?.phone ?? '';
  const pack = PACKS.find((x) => x.units === units) ?? PACKS[1];
  const [search, setSearch] = useSearchParams();
  const resumed = useRef(false);

  /** 결제창 결과(txId)로 승인한다. 결과를 못 받았으면(503·PROCESSING) 이미 결제된 것이므로 다시 결제하게 하지 않는다. */
  async function approve(purchaseId: number, pgPaymentKey: string) {
    try {
      const paid = await unwrap<Raw>(api.POST('/api/matching-passes/purchases/{purchaseId}/payment', { params: { path: { purchaseId } }, body: { pgPaymentKey } }));
      return str(pick(paid, 'status'))?.toUpperCase() === 'PROCESSING';
    } catch (e) {
      // 명세: PG 결과를 확인하지 못하면 결제는 PROCESSING으로 남고 503이다. 카드 결제는 이미 끝났으니 다시 결제하게 하면 안 된다.
      if (e instanceof ApiError && e.status === 503) return true;
      throw e;
    }
  }

  /** 승인 뒤 공통 마무리: 확인 중이면 안내하고, 충전됐으면 들어오기 전 화면으로 돌아간다. */
  function finish(processing: boolean, chargedUnits: number) {
    savePending(null);
    if (processing) {
      setConfirming(true);
      reload();
      return;
    }
    toast(`매칭권 ${chargedUnits}장을 충전했어요.`);
    // 충전은 보통 요청을 수락하려고 하므로, 충전을 마치면 들어오기 전 화면(받은 요청·매칭 관리·요청 상세)으로 돌아간다.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate('/leads', { replace: true });
  }

  async function buy() {
    // 결제창 호출에 필요한 구매자 정보를 먼저 확인한다(주문을 만든 뒤 결제창이 실패해 대기 주문이 남지 않도록).
    if (!savedBuyer?.email) return void toast('구매자 이메일을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    if (!validPhone(phone)) return void toast('결제에 필요한 휴대폰 번호를 입력해 주세요. 예: 010-1234-5678');
    const buyer: Buyer = { email: savedBuyer.email, name: savedBuyer.name || '회원', phone };
    const result = { processing: false };
    const ok = await run(async () => {
      const purchase = await unwrap<Raw>(api.POST('/api/matching-passes/purchases', { body: { purchasedUnits: pack.units } }));
      const purchaseId = num(pick(purchase, 'purchaseId'));
      const orderNumber = str(pick(purchase, 'payment.orderNumber'));
      const amount = num(pick(purchase, 'payment.amountKrw', 'priceKrw')) ?? pack.price;
      if (!purchaseId || !orderNumber) throw new Error('구매 주문을 만들지 못했어요.');
      // 결제창이 페이지를 이동시키는 환경(모바일)에서는 돌아온 뒤 이 주문을 이어서 승인한다.
      savePending({ purchaseId, orderNumber, units: pack.units });
      const pgPaymentKey = await payWithPortOne(orderNumber, amount, pack.units, buyer);
      result.processing = await approve(purchaseId, pgPaymentKey);
    });
    if (!ok) {
      savePending(null);
      return;
    }
    finish(result.processing, pack.units);
  }

  // 모바일 결제창에서 redirectUrl(/credits?paymentId=…&txId=…&code=…)로 돌아왔을 때 결제를 이어서 승인한다.
  useEffect(() => {
    const paymentId = search.get('paymentId');
    if (!paymentId || resumed.current) return;
    resumed.current = true;
    const code = search.get('code');
    const txId = search.get('txId');
    const message = search.get('message');
    const saved = loadPending();
    setSearch({}, { replace: true }); // 새로고침해도 다시 승인하지 않도록 주소에서 결과를 지운다.
    if (code) {
      savePending(null);
      toast(message || '결제를 완료하지 못했어요.');
      return;
    }
    if (!txId || !saved || saved.orderNumber !== paymentId) {
      toast('결제 결과를 확인하지 못했어요. 충전 내역에서 확인해 주세요.');
      reload();
      return;
    }
    void (async () => {
      const result = { processing: false };
      const ok = await run(async () => {
        result.processing = await approve(saved.purchaseId, txId);
      });
      if (ok) finish(result.processing, saved.units);
      else reload();
    })();
    // 처음 한 번만 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <div className="pack-grid" role="radiogroup" aria-label="충전할 매칭권 수량">
              {PACKS.map((x) => (
                <label key={x.units} className={`pack ${x.units === units ? 'selected' : ''}`}>
                  <input type="radio" name="pack" checked={x.units === units} disabled={pending || confirming} onChange={() => setUnits(x.units)} />
                  <span>{x.units === 1 ? '한 장씩' : '묶음'}</span>
                  <strong>{x.units}장</strong>
                  <b>{won(x.price)}</b>
                </label>
              ))}
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
                        {p.grantedAt ? '충전 완료' : ({ FAILED: '결제 실패', EXPIRED: '결제 만료', CANCELLED: '결제 취소', PROCESSING: '결제 확인 중' } as Record<string, string>)[str(pick(p, 'payment.status')) ?? ''] ?? '결제 대기'}
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
                매칭권 <b>{pack.units}</b>장
              </span>
              <strong>{won(pack.price)}</strong>
            </div>
            <Field label="결제자 휴대폰 번호" required helper="카드 결제창에 필요해요. 결제 확인에만 쓰이고 저장하지 않아요.">
              <input inputMode="tel" maxLength={25} placeholder="예: 010-1234-5678" value={phone} disabled={pending || confirming} onChange={(e) => setPhoneInput(e.target.value)} />
            </Field>
            {savedBuyer?.email && <p className="record-note">결제자 이메일 {savedBuyer.email}</p>}
            <div className="quote-agreements">
              <label className="check-row">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                매칭권 충전 및 사용 조건 동의 (필수)
              </label>
            </div>
            <button type="button" className="btn primary full" disabled={!agreed || pending || confirming || !validPhone(phone)} onClick={buy}>
              {pending ? '결제 진행 중…' : '매칭권 충전하기'}
            </button>
            {confirming ? (
              <Notice tone="error">
                카드 결제는 마쳤고 결제 결과를 확인하고 있어요. 다시 결제하지 마세요. 결제가 확인되면 매칭권이 자동으로 충전돼요. 잠시 후 충전 내역에서 확인해 주세요.
              </Notice>
            ) : (
              <Notice>카드 결제창(PortOne)이 열려요. 결제 테스트 중에는 실제 결제 뒤 자동 취소될 수 있어요.</Notice>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
