import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateKo, getCurrentYearMonth } from '@/lib/utils'
import { MONTH_SHORT_LABELS } from '@/lib/constants'
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

const { year, month } = getCurrentYearMonth()

const statCards = [
  {
    key: 'asset',
    label: '총 자산',
    icon: Wallet,
    gradient: 'gradient-asset',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    key: 'income',
    label: '이번달 수입',
    icon: TrendingUp,
    gradient: 'gradient-income',
    textColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    key: 'expense',
    label: '이번달 지출',
    icon: TrendingDown,
    gradient: 'gradient-expense',
    textColor: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
  {
    key: 'balance',
    label: '이번달 잔액',
    icon: DollarSign,
    gradient: 'gradient-balance',
    textColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
]

export default function DashboardPage() {
  const { data: accounts = [], totalBalance } = useAccounts()
  const { transactions, totalIncome, totalExpense } = useTransactions({ year, month })
  const { data: monthlySummary = [] } = useMonthlySummary(year)

  const values: Record<string, number> = {
    asset: totalBalance,
    income: totalIncome,
    expense: totalExpense,
    balance: totalIncome - totalExpense,
  }

  const recentTxns = transactions.slice(0, 6)

  const chartData = monthlySummary.slice(0, month).map(s => ({
    name: MONTH_SHORT_LABELS[s.month - 1],
    수입: s.income,
    지출: s.expense,
  }))

  return (
    <div className="space-y-6">
      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon: Icon, gradient, textColor }) => (
          <div key={key} className="bg-white rounded-2xl card-shadow p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">{label}</span>
              <div className={`w-9 h-9 rounded-xl ${gradient} flex items-center justify-center shadow-sm`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <p className={`text-2xl font-bold tracking-tight ${textColor}`}>
                {formatCurrency(values[key])}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 계좌별 잔액 */}
        <div className="lg:col-span-2 bg-white rounded-2xl card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">계좌별 잔액</h3>
            <span className="text-xs text-gray-400">{accounts.length}개 계좌</span>
          </div>
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">계좌를 등록해 주세요</p>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                      <Wallet className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.bank_name}</p>
                      <p className="text-xs text-gray-400">{a.label ?? a.account_type}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{formatCurrency(a.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 월별 차트 */}
        <div className="lg:col-span-3 bg-white rounded-2xl card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">월별 수입/지출</h3>
            <span className="text-xs text-gray-400">{year}년</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: '12px' }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="수입" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="지출" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 최근 거래 */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">최근 거래 내역</h3>
          <span className="text-xs text-gray-400">{month}월 기준</span>
        </div>
        {recentTxns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">이번달 거래 내역이 없습니다</p>
        ) : (
          <div className="space-y-1">
            {recentTxns.map(t => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    t.type === 'income' ? 'bg-emerald-100' : 'bg-rose-100'
                  }`}>
                    {t.type === 'income'
                      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      : <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {t.category?.name ?? '기타'}
                    </p>
                    <p className="text-xs text-gray-400">{formatDateKo(t.txn_date)}{t.memo ? ` · ${t.memo}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                  {t.payment_method && (
                    <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{t.payment_method}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
