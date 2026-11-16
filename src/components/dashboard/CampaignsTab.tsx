'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  QrCode,
  Download,
  Copy,
  Plus,
  Check,
  PauseCircle,
  PlayCircle,
  Loader2,
  ExternalLink,
  Trash2,
  Sparkles,
  Smartphone,
  Crown,
  UtensilsCrossed,
} from 'lucide-react'

export interface CampaignItem {
  id: string
  name: string
  slug: string
  active: boolean
  created_at: string
}

interface CampaignsTabProps {
  campaigns: CampaignItem[]
  onRefresh: () => void
  businessSlug?: string
}

export default function CampaignsTab({ campaigns, onRefresh, businessSlug }: CampaignsTabProps) {
  const activeSlug = businessSlug || campaigns[0]?.slug || 'biryani-badshah-patna'
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [copiedSpecial, setCopiedSpecial] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const copyCampaignUrl = (slug: string) => {
    const url = `${window.location.origin}/r/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2500)
  }

  const copySpecialMenuUrl = () => {
    const url = `${window.location.origin}/order/${activeSlug}/special-menu`
    navigator.clipboard.writeText(url)
    setCopiedSpecial(true)
    setTimeout(() => setCopiedSpecial(false), 2500)
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/business/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !currentActive }),
      })
      if (res.ok) onRefresh()
    } catch (e) {
      console.error('Toggle campaign error:', e)
    }
  }

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete campaign "${name}"?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/business/campaigns?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        onRefresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete campaign')
      }
    } catch (e) {
      console.error('Delete campaign error:', e)
      alert('Network error while deleting campaign')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCampaignName.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/business/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCampaignName.trim() }),
      })

      if (res.ok) {
        setNewCampaignName('')
        setIsModalOpen(false)
        onRefresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create campaign')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and New Campaign CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">QR Campaigns Studio</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Active: {campaigns.filter((c) => c.active).length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate and manage tabletop QR codes, bill inserts, and counter stands for Biryani Badshah
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold text-xs h-11 sm:h-10 px-4 rounded-xl shadow-md shadow-amber-600/20 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>New QR Campaign</span>
        </Button>
      </div>

      {/* ====== Special Menu & Catering Dedicated QR Section ====== */}
      <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-slate-950 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xl border">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-emerald-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-heading font-black tracking-wide text-white">
                    Mehman Nawazi &amp; Shan-E-Biryani — Special Menu QR
                  </CardTitle>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Dedicated QR
                  </span>
                </div>
                <CardDescription className="text-xs text-emerald-200/70">
                  Party Packs, Bulk Handis &amp; Catering Menu QR code for table standees and catering marketing
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-script text-xs text-emerald-400">A Family Restaurant</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-4 flex flex-col items-center">
            <div className="p-3.5 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-emerald-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/business/qr?slug=${encodeURIComponent(activeSlug)}&type=special&format=png`}
                alt="Special Menu QR Code"
                className="w-36 h-36 object-contain"
              />
            </div>
            <p className="text-[11px] text-emerald-300/80 font-mono mt-2">/order/{activeSlug}/special-menu</p>
          </div>

          <div className="md:col-span-8 space-y-3.5">
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 space-y-1 text-xs">
              <p className="font-bold text-white flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" />
                What customers see when scanning this QR:
              </p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Direct view of the <strong>Mehman Nawazi Party Pack</strong> (Motter Pulao, Meetha Zarda, Kormas, Kabab, Murg Mussallam, Raan, Baby Naan) and <strong>Shan-E-Biryani Handis</strong> (40-45 &amp; 75-80 pax).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={copySpecialMenuUrl}
                className="h-10 px-4 rounded-xl border border-emerald-500/40 bg-emerald-900/40 hover:bg-emerald-800/40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
              >
                {copiedSpecial ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copy Special Menu Link</span>
                  </>
                )}
              </button>

              <a
                href={`/api/business/qr?slug=${encodeURIComponent(activeSlug)}&type=special&format=png&download=true`}
                download="biryani-badshah-special-menu-qr.png"
                className="h-10 px-3.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download PNG (Print)</span>
              </a>

              <a
                href={`/api/business/qr?slug=${encodeURIComponent(activeSlug)}&type=special&format=svg&download=true`}
                download="biryani-badshah-special-menu-qr.svg"
                className="h-10 px-3.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                <span>Download SVG (Vector)</span>
              </a>

              <a
                href={`/order/${encodeURIComponent(activeSlug)}/special-menu`}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {campaigns.map((camp) => (
          <Card
            key={camp.id}
            className={`border-slate-800 bg-slate-900/80 backdrop-blur-xl transition-all duration-200 rounded-2xl overflow-hidden shadow-lg ${
              !camp.active ? 'opacity-85 border-slate-800/80' : 'hover:border-amber-500/40'
            }`}
          >
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-800/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <CardTitle className="text-base font-bold text-white truncate">{camp.name}</CardTitle>
                  <CardDescription className="text-xs text-amber-400/90 font-mono">
                    /r/{camp.slug}
                  </CardDescription>
                </div>

                {/* Delete Campaign Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                  disabled={deletingId === camp.id}
                  title="Delete this campaign"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {deletingId === camp.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Status Toggle Pill */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Status:</span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(camp.id, camp.active)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all active:scale-95 ${
                    camp.active
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  }`}
                  title={camp.active ? 'Click to pause this QR code' : 'Click to activate this QR code'}
                >
                  {camp.active ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px]">Active</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-[11px]">Paused (Tap to enable)</span>
                    </>
                  )}
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 pt-4 space-y-4">
              {/* QR Image Preview */}
              <div className="p-4 rounded-2xl bg-white flex items-center justify-center mx-auto max-w-[200px] shadow-md border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/business/qr?slug=${camp.slug}&format=png`}
                  alt={`QR for ${camp.name}`}
                  className="w-36 h-36 object-contain"
                />
              </div>

              {/* Actions: Copy Link, Download PNG, Download SVG */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => copyCampaignUrl(camp.slug)}
                  className="w-full h-11 py-2 px-3 rounded-xl border border-slate-800 bg-slate-950/80 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.99]"
                >
                  {copiedSlug === camp.slug ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{copiedSlug === camp.slug ? 'Direct Link Copied!' : 'Copy Direct Link'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`/api/business/qr?slug=${camp.slug}&format=png&download=true`}
                    download={`reviewpulse-qr-${camp.slug}.png`}
                    className="h-10 px-2.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>PNG (Print)</span>
                  </a>

                  <a
                    href={`/api/business/qr?slug=${camp.slug}&format=svg&download=true`}
                    download={`reviewpulse-qr-${camp.slug}.svg`}
                    className="h-10 px-2.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                  >
                    <Download className="w-3.5 h-3.5 text-yellow-400" />
                    <span>SVG (Vector)</span>
                  </a>
                </div>

                <a
                  href={`/r/${camp.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs text-slate-400 hover:text-amber-400 pt-2 transition-colors py-1"
                >
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    Preview Mobile Feedback Flow <ExternalLink className="w-3 h-3" />
                  </span>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}

        {campaigns.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 space-y-3 p-6 rounded-3xl bg-slate-900/50 border border-slate-800">
            <QrCode className="w-10 h-10 mx-auto text-slate-600" />
            <div className="space-y-1">
              <p className="text-base font-bold text-white">No QR Campaigns Found</p>
              <p className="text-xs text-slate-400">Click &ldquo;New QR Campaign&rdquo; above to generate a QR code for Biryani Badshah.</p>
            </div>
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create New QR Campaign</h3>
            <p className="text-xs text-slate-400">
              Each campaign gets a unique QR code and slug for performance tracking.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="campName" className="text-xs font-medium text-slate-300">
                  Campaign Name
                </Label>
                <Input
                  id="campName"
                  placeholder="e.g. Indoor Dining, Rooftop, Bill Folder"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="bg-slate-950/80 border-slate-800 focus:border-amber-500 text-white h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                  className="text-slate-400 hover:text-white h-10 px-4 rounded-xl text-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isCreating || !newCampaignName.trim()}
                  className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold h-10 px-5 rounded-xl shadow-md text-xs cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Generate QR Code'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
