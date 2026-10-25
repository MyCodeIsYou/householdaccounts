import { useMemo, useState } from 'react'
import { CalendarDays, List, Plus } from 'lucide-react'
import { useSchedules } from '@/hooks/useSchedules'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getCurrentYearMonth, unknownErrorMessage } from '@/lib/utils'
import {
  groupsOnDate,
  occurrencesInYear,
  todayISO,
  upcomingGroups,
} from '@/lib/scheduleOccurrences'
import type { Schedule, ScheduleWrite } from '@/types'
import ScheduleFormDialog from '@/components/schedule/ScheduleFormDialog'
import ScheduleListView from '@/components/schedule/ScheduleListView'
import ScheduleYearCalendar from '@/components/schedule/ScheduleYearCalendar'
import ScheduleDayDialog from '@/components/schedule/ScheduleDayDialog'
import ScheduleOccurrenceRow from '@/components/schedule/ScheduleOccurrenceRow'

const { year: currentYear } = getCurrentYearMonth()

export default function SchedulePage() {
  const { schedules, isLoading, error, addSchedule, updateSchedule, removeSchedule } = useSchedules()
  const [year, setYear] = useState(currentYear)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [initialDate, setInitialDate] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Schedule | null>(null)
  const today = todayISO()

  const years = useMemo(() => {
    const set = new Set<number>()
    for (let value = currentYear - 1; value <= currentYear + 4; value++) set.add(value)
    set.add(year)
    return Array.from(set).sort((a, b) => a - b)
  }, [year])

  const yearOccurrences = useMemo(() => occurrencesInYear(schedules, year), [schedules, year])
  const upcoming = useMemo(() => upcomingGroups(schedules, today), [schedules, today])
  const dayGroups = useMemo(
    () => (day ? groupsOnDate(yearOccurrences, day) : []),
    [day, yearOccurrences],
  )

  function openAdd(date?: string) {
    setDay(null)
    setEditing(null)
    setInitialDate(date ?? null)
    setFormOpen(true)
  }

  function openEdit(schedule: Schedule) {
    setDay(null)
    setEditing(schedule)
    setInitialDate(null)
    setFormOpen(true)
  }

  function requestDelete(schedule: Schedule) {
    setDay(null)
    setPendingDelete(schedule)
  }

  async function handleSubmit(payload: ScheduleWrite) {
    if (editing) {
      await updateSchedule.mutateAsync({ id: editing.id, payload })
    } else {
      await addSchedule.mutateAsync(payload)
    }
  }

  const rawError = error ? unknownErrorMessage(error, '일정을 불러오지 못했습니다.') : null
  const loadError = rawError && /schedules|schema cache/i.test(rawError)
    ? '일정 테이블이 아직 없습니다. supabase/35_schedules.sql 을 적용해 주세요.'
    : rawError

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl card-shadow p-4 flex flex-wrap gap-3 items-end justify-between">
        <div>
          <Label className="text-xs text-gray-500 font-medium">연도</Label>
          <Select value={String(year)} onValueChange={value => setYear(Number(value))}>
            <SelectTrigger className="w-28 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(value => <SelectItem key={value} value={String(value)}>{value}년</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 border rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              title="리스트"
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              title="달력"
              aria-pressed={viewMode === 'calendar'}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => openAdd()} className="rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90">
            <Plus className="h-4 w-4" />
            일정 추가
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-10">불러오는 중...</p>
      ) : loadError ? (
        <p className="text-sm text-rose-500 text-center py-10">{loadError}</p>
      ) : (
        <>
          <section className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">다가올 일정</h3>
              <p className="text-xs text-gray-400 mt-0.5">오늘부터 가까운 5건</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">다가올 일정이 없습니다</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {upcoming.map(group => (
                  <ScheduleOccurrenceRow
                    key={group.key}
                    group={group}
                    today={today}
                    showYear
                    onEdit={openEdit}
                    onDelete={requestDelete}
                  />
                ))}
              </ul>
            )}
          </section>

          {viewMode === 'list' ? (
            <ScheduleListView
              year={year}
              occurrences={yearOccurrences}
              today={today}
              onEdit={openEdit}
              onDelete={requestDelete}
            />
          ) : (
            <ScheduleYearCalendar
              year={year}
              occurrences={yearOccurrences}
              today={today}
              onDayClick={setDay}
            />
          )}
        </>
      )}

      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        initialDate={initialDate}
        pending={addSchedule.isPending || updateSchedule.isPending}
        onSubmit={handleSubmit}
      />

      <ScheduleDayDialog
        date={day}
        today={today}
        groups={dayGroups}
        onOpenChange={open => { if (!open) setDay(null) }}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={requestDelete}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDelete ? `${pendingDelete.title} 일정을 삭제하시겠습니까?` : '일정을 삭제하시겠습니까?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.recurrence !== 'none'
                ? '반복 일정 묶음 전체가 삭제됩니다. 펼쳐진 날짜도 함께 사라집니다.'
                : '이 작업은 되돌릴 수 없습니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDelete) return
                removeSchedule.mutate(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
