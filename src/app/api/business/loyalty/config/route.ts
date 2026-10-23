import { NextRequest, NextResponse } from 'next/server'
import { getLoyaltyConfig, saveLoyaltyConfig } from '@/lib/firebase/loyalty'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { loyaltyConfigPatchSchema } from '@/lib/loyalty/validation'

// GET/PATCH /api/business/loyalty/config — loyalty program rules.
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getLoyaltyConfig())
  } catch (error) {
    console.error('Loyalty config GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = loyaltyConfigPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid config', details: parsed.error.flatten() }, { status: 400 })
    }
    const config = await saveLoyaltyConfig(parsed.data)
    return NextResponse.json(config)
  } catch (error) {
    console.error('Loyalty config PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
