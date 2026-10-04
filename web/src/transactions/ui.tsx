import { useState, type InputHTMLAttributes, type ReactNode, cloneElement, isValidElement, type ReactElement } from 'react';
import { ApiError } from '../api/client';
import { str, type Raw } from '../api/pick';
import { Icon } from '../ui/Icon';
import { FileAttachment } from '../ui/ImagePreview';
import { money } from '../ui/format';
import { useToast } from '../ui/Toast';
import { MAX_FILE_BYTES, acceptOf, endedStages, fileKinds, mimeOf, stageNames, type FileKind, type Role, type Stage } from './model';

// 프로토타입 transactions.js의 card()/notice()/badge()/next()/progress()/rows() 마크업

/** Stored attachments: clickable photo thumbnails, document links and review status. */
export function EvidenceFileNames({ files, status }: { files: Raw[]; status: (file: Raw) => string }) {
  return (
    <span className="evidence-attachments">
      {files.map((f, i) => (
        <span className="evidence-attachment" key={str(f.id) ?? str(f.attachmentId) ?? i}>
          <FileAttachment url={str(f.url)} name={str(f.originalName) ?? '파일'} mimeType={str(f.mimeType)} />
          {status(f) && <span>{status(f)}</span>}
        </span>
      ))}
    </span>
  );
}

export function TxCard({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="content-card tx-card">
      <div className="tx-card-heading">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Notice({ tone = '', children }: { tone?: '' | 'success' | 'error'; children: ReactNode }) {
  return (
    <div className={`tx-notice ${tone}`}>
      <Icon name={tone === 'success' ? 'check' : 'info'} size={18} />
      <span>{children}</span>
    </div>
  );
}

export function StatusBadge({ stage }: { stage: Stage }) {
  const tone = endedStages.includes(stage) ? 'muted' : stage === 'pending' || stage === 'policy_review' ? 'amber' : 'blue';
  return (
    <span className={`tx-status ${tone}`}>
      <Icon name={(stage === 'completed' || stage === 'matching_completed') ? 'check' : 'clock'} size={13} /> {stageNames[stage]}
    </span>
  );
}

const nextCopy: Record<Stage, [string, string, string?]> = {
  policy_review: ['운영팀이 요청을 확인하고 있어요', '대리 신청 정책 검토가 끝나면 도우미가 수락할 수 있어요.', '운영팀의 정책 검토가 끝나면 수락할 수 있어요.'],
  policy_blocked: ['운영 정책상 진행할 수 없는 요청이에요', '해당 공연·예매처는 대리 신청이 허용되지 않아요. 요청을 취소하거나 내용을 수정해 주세요.', '운영 정책상 수락할 수 없는 요청이에요.'],
  pending: ['도우미가 요청을 확인할 차례예요', '수락 전에는 요청 내용을 수정하거나 취소할 수 있어요.', '요청을 확인하고 수락하거나 거절해 주세요.'],
  terms_needed: ['도우미가 첫 최종 조건을 작성할 차례예요', '도우미의 첫 제안이 도착하면 확정하거나 조건과 사유를 함께 수정 제안할 수 있어요.', '비용과 진행 조건을 정해 첫 제안을 보내 주세요.'],
  // 도우미가 보낸 조건 기준. 이용자가 보낸 조건이면 NextStep에서 확인하는 쪽을 도우미로 바꾼다.
  terms_sent: ['이용자가 최종 조건을 확인할 차례예요', '변경된 내용을 확인하고 확정하거나 수정을 요청해 주세요.', '이용자의 확인을 기다려 주세요.'],
  revision_requested: ['조건을 다시 제안할 수 있어요', '수정 요청을 확인하고 새 조건을 제안해 주세요.', '수정 요청을 확인하고 새 조건을 제안해 주세요.'],
  payment: ['이용자가 안전거래를 결제할 차례예요', '확정된 금액을 가상계좌로 입금하면 예매 준비를 시작해요.', '이용자가 입금하면 알려드릴게요.'],
  ready: ['도우미가 착수할 차례예요', '도우미가 착수하면 알려드릴게요.', '예매를 시작할 때 착수 버튼을 눌러 주세요.'],
  in_progress: ['도우미가 예매 결과를 등록할 차례예요', '도우미가 올린 시도 증빙을 확인하며 결과를 기다려 주세요.', '시도 증빙을 올리고, 예매가 끝나면 결과 증빙을 올려 주세요. 운영팀 파일 검토 후 결과를 제출할 수 있어요.'],
  result_submitted: ['이용자가 예매 결과를 확인할 차례예요', '확정 조건과 등록된 결과를 함께 확인해 주세요.', '이용자가 결과를 확인하고 있어요.'],
  disputed: ['양쪽 결과가 달라 운영팀이 확인하고 있어요', '운영팀이 증빙을 검토해 결과를 확정해요.'],
  matching_completed: ['직접 거래 매칭을 마쳤어요', '착수·결과 등록 없이 당사자끼리 진행해요. 이용자는 거래 경험과 예매 결과를 후기로 남길 수 있어요.', '착수·결과 등록 없이 이용자와 직접 진행해 주세요.'],
  completed: ['결과 확인을 마쳤어요', '안전거래라면 정산·환불은 확정된 결과와 합의 조건에 따라 처리돼요. 직접 거래는 당사자끼리 정산해요.'],
  cancelled: ['이 요청은 취소되었어요', '새 요청은 도우미 프로필에서 보낼 수 있어요.'],
  rejected: ['도우미가 요청을 거절했어요', '다른 도우미를 찾아 요청해 보세요.'],
  expired: ['응답 기한이 지난 요청이에요', '도우미 프로필에서 새 요청을 보낼 수 있어요.'],
};

// 단계마다 지금 해야 할 일이 있는 쪽. 다른 쪽에는 기다리면 된다는 안내를 한 줄 더 보여 준다.
const actor: Partial<Record<Stage, Role>> = { pending: 'agent', payment: 'user', ready: 'agent', in_progress: 'agent', result_submitted: 'user' };

export function NextStep({ stage, role, proposedBy, myName }: { stage: Stage; role: Role; proposedBy?: 'REQUESTER' | 'AGENT'; myName?: string }) {
  const idle =
    stage === 'policy_review' ||
    (stage === 'terms_sent' && !!proposedBy && (proposedBy === 'AGENT') === (role === 'agent')) ||
    (!!actor[stage] && actor[stage] !== role);
  const [title, userText, agentText] =
    stage === 'terms_sent' && proposedBy === 'REQUESTER'
      ? ['도우미가 최종 조건을 확인할 차례예요', '도우미의 확인을 기다려 주세요.', '변경된 내용을 확인하고 확정하거나 수정을 요청해 주세요.']
      : nextCopy[stage];
  const text = role === 'agent' && agentText !== undefined ? agentText : userText;
  return (
    <div className={`tx-next ${(stage === 'completed' || stage === 'matching_completed') ? 'success' : ''}`}>
      <span className="tx-next-icon">
        <Icon name={(stage === 'completed' || stage === 'matching_completed') ? 'check' : 'clock'} size={22} />
      </span>
      <div>
        <strong>{title}</strong>
        {text && <p>{text}</p>}
        {idle && <p>{myName ? `${myName}님은 ` : ''}지금 따로 하실 일이 없어요. 편하게 기다려 주세요.</p>}
      </div>
    </div>
  );
}

const steps: [string, Stage[]][] = [
  ['요청 보내기', ['policy_review', 'policy_blocked', 'pending']],
  ['요청 수락 · 조건 작성', ['terms_needed', 'revision_requested']],
  ['이용자 조건 확인', ['terms_sent']],
  ['안전거래 결제', ['payment']],
  ['착수 · 예매 · 결과 등록', ['ready', 'in_progress']],
  ['이용자 결과 확인', ['result_submitted', 'disputed']],
];

/** 직접 거래는 조건 확인 후 매칭 완료·후기로 종료한다. */
export function Progress({ stage, direct = false, proposedBy }: { stage: Stage; direct?: boolean; proposedBy?: 'REQUESTER' | 'AGENT' }) {
  const named = steps.map(([label, s]): [string, Stage[]] => [s.includes('terms_sent') ? `${proposedBy === 'REQUESTER' ? '도우미' : '이용자'} 조건 확인` : label, s]);
  const shown: [string, Stage[]][] = direct
    ? [...named.slice(0, 3), ['매칭 완료 · 후기', ['matching_completed', 'completed']]]
    : named;
  const active = shown.findIndex(([, s]) => s.includes(stage));
  return (
    <ol aria-label="거래 진행 상황">
      {shown.map(([label], i) => {
        const done = (stage === 'completed' || stage === 'matching_completed') || (active >= 0 && i < active);
        const current = i === active;
        return (
          <li key={label} className={done ? 'done' : current ? 'current' : 'upcoming'} aria-current={current ? 'step' : undefined}>
            <b>{done ? <Icon name="check" size={14} /> : i + 1}</b>
            <span>
              {label}
              {current && <small>현재 진행 단계예요</small>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="document-rows tx-rows">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd style={{ whiteSpace: 'pre-line' }}>{v === '' || v === undefined || v === null ? '미입력' : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const won = (n: number | undefined) => (n === undefined ? '' : `${money(n)}원`);
export const dateTime = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');
/** 서버가 UTC LocalDateTime(끝에 Z 없음)으로 준 값을 한국 시각으로 보여 준다. */
/** 서버 UTC 시각 → 한국 날짜 'YYYY-MM-DD'(가이드 2-3: 응답 시각은 모두 UTC, 시간대 표시 없음) */
export const kstDay = (iso: string) => {
  if (!iso) return '';
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  return isNaN(t) ? iso.slice(0, 10) : new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
};
export const utcToLocal = (iso: string) => {
  if (!iso) return '';
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  return isNaN(d.getTime()) ? iso : d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
};

// 입력 필드(프로토타입 input()/area())
/** error를 주면 입력칸에 빨간 테두리(aria-invalid)를 켜고 그 아래에 이유를 적는다. */
export function Field({ label, required, helper, error, children }: { label: string; required?: boolean; helper?: string; error?: string; children: ReactNode }) {
  // 입력칸을 직접 받지 않고 children으로 받으므로, aria-invalid는 복제해서 붙인다(빨간 테두리는 기존 CSS가 처리).
  const marked = error && isValidElement(children) ? cloneElement(children as ReactElement<{ 'aria-invalid'?: boolean }>, { 'aria-invalid': true }) : children;
  return (
    <label className="field">
      <span>
        {label} {required ? <em>*</em> : <small>선택</small>}
      </span>
      {marked}
      {helper && <small className="field-helper">{helper}</small>}
      <small className="field-error" aria-live="polite">
        {error}
      </small>
    </label>
  );
}

/** 첨부 파일 선택(업로드는 제출할 때 한다). 목적별 허용 형식·개수와 20MB 초과는 바로 알려 준다. */
export function FilePicker({ files, onChange, kind }: { files: File[]; onChange: (files: File[]) => void; kind: FileKind }) {
  const [error, setError] = useState('');
  const { types, label, max } = fileKinds[kind];
  return (
    <>
      <label className="upload-area tx-upload">
        <Icon name="upload" size={28} />
        <strong>파일 선택 또는 추가 첨부</strong>
        <small>{label} · 파일당 최대 20MB · 최대 {max}개</small>
        <input
          type="file"
          multiple
          accept={acceptOf(kind)}
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            e.target.value = '';
            const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
            const wrongType = picked.filter((f) => !types.includes(mimeOf(f)));
            const ok = picked.filter((f) => f.size <= MAX_FILE_BYTES && types.includes(mimeOf(f)));
            const room = Math.max(0, max - files.length);
            const messages = [
              tooBig.length ? `${tooBig.map((f) => f.name).join(', ')}: 20MB를 넘어 첨부할 수 없어요.` : '',
              wrongType.length ? `${wrongType.map((f) => f.name).join(', ')}: 이 자료에는 ${label} 형식만 올릴 수 있어요.` : '',
              ok.length > room ? `파일은 최대 ${max}개까지 첨부할 수 있어요.` : '',
            ].filter(Boolean);
            setError(messages.join(' '));
            onChange([...files, ...ok.slice(0, room)]);
          }}
        />
      </label>
      <div className="tx-file-list">
        {files.length ? (
          files.map((f, i) => (
            <div key={i} className="tx-file-view">
              <div className="tx-file-thumb">
                <Icon name="file" size={24} />
              </div>
              <div>
                <strong>{f.name}</strong>
                <small>{(f.size / 1048576).toFixed(1)}MB · 제출할 때 업로드해요</small>
              </div>
              <button type="button" className="icon-btn" aria-label={`${f.name} 삭제`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <Icon name="close" size={17} />
              </button>
            </div>
          ))
        ) : (
          <p className="tx-file-empty">아직 첨부한 파일이 없어요.</p>
        )}
      </div>
      <p className="field-error" role="alert">
        {error}
      </p>
    </>
  );
}

/**
 * 금액 입력칸. 입력 중에는 빈칸을 그대로 두고(0으로 되돌리지 않음), 숫자만 부모에게 넘긴다.
 * 처음 값이 0이면 빈칸 + placeholder '0'으로 보여 준다. 필수 칸을 비워 두면 브라우저 검증에 걸린다.
 */
export function MoneyInput({ value, onChange, ...rest }: { value: number | undefined; onChange: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(value == null ? '' : String(value));
  return (
    <input
      type="number"
      min={0}
      step={100}
      inputMode="numeric"
      placeholder="0"
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(Math.max(0, Number(e.target.value) || 0));
      }}
    />
  );
}

/**
 * 버튼 한 번에 API를 부르고, 실패하면 서버 메시지를 토스트로 보여 준다.
 * onConflict: 409(상대방 진행·기한 경과 등으로 상태가 이미 바뀜)일 때 부른다. 원인은 짐작하지 않고
 * 서버 메시지를 그대로 보여 주며, 호출한 화면은 여기서 최신 상태를 다시 불러온다.
 */
export function useAction({ onConflict }: { onConflict?: () => void } = {}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  async function run(action: () => Promise<unknown>, success?: string) {
    if (pending) return false;
    setPending(true);
    try {
      await action();
      if (success) toast(success);
      return true;
    } catch (e) {
      const conflict = !!onConflict && e instanceof ApiError && e.status === 409;
      if (conflict) onConflict();
      toast(e instanceof Error ? (conflict ? `${e.message} 최신 상태로 다시 불러왔어요.` : e.message) : '요청을 처리하지 못했어요.');
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, run };
}
