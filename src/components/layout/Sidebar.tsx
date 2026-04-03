import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  CalendarDays,
  FileText,
  BarChart3,
  Gift,
  Lock,
  CreditCard,
} from 'lucide-react'

const navItems = [
  { to: '/', label: '대시보드', icon: LayoutDashboard },
  { to: '/accounts', label: '계좌 관리', icon: Wallet },
  { to: '/asset-chart', label: '자산 변화', icon: TrendingUp },
  { to: '/annual-plan', label: '연간 계획표', icon: CalendarDays },
  { to: '/transactions', label: '수입/지출 입력', icon: FileText },
  { to: '/monthly-summary', label: '월별 합계', icon: BarChart3 },
  { to: '/allowance', label: '용돈 관리', icon: Gift },
  { to: '/fixed-costs', label: '고정비 관리', icon: Lock },
  { to: '/cards', label: '카드 내역', icon: CreditCard },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r bg-white flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b">
        <span className="font-bold text-lg text-primary">가계부</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
