import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppState } from '../AppState';
import { useAgentSearch } from '../discovery/agent';
import { AgentCard } from '../discovery/AgentCard';
import { FilterModal, QuickFilter } from '../discovery/FilterControls';
import { emptyFilters, filterLabels, removeFilter, sortOptions, type Filters, type Sort } from '../discovery/filters';
import { TicketCarousel } from '../home/TicketCarousel';
import '../home/home-layout.css';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

// 프로토타입 discovery.js의 home(). 검색·필터·정렬은 GET /api/agents가 처리한다.
const popular = ['태연 콘서트', '뮤지컬 프리미어', '데이식스 콘서트'];
const quickFilters = [
  ['price', '가격'],
  ['date', '예매 날짜'],
  ['rating', '별점'],
  ['success', '성공률'],
] as const;
// 이용 안내 3단계: 오른쪽 안내 카드와 휴대폰의 '이용 방법' 말풍선이 함께 쓴다.
const guideSteps = [
  ['나에게 맞는 도우미 찾기', '프로필과 거래 후기를 살펴보세요.'],
  ['원하는 조건으로 직접 요청', '공연, 좌석과 희망 수고비를 알려주세요.'],
  ['최종 조건 확인 후 안전결제', '도우미가 제안한 조건을 확인해요.'],
] as const;

function GuideSteps() {
  return (
    <ol className="guide-steps">
      {guideSteps.map(([title, desc], i) => (
        <li key={title}>
          <b>{i + 1}</b>
          <div>
            <strong>{title}</strong>
            <p>{desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// 휴대폰(767px 이하)은 오른쪽 안내 카드가 숨겨지므로(styles.css .home-sidebar) 필터 줄 왼쪽의 '이용 방법'을 누르면 말풍선으로 보여 준다.
// 바깥을 누르거나 포커스가 나가거나 Esc를 누르면 닫는다(QuickFilter와 같은 방식).
function GuideTip() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('click', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="home-guide-tip" ref={anchor}>
      <button ref={button} type="button" className="home-guide-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="info" size={16} />
        이용 방법
      </button>
      {open && (
        <div className="home-guide-bubble" role="dialog" aria-label="이용 방법">
          <GuideSteps />
          <button type="button" className="guide-link" onClick={() => navigate('/guide')}>
            이용 방법 자세히 보기 <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const [state, setState] = useAppState();
  const navigate = useNavigate();
  const toast = useToast();
  const [filterOpen, setFilterOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [helperAlert, setHelperAlert] = useState(false);
  const [reload, setReload] = useState(0);

  const { query, sort, filters } = state;
  const result = useAgentSearch(query, sort, filters, reload);
  const list = result.status === 'done' ? result.items : [];
  const total = result.status === 'done' ? result.total : 0;
  const labels = filterLabels(filters);
  const search = !!query || labels.length > 0;
  const setFilters = (f: Filters) => setState((s) => ({ ...s, filters: f }));
  const reset = () => setState((s) => ({ ...s, query: '', filters: emptyFilters() }));

  function saveAlert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const enabled = (e.currentTarget.elements.namedItem('enabled') as HTMLInputElement).checked;
    setHelperAlert(enabled);
    setAlertOpen(false);
    toast(enabled ? '도우미 알림 설정을 저장했어요.' : '도우미 알림을 껐어요.');
  }

  return (
    <>
      <section className="page-heading home-heading pc-hero">
        {/* 화면에는 캐러셀을 띄우고, 페이지 대표 제목은 검색엔진·스크린리더용으로 남긴다. */}
        <h1 className="tsb-visually-hidden">좋아하는 공연에, 한 걸음 더 가까이.</h1>
        <TicketCarousel />
      </section>
      <div className="pc-search-row">
        <div className="search-container">
          <input
            id="search"
            type="search"
            value={query}
            placeholder="공연명, 도우미 이름, 예매처를 검색해 보세요"
            aria-label="도우미 검색"
            onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && setReload((n) => n + 1)}
          />
          {/* 돋보기를 입력란 오른쪽 끝의 누를 수 있는 칩으로 둔다. 목록은 입력하는 대로 갱신되고, 이 버튼은 다시 불러온다. */}
          <button type="button" className="search-chip" aria-label="검색" onClick={() => setReload((n) => n + 1)}>
            <Icon name="search" size={20} />
          </button>
        </div>
        <div className="popular-shows">
          <span>인기 검색</span>
          {popular.map((p) => (
            <button key={p} onClick={() => setState((s) => ({ ...s, query: p }))}>
              {p}
            </button>
          ))}
          <small>예시</small>
        </div>
        {/* 검색창 오른쪽 빈 자리를 광고 자리로 쓴다(화면 1024px 이상에서만 보인다).
            아직 실제 광고가 없어 광고 문의 안내를 띄운다. 광고가 생기면 문구와 이동 주소만 바꾸면 된다. */}
        <Link className="home-ad" to="/inquiries">
          <span className="home-ad-badge">광고</span>
          <strong>공연·굿즈 소식을 팬들에게 알려 보세요</strong>
          <span className="home-ad-more">
            광고 문의 <Icon name="arrow" size={14} />
          </span>
        </Link>
      </div>
      <div className="pc-discovery-header">
        <div>
          <span className="tiny-label">{search ? '나에게 맞는 조건으로' : '함께할 순간을 기다리는'}</span>
          <h2>{search ? '도우미 검색 결과' : '이번 주, 주목할 도우미'}</h2>
          <p>{search ? `${total}명의 도우미를 찾았어요` : '꼼꼼한 안내와 좋은 후기로 눈길을 끄는 도우미예요.'}</p>
        </div>
      </div>
      <div className="pc-filterbar">
        <GuideTip />
        <div className="filter-chips">
          {quickFilters.map(([key, label]) => (
            <QuickFilter key={key} filterKey={key} label={label} selected={labels.some(([k]) => k === key)} filters={filters} onApply={setFilters} />
          ))}
        </div>
        <button className="filter-button" aria-label="상세 필터" onClick={() => setFilterOpen(true)}>
          <Icon name="filter" size={18} /> 필터
        </button>
      </div>
      <div className="pc-result-toolbar">
        <p>
          {search ? '조건에 맞는 도우미' : '지금 제일 핫한!'} <strong>{total}</strong> 명
        </p>
        <label className="sort-label">
          <select id="sort" aria-label="도우미 정렬" value={sort} onChange={(e) => setState((s) => ({ ...s, sort: e.target.value as Sort }))}>
            {sortOptions.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      {labels.length > 0 && (
        <div className="pc-applied-filters">
          {labels.map(([k, label]) => (
            <button key={k} aria-label={`${label} 필터 삭제`} onClick={() => setFilters(removeFilter(filters, k))}>
              {label} <Icon name="close" size={13} />
            </button>
          ))}
          <button onClick={reset}>전체 초기화</button>
        </div>
      )}
      <div className="home-layout pc-home-layout">
        <section>
          <div id="agent-results" className="agent-list" aria-live="polite">
            {result.status === 'loading' ? (
              <div className="empty" role="status">
                <p>도우미를 불러오는 중이에요.</p>
              </div>
            ) : result.status === 'error' ? (
              <div className="empty">
                <Icon name="info" size={40} />
                <h3>도우미를 불러오지 못했어요</h3>
                <p>{result.message}</p>
                <button type="button" className="btn primary" onClick={() => setReload((n) => n + 1)}>
                  다시 시도
                </button>
              </div>
            ) : list.length ? (
              list.map((a) => <AgentCard key={a.id} agent={a} />)
            ) : (
              <div className="empty">
                <Icon name="search" size={40} />
                <h3>조건에 맞는 도우미가 없어요</h3>
                <p>검색어나 필터를 바꿔 다시 찾아보세요.</p>
                <button type="button" className="btn primary" onClick={reset}>
                  검색과 필터 초기화
                </button>
              </div>
            )}
          </div>
          <section className="home-alert-card" aria-labelledby="home-alert-title">
            <h3 id="home-alert-title">원하는 도우미가 없나요?</h3>
            <p>조건에 맞는 도우미가 등록되면 알려드릴게요.</p>
            <button className="btn secondary" onClick={() => setAlertOpen(true)}>
              {helperAlert ? '알림 설정' : '알림 받기'}
            </button>
          </section>
        </section>
        <aside className="home-sidebar">
          <div className="guide-card">
            <div className="guide-icon">
              <Icon name="shield" size={26} />
            </div>
            <span className="tiny-label">처음이어도 괜찮아요</span>
            <h2>
              찾는 순간부터
              <br />
              결과를 확인할 때까지.
            </h2>
            <GuideSteps />
            <button className="guide-link" onClick={() => navigate('/guide')}>
              이용 방법 자세히 보기 <Icon name="arrow" size={17} />
            </button>
          </div>
        </aside>
      </div>
      {filterOpen && (
        <FilterModal
          filters={filters}
          query={query}
          sort={sort}
          onClose={() => setFilterOpen(false)}
          onApply={(f) => {
            setFilters(f);
            setFilterOpen(false);
          }}
        />
      )}
      {alertOpen && (
        <Modal title="도우미 알림 설정" onClose={() => setAlertOpen(false)}>
          <form id="helper-alert-form" onSubmit={saveAlert}>
            <p className="prose">현재 검색어와 필터 조건으로 새 도우미 알림을 설정해요.</p>
            <label className="check-row" style={{ margin: '24px 0' }}>
              <input type="checkbox" name="enabled" defaultChecked={helperAlert} />
              조건에 맞는 도우미 알림 받기
            </label>
            <p className="record-note">체험용 설정이며 실제 알림은 발송되지 않아요.</p>
            <div className="modal-actions">
              <button type="submit" className="btn primary">
                저장하기
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
