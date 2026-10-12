import { NextRequest, NextResponse } from 'next/server'
import { updateFeedbackStatus } from '@/lib/firebase/firestore'
import { getSessionFromRequest } from '@/lib/firebase/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const body = await request.json()
    const { status, adminNote } = body

    if (!status || !['pending', 'resolved', 'contacted'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    await updateFeedbackStatus(id, status, adminNote)
    return NextResponse.json({ success: true, id, status })
  } catch (error) {
    console.error('Error updating feedback status:', error)
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
  }
}
