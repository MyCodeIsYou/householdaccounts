import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AccountTypeMaster } from '@/types'

export function useAccountTypes() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['account-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as AccountTypeMaster[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const add = useMutation({
    mutationFn: async (payload: { name: string; display_order?: number }) => {
      const { error } = await supabase.from('account_types').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-types'] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; display_order?: number; is_active?: boolean }) => {
      const { error } = await supabase.from('account_types').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-types'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('account_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-types'] }),
  })

  return { accountTypes: query.data ?? [], isLoading: query.isLoading, add, update, remove }
}
