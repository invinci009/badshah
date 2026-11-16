import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Special Menu Catalog & Mehman Nawazi Integrity', async (t) => {
  await t.test('All special menu font assets exist on disk in public/fonts and src/app/fonts', () => {
    const requiredFonts = [
      'public/fonts/OnStageSerial-Xbold.woff2',
      'public/fonts/OnStageSerial-Xbold.woff',
      'public/fonts/OnStageSerial-Xbold.ttf',
      'src/app/fonts/OnStageSerial-Xbold.woff2',
      'src/app/fonts/OnStageSerial-Xbold.woff',
      'src/app/fonts/OnStageSerial-Xbold.ttf',
      'public/fonts/BruceForever.ttf',
      'src/app/fonts/BruceForever.ttf',
    ]
    for (const f of requiredFonts) {
      assert.ok(fs.existsSync(path.resolve(process.cwd(), f)), `Font file missing: ${f}`)
    }
  })

  await t.test('Logo assets exist for brand identity in all required variants', () => {
    const logoFiles = [
      'public/logo.png',
      'public/branding/logo.png',
      'public/apple-touch-icon.png',
      'public/icon-192x192.png',
      'public/icon-512x512.png',
      'public/favicon.ico',
    ]
    for (const f of logoFiles) {
      assert.ok(fs.existsSync(path.resolve(process.cwd(), f)), `Brand asset missing: ${f}`)
    }
  })

  await t.test('Special menu data file exports authoritative items with exact physical menu prices', async () => {
    const specialDataPath = path.resolve(process.cwd(), 'src/lib/ordering/specialMenuData.ts')
    assert.ok(fs.existsSync(specialDataPath), 'specialMenuData.ts exists')
    const content = fs.readFileSync(specialDataPath, 'utf8')

    // Check party pack items and their prices
    assert.match(content, /special-motter-pulao/)
    assert.match(content, /50000/) // ₹500
    assert.match(content, /special-meetha-zarda/)
    assert.match(content, /80000/) // ₹800
    assert.match(content, /special-chicken-korma/)
    assert.match(content, /60000/) // ₹600
    assert.match(content, /special-mutton-korma/)
    assert.match(content, /120000/) // ₹1,200
    assert.match(content, /special-chicken-stick-kabab/)
    assert.match(content, /120000/) // ₹1,200
    assert.match(content, /special-murg-mussallam/)
    assert.match(content, /65000/) // ₹650
    assert.match(content, /special-mutton-raan-e-arabian/)
    assert.match(content, /250000/) // ₹2,500
    assert.match(content, /special-baby-naan/)
    assert.match(content, /45000/) // ₹450

    // Check Shan-E-Biryani handis and prices
    assert.match(content, /special-chicken-biryani-handi-45/)
    assert.match(content, /750000/) // ₹7,500
    assert.match(content, /special-chicken-biryani-handi-80/)
    assert.match(content, /1400000/) // ₹14,000
    assert.match(content, /special-mutton-biryani-handi-45/)
    assert.match(content, /1250000/) // ₹12,500
    assert.match(content, /special-mutton-biryani-handi-80/)
    assert.match(content, /2150000/) // ₹21,500
  })

  await t.test('Dedicated Special Menu page and routes exist', () => {
    const specialPagePath = path.resolve(process.cwd(), 'src/app/order/[slug]/special-menu/page.tsx')
    assert.ok(fs.existsSync(specialPagePath), 'special-menu/page.tsx exists')
    const pageContent = fs.readFileSync(specialPagePath, 'utf8')

    // Verifies full ordering functionality
    assert.ok(pageContent.includes('handleAddItem'), 'Has Add to cart handler')
    assert.ok(pageContent.includes('handleChangeQty'), 'Has Stepper quantity handler')
    assert.ok(pageContent.includes('View Tray'), 'Has floating tray button')
    assert.ok(pageContent.includes('Proceed to Checkout'), 'Has checkout link')
    assert.ok(pageContent.includes('font-onstage'), 'Has On Stage Serial Xbold font applied')
  })

  await t.test('QR code API route supports type=special pointing to /order/[slug]/special-menu', () => {
    const qrRoutePath = path.resolve(process.cwd(), 'src/app/api/business/qr/route.ts')
    assert.ok(fs.existsSync(qrRoutePath), 'qr/route.ts exists')
    const content = fs.readFileSync(qrRoutePath, 'utf8')
    assert.ok(content.includes("type === 'special'"), 'Handles type === special')
    assert.ok(content.includes('/order/${slug}/special-menu'), 'Target URL is special-menu')
    assert.ok(content.includes('#1a6234'), 'Uses brand emerald green for special QR')
  })

  await t.test('globals.css declares On Stage Serial Xbold with local font files', () => {
    const cssPath = path.resolve(process.cwd(), 'src/app/globals.css')
    const content = fs.readFileSync(cssPath, 'utf8')
    assert.ok(content.includes("font-family: 'On Stage Serial Xbold'"), 'Has @font-face for On Stage Serial Xbold')
    assert.ok(content.includes('OnStageSerial-Xbold.woff2'), 'References woff2 font file')
    assert.ok(content.includes('font-onstage'), 'Defines .font-onstage utility class')
  })
})
