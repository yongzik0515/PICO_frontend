import { api, unwrap, ApiError } from '../api/client';
import { loadPortOne } from '../api/portone';
import { socialRequest, type SocialResult } from './social';
import { clearRegistrationDraft, readRegistrationDraft, recordRegistrationStep, saveRegistrationDraft, registrationCancelled,
  type RegistrationDraft, type RegistrationInput } from './registrationDraft';

type IdentitySession = {
  identityVerificationToken: string; identityVerificationId: string;
  storeId: string; channelKey: string; expiresAt: string;
};
export const registrationReturnPath = '/auth/registration/return';

/** Persist before opening the provider. An absent callback is not evidence that authentication failed. */
export async function startRegistrationIdentity(input: RegistrationInput, onSaved: (draft: RegistrationDraft) => void) {
  const session: Partial<IdentitySession> = input.kind === 'email'
    ? await unwrap(api.POST('/api/auth/registration/identity-session', { body: { email: input.email } }))
    : await socialRequest<IdentitySession>('/api/auth/social/identity-session', { flowSecret: input.flowSecret });
  if (!session.identityVerificationToken || !session.identityVerificationId || !session.storeId || !session.channelKey
    || !session.expiresAt || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) {
    throw new Error('본인인증을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  const draft: RegistrationDraft = { version: 1, input, identityVerificationToken: session.identityVerificationToken,
    identityVerificationId: session.identityVerificationId, expiresAt: session.expiresAt, stage: 'identity' };
  saveRegistrationDraft(draft); onSaved(draft);
  const PortOne = await loadPortOne();
  // Cancellation may have happened while the SDK script was loading.
  if (readRegistrationDraft().draft?.identityVerificationToken !== draft.identityVerificationToken) return null;
  recordRegistrationStep('identity_started');
  const result = await PortOne.requestIdentityVerification({
    storeId: session.storeId, channelKey: session.channelKey, identityVerificationId: session.identityVerificationId,
    windowType: { pc: 'POPUP', mobile: 'REDIRECTION' },
    redirectUrl: new URL(registrationReturnPath, location.origin).href,
    bypass: { inicisUnified: { flgFixedUser: 'N' } },
  });
  const current = readRegistrationDraft().draft;
  if (current?.identityVerificationToken !== draft.identityVerificationToken || current.stage !== 'identity') return null;
  recordRegistrationStep('returned', !result ? 'NO_RESPONSE' : result.code ? 'SDK_ERROR' : 'OK');
  if (result && registrationCancelled(result)) {
    clearRegistrationDraft(draft.identityVerificationToken); recordRegistrationStep('cancelled');
    throw new Error('본인인증을 취소했어요. 다시 시작할 수 있어요.');
  }
  if (!result || result.code) {
    throw new Error('인증창의 완료 응답을 확인하지 못했어요. 인증을 마쳤다면 가입 이어하기를 눌러 주세요.');
  }
  if (result.identityVerificationId !== draft.identityVerificationId) {
    recordRegistrationStep('identity_failed', 'ID_MISMATCH');
    throw new Error('인증 요청을 확인하지 못했어요. 가입 이어하기로 결과를 확인하거나 다시 시작해 주세요.');
  }
  return draft;
}

const registering = new Map<string, Promise<SocialResult | null>>();
/** Popup return and resume buttons use the same server-verified finalization, coalesced per token. */
export function finishRegistration(draft: RegistrationDraft, input: RegistrationInput, password?: string): Promise<SocialResult | null> {
  const active = registering.get(draft.identityVerificationToken);
  if (active) return active;
  const current = readRegistrationDraft().draft;
  if (!current || current.identityVerificationToken !== draft.identityVerificationToken || input.kind !== current.input.kind
    || (input.kind === 'email' && current.input.kind === 'email' && input.email !== current.input.email)
    || (input.kind === 'social' && current.input.kind === 'social' && input.flowSecret !== current.input.flowSecret)) {
    return Promise.reject(new Error('가입 인증이 만료되었거나 취소됐어요. 다시 시작해 주세요.'));
  }
  saveRegistrationDraft({ ...current, input, stage: 'registering' });
  recordRegistrationStep('register_requested');
  const request = (async () => {
    try {
      const { nickname, termsDocumentId, privacyDocumentId, adultConfirmed } = input;
      const fields = { nickname, termsDocumentId, privacyDocumentId, adultConfirmed,
        identityVerificationToken: current.identityVerificationToken };
      let result: SocialResult | null = null;
      if (input.kind === 'email') {
        await unwrap(api.POST('/api/auth/register', { body: { ...fields, email: input.email, password: password || '' } }));
      } else {
        result = await socialRequest<SocialResult>('/api/auth/social/register', { ...fields, flowSecret: input.flowSecret });
        if (!result.tokens?.accessToken || !result.tokens?.refreshToken) throw new ApiError(0, '로그인 정보를 받지 못했어요.');
      }
      clearRegistrationDraft(current.identityVerificationToken); recordRegistrationStep('register_succeeded');
      return result;
    } catch (error) {
      recordRegistrationStep('register_failed', error instanceof ApiError ? `HTTP_${error.status}` : 'HTTP_0');
      if (readRegistrationDraft().draft?.identityVerificationToken === current.identityVerificationToken) {
        saveRegistrationDraft({ ...current, input, stage: 'uncertain' });
      }
      throw error;
    } finally { registering.delete(current.identityVerificationToken); }
  })();
  registering.set(current.identityVerificationToken, request);
  return request;
}

export function registrationErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : '가입 결과를 확인하지 못했어요.';
  if (error.status === 0 || error.status >= 500) {
    return '가입 결과를 확인하지 못했어요. 먼저 로그인으로 가입 여부를 확인해 주세요. 가입되지 않았다면 가입 이어하기로 다시 시도할 수 있어요.';
  }
  if (error.status === 400) return `${error.message} 이전에 가입을 요청했다면 로그인으로 가입 여부를 확인해 주세요.`;
  return error.message;
}
