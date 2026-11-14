import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { activePromos, type Promo } from './promos';
import { PromoBanner } from './PromoBanner';
import './promo-slot.css';

// 배너 자동 전환 간격(ms). 운영 시 이 값을 조정한다.
export const PROMO_ROTATE_MS = 3000;

// 검색창 옆(1024px 이상) 또는 검색창 아래(그보다 좁을 때)의 이벤트·광고 자리. 배너를 3초마다 바꿔 보여 준다.
// 마우스를 올리거나 키보드로 들어오면 멈추고, '동작 줄이기' 설정이면 처음 배너만 보여 준다.
const catchtablePromo: Promo = {
  id: 'catchtable',
  badge: '식당 예약',
  title: '캐치테이블 예약도 피코에서',
  description: '예약을 도와줄 도우미 찾기 →',
  ticketLabel: '예약',
  alt: '캐치테이블 예약 도우미 찾기',
  to: '/',
};

export function PromoSlot({ onCatchtableSearch }: { onCatchtableSearch: () => void }) {
  const [list] = useState(() => activePromos());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (paused || calm || list.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % list.length), PROMO_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, calm, list.length]);

  if (!list.length) return null;
  const current = list[index % list.length];

  return (
    <div className="home-promo-stack">
      <div
        className="home-promo"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {/* 모든 배너를 유지하고 투명도만 바꿔 전환 중 높이 변화와 빈 화면을 막는다. */}
        <Link className="home-promo-link" to={current.to} aria-label={current.alt}>
          {list.map((p) => (
            <div key={p.id} className={`home-promo-slide${p.id === current.id ? ' is-active' : ''}`} aria-hidden="true">
              <PromoBanner promo={p} />
            </div>
          ))}
        </Link>
        {list.length > 1 && (
          <div className="home-promo-dots">
            {list.map((p, i) => (
              <button key={p.id} type="button" aria-label={`${i + 1}번째 배너 보기`} aria-current={i === index % list.length} className={i === index % list.length ? 'on' : ''} onClick={() => setIndex(i)} />
            ))}
          </div>
        )}
      </div>
      <button className="home-promo-link home-promo-search" type="button" onClick={onCatchtableSearch} aria-label={catchtablePromo.alt}>
        <PromoBanner promo={catchtablePromo} />
      </button>
    </div>
  );
}
