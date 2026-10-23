'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Gift,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Star,
  Users,
  Clock,
  Sparkles,
  Ban,
  CheckCircle2,
  Save,
  X,
  Pencil,
  AlertTriangle,
  Package,
  ShoppingBag,
} from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'

// ==============================================================================
// Loyalty & Rewards admin tab: rules, rewards catalog, customers & points,
// redemptions and analytics. All changes hit /api/business/loyalty/*.
// ==============================================================================

interface LoyaltyConfig {
  enabled: boolean
  pointsPerOrder: number
  minOrderPaise: number
  expiryEnabled: boolean
  expiryDays: number
  maxRedemptionsPerOrder: number
  refundPolicy: 'REVERSE' | 'KEEP'
}

interface Reward {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  type: 'FREE_ITEM' | 'FIXED_DISCOUNT' | 'PERCENT_DISCOUNT' | 'CUSTOM'
  pointsCost: number
  discountPaise: number
  discountPctBps: number
  discountMaxPaise: number
  minOrderPaise: number
  applicableItemIds: string[]
  active: boolean
  stock: number | null
  startAt: string | null
  endAt: string | null
  maxPerCustomer: number | null
  updatedAt: string
}

interface CustomerRow {
  phone: string
  name: string
  status: 'active' | 'suspended'
  verified: boolean
  createdAt: string
  lastLoginAt: string | null
  snapshot: { availablePoints: number; earnedTotal: number; redeemedTotal: number; expiredTotal: number; nextExpiry: { points: number; expiresAt: string } | null }
}

interface Tx {
  id: string
  type: string
  points: number
  delta: number
  createdAt: string
  reason?: string | null
  adminActor?: string | null
  orderNumber?: string | null
}

interface RedemptionRow {
  id: string
  customerId: string
  rewardName: string
  pointsUsed: number
  discountPaise: number
  status: 'APPLIED' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED'
  orderId: string | null
  orderNumber: string | null
  createdAt: string
}

interface Analytics {
  enrolledCustomers: number
  pointsIssued: number
  pointsRedeemed: number
  pointsExpired: number
  pointsOutstanding: number
  redemptionsTotal: number
  redemptionsOpen: number
  popularRewards: Array<{ rewardId: string; rewardName: string; count: number; pointsSpent: number }>
  repeatCustomers: number
}

type Section = 'rules' | 'rewards' | 'customers' | 'redemptions' | 'analytics'

const EMPTY_REWARD_DRAFT: Reward = {
  id: '',
  name: '',
  description: null,
  imageUrl: null,
  type: 'FIXED_DISCOUNT',
  pointsCost: 100,
  discountPaise: 10000,
  discountPctBps: 1000,
  discountMaxPaise: 0,
  minOrderPaise: 0,
  applicableItemIds: [],
  active: true,
  stock: null,
  startAt: null,
  endAt: null,
  maxPerCustomer: null,
  updatedAt: '',
}

export default function LoyaltyTab({ onRefresh }: { onRefresh: () => void }) {
  const [section, setSection] = useState<Section>('rules')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/business/loyalty/config', { cache: 'no-store' }),
      fetch('/api/business/loyalty/rewards', { cache: 'no-store' }),
      fetch('/api/business/loyalty/customers', { cache: 'no-store' }),
      fetch('/api/business/loyalty/redemptions', { cache: 'no-store' }),
      fetch('/api/business/loyalty/analytics', { cache: 'no-store' }),
    ])
      .then(async ([cfgRes, rwRes, custRes, redRes, anRes]) => {
        if (cfgRes.ok) setConfig(await cfgRes.json())
        if (rwRes.ok) setRewards(await rwRes.json())
        if (custRes.ok) setCustomers(await custRes.json())
        if (redRes.ok) setRedemptions(await redRes.json())
        if (anRes.ok) setAnalytics(await anRes.json())
      })
      .catch(() => {
        setFeedback({ ok: false, msg: 'Could not load loyalty data' })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const loadAll = useCallback(async (silent = false) => {
    try {
      const [cfgRes, rwRes, custRes, redRes, anRes] = await Promise.all([
        fetch('/api/business/loyalty/config', { cache: 'no-store' }),
        fetch('/api/business/loyalty/rewards', { cache: 'no-store' }),
        fetch('/api/business/loyalty/customers', { cache: 'no-store' }),
        fetch('/api/business/loyalty/redemptions', { cache: 'no-store' }),
        fetch('/api/business/loyalty/analytics', { cache: 'no-store' }),
      ])
      if (cfgRes.ok) setConfig(await cfgRes.json())
      if (rwRes.ok) setRewards(await rwRes.json())
      if (custRes.ok) setCustomers(await custRes.json())
      if (redRes.ok) setRedemptions(await redRes.json())
      if (anRes.ok) setAnalytics(await anRes.json())
    } catch {
      setFeedback({ ok: false, msg: 'Could not load loyalty data' })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg })
    setTimeout(() => setFeedback(null), 4000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading loyalty data…
        </div>
      </div>
    )
  }

  const sections: Array<{ key: Section; label: string; icon: React.ElementType }> = [
    { key: 'rules', label: 'Program Rules', icon: Sparkles },
    { key: 'rewards', label: `Rewards (${rewards.length})`, icon: Gift },
    { key: 'customers', label: `Customers (${customers.length})`, icon: Users },
    { key: 'redemptions', label: `Redemptions (${redemptions.filter((r) => r.status === 'APPLIED').length})`, icon: ShoppingBag },
    { key: 'analytics', label: 'Analytics', icon: Star },
  ]

  return (
    <div className="space-y-4">
      {/* Section switcher */}
      <div className="flex flex-wrap items-center gap-1.5">
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                section === s.key ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => { loadAll(true); onRefresh() }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {feedback && (
        <div className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${feedback.ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
          {feedback.msg}
        </div>
      )}

      {!config?.enabled && (
        <div className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> The loyalty program is currently DISABLED — customers earn no points and cannot redeem rewards.
        </div>
      )}

      {section === 'rules' && config && <RulesSection config={config} onChanged={() => loadAll(true)} flash={flash} saving={saving} setSaving={setSaving} />}
      {section === 'rewards' && <RewardsSection rewards={rewards} onChanged={() => loadAll(true)} flash={flash} />}
      {section === 'customers' && <CustomersSection customers={customers} onChanged={() => loadAll(true)} flash={flash} />}
      {section === 'redemptions' && <RedemptionsSection redemptions={redemptions} onChanged={() => loadAll(true)} flash={flash} />}
      {section === 'analytics' && analytics && <AnalyticsSection analytics={analytics} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function RulesSection({ config, onChanged, flash, saving, setSaving }: { config: LoyaltyConfig; onChanged: () => void; flash: (ok: boolean, msg: string) => void; saving: boolean; setSaving: (b: boolean) => void }) {
  const [draft, setDraft] = useState(config)
  // Re-sync the draft when fresh config arrives (derived-state pattern).
  const [prevConfig, setPrevConfig] = useState(config)
  if (config !== prevConfig) {
    setPrevConfig(config)
    setDraft(config)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/business/loyalty/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (res.ok) {
        flash(true, 'Loyalty rules saved')
        onChanged()
      } else {
        const d = await res.json().catch(() => ({}))
        flash(false, d.error || 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60'

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-5 space-y-4">
        {/* Enable switch */}
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-bold text-slate-100">Loyalty program enabled</p>
            <p className="text-[11px] text-slate-400">When off, customers earn nothing and redemption is blocked everywhere.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.enabled}
            onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${draft.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${draft.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Points per eligible order</label>
            <input type="number" min={0} max={100000} className={field} value={draft.pointsPerOrder} onChange={(e) => setDraft({ ...draft, pointsPerOrder: parseInt(e.target.value || '0', 10) || 0 })} />
            <p className="text-[10px] text-slate-500">Awarded once, when an order is served (default 20).</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Minimum order value to earn (₹)</label>
            <input type="number" min={0} step={0.01} className={field} value={draft.minOrderPaise / 100} onChange={(e) => setDraft({ ...draft, minOrderPaise: Math.round((parseFloat(e.target.value || '0') || 0) * 100) })} />
            <p className="text-[10px] text-slate-500">Orders below this value complete without points. 0 = any order.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <input type="checkbox" checked={draft.expiryEnabled} onChange={(e) => setDraft({ ...draft, expiryEnabled: e.target.checked })} className="accent-amber-500 w-4 h-4 cursor-pointer" />
              Points expire after this many days
            </label>
            <input type="number" min={1} max={3650} className={field} value={draft.expiryDays} onChange={(e) => setDraft({ ...draft, expiryDays: parseInt(e.target.value || '30', 10) || 30 })} disabled={!draft.expiryEnabled} />
            <p className="text-[10px] text-slate-500">Each earned batch has its own countdown. Unchecked = never expire.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Rewards redeemable per order</label>
            <input type="number" min={0} max={5} className={field} value={draft.maxRedemptionsPerOrder} onChange={(e) => setDraft({ ...draft, maxRedemptionsPerOrder: parseInt(e.target.value || '0', 10) || 0 })} />
            <p className="text-[10px] text-slate-500">0 disables redemption at checkout entirely.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Refund policy (points on full refund)</label>
            <select className={field} value={draft.refundPolicy} onChange={(e) => setDraft({ ...draft, refundPolicy: e.target.value as 'REVERSE' | 'KEEP' })}>
              <option value="REVERSE">Reverse earned points</option>
              <option value="KEEP">Keep earned points</option>
            </select>
            <p className="text-[10px] text-slate-500">REVERSE deducts the award from the customer&apos;s balance.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Rules
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

function RewardsSection({ rewards, onChanged, flash }: { rewards: Reward[]; onChanged: () => void; flash: (ok: boolean, msg: string) => void }) {
  const [editing, setEditing] = useState<Reward | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Rewards customers can redeem with points at checkout.</p>
        <Button onClick={() => setEditing({ ...EMPTY_REWARD_DRAFT })} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2 cursor-pointer">
          <Plus className="w-4 h-4" /> New Reward
        </Button>
      </div>

      {rewards.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
          <Gift className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-bold text-slate-200">No rewards yet</p>
          <p className="text-xs text-slate-500">Create your first reward — e.g. a free gulab jamun for 100 points.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rewards.map((r) => (
            <RewardCard key={r.id} reward={r} onEdit={() => setEditing(r)} onChanged={onChanged} flash={flash} />
          ))}
        </div>
      )}

      {editing && (
        <RewardEditor
          reward={editing}
          onClose={() => setEditing(null)}
          onChanged={() => { setEditing(null); onChanged() }}
          flash={flash}
        />
      )}
    </div>
  )
}

function RewardCard({ reward: r, onEdit, onChanged, flash }: { reward: Reward; onEdit: () => void; onChanged: () => void; flash: (ok: boolean, msg: string) => void }) {
  const toggle = async () => {
    const res = await fetch('/api/business/loyalty/rewards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    })
    if (res.ok) onChanged()
    else flash(false, 'Toggle failed')
  }

  const typeLabel =
    r.type === 'FREE_ITEM' ? 'Free item' :
    r.type === 'FIXED_DISCOUNT' ? `−${formatPaise(r.discountPaise)} off` :
    r.type === 'PERCENT_DISCOUNT' ? `−${r.discountPctBps / 100}% off` :
    'Custom'

  return (
    <div className={`p-4 rounded-2xl border space-y-2 ${r.active ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-950 border-slate-800/60 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-100 truncate">{r.name}</p>
          <p className="text-[11px] text-slate-400">{typeLabel} • <span className="text-amber-400 font-bold">{r.pointsCost} pts</span></p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${r.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
          {r.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      {r.description && <p className="text-[11px] text-slate-500 line-clamp-2">{r.description}</p>}
      <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
        {r.minOrderPaise > 0 && <span className="px-1.5 py-0.5 rounded bg-slate-800">Min order {formatPaise(r.minOrderPaise)}</span>}
        {r.stock !== null && <span className="px-1.5 py-0.5 rounded bg-slate-800 flex items-center gap-1"><Package className="w-3 h-3" /> {r.stock} left</span>}
        {r.maxPerCustomer !== null && <span className="px-1.5 py-0.5 rounded bg-slate-800">Max {r.maxPerCustomer}/customer</span>}
        {r.endAt && <span className="px-1.5 py-0.5 rounded bg-slate-800 flex items-center gap-1"><Clock className="w-3 h-3" /> until {new Date(r.endAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
      </div>
      <div className="flex gap-2 pt-1">
        <Button onClick={onEdit} className="flex-1 h-8 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold gap-1.5 cursor-pointer">
          <Pencil className="w-3 h-3" /> Edit
        </Button>
        <Button onClick={toggle} className={`flex-1 h-8 text-xs font-bold gap-1.5 cursor-pointer ${r.active ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'}`}>
          {r.active ? <><Ban className="w-3 h-3" /> Deactivate</> : <><CheckCircle2 className="w-3 h-3" /> Activate</>}
        </Button>
      </div>
    </div>
  )
}

function RewardEditor({ reward: initial, onClose, onChanged, flash }: { reward: Reward; onClose: () => void; onChanged: () => void; flash: (ok: boolean, msg: string) => void }) {
  const [draft, setDraft] = useState<Reward>(initial)
  const [saving, setSaving] = useState(false)
  const isNew = !draft.id

  const field = 'w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60'

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...(isNew ? {} : { id: draft.id }),
        name: draft.name,
        description: draft.description || undefined,
        imageUrl: draft.imageUrl || null,
        type: draft.type,
        pointsCost: draft.pointsCost,
        discountPaise: draft.type === 'FIXED_DISCOUNT' || draft.type === 'FREE_ITEM' ? draft.discountPaise : undefined,
        discountPctBps: draft.type === 'PERCENT_DISCOUNT' ? draft.discountPctBps : undefined,
        discountMaxPaise: draft.type === 'PERCENT_DISCOUNT' ? draft.discountMaxPaise : undefined,
        minOrderPaise: draft.minOrderPaise,
        applicableItemIds: draft.applicableItemIds,
        active: draft.active,
        stock: draft.stock,
        startAt: draft.startAt || null,
        endAt: draft.endAt || null,
        maxPerCustomer: draft.maxPerCustomer,
      }
      const res = await fetch('/api/business/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        flash(true, isNew ? 'Reward created' : 'Reward updated')
        onChanged()
      } else {
        const d = await res.json().catch(() => ({}))
        flash(false, d.error || (typeof d.details === 'object' ? 'Invalid reward details' : 'Save failed'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-100">{isNew ? 'New Reward' : 'Edit Reward'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">Reward name *</label>
          <input className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Free Gulab Jamun" maxLength={120} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">Description</label>
          <textarea className="w-full min-h-[64px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60" value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} placeholder="Shown to customers in the rewards gallery" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">Image URL</label>
          <input className={field} value={draft.imageUrl || ''} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Type</label>
            <select className={field} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Reward['type'] })}>
              <option value="FIXED_DISCOUNT">Fixed discount</option>
              <option value="PERCENT_DISCOUNT">Percentage discount</option>
              <option value="FREE_ITEM">Free item</option>
              <option value="CUSTOM">Custom (staff handles)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Points cost *</label>
            <input type="number" min={1} className={field} value={draft.pointsCost} onChange={(e) => setDraft({ ...draft, pointsCost: parseInt(e.target.value || '0', 10) || 0 })} />
          </div>
          {(draft.type === 'FIXED_DISCOUNT' || draft.type === 'FREE_ITEM') && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Discount / item value (₹)</label>
              <input type="number" min={0} step={0.01} className={field} value={draft.discountPaise / 100} onChange={(e) => setDraft({ ...draft, discountPaise: Math.round((parseFloat(e.target.value || '0') || 0) * 100) })} />
            </div>
          )}
          {draft.type === 'PERCENT_DISCOUNT' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Discount %</label>
                <input type="number" min={1} max={100} className={field} value={draft.discountPctBps / 100} onChange={(e) => setDraft({ ...draft, discountPctBps: Math.round((parseFloat(e.target.value || '0') || 0) * 100) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Max discount cap (₹)</label>
                <input type="number" min={0} step={0.01} className={field} value={draft.discountMaxPaise / 100} onChange={(e) => setDraft({ ...draft, discountMaxPaise: Math.round((parseFloat(e.target.value || '0') || 0) * 100) })} />
                <p className="text-[10px] text-slate-500">0 = uncapped</p>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Minimum order (₹)</label>
            <input type="number" min={0} step={0.01} className={field} value={draft.minOrderPaise / 100} onChange={(e) => setDraft({ ...draft, minOrderPaise: Math.round((parseFloat(e.target.value || '0') || 0) * 100) })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Stock</label>
            <input type="number" min={0} className={field} value={draft.stock ?? ''} onChange={(e) => setDraft({ ...draft, stock: e.target.value === '' ? null : parseInt(e.target.value, 10) })} placeholder="Empty = unlimited" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Valid from</label>
            <input
              type="date"
              className={field}
              value={draft.startAt ? draft.startAt.slice(0, 10) : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  setDraft({ ...draft, startAt: null })
                  return
                }
                const d = new Date(e.target.value)
                setDraft({ ...draft, startAt: isNaN(d.getTime()) ? null : d.toISOString() })
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Valid until</label>
            <input
              type="date"
              className={field}
              value={draft.endAt ? draft.endAt.slice(0, 10) : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  setDraft({ ...draft, endAt: null })
                  return
                }
                const d = new Date(e.target.value + 'T23:59:59')
                setDraft({ ...draft, endAt: isNaN(d.getTime()) ? null : d.toISOString() })
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Max uses per customer</label>
            <input type="number" min={1} className={field} value={draft.maxPerCustomer ?? ''} onChange={(e) => setDraft({ ...draft, maxPerCustomer: e.target.value === '' ? null : parseInt(e.target.value, 10) })} placeholder="Empty = unlimited" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-amber-500 w-4 h-4 cursor-pointer" />
          Reward active immediately
        </label>

        <div className="flex gap-2 justify-end pt-1">
          <Button onClick={onClose} className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer">Cancel</Button>
          <Button onClick={save} disabled={saving || !draft.name.trim() || draft.pointsCost < 1} className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold gap-2 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isNew ? 'Create Reward' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function CustomersSection({ customers, onChanged, flash }: { customers: CustomerRow[]; onChanged: () => void; flash: (ok: boolean, msg: string) => void }) {
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<{ phone: string; data: CustomerRow } | null>(null)
  const [detailTx, setDetailTx] = useState<Tx[]>([])
  const [detailLoadingTx, setDetailLoadingTx] = useState(false)
  const [adjustPointsValue, setAdjustPointsValue] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, '')))
  }, [customers, query])

  const openDetail = async (row: CustomerRow) => {
    setDetail({ phone: row.phone, data: row })
    setDetailLoadingTx(true)
    setDetailTx([])
    try {
      const res = await fetch(`/api/business/loyalty/customers/${row.phone}`, { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setDetailTx(d.transactions || [])
        setDetail((prev) => prev ? { ...prev, data: { ...row, snapshot: d.snapshot } } : prev)
      }
    } finally {
      setDetailLoadingTx(false)
    }
  }

  const adjust = async () => {
    if (!detail) return
    const points = parseInt(adjustPointsValue, 10)
    if (!points || adjustReason.trim().length < 3) {
      flash(false, 'Enter a non-zero point amount and a reason (min 3 chars)')
      return
    }
    const res = await fetch('/api/business/loyalty/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: detail.phone, points, reason: adjustReason.trim() }),
    })
    if (res.ok) {
      flash(true, `Points adjusted (${points > 0 ? '+' : ''}${points})`)
      setAdjustPointsValue('')
      setAdjustReason('')
      const c = customers.find((x) => x.phone === detail.phone)
      if (c) openDetail(c)
      onChanged()
    } else {
      const d = await res.json().catch(() => ({}))
      flash(false, d.error || 'Adjustment failed')
    }
  }

  const toggleStatus = async (row: CustomerRow) => {
    const next = row.status === 'active' ? 'suspended' : 'active'
    const res = await fetch('/api/business/loyalty/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: row.phone, status: next }),
    })
    if (res.ok) {
      flash(true, next === 'suspended' ? 'Account suspended' : 'Account reactivated')
      onChanged()
      if (detail?.phone === row.phone) setDetail({ phone: row.phone, data: { ...row, status: next } })
    } else flash(false, 'Status change failed')
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone…" className="h-9 pl-9 bg-slate-950 border-slate-800 text-xs text-slate-100" />
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
          <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-bold text-slate-200">No loyalty members yet</p>
          <p className="text-xs text-slate-500">Members appear here after they sign up with their mobile number.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Customer</th>
                <th className="text-right px-3 py-2 font-bold">Available</th>
                <th className="text-right px-3 py-2 font-bold hidden sm:table-cell">Earned</th>
                <th className="text-right px-3 py-2 font-bold hidden md:table-cell">Redeemed</th>
                <th className="text-right px-3 py-2 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 bg-slate-950/40">
              {filtered.map((c) => (
                <tr key={c.phone} className="hover:bg-slate-900/60">
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => openDetail(c)} className="text-left cursor-pointer">
                      <p className="font-bold text-slate-200 flex items-center gap-1.5">
                        {c.name}
                        {c.status === 'suspended' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">SUSPENDED</span>}
                      </p>
                      <p className="text-[10px] text-slate-500">+91 {c.phone}{c.verified ? '' : ' • unverified'}</p>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-black text-amber-400">{c.snapshot.availablePoints}</td>
                  <td className="px-3 py-2 text-right text-slate-300 hidden sm:table-cell">{c.snapshot.earnedTotal}</td>
                  <td className="px-3 py-2 text-right text-slate-300 hidden md:table-cell">{c.snapshot.redeemedTotal}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5 justify-end">
                      <button type="button" onClick={() => openDetail(c)} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer">Details</button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(c)}
                        title={c.status === 'active' ? 'Suspend account' : 'Reactivate'}
                        className={`px-2 py-1 rounded font-bold cursor-pointer ${c.status === 'active' ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'}`}
                      >
                        {c.status === 'active' ? 'Suspend' : 'Restore'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md h-full overflow-y-auto bg-slate-900 border-l border-slate-700 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-100">{detail.data.name}</h3>
              <button type="button" onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[11px] text-slate-400">+91 {detail.phone} • {detail.data.status === 'suspended' ? 'Suspended' : 'Active'} • member since {new Date(detail.data.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>

            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Available" value={detail.data.snapshot.availablePoints} />
              <MiniStat label="Earned" value={detail.data.snapshot.earnedTotal} />
              <MiniStat label="Redeemed" value={detail.data.snapshot.redeemedTotal} />
            </div>
            {detail.data.snapshot.expiredTotal > 0 && (
              <p className="text-[11px] text-slate-500">Expired lifetime: <b className="text-slate-300">{detail.data.snapshot.expiredTotal} pts</b></p>
            )}

            {/* Manual adjustment */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-300">Manual point adjustment</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={adjustPointsValue}
                  onChange={(e) => setAdjustPointsValue(e.target.value)}
                  placeholder="e.g. 50 or -25"
                  className="h-9 bg-slate-900 border-slate-800 text-xs text-slate-100 w-28"
                />
                <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason (required)" className="h-9 flex-1 bg-slate-900 border-slate-800 text-xs text-slate-100" />
              </div>
              <Button onClick={adjust} className="h-8 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold gap-2 cursor-pointer">
                <Star className="w-3.5 h-3.5" /> Apply adjustment
              </Button>
              <p className="text-[10px] text-slate-500">Every adjustment is written to the ledger with the reason and your identity.</p>
            </div>

            {/* Ledger */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-300 flex items-center gap-2">Transaction history {detailLoadingTx && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}</p>
              {detailTx.length === 0 && !detailLoadingTx ? (
                <p className="text-[11px] text-slate-500">No transactions yet.</p>
              ) : (
                <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/70 max-h-72 overflow-y-auto">
                  {detailTx.map((t) => (
                    <div key={t.id} className="px-3 py-2 flex items-center gap-2">
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${t.delta > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                        {t.delta > 0 ? '+' : ''}{t.points}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-200 capitalize">{t.type.toLowerCase()}</p>
                        <p className="text-[10px] text-slate-500 truncate">{t.reason || t.orderNumber || ''} {t.adminActor ? `• by ${t.adminActor}` : ''}</p>
                        <p className="text-[10px] text-slate-600">{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
      <p className="text-lg font-black text-slate-100 leading-none">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mt-1">{label} pts</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Redemptions
// ---------------------------------------------------------------------------

function RedemptionsSection({ redemptions, onChanged, flash }: { redemptions: RedemptionRow[]; onChanged: () => void; flash: (ok: boolean, msg: string) => void }) {
  const [filter, setFilter] = useState<'ALL' | RedemptionRow['status']>('ALL')
  const filtered = useMemo(
    () => (filter === 'ALL' ? redemptions : redemptions.filter((r) => r.status === filter)),
    [redemptions, filter]
  )

  const cancelRestore = async (r: RedemptionRow) => {
    const reason = window.prompt(`Cancel redemption "${r.rewardName}" for +91 ${r.customerId} and restore ${r.pointsUsed} points?\nReason:`)
    if (!reason) return
    const res = await fetch('/api/business/loyalty/redemptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: 'CANCEL_RESTORE', reason }),
    })
    if (res.ok) {
      flash(true, 'Redemption cancelled — points restored')
      onChanged()
    } else {
      const d = await res.json().catch(() => ({}))
      flash(false, d.error || 'Cancellation failed')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(['ALL', 'APPLIED', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${filter === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
          <ShoppingBag className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-bold text-slate-200">No redemptions</p>
          <p className="text-xs text-slate-500">Redemptions appear here as customers redeem rewards at checkout.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800/70 bg-slate-950/40">
          {filtered.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3">
              <Gift className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200">{r.rewardName}</p>
                <p className="text-[10px] text-slate-500">
                  +91 {r.customerId} • {r.orderNumber ? `Order #${r.orderNumber}` : 'Bridged to order pending'} • {formatPaise(r.discountPaise)} discount
                </p>
                <p className="text-[10px] text-slate-600">{new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                r.status === 'APPLIED' ? 'bg-amber-500/15 text-amber-400' :
                r.status === 'FULFILLED' ? 'bg-emerald-500/15 text-emerald-400' :
                r.status === 'REFUNDED' ? 'bg-sky-500/15 text-sky-400' : 'bg-slate-800 text-slate-500'
              }`}>{r.status}</span>
              <span className="text-xs font-black text-rose-400 shrink-0">−{r.pointsUsed}</span>
              {(r.status === 'APPLIED' || r.status === 'FULFILLED') && (
                <button type="button" onClick={() => cancelRestore(r)} className="px-2 py-1 rounded bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 text-[10px] font-bold cursor-pointer shrink-0" title="Cancel and restore points">
                  Cancel &amp; Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

function AnalyticsSection({ analytics: a }: { analytics: Analytics }) {
  const cards = [
    { label: 'Enrolled customers', value: a.enrolledCustomers, icon: Users, tone: 'text-emerald-400' },
    { label: 'Repeat customers (2+ orders)', value: a.repeatCustomers, icon: Users, tone: 'text-emerald-400' },
    { label: 'Points issued', value: a.pointsIssued, icon: Sparkles, tone: 'text-amber-400' },
    { label: 'Points redeemed', value: a.pointsRedeemed, icon: ShoppingBag, tone: 'text-rose-400' },
    { label: 'Points expired', value: a.pointsExpired, icon: Clock, tone: 'text-slate-400' },
    { label: 'Points outstanding', value: a.pointsOutstanding, icon: Star, tone: 'text-amber-400' },
    { label: 'Open redemptions', value: a.redemptionsOpen, icon: AlertTriangle, tone: 'text-amber-400' },
    { label: 'Total redemptions', value: a.redemptionsTotal, icon: Gift, tone: 'text-slate-300' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-1">
              <Icon className={`w-4 h-4 ${c.tone}`} />
              <p className="text-2xl font-black text-slate-100 leading-none">{c.value}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{c.label}</p>
            </div>
          )
        })}
      </div>

      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
        <p className="text-xs font-bold text-slate-300">Most popular rewards</p>
        {a.popularRewards.length === 0 ? (
          <p className="text-[11px] text-slate-500">No redemptions yet.</p>
        ) : (
          <div className="space-y-1.5">
            {a.popularRewards.map((r, i) => (
              <div key={r.rewardId} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
                <span className="flex-1 text-slate-200 font-semibold truncate">{r.rewardName}</span>
                <span className="text-slate-400">{r.count}×</span>
                <span className="text-rose-400 font-bold">−{r.pointsSpent} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
