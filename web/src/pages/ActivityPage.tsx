import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { num, pick } from '../api/pick';
import { useAgentActive } from '../agent/active';
import { isApprovedAgent } from '../agent/profile';
import { fetchRequests, roughStage, stageNames, useLoad, type TxRequest } from '../transactions/model';
import { Notice, kstDay } from '../transactions/ui';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';

// 프로토타입 transactions.js의 userActivity()/listPage()/activityTicket().
// 목록은 GET /api/requests?role=REQUESTER|AGENT. 목록에는 합의·결제 정보가 없어 요청 상태(RequestStatus)로만 나눈다.
const closed = ['MATCHING_COMPLETED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'];
const closedNames: Record<string, string> = { MATCHING_COMPLETED: '직접 거래 매칭 완료', COMPLETED: '거래 완료', REJECTED: '요청 거절', EXPIRED: '요청 만료', CANCELLED: '요청 취소' };

function Ticket({ r, agent }: { r: TxRequest; agent: boolean }) {
  const person = agent ? r.requesterName : r.agentName;
  const waiting = r.status === 'PENDING';
  const ended = closed.includes(r.status);
  // 서버 stage가 있으면 지금 누구 차례인지 그대로 보여 준다(가이드 6-5).
  const stage = roughStage(r);
  const label = ended
    ? closedNames[r.status]
    : stage === 'policy_review'
      ? '검토 중'
      : stage === 'policy_blocked'
        ? '진행 불가'
        : waiting
          ? agent
            ? '요청 대기중'
            : '응답 대기중'
          : r.serverStage
            ? stageNames[stage]
            : r.status === 'DISPUTED'
              ? '확인 중'
              : '진행중';
  return (
    <article className="activity-ticket">
      <header>
        <span className="tx-recipient-avatar">{person[0]}</span>
        <div className="activity-person">
          <div>
            <strong>{person}</strong>
            <time>요청 {r.createdAt ? kstDay(r.createdAt) : '날짜 미기록'}</time>
          </div>
          <small>{agent ? '신청한 이용자' : '도우미'}</small>
        </div>
        <span className={`activity-status ${waiting ? 'waiting' : ended ? 'ended' : stage === 'disputed' ? 'disputed' : 'progress'}`}>{label}</span>
      </header>
      <Link className="activity-ticket-body" to={`/requests/${r.id}`} aria-label={`${r.targetName} 요청 상세 보기`}>
        <div>
          <h2>{r.targetName || '공연명 미입력'}</h2>
          <p>
            {r.scheduledUseDate || '공연 날짜 미정'} · {r.platformName || r.otherPlatformName || '예매처 미정'}
          </p>
        </div>
        <Icon name="chevron" size={18} />
      </Link>
    </article>
  );
}

function Tabs({ tabs, value, onChange, label }: { tabs: [string, string][]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="request-tabs tx-tabs" role="tablist" aria-label={label}>
      {tabs.map(([key, text]) => (
        <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children?: React.ReactNode }) {
  return (
    <div className="empty">
      <h2>아직 이 단계의 내역이 없어요</h2>
      <p>새로운 요청과 진행 상태가 여기에 표시돼요.</p>
      {children}
    </div>
  );
}

function Loading({ state, retry }: { state: { status: string; message?: string }; retry: () => void }) {
  if (state.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>불러오는 중이에요.</p>
      </div>
    );
  return (
    <div className="empty">
      <h2>목록을 불러오지 못했어요</h2>
      <p>{state.message}</p>
      <button className="btn primary" onClick={retry}>
        다시 시도
      </button>
    </div>
  );
}

export function UserActivityPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [load, reload] = useLoad(() => fetchRequests('REQUESTER'), [], { refreshOnFocus: true });
  const all = load.status === 'done' ? load.data : [];
  const shown = all.filter((r) => tab === 'all' || (tab === 'request' ? r.status === 'PENDING' : tab === 'progress' ? !closed.includes(r.status) && r.status !== 'PENDING' : closed.includes(r.status)));
  return (
    <>
      <PageTitle title="내 활동" />
      <div className="activity-layout">
        <section>
          <Tabs
            label="내 활동 분류"
            value={tab}
            onChange={setTab}
            tabs={[
              ['all', '전체'],
              ['request', '응답 대기중'],
              ['progress', '진행중'],
              ['closed', '지난 내역'],
            ]}
          />
          <div className="activity-tickets">
            {load.status !== 'done' ? (
              <Loading state={load} retry={reload} />
            ) : shown.length ? (
              shown.map((r) => <Ticket key={r.id} r={r} agent={false} />)
            ) : (
              <Empty>
                <button className="btn secondary" onClick={() => navigate('/')}>
                  도우미 찾기
                </button>
              </Empty>
            )}
          </div>
        </section>
        <aside className="activity-guide content-card">
          <h2>요청 후에는 이렇게 진행해요</h2>
          <p>직접 거래는 조건 확정으로 매칭을 완료하고 후기를 남겨요. 아래 착수·결과 확인 단계는 안전거래에 해당해요.</p>
          <ol className="guide-steps">
            <li>
              <b>1</b>
              <div>
                <strong>도우미가 요청을 확인해요</strong>
                <p>수락하면 알림으로 알려드려요.</p>
              </div>
            </li>
            <li>
              <b>2</b>
              <div>
                <strong>연락처를 확인하고 협의해요</strong>
                <p>성공 조건과 비용을 함께 정해요.</p>
              </div>
            </li>
            <li>
              <b>3</b>
              <div>
                <strong>최종 조건을 확인하고 합의해요</strong>
                <p>변경된 내용을 꼼꼼히 확인하세요.</p>
              </div>
            </li>
          </ol>
        </aside>
      </div>
    </>
  );
}

/** 받은 요청(leads)·매칭 관리(matches). 받은 요청은 수락 전(PENDING)과 수락 없이 끝난 요청, 매칭 관리는 수락 이후 요청이다. */
export function AgentActivityPage({ kind }: { kind: 'leads' | 'matches' }) {
  const activity = useAgentActive();
  const navigate = useNavigate();
  const received = kind === 'leads';
  const [tab, setTab] = useState('all');
  const [load, reload] = useLoad(async () => {
    // 승인된 도우미만 받은 요청·매칭 관리를 쓸 수 있다(프로토타입 listPage).
    if (!(await isApprovedAgent())) return { approved: false, requests: [] as TxRequest[], balance: null };
    const [requests, balance] = await Promise.all([
      fetchRequests('AGENT'),
      unwrap(api.GET('/api/matching-passes/balance')).then(
        (b) => num(pick(b, 'remainingUnits')) ?? 0,
        () => null,
      ),
    ]);
    return { approved: true, requests, balance };
  }, [], { refreshOnFocus: true });
  const all = load.status === 'done' ? load.data.requests : [];
  const inbox = (r: TxRequest) => r.status === 'PENDING' || r.status === 'REJECTED' || r.status === 'EXPIRED' || (r.status === 'CANCELLED' && !r.raw.acceptedAt);
  const source = all.filter((r) => (received ? inbox(r) : !inbox(r)));
  const shown = source.filter((r) =>
    received
      ? tab === 'closed'
        ? r.status !== 'PENDING'
        : r.status === 'PENDING'
      : tab === 'all' || (tab === 'progress' ? ['MATCHED', 'IN_PROGRESS', 'DISPUTED'].includes(r.status) : closed.includes(r.status)),
  );
  const tabs: [string, string][] = received
    ? [
        ['all', '미응답'],
        ['closed', '응답 종료'],
      ]
    : [
        ['all', '전체'],
        ['progress', '진행중'],
        ['closed', '지난 내역'],
      ];

  if (load.status === 'done' && !load.data.approved)
    return (
      <>
        <PageTitle title="도우미 활동을 준비해 주세요" />
        <div className="empty">
          <Icon name="info" size={38} />
          <h3>도우미 승인 후 이용할 수 있어요</h3>
          <p>공개 프로필과 인증·경력 자료를 제출하고 심사를 받으면 요청을 받을 수 있어요.</p>
          <button type="button" className="btn primary" onClick={() => navigate('/application')}>
            도우미 신청 확인
          </button>
        </div>
      </>
    );

  return (
    <>
      <PageTitle title={received ? '받은 요청' : '매칭 관리'} />
      <div className="tx-work-summary">
        <div>
          <small>{received ? '답변할 요청' : '진행 중인 거래'}</small>
          <strong>
            {received ? all.filter((r) => r.status === 'PENDING').length : all.filter((r) => ['MATCHED', 'IN_PROGRESS'].includes(r.status)).length}
            <span>건</span>
          </strong>
        </div>
        <div>
          <small>결과 확인 중</small>
          <strong>
            {all.filter((r) => r.status === 'DISPUTED').length}
            <span>건</span>
          </strong>
        </div>
        <div>
          <small>보유 매칭권</small>
          <strong>
            {load.status === 'done' && load.data.balance !== null ? load.data.balance : '-'}
            <span>장</span>
          </strong>
        </div>
        <div className="matching-summary-actions">
          {/* 받은 요청: 매칭권 충전 오른쪽에 활동 중 ON/OFF(목록 공개 + 새 요청 받기). 매칭 관리: 매칭권 충전 · 예매 가능 날짜 설정. */}
          <button type="button" className="btn secondary" onClick={() => navigate('/credits')}>
            매칭권 충전
          </button>
          {received && (
            <button
              type="button"
              role="switch"
              aria-checked={activity.active}
              className={`active-switch ${activity.active ? 'on' : ''}`}
              disabled={!activity.ready || activity.saving}
              onClick={() => void activity.setActive(!activity.active)}
            >
              <span className="active-switch-track" aria-hidden="true">
                <i />
              </span>
              활동 중 {activity.active ? 'ON' : 'OFF'}
            </button>
          )}
          {!received && (
            <button type="button" className="btn secondary" onClick={() => navigate('/availability')}>
              예매 가능 날짜 설정
            </button>
          )}
        </div>
      </div>
      <section className="helper-activity-list">
        <Tabs label={`${received ? '받은 요청' : '매칭 관리'} 분류`} value={tab} onChange={setTab} tabs={tabs} />
        <div className="activity-tickets">
          {load.status !== 'done' ? <Loading state={load} retry={reload} /> : shown.length ? shown.map((r) => <Ticket key={r.id} r={r} agent />) : <Empty />}
        </div>
      </section>
      {received && <Notice>요청 수락 시 매칭권 1장이 사용돼요. 안전거래 결제는 이용자가 최종 조건을 확정한 뒤 별도로 진행해요.</Notice>}
    </>
  );
}
