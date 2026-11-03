import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import './service-guide.css';

const sections = [
  {
    title: '사기 피해를 줄이기 위해 어떤 안전장치가 있나요?',
    paragraphs: [
      '가입 시 본인인증을 진행하고, 도우미 등록 과정에서 본인 명의 계좌를 확인합니다.',
      '플랫폼에서 확정한 거래 조건을 기록하며, 신고 접수 시 자료를 확인하고 필요한 이용 제한 조치를 진행합니다.',
      '다만 인증만으로 모든 거래의 안전이나 예매 성공이 보장되지는 않습니다.',
    ],
  },
  {
    title: '도우미에게 입금하기 전에 무엇을 확인해야 하나요?',
    paragraphs: [
      '착수비·수고비, 성공 기준, 실패·취소 시 환불 조건을 먼저 확정해 주세요.',
      '입금받는 사람의 명의를 확인하고, 합의 내용과 대화·송금 내역을 보관해 주세요.',
      '합의하지 않은 추가 입금이나 타인 명의 계좌로의 송금을 요구하면 진행을 멈추고 확인해 주세요.',
    ],
  },
  {
    title: '돈을 보냈는데 연락이 끊기거나 사기가 의심되면 어떻게 하나요?',
    paragraphs: [
      '거래 상세의 ‘신고하기’에 대화 내용과 송금 내역 등 자료를 제출해 주세요.',
      '운영팀이 거래 기록과 제출 자료를 확인하고, 필요한 경우 이용 제한 등의 조치를 진행합니다.',
      <>사기 피해가 의심된다면 <a href="https://ecrm.police.go.kr/minwon/main" target="_blank" rel="noreferrer">경찰청 사이버범죄 신고시스템</a>에도 신고해 주세요.</>,
    ],
  },
  {
    title: '피코가 거래대금을 보관하거나 환불해 주나요?',
    paragraphs: [
      '현재 착수비·수고비는 이용자와 도우미가 직접 주고받습니다.',
      '피코가 대금을 보관하지 않으며, 직접 송금한 돈을 대신 회수하거나 환불하는 기능은 제공하지 않습니다.',
      '환불 문제가 생기면 합의 내용과 관련 자료를 첨부해 신고·문의해 주세요.',
    ],
  },
  {
    title: '공연법 개정 이후에도 피코를 이용할 수 있나요?',
    paragraphs: [
      <>현행 공연법은 예매 도움을 요청하거나 이용자와 도우미를 연결하는 행위 자체를 일률적으로 금지하지 않습니다. <a href="https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025609297" target="_blank" rel="noreferrer">관련 조문</a></>,
      '다만 예매처에 따라 제3자 계정 접속이나 유료 예매 도움을 제한할 수 있습니다.',
      '이용 전 해당 예매처의 이용약관과 공연별 예매·본인확인 안내를 확인해 주세요.',
    ],
  },
  {
    title: '예매처 계정정보를 피코에 입력해야 하나요?',
    paragraphs: [
      '피코는 예매처 아이디·비밀번호를 수집하거나 보관하지 않습니다.',
      '요청서, 문의, 첨부 자료에 계정 정보의 입력은 금지됩니다.',
    ],
  },
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
      </header>
      <div className="service-guide-notice">
        {sections.map(({ title, paragraphs }, index) => (
          <section key={title} aria-labelledby={`operation-section-${index}`}>
            <h2 id={`operation-section-${index}`}><span>Q.</span>{title}</h2>
            {paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          </section>
        ))}
      </div>
      <div className="service-guide-footer">
        <Link className="btn secondary" to="/">홈으로 돌아가기 <Icon name="arrow" size={17} /></Link>
      </div>
    </article>
  );
}
