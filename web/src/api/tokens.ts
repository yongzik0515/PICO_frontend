// 토큰 저장소. 앱(Capacitor) 확장 시 이 파일만 Preferences/SecureStorage로 교체한다.
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  userId?: number;
}

const KEY = 'pico.auth';
type Listener = (tokens: StoredTokens | null) => void;
const listeners = new Set<Listener>();

export function getTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: StoredTokens | null) {
  try {
    if (tokens) localStorage.setItem(KEY, JSON.stringify(tokens));
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 불가(사생활 보호 모드 등) 시 현재 탭에서만 유지된다.
  }
  listeners.forEach((fn) => fn(tokens));
}

export function onTokensChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// 다른 탭에서 로그인·로그아웃·토큰 갱신을 하면 이 탭에도 알린다(storage 이벤트는 다른 탭의 변경에만 온다).
// 같은 계정의 토큰 갱신이면 받는 쪽(AuthContext)이 계정 번호로 구별해 아무것도 하지 않는다.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return; // null: 다른 탭에서 localStorage.clear()
    const tokens = getTokens();
    listeners.forEach((fn) => fn(tokens));
  });
