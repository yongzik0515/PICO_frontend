import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { clearSocialFlow, completeSocial, readSocialFlow, socialNames, socialRequest, type SocialResult } from '../auth/social';
import { setTokens } from '../api/tokens';
import { findPolicy, usePolicies } from '../api/policies';
import { AccountInput, AccountNote } from '../ui/account';

export function SocialCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { reloadMe } = useAuth();
  const [flow] = useState(readSocialFlow);
  const [result, setResult] = useState<SocialResult | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const policies = usePolicies();
  const failed = params.has('error');
  useEffect(() => {
    if (failed || !flow) return;
    let active = true;
    void completeSocial(flow).then(async data => {
      if (!active) return;
      if (data.status === 'LOGGED_IN' && data.tokens) {
        setTokens(data.tokens); clearSocialFlow(); navigate(flow.from, { replace: true });
      } else if (data.status === 'LINKED') {
        clearSocialFlow(); await reloadMe(); navigate('/user-profile', { replace: true });
      } else setResult(data);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : '인증하지 못했어요.'); });
    return () => { active = false; };
  }, [failed, flow, navigate, reloadMe]);

  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity() || !flow) return;
    const termsDocumentId = findPolicy(policies, 'TERMS').id;
    const privacyDocumentId = findPolicy(policies, 'PRIVACY').id;
    if (!termsDocumentId || !privacyDocumentId) return setError('약관을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    setPending(true); setError('');
    try {
      const data = await socialRequest<SocialResult>('/api/auth/social/register', { flowSecret: flow.flowSecret,
        nickname: String(new FormData(form).get('nickname')).trim(), termsDocumentId, privacyDocumentId, adultConfirmed: new FormData(form).get('agreement_age') === 'on' });
      if (!data.tokens) throw new Error('로그인 정보를 받지 못했어요.');
      setTokens(data.tokens); clearSocialFlow(); navigate(flow.from, { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : '가입하지 못했어요.'); }
    finally { setPending(false); }
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
  return <div className="account-contained"><section className="content-card">
    <h1>{result?.status === 'REGISTRATION_REQUIRED' ? '가입 마무리' : result?.status === 'REAUTHENTICATED' ? '회원 탈퇴 확인' : '소셜 로그인'}</h1>
    {failed || !flow ? <><p role="alert">인증이 취소되었거나 만료되었어요. 다시 시작해 주세요.</p><Link to="/login">로그인으로 돌아가기</Link></> : <>
      {error && <p className="account-form-error" role="alert">{error}</p>}
      {!result && !error && <p role="status">인증 결과를 확인하고 있어요…</p>}
      {!result && error && <Link to="/login">로그인으로 돌아가기</Link>}
      {result?.status === 'REGISTRATION_REQUIRED' && <form onSubmit={register}>
        <p>{socialNames[result.provider]} 인증을 완료했어요. 닉네임과 필수 약관 동의로 가입을 마쳐 주세요.</p>
        <AccountNote>이미 PICO 계정이 있다면 기존 계정으로 로그인한 뒤 프로필에서 소셜 로그인을 연결해 주세요. 새로 가입하면 기존 거래·본인인증 내역이 이어지지 않아요.</AccountNote>
        <Link to="/login" onClick={clearSocialFlow}>기존 계정으로 로그인하기</Link>
        <AccountInput name="nickname" label="닉네임" required maxLength={50} />
        <p className="prose">PICO는 이용자·도우미 모두 만 19세 이상만 이용할 수 있어요. 가입 후 거래를 시작하려면 본인인증이 필요해요.</p>
        <label className="check-row"><input type="checkbox" name="agreement_age" required /> 만 19세 이상입니다. (필수)</label>
        {(['TERMS', 'PRIVACY'] as const).map(type => <div key={type} className="check-row">
          <label><input type="checkbox" required /> {type === 'TERMS' ? '서비스 이용약관' : '개인정보 수집·이용'} 동의 (필수)</label>
          <a href={findPolicy(policies, type).url || (type === 'TERMS' ? '/terms' : '/signup-privacy')} target="_blank" rel="noreferrer">보기</a>
        </div>)}
        <p className="prose"><a href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침</a>에서 전체 처리 내용을 확인할 수 있어요.</p>
        <button className="btn primary" disabled={pending}>가입 완료</button>
      </form>}
      {result?.status === 'REAUTHENTICATED' && <>
        <p>연결한 소셜 계정을 확인했어요. 아래 버튼을 눌러야 탈퇴가 완료돼요.</p>
        <AccountNote>연락처·본인인증·정산계좌 정보는 삭제하며 거래·결제 기록은 법에 따라 보관해요. 진행 중인 거래나 미정산 금액이 있으면 탈퇴할 수 없어요. 탈퇴 후 30일간 같은 명의의 본인인증이 제한돼요(도우미 활동 정지 시 3년).</AccountNote>
        <button className="btn danger" disabled={pending} onClick={() => void withdraw()}>탈퇴 확정</button>{' '}
        <Link to="/user-profile" onClick={clearSocialFlow}>취소</Link>
      </>}
    </>}
  </section></div>;
}
