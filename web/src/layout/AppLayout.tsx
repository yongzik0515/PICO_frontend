import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useAppState, type Mode } from '../AppState';
import { Icon, type IconName } from '../ui/Icon';
import { notificationRoleNames, notificationTarget, useNotificationRoles, useNotifications, type Notification } from './notifications';
import { utcToLocal } from '../transactions/ui';

// 전자상거래법·정보통신망법에 따라 푸터에 표기하는 사업자 정보(사업자등록증 기준).
// 빈 문자열은 아직 확정되지 않은 항목으로, 값을 채우면 푸터에 자동으로 나타난다.
const BIZ = {
  name: '피코(PICO)',
  ceo: '박진영',
  bizNo: '278-02-03958',
  address: '서울특별시 마포구 신촌로24길 14, 301호(노고산동)',
  mailOrderNo: '', // 통신판매업 신고번호 — 신고 완료 후 '제2026-서울마포-0000호' 형태로 기재(결제 오픈 전 필수)
  hosting: '', // 호스팅 서비스 제공자 (예: Amazon Web Services)
  cpo: '', // 개인정보보호책임자 성명
  cpoEmail: '', // 개인정보보호책임자 연락처
  tel: '070-8984-4636', // 고객센터 전화번호 (예: 02-0000-0000 (평일 10:00~18:00))
  email: '', // 고객 문의 이메일
};

// 사업자등록번호 진위는 공정거래위원회 '사업자정보확인'으로 연결해야 한다(하이픈 없는 10자리).
const BIZ_INFO_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BIZ.bizNo.replace(/-/g, '')}`;

type BizItem = { label: string; value: string; href?: string };

// 값이 빈 항목은 줄에서 빼고, 줄 전체가 비면 그 줄도 그리지 않는다.
function bizLines(): BizItem[][] {
  const lines: BizItem[][] = [
    [
      { label: '상호명', value: BIZ.name },
      { label: '대표자', value: BIZ.ceo },
      { label: '개인정보보호책임자', value: BIZ.cpo && BIZ.cpoEmail ? `${BIZ.cpo}(${BIZ.cpoEmail})` : BIZ.cpo },
    ],
    [
      { label: '사업자등록번호', value: BIZ.bizNo, href: BIZ_INFO_URL },
      { label: '통신판매업신고번호', value: BIZ.mailOrderNo },
    ],
    [
      { label: '주소', value: BIZ.address },
      { label: '호스팅제공자', value: BIZ.hosting },
    ],
    [
      { label: '고객센터', value: BIZ.tel },
      { label: '이메일', value: BIZ.email },
    ],
  ];
  return lines.map((l) => l.filter((i) => i.value)).filter((l) => l.length);
}

// 프로토타입 app.js의 header()/footer()와 pc-interactions.js의 알림·프로필 팝오버를 그대로 옮김.
// <main class="page {route}">의 route 클래스는 프로토타입 CSS가 화면별 스타일에 쓴다.
function routeKey(pathname: string) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/agents/')) return 'profile';
  // 프로토타입의 화면 이름(detail·finalTerms·payment·proof·result)에 맞춘다.
  const tx = pathname.match(/^\/requests\/\d+(?:\/(terms|payment|evidence|result|review))?$/);
  if (tx) return ({ terms: 'finalTerms', payment: 'payment', evidence: 'proof', result: 'result', review: 'review' } as Record<string, string>)[tx[1]] ?? 'detail';
  if (pathname.startsWith('/request-sent/')) return 'requestSent';
  return pathname.split('/')[1] || 'home';
}

const titles: Record<string, string> = {
  home: '도우미 찾기',
  requests: '내 활동',
  leads: '받은 요청',
  matches: '매칭 관리',
  profile: '도우미 프로필',
  my: '마이페이지',
  login: '로그인',
  application: '도우미 신청',
};

type Popover = '' | 'notifications' | 'profile';

export function AppLayout() {
  const { loggedIn, me, logout, avatarUrl, helperAvatarUrl } = useAuth();
  const [{ mode }, setState] = useAppState();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const route = routeKey(pathname);
  // 팝오버는 열었던 화면에서만 열려 있다(경로가 바뀌면 자동으로 닫힘).
  const [popover, setPopover] = useState<{ kind: Popover; path: string }>({ kind: '', path: '' });
  const opened = popover.path === pathname ? popover.kind : '';
  const setOpened = (kind: Popover) => setPopover({ kind, path: pathname });
  const right = useRef<HTMLDivElement>(null);

  const helper = mode === 'agent';
  const headerAvatar = helper ? helperAvatarUrl || avatarUrl : avatarUrl;
  const name = String(me?.nickname ?? me?.name ?? '');
  const { items: notifications, unread, open: openNotification, readAll } = useNotifications(pathname);
  const roleOf = useNotificationRoles(notifications);
  async function clickNotification(n: Notification) {
    setOpened('');
    await openNotification(n);
    const to = notificationTarget(n);
    if (to) navigate(to);
  }

  const nav: [string, string, string, IconName][] = helper
    ? [['/leads', 'leads', '받은 요청', 'inbox'], ['/matches', 'matches', '매칭 관리', 'ticket']]
    : [['/', 'home', '도우미 찾기', 'search'], ['/requests', 'requests', '내 활동', 'ticket']];
  const active = ['my', 'favorites', 'help', 'inquiries', 'terms', 'privacy', 'guide', 'user-profile', 'helper-profile', 'account', 'history', 'application', 'credits', 'reports'].includes(route) ? 'my' : helper ? (route === 'matches' || route === 'availability' ? 'matches' : 'leads') : route === 'requests' ? 'requests' : 'home';

  useEffect(() => {
    document.title = `${titles[route] || '티켓팅 매칭'} · PICO`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route, pathname]);

  useEffect(() => {
    if (!opened) return;
    const outside = (e: Event) => {
      if (!right.current?.contains(e.target as Node)) setPopover({ kind: '', path: '' });
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setPopover({ kind: '', path: '' });
      right.current?.querySelector<HTMLElement>(`[data-shell=${opened}]`)?.focus();
    };
    document.addEventListener('click', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [opened]);

  function toggle(kind: Popover) {
    if (!loggedIn) return navigate('/login');
    setOpened(opened === kind ? '' : kind);
  }

  // 로그인하면 서버에 저장된 기본 모드(GET /api/me의 preferredMode)로 시작한다. 한 계정에 한 번만 맞춘다(/api/me의 계정 번호는 id).
  // 모드만 바꾸면 로그인 직후 보던 첫 화면('/' 도우미 찾기)과 버튼이 어긋나므로, 다른 모드의 첫 화면에 있으면 이 모드의 첫 화면으로 옮긴다.
  const synced = useRef<unknown>(null);
  const path = useRef(pathname);
  path.current = pathname;
  useEffect(() => {
    const preferred = me?.preferredMode;
    if (!me || synced.current === me.id || (preferred !== 'REQUESTER' && preferred !== 'AGENT')) return;
    synced.current = me.id;
    const next: Mode = preferred === 'AGENT' ? 'agent' : 'user';
    setState((s) => ({ ...s, mode: next }));
    if (next === 'agent' && path.current === '/') navigate('/leads', { replace: true });
    else if (next === 'user' && (path.current === '/leads' || path.current === '/matches')) navigate('/', { replace: true });
  }, [me, setState, navigate]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setState((s) => ({ ...s, mode: next }));
    // 명세: PATCH /api/me는 닉네임과 기본 모드를 함께 받는다. 저장에 실패해도 화면 전환은 그대로 둔다.
    if (loggedIn && typeof me?.nickname === 'string')
      void api.PATCH('/api/me', { body: { nickname: me.nickname, preferredMode: next === 'agent' ? 'AGENT' : 'REQUESTER' } }).catch(() => undefined);
    navigate(next === 'user' ? '/' : '/leads');
  }

  function go(to: string) {
    setOpened('');
    navigate(to);
  }

  return (
    <>
      <header className="topbar">
        <div className="nav-wrap">
          <Link className="brand" to={helper ? '/leads' : '/'}>
            <span className="brand-symbol">
              <Icon name="ticket" size={26} />
            </span>
            PICO
          </Link>
          <nav className="desktop-nav" aria-label="주 메뉴">
            {nav.map(([to, key, label]) => (
              <button key={key} className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => navigate(to)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="header-right" ref={right}>
            <button className="support-link" onClick={() => navigate('/help')}>
              고객 문의
            </button>
            <div className="mode-switch" aria-label="이용 역할">
              <span className={`mode-indicator ${mode}`}></span>
              <button className={!helper ? 'active' : ''} aria-pressed={!helper} onClick={() => switchMode('user')}>
                이용자
              </button>
              <button className={helper ? 'active' : ''} aria-pressed={helper} onClick={() => switchMode('agent')}>
                도우미
              </button>
            </div>
            <button
              className="icon-btn notification-bell"
              aria-label={`알림${unread ? ` ${unread}개 안 읽음` : ''}`}
              data-shell="notifications"
              aria-haspopup="dialog"
              aria-expanded={opened === 'notifications'}
              onClick={() => toggle('notifications')}
            >
              <Icon name="bell" size={22} />
              {unread > 0 && <i></i>}
            </button>
            {loggedIn ? (
              <button className="my-avatar" data-shell="profile" aria-label="내 프로필" aria-haspopup="dialog" aria-expanded={opened === 'profile'} onClick={() => toggle('profile')}>
                {headerAvatar ? <img src={headerAvatar} alt="" /> : name[0] || '나'}
              </button>
            ) : (
              <button className="header-login" onClick={() => navigate('/login')}>
                로그인 / 가입
              </button>
            )}
            {opened === 'profile' && (
              <div id="header-popover" className="header-popover profile-popover" role="dialog" aria-label="프로필 메뉴">
                <div className="profile-menu-identity">
                  <strong>{name || '회원'}님</strong>
                  <span>{helper ? '도우미' : '이용자'}</span>
                </div>
                <button onClick={() => go('/my')}>
                  <Icon name="user" size={18} />
                  마이페이지
                </button>
                <button onClick={() => go(helper ? '/helper-profile' : '/user-profile')}>프로필 수정</button>
                {helper && <button onClick={() => go('/credits')}>매칭권 충전</button>}
                {/* GET /api/me의 isAdmin. 권한은 서버가 다시 검사한다. */}
                {me?.isAdmin === true && <button onClick={() => go('/admin')}>관리자 화면</button>}
                <button
                  onClick={() => {
                    setOpened('');
                    void logout().then(() => navigate('/'));
                  }}
                >
                  로그아웃
                </button>
              </div>
            )}
            {opened === 'notifications' && (
              <div id="header-popover" className="header-popover notifications-popover" role="dialog" aria-label="알림 목록">
                <div className="popover-heading">
                  <h2>알림 {unread > 0 && <span>{unread}</span>}</h2>
                  <button disabled={!unread} onClick={() => void readAll()}>
                    모두 읽음
                  </button>
                </div>
                <div className="popover-notifications">
                  {notifications.length ? (
                    notifications.slice(0, 20).map((n) => (
                      <button key={n.notificationId} className={`popover-notification role-${roleOf(n)} ${!n.readAt ? 'unread' : ''}`} onClick={() => void clickNotification(n)}>
                        <span className="popover-notice-icon">
                          <Icon name={n.requestId ? 'check' : 'bell'} size={18} />
                        </span>
                        <span>
                          <strong>
                            <span className={`notification-role ${roleOf(n)}`}>{notificationRoleNames[roleOf(n)]}</span>
                            {n.title}
                          </strong>
                          {n.body && <span>{n.body}</span>}
                          <small>{utcToLocal(n.createdAt)}</small>
                        </span>
                        {!n.readAt && <i></i>}
                      </button>
                    ))
                  ) : (
                    <p className="popover-empty">
                      아직 도착한 알림이 없어요.
                      <br />
                      진행 소식을 이곳에서 알려드릴게요.
                    </p>
                  )}
                </div>
                <button className="popover-all" onClick={() => go('/notifications')}>
                  알림 전체 보기
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main id="main" className={`page ${route}`} tabIndex={-1}>
        <Outlet />
      </main>
      {/* 휴대폰(767px 이하) 하단 탭바. 헤더의 메뉴·이용자/도우미 전환·프로필 버튼이 숨겨지는 폭이라
          메뉴 2개 + 마이(역할 전환·로그아웃이 있는 마이페이지)로 대신한다. 스타일은 styles.css의 .bottom-nav. */}
      <nav className="bottom-nav" aria-label="하단 메뉴">
        {[...nav, ['/my', 'my', '마이', 'user'] as const].map(([to, key, label, icon]) => (
          <button key={key} className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => navigate(to)}>
            <Icon name={icon} size={22} />
            {label}
          </button>
        ))}
      </nav>
      <footer>
        <div className="footer-top">
          {/* 메인 오른쪽에 있던 '확인할 수 있는 신뢰' 안내를 바닥글 PICO 옆으로 옮겼다(고객센터는 바닥글 메뉴에만 둔다). */}
          <div className="footer-brand-row">
            <Link className="footer-brand" to="/">
              PICO
            </Link>
            <span className="footer-trust">
              <Icon name="shield" size={14} />
              <strong>확인할 수 있는 신뢰</strong>
              인증 정보와 플랫폼 거래 후기를 함께 확인하고 선택하세요.
            </span>
          </div>
          <div>
            <button onClick={() => navigate('/guide')}>이용 방법</button>
            <button onClick={() => navigate('/help')}>고객센터</button>
            <button onClick={() => navigate('/terms')}>이용약관</button>
            <button className="footer-privacy" onClick={() => navigate('/privacy')}>
              개인정보처리방침
            </button>
          </div>
        </div>
        <p>PICO는 이용자와 도우미를 연결하며 예매 성공이나 티켓을 보증하지 않습니다.</p>
        <ul className="footer-biz">
          {bizLines().map((line, i) => (
            <li key={i}>
              {line.map((item) => (
                <span key={item.label}>
                  {item.label}: {item.href ? (
                    <a href={item.href} target="_blank" rel="noreferrer noopener">
                      {item.value}
                    </a>
                  ) : (
                    item.value
                  )}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <small>© 2026 PICO. All rights reserved.</small>
      </footer>
    </>
  );
}
