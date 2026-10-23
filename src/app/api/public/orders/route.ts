import { NextRequest, NextResponse } from 'next/server'
import { getCampaignBySlug } from '@/lib/firebase/firestore'
import {
  getOrderMenuItems,
  getOrderingConfig,
  resolveTableToken,
  getTables,
  getTable,
  getActiveOrdersByTable,
  normalizeTableLabel,
  getOrderByIdempotencyKey,
  allocateOrderNumber,
  createOrder,
  type OrderItemSnapshot,
  type DiningTable,
} from '@/lib/firebase/ordering'
import {
  getLoyaltyConfig,
  getCustomerAccount,
  getOrCreateCustomerAccount,
  applyRedemptionForOrder,
  bondRedemptionToOrder,
  cancelRedemption,
} from '@/lib/firebase/loyalty'
import { getCustomerSession } from '@/lib/loyalty/session'
import { hashToken, generateOrderAccessToken } from '@/lib/ordering/tokens'
import { orderCreateSchema, normalizePhoneServerSide } from '@/lib/ordering/validation'
import { computeQuote } from '@/lib/ordering/rules.mjs'

// POST /api/public/orders — server-authoritative order creation.
// Validates restaurant, table token, phone, items, options; rechecks
// availability/prices; computes money server-side; idempotent by key.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = orderCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid order', details: parsed.error.flatten() }, { status: 400 })
    }
    const input = parsed.data

    // 1. Restaurant (campaign slug must exist + active).
    const campaign = await getCampaignBySlug(input.slug).catch(() => null)
    if (!campaign || !campaign.active) {
      return NextResponse.json({ error: 'Ordering is not available for this link' }, { status: 404 })
    }

    // 2. Idempotency: same key → same order (phone must match).
    const existing = await getOrderByIdempotencyKey(input.idempotencyKey).catch(() => null)
    // Loyalty & Authentication: Diners must be logged in before placing an order.
    // If authenticated via cookie session, the verified customer phone is used.
    // If session is absent, require valid phone to resolve/create customer account or reject with LOGIN_REQUIRED.
    let session = await getCustomerSession(request).catch(() => null)
    let phone: string | null = null
    let account = null

    if (session && session.verified) {
      phone = session.customerId
      account = await getCustomerAccount(phone).catch(() => null)
    } else {
      const normalizedInputPhone = normalizePhoneServerSide(input.customerPhone)
      if (!normalizedInputPhone) {
        return NextResponse.json(
          { error: 'Please enter your mobile number to log in before placing an order', code: 'LOGIN_REQUIRED' },
          { status: 401 }
        )
      }
      account = await getOrCreateCustomerAccount({ phone: normalizedInputPhone, name: input.customerName }).catch(() => null)
      phone = normalizedInputPhone
    }

    if (account && account.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your loyalty account is suspended. Please contact restaurant staff.', code: 'SUSPENDED' },
        { status: 403 }
      )
    }

    const loyaltyCustomerPhone: string | null = phone
    if (existing) {
      if (existing.customerPhone !== phone) {
        return NextResponse.json({ error: 'Duplicate request with different details' }, { status: 409 })
      }
      return NextResponse.json(
        {
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          totalPaise: existing.totalPaise,
          tableLabel: existing.tableLabel,
          duplicate: true,
        },
        { status: 200 }
      )
    }

    // 3. Table resolution (token or table label)
    let tableId: string | null = null
    let tableLabel: string | null = null
    let canonicalTable: DiningTable | null = null
    if (input.tableToken) {
      const resolved = await resolveTableToken(hashToken(input.tableToken))
      if (!resolved) return NextResponse.json({ error: 'Table code expired or revoked' }, { status: 410 })
      tableId = resolved.table.id
      tableLabel = resolved.table.label
      canonicalTable = resolved.table
    } else {
      const orderingCfg = await getOrderingConfig().catch(() => null)
      if (orderingCfg && !orderingCfg.generalOrderingEnabled && !input.tableLabel) {
        return NextResponse.json({ error: 'Please scan your table QR to order' }, { status: 403 })
      }
      if (input.tableLabel) {
        tableLabel = input.tableLabel.trim()
      }
    }

    // Resolve canonical table if tableLabel was provided without a token
    if (!tableId && tableLabel) {
      const tables = await getTables(true).catch(() => [])
      const matched = tables.find(
        (t) => normalizeTableLabel(t.label) === normalizeTableLabel(tableLabel!)
      )
      if (matched) {
        tableId = matched.id
        tableLabel = matched.label // Canonical label (e.g. "1" instead of "table 01")
        canonicalTable = matched
        if (!matched.active) {
          return NextResponse.json(
            { error: `Table "${matched.label}" is currently inactive. Please contact staff.` },
            { status: 403 }
          )
        }
      }
    }

    // Table booking & occupancy protection:
    // If table is booked or occupied, it is unavailable for other customers.
    // Diners belonging to the SAME active session (matching phone or matching active order token) can order add-ons.
    if (tableId) {
      const currentTable = canonicalTable || (await getTable(tableId).catch(() => null))
      if (currentTable) {
        if (currentTable.state === 'cleaning') {
          return NextResponse.json(
            {
              error: `Table "${currentTable.label}" is currently being prepared and sanitized. Please choose another table or speak to staff.`,
              code: 'TABLE_CLEANING',
              tableLabel: currentTable.label,
            },
            { status: 409 }
          )
        }

        const activeOrders = await getActiveOrdersByTable(tableId).catch(() => [])
        const isOccupiedOrActive = currentTable.state === 'occupied' || activeOrders.length > 0

        if (isOccupiedOrActive) {
          const isSamePartyPhone = activeOrders.some((o) => o.customerPhone === phone)
          let isSamePartyToken = false
          if (input.existingOrderId && input.activeOrderAccessToken) {
            const matchedOrder = activeOrders.find((o) => o.id === input.existingOrderId)
            if (matchedOrder && matchedOrder.accessTokenHash === hashToken(input.activeOrderAccessToken)) {
              isSamePartyToken = true
            }
          }

          if (!isSamePartyPhone && !isSamePartyToken) {
            return NextResponse.json(
              {
                error: `Table "${currentTable.label}" is currently booked by another guest. Please select an available table or ask staff for assistance.`,
                code: 'TABLE_OCCUPIED',
                tableLabel: currentTable.label,
              },
              { status: 409 }
            )
          }
        }
      }
    }

    const name = (input.customerName || account?.name || session?.name || 'Diner').trim()
    if (!name) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })

    // 4. Authoritative menu + availability + options validation.
    const [menuItems, ordering] = await Promise.all([
      getOrderMenuItems(),
      getOrderingConfig().catch(() => ({ taxRateBps: 500, serviceChargePaise: 0 })),
    ])
    const menuById = new Map(menuItems.map((m) => [m.id, m]))

    const snapshots: OrderItemSnapshot[] = []
    const quoteLines: Array<{ item: { pricePaise: number }; quantity: number; selections: Array<{ pricePaise: number }> }> = []

    for (const line of input.items) {
      const menuItem = menuById.get(line.itemId)
      if (!menuItem || !menuItem.visible) {
        return NextResponse.json({ error: `Item no longer available: ${line.itemId}` }, { status: 409 })
      }
      if (!menuItem.available) {
        return NextResponse.json({ error: `"${menuItem.name}" is sold out. Please remove it.`, code: 'ITEM_UNAVAILABLE' }, { status: 409 })
      }
      // Validate customizations.
      const chosenOptions: OrderItemSnapshot['options'] = []
      const flatSelections: Array<{ pricePaise: number }> = []
      const groups = menuItem.options || []
      const byGroup = new Map<string, string[]>()
      for (const s of line.selections) {
        const arr = byGroup.get(s.groupId) || []
        arr.push(s.optionId)
        byGroup.set(s.groupId, arr)
      }
      for (const g of groups) {
        const picked = byGroup.get(g.id) || []
        if (g.required && picked.length === 0) {
          return NextResponse.json({ error: `"${menuItem.name}" requires: ${g.name}`, code: 'OPTION_REQUIRED' }, { status: 400 })
        }
        if (g.type === 'single' && picked.length > 1) {
          return NextResponse.json({ error: `Choose only one option for ${g.name}`, code: 'OPTION_INVALID' }, { status: 400 })
        }
        if (picked.length < g.min || picked.length > g.max) {
          return NextResponse.json({ error: `Invalid selection for ${g.name}`, code: 'OPTION_INVALID' }, { status: 400 })
        }
        for (const optId of picked) {
          const choice = g.choices.find((c) => c.id === optId)
          if (!choice) {
            return NextResponse.json({ error: `Invalid option for ${g.name}`, code: 'OPTION_INVALID' }, { status: 400 })
          }
          chosenOptions.push({ groupId: g.id, groupName: g.name, optionId: choice.id, optionName: choice.name, pricePaise: choice.pricePaise })
          flatSelections.push({ pricePaise: choice.pricePaise })
        }
      }
      if (byGroup.size > groups.length) {
        return NextResponse.json({ error: 'Invalid customization', code: 'OPTION_INVALID' }, { status: 400 })
      }
      const unit = menuItem.pricePaise + flatSelections.reduce((s, o) => s + o.pricePaise, 0)
      snapshots.push({
        itemId: menuItem.id,
        itemName: menuItem.name,
        unitPricePaise: menuItem.pricePaise,
        quantity: line.quantity,
        options: chosenOptions,
        lineTotalPaise: unit * line.quantity,
      })
      quoteLines.push({ item: { pricePaise: menuItem.pricePaise }, quantity: line.quantity, selections: flatSelections })
    }

    // 5. Server-side money.
    const quote = computeQuote(quoteLines, ordering.taxRateBps, ordering.serviceChargePaise)

    // 5b. Loyalty redemption (previously earned points only — the current
    // order's possible award is NOT spendable here by design).
    let redemption: Awaited<ReturnType<typeof applyRedemptionForOrder>> | null = null
    if (input.redeemRewardId && loyaltyCustomerPhone) {
      const cfg = await getLoyaltyConfig().catch(() => null)
      if (!cfg || !cfg.enabled) {
        return NextResponse.json({ error: 'The loyalty program is currently paused', code: 'LOYALTY_DISABLED' }, { status: 409 })
      }
      if (cfg.maxRedemptionsPerOrder < 1) {
        return NextResponse.json({ error: 'Reward redemption is currently disabled', code: 'REDEEM_DISABLED' }, { status: 409 })
      }
      try {
        redemption = await applyRedemptionForOrder({
          customerPhone: loyaltyCustomerPhone,
          rewardId: input.redeemRewardId,
          subtotalPaise: quote.subtotalPaise,
        })
      } catch (e) {
        const code = e instanceof Error ? e.message : 'REDEEM_FAILED'
        const friendly: Record<string, string> = {
          REWARD_NOT_FOUND: 'That reward no longer exists',
          REWARD_INACTIVE: 'That reward is no longer available',
          REWARD_EXPIRED: 'That reward offer has expired',
          NOT_STARTED: 'That reward is not active yet',
          OUT_OF_STOCK: 'That reward is sold out',
          MIN_ORDER: 'Your order is below the minimum value for this reward',
          NOT_ENOUGH_POINTS: 'Not enough points for this reward',
          NOT_VERIFIED: 'Verify your account to redeem rewards',
          CUSTOMER_LIMIT: 'You have already claimed this reward the maximum number of times',
          LOYALTY_DISABLED: 'The loyalty program is currently paused',
        }
        return NextResponse.json(
          { error: friendly[code] ?? 'Could not redeem this reward', code },
          { status: 409 }
        )
      }
    }

    const payableTotalPaise = redemption ? Math.max(0, quote.totalPaise - redemption.discountPaise) : quote.totalPaise

    // 6. Stale-cart protection: client quote mismatch → 409 with server quote.
    const heldDiscountPaise = redemption ? redemption.discountPaise : 0
    if (
      input.clientTotalPaise !== undefined &&
      (input.clientTotalPaise !== payableTotalPaise ||
        (input.clientRedeemDiscountPaise !== undefined &&
          input.clientRedeemDiscountPaise !== heldDiscountPaise)) &&
      !input.confirmUpdatedTotal
    ) {
      // Roll back any held redemption before surfacing the conflict.
      if (redemption) {
        await cancelRedemption(redemption.redemptionId, 'Order checkout quote conflict — points restored').catch(() => {})
      }
      return NextResponse.json(
        {
          error: 'Prices changed while you were ordering. Please confirm the updated total.',
          code: 'PRICE_CHANGED',
          quote: { ...quote, totalPaise: payableTotalPaise, discountPaise: heldDiscountPaise },
        },
        { status: 409 }
      )
    }

    // 7. Persist (order number allocated atomically; snapshots immutable).
    const { orderNumber } = await allocateOrderNumber()
    const accessToken = generateOrderAccessToken()
    let order
    try {
      order = await createOrder({
        restaurantId: 'default',
        orderNumber,
        tableId,
        tableLabel,
        customerName: name.slice(0, 100),
        customerPhone: phone,
        items: snapshots,
        subtotalPaise: quote.subtotalPaise,
        taxPaise: quote.taxPaise,
        chargePaise: quote.chargePaise,
        totalPaise: payableTotalPaise,
        fulfilment: 'RECEIVED',
        paymentStatus: 'UNPAID',
        paymentMethod: 'COUNTER',
        paidPaise: 0,
        refundedPaise: 0,
        notes: input.notes?.trim().slice(0, 280) || undefined,
        idempotencyKey: input.idempotencyKey,
        accessTokenHash: hashToken(accessToken),
        itemIds: snapshots.map((s) => s.itemId),
        loyalty: redemption
          ? {
              redemptionId: redemption.redemptionId,
              rewardId: redemption.reward.id,
              rewardName: redemption.reward.name,
              discountPaise: redemption.discountPaise,
              pointsUsed: redemption.pointsUsed,
            }
          : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      // Order creation failed after points were held → restore them explicitly.
      if (redemption) {
        await cancelRedemption(redemption.redemptionId, 'Order creation failed — points restored').catch(() => {})
      }
      throw err
    }

    if (redemption) {
      await bondRedemptionToOrder(redemption.redemptionId, order.id, orderNumber).catch(() => {})
    }

    // Audit event for creation.
    const { getAdminFirestore } = await import('@/lib/firebase/admin')
    await getAdminFirestore()
      .collection('orderEvents')
      .doc()
      .set({
        orderId: order.id,
        restaurantId: 'default',
        type: 'CREATED',
        actorUid: 'customer',
        prev: null,
        next: 'RECEIVED',
        createdAt: new Date().toISOString(),
      })

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalPaise: order.totalPaise,
        tableLabel,
        accessToken,
        loyalty: redemption
          ? {
              pointsUsed: redemption.pointsUsed,
              discountPaise: redemption.discountPaise,
              rewardName: redemption.reward.name,
            }
          : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Public order creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
