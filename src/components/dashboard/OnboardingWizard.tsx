'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Utensils, ArrowRight, Loader2, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react'

export default function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('Biryani Badshah')
  const [location, setLocation] = useState('Phulwari Rd, Near Shaheed Bhagat Singh Chowk, Birla Colony, Phulwari Sharif, Patna, Bihar 801505')
  const [phone, setPhone] = useState('96939 99890')
  const [googleReviewUrl, setGoogleReviewUrl] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Thanks for dining with Biryani Badshah! We\'d love to hear about your royal experience today. For helpline & orders call 96939 99890.'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFinish = async () => {
    if (!name.trim()) {
      setError('Please enter your restaurant name')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: 'restaurant',
          location: location.trim() || undefined,
          phone: phone.trim() || undefined,
          google_review_url: googleReviewUrl.trim() || null,
          welcome_message: { en: welcomeMessage.trim() },
        }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to complete setup')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 mb-2">
          <Utensils className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
          Set up your restaurant
        </h1>
        <p className="text-sm text-slate-400">
          Takes less than 2 minutes. Start collecting feedback today.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl text-slate-100 rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              {step === 1 ? 'Step 1: Restaurant Details' : 'Step 2: Guest Experience'}
            </CardTitle>
            <span className="text-xs font-semibold text-slate-400">Step {step} of 2</span>
          </div>
          <CardDescription className="text-xs text-slate-400">
            {step === 1
              ? 'Tell us your restaurant name and review link'
              : 'Customize the welcome greeting seen by diners'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium text-slate-300">
                  Restaurant Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Copper Chimney Bistro"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-slate-950/60 border-slate-800 text-white h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-medium text-slate-300">
                  Location / City (optional)
                </Label>
                <Input
                  id="location"
                  placeholder="e.g. Indiranagar, Bengaluru"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-slate-950/60 border-slate-800 text-white h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleUrl" className="text-xs font-medium text-slate-300">
                  Google Review URL (optional)
                </Label>
                <Input
                  id="googleUrl"
                  placeholder="https://g.page/r/your-review-link"
                  value={googleReviewUrl}
                  onChange={(e) => setGoogleReviewUrl(e.target.value)}
                  className="bg-slate-950/60 border-slate-800 text-white h-10"
                />
                <p className="text-[11px] text-slate-400">
                  Found on your Google Business Profile &gt; &quot;Ask for reviews&quot;. Can be added later.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="welcome" className="text-xs font-medium text-slate-300">
                  Welcome Greeting for Customers
                </Label>
                <textarea
                  id="welcome"
                  rows={3}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
                <p className="text-[11px] text-slate-400">
                  Shown on the QR landing screen before the 5-question quiz.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Google Compliance Built-in</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  ReviewPulse automatically ensures equal review access and no rating steering, protecting your Google Business profile from penalties.
                </p>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-2 pb-6 border-t border-slate-800">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 1 ? (
            <Button
              type="button"
              onClick={() => {
                if (!name.trim()) {
                  setError('Please enter your restaurant name')
                  return
                }
                setError(null)
                setStep(2)
              }}
              className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs font-semibold h-10 px-5 rounded-xl shadow-md shadow-rose-500/20 cursor-pointer"
            >
              Next Step
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs font-semibold h-10 px-6 rounded-xl shadow-md shadow-rose-500/20 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Creating restaurant...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Launch Restaurant
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
