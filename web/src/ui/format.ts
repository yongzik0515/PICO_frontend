export const money = (n: number | string | undefined) => Number(n || 0).toLocaleString('ko-KR');

/** 서버의 평균 응답 시간(분)을 분·시간·일 중 하나로 반올림해 표시한다. */
export function responseTime(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return '-';
  if (minutes < 1) return '1분 미만';
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}일`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}시간`;
  return `${Math.round(minutes)}분`;
}


/** 메일의 링크 전체를 붙여 넣어도, token= 뒤 값만 붙여 넣어도 토큰만 꺼낸다. */
export function tokenFrom(value: string) {
  const v = value.trim();
  const at = v.indexOf('token=');
  if (at < 0) return v;
  const raw = v.slice(at + 6).split(/[&#\s]/)[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 서버 UTC 기한(그 시각 직전까지 유효) → 마지막으로 쓸 수 있는 한국 날짜 'YYYY-MM-DD'. 기한에서 1초 뺀 시각의 KST 날짜다. */
export function kstLastDay(iso: string) {
  if (!iso) return '';
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  return isNaN(t) ? iso.slice(0, 10) : new Date(t - 1000 + 9 * 3600e3).toISOString().slice(0, 10);
}

/** 성공률은 화면에서 정수 퍼센트로 표시한다. */
export const successRate = (value: number | null) => value === null || !Number.isFinite(value) ? '기록 없음' : `${Math.round(value)}%`;

/** 성공률의 계산 근거. 성공률은 공개 후기 중 예매 결과를 남긴 후기로만 계산한다. */
export const successRateBasis = (value: number | null, reviews: number) =>
  value === null || !Number.isFinite(value) ? '예매 결과를 남긴 후기가 아직 없어요' : `예매 결과를 남긴 후기 ${reviews}건 기준`;
