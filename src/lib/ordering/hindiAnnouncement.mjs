/**
 * Hindi Announcement and Number Generation for Restaurant Orders.
 *
 * Dependency-free, deterministic module compatible with:
 * - Next.js (TypeScript / App Router)
 * - Node.js native test runner (node --test)
 */

export const HINDI_NUMBERS = {
  0: 'शून्य',
  1: 'एक',
  2: 'दो',
  3: 'तीन',
  4: 'चार',
  5: 'पाँच',
  6: 'छह',
  7: 'सात',
  8: 'आठ',
  9: 'नौ',
  10: 'दस',
  11: 'ग्यारह',
  12: 'बारह',
  13: 'तेरह',
  14: 'चौदह',
  15: 'पंद्रह',
  16: 'सोलह',
  17: 'सत्रह',
  18: 'अठारह',
  19: 'उन्नीस',
  20: 'बीस',
  21: 'इक्कीस',
  22: 'बाईस',
  23: 'तेईस',
  24: 'चौबीस',
  25: 'पच्चीस',
  26: 'छब्बीस',
  27: 'सत्ताईस',
  28: 'अट्ठाईस',
  29: 'उनतीस',
  30: 'तीस',
  31: 'इकत्तीस',
  32: 'बत्तीस',
  33: 'तैंतीस',
  34: 'चौंतीस',
  35: 'पैंतीस',
  36: 'छत्तीस',
  37: 'सैंतीस',
  38: 'अड़तीस',
  39: 'उनतालीस',
  40: 'चालीस',
  41: 'इकतालीस',
  42: 'बयालीस',
  43: 'तैंतालीस',
  44: 'चवालीस',
  45: 'पैंतालीस',
  46: 'छियालीस',
  47: 'सैंतालीस',
  48: 'अड़तालीस',
  49: 'उनचास',
  50: 'पचास',
  51: 'इक्यावन',
  52: 'बावन',
  53: 'तिरपन',
  54: 'चौवन',
  55: 'पचपन',
  56: 'छप्पन',
  57: 'सत्तावन',
  58: 'अट्ठावन',
  59: 'उनसठ',
  60: 'साठ',
  61: 'इकसठ',
  62: 'बासठ',
  63: 'तिरसठ',
  64: 'चौंसठ',
  65: 'पैंसठ',
  66: 'छियासठ',
  67: 'सरसठ',
  68: 'अड़सठ',
  69: 'उनहत्तर',
  70: 'सत्तर',
  71: 'इकहत्तर',
  72: 'बहत्तर',
  73: 'तिहत्तर',
  74: 'चौहत्तर',
  75: 'पचहत्तर',
  76: 'छिहत्तर',
  77: 'सतहत्तर',
  78: 'अठहत्तर',
  79: 'उनासी',
  80: 'अस्सी',
  81: 'इक्यासी',
  82: 'बयासी',
  83: 'तिरासी',
  84: 'चौरासी',
  85: 'पचासी',
  86: 'छियासी',
  87: 'सत्तासी',
  88: 'अट्ठासी',
  89: 'नवासी',
  90: 'नब्बे',
  91: 'इक्यानवे',
  92: 'बानवे',
  93: 'तिरानवे',
  94: 'चौरानवे',
  95: 'पंचानवे',
  96: 'छियानवे',
  97: 'सत्तानवे',
  98: 'अट्ठानवे',
  99: 'निन्यानवे',
  100: 'सौ',
}

/**
 * Convert any integer into natural Hindi words.
 * Supports 0 to 999.
 * @param {number|string} n - Integer number to convert
 * @returns {string} Hindi representation in words
 */
export function numberToHindiWords(n) {
  const num = parseInt(String(n), 10)
  if (isNaN(num)) return ''

  if (num < 0) {
    return `ऋण ${numberToHindiWords(Math.abs(num))}`
  }

  if (HINDI_NUMBERS[num] !== undefined) {
    return HINDI_NUMBERS[num]
  }

  if (num > 100 && num < 1000) {
    const hundredDigit = Math.floor(num / 100)
    const remainder = num % 100
    const hundredWord = hundredDigit === 1 ? 'एक सौ' : `${HINDI_NUMBERS[hundredDigit] || hundredDigit} सौ`

    if (remainder === 0) {
      return hundredWord
    }
    return `${hundredWord} ${numberToHindiWords(remainder)}`
  }

  // Fallback for 1000+ or unsupported large numbers: convert digit by digit
  return String(num)
    .split('')
    .map((d) => HINDI_NUMBERS[parseInt(d, 10)] || d)
    .join(' ')
}

/**
 * Known non-numeric dining/ordering location labels mapped to clean Hindi phrases.
 */
const SPECIAL_LOCATION_MAP = [
  { match: /^(?:counter|काउंटर)$/i, phrase: 'काउंटर से ऑर्डर प्राप्त हुआ है।' },
  { match: /^(?:takeaway|take-away|take\s*away|parcel|पार्सल|टेकअवे)$/i, phrase: 'टेकअवे से ऑर्डर प्राप्त हुआ है।' },
  { match: /^(?:delivery|डिलीवरी)$/i, phrase: 'डिलीवरी के लिए ऑर्डर प्राप्त हुआ है।' },
  { match: /^(?:bar|बार)$/i, phrase: 'बार काउंटर से ऑर्डर प्राप्त हुआ है।' },
  { match: /^(?:rooftop|रूफटॉप)$/i, phrase: 'रूफटॉप टेबल से ऑर्डर प्राप्त हुआ है।' },
  { match: /^(?:garden|गार्डन)$/i, phrase: 'गार्डन टेबल से ऑर्डर प्राप्त हुआ है।' },
]

/**
 * Format order items into natural Hindi speech.
 * e.g. [{ itemName: 'Butter Naan', quantity: 2 }, { itemName: 'Paneer Tikka', quantity: 1 }]
 * -> "ऑर्डर में है: दो Butter Naan, और एक Paneer Tikka।"
 *
 * @param {Array<Object|string>} items - List of items or item snapshots
 * @param {number} maxToSpeak - Maximum items to enumerate before summarizing
 * @returns {string} Natural Hindi phrase describing the items
 */
export function formatHindiOrderItems(items, maxToSpeak = 4) {
  if (!Array.isArray(items) || items.length === 0) return ''

  const validItems = items
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim()
        return name ? { name, qty: 1 } : null
      }
      if (item && typeof item === 'object') {
        const name = String(item.itemName || item.name || '').trim()
        const qty = parseInt(String(item.quantity || item.qty || 1), 10) || 1
        return name ? { name, qty } : null
      }
      return null
    })
    .filter((i) => Boolean(i))

  if (validItems.length === 0) return ''

  const spoken = validItems.slice(0, maxToSpeak)
  const remainingCount = validItems.length - spoken.length

  const formattedParts = spoken.map((it) => {
    const hindiQty = numberToHindiWords(it.qty) || String(it.qty)
    return `${hindiQty} ${it.name}`
  })

  let listText = ''
  if (remainingCount > 0) {
    const remainingHindi = numberToHindiWords(remainingCount) || String(remainingCount)
    listText = `${formattedParts.join(', ')}, और ${remainingHindi} अन्य आइटम`
  } else if (formattedParts.length === 1) {
    listText = formattedParts[0]
  } else if (formattedParts.length === 2) {
    listText = `${formattedParts[0]}, और ${formattedParts[1]}`
  } else {
    const last = formattedParts[formattedParts.length - 1]
    const rest = formattedParts.slice(0, -1).join(', ')
    listText = `${rest}, और ${last}`
  }

  return `ऑर्डर में है: ${listText}।`
}

/**
 * Generate the table portion of the Hindi announcement.
 * @param {string|number|null|undefined} tableLabel
 * @returns {string}
 */
export function getBaseTableAnnouncement(tableLabel) {
  const prefix = 'नया ऑर्डर आया है।'

  if (!tableLabel || typeof tableLabel !== 'string' && typeof tableLabel !== 'number') {
    return `${prefix} नया ऑर्डर प्राप्त हुआ है।`
  }

  const raw = String(tableLabel).trim()
  if (!raw) {
    return `${prefix} नया ऑर्डर प्राप्त हुआ है।`
  }

  // 1. Check special non-numeric locations (Counter, Takeaway, Parcel, etc.)
  for (const item of SPECIAL_LOCATION_MAP) {
    if (item.match.test(raw)) {
      return `${prefix} ${item.phrase}`
    }
  }

  // 2. Check VIP prefix variants (e.g. "VIP", "VIP 1", "VIP-2", "Table VIP")
  const vipWithNumMatch = raw.match(/^(?:table\s*)?vip[-#\s]*(\d+)$/i)
  if (vipWithNumMatch) {
    const num = parseInt(vipWithNumMatch[1], 10)
    const hindiNum = numberToHindiWords(num)
    return `${prefix} वीआईपी टेबल नंबर ${hindiNum} से ऑर्डर प्राप्त हुआ है।`
  }

  if (/^(?:table\s*)?vip$/i.test(raw)) {
    return `${prefix} वीआईपी टेबल से ऑर्डर प्राप्त हुआ है।`
  }

  // 3. Check standard table patterns:
  // e.g. "5", "12", "Table 5", "table 12", "T-5", "T12", "Table-25", "table 05"
  const standardNumMatch = raw.match(/^(?:table\s*|t[-#]?\s*)0*(\d+)$/i) || raw.match(/^0*(\d+)$/)
  if (standardNumMatch) {
    const num = parseInt(standardNumMatch[1], 10)
    const hindiNum = numberToHindiWords(num)
    return `${prefix} टेबल नंबर ${hindiNum} से ऑर्डर प्राप्त हुआ है।`
  }

  // 4. Any label ending in a number (e.g. "Balcony 3", "Cabin 4")
  const trailingNumMatch = raw.match(/^(.+?)[-#\s]+0*(\d+)$/i)
  if (trailingNumMatch) {
    const sectionName = trailingNumMatch[1].trim()
    const num = parseInt(trailingNumMatch[2], 10)
    const hindiNum = numberToHindiWords(num)
    return `${prefix} ${sectionName} टेबल नंबर ${hindiNum} से ऑर्डर प्राप्त हुआ है।`
  }

  // 5. General named table fallback (e.g. "Rooftop Table", "Terrace")
  return `${prefix} ${raw} टेबल से ऑर्डर प्राप्त हुआ है।`
}

/**
 * Generate standard, natural Hindi announcement text for incoming restaurant orders,
 * including table location and specific order items ("ye ye order hai").
 *
 * Examples:
 * - Table 5, no items: "नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।"
 * - Table 5, with items: "नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है। ऑर्डर में है: दो बटर नान, और एक पनीर टिक्का।"
 * - Counter with items: "नया ऑर्डर आया है। काउंटर से ऑर्डर प्राप्त हुआ है। ऑर्डर में है: एक कोल्ड कॉफ़ी।"
 *
 * @param {string|number|Object|null|undefined} tableLabelOrOrder - Raw table label or order object
 * @param {Array<Object|string>} [itemsList] - Optional items if tableLabel was passed as string/number
 * @returns {string} Hindi announcement speech string
 */
export function getHindiTableAnnouncement(tableLabelOrOrder, itemsList) {
  let tableLabel = tableLabelOrOrder
  let items = itemsList

  if (tableLabelOrOrder && typeof tableLabelOrOrder === 'object') {
    tableLabel = tableLabelOrOrder.tableLabel
    items = itemsList || tableLabelOrOrder.items
  }

  const baseAnnouncement = getBaseTableAnnouncement(tableLabel)
  const itemsAnnouncement = formatHindiOrderItems(items)

  if (!itemsAnnouncement) {
    return baseAnnouncement
  }

  return `${baseAnnouncement} ${itemsAnnouncement}`
}

/**
 * Convenience alias for getHindiTableAnnouncement
 */
export const getHindiOrderAnnouncement = getHindiTableAnnouncement

