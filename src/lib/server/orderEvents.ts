import 'server-only'
import { EventEmitter } from 'events'

// ==============================================================================
// Global Order Events Emitter
// Enables sub-second instant real-time synchronization between Kitchen Dashboard
// and Customer Order Confirmation screens via Server-Sent Events (SSE).
// ==============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __rp_orderEventEmitter: EventEmitter | undefined
}

export const orderEventEmitter: EventEmitter = (globalThis.__rp_orderEventEmitter ??= (() => {
  const ee = new EventEmitter()
  ee.setMaxListeners(2000)
  return ee
})())

export interface OrderStatusEventPayload {
  orderId: string
  orderNumber: string
  fulfilment: string
  paymentStatus: string
  tableLabel?: string | null
  updatedAt: string
}

export function emitOrderStatusChange(orderId: string, payload: OrderStatusEventPayload): void {
  try {
    orderEventEmitter.emit(`order:${orderId}`, payload)
    orderEventEmitter.emit('order:all', payload)
  } catch (err) {
    console.error(`[OrderEvents] Failed to emit status change for ${orderId}:`, err)
  }
}
