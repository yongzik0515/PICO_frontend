import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { searchAgents, usePlatforms } from './agent';
import { Calendar } from './Calendar';
import { emptyFilters, type Filters, type Sort } from './filters';
import './filter-modal.css';

// 프로토타입 discovery-filters.js의 빠른 필터 팝오버와 상세 필터 모달
type QuickKey = 'price' | 'date' | 'rating' | 'success';
const quickTitles: Record<QuickKey, string> = { price: '착수비', date: '예매 날짜', rating: '별점', success: '성공률' };

function priceError(min: number, max: number) {
  const invalid = !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0 || !Number.isInteger(min) || !Number.isInteger(max) || (max > 0 && max < min);
  return invalid ? '최소·최대 금액을 0원 이상의 정수로 입력해 주세요. 최대 금액은 최소 금액 이상이어야 해요.' : '';
}

function PriceInputs({ min, max, error, onChange }: { min: number; max: number; error: string; onChange: (min: number, max: number) => void }) {
  return (
    <>
      <div className="filter-price-inputs">
        <label>
          <span className="sr-only">최소 착수비</span>
          <input name="min" type="number" min="0" step="1" placeholder="최소 금액" value={min || ''} aria-label="최소 착수비" onChange={(e) => onChange(Number(e.target.value), max)} />
        </label>
        <span>–</span>
        <label>
          <span className="sr-only">최대 착수비</span>
          <input name="max" type="number" min="0" step="1" placeholder="최대 금액" value={max || ''} aria-label="최대 착수비" onChange={(e) => onChange(min, Number(e.target.value))} />
        </label>
      </div>
      <p className="filter-error" aria-live="polite">
        {error}
      </p>
    </>
  );
}

export function QuickFilter({
  filterKey,
  label,
  selected,
  filters,
  onApply,
}: {
  filterKey: QuickKey;
  label: string;
  selected: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState('');
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    anchor.current?.querySelector<HTMLElement>('#quick-filter input, #quick-filter button')?.focus();
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

  function commit(f: Filters) {
    onApply(f);
    setOpen(false);
    button.current?.focus();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (filterKey === 'price') {
      const message = priceError(draft.min, draft.max);
      setError(message);
      if (message) return;
    }
    commit(draft);
  }

  const title = quickTitles[filterKey];
  return (
    <div className="quick-filter-anchor" ref={anchor}>
      <button
        ref={button}
        className={`chip ${selected ? 'selected' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setDraft(structuredClone(filters));
            setError('');
          }
          setOpen(!open);
        }}
      >
        {label}
        <Icon name="down" size={13} />
      </button>
      {open && (
        <div id="quick-filter" className={`quick-filter quick-${filterKey}`} role="dialog" aria-label={`${title} 필터`}>
          <h3>{title}</h3>
          <form noValidate onSubmit={submit}>
            {filterKey === 'price' && <PriceInputs min={draft.min} max={draft.max} error={error} onChange={(min, max) => setDraft({ ...draft, min, max })} />}
            {filterKey === 'date' && (
              <>
                <p className="filter-help">여러 날짜를 선택할 수 있어요.</p>
                <Calendar dates={draft.dates} onChange={(dates) => setDraft({ ...draft, dates })} />
              </>
            )}
            {(filterKey === 'rating' || filterKey === 'success') && (
              <div className="filter-option-list">
                {[0, ...(filterKey === 'rating' ? [1, 2, 3, 4, 5] : [50, 60, 70, 80, 90])].map((n) => (
                  <button key={n} type="button" aria-pressed={Number(filters[filterKey]) === n} onClick={() => commit({ ...filters, [filterKey]: n })}>
                    {n ? (filterKey === 'rating' ? `${n}점 이상` : `${n}% 이상`) : '전체'}
                    {Number(filters[filterKey]) === n && <Icon name="check" size={16} />}
                  </button>
                ))}
              </div>
            )}
            {(filterKey === 'date' || filterKey === 'price') && (
              <div className="quick-filter-actions">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setDraft(filterKey === 'date' ? { ...draft, dates: [] } : { ...draft, min: 0, max: 0 });
                  }}
                >
                  초기화
                </button>
                <button type="submit" className="btn primary">
                  적용
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

// 적용 전 조건으로 서버에 다시 검색해 'N명 보기' 숫자를 채운다. 조회 중이거나 실패하면 숫자 없이 '보기'만 보여 준다.
function useResultCount(query: string, sort: Sort, f: Filters) {
  const platforms = usePlatforms();
  const [count, setCount] = useState<number | null>(null);
  const key = JSON.stringify([query, sort, f, platforms]);
  useEffect(() => {
    let alive = true;
    setCount(null);
    const timer = setTimeout(() => {
      searchAgents(query, sort, f, platforms).then(
        (r) => alive && setCount(r.total),
        () => alive && setCount(null),
      );
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // key에 모든 입력이 들어 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return count;
}

export function FilterModal({
  filters,
  query,
  sort,
  onApply,
  onClose,
}: {
  filters: Filters;
  query: string;
  sort: Sort;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const knownSites = usePlatforms().map((p) => p.name);
  const initialOther = filters.sites.filter((s) => !knownSites.includes(s));
  const [f, setF] = useState<Filters>(() => ({ ...structuredClone(filters), sites: filters.sites.filter((s) => knownSites.includes(s)) }));
  const [otherEnabled, setOtherEnabled] = useState(initialOther.length > 0);
  const [otherSite, setOtherSite] = useState(initialOther.join(', '));
  const [errors, setErrors] = useState({ price: '', success: '', other: '' });
  const [calendarKey, setCalendarKey] = useState(0);
  const ratingOptions = [...new Set([0, 4, 4.5, 4.8, ...(filters.rating ? [Number(filters.rating)] : [])])].sort((a, b) => a - b);

  const result = (): Filters => ({ ...f, sites: [...f.sites, ...(otherEnabled && otherSite.trim() ? [otherSite.trim()] : [])] });
  const count = useResultCount(query, sort, result());

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const price = priceError(f.min, f.max);
    const successInput = form.elements.namedItem('success') as HTMLInputElement;
    const validSuccess = successInput.validity.valid && Number.isFinite(f.success) && f.success >= 0 && f.success <= 100;
    const validOther = !otherEnabled || !!otherSite.trim();
    setErrors({ price, success: validSuccess ? '' : '성공률을 0~100 사이로 입력해 주세요.', other: validOther ? '' : '예매처 이름을 입력해 주세요.' });
    const focus = (name: string) => (form.elements.namedItem(name) as HTMLElement | null)?.focus();
    if (!validSuccess) return focus('success');
    if (price) return focus('max');
    if (!validOther) return focus('otherSite');
    onApply(result());
  }

  return (
    <Modal title="원하는 도우미 찾기" onClose={onClose} className="discovery-filter-modal">
      <form id="filter-form" noValidate onSubmit={submit}>
        <section className="filter-section">
          <h3>별점</h3>
          <div className="filter-rating-options">
            {ratingOptions.map((n) => (
              <button key={n} type="button" className={`chip ${Number(f.rating) === n ? 'selected' : ''}`} aria-pressed={Number(f.rating) === n} onClick={() => setF({ ...f, rating: n })}>
                {n ? n.toFixed(1) + ' 이상' : '전체'}
              </button>
            ))}
          </div>
        </section>
        <section className="filter-section">
          <div className="filter-section-title">
            <label htmlFor="filter-success-input">성공률</label>
            <span>{Number.isFinite(f.success) ? f.success : 0}% 이상</span>
          </div>
          <div className="filter-percent-input">
            <input
              id="filter-success-input"
              name="success"
              type="number"
              min="0"
              max="100"
              step="any"
              value={f.success || ''}
              placeholder="0"
              aria-label="최소 성공률"
              onChange={(e) => setF({ ...f, success: Number(e.target.value) })}
            />
            <span>% 이상</span>
          </div>
          <p className="filter-success-error filter-error" aria-live="polite">
            {errors.success}
          </p>
        </section>
        <section className="filter-section">
          <h3>착수비</h3>
          <PriceInputs min={f.min} max={f.max} error={errors.price} onChange={(min, max) => setF({ ...f, min, max })} />
        </section>
        <section className="filter-section">
          <h3>가능 예매처</h3>
          <div className="filter-sites">
            {knownSites.map((s) => (
              <label key={s} className="chip">
                <input
                  name="sites"
                  type="checkbox"
                  value={s}
                  checked={f.sites.includes(s)}
                  onChange={(e) => setF({ ...f, sites: e.target.checked ? [...f.sites, s] : f.sites.filter((x) => x !== s) })}
                />
                {s}
              </label>
            ))}
            <label className="chip">
              <input name="otherEnabled" type="checkbox" checked={otherEnabled} onChange={(e) => setOtherEnabled(e.target.checked)} />
              기타
            </label>
          </div>
          <label className="filter-other" hidden={!otherEnabled}>
            예매처 직접 입력
            <input name="otherSite" value={otherSite} required={otherEnabled} placeholder="예매처 이름 입력" onChange={(e) => setOtherSite(e.target.value)} />
            <span className="filter-other-error filter-error" aria-live="polite">
              {errors.other}
            </span>
          </label>
        </section>
        <section className="filter-section">
          <h3>예매 날짜</h3>
          <p className="filter-help">여러 날짜를 선택할 수 있어요. 선택한 날짜 중 가능한 도우미를 찾아요.</p>
          <Calendar key={calendarKey} dates={f.dates} onChange={(dates) => setF({ ...f, dates })} />
        </section>
        <div className="filter-detail-actions">
          <button
            type="button"
            id="filter-reset"
            onClick={() => {
              setF(emptyFilters());
              setOtherEnabled(false);
              setOtherSite('');
              setErrors({ price: '', success: '', other: '' });
              setCalendarKey((k) => k + 1);
            }}
          >
            초기화
          </button>
          <button type="submit" className="btn primary" id="filter-apply">
            {count === null ? '보기' : `${count}명 보기`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
