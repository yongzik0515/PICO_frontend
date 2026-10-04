import { useEffect, useState } from 'react';
import { authFetch, ApiError } from '../api/client';

export type SocialProvider = 'google' | 'kakao';
type Purpose = 'LOGIN' | 'LINK' | 'WITHDRAW';
type Flow = { flowSecret: string; purpose: Purpose; from: string };
export type SocialResult = { status: 'LOGGED_IN' | 'REGISTRATION_REQUIRED' | 'LINKED' | 'REAUTHENTICATED'; provider: SocialProvider; tokens: { accessToken: string; refreshToken: string; userId: number } | null };
const key = 'pico.socialFlow';
export const socialNames = { google: '구글', kakao: '카카오' };
export function readSocialFlow(): Flow | null {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') as Flow | null; } catch { return null; }
}
export function clearSocialFlow() { sessionStorage.removeItem(key); }
export async function socialRequest<T>(path: string, body?: unknown): Promise<T> {
  const url = new URL(`${import.meta.env.VITE_API_BASE_URL ?? ''}${path}`, location.origin);
  if (url.origin !== location.origin) throw new Error('소셜 로그인은 PICO 사이트에서 이용해 주세요.');
  const response = await authFetch(new Request(url, { method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) }));
  const result = await response.json() as { success: boolean; data: T; message?: string };
  if (!response.ok || !result.success) throw new ApiError(response.status, result.message || '소셜 인증을 완료하지 못했어요. 다시 시도해 주세요.');
  return result.data;
}
export function useSocialProviders() {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  useEffect(() => { let active = true;
    void socialRequest<SocialProvider[]>('/api/auth/social/providers').then(p => { if (active) setProviders(p); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return providers;
}
export async function startSocial(provider: SocialProvider, purpose: Purpose = 'LOGIN', from = '/', currentPassword?: string) {
  const path = purpose === 'LOGIN' ? `/api/auth/social/${provider}/start`
    : `/api/me/social/${provider}/${purpose === 'LINK' ? 'link' : 'withdraw'}/start`;
  const result = await socialRequest<{ flowSecret: string; authorizationUrl: string }>(path, { currentPassword });
  // Only relative, same-origin app routes are retained. Secrets never go in URLs.
  sessionStorage.setItem(key, JSON.stringify({ flowSecret: result.flowSecret, purpose, from: (from.startsWith('/') && !from.startsWith('//') && !from.includes('\\')) ? from : '/' }));
  const url = new URL(result.authorizationUrl, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/auth/social/authorize/')) throw new Error('로그인 주소가 올바르지 않아요.');
  location.assign(url.href);
}
// React StrictMode must not exchange a one-use login result twice.
const completing = new Map<string, Promise<SocialResult>>();
export function completeSocial(flow: Flow) {
  let request = completing.get(flow.flowSecret);
  if (!request) {
    const path = flow.purpose === 'LOGIN' ? '/api/auth/social/complete' : '/api/me/social/complete';
    request = socialRequest<SocialResult>(path, { flowSecret: flow.flowSecret });
    completing.set(flow.flowSecret, request);
    void request.finally(() => setTimeout(() => completing.delete(flow.flowSecret), 10_000)).catch(() => undefined);
  }
  return request;
}
