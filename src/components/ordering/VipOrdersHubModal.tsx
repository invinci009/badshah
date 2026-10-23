'use client'

import React from 'react'
import {
  Crown,
  X,
  Sparkles,
  History,
  Gift,
  User,
  Clock,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'

export interface CustomerPreviousOrder {
  id: string
  orderNumber: string
  totalPaise: number
  fulfilment: string
  paymentStatus: string
  createdAt: string
  tableLabel?: string | null
  loyaltyAwarded?: boolean
  loyaltyPointsEarned?: number
  loyaltyDiscountPaise?: number
  items: Array<{
    itemId?: string
    itemName: string
    quantity: number
    pricePaise?: number
    selections?: Array<{ groupId: string; optionId: string }>
  }>
}

export interface LoyaltyRewardItem {
  id: string
  name: string
  description?: string | null
  pointsCost: number
  discountPaise: number
  discountPctBps: number
  type: string
}

export interface VipOrdersHubModalProps {
  isOpen: boolean
  onClose: () => void
  loyaltyCustomer: { customerId: string; name?: string; phone: string } | null
  loyaltyPoints: number | null
  previousOrders: CustomerPreviousOrder[]
  vipModalTab: 'orders' | 'perks' | 'profile'
  setVipModalTab: (tab: 'orders' | 'perks' | 'profile') => void
  loyaltyRewards: LoyaltyRewardItem[]
  loginPhone: string
  setLoginPhone: (phone: string) => void
  loginName: string
  setLoginName: (name: string) => void
  loginLoading: boolean
  loginError: string | null
  handlePhoneLogin: (overridePhone?: string, overrideName?: string) => Promise<void>
  handleLogout: () => void
  handleReorder: (order: CustomerPreviousOrder) => void
  formatDisplayPhone: (phone?: string | null) => string
  formatOrderDate: (isoString: string) => string
}

export function VipOrdersHubModal({
  isOpen,
  onClose,
  loyaltyCustomer,
  loyaltyPoints,
  previousOrders,
  vipModalTab,
  setVipModalTab,
  loyaltyRewards,
  loginPhone,
  setLoginPhone,
  loginName,
  setLoginName,
  loginLoading,
  loginError,
  handlePhoneLogin,
  handleLogout,
  handleReorder,
  formatDisplayPhone,
  formatOrderDate,
}: VipOrdersHubModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white border border-amber-200 shadow-2xl p-4 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200 text-stone-900 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-white flex items-center justify-center shadow-xs">
              <Crown className="w-4 h-4 fill-white/30" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">
                {loyaltyCustomer ? 'Badshah VIP & Orders Hub' : 'Welcome to Biryani Badshah'}
              </h3>
              <p className="text-[10px] text-stone-500">
                {loyaltyCustomer ? 'Your Points, Perks & Order History' : 'Enter mobile to view past orders & earn points'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loyaltyCustomer && (
              <button
                type="button"
                onClick={handleLogout}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/80 hover:bg-amber-200 border border-amber-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Switch Number
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Logged in state: VIP Card + Previous Orders + Rewards */}
        {loyaltyCustomer ? (
          <div className="space-y-4">
            {/* VIP Gold Card */}
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-[#8a0214] via-[#9e0c1f] to-[#6b010f] text-white shadow-lg overflow-hidden border border-amber-400/40">
              <Sparkles className="absolute -right-4 -top-4 w-28 h-28 text-white/10 pointer-events-none" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                    👑 Badshah Royal VIP Member
                  </span>
                  <h4 className="text-base font-black text-white mt-0.5 truncate">
                    {loyaltyCustomer.name || 'VIP Guest'}
                  </h4>
                  <p className="text-xs text-amber-200/90 font-mono mt-0.5 font-bold">
                    {formatDisplayPhone(loyaltyCustomer.phone)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-amber-300/80 uppercase block">Available Points</span>
                  <p className="text-2xl font-black text-amber-300 leading-tight">
                    {loyaltyPoints ?? 0} <span className="text-xs font-bold uppercase">pts</span>
                  </p>
                </div>
              </div>
              <div className="relative z-10 mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px] text-amber-100">
                <span>✨ +20 pts on today&apos;s meal delivery</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[10px] text-amber-300 hover:text-white hover:underline cursor-pointer font-bold"
                >
                  Switch / Change Number
                </button>
              </div>
            </div>

            {/* Segmented Tabs */}
            <div className="flex rounded-xl bg-stone-100 p-1 gap-1 text-xs font-bold text-stone-600">
              <button
                type="button"
                onClick={() => setVipModalTab('orders')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  vipModalTab === 'orders'
                    ? 'bg-white text-stone-900 shadow-xs font-extrabold'
                    : 'hover:text-stone-900'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-600" />
                <span>Previous Orders</span>
                {previousOrders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-black">
                    {previousOrders.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setVipModalTab('perks')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  vipModalTab === 'perks'
                    ? 'bg-white text-stone-900 shadow-xs font-extrabold'
                    : 'hover:text-stone-900'
                }`}
              >
                <Gift className="w-3.5 h-3.5 text-amber-600" />
                <span>Points &amp; Rewards</span>
              </button>
              <button
                type="button"
                onClick={() => setVipModalTab('profile')}
                className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  vipModalTab === 'profile'
                    ? 'bg-white text-stone-900 shadow-xs font-extrabold'
                    : 'hover:text-stone-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Account</span>
              </button>
            </div>

            {/* Tab Content: Previous Orders */}
            {vipModalTab === 'orders' && (
              <div className="space-y-3">
                {previousOrders.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
                      <History className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-extrabold text-amber-950">No Previous Orders Yet</h4>
                    <p className="text-xs text-amber-900/80 leading-relaxed max-w-xs mx-auto">
                      Welcome to the Badshah Family! Place your dine-in order today to earn{' '}
                      <strong>+20 VIP points</strong>. Your orders will appear here for 1-tap reordering!
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-1 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      Explore Food Menu →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="flex items-center justify-between text-[11px] text-stone-500 pb-0.5">
                      <span className="font-bold text-stone-700">Order History ({previousOrders.length})</span>
                      <span>Tap &quot;Reorder&quot; to add dishes to cart</span>
                    </div>
                    {previousOrders.map((order) => {
                      const isFulfilled = order.fulfilment === 'completed' || order.fulfilment === 'served' || order.fulfilment === 'SERVED'
                      const isPending =
                        order.fulfilment === 'placed' ||
                        order.fulfilment === 'preparing' ||
                        order.fulfilment === 'confirmed' ||
                        order.fulfilment === 'RECEIVED' ||
                        order.fulfilment === 'ACCEPTED' ||
                        order.fulfilment === 'PREPARING' ||
                        order.fulfilment === 'READY'
                      return (
                        <div
                          key={order.id}
                          className="p-3.5 rounded-2xl bg-stone-50/90 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/20 transition-all space-y-2 text-xs shadow-2xs"
                        >
                          {/* Order Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-black text-stone-900 text-[11px]">
                                #{order.orderNumber}
                              </span>
                              {order.tableLabel && (
                                <span className="px-1.5 py-0.5 rounded-md bg-stone-200/80 text-[10px] font-bold text-stone-700">
                                  Table {order.tableLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                  isFulfilled
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : isPending
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-stone-100 text-stone-600'
                                }`}
                              >
                                {isFulfilled ? 'Served' : isPending ? 'In Kitchen' : order.fulfilment}
                              </span>
                            </div>
                          </div>

                          {/* Order Date */}
                          <p className="text-[10px] text-stone-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                            <span>{formatOrderDate(order.createdAt)}</span>
                          </p>

                          {/* Items Breakdown */}
                          <div className="pt-1 border-t border-stone-200/60 space-y-1">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-baseline justify-between text-[11px] text-stone-700"
                              >
                                <span className="truncate pr-2 font-medium">
                                  <strong className="font-extrabold text-stone-900">{item.quantity}x</strong>{' '}
                                  {item.itemName}
                                </span>
                                {item.pricePaise ? (
                                  <span className="font-mono text-stone-500 shrink-0">
                                    {formatPaise(item.pricePaise * item.quantity)}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          {/* Bill & Reorder Action */}
                          <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-stone-400 uppercase font-bold block">
                                Bill Total
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-sm text-stone-900">
                                  {formatPaise(order.totalPaise)}
                                </span>
                                <span className="text-[10px] font-black text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md">
                                  +{order.loyaltyPointsEarned || 20} pts
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleReorder(order)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Reorder Dishes</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab Content: Points & Rewards */}
            {vipModalTab === 'perks' && (
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-black text-amber-950">How Badshah Points Work</p>
                    <p className="text-[11px] text-amber-900/80 leading-snug">
                      Earn <strong>+20 points</strong> on every dine-in meal delivery. Redeem points for free
                      desserts, biryanis &amp; cash discounts at checkout!
                    </p>
                  </div>
                  <div className="shrink-0 text-center px-2.5 py-1.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
                    <span className="text-[9px] text-stone-400 block font-bold uppercase">Earn Rate</span>
                    <span className="text-xs font-black text-amber-700">+20 pts</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-black text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    <span>Redeemable Rewards</span>
                  </h4>
                  {loyaltyRewards.length === 0 ? (
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center text-xs text-stone-500">
                      No special rewards right now. Points accrue on every meal!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {loyaltyRewards.map((r) => {
                        const canAfford = (loyaltyPoints ?? 0) >= r.pointsCost
                        return (
                          <div
                            key={r.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                              canAfford
                                ? 'bg-amber-50/60 border-amber-300 text-stone-900'
                                : 'bg-stone-50/70 border-stone-200 text-stone-600 opacity-75'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-extrabold text-stone-900 truncate">{r.name}</p>
                              <p className="text-[11px] text-stone-500 truncate">
                                {r.description || 'Complimentary VIP perk'}
                              </p>
                              <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded mt-1 inline-block">
                                {r.pointsCost} points
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${
                                canAfford ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
                              }`}
                            >
                              {canAfford ? 'Apply at Checkout' : `Need ${r.pointsCost - (loyaltyPoints ?? 0)} more`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-stone-500 text-center">
                    Selected rewards are automatically deducted from your total at checkout.
                  </p>
                </div>
              </div>
            )}

            {/* Tab Content: Profile */}
            {vipModalTab === 'profile' && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 font-bold">Mobile Number</span>
                    <span className="font-mono font-black text-stone-900">{formatDisplayPhone(loyaltyCustomer.phone)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 font-bold">Customer Name</span>
                    <span className="font-extrabold text-stone-900">{loyaltyCustomer.name || 'VIP Guest'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 font-bold">Member Status</span>
                    <span className="font-extrabold text-amber-700">Royal Gold VIP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 font-bold">Total Orders</span>
                    <span className="font-mono font-black text-stone-900">{previousOrders.length}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Sign Out / Switch Mobile Number
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md transition-all active:scale-98 cursor-pointer text-center"
            >
              Continue Ordering Food →
            </button>
          </div>
        ) : (
          /* Not logged in: Quick 10-digit login right here */
          <div className="space-y-4">
            <div className="text-center space-y-1.5 pt-1">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#8a0214] via-[#a30b1c] to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-900/20">
                <Crown className="w-7 h-7 fill-amber-300/30 text-amber-200" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
                Biryani Badshah VIP Club
              </span>
              <h4 className="text-base font-black text-stone-900">Enter Your Mobile Number</h4>
              <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
                All guests start here to access VIP points, past orders &amp; unlock member discounts.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  10-Digit Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-600 font-mono flex items-center gap-1 border-r border-stone-200 pr-2">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    autoFocus
                    placeholder="98765 43210"
                    value={loginPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setLoginPhone(val)
                      if (val.length === 10) {
                        handlePhoneLogin(val, loginName)
                      }
                    }}
                    className="w-full h-11 pl-20 pr-9 rounded-xl bg-stone-50 border border-stone-300 text-sm font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                  {loginLoading && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-600" />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Your Name <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amanullah / Guest"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-stone-50 border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>

              {loginError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => handlePhoneLogin(loginPhone, loginName)}
                disabled={loginLoading || loginPhone.replace(/\D/g, '').length < 10}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8a0214] via-[#9e0c1f] to-[#b45309] hover:brightness-110 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-amber-900/20 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying &amp; Loading VIP Orders…</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Order &amp; View History</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Benefits Grid */}
              <div className="pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-stone-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>+20 pts on delivery</span>
                </div>
                <div className="flex items-center gap-1.5 text-stone-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>1-Tap reorder past dishes</span>
                </div>
                <div className="flex items-center gap-1.5 text-stone-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Member discounts</span>
                </div>
                <div className="flex items-center gap-1.5 text-stone-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>100% Passwordless</span>
                </div>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    try {
                      sessionStorage.setItem('rp_skip_phone', '1')
                    } catch {}
                  }}
                  className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                >
                  Skip &amp; browse menu as guest →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
