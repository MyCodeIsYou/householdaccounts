import { MONTH_KEYS } from '@/lib/constants'
import type { Category, MonthKey, PlanGroup } from '@/types'
import { formatCurrency } from '@/lib/utils'

export function isIncomeGroup(group: string): boolean {
  return group === '근로수익' || group === '금융수익'
}

export function childrenOf(categories: Category[], group: PlanGroup): Category[] {
  return categories
    .filter(c => c.plan_group === group && c.parent_id !== null)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, 'ko'))
}

export function actualTone(isIncome: boolean, plan: number, actual: number): string {
  if (actual === 0) return 'text-gray-300'
  const diff = isIncome ? actual - plan : plan - actual
  return diff >= 0 ? 'text-emerald-600' : 'text-rose-500'
}

export function signedPlanGap(isIncome: boolean, plan: number, actual: number): number {
  return isIncome ? actual - plan : plan - actual
}

export function formatGap(amount: number): string {
  if (amount === 0) return '0'
  return formatCurrency(amount, true)
}

export function monthsFrom(startMonth: number): MonthKey[] {
  return MONTH_KEYS.slice(Math.max(0, Math.min(11, startMonth - 1)))
}

export function monthIndex(month: number): number {
  return Math.max(0, Math.min(11, month - 1))
}
