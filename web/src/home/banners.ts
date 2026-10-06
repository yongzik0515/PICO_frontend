// 히어로 티켓 캐러셀에 띄울 배너 데이터.
//
// 배너를 추가·수정·삭제하려면 아래 BANNERS 배열만 고치면 된다. 화면 코드(TicketCarousel.tsx)는 건드릴 필요가 없다.
// 나중에 관리자 페이지나 API에서 받아오려면 getBanners() 안쪽만 fetch로 바꾸면 된다.
// 공연명·설명은 가상의 공연이다(실제 공연명·아티스트명은 쓰지 않는다).

export type Banner = {
  id: string; // 배너를 구분하는 이름(영문·숫자, 겹치지 않게)
  category: string; // 카테고리 칩에 들어갈 말 (예: 콘서트)
  title: string; // 공연명 (최대 2줄까지 보이고, 넘치면 … 으로 줄어든다)
  description: string; // 한 줄 설명 (한 줄을 넘으면 … 으로 줄어든다)
  venue: string; // 장소. '지역 · 공연장' 형식 (예: 서울 · 대극장)
  period: string; // 공연 기간 (예: 2026.11.20 – 2027.02.14)
  ticketOpenAt: string; // 티켓 오픈 일시. 'YYYY-MM-DDTHH:mm' 형식 (D-day를 이걸로 자동 계산한다)
  image: string; // 이미지 경로. public 폴더 기준이라 /images/banners/파일명 으로 적는다
  imageAlt: string; // 이미지 대체 텍스트 (화면을 못 보는 분과 검색엔진이 읽는다)
  color?: string; // 대표 색상(카드 배경). 비워 두면 이미지 왼쪽 가장자리 색을 자동으로 뽑아 쓴다
  href: string; // 가운데 카드를 눌렀을 때 이동할 주소(도우미 찾기). '#search'처럼 #으로 시작하면 이 화면의 그 요소(검색창)로 이동한다
};

export const BANNERS: Banner[] = [
  {
    id: 'neon-pulse',
    category: '콘서트',
    title: '네온 펄스 라이브',
    description: '푸른 조명 아래 펼쳐지는 단독 무대예요.',
    venue: '서울 · 올림픽홀',
    period: '2026.11.20 – 2026.11.22',
    ticketOpenAt: '2026-10-08T20:00',
    image: '/images/banners/banner-1.jpg',
    imageAlt: '푸른 무대 조명 아래 검은 헤어밴드를 쓰고 헤드셋 마이크를 찬 가수의 얼굴',
    color: '',
    href: '#search',
  },
  {
    id: 'violet-stage',
    category: '쇼케이스',
    title: '바이올렛 스테이지 쇼케이스',
    description: '새 앨범 무대를 처음 공개하는 자리예요.',
    venue: '서울 · 블루스퀘어',
    period: '2026.10.31 – 2026.11.01',
    ticketOpenAt: '2026-10-04T20:00',
    image: '/images/banners/banner-2.jpg',
    imageAlt: '보랏빛 조명 속에서 고개를 기울이고 노래하는 가수',
    color: '',
    href: '#search',
  },
  {
    id: 'midnight-blue',
    category: '페스티벌',
    title: '미드나이트 블루 뮤직 페스티벌',
    description: '이틀 밤 이어지는 야외 라이브 무대예요.',
    venue: '인천 · 송도 달빛공원',
    period: '2026.11.14 – 2026.11.15',
    ticketOpenAt: '2026-10-15T14:00',
    image: '/images/banners/banner-3.jpg',
    imageAlt: '파란 조명이 비치는 무대 위, 금색 목걸이를 한 가수의 클로즈업',
    color: '',
    href: '#search',
  },
  {
    id: 'summer-letter',
    category: '팬미팅',
    title: '여름 편지 팬미팅',
    description: '팬과 함께 이야기 나누는 오후의 만남이에요.',
    venue: '부산 · 벡스코 오디토리움',
    period: '2026.12.05 – 2026.12.06',
    ticketOpenAt: '2026-09-30T11:00',
    image: '/images/banners/banner-4.jpg',
    imageAlt: '하얀 민소매 옷을 입고 바람에 머리카락이 날리는 사람의 상반신',
    color: '',
    href: '#search',
  },
  {
    id: 'red-heart',
    category: '콘서트',
    title: '레드 하트 앙코르 콘서트',
    description: '한 해를 마무리하는 연말 앙코르 공연이에요.',
    venue: '서울 · 대극장',
    period: '2026.12.26 – 2027.01.03',
    ticketOpenAt: '2026-10-22T20:00',
    image: '/images/banners/banner-5.jpg',
    imageAlt: '검은 옷에 하트 귀걸이를 하고 턱에 손을 댄 사람',
    color: '',
    href: '#search',
  },
];

// 지금은 위 배열을 그대로 돌려준다. 나중에 API를 붙일 때 이 함수 안만 바꾸면 된다.
export function getBanners(): Banner[] {
  return BANNERS;
}
