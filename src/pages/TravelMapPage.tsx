import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Plus, Minus, Maximize2, MapPin, Trash2, Pencil, ImagePlus, X, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTravelMap } from '@/hooks/useTravelMap'
import { loadKoreaRegions, MAP_W, MAP_H, type KoreaGeo } from '@/lib/koreaMap'
import type { TravelLog } from '@/types'

const DEFAULT_FILL = '#e2e8f0' // slate-200 (미방문)
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#d946ef', '#ec4899', '#f43f5e', '#78716c',
]
const MIN_K = 1
const MAX_K = 16
const K_LABEL = 3 // 이 배율 이상이면 시군구 라벨, 미만이면 시도 라벨

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const todayStr = () => new Date().toISOString().slice(0, 10)

interface View { k: number; x: number; y: number }
interface LogForm {
  editingId: string | null
  title: string
  visited_date: string
  memo: string
  file: File | null
  previewUrl: string | null
  existingPhoto: string | null
  saving: boolean
  error: string | null
}
const emptyForm: LogForm = {
  editingId: null, title: '', visited_date: todayStr(), memo: '',
  file: null, previewUrl: null, existingPhoto: null, saving: false, error: null,
}

export default function TravelMapPage() {
  const { regions, logs, setRegionColor, removeRegion, uploadPhoto, addLog, updateLog, deleteLog } = useTravelMap()

  const [geo, setGeo] = useState<KoreaGeo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [form, setForm] = useState<LogForm>(emptyForm)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragStart = useRef<{ cx: number; cy: number; x: number; y: number } | null>(null)
  const pinchStart = useRef<{ dist: number; k: number; x: number; y: number; vx: number; vy: number } | null>(null)
  const movedRef = useRef(false)

  // 지도 지오메트리 로드
  useEffect(() => {
    let alive = true
    loadKoreaRegions()
      .then(r => { if (alive) setGeo(r) })
      .catch(e => { if (alive) setLoadError(e instanceof Error ? e.message : '지도 로드 실패') })
    return () => { alive = false }
  }, [])

  const colorMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of regions) m.set(r.region_code, r.color)
    return m
  }, [regions])

  const logsByRegion = useMemo(() => {
    const m = new Map<string, TravelLog[]>()
    for (const l of logs) {
      const arr = m.get(l.region_code)
      if (arr) arr.push(l); else m.set(l.region_code, [l])
    }
    return m
  }, [logs])

  const selectedRegion = geo?.regions.find(p => p.code === selectedCode) ?? null
  const selectedColorRow = regions.find(r => r.region_code === selectedCode) ?? null
  const selectedLogs = selectedCode ? (logsByRegion.get(selectedCode) ?? []) : []

  // ── 좌표 변환 ──────────────────────────────────────────
  const clientToView = useCallback((cx: number, cy: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { vx: 0, vy: 0 }
    return { vx: ((cx - rect.left) / rect.width) * MAP_W, vy: ((cy - rect.top) / rect.height) * MAP_H }
  }, [])

  // ── 확대/축소/이동 ──────────────────────────────────────
  const zoomBy = useCallback((factor: number, vx: number, vy: number) => {
    setView(v => {
      const k = clamp(v.k * factor, MIN_K, MAX_K)
      const ratio = k / v.k
      return { k, x: vx - (vx - v.x) * ratio, y: vy - (vy - v.y) * ratio }
    })
  }, [])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const { vx, vy } = clientToView(e.clientX, e.clientY)
    zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, vx, vy)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    movedRef.current = false
    if (pointers.current.size === 1) {
      dragStart.current = { cx: e.clientX, cy: e.clientY, x: view.x, y: view.y }
      pinchStart.current = null
    } else if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()]
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      const { vx, vy } = clientToView((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
      pinchStart.current = { dist, k: view.k, x: view.x, y: view.y, vx, vy }
      dragStart.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [p1, p2] = [...pointers.current.values()]
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      const ps = pinchStart.current
      const k = clamp(ps.k * (dist / (ps.dist || 1)), MIN_K, MAX_K)
      const ratio = k / ps.k
      setView({ k, x: ps.vx - (ps.vx - ps.x) * ratio, y: ps.vy - (ps.vy - ps.y) * ratio })
      movedRef.current = true
    } else if (pointers.current.size === 1 && dragStart.current) {
      const ds = dragStart.current
      const dxc = e.clientX - ds.cx
      const dyc = e.clientY - ds.cy
      if (Math.hypot(dxc, dyc) > 4) movedRef.current = true
      setView(v => ({ ...v, x: ds.x + (dxc / rect.width) * MAP_W, y: ds.y + (dyc / rect.height) * MAP_H }))
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    const wasSingleTap = pointers.current.size === 1 && !movedRef.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) dragStart.current = null

    if (wasSingleTap) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const code = el?.getAttribute('data-code')
      if (code) openRegion(code)
    }
  }

  function openRegion(code: string) {
    setSelectedCode(code)
    setForm(emptyForm)
  }

  // ── 지역 색상 ──────────────────────────────────────────
  function pickColor(color: string) {
    if (!selectedRegion) return
    setRegionColor.mutate({ regionCode: selectedRegion.code, regionName: selectedRegion.name, color })
  }

  // ── 여행 기록 저장 ─────────────────────────────────────
  function editLog(log: TravelLog) {
    setForm({
      editingId: log.id,
      title: log.title ?? '',
      visited_date: log.visited_date ?? todayStr(),
      memo: log.memo ?? '',
      file: null,
      previewUrl: null,
      existingPhoto: log.photo_url,
      saving: false,
      error: null,
    })
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setForm(f => ({
      ...f,
      file,
      previewUrl: file ? URL.createObjectURL(file) : null,
    }))
  }

  async function saveLog() {
    if (!selectedRegion) return
    setForm(f => ({ ...f, saving: true, error: null }))
    try {
      let photo_url: string | null = form.existingPhoto
      if (form.file) photo_url = await uploadPhoto(form.file)

      const payload = {
        region_code: selectedRegion.code,
        region_name: selectedRegion.name,
        title: form.title.trim() || null,
        visited_date: form.visited_date || null,
        memo: form.memo.trim() || null,
        photo_url,
      }

      if (form.editingId) {
        await updateLog.mutateAsync({ id: form.editingId, payload })
      } else {
        await addLog.mutateAsync(payload)
        // 색이 없던 지역이면 기본색으로 방문 표시
        if (!selectedColorRow) {
          setRegionColor.mutate({ regionCode: selectedRegion.code, regionName: selectedRegion.name, color: PALETTE[10] })
        }
      }
      setForm(emptyForm)
    } catch (e) {
      setForm(f => ({ ...f, saving: false, error: e instanceof Error ? e.message : '저장 실패' }))
    }
  }

  // ── SVG path 요소 (색/선택 변경 시에만 재생성) ───────────
  const pathEls = useMemo(() => {
    if (!geo) return null
    return geo.regions.map(p => {
      const isSel = p.code === selectedCode
      return (
        <path
          key={p.code}
          data-code={p.code}
          d={p.d}
          fill={colorMap.get(p.code) ?? DEFAULT_FILL}
          stroke={isSel ? '#0f172a' : '#ffffff'}
          strokeWidth={isSel ? 2 : 0.6}
          vectorEffect="non-scaling-stroke"
          className="cursor-pointer hover:brightness-90 hover:[stroke:#334155] hover:[stroke-width:1.4] transition-[filter]"
        />
      )
    })
  }, [geo, colorMap, selectedCode])

  // 라벨 (축소: 시도 / 확대: 시군구). 그룹이 scale(k) 되므로 폰트는 1/k로 보정
  const labelEls = useMemo(() => {
    if (!geo) return null
    const k = view.k
    const showRegion = k >= K_LABEL
    const items = showRegion ? geo.regions : geo.provinces
    const fs = (showRegion ? 11 : 15) / k
    const sw = 2.6 / k
    return items.map(it => (
      <text
        key={(showRegion ? 'r' : 'p') + it.code}
        x={it.cx}
        y={it.cy}
        fontSize={fs}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#1e293b"
        style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: sw, strokeLinejoin: 'round', fontWeight: showRegion ? 500 : 700 }}
        className="pointer-events-none select-none"
      >
        {it.name}
      </text>
    ))
  }, [geo, view.k])

  const visitedCount = regions.length

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-500" /> 여행 지도
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              시/군/구를 눌러 색을 칠하고 여행 일기를 남겨보세요
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-indigo-600">{visitedCount}</p>
            <p className="text-[10px] text-gray-400">다녀온 지역</p>
          </div>
        </div>
      </div>

      {/* 지도 */}
      <div className="bg-white rounded-2xl card-shadow p-3 relative overflow-hidden">
        {loadError && (
          <div className="h-[60vh] flex items-center justify-center">
            <p className="text-sm text-rose-500">{loadError}</p>
          </div>
        )}
        {!loadError && !geo && (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">지도를 불러오는 중…</p>
          </div>
        )}
        {!loadError && geo && (
          <>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="w-full h-[60vh] md:h-[68vh] select-none"
              style={{ touchAction: 'none', cursor: 'grab' }}
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={e => { pointers.current.delete(e.pointerId); pinchStart.current = null }}
              onPointerLeave={e => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinchStart.current = null; if (pointers.current.size === 0) dragStart.current = null }}
            >
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                {pathEls}
                {labelEls}
              </g>
            </svg>

            {/* 확대/축소 컨트롤 */}
            <div className="absolute right-5 bottom-5 flex flex-col gap-1.5">
              <button
                onClick={() => zoomBy(1.4, MAP_W / 2, MAP_H / 2)}
                className="w-9 h-9 rounded-xl bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition"
                title="확대"
              ><Plus className="h-4 w-4" /></button>
              <button
                onClick={() => zoomBy(1 / 1.4, MAP_W / 2, MAP_H / 2)}
                className="w-9 h-9 rounded-xl bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition"
                title="축소"
              ><Minus className="h-4 w-4" /></button>
              <button
                onClick={() => setView({ k: 1, x: 0, y: 0 })}
                className="w-9 h-9 rounded-xl bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition"
                title="전체 보기"
              ><Maximize2 className="h-4 w-4" /></button>
            </div>
          </>
        )}
      </div>

      {/* 지역 상세 다이얼로그 */}
      <Dialog open={!!selectedCode} onOpenChange={o => { if (!o) { setSelectedCode(null); setForm(emptyForm) } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-500" />
              {selectedRegion?.name ?? ''}
            </DialogTitle>
          </DialogHeader>

          {/* 색상 선택 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">방문 색상</p>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map(c => {
                const active = selectedColorRow?.color === c
                return (
                  <button
                    key={c}
                    onClick={() => pickColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition ${active ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'hover:scale-110'}`}
                    title={c}
                  />
                )
              })}
            </div>
            {selectedColorRow && (
              <button
                onClick={() => { removeRegion.mutate(selectedColorRow.id) }}
                className="mt-2 text-xs text-gray-400 hover:text-rose-500 inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> 색 지우기 (방문 취소)
              </button>
            )}
          </div>

          <div className="h-px bg-gray-100 my-1" />

          {/* 여행 기록 폼 */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500">
              {form.editingId ? '기록 수정' : '새 여행 기록'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">다녀온 날짜</Label>
                <Input
                  type="date"
                  value={form.visited_date}
                  onChange={e => setForm(f => ({ ...f, visited_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">제목</Label>
                <Input
                  placeholder="예: 여름 가족여행"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">추억 · 일기</Label>
              <Textarea
                placeholder="그날의 추억을 적어보세요"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                className="h-24"
              />
            </div>

            {/* 사진 */}
            <div className="space-y-1">
              <Label className="text-xs">사진 (선택)</Label>
              {(form.previewUrl || form.existingPhoto) ? (
                <div className="relative w-full">
                  <img
                    src={form.previewUrl ?? form.existingPhoto ?? ''}
                    alt="preview"
                    className="w-full max-h-48 object-cover rounded-xl border border-gray-100"
                  />
                  <button
                    onClick={() => setForm(f => ({ ...f, file: null, previewUrl: null, existingPhoto: null }))}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
                  ><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-16 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm cursor-pointer hover:bg-gray-50">
                  <ImagePlus className="h-4 w-4" /> 사진 추가
                  <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                </label>
              )}
            </div>

            {form.error && <p className="text-xs text-rose-500">{form.error}</p>}

            <div className="flex gap-2">
              {form.editingId && (
                <Button variant="outline" className="flex-1" onClick={() => setForm(emptyForm)}>취소</Button>
              )}
              <Button className="flex-1 gradient-primary text-white border-0" onClick={saveLog} disabled={form.saving}>
                {form.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.editingId ? '수정 저장' : <><Plus className="h-4 w-4" /> 기록 추가</>)}
              </Button>
            </div>
          </div>

          {/* 기존 기록 목록 */}
          {selectedLogs.length > 0 && (
            <>
              <div className="h-px bg-gray-100 my-1" />
              <p className="text-xs font-medium text-gray-500">여행 기록 {selectedLogs.length}개</p>
              <div className="space-y-2">
                {selectedLogs.map(log => (
                  <div key={log.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {log.title && <p className="text-sm font-semibold text-gray-800 truncate">{log.title}</p>}
                          {log.visited_date && <span className="text-[11px] text-gray-400 shrink-0">{log.visited_date}</span>}
                        </div>
                        {log.memo && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{log.memo}</p>}
                        {log.photo_url && (
                          <img src={log.photo_url} alt="" className="mt-2 w-full max-h-40 object-cover rounded-lg" />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => editLog(log)} className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="w-7 h-7 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-gray-100 flex items-center justify-center">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>기록을 삭제할까요?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {selectedRegion?.name}의 이 여행 기록을 삭제합니다. 되돌릴 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteLog.mutate(log)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >삭제</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
