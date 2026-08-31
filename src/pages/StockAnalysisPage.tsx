import { useMemo, useRef, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, ComposedChart, Line, Cell, ReferenceLine,
} from 'recharts'
import { Search, BarChart3, TrendingUp, TrendingDown, RefreshCw, CandlestickChart, LineChart, Star, X } from 'lucide-react'
import { useKisPrice, useKisDailyPrices, useKisFinancialRatio, useKisInvestorTrend } from '@/hooks/useKis'
import type { KisDailyPrice } from '@/lib/kis'
import { searchStocks, STOCK_LIST, type StockItem } from '@/lib/stockList'
import { useStockWatchlist } from '@/hooks/useStockWatchlist'

type AnalysisTab = 'technical' | 'fundamental' | 'investor'

const TABS: { key: AnalysisTab; label: string }[] = [
  { key: 'technical', label: '기술적 분석' },
  { key: 'fundamental', label: '기본적 분석' },
  { key: 'investor', label: '투자자 동향' },
]

function fmtKrw(val: string | number | undefined) {
  if (val === undefined || val === '') return '-'
  const n = Number(val)
  if (Number.isNaN(n)) return String(val)
  return n.toLocaleString('ko-KR') + '원'
}

function calcSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null
    const slice = prices.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function calcEMA(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const result: (number | null)[] = []
  let ema: number | null = null
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (ema === null) {
      ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
      result.push(ema)
    } else {
      ema = prices[i] * k + ema * (1 - k)
      result.push(ema)
    }
  }
  return result
}

function calcRSISeries(prices: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = []
  if (prices.length < period + 1) return prices.map(() => null)

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period

  for (let i = 0; i < period; i++) result.push(null)
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }
  return result
}

function calcMACD(prices: number[]) {
  const ema12 = calcEMA(prices, 12)
  const ema26 = calcEMA(prices, 26)
  const macdLine: (number | null)[] = ema12.map((v, i) =>
    v !== null && ema26[i] !== null ? v - ema26[i]! : null
  )
  const validMacd = macdLine.filter((v): v is number => v !== null)
  const signalRaw = calcEMA(validMacd, 9)
  let si = 0
  const signal: (number | null)[] = macdLine.map(v => {
    if (v === null) return null
    return signalRaw[si++] ?? null
  })
  const histogram: (number | null)[] = macdLine.map((v, i) =>
    v !== null && signal[i] !== null ? v - signal[i]! : null
  )
  return { macdLine, signal, histogram }
}

type ChartType = 'line' | 'candle'
type SubIndicator = 'volume' | 'macd' | 'rsi'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandlestickShape(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload) return null
  const { open, close, high, low } = payload
  const isUp = close >= open
  const color = isUp ? '#ef4444' : '#3b82f6'

  const bodyRange = Math.abs(close - open)
  const cx = x + width / 2
  const barW = Math.max(width * 0.8, 3)

  if (bodyRange === 0 || !height) {
    return (
      <g>
        <line x1={cx} y1={y - 5} x2={cx} y2={y + 5} stroke={color} strokeWidth={1} />
        <rect x={cx - barW / 2} y={y - 0.5} width={barW} height={1} fill={color} />
      </g>
    )
  }

  const pxPerUnit = Math.abs(height) / bodyRange
  const bodyTop = y
  const bodyH = Math.abs(height)
  const highY = bodyTop - (high - Math.max(open, close)) * pxPerUnit
  const lowY = bodyTop + bodyH + (Math.min(open, close) - low) * pxPerUnit

  return (
    <g>
      <line x1={cx} y1={highY} x2={cx} y2={bodyTop} stroke={color} strokeWidth={1} />
      <line x1={cx} y1={bodyTop + bodyH} x2={cx} y2={lowY} stroke={color} strokeWidth={1} />
      <rect x={cx - barW / 2} y={bodyTop} width={barW} height={Math.max(bodyH, 1)} fill={color} stroke={color} />
    </g>
  )
}

function TechnicalTab({ symbol }: { symbol: string }) {
  const { data: dailyData, isLoading } = useKisDailyPrices(symbol)
  const [chartType, setChartType] = useState<ChartType>('candle')
  const [subIndicators, setSubIndicators] = useState<SubIndicator[]>(['volume'])

  const toggleSub = (ind: SubIndicator) => {
    setSubIndicators(prev =>
      prev.includes(ind) ? prev.filter(s => s !== ind) : [...prev, ind]
    )
  }

  const chartData = useMemo(() => {
    if (!dailyData || !Array.isArray(dailyData)) return []
    const sorted = [...dailyData].sort((a: KisDailyPrice, b: KisDailyPrice) =>
      a.stck_bsop_date.localeCompare(b.stck_bsop_date)
    )
    const closes = sorted.map(d => Number(d.stck_clpr))
    const sma5 = calcSMA(closes, 5)
    const sma20 = calcSMA(closes, 20)
    const sma60 = calcSMA(closes, 60)
    const rsiSeries = calcRSISeries(closes)
    const { macdLine, signal, histogram } = calcMACD(closes)

    return sorted.map((d, i) => {
      const open = Number(d.stck_oprc)
      const high = Number(d.stck_hgpr)
      const low = Number(d.stck_lwpr)
      const close = closes[i]
      return {
        date: `${d.stck_bsop_date.slice(4, 6)}/${d.stck_bsop_date.slice(6)}`,
        open, high, low, close,
        candleBody: [Math.min(open, close), Math.max(open, close)] as [number, number],
        volume: Number(d.acml_vol),
        sma5: sma5[i],
        sma20: sma20[i],
        sma60: sma60[i],
        rsi: rsiSeries[i],
        macd: macdLine[i],
        macdSignal: signal[i],
        macdHist: histogram[i],
      }
    })
  }, [dailyData])

  const indicators = useMemo(() => {
    if (!chartData.length) return null
    const last = chartData[chartData.length - 1]
    const rsi = last.rsi
    return {
      rsi,
      last: last.close,
      sma5: last.sma5,
      sma20: last.sma20,
      sma60: last.sma60,
      macd: last.macd,
      macdSignal: last.macdSignal,
    }
  }, [chartData])

  if (isLoading) {
    return <div className="text-center py-12 text-gray-400 text-sm">데이터 로딩 중...</div>
  }

  return (
    <div className="space-y-4">
      {/* 지표 요약 카드 */}
      {indicators && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="p-2.5 rounded-lg bg-gray-50 text-center">
            <p className="text-[10px] text-gray-500">RSI (14)</p>
            <p className={`text-sm font-bold ${
              indicators.rsi !== null
                ? (indicators.rsi ?? 0) > 70 ? 'text-red-600' : (indicators.rsi ?? 0) < 30 ? 'text-blue-600' : 'text-gray-900'
                : 'text-gray-400'
            }`}>
              {indicators.rsi !== null ? indicators.rsi?.toFixed(1) : '-'}
            </p>
            <p className="text-[9px] text-gray-400">
              {indicators.rsi !== null ? ((indicators.rsi ?? 0) > 70 ? '과매수' : (indicators.rsi ?? 0) < 30 ? '과매도' : '중립') : ''}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-gray-50 text-center">
            <p className="text-[10px] text-gray-500">MACD</p>
            <p className={`text-sm font-bold ${(indicators.macd ?? 0) >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
              {indicators.macd !== null ? indicators.macd?.toFixed(0) : '-'}
            </p>
            <p className="text-[9px] text-gray-400">
              {indicators.macd !== null && indicators.macdSignal !== null
                ? (indicators.macd ?? 0) > (indicators.macdSignal ?? 0) ? '매수 신호' : '매도 신호'
                : ''}
            </p>
          </div>
          {[
            { label: '5일선', val: indicators.sma5 },
            { label: '20일선', val: indicators.sma20 },
            { label: '60일선', val: indicators.sma60 },
          ].map(s => (
            <div key={s.label} className="p-2.5 rounded-lg bg-gray-50 text-center">
              <p className="text-[10px] text-gray-500">{s.label}</p>
              <p className="text-sm font-bold text-gray-900">{s.val ? Math.round(s.val).toLocaleString() : '-'}</p>
              {s.val && indicators.last && (
                <p className={`text-[9px] ${indicators.last > s.val ? 'text-red-500' : 'text-blue-500'}`}>
                  {indicators.last > s.val ? '상회' : '하회'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 차트 컨트롤 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setChartType('candle')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              chartType === 'candle' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <CandlestickChart className="h-3.5 w-3.5" />
            봉차트
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              chartType === 'line' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <LineChart className="h-3.5 w-3.5" />
            라인
          </button>
        </div>
        <div className="flex gap-1">
          {([
            { key: 'volume' as SubIndicator, label: '거래량' },
            { key: 'macd' as SubIndicator, label: 'MACD' },
            { key: 'rsi' as SubIndicator, label: 'RSI' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => toggleSub(s.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subIndicators.includes(s.key)
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="space-y-1">
          {/* 메인 가격 차트 */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip
                    formatter={(v: any, name: any) => {
                      const labels: Record<string, string> = { close: '종가', sma5: '5일선', sma20: '20일선', sma60: '60일선' }
                      return [fmtKrw(v), labels[name] ?? name]
                    }}
                    labelFormatter={l => `날짜: ${l}`}
                  />
                  <Area type="monotone" dataKey="close" stroke="#6366f1" fill="#6366f1" fillOpacity={0.08} strokeWidth={2} name="close" />
                  <Area type="monotone" dataKey="sma5" stroke="#f59e0b" fill="none" strokeWidth={1} strokeDasharray="4 2" name="sma5" />
                  <Area type="monotone" dataKey="sma20" stroke="#10b981" fill="none" strokeWidth={1} strokeDasharray="4 2" name="sma20" />
                  <Area type="monotone" dataKey="sma60" stroke="#ec4899" fill="none" strokeWidth={1} strokeDasharray="4 2" name="sma60" />
                </AreaChart>
              ) : (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.[0]) return null
                      const d = payload[0].payload
                      const isUp = d.close >= d.open
                      return (
                        <div className="bg-white border rounded-lg shadow-lg p-2.5 text-xs">
                          <p className="font-medium text-gray-700 mb-1">{label}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                            <span className="text-gray-500">시가</span><span className="text-right">{d.open.toLocaleString()}</span>
                            <span className="text-gray-500">고가</span><span className="text-right text-red-600">{d.high.toLocaleString()}</span>
                            <span className="text-gray-500">저가</span><span className="text-right text-blue-600">{d.low.toLocaleString()}</span>
                            <span className="text-gray-500">종가</span>
                            <span className={`text-right font-bold ${isUp ? 'text-red-600' : 'text-blue-600'}`}>{d.close.toLocaleString()}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="candleBody" barSize={8} shape={<CandlestickShape />}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.close >= d.open ? '#ef4444' : '#3b82f6'} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="sma5" stroke="#f59e0b" dot={false} strokeWidth={1} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="sma20" stroke="#10b981" dot={false} strokeWidth={1} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="sma60" stroke="#ec4899" dot={false} strokeWidth={1} strokeDasharray="4 2" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* 이평선 범례 */}
          <div className="flex gap-4 justify-center text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-500" />5일</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-500" />20일</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-pink-500" />60일</span>
          </div>

          {/* 거래량 */}
          {subIndicators.includes('volume') && (
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
                  <Tooltip formatter={(v: any) => [Number(v).toLocaleString() + '주', '거래량']} />
                  <Bar dataKey="volume" name="거래량">
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.close >= d.open ? '#fca5a5' : '#93c5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* MACD */}
          {subIndicators.includes('macd') && (
            <div className="h-32">
              <p className="text-[10px] text-gray-500 font-medium ml-1 mb-0.5">MACD (12, 26, 9)</p>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={0} stroke="#d1d5db" />
                  <Tooltip
                    formatter={(v: any, name: any) => {
                      const labels: Record<string, string> = { macd: 'MACD', macdSignal: 'Signal', macdHist: 'Histogram' }
                      return [Number(v)?.toFixed(0) ?? '-', labels[name] ?? name]
                    }}
                  />
                  <Bar dataKey="macdHist" name="macdHist">
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={(d.macdHist ?? 0) >= 0 ? '#fca5a5' : '#93c5fd'} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="macd" stroke="#6366f1" dot={false} strokeWidth={1.5} name="macd" />
                  <Line type="monotone" dataKey="macdSignal" stroke="#f97316" dot={false} strokeWidth={1.5} name="macdSignal" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* RSI */}
          {subIndicators.includes('rsi') && (
            <div className="h-28">
              <p className="text-[10px] text-gray-500 font-medium ml-1 mb-0.5">RSI (14)</p>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={70} stroke="#fca5a5" strokeDasharray="3 3" />
                  <ReferenceLine y={30} stroke="#93c5fd" strokeDasharray="3 3" />
                  <Tooltip formatter={(v: any) => [Number(v)?.toFixed(1), 'RSI']} />
                  <Area type="monotone" dataKey="rsi" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.08} strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FundamentalTab({ symbol }: { symbol: string }) {
  const { data, isLoading } = useKisFinancialRatio(symbol)

  if (isLoading) {
    return <div className="text-center py-12 text-gray-400 text-sm">데이터 로딩 중...</div>
  }

  const latest = Array.isArray(data) && data.length > 0 ? data[0] : null

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">재무 지표</h3>
      {latest ? (
        <>
          <p className="text-xs text-gray-400">기준: {latest.stac_yymm}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'ROE', desc: '자기자본이익률', value: latest.roe_val ? latest.roe_val + '%' : '-' },
              { label: 'EPS', desc: '주당순이익', value: latest.eps ? fmtKrw(latest.eps) : '-' },
              { label: 'BPS', desc: '주당순자산', value: latest.bps ? fmtKrw(latest.bps) : '-' },
              { label: '매출증가율', desc: '전년 대비', value: latest.grs ? latest.grs + '%' : '-' },
              { label: '영업이익증가율', desc: '전년 대비', value: latest.bsop_prfi_inrt ? latest.bsop_prfi_inrt + '%' : '-' },
              { label: '부채비율', desc: 'Debt Ratio', value: latest.lblt_rate ? latest.lblt_rate + '%' : '-' },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500">{item.desc}</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{item.label}</p>
                <p className="text-lg font-bold text-indigo-600 mt-0.5">{item.value || '-'}</p>
              </div>
            ))}
          </div>

          {Array.isArray(data) && data.length > 1 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">연도별 추이</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500">기간</th>
                      <th className="text-right py-2 text-gray-500">ROE</th>
                      <th className="text-right py-2 text-gray-500">EPS</th>
                      <th className="text-right py-2 text-gray-500">BPS</th>
                      <th className="text-right py-2 text-gray-500">부채비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 text-gray-900">{r.stac_yymm}</td>
                        <td className="py-2 text-right text-gray-700">{r.roe_val ? r.roe_val + '%' : '-'}</td>
                        <td className="py-2 text-right text-gray-700">{r.eps ? Number(r.eps).toLocaleString() : '-'}</td>
                        <td className="py-2 text-right text-gray-700">{r.bps ? Number(r.bps).toLocaleString() : '-'}</td>
                        <td className="py-2 text-right text-gray-700">{r.lblt_rate ? r.lblt_rate + '%' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          재무 데이터를 가져올 수 없습니다.
        </div>
      )}
    </div>
  )
}

function InvestorTab({ symbol }: { symbol: string }) {
  const { data, isLoading } = useKisInvestorTrend(symbol)

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return []
    return [...data].reverse().slice(-20).map(d => ({
      date: `${d.stck_bsop_date.slice(4, 6)}/${d.stck_bsop_date.slice(6)}`,
      personal: Number(d.prsn_ntby_qty),
      foreign: Number(d.frgn_ntby_qty),
      institution: Number(d.orgn_ntby_qty),
    }))
  }, [data])

  if (isLoading) {
    return <div className="text-center py-12 text-gray-400 text-sm">데이터 로딩 중...</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">투자자별 매매동향</h3>
      {chartData.length > 0 ? (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v: any, name: any) => [
                  Number(v).toLocaleString() + '주',
                  name === 'personal' ? '개인' : name === 'foreign' ? '외국인' : '기관'
                ]} />
                <Bar dataKey="personal" fill="#f59e0b" name="개인" />
                <Bar dataKey="foreign" fill="#6366f1" name="외국인" />
                <Bar dataKey="institution" fill="#10b981" name="기관" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-gray-500">날짜</th>
                  <th className="text-right py-2 text-amber-600">개인</th>
                  <th className="text-right py-2 text-indigo-600">외국인</th>
                  <th className="text-right py-2 text-emerald-600">기관</th>
                </tr>
              </thead>
              <tbody>
                {chartData.slice(-10).reverse().map((d, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 text-gray-900">{d.date}</td>
                    <td className={`py-2 text-right ${d.personal >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {d.personal.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right ${d.foreign >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {d.foreign.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right ${d.institution >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {d.institution.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          투자자 동향 데이터를 가져올 수 없습니다.
        </div>
      )}
    </div>
  )
}

export default function StockAnalysisPage() {
  const [tab, setTab] = useState<AnalysisTab>('technical')
  const [searchInput, setSearchInput] = useState('')
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<StockItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const { items: watchlist, add: addWatch, remove: removeWatch, isWatching } = useStockWatchlist()
  const { data: priceData, isLoading: priceLoading } = useKisPrice(selectedStock ?? '', !!selectedStock)

  const isStockCode = (val: string) => /^\d{6}$/.test(val.trim())

  const handleAddToWatchlist = () => {
    if (!selectedStock || isWatching(selectedStock)) return
    const stockInfo = STOCK_LIST.find(s => s.code === selectedStock)
    const name = priceData?.hts_kor_isnm ?? stockInfo?.name ?? selectedStock
    const market = stockInfo?.market ?? 'KOSPI'
    addWatch.mutate({ symbol: selectedStock, name, market })
  }

  const handleSearch = () => {
    const val = searchInput.trim()
    if (!val) return
    if (isStockCode(val)) {
      setSelectedStock(val)
      setShowSuggestions(false)
      return
    }
    const results = searchStocks(val, 1)
    if (results.length > 0) {
      setSelectedStock(results[0].code)
      setSearchInput(`${results[0].name} (${results[0].code})`)
    } else {
      setSelectedStock(val)
    }
    setShowSuggestions(false)
  }

  const handleInputChange = (val: string) => {
    setSearchInput(val)
    setHighlightIdx(-1)
    if (val.trim() && !isStockCode(val)) {
      const results = searchStocks(val)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (stock: StockItem) => {
    setSelectedStock(stock.code)
    setSearchInput(`${stock.name} (${stock.code})`)
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') handleSearch()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        selectSuggestion(suggestions[highlightIdx])
      } else {
        handleSearch()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const priceSign = priceData?.prdy_vrss_sign
  const isUp = priceSign === '1' || priceSign === '2'
  const isDown = priceSign === '4' || priceSign === '5'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">주식 분석</h1>
        <p className="text-sm text-gray-500 mt-1">기술적·기본적 분석과 투자자 동향 확인</p>
      </div>

      {/* 종목 검색 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0 && searchInput.trim()) setShowSuggestions(true) }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="종목명 또는 코드 입력 (예: 삼성전자, 005930)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {showSuggestions && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {suggestions.map((stock, i) => (
                <button
                  key={stock.code}
                  onMouseDown={() => selectSuggestion(stock)}
                  className={`w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-indigo-50 transition-colors ${
                    i === highlightIdx ? 'bg-indigo-50' : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">{stock.name}</span>
                  <span className="text-xs text-gray-400">{stock.code} · {stock.market}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          검색
        </button>
      </div>

      {/* 관심종목 — 가로 스크롤 칩 */}
      {watchlist.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
          {watchlist.map(w => (
            <button
              key={w.id}
              onClick={() => { setSelectedStock(w.symbol); setSearchInput(`${w.name} (${w.symbol})`) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 group ${
                selectedStock === w.symbol
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {w.name}
              <span
                onClick={e => { e.stopPropagation(); removeWatch.mutate(w.id) }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {!selectedStock ? (
        <div className="text-center py-16 space-y-4">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto" />
          <div>
            <p className="text-gray-500 text-sm">종목명 또는 코드를 검색하여 분석을 시작하세요.</p>
            <p className="text-gray-400 text-xs mt-1">한국투자증권 API를 통해 실시간 데이터를 제공합니다.</p>
          </div>
        </div>
      ) : (
        <>
          {/* 종목 요약 헤더 — 컴팩트 한 줄 */}
          <div className="rounded-xl border bg-white px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-gray-900">
                  {priceData?.hts_kor_isnm ?? selectedStock}
                </h2>
                <span className="text-[10px] text-gray-400">{selectedStock}</span>
                <button
                  onClick={handleAddToWatchlist}
                  disabled={isWatching(selectedStock)}
                  className={`p-0.5 rounded-full transition-colors ${
                    isWatching(selectedStock) ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'
                  }`}
                  title={isWatching(selectedStock) ? '관심종목에 추가됨' : '관심종목에 추가'}
                >
                  <Star className={`h-4 w-4 ${isWatching(selectedStock) ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
              {priceLoading ? (
                <RefreshCw className="h-4 w-4 text-gray-300 animate-spin" />
              ) : priceData ? (
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <span className="font-bold text-gray-900">
                    {Number(priceData.stck_prpr).toLocaleString()}원
                  </span>
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-red-600' : isDown ? 'text-blue-600' : 'text-gray-500'}`}>
                    {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
                    {isUp ? '+' : ''}{Number(priceData.prdy_vrss).toLocaleString()} ({isUp ? '+' : ''}{priceData.prdy_ctrt}%)
                  </span>
                  <span className="hidden sm:flex items-center gap-2 text-[10px] text-gray-400">
                    <span>시 {Number(priceData.stck_oprc).toLocaleString()}</span>
                    <span>고 {Number(priceData.stck_hgpr).toLocaleString()}</span>
                    <span>저 {Number(priceData.stck_lwpr).toLocaleString()}</span>
                    <span>량 {Number(priceData.acml_vol).toLocaleString()}</span>
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-400">데이터 없음</span>
              )}
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="rounded-xl border bg-white p-6">
            {tab === 'technical' && <TechnicalTab symbol={selectedStock} />}
            {tab === 'fundamental' && <FundamentalTab symbol={selectedStock} />}
            {tab === 'investor' && <InvestorTab symbol={selectedStock} />}
          </div>
        </>
      )}
    </div>
  )
}
