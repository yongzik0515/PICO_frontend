import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

const outside = (el: Element, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  return x < r.left || x > r.right || y < r.top || y > r.bottom;
};

// 프로토타입 openModal()의 <dialog class="modal"> 마크업을 그대로 쓴다.
export function Modal({
  title,
  onClose,
  wide = false,
  className = '',
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const pressedOutside = useRef(false);

  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.body.classList.add('modal-open');
    return () => {
      dialog.close();
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''} ${className}`}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      // 창 안에서 누른 채(글자 선택 드래그 등) 바깥에서 떼도 click은 dialog에서 나므로, 누르기 시작한 곳도 바깥일 때만 닫는다.
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget && outside(e.currentTarget, e.clientX, e.clientY);
      }}
      onClick={(e) => {
        const started = pressedOutside.current;
        pressedOutside.current = false;
        if (started && e.target === e.currentTarget && outside(e.currentTarget, e.clientX, e.clientY)) onClose();
      }}
    >
      <header className="modal-header">
        <h2 id={headingId}>{title}</h2>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>,
    document.body,
  );
}
