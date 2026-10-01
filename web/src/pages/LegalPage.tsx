import { num, str, type Raw } from '../api/pick';
import { usePolicies, type PolicyType } from '../api/policies';
import { utcToLocal } from '../transactions/ui';
import { AccountCard, AccountNote } from '../ui/account';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';

// 프로토타입 account.js의 terms()/privacy(). 요약 안내는 프로토타입 문구를 쓰고(체험용 문구는 실제 서비스에 맞게 고침),
// 정식 문서는 GET /api/policies의 원문(contentUrl)을 새 창으로 연다. 원문은 버전·해시로 관리되므로 화면에 옮겨 적지 않는다.
const docNames: Record<PolicyType, string> = { TERMS: '서비스 이용약관', PRIVACY: '개인정보 처리방침', CONTACT_SHARING: '연락처 제공 동의' };

function PolicyDocs({ types }: { types: PolicyType[] }) {
  const policies = usePolicies();
  const docs = (policies ?? []).filter((p: Raw) => types.includes((str(p.type) ?? str(p.documentType)) as PolicyType));
  return (
    <AccountCard title="정식 문서">
      {policies === null ? (
        <p className="prose">문서를 불러오는 중이에요.</p>
      ) : docs.length ? (
        <dl className="document-rows">
          {docs.map((p) => {
            const type = (str(p.type) ?? str(p.documentType)) as PolicyType;
            const url = str(p.contentUrl);
            return (
              <div key={String(num(p.id) ?? type)}>
                <dt>{docNames[type] ?? type}</dt>
                <dd>
                  {[str(p.version) && `버전 ${str(p.version)}`, str(p.effectiveAt) && `${utcToLocal(str(p.effectiveAt)!)} 시행`].filter(Boolean).join(' · ') || '현재 적용 중'}
                  {url && (
                    <>
                      {' '}
                      <a className="text-link" href={url} target="_blank" rel="noreferrer">
                        원문 보기 <Icon name="arrow" size={14} />
                      </a>
                    </>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="prose">등록된 정식 문서가 아직 없어요.</p>
      )}
    </AccountCard>
  );
}

export function TermsOfServicePage() {
  return (
    <div className="account-contained legal-document">
      <PageTitle title="서비스 이용 안내" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <PolicyDocs types={['TERMS']} />
      <AccountCard title="서비스 범위">
        <p className="prose">이용자가 도우미의 공개 프로필을 확인하고 직접 요청하는 매칭 서비스입니다. 플랫폼은 예매 성공이나 티켓을 보증하지 않습니다.</p>
      </AccountCard>
      <AccountCard title="진행과 비용">
        <p className="prose">이용자 요청 → 도우미 수락 및 최종 조건 전달 → 이용자 확인·확정 순서로 진행해요. 최종 조건이 안전거래면 이용자가 확정된 금액을 결제하고, 직접 거래면 플랫폼 결제 없이 당사자끼리 정산해요.</p>
        <p className="prose">도우미의 매칭권은 요청 수락 시 1장이 사용돼요. 이용자의 안전거래 결제와 별개입니다.</p>
      </AccountCard>
      <AccountCard title="허용되지 않는 이용">
        <p className="prose">예매 계정정보 수집, 매크로 사용, 재판매 목적 예매, 티켓 양도·알선은 허용하지 않습니다. 상대방의 계정 비밀번호를 요청하거나 입력하지 마세요.</p>
      </AccountCard>
      <AccountNote>이 화면은 요약 안내예요. 권리와 의무, 취소·환불 기준은 위의 정식 이용약관 원문을 확인해 주세요.</AccountNote>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="account-contained legal-document">
      <PageTitle title="개인정보 안내" crumbs={[{ label: '마이페이지', to: '/my' }]} />
      <PolicyDocs types={['PRIVACY', 'CONTACT_SHARING']} />
      <AccountCard title="공개되는 프로필">
        <p className="prose">이용자 닉네임과 이미지는 요청·후기 등에서 사용합니다. 도우미가 입력한 활동 닉네임·소개·예매처·공연 분야·활동 시간·안내 비용은 공개 프로필에 표시돼요.</p>
      </AccountCard>
      <AccountCard title="거래 상대방에게만 공개">
        <p className="prose">선택한 연락 방법과 연락처는 요청 수락 후 해당 거래의 상대방에게 공개합니다. 정산 계좌와 인증·경력 제출 자료는 공개 프로필에 표시하지 않아요.</p>
      </AccountCard>
      <AccountCard title="인증 정보">
        <p className="prose">본인인증과 정산 계좌 확인은 인증·결제 대행사를 통해 진행해요. 실명·생년월일과 계좌번호 원문은 화면에 다시 보여 주지 않고, 가려진 값만 표시합니다.</p>
      </AccountCard>
      <AccountNote>이 화면은 요약 안내예요. 수집 항목, 보관 기간, 처리 위탁과 권리 행사 방법은 위의 정식 개인정보 처리방침 원문을 확인해 주세요.</AccountNote>
    </div>
  );
}
