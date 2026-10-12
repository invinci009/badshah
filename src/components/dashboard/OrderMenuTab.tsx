'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Pencil,
  Upload,
  Image as ImageIcon,
  X,
  Search,
  Sparkles,
} from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'
import { normalizeImageUrl } from '@/lib/ordering/validation'

interface Category {
  id: string
  name: string
  position: number
  active: boolean
}

interface MenuItem {
  id: string
  categoryId: string | null
  name: string
  description?: string
  imageUrl?: string | null
  pricePaise: number
  available: boolean
  visible: boolean
  veg: string
  featured: boolean
  position: number
  options?: Array<{
    id: string
    name: string
    type: string
    required: boolean
    min: number
    max: number
    choices: Array<{ id: string; name: string; pricePaise: number }>
  }>
}

export default function OrderMenuTab({ onRefresh }: { onRefresh: () => void }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')
  const [showItemForm, setShowItemForm] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCatFilter, setSelectedCatFilter] = useState('all')

  // Item form state
  const [fName, setFName] = useState('')
  const [fPrice, setFPrice] = useState('')
  const [fCat, setFCat] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fVeg, setFVeg] = useState('none')
  const [fFeatured, setFFeatured] = useState(false)
  const [fImageUrl, setFImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Ordering config
  const [taxPct, setTaxPct] = useState('5')
  const [chargeRs, setChargeRs] = useState('0')
  const [generalOn, setGeneralOn] = useState(true)
  const [cfgSaving, setCfgSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [c, i, cfg] = await Promise.all([
        fetch('/api/business/order-menu/categories').then((r) => r.json()),
        fetch('/api/business/order-menu/items').then((r) => r.json()),
        fetch('/api/business/ordering-config').then((r) => (r.ok ? r.json() : null)),
      ])
      setCategories(Array.isArray(c) ? c : [])
      setItems(Array.isArray(i) ? i : [])
      if (cfg) {
        setTaxPct(String((cfg.taxRateBps ?? 500) / 100))
        setChargeRs(String((cfg.serviceChargePaise ?? 0) / 100))
        setGeneralOn(cfg.generalOrderingEnabled ?? true)
      }
    } catch {
      setError('Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => load())
    return () => cancelAnimationFrame(raf)
  }, [])

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCat.trim()) return
    await fetch('/api/business/order-menu/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCat.trim() }),
    })
    setNewCat('')
    load()
    onRefresh()
  }

  const openNew = () => {
    setEditing(null)
    setFName('')
    setFPrice('')
    setFCat(categories[0]?.id || '')
    setFDesc('')
    setFVeg('none')
    setFFeatured(false)
    setFImageUrl('')
    setUploadError(null)
    setShowItemForm(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setFName(item.name)
    setFPrice(String(item.pricePaise / 100))
    setFCat(item.categoryId || '')
    setFDesc(item.description || '')
    setFVeg(item.veg)
    setFFeatured(item.featured)
    setFImageUrl(item.imageUrl || '')
    setUploadError(null)
    setShowItemForm(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/business/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setFImageUrl(data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const paise = Math.round(parseFloat(fPrice) * 100)
    if (!fName.trim() || !Number.isFinite(paise) || paise < 0) {
      setError('Enter a valid name and price.')
      return
    }
    setError(null)
    const res = await fetch('/api/business/order-menu/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(editing ? { id: editing.id, options: editing.options } : {}),
        name: fName.trim(),
        pricePaise: paise,
        categoryId: fCat || null,
        description: fDesc.trim() || undefined,
        imageUrl: fImageUrl.trim() ? fImageUrl.trim() : null,
        veg: fVeg,
        featured: fFeatured,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to save item')
      return
    }
    setShowItemForm(false)
    load()
    onRefresh()
  }

  const toggle = async (id: string, patch: { available?: boolean; visible?: boolean }) => {
    await fetch('/api/business/order-menu/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    load()
  }

  const remove = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"? Blocked if historical orders reference it.`)) return
    const res = await fetch(`/api/business/order-menu/items?id=${item.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(d.error || 'Delete failed')
      return
    }
    load()
    onRefresh()
  }

  const saveConfig = async () => {
    setCfgSaving(true)
    await fetch('/api/business/ordering-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taxRateBps: Math.round(parseFloat(taxPct || '0') * 100),
        serviceChargePaise: Math.round(parseFloat(chargeRs || '0') * 100),
        generalOrderingEnabled: generalOn,
      }),
    })
    setCfgSaving(false)
  }

  // Filtered items
  const filteredItems = items.filter((item) => {
    if (selectedCatFilter !== 'all' && (item.categoryId || 'uncategorized') !== selectedCatFilter) {
      return false
    }
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400">
        <Loader2 className="w-7 h-7 mx-auto animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-white">Order Menu Catalog</h2>
        <p className="text-xs text-slate-400">
          Manage categories, dishes, prices, and upload dish photos for the customer digital menu.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Tax & Settings */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Tax &amp; Ordering Switches</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-300">GST %</Label>
            <Input
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              inputMode="decimal"
              className="bg-slate-950/60 border-slate-800 text-white h-10 w-24 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-300">Service charge ₹</Label>
            <Input
              value={chargeRs}
              onChange={(e) => setChargeRs(e.target.value)}
              inputMode="decimal"
              className="bg-slate-950/60 border-slate-800 text-white h-10 w-28 text-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pb-2.5">
            <input
              type="checkbox"
              checked={generalOn}
              onChange={(e) => setGeneralOn(e.target.checked)}
              className="rounded"
            />
            General ordering without table QR
          </label>
          <Button
            onClick={saveConfig}
            disabled={cfgSaving}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-10 rounded-xl cursor-pointer"
          >
            {cfgSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Categories ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={addCategory} className="flex gap-2">
            <Input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="e.g. Biryani, Traditional Tandoor…"
              className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs flex-1"
            />
            <Button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs h-10 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <span
                key={c.id}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs border border-slate-700"
              >
                {c.name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Item Form (New or Edit) */}
      {showItemForm && (
        <Card className="border-amber-500/40 bg-slate-900/95 shadow-xl animate-in fade-in duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {editing ? `Edit: ${editing.name}` : 'New Menu Item'}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Fill in dish details and upload photo.
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setShowItemForm(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Dish Name *</Label>
                  <Input
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="e.g. Chicken Biryani"
                    className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Price ₹ *</Label>
                  <Input
                    value={fPrice}
                    onChange={(e) => setFPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="220.00"
                    className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Category</Label>
                  <select
                    value={fCat}
                    onChange={(e) => setFCat(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs px-3 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Diet Type</Label>
                  <select
                    value={fVeg}
                    onChange={(e) => setFVeg(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs px-3 focus:outline-none focus:border-amber-500"
                  >
                    <option value="none">Not specified</option>
                    <option value="veg">Veg (Pure Vegetarian)</option>
                    <option value="nonveg">Non-veg (Chicken / Mutton / Fish)</option>
                    <option value="egg">Egg</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs text-slate-300">Description / Ingredients</Label>
                  <Input
                    value={fDesc}
                    onChange={(e) => setFDesc(e.target.value)}
                    placeholder="e.g. Fragrant long-grain basmati rice cooked with authentic spices..."
                    className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs"
                  />
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-500" /> Dish Photo
                  </Label>
                  {fImageUrl && (
                    <button
                      type="button"
                      onClick={() => setFImageUrl('')}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Remove image
                    </button>
                  )}
                </div>

                {uploadError && (
                  <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                    {uploadError}
                  </p>
                )}

                {fImageUrl ? (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900 border border-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fImageUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-slate-300 font-medium truncate">{fImageUrl}</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="h-7 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-slate-800 cursor-pointer px-2"
                        >
                          <Upload className="w-3 h-3 mr-1" /> Change Photo
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto flex-1 border border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-3 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all flex items-center justify-center gap-2 group"
                    >
                      {uploadingImage ? (
                        <div className="flex items-center gap-2 text-xs text-amber-400">
                          <Loader2 className="w-4 h-4 animate-spin" /> Uploading image…
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-slate-200">
                          <Upload className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                          <span>Upload dish image (JPG, PNG, WebP)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex flex-col gap-1.5 pt-1">
                  <Input
                    value={fImageUrl}
                    onChange={(e) => {
                      const val = e.target.value
                      const norm = normalizeImageUrl(val)
                      setFImageUrl(norm || val)
                      if (uploadError) setUploadError(null)
                    }}
                    onBlur={(e) => {
                      const norm = normalizeImageUrl(e.target.value)
                      if (norm) setFImageUrl(norm)
                    }}
                    placeholder="Or paste external image / Google Drive link…"
                    className="bg-slate-950/60 border-slate-800 text-slate-300 h-8 text-[11px]"
                  />
                  <p className="text-[10px] text-slate-500">
                    Supports direct image URLs and Google Drive links (ensure link sharing is set to &quot;Anyone with the link&quot;).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fFeatured}
                    onChange={(e) => setFFeatured(e.target.checked)}
                    className="rounded"
                  />{' '}
                  Featured (Chef&apos;s Specials)
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowItemForm(false)}
                    className="text-slate-400 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-xl cursor-pointer px-4"
                  >
                    {editing ? 'Save Changes' : 'Create Item'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Items List Header and Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Menu Items ({filteredItems.length}
              {filteredItems.length !== items.length ? ` of ${items.length}` : ''})
            </h3>
            <p className="text-xs text-slate-400">
              Filter by category, search dishes, toggle availability, or upload photos.
            </p>
          </div>
          <Button
            onClick={openNew}
            className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs h-9 rounded-xl cursor-pointer shrink-0 shadow-md"
          >
            <Plus className="w-4 h-4 mr-1" /> New Item
          </Button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes by name…"
              className="bg-slate-900/80 border-slate-800 text-white h-9 pl-8 text-xs rounded-xl"
            />
          </div>
          <select
            value={selectedCatFilter}
            onChange={(e) => setSelectedCatFilter(e.target.value)}
            className="h-9 rounded-xl bg-slate-900/80 border border-slate-800 text-white text-xs px-3 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Categories ({items.length})</option>
            {categories.map((c) => {
              const count = items.filter((i) => i.categoryId === c.id).length
              return (
                <option key={c.id} value={c.id}>
                  {c.name} ({count})
                </option>
              )
            })}
            <option value="uncategorized">
              Uncategorized ({items.filter((i) => !i.categoryId).length})
            </option>
          </select>
        </div>
      </div>

      {/* Items List Table / Cards */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
        <CardContent className="pt-4">
          <div className="divide-y divide-slate-800">
            {filteredItems.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Image thumbnail or placeholder with quick upload trigger */}
                  <div
                    onClick={() => openEdit(item)}
                    title={item.imageUrl ? 'Click to change image' : 'Click to upload image'}
                    className="w-12 h-12 rounded-xl border border-slate-700/80 bg-slate-950 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden group-hover:border-amber-500/60 transition-colors relative"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={normalizeImageUrl(item.imageUrl) || item.imageUrl}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 group-hover:text-amber-400 transition-colors">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-[8px] font-bold mt-0.5 tracking-tight text-slate-400 group-hover:text-amber-400">
                          +Image
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate flex items-center gap-2">
                      <span>{item.name}</span>
                      <span className="text-amber-400 text-xs font-bold">
                        • {formatPaise(item.pricePaise)}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {categories.find((c) => c.id === item.categoryId)?.name || 'Uncategorized'}
                      {item.veg !== 'none' ? ` • ${item.veg}` : ''}
                      {item.featured ? ' • Featured' : ''}
                      {item.options && item.options.length > 0
                        ? ` • ${item.options.length} portion/option group(s)`
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggle(item.id, { available: !item.available })}
                    title={item.available ? 'Mark sold out' : 'Mark available'}
                    className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                      item.available
                        ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                    }`}
                  >
                    {item.available ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(item.id, { visible: !item.visible })}
                    title={item.visible ? 'Hide from menu' : 'Show on menu'}
                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    title="Edit Item & Image"
                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    title="Delete"
                    className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {filteredItems.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500">
                {searchQuery || selectedCatFilter !== 'all'
                  ? 'No items match your search/filter.'
                  : 'No orderable items yet. Add your first dish above.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
