import { api, unwrap } from '../api/client';

export type Banner = {
  id: string; category: string; title: string; description: string;
  venue: string; period: string; image: string; imageAlt: string; color?: string; rank: number;
};

export type PerformanceDetail = {
  name: string; startsOn?: string; endsOn?: string; venueName?: string;
  scheduleText?: string; ticketPriceText?: string;
  bookingLinks?: { name: string; url: string }[]; attribution?: string[];
};

type Rankings = {
  from: string; to: string; attribution: string[];
  items: {
    kopisId: string; name: string; rank: number; genre?: string;
    venueName?: string; area?: string; performancePeriod?: string; posterUrl?: string;
  }[];
};

export function safeExternalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    if (url.protocol === 'http:' && /(^|\.)kopis\.or\.kr$/i.test(url.hostname)) url.protocol = 'https:';
    return url.href;
  } catch { return undefined; }
}

export async function getBanners(signal?: AbortSignal) {
  const page = await unwrap<Rankings>(api.GET('/api/performances/rankings', {
    params: { query: { size: 5 } }, signal,
  }));
  return {
    from: page.from, to: page.to, attribution: page.attribution ?? [],
    banners: (page.items ?? []).filter((item) => /^PF\d+$/.test(item.kopisId)).map((item): Banner => ({
      id: item.kopisId, category: item.genre || '공연', title: item.name,
      description: '공연 정보와 예매처 링크를 확인해 보세요.',
      venue: [item.area, item.venueName].filter(Boolean).join(' · ') || '공연장 정보 없음',
      period: item.performancePeriod || '공연 기간 정보 없음',
      image: safeExternalUrl(item.posterUrl) ?? '', imageAlt: `${item.name} 포스터`, rank: item.rank,
    })),
  };
}

export async function getPerformance(id: string, signal?: AbortSignal) {
  return unwrap<PerformanceDetail>(api.GET('/api/performances/{kopisId}', {
    params: { path: { kopisId: id } }, signal,
  }));
}
