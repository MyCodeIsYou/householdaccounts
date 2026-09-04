import { useState } from 'react'
import { useDragScroll } from '@/hooks/useDragScroll'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { useCards } from '@/hooks/useCards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, List, CalendarDays, ListPlus, X } from 'lucide-react'
import CalendarView from '@/components/transactions/CalendarView'
import { formatCurrency, formatDateKo, parseAmountInput, getCurrentYearMonth } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/lib/constants'
import type { Transaction, TransactionInsert, TransactionType, PaymentMethod, TransactionFilters } from '@/types'

const { year: curYear, month: curMonth } = getCurrentYearMonth()

interface FormState {
  txn_date: string
  type: TransactionType
  category_id: string
  subcategory_id: string
  amount: string
  memo: string
  payment_method: PaymentMethod | ''
  account_id: string
  card_id: string
  is_allowance: boolean
  is_fixed: boolean
}

function emptyForm(): FormState {
  return {
    txn_date: new Date().toISOString().slice(0, 10),
    type: 'expense',
    category_id: '',
    subcategory_id: '',
    amount: '',
    memo: '',
    payment_method: '',
    account_id: '',
    card_id: '',
    is_allowance: false,
    is_fixed: false,
  }
}

export default function TransactionsPage() {
  const [filterYear, setFilterYear] = useState(curYear)
  const [filterMonth, setFilterMonth] = useState(curMonth)
  const [filterType, setFilterType] = useState<TransactionFilters['type']>('all')
  const [keyword, setKeyword] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  const filters: TransactionFilters = { year: filterYear, month: filterMonth, type: filterType, keyword: keyword || undefined }
  const { transactions, totalIncome, totalExpense, add, addBulk, update, remove } = useTransactions(filters)
  const { categories, getTopLevel, getChildren } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const { cards } = useCards()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<FormState[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const dragScrollRef = useDragScroll<HTMLDivElement>()

  const topCategories = getTopLevel(form.type === 'transfer' ? undefined : form.type)
  const subCategories = form.category_id ? getChildren(form.category_id) : []

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(t: Transaction) {
    setEditing(t)
    setForm({
      txn_date: t.txn_date,
      type: t.type,
      category_id: t.category_id ?? '',
      subcategory_id: t.subcategory_id ?? '',
      amount: String(t.amount),
      memo: t.memo ?? '',
      payment_method: t.payment_method ?? '',
      account_id: t.account_id ?? '',
      card_id: t.card_id ?? '',
      is_allowance: t.is_allowance,
      is_fixed: t.is_fixed,
    })
    setOpen(true)
  }

  async function handleSave() {
    const payload: TransactionInsert = {
      txn_date: form.txn_date,
      type: form.type,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      amount: parseAmountInput(form.amount),
      memo: form.memo || null,
      payment_method: (form.payment_method as PaymentMethod) || null,
      account_id: form.account_id || null,
      card_id: form.card_id || null,
      is_allowance: form.is_allowance,
      is_fixed: form.is_fixed,
    }
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload })
    } else {
      await add.mutateAsync(payload)
    }
    setOpen(false)
  }

  function openBulkAdd() {
    setBulkRows([emptyForm()])
    setBulkOpen(true)
  }

  function addBulkRow() {
    const lastRow = bulkRows[bulkRows.length - 1]
    setBulkRows(prev => [...prev, {
      ...emptyForm(),
      txn_date: lastRow?.txn_date ?? emptyForm().txn_date,
      type: lastRow?.type ?? 'expense',
      payment_method: lastRow?.payment_method ?? '',
      account_id: lastRow?.account_id ?? '',
      card_id: lastRow?.card_id ?? '',
    }])
  }

  function removeBulkRow(idx: number) {
    setBulkRows(prev => prev.filter((_, i) => i !== idx))
  }

  function updateBulkRow(idx: number, patch: Partial<FormState>) {
    setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  async function handleBulkSave() {
    const valid = bulkRows.filter(r => r.amount && parseAmountInput(r.amount) > 0 && r.txn_date)
    if (valid.length === 0) return
    setBulkSaving(true)
    try {
      const payloads: TransactionInsert[] = valid.map(r => ({
        txn_date: r.txn_date,
        type: r.type,
        category_id: r.category_id || null,
        subcategory_id: r.subcategory_id || null,
        amount: parseAmountInput(r.amount),
        memo: r.memo || null,
        payment_method: (r.payment_method as PaymentMethod) || null,
        account_id: r.account_id || null,
        card_id: r.card_id || null,
        is_allowance: r.is_allowance,
        is_fixed: r.is_fixed,
      }))
      await addBulk.mutateAsync(payloads)
      setBulkOpen(false)
    } finally {
      setBulkSaving(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => curYear - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  if (!categories) return null

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="bg-white rounded-2xl card-shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs text-gray-500 font-medium">연도</Label>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
            <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-500 font-medium">월</Label>
          <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(Number(v))}>
            <SelectTrigger className="w-20 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-500 font-medium">구분</Label>
          <Select value={filterType} onValueChange={v => setFilterType(v as TransactionFilters['type'])}>
            <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="income">수입</SelectItem>
              <SelectItem value="expense">지출</SelectItem>
              <SelectItem value="transfer">이체</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-40">
          <Label className="text-xs text-gray-500 font-medium">검색 (메모)</Label>
          <Input placeholder="검색어 입력" value={keyword} onChange={e => setKeyword(e.target.value)} className="rounded-xl" />
        </div>
        <div className="flex items-center gap-1 border rounded-xl p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
            title="리스트"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
            title="달력"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" onClick={openBulkAdd} className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50">
          <ListPlus className="h-4 w-4" />
          <span className="hidden sm:inline">일괄 추가</span>
        </Button>
        <Button onClick={openAdd} className="rounded-xl gradient-primary text-white border-0 shadow-sm hover:opacity-90">
          <Plus className="h-4 w-4" />
          거래 추가
        </Button>
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView
          transactions={transactions}
          year={filterYear}
          month={filterMonth}
          onDateClick={(date) => {
            const t = transactions.filter(t => t.txn_date === date)
            if (t.length === 0) {
              setForm({ ...emptyForm(), txn_date: date })
              setEditing(null)
              setOpen(true)
            }
          }}
        />
      ) : (
      <>
      {/* 합계 요약 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: '수입', value: totalIncome, textCls: 'text-emerald-600', dotCls: 'bg-emerald-400' },
          { label: '지출', value: totalExpense, textCls: 'text-rose-500', dotCls: 'bg-rose-400' },
          { label: '잔액', value: totalIncome - totalExpense, textCls: 'text-indigo-600', dotCls: 'bg-indigo-400' },
        ].map(({ label, value, textCls, dotCls }) => (
          <div key={label} className="bg-white rounded-2xl card-shadow p-3 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${dotCls} shrink-0`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className={`text-sm sm:text-xl font-bold truncate ${textCls}`}>{formatCurrency(value, true)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 모바일 카드 리스트 (md 미만 전용) */}
      <div className="md:hidden bg-white rounded-2xl card-shadow overflow-hidden">
        {transactions.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm">거래 내역이 없습니다</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {transactions.map(t => (
              <li key={t.id} className="px-3 py-3 flex items-start gap-3">
                <div className="shrink-0 pt-0.5">
                  <Badge
                    variant={t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'secondary'}
                    className="text-[10px] px-1.5 py-0.5 font-bold"
                  >
                    {t.type === 'income' ? '수입' : t.type === 'expense' ? '지출' : '이체'}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {t.category?.name ?? '—'}
                      {t.subcategory && <span className="text-gray-400"> / {t.subcategory.name}</span>}
                    </p>
                    <span className={`text-sm font-bold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {formatDateKo(t.txn_date)}
                    {t.payment_method ? ` · ${t.payment_method}` : ''}
                    {t.memo ? ` · ${t.memo}` : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>거래를 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 거래 테이블 (md 이상 전용) */}
      <div className="hidden md:block bg-white rounded-2xl card-shadow overflow-x-auto" ref={dragScrollRef}>
        <Table className="!w-auto min-w-full">
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-100">
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">날짜</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">구분</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">카테고리</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">금액</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">결제방법</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">메모</TableHead>
              <TableHead className="w-20 whitespace-nowrap"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-16">
                  거래 내역이 없습니다
                </TableCell>
              </TableRow>
            )}
            {transactions.map(t => (
              <TableRow key={t.id} className="hover:bg-gray-50 transition-colors">
                <TableCell className="text-sm text-gray-600 whitespace-nowrap">{formatDateKo(t.txn_date)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'secondary'}>
                    {t.type === 'income' ? '수입' : t.type === 'expense' ? '지출' : '이체'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                  {t.category?.name ?? '—'}
                  {t.subcategory && <span className="text-gray-400"> / {t.subcategory.name}</span>}
                </TableCell>
                <TableCell className={`font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </TableCell>
                <TableCell className="text-sm text-gray-400 whitespace-nowrap">{t.payment_method ?? '—'}</TableCell>
                <TableCell className="text-sm text-gray-400 whitespace-nowrap">{t.memo ?? '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>거래를 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </>
      )}

      {/* 거래 추가/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '거래 수정' : '거래 추가'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input type="date" value={form.txn_date} onChange={e => setForm(f => ({ ...f, txn_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>구분</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as TransactionType, category_id: '', subcategory_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">수입</SelectItem>
                  <SelectItem value="expense">지출</SelectItem>
                  <SelectItem value="transfer">이체</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v, subcategory_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {topCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>세부 항목</Label>
              <Select value={form.subcategory_id} onValueChange={v => setForm(f => ({ ...f, subcategory_id: v }))} disabled={subCategories.length === 0}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {subCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>금액 (원)</Label>
              <Input
                type="text"
                placeholder="0"
                value={form.amount ? Number(form.amount).toLocaleString('ko-KR') : ''}
                onChange={e => setForm(f => ({ ...f, amount: String(parseAmountInput(e.target.value)) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>결제 방법</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v as PaymentMethod }))}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>카드</Label>
              <Select value={form.card_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, card_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">없음</SelectItem>
                  {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.card_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>계좌</Label>
              <Select value={form.account_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, account_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">없음</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} {a.label ?? a.account_type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>메모</Label>
              <Textarea placeholder="메모 입력" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className="h-16" />
            </div>
            <div className="flex gap-6 col-span-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.is_allowance} onCheckedChange={v => setForm(f => ({ ...f, is_allowance: !!v }))} />
                용돈 항목
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.is_fixed} onCheckedChange={v => setForm(f => ({ ...f, is_fixed: !!v }))} />
                고정비 항목
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.amount || !form.txn_date}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 일괄 거래 추가 다이얼로그 */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>거래 일괄 추가</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto py-2">
            <table className="w-full text-xs border-collapse" style={{ minWidth: '800px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100">
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ width: '32px' }}>#</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ width: '130px' }}>날짜</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ width: '80px' }}>구분</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ width: '120px' }}>카테고리</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ width: '120px' }}>세부</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ width: '110px' }}>금액</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap" style={{ width: '100px' }}>결제방법</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">메모</th>
                  <th className="px-2 py-2" style={{ width: '32px' }}></th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((row, idx) => {
                  const rowTopCats = getTopLevel(row.type === 'transfer' ? undefined : row.type)
                  const rowSubCats = row.category_id ? getChildren(row.category_id) : []
                  return (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-2 py-1.5 text-gray-400 font-medium">{idx + 1}</td>
                      <td className="px-1 py-1.5">
                        <Input type="date" value={row.txn_date} onChange={e => updateBulkRow(idx, { txn_date: e.target.value })} className="h-7 text-xs rounded-md border-gray-200 px-1.5" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Select value={row.type} onValueChange={v => updateBulkRow(idx, { type: v as TransactionType, category_id: '', subcategory_id: '' })}>
                          <SelectTrigger className="h-7 text-xs rounded-md border-gray-200 px-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">수입</SelectItem>
                            <SelectItem value="expense">지출</SelectItem>
                            <SelectItem value="transfer">이체</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Select value={row.category_id} onValueChange={v => updateBulkRow(idx, { category_id: v, subcategory_id: '' })}>
                          <SelectTrigger className="h-7 text-xs rounded-md border-gray-200 px-1.5"><SelectValue placeholder="선택" /></SelectTrigger>
                          <SelectContent>
                            {rowTopCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Select value={row.subcategory_id} onValueChange={v => updateBulkRow(idx, { subcategory_id: v })} disabled={rowSubCats.length === 0}>
                          <SelectTrigger className="h-7 text-xs rounded-md border-gray-200 px-1.5"><SelectValue placeholder="선택" /></SelectTrigger>
                          <SelectContent>
                            {rowSubCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="text"
                          placeholder="0"
                          value={row.amount ? Number(row.amount).toLocaleString('ko-KR') : ''}
                          onChange={e => updateBulkRow(idx, { amount: String(parseAmountInput(e.target.value)) })}
                          className="h-7 text-xs rounded-md border-gray-200 px-1.5 text-right"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Select value={row.payment_method} onValueChange={v => updateBulkRow(idx, { payment_method: v as PaymentMethod })}>
                          <SelectTrigger className="h-7 text-xs rounded-md border-gray-200 px-1.5"><SelectValue placeholder="선택" /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          placeholder="메모"
                          value={row.memo}
                          onChange={e => updateBulkRow(idx, { memo: e.target.value })}
                          className="h-7 text-xs rounded-md border-gray-200 px-1.5"
                        />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button
                          onClick={() => removeBulkRow(idx)}
                          className="text-gray-300 hover:text-rose-500 transition-colors disabled:opacity-30"
                          disabled={bulkRows.length <= 1}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <button
              onClick={addBulkRow}
              className="w-full mt-2 py-2 border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 행 추가
            </button>
          </div>
          <DialogFooter className="pt-3 border-t">
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-xs text-gray-400">
                {bulkRows.filter(r => r.amount && parseAmountInput(r.amount) > 0).length}건 입력됨
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setBulkOpen(false)}>취소</Button>
                <Button
                  onClick={handleBulkSave}
                  disabled={bulkSaving || bulkRows.every(r => !r.amount || parseAmountInput(r.amount) <= 0)}
                  className="gradient-primary text-white border-0 hover:opacity-90"
                >
                  {bulkSaving ? '저장 중...' : '일괄 저장'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
