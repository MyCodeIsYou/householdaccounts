// 로컬 개발 전용 토스증권 Open API 프록시 (Vite dev 서버 미들웨어)
//
// 브라우저에서 토스 API 를 직접 부르면 CORS 로 막히므로, Vite dev 서버(Node)가 중계한다.
// - 토스가 보는 출발 IP = 이 PC 의 집 공인 IP → 그 IP 를 토스 콘솔에 등록해야 함.
// - secret 은 .env / .env.local 에서 읽고 (VITE_ 접두사 없이) 클라이언트 번들에는 포함되지 않음.
// - 프로덕션 빌드에는 적용되지 않음 (apply: 'serve').
//
// 엔드포인트: POST /__toss  body: { path, query?, accountSeq? }

import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

const TOSS_BASE = 'https://openapi.tossinvest.com'

const ALLOWED_PATHS = [
  '/api/v1/prices',
  '/api/v1/orderbook',
  '/api/v1/trades',
  '/api/v1/price-limits',
  '/api/v1/candles',
  '/api/v1/stocks',
  '/api/v1/exchange-rate',
  '/api/v1/market-calendar',
  '/api/v1/accounts',
  '/api/v1/assets',
]

function isAllowed(path: string): boolean {
  return ALLOWED_PATHS.some(
    (p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?')
  )
}

export function tossDevProxy(mode: string): Plugin {
  // VITE_ 접두사 없는 변수까지 모두 로드 (Node 측에서만 사용)
  const env = loadEnv(mode, process.cwd(), '')
  const clientId = env.TOSS_CLIENT_ID
  const clientSecret = env.TOSS_CLIENT_SECRET

  let cachedToken: string | null = null
  let tokenExpiresAt = 0

  async function issueToken(): Promise<string> {
    if (!clientId || !clientSecret) {
      throw new Error('.env.local 에 TOSS_CLIENT_ID / TOSS_CLIENT_SECRET 가 설정되지 않았습니다.')
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
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    }
    if (!res.ok) {
      throw new Error(
        `토큰 발급 실패 (${res.status}): ${data.error ?? ''} ${data.error_description ?? ''}`.trim()
      )
    }
    cachedToken = data.access_token ?? null
    tokenExpiresAt = Date.now() + (Number(data.expires_in ?? 86400) - 60) * 1000
    return cachedToken!
  }

  async function getToken(force = false): Promise<string> {
    if (!force && cachedToken && Date.now() < tokenExpiresAt) return cachedToken
    return await issueToken()
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

  return {
    name: 'toss-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__toss', async (req, res) => {
        const send = (body: unknown, status = 200) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }

        if (req.method !== 'POST') return send({ error: { message: 'POST 만 허용됩니다.' } }, 405)

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')

          const path: string | undefined = payload.path
          if (!path || typeof path !== 'string' || !path.startsWith('/api/v1/')) {
            return send({ error: { message: 'path 가 필요합니다.' } }, 400)
          }
          if (!isAllowed(path)) {
            return send({ error: { message: `허용되지 않은 경로입니다: ${path}` } }, 403)
          }

          let token = await getToken()
          let tossRes = await callToss(path, payload.query, payload.accountSeq, token)
          if (tossRes.status === 401) {
            token = await getToken(true)
            tossRes = await callToss(path, payload.query, payload.accountSeq, token)
          }
          const body = await tossRes.json().catch(() => ({}))
          return send(body, tossRes.ok ? 200 : tossRes.status)
        } catch (e) {
          return send({ error: { message: (e as Error).message } }, 502)
        }
      })
    },
  }
}
