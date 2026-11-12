import { useEffect, useState } from 'react';
import { clearRegistrationDraft, readRegistrationDraft, recordRegistrationStep, type RegistrationDraft } from './registrationDraft';

export function useRegistrationDraft(kind: 'email' | 'social', returnNotice = '') {
  const [initial] = useState(readRegistrationDraft);
  const [draft, setDraft] = useState<RegistrationDraft | null>(initial.draft?.input.kind === kind ? initial.draft : null);
  const [notice, setNotice] = useState(initial.notice || returnNotice);
  useEffect(() => {
    if (!draft) return;
    const expire = () => {
      if (Date.parse(draft.expiresAt) > Date.now()) return;
      clearRegistrationDraft(draft.identityVerificationToken);
      recordRegistrationStep('expired', 'SESSION_EXPIRED');
      setDraft(null); setNotice('가입 인증 시간이 만료됐어요. 본인인증부터 다시 시작해 주세요.');
    };
    const timer = setTimeout(expire, Math.max(0, Date.parse(draft.expiresAt) - Date.now()));
    window.addEventListener('pageshow', expire);
    return () => { clearTimeout(timer); window.removeEventListener('pageshow', expire); };
  }, [draft]);
  function cancel() {
    if (draft) clearRegistrationDraft(draft.identityVerificationToken);
    recordRegistrationStep('cancelled'); setDraft(null); setNotice('가입 진행을 취소했어요. 다시 시작할 수 있어요.');
  }
  return { draft, setDraft, notice, setNotice, cancel };
}
