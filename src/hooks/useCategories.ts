import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Category, PlanGroup, TransactionType } from '@/types'

export function useCategories() {
  const { user } = useAuth()

  const query = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`is_system.eq.true,user_id.eq.${user?.id}`)
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

  return { ...query, categories, getTopLevel, getChildren, getByPlanGroup, getCategoryName }
}
