import { geoMercator, geoPath } from 'd3-geo'
import { feature, merge } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'

// SVG 좌표계 크기 (viewBox 기준)
export const MAP_W = 800
export const MAP_H = 980

// 시군구 코드 앞 2자리 → 시/도 이름
const PROVINCE_NAMES: Record<string, string> = {
  '11': '서울', '21': '부산', '22': '대구', '23': '인천', '24': '광주',
  '25': '대전', '26': '울산', '29': '세종', '31': '경기', '32': '강원',
  '33': '충북', '34': '충남', '35': '전북', '36': '전남', '37': '경북',
  '38': '경남', '39': '제주',
}

export interface RegionPath {
  code: string
  name: string
  d: string
  cx: number
  cy: number
}

export interface ProvinceLabel {
  code: string // 2자리 prefix
  name: string
  cx: number
  cy: number
}

export interface KoreaGeo {
  regions: RegionPath[]
  provinces: ProvinceLabel[]
}

interface RegionProps {
  code: string
  name: string
}

interface SeoulDongProps {
  code: string
  name: string
  gu: string
}

interface TopoLike {
  objects: Record<string, unknown>
  arcs: unknown
}

export const SEOUL_MAP_W = 800
export const SEOUL_MAP_H = 800

export interface SeoulGeo {
  regions: RegionPath[]
  guLabels: ProvinceLabel[]
}

let cache: KoreaGeo | null = null
let seoulCache: SeoulGeo | null = null
let topoCache: { topo: TopoLike; obj: { geometries: Array<{ properties: RegionProps }> }; fc: FeatureCollection<Geometry, RegionProps> } | null = null

async function loadTopo() {
  if (topoCache) return topoCache
  const topo = (await import('@/assets/skorea-municipalities-topo.json')).default as unknown as TopoLike
  const objKey = Object.keys(topo.objects)[0]
  const obj = topo.objects[objKey] as { geometries: Array<{ properties: RegionProps }> }
  const fc = feature(topo as never, obj as never) as unknown as FeatureCollection<Geometry, RegionProps>
  topoCache = { topo, obj, fc }
  return { topo, obj, fc }
}

export async function loadKoreaRegions(): Promise<KoreaGeo> {
  if (cache) return cache

  const { topo, obj, fc } = await loadTopo()

  const projection = geoMercator().fitSize([MAP_W, MAP_H], fc)
  const pathGen = geoPath(projection)

  const regions: RegionPath[] = fc.features.map((f: Feature<Geometry, RegionProps>) => {
    const [cx, cy] = pathGen.centroid(f)
    return { code: f.properties.code, name: f.properties.name, d: pathGen(f) ?? '', cx, cy }
  })

  const groups = new Map<string, typeof obj.geometries>()
  for (const g of obj.geometries) {
    const pre = g.properties.code.slice(0, 2)
    const arr = groups.get(pre)
    if (arr) arr.push(g); else groups.set(pre, [g])
  }

  const provinces: ProvinceLabel[] = []
  for (const [pre, geoms] of groups) {
    const name = PROVINCE_NAMES[pre]
    if (!name) continue
    const merged = merge(topo as never, geoms as never) as MultiPolygon | Polygon
    const [cx, cy] = pathGen.centroid(merged)
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      provinces.push({ code: pre, name, cx, cy })
    }
  }

  cache = { regions, provinces }
  return cache
}

export async function loadSeoulRegions(): Promise<SeoulGeo> {
  if (seoulCache) return seoulCache

  const raw = (await import('@/assets/seoul-dong.json')).default as unknown as FeatureCollection<Geometry, SeoulDongProps>

  const projection = geoMercator().fitSize([SEOUL_MAP_W, SEOUL_MAP_H], raw)
  const pathGen = geoPath(projection)

  const regions: RegionPath[] = raw.features.map((f: Feature<Geometry, SeoulDongProps>) => {
    const [cx, cy] = pathGen.centroid(f)
    const dongName = f.properties.name.replace(/^.+구\s*/, '')
    return { code: f.properties.code, name: dongName, d: pathGen(f) ?? '', cx, cy }
  })

  const guGroups = new Map<string, { xs: number[]; ys: number[] }>()
  for (const f of raw.features) {
    const gu = f.properties.gu
    const [cx, cy] = pathGen.centroid(f)
    if (!Number.isFinite(cx)) continue
    let g = guGroups.get(gu)
    if (!g) { g = { xs: [], ys: [] }; guGroups.set(gu, g) }
    g.xs.push(cx); g.ys.push(cy)
  }

  const guLabels: ProvinceLabel[] = []
  for (const [gu, g] of guGroups) {
    const cx = g.xs.reduce((a, b) => a + b, 0) / g.xs.length
    const cy = g.ys.reduce((a, b) => a + b, 0) / g.ys.length
    guLabels.push({ code: gu, name: gu, cx, cy })
  }

  seoulCache = { regions, guLabels }
  return seoulCache
}
