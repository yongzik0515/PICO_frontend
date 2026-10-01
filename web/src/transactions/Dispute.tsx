import { useState, type FormEvent } from 'react';
import { api, unwrap } from '../api/client';
import { list, num, pick, str, type Raw } from '../api/pick';
import { uploadDisputeFile, useLoad } from './model';
import { EvidenceFileNames, Field, FilePicker, Notice, TxCard, useAction, utcToLocal } from './ui';

// 분쟁 소명: 이의 제기(DISPUTED) 동안 운영팀 질문과 내 소명만 보인다. 상대방은 내 소명을 볼 수 없다.
// GET/POST /api/requests/{requestId}/dispute/messages (첨부는 purpose=DISPUTE 업로드)
export function DisputeCard({ requestId, disputed, reloadDetail }: { requestId: number; disputed: boolean; reloadDetail?: () => void }) {
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
    }, '소명을 제출했어요. 운영팀이 확인해요.');
    setProgress('');
    if (ok) {
      setBody('');
      setFiles([]);
      reload();
    }
  }

  return (
    <TxCard title="분쟁 소명">
      <p className="prose">운영팀이 최종 결과를 정할 때 참고해요. 여기 적은 내용과 파일은 운영팀만 보고, 상대방에게는 보이지 않아요.</p>
      {openQuestion && (
        <Notice tone="error">
          운영팀이 추가 자료를 요청했어요{str(pick(openQuestion, 'replyDueAt')) ? ` (${utcToLocal(str(pick(openQuestion, 'replyDueAt'))!)}까지)` : ''}. 기한이 지나면 있는 자료로 결과를 정해요.
        </Notice>
      )}
      {messages.length > 0 && (
        <div className="tx-file-list">
          {messages.map((m: Raw) => {
            const attached = list(pick(m, 'attachments'));
            const question = str(pick(m, 'kind')) === 'QUESTION';
            return (
              <div key={String(num(pick(m, 'id')))} className="tx-file-view">
                <div>
                  <strong>{question ? '운영팀 질문' : '내 소명'} · {utcToLocal(str(pick(m, 'createdAt')) ?? '')}</strong>
                  <small style={{ whiteSpace: 'pre-wrap' }}>{str(pick(m, 'body'))}</small>
                  {attached.length > 0 && (
                    <small>
                      <EvidenceFileNames files={attached} status={() => '첨부'} />
                    </small>
                  )}
                </div>
              </div>
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
              {pending ? '제출 중…' : '소명 제출'}
            </button>
          </div>
        </form>
      )}
    </TxCard>
  );
}
