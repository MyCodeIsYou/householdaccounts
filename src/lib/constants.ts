import type { AccountType, PaymentMethod, PlanGroup, TransactionType } from '@/types'

export const BANK_NAMES = [
  '국민은행', '신한은행', '하나은행', '우리은행', '농협은행',
  'IBK기업은행', '케이뱅크', '카카오뱅크', '토스뱅크',
  '삼성증권', '미래에셋증권', 'NH투자증권', '키움증권', 'KB증권',
  '한국투자증권', '대신증권', '신한투자증권',
  '국민연금', '퇴직연금(IRP)', 'ISA',
  '기타',
] as const

export const ACCOUNT_TYPES: AccountType[] = [
  '입출금', '예금', '적금', '증권', '연금', 'CMA', '외화', '기타',
]

export const CARD_COMPANIES = [
  '신한', '현대', '삼성', 'KB국민', '롯데', '우리', '하나', '비씨', '농협', '기타',
] as const

export const PAYMENT_METHODS: PaymentMethod[] = [
  '현금', '카드', '계좌이체', '자동이체', '기타',
]

export const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'income', label: '수입' },
  { value: 'expense', label: '지출' },
  { value: 'transfer', label: '이체' },
]

export const PLAN_GROUPS: PlanGroup[] = [
  '근로수익', '금융수익', '고정비용', '유동비용',
]

export const MONTH_KEYS = [
  'jan','feb','mar','apr','may','jun',
  'jul','aug','sep','oct','nov','dec',
] as const

export const MONTH_LABELS = [
  '1월','2월','3월','4월','5월','6월',
  '7월','8월','9월','10월','11월','12월',
]

export const MONTH_SHORT_LABELS = [
  '1월','2월','3월','4월','5월','6월',
  '7월','8월','9월','10월','11월','12월',
]
