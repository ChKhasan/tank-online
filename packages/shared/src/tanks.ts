import type { TankConfig, TankId } from './types.js'

export const TANKS: Record<TankId, TankConfig> = {
  scout: {
    id: 'scout', name: 'Raven', role: 'Scout', maxHp: 700, speed: 220, damage: 95, reloadMs: 550,
    projectileSpeed: 820, abilityName: 'Breakthrough', abilityDescription: 'Q: 5 soniya ikki karra tezlik. Dushman qanotini yorib o‘ting.',
    abilityCooldownMs: 16_000, weight: 1, accent: 0xb7a768, accentCss: '#b7a768',
    description: 'Tezkor razvedkachi. Flank va bazani egallash uchun yaratilgan.',
  },
  assault: {
    id: 'assault', name: 'Vanguard', role: 'Assault', maxHp: 1000, speed: 170, damage: 150, reloadMs: 900,
    projectileSpeed: 720, abilityName: 'Battle Frenzy', abilityDescription: 'Q: 6 soniya 45% kam zarar va 40% qisqa qayta zaryad.',
    abilityCooldownMs: 16_000, weight: 2, accent: 0x7897a1, accentCss: '#7897a1',
    description: 'Har qanday vaziyatga mos universal front tanki.',
  },
  heavy: {
    id: 'heavy', name: 'Bastion', role: 'Heavy', maxHp: 1600, speed: 110, damage: 260, reloadMs: 1800,
    projectileSpeed: 620, abilityName: 'Iron Fortress', abilityDescription: 'Q: 8 soniyaga 850 HP qo‘shimcha zirh. Hujumni o‘zingizga oling.',
    abilityCooldownMs: 24_000, weight: 4, accent: 0xb99655, accentCss: '#b99655',
    description: 'Sekin, ammo yo‘lakni yolg‘iz ushlab tura oladigan qal’a.',
  },
  sniper: {
    id: 'sniper', name: 'Longshot', role: 'Sniper', maxHp: 850, speed: 130, damage: 350, reloadMs: 2400,
    projectileSpeed: 1080, abilityName: 'Deadeye', abilityDescription: 'Q: nishon yo‘nalishiga darhol 700 zararli yuqori tezlikdagi snaryad.',
    abilityCooldownMs: 12_000, weight: 3, accent: 0xd8d0ad, accentCss: '#d8d0ad',
    description: 'Uzoq masofadan bitta aniq zarba bilan yo‘lni tozalaydi.',
  },
  artillery: {
    id: 'artillery', name: 'Monsoon', role: 'Artillery', maxHp: 800, speed: 105, damage: 220, reloadMs: 2500,
    projectileSpeed: 540, abilityName: 'Rolling Barrage', abilityDescription: 'Q: 3 navbatli salvo. Har snaryad 200 radiusda 260 gacha zarar beradi.',
    abilityCooldownMs: 24_000, weight: 3, accent: 0xa85d4b, accentCss: '#a85d4b',
    description: 'Hududni nazorat qiluvchi og‘ir uzoq masofali platforma.',
  },
  destroyer: {
    id: 'destroyer', name: 'Rupture', role: 'Destroyer', maxHp: 1100, speed: 135, damage: 230, reloadMs: 1700,
    projectileSpeed: 760, abilityName: 'Armor Rupture', abilityDescription: 'Q: 460 zararli snaryad. Urilgan raqib keyingi 8 soniya 35% ko‘p zarar oladi.',
    abilityCooldownMs: 18_000, weight: 3, accent: 0x91493e, accentCss: '#91493e',
    description: 'Heavy tanklarni yorib o‘tishga mo‘ljallangan ovchi.',
  },
  engineer: {
    id: 'engineer', name: 'Tinker', role: 'Engineer', maxHp: 950, speed: 135, damage: 130, reloadMs: 1000,
    projectileSpeed: 680, abilityName: 'Minefield', abilityDescription: 'Q: orqaga yoy shaklida 3 ta 450 zararli mina. Maksimum 6 ta, 30 soniya yashaydi.',
    abilityCooldownMs: 10_000, weight: 2, accent: 0x8b7867, accentCss: '#8b7867',
    description: 'Yo‘laklarni minalar bilan yopadigan taktik mutaxassis.',
  },
  support: {
    id: 'support', name: 'Lifeline', role: 'Support', maxHp: 1000, speed: 145, damage: 105, reloadMs: 750,
    projectileSpeed: 700, abilityName: 'Field Workshop', abilityDescription: 'Q: 600 radiusdagi barcha ittifoqchilarga, jumladan o‘zingizga 450 HP ta’mir.',
    abilityCooldownMs: 18_000, weight: 2, accent: 0x71805a, accentCss: '#71805a',
    description: 'Jamoani jangda uzoqroq ushlab turuvchi mobil ustaxona.',
  },
  flame: {
    id: 'flame', name: 'Cinder', role: 'Flame', maxHp: 1200, speed: 120, damage: 120, reloadMs: 800,
    projectileSpeed: 640, abilityName: 'Inferno', abilityDescription: 'Q: 4 soniya davomida minoraga ergashuvchi uzluksiz olov oqimi.',
    abilityCooldownMs: 18_000, weight: 3, accent: 0xb16f3d, accentCss: '#b16f3d',
    description: 'Yaqin jangda dushmanni joyidan suruvchi agressiv tank.',
  },
  shock: {
    id: 'shock', name: 'Volt', role: 'Shock', maxHp: 1000, speed: 145, damage: 130, reloadMs: 1000,
    projectileSpeed: 740, abilityName: 'Seismic Charge', abilityDescription: 'Q: 550 radiusda 200 zarar; raqiblar 5 soniya 60% sekinlashadi.',
    abilityCooldownMs: 22_000, weight: 2, accent: 0x6f7d86, accentCss: '#6f7d86',
    description: 'Tezkor hujumlarni buzadigan zarbali snaryad tanki.',
  },
}

export const TANK_LIST = Object.values(TANKS)
