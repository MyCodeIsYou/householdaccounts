import { useState } from 'react'
import { useAssetHistory } from '@/hooks/useAssetHistory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs">시작일</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">종료일</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={() => setApplied({ from: dateFrom, to: dateTo })}>조회</Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">현재 총 자산</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(latest?.total_amount ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">기간 변화</p>
            <p className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{formatCurrency(change)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">데이터 포인트</p>
            <p className="text-2xl font-bold">{snapshots.length}개</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">총 자산 변화 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="h-64 flex items-center justify-center text-muted-foreground">로딩 중...</div>}
          {!isLoading && chartData.length === 0 && (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
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
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), '총 자산']} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#assetGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
