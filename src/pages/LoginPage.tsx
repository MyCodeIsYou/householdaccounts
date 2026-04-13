import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Heart, Sparkles, Coffee, X } from 'lucide-react'
import TermsOfServiceContent from '@/components/legal/TermsOfServiceContent'
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent'

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  const [modalType, setModalType] = useState<'terms' | 'privacy' | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setResetMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    })
    setResetLoading(false)
    if (error) {
      setResetMessage(error.message)
    } else {
      setResetMessage('비밀번호 재설정 링크가 이메일로 발송되었습니다. 메일함을 확인해주세요.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (isSignUp && (!agreeTerms || !agreePrivacy || !agreeAge)) {
      setError('모든 필수 항목에 동의해주세요.')
      setLoading(false)
      return
    }

    if (isSignUp && password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      setLoading(false)
      return
    }

    const fn = isSignUp ? signUpWithEmail : signInWithEmail
    const { error } = await fn(email, password)

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      const pendingToken = sessionStorage.getItem('pendingJoinToken')
      if (pendingToken) {
        sessionStorage.removeItem('pendingJoinToken')
        navigate(`/join/${pendingToken}`, { replace: true })
      } else {
        navigate('/')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* 수채화 배경 장식 */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, #e8b887 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, #8aa88a 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #7ba8c9 0%, transparent 70%)' }} />

      {/* 반짝이 장식 */}
      <Sparkles className="absolute top-12 right-12 w-5 h-5 text-peach opacity-60 animate-pulse" />
      <Sparkles className="absolute bottom-20 left-16 w-4 h-4 text-sage opacity-50 animate-pulse" style={{ animationDelay: '1s' }} />
      <Heart className="absolute top-1/4 left-12 w-4 h-4 text-rose-400 opacity-40" fill="currentColor" />
      <Coffee className="absolute bottom-16 right-20 w-5 h-5 text-ocean opacity-40" />

      <div className="w-full max-w-sm relative z-10">
        {/* 헤더 */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-[2rem] gradient-primary flex items-center justify-center shadow-xl" style={{ boxShadow: '0 10px 30px -10px rgba(138, 168, 138, 0.5), 0 4px 12px rgba(123, 168, 201, 0.3)' }}>
              <span className="text-3xl">🏠</span>
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-peach animate-pulse" fill="currentColor" />
            <Heart className="absolute -bottom-1 -left-1 w-4 h-4 text-rose-400" fill="currentColor" />
          </div>
          <h1 className="text-4xl text-chocolate tracking-wide" style={{ fontFamily: "'Jua', sans-serif" }}>
            우리집 가계부
          </h1>
          <p className="text-sm text-gray-500 mt-2 italic">
            {isSignUp ? '함께 써가는 따뜻한 가계부' : '오늘도 소중한 하루를 기록해요'}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50" />
            <Heart className="w-2.5 h-2.5 text-peach" fill="currentColor" />
            <div className="w-8 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50" />
          </div>
        </div>

        {/* 폼 카드 */}
        <div className="bg-white rounded-3xl card-shadow-lg p-8 relative">
          {/* 카드 상단 장식 */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white border shadow-sm" style={{ borderColor: 'rgba(212, 184, 135, 0.4)' }}>
            <span className="text-xs font-medium text-chocolate">
              {isSignUp ? '✦ 새로운 시작' : '✦ 다시 만나요'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-chocolate flex items-center gap-1.5">
                <span>📧</span> 이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11 rounded-2xl focus:border-sage"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-chocolate flex items-center gap-1.5">
                <span>🔒</span> 비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-11 rounded-2xl focus:border-sage"
              />
            </div>
            {isSignUp && (
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">
                    <button type="button" onClick={() => setModalType('terms')} className="text-sage font-semibold underline">이용약관</button>에 동의합니다 (필수)
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={e => setAgreePrivacy(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">
                    <button type="button" onClick={() => setModalType('privacy')} className="text-sage font-semibold underline">개인정보처리방침</button>에 동의합니다 (필수)
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeAge}
                    onChange={e => setAgreeAge(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">
                    만 14세 이상입니다 (필수)
                  </span>
                </label>
              </div>
            )}
            {error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3">
                <p className="text-sm text-rose-600">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl gradient-primary text-white font-semibold border-0 hover:opacity-90 transition-all hover:scale-[1.01]"
              style={{ boxShadow: '0 6px 20px -6px rgba(138, 168, 138, 0.6)' }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  준비중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isSignUp ? '✨ 회원가입' : '🌿 로그인'}
                </span>
              )}
            </Button>
          </form>

          {!isSignUp && !showResetPassword && (
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => { setShowResetPassword(true); setResetEmail(email); setResetMessage(null) }}
                className="text-xs text-gray-400 hover:text-sage hover:underline"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}

          {showResetPassword && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/50 space-y-3">
              <p className="text-xs font-medium text-chocolate">비밀번호 재설정 링크를 보내드립니다.</p>
              <form onSubmit={handleResetPassword} className="space-y-3">
                <Input
                  type="email"
                  placeholder="가입한 이메일 주소"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                  className="h-10 rounded-2xl text-sm"
                />
                {resetMessage && (
                  <p className={`text-xs ${resetMessage.includes('발송') ? 'text-sage' : 'text-rose-500'}`}>
                    {resetMessage}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 h-9 rounded-2xl gradient-primary text-white text-sm border-0 hover:opacity-90"
                  >
                    {resetLoading ? '발송 중...' : '재설정 링크 발송'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowResetPassword(false); setResetMessage(null) }}
                    className="h-9 rounded-2xl text-sm"
                  >
                    취소
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            {isSignUp ? (
              <>이미 계정이 있으신가요?{' '}
                <button className="text-sage font-semibold hover:underline" onClick={() => { setIsSignUp(false); setShowResetPassword(false) }}>
                  로그인하기 →
                </button>
              </>
            ) : (
              <>처음 오셨나요?{' '}
                <button className="text-sage font-semibold hover:underline" onClick={() => { setIsSignUp(true); setShowResetPassword(false) }}>
                  회원가입하기 →
                </button>
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <p className="text-center text-xs text-gray-400 mt-6 italic">
          "작은 기록이 모여 큰 이야기가 됩니다"
        </p>
      </div>

      {/* 이용약관 / 개인정보처리방침 모달 */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalType(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 pb-0">
              <h2 className="text-base font-bold text-gray-900">
                {modalType === 'terms' ? '이용약관' : '개인정보처리방침'}
              </h2>
              <button
                onClick={() => setModalType(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}
            >
              {modalType === 'terms' ? <TermsOfServiceContent /> : <PrivacyPolicyContent />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
