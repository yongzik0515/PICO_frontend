// 캔버스 보드 파일과 주소. 순서는 체험 순서와 같다. (sync 스크립트도 이 목록을 쓴다)
export const BOARDS = [
  { file: 'U0-role.dc.html', slug: 'role', path: '/', title: '처음 화면' },
  // 이용자 함께 해 보기
  { file: 'U1-main.dc.html', slug: 'userMain', path: '/user', title: '이용자 · 메인' },
  { file: 'U2-profile.dc.html', slug: 'userProfile', path: '/user/profile', title: '이용자 · 도우미 프로필' },
  { file: 'U3-quote.dc.html', slug: 'userQuote', path: '/user/quote', title: '이용자 · 요청 보내기' },
  { file: 'U4-request.dc.html', slug: 'userRequest', path: '/user/request', title: '이용자 · 요청 상세' },
  { file: 'U5-end.dc.html', slug: 'userEnd', path: '/user/done', title: '이용자 · 함께 해 보기 마침' },
  { file: 'U6-practice.dc.html', slug: 'userPractice', path: '/user/practice', title: '이용자 · 혼자 해 보기' },
  // 도우미 함께 해 보기 → 혼자 해 보기 → 사전 신청
  { file: 'M2-welcome-character.dc.html', slug: 'main', path: '/helper', title: '메인' },
  { file: 'M3-my.dc.html', slug: 'my', path: '/my', title: '마이' },
  { file: 'M4-leads.dc.html', slug: 'leads', path: '/leads', title: '받은 요청' },
  { file: 'M5-detail.dc.html', slug: 'detail', path: '/detail', title: '요청 상세' },
  { file: 'M7-terms.dc.html', slug: 'terms', path: '/terms', title: '조건 보내기' },
  { file: 'M8-matched.dc.html', slug: 'matched', path: '/matched', title: '매칭 완료' },
  { file: 'M10-cases.dc.html', slug: 'cases', path: '/cases', title: '이런 경우도 있어요' },
  { file: 'M6-practice.dc.html', slug: 'practice', path: '/practice', title: '혼자 해 보기' },
  { file: 'M11-apply.dc.html', slug: 'apply', path: '/apply', title: '사전 신청' },
]
