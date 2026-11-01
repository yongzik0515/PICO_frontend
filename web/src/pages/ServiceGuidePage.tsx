import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import './service-guide.css';

// 공지 본문은 문안 확정 후 반영한다.
const sections = [
  '법률 자문 및 관계기관 질의 경과',
  '서비스 구조에 관한 검토',
  '관련 법령 및 예매처 운영정책',
  '이용자 보호 및 거래 기준',
  '향후 운영정책 안내',
];

export function ServiceGuidePage() {
  return (
    <article className="service-guide-page">
      <nav className="page-breadcrumbs" aria-label="현재 위치">
        <Link to="/">홈</Link><span aria-hidden="true">›</span>
        <span aria-current="page">피코 서비스 운영 안내</span>
      </nav>
      <header className="service-guide-hero">
        <span className="service-guide-eyebrow"><Icon name="file" size={16} /> 공지</span>
        <h1>피코 서비스 운영 안내</h1>
        <p>서비스 관련 검토 사항과 운영 기준을 안내합니다.</p>
      </header>
      <div className="service-guide-preparing">
        <Icon name="info" size={20} />
        <div><strong>상세 안내를 준비 중입니다.</strong><p>항목별 내용은 이 페이지를 통해 안내할 예정입니다.</p></div>
      </div>
      <div className="service-guide-notice">
        {sections.map((title, index) => (
          <section key={title} aria-labelledby={`operation-section-${index}`}>
            <h2 id={`operation-section-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{title}</h2>
            <p>상세 안내를 준비 중입니다.</p>
          </section>
        ))}
      </div>
      <div className="service-guide-footer">
        <Link className="btn secondary" to="/">홈으로 돌아가기 <Icon name="arrow" size={17} /></Link>
      </div>
    </article>
  );
}
