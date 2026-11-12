import { ApiError, api, unwrap } from '../api/client';
import type { components } from '../api/schema';
import { getTokens } from '../api/tokens';
import type { Raw } from '../api/pick';

export const GROUP_DRAFT_KEY = 'pico_group_draft';
const pendingKey = (owner: string) => `pico_group_submission_${owner}`;
type StoredDraft = { owner: string; savedAt: number; values: Record<string, string> };
type Submission = components['schemas']['RequestGroupSubmit'] & { owner: string };
export function readGroupDraft(owner: string): Record<string, string> {
  try {
    const draft = JSON.parse(sessionStorage.getItem(GROUP_DRAFT_KEY) || 'null') as StoredDraft | null;
    if (!draft) return {};
    if (!Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > 24 * 3600e3 || (draft.owner && draft.owner !== owner)) {
      sessionStorage.removeItem(GROUP_DRAFT_KEY);
      return {};
    }
    if (owner && !draft.owner) sessionStorage.setItem(GROUP_DRAFT_KEY, JSON.stringify({ ...draft, owner }));
    return Object.fromEntries(Object.entries(draft.values ?? {}).filter(([, value]) => typeof value === 'string'));
  } catch { return {}; }
}
export function saveGroupDraft(owner: string, values: Record<string, string>) {
  sessionStorage.setItem(GROUP_DRAFT_KEY, JSON.stringify({ owner, values, savedAt: Date.now() }));
}
export function pendingGroupSubmission(owner: string): Submission | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey(owner)) || 'null') as Submission | null;
    return value?.owner === owner && owner ? value : null;
  } catch { return null; }
}
export async function submitGroup(owner: string, request: components['schemas']['RequestGroupDraft'], allowSingle: boolean): Promise<Raw> {
  if (!owner || String(getTokens()?.userId ?? '') !== owner) throw new Error('로그인 계정이 바뀌었어요. 현재 계정에서 요청 내용을 다시 확인해 주세요.');
  const pending = pendingGroupSubmission(owner) ?? { owner, submissionId: crypto.randomUUID(), request, allowSingle };
  sessionStorage.setItem(pendingKey(owner), JSON.stringify(pending));
  const body = { submissionId: pending.submissionId, request: pending.request, allowSingle: pending.allowSingle };
  try {
    const result = await unwrap<Raw>(api.POST('/api/request-groups', { body }));
    if (pendingGroupSubmission(owner)?.submissionId === pending.submissionId) sessionStorage.removeItem(pendingKey(owner));
    try {
      const draft = JSON.parse(sessionStorage.getItem(GROUP_DRAFT_KEY) || 'null') as StoredDraft | null;
      if (draft?.owner === owner) sessionStorage.removeItem(GROUP_DRAFT_KEY);
    } catch { /* The request succeeded; storage cleanup must not hide its result. */ }
    return result;
  } catch (error) {
    // A network/5xx result may have committed: retry the identical payload and key.
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && pendingGroupSubmission(owner)?.submissionId === pending.submissionId)
      sessionStorage.removeItem(pendingKey(owner));
    throw error;
  }
}
