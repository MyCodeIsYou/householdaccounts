import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
  year: number
  month: number
  onDateClick?: (date: string) => void
}

export default function CalendarView({ transactions, year, month, onDateClick }: Props) {
  // 해당 월의 날짜 정보
  const { days, startDay, totalIncome, totalExpense } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startDay = firstDay.getDay() // 0=일 ~ 6=토
    const daysInMonth = lastDay.getDate()

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    let totalIncome = 0
    let totalExpense = 0
    transactions.forEach(t => {
      if (t.type === 'income') totalIncome += t.amount
      else if (t.type === 'expense') totalExpense += t.amount
    })

    return { days, startDay, totalIncome, totalExpense }
  }, [transactions, year, month])

  // 날짜별 거래 그룹
  const txnByDate = useMemo(() => {
    const map: Record<number, { income: number; expense: number; items: Transaction[] }> = {}
    transactions.forEach(t => {
      const day = new Date(t.txn_date).getDate()
      if (!map[day]) map[day] = { income: 0, expense: 0, items: [] }
      if (t.type === 'income') map[day].income += t.amount
      else if (t.type === 'expense') map[day].expense += t.amount
      map[day].items.push(t)
    })
    return map
  }, [transactions])

  const today = new Date()
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDate = today.getDate()

  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  // 이전 달의 마지막 날짜들 (빈 셀 채우기)
  const prevMonthDays = useMemo(() => {
    const prevLastDay = new Date(year, month - 1, 0).getDate()
    return Array.from({ length: startDay }, (_, i) => prevLastDay - startDay + 1 + i)
  }, [year, month, startDay])

  // 다음 달의 날짜들 (빈 셀 채우기)
  const nextMonthDays = useMemo(() => {
    const totalCells = prevMonthDays.length + days.length
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
    return Array.from({ length: remaining }, (_, i) => i + 1)
  }, [prevMonthDays.length, days.length])

  return (
    <div className="space-y-4">
      {/* 월 합계 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-xl bg-emerald-50">
          <p className="text-[10px] text-emerald-600 font-medium">수입</p>
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-rose-50">
          <p className="text-[10px] text-rose-500 font-medium">지출</p>
          <p className="text-sm font-bold text-rose-600">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-indigo-50">
          <p className="text-[10px] text-indigo-600 font-medium">잔액</p>
          <p className="text-sm font-bold text-indigo-700">{formatCurrency(totalIncome - totalExpense)}</p>
        </div>
      </div>

      {/* 달력 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((d, i) => (
            <div
              key={d}
              className={`text-center py-2 text-[10px] font-semibold uppercase tracking-wider ${
                i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {/* 이전 달 */}
          {prevMonthDays.map(d => (
            <div key={`prev-${d}`} className="min-h-[72px] p-1 border-b border-r border-gray-50">
              <span className="text-[10px] text-gray-300">{d}</span>
            </div>
          ))}

          {/* 이번 달 */}
          {days.map(day => {
            const dayOfWeek = (startDay + day - 1) % 7
            const isSunday = dayOfWeek === 0
            const isSaturday = dayOfWeek === 6
            const isToday = isThisMonth && day === todayDate
            const data = txnByDate[day]
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

            return (
              <div
                key={day}
                onClick={() => onDateClick?.(dateStr)}
                className={`min-h-[72px] p-1 border-b border-r border-gray-50 transition-colors cursor-pointer hover:bg-gray-50 ${
                  isToday ? 'bg-indigo-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] font-medium leading-none ${
                    isToday
                      ? 'bg-indigo-500 text-white w-5 h-5 rounded-full flex items-center justify-center'
                      : isSunday ? 'text-rose-400' : isSaturday ? 'text-blue-400' : 'text-gray-600'
                  }`}>
                    {day}
                  </span>
                </div>
                {data && (
                  <div className="mt-0.5 space-y-0">
                    {data.income > 0 && (
                      <p className="text-[9px] text-emerald-600 font-medium truncate leading-tight">
                        +{data.income.toLocaleString()}
                      </p>
                    )}
                    {data.expense > 0 && (
                      <p className="text-[9px] text-rose-500 font-medium truncate leading-tight">
                        -{data.expense.toLocaleString()}
                      </p>
                    )}
                    {data.items.length > 1 && (
                      <p className="text-[8px] text-gray-400">{data.items.length}건</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* 다음 달 */}
          {nextMonthDays.map(d => (
            <div key={`next-${d}`} className="min-h-[72px] p-1 border-b border-r border-gray-50">
              <span className="text-[10px] text-gray-300">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
