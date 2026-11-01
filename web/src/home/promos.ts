// 홈 광고 자리에 돌려 보여 줄 배너 목록. 배너는 public/banners의 이미지 파일이고, 여기서는 순서·기간·이동 주소만 정한다.
// 이미지 파일명은 `${image}-pc.png`(검색창 옆), `${image}-mobile.png`(좁은 화면의 검색창 아래)다.
export type Promo = {
  id: string;
  image: string;
  alt: string;
  to: string;
  /** 보이는 기간(한국 시간). 없으면 항상 보인다. 끝 시각은 포함하지 않는다. */
  from?: string;
  until?: string;
};

// 창립 도우미 마감: 2026-11-03(화) 밤 12시 = 11-04 00:00.
const FOUNDING_UNTIL = '2026-11-04T00:00:00+09:00';
// 첫 구매 보너스는 창립 마감 다음 날부터 보여 준다. 종료일이 정해지면 FIRST_PURCHASE_UNTIL을 채운다.
export const FIRST_PURCHASE_FROM = '2026-11-04T00:00:00+09:00';
export const FIRST_PURCHASE_UNTIL: string | undefined = undefined;

export const promos: Promo[] = [
  { id: 'founding', image: 'founding', alt: '이벤트. 도우미 승인되면 매칭권 5장을 드려요. 11월 3일 밤 12시 마감', to: '/application', until: FOUNDING_UNTIL },
  { id: 'first-purchase', image: 'first-purchase', alt: '이벤트. 첫 구매하면 매칭권 5장 더. 승인 시 체험권 1장도 드려요', to: '/credits', from: FIRST_PURCHASE_FROM, until: FIRST_PURCHASE_UNTIL },
  { id: 'guide', image: 'guide', alt: '도우미 일을 미리 해 보세요. 가입 없이 둘러볼 수 있어요', to: '/guide' },
  { id: 'ad', image: 'ad', alt: '광고. 공연·굿즈 소식을 팬들에게 알려 보세요. 광고 문의하기', to: '/inquiries' },
];

/** 지금 보여 줄 배너. 기간 밖인 배너는 뺀다. */
export function activePromos(now = Date.now()): Promo[] {
  return promos.filter((p) => (!p.from || now >= Date.parse(p.from)) && (!p.until || now < Date.parse(p.until)));
}

/** 첫 구매 보너스를 지금 안내할지(충전 화면 리본). */
export function firstPurchaseBonusOn(now = Date.now()): boolean {
  return now >= Date.parse(FIRST_PURCHASE_FROM) && (!FIRST_PURCHASE_UNTIL || now < Date.parse(FIRST_PURCHASE_UNTIL));
}
