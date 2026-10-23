import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Check, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CategoryOriginBadge } from '@/components/CategoryOriginBadge'
import { PlanAmountInput } from '@/components/annual-plan/PlanAmountInput'
import { MonthPicker } from '@/components/annual-plan/MonthPicker'
import { MONTH_KEYS, MONTH_LABELS, PLAN_GROUPS } from '@/lib/constants'
import { formatCurrency, parseAmountInput } from '@/lib/utils'
import type { Category, MonthKey, PlanGroup } from '@/types'
import {
  actualTone, childrenOf, formatGap, isIncomeGroup, monthsFrom, signedPlanGap,
} from '@/components/annual-plan/planMath'

export interface AnnualPlanMobileProps {
  year: number
  curYear: number
  curMonth: number
  selectedMonth: number
  onSelectMonth: (month: number) => void
  categories: Category[]
  collapsed: Record<string, boolean>
  onToggleGroup: (group: string) => void
  getPlan: (categoryId: string, monthKey: MonthKey) => number
  getActual: (categoryId: string, monthKey: MonthKey) => number
  onSaveCell: (categoryId: string, monthKey: MonthKey, value: number) => void
  onApplyMonths: (categoryId: string, months: Partial<Record<MonthKey, number>>) => void
  fillPending: boolean
  renamingId: string | null
  renameValue: string
  onRenameValue: (value: string) => void
  onStartRename: (category: Category) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onRequestDelete: (category: Category) => void
  addingGroup: PlanGroup | null
  addValue: string
  onAddValue: (value: string) => void
  onStartAdd: (group: PlanGroup) => void
  onCommitAdd: () => void
  onCancelAdd: () => void
  addPending: boolean
}

export function AnnualPlanMobile(props: AnnualPlanMobileProps) {
  const {
    year, curYear, curMonth, selectedMonth, onSelectMonth, categories, collapsed, onToggleGroup,
    getPlan, getActual, onSaveCell, onApplyMonths, fillPending,
    renamingId, renameValue, onRenameValue, onStartRename, onCommitRename, onCancelRename, onRequestDelete,
    addingGroup, addValue, onAddValue, onStartAdd, onCommitAdd, onCancelAdd, addPending,
  } = props

  const [sheetCategory, setSheetCategory] = useState<Category | null>(null)
  const [fillAmount, setFillAmount] = useState('')
  const [fillStart, setFillStart] = useState(selectedMonth)
  const monthKey = MONTH_KEYS[selectedMonth - 1]

  const incomeCats = categories.filter(c => c.parent_id !== null && (c.plan_group === '근로수익' || c.plan_group === '금융수익'))
  const expenseCats = categories.filter(c => c.parent_id !== null && (c.plan_group === '고정비용' || c.plan_group === '유동비용'))
  const sum = (rows: Category[], read: (id: string) => number) => rows.reduce((s, c) => s + read(c.id), 0)
  const incomePlan = sum(incomeCats, id => getPlan(id, monthKey))
  const incomeActual = sum(incomeCats, id => getActual(id, monthKey))
  const expensePlan = sum(expenseCats, id => getPlan(id, monthKey))
  const expenseActual = sum(expenseCats, id => getActual(id, monthKey))

  function openSheet(cat: Category) {
    setSheetCategory(cat)
    setFillAmount('')
    setFillStart(selectedMonth)
  }

  function applyFill(keys: MonthKey[]) {
    if (!sheetCategory) return
    const amount = parseAmountInput(fillAmount)
    onApplyMonths(sheetCategory.id, Object.fromEntries(keys.map(key => [key, amount])))
  }

  const sheet = sheetCategory
    ? categories.find(c => c.id === sheetCategory.id) ?? null
    : null
  const sheetIncome = sheet ? isIncomeGroup(sheet.plan_group ?? '') : false

  return (
    <div className="space-y-3">
      <MonthPicker
        year={year}
        curYear={curYear}
        curMonth={curMonth}
        selectedMonth={selectedMonth}
        onSelect={onSelectMonth}
      />

      <div className="grid grid-cols-3 gap-2">
        <SummaryCell label="수입 계획" value={incomePlan} tone="text-emerald-700" />
        <SummaryCell label="수입 실적" value={incomeActual} tone="text-indigo-600" />
        <SummaryCell label="수입 차이" value={incomeActual - incomePlan} signed tone={incomeActual - incomePlan >= 0 ? 'text-emerald-600' : 'text-rose-500'} />
        <SummaryCell label="지출 계획" value={expensePlan} tone="text-rose-700" />
        <SummaryCell label="지출 실적" value={expenseActual} tone="text-indigo-600" />
        <SummaryCell label="지출 차이" value={expensePlan - expenseActual} signed tone={expensePlan - expenseActual >= 0 ? 'text-emerald-600' : 'text-rose-500'} />
      </div>

      {PLAN_GROUPS.map(group => {
        const isIncome = isIncomeGroup(group)
        const groupCategories = childrenOf(categories, group)
        const isCollapsed = collapsed[group]
        const headerTone = isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        return (
          <section key={group} className="overflow-hidden rounded-2xl bg-white card-shadow">
            <button
              type="button"
              className={`flex w-full items-center justify-between px-4 py-3 text-sm font-semibold ${headerTone}`}
              onClick={() => onToggleGroup(group)}
            >
              <span className="flex items-center gap-1">
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {group}
              </span>
              <span className="text-xs font-normal opacity-70">{groupCategories.length}개</span>
            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-gray-100">
                {groupCategories.map(cat => {
                  const plan = getPlan(cat.id, monthKey)
                  const actual = getActual(cat.id, monthKey)
                  const gap = signedPlanGap(isIncome, plan, actual)
                  return (
                    <li key={cat.id} className="space-y-1 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => openSheet(cat)}>
                          <span className="truncate text-sm text-gray-800">{cat.name}</span>
                          <CategoryOriginBadge isDefault={cat.is_default} />
                        </button>
                        <div className="w-28 shrink-0">
                          <PlanAmountInput
                            value={plan}
                            onCommit={value => onSaveCell(cat.id, monthKey, value)}
                            buttonClassName="text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className={actual > 0 ? 'text-indigo-600' : 'text-gray-300'}>
                          실적 {actual > 0 ? formatCurrency(actual) : '—'}
                        </span>
                        <span className={actualTone(isIncome, plan, actual)}>
                          차이 {actual === 0 && plan === 0 ? '—' : formatGap(gap)}
                        </span>
                      </div>
                    </li>
                  )
                })}
                <li className="px-4 py-2">
                  {addingGroup === group ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        placeholder="새 항목 이름"
                        value={addValue}
                        onChange={e => onAddValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') onCommitAdd()
                          if (e.key === 'Escape') onCancelAdd()
                        }}
                        className="h-8 text-sm"
                      />
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={onCommitAdd} disabled={addPending}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-gray-400" onClick={onCancelAdd}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-0 text-xs text-gray-500 hover:text-indigo-600" onClick={() => onStartAdd(group)}>
                      <Plus className="h-3.5 w-3.5" />
                      항목 추가
                    </Button>
                  )}
                </li>
              </ul>
            )}
          </section>
        )
      })}

      <Dialog open={!!sheet} onOpenChange={open => { if (!open) setSheetCategory(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          {sheet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {sheet.name}
                  <CategoryOriginBadge isDefault={sheet.is_default} />
                </DialogTitle>
                <DialogDescription>이 항목의 1~12월 계획입니다. 실적은 거래 합계입니다.</DialogDescription>
              </DialogHeader>

              <div className="space-y-2 rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">같은 금액을 여러 달에 넣기</p>
                <Input
                  inputMode="numeric"
                  placeholder="금액"
                  value={fillAmount}
                  onChange={e => setFillAmount(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={fillPending} onClick={() => applyFill([...MONTH_KEYS])}>
                    1~12월 동일
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={fillPending} onClick={() => applyFill(monthsFrom(fillStart))}>
                    선택 월부터
                  </Button>
                </div>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={fillStart}
                  onChange={e => setFillStart(Number(e.target.value))}
                >
                  {MONTH_LABELS.map((label, index) => (
                    <option key={label} value={index + 1}>{label}부터 12월</option>
                  ))}
                </select>
              </div>

              <ul className="divide-y divide-gray-100">
                {MONTH_KEYS.map((key, index) => {
                  const plan = getPlan(sheet.id, key)
                  const actual = getActual(sheet.id, key)
                  const current = year === curYear && index === curMonth - 1
                  return (
                    <li key={key} className={`flex items-center gap-2 py-2 ${current ? 'rounded-lg bg-indigo-50/70 px-2' : ''}`}>
                      <span className={`w-14 text-xs ${current ? 'font-semibold text-indigo-700' : 'text-gray-500'}`}>
                        {MONTH_LABELS[index]}
                      </span>
                      <div className="w-28">
                        <PlanAmountInput value={plan} onCommit={value => onSaveCell(sheet.id, key, value)} />
                      </div>
                      <span className={`ml-auto text-xs ${actualTone(sheetIncome, plan, actual)}`}>
                        {actual > 0 ? formatCurrency(actual) : '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <div className="flex gap-2">
                {renamingId === sheet.id ? (
                  <>
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={e => onRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') onCommitRename()
                        if (e.key === 'Escape') onCancelRename()
                      }}
                      className="h-9"
                    />
                    <Button type="button" size="icon" variant="ghost" className="text-emerald-600" onClick={onCommitRename}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={onCancelRename}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" className="flex-1" onClick={() => onStartRename(sheet)}>이름 수정</Button>
                    <Button type="button" variant="outline" className="flex-1 text-rose-600" onClick={() => onRequestDelete(sheet)}>삭제</Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCell({ label, value, tone, signed = false }: { label: string; value: number; tone: string; signed?: boolean }) {
  const text = signed ? formatGap(value) : (value > 0 || value < 0 ? formatCurrency(value) : '—')
  return (
    <div className="rounded-2xl bg-white px-3 py-2 card-shadow">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className={`truncate text-xs font-semibold ${tone}`}>{text}</p>
    </div>
  )
}
