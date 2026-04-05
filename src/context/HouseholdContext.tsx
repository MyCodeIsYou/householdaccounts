import React, { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Household, UUID } from '@/types'

interface QueryFilter {
  mode: 'personal' | 'household'
  userId: string
  householdId: string | null
}

interface HouseholdContextValue {
  activeHouseholdId: UUID | null
  households: Household[]
  isLoading: boolean
  isViewingAsAdmin: boolean
  setActiveHousehold: (id: UUID | null) => void
  queryFilter: QueryFilter
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined)

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, appRole, profile } = useAuth()
  const [households, setHouseholds] = useState<Household[]>([])
  const [activeHouseholdId, setActiveHouseholdIdState] = useState<UUID | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!user) {
      setHouseholds([])
      setActiveHouseholdIdState(null)
      setInitialized(false)
      return
    }

    setIsLoading(true)

    supabase
      .from('household_members')
      .select('household_id, households(id, name, owner_id, created_at)')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error || !data) {
          setIsLoading(false)
          return
        }
        const list: Household[] = data
          .map((row: { households: Household | Household[] | null }) =>
            Array.isArray(row.households) ? row.households[0] : row.households
          )
          .filter((h): h is Household => h != null)
        setHouseholds(list)

        // 최초 1회만 기본 가계부 결정
        // 우선순위: localStorage(세션 연속성) → profile.default_household_id → 개인 모드
        if (!initialized) {
          const savedKey = `household:${user.id}`
          const saved = localStorage.getItem(savedKey)
          if (saved === 'personal') {
            setActiveHouseholdIdState(null)
          } else if (saved && list.some(h => h.id === saved)) {
            setActiveHouseholdIdState(saved)
          } else if (profile?.default_household_id && list.some(h => h.id === profile.default_household_id)) {
            setActiveHouseholdIdState(profile.default_household_id)
          } else {
            setActiveHouseholdIdState(null)
          }
          setInitialized(true)
        }
        setIsLoading(false)
      })
  }, [user?.id, appRole, profile?.default_household_id, initialized])

  const qc = useQueryClient()

  function setActiveHousehold(id: UUID | null) {
    setActiveHouseholdIdState(id)
    // 캐시를 stale로 마킹하되 즉시 refetch하지 않음 (이전 filter로 잘못된 요청 방지)
    // React 재렌더 후 새 scopeKey로 자동 fetch됨
    qc.invalidateQueries({ refetchType: 'none' })
    if (user) {
      const savedKey = `household:${user.id}`
      // 'personal' 센티널: 사용자가 의도적으로 개인 모드를 선택했음을 기억
      // (다음 로그인 시 default_household_id를 무시하기 위함)
      localStorage.setItem(savedKey, id ?? 'personal')
    }
  }

  const queryFilter: QueryFilter = activeHouseholdId
    ? { mode: 'household', userId: user?.id ?? '', householdId: activeHouseholdId }
    : { mode: 'personal', userId: user?.id ?? '', householdId: null }

  const isViewingAsAdmin = appRole === 'super_admin' && !!activeHouseholdId

  return (
    <HouseholdContext.Provider value={{
      activeHouseholdId,
      households,
      isLoading,
      isViewingAsAdmin,
      setActiveHousehold,
      queryFilter,
    }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
