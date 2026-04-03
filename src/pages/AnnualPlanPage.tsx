import { useState } from 'react'
import { useAnnualPlan } from '@/hooks/useAnnualPlan'
import { useCategories } from '@/hooks/useCategories'
import { Card, CardContent } from '@/components/ui/card'
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
      <div className="flex items-center gap-3">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">셀 클릭 시 계획 금액 입력. 실적은 자동 집계됩니다.</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-semibold w-44 sticky left-0 bg-gray-50">항목</th>
              <th className="px-2 py-2 text-center text-xs text-muted-foreground w-16">구분</th>
              {MONTH_LABELS.map(m => (
                <th key={m} className="px-2 py-2 text-center text-xs w-20">{m}</th>
              ))}
              <th className="px-3 py-2 text-center font-semibold w-24">합계</th>
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

              return (
                <>
                  {/* 그룹 헤더 행 */}
                  <tr key={`${group}-header`} className="bg-gray-100 border-y font-semibold">
                    <td
                      className="px-3 py-2 sticky left-0 bg-gray-100 cursor-pointer select-none"
                      onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
                    >
                      <span className="flex items-center gap-1">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {group}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-muted-foreground">계획</td>
                    {groupPlanTotals.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right text-xs">{v > 0 ? (v / 10000).toFixed(0) + '만' : '—'}</td>
                    ))}
                    <td className="px-3 py-2 text-right text-xs font-bold">
                      {formatCurrency(groupPlanTotals.reduce((s, v) => s + v, 0))}
                    </td>
                  </tr>
                  <tr key={`${group}-actual-header`} className="bg-gray-100 border-b">
                    <td className="sticky left-0 bg-gray-100" />
                    <td className="px-2 py-1 text-center text-xs text-muted-foreground">실적</td>
                    {groupActualTotals.map((v, i) => (
                      <td key={i} className="px-2 py-1 text-right text-xs text-blue-600">{v > 0 ? (v / 10000).toFixed(0) + '만' : '—'}</td>
                    ))}
                    <td className="px-3 py-1 text-right text-xs text-blue-600">
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
                        <tr key={`${cat.id}-plan`} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-1.5 pl-8 sticky left-0 bg-white hover:bg-gray-50 text-sm">{cat.name}</td>
                          <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">계획</td>
                          {MONTH_KEYS.map((mk, i) => {
                            const isEditing = editingCell?.categoryId === cat.id && editingCell.monthKey === mk
                            return (
                              <td
                                key={mk}
                                className="px-1 py-1.5 text-right text-xs cursor-pointer hover:bg-blue-50"
                                onClick={() => openEdit(cat.id, mk)}
                              >
                                {isEditing ? (
                                  <Input
                                    autoFocus
                                    className="h-6 text-xs p-1 w-full"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className={planRow[i] > 0 ? '' : 'text-muted-foreground'}>
                                    {planRow[i] > 0 ? (planRow[i] / 10000).toFixed(0) + '만' : '—'}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-3 py-1.5 text-right text-xs font-medium">
                            {planTotal > 0 ? formatCurrency(planTotal) : '—'}
                          </td>
                        </tr>
                        <tr key={`${cat.id}-actual`} className="border-b bg-gray-50/50">
                          <td className="sticky left-0 bg-gray-50/50" />
                          <td className="px-2 py-1 text-center text-xs text-muted-foreground">실적</td>
                          {MONTH_KEYS.map((mk, i) => {
                            const plan = planRow[i]
                            const actual = actualRow[i]
                            const diff = isIncome ? actual - plan : plan - actual
                            const colorClass = actual === 0 ? 'text-muted-foreground' : diff >= 0 ? 'text-green-600' : 'text-red-600'
                            return (
                              <td key={mk} className={`px-1 py-1 text-right text-xs ${colorClass}`}>
                                {actual > 0 ? (actual / 10000).toFixed(0) + '만' : '—'}
                              </td>
                            )
                          })}
                          <td className={`px-3 py-1 text-right text-xs font-medium ${actualTotal > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
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

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            💡 셀을 클릭하여 계획 금액을 입력하세요. Enter 또는 셀 밖 클릭 시 저장됩니다. 실적은 수입/지출 내역에서 자동 집계됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
