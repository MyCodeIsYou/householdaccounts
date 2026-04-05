import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Users, Crown, ChevronRight, ChevronLeft, UserMinus, Calendar } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAdminHouseholds, useAdminHouseholdMembers } from '@/hooks/useAdminHouseholds'
import type { Household } from '@/types'

function maskName(name: string | null | undefined): string {
  if (!name) return '(이름 없음)'
  const chars = [...name]
  if (chars.length <= 1) return name
  if (chars.length === 2) return chars[0] + '*'
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── 그룹 상세 (멤버 목록) ───────────────────────────────────────
function HouseholdDetail({
  household,
  onBack,
}: {
  household: Household & { owner?: { id: string; display_name: string | null } }
  onBack: () => void
}) {
  const { members, isLoading, removeMember } = useAdminHouseholdMembers(household.id)

  async function handleRemove(memberUserId: string) {
    if (!confirm('이 멤버를 그룹에서 제거하시겠습니까?')) return
    await removeMember.mutateAsync({ household_id: household.id, user_id: memberUserId })
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> 목록으로
      </button>

      {/* 그룹 정보 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{household.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3" /> {maskName(household.owner?.display_name)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatDate(household.created_at)}
              </span>
              <span>멤버 {members.length}명</span>
            </div>
          </div>
        </div>
      </div>

      {/* 멤버 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">멤버 목록</h3>
        </div>
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">멤버가 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-indigo-600">
                      {(m.profile?.display_name ?? 'U').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{maskName(m.profile?.display_name)}</p>
                    <p className="text-xs text-gray-400">{formatDate(m.joined_at)} 가입</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.role === 'owner' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                      <Crown className="w-3 h-3" /> 오너
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">멤버</span>
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        disabled={removeMember.isPending}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                        title="그룹에서 제거"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────
export default function AdminHouseholdsPage() {
  const { appRole } = useAuth()
  const { households, isLoading } = useAdminHouseholds()
  const [selected, setSelected] = useState<
    (Household & { owner?: { id: string; display_name: string | null } }) | null
  >(null)

  if (appRole !== 'super_admin') return <Navigate to="/" replace />

  if (selected) {
    return <HouseholdDetail household={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">그룹 관리 (관리자)</h2>
            <p className="text-sm text-gray-500 mt-0.5">모든 그룹을 조회하고 멤버를 관리합니다</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-center">
          <p className="text-lg font-bold text-amber-700">{households.length}</p>
          <p className="text-xs text-amber-500">전체 그룹</p>
        </div>
      </div>

      {/* 그룹 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : households.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm text-gray-400">등록된 그룹이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {households.map(hh => (
              <button
                key={hh.id}
                onClick={() => setSelected(hh)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{hh.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Crown className="w-3 h-3" /> {maskName(hh.owner?.display_name)}
                      </span>
                      <span>·</span>
                      <span>{formatDate(hh.created_at)}</span>
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
