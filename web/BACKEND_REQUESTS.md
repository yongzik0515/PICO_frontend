# 백엔드 요청사항

## 2026-10-04 백엔드 연결 반영

현재 구현은 다음 계약을 사용합니다. 아래의 기존 백엔드 미연결 메모는 작업 당시 기록입니다.

- 안전거래: 착수비·수고비·수수료 전액 1회 결제 유지. 항목 선택 없음.
- 매칭권: `PACKAGE_10` 10장 4,500원 / `CUSTOM` 2~100장 장당 500원. 자유 수량 10장은 5,000원. 서버 주문 금액으로 결제합니다.
- 경력: 정상 파일(CLEAN)을 가진 최신 사례 최소 1건. 신청 화면에서 파일 검토 상태 새로고침 가능.
- 심사 보완: 관리자에서 항목·사유 지정 → CHANGES_REQUESTED → 본인 수정·증빙 재제출 → 재심사.
- 최종 조건: `additionalNote` 저장·표시·임시저장. 첫 제안은 도우미, 역제안은 전체 조건·reason·expectedAgreementVersion을 한 번에 제출. 최신 자기 제안과 상대 조건 비교.
- 문의: 브라우저 임시 저장을 서버 접수·본인 조회로 교체. 관리자 문의 목록·답변 연결. 예전에 브라우저에만 저장한 문의는 자동 전송하지 않습니다.
- 공개 인증 배지: 서버의 실제 `identityVerified`·`payoutAccountVerified` 사용.
- 회원가입: 인증 정책 변경 전까지 main의 기존 이메일 가입을 유지합니다. 체험용 아이디 중복확인·고정 SMS 코드는 운영 화면에서 제외했습니다.
- `web/openapi.json` 및 `web/src/api/schema.d.ts` 동기화. 백엔드 V22~V24 마이그레이션 포함 버전 배포가 필요합니다.


화면을 만들면서 **백엔드에 필요해진 것**만 모아 둔 문서입니다.
(기존 연동 메모·기획 문의는 `API_NOTES.md`에 있습니다. 이 파일은 2026-10-03부터 새로 적습니다.)

표기: 🔴 막힘(이 기능이 동작하지 않음) · 🟡 겉모습만 만들어 둠 · ⚪ 있으면 좋음

---

## 1. 도우미 인증 배지 (본인인증 · 계좌인증)

| | |
|---|---|
| 상태 | 🔴 막힘 |
| 화면 | 도우미 찾기 목록, 도우미 상세 프로필 (`agent-title` 옆 배지) |
| 프론트 | **이미 구현 완료.** `AgentCard.tsx`의 `Badges`가 값만 오면 바로 그린다 |

**필요한 것** — `GET /api/agents`, `GET /api/agents/{agentId}` 응답에 아래 두 필드 추가

| 필드 | 타입 | 뜻 |
|---|---|---|
| `identityVerified` | boolean | 본인인증 완료 여부 |
| `payoutAccountVerified` | boolean | 정산 계좌 인증 완료 여부 |

**확인한 사실**
- 현재 `GET /api/agents` 응답 필드: `profileId, agentId, activityName, headline, bio, imageKey, primaryCategory, upfrontFeeKrw, successFeeMin, successFeeMax, contactHoursNote, careerDescription, careerStartedOn, publishedAt, acceptsRequests, reviewCount, averageRating, completedCount, successRate, averageResponseMinutes, imageUrl` → 인증 관련 필드 없음
- `openapi.json` 전체에도 해당 필드가 **정의되어 있지 않음**

**왜 임의로 켜지 않았는지**: 이 배지는 "이 도우미는 본인·계좌 확인을 거쳤다"는 신뢰 표시입니다.
돈이 오가는 거래에서 이용자가 이걸 보고 도우미를 고르므로, 실제 인증 여부와 무관하게 항상 띄우면
미인증 도우미를 인증된 것처럼 보이게 만듭니다. 값이 오기 전까지는 배지를 숨깁니다.

---

## 2. 요청서 임시저장 · 불러오기

| | |
|---|---|
| 상태 | 🟡 겉모습만 (브라우저 저장으로 동작) |
| 화면 | 요청 보내기 (`/agents/{id}/quote`), 요청 내용 수정 |

**지금 동작**
- **임시저장**: `localStorage`에 저장. 같은 브라우저에서 그 화면을 다시 열면 복원된다.
  → 다른 기기·브라우저에서는 보이지 않는다. 화면에도 그렇게 안내하고 있다.
- **불러오기**: `GET /api/requests?role=REQUESTER`로 내가 보낸 요청을 가져와, 고른 요청의
  공연·일정·좌석·성공 요건·수고비를 폼에 복사한다. (이건 기존 API로 이미 동작한다)

**필요한 것** ⚪ — 서버 임시저장을 쓰려면

| 메서드 | 경로 | 용도 |
|---|---|---|
| `PUT` | `/api/me/request-drafts/{agentId}` | 작성 중인 요청서 저장 |
| `GET` | `/api/me/request-drafts/{agentId}` | 저장한 내용 불러오기 |
| `DELETE` | `/api/me/request-drafts/{agentId}` | 요청을 보내고 나면 삭제 |

기기를 옮겨도 이어서 쓰게 하려면 필요합니다. 급하지 않으면 지금의 브라우저 저장으로 둬도 됩니다.

---

## 3. 아이디 · 비밀번호 찾기 (보류)

| | |
|---|---|
| 상태 | 🔴 막힘 → 화면 작업 보류 중 |
| 상세 | `API_NOTES.md`의 "아이디·비밀번호 찾기 화면 복원" 표 **R1~R5** 참고 |

요약: 아이디 찾기 API 없음, 인증번호 발송·확인 API 없음, 가입 시 휴대전화번호를 받지 않음.

---

## 4. 회원가입 화면 (겉모습만)

| | |
|---|---|
| 상태 | 🟡 겉모습만 |
| 상세 | `API_NOTES.md`의 "회원가입 화면 교체" 표 **S1~S7** 참고 |

요약: 아이디 중복확인·휴대전화 인증·프로필 이미지·연락방법·3번째 약관이 **입력돼도 저장되지 않음.**
운영 전 반드시 해결해야 합니다.

---

## 5. 최종 조건의 '기타 사항'

| | |
|---|---|
| 상태 | 🟡 겉모습만 |
| 화면 | 최종 조건 작성 (도우미) — '비용과 결과 안내' 카드 |

참고 프로토타입에 있던 '기타 안내' 입력칸을 되살렸는데, **보낼 자리가 없습니다.**

**필요한 것** — `POST /api/requests/{requestId}/agreements`의 Agreement 스키마에 필드 추가

| 필드 | 타입 | 뜻 |
|---|---|---|
| `additionalNote` | string (선택) | 도우미가 조건에 덧붙이는 기타 안내 |

**확인한 사실** — 현재 Agreement 스키마 필드: `upfrontFeeKrw, successFeeKrw, safePayment, requirements, successConditions, attemptRule, refundRule, contactDeadlineRule, expectedAgreementVersion` → 기타 안내를 담을 자리 없음.

⚠️ **주의**: 지금은 도우미가 여기 적은 내용이 **저장되지 않고 사라집니다.** 최종 조건은 거래 조건이라
도우미가 적은 내용을 이용자가 못 보면 분쟁 소지가 됩니다. 이 필드는 다른 것보다 먼저 처리하는 게 좋습니다.

---

## 묶어서 요청하면 좋은 것

**S3·S4(가입 시 휴대전화 인증·저장)와 R2·R3·R5(찾기 화면 인증)는 같은 기능입니다.**
가입에서 번호를 저장해야 찾기 화면의 휴대전화 인증도 성립하므로, 두 화면을 묶어서 한 번에 요청하는 편이 효율적입니다.
