import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthAside, AccountInput } from '../ui/account';
import { PageTitle } from '../ui/PageTitle';
import { startSocial, useSocialProviders, type SocialProvider } from '../auth/social';

// 프로토타입 account.js의 login(). 인증은 POST /api/auth/login을 쓴다.
export function LoginPage() {
  const { login } = useAuth();
  const providers = useSocialProviders();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function social(provider: SocialProvider) {
    setPending(true); setError('');
    try { await startSocial(provider, 'LOGIN', from); }
    catch (e) { setError(e instanceof Error ? e.message : '로그인하지 못했어요.'); setPending(false); }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    // checkValidity()가 각 입력에 invalid 이벤트를 보내 필드 아래에 오류가 표시된다.
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const data = new FormData(form);
    setError('');
    setPending(true);
    try {
      await login(String(data.get('email')), String(data.get('password')));
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인하지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-auth-layout login-with-intro">
      <AuthAside />
      <div className="account-auth-main">
        <PageTitle title="로그인" />
        <section className="content-card">
          <form noValidate onSubmit={onSubmit}>
            <AccountInput name="email" label="아이디" type="email" required maxLength={191} placeholder="이메일" />
            <AccountInput name="password" label="비밀번호" type="password" required maxLength={72} placeholder="비밀번호 입력" />
            <div className="account-form-error" aria-live="polite">
              {error}
            </div>
            <div className="login-actions">
              <button className="btn primary full" type="submit" disabled={pending}>
                {pending ? '로그인 중…' : '로그인'}
              </button>
              {providers.includes('google') && <button type="button" className="btn secondary full social-google" disabled={pending} onClick={() => void social('google')}>
                <span className="google-symbol" aria-hidden="true">
                  G
                </span>
                구글로 계속하기
              </button>}
              {providers.includes('kakao') && <button type="button" className="btn secondary full social-kakao" disabled={pending} onClick={() => void social('kakao')}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 3C6.5 3 2 6.4 2 10.6c0 2.7 1.8 5 4.5 6.4L5.4 21l4.6-2.9c.7.1 1.3.1 2 .1 5.5 0 10-3.4 10-7.6S17.5 3 12 3" />
                </svg>
                카카오로 계속하기
              </button>}
            </div>
          </form>
          <div className="login-links">
            <button type="button" className="text-link" onClick={() => navigate('/recovery')}>
              아이디 · 비밀번호 찾기
            </button>
            <span aria-hidden="true">|</span>
            <button type="button" className="text-link" onClick={() => navigate('/signup')}>
              회원가입
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
