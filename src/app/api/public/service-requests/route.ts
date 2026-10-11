import { NextRequest, NextResponse } from 'next/server'
import {
  resolveTableToken,
  createServiceRequest,
  getTables,
  normalizeTableLabel,
} from '@/lib/firebase/ordering'
import { hashToken } from '@/lib/ordering/tokens'
import { serviceRequestSchema } from '@/lib/ordering/validation'
import { getCampaignBySlug } from '@/lib/firebase/firestore'

// POST /api/public/service-requests — customer calls staff (water/bill/etc).
// Supports table token or verified table label.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = serviceRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const campaign = await getCampaignBySlug(parsed.data.slug).catch(() => null)
    if (!campaign || !campaign.active) {
      return NextResponse.json({ error: 'Service is not available for this link' }, { status: 404 })
    }

    let tableId: string | null = null
    let tableLabel: string | null = null

    if (parsed.data.tableToken) {
      const resolved = await resolveTableToken(hashToken(parsed.data.tableToken))
      if (resolved) {
        tableId = resolved.table.id
        tableLabel = resolved.table.label
      } else if (!parsed.data.tableLabel) {
        return NextResponse.json({ error: 'Table code expired or revoked' }, { status: 410 })
      }
    }

    if (!tableId && parsed.data.tableLabel) {
      const allTables = await getTables(true).catch(() => [])
      const matched = allTables.find(
        (t) => normalizeTableLabel(t.label) === normalizeTableLabel(parsed.data.tableLabel!)
      )
      if (matched) {
        tableId = matched.id
        tableLabel = matched.label
      } else {
        tableLabel = parsed.data.tableLabel.trim()
      }
    }

    if (!tableLabel) {
      return NextResponse.json({ error: 'Please specify your table' }, { status: 400 })
    }

    const req = await createServiceRequest({
      tableId: tableId || 'unassigned',
      tableLabel,
      type: parsed.data.type,
      note: parsed.data.note,
    })
    return NextResponse.json({ id: req.id, status: req.status }, { status: 201 })
  } catch (error) {
    console.error('Service request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
