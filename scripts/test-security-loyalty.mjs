import http from 'http'

function request(method, path, data = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, 'http://localhost:3000')
    const headers = { 'Content-Type': 'application/json' }
    if (cookie) headers['Cookie'] = cookie
    const req = http.request(u, { method, headers }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers })
        } catch {
          resolve({ status: res.statusCode, body, headers: res.headers })
        }
      })
    })
    req.on('error', reject)
    if (data) req.write(JSON.stringify(data))
    req.end()
  })
}

async function runSecurityAuditTests() {
  console.log('=== CLOUDFLARE SECURITY AUDIT: LOYALTY & REWARD EDGE CASES ===\n')

  // Find an available table
  const menuRes = await request('GET', '/api/public/order-menu?slug=biryani-badshah-patna')
  const availableTable = (menuRes.data?.tables || []).find((t) => t.state === 'available') || { label: 'Table 99' }

  // Check 1: Unauthorized Reward Redemption (BOLA Protection)
  console.log(`1. Testing BOLA Protection on Reward Redemption for Table ${availableTable.label} (POST /api/public/orders)...`)
  const unauthRedeemRes = await request('POST', '/api/public/orders', {
    slug: 'biryani-badshah-patna',
    tableLabel: availableTable.label,
    customerName: 'Attacker Diner',
    customerPhone: '9876543210',
    idempotencyKey: crypto.randomUUID(),
    redeemRewardId: 'test-reward-123',
    items: [{ itemId: 'special-motter-pulao', quantity: 1, selections: [] }],
  })
  console.log('   Response status:', unauthRedeemRes.status)
  console.log('   Response code:', unauthRedeemRes.data?.code)
  if (unauthRedeemRes.status === 401 && unauthRedeemRes.data?.code === 'AUTH_REQUIRED_FOR_REDEMPTION') {
    console.log('   ✓ PASS: Unauthenticated reward redemption strictly rejected (401 AUTH_REQUIRED_FOR_REDEMPTION)')
  } else {
    throw new Error(`BOLA test failed: status ${unauthRedeemRes.status}, data ${JSON.stringify(unauthRedeemRes.data)}`)
  }

  // Check 2: Unauthenticated Loyalty Summary Data Exposure (IDOR Protection)
  console.log('\n2. Testing IDOR Protection on Loyalty Summary (GET /api/public/loyalty/summary?phone=9876543210)...')
  const idorRes = await request('GET', '/api/public/loyalty/summary?phone=9876543210')
  console.log('   Response status:', idorRes.status)
  if (idorRes.status === 401) {
    console.log('   ✓ PASS: Unauthenticated loyalty summary queries strictly rejected (401 Not logged in)')
  } else {
    throw new Error(`IDOR test failed: status ${idorRes.status}, data ${JSON.stringify(idorRes.data)}`)
  }

  // Check 3: Business Auth Protection on Loyalty Config & Redemptions
  console.log('\n3. Testing Business Loyalty Endpoint Access Control...')
  const cfgRes = await request('GET', '/api/business/loyalty/config')
  console.log('   GET /api/business/loyalty/config status:', cfgRes.status)
  if (cfgRes.status === 401) {
    console.log('   ✓ PASS: Business loyalty config rejects unauthenticated access (401 Unauthorized)')
  } else {
    throw new Error(`Business auth test failed: status ${cfgRes.status}`)
  }

  const redemptionsRes = await request('GET', '/api/business/loyalty/redemptions')
  console.log('   GET /api/business/loyalty/redemptions status:', redemptionsRes.status)
  if (redemptionsRes.status === 401) {
    console.log('   ✓ PASS: Business redemptions log rejects unauthenticated access (401 Unauthorized)')
  } else {
    throw new Error(`Business redemptions auth test failed: status ${redemptionsRes.status}`)
  }

  console.log('\n=== ALL CLOUDFLARE DEFENSIVE SECURITY AUDIT CHECKS PASSED 100% ===')
}

runSecurityAuditTests().catch((e) => {
  console.error('Test execution failed:', e)
  process.exit(1)
})
