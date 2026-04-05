import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { Liability, LiabilityInsert, LiabilityUpdate } from '@/types'

export function useLiabilities() {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['liabilities', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('liabilities').select('*')
      )
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Liability[]
    },
    enabled: !!user,
  })

  const totalBalance = (query.data ?? []).reduce((s, l) => s + Number(l.balance), 0)

  const add = useMutation({
    mutationFn: async (payload: LiabilityInsert) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('liabilities').insert({ ...payload, ...insertScope })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liabilities', scopeKey] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: LiabilityUpdate }) => {
      const { error } = await supabase.from('liabilities').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liabilities', scopeKey] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('liabilities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liabilities', scopeKey] }),
  })

  return { ...query, totalBalance, add, update, remove }
}
