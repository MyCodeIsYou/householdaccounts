import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">가계부</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSignUp ? '새 계정을 만들어 시작하세요' : '로그인하여 가계부를 관리하세요'}
          </p>
        </div>

        {/* 폼 카드 */}
        <div className="bg-white rounded-2xl card-shadow p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl border-gray-200 focus:border-indigo-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 rounded-xl border-gray-200 focus:border-indigo-400"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                <p className="text-sm text-rose-600">{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full h-11 rounded-xl gradient-primary text-white font-semibold shadow-md shadow-indigo-500/20 border-0 hover:opacity-90 transition-opacity" disabled={loading}>
              {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-gray-500">
            {isSignUp ? (
              <>이미 계정이 있으신가요?{' '}
                <button className="text-indigo-600 font-medium hover:underline" onClick={() => setIsSignUp(false)}>로그인</button>
              </>
            ) : (
              <>계정이 없으신가요?{' '}
                <button className="text-indigo-600 font-medium hover:underline" onClick={() => setIsSignUp(true)}>회원가입</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
