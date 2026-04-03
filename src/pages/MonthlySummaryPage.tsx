import { useState } from 'react'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
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
          <SelectTrigger className="w-28 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-gray-400">월을 클릭하면 카테고리별 분석을 볼 수 있습니다</span>
      </div>

      {/* 월별 합계 테이블 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{year}년 월별 수입/지출 합계</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-100">
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">월</TableHead>
              <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">수입</TableHead>
              <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">지출</TableHead>
              <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">잔액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map(s => (
              <TableRow
                key={s.month}
                className={`cursor-pointer transition-colors ${selectedMonth === s.month ? 'bg-indigo-50/60' : 'hover:bg-gray-50'} ${s.month === curMonth && year === curYear ? 'font-medium' : ''}`}
                onClick={() => setSelectedMonth(selectedMonth === s.month ? null : s.month)}
              >
                <TableCell className="text-gray-700">
                  {MONTH_LABELS[s.month - 1]}
                  {s.month === curMonth && year === curYear && (
                    <Badge variant="secondary" className="ml-2 text-xs rounded-lg bg-indigo-100 text-indigo-600">이번달</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-emerald-600 font-medium">{s.income > 0 ? formatCurrency(s.income) : '—'}</TableCell>
                <TableCell className="text-right text-rose-500 font-medium">{s.expense > 0 ? formatCurrency(s.expense) : '—'}</TableCell>
                <TableCell className={`text-right font-semibold ${s.balance >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
                  {s.income > 0 || s.expense > 0 ? formatCurrency(s.balance, true) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-gray-50">
              <TableCell className="font-bold text-gray-700">합계</TableCell>
              <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(totalIncome)}</TableCell>
              <TableCell className="text-right font-bold text-rose-500">{formatCurrency(totalExpense)}</TableCell>
              <TableCell className={`text-right font-bold ${totalIncome - totalExpense >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
                {formatCurrency(totalIncome - totalExpense, true)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* 선택 월 도넛 차트 */}
      {selectedMonth && pieData.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-4">{MONTH_LABELS[selectedMonth - 1]} 지출 카테고리 분석</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: '12px' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
