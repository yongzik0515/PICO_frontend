import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { getTokens, setTokens } from '../api/tokens';
import { banks, fetchAgentState, verifyIdentity, verifyPayout } from '../agent/profile';
import { useAppState, type Mode } from '../AppState';
import { useAuth } from '../auth/AuthContext';
import { fetchRequests, latestAgreement, toAgreement, useLoad } from '../transactions/model';
import { Field, useAction, utcToLocal, won } from '../transactions/ui';
import { AccountCard, AccountInput, AccountNote, Verification } from '../ui/account';
import { tokenFrom } from '../ui/format';
import { Icon } from '../ui/Icon';
import { ImagePreview } from '../ui/ImagePreview';
import { Modal } from '../ui/Modal';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';

// 프로토타입 account.js의 my()/userProfile()/contacts()/account()와 transactions.js의 historyPage()
// 명세에 없는 기능(고객 문의 작성·현황, 이용자의 결제 내역 목록)은 넣지 않았다.

const statusLabels: Record<string, string> = { none: '미신청', draft: '작성 중', review: '심사 중', approved: '승인', rejected: '반려' };
const kindNames: Record<string, string> = { PHONE: '전화번호', KAKAO: '카카오톡 ID', EMAIL: '이메일' };
const kindPlaceholder: Record<string, string> = { PHONE: '010-0000-0000', KAKAO: '카카오톡 ID', EMAIL: 'name@example.com' };

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="avatar blue large">
      {url ? <ImagePreview src={url} alt={`${name} 프로필`} /> : name[0] || '나'}
      <span className="avatar-spark">✦</span>
    </span>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="empty" role="status">
      <p>{text}</p>
    </div>
  );
}

// ── 마이페이지 ─────────────────────────────────────────────
export function MyPage() {
  const navigate = useNavigate();
  const { me, logout, avatarUrl: avatar } = useAuth();
  const [{ mode }, setState] = useAppState();
  const agent = mode === 'agent';
  const name = str(me?.nickname) ?? '회원';
  const [load] = useLoad(async () => {
    const [agentState, counts, balance] = await Promise.all([
      fetchAgentState().catch(() => null),
      unwrap<Raw>(api.GET('/api/requests/counts', { params: { query: { role: 'REQUESTER' } } })).catch(() => null),
      unwrap(api.GET('/api/matching-passes/balance')).then(
        (b) => num(pick(b, 'remainingUnits')) ?? 0,
        () => null,
      ),
    ]);
    const requestCount = counts ? Object.values(counts).reduce<number>((n, v) => n + (num(v) ?? 0), 0) : null;
    return { agentState, requestCount, balance };
  }, [mode]);

  const data = load.status === 'done' ? load.data : null;
  const approved = !!data?.agentState?.approved;
  const applicationStatus = data?.agentState?.latest?.status ?? 'none';

  function switchMode(next: Mode) {
    if (next === mode) return;
    setState((s) => ({ ...s, mode: next }));
    // 명세: PATCH /api/me로 기본 모드를 저장한다(헤더 전환과 같음).
    if (typeof me?.nickname === 'string') void api.PATCH('/api/me', { body: { nickname: me.nickname, preferredMode: next === 'agent' ? 'AGENT' : 'REQUESTER' } }).catch(() => undefined);
  }

  const items: [string, string, string][] = [
    [agent ? '도우미 프로필' : '이용자 프로필', '닉네임 · 연락처 · 계정 인증 · 아이디·비밀번호', '/user-profile'],
    // 승인된 도우미는 공개 프로필 화면(/helper-profile: 바로 수정·공개 설정)으로, 아직이면 신청 현황(/application)으로 간다.
    ...(agent ? ([['공개 프로필', '도우미 소개와 활동 정보 · 공개 설정', approved ? '/helper-profile' : '/application']] as [string, string, string][]) : []),
    ['거래 내역', agent ? '매칭권 충전 · 사용 · 정산' : '안전거래 결제', '/history'],
    ['좋아요한 도우미', '저장한 도우미 보기', '/favorites'],
    ['신고 내역', '접수한 신고와 처리 결과', '/reports'],
    ['이용 방법', '서비스 이용 안내', '/guide'],
    ['문의 작성', '궁금한 내용 문의하기', '/inquiries'],
    ['문의 현황', '작성한 문의와 답변 확인', '/inquiries/history'],
    ['이용약관', '서비스 이용 기준', '/terms'],
    ['개인정보 안내', '정보 처리 안내', '/privacy'],
  ];

  return (
    <>
      <PageTitle title="마이페이지" />
      <div className="account-my-layout">
        <section className="content-card account-my-profile">
          <div className="account-preview-heading">
            <Avatar url={avatar} name={name} />
            <div>
              <h2>{name}</h2>
              <div className="my-identity-line">
                <span>{str(me?.email)}</span>
                <div className="account-role-switch">
                  <button type="button" className={`btn ${!agent ? 'primary' : 'ghost'}`} onClick={() => switchMode('user')}>
                    이용자
                  </button>
                  <button type="button" className={`btn ${agent ? 'primary' : 'ghost'}`} onClick={() => switchMode('agent')}>
                    도우미
                  </button>
                </div>
              </div>
            </div>
            <button type="button" className="btn ghost" onClick={() => void logout().then(() => navigate('/'))}>
              로그아웃
            </button>
          </div>
          <div className="account-menu-list">
            {items.map(([title, desc, to]) => (
              <button key={to} type="button" onClick={() => navigate(to)}>
                <span>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
        <aside>
          {agent ? (
            approved ? (
              <AccountCard title="나의 매칭권">
                <div className="display-price">
                  {data?.balance ?? '-'}
                  <small>장</small>
                </div>
                <p className="prose">요청을 수락할 때 1장씩 사용해요.</p>
                <button type="button" className="btn primary full" onClick={() => navigate('/credits')}>
                  매칭권 충전
                </button>
                <button type="button" className="btn ghost full" onClick={() => navigate('/history')}>
                  충전 내역 보기
                </button>
              </AccountCard>
            ) : (
              <AccountCard title="도우미 신청 현황">
                <span className="badge neutral">{statusLabels[applicationStatus]}</span>
                <p className="prose">신청 진행 상태를 확인하고 이어서 준비하세요.</p>
                <button type="button" className="btn primary full" onClick={() => navigate('/application')}>
                  신청 상태 확인
                </button>
              </AccountCard>
            )
          ) : (
            <AccountCard title="나의 티켓팅">
              <div className="account-my-count">
                <strong>{data?.requestCount ?? '-'}</strong>
                <span>개의 요청과 거래</span>
              </div>
              <p className="prose">
                보낸 요청부터 완료된 예매까지
                <br />내 활동에서 확인하세요.
              </p>
              <button type="button" className="btn primary full" onClick={() => navigate('/requests')}>
                내 활동 보기
              </button>
            </AccountCard>
          )}
          <AccountCard title="연락처 공개 안내">
            <p className="prose">선택한 연락처는 요청 수락 후 해당 상대방에게만 공개돼요. 공개 프로필에는 포함되지 않아요.</p>
          </AccountCard>
        </aside>
      </div>
    </>
  );
}

// ── 이용자·도우미 프로필(닉네임·이미지·연락처) ────────────────
// 참고 프로토타입 userProfile(): 카드 하나에 기본 정보·매칭 후 연락 방법·계정 인증을 두고 '변경 내용 저장' 하나로 저장한다.
// 연락 방법은 공개용(isPrimary) 연락처 하나로 관리한다(PUT /api/me/contacts, 같은 종류는 새 값으로 바뀜).
export function UserProfilePage() {
  const toast = useToast();
  const { me, reloadMe, avatarUrl: avatar } = useAuth();
  const [{ mode }] = useAppState();
  const [contactsLoad, reloadContacts] = useLoad(() => unwrap<unknown>(api.GET('/api/me/contacts')).then(list), []);
  const [nickname, setNickname] = useState<string | null>(null);
  const [contact, setContact] = useState<{ kind: string; value: string } | null>(null);
  const { pending, run } = useAction();
  const name = nickname ?? str(me?.nickname) ?? '';
  const primary = contactsLoad.status === 'done' ? contactsLoad.data.find((c) => c.isPrimary === true) : undefined;
  const draft = contact ?? { kind: str(primary?.kind) ?? 'PHONE', value: str(primary?.value) ?? '' };

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return e.currentTarget.querySelector<HTMLElement>(':invalid')?.focus();
    const nameChanged = name.trim() !== (str(me?.nickname) ?? '');
    const contactChanged = !!contact && (contact.kind !== str(primary?.kind) || contact.value.trim() !== (str(primary?.value) ?? ''));
    if (!nameChanged && !contactChanged) return toast('바뀐 내용이 없어요.');
    const preferredMode = mode === 'agent' ? 'AGENT' : 'REQUESTER';
    const ok = await run(async () => {
      if (nameChanged) await unwrap(api.PATCH('/api/me', { body: { nickname: name.trim(), preferredMode } }));
      if (contactChanged) await unwrap(api.PUT('/api/me/contacts', { body: { kind: draft.kind as 'PHONE', value: draft.value.trim(), primary: true } }));
    }, '변경 내용을 저장했어요.');
    if (ok) {
      setContact(null);
      if (nameChanged) void reloadMe();
      if (contactChanged) reloadContacts();
    }
  }

  async function uploadAvatar(file: File) {
    if (file.size > 3 * 1024 * 1024) return toast('이미지는 3MB까지 올릴 수 있어요.');
    const ok = await run(async () => {
      // 명세: POST /api/files/upload-url(ACCOUNT_AVATAR) → 업로드 → PUT /api/me/avatar
      const target = await unwrap(api.POST('/api/files/upload-url', { body: { purpose: 'ACCOUNT_AVATAR', originalName: file.name, mimeType: file.type, sizeBytes: file.size } }));
      const res = await fetch(target.uploadUrl!, { method: target.method || 'PUT', headers: target.requiredHeaders, body: file });
      if (!res.ok) throw new Error('이미지를 올리지 못했어요.');
      await unwrap(api.PUT('/api/me/avatar', { body: { storageKey: target.storageKey! } }));
    }, '프로필 이미지를 바꿨어요.');
    if (ok) await reloadMe();
  }

  return (
    <div className="account-contained">
      <PageTitle title={mode === 'agent' ? '도우미 프로필' : '이용자 프로필'} crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <section className="content-card">
        <form noValidate onSubmit={save}>
          <div className="account-image-picker">
            <Avatar url={avatar} name={name} />
            <div>
              <strong>
                프로필 이미지 <small className="account-required">선택</small>
              </strong>
              <p>나를 표현하는 사진을 등록해 주세요.</p>
              <div className="account-inline">
                <label className="btn secondary account-file-label">
                  {avatar ? '이미지 변경' : '이미지 선택'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void uploadAvatar(f);
                    }}
                  />
                </label>
              </div>
              <small>JPG · PNG / 최대 3MB</small>
            </div>
          </div>
          <Field label="닉네임" required helper="요청과 후기에서 사용하는 이름이에요. 최대 50자">
            <input required maxLength={50} value={name} onChange={(e) => setNickname(e.target.value)} placeholder="함께 부를 이름을 알려주세요" />
          </Field>
          <Field label="로그인 이메일" helper="로그인할 때 사용하는 아이디예요. 아래 '아이디(로그인 이메일) 변경'에서 바꿀 수 있어요.">
            <input type="email" value={str(me?.email) ?? ''} disabled />
          </Field>
          {contactsLoad.status === 'loading' ? (
            <Loading text="연락처를 불러오는 중이에요." />
          ) : (
            <div className="form-grid">
              <Field label="매칭 후 연락 방법" required>
                <select value={draft.kind} onChange={(e) => setContact({ ...draft, kind: e.target.value })}>
                  {Object.entries(kindNames).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="연락처" required>
                <input required maxLength={250} type={draft.kind === 'EMAIL' ? 'email' : 'text'} value={draft.value} placeholder={kindPlaceholder[draft.kind]} onChange={(e) => setContact({ ...draft, value: e.target.value })} />
              </Field>
            </div>
          )}
          <AccountNote>선택한 연락처는 요청이 수락된 후 해당 거래 상대방에게만 공개돼요. 도우미의 공개 프로필에는 표시하지 않습니다.</AccountNote>
          <div className="account-form-footer">
            <button type="submit" className="btn primary" disabled={pending || !name.trim()}>
              변경 내용 저장
            </button>
          </div>
        </form>
      </section>
      <AccountSections primaryContact={primary} />
    </div>
  );
}

// ── 계정·인증 ─────────────────────────────────────────────
/** 예전 계정·인증 화면(/account)은 프로필 화면으로 합쳤다. 예전 주소로 와도 프로필로 보낸다. */
export function AccountPage() {
  return <Navigate to="/user-profile" replace />;
}

// 계정 인증 · 아이디(로그인 이메일)·비밀번호 변경 · 로그아웃/탈퇴. 참고 프로토타입처럼 프로필 화면 아래 카드로 모은다.
function AccountSections({ primaryContact }: { primaryContact?: Raw }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { me, logout } = useAuth();
  const [load, reload] = useLoad(fetchAgentState, []);
  const { pending, run } = useAction();
  const [bank, setBank] = useState({ code: '004', number: '' });
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const state = load.status === 'done' ? load.data : null;
  const applicationStatus = state?.latest?.status ?? 'none';
  // GET /api/me의 loginVerifiedAt: 로그인 이메일 인증 시각(미인증이면 null). 응답에 키가 없으면(불러오기 전 등) 표시하지 않는다.
  const emailVerified = me && 'loginVerifiedAt' in me ? !!pick(me, 'loginVerifiedAt') : null;

  // 명세: 비밀번호·이메일 변경, 탈퇴는 모든 세션을 폐기한다. 로그인 정보를 지우고 로그인 화면으로 보낸다.
  function signOut(message: string, to = '/login') {
    setTokens(null);
    toast(message);
    navigate(to, { replace: true });
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const d = new FormData(form);
    if (d.get('newPassword') !== d.get('confirmPassword')) return toast('새 비밀번호가 서로 달라요.');
    const ok = await run(() => unwrap(api.PUT('/api/me/password', { body: { currentPassword: String(d.get('currentPassword')), newPassword: String(d.get('newPassword')) } })));
    if (ok) signOut('비밀번호를 바꿨어요. 새 비밀번호로 다시 로그인해 주세요.');
  }

  async function changeEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const d = new FormData(form);
    const ok = await run(
      () => unwrap(api.POST('/api/me/email-change', { body: { currentPassword: String(d.get('emailPassword')), newEmail: String(d.get('newEmail')) } })),
      '새 이메일로 인증 메일을 보냈어요. 메일의 링크를 열면 변경이 완료돼요.',
    );
    if (ok) form.reset();
  }

  return (
    <>
      <AccountCard title="계정 인증">
        {!state ? (
          <Loading text="인증 상태를 불러오는 중이에요." />
        ) : (
          <>
            <Verification title="본인인증" text="서로 안심하고 요청과 매칭을 시작해요." done={state.identityVerified}>
              {!state.identityVerified && (
                <button type="button" className="btn secondary" disabled={pending} onClick={() => run(verifyIdentity, '본인인증을 완료했어요.').then((ok) => ok && reload())}>
                  확인하기
                </button>
              )}
            </Verification>
            <Verification
              title="연락처 확인"
              text="매칭 후 연락받을 방법을 확인해요."
              done={!!primaryContact}
              doneText={primaryContact ? `등록 완료 · ${kindNames[str(primaryContact.kind) ?? ''] ?? str(primaryContact.kind)}` : undefined}
            />
            {applicationStatus !== 'none' && (
              <>
                <Verification
                  title="정산 계좌 확인"
                  text="도우미 활동에 사용할 정산 정보를 확인해요. 본인 명의 계좌만 등록할 수 있어요."
                  done={state.payoutVerified}
                  doneText={state.payoutMasked ? `확인 완료 · ${state.payoutMasked}` : undefined}
                />
                {state.payoutVerified && !state.payoutRegistered && (
                  <AccountNote>지급대행 연동 전에 확인한 계좌예요. 착수비·성공보수를 받으려면 계좌를 한 번 다시 등록해 주세요.</AccountNote>
                )}
                <Field label="은행" required>
                  <select value={bank.code} onChange={(e) => setBank({ ...bank, code: e.target.value })}>
                    {banks.map(([code, bankName]) => (
                      <option key={code} value={code}>
                        {bankName}
                      </option>
                    ))}
                  </select>
                </Field>
                {/* 도우미 신청 화면과 같은 배치: 계좌번호 입력 오른쪽에 같은 높이의 확인 버튼 */}
                <div className="field">
                  <span>
                    계좌번호 <em>*</em>
                  </span>
                  <div className="account-input-action">
                    <input aria-label="계좌번호" inputMode="numeric" value={bank.number} placeholder="'-' 없이 숫자만 입력" onChange={(e) => setBank({ ...bank, number: e.target.value.replace(/[^0-9]/g, '') })} />
                    <button
                      type="button"
                      className="btn primary"
                      disabled={pending || !state.identityVerified || bank.number.length < 8}
                      onClick={() => run(() => verifyPayout(bank.code, bank.number), '정산 계좌를 확인했어요.').then((ok) => ok && reload())}
                    >
                      {state.payoutVerified ? '계좌 변경' : '계좌 확인'}
                    </button>
                  </div>
                  <small className="field-helper">{state.identityVerified ? '예금주가 본인인증한 이름과 같아야 해요.' : '본인인증을 마친 뒤 계좌를 확인할 수 있어요.'}</small>
                </div>
              </>
            )}
          </>
        )}
      </AccountCard>
      <AccountCard title="아이디(로그인 이메일) 변경">
        <p className="prose">
          지금 아이디: <strong>{str(me?.email) || '미입력'}</strong>{' '}
          {emailVerified === true && <span className="badge verified">인증 완료</span>}
          {emailVerified === false && (
            <button type="button" className="text-link" disabled={pending} onClick={() => run(() => unwrap(api.POST('/api/me/email-verification')), '인증 메일을 보냈어요. 메일의 링크를 열어 주세요.')}>
              인증 메일 받기
            </button>
          )}
        </p>
        <form noValidate onSubmit={changeEmail}>
          <AccountInput name="newEmail" label="새 이메일" type="email" required maxLength={191} placeholder="name@example.com" />
          <AccountInput name="emailPassword" label="현재 비밀번호" type="password" required maxLength={72} autoComplete="current-password" />
          <AccountNote>새 이메일로 받은 인증 링크를 열 때까지는 지금 이메일로 로그인해요. 변경이 끝나면 다시 로그인해야 해요.</AccountNote>
          <div className="account-form-footer">
            <button type="submit" className="btn primary" disabled={pending}>
              인증 메일 보내기
            </button>
          </div>
        </form>
      </AccountCard>
      <AccountCard title="비밀번호 변경">
        <form noValidate onSubmit={changePassword}>
          <AccountInput name="currentPassword" label="현재 비밀번호" type="password" required maxLength={72} autoComplete="current-password" />
          <AccountInput name="newPassword" label="새 비밀번호" type="password" required minLength={10} maxLength={72} autoComplete="new-password" helper="10자 이상 72자 이하로 입력해 주세요." />
          <AccountInput name="confirmPassword" label="새 비밀번호 확인" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
          <AccountNote>비밀번호를 바꾸면 모든 기기에서 로그아웃돼요.</AccountNote>
          <div className="account-form-footer">
            <button type="submit" className="btn primary" disabled={pending}>
              비밀번호 변경
            </button>
          </div>
        </form>
      </AccountCard>
      <div className="title-between">
        <button className="account-logout" type="button" onClick={() => void logout().then(() => navigate('/'))}>
          <Icon name="logout" size={18} />
          로그아웃
        </button>
        <button className="report-link" type="button" onClick={() => setWithdrawOpen(true)}>
          회원 탈퇴
        </button>
      </div>
      {withdrawOpen && (
        <Modal title="정말 탈퇴할까요?" onClose={() => setWithdrawOpen(false)}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (!withdrawPassword) return;
              const ok = await run(() => unwrap(api.DELETE('/api/me', { body: { password: withdrawPassword } })));
              if (ok) signOut('탈퇴했어요. 그동안 이용해 주셔서 고마워요.', '/');
            }}
          >
            <p className="prose">탈퇴하면 계정으로 로그인할 수 없고, 연락처·본인인증·정산계좌 정보는 바로 지워져요. 거래·결제 기록은 법에 따라 보관돼요.</p>
            <p className="prose">진행 중인 거래가 있거나 받을 돈·환불받을 돈이 남아 있으면 탈퇴할 수 없어요. 탈퇴 후 30일 동안은 같은 명의로 다시 본인인증을 할 수 없어요(도우미 활동이 정지된 상태에서 탈퇴하면 3년).</p>
            <Field label="비밀번호 확인" required>
              <input type="password" required maxLength={72} value={withdrawPassword} onChange={(e) => setWithdrawPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setWithdrawOpen(false)}>
                돌아가기
              </button>
              <button type="submit" className="btn danger" disabled={!withdrawPassword || pending}>
                탈퇴하기
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ── 이메일 인증 링크 ───────────────────────────────────────
// 토큰은 한 번만 쓸 수 있어서, 같은 토큰으로 다시 부르지 않게 결과를 기억한다(개발 모드의 effect 두 번 실행 등).
const confirming = new Map<string, Promise<void>>();
function confirmEmail(token: string) {
  if (!confirming.has(token))
    confirming.set(
      token,
      unwrap(api.POST('/api/auth/email-verification/confirm', { body: { token } })).then(async () => {
        // 이메일 변경 확정이면 서버가 모든 세션을 폐기하고, 가입 인증이면 세션을 그대로 둔다.
        // 링크만으로는 둘을 구별할 수 없어 내 정보를 다시 불러 본다. 세션이 끊겼으면 토큰 갱신이 실패하며 로그인 정보가 지워진다.
        if (!getTokens()) return;
        await api.GET('/api/me').catch(() => undefined);
      }),
    );
  return confirming.get(token)!;
}

/**
 * 인증 메일의 링크(/verify-email?token=…)로 들어오면 POST /api/auth/email-verification/confirm으로 확정한다.
 * 가입 인증과 이메일 변경 확인이 같은 링크를 쓴다. 링크가 열리지 않으면 토큰을 붙여 넣어 확인한다.
 */
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  // 토큰마다 새로 확인한다(붙여 넣은 토큰으로 바뀌면 이전 결과를 버린다).
  if (token) return <VerifyEmailResult key={token} token={token} />;
  return (
    <div className="account-contained account-complete">
      <section className="content-card">
        <h1>이메일 인증</h1>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
            const value = tokenFrom(String(new FormData(form).get('token') ?? ''));
            if (value) navigate(`/verify-email?token=${encodeURIComponent(value)}`, { replace: true });
          }}
        >
          <AccountNote>메일의 인증 링크가 열리지 않으면 링크를 복사해 아래에 붙여 넣어 주세요. 링크 전체나 token= 뒤의 값을 넣으면 돼요. 인증 링크는 15분 동안만 쓸 수 있어요.</AccountNote>
          <AccountInput name="token" label="인증 토큰" required maxLength={2000} autoComplete="off" placeholder="메일로 받은 링크 또는 토큰" />
          <button type="submit" className="btn primary full">
            이메일 인증하기
          </button>
        </form>
      </section>
    </div>
  );
}

function VerifyEmailResult({ token }: { token: string }) {
  const navigate = useNavigate();
  const [load] = useLoad(() => confirmEmail(token), [token]);
  return (
    <div className="account-contained account-complete">
      <section className="content-card">
        {load.status === 'loading' ? (
          <p className="prose">이메일을 확인하고 있어요.</p>
        ) : load.status === 'error' ? (
          <>
            <h1>이메일을 확인하지 못했어요</h1>
            <p className="prose">{load.message} 인증 링크는 15분 동안만 쓸 수 있어요.</p>
            <button type="button" className="btn secondary full" onClick={() => navigate('/verify-email', { replace: true })}>
              토큰 다시 입력하기
            </button>
            <button type="button" className="btn primary full" onClick={() => navigate('/my')}>
              마이페이지로
            </button>
          </>
        ) : (
          <>
            <div className="success-circle">
              <Icon name="check" size={32} />
            </div>
            <h1>이메일 인증을 마쳤어요</h1>
            {getTokens() ? (
              <button type="button" className="btn primary full" onClick={() => navigate('/my', { replace: true })}>
                마이페이지로
              </button>
            ) : (
              <>
                <p className="prose">이메일을 바꾼 경우에는 새 이메일로 다시 로그인해 주세요.</p>
                <button type="button" className="btn primary full" onClick={() => navigate('/login', { replace: true })}>
                  로그인하기
                </button>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── 거래 내역(도우미) ──────────────────────────────────────
const payoutStatus: Record<string, string> = { REQUESTED: '지급 요청', PROCESSING: '지급 중', SUCCEEDED: '지급 완료', FAILED: '지급 실패', CANCELLED: '지급 취소' };
const componentNames: Record<string, string> = { UPFRONT: '착수비', SUCCESS: '수고비', SAFETY_FEE: '수수료' };

export function HistoryPage() {
  const [{ mode }] = useAppState();
  return mode === 'agent' ? <AgentHistory /> : <UserPaymentHistory />;
}

const paymentNames: Record<string, string> = { PENDING: '입금 대기', PROCESSING: '확인 중', PAID: '결제 완료', CANCEL_REQUESTED: '취소·환불 진행 중', PARTIALLY_REFUNDED: '일부 환불', REFUNDED: '전액 환불', FAILED: '결제 실패', CANCELLED: '입금 전 취소', EXPIRED: '입금 기한 만료' };

/** 이용자 거래 내역(안전거래 결제). 명세에 이용자 결제 목록 API가 없어, 내 요청 중 결제가 있는 거래를 골라 확정 조건의 금액으로 보여 준다(USER_FLOW.md 10번). */
function UserPaymentHistory() {
  const navigate = useNavigate();
  const [load] = useLoad(async () => {
    const paid = (await fetchRequests('REQUESTER')).filter((r) => r.paymentStatus);
    return Promise.all(
      paid.map(async (r) => {
        const agreements = await unwrap<unknown>(api.GET('/api/requests/{requestId}/agreements', { params: { path: { requestId: r.id } } })).then(list, () => [] as Raw[]);
        const a = latestAgreement(agreements.map(toAgreement));
        return { r, amount: a ? a.upfrontFeeKrw + a.successFeeKrw + a.safetyFeeKrw : undefined };
      }),
    );
  }, []);
  return (
    <>
      <PageTitle title="거래 내역" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <div className="tx-history">
        {load.status === 'loading' ? (
          <Loading text="내역을 불러오는 중이에요." />
        ) : load.status === 'error' ? (
          <div className="empty">
            <h2>내역을 불러오지 못했어요</h2>
            <p>{load.message}</p>
          </div>
        ) : load.data.length ? (
          load.data.map(({ r, amount }) => (
            <article key={r.id} className="content-card">
              <div>
                <span className={`tx-status ${r.paymentStatus === 'PAID' ? 'blue' : r.paymentStatus === 'PENDING' ? 'amber' : 'muted'}`}>{paymentNames[r.paymentStatus] ?? r.paymentStatus}</span>
                <h3>{r.targetName || '공연명 미입력'}</h3>
                <p>
                  {r.agentName} 도우미 · 안전거래{r.createdAt ? ` · 요청 ${utcToLocal(r.createdAt)}` : ''}
                </p>
              </div>
              <div>
                <strong>{amount !== undefined ? won(amount) : '금액 확인 중'}</strong>
                <button type="button" className="btn secondary" onClick={() => navigate(`/requests/${r.id}`)}>
                  거래 상세 보기
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            <h2>아직 결제한 거래가 없어요</h2>
            <p>최종 조건을 확정한 안전거래를 결제하면 이곳에 기록돼요. 환불 내역은 거래 상세에서 확인할 수 있어요.</p>
          </div>
        )}
      </div>
    </>
  );
}

/** 도우미 거래 내역: 매칭권 충전·사용과 정산 내역. */
function AgentHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'purchases' | 'usages' | 'payouts'>('purchases');
  const [load] = useLoad(async () => {
    const [purchases, usages, payouts] = await Promise.all([
      unwrap<unknown>(api.GET('/api/matching-passes/purchases', { params: { query: { page: 0, size: 50 } } })).then(list, () => []),
      unwrap<unknown>(api.GET('/api/matching-passes/usages')).then(list, () => []),
      unwrap<unknown>(api.GET('/api/me/payouts')).then(list, () => []),
    ]);
    return { purchases, usages, payouts };
  }, []);
  const data = load.status === 'done' ? load.data : null;
  const rows = data?.[tab] ?? [];
  const tabs: [typeof tab, string][] = [
    ['purchases', '매칭권 충전'],
    ['usages', '매칭권 사용'],
    ['payouts', '정산'],
  ];

  return (
    <>
      <PageTitle title="거래 내역" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <div className="request-tabs tx-tabs" role="tablist" aria-label="거래 내역 분류">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="tx-history">
        {!data ? (
          <Loading text="내역을 불러오는 중이에요." />
        ) : rows.length ? (
          rows.map((r, i) => (
            <article key={i} className="content-card">
              {tab === 'purchases' ? (
                <>
                  <div>
                    <span className={`tx-status ${r.grantedAt ? 'blue' : 'amber'}`}>{r.grantedAt ? '충전 완료' : '결제 대기'}</span>
                    <h3>매칭권 {num(r.purchasedUnits)}장</h3>
                    <p>{utcToLocal(str(r.createdAt) ?? '')}</p>
                  </div>
                  <div>
                    <strong>{won(num(r.priceKrw))}</strong>
                  </div>
                </>
              ) : tab === 'usages' ? (
                <>
                  <div>
                    <span className={`tx-status ${r.restored ? 'amber' : 'blue'}`}>{r.restored ? '복구됨' : '사용'}</span>
                    <h3>요청 수락 · 매칭권 1장</h3>
                    <p>
                      {utcToLocal(str(r.usedAt) ?? '')}
                      {r.restoredAt ? ` · 복구 ${utcToLocal(str(r.restoredAt) ?? '')}` : ''}
                    </p>
                  </div>
                  <div>
                    <button type="button" className="btn secondary" onClick={() => navigate(`/requests/${num(r.requestId)}`)}>
                      거래 상세 보기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className={`tx-status ${str(r.status) === 'SUCCEEDED' ? 'blue' : 'amber'}`}>{payoutStatus[str(r.status) ?? ''] ?? str(r.status)}</span>
                    <h3>{componentNames[str(r.component) ?? ''] ?? str(r.component)} 정산</h3>
                    <p>{utcToLocal(str(r.completedAt ?? r.requestedAt) ?? '')}</p>
                  </div>
                  <div>
                    <strong>{won(num(r.amountKrw))}</strong>
                    <button type="button" className="btn secondary" onClick={() => navigate(`/requests/${num(r.requestId)}`)}>
                      거래 상세 보기
                    </button>
                  </div>
                </>
              )}
            </article>
          ))
        ) : (
          <div className="empty">
            <h2>아직 내역이 없어요</h2>
            <p>{tab === 'payouts' ? '안전거래만 정산돼요. 착수비는 착수 후 시도 증빙이 승인되거나 결과가 확정되면, 수고비는 성공(부분 성공이면 정산에 합의한 금액)으로 확정되면 정산 계좌로 지급을 요청해요.' : '매칭권을 충전하거나 요청을 수락하면 이곳에 기록돼요.'}</p>
            {tab === 'purchases' && (
              <button type="button" className="btn primary" onClick={() => navigate('/credits')}>
                매칭권 충전
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
