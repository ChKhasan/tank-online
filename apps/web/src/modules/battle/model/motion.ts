import { advanceTank, type MapObstacle } from '@tank-online/shared'

type Point = { x: number; y: number }
interface MotionFrame { start: number; end: number; x: number; y: number; speed: number }
export const smoothing = (deltaMs: number, halfLifeMs: number) => 1 - Math.pow(0.5, deltaMs / halfLifeMs)
export const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t

/** Predict immediately; replay recent local controls over timestamped server
 * poses. Only presentation errors decay: authoritative collision is preserved. */
export class LocalMotion {
  position: Point = { x: 0, y: 0 }
  display: Point = { x: 0, y: 0 }
  private frames: MotionFrame[] = []
  private lastSnapshot = -Infinity
  private initialized = false
  correction = 0

  reset(point: Point, now: number) {
    this.position = { ...point }; this.display = { ...point }
    this.frames = []; this.lastSnapshot = now; this.initialized = true; this.correction = 0
  }

  reconcile(point: Point, snapshotTime: number, now: number, obstacles: readonly MapObstacle[], teleport = false) {
    if (!this.initialized || teleport || Math.hypot(point.x - this.position.x, point.y - this.position.y) > 300) {
      this.reset(point, now); return
    }
    if (snapshotTime < this.lastSnapshot) return
    this.lastSnapshot = snapshotTime
    this.frames = this.frames.filter(f => f.end > snapshotTime && f.end > now - 1000)
    let corrected = { ...point }
    for (const frame of this.frames) {
      const dt = Math.max(0, frame.end - Math.max(frame.start, snapshotTime)) / 1000
      corrected = advanceTank(corrected, frame.x, frame.y, frame.speed, dt, obstacles)
    }
    this.correction = Math.hypot(corrected.x - this.position.x, corrected.y - this.position.y)
    this.position = corrected
  }

  advance(now: number, delta: number, x: number, y: number, speed: number, obstacles: readonly MapObstacle[]) {
    // Never replay seconds of movement after a background-tab pause or outage.
    const dt = Math.min(delta, 50)
    if (!this.initialized || now - this.lastSnapshot > 500) return this.display
    const previous = this.position
    this.position = advanceTank(previous, x, y, speed, dt / 1000, obstacles)
    this.display.x += this.position.x - previous.x
    this.display.y += this.position.y - previous.y
    const blend = smoothing(dt, 65)
    this.display.x += (this.position.x - this.display.x) * blend
    this.display.y += (this.position.y - this.display.y) * blend
    this.frames.push({ start: now - dt, end: now, x, y, speed })
    while (this.frames.length > 150 || (this.frames[0]?.end ?? now) < now - 1000) this.frames.shift()
    return this.display
  }
}

export interface Pose extends Point { time: number; angle: number; turret: number }
export class RemoteMotion {
  private samples: Pose[] = []
  push(pose: Pose, teleport = false) {
    const last = this.samples.at(-1)
    if (teleport || (last && Math.hypot(last.x - pose.x, last.y - pose.y) > 300)) this.samples = []
    if (last && !teleport && pose.time <= last.time) return
    this.samples.push(pose)
    if (this.samples.length > 16) this.samples.shift()
  }
  sample(now: number): Pose | undefined {
    const time = now - 100 // two snapshots of jitter buffer at 20 Hz
    while (this.samples.length > 2 && this.samples[1]!.time <= time) this.samples.shift()
    const a = this.samples[0], b = this.samples[1]
    if (!a || !b || time <= a.time) return a
    // Hold the latest pose during an outage; don't drive through unseen walls.
    const t = Math.min(1, Math.max(0, (time - a.time) / (b.time - a.time)))
    return { time, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: lerpAngle(a.angle, b.angle, t), turret: lerpAngle(a.turret, b.turret, t) }
  }
}
