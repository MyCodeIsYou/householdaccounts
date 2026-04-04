import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { SupportTicket, SupportReply } from '@/types'

export function useSupportTickets() {
  const { user, appRole } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['support-tickets', appRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, profile:profiles!support_tickets_user_id_fkey(display_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SupportTicket[]
    },
    enabled: !!user,
  })

  const add = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      if (!user) throw new Error('로그인이 필요합니다')
      const { error } = await supabase.from('support_tickets').insert({ ...payload, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('support_tickets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  })

  return { tickets: query.data ?? [], isLoading: query.isLoading, add, updateStatus, remove }
}

export function useSupportReplies(ticketId: string | null) {
  const { user, appRole } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['support-replies', ticketId],
    queryFn: async () => {
      if (!ticketId) return []
      const { data, error } = await supabase
        .from('support_replies')
        .select('*, profile:profiles!support_replies_user_id_fkey(display_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as SupportReply[]
    },
    enabled: !!user && !!ticketId,
  })

  const add = useMutation({
    mutationFn: async (payload: { content: string }) => {
      if (!user || !ticketId) throw new Error('필수값 누락')
      const { error } = await supabase.from('support_replies').insert({
        ticket_id: ticketId,
        user_id: user.id,
        content: payload.content,
        is_admin: appRole === 'super_admin',
      })
      if (error) throw error
      // 관리자 답변 시 상태 변경
      if (appRole === 'super_admin') {
        await supabase.from('support_tickets').update({ status: 'answered' }).eq('id', ticketId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-replies', ticketId] })
      qc.invalidateQueries({ queryKey: ['support-tickets'] })
    },
  })

  return { replies: query.data ?? [], isLoading: query.isLoading, add }
}
