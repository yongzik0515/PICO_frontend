import { api, authFetch, unwrap } from '../api/client';
import { getTokens } from '../api/tokens';
import type { Platform } from '../discovery/agent';
import type { PerformanceDetail } from './banners';

export type PerformanceCandidate = { kopisId: string; name: string; venueName?: string; startsOn?: string; endsOn?: string };
type PerformanceResults = { items?: PerformanceCandidate[] };

export async function findPerformances(query: string, signal: AbortSignal, useAi = true) {
  const direct = await unwrap<PerformanceResults>(api.GET('/api/performances', {
    params: { query: { keyword: query, size: 20 } }, signal,
  }));
  if (direct.items?.length || !useAi || !getTokens()?.accessToken || signal.aborted) return direct.items ?? [];

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const url = new URL(`${baseUrl}/api/ai/performances/search`, location.origin);
  const response = await authFetch(new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }), signal,
  }));
  if (!response.ok) return [];
  const body: { success?: boolean; data?: PerformanceResults } = await response.json();
  return body.success ? body.data?.items ?? [] : [];
}

const platformAliases = {
  nol: /^(?:nol(?:티켓|ticket)?|놀(?:티켓)?|야놀자(?:티켓)?|인터파크(?:티켓)?|(?:nol|놀)(?:티켓|ticket)?(?:구)?인터파크(?:티켓)?)$/i,
  catchtable: /^(?:캐치테이블|catchtable)$/i,
  yes24: /^(?:yes24(?:티켓|ticket)?|예스24(?:티켓)?)$/i,
  melon: /^(?:멜론티켓|melonticket)$/i,
  ticketlink: /^(?:티켓링크|ticketlink)$/i,
};

function compact(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function bookingPlatforms(links: PerformanceDetail['bookingLinks'], platforms: Platform[]) {
  const names = (links ?? []).map((link) => compact(link.name ?? ''));
  return platforms.filter(({ name }) => {
    const registered = compact(name);
    return names.some((candidate) => candidate === registered || Object.values(platformAliases).some(
      (alias) => alias.test(candidate) && alias.test(registered),
    ));
  });
}

export function fallbackPlatforms(query: string, platforms: Platform[]) {
  const text = compact(query);
  const explicit = Object.values(platformAliases).filter((alias) => alias.test(text));
  const rules: [RegExp, RegExp[]][] = [
    [/식당|맛집|레스토랑|오마카세|파인다이닝|브런치/, [platformAliases.catchtable]],
    [/콘서트|내한공연/, [platformAliases.nol]],
    [/팬미팅|쇼케이스|음악페스티벌/, [platformAliases.nol, platformAliases.melon, platformAliases.yes24]],
    [/뮤지컬|연극|클래식|오케스트라|발레|오페라/, [platformAliases.nol, platformAliases.yes24, platformAliases.ticketlink]],
    [/프로야구|야구|kbo|축구|k리그|농구|배구/, [platformAliases.ticketlink, platformAliases.nol]],
    [/전시회|전시예매|박람회|아트페어/, [platformAliases.nol, platformAliases.ticketlink, platformAliases.yes24]],
  ];
  const aliases = explicit.length ? explicit : rules.find(([pattern]) => pattern.test(text))?.[1] ?? [];
  return platforms.filter(({ name }) => aliases.some((alias) => alias.test(compact(name))));
}
