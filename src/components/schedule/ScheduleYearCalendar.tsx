import { useMemo } from 'react'
import { MONTH_LABELS } from '@/lib/constants'
import type { ScheduleOccurrence } from '@/lib/scheduleOccurrences'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  year: number
  occurrences: ScheduleOccurrence[]
  today: string
  onDayClick: (date: string) => void
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export default function ScheduleYearCalendar({ year, occurrences, today, onDayClick }: Props) {
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleOccurrence[]>()
    for (const item of occurrences) {
      const list = map.get(item.date)
      if (list) list.push(item)
      else map.set(item.date, [item])
    }
    return map
  }, [occurrences])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {MONTH_LABELS.map((label, index) => {
        const month = index + 1
        const startPad = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
        const count = daysInMonth(year, month)
        const cells: Array<number | null> = [
          ...Array.from({ length: startPad }, () => null),
          ...Array.from({ length: count }, (_, day) => day + 1),
        ]
        while (cells.length % 7 !== 0) cells.push(null)

        return (
          <section key={month} className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
            </div>
            <div className="grid grid-cols-7 px-1 pt-1">
              {WEEKDAYS.map((day, weekday) => (
                <div
                  key={day}
                  className={`text-center text-[10px] font-semibold py-1 ${
                    weekday === 0 ? 'text-rose-400' : weekday === 6 ? 'text-blue-400' : 'text-gray-400'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 px-1 pb-2">
              {cells.map((day, cellIndex) => {
                if (day == null) return <div key={`empty-${cellIndex}`} className="h-9" />
                const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const items = byDate.get(date) ?? []
                const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
                const isToday = date === today
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onDayClick(date)}
                    title={items.map(item => item.schedule.title).join(', ') || undefined}
                    className="h-9 flex flex-col items-center justify-center rounded-lg hover:bg-gray-50"
                  >
                    <span className={`text-[11px] leading-none font-medium ${
                      isToday
                        ? 'bg-indigo-500 text-white w-5 h-5 rounded-full flex items-center justify-center'
                        : weekday === 0 ? 'text-rose-400' : weekday === 6 ? 'text-blue-400' : 'text-gray-600'
                    }`}>
                      {day}
                    </span>
                    <span className={`mt-0.5 h-1 w-1 rounded-full ${items.length > 0 ? 'bg-indigo-500' : 'bg-transparent'}`} />
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
