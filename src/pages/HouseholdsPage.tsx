import { useState } from 'react'
import { Users, Plus, Crown, UserMinus, Link, Copy, Trash2, X, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'
import { useHouseholds } from '@/hooks/useHouseholds'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useHouseholdInvites } from '@/hooks/useHouseholdInvites'
import type { Household } from '@/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ── 멤버 관리 모달 ────────────────────────────────────────────────────────────
function MembersModal({ household, onClose }: { household: Household; onClose: () => void }) {
  const { user } = useAuth()
  const { members, isLoading, removeMember } = useHouseholdMembers(household.id)
  const isOwner = household.owner_id === user?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl card-shadow w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">멤버 관리</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-4">불러오는 중...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">멤버가 없습니다</p>
          ) : (
            members.map(member => (
              <div key={member.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-indigo-600">
                      {(member.profile?.display_name ?? member.user_id).slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.profile?.display_name ?? '(이름 없음)'}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(member.joined_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === 'owner' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Crown className="w-3 h-3" /> 오너
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">멤버</span>
                  )}
                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => removeMember.mutate(member.id)}
                      disabled={removeMember.isPending}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="내보내기"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── 초대 링크 모달 ─────────────────────────────────────────────────────────────
function InvitesModal({ household, onClose }: { household: Household; onClose: () => void }) {
  const { invites, isLoading, create, deactivate, buildInviteUrl } = useHouseholdInvites(household.id)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function copyUrl(token: string, id: string) {
    navigator.clipboard.writeText(buildInviteUrl(token))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl card-shadow w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">초대 링크</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <button
            onClick={() => create.mutate({})}
            disabled={create.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-md shadow-indigo-500/20 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            새 초대 링크 생성
          </button>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">불러오는 중...</p>
            ) : invites.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">활성 초대 링크가 없습니다</p>
            ) : (
              invites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-gray-500">만료: {formatDate(invite.expires_at)}</p>
                    <p className="text-xs text-gray-400">{invite.used_count}/{invite.max_uses}회 사용</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyUrl(invite.token, invite.id)}
                      className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-indigo-600 transition-colors"
                      title="링크 복사"
                    >
                      {copiedId === invite.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deactivate.mutate(invite.id)}
                      disabled={deactivate.isPending}
                      className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-rose-600 transition-colors"
                      title="비활성화"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 그룹 생성 모달 ─────────────────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const { create } = useHouseholds()
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await create.mutateAsync(name.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl card-shadow w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">새 그룹 만들기</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">그룹 이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="우리집 가계부"
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-md shadow-indigo-500/20 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {create.isPending ? '생성 중...' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
export default function HouseholdsPage() {
  const { user } = useAuth()
  const { activeHouseholdId, setActiveHousehold } = useHousehold()
  const { households, isLoading, leave, deleteHousehold } = useHouseholds()

  const [showCreate, setShowCreate] = useState(false)
  const [membersFor, setMembersFor] = useState<Household | null>(null)
  const [invitesFor, setInvitesFor] = useState<Household | null>(null)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">그룹 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">공유 가계부 그룹을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-md shadow-indigo-500/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          새 그룹
        </button>
      </div>

      {/* 그룹 카드 목록 */}
      {isLoading ? (
        <div className="bg-white rounded-2xl card-shadow p-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : households.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-12 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-indigo-300" />
          </div>
          <p className="text-gray-500 font-medium">참여 중인 그룹이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">새 그룹을 만들거나 초대 링크로 참여하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {households.map(hh => {
            const isOwner = hh.owner_id === user?.id
            const isActive = activeHouseholdId === hh.id
            return (
              <div
                key={hh.id}
                className={`bg-white rounded-2xl p-6 transition-all ${
                  isActive ? 'ring-2 ring-indigo-500 card-shadow-lg' : 'card-shadow'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'gradient-primary' : 'bg-indigo-50'}`}>
                      <Users className={`w-5 h-5 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{hh.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isOwner ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Crown className="w-3 h-3" /> 오너
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">멤버</span>
                        )}
                        {isActive && (
                          <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">활성</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mb-4">생성: {formatDate(hh.created_at)}</p>

                {/* 액션 버튼 */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveHousehold(isActive ? null : hh.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        : 'gradient-primary text-white shadow-sm shadow-indigo-500/20 hover:opacity-90'
                    }`}
                  >
                    {isActive ? '개인 모드로 전환' : '이 그룹으로 전환'}
                  </button>

                  {isOwner && (
                    <>
                      <button
                        onClick={() => setMembersFor(hh)}
                        className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                        title="멤버 관리"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setInvitesFor(hh)}
                        className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-indigo-600 transition-colors"
                        title="초대 링크"
                      >
                        <Link className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`"${hh.name}" 그룹을 삭제하시겠습니까? 모든 그룹 데이터가 삭제됩니다.`)) {
                            deleteHousehold.mutate(hh.id)
                          }
                        }}
                        disabled={deleteHousehold.isPending}
                        className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        title="그룹 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {!isOwner && (
                    <button
                      onClick={() => {
                        if (confirm(`"${hh.name}" 그룹을 탈퇴하시겠습니까?`)) {
                          leave.mutate(hh.id)
                        }
                      }}
                      disabled={leave.isPending}
                      className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                      title="그룹 탈퇴"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 모달 */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {membersFor && <MembersModal household={membersFor} onClose={() => setMembersFor(null)} />}
      {invitesFor && <InvitesModal household={invitesFor} onClose={() => setInvitesFor(null)} />}
    </div>
  )
}
