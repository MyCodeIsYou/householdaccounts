// 로컬 개발 전용 한국투자증권 Open API 프록시 (Vite dev 서버 미들웨어)
//
// 브라우저에서 KIS API를 직접 부르면 CORS로 막히므로, Vite dev 서버(Node)가 중계한다.
// - .env.local에 KIS_APPKEY, KIS_APPSECRET, KIS_ACCOUNT_NO 설정 필요
// - KIS_MODE=paper (모의투자, 기본) 또는 real (실전)
// - 프로덕션 빌드에는 적용되지 않음 (apply: 'serve')
//
// 엔드포인트: POST /__kis  body: { action, params? }

import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

const DOMAINS = {
  real: 'https://openapi.koreainvestment.com:9443',
  paper: 'https://openapivts.koreainvestment.com:29443',
} as const

type KisMode = keyof typeof DOMAINS

export function kisDevProxy(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '')
  const appkey = env.KIS_APPKEY ?? ''
  const appsecret = env.KIS_APPSECRET ?? ''
  const accountNo = (env.KIS_ACCOUNT_NO ?? '').replace(/-/g, '')
  const kisMode: KisMode = env.KIS_MODE === 'real' ? 'real' : 'paper'
  const base = DOMAINS[kisMode]

  const cano = accountNo.substring(0, 8)
  const acntPrdtCd = accountNo.substring(8, 10) || '01'

  let cachedToken: string | null = null
  let tokenExpiresAt = 0

  async function issueToken(): Promise<string> {
    if (!appkey || !appsecret) {
      throw new Error('.env.local에 KIS_APPKEY / KIS_APPSECRET이 설정되지 않았습니다.')
    }
    const res = await fetch(`${base}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey,
        appsecret,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok || data.error_description) {
      throw new Error(
        `토큰 발급 실패 (${res.status}): ${data.error_description ?? data.msg1 ?? '알 수 없는 오류'}`
      )
    }
    cachedToken = data.access_token as string
    if (data.access_token_token_expired) {
      tokenExpiresAt = new Date(data.access_token_token_expired as string).getTime() - 60_000
    } else {
      tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000
    }
    return cachedToken!
  }

  async function getToken(force = false): Promise<string> {
    if (!force && cachedToken && Date.now() < tokenExpiresAt) return cachedToken
    return await issueToken()
  }

  interface CallOpts {
    method?: 'GET' | 'POST'
    path: string
    trId: string
    query?: Record<string, string>
    body?: Record<string, string>
    token: string
  }

  async function callKis(opts: CallOpts): Promise<Response> {
    const url = new URL(base + opts.path)
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
    const fetchOpts: RequestInit = { method: opts.method ?? 'GET', headers }
    if (opts.method === 'POST' && opts.body) {
      fetchOpts.body = JSON.stringify(opts.body)
    }
    return await fetch(url.toString(), fetchOpts)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type KisResp = Record<string, any>

  // action 핸들러
  type Handler = (params: Record<string, string>, token: string) => Promise<unknown>

  const actions: Record<string, Handler> = {
    async status(_p, token) {
      return { connected: !!token, expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null, mode: kisMode }
    },

    async price(params, token) {
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/inquire-price',
        trId: 'FHKST01010100',
        query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: params.symbol },
        token,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output
    },

    async 'daily-prices'(params, token) {
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/inquire-daily-price',
        trId: 'FHKST01010400',
        query: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: params.symbol,
          FID_PERIOD_DIV_CODE: 'D',
          FID_ORG_ADJ_PRC: '0',
        },
        token,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output
    },

    async balance(_p, token) {
      const trId = kisMode === 'real' ? 'TTTC8434R' : 'VTTC8434R'
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/trading/inquire-balance',
        trId,
        query: {
          CANO: cano, ACNT_PRDT_CD: acntPrdtCd,
          AFHR_FLPR_YN: 'N', OFL_YN: '', INQR_DVSN: '02', UNPR_DVSN: '01',
          FUND_STTL_ICLD_YN: 'N', FNCG_AMT_AUTO_RDPT_YN: 'N', PRCS_DVSN: '00',
          CTX_AREA_FK100: '', CTX_AREA_NK100: '',
        },
        token,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return { holdings: data.output1 ?? [], summary: data.output2?.[0] ?? {} }
    },

    async 'order-buy'(params, token) {
      const trId = kisMode === 'real' ? 'TTTC0802U' : 'VTTC0802U'
      const ordDvsn = params.orderType === 'market' ? '01' : '00'
      const res = await callKis({
        method: 'POST',
        path: '/uapi/domestic-stock/v1/trading/order-cash',
        trId,
        body: {
          CANO: cano, ACNT_PRDT_CD: acntPrdtCd,
          PDNO: params.symbol, ORD_DVSN: ordDvsn,
          ORD_QTY: String(params.qty ?? '0'),
          ORD_UNPR: ordDvsn === '01' ? '0' : String(params.price ?? '0'),
        },
        token,
      })
      return await res.json() as KisResp
    },

    async 'order-sell'(params, token) {
      const trId = kisMode === 'real' ? 'TTTC0801U' : 'VTTC0801U'
      const ordDvsn = params.orderType === 'market' ? '01' : '00'
      const res = await callKis({
        method: 'POST',
        path: '/uapi/domestic-stock/v1/trading/order-cash',
        trId,
        body: {
          CANO: cano, ACNT_PRDT_CD: acntPrdtCd,
          PDNO: params.symbol, ORD_DVSN: ordDvsn,
          ORD_QTY: String(params.qty ?? '0'),
          ORD_UNPR: ordDvsn === '01' ? '0' : String(params.price ?? '0'),
        },
        token,
      })
      return await res.json() as KisResp
    },

    async 'financial-ratio'(params, token) {
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/finance/financial-ratio',
        trId: 'FHKST66430300',
        query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: params.symbol, FID_DIV_CLS_CODE: '0' },
        token,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output
    },

    async 'condition-search-list'(_p, token) {
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/psearch-title',
        trId: 'HHKST03900300',
        query: { user_id: env.KIS_HTS_ID ?? '' },
        token,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output2 ?? []
    },

    async 'condition-search'(params, token) {
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/psearch-result',
        trId: 'HHKST03900400',
        query: { user_id: env.KIS_HTS_ID ?? '', seq: params.seq },
        token,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output2 ?? []
    },

    async 'investor-trend'(params, token) {
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/inquire-investor',
        trId: 'FHKST01010900',
        query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: params.symbol },
        token,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output
    },
  }

  return {
    name: 'kis-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__kis', async (req, res) => {
        const send = (body: unknown, status = 200) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }

        if (req.method !== 'POST') return send({ error: { message: 'POST만 허용됩니다.' } }, 405)

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')

          const action: string | undefined = payload.action
          if (!action || !actions[action]) {
            return send({ error: { message: `허용되지 않은 액션입니다: ${action}` } }, 400)
          }

          let token = await getToken()
          try {
            const result = await actions[action](payload.params ?? {}, token)
            return send({ result })
          } catch (e) {
            if ((e as Error).message?.includes('만료') || (e as Error).message?.includes('token')) {
              token = await getToken(true)
              const result = await actions[action](payload.params ?? {}, token)
              return send({ result })
            }
            throw e
          }
        } catch (e) {
          return send({ error: { message: (e as Error).message } }, 502)
        }
      })
    },
  }
}
