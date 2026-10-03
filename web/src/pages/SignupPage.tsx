import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { findPolicy, usePolicies } from '../api/policies';
import { AccountInput } from '../ui/account';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';
import './signup-form.css';

// 프로토타입 account.js의 signupFields()/signupComplete() 화면 구성을 그대로 옮긴 것.
// 프로토타입 앞단의 '이용 목적 선택' 단계는 빼고, 정보 입력과 인증 화면만 쓴다.
//
// ⚠ 지금은 '겉모습만'이다. 아래 항목은 백엔드 API가 없어 화면 안에서만 동작한다.
//   - 아이디 중복확인, 전화번호 본인인증(체험 인증번호 123456), 프로필 이미지, 연락방법
//   실제로 서버에 보내는 것은 POST /api/auth/register의 email·password·nickname·약관 2종뿐이다.
//   필요한 백엔드 작업은 API_NOTES.md의 '회원가입 화면 교체' 표(S1~S7)에 정리해 두었다.
const agreementItems = [
  ['terms', 'TERMS', '서비스 이용약관', '/terms'],
  ['privacy', 'PRIVACY', '개인정보 수집·이용', '/privacy'],
  ['contact', 'PRIVACY', '요청 수락 후 연락처 제공', '/privacy'],
] as const;

const contactLabels = {
  email: '이메일',
  phone: '휴대전화',
  kakao: '카카오톡 오픈채팅',
  other: '기타',
} as const;
type ContactMethod = keyof typeof contactLabels;

const PHONE_RE = /^01[016789]-?d{3,4}-?d{4}$/; // 010-0000-0000 / 01000000000 둘 다 허용
const DEMO_CODE = '123456'; // 프로토타입과 같은 체험 인증번호. 문자는 발송되지 않는다.

export function SignupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const policies = usePolicies();

  const [error, setError] = useState('');
  const [agreementError, setAgreementError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState('');

  // 아래 네 가지는 서버에 보내지 않는다(API 없음). 화면 흐름만 위해 들고 있는 값.
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');
  const [email, setEmail] = useState('');
  // 아이디·전화번호 안내는 토스트가 아니라 각 입력란 바로 아래 텍스트로 보여 준다.
  const [idMsg, setIdMsg] = useState({ text: '', ok: false });
  const [phoneMsg, setPhoneMsg] = useState({ text: '', ok: false });

  function checkUsername() {
    const v = username.trim();
    if (!v) return setIdMsg({ text: '아이디를 먼저 입력해 주세요.', ok: false });
    setIdMsg({ text: '사용 가능한 아이디예요.', ok: true }); // 서버 조회 없이 항상 사용 가능(중복확인 API 없음)
  }

  function sendCode() {
    const v = phone.trim();
    if (!v) return setPhoneMsg({ text: '전화번호를 먼저 입력해 주세요.', ok: false });
    if (!PHONE_RE.test(v)) return setPhoneMsg({ text: '전화번호 형식을 확인해 주세요. 예) 010-0000-0000', ok: false });
    setCodeOpen(true);
    setPhoneMsg({ text: `체험 인증번호 ${DEMO_CODE}을 입력해 주세요. 문자는 발송되지 않아요.`, ok: false });
  }

  function confirmCode() {
    if (code.trim() !== DEMO_CODE) return setPhoneMsg({ text: '체험 인증번호 123456을 입력해 주세요.', ok: false });
    setCodeOpen(false);
    setPhoneMsg({ text: '본인인증 완료 · 체험', ok: true });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const agreed = [...form.querySelectorAll<HTMLInputElement>('[name^=agreement_]')].every((c) => c.checked);
    setAgreementError(agreed ? '' : '필수 약관에 모두 동의해 주세요.');
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    if (!agreed) return;

    const termsDocumentId = findPolicy(policies, 'TERMS').id;
    const privacyDocumentId = findPolicy(policies, 'PRIVACY').id;
    if (!termsDocumentId || !privacyDocumentId) return setError('약관 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');

    const data = new FormData(form);
    setError('');
    setPending(true);
    try {
      // 명세에 있는 항목만 보낸다. 아이디·전화번호·이미지·연락방법·이용 목적은 받을 API가 없다.
      await unwrap(
        api.POST('/api/auth/register', {
          body: {
            email: String(data.get('email')),
            password: String(data.get('password')),
            nickname: String(data.get('nickname')),
            termsDocumentId,
            privacyDocumentId,
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
            티켓 도우미를 찾으러 가볼까요?
          </h1>
          {/* 프로토타입 signupComplete()와 같은 버튼 2개.
              가입 API가 토큰을 주지 않아 아직 로그인 상태가 아니다.
              '도우미 찾기'는 비로그인도 볼 수 있고, '내 프로필 확인'은 로그인을 거쳐 그 화면으로 이어진다. */}
          <button type="button" className="btn primary full" onClick={() => navigate('/', { replace: true })}>
            도우미 찾기
          </button>
          <button type="button" className="btn ghost full" onClick={() => navigate('/user-profile', { replace: true })}>
            내 프로필 확인
          </button>
        </section>
      </div>
    );

  return (
    <div className="account-contained signup-compact">
      <PageTitle title="회원가입" crumbs={[{ label: '로그인', to: '/login' }]} />
      <section className="content-card">
        <form noValidate onSubmit={onSubmit}>
          {/* 아이디 + 중복확인 */}
          <div className="signup-field-action">
            <AccountInput
              name="username"
              label="아이디"
              required
              maxLength={191}
              placeholder="아이디 또는 이메일"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setIdMsg({ text: '', ok: false });
              }}
            />
            <div className="signup-inline-action">
              <button type="button" className="btn secondary" onClick={checkUsername}>
                중복확인
              </button>
            </div>
            {/* 안내 문구는 버튼 옆이 아니라 아이디 입력란 바로 아래(그리드 둘째 줄 왼쪽 칸)에 둔다. */}
            <span id="signup-id-status" className={`signup-status${idMsg.ok ? ' is-ok' : ''}`} role="status">
              {idMsg.text}
            </span>
          </div>

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

          {/* 프로필 이미지 */}
          <div className="account-image-picker">
            <span className="avatar blue">
              {image ? <img src={image.url} alt="" /> : '나'}
              <span className="avatar-spark">✦</span>
            </span>
            <div>
              <strong>
                프로필 이미지 <small className="account-required">선택</small>
              </strong>
              <p>나를 표현하는 사진을 등록해 주세요.</p>
              <div className="account-inline">
                <label className="btn secondary account-file-label">
                  {image ? '이미지 변경' : '이미지 선택'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > 3 * 1024 * 1024) return toast('이미지는 3MB까지 올릴 수 있어요.');
                      setImage({ file: f, url: URL.createObjectURL(f) });
                    }}
                  />
                </label>
                {image ? (
                  <button type="button" className="btn ghost" onClick={() => setImage(null)}>
                    삭제
                  </button>
                ) : (
                  <button type="button" className="btn ghost" onClick={() => toast('가입 후 마이페이지에서도 등록할 수 있어요.')}>
                    나중에 하기
                  </button>
                )}
              </div>
              <small>JPG · PNG · WEBP / 최대 3MB</small>
            </div>
          </div>

          <AccountInput name="nickname" label="닉네임" required maxLength={20} />
          <AccountInput name="email" label="이메일" type="email" required maxLength={191} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

          {/* 전화번호 + 본인인증 */}
          <div className="signup-field-action">
            <AccountInput
              name="phone"
              label="전화번호"
              type="tel"
              required
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneMsg({ text: '', ok: false });
              }}
            />
            <div className="signup-inline-action">
              <button type="button" className="btn secondary" onClick={sendCode}>
                전화번호 본인인증
              </button>
            </div>
            {/* 형식 오류·인증 안내 모두 전화번호 입력란 바로 아래에 텍스트로 보여 준다. */}
            <span id="signup-phone-status" className={`signup-status${phoneMsg.ok ? ' is-ok' : ''}`} role="status">
              {phoneMsg.text}
            </span>
          </div>
          {codeOpen && (
            <div id="signup-phone-code">
              <AccountInput
                name="verificationCode"
                label="체험 인증번호"
                placeholder={DEMO_CODE}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                helper="문자는 발송되지 않아요. 체험 인증번호 123456을 입력하세요."
              />
              <button type="button" className="btn secondary" onClick={confirmCode}>
                인증 확인
              </button>
            </div>
          )}

          {/* 매칭 후 연락방법 */}
          <label className="field">
            <span>
              매칭 후 연락방법 <small className="account-required">필수</small>
            </span>
            <select name="contactMethod" value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)}>
              {Object.entries(contactLabels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div id="signup-contact-value">
            {contactMethod === 'email' || contactMethod === 'phone' ? (
              <label className="field">
                <span>{contactLabels[contactMethod]}</span>
                <input readOnly value={contactMethod === 'email' ? email : phone} />
                <small>위에 입력한 정보를 그대로 사용해요.</small>
              </label>
            ) : (
              <AccountInput
                name={contactMethod}
                label={contactMethod === 'other' ? '기타 연락방법' : '카카오톡 오픈채팅 링크'}
                required
                placeholder={contactMethod === 'other' ? '연락방법과 연락처를 입력해 주세요.' : 'https://open.kakao.com/…'}
              />
            )}
          </div>

          <div className="account-agreements">
            {agreementItems.map(([key, type, t, to]) => (
              <div key={key}>
                <label className="check-row">
                  <input type="checkbox" name={`agreement_${key}`} required onChange={() => setAgreementError('')} />
                  <span>
                    {t} <small>(필수)</small>
                  </span>
                </label>
                {/* 서버가 준 약관 원문(contentUrl)이 있으면 새 창으로 연다. */}
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
