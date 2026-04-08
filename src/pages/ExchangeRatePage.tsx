import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '@/lib/supabase'

interface Rate {
  code: string
  name: string
  flag: string
  rate: number // 1 외화 당 원화 (JPY는 100엔 당)
  rateDate: string
}

interface RateRow {
  currency_code: string
  currency_name: string
  rate: number
  rate_date: string
}

const CURRENCY_META: Record<string, { name: string; flag: string }> = {
  USD: { name: '미국 달러', flag: '🇺🇸' },
  JPY: { name: '일본 엔 (100엔)', flag: '🇯🇵' },
  EUR: { name: '유로', flag: '🇪🇺' },
}

const CURRENCY_CODES = ['USD', 'JPY', 'EUR']

export default function ExchangeRatePage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // 그래프 상태
  const [chartCurrency, setChartCurrency] = useState('USD')
  const [chartData, setChartData] = useState<{ date: string; rate: number }[]>([])

  // 계산기 상태
  const [amount, setAmount] = useState('')
  const [fromCurrency, setFromCurrency] = useState('KRW')
  const [toCurrency, setToCurrency] = useState('USD')

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 최근 30일 데이터 한 번에 조회 (그래프용 + 최신 환율용)
      const { data, error: dbError } = await supabase
        .from('exchange_rates')
        .select('currency_code, currency_name, rate, rate_date')
        .in('currency_code', CURRENCY_CODES)
        .order('rate_date', { ascending: false })
        .limit(150)

      if (dbError) throw dbError
      if (!data || data.length === 0) {
        throw new Error('환율 데이터가 없습니다. 잠시 후 다시 시도해주세요.')
      }

      const rows = data as RateRow[]

      // 통화별 최신 환율
      const latestByCode: Record<string, RateRow> = {}
      for (const row of rows) {
        if (!latestByCode[row.currency_code]) {
          latestByCode[row.currency_code] = row
        }
      }

      const newRates: Rate[] = CURRENCY_CODES.map(code => ({
        code,
        name: CURRENCY_META[code].name,
        flag: CURRENCY_META[code].flag,
        rate: latestByCode[code]?.rate ?? 0,
        rateDate: latestByCode[code]?.rate_date ?? '',
      }))

      setRates(newRates)
      setLastUpdated(latestByCode[CURRENCY_CODES[0]]?.rate_date ?? null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // 선택된 통화의 그래프 데이터 조회
  const fetchChartData = useCallback(async (code: string) => {
    const { data } = await supabase
      .from('exchange_rates')
      .select('rate, rate_date')
      .eq('currency_code', code)
      .order('rate_date', { ascending: true })
      .limit(60)

    if (data) {
      setChartData(
        (data as { rate: number; rate_date: string }[]).map(d => ({
          date: d.rate_date.slice(5), // MM-DD
          rate: d.rate,
        }))
      )
    }
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  useEffect(() => {
    fetchChartData(chartCurrency)
  }, [chartCurrency, fetchChartData])

  // 환산 계산
  const convert = () => {
    const num = Number(amount.replace(/,/g, ''))
    if (!num || rates.length === 0) return null

    if (fromCurrency === 'KRW') {
      const target = rates.find(r => r.code === toCurrency)
      if (!target) return null
      const divisor = toCurrency === 'JPY' ? target.rate / 100 : target.rate
      return { value: num / divisor, currency: toCurrency }
    } else {
      const source = rates.find(r => r.code === fromCurrency)
      if (!source) return null
      const multiplier = fromCurrency === 'JPY' ? source.rate / 100 : source.rate
      return { value: num * multiplier, currency: 'KRW' }
    }
  }

  const converted = convert()

  const allCurrencies = ['KRW', ...CURRENCY_CODES]
  const currencyLabel = (code: string) => {
    if (code === 'KRW') return '🇰🇷 원 (KRW)'
    const meta = CURRENCY_META[code]
    return meta ? `${meta.flag} ${meta.name} (${code})` : code
  }

  const handleFromChange = (code: string) => {
    setFromCurrency(code)
    if (code === toCurrency) setToCurrency(code === 'KRW' ? 'USD' : 'KRW')
  }

  const handleToChange = (code: string) => {
    setToCurrency(code)
    if (code === fromCurrency) setFromCurrency(code === 'KRW' ? 'USD' : 'KRW')
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    setAmount(raw)
  }

  const swap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* 환율 현황 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">환율 계산기</h1>
            <p className="text-xs text-gray-400">한국은행 공시 기준</p>
          </div>
          <button
            onClick={fetchRates}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 mb-4">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        )}

        {rates.length > 0 && (
          <div className="space-y-2">
            {rates.map(r => (
              <div key={r.code} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{r.flag}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="text-[10px] text-gray-400">{r.code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{r.rate.toLocaleString('ko-KR')}원</p>
                  <p className="text-[10px] text-gray-400">
                    {r.code === 'JPY' ? '100엔 당' : '1단위 당'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastUpdated && (
          <p className="text-[10px] text-gray-400 mt-3 text-right">
            기준일: {lastUpdated}
          </p>
        )}
      </div>

      {/* 환율 변동 그래프 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">최근 변동 그래프</h2>
          <div className="flex gap-1">
            {CURRENCY_CODES.map(code => (
              <button
                key={code}
                onClick={() => setChartCurrency(code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  chartCurrency === code
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {CURRENCY_META[code].flag} {code}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value) => [`${Number(value).toLocaleString()}원`, chartCurrency === 'JPY' ? '100엔' : '1단위']}
                labelFormatter={(label) => `날짜: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-xs text-gray-400">데이터 없음</p>
          </div>
        )}
      </div>

      {/* 환산 계산기 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">환산 계산</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">보내는 통화</label>
            <select
              value={fromCurrency}
              onChange={e => handleFromChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {allCurrencies.map(c => (
                <option key={c} value={c}>{currencyLabel(c)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">금액</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              placeholder="금액 입력"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex justify-center">
            <button
              onClick={swap}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              title="통화 전환"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">받는 통화</label>
            <select
              value={toCurrency}
              onChange={e => handleToChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {allCurrencies.map(c => (
                <option key={c} value={c}>{currencyLabel(c)}</option>
              ))}
            </select>
          </div>

          {converted && (
            <div className="mt-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
              <p className="text-xs text-gray-500 mb-1">환산 결과</p>
              <p className="text-xl font-bold text-indigo-700">
                {converted.currency === 'KRW'
                  ? `${Math.round(converted.value).toLocaleString('ko-KR')}원`
                  : `${converted.value.toFixed(2)} ${converted.currency}`
                }
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        * 한국은행 매매기준율이며, 실제 거래 환율과 다를 수 있습니다
      </p>
    </div>
  )
}
