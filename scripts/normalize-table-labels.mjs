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
  console.log('Skipping Firestore normalization: FIREBASE_SERVICE_ACCOUNT_KEY not in environment')
  process.exit(0)
}

const serviceAccount = JSON.parse(saRaw)
const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

async function main() {
  const snapshot = await db.collection('diningTables').get()
  console.log(`Found ${snapshot.size} tables to verify/normalize...`)
  let updatedCount = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const rawLabel = data.label || ''
    // If label starts with Table (e.g. "Table 6" or "Table Table 6"), normalize to clean number or identifier
    if (/^table\b/i.test(rawLabel)) {
      const clean = rawLabel.replace(/^(table\s*)+/i, '').trim()
      if (clean && clean !== rawLabel) {
        await doc.ref.update({
          label: clean,
          updatedAt: new Date().toISOString()
        })
        console.log(`  ✓ Updated table ${doc.id}: "${rawLabel}" -> "${clean}"`)
        updatedCount++
      }
    }
  }

  console.log(`Table normalization complete. ${updatedCount} tables updated.`)
}

main().catch(err => {
  console.error('Failed to normalize tables:', err)
  process.exit(1)
})
