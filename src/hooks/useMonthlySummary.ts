import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { MonthlySummary } from '@/types'

export function useMonthlySummary(year: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['monthly-summary', user?.id, year],
    queryFn: async (): Promise<MonthlySummary[]> => {
      if (!user) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('txn_date, type, amount')
        .eq('user_id', user.id)
        .gte('txn_date', `${year}-01-01`)
        .lte('txn_date', `${year}-12-31`)
        .in('type', ['income', 'expense'])

      if (error) throw error

      const map = new Map<number, MonthlySummary>()
      for (let m = 1; m <= 12; m++) {
        map.set(m, { year, month: m, income: 0, expense: 0, balance: 0 })
      }

      for (const row of data ?? []) {
        const month = parseInt(row.txn_date.slice(5, 7), 10)
        const entry = map.get(month)!
        if (row.type === 'income') entry.income += row.amount
        else if (row.type === 'expense') entry.expense += row.amount
        entry.balance = entry.income - entry.expense
      }

      return Array.from(map.values())
    },
    enabled: !!user,
  })
}
