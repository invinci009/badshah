import { NextRequest, NextResponse } from 'next/server'
import { getOrderMenuCategories, upsertOrderMenuCategory } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { categoryUpsertSchema } from '@/lib/ordering/validation'

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getOrderMenuCategories(), { status: 200 })
  } catch (error) {
    console.error('Order-menu categories GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = categoryUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid category', details: parsed.error.flatten() }, { status: 400 })
    }
    const cat = await upsertOrderMenuCategory(parsed.data)
    return NextResponse.json(cat, { status: parsed.data.id ? 200 : 201 })
  } catch (error) {
    console.error('Order-menu category save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
