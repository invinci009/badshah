#!/usr/bin/env node

/**
 * Seed Biryani Badshah full menu catalog from physical printed menu photos.
 * Adheres strictly to:
 * - "don't add image but have an option to upload the image" -> imageUrl: null
 * - Accurate categories, prices (in integer paise), veg classification, and portions.
 */

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
const RESTAURANT_ID = 'default'
const now = new Date().toISOString()

const CATEGORIES = [
  { key: 'biryani', name: 'Biryani', position: 1 },
  { key: 'tandoor', name: 'Traditional Tandoor', position: 2 },
  { key: 'chicken_gravy', name: 'Chicken Gravy', position: 3 },
  { key: 'mutton_gravy', name: 'Mutton Gravy', position: 4 },
  { key: 'veg_chinese', name: 'Indian Veg. & Chinese', position: 5 },
  { key: 'chinese', name: 'Chinese', position: 6 },
  { key: 'roll', name: 'Roll Item', position: 7 },
  { key: 'roti', name: 'Roti', position: 8 },
  { key: 'addons', name: 'Extra / Add Ons Option', position: 9 },
  { key: 'raita_salad', name: 'Raita/Salad', position: 10 },
  { key: 'beverages', name: 'Drinks/Beverages', position: 11 },
  { key: 'dessert', name: 'Dessert', position: 12 },
  { key: 'specials', name: 'Badshah Specials', position: 13 },
]

const MENU_ITEMS = [
  // 1. Biryani
  {
    categoryKey: 'biryani',
    name: 'Chicken Fried Rice',
    pricePaise: 20000,
    veg: 'nonveg',
    description: 'Wok-tossed aromatic rice with tender chicken pieces and subtle spices',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Biryani',
    pricePaise: 22000,
    veg: 'nonveg',
    description: 'Authentic royal spiced dum biryani with juicy succulent chicken pieces',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Egg Biryani',
    pricePaise: 23000,
    veg: 'nonveg',
    description: 'Signature chicken biryani served with a seasoned boiled egg',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Leg Biryani',
    pricePaise: 23000,
    veg: 'nonveg',
    description: 'Aromatic dum biryani prepared with a hearty tender chicken leg piece',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Leg Egg Biryani',
    pricePaise: 24000,
    veg: 'nonveg',
    description: 'Special chicken leg dum biryani topped with a boiled egg',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Leg Special Biryani',
    pricePaise: 37000,
    veg: 'nonveg',
    description: 'Generous royal portion featuring chicken leg pieces and aromatic long-grain rice',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Biryani Special (2 Chicken + 1 Egg)',
    pricePaise: 35000,
    veg: 'nonveg',
    description: 'Special badshah feast with 2 juicy chicken pieces and 1 boiled egg',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Reshmi Biryani',
    pricePaise: 23000,
    veg: 'nonveg',
    description: 'Fragrant biryani infused with silky melt-in-mouth chicken reshmi kabab flavors',
  },
  {
    categoryKey: 'biryani',
    name: 'Chicken Tikka Biryani',
    pricePaise: 23000,
    veg: 'nonveg',
    description: 'Charcoal-grilled smoky chicken tikka pieces layered over spiced basmati rice',
  },
  {
    categoryKey: 'biryani',
    name: 'Mutton Biryani',
    pricePaise: 25000,
    veg: 'nonveg',
    description: 'Traditional royal mutton biryani cooked on slow flame with rich Mughlai spices',
  },
  {
    categoryKey: 'biryani',
    name: 'Mutton Egg Biryani',
    pricePaise: 26000,
    veg: 'nonveg',
    description: 'Slow-cooked spiced mutton biryani paired with a boiled egg',
  },
  {
    categoryKey: 'biryani',
    name: 'Mutton Biryani Special (2 Mutton + 1 Egg)',
    pricePaise: 39000,
    veg: 'nonveg',
    description: 'Deluxe mutton biryani platter with 2 tender mutton pieces and 1 boiled egg',
  },
  {
    categoryKey: 'biryani',
    name: 'Tandoori Biryani',
    pricePaise: 25000,
    veg: 'nonveg',
    description: 'Smoky tandoori roasted chicken paired with layered fragrant biryani rice',
  },
  {
    categoryKey: 'biryani',
    name: 'Tandoori Biryani Special',
    pricePaise: 38000,
    veg: 'nonveg',
    description: 'Special generous portion of tandoori chicken layered biryani',
  },
  {
    categoryKey: 'biryani',
    name: 'Patyala Biryani',
    pricePaise: 26000,
    veg: 'nonveg',
    description: 'Rich Punjabi-style spiced biryani with bold and aromatic flavors',
  },
  {
    categoryKey: 'biryani',
    name: 'Patyala Biryani Special',
    pricePaise: 40000,
    veg: 'nonveg',
    description: 'Royal special Patyala biryani feast with generous portions of marinated chicken',
  },
  {
    categoryKey: 'biryani',
    name: 'Moradabadi Biryani',
    pricePaise: 8000,
    veg: 'nonveg',
    description: 'Light, mildly spiced fragrant Moradabadi yakhni dum biryani with green chilies',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'quarter', name: 'Quarter', pricePaise: 0 },
          { id: 'half', name: 'Half', pricePaise: 7000 },
          { id: 'full', name: 'Full', pricePaise: 18000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'biryani',
    name: 'Veg. Biryani',
    pricePaise: 18000,
    veg: 'veg',
    description: 'Aromatic basmati rice cooked with fresh farm vegetables, mint, and whole spices',
  },
  {
    categoryKey: 'biryani',
    name: 'Plain Biryani / Zeera Rice',
    pricePaise: 16000,
    veg: 'veg',
    description: 'Flavored biryani kushka rice tempered with royal cumin',
  },
  {
    categoryKey: 'biryani',
    name: 'Egg Biryani',
    pricePaise: 17000,
    veg: 'egg',
    description: 'Fragrant dum biryani cooked with seasoned boiled eggs and rich herbs',
  },

  // 2. Traditional Tandoor
  {
    categoryKey: 'tandoor',
    name: 'Chicken Tangri Kabab',
    pricePaise: 25000,
    veg: 'nonveg',
    description: 'Juicy spiced chicken drumsticks roasted in the clay tandoor oven',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'half', name: 'Half (₹250)', pricePaise: 0 },
          { id: 'full', name: 'Full (₹400)', pricePaise: 15000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Tandoor Kabab',
    pricePaise: 26000,
    veg: 'nonveg',
    description: 'Classic spiced roasted tandoori chicken marinated in curd and traditional red spices',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'half', name: 'Half (₹260)', pricePaise: 0 },
          { id: 'full', name: 'Full (₹430)', pricePaise: 17000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Arabian Chops',
    pricePaise: 28000,
    veg: 'nonveg',
    description: 'Exquisite Middle Eastern spice-rubbed grilled chicken chops',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'half', name: 'Half (₹280)', pricePaise: 0 },
          { id: 'full', name: 'Full (₹480)', pricePaise: 20000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Patiala Leg Kabab',
    pricePaise: 27000,
    veg: 'nonveg',
    description: 'Richly marinated chicken leg kabab charred to perfection',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'half', name: 'Half (₹270)', pricePaise: 0 },
          { id: 'full', name: 'Full (₹470)', pricePaise: 20000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Sheek Kabab (4 Pcs.)',
    pricePaise: 28000,
    veg: 'nonveg',
    description: 'Finely minced spiced chicken skewers grilled over live charcoal coals',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Bihari Kabab (6 Pcs.)',
    pricePaise: 32000,
    veg: 'nonveg',
    description: 'Thin strips of tender chicken marinated with Bihari spices, raw papaya, and mustard oil',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Haryali Kabab (6 Pcs.)',
    pricePaise: 30000,
    veg: 'nonveg',
    description: 'Boneless chicken cubes coated in fresh coriander, mint, and green chili marinade',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Reshmi Kabab (6 Pcs.)',
    pricePaise: 30000,
    veg: 'nonveg',
    description: 'Silky smooth chicken boneless kababs enriched with cashew paste and cream',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Tikka Kabab (6 Pcs.)',
    pricePaise: 29000,
    veg: 'nonveg',
    description: 'Classic tandoor-roasted boneless chicken tikka basted with butter',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Afghani Kabab (6 Pcs.)',
    pricePaise: 32000,
    veg: 'nonveg',
    description: 'Mildly spiced, creamy and velvety Afghani style tandoori chicken',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Kalimirch Kabab (6 Pcs.)',
    pricePaise: 32000,
    veg: 'nonveg',
    description: 'Tender chicken marinated in freshly ground black pepper and yogurt',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Mali Kabab (6 Pcs.)',
    pricePaise: 34000,
    veg: 'nonveg',
    description: 'Melt-in-mouth chicken malai kababs with cream, cardamom, and cheese',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Cheese Kabab (6 Pcs.)',
    pricePaise: 44000,
    veg: 'nonveg',
    description: 'Succulent chicken kabab stuffed and glazed with molten cheese',
  },
  {
    categoryKey: 'tandoor',
    name: 'Chicken Kathi Kabab (10 Pcs.)',
    pricePaise: 20000,
    veg: 'nonveg',
    description: 'Bite-sized spiced chicken tikka pieces served with mint chutney',
  },
  {
    categoryKey: 'tandoor',
    name: 'Paneer Tikka Kabab (6 Pcs.)',
    pricePaise: 28000,
    veg: 'veg',
    description: 'Fresh paneer cubes marinated in spiced hung curd with bell peppers and onions',
  },

  // 3. Chicken Gravy
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Bharta',
    pricePaise: 19000,
    veg: 'nonveg',
    description: 'Shredded chicken in a rich, creamy, and mildly sweet egg-infused gravy',
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Kassa (2/4 Pcs.)',
    pricePaise: 19000,
    veg: 'nonveg',
    description: 'Thick, slow-cooked Bengali style spicy chicken gravy',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹190)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹360)', pricePaise: 17000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Korma (2/4 Pcs.)',
    pricePaise: 20000,
    veg: 'nonveg',
    description: 'Royal Mughlai chicken curry made with rich cashew, nut paste, and whole aromatic spices',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹200)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹380)', pricePaise: 18000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Stew (2/4 Pcs.)',
    pricePaise: 20000,
    veg: 'nonveg',
    description: 'Light and fragrant whole spice chicken stew cooked with sliced onions',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹200)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹370)', pricePaise: 17000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Do Pyaza (2/4 Pcs.)',
    pricePaise: 20000,
    veg: 'nonveg',
    description: 'Tender chicken simmered with caramelized and crunchy onion chunks',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹200)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹370)', pricePaise: 17000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Kadhai (2/4 Pcs.)',
    pricePaise: 23000,
    veg: 'nonveg',
    description: 'Chicken cooked in a traditional iron kadhai with bell peppers and crushed coriander seeds',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹230)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹380)', pricePaise: 15000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Achari (2/4 Pcs.)',
    pricePaise: 23000,
    veg: 'nonveg',
    description: 'Tangy and spicy chicken curry prepared with authentic pickling spices',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹230)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹380)', pricePaise: 15000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Tikka B. Masala (4/6 Pcs.)',
    pricePaise: 29000,
    veg: 'nonveg',
    description: 'Smoky tandoori chicken tikka pieces in a luscious tomato butter masala gravy',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '4pcs', name: '4 Pcs. (₹290)', pricePaise: 0 },
          { id: '6pcs', name: '6 Pcs. (₹380)', pricePaise: 9000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Tandoor B. Masala (Half/Full)',
    pricePaise: 38000,
    veg: 'nonveg',
    description: 'Tandoori roasted chicken cuts tossed in a rich, buttery tomato cream gravy',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'half', name: 'Half (₹380)', pricePaise: 0 },
          { id: 'full', name: 'Full (₹600)', pricePaise: 22000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'chicken_gravy',
    name: 'Chicken Dehati (Half/Full)',
    pricePaise: 37000,
    veg: 'nonveg',
    description: 'Rustic countryside style chicken slow-simmered in mustard oil and garlic pods',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'half', name: 'Half (₹370)', pricePaise: 0 },
          { id: 'full', name: 'Full (₹590)', pricePaise: 22000 },
        ],
      },
    ],
  },

  // 4. Mutton Gravy
  {
    categoryKey: 'mutton_gravy',
    name: 'Mutton Kadhai (2 Pcs. / 4 Pcs.)',
    pricePaise: 26000,
    veg: 'nonveg',
    description: 'Succulent mutton pieces wok-tossed with capsicum, tomatoes, and kadhai masala',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹260)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹450)', pricePaise: 19000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'mutton_gravy',
    name: 'Mutton Do Pyaza (2 Pcs. / 4 Pcs.)',
    pricePaise: 27000,
    veg: 'nonveg',
    description: 'Tender mutton cooked in a two-stage onion gravy with whole garam masala',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹270)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹450)', pricePaise: 18000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'mutton_gravy',
    name: 'Mutton Kassa (2 Pcs. / 4 Pcs.)',
    pricePaise: 24000,
    veg: 'nonveg',
    description: 'Deeply roasted tender mutton in a thick caramelized onion and ginger-garlic sauce',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹240)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹450)', pricePaise: 21000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'mutton_gravy',
    name: 'Mutton Korma (2 Pcs. / 4 Pcs.)',
    pricePaise: 24000,
    veg: 'nonveg',
    description: 'Rich Nawabi mutton korma with velvety gravy infused with saffron and kewra',
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: '2pcs', name: '2 Pcs. (₹240)', pricePaise: 0 },
          { id: '4pcs', name: '4 Pcs. (₹460)', pricePaise: 22000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'mutton_gravy',
    name: 'Mutton Stew (4 Pcs.)',
    pricePaise: 29000,
    veg: 'nonveg',
    description: 'Traditional 4-piece mutton stew flavored with whole red chilies and garlic cloves',
  },
  {
    categoryKey: 'mutton_gravy',
    name: 'Mutton Fry (4 Pcs.)',
    pricePaise: 32000,
    veg: 'nonveg',
    description: 'Pan-fried mutton pieces crisped on high flame with freshly crushed spices',
  },

  // 5. Indian Veg. & Chinese
  {
    categoryKey: 'veg_chinese',
    name: 'Paneer Kadhai',
    pricePaise: 23000,
    veg: 'veg',
    description: 'Cottage cheese cubes tossed in spicy tomato gravy with crisp bell peppers',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Paneer Butter Masala',
    pricePaise: 20000,
    veg: 'veg',
    description: 'Creamy tomato and butter gravy with soft succulent paneer cubes',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Paneer Do Pyaza',
    pricePaise: 22000,
    veg: 'veg',
    description: 'Paneer cooked with double the onions in a rich aromatic semi-dry curry',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Mater Paneer',
    pricePaise: 21000,
    veg: 'veg',
    description: 'Classic homestyle combination of tender green peas and fresh paneer in spiced gravy',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Paneer Chilly',
    pricePaise: 24000,
    veg: 'veg',
    description: 'Crispy fried paneer cubes tossed in spicy soy-chili sauce with capsicum and spring onions',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Veg. Manchurian (8 Pcs.)',
    pricePaise: 20000,
    veg: 'veg',
    description: '8 golden vegetable dumplings simmered in savory Indo-Chinese garlic sauce',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Mix Veg.',
    pricePaise: 18000,
    veg: 'veg',
    description: 'Seasonal fresh garden vegetables cooked in mild North Indian spices',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Dal Tarka',
    pricePaise: 15000,
    veg: 'veg',
    description: 'Yellow lentils tempered with ghee, cumin seeds, garlic, and dried red chilies',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Mushroom Do Pyaza',
    pricePaise: 25000,
    veg: 'veg',
    description: 'Fresh button mushrooms sautéed with diced onions and rich Indian spices',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Mushroom Masala',
    pricePaise: 25000,
    veg: 'veg',
    description: 'Button mushrooms simmered in a hearty spiced onion-tomato masala',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Mushroom Chilly',
    pricePaise: 26000,
    veg: 'veg',
    description: 'Crispy mushrooms tossed in Indo-Chinese chili garlic sauce with bell peppers',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Soyabean Chilly',
    pricePaise: 20000,
    veg: 'veg',
    description: 'High-protein soy chunks tossed with onions, green chilies, and tangy sauces',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Veg. Soup',
    pricePaise: 18000,
    veg: 'veg',
    description: 'Hot and soothing vegetable clear soup with finely chopped veggies',
  },
  {
    categoryKey: 'veg_chinese',
    name: 'Baby Corn Chilly',
    pricePaise: 25000,
    veg: 'veg',
    description: 'Crispy baby corn stir-fried in a fiery chili and garlic glaze',
  },

  // 6. Chinese
  {
    categoryKey: 'chinese',
    name: 'Drums of Heaven (4 Pcs.)',
    pricePaise: 28000,
    veg: 'nonveg',
    description: '4 crispy chicken lollipops tossed in a sweet, spicy Schezwan sauce',
  },
  {
    categoryKey: 'chinese',
    name: 'Chicken 65 (8 Pcs.)',
    pricePaise: 28000,
    veg: 'nonveg',
    description: '8 fiery deep-fried chicken bites tempered with curry leaves and green chilies',
  },
  {
    categoryKey: 'chinese',
    name: 'Chicken Lolly Pop (4 Pcs.)',
    pricePaise: 27000,
    veg: 'nonveg',
    description: '4 crisp chicken winglets served with spicy chili garlic dip',
  },
  {
    categoryKey: 'chinese',
    name: 'Chicken Chilly Boneless (8 Pcs.)',
    pricePaise: 28000,
    veg: 'nonveg',
    description: '8 crispy boneless chicken chunks tossed in spicy Indo-Chinese chili sauce',
  },
  {
    categoryKey: 'chinese',
    name: 'Honey Chicken',
    pricePaise: 28000,
    veg: 'nonveg',
    description: 'Crispy chicken strips glazed with sweet honey, chili, and toasted sesame',
  },
  {
    categoryKey: 'chinese',
    name: 'Chicken Soup',
    pricePaise: 14000,
    veg: 'nonveg',
    description: 'Warm comforting chicken broth with shredded chicken and egg drops',
  },
  {
    categoryKey: 'chinese',
    name: 'Chicken Chilli Bone (8 Pcs.)',
    pricePaise: 28000,
    veg: 'nonveg',
    description: '8 bone-in chicken pieces stir-fried with capsicum, garlic, and hot green chilies',
  },

  // 7. Roll Item
  {
    categoryKey: 'roll',
    name: 'Badshah Special Roll (with Mayonnaise)',
    pricePaise: 13000,
    veg: 'nonveg',
    featured: true,
    description: 'House special flaky paratha wrapped with juicy chicken, rich mayo, and sauces',
  },
  {
    categoryKey: 'roll',
    name: 'Paneer Special Roll',
    pricePaise: 12000,
    veg: 'veg',
    description: 'Golden paratha rolled with seasoned paneer cubes, crunchy onions, and mint chutney',
  },
  {
    categoryKey: 'roll',
    name: 'Egg Roll',
    pricePaise: 6000,
    veg: 'egg',
    description: 'Crispy laccha paratha layered with a fluffy egg omelette and tangy onion filling',
  },
  {
    categoryKey: 'roll',
    name: 'Egg Double Roll',
    pricePaise: 7000,
    veg: 'egg',
    description: 'Double egg omelette rolled into flaky paratha with sliced salad and sauces',
  },
  {
    categoryKey: 'roll',
    name: 'Chicken Roll',
    pricePaise: 8000,
    veg: 'nonveg',
    description: 'Spiced shredded chicken wrapped in a fresh handmade paratha',
  },
  {
    categoryKey: 'roll',
    name: 'Chicken Egg Roll',
    pricePaise: 9000,
    veg: 'nonveg',
    description: 'Juicy chicken tikka wrapped inside an egg-coated flaky paratha',
  },
  {
    categoryKey: 'roll',
    name: 'Chicken Double Egg Roll',
    pricePaise: 10000,
    veg: 'nonveg',
    description: 'Double egg layered paratha stuffed with generously spiced chicken filling',
  },
  {
    categoryKey: 'roll',
    name: 'Chicken Cheese Roll',
    pricePaise: 10000,
    veg: 'nonveg',
    description: 'Spiced chicken combined with melted cheddar and mozzarella cheese',
  },
  {
    categoryKey: 'roll',
    name: 'Chicken Cheese Egg Roll',
    pricePaise: 10500,
    veg: 'nonveg',
    description: 'Tender chicken, egg omelette, and creamy melted cheese in a crispy paratha',
  },
  {
    categoryKey: 'roll',
    name: 'Chicken Egg Double Cheese Roll',
    pricePaise: 11500,
    veg: 'nonveg',
    description: 'Ultimate badshah roll with chicken, egg, and extra double cheese',
  },
  {
    categoryKey: 'roll',
    name: 'Paneer Roll',
    pricePaise: 8000,
    veg: 'veg',
    description: 'Soft paneer cubes tossed in spices and wrapped with onions in paratha',
  },
  {
    categoryKey: 'roll',
    name: 'Mushroom Roll',
    pricePaise: 9000,
    veg: 'veg',
    description: 'Spiced mushroom filling rolled in hot crisp flaky flatbread',
  },

  // 8. Roti
  {
    categoryKey: 'roti',
    name: 'Tandoori Roti',
    pricePaise: 2000,
    veg: 'veg',
    description: 'Clay tandoor baked crisp whole wheat flatbread',
  },
  {
    categoryKey: 'roti',
    name: 'Tandoori Butter Roti',
    pricePaise: 2500,
    veg: 'veg',
    description: 'Hot clay oven baked tandoori roti generously brushed with creamy butter',
  },
  {
    categoryKey: 'roti',
    name: 'Tandoori Lachha Paratha',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Multi-layered flaky wheat paratha baked in the tandoor',
  },
  {
    categoryKey: 'roti',
    name: 'Lachha Paratha',
    pricePaise: 4500,
    veg: 'veg',
    description: 'Golden crispy multi-layered layered paratha',
  },
  {
    categoryKey: 'roti',
    name: 'Butter Naan',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Soft leavened refined flour flatbread brushed with butter',
  },
  {
    categoryKey: 'roti',
    name: 'Plain Naan',
    pricePaise: 4000,
    veg: 'veg',
    description: 'Traditional leavened flatbread freshly baked in tandoor',
  },
  {
    categoryKey: 'roti',
    name: 'Stuffed Paratha',
    pricePaise: 6000,
    veg: 'veg',
    description: 'Crispy tandoori paratha stuffed with seasoned potato and herbs',
  },
  {
    categoryKey: 'roti',
    name: 'Garlic Naan',
    pricePaise: 6000,
    veg: 'veg',
    description: 'Tandoori naan topped with roasted garlic bits and fresh coriander',
  },
  {
    categoryKey: 'roti',
    name: 'Baby Naan (Min. 10 Order)',
    pricePaise: 22000,
    veg: 'veg',
    description: 'Basket of 10 bite-sized soft mini naans baked in clay oven',
  },

  // 9. Extra / Add Ons Option
  {
    categoryKey: 'addons',
    name: 'Egg Curry (2 Pcs.)',
    pricePaise: 15000,
    veg: 'egg',
    description: '2 boiled eggs simmered in rich homestyle onion-tomato gravy',
  },
  {
    categoryKey: 'addons',
    name: 'Egg Do Pyaza (2 Pcs.)',
    pricePaise: 15000,
    veg: 'egg',
    description: '2 eggs cooked with diced caramelized onions in spicy sauce',
  },
  {
    categoryKey: 'addons',
    name: 'Extra Egg, Boiled',
    pricePaise: 2000,
    veg: 'egg',
    description: '1 hard-boiled seasoned egg add-on',
  },
  {
    categoryKey: 'addons',
    name: 'Extra Chicken',
    pricePaise: 9000,
    veg: 'nonveg',
    description: 'Additional portion of succulent chicken',
  },
  {
    categoryKey: 'addons',
    name: 'Extra Mutton',
    pricePaise: 10000,
    veg: 'nonveg',
    description: 'Additional portion of tender mutton',
  },
  {
    categoryKey: 'addons',
    name: 'Extra Aloo',
    pricePaise: 1000,
    veg: 'veg',
    description: 'Spiced boiled potato add-on for biryani',
  },
  {
    categoryKey: 'addons',
    name: 'Extra Mint Chutney',
    pricePaise: 2000,
    veg: 'veg',
    description: 'Cup of fresh mint and yogurt green chutney',
  },

  // 10. Raita/Salad
  {
    categoryKey: 'raita_salad',
    name: 'Mix Raita (Sweet Taste)',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Sweet and creamy beaten yogurt mixed with cucumber and mild seasonings',
  },
  {
    categoryKey: 'raita_salad',
    name: 'Green Salad',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Fresh slices of cucumber, tomato, carrot, and green chili with lemon',
  },
  {
    categoryKey: 'raita_salad',
    name: 'Onion Salad',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Fresh crunchy sliced onion rings tossed with lemon juice and chaat masala',
  },

  // 11. Drinks/Beverages
  {
    categoryKey: 'beverages',
    name: 'Soft Drink (250 ml.)',
    pricePaise: 2500,
    veg: 'veg',
    description: 'Chilled refreshing soft drink bottle (250 ml)',
  },
  {
    categoryKey: 'beverages',
    name: 'Soft Drink (750 ml.)',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Chilled family bottle soft drink (750 ml)',
  },
  {
    categoryKey: 'beverages',
    name: 'Mineral Water',
    pricePaise: 2000,
    veg: 'veg',
    description: 'Packaged premium drinking water bottle (1L)',
  },
  {
    categoryKey: 'beverages',
    name: 'Masala Cold Drink',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Cold soda spiced with black salt, cumin, and lemon punch',
  },

  // 12. Dessert
  {
    categoryKey: 'dessert',
    name: 'Kesar Firni',
    pricePaise: 4000,
    veg: 'veg',
    description: 'Traditional slow-cooked saffron rice pudding served chilled in an earthen pot',
  },
  {
    categoryKey: 'dessert',
    name: 'Ice-Cream (Depend on Quantity)',
    pricePaise: 5000,
    veg: 'veg',
    description: 'Scoop of rich creamy vanilla / butterscotch ice cream',
  },

  // 13. Badshah Specials
  {
    categoryKey: 'specials',
    name: 'Badshah Special Creamy Kabab',
    pricePaise: 29000,
    veg: 'nonveg',
    featured: true,
    description: "Chef's royal creation - melt-in-the-mouth chicken kabab glazed in a signature creamy sauce",
    options: [
      {
        id: 'portion',
        name: 'Portion Size',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        choices: [
          { id: 'half', name: 'Half (₹290)', pricePaise: 0 },
          { id: 'full', name: 'Full (₹430)', pricePaise: 14000 },
        ],
      },
    ],
  },
  {
    categoryKey: 'specials',
    name: 'Badshah Special Spicy Gracy (4 Pcs.) (Sat. & Sun.)',
    pricePaise: 45000,
    veg: 'nonveg',
    featured: true,
    description: 'Weekend exclusive spicy slow-braised royal gravy with 4 pieces of succulent meat',
  },
]

async function seed() {
  console.log('Seeding Biryani Badshah catalog...')

  // 1. Seed categories
  const catKeyToId = new Map()

  for (const cat of CATEGORIES) {
    const existingSnap = await db
      .collection('orderMenuCategories')
      .where('name', '==', cat.name)
      .limit(1)
      .get()

    let catId
    if (!existingSnap.empty) {
      catId = existingSnap.docs[0].id
      await db.doc(`orderMenuCategories/${catId}`).update({
        position: cat.position,
        active: true,
        updatedAt: now,
      })
    } else {
      const ref = db.collection('orderMenuCategories').doc()
      catId = ref.id
      await ref.set({
        restaurantId: RESTAURANT_ID,
        name: cat.name,
        position: cat.position,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
    }
    catKeyToId.set(cat.key, catId)
    console.log(`  ✓ Category: ${cat.name} (${catId})`)
  }

  // 2. Seed items
  let itemIndex = 1
  for (const item of MENU_ITEMS) {
    const categoryId = catKeyToId.get(item.categoryKey) || null

    const existingSnap = await db
      .collection('orderMenuItems')
      .where('name', '==', item.name)
      .limit(1)
      .get()

    const itemData = {
      restaurantId: RESTAURANT_ID,
      categoryId,
      name: item.name,
      description: item.description,
      imageUrl: null, // As requested: don't add image but have option to upload
      pricePaise: item.pricePaise,
      available: true,
      visible: true,
      veg: item.veg,
      featured: Boolean(item.featured),
      position: itemIndex,
      options: item.options || [],
      updatedAt: now,
    }

    if (!existingSnap.empty) {
      const id = existingSnap.docs[0].id
      await db.doc(`orderMenuItems/${id}`).update(itemData)
    } else {
      const ref = db.collection('orderMenuItems').doc()
      await ref.set({
        ...itemData,
        createdAt: now,
      })
    }

    // Also populate survey menuItems if not exists
    const surveySnap = await db
      .collection('menuItems')
      .where('name.en', '==', item.name)
      .limit(1)
      .get()

    if (surveySnap.empty) {
      const sRef = db.collection('menuItems').doc()
      await sRef.set({
        name: { en: item.name },
        active: true,
        position: itemIndex,
        createdAt: now,
      })
    }

    itemIndex++
  }

  console.log(`\n✓ Successfully seeded ${CATEGORIES.length} categories and ${MENU_ITEMS.length} dishes!`)
  console.log('All dishes have imageUrl: null (clean placeholder) with full image upload capability in the dashboard.')
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err)
    process.exit(1)
  })
