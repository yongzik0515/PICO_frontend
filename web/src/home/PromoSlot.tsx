import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { activePromos } from './promos';
import './promo-slot.css';

const ROTATE_MS = 6000;

// 검색창 옆(1024px 이상) 또는 검색창 아래(그보다 좁을 때)의 이벤트·광고 자리. 이미지 배너를 6초마다 바꿔 보여 준다.
// 마우스를 올리거나 키보드로 들어오면 멈추고, '동작 줄이기' 설정이면 처음 배너만 보여 준다.
export function PromoSlot() {
  const [list] = useState(() => activePromos());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (paused || calm || list.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % list.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, calm, list.length]);

  if (!list.length) return null;
  const current = list[index % list.length];

  return (
    <div
      className="home-promo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* key를 바꿔 배너가 바뀔 때마다 부드럽게 나타나게 한다. */}
      <Link key={current.id} className="home-promo-link" to={current.to}>
        <PromoImage image={current.image} alt={current.alt} />
      </Link>
      {list.length > 1 && (
        <div className="home-promo-dots">
          {list.map((p, i) => (
            <button key={p.id} type="button" aria-label={`${i + 1}번째 배너 보기`} aria-current={i === index % list.length} className={i === index % list.length ? 'on' : ''} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromoImage({ image, alt }: { image: string; alt: string }) {
  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={`/banners/${image}-pc.png`} />
      <img src={`/banners/${image}-mobile.png`} alt={alt} width="343" height="60" draggable={false} />
    </picture>
  );
}

// 검색창 아래 빈 자리를 채우는 인사말 이미지(1024px 이상에서만 보인다).
export function HomeNote() {
  return <img className="home-note" src="/banners/note-pc.png" alt="와주셔서 감사합니다. 이제 막 문을 열어서 저희도 많이 떨려요. 불편한 점은 편하게 알려 주세요." width="306" height="120" draggable={false} />;
}
