import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { TravelRegion, TravelLog, TravelLogInsert, TravelLogUpdate } from '@/types'

const BUCKET = 'travel-photos'

export function useTravelMap() {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  // 지역 색상 목록
  const regionsQuery = useQuery({
    queryKey: ['travel_regions', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('travel_regions').select('*')
      )
      if (error) throw error
      return (data ?? []) as TravelRegion[]
    },
    enabled: !!user,
  })

  // 여행 일기 목록 (최신순)
  const logsQuery = useQuery({
    queryKey: ['travel_logs', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('travel_logs').select('*')
      )
        .order('visited_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TravelLog[]
    },
    enabled: !!user,
  })

  // 지역 색상 지정/변경 (있으면 update, 없으면 insert)
  const setRegionColor = useMutation({
    mutationFn: async ({ regionCode, regionName, color }: { regionCode: string; regionName: string; color: string }) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const existing = (regionsQuery.data ?? []).find(r => r.region_code === regionCode)
      if (existing) {
        const { error } = await supabase.from('travel_regions').update({ color }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('travel_regions').insert({
          region_code: regionCode,
          region_name: regionName,
          color,
          ...insertScope,
        })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel_regions', scopeKey] }),
  })

  // 지역 색상/방문 표시 제거
  const removeRegion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('travel_regions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel_regions', scopeKey] }),
  })

  // 사진 업로드 → public URL 반환
  async function uploadPhoto(file: File): Promise<string> {
    if (!user) throw new Error('로그인이 필요합니다')
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  const addLog = useMutation({
    mutationFn: async (payload: TravelLogInsert) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('travel_logs').insert({ ...payload, ...insertScope })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel_logs', scopeKey] }),
  })

  const updateLog = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TravelLogUpdate }) => {
      const { error } = await supabase.from('travel_logs').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel_logs', scopeKey] }),
  })

  const deleteLog = useMutation({
    mutationFn: async (log: TravelLog) => {
      // 스토리지 사진 정리 (best-effort)
      if (log.photo_url) {
        const marker = `/${BUCKET}/`
        const idx = log.photo_url.indexOf(marker)
        if (idx !== -1) {
          const path = log.photo_url.slice(idx + marker.length)
          await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
        }
      }
      const { error } = await supabase.from('travel_logs').delete().eq('id', log.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel_logs', scopeKey] }),
  })

  return {
    regions: regionsQuery.data ?? [],
    logs: logsQuery.data ?? [],
    isLoading: regionsQuery.isLoading || logsQuery.isLoading,
    setRegionColor,
    removeRegion,
    uploadPhoto,
    addLog,
    updateLog,
    deleteLog,
  }
}
