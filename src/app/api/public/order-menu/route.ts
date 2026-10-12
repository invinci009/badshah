import { NextRequest, NextResponse } from 'next/server'
import { getCampaignBySlug, getRestaurantSettings } from '@/lib/firebase/firestore'
import {
  getOrderMenuCategories,
  getOrderMenuItems,
  getOrderingConfig,
  resolveTableToken,
  getTables,
  normalizeTableLabel,
} from '@/lib/firebase/ordering'
import { hashToken } from '@/lib/ordering/tokens'
import { getRestaurantConfig } from '@/config/loader'
import { normalizeImageUrl } from '@/lib/ordering/validation'

// GET /api/public/order-menu?slug=...&token=...
// Public menu: only visible items (availability flagged for sold-out labels).
// Prices here are authoritative; checkout revalidates server-side.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || ''
    const token = searchParams.get('token')

    const config = getRestaurantConfig()
    const campaign = await getCampaignBySlug(slug).catch(() => null)
    if (!campaign || !campaign.active) {
      return NextResponse.json({ error: 'Ordering is not available for this link' }, { status: 404 })
    }

    const tableParam = searchParams.get('table')
    let table: { id: string; label: string; state?: string } | null = null
    if (token) {
      const resolved = await resolveTableToken(hashToken(token))
      if (!resolved && !tableParam) return NextResponse.json({ error: 'Table code expired or revoked' }, { status: 410 })
      if (resolved) {
        table = { id: resolved.table.id, label: resolved.table.label, state: resolved.table.state || 'available' }
      }
    }
    if (!table && tableParam) {
      const allTables = await getTables(true).catch(() => [])
      const matched = allTables.find((t) => normalizeTableLabel(t.label) === normalizeTableLabel(tableParam))
      if (matched) {
        if (!matched.active) {
          return NextResponse.json({ error: `Table "${matched.label}" is currently inactive.` }, { status: 403 })
        }
        table = { id: matched.id, label: matched.label, state: matched.state || 'available' }
      } else {
        table = { id: tableParam, label: tableParam, state: 'available' }
      }
    }
    if (!table && !token) {
      const ordering = await getOrderingConfig().catch(() => null)
      if (ordering && !ordering.generalOrderingEnabled) {
        return NextResponse.json({ error: 'Please scan your table QR to order' }, { status: 403 })
      }
    }

    const [categories, items, ordering, settings, diningTables] = await Promise.all([
      getOrderMenuCategories().catch(() => []),
      getOrderMenuItems().catch(() => []),
      getOrderingConfig().catch(() => ({ taxRateBps: 500, serviceChargePaise: 0, currency: 'INR' as const })),
      getRestaurantSettings().catch(() => null),
      getTables(true).catch(() => []),
    ])

    return NextResponse.json(
      {
        restaurantName: settings?.name || config.name,
        logoUrl: settings?.branding?.logoUrl || config.branding.logoUrl || null,
        contactPhone: settings?.contact?.phone || config.contact.phone || null,
        table,
        tables: diningTables.filter((t) => t.active).map((t) => ({
          id: t.id,
          label: t.label,
          state: t.state || 'available',
        })),
        taxRateBps: ordering.taxRateBps,
        serviceChargePaise: ordering.serviceChargePaise,
        currency: 'INR',
        categories: categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name, position: c.position })),
        items: items
          .filter((i) => i.visible)
          .map((i) => ({
            id: i.id,
            categoryId: i.categoryId,
            name: i.name,
            description: i.description || null,
            imageUrl: normalizeImageUrl(i.imageUrl),
            pricePaise: i.pricePaise,
            available: i.available,
            veg: i.veg,
            featured: i.featured,
            position: i.position,
            options: i.options || [],
          })),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    console.error('Public order-menu error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
