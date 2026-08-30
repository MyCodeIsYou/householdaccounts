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

// ---- 토큰 캐시 ----
let cachedToken: string | null = null
let tokenExpiresAt = 0

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
  // access_token_token_expired 형식: "2024-01-01 12:00:00"
  if (data.access_token_token_expired) {
    tokenExpiresAt = new Date(data.access_token_token_expired).getTime() - 60_000
  } else {
    tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000 // 기본 23시간
  }
  return cachedToken!
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }
  return await issueToken()
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
}

async function callKis(opts: KisCallOptions): Promise<Response> {
  const { appkey, appsecret } = getKeys()
  const url = new URL(getBase() + opts.path)

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
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
  async 'daily-prices'(params, token) {
    const symbol = params.symbol
    if (!symbol) throw new Error('symbol이 필요합니다.')

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/quotations/inquire-daily-price',
      trId: 'FHKST01010400',
      query: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
        FID_PERIOD_DIV_CODE: 'D',
        FID_ORG_ADJ_PRC: '0',
      },
      token,
    })
    const data = await res.json()
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return data.output
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
  async 'financial-ratio'(params, token) {
    const symbol = params.symbol
    if (!symbol) throw new Error('symbol이 필요합니다.')

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/finance/financial-ratio',
      trId: 'FHKST66430300',
      query: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
        FID_DIV_CLS_CODE: '0',
      },
      token,
    })
    const data = await res.json()
    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
    return data.output
  },

  // 투자자별 매매동향
  async 'investor-trend'(params, token) {
    const symbol = params.symbol
    if (!symbol) throw new Error('symbol이 필요합니다.')

    const res = await callKis({
      path: '/uapi/domestic-stock/v1/quotations/inquire-investor',
      trId: 'FHKST01010900',
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
  } catch {
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
