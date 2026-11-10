import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { finishRegistration, registrationErrorMessage, startRegistrationIdentity } from '../auth/registrationIdentity';
import { clearRegistrationDraft, readRegistrationDraft, recordRegistrationStep, type RegistrationDraft, type RegistrationInput } from '../auth/registrationDraft';
import { useRegistrationDraft } from '../auth/useRegistrationDraft';
import { ApiError } from '../api/client';
import { clearSocialFlow, completeSocial, readSocialFlow, socialNames, socialRequest, socialFlowExpired, type SocialResult } from '../auth/social';
import { setTokens } from '../api/tokens';
import { findPolicy, usePolicies } from '../api/policies';
import { AccountInput, AccountNote } from '../ui/account';

export function SocialCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { reloadMe } = useAuth();
  const [flow] = useState(readSocialFlow);
  const [result, setResult] = useState<SocialResult | null>(null);
  const location = useLocation();
  const { draft, setDraft, notice, setNotice, cancel } = useRegistrationDraft('social', typeof location.state?.registrationNotice === 'string' ? location.state.registrationNotice : '');
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(() => socialFlowExpired(flow));
  const [opening, setOpening] = useState(false);
  const [retry, setRetry] = useState(0);
  const activeRequest = useRef(false);
  const openingRef = useRef(false);
  const generation = useRef(0);
  const [pending, setPending] = useState(false);
  const policies = usePolicies();
  const failed = params.has('error');
  useEffect(() => {
    if (!failed && flow && !expired) return;
    clearSocialFlow();
    const saved = readRegistrationDraft().draft;
    if (saved?.input.kind === 'social') clearRegistrationDraft(saved.identityVerificationToken);
    setDraft(null);
  }, [failed, flow, expired, setDraft]);
  const sessionExpired = useCallback(() => {
    clearSocialFlow();
    const saved = readRegistrationDraft().draft;
    if (saved?.input.kind === 'social') clearRegistrationDraft(saved.identityVerificationToken);
    setDraft(null); setExpired(true);
    recordRegistrationStep('expired', 'SESSION_EXPIRED');
    setError('소셜 로그인 시간이 만료되었거나 가입이 이미 처리되었을 수 있어요. 소셜 로그인부터 다시 시작해 주세요.');
  }, [setDraft]);
  useEffect(() => {
    if (!flow?.expiresAt) return;
    const timer = setTimeout(sessionExpired, Math.max(0, flow.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [flow, sessionExpired]);
  useEffect(() => {
    if (failed || !flow || expired) return;
    let active = true;
    void completeSocial(flow).then(async data => {
      if (!active) return;
      if (data.status === 'LOGGED_IN' && data.tokens) {
        const saved = readRegistrationDraft().draft;
        if (saved?.input.kind === 'social' && saved.input.flowSecret === flow.flowSecret) clearRegistrationDraft(saved.identityVerificationToken);
        setTokens(data.tokens); clearSocialFlow(); navigate(flow.from, { replace: true });
      } else if (data.status === 'LINKED') {
        clearSocialFlow(); await reloadMe(); navigate('/user-profile', { replace: true });
      } else setResult(data);
    }).catch(e => {
      if (!active) return;
      if (e instanceof ApiError && e.status === 401) sessionExpired();
      else setError(e instanceof Error ? e.message : '인증하지 못했어요.');
    });
    return () => { active = false; };
  }, [failed, flow, expired, retry, navigate, reloadMe, sessionExpired]);

  function inputFrom(form: HTMLFormElement): RegistrationInput | null {
    if (!form.reportValidity() || !flow) return null;
    if (socialFlowExpired(flow)) { sessionExpired(); return null; }
    const termsDocumentId = findPolicy(policies, 'TERMS').id;
    const privacyDocumentId = findPolicy(policies, 'PRIVACY').id;
    if (!termsDocumentId || !privacyDocumentId) { setError('약관을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); return null; }
    return { kind: 'social', flowSecret: flow.flowSecret, nickname: String(new FormData(form).get('nickname')).trim(),
      termsDocumentId, privacyDocumentId, adultConfirmed: new FormData(form).get('agreement_age') === 'on' };
  }
  function registrationFailed(error: unknown) {
    if (error instanceof ApiError && error.status === 401) sessionExpired();
    else setError(registrationErrorMessage(error));
  }
  async function complete(form: HTMLFormElement, saved: RegistrationDraft) {
    if (activeRequest.current) return;
    const input = inputFrom(form);
    if (!input || !flow) return;
    activeRequest.current = true; setPending(true); setError(''); setNotice('');
    try {
      const data = await finishRegistration(saved, input);
      if (!data?.tokens) throw new ApiError(0, '로그인 정보를 받지 못했어요.');
      setTokens(data.tokens); setDraft(null); clearSocialFlow(); navigate(flow.from, { replace: true });
    } catch (e) { registrationFailed(e); }
    finally { activeRequest.current = false; setPending(false); }
  }
  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (activeRequest.current) return;
    const form = e.currentTarget;
    const input = inputFrom(form);
    if (!input || input.kind !== 'social') return;
    const saved = readRegistrationDraft().draft;
    if (saved?.input.kind === 'social' && saved.input.flowSecret === input.flowSecret) return complete(form, saved);
    if (openingRef.current) return;
    const attempt = ++generation.current;
    openingRef.current = true; setOpening(true); setError(''); setNotice('');
    try {
      const verified = await startRegistrationIdentity(input, setDraft);
      if (verified && generation.current === attempt) await complete(form, verified);
    } catch (e) {
      if (generation.current === attempt) { setDraft(readRegistrationDraft().draft); registrationFailed(e); }
    }
    finally {
      if (generation.current === attempt) { openingRef.current = false; setOpening(false); }
    }
  }
  function cancelRegistration() {
    generation.current++; openingRef.current = false; setOpening(false); setError(''); cancel();
  }
  async function withdraw() {
    if (!flow) return;
    setPending(true); setError('');
    try {
      await socialRequest('/api/me/social/withdraw', { flowSecret: flow.flowSecret });
      clearSocialFlow(); setTokens(null); navigate('/', { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : '탈퇴하지 못했어요.'); }
    finally { setPending(false); }
  }
  const restored = draft?.input.kind === 'social' && draft.input.flowSecret === flow?.flowSecret ? draft.input : null;
  return <div className="account-contained"><section className="content-card">
    <h1>{result?.status === 'REGISTRATION_REQUIRED' ? '가입 마무리' : result?.status === 'REAUTHENTICATED' ? '회원 탈퇴 확인' : '소셜 로그인'}</h1>
    {failed || !flow || expired ? <><p role="alert">{error || '소셜 인증이 취소되었거나 만료됐어요. 소셜 로그인부터 다시 시작해 주세요.'}</p><Link to="/login">로그인으로 돌아가기</Link></> : <>
      {error && <p className="account-form-error" role="alert">{error}</p>}
      {!result && !error && <p role="status">인증 결과를 확인하고 있어요…</p>}
      {!result && error && <><button className="btn secondary" onClick={() => { setError(''); setRetry(value => value + 1); }}>인증 결과 다시 확인</button> <Link to="/login">로그인으로 돌아가기</Link></>}
      {result?.status === 'REGISTRATION_REQUIRED' && policies !== null && <form onSubmit={register} aria-busy={pending}>
        {restored && <AccountNote><strong>진행 중인 가입이 있어요.</strong> 본인인증을 마쳤다면 가입 이어하기를 눌러 주세요.</AccountNote>}
        {notice && <p className="prose" role="status">{notice}</p>}
        <p className="prose">{socialNames[result.provider]} 인증을 완료했어요. 닉네임과 필수 약관 동의를 입력한 뒤 본인인증으로 가입을 마쳐 주세요.</p>
        <AccountNote>이미 PICO 계정이 있다면 기존 계정으로 로그인한 뒤 프로필에서 소셜 로그인을 연결해 주세요. 이미 가입된 본인정보로는 새 계정을 만들 수 없어요.</AccountNote>
        <Link className="text-link" to="/login" onClick={() => { clearSocialFlow(); if (draft) clearRegistrationDraft(draft.identityVerificationToken); }}>기존 계정으로 로그인하기</Link>
        <AccountInput name="nickname" defaultValue={restored?.nickname} label="닉네임" required maxLength={50} />
        <p className="prose">PICO는 만 19세 이상만 가입할 수 있어요. 본인인증을 마쳐야 가입이 완료되며, 한 사람당 하나의 계정만 만들 수 있어요.</p>
        <div className="account-agreements">
          <div><label className="check-row"><input type="checkbox" name="agreement_age" defaultChecked={restored?.adultConfirmed} required /><span>만 19세 이상입니다. <small>(필수)</small></span></label></div>
          {(['TERMS', 'PRIVACY'] as const).map(type => <div key={type}>
            <label className="check-row"><input type="checkbox" defaultChecked={!!restored && (type === 'TERMS' ? restored.termsDocumentId : restored.privacyDocumentId) === findPolicy(policies, type).id} required /><span>{type === 'TERMS' ? '서비스 이용약관' : '개인정보 수집·이용'} <small>(필수)</small></span></label>
            <a className="text-link" href={findPolicy(policies, type).url || (type === 'TERMS' ? '/terms' : '/signup-privacy')} target="_blank" rel="noreferrer">보기</a>
          </div>)}
        </div>
        <p className="prose"><a className="text-link" href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침</a>에서 전체 처리 내용을 확인할 수 있어요.</p>
        <AccountNote><strong>현재 카카오 본인인증은 이용할 수 없어요.</strong> 다른 인증 수단을 이용해 주세요.</AccountNote>
        <div className="account-form-footer"><button className="btn primary" disabled={pending || (opening && !restored)}>{pending ? '가입 확인 중…' : restored ? '가입 이어하기' : opening ? '인증창 여는 중…' : '본인인증하고 가입하기'}</button></div>
        {restored && <button className="text-link" type="button" disabled={pending} onClick={cancelRegistration}>가입 진행 취소하고 다시 시작</button>}
      </form>}
      {result?.status === 'REAUTHENTICATED' && <>
        <p>연결한 소셜 계정을 확인했어요. 아래 버튼을 눌러야 탈퇴가 완료돼요.</p>
        <AccountNote>연락처·본인인증·계좌 확인 정보는 삭제하며 거래·결제 기록은 법에 따라 보관해요. 응답 대기·조건 협의 중인 요청이나 진행 중인 거래, 처리 중인 매칭권 환불이 있으면 탈퇴할 수 없어요. 탈퇴 후 30일간 같은 명의의 본인인증이 제한돼요(도우미 활동 정지 시 3년).</AccountNote>
        <button className="btn danger" disabled={pending} onClick={() => void withdraw()}>탈퇴 확정</button>{' '}
        <Link to="/user-profile" onClick={clearSocialFlow}>취소</Link>
      </>}
    </>}
  </section></div>;
}
