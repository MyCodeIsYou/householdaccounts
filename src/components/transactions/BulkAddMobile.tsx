import { useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PAYMENT_METHODS } from '@/lib/constants'
import { formatCurrency, parseAmountInput } from '@/lib/utils'
import type { Category, PaymentMethod, TransactionType } from '@/types'

export interface BulkRowForm {
  txn_date: string
  type: TransactionType
  category_id: string
  subcategory_id: string
  amount: string
  memo: string
  payment_method: PaymentMethod | ''
  account_id: string
  card_id: string
  is_allowance: boolean
  is_fixed: boolean
}

interface BulkAddMobileProps {
  rows: BulkRowForm[]
  editIndex: number
  onEditIndex: (index: number) => void
  onUpdate: (index: number, patch: Partial<BulkRowForm>) => void
  onRemove: (index: number) => void
  onAddNext: () => void
  getTopLevel: (type?: TransactionType) => Category[]
  getChildren: (parentId: string) => Category[]
  getCategoryName: (id: string | null | undefined) => string
}

const TYPE_LABEL: Record<TransactionType, string> = {
  income: '수입',
  expense: '지출',
  transfer: '이체',
}

export function BulkAddMobile({
  rows,
  editIndex,
  onEditIndex,
  onUpdate,
  onRemove,
  onAddNext,
  getTopLevel,
  getChildren,
  getCategoryName,
}: BulkAddMobileProps) {
  const amountRef = useRef<HTMLInputElement>(null)
  const row = rows[editIndex] ?? rows[0]
  const safeIndex = rows[editIndex] ? editIndex : 0

  useEffect(() => {
    if (!window.matchMedia('(max-width: 639px)').matches) return
    amountRef.current?.focus()
  }, [safeIndex])

  if (!row) return null

  const topCategories = getTopLevel(row.type === 'transfer' ? undefined : row.type)
  const subCategories = row.category_id ? getChildren(row.category_id) : []
  const canAddNext = parseAmountInput(row.amount) > 0 && !!row.txn_date

  return (
    <div className="space-y-3 lg:hidden">
      {rows.length > 0 && (
        <ul className="max-h-36 space-y-1 overflow-y-auto">
          {rows.map((item, idx) => {
            const amount = parseAmountInput(item.amount)
            const label = item.subcategory_id
              ? getCategoryName(item.subcategory_id)
              : item.category_id
                ? getCategoryName(item.category_id)
                : '항목 없음'
            const selected = idx === safeIndex
            return (
              <li key={idx}>
                <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${selected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-gray-50'}`}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onEditIndex(idx)}>
                    <span className="w-4 text-[11px] text-gray-400">{idx + 1}</span>
                    <span className="w-12 shrink-0 text-[11px] text-gray-500">{item.txn_date.slice(5)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{item.memo || label}</span>
                    <span className={`shrink-0 text-xs font-semibold ${amount > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                      {amount > 0 ? formatCurrency(amount) : '금액'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="p-1 text-gray-300 disabled:opacity-30"
                    onClick={() => onRemove(idx)}
                    disabled={rows.length <= 1}
                    aria-label="이 줄 삭제"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-2.5 rounded-2xl border border-gray-200 bg-white p-3">
        <div className="flex gap-1">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => onUpdate(safeIndex, { type, category_id: '', subcategory_id: '' })}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${
                row.type === type
                  ? type === 'income'
                    ? 'bg-emerald-100 text-emerald-700'
                    : type === 'expense'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {TYPE_LABEL[type]}
            </button>
          ))}
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium text-gray-400">금액</span>
          <Input
            ref={amountRef}
            inputMode="numeric"
            placeholder="0"
            value={row.amount ? Number(row.amount).toLocaleString('ko-KR') : ''}
            onChange={e => onUpdate(safeIndex, { amount: String(parseAmountInput(e.target.value)) })}
            onKeyDown={e => {
              if (e.key === 'Enter' && canAddNext) {
                e.preventDefault()
                onAddNext()
              }
            }}
            className="h-12 rounded-xl text-right text-lg font-semibold"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium text-gray-400">메모</span>
          <Input
            placeholder="어디서, 무엇"
            value={row.memo}
            onChange={e => onUpdate(safeIndex, { memo: e.target.value })}
            className="h-10 rounded-xl"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium text-gray-400">날짜</span>
          <Input
            type="date"
            value={row.txn_date}
            onChange={e => onUpdate(safeIndex, { txn_date: e.target.value })}
            className="h-10 rounded-xl"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium text-gray-400">카테고리</span>
          <Select value={row.category_id} onValueChange={v => onUpdate(safeIndex, { category_id: v, subcategory_id: '' })}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>
              {topCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium text-gray-400">세부 항목</span>
          <Select value={row.subcategory_id} onValueChange={v => onUpdate(safeIndex, { subcategory_id: v })} disabled={subCategories.length === 0}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>
              {subCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium text-gray-400">결제방법</span>
          <Select value={row.payment_method} onValueChange={v => onUpdate(safeIndex, { payment_method: v as PaymentMethod })}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>

        <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={onAddNext} disabled={!canAddNext}>
          <Plus className="h-4 w-4" />
          다음 건 (날짜·항목 유지)
        </Button>
      </div>
    </div>
  )
}
