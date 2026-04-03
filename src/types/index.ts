// ─── 공통 ────────────────────────────────────────────────────────────────────
export type UUID = string
export type ISODate = string         // "2024-03-15"
export type ISOTimestamp = string    // "2024-03-15T09:00:00Z"

// ─── 계좌 ────────────────────────────────────────────────────────────────────
export type AccountType =
  | '입출금' | '예금' | '적금' | '증권' | '연금' | 'CMA' | '외화' | '기타'

export interface Account {
  id: UUID
  user_id: UUID
  bank_name: string
  account_type: AccountType
  label: string | null
  balance: number
  currency: string
  is_active: boolean
  display_order: number
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export type AccountInsert = Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type AccountUpdate = Partial<AccountInsert>

// ─── 자산 스냅샷 ──────────────────────────────────────────────────────────────
export interface AssetSnapshot {
  id: UUID
  user_id: UUID
  snapshot_date: ISODate
  total_amount: number
  created_at: ISOTimestamp
}

// ─── 카테고리 ─────────────────────────────────────────────────────────────────
export type TransactionType = 'income' | 'expense' | 'transfer'
export type PlanGroup = '근로수익' | '금융수익' | '고정비용' | '유동비용'

export interface Category {
  id: UUID
  user_id: UUID | null
  parent_id: UUID | null
  name: string
  type: TransactionType
  plan_group: PlanGroup | null
  is_system: boolean
  display_order: number
}

// ─── 거래 ────────────────────────────────────────────────────────────────────
export type PaymentMethod = '현금' | '카드' | '계좌이체' | '자동이체' | '기타'

export interface Card {
  id: UUID
  user_id: UUID
  card_name: string
  card_company: string
  last4: string | null
  billing_day: number | null
  linked_account_id: UUID | null
  is_active: boolean
  created_at: ISOTimestamp
}

export interface Transaction {
  id: UUID
  user_id: UUID
  txn_date: ISODate
  type: TransactionType
  category_id: UUID | null
  subcategory_id: UUID | null
  amount: number
  memo: string | null
  payment_method: PaymentMethod | null
  account_id: UUID | null
  card_id: UUID | null
  is_allowance: boolean
  is_fixed: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
  // JOIN 결과 (선택적)
  category?: Category
  subcategory?: Category
  account?: Pick<Account, 'id' | 'bank_name' | 'label'>
  card?: Pick<Card, 'id' | 'card_name' | 'card_company'>
}

export type TransactionInsert = Omit<Transaction,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'subcategory' | 'account' | 'card'>
export type TransactionUpdate = Partial<TransactionInsert>

// ─── 연간 계획 ────────────────────────────────────────────────────────────────
export type MonthKey = 'jan'|'feb'|'mar'|'apr'|'may'|'jun'|'jul'|'aug'|'sep'|'oct'|'nov'|'dec'

export interface AnnualPlan {
  id: UUID
  user_id: UUID
  plan_year: number
  category_id: UUID
  jan: number; feb: number; mar: number; apr: number
  may: number; jun: number; jul: number; aug: number
  sep: number; oct: number; nov: number; dec: number
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export interface PlanRow {
  category: Category
  planned: Record<MonthKey, number>
  actual: Record<MonthKey, number>
  planTotal: number
  actualTotal: number
}

// ─── 고정비 ───────────────────────────────────────────────────────────────────
export interface FixedCost {
  id: UUID
  user_id: UUID
  name: string
  category_id: UUID | null
  expected_amount: number
  billing_day: number | null
  payment_method: PaymentMethod | null
  card_id: UUID | null
  is_active: boolean
  created_at: ISOTimestamp
}

export interface FixedCostRecord {
  id: UUID
  user_id: UUID
  fixed_cost_id: UUID
  record_year: number
  record_month: number
  actual_amount: number | null
  transaction_id: UUID | null
  is_paid: boolean
  paid_date: ISODate | null
}

// ─── 월별 집계 ───────────────────────────────────────────────────────────────
export interface MonthlySummary {
  year: number
  month: number
  income: number
  expense: number
  balance: number
}

// ─── 필터 파라미터 ──────────────────────────────────────────────────────────
export interface TransactionFilters {
  year?: number
  month?: number
  type?: TransactionType | 'all'
  category_id?: UUID
  card_id?: UUID
  is_allowance?: boolean
  dateFrom?: ISODate
  dateTo?: ISODate
  keyword?: string
}
