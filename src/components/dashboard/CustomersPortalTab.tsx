'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Users,
  Phone,
  MessageCircle,
  Star,
  Search,
  Filter,
  Download,
  Utensils,
  ExternalLink,
  Calendar,
  ThumbsUp,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Sparkles,

  Copy,
  Check,
  UserCheck,
  Eye,
  X,
  PhoneCall,
} from 'lucide-react'

export interface CustomerDetail {
  sessionId: string
  name: string
  phone: string
  hasPhone: boolean
  optInMarketing: boolean
  overallRating: number | null
  foodRating: number | null
  serviceRating: number | null
  orderedDishes: string[]
  likedAspects: string[]
  draftText: string | null
  googleClicked: boolean
  campaignName: string
  respondedAt: string
  privateFeedbackMessage?: string | null
  status: string
}

interface CustomersPortalTabProps {
  customers: CustomerDetail[]
  restaurantName: string
}

const EMOJIS: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😍',
}

export default function CustomersPortalTab({ customers, restaurantName }: CustomersPortalTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRating, setFilterRating] = useState<number | 'all'>('all')
  const [onlyWithPhone, setOnlyWithPhone] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null)
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)

  // Copy helper
  const handleCopyPhone = (phone: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(phone)
    setCopiedPhone(phone)
    setTimeout(() => setCopiedPhone(null), 2500)
  }

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = c.name.toLowerCase().includes(q)
        const matchesPhone = c.phone.includes(q)
        const matchesDish = c.orderedDishes.some((d) => d.toLowerCase().includes(q))
        if (!matchesName && !matchesPhone && !matchesDish) return false
      }

      // Rating filter
      if (filterRating !== 'all') {
        if (c.overallRating !== filterRating) return false
      }

      // Phone filter
      if (onlyWithPhone && !c.hasPhone) {
        return false
      }

      return true
    })
  }, [customers, searchQuery, filterRating, onlyWithPhone])

  // Aggregate Metrics
  const totalCustomers = customers.length
  const totalWithPhone = customers.filter((c) => c.hasPhone).length
  const phoneConversionRate = totalCustomers > 0 ? Math.round((totalWithPhone / totalCustomers) * 100) : 0
  const total5StarVips = customers.filter((c) => c.overallRating === 5 && c.hasPhone).length
  const totalCritical = customers.filter((c) => (c.overallRating ?? 5) <= 2 && c.hasPhone).length
  const totalWhatsAppOptIns = customers.filter((c) => c.optInMarketing).length

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Name', 'Phone', 'Rating', 'Food Rating', 'Service Rating', 'Ordered Dishes', 'Campaign', 'Google Clicked', 'Date', 'Review Draft']
    const rows = filteredCustomers.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      c.overallRating ?? '',
      c.foodRating ?? '',
      c.serviceRating ?? '',
      `"${c.orderedDishes.join(', ').replace(/"/g, '""')}"`,
      `"${c.campaignName.replace(/"/g, '""')}"`,
      c.googleClicked ? 'Yes' : 'No',
      `"${new Date(c.respondedAt).toLocaleDateString()}"`,
      `"${(c.draftText || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `biryani-badshah-customers-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Pre-generate WhatsApp message for a diner
  const getWhatsAppLink = (c: CustomerDetail) => {
    const cleanNum = c.phone.replace(/\D/g, '')
    const phoneWithCountry = cleanNum.startsWith('91') ? cleanNum : `91${cleanNum}`
    const greeting = c.overallRating === 5
      ? `Greetings from ${restaurantName}! Dear ${c.name || 'Valued Guest'}, thank you so much for your wonderful 5-star rating! Your kind words mean a lot to the chef and entire team. We look forward to serving you again soon. 🙏`
      : `Greetings from ${restaurantName}! Dear ${c.name || 'Valued Guest'}, thank you for dining with us and sharing your valuable feedback. We truly appreciate it and hope to welcome you back soon! 🙏`
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(greeting)}`
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Customer Details &amp; Diners Portal
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              CRM Directory
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified mobile numbers, contact information, dining preferences, and feedback from {restaurantName} guests
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredCustomers.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export CSV ({filteredCustomers.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Customers */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Total Diners</span>
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{totalCustomers}</span>
              <span className="text-xs text-slate-400 font-medium">responded</span>
            </div>
          </CardContent>
        </Card>

        {/* Verified Phone Numbers */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Mobile Numbers</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{totalWithPhone}</span>
              <span className="text-xs text-emerald-400/80 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                {phoneConversionRate}% captured
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 5-Star VIP Diners */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">5★ VIP Diners</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Star className="w-4 h-4 fill-amber-400" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">{total5StarVips}</span>
              <span className="text-xs text-slate-400 font-medium">ready for loyalty</span>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Opt-in */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">WhatsApp Opt-in</span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-teal-300">{totalWhatsAppOptIns}</span>
              <span className="text-xs text-slate-400 font-medium">offers enabled</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Controls */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by diner name, mobile number, or dish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Rating filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setFilterRating('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterRating === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            {[5, 4, 3, 2, 1].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterRating(s)}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  filterRating === s ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}★
              </button>
            ))}
          </div>

          {/* Has Phone Toggle */}
          <button
            type="button"
            onClick={() => setOnlyWithPhone(!onlyWithPhone)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              onlyWithPhone
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Has Phone Only</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Customer Content Display */}
      {filteredCustomers.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardContent className="py-16 text-center text-slate-400 space-y-3">
            <Users className="w-10 h-10 mx-auto text-slate-600" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-200">No diners match your current filter</p>
              <p className="text-xs max-w-sm mx-auto text-slate-500">
                Try resetting the search keyword or rating filter to view all customer records.
              </p>
            </div>
            {(searchQuery || filterRating !== 'all' || onlyWithPhone) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterRating('all')
                  setOnlyWithPhone(false)
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCustomers.map((c) => {
            const initials = c.name
              ? c.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              : 'GD'

            const isHighRating = (c.overallRating ?? 0) >= 4

            return (
              <Card
                key={c.sessionId}
                className="border-slate-800 bg-slate-900/60 backdrop-blur-xl hover:border-slate-700 transition-all shadow-md group relative overflow-hidden"
              >
                <CardHeader className="pb-3 border-b border-slate-800/80">
                  <div className="flex items-start justify-between gap-3">
                    {/* Customer Monogram & Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-700 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-amber-600/20 shrink-0 border border-amber-400/30">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                            {c.name || 'Guest Diner'}
                          </CardTitle>
                          {c.overallRating === 5 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(c.respondedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span className="text-slate-500">{c.campaignName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Rating Pill */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/15 border border-amber-400/30 shrink-0">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-extrabold text-amber-300">
                        {c.overallRating ? `${c.overallRating}.0` : '—'}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3.5 space-y-3.5">
                  {/* Phone & Direct Contact Bar */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      {c.hasPhone ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-300 tracking-wide">
                            +91 {c.phone}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyPhone(c.phone, e)}
                            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Copy number"
                          >
                            {copiedPhone === c.phone ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs italic">No phone entered</span>
                      )}
                    </div>

                    {/* Contact Action Buttons */}
                    {c.hasPhone && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={getWhatsAppLink(c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>

                        <a
                          href={`tel:+91${c.phone}`}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
                          title="Call Diner"
                        >
                          <PhoneCall className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Ratings Breakdown */}
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <span>Food:</span>
                      <span className="text-white font-semibold flex items-center gap-0.5">
                        {c.foodRating ? EMOJIS[c.foodRating] : '—'} {c.foodRating ? `${c.foodRating}/5` : ''}
                      </span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <span>Service:</span>
                      <span className="text-white font-semibold">
                        {c.serviceRating ? `${c.serviceRating}/5` : '—'}
                      </span>
                    </div>
                    {c.googleClicked && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Google Shared</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Ordered Dishes Chips */}
                  {c.orderedDishes.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                        <Utensils className="w-2.5 h-2.5 text-amber-400" />
                        <span>Dishes Ordered</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.orderedDishes.map((dish) => (
                          <span
                            key={dish}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-amber-200 border border-slate-700"
                          >
                            {dish}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Draft Snippet */}
                  {c.draftText && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 italic leading-relaxed">
                      &ldquo;{c.draftText}&rdquo;
                    </div>
                  )}

                  {/* Private Feedback Message if any */}
                  {c.privateFeedbackMessage && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 space-y-1">
                      <div className="text-[10px] font-bold uppercase text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Private Manager Message</span>
                      </div>
                      <p>&ldquo;{c.privateFeedbackMessage}&rdquo;</p>
                    </div>
                  )}

                  {/* View Details Modal Trigger */}
                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Feedback Received</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(c)}
                      className="text-amber-400 hover:text-amber-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View Dossier</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Diner Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Overall</th>
                  <th className="py-3 px-4">Food</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Dishes Ordered</th>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCustomers.map((c) => (
                  <tr key={c.sessionId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{c.name || 'Guest Diner'}</span>
                        {c.overallRating === 5 && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-amber-400/20 text-amber-300 font-bold">
                            VIP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {c.hasPhone ? (
                        <span className="font-mono text-emerald-400 font-semibold">+91 {c.phone}</span>
                      ) : (
                        <span className="text-slate-500 italic">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {c.overallRating ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{c.foodRating ? EMOJIS[c.foodRating] : '—'}</td>
                    <td className="py-3 px-4">{c.serviceRating ? `${c.serviceRating}/5` : '—'}</td>
                    <td className="py-3 px-4 max-w-[200px] truncate" title={c.orderedDishes.join(', ')}>
                      {c.orderedDishes.length > 0 ? c.orderedDishes.join(', ') : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{c.campaignName}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(c.respondedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.hasPhone && (
                          <a
                            href={getWhatsAppLink(c)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Customer Detail Dossier Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white font-bold text-base flex items-center justify-center shadow-lg shadow-amber-600/20 border border-amber-400/40">
                {selectedCustomer.name
                  ? selectedCustomer.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'GD'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{selectedCustomer.name || 'Guest Diner'}</span>
                  {selectedCustomer.overallRating === 5 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      VIP DINER
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Responded on{' '}
                  {new Date(selectedCustomer.respondedAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  via {selectedCustomer.campaignName}
                </p>
              </div>
            </div>

            {/* Contact Details Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Contact &amp; Messaging Info
              </span>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-xs text-slate-400 block">Mobile Number</span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {selectedCustomer.hasPhone ? `+91 ${selectedCustomer.phone}` : 'Not provided'}
                  </span>
                </div>

                {selectedCustomer.hasPhone && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(selectedCustomer.phone)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      {copiedPhone === selectedCustomer.phone ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy</span>
                    </button>

                    <a
                      href={getWhatsAppLink(selectedCustomer)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-teal-600/25 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Message</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">WhatsApp Offers Opt-in:</span>
                <span className="font-semibold text-emerald-400">
                  {selectedCustomer.optInMarketing ? 'Yes (Opted-in)' : 'Standard Only'}
                </span>
              </div>
            </div>

            {/* Ratings Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Overall</span>
                <span className="text-lg font-bold text-amber-400">
                  {selectedCustomer.overallRating ? `${selectedCustomer.overallRating}★` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Food Experience</span>
                <span className="text-lg font-bold text-white">
                  {selectedCustomer.foodRating ? EMOJIS[selectedCustomer.foodRating] : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Hospitality</span>
                <span className="text-lg font-bold text-white">
                  {selectedCustomer.serviceRating ? `${selectedCustomer.serviceRating}/5` : '—'}
                </span>
              </div>
            </div>

            {/* Ordered Dishes */}
            {selectedCustomer.orderedDishes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">Dishes Enjoyed</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCustomer.orderedDishes.map((dish) => (
                    <span
                      key={dish}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-amber-200 border border-slate-700"
                    >
                      {dish}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Review Draft */}
            {selectedCustomer.draftText && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">Review Draft</span>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 italic leading-relaxed">
                  &ldquo;{selectedCustomer.draftText}&rdquo;
                </div>
              </div>
            )}

            {/* Private Feedback */}
            {selectedCustomer.privateFeedbackMessage && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-rose-300 block">Private Feedback</span>
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 italic leading-relaxed">
                  &ldquo;{selectedCustomer.privateFeedbackMessage}&rdquo;
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
