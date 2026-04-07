import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

interface Rate {
  code: string
  name: string
  flag: string
  rate: number // 1 외화 = ? 원
}

const CURRENCIES: Omit<Rate, 'rate'>[] = [
  { code: 'USD', name: '미국 달러', flag: '🇺🇸' },
  { code: 'JPY', name: '일본 엔 (100엔)', flag: '🇯🇵' },
  { code: 'EUR', name: '유로', flag: '🇪🇺' },
]

export default function ExchangeRatePage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // 계산기 상태
  const [amount, setAmount] = useState('')
  const [fromCurrency, setFromCurrency] = useState('KRW')
  const [toCurrency, setToCurrency] = useState('USD')

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // exchangerate-api.com — 무료, CORS 지원, 키 불필요
      const res = await fetch('https://open.er-api.com/v6/latest/KRW')
      if (!res.ok) throw new Error('환율 정보를 가져올 수 없습니다')
      const data = await res.json()

      // open.er-api는 1 KRW = ? 외화 형태로 반환 → 역수로 1 외화 = ? 원
      const newRates: Rate[] = CURRENCIES.map(c => {
        const rawRate = data.rates[c.code]
        if (c.code === 'JPY') {
          return { ...c, rate: Math.round((100 / rawRate) * 100) / 100 }
        }
        return { ...c, rate: Math.round((1 / rawRate) * 100) / 100 }
      })

      setRates(newRates)
      setLastUpdated(new Date().toLocaleString('ko-KR'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

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

  const allCurrencies = ['KRW', ...CURRENCIES.map(c => c.code)]
  const currencyLabel = (code: string) => {
    if (code === 'KRW') return '🇰🇷 원 (KRW)'
    const c = CURRENCIES.find(c => c.code === code)
    return c ? `${c.flag} ${c.name} (${c.code})` : code
  }

  const handleFromChange = (code: string) => {
    setFromCurrency(code)
    if (code === toCurrency) {
      setToCurrency(code === 'KRW' ? 'USD' : 'KRW')
    }
  }

  const handleToChange = (code: string) => {
    setToCurrency(code)
    if (code === fromCurrency) {
      setFromCurrency(code === 'KRW' ? 'USD' : 'KRW')
    }
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
      {/* 실시간 환율 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">환율 계산기</h1>
            <p className="text-xs text-gray-400">실시간 환율 기준</p>
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
            업데이트: {lastUpdated}
          </p>
        )}
      </div>

      {/* 환율 계산기 */}
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
        * ECB(유럽중앙은행) 기준 환율이며, 실제 거래 환율과 다를 수 있습니다
      </p>
    </div>
  )
}
