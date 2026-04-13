import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'

export function useHouseholds() {
  const { user } = useAuth()
  const { households, isLoading, setActiveHousehold } = useHousehold()
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('로그인이 필요합니다')
      // 1. 가계부 생성
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .insert({ name, owner_id: user.id })
        .select()
        .single()
      if (hhErr) throw hhErr

      // 2. 오너를 멤버로 추가
      const { error: memErr } = await supabase
        .from('household_members')
        .insert({ household_id: hh.id, user_id: user.id, role: 'owner' })
      if (memErr) throw memErr

      return hh
    },
    onSuccess: () => {
      // Reload context by re-triggering the HouseholdProvider effect
      qc.invalidateQueries({ queryKey: ['households'] })
      // Reload page to re-trigger context load
      window.location.reload()
    },
  })

  const leave = useMutation({
    mutationFn: async (householdId: string) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.rpc('leave_household', { p_household_id: householdId })
      if (error) throw error
    },
    onSuccess: () => {
      // 현재 활성 가계부에서 나갔으면 개인 모드로 전환
      setActiveHousehold(null)
      qc.invalidateQueries({ queryKey: ['households'] })
      window.location.reload()
    },
  })

  const deleteHousehold = useMutation({
    mutationFn: async (householdId: string) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase
        .from('households')
        .delete()
        .eq('id', householdId)
        .eq('owner_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      setActiveHousehold(null)
      qc.invalidateQueries({ queryKey: ['households'] })
      window.location.reload()
    },
  })

  return { households, isLoading, create, leave, deleteHousehold }
}
