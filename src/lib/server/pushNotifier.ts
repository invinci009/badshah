import 'server-only'
import { formatPaise } from '../ordering/rules.mjs'

export interface OrderPushPayload {
  orderNumber: string
  tableLabel?: string | null
  totalPaise?: number
  items?: Array<{ itemName: string; quantity: number }>
}

/**
 * Default topic for restaurant orders.
 * Can be overridden in .env.local via ORDER_ALERT_TOPIC.
 */
export function getOrderAlertTopic(): string {
  return process.env.ORDER_ALERT_TOPIC || 'badshah-restaurant-orders'
}

/**
 * Dispatch high-priority mobile push alert (ntfy / Swiggy-style alarm).
 * Even when the phone is locked and screen is off, this triggers a loud alarm ringtone.
 */
export async function sendMobileOrderAlarm(order: OrderPushPayload): Promise<boolean> {
  const topic = getOrderAlertTopic()
  if (!topic) return false

  try {
    const tableText = order.tableLabel ? `टेबल ${order.tableLabel}` : 'काउंटर'
    const totalText = order.totalPaise !== undefined ? ` • ${formatPaise(order.totalPaise)}` : ''
    
    let itemsText = ''
    if (order.items && order.items.length > 0) {
      const line = order.items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')
      itemsText = `\n📋 ${line}`
    }

    const title = `🚨 नया ऑर्डर आया है! (#${order.orderNumber})`
    const body = `🍽️ ${tableText}${totalText}${itemsText}`

    const host = process.env.NEXT_PUBLIC_APP_URL || 'https://badshah.vercel.app'
    const clickUrl = `${host}/dashboard#orders`

    const response = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: 'urgent', // 5 / max priority in Android (alarms / heads-up notification)
        Tags: 'loudspeaker,bell,warning',
        Click: clickUrl,
        Actions: `view, किचन में देखें, ${clickUrl}`,
      },
      body,
    })

    return response.ok
  } catch (error) {
    console.warn('[PushAlert] Failed to dispatch mobile push alert:', error)
    return false
  }
}
