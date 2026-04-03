import { useState } from 'react'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'
import { MONTH_LABELS } from '@/lib/constants'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const { year: curYear, month: curMonth } = getCurrentYearMonth()
const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6']

export default function MonthlySummaryPage() {
  const [year, setYear] = useState(curYear)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  const { data: summary = [] } = useMonthlySummary(year)
  const { transactions } = useTransactions(selectedMonth ? { year, month: selectedMonth } : { year: 0 })
  const { getCategoryName } = useCategories()

  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i)

  const totalIncome = summary.reduce((s, m) => s + m.income, 0)
  const totalExpense = summary.reduce((s, m) => s + m.expense, 0)

  // 선택된 월의 카테고리별 지출 집계
  const categoryExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce<Record<string, number>>((acc, t) => {
      const name = getCategoryName(t.category_id)
      acc[name] = (acc[name] ?? 0) + t.amount
      return acc
    }, {})

  const pieData = Object.entries(categoryExpense)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* 월별 합계 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{year}년 월별 수입/지출 합계</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>월</TableHead>
                <TableHead className="text-right">수입</TableHead>
                <TableHead className="text-right">지출</TableHead>
                <TableHead className="text-right">잔액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map(s => (
                <TableRow
                  key={s.month}
                  className={`cursor-pointer ${selectedMonth === s.month ? 'bg-primary/5' : ''} ${s.month === curMonth && year === curYear ? 'font-medium' : ''}`}
                  onClick={() => setSelectedMonth(selectedMonth === s.month ? null : s.month)}
                >
                  <TableCell>
                    {MONTH_LABELS[s.month - 1]}
                    {s.month === curMonth && year === curYear && (
                      <Badge variant="secondary" className="ml-2 text-xs">이번달</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-green-600">{s.income > 0 ? formatCurrency(s.income) : '—'}</TableCell>
                  <TableCell className="text-right text-red-600">{s.expense > 0 ? formatCurrency(s.expense) : '—'}</TableCell>
                  <TableCell className={`text-right font-medium ${s.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {s.income > 0 || s.expense > 0 ? formatCurrency(s.balance, true) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">합계</TableCell>
                <TableCell className="text-right font-bold text-green-600">{formatCurrency(totalIncome)}</TableCell>
                <TableCell className="text-right font-bold text-red-600">{formatCurrency(totalExpense)}</TableCell>
                <TableCell className={`text-right font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(totalIncome - totalExpense, true)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* 선택 월 도넛 차트 */}
      {selectedMonth && pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{MONTH_LABELS[selectedMonth - 1]} 지출 카테고리 분석</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
