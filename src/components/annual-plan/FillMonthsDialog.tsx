import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MONTH_KEYS, MONTH_LABELS } from '@/lib/constants'
import type { MonthKey } from '@/types'
import { cn, parseAmountInput } from '@/lib/utils'
import { monthsFrom } from '@/components/annual-plan/planMath'

interface FillMonthsDialogProps {
  open: boolean
  categoryName: string
  defaultMode: 'all' | 'from'
  defaultStartMonth: number
  fromLabel: string
  pending: boolean
  onClose: () => void
  onApply: (months: Partial<Record<MonthKey, number>>) => void
}

export function FillMonthsDialog({
  open,
  categoryName,
  defaultMode,
  defaultStartMonth,
  fromLabel,
  pending,
  onClose,
  onApply,
}: FillMonthsDialogProps) {
  const [mode, setMode] = useState<'all' | 'from'>(defaultMode)
  const [startMonth, setStartMonth] = useState(defaultStartMonth)
  const [amountText, setAmountText] = useState('')

  useEffect(() => {
    if (!open) return
    setMode(defaultMode)
    setStartMonth(defaultStartMonth)
    setAmountText('')
  }, [open, defaultMode, defaultStartMonth])

  function apply() {
    const amount = parseAmountInput(amountText)
    const keys = mode === 'all' ? [...MONTH_KEYS] : monthsFrom(startMonth)
    onApply(Object.fromEntries(keys.map(key => [key, amount])))
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>반복 입력</DialogTitle>
          <DialogDescription>{categoryName} 계획 금액을 여러 달에 같은 값으로 넣습니다.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              mode === 'all' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600',
            )}
            onClick={() => setMode('all')}
          >
            1~12월 동일
          </button>
          <button
            type="button"
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              mode === 'from' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600',
            )}
            onClick={() => setMode('from')}
          >
            {fromLabel}
          </button>
        </div>

        {mode === 'from' && (
          <label className="block space-y-1 text-sm text-gray-600">
            시작 월
            <select
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={startMonth}
              onChange={e => setStartMonth(Number(e.target.value))}
            >
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>{label}부터 12월</option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1 text-sm text-gray-600">
          금액
          <Input
            autoFocus
            inputMode="numeric"
            placeholder="0"
            value={amountText}
            onChange={e => setAmountText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') apply() }}
          />
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="button" onClick={apply} disabled={pending}>적용</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
