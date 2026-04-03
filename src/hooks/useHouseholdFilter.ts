import { useAuth } from '@/context/AuthContext'
import { useHousehold } from '@/context/HouseholdContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterableQuery = any

export function useHouseholdFilter() {
  const { user } = useAuth()
  const { queryFilter } = useHousehold()

  const scopeKey = queryFilter.householdId ?? user?.id

  function applyFilter(query: FilterableQuery): FilterableQuery {
    if (queryFilter.mode === 'household') {
      return query.eq('household_id', queryFilter.householdId!)
    }
    // 개인 모드: household_id가 NULL인 본인 데이터만 (그룹 데이터 제외)
    return query.eq('user_id', queryFilter.userId).is('household_id', null)
  }

  const insertScope = queryFilter.mode === 'household'
    ? { user_id: user?.id, household_id: queryFilter.householdId }
    : { user_id: user?.id, household_id: null }

  return {
    user,
    scopeKey,
    isHousehold: queryFilter.mode === 'household',
    applyFilter,
    insertScope,
  }
}
