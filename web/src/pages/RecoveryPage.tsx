import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { setTokens } from '../api/tokens';
import { AccountInput, AccountNote } from '../ui/account';
import { tokenFrom } from '../ui/format';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';

// 프로토타입 recovery.js의 아이디·비밀번호 찾기.
// 명세에는 아이디 찾기 API가 없고(아이디 = 가입 이메일), 비밀번호 재설정만 있다.
// 1) POST /api/auth/password-reset/request {email} → 메일로 링크 발송(가입 여부와 관계없이 같은 응답)
// 2) 메일 링크(/reset-password?token=…) → POST /api/auth/password-reset/confirm {token, newPassword} → 모든 세션 폐기
export function RecoveryPage() {
  const navigate = useNavigate();
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const email = String(new FormData(form).get('email')).trim();
    setError('');
    setPending(true);
    try {
      await unwrap(api.POST('/api/auth/password-reset/request', { body: { email } }));
      setSent(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : '메일을 보내지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-contained recovery-page">
      <PageTitle title="아이디 · 비밀번호 찾기" crumbs={[{ label: '로그인', to: '/login' }]} />
      <section className="content-card">
        {sent ? (
          <div className="recovery-result">
            <h2>메일을 확인해 주세요</h2>
            <p className="prose">
              <strong>{sent}</strong>(으)로 가입한 계정이 있으면 비밀번호 재설정 링크를 보냈어요.
              <br />
              링크는 한 번만 쓸 수 있고, 메일이 안 보이면 스팸함도 확인해 주세요.
            </p>
            <button type="button" className="btn primary" onClick={() => navigate('/login')}>
              로그인으로
            </button>
            <button type="button" className="btn ghost" onClick={() => setSent('')}>
              다른 이메일로 다시 받기
            </button>
            <button type="button" className="btn ghost" onClick={() => navigate('/reset-password')}>
              링크가 열리지 않으면 토큰 직접 입력
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={submit}>
            <AccountNote>로그인 아이디는 가입할 때 입력한 이메일이에요. 비밀번호가 기억나지 않으면 이메일로 재설정 링크를 받아 새 비밀번호를 정해 주세요.</AccountNote>
            <AccountInput name="email" label="가입한 이메일" type="email" required maxLength={191} placeholder="name@example.com" />
            <p className="recovery-error" role="alert">
              {error}
            </p>
            <button className="btn primary full" type="submit" disabled={pending}>
              {pending ? '보내는 중…' : '재설정 링크 받기'}
            </button>
          </form>
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
