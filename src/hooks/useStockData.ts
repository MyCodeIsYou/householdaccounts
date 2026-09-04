import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export type StockScreenRow = {
  symbol: string
  name: string
  market: string
  close_price: number | null
  change_pct: number | null
  volume: number | null
  rsi_14: number | null
  sma5_pos: number | null
  sma20_pos: number | null
  sma60_pos: number | null
  roe: number | null
  eps: number | null
  bps: number | null
  revenue_growth: number | null
  op_growth: number | null
  debt_ratio: number | null
  foreign_net: number | null
  inst_net: number | null
}

function calcSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period
}

function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss -= diff
  }
  avgGain /= period; avgLoss /= period
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
}

export function useStockScreenData() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['stock-screen-data', user?.id],
    queryFn: async (): Promise<StockScreenRow[]> => {
      if (!user) return []

      const [priceRes, finRes, invRes] = await Promise.all([
        supabase
          .from('stock_daily_prices')
          .select('symbol, bsop_date, close_price, volume, change_amount, change_sign')
          .eq('user_id', user.id)
          .order('bsop_date', { ascending: true }),
        supabase
          .from('stock_financials')
          .select('symbol, fiscal_ym, roe, eps, bps, revenue_growth, op_profit_growth, debt_rate')
          .eq('user_id', user.id)
          .order('fiscal_ym', { ascending: false }),
        supabase
          .from('stock_investor_trends')
          .select('symbol, bsop_date, foreign_qty, institution_qty')
          .eq('user_id', user.id)
          .order('bsop_date', { ascending: false }),
      ])

      const pricesBySymbol = new Map<string, { close: number; volume: number; change_amount: number; change_sign: string }[]>()
      for (const row of priceRes.data ?? []) {
        const arr = pricesBySymbol.get(row.symbol) ?? []
        arr.push({
          close: Number(row.close_price),
          volume: Number(row.volume),
          change_amount: Number(row.change_amount ?? 0),
          change_sign: row.change_sign ?? '3',
        })
        pricesBySymbol.set(row.symbol, arr)
      }

      const finBySymbol = new Map<string, typeof finRes.data extends (infer T)[] | null ? T : never>()
      for (const row of finRes.data ?? []) {
        if (!finBySymbol.has(row.symbol)) finBySymbol.set(row.symbol, row)
      }

      const invBySymbol = new Map<string, { foreign_qty: number; inst_qty: number }>()
      for (const row of invRes.data ?? []) {
        if (!invBySymbol.has(row.symbol)) {
          invBySymbol.set(row.symbol, {
            foreign_qty: Number(row.foreign_qty ?? 0),
            inst_qty: Number(row.institution_qty ?? 0),
          })
        }
      }

      const { STOCK_LIST } = await import('@/lib/stockList')

      const symbols = new Set([...pricesBySymbol.keys(), ...finBySymbol.keys(), ...invBySymbol.keys()])
      const results: StockScreenRow[] = []

      for (const symbol of symbols) {
        const stockInfo = STOCK_LIST.find(s => s.code === symbol)
        const prices = pricesBySymbol.get(symbol)
        const fin = finBySymbol.get(symbol)
        const inv = invBySymbol.get(symbol)

        const closes = prices?.map(p => p.close) ?? []
        const lastPrice = closes.length > 0 ? closes[closes.length - 1] : null
        const lastRow = prices && prices.length > 0 ? prices[prices.length - 1] : null

        let changePct: number | null = null
        if (lastRow && lastPrice && lastPrice > 0) {
          const sign = lastRow.change_sign
          const isDown = sign === '4' || sign === '5'
          changePct = (lastRow.change_amount / (lastPrice - (isDown ? -lastRow.change_amount : lastRow.change_amount))) * 100
          if (isDown) changePct = -changePct
        }

        const sma5 = calcSMA(closes, 5)
        const sma20 = calcSMA(closes, 20)
        const sma60 = calcSMA(closes, 60)

        results.push({
          symbol,
          name: stockInfo?.name ?? symbol,
          market: stockInfo?.market ?? '',
          close_price: lastPrice,
          change_pct: changePct,
          volume: lastRow ? lastRow.volume : null,
          rsi_14: calcRSI(closes),
          sma5_pos: lastPrice && sma5 ? ((lastPrice - sma5) / sma5) * 100 : null,
          sma20_pos: lastPrice && sma20 ? ((lastPrice - sma20) / sma20) * 100 : null,
          sma60_pos: lastPrice && sma60 ? ((lastPrice - sma60) / sma60) * 100 : null,
          roe: fin?.roe != null ? Number(fin.roe) : null,
          eps: fin?.eps != null ? Number(fin.eps) : null,
          bps: fin?.bps != null ? Number(fin.bps) : null,
          revenue_growth: fin?.revenue_growth != null ? Number(fin.revenue_growth) : null,
          op_growth: fin?.op_profit_growth != null ? Number(fin.op_profit_growth) : null,
          debt_ratio: fin?.debt_rate != null ? Number(fin.debt_rate) : null,
          foreign_net: inv?.foreign_qty ?? null,
          inst_net: inv?.inst_qty ?? null,
        })
      }

      return results
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}
