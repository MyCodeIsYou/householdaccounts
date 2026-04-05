import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { HouseholdProvider } from '@/context/HouseholdContext'
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

export default function App() {
  const [showSplash, setShowSplash] = useState(true)

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
