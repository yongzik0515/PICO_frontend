// Same-tab recovery only. Passwords and provider identity data never enter this store.
export type RegistrationInput = {
  nickname: string; termsDocumentId: number; privacyDocumentId: number; adultConfirmed: boolean;
  returnTo?: '/request/start';
} & ({ kind: 'email'; email: string } | { kind: 'social'; flowSecret: string });
export type RegistrationDraft = {
  version: 1; input: RegistrationInput; identityVerificationToken: string;
  identityVerificationId: string; expiresAt: string; stage: 'identity' | 'registering' | 'uncertain';
};
export const registrationKey = 'pico.registration.v1';
const eventsKey = 'pico.registration.events';
export function registrationCancelled(result: { code?: string | null; message?: string | null }) {
  // PortOne SDK's explicit user-cancel response; absence of a callback is deliberately different.
  return result.code === 'Cancelled' || result.message === '사용자가 본인인증을 취소하였습니다.';
}
export type RegistrationStep = 'identity_started' | 'returned' | 'register_requested' | 'register_succeeded'
  | 'register_failed' | 'identity_failed' | 'cancelled' | 'expired';

export function recordRegistrationStep(step: RegistrationStep, code = 'OK') {
  // Only our fixed diagnostic codes or an HTTP status, never provider messages or request payloads.
  const safeCode = /^(OK|SDK_ERROR|NO_RESPONSE|ID_MISMATCH|STORAGE_UNAVAILABLE|INVALID_DRAFT|SESSION_EXPIRED|HTTP_[0-9]{1,3})$/.test(code) ? code : 'SDK_ERROR';
  const event = { at: new Date().toISOString(), step, code: safeCode };
  console.info('[registration]', event);
  try {
    const previous = JSON.parse(sessionStorage.getItem(eventsKey) || '[]');
    // Rebuild each entry so modified storage cannot inject private fields into diagnostic exports.
    const events = Array.isArray(previous) ? previous.slice(-19).map(e => ({ at: e.at, step: e.step, code: e.code })) : [];
    sessionStorage.setItem(eventsKey, JSON.stringify([...events, event]));
  } catch { /* Diagnostics must not interrupt registration. */ }
}

export function clearRegistrationDraft(token?: string) {
  try {
    if (token) {
      const current = JSON.parse(sessionStorage.getItem(registrationKey) || 'null');
      if (current?.identityVerificationToken !== token) return;
    }
    sessionStorage.removeItem(registrationKey);
  } catch { /* Storage may become unavailable after a navigation. */ }
}

export function readRegistrationDraft(): { draft: RegistrationDraft | null; notice: string } {
  try {
    const draft = JSON.parse(sessionStorage.getItem(registrationKey) || 'null') as RegistrationDraft | null;
    if (!draft) return { draft: null, notice: '' };
    const input = draft.input;
    if (draft.version !== 1 || !input || !['email', 'social'].includes(input.kind)
      || (input.returnTo !== undefined && input.returnTo !== '/request/start')
      || typeof input.nickname !== 'string' || input.nickname.length > 50
      || !Number.isSafeInteger(input.termsDocumentId) || input.termsDocumentId <= 0
      || !Number.isSafeInteger(input.privacyDocumentId) || input.privacyDocumentId <= 0
      || input.adultConfirmed !== true || typeof draft.identityVerificationToken !== 'string'
      || !draft.identityVerificationToken || typeof draft.identityVerificationId !== 'string' || !draft.identityVerificationId
      || !['identity', 'registering', 'uncertain'].includes(draft.stage)
      || !Number.isFinite(Date.parse(draft.expiresAt))
      || (input.kind === 'email' ? typeof input.email !== 'string' : typeof input.flowSecret !== 'string')) {
      clearRegistrationDraft();
      return { draft: null, notice: '저장된 가입 정보를 확인할 수 없어요. 본인인증부터 다시 시작해 주세요.' };
    }
    if (Date.parse(draft.expiresAt) <= Date.now()) {
      clearRegistrationDraft(); recordRegistrationStep('expired', 'SESSION_EXPIRED');
      return { draft: null, notice: '가입 인증 시간이 만료됐어요. 본인인증부터 다시 시작해 주세요.' };
    }
    return { draft, notice: draft.stage === 'identity' ? ''
      : '이전 가입 요청의 결과를 확인하지 못했어요. 먼저 로그인으로 가입 여부를 확인해 주세요.' };
  } catch {
    clearRegistrationDraft();
    return { draft: null, notice: '임시 가입 정보를 읽지 못했어요. 브라우저의 사이트 저장 허용을 확인해 주세요.' };
  }
}

export function saveRegistrationDraft(draft: RegistrationDraft) {
  const input = draft.input;
  // Explicit allowlist: even an accidental password property passed by a caller is never serialized.
  const safeInput: RegistrationInput = { nickname: input.nickname, termsDocumentId: input.termsDocumentId,
    privacyDocumentId: input.privacyDocumentId, adultConfirmed: input.adultConfirmed,
    ...(input.returnTo === '/request/start' ? { returnTo: input.returnTo } : {}),
    ...(input.kind === 'email' ? { kind: 'email', email: input.email } : { kind: 'social', flowSecret: input.flowSecret }) };
  try {
    sessionStorage.setItem(registrationKey, JSON.stringify({ version: 1, input: safeInput,
      identityVerificationToken: draft.identityVerificationToken, identityVerificationId: draft.identityVerificationId,
      expiresAt: draft.expiresAt, stage: draft.stage }));
  } catch {
    recordRegistrationStep('identity_failed', 'STORAGE_UNAVAILABLE');
    throw new Error('가입을 이어가려면 브라우저의 사이트 저장을 허용해 주세요.');
  }
}
