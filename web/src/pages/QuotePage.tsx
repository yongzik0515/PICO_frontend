import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, pick, str, type Raw } from '../api/pick';
import { findPolicy, usePolicies } from '../api/policies';
import { BookingTermsNotice } from '../transactions/BookingTermsNotice';
import { categoryCodes, categoryNames, toAgent, usePlatforms } from '../discovery/agent';
import { fetchDetail, fetchRequests, useLoad, type RequestBody, type TxRequest } from '../transactions/model';
import { Field, Notice, TxCard, useAction } from '../transactions/ui';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
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

// 임시저장·불러오기로 주고받는 입력칸. 연락처와 동의는 제외한다(매번 새로 확인받는 값이라서).
const DRAFT_FIELDS = [
  'targetName',
  'serviceCategory',
  'scheduledUseDate',
  'scheduledUseTime',
  'applicationOpenDate',
  'applicationOpenTime',
  'applicationRound',
  'otherPlatformName',
  'requirements',
  'successConditions',
  'agencyBudgetDesired',
  'additionalNote',
  'expiresAt',
] as const;
const draftKey = (agentId: number, editId: number) => `pico_quote_draft_${editId ? `edit-${editId}` : `agent-${agentId}`}`;

/** 폼의 입력칸에 값을 채워 넣는다(불러오기·임시저장 복원 공용). */
function fillForm(form: HTMLFormElement, values: Record<string, string>) {
  for (const name of DRAFT_FIELDS) {
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (el && values[name] != null) el.value = values[name];
  }
}

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
  // 어떤 입력칸이 왜 잘못됐는지 칸별로 들고 있다가, 해당 칸에 빨간 테두리와 이유를 함께 보여 준다.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadOpen, setLoadOpen] = useState(false);
  const [sources, setSources] = useState<TxRequest[] | null>(null);
  const [picked, setPicked] = useState(0);
  const [savedAt, setSavedAt] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const storageKey = draftKey(agentId, editId);

  // 화면을 열 때 저장해 둔 임시저장 값이 있으면 그대로 채운다.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) fillForm(form, JSON.parse(raw));
    } catch {
      /* 저장된 값이 깨졌으면 무시한다 */
    }
  }, [storageKey]);


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
  const agentCategories = categoryCodes(pick(agent.raw, 'categories'));
  const categories = Object.keys(categoryNames);
  const defaultCategory = edit?.serviceCategory || str(pick(agent.raw, 'primaryCategory')) || 'CONCERT';
  // 서버는 공개용(isPrimary=true) 연락처가 있어야 요청을 받는다. 없으면 아래에서 공개용으로 등록한다.
  const hasContact = contacts.some((c) => c.isPrimary === true);
  const allAgreed = agreed.terms && agreed.privacy && agreed.contact;


  // 임시저장: 이 브라우저에만 저장한다(서버에 임시저장 API가 없다).
  function saveDraft() {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = {};
    for (const name of DRAFT_FIELDS) {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) values[name] = el.value;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      toast('작성 중인 내용을 이 브라우저에 저장했어요.');
    } catch {
      toast('임시저장에 실패했어요.');
    }
  }

  // 불러오기: 내가 보낸 다른 요청의 내용을 그대로 복사해 온다.
  function openLoad() {
    setLoadOpen(true);
    setPicked(0);
    if (sources) return;
    void fetchRequests('REQUESTER')
      .then((all) => setSources(all.filter((r) => r.id !== editId)))
      .catch(() => setSources([]));
  }

  function applyLoad() {
    const form = formRef.current;
    const src = sources?.find((r) => r.id === picked);
    if (!form || !src) return;
    fillForm(form, {
      targetName: src.targetName ?? '',
      serviceCategory: src.serviceCategory ?? '',
      scheduledUseDate: src.scheduledUseDate ?? '',
      scheduledUseTime: src.scheduledUseTime ?? '',
      applicationOpenDate: src.applicationOpenDate ?? '',
      applicationOpenTime: src.applicationOpenTime ?? '',
      applicationRound: src.applicationRound ?? '',
      requirements: src.requirements ?? '',
      successConditions: src.successConditions ?? '',
      agencyBudgetDesired: src.agencyBudgetDesired != null ? String(src.agencyBudgetDesired) : '',
      additionalNote: src.additionalNote ?? '',
    });
    setLoadOpen(false);
    setErrors({});
    toast('선택한 요청의 내용을 불러왔어요. 날짜와 기한은 꼭 다시 확인해 주세요.');
  }

  /** 잘못된 칸으로 화면을 옮기고 그 칸에 표시를 남긴다. */
  function fail(form: HTMLFormElement, found: Record<string, string>) {
    setErrors(found);
    const first = Object.keys(found)[0];
    const el = first ? (form.elements.namedItem(first) as HTMLElement | null) : null;
    el?.closest('.field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    // 브라우저 기본 풍선 대신, 비었거나 형식이 틀린 칸을 모아 각 칸 아래에 이유를 적는다.
    const found: Record<string, string> = {};
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]')) {
      if (el.type === 'checkbox' || el.checkValidity()) continue;
      const v = el.validity;
      found[el.name] = v.valueMissing
        ? '필수 항목이에요. 입력해 주세요.'
        : v.tooShort
          ? `${(el as HTMLInputElement).minLength}자 이상 입력해 주세요.`
          : v.tooLong
            ? `${(el as HTMLInputElement).maxLength}자 이하로 입력해 주세요.`
            : v.rangeUnderflow
              ? `${(el as HTMLInputElement).min} 이상으로 입력해 주세요.`
              : v.rangeOverflow
                ? `${(el as HTMLInputElement).max} 이하로 입력해 주세요.`
                : v.typeMismatch
                  ? '형식을 확인해 주세요.'
                  : '입력 내용을 확인해 주세요.';
    }
    if (Object.keys(found).length) return fail(form, found);
    const d = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
    const contactSharingDocumentId = findPolicy(policies, 'CONTACT_SHARING').id;
    if (!contactSharingDocumentId) return setError('연락처 공유 동의 문서를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    if (new Date(d.expiresAt) <= new Date()) return fail(form, { expiresAt: '응답 기한은 지금보다 뒤여야 해요.' });
    // 가이드 6-2: 수락 기한은 신청(티켓) 오픈 시각 이전이어야 한다. 오픈 날짜·시각은 한국 시간.
    const openAt = new Date(`${d.applicationOpenDate}T${d.applicationOpenTime || '00:00'}:00+09:00`);
    if (new Date(d.expiresAt) >= openAt) return fail(form, { expiresAt: '도우미 응답 기한은 티켓 오픈 시각보다 앞서야 해요.' });
    setError('');
    setErrors({});
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
      locationNote: edit?.locationNote,
      requestedQuantity: edit?.requestedQuantity,
      requirements: d.requirements,
      successConditions: d.successConditions,
      purchaseBudgetMax: edit?.purchaseBudgetMax,
      agencyBudgetDesired: optionalNumber(d.agencyBudgetDesired),
      agencyBudgetMax: edit?.agencyBudgetMax,
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
        localStorage.removeItem(storageKey);
        const created = await unwrap<Raw>(api.POST('/api/requests', { body }));
        const newId = Number(pick(created, 'requestId', 'id'));
        navigate(newId ? `/request-sent/${newId}` : '/requests', { replace: true, state: { agentName: agent.name, targetName: d.targetName } });
      }
    }, edit ? '요청 내용을 수정했어요.' : undefined);
  }

  return (
    <>
      <PageTitle title={edit ? '요청 내용 수정' : '요청 보내기'} crumbs={edit ? [{ label: '요청 상세', to: `/requests/${edit.id}` }] : [{ label: '도우미 프로필', to: `/agents/${agentId}` }]} />
      <form id="tx-quote-form" ref={formRef} className="detail-layout tx-layout" noValidate onSubmit={submit}>
        <div>
          <TxCard
            title="요청서"
            actions={
              <div className="tx-load-actions">
                <button type="button" className="btn ghost" onClick={openLoad}>
                  불러오기
                </button>
                <button type="button" className="btn ghost" onClick={saveDraft}>
                  임시저장
                </button>
              </div>
            }
          >
            <Field label="공연명" required error={errors.targetName}>
              <input name="targetName" required maxLength={250} defaultValue={edit?.targetName} placeholder="예: 태연 콘서트" />
            </Field>
            <Field label="분야" required error={errors.serviceCategory}>
              <select name="serviceCategory" required defaultValue={defaultCategory}>
                {categories.map((c) => (
                  <option key={c} value={c} disabled={agentCategories.length > 0 && !agentCategories.includes(c) && c !== defaultCategory}>
                    {categoryNames[c]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="공연 날짜" error={errors.scheduledUseDate}>
                <input name="scheduledUseDate" type="date" defaultValue={edit?.scheduledUseDate} />
              </Field>
              <Field label="공연 시작 시간" error={errors.scheduledUseTime}>
                <input name="scheduledUseTime" type="time" defaultValue={edit?.scheduledUseTime} />
              </Field>
              <Field label="티켓 오픈 날짜" required error={errors.applicationOpenDate}>
                <input name="applicationOpenDate" type="date" required defaultValue={edit?.applicationOpenDate} />
              </Field>
              <Field label="티켓 오픈 시간" error={errors.applicationOpenTime}>
                <input name="applicationOpenTime" type="time" defaultValue={edit?.applicationOpenTime} />
              </Field>
            </div>
            <Field label="예매 회차" error={errors.applicationRound}>
              <select name="applicationRound" defaultValue={edit?.applicationRound ?? ''}>
                {rounds.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="예매처" required error={errors.platform}>
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
              <Field label="예매처 직접 입력" required error={errors.otherPlatformName}>
                <input name="otherPlatformName" required maxLength={150} defaultValue={edit?.otherPlatformName} />
              </Field>
            )}
            <Field label="희망 좌석·요청 내용" required error={errors.requirements} helper="원하는 좌석과 요청 사항을 적어 주세요. 도우미가 어떻게 진행할지 참고하는 내용이에요.">
              <textarea name="requirements" rows={3} required maxLength={10000} defaultValue={edit?.requirements} placeholder="예: 1층 지정석, 연석 2매" />
            </Field>
            <Field label="성공 요건" required error={errors.successConditions} helper="어디까지 잡아야 성공으로 볼지 적어 주세요. 성공 요건은 수고비 지급의 최소 기준이 됩니다.">
              <textarea name="successConditions" rows={3} required maxLength={10000} defaultValue={edit?.successConditions} placeholder="예: 1층 A~C구역 연석 2매를 확보하면 성공" />
            </Field>
            <Field label="희망 수고비" helper="도우미에게 제안하고 싶은 수고비예요. 최종 금액은 서로 합의해요." error={errors.agencyBudgetDesired}>
              <input name="agencyBudgetDesired" type="number" min={0} step={100} defaultValue={edit?.agencyBudgetDesired} />
            </Field>
            <Field label="기타 사항" error={errors.additionalNote}>
              <textarea name="additionalNote" rows={3} maxLength={10000} defaultValue={edit?.additionalNote} />
            </Field>
            <Field label="도우미 응답 기한" required helper="티켓 오픈 전이어야 해요. 이 시간까지 도우미가 수락하지 않으면 요청이 만료돼요." error={errors.expiresAt}>
              <input
                name="expiresAt"
                type="datetime-local"
                required
                defaultValue={edit?.expiresAt ? toLocalInput(new Date(edit.expiresAt + (edit.expiresAt.endsWith('Z') ? '' : 'Z'))) : defaultExpiry()}
              />
            </Field>
          </TxCard>
          <p className="record-note" id="tx-save-status" role="status">
            {savedAt ? `${savedAt}에 이 브라우저에 임시저장했어요.` : '임시저장은 이 브라우저에만 보관돼요. 다른 기기에서는 보이지 않아요.'}
          </p>
          {!hasContact && (
            <TxCard title="연락처">
              <Notice>요청을 보내려면 상대방에게 공개할 연락처가 필요해요. 수락한 도우미에게만 공개돼요.</Notice>
              <div className="form-grid">
                <Field label="종류" required error={errors.contactKind}>
                  <select name="contactKind" required defaultValue="PHONE">
                    {contactKinds.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="연락처" required error={errors.contactValue}>
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
            <Notice>요청을 보내려면 먼저 마이페이지에서 본인인증을 완료해 주세요. 요청을 보내는 시점에는 결제하지 않아요. 도우미가 보낸 최종 조건이 안전거래면 확정한 뒤 결제하고, 직접 거래면 플랫폼 결제 없이 진행돼요.</Notice>
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
                    <a className="quote-terms-view" href={type === 'PRIVACY' ? '/privacy' : findPolicy(policies, type).url} target="_blank" rel="noreferrer" aria-label={`${label} 보기`}>
                      보기
                    </a>
                  )}
                </div>
              ))}
            </div>
            <BookingTermsNotice />
            <div className="account-form-error" aria-live="polite">
              {error}
            </div>
            <button type="submit" className="btn primary full" disabled={!allAgreed || pending}>
              {pending ? '보내는 중…' : edit ? '수정 내용 저장' : '요청 보내기'}
            </button>
          </section>
        </aside>
      </form>
      {loadOpen && (
        <Modal title="다른 요청 불러오기" onClose={() => setLoadOpen(false)}>
          <p className="prose">선택한 요청의 공연·일정·좌석·성공 요건·수고비를 복사해 와요. 지금 입력한 내용은 덮어써요.</p>
          {sources === null ? (
            <div className="empty" role="status">
              <p>요청을 불러오는 중이에요.</p>
            </div>
          ) : sources.length ? (
            <div className="tx-load-list">
              {sources.map((r) => (
                <label key={r.id} className="tx-load-choice">
                  <input type="radio" name="loadSource" value={r.id} checked={picked === r.id} onChange={() => setPicked(r.id)} />
                  <span>
                    <strong>{r.targetName}</strong>
                    <small>
                      {r.applicationOpenDate || '오픈일 미정'} · {categoryNames[r.serviceCategory as keyof typeof categoryNames] ?? r.serviceCategory}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="empty">불러올 다른 요청이 없어요.</p>
          )}
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={() => setLoadOpen(false)}>
              취소
            </button>
            <button type="button" className="btn primary" disabled={!picked} onClick={applyLoad}>
              선택한 요청 불러오기
            </button>
          </div>
        </Modal>
      )}
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
        <span>운영팀의 요청 검토가 끝나면 도우미가 요청을 확인해요.</span>
        <span>수락과 최종 조건 도착 소식은 알림으로 알려드릴게요.</span>
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
