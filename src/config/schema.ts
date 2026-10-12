import { z } from 'zod'

// ==============================================================================
// ReviewPulse — Restaurant Configuration Schema
// ==============================================================================
// Strongly typed configuration schema for white-label deployments.
// Each client repository provides its own config.json matching this schema.
// ==============================================================================

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #d97706)')

const googleReviewUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const { hostname, protocol } = new URL(url)
        const allowed = [
          'google.com',
          'www.google.com',
          'search.google.com',
          'g.page',
          'maps.app.goo.gl',
          'goo.gl',
        ]
        return (
          protocol === 'https:' &&
          allowed.some((a) => hostname === a || hostname.endsWith('.' + a))
        )
      } catch {
        return false
      }
    },
    { message: 'Must be a valid Google review URL (https)' }
  )

// ==============================================================================
// Configuration Schema
// ==============================================================================

export const restaurantConfigSchema = z.object({
  // Core identity
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),

  // Contact information
  contact: z.object({
    phone: z.string().max(50).optional(),
    helpline: z.string().max(50).optional(),
    email: z.string().email().optional(),
  }),

  // Location
  location: z.object({
    address: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
  }),

  // Google review configuration
  google: z.object({
    reviewUrl: googleReviewUrlSchema,
  }),

  // Branding
  branding: z.object({
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    primaryColor: hexColorSchema,
    secondaryColor: hexColorSchema,
    accentColor: hexColorSchema.optional(),
  }),

  // Feature flags
  features: z.object({
    aiReviews: z.boolean().default(true),
    privateFeedback: z.boolean().default(true),
    crm: z.boolean().default(true),
    campaignAnalytics: z.boolean().default(true),
    menuManagement: z.boolean().default(true),
    weeklyReports: z.boolean().optional(),
    customerRecovery: z.boolean().optional(),
  }),

  // Localization
  settings: z.object({
    defaultLanguage: z.string().default('en'),
    supportedLanguages: z.array(z.string()).default(['en']),
    timezone: z.string().default('Asia/Kolkata'),
  }),

  // Welcome message (i18n)
  welcomeMessage: z.record(z.string(), z.string()).default({
    en: "Thanks for dining with us! We'd love to hear about your experience today.",
  }),
})

export type RestaurantConfig = z.infer<typeof restaurantConfigSchema>

// ==============================================================================
// Validation helper
// ==============================================================================

export function validateRestaurantConfig(data: unknown): {
  success: boolean
  data?: RestaurantConfig
  errors?: z.ZodError
} {
  const result = restaurantConfigSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: result.error }
}
