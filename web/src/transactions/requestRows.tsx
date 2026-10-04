import type { ReactNode } from 'react';
import { categoryNames } from '../discovery/agent';
import type { Agreement, TxRequest } from './model';
import { utcToLocal, won } from './ui';

const roundNames: Record<string, string> = { PRESALE: '선예매', GENERAL: '일반 예매', ADDITIONAL: '추가 예매' };

/** 요청서 전체 항목. 요청 상세·최종 조건 작성·관리자 정책 검토가 같은 항목을 보여 준다. */
export function requestRows(r: TxRequest): [string, ReactNode][] {
  const join = (...v: string[]) => v.filter(Boolean).join(' ');
  return [
    ['공연명', r.targetName],
    ['분야', categoryNames[r.serviceCategory] ?? r.serviceCategory],
    ['공연 일시', join(r.scheduledUseDate, r.scheduledUseTime)],
    ['티켓 오픈', join(r.applicationOpenDate, r.applicationOpenTime, roundNames[r.applicationRound] ? `· ${roundNames[r.applicationRound]}` : '')],
    ['예매처', r.platformName || r.otherPlatformName],
    ['공연장·위치', r.locationNote],
    ['매수', r.requestedQuantity ? `${r.requestedQuantity}매` : ''],
    ['희망 좌석·요청 내용', r.requirements],
    ['성공 요건', r.successConditions],
    ['희망 수고비', won(r.agencyBudgetDesired)],
    ['최대 수고비', won(r.agencyBudgetMax)],
    ['기타 사항', r.additionalNote],
    ['도우미 응답 기한', utcToLocal(r.expiresAt)],
  ];
}

/** 최종 조건(합의안) 항목. 요청 상세와 최종 조건 작성 화면이 같이 쓴다. */
export function agreementRows(a: Agreement): [string, ReactNode][] {
  return [
    ['착수비', won(a.upfrontFeeKrw)],
    ['수고비(성공보수)', won(a.successFeeKrw)],
    ['거래 방식', a.safePayment ? `안전거래 · 수수료 ${won(a.safetyFeeKrw)}` : '직접 거래(수수료 없음)'],
    ['희망 좌석·요청 내용', a.requirements],
    ['성공 요건', a.successConditions],
    ['예매 시도 방식', a.attemptRule],
    ['실패·환불 처리', a.refundRule],
    ['결과 연락 기한', a.contactDeadlineRule],
    ['기타 사항', a.additionalNote],
    ['수정 사유', a.reason],
  ];
}
