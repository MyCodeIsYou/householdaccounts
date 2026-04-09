import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
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
import CategoriesPage from '@/pages/CategoriesPage'
import HouseholdsPage from '@/pages/HouseholdsPage'
import AdminUsersPage from '@/pages/AdminUsersPage'
import MenuConfigPage from '@/pages/MenuConfigPage'
import AdminBanksPage from '@/pages/AdminBanksPage'
import AdminHouseholdsPage from '@/pages/AdminHouseholdsPage'
import SupportPage from '@/pages/SupportPage'
import ProfilePage from '@/pages/ProfilePage'
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage'
import TermsOfServicePage from '@/pages/TermsOfServicePage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import SalaryCalculatorPage from '@/pages/SalaryCalculatorPage'
import ExchangeRatePage from '@/pages/ExchangeRatePage'
import SettingsPage from '@/pages/SettingsPage'

// PASSWORD_RECOVERY 이벤트 감지 시 /reset-password로 리다이렉트
// Supabase recovery URL(#access_token=...&type=recovery)은 라우트 매칭 실패 → catch-all로 옴
function CatchAllRedirect() {
  const { isPasswordRecovery, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  if (isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />
  }

  return <Navigate to="/" replace />
}

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="households" element={<HouseholdsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/menus" element={<MenuConfigPage />} />
          <Route path="admin/banks" element={<AdminBanksPage />} />
          <Route path="admin/households" element={<AdminHouseholdsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="salary-calculator" element={<SalaryCalculatorPage />} />
          <Route path="exchange-rate" element={<ExchangeRatePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </HashRouter>
  )
}
