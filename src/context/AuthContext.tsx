import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, AppRole } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  appRole: AppRole
  loading: boolean
  isPasswordRecovery: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // URL에 recovery 토큰이 있는지 확인 (Supabase가 #access_token=...&type=recovery 형태로 리다이렉트)
  const isRecoveryUrl = window.location.hash.includes('type=recovery')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (!session) setProfile(null)
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        setLoading(false)
      }
    })

    // recovery URL이 아닌 경우에만 getSession으로 loading 해제
    // recovery URL인 경우 onAuthStateChange 이벤트를 기다림
    if (!isRecoveryUrl) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setLoading(false)
      })
    } else {
      // recovery URL인 경우 15초 타임아웃 (안전장치)
      const timer = setTimeout(() => setLoading(false), 15000)
      return () => {
        subscription.unsubscribe()
        clearTimeout(timer)
      }
    }

    return () => subscription.unsubscribe()
  }, [])

  function clearPasswordRecovery() {
    setIsPasswordRecovery(false)
  }

  // Load profile whenever user changes
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('id, display_name, app_role, default_household_id, created_at')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          // app_role 컬럼 미존재(400) 등 마이그레이션 전 대비: 기본값으로 폴백
          setProfile(null)
          return
        }
        setProfile(data as Profile | null)
      })
  }, [session?.user?.id])

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUpWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  async function signOut() {
    setProfile(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      appRole: profile?.app_role ?? 'user',
      loading,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      isPasswordRecovery,
      clearPasswordRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
