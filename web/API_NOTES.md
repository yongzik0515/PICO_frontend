# API 연동 메모

기준 문서
- API 명세: `web/openapi.json` (DemoDay API v1, OpenAPI 3.1, 126개 operation)
- 백엔드 서비스 흐름 가이드: `DEMODAY_백엔드_서비스흐름.pdf` (기준 코드 `2d8b602`, 2026-09-28). 명세와 가이드가 다르면 가이드(실제 코드)를 따랐다.
- 화면: `dist/` 프로토타입, `USER_FLOW.md`. 프로토타입과 명세가 다르면 명세를 따른다.

---

## 1. 백엔드에 요청할 것

### 1-1. 전체 흐름 테스트 전에 필요한 것
| # | 내용 | 이유 |
|---|---|---|
| B1 | ~~개발 서버 주소~~ ✅ `https://pico-dev.duckdns.org` (Swagger `/swagger-ui.html`). S3 업로드 CORS는 `http://localhost:5173`만 허용 | 다른 포트·주소로 테스트하면 백엔드에 추가 요청 |
| B2 | ~~약관 3종 등록~~ ✅ 문서 1·2·3 (테스트용) | `VITE_FALLBACK_*_ID` 불필요 |
| B3 | **예매처 등록** (`POST /api/admin/platforms`, ALLOW 또는 CONDITIONAL) | 요청서·도우미 신청의 예매처 선택지. BLOCK이면 수락·착수 불가 |
| B4 | ~~관리자 계정~~ ✅ 백엔드에서 전달(계정 정보는 문서에 적지 않음) | |
| B5 | ~~테스트용 도우미 계정~~ ✅ 본인인증·정산계좌 인증·매칭권 10회를 DB로 처리. 도우미 신청(경력 증빙)부터는 화면에서 진행. **DB로 넣은 값이라 이 계정으로 정산계좌 재등록·매칭권 환불은 테스트하지 않는다** | |
| B6 | **관리자 화면 응답 필드**: `/admin` 화면을 만들었다. 목록 API(`/api/admin/requests/policy-pending`, `/evidence-files`, `/agent-profiles`, `/users`, `/platforms`)가 `data: object`라 필드명을 후보로 찾는다(각 항목의 '원본 응답'으로 확인 가능). **분쟁 중 요청 목록 API**가 없어 분쟁 확정은 요청 번호를 직접 입력한다. 관리자용 신고 증빙 조회 API가 없어 신고 탭에서 증빙을 볼 수 없다 | 관리자 화면 |

### 1-2. 응답 필드 확정 (명세에 `data: object`로만 있어 프론트가 후보 이름으로 찾는 중)
| # | API | 프론트가 찾는 이름 (파일) |
|---|---|---|
| F1 | `GET /api/me` | `userId`, `nickname`, `email`, `preferredMode`, `emailVerified` (`AuthContext`, `MyPage`). ✅ 개발 서버 응답은 `id`, `isAdmin` 포함 → 관리자에게만 프로필 메뉴에 '관리자 화면' 표시 |
| F2 | `GET /api/agents`, `/api/agents/{id}`, `/api/me/favorites` | `agentId`, `activityName`, `headline`, `bio`, `primaryCategory`, `categories`, `upfrontFeeKrw`, `successFeeMin/Max`, `platforms[].{id,name}`, `averageRating`, `reviewCount`, `completedCount`, `successRate`, `averageResponseMinutes`, `profileImageUrl`, `identityVerified`, `payoutAccountVerified` (`discovery/agent.ts`) |
| F3 | `GET /api/requests`, `/api/requests/{id}` | `requestId`, `requesterUserId`, `agentUserId`, `requesterNickname`, `agentActivityName`, `platformName`, **`stage`**, **`policyGateStatus`**, `finalResult`, 도우미·이용자 결과(`agentResult`, `agentResultNote`, `requesterResult`, `requesterResultNote`), 거절·취소 사유, `paymentId`/`paymentStatus` (`transactions/model.ts`) |
| F4 | `GET /api/requests/{id}/agreements`, `/change-requests` | `agreementId`, `version`, `status`, `safetyFeeKrw`, `createdAt`, `finalizedAt`, 수정 요청 `reason` |
| F5 | `GET /api/requests/{id}/contacts` | `contacts[].{kind,value}` 또는 배열 |
| F6 | `GET /api/requests/{id}/result/evidence` | 제출 이력 `revision`, `description`, `submittedAt`, `attachments[].{originalName,scanStatus}` (시도 증빙 응답과 같은 모양이면 좋겠다) |
| F7 | `GET /api/me/agent/profiles`, `/profiles/{id}/evidence` | `profileId`, `version`, `status`, 반려 사유, `listed`·`acceptsRequests`, 증빙 `purpose`·`caseNumber`·`status`·`attachments[].scanStatus` (`agent/profile.ts`) |
| F8 | `GET /api/policies`, `/api/platforms` | 약관 `id`·`type`·`version`·`contentUrl`·`effectiveAt`, 예매처 `id`·`name` |

→ 응답 DTO 스키마나 예시를 openapi.json에 넣어 주면 후보 이름을 하나로 줄인다.

### 1-3. 규칙·동작 확인
| # | 질문 | 영향 |
|---|---|---|
| R1 | **도우미가 결제 상태를 알 방법.** 결제 상세는 이용자만 볼 수 있다. 서버 `stage`로 PAYMENT_WAITING/READY_TO_START는 구분되지만, 도우미 화면의 "거래 취소" 가능 여부(진행 중 결제 유무)를 알려면 요청·합의 응답에 결제 상태가 있으면 좋겠다 | 거래 취소 버튼 |
| R2 | ~~명세와 가이드 차이~~ ✅ 최신 openapi.json(132개)으로 교체. 후기·신고 증빙 구현됨, 관리자 신고·후기 API 연결 | |
| R3 | 메일 링크 주소: 이메일 인증 `/verify-email?token=`, 비밀번호 재설정 `/reset-password?token=` 로 맞춰 달라 | 계정 |
| R4 | 예매 가능 날짜 변환 규칙(프론트가 정함): 날짜 하루 = 한국 00:00~24:00 = UTC 전날 15:00~당일 15:00, 연속 날짜는 한 구간으로 합침. 괜찮은지 | 예매 가능 날짜 |
| R5 | 승인된 프로필을 수정해 새 초안을 만들면 경력 증빙 3건을 다시 내야 하는지 | 공개 프로필 수정 |
| R6 | 매칭권 카드 결제가 PROCESSING(503)으로 남으면 가이드상 **같은 키로 재요청**해야 한다. 프론트는 지금 새 구매를 만든다. 재시도용으로 진행 중 구매·결제 키를 조회할 방법이 있는지 | 매칭권 충전 |
| R7 | 정렬에 착수비 높은순(`PRICE_DESC`) 추가 가능한지. 지금은 오름차순을 뒤집어 100명 안에서만 정확 | 도우미 찾기 |
| R8 | `RequestExpiryJob`(기한 지난 요청 만료)을 개발·운영에서 켤지 | 요청 만료 표시 |

### 1-4. 없거나 미연동인 기능 (일정 공유 부탁)
| # | 기능 | 현재 |
|---|---|---|
| X1 | 가상계좌 발급·입금 확인(안전거래) | 503. 직접 거래는 조건 확정으로 매칭 완료 후 후기 작성 가능 |
| X2 | 계좌실명조회(정산계좌 인증) | 503. 새 도우미를 화면으로 완성할 수 없음 |
| X3 | 지급대행(착수비·성공보수 송금) | 지급 행 자체를 만들지 않음 → 도우미 정산 내역이 비어 있음 |
| X4 | 요청 상태 변경 알림(새 요청, 수락·거절, 합의 제안, 착수, 결과 제출·완료) | 없음. 프론트는 거래 화면을 창으로 돌아올 때 다시 불러오는 것으로 보완 |
| X5 | ~~신고 증빙 추가·조회~~ | ✅ 구현됨, 연결 완료 |
| X6 | 고객 문의, 이용자의 안전거래 결제 목록, 도우미 조건 알림 등록, 소셜 로그인 | API 없음 |

---

## 2. 기획자에게 요청할 것

### 2-1. 프로토타입과 달라진 흐름 확정 (명세·가이드 기준으로 구현함)
| 영역 | 프로토타입 | 지금 구현(명세·가이드) |
|---|---|---|
| 회원가입 | 휴대폰 인증 + 가입 목적 선택 | 이메일·비밀번호·닉네임·약관만. 모드는 헤더에서 바꾸고 `PATCH /api/me`로 저장. 이메일 인증은 계정 화면에서 |
| 요청 | 바로 도우미에게 전달 | 운영팀 정책 검토(허용/차단) 후 도우미가 수락 가능. 차단되면 "진행할 수 없는 요청". 응답 기한은 티켓 오픈 전이어야 함 |
| 매칭 후 취소 | 수락 전만 취소 | 진행 중인 결제가 없으면 매칭 후에도 양쪽이 취소 가능, 도우미 매칭권 복구 |
| 결제 | 착수금·성공비 개별, 카드·간편결제 | 가상계좌로 착수비+성공보수+이용료 한 번에. 입금 전 주문 취소 가능. 직접 거래(결제 없음) 선택지 있음 |
| 착수 | 착수 인증 업로드 = 착수 | "착수" 버튼과 시도 증빙 분리. 이용자가 증빙 승인해야 착수비 지급 |
| 결과 | 성공/실패/취소, 도우미 등록 → 이용자 확인 | 성공/부분 성공/실패. 결과 증빙 업로드 → 운영팀 파일 검토 → 결과 제출 → 이용자도 결과 입력, 다르면 분쟁(운영팀 확정) |
| 돈 처리 | 없음 | 부분 성공 정산(도우미 제안 → 이용자 동의/거절 → 운영팀 결정), 환불 요청(착수 전 전액, 실패 시 성공보수), 이용료 환불 없음 |
| 도우미 신청 | 경력 자료 자유 첨부, 즉시 심사 | 본인인증 + 정산계좌 + 경력 사례 1~3 모두 제출 + 운영팀 파일 검토 후 심사 신청 |
| 분야 | 콘서트·뮤지컬·팬미팅·페스티벌 | 콘서트·뮤지컬·스포츠·강좌·시설·기타 |
| 후기 | 작성자 이름 표시 | 응답에 이름이 없어 "이용자"로 표시. 거래당 1개, 삭제하면 다시 못 씀 |
| 신고 | 고객 문의 링크 | 거래 상세에서 상대방 신고, 마이페이지 신고 내역 |

### 2-2. 새로 기획이 필요한 것
| # | 내용 |
|---|---|
| P1 | **관리자 화면 기획·디자인**: 운영용 `/admin` 화면을 기존 부품으로 먼저 만들었다(탭 9개: 정책 검토, 파일 검토, 도우미 심사, 시도 증빙 대리 승인, 부분성공 정산, 분쟁·만료, 결제 확인, 회원 제재, 약관·예매처). 정식 화면 구성·권한별 메뉴·후기 숨김·신고 처리 화면 기획 필요 |
| P2 | 운영팀 검토 대기 단계(정책 검토, 파일 검토, 프로필 심사) 동안 이용자·도우미에게 보여 줄 안내 문구와 예상 소요 시간 |
| P3 | 요청 상태 알림이 없는 동안의 안내(예: "상대방이 진행하면 이 화면에서 확인해 주세요") 유지 여부 |
| P4 | API가 없는 기능 유지 여부: 고객 문의, 도우미 찾기 "알림 받기", 소셜 로그인, 요청서 불러오기·임시저장 |
| P5 | 이용 방법 화면 문구 |

### 2-3. 정책·문구 확정
| # | 내용 |
|---|---|
| Q1 | 약관 3종 원문(법무 검토) |
| Q2 | 도우미 응답 기한 기본값(지금 24시간, 티켓 오픈 전까지) |
| Q3 | 거래 기록이 없는 새 도우미 카드 표기(지금 "★0.0 · 거래 0회 · 성공률 0%") |
| Q4 | 사업자번호를 입력하면 사업자 증빙(BUSINESS)도 받을지, 활동 증빙(ACTIVITY)을 받을지 |
| Q5 | 예매 가능 날짜를 하루 단위로 받을지 시간 단위로 받을지 |
| Q6 | 직접 거래를 허용할지(플랫폼 보호 없음 안내 문구 포함) |
| Q7 | 이용자도 본인인증이 필요한지(지금은 도우미만 필수) |

---

## 3. 가이드로 확인되어 반영한 것
- 요청 목록·상세의 `stage`(REQUEST_WAITING, CONDITION_PREPARATION/CONFIRMATION/CHANGE_REQUESTED, PAYMENT_WAITING, READY_TO_START, IN_PROGRESS, RESULT_CONFIRMATION)를 그대로 화면 단계로 쓴다. 없으면 상태 조합으로 계산한다.
- 정책 검토 `policy_gate_status`(PENDING/ALLOWED/BLOCKED), 요청 결과 `final_result`.
- 도우미 프로필 상태 DRAFT → PENDING → PUBLISHED / REJECTED, 이전 게시본 ARCHIVED.
- 경력 증빙 CAREER 1~3 모두 + 첨부 CLEAN이 심사 신청 조건. 결과 제출은 최신 RESULT 증빙 첨부가 모두 CLEAN이어야 함.
- 매칭 후 취소(결제 없을 때, 매칭권 복구), 확정 후 결제 전 재제안(새 버전이 이전 확정본 대체).
- 연락처는 MATCHED·IN_PROGRESS·DISPUTED에서만 공개. 수락에는 양쪽 대표 연락처 필요.
- 착수비·성공보수 최대 1억, 이용료 = 성공보수 3%(올림) 최소 1,000원, 이용료는 환불 없음.
- 응답 시각은 UTC(시간대 표시 없음) → 화면에서 한국 시각·날짜로 변환. 신청 오픈 날짜·시각만 한국 시간으로 입력.
- 알림은 목록 조회로 읽음 처리하지 않고, 누를 때 상세 조회로 읽음 처리(프리페치 없음).

---

## 4. 프론트 구현 현황 (`web/`)
- React 19 + Vite + TypeScript, react-router. `openapi.json` → `src/api/schema.d.ts` 타입 자동 생성(`npm run api:types`)
- `src/api/client.ts`: Bearer 토큰, 401이면 refresh 1회 후 재시도(동시 요청이어도 refresh 한 번), `success/data/message`를 푸는 `unwrap()`
- 디자인: 프로토타입 CSS를 `src/styles/`에 그대로 옮기고 마크업도 프로토타입과 같게 작성(수정은 `pc-refinements.css` 끝에 주석과 함께)
- 명세 132개 중 125개 연결(관리자 API 포함). 나머지 7개는 서버 전용(`/webhooks/payments`, `GET /`), 알림 HEAD, 요청 상태 이력(`/history`), 내 신고 상세(목록으로 충분), 프로필 버전 상세, 성공보수 즉시 지급 시도
- 화면: 도우미 찾기·프로필·좋아요 / 로그인·회원가입·비밀번호 재설정·이메일 인증 / 요청서·요청 상세(조건 비교·수정 요청·확정·취소·재제안)·결제(가상계좌, 입금 전 취소)·시도 증빙·결과 증빙·결과 제출·결과 확인·부분성공 정산·환불·후기·신고(증빙 첨부) / 내 활동·받은 요청·매칭 관리·매칭권 충전·예매 가능 날짜 / 마이페이지·프로필·계정·인증·거래 내역·신고 내역 / 도우미 신청·공개 프로필 수정·공개 설정 / 알림 / 이용약관·개인정보 안내
- 관리자(`/admin`, isAdmin이면 프로필 메뉴에 표시, 서버 권한 검사): 요청 정책 검토, 증빙 파일 검토(파일 보기), 도우미 심사(증빙 보기), 시도 증빙 대리 승인, 부분성공 정산 결정, 분쟁 확정·요청 만료, 결제 확인 기록, 신고 처리(조사·처리 완료·처리 안 함), 후기 숨김, 회원·도우미 제재, 예매처 등록·수정, 약관 버전 등록(원문 SHA-256 계산)
- 준비 중 화면: 이용 방법, 고객 문의
- `/dev/api`: 응답 모양을 확인하는 개발용 화면

## 직접 거래 흐름 (2026-10-01)

직접 거래(safetyFeeKrw=0)는 이용자가 조건을 확정하면 MATCHING_COMPLETED로 끝난다. 착수·시도 증빙·결과 등록/확인은 안전거래 전용이다. 매칭 완료 후 연락처와 요청 이력을 볼 수 있고 이용자는 후기 1개를 작성한다. 후기 bookingResult(SUCCESS/PARTIAL/FAILURE, 선택)는 이용자가 남긴 정보로 finalResult·결제·정산과 별개이다. 확정 후 조건 변경·요청 취소는 허용하지 않는다.

## 사진 조회 (2026-10-01)

저장된 증빙·신고·후기·프로필 사진은 썸네일을 클릭하면 화면 안에서 확대한다. 사진 파일명에는 다운로드 링크를 두지 않는다. 관리자 증빙 파일 보기도 이미지라면 확대창을 사용한다. PDF·영상 등 다른 파일은 기존 열람 방식을 유지한다. 만료되거나 표시할 수 없는 사진은 안내를 표시하며 다운로드로 전환하지 않는다.
