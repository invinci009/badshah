import { NextRequest, NextResponse } from 'next/server'
import {
  getOrderMenuItems,
  upsertOrderMenuItem,
  setOrderMenuItemAvailability,
  setOrderMenuItemVisibility,
  isMenuItemReferenced,
  deleteOrderMenuItem,
} from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { orderMenuItemUpsertSchema } from '@/lib/ordering/validation'
import { z } from 'zod'

const toggleSchema = z.object({ id: z.string().min(1), available: z.boolean().optional(), visible: z.boolean().optional() })

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getOrderMenuItems(), { status: 200 })
  } catch (error) {
    console.error('Order-menu items GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = orderMenuItemUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid item', details: parsed.error.flatten() }, { status: 400 })
    }
    const item = await upsertOrderMenuItem(parsed.data)
    return NextResponse.json(item, { status: parsed.data.id ? 200 : 201 })
  } catch (error) {
    console.error('Order-menu item save error:', error)
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
    const { id, available, visible } = parsed.data
    if (available !== undefined) await setOrderMenuItemAvailability(id, available)
    if (visible !== undefined) await setOrderMenuItemVisibility(id, visible)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Order-menu item toggle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing item id' }, { status: 400 })
    if (await isMenuItemReferenced(id)) {
      return NextResponse.json(
        { error: 'Item is referenced by historical orders and cannot be deleted. Hide it instead.' },
        { status: 409 }
      )
    }
    await deleteOrderMenuItem(id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Order-menu item delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
