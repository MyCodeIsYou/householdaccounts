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
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('id', memberId)
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
