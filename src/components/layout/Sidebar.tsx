import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, CalendarDays,
  FileText, BarChart3, Gift, Lock, CreditCard,
  Users, ChevronDown, User, Check, Shield, Settings, MessageCircle,
  Calculator, DollarSign,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'
import { useMenuConfigs } from '@/hooks/useMenuConfigs'
import type { AppRole } from '@/types'

// 아이콘 이름 → Lucide 컴포넌트 매핑
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, CalendarDays,
  FileText, BarChart3, Gift, Lock, CreditCard,
  Users, Shield, Settings, MessageCircle,
}

// 기본 메뉴 (DB 로딩 전 fallback)
const FALLBACK_MENUS = [
  { menu_key: 'dashboard',       label: '대시보드',   path: '/',                icon_name: 'LayoutDashboard', min_role: 'user' as AppRole, is_enabled: true, display_order: 1 },
  { menu_key: 'accounts',        label: '계좌 관리',   path: '/accounts',        icon_name: 'Wallet',          min_role: 'user' as AppRole, is_enabled: true, display_order: 2 },
  { menu_key: 'liabilities',     label: '부채 관리',   path: '/liabilities',     icon_name: 'TrendingDown',    min_role: 'user' as AppRole, is_enabled: true, display_order: 3 },
  { menu_key: 'asset-chart',     label: '자산 변화',   path: '/asset-chart',     icon_name: 'TrendingUp',      min_role: 'user' as AppRole, is_enabled: true, display_order: 4 },
  { menu_key: 'annual-plan',     label: '연간 계획표', path: '/annual-plan',     icon_name: 'CalendarDays',    min_role: 'user' as AppRole, is_enabled: true, display_order: 4 },
  { menu_key: 'transactions',    label: '수입/지출',   path: '/transactions',    icon_name: 'FileText',        min_role: 'user' as AppRole, is_enabled: true, display_order: 5 },
  { menu_key: 'monthly-summary', label: '월별 합계',   path: '/monthly-summary', icon_name: 'BarChart3',       min_role: 'user' as AppRole, is_enabled: true, display_order: 6 },
  { menu_key: 'allowance',       label: '용돈 관리',   path: '/allowance',       icon_name: 'Gift',            min_role: 'user' as AppRole, is_enabled: true, display_order: 7 },
  { menu_key: 'fixed-costs',     label: '고정비 관리', path: '/fixed-costs',     icon_name: 'Lock',            min_role: 'user' as AppRole, is_enabled: true, display_order: 8 },
  { menu_key: 'cards',           label: '카드 내역',   path: '/cards',           icon_name: 'CreditCard',      min_role: 'user' as AppRole, is_enabled: true, display_order: 9 },
  { menu_key: 'households',      label: '그룹 관리',   path: '/households',      icon_name: 'Users',           min_role: 'user' as AppRole, is_enabled: true, display_order: 10 },
]

const ROLE_RANK: Record<AppRole, number> = { user: 0, admin: 1, super_admin: 2 }

function HouseholdSwitcher() {
  const { activeHouseholdId, households, setActiveHousehold, isViewingAsAdmin } = useHousehold()
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)

  const defaultId = profile?.default_household_id ?? null
  const activeHousehold = households.find(h => h.id === activeHouseholdId)
  const label = activeHousehold?.name ?? '내 가계부 (개인)'
  const isGroup = !!activeHouseholdId

  return (
    <div className="px-3 py-2 relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        <span className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
          isGroup ? 'gradient-primary' : 'bg-white/10'
        )}>
          {isGroup
            ? <Users className="h-3.5 w-3.5 text-white" />
            : <User className="h-3.5 w-3.5 text-white/60" />
          }
        </span>
        <span className="flex-1 text-xs font-medium text-white/80 truncate">{label}</span>
        {defaultId === activeHouseholdId && (
          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium shrink-0">기본</span>
        )}
        {isViewingAsAdmin && (
          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium shrink-0">관리자</span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-white/40 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-[#1c1f2a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <button
            onClick={() => { setActiveHousehold(null); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
          >
            <User className="h-3.5 w-3.5 text-white/40 shrink-0" />
            <span className="flex-1 text-xs text-white/70">내 가계부 (개인)</span>
            {defaultId === null && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium shrink-0">기본</span>
            )}
            {!activeHouseholdId && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
          </button>

          {households.length > 0 && (
            <>
              <div className="h-px bg-white/10 mx-2" />
              {households.map(hh => (
                <button
                  key={hh.id}
                  onClick={() => { setActiveHousehold(hh.id); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                >
                  <Users className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span className="flex-1 text-xs text-white/70 truncate">{hh.name}</span>
                  {defaultId === hh.id && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium shrink-0">기본</span>
                  )}
                  {activeHouseholdId === hh.id && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { appRole } = useAuth()
  const { configs, isLoading } = useMenuConfigs()

  const menuItems = isLoading ? FALLBACK_MENUS : configs

  const visibleMenus = menuItems.filter(m =>
    m.is_enabled && ROLE_RANK[appRole] >= ROLE_RANK[m.min_role as AppRole]
  )

  return (
    <aside className={`fixed md:relative inset-y-0 left-0 z-30 w-60 shrink-0 flex flex-col h-full bg-[#0f1117] transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* 로고 */}
      <div className="h-16 flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">가계부</span>
        </div>
      </div>

      {/* 구분선 */}
      <div className="mx-4 h-px bg-white/10 shrink-0" />

      {/* 가계부 전환 드롭다운 */}
      <HouseholdSwitcher />

      <div className="mx-4 h-px bg-white/10 shrink-0" />

      {/* 내비게이션 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 pb-2 pt-1">
          메뉴
        </p>
        {visibleMenus.map(menu => {
          const Icon = ICON_MAP[menu.icon_name] ?? Wallet
          const isEnd = menu.path === '/'
          return (
            <NavLink
              key={menu.menu_key}
              to={menu.path}
              end={isEnd}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150',
                    isActive
                      ? 'gradient-primary text-white shadow-lg shadow-indigo-500/30'
                      : 'text-white/40 group-hover:text-white/70'
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1">{menu.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  )}
                </>
              )}
            </NavLink>
          )
        })}

        {/* 편의정보 섹션 */}
        <div className="h-px bg-white/10 mx-1 my-2" />
        <p className="text-[10px] font-semibold text-cyan-400/50 uppercase tracking-widest px-3 pb-2">
          편의정보
        </p>
        {[
          { to: '/salary-calculator', label: '연봉 계산기', Icon: Calculator },
          { to: '/exchange-rate',     label: '환율 계산기', Icon: DollarSign },
        ].map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150',
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-white/40 group-hover:text-white/70'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1">{label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* 관리자 전용 섹션 */}
        {appRole === 'super_admin' && (
          <>
            <div className="h-px bg-white/10 mx-1 my-2" />
            <p className="text-[10px] font-semibold text-amber-400/50 uppercase tracking-widest px-3 pb-2">
              관리자
            </p>
            {[
              { to: '/admin/users', label: '사용자 관리', Icon: Shield },
              { to: '/admin/menus', label: '메뉴 관리',   Icon: Settings },
              { to: '/admin/banks', label: '은행/계좌 관리', Icon: Wallet },
              { to: '/admin/households', label: '그룹 관리', Icon: Users },
            ].map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-amber-500/10 text-amber-300'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150',
                      isActive
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-white/40 group-hover:text-white/70'
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* 하단 버전 */}
      <div className="px-5 py-4 shrink-0">
        <p className="text-[10px] text-white/20">가계부 v1.0</p>
      </div>
    </aside>
  )
}
