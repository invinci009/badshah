import { NextRequest, NextResponse } from 'next/server'
import {
  listRewards,
  upsertReward,
  setRewardActive,
} from '@/lib/firebase/loyalty'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { rewardUpsertSchema } from '@/lib/loyalty/validation'
import { z } from 'zod'

const toggleSchema = z.object({ id: z.string().min(1), active: z.boolean() })

// GET/POST/PATCH/DELETE /api/business/loyalty/rewards — full reward catalog.
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await listRewards())
  } catch (error) {
    console.error('Loyalty rewards GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = rewardUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid reward', details: parsed.error.flatten() }, { status: 400 })
    }
    const saved = await upsertReward(parsed.data)
    return NextResponse.json(saved, { status: parsed.data.id ? 200 : 201 })
  } catch (error) {
    console.error('Loyalty reward save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = toggleSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    await setRewardActive(parsed.data.id, parsed.data.active)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Loyalty reward toggle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing reward id' }, { status: 400 })
    // Rewards are financially significant — deactivate rather than hard-delete.
    await setRewardActive(id, false)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Loyalty reward DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
