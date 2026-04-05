import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Household, HouseholdMember } from '@/types'

export function useAdminHouseholds() {
  const { appRole } = useAuth()

  const query = useQuery({
    queryKey: ['admin-households'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('*, owner:profiles!households_owner_id_fkey(id, display_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as (Household & { owner?: { id: string; display_name: string | null } })[]
    },
    enabled: appRole === 'super_admin',
  })

  return { households: query.data ?? [], isLoading: query.isLoading, error: query.error }
}

export function useAdminHouseholdMembers(householdId: string | null) {
  const { appRole } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['admin-household-members', householdId],
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
    enabled: appRole === 'super_admin' && !!householdId,
  })

  const removeMember = useMutation({
    mutationFn: async ({ household_id, user_id }: { household_id: string; user_id: string }) => {
      const { error } = await supabase.rpc('remove_household_member', {
        p_household_id: household_id,
        p_user_id: user_id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-household-members', householdId] }),
  })

  return { members: query.data ?? [], isLoading: query.isLoading, removeMember }
}
