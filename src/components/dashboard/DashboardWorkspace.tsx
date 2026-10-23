'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import OverviewTab, { type AnalyticsData } from './OverviewTab'
import CampaignsTab, { type CampaignItem } from './CampaignsTab'
import ResponsesTab, { type ResponseItem } from './ResponsesTab'
import FeedbackTab, { type PrivateFeedbackItem } from './FeedbackTab'
import MenuTab, { type MenuItem as DashboardMenuItem } from './MenuTab'
import TablesTab, { type TableItem } from './TablesTab'
import OrderMenuTab from './OrderMenuTab'
import OrdersTab from './OrdersTab'
import KitchenTab from './KitchenTab'
import ReportsTab from './ReportsTab'
import SettingsTab, { type BusinessSettings } from './SettingsTab'
import CustomersPortalTab, { type CustomerDetail } from './CustomersPortalTab'
import LoyaltyTab from './LoyaltyTab'
import MobileBottomNav from './MobileBottomNav'
import MobileMenuDrawer from './MobileMenuDrawer'
import { OrderAnnouncerProvider } from './OrderAnnouncerContext'
import OrderAnnouncerBar from './OrderAnnouncerBar'
import { usePwa } from '@/components/pwa/PwaProvider'
import {
  LayoutDashboard,
  QrCode,
  MessageSquare,
  MessageSquareHeart,
  Utensils,
  Settings,
  Sparkles,
  Users,
  ExternalLink,
  Download,
  Menu,
  Table2,
  ClipboardList,
  ChefHat,
  BarChart3,
  Receipt,
  Gift,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardWorkspaceProps {
  initialTab?: string
  business: BusinessSettings
  analytics: AnalyticsData
  campaigns: CampaignItem[]
  responses: ResponseItem[]
  feedbackList: PrivateFeedbackItem[]
  menuItems: DashboardMenuItem[]
  customers?: CustomerDetail[]
  tables?: TableItem[]
  portalSlug?: string
  orderMenuCount?: number
  userEmail?: string
}

type TabType = 'overview' | 'customers' | 'responses' | 'campaigns' | 'feedback' | 'menu' | 'orderMenu' | 'orders' | 'kitchen' | 'reports' | 'tables' | 'loyalty' | 'settings'

export type { TabType }

const VALID_TABS: TabType[] = ['overview', 'customers', 'responses', 'campaigns', 'feedback', 'menu', 'orderMenu', 'orders', 'kitchen', 'reports', 'tables', 'loyalty', 'settings']

export default function DashboardWorkspace({
  initialTab: propInitialTab,
  business,
  analytics,
  campaigns,
  responses,
  feedbackList,
  menuItems,
  customers = [],
  tables = [],
  portalSlug = 'order',
  orderMenuCount = 0,
  userEmail = 'admin',
}: DashboardWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryTab = searchParams.get('tab')
  const initialTab = propInitialTab || queryTab
  const { isInstallable, isInstalled, promptInstall, setShowInstallModal } = usePwa()

  const [activeTab, setActiveTab] = useState<TabType>(
    initialTab && VALID_TABS.includes(initialTab as TabType) ? (initialTab as TabType) : 'overview'
  )
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false)

  // Sync active tab when the URL-driven initial tab changes (derived state)
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab)
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab)
    if (initialTab && VALID_TABS.includes(initialTab as TabType)) {
      setActiveTab(initialTab as TabType)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/dashboard?tab=${tab}`)
    }
  }

  const handleRefresh = () => {
    router.refresh()
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await promptInstall()
    } else {
      setShowInstallModal(true)
    }
  }

  const phoneCount = customers.filter((c) => c.hasPhone).length

  const tabs: Array<{ key: TabType; label: string; icon: React.ElementType; badge?: number }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'customers', label: 'Customers', icon: Users, badge: phoneCount },
    { key: 'responses', label: 'Responses', icon: MessageSquare, badge: responses.length },
    { key: 'campaigns', label: 'QR Campaigns', icon: QrCode, badge: campaigns.length },
    {
      key: 'feedback',
      label: 'Inbox & Complaints',
      icon: MessageSquareHeart,
      badge: feedbackList.length > 0 ? feedbackList.length : undefined,
    },
    { key: 'menu', label: 'Menu', icon: Utensils, badge: menuItems.length },
    { key: 'orderMenu', label: 'Order Menu', icon: ClipboardList, badge: orderMenuCount },
    { key: 'loyalty', label: 'Loyalty', icon: Gift },
    { key: 'orders', label: 'Orders', icon: Receipt },
    { key: 'kitchen', label: 'Kitchen', icon: ChefHat },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'tables', label: 'Tables', icon: Table2, badge: tables.length },
    { key: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <OrderAnnouncerProvider>
      <div className="space-y-4 sm:space-y-6 pb-safe-nav md:pb-6">
      {/* Restaurant Header */}
      <div className="space-y-3 pb-3 border-b border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl overflow-hidden border border-amber-500/40 shadow-lg shadow-amber-500/10 shrink-0 bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt={business.name} className="w-full h-full object-cover" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                  {business.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Live
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xl">
                {business.location ? `${business.location} • ` : ''}Restaurant Management &amp; Analytics
              </p>
            </div>
          </div>

          {/* Quick Action Buttons for Mobile / Tablet */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Live Survey Guest Preview */}
            <Link
              href={campaigns[0]?.slug ? `/r/${campaigns[0].slug}` : (portalSlug ? `/r/${portalSlug}` : '/r/biryani-badshah-patna')}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors shadow-xs active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live Survey</span>
            </Link>

            {/* PWA Install Trigger / Badge */}
            {!isInstalled ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            ) : (
              <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                PWA Installed
              </span>
            )}

            {/* Mobile Drawer Trigger for More items */}
            <button
              type="button"
              onClick={() => setIsMoreDrawerOpen(true)}
              aria-label="Open mobile menu"
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Buttons - Horizontal Desktop/Tablet Bar */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800/90 overflow-x-auto no-scrollbar scroll-smooth">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-95 shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white shadow-md shadow-amber-600/25 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 leading-none ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Real-time Order Voice & Notifications Bar */}
      <OrderAnnouncerBar onNavigateToOrders={() => handleTabChange('orders')} />

      {/* Tab Panels */}
      <div className="min-w-0">
        {activeTab === 'overview' && <OverviewTab analytics={analytics} />}
        {activeTab === 'customers' && (
          <CustomersPortalTab customers={customers} restaurantName={business.name} />
        )}
        {activeTab === 'responses' && <ResponsesTab responses={responses} />}
        {activeTab === 'campaigns' && (
          <CampaignsTab campaigns={campaigns} onRefresh={handleRefresh} />
        )}
        {activeTab === 'feedback' && <FeedbackTab feedbackList={feedbackList} />}
        {activeTab === 'menu' && (
          <MenuTab menuItems={menuItems} onRefresh={handleRefresh} />
        )}
        {activeTab === 'tables' && (
          <TablesTab tables={tables} portalSlug={portalSlug} onRefresh={handleRefresh} />
        )}
        {activeTab === 'orderMenu' && <OrderMenuTab onRefresh={handleRefresh} />}
        {activeTab === 'loyalty' && <LoyaltyTab onRefresh={handleRefresh} />}
        {activeTab === 'orders' && <OrdersTab tables={tables.map((t) => ({ id: t.id, label: t.label }))} onRefresh={handleRefresh} />}
        {activeTab === 'kitchen' && <KitchenTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'settings' && (
          <SettingsTab business={business} onRefresh={handleRefresh} userEmail={userEmail} />
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (Docked on phones) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        tablesCount={tables.length}
        hasFeedback={feedbackList.length > 0}
        onOpenMore={() => setIsMoreDrawerOpen(true)}
      />

      {/* Mobile Slide-up Drawer with all 13 restaurant modules */}
      <MobileMenuDrawer
        isOpen={isMoreDrawerOpen}
        onClose={() => setIsMoreDrawerOpen(false)}
        onSelectTab={handleTabChange}
        onRefresh={handleRefresh}
        feedbackCount={feedbackList.length}
        menuItemsCount={menuItems.length}
        orderMenuCount={orderMenuCount}
        tablesCount={tables.length}
        responsesCount={responses.length}
        customersCount={phoneCount}
        campaignsCount={campaigns.length}
        restaurantName={business.name}
        restaurantLocation={business.location || undefined}
      />
      </div>
    </OrderAnnouncerProvider>
  )
}
