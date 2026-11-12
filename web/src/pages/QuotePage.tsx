import { useRef, useState, type FormEvent } from 'react';
import { GROUP_DRAFT_KEY, readGroupDraft, saveGroupDraft, pendingGroupSubmission, submitGroup } from '../transactions/groupDraft';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, pick, str, type Raw } from '../api/pick';
import { findPolicy, policyPaths, usePolicies } from '../api/policies';
import { BookingTermsNotice } from '../transactions/BookingTermsNotice';
import { useAuth } from '../auth/AuthContext';
import { categoryCodes, categoryNames, toAgent, usePlatforms } from '../discovery/agent';
import { fetchDetail, policyBlockMessage, toRequest, useLoad, type RequestBody } from '../transactions/model';
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
  'platform',
  'otherPlatformName',
  'requirements',
  'successConditions',
  'locationNote',
  'requestedQuantity',
  'upfrontBudgetDesired',
  'agencyBudgetDesired',
  'agencyBudgetMax',
  'additionalNote',
  'expiresAt',
] as const;
const draftKey = (userKey: string, agentId: number, editId: number) => `pico_quote_draft_${userKey}_${editId ? `edit-${editId}` : `agent-${agentId}`}`;

function readDraft(key: string): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return Object.fromEntries(DRAFT_FIELDS.filter((name) => typeof saved[name] === 'string').map((name) => [name, saved[name]]));
    }
  } catch { /* 저장소가 없거나 값이 깨졌으면 빈 양식으로 시작한다. */ }
  return {};
}

type DraftSource = { key: string; values: Record<string, string> };

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
  const agentId = id === undefined ? 0 : Number(id);
  const [params] = useSearchParams();
  const editId = agentId === 0 ? 0 : Number(params.get('edit')) || 0;
  const { userKey } = useAuth();
  return <QuoteEditor key={`${userKey}:${agentId}:${editId}`} userKey={userKey} agentId={agentId} editId={editId} />;
}

function QuoteEditor({ userKey, agentId, editId }: { userKey: string; agentId: number; editId: number }) {
  const broadcast = agentId === 0;
  const { loggedIn, loading: authLoading } = useAuth();
  const storageKey = broadcast ? GROUP_DRAFT_KEY : draftKey(userKey, agentId, editId);
  const [restored, setRestored] = useState(() => broadcast ? readGroupDraft(userKey) : readDraft(storageKey));
  const [candidateValues, setCandidateValues] = useState(restored);
  const [singleConfirmed, setSingleConfirmed] = useState(false);
  const [uncertain, setUncertain] = useState(() => pendingGroupSubmission(userKey));
  const navigate = useNavigate();
  const policies = usePolicies();
  const platforms = usePlatforms();
  const { pending, run } = useAction();
  const [agreed, setAgreed] = useState({ terms: false, privacy: false, contact: false });
  const [platformChoice, setPlatformChoice] = useState<string | null>(restored.platform ?? null);
  const [error, setError] = useState('');
  // 어떤 입력칸이 왜 잘못됐는지 칸별로 들고 있다가, 해당 칸에 빨간 테두리와 이유를 함께 보여 준다.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadOpen, setLoadOpen] = useState(false);
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [picked, setPicked] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [formRevision, setFormRevision] = useState(0);
  const [savedAt, setSavedAt] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const [identity, reloadIdentity] = useLoad(() => loggedIn ? unwrap(api.GET('/api/me/identity')) : Promise.resolve({ verified: false }), [userKey], { refreshOnFocus: true });
  const [load] = useLoad(async () => {
    const [agent, contacts, edit] = await Promise.all([
      broadcast ? Promise.resolve({ ...toAgent({ activityName: '조건에 맞는 도우미' }), id: 0, raw: {} as Raw }) : unwrap<Raw>(api.GET('/api/agents/{agentId}', { params: { path: { agentId } } })).then((raw) => ({ ...toAgent(raw), id: agentId, raw })),
      loggedIn ? unwrap<unknown>(api.GET('/api/me/contacts')).then(list) : Promise.resolve([] as Raw[]),
      editId ? fetchDetail(editId).then((d) => d.request) : Promise.resolve(null),
    ]);
    return { agent, contacts, edit };
  }, [agentId, editId, userKey]);
  const candidateCategory = candidateValues.serviceCategory ?? 'CONCERT';
  const candidatePlatform = platformChoice ?? (platforms[0] ? String(platforms[0].id) : '');
  const [candidates, reloadCandidates] = useLoad(async () => {
    if (!broadcast || !candidateCategory || !candidatePlatform || candidatePlatform === 'other') return [] as Raw[];
    return list(await unwrap(api.GET('/api/request-groups/candidates', { params: { query: {
      category: candidateCategory as NonNullable<RequestBody['serviceCategory']>, platformId: Number(candidatePlatform),
      applicationOpenDate: candidateValues.applicationOpenDate || undefined,
      applicationOpenTime: candidateValues.applicationOpenTime || undefined,
      agencyBudgetDesired: candidateValues.agencyBudgetDesired ? Number(candidateValues.agencyBudgetDesired) : undefined,
      upfrontBudgetDesired: candidateValues.upfrontBudgetDesired ? Number(candidateValues.upfrontBudgetDesired) : undefined,
    } } })));
  }, [broadcast, userKey, candidateCategory, candidatePlatform, candidateValues.applicationOpenDate,
    candidateValues.applicationOpenTime, candidateValues.agencyBudgetDesired, candidateValues.upfrontBudgetDesired], { resetOnLoad: true });
  const candidateRows = candidates.status === 'done' ? candidates.data : [];
  const candidatesReady = candidates.status === 'done' && candidateRows.length > 0;

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
  function saveDraft(manual = false, selectedPlatform = platform) {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = {};
    for (const name of DRAFT_FIELDS) {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) values[name] = el.value;
    }
    values.platform = selectedPlatform;
    persistDraft(values, manual);
  }

  function persistDraft(values: Record<string, string>, manual = false) {
    try {
      if (broadcast) {
        saveGroupDraft(userKey, values);
        setCandidateValues(values);
        setSingleConfirmed(false);
      } else localStorage.setItem(storageKey, JSON.stringify(values));
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      setSaveFailed(false);
      if (manual) toast(broadcast ? '작성 중인 내용을 현재 탭에 24시간 동안 저장했어요.' : '작성 중인 내용을 이 브라우저에 저장했어요.');
    } catch {
      setSaveFailed(true);
      if (manual) toast('임시저장에 실패했어요.');
    }
  }

  function clearDraft() {
    try { (broadcast ? sessionStorage : localStorage).removeItem(storageKey); } catch { /* 저장소 오류로 전송 성공을 실패 처리하지 않는다. */ }
  }

  // 불러오기: 현재 계정으로 이 브라우저에 저장한 초안만 보여 준다.
  function openLoad() {
    try {
      const drafts: DraftSource[] = [];
      if (broadcast) {
        const values = readGroupDraft(userKey);
        if (Object.keys(values).length) drafts.push({ key: storageKey, values });
      } else {
        const prefix = `pico_quote_draft_${userKey}_`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith(prefix) || !/^(agent|edit)-\d+$/.test(key.slice(prefix.length))) continue;
          const values = readDraft(key);
          if (Object.keys(values).length) drafts.push({ key, values });
        }
      }
      setSources(drafts);
      setPicked('');
      setDeleteConfirm(false);
      setLoadOpen(true);
    } catch {
      toast('임시저장 목록을 읽지 못했어요. 브라우저의 저장소 설정을 확인해 주세요.');
    }
  }

  function applyLoad() {
    const src = sources.find((r) => r.key === picked);
    if (!src) return;
    const saved = broadcast ? readGroupDraft(userKey) : src.values;
    if (!Object.keys(saved).length) {
      setLoadOpen(false);
      toast('불러올 임시저장 내용이 없어요. 저장 기간이 지났거나 삭제됐을 수 있어요.');
      return;
    }
    const values = Object.fromEntries(DRAFT_FIELDS.map((name) => [name, saved[name] ?? '']));
    // 다른 도우미의 초안이라 지원하지 않는 예매처면 다시 선택받는다.
    if (platforms.length > 0 && values.platform !== 'other' && !options.some((p) => String(p.id) === values.platform)) values.platform = '';
    setRestored(values);
    setPlatformChoice(values.platform);
    setFormRevision((n) => n + 1);
    setAgreed({ terms: false, privacy: false, contact: false });
    persistDraft(values);
    setLoadOpen(false);
    setErrors({});
    setError('');
    toast('임시저장한 내용을 불러왔어요. 예매처·날짜·응답 기한을 다시 확인해 주세요.');
  }

  function deleteDraft() {
    try {
      (broadcast ? sessionStorage : localStorage).removeItem(picked);
      setSources((all) => all.filter((r) => r.key !== picked));
      if (picked === storageKey) setSavedAt('');
      setPicked('');
      setDeleteConfirm(false);
      toast('임시저장한 내용을 삭제했어요. 작성 화면의 내용은 그대로예요.');
    } catch {
      toast('임시저장한 내용을 삭제하지 못했어요. 다시 시도해 주세요.');
    }
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
    if (!(broadcast && !loggedIn) && (identity.status !== 'done' || !identity.data.verified)) {
      setError('계정 화면에서 본인인증을 완료한 뒤 요청을 보내 주세요.');
      return;
    }
    const form = e.currentTarget;
    if (broadcast && uncertain) {
      await run(async () => {
        try {
          const result = await submitGroup(userKey, uncertain.request, uncertain.allowSingle ?? false);
          navigate(`/request-groups/${result.id}`, { replace: true });
        } finally { setUncertain(pendingGroupSubmission(userKey)); reloadCandidates(); }
      });
      return;
    }
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
    if (d.agencyBudgetDesired && d.agencyBudgetMax && Number(d.agencyBudgetDesired) > Number(d.agencyBudgetMax)) {
      return fail(form, { agencyBudgetMax: '최대 수고비는 희망 수고비 이상이어야 해요.' });
    }
    if (new Date(d.expiresAt) <= new Date()) return fail(form, { expiresAt: '응답 기한은 지금보다 뒤여야 해요.' });
    // 가이드 6-2: 수락 기한은 신청(티켓) 오픈 시각 이전이어야 한다. 오픈 날짜·시각은 한국 시간.
    const openAt = new Date(`${d.applicationOpenDate}T${d.applicationOpenTime || '00:00'}:00+09:00`);
    if (new Date(d.expiresAt) >= openAt) return fail(form, { expiresAt: '도우미 응답 기한은 티켓 오픈 시각보다 앞서야 해요.' });
    if (broadcast) {
      if (!candidatesReady) return setError('조건에 맞는 도우미를 확인한 뒤 다시 시도해 주세요.');
      if (candidateRows.length === 1 && !singleConfirmed) return setError('현재 도우미 1명에게 보내기에 동의해 주세요.');
      if (!loggedIn) {
        saveDraft();
        navigate('/signup', { state: { from: '/request/start' } });
        return;
      }
    }
    if (!allAgreed) return setError('필수 약관과 연락처 제공에 동의해 주세요.');
    const contactSharingDocumentId = findPolicy(policies, 'CONTACT_SHARING').id;
    if (!contactSharingDocumentId) return setError('연락처 공유 동의 문서를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
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
      locationNote: d.locationNote || undefined,
      requestedQuantity: optionalNumber(d.requestedQuantity),
      requirements: d.requirements,
      successConditions: d.successConditions,
      purchaseBudgetMax: edit?.purchaseBudgetMax,
      agencyBudgetDesired: Number(d.agencyBudgetDesired),
      agencyBudgetMax: optionalNumber(d.agencyBudgetMax),
      upfrontBudgetDesired: optionalNumber(d.upfrontBudgetDesired),
      additionalNote: d.additionalNote || undefined,
      applicationRound: (d.applicationRound || undefined) as RequestBody['applicationRound'],
      expiresAt: toUtc(d.expiresAt),
      contactSharingDocumentId,
    };
    await run(async () => {
      // 명세: 요청에는 이용자 연락처가 필요하다. 없으면 먼저 저장한다.
      if (!hasContact) await unwrap(api.PUT('/api/me/contacts', { body: { kind: d.contactKind as 'PHONE', value: d.contactValue, primary: true } }));
      if (broadcast) {
        saveDraft();
        try {
          const result = await submitGroup(userKey, {
            targetName: body.targetName!, serviceCategory: body.serviceCategory!, applicationOpenDate: body.applicationOpenDate!,
            applicationOpenTime: body.applicationOpenTime, scheduledUseDate: body.scheduledUseDate, scheduledUseTime: body.scheduledUseTime,
            platformId: Number(platform), locationNote: body.locationNote, requestedQuantity: Number(d.requestedQuantity),
            requirements: body.requirements!, successConditions: body.successConditions!, agencyBudgetDesired: Number(d.agencyBudgetDesired),
            agencyBudgetMax: body.agencyBudgetMax, upfrontBudgetDesired: body.upfrontBudgetDesired, additionalNote: body.additionalNote,
            applicationRound: body.applicationRound, expiresAt: body.expiresAt!, contactSharingDocumentId,
          }, candidateRows.length === 1 && singleConfirmed);
          navigate(`/request-groups/${result.id}`, { replace: true });
        } finally { setUncertain(pendingGroupSubmission(userKey)); reloadCandidates(); }
      } else if (edit) {
        await unwrap(api.PUT('/api/requests/{requestId}', { params: { path: { requestId: edit.id } }, body }));
        clearDraft();
        navigate(edit.raw.requestGroupId ? `/request-groups/${edit.raw.requestGroupId}` : `/requests/${edit.id}`, { replace: true });
      } else {
        const created = await unwrap<Raw>(api.POST('/api/requests', { body }));
        clearDraft();
        const newId = Number(pick(created, 'requestId', 'id'));
        navigate(newId ? `/request-sent/${newId}` : '/requests', { replace: true, state: { agentName: agent.name, targetName: d.targetName } });
      }
    }, edit ? '요청 내용을 수정했어요.' : undefined);
  }

  return (
    <>
      <PageTitle title={edit ? '요청 내용 수정' : broadcast ? '내 요청서 작성하기' : '요청 보내기'} crumbs={edit ? [{ label: '요청 상세', to: `/requests/${edit.id}` }] : broadcast ? [] : [{ label: '도우미 프로필', to: `/agents/${agentId}` }]} />
      {broadcast && <Notice>지금부터 실제 요청서를 작성해요. 조건에 맞는 도우미 최대 3명에게 전달하고, 먼저 수락한 1명과 조건을 협의해요. 나머지 요청은 자동 종료돼요.</Notice>}
      {!!edit?.raw.requestGroupId && <Notice>수정 내용은 아직 응답 대기 중인 도우미의 요청 전체에 적용돼요. 이미 거절하거나 종료한 요청에는 다시 보내지 않아요.</Notice>}
      {uncertain && broadcast && <Notice>지난 전송 결과를 확인하지 못했어요. 아래 버튼으로 같은 요청의 결과를 확인해 주세요.</Notice>}
      {broadcast && <p className="prose">작성 내용은 현재 탭에서 24시간 동안 이어 쓸 수 있어요.</p>}
      {(!broadcast || loggedIn) && (identity.status === 'loading' ? <Notice>본인인증 상태를 확인하고 있어요.</Notice> : identity.status === 'error' ? (
        <Notice tone="error">본인인증 상태를 확인하지 못했어요. <button type="button" className="text-link" onClick={reloadIdentity}>다시 확인하기</button></Notice>
      ) : !identity.data.verified ? (
        <Notice>요청을 보내려면 본인인증이 필요해요. 작성한 내용은 임시저장할 수 있어요. <Link to="/account" onClick={() => saveDraft(false)}>계정에서 본인인증하기</Link></Notice>
      ) : null)}
      <form id="tx-quote-form" ref={formRef} className="detail-layout tx-layout" noValidate onSubmit={submit} onChange={(e) => {
        const name = (e.target as HTMLElement).getAttribute('name');
        if (DRAFT_FIELDS.some((field) => field === name)) saveDraft(false, name === 'platform' && e.target instanceof HTMLSelectElement ? e.target.value : platform);
      }}>
        <div inert={broadcast && (!!uncertain || pending)}>
          <TxCard
            key={formRevision}
            title="요청서"
            actions={
              <div className="tx-load-actions">
                <button type="button" className="btn ghost" onClick={openLoad}>
                  불러오기
                </button>
                <button type="button" className="btn ghost" onClick={() => saveDraft(true)}>
                  임시저장
                </button>
              </div>
            }
          >
            <Field label="공연명" required error={errors.targetName}>
              <input name="targetName" required maxLength={250} defaultValue={restored.targetName ?? edit?.targetName} placeholder="예: 태연 콘서트" />
            </Field>
            <Field label="분야" required error={errors.serviceCategory}>
              <select name="serviceCategory" required defaultValue={restored.serviceCategory ?? defaultCategory}>
                {categories.map((c) => (
                  <option key={c} value={c} disabled={agentCategories.length > 0 && !agentCategories.includes(c) && c !== defaultCategory}>
                    {categoryNames[c]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="공연 날짜" error={errors.scheduledUseDate}>
                <input name="scheduledUseDate" type="date" defaultValue={restored.scheduledUseDate ?? edit?.scheduledUseDate} />
              </Field>
              <Field label="공연 시작 시간" error={errors.scheduledUseTime}>
                <input name="scheduledUseTime" type="time" defaultValue={restored.scheduledUseTime ?? edit?.scheduledUseTime} />
              </Field>
              <Field label="티켓 오픈 날짜" required error={errors.applicationOpenDate}>
                <input name="applicationOpenDate" type="date" required defaultValue={restored.applicationOpenDate ?? edit?.applicationOpenDate} />
              </Field>
              <Field label="티켓 오픈 시간" error={errors.applicationOpenTime}>
                <input name="applicationOpenTime" type="time" defaultValue={restored.applicationOpenTime ?? edit?.applicationOpenTime} />
              </Field>
            </div>
            <Field label="공연장·위치" helper="같은 공연의 지역·회차를 구분할 수 있도록 공연장 이름이나 지역을 적어 주세요. 선택 항목이에요." error={errors.locationNote}>
              <input name="locationNote" maxLength={250} defaultValue={restored.locationNote ?? edit?.locationNote} placeholder="예: 서울 KSPO DOME" />
            </Field>
            <Field label="매수" required error={errors.requestedQuantity}>
              <input name="requestedQuantity" type="number" required min={1} max={2147483647} step={1} defaultValue={restored.requestedQuantity ?? edit?.requestedQuantity} placeholder="예: 2" />
            </Field>
            <Field label="예매 회차" error={errors.applicationRound}>
              <select name="applicationRound" defaultValue={restored.applicationRound ?? edit?.applicationRound ?? ''}>
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
                {!broadcast && <option value="other">기타</option>}
              </select>
            </Field>
            {platform === 'other' && (
              <Field label="예매처 직접 입력" required error={errors.otherPlatformName}>
                <input name="otherPlatformName" required maxLength={150} defaultValue={restored.otherPlatformName ?? edit?.otherPlatformName} />
              </Field>
            )}
            <Field label="희망 좌석·요청 내용" required error={errors.requirements} helper="원하는 좌석과 요청 사항을 적어 주세요. 도우미가 어떻게 진행할지 참고하는 내용이에요.">
              <textarea name="requirements" rows={3} required maxLength={10000} defaultValue={restored.requirements ?? edit?.requirements} placeholder="예: 1층 지정석, 연석 2매" />
            </Field>
            <Field label="성공 요건" required error={errors.successConditions} helper="희망 좌석을 확보하지 못해도 성공으로 인정할 최소 조건과, 그 경우 지급할 최소 수고비를 함께 적어 주세요.">
              <textarea name="successConditions" rows={3} required maxLength={10000} defaultValue={restored.successConditions ?? edit?.successConditions} placeholder="예: 1층 B~C구역 연석 2매 확보 시 성공으로 인정하며, 이 경우 수고비는 최소 30,000원" />
            </Field>
            <Field label="희망 착수비 (원)" helper="예매 시도에 대해 제안하는 금액이에요. 0원도 입력할 수 있고, 비워 두면 미정으로 전달돼요." error={errors.upfrontBudgetDesired}>
              <input name="upfrontBudgetDesired" type="number" min={0} max={Number.MAX_SAFE_INTEGER} step={1} defaultValue={restored.upfrontBudgetDesired ?? edit?.upfrontBudgetDesired} placeholder="예: 5000" />
            </Field>
            <div className="form-grid">
              <Field label="희망 수고비 (원)" required helper="희망 좌석을 확보했을 때 지급하고 싶은 수고비예요. 최종 금액은 서로 합의해요." error={errors.agencyBudgetDesired}>
                <input name="agencyBudgetDesired" type="number" required min={0} max={Number.MAX_SAFE_INTEGER} step={1} defaultValue={restored.agencyBudgetDesired ?? edit?.agencyBudgetDesired} placeholder="예: 30000" />
              </Field>
              <Field label="최대 수고비 (원)" helper="희망 좌석 확보 시 지급할 수 있는 최대 수고비예요." error={errors.agencyBudgetMax}>
                <input name="agencyBudgetMax" type="number" min={0} max={Number.MAX_SAFE_INTEGER} step={1} defaultValue={restored.agencyBudgetMax ?? edit?.agencyBudgetMax} placeholder="예: 50000" />
              </Field>
            </div>
            <Field label="기타 사항" error={errors.additionalNote}>
              <textarea name="additionalNote" rows={3} maxLength={10000} defaultValue={restored.additionalNote ?? edit?.additionalNote} />
            </Field>
            <Field label="도우미 응답 기한" required helper="티켓 오픈 전이어야 해요. 이 시간까지 도우미가 수락하지 않으면 요청이 만료돼요." error={errors.expiresAt}>
              <input
                name="expiresAt"
                type="datetime-local"
                required
                defaultValue={restored.expiresAt ?? (edit?.expiresAt ? toLocalInput(new Date(edit.expiresAt + (edit.expiresAt.endsWith('Z') ? '' : 'Z'))) : defaultExpiry())}
              />
            </Field>
          </TxCard>
          <p className="record-note" id="tx-save-status" role="status">
            {saveFailed ? '자동 임시저장에 실패했어요. 화면을 떠나기 전에 작성 내용을 복사해 주세요.' : savedAt ? `${savedAt}에 자동 임시저장했어요. 이 브라우저에서 이어 쓸 수 있어요.` : '입력한 내용은 이 브라우저에 자동 임시저장돼요. 연락처와 동의 체크는 저장하지 않아요.'}
          </p>
          {loggedIn && !hasContact && (
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
          <section className={`content-card quote-submit-card${broadcast ? ' broadcast-submit-card' : ''}`}>
            {broadcast ? <>
              <span className="tiny-label">맞춤 요청</span>
              <div className="broadcast-heading">
                <h2>요청받을 도우미</h2>
                <span className="broadcast-count">최대 3명</span>
              </div>
              <p className="broadcast-intro">분야·예매처·제안 비용에 맞춰 추천해요.</p>
              {candidates.status === 'loading' ? <p className="broadcast-hint" role="status">도우미를 확인하고 있어요.</p> : candidates.status === 'error' ?
                <Notice tone="error">도우미를 확인하지 못했어요. <button type="button" className="text-link" onClick={reloadCandidates}>다시 확인</button></Notice> :
                candidateRows.length ? <>
                  <ul className="broadcast-candidates">{candidateRows.map(c => <li key={String(c.agentId)}>
                    <Link className="mini-profile broadcast-candidate" to={`/agents/${c.agentId}`} target="_blank" rel="noreferrer" aria-label={`${String(c.activityName)} 프로필 새 창에서 보기`}>
                      <span className="avatar small blue" aria-hidden="true"><Icon name="user" size={18} /></span>
                      <div><strong>{String(c.activityName)}</strong><span>분야·예매처 일치</span></div>
                      <Icon name="chevron" size={16} />
                    </Link>
                  </li>)}</ul>
                  <p className="broadcast-hint">전송 시 도우미가 달라질 수 있어요.</p>
                </> : <div className="broadcast-empty">
                  <Icon name="search" size={22} />
                  <strong>{candidateCategory && candidatePlatform ? '조건에 맞는 도우미가 없어요' : '요청 조건을 먼저 선택해 주세요'}</strong>
                  <p>{candidateCategory && candidatePlatform ? '예매처나 제안 비용을 바꾸거나, 도우미를 직접 찾아보세요.' : '분야와 예매처를 선택하면 가능한 도우미를 보여드려요.'}</p>
                  {candidateCategory && candidatePlatform && <Link className="text-link" to="/">도우미 직접 찾기 <Icon name="arrow" size={14} /></Link>}
                </div>}
              {candidateRows.length === 1 && <label className="check-row"><input type="checkbox" checked={singleConfirmed} disabled={!!uncertain} onChange={e => setSingleConfirmed(e.target.checked)} />현재 가능한 도우미 1명에게 보내는 데 동의해요.</label>}
            </> : <>
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
            </>}
            {!broadcast && <Notice>PICO에서는 결제하지 않아요. 도우미가 보낸 최종 조건을 확정하면 매칭이 완료되고, 비용은 도우미와 직접 정산해요.</Notice>}
            {loggedIn && <div className="quote-agreements" inert={broadcast && (!!uncertain || pending)}>
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
                  <a className="quote-terms-view" href={policyPaths[type]} target="_blank" rel="noreferrer" aria-label={`${label} 보기`}>
                    보기
                  </a>
                </div>
              ))}
            </div>
            }
            {!broadcast && <BookingTermsNotice />}
            <div className="account-form-error" aria-live="polite">
              {error}
            </div>
            {broadcast && !loggedIn && <p className="broadcast-hint broadcast-auth-hint">작성 내용은 가입 후에도 유지돼요.<br />본인인증·연락처 확인 후 전송할 수 있어요.</p>}
            <button type="submit" className="btn primary full" disabled={pending || authLoading || (broadcast ? !uncertain && (!candidatesReady || (candidateRows.length === 1 && !singleConfirmed) || (loggedIn && (!allAgreed || identity.status !== 'done' || !identity.data.verified))) : !allAgreed || identity.status !== 'done' || !identity.data.verified)}>
              {pending ? '보내는 중…' : broadcast && uncertain ? '전송 결과 다시 확인하기' : broadcast && !loggedIn ? '회원가입 후 요청서 보내기' : edit ? '수정 내용 저장' : broadcast ? '동의하고 요청서 보내기' : '요청 보내기'}
            </button>
            {broadcast && !loggedIn && <p className="broadcast-login"><span>이미 계정이 있나요?</span><Link to="/login" state={{ from: '/request/start' }} onClick={() => saveDraft()}>로그인</Link></p>}
            {broadcast && <div className="broadcast-support">
              <p><Icon name="info" size={15} /><span><strong>PICO 내 결제는 없어요</strong>최종 조건 확정 후 도우미와 직접 정산해요.</span></p>
              <BookingTermsNotice />
            </div>}
          </section>
        </aside>
      </form>
      {loadOpen && (
        <Modal title="임시저장 불러오기" className={broadcast ? 'broadcast-draft-modal' : ''} onClose={() => setLoadOpen(false)}>
          <p className="prose">{broadcast ? '현재 탭의 요청서 1개를 마지막 저장부터 24시간 동안 보관해요. 수정 내용은 자동 저장되고, 다시 방문하면 이어서 작성할 수 있어요. 불러오면 현재 작성 내용을 덮어쓰며 연락처와 동의는 다시 확인해야 해요.' : '이 브라우저에서 내 계정으로 임시저장한 요청서예요. 선택한 내용을 불러오면 작성 중인 요청서를 덮어써요. 요청을 받을 도우미는 바뀌지 않아요.'}</p>
          {sources.length ? (
            <div className="tx-load-list">
              {sources.map((r) => (
                <label key={r.key} className="tx-load-choice">
                  <input type="radio" name="loadSource" value={r.key} checked={picked === r.key} onChange={() => { setPicked(r.key); setDeleteConfirm(false); }} />
                  <span>
                    <strong>{r.values.targetName || '제목 없는 요청서'}</strong>
                    <small>
                      {r.values.applicationOpenDate || '오픈일 미정'} · {categoryNames[r.values.serviceCategory as keyof typeof categoryNames] ?? r.values.serviceCategory}
                      {r.key === storageKey ? ' · 현재 요청서' : ''}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="empty">임시저장한 요청서가 없어요.</p>
          )}
          {deleteConfirm ? (
            <>
              <p role="alert">선택한 임시저장 내용을 삭제할까요? 삭제하면 복구할 수 없어요. 작성 화면의 내용은 남고, 다시 입력하면 자동 저장돼요.</p>
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setDeleteConfirm(false)}>취소</button>
                <button type="button" className="btn primary" onClick={deleteDraft}>삭제 확인</button>
              </div>
            </>
          ) : (
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setLoadOpen(false)}>닫기</button>
              <button type="button" className="btn secondary" disabled={!picked} onClick={() => setDeleteConfirm(true)}>삭제</button>
              <button type="button" className="btn primary" disabled={!picked} onClick={applyLoad}>선택한 임시저장 불러오기</button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

export function RequestSentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // 보낸 요청의 정책 검토 결과(policyGateStatus)로 안내를 나눈다. 불러오지 못하면 기존 안내를 보인다.
  const [load] = useLoad(() => unwrap<Raw>(api.GET('/api/requests/{requestId}', { params: { path: { requestId: Number(id) } } })).then(toRequest), [id]);
  const r = load.status === 'done' ? load.data : null;
  const gate = r?.policyStatus.toUpperCase() ?? '';
  const blocked = gate === 'BLOCKED';
  const [title, body]: [string, string[]] =
    load.status === 'loading'
      ? ['요청 상태를 확인하고 있어요', []]
      : gate === 'ALLOWED'
        ? ['도우미에게 요청이 도착했어요', ['도우미가 수락하면 알림으로 알려드릴게요.']]
        : gate === 'PENDING'
          ? ['운영팀이 요청 내용을 확인하고 있어요', ['확인이 끝나면 도우미에게 전달하고 알림으로 알려드릴게요.']]
          : blocked && r
            ? ['요청을 도우미에게 보낼 수 없어요', [policyBlockMessage(r) || '요청 내용을 확인하고 고쳐 주세요.']]
            : ['도우미에게 마음이 도착했어요', ['요청 내용을 자동으로 확인한 뒤 도우미에게 전달해요. 추가 확인이 필요하면 운영팀이 검토해요.', '수락과 최종 조건 도착 소식은 알림으로 알려드릴게요.']];
  return (
    <section className="tx-success">
      <div className="success-circle">
        <Icon name={blocked ? 'info' : 'check'} size={34} />
      </div>
      <span className="tiny-label">{blocked ? '요청 확인 필요' : '요청 전송 완료'}</span>
      <h1>{title}</h1>
      {body.length > 0 && (
        <p>
          {body.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
      )}
      {r?.status === 'PENDING' && <p>도우미가 수락하기 전에는 보낸 요청에서 내용을 수정하거나 취소할 수 있어요.</p>}
      <div>
        {blocked && r?.agentId ? (
          // 수락 전 요청을 고치는 기존 진입점(요청 상세의 '요청 고치기'와 같다)
          <button type="button" className="btn primary" onClick={() => navigate(`/quote/${r.agentId}?edit=${r.id}`)}>
            요청 고치기
          </button>
        ) : null}
        <button type="button" className={`btn ${blocked && r?.agentId ? 'secondary' : 'primary'}`} onClick={() => navigate(`/requests/${id}`)}>
          보낸 요청 확인
        </button>
        <button type="button" className="btn secondary" onClick={() => navigate('/requests')}>
          내 활동으로
        </button>
      </div>
      <small>PICO에서는 결제하지 않아요. 최종 조건을 확정하면 매칭이 완료돼요.</small>
    </section>
  );
}
