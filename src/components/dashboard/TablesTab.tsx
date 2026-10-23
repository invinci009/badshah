'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table2,
  Plus,
  QrCode,
  Download,
  Copy,
  Check,
  RefreshCw,
  Ban,
  Loader2,
  ExternalLink,
  Printer,
  Trash2,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react'
import { formatTableDisplay } from '@/lib/ordering/rules.mjs'

export interface TableItem {
  id: string
  label: string
  description?: string
  active: boolean
  state: string
  activeTokenHash: string | null
  activeTokenPrefix: string | null
  createdAt: string
}

interface TablesTabProps {
  tables: TableItem[]
  portalSlug: string
  onRefresh: () => void
}

export default function TablesTab({ tables, portalSlug, onRefresh }: TablesTabProps) {
  const [newLabel, setNewLabel] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [lastIssued, setLastIssued] = useState<{ tableId: string; qrUrl: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [tableToDelete, setTableToDelete] = useState<TableItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isFreeingAll, setIsFreeingAll] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tableToDelete && !isDeleting) {
        setTableToDelete(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tableToDelete, isDeleting])

  const handleFreeAll = async () => {
    if (!confirm('Free up all dining tables and set them to Available?')) return
    setIsFreeingAll(true)
    setError(null)
    try {
      const res = await fetch('/api/business/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'free-all' }),
      })
      if (res.ok) {
        setSuccessMessage('All dining tables are now Available')
        onRefresh()
      } else {
        setError('Failed to free tables')
      }
    } catch {
      setError('Connection error')
    } finally {
      setIsFreeingAll(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newLabel.trim()
    if (!trimmed) return

    // Pre-check for duplicate/colliding tables
    const cleanNorm = (lbl: string) => {
      let c = lbl.trim().toLowerCase()
      if (c.startsWith('table')) c = c.slice(5).trim()
      if (c.startsWith('t-') || c.startsWith('t#')) c = c.slice(2).trim()
      else if (c.startsWith('t') && /^t\d+$/.test(c)) c = c.slice(1).trim()
      if (/^\d+$/.test(c)) c = String(parseInt(c, 10))
      return c
    }
    const dup = tables.find((t) => cleanNorm(t.label) === cleanNorm(trimmed))
    if (dup) {
      setError(`Table "${trimmed}" conflicts with existing Table "${dup.label}". Every table must have a unique number.`)
      return
    }

    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/business/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      if (res.ok) {
        setNewLabel('')
        setSuccessMessage(`Table "${trimmed}" created successfully.`)
        onRefresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create table')
      }
    } catch {
      setError('Connection error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggleActive = async (t: TableItem) => {
    setBusyId(t.id)
    try {
      await fetch('/api/business/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, active: !t.active }),
      })
      onRefresh()
    } finally {
      setBusyId(null)
    }
  }

  const handleCycleState = async (t: TableItem) => {
    const order = ['available', 'occupied', 'cleaning'] as const
    const next = order[(order.indexOf(t.state as (typeof order)[number]) + 1) % order.length] ?? 'available'
    handleSetState(t, next)
  }

  const handleSetState = async (t: TableItem, next: 'available' | 'occupied' | 'cleaning') => {
    setBusyId(t.id)
    try {
      await fetch('/api/business/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, state: next }),
      })
      onRefresh()
    } finally {
      setBusyId(null)
    }
  }

  const handleIssueQr = async (t: TableItem) => {
    if (!confirm(`Generate a new ordering QR for table "${t.label}"? The previous QR will stop working.`)) return
    setBusyId(t.id)
    setError(null)
    try {
      const res = await fetch(`/api/business/tables/${t.id}/qr?slug=${encodeURIComponent(portalSlug)}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        setLastIssued({ tableId: t.id, qrUrl: data.qrUrl })
        try {
          await navigator.clipboard.writeText(data.qrUrl)
        } catch { /* clipboard unavailable */ }
        onRefresh()
      } else {
        setError(data.error || 'Failed to generate QR')
      }
    } catch {
      setError('Connection error')
    } finally {
      setBusyId(null)
    }
  }

  const handleRevoke = async (t: TableItem) => {
    if (!confirm(`Revoke the QR for table "${t.label}"? Existing orders are kept; new scans will fail.`)) return
    setBusyId(t.id)
    try {
      await fetch(`/api/business/tables/${t.id}/qr`, { method: 'DELETE' })
      onRefresh()
    } finally {
      setBusyId(null)
    }
  }

  const handleDeleteTable = async () => {
    if (!tableToDelete) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/business/tables?id=${encodeURIComponent(tableToDelete.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const deletedLabel = tableToDelete.label
        setTableToDelete(null)
        setSuccessMessage(`Table "${deletedLabel}" was deleted successfully.`)
        setTimeout(() => setSuccessMessage(null), 3500)
        onRefresh()
      } else {
        setDeleteError(data.error || 'Failed to delete table')
      }
    } catch {
      setDeleteError('Connection error. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const copyQrUrl = (qrUrl: string) => {
    navigator.clipboard.writeText(qrUrl)
    setCopied(qrUrl)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Table2 className="w-5 h-5 text-amber-400" /> Tables &amp; Ordering QRs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Each table gets its own revocable ordering QR. Ordering portal slug: <span className="font-mono text-amber-400">/order/{portalSlug}</span>
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 cursor-pointer p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{error}</div>
      )}

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm text-white">Add Table</CardTitle>
            <CardDescription className="text-xs text-slate-400">e.g. T1, Family-4, Rooftop-A</CardDescription>
          </div>
          <Button
            type="button"
            onClick={handleFreeAll}
            disabled={isFreeingAll}
            className="bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold h-9 px-3.5 rounded-xl cursor-pointer shrink-0 flex items-center gap-1.5 transition-all active:scale-95 border border-emerald-500/40"
            title="Set all booked and cleaning tables to Available"
          >
            {isFreeingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Free All Tables</span>
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-3">
            <Input
              placeholder="Table label…"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs flex-1"
            />
            <Button
              type="submit"
              disabled={isCreating || !newLabel.trim()}
              className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white text-xs font-semibold h-10 px-5 rounded-xl cursor-pointer shrink-0"
            >
              {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Add Table
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((t) => {
          const issued = lastIssued?.tableId === t.id ? lastIssued.qrUrl : null
          const qrImg = `/api/business/tables/qr?tableId=${t.id}&slug=${encodeURIComponent(portalSlug)}&format=png`
          return (
            <Card key={t.id} className="border-slate-800 bg-slate-900/80 backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-slate-800/80">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <span>{formatTableDisplay(t.label)}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          t.state === 'occupied'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : t.state === 'cleaning'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {t.state === 'occupied' ? 'Booked' : t.state === 'cleaning' ? 'Cleaning' : 'Available'}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-1">
                      {t.active ? 'Active for guests' : 'Paused / Deactivated'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(t)}
                      disabled={busyId === t.id}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-colors ${t.active ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'border-slate-700 bg-slate-800/30 text-slate-400 hover:bg-slate-800'}`}
                      title={t.active ? 'Pause this table' : 'Activate this table'}
                    >
                      {t.active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setTableToDelete(t)
                      }}
                      disabled={busyId === t.id}
                      title={`Delete ${formatTableDisplay(t.label)}`}
                      aria-label={`Delete ${formatTableDisplay(t.label)}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/60 hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {/* Table State Management & One-Click Free Table */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>Table Status:</span>
                    {t.state !== 'available' && (
                      <button
                        type="button"
                        onClick={() => handleSetState(t, 'available')}
                        disabled={busyId === t.id}
                        className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                      >
                        Free Up Table
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['available', 'occupied', 'cleaning'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleSetState(t, st)}
                        disabled={busyId === t.id || t.state === st}
                        className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          t.state === st
                            ? st === 'occupied'
                              ? 'bg-amber-500 text-stone-950 shadow-xs'
                              : st === 'cleaning'
                              ? 'bg-sky-500 text-stone-950 shadow-xs'
                              : 'bg-emerald-500 text-stone-950 shadow-xs'
                            : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {st === 'available' ? 'Available' : st === 'occupied' ? 'Occupied' : 'Cleaning'}
                      </button>
                    ))}
                  </div>
                </div>
                {t.activeTokenHash ? (
                  <div className="p-3 rounded-2xl bg-white flex items-center justify-center max-w-[180px] mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrImg} alt={`Ordering QR for table ${t.label}`} className="w-32 h-32 object-contain" />
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                    No active QR — generate one below.
                  </div>
                )}

                {issued && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 break-all">
                    New QR: <span className="font-mono">{issued}</span>
                    <button type="button" onClick={() => copyQrUrl(issued)} className="ml-2 text-emerald-200 underline">
                      {copied === issued ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleIssueQr(t)}
                    disabled={busyId === t.id}
                    className="h-10 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                    {t.activeTokenHash ? 'Rotate QR' : 'Generate QR'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(t)}
                    disabled={busyId === t.id || !t.activeTokenHash}
                    className="h-10 rounded-xl border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Ban className="w-3.5 h-3.5" /> Revoke
                  </button>
                </div>

                {t.activeTokenHash && (
                  <div className="grid grid-cols-3 gap-2">
                    <a href={`${qrImg}&download=true`} download={`table-${t.label}-qr.png`} className="h-9 rounded-lg border border-slate-800 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1 hover:bg-slate-800">
                      <Download className="w-3 h-3" /> PNG
                    </a>
                    <a href={`/api/business/tables/qr?tableId=${t.id}&slug=${encodeURIComponent(portalSlug)}&format=svg&download=true`} download={`table-${t.label}-qr.svg`} className="h-9 rounded-lg border border-slate-800 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1 hover:bg-slate-800">
                      <Download className="w-3 h-3" /> SVG
                    </a>
                    <button type="button" onClick={() => window.print()} className="h-9 rounded-lg border border-slate-800 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1 hover:bg-slate-800 cursor-pointer">
                      <Printer className="w-3 h-3" /> Tent
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono">token: {t.activeTokenPrefix ? `${t.activeTokenPrefix}…` : '—'}</span>
                  <span className="flex items-center gap-1">
                    {copied === t.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </span>
                </div>

                <a
                  href={`/order/${portalSlug}?table=${encodeURIComponent(t.label)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-[11px] text-slate-400 hover:text-amber-400 transition-colors py-0.5"
                  title={`Preview portal for ${formatTableDisplay(t.label)}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>Preview portal <span className="font-semibold text-amber-400">({formatTableDisplay(t.label)})</span></span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </span>
                </a>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleCycleState(t)}
                    disabled={busyId === t.id}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Tap to cycle table state: available → occupied → cleaning"
                  >
                    <RefreshCw className={`w-3 h-3 ${busyId === t.id ? 'animate-spin' : ''}`} />
                    <span>Cycle state <span className="font-semibold text-amber-400">({t.state})</span></span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null)
                      setTableToDelete(t)
                    }}
                    disabled={busyId === t.id}
                    className="text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-all"
                    title="Delete this table panel"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete panel</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {tables.length === 0 && (
          <div className="col-span-full py-14 text-center text-slate-400 text-sm rounded-3xl bg-slate-900/50 border border-slate-800">
            No tables yet — add your first table above.
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {tableToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => !isDeleting && setTableToDelete(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient top border glow */}
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-rose-500/80 to-transparent blur-sm pointer-events-none" />

            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setTableToDelete(null)}
                disabled={isDeleting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">Delete {formatTableDisplay(tableToDelete.label)}?</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Are you sure you want to delete this table panel? This will permanently remove it from your dashboard and revoke any active QR tokens.
            </p>

            {/* Table Details Summary Box */}
            <div className="my-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Table Identifier</span>
                <span className="font-semibold text-white">{formatTableDisplay(tableToDelete.label)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current State</span>
                <span className="capitalize font-mono text-amber-400">{tableToDelete.state}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">QR Code Status</span>
                <span className={tableToDelete.activeTokenHash ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                  {tableToDelete.activeTokenHash ? 'Active QR (will be revoked)' : 'No active QR'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed flex items-start gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>Past order histories and financial records linked to this table will remain intact in your analytics.</span>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 mb-4">
                <Ban className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTableToDelete(null)}
                disabled={isDeleting}
                className="border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-xs font-semibold h-10 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteTable}
                disabled={isDeleting}
                className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold h-10 px-5 rounded-xl cursor-pointer shadow-lg shadow-rose-900/40 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete Table
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
