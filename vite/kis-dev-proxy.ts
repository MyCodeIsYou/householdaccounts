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
  const realAppkey = env.KIS_REAL_APPKEY || appkey
  const realAppsecret = env.KIS_REAL_APPSECRET || appsecret
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

  // 실전 도메인 전용 토큰 (ranking 등 모의투자 미지원 API)
  let realCachedToken: string | null = null
  let realTokenExpiresAt = 0

  async function getRealToken(): Promise<string> {
    if (kisMode === 'real') return await getToken()
    if (realCachedToken && Date.now() < realTokenExpiresAt) return realCachedToken

    const res = await fetch(`${DOMAINS.real}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: realAppkey, appsecret: realAppsecret }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok || data.error_description) {
      throw new Error(`실전 토큰 발급 실패: ${data.error_description ?? data.msg1 ?? '실전 앱키(KIS_REAL_APPKEY)를 확인해주세요.'}`)
    }
    realCachedToken = data.access_token as string
    if (data.access_token_token_expired) {
      realTokenExpiresAt = new Date(data.access_token_token_expired as string).getTime() - 60_000
    } else {
      realTokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000
    }
    return realCachedToken!
  }

  interface CallOpts {
    method?: 'GET' | 'POST'
    path: string
    trId: string
    query?: Record<string, string>
    body?: Record<string, string>
    token: string
    extraHeaders?: Record<string, string>
    useRealDomain?: boolean
    useRealKeys?: boolean
  }

  async function callKis(opts: CallOpts): Promise<Response> {
    const domain = opts.useRealDomain ? DOMAINS.real : base
    const url = new URL(domain + opts.path)
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, v)
      }
    }
    const ak = opts.useRealKeys ? realAppkey : appkey
    const as_ = opts.useRealKeys ? realAppsecret : appsecret
    const headers: Record<string, string> = {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${opts.token}`,
      appkey: ak,
      appsecret: as_,
      tr_id: opts.trId,
      custtype: 'P',
      ...opts.extraHeaders,
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

    async 'daily-prices'(params, _token) {
      const rToken = await getRealToken()
      const now = new Date()
      const d120 = new Date(now)
      d120.setDate(d120.getDate() - 120)
      const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

      const doCall = async () => {
        const res = await callKis({
          path: '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
          trId: 'FHKST03010100',
          query: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: params.symbol,
            FID_INPUT_DATE_1: fmt(d120),
            FID_INPUT_DATE_2: fmt(now),
            FID_PERIOD_DIV_CODE: 'D',
            FID_ORG_ADJ_PRC: '0',
          },
          token: rToken,
          useRealDomain: true,
          useRealKeys: true,
        })
        const data = await res.json() as KisResp
        console.log(`[KIS daily-prices] symbol=${params.symbol} rt_cd=${data.rt_cd} msg=${data.msg1} output=${Array.isArray(data.output) ? data.output.length : typeof data.output} output2=${Array.isArray(data.output2) ? data.output2.length : typeof data.output2}`)
        if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
        const arr = data.output2 ?? data.output ?? []
        return Array.isArray(arr) ? arr : []
      }

      try {
        return await doCall()
      } catch (_) {
        await new Promise(r => setTimeout(r, 1000))
        return await doCall()
      }
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

    async 'financial-ratio'(params, _token) {
      const rToken = await getRealToken()
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/finance/financial-ratio',
        trId: 'FHKST66430300',
        query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: params.symbol, FID_DIV_CLS_CODE: '0' },
        token: rToken,
        useRealDomain: true,
        useRealKeys: true,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output
    },

    async 'condition-search-list'(_p, token) {
      const allResults: KisResp[] = []

      for (let page = 0; page < 10; page++) {
        const headers: Record<string, string> = page > 0 ? { tr_cont: 'N' } : {}
        const res = await callKis({
          path: '/uapi/domestic-stock/v1/quotations/psearch-title',
          trId: 'HHKST03900300',
          query: { user_id: env.KIS_HTS_ID ?? '' },
          token,
          extraHeaders: headers,
          useRealDomain: true,
        })
        const data = await res.json() as KisResp
        const htsId = env.KIS_HTS_ID ?? ''
        console.log(`[KIS condition-list] page=${page} hts_id=${htsId ? htsId.slice(0,2) + '***' : '(empty)'} domain=${DOMAINS.real} rt_cd=${data.rt_cd} msg1=${data.msg1} keys=${Object.keys(data).join(',')}`)
        console.log(`[KIS condition-list] full response:`, JSON.stringify(data).slice(0, 2000))
        console.log(`[KIS condition-list] response headers:`, [...res.headers.entries()].map(([k,v]) => `${k}=${v}`).join(' | '))

        if (data.rt_cd !== '0' && !(data.output1?.length > 0) && !(data.output2?.length > 0)) {
          throw new Error(data.msg1 ?? 'API 오류')
        }

        const items = data.output2 ?? data.output1 ?? []
        allResults.push(...items)

        const trCont = res.headers.get('tr_cont') ?? ''
        if (trCont === 'M' || trCont === 'F') {
          await new Promise(r => setTimeout(r, 500))
        } else {
          break
        }
      }

      return allResults
    },

    async 'condition-search'(params, token) {
      const allResults: KisResp[] = []

      for (let page = 0; page < 10; page++) {
        const headers: Record<string, string> = page > 0 ? { tr_cont: 'N' } : {}
        const res = await callKis({
          path: '/uapi/domestic-stock/v1/quotations/psearch-result',
          trId: 'HHKST03900400',
          query: { user_id: env.KIS_HTS_ID ?? '', seq: params.seq },
          token,
          extraHeaders: headers,
          useRealDomain: true,
        })
        const data = await res.json() as KisResp
        console.log(`[KIS condition-search] page=${page} rt_cd=${data.rt_cd} msg1=${data.msg1} output2=${(data.output2 ?? []).length}items tr_cont=${res.headers.get('tr_cont')}`)

        if (data.rt_cd !== '0' && !(data.output2?.length > 0)) {
          throw new Error(data.msg1 ?? 'API 오류')
        }

        const items = data.output2 ?? []
        allResults.push(...items)

        const trCont = res.headers.get('tr_cont') ?? ''
        if (trCont === 'M' || trCont === 'F') {
          await new Promise(r => setTimeout(r, 500))
        } else {
          break
        }
      }

      return allResults
    },

    async 'investor-trend'(params, _token) {
      const rToken = await getRealToken()
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/inquire-investor',
        trId: 'FHKST01010900',
        query: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: params.symbol },
        token: rToken,
        useRealDomain: true,
        useRealKeys: true,
      })
      const data = await res.json() as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      return data.output
    },

    async 'volume-rank'(params, _token) {
      const rToken = await getRealToken()
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/volume-rank',
        trId: 'FHPST01710000',
        useRealDomain: true,
        useRealKeys: true,
        query: {
          FID_COND_MRKT_DIV_CODE: params.market || 'J',
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
      if (!text) throw new Error('KIS API 빈 응답')
      const data = JSON.parse(text) as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      console.log(`[KIS volume-rank] market=${params.market} price=${params.price_min||'*'}~${params.price_max||'*'} items=${(data.output??[]).length}`)
      return data.output ?? []
    },

    async 'fluctuation-rank'(params, _token) {
      const rToken = await getRealToken()
      const res = await callKis({
        path: '/uapi/domestic-stock/v1/quotations/fluctuation-rank',
        trId: 'FHPST01700000',
        useRealDomain: true,
        useRealKeys: true,
        query: {
          FID_COND_MRKT_DIV_CODE: params.market || 'J',
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
      if (!text) throw new Error('KIS API 빈 응답')
      const data = JSON.parse(text) as KisResp
      if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'API 오류')
      console.log(`[KIS fluctuation-rank] market=${params.market} price=${params.price_min||'*'}~${params.price_max||'*'} items=${(data.output??[]).length}`)
      return data.output ?? []
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
