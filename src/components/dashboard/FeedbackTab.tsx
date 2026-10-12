'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  MessageSquareHeart,
  User,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Search,
  MessageCircle,
  ExternalLink,
  Table2,
  Clock,
  Sparkles,
} from 'lucide-react'

export interface PrivateFeedbackItem {
  id: string
  sessionId?: string
  category: string
  message: string
  contactName: string | null
  contactValue: string | null
  contactConsent: boolean
  isComplaint?: boolean
  status?: string // 'pending' | 'resolved' | 'contacted'
  tableNumber?: string
  source?: string
  adminNote?: string
  createdAt: string
  updatedAt?: string
}

interface FeedbackTabProps {
  feedbackList: PrivateFeedbackItem[]
}

const CATEGORY_COLORS: Record<string, string> = {
  complaint: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  food: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  service: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  waiting_time: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cleanliness: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  billing: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  staff: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  other: 'bg-slate-800 text-slate-300 border-slate-700',
}

export default function FeedbackTab({ feedbackList: initialList }: FeedbackTabProps) {
  const [items, setItems] = useState<PrivateFeedbackItem[]>(initialList)
  const [filter, setFilter] = useState<'all' | 'complaints' | 'pending' | 'resolved'>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/business/feedback')
      if (res.ok) {
        const fresh = await res.json()
        if (Array.isArray(fresh)) {
          setItems(fresh)
        }
      }
    } catch (e) {
      console.warn('Failed to refresh feedback inbox:', e)
    } finally {
      setRefreshing(false)
    }
  }

  const handleToggleStatus = async (item: PrivateFeedbackItem) => {
    const nextStatus = item.status === 'resolved' ? 'pending' : 'resolved'
    setActionBusyId(item.id)

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
    )

    try {
      const res = await fetch(`/api/business/feedback/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!res.ok) {
        // Revert on failure
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i))
        )
      }
    } catch {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i))
      )
    } finally {
      setActionBusyId(null)
    }
  }

  // Analytics counts
  const totalCount = items.length
  const complaints = items.filter((i) => i.isComplaint || i.category === 'complaint')
  const complaintsCount = complaints.length
  const pendingComplaints = complaints.filter((i) => i.status !== 'resolved')
  const pendingCount = pendingComplaints.length
  const resolvedCount = items.filter((i) => i.status === 'resolved').length

  // Filtered display list
  const filteredList = items.filter((item) => {
    const isComp = item.isComplaint || item.category === 'complaint'
    const isPend = item.status !== 'resolved'

    if (filter === 'complaints' && !isComp) return false
    if (filter === 'pending' && !isPend) return false
    if (filter === 'resolved' && item.status !== 'resolved') return false

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      const matchesMsg = item.message.toLowerCase().includes(q)
      const matchesName = (item.contactName || '').toLowerCase().includes(q)
      const matchesPhone = (item.contactValue || '').toLowerCase().includes(q)
      const matchesCategory = (item.category || '').toLowerCase().includes(q)
      if (!matchesMsg && !matchesName && !matchesPhone && !matchesCategory) {
        return false
      }
    }

    return true
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Customer Complaints &amp; Feedback</h2>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time direct customer complaints, management escalations, and confidential reviews
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Items</div>
          <div className="text-xl font-black text-white mt-1">{totalCount}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-900/40 backdrop-blur-xl">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Complaints
          </div>
          <div className="text-xl font-black text-rose-300 mt-1">{complaintsCount}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-900/40 backdrop-blur-xl">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Pending Action
          </div>
          <div className="text-xl font-black text-amber-300 mt-1">{pendingCount}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 backdrop-blur-xl">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolved
          </div>
          <div className="text-xl font-black text-emerald-300 mt-1">{resolvedCount}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Items ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('complaints')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'complaints'
                ? 'bg-rose-600 text-white shadow-md font-bold'
                : 'bg-slate-900/60 text-rose-400 hover:bg-slate-900 border border-rose-900/40'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Complaints ({complaintsCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-amber-600 text-white shadow-md font-bold'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Pending Action ({pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-md font-bold'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, message…"
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Items List */}
      {filteredList.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardContent className="py-16 text-center text-slate-400 space-y-2">
            <MessageSquareHeart className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No items match your filter</p>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              {search
                ? 'Try clearing the search query or selecting a different filter.'
                : 'Direct complaints and private feedback submitted by customers will show up here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredList.map((item) => {
            const isComplaint = item.isComplaint || item.category === 'complaint'
            const isResolved = item.status === 'resolved'
            const badgeClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other

            // Clean phone digits for WhatsApp and Tel
            const cleanDigits = (item.contactValue || '').replace(/\D/g, '')
            const intlPhone = cleanDigits.startsWith('91') ? cleanDigits : `91${cleanDigits}`
            const whatsappText = encodeURIComponent(
              `Hello ${item.contactName || 'Guest'}, this is the Manager at Biryani Badshah regarding your complaint/feedback: `
            )

            return (
              <Card
                key={item.id}
                className={`transition-all duration-200 backdrop-blur-xl ${
                  isComplaint && !isResolved
                    ? 'border-rose-500/50 bg-gradient-to-br from-rose-950/20 via-slate-900/80 to-slate-900/60 shadow-lg shadow-rose-950/30'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <CardHeader className="pb-3 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Complaint Pill */}
                    {isComplaint ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-black border border-rose-500/60 bg-rose-500/20 text-rose-300 uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        DIRECT COMPLAINT
                      </span>
                    ) : (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass} uppercase tracking-wider`}
                      >
                        {item.category.replace('_', ' ')}
                      </span>
                    )}

                    {/* Table Pill if present */}
                    {item.tableNumber && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Table2 className="w-3 h-3" />
                        Table {item.tableNumber}
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="text-xs text-slate-400 flex items-center gap-1 ml-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Status Indicator & Quick Toggle */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {isResolved ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolved
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        Pending Action
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={actionBusyId === item.id}
                      onClick={() => handleToggleStatus(item)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isResolved
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {actionBusyId === item.id ? (
                        'Updating…'
                      ) : isResolved ? (
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Reopen
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                        </span>
                      )}
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Complaint / Feedback Body */}
                  <div
                    className={`p-4 rounded-xl border leading-relaxed text-sm ${
                      isComplaint
                        ? 'bg-rose-950/20 border-rose-900/30 text-rose-100'
                        : 'bg-slate-950/50 border-slate-800/60 text-slate-200'
                    }`}
                  >
                    &ldquo;{item.message}&rdquo;
                  </div>

                  {/* Customer Information & One-Click Contact Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {item.contactName && (
                        <span className="flex items-center gap-1.5 font-bold text-white">
                          <User className="w-3.5 h-3.5 text-rose-400" />
                          <span>{item.contactName}</span>
                        </span>
                      )}

                      {item.contactValue && (
                        <span className="flex items-center gap-1.5 font-mono text-slate-300">
                          {item.contactValue.includes('@') ? (
                            <Mail className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>{item.contactValue}</span>
                        </span>
                      )}

                      {item.contactConsent && (
                        <span className="text-[10px] text-emerald-400/90 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" /> Consent Granted
                        </span>
                      )}
                    </div>

                    {/* Quick Call & WhatsApp Action Buttons */}
                    {cleanDigits.length >= 10 && (
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Call Customer Directly */}
                        <a
                          href={`tel:${cleanDigits}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-md transition-all active:scale-95"
                          title="Call customer directly"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>

                        {/* WhatsApp Customer Directly */}
                        <a
                          href={`https://wa.me/${intlPhone}?text=${whatsappText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                          title="Message customer on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
