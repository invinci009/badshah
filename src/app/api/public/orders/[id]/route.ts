import { NextRequest, NextResponse } from 'next/server'
import { getOrder, getOrderEvents } from '@/lib/firebase/ordering'
import { verifyTokenAgainstHash } from '@/lib/ordering/tokens'
import { maskPhone } from '@/lib/ordering/rules.mjs'
import { getRestaurantSettings } from '@/lib/firebase/firestore'
import { getRestaurantConfig } from '@/config/loader'

// GET /api/public/orders/[id]?token=...
// Scoped customer tracking: unguessable access token required. Returns only
// the customer's own limited public info (phone masked).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || ''

    const order = await getOrder(id).catch(() => null)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (!token || !verifyTokenAgainstHash(token, order.accessTokenHash)) {
      return NextResponse.json({ error: 'Not authorized to view this order' }, { status: 403 })
    }

    const config = getRestaurantConfig()
    const settings = await getRestaurantSettings().catch(() => null)

    let cancellationReason: string | null = null
    if (order.fulfilment === 'CANCELLED') {
      const events = await getOrderEvents(order.id).catch(() => [])
      const cancelEv = [...events].reverse().find((e) => e.next === 'CANCELLED' && e.reason)
      cancellationReason = cancelEv?.reason || null
    }

    const etag = `W/"${order.id}-${order.fulfilment}-${order.paymentStatus}-${order.updatedAt || order.createdAt}"`
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'no-cache',
        },
      })
    }

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableLabel: order.tableLabel,
        customerName: order.customerName,
        customerPhoneMasked: maskPhone(order.customerPhone),
        items: order.items,
        subtotalPaise: order.subtotalPaise,
        taxPaise: order.taxPaise,
        chargePaise: order.chargePaise,
        totalPaise: order.totalPaise,
        fulfilment: order.fulfilment,
        cancellationReason,
        paymentStatus: order.paymentStatus,
        paymentInstructions: 'Please pay at the counter. Show this order number to the staff.',
        restaurantPhone: settings?.contact?.phone || config.contact.phone || null,
        createdAt: order.createdAt,
        // Loyalty context for the confirmation page.
        loyaltyAwarded: order.loyaltyAwarded ?? false,
        loyaltyPointsEarned: order.loyaltyPointsEarned ?? 0,
        loyaltyDiscountPaise: order.loyalty?.discountPaise ?? 0,
        loyaltyRewardName: order.loyalty?.rewardName ?? null,
      },
      {
        status: 200,
        headers: {
          ETag: etag,
          'Cache-Control': 'no-cache',
        },
      }
    )
  } catch (error) {
    console.error('Public order tracking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
