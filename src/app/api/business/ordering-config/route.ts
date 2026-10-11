import { NextRequest, NextResponse } from 'next/server'
import { getOrderingConfig, saveOrderingConfig } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { orderingConfigSchema } from '@/lib/ordering/validation'

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getOrderingConfig(), { status: 200 })
  } catch (error) {
    console.error('Ordering config GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = orderingConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid config', details: parsed.error.flatten() }, { status: 400 })
    }
    await saveOrderingConfig(parsed.data)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Ordering config save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
