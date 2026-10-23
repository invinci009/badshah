import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import {
  loyaltySignupSchema,
  loyaltyLoginSchema,
  loyaltyOtpSchema,
  loyaltyAdjustSchema,
  rewardUpsertSchema,
  loyaltyConfigPatchSchema,
} from '../src/lib/loyalty/validation.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('loyalty validation schemas', () => {
  it('validates signup with Indian phone, name, and 6+ char password', () => {
    const valid = loyaltySignupSchema.safeParse({
      phone: '9876543210',
      name: 'Aman Kumar',
      password: 'mypassword123',
    })
    assert.equal(valid.success, true)

    const invalidShortPass = loyaltySignupSchema.safeParse({
      phone: '9876543210',
      name: 'Aman Kumar',
      password: '123',
    })
    assert.equal(invalidShortPass.success, false)

    const invalidPhone = loyaltySignupSchema.safeParse({
      phone: '123',
      name: 'Aman Kumar',
      password: 'mypassword123',
    })
    assert.equal(invalidPhone.success, false)
  })

  it('validates 6-digit verification OTP', () => {
    assert.equal(loyaltyOtpSchema.safeParse({ phone: '9876543210', code: '654321' }).success, true)
    assert.equal(loyaltyOtpSchema.safeParse({ phone: '9876543210', code: '12345' }).success, false)
    assert.equal(loyaltyOtpSchema.safeParse({ phone: '9876543210', code: 'abcdef' }).success, false)
  })

  it('validates manual point adjustment (rejects zero, requires min 3 char reason)', () => {
    assert.equal(
      loyaltyAdjustSchema.safeParse({ phone: '9876543210', points: 50, reason: 'Feedback reward' }).success,
      true
    )
    assert.equal(
      loyaltyAdjustSchema.safeParse({ phone: '9876543210', points: -25, reason: 'Correction deduction' }).success,
      true
    )
    // Zero points rejected
    assert.equal(
      loyaltyAdjustSchema.safeParse({ phone: '9876543210', points: 0, reason: 'No change' }).success,
      false
    )
    // Reason too short (< 3 chars) rejected
    assert.equal(
      loyaltyAdjustSchema.safeParse({ phone: '9876543210', points: 10, reason: 'ok' }).success,
      false
    )
  })

  it('validates reward upsert schema for all types', () => {
    const fixedReward = {
      name: '₹50 Off Your Biryani',
      type: 'FIXED_DISCOUNT',
      pointsCost: 100,
      discountPaise: 5000,
      minOrderPaise: 25000,
    }
    assert.equal(rewardUpsertSchema.safeParse(fixedReward).success, true)

    const pctReward = {
      name: '15% Off Your Meal',
      type: 'PERCENT_DISCOUNT',
      pointsCost: 150,
      discountPctBps: 1500,
      discountMaxPaise: 10000,
      minOrderPaise: 0,
    }
    assert.equal(rewardUpsertSchema.safeParse(pctReward).success, true)

    const freeItem = {
      name: 'Free Shahi Gulab Jamun',
      type: 'FREE_ITEM',
      pointsCost: 80,
      discountPaise: 6000,
      minOrderPaise: 20000,
    }
    assert.equal(rewardUpsertSchema.safeParse(freeItem).success, true)
  })

  it('validates loyalty config patches', () => {
    assert.equal(
      loyaltyConfigPatchSchema.safeParse({ enabled: true, pointsPerOrder: 25, refundPolicy: 'REVERSE' }).success,
      true
    )
    assert.equal(
      loyaltyConfigPatchSchema.safeParse({ expiryEnabled: true, expiryDays: 90 }).success,
      true
    )
  })
})

describe('loyalty business logic rules', () => {
  it('computes capped and uncapped discounts correctly', () => {
    const computeRewardDiscount = (reward, subtotalPaise) => {
      if (reward.type === 'FIXED_DISCOUNT' || reward.type === 'FREE_ITEM') {
        return Math.min(reward.discountPaise, subtotalPaise)
      }
      if (reward.type === 'PERCENT_DISCOUNT') {
        const raw = Math.round((subtotalPaise * reward.discountPctBps) / 10000)
        const capped = reward.discountMaxPaise > 0 ? Math.min(raw, reward.discountMaxPaise) : raw
        return Math.min(capped, subtotalPaise)
      }
      return 0
    }

    // Fixed discount ₹50 on ₹100 order -> ₹50 (5000 paise)
    assert.equal(computeRewardDiscount({ type: 'FIXED_DISCOUNT', discountPaise: 5000 }, 10000), 5000)
    // Fixed discount ₹50 on ₹30 order -> capped at ₹30 (3000 paise)
    assert.equal(computeRewardDiscount({ type: 'FIXED_DISCOUNT', discountPaise: 5000 }, 3000), 3000)

    // 20% discount on ₹500 with ₹60 cap -> ₹60 (6000 paise)
    assert.equal(
      computeRewardDiscount({ type: 'PERCENT_DISCOUNT', discountPctBps: 2000, discountMaxPaise: 6000 }, 50000),
      6000
    )
    // 20% discount on ₹200 with ₹60 cap -> ₹40 (4000 paise, under cap)
    assert.equal(
      computeRewardDiscount({ type: 'PERCENT_DISCOUNT', discountPctBps: 2000, discountMaxPaise: 6000 }, 20000),
      4000
    )
    // Custom rewards have no direct money discount
    assert.equal(computeRewardDiscount({ type: 'CUSTOM', discountPaise: 0 }, 50000), 0)
  })

  it('normalizes Indian customer phone reliably', () => {
    const normalizeCustomerPhone = (raw) => {
      const digits = String(raw).replace(/\D/g, '')
      let d = digits
      if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
      if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
      if (d.length === 13 && d.startsWith('091')) d = d.slice(3)
      if (!/^[6-9]\d{9}$/.test(d)) return null
      return d
    }

    assert.equal(normalizeCustomerPhone('9876543210'), '9876543210')
    assert.equal(normalizeCustomerPhone('+91 98765 43210'), '9876543210')
    assert.equal(normalizeCustomerPhone('919876543210'), '9876543210')
    assert.equal(normalizeCustomerPhone('09876543210'), '9876543210')
    assert.equal(normalizeCustomerPhone('+91-88765-43210'), '8876543210')
    assert.equal(normalizeCustomerPhone('5876543210'), null)
    assert.equal(normalizeCustomerPhone('12345'), null)
  })
})

describe('loyalty routes and components preservation', () => {
  const routes = [
    'src/app/api/public/loyalty/auth/route.ts',
    'src/app/api/public/loyalty/summary/route.ts',
    'src/app/api/public/loyalty/rewards/route.ts',
    'src/app/api/public/loyalty/claim/route.ts',
    'src/app/api/business/loyalty/config/route.ts',
    'src/app/api/business/loyalty/rewards/route.ts',
    'src/app/api/business/loyalty/customers/route.ts',
    'src/app/api/business/loyalty/customers/[phone]/route.ts',
    'src/app/api/business/loyalty/redemptions/route.ts',
    'src/app/api/business/loyalty/analytics/route.ts',
    'src/app/order/[slug]/loyalty/page.tsx',
    'src/components/dashboard/LoyaltyTab.tsx',
    'src/lib/firebase/loyalty.ts',
    'src/lib/loyalty/session.ts',
    'src/lib/loyalty/otp.ts',
    'src/lib/loyalty/validation.ts',
  ]

  for (const rel of routes) {
    it(`preserves required loyalty file: ${rel}`, () => {
      const full = join(root, rel)
      assert.ok(existsSync(full), `File ${rel} must exist`)
      const content = readFileSync(full, 'utf8')
      assert.ok(content.length > 50, `File ${rel} must not be empty`)
    })
  }

  it('retroactive claim route exports POST handler', () => {
    const claimPath = join(root, 'src/app/api/public/loyalty/claim/route.ts')
    const content = readFileSync(claimPath, 'utf8')
    assert.ok(content.includes('export async function POST'), 'Claim route must export POST handler')
    assert.ok(content.includes('awardOrderPoints'), 'Claim route must invoke awardOrderPoints')
    assert.ok(content.includes('normalizeCustomerPhone'), 'Claim route must check phone normalization')
  })

  it('loyalty hub page contains Badshah VIP card and activity tabs', () => {
    const hubPath = join(root, 'src/app/order/[slug]/loyalty/page.tsx')
    const content = readFileSync(hubPath, 'utf8')
    assert.ok(content.includes('Badshah VIP Club') || content.includes('Badshah VIP Member'), 'VIP club branding must be present')
    assert.ok(content.includes('handleClaimPoints'), 'Direct points claim must be supported')
    assert.ok(content.includes('tier'), 'VIP member tier progression must be present')
    assert.ok(content.includes('historyTab'), 'Activity history tabs must be present')
  })
})
