'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertTriangle, ArrowLeft, CheckCircle2, ShieldCheck, Receipt, ShoppingBag } from 'lucide-react'
import { formatPaise, isValidIndianPhone } from '@/lib/ordering/rules.mjs'
import { loadCart, clearCart, type CartLine } from '@/lib/ordering/cart'

interface QuoteItem {
  id: string
  name: string
  pricePaise: number
  options: Array<{ id: string; name: string; type: string; required: boolean; min: number; max: number; choices: Array<{ id: string; name: string; pricePaise: number }> }>
}

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = params.slug
  const token = searchParams.get('token') || ''
  const tableParam = searchParams.get('table') || ''

  const [cart, setCart] = useState<CartLine[]>(() => loadCart(slug, tableParam || null))
  const [menu, setMenu] = useState<QuoteItem[]>([])
  const [taxRateBps, setTaxRateBps] = useState(500)
  const [chargePaise, setChargePaise] = useState(0)
  const [tableLabel, setTableLabel] = useState<string | null>(tableParam || null)
  const [contactPhone, setContactPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('rp_customer_name') || ''
    } catch {
      return ''
    }
  })
  const [phone, setPhone] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('rp_customer_phone') || ''
    } catch {
      return ''
    }
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [priceConflict, setPriceConflict] = useState<{ quote: { totalPaise: number } } | null>(null)

  useEffect(() => {
    const q = new URLSearchParams()
    q.set('slug', slug)
    if (token) q.set('token', token)
    if (tableParam) q.set('table', tableParam)
    fetch(`/api/public/order-menu?${q.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Checkout unavailable')
        setMenu(data.items || [])
        setTaxRateBps(data.taxRateBps ?? 500)
        setChargePaise(data.serviceChargePaise ?? 0)
        const resolvedTable = data.table?.label || tableParam || null
        setTableLabel(resolvedTable)
        if (resolvedTable) {
          const tableCart = loadCart(slug, resolvedTable)
          setCart(tableCart)
        }
        setContactPhone(data.contactPhone || null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Checkout unavailable'))
      .finally(() => setLoading(false))
  }, [slug, token, tableParam])

  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu])

  const preview = useMemo(() => {
    const lines = cart
      .map((l) => {
        const item = menuById.get(l.itemId)
        if (!item) return null
        const optTotal = l.selections.reduce((s, sel) => {
          const g = item.options.find((g) => g.id === sel.groupId)
          return s + (g?.choices.find((c) => c.id === sel.optionId)?.pricePaise || 0)
        }, 0)
        const lineTotal = (item.pricePaise + optTotal) * l.quantity
        return { line: l, item, lineTotal }
      })
      .filter((x): x is { line: CartLine; item: QuoteItem; lineTotal: number } => x !== null)
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
    const tax = Math.round((subtotal * taxRateBps) / 10000)
    return { lines, subtotal, tax, charge: chargePaise, total: subtotal + tax + chargePaise }
  }, [cart, menuById, taxRateBps, chargePaise])

  const phoneValid = isValidIndianPhone(phone)
  const canSubmit = name.trim().length > 0 && phoneValid && cart.length > 0 && !submitting

  const placeOrder = async (confirmUpdatedTotal: boolean) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      let idemKey = sessionStorage.getItem(`rp_idem_${slug}`)
      if (!idemKey) {
        idemKey = crypto.randomUUID()
        sessionStorage.setItem(`rp_idem_${slug}`, idemKey)
      }
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          tableToken: token || null,
          tableLabel: tableLabel || undefined,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          notes: notes.trim() || undefined,
          idempotencyKey: idemKey,
          clientTotalPaise: preview.total,
          confirmUpdatedTotal,
          items: cart.map((l) => ({ itemId: l.itemId, quantity: l.quantity, selections: l.selections })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.code === 'PRICE_CHANGED') {
        setPriceConflict({ quote: data.quote })
        setSubmitting(false)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Could not place order')
      sessionStorage.removeItem(`rp_idem_${slug}`)
      clearCart(slug, tableLabel)
      const confirmationParams = new URLSearchParams()
      confirmationParams.set('accessToken', data.accessToken)
      if (token) confirmationParams.set('token', token)
      if (tableLabel) confirmationParams.set('table', tableLabel)
      const track = `/order/${slug}/confirmation/${data.orderId}?${confirmationParams.toString()}`
      try {
        localStorage.setItem(`rp_order_${data.orderId}`, data.accessToken)
        localStorage.setItem('rp_customer_name', name.trim())
        localStorage.setItem('rp_customer_phone', phone.trim())
      } catch { /* ignore */ }
      router.push(track)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not place order')
      setSubmitting(false)
    }
  }

  const menuParams = new URLSearchParams()
  if (token) menuParams.set('token', token)
  if (tableLabel) menuParams.set('table', tableLabel)
  const menuHref = `/order/${slug}/menu${menuParams.toString() ? `?${menuParams.toString()}` : ''}`

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-3 text-stone-500">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-600" />
          <p className="text-sm font-medium">Preparing checkout…</p>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <p className="text-sm text-stone-600">{error}</p>
          <Link href={menuHref} className="text-sm text-amber-700 font-bold underline">Back to menu</Link>
        </div>
      </div>
    )
  }
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="font-extrabold text-lg text-stone-900">Your Tray is Empty</h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            {tableLabel ? `Choose delicious Biryani & Mughlai specialties for Table ${tableLabel}.` : 'Select your favorite dishes to begin your order.'}
          </p>
          <Link href={menuHref} className="inline-block px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md shadow-amber-600/20 transition-colors">
            Browse Menu
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-10">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 px-3 py-2.5">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Link href={menuHref} className="p-2 rounded-lg hover:bg-stone-100 transition-colors" aria-label="Back to menu">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-extrabold text-base">Checkout{tableLabel ? ` • Table ${tableLabel}` : ''}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 space-y-4">
        {/* Order Summary */}
        <section className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-sm font-extrabold flex items-center gap-1.5"><Receipt className="w-4 h-4 text-amber-600" /> Order Summary</h2>
          {preview.lines.map(({ line, item, lineTotal }) => {
            const chosenOptions = line.selections
              .map((s) => item.options.find((g) => g.id === s.groupId)?.choices.find((c) => c.id === s.optionId)?.name)
              .filter(Boolean)
              .join(', ')

            return (
              <div key={line.key} className="space-y-0.5">
                <div className="flex justify-between text-sm gap-2">
                  <span className="text-stone-800 font-medium">{line.quantity} × {item.name}</span>
                  <span className="font-bold shrink-0 text-stone-900">{formatPaise(lineTotal)}</span>
                </div>
                {chosenOptions && (
                  <p className="text-[11px] text-stone-500 pl-4 font-normal">{chosenOptions}</p>
                )}
              </div>
            )
          })}
          <div className="border-t border-stone-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600"><span>Subtotal</span><span>{formatPaise(preview.subtotal)}</span></div>
            <div className="flex justify-between text-stone-600"><span>Tax ({(taxRateBps / 100).toFixed(1)}%)</span><span>{formatPaise(preview.tax)}</span></div>
            {preview.charge > 0 && <div className="flex justify-between text-stone-600"><span>Charges</span><span>{formatPaise(preview.charge)}</span></div>}
            <div className="flex justify-between font-extrabold text-lg pt-1"><span>Total</span><span className="text-amber-700">{formatPaise(preview.total)}</span></div>
          </div>
        </section>

        {/* Price conflict */}
        {priceConflict && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="font-extrabold text-amber-900 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Prices changed</p>
            <p className="text-amber-800">Updated total is {formatPaise(priceConflict.quote.totalPaise)}. Confirm to place the order at the new total.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPriceConflict(null)} className="flex-1 h-10 rounded-xl border border-amber-400 text-amber-900 font-bold text-sm cursor-pointer hover:bg-amber-100 transition-colors">Review</button>
              <button type="button" onClick={() => { setPriceConflict(null); placeOrder(true) }} className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm cursor-pointer transition-colors">Confirm &amp; Order</button>
            </div>
          </div>
        )}

        {/* Customer Details */}
        <section className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <h2 className="text-sm font-extrabold">Your Details</h2>
          <div className="space-y-1.5">
            <label htmlFor="co-name" className="text-xs font-bold text-stone-700">Your Name *</label>
            <input id="co-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aman Kumar" maxLength={100} className="w-full h-11 px-3.5 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="co-phone" className="text-xs font-bold text-stone-700">Mobile Number *</label>
            <div className="flex items-center rounded-xl bg-stone-50 border border-stone-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
              <span className="px-3.5 text-xs font-extrabold text-stone-600 border-r border-stone-200">+91</span>
              <input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 13))} inputMode="numeric" placeholder="10-digit mobile" className="w-full h-11 px-3.5 bg-transparent text-sm focus:outline-none" />
            </div>
            {phone.length > 0 && !phoneValid && <p className="text-[11px] text-rose-600 font-medium">Enter a valid 10-digit number starting with 6–9.</p>}
            {phoneValid && <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Valid format</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="co-notes" className="text-xs font-bold text-stone-700">Order Note (optional)</label>
            <textarea id="co-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Less spicy, no onion…" maxLength={280} rows={2} className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none transition-all" />
          </div>
        </section>

        {submitError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {submitError}
          </div>
        )}

        <button type="button" onClick={() => placeOrder(false)} disabled={!canSubmit} className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-extrabold shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.99] animate-in fade-in slide-in-from-bottom-4 duration-300">
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Placing order…</> : <><CheckCircle2 className="w-5 h-5" /> Confirm Order • {formatPaise(preview.total)}</>}
        </button>
        <p className="text-[11px] text-stone-500 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Pay at counter after ordering. {contactPhone ? `Help: ${contactPhone}` : ''}
        </p>
      </main>
    </div>
  )
}
