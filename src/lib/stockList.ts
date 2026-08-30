export interface StockItem {
  code: string
  name: string
  market: 'KOSPI' | 'KOSDAQ'
}

export const STOCK_LIST: StockItem[] = [
  // KOSPI 주요 종목
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  { code: '005380', name: '현대자동차', market: 'KOSPI' },
  { code: '000270', name: '기아', market: 'KOSPI' },
  { code: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
  { code: '035720', name: '카카오', market: 'KOSPI' },
  { code: '051910', name: 'LG화학', market: 'KOSPI' },
  { code: '006400', name: '삼성SDI', market: 'KOSPI' },
  { code: '003670', name: '포스코퓨처엠', market: 'KOSPI' },
  { code: '105560', name: 'KB금융', market: 'KOSPI' },
  { code: '055550', name: '신한지주', market: 'KOSPI' },
  { code: '086790', name: '하나금융지주', market: 'KOSPI' },
  { code: '316140', name: '우리금융지주', market: 'KOSPI' },
  { code: '066570', name: 'LG전자', market: 'KOSPI' },
  { code: '003550', name: 'LG', market: 'KOSPI' },
  { code: '032830', name: '삼성생명', market: 'KOSPI' },
  { code: '034730', name: 'SK', market: 'KOSPI' },
  { code: '030200', name: 'KT', market: 'KOSPI' },
  { code: '017670', name: 'SK텔레콤', market: 'KOSPI' },
  { code: '012330', name: '현대모비스', market: 'KOSPI' },
  { code: '096770', name: 'SK이노베이션', market: 'KOSPI' },
  { code: '028260', name: '삼성물산', market: 'KOSPI' },
  { code: '010130', name: '고려아연', market: 'KOSPI' },
  { code: '034020', name: '두산에너빌리티', market: 'KOSPI' },
  { code: '009150', name: '삼성전기', market: 'KOSPI' },
  { code: '000810', name: '삼성화재', market: 'KOSPI' },
  { code: '033780', name: 'KT&G', market: 'KOSPI' },
  { code: '010950', name: 'S-Oil', market: 'KOSPI' },
  { code: '018260', name: '삼성에스디에스', market: 'KOSPI' },
  { code: '011200', name: 'HMM', market: 'KOSPI' },
  { code: '003490', name: '대한항공', market: 'KOSPI' },
  { code: '009540', name: '한국조선해양', market: 'KOSPI' },
  { code: '329180', name: 'HD현대중공업', market: 'KOSPI' },
  { code: '042700', name: '한미반도체', market: 'KOSPI' },
  { code: '036570', name: '엔씨소프트', market: 'KOSPI' },
  { code: '251270', name: '넷마블', market: 'KOSPI' },
  { code: '263750', name: '펄어비스', market: 'KOSPI' },
  { code: '352820', name: '하이브', market: 'KOSPI' },
  { code: '011170', name: '롯데케미칼', market: 'KOSPI' },
  { code: '004020', name: '현대제철', market: 'KOSPI' },
  { code: '010140', name: '삼성중공업', market: 'KOSPI' },
  { code: '267250', name: 'HD현대', market: 'KOSPI' },
  { code: '138040', name: '메리츠금융지주', market: 'KOSPI' },
  { code: '000100', name: '유한양행', market: 'KOSPI' },
  { code: '068270', name: '셀트리온', market: 'KOSPI' },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { code: '326030', name: 'SK바이오팜', market: 'KOSPI' },
  { code: '090430', name: '아모레퍼시픽', market: 'KOSPI' },
  { code: '051900', name: 'LG생활건강', market: 'KOSPI' },
  { code: '021240', name: '코웨이', market: 'KOSPI' },
  { code: '015760', name: '한국전력', market: 'KOSPI' },
  { code: '047050', name: '포스코인터내셔널', market: 'KOSPI' },
  { code: '004170', name: '신세계', market: 'KOSPI' },
  { code: '139480', name: '이마트', market: 'KOSPI' },
  { code: '161390', name: '한국타이어앤테크놀로지', market: 'KOSPI' },
  { code: '004990', name: '롯데지주', market: 'KOSPI' },
  { code: '003410', name: '쌍용C&E', market: 'KOSPI' },
  { code: '078930', name: 'GS', market: 'KOSPI' },
  { code: '036460', name: '한국가스공사', market: 'KOSPI' },
  { code: '002790', name: '아모레G', market: 'KOSPI' },
  { code: '009830', name: '한화솔루션', market: 'KOSPI' },
  { code: '012450', name: '한화에어로스페이스', market: 'KOSPI' },
  { code: '042660', name: '한화오션', market: 'KOSPI' },
  { code: '272210', name: '한화시스템', market: 'KOSPI' },

  // KOSDAQ 주요 종목
  { code: '247540', name: '에코프로비엠', market: 'KOSDAQ' },
  { code: '086520', name: '에코프로', market: 'KOSDAQ' },
  { code: '403870', name: 'HPSP', market: 'KOSDAQ' },
  { code: '196170', name: '알테오젠', market: 'KOSDAQ' },
  { code: '257720', name: '실리콘투', market: 'KOSDAQ' },
  { code: '293490', name: '카카오게임즈', market: 'KOSDAQ' },
  { code: '035900', name: 'JYP Ent.', market: 'KOSDAQ' },
  { code: '041510', name: 'SM', market: 'KOSDAQ' },
  { code: '112040', name: '위메이드', market: 'KOSDAQ' },
  { code: '039030', name: '이오테크닉스', market: 'KOSDAQ' },
  { code: '357780', name: '솔브레인', market: 'KOSDAQ' },
  { code: '005290', name: '동진쎄미켐', market: 'KOSDAQ' },
  { code: '095340', name: 'ISC', market: 'KOSDAQ' },
  { code: '141080', name: '레인보우로보틱스', market: 'KOSDAQ' },
  { code: '067310', name: '하나마이크론', market: 'KOSDAQ' },
  { code: '058470', name: '리노공업', market: 'KOSDAQ' },
  { code: '090460', name: '비에이치', market: 'KOSDAQ' },
  { code: '028300', name: 'HLB', market: 'KOSDAQ' },
  { code: '145020', name: '휴젤', market: 'KOSDAQ' },
  { code: '060310', name: '3S', market: 'KOSDAQ' },
  { code: '389030', name: '지누스', market: 'KOSDAQ' },
  { code: '323410', name: '카카오뱅크', market: 'KOSPI' },
  { code: '377300', name: '카카오페이', market: 'KOSPI' },
  { code: '259960', name: '크래프톤', market: 'KOSPI' },
  { code: '180640', name: '한진칼', market: 'KOSPI' },
  { code: '006800', name: '미래에셋증권', market: 'KOSPI' },
  { code: '016360', name: '삼성증권', market: 'KOSPI' },
  { code: '003530', name: '한화투자증권', market: 'KOSPI' },
  { code: '071050', name: '한국금융지주', market: 'KOSPI' },
  { code: '302440', name: 'SK바이오사이언스', market: 'KOSPI' },
]

export function searchStocks(query: string, limit = 10): StockItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  // 종목코드 완전 일치
  const exactCode = STOCK_LIST.find(s => s.code === q)
  if (exactCode) return [exactCode]

  // 종목명 또는 코드에 포함
  const results = STOCK_LIST.filter(s =>
    s.name.toLowerCase().includes(q) || s.code.includes(q)
  )

  // 이름이 query로 시작하는 것을 우선
  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
    return aStarts - bStarts
  })

  return results.slice(0, limit)
}
