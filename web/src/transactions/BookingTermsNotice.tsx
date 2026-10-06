import { useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../ui/Modal';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

/** 수락 화면에서는 안내를 닫은 다음 확인창을 열어 모달이 겹치지 않게 한다. */
export function BookingTermsNotice({ children }: { children?: ReactNode }) {
  const { userKey } = useAuth();
  const storageKey = `pico:booking-terms-notice:2026-10-06:${userKey}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(storageKey) !== today(); }
    catch { return true; }
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const close = () => setOpen(false);
  function hideToday() {
    try {
      localStorage.setItem(storageKey, today());
      close();
    } catch { setSaveFailed(true); }
  }
  return (
    <>
      {!children && <button type="button" className="text-link" onClick={() => setOpen(true)}>예매처 약관 및 유의사항 보기</button>}
      {open ? (
        <Modal title="예매처 약관 및 유의사항" onClose={close}>
          <p className="prose"><strong>요청·수락 전 예매처 약관을 확인해 주세요</strong></p>
          <p className="prose">이용자와 도우미는 예매처 약관과 공연·행사별 정책에서 대리 예매, 계정 공유, 본인 확인·티켓 수령 조건을 직접 확인하고 준수해야 합니다. 금지된 방식의 요청이나 수락은 진행하지 마세요.</p>
          <p className="prose">이를 위반하면 예매 취소, 계정 이용 제한, 티켓 수령 또는 입장 거절 등의 불이익이 발생할 수 있습니다. PICO에 예매처·공연이 표시되거나 요청이 수락되었다고 해서 예매처의 허용·제휴 또는 예매 성공을 보증하는 것은 아닙니다.</p>
          <p className="prose">PICO는 이용자와 도우미를 연결하는 중개 플랫폼입니다. PICO의 귀책사유 없이 당사자의 예매처 약관·정책 위반으로 발생한 불이익에 대해서는 책임을 부담하지 않습니다. 다만 PICO 자신의 의무 위반이나 귀책사유에 따른 책임 및 관계 법령상 책임은 부담합니다.</p>
          {saveFailed && <p className="field-error" role="alert">설정을 저장하지 못했어요. ‘닫기’를 눌러 계속할 수 있어요.</p>}
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={hideToday}>오늘 하루 보지 않기</button>
            <button type="button" className="btn primary" onClick={close}>닫기</button>
          </div>
        </Modal>
      ) : children}
    </>
  );
}
