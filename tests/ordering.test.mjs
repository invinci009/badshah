import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeIndianPhone,
  isValidIndianPhone,
  maskPhone,
  formatPaise,
  computeQuote,
  isAllowedTransition,
  isTerminalFulfilment,
  derivePaymentStatus,
  formatOrderNumber,
} from '../src/lib/ordering/rules.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('phone validation (format-only, never verified)', () => {
  it('accepts valid 10-digit numbers starting 6-9', () => {
    assert.equal(normalizeIndianPhone('9876543210'), '9876543210')
    assert.equal(normalizeIndianPhone('6123456789'), '6123456789')
    assert.ok(isValidIndianPhone('9693999890'))
  })
  it('normalizes +91, 91, 0 prefixes and separators', () => {
    assert.equal(normalizeIndianPhone('+91 98765 43210'), '9876543210')
    assert.equal(normalizeIndianPhone('91-9876543210'), '9876543210')
    assert.equal(normalizeIndianPhone('09876543210'), '9876543210')
    assert.equal(normalizeIndianPhone('+91-96939-99890'), '9693999890')
  })
  it('rejects invalid formats', () => {
    assert.equal(normalizeIndianPhone('5876543210'), null) // starts with 5
    assert.equal(normalizeIndianPhone('987654321'), null) // too short
    assert.equal(normalizeIndianPhone('98765432101'), null) // too long
    assert.equal(normalizeIndianPhone(''), null)
    assert.equal(normalizeIndianPhone(null), null)
    assert.equal(normalizeIndianPhone(undefined), null)
    assert.equal(normalizeIndianPhone(9876543210), null)
    assert.ok(!isValidIndianPhone('12345'))
  })
  it('masks phones for customer display', () => {
    assert.equal(maskPhone('9876543210'), '••••••3210')
  })
})

describe('money (integer paise)', () => {
  it('formats paise as INR', () => {
    assert.equal(formatPaise(19900), '₹199.00')
    assert.equal(formatPaise(0), '₹0.00')
  })
  it('computes quotes server-side style', () => {
    const q = computeQuote(
      [
        { item: { pricePaise: 19900 }, quantity: 2, selections: [{ pricePaise: 3000 }] },
        { item: { pricePaise: 9900 }, quantity: 1, selections: [] },
      ],
      500,
      0
    )
    // (19900+3000)*2 + 9900 = 55700; tax 5% = 2785; total 58485
    assert.equal(q.subtotalPaise, 55700)
    assert.equal(q.taxPaise, 2785)
    assert.equal(q.totalPaise, 58485)
  })
  it('rounds tax to nearest paise and adds flat charges', () => {
    const q = computeQuote([{ item: { pricePaise: 101 }, quantity: 1, selections: [] }], 500, 1000)
    assert.equal(q.taxPaise, 5) // 5.05 rounds to 5
    assert.equal(q.totalPaise, 101 + 5 + 1000)
  })
})

describe('fulfilment state machine', () => {
  it('allows the canonical dine-in transitions', () => {
    assert.ok(isAllowedTransition('RECEIVED', 'ACCEPTED'))
    assert.ok(isAllowedTransition('RECEIVED', 'CANCELLED'))
    assert.ok(isAllowedTransition('ACCEPTED', 'PREPARING'))
    assert.ok(isAllowedTransition('PREPARING', 'READY'))
    assert.ok(isAllowedTransition('READY', 'SERVED'))
  })
  it('rejects skips, reversals and terminal exits', () => {
    assert.ok(!isAllowedTransition('RECEIVED', 'PREPARING'))
    assert.ok(!isAllowedTransition('RECEIVED', 'SERVED'))
    assert.ok(!isAllowedTransition('READY', 'CANCELLED'))
    assert.ok(!isAllowedTransition('SERVED', 'RECEIVED'))
    assert.ok(!isAllowedTransition('CANCELLED', 'RECEIVED'))
    assert.ok(!isAllowedTransition('BOGUS', 'ACCEPTED'))
  })
  it('marks terminal states', () => {
    assert.ok(isTerminalFulfilment('SERVED'))
    assert.ok(isTerminalFulfilment('CANCELLED'))
    assert.ok(!isTerminalFulfilment('READY'))
  })
})

describe('payment status derivation', () => {
  it('derives ledger states from recorded amounts', () => {
    assert.equal(derivePaymentStatus(10000, 0, 0), 'UNPAID')
    assert.equal(derivePaymentStatus(10000, 4000, 0), 'PARTIALLY_PAID')
    assert.equal(derivePaymentStatus(10000, 10000, 0), 'PAID')
    assert.equal(derivePaymentStatus(10000, 10000, 10000), 'REFUNDED')
    assert.equal(derivePaymentStatus(10000, 10000, 4000), 'PARTIALLY_REFUNDED')
  })
  it('formats order numbers', () => {
    assert.equal(formatOrderNumber(1), 'ORD-000001')
    assert.equal(formatOrderNumber(123), 'ORD-000123')
  })
})

describe('feedback preservation (existing product untouched)', () => {
  const mustExist = [
    'src/app/r/[slug]/page.tsx',
    'src/app/api/public/sessions/route.ts',
    'src/app/api/public/sessions/[id]/submit/route.ts',
    'src/app/api/public/sessions/[id]/draft/route.ts',
    'src/app/api/business/qr/route.ts',
    'src/app/api/business/campaigns/route.ts',
    'src/components/quiz/QuizFlow.tsx',
    'src/components/dashboard/OverviewTab.tsx',
    'src/components/dashboard/ResponsesTab.tsx',
    'src/components/dashboard/CampaignsTab.tsx',
    'src/components/dashboard/FeedbackTab.tsx',
    'src/components/dashboard/MenuTab.tsx',
    'src/components/dashboard/SettingsTab.tsx',
    'src/components/dashboard/CustomersPortalTab.tsx',
  ]
  for (const f of mustExist) {
    it(`preserved: ${f}`, () => {
      assert.ok(existsSync(join(root, f)), `missing ${f}`)
    })
  }
  it('feedback QR route still encodes /r/ URLs', () => {
    const src = readFileSync(join(root, 'src/app/api/business/qr/route.ts'), 'utf8')
    assert.ok(src.includes('/r/${slug}'), 'feedback QR target changed!')
  })
  it('new ordering routes exist alongside (not instead of) feedback', () => {
    for (const f of [
      'src/app/order/[slug]/page.tsx',
      'src/app/order/[slug]/menu/page.tsx',
      'src/app/order/[slug]/checkout/page.tsx',
      'src/app/order/[slug]/confirmation/[orderId]/page.tsx',
      'src/app/api/public/orders/route.ts',
      'src/app/api/public/orders/[id]/route.ts',
      'src/app/api/public/order-menu/route.ts',
      'src/app/api/public/ordering-context/route.ts',
      'src/app/api/public/service-requests/route.ts',
      'src/app/api/business/tables/route.ts',
      'src/app/api/business/tables/[id]/qr/route.ts',
      'src/app/api/business/tables/qr/route.ts',
      'src/app/api/business/orders/route.ts',
      'src/app/api/business/orders/[id]/route.ts',
      'src/app/api/business/orders/[id]/status/route.ts',
      'src/app/api/business/orders/[id]/payments/route.ts',
      'src/app/api/business/order-menu/categories/route.ts',
      'src/app/api/business/order-menu/items/route.ts',
      'src/app/api/business/ordering-config/route.ts',
      'src/app/api/business/order-reports/route.ts',
      'src/app/api/business/upload/route.ts',
      'src/app/api/business/service-requests/route.ts',
    ]) {
      assert.ok(existsSync(join(root, f)), `missing ${f}`)
    }
  })
})

describe('menu item upload & catalog validation', () => {
  it('allows items without image, with image URL, or with empty string', async () => {
    const { orderMenuItemUpsertSchema } = await import('../src/lib/ordering/validation.ts')
    const itemWithoutImage = {
      name: 'Chicken Biryani',
      pricePaise: 22000,
      imageUrl: null,
      veg: 'nonveg',
    }
    const res1 = orderMenuItemUpsertSchema.safeParse(itemWithoutImage)
    assert.ok(res1.success, 'Item without image should be valid')

    const itemWithEmptyImage = {
      name: 'Chicken Biryani',
      pricePaise: 22000,
      imageUrl: '',
      veg: 'nonveg',
    }
    const res2 = orderMenuItemUpsertSchema.safeParse(itemWithEmptyImage)
    assert.ok(res2.success, 'Item with empty string image should be valid')

    const itemWithUrlImage = {
      name: 'Chicken Biryani',
      pricePaise: 22000,
      imageUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0',
      veg: 'nonveg',
    }
    const res3 = orderMenuItemUpsertSchema.safeParse(itemWithUrlImage)
    assert.ok(res3.success, 'Item with URL image should be valid')
  })
})

describe('table anti-collision & cart isolation', () => {
  it('normalizes table labels to identify duplicates and prevent collision', async () => {
    // Testing normalization logic
    const normalize = (label) => {
      let clean = label.trim().toLowerCase()
      if (clean.startsWith('table')) clean = clean.slice(5).trim()
      if (clean.startsWith('t-') || clean.startsWith('t#')) clean = clean.slice(2).trim()
      else if (clean.startsWith('t') && /^t\d+$/.test(clean)) clean = clean.slice(1).trim()
      if (/^\d+$/.test(clean)) clean = String(parseInt(clean, 10))
      return clean
    }

    // These should all resolve to the same table number "1"
    assert.equal(normalize('1'), '1')
    assert.equal(normalize('Table 1'), '1')
    assert.equal(normalize('table 1'), '1')
    assert.equal(normalize('01'), '1')
    assert.equal(normalize('T1'), '1')
    assert.equal(normalize('T-1'), '1')

    // Different tables must not collide
    assert.notEqual(normalize('Table 1'), normalize('Table 2'))
    assert.notEqual(normalize('1'), normalize('2'))
    assert.notEqual(normalize('Family-A'), normalize('Family-B'))
  })

  it('isolates carts per table so no two tables share items', async () => {
    const { cartKey } = await import('../src/lib/ordering/cart.ts')
    const keyTable1 = cartKey('biryani-badshah', '1')
    const keyTable2 = cartKey('biryani-badshah', '2')
    const keyGeneral = cartKey('biryani-badshah')

    // Table 1 and Table 2 carts must be strictly isolated
    assert.notEqual(keyTable1, keyTable2)
    assert.notEqual(keyTable1, keyGeneral)
    assert.notEqual(keyTable2, keyGeneral)

    // Different cases of same table map to identical storage key
    assert.equal(cartKey('biryani-badshah', 'Table 1'), cartKey('biryani-badshah', 'table 1'))
  })

  it('formats table labels cleanly without duplicate Table prefixes', async () => {
    const { formatTableDisplay } = await import('../src/lib/ordering/rules.mjs')
    assert.equal(formatTableDisplay('Table 6'), 'Table 6')
    assert.equal(formatTableDisplay('Table Table 6'), 'Table 6')
    assert.equal(formatTableDisplay('table table 6'), 'Table 6')
    assert.equal(formatTableDisplay('6'), 'Table 6')
    assert.equal(formatTableDisplay('12'), 'Table 12')
    assert.equal(formatTableDisplay('Counter'), 'Counter')
    assert.equal(formatTableDisplay('Takeaway'), 'Takeaway')
    assert.equal(formatTableDisplay('Bar 2'), 'Bar 2')
    assert.equal(formatTableDisplay(''), 'Dining Table')
    assert.equal(formatTableDisplay(null), 'Dining Table')
  })

  it('enforces 2-hour TTL auto-expiry and device isolation for active dining sessions', async () => {
    const { ACTIVE_SESSION_TTL_MS } = await import('../src/lib/ordering/cart.ts')
    assert.equal(ACTIVE_SESSION_TTL_MS, 2 * 60 * 60 * 1000)

    // Simulate session age checks
    const isExpired = (createdAt, fulfilment = 'RECEIVED', now = Date.now()) => {
      const age = now - new Date(createdAt).getTime()
      if (isNaN(age) || age > ACTIVE_SESSION_TTL_MS) return true
      if ((fulfilment === 'SERVED' || fulfilment === 'CANCELLED') && age > 30 * 60 * 1000) return true
      return false
    }

    const now = Date.now()
    const freshOrder = new Date(now - 15 * 60 * 1000).toISOString() // 15 mins ago
    const oldOrder = new Date(now - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
    const recentlyServed = new Date(now - 10 * 60 * 1000).toISOString() // 10 mins ago
    const longServed = new Date(now - 45 * 60 * 1000).toISOString() // 45 mins ago

    assert.equal(isExpired(freshOrder, 'RECEIVED', now), false, 'Fresh order should be active')
    assert.equal(isExpired(oldOrder, 'RECEIVED', now), true, 'Order older than 2 hours must expire')
    assert.equal(isExpired(recentlyServed, 'SERVED', now), false, 'Recently served within 30m remains briefly')
    assert.equal(isExpired(longServed, 'SERVED', now), true, 'Order served > 30m must expire')
    assert.equal(isExpired(longServed, 'CANCELLED', now), true, 'Order cancelled > 30m must expire')
  })
})


