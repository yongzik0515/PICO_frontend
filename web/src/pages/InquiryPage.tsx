import { type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Field, Notice } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';

// 프로토타입 account.js의 inquiries()/inquiryHistory().
// 문의 API가 아직 없어 이 브라우저에만 계정별로 저장한다. 운영팀에는 전송되지 않는다(USER_FLOW.md 7번).
type Inquiry = { id: number; subject: string; message: string; createdAt: string; reply?: string };

const storageKey = (userKey: string) => `pico:inquiries:${userKey}`;

function readInquiries(userKey: string): Inquiry[] {
  try {
    const rows = JSON.parse(localStorage.getItem(storageKey(userKey)) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function InquiryWritePage() {
  const { userKey } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const d = new FormData(form);
    const row: Inquiry = { id: Date.now(), subject: String(d.get('subject')).trim(), message: String(d.get('message')).trim(), createdAt: new Date().toISOString() };
    try {
      localStorage.setItem(storageKey(userKey), JSON.stringify([row, ...readInquiries(userKey)]));
    } catch {
      return toast('이 브라우저에 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    }
    toast('문의를 저장했어요.');
    navigate('/inquiries/history');
  }

  return (
    <div className="account-contained">
      <PageTitle title="문의 작성" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <section className="content-card">
        <div className="account-title-row">
          <h2>문의 작성</h2>
          <Link className="btn ghost" to="/inquiries/history">
            문의 현황
          </Link>
        </div>
        <form noValidate onSubmit={submit}>
          <Field label="제목" required>
            <input name="subject" required maxLength={100} placeholder="예: 결제한 금액을 확인하고 싶어요" />
          </Field>
          <Field label="문의 내용" required>
            <textarea name="message" rows={6} required maxLength={3000} placeholder="거래와 관련된 문의라면 공연명과 요청 날짜를 함께 적어 주세요." />
          </Field>
          <p className="record-note">아직 문의 접수 서버가 연결되지 않아 이 브라우저에만 저장되고, 운영팀에 전송되지 않아요.</p>
          <div className="account-form-footer">
            <button type="submit" className="btn primary">
              문의 저장
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function InquiryHistoryPage() {
  const { userKey } = useAuth();
  const [params] = useSearchParams();
  const rows = readInquiries(userKey);
  return (
    <div className="account-contained">
      <PageTitle title="문의 현황" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      {/* 운영팀 안내 알림(ANNOUNCEMENT)의 '자세히 보기'로 들어온 경우. 메시지 전문·답장은 문의 API가 생기면 연결한다. */}
      {params.get('notification') && <Notice>운영팀이 보낸 메시지는 문의 기능이 서버와 연결되면 이곳에서 전문을 보고 답장할 수 있어요.</Notice>}
      <div className="inquiry-history-list">
        <section className="content-card">
          <h2>문의 현황</h2>
          {rows.length ? (
            rows.map((q) => (
              <details key={q.id} className="inquiry-item">
                <summary>
                  {q.subject} <small>{q.reply ? '답변 완료' : '접수 대기 · 서버 연결 전'}</small>
                </summary>
                <small>{new Date(q.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                <p>{q.message}</p>
                {q.reply && <p>{q.reply}</p>}
              </details>
            ))
          ) : (
            <p className="prose">아직 작성한 문의가 없어요.</p>
          )}
          <div className="account-form-footer">
            <Link className="btn primary" to="/inquiries">
              문의 작성
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
