import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppStateProvider } from './AppState';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { AgentCard } from './discovery/AgentCard';
import { FavoritesProvider, useFavorites } from './discovery/favorites';
import { AdminLayout } from './layout/AdminLayout';
import { AppLayout } from './layout/AppLayout';
import { AgentActivityPage, UserActivityPage } from './pages/ActivityPage';
import { ApiCheckPage } from './pages/ApiCheckPage';
import { AdminPage } from './pages/AdminPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { ContactSharingPage, PrivacyPage, SignupPrivacyPage, TermsOfServicePage } from './pages/LegalPage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { RecoveryPage, ResetPasswordPage } from './pages/RecoveryPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReportPage, ReportsPage } from './pages/ReportPage';
import { CreditsPage } from './pages/CreditsPage';
import { AccountPage, HistoryPage, MyPage, UserProfilePage, VerifyEmailPage } from './pages/MyPage';
import { InquiryHistoryPage, InquiryWritePage } from './pages/InquiryPage';
import { EvidencePage } from './pages/EvidencePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PaymentPage } from './pages/PaymentPage';
import { QuotePage, RequestSentPage } from './pages/QuotePage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { TermsPage } from './pages/TermsPage';
import { HomePage } from './pages/HomePage';
import { SocialCallbackPage } from './pages/SocialCallbackPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { SignupPage } from './pages/SignupPage';
import { Icon } from './ui/Icon';
import { PageTitle, type Crumb } from './ui/PageTitle';
import { ToastProvider } from './ui/Toast';

// 아직 만들지 않은 화면. 만들면 해당 페이지 컴포넌트로 바꾼다.
function Pending({ title, crumbs, notFound = false }: { title: string; crumbs?: Crumb[]; notFound?: boolean }) {
  const navigate = useNavigate();
  return (
    <>
      <PageTitle title={title} crumbs={crumbs} />
      <div className="empty">
        <Icon name="info" size={38} />
        <h3>{notFound ? '주소를 다시 확인해 주세요' : '아직 준비 중입니다'}</h3>
        <p>{notFound ? '요청한 페이지가 없거나 이동했어요.' : '곧 이용하실 수 있도록 준비하고 있어요.'}</p>
        {/* 이전 화면으로 돌아간다. 주소로 바로 들어와 이전 화면이 없으면 첫 화면으로 간다. */}
        <button className="btn secondary" onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/'))}>
          돌아가기
        </button>
      </div>
    </>
  );
}

// 프로토타입 discovery.js의 favorites(). 목록은 GET /api/me/favorites
function FavoritesPage() {
  const { items: list, loaded, reload } = useFavorites();
  const navigate = useNavigate();
  // 다른 기기에서 바뀐 좋아요도 반영되게 화면에 들어올 때 서버 목록을 다시 받는다.
  useEffect(() => {
    void reload();
  }, [reload]);
  if (!loaded)
    return (
      <>
        <PageTitle title="좋아요한 도우미" crumbs={[{ label: '마이페이지', to: '/my' }]} />
        <div className="empty" role="status">
          <p>좋아요한 도우미를 불러오는 중이에요.</p>
        </div>
      </>
    );
  return (
    <>
      <PageTitle title="좋아요한 도우미" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <div className="favorite-list">
        {list.length ? (
          list.map((a) => (
            <div key={a.id} className="favorite-entry">
              <AgentCard agent={a} />
            </div>
          ))
        ) : (
          <div className="empty">
            <h2>아직 좋아요한 도우미가 없어요</h2>
            <p>프로필에서 좋아요를 눌러 모아 보세요.</p>
            <button className="btn secondary" onClick={() => navigate('/')}>
              도우미 찾기
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

/** 관리자 화면은 GET /api/me의 isAdmin이 true일 때만 연다. 권한은 서버가 API마다 다시 검사한다. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (!me && loading)
    return (
      <div className="empty" role="status">
        <p>권한을 확인하고 있어요.</p>
      </div>
    );
  if (me?.isAdmin === true) return children;
  return (
    <div className="empty">
      <Icon name="info" size={38} />
      <h3>권한이 없어요</h3>
      <p>관리자만 볼 수 있는 화면이에요.</p>
      <Link className="btn secondary" to="/">
        홈으로
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <ToastProvider>
          <FavoritesProvider>
          <BrowserRouter>
            <Routes>
              {/* 관리자 화면은 이용자·도우미 헤더 없이 관리자 전용 셸로 보여 준다. */}
              <Route element={<AdminLayout />}>
                <Route path="admin" element={auth(<RequireAdmin><AdminPage /></RequireAdmin>)} />
              </Route>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="agents/:id" element={auth(<ProfilePage />)} />
                <Route path="login" element={<LoginPage />} />
                <Route path="auth/social/callback" element={<SocialCallbackPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route path="dev/api" element={<ApiCheckPage />} />
                <Route path="favorites" element={auth(<FavoritesPage />)} />
                <Route path="quote/:id" element={auth(<QuotePage />)} />
                <Route path="request-sent/:id" element={auth(<RequestSentPage />)} />
                <Route path="requests" element={auth(<UserActivityPage />)} />
                <Route path="requests/:id" element={auth(<RequestDetailPage />)} />
                <Route path="requests/:id/terms" element={auth(<TermsPage />)} />
                <Route path="requests/:id/payment" element={auth(<PaymentPage />)} />
                <Route path="requests/:id/evidence" element={auth(<EvidencePage type="attempt" />)} />
                <Route path="requests/:id/result" element={auth(<EvidencePage type="result" />)} />
                <Route path="requests/:id/review" element={auth(<ReviewPage />)} />
                <Route path="availability" element={auth(<AvailabilityPage />)} />
                <Route path="report" element={auth(<ReportPage />)} />
                <Route path="reports" element={auth(<ReportsPage />)} />
                <Route path="notifications" element={auth(<NotificationsPage />)} />
                <Route path="my" element={auth(<MyPage />)} />
                <Route path="user-profile" element={auth(<UserProfilePage />)} />
                <Route path="account" element={auth(<AccountPage />)} />
                <Route path="history" element={auth(<HistoryPage />)} />
                <Route path="inquiries" element={auth(<InquiryWritePage />)} />
                <Route path="inquiries/history" element={auth(<InquiryHistoryPage />)} />
                <Route path="verify-email" element={<VerifyEmailPage />} />
                <Route path="application" element={auth(<ApplicationPage />)} />
                <Route path="helper-profile" element={auth(<ApplicationPage key="edit" edit />)} />
                <Route path="credits" element={auth(<CreditsPage />)} />
                <Route path="leads" element={auth(<AgentActivityPage key="leads" kind="leads" />)} />
                <Route path="matches" element={auth(<AgentActivityPage key="matches" kind="matches" />)} />
                <Route path="recovery" element={<RecoveryPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />
                <Route path="help" element={<Navigate to="/inquiries" replace />} />
                <Route path="guide" element={<Pending title="이용 방법" />} />
                <Route path="terms" element={<TermsOfServicePage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="signup-privacy" element={<SignupPrivacyPage />} />
                <Route path="contact-sharing" element={<ContactSharingPage />} />
                <Route path="*" element={<Pending title="페이지를 찾을 수 없어요" notFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
          </FavoritesProvider>
        </ToastProvider>
      </AppStateProvider>
    </AuthProvider>
  );
}
