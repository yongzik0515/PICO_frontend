import { useState } from 'react';
import { api, unwrap } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/Toast';

/**
 * 도우미 '활동 중' = 도우미 찾기 목록에 공개 + 새 요청 받기를 함께 켜고 끈다.
 * 현재 값은 GET /api/me(isListed·acceptsRequests), 저장은 PUT /api/me/agent/visibility. 신청 현황(승인)과 받은 요청 화면이 같이 쓴다.
 */
export function useAgentActive() {
  const { me, reloadMe } = useAuth();
  const toast = useToast();
  const flag = (v: unknown) => v === true || v === 1;
  const [saving, setSaving] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const active = pendingValue ?? (flag(me?.isListed) && flag(me?.acceptsRequests));

  async function setActive(next: boolean) {
    setPendingValue(next);
    setSaving(true);
    try {
      await unwrap(api.PUT('/api/me/agent/visibility', { body: { listed: next, acceptsRequests: next } }));
      toast(next ? '활동 중이에요. 이용자에게 프로필이 보이고 새 요청을 받아요.' : '활동을 쉬어요. 프로필이 목록에서 숨겨지고 새 요청을 받지 않아요.');
      await reloadMe();
    } catch (e) {
      toast(e instanceof Error ? e.message : '활동 상태를 바꾸지 못했어요.');
    } finally {
      setPendingValue(null);
      setSaving(false);
    }
  }

  return { active, ready: !!me, saving, setActive };
}
