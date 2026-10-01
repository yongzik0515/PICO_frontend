import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, unwrap, ApiError } from '../api/client';
import { fetchDetail, mimeOf, roleIn, useLoad, usedReviews, type RequestResult } from '../transactions/model';
import { Notice, useAction } from '../transactions/ui';
import { useAppState } from '../AppState';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';
import { useToast } from '../ui/Toast';

// 프로토타입 discovery.js의 review()와 pc-interactions.js의 starField().
// 명세: POST /api/requests/{id}/review {rating 1~5, comment ≤400, imageKey?} — COMPLETED 거래의 이용자만, 한 번.
// 사진은 서버가 JPEG·PNG만 공개본으로 다시 만든다(WebP·HEIC는 업로드는 되지만 후기에 보이지 않음). 그래서 JPG·PNG만 받는다.
const REVIEW_IMAGE_TYPES = ['image/jpeg', 'image/png'];
function StarField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="field star-field">
      <legend>
        별점 <em>필수</em>
      </legend>
      <div className="star-picker">
        <div className="star-options" role="radiogroup" aria-label="거래 별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}점`} className={n <= value ? 'filled' : ''} onClick={() => onChange(n)}>
              <Icon name="star" size={28} />
            </button>
          ))}
        </div>
        <output>{value ? `${value}점` : '별점을 선택해 주세요'}</output>
      </div>
    </fieldset>
  );
}

export function ReviewPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { me } = useAuth();
  const [{ mode }] = useAppState();
  const [load] = useLoad(() => fetchDetail(requestId), [requestId]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [bookingResult, setBookingResult] = useState<RequestResult | ''>('');
  const [image, setImage] = useState<File | null>(null);
  const { pending, run } = useAction();

  if (load.status === 'loading')
    return (
      <div className="empty" role="status">
        <p>거래를 불러오는 중이에요.</p>
      </div>
    );
  if (load.status === 'error') return <Navigate to="/requests" replace />;

  const { request: r, stage, review } = load.data;
  const used = !!review || r.reviewWritten || usedReviews.has(requestId);
  if ((stage !== 'completed' && stage !== 'matching_completed') || roleIn(r, me, mode) !== 'user' || used)
    return (
      <>
        <PageTitle title="후기를 작성할 수 없어요" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
        <div className="empty">
          <p>{used ? '이미 후기를 남긴 거래예요. 거래당 후기는 한 번만 쓸 수 있어요(삭제한 뒤에도 다시 쓸 수 없어요).' : '안전거래 완료 또는 직접 거래 매칭 완료 후 이용자가 한 번 작성할 수 있어요.'}</p>
          <button type="button" className="btn secondary" onClick={() => navigate(`/requests/${requestId}`)}>
            요청 상세로
          </button>
        </div>
      </>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return toast('별점을 선택해 주세요.');
    const ok = await run(async () => {
      let imageKey: string | undefined;
      if (image) {
        // 인증 사진 1장: POST /api/files/upload-url(REVIEW_IMAGE) → 업로드 → imageKey로 전달
        const target = await unwrap(api.POST('/api/files/upload-url', { body: { purpose: 'REVIEW_IMAGE', originalName: image.name, mimeType: mimeOf(image), sizeBytes: image.size } }));
        const res = await fetch(target.uploadUrl!, { method: target.method || 'PUT', headers: target.requiredHeaders, body: image });
        if (!res.ok) throw new Error('사진을 올리지 못했어요.');
        imageKey = target.storageKey;
      }
      try {
        await unwrap(api.POST('/api/requests/{requestId}/review', { params: { path: { requestId } }, body: { rating, comment: comment.trim() || null, imageKey: imageKey ?? null, bookingResult: bookingResult || undefined } }));
      } catch (err) {
        // 완료된 거래에서만 이 화면이 열리므로, 서버 409는 이미 후기를 쓴 경우다(삭제·숨김 포함, 재작성 불가).
        if (err instanceof ApiError && err.status === 409) {
          usedReviews.add(requestId);
          throw new Error('이 거래의 후기는 이미 작성했어요(삭제·숨김 포함). 거래당 후기는 한 번만 쓸 수 있어요.');
        }
        throw err;
      }
    }, '후기를 등록했어요. 고마워요!');
    if (ok || usedReviews.has(requestId)) navigate(`/requests/${requestId}`, { replace: true });
  }

  return (
    <>
      <PageTitle title="후기 작성" crumbs={[{ label: '요청 상세', to: `/requests/${requestId}` }]} />
      <div className="account-contained">
        <section className="content-card">
          <h2>{r.targetName}</h2>
          <p className="prose">{r.agentName} 도우미와 함께한 경험을 다른 이용자에게 알려 주세요.</p>
          <form id="review-form" noValidate onSubmit={submit}>
            <StarField value={rating} onChange={setRating} />
            <label className="field">
              <span>예매 결과 <small>선택</small></span>
              <select value={bookingResult} onChange={(e) => setBookingResult(e.target.value as RequestResult | '')}>
                <option value="">선택하지 않음</option>
                <option value="SUCCESS">성공</option>
                <option value="PARTIAL">부분 성공</option>
                <option value="FAILURE">실패</option>
              </select>
              <small className="field-helper">이용자가 후기에 남기는 정보예요. 결제·정산의 확정 결과에는 영향을 주지 않아요.</small>
            </label>
            <label className="field">
              <span>
                후기 <small>선택</small>
              </span>
              <textarea rows={5} maxLength={400} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="진행 과정과 결과가 어땠는지 알려 주세요." />
              <small className="counter">{comment.length}/400</small>
            </label>
            <div className="field">
              <span>
                인증 사진 <small>선택 · 1장</small>
              </span>
              <div className="account-inline">
                <label className="btn secondary account-file-label">
                  {image ? '사진 변경' : '사진 선택'}
                  <input
                    type="file"
                    accept={REVIEW_IMAGE_TYPES.join(',')}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      if (!f) return;
                      // 브라우저가 형식을 비워 두는 파일도 확장자로 판정한다(빈 형식을 그대로 보내면 서버가 400).
                      if (!REVIEW_IMAGE_TYPES.includes(mimeOf(f))) return toast('후기 사진은 JPG·PNG만 올릴 수 있어요.');
                      if (f.size > 20 * 1024 * 1024) return toast('사진은 20MB까지 올릴 수 있어요.');
                      setImage(f);
                    }}
                  />
                </label>
                {image && (
                  <>
                    <span className="field-helper">{image.name}</span>
                    <button type="button" className="btn ghost" onClick={() => setImage(null)}>
                      삭제
                    </button>
                  </>
                )}
              </div>
              <small className="field-helper">JPG·PNG, 20MB까지. 예매 내역이나 좌석 사진을 올릴 수 있어요. 개인정보는 가려 주세요.</small>
            </div>
            <Notice>{stage === 'matching_completed' ? '직접 거래는 플랫폼 매칭 내역을 바탕으로 후기를 남겨요. 예매 결과는 이용자가 기록한 정보예요.' : '완료한 안전거래에 대한 경험을 남겨 주세요.'}</Notice>
            <div className="account-form-footer">
              <button type="submit" className="btn primary" disabled={pending || !rating}>
                {pending ? '등록 중…' : '후기 등록하기'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
