import { ACCOUNT_STORAGE_CONSENT_VERSION } from './profile';

export function AccountStorageConsent({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled: boolean }) {
  return <div className="notice-block">
    <p className="prose">본인 명의 계좌 확인을 위해 팝빌(링크허브)에 은행·계좌번호·생년월일 6자리를 전송하고, 조회된 예금주명을 본인인증 이름과 대조해요.</p>
    <p className="prose">은행·전체 계좌번호·본인인증 성명·확인 시각은 계좌 확인, 사기 피해 대응 및 신고·분쟁 처리를 위해 보관해요. 전체 계좌번호와 성명은 암호화하며, 탈퇴 후에는 별도로 분리해 30일간 보관해요. 탈퇴 전 또는 탈퇴 후 30일 안에 접수된 신고가 처리 중이면 종료 시까지 보관하고, 보관 사유가 끝나면 삭제해요.</p>
    <p className="record-note">계좌를 변경하면 이전 계좌정보는 삭제하며, 생년월일은 회원 탈퇴 시 삭제해요. 권한 있는 담당자만 사유를 기록한 뒤 신고 대상 회원의 실명·계좌정보를 열람할 수 있어요.</p>
    <p className="record-note">동의를 거부할 수 있으며, 동의하지 않으면 신규 계좌 확인을 진행할 수 없어요. <a href={`/legal/${ACCOUNT_STORAGE_CONSENT_VERSION}/privacy.html`} target="_blank" rel="noopener noreferrer">수집·이용 내용 보기</a></p>
    <label className="check-row"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span>[필수] 본인 명의 계좌 확인 및 계좌정보 수집·이용에 동의합니다.</span></label>
  </div>;
}
