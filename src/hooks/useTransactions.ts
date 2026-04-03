import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { endOfMonth, format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { Transaction, TransactionInsert, TransactionUpdate, TransactionFilters } from '@/types'

export function useTransactions(filters: TransactionFilters = {}) {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['transactions', scopeKey, filters],
    queryFn: async () => {
      if (!user) return []
      let q = applyFilter(
        supabase.from('transactions').select(`
          *,
          category:categories!transactions_category_id_fkey(id, name, type, plan_group),
          subcategory:categories!transactions_subcategory_id_fkey(id, name, type, plan_group),
          account:accounts(id, bank_name, label),
          card:cards(id, card_name, card_company)
        `)
      )

      if (filters.type && filters.type !== 'all') q = q.eq('type', filters.type)
      if (filters.category_id) q = q.eq('category_id', filters.category_id)
      if (filters.card_id) q = q.eq('card_id', filters.card_id)
      if (filters.is_allowance !== undefined) q = q.eq('is_allowance', filters.is_allowance)
      if (filters.dateFrom) q = q.gte('txn_date', filters.dateFrom)
      if (filters.dateTo) q = q.lte('txn_date', filters.dateTo)
      if (filters.year && filters.month) {
        const y = filters.year
        const m = String(filters.month).padStart(2, '0')
        const lastDay = format(endOfMonth(new Date(y, filters.month - 1, 1)), 'yyyy-MM-dd')
        q = q.gte('txn_date', `${y}-${m}-01`).lte('txn_date', lastDay)
      } else if (filters.year) {
        q = q.gte('txn_date', `${filters.year}-01-01`).lte('txn_date', `${filters.year}-12-31`)
      }
      if (filters.keyword) q = q.ilike('memo', `%${filters.keyword}%`)

      q = q.order('txn_date', { ascending: false }).order('created_at', { ascending: false })

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
    enabled: !!user,
  })

  const add = useMutation({
    mutationFn: async (payload: TransactionInsert) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('transactions').insert({ ...payload, ...insertScope })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['monthly-summary'] })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TransactionUpdate }) => {
      const { error } = await supabase.from('transactions').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['monthly-summary'] })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['monthly-summary'] })
    },
  })

  const transactions = query.data ?? []
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return { ...query, transactions, totalIncome, totalExpense, add, update, remove }
}
