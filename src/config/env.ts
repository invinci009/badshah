import { z } from 'zod'

// ==============================================================================
// Strongly typed environment configuration schema and loader
// ==============================================================================

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Public App URL
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default('http://localhost:3000'),

  // Secrets & Hashes
  SESSION_COOKIE_SECRET: z.string().min(16).default('default-dev-secret-32-chars-long-reviewpulse!'),
  CUSTOMER_SESSION_SECRET: z.string().optional(),
  HASH_SALT: z.string().default('default-dev-salt-replace-in-production'),

  // Firebase Admin
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),

  // Firebase Client
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),

  // Redis / Upstash
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Alerts & Push notifications
  ORDER_ALERT_TOPIC: z.string().default('badshah-restaurant-orders'),

  // AI & Analytics
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
  ANTHROPIC_API_KEY: z.string().optional(),

  // SMS OTP Provider
  OTP_SMS_API_BASE: z.string().url().optional(),
  OTP_SMS_API_KEY: z.string().optional(),
  OTP_SMS_SENDER_ID: z.string().optional(),
})

export type ServerEnv = z.infer<typeof envSchema>

let cachedEnv: ServerEnv | null = null

export function getEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Environment configuration validation failed:', parsed.error.format())
    // Fall back to defaults in dev/test to avoid crashing
    cachedEnv = envSchema.parse({})
    return cachedEnv
  }

  cachedEnv = parsed.data
  return cachedEnv
}
