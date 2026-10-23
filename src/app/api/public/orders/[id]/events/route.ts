import { NextRequest } from 'next/server'
import { getOrder } from '@/lib/firebase/ordering'
import { verifyTokenAgainstHash } from '@/lib/ordering/tokens'
import { orderEventEmitter, type OrderStatusEventPayload } from '@/lib/server/orderEvents'

export const dynamic = 'force-dynamic'

// GET /api/public/orders/[id]/events?token=...
// Real-time Server-Sent Events (SSE) stream for instant sub-second order status updates.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || ''

    const order = await getOrder(id).catch(() => null)
    if (!order) {
      return new Response('Order not found', { status: 404 })
    }
    if (!token || !verifyTokenAgainstHash(token, order.accessTokenHash)) {
      return new Response('Unauthorized', { status: 403 })
    }

    const encoder = new TextEncoder()
    let heartbeatTimer: NodeJS.Timeout | null = null

    const stream = new ReadableStream({
      start(controller) {
        // Send initial state immediately
        const initialPayload = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          fulfilment: order.fulfilment,
          paymentStatus: order.paymentStatus,
          tableLabel: order.tableLabel,
          updatedAt: order.updatedAt || order.createdAt,
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`))

        // Listener for real-time order transitions
        const onOrderChange = (data: OrderStatusEventPayload) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
            // If order has reached final state, close stream
            if (data.fulfilment === 'SERVED' || data.fulfilment === 'CANCELLED') {
              cleanup()
              controller.close()
            }
          } catch {
            cleanup()
          }
        }

        orderEventEmitter.on(`order:${id}`, onOrderChange)

        // 15-second heartbeat to keep SSE connection alive through proxies
        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            cleanup()
          }
        }, 15000)

        function cleanup() {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer)
            heartbeatTimer = null
          }
          orderEventEmitter.off(`order:${id}`, onOrderChange)
        }

        request.signal.addEventListener('abort', cleanup)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('SSE order tracking error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
