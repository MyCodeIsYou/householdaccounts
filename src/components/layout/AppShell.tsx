import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell() {
  const { session, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
