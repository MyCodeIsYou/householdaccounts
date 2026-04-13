import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { HouseholdProvider } from '@/context/HouseholdContext'
import { ThemeProvider } from '@/context/ThemeContext'
import AppRouter from '@/router/index'
import SplashScreen from '@/components/SplashScreen'

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
  return window.location.pathname === '/login'
}

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowInitialSplash)

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HouseholdProvider>
            {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
            <AppRouter />
          </HouseholdProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
