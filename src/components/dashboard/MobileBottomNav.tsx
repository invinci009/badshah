'use client'

import React from 'react'
import {
  LayoutDashboard,
  Receipt,
  ChefHat,
  Table2,
  Menu,
} from 'lucide-react'
import { useOrderAnnouncer } from './OrderAnnouncerContext'
import type { TabType } from './DashboardWorkspace'

interface MobileBottomNavProps {
  activeTab: string
  onSelectTab: (tab: TabType) => void
  ordersCount?: number
  tablesCount?: number
  hasFeedback?: boolean
  onOpenMore: () => void
}

export default function MobileBottomNav({
  activeTab,
  onSelectTab,
  ordersCount = 0,
  tablesCount = 0,
  hasFeedback = false,
  onOpenMore,
}: MobileBottomNavProps) {
  const { activeOrders, activeServiceCall } = useOrderAnnouncer()
  const liveOrdersCount = activeOrders.length || ordersCount
  const isMoreActive = !['overview', 'orders', 'kitchen', 'tables'].includes(activeTab)

  const navItems = [
    {
      key: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: undefined,
      onClick: () => onSelectTab('overview'),
      isActive: activeTab === 'overview',
    },
    {
      key: 'orders',
      label: 'Orders',
      icon: Receipt,
      badge: liveOrdersCount > 0 ? liveOrdersCount : undefined,
      onClick: () => onSelectTab('orders'),
      isActive: activeTab === 'orders',
    },
    {
      key: 'kitchen',
      label: 'Kitchen',
      icon: ChefHat,
      badge: activeServiceCall ? '!' : liveOrdersCount > 0 ? liveOrdersCount : undefined,
      isAlert: !!activeServiceCall,
      onClick: () => onSelectTab('kitchen'),
      isActive: activeTab === 'kitchen',
    },
    {
      key: 'tables',
      label: 'Tables',
      icon: Table2,
      badge: tablesCount > 0 ? tablesCount : undefined,
      onClick: () => onSelectTab('tables'),
      isActive: activeTab === 'tables',
    },
    {
      key: 'more',
      label: 'More',
      icon: Menu,
      badge: hasFeedback ? '•' : undefined,
      onClick: onOpenMore,
      isActive: isMoreActive,
    },
  ]

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-950/92 backdrop-blur-xl border-t border-slate-800/90 pb-safe shadow-[0_-10px_25px_rgba(0,0,0,0.5)] transition-all"
    >
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = item.isActive

          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center h-full w-full py-1 transition-all duration-150 cursor-pointer active:scale-90 ${
                active ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active ambient glow pill */}
              {active && (
                <span className="absolute top-1.5 w-8 h-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
              )}

              {/* Icon Container with Badge */}
              <div className="relative mt-1">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    active ? 'scale-110 text-amber-400 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
                {item.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center leading-none ${
                      item.badge === '!'
                        ? 'bg-amber-500 text-stone-950 font-black animate-bounce'
                        : item.badge === '•'
                        ? 'bg-rose-500 text-white w-2 h-2 min-w-0 p-0'
                        : active
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-amber-400 border border-amber-400/30'
                    }`}
                  >
                    {item.badge !== '•' && item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] tracking-tight mt-1 truncate max-w-[62px] ${
                  active ? 'text-white font-bold' : 'text-slate-400 font-medium'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
