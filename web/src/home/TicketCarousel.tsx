import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBanners, type Banner } from './banners';
import './ticket-carousel.css';

// 홈 히어로의 티켓 스텁 캐러셀.
// 배너 내용은 banners.ts에서만 관리한다. 이 파일은 보여 주는 방법만 담당한다.

const AUTOPLAY_MS = 4000; // 자동으로 다음 배너로 넘어가기까지 걸리는 시간
const MOVE_MS = 600; // 카드 이동 시간(CSS --tsb-move와 같게)
const DOT_COUNT = 12; // 절취선 점 개수(자동 넘김 진행 표시를 겸한다)
const CLONES = 2; // 무한 루프용으로 앞뒤에 붙이는 복제본 수(넓은 화면에서 끝이 비어 보이지 않게 2장씩)
const SIDE_MIN = 40; // 화면이 좁아도 양옆 카드가 최소 이만큼은 보이게 한다
const MOBILE_MAX = 768;
const FALLBACK_COLOR = '#2B2F6E';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DRAG_START = 6; // 이만큼(px) 가로로 움직여야 드래그로 본다(그 전에는 클릭)
const DRAG_GO = 0.15; // 카드 폭의 15% 넘게 끌면 다음·이전 배너로 넘긴다

// 티켓 오픈 일시와 오늘을 날짜 단위로 비교해 D-5 / D-DAY / 오픈 중을 만든다.
function ddayLabel(openAt: string, now: Date) {
  const open = new Date(openAt);
  if (Number.isNaN(open.getTime())) return { text: '미정', isWord: true };
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(open.getFullYear(), open.getMonth(), open.getDate());
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (days > 0) return { text: `D-${days}`, isWord: false };
  if (days === 0) return { text: 'D-DAY', isWord: true };
  return { text: '오픈 중', isWord: true };
}

// 2026-10-08T14:00 → ['2026.10.08 (목)', '14:00'] (스텁 폭에 따라 한 줄 또는 두 줄로 놓는다)
function openAtLabel(openAt: string) {
  const d = new Date(openAt);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return [`${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEKDAYS[d.getDay()]})`, `${pad(d.getHours())}:${pad(d.getMinutes())}`];
}

// 대표 색상이 비어 있으면 이미지 왼쪽 가장자리(너비의 4%)의 평균 색을 뽑는다.
// 흰 글자가 올라가므로 너무 밝은 색은 어둡게 낮춘다. 실패하면 FALLBACK_COLOR.
const colorCache = new Map<string, string>();
function edgeColor(img: HTMLImageElement): string {
  const cached = colorCache.get(img.src);
  if (cached) return cached;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 24;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !img.naturalWidth) return FALLBACK_COLOR;
    ctx.drawImage(img, 0, 0, Math.max(1, Math.round(img.naturalWidth * 0.04)), img.naturalHeight, 0, 0, 4, 24);
    const data = ctx.getImageData(0, 0, 4, 24).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    [r, g, b] = [r / n, g / n, b / n];
    // 밝기(0~1)가 0.36을 넘으면 같은 색조로 어둡게 맞춘다(흰 글자 대비 확보).
    const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (light > 0.36) {
      const k = 0.36 / light;
      [r, g, b] = [r * k, g * k, b * k];
    }
    const hex = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    colorCache.set(img.src, hex);
    return hex;
  } catch {
    return FALLBACK_COLOR;
  }
}

type Size = { view: number; left: number; card: number; gap: number };

export function TicketCarousel() {
  const navigate = useNavigate();
  const banners = useMemo(() => getBanners(), []);
  const count = banners.length;
  const loop = count > 1;

  // '동작 줄이기'를 켠 사용자에게는 자동 넘김을 처음부터 멈춰 둔다.
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  // 무한 루프를 위해 앞뒤에 복제본을 붙인다: [끝 2장, 전체, 처음 2장]
  const slides = useMemo(() => (loop ? [...banners.slice(-CLONES), ...banners, ...banners.slice(0, CLONES)] : banners), [banners, loop]);
  const first = loop ? CLONES : 0;

  const [index, setIndex] = useState(first); // slides 기준 위치
  const [jumping, setJumping] = useState(false); // 복제본에서 진짜 위치로 순간 이동하는 중인지
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false); // 키보드로 카드에 들어와 있으면 자동 넘김을 멈춘다(일시정지 버튼 대신)
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(true);
  const [filled, setFilled] = useState(0); // 절취선에서 흰색으로 채워진 점 개수

  const real = (((index - first) % count) + count) % count; // 지금 가운데 있는 진짜 배너 번호(0부터)
  const running = !reduceMotion && !hovered && !focused && !dragging && visible && loop;

  const go = useCallback((step: number) => {
    setJumping(false);
    setIndex((i) => i + step);
    setFilled(0); // 직접 넘기면 진행 표시를 처음부터
  }, []);

  // 복제본에 도착하면 이동이 끝난 뒤 트랜지션을 끈 채 같은 배너의 진짜 위치로 옮겨 끊김 없이 이어 준다.
  useEffect(() => {
    if (!loop || (index >= first && index < first + count)) return;
    const t = setTimeout(() => {
      setJumping(true);
      setIndex((i) => (i < first ? i + count : i - count));
    }, MOVE_MS);
    return () => clearTimeout(t);
  }, [index, first, count, loop]);

  // 순간 이동을 화면에 그린 뒤에 트랜지션을 다시 켠다(프레임 두 번 대기).
  useEffect(() => {
    if (!jumping) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setJumping(false));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [jumping]);

  // 브라우저 탭이 안 보이면 타이머를 멈춘다.
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 절취선 진행 표시: 4초 동안 점이 하나씩 채워지고, 다 차면 다음 카드로 넘어간다. 멈추면 채운 데서 이어 간다.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const startedAt = performance.now() - (filled / DOT_COUNT) * AUTOPLAY_MS;
    const tick = (now: number) => {
      const ratio = (now - startedAt) / AUTOPLAY_MS;
      if (ratio >= 1) {
        setIndex((i) => i + 1);
        setFilled(0);
        return;
      }
      setFilled(Math.floor(ratio * DOT_COUNT));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // filled는 '이어서 진행'할 시작점을 잡는 용도라 의존성에 넣지 않는다(넣으면 매 프레임 재시작된다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, index]);

  // 크기 계산.
  // - 캐러셀 영역만 본문(최대 1080px) 밖으로 넓혀 화면 전체 너비를 쓴다. 기존 컨테이너는 그대로 두고,
  //   본문 왼쪽 끝 위치(left)만큼 왼쪽으로 당기고 너비를 '스크롤바를 뺀 실제 화면 폭'(clientWidth)으로 맞춰 가로 스크롤을 막는다.
  // - 가운데 카드 = 본문 폭(1080px)이라 검색창 좌우 끝선과 맞는다. 화면이 좁아 양옆 카드가 40px보다 덜 보이면 카드를 줄인다.
  // - 모바일(768px 이하)은 화면의 88%.
  const hostRef = useRef<HTMLDivElement>(null);
  const keyboardNavigation = useRef(false);
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const view = document.documentElement.clientWidth;
      const mobile = view <= MOBILE_MAX;
      const gap = mobile ? 8 : 24;
      const card = mobile ? Math.round(view * 0.88) : Math.floor(Math.min(box.width, view - 2 * (gap + SIDE_MIN)));
      setSize({ view, left: box.left, card, gap });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // 방향키 이동과 복제본 → 원본 전환 모두 새 활성 카드로 포커스를 이어 준다.
  // 사용자가 캐러셀을 떠났거나 포인터로 조작하면 포커스를 가져오지 않는다.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (keyboardNavigation.current && host?.contains(document.activeElement)) {
      host.querySelector<HTMLElement>('.tsb-slide.is-active .tsb-card')?.focus({ preventScroll: true });
    }
  }, [index]);

  // 드래그(마우스·터치 공통): 누른 채 가로로 끌면 카드가 따라오고, 카드 폭의 15% 넘게 끌면 넘긴다.
  // 끄는 동안의 위치는 리렌더 없이 트랙의 CSS 변수(--tsb-drag)로만 옮긴다. 세로로 끌면 페이지 스크롤에 맡긴다(touch-action: pan-y).
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; moving: boolean } | null>(null);
  const dragged = useRef(false); // 방금 끌었으면 손을 뗄 때 생기는 클릭을 무시한다
  const setOffset = (px: number) => trackRef.current?.style.setProperty('--tsb-drag', `${px}px`);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    keyboardNavigation.current = false;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moving: false };
    dragged.current = false;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moving) {
      if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(e.clientY - d.y)) return;
      d.moving = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setOffset(dx);
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moving) return;
    const dx = e.clientX - d.x;
    dragged.current = true;
    setDragging(false);
    setOffset(0);
    if (Math.abs(dx) > (size?.card ?? 300) * DRAG_GO) go(dx < 0 ? 1 : -1);
  };
  const onClickCapture = (e: MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  // 키보드: 가운데 카드에 포커스가 있을 때 좌우 화살표로 이동
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      keyboardNavigation.current = true;
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      keyboardNavigation.current = true;
      e.preventDefault();
      go(1);
    }
  };

  const open = useCallback(
    (href: string) => {
      if (href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        target?.focus({ preventScroll: true });
      } else navigate(href);
    },
    [navigate, reduceMotion],
  );

  if (!count) return null;
  const now = new Date();
  const vars = size
    ? ({ '--tsb-view': `${size.view}px`, '--tsb-left': `${size.left}px`, '--tsb-card-w': `${size.card}px`, '--tsb-gap': `${size.gap}px` } as CSSProperties)
    : undefined;

  return (
    <div
      className="tsb"
      ref={hostRef}
      role="region"
      aria-roledescription="캐러셀"
      aria-label="티켓 오픈 예정 공연"
      style={vars}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          keyboardNavigation.current = false;
          setFocused(false);
        }
      }}
    >
      <div
        className="tsb-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        <div ref={trackRef} className="tsb-track" data-jumping={jumping} data-dragging={dragging} style={{ '--tsb-i': index } as CSSProperties}>
          {slides.map((banner, i) => (
            <Slide
              key={`${banner.id}-${i}`}
              banner={banner}
              position={i === index ? 'active' : i < index ? 'prev' : 'next'}
              eager={i === first} /* 첫 배너 이미지만 바로 불러오고 나머지는 지연 로딩 */
              now={now}
              page={((((i - first) % count) + count) % count) + 1}
              total={count}
              filled={filled}
              onPick={() => go(i - index)}
              onOpen={() => open(banner.href)}
            />
          ))}
        </div>
      </div>
      <p className="tsb-visually-hidden" aria-live="polite">{`${real + 1}번째 배너, ${banners[real].title}`}</p>
    </div>
  );
}

function Slide({
  banner,
  position,
  eager,
  now,
  page,
  total,
  filled,
  onPick,
  onOpen,
}: {
  banner: Banner;
  position: 'active' | 'prev' | 'next';
  eager: boolean;
  now: Date;
  page: number;
  total: number;
  filled: number;
  onPick: () => void;
  onOpen: () => void;
}) {
  const active = position === 'active';
  const [imgOk, setImgOk] = useState(true); // 이미지 파일이 없으면 배경색만 남긴다
  const [autoColor, setAutoColor] = useState<string | null>(null);
  const color = banner.color || autoColor || FALLBACK_COLOR;
  const dday = ddayLabel(banner.ticketOpenAt, now);
  const openAt = openAtLabel(banner.ticketOpenAt);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className={`tsb-slide is-${position}`}
      role="group"
      aria-roledescription="배너"
      aria-label={`${page} / ${total}`}
      aria-hidden={!active}
      // 가운데 카드를 누르면 배너 링크로 가고(도우미 찾기), 양옆 카드를 누르면 그 방향으로 넘어간다.
      onClick={active ? onOpen : onPick}
    >
      <div
        className="tsb-card"
        style={{ '--tsb-color': color } as CSSProperties}
        role={active ? 'link' : undefined}
        tabIndex={active ? 0 : -1}
        aria-label={active ? `${banner.title} 도우미 찾기` : undefined}
        onKeyDown={(e) => {
          if (!active || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          onOpen();
        }}
      >
        <div className="tsb-main">
          {imgOk && (
            <img
              className="tsb-img"
              src={banner.image}
              alt={banner.imageAlt}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              onLoad={(e) => !banner.color && setAutoColor(edgeColor(e.currentTarget))}
              onError={() => setImgOk(false)}
            />
          )}
          <div className="tsb-copy">
            <span className="tsb-chip tsb-rise" style={{ '--d': 0 } as CSSProperties}>
              {banner.category}
            </span>
            <div className="tsb-copy-mid">
              <h2 className="tsb-title tsb-rise" style={{ '--d': 1 } as CSSProperties}>
                {banner.title}
              </h2>
              <p className="tsb-desc tsb-rise" style={{ '--d': 2 } as CSSProperties}>
                {banner.description}
              </p>
              <p className="tsb-meta tsb-rise" style={{ '--d': 3 } as CSSProperties}>
                {banner.venue}
                <i aria-hidden="true">|</i>
                {banner.period}
              </p>
            </div>
          </div>
        </div>

        {/* 절취선: 점이 위에서부터(모바일은 왼쪽부터) 채워지며 자동 넘김 진행도를 보여 준다 */}
        <div className="tsb-perf" aria-hidden="true">
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <span key={i} className={`tsb-dot${active && i < filled ? ' is-filled' : ''}`} />
          ))}
        </div>

        <div className="tsb-stub">
          <div className="tsb-stub-top">
            <span className="tsb-open-label">TICKET OPEN</span>
            <strong className={`tsb-dday${dday.isWord ? ' is-word' : ''}`}>{dday.text}</strong>
            {openAt && (
              <span className="tsb-open-at">
                <span>{openAt[0]}</span> <span>{openAt[1]}</span>
              </span>
            )}
          </div>
          <span className="tsb-count">
            {pad(page)} / {pad(total)}
          </span>
        </div>

        <div className="tsb-dim" aria-hidden="true" />
      </div>
    </div>
  );
}
