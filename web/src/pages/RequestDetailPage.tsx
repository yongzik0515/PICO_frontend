import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, unwrap, ApiError } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { findPolicy, loadPolicies } from '../api/policies';
import { PartialSettlementCard, RefundCard, refundCase } from '../transactions/Settlement';
import { DisputeCard } from '../transactions/Dispute';
import { MediationCard } from '../transactions/Mediation';
import { agreementRows, requestRows } from '../transactions/requestRows';
import { useAppState } from '../AppState';
import { useAuth } from '../auth/AuthContext';
import {
  fetchDetail,
  latestAgreement,
  resultNames,
  roleIn,
  useLoad,
  usedReviews,
  type Agreement,
  type Detail,
  type Evidence,
  type Role,
  type TxRequest,
} from '../transactions/model';
import { EvidenceFileNames, Field, NextStep, Notice, Progress, Rows, StatusBadge, TxCard, useAction, utcToLocal } from '../transactions/ui';
import { Icon } from '../ui/Icon';
import { ImagePreview } from '../ui/ImagePreview';
import { Modal } from '../ui/Modal';
import { PageTitle } from '../ui/PageTitle';
import { money } from '../ui/format';

// 프로토타입 transactions.js의 detailPage()/actions()/comparison()/progress()
// 상태 전환은 모두 명세의 요청·합의·증빙·결과 API를 쓴다. 어떤 버튼이 보일지는 model.ts의 stageOf()가 정한다.

const evidenceNames: Record<string, string> = { DRAFT: '작성 중', SUBMITTED: '확인 대기', APPROVED: '승인', REJECTED: '반려' };
// 결과 증빙은 운영팀 파일 검토 없이 거래 당사자에게 보인다(차단된 파일만 제외).
const scanNames: Record<string, string> = { PENDING: '첨부됨', CLEAN: '첨부됨', BLOCKED: '차단됨' };
const paymentNames: Record<string, string> = {
  PENDING: '입금 대기',
  PROCESSING: '확인 중',
  PAID: '결제 완료',
  CANCEL_REQUESTED: '취소·환불 진행 중',
  PARTIALLY_REFUNDED: '일부 환불',
  REFUNDED: '전액 환불',
  FAILED: '결제 실패',
  CANCELLED: '입금 전 취소',
  EXPIRED: '입금 기한 만료',
};
// 가이드 7장: 이 상태가 아닌 결제가 있으면 합의 변경·요청 취소가 409다.
const inactivePayment = ['FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'];


/** 최초 요청과 양측이 제안한 최종 조건을 나란히 보여 준다(프로토타입 comparison()). */
function Comparison({ r, a }: { r: TxRequest; a: Agreement }) {
  const pairs: [string, string, string][] = [
    ['희망 좌석·요청 내용', r.requirements, a.requirements],
    ['성공 요건', r.successConditions, a.successConditions],
    ['수고비', r.agencyBudgetMax !== undefined ? `최대 ${money(r.agencyBudgetMax)}원` : '미입력', `${money(a.successFeeKrw)}원`],
    ['착수비', '합의 시 작성', `${money(a.upfrontFeeKrw)}원`],
    ['거래 방식', '합의 시 작성', a.safePayment ? `안전거래 · 수수료 ${money(a.safetyFeeKrw)}원` : '직접 거래'],
    ['예매 시도 방식', '합의 시 작성', a.attemptRule],
    ['실패·환불 처리', '합의 시 작성', a.refundRule],
    ['결과 연락 기한', r.contactDeadlineRule || '합의 시 작성', a.contactDeadlineRule],
  ];
  return (
    <div className="tx-comparison">
      <div className="tx-comparison-head">
        <strong>항목</strong>
        <strong>최초 요청</strong>
        <strong>최종 조건</strong>
      </div>
      {pairs.map(([label, before, after]) => {
        const changed = before !== '합의 시 작성' && before !== after;
        return (
          <div key={label} className={changed ? 'changed' : ''}>
            <span>
              {label}
              {changed && <b>변경</b>}
            </span>
            <span style={{ whiteSpace: 'pre-line' }}>{before || '미입력'}</span>
            <strong style={{ whiteSpace: 'pre-line' }}>{after || '미입력'}</strong>
          </div>
        );
      })}
    </div>
  );
}

/** GET /requests/{id}/contacts 응답에서 {kind, value} 목록을 찾는다(응답 필드 미정). */
function contactRows(data: Raw | null): [string, string][] {
  const kindNames: Record<string, string> = { EMAIL: '이메일', PHONE: '전화번호', KAKAO: '카카오톡' };
  const candidates = [data, pick(data, 'contacts'), pick(data, 'counterpart.contacts'), pick(data, 'counterpartContacts')];
  for (const c of candidates) {
    const rows = (Array.isArray(c) ? c : list(c)).filter((x) => x && typeof x === 'object' && 'value' in x);
    if (rows.length) return rows.map((x) => [kindNames[str(x.kind) ?? ''] ?? str(x.kind) ?? '연락처', str(x.value) ?? '']);
  }
  return [];
}

function ReasonModal({ title, label, submitText, danger, onClose, onSubmit, children }: { title: string; label: string; submitText: string; danger?: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<unknown>; children?: ReactNode }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setPending(true);
    await onSubmit(reason.trim());
    setPending(false);
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form noValidate onSubmit={submit}>
        {children}
        <Field label={label} required>
          <textarea rows={4} required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            돌아가기
          </button>
          <button type="submit" className={`btn ${danger ? 'danger' : 'primary'}`} disabled={!reason.trim() || pending}>
            {pending ? '처리 중…' : submitText}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({ title, children, submitText, onClose, onConfirm }: { title: string; children: ReactNode; submitText: string; onClose: () => void; onConfirm: () => Promise<unknown> }) {
  const [pending, setPending] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      {children}
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onClose}>
          돌아가기
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await onConfirm();
            setPending(false);
          }}
        >
          {pending ? '처리 중…' : submitText}
        </button>
      </div>
    </Modal>
  );
}

function ResultModal({ r, upfrontApplies, onClose, onSubmit }: { r: TxRequest; upfrontApplies: boolean; onClose: () => void; onSubmit: (agreed: boolean, note: string) => Promise<unknown> }) {
  // 되돌릴 수 없는 선택이라 기본값 없이 직접 고르게 한다.
  const [agreed, setAgreed] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const missingReason = agreed === false && !note.trim();
  return (
    <Modal title="예매 결과 확인" onClose={onClose}>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (agreed === null || missingReason) return;
          setPending(true);
          await onSubmit(agreed, note.trim());
          setPending(false);
        }}
      >
        <p className="prose">
          도우미는 <strong>{r.agentResult ? resultNames[r.agentResult] : '-'}</strong>(으)로 등록했어요. 결과 증빙과 내용을 확인하고 동의하거나 이의를 제기해 주세요.
        </p>
        <fieldset className="tx-methods">
          <legend>결과 확인</legend>
          <label>
            <input type="radio" name="agreed" checked={agreed === true} onChange={() => setAgreed(true)} />
            <span>
              <strong>동의해요</strong>
              <small>도우미가 등록한 결과로 거래가 완료돼요.</small>
            </span>
          </label>
          <label>
            <input type="radio" name="agreed" checked={agreed === false} onChange={() => setAgreed(false)} />
            <span>
              <strong>이의 제기할게요</strong>
              <small>운영팀이 증빙을 보고 결과 조정안을 제안해요. 증빙이 없으면 도우미에게 제출을 요청해요.</small>
            </span>
          </label>
        </fieldset>
        {agreed === true && r.agentResult === 'FAILURE' && upfrontApplies && (
          <Notice>동의하면 결과가 확정돼 착수비는 도우미 몫이 되고 환불되지 않아요. 도우미가 예매를 시도하지 않았다고 생각되면 '이의 제기할게요'를 골라 주세요.</Notice>
        )}
        {agreed !== null && (
        <Field
          label={agreed ? '확인 메모' : '이의 사유'}
          required={!agreed}
          helper={agreed ? undefined : '이의 사유는 도우미에게도 보여요. 도우미에게 보이면 안 되는 내용은 이의 제기 후 분쟁 소명에 남겨 주세요(운영팀만 봐요).'}
        >
          <textarea rows={3} required={!agreed} maxLength={10000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={agreed ? '선택 입력' : r.agentResult === 'FAILURE' ? '예: 시도 증빙 화면의 시각이 티켓 오픈 시간과 달라서 실제로 예매를 시도했는지 확인할 수 없어요.' : '예: 안내받은 좌석과 실제 예매 좌석이 달라요.'} />
        </Field>
        )}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            돌아가기
          </button>
          <button type="submit" className="btn primary" disabled={agreed === null || missingReason || pending}>
            {pending ? '처리 중…' : agreed === null ? '동의 또는 이의를 골라 주세요' : agreed ? '결과에 동의' : '이의 제기'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type Dialog = '' | 'accept' | 'reject' | 'cancel' | 'agree' | 'revision' | 'start' | 'result' | 'deleteReview' | 'withdraw';

export function RequestDetailPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const { me } = useAuth();
  const [{ mode }] = useAppState();
  const [load, reload] = useLoad(() => fetchDetail(requestId), [requestId], { refreshOnFocus: true });
  const [hasContact, setHasContact] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<Dialog>('');
  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawNote, setWithdrawNote] = useState('');
  // 거래 동작이 409면 상대방 진행·기한 경과 등으로 상태가 바뀐 것이다. 서버 메시지를 보여 주고 최신 상세를 다시 불러온다.
  const { pending, run } = useAction({
    onConflict: () => {
      setDialog('');
      reload();
    },
  });

  if (load.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>요청을 불러오는 중이에요.</p>
      </div>
    );
  if (load.status === 'error')
    return (
      <>
        <PageTitle title="요청을 찾을 수 없어요" crumbs={[{ label: '내 활동', to: '/requests' }]} />
        <div className="empty">
          <p>{load.message}</p>
          <button className="btn secondary" onClick={() => navigate(mode === 'agent' ? '/matches' : '/requests')}>
            목록으로
          </button>
        </div>
      </>
    );

  const d: Detail = load.data;
  const r = d.request;
  const role: Role = roleIn(r, me, mode);
  const agent = role === 'agent';
  const other = agent ? '이용자' : '도우미';
  const stage = d.stage;
  const latest = latestAgreement(d.agreements);
  const proposalMine = latest?.proposedByRole === (agent ? 'AGENT' : 'REQUESTER');
  const finalized = latest?.status === 'FINALIZED' ? latest : undefined;
  const previous = d.agreements.filter((a) => a !== latest).sort((a, b) => b.version - a.version);
  const latestEvidence = d.evidences[0];
  const contacts = contactRows(d.contacts);
  const paymentStatus = (str(pick(d.payment, 'status')) || latest?.paymentStatus || r.paymentStatus || '').toUpperCase();
  // 요청 요약의 paymentId를 쓰고, 없으면 부분성공 정산의 결제 번호로 대신한다.
  const paymentId = num(pick(d.payment, 'paymentId')) ?? latest?.paymentId ?? r.paymentId ?? num(pick(d.partial, 'paymentId'));
  const hasActivePayment = (!!paymentStatus && !inactivePayment.includes(paymentStatus)) || (!paymentStatus && !!finalized?.safePayment && stage === 'ready');
  const final = r.finalResult ?? (r.status === 'COMPLETED' && r.requesterResult === r.agentResult ? r.agentResult : undefined);
  // 착수비 선지급·지급 안내는 안전거래이고 착수비가 있을 때만 맞는 말이다.
  const upfrontApplies = !!finalized?.safePayment && (finalized?.upfrontFeeKrw ?? 0) > 0;
  // 이용자 결과 확인 기한(서버 계산). 도우미가 결과 뒤 증빙을 추가하면 다시 72시간.
  const confirmDue = r.resultConfirmDueAt ? utcToLocal(r.resultConfirmDueAt) : '';
  // 도우미가 결과를 내지 않아 운영팀이 종결한 거래(결과 없이 완료)
  const noResultClosed = r.status === 'COMPLETED' && !r.agentResult && !!r.adminResolutionNote;
  const counterpartId = agent ? r.requesterId : r.agentId;
  const counterpartName = agent ? r.requesterName : r.agentName;
  const path = { params: { path: { requestId } } };
  const close = () => setDialog('');
  const act = (action: () => Promise<unknown>, message: string) =>
    run(action, message).then((ok) => {
      if (ok) {
        close();
        reload();
      }
    });

  async function openAccept() {
    setDialog('accept');
    const [b, mine] = await Promise.all([unwrap(api.GET('/api/matching-passes/balance')).catch(() => null), unwrap<unknown>(api.GET('/api/me/contacts')).then(list, () => null)]);
    setBalance(num(pick(b, 'remainingUnits')) ?? null);
    // 서버는 공개용(isPrimary=true) 연락처가 있어야 수락을 허용한다.
    setHasContact(mine === null ? null : mine.some((c) => c.isPrimary === true));
  }

  async function accept() {
    const contactSharingDocumentId = findPolicy(await loadPolicies(), 'CONTACT_SHARING').id;
    await run(async () => {
      if (!contactSharingDocumentId) throw new Error('연락처 공유 동의 문서를 불러오지 못했어요.');
      try {
        await unwrap(api.POST('/api/requests/{requestId}/accept', { ...path, body: { contactSharingDocumentId } }));
      } catch (e) {
        // 명세: 매칭권 잔액 부족은 409
        if (e instanceof ApiError && e.status === 409 && balance !== null && balance < 1) throw new Error('매칭권이 부족해요. 충전한 뒤 다시 수락해 주세요.');
        throw e;
      }
    }, '요청을 수락했어요. 최종 조건을 작성해 주세요.').then((ok) => {
      if (ok) {
        close();
        reload();
      }
    });
  }

  const back = agent ? (r.status === 'PENDING' ? { label: '받은 요청', to: '/leads' } : { label: '매칭 관리', to: '/matches' }) : { label: '내 활동', to: '/requests' };

  /** 시도 증빙 카드 안내. 착수비 문구는 안전거래·착수비가 있을 때만, 종결 방식에 맞춰 보여 준다. */
  function attemptNote() {
    if (r.status === 'COMPLETED' || r.status === 'CANCELLED') {
      if (!upfrontApplies) return '';
      return r.upfrontForfeited ? '운영팀 종결로 착수비는 지급되지 않았어요.' : '결과가 확정돼 착수비 지급 대상이에요.';
    }
    // 서버 기준: 안전거래·착수비가 있는 거래에서 착수 후 시도 증빙이 승인되거나 결과가 확정되면, 정산 계좌 등 지급 조건을 확인해 지급을 요청한다.
    const upfront = upfrontApplies ? ' 결과가 확정되면 착수비 지급을 요청해요(정산 계좌 등록 필요, 운영팀이 예매 시도 미확인·결과 미제출로 종결하면 지급하지 않아요).' : '';
    if (agent) {
      if (latestEvidence?.status === 'REJECTED')
        return stage === 'in_progress'
          ? '반려 사유를 반박할 자료가 있으면 다시 올려 주세요(선택). 반려된 증빙으로도 결과를 등록할 수 있어요.' + upfront
          : "반려 사유를 반박할 자료가 있으면 '추가 자료 올리기'로 올려 주세요. 이용자가 바로 보고, 이의가 생기면 운영팀이 함께 판단해요." + upfront;
      return upfrontApplies
        ? '안전거래라서 결과가 확정되면 착수비 지급을 요청해요. 지급은 정산 계좌가 등록돼 있어야 진행되고, 운영팀이 예매 시도 미확인·결과 미제출로 종결하면 지급하지 않아요.'
        : '실패로 결과를 등록할 때 이 증빙이 근거가 돼요.';
    }
    return upfrontApplies
      ? '시도 증빙은 실패 결과의 근거가 돼요. 결과가 확정되면 착수비는 도우미 몫이 되고, 운영팀이 예매 시도 미확인·결과 미제출로 종결하면 착수비도 환불돼요.'
      : '시도 증빙은 실패 결과의 근거가 돼요.';
  }

  function actions() {
    const go = (to: string, text: string, cls = 'primary') => (
      <button type="button" className={`btn ${cls} full`} onClick={() => navigate(to)}>
        {text}
      </button>
    );
    const btn = (text: string, onClick: () => void, cls = 'primary') => (
      <button type="button" className={`btn ${cls} full`} disabled={pending} onClick={onClick}>
        {text}
      </button>
    );
    // 가이드 6-1: MATCHED에서는 진행 중인 결제가 없을 때만 당사자가 취소할 수 있다. 이용자가 취소하면 도우미의 매칭권이 복구되고, 도우미가 취소하면 복구되지 않는다.
    const cancelMatched =
      r.status === 'MATCHED' && !hasActivePayment ? (
        <button type="button" className="btn ghost full tx-danger" disabled={pending} onClick={() => setDialog('cancel')}>
          거래 취소
        </button>
      ) : null;
    // 안전거래 확정 후 결제 전에는 양측이 조건을 다시 제안할 수 있다(새 버전이 확정되면 이전 확정본은 대체).
    const repropose = finalized && !hasActivePayment && (stage === 'ready' || stage === 'payment') ? go(`/requests/${r.id}/terms`, '조건 다시 제안하기', 'ghost') : null;
    switch (stage) {
      case 'policy_blocked':
        return agent ? (
          <Notice>운영 정책상 수락할 수 없는 요청이에요.</Notice>
        ) : (
          <>
            <Notice tone="error">해당 공연·예매처는 도움 요청을 진행할 수 없어요. 내용을 수정하면 다시 검토해요.</Notice>
            <div className="tx-request-actions">
              {r.agentId ? go(`/quote/${r.agentId}?edit=${r.id}`, '요청 내용 수정') : null}
              {btn('요청 취소', () => setDialog('cancel'), 'ghost tx-danger')}
            </div>
          </>
        );
      case 'policy_review':
      case 'pending':
        return agent ? (
          stage === 'pending' ? (
            <>
              {btn('요청 수락하기', openAccept)}
              {btn('요청 거절', () => setDialog('reject'), 'ghost')}
            </>
          ) : (
            <Notice>운영팀 검토가 끝나면 수락할 수 있어요.</Notice>
          )
        ) : (
          <>
            <Notice>{stage === 'policy_review' ? '운영팀이 요청을 검토하고 있어요.' : '도우미의 응답을 기다리고 있어요.'}</Notice>
            <div className="tx-request-actions">
              {r.agentId ? go(`/quote/${r.agentId}?edit=${r.id}`, '요청 내용 수정') : null}
              {btn('요청 취소', () => setDialog('cancel'), 'ghost tx-danger')}
            </div>
          </>
        );
      case 'terms_needed':
      case 'revision_requested':
        return (
          <>
            {stage === 'terms_needed' && !agent ? <Notice>도우미가 첫 최종 조건을 작성하고 있어요.</Notice> : go(`/requests/${r.id}/terms`, stage === 'revision_requested' ? '최종 조건 수정하기' : '최종 조건 작성하기')}
            {cancelMatched}
          </>
        );
      case 'terms_sent':
        return proposalMine ? (
          <Notice>{other}의 최종 확인을 기다리고 있어요.</Notice>
        ) : (
          <>
            {btn('확인하고 확정하기', () => setDialog('agree'))}
            {go(`/requests/${r.id}/terms`, '조건 수정해서 제안하기')}
            {cancelMatched}
          </>
        );
      case 'payment':
        return (
          <>
            {agent ? <Notice>이용자가 입금하면 알려드릴게요.</Notice> : go(`/requests/${r.id}/payment`, '안전거래 결제하기')}
            {repropose}
            {cancelMatched}
          </>
        );
      case 'ready':
        // 이용자가 확정된 조건에 변경을 요청했으면 도우미가 새 조건을 보낼 때까지 착수할 수 없다(서버 409).
        if (r.agreementChangePending)
          return agent ? (
            <>
              <Notice tone="error">확정된 조건의 변경 요청이 있어 지금은 착수할 수 없어요. 요청 내용을 확인하고 조건을 다시 제안해 주세요.</Notice>
              {go(`/requests/${r.id}/terms`, '조건 다시 제안하기')}
              {cancelMatched}
            </>
          ) : (
            <>
              <Notice>조건 변경 요청이 있어 지금은 착수하지 않아요. 양측 모두 새 조건을 제안할 수 있고, 도우미가 보내면 다시 검토해 주세요.</Notice>
              {cancelMatched}
            </>
          );
        return (
          <>
            {agent ? btn('예매 착수하기', () => setDialog('start')) : <Notice tone="success">{finalized?.safePayment ? '결제를 마쳤어요. 도우미의 착수를 기다려 주세요.' : '조건을 확정했어요. 도우미의 착수를 기다려 주세요.'}</Notice>}
            {repropose}
            {cancelMatched}
          </>
        );
      case 'in_progress':
        return agent ? (
          <>
            {latestEvidence?.status === 'REJECTED' && (
              <Notice tone="error">
                이용자가 시도 증빙을 반려했어요{latestEvidence.reviewNote ? ` (사유: ${latestEvidence.reviewNote})` : ''}. 예매를 마쳤다면 바로 결과를 등록하면 돼요. 실패도 반려된 증빙으로 등록할 수 있고, 이용자가 동의하지 않으면 운영팀이 판단해요.
              </Notice>
            )}
            {go(`/requests/${r.id}/result`, '결과 등록')}
          </>
        ) : (
          <>
            <Notice>도우미가 예매를 진행하고 있어요. 시도 증빙이 올라오면 확인해 주세요.</Notice>
            {counterpartId && (
              <>
                <button
                  type="button"
                  className="btn ghost full"
                  onClick={() => navigate(`/report?requestId=${r.id}&userId=${counterpartId}&name=${encodeURIComponent(counterpartName)}&topic=no-result`)}
                >
                  도우미가 결과를 등록하지 않나요? 운영팀에 알리기
                </button>
                <p className="record-note">
                  운영팀이 확인해 결과 미제출로 종결하면
                  {!finalized?.safePayment
                    ? ' 거래가 실패로 끝나요.'
                    : upfrontApplies
                      ? ' 성공보수를 환불받을 수 있어요. 착수비는 시도 증빙을 승인했거나 지급이 시작됐으면 도우미 몫이라 환불되지 않고, 그렇지 않으면 함께 환불돼요(이용료 제외).'
                      : ' 성공보수를 환불받을 수 있어요(이용료 제외).'}
                </p>
              </>
            )}
          </>
        );
      case 'result_submitted':
        return agent ? (
          <>
            <Notice>이용자가 결과를 확인하고 있어요. {confirmDue ? `${confirmDue}까지` : '3일 동안'} 답이 없으면 운영팀이 확정할 수 있어요. 추가 자료를 올리면 그때부터 다시 3일이에요.</Notice>
            {go(`/requests/${r.id}/result`, '추가 자료 올리기', 'secondary')}
          </>
        ) : (
          <>
            {btn('예매 결과 확인하기', () => setDialog('result'))}
            <Notice>{confirmDue ? `${confirmDue}까지` : '3일 안에'} 동의하거나 이의를 제기해 주세요. 답이 없으면 운영팀이 확정할 수 있어요.</Notice>
          </>
        );
      case 'disputed':
        return agent ? (
          <>
            <Notice>이용자가 결과에 이의를 제기해 운영팀이 확인하고 있어요. 아래 '분쟁 소명·추가 자료'에 설명과 예매 내역 등 자료를 함께 올려 주세요. 운영팀만 볼 수 있어요.</Notice>
          </>
        ) : (
          <>
            <Notice>이의를 접수했어요. 아래 '분쟁 소명·추가 자료'에 자세한 내용과 자료를 남겨 주시면 운영팀이 보고 결과 조정안을 제안해요. 이용자와 도우미가 모두 수락하면 확정돼요.</Notice>
            {/* POST /dispute/withdraw: 안전거래 이용자만, DISPUTED에서. 도우미가 등록한 결과로 확정된다. */}
            {finalized?.safePayment && r.agentResult && btn('이의 철회하고 도우미 결과에 동의', () => setDialog('withdraw'), 'secondary')}
          </>
        );
      case 'matching_completed':
      case 'completed':
        if (agent || d.review) return <Notice tone="success">{d.review ? '이용자가 거래 후기를 남겼어요.' : stage === 'matching_completed' ? '직접 거래 매칭을 완료했어요. 착수·결과 등록 없이 당사자끼리 진행해 주세요.' : '거래 결과 확인을 완료했어요.'}</Notice>;
        // 가이드 12-1: 거래당 후기 1개, 삭제·숨김 후에도 다시 쓸 수 없다(서버 409). 상세 응답의 reviewWritten으로 가린다.
        if (r.reviewWritten || usedReviews.has(r.id)) return <Notice>이 거래의 후기는 이미 작성했어요(삭제·숨김 포함). 거래당 후기는 한 번만 쓸 수 있어 다시 작성할 수 없어요.</Notice>;
        return go(`/requests/${r.id}/review`, '후기 작성');
      default:
        return <Notice>{r.closeReason ? `사유: ${r.closeReason}` : '응답이 종료된 요청이에요.'}</Notice>;
    }
  }

  const resultCardShown = !!finalized?.safePayment && !!r.agentResult;
  // 부분 성공 정산 카드가 보이면 이용자 환불 요청·내역은 그 카드 맨 아래에 둔다(결제 카드에서는 뺀다).
  const partialCardShown = r.status === 'COMPLETED' && final === 'PARTIAL' && !!finalized?.safePayment;
  const refundCard = !agent && paymentId && finalized ? <RefundCard paymentId={paymentId} refunds={d.refunds} can={refundCase(r, final, d.partial, paymentStatus, finalized.upfrontFeeKrw)} reload={reload} /> : null;
  // 실패 결과의 증빙은 시도 증빙으로 올라간다. 결과 카드에 사진과 승인·반려를 함께 보여 준다.
  const failureCard = resultCardShown && r.agentResult === 'FAILURE' && d.evidences.length > 0;
  const attemptEvidenceBody = (
    <>
      {d.evidences.map((e: Evidence) => {
        const files = (e.attachments ?? []) as unknown as Raw[];
        return (
          <div key={e.evidenceId} className="tx-file-view">
            <div>
              <strong>
                {e.revision}차 제출 · {evidenceNames[e.status] ?? e.status}
              </strong>
              <small>{e.description || '설명 없음'}</small>
              {e.status === 'REJECTED' && e.reviewNote && <small>반려 사유: {e.reviewNote}</small>}
              {files.length > 0 && (
                <small>
                  <EvidenceFileNames files={files} status={(f) => scanNames[str(f.scanStatus) ?? ''] ?? str(f.scanStatus) ?? ''} />
                </small>
              )}
            </div>
          </div>
        );
      })}
      {agent && latestEvidence?.status === 'REJECTED' && stage === 'in_progress' && (
        <div className="tx-request-actions">
          <Link className="btn secondary" to={`/requests/${r.id}/evidence`}>
            시도 증빙 다시 올리기
          </Link>
        </div>
      )}
      <p className="record-note">{attemptNote()}</p>
    </>
  );
  const resultEvidenceList = (
    <>
      {d.resultEvidences.map((e, i) => {
        const files = list(pick(e, 'attachments'));
        return (
          <div key={String(pick(e, 'evidenceId', 'id') ?? i)} className="tx-file-view">
            <div>
              <strong>{num(pick(e, 'revision')) ? `${num(pick(e, 'revision'))}차 제출` : '결과 증빙'}</strong>
              <small>{str(pick(e, 'description')) || '설명 없음'}</small>
              <small>
                {files.length ? (
                  <EvidenceFileNames files={files} status={(f) => scanNames[str(f.scanStatus) ?? ''] ?? str(f.scanStatus) ?? ''} />
                ) : (
                  scanNames[str(pick(e, 'scanStatus')) ?? ''] ?? ''
                )}
              </small>
            </div>
          </div>
        );
      })}
      <p className="record-note">사진을 누르면 확대해서 볼 수 있어요. 결과에 이의가 있으면 운영팀이 이 증빙을 보고 결과 조정안을 제안해요.</p>
    </>
  );

  return (
    <>
      <PageTitle title="요청 상세" crumbs={[back]} />
      <div className="detail-layout tx-layout">
        <div>
          <section className="content-card tx-detail-header">
            <div className="title-between">
              <small className="muted">{r.createdAt ? `요청 ${utcToLocal(r.createdAt)}` : ''}</small>
              <StatusBadge stage={stage} />
            </div>
            <h1>{r.targetName}</h1>
            <p>
              {agent ? `${r.requesterName} 이용자` : `${r.agentName} 도우미`} · {r.platformName || r.otherPlatformName || '예매처 미정'}
            </p>
            <NextStep stage={stage} role={role} proposedBy={latest?.proposedByRole} myName={String(me?.nickname ?? me?.name ?? '')} />
          </section>

          {/* 결과가 등록되면 가장 중요한 정보라 헤더 바로 아래에 둔다. */}
          {resultCardShown && r.agentResult && (
            <TxCard
              title={
                <>
                  예매 <span className={r.agentResult === 'FAILURE' ? 'result-failure' : 'result-success'}>{resultNames[r.agentResult]}</span> · 도우미 등록 결과
                </>
              }
            >
              <p className="prose" style={{ whiteSpace: 'pre-line' }}>
                {r.agentResultNote || '등록된 결과 설명이 없어요.'}
              </p>
              {r.agentOutcome && <p className="prose">실제 결과: {r.agentOutcome}</p>}
              {d.resultEvidences.length > 0 && resultEvidenceList}
              {failureCard && (
                <>
                  <div className="tx-upload-heading">
                    <h3>예매 시도 증빙</h3>
                  </div>
                  {attemptEvidenceBody}
                </>
              )}
              {r.requesterResult && (
                <Notice tone={r.requesterResult === r.agentResult ? 'success' : 'error'}>
                  이용자 확인 결과: {resultNames[r.requesterResult]}
                  {r.requesterResultNote ? ` · ${r.requesterResultNote}` : ''}
                </Notice>
              )}
              {r.disputeNote && <Notice tone="error">이용자 이의 사유: {r.disputeNote}</Notice>}
              {final && r.status === 'COMPLETED' && <Notice tone="success">최종 결과: {resultNames[final]}</Notice>}
            </TxCard>
          )}

          {(stage === 'revision_requested' || r.agreementChangePending) && d.changeRequests.length > 0 && (
            <TxCard title="조건 수정 요청">
              {d.changeRequests.map((c, i) => (
                <Notice key={i}>{str(pick(c, 'reason', 'message', 'body')) ?? ''}</Notice>
              ))}
            </TxCard>
          )}

          {latest && (
            <TxCard title={finalized ? '확정된 최종 조건' : `${latest.proposedByRole === 'AGENT' ? '도우미' : '이용자'}가 보낸 최종 조건`}>
              <Notice tone={finalized ? 'success' : ''}>
                {finalized
                  ? `양측이 ${latest.version}차 제안에 동의해 확정됐어요.${latest.finalizedAt ? ` (${utcToLocal(latest.finalizedAt)})` : ''}`
                  : `${latest.version}차 제안${latest.createdAt ? ` · ${utcToLocal(latest.createdAt)}` : ''} · ${stage === 'revision_requested' ? '수정 요청됨. 새 조건을 기다리고 있어요.' : `${latest.proposedByRole === 'AGENT' ? '이용자' : '도우미'} 확인을 기다리고 있어요.`}`}
              </Notice>
              {finalized ? <Rows rows={agreementRows(latest)} /> : <Comparison r={r} a={latest} />}
              {previous.length > 0 && (
                <details className="tx-versions">
                  <summary>이전 제안 {previous.length}개 보기</summary>
                  {previous.map((a) => (
                    <details key={a.id}>
                      <summary>{a.version}차 제안 · 이전 조건</summary>
                      <Rows rows={agreementRows(a)} />
                    </details>
                  ))}
                </details>
              )}
            </TxCard>
          )}

          {(!latest || finalized) && (
            <TxCard title="이용자가 보낸 요청">
              <Rows rows={requestRows(r)} />
            </TxCard>
          )}

          <TxCard title="연락방법">
            {['PENDING', 'REJECTED', 'EXPIRED'].includes(r.status) ? (
              <Notice>요청을 수락하면 매칭한 {other}의 연락처가 공개돼요.</Notice>
            ) : ['COMPLETED', 'CANCELLED'].includes(r.status) ? (
              <Notice>거래가 끝나 연락처 공개가 종료됐어요.</Notice>
            ) : contacts.length ? (
              <>
                <dl className="document-rows">
                  {contacts.map(([k, v], i) => (
                    <div key={i}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="record-note">매칭한 {other}에게만 공개되는 정보예요. 예매처 계정정보는 공유하지 마세요.</p>
              </>
            ) : (
              <Notice>{other}가 공개한 연락처가 없어요.</Notice>
            )}
          </TxCard>

          {finalized?.safePayment && (
            <TxCard title="안전거래 결제">
              {stage === 'payment' ? (
                <Notice>{agent ? '이용자가 확정 금액을 입금할 차례예요.' : paymentStatus === 'PENDING' ? '가상계좌를 발급했어요. 기한 안에 입금해 주세요.' : '아직 결제 전이에요. 확정 금액을 가상계좌로 입금해 주세요.'}</Notice>
              ) : paymentStatus && paymentStatus !== 'PAID' ? (
                <>
                  <div className="title-between">
                    <strong>{paymentNames[paymentStatus] ?? paymentStatus}</strong>
                    <strong>{money(finalized.upfrontFeeKrw + finalized.successFeeKrw + finalized.safetyFeeKrw)}원</strong>
                  </div>
                  {!partialCardShown && refundCard}
                </>
              ) : (
                <>
                  <div className="title-between">
                    <strong className="tx-paid">
                      <Icon name="check" size={18} /> 이용자 결제 완료
                    </strong>
                    <strong>{money(finalized.upfrontFeeKrw + finalized.successFeeKrw + finalized.safetyFeeKrw)}원</strong>
                  </div>
                  <Notice>
                    {r.upfrontForfeited
                      ? upfrontApplies
                        ? '운영팀 종결로 착수비는 도우미에게 지급되지 않아요. 착수비와 성공보수 환불을 요청할 수 있어요. 이용료는 환불되지 않아요.'
                        : '운영팀 종결로 성공보수 환불을 요청할 수 있어요. 이용료는 환불되지 않아요.'
                      : upfrontApplies
                        ? '결제 금액을 보관하는 단계예요. 착수비는 착수 후 시도 증빙이 승인되거나 결과가 확정되면 도우미에게 지급을 요청해요(운영팀이 예매 시도 미확인·결과 미제출로 종결하면 지급하지 않고 환불). 성공보수는 성공이면 전액, 부분 성공이면 정산한 금액만 지급돼요. 이용료는 환불되지 않아요.'
                        : '결제 금액을 보관하는 단계예요. 성공보수는 성공이면 전액, 부분 성공이면 정산한 금액만 도우미에게 지급돼요. 이용료는 환불되지 않아요.'}
                  </Notice>
                  {!partialCardShown && refundCard}
                </>
              )}
            </TxCard>
          )}

          {finalized && !finalized.safePayment && ['MATCHED', 'MATCHING_COMPLETED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'].includes(r.status) && (
            <TxCard title="직접 거래">
              <Notice>플랫폼 결제 없이 당사자끼리 정산하는 거래예요. 플랫폼은 조건 확정으로 매칭을 완료해요. 착수·성공 결과를 등록할 필요 없이 당사자끼리 진행하고, 이용자는 후기를 남길 수 있어요. 지급과 환불은 당사자끼리 처리해요.</Notice>
            </TxCard>
          )}

          {r.adminResolutionNote && (
            <TxCard title="운영팀 확정 사유">
              {(r.upfrontForfeited || noResultClosed) && (
                <Notice tone="error">
                  {(noResultClosed ? '도우미가 결과를 등록하지 않아 운영팀이 실패로 종결했어요.' : '운영팀이 예매 시도를 확인하지 못해 실패로 종결했어요.') +
                    (!finalized?.safePayment
                      ? '' // 직접 거래: 플랫폼이 돈을 다루지 않는다
                      : agent
                        ? !upfrontApplies
                          ? ' 성공보수는 지급되지 않아요.'
                          : r.upfrontForfeited
                            ? ' 착수비와 성공보수는 지급되지 않아요.'
                            : ' 착수비는 시도 증빙 승인 또는 지급 진행으로 도우미 몫으로 확정돼 있고, 성공보수는 지급되지 않아요.'
                        : !upfrontApplies
                          ? ' 성공보수를 환불받을 수 있어요(이용료 제외).'
                          : r.upfrontForfeited
                            ? ' 착수비와 성공보수를 환불받을 수 있어요(이용료 제외).'
                            : ' 착수비는 시도 증빙 승인 또는 지급 진행으로 도우미 몫이 확정돼, 성공보수만 환불받을 수 있어요(이용료 제외).')}
                </Notice>
              )}
              <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>{r.adminResolutionNote}</p>
            </TxCard>
          )}

          {(r.status === 'DISPUTED' || r.adminResolutionNote) && <MediationCard key={r.status} requestId={r.id} kind="RESULT" agent={agent} reloadDetail={reload} />}
          {(r.status === 'DISPUTED' || r.adminResolutionNote) && <DisputeCard key={r.status} requestId={r.id} disputed={r.status === 'DISPUTED'} agent={agent} reloadDetail={reload} />}

          {/* 결과 카드가 없을 때(결과 등록 전 등)만 따로 보여 준다. 결과 카드가 있으면 그 안에 함께 보인다. */}
          {d.resultEvidences.length > 0 && !resultCardShown && <TxCard title="결과 증빙">{resultEvidenceList}</TxCard>}

          {/* 실패 결과면 예매 결과 카드 안에 함께 보이므로 따로 보여 주지 않는다. */}
          {d.evidences.length > 0 && !failureCard && (
            <TxCard title="예매 시도 증빙">{attemptEvidenceBody}</TxCard>
          )}

          {d.review && (
            <TxCard
              title="거래 후기"
              actions={
                !agent && (
                  <button type="button" className="text-link" disabled={pending} onClick={() => setDialog('deleteReview')}>
                    후기 삭제
                  </button>
                )
              }
            >
              <div className="review-rating-date">
                <span className="stars" aria-label={`${d.review.rating}점`}>
                  {'★'.repeat(d.review.rating)}
                  <span className="empty-stars">{'☆'.repeat(5 - d.review.rating)}</span>
                </span>
                <time>{utcToLocal(d.review.reviewedAt)}</time>
              </div>
              {d.review.bookingResult && <p className="record-note">이용자가 후기에 남긴 예매 결과: {resultNames[d.review.bookingResult]}</p>}
              {d.review.comment && <p className="prose">{d.review.comment}</p>}
              {d.review.imageUrl && <ImagePreview src={d.review.imageUrl} alt="후기 인증 사진" className="review-photo" />}
            </TxCard>
          )}

          {partialCardShown && finalized && <PartialSettlementCard r={r} a={finalized} partial={d.partial} agent={agent} reload={reload} refund={refundCard} />}

          {counterpartId && !['PENDING'].includes(r.status) && (
            <button className="report-link" onClick={() => navigate(`/report?requestId=${r.id}&userId=${counterpartId}&name=${encodeURIComponent(counterpartName)}`)}>
              {other}에게 문제가 있나요? 신고하기
            </button>
          )}
        </div>
        <aside className="tx-side">
          <section className="content-card tx-progress">
            <h2>진행 상황</h2>
            {/* 도우미가 보낸(또는 확정된) 조건이 직접 거래면 결제 단계가 없다. */}
            <Progress stage={stage} direct={!!latest && !latest.safePayment} proposedBy={latest?.proposedByRole} />
            {actions()}
            {finalized && (
              <p className="tx-confirmed">
                <Icon name="check" size={15} /> {finalized.proposedByRole === 'AGENT' ? '이용자' : '도우미'} 최종 확인 완료
              </p>
            )}
          </section>
          <p className="aside-disclaimer">이용자와 도우미 모두 조건을 제안할 수 있어요. 도우미가 보낸 조건은 이용자가, 이용자가 보낸 조건은 도우미가 확정하거나 수정을 요청해요.</p>
        </aside>
      </div>

      {dialog === 'accept' && (
        <ConfirmModal title="요청을 수락할까요?" submitText="수락하기" onClose={close} onConfirm={accept}>
          <p className="prose">
            <strong>{r.targetName}</strong>
            <br />
            수락하면 연락처가 공개되고 최종 조건을 작성할 수 있어요.
          </p>
          <div className="tx-accept-balance">
            <div>
              <span>현재 매칭권</span>
              <strong>{balance === null ? '-' : `${balance}장`}</strong>
            </div>
            <div>
              <span>수락에 필요한 매칭권</span>
              <strong>1장</strong>
            </div>
          </div>
          {balance !== null && balance < 1 && (
            <Notice tone="error">
              매칭권이 부족해요. <Link to="/credits">매칭권 충전</Link> 후 수락해 주세요.
            </Notice>
          )}
          {hasContact === false && (
            <Notice tone="error">
              수락하려면 이용자에게 공개할 대표 연락처가 필요해요. <Link to="/user-profile">연락처 등록</Link> 후 수락해 주세요.
            </Notice>
          )}
          <p className="record-note">수락하면 연락처 공유 동의 약관에 동의한 것으로 처리돼요.</p>
        </ConfirmModal>
      )}
      {dialog === 'reject' && (
        <ReasonModal title="요청을 거절할까요?" label="거절 사유" submitText="요청 거절" danger onClose={close} onSubmit={(reason) => act(() => unwrap(api.POST('/api/requests/{requestId}/reject', { ...path, body: { reason } })), '요청을 거절했어요.')}>
          <p className="prose">거절하면 매칭권은 사용되지 않아요. 사유는 이용자에게 전달돼요.</p>
        </ReasonModal>
      )}
      {dialog === 'cancel' && (
        <ReasonModal
          title={r.status === 'MATCHED' ? '거래를 취소할까요?' : '요청을 취소할까요?'}
          label="취소 사유"
          submitText={r.status === 'MATCHED' ? '거래 취소' : '요청 취소'}
          danger
          onClose={close}
          onSubmit={(reason) => act(() => unwrap(api.POST('/api/requests/{requestId}/cancel', { ...path, body: { reason } })), r.status === 'MATCHED' ? '거래를 취소했어요.' : '요청을 취소했어요.')}
        >
          <p className="prose">
            취소하면 되돌릴 수 없어요.
            {r.status === 'MATCHED' && (agent ? ' 도우미가 취소하면 수락할 때 사용한 매칭권은 돌려받지 않아요.' : ' 도우미가 수락할 때 사용한 매칭권은 도우미에게 복구돼요.')}
          </p>
        </ReasonModal>
      )}
      {dialog === 'agree' && latest && (
        <ConfirmModal
          title="최종 조건을 확정할까요?"
          submitText="확정하기"
          onClose={close}
          onConfirm={() =>
            act(
              () => unwrap(api.POST('/api/requests/{requestId}/agreements/{agreementId}/accept', { params: { path: { requestId, agreementId: latest.id } } })),
              latest.safePayment ? (agent ? '조건을 확정했어요. 이용자의 결제를 기다려 주세요.' : '조건을 확정했어요. 안전거래 결제를 진행해 주세요.') : '직접 거래 매칭을 완료했어요. 이후 당사자끼리 진행하고 후기를 남겨 주세요.',
            )
          }
        >
          <p className="prose">
            안전거래는 결제가 시작되기 전까지만 조건을 다시 제안할 수 있어요.
            <br />
            {latest.safePayment ? `확정 후 이용자가 ${money(latest.upfrontFeeKrw + latest.successFeeKrw + latest.safetyFeeKrw)}원을 안전거래로 결제해요.` : '확정하면 직접 거래 매칭이 완료돼요. 착수·결과 등록 없이 당사자끼리 진행하고, 이용자는 후기를 남길 수 있어요.'}
          </p>
        </ConfirmModal>
      )}
      {dialog === 'revision' && latest && (
        <ReasonModal
          title="조건 수정 요청"
          label="수정이 필요한 내용"
          submitText="수정 요청 보내기"
          onClose={close}
          onSubmit={(reason) =>
            act(() => unwrap(api.POST('/api/requests/{requestId}/agreements/{agreementId}/change-requests', { params: { path: { requestId, agreementId: latest.id } }, body: { reason } })), '수정 요청을 보냈어요.')
          }
        >
          <p className="record-note">수정 요청 후에는 이용자와 도우미 모두 새 조건을 제안할 수 있어요. {other}가 보내면 먼저 확인하고 승인하거나 다시 수정을 요청해 주세요.</p>
        </ReasonModal>
      )}
      {dialog === 'start' && (
        <ConfirmModal
          title="예매를 시작할까요?"
          submitText="착수하기"
          onClose={close}
          onConfirm={() =>
            act(async () => {
              try {
                await unwrap(api.POST('/api/requests/{requestId}/start', path));
              } catch (e) {
                // 착수 직전에 이용자가 조건 변경을 요청하면 서버가 409로 막는다. 최신 상태를 확인해 원인을 알려 준다.
                if (e instanceof ApiError && e.status === 409) {
                  const fresh = await fetchDetail(requestId).catch(() => null);
                  if (fresh?.request.agreementChangePending) {
                    close();
                    reload();
                    throw new Error('이용자가 조건 변경을 요청해서 착수할 수 없어요. 요청 내용을 확인하고 조건을 다시 제안해 주세요.');
                  }
                }
                throw e;
              }
            }, '착수했어요. 예매를 마치면 결과를 등록해 주세요.')
          }
        >
          <p className="prose">
            착수하면 거래가 진행 중으로 바뀌어요. 예매를 시도한 화면(대기열·좌석 선택·매진 화면 등)은 꼭 캡처하거나 녹화해 두세요. 실패로 결과를 등록하려면 시도 증빙이 반드시 필요해요.
            {upfrontApplies && ' 안전거래라서 착수 후 시도 증빙을 올려 이용자가 승인하면, 결과 전이라도 착수비 지급을 요청해요(정산 계좌 등록 필요).'}
          </p>
        </ConfirmModal>
      )}
      {dialog === 'result' && (
        <ResultModal
          r={r}
          upfrontApplies={upfrontApplies}
          onClose={close}
          onSubmit={(agreed, note) =>
            // 확인 기한이 지나 운영팀이 먼저 확정한 경우 등 409는 useAction이 서버 메시지와 함께 최신 상태로 다시 불러온다.
            act(
              () => unwrap(api.POST('/api/requests/{requestId}/result/confirm', { ...path, body: { agreed, note: note || undefined } })),
              agreed ? '결과 확인을 완료했어요.' : '이의를 접수했어요. 운영팀이 확인해 결과 조정안을 제안해요.',
            )
          }
        />
      )}
      {dialog === 'withdraw' && (
        <ConfirmModal
          title="이의를 철회할까요?"
          submitText="이의 철회하고 동의하기"
          onClose={close}
          onConfirm={() =>
            act(async () => {
              await unwrap(api.POST('/api/requests/{requestId}/dispute/withdraw', { ...path, body: { note: withdrawNote.trim() || undefined } }));
              setWithdrawNote('');
            }, '이의를 철회했어요. 도우미가 등록한 결과로 거래가 확정됐어요.')
          }
        >
          <p className="prose">
            도우미가 등록한 결과(<strong>{r.agentResult ? resultNames[r.agentResult] : '-'}</strong>)로 거래가 <strong>최종 확정</strong>돼요. 확정된 뒤에는 다시 이의를 제기하거나 되돌릴 수 없어요.
          </p>
          <Notice>진행 중인 운영팀 조정안은 철회와 함께 종료돼요. 정산·환불은 확정된 결과와 합의 조건에 따라 처리되며, 거래 완료가 지급·환불 완료를 뜻하지는 않아요.</Notice>
          <Field label="철회 사유">
            <textarea rows={3} maxLength={10000} value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} placeholder="선택 입력" />
          </Field>
        </ConfirmModal>
      )}
      {dialog === 'deleteReview' && (
        <ConfirmModal
          title="후기를 삭제할까요?"
          submitText="삭제하기"
          onClose={close}
          onConfirm={() =>
            act(async () => {
              await unwrap(api.DELETE('/api/requests/{requestId}/review', path));
              usedReviews.add(requestId);
            }, '후기를 삭제했어요.')
          }
        >
          <p className="prose">거래당 후기는 하나만 쓸 수 있어서, 삭제하면 이 거래의 후기를 다시 작성할 수 없어요.</p>
        </ConfirmModal>
      )}
    </>
  );
}
