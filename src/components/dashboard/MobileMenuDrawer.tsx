'use client'

import React from 'react'
import {
  ChefHat,
  Receipt,
  Table2,
  LayoutDashboard,
  ClipboardList,
  Gift,
  Utensils,
  Users,
  MessageSquare,
  QrCode,
  MessageSquareHeart,
  BarChart3,
  Settings,
  ExternalLink,
  Download,
  LogOut,
  RefreshCw,
  X,
  Smartphone,
  CheckCircle2,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import Link from 'next/link'
import { usePwa } from '@/components/pwa/PwaProvider'
import { useOrderAnnouncer } from './OrderAnnouncerContext'
import type { TabType } from './DashboardWorkspace'

export interface MobileMenuDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSelectTab: (tab: TabType) => void
  onRefresh: () => void
  feedbackCount?: number
  menuItemsCount?: number
  orderMenuCount?: number
  tablesCount?: number
  ordersCount?: number
  responsesCount?: number
  customersCount?: number
  campaignsCount?: number
  restaurantName: string
  restaurantLocation?: string
}

export default function MobileMenuDrawer({
  isOpen,
  onClose,
  onSelectTab,
  onRefresh,
  feedbackCount = 0,
  menuItemsCount = 0,
  orderMenuCount = 0,
  tablesCount = 0,
  ordersCount = 0,
  responsesCount = 0,
  customersCount = 0,
  campaignsCount = 0,
  restaurantName,
  restaurantLocation,
}: MobileMenuDrawerProps) {
  const { isInstalled, isInstallable, setShowInstallModal, promptInstall } = usePwa()
  const { isVoiceEnabled, toggleVoice, activeOrders } = useOrderAnnouncer()

  if (!isOpen) return null

  const liveOrdersCount = activeOrders.length || ordersCount

  const handleTabClick = (tab: TabType) => {
    onSelectTab(tab)
    onClose()
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await promptInstall()
    } else {
      setShowInstallModal(true)
    }
    onClose()
  }

  const handleShareSurvey = async () => {
    const surveyUrl = `${window.location.origin}/r/biryani-badshah-patna`
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${restaurantName} — Guest Feedback`,
          text: `Share your dining experience at ${restaurantName}!`,
          url: surveyUrl,
        })
      } catch {}
    } else {
      navigator.clipboard.writeText(surveyUrl)
      alert('Survey link copied to clipboard!')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 md:hidden">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto pb-safe animate-in slide-in-from-bottom duration-300 z-10 text-slate-100">
        {/* Drag Handle Indicator */}
        <div className="w-12 h-1.5 rounded-full bg-slate-700/80 mx-auto -mt-1 mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 flex items-center justify-center text-white font-extrabold shadow-md shadow-amber-600/25 text-xs tracking-wider">
              BB
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight leading-tight">
                {restaurantName}
              </h2>
              <p className="text-[11px] text-slate-400">
                {restaurantLocation || 'Patna'} • Restaurant Hub
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Audio / Hindi Announcer Quick Toggle */}
        <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isVoiceEnabled
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-200 block truncate">
                Hindi Voice Alerts {isVoiceEnabled ? '(Active)' : '(Muted)'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                Table orders &amp; waiter assistance speech
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleVoice()}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              isVoiceEnabled
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isVoiceEnabled ? 'Turn Mute' : 'Turn ON'}
          </button>
        </div>

        {/* SECTION 1: Dine-In & Kitchen Operations */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Dine-In &amp; Kitchen Operations
          </span>

          {/* Kitchen Display */}
          <button
            type="button"
            onClick={() => handleTabClick('kitchen')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <ChefHat className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Kitchen Display
                </span>
                <span className="text-[10px] text-slate-400">
                  Chef tickets, prep queue &amp; waiter calls
                </span>
              </div>
            </div>
            {liveOrdersCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {liveOrdersCount} active
              </span>
            ) : (
              <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
                Open &rarr;
              </span>
            )}
          </button>

          {/* Orders Ledger */}
          <button
            type="button"
            onClick={() => handleTabClick('orders')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Live Orders &amp; Billing
                </span>
                <span className="text-[10px] text-slate-400">
                  Table orders, receipts &amp; payments
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              Manage &rarr;
            </span>
          </button>

          {/* Dining Tables & QR */}
          <button
            type="button"
            onClick={() => handleTabClick('tables')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Table2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Dining Tables &amp; QR
                </span>
                <span className="text-[10px] text-slate-400">
                  {tablesCount > 0 ? `${tablesCount} tables configured` : 'Table codes, reset & free all'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              Manage &rarr;
            </span>
          </button>

          {/* Overview Dashboard */}
          <button
            type="button"
            onClick={() => handleTabClick('overview')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Overview &amp; Revenue
                </span>
                <span className="text-[10px] text-slate-400">
                  Sales stats, rating averages &amp; traffic
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              View &rarr;
            </span>
          </button>
        </div>

        {/* SECTION 2: Menu Catalog & VIP Loyalty */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Menu Catalog &amp; Loyalty
          </span>

          {/* Order Menu (Dine-in menu) */}
          <button
            type="button"
            onClick={() => handleTabClick('orderMenu')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Order Menu Catalog
                </span>
                <span className="text-[10px] text-slate-400">
                  {orderMenuCount > 0 ? `${orderMenuCount} dine-in items` : 'Dish pricing, add-ons & stock'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              Edit &rarr;
            </span>
          </button>

          {/* VIP Loyalty & Rewards */}
          <button
            type="button"
            onClick={() => handleTabClick('loyalty')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Badshah VIP &amp; Loyalty
                </span>
                <span className="text-[10px] text-slate-400">
                  Point rules, free gifts &amp; customer balances
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              Manage &rarr;
            </span>
          </button>

          {/* Survey Menu Items */}
          <button
            type="button"
            onClick={() => handleTabClick('menu')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Survey Dish Catalog
                </span>
                <span className="text-[10px] text-slate-400">
                  {menuItemsCount} feedback dishes configured
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              Manage &rarr;
            </span>
          </button>
        </div>

        {/* SECTION 3: Guest Feedback & Customers */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Guest CRM &amp; Feedback
          </span>

          {/* Customers Directory */}
          <button
            type="button"
            onClick={() => handleTabClick('customers')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Customers Directory
                </span>
                <span className="text-[10px] text-slate-400">
                  {customersCount > 0 ? `${customersCount} verified diner phones` : 'Customer list & visit counts'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              View &rarr;
            </span>
          </button>

          {/* Survey Responses */}
          <button
            type="button"
            onClick={() => handleTabClick('responses')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Survey Responses
                </span>
                <span className="text-[10px] text-slate-400">
                  {responsesCount > 0 ? `${responsesCount} completed surveys` : 'Live guest feedback & star ratings'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              View &rarr;
            </span>
          </button>

          {/* QR Campaigns */}
          <button
            type="button"
            onClick={() => handleTabClick('campaigns')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  QR Standees &amp; Campaigns
                </span>
                <span className="text-[10px] text-slate-400">
                  {campaignsCount > 0 ? `${campaignsCount} active campaigns` : 'QR download & table stands'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              View &rarr;
            </span>
          </button>

          {/* Private Feedback Complaints */}
          <button
            type="button"
            onClick={() => handleTabClick('feedback')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <MessageSquareHeart className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Private Complaints Inbox
                </span>
                <span className="text-[10px] text-slate-400">
                  Confidential concerns sent to owner
                </span>
              </div>
            </div>
            {feedbackCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {feedbackCount} new
              </span>
            ) : (
              <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
                View &rarr;
              </span>
            )}
          </button>
        </div>

        {/* SECTION 4: Analytics & System */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Reports &amp; Admin
          </span>

          {/* Reports */}
          <button
            type="button"
            onClick={() => handleTabClick('reports')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Sales Reports &amp; Analytics
                </span>
                <span className="text-[10px] text-slate-400">
                  Revenue breakdown, payment summaries
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              Open &rarr;
            </span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => handleTabClick('settings')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                  Settings &amp; Security
                </span>
                <span className="text-[10px] text-slate-400">
                  Password, branding &amp; Google review URL
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500 group-hover:text-amber-400 font-semibold">
              Edit &rarr;
            </span>
          </button>
        </div>

        {/* PWA App Status Banner */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-300 block">
                {isInstalled ? 'ReviewPulse Installed' : 'Install Mobile App'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                {isInstalled
                  ? 'Running in native standalone mode'
                  : 'Fast home-screen access & offline support'}
              </span>
            </div>
          </div>

          {isInstalled ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/30 flex items-center gap-1 shrink-0 active:scale-95 transition-transform cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}
        </div>

        {/* Quick External Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href="/r/biryani-badshah-patna"
            target="_blank"
            onClick={onClose}
            className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center text-center gap-1.5 hover:bg-slate-800/60 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">Open Live Survey</span>
            <span className="text-[10px] text-slate-400">Guest mobile view</span>
          </Link>

          <button
            type="button"
            onClick={handleShareSurvey}
            className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center text-center gap-1.5 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-slate-200">Share Survey Link</span>
            <span className="text-[10px] text-slate-400">WhatsApp / Copy</span>
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onRefresh()
              onClose()
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>

          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-3 py-2 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
