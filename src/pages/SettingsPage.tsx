import { useState, useEffect } from 'react'
import { Check, Palette, Bell, BellOff } from 'lucide-react'
import { useTheme, type ThemeName } from '@/context/ThemeContext'
import {
  isNativeApp,
  checkNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
} from '@/lib/notifications'

interface ThemeOption {
  id: ThemeName
  name: string
  description: string
  preview: { bg: string; primary: string; card: string; text: string; accent: string }
}

const THEMES: ThemeOption[] = [
  {
    id: 'watercolor',
    name: '수채화 (따뜻한)',
    description: '아이보리/세이지/오션 — 손으로 그린 듯한 부드러운 분위기',
    preview: {
      bg: '#f5ead0',
      primary: '#a4c2a4',
      card: '#fdf8e8',
      text: '#4a3a28',
      accent: '#7ba8c9',
    },
  },
  {
    id: 'toss',
    name: '토스 (모던)',
    description: '깔끔한 화이트와 비비드한 블루 — 토스뱅크 스타일',
    preview: {
      bg: '#f9fafb',
      primary: '#3182f6',
      card: '#ffffff',
      text: '#191f28',
      accent: '#00b87c',
    },
  },
  {
    id: 'shinhan',
    name: '신한 (전문가)',
    description: '딥 네이비와 화이트 — 신한은행 같은 신뢰감',
    preview: {
      bg: '#f4f6f9',
      primary: '#0046ff',
      card: '#ffffff',
      text: '#0a2756',
      accent: '#d4a84a',
    },
  },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [notifGranted, setNotifGranted] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const isNative = isNativeApp()

  useEffect(() => {
    if (isNative) checkNotificationPermission().then(setNotifGranted)
  }, [isNative])

  async function handleEnableNotif() {
    setNotifLoading(true)
    const granted = await requestNotificationPermission()
    setNotifGranted(granted)
    setNotifLoading(false)
  }

  async function handleTestNotif() {
    const ok = await sendTestNotification()
    setTestMessage(ok ? '2초 후 테스트 알림이 옵니다!' : '알림 발송 실패')
    setTimeout(() => setTestMessage(null), 3000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-5 h-5 text-gray-500" />
          <h1 className="text-lg font-bold text-gray-900">테마 설정</h1>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          원하는 테마를 선택하세요. 변경 즉시 적용됩니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEMES.map(t => {
            const isSelected = theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-md scale-[1.02]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                {/* 테마 미리보기 */}
                <div
                  className="w-full h-24 rounded-xl mb-3 overflow-hidden relative"
                  style={{ backgroundColor: t.preview.bg }}
                >
                  {/* 카드 */}
                  <div
                    className="absolute top-2 left-2 right-2 h-7 rounded-md flex items-center px-2 gap-1.5"
                    style={{
                      backgroundColor: t.preview.card,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.preview.primary }} />
                    <div className="flex-1 h-1.5 rounded" style={{ backgroundColor: t.preview.text, opacity: 0.6 }} />
                  </div>
                  {/* 버튼 */}
                  <div
                    className="absolute bottom-2 left-2 h-5 w-12 rounded"
                    style={{ backgroundColor: t.preview.primary }}
                  />
                  <div
                    className="absolute bottom-2 left-16 h-5 w-8 rounded"
                    style={{ backgroundColor: t.preview.accent }}
                  />
                </div>

                <p className="text-sm font-bold text-gray-900 mb-1">{t.name}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">{t.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl card-shadow p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">현재 선택된 테마</h2>
        <p className="text-base font-bold text-gray-900">
          {THEMES.find(t => t.id === theme)?.name}
        </p>
      </div>

      {/* 알림 설정 */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center gap-2 mb-1">
          {notifGranted ? (
            <Bell className="w-5 h-5 text-emerald-500" />
          ) : (
            <BellOff className="w-5 h-5 text-gray-400" />
          )}
          <h2 className="text-sm font-semibold text-gray-700">카드 결제일 알림</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          등록된 카드의 결제일 하루 전 오전 9시에 알림을 받을 수 있어요.
        </p>

        {!isNative ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs text-amber-700 font-medium">
              📱 이 기능은 모바일 앱에서만 사용할 수 있어요.
            </p>
            <p className="text-[11px] text-amber-600 mt-1">
              앱을 설치하면 카드 결제일 알림을 받을 수 있습니다.
            </p>
          </div>
        ) : !notifGranted ? (
          <button
            onClick={handleEnableNotif}
            disabled={notifLoading}
            className="px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {notifLoading ? '권한 요청 중...' : '알림 켜기'}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
              <Check className="w-3 h-3" /> 알림 활성화됨
            </span>
            <button
              onClick={handleTestNotif}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              테스트 알림
            </button>
          </div>
        )}

        {testMessage && (
          <p className="text-xs text-emerald-600 mt-2">{testMessage}</p>
        )}
      </div>
    </div>
  )
}
