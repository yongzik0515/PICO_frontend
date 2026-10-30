import { Link } from 'react-router-dom';
import { AccountCard } from '../ui/account';
import { PageTitle } from '../ui/PageTitle';
import legalDocuments from '../legal/legalDocuments.json';
import '../styles/legal.css';

const links = [
  ['/terms', '서비스 이용약관'],
  ['/privacy', '개인정보처리방침'],
  ['/signup-privacy', '회원가입 개인정보 수집·이용'],
  ['/contact-sharing', '연락처 제공 동의'],
] as const;

function LegalDocument({ document }: { document: keyof typeof legalDocuments }) {
  const { title, sections } = legalDocuments[document];
  return (
    <div className="account-contained legal-document">
      <PageTitle title={title} crumbs={[{ label: '홈', to: '/' }]} />
      <p className="prose">시행일: {document === 'terms' ? '2026년 11월 6일' : document === 'privacy' || document === 'contactSharing' ? '2026년 10월 31일' : '2026년 10월 29일'}</p>
      {document === 'terms' && <p className="prose">2026년 10월 30일 공지: AI 기능과 검토 결과·이의신청 안내를 추가해요. 시행 전에는 <a href="/legal/2026-10-29.1/terms.html">기존 이용약관</a>이 적용돼요.</p>}
      {document === 'privacy' && <p className="prose">라이너 AI 처리 항목·보관 조건과 검색 기록 안내를 추가했어요. <a href="/legal/2026-10-31/privacy.html">이전 게시본 보기</a></p>}
      <nav className="legal-links" aria-label="약관 및 개인정보 문서">
        {links.map(([to, label]) => <Link key={to} to={to} aria-current={label === title ? 'page' : undefined}>{label}</Link>)}
      </nav>
      {sections.map(({ title: heading, paragraphs, rows }) => (
        <AccountCard key={heading} title={heading}>
          {paragraphs.map((text, i) => <p className="prose" key={i}>{text}</p>)}
          {rows.length > 0 && <div className="legal-table-scroll" role="region" aria-label={`${heading} 상세`} tabIndex={0}>
            <table className="legal-table">
              <thead><tr>{rows[0].map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr></thead>
              <tbody>{rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>}
        </AccountCard>
      ))}
    </div>
  );
}

export function TermsOfServicePage() { return <LegalDocument document="terms" />; }
export function PrivacyPage() { return <LegalDocument document="privacy" />; }
export function ContactSharingPage() { return <LegalDocument document="contactSharing" />; }
export function SignupPrivacyPage() { return <LegalDocument document="signupPrivacy" />; }
