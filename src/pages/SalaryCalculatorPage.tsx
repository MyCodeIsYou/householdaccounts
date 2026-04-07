import { useState, useMemo } from 'react'

// 2025년 기준 간이세액표 근사 (월 급여 기준, 부양가족 본인 1명)
function calcIncomeTax(monthlyTaxable: number): number {
  if (monthlyTaxable <= 1060000) return 0
  if (monthlyTaxable <= 1500000) return (monthlyTaxable - 1060000) * 0.06
  if (monthlyTaxable <= 4600000) return 26400 + (monthlyTaxable - 1500000) * 0.15
  if (monthlyTaxable <= 8800000) return 491400 + (monthlyTaxable - 4600000) * 0.24
  if (monthlyTaxable <= 15000000) return 1499400 + (monthlyTaxable - 8800000) * 0.35
  return 3669400 + (monthlyTaxable - 15000000) * 0.38
}

export default function SalaryCalculatorPage() {
  const [annualSalary, setAnnualSalary] = useState('')
  const [includeBonus, setIncludeBonus] = useState(false)
  const [dependents, setDependents] = useState(1)

  const result = useMemo(() => {
    const salary = Number(annualSalary.replace(/,/g, ''))
    if (!salary || salary <= 0) return null

    const monthly = Math.round(salary / 12)

    // 4대 보험 요율 (2025 기준, 근로자 부담분)
    const nationalPension = Math.min(Math.round(monthly * 0.045), 265500)       // 국민연금 4.5%
    const healthInsurance = Math.round(monthly * 0.03545)                        // 건강보험 3.545%
    const longTermCare = Math.round(healthInsurance * 0.1295)                    // 장기요양 12.95%
    const employmentInsurance = Math.round(monthly * 0.009)                      // 고용보험 0.9%

    const totalInsurance = nationalPension + healthInsurance + longTermCare + employmentInsurance

    // 소득세 (간이세액표 근사)
    const taxableMonthly = monthly - totalInsurance
    let incomeTax = Math.round(calcIncomeTax(taxableMonthly))
    // 부양가족 공제 (근사: 가족 1명당 월 소득세 감소)
    if (dependents > 1) {
      incomeTax = Math.max(0, incomeTax - (dependents - 1) * 12500)
    }
    const localIncomeTax = Math.round(incomeTax * 0.1) // 지방소득세 10%

    const totalDeduction = totalInsurance + incomeTax + localIncomeTax
    const netMonthly = monthly - totalDeduction
    const netAnnual = netMonthly * 12

    return {
      monthly,
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      totalInsurance,
      incomeTax,
      localIncomeTax,
      totalDeduction,
      netMonthly,
      netAnnual,
    }
  }, [annualSalary, dependents])

  const formatNumber = (n: number) => n.toLocaleString('ko-KR')

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw) {
      setAnnualSalary(Number(raw).toLocaleString('ko-KR'))
    } else {
      setAnnualSalary('')
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h1 className="text-lg font-bold text-gray-900 mb-1">연봉 계산기</h1>
        <p className="text-xs text-gray-400 mb-5">2025년 기준 4대보험 + 소득세 예상 계산</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연봉 (세전)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={annualSalary}
                onChange={handleSalaryChange}
                placeholder="예: 50,000,000"
                className="w-full h-11 px-3 pr-8 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">부양가족 수 (본인 포함)</label>
            <select
              value={dependents}
              onChange={e => setDependents(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {result && (
        <>
          {/* 월급 요약 */}
          <div className="bg-white rounded-2xl card-shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">월 실수령액</h2>
              <span className="text-xl font-bold text-indigo-600">{formatNumber(result.netMonthly)}원</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">연 실수령액</span>
              <span className="text-sm font-semibold text-gray-900">{formatNumber(result.netAnnual)}원</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full gradient-primary"
                style={{ width: `${(result.netMonthly / result.monthly) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-400">실수령 {((result.netMonthly / result.monthly) * 100).toFixed(1)}%</span>
              <span className="text-[10px] text-gray-400">공제 {((result.totalDeduction / result.monthly) * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* 공제 상세 */}
          <div className="bg-white rounded-2xl card-shadow p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">월 공제 내역</h2>
            <div className="space-y-2.5">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">4대 보험</div>
              {[
                { label: '국민연금', value: result.nationalPension },
                { label: '건강보험', value: result.healthInsurance },
                { label: '장기요양보험', value: result.longTermCare },
                { label: '고용보험', value: result.employmentInsurance },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{formatNumber(item.value)}원</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-1 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">보험료 소계</span>
                <span className="text-sm font-bold text-gray-900">{formatNumber(result.totalInsurance)}원</span>
              </div>

              <div className="h-px bg-gray-100 my-1" />
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">세금</div>
              {[
                { label: '소득세', value: result.incomeTax },
                { label: '지방소득세', value: result.localIncomeTax },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{formatNumber(item.value)}원</span>
                </div>
              ))}

              <div className="h-px bg-gray-100 my-1" />
              <div className="flex justify-between items-center py-2 bg-gray-50 rounded-lg px-3 -mx-1">
                <span className="text-sm font-bold text-gray-800">공제 합계</span>
                <span className="text-sm font-bold text-red-500">-{formatNumber(result.totalDeduction)}원</span>
              </div>
            </div>
          </div>
        </>
      )}

      <p className="text-[10px] text-gray-400 text-center">
        * 간이세액표 기준 예상 금액이며, 실제와 다를 수 있습니다
      </p>
    </div>
  )
}
