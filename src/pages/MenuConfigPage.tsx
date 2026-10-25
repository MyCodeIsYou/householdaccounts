import { useState, type DragEvent } from 'react'
import { Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, CalendarDays, CalendarClock,
  FileText, BarChart3, Gift, Lock, CreditCard, Tags,
  Users, Shield, Settings, Check, MessageCircle, LineChart, Map,
  Bot, Activity, Database, GripVertical,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useMenuConfigs } from '@/hooks/useMenuConfigs'
import { childMenus, menuPlacementUpdates, moveMenu, rootMenus, type DropZone } from '@/lib/menuTree'
import { unknownErrorMessage } from '@/lib/utils'
import type { AppRole, MenuConfig } from '@/types'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, CalendarDays, CalendarClock,
  FileText, BarChart3, Gift, Lock, CreditCard, Tags,
  Users, Shield, Settings, MessageCircle, LineChart, Map,
  Bot, Activity, Database,
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

function MenuRow({
  menu,
  zone,
  dragging,
  onUpdate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  menu: MenuConfig
  zone: DropZone | null
  dragging: boolean
  onUpdate: (patch: Partial<MenuConfig> & { menu_key: string }) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
}) {
  const Icon = ICON_MAP[menu.icon_name] ?? Settings

  return (
    <div
      draggable
      onDragStart={event => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', menu.menu_key)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all ${
        dragging ? 'opacity-40' : ''
      } ${
        zone === 'child'
          ? 'bg-indigo-50 border-indigo-300'
          : menu.is_enabled ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100'
      } ${!menu.is_enabled && zone !== 'child' ? 'opacity-60' : ''}`}
    >
      {zone === 'before' && <span className="absolute left-3 right-3 -top-1 h-0.5 bg-indigo-500 rounded-full" />}
      {zone === 'after' && <span className="absolute left-3 right-3 -bottom-1 h-0.5 bg-indigo-500 rounded-full" />}
      <GripVertical className="h-4 w-4 text-gray-300 shrink-0 cursor-grab" />
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        menu.is_enabled ? 'gradient-primary' : 'bg-gray-200'
      }`}>
        <Icon className={`h-4 w-4 ${menu.is_enabled ? 'text-white' : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{menu.label}</p>
        <p className="text-xs text-gray-400 font-mono">{menu.path}</p>
        {zone === 'child' && <p className="text-xs text-indigo-600 mt-0.5">이 메뉴의 하위로 들어갑니다</p>}
      </div>

      <div className="shrink-0">
        <select
          value={menu.min_role}
          draggable={false}
          onMouseDown={event => event.stopPropagation()}
          onChange={e => onUpdate({ menu_key: menu.menu_key, min_role: e.target.value as AppRole })}
          disabled={!menu.is_enabled}
          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed ${ROLE_COLORS[menu.min_role as AppRole]}`}
        >
          <option value="user">일반</option>
          <option value="admin">관리자</option>
          <option value="super_admin">최고관리자</option>
        </select>
      </div>

      <button
        type="button"
        draggable={false}
        onMouseDown={event => event.stopPropagation()}
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
  const { configs, isLoading, updateConfig, reorderMenus } = useMenuConfigs()
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ key: string; zone: DropZone } | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)

  if (appRole !== 'super_admin') return <Navigate to="/" replace />

  const enabledCount = configs.filter(menu => menu.is_enabled).length
  const roots = rootMenus(configs)

  function zoneFor(event: DragEvent<HTMLDivElement>, menu: MenuConfig): DropZone | null {
    if (!dragKey || dragKey === menu.menu_key) return null
    const drag = configs.find(item => item.menu_key === dragKey)
    if (!drag) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = rect.height === 0 ? 0.5 : (event.clientY - rect.top) / rect.height
    const canNest = !menu.parent_menu_key && childMenus(configs, drag.menu_key).length === 0
    if (canNest && ratio < 0.34) return 'child'
    return ratio < 0.62 ? 'before' : 'after'
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, menu: MenuConfig) {
    event.preventDefault()
    const zone = zoneFor(event, menu)
    setDrop(null)
    setDragKey(null)
    if (!dragKey || !zone) return
    const result = moveMenu(configs, dragKey, menu.menu_key, zone)
    if (result.error) {
      setDropError(result.error)
      return
    }
    setDropError(null)
    const updates = menuPlacementUpdates(configs, result.menus)
    if (updates.length > 0) reorderMenus.mutate(updates)
  }

  function renderMenu(menu: MenuConfig, nested = false) {
    const children = nested ? [] : childMenus(configs, menu.menu_key)
    return (
      <div key={menu.menu_key}>
        <MenuRow
          menu={menu}
          zone={drop?.key === menu.menu_key ? drop.zone : null}
          dragging={dragKey === menu.menu_key}
          onUpdate={patch => updateConfig.mutate(patch)}
          onDragStart={() => { setDragKey(menu.menu_key); setDropError(null) }}
          onDragEnd={() => { setDragKey(null); setDrop(null) }}
          onDragOver={event => {
            event.preventDefault()
            const zone = zoneFor(event, menu)
            setDrop(zone ? { key: menu.menu_key, zone } : null)
          }}
          onDrop={event => handleDrop(event, menu)}
        />
        {children.length > 0 && (
          <div className="ml-8 mt-1 space-y-1 border-l border-indigo-100 pl-3">
            {children.map(child => renderMenu(child, true))}
          </div>
        )}
      </div>
    )
  }

  const rawSaveError = reorderMenus.error
    ? unknownErrorMessage(reorderMenus.error, '메뉴 순서를 저장하지 못했습니다.')
    : null
  const saveError = rawSaveError && /parent_menu_key|schema cache/i.test(rawSaveError)
    ? '메뉴 부모 열이 없습니다. supabase/36_menu_parent.sql 을 적용해 주세요.'
    : rawSaveError

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl card-shadow p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">메뉴 관리</h2>
            <p className="text-sm text-gray-500 mt-0.5">순서를 드래그하고, 메뉴 위쪽에 놓으면 하위 메뉴가 됩니다</p>
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

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          메뉴 사이에 놓으면 그 위치로 들어갑니다. 메뉴 위쪽에 놓으면 그 메뉴의 하위 메뉴가 됩니다.
          하위 메뉴는 한 단계만 가능합니다. 비활성화된 메뉴는 모든 사용자에게 표시되지 않습니다.
        </p>
      </div>

      {(dropError || saveError) && (
        <p className="text-sm text-rose-500">{dropError ?? saveError}</p>
      )}

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
            {roots.map(menu => renderMenu(menu))}
          </div>
        )}
      </div>

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
