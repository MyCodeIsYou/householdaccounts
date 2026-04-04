import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Building2, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBankInstitutions } from '@/hooks/useBankInstitutions'
import { useAccountTypes } from '@/hooks/useAccountTypes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const BANK_CATEGORIES = ['은행', '증권', '연금', '기타'] as const

export default function AdminBanksPage() {
  const { appRole } = useAuth()
  const { banks, add: addBank, remove: removeBank } = useBankInstitutions()
  const { accountTypes, add: addType, remove: removeType } = useAccountTypes()

  const [bankOpen, setBankOpen] = useState(false)
  const [bankForm, setBankForm] = useState({ name: '', category: '은행' })
  const [typeOpen, setTypeOpen] = useState(false)
  const [typeForm, setTypeForm] = useState({ name: '' })
  const [error, setError] = useState<string | null>(null)

  if (appRole !== 'super_admin') return <Navigate to="/" replace />

  async function handleAddBank() {
    setError(null)
    if (!bankForm.name.trim()) return
    try {
      await addBank.mutateAsync({
        name: bankForm.name.trim(),
        category: bankForm.category,
        display_order: banks.length + 1,
      })
      setBankForm({ name: '', category: '은행' })
      setBankOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패')
    }
  }

  async function handleAddType() {
    setError(null)
    if (!typeForm.name.trim()) return
    try {
      await addType.mutateAsync({
        name: typeForm.name.trim(),
        display_order: accountTypes.length + 1,
      })
      setTypeForm({ name: '' })
      setTypeOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패')
    }
  }

  const grouped = BANK_CATEGORIES.map(cat => ({
    category: cat,
    items: banks.filter(b => b.category === cat),
  }))

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">은행/기관 & 계좌 종류 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">계좌 추가 시 선택할 수 있는 항목을 관리합니다</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-rose-700">{error}</p>
          <button onClick={() => setError(null)}><X className="w-4 h-4 text-rose-400" /></button>
        </div>
      )}

      {/* 은행/기관 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">은행/기관 목록</h3>
          <Button size="sm" onClick={() => setBankOpen(true)} className="rounded-xl gradient-primary text-white border-0 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> 추가
          </Button>
        </div>
        <div className="p-5 space-y-4">
          {grouped.map(({ category, items }) => (
            items.length > 0 && (
              <div key={category}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map(bank => (
                    <div key={bank.id} className="group flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700 transition-colors">
                      {bank.name}
                      <button
                        onClick={() => removeBank.mutate(bank.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* 계좌 종류 목록 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">계좌 종류</h3>
          <Button size="sm" onClick={() => setTypeOpen(true)} className="rounded-xl gradient-primary text-white border-0 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> 추가
          </Button>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {accountTypes.map(t => (
              <div key={t.id} className="group flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700 transition-colors">
                {t.name}
                <button
                  onClick={() => removeType.mutate(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 은행 추가 다이얼로그 */}
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>은행/기관 추가</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input placeholder="예: 토스뱅크" value={bankForm.name} onChange={e => setBankForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>분류</Label>
              <Select value={bankForm.category} onValueChange={v => setBankForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BANK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankOpen(false)}>취소</Button>
            <Button onClick={handleAddBank} disabled={!bankForm.name.trim()}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 계좌 종류 추가 다이얼로그 */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>계좌 종류 추가</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input placeholder="예: 청약저축" value={typeForm.name} onChange={e => setTypeForm({ name: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeOpen(false)}>취소</Button>
            <Button onClick={handleAddType} disabled={!typeForm.name.trim()}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
