import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSupportTickets, useSupportReplies } from '@/hooks/useSupportTickets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MessageCircle, Plus, ChevronLeft, Send } from 'lucide-react'
import type { SupportTicket, TicketStatus } from '@/types'

const STATUS_LABEL: Record<TicketStatus, { text: string; cls: string }> = {
  open: { text: '접수', cls: 'bg-blue-100 text-blue-700' },
  answered: { text: '답변완료', cls: 'bg-emerald-100 text-emerald-700' },
  closed: { text: '종료', cls: 'bg-gray-100 text-gray-500' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// 이름 마스킹: "테스터" → "테*터", "홍길동" → "홍*동", "AB" → "A*"
function maskName(name: string | null | undefined): string {
  if (!name) return '익명'
  const chars = [...name]
  if (chars.length <= 1) return name
  if (chars.length === 2) return chars[0] + '*'
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1]
}

// ── 문의 상세 ──────────────────────────────────────────────────
function TicketDetail({ ticket, onBack }: { ticket: SupportTicket; onBack: () => void }) {
  const { appRole } = useAuth()
  const { replies, add } = useSupportReplies(ticket.id)
  const [replyText, setReplyText] = useState('')

  async function handleReply() {
    if (!replyText.trim()) return
    await add.mutateAsync({ content: replyText.trim() })
    setReplyText('')
  }

  const status = STATUS_LABEL[ticket.status]

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft className="h-4 w-4" /> 목록으로
      </button>

      <div className="bg-white rounded-2xl card-shadow p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{ticket.title}</h3>
            <p className="text-xs text-gray-400 mt-1">{formatDate(ticket.created_at)}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.cls}`}>{status.text}</span>
        </div>
        <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4">{ticket.content}</div>
      </div>

      {/* 답변 목록 */}
      <div className="space-y-3">
        {replies.map(r => (
          <div key={r.id} className={`rounded-2xl p-4 ${r.is_admin ? 'bg-indigo-50 border border-indigo-100 ml-4' : 'bg-white card-shadow mr-4'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold ${r.is_admin ? 'text-indigo-600' : 'text-gray-600'}`}>
                {r.is_admin ? '관리자' : maskName(r.profile?.display_name)}
              </span>
              <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
          </div>
        ))}
      </div>

      {/* 답변 입력 */}
      {ticket.status !== 'closed' && (
        <div className="bg-white rounded-2xl card-shadow p-4 flex gap-3">
          <Textarea
            placeholder={appRole === 'super_admin' ? '관리자 답변을 입력하세요...' : '추가 내용을 입력하세요...'}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            className="flex-1 min-h-[60px] resize-none"
          />
          <Button onClick={handleReply} disabled={!replyText.trim() || add.isPending} className="rounded-xl gradient-primary text-white border-0 shrink-0 self-end">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────
export default function SupportPage() {
  const { user, appRole } = useAuth()
  const { tickets: allTickets, isLoading, add } = useSupportTickets()
  const [writeOpen, setWriteOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)

  // 일반 사용자는 본인 문의만, 관리자는 전체
  const tickets = appRole === 'super_admin' ? allTickets : allTickets.filter(t => t.user_id === user?.id)

  async function handleSubmit() {
    if (!form.title.trim() || !form.content.trim()) return
    await add.mutateAsync({ title: form.title.trim(), content: form.content.trim() })
    setForm({ title: '', content: '' })
    setWriteOpen(false)
  }

  if (selectedTicket) {
    return <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} />
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-4 sm:p-5 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">고객센터</h2>
            <p className="text-sm text-gray-500">1:1 문의를 남기고 답변을 확인하세요</p>
          </div>
        </div>
        <Button onClick={() => setWriteOpen(true)} className="rounded-xl gradient-primary text-white border-0 shadow-sm text-sm">
          <Plus className="h-4 w-4" /> 문의하기
        </Button>
      </div>

      {/* 문의 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm text-gray-400">문의 내역이 없습니다</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setWriteOpen(true)}>첫 문의 작성하기</Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tickets.map(t => {
              const status = STATUS_LABEL[t.status]
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {appRole === 'super_admin' && <span className="text-indigo-500 mr-1.5">{maskName(t.profile?.display_name)}</span>}
                      {formatDate(t.created_at)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ml-3 ${status.cls}`}>{status.text}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 문의 작성 다이얼로그 */}
      <Dialog open={writeOpen} onOpenChange={setWriteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>1:1 문의하기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input placeholder="문의 제목을 입력하세요" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea placeholder="문의 내용을 상세히 입력하세요" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOpen(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={!form.title.trim() || !form.content.trim() || add.isPending}>제출</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
