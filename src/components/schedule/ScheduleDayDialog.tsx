import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { formatScheduleDate, type ScheduleGroup } from '@/lib/scheduleOccurrences'
import type { Schedule } from '@/types'
import ScheduleOccurrenceRow from '@/components/schedule/ScheduleOccurrenceRow'

interface Props {
  date: string | null
  today: string
  groups: ScheduleGroup[]
  onOpenChange: (open: boolean) => void
  onAdd: (date: string) => void
  onEdit: (schedule: Schedule) => void
  onDelete: (schedule: Schedule) => void
}

export default function ScheduleDayDialog({ date, today, groups, onOpenChange, onAdd, onEdit, onDelete }: Props) {
  return (
    <Dialog open={!!date} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{date ? formatScheduleDate(date, true) : '일정'}</DialogTitle>
        </DialogHeader>
        {date && (
          <div className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">이 날짜의 일정이 없습니다</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl max-h-80 overflow-y-auto">
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
            <Button
              type="button"
              onClick={() => onAdd(date)}
              className="w-full rounded-xl gradient-primary text-white border-0"
            >
              <Plus className="h-4 w-4" />
              이 날짜에 추가
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
