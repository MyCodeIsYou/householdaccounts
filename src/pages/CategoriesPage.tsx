import { useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PLAN_GROUPS } from '@/lib/constants'
import type { Category, PlanGroup } from '@/types'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface GroupMeta { group: PlanGroup; isIncome: boolean }

const GROUP_META: GroupMeta[] = [
  { group: '근로수익', isIncome: true },
  { group: '금융수익', isIncome: true },
  { group: '고정비용', isIncome: false },
  { group: '유동비용', isIncome: false },
]

export default function CategoriesPage() {
  const { categories, isLoading, createCategory, renameCategory, deleteCategory } = useCategories()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addingGroup, setAddingGroup] = useState<PlanGroup | null>(null)
  const [addValue, setAddValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">로딩 중...</div>
  }

  function getTopLevelByGroup(group: PlanGroup): Category | undefined {
    return categories.find(c => c.parent_id === null && c.plan_group === group)
  }

  function getChildrenByGroup(group: PlanGroup): Category[] {
    const top = getTopLevelByGroup(group)
    if (!top) return []
    return categories
      .filter(c => c.parent_id === top.id)
      .sort((a, b) => a.display_order - b.display_order)
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setEditValue(cat.name)
    setAddingGroup(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  async function commitEdit() {
    if (!editingId) return
    const trimmed = editValue.trim()
    if (!trimmed) { cancelEdit(); return }
    try {
      await renameCategory.mutateAsync({ id: editingId, name: trimmed })
      cancelEdit()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '이름 변경 실패'
      setErrorMsg(msg)
    }
  }

  function startAdd(group: PlanGroup) {
    setAddingGroup(group)
    setAddValue('')
    setEditingId(null)
  }

  function cancelAdd() {
    setAddingGroup(null)
    setAddValue('')
  }

  async function commitAdd() {
    if (!addingGroup) return
    const trimmed = addValue.trim()
    if (!trimmed) { cancelAdd(); return }
    const top = getTopLevelByGroup(addingGroup)
    if (!top) { setErrorMsg(`상위 그룹 "${addingGroup}"이 없습니다`); return }
    try {
      await createCategory.mutateAsync({
        name: trimmed,
        parent_id: top.id,
        type: top.type,
        plan_group: addingGroup,
      })
      cancelAdd()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '추가 실패'
      setErrorMsg(msg)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteCategory.mutateAsync(confirmDelete.id)
      setConfirmDelete(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '삭제 실패'
      setErrorMsg(msg)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl card-shadow p-4">
        <p className="text-sm text-gray-500">
          수입/지출 항목을 자유롭게 추가·이름 변경·삭제할 수 있습니다.
          단, <strong>이미 거래에 사용 중인 항목은 삭제할 수 없습니다.</strong>
          상위 4개 그룹(근로수익/금융수익/고정비용/유동비용)은 변경할 수 없습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {GROUP_META.map(({ group, isIncome }) => {
          const children = getChildrenByGroup(group)
          const top = getTopLevelByGroup(group)
          const groupColor = isIncome ? 'bg-emerald-50/80 border-emerald-100 text-emerald-700' : 'bg-rose-50/60 border-rose-100 text-rose-700'

          return (
            <div key={group} className="bg-white rounded-2xl card-shadow overflow-hidden">
              <div className={`px-5 py-3 border-b flex items-center justify-between ${groupColor}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{group}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-60">
                    {isIncome ? 'income' : 'expense'}
                  </span>
                </div>
                <span className="text-xs opacity-60">{children.length}개 항목</span>
              </div>

              <ul className="divide-y divide-gray-100">
                {children.length === 0 && addingGroup !== group && (
                  <li className="px-5 py-6 text-center text-xs text-gray-400">
                    아직 항목이 없습니다. 아래 + 버튼으로 추가하세요.
                  </li>
                )}

                {children.map(cat => {
                  const isEditing = editingId === cat.id
                  return (
                    <li key={cat.id} className="px-5 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                      {isEditing ? (
                        <>
                          <Input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="h-8 text-sm flex-1"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-emerald-600"
                            onClick={commitEdit}
                            disabled={renameCategory.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-400"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                            onClick={() => startEdit(cat)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-400 hover:text-rose-600"
                            onClick={() => setConfirmDelete(cat)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </li>
                  )
                })}

                {addingGroup === group ? (
                  <li className="px-5 py-2.5 flex items-center gap-2 bg-indigo-50/30">
                    <Input
                      autoFocus
                      placeholder="새 항목 이름"
                      value={addValue}
                      onChange={e => setAddValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitAdd()
                        if (e.key === 'Escape') cancelAdd()
                      }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-600"
                      onClick={commitAdd}
                      disabled={createCategory.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-400"
                      onClick={cancelAdd}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ) : (
                  <li className="px-5 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-gray-500 hover:text-indigo-600 justify-start gap-1"
                      onClick={() => startAdd(group)}
                      disabled={!top}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      항목 추가
                    </Button>
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </div>

      {/* 디버그용 PLAN_GROUPS 사용처 점검 — 미사용 그룹 경고 */}
      {PLAN_GROUPS.some(g => !getTopLevelByGroup(g)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-xs text-amber-700">
          일부 상위 그룹이 누락되어 있습니다. 마이그레이션이 정상 적용됐는지 확인하세요.
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>'{confirmDelete?.name}' 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 항목을 삭제하시겠습니까? 이미 거래/고정비에 사용 중이면 삭제가 거부됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 에러 메시지 다이얼로그 */}
      <AlertDialog open={!!errorMsg} onOpenChange={open => !open && setErrorMsg(null)}>
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
