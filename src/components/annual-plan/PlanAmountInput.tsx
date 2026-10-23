import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency, parseAmountInput } from '@/lib/utils'

interface PlanAmountInputProps {
  value: number
  onCommit: (value: number) => void
  className?: string
  buttonClassName?: string
}

export function PlanAmountInput({ value, onCommit, className, buttonClassName }: PlanAmountInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const skipCommit = useRef(false)

  if (!editing) {
    return (
      <button
        type="button"
        className={cn(
          'w-full rounded-lg px-1 py-0.5 text-right text-xs hover:bg-indigo-50',
          value > 0 ? 'text-gray-700' : 'text-gray-300',
          buttonClassName,
        )}
        onClick={e => {
          e.stopPropagation()
          setDraft(value === 0 ? '' : String(value))
          setEditing(true)
        }}
      >
        {value > 0 ? formatCurrency(value) : '—'}
      </button>
    )
  }

  return (
    <Input
      autoFocus
      inputMode="numeric"
      className={cn('h-7 rounded-lg p-1 text-right text-xs', className)}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onClick={e => e.stopPropagation()}
      onBlur={() => {
        setEditing(false)
        if (skipCommit.current) {
          skipCommit.current = false
          return
        }
        const next = parseAmountInput(draft)
        if (next !== value) onCommit(next)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          skipCommit.current = true
          setEditing(false)
        }
      }}
    />
  )
}
