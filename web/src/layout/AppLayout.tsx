import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useAppState, type Mode } from '../AppState';
import { Icon } from '../ui/Icon';
import { useNotifications, type Notification } from './notifications';
import { utcToLocal } from '../transactions/ui';

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
  async function clickNotification(n: Notification) {
    setOpened('');
    await openNotification(n);
    if (n.requestId) navigate(`/requests/${n.requestId}`);
  }

  const nav: [string, string, string][] = helper
    ? [['/leads', 'leads', '받은 요청'], ['/matches', 'matches', '매칭 관리']]
    : [['/', 'home', '도우미 찾기'], ['/requests', 'requests', '내 활동']];
  const active = ['my', 'favorites', 'help', 'terms', 'privacy', 'guide', 'user-profile', 'helper-profile', 'account', 'history', 'application', 'credits', 'reports'].includes(route) ? 'my' : helper ? (route === 'matches' || route === 'availability' ? 'matches' : 'leads') : route === 'requests' ? 'requests' : 'home';

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
  const synced = useRef<unknown>(null);
  useEffect(() => {
    const preferred = me?.preferredMode;
    if (!me || synced.current === me.id || (preferred !== 'REQUESTER' && preferred !== 'AGENT')) return;
    synced.current = me.id;
    setState((s) => ({ ...s, mode: preferred === 'AGENT' ? 'agent' : 'user' }));
  }, [me, setState]);

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
                      <button key={n.notificationId} className={`popover-notification ${!n.readAt ? 'unread' : ''}`} onClick={() => void clickNotification(n)}>
                        <span className="popover-notice-icon">
                          <Icon name={n.requestId ? 'check' : 'bell'} size={18} />
                        </span>
                        <span>
                          <strong>{n.title}</strong>
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
      <footer>
        <div className="footer-top">
          <Link className="footer-brand" to="/">
            PICO
          </Link>
          <div>
            <button onClick={() => navigate('/guide')}>이용 방법</button>
            <button onClick={() => navigate('/help')}>고객센터</button>
            <button onClick={() => navigate('/terms')}>이용약관</button>
            <button onClick={() => navigate('/privacy')}>개인정보처리방침</button>
          </div>
        </div>
        <p>PICO는 이용자와 도우미를 연결하며 예매 성공이나 티켓을 보증하지 않습니다.</p>
        <small>© 2026 PICO</small>
      </footer>
    </>
  );
}
