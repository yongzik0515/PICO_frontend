import { api, unwrap } from '../api/client';

export type PopularKeyword = { rank: number; keyword: string; category: string };
export type PopularSearch = { date: string | null; updatedAt: string | null; items: PopularKeyword[] };
let volatileBrowserId: string | null = null;

function browserId(): string {
  const key = 'pico.search.browser';
  try {
    const stored = localStorage.getItem(key);
    if (stored && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(stored)) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    volatileBrowserId ??= crypto.randomUUID();
    return volatileBrowserId;
  }
}

export async function loadPopularSearch(signal?: AbortSignal): Promise<PopularSearch> {
  const result = await unwrap<{
    date?: string; updatedAt?: string; items?: Partial<PopularKeyword>[];
  }>(api.GET('/api/search/popular', { signal }));
  return {
    date: result.date ?? null, updatedAt: result.updatedAt ?? null,
    items: (result.items ?? []).filter((item): item is PopularKeyword =>
      typeof item.rank === 'number' && typeof item.keyword === 'string' && !!item.keyword.trim()
      && ['PERFORMANCE', 'AGENT', 'PLATFORM'].includes(item.category ?? ''),
    ).slice(0, 3),
  };
}

/** Recording is best-effort and must never change or block the actual helper search. */
export async function recordSearch(query: string): Promise<void> {
  const text = query.trim();
  if (!text || (text.length === 1 && !/[가-힣]/.test(text)) || text.length > 80) return;
  try {
    await unwrap(api.POST('/api/search/events', { body: { query: text, browserId: browserId() } }));
  } catch { /* Offline, feature disabled or old backend: search still works normally. */ }
}
