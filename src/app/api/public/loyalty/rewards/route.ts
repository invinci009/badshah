import { NextRequest, NextResponse } from 'next/server'
import {
  listPublicRewards,
  getCustomerLoyaltySnapshot,
  getRewardEligibility,
  getCustomerAccount,
  getLoyaltyConfig,
  type Reward,
  type CustomerAccount,
} from '@/lib/firebase/loyalty'
import { getCustomerSession } from '@/lib/loyalty/session'

// GET /api/public/loyalty/rewards — publicly viewable rewards with per-customer
// eligibility flags (badges, not guarantees — checkout re-validates server-side).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subtotalPaise = Math.min(
      Math.max(0, Number(searchParams.get('subtotalPaise')) || 0),
      100000000
    )

    const [rewards, cfg] = await Promise.all([listPublicRewards(), getLoyaltyConfig()])
    const session = await getCustomerSession(request)

    let availablePoints = 0
    let customerVerifiedActive = false
    let account: CustomerAccount | null = null
    if (session) {
      const [fetchedAccount, snap] = await Promise.all([
        getCustomerAccount(session.customerId),
        getCustomerLoyaltySnapshot(session.customerId),
      ])
      account = fetchedAccount
      availablePoints = snap.availablePoints
      customerVerifiedActive = !!account && account.verified && account.status !== 'suspended'
    }

    const payload = await Promise.all(
      rewards.map(async (r: Reward) => {
        const eligibility = customerVerifiedActive
          ? await getRewardEligibility(r, {
              customerPhone: session!.customerId,
              subtotalPaise,
              loyaltyAvailable: availablePoints,
              enabled: cfg.enabled,
              customer: account,
            })
          : { eligible: false, code: session ? 'NOT_VERIFIED' : 'LOGIN_REQUIRED' }
        const hideReward = !customerVerifiedActive || r.pointsCost > availablePoints
        return {
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          imageUrl: r.imageUrl ?? null,
          type: r.type,
          pointsCost: r.pointsCost,
          discountPaise: r.discountPaise,
          discountPctBps: r.discountPctBps,
          discountMaxPaise: r.discountMaxPaise,
          minOrderPaise: r.minOrderPaise,
          applicableItemIds: r.applicableItemIds ?? [],
          stock: r.stock !== null && r.stock !== undefined ? r.stock : null,
          endAt: r.endAt,
          startAt: r.startAt,
          maxPerCustomer: r.maxPerCustomer ?? null,
          eligibility: eligibility.code === 'OK' ? 'OK' : eligibility.code,
          // UI helpers
          redeemable: eligibility.code === 'OK',
          hiddenByPoints: hideReward,
        }
      })
    )

    const etag = `W/"rewards-${session?.customerId || 'anon'}-${availablePoints}-${subtotalPaise}-${payload.length}-${cfg.updatedAt || '0'}"`
    const cacheControl = session ? 'private, no-cache' : 'public, s-maxage=30, stale-while-revalidate=60'

    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': cacheControl,
        },
      })
    }

    return NextResponse.json(
      {
        rewards: payload,
        loyaltyEnabled: cfg.enabled,
        // Never expose raw points to logged-out visitors beyond onboarding copy.
        customer: session
          ? { customerId: session.customerId, availablePoints, verifiedActive: customerVerifiedActive }
          : null,
      },
      {
        headers: {
          ETag: etag,
          'Cache-Control': cacheControl,
        },
      }
    )
  } catch (error) {
    console.error('Loyalty rewards GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
