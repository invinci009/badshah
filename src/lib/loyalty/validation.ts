import { z } from 'zod'

// ==============================================================================
// Loyalty request validation (shared client/server). Money in integer paise.
// ==============================================================================

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d+\S*$/, 'Enter a valid mobile number')
  .min(10)
  .max(17)

export const loyaltyPhoneLoginSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().max(80).optional(),
})

export const loyaltySignupSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(1, 'Name is required').max(80),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional(),
})

export const loyaltyLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(128).optional(),
})

export const loyaltyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
})

export const loyaltyResendSchema = z.object({ phone: phoneSchema })

export const rewardUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  type: z.enum(['FREE_ITEM', 'FIXED_DISCOUNT', 'PERCENT_DISCOUNT', 'CUSTOM']),
  pointsCost: z.number().int().min(1, 'Points cost must be at least 1').max(1000000),
  discountPaise: z.number().int().min(0).max(100000000).optional(),
  discountPctBps: z.number().int().min(0).max(10000).optional(),
  discountMaxPaise: z.number().int().min(0).max(100000000).optional(),
  minOrderPaise: z.number().int().min(0).max(100000000).optional(),
  applicableItemIds: z.array(z.string().min(1).max(80)).max(50).optional(),
  active: z.boolean().optional(),
  stock: z.number().int().min(0).max(1000000).nullable().optional(),
  startAt: z.string().max(40).nullable().optional(),
  endAt: z.string().max(40).nullable().optional(),
  maxPerCustomer: z.number().int().min(1).max(100000).nullable().optional(),
})

export const loyaltyConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  pointsPerOrder: z.number().int().min(0).max(100000).optional(),
  minOrderPaise: z.number().int().min(0).max(100000000).optional(),
  expiryEnabled: z.boolean().optional(),
  expiryDays: z.number().int().min(1).max(36500).optional(),
  maxRedemptionsPerOrder: z.number().int().min(0).max(10).optional(),
  refundPolicy: z.enum(['REVERSE', 'KEEP']).optional(),
})

export const loyaltyAdjustSchema = z.object({
  phone: phoneSchema,
  points: z
    .number()
    .int()
    .min(-1000000, 'Adjustment is too large')
    .max(1000000, 'Adjustment is too large')
    .refine((v) => v !== 0, 'Adjustment cannot be zero'),
  reason: z.string().trim().min(3, 'A reason is required for point adjustments').max(300),
})

export const loyaltyCustomerStatusSchema = z.object({
  phone: phoneSchema,
  status: z.enum(['active', 'suspended']),
})

export const redemptionActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['CANCEL_RESTORE']),
  reason: z.string().trim().max(300).optional(),
})
