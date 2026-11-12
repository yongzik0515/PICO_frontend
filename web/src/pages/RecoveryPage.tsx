import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, unwrap } from '../api/client';
import { loadPortOne } from '../api/portone';
import { setTokens } from '../api/tokens';
import { AccountInput, AccountNote } from '../ui/account';
import { tokenFrom } from '../ui/format';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';

type RecoveryPurpose = 'FIND_ID' | 'RESET_PASSWORD';
type RecoverySession = { recoveryToken: string; identityVerificationId: string; purpose: RecoveryPurpose };
type RecoveryResult = { email?: string | null; providers?: string[]; passwordResetRequested?: boolean };
const RECOVERY_STORAGE = 'pico.account-recovery';

function storedRecovery(): RecoverySession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(RECOVERY_STORAGE) || 'null') as RecoverySession | null;
    return value?.recoveryToken && value.identityVerificationId && ['FIND_ID', 'RESET_PASSWORD'].includes(value.purpose) ? value : null;
  } catch { return null; }
}

export function RecoveryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState(() => {
    const saved = storedRecovery();
    if (params.get('recoveryReturn') === '1' && (params.get('code') || !saved || params.get('identityVerificationId') !== saved.identityVerificationId)) return null;
    return saved;
  });
  const [purpose, setPurpose] = useState<RecoveryPurpose>(session?.purpose ?? 'FIND_ID');
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [error, setError] = useState(params.get('recoveryReturn') === '1' && !session ? '본인인증을 완료하지 못했어요. 다시 시작해 주세요.' : '');
  const [pending, setPending] = useState(params.get('recoveryReturn') === '1' && !!session);
  const handledReturn = useRef(false);

  function clearSession() {
    sessionStorage.removeItem(RECOVERY_STORAGE);
    setSession(null);
  }

  async function complete(saved: RecoverySession) {
    setPending(true);
    setError('');
    await confirmRecovery(saved);
  }

  async function confirmRecovery(saved: RecoverySession) {
    try {
      const recovered = await unwrap(api.POST('/api/auth/recovery/identity/confirm', { body: { recoveryToken: saved.recoveryToken } }));
      setResult(recovered);
      clearSession();
    } catch (err) {
      // A mail/provider outage or rate limit can be retried without another identity verification.
      if (err instanceof ApiError && err.status === 400) clearSession();
      setError(err instanceof ApiError && err.status === 429
        ? '요청 한도를 초과했어요. 메일은 1분 간격으로 하루 10회까지 받을 수 있어요. 잠시 후 다시 시도해 주세요.'
        : err instanceof Error ? err.message : '인증 결과를 확인하지 못했어요.');
    } finally { setPending(false); }
  }

  useEffect(() => {
    if (params.get('recoveryReturn') !== '1' || handledReturn.current) return;
    handledReturn.current = true;
    const saved = storedRecovery();
    const code = params.get('code');
    const reference = params.get('identityVerificationId');
    setParams({}, { replace: true });
    if (code || !saved || reference !== saved.identityVerificationId) {
      sessionStorage.removeItem(RECOVERY_STORAGE);
      return;
    }
    void confirmRecovery(saved);
  }, [params, setParams]);

  function select(next: RecoveryPurpose) {
    clearSession();
    setPurpose(next);
    setResult(null);
    setError('');
  }

  async function start() {
    setPending(true);
    setError('');
    setResult(null);
    clearSession();
    try {
      const issued = await unwrap(api.POST('/api/auth/recovery/identity/session', { body: { purpose } }));
      if (!issued.recoveryToken || !issued.identityVerificationId) throw new Error('본인인증을 시작하지 못했어요.');
      const saved = { recoveryToken: issued.recoveryToken, identityVerificationId: issued.identityVerificationId, purpose };
      sessionStorage.setItem(RECOVERY_STORAGE, JSON.stringify(saved));
      setSession(saved);
      const PortOne = await loadPortOne();
      const response = await PortOne.requestIdentityVerification({
        storeId: issued.storeId, channelKey: issued.channelKey, identityVerificationId: issued.identityVerificationId,
        redirectUrl: `${window.location.origin}/recovery?recoveryReturn=1`,
        bypass: { inicisUnified: { flgFixedUser: 'N' } },
      });
      // Redirect mode has no popup response; keep the secret for the return page.
      if (!response) return;
      if (response.code) throw new Error(response.message || '본인인증을 취소했어요. 다시 시작해 주세요.');
      await complete(saved);
    } catch (err) {
      clearSession();
      setError(err instanceof Error ? err.message : '본인인증을 시작하지 못했어요.');
    } finally { setPending(false); }
  }

  const socialProviders = (result?.providers ?? []).filter((provider) => provider !== 'LOCAL')
    .map((provider) => ({ KAKAO: '카카오', GOOGLE: 'Google', NAVER: '네이버', APPLE: 'Apple' } as Record<string, string>)[provider] ?? provider);

  return (
    <div className="account-contained recovery-page">
      <PageTitle title="아이디 · 비밀번호 찾기" crumbs={[{ label: '로그인', to: '/login' }]} />
      <section className="content-card">
        <div className="recovery-tabs" aria-label="계정 찾기 방법">
          <button type="button" aria-pressed={purpose === 'FIND_ID'} disabled={pending} onClick={() => select('FIND_ID')}>아이디 찾기</button>
          <button type="button" aria-pressed={purpose === 'RESET_PASSWORD'} disabled={pending} onClick={() => select('RESET_PASSWORD')}>비밀번호 찾기</button>
        </div>
        {result ? (
          <div className="recovery-result" role="status">
            <h2>{result.passwordResetRequested ? '메일을 확인해 주세요' : result.email ? '아이디를 확인했어요' : socialProviders.length ? '소셜 로그인으로 가입한 계정이에요' : '일치하는 계정을 찾지 못했어요'}</h2>
            <p className="prose">
              {result.email ? <><strong>{result.email}</strong><br />{result.passwordResetRequested
                ? '비밀번호 재설정 링크를 보냈어요. 링크는 15분 동안 한 번만 사용할 수 있어요. 메일이 안 보이면 스팸함도 확인해 주세요.'
                : '가입할 때 사용한 로그인 이메일이에요.'}</> : socialProviders.length
                ? `${socialProviders.join(', ')}로 로그인해 주세요. 소셜 계정의 비밀번호는 해당 서비스에서 재설정할 수 있어요.`
                : '인증한 정보와 일치하는 이용 가능한 계정이 없어요. 가입한 계정이 있다면 고객센터에 문의해 주세요.'}
            </p>
            <button type="button" className="btn primary" onClick={() => navigate('/login')}>로그인으로</button>
            {result.email && !result.passwordResetRequested && <button type="button" className="btn ghost" onClick={() => select('RESET_PASSWORD')}>비밀번호 찾기</button>}
            <button type="button" className="btn ghost" onClick={() => select(purpose)}>다시 찾기</button>
          </div>
        ) : (
          <>
            <AccountNote>
              {purpose === 'FIND_ID'
                ? '본인인증을 완료하면 가입한 아이디(이메일)를 바로 확인할 수 있어요.'
                : '본인인증을 완료하면 가입한 이메일로 비밀번호 재설정 링크를 보내드려요.'}
              <br />
              <strong>현재 카카오 본인인증은 이용할 수 없어요.</strong> 다른 인증 수단을 이용해 주세요.
            </AccountNote>
            <p className="recovery-error" role="alert">{error}</p>
            <div className="recovery-actions">
              {session && <button type="button" className="btn primary full" disabled={pending} onClick={() => void complete(session)}>인증 결과 다시 확인</button>}
              <button type="button" className={`btn ${session ? 'ghost' : 'primary'} full`} disabled={pending} onClick={() => void start()}>
                {pending ? '확인 중…' : session ? '본인인증 다시 시작' : '본인인증하고 계속하기'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 메일 링크(/reset-password?token=…)로 오면 토큰이 주소에 있다. 링크가 열리지 않으면 직접 붙여 넣는다.
  const urlToken = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const d = new FormData(form);
    const token = urlToken || tokenFrom(String(d.get('token') ?? ''));
    if (!token) return setError('메일로 받은 재설정 토큰을 붙여 넣어 주세요.');
    const newPassword = String(d.get('newPassword'));
    if (newPassword !== d.get('confirmPassword')) return setError('비밀번호가 서로 달라요.');
    setError('');
    setPending(true);
    try {
      await unwrap(api.POST('/api/auth/password-reset/confirm', { body: { token, newPassword } }));
      setTokens(null); // 명세: 모든 로그인 세션을 폐기한다.
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호를 바꾸지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-contained recovery-page">
      <PageTitle title="비밀번호 재설정" crumbs={[{ label: '로그인', to: '/login' }]} />
      <section className="content-card">
        {done ? (
          <div className="recovery-result">
            <div className="success-circle">
              <Icon name="check" size={32} />
            </div>
            <h2>비밀번호를 변경했어요</h2>
            <p className="prose">새 비밀번호로 다시 로그인해 주세요.</p>
            <button type="button" className="btn primary" onClick={() => navigate('/login', { replace: true })}>
              로그인으로
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={submit}>
            {!urlToken && (
              <>
                <AccountNote>메일의 링크가 열리지 않으면 링크를 복사해 아래에 붙여 넣어 주세요. 링크 전체나 token= 뒤의 값을 넣으면 돼요. 토큰은 한 번만 쓸 수 있어요.</AccountNote>
                <AccountInput name="token" label="재설정 토큰" required maxLength={2000} autoComplete="off" placeholder="메일로 받은 링크 또는 토큰" />
              </>
            )}
            <AccountInput name="newPassword" label="새 비밀번호" type="password" required minLength={10} maxLength={72} autoComplete="new-password" helper="10자 이상 72자 이하로 입력해 주세요." />
            <AccountInput name="confirmPassword" label="새 비밀번호 확인" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
            <p className="recovery-error" role="alert">
              {error}
            </p>
            <button className="btn primary full" type="submit" disabled={pending}>
              {pending ? '변경 중…' : '비밀번호 변경'}
            </button>
            {!urlToken && (
              <button type="button" className="btn ghost full" onClick={() => navigate('/recovery')}>
                재설정 링크 새로 받기
              </button>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
