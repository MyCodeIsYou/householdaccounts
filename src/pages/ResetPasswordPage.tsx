import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Heart, Sparkles } from 'lucide-react'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, isPasswordRecovery, clearPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const sessionReady = !!session && isPasswordRecovery

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      clearPasswordRecovery()
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, #e8b887 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, #8aa88a 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-[2rem] gradient-primary flex items-center justify-center shadow-xl" style={{ boxShadow: '0 10px 30px -10px rgba(138, 168, 138, 0.5), 0 4px 12px rgba(123, 168, 201, 0.3)' }}>
              <span className="text-3xl">🔑</span>
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-peach animate-pulse" fill="currentColor" />
            <Heart className="absolute -bottom-1 -left-1 w-4 h-4 text-rose-400" fill="currentColor" />
          </div>
          <h1 className="text-2xl text-chocolate tracking-wide" style={{ fontFamily: "'Jua', sans-serif" }}>
            비밀번호 재설정
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            새로운 비밀번호를 입력해주세요
          </p>
        </div>

        <div className="bg-white rounded-3xl card-shadow-lg p-8 relative">
          {success ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-4xl">✅</div>
              <p className="text-sm font-medium text-sage">비밀번호가 변경되었습니다!</p>
              <p className="text-xs text-gray-400">잠시 후 로그인 페이지로 이동합니다...</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-6 h-6 border-2 border-sage border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500">인증 확인 중...</p>
              <p className="text-xs text-gray-400">잠시만 기다려주세요</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-chocolate flex items-center gap-1.5">
                  <span>🔒</span> 새 비밀번호
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
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-chocolate flex items-center gap-1.5">
                  <span>🔒</span> 비밀번호 확인
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
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
                className="w-full h-12 rounded-2xl gradient-primary text-white font-semibold border-0 hover:opacity-90 transition-all"
                style={{ boxShadow: '0 6px 20px -6px rgba(138, 168, 138, 0.6)' }}
                disabled={loading}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
