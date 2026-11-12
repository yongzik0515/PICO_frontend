import { api, unwrap } from '../api/client';

const compact = (text: string) => text.replace(/\s+/g, '').toLowerCase();

/**
 * POST /api/ai/search-keyword: AI가 오타·줄임말을 고친 검색어(예: 태연콘 → 태연 콘서트).
 * 고칠 것이 없거나(띄어쓰기·대소문자만 다른 경우 포함) 실패하면 null이며, 원래 검색은 그대로 진행된다.
 * 로그인한 회원이 Enter·검색 버튼으로 확정했을 때만 부른다(라이너 유료 호출, 입력 중 호출 금지).
 */
export async function correctKeyword(query: string): Promise<string | null> {
  const text = query.trim();
  if (!text || text.length > 100) return null;
  try {
    const result = await unwrap<{ keyword?: string }>(api.POST('/api/ai/search-keyword', { body: { query: text } }));
    const fixed = result.keyword?.trim();
    return fixed && fixed.length <= 100 && compact(fixed) !== compact(text) ? fixed : null;
  } catch {
    return null; // AI 미설정·오류·요청 제한: 원래 검색어만 쓴다.
  }
}
