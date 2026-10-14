import { describe, expect, it } from 'vitest'
import { canMoveTo, circleIntersectsRect, normalizeVector } from './physics.js'

describe('shared physics', () => {
  it('normalizes diagonal input', () => {
    const value = normalizeVector(1, 1)
    expect(Math.hypot(value.x, value.y)).toBeCloseTo(1)
  })

  it('detects circle to obstacle collisions', () => {
    expect(circleIntersectsRect(100, 100, 34, { x: 120, y: 100, width: 50, height: 50 })).toBe(true)
  })

  it('keeps tanks inside world bounds', () => {
    expect(canMoveTo(10, 10, [])).toBe(false)
    expect(canMoveTo(100, 100, [])).toBe(true)
  })
})
