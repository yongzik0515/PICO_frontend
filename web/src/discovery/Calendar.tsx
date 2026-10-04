import { useState } from 'react';
import { Icon } from '../ui/Icon';

// 프로토타입 discovery-filters.js의 calendar(). 여러 날짜를 고른다.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function Calendar({ dates, onChange }: { dates: string[]; onChange: (dates: string[]) => void }) {
  const [month, setMonth] = useState(() => {
    const first = dates[0] ? new Date(dates[0] + 'T12:00:00') : new Date();
    return new Date(first.getFullYear(), first.getMonth(), 1);
  });
  const today = iso(new Date());
  const y = month.getFullYear(),
    m = month.getMonth(),
    offset = month.getDay(),
    last = new Date(y, m + 1, 0).getDate();

  return (
    <div data-calendar="">
      <div className="filter-calendar-nav">
        <button type="button" aria-label="이전 달" onClick={() => setMonth(new Date(y, m - 1, 1))}>
          <Icon name="chevron" size={14} />
        </button>
        <span aria-live="polite">
          {y}년 {m + 1}월
        </span>
        <button type="button" aria-label="다음 달" onClick={() => setMonth(new Date(y, m + 1, 1))}>
          <Icon name="chevron" size={14} />
        </button>
        {/* 선택 해제는 달 표시 줄의 맨 오른쪽에 둔다(달 표시는 가운데에 그대로 남는다). */}
        <button type="button" className="calendar-clear" onClick={() => onChange([])}>
          선택 해제
        </button>
      </div>
      <div className="filter-calendar-grid">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <span key={d} className="calendar-weekday">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={'blank' + i}></span>
        ))}
        {Array.from({ length: last }, (_, i) => {
          const day = i + 1,
            date = iso(new Date(y, m, day)),
            selected = dates.includes(date);
          return (
            <button
              key={date}
              type="button"
              aria-label={`${y}년 ${m + 1}월 ${day}일`}
              aria-pressed={selected}
              disabled={date < today && !selected}
              className={`${selected ? 'selected' : ''} ${date === today ? 'today' : ''}`}
              onClick={() => onChange(selected ? dates.filter((d) => d !== date) : [...dates, date].sort())}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
