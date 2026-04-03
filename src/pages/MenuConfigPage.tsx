import { Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, TrendingUp, CalendarDays,
  FileText, BarChart3, Gift, Lock, CreditCard,
  Users, Shield, Settings, Check,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useMenuConfigs } from '@/hooks/useMenuConfigs'
import type { AppRole, MenuConfig } from '@/types'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wallet, TrendingUp, CalendarDays,
  FileText, BarChart3, Gift, Lock, CreditCard,
  Users, Shield, Settings,
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: '최고관리자',
  admin: '관리자',
  user: '일반',
}

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'text-amber-600 bg-amber-50',
  admin: 'text-indigo-600 bg-indigo-50',
  user: 'text-gray-600 bg-gray-100',
}

function MenuRow({ menu, onUpdate }: { menu: MenuConfig; onUpdate: (patch: Partial<MenuConfig> & { menu_key: string }) => void }) {
  const Icon = ICON_MAP[menu.icon_name] ?? Settings

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      menu.is_enabled ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'
    }`}>
      {/* 아이콘 + 정보 */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        menu.is_enabled ? 'gradient-primary' : 'bg-gray-200'
      }`}>
        <Icon className={`h-4 w-4 ${menu.is_enabled ? 'text-white' : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{menu.label}</p>
        <p className="text-xs text-gray-400 font-mono">{menu.path}</p>
      </div>

      {/* 최소 권한 */}
      <div className="shrink-0">
        <select
          value={menu.min_role}
          onChange={e => onUpdate({ menu_key: menu.menu_key, min_role: e.target.value as AppRole })}
          disabled={!menu.is_enabled}
          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed ${ROLE_COLORS[menu.min_role as AppRole]}`}
        >
          <option value="user">일반</option>
          <option value="admin">관리자</option>
          <option value="super_admin">최고관리자</option>
        </select>
      </div>

      {/* 활성화 토글 */}
      <button
        onClick={() => onUpdate({ menu_key: menu.menu_key, is_enabled: !menu.is_enabled })}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
          menu.is_enabled ? 'bg-indigo-500' : 'bg-gray-200'
        }`}
        title={menu.is_enabled ? '비활성화' : '활성화'}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 flex items-center justify-center ${
          menu.is_enabled ? 'translate-x-5' : 'translate-x-0'
        }`}>
          {menu.is_enabled && <Check className="w-3 h-3 text-indigo-500" />}
        </span>
      </button>
    </div>
  )
}

export default function MenuConfigPage() {
  const { appRole } = useAuth()
  const { configs, isLoading, updateConfig } = useMenuConfigs()

  if (appRole !== 'super_admin') return <Navigate to="/" replace />

  const enabledCount = configs.filter(m => m.is_enabled).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">메뉴 관리</h2>
            <p className="text-sm text-gray-500 mt-0.5">메뉴 표시 여부 및 접근 권한을 설정합니다</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-emerald-700">{enabledCount}</p>
            <p className="text-xs text-emerald-500">활성 메뉴</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-gray-700">{configs.length}</p>
            <p className="text-xs text-gray-400">전체 메뉴</p>
          </div>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          권한 레벨을 높이면 해당 권한 미만의 사용자에게 메뉴가 숨겨집니다.
          비활성화된 메뉴는 모든 사용자에게 표시되지 않습니다.
        </p>
      </div>

      {/* 메뉴 목록 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">메뉴 항목</h3>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>최소 권한</span>
            <span>활성화</span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {configs.map(menu => (
              <MenuRow
                key={menu.menu_key}
                menu={menu}
                onUpdate={patch => updateConfig.mutate(patch)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 권한 레벨 설명 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">권한 레벨 설명</h3>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => (
            <div key={role} className={`rounded-xl p-3 ${ROLE_COLORS[role].split(' ')[1]}`}>
              <p className={`text-xs font-semibold mb-1 ${ROLE_COLORS[role].split(' ')[0]}`}>{label}</p>
              <p className="text-xs text-gray-500">
                {role === 'user' && '회원가입한 모든 사용자'}
                {role === 'admin' && '그룹 오너 권한 이상'}
                {role === 'super_admin' && '최고관리자만 접근'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
