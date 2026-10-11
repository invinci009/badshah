import { NextRequest, NextResponse } from 'next/server'
import { getTables, createTable, updateTable, deleteTable } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { tableCreateSchema, tablePatchSchema } from '@/lib/ordering/validation'

async function authenticate(request: NextRequest) {
  return getSessionFromRequest(request)
}

export async function GET(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const tables = await getTables(true)
    return NextResponse.json(tables, { status: 200 })
  } catch (error) {
    console.error('Tables GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = tableCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid table data', details: parsed.error.flatten() }, { status: 400 })
    }
    const table = await createTable({ label: parsed.data.label.trim(), description: parsed.data.description?.trim() })
    return NextResponse.json(table, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Table creation error'
    if (msg.includes('conflicts with') || msg.includes('already exists')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    console.error('Table creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = tablePatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { id, ...updates } = parsed.data
    const clean: Record<string, unknown> = {}
    if (updates.label !== undefined) clean.label = updates.label.trim()
    if (updates.description !== undefined) clean.description = updates.description?.trim() || undefined
    if (updates.active !== undefined) clean.active = updates.active
    if (updates.state !== undefined) clean.state = updates.state
    await updateTable(id, clean)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Table update error'
    if (msg.includes('conflicts with') || msg.includes('already exists')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    console.error('Table update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await authenticate(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')
    if (!id) {
      const body = await request.json().catch(() => ({}))
      id = body?.id
    }
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid table id' }, { status: 400 })
    }
    await deleteTable(id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    console.error('Table delete error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
