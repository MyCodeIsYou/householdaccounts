import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BankInstitution } from '@/types'

export function useBankInstitutions() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['bank-institutions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_institutions')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as BankInstitution[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const add = useMutation({
    mutationFn: async (payload: { name: string; category: string; display_order?: number }) => {
      const { error } = await supabase.from('bank_institutions').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-institutions'] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; category?: string; display_order?: number; is_active?: boolean }) => {
      const { error } = await supabase.from('bank_institutions').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-institutions'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_institutions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-institutions'] }),
  })

  return { banks: query.data ?? [], isLoading: query.isLoading, add, update, remove }
}
