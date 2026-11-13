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
  const words = query.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const explicitNames: [RegExp, RegExp][] = [
    [/(?:^| )nol(?: |$)|놀티켓|야놀자|인터파크/u, platformAliases.nol],
    [/캐치테이블|\bcatch\s?table\b/u, platformAliases.catchtable],
    [/예스\s?24|\byes\s?24\b/u, platformAliases.yes24],
    [/멜론\s?티켓|\bmelon\s?ticket\b/u, platformAliases.melon],
    [/티켓\s?링크|\bticket\s?link\b/u, platformAliases.ticketlink],
  ];
  const explicit = explicitNames.filter(([pattern, alias]) => pattern.test(words) || alias.test(text)).map(([, alias]) => alias);
  const rules: [RegExp, RegExp[]][] = [
    [/팬\s?(?:미팅|콘서트|콘|클럽\s?창단식)|쇼케이스|(?:음악|뮤직|락|록|재즈)\s?페스티벌|\b(?:fan\s?meetings?|fan\s?concerts?|fancon|showcase|(?:music|rock|jazz) festivals?)\b/u, [platformAliases.nol, platformAliases.melon, platformAliases.yes24]],
    [/식당|맛집|레스토랑|오마카세|파인\s?다이닝|브런치|\b(?:restaurants?|omakase|fine dining|brunch)\b/u, [platformAliases.catchtable]],
    [/콘서트|(?:단독|내한)\s?공연|월드\s?투어|\b(?:concerts?|world tour|asia tour|live in (?:seoul|korea))\b/u, [platformAliases.nol]],
    [/뮤지컬|연극|클래식|오케스트라|발레|오페라|리사이틀|교향악|\b(?:musicals?|opera|ballet|orchestra|recitals?)\b/u, [platformAliases.nol, platformAliases.yes24, platformAliases.ticketlink]],
    [/야구|한국\s?시리즈|올스타전|축구|k\s?리그|농구|배구|v\s?리그|\b(?:kbo|k\s?league|kbl|baseball|football|basketball|volleyball)\b/u, [platformAliases.ticketlink, platformAliases.nol]],
    [/전시회|전시\s?예매|미술\s?전시|사진전|박람회|아트\s?페어|\b(?:exhibitions?|art fair|expo)\b/u, [platformAliases.nol, platformAliases.ticketlink, platformAliases.yes24]],
  ];
  const aliases = explicit.length ? explicit : rules.find(([pattern]) => pattern.test(words))?.[1] ?? [];
  return platforms.filter(({ name }) => aliases.some((alias) => alias.test(compact(name))));
}
