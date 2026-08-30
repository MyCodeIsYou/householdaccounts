import { useState, useCallback } from 'react'
import { Database, Download, Clock, CheckCircle2, AlertCircle, Plus, Trash2, RefreshCw, Play, X, Filter, Search, Loader2 } from 'lucide-react'
import { useKisStatus } from '@/hooks/useKis'
import { kisApi } from '@/lib/kis'
import type { KisDailyPrice, KisFinancialRatio, KisInvestorTrend, KisConditionItem, KisConditionStock } from '@/lib/kis'

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

// ─── 조건검색 스크리너 ──────────────────────────────────────

function ScreenerPanel({ connected }: { connected: boolean }) {
  const [conditions, setConditions] = useState<KisConditionItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedSeq, setSelectedSeq] = useState<string | null>(null)
  const [results, setResults] = useState<KisConditionStock[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const loadConditions = async () => {
    setLoadingList(true)
    setError(null)
    try {
      const list = await kisApi.conditionSearchList()
      setConditions(list)
      if (list.length === 0) setError('HTS에 저장된 조건검색식이 없습니다. eFriend에서 조건검색식을 먼저 등록해주세요.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingList(false)
    }
  }

  const runSearch = async (seq: string) => {
    setSelectedSeq(seq)
    setSearching(true)
    setResults([])
    setSearched(false)
    setError(null)
    try {
      const list = await kisApi.conditionSearch(seq)
      setResults(list)
      setSearched(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'name') }
  }

  const sortedResults = [...results].sort((a, b) => {
    if (sortKey === 'name') return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    const av = Number((a as Record<string, string>)[sortKey] || '0')
    const bv = Number((b as Record<string, string>)[sortKey] || '0')
    return sortAsc ? av - bv : bv - av
  })

  const selectedName = conditions.find(c => c.condition_seq === selectedSeq)?.condition_nm

  return (
    <div className="space-y-4">
      {/* 설명 */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
        <p className="text-xs text-indigo-700">
          HTS(eFriend)에서 저장한 조건검색식을 불러와 종목을 검색합니다. 조건식이 없으면 eFriend에서 먼저 등록해주세요.
        </p>
      </div>

      {/* 조건식 목록 */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-indigo-500" />
            조건검색식
          </h3>
          <button
            onClick={loadConditions}
            disabled={!connected || loadingList}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {loadingList ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {conditions.length === 0 ? '목록 불러오기' : '새로고침'}
          </button>
        </div>

        {conditions.length === 0 && !error ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {connected ? '조건검색식 목록을 불러오세요.' : 'KIS API 연결이 필요합니다.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {conditions.map(c => (
              <button
                key={c.condition_seq}
                onClick={() => runSearch(c.condition_seq)}
                disabled={searching}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                  selectedSeq === c.condition_seq
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
              >
                {c.condition_nm}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* 검색 중 */}
      {searching && (
        <div className="rounded-xl border bg-white p-8 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
          <p className="text-sm text-gray-500">조건검색 결과를 불러오는 중...</p>
        </div>
      )}

      {/* 결과 테이블 */}
      {!searching && searched && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {selectedName && <span className="text-indigo-600">[{selectedName}]</span>}{' '}
              검색 결과 <span className="text-indigo-600">{results.length}</span>개
            </h3>
            <button
              onClick={() => selectedSeq && runSearch(selectedSeq)}
              className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> 재검색
            </button>
          </div>

          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">조건에 맞는 종목이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-2 px-3 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('name')}>
                      종목 {sortKey === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-right py-2 px-3 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('current_price')}>
                      현재가 {sortKey === 'current_price' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-right py-2 px-3 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('change_rate')}>
                      등락률 {sortKey === 'change_rate' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-right py-2 px-3 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('volume')}>
                      거래량 {sortKey === 'volume' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-right py-2 px-3 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('market_cap')}>
                      시가총액 {sortKey === 'market_cap' ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map(r => {
                    const rate = Number(r.change_rate || '0')
                    return (
                      <tr key={r.code} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900">{r.name}</span>
                            <span className="text-[10px] text-gray-400">{r.code}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900">
                          {fmtKrw(r.current_price)}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${rate > 0 ? 'text-red-600' : rate < 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                          {rate > 0 ? '+' : ''}{rate.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">
                          {fmtKrw(r.volume)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">
                          {Number(r.market_cap) > 0 ? (Number(r.market_cap) / 100000000).toFixed(0) + '억' : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
            {connected ? `${status?.mode === 'real' ? '실전' : '모의투자'}` : '미연결'}
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
