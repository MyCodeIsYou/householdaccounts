import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { HouseholdInvite } from '@/types'

function buildInviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`
}

export function useHouseholdInvites(householdId: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['household-invites', householdId],
    queryFn: async (): Promise<HouseholdInvite[]> => {
      if (!householdId) return []
      const { data, error } = await supabase
        .from('household_invites')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as HouseholdInvite[]
    },
    enabled: !!householdId,
  })

  const create = useMutation({
    mutationFn: async ({ maxUses = 10, daysValid = 7 }: { maxUses?: number; daysValid?: number } = {}) => {
      if (!user || !householdId) throw new Error('로그인이 필요합니다')
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + daysValid)
      const { data, error } = await supabase
        .from('household_invites')
        .insert({
          household_id: householdId,
          created_by: user.id,
          max_uses: maxUses,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data as HouseholdInvite
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household-invites', householdId] }),
  })

  const deactivate = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('household_invites')
        .update({ is_active: false })
        .eq('id', inviteId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household-invites', householdId] }),
  })

  const invites = query.data ?? []

  return {
    invites,
    isLoading: query.isLoading,
    create,
    deactivate,
    buildInviteUrl,
  }
}
