import { useState, type FormEvent } from 'react';
import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { uploadDisputeFile, useLoad } from './model';
import { EvidenceFileNames, Field, FilePicker, Notice, TxCard, useAction, utcToLocal } from './ui';

// 분쟁 소명·추가 자료: 이의 제기(DISPUTED) 동안 설명과 자료를 올리는 단 하나의 창구다. 운영팀만 보고 상대방은 볼 수 없다.
// (분쟁 중에는 이용자에게도 보이는 결과 증빙 '추가 자료 올리기'를 쓰지 않는다.)
// GET/POST /api/requests/{requestId}/dispute/messages (첨부는 purpose=DISPUTE 업로드)
export function DisputeCard({ requestId, disputed, agent, reloadDetail }: { requestId: number; disputed: boolean; agent: boolean; reloadDetail?: () => void }) {
  // 운영팀 질문 알림을 보고 돌아오면 새 질문이 보이도록 창 복귀 때 다시 불러온다.
  const [load, reload] = useLoad(() => unwrap<unknown>(api.GET('/api/requests/{requestId}/dispute/messages', { params: { path: { requestId } } })).then(list), [requestId], { refreshOnFocus: true });
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState('');
  // 409(운영팀이 그사이 결과를 확정해 분쟁이 끝남 등): 서버 메시지를 보여 주고 소명과 요청 상세를 다시 불러온다.
  const { pending, run } = useAction({
    onConflict: () => {
      reload();
      reloadDetail?.();
    },
  });
  const messages = load.status === 'done' ? load.data : [];
  if (!disputed && messages.length === 0) return null;
  const latest = messages[messages.length - 1];
  const openQuestion = latest && str(pick(latest, 'kind')) === 'QUESTION' ? latest : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const ok = await run(async () => {
      const storageKeys: string[] = [];
      for (const [i, f] of files.entries()) {
        setProgress(`파일 올리는 중 (${i + 1}/${files.length})`);
        storageKeys.push(await uploadDisputeFile(f));
      }
      setProgress('');
      await unwrap(api.POST('/api/requests/{requestId}/dispute/messages', { params: { path: { requestId } }, body: { body: body.trim(), storageKeys } }));
    }, '소명과 자료를 제출했어요. 운영팀이 확인해요.');
    setProgress('');
    if (ok) {
      setBody('');
      setFiles([]);
      reload();
    }
  }

  return (
    <TxCard title="분쟁 소명·추가 자료">
      <p className="prose">설명과 예매 내역·시도 화면 같은 자료를 여기에 함께 올려 주세요. 운영팀이 결과 조정안을 만들 때 참고해요. 여기 올린 내용과 파일은 운영팀만 보고, {agent ? '이용자' : '도우미'}에게는 보이지 않아요.</p>
      {openQuestion && (
        <Notice tone="error">
          운영팀이 추가 자료를 요청했어요{str(pick(openQuestion, 'replyDueAt')) ? ` (${utcToLocal(str(pick(openQuestion, 'replyDueAt'))!)}까지)` : ''}. 기한이 지나면 있는 자료로 조정안을 만들어요.
        </Notice>
      )}
      {messages.length > 0 && (
        <div className="tx-file-list">
          {messages.map((m: Raw) => {
            const attached = list(pick(m, 'attachments'));
            const question = str(pick(m, 'kind')) === 'QUESTION';
            return (
              // 접힌 상태에서는 첫 줄만 보이고, 누르면 전체 내용과 첨부가 펼쳐진다. 제출한 소명은 고칠 수 없다(읽기 전용).
              <details key={String(num(pick(m, 'id')))} className="tx-file-view dispute-message">
                <summary>
                  <strong>
                    {question ? '운영팀 질문' : '내 소명'} · {utcToLocal(str(pick(m, 'createdAt')) ?? '')}
                    {attached.length > 0 && ` · 첨부 ${attached.length}개`}
                  </strong>
                  <small>{str(pick(m, 'body'))}</small>
                </summary>
                <div className="dispute-message-body">
                  <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>{str(pick(m, 'body'))}</p>
                  {attached.length > 0 && <EvidenceFileNames files={attached} status={() => ''} />}
                  {!question && <p className="record-note">제출한 소명은 고칠 수 없어요. 덧붙일 내용은 새 소명으로 올려 주세요.</p>}
                </div>
              </details>
            );
          })}
        </div>
      )}
      {disputed && (
        <form noValidate onSubmit={submit}>
          <Field label={openQuestion ? '답변' : '소명 내용'} required>
            <textarea rows={4} required maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="예: 예매 완료 화면을 첨부해요. 안내드린 좌석은 1층 B구역이었어요." />
          </Field>
          <FilePicker kind="dispute" files={files} onChange={setFiles} />
          <div className="tx-form-footer">
            <span role="status">{progress}</span>
            <button type="submit" className="btn primary" disabled={pending || !body.trim()}>
              {pending ? '제출 중…' : '소명·자료 제출'}
            </button>
          </div>
        </form>
      )}
    </TxCard>
  );
}
