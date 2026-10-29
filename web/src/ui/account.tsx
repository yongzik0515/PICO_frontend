import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

// 프로토타입 account.js의 authAside()/input() 마크업

export function AuthAside() {
  return (
    <aside className="account-auth-aside">
      <div className="account-ticket">
        <Icon name="ticket" size={42} />
        <span>
          설레는 순간을 준비하는
          <br />
          가장 든든한 연결
        </span>
        <i></i>
        <p>
          나에게 맞는 도우미를 만나고,
          <br />
          내 활동에서 진행 상황을 확인하세요.
        </p>
      </div>
      <div className="login-ticket-art" aria-hidden="true">
        <span className="login-ticket-back"></span>
        <span className="login-ticket-front">
          <Icon name="ticket" size={30} />
          <strong>설렘을 위한 한 자리</strong>
          <i></i>
          <small>YOUR NEXT STAGE</small>
        </span>
        <b>✦</b>
      </div>
      <div className="account-auth-points">
        <p>
          <Icon name="user" size={18} />
          프로필을 보고 직접 요청
        </p>
        <p>
          <Icon name="check" size={18} />
          최종 조건을 확인하고 매칭 완료
        </p>
        <p>
          <Icon name="shield" size={18} />
          비용은 당사자끼리 직접 거래
        </p>
      </div>
    </aside>
  );
}

// 필수 항목이 비었거나 형식이 틀리면 포커스를 벗어날 때 필드 아래에 오류를 보여 준다(프로토타입 bindCommon).
export function AccountInput({
  name,
  label,
  helper,
  required = false,
  ...rest
}: { name: string; label: string; helper?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [error, setError] = useState('');
  const check = (input: HTMLInputElement) => {
    const invalid = (required && !input.value.trim()) || !input.checkValidity();
    input.setAttribute('aria-invalid', String(invalid));
    const v = input.validity;
    setError(
      !invalid
        ? ''
        : v.valueMissing
          ? '필수 항목을 입력해 주세요.'
          : v.tooShort
            ? `${input.minLength}자 이상 입력해 주세요.`
            : v.tooLong
              ? `${input.maxLength}자 이하로 입력해 주세요.`
              : input.type === 'email'
                ? '이메일 주소를 확인해 주세요.'
                : '입력 내용을 확인해 주세요.',
    );
  };
  return (
    <label className="field">
      <span>
        {label} <small className="account-required">{required ? '필수' : '선택'}</small>
      </span>
      <input
        name={name}
        required={required}
        autoComplete={rest.type === 'email' ? 'email' : rest.type === 'password' ? 'current-password' : undefined}
        {...rest}
        onBlur={(e) => check(e.currentTarget)}
        onInvalid={(e) => check(e.currentTarget)}
      />
      {helper && <small className="field-helper">{helper}</small>}
      <small className="field-error" aria-live="polite">
        {error}
      </small>
    </label>
  );
}

export function AccountNote({ children, kind = '' }: { children: React.ReactNode; kind?: string }) {
  return (
    <div className={`notice account-note ${kind}`}>
      <Icon name={kind === 'success' ? 'check' : 'info'} size={18} />
      <span>{children}</span>
    </div>
  );
}

// 프로토타입 account.js의 card()
export function AccountCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="content-card account-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

// 프로토타입 account.js의 verificationCard(). children에 확인 버튼을 넣는다.
export function Verification({ title, text, done, doneText, children }: { title: string; text: string; done: boolean; doneText?: string; children?: ReactNode }) {
  return (
    <div className={`account-verification ${done ? 'complete' : 'none'}`}>
      <span className="account-verification-icon">
        <Icon name={title.includes('계좌') ? 'ticket' : 'shield'} size={21} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
        <span className={`badge ${done ? 'verified' : 'neutral'}`}>
          {done && <Icon name="check" size={12} />}
          {done ? doneText || '확인 완료' : '미완료'}
        </span>
      </div>
      {children}
    </div>
  );
}

