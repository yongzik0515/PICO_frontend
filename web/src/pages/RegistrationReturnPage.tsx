import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearRegistrationDraft, readRegistrationDraft, recordRegistrationStep, registrationCancelled } from '../auth/registrationDraft';

/** URL parameters are navigation hints only. The register API alone decides identity validity. */
export function RegistrationReturnPage() {
  const navigate = useNavigate();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(location.search);
    const { draft, notice } = readRegistrationDraft();
    const mismatch = draft && params.has('identityVerificationId')
      && params.get('identityVerificationId') !== draft.identityVerificationId;
    const cancelled = !mismatch && registrationCancelled({ code: params.get('code'), message: params.get('message') });
    if (cancelled && draft) { clearRegistrationDraft(draft.identityVerificationToken); recordRegistrationStep('cancelled'); }
    recordRegistrationStep('returned', mismatch ? 'ID_MISMATCH' : params.has('code') ? 'SDK_ERROR' : 'OK');
    const message = notice || (cancelled ? '본인인증을 취소했어요. 다시 시작할 수 있어요.'
      : !draft ? '이 탭에 남아 있는 가입 정보가 없어요. 가입을 다시 시작해 주세요.'
      : mismatch || params.has('code') ? '인증 결과를 확인하지 못했어요. 인증을 마쳤다면 가입 이어하기를 눌러 주세요.'
      : draft.input.kind === 'email' ? '가입을 이어갈 수 있어요. 비밀번호를 다시 입력하고 가입 이어하기를 눌러 주세요.'
      : '가입 이어하기를 눌러 본인인증 결과를 확인하고 가입을 마쳐 주세요.');
    // Replace the callback entry, dropping all provider parameters (including unknown ones).
    navigate(draft?.input.kind === 'social' ? '/auth/social/callback' : '/signup',
      { replace: true, state: { registrationNotice: message } });
  }, [navigate]);
  return <div className="account-contained"><section className="content-card">
    <p role="status">가입 화면으로 돌아가고 있어요…</p>
    <Link className="text-link" to="/signup">회원가입으로 돌아가기</Link>
  </section></div>;
}
