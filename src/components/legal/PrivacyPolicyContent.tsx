export default function PrivacyPolicyContent() {
  return (
    <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
      <p className="text-xs text-gray-400">시행일: 2026년 4월 7일</p>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">1. 개인정보의 수집 및 이용 목적</h2>
        <p>본 서비스("우리집 가계부")는 다음의 목적을 위해 개인정보를 수집 및 이용합니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>회원 가입 및 관리: 회원 식별, 본인 확인, 서비스 부정 이용 방지</li>
          <li>서비스 제공: 가계부 데이터 저장 및 조회, 그룹(가계부) 공유 기능</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">2. 수집하는 개인정보 항목</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>필수: 이메일 주소, 비밀번호(암호화 저장)</li>
          <li>선택: 표시 이름(닉네임)</li>
          <li>자동 수집: 서비스 이용 기록, 접속 일시</li>
        </ul>
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
        <h2 className="font-semibold text-gray-900">5. 개인정보의 처리 위탁</h2>
        <p>서비스 운영을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase Inc. — 데이터베이스 호스팅 및 인증 서비스</li>
          <li>GitHub Pages — 웹 애플리케이션 호스팅</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">6. 이용자의 권리</h2>
        <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>개인정보 열람, 정정, 삭제 요청</li>
          <li>회원 탈퇴(프로필 페이지에서 직접 처리 가능)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">7. 개인정보의 파기</h2>
        <p>회원 탈퇴 시 해당 이용자의 모든 데이터(프로필, 거래내역, 자산정보 등)는 즉시 삭제되며 복구할 수 없습니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">8. 개인정보 보호책임자</h2>
        <p>개인정보 관련 문의는 서비스 내 고객센터(문의하기)를 이용해 주시기 바랍니다.</p>
      </section>
    </div>
  )
}
