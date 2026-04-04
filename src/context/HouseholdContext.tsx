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
  const { user, appRole } = useAuth()
  const [households, setHouseholds] = useState<Household[]>([])
  const [activeHouseholdId, setActiveHouseholdIdState] = useState<UUID | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setHouseholds([])
      setActiveHouseholdIdState(null)
      return
    }

    setIsLoading(true)

    if (appRole === 'super_admin') {
      // super_admin은 전체 그룹 목록 로드
      supabase
        .from('households')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setHouseholds(data as Household[])
          // super_admin은 개인 모드로 시작
          setActiveHouseholdIdState(null)
          setIsLoading(false)
        })
    } else {
      // 일반 사용자: 자신이 속한 그룹만
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

          // 저장된 선택 복원
          const savedKey = `household:${user.id}`
          const saved = localStorage.getItem(savedKey)
          if (saved && list.some(h => h.id === saved)) {
            setActiveHouseholdIdState(saved)
          } else {
            setActiveHouseholdIdState(null)
          }
          setIsLoading(false)
        })
    }
  }, [user?.id, appRole])

  const qc = useQueryClient()

  function setActiveHousehold(id: UUID | null) {
    setActiveHouseholdIdState(id)
    // 캐시를 stale로 마킹하되 즉시 refetch하지 않음 (이전 filter로 잘못된 요청 방지)
    // React 재렌더 후 새 scopeKey로 자동 fetch됨
    qc.invalidateQueries({ refetchType: 'none' })
    if (user && appRole !== 'super_admin') {
      const savedKey = `household:${user.id}`
      if (id) {
        localStorage.setItem(savedKey, id)
      } else {
        localStorage.removeItem(savedKey)
      }
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
