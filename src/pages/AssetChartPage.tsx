import { useState, useMemo } from 'react'
import { useAssetHistory } from '@/hooks/useAssetHistory'
import { useAccounts } from '@/hooks/useAccounts'
import { useAccountSnapshots } from '@/hooks/useAccountSnapshots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

const { year } = getCurrentYearMonth()

const ACCOUNT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#a855f7', '#3b82f6', '#e11d48', '#22c55e', '#eab308',
]

export default function AssetChartPage() {
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`)
  const [dateTo, setDateTo] = useState(`${year}-12-31`)
  const [applied, setApplied] = useState({ from: dateFrom, to: dateTo })

  const { data: snapshots = [], isLoading } = useAssetHistory(applied.from, applied.to)
  const { data: accounts = [] } = useAccounts()

  const snapshotIds = useMemo(() => snapshots.map(s => s.id), [snapshots])
  const { data: accountSnapshotsRaw = [] } = useAccountSnapshots(snapshotIds)

  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string> | null>(null)

  const activeAccounts = accounts.filter(a => a.is_active)

  const effectiveSelected = useMemo(() => {
    if (selectedAccountIds !== null) return selectedAccountIds
    return new Set(activeAccounts.map(a => a.id))
  }, [selectedAccountIds, activeAccounts])

  function toggleAccount(id: string) {
    setSelectedAccountIds(prev => {
      const next = new Set(prev ?? activeAccounts.map(a => a.id))
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (effectiveSelected.size === activeAccounts.length) {
      setSelectedAccountIds(new Set())
    } else {
      setSelectedAccountIds(new Set(activeAccounts.map(a => a.id)))
    }
  }

  const accountSnapshotMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const as of accountSnapshotsRaw) {
      if (!map.has(as.asset_snapshot_id)) map.set(as.asset_snapshot_id, new Map())
      map.get(as.asset_snapshot_id)!.set(as.account_id, as.amount)
    }
    return map
  }, [accountSnapshotsRaw])

  const chartData = useMemo(() => {
    return snapshots.map(s => {
      const acctMap = accountSnapshotMap.get(s.id)
      const row: Record<string, string | number> = {
        date: format(parseISO(s.snapshot_date), 'MM/dd', { locale: ko }),
        fullDate: format(parseISO(s.snapshot_date), 'yyyy년 MM월 dd일', { locale: ko }),
        total: s.total_amount,
      }

      let selectedTotal = 0
      for (const acct of activeAccounts) {
        const amount = acctMap?.get(acct.id) ?? 0
        row[`acct_${acct.id}`] = amount
        if (effectiveSelected.has(acct.id)) {
          selectedTotal += amount
        }
      }
      row.selectedTotal = selectedTotal

      return row
    })
  }, [snapshots, accountSnapshotMap, activeAccounts, effectiveSelected])

  const hasAccountData = accountSnapshotsRaw.length > 0

  const latest = snapshots.at(-1)
  const first = snapshots.at(0)
  const change = latest && first ? latest.total_amount - first.total_amount : 0

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="bg-white rounded-2xl card-shadow p-3 sm:p-4 flex flex-nowrap sm:flex-wrap gap-2 sm:gap-3 items-end">
        <div className="flex-1 min-w-0 sm:flex-initial">
          <Label className="text-xs text-gray-500 font-medium">시작일</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-40 rounded-xl px-2 sm:px-3" />
        </div>
        <div className="flex-1 min-w-0 sm:flex-initial">
          <Label className="text-xs text-gray-500 font-medium">종료일</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-40 rounded-xl px-2 sm:px-3" />
        </div>
        <Button onClick={() => setApplied({ from: dateFrom, to: dateTo })} className="shrink-0 rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90 px-3 sm:px-4">조회</Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl card-shadow p-3 sm:p-5 min-w-0">
          <p className="text-xs text-gray-500 font-medium mb-1 truncate">현재 총 자산</p>
          <p className="text-base sm:text-xl lg:text-2xl font-bold text-amber-600 truncate">{formatCurrency(latest?.total_amount ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-3 sm:p-5 min-w-0">
          <p className="text-xs text-gray-500 font-medium mb-1 truncate">기간 변화</p>
          <p className={`text-base sm:text-xl lg:text-2xl font-bold truncate ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {change >= 0 ? '+' : ''}{formatCurrency(change)}
          </p>
        </div>
        <div className="hidden sm:block bg-white rounded-2xl card-shadow p-3 sm:p-5 min-w-0">
          <p className="text-xs text-gray-500 font-medium mb-1 truncate">데이터 포인트</p>
          <p className="text-base sm:text-xl lg:text-2xl font-bold text-gray-800 truncate">{snapshots.length}개</p>
        </div>
      </div>

      {/* 계좌별 차트 */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-semibold text-gray-800 mb-4">자산 변화 추이</h3>
        {isLoading && <div className="h-64 flex items-center justify-center text-gray-400">로딩 중...</div>}
        {!isLoading && chartData.length === 0 && (
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p>데이터가 없습니다.</p>
              <p className="text-sm mt-1">계좌 잔액을 등록하거나 수정하면 자동으로 기록됩니다.</p>
            </div>
          </div>
        )}
        {!isLoading && chartData.length > 0 && (
          <>

          {/* 계좌 선택 체크박스 */}
          {hasAccountData && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={toggleAll}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                effectiveSelected.size === activeAccounts.length
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              전체
            </button>
            {activeAccounts.map((acct, idx) => {
              const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]
              const isSelected = effectiveSelected.has(acct.id)
              return (
                <button
                  key={acct.id}
                  onClick={() => toggleAccount(acct.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                  style={isSelected ? { backgroundColor: color, borderColor: color } : undefined}
                >
                  {acct.bank_name} · {acct.label ?? acct.account_type}
                </button>
              )
            })}
          </div>
          )}

          {/* 합산 + 개별 계좌 통합 차트 */}
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="selectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                formatter={(v, name) => {
                  if (name === 'selectedTotal' || name === 'total') return [formatCurrency(Number(v)), '총 자산']
                  const acctId = name.replace('acct_', '')
                  const acct = activeAccounts.find(a => a.id === acctId)
                  const label = acct ? `${acct.bank_name} · ${acct.label ?? acct.account_type}` : name
                  return [formatCurrency(Number(v)), label]
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: '12px' }}
                cursor={{ stroke: '#e0e7ff', strokeWidth: 1 }}
              />
              <Legend
                formatter={(value: string) => {
                  if (value === 'selectedTotal' || value === 'total') return '총 자산'
                  const acctId = value.replace('acct_', '')
                  const acct = activeAccounts.find(a => a.id === acctId)
                  return acct ? `${acct.bank_name} · ${acct.label ?? acct.account_type}` : value
                }}
                wrapperStyle={{ fontSize: '11px' }}
              />
              {(!hasAccountData || effectiveSelected.size > 1) && (
                <Area
                  type="monotone"
                  dataKey={hasAccountData ? 'selectedTotal' : 'total'}
                  name={hasAccountData ? 'selectedTotal' : 'total'}
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#selectedGradient)"
                  strokeDasharray={hasAccountData ? '6 3' : undefined}
                />
              )}
              {hasAccountData && activeAccounts.map((acct, idx) => {
                if (!effectiveSelected.has(acct.id)) return null
                return (
                  <Area
                    key={acct.id}
                    type="monotone"
                    dataKey={`acct_${acct.id}`}
                    stroke={ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]}
                    strokeWidth={2}
                    fill="transparent"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
        </>
        )}
      </div>
    </div>
  )
}
