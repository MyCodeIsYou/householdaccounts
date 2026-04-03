import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { Account, AccountInsert, AccountUpdate } from '@/types'

export function useAccounts() {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['accounts', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('accounts').select('*')
      )
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Account[]
    },
    enabled: !!user,
  })

  const totalBalance = (query.data ?? []).reduce((s, a) => s + a.balance, 0)

  const add = useMutation({
    mutationFn: async (payload: AccountInsert) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('accounts').insert({ ...payload, ...insertScope })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts', scopeKey] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AccountUpdate }) => {
      const { error } = await supabase.from('accounts').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts', scopeKey] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts', scopeKey] }),
  })

  return { ...query, totalBalance, add, update, remove }
}
