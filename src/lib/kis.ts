// 한국투자증권 Open API 클라이언트 (Edge Function `kis-proxy` 경유)
//
// 모든 호출은 Supabase Edge Function을 통해 이뤄진다. appkey/appsecret은 서버에만 존재하며
// 브라우저에는 노출되지 않는다.

import { supabase } from '@/lib/supabase'

export interface KisError {
  rt_cd: string
  msg_cd: string
  msg1: string
}

// ---- 응답 타입 ----

export interface KisTokenInfo {
  connected: boolean
  expiresAt: string | null
  mode: 'real' | 'paper'
}

export interface KisPrice {
  stck_prpr: string      // 현재가
  prdy_vrss: string      // 전일 대비
  prdy_vrss_sign: string // 부호 (1:상한,2:상승,3:보합,4:하한,5:하락)
  prdy_ctrt: string      // 전일 대비율
  acml_vol: string       // 누적 거래량
  acml_tr_pbmn: string   // 누적 거래대금
  stck_oprc: string      // 시가
  stck_hgpr: string      // 고가
  stck_lwpr: string      // 저가
  stck_mxpr: string      // 상한가
  stck_llam: string      // 하한가
  hts_kor_isnm: string   // 종목명
}

export interface KisDailyPrice {
  stck_bsop_date: string // 영업일자
  stck_oprc: string
  stck_hgpr: string
  stck_lwpr: string
  stck_clpr: string      // 종가
  acml_vol: string
  prdy_vrss: string
  prdy_vrss_sign: string
}

export interface KisBalance {
  pdno: string            // 종목번호
  prdt_name: string       // 종목명
  hldg_qty: string        // 보유수량
  pchs_avg_pric: string   // 매입평균가
  prpr: string            // 현재가
  evlu_amt: string        // 평가금액
  evlu_pfls_amt: string   // 평가손익금액
  evlu_pfls_rt: string    // 평가손익률
}

export interface KisBalanceSummary {
  dnca_tot_amt: string        // 예수금총액
  tot_evlu_amt: string        // 총평가금액
  scts_evlu_amt: string       // 유가평가금액
  pchs_amt_smtl_amt: string   // 매입금액합계
  evlu_pfls_smtl_amt: string  // 평가손익합계
}

export interface KisOrderResult {
  rt_cd: string
  msg_cd: string
  msg1: string
  ord_no?: string     // 주문번호
  odno?: string       // 주문번호(다른 필드명)
}

export interface KisFinancialRatio {
  stac_yymm: string        // 결산년월
  grs: string              // 매출액증가율
  bsop_prfi_inrt: string   // 영업이익증가율
  ntin_inrt: string        // 순이익증가율
  roe_val: string          // ROE
  eps: string              // EPS
  sps: string              // SPS (주당매출)
  bps: string              // BPS
  rsrv_rate: string        // 유보율
  lblt_rate: string        // 부채비율
}

export interface KisInvestorTrend {
  stck_bsop_date: string
  prsn_ntby_qty: string    // 개인 순매수
  frgn_ntby_qty: string    // 외국인 순매수
  orgn_ntby_qty: string    // 기관 순매수
}

export interface KisConditionItem {
  condition_seq: string    // 조건식 번호
  condition_nm: string     // 조건식 명
}

export interface KisConditionStock {
  code: string             // 종목코드
  name: string             // 종목명
  current_price: string    // 현재가
  change_rate: string      // 등락률
  volume: string           // 거래량
  market_cap: string       // 시가총액
}

// ---- 내부 호출 ----
interface ProxyArgs {
  action: string
  params?: Record<string, string | number | boolean | undefined>
}

async function call<T>(args: ProxyArgs): Promise<T> {
  const cleanParams: Record<string, string> | undefined = args.params
    ? Object.fromEntries(
        Object.entries(args.params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      )
    : undefined

  const reqBody = { action: args.action, params: cleanParams }

  if (import.meta.env.DEV) {
    const res = await fetch('/__kis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })
    const data = await res.json().catch(() => ({}))
    if (data?.error) throw new Error(data.error.message ?? '한국투자증권 API 오류')
    return data.result as T
  }

  const { data, error } = await supabase.functions.invoke('kis-proxy', {
    body: reqBody,
  })
  if (error) throw new Error(`프록시 호출 실패: ${error.message}`)
  if (data?.error) throw new Error(data.error.message ?? '한국투자증권 API 오류')
  return data.result as T
}

// ---- 공개 API ----
export const kisApi = {
  // 연결 상태 확인
  status: () =>
    call<KisTokenInfo>({ action: 'status' }),

  // 주식 현재가
  price: (symbol: string) =>
    call<KisPrice>({ action: 'price', params: { symbol } }),

  // 일별 시세 (최대 100일)
  dailyPrices: (symbol: string, period = 100) =>
    call<KisDailyPrice[]>({ action: 'daily-prices', params: { symbol, period } }),

  // 잔고 조회
  balance: () =>
    call<{ holdings: KisBalance[]; summary: KisBalanceSummary }>({ action: 'balance' }),

  // 매수 주문
  orderBuy: (symbol: string, qty: number, price: number, orderType: 'limit' | 'market' = 'limit') =>
    call<KisOrderResult>({ action: 'order-buy', params: { symbol, qty, price, orderType } }),

  // 매도 주문
  orderSell: (symbol: string, qty: number, price: number, orderType: 'limit' | 'market' = 'limit') =>
    call<KisOrderResult>({ action: 'order-sell', params: { symbol, qty, price, orderType } }),

  // 재무비율 (PER, PBR, ROE 등)
  financialRatio: (symbol: string) =>
    call<KisFinancialRatio[]>({ action: 'financial-ratio', params: { symbol } }),

  // 투자자별 매매동향
  investorTrend: (symbol: string) =>
    call<KisInvestorTrend[]>({ action: 'investor-trend', params: { symbol } }),

  // 조건검색 목록조회 (HTS에 저장된 조건식 리스트)
  conditionSearchList: () =>
    call<KisConditionItem[]>({ action: 'condition-search-list' }),

  // 조건검색 결과조회 (조건식에 해당하는 종목 리스트)
  conditionSearch: (seq: string) =>
    call<KisConditionStock[]>({ action: 'condition-search', params: { seq } }),
}
