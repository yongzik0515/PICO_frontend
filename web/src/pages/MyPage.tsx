import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { getTokens, setTokens } from '../api/tokens';
import { banks, fetchAgentState, verifyIdentity, verifyPayout } from '../agent/profile';
import { useAppState, type Mode } from '../AppState';
import { useAuth } from '../auth/AuthContext';
import { useLoad } from '../transactions/model';
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
    [agent ? '도우미 프로필' : '이용자 프로필', '닉네임 · 프로필 이미지 · 연락처 관리', '/user-profile'],
    // 신청 현황(/application)에 승인 후 '공개 프로필 수정' 버튼과 공개 설정(목록 공개·새 요청 받기)이 함께 있다.
    ...(agent ? ([['공개 프로필', '도우미 소개와 활동 정보 · 공개 설정', '/application']] as [string, string, string][]) : []),
    ['계정·인증', '이메일 · 비밀번호 · 본인인증 · 정산 계좌', '/account'],
    ...(agent ? ([['거래 내역', '매칭권 충전 · 사용 · 정산', '/history']] as [string, string, string][]) : []),
    ['좋아요한 도우미', '저장한 도우미 보기', '/favorites'],
    ['신고 내역', '접수한 신고와 처리 결과', '/reports'],
    ['이용 방법', '서비스 이용 안내', '/guide'],
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
export function UserProfilePage() {
  const toast = useToast();
  const { me, reloadMe, avatarUrl: avatar } = useAuth();
  const [{ mode }] = useAppState();
  const [contactsLoad, reloadContacts] = useLoad(() => unwrap<unknown>(api.GET('/api/me/contacts')).then(list), []);
  const [nickname, setNickname] = useState<string | null>(null);
  const [contact, setContact] = useState({ kind: 'PHONE', value: '', primary: true });
  const { pending, run } = useAction();
  const name = nickname ?? str(me?.nickname) ?? '';
  const contacts = contactsLoad.status === 'done' ? contactsLoad.data : [];

  async function saveNickname(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return;
    const preferredMode = mode === 'agent' ? 'AGENT' : 'REQUESTER';
    if (await run(() => unwrap(api.PATCH('/api/me', { body: { nickname: name.trim(), preferredMode } })), '닉네임을 저장했어요.')) void reloadMe();
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

  async function saveContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return;
    const ok = await run(
      () => unwrap(api.PUT('/api/me/contacts', { body: { kind: contact.kind as 'PHONE', value: contact.value.trim(), primary: contact.primary } })),
      '연락처를 저장했어요.',
    );
    if (ok) {
      setContact({ ...contact, value: '' });
      reloadContacts();
    }
  }

  return (
    <div className="account-contained">
      <PageTitle title={mode === 'agent' ? '도우미 프로필' : '이용자 프로필'} crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <AccountCard title="기본 정보">
        <form noValidate onSubmit={saveNickname}>
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
            <input required maxLength={50} value={name} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <div className="account-form-footer">
            <button type="submit" className="btn primary" disabled={pending || !name.trim()}>
              닉네임 저장
            </button>
          </div>
        </form>
      </AccountCard>
      <AccountCard title="연락처">
        <AccountNote>선택한 연락처는 요청이 수락된 후 해당 거래 상대방에게만 공개돼요. 도우미의 공개 프로필에는 표시하지 않습니다.</AccountNote>
        {contactsLoad.status === 'loading' ? (
          <Loading text="연락처를 불러오는 중이에요." />
        ) : contacts.length ? (
          <dl className="document-rows">
            {contacts.map((c) => (
              <div key={String(pick(c, 'contactId', 'id') ?? c.kind)}>
                <dt>
                  {kindNames[str(c.kind) ?? ''] ?? str(c.kind)}
                  {c.isPrimary === true && <small> · 공개용</small>}
                </dt>
                <dd>
                  {str(c.value)}{' '}
                  <button
                    type="button"
                    className="text-link"
                    disabled={pending}
                    onClick={() =>
                      run(() => unwrap(api.DELETE('/api/me/contacts/{contactId}', { params: { path: { contactId: Number(pick(c, 'contactId', 'id')) } } })), '연락처를 삭제했어요.').then(
                        (ok) => ok && reloadContacts(),
                      )
                    }
                  >
                    삭제
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="record-note">등록한 연락처가 없어요. 요청을 보내거나 받으려면 연락처가 필요해요.</p>
        )}
        <form noValidate onSubmit={saveContact}>
          <div className="form-grid">
            <Field label="종류" required>
              <select value={contact.kind} onChange={(e) => setContact({ ...contact, kind: e.target.value })}>
                {Object.entries(kindNames).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="연락처" required>
              <input required maxLength={250} type={contact.kind === 'EMAIL' ? 'email' : 'text'} value={contact.value} placeholder={kindPlaceholder[contact.kind]} onChange={(e) => setContact({ ...contact, value: e.target.value })} />
            </Field>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={contact.primary} onChange={(e) => setContact({ ...contact, primary: e.target.checked })} />
            거래 상대방에게 공개할 연락처로 사용
          </label>
          <p className="record-note">같은 종류의 연락처는 새 값으로 바뀌어요. 공개용 연락처는 하나만 정할 수 있어요.</p>
          <div className="account-form-footer">
            <button type="submit" className="btn primary" disabled={pending || !contact.value.trim()}>
              연락처 저장
            </button>
          </div>
        </form>
      </AccountCard>
    </div>
  );
}

// ── 계정·인증 ─────────────────────────────────────────────
export function AccountPage() {
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
    <div className="account-contained">
      <PageTitle title="계정·인증" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <AccountCard title="계정 정보">
        <dl className="document-rows">
          <div>
            <dt>닉네임</dt>
            <dd>{str(me?.nickname) || '미입력'}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            <dd>
              {str(me?.email) || '미입력'}{' '}
              {emailVerified === true && <span className="badge verified">인증 완료</span>}
              {emailVerified === false && (
                <button type="button" className="text-link" disabled={pending} onClick={() => run(() => unwrap(api.POST('/api/me/email-verification')), '인증 메일을 보냈어요. 메일의 링크를 열어 주세요.')}>
                  인증 메일 받기
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt>도우미 신청</dt>
            <dd>
              <span className="badge neutral">{statusLabels[applicationStatus]}</span>
            </dd>
          </div>
        </dl>
      </AccountCard>
      <AccountCard title="인증 상태">
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
                <div className="form-grid">
                  <Field label="은행" required>
                    <select value={bank.code} onChange={(e) => setBank({ ...bank, code: e.target.value })}>
                      {banks.map(([code, bankName]) => (
                        <option key={code} value={code}>
                          {bankName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="계좌번호" helper="숫자만 입력해 주세요.">
                    <input inputMode="numeric" value={bank.number} onChange={(e) => setBank({ ...bank, number: e.target.value.replace(/[^0-9]/g, '') })} />
                  </Field>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={pending || !state.identityVerified || bank.number.length < 8}
                  onClick={() => run(() => verifyPayout(bank.code, bank.number), '정산 계좌를 확인했어요.').then((ok) => ok && reload())}
                >
                  {!state.identityVerified ? '본인인증 후 확인할 수 있어요' : state.payoutVerified ? '다른 계좌로 변경' : '계좌 확인'}
                </button>
              </>
            )}
          </>
        )}
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
      <AccountCard title="이메일 변경">
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
    </div>
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

/** 명세에 이용자의 결제 목록 API가 없어 도우미의 매칭권 충전·사용과 정산 내역만 보여 준다. */
export function HistoryPage() {
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
