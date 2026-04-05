import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Heart, Sparkles, Coffee } from 'lucide-react'

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

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
                minLength={6}
                className="h-11 rounded-2xl focus:border-sage"
              />
            </div>
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

          <div className="mt-6 flex items-center gap-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-200 opacity-50" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-200 opacity-50" />
          </div>

          <div className="mt-5 text-center text-sm text-gray-500">
            {isSignUp ? (
              <>이미 계정이 있으신가요?{' '}
                <button className="text-sage font-semibold hover:underline" onClick={() => setIsSignUp(false)}>
                  로그인하기 →
                </button>
              </>
            ) : (
              <>처음 오셨나요?{' '}
                <button className="text-sage font-semibold hover:underline" onClick={() => setIsSignUp(true)}>
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
    </div>
  )
}
