import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { AnnualPlan, MonthKey } from '@/types'
import { MONTH_KEYS } from '@/lib/constants'

function emptyMonths(): Record<MonthKey, number> {
  return Object.fromEntries(MONTH_KEYS.map(k => [k, 0])) as Record<MonthKey, number>
}

export function useAnnualPlan(year: number) {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const planQuery = useQuery({
    queryKey: ['annual-plan', scopeKey, year],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('annual_plan').select('*')
      ).eq('plan_year', year)
      if (error) throw error
      return (data ?? []) as AnnualPlan[]
    },
    enabled: !!user,
  })

  // 실적: transactions에서 연도별 하위 카테고리+월 집계. 저장하지 않는다.
  const actualQuery = useQuery({
    queryKey: ['annual-plan-actual', scopeKey, year],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('transactions').select('category_id, subcategory_id, txn_date, amount, type')
      )
        .gte('txn_date', `${year}-01-01`)
        .lte('txn_date', `${year}-12-31`)
        .in('type', ['income', 'expense'])
      if (error) throw error
      return data ?? []
    },
    enabled: !!user,
  })

  const actualMap = useMemo(() => {
    const map = new Map<string, Record<MonthKey, number>>()
    for (const row of actualQuery.data ?? []) {
      const catId = row.subcategory_id ?? row.category_id
      if (!catId) continue
      const monthIdx = parseInt(row.txn_date.slice(5, 7), 10) - 1
      const key = MONTH_KEYS[monthIdx] as MonthKey
      if (!map.has(catId)) map.set(catId, emptyMonths())
      map.get(catId)![key] += row.amount
    }
    return map
  }, [actualQuery.data])

  const planByCategory = useMemo(() => {
    const map = new Map<string, AnnualPlan>()
    for (const plan of planQuery.data ?? []) map.set(plan.category_id, plan)
    return map
  }, [planQuery.data])

  async function writeMonths(categoryId: string, months: Partial<Record<MonthKey, number>>) {
    if (!user) throw new Error('로그인이 필요합니다')
    const { data: existing, error: findErr } = await applyFilter(
      supabase.from('annual_plan').select('id')
    )
      .eq('plan_year', year)
      .eq('category_id', categoryId)
      .maybeSingle()
    if (findErr) throw findErr
    if (existing) {
      const { error } = await supabase.from('annual_plan').update(months).eq('id', existing.id)
      if (error) throw error
      return
    }
    const newRow: Partial<AnnualPlan> = {
      ...insertScope,
      plan_year: year,
      category_id: categoryId,
      ...emptyMonths(),
      ...months,
    }
    const { error } = await supabase.from('annual_plan').insert(newRow)
    if (error) throw error
  }

  const invalidatePlan = () => qc.invalidateQueries({ queryKey: ['annual-plan', scopeKey, year] })

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
      await writeMonths(categoryId, { [monthKey]: value })
    },
    onSuccess: invalidatePlan,
  })

  const upsertMonths = useMutation({
    mutationFn: async ({
      categoryId,
      months,
    }: {
      categoryId: string
      months: Partial<Record<MonthKey, number>>
    }) => {
      await writeMonths(categoryId, months)
    },
    onSuccess: invalidatePlan,
  })

  return {
    plans: planQuery.data ?? [],
    planByCategory,
    actualMap,
    isLoading: planQuery.isLoading || actualQuery.isLoading,
    upsertCell,
    upsertMonths,
  }
}
