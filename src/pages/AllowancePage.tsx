import { useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      {/* 필터 */}
      <div className="flex gap-3 items-end">
        <div>
          <Label className="text-xs">연도</Label>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">월</Label>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* 이번달 합계 */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{year}년 {month}월 용돈 합계</p>
          <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(totalAllowance)}</p>
        </CardContent>
      </Card>

      {/* 월별 용돈 차트 (해당 연도, 카테고리명 '용돈'만) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{year}년 월별 용돈 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">거래 입력 시 "용돈 항목" 체크된 건이 집계됩니다.</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="amount" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 용돈 거래 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">용돈 거래 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>결제</TableHead>
                <TableHead>메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    이달 용돈 내역이 없습니다
                  </TableCell>
                </TableRow>
              )}
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDateKo(t.txn_date)}</TableCell>
                  <TableCell>
                    <span className="text-sm">{t.category?.name ?? '—'}</span>
                    {t.subcategory && <span className="text-xs text-muted-foreground"> / {t.subcategory.name}</span>}
                  </TableCell>
                  <TableCell className="font-medium text-red-600">{formatCurrency(t.amount)}</TableCell>
                  <TableCell>
                    {t.payment_method && <Badge variant="secondary" className="text-xs">{t.payment_method}</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.memo ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
