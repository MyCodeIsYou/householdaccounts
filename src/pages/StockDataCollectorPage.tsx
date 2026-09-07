import { useState, useCallback } from 'react'
import { Database, Download, Clock, CheckCircle2, AlertCircle, Plus, Trash2, RefreshCw, Play, X, Filter, Search, Loader2, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { useKisStatus } from '@/hooks/useKis'
import { kisApi } from '@/lib/kis'
import type { KisDailyPrice, KisFinancialRatio, KisInvestorTrend, KisRankItem } from '@/lib/kis'

// ─── 공통 유틸 ──────────────────────────────────────────────

type JobType = 'daily_price' | 'financial' | 'investor'
type CollectionJob = {
  id: string; name: string; type: JobType; symbols: string[]
  status: 'idle' | 'running' | 'completed' | 'error'
  lastRun: string | null; error: string | null; data: unknown[] | null
}

const TYPE_LABELS: Record<JobType, string> = { daily_price: '일별 시세', financial: '재무제표', investor: '투자자별 매매동향' }
const TYPE_COLORS: Record<JobType, string> = { daily_price: 'bg-blue-50 text-blue-600', financial: 'bg-purple-50 text-purple-600', investor: 'bg-amber-50 text-amber-600' }

function fmtKrw(val: string | number | undefined) {
  if (val === undefined || val === '') return '-'
  const n = Number(val)
  if (Number.isNaN(n)) return String(val)
  return n.toLocaleString('ko-KR')
}

// ─── 기술적 지표 계산 유틸 ──────────────────────────────────

function calcEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return []
  const k = 2 / (period + 1)
  const ema = [prices[0]]
  for (let i = 1; i < prices.length; i++) ema.push(prices[i] * k + ema[i - 1] * (1 - k))
  return ema
}

function calcSMA(prices: number[], period: number): number[] {
  const sma: number[] = []
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { sma.push(NaN); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += prices[j]
    sma.push(sum / period)
  }
  return sma
}

function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null
  let gainSum = 0, lossSum = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i - 1] - prices[i]
    if (diff > 0) gainSum += diff; else lossSum -= diff
  }
  let avgGain = gainSum / period, avgLoss = lossSum / period
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i - 1] - prices[i]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

function calcMACD(prices: number[]): { macd: number; signal: number; hist: number } | null {
  if (prices.length < 35) return null
  const rev = [...prices].reverse()
  const ema12 = calcEMA(rev, 12)
  const ema26 = calcEMA(rev, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i]).slice(25)
  const signal = calcEMA(macdLine, 9)
  const last = macdLine.length - 1
  if (last < 0 || signal.length === 0) return null
  return { macd: macdLine[last], signal: signal[signal.length - 1], hist: macdLine[last] - signal[signal.length - 1] }
}

function calcBollinger(prices: number[], period = 20): { upper: number; middle: number; lower: number; pctB: number } | null {
  if (prices.length < period) return null
  const rev = [...prices].reverse()
  const slice = rev.slice(rev.length - period)
  const mean = slice.reduce((s, v) => s + v, 0) / period
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
  const upper = mean + 2 * std, lower = mean - 2 * std
  const cur = rev[rev.length - 1]
  return { upper, middle: mean, lower, pctB: std === 0 ? 50 : ((cur - lower) / (upper - lower)) * 100 }
}

function calcStochastic(highs: number[], lows: number[], closes: number[], period = 14): { k: number; d: number } | null {
  if (closes.length < period + 2) return null
  const kValues: number[] = []
  for (let i = 0; i <= 2; i++) {
    const start = i, end = i + period
    const sliceH = highs.slice(start, end)
    const sliceL = lows.slice(start, end)
    const hh = Math.max(...sliceH), ll = Math.min(...sliceL)
    kValues.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100)
  }
  return { k: kValues[0], d: kValues.reduce((s, v) => s + v, 0) / kValues.length }
}

interface TechnicalIndicators {
  rsi: number | null
  ma5: number | null
  ma20: number | null
  ma60: number | null
  macd: number | null
  macdSignal: number | null
  macdHist: number | null
  bollingerPctB: number | null
  stochK: number | null
  stochD: number | null
  volRatio: number | null
  high52w: boolean
  low52w: boolean
  consecutiveUp: number
  disparity20: number | null
}

function calcTechnicals(dailyPrices: KisDailyPrice[]): TechnicalIndicators {
  const closes = dailyPrices.map(d => Number(d.stck_clpr)).filter(n => !isNaN(n) && n > 0)
  const highs = dailyPrices.map(d => Number(d.stck_hgpr)).filter(n => !isNaN(n) && n > 0)
  const lows = dailyPrices.map(d => Number(d.stck_lwpr)).filter(n => !isNaN(n) && n > 0)
  const vols = dailyPrices.map(d => Number(d.acml_vol)).filter(n => !isNaN(n))

  const rev = [...closes].reverse()
  const sma5 = calcSMA(rev, 5)
  const sma20 = calcSMA(rev, 20)
  const sma60 = calcSMA(rev, 60)
  const last = rev.length - 1

  const macd = calcMACD(closes)
  const bollinger = calcBollinger(closes)
  const stoch = calcStochastic(highs, lows, closes)

  let volRatio: number | null = null
  if (vols.length >= 21) {
    const avg20 = vols.slice(1, 21).reduce((s, v) => s + v, 0) / 20
    volRatio = avg20 > 0 ? vols[0] / avg20 : null
  }

  const high52 = closes.length > 0 && closes[0] >= Math.max(...closes.slice(0, Math.min(closes.length, 250)))
  const low52 = closes.length > 0 && closes[0] <= Math.min(...closes.slice(0, Math.min(closes.length, 250)))

  let consecutiveUp = 0
  for (let i = 0; i < closes.length - 1; i++) {
    if (closes[i] > closes[i + 1]) consecutiveUp++; else break
  }

  return {
    rsi: calcRSI(closes),
    ma5: last >= 4 ? sma5[last] : null,
    ma20: last >= 19 ? sma20[last] : null,
    ma60: last >= 59 ? sma60[last] : null,
    macd: macd?.macd ?? null,
    macdSignal: macd?.signal ?? null,
    macdHist: macd?.hist ?? null,
    bollingerPctB: bollinger?.pctB ?? null,
    stochK: stoch?.k ?? null,
    stochD: stoch?.d ?? null,
    volRatio,
    high52w: high52,
    low52w: low52,
    consecutiveUp,
    disparity20: last >= 19 && sma20[last] > 0 ? (rev[last] / sma20[last]) * 100 : null,
  }
}

// ─── 조건검색 스크리너 ──────────────────────────────────────

type ScreenerMode = 'volume' | 'rise' | 'fall'
type MarketFilter = '' | 'J' | 'Q'

interface ScreenerFilters {
  mode: ScreenerMode
  market: MarketFilter
  priceMin: string
  priceMax: string
  volMin: string
}

interface SecondaryFilters {
  enabled: boolean
  rsiMin: string; rsiMax: string
  roeMin: string; epsMin: string
  perMin: string; perMax: string
  pbrMin: string; pbrMax: string
  salesGrowthMin: string; opProfitGrowthMin: string; netProfitGrowthMin: string
  debtRatioMax: string
  foreignNetBuy: boolean; institutionNetBuy: boolean
  foreignConsecMin: string; institutionConsecMin: string
  macdBullish: boolean
  goldenCross: boolean
  bollingerLower: boolean
  stochOversold: boolean
  volRatioMin: string
  high52w: boolean; low52w: boolean
  consecutiveUpMin: string
  disparityMin: string; disparityMax: string
}

interface EnrichedStock {
  rank: KisRankItem
  tech: TechnicalIndicators | null
  roe: string | null; eps: string | null; bps: string | null
  per: number | null; pbr: number | null
  salesGrowth: string | null; opProfitGrowth: string | null
  netProfitGrowth: string | null; debtRatio: string | null; reserveRate: string | null
  foreignNet: number | null; institutionNet: number | null
  foreignConsec: number; institutionConsec: number
  loading: boolean; error: string | null
}

const MODE_CONFIG: Record<ScreenerMode, { label: string; icon: typeof BarChart3; color: string }> = {
  volume: { label: '거래량 상위', icon: BarChart3, color: 'bg-blue-600' },
  rise:   { label: '상승률 상위', icon: TrendingUp, color: 'bg-red-600' },
  fall:   { label: '하락률 상위', icon: TrendingDown, color: 'bg-blue-600' },
}

const DEFAULT_SECONDARY: SecondaryFilters = {
  enabled: false,
  rsiMin: '', rsiMax: '', roeMin: '', epsMin: '',
  perMin: '', perMax: '', pbrMin: '', pbrMax: '',
  salesGrowthMin: '', opProfitGrowthMin: '', netProfitGrowthMin: '',
  debtRatioMax: '',
  foreignNetBuy: false, institutionNetBuy: false,
  foreignConsecMin: '', institutionConsecMin: '',
  macdBullish: false, goldenCross: false, bollingerLower: false, stochOversold: false,
  volRatioMin: '', high52w: false, low52w: false,
  consecutiveUpMin: '', disparityMin: '', disparityMax: '',
}

function ScreenerPanel({ connected }: { connected: boolean }) {
  const [filters, setFilters] = useState<ScreenerFilters>({
    mode: 'volume', market: '', priceMin: '', priceMax: '', volMin: '',
  })
  const [secondary, setSecondary] = useState<SecondaryFilters>(DEFAULT_SECONDARY)
  const [results, setResults] = useState<KisRankItem[]>([])
  const [enriched, setEnriched] = useState<Map<string, EnrichedStock>>(new Map())
  const [searching, setSearching] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string>('data_rank')
  const [sortAsc, setSortAsc] = useState(true)
  const [tablePage, setTablePage] = useState(0)
  const PAGE_SIZE = 30

  const runSearch = async () => {
    setSearching(true)
    setResults([])
    setEnriched(new Map())
    setSearched(false)
    setError(null)
    try {
      const markets = filters.market ? [filters.market] : ['J', 'Q']

      const priceRanges: [string, string][] = []
      if (filters.priceMin || filters.priceMax) {
        priceRanges.push([filters.priceMin, filters.priceMax])
      } else {
        priceRanges.push(
          ['', '5000'],
          ['5000', '10000'],
          ['10000', '30000'],
          ['30000', '100000'],
          ['100000', '500000'],
          ['500000', ''],
        )
      }

      const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
      const seen = new Set<string>()
      const allItems: KisRankItem[] = []

      for (const market of markets) {
        for (const [pMin, pMax] of priceRanges) {
          try {
            const params = { market, price_min: pMin, price_max: pMax, vol_min: filters.volMin }
            let items: KisRankItem[]
            if (filters.mode === 'volume') {
              items = await kisApi.volumeRank(params)
            } else {
              items = await kisApi.fluctuationRank({ ...params, sort_dir: filters.mode === 'rise' ? '0' : '1' })
            }
            for (const item of items) {
              if (!seen.has(item.mksc_shrn_iscd)) {
                seen.add(item.mksc_shrn_iscd)
                allItems.push(item)
              }
            }
          } catch (_) { /* skip failed range */ }
          await delay(300)
        }
      }

      if (filters.mode === 'volume') {
        allItems.sort((a, b) => Number(b.acml_vol) - Number(a.acml_vol))
      } else {
        const dir = filters.mode === 'rise' ? -1 : 1
        allItems.sort((a, b) => dir * (Number(a.prdy_ctrt) - Number(b.prdy_ctrt)))
      }
      allItems.forEach((item, i) => { item.data_rank = String(i + 1) })

      console.log(`[Screener] 총 ${allItems.length}개 종목 (${markets.join('+')} × ${priceRanges.length}구간)`)
      setResults(allItems)
      setSearched(true)
      setSortKey('data_rank')
      setSortAsc(true)
      setTablePage(0)

      if (secondary.enabled && allItems.length > 0) {
        await enrichStocks(allItems)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const enrichStocks = async (stocks: KisRankItem[]) => {
    setEnriching(true)
    const empty: EnrichedStock = {
      rank: {} as KisRankItem, tech: null,
      roe: null, eps: null, bps: null, per: null, pbr: null,
      salesGrowth: null, opProfitGrowth: null, netProfitGrowth: null,
      debtRatio: null, reserveRate: null,
      foreignNet: null, institutionNet: null, foreignConsec: 0, institutionConsec: 0,
      loading: true, error: null,
    }
    const map = new Map<string, EnrichedStock>()
    stocks.forEach(r => map.set(r.mksc_shrn_iscd, { ...empty, rank: r }))
    setEnriched(new Map(map))

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i]
      if (i > 0) await delay(600)
      const code = stock.mksc_shrn_iscd
      const entry = map.get(code)!
      try {
        const dailyPrices = await kisApi.dailyPrices(code).catch(() => null)
        await delay(600)
        const financials = await kisApi.financialRatio(code).catch(() => null)
        await delay(600)
        const investors = await kisApi.investorTrend(code).catch(() => null)

        if (Array.isArray(dailyPrices) && dailyPrices.length > 0) {
          entry.tech = calcTechnicals(dailyPrices)
        }

        const curPrice = Number(stock.stck_prpr)
        if (Array.isArray(financials) && financials.length > 0) {
          const f = financials[0] as KisFinancialRatio
          entry.roe = f.roe_val; entry.eps = f.eps; entry.bps = f.bps
          entry.salesGrowth = f.grs; entry.opProfitGrowth = f.bsop_prfi_inrt
          entry.netProfitGrowth = f.ntin_inrt; entry.debtRatio = f.lblt_rate
          entry.reserveRate = f.rsrv_rate
          const epsVal = Number(f.eps); const bpsVal = Number(f.bps)
          entry.per = epsVal > 0 ? curPrice / epsVal : null
          entry.pbr = bpsVal > 0 ? curPrice / bpsVal : null
        }

        if (Array.isArray(investors) && investors.length > 0) {
          const inv = investors as KisInvestorTrend[]
          entry.foreignNet = inv.reduce((s, d) => s + Number(d.frgn_ntby_qty || 0), 0)
          entry.institutionNet = inv.reduce((s, d) => s + Number(d.orgn_ntby_qty || 0), 0)
          let fc = 0; for (const d of inv) { if (Number(d.frgn_ntby_qty || 0) > 0) fc++; else break }
          let ic = 0; for (const d of inv) { if (Number(d.orgn_ntby_qty || 0) > 0) ic++; else break }
          entry.foreignConsec = fc; entry.institutionConsec = ic
        }
        entry.loading = false
      } catch (e) {
        entry.loading = false
        entry.error = (e as Error).message
      }
      map.set(code, { ...entry })
      setEnriched(new Map(map))
    }
    setEnriching(false)
  }

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'hts_kor_isnm') }
  }

  const filteredResults = results.filter(r => {
    if (!secondary.enabled || enriched.size === 0) return true
    const e = enriched.get(r.mksc_shrn_iscd)
    if (!e || e.loading) return true
    const t = e.tech
    if (secondary.rsiMin && t?.rsi != null && t.rsi < Number(secondary.rsiMin)) return false
    if (secondary.rsiMax && t?.rsi != null && t.rsi > Number(secondary.rsiMax)) return false
    if (secondary.roeMin && e.roe && Number(e.roe) < Number(secondary.roeMin)) return false
    if (secondary.epsMin && e.eps && Number(e.eps) < Number(secondary.epsMin)) return false
    if (secondary.perMin && e.per != null && e.per < Number(secondary.perMin)) return false
    if (secondary.perMax && e.per != null && e.per > Number(secondary.perMax)) return false
    if (secondary.pbrMin && e.pbr != null && e.pbr < Number(secondary.pbrMin)) return false
    if (secondary.pbrMax && e.pbr != null && e.pbr > Number(secondary.pbrMax)) return false
    if (secondary.salesGrowthMin && e.salesGrowth && Number(e.salesGrowth) < Number(secondary.salesGrowthMin)) return false
    if (secondary.opProfitGrowthMin && e.opProfitGrowth && Number(e.opProfitGrowth) < Number(secondary.opProfitGrowthMin)) return false
    if (secondary.netProfitGrowthMin && e.netProfitGrowth && Number(e.netProfitGrowth) < Number(secondary.netProfitGrowthMin)) return false
    if (secondary.debtRatioMax && e.debtRatio && Number(e.debtRatio) > Number(secondary.debtRatioMax)) return false
    if (secondary.foreignNetBuy && e.foreignNet != null && e.foreignNet <= 0) return false
    if (secondary.institutionNetBuy && e.institutionNet != null && e.institutionNet <= 0) return false
    if (secondary.foreignConsecMin && e.foreignConsec < Number(secondary.foreignConsecMin)) return false
    if (secondary.institutionConsecMin && e.institutionConsec < Number(secondary.institutionConsecMin)) return false
    if (secondary.macdBullish && t && (t.macdHist == null || t.macdHist <= 0)) return false
    if (secondary.goldenCross && t && (t.ma5 == null || t.ma20 == null || t.ma5 <= t.ma20)) return false
    if (secondary.bollingerLower && t && (t.bollingerPctB == null || t.bollingerPctB > 20)) return false
    if (secondary.stochOversold && t && (t.stochK == null || t.stochK > 20)) return false
    if (secondary.volRatioMin && t?.volRatio != null && t.volRatio < Number(secondary.volRatioMin)) return false
    if (secondary.high52w && t && !t.high52w) return false
    if (secondary.low52w && t && !t.low52w) return false
    if (secondary.consecutiveUpMin && t && t.consecutiveUp < Number(secondary.consecutiveUpMin)) return false
    if (secondary.disparityMin && t?.disparity20 != null && t.disparity20 < Number(secondary.disparityMin)) return false
    if (secondary.disparityMax && t?.disparity20 != null && t.disparity20 > Number(secondary.disparityMax)) return false
    return true
  })

  const getEnrichedVal = (e: EnrichedStock | undefined, key: string): number => {
    if (!e) return 0
    switch (key) {
      case 'rsi': return e.tech?.rsi ?? 0
      case 'roe': return Number(e.roe ?? 0)
      case 'per': return e.per ?? 9999
      case 'pbr': return e.pbr ?? 9999
      case 'foreignNet': return e.foreignNet ?? 0
      case 'institutionNet': return e.institutionNet ?? 0
      default: return 0
    }
  }

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortKey === 'hts_kor_isnm') return sortAsc ? a.hts_kor_isnm.localeCompare(b.hts_kor_isnm) : b.hts_kor_isnm.localeCompare(a.hts_kor_isnm)
    if (['rsi', 'roe', 'per', 'pbr', 'foreignNet', 'institutionNet'].includes(sortKey)) {
      const va = getEnrichedVal(enriched.get(a.mksc_shrn_iscd), sortKey)
      const vb = getEnrichedVal(enriched.get(b.mksc_shrn_iscd), sortKey)
      return sortAsc ? va - vb : vb - va
    }
    const av = Number((a as unknown as Record<string, string>)[sortKey] || '0')
    const bv = Number((b as unknown as Record<string, string>)[sortKey] || '0')
    return sortAsc ? av - bv : bv - av
  })

  const updateFilter = (patch: Partial<ScreenerFilters>) => setFilters(f => ({ ...f, ...patch }))
  const updateSecondary = (patch: Partial<SecondaryFilters>) => setSecondary(f => ({ ...f, ...patch }))

  const modeConf = MODE_CONFIG[filters.mode]

  const RangeInput = ({ label, unit, minKey, maxKey, minVal, maxVal }: {
    label: string; unit: string; minKey: string; maxKey: string; minVal: string; maxVal: string
  }) => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label} ({unit})</label>
      <div className="flex items-center gap-2">
        <input type="text" inputMode="numeric" placeholder="최소" value={minVal}
          onChange={e => updateSecondary({ [minKey]: e.target.value.replace(/[^0-9.-]/g, '') })}
          className="flex-1 px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right" />
        <span className="text-gray-400 text-xs">~</span>
        <input type="text" inputMode="numeric" placeholder="최대" value={maxVal}
          onChange={e => updateSecondary({ [maxKey]: e.target.value.replace(/[^0-9.-]/g, '') })}
          className="flex-1 px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right" />
      </div>
    </div>
  )

  const MinInput = ({ label, unit, stateKey, val }: { label: string; unit: string; stateKey: string; val: string }) => (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label} ({unit})</label>
      <input type="text" inputMode="numeric" placeholder={`최소`} value={val}
        onChange={e => updateSecondary({ [stateKey]: e.target.value.replace(/[^0-9.-]/g, '') })}
        className="w-full px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 검색 모드 선택 */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(MODE_CONFIG) as [ScreenerMode, typeof modeConf][]).map(([key, conf]) => {
          const active = filters.mode === key
          return (
            <button key={key} onClick={() => updateFilter({ mode: key })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
              <div className={`w-8 h-8 rounded-lg ${conf.color} flex items-center justify-center`}>
                <conf.icon className="h-4 w-4 text-white" />
              </div>
              <span className={`text-xs font-semibold ${active ? 'text-indigo-700' : 'text-gray-600'}`}>{conf.label}</span>
            </button>
          )
        })}
      </div>

      {/* 1차 필터 조건 */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-indigo-500" />
          1차 조건 (순위 API)
        </h3>

        <div>
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">시장</label>
          <div className="flex gap-1.5">
            {([['', '전체'], ['J', '코스피'], ['Q', '코스닥']] as [MarketFilter, string][]).map(([val, label]) => (
              <button key={val} onClick={() => updateFilter({ market: val })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filters.market === val ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">가격 범위 (원)</label>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" placeholder="최소" value={filters.priceMin}
              onChange={e => updateFilter({ priceMin: e.target.value.replace(/[^0-9]/g, '') })}
              className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right" />
            <span className="text-gray-400 text-sm">~</span>
            <input type="text" inputMode="numeric" placeholder="최대" value={filters.priceMax}
              onChange={e => updateFilter({ priceMax: e.target.value.replace(/[^0-9]/g, '') })}
              className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">최소 거래량 (주)</label>
          <input type="text" inputMode="numeric" placeholder="예: 100000" value={filters.volMin}
            onChange={e => updateFilter({ volMin: e.target.value.replace(/[^0-9]/g, '') })}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right" />
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">빠른 설정</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '1만원 이하 소형주', priceMin: '', priceMax: '10000', volMin: '100000' },
              { label: '1~5만원 중형주', priceMin: '10000', priceMax: '50000', volMin: '50000' },
              { label: '5만원 이상 대형주', priceMin: '50000', priceMax: '', volMin: '10000' },
              { label: '거래량 폭발', priceMin: '', priceMax: '', volMin: '1000000' },
            ].map(preset => (
              <button key={preset.label}
                onClick={() => updateFilter({ priceMin: preset.priceMin, priceMax: preset.priceMax, volMin: preset.volMin })}
                className="px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2차 필터 조건 (상세 분석) */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-purple-500" />
            2차 조건 (상세 분석)
          </h3>
          <button
            onClick={() => updateSecondary({ enabled: !secondary.enabled })}
            className={`relative w-10 h-5 rounded-full transition-colors ${secondary.enabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${secondary.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {secondary.enabled && (
          <div className="space-y-4 pt-1">
            <p className="text-[11px] text-gray-400">1차 결과 종목별로 재무/기술 지표를 조회하여 2차 필터링합니다.</p>

            {/* 기술적 지표 */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">기술적 지표</h4>
              <RangeInput label="RSI (14일)" unit="0~100" minKey="rsiMin" maxKey="rsiMax" minVal={secondary.rsiMin} maxVal={secondary.rsiMax} />
              <div className="grid grid-cols-2 gap-2">
                <MinInput label="거래량비율" unit="배" stateKey="volRatioMin" val={secondary.volRatioMin} />
                <MinInput label="연속상승" unit="일" stateKey="consecutiveUpMin" val={secondary.consecutiveUpMin} />
              </div>
              <RangeInput label="이격도 (20일)" unit="%" minKey="disparityMin" maxKey="disparityMax" minVal={secondary.disparityMin} maxVal={secondary.disparityMax} />
              <div className="flex flex-wrap gap-2">
                {([
                  ['macdBullish', 'MACD 매수신호'],
                  ['goldenCross', '골든크로스 (5>20)'],
                  ['bollingerLower', '볼린저 하단'],
                  ['stochOversold', '스토캐스틱 과매도'],
                  ['high52w', '52주 신고가'],
                  ['low52w', '52주 신저가'],
                ] as [keyof SecondaryFilters, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={secondary[key] as boolean}
                      onChange={ev => updateSecondary({ [key]: ev.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                    <span className="text-gray-600">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 재무 지표 */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">재무 지표</h4>
              <div className="grid grid-cols-2 gap-2">
                <MinInput label="ROE" unit="%" stateKey="roeMin" val={secondary.roeMin} />
                <MinInput label="EPS" unit="원" stateKey="epsMin" val={secondary.epsMin} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RangeInput label="PER" unit="배" minKey="perMin" maxKey="perMax" minVal={secondary.perMin} maxVal={secondary.perMax} />
                <RangeInput label="PBR" unit="배" minKey="pbrMin" maxKey="pbrMax" minVal={secondary.pbrMin} maxVal={secondary.pbrMax} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MinInput label="매출증가율" unit="%" stateKey="salesGrowthMin" val={secondary.salesGrowthMin} />
                <MinInput label="영업이익증가율" unit="%" stateKey="opProfitGrowthMin" val={secondary.opProfitGrowthMin} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MinInput label="순이익증가율" unit="%" stateKey="netProfitGrowthMin" val={secondary.netProfitGrowthMin} />
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">부채비율 최대 (%)</label>
                  <input type="text" inputMode="numeric" placeholder="최대" value={secondary.debtRatioMax}
                    onChange={ev => updateSecondary({ debtRatioMax: ev.target.value.replace(/[^0-9.-]/g, '') })}
                    className="w-full px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right" />
                </div>
              </div>
            </div>

            {/* 수급 지표 */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">수급 지표</h4>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={secondary.foreignNetBuy}
                    onChange={ev => updateSecondary({ foreignNetBuy: ev.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-gray-600">외국인 순매수</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={secondary.institutionNetBuy}
                    onChange={ev => updateSecondary({ institutionNetBuy: ev.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-gray-600">기관 순매수</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MinInput label="외인 연속매수" unit="일" stateKey="foreignConsecMin" val={secondary.foreignConsecMin} />
                <MinInput label="기관 연속매수" unit="일" stateKey="institutionConsecMin" val={secondary.institutionConsecMin} />
              </div>
            </div>

            {/* 전략 프리셋 */}
            <div>
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">전략 프리셋</h4>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '과매도 반등', ...DEFAULT_SECONDARY, enabled: true, rsiMax: '30' },
                  { label: '우량 성장주', ...DEFAULT_SECONDARY, enabled: true, rsiMin: '40', rsiMax: '70', roeMin: '10', salesGrowthMin: '5', opProfitGrowthMin: '5' },
                  { label: '외인+기관 매집', ...DEFAULT_SECONDARY, enabled: true, foreignNetBuy: true, institutionNetBuy: true, foreignConsecMin: '3' },
                  { label: '저PER 가치주', ...DEFAULT_SECONDARY, enabled: true, perMin: '0', perMax: '10', pbrMax: '1', roeMin: '5' },
                  { label: 'MACD 골든', ...DEFAULT_SECONDARY, enabled: true, macdBullish: true, goldenCross: true },
                  { label: '볼린저 반등', ...DEFAULT_SECONDARY, enabled: true, bollingerLower: true, stochOversold: true, rsiMax: '35' },
                  { label: '거래량 폭발+수급', ...DEFAULT_SECONDARY, enabled: true, volRatioMin: '3', foreignNetBuy: true },
                  { label: '신고가 돌파', ...DEFAULT_SECONDARY, enabled: true, high52w: true, volRatioMin: '1.5' },
                ].map(preset => (
                  <button key={preset.label}
                    onClick={() => { const { label: _, ...rest } = preset; updateSecondary(rest) }}
                    className="px-2.5 py-1 rounded-full bg-purple-50 text-[11px] font-medium text-purple-600 hover:bg-purple-100 transition-colors">
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 검색 버튼 */}
      <button onClick={runSearch} disabled={!connected || searching}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {searching ? '검색 중...' : `${modeConf.label} 검색`}
      </button>

      {!connected && <p className="text-xs text-amber-600 text-center">KIS API 연결이 필요합니다.</p>}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        </div>
      )}

      {/* 상세 분석 진행 상태 */}
      {enriching && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
          <p className="text-xs text-purple-700">
            종목별 상세 분석 중... ({[...enriched.values()].filter(e => !e.loading).length}/{enriched.size})
          </p>
        </div>
      )}

      {/* 결과 테이블 */}
      {!searching && searched && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              <span className="text-indigo-600">{modeConf.label}</span>{' '}
              검색 결과 <span className="text-indigo-600">{filteredResults.length}</span>개
              {secondary.enabled && filteredResults.length < results.length && (
                <span className="text-gray-400 text-xs ml-1">(전체 {results.length}개 중)</span>
              )}
            </h3>
            <button onClick={runSearch} className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> 재검색
            </button>
          </div>

          {filteredResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">조건에 맞는 종목이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-center py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('data_rank')}>
                      # {sortKey === 'data_rank' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-left py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('hts_kor_isnm')}>
                      종목 {sortKey === 'hts_kor_isnm' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('stck_prpr')}>
                      현재가 {sortKey === 'stck_prpr' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('prdy_ctrt')}>
                      등락률 {sortKey === 'prdy_ctrt' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('acml_vol')}>
                      거래량 {sortKey === 'acml_vol' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    {secondary.enabled && (
                      <>
                        <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('rsi')}>
                          RSI {sortKey === 'rsi' ? (sortAsc ? '↑' : '↓') : ''}
                        </th>
                        <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('per')}>
                          PER {sortKey === 'per' ? (sortAsc ? '↑' : '↓') : ''}
                        </th>
                        <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('pbr')}>
                          PBR {sortKey === 'pbr' ? (sortAsc ? '↑' : '↓') : ''}
                        </th>
                        <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('roe')}>
                          ROE {sortKey === 'roe' ? (sortAsc ? '↑' : '↓') : ''}
                        </th>
                        <th className="text-right py-2 px-1.5">MACD</th>
                        <th className="text-right py-2 px-1.5">Vol비</th>
                        <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('foreignNet')}>
                          외인 {sortKey === 'foreignNet' ? (sortAsc ? '↑' : '↓') : ''}
                        </th>
                        <th className="text-right py-2 px-1.5 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('institutionNet')}>
                          기관 {sortKey === 'institutionNet' ? (sortAsc ? '↑' : '↓') : ''}
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE).map(r => {
                    const rate = Number(r.prdy_ctrt || '0')
                    const sign = r.prdy_vrss_sign
                    const isUp = sign === '1' || sign === '2'
                    const isDown = sign === '4' || sign === '5'
                    const e = enriched.get(r.mksc_shrn_iscd)
                    const loading = e?.loading
                    const Spin = () => <Loader2 className="h-3 w-3 animate-spin inline text-gray-300" />
                    return (
                      <tr key={r.mksc_shrn_iscd} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 px-1.5 text-center text-gray-400 font-medium">{r.data_rank}</td>
                        <td className="py-2 px-1.5">
                          <span className="font-medium text-gray-900">{r.hts_kor_isnm}</span>
                          <span className="text-[10px] text-gray-400 ml-1">{r.mksc_shrn_iscd}</span>
                        </td>
                        <td className="py-2 px-1.5 text-right font-medium text-gray-900">{fmtKrw(r.stck_prpr)}</td>
                        <td className={`py-2 px-1.5 text-right font-medium ${isUp ? 'text-red-600' : isDown ? 'text-blue-600' : 'text-gray-600'}`}>
                          {isUp ? '+' : ''}{rate.toFixed(2)}%
                        </td>
                        <td className="py-2 px-1.5 text-right text-gray-600">{Number(r.acml_vol).toLocaleString('ko-KR')}</td>
                        {secondary.enabled && (() => {
                          const t = e?.tech
                          const D = <span className="text-gray-300">-</span>
                          return (
                          <>
                            <td className="py-2 px-1.5 text-right">
                              {loading ? <Spin /> :
                                t?.rsi != null ? (
                                  <span className={t.rsi < 30 ? 'text-blue-600 font-semibold' : t.rsi > 70 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                                    {t.rsi.toFixed(1)}
                                  </span>
                                ) : D}
                            </td>
                            <td className="py-2 px-1.5 text-right text-gray-700">
                              {loading ? <Spin /> : e?.per != null ? e.per.toFixed(1) : D}
                            </td>
                            <td className="py-2 px-1.5 text-right text-gray-700">
                              {loading ? <Spin /> : e?.pbr != null ? e.pbr.toFixed(2) : D}
                            </td>
                            <td className="py-2 px-1.5 text-right text-gray-700">
                              {loading ? <Spin /> : e?.roe ? `${Number(e.roe).toFixed(1)}` : D}
                            </td>
                            <td className={`py-2 px-1.5 text-right text-[10px] ${t?.macdHist != null ? (t.macdHist > 0 ? 'text-red-600' : 'text-blue-600') : 'text-gray-300'}`}>
                              {loading ? <Spin /> : t?.macdHist != null ? (t.macdHist > 0 ? '▲' : '▼') : D}
                            </td>
                            <td className={`py-2 px-1.5 text-right ${t?.volRatio != null && t.volRatio >= 2 ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                              {loading ? <Spin /> : t?.volRatio != null ? `${t.volRatio.toFixed(1)}` : D}
                            </td>
                            <td className={`py-2 px-1.5 text-right font-medium ${e?.foreignNet != null ? (e.foreignNet > 0 ? 'text-red-600' : 'text-blue-600') : 'text-gray-300'}`}>
                              {loading ? <Spin /> : e?.foreignNet != null ? (e.foreignNet > 0 ? '+' : '') + Number(e.foreignNet).toLocaleString('ko-KR') : D}
                            </td>
                            <td className={`py-2 px-1.5 text-right font-medium ${e?.institutionNet != null ? (e.institutionNet > 0 ? 'text-red-600' : 'text-blue-600') : 'text-gray-300'}`}>
                              {loading ? <Spin /> : e?.institutionNet != null ? (e.institutionNet > 0 ? '+' : '') + Number(e.institutionNet).toLocaleString('ko-KR') : D}
                            </td>
                          </>
                          )
                        })()}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {filteredResults.length > PAGE_SIZE && (
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {tablePage * PAGE_SIZE + 1}~{Math.min((tablePage + 1) * PAGE_SIZE, filteredResults.length)}
                {' / '}총 {filteredResults.length}개
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setTablePage(0)}
                  disabled={tablePage === 0}
                  className="px-2 py-1 rounded text-xs border disabled:opacity-30 hover:bg-gray-100"
                >
                  ≪
                </button>
                <button
                  onClick={() => setTablePage(p => Math.max(0, p - 1))}
                  disabled={tablePage === 0}
                  className="px-2 py-1 rounded text-xs border disabled:opacity-30 hover:bg-gray-100"
                >
                  ‹ 이전
                </button>
                <span className="px-3 py-1 text-xs font-medium text-indigo-600">
                  {tablePage + 1} / {Math.ceil(filteredResults.length / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setTablePage(p => Math.min(Math.ceil(filteredResults.length / PAGE_SIZE) - 1, p + 1))}
                  disabled={(tablePage + 1) * PAGE_SIZE >= filteredResults.length}
                  className="px-2 py-1 rounded text-xs border disabled:opacity-30 hover:bg-gray-100"
                >
                  다음 ›
                </button>
                <button
                  onClick={() => setTablePage(Math.ceil(filteredResults.length / PAGE_SIZE) - 1)}
                  disabled={(tablePage + 1) * PAGE_SIZE >= filteredResults.length}
                  className="px-2 py-1 rounded text-xs border disabled:opacity-30 hover:bg-gray-100"
                >
                  ≫
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 데이터 테이블 ─────────────────────────────────────────

function DailyPriceTable({ data }: { data: KisDailyPrice[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-2 px-2">날짜</th>
            <th className="text-right py-2 px-2">시가</th>
            <th className="text-right py-2 px-2">고가</th>
            <th className="text-right py-2 px-2">저가</th>
            <th className="text-right py-2 px-2">종가</th>
            <th className="text-right py-2 px-2">등락</th>
            <th className="text-right py-2 px-2">거래량</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((d, i) => {
            const sign = d.prdy_vrss_sign
            const isUp = sign === '1' || sign === '2'
            const isDown = sign === '4' || sign === '5'
            return (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-1.5 px-2 text-gray-900">
                  {d.stck_bsop_date.slice(0, 4)}-{d.stck_bsop_date.slice(4, 6)}-{d.stck_bsop_date.slice(6)}
                </td>
                <td className="py-1.5 px-2 text-right">{fmtKrw(d.stck_oprc)}</td>
                <td className="py-1.5 px-2 text-right text-red-600">{fmtKrw(d.stck_hgpr)}</td>
                <td className="py-1.5 px-2 text-right text-blue-600">{fmtKrw(d.stck_lwpr)}</td>
                <td className="py-1.5 px-2 text-right font-medium">{fmtKrw(d.stck_clpr)}</td>
                <td className={`py-1.5 px-2 text-right font-medium ${isUp ? 'text-red-600' : isDown ? 'text-blue-600' : 'text-gray-600'}`}>
                  {isUp ? '+' : ''}{fmtKrw(d.prdy_vrss)}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-500">{Number(d.acml_vol).toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FinancialTable({ data }: { data: KisFinancialRatio[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-2 px-2">결산월</th>
            <th className="text-right py-2 px-2">ROE</th>
            <th className="text-right py-2 px-2">EPS</th>
            <th className="text-right py-2 px-2">BPS</th>
            <th className="text-right py-2 px-2">매출증가율</th>
            <th className="text-right py-2 px-2">부채비율</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-1.5 px-2 text-gray-900">{r.stac_yymm}</td>
              <td className="py-1.5 px-2 text-right">{r.roe_val ? r.roe_val + '%' : '-'}</td>
              <td className="py-1.5 px-2 text-right">{r.eps ? fmtKrw(r.eps) : '-'}</td>
              <td className="py-1.5 px-2 text-right">{r.bps ? fmtKrw(r.bps) : '-'}</td>
              <td className="py-1.5 px-2 text-right">{r.grs ? r.grs + '%' : '-'}</td>
              <td className="py-1.5 px-2 text-right">{r.lblt_rate ? r.lblt_rate + '%' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InvestorTable({ data }: { data: KisInvestorTrend[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-2 px-2">날짜</th>
            <th className="text-right py-2 px-2">개인</th>
            <th className="text-right py-2 px-2">외국인</th>
            <th className="text-right py-2 px-2">기관</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((d, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-1.5 px-2 text-gray-900">
                {d.stck_bsop_date.slice(0, 4)}-{d.stck_bsop_date.slice(4, 6)}-{d.stck_bsop_date.slice(6)}
              </td>
              <td className={`py-1.5 px-2 text-right ${Number(d.prsn_ntby_qty) >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {Number(d.prsn_ntby_qty).toLocaleString()}
              </td>
              <td className={`py-1.5 px-2 text-right ${Number(d.frgn_ntby_qty) >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {Number(d.frgn_ntby_qty).toLocaleString()}
              </td>
              <td className={`py-1.5 px-2 text-right ${Number(d.orgn_ntby_qty) >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {Number(d.orgn_ntby_qty).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 메인 페이지 ────────────────────────────────────────────

type PageTab = 'screener' | 'collect'

export default function StockDataCollectorPage() {
  const { data: status } = useKisStatus()
  const connected = status?.connected ?? false
  const [pageTab, setPageTab] = useState<PageTab>('screener')

  const [jobs, setJobs] = useState<CollectionJob[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<JobType>('daily_price')
  const [newSymbols, setNewSymbols] = useState('')
  const [viewingJob, setViewingJob] = useState<string | null>(null)

  const addJob = () => {
    if (!newName.trim() || !newSymbols.trim()) return
    const symbols = newSymbols.split(/[,\s]+/).filter(Boolean)
    const job: CollectionJob = {
      id: Date.now().toString(),
      name: newName.trim(),
      type: newType,
      symbols,
      status: 'idle',
      lastRun: null,
      error: null,
      data: null,
    }
    setJobs(prev => [...prev, job])
    setNewName('')
    setNewSymbols('')
    setShowAdd(false)
  }

  const removeJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
    if (viewingJob === id) setViewingJob(null)
  }

  const runJob = useCallback(async (id: string) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'running' as const, error: null } : j))
    const job = jobs.find(j => j.id === id)
    if (!job) return
    try {
      const allData: unknown[] = []
      for (const symbol of job.symbols) {
        let result: unknown
        switch (job.type) {
          case 'daily_price': result = await kisApi.dailyPrices(symbol); break
          case 'financial': result = await kisApi.financialRatio(symbol); break
          case 'investor': result = await kisApi.investorTrend(symbol); break
        }
        allData.push({ symbol, data: result })
      }
      setJobs(prev => prev.map(j => j.id === id ? {
        ...j, status: 'completed' as const, lastRun: new Date().toLocaleString('ko-KR'), data: allData, error: null,
      } : j))
    } catch (e) {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'error' as const, error: (e as Error).message } : j))
    }
  }, [jobs])

  const statusIcon = (s: CollectionJob['status']) => {
    switch (s) {
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const viewJob = viewingJob ? jobs.find(j => j.id === viewingJob) : null

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">주식 자료 수집</h1>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className={`text-xs font-medium ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
            {connected ? '실전 데이터' : '미연결'}
          </span>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: 'screener' as PageTab, label: '조건검색', icon: Search },
          { key: 'collect' as PageTab, label: '데이터 수집', icon: Database },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setPageTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              pageTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 조건검색 */}
      {pageTab === 'screener' && <ScreenerPanel connected={connected} />}

      {/* 데이터 수집 */}
      {pageTab === 'collect' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '등록 작업', value: jobs.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: '실행 중', value: jobs.filter(j => j.status === 'running').length, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: '완료', value: jobs.filter(j => j.status === 'completed').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: '오류', value: jobs.filter(j => j.status === 'error').length, color: 'text-red-600', bg: 'bg-red-50' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl ${item.bg} p-4`}>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {showAdd && (
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">새 수집 작업</h3>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="작업 이름" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={newType} onChange={e => setNewType(e.target.value as JobType)} className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
              <input type="text" value={newSymbols} onChange={e => setNewSymbols(e.target.value)} placeholder="종목코드 (쉼표로 구분, 예: 005930, 000660)" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={addJob} disabled={!newName.trim() || !newSymbols.trim()} className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">추가</button>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">수집 작업</h2>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
                <Plus className="h-3.5 w-3.5" /> 작업 추가
              </button>
            </div>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">등록된 수집 작업이 없습니다.</div>
            ) : (
              jobs.map(job => (
                <div key={job.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0"><Database className="h-4 w-4 text-indigo-600" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{job.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[job.type]}`}>{TYPE_LABELS[job.type]}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        종목: {job.symbols.join(', ')}
                        {job.lastRun && <span className="ml-2 text-gray-400">· 마지막 실행: {job.lastRun}</span>}
                      </p>
                      {job.error && <p className="text-xs text-red-500 mt-0.5">{job.error}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {statusIcon(job.status)}
                      <button onClick={() => runJob(job.id)} disabled={!connected || job.status === 'running'} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="실행"><Play className="h-4 w-4" /></button>
                      {job.data && (<button onClick={() => setViewingJob(viewingJob === job.id ? null : job.id)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="데이터 보기"><Download className="h-4 w-4" /></button>)}
                      <button onClick={() => removeJob(job.id)} className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {viewJob?.data && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">수집 결과: {viewJob.name}</h2>
                <button onClick={() => setViewingJob(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>
              {(viewJob.data as { symbol: string; data: unknown }[]).map((item, idx) => (
                <div key={idx} className="rounded-xl border bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">{item.symbol}</p>
                  {viewJob.type === 'daily_price' && Array.isArray(item.data) && <DailyPriceTable data={item.data as KisDailyPrice[]} />}
                  {viewJob.type === 'financial' && Array.isArray(item.data) && <FinancialTable data={item.data as KisFinancialRatio[]} />}
                  {viewJob.type === 'investor' && Array.isArray(item.data) && <InvestorTable data={item.data as KisInvestorTrend[]} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
