import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { finishRegistration, registrationErrorMessage, startRegistrationIdentity } from '../auth/registrationIdentity';
import { readRegistrationDraft, type RegistrationDraft, type RegistrationInput } from '../auth/registrationDraft';
import { useRegistrationDraft } from '../auth/useRegistrationDraft';
import { findPolicy, usePolicies } from '../api/policies';
import { AccountInput, AccountNote } from '../ui/account';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';

// 프로토타입 account.js의 signup()/signupComplete() 화면 구성.
// 입력 항목은 API 명세(POST /api/auth/register: 이메일·비밀번호·닉네임·약관 문서 id)를 따른다.
// 가입 전 본인인증 결과를 서버가 검증한 뒤 회원을 생성한다. 연락방법은 가입 후 등록한다.
// 프로토타입의 가입 목적(이용자/도우미) 선택도 Register에 없어 뺐다. 모드는 가입 후 헤더에서 바꾸고 PATCH /api/me로 저장한다.
const agreementItems = [
  ['terms', 'TERMS', '서비스 이용약관', '/terms'],
  ['privacy', 'PRIVACY', '개인정보 수집·이용', '/signup-privacy'],
] as const;

export function SignupPage() {
  const navigate = useNavigate();
  const policies = usePolicies();
  const location = useLocation();
  const { draft, setDraft, notice, setNotice, cancel } = useRegistrationDraft('email', typeof location.state?.registrationNotice === 'string' ? location.state.registrationNotice : '');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const openingRef = useRef(false);
  const [agreementError, setAgreementError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState('');

  function inputFrom(form: HTMLFormElement): RegistrationInput | null {
    const agreed = [...form.querySelectorAll<HTMLInputElement>('[name^=agreement_]')].every(c => c.checked);
    setAgreementError(agreed ? '' : '만 19세 이상 확인과 필수 약관 동의를 완료해 주세요.');
    if (!form.reportValidity() || !agreed) return null;
    const termsDocumentId = findPolicy(policies, 'TERMS').id;
    const privacyDocumentId = findPolicy(policies, 'PRIVACY').id;
    if (!termsDocumentId || !privacyDocumentId) { setError('약관 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); return null; }
    const data = new FormData(form);
    return { kind: 'email', email: String(data.get('email')).trim().toLowerCase(),
      nickname: String(data.get('nickname')).trim(), termsDocumentId, privacyDocumentId, adultConfirmed: true };
  }

  async function complete(form: HTMLFormElement, saved: RegistrationDraft) {
    if (active.current) return;
    const input = inputFrom(form);
    if (!input) return;
    active.current = true; setPending(true); setError(''); setNotice('');
    try {
      // Re-read the password from the current form; never retain it across navigation.
      await finishRegistration(saved, input, String(new FormData(form).get('password')));
      setDraft(null); setDone(input.nickname);
    } catch (err) { setError(registrationErrorMessage(err)); }
    finally { active.current = false; setPending(false); }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (active.current) return;
    const form = e.currentTarget;
    const saved = readRegistrationDraft().draft;
    if (saved?.input.kind === 'email') return complete(form, saved);
    if (openingRef.current) return;
    const input = inputFrom(form);
    if (!input) return;
    const attempt = ++generation.current;
    openingRef.current = true; setOpening(true); setError(''); setNotice('');
    try {
      const verified = await startRegistrationIdentity(input, setDraft);
      if (verified && generation.current === attempt) await complete(form, verified);
    } catch (err) {
      if (generation.current === attempt) { setDraft(readRegistrationDraft().draft); setError(registrationErrorMessage(err)); }
    }
    finally {
      if (generation.current === attempt) { openingRef.current = false; setOpening(false); }
    }
  }

  function cancelRegistration() {
    generation.current++; openingRef.current = false; setOpening(false); setError(''); cancel();
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

  if (policies === null) return <div className="account-contained"><p role="status">가입 정보를 불러오고 있어요…</p></div>;
  const restored = draft?.input.kind === 'email' ? draft.input : null;
  return (
    <div className="account-contained signup-compact">
      <PageTitle title="회원가입" crumbs={[{ label: '로그인', to: '/login' }]} />
      <section className="content-card">
        <form noValidate onSubmit={onSubmit} aria-busy={pending}>
          {draft && <AccountNote><strong>진행 중인 가입이 있어요.</strong> 본인인증을 마쳤다면 인증창을 다시 열지 않고 가입 이어하기를 눌러 주세요. 새로고침했다면 비밀번호를 다시 입력해 주세요.</AccountNote>}
          {notice && <p className="prose" role="status">{notice}</p>}
          <>
              {/* 길이 제한은 API 명세 Register 스키마를 따른다. */}
              <AccountInput name="email" defaultValue={restored?.email} readOnly={!!draft} label="이메일" type="email" required maxLength={191} placeholder="name@example.com" helper="로그인 아이디로 사용해요." />
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
              <AccountInput name="nickname" defaultValue={restored?.nickname} label="닉네임" required maxLength={50} />
              <p className="prose">PICO는 만 19세 이상만 가입할 수 있어요. 본인인증을 마쳐야 가입이 완료되며, 한 사람당 하나의 계정만 만들 수 있어요.</p>
              <div className="account-agreements">
                <div>
                  <label className="check-row">
                    <input type="checkbox" name="agreement_age" defaultChecked={restored?.adultConfirmed} required onChange={() => setAgreementError('')} />
                    <span>만 19세 이상입니다. <small>(필수)</small></span>
                  </label>
                </div>
                {agreementItems.map(([key, type, t, to]) => (
                  <div key={key}>
                    <label className="check-row">
                      <input type="checkbox" name={`agreement_${key}`} defaultChecked={!!restored && (type === 'TERMS' ? restored.termsDocumentId : restored.privacyDocumentId) === findPolicy(policies, type).id} required onChange={() => setAgreementError('')} />
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
          <p className="prose">이미 가입하셨나요? <a className="text-link" href="/login">기존 계정으로 로그인하기</a></p>
          <AccountNote><strong>현재 카카오 본인인증은 이용할 수 없어요.</strong> 다른 인증 수단을 이용해 주세요.</AccountNote>
          <div className="account-form-footer">
            <button className="btn primary" type="submit" disabled={pending || (opening && !draft)}>
              {pending ? '가입 확인 중…' : draft ? '가입 이어하기' : opening ? '인증창 여는 중…' : '본인인증하고 가입하기'}
            </button>
          </div>
          {draft && <button type="button" className="text-link" disabled={pending} onClick={cancelRegistration}>가입 진행 취소하고 다시 시작</button>}
        </form>
      </section>
    </div>
  );
}
