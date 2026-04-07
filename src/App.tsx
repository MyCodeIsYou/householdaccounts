import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { HouseholdProvider } from '@/context/HouseholdContext'
import AppRouter from '@/router/index'
import SplashScreen from '@/components/SplashScreen'
import { supabase } from '@/lib/supabase'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

// 초기 진입 시 스플래시 표시 여부 결정
// - 모바일: 항상 표시
// - PC: 로그인 페이지(/login)인 경우에만 표시
function shouldShowInitialSplash(): boolean {
  if (typeof window === 'undefined') return false
  const isMobile = window.matchMedia('(max-width: 767px)').matches
  if (isMobile) return true
  // HashRouter 기준 경로 체크
  const hashPath = window.location.hash.replace(/^#/, '') || '/'
  return hashPath.startsWith('/login')
}

// Supabase recovery URL 감지 (#access_token=...&type=recovery)
function isRecoveryUrl(): boolean {
  return window.location.hash.includes('type=recovery')
}

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowInitialSplash)
  const [recoveryPending, setRecoveryPending] = useState(isRecoveryUrl)

  // Supabase 비밀번호 재설정 리다이렉트 감지
  // Supabase가 #access_token=xxx&type=recovery 해시로 리다이렉트함
  // → Supabase JS가 토큰을 파싱하고 세션을 만든 뒤 PASSWORD_RECOVERY 이벤트 발생
  // → 그때 해시를 #/reset-password로 변경
  useEffect(() => {
    if (!recoveryPending) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Supabase가 토큰을 이미 처리하고 세션을 만든 상태
        // 이제 안전하게 해시만 변경 (페이지 리로드 없이)
        setRecoveryPending(false)
        window.location.hash = '#/reset-password'
      }
    })

    // 10초 타임아웃 — 이벤트가 안 오면 로그인으로
    const timer = setTimeout(() => {
      setRecoveryPending(false)
      window.location.hash = '#/login'
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [recoveryPending])

  // recovery 처리 중에는 라우터를 렌더하지 않음 (catch-all이 /login으로 보내는 것 방지)
  if (recoveryPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HouseholdProvider>
          {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
          <AppRouter />
        </HouseholdProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
