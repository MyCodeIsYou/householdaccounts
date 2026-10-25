import { MONTH_LABELS } from '@/lib/constants'
import { groupConsecutive, type ScheduleOccurrence } from '@/lib/scheduleOccurrences'
import type { Schedule } from '@/types'
import ScheduleOccurrenceRow from '@/components/schedule/ScheduleOccurrenceRow'

interface Props {
  year: number
  occurrences: ScheduleOccurrence[]
  today: string
  onEdit: (schedule: Schedule) => void
  onDelete: (schedule: Schedule) => void
}

export default function ScheduleListView({ year, occurrences, today, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-3">
      {MONTH_LABELS.map((label, index) => {
        const month = index + 1
        const prefix = `${year}-${String(month).padStart(2, '0')}-`
        const groups = groupConsecutive(occurrences.filter(item => item.date.startsWith(prefix)))
        return (
          <section key={month} className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{label}</h3>
              <span className="text-xs text-gray-400">{groups.length}건</span>
            </div>
            {groups.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">일정 없음</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {groups.map(group => (
                  <ScheduleOccurrenceRow
                    key={group.key}
                    group={group}
                    today={today}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
