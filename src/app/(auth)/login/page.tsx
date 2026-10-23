'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, CheckCircle2, Utensils, KeyRound, UserCheck, ShieldCheck } from 'lucide-react'
import ChangePasswordModal from '@/components/auth/ChangePasswordModal'
import ForgotPasswordModal from '@/components/auth/ForgotPasswordModal'
import { useClientConfig } from '@/config/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)

  const { branding, restaurantName } = useClientConfig()

  const [error, setError] = useState<string | null>(null)

  // Parse auth error params after hydration to avoid SSR mismatch.
  // Server renders null; client fills in via effect.
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hashString = window.location.hash.replace(/^#/, '')
    const hashParams = new URLSearchParams(hashString)

    const errorCode = searchParams.get('error_code') || hashParams.get('error_code')
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
    const generalError = searchParams.get('error') || hashParams.get('error')

    if (errorCode === 'otp_expired') {
      setError('The password reset link is invalid or has expired. Please request a new one.')
    } else if (errorDescription) {
      setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
    } else if (generalError === 'auth_callback_failed') {
      setError('Authentication failed. Please try logging in again.')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid login credentials. Please try again.')
        setLoading(false)
        return
      }

      // Sync cookies immediately to native Android persistent storage if on Android app
      try {
        if (typeof window !== 'undefined' && (window as any).AndroidTTS?.syncCookies) {
          (window as any).AndroidTTS.syncCookies()
        }
      } catch {}

      // Successful login -> navigate to dashboard
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Connection error. Please try again.'
      setError(rawMsg)
      setLoading(false)
    }
  }

  return (
    <>
      <Card className="border border-slate-800 bg-slate-900/85 backdrop-blur-xl shadow-2xl text-slate-100 rounded-3xl overflow-hidden">
        <CardHeader className="space-y-1.5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-xs shadow-md"
              style={{ backgroundColor: branding.primary }}
            >
              <Utensils className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: branding.primary }}>
              {restaurantName} Admin
            </span>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <LogIn className="w-5 h-5" style={{ color: branding.primary }} />
            Welcome back
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Sign in to view guest responses, customer phone numbers, &amp; analytics
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3.5 pt-1">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" style={{ color: branding.primary }} />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="owner@yourrestaurant.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-500 h-11 rounded-xl text-sm"
                style={{ '--tw-ring-color': branding.primary } as React.CSSProperties}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" style={{ color: branding.primary }} />
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setSuccessMessage(null)
                    setIsChangeModalOpen(true)
                  }}
                  className="text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer group hover:underline"
                  style={{ color: branding.primary }}
                >
                  <KeyRound className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                  <span>Change Password</span>
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-500 h-11 pr-10 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-3 pb-5">
            <Button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold h-11 rounded-xl shadow-lg transition-all duration-200 cursor-pointer text-sm active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: branding.primary,
                boxShadow: `0 10px 15px -3px ${branding.primary}40`,
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in to Dashboard'
              )}
            </Button>

            <div className="flex items-center justify-center w-full pt-1.5 px-0.5 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setSuccessMessage(null)
                  setIsForgotModalOpen(true)
                }}
                className="transition-colors cursor-pointer flex items-center gap-1"
                style={{ color: branding.primary }}
              >
                <span>Forgot or reset password?</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: branding.primary }} />
              <span>{restaurantName} Admin Portal • Owner Access</span>
            </div>
          </CardFooter>
        </form>
      </Card>

      <ChangePasswordModal
        isOpen={isChangeModalOpen}
        onClose={() => setIsChangeModalOpen(false)}
        initialEmail={email}
        onPasswordChanged={(newPass) => {
          setPassword(newPass)
          setSuccessMessage('Password updated successfully! Click "Sign in to Dashboard" with your new credentials.')
        }}
      />

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialEmail={email}
      />
    </>
  )
}
