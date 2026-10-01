import { useEffect, useState } from 'react';
import { api, unwrap } from '../api/client';
import { num, pick, str, type Raw } from '../api/pick';
import type { Filters, Sort } from './filters';

// 화면에서 쓰는 도우미 모양. 서버 응답은 toAgent()로 이 모양에 맞춘다.
export interface Agent {
  id: number;
  name: string;
  initial: string;
  color: string;
  intro: string;
  rating: number;
  reviews: number;
  trades: number;
  success: number;
  /** 평균 응답(분). 응답에 없으면 null */
  reply: number | null;
  fee: number;
  career: string;
  sites: string[];
  category: string;
  identityVerified: boolean;
  accountVerified: boolean;
  detail?: string;
  hours?: string;
  successMin?: number;
  successMax?: number;
  image?: string;
}

export const categoryNames: Record<string, string> = {
  CONCERT: '콘서트',
  MUSICAL: '뮤지컬',
  SPORTS: '스포츠',
  COURSE: '강좌',
  FACILITY: '시설',
  OTHER: '기타',
};

const colors = ['blue', 'peach', 'mint', 'violet', 'pink', 'sand'];

// TODO(백엔드 확인): GET /api/agents, /api/agents/{id}, /api/me/favorites 응답 필드가 명세에 없다(data: object).
// 명세의 Profile 입력 스키마와 흔한 이름을 후보로 찾는다(api/pick.ts).
function names(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? str((x as Raw).name) : undefined)).filter((x): x is string => !!x);
}

function careerText(raw: Raw) {
  const started = str(pick(raw, 'careerStartedOn', 'profile.careerStartedOn'));
  if (started) {
    const years = Math.floor((Date.now() - new Date(started).getTime()) / (365.25 * 864e5));
    return years >= 1 ? `${years}년` : '1년 미만';
  }
  return str(pick(raw, 'careerDescription', 'profile.careerDescription', 'career')) || '미입력';
}

/**
 * 도우미 활동 분야 코드 목록. 공개 상세(GET /api/agents/{id})는 categories를 [{category:'CONCERT'}]로,
 * 관리자 심사 목록은 ['CONCERT']로 준다. 두 모양 모두 코드 문자열 배열로 바꾼다.
 */
export function categoryCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => (typeof c === 'string' ? c : c && typeof c === 'object' ? str((c as Raw).category) : undefined))
    .filter((c): c is string => !!c);
}

export function toAgent(raw: Raw): Agent {
  const id = num(pick(raw, 'agentId', 'agentUserId', 'userId', 'id')) ?? 0;
  const name = str(pick(raw, 'activityName', 'profile.activityName', 'nickname', 'name')) || '이름 없는 도우미';
  const category = str(pick(raw, 'primaryCategory', 'profile.primaryCategory', 'category')) || '';
  const hours = str(pick(raw, 'contactHoursNote', 'profile.contactHoursNote'));
  return {
    id,
    name,
    initial: name[0],
    color: colors[Math.abs(id) % colors.length],
    intro: str(pick(raw, 'headline', 'profile.headline', 'intro')) || '',
    detail: str(pick(raw, 'bio', 'profile.bio')),
    rating: num(pick(raw, 'averageRating', 'ratingAverage', 'rating', 'stats.averageRating')) ?? 0,
    reviews: num(pick(raw, 'reviewCount', 'reviewsCount', 'stats.reviewCount')) ?? 0,
    trades: num(pick(raw, 'completedCount', 'completedRequestCount', 'completedTradeCount', 'tradeCount', 'stats.completedCount')) ?? 0,
    success: num(pick(raw, 'successRate', 'stats.successRate')) ?? 0,
    reply: num(pick(raw, 'averageResponseMinutes', 'responseMinutes', 'avgResponseMinutes', 'stats.averageResponseMinutes')) ?? null,
    fee: num(pick(raw, 'upfrontFeeKrw', 'profile.upfrontFeeKrw', 'upfrontFee')) ?? 0,
    successMin: num(pick(raw, 'successFeeMin', 'profile.successFeeMin')),
    successMax: num(pick(raw, 'successFeeMax', 'profile.successFeeMax')),
    career: careerText(raw),
    sites: names(pick(raw, 'platforms', 'platformNames', 'profile.platforms')),
    category: categoryNames[category] ?? category,
    hours,
    identityVerified: pick(raw, 'identityVerified', 'verification.identity') === true,
    accountVerified: pick(raw, 'payoutAccountVerified', 'accountVerified', 'verification.payoutAccount') === true,
    image: str(pick(raw, 'profileImageUrl', 'imageUrl', 'profile.imageUrl')),
  };
}

export interface Platform {
  id: number;
  name: string;
}

let platformCache: Promise<Platform[]> | null = null;
// 한 번 받은 목록. 나중에 열리는 필터 모달이 첫 렌더부터 예매처를 알 수 있게 한다.
let platformList: Platform[] = [];
/** GET /api/platforms. 관리자가 등록한 예매처 목록(필터 선택지와 platformIds 변환에 쓴다) */
export function loadPlatforms() {
  platformCache ??= unwrap<Raw[]>(api.GET('/api/platforms'))
    .then((list) => list.map((p) => ({ id: num(p.id) ?? 0, name: str(p.name) || '' })).filter((p) => p.id && p.name))
    .then((list) => (platformList = list))
    .catch((e) => {
      platformCache = null;
      throw e;
    });
  return platformCache;
}

export function usePlatforms() {
  const [platforms, setPlatforms] = useState<Platform[]>(platformList);
  useEffect(() => {
    loadPlatforms().then(setPlatforms, () => {});
  }, []);
  return platforms;
}

// 명세에 착수비 높은순(PRICE_DESC)이 없어 high는 PRICE_ASC 결과를 뒤집는다(한 페이지 100명 안에서만 정확).
const sortParam: Record<Sort, string> = {
  recommend: 'RECOMMENDED',
  low: 'PRICE_ASC',
  high: 'PRICE_ASC',
  rating: 'RATING',
  trades: 'COMPLETED',
  success: 'SUCCESS_RATE',
};

/** 검색어·필터를 GET /api/agents 쿼리로 바꾼다. 목록에 없는 예매처(기타 직접 입력)는 q로 검색한다(q가 예매처명도 검색함). */
function searchQuery(query: string, sort: Sort, f: Filters, platforms: Platform[]) {
  const byName = new Map(platforms.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const platformIds = f.sites.map((s) => byName.get(s.trim().toLowerCase())).filter((id): id is number => !!id);
  const unknownSites = f.sites.filter((s) => !byName.has(s.trim().toLowerCase()));
  const q = [query.trim(), ...unknownSites].filter(Boolean).join(' ');
  return {
    q: q || undefined,
    upfrontMin: f.min || undefined,
    upfrontMax: f.max || undefined,
    ratingMin: f.rating || undefined,
    successRateMin: f.success || undefined,
    availableDates: f.dates.length ? f.dates : undefined,
    platformIds: platformIds.length ? platformIds : undefined,
    sort: sortParam[sort],
    page: 0,
    size: 100,
  };
}

type SearchPage = { items?: Raw[]; totalCount?: number };

export async function searchAgents(query: string, sort: Sort, f: Filters, platforms: Platform[]) {
  const page = await unwrap<SearchPage>(api.GET('/api/agents', { params: { query: searchQuery(query, sort, f, platforms) } }));
  const items = (page.items ?? []).map(toAgent);
  return { items: sort === 'high' ? items.reverse() : items, total: page.totalCount ?? items.length };
}

export type SearchState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; items: Agent[]; total: number };

/** 검색 조건이 바뀌면 250ms 뒤에 다시 조회한다. 늦게 도착한 이전 응답은 버린다. */
export function useAgentSearch(query: string, sort: Sort, f: Filters, reload = 0): SearchState {
  const platforms = usePlatforms();
  const [state, setState] = useState<SearchState>({ status: 'loading' });
  const key = JSON.stringify([query, sort, f, platforms, reload]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchAgents(query, sort, f, platforms).then(
        (r) => alive && setState({ status: 'done', ...r }),
        (e) => alive && setState({ status: 'error', message: e instanceof Error ? e.message : '도우미를 불러오지 못했어요.' }),
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // key에 모든 입력이 들어 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
