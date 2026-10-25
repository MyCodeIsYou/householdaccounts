import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHouseholdFilter } from '@/hooks/useHouseholdFilter'
import type { Schedule, ScheduleWrite } from '@/types'

export function useSchedules() {
  const { user, scopeKey, applyFilter, insertScope } = useHouseholdFilter()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['schedules', scopeKey],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await applyFilter(
        supabase.from('schedules').select('*')
      ).order('start_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as Schedule[]
    },
    enabled: !!user,
  })

  const addSchedule = useMutation({
    mutationFn: async (payload: ScheduleWrite) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('schedules').insert({ ...payload, ...insertScope })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', scopeKey] }),
  })

  const updateSchedule = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ScheduleWrite }) => {
      const { error } = await supabase.from('schedules').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', scopeKey] }),
  })

  const removeSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', scopeKey] }),
  })

  return {
    schedules: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addSchedule,
    updateSchedule,
    removeSchedule,
  }
}
