import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const { setActiveHousehold } = useHousehold()
  const navigate = useNavigate()

  const [status, setStatus] = useState<'loading' | 'preview' | 'joining' | 'error'>('loading')
  const [householdName, setHouseholdName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Preview invite (works unauthenticated)
  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('유효하지 않은 초대 링크입니다.')
      return
    }
    supabase.rpc('peek_invite_token', { p_token: token }).then(({ data, error }) => {
      if (error || data?.error) {
        setStatus('error')
        setErrorMsg('초대 링크가 만료되었거나 유효하지 않습니다.')
        return
      }
      setHouseholdName(data.household_name)
      setStatus('preview')

      // If not logged in, store pending token and redirect to login
      if (!user) {
        sessionStorage.setItem('pendingJoinToken', token)
        navigate('/login', { replace: true })
      }
    })
  }, [token, user, navigate])

  // If already logged in, auto-join
  useEffect(() => {
    if (status !== 'preview' || !user || !token) return
    handleJoin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user])

  async function handleJoin() {
    if (!token) return
    setStatus('joining')
    const { data, error } = await supabase.rpc('join_household_by_token', { p_token: token })
    if (error || data?.error) {
      setStatus('error')
      setErrorMsg('그룹 가입에 실패했습니다. 초대 링크가 만료되었을 수 있습니다.')
      return
    }
    setActiveHousehold(data.household_id)
    // Reload to refresh HouseholdContext
    window.location.replace(window.location.origin + window.location.pathname + '#/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">그룹 초대</h1>
        </div>

        <div className="bg-white rounded-2xl card-shadow p-8 text-center">
          {(status === 'loading' || status === 'joining') && (
            <div className="space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm">
                {status === 'joining' ? '그룹에 참여하는 중...' : '초대 정보를 확인하는 중...'}
              </p>
            </div>
          )}
          {status === 'preview' && (
            <div className="space-y-4">
              <p className="text-gray-500 text-sm">다음 그룹에 초대되었습니다</p>
              <p className="text-xl font-bold text-gray-900">{householdName}</p>
              <p className="text-gray-400 text-xs">잠시 후 자동으로 참여됩니다...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">{errorMsg}</p>
              <button
                onClick={() => navigate('/')}
                className="text-indigo-600 text-sm font-medium hover:underline"
              >
                홈으로 돌아가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
