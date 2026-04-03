import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': '대시보드',
  '/accounts': '계좌 관리',
  '/asset-chart': '자산 변화 그래프',
  '/annual-plan': '연간 자금 계획표',
  '/transactions': '수입/지출 내역',
  '/monthly-summary': '월별 수입/지출 합계',
  '/allowance': '용돈 관리',
  '/fixed-costs': '고정비 관리',
  '/cards': '카드 내역',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const title = pageTitles[pathname] ?? '가계부'

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          <span className="sr-only">로그아웃</span>
        </Button>
      </div>
    </header>
  )
}
