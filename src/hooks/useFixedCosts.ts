import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { FixedCost, FixedCostRecord } from '@/types'

export function useFixedCosts(year: number, month: number) {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const costsQuery = useQuery({
    queryKey: ['fixed-costs', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('fixed_costs').select('*')
      )
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as FixedCost[]
    },
    enabled: !!user,
  })

  const recordsQuery = useQuery({
    queryKey: ['fixed-cost-records', scopeKey, year, month],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('fixed_cost_records').select('*')
      )
        .eq('record_year', year)
        .eq('record_month', month)
      if (error) throw error
      return (data ?? []) as FixedCostRecord[]
    },
    enabled: !!user,
  })

  const addCost = useMutation({
    mutationFn: async (payload: Omit<FixedCost, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('fixed_costs').insert({ ...payload, ...insertScope })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-costs', scopeKey] }),
  })

  const updateCost = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<FixedCost> }) => {
      const { error } = await supabase.from('fixed_costs').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-costs', scopeKey] }),
  })

  const removeCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fixed_costs').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-costs', scopeKey] }),
  })

  const markPaid = useMutation({
    mutationFn: async ({
      fixedCostId,
      actualAmount,
      paidDate,
      transactionId,
    }: {
      fixedCostId: string
      actualAmount: number
      paidDate: string
      transactionId?: string
    }) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const existing = recordsQuery.data?.find(r => r.fixed_cost_id === fixedCostId)
      const payload = {
        ...insertScope,
        fixed_cost_id: fixedCostId,
        record_year: year,
        record_month: month,
        actual_amount: actualAmount,
        is_paid: true,
        paid_date: paidDate,
        transaction_id: transactionId ?? null,
      }
      if (existing) {
        const { error } = await supabase.from('fixed_cost_records').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fixed_cost_records').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-cost-records', scopeKey, year, month] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  return {
    costs: costsQuery.data ?? [],
    records: recordsQuery.data ?? [],
    isLoading: costsQuery.isLoading || recordsQuery.isLoading,
    addCost,
    updateCost,
    removeCost,
    markPaid,
  }
}
