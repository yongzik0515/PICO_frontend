// 홈·이벤트 목록에서 공유하는 배너 문구, 순서, 기간과 이동 주소. 장식은 PromoBanner의 SVG로 그린다.
export type Promo = {
  id: string;
  badge: string;
  title: string;
  emphasis?: string;
  description: string;
  ticketLabel: string;
  alt: string;
  to: string;
  /** 보이는 기간(한국 시간). 없으면 항상 보인다. 끝 시각은 포함하지 않는다. */
  from?: string;
  until?: string;
};

// 도우미 심사 완료 이벤트 마감: 2026-11-08(일)까지 = 11-09 00:00.
const FOUNDING_UNTIL = '2026-11-09T00:00:00+09:00';
// 첫 구매 보너스는 11월 4일부터 보여 준다. 승인 이벤트 연장과 독립적이다. 종료일이 정해지면 FIRST_PURCHASE_UNTIL을 채운다.
export const FIRST_PURCHASE_FROM = '2026-11-04T00:00:00+09:00';
export const FIRST_PURCHASE_UNTIL: string | undefined = undefined;

export const promos: Promo[] = [
  { id: 'founding', badge: '이벤트', title: '도우미 심사 완료하면 매칭권 ', emphasis: '2장', description: '11월 8일(일)까지 연장', ticketLabel: '2장', alt: '이벤트. 도우미 심사 완료하면 매칭권 2장을 드려요. 11월 8일 일요일까지 연장', to: '/application', until: FOUNDING_UNTIL },
  { id: 'first-purchase', badge: '이벤트', title: '첫 구매하면 매칭권 ', emphasis: '5장 더', description: '계정당 한 번, 결제 확인 후 지급', ticketLabel: '+5장', alt: '이벤트. 첫 구매하면 매칭권 5장 더. 계정당 한 번, 결제 확인 후 지급', to: '/credits', from: FIRST_PURCHASE_FROM, until: FIRST_PURCHASE_UNTIL },
  { id: 'guide', badge: '체험', title: '도우미 일을 미리 해 보세요', description: '가입 없이 둘러볼 수 있어요', ticketLabel: '체험', alt: '도우미 일을 미리 해 보세요. 가입 없이 둘러볼 수 있어요', to: '/guide' },
  { id: 'ad', badge: '광고', title: '공연·굿즈 소식을 알려 보세요', description: '광고 문의하기', ticketLabel: '광고', alt: '광고. 공연·굿즈 소식을 팬들에게 알려 보세요. 광고 문의하기', to: '/inquiries' },
];

/** 지금 보여 줄 배너. 기간 밖인 배너는 뺀다. */
export function activePromos(now = Date.now()): Promo[] {
  return promos.filter((p) => (!p.from || now >= Date.parse(p.from)) && (!p.until || now < Date.parse(p.until)));
}

/** 첫 구매 보너스를 지금 안내할지(충전 화면 리본). */
export function firstPurchaseBonusOn(now = Date.now()): boolean {
  return now >= Date.parse(FIRST_PURCHASE_FROM) && (!FIRST_PURCHASE_UNTIL || now < Date.parse(FIRST_PURCHASE_UNTIL));
}
