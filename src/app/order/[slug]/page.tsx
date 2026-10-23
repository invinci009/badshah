import { redirect } from 'next/navigation'
import { Phone, AlertTriangle } from 'lucide-react'
import { getCampaignBySlug } from '@/lib/firebase/firestore'
import { resolveTableToken, getOrderingConfig } from '@/lib/firebase/ordering'
import { hashToken } from '@/lib/ordering/tokens'
import { getRestaurantConfig } from '@/config/loader'

interface PortalPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string; table?: string }>
}

export default async function OrderPortalPage({ params, searchParams }: PortalPageProps) {
  const { slug } = await params
  const { token, table: tableParam } = await searchParams
  const config = getRestaurantConfig()

  const campaign = await getCampaignBySlug(slug).catch(() => null)

  const fallbackCard = (title: string, body: string, tone: 'amber' | 'rose' = 'amber') => (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
        <div
          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
            tone === 'amber'
              ? 'bg-amber-50 border border-amber-200 text-amber-600'
              : 'bg-rose-50 border border-rose-200 text-rose-600'
          }`}
        >
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-extrabold text-stone-900">{title}</h1>
        <p className="text-sm text-stone-500 leading-relaxed">{body}</p>
        {config.contact.phone && (
          <a
            href={`tel:${config.contact.phone}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> Call: {config.contact.phone}
          </a>
        )}
      </div>
    </div>
  )

  if (!campaign) {
    return fallbackCard(
      'Ordering Link Not Found',
      `This ordering code is not valid. Please ask the staff at ${config.name} for assistance.`,
      'rose'
    )
  }
  if (!campaign.active) {
    return fallbackCard(
      'Ordering Paused',
      `Ordering is currently paused for this link by ${config.name}. Please check with the staff.`
    )
  }

  let tableLabel: string | null = null
  if (token) {
    const resolved = await resolveTableToken(hashToken(token)).catch(() => null)
    if (!resolved && !tableParam) {
      return fallbackCard(
        'Table Code Expired',
        'This table QR is invalid or has been revoked. Please ask the staff for a fresh code.',
        'rose'
      )
    }
    if (resolved) {
      tableLabel = resolved.table.label
    }
  }

  // If table parameter is passed (e.g. ?table=3 or ?table=Table-3), resolve it
  if (!tableLabel && tableParam) {
    tableLabel = tableParam.replace(/^table\s*[-_]?/i, '').trim() || tableParam.trim()
  }

  // If neither token nor table is present, verify general ordering is enabled
  if (!token && !tableParam) {
    const ordering = await getOrderingConfig().catch(() => null)
    if (ordering && !ordering.generalOrderingEnabled) {
      return fallbackCard(
        'Scan Your Table QR',
        'Please scan the QR code placed at your table to start ordering.',
        'rose'
      )
    }
  }

  // Unified single portal: redirect straight to menu with table & token preserved
  const menuQuery = new URLSearchParams()
  if (token) menuQuery.set('token', token)
  if (tableLabel) menuQuery.set('table', tableLabel)
  else if (tableParam) menuQuery.set('table', tableParam)
  const qs = menuQuery.toString() ? `?${menuQuery.toString()}` : ''

  redirect(`/order/${slug}/menu${qs}`)
}

