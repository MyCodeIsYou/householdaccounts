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

interface TopoLike {
  objects: Record<string, unknown>
  arcs: unknown
}

let cache: KoreaGeo | null = null

// 대한민국 시/군/구 TopoJSON → SVG path + 시도 라벨 (최초 1회, 이후 캐시)
export async function loadKoreaRegions(): Promise<KoreaGeo> {
  if (cache) return cache

  const topo = (await import('@/assets/skorea-municipalities-topo.json')).default as unknown as TopoLike
  const objKey = Object.keys(topo.objects)[0]
  const obj = topo.objects[objKey] as { geometries: Array<{ properties: RegionProps }> }

  const fc = feature(topo as never, obj as never) as unknown as FeatureCollection<Geometry, RegionProps>

  const projection = geoMercator().fitSize([MAP_W, MAP_H], fc)
  const pathGen = geoPath(projection)

  const regions: RegionPath[] = fc.features.map((f: Feature<Geometry, RegionProps>) => {
    const [cx, cy] = pathGen.centroid(f)
    return { code: f.properties.code, name: f.properties.name, d: pathGen(f) ?? '', cx, cy }
  })

  // 시/도별로 시군구 지오메트리를 병합해 라벨 중심점 계산
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
