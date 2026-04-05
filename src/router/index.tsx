import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import JoinPage from '@/pages/JoinPage'
import DashboardPage from '@/pages/DashboardPage'
import AccountsPage from '@/pages/AccountsPage'
import LiabilitiesPage from '@/pages/LiabilitiesPage'
import AssetChartPage from '@/pages/AssetChartPage'
import AnnualPlanPage from '@/pages/AnnualPlanPage'
import TransactionsPage from '@/pages/TransactionsPage'
import MonthlySummaryPage from '@/pages/MonthlySummaryPage'
import AllowancePage from '@/pages/AllowancePage'
import FixedCostsPage from '@/pages/FixedCostsPage'
import CardsPage from '@/pages/CardsPage'
import HouseholdsPage from '@/pages/HouseholdsPage'
import AdminUsersPage from '@/pages/AdminUsersPage'
import MenuConfigPage from '@/pages/MenuConfigPage'
import AdminBanksPage from '@/pages/AdminBanksPage'
import AdminHouseholdsPage from '@/pages/AdminHouseholdsPage'
import SupportPage from '@/pages/SupportPage'
import ProfilePage from '@/pages/ProfilePage'

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="liabilities" element={<LiabilitiesPage />} />
          <Route path="asset-chart" element={<AssetChartPage />} />
          <Route path="annual-plan" element={<AnnualPlanPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="monthly-summary" element={<MonthlySummaryPage />} />
          <Route path="allowance" element={<AllowancePage />} />
          <Route path="fixed-costs" element={<FixedCostsPage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="households" element={<HouseholdsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/menus" element={<MenuConfigPage />} />
          <Route path="admin/banks" element={<AdminBanksPage />} />
          <Route path="admin/households" element={<AdminHouseholdsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
