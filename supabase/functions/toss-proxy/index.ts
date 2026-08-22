// 토스증권 Open API 프록시 (Supabase Edge Function)
//
// 역할:
//  1. client_secret 을 서버에 안전하게 보관 (프론트엔드에 절대 노출 X)
//  2. OAuth2 client_credentials 로 access token 발급 + 메모리 캐싱 (401 시 1회 재발급)
//  3. 화이트리스트에 등록된 /api/v1/* 경로만 토스 API 로 중계
//
// 배포: supabase functions deploy toss-proxy
// 시크릿: supabase secrets set TOSS_CLIENT_ID=... TOSS_CLIENT_SECRET=...
//
// 프론트엔드 호출 규약 (supabase.functions.invoke):
//   body: { path: '/api/v1/prices', query: { symbols: '005930' }, accountSeq?: string }
//   응답: 토스 API 의 JSON 본문을 그대로 반환 ({ result } 또는 { error })

const TOSS_BASE = 'https://openapi.tossinvest.com'

// 통과를 허용할 경로 (정확히 일치하는 prefix). 주문(Order) 계열은 의도적으로 제외 — 조회 전용.
const ALLOWED_PATHS = [
  '/api/v1/prices',
  '/api/v1/orderbook',
  '/api/v1/trades',
  '/api/v1/price-limits',
  '/api/v1/candles',
  '/api/v1/stocks', // /api/v1/stocks 및 /api/v1/stocks/{symbol}/warnings 포함
  '/api/v1/exchange-rate',
  '/api/v1/market-calendar',
  '/api/v1/accounts', // 내 계좌 목록 (accountSeq 획득)
  '/api/v1/assets', // 보유 자산
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ---- 토큰 캐시 (warm instance 동안 유지) ----
let cachedToken: string | null = null
let tokenExpiresAt = 0 // epoch ms

async function issueToken(): Promise<string> {
  const clientId = Deno.env.get('TOSS_CLIENT_ID')
  const clientSecret = Deno.env.get('TOSS_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('TOSS_CLIENT_ID / TOSS_CLIENT_SECRET 시크릿이 설정되지 않았습니다.')
  }

  const res = await fetch(`${TOSS_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      `토큰 발급 실패 (${res.status}): ${data.error ?? ''} ${data.error_description ?? ''}`.trim()
    )
  }

  cachedToken = data.access_token
  // expires_in(초) 보다 60초 일찍 만료 처리하여 경계에서의 401 을 줄임
  tokenExpiresAt = Date.now() + (Number(data.expires_in ?? 86400) - 60) * 1000
  return cachedToken!
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }
  return await issueToken()
}

function isAllowed(path: string): boolean {
  return ALLOWED_PATHS.some(
    (p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?')
  )
}

async function callToss(
  path: string,
  query: Record<string, string> | undefined,
  accountSeq: string | undefined,
  token: string
): Promise<Response> {
  const url = new URL(TOSS_BASE + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
  if (accountSeq) headers['X-Tossinvest-Account'] = accountSeq

  return await fetch(url.toString(), { method: 'GET', headers })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: { message: 'POST 만 허용됩니다.' } }, 405)
  }

  let payload: { path?: string; query?: Record<string, string>; accountSeq?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: { message: '잘못된 요청 본문입니다.' } }, 400)
  }

  const path = payload.path
  if (!path || typeof path !== 'string' || !path.startsWith('/api/v1/')) {
    return json({ error: { message: 'path 가 필요합니다.' } }, 400)
  }
  if (!isAllowed(path)) {
    return json({ error: { message: `허용되지 않은 경로입니다: ${path}` } }, 403)
  }

  try {
    let token = await getToken()
    let res = await callToss(path, payload.query, payload.accountSeq, token)

    // 토큰 만료/무효 → 1회 재발급 후 재시도
    if (res.status === 401) {
      token = await getToken(true)
      res = await callToss(path, payload.query, payload.accountSeq, token)
    }

    const body = await res.json().catch(() => ({}))
    // 토스 API 의 상태/본문을 그대로 전달 (프론트에서 result / error 로 분기)
    return json(body, res.ok ? 200 : res.status)
  } catch (e) {
    return json({ error: { message: (e as Error).message } }, 502)
  }
})
