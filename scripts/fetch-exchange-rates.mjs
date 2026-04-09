// 한국은행 ECOS API에서 환율 데이터 수집 → Supabase 저장
// GitHub Actions에서 매일 실행

const ECOS_KEY = process.env.ECOS_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!ECOS_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('환경변수 누락: ECOS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

// 통화 정의
const CURRENCIES = [
  { code: 'USD', name: '미국 달러', itemCode: '0000001' },
  { code: 'JPY', name: '일본 엔(100엔)', itemCode: '0000002' },
  { code: 'EUR', name: '유로', itemCode: '0000003' },
]

// YYYYMMDD 형식
function fmtDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

// YYYY-MM-DD 형식 (Supabase용)
function fmtDateIso(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

async function fetchEcosData(itemCode, startDate, endDate) {
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_KEY}/json/kr/1/100/731Y001/D/${startDate}/${endDate}/${itemCode}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ECOS API ${res.status}`)
  const data = await res.json()
  if (data.RESULT) {
    throw new Error(`ECOS error: ${data.RESULT.MESSAGE}`)
  }
  return data.StatisticSearch?.row || []
}

async function upsertRates(rows) {
  // on_conflict 쿼리 파라미터로 충돌 타깃 명시 →
  // PostgREST가 INSERT ... ON CONFLICT (currency_code, rate_date) DO UPDATE 로 변환
  const url = `${SUPABASE_URL}/rest/v1/exchange_rates?on_conflict=currency_code,rate_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase upsert failed: ${res.status} ${text}`)
  }
}

async function main() {
  // 최근 7일 데이터 가져오기 (휴장일 대비, 누락 보강)
  const today = new Date()
  const past = new Date(today)
  past.setDate(today.getDate() - 7)
  const start = fmtDate(past)
  const end = fmtDate(today)

  console.log(`📅 환율 수집 기간: ${start} ~ ${end}`)

  const allRows = []

  for (const currency of CURRENCIES) {
    console.log(`📊 ${currency.code} (${currency.name}) 조회 중...`)
    try {
      const rows = await fetchEcosData(currency.itemCode, start, end)
      console.log(`  → ${rows.length}건 수신`)

      for (const row of rows) {
        if (!row.DATA_VALUE || row.DATA_VALUE === '0') continue
        allRows.push({
          currency_code: currency.code,
          currency_name: currency.name,
          rate: parseFloat(row.DATA_VALUE),
          rate_date: fmtDateIso(row.TIME),
        })
      }
    } catch (err) {
      console.error(`  ❌ ${currency.code} 실패:`, err.message)
    }
  }

  if (allRows.length === 0) {
    console.error('❌ 수집된 데이터가 없습니다')
    process.exit(1)
  }

  console.log(`💾 Supabase에 ${allRows.length}건 저장 중...`)
  await upsertRates(allRows)
  console.log('✅ 완료')
}

main().catch(err => {
  console.error('❌ 에러:', err)
  process.exit(1)
})
