export default function PrivacyPolicyContent() {
  return (
    <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
      <p className="text-xs text-gray-400">시행일: 2026년 4월 9일</p>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">1. 개인정보의 수집 및 이용 목적</h2>
        <p>본 서비스("우리집 가계부")는 다음의 목적을 위해 개인정보를 수집 및 이용합니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>회원 가입 및 관리: 회원 식별, 본인 확인, 서비스 부정 이용 방지</li>
          <li>서비스 제공: 가계부 데이터 저장 및 조회, 그룹(가계부) 공유 기능</li>
          <li>고객 문의 응대 및 분쟁 해결</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">2. 수집하는 개인정보 항목</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>필수: 이메일 주소, 비밀번호(단방향 해시 암호화 저장)</li>
          <li>선택: 표시 이름(닉네임), 가계부에 직접 입력하는 재무 정보(수입·지출·자산·카드 내역 등)</li>
          <li>자동 수집: 서비스 이용 기록, 접속 IP 주소, 접속 일시, 기기 정보(OS·기기 모델), 쿠키 및 세션 토큰</li>
        </ul>
        <p className="text-xs text-gray-500">
          ※ 본 서비스는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 만 14세 미만으로 확인될 경우
          해당 회원의 정보는 즉시 삭제됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">3. 개인정보의 보유 및 이용 기간</h2>
        <p>회원 탈퇴 시 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약 또는 청약철회 등에 관한 기록 5년</li>
          <li>통신비밀보호법: 접속 로그 기록 3개월</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">4. 개인정보의 제3자 제공</h2>
        <p>본 서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의해 요구되는 경우는 예외로 합니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">5. 개인정보의 처리 위탁 및 국외 이전</h2>
        <p>서비스 운영을 위해 다음과 같이 개인정보 처리를 위탁하고 있으며, 일부는 국외로 이전됩니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Supabase Inc.</strong> (미국) — 데이터베이스 호스팅 및 인증 서비스
            <ul className="list-disc pl-5 mt-1 text-xs text-gray-500">
              <li>이전 항목: 이메일, 암호화된 비밀번호, 회원이 입력한 가계부 데이터</li>
              <li>이전 일시 및 방법: 서비스 이용 시점에 HTTPS(TLS 1.2 이상)로 실시간 전송</li>
              <li>이전받는 자: Supabase Inc. (privacy@supabase.io)</li>
              <li>보유 기간: 회원 탈퇴 시까지</li>
            </ul>
          </li>
          <li>
            <strong>GitHub Pages (GitHub Inc., 미국)</strong> — 웹 애플리케이션 정적 호스팅
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">6. 개인정보의 안전성 확보 조치</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>전송 구간 암호화: 모든 통신은 HTTPS(TLS 1.2 이상)로 암호화됩니다.</li>
          <li>저장 시 암호화: 비밀번호는 단방향 해시 알고리즘(bcrypt)으로 저장됩니다.</li>
          <li>접근 통제: Row Level Security(RLS)로 본인 또는 같은 그룹 구성원만 데이터에 접근할 수 있습니다.</li>
          <li>접근 권한 관리: 운영자 권한은 최소 인원에게만 부여됩니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">7. 이용자의 권리와 행사 방법</h2>
        <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>개인정보 열람·정정: 프로필 페이지에서 직접 수정 가능</li>
          <li>개인정보 삭제 및 회원 탈퇴: 프로필 페이지 &gt; "회원 탈퇴" 메뉴에서 직접 처리 가능 (즉시 영구 삭제)</li>
          <li>처리 정지 요청: 아래 개인정보 보호책임자 연락처로 요청</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">8. 개인정보의 파기</h2>
        <p>회원 탈퇴 시 해당 이용자의 모든 데이터(프로필, 거래내역, 자산정보, 카드 내역 등)는 즉시 삭제되며 복구할 수 없습니다. 전자적 파일 형태의 정보는 복구·재생할 수 없는 기술적 방법을 사용하여 영구 삭제됩니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">9. 쿠키 및 자동 수집 도구</h2>
        <p>본 서비스는 로그인 세션 유지를 위해 브라우저 로컬 스토리지에 인증 토큰을 저장합니다. 이용자는 브라우저 설정에서 저장을 거부할 수 있으나, 거부 시 로그인이 유지되지 않을 수 있습니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">10. 개인정보 보호책임자</h2>
        <p>개인정보 처리에 관한 문의·민원·피해 구제 등은 아래 책임자에게 연락 주시기 바랍니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>성명: (운영자 이름 기입)</li>
          <li>이메일: (운영자 이메일 기입)</li>
          <li>※ 정식 출시 전, 위 항목을 실제 정보로 반드시 교체하세요.</li>
        </ul>
        <p className="text-xs text-gray-500">
          기타 개인정보 침해에 대한 신고나 상담은 아래 기관에 문의하실 수 있습니다.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
          <li>개인정보침해신고센터 (privacy.kisa.or.kr / 국번없이 118)</li>
          <li>개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
          <li>대검찰청 사이버수사과 (spo.go.kr / 1301)</li>
          <li>경찰청 사이버수사국 (ecrm.police.go.kr / 182)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">11. 개인정보처리방침의 변경</h2>
        <p>본 방침이 변경되는 경우 변경 사항을 시행 7일 전 서비스 화면에 공지합니다. 다만 이용자의 권리 또는 의무에 중요한 변경이 있는 경우에는 30일 전에 공지합니다.</p>
      </section>
    </div>
  )
}
