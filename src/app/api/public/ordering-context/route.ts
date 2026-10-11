import { NextRequest, NextResponse } from 'next/server'
import { getCampaignBySlug, getRestaurantSettings } from '@/lib/firebase/firestore'
import { resolveTableToken } from '@/lib/firebase/ordering'
import { hashToken } from '@/lib/ordering/tokens'
import { getOrderingConfig } from '@/lib/firebase/ordering'
import { getRestaurantConfig } from '@/config/loader'

// GET /api/public/ordering-context?slug=...&token=...
// Public, minimal data: branding + table label + feedback URL + flags.
// The token (if supplied) is validated server-side; invalid/revoked tokens
// are rejected. No prices, no phones, no secrets.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || ''
    const token = searchParams.get('token')

    const config = getRestaurantConfig()
    const campaign = await getCampaignBySlug(slug).catch(() => null)
    if (!campaign) return NextResponse.json({ error: 'Ordering link not found' }, { status: 404 })
    if (!campaign.active) return NextResponse.json({ error: 'Ordering is paused for this link' }, { status: 410 })

    let table: { id: string; label: string } | null = null
    if (token) {
      const resolved = await resolveTableToken(hashToken(token))
      if (!resolved) {
        return NextResponse.json(
          { error: 'This table QR is invalid or has been revoked. Please ask staff for a fresh code.' },
          { status: 410 }
        )
      }
      table = { id: resolved.table.id, label: resolved.table.label }
    } else {
      const ordering = await getOrderingConfig().catch(() => null)
      if (ordering && !ordering.generalOrderingEnabled) {
        return NextResponse.json(
          { error: 'Please scan the QR at your table to order.' },
          { status: 403 }
        )
      }
    }

    const settings = await getRestaurantSettings().catch(() => null)
    return NextResponse.json(
      {
        restaurantName: settings?.name || config.name,
        logoUrl: settings?.branding?.logoUrl || config.branding.logoUrl || null,
        primaryColor: settings?.branding?.primaryColor || config.branding.primaryColor,
        contactPhone: settings?.contact?.phone || config.contact.phone || null,
        welcomeMessage: settings?.welcomeMessage || config.welcomeMessage,
        feedbackSlug: campaign.slug,
        table,
        hasTableContext: Boolean(table),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Ordering context error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
