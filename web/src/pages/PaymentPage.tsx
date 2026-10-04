import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { num, pick, str, type Raw } from '../api/pick';
import { fetchDetail, latestAgreement, useLoad } from '../transactions/model';
import { agreementRows } from '../transactions/requestRows';
import { Notice, Rows, TxCard, useAction, utcToLocal, won } from '../transactions/ui';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';

// 프로토타입 transactions.js의 paymentPage(). 명세상 안전거래는 가상계좌로 착수비+수고비+수수료를 한 번에 결제한다.
// 1) POST /api/agreements/{id}/safe-payment → 결제 주문(가상계좌 발급, 이미 있으면 기존 주문을 돌려줌)
// 2) GET /api/payments/{id}/virtual-account → 입금 계좌 안내
// 3) POST /api/payments/{id}/confirm → 서버가 PG에 입금 여부를 확인해 PAID로 확정(입금 전이면 PENDING 그대로)
type VirtualAccount = { bankName?: string; accountNumber?: string; accountHolder?: string; amountKrw?: number; depositDueAt?: string };


export function PaymentPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [load] = useLoad(() => fetchDetail(requestId), [requestId]);
  const { pending, run } = useAction();
  const [agreed, setAgreed] = useState({ terms: false, consent: false });
  const [order, setOrder] = useState<{ paymentId: number; account: VirtualAccount | null } | null>(null);

  async function loadAccount(paymentId: number) {
    const account = await unwrap<VirtualAccount>(api.GET('/api/payments/{paymentId}/virtual-account', { params: { path: { paymentId } } })).catch(() => null);
    setOrder({ paymentId, account });
  }

  // 이미 만든 입금 대기 주문이 있으면(발급받고 나갔다 온 경우) 계좌 안내를 이어서 보여 준다.
  // 요청·합의 응답에 결제 상태가 있으면 결제 상세를 따로 불러오지 않으므로(fetchDetail) 거기서도 찾는다.
  const loaded = load.status === 'done' ? load.data : null;
  const loadedAgreement = loaded ? latestAgreement(loaded.agreements) : undefined;
  const existingStatus = (str(pick(loaded?.payment ?? null, 'status')) || loadedAgreement?.paymentStatus || loaded?.request.paymentStatus || '').toUpperCase();
  const existingId = existingStatus === 'PENDING' ? (num(pick(loaded?.payment ?? null, 'paymentId')) ?? loadedAgreement?.paymentId ?? loaded?.request.paymentId) : undefined;
  useEffect(() => {
    if (existingId) void loadAccount(existingId);
  }, [existingId]);

  if (load.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>결제 정보를 불러오는 중이에요.</p>
      </div>
    );
  if (load.status === 'error')
    return (
      <div className="empty">
        <h1>결제 정보를 불러오지 못했어요</h1>
        <p>{load.message}</p>
      </div>
    );

  const { request: r, stage, agreements } = load.data;
  const a = latestAgreement(agreements);
  if (stage !== 'payment' || !a) return <Navigate to={`/requests/${requestId}`} replace />;
  const total = a.upfrontFeeKrw + a.successFeeKrw + a.safetyFeeKrw;
  const current = order;

  async function createOrder() {
    await run(async () => {
      const p = await unwrap<Raw>(api.POST('/api/agreements/{agreementId}/safe-payment', { params: { path: { agreementId: a!.id } } }));
      const paymentId = num(pick(p, 'paymentId'));
      if (!paymentId) throw new Error('결제 주문 번호를 받지 못했어요.');
      await loadAccount(paymentId);
    }, '가상계좌를 발급했어요. 기한 안에 입금해 주세요.');
  }

  async function confirm(paymentId: number) {
    await run(async () => {
      // 명세: 안전거래(가상계좌) 결제 확인은 본문 없이 호출한다.
      const p = await unwrap<Raw>(api.POST('/api/payments/{paymentId}/confirm', { params: { path: { paymentId } } } as never));
      if (str(pick(p, 'status')) === 'PAID') {
        toast('입금을 확인했어요. 도우미가 예매를 준비해요.');
        navigate(`/requests/${requestId}`, { replace: true });
      } else toast('아직 입금이 확인되지 않았어요. 입금 후 다시 눌러 주세요.');
    });
  }

  const va = current?.account;

  return (
    <>
      <PageTitle title="안전거래 결제" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
      <div className="detail-layout tx-layout">
        <div>
          <TxCard title="결제 항목">
            <div className="tx-order-helper">
              <span className="tx-recipient-avatar">{r.agentName[0]}</span>
              <div>
                <strong>{r.agentName} 도우미</strong>
                <p>{r.targetName}</p>
              </div>
              <span className="tx-status blue">최종 조건 확정</span>
            </div>
            <div className="tx-order-items">
              {(
                [
                  ['ticket', '착수비', '예매 시도를 위한 비용', a.upfrontFeeKrw],
                  ['check', '수고비', '확정한 성공 요건을 충족했을 때 지급하는 비용', a.successFeeKrw],
                ] as const
              ).map(([icon, name, caption, amount]) => (
                <article key={name} className="tx-order-item">
                  <span className="tx-order-icon">
                    <Icon name={icon} size={24} />
                  </span>
                  <div>
                    <h3>{name}</h3>
                    <p>{caption}</p>
                  </div>
                  <strong>
                    {won(amount).replace('원', '')}
                    <small>원</small>
                  </strong>
                </article>
              ))}
            </div>
            <p className="tx-order-note">
              <Icon name="shield" size={18} />
              착수비와 수고비, 수수료를 가상계좌로 한 번에 입금해요.
            </p>
            <details className="tx-order-terms">
              <summary>확정한 진행 조건 보기</summary>
              <Rows rows={agreementRows(a)} />
            </details>
          </TxCard>
          {va && current && (
            <TxCard title="입금 계좌">
              <Rows
                rows={[
                  ['은행', va.bankName ?? ''],
                  ['계좌번호', va.accountNumber ?? ''],
                  ['예금주', va.accountHolder ?? ''],
                  ['입금액', won(va.amountKrw ?? total)],
                  ['입금 기한', utcToLocal(va.depositDueAt ?? '')],
                ]}
              />
              <Notice>입금액이 정확히 같아야 확인돼요. 기한이 지나면 주문이 취소돼요.</Notice>
            </TxCard>
          )}
          {current && !va && <Notice>입금 계좌를 불러오지 못했어요. 결제 연동이 준비되지 않았을 수 있어요.</Notice>}
        </div>
        <aside className="tx-side">
          <section className="content-card">
            <h2>주문 금액</h2>
            <div className="summary-rows">
              <div>
                <span>착수비</span>
                <strong>{won(a.upfrontFeeKrw)}</strong>
              </div>
              <div>
                <span>수고비</span>
                <strong>{won(a.successFeeKrw)}</strong>
              </div>
              <div>
                <span>안전거래 수수료</span>
                <strong>{won(a.safetyFeeKrw)}</strong>
              </div>
            </div>
            <p className="record-note">수수료는 수고비의 3%(원 단위 올림), 최소 1,000원이에요.</p>
            <div className="total-row">
              <span>총 결제 금액</span>
              <strong>{won(total)}</strong>
            </div>
            {!current && existingId ? (
              <p className="record-note" role="status">발급한 가상계좌를 불러오는 중이에요.</p>
            ) : current ? (
              <>
                <button type="button" className="btn primary full" disabled={pending} onClick={() => confirm(current.paymentId)}>
                  {pending ? '확인 중…' : '입금 확인'}
                </button>
                <Link className="btn ghost full" to={`/requests/${requestId}`}>
                  나중에 입금하기
                </Link>
                <button
                  type="button"
                  className="btn ghost full tx-danger"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const p = await unwrap<Raw>(api.POST('/api/payments/{paymentId}/cancel', { params: { path: { paymentId: current.paymentId } } }));
                      // 취소가 확인되지 않으면 CANCEL_REQUESTED로 남는다. 폐쇄 전에 입금됐으면 PAID와 함께 409가 온다.
                      if (str(pick(p, 'status')) === 'CANCEL_REQUESTED') toast('주문 취소를 요청했어요. 확인되면 반영돼요.');
                      else toast('입금 전 주문을 취소했어요. 조건을 다시 협의하거나 새로 결제할 수 있어요.');
                      navigate(`/requests/${requestId}`, { replace: true });
                    })
                  }
                >
                  입금 전 주문 취소
                </button>
              </>
            ) : (
              <>
                <div className="quote-agreements">
                  <label className="check-row">
                    <input type="checkbox" checked={agreed.terms && agreed.consent} onChange={(e) => setAgreed({ terms: e.target.checked, consent: e.target.checked })} />
                    전체 동의
                  </label>
                  {(
                    [
                      ['terms', '서비스 이용약관', '서비스의 이용 기준과 거래 진행 안내를 확인합니다.'],
                      ['consent', '안전거래 결제 및 환불 안내', '착수비는 착수 후 시도 증빙이 승인되거나 결과가 확정되면 도우미에게 정산됩니다(시도 증빙이 승인되지 않은 채 운영팀이 시도 미확인·결과 미제출로 종결하면 착수비도 환불). 수고비는 성공이면 전액, 부분 성공이면 정산한 금액만 정산되고, 실패하면 합의한 환불 조건에 따라 처리됩니다.'],
                    ] as const
                  ).map(([key, label, body]) => (
                    <div key={key} className="quote-agreement-row">
                      <label className="check-row">
                        <input type="checkbox" required checked={agreed[key]} onChange={(e) => setAgreed({ ...agreed, [key]: e.target.checked })} />
                        {label} (필수)
                      </label>
                      <details>
                        <summary>보기</summary>
                        <p>{body}</p>
                      </details>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn primary full" disabled={!agreed.terms || !agreed.consent || pending} onClick={createOrder}>
                  {pending ? '발급 중…' : `${won(total)} 가상계좌 발급받기`}
                </button>
                {/* 주소로 바로 들어와 이전 기록이 없으면 요청 상세로 보낸다. */}
                <button type="button" className="btn ghost full" onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(`/requests/${requestId}`))}>
                  돌아가기
                </button>
              </>
            )}
            <p className="record-note">결제 완료는 착수가 아니에요. 입금이 확인되면 도우미가 예매를 시작해요.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
