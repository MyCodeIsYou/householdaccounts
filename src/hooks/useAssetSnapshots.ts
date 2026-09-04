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
    mutationFn: async ({ snapshot_date, total_amount, account_balances }: {
      snapshot_date: string
      total_amount: number
      account_balances?: { account_id: string; amount: number }[]
    }): Promise<string> => {
      if (!user) throw new Error('로그인이 필요합니다')
      // partial unique index는 PostgREST의 on_conflict가 지원하지 않으므로 수동 select → update/insert
      let existingQuery = supabase
        .from('asset_snapshots')
        .select('id')
        .eq('snapshot_date', snapshot_date)
      if (insertScope.household_id) {
        existingQuery = existingQuery.eq('household_id', insertScope.household_id)
      } else {
        existingQuery = existingQuery.eq('user_id', insertScope.user_id!).is('household_id', null)
      }
      const { data: existing, error: selectErr } = await existingQuery.maybeSingle()
      if (selectErr) throw selectErr

      let snapshotId: string
      if (existing) {
        const { error } = await supabase
          .from('asset_snapshots')
          .update({ total_amount })
          .eq('id', existing.id)
        if (error) throw error
        snapshotId = existing.id
      } else {
        const { data: inserted, error } = await supabase
          .from('asset_snapshots')
          .insert({ ...insertScope, snapshot_date, total_amount })
          .select('id')
          .single()
        if (error) throw error
        snapshotId = inserted.id
      }

      if (account_balances && account_balances.length > 0) {
        const rows = account_balances.map(ab => ({
          asset_snapshot_id: snapshotId,
          account_id: ab.account_id,
          amount: ab.amount,
        }))
        const { error: abError } = await supabase
          .from('account_snapshots')
          .upsert(rows, { onConflict: 'asset_snapshot_id,account_id' })
        if (abError) throw abError
      }

      return snapshotId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-snapshots', scopeKey] })
      qc.invalidateQueries({ queryKey: ['asset-history', scopeKey] })
      qc.invalidateQueries({ queryKey: ['account-snapshots', scopeKey] })
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
