import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  numberToHindiWords,
  getHindiTableAnnouncement,
  formatHindiOrderItems,
} from '../src/lib/ordering/hindiAnnouncement.mjs'

describe('Hindi Number Conversion', () => {
  it('converts single-digit numbers correctly', () => {
    assert.equal(numberToHindiWords(1), 'एक')
    assert.equal(numberToHindiWords(2), 'दो')
    assert.equal(numberToHindiWords(3), 'तीन')
    assert.equal(numberToHindiWords(4), 'चार')
    assert.equal(numberToHindiWords(5), 'पाँच')
    assert.equal(numberToHindiWords(6), 'छह')
    assert.equal(numberToHindiWords(7), 'सात')
    assert.equal(numberToHindiWords(8), 'आठ')
    assert.equal(numberToHindiWords(9), 'नौ')
    assert.equal(numberToHindiWords(10), 'दस')
  })

  it('converts teens and twenties correctly', () => {
    assert.equal(numberToHindiWords(11), 'ग्यारह')
    assert.equal(numberToHindiWords(12), 'बारह')
    assert.equal(numberToHindiWords(15), 'पंद्रह')
    assert.equal(numberToHindiWords(20), 'बीस')
    assert.equal(numberToHindiWords(21), 'इक्कीस')
    assert.equal(numberToHindiWords(25), 'पच्चीस')
  })

  it('covers key benchmarks up to 100', () => {
    assert.equal(numberToHindiWords(30), 'तीस')
    assert.equal(numberToHindiWords(42), 'बयालीस')
    assert.equal(numberToHindiWords(50), 'पचास')
    assert.equal(numberToHindiWords(75), 'पचहत्तर')
    assert.equal(numberToHindiWords(99), 'निन्यानवे')
    assert.equal(numberToHindiWords(100), 'सौ')
  })

  it('handles numbers beyond 100 (101-999)', () => {
    assert.equal(numberToHindiWords(105), 'एक सौ पाँच')
    assert.equal(numberToHindiWords(200), 'दो सौ')
    assert.equal(numberToHindiWords(212), 'दो सौ बारह')
  })

  it('handles 0 and negative numbers gracefully', () => {
    assert.equal(numberToHindiWords(0), 'शून्य')
    assert.equal(numberToHindiWords(-5), 'ऋण पाँच')
  })
})

describe('Hindi Table Order Announcement Text Generation', () => {
  it('matches prompt required examples exactly', () => {
    // Table 1: “नया ऑर्डर आया है। टेबल नंबर एक से ऑर्डर प्राप्त हुआ है।”
    assert.equal(
      getHindiTableAnnouncement('1'),
      'नया ऑर्डर आया है। टेबल नंबर एक से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Table 1'),
      'नया ऑर्डर आया है। टेबल नंबर एक से ऑर्डर प्राप्त हुआ है।'
    )

    // Table 5: “नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।”
    assert.equal(
      getHindiTableAnnouncement('5'),
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Table 5'),
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।'
    )

    // Table 12: “नया ऑर्डर आया है। टेबल नंबर बारह से ऑर्डर प्राप्त हुआ है।”
    assert.equal(
      getHindiTableAnnouncement('12'),
      'नया ऑर्डर आया है। टेबल नंबर बारह से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Table 12'),
      'नया ऑर्डर आया है। टेबल नंबर बारह से ऑर्डर प्राप्त हुआ है।'
    )

    // Table 25: “नया ऑर्डर आया है। टेबल नंबर पच्चीस से ऑर्डर प्राप्त हुआ है।”
    assert.equal(
      getHindiTableAnnouncement('25'),
      'नया ऑर्डर आया है। टेबल नंबर पच्चीस से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Table 25'),
      'नया ऑर्डर आया है। टेबल नंबर पच्चीस से ऑर्डर प्राप्त हुआ है।'
    )
  })

  it('handles variations in table prefixes (T-5, table 05, etc.)', () => {
    assert.equal(
      getHindiTableAnnouncement('T-5'),
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('T12'),
      'नया ऑर्डर आया है। टेबल नंबर बारह से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('table 05'),
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement(7),
      'नया ऑर्डर आया है। टेबल नंबर सात से ऑर्डर प्राप्त हुआ है।'
    )
  })

  it('handles nonnumeric table labels gracefully (VIP, Counter, Takeaway)', () => {
    assert.equal(
      getHindiTableAnnouncement('VIP'),
      'नया ऑर्डर आया है। वीआईपी टेबल से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('VIP 2'),
      'नया ऑर्डर आया है। वीआईपी टेबल नंबर दो से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Counter'),
      'नया ऑर्डर आया है। काउंटर से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Takeaway'),
      'नया ऑर्डर आया है। टेकअवे से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Parcel'),
      'नया ऑर्डर आया है। टेकअवे से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('Rooftop'),
      'नया ऑर्डर आया है। रूफटॉप टेबल से ऑर्डर प्राप्त हुआ है।'
    )
  })

  it('never fabricates a table number when table is undefined or empty', () => {
    assert.equal(
      getHindiTableAnnouncement(null),
      'नया ऑर्डर आया है। नया ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement(undefined),
      'नया ऑर्डर आया है। नया ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement(''),
      'नया ऑर्डर आया है। नया ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('   '),
      'नया ऑर्डर आया है। नया ऑर्डर प्राप्त हुआ है।'
    )
  })
})

describe('Specific Order Items Hindi Announcement ("ye ye order hai")', () => {
  it('formats single item correctly', () => {
    const text = formatHindiOrderItems([{ itemName: 'पनीर टिक्का', quantity: 1 }])
    assert.equal(text, 'ऑर्डर में है: एक पनीर टिक्का।')
  })

  it('formats two items with natural Hindi conjunction', () => {
    const text = formatHindiOrderItems([
      { itemName: 'Butter Naan', quantity: 2 },
      { itemName: 'Paneer Tikka', quantity: 1 },
    ])
    assert.equal(text, 'ऑर्डर में है: दो Butter Naan, और एक Paneer Tikka।')
  })

  it('formats three or more items with commas and last conjunction', () => {
    const text = formatHindiOrderItems([
      { itemName: 'मसाला चाय', quantity: 2 },
      { itemName: 'समोसा', quantity: 2 },
      { itemName: 'गुलाब जामुन', quantity: 4 },
    ])
    assert.equal(
      text,
      'ऑर्डर में है: दो मसाला चाय, दो समोसा, और चार गुलाब जामुन।'
    )
  })

  it('summarizes overflow items cleanly beyond max items to speak', () => {
    const text = formatHindiOrderItems(
      [
        { itemName: 'Item 1', quantity: 1 },
        { itemName: 'Item 2', quantity: 2 },
        { itemName: 'Item 3', quantity: 1 },
        { itemName: 'Item 4', quantity: 3 },
        { itemName: 'Item 5', quantity: 1 },
        { itemName: 'Item 6', quantity: 2 },
      ],
      3
    )
    assert.equal(
      text,
      'ऑर्डर में है: एक Item 1, दो Item 2, एक Item 3, और तीन अन्य आइटम।'
    )
  })

  it('announces table + items together matching user request', () => {
    // "नया ऑर्डर आया है, टेबल इतने से....and ये ये ऑर्डर है"
    const announcement1 = getHindiTableAnnouncement('5', [
      { itemName: 'बटर नान', quantity: 2 },
      { itemName: 'पनीर टिक्का', quantity: 1 },
    ])
    assert.equal(
      announcement1,
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है। ऑर्डर में है: दो बटर नान, और एक पनीर टिक्का।'
    )

    const announcement2 = getHindiTableAnnouncement('Table 12', [
      { itemName: 'दाल मखनी', quantity: 1 },
      { itemName: 'तंदूरी रोटी', quantity: 4 },
    ])
    assert.equal(
      announcement2,
      'नया ऑर्डर आया है। टेबल नंबर बारह से ऑर्डर प्राप्त हुआ है। ऑर्डर में है: एक दाल मखनी, और चार तंदूरी रोटी।'
    )

    const counterAnnouncement = getHindiTableAnnouncement('Counter', [
      { itemName: 'कोल्ड कॉफ़ी', quantity: 1 },
    ])
    assert.equal(
      counterAnnouncement,
      'नया ऑर्डर आया है। काउंटर से ऑर्डर प्राप्त हुआ है। ऑर्डर में है: एक कोल्ड कॉफ़ी।'
    )
  })

  it('supports object syntax { tableLabel, items }', () => {
    const res = getHindiTableAnnouncement({
      tableLabel: 'VIP 1',
      items: [{ itemName: 'शाही पनीर', quantity: 1 }],
    })
    assert.equal(
      res,
      'नया ऑर्डर आया है। वीआईपी टेबल नंबर एक से ऑर्डर प्राप्त हुआ है। ऑर्डर में है: एक शाही पनीर।'
    )
  })

  it('gracefully returns base table announcement if items is empty or null', () => {
    assert.equal(
      getHindiTableAnnouncement('5', []),
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।'
    )
    assert.equal(
      getHindiTableAnnouncement('5', null),
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है।'
    )
  })

  it('cleans parenthetical notes like (VIP Reward) when announcing items', () => {
    const text = formatHindiOrderItems([
      { itemName: 'Badshah Special Creamy Kabab', quantity: 1 },
      { itemName: 'rasmlai (VIP Reward)', quantity: 1 },
    ])
    assert.equal(
      text,
      'ऑर्डर में है: एक Badshah Special Creamy Kabab, और एक rasmlai।'
    )

    const tableAnnounce = getHindiTableAnnouncement({
      tableLabel: '5',
      items: [
        { itemName: 'Badshah Special Creamy Kabab', quantity: 1 },
        { itemName: 'rasmlai (VIP Reward)', quantity: 1 },
      ],
    })
    assert.equal(
      tableAnnounce,
      'नया ऑर्डर आया है। टेबल नंबर पाँच से ऑर्डर प्राप्त हुआ है। ऑर्डर में है: एक Badshah Special Creamy Kabab, और एक rasmlai।'
    )
  })
})


