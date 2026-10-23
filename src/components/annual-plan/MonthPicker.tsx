import { MONTH_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface MonthPickerProps {
  year: number
  curYear: number
  curMonth: number
  selectedMonth: number
  onSelect: (month: number) => void
}

export function MonthPicker({ year, curYear, curMonth, selectedMonth, onSelect }: MonthPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
      {MONTH_LABELS.map((label, index) => {
        const month = index + 1
        const selected = month === selectedMonth
        const isNow = year === curYear && month === curMonth
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(month)}
            className={cn(
              'rounded-full px-1 py-1.5 text-xs font-medium',
              selected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 card-shadow',
              !selected && isNow && 'ring-2 ring-indigo-300',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
