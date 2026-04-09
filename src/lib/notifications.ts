import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import type { Card } from '@/types'

const NOTIFICATION_HOUR = 9 // 오전 9시 알림

// 네이티브 환경(앱)인지 확인
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

// 카드 ID를 안정적인 정수 ID로 변환 (LocalNotifications는 number ID 필요)
function cardIdToNotificationId(cardId: string): number {
  let hash = 0
  for (let i = 0; i < cardId.length; i++) {
    hash = ((hash << 5) - hash + cardId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2147483647
}

// 결제일 하루 전 날짜 계산 (1일이면 전월 마지막날)
function calcNotifyDay(billingDay: number): number {
  if (billingDay === 1) {
    return 0 // 0이면 매월 마지막 날 전날 표현이 어려움 → 매월 28일로 폴백 처리
  }
  return billingDay - 1
}

// 알림 권한 요청 (앱 첫 실행 또는 설정에서 호출)
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch (e) {
    console.error('알림 권한 요청 실패:', e)
    return false
  }
}

// 권한 상태 확인
export async function checkNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const result = await LocalNotifications.checkPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}

// 모든 카드 알림 동기화: 카드 ID로 매핑되는 알림만 취소 → 활성 카드들 다시 등록
// 기존 패턴(getPending → cancel ALL)은 카드와 무관한 알림(테스트 등)까지 지우고
// 9시 직전 cancel-then-reschedule이 race를 만들 수 있어서 카드 ID 집합만 다룸
export async function syncCardNotifications(cards: Card[]): Promise<void> {
  if (!isNativeApp()) return

  const granted = await checkNotificationPermission()
  if (!granted) return

  try {
    const activeCards = cards.filter(
      c => c.is_active && c.billing_day && c.billing_day >= 1 && c.billing_day <= 31
    )
    const cardIds = activeCards.map(c => cardIdToNotificationId(c.id))

    // 1. 카드 알림만 취소 — 카드 외 다른 알림은 건드리지 않음
    if (cardIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: cardIds.map(id => ({ id })),
      })
    }

    // 2. 활성 카드의 새 알림 등록
    const notifications = activeCards.map(card => {
      const notifyDay = calcNotifyDay(card.billing_day!)
      const day = notifyDay === 0 ? 28 : notifyDay // 1일 결제 → 28일 알림으로 폴백
      return {
        id: cardIdToNotificationId(card.id),
        title: '💳 카드 결제일 알림',
        body: `내일은 ${card.card_name} 결제일이에요. 잔액을 확인해보세요!`,
        schedule: {
          on: { day, hour: NOTIFICATION_HOUR, minute: 0, second: 0 },
          allowWhileIdle: true,
        },
        smallIcon: 'ic_launcher',
      }
    })

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
      console.log(`📅 ${notifications.length}개 카드 알림 등록 완료`)
    }
  } catch (e) {
    console.error('카드 알림 동기화 실패:', e)
  }
}

// 테스트 알림 즉시 발송
export async function sendTestNotification(): Promise<boolean> {
  if (!isNativeApp()) return false
  const granted = await checkNotificationPermission()
  if (!granted) return false

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: '🔔 테스트 알림',
          body: '카드 결제일 알림이 정상적으로 동작합니다!',
          schedule: { at: new Date(Date.now() + 2000) }, // 2초 후
        },
      ],
    })
    return true
  } catch {
    return false
  }
}

// 모든 알림 취소 (테스트/디버깅용)
export async function cancelAllNotifications(): Promise<void> {
  if (!isNativeApp()) return
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map(n => ({ id: n.id })),
    })
  }
}
