import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, unwrap } from '../api/client';
import { getTokens, onTokensChange, setTokens, type StoredTokens } from '../api/tokens';

// GET /api/me 응답 스키마가 명세에 없어(data: object) 필드가 확정될 때까지 느슨하게 둔다.
export type Me = Record<string, unknown>;

interface AuthValue {
  me: Me | null;
  loggedIn: boolean;
  /** 로그인한 계정 식별값(로그아웃이면 ''). 다른 계정으로 바뀌면 값이 달라지므로 계정별 데이터를 다시 불러올 때 쓴다. */
  userKey: string;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** 토큰의 userId로 계정을 구별한다. 같은 계정의 토큰 갱신(다른 탭 포함)은 값이 그대로다. */
const keyOf = (t: StoredTokens | null) => (t ? String(t.userId ?? '?') : '');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userKey, setUserKey] = useState(() => keyOf(getTokens()));
  // 어느 계정의 /api/me인지 함께 저장한다. 로그인한 채 다른 계정으로 로그인해도 이전 계정의 정보를 보여 주지 않는다.
  const [meState, setMeState] = useState<{ key: string; me: Me | null } | null>(null);
  const loggedIn = !!userKey;

  const reloadMe = useCallback(async () => {
    const key = keyOf(getTokens());
    if (!key) return setMeState(null);
    let me: Me | null = null;
    try {
      me = await unwrap<Me>(api.GET('/api/me'));
    } catch {
      me = null;
    }
    // 기다리는 사이 계정이 바뀌었으면 이 응답은 버린다.
    if (keyOf(getTokens()) === key) setMeState({ key, me });
  }, []);

  useEffect(() => onTokensChange((t) => setUserKey(keyOf(t))), []);
  useEffect(() => {
    if (userKey) void reloadMe();
  }, [userKey, reloadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const t = await unwrap(api.POST('/api/auth/login', { body: { email, password } }));
    setTokens({ accessToken: t.accessToken!, refreshToken: t.refreshToken!, userId: t.userId });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.POST('/api/auth/logout');
    } finally {
      setTokens(null);
    }
  }, []);

  const current = meState?.key === userKey ? meState : null;
  return (
    <AuthContext.Provider value={{ me: loggedIn ? (current?.me ?? null) : null, loggedIn, userKey, loading: loggedIn && !current, login, logout, reloadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth는 AuthProvider 안에서 사용해야 해요.');
  return value;
}
