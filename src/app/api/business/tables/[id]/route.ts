import { NextRequest, NextResponse } from 'next/server'
import { deleteTable, getTable } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing table ID' }, { status: 400 })
    const table = await getTable(id)
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

    await deleteTable(id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    console.error('Table delete error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
