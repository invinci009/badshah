import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSessionAnswers, getMenuItems, getReviewDraft, saveReviewDraft, replaceReviewDraft, updateReviewDraft, logEvent } from '@/lib/firebase/firestore'
import { getSessionFromCookie } from '@/lib/session/cookie'
import { buildFactSheet } from '@/lib/draft/fact-sheet'
import { generateReviewDraft } from '@/lib/draft/generator'
import { getRestaurantConfig } from '@/config/loader'
import { logEvent as logObservabilityEvent } from '@/lib/observability/logger'
import { z } from 'zod'

interface RouteProps {
  params: Promise<{ id: string }>
}

const patchDraftSchema = z.object({
  final_text: z.string().min(1).max(2000),
})

export async function POST(request: NextRequest, { params }: RouteProps) {
  const startTime = Date.now()
  try {
    const { id } = await params
    const config = getRestaurantConfig()

    // 1. Fetch session
    const session = await getSession(id)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // 2. Validate session cookie ownership
    const cookie = await getSessionFromCookie()
    if (!cookie || cookie.session_id !== id) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 403 })
    }

    // 3. Idempotency: Return existing draft if already generated —
    // unless ?refresh=1 forces a fresh Groq generation (regenerate button)
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === '1'
    const existingDraft = await getReviewDraft(id)

    if (existingDraft && existingDraft.originalText && !forceRefresh) {
      return NextResponse.json(existingDraft, { status: 200 })
    }

    // 4. Retrieve answers and menu items to build Fact Sheet
    const answers = await getSessionAnswers(id)
    const menuItems = await getMenuItems()

    const menuItemNames: Record<string, string> = {}
    for (const item of menuItems) {
      const name = typeof item.name === 'string' ? item.name : item.name?.en || 'Specialty dish'
      menuItemNames[item.id] = name
    }

    const factSheet = buildFactSheet(
      answers.map(a => ({ question_key: a.questionKey, value: a.value })),
      menuItemNames
    )

    // 5. Generate review draft
    const generated = await generateReviewDraft(factSheet, id, config.name)

    // 6. Save to reviewDrafts (replace on refresh, create otherwise)
    let newDraft
    if (forceRefresh && existingDraft) {
      await replaceReviewDraft(existingDraft.id, {
        originalText: generated.text,
        finalText: generated.text,
        method: generated.method,
      })
      newDraft = {
        ...existingDraft,
        originalText: generated.text,
        finalText: generated.text,
        method: generated.method,
      }
    } else {
      newDraft = await saveReviewDraft({
        sessionId: id,
        originalText: generated.text,
        finalText: generated.text,
        method: generated.method,
      })
    }

    // 7. Fire DRAFT_GENERATED event
    await logEvent({
      sessionId: id,
      campaignId: session.campaignId,
      eventType: forceRefresh ? 'DRAFT_REGENERATED' : 'DRAFT_GENERATED',
      metadata: { method: generated.method },
    })

    logObservabilityEvent({
      sessionId: id,
      businessId: 'default',
      action: 'DRAFT_GENERATED',
      latencyMs: Date.now() - startTime,
      metadata: { method: generated.method, length: generated.text.length },
    })

    return NextResponse.json(newDraft, { status: 200 })
  } catch (error) {
    console.error('Draft API error:', error)
    logObservabilityEvent({
      level: 'error',
      action: 'DRAFT_GENERATION_FAILED',
      latencyMs: Date.now() - startTime,
      metadata: { error: String(error) },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params
    const cookie = await getSessionFromCookie()
    if (!cookie || cookie.session_id !== id) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = patchDraftSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid draft update payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { final_text } = parsed.data

    // Update final_text
    await updateReviewDraft(id, final_text)

    return NextResponse.json({ success: true, final_text }, { status: 200 })
  } catch (error) {
    console.error('Draft update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
