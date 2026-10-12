import { z } from 'zod'

// ==============================================================================
// Ordering request validation (shared client/server).
// Money: integer paise. Phone: format-only, never "verified".
// ==============================================================================

const phoneRegex = /^[6-9]\d{9}$/

/** Raw phone input; server normalizes (+91/91/0 prefixes, spaces, dashes). */
export const phoneInputSchema = z.string().min(10).max(17)

export function normalizePhoneServerSide(raw: string): string | null {
  const digitsOnly = raw.replace(/\D/g, '')
  let digits = digitsOnly
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3)
  if (!phoneRegex.test(digits)) return null
  return digits
}

// --- Tables ---

export const tableCreateSchema = z.object({
  label: z.string().min(1).max(40),
  description: z.string().max(200).optional(),
})

export const tablePatchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(40).optional(),
  description: z.string().max(200).nullable().optional(),
  active: z.boolean().optional(),
  state: z.enum(['available', 'occupied', 'cleaning']).optional(),
})

// --- Order menu ---

export const categoryUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(80),
  position: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
})

const customizationChoiceSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  pricePaise: z.number().int().min(0).max(10000000),
})

const customizationGroupSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  type: z.enum(['single', 'multi']),
  required: z.boolean().default(false),
  min: z.number().int().min(0).max(20).default(0),
  max: z.number().int().min(1).max(20).default(1),
  choices: customizationChoiceSchema.array().min(1).max(30),
})

/**
 * Convert Google Drive share links, Dropbox, and cloud storage URLs into direct image stream URLs.
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  // Google Drive file link: /file/d/{id}/... or ?id={id}
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveFileMatch && driveFileMatch[1]) {
    return `/api/public/image-proxy?id=${driveFileMatch[1]}`
  }

  const driveIdMatch = trimmed.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/)
  if (driveIdMatch && driveIdMatch[1]) {
    return `/api/public/image-proxy?id=${driveIdMatch[1]}`
  }

  // Existing lh3.googleusercontent.com links
  const lh3Match = trimmed.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/)
  if (lh3Match && lh3Match[1]) {
    return `/api/public/image-proxy?id=${lh3Match[1]}`
  }

  // Dropbox share links: replace dl=0 with raw=1 for direct image delivery
  if (trimmed.includes('dropbox.com') && trimmed.includes('dl=0')) {
    return trimmed.replace('dl=0', 'raw=1')
  }

  return trimmed
}

export const orderMenuItemUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  imageUrl: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .transform((val) => normalizeImageUrl(val)),
  pricePaise: z.number().int().min(0).max(10000000),
  available: z.boolean().optional(),
  visible: z.boolean().optional(),
  veg: z.enum(['veg', 'nonveg', 'egg', 'none']).optional(),
  featured: z.boolean().optional(),
  position: z.number().int().min(0).max(10000).optional(),
  feedbackMenuItemId: z.string().min(1).nullable().optional(),
  options: customizationGroupSchema.array().max(10).optional(),
})

export const orderingConfigSchema = z.object({
  taxRateBps: z.number().int().min(0).max(3000),
  serviceChargePaise: z.number().int().min(0).max(1000000),
  generalOrderingEnabled: z.boolean(),
})

// --- Public order creation ---

const orderLineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  selections: z
    .array(
      z.object({
        groupId: z.string().min(1),
        optionId: z.string().min(1),
      })
    )
    .max(40)
    .default([]),
})

export const orderCreateSchema = z.object({
  slug: z.string().min(1).max(40),
  tableToken: z.string().min(1).max(200).nullable().optional(),
  tableLabel: z.string().max(40).optional(),
  customerName: z.string().min(1).max(100),
  customerPhone: phoneInputSchema,
  notes: z.string().max(280).optional(),
  idempotencyKey: z.string().uuid(),
  clientTotalPaise: z.number().int().min(0).max(100000000).optional(),
  confirmUpdatedTotal: z.boolean().optional(),
  existingOrderId: z.string().min(1).max(100).optional(),
  activeOrderAccessToken: z.string().min(1).max(200).optional(),
  items: orderLineSchema.array().min(1).max(30),
})

// --- Admin ---

export const orderStatusPatchSchema = z.object({
  to: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']),
  reason: z.string().max(300).optional(),
})

export const paymentRecordSchema = z.object({
  kind: z.enum(['collection', 'refund']),
  amountPaise: z.number().int().min(1).max(100000000),
  method: z.enum(['CASH', 'UPI_COUNTER', 'CARD_COUNTER', 'OTHER']),
  reference: z.string().max(200).optional(),
})

export const serviceRequestSchema = z
  .object({
    slug: z.string().min(1).max(40),
    tableToken: z.string().min(1).max(200).nullable().optional(),
    tableLabel: z.string().min(1).max(40).nullable().optional(),
    type: z.enum(['water', 'bill', 'assistance', 'cleaning', 'other']),
    note: z.string().max(280).optional(),
  })
  .refine((data) => Boolean(data.tableToken || data.tableLabel), {
    message: 'Either tableToken or tableLabel must be provided',
  })

export const serviceRequestPatchSchema = z.object({
  status: z.enum(['ACK', 'RESOLVED', 'CANCELLED']),
})
