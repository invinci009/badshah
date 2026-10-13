'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  UserCheck,
  Lock,
  Sparkles,
  Sliders,
  Phone,
} from 'lucide-react'

export interface BusinessSettings {
  id: string
  name: string
  location: string | null
  phone?: string | null
  secondaryPhone?: string | null
  googleReviewUrl: string | null
  welcomeMessage: Record<string, string> | null
  primaryColor: string | null
}

interface SettingsTabProps {
  business: BusinessSettings
  onRefresh: () => void
  userEmail?: string
}

export default function SettingsTab({
  business,
  onRefresh,
  userEmail = 'admin',
}: SettingsTabProps) {
  // Navigation section toggle
  const [activeSection, setActiveSection] = useState<'profile' | 'security'>('profile')

  // Restaurant Profile state
  const [name, setName] = useState(business.name)
  const [location, setLocation] = useState(business.location || '')
  const [phone, setPhone] = useState(business.phone || '')
  const [secondaryPhone, setSecondaryPhone] = useState(business.secondaryPhone || '')
  const [googleUrl, setGoogleUrl] = useState(business.googleReviewUrl || '')
  const [welcomeText, setWelcomeText] = useState(
    (typeof business.welcomeMessage === 'object' && business.welcomeMessage?.en) ||
      "Thanks for dining with us! We'd love to hear about your experience today."
  )
  const [primaryColor, setPrimaryColor] = useState(business.primaryColor || '#f43f5e')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Security / Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [isSavingPass, setIsSavingPass] = useState(false)
  const [passSuccess, setPassSuccess] = useState<string | null>(null)
  const [passError, setPassError] = useState<string | null>(null)

  // Password strength calculation
  const calculateStrength = (pass: string) => {
    let score = 0
    if (pass.length >= 8) score += 1
    if (pass.length >= 12) score += 1
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1
    return score
  }

  const passStrengthScore = calculateStrength(newPassword)
  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = [
    'bg-slate-700',
    'bg-rose-500',
    'bg-amber-500',
    'bg-sky-500',
    'bg-emerald-500',
  ]

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    setProfileError(null)
    setProfileSuccess(false)

    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || undefined,
          phone: phone.trim() || undefined,
          secondary_phone: secondaryPhone.trim() || undefined,
          google_review_url: googleUrl.trim() || null,
          welcome_message: { en: welcomeText.trim() },
          primary_color: primaryColor || null,
        }),
      })

      if (res.ok) {
        setProfileSuccess(true)
        setTimeout(() => setProfileSuccess(false), 3000)
        onRefresh()
      } else {
        const data = await res.json()
        setProfileError(data.error || 'Failed to update settings')
      }
    } catch {
      setProfileError('Connection error')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingPass(true)
    setPassError(null)
    setPassSuccess(null)

    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.')
      setIsSavingPass(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.')
      setIsSavingPass(false)
      return
    }

    if (currentPassword === newPassword) {
      setPassError('New password must be different from current password.')
      setIsSavingPass(false)
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userEmail,
          currentPassword,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPassError(data.error || 'Failed to update password. Check your current password.')
        setIsSavingPass(false)
        return
      }

      setPassSuccess('Password updated successfully! Your new password is now active.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPassSuccess(null), 4000)
    } catch (err: unknown) {
      setPassError(err instanceof Error ? err.message : 'Connection error. Please try again.')
    } finally {
      setIsSavingPass(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      {/* Header and Section Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Settings &amp; Security</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure restaurant preferences, Google review redirect, and owner security credentials
          </p>
        </div>

        {/* Section Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSection === 'profile'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Profile &amp; Branding</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSection === 'security'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security &amp; Password</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PROFILE & BRANDING */}
      {activeSection === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                Profile Details
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Information displayed to guests scanning QR codes
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
              {profileError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{profileError}</span>
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Settings saved successfully!</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="sName" className="text-xs font-medium text-slate-300">
                  Restaurant Name
                </Label>
                <Input
                  id="sName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sLoc" className="text-xs font-medium text-slate-300">
                  Location / Full Address
                </Label>
                <Input
                  id="sLoc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Phulwari Rd, Near Shaheed Bhagat Singh Chowk, Birla Colony, Phulwari Sharif, Patna, Bihar 801505"
                  className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sPhone" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                      Main Customer Helpline No.
                    </Label>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Customer Facing
                    </span>
                  </div>
                  <Input
                    id="sPhone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="77639 49496"
                    className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400">
                    Primary number displayed to diners on survey &amp; thank you cards.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sSecPhone" className="text-xs font-medium text-slate-300">
                    Secondary Lines (Landline / Backup)
                  </Label>
                  <Input
                    id="sSecPhone"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    placeholder="77639 49496"
                    className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400">
                    Additional numbers shown in contact details.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sGoogle" className="text-xs font-medium text-slate-300">
                  Google Review Page URL
                </Label>
                <Input
                  id="sGoogle"
                  value={googleUrl}
                  onChange={(e) => setGoogleUrl(e.target.value)}
                  placeholder="https://g.page/r/... or https://maps.app.goo.gl/..."
                  className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs rounded-xl"
                />
                <p className="text-[11px] text-slate-400">
                  Customers will be handed off directly to this URL after completing the quiz.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sWelcome" className="text-xs font-medium text-slate-300">
                  Welcome Copy on Landing Screen
                </Label>
                <textarea
                  id="sWelcome"
                  rows={3}
                  value={welcomeText}
                  onChange={(e) => setWelcomeText(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-slate-300">Brand Accent Color</Label>
                  <p className="text-[11px] text-slate-400">Used for highlights in QR landing screens</p>
                </div>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ReviewPulse policy guardrails are permanently active for this restaurant.</span>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6 border-t border-slate-800 flex justify-end">
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white text-xs font-semibold h-10 px-6 rounded-xl shadow-md shadow-amber-600/20 cursor-pointer active:scale-95"
              >
                {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Save Profile Changes
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* SECTION 2: SECURITY & PASSWORD */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          {/* Active Account Identity Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white">{userEmail}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Owner Access
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Aliases supported for login: <strong className="text-slate-300">admin</strong>,{' '}
                  <strong className="text-slate-300">owner</strong>,{' '}
                  <strong className="text-slate-300">zaika</strong>,{' '}
                  <strong className="text-slate-300">pmzaika</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Session Authenticated</span>
            </div>
          </div>

          {/* Change Password Form Card */}
          <form onSubmit={handleUpdatePassword}>
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader className="pb-4 border-b border-slate-800">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  Change Master Password
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Update your credentials to set your own secure password.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                {passError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{passError}</span>
                  </div>
                )}
                {passSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{passSuccess}</span>
                  </div>
                )}

                {/* Current Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="currPass" className="text-xs font-medium text-slate-300">
                    Current Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="currPass"
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter your current password"
                      disabled={isSavingPass}
                      className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs pr-10 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      tabIndex={-1}
                      aria-label={showCurrentPass ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="newPass" className="text-xs font-medium text-slate-300">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPass"
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="At least 8 characters"
                      disabled={isSavingPass}
                      className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs pr-10 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      tabIndex={-1}
                      aria-label={showNewPass ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {newPassword.length > 0 && (
                    <div className="pt-1.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Password strength:</span>
                        <span
                          className={`font-semibold ${
                            passStrengthScore <= 1
                              ? 'text-rose-400'
                              : passStrengthScore <= 2
                              ? 'text-amber-400'
                              : passStrengthScore === 3
                              ? 'text-sky-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {strengthLabels[passStrengthScore]}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`rounded-full h-full transition-all duration-200 ${
                              passStrengthScore >= step
                                ? strengthColors[passStrengthScore]
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5">
                        <span className={newPassword.length >= 8 ? 'text-emerald-400 font-semibold' : ''}>
                          ✓ 8+ chars
                        </span>
                        <span
                          className={
                            /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)
                              ? 'text-emerald-400 font-semibold'
                              : ''
                          }
                        >
                          ✓ Mixed case
                        </span>
                        <span
                          className={
                            /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)
                              ? 'text-emerald-400 font-semibold'
                              : ''
                          }
                        >
                          ✓ Numbers or symbols
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="confPass" className="text-xs font-medium text-slate-300">
                      Confirm New Password
                    </Label>
                    {confirmPassword.length > 0 && (
                      <span
                        className={`text-[11px] font-semibold flex items-center gap-1 ${
                          newPassword === confirmPassword ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {newPassword === confirmPassword ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Passwords match
                          </>
                        ) : (
                          'Mismatch'
                        )}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="confPass"
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-type new password"
                      disabled={isSavingPass}
                      className="bg-slate-950/60 border-slate-800 text-white h-10 text-xs pr-10 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      tabIndex={-1}
                      aria-label={showConfirmPass ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Changing your password takes effect immediately across all sessions and devices.
                    Store your new credentials safely.
                  </span>
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-6 border-t border-slate-800 flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={
                    isSavingPass ||
                    !currentPassword ||
                    newPassword.length < 8 ||
                    newPassword !== confirmPassword
                  }
                  className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white text-xs font-semibold h-10 px-6 rounded-xl shadow-md shadow-amber-600/20 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSavingPass ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  Update Password
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      )}
    </div>
  )
}
