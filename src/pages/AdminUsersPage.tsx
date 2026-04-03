import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Shield, Users, X, Crown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import type { AdminUser, AdminUserMembership, AppRole } from '@/types'

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: '최고관리자',
  admin: '관리자',
  user: '일반',
}

const ROLE_BADGE: Record<AppRole, string> = {
  super_admin: 'bg-amber-50 text-amber-700 border border-amber-200',
  admin: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  user: 'bg-gray-100 text-gray-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── 사용자 그룹 목록 모달 ──────────────────────────────────────────────────────
function UserHouseholdsModal({
  user,
  onClose,
}: {
  user: AdminUser
  onClose: () => void
}) {
  const memberships: AdminUserMembership[] = user.household_memberships ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl card-shadow w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">그룹 멤버십</h3>
            <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
          {memberships.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">참여 중인 그룹이 없습니다</p>
          ) : (
            memberships.map(m => (
              <div key={m.household_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.household_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(m.joined_at)}</p>
                  </div>
                </div>
                {m.role === 'owner' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Crown className="w-3 h-3" /> 오너
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">멤버</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { appRole, user: currentUser } = useAuth()
  const { users, isLoading, updateRole } = useAdminUsers()
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  if (appRole !== 'super_admin') return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">사용자 관리</h2>
            <p className="text-sm text-gray-500 mt-0.5">앱 사용자 및 권한을 관리합니다</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-center">
          <p className="text-lg font-bold text-amber-700">{users.length}</p>
          <p className="text-xs text-amber-500">전체 사용자</p>
        </div>
      </div>

      {/* 사용자 테이블 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400">사용자가 없습니다</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">사용자</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">권한</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">가입일</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">그룹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.email}</p>
                      {u.display_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{u.display_name}</p>
                      )}
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] text-indigo-500 font-medium">(나)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.app_role}
                      onChange={e => updateRole.mutate({ userId: u.id, role: e.target.value as AppRole })}
                      disabled={updateRole.isPending || u.id === currentUser?.id}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed ${ROLE_BADGE[u.app_role]}`}
                    >
                      <option value="user">일반</option>
                      <option value="admin">관리자</option>
                      <option value="super_admin">최고관리자</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500">{formatDate(u.created_at)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {u.household_memberships?.length ?? 0}개
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 역할 안내 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">권한 레벨 안내</h3>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => (
            <div key={role} className="bg-gray-50 rounded-xl p-3">
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${ROLE_BADGE[role]}`}>
                {label}
              </span>
              <p className="text-xs text-gray-500">
                {role === 'super_admin' && '모든 기능 + 사용자/메뉴 관리, 전체 그룹 조회'}
                {role === 'admin' && '그룹 생성 및 관리, 멤버 초대/내보내기'}
                {role === 'user' && '개인 가계부 및 초대받은 그룹 이용'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 모달 */}
      {selectedUser && (
        <UserHouseholdsModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}
