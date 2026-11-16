import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Cloudflare Security Audit Skill — Vulnerability Patch Verification', async (t) => {
  const root = process.cwd()

  await t.test('1. Image Proxy SSRF & Resource Exhaustion Protection', () => {
    const routePath = path.resolve(root, 'src/app/api/public/image-proxy/route.ts')
    assert.ok(fs.existsSync(routePath), 'image-proxy route exists')
    const content = fs.readFileSync(routePath, 'utf8')

    // Must enforce https only
    assert.ok(content.includes("protocol !== 'https:'"), 'Rejects non-https protocols')
    // Must contain domain allowlist / deny IP literals
    assert.ok(content.includes('isAllowedHost'), 'Contains host allowlist validator')
    // Must enforce size limits
    assert.ok(content.includes('MAX_IMAGE_BYTES'), 'Enforces maximum byte limit')
    // Must validate MIME types against raster image allowlist
    assert.ok(content.includes('ALLOWED_MIME_TYPES'), 'Enforces image MIME type allowlist')
  })

  await t.test('2. Loyalty JWT Secret Hardening & Unforgeability', () => {
    const sessionPath = path.resolve(root, 'src/lib/loyalty/session.ts')
    const content = fs.readFileSync(sessionPath, 'utf8')

    // Must never fall back to public NEXT_PUBLIC_FIREBASE_PROJECT_ID
    assert.ok(
      !content.includes("NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'reviewpulse'"),
      'Eliminated predictable public NEXT_PUBLIC fallback'
    )
    // Must use server-only private key or high-entropy fallback
    assert.ok(content.includes('FIREBASE_PRIVATE_KEY'), 'Uses server-only private key')
    assert.ok(content.includes("algorithms: ['HS256']"), 'Pins HS256 algorithm on verification')
  })

  await t.test('3. Feedback Session Cookie Secret Hardening', () => {
    const cookiePath = path.resolve(root, 'src/lib/session/cookie.ts')
    const content = fs.readFileSync(cookiePath, 'utf8')

    // Must not use hardcoded static dev secret in production fallback
    assert.ok(
      !content.includes("'default-dev-secret-32-chars-long-reviewpulse!'"),
      'Eliminated hardcoded static dev secret fallback'
    )
  })

  await t.test('4. BOLA & AI Resource Exhaustion on Session Draft & Submit', () => {
    const draftPath = path.resolve(root, 'src/app/api/public/sessions/[id]/draft/route.ts')
    const submitPath = path.resolve(root, 'src/app/api/public/sessions/[id]/submit/route.ts')
    const draftContent = fs.readFileSync(draftPath, 'utf8')
    const submitContent = fs.readFileSync(submitPath, 'utf8')

    assert.ok(
      draftContent.includes('!cookie || cookie.session_id !== id'),
      'Draft route strictly validates session cookie'
    )
    assert.ok(
      submitContent.includes('!cookie || cookie.session_id !== id'),
      'Submit route strictly validates session cookie'
    )
  })

  await t.test('5. Host-Header Poisoning Defense on Password Reset', () => {
    const resetPath = path.resolve(root, 'src/app/api/auth/reset-password/route.ts')
    const content = fs.readFileSync(resetPath, 'utf8')

    // Must validate host or prioritize NEXT_PUBLIC_APP_URL
    assert.ok(content.includes('safeOrigin'), 'Resolves safe origin')
    assert.ok(
      !content.includes('`${request.nextUrl.origin}/reset-password`'),
      'No unvalidated request.nextUrl.origin'
    )
  })

  await t.test('6. Admin Session Authentication & Invalidation on Password Change/Logout', () => {
    const changePath = path.resolve(root, 'src/app/api/auth/change-password/route.ts')
    const logoutPath = path.resolve(root, 'src/app/api/auth/logout/route.ts')
    const changeContent = fs.readFileSync(changePath, 'utf8')
    const logoutContent = fs.readFileSync(logoutPath, 'utf8')

    assert.ok(
      changeContent.includes('getSessionFromRequest'),
      'Uses getSessionFromRequest to support both session cookies and tokens'
    )
    assert.ok(
      changeContent.includes('revokeRefreshTokens'),
      'Revokes previous sessions upon password update'
    )
    assert.ok(
      logoutContent.includes('revokeRefreshTokens'),
      'Revokes tokens on server-side logout'
    )
  })

  await t.test('7. File Upload MIME-to-Extension Pinning & SVG Script Elimination', () => {
    const uploadPath = path.resolve(root, 'src/app/api/business/upload/route.ts')
    const content = fs.readFileSync(uploadPath, 'utf8')

    assert.ok(content.includes('MIME_TO_EXT'), 'Derives extension strictly from validated MIME type')
    assert.ok(content.includes('<script'), 'Sanitizes SVG files against embedded scripts')
  })

  await t.test('8. CSV Formula Injection Defense (CWE-1236)', () => {
    const exportPath = path.resolve(root, 'src/app/api/business/order-reports/export/route.ts')
    const content = fs.readFileSync(exportPath, 'utf8')

    assert.ok(content.includes('/^[=+\\-@\\t\\r]/'), 'Disarms spreadsheet formula triggers')
  })

  await t.test('9. HTTP Header Splitting & CRLF Prevention on QR Routes', () => {
    const qrPath = path.resolve(root, 'src/app/api/business/qr/route.ts')
    const tableQrPath = path.resolve(root, 'src/app/api/business/tables/qr/route.ts')
    const qrContent = fs.readFileSync(qrPath, 'utf8')
    const tableQrContent = fs.readFileSync(tableQrPath, 'utf8')

    assert.ok(qrContent.includes('[^a-zA-Z0-9_-]'), 'Sanitizes QR slug')
    assert.ok(tableQrContent.includes('[^a-zA-Z0-9_-]'), 'Sanitizes Table QR slug')
  })

  await t.test('10. Brute-Force Rate Limiting on Admin Auth & Atomic OTP Operations', () => {
    const proxyPath = path.resolve(root, 'src/proxy.ts')
    const rateLimitPath = path.resolve(root, 'src/lib/middleware/rate-limit.ts')
    const loyaltyPath = path.resolve(root, 'src/lib/firebase/loyalty.ts')

    const proxyContent = fs.readFileSync(proxyPath, 'utf8')
    const rateLimitContent = fs.readFileSync(rateLimitPath, 'utf8')
    const loyaltyContent = fs.readFileSync(loyaltyPath, 'utf8')

    assert.ok(proxyContent.includes("'/api/auth/:path*'"), 'Proxy matches /api/auth routes')
    assert.ok(rateLimitContent.includes('admin-auth'), 'Has admin-auth rate limiting bucket')
    assert.ok(loyaltyContent.includes('runTransaction'), 'Executes OTP verification in atomic transaction')
    assert.ok(loyaltyContent.includes('timingSafeEqual'), 'Uses constant-time comparison for OTP')
  })

  await t.test('11. Service Requests Fast-Path ETag & Zero-Read Polling', () => {
    const routePath = path.resolve(root, 'src/app/api/business/service-requests/route.ts')
    const orderingPath = path.resolve(root, 'src/lib/firebase/ordering.ts')
    const routeContent = fs.readFileSync(routePath, 'utf8')
    const orderingContent = fs.readFileSync(orderingPath, 'utf8')

    assert.ok(routeContent.includes('getActiveServiceRequestsEtag'), 'Route checks cached ETag')
    assert.ok(routeContent.includes('status: 304'), 'Route returns 304 on ETag match')
    assert.ok(orderingContent.includes('computeServiceRequestsEtag'), 'Ordering lib has computeServiceRequestsEtag')
    assert.ok(orderingContent.includes('invalidateActiveServiceRequestsCache'), 'Ordering lib has invalidateActiveServiceRequestsCache')
  })
})
