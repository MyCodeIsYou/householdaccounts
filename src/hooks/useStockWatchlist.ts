import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'

export type WatchlistItem = {
  id: string
  user_id: string
  household_id: string | null
  symbol: string
  name: string
  market: string
  display_order: number
  created_at: string
}

export function useStockWatchlist() {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['stock_watchlist', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('stock_watchlist').select('*')
      ).order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as WatchlistItem[]
    },
    enabled: !!user,
  })

  const add = useMutation({
    mutationFn: async (item: { symbol: string; name: string; market: string }) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const maxOrder = (query.data ?? []).reduce((m, w) => Math.max(m, w.display_order), -1)
      const { error } = await supabase.from('stock_watchlist').insert({
        symbol: item.symbol,
        name: item.name,
        market: item.market,
        display_order: maxOrder + 1,
        ...insertScope,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock_watchlist', scopeKey] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stock_watchlist').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock_watchlist', scopeKey] }),
  })

  const isWatching = (symbol: string) =>
    (query.data ?? []).some(w => w.symbol === symbol)

  return { ...query, items: query.data ?? [], add, remove, isWatching }
}
