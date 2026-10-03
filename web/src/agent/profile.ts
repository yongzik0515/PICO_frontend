import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { loadPortOne } from '../api/portone';
import type { components } from '../api/schema';
import { mimeOf } from '../transactions/model';

// 도우미 프로필(버전)·인증·경력 증빙. 프로필 버전 응답 필드는 명세에 없어(data: object) pick()으로 찾는다.
// 상태 값은 백엔드 서비스 흐름 가이드 4장: DRAFT → PENDING → PUBLISHED / REJECTED, 새 버전이 게시되면 이전 게시본은 ARCHIVED.
// TODO(백엔드 확인): GET /api/me/agent/profiles 응답의 id·반려 사유 필드명
export type ProfileBody = components['schemas']['Profile'];
export type Category = components['schemas']['ServiceCategory'];

/** 프로필 버전 상태. 명세에 값 목록이 없어 흔한 이름으로 나눈다. */
// changes(보완 요청): 고칠 항목(changeFields)과 사유를 받아 보완 후 다시 신청한다. 실제 백엔드에는 아직 없는 상태다(USER_FLOW.md 11번).
export type ProfileStatus = 'draft' | 'review' | 'approved' | 'changes' | 'rejected' | 'archived';

export interface ProfileVersion {
  id: number;
  version: number;
  status: ProfileStatus;
  rawStatus: string;
  reviewNote: string;
  /** 보완 요청 때 고쳐야 할 항목(예: headline, career). 신청 양식에서 빨간 테두리로 표시한다. */
  changeFields: string[];
  submittedAt: string;
  body: ProfileBody;
  imageUrl?: string;
  careerSourceProfileId?: number;
  listed?: boolean;
  acceptsRequests?: boolean;
}

function statusOf(v: string): ProfileStatus {
  const s = v.toUpperCase();
  if (['SUBMITTED', 'IN_REVIEW', 'PENDING', 'PENDING_REVIEW', 'REVIEW'].includes(s)) return 'review';
  if (['APPROVED', 'PUBLISHED', 'ACTIVE'].includes(s)) return 'approved';
  if (['CHANGES_REQUESTED', 'NEEDS_CHANGES'].includes(s)) return 'changes';
  if (['REJECTED', 'DECLINED'].includes(s)) return 'rejected';
  if (['ARCHIVED', 'SUPERSEDED'].includes(s)) return 'archived';
  return 'draft';
}

export function toProfile(raw: Raw): ProfileVersion {
  const s = (...k: string[]) => str(pick(raw, ...k)) ?? '';
  const n = (...k: string[]) => num(pick(raw, ...k));
  // 버전 상세(GET /profiles/{id})는 platforms=[{platformId}], categories=[{category}]로 준다.
  const platforms = pick(raw, 'platformIds') ?? list(pick(raw, 'platforms')).map((p) => p.platformId ?? p.id);
  const categoryList = pick(raw, 'categories');
  const rawStatus = s('status', 'reviewStatus');
  return {
    id: n('profileId', 'profileVersionId', 'id') ?? 0,
    version: n('version', 'versionNumber') ?? 1,
    status: statusOf(rawStatus),
    rawStatus,
    reviewNote: s('reviewNote', 'rejectionReason', 'reviewComment'),
    changeFields: (Array.isArray(pick(raw, 'changeFields')) ? (pick(raw, 'changeFields') as unknown[]) : []).map(String),
    submittedAt: s('submittedAt'),
    imageUrl: s('imageUrl', 'profileImageUrl') || undefined,
    careerSourceProfileId: n('careerSourceProfileId'),
    listed: pick(raw, 'listed') as boolean | undefined,
    acceptsRequests: pick(raw, 'acceptsRequests') as boolean | undefined,
    body: {
      activityName: s('activityName'),
      headline: s('headline'),
      bio: s('bio'),
      primaryCategory: (s('primaryCategory') || 'CONCERT') as Category,
      categories: (Array.isArray(categoryList) ? categoryList.map((c) => (typeof c === 'string' ? c : str(pick(c, 'category')))).filter(Boolean) : []) as Category[],
      contactHoursNote: s('contactHoursNote'),
      careerDescription: s('careerDescription'),
      careerStartedOn: s('careerStartedOn') || undefined,
      upfrontFeeKrw: n('upfrontFeeKrw') ?? 0,
      successFeeMin: n('successFeeMin') ?? 0,
      successFeeMax: n('successFeeMax') ?? 0,
      platformIds: (Array.isArray(platforms) ? platforms : []).map(Number).filter(Boolean),
    },
  };
}

export const emptyProfile = (): ProfileBody => ({
  activityName: '',
  headline: '',
  bio: '',
  primaryCategory: 'CONCERT',
  categories: ['CONCERT'],
  contactHoursNote: '',
  careerDescription: '',
  upfrontFeeKrw: 0,
  successFeeMin: 0,
  successFeeMax: 0,
  platformIds: [],
});

export interface AgentState {
  versions: ProfileVersion[];
  /** 가장 최근 버전(작성·심사 중이면 그것) */
  latest?: ProfileVersion;
  /** 공개 중인(승인된) 버전 */
  approved?: ProfileVersion;
  identityVerified: boolean;
  payoutVerified: boolean;
  payoutMasked: string;
  /** 지급대행 등록 여부. verified인데 false면 연동 전에 인증한 계좌라 다시 등록해야 정산받을 수 있다(가이드 3-3) */
  payoutRegistered: boolean;
  evidence: Raw[];
}

export async function fetchAgentState(): Promise<AgentState> {
  const [versionsRaw, identity, payout] = await Promise.all([
    unwrap<unknown>(api.GET('/api/me/agent/profiles')).catch(() => []),
    unwrap(api.GET('/api/me/identity')).catch(() => null),
    unwrap(api.GET('/api/me/payout-account')).catch(() => null),
  ]);
  const summaries = list(versionsRaw)
    .map(toProfile)
    .sort((a, b) => b.version - a.version || b.id - a.id);
  // 이전 게시본(ARCHIVED)은 작성·심사 대상이 아니다.
  const current = summaries.find((v) => v.status === 'draft' || v.status === 'review') ?? summaries.find((v) => v.status !== 'archived');
  const path = current ? { params: { path: { profileId: current.id } } } : null;
  // 목록은 요약(활동명·상태 등)만 준다. 이어서 작성·공개 프로필 수정 양식을 채우려면 그 버전의 상세를 불러온다.
  const [detail, evidenceRaw] = path
    ? await Promise.all([
        unwrap<Raw>(api.GET('/api/me/agent/profiles/{profileId}', path)).catch(() => null),
        unwrap<unknown>(api.GET('/api/me/agent/profiles/{profileId}/evidence', path)).catch(() => []),
      ])
    : [null, []];
  const versions = detail && current ? summaries.map((v) => (v.id === current.id ? { ...toProfile(detail), id: v.id, version: v.version } : v)) : summaries;
  const latest = current && versions.find((v) => v.id === current.id);
  const approvedSummary = versions.find((v) => v.status === 'approved');
  const approved = approvedSummary && approvedSummary.id !== latest?.id
    ? toProfile(await unwrap<Raw>(api.GET('/api/me/agent/profiles/{profileId}', { params: { path: { profileId: approvedSummary.id } } })))
    : approvedSummary;
  const evidence = list(evidenceRaw);
  return {
    versions,
    latest,
    approved,
    identityVerified: identity?.verified === true,
    payoutVerified: payout?.verified === true,
    payoutMasked: payout?.maskedAccount ?? '',
    payoutRegistered: payout?.payoutRegistered === true,
    evidence,
  };
}

/** 승인된 도우미인지(받은 요청·매칭 관리를 쓸 수 있는지) */
export async function isApprovedAgent() {
  const versions = list(await unwrap<unknown>(api.GET('/api/me/agent/profiles')).catch(() => [])).map(toProfile);
  return versions.some((v) => v.status === 'approved');
}

/** PUT /api/me/agent/profile — 초안 생성·갱신(부분 저장 불가, 필수 항목을 모두 보낸다). 저장된 버전을 돌려준다. */
export async function saveDraft(body: ProfileBody) {
  const saved = await unwrap<Raw>(api.PUT('/api/me/agent/profile', { body }));
  return toProfile(saved ?? {});
}

async function putFile(target: Raw, file: File) {
  const url = str(target.uploadUrl);
  const key = str(target.storageKey);
  if (!url || !key) throw new Error('업로드 주소를 받지 못했어요.');
  const res = await fetch(url, { method: str(target.method) || 'PUT', headers: (target.requiredHeaders as Record<string, string>) ?? {}, body: file });
  if (!res.ok) throw new Error(`${file.name} 파일을 올리지 못했어요.`);
  return key;
}

/** 프로필 이미지: POST /api/files/upload-url(PROFILE_IMAGE) → 업로드 → PUT /profiles/{id}/image */
export async function uploadProfileImage(profileId: number, file: File) {
  const target = await unwrap<Raw>(api.POST('/api/files/upload-url', { body: { purpose: 'PROFILE_IMAGE', originalName: file.name, mimeType: file.type, sizeBytes: file.size } }));
  const storageKey = await putFile(target, file);
  await unwrap(api.PUT('/api/me/agent/profiles/{profileId}/image', { params: { path: { profileId } }, body: { storageKey } }));
}

/** 경력 증빙: POST /api/evidence-files/upload-url(CAREER) → 업로드 → POST /profiles/{id}/evidence/CAREER/{사례 번호} */
export async function submitCareerCase(profileId: number, caseNumber: number, files: File[], description: string) {
  const storageKeys: string[] = [];
  for (const f of files) {
    const target = await unwrap<Raw>(api.POST('/api/evidence-files/upload-url', { body: { purpose: 'CAREER', originalName: f.name, mimeType: mimeOf(f), sizeBytes: f.size } }));
    storageKeys.push(await putFile(target, f));
  }
  await unwrap(
    api.POST('/api/me/agent/profiles/{profileId}/evidence/{purpose}/{caseNumber}', { params: { path: { profileId, purpose: 'CAREER', caseNumber } }, body: { description, storageKeys } }),
  );
}

/** 제출한 경력 사례 번호 목록 */
/** 제출한 경력 사례(1~3)별 최신 상태. 심사 신청에는 3건 모두 제출(SUBMITTED/APPROVED)이고 첨부가 전부 CLEAN이어야 한다(가이드 4장). */
export interface CareerCase {
  caseNumber: number;
  status: string;
  /** clean · pending · blocked · unknown(응답에 검사 상태 없음) */
  scan: 'clean' | 'pending' | 'blocked' | 'unknown';
}
export function careerCaseStates(evidence: Raw[]): CareerCase[] {
  const latest = new Map<number, Raw>();
  for (const e of evidence.filter((x) => str(x.purpose) === 'CAREER')) {
    const n = num(pick(e, 'caseNumber')) ?? 1;
    const prev = latest.get(n);
    if (!prev || (num(pick(e, 'revision')) ?? 0) >= (num(pick(prev, 'revision')) ?? 0)) latest.set(n, e);
  }
  return [...latest.entries()]
    .map(([caseNumber, e]) => {
      const files = list(pick(e, 'attachments'));
      const states = files.length ? files.map((f) => str(f.scanStatus) ?? '') : [str(pick(e, 'scanStatus')) ?? ''];
      const scan: CareerCase['scan'] = states.some((x) => x === 'BLOCKED') ? 'blocked' : states.every((x) => x === 'CLEAN') ? 'clean' : states.every((x) => !x) ? 'unknown' : 'pending';
      return { caseNumber, status: str(e.status) ?? 'SUBMITTED', scan };
    })
    .filter((c) => ['SUBMITTED', 'APPROVED'].includes(c.status))
    .sort((a, b) => a.caseNumber - b.caseNumber);
}
export function careerCases(evidence: Raw[]) {
  return careerCaseStates(evidence).map((c) => c.caseNumber);
}

// ── 인증 ──────────────────────────────────────────────────
/** 본인인증: 세션 발급 → PortOne 본인인증창 → 서버 검증 */
export async function verifyIdentity() {
  const session = await unwrap(api.POST('/api/me/identity/verification-session'));
  const identityVerificationId = session.identityVerificationId;
  if (!identityVerificationId) throw new Error('본인인증을 시작하지 못했어요.');
  const PortOne = await loadPortOne();
  const res = await PortOne.requestIdentityVerification({ storeId: session.storeId, identityVerificationId, channelKey: session.channelKey });
  if (res?.code) throw new Error(res.message || '본인인증을 완료하지 못했어요.');
  await unwrap(api.POST('/api/me/identity/verify', { body: { identityReference: identityVerificationId } }));
}

/** 정산 계좌: 본인인증한 이름으로 실명조회한다. */
export async function verifyPayout(bankCode: string, accountNumber: string) {
  return unwrap(api.PUT('/api/me/payout-account', { body: { bankCode, accountNumber } }));
}

// 금융결제원 은행 코드(3자리) 중 자주 쓰는 은행
export const banks: [string, string][] = [
  ['004', 'KB국민은행'],
  ['088', '신한은행'],
  ['020', '우리은행'],
  ['081', '하나은행'],
  ['011', 'NH농협은행'],
  ['003', 'IBK기업은행'],
  ['090', '카카오뱅크'],
  ['092', '토스뱅크'],
  ['089', '케이뱅크'],
  ['023', 'SC제일은행'],
  ['071', '우체국'],
  ['045', '새마을금고'],
];

/** Public-only edits retain the existing career approval and publish immediately. */
export async function savePublicProfile(body: ProfileBody, expectedProfileId: number, image?: File) {
  let imageStorageKey: string | undefined;
  if (image) {
    const target = await unwrap<Raw>(api.POST('/api/files/upload-url', { body: { purpose: 'PROFILE_IMAGE', originalName: image.name, mimeType: image.type, sizeBytes: image.size } }));
    imageStorageKey = await putFile(target, image);
  }
  const { activityName, headline, bio, primaryCategory, contactHoursNote, upfrontFeeKrw, successFeeMin, successFeeMax, platformIds, categories } = body;
  return unwrap(api.PUT('/api/me/agent/public-profile', { body: { expectedProfileId, activityName, headline, bio, primaryCategory, contactHoursNote, upfrontFeeKrw, successFeeMin, successFeeMax, platformIds, categories, imageStorageKey } }));
}
