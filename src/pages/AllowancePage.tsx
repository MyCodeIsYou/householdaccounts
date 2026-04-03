import { useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateKo, getCurrentYearMonth } from '@/lib/utils'
import { MONTH_LABELS } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const { year: curYear, month: curMonth } = getCurrentYearMonth()

export default function AllowancePage() {
  const [year, setYear] = useState(curYear)
  const [month, setMonth] = useState(curMonth)

  const { transactions } = useTransactions({ year, month, is_allowance: true })
  const { data: monthlySummary = [] } = useMonthlySummary(year)

  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const totalAllowance = transactions.reduce((s, t) => s + t.amount, 0)

  // 연간 용돈 월별 집계
  const chartData = monthlySummary.map((_, idx) => {
    const m = idx + 1
    return { name: MONTH_LABELS[idx], amount: 0, month: m }
  })

  return (
    <div className="space-y-6">
      {/* 필터 + 합계 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white rounded-2xl card-shadow p-5 flex gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-500 font-medium">연도</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-28 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 font-medium">월</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-20 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <p className="text-xs text-gray-500 font-medium mb-1">{year}년 {month}월 용돈 합계</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalAllowance)}</p>
        </div>
      </div>

      {/* 월별 용돈 차트 */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-800">{year}년 월별 용돈 추이</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">거래 입력 시 "용돈 항목" 체크된 건이 집계됩니다.</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => formatCurrency(Number(v))}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: '12px' }}
            />
            <Bar dataKey="amount" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 용돈 거래 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">용돈 거래 내역</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-100">
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">날짜</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">카테고리</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">금액</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">결제</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">메모</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-10">
                  이달 용돈 내역이 없습니다
                </TableCell>
              </TableRow>
            )}
            {transactions.map(t => (
              <TableRow key={t.id} className="hover:bg-gray-50 transition-colors">
                <TableCell className="text-sm text-gray-600">{formatDateKo(t.txn_date)}</TableCell>
                <TableCell>
                  <span className="text-sm text-gray-700">{t.category?.name ?? '—'}</span>
                  {t.subcategory && <span className="text-xs text-gray-400"> / {t.subcategory.name}</span>}
                </TableCell>
                <TableCell className="font-semibold text-rose-500">{formatCurrency(t.amount)}</TableCell>
                <TableCell>
                  {t.payment_method && <Badge variant="secondary" className="text-xs rounded-lg bg-gray-100 text-gray-600">{t.payment_method}</Badge>}
                </TableCell>
                <TableCell className="text-sm text-gray-400">{t.memo ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
