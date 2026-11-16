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
  console.log('Seeding Mehman Nawazi Special Menu items...')

  // 1. Create or ensure category
  const catRef = db.doc('orderMenuCategories/mehman_nawazi')
  await catRef.set({
    name: 'Mehman Nawazi (Party Pack)',
    position: 0,
    active: true,
    restaurantId: 'default',
    createdAt: now,
    updatedAt: now,
  }, { merge: true })
  console.log('Category mehman_nawazi ready')

  // 2. Define all special items
  const items = [
    {
      id: 'special-motter-pulao',
      categoryId: 'mehman_nawazi',
      name: 'Motter Pulao (1 Kg)',
      pricePaise: 50000,
      veg: 'veg',
      description: 'Mehman Nawazi Party Pack — 1 kg aromatic basmati peas pulao',
      position: 1,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-meetha-zarda',
      categoryId: 'mehman_nawazi',
      name: 'Meetha Zarda (1 Kg)',
      pricePaise: 80000,
      veg: 'veg',
      description: 'Mehman Nawazi Party Pack — 1 kg royal sweet saffron rice with rich dry fruits',
      position: 2,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-chicken-korma',
      categoryId: 'mehman_nawazi',
      name: 'Chicken Korma (1 Kg)',
      pricePaise: 60000,
      veg: 'nonveg',
      description: 'Mehman Nawazi Party Pack — 1 kg rich traditional Mughlai chicken korma gravy',
      position: 3,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-mutton-korma',
      categoryId: 'mehman_nawazi',
      name: 'Mutton Korma (1 Kg)',
      pricePaise: 120000,
      veg: 'nonveg',
      description: 'Mehman Nawazi Party Pack — 1 kg royal slow-cooked tender mutton korma',
      position: 4,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-chicken-stick-kabab',
      categoryId: 'mehman_nawazi',
      name: 'Chicken Stick Kabab (Boneless 1 Kg)',
      pricePaise: 120000,
      veg: 'nonveg',
      description: 'Mehman Nawazi Party Pack — 1 kg skewered boneless chicken kababs',
      position: 5,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-murg-mussallam',
      categoryId: 'mehman_nawazi',
      name: 'Murg Mussallam (Per Pcs)',
      pricePaise: 65000,
      veg: 'nonveg',
      description: 'Mehman Nawazi Special — Whole chicken prepared in royal Mughlai rich gravy',
      position: 6,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-mutton-raan-e-arabian',
      categoryId: 'mehman_nawazi',
      name: 'Mutton Rane-E-Arabian (Per Pcs)',
      pricePaise: 250000,
      veg: 'nonveg',
      description: 'Mehman Nawazi Grand Special — Whole slow-roasted Arabian spiced leg of mutton',
      position: 7,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-baby-naan',
      categoryId: 'mehman_nawazi',
      name: 'Baby Naan (1 Kg)',
      pricePaise: 45000,
      veg: 'veg',
      description: 'Mehman Nawazi Party Pack — 1 kg fresh tandoori baby naans',
      position: 8,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-chicken-biryani-handi-45',
      categoryId: 'mehman_nawazi',
      name: 'Chicken Biryani Handi (40-45 Person)',
      pricePaise: 750000,
      veg: 'nonveg',
      description: 'Shan-E-Biryani — Grand Chicken Handi serving 40 to 45 persons',
      position: 9,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-chicken-biryani-handi-80',
      categoryId: 'mehman_nawazi',
      name: 'Chicken Biryani Handi (75-80 Person)',
      pricePaise: 1400000,
      veg: 'nonveg',
      description: 'Shan-E-Biryani — Mega Chicken Handi serving 75 to 80 persons',
      position: 10,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-mutton-biryani-handi-45',
      categoryId: 'mehman_nawazi',
      name: 'Mutton Biryani Handi (40-45 Person)',
      pricePaise: 1250000,
      veg: 'nonveg',
      description: 'Shan-E-Biryani — Grand Mutton Handi serving 40 to 45 persons',
      position: 11,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
    {
      id: 'special-mutton-biryani-handi-80',
      categoryId: 'mehman_nawazi',
      name: 'Mutton Biryani Handi (75-80 Person)',
      pricePaise: 2150000,
      veg: 'nonveg',
      description: 'Shan-E-Biryani — Mega Mutton Handi serving 75 to 80 persons',
      position: 12,
      available: true,
      visible: true,
      featured: true,
      options: [],
    },
  ]

  const batch = db.batch()
  for (const item of items) {
    const docRef = db.doc(`orderMenuItems/${item.id}`)
    batch.set(docRef, {
      ...item,
      restaurantId: 'default',
      imageUrl: null,
      createdAt: now,
      updatedAt: now,
    }, { merge: true })
  }

  await batch.commit()
  console.log(`Successfully seeded ${items.length} special menu items into Firestore!`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
