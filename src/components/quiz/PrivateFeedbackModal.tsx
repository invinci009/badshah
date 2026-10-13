'use client'

import { useState } from 'react'
import { X, Send, Loader2, ShieldCheck, CheckCircle2, AlertCircle, Phone } from 'lucide-react'
import { trackClientEvent } from '@/lib/client/telemetry'

interface PrivateFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  restaurantName: string
}

const CATEGORIES = [
  { key: 'food', label: 'Food quality' },
  { key: 'service', label: 'Hospitality / Service' },
  { key: 'waiting_time', label: 'Waiting time' },
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'billing', label: 'Billing / Price' },
  { key: 'other', label: 'Other' },
]

export default function PrivateFeedbackModal({
  isOpen,
  onClose,
  sessionId,
  restaurantName,
}: PrivateFeedbackModalProps) {
  const [category, setCategory] = useState<string>('food')
  const [message, setMessage] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactValue, setContactValue] = useState('')
  const [consent, setConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/public/sessions/${sessionId}/private-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          contact_name: contactName || null,
          contact_value: contactValue || null,
          contact_consent: Boolean(contactValue && consent),
        }),
      })

      if (res.ok) {
        trackClientEvent(sessionId, 'PRIVATE_FEEDBACK_SUBMITTED', { category })
        setIsSuccess(true)
        setTimeout(() => {
          setIsSuccess(false)
          onClose()
        }, 2000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to submit feedback')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-white border border-stone-200 shadow-2xl p-6 text-stone-900 space-y-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-10 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">Feedback Sent Directly</h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              Your message has been privately forwarded to the management of {restaurantName}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-stone-900">Direct Manager Feedback</h2>
              <p className="text-xs text-stone-500">
                This message goes directly to the restaurant leadership, not Google.
              </p>
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 mt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Phone className="w-3.5 h-3.5 text-amber-700" />
                  Urgent? Call manager directly:
                </span>
                <a href="tel:9693999890" className="font-bold underline hover:text-amber-700">
                  +91 96939 99890
                </a>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category Pills */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">Topic</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      category === c.key
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Area */}
            <div className="space-y-1.5">
              <label htmlFor="feedback-message" className="text-xs font-semibold text-stone-700">What went wrong or could be better?</label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what happened so we can make it right..."
                rows={3}
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white resize-none"
              />
            </div>

            {/* Optional Contact Fields */}
            <div className="space-y-2 pt-1 border-t border-stone-100">
              <span className="text-[11px] font-semibold text-stone-500 block">
                Optional: Leave contact if you want manager to follow up
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="tel"
                  placeholder="Phone or Email"
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              {contactValue && (
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-stone-600 pt-1">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>I agree to be contacted regarding this feedback</span>
                </label>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Confidential</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 hover:from-amber-700 hover:to-amber-800 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Privately</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
