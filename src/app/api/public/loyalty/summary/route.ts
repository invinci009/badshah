import { NextRequest, NextResponse } from 'next/server'
import {
  ensureLoyaltyAccount,
  getCustomerLoyaltySnapshot,
  getCustomerLedger,
  getCustomerRedemptions,
  getLoyaltyConfig,
  getCustomerAccount,
  normalizeCustomerPhone,
} from '@/lib/firebase/loyalty'
import { getOrdersByPhone, type Order } from '@/lib/firebase/ordering'
import { getCustomerSession } from '@/lib/loyalty/session'
import type { LoyaltyTransaction, Redemption, LoyaltySnapshot } from '@/lib/firebase/loyalty'

export interface LoyaltySummaryResponse {
  customer: { customerId: string; name: string; phone: string; status: string; memberSince: string } | null
  snapshot: LoyaltySnapshot
  config: {
    enabled: boolean
    pointsPerOrder: number
    minOrderPaise: number
    expiryEnabled: boolean
    expiryDays: number
    maxRedemptionsPerOrder: number
  } | null
  transactions: LoyaltyTransaction[]
  redemptions: Redemption[]
  orders: Array<Pick<Order, 'id' | 'orderNumber' | 'totalPaise' | 'fulfilment' | 'paymentStatus' | 'createdAt' | 'tableLabel'> & {
    loyaltyAwarded?: boolean
    loyaltyPointsEarned?: number
    loyaltyDiscountPaise?: number
    items: Array<{
      itemId?: string
      itemName: string
      quantity: number
      pricePaise?: number
      selections?: Array<{ groupId: string; optionId: string }>
    }>
  }>
}

// GET /api/public/loyalty/summary — loyalty dashboard payload for the logged-in customer.
export async function GET(request: NextRequest) {
  try {
    const session = await getCustomerSession(request)
    let customerPhone = session?.customerId
    if (!customerPhone) {
      const queryPhone = request.nextUrl.searchParams.get('phone')
      if (queryPhone) {
        const normalized = normalizeCustomerPhone(queryPhone)
        if (normalized) customerPhone = normalized
      }
    }
    if (!customerPhone) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }
    const account = await getCustomerAccount(customerPhone)
    if (!account) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    if (account.status === 'suspended') {
      const res = NextResponse.json({ error: 'Account suspended', code: 'SUSPENDED' }, { status: 403 })
      return res
    }

    const [snapshot, config, transactions, redemptions, orders] = await Promise.all([
      getCustomerLoyaltySnapshot(customerPhone),
      getLoyaltyConfig().catch(() => null),
      getCustomerLedger(customerPhone, 60),
      getCustomerRedemptions(customerPhone, 60),
      getOrdersByPhone(customerPhone, 30).catch(() => [] as Order[]),
    ])

    const latestOrderId = orders[0]?.id || 'none'
    const latestOrderStatus = orders[0]?.fulfilment || 'none'
    const latestTxId = transactions[0]?.id || 'none'
    const etag = `W/"ls-${customerPhone}-${snapshot.availablePoints}-${snapshot.earnedTotal}-${latestOrderId}-${latestOrderStatus}-${latestTxId}"`

    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=20',
        },
      })
    }

    return NextResponse.json(
      {
        customer: {
          customerId: customerPhone,
          name: account.name,
          phone: account.phone,
          status: account.status,
          memberSince: account.createdAt,
        },
        snapshot,
        config: config
          ? {
              enabled: config.enabled,
              pointsPerOrder: config.pointsPerOrder,
              minOrderPaise: config.minOrderPaise,
              expiryEnabled: config.expiryEnabled,
              expiryDays: config.expiryDays,
              maxRedemptionsPerOrder: config.maxRedemptionsPerOrder,
            }
          : null,
        transactions,
        redemptions,
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          totalPaise: o.totalPaise,
          fulfilment: o.fulfilment,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt,
          tableLabel: o.tableLabel,
          loyaltyAwarded: o.loyaltyAwarded ?? false,
          loyaltyPointsEarned: o.loyaltyPointsEarned ?? 0,
          loyaltyDiscountPaise: o.loyalty?.discountPaise ?? 0,
          items: (o.items || []).map((i) => ({
            itemId: i.itemId,
            itemName: i.itemName,
            quantity: i.quantity,
            pricePaise: i.unitPricePaise,
            selections: (i.options || []).map((opt) => ({
              groupId: opt.groupId,
              optionId: opt.optionId,
            })),
          })),
        })),
      } satisfies LoyaltySummaryResponse,
      {
        status: 200,
        headers: {
          ETag: etag,
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=20',
        },
      }
    )
  } catch (error) {
    console.error('Loyalty summary GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
