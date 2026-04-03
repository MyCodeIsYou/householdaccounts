import { useState } from 'react'
import { useAssetHistory } from '@/hooks/useAssetHistory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

const { year } = getCurrentYearMonth()

export default function AssetChartPage() {
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`)
  const [dateTo, setDateTo] = useState(`${year}-12-31`)
  const [applied, setApplied] = useState({ from: dateFrom, to: dateTo })

  const { data: snapshots = [], isLoading } = useAssetHistory(applied.from, applied.to)

  const chartData = snapshots.map(s => ({
    date: format(parseISO(s.snapshot_date), 'MM/dd', { locale: ko }),
    total: s.total_amount,
  }))

  const latest = snapshots.at(-1)
  const first = snapshots.at(0)
  const change = latest && first ? latest.total_amount - first.total_amount : 0

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="bg-white rounded-2xl card-shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs text-gray-500 font-medium">시작일</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 rounded-xl" />
        </div>
        <div>
          <Label className="text-xs text-gray-500 font-medium">종료일</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 rounded-xl" />
        </div>
        <Button onClick={() => setApplied({ from: dateFrom, to: dateTo })} className="rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90">조회</Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl card-shadow p-5">
          <p className="text-xs text-gray-500 font-medium mb-1">현재 총 자산</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(latest?.total_amount ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <p className="text-xs text-gray-500 font-medium mb-1">기간 변화</p>
          <p className={`text-2xl font-bold ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {change >= 0 ? '+' : ''}{formatCurrency(change)}
          </p>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <p className="text-xs text-gray-500 font-medium mb-1">데이터 포인트</p>
          <p className="text-2xl font-bold text-gray-800">{snapshots.length}개</p>
        </div>
      </div>

      {/* 차트 */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-semibold text-gray-800 mb-4">총 자산 변화 추이</h3>
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
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), '총 자산']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: '12px' }}
                cursor={{ stroke: '#e0e7ff', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#assetGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
