import type { Promo } from './promos';
import './promo-banner.css';

/** 배너 문구는 브라우저가 그리는 텍스트로, 장식만 벡터로 표시한다. */
export function PromoBanner({ promo }: { promo: Promo }) {
  return <div className={`promo-banner promo-${promo.id}`}>
    <div className="promo-banner-copy">
      <span className="promo-banner-badge">{promo.badge}</span>
      <strong className="promo-banner-title">{promo.title}{promo.emphasis && <em>{promo.emphasis}</em>}</strong>
      <span className="promo-banner-description">{promo.description}</span>
    </div>
    <div className="promo-banner-art" aria-hidden="true">
      <svg viewBox="0 0 120 110" fill="none" focusable="false">
        <g transform="rotate(10 60 55)">
          <path d="M21 12h82a7 7 0 0 1 7 7v29a8 8 0 0 0 0 16v27a7 7 0 0 1-7 7H21a7 7 0 0 1-7-7V64a8 8 0 0 0 0-16V19a7 7 0 0 1 7-7Z" fill="#eee5d1" />
        </g>
        <g transform="rotate(-8 60 55)">
          <path d="M13 23h89a7 7 0 0 1 7 7v24a8 8 0 0 0 0 16v24a7 7 0 0 1-7 7H13a7 7 0 0 1-7-7V70a8 8 0 0 0 0-16V30a7 7 0 0 1 7-7Z" fill="#fffaf0" />
          <path d="M13 23h62v18H6V30a7 7 0 0 1 7-7Z" fill="var(--promo-accent)" />
          <path d="M77 30v63" stroke="#d4c6ac" strokeWidth="2" strokeDasharray="2 5" />
          <path d="M84 43v41m5-41v41m4-41v41m6-41v41" stroke="#303744" strokeWidth="2" />
          <path d="m16 32 3 3 5-5m6 2h31" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
      <span>{promo.ticketLabel}</span>
    </div>
  </div>;
}
