import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { AssetSnapshot } from '@/types'

export function useAssetHistory(dateFrom?: string, dateTo?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['asset-history', user?.id, dateFrom, dateTo],
    queryFn: async (): Promise<AssetSnapshot[]> => {
      if (!user) return []
      let q = supabase
        .from('asset_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })

      if (dateFrom) q = q.gte('snapshot_date', dateFrom)
      if (dateTo) q = q.lte('snapshot_date', dateTo)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AssetSnapshot[]
    },
    enabled: !!user,
  })
}
