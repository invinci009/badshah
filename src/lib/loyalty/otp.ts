import 'server-only'

// ==============================================================================
// OTP delivery. Uses an HTTP SMS provider when credentials are configured;
// otherwise falls back to sandbox mode (code surfaced to the client with a
// `sandbox: true` flag) so sign-up still works before an SMS account is wired.
// ==============================================================================

export interface OtpSendResult {
  delivered: boolean
  channel: 'sms' | 'sandbox'
}

export interface SmsProviderConfig {
  apiBase: string
  apiKey: string
  senderId: string
}

export function getSmsProviderConfig(): SmsProviderConfig | null {
  const apiBase = process.env.OTP_SMS_API_BASE
  const apiKey = process.env.OTP_SMS_API_KEY
  const senderId = process.env.OTP_SMS_SENDER_ID
  if (!apiBase || !apiKey || !senderId) return null
  return { apiBase, apiKey, senderId }
}

export async function sendOtpSms(phone: string, code: string): Promise<OtpSendResult> {
  const provider = getSmsProviderConfig()
  if (provider) {
    try {
      // Generic Msg91/Enquirybox-style GET API. Providers differ, but this
      // shape covers the common Indian SMS gateways; adjust apiBase template
      // per client if their gateway differs.
      const url = provider.apiBase
        .replace('{PHONE}', encodeURIComponent(phone))
        .replace('{CODE}', encodeURIComponent(code))
        .replace('{SENDER}', encodeURIComponent(provider.senderId))
      const res = await fetch(url, {
        headers: { Authorization: provider.apiKey },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        console.error(`[Loyalty OTP] SMS provider responded ${res.status} for +91${phone.slice(0, 3)}***`)
        return { delivered: false, channel: 'sandbox' }
      }
      return { delivered: true, channel: 'sms' }
    } catch (err) {
      console.error('[Loyalty OTP] SMS provider request failed:', err)
      return { delivered: false, channel: 'sandbox' }
    }
  }
  // Sandbox mode (no provider configured). Never log the full code + phone pair
  // in production; here we log only that sandbox mode was used.
  console.warn('[Loyalty OTP] No OTP_SMS_* provider configured — running in sandbox mode (code returned to client).')
  return { delivered: false, channel: 'sandbox' }
}
