import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { Card } from '@/types'

export function useCards() {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['cards', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('cards').select('*')
      )
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Card[]
    },
    enabled: !!user,
  })

  const add = useMutation({
    mutationFn: async (payload: Omit<Card, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('cards').insert({ ...payload, ...insertScope })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards', scopeKey] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Card> }) => {
      const { error } = await supabase.from('cards').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards', scopeKey] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cards').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards', scopeKey] }),
  })

  return { ...query, cards: query.data ?? [], add, update, remove }
}
