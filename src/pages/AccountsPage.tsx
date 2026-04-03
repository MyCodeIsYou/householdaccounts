import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { formatCurrency, parseAmountInput } from '@/lib/utils'
import { ACCOUNT_TYPES, BANK_NAMES } from '@/lib/constants'
import type { Account, AccountInsert, AccountType } from '@/types'

interface FormState {
  bank_name: string
  account_type: AccountType
  label: string
  balance: string
  currency: string
  is_active: boolean
  display_order: number
}

const defaultForm: FormState = {
  bank_name: '',
  account_type: '입출금',
  label: '',
  balance: '0',
  currency: 'KRW',
  is_active: true,
  display_order: 0,
}

export default function AccountsPage() {
  const { data: accounts = [], totalBalance, add, update, remove } = useAccounts()
  useCategories() // preload
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)

  function openAdd() {
    setEditing(null)
    setForm(defaultForm)
    setOpen(true)
  }

  function openEdit(a: Account) {
    setEditing(a)
    setForm({
      bank_name: a.bank_name,
      account_type: a.account_type,
      label: a.label ?? '',
      balance: String(a.balance),
      currency: a.currency,
      is_active: a.is_active,
      display_order: a.display_order,
    })
    setOpen(true)
  }

  async function handleSave() {
    const payload: AccountInsert = {
      bank_name: form.bank_name,
      account_type: form.account_type,
      label: form.label || null,
      balance: parseAmountInput(form.balance),
      currency: form.currency,
      is_active: form.is_active,
      display_order: form.display_order,
    }
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload })
    } else {
      await add.mutateAsync(payload)
    }
    setOpen(false)
  }

  const grouped = ACCOUNT_TYPES.reduce<Record<string, Account[]>>((acc, type) => {
    acc[type] = accounts.filter(a => a.account_type === type)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">총 자산</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalBalance)}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          계좌 추가
        </Button>
      </div>

      {ACCOUNT_TYPES.map(type => {
        const list = grouped[type]
        if (!list || list.length === 0) return null
        return (
          <div key={type}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{type}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {list.map(account => (
                <Card key={account.id} className="relative">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{account.bank_name}</p>
                          <Badge variant="secondary" className="text-xs mt-0.5">{account.account_type}</Badge>
                        </div>
                      </div>
                    </div>
                    {account.label && (
                      <p className="text-xs text-muted-foreground mb-1">{account.label}</p>
                    )}
                    <p className="text-xl font-bold">{formatCurrency(account.balance)}</p>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(account)}>
                        <Pencil className="h-3 w-3" />
                        수정
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>계좌를 삭제하시겠습니까?</AlertDialogTitle>
                            <AlertDialogDescription>{account.bank_name} ({account.account_type}) 계좌를 삭제합니다.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(account.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}

      {accounts.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>등록된 계좌가 없습니다.</p>
          <Button className="mt-4" onClick={openAdd}>첫 계좌 추가하기</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '계좌 수정' : '계좌 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>은행/기관명</Label>
              <Select value={form.bank_name} onValueChange={v => setForm(f => ({ ...f, bank_name: v }))}>
                <SelectTrigger><SelectValue placeholder="선택하세요" /></SelectTrigger>
                <SelectContent>
                  {BANK_NAMES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder="직접 입력"
                value={BANK_NAMES.includes(form.bank_name as typeof BANK_NAMES[number]) ? '' : form.bank_name}
                onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>계좌 종류</Label>
              <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v as AccountType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>별명 (선택)</Label>
              <Input placeholder="예: 생활비 통장" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>현재 잔액 (원)</Label>
              <Input
                type="text"
                value={Number(form.balance).toLocaleString('ko-KR')}
                onChange={e => setForm(f => ({ ...f, balance: String(parseAmountInput(e.target.value)) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.bank_name}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
