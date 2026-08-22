import { useQuery } from '@tanstack/react-query'
import { tossApi } from '@/lib/toss'

// 시세는 자주 바뀌므로 짧은 캐시 + 자동 갱신. 종목정보는 영업일 단위라 길게 캐시.

export function usePrices(symbols: string[], enabled = true) {
  return useQuery({
    queryKey: ['toss', 'prices', symbols],
    queryFn: () => tossApi.prices(symbols),
    enabled: enabled && symbols.length > 0,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useStocks(symbols: string[], enabled = true) {
  return useQuery({
    queryKey: ['toss', 'stocks', symbols],
    queryFn: () => tossApi.stocks(symbols),
    enabled: enabled && symbols.length > 0,
    staleTime: 60 * 60_000, // 1시간
  })
}

export function useOrderbook(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['toss', 'orderbook', symbol],
    queryFn: () => tossApi.orderbook(symbol),
    enabled: enabled && !!symbol,
    refetchInterval: 3_000,
  })
}

export function useTrades(symbol: string, count = 30, enabled = true) {
  return useQuery({
    queryKey: ['toss', 'trades', symbol, count],
    queryFn: () => tossApi.trades(symbol, count),
    enabled: enabled && !!symbol,
    refetchInterval: 3_000,
  })
}

export function useCandles(
  symbol: string,
  interval: '1m' | '1d',
  count = 100,
  enabled = true
) {
  return useQuery({
    queryKey: ['toss', 'candles', symbol, interval, count],
    queryFn: () => tossApi.candles(symbol, interval, count),
    enabled: enabled && !!symbol,
    staleTime: interval === '1m' ? 30_000 : 5 * 60_000,
  })
}

export function useTossAccounts(enabled = true) {
  return useQuery({
    queryKey: ['toss', 'accounts'],
    queryFn: () => tossApi.accounts(),
    enabled,
    staleTime: 60 * 60_000,
  })
}

export function useTossAssets(accountSeq: string | undefined) {
  return useQuery({
    queryKey: ['toss', 'assets', accountSeq],
    queryFn: () => tossApi.assets(accountSeq!),
    enabled: !!accountSeq,
    refetchInterval: 30_000,
  })
}
