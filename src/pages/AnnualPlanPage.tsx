import { useState } from 'react'
import { useDragScroll } from '@/hooks/useDragScroll'
import { useAnnualPlan } from '@/hooks/useAnnualPlan'
import { useCategories } from '@/hooks/useCategories'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, parseAmountInput, getCurrentYearMonth } from '@/lib/utils'
import { PLAN_GROUPS, MONTH_LABELS, MONTH_KEYS } from '@/lib/constants'
import type { MonthKey } from '@/types'
import { ChevronDown, ChevronRight } from 'lucide-react'

const { year: curYear } = getCurrentYearMonth()

interface EditingCell { categoryId: string; monthKey: MonthKey }

export default function AnnualPlanPage() {
  const [year, setYear] = useState(curYear)
  const { plans, actualMap, isLoading, upsertCell } = useAnnualPlan(year)
  const { categories } = useCategories()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')
  const dragScrollRef = useDragScroll<HTMLDivElement>()

  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i)

  function getPlanValue(categoryId: string, monthKey: MonthKey): number {
    return plans.find(p => p.category_id === categoryId)?.[monthKey] ?? 0
  }

  function getActualValue(categoryId: string, monthKey: MonthKey): number {
    return actualMap.get(categoryId)?.[monthKey] ?? 0
  }

  function openEdit(categoryId: string, monthKey: MonthKey) {
    const current = getPlanValue(categoryId, monthKey)
    setEditingCell({ categoryId, monthKey })
    setEditValue(String(current === 0 ? '' : current))
  }

  async function commitEdit() {
    if (!editingCell) return
    await upsertCell.mutateAsync({
      categoryId: editingCell.categoryId,
      monthKey: editingCell.monthKey,
      value: parseAmountInput(editValue),
    })
    setEditingCell(null)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">로딩 중...</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-3">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-gray-400">셀 클릭 시 계획 금액 입력. 실적은 자동 집계됩니다.</span>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto" ref={dragScrollRef}>
          <table className="text-sm border-collapse" style={{ minWidth: '1400px' }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap sticky left-0 bg-gray-50 z-10" style={{ minWidth: '120px' }}>항목</th>
                <th className="px-3 py-3 text-center text-xs text-gray-400 whitespace-nowrap" style={{ minWidth: '60px' }}>구분</th>
                {MONTH_LABELS.map(m => (
                  <th key={m} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth: '100px' }}>{m}</th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '110px' }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_GROUPS.map(group => {
                const isIncome = group === '근로수익' || group === '금융수익'
                const groupCategories = categories.filter(c => c.plan_group === group && c.parent_id !== null)

                const groupPlanTotals = MONTH_KEYS.map(mk =>
                  groupCategories.reduce((s, c) => s + getPlanValue(c.id, mk), 0)
                )
                const groupActualTotals = MONTH_KEYS.map(mk =>
                  groupCategories.reduce((s, c) => s + getActualValue(c.id, mk), 0)
                )

                const isCollapsed = collapsed[group]
                const groupColor = isIncome ? 'bg-emerald-50/80 border-emerald-100' : 'bg-rose-50/60 border-rose-100'
                const groupTextColor = isIncome ? 'text-emerald-700' : 'text-rose-700'

                return (
                  <>
                    {/* 그룹 헤더 행 */}
                    <tr key={`${group}-header`} className={`${groupColor} border-y font-semibold`}>
                      <td
                        className={`px-3 py-2.5 sticky left-0 z-10 ${groupColor} cursor-pointer select-none`}
                        onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
                      >
                        <span className={`flex items-center gap-1 ${groupTextColor}`}>
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {group}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-400 whitespace-nowrap">계획</td>
                      {groupPlanTotals.map((v, i) => (
                        <td key={i} className={`px-3 py-2.5 text-right text-xs whitespace-nowrap ${groupTextColor}`}>{v > 0 ? formatCurrency(v) : '—'}</td>
                      ))}
                      <td className={`px-4 py-2.5 text-right text-xs font-bold whitespace-nowrap ${groupTextColor}`}>
                        {formatCurrency(groupPlanTotals.reduce((s, v) => s + v, 0))}
                      </td>
                    </tr>
                    <tr key={`${group}-actual-header`} className={`${groupColor} border-b`}>
                      <td className={`sticky left-0 z-10 ${groupColor}`} />
                      <td className="px-3 py-1.5 text-center text-xs text-gray-400 whitespace-nowrap">실적</td>
                      {groupActualTotals.map((v, i) => (
                        <td key={i} className="px-3 py-1.5 text-right text-xs text-indigo-600 whitespace-nowrap">{v > 0 ? formatCurrency(v) : '—'}</td>
                      ))}
                      <td className="px-4 py-1.5 text-right text-xs text-indigo-600 whitespace-nowrap">
                        {formatCurrency(groupActualTotals.reduce((s, v) => s + v, 0))}
                      </td>
                    </tr>

                    {/* 카테고리별 행 */}
                    {!isCollapsed && groupCategories.map(cat => {
                      const planRow = MONTH_KEYS.map(mk => getPlanValue(cat.id, mk))
                      const actualRow = MONTH_KEYS.map(mk => getActualValue(cat.id, mk))
                      const planTotal = planRow.reduce((s, v) => s + v, 0)
                      const actualTotal = actualRow.reduce((s, v) => s + v, 0)

                      return (
                        <>
                          <tr key={`${cat.id}-plan`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-1.5 pl-8 sticky left-0 z-10 bg-white hover:bg-gray-50 text-sm text-gray-700 whitespace-nowrap">{cat.name}</td>
                            <td className="px-3 py-1.5 text-center text-xs text-gray-400 whitespace-nowrap">계획</td>
                            {MONTH_KEYS.map((mk, i) => {
                              const isEditing = editingCell?.categoryId === cat.id && editingCell.monthKey === mk
                              return (
                                <td
                                  key={mk}
                                  className="px-3 py-1.5 text-right text-xs whitespace-nowrap cursor-pointer hover:bg-indigo-50 transition-colors rounded"
                                  onClick={() => openEdit(cat.id, mk)}
                                >
                                  {isEditing ? (
                                    <Input
                                      autoFocus
                                      className="h-6 text-xs p-1 w-full rounded-lg"
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      onBlur={commitEdit}
                                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    <span className={planRow[i] > 0 ? 'text-gray-700' : 'text-gray-300'}>
                                      {planRow[i] > 0 ? formatCurrency(planRow[i]) : '—'}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-600 whitespace-nowrap">
                              {planTotal > 0 ? formatCurrency(planTotal) : '—'}
                            </td>
                          </tr>
                          <tr key={`${cat.id}-actual`} className="border-b border-gray-100 bg-gray-50/40">
                            <td className="sticky left-0 z-10 bg-gray-50/40" />
                            <td className="px-3 py-1 text-center text-xs text-gray-400 whitespace-nowrap">실적</td>
                            {MONTH_KEYS.map((mk, i) => {
                              const plan = planRow[i]
                              const actual = actualRow[i]
                              const diff = isIncome ? actual - plan : plan - actual
                              const colorClass = actual === 0 ? 'text-gray-300' : diff >= 0 ? 'text-emerald-600' : 'text-rose-500'
                              return (
                                <td key={mk} className={`px-3 py-1 text-right text-xs whitespace-nowrap ${colorClass}`}>
                                  {actual > 0 ? formatCurrency(actual) : '—'}
                                </td>
                              )
                            })}
                            <td className={`px-4 py-1 text-right text-xs font-medium whitespace-nowrap ${actualTotal > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                              {actualTotal > 0 ? formatCurrency(actualTotal) : '—'}
                            </td>
                          </tr>
                        </>
                      )
                    })}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-2xl px-5 py-3 border border-indigo-100">
        <p className="text-xs text-indigo-600">
          셀을 클릭하여 계획 금액을 입력하세요. Enter 또는 셀 밖 클릭 시 저장됩니다. 실적은 수입/지출 내역에서 자동 집계됩니다.
        </p>
      </div>
    </div>
  )
}
