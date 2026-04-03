import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'

const pageTitles: Record<string, { title: string; desc: string }> = {
  '/':                { title: '대시보드',       desc: '자산 현황 및 최근 거래 요약' },
  '/accounts':        { title: '계좌 관리',       desc: '은행 및 투자 계좌 잔액 관리' },
  '/asset-chart':     { title: '자산 변화 그래프', desc: '날짜별 총 자산 추이' },
  '/annual-plan':     { title: '연간 자금 계획표', desc: '월별 수입·지출 계획 vs 실적' },
  '/transactions':    { title: '수입/지출 내역',  desc: '거래 내역 입력 및 조회' },
  '/monthly-summary': { title: '월별 합계',       desc: '월별 수입·지출·잔액 집계' },
  '/allowance':       { title: '용돈 관리',        desc: '용돈 지출 현황' },
  '/fixed-costs':     { title: '고정비 관리',      desc: '정기 고정 지출 납부 관리' },
  '/cards':           { title: '카드 내역',        desc: '카드별 사용 내역' },
  '/households':      { title: '그룹 관리',         desc: '공유 가계부 그룹 및 멤버 관리' },
  '/profile':         { title: '내 프로필',         desc: '표시 이름 및 계정 정보 관리' },
  '/admin/users':     { title: '사용자 관리',        desc: '앱 사용자 및 권한 관리' },
  '/admin/menus':     { title: '메뉴 관리',          desc: '내비게이션 메뉴 표시 설정' },
}

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const page = pageTitles[pathname] ?? { title: '가계부', desc: '' }
  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? ''
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 card-shadow">
      <div>
        <h1 className="text-base font-semibold text-gray-900 leading-tight">{page.title}</h1>
        {page.desc && <p className="text-xs text-gray-400 mt-0.5">{page.desc}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 bg-gray-50 border rounded-full px-3 py-1.5 hover:bg-gray-100 transition-colors"
        >
          <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
            {profile?.display_name ? (
              <span className="text-[10px] font-bold text-white">{initials}</span>
            ) : (
              <User className="h-3 w-3 text-white" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">{displayName}</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full h-8 w-8 p-0"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
