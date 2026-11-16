import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSessionStatus, getSessionAnswers, saveAnswer, logEvent } from '@/lib/firebase/firestore'
import { getSessionFromCookie } from '@/lib/session/cookie'
import { ratingSchema } from '@/lib/validation/schemas'
import { logEvent as logObservabilityEvent } from '@/lib/observability/logger'

interface RouteProps {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const startTime = Date.now()
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const providedAnswers = body?.answers || {}

    // 1. Fetch session from database
    const session = await getSession(id)

    if (!session) {
      console.warn(`[Submit] Session ${id} not found`)
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 })
    }

    // 2. Validate session cookie ownership
    const cookie = await getSessionFromCookie()
    if (!cookie || cookie.session_id !== id) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 403 })
    }

    // 3. Idempotent check: if already completed, return success immediately
    if (session.status === 'completed') {
      return NextResponse.json(
        { success: true, status: 'completed', message: 'Session already completed' },
        { status: 200 }
      )
    }

    // 4. Fetch stored answers for this session
    const storedAnswers = await getSessionAnswers(id)

    const answerMap = new Map<string, unknown>(
      storedAnswers.map((a) => [a.questionKey, a.value])
    )

    // Merge answers provided in submit payload
    for (const [k, v] of Object.entries(providedAnswers)) {
      if (v !== undefined && v !== null && !answerMap.has(k)) {
        answerMap.set(k, v)
      }
    }

    // 5. Validate required core questions
    const requiredKeys = ['overall_rating', 'food_rating', 'service_rating']
    const missing: string[] = []

    for (const key of requiredKeys) {
      const val = answerMap.get(key)
      const parsed = ratingSchema.safeParse(val)
      if (!parsed.success) {
        missing.push(key)
      }
    }

    if (missing.length > 0) {
      console.warn(`[Submit] Missing required questions for session ${id}:`, missing)
      return NextResponse.json(
        {
          error: 'Required ratings missing or invalid',
          missing_questions: missing,
        },
        { status: 400 }
      )
    }

    // 6. Save any provided answers that were not yet in the DB
    if (Object.keys(providedAnswers).length > 0) {
      for (const [k, v] of Object.entries(providedAnswers)) {
        if (v !== undefined && v !== null) {
          await saveAnswer({
            sessionId: id,
            questionKey: k,
            value: v,
          })
        }
      }
    }

    // 7. Mark session as completed
    await updateSessionStatus(id, 'completed')

    // 8. Fire QUIZ_COMPLETED event
    await logEvent({
      sessionId: id,
      campaignId: session.campaignId,
      eventType: 'QUIZ_COMPLETED',
      metadata: {
        total_answers: answerMap.size,
        overall_rating: answerMap.get('overall_rating'),
      },
    })

    logObservabilityEvent({
      sessionId: id,
      businessId: 'default',
      action: 'QUIZ_COMPLETED',
      latencyMs: Date.now() - startTime,
      metadata: { total_answers: answerMap.size },
    })

    return NextResponse.json({ success: true, status: 'completed' }, { status: 200 })
  } catch (error) {
    console.error('Submit session error:', error)
    logObservabilityEvent({
      level: 'error',
      action: 'QUIZ_SUBMIT_FAILED',
      latencyMs: Date.now() - startTime,
      metadata: { error: String(error) },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
