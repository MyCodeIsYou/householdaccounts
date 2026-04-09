import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Category, PlanGroup, TransactionType } from '@/types'

export function useCategories() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Category[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  })

  const categories = query.data ?? []

  function getTopLevel(type?: TransactionType) {
    return categories.filter(c => c.parent_id === null && (type ? c.type === type : true))
  }

  function getChildren(parentId: string) {
    return categories.filter(c => c.parent_id === parentId)
  }

  function getByPlanGroup(group: PlanGroup) {
    return categories.filter(c => c.plan_group === group && c.parent_id !== null)
  }

  function getCategoryName(id: string | null | undefined): string {
    if (!id) return '—'
    return categories.find(c => c.id === id)?.name ?? '—'
  }

  function getById(id: string | null | undefined): Category | undefined {
    if (!id) return undefined
    return categories.find(c => c.id === id)
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories', user?.id] })

  const createCategory = useMutation({
    mutationFn: async (input: {
      name: string
      parent_id: string
      type: TransactionType
      plan_group: PlanGroup
    }) => {
      if (!user) throw new Error('로그인이 필요합니다')
      // 같은 부모의 마지막 순서 다음에 추가
      const siblings = categories.filter(c => c.parent_id === input.parent_id)
      const nextOrder = siblings.reduce((m, c) => Math.max(m, c.display_order), 0) + 1

      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          parent_id: input.parent_id,
          name: input.name.trim(),
          type: input.type,
          plan_group: input.plan_group,
          display_order: nextOrder,
        })
        .select()
        .single()
      if (error) throw error
      return data as Category
    },
    onSuccess: invalidate,
  })

  const renameCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return {
    ...query,
    categories,
    getTopLevel,
    getChildren,
    getByPlanGroup,
    getCategoryName,
    getById,
    createCategory,
    renameCategory,
    deleteCategory,
  }
}
