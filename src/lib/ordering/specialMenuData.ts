// ============================================================================
// Authoritative Special Menu Catalog (Mehman Nawazi & Shan-E-Biryani)
// Matches physical restaurant card and Firestore seed IDs
// ============================================================================

export interface SpecialItemDef {
  id: string
  name: string
  pricePaise: number
  priceFormatted: string
  quantity: string
  veg: boolean
  description: string
}

export interface HandiOptionDef {
  id: string
  serves: string
  pricePaise: number
  priceFormatted: string
  perPerson: string
}

export interface HandiGroupDef {
  category: string
  veg: boolean
  description: string
  items: HandiOptionDef[]
}

export const PARTY_PACK_ITEMS: SpecialItemDef[] = [
  {
    id: 'special-motter-pulao',
    name: 'Motter Pulao',
    pricePaise: 50000,
    priceFormatted: '₹500',
    quantity: '1 Kg',
    veg: true,
    description: 'Aromatic long-grain basmati rice with tender green peas',
  },
  {
    id: 'special-meetha-zarda',
    name: 'Meetha Zarda',
    pricePaise: 80000,
    priceFormatted: '₹800',
    quantity: '1 Kg',
    veg: true,
    description: 'Traditional royal sweet saffron rice with assorted dry fruits',
  },
  {
    id: 'special-chicken-korma',
    name: 'Chicken Korma',
    pricePaise: 60000,
    priceFormatted: '₹600',
    quantity: '1 Kg',
    veg: false,
    description: 'Rich Mughlai chicken gravy slow-cooked with aromatic spices',
  },
  {
    id: 'special-mutton-korma',
    name: 'Mutton Korma',
    pricePaise: 120000,
    priceFormatted: '₹1,200',
    quantity: '1 Kg',
    veg: false,
    description: 'Tender royal mutton pieces simmered in rich velvety gravy',
  },
  {
    id: 'special-chicken-stick-kabab',
    name: 'Chicken Stick Kabab (Boneless)',
    pricePaise: 120000,
    priceFormatted: '₹1,200',
    quantity: '1 Kg',
    veg: false,
    description: 'Juicy skewered boneless chicken kababs grilled to perfection',
  },
  {
    id: 'special-murg-mussallam',
    name: 'Murg Mussallam',
    pricePaise: 65000,
    priceFormatted: '₹650',
    quantity: 'Per Pcs',
    veg: false,
    description: 'Whole chicken stuffed and slow-cooked in rich royal gravy',
  },
  {
    id: 'special-mutton-raan-e-arabian',
    name: 'Mutton Rane-E-Arabian',
    pricePaise: 250000,
    priceFormatted: '₹2,500',
    quantity: 'Per Pcs',
    veg: false,
    description: 'Grand slow-roasted Arabian whole leg of tender mutton',
  },
  {
    id: 'special-baby-naan',
    name: 'Baby Naan',
    pricePaise: 45000,
    priceFormatted: '₹450',
    quantity: '1 Kg',
    veg: true,
    description: 'Freshly baked soft baby naans from our traditional tandoor',
  },
]

export const SHAN_E_BIRYANI_GROUPS: HandiGroupDef[] = [
  {
    category: 'Chicken Biryani Handi',
    veg: false,
    description: 'Authentic royal spiced dum chicken biryani in grand copper handi',
    items: [
      {
        id: 'special-chicken-biryani-handi-45',
        serves: '40-45 Person',
        pricePaise: 750000,
        priceFormatted: '₹7,500',
        perPerson: '~₹165 / person',
      },
      {
        id: 'special-chicken-biryani-handi-80',
        serves: '75-80 Person',
        pricePaise: 1400000,
        priceFormatted: '₹14,000',
        perPerson: '~₹175 / person',
      },
    ],
  },
  {
    category: 'Mutton Biryani Handi',
    veg: false,
    description: 'Signature royal mutton dum biryani cooked in giant traditional handi',
    items: [
      {
        id: 'special-mutton-biryani-handi-45',
        serves: '40-45 Person',
        pricePaise: 1250000,
        priceFormatted: '₹12,500',
        perPerson: '~₹275 / person',
      },
      {
        id: 'special-mutton-biryani-handi-80',
        serves: '75-80 Person',
        pricePaise: 2150000,
        priceFormatted: '₹21,500',
        perPerson: '~₹268 / person',
      },
    ],
  },
]

// Authoritative Map of all special items by id
export const ALL_SPECIAL_ITEMS_MAP: Map<string, SpecialItemDef> = new Map()

PARTY_PACK_ITEMS.forEach((item) => {
  ALL_SPECIAL_ITEMS_MAP.set(item.id, item)
})

SHAN_E_BIRYANI_GROUPS.forEach((group) => {
  group.items.forEach((opt) => {
    ALL_SPECIAL_ITEMS_MAP.set(opt.id, {
      id: opt.id,
      name: `${group.category} (${opt.serves})`,
      pricePaise: opt.pricePaise,
      priceFormatted: opt.priceFormatted,
      quantity: opt.serves,
      veg: group.veg,
      description: `${group.category} serving ${opt.serves} (${opt.perPerson})`,
    })
  })
})

export function isSpecialMenuItem(itemId: string): boolean {
  return ALL_SPECIAL_ITEMS_MAP.has(itemId) || itemId.startsWith('special-')
}
