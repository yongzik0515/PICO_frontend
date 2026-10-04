import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, unwrap } from '../api/client';
import type { components } from '../api/schema';
import { useAuth } from '../auth/AuthContext';
import { useLoad } from '../transactions/model';
import { Field, Notice, useAction, utcToLocal } from '../transactions/ui';
import { PageTitle } from '../ui/PageTitle';

type Inquiry = components['schemas']['InquiryDetail'];

export function InquiryWritePage() {
  const navigate = useNavigate();
  const { pending, run } = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) return form.querySelector<HTMLElement>(':invalid')?.focus();
    const data = new FormData(form);
    const subject = String(data.get('subject') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    if (!subject || !message) return;
    const ok = await run(() => unwrap(api.POST('/api/inquiries', { body: { subject, message } })), '문의를 접수했어요.');
    if (ok) navigate('/inquiries/history');
  }
  return <div className="account-contained">
    <PageTitle title="문의 작성" crumbs={[{ label: '마이페이지', to: '/my' }]} />
    <section className="content-card">
      <div className="account-title-row"><h2>문의 작성</h2><Link className="btn ghost" to="/inquiries/history">문의 현황</Link></div>
      <form onSubmit={submit}>
        <Field label="제목" required><input name="subject" required maxLength={100} placeholder="예: 결제한 금액을 확인하고 싶어요" /></Field>
        <Field label="문의 내용" required><textarea name="message" rows={6} required maxLength={3000} placeholder="거래 관련 문의라면 공연명과 요청 날짜를 함께 적어 주세요." /></Field>
        <p className="record-note">접수한 문의와 운영팀 답변은 본인만 확인할 수 있어요.</p>
        <div className="account-form-footer"><button type="submit" className="btn primary" disabled={pending}>{pending ? '접수 중…' : '문의 접수'}</button></div>
      </form>
    </section>
  </div>;
}

export function InquiryHistoryPage() {
  const { userKey } = useAuth();
  const [page, setPage] = useState(0);
  const [load, reload] = useLoad(() => unwrap<Inquiry[]>(api.GET('/api/inquiries', { params: { query: { page, size: 20 } } })), [userKey, page], { refreshOnFocus: true });
  return <div className="account-contained">
    <PageTitle title="문의 현황" crumbs={[{ label: '마이페이지', to: '/my' }]} />
    <section className="content-card">
      <div className="account-title-row"><h2>내 문의</h2><button type="button" className="btn ghost" onClick={reload}>새로 고침</button></div>
      {load.status === 'loading' ? <p>불러오는 중이에요.</p> : load.status === 'error' ? <Notice tone="error">{load.message}</Notice> : load.data.length ? load.data.map((q) => <details key={q.id} className="inquiry-item">
        <summary>{q.subject} <small>{q.status === 'ANSWERED' ? '답변 완료' : '답변 대기'}</small></summary>
        <small>{utcToLocal(q.createdAt ?? '')}</small>
        <p style={{ whiteSpace: 'pre-wrap' }}>{q.message}</p>
        {q.reply && <><h3>운영팀 답변</h3><small>{utcToLocal(q.answeredAt ?? '')}</small><p style={{ whiteSpace: 'pre-wrap' }}>{q.reply}</p></>}
      </details>) : <p className="prose">접수한 문의가 없어요.</p>}
      <div className="account-form-footer">
        <button type="button" className="btn ghost" disabled={page === 0 || load.status !== 'done'} onClick={() => setPage(page - 1)}>이전</button>
        <span>{page + 1}페이지</span>
        <button type="button" className="btn ghost" disabled={load.status !== 'done' || load.data.length < 20} onClick={() => setPage(page + 1)}>다음</button>
        <Link className="btn primary" to="/inquiries">문의 작성</Link>
      </div>
    </section>
  </div>;
}
