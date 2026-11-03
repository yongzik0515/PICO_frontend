import { Link, useSearchParams } from 'react-router-dom';
import { activePromos } from '../home/promos';
import { PromoBanner } from '../home/PromoBanner';
import { PageTitle } from '../ui/PageTitle';
import './notices.css';

export function NoticesPage() {
  const [params] = useSearchParams();
  const events = params.get('tab') === 'events';
  const entries = activePromos().filter((p) => p.id === 'founding' || p.id === 'first-purchase');
  return <div className="notices-page">
    <PageTitle title="공지·이벤트" crumbs={[{ label: '홈', to: '/' }]} />
    <nav className="notices-tabs" aria-label="공지 및 이벤트 분류">
      <Link to="/notices" aria-current={!events ? 'page' : undefined}>공지사항</Link>
      <Link to="/notices?tab=events" aria-current={events ? 'page' : undefined}>이벤트</Link>
    </nav>
    {events ? <section aria-label="진행 중인 이벤트" className="notices-events">
      {entries.length ? entries.map((p) => <Link className="notices-event" to={p.to} key={p.id}>
        <PromoBanner promo={p} />
        <span>진행 중</span><h2>{p.id === 'founding' ? '창립 도우미 매칭권 지원' : '매칭권 첫 구매 보너스'}</h2>
        <p>{p.alt.replace(/^이벤트\. /, '')}</p><strong>자세히 보기 →</strong>
      </Link>) : <p className="empty">현재 진행 중인 이벤트가 없습니다.</p>}
    </section> : <section aria-label="공지사항 목록" className="notices-list">
      <details><summary><span>이용 안내</span><h2>피코 서비스 이용 방법 안내</h2></summary>
        <div><p>도우미 찾기부터 요청과 매칭까지, 피코 이용 방법을 안내 페이지에서 확인할 수 있습니다.</p><Link to="/guide">이용 방법 확인하기 →</Link></div>
      </details>
      <details><summary><span>약관 안내</span><h2>서비스 이용약관 및 개인정보처리방침 안내</h2></summary>
        <div><p>서비스 이용 조건과 개인정보 처리에 관한 내용을 아래 문서에서 확인할 수 있습니다.</p><Link to="/terms">서비스 이용약관</Link><Link to="/privacy">개인정보처리방침</Link></div>
      </details>
    </section>}
  </div>;
}
