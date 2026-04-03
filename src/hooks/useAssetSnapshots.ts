import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { AssetSnapshot } from '@/types'

export function useAssetSnapshots(dateFrom?: string, dateTo?: string) {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['asset-snapshots', scopeKey, dateFrom, dateTo],
    queryFn: async (): Promise<AssetSnapshot[]> => {
      if (!user) return []
      let q = applyFilter(
        supabase.from('asset_snapshots').select('*')
      ).order('snapshot_date', { ascending: false })
      if (dateFrom) q = q.gte('snapshot_date', dateFrom)
      if (dateTo) q = q.lte('snapshot_date', dateTo)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AssetSnapshot[]
    },
    enabled: !!user,
  })

  const upsert = useMutation({
    mutationFn: async ({ snapshot_date, total_amount }: { snapshot_date: string; total_amount: number }) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const conflictCol = insertScope.household_id ? 'household_id,snapshot_date' : 'user_id,snapshot_date'
      const { error } = await supabase
        .from('asset_snapshots')
        .upsert(
          { ...insertScope, snapshot_date, total_amount },
          { onConflict: conflictCol }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-snapshots', scopeKey] })
      qc.invalidateQueries({ queryKey: ['asset-history', scopeKey] })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('asset_snapshots').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-snapshots', scopeKey] })
      qc.invalidateQueries({ queryKey: ['asset-history', scopeKey] })
    },
  })

  return { ...query, upsert, remove }
}
