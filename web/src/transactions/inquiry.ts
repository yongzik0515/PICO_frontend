import type { components } from '../api/schema';

// 문의 유형(POST /api/inquiries type). 이용자 문의 화면과 관리자 문의 탭이 같은 이름을 쓴다.
export type InquiryType = NonNullable<components['schemas']['InquiryCreate']['type']>;
export type RestorationReason = NonNullable<components['schemas']['InquiryCreate']['restorationReason']>;
export type PrivacyAction = NonNullable<components['schemas']['InquiryCreate']['privacyAction']>;

export const inquiryTypeNames: Record<InquiryType, string> = {
  GENERAL: '일반 문의',
  PASS_RESTORATION: '매칭권 복원 요청',
  PASS_REFUND: '매칭권 환불 요청',
  PRIVACY: '개인정보 요청',
};

// 질병·사고 등 개인 사유는 복원 사유가 아니다(서버도 거부). 객관적으로 확인되는 사유만 둔다.
export const restorationReasonNames: Record<RestorationReason, string> = {
  EVENT_CANCELLED: '공식 공연·예매 취소',
  BOOKING_SITE_FAILURE: '예매처 장애',
  PLATFORM_FAILURE: 'PICO 장애',
};

export const privacyActionNames: Record<PrivacyAction, string> = {
  ACCESS: '내 개인정보 열람',
  CORRECTION_OR_DELETION: '개인정보 정정·삭제',
  PROCESSING_SUSPENSION: '개인정보 처리정지',
  CONSENT_WITHDRAWAL: '동의 철회',
};

// 복원 요청 대상 거래의 상태(GET /api/inquiries/pass-restoration-targets status)
export const restorableStatusNames: Record<string, string> = {
  CANCELLED: '취소된 거래',
  MATCHING_COMPLETED: '직접 거래 매칭 완료',
};
