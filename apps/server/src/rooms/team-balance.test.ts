import { describe, expect, it } from 'vitest'
import { TANKS } from '@tank-online/shared'

describe('tank balance seed', () => {
  it('keeps every tank playable and finite', () => {
    for (const tank of Object.values(TANKS)) {
      expect(tank.maxHp).toBeGreaterThan(0)
      expect(tank.speed).toBeGreaterThan(0)
      expect(tank.reloadMs).toBeGreaterThanOrEqual(500)
      expect(Number.isFinite(tank.damage)).toBe(true)
    }
  })
})
