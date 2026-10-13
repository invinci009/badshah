'use client'

import { useState } from 'react'
import {
  X,
  Phone,
  MessageCircle,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  User,
  FileText,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

interface ComplaintModalProps {
  isOpen: boolean
  onClose: () => void
  restaurantName?: string
  helplinePhone?: string
  slug?: string
}

const COMPLAINT_CATEGORIES = [
  { id: 'food', label: '🍲 Food Quality' },
  { id: 'service', label: '⏱️ Service / Delay' },
  { id: 'billing', label: '💳 Billing / Pricing' },
  { id: 'cleanliness', label: '✨ Cleanliness' },
  { id: 'staff', label: '🤝 Staff Behavior' },
  { id: 'other', label: '📝 Other Concern' },
]

export default function ComplaintModal({
  isOpen,
  onClose,
  restaurantName = 'Biryani Badshah',
  helplinePhone = '+91 96939 99890',
  slug,
}: ComplaintModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState('food')
  const [complaint, setComplaint] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [complaintId, setComplaintId] = useState<string | null>(null)

  if (!isOpen) return null

  // Clean digits for tel and whatsapp
  const cleanPhone = helplinePhone.replace(/\D/g, '')
  const intlPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`
  const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(
    `Hello ${restaurantName} Management, I am dining at your restaurant and would like to report an urgent issue / complaint: `
  )}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter your name')
      return
    }

    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length < 10) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }

    if (!complaint.trim() || complaint.trim().length < 5) {
      setError('Please describe your issue in a few words (at least 5 characters)')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/public/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          complaint: complaint.trim(),
          category,
          slug,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint')
      }

      setComplaintId(data.id || null)
      setIsSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit complaint. Please call us directly.'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetAndClose = () => {
    setIsSuccess(false)
    setError(null)
    setName('')
    setPhone('')
    setComplaint('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complaint-modal-title"
      >
        {/* Header with vibrant escalation badge */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-br from-rose-950 via-stone-900 to-amber-950 text-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400 shadow-inner">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 id="complaint-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Manager Escalation &amp; Support
                </h2>
                <p className="text-[11px] text-amber-200/80 font-medium">
                  {restaurantName} • Direct Redressal Channel
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-stone-900">Complaint Registered</h3>
                <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                  Thank you for speaking up, <strong className="text-stone-900 font-semibold">{name}</strong>. Your complaint has been delivered straight to the restaurant owner &amp; head manager.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 text-left space-y-2 max-w-sm mx-auto">
                <div className="flex items-center justify-between text-xs text-stone-500 border-b border-stone-200/70 pb-2">
                  <span>Status:</span>
                  <span className="font-bold text-rose-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                    Pending Manager Action
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Registered Mobile:</span>
                  <span className="font-bold text-stone-900">{phone}</span>
                </div>
                {complaintId && (
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>Reference ID:</span>
                    <span className="font-mono text-[10px] text-stone-500">{complaintId.slice(0, 10)}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
                <a
                  href={`tel:${cleanPhone}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Helpline Now</span>
                </a>

                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="flex-1 inline-flex items-center justify-center h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Option 1: Direct Live Actions (Call or Text) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Option 1: Contact Admin Directly
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Fastest
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Call Admin Directly */}
                  <a
                    href={`tel:${cleanPhone}`}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50/80 hover:bg-amber-100/90 border border-amber-200/80 text-amber-950 transition-all cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-950 flex items-center gap-1">
                        <span>Call Admin</span>
                        <ChevronRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-[11px] text-amber-800/90 font-medium truncate">
                        {helplinePhone}
                      </p>
                    </div>
                  </a>

                  {/* Text / WhatsApp Admin Directly */}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-200/80 text-emerald-950 transition-all cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                        <span>WhatsApp / Text</span>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-[11px] text-emerald-800/90 font-medium truncate">
                        Chat with Management
                      </p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-stone-200 w-full" />
                <span className="bg-white px-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest shrink-0">
                  Or Submit Formal Complaint
                </span>
                <div className="border-t border-stone-200 w-full" />
              </div>

              {/* Option 2: Formal Complaint Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Name & Phone inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-stone-400" />
                      <span>Your Name <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Amanullah"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-rose-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span>Mobile Number <span className="text-rose-500">*</span></span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs font-bold text-stone-400 select-none">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        inputMode="numeric"
                        placeholder="10-digit number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full h-10 pl-11 pr-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-rose-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Category selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700">
                    What is this complaint regarding?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {COMPLAINT_CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-all border cursor-pointer ${
                          category === c.id
                            ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold shadow-xs'
                            : 'bg-stone-50 border-stone-200/70 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Complaint textarea */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-stone-400" />
                      <span>Complaint Description <span className="text-rose-500">*</span></span>
                    </span>
                    <span className="text-[10px] text-stone-400 font-normal">
                      Escalated immediately
                    </span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="Describe what went wrong (e.g. food taste, cold item, excessive wait time, overcharge)..."
                    className="w-full p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-rose-500 focus:bg-white transition-all resize-none leading-relaxed"
                  />
                </div>

                {/* Submit action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim() || !phone.trim() || !complaint.trim()}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700 hover:from-rose-700 hover:to-amber-800 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-600/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting to Management…</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Complaint to Management</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-stone-400 text-center mt-1.5">
                    Your complaint is private, logged in the admin panel, and kept confidential.
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
