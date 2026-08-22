import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Search, Plus, X, RefreshCw, TrendingUp, BookOpen, Wallet } from 'lucide-react'
import {
  usePrices, useStocks, useCandles, useOrderbook, useTrades,
  useTossAccounts, useTossAssets,
} from '@/hooks/useToss'
import type { AssetHolding } from '@/lib/toss'

type Tab = 'quotes' | 'chart' | 'depth' | 'assets'

const DEFAULT_WATCHLIST = ['005930', '000660', '035720', 'AAPL', 'TSLA']
const WATCHLIST_KEY = 'toss_watchlist'

// 토스 API 는 종목코드만 허용 (영문/숫자/'.'/'-'). 한글 종목명 등은 불가.
const SYMBOL_RE = /^[A-Za-z0-9.\-]+$/

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as string[]
      // 과거에 저장된 잘못된 값(한글 이름 등) 제거
      const cleaned = arr.filter(s => SYMBOL_RE.test(s))
      return cleaned.length > 0 ? cleaned : DEFAULT_WATCHLIST
    }
  } catch { /* ignore */ }
  return DEFAULT_WATCHLIST
}

function fmtPrice(price: string | number | null | undefined, currency: string) {
  if (price === null || price === undefined || price === '') return '-'
  const n = Number(price)
  if (Number.isNaN(n)) return String(price)
  if (currency === 'USD') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `${n.toLocaleString('ko-KR')}원`
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'quotes', label: '시세', icon: TrendingUp },
  { key: 'chart', label: '차트', icon: TrendingUp },
  { key: 'depth', label: '호가·체결', icon: BookOpen },
  { key: 'assets', label: '내 자산', icon: Wallet },
]

export default function StocksPage() {
  const [tab, setTab] = useState<Tab>('quotes')
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist)
  const [selected, setSelected] = useState<string>(loadWatchlist()[0] ?? '005930')
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

  const updateWatchlist = (next: string[]) => {
    setWatchlist(next)
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const addSymbol = () => {
    const sym = input.trim().toUpperCase()
    if (!sym) return
    if (!SYMBOL_RE.test(sym)) {
      setInputError('종목코드만 입력할 수 있어요 (예: 005930, AAPL). 종목명 검색은 지원하지 않습니다.')
      return
    }
    setInputError(null)
    if (!watchlist.includes(sym)) updateWatchlist([...watchlist, sym])
    setSelected(sym)
    setInput('')
  }

  const removeSymbol = (sym: string) => {
    updateWatchlist(watchlist.filter(s => s !== sym))
    if (selected === sym && watchlist.length > 1) {
      setSelected(watchlist.find(s => s !== sym) ?? '')
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* 헤더 + 검색 */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">토스증권 주식</h1>
            <p className="text-xs text-gray-400">토스증권 Open API</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={input}
              onChange={e => { setInput(e.target.value); if (inputError) setInputError(null) }}
              onKeyDown={e => e.key === 'Enter' && addSymbol()}
              placeholder="종목코드 입력 (예: 005930, AAPL)"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={addSymbol}
            className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
        {inputError && <p className="text-xs text-rose-600 mt-2">{inputError}</p>}
        <p className="text-[10px] text-gray-400 mt-2">
          국내주식은 6자리 코드(예: 삼성전자 005930), 미국주식은 티커(예: AAPL)를 입력하세요.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'quotes' && (
        <QuotesTab
          watchlist={watchlist}
          selected={selected}
          onSelect={setSelected}
          onRemove={removeSymbol}
        />
      )}
      {tab === 'chart' && <ChartTab symbol={selected} watchlist={watchlist} onSelect={setSelected} />}
      {tab === 'depth' && <DepthTab symbol={selected} watchlist={watchlist} onSelect={setSelected} />}
      {tab === 'assets' && <AssetsTab />}
    </div>
  )
}

// ---------------- 시세 탭 ----------------
function QuotesTab({
  watchlist, selected, onSelect, onRemove,
}: { watchlist: string[]; selected: string; onSelect: (s: string) => void; onRemove: (s: string) => void }) {
  const { data: prices, isLoading, isError, error, refetch, isFetching } = usePrices(watchlist)
  const { data: stocks } = useStocks(watchlist)

  const nameOf = (symbol: string) =>
    stocks?.find(s => s.symbol === symbol)?.name ?? symbol
  const priceOf = (symbol: string) =>
    prices?.find(p => p.symbol === symbol)

  return (
    <div className="bg-white rounded-2xl card-shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">관심 종목</h2>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100" title="새로고침">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isError && <ErrorBox message={(error as Error).message} />}
      {isLoading && <p className="text-xs text-gray-400 py-6 text-center">불러오는 중...</p>}
      {!isLoading && watchlist.length === 0 && (
        <p className="text-xs text-gray-400 py-6 text-center">종목을 추가해주세요.</p>
      )}

      <div className="space-y-1.5">
        {watchlist.map(sym => {
          const p = priceOf(sym)
          return (
            <div
              key={sym}
              onClick={() => onSelect(sym)}
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                selected === sym ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{nameOf(sym)}</p>
                <p className="text-[10px] text-gray-400">{sym}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">
                  {p ? fmtPrice(p.lastPrice, p.currency) : '-'}
                </p>
                <button
                  onClick={e => { e.stopPropagation(); onRemove(sym) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-opacity"
                  title="삭제"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- 차트 탭 ----------------
function ChartTab({
  symbol, watchlist, onSelect,
}: { symbol: string; watchlist: string[]; onSelect: (s: string) => void }) {
  const [interval, setInterval] = useState<'1m' | '1d'>('1d')
  const { data, isLoading, isError, error } = useCandles(symbol, interval)

  const chartData = useMemo(() => {
    if (!data?.candles) return []
    // 응답은 최신순 → 차트는 과거가 왼쪽이 되도록 뒤집는다
    return [...data.candles].reverse().map(c => ({
      label: interval === '1d' ? c.timestamp.slice(5, 10) : c.timestamp.slice(11, 16),
      close: Number(c.closePrice),
      currency: c.currency,
    }))
  }, [data, interval])

  const currency = chartData[0]?.currency ?? 'KRW'

  return (
    <div className="bg-white rounded-2xl card-shadow p-5">
      <SymbolPicker symbol={symbol} watchlist={watchlist} onSelect={onSelect} />

      <div className="flex items-center justify-between mb-3 mt-3">
        <h2 className="text-sm font-semibold text-gray-700">{symbol} 차트</h2>
        <div className="flex gap-1">
          {(['1d', '1m'] as const).map(iv => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                interval === iv ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {iv === '1d' ? '일봉' : '분봉'}
            </button>
          ))}
        </div>
      </div>

      {isError && <ErrorBox message={(error as Error).message} />}
      {isLoading && <p className="text-xs text-gray-400 py-10 text-center">불러오는 중...</p>}

      {!isLoading && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
              domain={['auto', 'auto']} width={55}
              tickFormatter={(v: number) => currency === 'USD' ? `$${v}` : v.toLocaleString()} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
              formatter={(v) => [fmtPrice(v as number, currency), '종가']}
            />
            <Area type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={2}
              fill="url(#closeGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------------- 호가·체결 탭 ----------------
function DepthTab({
  symbol, watchlist, onSelect,
}: { symbol: string; watchlist: string[]; onSelect: (s: string) => void }) {
  const { data: book, isError: bookErr, error: bookE } = useOrderbook(symbol)
  const { data: trades, isError: tradeErr, error: tradeE } = useTrades(symbol)

  const currency = book?.currency ?? trades?.[0]?.currency ?? 'KRW'
  const maxVol = Math.max(
    1,
    ...(book?.asks ?? []).map(a => Number(a.volume)),
    ...(book?.bids ?? []).map(b => Number(b.volume)),
  )

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl card-shadow p-5">
        <SymbolPicker symbol={symbol} watchlist={watchlist} onSelect={onSelect} />
        <h2 className="text-sm font-semibold text-gray-700 mt-3 mb-3">호가</h2>
        {bookErr && <ErrorBox message={(bookE as Error).message} />}
        {book && (
          <div className="space-y-0.5">
            {[...book.asks].reverse().map((a, i) => (
              <DepthRow key={`a${i}`} side="ask" price={a.price} volume={a.volume} maxVol={maxVol} currency={currency} />
            ))}
            <div className="h-px bg-gray-200 my-1" />
            {book.bids.map((b, i) => (
              <DepthRow key={`b${i}`} side="bid" price={b.price} volume={b.volume} maxVol={maxVol} currency={currency} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl card-shadow p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 체결</h2>
        {tradeErr && <ErrorBox message={(tradeE as Error).message} />}
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {(trades ?? []).map((t, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-gray-50">
              <span className="text-gray-400">{fmtTime(t.timestamp)}</span>
              <span className="font-medium text-gray-900">{fmtPrice(t.price, t.currency)}</span>
              <span className="text-gray-500">{Number(t.volume).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DepthRow({
  side, price, volume, maxVol, currency,
}: { side: 'ask' | 'bid'; price: string; volume: string; maxVol: number; currency: string }) {
  const pct = (Number(volume) / maxVol) * 100
  const isAsk = side === 'ask'
  return (
    <div className="relative flex items-center justify-between text-xs py-1 px-2 rounded overflow-hidden">
      <div
        className={`absolute inset-y-0 ${isAsk ? 'right-0 bg-rose-50' : 'right-0 bg-blue-50'}`}
        style={{ width: `${pct}%` }}
      />
      <span className={`relative font-medium ${isAsk ? 'text-rose-600' : 'text-blue-600'}`}>
        {fmtPrice(price, currency)}
      </span>
      <span className="relative text-gray-500">{Number(volume).toLocaleString()}</span>
    </div>
  )
}

// ---------------- 내 자산 탭 ----------------
function AssetsTab() {
  const { data: accounts, isLoading, isError, error } = useTossAccounts()
  const [accountSeq, setAccountSeq] = useState<string>('')

  const activeSeq = accountSeq || accounts?.[0]?.accountSeq || ''
  const { data: assetsRaw, isLoading: assetsLoading, isError: assetsErr, error: assetsE } = useTossAssets(activeSeq)

  // 응답이 배열 또는 { holdings } 형태일 수 있어 모두 대응
  const holdings: AssetHolding[] = Array.isArray(assetsRaw)
    ? assetsRaw
    : (assetsRaw?.holdings ?? [])

  return (
    <div className="bg-white rounded-2xl card-shadow p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">내 보유 자산</h2>

      <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 mb-4">
        <p className="text-[11px] text-amber-700">
          본인 토스증권 계좌가 API 클라이언트에 연동된 경우에만 조회됩니다.
        </p>
      </div>

      {isError && <ErrorBox message={(error as Error).message} />}
      {isLoading && <p className="text-xs text-gray-400 py-6 text-center">계좌 불러오는 중...</p>}

      {accounts && accounts.length > 0 && (
        <select
          value={activeSeq}
          onChange={e => setAccountSeq(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {accounts.map(a => (
            <option key={a.accountSeq} value={a.accountSeq}>
              {a.accountName ?? a.accountNumber ?? a.accountSeq}
            </option>
          ))}
        </select>
      )}
      {accounts && accounts.length === 0 && (
        <p className="text-xs text-gray-400 py-6 text-center">연동된 계좌가 없습니다.</p>
      )}

      {assetsErr && <ErrorBox message={(assetsE as Error).message} />}
      {assetsLoading && <p className="text-xs text-gray-400 py-6 text-center">자산 불러오는 중...</p>}

      <div className="space-y-1.5">
        {holdings.map((h, i) => {
          const cur = h.currency ?? 'KRW'
          const pl = Number(h.profitLoss ?? 0)
          return (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{h.name ?? h.symbol}</p>
                <p className="text-[10px] text-gray-400">
                  {h.symbol} · {Number(h.quantity ?? 0).toLocaleString()}주
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{fmtPrice(h.evaluationAmount, cur)}</p>
                {h.profitLoss !== undefined && (
                  <p className={`text-[11px] font-medium ${pl >= 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                    {pl >= 0 ? '+' : ''}{fmtPrice(h.profitLoss, cur)}
                    {h.profitLossRate !== undefined && ` (${Number(h.profitLossRate).toFixed(2)}%)`}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- 공용 ----------------
function SymbolPicker({
  symbol, watchlist, onSelect,
}: { symbol: string; watchlist: string[]; onSelect: (s: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {watchlist.map(s => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            symbol === s ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 mb-3">
      <p className="text-sm text-rose-600">{message}</p>
    </div>
  )
}
