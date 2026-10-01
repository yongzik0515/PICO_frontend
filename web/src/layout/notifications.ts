import { useEffect, useSyncExternalStore } from 'react';
import { api, unwrap } from '../api/client';
import type { components } from '../api/schema';
import { useAuth } from '../auth/AuthContext';

// 알림: GET /api/notifications, 개별 조회 시 자동 읽음(GET /api/notifications/{id}), PATCH /api/notifications/read-all
export type Notification = components['schemas']['NotificationResponse'];

const POLL_MS = 30_000;
/** 창으로 돌아올 때 focus와 visibilitychange가 함께 와도 한 번만 요청한다. */
const MERGE_MS = 1_000;

// 헤더(AppLayout)와 알림 화면이 같은 목록을 쓰도록 모듈 하나에서 상태·폴링을 공유한다.
let items: Notification[] = [];
const listeners = new Set<() => void>();
/** 계정이 바뀌면(로그아웃 포함) 늘린다. 늦게 도착한 이전 계정의 응답은 버린다. */
let generation = 0;
let inFlight: Promise<void> | null = null;
let lastFetch = 0;
/** 읽음 처리처럼 로컬에서 목록을 바꾸면 늘린다. 그 전에 시작된 응답은 낡은 값이라 버리고 다시 받는다. */
let mutations = 0;
let pollers = 0;
let timer: number | undefined;

function emit(next: Notification[]) {
  items = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function load(force = false): Promise<void> {
  // 강제 새로고침(읽음 처리 뒤 등)은 이미 가고 있는 요청이 끝난 뒤 한 번 더 받는다(그 요청은 변경 전 값일 수 있다).
  if (inFlight) return force ? inFlight.then(() => load(true)) : inFlight;
  if (!force && Date.now() - lastFetch < MERGE_MS) return Promise.resolve();
  const gen = generation;
  const seen = mutations;
  let stale = false;
  inFlight = unwrap<Notification[]>(api.GET('/api/notifications', { params: { query: { page: 0, size: 50 } } }))
    .then(
      (list) => {
        if (gen !== generation || !Array.isArray(list)) return;
        if (seen !== mutations) stale = true; // 요청 중에 읽음 처리가 있었다: 덮어쓰지 않고 다시 받는다
        else emit(list);
      },
      () => undefined,
    )
    .finally(() => {
      inFlight = null;
      lastFetch = Date.now();
    })
    .then(() => (stale ? load(true) : undefined));
  return inFlight;
}

function reset() {
  generation++;
  inFlight = null;
  if (items.length) emit([]);
}

function refresh() {
  if (document.visibilityState === 'visible') void load(); // 숨겨진 탭에서는 요청하지 않는다
}

function startPolling() {
  if (++pollers === 1) {
    timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
  }
  return () => {
    if (--pollers === 0) {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    }
  };
}

/** 지금 목록이 어느 계정의 것인지. 로그아웃이나 다른 계정 로그인으로 바뀌면 목록을 비우고 늦게 온 응답도 버린다. */
let owner = '';

/** 로그인한 동안 화면을 옮길 때(key가 바뀔 때), 창으로 돌아올 때, 화면이 보이는 동안 30초마다 새로 받는다. */
export function useNotifications(key: string) {
  const { loggedIn, userKey } = useAuth();
  const current = useSyncExternalStore(subscribe, () => items);
  useEffect(() => {
    if (owner !== userKey) {
      owner = userKey;
      reset();
    }
    if (userKey) void load(true);
  }, [userKey, key]);
  useEffect(() => (loggedIn ? startPolling() : undefined), [loggedIn]);

  async function open(n: Notification) {
    mutations++;
    emit(items.map((x) => (x.notificationId === n.notificationId ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)));
    await unwrap(api.GET('/api/notifications/{notificationId}', { params: { path: { notificationId: n.notificationId } } })).catch(() => null);
    mutations++;
  }
  async function readAll() {
    mutations++;
    emit(items.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    await unwrap(api.PATCH('/api/notifications/read-all')).catch(() => null);
    mutations++;
    await load(true);
  }
  const reload = () => load(true);
  return { items: current, unread: current.filter((n) => !n.readAt).length, open, readAll, reload };
}
