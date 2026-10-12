import fs from 'fs'
import path from 'path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  }
}

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf8'))
const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
if (!saRaw) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY not found')
  process.exit(1)
}

const serviceAccount = JSON.parse(saRaw)
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)
const now = new Date().toISOString()

async function main() {
  console.log('Seeding restaurant settings...')
  await db.doc('restaurant/settings').set({
    name: config.name,
    slug: config.slug,
    contact: config.contact || {},
    location: config.location || {},
    google: config.google || {},
    branding: config.branding || {},
    features: config.features || {},
    settings: config.settings || {},
    welcomeMessage: config.welcomeMessage || {},
    createdAt: now,
    updatedAt: now,
  }, { merge: true })
  console.log('  ✓ Restaurant settings saved')

  console.log('Seeding ordering config...')
  await db.doc('restaurant/ordering').set({
    taxRateBps: 500,
    serviceChargePaise: 0,
    generalOrderingEnabled: true,
    currency: 'INR',
    updatedAt: now,
  }, { merge: true })
  console.log('  ✓ Ordering config saved')

  console.log('Seeding campaigns...')
  const campaigns = [
    { name: 'Table Stands - Dine-In QR', slug: config.slug, active: true },
    { name: 'Main Dining Hall Stand', slug: `${config.slug}-main`, active: true },
  ]
  for (const c of campaigns) {
    const existing = await db.collection('campaigns').where('slug', '==', c.slug).limit(1).get()
    if (existing.empty) {
      await db.collection('campaigns').add({ ...c, createdAt: now, updatedAt: now })
    }
  }
  console.log('  ✓ Campaigns verified')

  console.log('Seeding default dining tables (Tables 1 to 10)...')
  const existingTables = await db.collection('diningTables').get()
  if (existingTables.empty) {
    for (let i = 1; i <= 10; i++) {
      await db.collection('diningTables').add({
        restaurantId: 'default',
        label: String(i),
        description: `Dine-in Table ${i}`,
        active: true,
        state: 'available',
        activeTokenHash: null,
        activeTokenPrefix: null,
        createdAt: now,
        updatedAt: now,
      })
    }
    console.log('  ✓ Seeded 10 dining tables')
  } else {
    console.log(`  ✓ Dining tables already exist (${existingTables.size} tables)`)
  }

  console.log('All initial setup completed!')
}

main().catch(err => {
  console.error('Setup failed:', err)
  process.exit(1)
})
