import { useState } from 'react'
import { useFixedCosts } from '@/hooks/useFixedCosts'
import { useCategories } from '@/hooks/useCategories'
import { useCards } from '@/hooks/useCards'
import { useTransactions } from '@/hooks/useTransactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { formatCurrency, parseAmountInput, getCurrentYearMonth } from '@/lib/utils'
import { PAYMENT_METHODS, MONTH_LABELS } from '@/lib/constants'
import type { FixedCost, PaymentMethod } from '@/types'

const { year: curYear, month: curMonth } = getCurrentYearMonth()

interface FormState {
  name: string
  category_id: string
  expected_amount: string
  billing_day: string
  payment_method: PaymentMethod | ''
  card_id: string
  is_active: boolean
}

const defaultForm: FormState = {
  name: '',
  category_id: '',
  expected_amount: '',
  billing_day: '',
  payment_method: '',
  card_id: '',
  is_active: true,
}

interface PayDialogState {
  fixedCostId: string
  name: string
  defaultAmount: number
}

export default function FixedCostsPage() {
  const [year, setYear] = useState(curYear)
  const [month, setMonth] = useState(curMonth)
  const { costs, records, addCost, updateCost, removeCost, markPaid } = useFixedCosts(year, month)
  const { categories } = useCategories()
  const { cards } = useCards()
  const { add: addTransaction } = useTransactions()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FixedCost | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)

  const [payOpen, setPayOpen] = useState(false)
  const [payState, setPayState] = useState<PayDialogState | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [createTransaction, setCreateTransaction] = useState(true)

  const expenseCategories = categories.filter(c => c.type === 'expense' && c.parent_id !== null)
  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  function openAdd() {
    setEditing(null)
    setForm(defaultForm)
    setOpen(true)
  }

  function openEdit(c: FixedCost) {
    setEditing(c)
    setForm({
      name: c.name,
      category_id: c.category_id ?? '',
      expected_amount: String(c.expected_amount),
      billing_day: String(c.billing_day ?? ''),
      payment_method: c.payment_method ?? '',
      card_id: c.card_id ?? '',
      is_active: c.is_active,
    })
    setOpen(true)
  }

  async function handleSave() {
    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      expected_amount: parseAmountInput(form.expected_amount),
      billing_day: form.billing_day ? parseInt(form.billing_day) : null,
      payment_method: (form.payment_method as PaymentMethod) || null,
      card_id: form.card_id || null,
      is_active: form.is_active,
    }
    if (editing) await updateCost.mutateAsync({ id: editing.id, payload })
    else await addCost.mutateAsync(payload)
    setOpen(false)
  }

  function openPay(cost: FixedCost) {
    setPayState({ fixedCostId: cost.id, name: cost.name, defaultAmount: cost.expected_amount })
    setPayAmount(String(cost.expected_amount))
    setPayDate(new Date().toISOString().slice(0, 10))
    setCreateTransaction(true)
    setPayOpen(true)
  }

  async function handleMarkPaid() {
    if (!payState) return
    let txnId: string | undefined
    if (createTransaction) {
      const cost = costs.find(c => c.id === payState.fixedCostId)
      await addTransaction.mutateAsync({
        txn_date: payDate,
        type: 'expense',
        category_id: cost?.category_id ?? null,
        subcategory_id: null,
        amount: parseAmountInput(payAmount),
        memo: payState.name,
        payment_method: (cost?.payment_method as PaymentMethod) ?? null,
        account_id: null,
        card_id: cost?.card_id ?? null,
        is_allowance: false,
        is_fixed: true,
      })
    }
    await markPaid.mutateAsync({
      fixedCostId: payState.fixedCostId,
      actualAmount: parseAmountInput(payAmount),
      paidDate: payDate,
      transactionId: txnId,
    })
    setPayOpen(false)
  }

  const totalExpected = costs.reduce((s, c) => s + c.expected_amount, 0)
  const paidCount = costs.filter(c => records.find(r => r.fixed_cost_id === c.id && r.is_paid)).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-4 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-500 font-medium">연도</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-28 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 font-medium">월</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-20 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={openAdd} className="rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90"><Plus className="h-4 w-4" />고정비 추가</Button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl card-shadow p-5">
          <p className="text-xs text-gray-500 font-medium mb-1">총 고정비</p>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(totalExpected)}</p>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <p className="text-xs text-gray-500 font-medium mb-1">납부 완료</p>
          <p className="text-xl font-bold text-emerald-600">{paidCount} / {costs.length}건</p>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <p className="text-xs text-gray-500 font-medium mb-1">미납 예상금액</p>
          <p className="text-xl font-bold text-orange-500">
            {formatCurrency(costs
              .filter(c => !records.find(r => r.fixed_cost_id === c.id && r.is_paid))
              .reduce((s, c) => s + c.expected_amount, 0)
            )}
          </p>
        </div>
      </div>

      {/* 고정비 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{MONTH_LABELS[month - 1]} 고정비 현황</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">항목</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">카테고리</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">예상금액</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">결제일</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">결제방법</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">관리</th>
              </tr>
            </thead>
            <tbody>
              {costs.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">등록된 고정비가 없습니다</td></tr>
              )}
              {costs.map(cost => {
                const record = records.find(r => r.fixed_cost_id === cost.id)
                const isPaid = record?.is_paid ?? false
                return (
                  <tr key={cost.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{cost.name}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant="secondary" className="text-xs rounded-lg bg-gray-100 text-gray-600">
                        {categories.find(c => c.id === cost.category_id)?.name ?? '—'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-700">{formatCurrency(cost.expected_amount)}</td>
                    <td className="px-3 py-3 text-center text-gray-400">
                      {cost.billing_day ? `${cost.billing_day}일` : '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-400">{cost.payment_method ?? '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => !isPaid && openPay(cost)} className="inline-flex items-center gap-1 text-sm">
                        {isPaid
                          ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600 font-medium">납부완료</span></>
                          : <><Circle className="h-4 w-4 text-gray-300" /><span className="text-gray-500">미납</span></>
                        }
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => openEdit(cost)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{cost.name}을 삭제하시겠습니까?</AlertDialogTitle>
                              <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeCost.mutate(cost.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 고정비 추가/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? '고정비 수정' : '고정비 추가'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>항목명</Label>
              <Input placeholder="예: 월세, 건강보험" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{expenseCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>예상 금액 (원)</Label>
                <Input type="text" placeholder="0" value={form.expected_amount} onChange={e => setForm(f => ({ ...f, expected_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>결제일</Label>
                <Input type="number" min={1} max={31} placeholder="1~31" value={form.billing_day} onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>결제 방법</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v as PaymentMethod }))}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>카드</Label>
              <Select value={form.card_id} onValueChange={v => setForm(f => ({ ...f, card_id: v }))}>
                <SelectTrigger><SelectValue placeholder="없음" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">없음</SelectItem>
                  {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.card_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.expected_amount}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 납부 확인 다이얼로그 */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{payState?.name} 납부 확인</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>실제 납부 금액 (원)</Label>
              <Input type="text" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>납부일</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={createTransaction} onCheckedChange={v => setCreateTransaction(!!v)} />
              수입/지출 내역에 자동 추가
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>취소</Button>
            <Button onClick={handleMarkPaid}>납부 확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
