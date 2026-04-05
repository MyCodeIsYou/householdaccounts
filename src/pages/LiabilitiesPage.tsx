import { useState } from 'react'
import { useLiabilities } from '@/hooks/useLiabilities'
import { useAccounts } from '@/hooks/useAccounts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, TrendingDown, Wallet, AlertTriangle } from 'lucide-react'
import { formatCurrency, parseAmountInput } from '@/lib/utils'
import type { Liability, LiabilityInsert, LiabilityType } from '@/types'

const LIABILITY_TYPES: LiabilityType[] = [
  '주택담보', '전세자금', '신용대출', '마이너스통장', '카드론', '할부', '학자금', '기타',
]

interface FormState {
  name: string
  liability_type: LiabilityType
  creditor: string
  balance: string
  interest_rate: string
  due_date: string
  memo: string
}

const emptyForm: FormState = {
  name: '',
  liability_type: '기타',
  creditor: '',
  balance: '0',
  interest_rate: '',
  due_date: '',
  memo: '',
}

export default function LiabilitiesPage() {
  const { data: liabilities = [], totalBalance: totalLiability, add, update, remove } = useLiabilities()
  const { totalBalance: totalAsset } = useAccounts()
  const netWorth = totalAsset - totalLiability

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Liability | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setOpen(true)
  }

  function openEdit(l: Liability) {
    setEditing(l)
    setForm({
      name: l.name,
      liability_type: l.liability_type,
      creditor: l.creditor ?? '',
      balance: String(l.balance),
      interest_rate: l.interest_rate !== null ? String(l.interest_rate) : '',
      due_date: l.due_date ?? '',
      memo: l.memo ?? '',
    })
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    setError(null)
    const payload: LiabilityInsert = {
      name: form.name.trim(),
      liability_type: form.liability_type,
      creditor: form.creditor.trim() || null,
      balance: parseAmountInput(form.balance),
      interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
      due_date: form.due_date || null,
      currency: 'KRW',
      is_active: true,
      display_order: 0,
      memo: form.memo.trim() || null,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload })
      } else {
        await add.mutateAsync(payload)
      }
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  // 타입별 그룹화
  const usedTypes: LiabilityType[] = [...new Set(liabilities.map(l => l.liability_type))]
  const orderedTypes = LIABILITY_TYPES.filter(t => usedTypes.includes(t))

  return (
    <div className="space-y-5">
      {/* 상단 순자산 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-asset flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">총 자산</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(totalAsset)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-expense flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">총 부채</p>
              <p className="text-xl font-bold text-rose-500">-{formatCurrency(totalLiability)}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-2xl card-shadow p-5 ${netWorth >= 0 ? 'bg-gradient-to-br from-emerald-50 to-white' : 'bg-gradient-to-br from-rose-50 to-white'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">₩</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">순자산</p>
              <p className={`text-xl font-bold ${netWorth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {netWorth < 0 && '-'}{formatCurrency(Math.abs(netWorth))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 부채 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">등록된 부채</h3>
            <p className="text-xs text-gray-400 mt-0.5">{liabilities.length}건 · 총 {formatCurrency(totalLiability)}</p>
          </div>
          <Button onClick={openAdd} className="rounded-xl gradient-primary text-white border-0 shadow-sm text-sm">
            <Plus className="h-4 w-4" /> 부채 추가
          </Button>
        </div>

        {liabilities.length === 0 ? (
          <div className="py-16 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm text-gray-400">등록된 부채가 없습니다</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={openAdd}>첫 부채 추가하기</Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {orderedTypes.map(type => {
              const list = liabilities.filter(l => l.liability_type === type)
              if (list.length === 0) return null
              const subtotal = list.reduce((s, l) => s + Number(l.balance), 0)

              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">{type}</span>
                    <span className="text-xs font-semibold text-rose-600">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map(l => (
                      <div key={l.id} className="bg-gradient-to-br from-rose-50/50 to-white border border-rose-100/50 rounded-xl p-4 flex items-start justify-between gap-3 hover:shadow-md transition-shadow">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{l.name}</p>
                            {l.creditor && <span className="text-xs text-gray-400">· {l.creditor}</span>}
                          </div>
                          <p className="text-lg font-bold text-rose-600 mt-1">-{formatCurrency(Number(l.balance))}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {l.interest_rate !== null && <span>금리 {l.interest_rate}%</span>}
                            {l.due_date && <span>만기 {l.due_date}</span>}
                          </div>
                          {l.memo && <p className="text-xs text-gray-400 mt-1">{l.memo}</p>}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => openEdit(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>부채를 삭제하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>{l.name} ({formatCurrency(Number(l.balance))})을 삭제합니다.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '부채 수정' : '부채 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input placeholder="예: 주택담보대출" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>종류</Label>
              <Select value={form.liability_type} onValueChange={v => setForm(f => ({ ...f, liability_type: v as LiabilityType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIABILITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>대출기관 (선택)</Label>
              <Input placeholder="예: 국민은행" value={form.creditor} onChange={e => setForm(f => ({ ...f, creditor: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>잔액 (원)</Label>
              <Input
                type="text"
                value={Number(form.balance || 0).toLocaleString('ko-KR')}
                onChange={e => setForm(f => ({ ...f, balance: String(parseAmountInput(e.target.value)) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>금리 (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="3.5"
                  value={form.interest_rate}
                  onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>만기일</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea placeholder="메모 입력" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className="h-16" />
            </div>
          </div>
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
