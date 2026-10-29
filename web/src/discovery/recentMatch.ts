/** Backend LocalDateTime is UTC even when it has no explicit Z suffix. */
export function recentMatch(value: string | undefined, now = Date.now()): { text: string; dateTime: string } | null {
  if (!value) return null;
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(raw)) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`);
  const elapsed = now - date.getTime();
  if (!Number.isFinite(elapsed) || elapsed < -60_000) return null;
  let text: string;
  if (elapsed < 60_000) text = '방금 전';
  else if (elapsed < 3_600_000) text = `${Math.floor(elapsed / 60_000)}분 전`;
  else if (elapsed < 86_400_000) text = `${Math.floor(elapsed / 3_600_000)}시간 전`;
  else if (elapsed < 7 * 86_400_000) text = `${Math.floor(elapsed / 86_400_000)}일 전`;
  else {
    const parts = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now);
    text = `${part('year') !== year ? `${part('year')}년 ` : ''}${part('month')}월 ${part('day')}일`;
  }
  return { text, dateTime: date.toISOString() };
}
