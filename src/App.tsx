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

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowInitialSplash)

  // Supabase 비밀번호 재설정 리다이렉트 감지
  // URL 해시에 type=recovery가 있으면 #/reset-password로 이동
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      // Supabase가 세션을 처리할 시간을 준 뒤 리다이렉트
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          window.location.hash = '#/reset-password'
        }
      })
      return () => subscription.unsubscribe()
    }
  }, [])

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
