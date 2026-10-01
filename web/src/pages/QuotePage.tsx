import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, pick, str, type Raw } from '../api/pick';
import { findPolicy, usePolicies } from '../api/policies';
import { categoryNames, toAgent, usePlatforms } from '../discovery/agent';
import { fetchDetail, useLoad, type RequestBody } from '../transactions/model';
import { Field, Notice, TxCard, useAction } from '../transactions/ui';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';
import { money } from '../ui/format';

// 프로토타입 transactions.js의 quotePage()/requestSentPage().
// 입력 항목은 API 명세 POST /api/requests(Create)를 따른다. 수정은 PUT /api/requests/{id}(수락 전 PENDING만).
const rounds: [string, string][] = [
  ['', '선택 안 함'],
  ['PRESALE', '선예매'],
  ['GENERAL', '일반 예매'],
  ['ADDITIONAL', '추가 예매'],
];
const contactKinds: [string, string][] = [
  ['PHONE', '전화번호'],
  ['KAKAO', '카카오톡 ID'],
  ['EMAIL', '이메일'],
];

/** 응답 기한 기본값: 지금부터 24시간 뒤 */
const defaultExpiry = () => toLocalInput(new Date(Date.now() + 24 * 3600e3));
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** 명세: expiresAt은 UTC. 서버가 LocalDateTime으로 받으므로 Z 없이 보낸다. */
const toUtc = (local: string) => new Date(local).toISOString().slice(0, 19);

export function QuotePage() {
  const { id } = useParams();
  const agentId = Number(id);
  const [params] = useSearchParams();
  const editId = Number(params.get('edit')) || 0;
  const navigate = useNavigate();
  const policies = usePolicies();
  const platforms = usePlatforms();
  const { pending, run } = useAction();
  const [agreed, setAgreed] = useState({ terms: false, privacy: false, contact: false });
  const [platformChoice, setPlatformChoice] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [load] = useLoad(async () => {
    const [agent, contacts, edit] = await Promise.all([
      unwrap<Raw>(api.GET('/api/agents/{agentId}', { params: { path: { agentId } } })).then((raw) => ({ ...toAgent(raw), id: agentId, raw })),
      unwrap<unknown>(api.GET('/api/me/contacts')).then(list, () => [] as Raw[]),
      editId ? fetchDetail(editId).then((d) => d.request) : Promise.resolve(null),
    ]);
    return { agent, contacts, edit };
  }, [agentId, editId]);

  if (load.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>요청서를 준비하고 있어요.</p>
      </div>
    );
  if (load.status === 'error')
    return (
      <div className="empty">
        <h1>요청서를 열 수 없어요</h1>
        <p>{load.message}</p>
        <button className="btn primary" onClick={() => navigate('/')}>
          도우미 찾기
        </button>
      </div>
    );

  const { agent, contacts, edit } = load.data;
  if (edit && edit.status !== 'PENDING')
    return (
      <div className="empty">
        <h1>수정할 수 없는 요청이에요</h1>
        <p>도우미가 수락하기 전에만 요청 내용을 수정할 수 있어요.</p>
        <Link className="btn primary" to={`/requests/${edit.id}`}>
          요청 상세로
        </Link>
      </div>
    );

  // 도우미가 지원하는 예매처를 먼저 보여 주고, 그 밖의 예매처는 '기타'로 직접 입력한다.
  const agentPlatformIds = list(pick(agent.raw, 'platforms')).map((p) => Number(p.id));
  const options = platforms.filter((p) => !agentPlatformIds.length || agentPlatformIds.includes(p.id));
  const initialPlatform = edit ? (edit.platformId ? String(edit.platformId) : edit.otherPlatformName ? 'other' : '') : options[0] ? String(options[0].id) : '';
  const platform = platformChoice ?? initialPlatform;
  const agentCategories = list(pick(agent.raw, 'categories')).map(String);
  const categories = Object.keys(categoryNames);
  const defaultCategory = edit?.serviceCategory || str(pick(agent.raw, 'primaryCategory')) || 'CONCERT';
  // 서버는 공개용(isPrimary=true) 연락처가 있어야 요청을 받는다. 없으면 아래에서 공개용으로 등록한다.
  const hasContact = contacts.some((c) => c.isPrimary === true);
  const allAgreed = agreed.terms && agreed.privacy && agreed.contact;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const d = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
    const contactSharingDocumentId = findPolicy(policies, 'CONTACT_SHARING').id;
    if (!contactSharingDocumentId) return setError('연락처 공유 동의 문서를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    if (new Date(d.expiresAt) <= new Date()) return setError('응답 기한은 지금보다 뒤여야 해요.');
    // 가이드 6-2: 수락 기한은 신청(티켓) 오픈 시각 이전이어야 한다. 오픈 날짜·시각은 한국 시간.
    const openAt = new Date(`${d.applicationOpenDate}T${d.applicationOpenTime || '00:00'}:00+09:00`);
    if (new Date(d.expiresAt) >= openAt) return setError('도우미 응답 기한은 티켓 오픈 시각보다 앞서야 해요.');
    setError('');
    const optionalNumber = (v: string) => (v ? Number(v) : undefined);
    const body: RequestBody = {
      agentId,
      targetName: d.targetName,
      serviceCategory: d.serviceCategory as RequestBody['serviceCategory'],
      applicationOpenDate: d.applicationOpenDate,
      applicationOpenTime: d.applicationOpenTime || undefined,
      scheduledUseDate: d.scheduledUseDate || undefined,
      scheduledUseTime: d.scheduledUseTime || undefined,
      platformId: platform && platform !== 'other' ? Number(platform) : undefined,
      otherPlatformName: platform === 'other' ? d.otherPlatformName : undefined,
      locationNote: d.locationNote || undefined,
      requestedQuantity: optionalNumber(d.requestedQuantity),
      requirements: d.requirements,
      successConditions: d.successConditions,
      purchaseBudgetMax: optionalNumber(d.purchaseBudgetMax),
      agencyBudgetMax: optionalNumber(d.agencyBudgetMax),
      additionalNote: d.additionalNote || undefined,
      applicationRound: (d.applicationRound || undefined) as RequestBody['applicationRound'],
      expiresAt: toUtc(d.expiresAt),
      contactSharingDocumentId,
    };
    await run(async () => {
      // 명세: 요청에는 이용자 연락처가 필요하다. 없으면 먼저 저장한다.
      if (!hasContact) await unwrap(api.PUT('/api/me/contacts', { body: { kind: d.contactKind as 'PHONE', value: d.contactValue, primary: true } }));
      if (edit) {
        await unwrap(api.PUT('/api/requests/{requestId}', { params: { path: { requestId: edit.id } }, body }));
        navigate(`/requests/${edit.id}`, { replace: true });
      } else {
        const created = await unwrap<Raw>(api.POST('/api/requests', { body }));
        const newId = Number(pick(created, 'requestId', 'id'));
        navigate(newId ? `/request-sent/${newId}` : '/requests', { replace: true, state: { agentName: agent.name, targetName: d.targetName } });
      }
    }, edit ? '요청 내용을 수정했어요.' : undefined);
  }

  return (
    <>
      <PageTitle title={edit ? '요청 내용 수정' : '요청 보내기'} crumbs={edit ? [{ label: '요청 상세', to: `/requests/${edit.id}` }] : [{ label: '도우미 프로필', to: `/agents/${agentId}` }]} />
      <form id="tx-quote-form" className="detail-layout tx-layout" noValidate onSubmit={submit}>
        <div>
          <TxCard title="요청서">
            <Field label="공연명" required>
              <input name="targetName" required maxLength={250} defaultValue={edit?.targetName} placeholder="예: 태연 콘서트" />
            </Field>
            <Field label="분야" required>
              <select name="serviceCategory" required defaultValue={defaultCategory}>
                {categories.map((c) => (
                  <option key={c} value={c} disabled={agentCategories.length > 0 && !agentCategories.includes(c) && c !== defaultCategory}>
                    {categoryNames[c]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="공연 날짜">
                <input name="scheduledUseDate" type="date" defaultValue={edit?.scheduledUseDate} />
              </Field>
              <Field label="공연 시작 시간">
                <input name="scheduledUseTime" type="time" defaultValue={edit?.scheduledUseTime} />
              </Field>
              <Field label="티켓 오픈 날짜" required>
                <input name="applicationOpenDate" type="date" required defaultValue={edit?.applicationOpenDate} />
              </Field>
              <Field label="티켓 오픈 시간">
                <input name="applicationOpenTime" type="time" defaultValue={edit?.applicationOpenTime} />
              </Field>
            </div>
            <Field label="예매 회차">
              <select name="applicationRound" defaultValue={edit?.applicationRound ?? ''}>
                {rounds.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="예매처" required>
              <select name="platform" required value={platform} onChange={(e) => setPlatformChoice(e.target.value)}>
                <option value="">선택해 주세요</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="other">기타</option>
              </select>
            </Field>
            {platform === 'other' && (
              <Field label="예매처 직접 입력" required>
                <input name="otherPlatformName" required maxLength={150} defaultValue={edit?.otherPlatformName} />
              </Field>
            )}
            <div className="form-grid">
              <Field label="공연장·위치">
                <input name="locationNote" maxLength={250} defaultValue={edit?.locationNote} placeholder="예: 잠실 실내체육관" />
              </Field>
              <Field label="매수">
                <input name="requestedQuantity" type="number" min={1} max={20} defaultValue={edit?.requestedQuantity} placeholder="예: 2" />
              </Field>
            </div>
            <Field label="희망 좌석·요청 내용" required>
              <textarea name="requirements" rows={3} required maxLength={10000} defaultValue={edit?.requirements} placeholder="예: 1층 지정석, 연석 2매" />
            </Field>
            <Field label="성공 요건" required>
              <textarea name="successConditions" rows={3} required maxLength={10000} defaultValue={edit?.successConditions} placeholder="예: 1층 A~C구역 연석 2매를 확보하면 성공" />
            </Field>
            <div className="form-grid">
              <Field label="희망 수고비(최대)" helper="최종 금액은 도우미가 조건으로 제안해요.">
                <input name="agencyBudgetMax" type="number" min={0} step={1000} defaultValue={edit?.agencyBudgetMax} />
              </Field>
              <Field label="티켓 구매 예산(최대)">
                <input name="purchaseBudgetMax" type="number" min={0} step={1000} defaultValue={edit?.purchaseBudgetMax} />
              </Field>
            </div>
            <Field label="기타 사항">
              <textarea name="additionalNote" rows={3} maxLength={10000} defaultValue={edit?.additionalNote} />
            </Field>
            <Field label="도우미 응답 기한" required helper="티켓 오픈 전이어야 해요. 이 시간까지 도우미가 수락하지 않으면 요청이 만료돼요.">
              <input
                name="expiresAt"
                type="datetime-local"
                required
                defaultValue={edit?.expiresAt ? toLocalInput(new Date(edit.expiresAt + (edit.expiresAt.endsWith('Z') ? '' : 'Z'))) : defaultExpiry()}
              />
            </Field>
          </TxCard>
          {!hasContact && (
            <TxCard title="연락처">
              <Notice>요청을 보내려면 상대방에게 공개할 연락처가 필요해요. 수락한 도우미에게만 공개돼요.</Notice>
              <div className="form-grid">
                <Field label="종류" required>
                  <select name="contactKind" required defaultValue="PHONE">
                    {contactKinds.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="연락처" required>
                  <input name="contactValue" required maxLength={250} placeholder="예: 010-1234-5678" />
                </Field>
              </div>
            </TxCard>
          )}
        </div>
        <aside className="tx-side">
          <section className="content-card quote-submit-card">
            <span className="tiny-label">선택한 도우미</span>
            <h2>{agent.name}</h2>
            <p className="prose">{agent.intro}</p>
            <div className="summary-rows">
              <div>
                <span>최소 착수비</span>
                <strong>{money(agent.fee)}원</strong>
              </div>
              <div>
                <span>성공비</span>
                <strong>최종 조건에서 확정</strong>
              </div>
            </div>
            <Notice>요청을 보내는 시점에는 결제하지 않아요. 도우미가 보낸 최종 조건이 안전거래면 확정한 뒤 결제하고, 직접 거래면 플랫폼 결제 없이 진행돼요.</Notice>
            <div className="quote-agreements">
              <label className="check-row quote-agree-all">
                <input type="checkbox" checked={allAgreed} onChange={(e) => setAgreed({ terms: e.target.checked, privacy: e.target.checked, contact: e.target.checked })} />
                전체 동의
              </label>
              {(
                [
                  ['terms', '서비스 이용약관', 'TERMS'],
                  ['privacy', '개인정보 수집·이용', 'PRIVACY'],
                  ['contact', '연락처 제공 동의', 'CONTACT_SHARING'],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key} className="quote-agreement-row">
                  <label className="check-row">
                    <input type="checkbox" required checked={agreed[key]} onChange={(e) => setAgreed({ ...agreed, [key]: e.target.checked })} />
                    {label} (필수)
                  </label>
                  {findPolicy(policies, type).url && (
                    <a className="quote-terms-view" href={findPolicy(policies, type).url} target="_blank" rel="noreferrer" aria-label={`${label} 보기`}>
                      보기
                    </a>
                  )}
                </div>
              ))}
            </div>
            <p className="record-note">PICO는 중개 플랫폼이며 예매 성공이나 티켓을 보증하지 않습니다.</p>
            <div className="account-form-error" aria-live="polite">
              {error}
            </div>
            <button type="submit" className="btn primary full" disabled={!allAgreed || pending}>
              {pending ? '보내는 중…' : edit ? '수정 내용 저장' : '요청 보내기'}
            </button>
          </section>
        </aside>
      </form>
    </>
  );
}

export function RequestSentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <section className="tx-success">
      <div className="success-circle">
        <Icon name="check" size={34} />
      </div>
      <span className="tiny-label">요청 전송 완료</span>
      <h1>도우미에게 마음이 도착했어요</h1>
      <p>
        운영팀의 요청 검토가 끝나면 도우미가 요청을 확인해요.
        <br />
        수락과 최종 조건 도착 소식은 알림으로 알려드릴게요.
      </p>
      <div>
        <button type="button" className="btn primary" onClick={() => navigate(`/requests/${id}`)}>
          보낸 요청 확인
        </button>
        <button type="button" className="btn secondary" onClick={() => navigate('/requests')}>
          내 활동으로
        </button>
      </div>
      <small>아직 결제하지 않았어요. 최종 조건이 안전거래면 확정한 뒤 결제해요.</small>
    </section>
  );
}
