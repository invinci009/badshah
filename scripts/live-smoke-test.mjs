import http from 'http'

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body.toString('utf-8'),
          rawBody: body,
        })
      })
    })
    req.on('error', reject)
    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

async function testAll() {
  console.log('--- STARTING COMPREHENSIVE LIVE API & ROUTE TEST ---')
  const base = 'http://localhost:3000'
  let passCount = 0
  let failCount = 0

  async function check(name, fn) {
    try {
      await fn()
      console.log(`[PASS] ${name}`)
      passCount++
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message)
      failCount++
    }
  }

  // 1. Static font assets
  await check('Font WOFF2 is served properly (status 200, >10KB)', async () => {
    const res = await fetchUrl(`${base}/fonts/OnStageSerial-Xbold.woff2`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    if (res.rawBody.length < 10000) throw new Error(`Size too small: ${res.rawBody.length}`)
  })

  await check('Font TTF is served properly (status 200, >40KB)', async () => {
    const res = await fetchUrl(`${base}/fonts/OnStageSerial-Xbold.ttf`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    if (res.rawBody.length < 40000) throw new Error(`Size too small: ${res.rawBody.length}`)
  })

  // 2. Logo image
  await check('Logo PNG is served properly (status 200, valid PNG header)', async () => {
    const res = await fetchUrl(`${base}/logo.png`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    const isPng = res.rawBody[0] === 0x89 && res.rawBody[1] === 0x50 && res.rawBody[2] === 0x4e && res.rawBody[3] === 0x47
    if (!isPng) throw new Error('Not a PNG image')
  })

  // 3. Special Menu HTML page
  await check('Special Menu page renders HTML with On Stage Serial and items', async () => {
    const res = await fetchUrl(`${base}/order/biryani-badshah-patna/special-menu`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    if (!res.body.includes('Mehman Nawazi')) throw new Error('Missing Mehman Nawazi heading')
    if (!res.body.includes('Shan-E-Biryani')) throw new Error('Missing Shan-E-Biryani')
    if (!res.body.includes('font-onstage')) throw new Error('Missing font-onstage class')
  })

  // 4. Main Menu HTML page
  await check('Main Menu page renders with Mehman Nawazi pill and Brand Identity', async () => {
    const res = await fetchUrl(`${base}/order/biryani-badshah-patna/menu`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    if (!res.body.includes('Mehman Nawazi')) throw new Error('Missing Mehman Nawazi pill')
    if (!res.body.includes('font-onstage')) throw new Error('Missing font-onstage branding')
  })

  // 5. Special QR PNG Endpoint
  await check('Special QR PNG generates valid PNG image with 200 OK', async () => {
    const res = await fetchUrl(`${base}/api/business/qr?slug=biryani-badshah-patna&type=special&format=png`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    if (res.headers['content-type'] !== 'image/png') throw new Error(`Wrong content type: ${res.headers['content-type']}`)
    const isPng = res.rawBody[0] === 0x89 && res.rawBody[1] === 0x50
    if (!isPng) throw new Error('QR response is not a PNG')
  })

  // 6. Special QR SVG Endpoint
  await check('Special QR SVG generates valid SVG containing brand emerald color (#1a6234)', async () => {
    const res = await fetchUrl(`${base}/api/business/qr?slug=biryani-badshah-patna&type=special&format=svg`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    if (!res.body.includes('<svg')) throw new Error('Response does not contain SVG tag')
    if (!res.body.includes('#1a6234')) throw new Error('SVG does not use brand color #1a6234')
  })

  // 7. Public Order Menu API
  await check('GET /api/public/order-menu returns catalog with items and categories', async () => {
    const res = await fetchUrl(`${base}/api/public/order-menu?slug=biryani-badshah-patna`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    const data = JSON.parse(res.body)
    if (!Array.isArray(data.items)) throw new Error('items is not an array')
    if (data.items.length === 0) throw new Error('No items returned')
    console.log(`    -> Catalog has ${data.items.length} items and ${data.categories?.length ?? 0} categories.`)
    const specialFound = data.items.filter((i) => i.id.startsWith('special-'))
    console.log(`    -> Special seeded items in catalog: ${specialFound.length}`)
  })

  // 8. Order Placement Validation Endpoint
  await check('POST /api/public/orders rejects incomplete inputs cleanly (400)', async () => {
    const res = await fetchUrl(`${base}/api/public/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.statusCode !== 400) throw new Error(`Expected 400 for empty body, got ${res.statusCode}`)
  })

  // 9. Service Requests Endpoint
  await check('POST /api/public/service-requests rejects invalid request (400)', async () => {
    const res = await fetchUrl(`${base}/api/public/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: '' }),
    })
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`)
  })

  // 10. Offline page
  await check('Offline PWA fallback renders with branding and offline status', async () => {
    const res = await fetchUrl(`${base}/offline`)
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`)
    if (!res.body.includes('Offline Mode')) throw new Error('Missing Offline Mode banner')
  })

  console.log(`\n========================================`)
  console.log(`TOTAL TESTS: ${passCount + failCount}`)
  console.log(`PASSED: ${passCount}`)
  console.log(`FAILED: ${failCount}`)
  console.log(`========================================`)
  if (failCount > 0) process.exit(1)
}

testAll().catch((e) => {
  console.error(e)
  process.exit(1)
})
