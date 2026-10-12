import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { submitDirectComplaint, logEvent } from '@/lib/firebase/firestore'
import { normalizePhoneServerSide } from '@/lib/ordering/validation'
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit'

const complaintSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().min(10, 'Valid 10-digit mobile number is required').max(17),
  complaint: z.string().trim().min(5, 'Complaint details must be at least 5 characters').max(2000),
  category: z.string().trim().max(50).optional().default('other'),
  tableNumber: z.string().trim().max(30).optional(),
  slug: z.string().trim().max(100).optional(),
})

export async function POST(request: NextRequest) {
  // Apply rate limiting (prevents spam submission attacks)
  const rateLimitResponse = await rateLimitMiddleware(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const parsed = complaintSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid complaint data' },
        { status: 400 }
      )
    }

    const { name, phone, complaint, category, tableNumber, slug } = parsed.data

    const normalizedPhone = normalizePhoneServerSide(phone)
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit mobile number (e.g. 9876543210)' },
        { status: 400 }
      )
    }

    const formattedPhone = `+91 ${normalizedPhone}`

    const result = await submitDirectComplaint({
      name,
      phone: formattedPhone,
      complaint,
      category,
      tableNumber,
      slug,
    })

    // Log telemetry event
    await logEvent({
      sessionId: result.sessionId || `cmp_${Date.now()}`,
      eventType: 'CUSTOMER_COMPLAINT_SUBMITTED',
      metadata: {
        category,
        tableNumber,
        hasPhone: true,
      },
    }).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        id: result.id,
        message: 'Complaint submitted directly to management. We will follow up with you promptly.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error submitting complaint:', error)
    return NextResponse.json(
      { error: 'Failed to record complaint. Please call the helpline directly.' },
      { status: 500 }
    )
  }
}
