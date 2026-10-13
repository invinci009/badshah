'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, Check, ExternalLink, MessageSquareHeart, Sparkles, Loader2, ArrowRight, RotateCcw } from 'lucide-react'
import { trackClientEvent } from '@/lib/client/telemetry'

interface ReviewDraftCardProps {
  sessionId: string
  slug?: string
  restaurantName: string
  googleReviewUrl?: string | null
  initialDraftText?: string
  onOpenPrivateFeedback: () => void
  onDone: () => void
}

export default function ReviewDraftCard({
  sessionId,
  slug,
  restaurantName,
  googleReviewUrl,
  initialDraftText = '',
  onOpenPrivateFeedback,
  onDone,
}: ReviewDraftCardProps) {
  const [draft, setDraft] = useState(initialDraftText)
  const [isLoadingDraft, setIsLoadingDraft] = useState(!initialDraftText)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const pickDraftText = (data: unknown): string | null => {
    if (!data || typeof data !== 'object') return null
    const d = data as Record<string, unknown>
    // Server returns camelCase; accept snake_case too
    const text = d.finalText ?? d.final_text ?? d.originalText ?? d.original_text
    return typeof text === 'string' && text.trim() ? text : null
  }

  // Fetch draft from API if not pre-populated
  useEffect(() => {
    if (!draft && sessionId) {
      fetch(`/api/public/sessions/${sessionId}/draft`, {
        method: 'POST',
        credentials: 'same-origin',
      })
        .then((res) => res.json())
        .then((data) => {
          setDraft(
            pickDraftText(data) ??
              `Had a wonderful dining experience at ${restaurantName || 'Biryani Badshah'} today! The food was flavorful and freshly prepared, and the service was warm and attentive. Highly recommended!`
          )
        })
        .catch((err) => {
          console.warn('Draft load error:', err)
          setDraft(`Had a wonderful dining experience at ${restaurantName || 'Biryani Badshah'} today! The food was flavorful and freshly prepared, and the service was warm and attentive. Highly recommended!`)
        })
        .finally(() => setIsLoadingDraft(false))
    }
  }, [sessionId, draft])

  // Regenerate a fresh unique draft via Groq
  const handleRegenerate = async () => {
    if (!sessionId || isRegenerating) return
    setIsRegenerating(true)
    try {
      const res = await fetch(`/api/public/sessions/${sessionId}/draft?refresh=1`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()
      const text = pickDraftText(data)
      if (text) {
        setDraft(text)
        setToastMessage('Fresh review generated!')
        setTimeout(() => setToastMessage(null), 2500)
      } else {
        setToastMessage('Could not regenerate right now. Try again.')
        setTimeout(() => setToastMessage(null), 2500)
      }
    } catch (e) {
      console.warn('Draft regenerate error:', e)
      setToastMessage('Connection error. Please try again.')
      setTimeout(() => setToastMessage(null), 2500)
    } finally {
      setIsRegenerating(false)
    }
  }

  // Save changes with 1s debounce
  const handleDraftChange = (newText: string) => {
    setDraft(newText)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(() => {
      fetch(`/api/public/sessions/${sessionId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ final_text: newText }),
      }).catch((e) => console.warn('Draft auto-save error:', e))
    }, 1000)
  }

  // Copy text helper
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(draft)
      setIsCopied(true)
      setHasCopied(true)
      setToastMessage('Review copied! You can now post on Google.')
      setTimeout(() => {
        setIsCopied(false)
        setToastMessage(null)
      }, 3500)
    } catch {
      setHasCopied(true)
      setToastMessage('Ready to post on Google!')
    }
  }

  // Primary Action: Share on Google (only accessible after copying)
  const handleShareOnGoogle = async () => {
    try {
      await fetch(`/api/public/sessions/${sessionId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_text: draft }),
      })
    } catch {}

    try {
      await navigator.clipboard.writeText(draft)
    } catch {}

    trackClientEvent(sessionId, 'GOOGLE_CLICKED')

    if (googleReviewUrl) {
      window.open(googleReviewUrl, '_blank', 'noopener,noreferrer')
    }

    onDone()
  }

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  return (
    <div className="relative z-10 w-full max-w-md mx-auto py-6 px-4 sm:px-0 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-stone-900 border border-stone-800 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Card Header & Disclaimer */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>AI Assisted Review Draft</span>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight sm:text-3xl">
          Your Dining Review
        </h1>
        <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
          Crafted based on your ratings &amp; selected dishes. Feel free to tweak it before sharing.
        </p>
      </div>

      {/* Editable Draft Text Area Card */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-[0_20px_50px_-10px_rgba(180,83,9,0.08),0_4px_16px_rgba(0,0,0,0.03)] space-y-4">
        {isLoadingDraft ? (
          <div className="py-12 text-center text-stone-500 space-y-3">
            <Loader2 className="w-7 h-7 mx-auto animate-spin text-amber-600" />
            <p className="text-xs font-medium">Preparing your custom review draft...</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="review-draft-text" className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                <span>Review Draft</span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={isLoadingDraft || isRegenerating}
                    className="text-[11px] text-amber-800 font-semibold inline-flex items-center gap-1 hover:text-amber-900 disabled:opacity-50 cursor-pointer transition-colors"
                    title="Generate a fresh unique review"
                  >
                    {isRegenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    <span>{isRegenerating ? 'Writing…' : 'Regenerate'}</span>
                  </button>
                  <span className="text-[11px] text-amber-800 font-medium">Tap text to edit freely</span>
                </span>
              </label>
              <textarea
                id="review-draft-text"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder="Write or edit your review..."
                rows={4}
                aria-label="Edit review draft"
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 resize-none transition-all leading-relaxed shadow-xs"
              />
              <div className="flex items-center justify-between text-[11px] text-stone-400 px-1">
                <span>{wordCount} words</span>
                <span>Optional public review</span>
              </div>
            </div>
          </>
        )}

        {/* 2-Step Copy & Redirect Action Flow */}
        <div className="pt-2 space-y-3 border-t border-stone-100">
          {/* Step indicator badges */}
          <div className="flex items-center justify-center gap-2 text-xs py-1">
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                hasCopied
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100/70 text-amber-900 border border-amber-300 shadow-xs'
              }`}
            >
              {hasCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Step 1: Copied</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                  <span>Step 1: Copy Review</span>
                </>
              )}
            </span>

            <ArrowRight className="w-3.5 h-3.5 text-stone-400" />

            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                hasCopied
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 animate-pulse'
                  : 'bg-stone-100 text-stone-400 border border-stone-200'
              }`}
            >
              <span>Step 2: Paste on Google</span>
            </span>
          </div>

          {!hasCopied ? (
            /* STEP 1: Copy Button MUST be clicked first */
            <div className="space-y-2 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={copyToClipboard}
                disabled={isLoadingDraft}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-700 hover:to-amber-700 active:scale-[0.99] text-white font-bold shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer text-sm"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Review Text</span>
              </button>

              <p className="text-[11px] text-stone-500 text-center flex items-center justify-center gap-1.5 py-0.5">
                <span>📋 Tap button above to copy — Google review button will unlock next.</span>
              </p>
            </div>
          ) : (
            /* STEP 2: Google Review button ONLY shown after copying */
            <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {googleReviewUrl ? (
                <button
                  type="button"
                  onClick={handleShareOnGoogle}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 hover:from-amber-700 hover:to-amber-700 active:scale-[0.99] text-white font-bold shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer text-sm"
                >
                  <span>Share on Google Reviews</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onDone}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Done</span>
                </button>
              )}

              {/* Helper notice */}
              <p className="text-[11px] text-emerald-700 text-center flex items-center justify-center gap-1.5 py-0.5 font-medium">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Text copied! Simply paste (tap &amp; hold or Ctrl+V) on Google Reviews.</span>
              </p>

              {/* Secondary button to re-copy if edited */}
              <button
                type="button"
                onClick={copyToClipboard}
                className="w-full h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 font-semibold flex items-center justify-center gap-2 cursor-pointer text-xs transition-colors"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied again!' : 'Copy text again'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Actions */}
      <div className="text-center pt-1 space-y-3">
        <button
          type="button"
          onClick={onOpenPrivateFeedback}
          className="inline-flex items-center gap-1.5 text-xs text-amber-800 hover:text-amber-900 font-semibold hover:underline underline-offset-4 cursor-pointer transition-all"
        >
          <MessageSquareHeart className="w-3.5 h-3.5 text-amber-600" />
          <span>Send private feedback directly to the restaurant manager</span>
        </button>

        <div>
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-stone-500 hover:text-stone-800 py-1 px-3 rounded-lg hover:bg-stone-100 cursor-pointer transition-colors"
          >
            No thanks, I&apos;m done
          </button>
        </div>

        {slug && (
          <div className="pt-2 border-t border-stone-200">
            <a
              href={`/r/${slug}?new=1`}
              className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Submit another review</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
