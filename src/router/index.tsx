import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AccountsPage from '@/pages/AccountsPage'
import AssetChartPage from '@/pages/AssetChartPage'
import AnnualPlanPage from '@/pages/AnnualPlanPage'
import TransactionsPage from '@/pages/TransactionsPage'
import MonthlySummaryPage from '@/pages/MonthlySummaryPage'
import AllowancePage from '@/pages/AllowancePage'
import FixedCostsPage from '@/pages/FixedCostsPage'
import CardsPage from '@/pages/CardsPage'

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="asset-chart" element={<AssetChartPage />} />
          <Route path="annual-plan" element={<AnnualPlanPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="monthly-summary" element={<MonthlySummaryPage />} />
          <Route path="allowance" element={<AllowancePage />} />
          <Route path="fixed-costs" element={<FixedCostsPage />} />
          <Route path="cards" element={<CardsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
