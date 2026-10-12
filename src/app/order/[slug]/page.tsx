import Link from 'next/link'
import {
  UtensilsCrossed,
  MessageSquareHeart,
  MapPin,
  Phone,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Star,
  ExternalLink,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { getCampaignBySlug, getRestaurantSettings } from '@/lib/firebase/firestore'
import { resolveTableToken, getOrderingConfig, getTables } from '@/lib/firebase/ordering'
import { hashToken } from '@/lib/ordering/tokens'
import { getRestaurantConfig } from '@/config/loader'
import MainPortalSelector from '@/components/ordering/MainPortalSelector'

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

  const settings = await getRestaurantSettings().catch(() => null)
  const restaurantName = settings?.name || config.name
  const logoUrl = settings?.branding?.logoUrl || config.branding.logoUrl
  const contactPhone = settings?.contact?.phone || config.contact.phone
  const googleReviewUrl =
    campaign.googleReviewUrlOverride || settings?.google?.reviewUrl || config.google?.reviewUrl

  const allTables = await getTables(true).catch(() => [])
  const activeTables = allTables
    .filter((t) => t.active)
    .map((t) => ({ id: t.id, label: t.label, state: t.state || 'available' }))

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#faf8f5] bg-gradient-to-b from-[#fdfbf7] via-[#fbf7ee] to-[#f6efe0] text-stone-900 flex flex-col px-3 sm:px-6 py-4 sm:py-8 relative overflow-x-hidden selection:bg-amber-600 selection:text-white">
      {/* Ambient warm lighting */}
      <div className="fixed -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-80 h-80 bg-yellow-300/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Badge */}
      <header className="relative z-10 flex items-center justify-center pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 border border-amber-200/80 shadow-xs backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-[11px] font-bold text-amber-950 tracking-wide">
            {restaurantName} • Guest Dining Portal
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-lg mx-auto my-auto py-3 sm:py-5">
        <div className="p-5 sm:p-8 rounded-3xl bg-white/95 backdrop-blur-md border border-stone-200/90 shadow-[0_20px_50px_-12px_rgba(180,83,9,0.1),0_4px_20px_rgba(0,0,0,0.04)] space-y-5 text-center animate-in fade-in zoom-in-95 duration-300">
          {/* Restaurant Crest & Logo */}
          <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 text-white flex items-center justify-center shadow-xl shadow-amber-600/25 overflow-hidden border-2 border-amber-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl || '/logo.png'}
                alt={restaurantName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png'
                }}
              />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white shadow-md border border-stone-200 text-amber-600">
              <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
            </div>
          </div>

          {/* Restaurant Heading */}
          <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 leading-tight">
              {restaurantName}
            </h1>
          </div>

          {/* Interactive Table Picker & Core Action Links */}
          <MainPortalSelector
            slug={slug}
            initialTable={tableLabel}
            token={token}
            tables={activeTables}
            restaurantName={restaurantName}
            reviewSlug={campaign.slug}
          />


          {/* Quick Google Review Direct Shortcut (if URL configured) */}
          {googleReviewUrl && (
            <div className="pt-0.5 animate-in fade-in">
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline underline-offset-4 transition-colors"
              >
                <span>Write direct review on Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
              </a>
            </div>
          )}

          {/* Features Strip */}
          <div className="pt-2 border-t border-stone-200/80 flex items-center justify-center gap-3 sm:gap-5 text-[11px] text-stone-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Table Ordering</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-stone-300" />
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>30-Sec Review</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-stone-300" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Verified Diner</span>
            </div>
          </div>

          {/* Help & Helpline */}
          {contactPhone && (
            <div className="pt-1 text-center">
              <a
                href={`tel:${contactPhone}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:underline transition-colors"
              >
                <Phone className="w-3.5 h-3.5" /> Need assistance? Call staff: {contactPhone}
              </a>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-2 text-[10px] text-stone-400">
        Powered by ReviewPulse • {restaurantName}
      </footer>
    </div>
  )
}
