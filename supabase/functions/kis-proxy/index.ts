// 한국투자증권 Open API 프록시 (Supabase Edge Function)
//
// 역할:
//  1. appkey/appsecret을 서버에 안전하게 보관
//  2. OAuth2 access token 발급 + 메모리 캐싱 (401 시 1회 재발급)
//  3. action 기반으로 허용된 API만 중계
//
// 배포: supabase functions deploy kis-proxy
// 시크릿:
//   supabase secrets set KIS_APPKEY=... KIS_APPSECRET=...
//   supabase secrets set KIS_ACCOUNT_NO=... KIS_ACCOUNT_PRODUCT_CODE=01
//   supabase secrets set KIS_MODE=paper  (paper: 모의투자 / real: 실전)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 모의투자 / 실전 도메인
const DOMAINS = {
  real: 'https://openapi.koreainvestment.com:9443',
  paper: 'https://openapivts.koreainvestment.com:29443',
} as const

type KisMode = keyof typeof DOMAINS

function getMode(): KisMode {
  const m = Deno.env.get('KIS_MODE') ?? 'paper'
  return m === 'real' ? 'real' : 'paper'
}

function getBase(): string {
  return DOMAINS[getMode()]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ---- Supabase 클라이언트 (service_role로 토큰 캐시 DB 접근) ----
function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return createClient(url, key)
}

// ---- 토큰 캐시 (메모리 + DB 2단 캐시) ----
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function loadTokenFromDb(): Promise<boolean> {
  try {
    const sb = getSupabase()
    const { data } = await sb
      .from('kis_token_cache')
      .select('access_token, expires_at, mode')
      .eq('id', 'default')
      .maybeSingle()
    if (data && data.mode === getMode() && new Date(data.expires_at).getTime() > Date.now()) {
      cachedToken = data.access_token
      tokenExpiresAt = new Date(data.expires_at).getTime()
      return true
    }
  } catch (_) { /* DB 없으면 무시 */ }
  return false
}

async function saveTokenToDb(token: string, expiresAt: number): Promise<void> {
  try {
    const sb = getSupabase()
    await sb.from('kis_token_cache').upsert({
      id: 'default',
      access_token: token,
      expires_at: new Date(expiresAt).toISOString(),
      mode: getMode(),
      updated_at: new Date().toISOString(),
    })
  } catch (_) { /* DB 저장 실패해도 메모리 캐시로 동작 */ }
}

async function issueToken(): Promise<string> {
  const appkey = Deno.env.get('KIS_APPKEY')
  const appsecret = Deno.env.get('KIS_APPSECRET')
  if (!appkey || !appsecret) {
    throw new Error('KIS_APPKEY / KIS_APPSECRET 시크릿이 설정되지 않았습니다.')
  }

  const res = await fetch(`${getBase()}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey,
      appsecret,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error_description) {
    throw new Error(
      `토큰 발급 실패 (${res.status}): ${data.error_description ?? data.msg1 ?? '알 수 없는 오류'}`
    )
  }

  cachedToken = data.access_token
  if (data.access_token_token_expired) {
    tokenExpiresAt = new Date(data.access_token_token_expired).getTime() - 60_000
  } else {
    tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000
  }

  await saveTokenToDb(cachedToken!, tokenExpiresAt)
  return cachedToken!
}

async function getToken(forceRefresh = false): Promise<string> {
  // 1. 메모리 캐시 확인
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }
  // 2. DB 캐시 확인 (콜드스타트 대비)
  if (!forceRefresh && await loadTokenFromDb()) {
    return cachedToken!
  }
  // 3. 신규 발급
  return await issueToken()
}

// ── 실전 도메인 전용 토큰 (ranking 등 모의투자 미지원 API용) ──
// KIS_REAL_APPKEY / KIS_REAL_APPSECRET이 설정되어 있으면 실전 키 사용, 없으면 기본 키로 시도
let realToken: string | null = null
let realTokenExpiresAt = 0

function getRealKeys() {
  const appkey = Deno.env.get('KIS_REAL_APPKEY') || Deno.env.get('KIS_APPKEY') || ''
  const appsecret = Deno.env.get('KIS_REAL_APPSECRET') || Deno.env.get('KIS_APPSECRET') || ''
  return { appkey, appsecret }
}

async function getRealToken(): Promise<string> {
  if (getMode() === 'real') return await getToken()
  if (realToken && Date.now() < realTokenExpiresAt) return realToken

  const { appkey, appsecret } = getRealKeys()
  if (!appkey || !appsecret) throw new Error('KIS_REAL_APPKEY / KIS_REAL_APPSECRET (또는 KIS_APPKEY) 시크릿이 설정되지 않았습니다.')

  const res = await fetch(`${DOMAINS.real}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey, appsecret }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error_description) {
    throw new Error(`실전 토큰 발급 실패: ${data.error_description ?? data.msg1 ?? '실전 앱키(KIS_REAL_APPKEY)를 등록해주세요.'}`)
  }

  realToken = data.access_token
  if (data.access_token_token_expired) {
    realTokenExpiresAt = new Date(data.access_token_token_expired).getTime() - 60_000
  } else {
    realTokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000
  }
  return realToken!
}


function getKeys() {
  const appkey = Deno.env.get('KIS_APPKEY') ?? ''
  const appsecret = Deno.env.get('KIS_APPSECRET') ?? ''
  return { appkey, appsecret }
}

function getAccount() {
  const acctNo = Deno.env.get('KIS_ACCOUNT_NO') ?? ''
  const prodCode = Deno.env.get('KIS_ACCOUNT_PRODUCT_CODE') ?? '01'
  // 계좌번호 앞 8자리와 뒤 2자리 분리
  const cano = acctNo.replace(/-/g, '').substring(0, 8)
  const acntPrdtCd = acctNo.replace(/-/g, '').substring(8, 10) || prodCode
  return { cano, acntPrdtCd }
}

// ---- KIS API 호출 헬퍼 ----
interface KisCallOptions {
  method?: 'GET' | 'POST'
  path: string
  trId: string
  query?: Record<string, string>
  body?: Record<string, string>
  token: string
  baseUrl?: string
  keys?: { appkey: string; appsecret: string }
}

async function callKis(opts: KisCallOptions): Promise<Response> {
  const { appkey, appsecret } = opts.keys ?? getKeys()
  const url = new URL((opts.baseUrl ?? getBase()) + opts.path)

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, v)
    }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    authorization: `Bearer ${opts.token}`,
    appkey,
    appsecret,
    tr_id: opts.trId,
    custtype: 'P',
  }

  const fetchOpts: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
  }
  if (opts.method === 'POST' && opts.body) {
    fetchOpts.body = JSON.stringify(opts.body)
  }

  return await fetch(url.toString(), fetchOpts)
}

// ---- 액션 핸들러 ----
type ActionHandler = (params: Record<string, string>, token: string) => Promise<unknown>

const actions: Record<string, ActionHandler> = {
  // 연결 상태
  async status(_params, token) {
    return {
      connected: !!token,
      expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
      mode: getMode(),
    }
  },

  // 주식 현재가
  async price(params, token) {
    const symbol = params.symbol
    if (!symbol) throw new Error('symbol이 필요합니다.')

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/quotations/inquire-price',
      trId: 'FHKST01010100',
      query: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
      },
      token,
    })
    const data = await res.json()
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return data.output
  },

  // 일별 시세
  async 'daily-prices'(params, _token) {
    const symbol = params.symbol
    if (!symbol) throw new Error('symbol이 필요합니다.')
    const rToken = await getRealToken()

    const now = new Date()
    const d120 = new Date(now)
    d120.setDate(d120.getDate() - 120)
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
      trId: 'FHKST03010100',
      query: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
        FID_INPUT_DATE_1: fmt(d120),
        FID_INPUT_DATE_2: fmt(now),
        FID_PERIOD_DIV_CODE: 'D',
        FID_ORG_ADJ_PRC: '0',
      },
      token: rToken,
      baseUrl: DOMAINS.real,
      keys: getRealKeys(),
    })
    const data = await res.json()
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    const arr = data.output2 ?? data.output ?? []
    return Array.isArray(arr) ? arr : []
  },

  // 잔고 조회
  async balance(_params, token) {
    const { cano, acntPrdtCd } = getAccount()
    const mode = getMode()
    const trId = mode === 'real' ? 'TTTC8434R' : 'VTTC8434R'

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/trading/inquire-balance',
      trId,
      query: {
        CANO: cano,
        ACNT_PRDT_CD: acntPrdtCd,
        AFHR_FLPR_YN: 'N',
        OFL_YN: '',
        INQR_DVSN: '02',
        UNPR_DVSN: '01',
        FUND_STTL_ICLD_YN: 'N',
        FNCG_AMT_AUTO_RDPT_YN: 'N',
        PRCS_DVSN: '01',
        CTX_AREA_FK100: '',
        CTX_AREA_NK100: '',
      },
      token,
    })
    const data = await res.json()
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return {
      holdings: data.output1 ?? [],
      summary: data.output2?.[0] ?? {},
    }
  },

  // 매수 주문
  async 'order-buy'(params, token) {
    const { cano, acntPrdtCd } = getAccount()
    const mode = getMode()
    const trId = mode === 'real' ? 'TTTC0802U' : 'VTTC0802U'

    const ordDvsn = params.orderType === 'market' ? '01' : '00'

    const res = await callKis({
      method: 'POST',
      path: '/uapi/domestic-stock/v1/trading/order-cash',
      trId,
      body: {
        CANO: cano,
        ACNT_PRDT_CD: acntPrdtCd,
        PDNO: params.symbol,
        ORD_DVSN: ordDvsn,
        ORD_QTY: String(params.qty ?? '0'),
        ORD_UNPR: ordDvsn === '01' ? '0' : String(params.price ?? '0'),
      },
      token,
    })
    const data = await res.json()
    return data
  },

  // 매도 주문
  async 'order-sell'(params, token) {
    const { cano, acntPrdtCd } = getAccount()
    const mode = getMode()
    const trId = mode === 'real' ? 'TTTC0801U' : 'VTTC0801U'

    const ordDvsn = params.orderType === 'market' ? '01' : '00'

    const res = await callKis({
      method: 'POST',
      path: '/uapi/domestic-stock/v1/trading/order-cash',
      trId,
      body: {
        CANO: cano,
        ACNT_PRDT_CD: acntPrdtCd,
        PDNO: params.symbol,
        ORD_DVSN: ordDvsn,
        ORD_QTY: String(params.qty ?? '0'),
        ORD_UNPR: ordDvsn === '01' ? '0' : String(params.price ?? '0'),
      },
      token,
    })
    const data = await res.json()
    return data
  },

  // 재무비율
  async 'financial-ratio'(params, _token) {
    const symbol = params.symbol
    if (!symbol) throw new Error('symbol이 필요합니다.')
    const rToken = await getRealToken()

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/finance/financial-ratio',
      trId: 'FHKST66430300',
      query: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
        FID_DIV_CLS_CODE: '0',
      },
      token: rToken,
      baseUrl: DOMAINS.real,
      keys: getRealKeys(),
    })
    const data = await res.json()
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return data.output
  },

  // 투자자별 매매동향
  async 'investor-trend'(params, _token) {
    const symbol = params.symbol
    if (!symbol) throw new Error('symbol이 필요합니다.')
    const rToken = await getRealToken()

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/quotations/inquire-investor',
      trId: 'FHKST01010900',
      query: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
      },
      token: rToken,
      baseUrl: DOMAINS.real,
      keys: getRealKeys(),
    })
    const data = await res.json()
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return data.output
  },

  // 거래량 순위 (커스텀 스크리너) — 실전 도메인에서만 지원
  async 'volume-rank'(params, _token) {
    const rToken = await getRealToken()
    const market = params.market || 'J'
    const res = await callKis({
      path: '/uapi/domestic-stock/v1/quotations/volume-rank',
      trId: 'FHPST01710000',
      baseUrl: DOMAINS.real,
      keys: getRealKeys(),
      query: {
        FID_COND_MRKT_DIV_CODE: market,
        FID_COND_SCR_DIV_CODE: '20171',
        FID_INPUT_ISCD: '0002',
        FID_DIV_CLS_CODE: '0',
        FID_BLNG_CLS_CODE: '0',
        FID_TRGT_CLS_CODE: '111111111',
        FID_TRGT_EXLS_CLS_CODE: '000000',
        FID_INPUT_PRICE_1: params.price_min || '',
        FID_INPUT_PRICE_2: params.price_max || '',
        FID_VOL_CNT: params.vol_min || '',
        FID_INPUT_DATE_1: '',
      },
      token: rToken,
    })
    const text = await res.text()
    if (!text) throw new Error('KIS API 빈 응답 — 현재 앱키가 실전 도메인을 지원하지 않을 수 있습니다.')
    const data = JSON.parse(text)
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return data.output
  },

  // 등락률 순위 — 실전 도메인에서만 지원
  async 'fluctuation-rank'(params, _token) {
    const rToken = await getRealToken()
    const market = params.market || 'J'
    const res = await callKis({
      path: '/uapi/domestic-stock/v1/quotations/fluctuation-rank',
      trId: 'FHPST01700000',
      baseUrl: DOMAINS.real,
      keys: getRealKeys(),
      query: {
        FID_COND_MRKT_DIV_CODE: market,
        FID_COND_SCR_DIV_CODE: '20170',
        FID_INPUT_ISCD: '0002',
        FID_RANK_SORT_CLS_CODE: params.sort_dir || '0',
        FID_INPUT_CNT_1: '0',
        FID_PRC_CLS_CODE: '0',
        FID_INPUT_PRICE_1: params.price_min || '',
        FID_INPUT_PRICE_2: params.price_max || '',
        FID_VOL_CNT: params.vol_min || '',
        FID_TRGT_CLS_CODE: '111111111',
        FID_TRGT_EXLS_CLS_CODE: '000000',
        FID_INPUT_DATE_1: '',
      },
      token: rToken,
    })
    const text = await res.text()
    if (!text) throw new Error('KIS API 빈 응답 — 현재 앱키가 실전 도메인을 지원하지 않을 수 있습니다.')
    const data = JSON.parse(text)
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return data.output
  },
}

// ---- 진입점 ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: { message: 'POST만 허용됩니다.' } }, 405)
  }

  let payload: { action?: string; params?: Record<string, string> }
  try {
    payload = await req.json()
  } catch (_) {
    return json({ error: { message: '잘못된 요청 본문입니다.' } }, 400)
  }

  const action = payload.action
  if (!action || !actions[action]) {
    return json({ error: { message: `허용되지 않은 액션입니다: ${action}` } }, 400)
  }

  try {
    let token = await getToken()
    try {
      const result = await actions[action](payload.params ?? {}, token)
      return json({ result })
    } catch (e) {
      // 토큰 만료 시 1회 재발급 후 재시도
      if ((e as Error).message?.includes('만료') || (e as Error).message?.includes('token')) {
        token = await getToken(true)
        const result = await actions[action](payload.params ?? {}, token)
        return json({ result })
      }
      throw e
    }
  } catch (e) {
    return json({ error: { message: (e as Error).message } }, 502)
  }
})
