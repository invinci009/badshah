import 'server-only'
import { type Firestore, type Query } from 'firebase-admin/firestore'
import { getAdminFirestore } from './admin'

// ==============================================================================
// Firestore Helpers
// ==============================================================================

function getDb(): Firestore {
  return getAdminFirestore()
}

// Firestore rejects `undefined` values — strip them before .set() so
// optional fields (deviceType, contactName, phone, logoUrl, …) can't crash
// writes when callers omit them.
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) clean[key] = value
  }
  return clean as T
}

// ==============================================================================
// Restaurant Settings
// ==============================================================================

export interface RestaurantSettings {
  id: string
  name: string
  slug: string
  contact: {
    phone?: string
    helpline?: string
    email?: string
  }
  location: {
    address?: string
    city?: string
    state?: string
    country?: string
  }
  google: {
    reviewUrl: string
  }
  branding: {
    logoUrl?: string
    faviconUrl?: string
    primaryColor: string
    secondaryColor: string
    accentColor?: string
  }
  features: {
    aiReviews: boolean
    privateFeedback: boolean
    crm: boolean
    campaignAnalytics: boolean
    menuManagement: boolean
    weeklyReports?: boolean
    customerRecovery?: boolean
  }
  settings: {
    defaultLanguage: string
    supportedLanguages: string[]
    timezone: string
  }
  welcomeMessage: Record<string, string>
  createdAt: string
  updatedAt: string
}

import { getCached, invalidateCache } from '../cache'

export async function getRestaurantSettings(): Promise<RestaurantSettings | null> {
  return getCached('settings:restaurant', 60 * 60 * 1000, async () => {
    const docRef = getDb().doc('restaurant/settings')
    const snapshot = await docRef.get()
    if (!snapshot.exists) return null
    return { id: snapshot.id, ...snapshot.data() } as RestaurantSettings
  })
}

export async function saveRestaurantSettings(settings: Omit<RestaurantSettings, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  const docRef = getDb().doc('restaurant/settings')
  const now = new Date().toISOString()
  await docRef.set(stripUndefined({
    ...settings,
    createdAt: now,
    updatedAt: now,
  }), { merge: true })
  invalidateCache('settings:restaurant')
}

// ==============================================================================
// Campaigns
// ==============================================================================

export interface Campaign {
  id: string
  name: string
  slug: string
  active: boolean
  googleReviewUrlOverride?: string
  createdAt: string
  updatedAt: string
}

export async function getCampaigns(): Promise<Campaign[]> {
  return getCached('campaigns:all', 60 * 60 * 1000, async () => {
    const snapshot = await getDb().collection('campaigns').orderBy('createdAt', 'desc').get()
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Campaign)
  })
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  return getCached(`campaign:${slug}`, 60 * 60 * 1000, async () => {
    const snapshot = await getDb().collection('campaigns').where('slug', '==', slug).limit(1).get()
    if (snapshot.empty) return null
    const d = snapshot.docs[0]
    return { id: d.id, ...d.data() } as Campaign
  })
}

export async function createCampaign(data: { name: string; slug: string; active?: boolean }): Promise<Campaign> {
  const docRef = getDb().collection('campaigns').doc()
  const now = new Date().toISOString()
  const campaign: Omit<Campaign, 'id'> = {
    name: data.name,
    slug: data.slug,
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now,
  }
  await docRef.set(campaign)
  invalidateCache(`campaign:${data.slug}`)
  return { id: docRef.id, ...campaign }
}

export async function updateCampaign(id: string, data: Partial<Pick<Campaign, 'name' | 'slug' | 'active' | 'googleReviewUrlOverride'>>): Promise<void> {
  const docRef = getDb().doc(`campaigns/${id}`)
  await docRef.update({
    ...data,
    updatedAt: new Date().toISOString(),
  })
  invalidateCache('campaign')
}

export async function deleteCampaign(id: string): Promise<void> {
  const docRef = getDb().doc(`campaigns/${id}`)
  await docRef.delete()
  invalidateCache('campaign')
}

// ==============================================================================
// Menu Items
// ==============================================================================

export interface MenuItem {
  id: string
  name: Record<string, string>
  active: boolean
  position: number
  createdAt: string
}

export async function getMenuItems(): Promise<MenuItem[]> {
  return getCached('menu_items:all', 60 * 60 * 1000, async () => {
    const snapshot = await getDb().collection('menuItems').orderBy('position', 'asc').get()
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MenuItem)
  })
}

export async function createMenuItem(data: { name: Record<string, string>; position?: number }): Promise<MenuItem> {
  const docRef = getDb().collection('menuItems').doc()
  const now = new Date().toISOString()
  const item: Omit<MenuItem, 'id'> = {
    name: data.name,
    active: true,
    position: data.position || 1,
    createdAt: now,
  }
  await docRef.set(item)
  invalidateCache('menu_items:all')
  return { id: docRef.id, ...item }
}

export async function updateMenuItem(id: string, data: Partial<Pick<MenuItem, 'name' | 'active' | 'position'>>): Promise<void> {
  const docRef = getDb().doc(`menuItems/${id}`)
  await docRef.update(data)
  invalidateCache('menu_items:all')
}

export async function deleteMenuItem(id: string): Promise<void> {
  const docRef = getDb().doc(`menuItems/${id}`)
  await docRef.delete()
  invalidateCache('menu_items:all')
}

// ==============================================================================
// Sessions
// ==============================================================================

export interface Session {
  id: string
  campaignId: string
  status: 'landed' | 'in_progress' | 'completed'
  language: string
  deviceType?: string
  startedAt: string | null
  lastActivityAt: string | null
  completedAt: string | null
  ipHash?: string
  uaHash?: string
  createdAt: string
}

export async function createSession(data: { campaignId: string; language?: string; deviceType?: string; ipHash?: string; uaHash?: string }): Promise<Session> {
  const docRef = getDb().collection('sessions').doc()
  const now = new Date().toISOString()
  const session: Omit<Session, 'id'> = {
    campaignId: data.campaignId,
    status: 'landed',
    language: data.language || 'en',
    deviceType: data.deviceType || undefined,
    startedAt: null,
    lastActivityAt: now,
    completedAt: null,
    ipHash: data.ipHash || undefined,
    uaHash: data.uaHash || undefined,
    createdAt: now,
  }
  await docRef.set(stripUndefined(session))
  return { id: docRef.id, ...session }
}

export async function getSession(id: string): Promise<Session | null> {
  const docRef = getDb().doc(`sessions/${id}`)
  const snapshot = await docRef.get()
  if (!snapshot.exists) return null
  return { id: snapshot.id, ...snapshot.data() } as Session
}

export async function updateSessionStatus(id: string, status: Session['status']): Promise<void> {
  const docRef = getDb().doc(`sessions/${id}`)
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status,
    lastActivityAt: now,
  }
  if (status === 'in_progress') {
    updates.startedAt = now
  }
  if (status === 'completed') {
    updates.completedAt = now
  }
  await docRef.update(updates)
}

// ==============================================================================
// Answers
// ==============================================================================

export interface Answer {
  id: string
  sessionId: string
  questionKey: string
  value: unknown
  createdAt: string
}

export async function saveAnswer(data: { sessionId: string; questionKey: string; value: unknown }): Promise<void> {
  const docRef = getDb().collection('answers').doc()
  const now = new Date().toISOString()
  await docRef.set({
    sessionId: data.sessionId,
    questionKey: data.questionKey,
    value: data.value,
    createdAt: now,
  })
}

export async function getSessionAnswers(sessionId: string): Promise<Answer[]> {
  const snapshot = await getDb().collection('answers').where('sessionId', '==', sessionId).get()
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Answer)
}

// ==============================================================================
// Review Drafts
// ==============================================================================

export interface ReviewDraft {
  id: string
  sessionId: string
  originalText: string
  finalText: string
  method: 'llm' | 'fallback'
  createdAt: string
  updatedAt: string
}

export async function getReviewDraft(sessionId: string): Promise<ReviewDraft | null> {
  const snapshot = await getDb().collection('reviewDrafts').where('sessionId', '==', sessionId).limit(1).get()
  if (snapshot.empty) return null
  const d = snapshot.docs[0]
  return { id: d.id, ...d.data() } as ReviewDraft
}

export async function saveReviewDraft(data: { sessionId: string; originalText: string; finalText: string; method: 'llm' | 'fallback' }): Promise<ReviewDraft> {
  const docRef = getDb().collection('reviewDrafts').doc()
  const now = new Date().toISOString()
  const draft: Omit<ReviewDraft, 'id'> = {
    sessionId: data.sessionId,
    originalText: data.originalText,
    finalText: data.finalText,
    method: data.method,
    createdAt: now,
    updatedAt: now,
  }
  await docRef.set(draft)
  return { id: docRef.id, ...draft }
}

export async function updateReviewDraft(sessionId: string, finalText: string): Promise<void> {
  const existing = await getReviewDraft(sessionId)
  if (existing) {
    const docRef = getDb().doc(`reviewDrafts/${existing.id}`)
    await docRef.update({
      finalText,
      updatedAt: new Date().toISOString(),
    })
  }
}

/**
 * Replace a draft's text (used when regenerating via Groq).
 */
export async function replaceReviewDraft(
  id: string,
  data: { originalText: string; finalText: string; method: 'llm' | 'fallback' }
): Promise<void> {
  const docRef = getDb().doc(`reviewDrafts/${id}`)
  await docRef.update({
    ...stripUndefined({ ...data }),
    updatedAt: new Date().toISOString(),
  })
}

// ==============================================================================
// Private Feedback
// ==============================================================================

export interface PrivateFeedback {
  id: string
  sessionId: string
  category: string
  message: string
  contactName?: string
  contactValue?: string
  contactConsent: boolean
  isComplaint?: boolean
  status?: 'pending' | 'resolved' | 'contacted'
  tableNumber?: string
  source?: string
  adminNote?: string
  createdAt: string
  updatedAt?: string
}

export async function submitPrivateFeedback(data: {
  sessionId: string
  category: string
  message: string
  contactName?: string
  contactValue?: string
  contactConsent: boolean
}): Promise<PrivateFeedback> {
  const docRef = getDb().collection('privateFeedback').doc()
  const now = new Date().toISOString()
  const feedback: Omit<PrivateFeedback, 'id'> = {
    sessionId: data.sessionId,
    category: data.category,
    message: data.message,
    contactName: data.contactName || undefined,
    contactValue: data.contactValue || undefined,
    contactConsent: data.contactConsent,
    status: 'pending',
    createdAt: now,
  }
  // Ensure contactName and contactValue are string | undefined, not null
  if (feedback.contactName === null) feedback.contactName = undefined
  if (feedback.contactValue === null) feedback.contactValue = undefined
  await docRef.set(stripUndefined({ ...feedback }))
  invalidateCache('feedback:private')
  return { id: docRef.id, ...feedback }
}

export async function submitDirectComplaint(data: {
  name: string
  phone: string
  complaint: string
  category?: string
  tableNumber?: string
  slug?: string
  sessionId?: string
}): Promise<PrivateFeedback> {
  const docRef = getDb().collection('privateFeedback').doc()
  const now = new Date().toISOString()
  const feedback: Omit<PrivateFeedback, 'id'> = {
    sessionId: data.sessionId || `complaint_${Date.now()}`,
    category: data.category || 'complaint',
    message: data.complaint,
    contactName: data.name,
    contactValue: data.phone,
    contactConsent: true,
    isComplaint: true,
    status: 'pending',
    tableNumber: data.tableNumber || undefined,
    source: 'direct_complaint_modal',
    createdAt: now,
  }
  if (feedback.contactName === null) feedback.contactName = undefined
  if (feedback.contactValue === null) feedback.contactValue = undefined
  await docRef.set(stripUndefined({ ...feedback }))
  invalidateCache('feedback:private')
  return { id: docRef.id, ...feedback }
}

export async function updateFeedbackStatus(
  id: string,
  status: 'pending' | 'resolved' | 'contacted',
  adminNote?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date().toISOString(),
  }
  if (adminNote !== undefined) {
    updateData.adminNote = adminNote
  }
  await getDb().collection('privateFeedback').doc(id).set(updateData, { merge: true })
  invalidateCache('feedback:private')
}

export async function getPrivateFeedback(limit = 100): Promise<PrivateFeedback[]> {
  return getCached(`feedback:private:${limit}`, 5 * 60 * 1000, async () => {
    const snapshot = await getDb().collection('privateFeedback').orderBy('createdAt', 'desc').limit(limit).get()
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PrivateFeedback)
  })
}

// ==============================================================================
// Events
// ==============================================================================

export interface AnalyticsEvent {
  id: string
  sessionId: string
  campaignId?: string
  eventType: string
  clientEventId?: string
  metadata?: Record<string, unknown>
  timestamp: string
  createdAt: string
}

export async function logEvent(data: {
  sessionId: string
  campaignId?: string
  eventType: string
  clientEventId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const docRef = getDb().collection('events').doc()
  const now = new Date().toISOString()
  await docRef.set({
    sessionId: data.sessionId,
    campaignId: data.campaignId || null,
    eventType: data.eventType,
    clientEventId: data.clientEventId || null,
    metadata: data.metadata || {},
    timestamp: now,
    createdAt: now,
  })
}

export async function getEvents(filters?: {
  sessionId?: string
  campaignId?: string
  eventType?: string
  limit?: number
}): Promise<AnalyticsEvent[]> {
  let q: Query = getDb().collection('events')

  if (filters?.sessionId) {
    q = q.where('sessionId', '==', filters.sessionId)
  }
  if (filters?.campaignId) {
    q = q.where('campaignId', '==', filters.campaignId)
  }
  if (filters?.eventType) {
    q = q.where('eventType', '==', filters.eventType)
  }

  q = q.orderBy('timestamp', 'desc')

  const queryLimit = Math.min(500, Math.max(1, filters?.limit || 100))
  q = q.limit(queryLimit)

  const snapshot = await q.get()
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AnalyticsEvent)
}
