import { useState } from 'react';
import { Icon } from './Icon';
import { isImageFile } from './imageFile';
import { Modal } from './Modal';
import './image-preview.css';

/** Stored photos are displayed directly; their signed URLs are never navigated to. */
export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <Modal title={alt} onClose={onClose} className="image-viewer" wide>
      {failedSrc === src ? (
        <p role="status">사진을 표시할 수 없어요. 조회 화면을 새로고침해서 다시 열어 주세요.</p>
      ) : (
        <img src={src} alt={alt} onError={() => setFailedSrc(src)} />
      )}
    </Modal>
  );
}

export function ImagePreview({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <>
      <button type="button" className={`image-preview ${className}`} aria-label={`${alt} 확대 보기`} onClick={() => setOpen(true)}>
        {failedSrc === src ? <span className="image-preview-error"><Icon name="file" size={24} /><span>사진 보기</span></span> : <img src={src} alt={alt} onError={() => setFailedSrc(src)} loading="lazy" />}
      </button>
      {open && <ImageViewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export function FileAttachment({ url, name, mimeType }: { url?: string; name: string; mimeType?: string }) {
  return (
    <span className="file-attachment">
      {url && isImageFile(mimeType, name) ? (
        <><ImagePreview src={url} alt={name} className="attachment-photo" /><span>{name}</span></>
      ) : url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">{name}</a>
      ) : (
        <span>{name} · 열람할 수 없음</span>
      )}
    </span>
  );
}
