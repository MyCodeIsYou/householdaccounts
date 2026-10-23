import { useEffect, useState } from 'react'
import { useAnnualPlan } from '@/hooks/useAnnualPlan'
import { useCategories } from '@/hooks/useCategories'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AnnualPlanDesktop } from '@/components/annual-plan/AnnualPlanDesktop'
import { AnnualPlanMobile } from '@/components/annual-plan/AnnualPlanMobile'
import { FillMonthsDialog } from '@/components/annual-plan/FillMonthsDialog'
import { getCurrentYearMonth, unknownErrorMessage } from '@/lib/utils'
import type { Category, MonthKey, PlanGroup } from '@/types'

const { year: curYear, month: curMonth } = getCurrentYearMonth()

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsDesktop(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

export default function AnnualPlanPage() {
  const [year, setYear] = useState(curYear)
  const [selectedMonth, setSelectedMonth] = useState(curMonth)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [addingGroup, setAddingGroup] = useState<PlanGroup | null>(null)
  const [addValue, setAddValue] = useState('')
  const [fillCategory, setFillCategory] = useState<Category | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isDesktop = useIsDesktop()

  const { planByCategory, actualMap, isLoading, upsertCell, upsertMonths } = useAnnualPlan(year)
  const { categories, isLoading: categoriesLoading, createCategory, renameCategory, deleteCategory } = useCategories()

  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i)
  const fromLabel = year === curYear ? '이번 달부터 12월' : '선택한 달부터 12월'
  const defaultStartMonth = year === curYear ? curMonth : selectedMonth

  function getPlan(categoryId: string, monthKey: MonthKey): number {
    return planByCategory.get(categoryId)?.[monthKey] ?? 0
  }

  function getActual(categoryId: string, monthKey: MonthKey): number {
    return actualMap.get(categoryId)?.[monthKey] ?? 0
  }

  function changeYear(next: number) {
    setYear(next)
    setSelectedMonth(next === curYear ? curMonth : 1)
  }

  async function saveCell(categoryId: string, monthKey: MonthKey, value: number) {
    try {
      await upsertCell.mutateAsync({ categoryId, monthKey, value })
    } catch (error: unknown) {
      setErrorMsg(unknownErrorMessage(error, '계획 저장에 실패했습니다.'))
    }
  }

  async function applyMonths(categoryId: string, months: Partial<Record<MonthKey, number>>) {
    try {
      await upsertMonths.mutateAsync({ categoryId, months })
      setFillCategory(null)
    } catch (error: unknown) {
      setErrorMsg(unknownErrorMessage(error, '계획 저장에 실패했습니다.'))
    }
  }

  function startRename(category: Category) {
    setAddingGroup(null)
    setRenamingId(category.id)
    setRenameValue(category.name)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function commitRename() {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (!trimmed) { cancelRename(); return }
    try {
      await renameCategory.mutateAsync({ id: renamingId, name: trimmed })
      cancelRename()
    } catch (error: unknown) {
      setErrorMsg(unknownErrorMessage(error, '이름 변경에 실패했습니다.'))
    }
  }

  function startAdd(group: PlanGroup) {
    cancelRename()
    setAddingGroup(group)
    setAddValue('')
  }

  function cancelAdd() {
    setAddingGroup(null)
    setAddValue('')
  }

  async function commitAdd() {
    if (!addingGroup) return
    const trimmed = addValue.trim()
    if (!trimmed) { cancelAdd(); return }
    const parent = categories.find(c => c.parent_id === null && c.plan_group === addingGroup)
    if (!parent) {
      setErrorMsg(`상위 그룹 "${addingGroup}"이 없습니다.`)
      return
    }
    try {
      await createCategory.mutateAsync({
        name: trimmed,
        parent_id: parent.id,
        type: parent.type,
        plan_group: addingGroup,
      })
      cancelAdd()
    } catch (error: unknown) {
      setErrorMsg(unknownErrorMessage(error, '항목 추가에 실패했습니다.'))
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteCategory.mutateAsync(confirmDelete.id)
      setConfirmDelete(null)
    } catch (error: unknown) {
      setConfirmDelete(null)
      setErrorMsg(unknownErrorMessage(error, '삭제에 실패했습니다.'))
    }
  }

  if (isLoading || categoriesLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">로딩 중...</div>
  }

  const shared = {
    year,
    curYear,
    curMonth,
    categories,
    collapsed,
    onToggleGroup: (group: string) => setCollapsed(c => ({ ...c, [group]: !c[group] })),
    getPlan,
    getActual,
    onSaveCell: saveCell,
    renamingId,
    renameValue,
    onRenameValue: setRenameValue,
    onStartRename: startRename,
    onCommitRename: commitRename,
    onCancelRename: cancelRename,
    onRequestDelete: setConfirmDelete,
    addingGroup,
    addValue,
    onAddValue: setAddValue,
    onStartAdd: startAdd,
    onCommitAdd: commitAdd,
    onCancelAdd: cancelAdd,
    addPending: createCategory.isPending,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 card-shadow sm:flex-row sm:items-center">
        <Select value={String(year)} onValueChange={v => changeYear(Number(v))}>
          <SelectTrigger className="w-28 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-gray-400">
          계획은 직접 입력하고, 반복으로 여러 달을 채웁니다. 실적은 거래 합계입니다. 항목은 이 화면에서 추가할 수 있습니다.
        </span>
      </div>

      {isDesktop ? (
        <AnnualPlanDesktop
          {...shared}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onOpenFill={setFillCategory}
        />
      ) : (
        <AnnualPlanMobile
          {...shared}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onApplyMonths={applyMonths}
          fillPending={upsertMonths.isPending}
        />
      )}

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-3">
        <p className="text-xs text-indigo-600">
          기본 항목은 처음 만들어질 때 들어오고, 추가 항목은 여기서 만든 것입니다. 거래나 고정비에 쓰인 항목은 삭제되지 않습니다.
        </p>
      </div>

      <FillMonthsDialog
        open={!!fillCategory}
        categoryName={fillCategory?.name ?? ''}
        defaultMode="all"
        defaultStartMonth={defaultStartMonth}
        fromLabel={fromLabel}
        pending={upsertMonths.isPending}
        onClose={() => setFillCategory(null)}
        onApply={months => { if (fillCategory) void applyMonths(fillCategory.id, months) }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={open => { if (!open) setConfirmDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>'{confirmDelete?.name}' 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 항목을 삭제하면 연간 계획 숫자도 함께 지워집니다. 거래나 고정비에 쓰인 항목은 삭제되지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!errorMsg} onOpenChange={open => { if (!open) setErrorMsg(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>처리 실패</AlertDialogTitle>
            <AlertDialogDescription>{errorMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMsg(null)}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
