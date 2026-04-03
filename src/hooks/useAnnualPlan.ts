import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { AnnualPlan, MonthKey } from '@/types'
import { MONTH_KEYS } from '@/lib/constants'

export function useAnnualPlan(year: number) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const planQuery = useQuery({
    queryKey: ['annual-plan', user?.id, year],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('annual_plan')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_year', year)
      if (error) throw error
      return (data ?? []) as AnnualPlan[]
    },
    enabled: !!user,
  })

  // 실적: transactions에서 연도별 카테고리+월 집계
  const actualQuery = useQuery({
    queryKey: ['annual-plan-actual', user?.id, year],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('category_id, txn_date, amount, type')
        .eq('user_id', user.id)
        .gte('txn_date', `${year}-01-01`)
        .lte('txn_date', `${year}-12-31`)
        .in('type', ['income', 'expense'])
      if (error) throw error
      return data ?? []
    },
    enabled: !!user,
  })

  // category_id → MonthKey → amount 집계 맵
  const actualMap = new Map<string, Record<MonthKey, number>>()
  for (const row of actualQuery.data ?? []) {
    if (!row.category_id) continue
    const monthIdx = parseInt(row.txn_date.slice(5, 7), 10) - 1
    const key = MONTH_KEYS[monthIdx] as MonthKey
    if (!actualMap.has(row.category_id)) {
      actualMap.set(row.category_id, Object.fromEntries(MONTH_KEYS.map(k => [k, 0])) as Record<MonthKey, number>)
    }
    actualMap.get(row.category_id)![key] += row.amount
  }

  const upsertCell = useMutation({
    mutationFn: async ({
      categoryId,
      monthKey,
      value,
    }: {
      categoryId: string
      monthKey: MonthKey
      value: number
    }) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const existing = planQuery.data?.find(p => p.category_id === categoryId)
      if (existing) {
        const { error } = await supabase
          .from('annual_plan')
          .update({ [monthKey]: value })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const newRow: Partial<AnnualPlan> = {
          user_id: user.id,
          plan_year: year,
          category_id: categoryId,
          ...Object.fromEntries(MONTH_KEYS.map(k => [k, 0])),
          [monthKey]: value,
        }
        const { error } = await supabase.from('annual_plan').insert(newRow)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annual-plan', user?.id, year] }),
  })

  return {
    plans: planQuery.data ?? [],
    actualMap,
    isLoading: planQuery.isLoading || actualQuery.isLoading,
    upsertCell,
  }
}
