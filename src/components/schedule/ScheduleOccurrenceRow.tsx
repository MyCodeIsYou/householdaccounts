import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  addDays,
  formatDateSpan,
  formatScheduleTime,
  recurrenceLabel,
  type ScheduleGroup,
} from '@/lib/scheduleOccurrences'
import type { Schedule } from '@/types'

interface Props {
  group: ScheduleGroup
  today: string
  showYear?: boolean
  onEdit: (schedule: Schedule) => void
  onDelete: (schedule: Schedule) => void
}

export default function ScheduleOccurrenceRow({ group, today, showYear = false, onEdit, onDelete }: Props) {
  const { schedule, dates } = group
  const repeat = recurrenceLabel(schedule.recurrence)
  const includesToday = dates.includes(today)
  const startsTomorrow = dates[0] === addDays(today, 1)

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">
          {includesToday && <span className="text-indigo-600 mr-1">오늘</span>}
          {!includesToday && startsTomorrow && <span className="text-indigo-600 mr-1">내일</span>}
          {formatDateSpan(dates, showYear)}
          <span className="text-gray-400 font-normal"> · {formatScheduleTime(schedule.start_time, schedule.end_time)}</span>
        </p>
        <div className="flex items-center gap-2 min-w-0 mt-0.5">
          <p className="text-sm text-gray-700 truncate">{schedule.title}</p>
          {repeat && (
            <Badge variant="secondary" className="text-[10px] rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              {repeat}
            </Badge>
          )}
          {dates.length > 1 && (
            <span className="text-[10px] text-gray-400 shrink-0">{dates.length}일</span>
          )}
        </div>
        {schedule.memo && <p className="text-xs text-gray-400 truncate mt-0.5">{schedule.memo}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => onEdit(schedule)} aria-label="수정">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(schedule)} aria-label="삭제">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  )
}
