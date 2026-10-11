import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, LayoutDashboard, QrCode, MessageSquare, Utensils, Settings, LogOut, Users, Table2, Receipt, ChefHat } from 'lucide-react'
import { getRestaurantConfig } from '@/config/loader'
import { getBrandingTokens } from '@/config/branding'
import type { AuthUser } from '@/lib/firebase/auth'
import { cookies } from 'next/headers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const config = getRestaurantConfig()
  const branding = getBrandingTokens(config)

  // Check for Firebase token in cookies
  const cookieStore = await cookies()
  const idToken = cookieStore.get('firebase_token')?.value

  if (!idToken) {
    redirect('/login')
  }

  // Lazy import inside try/catch: if the Firebase Admin bundle cannot be
  // loaded in this runtime, redirect to login instead of 500ing.
  // redirect() stays outside try/catch — it works by throwing.
  let user: AuthUser | null = null
  try {
    const { validateSession } = await import('@/lib/firebase/auth')
    user = await validateSession(idToken)
  } catch (err) {
    console.error('DashboardLayout: session validation unavailable:', err)
    user = null
  }
  if (!user) {
    redirect('/login')
  }

  async function signOutAction() {
    'use server'
    const { cookies } = await import('next/headers')
    const { redirect } = await import('next/navigation')
    const cookieStore = await cookies()
    cookieStore.delete('firebase_token')
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold shadow-md group-hover:scale-105 transition-transform border border-white/20 text-xs tracking-wider"
                style={{ backgroundColor: branding.primary }}
              >
                {config.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-white tracking-tight leading-tight">{config.name}</span>
                <span className="text-[10px] font-semibold leading-none" style={{ color: branding.primary }}>
                  ReviewPulse Portal
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link
                href="/dashboard?tab=overview"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" style={{ color: branding.primary }} />
                Overview
              </Link>
              <Link
                href="/dashboard?tab=customers"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <Users className="w-4 h-4 text-teal-400" />
                Customers
              </Link>
              <Link
                href="/dashboard?tab=responses"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <MessageSquare className="w-4 h-4" style={{ color: branding.primary }} />
                Responses
              </Link>
              <Link
                href="/dashboard?tab=campaigns"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <QrCode className="w-4 h-4 text-rose-400" />
                Campaigns
              </Link>
              <Link
                href="/dashboard?tab=menu"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <Utensils className="w-4 h-4 text-emerald-400" />
                Menu
              </Link>
              <Link
                href="/dashboard?tab=tables"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <Table2 className="w-4 h-4 text-amber-400" />
                Tables
              </Link>
              <Link
                href="/dashboard?tab=orders"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                Orders
              </Link>
              <Link
                href="/dashboard?tab=kitchen"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <ChefHat className="w-4 h-4 text-rose-400" />
                Kitchen
              </Link>
              <Link
                href="/dashboard?tab=settings"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Settings
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">
                {user.email}
              </span>
              <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: branding.primary }}>
                <Sparkles className="w-3 h-3" /> Owner
              </span>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/50 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>
    </div>
  )
}
