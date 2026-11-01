import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import './service-guide.css';

// 법률 안내 본문은 별도로 확정한 뒤 반영한다. 현재는 안내 페이지의 구조만 제공한다.
const topics: { icon: IconName; title: string; description: string }[] = [
  { icon: 'user', title: '피코와 거래 당사자', description: '서비스에 참여하는 각 주체의 역할' },
  { icon: 'ticket', title: '예매 도움과 티켓 거래', description: '대행 서비스와 재판매의 구분' },
  { icon: 'wallet', title: '비용과 수수료', description: '대행 수고비와 매칭 수수료의 구분' },
];

const questions = [
  '피코는 어떤 서비스를 제공하나요?',
  '티켓 예매 대행은 암표 거래와 어떻게 다른가요?',
  '대행 수고비와 매칭 수수료에는 어떤 기준이 적용되나요?',
  '매크로나 자동화 프로그램을 사용해도 되나요?',
  '예매처 계정이나 개인정보를 공유해야 하나요?',
  '예매한 티켓이 취소되거나 입장이 제한될 수 있나요?',
  '예매에 실패하거나 거래가 취소되면 환불받을 수 있나요?',
  '문제가 있는 거래나 대행자를 어떻게 신고하나요?',
];

export function ServiceGuidePage() {
  return (
    <article className="service-guide-page">
      <nav className="page-breadcrumbs" aria-label="현재 위치">
        <Link to="/">홈</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">피코 서비스 운영 안내</span>
      </nav>

      <header className="service-guide-hero">
        <span className="service-guide-eyebrow"><Icon name="file" size={16} /> 이용 안내</span>
        <h1>피코 서비스 운영 안내</h1>
        <p>서비스 운영 기준과 주요 질문을 안내합니다.</p>
      </header>

      <nav className="service-guide-nav" aria-label="안내 목차">
        <a href="#service-structure"><span>01</span> 서비스 구조</a>
        <a href="#service-standards"><span>02</span> 이용 기준</a>
        <a href="#service-faq"><span>03</span> 자주 묻는 질문</a>
      </nav>

      <div className="service-guide-preparing">
        <Icon name="info" size={20} />
        <div>
          <strong>상세 안내를 준비 중입니다.</strong>
          <p>서비스 운영 기준과 항목별 상세 내용은 이 페이지에서 안내할 예정입니다.</p>
        </div>
      </div>

      <section id="service-structure" className="service-guide-section" aria-labelledby="service-structure-title">
        <div className="service-guide-section-heading">
          <span>01</span>
          <div><h2 id="service-structure-title">서비스 구조</h2><p>피코를 이해하는 세 가지 주제</p></div>
        </div>
        <div className="service-guide-topics">
          {topics.map((topic) => (
            <div className="service-guide-topic" key={topic.title}>
              <span className="service-guide-topic-icon"><Icon name={topic.icon} size={23} /></span>
              <h3>{topic.title}</h3>
              <p>{topic.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="service-standards" className="service-guide-section" aria-labelledby="service-standards-title">
        <div className="service-guide-section-heading">
          <span>02</span>
          <div><h2 id="service-standards-title">이용 기준</h2><p>예매 도움을 요청하기 전 살펴볼 내용</p></div>
        </div>
        <div className="service-guide-standards">
          <div><Icon name="ticket" size={20} /><span>예매 방식과 예매처별 정책</span></div>
          <div><Icon name="user" size={20} /><span>계정과 개인정보</span></div>
          <div><Icon name="card" size={20} /><span>비용·취소·환불</span></div>
          <div><Icon name="inbox" size={20} /><span>문제 거래와 신고</span></div>
        </div>
      </section>

      <section id="service-faq" className="service-guide-section" aria-labelledby="service-faq-title">
        <div className="service-guide-section-heading">
          <span>03</span>
          <div><h2 id="service-faq-title">자주 묻는 질문</h2><p>항목을 선택하면 상세 안내를 확인할 수 있습니다.</p></div>
        </div>
        <div className="service-guide-faq">
          {questions.map((question, index) => (
            <details key={question}>
              <summary>
                <span className="service-guide-question-number">Q{index + 1}</span>
                <span>{question}</span>
                <Icon name="down" size={19} />
              </summary>
              <div className="service-guide-answer"><p>이 질문에 대한 상세 안내를 준비 중입니다.</p></div>
            </details>
          ))}
        </div>
      </section>

      <div className="service-guide-footer">
        <Link className="btn secondary" to="/">홈으로 돌아가기 <Icon name="arrow" size={17} /></Link>
      </div>
    </article>
  );
}
