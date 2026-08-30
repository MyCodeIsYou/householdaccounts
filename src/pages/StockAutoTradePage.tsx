import { useState, useRef, useEffect } from 'react'
import { Play, Square, Plus, Trash2, AlertTriangle, RefreshCw, X, Search } from 'lucide-react'
import { useKisStatus, useKisBalance, useKisPrice } from '@/hooks/useKis'
import { useStockStrategies, useStockOrders, useTradeLogs } from '@/hooks/useStockStrategies'
import type { StrategyInput } from '@/hooks/useStockStrategies'
import { searchStocks } from '@/lib/stockList'
import type { KisBalance } from '@/lib/kis'

type StrategyType = 'buy' | 'sell' | 'both'

type StrategyTemplate = {
  id: string
  name: string
  type: StrategyType
  category: string
  condition: string
  description: string
  params: ParamField[]
}

type ParamField = {
  key: string
  label: string
  type: 'number' | 'select'
  default: number | string
  options?: { value: string; label: string }[]
  suffix?: string
  min?: number
  step?: number
}

const COMMON_PARAMS: ParamField[] = [
  { key: 'qty', label: '매매 수량', type: 'number', default: 1, suffix: '주', min: 1, step: 1 },
]

const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  { id: 'sma_golden_cross', name: '골든크로스 매수', type: 'buy', category: '이동평균선',
    condition: '5일선이 20일선 상향 돌파 시 매수',
    description: '단기 이동평균선이 장기선을 상향 돌파하면 매수',
    params: [
      { key: 'short_period', label: '단기 이평', type: 'number', default: 5, suffix: '일' },
      { key: 'long_period', label: '장기 이평', type: 'number', default: 20, suffix: '일' },
      ...COMMON_PARAMS,
    ] },
  { id: 'sma_dead_cross', name: '데드크로스 매도', type: 'sell', category: '이동평균선',
    condition: '5일선이 20일선 하향 돌파 시 매도',
    description: '단기 이동평균선이 장기선을 하향 돌파하면 매도',
    params: [
      { key: 'short_period', label: '단기 이평', type: 'number', default: 5, suffix: '일' },
      { key: 'long_period', label: '장기 이평', type: 'number', default: 20, suffix: '일' },
      ...COMMON_PARAMS,
    ] },
  { id: 'sma_support', name: '이평선 지지 매수', type: 'buy', category: '이동평균선',
    condition: '20일선 터치 후 반등 시 매수',
    description: '주가가 이동평균선까지 하락 후 지지받고 반등할 때 매수',
    params: [
      { key: 'period', label: '이평 기간', type: 'number', default: 20, suffix: '일' },
      ...COMMON_PARAMS,
    ] },
  { id: 'sma_60_break', name: '60일선 이탈 매도', type: 'sell', category: '이동평균선',
    condition: '60일선 하향 이탈 시 매도',
    description: '중기 추세선인 60일선을 하향 이탈하면 매도',
    params: [...COMMON_PARAMS] },

  { id: 'rsi_oversold', name: 'RSI 과매도 매수', type: 'buy', category: 'RSI',
    condition: 'RSI 30 이하 진입 후 30 상향 돌파 시 매수',
    description: 'RSI 과매도 구간에서 반등 시 매수',
    params: [
      { key: 'rsi_threshold', label: 'RSI 기준값', type: 'number', default: 30, min: 10, step: 5 },
      ...COMMON_PARAMS,
    ] },
  { id: 'rsi_overbought', name: 'RSI 과매수 매도', type: 'sell', category: 'RSI',
    condition: 'RSI 70 이상 진입 후 70 하향 돌파 시 매도',
    description: 'RSI 과매수 구간에서 하락 시 매도',
    params: [
      { key: 'rsi_threshold', label: 'RSI 기준값', type: 'number', default: 70, min: 50, step: 5 },
      ...COMMON_PARAMS,
    ] },

  { id: 'macd_cross_buy', name: 'MACD 매수 신호', type: 'buy', category: 'MACD',
    condition: 'MACD선이 시그널선 상향 돌파 시 매수',
    description: 'MACD 골든크로스 발생 시 매수',
    params: [...COMMON_PARAMS] },
  { id: 'macd_cross_sell', name: 'MACD 매도 신호', type: 'sell', category: 'MACD',
    condition: 'MACD선이 시그널선 하향 돌파 시 매도',
    description: 'MACD 데드크로스 발생 시 매도',
    params: [...COMMON_PARAMS] },

  { id: 'bb_lower', name: '볼린저 하단 매수', type: 'buy', category: '볼린저밴드',
    condition: '볼린저밴드 하단 터치 시 매수',
    description: '볼린저밴드 하단 도달 시 과매도로 판단하고 매수',
    params: [
      { key: 'period', label: '기간', type: 'number', default: 20, suffix: '일' },
      { key: 'std_dev', label: '표준편차', type: 'number', default: 2, step: 0.5 },
      ...COMMON_PARAMS,
    ] },
  { id: 'bb_upper', name: '볼린저 상단 매도', type: 'sell', category: '볼린저밴드',
    condition: '볼린저밴드 상단 터치 시 매도',
    description: '볼린저밴드 상단 도달 시 과매수로 판단하고 매도',
    params: [
      { key: 'period', label: '기간', type: 'number', default: 20, suffix: '일' },
      { key: 'std_dev', label: '표준편차', type: 'number', default: 2, step: 0.5 },
      ...COMMON_PARAMS,
    ] },

  { id: 'target_buy', name: '목표가 매수', type: 'buy', category: '가격',
    condition: '설정한 목표가 이하로 하락 시 매수',
    description: '목표 매수가에 도달하면 자동 매수',
    params: [
      { key: 'target_price', label: '목표 매수가', type: 'number', default: 0, suffix: '원', step: 100 },
      ...COMMON_PARAMS,
    ] },
  { id: 'target_sell', name: '목표가 매도', type: 'sell', category: '가격',
    condition: '설정한 목표가 이상으로 상승 시 매도',
    description: '목표 매도가에 도달하면 자동 매도 (익절)',
    params: [
      { key: 'target_price', label: '목표 매도가', type: 'number', default: 0, suffix: '원', step: 100 },
      ...COMMON_PARAMS,
    ] },
  { id: 'stop_loss', name: '손절매', type: 'sell', category: '가격',
    condition: '매입가 대비 -N% 하락 시 매도',
    description: '손실이 설정 비율 초과 시 자동 매도',
    params: [
      { key: 'avg_price', label: '매입 단가', type: 'number', default: 0, suffix: '원', step: 100 },
      { key: 'loss_pct', label: '손절 비율', type: 'number', default: 5, suffix: '%', min: 1, step: 1 },
      ...COMMON_PARAMS,
    ] },
  { id: 'trailing_stop', name: '트레일링 스탑', type: 'sell', category: '가격',
    condition: '고점 대비 -N% 하락 시 매도',
    description: '최고가에서 설정 비율만큼 하락하면 매도',
    params: [
      { key: 'trail_pct', label: '추적 비율', type: 'number', default: 3, suffix: '%', min: 1, step: 0.5 },
      ...COMMON_PARAMS,
    ] },

  { id: 'grid_buy', name: '그리드 분할매수', type: 'buy', category: '분할매매',
    condition: '가격 N% 하락마다 추가 매수',
    description: '설정 구간마다 균등하게 분할 매수',
    params: [
      { key: 'base_price', label: '기준가', type: 'number', default: 0, suffix: '원', step: 100 },
      { key: 'step_pct', label: '단계 간격', type: 'number', default: 3, suffix: '%', step: 0.5 },
      ...COMMON_PARAMS,
    ] },
  { id: 'pyramid_sell', name: '피라미드 분할매도', type: 'sell', category: '분할매매',
    condition: '가격 N% 상승마다 분할 매도',
    description: '상승 구간별로 나누어 매도',
    params: [
      { key: 'base_price', label: '기준가', type: 'number', default: 0, suffix: '원', step: 100 },
      { key: 'step_pct', label: '단계 간격', type: 'number', default: 5, suffix: '%', step: 0.5 },
      ...COMMON_PARAMS,
    ] },

  { id: 'volume_surge', name: '거래량 급증 매수', type: 'buy', category: '거래량',
    condition: '거래량 20일 평균 대비 300%+ 양봉 시 매수',
    description: '거래량 급증과 함께 상승하면 매수',
    params: [
      { key: 'volume_ratio', label: '거래량 배수', type: 'number', default: 3, suffix: '배', step: 0.5 },
      ...COMMON_PARAMS,
    ] },

  { id: 'triple_screen', name: '3중 필터 매수', type: 'buy', category: '복합',
    condition: '60일선 상승 + MACD 시그널 + RSI 반등 시 매수',
    description: '장기/중기/단기 3개 지표 모두 충족 시 매수',
    params: [...COMMON_PARAMS] },
  { id: 'mean_reversion', name: '평균 회귀 매매', type: 'both', category: '복합',
    condition: '20일 평균 대비 ±2σ 이탈 시 반대 매매',
    description: '주가가 평균에서 크게 벗어나면 반대 방향으로 매매',
    params: [...COMMON_PARAMS] },
]

const CATEGORIES = [...new Set(STRATEGY_TEMPLATES.map(t => t.category))]

function fmtKrw(val: string | number | undefined) {
  if (val === undefined || val === '') return '-'
  const n = Number(val)
  if (Number.isNaN(n)) return String(val)
  return n.toLocaleString('ko-KR') + '원'
}

function fmtRate(val: string | undefined) {
  if (!val) return '-'
  const n = Number(val)
  if (Number.isNaN(n)) return val
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function HoldingRow({ h }: { h: KisBalance }) {
  const pnl = Number(h.evlu_pfls_amt || '0')
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{h.prdt_name}</p>
        <p className="text-xs text-gray-500">{h.pdno} · {Number(h.hldg_qty).toLocaleString()}주</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-gray-900">{fmtKrw(h.evlu_amt)}</p>
        <p className={`text-xs font-medium ${pnl >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
          {fmtKrw(h.evlu_pfls_amt)} ({fmtRate(h.evlu_pfls_rt)})
        </p>
      </div>
    </div>
  )
}

function StrategyPriceTag({ symbol }: { symbol: string }) {
  const { data } = useKisPrice(symbol)
  if (!data) return <span className="text-xs text-gray-400">-</span>
  const sign = data.prdy_vrss_sign
  const isUp = sign === '1' || sign === '2'
  const isDown = sign === '4' || sign === '5'
  return (
    <span className={`text-xs font-medium ${isUp ? 'text-red-600' : isDown ? 'text-blue-600' : 'text-gray-600'}`}>
      {Number(data.stck_prpr).toLocaleString()}원
    </span>
  )
}

// ─── 전략 추가 모달 ─────────────────────────────────────────

function AddStrategyModal({ open, onClose, onAdd }: {
  open: boolean
  onClose: () => void
  onAdd: (data: StrategyInput) => void
}) {
  const [step, setStep] = useState<'template' | 'custom'>('template')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null)

  const [symbolQuery, setSymbolQuery] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState<{ code: string; name: string } | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [hlIndex, setHlIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [customName, setCustomName] = useState('')
  const [customType, setCustomType] = useState<StrategyType>('buy')
  const [customCondition, setCustomCondition] = useState('')
  const [paramValues, setParamValues] = useState<Record<string, number | string>>({})
  const [orderMethod, setOrderMethod] = useState<'market' | 'limit'>('market')

  const suggestions = searchStocks(symbolQuery)

  useEffect(() => {
    if (!open) {
      setStep('template')
      setSelectedCategory(null)
      setSelectedTemplate(null)
      setSymbolQuery('')
      setSelectedSymbol(null)
      setCustomName('')
      setCustomType('buy')
      setCustomCondition('')
      setParamValues({})
      setOrderMethod('market')
    }
  }, [open])

  useEffect(() => { setHlIndex(-1) }, [symbolQuery])

  const selectTemplate = (t: StrategyTemplate) => {
    setSelectedTemplate(t)
    setCustomName(t.name)
    setCustomType(t.type)
    setCustomCondition(t.condition)
    const defaults: Record<string, number | string> = {}
    t.params.forEach(p => { defaults[p.key] = p.default })
    setParamValues(defaults)
    setStep('custom')
  }

  const handleSymbolKey = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHlIndex(i => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHlIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && hlIndex >= 0) {
      e.preventDefault()
      pickSymbol(suggestions[hlIndex])
    }
    if (e.key === 'Escape') setShowDropdown(false)
  }

  const pickSymbol = (s: { code: string; name: string }) => {
    setSelectedSymbol(s)
    setSymbolQuery(`${s.name} (${s.code})`)
    setShowDropdown(false)
    if (!customName || customName === selectedTemplate?.name) {
      setCustomName(`${s.name} ${selectedTemplate?.name ?? '전략'}`)
    }
  }

  const qty = Number(paramValues.qty) || 1
  const canSubmit = selectedSymbol && customName.trim() && customCondition.trim() && qty > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    const { qty: _qty, ...conditionParams } = paramValues
    onAdd({
      name: customName.trim(),
      symbol: selectedSymbol!.code,
      type: customType,
      condition: customCondition.trim(),
      condition_type: selectedTemplate?.id,
      condition_params: conditionParams,
      qty,
      order_method: orderMethod,
    })
    onClose()
  }

  if (!open) return null

  const filteredTemplates = selectedCategory
    ? STRATEGY_TEMPLATES.filter(t => t.category === selectedCategory)
    : STRATEGY_TEMPLATES

  const currentParams = selectedTemplate?.params ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-base font-bold text-gray-900">
            {step === 'template' ? '전략 선택' : '전략 설정'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'template' ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    !selectedCategory ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >전체</button>
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCategory === c ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >{c}</button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="w-full text-left p-3 rounded-xl border hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        t.type === 'buy' ? 'bg-red-50 text-red-600' :
                        t.type === 'sell' ? 'bg-blue-50 text-blue-600' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                        {t.type === 'buy' ? '매수' : t.type === 'sell' ? '매도' : '매수/매도'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{t.category}</span>
                    </div>
                    <p className="text-xs text-gray-500">{t.description}</p>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t">
                <button
                  onClick={() => setStep('custom')}
                  className="w-full text-center py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                >+ 직접 입력으로 전략 만들기</button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setStep('template')} className="text-xs text-indigo-600 hover:text-indigo-800">
                &larr; 전략 템플릿 다시 선택
              </button>

              {selectedTemplate && (
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                  <p className="text-xs font-medium text-indigo-700">{selectedTemplate.category} · {selectedTemplate.name}</p>
                  <p className="text-xs text-indigo-600 mt-1">{selectedTemplate.description}</p>
                </div>
              )}

              {/* 종목 검색 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">종목 선택 *</label>
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      value={symbolQuery}
                      onChange={e => { setSymbolQuery(e.target.value); setSelectedSymbol(null); setShowDropdown(true) }}
                      onFocus={() => setShowDropdown(true)}
                      onKeyDown={handleSymbolKey}
                      placeholder="종목명 또는 코드 검색"
                      className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    />
                  </div>
                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <button
                          key={s.code}
                          onClick={() => pickSymbol(s)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                            i === hlIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-gray-400">{s.code}</span>
                          <span className="text-[10px] text-gray-300 ml-auto">{s.market}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 전략 이름 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">전략 이름 *</label>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="예: 삼성전자 RSI 과매도 매수"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
              </div>

              {/* 매매 유형 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">매매 유형</label>
                <div className="flex gap-2">
                  {([['buy', '매수', 'bg-red-50 text-red-600 border-red-200'], ['sell', '매도', 'bg-blue-50 text-blue-600 border-blue-200'], ['both', '매수/매도', 'bg-purple-50 text-purple-600 border-purple-200']] as const).map(([v, label, cls]) => (
                    <button
                      key={v}
                      onClick={() => setCustomType(v)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        customType === v ? cls + ' ring-2 ring-offset-1 ring-indigo-300' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                      }`}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* 전략 파라미터 */}
              {currentParams.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">전략 파라미터</label>
                  <div className="grid grid-cols-2 gap-3">
                    {currentParams.map(p => (
                      <div key={p.key}>
                        <label className="block text-[11px] text-gray-500 mb-0.5">{p.label}</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={paramValues[p.key] ?? p.default}
                            onChange={e => setParamValues(prev => ({ ...prev, [p.key]: Number(e.target.value) }))}
                            min={p.min}
                            step={p.step ?? 1}
                            className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 pr-10"
                          />
                          {p.suffix && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{p.suffix}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 주문 방식 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">주문 방식</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOrderMethod('market')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      orderMethod === 'market' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                    }`}
                  >시장가</button>
                  <button
                    onClick={() => setOrderMethod('limit')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      orderMethod === 'limit' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                    }`}
                  >지정가</button>
                </div>
              </div>

              {/* 조건 설명 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">매매 조건 *</label>
                <textarea
                  value={customCondition}
                  onChange={e => setCustomCondition(e.target.value)}
                  rows={2}
                  placeholder="예: RSI 30 이하 진입 후 반등 시 매수"
                  className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
              </div>
            </>
          )}
        </div>

        {step === 'custom' && (
          <div className="px-5 py-4 border-t flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >취소</button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                canSubmit ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >전략 추가</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ────────────────────────────────────────────

export default function StockAutoTradePage() {
  const { strategies, add, update, remove } = useStockStrategies()
  const { data: orders } = useStockOrders()
  const { data: tradeLogs } = useTradeLogs()
  const { data: status, isLoading: statusLoading } = useKisStatus()
  const connected = status?.connected ?? false
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useKisBalance(connected)
  const [showAddModal, setShowAddModal] = useState(false)

  const toggleStrategy = (id: string) => {
    const s = strategies.find(s => s.id === id)
    if (!s) return
    update.mutate({ id, payload: { status: s.status === 'running' ? 'stopped' : 'running' } })
  }

  const removeStrategy = (id: string) => {
    remove.mutate(id)
  }

  const handleAddStrategy = (data: StrategyInput) => {
    add.mutate(data)
  }

  const holdings = balanceData?.holdings ?? []
  const summary = balanceData?.summary
  const recentOrders = orders ?? []

  const activeHoldings = holdings.filter(h => Number(h.hldg_qty) > 0)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 헤더 + API 상태 한 줄 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">주식 자동매매</h1>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className={`text-xs font-medium ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
              {statusLoading ? '확인중...' : connected ? `${status?.mode === 'real' ? '실전' : '모의투자'}` : '미연결'}
            </span>
            {status?.mode === 'real' && (
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-bold">실전</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          전략 추가
        </button>
      </div>

      {!connected && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          .env.local에 KIS_APPKEY / KIS_APPSECRET을 설정해 주세요.
        </p>
      )}

      {/* 계좌 잔고 — 컴팩트 */}
      {connected && (() => {
        const s = summary ?? {} as Record<string, string>
        const deposit = Number(s.dnca_tot_amt || '0')
        const stockEvlu = Number(s.scts_evlu_amt || '0')
        const totalAsset = Number(s.tot_evlu_amt || '0')
        const purchaseAmt = Number(s.pchs_amt_smtl_amt || '0')
        const pnl = Number(s.evlu_pfls_smtl_amt || '0')
        const pnlRate = purchaseAmt > 0 ? (pnl / purchaseAmt) * 100 : 0
        return (
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900">{totalAsset.toLocaleString('ko-KR')}원</span>
                {pnl !== 0 && (
                  <span className={`text-xs font-medium ${pnl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('ko-KR')}원 ({pnl >= 0 ? '+' : ''}{pnlRate.toFixed(2)}%)
                  </span>
                )}
              </div>
              <button
                onClick={() => refetchBalance()}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${balanceLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>예수금 <b className="text-gray-700">{deposit.toLocaleString('ko-KR')}</b></span>
              <span>주식 <b className="text-gray-700">{stockEvlu.toLocaleString('ko-KR')}</b></span>
              {purchaseAmt > 0 && <span>매입 <b className="text-gray-700">{purchaseAmt.toLocaleString('ko-KR')}</b></span>}
            </div>
            {activeHoldings.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1.5">
                {activeHoldings.map(h => (
                  <HoldingRow key={h.pdno} h={h} />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* 전략 목록 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">매매 전략 ({strategies.length})</h2>
        {strategies.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            등록된 전략이 없습니다.
          </div>
        ) : (
          strategies.map(s => (
            <div key={s.id} className="rounded-xl border bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      s.type === 'buy' ? 'bg-red-50 text-red-600' :
                      s.type === 'sell' ? 'bg-blue-50 text-blue-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {s.type === 'buy' ? '매수' : s.type === 'sell' ? '매도' : '매수/매도'}
                    </span>
                    {s.qty > 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{s.qty}주</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{s.order_method === 'market' ? '시장가' : '지정가'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-500">{s.symbol} · {s.condition}</p>
                    {connected && <StrategyPriceTag symbol={s.symbol} />}
                    {s.last_signal_at && (
                      <span className="text-[10px] text-gray-400 ml-auto hidden sm:inline">
                        시그널 {new Date(s.last_signal_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleStrategy(s.id)}
                    disabled={!connected}
                    className={`p-1.5 rounded-lg transition-colors ${
                      !connected ? 'bg-gray-50 text-gray-300 cursor-not-allowed' :
                      s.status === 'running'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {s.status === 'running' ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => removeStrategy(s.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 매매 이력 + 실행 로그 — 2단 그리드 (데스크탑) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 매매 이력 */}
        <div className="rounded-xl border bg-white">
          <div className="px-4 py-2.5 border-b">
            <h2 className="text-sm font-semibold text-gray-700">매매 이력</h2>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-400 text-xs">이력 없음</div>
          ) : (
            <div className="divide-y max-h-64 overflow-y-auto">
              {recentOrders.map(o => (
                <div key={o.id} className="px-4 py-2.5 flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    o.order_type === 'buy' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {o.order_type === 'buy' ? '매수' : '매도'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-900">{o.symbol}</span>
                      <span className="text-[10px] text-gray-500">{o.qty}주×{Number(o.price).toLocaleString()}</span>
                      <span className={`text-[10px] px-1 py-0.5 rounded font-medium ml-auto shrink-0 ${
                        o.status === 'filled' ? 'text-emerald-600' :
                        o.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {o.status === 'filled' ? '체결' : o.status === 'failed' ? '실패' : '대기'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">
                      {o.trigger_memo ?? ''} {new Date(o.ordered_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {o.error && <p className="text-[10px] text-red-500 truncate">{o.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 실행 로그 */}
        <div className="rounded-xl border bg-gray-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-400">엔진 로그</h2>
          </div>
          {!tradeLogs || tradeLogs.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-600 text-xs">로그 없음</div>
          ) : (
            <div className="p-3 max-h-64 overflow-y-auto font-mono text-[11px] space-y-0.5">
              {tradeLogs.map(log => {
                const detail = log.detail as Record<string, unknown>
                const isSignal = log.action.startsWith('signal_')
                const isError = log.action === 'error'
                const color = isError ? 'text-red-400' : isSignal ? 'text-emerald-400' : 'text-gray-500'
                const time = new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                return (
                  <div key={log.id} className={`${color} flex gap-1.5`}>
                    <span className="text-gray-600 shrink-0">{time}</span>
                    <span className={`shrink-0 ${isSignal ? 'text-yellow-400 font-bold' : isError ? 'text-red-400' : 'text-gray-600'}`}>
                      {isSignal ? (log.action === 'signal_buy' ? '[매수]' : '[매도]') : isError ? '[에러]' : '[체크]'}
                    </span>
                    <span className="text-blue-400 shrink-0">{log.symbol}</span>
                    <span className="truncate">
                      {detail.memo as string ?? detail.error as string ?? JSON.stringify(detail)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 투자 주의 — 하단 작은 배너 */}
      <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
        <AlertTriangle className="h-3 w-3 text-gray-300" />
        자동매매는 시장 상황에 따라 손실이 발생할 수 있습니다. 반드시 모의투자로 테스트 후 실전 적용하세요.
      </p>

      <AddStrategyModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddStrategy}
      />
    </div>
  )
}
