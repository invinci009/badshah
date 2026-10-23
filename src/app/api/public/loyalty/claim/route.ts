import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession } from '@/lib/loyalty/session'
import { getCustomerAccount, awardOrderPoints, getLoyaltyConfig, normalizeCustomerPhone } from '@/lib/firebase/loyalty'
import { getOrder, invalidateActiveOrdersCache } from '@/lib/firebase/ordering'

// POST /api/public/loyalty/claim — Retroactively claim points for an order
// placed with this customer's mobile number once the order is served.
export async function POST(request: NextRequest) {
  try {
    const session = await getCustomerSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Please log in to claim points', code: 'LOGIN_REQUIRED' }, { status: 401 })
    }

    const account = await getCustomerAccount(session.customerId)
    if (!account || !account.verified) {
      return NextResponse.json({ error: 'Please verify your mobile number to claim points', code: 'NOT_VERIFIED' }, { status: 403 })
    }
    if (account.status === 'suspended') {
      return NextResponse.json({ error: 'Your account is currently suspended', code: 'SUSPENDED' }, { status: 403 })
    }

    const cfg = await getLoyaltyConfig()
    if (!cfg.enabled) {
      return NextResponse.json({ error: 'Loyalty program is currently paused', code: 'LOYALTY_PAUSED' }, { status: 409 })
    }

    const body = await request.json().catch(() => ({}))
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const order = await getOrder(orderId)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Security: diner's phone must match the phone recorded on the order
    const orderPhone = normalizeCustomerPhone(order.customerPhone)
    const sessionPhone = normalizeCustomerPhone(session.customerId)
    if (!orderPhone || !sessionPhone || orderPhone !== sessionPhone) {
      return NextResponse.json(
        { error: 'This order was placed under a different mobile number' },
        { status: 403 }
      )
    }

    if (order.loyaltyAwarded) {
      return NextResponse.json({
        success: true,
        alreadyAwarded: true,
        awarded: order.loyaltyPointsEarned || cfg.pointsPerOrder,
        message: 'Points have already been added to your account for this order',
      })
    }

    if (order.fulfilment !== 'SERVED') {
      return NextResponse.json({
        error: 'Points are awarded once your meal is served by the team',
        code: 'ORDER_NOT_SERVED',
      }, { status: 409 })
    }

    const checkAmount = order.subtotalPaise !== undefined ? order.subtotalPaise : order.totalPaise
    if (checkAmount < cfg.minOrderPaise) {
      return NextResponse.json({
        error: `Orders must be at least ₹${cfg.minOrderPaise / 100} to earn points`,
        code: 'BELOW_MIN_ORDER',
      }, { status: 409 })
    }

    const result = await awardOrderPoints({
      id: order.id,
      orderNumber: order.orderNumber,
      totalPaise: order.totalPaise,
      subtotalPaise: order.subtotalPaise,
      customerPhone: session.customerId,
      loyaltyAwarded: false,
    })

    invalidateActiveOrdersCache()

    if (result.awarded === 0) {
      return NextResponse.json({
        success: true,
        alreadyAwarded: true,
        awarded: cfg.pointsPerOrder,
        message: 'Points have already been added to your account for this order',
      })
    }

    return NextResponse.json({
      success: true,
      awarded: result.awarded,
      message: `Added +${result.awarded} points to your loyalty account!`,
    }, { status: 200 })
  } catch (error) {
    console.error('Loyalty claim error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
