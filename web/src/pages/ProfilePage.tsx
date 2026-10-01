import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { useAppState } from '../AppState';
import { toAgent, type Agent } from '../discovery/agent';
import { resultNames, type RequestResult } from '../transactions/model';
import { kstDay } from '../transactions/ui';
import { Avatar, Badges, FavoriteButton } from '../discovery/AgentCard';
import { Icon } from '../ui/Icon';
import { ImagePreview } from '../ui/ImagePreview';
import { PageTitle } from '../ui/PageTitle';
import { money, responseTime, successRate } from '../ui/format';
import { useToast } from '../ui/Toast';

// 프로토타입 discovery.js의 profile(). GET /api/agents/{id}와 GET /api/agents/{id}/reviews를 쓴다.
interface Review {
  date: string;
  rating: number;
  text: string;
  bookingResult?: RequestResult;
  imageUrl?: string;
}

// 명세의 ReviewResponse. 후기 작성자 이름은 응답에 없어 표시하지 않는다.
function toReview(r: Record<string, unknown>): Review {
  return {
    date: kstDay(String(r.reviewedAt ?? '')),
    rating: Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0))),
    text: typeof r.comment === 'string' ? r.comment : '',
    imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : undefined,
    bookingResult: ['SUCCESS', 'PARTIAL', 'FAILURE'].includes(String(r.bookingResult)) ? r.bookingResult as RequestResult : undefined,
  };
}

type Load = { status: 'loading' } | { status: 'error'; code: number; message: string } | { status: 'done'; agent: Agent; reviews: Review[] };

function useAgentProfile(id: number): Load {
  const [state, setState] = useState<Load>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    const path = { params: { path: { agentId: id } } };
    Promise.all([
      unwrap<Record<string, unknown>>(api.GET('/api/agents/{agentId}', path)),
      // 후기 목록을 못 받아도 프로필은 보여 준다.
      unwrap<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>(api.GET('/api/agents/{agentId}/reviews', { params: { path: { agentId: id }, query: { page: 0, size: 100 } } })).catch(() => []),
    ]).then(
      ([raw, reviews]) => {
        if (!alive) return;
        const rows = Array.isArray(reviews) ? reviews : (reviews.items ?? []);
        setState({ status: 'done', agent: { ...toAgent(raw), id }, reviews: rows.map(toReview) });
      },
      (e) => alive && setState({ status: 'error', code: e?.status ?? 0, message: e instanceof Error ? e.message : '프로필을 불러오지 못했어요.' }),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return state;
}

function reviewStats(rows: Review[]) {
  return {
    count: rows.length,
    average: rows.length ? (rows.reduce((n, r) => n + r.rating, 0) / rows.length).toFixed(1) : '0.0',
    counts: [5, 4, 3, 2, 1].map((n) => rows.filter((r) => r.rating === n).length),
  };
}

function ReviewList({ rows }: { rows: Review[] }) {
  const [loaded, setLoaded] = useState(20);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loaded >= rows.length || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLoaded((n) => Math.min(n + 20, rows.length));
    }, { rootMargin: '200px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loaded, rows.length]);

  return (
    <>
      <div id="profile-review-list">
        {rows.slice(0, loaded).map((r, i) => (
          <article key={i} className="review-item">
            <div className="review-author">
              <strong>이용자</strong>
              <span className="badge verified">
                <Icon name="check" size={12} />
                매칭 내역 확인
              </span>
            </div>
            <div className="review-rating-date">
              <span className="stars" aria-label={`${r.rating}점`}>
                {'★'.repeat(r.rating)}
                <span className="empty-stars">{'☆'.repeat(5 - r.rating)}</span>
              </span>
              <time dateTime={r.date}>{r.date.replaceAll('-', '.')}</time>
            </div>
            {r.bookingResult && <p className="record-note">이용자 후기 결과: {resultNames[r.bookingResult]}</p>}
            <p>{r.text}</p>
            {r.imageUrl && <ImagePreview src={r.imageUrl} alt="후기 인증 사진" className="review-photo" />}
          </article>
        ))}
      </div>
      <div id="review-sentinel" ref={sentinel} className="review-list-status" role="status">
        {loaded < rows.length ? '아래로 스크롤하면 후기가 이어져요.' : '모든 후기를 확인했어요.'}
      </div>
    </>
  );
}

export function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [{ mode }, setState] = useAppState();
  const [tab, setTab] = useState<'about' | 'reviews'>('about');
  const feedback = useRef<HTMLElement>(null);
  const load = useAgentProfile(Number(id));

  if (load.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>프로필을 불러오는 중이에요.</p>
      </div>
    );
  if (load.status === 'error')
    return (
      <div className="empty">
        <h1>{load.code === 404 || load.code === 400 ? '도우미를 찾을 수 없어요' : '프로필을 불러오지 못했어요'}</h1>
        <p>{load.code === 404 || load.code === 400 ? '목록에서 다시 선택해 주세요.' : load.message}</p>
        <button className="btn primary" onClick={() => navigate('/')}>
          도우미 찾기
        </button>
      </div>
    );

  const a = load.agent;
  const rows = load.reviews;

  const stats = reviewStats(rows);
  // 평점·후기 수는 프로필 응답의 집계를 우선한다. 후기 목록은 최대 100개만 받고, 후기 API가 실패할 수도 있다.
  const summary = a.reviews ? { average: a.rating.toFixed(1), count: a.reviews } : { average: stats.average, count: stats.count };
  const reviews = tab === 'reviews';
  const detail = a.detail || '희망하는 공연과 좌석 조건을 꼼꼼히 확인하고, 충분히 이야기한 뒤 예매를 준비해요.\n\n진행 상황과 결과를 빠르게 알려드릴게요. 모든 예매는 예매처가 허용하는 방법으로 진행해요.';
  const rowsInfo: [string, string][] = [
    ['가능 예매처', a.sites.join(' · ') || '미입력'],
    ['주로 맡는 분야', a.category || '미입력'],
    ['활동 가능 시간', a.hours || '미입력'],
    ['최소 착수비', money(a.fee) + '원'],
    ['수고비', a.successMin !== undefined || a.successMax !== undefined ? money(a.successMin ?? 0) + ' ~ ' + money(a.successMax ?? 0) + '원 · 최종 조건에서 확정' : '최종 조건에서 확정'],
    ['활동 경력', a.career + ' · 본인 작성'],
  ];

  function jumpToReviews() {
    setTab('reviews');
    requestAnimationFrame(() =>
      feedback.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }),
    );
  }

  function share() {
    navigator.clipboard
      ?.writeText(location.href)
      .then(() => toast('프로필 링크를 복사했어요.'))
      .catch(() => toast('주소 표시줄의 링크를 복사해 주세요.'));
  }

  return (
    <>
      <PageTitle title="도우미 프로필" current="상세 프로필" crumbs={[{ label: '목록', to: '/' }]} />
      <div className="detail-layout">
        <div>
          <section className="content-card profile-intro">
            <div className="profile-title">
              <Avatar agent={a} size="large" />
              <div>
                <div className="agent-title">
                  <h1>{a.name}</h1>
                  <Badges agent={a} />
                </div>
                <p>{a.intro}</p>
                <span className="rating">
                  <b>★</b>
                  <strong>{summary.average}</strong> ·{' '}
                  <button className="review-jump" onClick={jumpToReviews}>
                    후기 {summary.count}개
                  </button>
                </span>
              </div>
              <div className="profile-tools">
                <FavoriteButton agent={a} iconOnly />
                <button className="icon-btn" aria-label="프로필 링크 복사" onClick={share}>
                  <Icon name="share" />
                </button>
              </div>
            </div>
            <div className="profile-stats">
              {[
                ['성공률', successRate(a.success)],
                ['거래 횟수', a.trades + '회'],
                ['평균 응답', responseTime(a.reply)],
              ].map(([k, v]) => (
                <div key={k} className="info-tile">
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <p className="record-note">
              <Icon name="info" size={13} /> 플랫폼 거래 기록 기준 · 소개와 경력은 도우미가 직접 작성해요.
            </p>
          </section>
          <section className="content-card">
            <h2>함께하기 전에 확인하세요</h2>
            <dl className="document-rows">
              {rowsInfo.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="notice">
              <Icon name="shield" size={17} />
              연락처는 요청을 수락한 상대방에게만 공개돼요.
            </div>
          </section>
          <section className="content-card profile-feedback" id="profile-feedback" ref={feedback}>
            <div className="tabs" role="tablist" aria-label="프로필 정보">
              <button className={!reviews ? 'active' : ''} role="tab" aria-selected={!reviews} onClick={() => setTab('about')}>
                도우미 소개
              </button>
              <button className={reviews ? 'active' : ''} role="tab" aria-selected={reviews} onClick={() => setTab('reviews')}>
                거래 후기 {summary.count}
              </button>
            </div>
            {reviews ? (
              <>
                <div className="review-summary">
                  <div className="review-score">
                    <strong>{stats.average}</strong>
                    <span className="stars">★★★★★</span>
                    <small>거래 후기 {stats.count}개</small>
                  </div>
                  <div className="review-distribution" aria-label="별점 분포">
                    {stats.counts.map((count, i) => (
                      <div key={i} className="review-bar-row">
                        <span>{5 - i}점</span>
                        <div className="review-bar-track" role="meter" aria-label={`${5 - i}점 후기`} aria-valuemin={0} aria-valuemax={stats.count} aria-valuenow={count}>
                          <span style={{ width: `${stats.count ? (count / stats.count) * 100 : 0}%` }}></span>
                        </div>
                        <small>{count}개</small>
                      </div>
                    ))}
                  </div>
                </div>
                <ReviewList rows={rows} />
              </>
            ) : (
              <>
                <h3>공연을 기다리는 마음, 함께할게요.</h3>
                {/* 400자 분량까지 보이고, 넘으면 카드 안에서 스크롤한다. */}
                <p className={`prose profile-detail ${detail.length > 400 ? 'scrollable' : ''}`} style={{ whiteSpace: 'pre-line' }} tabIndex={detail.length > 400 ? 0 : undefined}>
                  {detail}
                </p>
                <p className="record-note">도우미가 직접 작성한 소개예요.</p>
              </>
            )}
          </section>
          <button className="report-link" onClick={() => navigate('/help')}>
            도움이 필요하거나 신고할 내용이 있나요?
          </button>
        </div>
        <aside className="sticky-card">
          <div className="content-card action-card">
            <span>최소 착수비</span>
            <div className="display-price">
              {money(a.fee)}
              <small>원부터</small>
            </div>
            <p>
              수고비는 성공 조건에 따라
              <br />
              도우미가 최종 조건으로 제안해요.
            </p>
            {mode === 'user' ? (
              <button type="button" className="btn primary full" onClick={() => navigate(`/quote/${a.id}`)}>
                이 도우미에게 요청하기
              </button>
            ) : (
              <button className="btn secondary full" onClick={() => setState((s) => ({ ...s, mode: 'user' }))}>
                이용자로 전환해 요청하기
              </button>
            )}
            <div className="action-assurance">
              <Icon name="shield" size={15} />
              요청은 무료예요
            </div>
          </div>
          <p className="aside-disclaimer">
            요청 → 도우미 수락 및 최종 조건 전달
            <br />→ 이용자 확인·확정 → 안전거래 조건이면 결제
          </p>
        </aside>
      </div>
    </>
  );
}
