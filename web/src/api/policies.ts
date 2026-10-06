import { useEffect, useState } from 'react';
import { api, unwrap } from './client';
import { num, str, type Raw } from './pick';

// GET /api/policies — 현재 유효한 약관 문서. 회원가입(TERMS·PRIVACY)과 요청·수락(CONTACT_SHARING)에 문서 id가 필요하다.
// TODO(백엔드 확인): 응답 필드가 명세에 없다. 관리자 등록 스키마(PolicyDocument)의 type·contentUrl 기준으로 찾고, id는 id·documentId 중 있는 것을 쓴다.
export type PolicyType = 'TERMS' | 'PRIVACY' | 'CONTACT_SHARING';

// 임시: 백엔드에 약관이 아직 없을 때 쓰는 대체 문서 번호(.env.local). 약관이 등록되면 .env.local에서 지우고 이 코드도 삭제한다.
const fallback: Record<PolicyType, number | undefined> = {
  TERMS: num(import.meta.env.VITE_FALLBACK_TERMS_ID),
  PRIVACY: num(import.meta.env.VITE_FALLBACK_PRIVACY_ID),
  CONTACT_SHARING: num(import.meta.env.VITE_FALLBACK_CONTACT_SHARING_ID),
};

// 서버에 등록된 실제 원문을 우선한다. 개발용 example.com 주소는 공개 문서로 대체한다.
export const policyPaths: Record<PolicyType, string> = {
  TERMS: '/terms', PRIVACY: '/signup-privacy', CONTACT_SHARING: '/contact-sharing',
};

function policyUrl(value: unknown, type: PolicyType): string {
  const raw = str(value);
  if (raw) {
    try {
      const url = new URL(raw, window.location.origin);
      if (['http:', 'https:'].includes(url.protocol) && url.hostname !== 'example.com' && !url.hostname.endsWith('.example.com')) return raw;
    } catch { /* 등록 전이거나 잘못된 주소이면 공개 문서를 표시한다. */ }
  }
  return policyPaths[type];
}

export interface PolicyDoc {
  id?: number;
  url: string;
}

export function findPolicy(list: Raw[] | null, type: PolicyType): PolicyDoc {
  const doc = list?.find((p) => [p.type, p.documentType].includes(type));
  const id = num(doc?.id ?? doc?.documentId);
  if (id && id > 0) return { id, url: policyUrl(doc?.contentUrl, type) };
  return { id: fallback[type], url: policyPaths[type] };
}

let cache: Promise<Raw[]> | null = null;
export function loadPolicies() {
  cache ??= unwrap<Raw[]>(api.GET('/api/policies')).catch(() => {
    cache = null;
    return [];
  });
  return cache;
}

/** 불러오기 전에는 null */
export function usePolicies() {
  const [policies, setPolicies] = useState<Raw[] | null>(null);
  useEffect(() => {
    void loadPolicies().then(setPolicies);
  }, []);
  return policies;
}
