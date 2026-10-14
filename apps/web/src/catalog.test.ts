import { describe, expect, it } from 'vitest'
import { MAP_LIST, TANK_LIST, WORLD_SIZE } from '@tank-online/shared'

describe('game catalog', () => {
  it('ships the promised ten tanks and three maps', () => {
    expect(TANK_LIST).toHaveLength(10)
    expect(MAP_LIST).toHaveLength(3)
    expect(new Set(TANK_LIST.map((tank) => tank.id)).size).toBe(10)
  })

  it('keeps every battlefield large and its bases far apart', () => {
    expect(WORLD_SIZE).toBe(6144)
    for (const map of MAP_LIST) {
      expect(Math.hypot(map.baseEmber[0] - map.baseAzure[0], map.baseEmber[1] - map.baseAzure[1])).toBeGreaterThan(4_000)
      for (const point of [...map.spawnAzure, ...map.spawnEmber, map.baseAzure, map.baseEmber]) {
        expect(point[0]).toBeGreaterThan(0)
        expect(point[1]).toBeGreaterThan(0)
        expect(point[0]).toBeLessThan(WORLD_SIZE)
        expect(point[1]).toBeLessThan(WORLD_SIZE)
      }
    }
  })
})
