import { describe, expect, it } from 'vitest'
import { advanceTank, type MapObstacle } from '@tank-online/shared'
import { LocalMotion, RemoteMotion, smoothing } from './motion'

describe('local prediction and reconciliation', () => {
  it.each([30, 60, 144])('moves immediately and at the same speed at %i FPS', fps => {
    const motion = new LocalMotion(); motion.reset({ x: 200, y: 200 }, 0)
    const dt = 1000 / fps
    const frames = Math.floor(0.4 * fps)
    for (let i = 1; i <= frames; i++) motion.advance(i * dt, dt, 1, 0, 170, [])
    expect(motion.display.x).toBeCloseTo(200 + frames * dt / 1000 * 170, 6)
  })

  it('replays only input after the authoritative timestamp without jumping the display', () => {
    const motion = new LocalMotion(); motion.reset({ x: 200, y: 200 }, 0)
    for (let i = 1; i <= 6; i++) motion.advance(i * 16, 16, 1, 0, 170, [])
    const displayBefore = motion.display.x
    motion.reconcile({ x: 204, y: 200 }, 48, 96, [])
    expect(motion.position.x).toBeCloseTo(204 + 170 * 0.048)
    expect(motion.display.x).toBe(displayBefore)
    motion.advance(112, 16, 0, 0, 170, [])
    expect(motion.display.x).toBeLessThan(displayBefore)
    expect(motion.display.x).toBeGreaterThan(motion.position.x)
  })

  it('uses the same wall collision rules as the server, including boosted speed', () => {
    const wall: MapObstacle = { id: 'wall', kind: 'wall', x: 280, y: 200, width: 20, height: 400 }
    const motion = new LocalMotion(); motion.reset({ x: 200, y: 200 }, 0)
    let server = { x: 200, y: 200 }
    for (let i = 1; i <= 8; i++) {
      motion.advance(i * 50, 50, 1, 0, 440, [wall])
      server = advanceTank(server, 1, 0, 440, 0.05, [wall])
    }
    expect(motion.position).toEqual(server)
    expect(motion.position.x).toBeLessThanOrEqual(236)
  })

  it('snaps respawns but stops prediction when the connection stalls', () => {
    const motion = new LocalMotion(); motion.reset({ x: 200, y: 200 }, 0)
    motion.advance(16, 16, 1, 0, 170, [])
    const x = motion.display.x
    motion.advance(600, 584, 1, 0, 170, [])
    expect(motion.display.x).toBe(x)
    motion.reconcile({ x: 3000, y: 2000 }, 700, 700, [], true)
    expect(motion.display).toEqual({ x: 3000, y: 2000 })
  })

  it('does not produce frame spikes with 150 ms RTT and occasional missing snapshots', () => {
    const motion = new LocalMotion(); motion.reset({ x: 500, y: 500 }, 0)
    let prior = 500
    const steps: number[] = []
    for (let now = 10; now <= 3000; now += 10) {
      // Snapshot is 75 ms old; skip one in fifty snapshots (2%).
      if (now % 50 === 0 && now / 50 % 50 !== 0 && now >= 100) {
        motion.reconcile({ x: 500 + (now - 75) * 0.17, y: 500 }, now - 75, now, [])
      }
      motion.advance(now, 10, 1, 0, 170, [])
      steps.push(motion.display.x - prior); prior = motion.display.x
    }
    expect(Math.max(...steps)).toBeLessThan(2.3)
    expect(Math.min(...steps)).toBeGreaterThan(1.1)
    expect(Math.abs(motion.display.x - 1010)).toBeLessThan(3)
  })
})

describe('remote jitter buffer', () => {
  it('interpolates positions and wraps rotation across the short arc', () => {
    const motion = new RemoteMotion()
    motion.push({ x: 100, y: 100, angle: 3.1, turret: 3.1, time: 0 })
    motion.push({ x: 110, y: 100, angle: -3.1, turret: -3.1, time: 50 })
    expect(motion.sample(125)!.x).toBe(105)
    expect(Math.abs(motion.sample(125)!.angle)).toBeCloseTo(Math.PI)
    expect(motion.sample(500)!.x).toBe(110)
  })
  it('does not interpolate across a respawn', () => {
    const motion = new RemoteMotion()
    motion.push({ x: 100, y: 100, angle: 0, turret: 0, time: 0 })
    motion.push({ x: 3000, y: 100, angle: 0, turret: 0, time: 50 }, true)
    expect(motion.sample(125)!.x).toBe(3000)
  })
  it('uses frame-rate-independent smoothing', () => {
    expect((1 - smoothing(1000 / 60, 65)) ** 60).toBeCloseTo((1 - smoothing(1000 / 144, 65)) ** 144, 10)
  })
})
