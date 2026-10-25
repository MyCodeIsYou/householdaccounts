import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { MenuConfig } from '@/types'

export function useMenuConfigs() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['menu-configs'],
    queryFn: async (): Promise<MenuConfig[]> => {
      const { data, error } = await supabase
        .from('menu_configs')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) return [] // 테이블 미존재(404) 등 마이그레이션 전 대비
      return (data ?? []) as MenuConfig[]
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5분 캐시
  })

  const updateConfig = useMutation({
    mutationFn: async (patch: Partial<MenuConfig> & { menu_key: string }) => {
      const { menu_key, ...rest } = patch
      const { error } = await supabase
        .from('menu_configs')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('menu_key', menu_key)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-configs'] }),
  })

  const reorderMenus = useMutation({
    mutationFn: async (updates: { menu_key: string; display_order: number; parent_menu_key: string | null }[]) => {
      const updatedAt = new Date().toISOString()
      for (const row of updates) {
        const { error } = await supabase
          .from('menu_configs')
          .update({
            display_order: row.display_order,
            parent_menu_key: row.parent_menu_key,
            updated_at: updatedAt,
          })
          .eq('menu_key', row.menu_key)
        if (error) throw error
      }
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ['menu-configs'] })
      const prev = qc.getQueryData<MenuConfig[]>(['menu-configs'])
      const byKey = new Map(updates.map(row => [row.menu_key, row]))
      qc.setQueryData<MenuConfig[]>(['menu-configs'], old => old?.map(menu => {
        const next = byKey.get(menu.menu_key)
        return next
          ? { ...menu, display_order: next.display_order, parent_menu_key: next.parent_menu_key }
          : menu
      }))
      return { prev }
    },
    onError: (_error, _updates, context) => {
      if (context?.prev) qc.setQueryData(['menu-configs'], context.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['menu-configs'] }),
  })

  return {
    configs: query.data ?? [],
    isLoading: query.isLoading,
    updateConfig,
    reorderMenus,
  }
}
