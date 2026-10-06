import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { findPolicy, usePolicies } from '../api/policies';
import { AccountInput } from '../ui/account';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';

// 프로토타입 account.js의 signup()/signupComplete() 화면 구성.
// 입력 항목은 API 명세(POST /api/auth/register: 이메일·비밀번호·닉네임·약관 문서 id)를 따른다.
// 휴대폰 본인인증과 연락방법은 API에서 가입 후 별도 단계라 이 화면에서 뺐다(API_NOTES.md 2번).
// 프로토타입의 가입 목적(이용자/도우미) 선택도 Register에 없어 뺐다. 모드는 가입 후 헤더에서 바꾸고 PATCH /api/me로 저장한다.
const agreementItems = [
  ['terms', 'TERMS', '서비스 이용약관', '/terms'],
  ['privacy', 'PRIVACY', '개인정보 수집·이용', '/signup-privacy'],
] as const;

export function SignupPage() {
  const navigate = useNavigate();
  const policies = usePolicies();
  const [error, setError] = useState('');
  const [agreementError, setAgreementError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const agreed = [...form.querySelectorAll<HTMLInputElement>('[name^=agreement_]')].every((c) => c.checked);
    setAgreementError(agreed ? '' : '만 19세 이상 확인과 필수 약관 동의를 완료해 주세요.');
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const termsDocumentId = findPolicy(policies, 'TERMS').id;
    const privacyDocumentId = findPolicy(policies, 'PRIVACY').id;
    if (!termsDocumentId || !privacyDocumentId) return setError('약관 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    const data = new FormData(form);
    setError('');
    setPending(true);
    try {
      await unwrap(
        api.POST('/api/auth/register', {
          body: {
            email: String(data.get('email')),
            password: String(data.get('password')),
            nickname: String(data.get('nickname')),
            termsDocumentId,
            privacyDocumentId,
            adultConfirmed: data.get('agreement_age') === 'on',
          },
        }),
      );
      setDone(String(data.get('nickname')));
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입하지 못했어요.');
    } finally {
      setPending(false);
    }
  }

  if (done)
    return (
      <div className="account-contained account-complete">
        <section className="content-card">
          <div className="success-circle">
            <Icon name="check" size={32} />
          </div>
          <h1>
            {done}님 반가워요.
            <br />
            로그인하고 티켓 도우미를 찾아볼까요?
          </h1>
          <button type="button" className="btn primary full" onClick={() => navigate('/login', { replace: true })}>
            로그인하기
          </button>
        </section>
      </div>
    );

  return (
    <div className="account-contained signup-compact">
      <PageTitle title="회원가입" crumbs={[{ label: '로그인', to: '/login' }]} />
      <section className="content-card">
        <form noValidate onSubmit={onSubmit}>
          <>
              {/* 길이 제한은 API 명세 Register 스키마를 따른다. */}
              <AccountInput name="email" label="이메일" type="email" required maxLength={191} placeholder="name@example.com" helper="로그인 아이디로 사용해요." />
              <AccountInput
                name="password"
                label="비밀번호"
                type="password"
                required
                minLength={10}
                maxLength={72}
                placeholder="비밀번호 설정"
                autoComplete="new-password"
                helper="10자 이상 72자 이하로 입력해 주세요."
              />
              <AccountInput name="nickname" label="닉네임" required maxLength={50} />
              <p className="prose">PICO는 이용자·도우미 모두 만 19세 이상만 이용할 수 있어요. 가입 후 거래를 시작하려면 본인인증이 필요해요.</p>
              <div className="account-agreements">
                <div>
                  <label className="check-row">
                    <input type="checkbox" name="agreement_age" required onChange={() => setAgreementError('')} />
                    <span>만 19세 이상입니다. <small>(필수)</small></span>
                  </label>
                </div>
                {agreementItems.map(([key, type, t, to]) => (
                  <div key={key}>
                    <label className="check-row">
                      <input type="checkbox" name={`agreement_${key}`} required onChange={() => setAgreementError('')} />
                      <span>
                        {t} <small>(필수)</small>
                      </span>
                    </label>
                    {/* 원문은 새 창에서 확인해 입력 중인 가입 정보를 유지한다. */}
                    {findPolicy(policies, type).url ? (
                      <a className="text-link" href={findPolicy(policies, type).url} target="_blank" rel="noreferrer">
                        보기
                      </a>
                    ) : (
                      <button type="button" className="text-link" onClick={() => navigate(to)}>
                        보기
                      </button>
                    )}
                  </div>
                ))}
                <small className="field-error" aria-live="polite">
                  {agreementError}
                </small>
              </div>
          </>
          <p className="prose"><a className="text-link" href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침</a>에서 전체 처리 내용을 확인할 수 있어요.</p>
          <div className="account-form-error" aria-live="polite">
            {error}
          </div>
          <div className="account-form-footer">
            <button className="btn primary" type="submit" disabled={pending}>
              {pending ? '가입 중…' : '가입 완료'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
