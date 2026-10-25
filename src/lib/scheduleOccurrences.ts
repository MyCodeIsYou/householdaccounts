import type { Recurrence, Schedule } from '@/types'

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
]

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export interface ScheduleOccurrence {
  key: string
  date: string
  schedule: Schedule
}

interface RecurrenceRule {
  start_date: string
  end_date?: string | null
  recurrence: Recurrence
  recurrence_until: string | null
}

function parseDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function clampDate(y: number, m: number, day: number): string {
  return formatDate(y, m, Math.min(day, daysInMonth(y, m)))
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseDate(iso)
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000)
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

function daysBetween(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000)
}

function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 }
}

function windowEnd(rule: RecurrenceRule, rangeTo: string): string | null {
  let end = rangeTo
  if (rule.recurrence_until && rule.recurrence_until < end) end = rule.recurrence_until
  if (rule.start_date > end) return null
  return end
}

function spanLength(rule: RecurrenceRule): number {
  const start = rule.start_date.slice(0, 10)
  const end = rule.end_date?.slice(0, 10)
  if (!end || end <= start) return 1
  return daysBetween(start, end) + 1
}

function datesInRange(from: string, to: string): string[] {
  if (from > to) return []
  const dates: string[] = []
  let cursor = from
  let guard = 0
  while (cursor <= to && guard < 4000) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
    guard++
  }
  return dates
}

/** 반복 기준일. 기간이 있는 일정은 화면 시작보다 앞에서 시작한 구간도 포함한다. */
function anchorDates(rule: RecurrenceRule, rangeFrom: string, rangeTo: string): string[] {
  const end = windowEnd(rule, rangeTo)
  if (!end) return []
  const start = rule.start_date.slice(0, 10)
  const from = rangeFrom.slice(0, 10)

  if (rule.recurrence === 'none') {
    return start <= end ? [start] : []
  }

  const dates: string[] = []

  if (rule.recurrence === 'daily') {
    let cursor = start > from ? start : from
    let guard = 0
    while (cursor <= end && guard < 4000) {
      dates.push(cursor)
      cursor = addDays(cursor, 1)
      guard++
    }
    return dates
  }

  if (rule.recurrence === 'weekly') {
    let cursor = start
    if (cursor < from) {
      const gap = daysBetween(start, from)
      const rem = gap % 7
      cursor = addDays(start, rem === 0 ? gap : gap + (7 - rem))
    }
    let guard = 0
    while (cursor <= end && guard < 600) {
      if (cursor >= from) dates.push(cursor)
      cursor = addDays(cursor, 7)
      guard++
    }
    return dates
  }

  if (rule.recurrence === 'monthly') {
    const anchor = parseDate(start).d
    let { y, m } = parseDate(start)
    if (start < from) {
      const fromParts = parseDate(from)
      y = fromParts.y
      m = fromParts.m
      const candidate = clampDate(y, m, anchor)
      if (candidate < start || candidate < from) {
        const next = addMonths(y, m, 1)
        y = next.y
        m = next.m
      }
    }
    let guard = 0
    while (guard < 600) {
      const candidate = clampDate(y, m, anchor)
      if (candidate > end) break
      if (candidate >= start && candidate >= from) dates.push(candidate)
      const next = addMonths(y, m, 1)
      y = next.y
      m = next.m
      guard++
    }
    return dates
  }

  const anchor = parseDate(start)
  let year = anchor.y
  if (start < from) {
    year = parseDate(from).y
    const candidate = clampDate(year, anchor.m, anchor.d)
    if (candidate < from || candidate < start) year += 1
  }
  let guard = 0
  while (guard < 200) {
    const candidate = clampDate(year, anchor.m, anchor.d)
    if (candidate > end) break
    if (candidate >= start && candidate >= from) dates.push(candidate)
    year += 1
    guard++
  }
  return dates
}

/** 조회 창 [rangeFrom, rangeTo] 안의 발생 날짜. 시작~종료 날짜는 그 사이 모든 날을 포함한다. */
export function occurrenceDates(rule: RecurrenceRule, rangeFrom: string, rangeTo: string): string[] {
  const end = windowEnd(rule, rangeTo)
  if (!end) return []
  const start = rule.start_date.slice(0, 10)
  const from = rangeFrom.slice(0, 10)
  const span = spanLength(rule)

  if (rule.recurrence === 'none') {
    const last = addDays(start, span - 1)
    const clippedStart = start > from ? start : from
    const clippedEnd = last < end ? last : end
    return datesInRange(clippedStart, clippedEnd)
  }

  const lookback = span > 1 ? addDays(from, -(span - 1)) : from
  const seen = new Set<string>()
  const dates: string[] = []
  for (const anchor of anchorDates(rule, lookback, rangeTo)) {
    for (let offset = 0; offset < span; offset++) {
      const date = offset === 0 ? anchor : addDays(anchor, offset)
      if (date < from || date < start || date > end) continue
      if (seen.has(date)) continue
      seen.add(date)
      dates.push(date)
    }
  }
  return dates
}

function timeKey(value: string | null): string {
  return value ? value.slice(0, 5) : '99:99'
}

export function expandSchedules(schedules: Schedule[], rangeFrom: string, rangeTo: string): ScheduleOccurrence[] {
  const out: ScheduleOccurrence[] = []
  for (const schedule of schedules) {
    for (const date of occurrenceDates(schedule, rangeFrom, rangeTo)) {
      out.push({ key: `${schedule.id}:${date}`, date, schedule })
    }
  }
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const time = timeKey(a.schedule.start_time).localeCompare(timeKey(b.schedule.start_time))
    if (time !== 0) return time
    return a.schedule.title.localeCompare(b.schedule.title, 'ko')
  })
  return out
}

export function occurrencesInYear(schedules: Schedule[], year: number): ScheduleOccurrence[] {
  return expandSchedules(schedules, `${year}-01-01`, `${year}-12-31`)
}

export interface ScheduleGroup {
  key: string
  schedule: Schedule
  dates: string[]
}

/** 같은 일정의 이어진 날짜는 한 건으로 묶는다. 떨어진 반복은 건을 나눈다. */
export function groupConsecutive(items: ScheduleOccurrence[]): ScheduleGroup[] {
  const datesById = new Map<string, string[]>()
  const scheduleById = new Map<string, Schedule>()
  for (const item of items) {
    scheduleById.set(item.schedule.id, item.schedule)
    const dates = datesById.get(item.schedule.id)
    if (dates) dates.push(item.date)
    else datesById.set(item.schedule.id, [item.date])
  }

  const groups: ScheduleGroup[] = []
  for (const [id, dates] of datesById) {
    const schedule = scheduleById.get(id)
    if (!schedule) continue
    const sorted = [...new Set(dates)].sort()
    let run: string[] = []
    const push = () => {
      if (run.length === 0) return
      groups.push({ key: `${id}:${run[0]}`, schedule, dates: run })
      run = []
    }
    for (const date of sorted) {
      if (run.length > 0 && date !== addDays(run[run.length - 1], 1)) push()
      run.push(date)
    }
    push()
  }

  groups.sort((a, b) => {
    if (a.dates[0] !== b.dates[0]) return a.dates[0] < b.dates[0] ? -1 : 1
    return a.schedule.title.localeCompare(b.schedule.title, 'ko')
  })
  return groups
}

/** 오늘을 포함한 가까운 일정. 이어진 날짜는 한 건이다. */
export function upcomingGroups(schedules: Schedule[], today: string, limit = 5): ScheduleGroup[] {
  return groupConsecutive(expandSchedules(schedules, today, addDays(today, 366 * 8))).slice(0, limit)
}

export function groupsOnDate(items: ScheduleOccurrence[], date: string): ScheduleGroup[] {
  const ids = new Set(items.filter(item => item.date === date).map(item => item.schedule.id))
  if (ids.size === 0) return []
  return groupConsecutive(items.filter(item => ids.has(item.schedule.id))).filter(group => group.dates.includes(date))
}

export function recurrenceLabel(recurrence: Recurrence): string | null {
  if (recurrence === 'none') return null
  return RECURRENCE_OPTIONS.find(option => option.value === recurrence)?.label ?? null
}

export function formatScheduleDate(iso: string, withYear = false): string {
  const { y, m, d } = parseDate(iso)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const base = `${m}월 ${d}일 (${weekday})`
  return withYear ? `${y}년 ${base}` : base
}

function weekdayOf(iso: string): string {
  const { y, m, d } = parseDate(iso)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** 이어진 날짜는 "11월 27일 (목) – 29일 (토)"처럼 한 줄로 보여 준다. */
export function formatDateSpan(dates: string[], withYear = false): string {
  if (dates.length === 0) return ''
  const sorted = [...dates].sort()
  if (sorted.length === 1) return formatScheduleDate(sorted[0], withYear)
  const start = parseDate(sorted[0])
  const end = parseDate(sorted[sorted.length - 1])
  if (sorted.length > 31) return `${formatScheduleDate(sorted[0], withYear)}부터`
  if (start.y === end.y && start.m === end.m) {
    return `${formatScheduleDate(sorted[0], withYear)} – ${end.d}일 (${weekdayOf(sorted[sorted.length - 1])})`
  }
  return `${formatScheduleDate(sorted[0], withYear)} – ${formatScheduleDate(sorted[sorted.length - 1], true)}`
}

export function formatScheduleTime(start: string | null, end: string | null): string {
  const startClock = start ? start.slice(0, 5) : null
  const endClock = end ? end.slice(0, 5) : null
  if (startClock && endClock) return `${startClock}–${endClock}`
  if (startClock) return startClock
  if (endClock) return `~${endClock}`
  return '종일'
}

export function todayISO(): string {
  const now = new Date()
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
