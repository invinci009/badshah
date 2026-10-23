import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeCustomerPhone,
  getCustomerAccount,
  createCustomerAccount,
  updateCustomerLogin,
  updateCustomerPassword,
  markCustomerVerified,
  storeOtp,
  verifyOtp,
  getOtpRecord,
  ensureLoyaltyAccount,
  getCustomerLoyaltySnapshot,
  getLoyaltyConfig,
  verifyPassword,
  getOrCreateCustomerAccount,
} from '@/lib/firebase/loyalty'
import { getOrdersByPhone, type Order } from '@/lib/firebase/ordering'
import { sendOtpSms } from '@/lib/loyalty/otp'
import {
  CUSTOMER_SESSION_COOKIE,
  createCustomerSessionToken,
  customerSessionCookieOptions,
  getCustomerSession,
} from '@/lib/loyalty/session'
import {
  loyaltySignupSchema,
  loyaltyLoginSchema,
  loyaltyOtpSchema,
  loyaltyResendSchema,
  loyaltyPhoneLoginSchema,
} from '@/lib/loyalty/validation'

// GET /api/public/loyalty/auth — current customer session + loyalty summary.
export async function GET(request: NextRequest) {
  try {
    const session = await getCustomerSession(request)
    if (!session) return NextResponse.json({ customer: null }, { status: 200 })
    // Suspended accounts are force-logged-out.
    const account = await getCustomerAccount(session.customerId)
    if (!account || account.status === 'suspended') {
      const res = NextResponse.json({ customer: null, suspended: !!account }, { status: 200 })
      res.cookies.set(CUSTOMER_SESSION_COOKIE, '', { ...customerSessionCookieOptions(), maxAge: 0 })
      return res
    }
    const [snapshot, cfg, orders] = await Promise.all([
      getCustomerLoyaltySnapshot(session.customerId),
      getLoyaltyConfig(),
      getOrdersByPhone(session.customerId, 30).catch(() => [] as Order[]),
    ])

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalPaise: o.totalPaise,
      fulfilment: o.fulfilment,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
      tableLabel: o.tableLabel,
      loyaltyAwarded: o.loyaltyAwarded ?? false,
      loyaltyPointsEarned: o.loyaltyPointsEarned ?? 0,
      loyaltyDiscountPaise: o.loyalty?.discountPaise ?? 0,
      items: (o.items || []).map((i) => ({
        itemId: i.itemId,
        itemName: i.itemName,
        quantity: i.quantity,
        pricePaise: i.unitPricePaise,
        selections: (i.options || []).map((opt) => ({
          groupId: opt.groupId,
          optionId: opt.optionId,
        })),
      })),
    }))

    return NextResponse.json({
      customer: {
        customerId: session.customerId,
        name: account.name,
        phone: account.phone,
        verified: true,
        status: account.status,
        memberSince: account.createdAt,
      },
      snapshot,
      orders: formattedOrders,
      config: {
        enabled: cfg.enabled,
        pointsPerOrder: cfg.pointsPerOrder,
        minOrderPaise: cfg.minOrderPaise,
        expiryEnabled: cfg.expiryEnabled,
        expiryDays: cfg.expiryDays,
        maxRedemptionsPerOrder: cfg.maxRedemptionsPerOrder,
      },
    })
  } catch (error) {
    console.error('Loyalty session GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/public/loyalty/auth — signup | verify | login | resend | logout.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''

    // ---- logout ----
    if (action === 'logout') {
      const res = NextResponse.json({ success: true }, { status: 200 })
      res.cookies.set(CUSTOMER_SESSION_COOKIE, '', { ...customerSessionCookieOptions(), maxAge: 0 })
      return res
    }

    // ---- phone-login (passwordless customer login / registration by mobile number) ----
    if (action === 'phone-login' || action === 'quick-login') {
      const parsed = loyaltyPhoneLoginSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 })
      }
      const phone = normalizeCustomerPhone(parsed.data.phone)
      if (!phone) {
        return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.' }, { status: 400 })
      }
      const requestedName = typeof parsed.data.name === 'string' && parsed.data.name.trim() ? parsed.data.name.trim().slice(0, 80) : ''
      const account = await getOrCreateCustomerAccount({ phone, name: requestedName })
      if (account.status === 'suspended') {
        return NextResponse.json({ error: 'This account is currently suspended. Please speak to staff.', code: 'SUSPENDED' }, { status: 403 })
      }
      const token = await createCustomerSessionToken({ customerId: phone, name: account.name, verified: true })
      await updateCustomerLogin(phone)

      const [snapshot, cfg, orders] = await Promise.all([
        getCustomerLoyaltySnapshot(phone),
        getLoyaltyConfig(),
        getOrdersByPhone(phone, 30).catch(() => [] as Order[]),
      ])

      const formattedOrders = orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalPaise: o.totalPaise,
        fulfilment: o.fulfilment,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        tableLabel: o.tableLabel,
        loyaltyAwarded: o.loyaltyAwarded ?? false,
        loyaltyPointsEarned: o.loyaltyPointsEarned ?? 0,
        loyaltyDiscountPaise: o.loyalty?.discountPaise ?? 0,
        items: (o.items || []).map((i) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          quantity: i.quantity,
          pricePaise: i.unitPricePaise,
          selections: (i.options || []).map((opt) => ({
            groupId: opt.groupId,
            optionId: opt.optionId,
          })),
        })),
      }))

      const res = NextResponse.json({
        success: true,
        customer: { customerId: phone, name: account.name, phone: account.phone, verified: true },
        snapshot,
        orders: formattedOrders,
        config: {
          enabled: cfg.enabled,
          pointsPerOrder: cfg.pointsPerOrder,
          minOrderPaise: cfg.minOrderPaise,
        },
      }, { status: 200 })
      res.cookies.set(CUSTOMER_SESSION_COOKIE, token, customerSessionCookieOptions())
      return res
    }

    // ---- signup (creates unverified account + sends OTP) ----
    if (action === 'signup') {
      const parsed = loyaltySignupSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid signup details', details: parsed.error.flatten() }, { status: 400 })
      }
      const phone = normalizeCustomerPhone(parsed.data.phone)
      if (!phone) {
        return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number.' }, { status: 400 })
      }
      const existing = await getCustomerAccount(phone)
      if (existing?.verified) {
        return NextResponse.json(
          { error: 'This mobile number is already registered. Please log in.' },
          { status: 409 }
        )
      }
      if (!existing) {
        await createCustomerAccount({ phone, name: parsed.data.name, password: parsed.data.password })
      } else {
        // Unverified account re-signing: refresh credentials, then re-send OTP.
        if (parsed.data.password) {
          await updateCustomerPassword(phone, parsed.data.password)
        }
        await ensureLoyaltyAccount(phone)
      }
      const otp = await storeOtp(phone, 'signup')
      const delivery = await sendOtpSms(phone, otp.code)
      return NextResponse.json(
        {
          success: true,
          pendingVerification: true,
          delivery,
          // Sandbox fallback so sign-up works before SMS provider wiring.
          ...(delivery.channel === 'sandbox' ? { sandboxCode: otp.code } : {}),
        },
        { status: 201 }
      )
    }

    // ---- verify (OTP check → verified + session cookie) ----
    if (action === 'verify') {
      const parsed = loyaltyOtpSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 })
      }
      const phone = normalizeCustomerPhone(parsed.data.phone)
      if (!phone) return NextResponse.json({ error: 'Invalid mobile number.' }, { status: 400 })
      const account = await getCustomerAccount(phone)
      if (!account) return NextResponse.json({ error: 'Account not found. Please sign up.' }, { status: 404 })
      if (account.verified) {
        // Already verified — proceed as login.
        const token = await createCustomerSessionToken({ customerId: phone, name: account.name, verified: true })
        await updateCustomerLogin(phone)
        const res = NextResponse.json({ success: true, verified: true, name: account.name }, { status: 200 })
        res.cookies.set(CUSTOMER_SESSION_COOKIE, token, customerSessionCookieOptions())
        return res
      }
      const ok = await verifyOtp(phone, parsed.data.code, 'signup')
      if (!ok) {
        return NextResponse.json({ error: 'Invalid or expired verification code.' }, { status: 401 })
      }
      await markCustomerVerified(phone)
      await ensureLoyaltyAccount(phone)
      const token = await createCustomerSessionToken({ customerId: phone, name: account.name, verified: true })
      await updateCustomerLogin(phone)
      const res = NextResponse.json({ success: true, verified: true, name: account.name }, { status: 200 })
      res.cookies.set(CUSTOMER_SESSION_COOKIE, token, customerSessionCookieOptions())
      return res
    }

    // ---- login (password; unverified accounts get an OTP flow response) ----
    if (action === 'login') {
      const parsed = loyaltyLoginSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Enter your mobile number and password.' }, { status: 400 })
      }
      const phone = normalizeCustomerPhone(parsed.data.phone)
      if (!phone) return NextResponse.json({ error: 'Enter a valid 10-digit mobile number.' }, { status: 400 })
      const account = await getCustomerAccount(phone)
      if (!account) {
        return NextResponse.json({ error: 'No account found for this number. Please sign up.' }, { status: 404 })
      }
      if (account.status === 'suspended') {
        return NextResponse.json(
          { error: 'This account is currently suspended. Please contact the restaurant.' },
          { status: 403 }
        )
      }
      if (!parsed.data.password || !account.passwordSalt || !account.passwordHash || !verifyPassword(parsed.data.password, account.passwordSalt, account.passwordHash)) {
        return NextResponse.json({ error: 'Incorrect mobile number or password.' }, { status: 401 })
      }
      if (!account.verified) {
        // Re-send OTP for pending verification.
        const otp = await storeOtp(phone, 'signup')
        const delivery = await sendOtpSms(phone, otp.code)
        return NextResponse.json(
          {
            success: true,
            pendingVerification: true,
            delivery,
            ...(delivery.channel === 'sandbox' ? { sandboxCode: otp.code } : {}),
          },
          { status: 200 }
        )
      }
      const token = await createCustomerSessionToken({ customerId: phone, name: account.name, verified: true })
      await updateCustomerLogin(phone)
      const res = NextResponse.json({ success: true, name: account.name }, { status: 200 })
      res.cookies.set(CUSTOMER_SESSION_COOKIE, token, customerSessionCookieOptions())
      return res
    }

    // ---- resend OTP (60s cooldown) ----
    if (action === 'resend') {
      const parsed = loyaltyResendSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid mobile number.' }, { status: 400 })
      const phone = normalizeCustomerPhone(parsed.data.phone)
      if (!phone) return NextResponse.json({ error: 'Enter a valid mobile number.' }, { status: 400 })
      const account = await getCustomerAccount(phone)
      if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
      if (account.verified) return NextResponse.json({ error: 'Account already verified. Please log in.' }, { status: 409 })
      const prev = await getOtpRecord(phone)
      if (prev && Date.now() - new Date(prev.createdAt).getTime() < 60_000) {
        return NextResponse.json(
          { error: 'Code sent recently — please wait a moment before requesting another.', cooldownSeconds: 60 },
          { status: 429 }
        )
      }
      const otp = await storeOtp(phone, 'signup')
      const delivery = await sendOtpSms(phone, otp.code)
      return NextResponse.json({
        success: true,
        delivery,
        ...(delivery.channel === 'sandbox' ? { sandboxCode: otp.code } : {}),
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    console.error('Loyalty auth POST error:', error)
    if (msg === 'ACCOUNT_EXISTS') {
      return NextResponse.json({ error: 'This mobile number is already registered. Please log in.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
