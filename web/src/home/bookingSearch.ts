export type BookingCandidate = {
  id: string;
  name: string;
  venueName?: string | null;
  startsOn?: string | null;
  platformIds: number[];
};

export async function searchBookingTargets(keyword: string, signal: AbortSignal) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const url = new URL(`${baseUrl}/api/booking-targets/search`, location.origin);
  url.searchParams.set('keyword', keyword);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('예약 대상 검색에 실패했어요.');
  const body: { success?: boolean; data?: { items: BookingCandidate[]; attribution?: string[] } } = await response.json();
  if (!body.success || !body.data || !Array.isArray(body.data.items)) throw new Error('예약 검색 응답을 읽지 못했어요.');
  return body.data;
}
