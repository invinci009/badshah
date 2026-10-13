'use client'

import { useState } from 'react'
import { Phone, User, ShieldCheck, Sparkles, Check, MessageCircle } from 'lucide-react'

export interface ContactInfoValue {
  name: string
  phone: string
  optIn: boolean
}

interface ContactInfoQuestionProps {
  value: ContactInfoValue
  onChange: (value: ContactInfoValue) => void
  restaurantName: string
}

export default function ContactInfoQuestion({
  value,
  onChange,
  restaurantName,
}: ContactInfoQuestionProps) {
  const [name, setName] = useState(value.name || '')
  const [phone, setPhone] = useState(value.phone || '')
  const [optIn, setOptIn] = useState(value.optIn ?? true)
  const [isFocused, setIsFocused] = useState<'name' | 'phone' | null>(null)

  const cleanPhone = phone.replace(/\D/g, '').slice(0, 10)
  const isValidPhone = cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(raw)
    onChange({
      name,
      phone: raw,
      optIn,
    })
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    onChange({
      name: val,
      phone: cleanPhone,
      optIn,
    })
  }

  const handleOptInToggle = () => {
    const next = !optIn
    setOptIn(next)
    onChange({
      name,
      phone: cleanPhone,
      optIn: next,
    })
  }

  return (
    <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Header Pill */}
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-900">
            Stay Connected
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Would you like to{' '}
          <span className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
            stay in touch
          </span>
          ?
        </h2>
        <p className="text-sm text-stone-600 max-w-sm mx-auto leading-relaxed">
          Leave your mobile number so we can reach out with special event invites and new menu updates on WhatsApp.
        </p>
      </div>

      {/* Input Fields Container */}
      <div className="space-y-4 max-w-md mx-auto text-left">
        {/* Name Input */}
        <div className="space-y-1.5">
          <label htmlFor="customer-name" className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-stone-500" />
            <span>Your Name (Optional)</span>
          </label>
          <div
            className={`relative flex items-center rounded-xl bg-stone-50 border transition-all duration-200 ${
              isFocused === 'name'
                ? 'border-amber-500 bg-white ring-3 ring-amber-500/15 shadow-sm'
                : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            <input
              id="customer-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              onFocus={() => setIsFocused('name')}
              onBlur={() => setIsFocused(null)}
              placeholder="Enter your name"
              className="w-full h-12 px-4 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Mobile Number Input */}
        <div className="space-y-1.5">
          <label htmlFor="customer-phone" className="text-xs font-semibold text-stone-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-600" />
              <span>Mobile Number</span>
              <span className="text-[10px] text-stone-500 font-medium bg-stone-100 px-1.5 py-0.5 rounded-md border border-stone-200/60">
                Optional
              </span>
            </div>
            {isValidPhone && (
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Valid
              </span>
            )}
          </label>

          <div
            className={`relative flex items-center rounded-xl bg-stone-50 border transition-all duration-200 ${
              isFocused === 'phone'
                ? 'border-amber-500 bg-white ring-3 ring-amber-500/15 shadow-sm'
                : isValidPhone
                ? 'border-emerald-400/80 bg-emerald-50/20'
                : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            {/* Country Code Prefix */}
            <div className="flex items-center gap-1 px-3 py-2 border-r border-stone-200 text-xs font-bold text-stone-700 select-none">
              <span className="text-base" aria-hidden="true">🇮🇳</span>
              <span>+91</span>
            </div>

            <input
              id="customer-phone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={cleanPhone}
              onChange={handlePhoneChange}
              onFocus={() => setIsFocused('phone')}
              onBlur={() => setIsFocused(null)}
              placeholder="98350 XXXXX"
              maxLength={10}
              className="w-full h-12 px-3.5 bg-transparent text-sm font-medium tracking-wide text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
          </div>
          <p className="text-[11px] text-stone-500 pl-1">
            Enter 10-digit Indian mobile number
          </p>
        </div>

        {/* WhatsApp Opt-in Checkbox */}
        <label
          htmlFor="whatsapp-optin"
          onClick={handleOptInToggle}
          className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/80 cursor-pointer hover:bg-stone-100/60 transition-colors select-none"
        >
          <div
            className={`w-5 h-5 rounded-md border mt-0.5 flex items-center justify-center transition-colors ${
              optIn
                ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                : 'border-stone-300 bg-white'
            }`}
          >
            {optIn && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
          <div className="text-xs space-y-0.5">
            <span className="font-semibold text-stone-800 block flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              Receive updates on WhatsApp
            </span>
            <span className="text-[11px] text-stone-500 block">
              Get notified about special dining offers, new Biryani Badshah royal menu items &amp; festive discounts. Unsubscribe anytime.
            </span>
          </div>
        </label>
      </div>

      {/* Privacy Guarantee Note */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-stone-400 pt-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>100% Private. We never share your phone number with third parties.</span>
      </div>
    </div>
  )
}
