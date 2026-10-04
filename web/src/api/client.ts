import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { getTokens, setTokens } from './tokens';

// 개발 중에는 Vite 프록시(/api → API_PROXY_TARGET)를 쓰므로 기본값은 같은 출처.
// 배포·앱 빌드에서는 VITE_API_BASE_URL에 백엔드 주소를 넣는다.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

/** 공통 응답 {success:false, message} 또는 네트워크 오류를 담는 에러 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 로그인 없이 쓰는 인증 API: 저장된 토큰을 붙이지 않는다(만료·무효 토큰이 붙으면 서버가 401로 막는다).
const NO_REFRESH = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/register',
  '/api/auth/password-reset/request',
  '/api/auth/password-reset/confirm',
  '/api/auth/email-verification/confirm',
];
let refreshing: Promise<boolean> | null = null;

/**
 * 401을 받은 요청을 다시 보낼 수 있으면 true. sent는 그 요청에 붙였던 accessToken이다.
 * - 이 탭에서는 동시에 여러 요청이 401을 받아도 refresh를 한 번만 부른다(이전 refreshToken은 재사용 불가).
 * - 요청을 보낸 뒤 다른 요청이나 다른 탭이 이미 토큰을 바꿨으면 refresh 없이 새 토큰으로 다시 보낸다.
 * - refresh가 거절돼도 그사이 다른 탭이 같은 refreshToken으로 먼저 갱신했을 수 있어, 저장된 토큰을 다시 읽고 바뀌었으면 그것을 쓴다.
 *   그대로일 때만 로그아웃한다.
 */
async function refreshTokens(sent: string | undefined): Promise<boolean> {
  const current = getTokens();
  if (!current?.refreshToken) return false;
  if (current.accessToken !== sent) return true;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success || !body.data?.accessToken) {
        const stored = getTokens();
        if (stored?.refreshToken && stored.refreshToken !== current.refreshToken) return true; // 다른 탭이 먼저 갱신함
        if (stored) setTokens(null);
        return false;
      }
      setTokens({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken, userId: body.data.userId });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function withAuth(request: Request, token: string | undefined): Request {
  const next = new Request(request);
  if (token) next.headers.set('Authorization', `Bearer ${token}`);
  return next;
}

export async function authFetch(input: Request): Promise<Response> {
  const path = new URL(input.url, location.origin).pathname;
  // 로그인·가입·갱신에는 저장된 토큰을 붙이지 않는다. 만료·무효 토큰이 남아 있으면 서버가 401로 막는다.
  if (path.startsWith('/api/auth/social/') || NO_REFRESH.some((p) => path.endsWith(p))) return fetch(input); // API 주소에 경로 접두어가 있어도 맞게
  const retry = input.clone();
  const sent = getTokens()?.accessToken;
  const response = await fetch(withAuth(input, sent));
  if (response.status !== 401) return response;
  return (await refreshTokens(sent)) ? fetch(withAuth(retry, getTokens()?.accessToken)) : response;
}

export const api = createClient<paths>({ baseUrl, fetch: authFetch });

type Envelope<T> = { success?: boolean; data?: T; message?: string };

/**
 * openapi-fetch 결과에서 data를 꺼낸다. 실패하면 서버 message로 ApiError를 던진다.
 * 사용: const tokens = await unwrap(api.POST('/api/auth/login', { body }));
 */
export async function unwrap<T>(
  call: Promise<{ data?: Envelope<T>; error?: unknown; response: Response }>,
): Promise<T> {
  let result;
  try {
    result = await call;
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없어요. 네트워크 상태를 확인해 주세요.');
  }
  const { data, error, response } = result;
  if (error || !data?.success) {
    const message = (error as Envelope<unknown> | undefined)?.message ?? data?.message;
    throw new ApiError(response.status, message || fallbackMessage(response.status));
  }
  return data.data as T;
}

function fallbackMessage(status: number) {
  if (status === 401) return '로그인이 필요해요.';
  if (status === 403) return '접근 권한이 없어요.';
  if (status === 429) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (status === 501) return '아직 준비 중인 기능이에요.';
  // 개발 중 Vite 프록시가 백엔드(API_PROXY_TARGET)에 붙지 못하면 502·504를 돌려준다.
  if (status === 502 || status === 504) return '서버에 연결할 수 없어요. 백엔드 주소와 실행 상태를 확인해 주세요.';
  if (status === 503) return '연동 서비스가 준비되지 않아 지금은 이용할 수 없어요.';
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
