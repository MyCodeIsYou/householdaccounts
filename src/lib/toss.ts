// 토스증권 Open API 클라이언트 (Edge Function `toss-proxy` 경유)
//
// 모든 호출은 Supabase Edge Function 을 통해 이뤄진다. client_secret 은 서버에만 존재하며
// 브라우저에는 노출되지 않는다. 응답은 토스 BFF envelope({ result } 또는 { error }) 형태.

import { supabase } from '@/lib/supabase'

export interface TossError {
  requestId?: string
  code?: string
  message: string
}

// ---- 응답 타입 ----
export interface PriceResponse {
  symbol: string
  timestamp: string
  lastPrice: string
  currency: string
}

export interface StockInfo {
  symbol: string
  name: string
  englishName: string
  isinCode: string
  market: string
  securityType: string
  isCommonShare: boolean
  status: string
  currency: string
  listDate: string | null
  delistDate: string | null
  sharesOutstanding: string
  leverageFactor: string | null
  koreanMarketDetail: {
    liquidationTrading: boolean
    nxtSupported: boolean
    krxTradingSuspended: boolean
    nxtTradingSuspended: boolean | null
  } | null
}

export interface OrderbookLevel {
  price: string
  volume: string
}
export interface OrderbookResponse {
  timestamp: string
  currency: string
  asks: OrderbookLevel[]
  bids: OrderbookLevel[]
}

export interface Trade {
  price: string
  volume: string
  timestamp: string
  currency: string
}

export interface Candle {
  timestamp: string
  openPrice: string
  highPrice: string
  lowPrice: string
  closePrice: string
  volume: string
  currency: string
}
export interface CandlePageResponse {
  candles: Candle[]
  nextBefore: string | null
}

export interface PriceLimitResponse {
  timestamp: string
  upperLimitPrice: string | null
  lowerLimitPrice: string | null
  currency: string
}

// 계좌/자산 (스펙 일부 추정 — 실제 응답 필드명은 전체 스펙으로 확인 권장)
export interface TossAccount {
  accountSeq: string
  accountNumber?: string
  accountName?: string
  [key: string]: unknown
}
export interface AssetHolding {
  symbol: string
  name?: string
  quantity?: string
  averagePrice?: string
  evaluationAmount?: string
  profitLoss?: string
  profitLossRate?: string
  currency?: string
  [key: string]: unknown
}

// ---- 내부 호출 ----
interface ProxyArgs {
  path: string
  query?: Record<string, string | number | boolean | undefined>
  accountSeq?: string
}

async function call<T>({ path, query, accountSeq }: ProxyArgs): Promise<T> {
  const normalizedQuery: Record<string, string> | undefined = query
    ? Object.fromEntries(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    : undefined

  const reqBody = { path, query: normalizedQuery, accountSeq }

  // 개발 환경: Vite dev 서버 미들웨어(/__toss)로 중계 (CORS 회피 + 집 공인 IP 사용)
  if (import.meta.env.DEV) {
    const res = await fetch('/__toss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })
    const data = await res.json().catch(() => ({}))
    if (data?.error) throw new Error((data.error as TossError).message ?? '토스 API 오류')
    return data.result as T
  }

  // 프로덕션: Supabase Edge Function 경유
  const { data, error } = await supabase.functions.invoke('toss-proxy', {
    body: reqBody,
  })
  if (error) throw new Error(`프록시 호출 실패: ${error.message}`)
  if (data?.error) throw new Error((data.error as TossError).message ?? '토스 API 오류')
  return data.result as T
}

// ---- 공개 API ----
export const tossApi = {
  prices: (symbols: string[]) =>
    call<PriceResponse[]>({ path: '/api/v1/prices', query: { symbols: symbols.join(',') } }),

  stocks: (symbols: string[]) =>
    call<StockInfo[]>({ path: '/api/v1/stocks', query: { symbols: symbols.join(',') } }),

  orderbook: (symbol: string) =>
    call<OrderbookResponse>({ path: '/api/v1/orderbook', query: { symbol } }),

  trades: (symbol: string, count = 30) =>
    call<Trade[]>({ path: '/api/v1/trades', query: { symbol, count } }),

  priceLimit: (symbol: string) =>
    call<PriceLimitResponse>({ path: '/api/v1/price-limits', query: { symbol } }),

  candles: (symbol: string, interval: '1m' | '1d', count = 100) =>
    call<CandlePageResponse>({ path: '/api/v1/candles', query: { symbol, interval, count } }),

  accounts: () => call<TossAccount[]>({ path: '/api/v1/accounts' }),

  assets: (accountSeq: string) =>
    call<AssetHolding[] | { holdings: AssetHolding[]; summary?: unknown }>({
      path: '/api/v1/assets',
      accountSeq,
    }),
}
