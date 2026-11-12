import { useAuth } from '../auth/AuthContext';
import { Link, useParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, type Raw } from '../api/pick';
import { toRequest, useLoad } from '../transactions/model';
import { Notice, useAction } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';
import { Icon } from '../ui/Icon';

export function RequestGroupPage() {
  const { userKey } = useAuth();
  return <GroupDetail key={userKey} />;
}

function GroupDetail() {
  const { id } = useParams();
  const groupId = Number(id);
  const [load, reload] = useLoad(() => unwrap<Raw>(api.GET('/api/request-groups/{groupId}', { params: { path: { groupId } } })), [groupId], { refreshOnFocus: true });
  const { pending, run } = useAction();
  if (load.status !== 'done') return <section className="empty"><h1>{load.status === 'loading' ? '요청 상태를 확인하고 있어요' : '요청을 불러오지 못했어요'}</h1>{load.status === 'error' && <><p>{load.message}</p><button className="btn secondary" onClick={reload}>다시 확인하기</button></>}</section>;
  const group = load.data;
  const r = toRequest(group.request as Raw);
  const recipients = list(group.recipients);
  const selected = Number(group.selectedRequestId) || 0;
  const waiting = group.status === 'PENDING';
  const blocked = recipients.some(x => x.status === 'PENDING' && x.policyGateStatus === 'BLOCKED');
  const reviewing = recipients.some(x => x.status === 'PENDING' && x.policyGateStatus === 'PENDING');
  const delivered = recipients.filter(x => x.policyGateStatus === 'ALLOWED').length;
  const finished = ['CANCELLED', 'EXPIRED', 'COMPLETED', 'MATCHING_COMPLETED'].includes(r.status);
  const title = selected ? finished ? '연결된 요청의 진행 내역을 확인해 주세요' : '도우미 한 명과 연결됐어요' : !waiting ? '요청이 종료됐어요' : blocked ? '요청 내용을 확인해 주세요' : reviewing ? '요청 내용을 검토하고 있어요' : `도우미 ${delivered}명에게 요청을 전달했어요`;
  const status = (x: Raw) => Number(x.requestId) === selected ? '연결된 도우미' : x.status === 'CANCELLED' && selected ? '다른 도우미 수락으로 종료' : x.status === 'REJECTED' ? '도우미가 거절했어요' : x.status === 'EXPIRED' ? '응답 기한 만료' : x.status === 'CANCELLED' ? '요청 취소' : x.policyGateStatus === 'BLOCKED' ? '내용 확인 필요' : x.policyGateStatus === 'PENDING' ? '내용 검토 중' : '응답 대기';
  return <>
    <PageTitle title="보낸 요청" crumbs={[{ label: '내 활동', to: '/requests' }]} />
    <section className="content-card broadcast-result">
      <div className="broadcast-icon"><Icon name={selected || (!reviewing && !blocked && waiting) ? 'check' : 'clock'} size={28} /></div>
      <h1>{title}</h1><h2>{r.targetName}</h2>
      {selected ? <Notice>먼저 수락한 도우미와 조건을 협의해 주세요. 다른 도우미의 요청은 매칭권 사용 없이 종료됐어요. 요청 수락은 최종 조건 확정이나 예매 성공을 뜻하지 않아요.</Notice> : waiting && <Notice>{blocked ? '요청 내용을 수정하면 다시 검토해요.' : reviewing ? '검토가 끝나야 도우미에게 전달돼요.' : '먼저 수락한 도우미 한 명과 연결돼요. 수락 소식은 알림으로 알려드릴게요.'}</Notice>}
      <ul className="broadcast-recipients">{recipients.map(x => <li key={String(x.requestId)}><strong>{String(x.agentName || '도우미')}</strong><span>{status(x)}</span></li>)}</ul>
      <div className="broadcast-actions">
        {selected ? <Link className="btn primary" to={`/requests/${selected}`}>연결된 요청 확인하기</Link> : waiting && <>
          <Link className="btn secondary" to={`/quote/${r.agentId}?edit=${r.id}`}>요청 내용 수정</Link>
          <button className="btn secondary" disabled={pending} onClick={() => void run(async () => { await unwrap(api.POST('/api/requests/{requestId}/cancel', { params: { path: { requestId: r.id } }, body: { reason: '이용자가 보낸 요청 전체 취소' } })); reload(); }, '대기 중인 요청을 모두 취소했어요.')}>전체 요청 취소</button>
        </>}
        <button className="btn secondary" onClick={reload}>응답 새로고침</button>
        <Link className="btn secondary" to="/requests">내 활동</Link>
      </div>
    </section>
  </>;
}
