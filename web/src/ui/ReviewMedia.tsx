import { Icon } from './Icon';
import { ImagePreview } from './ImagePreview';
import { resultNames, type RequestResult } from '../transactions/model';
import './review-media.css';

export function ReviewResultBadge({ result }: { result?: RequestResult | null }) {
  if (!result) return null;
  return (
    <span className={`badge review-result review-result-${result.toLowerCase()}`} aria-label={`이용자 후기 결과: ${resultNames[result]}`}>
      <Icon name={result === 'FAILURE' ? 'close' : result === 'PARTIAL' ? 'info' : 'check'} size={14} />
      {resultNames[result]}
    </span>
  );
}

// 기존 서버의 단일 사진 응답도 표시한다. 새 응답의 빈 배열은 그대로 존중한다.
function reviewImageUrls(review: { imageUrls?: unknown; imageUrl?: unknown }): string[] {
  if (Array.isArray(review.imageUrls)) return review.imageUrls.filter((url): url is string => typeof url === 'string' && !!url);
  return typeof review.imageUrl === 'string' && review.imageUrl ? [review.imageUrl] : [];
}

export function ReviewPhotos({ review }: { review: { imageUrls?: unknown; imageUrl?: unknown } }) {
  const urls = reviewImageUrls(review);
  if (!urls.length) return null;
  return <div className="review-photos">{urls.map((url, index) => (
    <ImagePreview key={url} src={url} alt={`후기 인증 사진 ${index + 1}`} className="review-photo" />
  ))}</div>;
}
