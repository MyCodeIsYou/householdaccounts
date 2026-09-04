import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { AccountSnapshot } from '@/types'

export function useAccountSnapshots(snapshotIds: string[]) {
  const { user, scopeKey } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['account-snapshots', scopeKey, snapshotIds],
    queryFn: async (): Promise<AccountSnapshot[]> => {
      if (!user || snapshotIds.length === 0) return []
      const { data, error } = await supabase
        .from('account_snapshots')
        .select('*')
        .in('asset_snapshot_id', snapshotIds)
      if (error) throw error
      return (data ?? []) as AccountSnapshot[]
    },
    enabled: !!user && snapshotIds.length > 0,
  })

  const bulkUpsert = useMutation({
    mutationFn: async (items: { asset_snapshot_id: string; account_id: string; amount: number }[]) => {
      if (items.length === 0) return
      const { error } = await supabase
        .from('account_snapshots')
        .upsert(items, { onConflict: 'asset_snapshot_id,account_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-snapshots', scopeKey] })
    },
  })

  return { ...query, bulkUpsert }
}
