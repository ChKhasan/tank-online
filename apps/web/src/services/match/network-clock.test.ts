import { describe, expect, it } from 'vitest'
import { NetworkClock } from './network-clock'
describe('network clock', () => {
  it('measures RTT and maps a different server clock into local monotonic time', () => {
    const clock = new NetworkClock()
    clock.observe(100, 250, 1000175)
    expect(clock.rtt).toBe(150)
    expect(clock.localTime(1000225, 300)).toBe(225)
  })
  it('bounds skew and falls back safely before the first pong', () => {
    const clock = new NetworkClock()
    expect(clock.localTime(99999, 20)).toBe(20)
    clock.observe(100, 110, 2000105)
    expect(clock.localTime(999999999, 300)).toBe(300)
    clock.reset(); expect(clock.rtt).toBe(0)
  })
})
