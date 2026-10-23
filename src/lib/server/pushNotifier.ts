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

/**
 * Dispatch high-priority mobile push alert for customer staff assistance calls.
 */
export async function sendMobileServiceAlarm(payload: {
  tableLabel?: string | null
  type: string
  note?: string
}): Promise<boolean> {
  const topic = getOrderAlertTopic()
  if (!topic) return false

  try {
    const tableText = payload.tableLabel ? `टेबल ${payload.tableLabel}` : 'काउंटर'
    const typeLabel =
      payload.type === 'water'
        ? 'पीने का पानी (Drinking Water)'
        : payload.type === 'bill'
        ? 'बिल रिक्वेस्ट (Bill Request)'
        : payload.type === 'assistance'
        ? 'वेटर कॉल (Waiter Call)'
        : payload.type === 'cleaning'
        ? 'टेबल सफाई (Clean Table)'
        : 'चम्मच / प्लेट (Cutlery)'

    const title = `🔔 स्टाफ कॉल: ${tableText} (${typeLabel})`
    const body = `📍 ${tableText} से ${typeLabel} के लिए बुलाया गया है।${
      payload.note ? `\n📝 नोट: ${payload.note}` : ''
    }`

    const host = process.env.NEXT_PUBLIC_APP_URL || 'https://biriyani-badshah.vercel.app'
    const clickUrl = `${host}/dashboard#kitchen`

    const response = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: 'urgent',
        Tags: 'bell,information_source',
        Click: clickUrl,
        Actions: `view, डैशबोर्ड में देखें, ${clickUrl}`,
      },
      body,
    })

    return response.ok
  } catch (error) {
    console.warn('[PushAlert] Failed to dispatch mobile service alert:', error)
    return false
  }
}
