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

  return {
    configs: query.data ?? [],
    isLoading: query.isLoading,
    updateConfig,
  }
}
