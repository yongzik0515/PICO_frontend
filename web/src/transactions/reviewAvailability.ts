/** Direct-trade reviews open at the UTC ticket opening; legacy rows may omit it. */
export function isReviewOpen(request: { status: string; opensAt: string }, now = Date.now()): boolean {
  if (request.status === 'COMPLETED') return true;
  if (request.status !== 'MATCHING_COMPLETED') return false;
  if (!request.opensAt) return true;
  const at = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(request.opensAt) ? request.opensAt : `${request.opensAt}Z`);
  return Number.isFinite(at) && now >= at;
}
