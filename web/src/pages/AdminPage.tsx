import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, unwrap, ApiError } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import type { components } from '../api/schema';
import { useLoad } from '../transactions/model';
import { EvidenceFileNames, Field, MoneyInput, Notice, useAction, utcToLocal, won } from '../transactions/ui';
import { Modal } from '../ui/Modal';
import { ImagePreview, ImageViewer } from '../ui/ImagePreview';
import { isImageFile } from '../ui/imageFile';
import { PageTitle } from '../ui/PageTitle';

// 관리자 화면. 프로토타입에 없어서 기존 화면 부품(content-card, tabs, document-rows, btn)으로 만든다.
// 백엔드 서비스 흐름 가이드 12-4의 관리자 기능을 openapi.json의 관리자 API로 연결한다.
// 권한은 서버가 검사한다(ROLE_ADMIN이 아니면 403). 메뉴에는 노출하지 않고 /admin 주소로 들어온다.
// 목록 응답 필드가 명세에 없는 API가 많아(data: object) pick()으로 찾고, 항목마다 원본 응답을 펼쳐 볼 수 있게 했다.

type Tab = 'policy' | 'files' | 'profiles' | 'attempts' | 'settlements' | 'requests' | 'resolved' | 'payments' | 'reports' | 'reviews' | 'users' | 'setup';
const tabs: [Tab, string][] = [
  ['policy', '요청 정책 검토'],
  ['files', '증빙 파일 검토'],
  ['profiles', '도우미 심사'],
  ['attempts', '시도 증빙 대리 승인'],
  ['settlements', '부분성공 정산'],
  ['requests', '결과 확인·만료'],
  ['resolved', '결과 확정 이력'],
  ['payments', '결제 확인'],
  ['reports', '신고'],
  ['reviews', '후기'],
  ['users', '회원 제재'],
  ['setup', '약관·예매처'],
];

const categoryNames: Record<string, string> = { CONCERT: '콘서트', MUSICAL: '뮤지컬', SPORTS: '스포츠', COURSE: '강좌', FACILITY: '시설', OTHER: '기타' };
const purposeNames: Record<string, string> = { CAREER: '경력', ACTIVITY: '활동', BUSINESS: '사업자', RESULT: '결과', ATTEMPT: '시도', REPORT: '신고' };

const s = (raw: unknown, ...keys: string[]) => str(pick(raw, ...keys)) ?? '';
const n = (raw: unknown, ...keys: string[]) => num(pick(raw, ...keys));

function errorText(e: unknown) {
  if (e instanceof ApiError && e.status === 403) return '관리자 권한이 필요해요. 관리자 계정으로 로그인해 주세요.';
  return e instanceof Error ? e.message : '불러오지 못했어요.';
}

/** 목록 불러오기 공통: 로딩·오류·빈 목록 처리와 새로 고침 */
function ListBlock({ title, desc, load, reload, empty, children }: { title: string; desc?: string; load: ReturnType<typeof useLoad<Raw[]>>[0]; reload: () => void; empty: string; children: (rows: Raw[]) => ReactNode }) {
  return (
    <section className="content-card">
      <div className="title-between">
        <h2>{title}</h2>
        <button type="button" className="btn ghost" onClick={reload}>
          새로 고침
        </button>
      </div>
      {desc && <p className="record-note">{desc}</p>}
      {load.status === 'loading' ? (
        <p className="prose">불러오는 중이에요.</p>
      ) : load.status === 'error' ? (
        <Notice tone="error">{load.message}</Notice>
      ) : load.data.length ? (
        children(load.data)
      ) : (
        <p className="prose">{empty}</p>
      )}
    </section>
  );
}

function useAdminList(fetcher: () => Promise<unknown>) {
  return useLoad<Raw[]>(
    () =>
      fetcher().then(list, (e) => {
        throw new Error(errorText(e));
      }),
    [],
  );
}

/** 항목 한 줄: 요약 + 원본 응답 + 동작 버튼 */
function Item({ title, rows, raw, children }: { title: ReactNode; rows: [string, ReactNode][]; raw: Raw; children?: ReactNode }) {
  return (
    <article className="admin-item">
      <div>
        <strong>{title}</strong>
        <dl className="document-rows">
          {rows
            .filter(([, v]) => v !== '' && v !== undefined && v !== null)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        <details>
          <summary>원본 응답</summary>
          <pre className="dev-json">{JSON.stringify(raw, null, 2)}</pre>
        </details>
      </div>
      {children && <div className="admin-actions">{children}</div>}
    </article>
  );
}

/** 사유(필수)를 받아 실행하는 모달 */
function NoteModal({ title, fields, submitText, danger, onClose, onSubmit }: { title: string; fields: { name: string; label: string; required?: boolean; type?: string; helper?: string; initial?: string; maxLength?: number }[]; submitText: string; danger?: boolean; onClose: () => void; onSubmit: (v: Record<string, string>) => Promise<unknown> }) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ''])));
  const [pending, setPending] = useState(false);
  const missing = fields.some((f) => f.required && !values[f.name]?.trim());
  return (
    <Modal title={title} onClose={onClose}>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (missing || !e.currentTarget.checkValidity()) return;
          setPending(true);
          await onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])));
          setPending(false);
        }}
      >
        {fields.map((f) => (
          <Field key={f.name} label={f.label} required={f.required} helper={f.helper}>
            {f.type === 'textarea' ? (
              <textarea rows={3} required={f.required} maxLength={f.maxLength} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            ) : (
              <input type={f.type ?? 'text'} required={f.required} maxLength={f.maxLength} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            )}
          </Field>
        ))}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            돌아가기
          </button>
          <button type="submit" className={`btn ${danger ? 'danger' : 'primary'}`} disabled={missing || pending}>
            {pending ? '처리 중…' : submitText}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type Dialog = { title: string; fields: Parameters<typeof NoteModal>[0]['fields']; submitText: string; danger?: boolean; action: (v: Record<string, string>) => Promise<unknown>; success: string } | null;

function useDialog(reload: () => void) {
  const { pending, run } = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const modal = dialog && (
    <NoteModal
      title={dialog.title}
      fields={dialog.fields}
      submitText={dialog.submitText}
      danger={dialog.danger}
      onClose={() => setDialog(null)}
      onSubmit={async (v) => {
        const ok = await run(() => dialog.action(v), dialog.success);
        if (ok) {
          setDialog(null);
          reload();
        }
      }}
    />
  );
  return { open: setDialog, modal, pending, run };
}

/** 필수 메모 입력. maxLength는 해당 API의 서버 검증(@Size max)과 같게 넘긴다(넘기면 입력을 마친 뒤 400). */
const noteField = (label: string, maxLength: number) => ({ name: 'note', label, required: true, type: 'textarea', maxLength });

// ── 요청 정책 검토 ─────────────────────────────────────────
function PolicyTab() {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/requests/policy-pending', { params: { query: { page: 0, size: 100 } } })));
  const { open, modal, pending } = useDialog(reload);
  const decide = (row: Raw, allowed: boolean) =>
    open({
      title: allowed ? '대리 신청 허용' : '대리 신청 차단',
      fields: [noteField(allowed ? '허용 근거' : '차단 사유', 10000), { name: 'sourceUrl', label: '근거 URL', required: true, type: 'url', maxLength: 1000, helper: '예매처 이용약관·공지 등 판단 근거 주소(https://…)', initial: s(row, 'officialApplicationUrl', 'platform.homepageUrl', 'platformHomepageUrl') }],
      submitText: allowed ? '허용' : '차단',
      danger: !allowed,
      success: allowed ? '허용했어요. 도우미가 수락할 수 있어요.' : '차단했어요.',
      action: (v) => unwrap(api.POST('/api/admin/requests/{requestId}/policy', { params: { path: { requestId: n(row, 'requestId', 'id')! } }, body: { allowed, note: v.note, sourceUrl: v.sourceUrl } })),
    });
  return (
    <>
      <ListBlock title="정책 검토 대기 요청" desc="대리 신청이 허용되는 대상인지 판단해요. 허용(ALLOWED)되어야 도우미가 수락할 수 있어요." load={load} reload={reload} empty="검토할 요청이 없어요.">
        {(rows) =>
          rows.map((row) => (
            <Item
              key={String(n(row, 'requestId', 'id'))}
              raw={row}
              title={`#${n(row, 'requestId', 'id')} ${s(row, 'submittedTargetName', 'targetName')}`}
              rows={[
                ['분야', categoryNames[s(row, 'serviceCategory')] ?? s(row, 'serviceCategory')],
                ['예매처', s(row, 'platformName', 'platform.name', 'otherPlatformName')],
                ['티켓 오픈', [s(row, 'applicationOpenDate'), s(row, 'applicationOpenTime')].filter(Boolean).join(' ')],
                ['공식 신청 URL', s(row, 'officialApplicationUrl')],
                ['요청 내용', s(row, 'requirements')],
                ['요청 시각', utcToLocal(s(row, 'createdAt'))],
              ]}
            >
              <button type="button" className="btn primary" disabled={pending} onClick={() => decide(row, true)}>
                허용
              </button>
              <button type="button" className="btn ghost tx-danger" disabled={pending} onClick={() => decide(row, false)}>
                차단
              </button>
            </Item>
          ))
        }
      </ListBlock>
      {modal}
    </>
  );
}

// ── 증빙 파일 검토(도우미 심사용 CAREER·ACTIVITY·BUSINESS) ─────────────
// 서버 목록은 결과 증빙(RESULT)·분쟁 소명(DISPUTE)을 빼고 주며, 두 파일은 승인·차단해도 409다(EvidenceUploadService.review).
function FilesTab() {
  const [photo, setPhoto] = useState<{ src: string; name: string } | null>(null);
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/evidence-files', { params: { query: { size: 100 } } })));
  const { open, modal, pending, run } = useDialog(reload);
  const fileId = (row: Raw) => n(row, 'fileId', 'attachmentId', 'id')!;
  const preview = (row: Raw) =>
    run(async () => {
      const p = await unwrap<unknown>(api.GET('/api/admin/evidence-files/{fileId}/preview', { params: { path: { fileId: fileId(row) } } }));
      const url = typeof p === 'string' ? p : s(p, 'url', 'downloadUrl', 'previewUrl');
      if (!url) throw new Error('열람 URL을 받지 못했어요.');
      const name = s(row, 'originalName', 'fileName') || '증빙 사진';
      if (isImageFile(s(row, 'mimeType'), name)) setPhoto({ src: url, name });
      else window.open(url, '_blank', 'noopener');
    });
  const review = (row: Raw, approved: boolean) =>
    open({
      title: approved ? '파일 승인(CLEAN)' : '파일 차단(BLOCKED)',
      fields: [noteField('검토 메모', 2000)],
      submitText: approved ? '승인' : '차단',
      danger: !approved,
      success: approved ? '승인했어요.' : '차단했어요.',
      action: (v) => unwrap(api.POST('/api/admin/evidence-files/{fileId}/review', { params: { path: { fileId: fileId(row) } }, body: { approved, note: v.note } })),
    });
  return (
    <>
      <ListBlock title="검토 대기 증빙 파일" desc="도우미 심사용 경력·활동·사업자 증빙 파일이에요. 경력 증빙은 승인(CLEAN)돼야 도우미가 심사를 신청하고 관리자가 승인할 수 있어요. 결과 증빙과 분쟁 소명 파일은 이 탭의 검토 대상이 아니에요(승인·차단할 수 없어요). 결과 증빙은 이용자가 바로 확인하고, 이의가 생기면 '결과 확인·만료' 탭의 '증빙·소명 보기'로 함께 봐요. 승인은 악성코드 검사를 뜻하지 않아요." load={load} reload={reload} empty="검토할 파일이 없어요.">
        {(rows) =>
          rows.map((row) => (
            <Item
              key={String(fileId(row))}
              raw={row}
              title={`${purposeNames[s(row, 'purpose')] ?? s(row, 'purpose')} 증빙 · ${s(row, 'originalName', 'fileName')}`}
              rows={[
                ['파일 번호', fileId(row)],
                ['사례 번호', n(row, 'caseNumber')],
                ['요청·프로필', n(row, 'requestId') ? `요청 #${n(row, 'requestId')}` : n(row, 'profileId') ? `프로필 #${n(row, 'profileId')}` : ''],
                ['올린 회원', n(row, 'ownerUserId', 'uploaderUserId', 'userId')],
                ['형식·크기', [s(row, 'mimeType'), n(row, 'sizeBytes') ? `${Math.ceil(n(row, 'sizeBytes')! / 1024)}KB` : ''].filter(Boolean).join(' · ')],
                ['설명', s(row, 'description')],
                ['제출 시각', utcToLocal(s(row, 'submittedAt', 'createdAt'))],
              ]}
            >
              <button type="button" className="btn secondary" disabled={pending} onClick={() => preview(row)}>
                파일 보기
              </button>
              <button type="button" className="btn primary" disabled={pending} onClick={() => review(row, true)}>
                승인
              </button>
              <button type="button" className="btn ghost tx-danger" disabled={pending} onClick={() => review(row, false)}>
                차단
              </button>
            </Item>
          ))
        }
      </ListBlock>
      {modal}
      {photo && <ImageViewer src={photo.src} alt={photo.name} onClose={() => setPhoto(null)} />}
    </>
  );
}

// ── 도우미 심사 ────────────────────────────────────────────
function ProfilesTab() {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/agent-profiles', { params: { query: { page: 0, size: 100 } } })));
  const { open, modal, pending, run } = useDialog(reload);
  const [evidence, setEvidence] = useState<{ id: number; rows: Raw[] } | null>(null);
  const profileId = (row: Raw) => n(row, 'profileId', 'profileVersionId', 'id')!;
  const review = (row: Raw, approved: boolean) =>
    open({
      title: approved ? '프로필 승인(게시)' : '프로필 반려',
      fields: [noteField(approved ? '승인 메모' : '반려 사유(도우미에게 보여요)', 2000)],
      submitText: approved ? '승인' : '반려',
      danger: !approved,
      success: approved ? '승인했어요. 이전 게시본은 보관돼요.' : '반려했어요.',
      action: (v) => unwrap(api.POST('/api/admin/agent-profiles/{profileId}/review', { params: { path: { profileId: profileId(row) } }, body: { approved, note: v.note } })),
    });
  return (
    <>
      <ListBlock title="심사 대기 프로필" desc="승인하면 도우미 찾기에 게시돼요. 서버가 본인·정산계좌 인증과 경력 증빙 3건(CLEAN)을 다시 확인해요. 경력 자료는 '증빙 보기'로 확인해 주세요." load={load} reload={reload} empty="심사할 프로필이 없어요.">
        {(rows) =>
          rows.map((row) => (
            <Item
              key={String(profileId(row))}
              raw={row}
              title={`${s(row, 'activityName')} · 프로필 #${profileId(row)}`}
              rows={[
                // GET /api/admin/agent-profiles: 비용·연락 가능 시간·경력·platforms[{platformId,name}]·categories 포함
                ['회원', n(row, 'userId')],
                ['버전', n(row, 'version') ? `${n(row, 'version')}차` : ''],
                ['한 줄 소개', s(row, 'headline')],
                ['대표 분야', categoryNames[s(row, 'primaryCategory')] ?? s(row, 'primaryCategory')],
                ['활동 분야', list(pick(row, 'categories')).map((c) => categoryNames[String(c)] ?? String(c)).join(', ')],
                ['예매처', list(pick(row, 'platforms')).map((p) => str(pick(p, 'name')) ?? `#${num(pick(p, 'platformId')) ?? ''}`).join(', ')],
                ['착수비', n(row, 'upfrontFeeKrw') != null ? won(n(row, 'upfrontFeeKrw')) : ''],
                ['성공보수 범위', n(row, 'successFeeMin') != null ? `${won(n(row, 'successFeeMin'))} ~ ${won(n(row, 'successFeeMax'))}` : ''],
                ['연락 가능 시간', s(row, 'contactHoursNote')],
                ['경력', [s(row, 'careerStartedOn') && `${s(row, 'careerStartedOn')}부터`, s(row, 'careerDescription')].filter(Boolean).join(' · ')],
                ['소개', s(row, 'bio')],
                ['신청 시각', utcToLocal(s(row, 'submittedAt'))],
              ]}
            >
              <button
                type="button"
                className="btn secondary"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const rows = list(await unwrap<unknown>(api.GET('/api/admin/agent-profiles/{profileId}/evidence', { params: { path: { profileId: profileId(row) } } })));
                    setEvidence({ id: profileId(row), rows });
                  })
                }
              >
                증빙 보기
              </button>
              <button type="button" className="btn primary" disabled={pending} onClick={() => review(row, true)}>
                승인
              </button>
              <button type="button" className="btn ghost tx-danger" disabled={pending} onClick={() => review(row, false)}>
                반려
              </button>
            </Item>
          ))
        }
      </ListBlock>
      {evidence && (
        <Modal title={`프로필 #${evidence.id} 증빙`} onClose={() => setEvidence(null)} wide>
          {evidence.rows.length ? (
            evidence.rows.map((e, i) => (
              <Item
                key={i}
                raw={e}
                title={`${purposeNames[s(e, 'purpose')] ?? s(e, 'purpose')} ${n(e, 'caseNumber') ? `사례 ${n(e, 'caseNumber')}` : ''}`}
                rows={[
                  ['상태', s(e, 'status')],
                  ['설명', s(e, 'description')],
                  ['첨부', list(pick(e, 'attachments')).map((f) => `${s(f, 'originalName')} (${s(f, 'scanStatus')})`).join(', ')],
                ]}
              />
            ))
          ) : (
            <p className="prose">제출된 증빙이 없어요.</p>
          )}
          <p className="record-note">파일 승인·차단은 '증빙 파일 검토' 탭에서 해요.</p>
        </Modal>
      )}
      {modal}
    </>
  );
}

// ── 시도 증빙 대리 승인(24시간 미검토) ────────────────────────
function AttemptsTab() {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/attempt-evidences/overdue', { params: { query: { page: 0, size: 100 } } })));
  const { open, modal, pending } = useDialog(reload);
  return (
    <>
      <ListBlock title="검토 기한 지난 시도 증빙" desc="제출 후 24시간이 지나도록 이용자가 검토하지 않은 증빙이에요. 대리 승인하면 착수비 지급 조건을 확인해요. 반려는 이용자만 할 수 있어요." load={load} reload={reload} empty="대리 승인할 증빙이 없어요.">
        {(rows) =>
          rows.map((row) => (
            <Item
              key={String(n(row, 'evidenceId'))}
              raw={row}
              title={`요청 #${n(row, 'requestId')} · ${n(row, 'revision')}차 시도 증빙`}
              rows={[
                ['설명', s(row, 'description')],
                ['첨부', list(pick(row, 'attachments')).map((f) => `${s(f, 'originalName')} (${s(f, 'scanStatus')})`).join(', ')],
                ['제출 시각', utcToLocal(s(row, 'submittedAt'))],
              ]}
            >
              <EvidenceFileNames files={list(pick(row, 'attachments'))} status={(f) => s(f, 'scanStatus')} />
              <button
                type="button"
                className="btn primary"
                disabled={pending}
                onClick={() =>
                  open({
                    title: '시도 증빙 대리 승인',
                    fields: [{ name: 'note', label: '승인 메모', type: 'textarea', maxLength: 16000 }],
                    submitText: '승인',
                    success: '대리 승인했어요.',
                    action: (v) => unwrap(api.POST('/api/admin/attempt-evidences/{evidenceId}/approve', { params: { path: { evidenceId: n(row, 'evidenceId')! } }, body: { reviewNote: v.note || null } })),
                  })
                }
              >
                대리 승인
              </button>
            </Item>
          ))
        }
      </ListBlock>
      {modal}
    </>
  );
}

// ── 부분성공 정산 결정 ─────────────────────────────────────
function SettlementsTab() {
  const [pendingLoad, reloadPending] = useAdminList(() => unwrap(api.GET('/api/admin/partial-settlements/pending', { params: { query: { page: 0, size: 100 } } })));
  const [unproposedLoad, reloadUnproposed] = useAdminList(() => unwrap(api.GET('/api/admin/partial-settlements/unproposed', { params: { query: { page: 0, size: 100 } } })));
  const [target, setTarget] = useState<Raw | null>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const { pending, run } = useAction();
  const fee = n(target, 'successFeeKrw') ?? 0;
  const reloadAll = () => {
    reloadPending();
    reloadUnproposed();
  };
  const rows = (row: Raw): [string, ReactNode][] => [
    ['성공보수', won(n(row, 'successFeeKrw'))],
    ['도우미 제안', n(row, 'proposedAmountKrw') !== undefined ? `${won(n(row, 'proposedAmountKrw'))} · ${s(row, 'proposalNote')}` : '제안 없음'],
    ['이용자 거절 사유', s(row, 'rejectionNote')],
    ['상태', s(row, 'status')],
  ];
  const decideButton = (row: Raw) => (
    <button
      type="button"
      className="btn primary"
      onClick={() => {
        setTarget(row);
        setAmount(n(row, 'proposedAmountKrw') ?? 0);
        setNote('');
      }}
    >
      금액 결정
    </button>
  );
  return (
    <>
      <ListBlock title="결정 대기 정산" desc="이용자가 거절했거나 제안 후 24시간 동안 응답이 없는 정산이에요." load={pendingLoad} reload={reloadPending} empty="결정할 정산이 없어요.">
        {(list_) =>
          list_.map((row) => (
            <Item key={String(n(row, 'requestId'))} raw={row} title={`요청 #${n(row, 'requestId')}`} rows={rows(row)}>
              {decideButton(row)}
            </Item>
          ))
        }
      </ListBlock>
      <ListBlock title="도우미 제안 없는 부분성공" desc="결과 확정 후 24시간 동안 도우미가 금액을 제안하지 않은 거래예요." load={unproposedLoad} reload={reloadUnproposed} empty="해당 거래가 없어요.">
        {(list_) =>
          list_.map((row) => (
            <Item key={String(n(row, 'requestId'))} raw={row} title={`요청 #${n(row, 'requestId')}`} rows={rows(row)}>
              {decideButton(row)}
            </Item>
          ))
        }
      </ListBlock>
      {target && (
        <Modal title={`요청 #${n(target, 'requestId')} 정산 결정`} onClose={() => setTarget(null)}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (amount > fee || !note.trim()) return;
              const ok = await run(
                () => unwrap(api.POST('/api/admin/requests/{requestId}/partial-settlement/decide', { params: { path: { requestId: n(target, 'requestId')! } }, body: { amountKrw: amount, note: note.trim() } })),
                '정산 금액을 결정했어요. 도우미 몫은 자동 지급 요청되고, 잔액은 이용자가 환불을 요청해요.',
              );
              if (ok) {
                setTarget(null);
                reloadAll();
              }
            }}
          >
            <Field label="도우미 몫(원)" required helper={`0원 ~ ${won(fee)}`}>
              <MoneyInput required max={fee} value={amount} onChange={setAmount} />
            </Field>
            <p className="record-note">이용자 환불 예정: {won(Math.max(0, fee - amount))}</p>
            <Field label="결정 사유" required>
              <textarea rows={3} required maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {amount > fee && <Notice tone="error">성공보수보다 많이 정할 수 없어요.</Notice>}
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setTarget(null)}>
                돌아가기
              </button>
              <button type="submit" className="btn primary" disabled={pending || amount > fee || !note.trim()}>
                결정
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ── 분쟁 확정·요청 만료 ─────────────────────────────────────
// ── 결과 분쟁·이용자 무응답 ─────────────────────────────────
const resultLabels: Record<string, string> = { SUCCESS: '성공', PARTIAL: '부분 성공', FAILURE: '실패' };
// JDBC 드라이버에 따라 true 또는 1로 온다.
const flag = (row: unknown, key: string) => pick(row, key) === true || num(pick(row, key)) === 1;
const evidenceStatusNames: Record<string, string> = { DRAFT: '작성 중', SUBMITTED: '확인 대기', APPROVED: '승인', REJECTED: '반려' };
const reviewReasonNames: Record<string, string> = { DISPUTED: '이용자 이의 제기', CONFIRMATION_OVERDUE: '이용자 24시간 무응답', NO_RESULT: '도우미 결과 미제출(이용자 신고)' };
const resultLabel = (row: unknown) => {
  const forfeited = flag(row, 'upfrontForfeited');
  if (s(row, 'reviewReason') === 'NO_RESULT') return forfeited ? '실패 · 결과 미제출(착수비 미지급)' : '실패 · 결과 미제출';
  return forfeited ? '실패 · 시도 미확인(착수비 미지급)' : resultLabels[s(row, 'finalResult')] ?? s(row, 'finalResult');
};

/** 요청 하나의 결과·시도 증빙과 양쪽 소명. allowAsk면 추가 자료 요청 폼을 보인다(분쟁 중일 때만). */
function EvidenceModal({ id, allowAsk, onClose, onAsked }: { id: number; allowAsk: boolean; onClose: () => void; onAsked?: () => void }) {
  const { pending, run } = useAction();
  const [shown, setShown] = useState<{ rows: [string, Raw][]; threads: [string, Raw[]][] } | null>(null);
  const [failed, setFailed] = useState('');
  const [ask, setAsk] = useState({ party: 'REQUESTER', body: '' });
  const loadShown = useCallback(async () => {
    const [results, attempts, threads] = await Promise.all([
      unwrap<unknown>(api.GET('/api/admin/requests/{requestId}/result/evidence', { params: { path: { requestId: id } } })),
      unwrap<unknown>(api.GET('/api/admin/requests/{requestId}/attempt-evidences', { params: { path: { requestId: id }, query: { page: 0, size: 20 } } })),
      unwrap<Raw>(api.GET('/api/admin/requests/{requestId}/dispute/messages', { params: { path: { requestId: id } } })),
    ]);
    setShown({
      rows: [...list(results).map((e) => ['결과 증빙', e] as [string, Raw]), ...list(attempts).map((e) => ['시도 증빙', e] as [string, Raw])],
      threads: [
        ['이용자', list(pick(threads, 'requester'))],
        ['도우미', list(pick(threads, 'agent'))],
      ],
    });
  }, [id]);
  const retry = useCallback(() => {
    setFailed('');
    loadShown().catch((e) =>
      setFailed(e instanceof ApiError && e.status === 403 ? '본인이 당사자인 거래의 증빙·소명은 볼 수 없어요.' : e instanceof Error ? e.message : '증빙을 불러오지 못했어요.'),
    );
  }, [loadShown]);
  useEffect(() => {
    retry();
  }, [retry]);
  const sendQuestion = () =>
    run(async () => {
      await unwrap(api.POST('/api/admin/requests/{requestId}/dispute/questions', { params: { path: { requestId: id } }, body: { party: ask.party, body: ask.body.trim() } }));
      setAsk({ ...ask, body: '' });
      onAsked?.();
      // 요청은 이미 보냈다: 대화 기록만 못 불러오면 오류 대신 다시 불러오기를 안내한다(다시 보내면 알림이 중복된다).
      await loadShown().catch(() =>
        setFailed('추가 자료 요청은 보냈어요. 대화 기록만 다시 불러오지 못했어요. 다시 불러오기를 눌러 주세요(요청을 다시 보낼 필요는 없어요).'),
      );
    }, '추가 자료를 요청했어요. 상대에게 알림이 가고 48시간 답변 기한이 붙어요.');
  if (failed)
    return (
      <Modal title={`요청 #${id} 증빙·소명`} onClose={onClose}>
        <Notice tone="error">{failed}</Notice>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="btn primary" onClick={retry}>
            다시 불러오기
          </button>
        </div>
      </Modal>
    );
  if (!shown)
    return (
      <Modal title={`요청 #${id} 증빙·소명`} onClose={onClose}>
        <p className="prose" role="status">불러오는 중이에요.</p>
      </Modal>
    );
  const disputed = allowAsk;
  return (
        <Modal title={`요청 #${id} 증빙·소명`} onClose={onClose}>
          {shown.rows.length === 0 && <p className="prose">올라온 증빙이 없어요. 이의 제기 건이면 도우미가 결과 증빙을 추가할 수 있어요.</p>}
          <div className="tx-file-list">
            {shown.rows.map(([kind, e], i) => {
              const files = list(pick(e, 'attachments'));
              return (
                <div key={i} className="tx-file-view">
                  <div>
                    <strong>
                      {kind} · {n(e, 'revision') ?? 1}차 {s(e, 'status') ? `· ${evidenceStatusNames[s(e, 'status')] ?? s(e, 'status')}` : ''}
                    </strong>
                    <small>{s(e, 'description') || '설명 없음'}</small>
                    <small>
                      <EvidenceFileNames files={files} status={(f) => (str(f.scanStatus) === 'BLOCKED' ? '차단됨' : str(f.url) ? '열람 가능' : '열 수 없음(파일 없음)')} />
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          {shown.threads.map(([who, messages]) => (
            <section key={who}>
              <h3>{who} 소명</h3>
              {messages.length === 0 && <p className="record-note">아직 없어요.</p>}
              <div className="tx-file-list">
                {messages.map((m) => {
                  const files = list(pick(m, 'attachments'));
                  const question = s(m, 'kind') === 'QUESTION';
                  return (
                    <div key={String(n(m, 'id'))} className="tx-file-view">
                      <div>
                        <strong>
                          {question ? '운영팀 질문' : `${who} 답변`} · {utcToLocal(s(m, 'createdAt'))}
                          {question && s(m, 'replyDueAt') ? ` · 기한 ${utcToLocal(s(m, 'replyDueAt'))}` : ''}
                        </strong>
                        <small style={{ whiteSpace: 'pre-wrap' }}>{s(m, 'body')}</small>
                        {files.length > 0 && (
                          <small>
                            <EvidenceFileNames files={files} status={() => '첨부'} />
                          </small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {disputed && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (ask.body.trim()) void sendQuestion();
              }}
            >
              <h3>추가 자료 요청</h3>
              <Field label="받는 사람" required>
                <select value={ask.party} onChange={(e) => setAsk({ ...ask, party: e.target.value })}>
                  <option value="REQUESTER">이용자</option>
                  <option value="AGENT">도우미</option>
                </select>
              </Field>
              <Field label="질문" required>
                <textarea rows={3} required maxLength={2000} value={ask.body} onChange={(e) => setAsk({ ...ask, body: e.target.value })} placeholder="예: 예매 완료 화면(좌석 정보가 보이게)을 올려 주세요." />
              </Field>
              <p className="record-note">받는 사람에게 알림이 가고 48시간 답변 기한이 붙어요. 상대방에게는 보이지 않아요.</p>
              <button type="submit" className="btn primary" disabled={pending || !ask.body.trim()}>
                요청 보내기
              </button>
            </form>
          )}
        </Modal>
  );
}

function ResultReviewList({ onPick, version }: { onPick: (requestId: number, upfrontStarted: boolean, reviewReason: string) => void; version: number }) {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/requests/result-review', { params: { query: { page: 0, size: 100 } } })));
  useEffect(() => {
    if (version) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  const [shown, setShown] = useState<{ id: number; disputed: boolean } | null>(null);
  return (
    <>
      <ListBlock
        title="결과 확인이 필요한 요청"
        desc="이용자가 이의를 제기했거나, 도우미 결과 등록 후 24시간 동안 이용자가 답하지 않은 요청이에요. 증빙을 보고 아래에서 결과를 확정해요."
        load={load}
        reload={reload}
        empty="확인할 요청이 없어요."
      >
        {(rows) =>
          rows.map((row) => {
            const id = n(row, 'id', 'requestId')!;
            const overdue = s(row, 'reviewReason') === 'CONFIRMATION_OVERDUE';
            return (
              <Item
                key={id}
                raw={row}
                title={`#${id} ${s(row, 'submittedTargetName', 'targetName')} · ${overdue ? '이용자 24시간 무응답' : '이의 제기'}`}
                rows={[
                  ['도우미 결과', `${resultLabels[s(row, 'agentResult')] ?? s(row, 'agentResult')} · ${s(row, 'agentResultNote')}`],
                  ['실제 확보 내용', s(row, 'actualOutcomeDescription')],
                  ['결과 등록 시각', utcToLocal(s(row, 'agentResultSubmittedAt'))],
                  ['이용자 확인 기한', overdue ? utcToLocal(s(row, 'resultConfirmDueAt')) : ''],
                  ['이의 사유', s(row, 'disputeNote')],
                  ['증빙', [pick(row, 'hasResultEvidence') === true && '결과 증빙 있음', pick(row, 'hasAttemptEvidence') === true && '시도 증빙 있음'].filter(Boolean).join(' · ') || '증빙 없음'],
                  ['소명', [`${n(row, 'statementCount') ?? 0}건`, pick(row, 'awaitingRequesterReply') === true && '이용자 답변 대기', pick(row, 'awaitingAgentReply') === true && '도우미 답변 대기'].filter(Boolean).join(' · ')],
                  ['착수비', flag(row, 'upfrontPayoutStarted') ? '도우미 몫으로 확정(시도 증빙 승인 또는 지급 진행) · 시도 미확인 종결 불가' : '미확정'],
                ]}
              >
                <button type="button" className="btn secondary" onClick={() => setShown({ id, disputed: !overdue })}>
                  증빙·소명 보기
                </button>
                <button type="button" className="btn primary" onClick={() => onPick(id, flag(row, 'upfrontPayoutStarted'), s(row, 'reviewReason'))}>
                  결과 확정
                </button>
              </Item>
            );
          })
        }
      </ListBlock>
      {shown && <EvidenceModal id={shown.id} allowAsk={shown.disputed} onClose={() => setShown(null)} onAsked={reload} />}
    </>
  );
}

/** 착수 후 도우미가 결과를 내지 않아 이용자가 신고한 요청. 운영팀이 확인해 실패로 종결한다(이용료 제외 환불). */
function NoResultList({ version, onClosed }: { version: number; onClosed: () => void }) {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/requests/no-result', { params: { query: { page: 0, size: 100 } } })));
  useEffect(() => {
    if (version) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  const { open, modal } = useDialog(() => {
    reload();
    onClosed();
  });
  const [shown, setShown] = useState<number | null>(null);
  return (
    <>
      <ListBlock
        title="도우미 결과 미제출 신고"
        desc="착수한 뒤 도우미가 결과를 등록하지 않아 이용자가 신고한 요청이에요. 도우미에게 연락해 확인하고, 결과가 나오지 않으면 실패로 종결해요. 신고 탭에서 신고를 먼저 '처리 완료'해도 여기 남아요. '처리 안 함'으로 닫으면 빠지고 종결할 수 없어요."
        load={load}
        reload={reload}
        empty="결과 미제출 신고가 없어요."
      >
        {(rows) =>
          rows.map((row) => {
            const id = n(row, 'id')!;
            const started = flag(row, 'upfrontPayoutStarted');
            return (
              <Item
                key={id}
                raw={row}
                title={`#${id} ${s(row, 'submittedTargetName')} · 결과 미제출`}
                rows={[
                  ['착수 시각', utcToLocal(s(row, 'startedAt'))],
                  ['신고', `#${n(row, 'reportId') ?? ''} · ${utcToLocal(s(row, 'reportedAt'))} · ${reportStatusNames[s(row, 'reportStatus') as ReportStatus] ?? s(row, 'reportStatus')}`],
                  ['신고 사유', reportReasonNames[s(row, 'reportReason')] ?? s(row, 'reportReason')],
                  ['시도 증빙', pick(row, 'hasAttemptEvidence') === true ? '있음' : '없음'],
                  ['종결 시 환불(안전거래일 때)', started ? '착수비는 도우미 몫(시도 증빙 승인 또는 지급 진행)이라 지급하고, 성공보수만 환불 대상(이용료 제외)' : '착수비·성공보수 환불 대상, 착수비 미지급(이용료 제외)'],
                ]}
              >
                <button type="button" className="btn secondary" onClick={() => setShown(id)}>
                  시도 증빙 보기
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() =>
                    open({
                      title: `요청 #${id} 결과 미제출로 종결`,
                      fields: [{ name: 'note', label: '종결 사유', required: true, type: 'textarea', maxLength: 10000, helper: '양쪽 요청 상세에 표시돼요. 예: 도우미가 3일간 연락되지 않고 결과를 등록하지 않음' }],
                      submitText: '실패로 종결',
                      danger: true,
                      action: async (v) => {
                        try {
                          await unwrap(api.POST('/api/admin/requests/{requestId}/close-no-result', { params: { path: { requestId: id } }, body: { note: v.note } }));
                        } catch (err) {
                          if (err instanceof ApiError && err.status === 409) {
                            reload();
                            throw new Error('도우미가 그사이 결과를 등록했거나 이미 종결된 요청이에요. 목록을 새로 고쳤어요.');
                          }
                          throw err;
                        }
                      },
                      success: started ? '실패로 종결했어요. 안전거래라면 착수비는 도우미에게 지급되고 이용자는 성공보수를 환불받을 수 있어요(이용료 제외).' : '실패로 종결했어요. 안전거래라면 착수비는 지급되지 않고 이용자가 착수비·성공보수를 환불받을 수 있어요(이용료 제외).',
                    })
                  }
                >
                  실패로 종결
                </button>
              </Item>
            );
          })
        }
      </ListBlock>
      {modal}
      {shown !== null && <EvidenceModal id={shown} allowAsk={false} onClose={() => setShown(null)} />}
    </>
  );
}

function RequestsTab() {
  const { pending, run } = useAction();
  const [requestId, setRequestId] = useState('');
  // UNVERIFIED = 실패 · 시도 미확인: FAILURE + attemptUnverified(착수비 미지급, 이용자 착수비·성공보수 환불)
  // 되돌릴 수 없는 결정이라 기본값 없이 직접 고르게 한다('' = 아직 안 고름).
  const [result, setResult] = useState<components['schemas']['RequestResult'] | 'UNVERIFIED' | ''>('');
  // 목록에서 고른 요청의 확정 계기(DISPUTED|CONFIRMATION_OVERDUE). 그 사이 바뀌면 서버가 409로 막는다.
  const [reviewReason, setReviewReason] = useState('');
  const [note, setNote] = useState('');
  // 목록에서 고른 요청의 착수비 지급 여부(지급이 시작됐으면 시도 미확인 종결을 고를 수 없다). 직접 입력하면 모른다(null).
  const [upfrontStarted, setUpfrontStarted] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0);
  const [expired, setExpired] = useState<number | null>(null);

  async function resolve(e: FormEvent) {
    e.preventDefault();
    if (!Number(requestId) || !note.trim() || !result) return;
    const unverified = result === 'UNVERIFIED';
    const ok = await run(async () => {
      try {
        await unwrap(
          api.POST('/api/admin/requests/{requestId}/resolve', {
            params: { path: { requestId: Number(requestId) } },
            body: {
              result: unverified ? 'FAILURE' : result,
              note: note.trim(),
              attemptUnverified: unverified,
              ...(reviewReason ? { reviewReason: reviewReason as 'DISPUTED' | 'CONFIRMATION_OVERDUE' } : {}),
            },
          }),
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setVersion((v) => v + 1); // 목록을 최신 상태로
          // 409 원인은 여러 가지라(상태 변경·이미 확정·착수비 확정) 짐작하지 않고 최신 목록에서 그 요청을 확인해 알려 준다.
          const rows = await unwrap<Raw[]>(api.GET('/api/admin/requests/result-review', { params: { query: { page: 0, size: 100 } } })).catch(() => null);
          const row = rows?.find((x) => n(x, 'id') === Number(requestId));
          if (row) {
            setUpfrontStarted(flag(row, 'upfrontPayoutStarted'));
            setReviewReason(s(row, 'reviewReason'));
          }
          throw new Error(
            !rows
              ? '확정하지 못했어요. 목록을 새로 고친 뒤 요청 상태를 확인해 주세요.'
              : !row
                ? '이미 확정됐거나 지금은 확정할 수 없는 요청이에요(이용자가 먼저 결과에 동의했을 수 있어요).'
                : reviewReason && s(row, 'reviewReason') !== reviewReason
                  ? `목록을 본 뒤 상태가 바뀌었어요(지금: ${reviewReasonNames[s(row, 'reviewReason')] ?? s(row, 'reviewReason')}). 이의 사유와 증빙을 다시 확인하고 확정해 주세요.`
                  : unverified && flag(row, 'upfrontPayoutStarted')
                    ? '착수비가 도우미 몫으로 확정돼(시도 증빙 승인 또는 지급 시작) 시도 미확인으로 종결할 수 없어요. 다른 결과로 확정해 주세요.'
                    : '지금은 확정할 수 없는 요청이에요. 목록을 새로 고쳤으니 다시 확인해 주세요.',
          );
        }
        if (err instanceof ApiError && err.status === 403) throw new Error('본인이 당사자인 거래는 확정할 수 없어요.');
        throw err;
      }
    }, unverified ? '시도 미확인으로 종결했어요. 안전거래라면 착수비는 지급되지 않고 이용자가 착수비·성공보수를 환불받을 수 있어요(이용료 제외).' : '결과를 확정했어요. 요청이 완료로 바뀌고 정산이 판단돼요.');
    if (ok) {
      setNote('');
      setResult('');
      setReviewReason('');
      setRequestId('');
      setUpfrontStarted(null);
      setVersion((v) => v + 1);
    }
  }

  return (
    <>
      <ResultReviewList
        version={version}
        onPick={(id, started, reason) => {
          setRequestId(String(id));
          setResult(''); // 앞 건의 선택(특히 시도 미확인)이 남지 않게
          setReviewReason(reason);
          setUpfrontStarted(started);
          document.getElementById('admin-resolve-form')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      <NoResultList version={version} onClosed={() => setVersion((v) => v + 1)} />
      <section className="content-card" id="admin-resolve-form">
        <h2>결과 확정</h2>
        <p className="record-note">이의가 제기된(DISPUTED) 요청, 또는 도우미 결과 등록 후 24시간 동안 이용자가 답하지 않은 요청의 최종 결과를 정해요. 위 목록에서 '결과 확정'을 누르면 번호가 채워져요. 본인이 당사자인 거래는 확정할 수 없어요.</p>
        <form noValidate onSubmit={resolve}>
          <div className="form-grid">
            <Field label="요청 번호" required>
              <input
                inputMode="numeric"
                required
                value={requestId}
                onChange={(e) => {
                  setRequestId(e.target.value.replace(/[^0-9]/g, ''));
                  setUpfrontStarted(null);
                  setReviewReason('');
                }}
              />
            </Field>
            <Field label="최종 결과" required>
              <select required value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
                <option value="" disabled>
                  결과를 골라 주세요
                </option>
                <option value="SUCCESS">성공</option>
                <option value="PARTIAL">부분 성공</option>
                <option value="FAILURE">실패 (착수비는 도우미 몫)</option>
                <option value="UNVERIFIED" disabled={upfrontStarted === true}>
                  실패 · 시도 미확인 (착수비 미지급){upfrontStarted ? ' - 착수비 확정됨' : ''}
                </option>
              </select>
            </Field>
          </div>
          {upfrontStarted && <p className="record-note">이 요청은 착수비가 이미 도우미 몫으로 확정돼(시도 증빙 승인 또는 지급 시작) 시도 미확인 종결을 고를 수 없어요.</p>}
          {result === 'UNVERIFIED' && (
            <Notice tone="error">시도 증빙이 미흡하거나 예매를 시도하지 않은 것으로 판단될 때 써요. 안전거래라면 착수비를 도우미에게 지급하지 않고, 이용자는 착수비·성공보수를 환불받아요(이용료 제외). 시도 증빙이 승인됐거나 착수비 지급이 시작된 거래는 확정할 수 없어요.</Notice>
          )}
          <Field label="확정 사유" required>
            <textarea rows={3} required maxLength={10000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {Number(requestId) > 0 && (
            <p className="record-note">
              <Link to={`/requests/${requestId}`}>요청 #{requestId} 상세 보기</Link> (관리자가 거래 당사자가 아니면 상세가 열리지 않을 수 있어요)
            </p>
          )}
          <button type="submit" className="btn primary" disabled={pending || !Number(requestId) || !note.trim() || !result}>
            결과 확정
          </button>
        </form>
      </section>
      <section className="content-card">
        <h2>기한 지난 요청 만료</h2>
        <p className="record-note">수락 기한이 지난 대기(PENDING) 요청을 만료(EXPIRED)로 정리해요. 자동 작업(RequestExpiryJob)이 꺼져 있을 때 써요.</p>
        <button
          type="button"
          className="btn secondary"
          disabled={pending}
          onClick={() => run(async () => setExpired(num(await unwrap<unknown>(api.POST('/api/admin/requests/expire'))) ?? 0))}
        >
          지금 만료 처리
        </button>
        {expired !== null && <Notice tone="success">{expired}건을 만료 처리했어요.</Notice>}
      </section>
    </>
  );
}

// ── 결과 확정 이력 ─────────────────────────────────────────────
function ResolvedTab() {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/requests/resolved', { params: { query: { page: 0, size: 100 } } })));
  const [shown, setShown] = useState<number | null>(null);
  return (
    <>
      <ListBlock title="운영팀이 확정한 결과" desc="이의 제기, 이용자 무응답, 도우미 결과 미제출로 운영팀이 최종 결과를 정한 요청이에요. 최근 순이에요." load={load} reload={reload} empty="아직 확정한 요청이 없어요.">
        {(rows) =>
          rows.map((row) => {
            const id = n(row, 'id')!;
            return (
              <Item
                key={id}
                raw={row}
                title={`#${id} ${s(row, 'submittedTargetName')} · ${resultLabel(row)}`}
                rows={[
                  ['확정 계기', reviewReasonNames[s(row, 'reviewReason')] ?? s(row, 'reviewReason')],
                  ['도우미 결과', resultLabels[s(row, 'agentResult')] ?? s(row, 'agentResult')],
                  ['이의 사유', s(row, 'disputeNote')],
                  ['확정 사유', s(row, 'resolutionNote')],
                  ['확정한 관리자', `${s(row, 'resolvedByName')} (#${n(row, 'resolvedByUserId') ?? ''})`],
                  ['확정 시각', utcToLocal(s(row, 'completedAt'))],
                ]}
              >
                <button type="button" className="btn secondary" onClick={() => setShown(id)}>
                  증빙·소명 보기
                </button>
              </Item>
            );
          })
        }
      </ListBlock>
      {shown !== null && <EvidenceModal id={shown} allowAsk={false} onClose={() => setShown(null)} />}
    </>
  );
}

// ── 결제 확인 ─────────────────────────────────────────────
const reviewTypes: Record<string, string> = { EVENT: '실패 웹훅', PAYMENT_FLAG: '수동 확인 표시', PAYMENT_STUCK: 'PG 확인 지연', REFUND_STUCK: '환불 지연' };
function PaymentsTab() {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/payments/review', { params: { query: { page: 0, size: 100 } } })));
  const { open, modal, pending } = useDialog(reload);
  return (
    <>
      <ListBlock title="결제 확인 목록" desc="자동 처리가 사람에게 넘긴 결제예요. 처리 기록은 상태를 바꾸지 않으니, 돈을 움직이는 조치(PG 취소 등)는 따로 한 뒤 기록해요." load={load} reload={reload} empty="확인할 결제가 없어요.">
        {(rows) =>
          rows.map((row) => (
            <Item
              key={s(row, 'key')}
              raw={row}
              title={`${reviewTypes[s(row, 'type')] ?? s(row, 'type')} · 주문 ${s(row, 'orderNumber')}`}
              rows={[
                ['결제', `#${n(row, 'paymentId')} · ${s(row, 'paymentStatus')} · ${won(n(row, 'amountKrw'))}`],
                ['코드', s(row, 'code')],
                ['내용', s(row, 'detail')],
                ['발생 시각', utcToLocal(s(row, 'occurredAt'))],
              ]}
            >
              <button
                type="button"
                className="btn primary"
                disabled={pending}
                onClick={() =>
                  open({
                    title: '처리 완료 기록',
                    fields: [noteField('확인·조치 내용', 1000)],
                    submitText: '기록',
                    success: '처리 완료로 기록했어요.',
                    action: (v) => unwrap(api.POST('/api/admin/payments/review/resolutions', { body: { key: s(row, 'key'), note: v.note } })),
                  })
                }
              >
                처리 완료 기록
              </button>
            </Item>
          ))
        }
      </ListBlock>
      {modal}
    </>
  );
}

// ── 신고 ─────────────────────────────────────────────────
// OPEN → INVESTIGATING/RESOLVED/DISMISSED, INVESTIGATING → RESOLVED/DISMISSED. 최종 처리 사유는 신고자에게 공개된다.
// 신고 처리는 제재를 하지 않는다. 제재가 필요하면 회원 제재 탭에서 따로 한다.
type ReportStatus = components['schemas']['ReportStatus'];
const reportStatusNames: Record<ReportStatus, string> = { OPEN: '접수', INVESTIGATING: '조사 중', RESOLVED: '처리 완료', DISMISSED: '처리 안 함' };
const reportReasonNames: Record<string, string> = { FRAUD: '사기·금전 피해', MACRO: '매크로 등 부정한 예매', RESALE: '재판매·티켓 양도', FALSE_REVIEW: '거짓 후기', OTHER: '기타' };

/** 상세 API 응답을 그대로 보여 주는 모달 */
function DetailModal({ title, fetcher, onClose }: { title: string; fetcher: () => Promise<unknown>; onClose: () => void }) {
  const [load] = useLoad(
    () =>
      fetcher().then(
        (d) => d as Raw,
        (e) => Promise.reject(new Error(errorText(e))),
      ),
    [],
  );
  return (
    <Modal title={title} onClose={onClose} wide>
      {load.status === 'loading' ? <p className="prose">불러오는 중이에요.</p> : load.status === 'error' ? <Notice tone="error">{load.message}</Notice> : <pre className="dev-json">{JSON.stringify(load.data, null, 2)}</pre>}
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}

function StatusFilter<T extends string>({ value, onChange, options }: { value: T | ''; onChange: (v: T | '') => void; options: [T, string][] }) {
  return (
    <section className="content-card">
      <Field label="상태">
        <select value={value} onChange={(e) => onChange(e.target.value as T | '')}>
          <option value="">전체</option>
          {options.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
    </section>
  );
}

function ReportsTab() {
  const [status, setStatus] = useState<ReportStatus | ''>('OPEN');
  const [load, reload] = useLoad<Raw[]>(
    () =>
      unwrap(api.GET('/api/admin/reports', { params: { query: { status: status || undefined, page: 0, size: 100 } } })).then(list, (e) => {
        throw new Error(errorText(e));
      }),
    [status],
  );
  const { open, modal, pending } = useDialog(reload);
  const [detail, setDetail] = useState<number | null>(null);
  const [evidenceOf, setEvidenceOf] = useState<number | null>(null);
  const update = (row: Raw, next: ReportStatus) =>
    open({
      title: `신고 #${n(row, 'reportId')} ${reportStatusNames[next]}`,
      fields: next === 'INVESTIGATING' ? [] : [{ name: 'note', label: '처리 사유 (신고자에게 공개)', required: true, type: 'textarea', maxLength: 2000 }],
      submitText: next === 'INVESTIGATING' ? '조사 시작' : reportStatusNames[next],
      danger: next === 'DISMISSED',
      success: next === 'INVESTIGATING' ? '조사 중으로 바꿨어요.' : '신고 처리를 기록했어요.',
      action: (v) =>
        unwrap(api.PATCH('/api/admin/reports/{reportId}', { params: { path: { reportId: n(row, 'reportId')! } }, body: { status: next, resolutionNote: next === 'INVESTIGATING' ? undefined : v.note } })),
    });
  return (
    <>
      <StatusFilter value={status} onChange={setStatus} options={Object.entries(reportStatusNames) as [ReportStatus, string][]} />
      <ListBlock title="신고 목록" desc="처리 사유는 신고자에게 공개돼요. 이용 정지 등 제재는 회원 제재 탭에서 따로 해요. '증빙 보기'로 신고자가 올린 자료를 확인할 수 있어요(본인이 신고자·대상인 신고는 볼 수 없어요)." load={load} reload={reload} empty="해당 상태의 신고가 없어요.">
        {(rows) =>
          rows.map((row) => {
            const st = s(row, 'status') as ReportStatus;
            const active = st === 'OPEN' || st === 'INVESTIGATING';
            return (
              <Item
                key={String(n(row, 'reportId'))}
                raw={row}
                title={`#${n(row, 'reportId')} ${reportReasonNames[s(row, 'reason')] ?? s(row, 'reason')} · ${reportStatusNames[st] ?? st}`}
                rows={[
                  ['신고자 → 대상', `회원 #${n(row, 'reporterUserId')} → 회원 #${n(row, 'reportedUserId')}`],
                  ['관련 거래', n(row, 'requestId') ? `#${n(row, 'requestId')}` : ''],
                  ['내용', s(row, 'description')],
                  ['처리 사유', s(row, 'resolutionNote')],
                  ['접수', utcToLocal(s(row, 'createdAt'))],
                  ['처리', utcToLocal(s(row, 'resolvedAt'))],
                ]}
              >
                <button type="button" className="btn ghost" onClick={() => setDetail(n(row, 'reportId')!)}>
                  상세
                </button>
                <button type="button" className="btn secondary" onClick={() => setEvidenceOf(n(row, 'reportId')!)}>
                  증빙 보기
                </button>
                {st === 'OPEN' && (
                  <button type="button" className="btn secondary" disabled={pending} onClick={() => update(row, 'INVESTIGATING')}>
                    조사 시작
                  </button>
                )}
                {active && (
                  <>
                    <button type="button" className="btn primary" disabled={pending} onClick={() => update(row, 'RESOLVED')}>
                      처리 완료
                    </button>
                    <button type="button" className="btn ghost tx-danger" disabled={pending} onClick={() => update(row, 'DISMISSED')}>
                      처리 안 함
                    </button>
                  </>
                )}
              </Item>
            );
          })
        }
      </ListBlock>
      {modal}
      {detail !== null && <DetailModal title={`신고 #${detail}`} fetcher={() => unwrap(api.GET('/api/admin/reports/{reportId}', { params: { path: { reportId: detail } } }))} onClose={() => setDetail(null)} />}
      {evidenceOf !== null && <ReportEvidenceModal reportId={evidenceOf} onClose={() => setEvidenceOf(null)} />}
    </>
  );
}

/** 신고자가 올린 증빙(최신 제출 순). 열람 주소는 5분 유효, 차단 파일은 주소가 없다. */
function ReportEvidenceModal({ reportId, onClose }: { reportId: number; onClose: () => void }) {
  const [rows, setRows] = useState<Raw[] | null>(null);
  const [failed, setFailed] = useState('');
  const load = useCallback(() => {
    setFailed('');
    unwrap<unknown>(api.GET('/api/admin/reports/{reportId}/evidences', { params: { path: { reportId }, query: { page: 0, size: 20 } } }))
      .then((data) => setRows(list(data)))
      .catch((e) => setFailed(e instanceof ApiError && e.status === 403 ? '본인이 신고자이거나 신고 대상인 신고의 증빙은 볼 수 없어요.' : e instanceof Error ? e.message : '증빙을 불러오지 못했어요.'));
  }, [reportId]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Modal title={`신고 #${reportId} 증빙`} onClose={onClose}>
      {failed ? (
        <>
          <Notice tone="error">{failed}</Notice>
          <div className="modal-actions">
            <button type="button" className="btn primary" onClick={load}>
              다시 불러오기
            </button>
          </div>
        </>
      ) : !rows ? (
        <p className="record-note">불러오는 중…</p>
      ) : !rows.length ? (
        <p className="record-note">신고자가 올린 증빙이 없어요.</p>
      ) : (
        rows.map((e, i) => {
          const files = list(pick(e, 'attachments'));
          return (
            <div key={String(n(e, 'evidenceId') ?? i)} className="tx-file-view">
              <div>
                <strong>
                  {n(e, 'revision') ?? 1}차 제출 · {utcToLocal(s(e, 'submittedAt'))}
                </strong>
                <small>{s(e, 'description') || '설명 없음'}</small>
                <small>
                  <EvidenceFileNames files={files} status={(f) => (str(f.scanStatus) === 'BLOCKED' ? '차단됨' : str(f.url) ? '열람 가능' : '열 수 없음(파일 없음)')} />
                </small>
              </div>
            </div>
          );
        })
      )}
    </Modal>
  );
}

// ── 후기 ─────────────────────────────────────────────────
// 숨기면 공개 목록·평점에서 빠지고 공개 사진도 지워진다. 다시 공개하는 API는 없다.
type ReviewStatus = components['schemas']['ReviewStatus'];
const reviewStatusNames: [ReviewStatus, string][] = [
  ['VISIBLE', '공개'],
  ['HIDDEN', '숨김'],
];

function ReviewsTab() {
  const [status, setStatus] = useState<ReviewStatus | ''>('VISIBLE');
  const [load, reload] = useLoad<Raw[]>(
    () =>
      unwrap(api.GET('/api/admin/reviews', { params: { query: { status: status || undefined, page: 0, size: 100 } } })).then(list, (e) => {
        throw new Error(errorText(e));
      }),
    [status],
  );
  const { open, modal, pending } = useDialog(reload);
  const [detail, setDetail] = useState<number | null>(null);
  return (
    <>
      <StatusFilter value={status} onChange={setStatus} options={reviewStatusNames} />
      <ListBlock title="후기 목록" desc="숨긴 후기는 공개 목록과 평점에서 빠지고 사진도 지워져요. 다시 공개할 수 없어요. 작성자가 삭제한 후기는 보이지 않아요." load={load} reload={reload} empty="해당 상태의 후기가 없어요.">
        {(rows) =>
          rows.map((row) => {
            const hidden = s(row, 'status') === 'HIDDEN';
            return (
              <Item
                key={String(n(row, 'requestId'))}
                raw={row}
                title={`거래 #${n(row, 'requestId')} · ${'★'.repeat(n(row, 'rating') ?? 0)} · ${hidden ? '숨김' : '공개'}`}
                rows={[
                  ['작성자 → 도우미', `회원 #${n(row, 'requesterId')} → 회원 #${n(row, 'agentId')}`],
                  ['내용', s(row, 'comment')],
                  [
                    '사진',
                    s(row, 'imageUrl') ? (
                      <ImagePreview key="photo" src={s(row, 'imageUrl')} alt="후기 인증 사진" className="review-photo" />
                    ) : (
                      ''
                    ),
                  ],
                  ['작성', utcToLocal(s(row, 'reviewedAt'))],
                ]}
              >
                <button type="button" className="btn ghost" onClick={() => setDetail(n(row, 'requestId')!)}>
                  상세
                </button>
                {!hidden && (
                  <button
                    type="button"
                    className="btn ghost tx-danger"
                    disabled={pending}
                    onClick={() =>
                      open({
                        title: '후기를 숨길까요? 다시 공개할 수 없어요.',
                        fields: [],
                        submitText: '숨기기',
                        danger: true,
                        success: '후기를 숨겼어요.',
                        action: () => unwrap(api.POST('/api/admin/reviews/{requestId}/hide', { params: { path: { requestId: n(row, 'requestId')! } } })),
                      })
                    }
                  >
                    숨기기
                  </button>
                )}
              </Item>
            );
          })
        }
      </ListBlock>
      {modal}
      {detail !== null && <DetailModal title={`거래 #${detail} 후기`} fetcher={() => unwrap(api.GET('/api/admin/reviews/{requestId}', { params: { path: { requestId: detail } } }))} onClose={() => setDetail(null)} />}
    </>
  );
}

// ── 회원 제재 ─────────────────────────────────────────────
function UsersTab() {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/users', { params: { query: { page: 0, size: 100 } } })));
  const { open, modal, pending } = useDialog(reload);
  const restrict = (row: Raw, kind: 'user' | 'agent', suspended: boolean) =>
    open({
      title: `${kind === 'user' ? '이용' : '도우미 활동'} ${suspended ? '정지' : '정지 해제'}`,
      fields: [noteField('사유', 500)],
      submitText: suspended ? '정지' : '해제',
      danger: suspended,
      success: suspended ? '정지했어요.' : '해제했어요.',
      action: (v) => {
        const opts = { params: { path: { userId: n(row, 'userId', 'id')! } }, body: { suspended, reason: v.note } };
        return unwrap(kind === 'user' ? api.PUT('/api/admin/users/{userId}/restriction', opts) : api.PUT('/api/admin/users/{userId}/agent-restriction', opts));
      },
    });
  return (
    <>
      <ListBlock title="회원 목록" desc="이용 정지는 로그인과 모든 이용을, 도우미 활동 정지는 요청 수신·수락·착수를 막아요. 정지하면 그 회원의 모든 세션이 끊겨요." load={load} reload={reload} empty="회원이 없어요.">
        {(rows) =>
          rows.map((row) => {
            const suspended = s(row, 'status') === 'SUSPENDED';
            const agentSuspended = pick(row, 'agentSuspended', 'agentRestricted', 'agentSuspendedAt') ? true : false;
            return (
              <Item
                key={String(n(row, 'userId', 'id'))}
                raw={row}
                title={`#${n(row, 'userId', 'id')} ${s(row, 'nickname')}`}
                rows={[
                  ['이메일', s(row, 'email')],
                  ['상태', s(row, 'status')],
                  ['본인인증', s(row, 'identityStatus')],
                  ['관리자', pick(row, 'isAdmin', 'admin') ? '예' : ''],
                  ['가입', utcToLocal(s(row, 'createdAt'))],
                ]}
              >
                <button type="button" className={`btn ${suspended ? 'secondary' : 'ghost tx-danger'}`} disabled={pending} onClick={() => restrict(row, 'user', !suspended)}>
                  {suspended ? '이용 정지 해제' : '이용 정지'}
                </button>
                <button type="button" className={`btn ${agentSuspended ? 'secondary' : 'ghost tx-danger'}`} disabled={pending} onClick={() => restrict(row, 'agent', !agentSuspended)}>
                  {agentSuspended ? '도우미 정지 해제' : '도우미 활동 정지'}
                </button>
              </Item>
            );
          })
        }
      </ListBlock>
      {modal}
    </>
  );
}

// ── 약관·예매처 ────────────────────────────────────────────
type PlatformBody = components['schemas']['PlatformInput'];
const emptyPlatform: PlatformBody = { code: '', name: '', homepageUrl: 'https://', enabled: true, policyAssessment: 'ALLOW', policySourceUrl: '', policyNote: '' };
const assessments: [PlatformBody['policyAssessment'], string][] = [
  ['ALLOW', '허용'],
  ['CONDITIONAL', '조건부 허용'],
  ['BLOCK', '차단'],
  ['UNKNOWN', '미확인'],
];

function SetupTab() {
  const [load, reload] = useAdminList(() => unwrap(api.GET('/api/admin/platforms')));
  const { pending, run } = useAction();
  const [platform, setPlatform] = useState<{ id?: number; body: PlatformBody } | null>(null);
  const [policy, setPolicy] = useState({ type: 'TERMS' as components['schemas']['PolicyDocumentType'], version: '', contentUrl: 'https://', contentSha256: '', effectiveAt: '' });

  async function savePlatform(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!platform || !e.currentTarget.checkValidity()) return;
    const body = { ...platform.body, policySourceUrl: platform.body.policySourceUrl || undefined, policyNote: platform.body.policyNote || undefined };
    const ok = await run(
      () => unwrap(platform.id ? api.PUT('/api/admin/platforms/{platformId}', { params: { path: { platformId: platform.id } }, body }) : api.POST('/api/admin/platforms', { body })),
      platform.id ? '예매처를 수정했어요.' : '예매처를 등록했어요.',
    );
    if (ok) {
      setPlatform(null);
      reload();
    }
  }

  async function savePolicy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return;
    await run(
      () => unwrap(api.POST('/api/admin/policies', { body: { ...policy, effectiveAt: new Date(policy.effectiveAt).toISOString().slice(0, 19) } })),
      '새 약관 버전을 등록했어요. 시행 시각부터 회원가입·요청에 쓰여요.',
    );
  }

  async function hashFromUrl() {
    await run(async () => {
      const res = await fetch(policy.contentUrl);
      if (!res.ok) throw new Error('원문을 불러오지 못했어요.');
      const buf = await crypto.subtle.digest('SHA-256', await res.arrayBuffer());
      setPolicy({ ...policy, contentSha256: [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('') });
    }, '원문 해시를 계산했어요.');
  }

  return (
    <>
      <section className="content-card">
        <div className="title-between">
          <h2>예매처</h2>
          <button type="button" className="btn secondary" onClick={() => setPlatform({ body: { ...emptyPlatform } })}>
            예매처 등록
          </button>
        </div>
        <p className="record-note">요청서·도우미 신청의 예매처 선택지예요. 대리 신청 정책이 허용·조건부 허용이어야 수락·착수할 수 있어요.</p>
        {load.status === 'loading' ? (
          <p className="prose">불러오는 중이에요.</p>
        ) : load.status === 'error' ? (
          <Notice tone="error">{load.message}</Notice>
        ) : load.data.length ? (
          load.data.map((row) => (
            <Item
              key={String(n(row, 'platformId', 'id'))}
              raw={row}
              title={`${s(row, 'name')} (${s(row, 'code')})`}
              rows={[
                ['홈페이지', s(row, 'homepageUrl')],
                ['정책', assessments.find(([v]) => v === s(row, 'policyAssessment'))?.[1] ?? s(row, 'policyAssessment')],
                ['사용', pick(row, 'enabled') === false ? '꺼짐' : '켜짐'],
                ['근거', s(row, 'policySourceUrl')],
                ['메모', s(row, 'policyNote')],
              ]}
            >
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  setPlatform({
                    id: n(row, 'platformId', 'id'),
                    body: {
                      code: s(row, 'code'),
                      name: s(row, 'name'),
                      homepageUrl: s(row, 'homepageUrl'),
                      enabled: pick(row, 'enabled') !== false,
                      policyAssessment: (s(row, 'policyAssessment') || 'UNKNOWN') as PlatformBody['policyAssessment'],
                      policySourceUrl: s(row, 'policySourceUrl'),
                      policyNote: s(row, 'policyNote'),
                    },
                  })
                }
              >
                수정
              </button>
            </Item>
          ))
        ) : (
          <p className="prose">등록된 예매처가 없어요.</p>
        )}
      </section>

      <section className="content-card">
        <h2>새 약관 버전 등록</h2>
        <p className="record-note">이용약관·개인정보·연락처 제공 동의 문서의 원문 주소와 원문의 SHA-256 해시를 등록해요. 시행 시각이 지나면 현재 약관(GET /api/policies)으로 쓰여요.</p>
        <form noValidate onSubmit={savePolicy}>
          <div className="form-grid">
            <Field label="문서 종류" required>
              <select value={policy.type} onChange={(e) => setPolicy({ ...policy, type: e.target.value as typeof policy.type })}>
                <option value="TERMS">서비스 이용약관</option>
                <option value="PRIVACY">개인정보 처리방침</option>
                <option value="CONTACT_SHARING">연락처 제공 동의</option>
              </select>
            </Field>
            <Field label="버전" required>
              <input required maxLength={30} value={policy.version} onChange={(e) => setPolicy({ ...policy, version: e.target.value })} placeholder="예: 2026-10-01" />
            </Field>
          </div>
          <Field label="원문 주소" required>
            <input type="url" required pattern="https?://.+" maxLength={1000} value={policy.contentUrl} onChange={(e) => setPolicy({ ...policy, contentUrl: e.target.value })} />
          </Field>
          <Field label="원문 SHA-256" required helper="원문 파일의 SHA-256(16진수 64자리). 원문 주소에서 계산하거나 직접 붙여 넣어요.">
            <input required pattern="[a-fA-F0-9]{64}" value={policy.contentSha256} onChange={(e) => setPolicy({ ...policy, contentSha256: e.target.value.trim() })} />
          </Field>
          <div className="account-inline">
            <button type="button" className="btn ghost" disabled={pending || !/^https?:\/\/.+/.test(policy.contentUrl)} onClick={() => void hashFromUrl()}>
              원문 주소에서 해시 계산
            </button>
            <small className="field-helper">다른 도메인이면 브라우저 보안 정책(CORS) 때문에 실패할 수 있어요.</small>
          </div>
          <Field label="시행 시각" required>
            <input type="datetime-local" required value={policy.effectiveAt} onChange={(e) => setPolicy({ ...policy, effectiveAt: e.target.value })} />
          </Field>
          <button type="submit" className="btn primary" disabled={pending}>
            약관 등록
          </button>
        </form>
      </section>

      {platform && (
        <Modal title={platform.id ? '예매처 수정' : '예매처 등록'} onClose={() => setPlatform(null)}>
          <form noValidate onSubmit={savePlatform}>
            <div className="form-grid">
              <Field label="코드" required helper="영문 대문자·숫자·_ 30자까지">
                <input required pattern="[A-Z0-9_]{1,30}" value={platform.body.code} onChange={(e) => setPlatform({ ...platform, body: { ...platform.body, code: e.target.value.toUpperCase() } })} />
              </Field>
              <Field label="이름" required>
                <input required maxLength={100} value={platform.body.name} onChange={(e) => setPlatform({ ...platform, body: { ...platform.body, name: e.target.value } })} />
              </Field>
            </div>
            <Field label="홈페이지" required>
              <input type="url" required pattern="https?://.+" maxLength={1000} value={platform.body.homepageUrl} onChange={(e) => setPlatform({ ...platform, body: { ...platform.body, homepageUrl: e.target.value } })} />
            </Field>
            <Field label="대리 신청 정책" required>
              <select value={platform.body.policyAssessment} onChange={(e) => setPlatform({ ...platform, body: { ...platform.body, policyAssessment: e.target.value as PlatformBody['policyAssessment'] } })}>
                {assessments.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="정책 근거 URL">
              <input type="url" pattern="https?://.+" maxLength={1000} value={platform.body.policySourceUrl ?? ''} onChange={(e) => setPlatform({ ...platform, body: { ...platform.body, policySourceUrl: e.target.value } })} />
            </Field>
            <Field label="정책 메모">
              <textarea rows={2} maxLength={10000} value={platform.body.policyNote ?? ''} onChange={(e) => setPlatform({ ...platform, body: { ...platform.body, policyNote: e.target.value } })} />
            </Field>
            <label className="check-row">
              <input type="checkbox" checked={platform.body.enabled ?? true} onChange={(e) => setPlatform({ ...platform, body: { ...platform.body, enabled: e.target.checked } })} />
              사용(목록에 표시)
            </label>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setPlatform(null)}>
                돌아가기
              </button>
              <button type="submit" className="btn primary" disabled={pending}>
                저장
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('policy');
  return (
    <>
      <PageTitle title="관리자" />
      <p className="record-note">모든 작업은 서버에 바로 반영되니 확인 후 실행해 주세요.</p>
      <div className="request-tabs tx-tabs admin-tabs" role="tablist" aria-label="관리자 메뉴">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'policy' && <PolicyTab />}
      {tab === 'files' && <FilesTab />}
      {tab === 'profiles' && <ProfilesTab />}
      {tab === 'attempts' && <AttemptsTab />}
      {tab === 'settlements' && <SettlementsTab />}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'resolved' && <ResolvedTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'setup' && <SetupTab />}
    </>
  );
}
