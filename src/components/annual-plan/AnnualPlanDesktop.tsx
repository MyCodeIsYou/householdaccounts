import { Fragment } from 'react'
import { ChevronDown, ChevronRight, Repeat, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CategoryOriginBadge } from '@/components/CategoryOriginBadge'
import { MonthPicker } from '@/components/annual-plan/MonthPicker'
import { PlanAmountInput } from '@/components/annual-plan/PlanAmountInput'
import { MONTH_KEYS, MONTH_LABELS, PLAN_GROUPS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { Category, MonthKey, PlanGroup } from '@/types'
import { actualTone, childrenOf, formatGap, isIncomeGroup, signedPlanGap } from '@/components/annual-plan/planMath'

export interface AnnualPlanDesktopProps {
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
  onOpenFill: (category: Category) => void
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

export function AnnualPlanDesktop(props: AnnualPlanDesktopProps) {
  const {
    year, curYear, curMonth, selectedMonth, onSelectMonth, categories, collapsed, onToggleGroup,
    getPlan, getActual, onSaveCell, onOpenFill,
    renamingId, renameValue, onRenameValue, onStartRename, onCommitRename, onCancelRename,
    onRequestDelete, addingGroup, addValue, onAddValue, onStartAdd, onCommitAdd, onCancelAdd, addPending,
  } = props

  const monthKey = MONTH_KEYS[selectedMonth - 1]
  const monthLabel = MONTH_LABELS[selectedMonth - 1]

  return (
    <div className="space-y-3">
      <MonthPicker
        year={year}
        curYear={curYear}
        curMonth={curMonth}
        selectedMonth={selectedMonth}
        onSelect={onSelectMonth}
      />
      <div className="overflow-hidden rounded-2xl bg-white card-shadow">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-[28%] px-4 py-3 text-left text-xs font-semibold text-gray-500">항목</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-indigo-700">{monthLabel} 계획</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">{monthLabel} 실적</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">차이</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">연간 계획</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">연간 실적</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_GROUPS.map(group => {
              const isIncome = isIncomeGroup(group)
              const groupCategories = childrenOf(categories, group)
              const isCollapsed = collapsed[group]
              const groupColor = isIncome ? 'bg-emerald-50/80' : 'bg-rose-50/60'
              const groupTextColor = isIncome ? 'text-emerald-700' : 'text-rose-700'
              const monthPlan = groupCategories.reduce((s, c) => s + getPlan(c.id, monthKey), 0)
              const monthActual = groupCategories.reduce((s, c) => s + getActual(c.id, monthKey), 0)
              const yearPlan = groupCategories.reduce((s, c) => s + MONTH_KEYS.reduce((n, key) => n + getPlan(c.id, key), 0), 0)
              const yearActual = groupCategories.reduce((s, c) => s + MONTH_KEYS.reduce((n, key) => n + getActual(c.id, key), 0), 0)

              return (
                <Fragment key={group}>
                  <tr className={`${groupColor} border-y font-semibold`}>
                    <td className="cursor-pointer px-3 py-2.5" onClick={() => onToggleGroup(group)}>
                      <span className={`flex items-center gap-1 ${groupTextColor}`}>
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {group}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right text-xs ${groupTextColor}`}>{monthPlan > 0 ? formatCurrency(monthPlan) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-indigo-600">{monthActual > 0 ? formatCurrency(monthActual) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right text-xs ${actualTone(isIncome, monthPlan, monthActual)}`}>
                      {monthPlan === 0 && monthActual === 0 ? '—' : formatGap(signedPlanGap(isIncome, monthPlan, monthActual))}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-xs ${groupTextColor}`}>{yearPlan > 0 ? formatCurrency(yearPlan) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-indigo-600">{yearActual > 0 ? formatCurrency(yearActual) : '—'}</td>
                  </tr>

                  {!isCollapsed && groupCategories.map(cat => {
                    const plan = getPlan(cat.id, monthKey)
                    const actual = getActual(cat.id, monthKey)
                    const planTotal = MONTH_KEYS.reduce((s, key) => s + getPlan(cat.id, key), 0)
                    const actualTotal = MONTH_KEYS.reduce((s, key) => s + getActual(cat.id, key), 0)
                    const renaming = renamingId === cat.id
                    return (
                      <tr key={cat.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="overflow-hidden px-3 py-1.5 pl-6">
                          {renaming ? (
                            <div className="flex items-center gap-1">
                              <Input
                                autoFocus
                                value={renameValue}
                                onChange={e => onRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') onCommitRename()
                                  if (e.key === 'Escape') onCancelRename()
                                }}
                                className="h-7 text-xs"
                              />
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={onCommitRename}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-gray-400" onClick={onCancelRename}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="min-w-0 flex-1 truncate text-sm text-gray-700" title={cat.name}>{cat.name}</span>
                              <CategoryOriginBadge isDefault={cat.is_default} />
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-gray-400 hover:text-indigo-600" title="여러 달에 같은 금액" onClick={() => onOpenFill(cat)}>
                                <Repeat className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-gray-400 hover:text-indigo-600" title="이름 수정" onClick={() => onStartRename(cat)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-gray-400 hover:text-rose-600" title="삭제" onClick={() => onRequestDelete(cat)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="bg-indigo-50/40 px-2 py-1">
                          <PlanAmountInput value={plan} onCommit={value => onSaveCell(cat.id, monthKey, value)} />
                        </td>
                        <td className={`px-3 py-1.5 text-right text-xs ${actual > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                          {actual > 0 ? formatCurrency(actual) : '—'}
                        </td>
                        <td className={`px-3 py-1.5 text-right text-xs ${actualTone(isIncome, plan, actual)}`}>
                          {plan === 0 && actual === 0 ? '—' : formatGap(signedPlanGap(isIncome, plan, actual))}
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs text-gray-600">{planTotal > 0 ? formatCurrency(planTotal) : '—'}</td>
                        <td className={`px-3 py-1.5 text-right text-xs ${actualTotal > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                          {actualTotal > 0 ? formatCurrency(actualTotal) : '—'}
                        </td>
                      </tr>
                    )
                  })}

                  {!isCollapsed && (
                    <tr className="border-b border-gray-100">
                      <td className="px-3 py-1.5 pl-6" colSpan={6}>
                        {addingGroup === group ? (
                          <div className="flex max-w-sm items-center gap-1">
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
                          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs text-gray-500 hover:text-indigo-600" onClick={() => onStartAdd(group)}>
                            <Plus className="h-3.5 w-3.5" />
                            항목 추가
                          </Button>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
