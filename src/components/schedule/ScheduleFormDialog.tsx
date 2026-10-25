import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RECURRENCE_OPTIONS, todayISO } from '@/lib/scheduleOccurrences'
import type { Recurrence, Schedule, ScheduleWrite } from '@/types'

interface FormState {
  title: string
  memo: string
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  recurrence: Recurrence
  recurrence_until: string
}

function emptyForm(date: string): FormState {
  return {
    title: '',
    memo: '',
    start_date: date,
    end_date: date,
    start_time: '',
    end_time: '',
    recurrence: 'none',
    recurrence_until: '',
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Schedule | null
  initialDate: string | null
  pending: boolean
  onSubmit: (payload: ScheduleWrite) => Promise<void>
}

export default function ScheduleFormDialog({ open, onOpenChange, editing, initialDate, pending, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm(todayISO()))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        title: editing.title,
        memo: editing.memo ?? '',
        start_date: editing.start_date.slice(0, 10),
        end_date: (editing.end_date ?? editing.start_date).slice(0, 10),
        start_time: editing.start_time?.slice(0, 5) ?? '',
        end_time: editing.end_time?.slice(0, 5) ?? '',
        recurrence: editing.recurrence,
        recurrence_until: editing.recurrence_until?.slice(0, 10) ?? '',
      })
    } else {
      setForm(emptyForm(initialDate ?? todayISO()))
    }
    setError('')
  }, [open, editing, initialDate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) {
      setError('제목을 입력해 주세요.')
      return
    }
    if (!form.start_date || !form.end_date) {
      setError('시작 날짜와 종료 날짜를 선택해 주세요.')
      return
    }
    if (form.end_date < form.start_date) {
      setError('종료 날짜는 시작 날짜 이후여야 합니다.')
      return
    }
    const singleDay = form.end_date === form.start_date
    if (singleDay && form.start_time && form.end_time && form.end_time < form.start_time) {
      setError('종료 시간은 시작 시간 이후여야 합니다.')
      return
    }
    if (form.recurrence !== 'none' && form.recurrence_until && form.recurrence_until < form.start_date) {
      setError('반복 종료일은 시작 날짜 이후여야 합니다.')
      return
    }

    try {
      await onSubmit({
        title,
        memo: form.memo.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date > form.start_date ? form.end_date : null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        recurrence: form.recurrence,
        recurrence_until: form.recurrence === 'none' ? null : (form.recurrence_until || null),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? '일정 수정' : '일정 추가'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-title">제목</Label>
            <Input
              id="schedule-title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="예: 가족 여행"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">시작 날짜</Label>
              <Input
                id="schedule-date"
                type="date"
                value={form.start_date}
                onChange={e => {
                  const start_date = e.target.value
                  setForm(f => ({
                    ...f,
                    start_date,
                    end_date: f.end_date < start_date ? start_date : f.end_date,
                  }))
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-end-date">종료 날짜</Label>
              <Input
                id="schedule-end-date"
                type="date"
                min={form.start_date}
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">종료 날짜까지 그 사이 모든 날에 표시됩니다. 반복을 켜면 같은 길이로 반복됩니다.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="schedule-start">시작 시간</Label>
              <Input
                id="schedule-start"
                type="time"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-end">종료 시간</Label>
              <Input
                id="schedule-end"
                type="time"
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>반복</Label>
            <Select
              value={form.recurrence}
              onValueChange={value => setForm(f => ({
                ...f,
                recurrence: value as Recurrence,
                recurrence_until: value === 'none' ? '' : f.recurrence_until,
              }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.recurrence !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="schedule-until">반복 종료일</Label>
              <Input
                id="schedule-until"
                type="date"
                value={form.recurrence_until}
                onChange={e => setForm(f => ({ ...f, recurrence_until: e.target.value }))}
              />
              <p className="text-xs text-gray-400">비우면 종료일 없이 이어집니다. 화면에는 보고 있는 해와 다가올 일정만 표시됩니다.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="schedule-memo">메모</Label>
            <Textarea
              id="schedule-memo"
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              placeholder="메모"
            />
          </div>
          {editing && editing.recurrence !== 'none' && (
            <p className="text-xs text-amber-600">저장하면 이 반복 일정 전체에 적용됩니다.</p>
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={pending} className="gradient-primary text-white border-0">
              {editing ? '저장' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
