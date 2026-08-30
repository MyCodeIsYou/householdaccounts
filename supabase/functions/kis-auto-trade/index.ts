// 자동매매 엔진 (Supabase Edge Function)
//
// 역할:
//  1. status='running'인 전략 조회
//  2. 각 전략의 종목 시세/일봉 조회
//  3. 기술지표 계산 (RSI, MACD, SMA, 볼린저밴드 등)
//  4. 조건 충족 시 KIS API로 실제 주문
//  5. 주문 결과를 stock_orders + stock_trade_logs에 기록
//
// 호출: cron 또는 수동 POST
//   curl -X POST <SUPABASE_URL>/functions/v1/kis-auto-trade \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
//
// 시크릿: KIS_APPKEY, KIS_APPSECRET, KIS_ACCOUNT_NO, KIS_ACCOUNT_PRODUCT_CODE, KIS_MODE
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (자동 제공)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── KIS API 인프라 (kis-proxy와 동일) ──────────────────────

const DOMAINS = {
  real: 'https://openapi.koreainvestment.com:9443',
  paper: 'https://openapivts.koreainvestment.com:29443',
} as const

type KisMode = keyof typeof DOMAINS

function getMode(): KisMode {
  const m = Deno.env.get('KIS_MODE') ?? 'paper'
  return m === 'real' ? 'real' : 'paper'
}
function getBase() { return DOMAINS[getMode()] }

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken
  const appkey = Deno.env.get('KIS_APPKEY')!
  const appsecret = Deno.env.get('KIS_APPSECRET')!
  const res = await fetch(`${getBase()}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey, appsecret }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`토큰 발급 실패: ${data.error_description ?? data.msg1}`)
  cachedToken = data.access_token
  tokenExpiresAt = data.access_token_token_expired
    ? new Date(data.access_token_token_expired).getTime() - 60_000
    : Date.now() + 23 * 3600_000
  return cachedToken!
}

interface KisCallOpts {
  method?: 'GET' | 'POST'
  path: string
  trId: string
  query?: Record<string, string>
  body?: Record<string, string>
}

async function callKis(opts: KisCallOpts): Promise<Record<string, unknown>> {
  const token = await getToken()
  const appkey = Deno.env.get('KIS_APPKEY')!
  const appsecret = Deno.env.get('KIS_APPSECRET')!
  const url = new URL(getBase() + opts.path)
  if (opts.query) for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v)

  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    authorization: `Bearer ${token}`,
    appkey, appsecret,
    tr_id: opts.trId,
    custtype: 'P',
  }
  const fetchOpts: RequestInit = { method: opts.method ?? 'GET', headers }
  if (opts.method === 'POST' && opts.body) fetchOpts.body = JSON.stringify(opts.body)

  const res = await fetch(url.toString(), fetchOpts)
  return await res.json()
}

// ─── 시세 조회 ──────────────────────────────────────────────

interface DailyPrice { date: string; open: number; high: number; low: number; close: number; volume: number }

async function fetchDailyPrices(symbol: string): Promise<DailyPrice[]> {
  const data = await callKis({
    path: '/uapi/domestic-stock/v1/quotations/inquire-daily-price',
    trId: 'FHKST01010400',
    query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '0' },
  })
  if (data.rt_cd !== '0') throw new Error(`시세 조회 실패: ${data.msg1}`)
  // deno-lint-ignore no-explicit-any
  return ((data.output as any[]) ?? []).map((d: any) => ({
    date: d.stck_bsop_date,
    open: Number(d.stck_oprc),
    high: Number(d.stck_hgpr),
    low: Number(d.stck_lwpr),
    close: Number(d.stck_clpr),
    volume: Number(d.acml_vol),
  }))
}

async function fetchCurrentPrice(symbol: string): Promise<number> {
  const data = await callKis({
    path: '/uapi/domestic-stock/v1/quotations/inquire-price',
    trId: 'FHKST01010100',
    query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
  })
  if (data.rt_cd !== '0') throw new Error(`현재가 조회 실패: ${data.msg1}`)
  // deno-lint-ignore no-explicit-any
  return Number((data.output as any).stck_prpr)
}

// ─── 기술지표 계산 ──────────────────────────────────────────

function calcSMA(closes: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    result.push(sum / period)
  }
  return result
}

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = [closes[0]]
  for (let i = 1; i < closes.length; i++) {
    result.push(closes[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return result

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return result
}

function calcMACD(closes: number[]): { macd: number[]; signal: number[]; hist: number[] } {
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signal = calcEMA(macdLine, 9)
  const hist = macdLine.map((v, i) => v - signal[i])
  return { macd: macdLine, signal, hist }
}

function calcBollinger(closes: number[], period = 20, mult = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calcSMA(closes, period)
  const upper: number[] = []
  const lower: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); continue }
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - middle[i]) ** 2
    const std = Math.sqrt(sumSq / period)
    upper.push(middle[i] + mult * std)
    lower.push(middle[i] - mult * std)
  }
  return { upper, middle, lower }
}

// ─── 조건 판단 엔진 ─────────────────────────────────────────

type Signal = 'buy' | 'sell' | null

// deno-lint-ignore no-explicit-any
type ConditionParams = Record<string, any>

interface MarketData {
  closes: number[]
  currentPrice: number
  volumes: number[]
}

function evaluate(conditionType: string, params: ConditionParams, data: MarketData): { signal: Signal; memo: string } {
  const len = data.closes.length
  if (len < 30) return { signal: null, memo: '데이터 부족' }
  const last = len - 1
  const prev = len - 2

  switch (conditionType) {
    // ── 이동평균선 ──
    case 'sma_golden_cross': {
      const short = params.short_period ?? 5
      const long = params.long_period ?? 20
      const smaS = calcSMA(data.closes, short)
      const smaL = calcSMA(data.closes, long)
      if (smaS[prev] <= smaL[prev] && smaS[last] > smaL[last])
        return { signal: 'buy', memo: `${short}일선(${smaS[last].toFixed(0)})이 ${long}일선(${smaL[last].toFixed(0)}) 상향 돌파` }
      return { signal: null, memo: `${short}일선: ${smaS[last]?.toFixed(0)}, ${long}일선: ${smaL[last]?.toFixed(0)}` }
    }
    case 'sma_dead_cross': {
      const short = params.short_period ?? 5
      const long = params.long_period ?? 20
      const smaS = calcSMA(data.closes, short)
      const smaL = calcSMA(data.closes, long)
      if (smaS[prev] >= smaL[prev] && smaS[last] < smaL[last])
        return { signal: 'sell', memo: `${short}일선이 ${long}일선 하향 돌파` }
      return { signal: null, memo: `대기 중` }
    }
    case 'sma_support': {
      const period = params.period ?? 20
      const sma = calcSMA(data.closes, period)
      const touched = data.closes[prev] <= sma[prev] * 1.005
      const bounced = data.closes[last] > sma[last] * 1.005
      if (touched && bounced)
        return { signal: 'buy', memo: `${period}일선 지지 후 반등` }
      return { signal: null, memo: `대기 중` }
    }
    case 'sma_60_break': {
      const sma = calcSMA(data.closes, 60)
      if (data.closes[prev] >= sma[prev] && data.closes[last] < sma[last])
        return { signal: 'sell', memo: `60일선 하향 이탈` }
      return { signal: null, memo: `대기 중` }
    }

    // ── RSI ──
    case 'rsi_oversold': {
      const threshold = params.rsi_threshold ?? 30
      const rsi = calcRSI(data.closes)
      if (!isNaN(rsi[prev]) && !isNaN(rsi[last]) && rsi[prev] <= threshold && rsi[last] > threshold)
        return { signal: 'buy', memo: `RSI ${rsi[prev].toFixed(1)} → ${rsi[last].toFixed(1)} (${threshold} 상향 돌파)` }
      return { signal: null, memo: `RSI: ${rsi[last]?.toFixed(1) ?? '-'}` }
    }
    case 'rsi_overbought': {
      const threshold = params.rsi_threshold ?? 70
      const rsi = calcRSI(data.closes)
      if (!isNaN(rsi[prev]) && !isNaN(rsi[last]) && rsi[prev] >= threshold && rsi[last] < threshold)
        return { signal: 'sell', memo: `RSI ${rsi[prev].toFixed(1)} → ${rsi[last].toFixed(1)} (${threshold} 하향 돌파)` }
      return { signal: null, memo: `RSI: ${rsi[last]?.toFixed(1) ?? '-'}` }
    }

    // ── MACD ──
    case 'macd_cross_buy': {
      const { macd, signal } = calcMACD(data.closes)
      if (macd[prev] <= signal[prev] && macd[last] > signal[last])
        return { signal: 'buy', memo: `MACD 골든크로스` }
      return { signal: null, memo: `MACD: ${macd[last]?.toFixed(1)}, Signal: ${signal[last]?.toFixed(1)}` }
    }
    case 'macd_cross_sell': {
      const { macd, signal } = calcMACD(data.closes)
      if (macd[prev] >= signal[prev] && macd[last] < signal[last])
        return { signal: 'sell', memo: `MACD 데드크로스` }
      return { signal: null, memo: `대기 중` }
    }

    // ── 볼린저밴드 ──
    case 'bb_lower': {
      const period = params.period ?? 20
      const mult = params.std_dev ?? 2
      const { lower } = calcBollinger(data.closes, period, mult)
      if (data.closes[last] <= lower[last])
        return { signal: 'buy', memo: `볼린저 하단(${lower[last].toFixed(0)}) 터치, 현재가: ${data.currentPrice}` }
      return { signal: null, memo: `하단: ${lower[last]?.toFixed(0) ?? '-'}` }
    }
    case 'bb_upper': {
      const period = params.period ?? 20
      const mult = params.std_dev ?? 2
      const { upper } = calcBollinger(data.closes, period, mult)
      if (data.closes[last] >= upper[last])
        return { signal: 'sell', memo: `볼린저 상단(${upper[last].toFixed(0)}) 터치` }
      return { signal: null, memo: `상단: ${upper[last]?.toFixed(0) ?? '-'}` }
    }
    case 'bb_squeeze': {
      const period = params.period ?? 20
      const mult = params.std_dev ?? 2
      const { upper, lower } = calcBollinger(data.closes, period, mult)
      const widthPrev = (upper[prev] - lower[prev]) / data.closes[prev]
      const widthLast = (upper[last] - lower[last]) / data.closes[last]
      if (widthPrev < 0.04 && widthLast > widthPrev && data.closes[last] > upper[last])
        return { signal: 'buy', memo: `볼린저 스퀴즈 후 상단 돌파` }
      return { signal: null, memo: `밴드폭: ${(widthLast * 100).toFixed(1)}%` }
    }

    // ── 가격 기반 ──
    case 'target_buy': {
      const target = params.target_price
      if (!target) return { signal: null, memo: '목표가 미설정' }
      if (data.currentPrice <= target)
        return { signal: 'buy', memo: `현재가 ${data.currentPrice} ≤ 목표가 ${target}` }
      return { signal: null, memo: `현재가: ${data.currentPrice}, 목표가: ${target}` }
    }
    case 'target_sell': {
      const target = params.target_price
      if (!target) return { signal: null, memo: '목표가 미설정' }
      if (data.currentPrice >= target)
        return { signal: 'sell', memo: `현재가 ${data.currentPrice} ≥ 목표가 ${target}` }
      return { signal: null, memo: `현재가: ${data.currentPrice}, 목표가: ${target}` }
    }
    case 'stop_loss': {
      const lossPct = params.loss_pct ?? 5
      const avgPrice = params.avg_price
      if (!avgPrice) return { signal: null, memo: '매입단가 미설정' }
      const lossThreshold = avgPrice * (1 - lossPct / 100)
      if (data.currentPrice <= lossThreshold)
        return { signal: 'sell', memo: `손절 발동: 현재가 ${data.currentPrice} ≤ ${lossThreshold.toFixed(0)} (매입가 ${avgPrice} 대비 -${lossPct}%)` }
      return { signal: null, memo: `손절가: ${lossThreshold.toFixed(0)}` }
    }
    case 'trailing_stop': {
      const trailPct = params.trail_pct ?? 3
      const highestClose = Math.max(...data.closes.slice(-20))
      const trailPrice = highestClose * (1 - trailPct / 100)
      if (data.currentPrice <= trailPrice)
        return { signal: 'sell', memo: `트레일링 스탑: 고점 ${highestClose} 대비 -${trailPct}% = ${trailPrice.toFixed(0)}` }
      return { signal: null, memo: `고점: ${highestClose}, 트레일링가: ${trailPrice.toFixed(0)}` }
    }

    // ── 거래량 ──
    case 'volume_surge': {
      const ratio = params.volume_ratio ?? 3
      const avgVol = data.volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
      const lastVol = data.volumes[last]
      const isUp = data.closes[last] > data.closes[prev]
      if (lastVol > avgVol * ratio && isUp)
        return { signal: 'buy', memo: `거래량 ${(lastVol / avgVol).toFixed(1)}배 급증 + 양봉` }
      return { signal: null, memo: `거래량비: ${(lastVol / avgVol).toFixed(1)}배` }
    }
    case 'volume_dry': {
      const ratio = params.volume_ratio ?? 0.3
      const avgVol = data.volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
      const lastVol = data.volumes[last]
      const isDown = data.closes[last] < data.closes[prev]
      if (lastVol < avgVol * ratio && isDown)
        return { signal: 'sell', memo: `거래량 고갈 (${(lastVol / avgVol * 100).toFixed(0)}%) + 음봉` }
      return { signal: null, memo: `대기 중` }
    }

    // ── 분할매매 ──
    case 'grid_buy': {
      const stepPct = params.step_pct ?? 3
      const basePrice = params.base_price ?? data.closes[0]
      const pctDrop = ((basePrice - data.currentPrice) / basePrice) * 100
      const steps = Math.floor(pctDrop / stepPct)
      if (steps > 0 && pctDrop % stepPct < 1)
        return { signal: 'buy', memo: `기준가 대비 -${pctDrop.toFixed(1)}% (${steps}단계 매수)` }
      return { signal: null, memo: `기준가: ${basePrice}, 하락률: ${pctDrop.toFixed(1)}%` }
    }
    case 'pyramid_sell': {
      const stepPct = params.step_pct ?? 5
      const basePrice = params.base_price ?? data.closes[0]
      const pctUp = ((data.currentPrice - basePrice) / basePrice) * 100
      const steps = Math.floor(pctUp / stepPct)
      if (steps > 0 && pctUp % stepPct < 1)
        return { signal: 'sell', memo: `기준가 대비 +${pctUp.toFixed(1)}% (${steps}단계 매도)` }
      return { signal: null, memo: `기준가: ${basePrice}, 상승률: ${pctUp.toFixed(1)}%` }
    }

    // ── 복합 ──
    case 'triple_screen': {
      const sma60 = calcSMA(data.closes, 60)
      const trendUp = sma60[last] > sma60[prev]
      const { macd, signal } = calcMACD(data.closes)
      const macdBuy = macd[prev] <= signal[prev] && macd[last] > signal[last]
      const rsi = calcRSI(data.closes)
      const rsiBounce = rsi[prev] < 40 && rsi[last] > rsi[prev]
      if (trendUp && macdBuy && rsiBounce)
        return { signal: 'buy', memo: `3중 필터 충족: 추세상승 + MACD골든 + RSI반등(${rsi[last].toFixed(1)})` }
      return { signal: null, memo: `추세: ${trendUp ? '↑' : '↓'}, MACD: ${macdBuy ? '매수' : '-'}, RSI: ${rsi[last]?.toFixed(1)}` }
    }
    case 'mean_reversion': {
      const { upper, lower, middle } = calcBollinger(data.closes, 20, 2)
      if (data.closes[last] <= lower[last])
        return { signal: 'buy', memo: `하단 이탈 → 평균 회귀 매수 (중심: ${middle[last].toFixed(0)})` }
      if (data.closes[last] >= upper[last])
        return { signal: 'sell', memo: `상단 이탈 → 평균 회귀 매도 (중심: ${middle[last].toFixed(0)})` }
      return { signal: null, memo: `밴드 내 대기 중` }
    }

    default:
      return { signal: null, memo: `알 수 없는 조건: ${conditionType}` }
  }
}

// ─── 주문 실행 ──────────────────────────────────────────────

async function placeOrder(symbol: string, orderType: 'buy' | 'sell', qty: number, price: number, method: string) {
  const mode = getMode()
  const acctNo = Deno.env.get('KIS_ACCOUNT_NO') ?? ''
  const prodCode = Deno.env.get('KIS_ACCOUNT_PRODUCT_CODE') ?? '01'
  const cano = acctNo.replace(/-/g, '').substring(0, 8)
  const acntPrdtCd = acctNo.replace(/-/g, '').substring(8, 10) || prodCode

  const trId = orderType === 'buy'
    ? (mode === 'real' ? 'TTTC0802U' : 'VTTC0802U')
    : (mode === 'real' ? 'TTTC0801U' : 'VTTC0801U')

  const ordDvsn = method === 'market' ? '01' : '00'

  const data = await callKis({
    method: 'POST',
    path: '/uapi/domestic-stock/v1/trading/order-cash',
    trId,
    body: {
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      PDNO: symbol,
      ORD_DVSN: ordDvsn,
      ORD_QTY: String(qty),
      ORD_UNPR: ordDvsn === '01' ? '0' : String(price),
    },
  })
  return data
}

// ─── 메인 엔진 ──────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(supabaseUrl, serviceKey)

  const results: unknown[] = []

  try {
    // 1. running 상태 전략 조회
    const { data: strategies, error } = await db
      .from('stock_strategies')
      .select('*')
      .eq('status', 'running')
      .not('condition_type', 'is', null)

    if (error) throw error
    if (!strategies || strategies.length === 0) {
      return new Response(JSON.stringify({ message: '실행 중인 전략 없음', results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 종목별 시세를 한번만 조회하도록 캐싱
    const priceCache = new Map<string, { daily: DailyPrice[]; current: number }>()

    for (const strategy of strategies) {
      const { id, symbol, condition_type, condition_params, qty, order_method, type, user_id, household_id } = strategy

      try {
        // 2. 시세 조회 (캐시 활용)
        if (!priceCache.has(symbol)) {
          const [daily, current] = await Promise.all([
            fetchDailyPrices(symbol),
            fetchCurrentPrice(symbol),
          ])
          priceCache.set(symbol, { daily, current })
        }
        const cached = priceCache.get(symbol)!
        const closes = cached.daily.map(d => d.close).reverse()
        const volumes = cached.daily.map(d => d.volume).reverse()

        // 3. 조건 판단
        const { signal, memo } = evaluate(condition_type, condition_params ?? {}, {
          closes,
          currentPrice: cached.current,
          volumes,
        })

        // 로그 기록
        await db.from('stock_trade_logs').insert({
          strategy_id: id,
          user_id,
          symbol,
          action: signal ? `signal_${signal}` : 'check',
          detail: { memo, signal, current_price: cached.current, condition_type },
        })

        if (!signal) {
          results.push({ strategy: id, symbol, signal: null, memo })
          continue
        }

        // type 필터: buy 전략은 sell 시그널 무시, sell 전략은 buy 시그널 무시
        if (type === 'buy' && signal !== 'buy') { results.push({ strategy: id, signal, skipped: 'type mismatch' }); continue }
        if (type === 'sell' && signal !== 'sell') { results.push({ strategy: id, signal, skipped: 'type mismatch' }); continue }

        // 같은 날 이미 주문했으면 스킵 (중복 방지)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const { data: existingOrders } = await db
          .from('stock_orders')
          .select('id')
          .eq('strategy_id', id)
          .gte('ordered_at', todayStart.toISOString())
          .limit(1)

        if (existingOrders && existingOrders.length > 0) {
          results.push({ strategy: id, signal, skipped: '오늘 이미 주문 실행됨' })
          continue
        }

        // 4. 주문 실행
        const orderQty = qty ?? 1
        const orderResult = await placeOrder(symbol, signal, orderQty, cached.current, order_method ?? 'market')

        const orderSuccess = orderResult.rt_cd === '0'
        const kisOrderNo = orderResult.output?.ODNO ?? orderResult.output?.odno ?? null

        // 5. 주문 이력 저장
        const { data: orderRow } = await db.from('stock_orders').insert({
          user_id,
          household_id,
          strategy_id: id,
          symbol,
          order_type: signal,
          order_method: order_method ?? 'market',
          qty: orderQty,
          price: cached.current,
          status: orderSuccess ? 'filled' : 'failed',
          kis_order_no: kisOrderNo,
          error: orderSuccess ? null : (orderResult.msg1 ?? '주문 실패'),
          trigger_memo: memo,
          filled_at: orderSuccess ? new Date().toISOString() : null,
        }).select('id').single()

        // 전략에 마지막 시그널 시각 업데이트
        await db.from('stock_strategies').update({
          last_signal_at: new Date().toISOString(),
          last_order_id: orderRow?.id ?? null,
        }).eq('id', id)

        results.push({
          strategy: id,
          symbol,
          signal,
          memo,
          order: orderSuccess ? 'success' : 'failed',
          kis_order_no: kisOrderNo,
          qty: orderQty,
          price: cached.current,
        })

      } catch (strategyErr) {
        const errMsg = (strategyErr as Error).message
        await db.from('stock_trade_logs').insert({
          strategy_id: id,
          user_id,
          symbol,
          action: 'error',
          detail: { error: errMsg },
        })
        results.push({ strategy: id, error: errMsg })
      }
    }

    return new Response(JSON.stringify({ message: `${strategies.length}개 전략 처리 완료`, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
