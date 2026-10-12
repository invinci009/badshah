import { NextRequest, NextResponse } from 'next/server'
import { getPrivateFeedback } from '@/lib/firebase/firestore'
import { getSessionFromRequest } from '@/lib/firebase/auth'

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const list = await getPrivateFeedback()
    return NextResponse.json(list)
  } catch (error) {
    console.error('Error fetching private feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
