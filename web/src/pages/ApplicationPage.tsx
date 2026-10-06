import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, str } from '../api/pick';
import {
  banks,
  careerCaseStates,
  emptyProfile,
  fetchAgentState,
  saveDraft,
  savePublicProfile,
  submitCareerCase,
  uploadProfileImage,
  verifyIdentity,
  verifyPayout,
  type AgentState,
  type Category,
  type ProfileBody,
  type ProfileStatus,
} from '../agent/profile';
import { useAppState } from '../AppState';
import { useAuth } from '../auth/AuthContext';
import { useAgentActive } from '../agent/active';
import { Avatar } from '../discovery/AgentCard';
import { categoryNames, useFreshPlatforms } from '../discovery/agent';
import { useLoad } from '../transactions/model';
import { FilePicker, MoneyInput, kstDay, useAction } from '../transactions/ui';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { PageTitle } from '../ui/PageTitle';
import { Verification } from '../ui/account';
import { money } from '../ui/format';
import { useToast } from '../ui/Toast';

// 프로토타입 account.js의 application()/helperFields()/verificationCard()/careerUpload()/publicPreview()/applicationStatusPage()
// 명세 흐름: PUT /api/me/agent/profile(초안) → 본인·계좌 인증 → 경력 증빙(CAREER 최소 1건) → POST /profiles/{id}/submit → 관리자 심사
// 공개 항목만 수정하면 기존 경력 승인을 유지하고 즉시 게시한다.

const statusLabels: Record<ProfileStatus | 'none', string> = { none: '미신청', draft: '작성 중', review: '심사 중', approved: '승인', changes: '보완 요청', rejected: '반려', archived: '이전 게시본' };
// 보완 요청에서 고칠 항목(changeFields) 이름. 신청 양식의 같은 칸에 빨간 테두리를 표시한다.
const fieldNames: Record<string, string> = {
  image: '프로필 이미지', activityName: '활동 닉네임', headline: '한 줄 소개', bio: '상세 소개', platformIds: '가능한 예매처', categories: '공연 분야',
  primaryCategory: '주로 맡는 공연 분야', contactHoursNote: '활동 가능 시간·일정', upfrontFeeKrw: '최소 착수비', successFee: '수고비',
  payout: '정산 계좌', contact: '매칭 후 연락 방법', careerDescription: '경력 요약', career: '경력 인증', business: '사업자 등록번호',
};
const scanLabels: Record<string, string> = { clean: '검토 완료', pending: '운영팀 파일 검토 전', blocked: '차단됨 · 다시 제출해 주세요', unknown: '제출 완료' };
const categories = Object.keys(categoryNames) as Category[];
// 매칭 후 연락 방법(마이페이지 연락처와 같은 값)
const contactKinds: Record<string, string> = { PHONE: '전화번호', KAKAO: '카카오톡 ID', EMAIL: '이메일' };
const contactPlaceholders: Record<string, string> = { PHONE: '010-0000-0000', KAKAO: '카카오톡 ID', EMAIL: 'name@example.com' };

function Note({ children, kind = '' }: { children: ReactNode; kind?: string }) {
  return (
    <div className={`notice account-note ${kind}`}>
      <Icon name={kind === 'success' ? 'check' : 'info'} size={18} />
      <span>{children}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="content-card account-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, required, helper, className = '', children }: { label: string; required?: boolean; helper?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`field ${className}`}>
      <span>
        {label} <small className="account-required">{required ? '필수' : '선택'}</small>
      </span>
      {children}
      {helper && <small className="field-helper">{helper}</small>}
    </label>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <ol className="account-progress" aria-label="진행 단계">
      {['공개 프로필', '인증과 경력', '미리보기·제출'].map((t, i) => (
        <li key={t} className={i === step ? 'active' : i < step ? 'complete' : ''} aria-current={i === step ? 'step' : undefined}>
          <span>{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
          <strong>{t}</strong>
        </li>
      ))}
    </ol>
  );
}

/** 공개 프로필 미리보기(프로토타입 publicPreview) */

/** 신청 마지막 단계 미리보기: 이용자가 보게 될 도우미 상세 프로필(ProfilePage) 본문과 같은 모양. 거래 기록은 아직 없다. */
function DetailPreview({ p, platformNames, image, footer }: { p: ProfileBody; platformNames: string[]; image?: string; footer?: ReactNode }) {
  const name = p.activityName || '활동 닉네임';
  const rows: [string, string][] = [
    // '·' 앞은 줄이 바뀌지 않는 공백(\u00a0)이라 다음 줄이 '·'로 시작하지 않는다(ProfilePage와 같음).
    ['가능 예매처', platformNames.join('\u00a0· ') || '미입력'],
    ['주로 맡는 분야', categoryNames[p.primaryCategory] ?? '미입력'],
    ['활동 가능 시간', p.contactHoursNote || '미입력'],
    ['최소 착수비', money(p.upfrontFeeKrw) + '원'],
    ['수고비', `${money(p.successFeeMin)} ~ ${money(p.successFeeMax)}원 · 최종 조건에서 확정`],
    ['활동 경력', (p.careerDescription?.trim() || '미입력') + ' · 본인 작성'],
  ];
  return (
    <>
      <section className="content-card profile-intro">
        <span className="tiny-label">공개 프로필 미리보기</span>
        <div className="profile-title">
          <Avatar agent={{ name, initial: name[0], color: 'blue', image }} size="large" />
          <div>
            <div className="agent-title">
              <h1>{name}</h1>
            </div>
            <p>{p.headline || '한 줄 소개를 입력해 주세요.'}</p>
            <span className="rating">
              <b>★</b>
              <strong>0.0</strong> · 후기 0개
            </span>
          </div>
        </div>
        <div className="profile-stats">
          {[
            ['성공률', '기록 없음'],
            ['거래 횟수', '0회'],
            ['평균 응답', '기록 없음'],
          ].map(([k, v]) => (
            <div key={k} className="info-tile">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <p className="record-note">
          <Icon name="info" size={13} /> 플랫폼 거래 기록 기준 · 소개와 경력은 도우미가 직접 작성해요.
        </p>
      </section>
      <section className="content-card">
        <h2>함께하기 전에 확인하세요</h2>
        <dl className="document-rows">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="notice">
          <Icon name="shield" size={17} />
          연락처는 요청을 수락한 상대방에게만 공개돼요.
        </div>
      </section>
      <section className="content-card profile-feedback">
        <div className="tabs" role="tablist" aria-label="프로필 정보">
          <button type="button" className="active" role="tab" aria-selected>
            도우미 소개
          </button>
          <button type="button" role="tab" aria-selected={false} disabled>
            거래 후기 0
          </button>
        </div>
        <h3>공연을 기다리는 마음, 함께할게요.</h3>
        <p className="prose profile-detail" style={{ whiteSpace: 'pre-line' }}>
          {p.bio || '상세 소개를 입력해 주세요.'}
        </p>
        <p className="record-note">도우미가 직접 작성한 소개예요.</p>
        {footer}
      </section>
    </>
  );
}

/** 공개 설정(도우미 찾기 목록 공개·새 요청 받기). 신청 현황과 공개 프로필 화면이 같이 쓴다. */
function VisibilityCard({ reload }: { reload: () => void }) {
  const toast = useToast();
  const { me, reloadMe } = useAuth();
  // 공개 설정의 현재 값은 GET /api/me(isListed·acceptsRequests)에 있다. 하나를 바꿀 때 다른 하나를 그대로 보내야 한다.
  const flag = (v: unknown) => v === true || v === 1;
  const [changed, setVisibility] = useState<{ listed: boolean; acceptsRequests: boolean } | null>(null);
  const visibility = changed ?? { listed: flag(me?.isListed), acceptsRequests: flag(me?.acceptsRequests) };

  async function saveVisibility(next: typeof visibility) {
    const before = changed;
    setVisibility(next);
    try {
      await unwrap(api.PUT('/api/me/agent/visibility', { body: next }));
      toast(next.listed ? '공개 설정을 저장했어요.' : '도우미 찾기 목록에서 내 프로필을 숨겼어요.');
      await reloadMe();
      reload();
    } catch (e) {
      setVisibility(before);
      toast(e instanceof Error ? e.message : '공개 설정을 저장하지 못했어요.');
    }
  }

  return (
    <Card title="공개 설정">
      {/* 두 설정은 따로 움직인다: '목록 노출'은 찾을 수 있는지, '새 요청 받기'는 요청을 보낼 수 있는지. */}
      <label className="check-row visibility-option">
        <input type="checkbox" disabled={!me} checked={visibility.listed} onChange={(e) => void saveVisibility({ ...visibility, listed: e.target.checked })} />
        <span>
          <strong>도우미 찾기 목록에 노출</strong>
          <small>켜면 이용자가 도우미 찾기·검색에서 내 프로필을 찾을 수 있어요. 끄면 목록에서 빠져요.</small>
        </span>
      </label>
      <label className="check-row visibility-option">
        <input type="checkbox" disabled={!me} checked={visibility.acceptsRequests} onChange={(e) => void saveVisibility({ ...visibility, acceptsRequests: e.target.checked })} />
        <span>
          <strong>새 요청 받기</strong>
          <small>켜면 이용자가 내 프로필에서 예매 요청을 보낼 수 있어요. 끄면 프로필은 보여도 새 요청은 받지 않아요.</small>
        </span>
      </label>
      <p className="record-note">잠시 쉬고 싶을 때 끄면 목록에서 숨겨지거나 새 요청을 받지 않아요. 진행 중인 거래는 그대로 이어져요.</p>
    </Card>
  );
}

function StatusView({ state, onResume }: { state: AgentState; onResume: () => void }) {
  const navigate = useNavigate();
  const { platforms } = useFreshPlatforms();
  const activity = useAgentActive();
  const [previewOpen, setPreviewOpen] = useState(false);
  const latest = state.latest;
  // 게시된(승인) 버전이 있으면 새로 고친 버전이 심사 중이거나 반려돼도 공개 프로필은 그대로 공개 중이다.
  const s: ProfileStatus | 'none' = state.approved ? 'approved' : (latest?.status ?? 'none');
  const revision = state.approved && latest && latest.id !== state.approved.id ? latest.status : undefined;
  const data: Record<ProfileStatus | 'none', [string, string, 'clock' | 'check' | 'info']> = {
    none: ['아직 도우미 신청 전이에요', '공개 프로필과 인증·경력 자료를 준비해 신청해 주세요. 단계마다 저장돼서 나눠서 작성해도 돼요.', 'info'],
    archived: ['이전 게시본이에요', '새 버전이 게시되어 이 버전은 보관됐어요.', 'info'],
    draft: ['신청서를 작성하고 있어요', '이어서 작성하고 제출해 주세요.', 'info'],
    review: ['신청 내용을 확인하고 있어요', '공개 프로필과 인증·경력 자료를 확인한 뒤 알림으로 안내할게요. 승인 전에는 받은 요청과 매칭 관리를 이용할 수 없어요.', 'clock'],
    approved: ['도우미 활동을 시작할 수 있어요', '공개 프로필로 직접 도착한 요청을 확인하고, 수락한 거래는 매칭 관리에서 이어가세요.', 'check'],
    changes: ['신청 내용을 보완해 주세요', '아래 사유와 항목을 고쳐 다시 신청하면 이어서 심사해요. 신청 양식에서 고칠 곳을 빨간 테두리로 표시해 두었어요.', 'info'],
    rejected: ['신청이 승인되지 않았어요', '아래 사유를 확인해 주세요. 활동 기준에 맞는 자료를 준비해 다시 신청할 수 있어요.', 'info'],
  };
  const [title, text, icon] = data[s];
  const platformNames = platforms.filter((x) => latest?.body.platformIds.includes(x.id)).map((x) => x.name);

  return (
    <div className="account-contained">
      <PageTitle title="도우미 신청 현황" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <section className={`content-card account-status-card ${s}`}>
        <span className={`account-status-icon ${s}`}>
          <Icon name={icon} size={30} />
        </span>
        <span className={`badge ${s === 'approved' ? 'verified' : s === 'rejected' ? 'account-badge-error' : s === 'changes' ? 'account-badge-warn' : 'neutral'}`}>{statusLabels[s]}</span>
        <h2>{title}</h2>
        <p>{text}</p>
        {/* 보완 요청: 사유 + 고칠 항목(노란 계열) / 반려: 사유만(빨간 계열). 둘이 한눈에 구분되게 색과 내용을 다르게 둔다. */}
        {s === 'changes' && (
          <div className="account-review-reason changes">
            <strong>운영팀이 남긴 보완 사유</strong>
            <p>{latest?.reviewNote || '보완이 필요한 항목을 확인해 주세요.'}</p>
            {latest && latest.changeFields.length > 0 && (
              <>
                <strong>고칠 항목</strong>
                <div className="site-tags">
                  {latest.changeFields.map((f) => (
                    <span key={f}>{fieldNames[f] ?? f}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {s === 'rejected' && (
          <div className="account-review-reason rejected">
            <strong>반려 사유</strong>
            <p>{latest?.reviewNote || '운영팀이 사유를 남기지 않았어요. 문의 작성에서 사유를 물어볼 수 있어요.'}</p>
          </div>
        )}
        {revision === 'review' && <Note>수정한 공개 프로필을 심사하고 있어요. 심사 중에도 기존 공개 프로필은 그대로 공개되고, 승인되면 새 내용으로 바뀌어요.</Note>}
        {(revision === 'rejected' || revision === 'changes') && (
          <Note kind="error">
            수정한 공개 프로필이 승인되지 않았어요{latest?.reviewNote ? ` (사유: ${latest.reviewNote})` : ''}. 기존 공개 프로필은 그대로 공개 중이에요. '공개 프로필 관리'에서 보완해 다시 신청할 수 있어요.
          </Note>
        )}
        {s === 'approved' && (
          <label className="check-row account-active-toggle">
            <input type="checkbox" disabled={!activity.ready || activity.saving} checked={activity.active} onChange={(e) => void activity.setActive(e.target.checked)} />
            <span>
              이용자에게 도우미 프로필이 노출돼요 <small>(활동 중 · 끄면 목록에서 숨겨지고 새 요청을 받지 않아요)</small>
            </span>
          </label>
        )}
        <div className="account-status-actions">
          {s === 'approved' ? (
            <>
              <button type="button" className="btn primary full" onClick={() => navigate('/leads')}>
                받은 요청 확인
              </button>
              {/* 심사 중인 수정본이 있으면 서버가 새 수정을 받지 않는다(409). */}
              {revision !== 'review' && (
                <button type="button" className="btn secondary full" onClick={() => navigate('/helper-profile')}>
                  공개 프로필 관리
                </button>
              )}
            </>
          ) : s === 'review' ? (
            <>
              <button type="button" className="btn primary full" onClick={() => setPreviewOpen(true)}>
                제출한 공개 프로필 보기
              </button>
              <button type="button" className="btn secondary full" onClick={() => navigate('/my')}>
                마이페이지로
              </button>
            </>
          ) : s === 'rejected' ? (
            <button type="button" className="btn secondary full" onClick={onResume}>
              다시 신청하기
            </button>
          ) : (
            <button type="button" className="btn primary full" onClick={onResume}>
              {s === 'changes' ? '보완하고 다시 신청' : s === 'none' ? '도우미 신청 정보 작성' : '도우미 신청 정보 수정'}
            </button>
          )}
        </div>
        {state.approved?.careerSourceProfileId && <Note>공개 내용은 수정해 바로 게시한 버전이에요. 인증·경력은 기존에 승인된 자료를 유지하고 있어요.</Note>}
        {s === 'none' && <Note>요청 수락 시 매칭권 1장을 사용해요. 이용자의 안전거래 결제와는 별개입니다. 예매처의 이용 기준을 준수하고, 계정정보 수집·매크로·재판매·티켓 양도를 요구하거나 제공할 수 없어요.</Note>}
        {latest?.submittedAt && <small className="account-caption">신청일 {kstDay(latest.submittedAt)}</small>}
      </section>
      {previewOpen && latest && (
        <Modal title="제출한 공개 프로필" wide onClose={() => setPreviewOpen(false)}>
          <div className="application-detail-preview">
            <DetailPreview p={latest.body} platformNames={platformNames} image={latest.imageUrl} />
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ApplicationPage({ edit: editRoute = false }: { edit?: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { me, reloadMe } = useAuth();
  const [, setApp] = useAppState();
  // 관리자가 예매처를 삭제(사용 중지)했을 수 있어 신청 화면을 열 때마다 새로 받는다.
  const { platforms, loaded: platformsLoaded, failed: platformsFailed } = useFreshPlatforms();
  const [load, reload] = useLoad(fetchAgentState, [], { refreshOnFocus: true });
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileBody | null>(null);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState('');
  const [bank, setBank] = useState({ code: '004', number: '' });
  const [contactsLoad] = useLoad(() => unwrap<unknown>(api.GET('/api/me/contacts')).then(list), []);
  const primaryContact = contactsLoad.status === 'done' ? contactsLoad.data.find((c) => c.isPrimary === true) : undefined;
  const [contact, setContact] = useState<{ kind: string; value: string } | null>(null);
  const contactDraft = contact ?? { kind: str(primaryContact?.kind) ?? 'PHONE', value: str(primaryContact?.value) ?? '' };
  const [career, setCareer] = useState<Record<number, { files: File[]; description: string }>>({});
  const [business, setBusiness] = useState('');
  const [agreed, setAgreed] = useState({ rules: false, contact: false });
  const { pending, run } = useAction();

  if (load.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>도우미 신청 정보를 불러오는 중이에요.</p>
      </div>
    );
  if (load.status === 'error')
    return (
      <div className="empty">
        <h1>도우미 신청 정보를 불러오지 못했어요</h1>
        <p>{load.message}</p>
      </div>
    );

  const state = load.data;
  const { latest } = state;
  // /helper-profile(헤더 '프로필 수정')로 들어와도 승인된 프로필이 없으면 수정이 아니라 신규 신청 흐름이다.
  const edit = editRoute && !!state.approved;
  // 승인된 도우미에게 예전 흐름의 초안이 남아 있어도 신청 단계 화면을 띄우지 않는다. 공개 내용 수정은 /helper-profile에서 바로 반영한다.
  const inForm = started || edit;

  if (!inForm) return <StatusView state={state} onResume={() => setStarted(true)} />;

  // 작성 중이던 초안 → 반려·수정이면 마지막 버전 → 처음이면 빈 양식
  const base = (edit ? state.approved?.body : latest?.body) ?? { ...emptyProfile(), activityName: str(me?.nickname) ?? '' };
  const saved = draft ?? base;
  // 이전에 골랐지만 지금 목록에 없는 예매처(관리자가 삭제)는 선택에서 빼고 저장한다. 목록을 받기 전에는 판단하지 않는다.
  const removedPlatforms = platformsLoaded ? saved.platformIds.filter((id) => !platforms.some((x) => x.id === id)) : [];
  const p = removedPlatforms.length ? { ...saved, platformIds: saved.platformIds.filter((id) => !removedPlatforms.includes(id)) } : saved;
  const set = (patch: Partial<ProfileBody>) => setDraft({ ...p, ...patch });
  const caseStates = careerCaseStates(state.evidence);
  // 경력 인증은 정상 파일을 포함한 최신 사례 1건 이상을 요구한다.
  const careerCase = caseStates.find((c) => c.caseNumber === 1);
  const platformNames = platforms.filter((x) => p.platformIds.includes(x.id)).map((x) => x.name);

  function validateProfile() {
    if (edit && !state.identityVerified) return '본인인증이 완료되지 않아 공개 프로필을 저장할 수 없어요. 인증 상태를 확인해 주세요.';
    if (edit && !state.payoutVerified) return '정산 계좌 인증이 완료되지 않아 공개 프로필을 저장할 수 없어요. 계좌 인증 상태를 확인해 주세요.';
    if (!p.platformIds.length) return '가능한 예매처를 하나 이상 선택해 주세요.';
    if (!p.categories.length) return '공연 분야를 하나 이상 선택해 주세요.';
    if ((p.successFeeMax ?? 0) < (p.successFeeMin ?? 0)) return '수고비 최대 금액은 최소 금액 이상이어야 해요.';
    return '';
  }

  async function saveStep0(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const message = validateProfile();
    setError(message);
    if (message) return;
    const body = { ...p, primaryCategory: p.categories.includes(p.primaryCategory) ? p.primaryCategory : p.categories[0] };
    const ok = await run(async () => {
      try {
        if (edit) {
          await savePublicProfile(body, state.approved!.id, image?.file);
          await reloadMe();
        } else {
          const saved = await saveDraft(body);
          if (image && saved.id) await uploadProfileImage(saved.id, image.file);
        }
      } catch (e) {
        // 토스트가 사라진 뒤에도 저장 실패 이유와 작성 내용을 확인할 수 있게 남긴다.
        setError(e instanceof Error ? e.message : '프로필을 저장하지 못했어요. 다시 시도해 주세요.');
        throw e;
      }
    }, edit ? '공개 프로필을 저장했어요. 바로 반영돼요.' : '공개 프로필을 임시저장했어요.');
    if (ok) {
      if (edit) {
        setDraft(null);
        setImage(null);
        return reload();
      }
      setDraft(body);
      setStep(1);
      reload();
    }
  }

  async function saveStep1(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const message = !state.identityVerified
      ? '본인인증을 완료해 주세요.'
      : !state.payoutVerified
        ? '정산 계좌를 확인해 주세요.'
        : !caseStates.some((c) => c.scan === 'clean')
          ? '경력 인증 자료를 제출하고 파일 검토가 완료될 때까지 기다려 주세요.'
          : !agreed.rules || !agreed.contact
            ? '필수 항목에 동의해 주세요.'
            : '';
    setError(message);
    if (message) return;
    const ok = await run(async () => {
      if (contact && (contact.kind !== str(primaryContact?.kind) || contact.value.trim() !== str(primaryContact?.value)))
        await unwrap(api.PUT('/api/me/contacts', { body: { kind: contact.kind as 'PHONE', value: contact.value.trim(), primary: true } }));
      const saved = await saveDraft(p);
      if (business.trim() && saved.id) await unwrap(api.PUT('/api/me/agent/profiles/{profileId}/business', { params: { path: { profileId: saved.id } }, body: { registrationNumber: business.trim() } }));
    });
    if (ok) {
      setStep(2);
      reload();
    }
  }

  async function submit() {
    if (!latest) return;
    const ok = await run(() => unwrap(api.POST('/api/me/agent/profiles/{profileId}/submit', { params: { path: { profileId: latest.id } } })), '도우미 신청을 제출했어요. 심사 결과는 알림으로 알려드릴게요.');
    if (ok) {
      setStarted(false);
      setDraft(null);
      setStep(0);
      setApp((s) => ({ ...s, mode: 'agent' }));
      reload();
      if (edit) navigate('/application', { replace: true });
    }
  }

  async function submitCase(n: number) {
    if (!latest) return;
    const c = career[n];
    if (!c?.files.length) return toast('첨부할 파일을 선택해 주세요.');
    if (!c.description.trim()) return toast('경력 설명을 적어 주세요.');
    const ok = await run(() => submitCareerCase(latest.id, n, c.files, c.description.trim()), '경력 자료를 제출했어요.');
    if (ok) {
      // 제출한 사례는 '제출 완료'로 접는다. 다시 제출하려면 '다시 제출하기'를 누른다.
      const rest = { ...career };
      delete rest[n];
      setCareer(rest);
      reload();
    }
  }

  const titles = [
    ['어떤 도우미인가요?', '이용자가 보게 될 공개 프로필을 만들어요.'],
    ['활동에 필요한 확인', '본인인증·연락 방법·정산 계좌와 경력 자료를 확인해요.'],
    ['마지막으로 확인해 주세요', '입력한 내용이 공개 프로필에 이렇게 표시돼요.'],
  ][step];

  const footer = (text: string) => (
    <>
      <div className="account-form-error" role={error ? 'alert' : undefined} aria-live="polite">
        {error}
      </div>
      <div className="account-form-footer">
        {step > 0 && (
          <button type="button" className="btn secondary" onClick={() => setStep(step - 1)}>
            이전
          </button>
        )}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? '저장 중…' : text}
        </button>
      </div>
    </>
  );

  // 보완 요청이면 고칠 항목을 빨간 테두리로 표시하고 양식 맨 위에 사유를 보여 준다.
  const flaggedFields = !edit && latest?.status === 'changes' ? latest.changeFields : [];
  const fl = (key: string) => (flaggedFields.includes(key) ? 'account-flagged' : '');
  const changeBanner = flaggedFields.length > 0 && (
    <Note kind="error">
      운영팀이 보완을 요청한 항목을 빨간 테두리로 표시했어요: {flaggedFields.map((f) => fieldNames[f] ?? f).join(', ')}.{latest?.reviewNote ? ` 사유: ${latest.reviewNote}` : ''}
    </Note>
  );

  const profileForm = (
      <form noValidate onSubmit={saveStep0}>
        <Card title={edit ? '프로필 정보' : '공개 프로필'}>
          {changeBanner}
          <div className={`account-image-picker ${fl('image')}`}>
            <span className="avatar blue">
              {image || (edit ? state.approved?.imageUrl : latest?.imageUrl) ? <img src={image?.url ?? (edit ? state.approved?.imageUrl : latest?.imageUrl)} alt="" /> : p.activityName[0] || '나'}
              <span className="avatar-spark">✦</span>
            </span>
            <div>
              <strong>
                프로필 이미지 <small className="account-required">선택</small>
              </strong>
              <p>나를 표현하는 사진을 등록해 주세요.</p>
              <div className="account-inline">
                <label className="btn secondary account-file-label">
                  {image ? '이미지 변경' : '이미지 선택'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > 3 * 1024 * 1024) return toast('이미지는 3MB까지 올릴 수 있어요.');
                      setImage({ file: f, url: URL.createObjectURL(f) });
                    }}
                  />
                </label>
                {image && (
                  <button type="button" className="btn ghost" onClick={() => setImage(null)}>
                    삭제
                  </button>
                )}
              </div>
              <small>JPG · PNG / 최대 3MB</small>
            </div>
          </div>
          <Note>이 화면의 소개와 활동 정보는 공개 프로필에 표시돼요. 연락처와 인증 제출 자료는 공개하지 않습니다.</Note>
          <Field label="활동 닉네임" required className={fl('activityName')}>
            <input required maxLength={50} value={p.activityName} onChange={(e) => set({ activityName: e.target.value })} placeholder="활동할 이름을 입력해 주세요" />
          </Field>
          <Field label="한 줄 소개" required className={fl('headline')} helper="도우미 목록과 공개 프로필에 표시돼요. 최대 150자">
            <input required maxLength={150} value={p.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="어떤 도움을 드릴 수 있는지 소개해 주세요" />
          </Field>
          <Field label="상세 소개" required className={fl('bio')} helper="경험과 진행 방식을 직접 소개해 주세요. 직접 작성한 경력은 검증된 실적으로 표시되지 않아요.">
            <textarea rows={5} required maxLength={10000} value={p.bio} onChange={(e) => set({ bio: e.target.value })} />
          </Field>
          <fieldset className={`account-fieldset ${fl('platformIds')}`}>
            <legend>
              가능한 예매처 <small className="account-required">필수 · 복수 선택</small>
            </legend>
            <div className="account-choice-chips">
              {platforms.map((x) => (
                <label key={x.id}>
                  <input
                    type="checkbox"
                    checked={p.platformIds.includes(x.id)}
                    onChange={(e) => set({ platformIds: e.target.checked ? [...p.platformIds, x.id] : p.platformIds.filter((id) => id !== x.id) })}
                  />
                  <span>{x.name}</span>
                </label>
              ))}
            </div>
            {removedPlatforms.length > 0 && <p className="record-note">이전에 선택한 예매처 중 {removedPlatforms.length}곳이 삭제되어 선택에서 빠졌어요. 저장하면 공개 프로필에도 반영돼요.</p>}
            {!platforms.length && <p className="record-note">{platformsLoaded ? '선택할 수 있는 예매처가 없어요.' : platformsFailed ? '예매처 목록을 불러오지 못했어요.' : '예매처 목록을 불러오는 중이에요.'}</p>}
          </fieldset>
          <fieldset className={`account-fieldset ${fl('categories')}`}>
            <legend>
              공연 분야 <small className="account-required">필수 · 복수 선택</small>
            </legend>
            <div className="account-choice-chips">
              {/* 모두 가능: 모든 분야를 한 번에 고르거나 비운다(서버에는 분야 목록 그대로 저장). */}
              <label>
                <input
                  type="checkbox"
                  checked={p.categories.length === categories.length}
                  onChange={(e) => set({ categories: e.target.checked ? [...categories] : [], primaryCategory: e.target.checked ? p.primaryCategory : 'CONCERT' })}
                />
                <span>모두 가능</span>
              </label>
              {categories.map((c) => (
                <label key={c}>
                  <input
                    type="checkbox"
                    checked={p.categories.includes(c)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...p.categories, c] : p.categories.filter((x) => x !== c);
                      set({ categories: next, primaryCategory: next.includes(p.primaryCategory) ? p.primaryCategory : (next[0] ?? 'CONCERT') });
                    }}
                  />
                  <span>{categoryNames[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-grid">
            <Field label="주로 맡는 공연 분야" required className={fl('primaryCategory')}>
              <select required value={p.primaryCategory} onChange={(e) => set({ primaryCategory: e.target.value as Category })}>
                {(p.categories.length ? p.categories : categories).map((c) => (
                  <option key={c} value={c}>
                    {categoryNames[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="활동 가능 시간·일정" required className={fl('contactHoursNote')}>
              <input required maxLength={500} value={p.contactHoursNote ?? ''} onChange={(e) => set({ contactHoursNote: e.target.value })} placeholder="평일 18:00~23:00, 주말 오후" />
            </Field>
          </div>
          <Field label="최소 착수비 (원)" required className={fl('upfrontFeeKrw')} helper="예매에 착수하는 비용이에요. 공개 프로필에 최소 착수비로 표시합니다.">
            <MoneyInput required value={p.upfrontFeeKrw} onChange={(n) => set({ upfrontFeeKrw: n })} />
          </Field>
          {/* 수고비는 한 항목에서 범위로 입력한다(입력칸이 둘이라 label 대신 div로 묶는다). */}
          <div className={`field ${fl('successFee')}`}>
            <span>
              수고비 (원) <small className="account-required">필수</small>
            </span>
            <div className="account-range">
              <MoneyInput required aria-label="수고비 최소" value={p.successFeeMin} onChange={(n) => set({ successFeeMin: n })} />
              <span aria-hidden="true">~</span>
              <MoneyInput required aria-label="수고비 최대" value={p.successFeeMax} onChange={(n) => set({ successFeeMax: n })} />
            </div>
          </div>
          <p className="account-caption left">
            수고비는 협의한 성공 조건을 충족했을 때의 비용이에요.
            <br />
            공개 금액은 안내용이며, 거래별 최종 조건에서 금액을 확정합니다.
          </p>
          {footer(edit ? '변경 사항 저장' : '다음')}
        </Card>
      </form>
  );

  if (edit) {
    return (
      <>
        <PageTitle title="공개 프로필" crumbs={[{ label: '마이페이지', to: '/my' }]} />
        <p className="prose">이용자가 도우미 찾기와 프로필 화면에서 보는 정보예요. 저장하면 심사 없이 바로 반영돼요. 이미 승인된 인증과 경력 자료는 그대로 유지돼요.</p>
        <div className="detail-layout public-profile-layout">
          <div>{profileForm}</div>
          <aside className="public-profile-side">
            <VisibilityCard reload={reload} />
          </aside>
        </div>
      </>
    );
  }

  return (
    <div className="account-form-layout">
      <aside className="account-form-aside">
        <span className="tiny-label">도우미 신청</span>
        <h2>
          프로필부터
          <br />
          차근차근 준비해요.
        </h2>
        <p>
          단계마다 서버에 임시저장돼요.
          <br />
          잠시 나갔다 와도 이어서 작성할 수 있어요.
        </p>
        <Progress step={step} />
      </aside>
      <div>
        <PageTitle title={titles[0]} crumbs={[{ label: '마이페이지', to: '/my' }]} />
        <p className="prose">{titles[1]}</p>
        {step === 0 && profileForm}
        {step === 1 && (
          <form noValidate onSubmit={saveStep1}>
            <Card title="계정 인증">
              {changeBanner}
              <Note>본인인증과 정산 계좌 확인이 끝나야 심사를 신청할 수 있어요.</Note>
              <Verification title="본인인증" text="서로 안심하고 요청과 매칭을 시작해요." done={state.identityVerified}>
                {!state.identityVerified && (
                  <button type="button" className="btn secondary" disabled={pending} onClick={() => run(verifyIdentity, '본인인증을 완료했어요.').then((ok) => ok && reload())}>
                    확인하기
                  </button>
                )}
              </Verification>
              <Verification title="정산 계좌 확인" text="도우미 활동에 사용할 정산 정보를 확인해요. 본인 명의 계좌만 등록할 수 있어요." done={state.payoutVerified} doneText={state.payoutMasked ? `확인 완료 · ${state.payoutMasked}` : undefined} />
              {!state.payoutVerified && (
                <>
                  <Field label="은행" required className={fl('payout')}>
                    <select required value={bank.code} onChange={(e) => setBank({ ...bank, code: e.target.value })}>
                      {banks.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {/* 계좌번호 입력 오른쪽에 같은 높이의 확인 버튼(일반적인 계좌 인증 화면 배치). 버튼이 있어 label 대신 div로 묶는다. */}
                  <div className="field">
                    <span>
                      계좌번호 <small className="account-required">필수</small>
                    </span>
                    <div className="account-input-action">
                      <input required aria-label="계좌번호" inputMode="numeric" value={bank.number} placeholder="'-' 없이 숫자만 입력" onChange={(e) => setBank({ ...bank, number: e.target.value.replace(/[^0-9]/g, '') })} />
                      <button
                        type="button"
                        className="btn primary"
                        disabled={pending || !state.identityVerified || bank.number.length < 8}
                        onClick={() => run(() => verifyPayout(bank.code, bank.number), '정산 계좌를 확인했어요.').then((ok) => ok && reload())}
                      >
                        계좌 확인
                      </button>
                    </div>
                    <small className="field-helper">{state.identityVerified ? '예금주가 본인인증한 이름과 같아야 해요.' : '본인인증을 마친 뒤 계좌를 확인할 수 있어요.'}</small>
                  </div>
                </>
              )}
              {/* 매칭 후 연락 방법: 공개용(isPrimary) 연락처로 저장한다(PUT /api/me/contacts). 마이페이지 '연락처'와 같은 값이다. */}
              <div className="form-grid">
                <Field label="매칭 후 연락 방법" required className={fl('contact')}>
                  <select value={contactDraft.kind} onChange={(e) => setContact({ ...contactDraft, kind: e.target.value })}>
                    {Object.entries(contactKinds).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="연락처" required className={fl('contact')}>
                  <input required maxLength={250} type={contactDraft.kind === 'EMAIL' ? 'email' : 'text'} value={contactDraft.value} placeholder={contactPlaceholders[contactDraft.kind]} onChange={(e) => setContact({ ...contactDraft, value: e.target.value })} />
                </Field>
              </div>
              <p className="record-note">요청을 수락한 뒤 거래하는 이용자에게만 공개돼요. 공개 프로필에는 표시하지 않아요.</p>
            </Card>
            <Card title="경력 자료">
              <Field label="경력 요약" className={fl('careerDescription')} helper="공개 프로필의 활동 경력에 표시돼요.">
                <textarea rows={3} maxLength={3000} value={p.careerDescription ?? ''} onChange={(e) => set({ careerDescription: e.target.value })} placeholder="예: 2022년부터 콘서트·뮤지컬 예매를 도와 왔어요." />
              </Field>
              {/* 경력 인증: 자료와 설명을 한 묶음으로 제출한다(사례 1건). */}
              <div className={`account-career-upload ${fl('career')}`}>
                <div className="account-title-row">
                  <strong>
                    경력 인증 <small className="account-required">필수</small>
                  </strong>
                  {careerCase && (
                    <span className={`badge ${careerCase.scan === 'blocked' ? 'account-badge-error' : 'verified'}`}>
                      <Icon name="check" size={12} />
                      {scanLabels[careerCase.scan]}
                    </span>
                  )}
                </div>
                <p>
                  경력을 보여줄 자료(예매 내역·활동 기록 등)와 설명을 함께 제출해 주세요. 개인정보는 가려 주세요.
                  <br />
                  이미지·PDF / 파일당 최대 20MB / 최대 10개 · 비공개로 저장되고, 운영팀 파일 검토를 마친 뒤 심사를 신청할 수 있어요.
                </p>
                <button type="button" className="btn ghost" disabled={pending} onClick={reload}>파일 검토 상태 새로고침</button>
                {!careerCase || career[1] ? (
                  <>
                    <FilePicker kind="career" files={career[1]?.files ?? []} onChange={(files) => setCareer({ ...career, 1: { description: career[1]?.description ?? '', files: files.slice(0, 10) } })} />
                    <Field label="설명" required>
                      <textarea rows={3} maxLength={10000} value={career[1]?.description ?? ''} onChange={(e) => setCareer({ ...career, 1: { files: career[1]?.files ?? [], description: e.target.value } })} placeholder="예: 2024년 ○○ 콘서트 예매 내역이에요. 좌석 정보만 남기고 가렸어요." />
                    </Field>
                    <button type="button" className="btn secondary" disabled={pending} onClick={() => void submitCase(1)}>
                      {careerCase ? '경력 자료 다시 제출' : '경력 자료 제출'}
                    </button>
                  </>
                ) : (
                  <button type="button" className="text-link" onClick={() => setCareer({ ...career, 1: { files: [], description: '' } })}>
                    다시 제출하기
                  </button>
                )}
              </div>
              <Field label="사업자 등록번호" className={fl('business')} helper="예: 123-45-67890">
                <input value={business} onChange={(e) => setBusiness(e.target.value)} pattern="[0-9]{3}-?[0-9]{2}-?[0-9]{5}" placeholder="선택 사항" />
              </Field>
              <div className="account-agreements">
                {(
                  [
                    ['rules', '도우미 활동 기준 및 금지사항'],
                    ['contact', '요청 수락 후 연락처 제공'],
                  ] as const
                ).map(([key, t]) => (
                  <div key={key}>
                    <label className="check-row">
                      <input type="checkbox" required checked={agreed[key]} onChange={(e) => setAgreed({ ...agreed, [key]: e.target.checked })} />
                      <span>
                        {t} <small>(필수)</small>
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              {footer('다음')}
            </Card>
          </form>
        )}
        {step === 2 && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="application-detail-preview">
              <DetailPreview p={p} platformNames={platformNames} image={image?.url ?? latest?.imageUrl} footer={footer(edit ? '수정한 프로필 심사 신청' : '도우미 신청 제출')} />
              <Note>소개와 경력은 직접 작성한 정보예요. 제출한 자료에 대한 검토 전에는 인증된 경력이나 플랫폼 거래 실적으로 표시되지 않습니다.</Note>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
