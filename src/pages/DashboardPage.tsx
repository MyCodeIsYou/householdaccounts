import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateKo, getCurrentYearMonth } from '@/lib/utils'
import { MONTH_SHORT_LABELS } from '@/lib/constants'
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const { year, month } = getCurrentYearMonth()

export default function DashboardPage() {
  const { data: accounts = [], totalBalance } = useAccounts()
  const { transactions, totalIncome, totalExpense } = useTransactions({ year, month })
  const { data: monthlySummary = [] } = useMonthlySummary(year)

  const recentTxns = [...transactions].slice(0, 7)

  const chartData = monthlySummary.slice(Math.max(0, month - 6), month).map(s => ({
    name: MONTH_SHORT_LABELS[s.month - 1],
    수입: s.income,
    지출: s.expense,
  }))

  const statCards = [
    { label: '총 자산', value: totalBalance, icon: Wallet, color: 'text-primary' },
    { label: '이번달 수입', value: totalIncome, icon: TrendingUp, color: 'text-green-600' },
    { label: '이번달 지출', value: totalExpense, icon: TrendingDown, color: 'text-red-600' },
    { label: '이번달 잔액', value: totalIncome - totalExpense, icon: DollarSign, color: totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 계좌별 잔액 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">계좌별 잔액</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">계좌를 등록해 주세요</p>
            )}
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between py-1 border-b last:border-0">
                <div>
                  <span className="text-sm font-medium">{a.bank_name}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">{a.account_type}</Badge>
                  {a.label && <span className="ml-1 text-xs text-muted-foreground">({a.label})</span>}
                </div>
                <span className="font-semibold">{formatCurrency(a.balance)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 월별 수입/지출 차트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">월별 수입/지출 ({year}년)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="수입" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="지출" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 최근 거래 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 거래 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">이번달 거래 내역이 없습니다</p>
          )}
          <div className="space-y-2">
            {recentTxns.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-16">{formatDateKo(t.txn_date)}</span>
                  <div>
                    <span className="text-sm font-medium">{t.category?.name ?? '—'}</span>
                    {t.memo && <span className="text-xs text-muted-foreground ml-2">{t.memo}</span>}
                  </div>
                </div>
                <span className={`font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
