import { api, unwrap } from '../api/client';
import { loadPortOne } from '../api/portone';
import { socialRequest } from './social';

type IdentitySession = {
  identityVerificationToken: string;
  identityVerificationId: string;
  storeId: string;
  channelKey: string;
  expiresAt: string;
};

/** 회원을 생성하기 전에 서버가 발급한 가입 전용 세션으로 본인인증한다. */
export async function verifyRegistrationIdentity(context: { email: string } | { flowSecret: string }): Promise<string> {
  const session: Partial<IdentitySession> = 'email' in context
    ? await unwrap(api.POST('/api/auth/registration/identity-session', { body: context }))
    : await socialRequest<IdentitySession>('/api/auth/social/identity-session', context);
  if (!session.identityVerificationToken || !session.identityVerificationId || !session.storeId || !session.channelKey) {
    throw new Error('본인인증을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  const PortOne = await loadPortOne();
  const result = await PortOne.requestIdentityVerification({
    storeId: session.storeId, channelKey: session.channelKey, identityVerificationId: session.identityVerificationId,
    windowType: { pc: 'POPUP', mobile: 'POPUP' },
    bypass: { inicisUnified: { flgFixedUser: 'N' } },
  });
  if (!result || result.code || result.identityVerificationId !== session.identityVerificationId) {
    throw new Error(result?.message || '본인인증을 완료하지 못했어요. 다시 인증해 주세요.');
  }
  return session.identityVerificationToken;
}
