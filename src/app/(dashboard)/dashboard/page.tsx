import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/firebase/auth'
import {
  getRestaurantSettings,
  getCampaigns,
  getEvents,
  getSession,
  getSessionAnswers,
  getReviewDraft,
  getPrivateFeedback,
  getMenuItems,
} from '@/lib/firebase/firestore'
import { getTables } from '@/lib/firebase/ordering'
import { getOrderMenuItems } from '@/lib/firebase/ordering'
import { getRestaurantConfig } from '@/config/loader'
import { getCached } from '@/lib/cache'
import DashboardWorkspace from '@/components/dashboard/DashboardWorkspace'
import type { AnalyticsData } from '@/components/dashboard/OverviewTab'
import type { ResponseItem } from '@/components/dashboard/ResponsesTab'
import type { CustomerDetail } from '@/components/dashboard/CustomersPortalTab'
import type { PrivateFeedbackItem } from '@/components/dashboard/FeedbackTab'

interface DashboardPageProps {
  searchParams: Promise<{ tab?: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { tab } = await searchParams

  // 1. Authenticate via Firebase token
  const cookieStore = await cookies()
  const idToken = cookieStore.get('firebase_token')?.value

  if (!idToken) {
    redirect('/login')
  }

  const user = await validateSession(idToken)
  if (!user) {
    redirect('/login')
  }

  // 2-4, 8-9. Fetch independent collections in parallel. These were
  // sequential awaits — each one cost a full Firestore round-trip, so page
  // load grew linearly with every query. Results are identical, just concurrent.
  const [settingsResult, campaigns, events, privateFeedbackData, menuItems, diningTables, orderMenuItems] = await Promise.all([
    getRestaurantSettings().catch((e) => {
      console.warn('Dashboard getRestaurantSettings failed:', e.message)
      return null
    }),
    getCampaigns().catch((e) => {
      console.warn('Dashboard getCampaigns failed:', e.message)
      return []
    }),
    getCached('dashboard:events', 10 * 60 * 1000, () => getEvents({ limit: 100 })).catch((e) => {
      console.warn('Dashboard getEvents failed:', e.message)
      return []
    }),
    getPrivateFeedback().catch((e) => {
      console.warn('Dashboard getPrivateFeedback failed:', e.message)
      return []
    }),
    getMenuItems().catch((e) => {
      console.warn('Dashboard getMenuItems failed:', e.message)
      return []
    }),
    getTables(true).catch((e) => {
      console.warn('Dashboard getTables failed:', e.message)
      return []
    }),
    getOrderMenuItems().catch((e) => {
      console.warn('Dashboard getOrderMenuItems failed:', e.message)
      return []
    }),
  ])
  const config = getRestaurantConfig()

  let settings = settingsResult

  if (!settings) {
    settings = {
      id: 'settings',
      name: config.name,
      slug: config.slug,
      contact: config.contact,
      location: config.location,
      google: config.google,
      branding: config.branding,
      features: config.features,
      settings: config.settings,
      welcomeMessage: config.welcomeMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  // 5-7. Fetch & cache session analytics — 10-minute TTL with bounded 30 sessions eliminates 200+ redundant reads
  const sessionAnalytics = await getCached('dashboard:session_analytics', 10 * 60 * 1000, async () => {
    const sessionIds = [...new Set(events.map((e) => e.sessionId).filter(Boolean))].slice(0, 30) as string[]
    const sessionDocs = await Promise.all(
      sessionIds.map((sessionId) => getSession(sessionId).catch(() => null))
    )
    const sessionsList: Array<{ id: string; campaignId: string; status: string; createdAt: string; completedAt: string | null }> = []

    for (const session of sessionDocs) {
      if (session) {
        sessionsList.push({
          id: session.id,
          campaignId: session.campaignId,
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
        })
      }
    }

    const [answersList, draftsList] = await Promise.all([
      Promise.all(sessionsList.map((session) => getSessionAnswers(session.id).catch(() => []))),
      Promise.all(sessionsList.map((session) => getReviewDraft(session.id).catch(() => null))),
    ])

    const answersArray: Array<{ sessionId: string; entries: [string, unknown][] }> = []
    for (let i = 0; i < sessionsList.length; i++) {
      answersArray.push({
        sessionId: sessionsList[i].id,
        entries: answersList[i].map((a) => [a.questionKey, a.value] as [string, unknown]),
      })
    }

    const draftsArray: Array<{ sessionId: string; draft: { originalText: string; finalText: string } | null }> = []
    for (let i = 0; i < sessionsList.length; i++) {
      const draft = draftsList[i]
      draftsArray.push({
        sessionId: sessionsList[i].id,
        draft: draft ? { originalText: draft.originalText, finalText: draft.finalText } : null,
      })
    }

    return { sessions: sessionsList, answersArray, draftsArray }
  })

  const sessions = sessionAnalytics.sessions
  const answersBySession = new Map<string, Map<string, unknown>>()
  for (const item of sessionAnalytics.answersArray) {
    answersBySession.set(item.sessionId, new Map(item.entries))
  }

  const draftsBySession = new Map<string, { originalText: string; finalText: string }>()
  for (const item of sessionAnalytics.draftsArray) {
    if (item.draft) {
      draftsBySession.set(item.sessionId, item.draft)
    }
  }

  // 8. Private feedback + 9. menu items already fetched above in parallel
  const menuItemMap = new Map<string, string>()
  for (const m of menuItems) {
    const name = typeof m.name === 'string' ? m.name : m.name?.en || 'Menu item'
    menuItemMap.set(m.id, name)
  }

  // ========================================================
  // COMPUTE METRICS
  // ========================================================
  const completedSessions = sessions.filter((s) => s.status === 'completed')

  const scans = events.filter((e) => e.eventType === 'QR_SCANNED').length
  const starts = events.filter((e) => e.eventType === 'QUIZ_STARTED').length
  const completions = completedSessions.length

  const startRate = scans > 0 ? starts / scans : 0
  const completionRate = starts > 0 ? completions / starts : 0
  const scanToCompletionRate = scans > 0 ? completions / scans : 0

  const googleClickSessions = new Set(
    events.filter((e) => e.eventType === 'GOOGLE_CLICKED').map((e) => e.sessionId)
  )
  const googleClicks = googleClickSessions.size
  const googleClickRate = completions > 0 ? googleClicks / completions : 0

  const privateFeedbackCount = privateFeedbackData.length
  const privateFeedbackRate = completions > 0 ? privateFeedbackCount / completions : 0

  // Ratings calculation
  let overallSum = 0
  let foodSum = 0
  let serviceSum = 0
  let ratedCount = 0

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const likedCounts: Record<string, number> = {}

  let lowOverallCount = 0
  let lowFoodCount = 0
  let lowServiceCount = 0

  for (const session of completedSessions) {
    const sAnswers = answersBySession.get(session.id)
    if (sAnswers) {
      const overall = sAnswers.get('overall_rating')
      const food = sAnswers.get('food_rating')
      const service = sAnswers.get('service_rating')
      const liked = sAnswers.get('liked')

      if (typeof overall === 'number') {
        overallSum += overall
        ratedCount++
        ratingDistribution[overall] = (ratingDistribution[overall] || 0) + 1
        if (overall <= 2) lowOverallCount++
      }
      if (typeof food === 'number') {
        foodSum += food
        if (food <= 2) lowFoodCount++
      }
      if (typeof service === 'number') {
        serviceSum += service
        if (service <= 2) lowServiceCount++
      }
      if (Array.isArray(liked)) {
        for (const l of liked) {
          likedCounts[l as string] = (likedCounts[l as string] || 0) + 1
        }
      }
    }
  }

  const avgOverall = ratedCount > 0 ? overallSum / ratedCount : null
  const avgFood = ratedCount > 0 ? foodSum / ratedCount : null
  const avgService = ratedCount > 0 ? serviceSum / ratedCount : null

  const lowRatingShare = {
    overall: ratedCount > 0 ? lowOverallCount / ratedCount : 0,
    food: ratedCount > 0 ? lowFoodCount / ratedCount : 0,
    service: ratedCount > 0 ? lowServiceCount / ratedCount : 0,
  }

  // Campaign stats table
  const campaignMap = new Map(campaigns.map((c) => [c.id, c]))
  const campaignStats = campaigns.map((c) => {
    const cScans = events.filter((e) => e.campaignId === c.id && e.eventType === 'QR_SCANNED').length
    const cCompletions = completedSessions.filter((s) => s.campaignId === c.id).length
    const cGoogleClicks = new Set(
      events
        .filter((e) => e.campaignId === c.id && e.eventType === 'GOOGLE_CLICKED')
        .map((e) => e.sessionId)
    ).size

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      active: c.active,
      scans: cScans,
      completions: cCompletions,
      googleClicks: cGoogleClicks,
    }
  })

  const analytics: AnalyticsData = {
    scans,
    starts,
    completions,
    googleClicks,
    privateFeedbackCount,
    startRate,
    completionRate,
    scanToCompletionRate,
    googleClickRate,
    privateFeedbackRate,
    avgOverall,
    avgFood,
    avgService,
    totalRatedSessions: ratedCount,
    ratingDistribution,
    likedCounts,
    lowRatingShare,
    campaignStats,
  }

  // Map responses
  const responses: ResponseItem[] = completedSessions.map((s) => {
    const sAnswers = answersBySession.get(s.id)
    const draft = draftsBySession.get(s.id)
    const cName = campaignMap.get(s.campaignId)?.name || 'Dining Hall'

    const contactObj = sAnswers?.get('customer_contact')
    const phoneVal: string | null =
      (typeof sAnswers?.get('customer_phone') === 'string' ? (sAnswers.get('customer_phone') as string) : null) ||
      (typeof contactObj === 'object' && contactObj !== null && typeof (contactObj as Record<string, unknown>)?.phone === 'string' ? ((contactObj as Record<string, unknown>).phone as string) : null) ||
      null
    const nameVal: string | null =
      (typeof sAnswers?.get('customer_name') === 'string' ? (sAnswers.get('customer_name') as string) : null) ||
      (typeof contactObj === 'object' && contactObj !== null && typeof (contactObj as Record<string, unknown>)?.name === 'string' ? ((contactObj as Record<string, unknown>).name as string) : null) ||
      null

    const rawOrdered = sAnswers?.get('ordered') || []
    const orderedDishNames = Array.isArray(rawOrdered)
      ? rawOrdered.map((idOrName: string) => menuItemMap.get(idOrName) || idOrName)
      : []

    return {
      id: s.id,
      campaignName: cName,
      status: s.status,
      completedAt: s.completedAt,
      overallRating: typeof sAnswers?.get('overall_rating') === 'number' ? (sAnswers.get('overall_rating') as number) : null,
      foodRating: typeof sAnswers?.get('food_rating') === 'number' ? (sAnswers.get('food_rating') as number) : null,
      serviceRating: typeof sAnswers?.get('service_rating') === 'number' ? (sAnswers.get('service_rating') as number) : null,
      liked: Array.isArray(sAnswers?.get('liked')) ? (sAnswers.get('liked') as string[]) : [],
      ordered: orderedDishNames,
      draftText: draft?.finalText || draft?.originalText || null,
      draftEdited: Boolean(draft?.finalText && draft.finalText !== draft.originalText),
      customerName: nameVal,
      customerPhone: phoneVal,
    }
  })

  // Map customers detail portal
  const customerDetails: CustomerDetail[] = completedSessions.map((s) => {
    const sAnswers = answersBySession.get(s.id)
    const draft = draftsBySession.get(s.id)
    const cName = campaignMap.get(s.campaignId)?.name || 'Dining Hall'

    const contactObj = sAnswers?.get('customer_contact')
    const pf = privateFeedbackData.find((f) => f.sessionId === s.id)

    const phoneVal: string =
      (typeof sAnswers?.get('customer_phone') === 'string' ? (sAnswers.get('customer_phone') as string) : '') ||
      (typeof contactObj === 'object' && contactObj !== null && typeof (contactObj as Record<string, unknown>)?.phone === 'string' ? ((contactObj as Record<string, unknown>).phone as string) : '') ||
      pf?.contactValue ||
      ''

    const nameVal: string =
      (typeof sAnswers?.get('customer_name') === 'string' ? (sAnswers.get('customer_name') as string) : '') ||
      (typeof contactObj === 'object' && contactObj !== null && typeof (contactObj as Record<string, unknown>)?.name === 'string' ? ((contactObj as Record<string, unknown>).name as string) : '') ||
      pf?.contactName ||
      ''

    const optIn = typeof contactObj === 'object' && contactObj !== null ? Boolean((contactObj as Record<string, unknown>)?.optIn ?? true) : false

    const rawOrdered = sAnswers?.get('ordered') || []
    const orderedDishNames = Array.isArray(rawOrdered)
      ? rawOrdered.map((idOrName: string) => menuItemMap.get(idOrName) || idOrName)
      : []

    const googleClicked = events.some(
      (e) => e.sessionId === s.id && e.eventType === 'GOOGLE_CLICKED'
    )

    return {
      sessionId: s.id,
      name: nameVal || '',
      phone: phoneVal || '',
      hasPhone: Boolean(phoneVal),
      optInMarketing: optIn,
      overallRating: typeof sAnswers?.get('overall_rating') === 'number' ? (sAnswers.get('overall_rating') as number) : null,
      foodRating: typeof sAnswers?.get('food_rating') === 'number' ? (sAnswers.get('food_rating') as number) : null,
      serviceRating: typeof sAnswers?.get('service_rating') === 'number' ? (sAnswers.get('service_rating') as number) : null,
      orderedDishes: orderedDishNames,
      likedAspects: Array.isArray(sAnswers?.get('liked')) ? (sAnswers.get('liked') as string[]) : [],
      draftText: draft?.finalText || draft?.originalText || null,
      googleClicked,
      campaignName: cName,
      respondedAt: s.completedAt || s.createdAt,
      privateFeedbackMessage: pf?.message || null,
      status: s.status,
    }
  })

  // Map private feedback
  const feedbackList: PrivateFeedbackItem[] = privateFeedbackData.map((f) => ({
    id: f.id,
    category: f.category,
    message: f.message,
    contactName: f.contactName || null,
    contactValue: f.contactValue || null,
    contactConsent: f.contactConsent,
    createdAt: f.createdAt,
  }))

  // Map campaigns to CampaignItem format (with created_at for backward compat)
  const campaignItems = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    active: c.active,
    created_at: c.createdAt,
  }))

  const portalSlug = campaigns.find((c) => c.active)?.slug || campaigns[0]?.slug || 'order'

  const tableItems = diningTables.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    active: t.active,
    state: t.state,
    activeTokenHash: t.activeTokenHash,
    activeTokenPrefix: t.activeTokenPrefix,
    createdAt: t.createdAt,
  }))

  return (
    <DashboardWorkspace
      initialTab={tab}
      business={{
        id: settings.id,
        name: settings.name,
        location: settings.location?.address || '',
        phone: settings.contact?.phone || '',
        secondaryPhone: settings.contact?.helpline || '',
        googleReviewUrl: settings.google.reviewUrl,
        welcomeMessage: settings.welcomeMessage,
        primaryColor: settings.branding.primaryColor,
      }}
      campaigns={campaignItems}
      analytics={analytics}
      responses={responses}
      customers={customerDetails}
      feedbackList={feedbackList}
      menuItems={menuItems}
      tables={tableItems}
      portalSlug={portalSlug}
      orderMenuCount={orderMenuItems.length}
      userEmail={user.email || 'admin'}
    />
  )
}
