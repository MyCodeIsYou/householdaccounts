import { useState, useEffect } from 'react'
import { Check, Home, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'
import { useQueryClient } from '@tanstack/react-query'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const { households } = useHousehold()
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [defaultHouseholdId, setDefaultHouseholdId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingDefault, setSavingDefault] = useState(false)
  const [savedDefault, setSavedDefault] = useState(false)

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
    setDefaultHouseholdId(profile?.default_household_id ?? null)
  }, [profile?.display_name, profile?.default_household_id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      setError('저장에 실패했습니다.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function saveDefaultHousehold(newId: string | null) {
    if (!user) return
    setSavingDefault(true)
    setDefaultHouseholdId(newId)
    const { error } = await supabase
      .from('profiles')
      .update({ default_household_id: newId })
      .eq('id', user.id)
    setSavingDefault(false)
    if (!error) {
      // 프로필 재조회 트리거
      qc.invalidateQueries({ queryKey: ['profile'] })
      setSavedDefault(true)
      setTimeout(() => setSavedDefault(false), 2000)
    }
  }

  const initials = (profile?.display_name ?? user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <div className="max-w-lg space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-xl font-bold text-white">{initials}</span>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {profile?.display_name ?? '(이름 없음)'}
            </p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              profile?.app_role === 'super_admin' ? 'bg-amber-50 text-amber-600' :
              profile?.app_role === 'admin' ? 'bg-indigo-50 text-indigo-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {profile?.app_role === 'super_admin' ? '최고관리자' :
               profile?.app_role === 'admin' ? '관리자' : '일반'}
            </span>
          </div>
        </div>
      </div>

      {/* 이름 설정 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">프로필 설정</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              표시 이름
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="홍길동"
              maxLength={30}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              그룹 멤버 목록에서 표시되는 이름입니다
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-md shadow-indigo-500/20 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> 저장됨</>
            ) : saving ? (
              '저장 중...'
            ) : (
              '저장'
            )}
          </button>
        </form>
      </div>

      {/* 기본 가계부 설정 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">기본 가계부</h3>
        <p className="text-xs text-gray-400 mb-4">로그인 시 자동으로 선택될 가계부입니다</p>
        <div className="space-y-2">
          {/* 개인 가계부 */}
          <button
            onClick={() => saveDefaultHousehold(null)}
            disabled={savingDefault}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
              defaultHouseholdId === null
                ? 'border-amber-300 bg-amber-50/60'
                : 'border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                defaultHouseholdId === null ? 'bg-amber-100' : 'bg-gray-100'
              }`}>
                <Home className={`w-4 h-4 ${defaultHouseholdId === null ? 'text-amber-600' : 'text-gray-400'}`} />
              </div>
              <span className="text-sm font-medium text-gray-800">개인 가계부</span>
            </div>
            {defaultHouseholdId === null && <Check className="w-4 h-4 text-amber-600" />}
          </button>

          {/* 그룹 가계부 목록 */}
          {households.map(hh => (
            <button
              key={hh.id}
              onClick={() => saveDefaultHousehold(hh.id)}
              disabled={savingDefault}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                defaultHouseholdId === hh.id
                  ? 'border-sage bg-emerald-50/40'
                  : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  defaultHouseholdId === hh.id ? 'bg-emerald-100' : 'bg-gray-100'
                }`}>
                  <Users className={`w-4 h-4 ${defaultHouseholdId === hh.id ? 'text-sage' : 'text-gray-400'}`} />
                </div>
                <span className="text-sm font-medium text-gray-800">{hh.name}</span>
              </div>
              {defaultHouseholdId === hh.id && <Check className="w-4 h-4 text-sage" />}
            </button>
          ))}
        </div>
        {savedDefault && (
          <p className="text-xs text-sage mt-3 flex items-center gap-1">
            <Check className="w-3 h-3" /> 기본 가계부가 변경되었습니다
          </p>
        )}
      </div>

      {/* 계정 정보 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">계정 정보</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">이메일</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">가입일</span>
            <span className="text-sm font-medium text-gray-900">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
