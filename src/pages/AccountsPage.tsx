import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useAssetSnapshots } from '@/hooks/useAssetSnapshots'
import { useBankInstitutions } from '@/hooks/useBankInstitutions'
import { useAccountTypes } from '@/hooks/useAccountTypes'
import { useDragScroll } from '@/hooks/useDragScroll'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Building2, History, TrendingUp, CalendarPlus, Wallet } from 'lucide-react'
import { formatCurrency, parseAmountInput } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Account, AccountInsert } from '@/types'

interface AccountFormState {
  bank_name: string
  account_type: string
  label: string
  balance: string
  currency: string
  is_active: boolean
  display_order: number
}

const defaultAccountForm: AccountFormState = {
  bank_name: '',
  account_type: '',
  label: '',
  balance: '0',
  currency: 'KRW',
  is_active: true,
  display_order: 0,
}

interface SnapshotFormState {
  snapshot_date: string
  total_amount: string
}

const today = new Date().toISOString().slice(0, 10)
const SNAPSHOT_PAGE_SIZE = 12

export default function AccountsPage() {
  const { data: accounts = [], error: accountsError, totalBalance, add, update, remove } = useAccounts()
  const { banks } = useBankInstitutions()
  const { accountTypes } = useAccountTypes()
  useCategories()

  const snapshotFrom = `${new Date().getFullYear() - 1}-01-01`
  const { data: snapshots = [], upsert: upsertSnapshot, remove: removeSnapshot } = useAssetSnapshots(snapshotFrom)

  const dragScrollRef = useDragScroll<HTMLDivElement>()

  const [accountOpen, setAccountOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [accountForm, setAccountForm] = useState<AccountFormState>(defaultAccountForm)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [snapshotForm, setSnapshotForm] = useState<SnapshotFormState>({ snapshot_date: today, total_amount: '' })
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)

  const [showAllSnapshots, setShowAllSnapshots] = useState(false)
  const visibleSnapshots = showAllSnapshots ? snapshots : snapshots.slice(0, SNAPSHOT_PAGE_SIZE)

  // 은행 이름 목록 (DB 기반, fallback 없음)
  const bankNames = banks.map(b => b.name)
  const typeNames = accountTypes.map(t => t.name)

  function openAddAccount() {
    setEditing(null)
    setAccountForm({ ...defaultAccountForm, account_type: typeNames[0] ?? '' })
    setAccountOpen(true)
  }

  function openEditAccount(a: Account) {
    setEditing(a)
    setAccountForm({
      bank_name: a.bank_name,
      account_type: a.account_type,
      label: a.label ?? '',
      balance: String(a.balance),
      currency: a.currency,
      is_active: a.is_active,
      display_order: a.display_order,
    })
    setAccountOpen(true)
  }

  async function handleAccountSave() {
    setSaveError(null)
    const payload: AccountInsert = {
      bank_name: accountForm.bank_name,
      account_type: accountForm.account_type as Account['account_type'],
      label: accountForm.label || null,
      balance: parseAmountInput(accountForm.balance),
      currency: accountForm.currency,
      is_active: accountForm.is_active,
      display_order: accountForm.display_order,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload })
      } else {
        await add.mutateAsync(payload)
      }
      setAccountOpen(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다')
    }
  }

  async function handleAccountDelete(id: string) {
    setDeleteError(null)
    try {
      await remove.mutateAsync(id)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '삭제에 실패했습니다')
    }
  }

  function openAddSnapshot(prefillAmount?: number) {
    setEditingSnapshotId(null)
    setSnapshotForm({ snapshot_date: today, total_amount: prefillAmount ? String(prefillAmount) : '' })
    setSnapshotOpen(true)
  }

  function openEditSnapshot(snap: { id: string; snapshot_date: string; total_amount: number }) {
    setEditingSnapshotId(snap.id)
    setSnapshotForm({ snapshot_date: snap.snapshot_date, total_amount: String(snap.total_amount) })
    setSnapshotOpen(true)
  }

  async function handleSnapshotSave() {
    const amount = parseAmountInput(snapshotForm.total_amount)
    if (!snapshotForm.snapshot_date || amount <= 0) return
    await upsertSnapshot.mutateAsync({ snapshot_date: snapshotForm.snapshot_date, total_amount: amount })
    setSnapshotOpen(false)
  }

  // 계좌 종류별 그룹화 (DB 기반)
  const usedTypes: string[] = [...new Set(accounts.map(a => a.account_type as string))]
  const orderedTypes = typeNames.filter(t => usedTypes.includes(t))
  usedTypes.forEach(t => { if (!orderedTypes.includes(t)) orderedTypes.push(t) })

  return (
    <div className="space-y-5">
      {accountsError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-rose-700">계좌 데이터를 불러오지 못했습니다</p>
          <p className="text-xs text-rose-500 mt-1 font-mono">{String(accountsError)}</p>
        </div>
      )}
      {deleteError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-rose-700">삭제 실패: {deleteError}</p>
        </div>
      )}

      {/* 상단 요약 */}
      <div className="bg-white rounded-2xl card-shadow p-4 sm:p-5 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl gradient-asset flex items-center justify-center shadow-sm shrink-0">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">현재 총 자산</p>
            <p className="text-lg sm:text-2xl font-bold text-amber-600">{formatCurrency(totalBalance)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button variant="outline" onClick={() => openAddSnapshot(totalBalance)} className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 gap-1.5 text-xs sm:text-sm">
            <CalendarPlus className="h-4 w-4 shrink-0" />
            자산 기록
          </Button>
          <Button onClick={openAddAccount} className="rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90 text-xs sm:text-sm">
            <Plus className="h-4 w-4 shrink-0" />
            계좌 추가
          </Button>
        </div>
      </div>

      {/* 계좌 가로 카드 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">등록된 계좌</h3>
          <span className="text-xs text-gray-400">{accounts.length}개 · 총 {formatCurrency(totalBalance)}</span>
        </div>

        {accounts.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm text-gray-400">등록된 계좌가 없습니다.</p>
            <Button className="mt-3" onClick={openAddAccount}>첫 계좌 추가하기</Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {orderedTypes.map(type => {
              const list = accounts.filter(a => a.account_type === type)
              if (list.length === 0) return null
              const subtotal = list.reduce((s, a) => s + a.balance, 0)

              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{type}</span>
                    <span className="text-xs font-semibold text-indigo-600">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="overflow-x-auto" ref={list === accounts.filter(a => a.account_type === orderedTypes[0]) ? dragScrollRef : undefined}>
                    <div className="flex gap-3 pb-1" style={{ minWidth: 'min-content' }}>
                      {list.map(account => (
                        <div key={account.id} className="flex-shrink-0 w-56 bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                              <Wallet className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700" onClick={() => openEditAccount(account)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-destructive">
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
                                    <AlertDialogAction onClick={() => handleAccountDelete(account.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 truncate">{account.bank_name}</p>
                          <p className="text-xs text-gray-400 truncate">{account.label ?? account.account_type}</p>
                          <p className="text-base font-bold text-gray-900 mt-2">{formatCurrency(account.balance)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 자산 이력 */}
      <div className="bg-white rounded-2xl card-shadow overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold text-gray-800">자산 이력</h3>
            <span className="text-xs text-gray-400 hidden sm:inline">날짜별 총 자산 기록 · 자산 변화 그래프에 반영됩니다</span>
          </div>
          <Button size="sm" onClick={() => openAddSnapshot()} className="rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> 이력 추가
          </Button>
        </div>

        {snapshots.length === 0 ? (
          <div className="py-12 text-center">
            <History className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">기록된 자산 이력이 없습니다</p>
            <Button size="sm" variant="outline" className="mt-4 rounded-xl" onClick={() => openAddSnapshot(totalBalance)}>
              오늘 현재 잔액으로 기록하기
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-100">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">날짜</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">총 자산</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">전일 대비</TableHead>
                  <TableHead className="w-20 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSnapshots.map((snap, idx) => {
                  const prevSnap = snapshots[idx + 1]
                  const diff = prevSnap ? snap.total_amount - prevSnap.total_amount : null
                  return (
                    <TableRow key={snap.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="text-sm font-medium text-gray-700">
                        {format(parseISO(snap.snapshot_date), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-gray-800">{formatCurrency(snap.total_amount)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {diff === null ? <span className="text-gray-300">—</span>
                          : diff > 0 ? <span className="text-emerald-600">+{formatCurrency(diff)}</span>
                          : diff < 0 ? <span className="text-rose-500">{formatCurrency(diff, true)}</span>
                          : <span className="text-gray-400">변동 없음</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => openEditSnapshot(snap)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>이 이력을 삭제하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {format(parseISO(snap.snapshot_date), 'yyyy년 MM월 dd일')} 자산 이력({formatCurrency(snap.total_amount)})을 삭제합니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeSnapshot.mutate(snap.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {snapshots.length > SNAPSHOT_PAGE_SIZE && (
              <div className="px-5 py-3 border-t border-gray-100 text-center">
                <button className="text-xs text-indigo-500 hover:text-indigo-700 font-medium" onClick={() => setShowAllSnapshots(v => !v)}>
                  {showAllSnapshots ? '접기' : `전체 ${snapshots.length}건 모두 보기`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 계좌 추가/수정 다이얼로그 */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '계좌 수정' : '계좌 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>은행/기관명</Label>
              {bankNames.length > 0 ? (
                <Select
                  value={bankNames.includes(accountForm.bank_name) ? accountForm.bank_name : '__custom__'}
                  onValueChange={v => { if (v !== '__custom__') setAccountForm(f => ({ ...f, bank_name: v })) }}
                >
                  <SelectTrigger><SelectValue placeholder="선택하세요" /></SelectTrigger>
                  <SelectContent>
                    {bankNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    <SelectItem value="__custom__">직접 입력</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {(!bankNames.includes(accountForm.bank_name) || bankNames.length === 0) && (
                <Input
                  placeholder="은행/기관명 직접 입력"
                  value={accountForm.bank_name}
                  onChange={e => setAccountForm(f => ({ ...f, bank_name: e.target.value }))}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>계좌 종류</Label>
              <Select
                value={accountForm.account_type || '__none__'}
                onValueChange={v => setAccountForm(f => ({ ...f, account_type: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="선택하세요" /></SelectTrigger>
                <SelectContent>
                  {typeNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  {typeNames.length === 0 && <SelectItem value="__none__">종류 없음</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>별명 (선택)</Label>
              <Input placeholder="예: 생활비 통장" value={accountForm.label} onChange={e => setAccountForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>현재 잔액 (원)</Label>
              <Input
                type="text"
                value={Number(accountForm.balance).toLocaleString('ko-KR')}
                onChange={e => setAccountForm(f => ({ ...f, balance: String(parseAmountInput(e.target.value)) }))}
              />
            </div>
          </div>
          {saveError && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
              <p className="text-sm text-rose-600">{saveError}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountOpen(false)}>취소</Button>
            <Button onClick={handleAccountSave} disabled={!accountForm.bank_name || !accountForm.account_type}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 자산 이력 추가/수정 다이얼로그 */}
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSnapshotId ? '자산 이력 수정' : '자산 이력 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input type="date" value={snapshotForm.snapshot_date} onChange={e => setSnapshotForm(f => ({ ...f, snapshot_date: e.target.value }))} className="rounded-xl" />
              <p className="text-xs text-gray-400">같은 날짜가 이미 있으면 금액이 덮어씌워집니다</p>
            </div>
            <div className="space-y-2">
              <Label>총 자산 (원)</Label>
              <Input
                type="text"
                placeholder="0"
                value={snapshotForm.total_amount ? Number(snapshotForm.total_amount).toLocaleString('ko-KR') : ''}
                onChange={e => setSnapshotForm(f => ({ ...f, total_amount: String(parseAmountInput(e.target.value)) }))}
                className="rounded-xl"
              />
              {totalBalance > 0 && (
                <button type="button" className="text-xs text-indigo-500 hover:text-indigo-700" onClick={() => setSnapshotForm(f => ({ ...f, total_amount: String(totalBalance) }))}>
                  현재 총 계좌 잔액({formatCurrency(totalBalance)})으로 채우기
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapshotOpen(false)}>취소</Button>
            <Button
              onClick={handleSnapshotSave}
              disabled={!snapshotForm.snapshot_date || !snapshotForm.total_amount || parseAmountInput(snapshotForm.total_amount) <= 0}
              className="gradient-primary text-white border-0 hover:opacity-90"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
