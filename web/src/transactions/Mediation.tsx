import { useState } from 'react';
import { api, unwrap } from '../api/client';
import { bool, list, num, str, type Raw } from '../api/pick';
import { Modal } from '../ui/Modal';
import { useLoad } from './model';
import { Field, Notice, Rows, TxCard, useAction, utcToLocal, won } from './ui';

// 분쟁 조정: 운영팀이 결과·금액을 직접 정하지 않고 조정안을 제시하고, 이용자와 도우미가 모두 수락해야 확정돼요.
// 조정안은 최대 2회, 응답 기한 3일, 무응답은 거부로 처리돼요. 합의가 안 되면 금액이 보류되고 외부 기관을 안내해요.
// GET /api/requests/{requestId}/mediation?kind= · POST /api/requests/{requestId}/mediation/respond
export type MediationKind = 'RESULT' | 'SETTLEMENT';

const resultNames: Record<string, string> = { SUCCESS: '성공', PARTIAL: '부분 성공', FAILURE: '실패' };
const responseNames: Record<string, string> = { PENDING: '응답 전', ACCEPTED: '수락', REJECTED: '거부' };
const outcomeNames: Record<string, string> = { PENDING: '응답 대기', AGREED: '합의', REJECTED: '거부로 종료', EXPIRED: '기한 지나 거부 처리' };

/** 조정안 한 건의 내용을 한 줄로 */
function proposalText(kind: MediationKind, p: Raw, feeKrw?: number) {
  if (kind === 'SETTLEMENT') {
    const amount = num(p.proposedAmountKrw) ?? 0;
    return `도우미 몫 ${won(amount)}${feeKrw !== undefined ? ` · 이용자 환불 ${won(Math.max(0, feeKrw - amount))}` : ''}`;
  }
  return `결과 ${resultNames[str(p.proposedResult) ?? ''] ?? str(p.proposedResult)}${bool(p.attemptUnverified) ? ' (시도 미확인 종결 · 착수비 미지급)' : ''}`;
}

export function MediationCard({ requestId, kind, feeKrw, reloadDetail }: { requestId: number; kind: MediationKind; feeKrw?: number; reloadDetail?: () => void }) {
  const [load, reload] = useLoad(() => unwrap<unknown>(api.GET('/api/requests/{requestId}/mediation', { params: { path: { requestId }, query: { kind } } })) as Promise<Raw>, [requestId, kind], { refreshOnFocus: true });
  const [dialog, setDialog] = useState<'' | 'accept' | 'reject'>('');
  const [note, setNote] = useState('');
  // 409(기한이 지났거나 상대방이 먼저 처리): 서버 메시지를 보여 주고 최신 상태로 다시 불러온다.
  const { pending, run } = useAction({
    onConflict: () => {
      setDialog('');
      reload();
      reloadDetail?.();
    },
  });
  if (load.status !== 'done') return null;
  const m = load.data;
  const status = str(m.status) ?? 'NONE';
  if (status === 'NONE') return null;
  const used = num(m.roundsUsed) ?? 0;
  const max = num(m.maxRounds) ?? 2;
  const days = num(m.responseDays) ?? 3;
  const active = (m.active ?? undefined) as Raw | undefined;
  const history = list(m.proposals);
  const canRespond = m.canRespond === true;
  const mine = str(m.yourResponse);
  const obj = kind === 'RESULT' ? '결과를' : '정산 금액을';

  async function respond(accept: boolean) {
    const ok = await run(
      () => unwrap(api.POST('/api/requests/{requestId}/mediation/respond', { params: { path: { requestId } }, body: { kind, accept, note: note.trim() || null } })),
      accept ? '조정안을 수락했어요.' : '조정안을 거부했어요.',
    );
    if (ok) {
      setDialog('');
      setNote('');
      reload();
      reloadDetail?.();
    }
  }

  return (
    <TxCard title="운영팀 조정안">
      <p className="prose">
        운영팀이 {obj} 직접 정하지 않고 조정안을 제안해요. 이용자와 도우미가 <strong>모두 수락</strong>하면 확정돼요. 조정안은 최대 {max}회, 응답은 {days}일 안에 해야 하고 응답이 없으면 거부로 처리돼요.
      </p>
      {active && (
        <>
          <Rows
            rows={[
              ['조정안', `${used}/${max}차 · ${proposalText(kind, active, feeKrw)}`],
              ['근거', str(active.note) ?? ''],
              ['응답 기한', utcToLocal(str(active.responseDueAt) ?? '')],
              ['이용자 응답', responseNames[str(active.requesterResponse) ?? ''] ?? ''],
              ['도우미 응답', responseNames[str(active.agentResponse) ?? ''] ?? ''],
            ]}
          />
          {canRespond ? (
            <div className="tx-request-actions">
              <button type="button" className="btn primary" disabled={pending} onClick={() => setDialog('accept')}>
                수락하기
              </button>
              <button type="button" className="btn ghost" disabled={pending} onClick={() => setDialog('reject')}>
                거부하기
              </button>
            </div>
          ) : (
            <Notice>{mine && mine !== 'PENDING' ? `내 응답: ${responseNames[mine]}. 상대방의 응답을 기다리고 있어요.` : '응답을 기다리고 있어요.'}</Notice>
          )}
        </>
      )}
      {status === 'WAITING_NEXT' && <Notice>조정안이 확정되지 않았어요. 운영팀이 새 조정안을 보낼 수 있어요(남은 횟수 {Math.max(0, max - used)}회).</Notice>}
      {status === 'AGREED' && <Notice tone="success">{kind === 'RESULT' ? '조정이 합의돼 결과가 확정됐어요.' : '조정이 합의돼 정산 금액이 확정됐어요.'}</Notice>}
      {status === 'FAILED' && (
        <Notice tone="error">
          {str(m.externalGuidance) ?? '조정이 이뤄지지 않았어요. 해당 금액은 분쟁이 해결될 때까지 보류돼요. 외부 분쟁 조정 기관에 도움을 요청할 수 있어요.'}
        </Notice>
      )}
      {history.length > (active ? 1 : 0) && (
        <details className="tx-versions">
          <summary>지난 조정안 보기</summary>
          {history
            .filter((p) => p !== history.find((x) => str(x.outcome) === 'PENDING'))
            .map((p) => (
              <p key={String(num(p.round))} className="record-note">
                {num(p.round)}차 · {proposalText(kind, p, feeKrw)} → {outcomeNames[str(p.outcome) ?? ''] ?? str(p.outcome)}
                {str(p.requesterNote) ? ` · 이용자: ${str(p.requesterNote)}` : ''}
                {str(p.agentNote) ? ` · 도우미: ${str(p.agentNote)}` : ''}
              </p>
            ))}
        </details>
      )}
      {dialog && active && (
        <Modal title={dialog === 'accept' ? '조정안을 수락할까요?' : '조정안을 거부할까요?'} onClose={() => setDialog('')}>
          <Rows rows={[['조정안', proposalText(kind, active, feeKrw)]]} />
          <p className="prose">
            {dialog === 'accept'
              ? '이용자와 도우미가 모두 수락하면 확정되고, 확정 뒤에는 바꿀 수 없어요. 상대방이 거부하면 확정되지 않아요.'
              : `거부하면 이 조정안은 끝나요. 운영팀이 새 조정안을 보낼 수 있고, 총 ${max}회까지 합의되지 않으면 해당 금액은 보류되고 외부 분쟁 조정 기관을 안내해요.`}
          </p>
          <Field label={dialog === 'accept' ? '남길 말(선택)' : '거부 사유(선택)'} helper="상대방과 운영팀에 공개돼요. 다음 조정안에 참고돼요.">
            <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={() => setDialog('')}>
              돌아가기
            </button>
            <button type="button" className={dialog === 'accept' ? 'btn primary' : 'btn danger'} disabled={pending} onClick={() => respond(dialog === 'accept')}>
              {pending ? '처리 중…' : dialog === 'accept' ? '수락하기' : '거부하기'}
            </button>
          </div>
        </Modal>
      )}
    </TxCard>
  );
}
