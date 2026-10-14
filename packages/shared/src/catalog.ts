import type { CatalogResponse } from './types.js'
import { MAP_LIST } from './maps.js'
import { TANK_LIST } from './tanks.js'

export const CATALOG: CatalogResponse = {
  tanks: TANK_LIST,
  maps: MAP_LIST.map(({ id, name, kicker, description }) => ({ id, name, kicker, description })),
  modes: [
    { id: 'tdm', name: 'Team Deathmatch', description: '10 daqiqa yoki 40 yo‘q qilish.' },
    { id: 'base_capture', name: 'Base Capture', description: 'Raqib bazasini 20 soniya nazorat qiling.' },
  ],
}
