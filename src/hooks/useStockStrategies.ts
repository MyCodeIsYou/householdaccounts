import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'

export type Strategy = {
  id: string
  user_id: string
  household_id: string | null
  name: string
  symbol: string
  type: 'buy' | 'sell' | 'both'
  status: 'running' | 'stopped'
  condition: string
  condition_type: string | null
  condition_params: Record<string, unknown> | null
  qty: number
  order_method: 'limit' | 'market'
  last_signal_at: string | null
  last_order_id: string | null
  created_at: string
  updated_at: string
}

export type StrategyInput = {
  name: string
  symbol: string
  type: 'buy' | 'sell' | 'both'
  condition: string
  condition_type?: string
  condition_params?: Record<string, unknown>
  qty?: number
  order_method?: 'limit' | 'market'
}

export type StockOrder = {
  id: string
  user_id: string
  strategy_id: string | null
  symbol: string
  order_type: 'buy' | 'sell'
  order_method: 'limit' | 'market'
  qty: number
  price: number
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed'
  kis_order_no: string | null
  error: string | null
  trigger_memo: string | null
  ordered_at: string
  filled_at: string | null
  created_at: string
}

export function useStockStrategies() {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['stock_strategies', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('stock_strategies').select('*')
      ).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Strategy[]
    },
    enabled: !!user,
  })

  const add = useMutation({
    mutationFn: async (payload: StrategyInput) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('stock_strategies').insert({
        ...payload,
        ...insertScope,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock_strategies', scopeKey] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Strategy> }) => {
      const { error } = await supabase.from('stock_strategies').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock_strategies', scopeKey] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stock_strategies').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock_strategies', scopeKey] }),
  })

  return { ...query, strategies: query.data ?? [], add, update, remove }
}

export type TradeLog = {
  id: string
  strategy_id: string
  user_id: string
  symbol: string
  action: string
  detail: Record<string, unknown>
  created_at: string
}

export function useTradeLogs(limit = 100) {
  const { user } = useHouseholdFilter()

  return useQuery({
    queryKey: ['stock_trade_logs'],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('stock_trade_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as TradeLog[]
    },
    enabled: !!user,
    refetchInterval: 60_000,
  })
}

export function useStockOrders() {
  const { user, scopeKey, applyFilter } = useHouseholdFilter()

  return useQuery({
    queryKey: ['stock_orders', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('stock_orders').select('*')
      ).order('ordered_at', { ascending: false }).limit(50)
      if (error) throw error
      return (data ?? []) as StockOrder[]
    },
    enabled: !!user,
  })
}
