import { useQuery, useMutation } from '@tanstack/react-query'
import { kisApi } from '@/lib/kis'

export function useKisStatus() {
  return useQuery({
    queryKey: ['kis', 'status'],
    queryFn: () => kisApi.status(),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useKisPrice(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['kis', 'price', symbol],
    queryFn: () => kisApi.price(symbol),
    enabled: enabled && !!symbol,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useKisDailyPrices(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['kis', 'daily-prices', symbol],
    queryFn: () => kisApi.dailyPrices(symbol),
    enabled: enabled && !!symbol,
    staleTime: 60_000,
  })
}

export function useKisBalance(enabled = true) {
  return useQuery({
    queryKey: ['kis', 'balance'],
    queryFn: () => kisApi.balance(),
    enabled,
    staleTime: 30_000,
  })
}

export function useKisFinancialRatio(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['kis', 'financial-ratio', symbol],
    queryFn: () => kisApi.financialRatio(symbol),
    enabled: enabled && !!symbol,
    staleTime: 24 * 60 * 60_000,
  })
}

export function useKisInvestorTrend(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['kis', 'investor-trend', symbol],
    queryFn: () => kisApi.investorTrend(symbol),
    enabled: enabled && !!symbol,
    staleTime: 60_000,
  })
}

export function useKisOrderBuy() {
  return useMutation({
    mutationFn: (args: { symbol: string; qty: number; price: number; orderType?: 'limit' | 'market' }) =>
      kisApi.orderBuy(args.symbol, args.qty, args.price, args.orderType),
  })
}

export function useKisOrderSell() {
  return useMutation({
    mutationFn: (args: { symbol: string; qty: number; price: number; orderType?: 'limit' | 'market' }) =>
      kisApi.orderSell(args.symbol, args.qty, args.price, args.orderType),
  })
}
