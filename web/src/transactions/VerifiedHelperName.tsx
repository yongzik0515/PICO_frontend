export function VerifiedHelperName({ name }: { name?: string }) {
  if (!name) return null;
  return (
    <>
      <dl className="document-rows">
        <div><dt>본인인증 이름</dt><dd>{name}</dd></div>
      </dl>
      <p className="record-note">송금 전 예금주가 도우미의 본인인증 이름과 일치하는지 확인해 주세요. 동명이인이 있을 수 있어 이름 일치만으로 계좌 소유를 보장하지는 않아요.</p>
    </>
  );
}
