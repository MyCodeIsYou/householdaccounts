import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { HouseholdMember } from '@/types'

export function useHouseholdMembers(householdId: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['household-members', householdId],
    queryFn: async (): Promise<HouseholdMember[]> => {
      if (!householdId) return []
      const { data, error } = await supabase
        .from('household_members')
        .select('*, profile:profiles(id, display_name)')
        .eq('household_id', householdId)
        .order('joined_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as HouseholdMember[]
    },
    enabled: !!householdId,
  })

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      if (!user || !householdId) throw new Error('로그인이 필요합니다')
      // member의 user_id 조회
      const { data: member, error: fetchErr } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('id', memberId)
        .single()
      if (fetchErr) throw fetchErr
      // RPC로 제거 (RLS 재귀 우회)
      const { error } = await supabase.rpc('remove_household_member', {
        p_household_id: householdId,
        p_user_id: member.user_id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household-members', householdId] }),
  })

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    removeMember,
  }
}
