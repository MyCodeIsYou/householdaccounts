export default function TermsOfServiceContent() {
  return (
    <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
      <p className="text-xs text-gray-400">시행일: 2026년 4월 7일</p>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제1조 (목적)</h2>
        <p>이 약관은 "우리집 가계부" 서비스(이하 "서비스")의 이용에 관한 조건 및 절차, 이용자와 운영자의 권리·의무를 규정함을 목적으로 합니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제2조 (용어의 정의)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>"이용자"란 본 약관에 따라 서비스를 이용하는 자를 말합니다.</li>
          <li>"회원"이란 서비스에 가입하여 이메일과 비밀번호로 인증된 이용자를 말합니다.</li>
          <li>"가계부"란 회원이 생성하여 수입·지출 등의 재무 정보를 기록하는 단위를 말합니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제3조 (약관의 효력 및 변경)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
          <li>운영자는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 7일 전 공지합니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제4조 (회원 가입 및 탈퇴)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>이용자는 이메일 주소와 비밀번호를 입력하고 이용약관 및 개인정보처리방침에 동의하여 회원가입을 합니다.</li>
          <li>회원은 언제든지 프로필 페이지에서 탈퇴할 수 있으며, 탈퇴 시 모든 데이터는 즉시 삭제됩니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제5조 (서비스의 제공)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>가계부 생성 및 관리 (수입·지출 기록, 자산 관리)</li>
          <li>그룹 가계부 공유 기능</li>
          <li>월별·연간 재무 요약 및 분석</li>
          <li>기타 부가 기능</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제6조 (이용자의 의무)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>이용자는 타인의 개인정보를 무단으로 수집·이용하여서는 안 됩니다.</li>
          <li>이용자는 서비스를 이용하여 법령 또는 공서양속에 반하는 행위를 하여서는 안 됩니다.</li>
          <li>이용자는 자신의 계정 정보를 안전하게 관리할 책임이 있습니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제7조 (서비스의 중단)</h2>
        <p>운영자는 시스템 점검, 교체, 고장, 통신 장애 등의 사유가 있는 경우 서비스 제공을 일시적으로 중단할 수 있습니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제8조 (면책사항)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>본 서비스는 무료로 제공되며, 서비스 이용으로 인해 발생한 손해에 대해 운영자는 책임을 지지 않습니다.</li>
          <li>이용자가 입력한 데이터의 정확성과 신뢰성에 대한 책임은 이용자에게 있습니다.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">제9조 (분쟁 해결)</h2>
        <p>서비스 이용과 관련하여 발생한 분쟁은 대한민국 법률을 적용하며, 관할 법원은 운영자의 소재지를 관할하는 법원으로 합니다.</p>
      </section>
    </div>
  )
}
