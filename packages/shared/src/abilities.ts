import type { TankId } from './types.js'

export const ABILITIES: Record<TankId, { durationMs: number; radius: number; power: number }> = {
  scout: { durationMs: 5000, radius: 110, power: 2 },
  assault: { durationMs: 6000, radius: 120, power: 0.55 },
  heavy: { durationMs: 8000, radius: 130, power: 850 },
  sniper: { durationMs: 1000, radius: 100, power: 700 },
  artillery: { durationMs: 1800, radius: 200, power: 260 },
  destroyer: { durationMs: 1000, radius: 110, power: 460 },
  engineer: { durationMs: 1000, radius: 150, power: 450 },
  support: { durationMs: 1200, radius: 600, power: 450 },
  flame: { durationMs: 4000, radius: 360, power: 24 },
  shock: { durationMs: 1000, radius: 550, power: 200 },
}
