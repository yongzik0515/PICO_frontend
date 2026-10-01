import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, unwrap } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/Toast';
import { toAgent, type Agent } from './agent';

// 좋아요(찜)는 서버에 저장한다. GET /api/me/favorites, PUT·DELETE /api/me/favorites/{agentId}
interface FavoritesValue {
  /** 로그인 전이거나 아직 못 불러왔으면 빈 목록 */
  items: Agent[];
  loaded: boolean;
  has: (agentId: number) => boolean;
  toggle: (agent: Pick<Agent, 'id'> & Partial<Agent>) => Promise<void>;
  reload: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

const fetchFavorites = () =>
  unwrap<Record<string, unknown>[]>(api.GET('/api/me/favorites', { params: { query: { page: 0, size: 100 } } })).then(
    (list) => list.map(toAgent),
    () => [] as Agent[],
  );

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { userKey } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    setItems(await fetchFavorites());
    setLoaded(true);
  }, []);

  // 로그아웃하거나 다른 계정으로 로그인하면 이전 계정의 좋아요를 비우고 다시 불러온다. 늦게 온 이전 계정의 응답은 버린다.
  useEffect(() => {
    let alive = true;
    setItems([]);
    setLoaded(false);
    if (userKey)
      void fetchFavorites().then((list) => {
        if (!alive) return;
        setItems(list);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [userKey]);

  const has = useCallback((agentId: number) => items.some((a) => a.id === agentId), [items]);

  const toggle = useCallback(
    async (agent: Pick<Agent, 'id'> & Partial<Agent>) => {
      const liked = items.some((a) => a.id === agent.id);
      const before = items;
      // 누르자마자 반영하고, 실패하면 되돌린다.
      setItems(liked ? items.filter((a) => a.id !== agent.id) : [...items, { ...toAgent({}), ...agent }]);
      try {
        const params = { params: { path: { agentId: agent.id } } };
        await unwrap(liked ? api.DELETE('/api/me/favorites/{agentId}', params) : api.PUT('/api/me/favorites/{agentId}', params));
      } catch (e) {
        setItems(before);
        toast(e instanceof Error ? e.message : '좋아요를 저장하지 못했어요.');
      }
    },
    [items, toast],
  );

  return <FavoritesContext.Provider value={{ items, loaded, has, toggle, reload }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites는 FavoritesProvider 안에서 사용해야 해요.');
  return value;
}
