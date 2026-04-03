import { useState } from 'react'
import { useCards } from '@/hooks/useCards'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react'
import { formatCurrency, formatDateKo, getCurrentYearMonth } from '@/lib/utils'
import { CARD_COMPANIES } from '@/lib/constants'
import type { Card as CardType } from '@/types'

const { year: curYear, month: curMonth } = getCurrentYearMonth()

interface FormState {
  card_name: string
  card_company: string
  last4: string
  billing_day: string
  is_active: boolean
}

const defaultForm: FormState = { card_name: '', card_company: '', last4: '', billing_day: '', is_active: true }

export default function CardsPage() {
  const { cards, add, update, remove } = useCards()
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [filterYear, setFilterYear] = useState(curYear)
  const [filterMonth, setFilterMonth] = useState(curMonth)

  const { transactions, totalExpense } = useTransactions(
    selectedCardId
      ? { card_id: selectedCardId, year: filterYear, month: filterMonth }
      : { year: 0 }
  )
  const { getCategoryName } = useCategories()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CardType | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)

  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  function openAdd() { setEditing(null); setForm(defaultForm); setOpen(true) }
  function openEdit(c: CardType) {
    setEditing(c)
    setForm({ card_name: c.card_name, card_company: c.card_company, last4: c.last4 ?? '', billing_day: String(c.billing_day ?? ''), is_active: c.is_active })
    setOpen(true)
  }

  async function handleSave() {
    const payload = {
      card_name: form.card_name,
      card_company: form.card_company,
      last4: form.last4 || null,
      billing_day: form.billing_day ? parseInt(form.billing_day) : null,
      linked_account_id: null,
      is_active: form.is_active,
    }
    if (editing) await update.mutateAsync({ id: editing.id, payload })
    else await add.mutateAsync(payload)
    setOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* 카드 목록 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">등록된 카드 ({cards.length})</h2>
        <Button onClick={openAdd} className="rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90"><Plus className="h-4 w-4" />카드 추가</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {cards.length === 0 && (
          <div className="text-sm text-gray-400 py-4">등록된 카드가 없습니다.</div>
        )}
        {cards.map(c => (
          <div
            key={c.id}
            className={`relative rounded-2xl border-2 p-4 cursor-pointer transition-all w-52 ${selectedCardId === c.id ? 'border-indigo-400 bg-indigo-50/60 card-shadow' : 'border-gray-100 bg-white card-shadow hover:border-indigo-200'}`}
            onClick={() => setSelectedCardId(selectedCardId === c.id ? null : c.id)}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${selectedCardId === c.id ? 'gradient-primary' : 'bg-gray-100'}`}>
              <CreditCard className={`h-5 w-5 ${selectedCardId === c.id ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <p className="font-semibold text-sm text-gray-800">{c.card_name}</p>
            <p className="text-xs text-gray-500">{c.card_company}</p>
            {c.last4 && <p className="text-xs text-gray-400 mt-1">•••• {c.last4}</p>}
            {c.billing_day && <p className="text-xs text-gray-400">결제일: 매월 {c.billing_day}일</p>}
            <div className="flex gap-1 mt-3">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700" onClick={e => { e.stopPropagation(); openEdit(c) }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => e.stopPropagation()}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{c.card_name}을 삭제하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { remove.mutate(c.id); if (selectedCardId === c.id) setSelectedCardId(null) }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {/* 카드별 거래 내역 */}
      {selectedCardId && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-gray-800">{cards.find(c => c.id === selectedCardId)?.card_name} 내역</h3>
                <p className="text-xs text-gray-400 mt-0.5">이달 사용액: <span className="font-bold text-rose-500">{formatCurrency(totalExpense)}</span></p>
              </div>
              <div className="flex gap-2 items-center">
                <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
                  <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(Number(v))}>
                  <SelectTrigger className="w-20 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-100">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">날짜</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">카테고리</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">금액</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-10">이달 카드 내역이 없습니다</TableCell></TableRow>
              )}
              {transactions.map(t => (
                <TableRow key={t.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="text-sm text-gray-600">{formatDateKo(t.txn_date)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-700">{getCategoryName(t.category_id)}</span>
                    {t.subcategory_id && <span className="text-xs text-gray-400 ml-1">/ {getCategoryName(t.subcategory_id)}</span>}
                  </TableCell>
                  <TableCell className="font-semibold text-rose-500">{formatCurrency(t.amount)}</TableCell>
                  <TableCell className="text-sm text-gray-400">{t.memo ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 카드 추가/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? '카드 수정' : '카드 추가'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>카드사</Label>
              <Select value={form.card_company} onValueChange={v => setForm(f => ({ ...f, card_company: v }))}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{CARD_COMPANIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>카드명</Label>
              <Input placeholder="예: 신한 Deep Dream" value={form.card_name} onChange={e => setForm(f => ({ ...f, card_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>카드 뒷 4자리</Label>
                <Input maxLength={4} placeholder="1234" value={form.last4} onChange={e => setForm(f => ({ ...f, last4: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>결제일</Label>
                <Input type="number" min={1} max={31} placeholder="15" value={form.billing_day} onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.card_name || !form.card_company}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
