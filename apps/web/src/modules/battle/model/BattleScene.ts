import Phaser from 'phaser'
import { MAPS, TANKS, WORLD_SIZE, type InputFrame, type MapId, type MapObstacle, type TankId } from '@tank-online/shared'
import { matchService, type BattleStateLike } from '@/services/match/match.service'
import { battleInput } from './battle-input'
import { paintTank, VEHICLE_ART } from '@/services/tanks/tank-art'
import { drawTerrain, seededRandom } from './terrain-art'
import { LocalMotion, RemoteMotion, lerpAngle, smoothing } from './motion'

interface PlayerVisual {
  root: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
  turret: Phaser.GameObjects.Image
  name: Phaser.GameObjects.Text
  health: Phaser.GameObjects.Graphics
  serverX: number
  serverY: number
  displayX: number
  displayY: number
  remote: RemoteMotion
  hpKey: string
  alive: boolean
  trackX: number
  trackY: number
}

const TEAM_BLUE = 0x7897a1
const TEAM_RED = 0xa85d4b
const RUST = 0x824c32

export class BattleScene extends Phaser.Scene {
  private state: BattleStateLike | null = null
  private sessionId = ''
  private readonly players = new Map<string, PlayerVisual>()
  private projectiles!: Phaser.GameObjects.Graphics
  private effects!: Phaser.GameObjects.Graphics
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'ability', Phaser.Input.Keyboard.Key>
  private sequence = 0
  private lastInputAt = 0
  private unsubscribe?: () => boolean
  private unsubscribeEvent?: () => boolean
  private targetZoom = 0.9
  private mapId?: MapId
  private scenery = new Map<string, Phaser.GameObjects.Image>()
  private obstacleById = new Map<string, MapObstacle>()
  private obstacles: readonly MapObstacle[] = []
  private destroyed = new Set<string>()
  private localMotion = new LocalMotion()
  private controls: InputFrame = { sequence: 0, moveX: 0, moveY: 0, aimAngle: 0, fire: false, ability: false }
  private lastSnapshotAt = 0
  private frameTimes: number[] = []
  private lastMetricsAt = 0
  private cameraReady = false
  private renderStartedAt = 0
  private updateCost = 0
  private renderCost = 0
  private renderCount = 0
  private bursts: { x: number; y: number; at: number; radius: number; color: number }[] = []
  private trails: { x: number; y: number; angle: number; at: number }[] = []
  private tracks!: Phaser.GameObjects.Graphics
  private lastTrackAt = 0

  constructor() { super('battle') }

  create() {
    this.cameras.main.setBackgroundColor('#25291f')
    this.tracks = this.add.graphics().setDepth(-200)
    this.projectiles = this.add.graphics().setDepth(1100)
    this.effects = this.add.graphics().setDepth(1200)
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      ability: Phaser.Input.Keyboard.KeyCodes.Q,
    }) as typeof this.keys
    // Latch the keydown event: a short press can begin and end between renders.
    this.keys.ability.on('down', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (!event.repeat) this.controls.ability = true
    })
    this.unsubscribe = matchService.subscribeState((state, sessionId) => {
      this.state = state
      this.sessionId = sessionId
      if (!this.mapId && MAPS[state.mapId as MapId]) this.drawWorld(state.mapId as MapId)
      this.syncPlayers()
    })
    this.unsubscribeEvent = matchService.subscribeEvent(event => {
      const player = this.state?.players?.get(event.targetId ?? event.sourceId ?? '')
      if (event.type === 'hit' || event.type === 'destroyed' || event.type === 'ability') {
        const x = event.x ?? player?.x, y = event.y ?? player?.y
        if (x === undefined || y === undefined) return
        this.bursts.push({ x, y, at: this.time.now, radius: event.type === 'destroyed' ? 130 : event.type === 'ability' ? (event.value ?? 110) : 42, color: event.type === 'ability' ? 0xd1c493 : 0xe6a456 })
      }
    })
    this.input.on('wheel', (_pointer: unknown, _objects: unknown, _dx: number, dy: number) => {
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom * Math.exp(-dy * 0.001), 0.4, 1.65)
    })
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.cameras.main.setViewport(0, 0, size.width, size.height)
    })
    this.applyCameraZoom()
    this.game.events.on(Phaser.Core.Events.BLUR, this.releaseInput, this)
    this.game.events.on(Phaser.Core.Events.PRE_RENDER, this.beforeRender, this)
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.afterRender, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
  }

  update(time: number, delta: number) {
    if (!this.state || !this.mapId) return
    const now = performance.now()
    const dt = Math.min(delta, 50)
    this.readControls()
    this.renderPlayers(now, dt)
    this.sendControls(time)
    this.drawProjectiles()
    if (battleInput.zoomStep) {
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom + battleInput.zoomStep * 0.15, 0.4, 1.65)
      battleInput.zoomStep = 0
    }
    this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, this.targetZoom, smoothing(dt, 65)))
    battleInput.zoom = Math.round(this.targetZoom * 100)
    const local = this.players.get(this.sessionId)
    if (local) {
      const camera = this.cameras.main
      // Follow the frame-rate predicted pose, never the raw 20 Hz server pose.
      const blend = this.cameraReady ? smoothing(dt, 25) : 1
      camera.centerOn(Phaser.Math.Linear(camera.midPoint.x, local.root.x, blend), Phaser.Math.Linear(camera.midPoint.y, local.root.y, blend))
      this.cameraReady = true
    }
    this.effects.clear()
    this.bursts = this.bursts.filter(b => time - b.at < 850).slice(-80)
    for (const b of this.bursts) {
      const t = (time - b.at) / 850
      this.effects.lineStyle(4 * (1 - t), b.color, (1 - t) * 0.8)
      this.effects.strokeCircle(b.x, b.y, b.radius * (0.2 + t * 0.8))
      this.effects.fillStyle(b.color, (1 - t) * 0.2)
      this.effects.fillCircle(b.x, b.y, b.radius * t * 0.65)
    }
    // Tire marks need only 10 Hz, not a full rebuild at the render frame rate.
    if (time - this.lastTrackAt >= 100) {
      this.lastTrackAt = time
      for (const v of this.players.values()) {
        if (v.alive && Math.hypot(v.root.x - v.trackX, v.root.y - v.trackY) > 5) {
          this.trails.push({ x: v.root.x, y: v.root.y, angle: v.body.rotation, at: time })
          v.trackX = v.root.x; v.trackY = v.root.y
        }
      }
      this.tracks.clear()
      this.trails = this.trails.filter(t => time - t.at < 14000).slice(-280)
      for (const t of this.trails) {
        this.tracks.lineStyle(9, 0x39382d, 0.26 * (1 - (time - t.at) / 14000))
        for (const side of [-1, 1]) {
          const x = t.x + Math.sin(t.angle) * 24 * side, y = t.y - Math.cos(t.angle) * 24 * side
          this.tracks.lineBetween(x, y, x - Math.cos(t.angle) * 12, y - Math.sin(t.angle) * 12)
        }
      }
    }
    this.updateCost += performance.now() - now
    this.frameTimes.push(this.game.loop.rawDelta)
    if (now - this.lastMetricsAt >= 1000) {
      const samples = this.frameTimes.sort((a, b) => a - b)
      battleInput.fps = Math.round(1000 / (samples.reduce((sum, value) => sum + value, 0) / samples.length))
      battleInput.frameP95 = Math.round(samples[Math.floor((samples.length - 1) * 0.95)]!)
      battleInput.updateMs = Math.round(this.updateCost / samples.length * 100) / 100
      battleInput.renderMs = Math.round(this.renderCost / Math.max(1, this.renderCount) * 100) / 100
      this.updateCost = 0; this.renderCost = 0; this.renderCount = 0
      this.frameTimes = []; this.lastMetricsAt = now
    }
  }

  private renderPlayers(now: number, delta: number) {
    for (const [id, visual] of this.players) {
      const player = this.state.players.get(id)
      if (!player) continue
      if (id === this.sessionId && player.alive && player.connected) {
        const point = this.localMotion.advance(now, delta, this.controls.moveX, this.controls.moveY, player.movementSpeed ?? TANKS[player.tankId as TankId].speed, this.obstacles)
        visual.displayX = point.x; visual.displayY = point.y
        if (this.controls.moveX || this.controls.moveY) visual.body.rotation = lerpAngle(visual.body.rotation, Math.atan2(this.controls.moveY, this.controls.moveX), smoothing(delta, 35))
        visual.turret.rotation = this.controls.aimAngle
      } else {
        const pose = visual.remote.sample(now)
        if (pose) {
          visual.displayX = pose.x; visual.displayY = pose.y
          visual.body.rotation = pose.angle; visual.turret.rotation = pose.turret
        }
      }
      // Top-down vehicles need one layer; changing depth each frame sorts the entire scene.
      visual.root.setPosition(visual.displayX, visual.displayY)
    }
  }

  private releaseInput() {
    this.controls.moveX = 0; this.controls.moveY = 0; this.controls.fire = false; this.controls.ability = false
    this.input.keyboard?.resetKeys()
    battleInput.reset()
    matchService.sendInput({ ...this.controls, sequence: ++this.sequence })
  }

  private beforeRender() { this.renderStartedAt = performance.now() }
  private afterRender() { this.renderCost += performance.now() - this.renderStartedAt; this.renderCount++ }

  shutdown() {
    this.unsubscribe?.()
    this.unsubscribeEvent?.()
    this.game.events.off(Phaser.Core.Events.BLUR, this.releaseInput, this)
    this.game.events.off(Phaser.Core.Events.PRE_RENDER, this.beforeRender, this)
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.afterRender, this)
    battleInput.reset()
  }

  private applyCameraZoom() {
    this.targetZoom = window.innerWidth < 760 ? 0.65 : 0.9
    this.cameras.main.setZoom(this.targetZoom)
  }

  private drawWorld(mapId: MapId) {
    this.mapId = mapId
    const map = MAPS[mapId]
    this.obstacles = map.obstacles
    const floor = this.add.graphics().setDepth(-1000)
    floor.setDepth(-900)
    drawTerrain(this, map)
    this.drawBaseFortification(floor, map.baseAzure[0], map.baseAzure[1], TEAM_BLUE)
    this.drawBaseFortification(floor, map.baseEmber[0], map.baseEmber[1], TEAM_RED)

    this.bakeScenery(mapId, map.obstacles)
    for (const [label, base] of [['BLUE COMMAND', map.baseAzure], ['RED COMMAND', map.baseEmber]] as const) {
      this.add.text(base[0], base[1] + 140, label, { fontFamily: 'Barlow Condensed', fontSize: '26px', color: '#d5ccb0', stroke: '#524b36', strokeThickness: 3 }).setOrigin(0.5).setDepth(-80).setAlpha(0.8)
    }
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE)
  }

  private bakeScenery(mapId: MapId, obstacles: readonly MapObstacle[]) {
    const size = 2048, pad = 32
    let x = 0, y = 0, rowHeight = 0, page = 0
    const graphic = this.make.graphics({ x: 0, y: 0 })
    let frames: { obstacle: MapObstacle; x: number; y: number; w: number; h: number }[] = []
    const flush = () => {
      if (!frames.length) return
      const key = `scenery-atlas-${mapId}-${page++}`
      graphic.generateTexture(key, size, Math.min(size, y + rowHeight))
      const texture = this.textures.get(key)
      for (const f of frames) {
        texture.add(f.obstacle.id, 0, f.x, f.y, f.w, f.h)
        const sprite = this.add.image(f.obstacle.x - f.obstacle.width / 2 - pad, f.obstacle.y - f.obstacle.height / 2 - pad, key, f.obstacle.id).setOrigin(0).setDepth(-100)
        this.scenery.set(f.obstacle.id, sprite)
      }
      graphic.clear(); frames = []; x = 0; y = 0; rowHeight = 0
    }
    for (const obstacle of [...obstacles].sort((a, b) => b.height - a.height)) {
      this.obstacleById.set(obstacle.id, obstacle)
      const w = Math.ceil(obstacle.width + pad * 2), h = Math.ceil(obstacle.height + pad * 2)
      if (x + w > size) { x = 0; y += rowHeight; rowHeight = 0 }
      if (y + h > size) flush()
      this.drawObstacle(graphic, { ...obstacle, x: x + obstacle.width / 2 + pad, y: y + obstacle.height / 2 + pad })
      frames.push({ obstacle, x, y, w, h })
      x += w; rowHeight = Math.max(rowHeight, h)
    }
    flush(); graphic.destroy()
  }


  private drawBaseFortification(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    g.lineStyle(3, color, 0.35); g.strokeCircle(x, y, 300)
    g.fillStyle(0x8f8466, 0.3); g.fillCircle(x, y, 280)
    for (let i = 0; i < 50; i++) {
      const angle = i / 50 * Math.PI * 2
      if (Math.abs(Math.sin(angle)) < 0.55) continue // wide vehicle gates
      const ax = x + Math.cos(angle) * 310, ay = y + Math.sin(angle) * 310
      g.fillStyle(0x39382a, 0.35); g.fillRoundedRect(ax - 17, ay - 7, 38, 21, 6)
      g.fillStyle(i % 2 ? 0xada07a : 0x958969); g.fillRoundedRect(ax - 19, ay - 12, 36, 19, 7)
      g.lineStyle(1, 0xd0c399, 0.6); g.lineBetween(ax - 12, ay - 8, ax + 11, ay - 8)
    }
    g.fillStyle(0x413e30); g.fillCircle(x, y, 23)
    g.lineStyle(5, 0xb7ac8a); g.lineBetween(x, y, x - 16, y - 60)
    g.fillStyle(color); g.fillTriangle(x - 16, y - 60, x + 50, y - 50, x - 10, y - 32)
  }

  private drawObstacle(g: Phaser.GameObjects.Graphics, obstacle: MapObstacle) {
    const { x, y, width: w, height: h } = obstacle
    g.fillStyle(0x11130f, 0.23)
    if (obstacle.kind === 'tree' || obstacle.kind === 'rock' || obstacle.kind === 'barrel') g.fillEllipse(x + 15, y + 18, w * 1.12, h * 1.1)
    else g.fillRoundedRect(x - w / 2 + 12, y - h / 2 + 16, w, h, Math.min(12, h / 4))

    switch (obstacle.kind) {
      case 'warehouse':
        g.fillStyle(0x5d604f, 1); g.fillRect(x - w / 2, y - h / 2, w, h)
        g.lineStyle(8, 0x34372e, 0.8); g.strokeRect(x - w / 2, y - h / 2, w, h)
        g.fillStyle(0x2d3029, 1); g.fillRect(x - w * 0.12, y - h / 2, w * 0.24, h)
        g.lineStyle(4, 0xa18b5f, 0.35)
        for (let yy = y - h / 2 + 40; yy < y + h / 2; yy += 55) g.lineBetween(x - w / 2, yy, x + w / 2, yy)
        break
      case 'house':
        g.fillStyle(0xaaa085); g.fillRect(x - w / 2, y - h / 2, w, h)
        g.fillStyle(0x88634a); g.fillRect(x - w / 2 - 5, y - h / 2 - 5, w / 2 + 5, h + 10)
        g.fillStyle(0x604b3b); g.fillRect(x, y - h / 2 - 5, w / 2 + 5, h + 10)
        g.lineStyle(2, 0x3d3428, 0.65)
        for (let yy = y - h / 2; yy < y + h / 2; yy += 16) {
          g.lineBetween(x - w / 2, yy, x + w / 2, yy)
          for (let xx = x - w / 2; xx < x + w / 2; xx += 28) g.lineBetween(xx + (Math.floor(yy / 16) % 2) * 14, yy, xx + (Math.floor(yy / 16) % 2) * 14, yy + 15)
        }
        g.lineStyle(6, 0xc19870, 0.75); g.lineBetween(x, y - h / 2 - 7, x, y + h / 2 + 7)
        g.fillStyle(0x493d30); g.fillRect(x + w * 0.2, y - h * 0.3, 26, 35)
        g.fillStyle(0xb79a74); g.fillRect(x + w * 0.2 - 3, y - h * 0.3 - 3, 26, 28)
        g.fillStyle(0x332e25); g.fillRect(x + w * 0.2 + 2, y - h * 0.3 + 2, 16, 17)
        break
      case 'train':
        g.fillStyle(0x4b3d31, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 22)
        g.fillStyle(0x1f2521, 1); g.fillRect(x - w / 2 + 28, y - h / 2 + 22, w - 56, h - 44)
        g.fillStyle(0x887150, 1)
        for (let xx = x - w / 2 + 50; xx < x + w / 2 - 35; xx += 90) g.fillRect(xx, y - h / 2 + 30, 50, h - 60)
        break
      case 'container':
        g.fillStyle(0x58625c, 1); g.fillRect(x - w / 2, y - h / 2, w, h)
        g.lineStyle(4, 0x2d332f, 0.9); g.strokeRect(x - w / 2, y - h / 2, w, h)
        for (let xx = x - w / 2 + 18; xx < x + w / 2; xx += 30) g.lineBetween(xx, y - h / 2, xx, y + h / 2)
        break
      case 'tree':
        { const random = seededRandom(Math.floor(x + y))
          g.fillStyle(0x353e2a, 0.95); g.fillCircle(x, y, w * 0.46)
          for (let i = 0; i < 48; i++) {
            const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * w * 0.37
            const tx = x + Math.cos(angle) * r, ty = y + Math.sin(angle) * r
            g.fillStyle([0x52603a, 0x6d7745, 0x3e4c30, 0x87905b][i % 4]!, 0.85)
            g.fillCircle(tx, ty, 6 + random() * w * 0.13)
          }
        }
        break
      case 'rock':
        g.fillStyle(0x69695b, 1)
        g.fillPoints([
          new Phaser.Math.Vector2(x - w / 2, y + h * 0.12),
          new Phaser.Math.Vector2(x - w * 0.25, y - h / 2),
          new Phaser.Math.Vector2(x + w * 0.3, y - h * 0.42),
          new Phaser.Math.Vector2(x + w / 2, y + h * 0.2),
          new Phaser.Math.Vector2(x, y + h / 2),
        ], true)
        g.lineStyle(5, 0x3e4138, 0.7); g.lineBetween(x - w * 0.22, y - h * 0.3, x + w * 0.24, y + h * 0.26)
        break
      case 'wall':
        g.fillStyle(0x7b7664, 1); g.fillRect(x - w / 2, y - h / 2, w, h)
        g.lineStyle(3, 0x49483f, 0.8); g.strokeRect(x - w / 2, y - h / 2, w, h)
        for (let xx = x - w / 2 + 35; xx < x + w / 2; xx += 55) g.lineBetween(xx, y - h / 2, xx, y + h / 2)
        break
      case 'crate':
        g.fillStyle(0x8a653c, 1); g.fillRect(x - w / 2, y - h / 2, w, h)
        g.lineStyle(7, 0x4c3926, 0.9); g.strokeRect(x - w / 2, y - h / 2, w, h)
        g.lineBetween(x - w / 2, y - h / 2, x + w / 2, y + h / 2); g.lineBetween(x + w / 2, y - h / 2, x - w / 2, y + h / 2)
        break
      case 'barrel':
        g.fillStyle(obstacle.explosive ? 0x8d3f2e : 0x5d604d, 1); g.fillCircle(x, y, w / 2)
        g.lineStyle(6, 0x302d25, 1); g.strokeCircle(x, y, w / 2); g.strokeCircle(x, y, w * 0.28)
        break
      case 'toilet':
        g.fillStyle(0x4e5b48, 1); g.fillRect(x - w / 2, y - h / 2, w, h)
        g.fillStyle(0x2c3028, 1); g.fillRect(x - w * 0.18, y + h * 0.12, w * 0.36, h * 0.38)
        g.lineStyle(5, 0x8b805f, 0.7); g.strokeRect(x - w / 2, y - h / 2, w, h)
        break
      case 'car':
        g.fillStyle(RUST, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 22)
        g.fillStyle(0x252922, 1); g.fillRect(x - w * 0.18, y - h / 2 + 10, w * 0.36, h - 20)
        g.fillStyle(0x141611, 1); g.fillRect(x - w * 0.32, y - h / 2 - 8, w * 0.18, 16); g.fillRect(x + w * 0.14, y - h / 2 - 8, w * 0.18, 16)
        g.fillRect(x - w * 0.32, y + h / 2 - 8, w * 0.18, 16); g.fillRect(x + w * 0.14, y + h / 2 - 8, w * 0.18, 16)
        g.fillStyle(0x85908a, 0.5); g.fillRect(x - w * 0.2, y - h * 0.3, w * 0.12, h * 0.6)
        g.lineStyle(2, 0xc8b698, 0.6); g.lineBetween(x - w * 0.2, y - h * 0.3, x - w * 0.12, y + h * 0.15)
        g.fillStyle(0x2b2820, 0.8); g.fillEllipse(x + w * 0.31, y + 5, w * 0.3, h * 0.6)
        break
    }
    if (obstacle.kind !== 'tree') {
      const random = seededRandom(Math.floor(x * 7 + y))
      for (let i = 0; i < 24; i++) {
        g.fillStyle(i % 3 ? 0xd3c499 : 0x28271f, 0.2)
        g.fillRect(x + (random() - 0.5) * w * 0.9, y + (random() - 0.5) * h * 0.9, 2 + random() * 8, 2 + random() * 3)
      }
    }
  }

  private syncPlayers() {
    if (!this.state?.players || !this.mapId) return
    const now = performance.now()
    this.lastSnapshotAt = now
    const snapshotTime = matchService.clock.localTime(this.state.serverTime, now)
    let changed = false
    this.state.destructibles?.forEach((d: any, id: string) => {
      if (!d.destroyed || this.destroyed.has(id)) return
      this.destroyed.add(id); changed = true
      this.scenery.get(id)?.setVisible(false)
      const o = this.obstacleById.get(id)
      if (!o) return
      const rubble = this.add.graphics().setDepth(-100)
      const random = seededRandom(Math.floor(o.x + o.y))
      for (let i = 0; i < 18; i++) {
        rubble.fillStyle(i % 2 ? 0x574b37 : 0xa18b64, 0.8)
        rubble.fillRect(o.x + (random() - 0.5) * o.width, o.y + (random() - 0.5) * o.height, 6 + random() * 14, 5 + random() * 8)
      }
    })
    if (changed) this.obstacles = MAPS[this.mapId].obstacles.filter(o => !this.destroyed.has(o.id))
    const active = new Set<string>()
    this.state.players.forEach((player: any, id: string) => {
      active.add(id)
      let visual = this.players.get(id)
      if (!visual) visual = this.createPlayer(id, player)
      const teleported = visual.alive !== player.alive || Math.hypot(player.x - visual.serverX, player.y - visual.serverY) > 300
      if (teleported && id === this.sessionId) this.cameraReady = false
      visual.serverX = player.x; visual.serverY = player.y; visual.alive = player.alive
      visual.remote.push({ x: player.x, y: player.y, angle: player.angle, turret: player.turretAngle, time: snapshotTime }, teleported)
      if (id === this.sessionId) this.localMotion.reconcile({ x: player.x, y: player.y }, snapshotTime, now, this.obstacles, teleported)
      visual.root.setAlpha(player.alive ? player.connected ? 1 : 0.45 : 0.2)
      if (visual.name.text !== player.nickname) visual.name.setText(player.nickname)
      const abilityActive = player.abilityActiveUntil > this.state.serverTime && player.alive
      const hpKey = [player.hp, player.maxHp, player.shield, abilityActive].join(':')
      if (hpKey !== visual.hpKey) {
        visual.hpKey = hpKey
        this.drawHealth(visual.health, player.hp, player.maxHp, player.shield)
        if (abilityActive) {
          visual.health.lineStyle(2, 0xe2d4a2, 0.7)
          visual.health.strokeRoundedRect(-59, -46, 118, 88, 12)
        }
      }
    })
    for (const [id, visual] of this.players) {
      if (!active.has(id)) { visual.root.destroy(true); this.players.delete(id) }
    }
  }

  private createPlayer(id: string, player: any) {
    const config = TANKS[player.tankId as TankId] ?? TANKS.assault
    const teamColor = player.team === 'azure' ? TEAM_BLUE : TEAM_RED
    const root = this.add.container(player.x, player.y).setDepth(100)
    const spec = VEHICLE_ART[config.id]
    const shadow = this.add.ellipse(7, 9, spec.length + 8, spec.width + 8, 0x17170f, 0.35)
    const sprites = (['body', 'turret'] as const).map(layer => {
      const key = `vehicle-${config.id}-${player.team}-${layer}`
      if (!this.textures.exists(key)) {
        const texture = this.textures.createCanvas(key, 384, 256)!
        texture.context.translate(160, 128); texture.context.scale(2, 2)
        paintTank(texture.context, config.id, layer, `#${teamColor.toString(16)}`)
        texture.refresh()
      }
      return this.add.image(0, 0, key).setOrigin(160 / 384, 0.5).setScale(0.5)
    })
    const body = sprites[0]!, turret = sprites[1]!
    const name = this.add.text(0, -58, player.nickname, {
      fontFamily: '"Barlow Condensed", sans-serif', fontSize: '15px', color: '#eadfbd', fontStyle: 'bold',
      stroke: '#171813', strokeThickness: 4,
    }).setOrigin(0.5)
    const health = this.add.graphics()
    root.add([shadow, body, turret, name, health])
    const visual: PlayerVisual = {
      root, body, turret, name, health,
      serverX: player.x, serverY: player.y, displayX: player.x, displayY: player.y,
      remote: new RemoteMotion(), hpKey: '', alive: player.alive, trackX: player.x, trackY: player.y,
    }
    this.players.set(id, visual)
    return visual
  }

  private drawHealth(graphics: Phaser.GameObjects.Graphics, hp: number, maxHp: number, shield: number) {
    graphics.clear()
    graphics.fillStyle(0x171913, 0.94); graphics.fillRect(-38, -45, 76, 7)
    graphics.fillStyle(hp / maxHp > 0.35 ? 0xb9a75f : 0xa64d3c, 1); graphics.fillRect(-36, -43, 72 * Math.max(0, hp / maxHp), 3)
    if (shield > 0) { graphics.lineStyle(3, 0xa7bbc0, 0.9); graphics.strokeCircle(0, 0, 58) }
  }

  private drawProjectiles() {
    this.projectiles.clear()
    if (!this.state?.projectiles) return
    const lead = Math.min(0.05, Math.max(0, (performance.now() - this.lastSnapshotAt) / 1000))
    this.state.projectiles.forEach((projectile: any) => {
      const x = projectile.x + projectile.vx * lead, y = projectile.y + projectile.vy * lead
      const color = projectile.kind === 'flame' ? 0xd87435 : projectile.kind === 'mine' ? 0xc3ae73 : projectile.team === 'azure' ? TEAM_BLUE : TEAM_RED
      if (projectile.kind === 'mine') {
        this.projectiles.lineStyle(3, color, 0.8); this.projectiles.strokeCircle(x, y, 21)
        this.projectiles.fillStyle(0x2a2c24, 1); this.projectiles.fillCircle(x, y, 9)
      } else {
        if (projectile.kind === 'flame') {
          const radius = 9 + (1 - projectile.ttl / 550) * 22
          this.projectiles.fillStyle(0xc7662f, 0.28); this.projectiles.fillCircle(x, y, radius * 1.6)
          this.projectiles.fillStyle(0xe59b40, 0.6); this.projectiles.fillCircle(x, y, radius)
          this.projectiles.fillStyle(0xf4d384, 0.85); this.projectiles.fillCircle(x, y, radius * 0.4)
          return
        }
        this.projectiles.lineStyle(5, color, 0.38)
        this.projectiles.lineBetween(x - projectile.vx * 0.04, y - projectile.vy * 0.04, x, y)
        this.projectiles.fillStyle(0xffdfa0, 1); this.projectiles.fillCircle(x, y, projectile.kind === 'artillery' ? 8 : 5)
      }
    })
  }

  private readControls() {
    const local = this.players.get(this.sessionId)
    if (!local) return
    this.controls.moveX = Phaser.Math.Clamp((this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0) + battleInput.x, -1, 1)
    this.controls.moveY = Phaser.Math.Clamp((this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0) + battleInput.y, -1, 1)
    const pointer = this.input.activePointer
    const target = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
    this.controls.aimAngle = Math.atan2(target.y - local.root.y, target.x - local.root.x)
    this.controls.fire = (pointer.leftButtonDown() && (pointer.event?.target as HTMLElement | null)?.tagName === 'CANVAS') || battleInput.fire
    const touchAbility = battleInput.consumeAbility()
    this.controls.ability ||= touchAbility
  }

  private sendControls(time: number) {
    if (time - this.lastInputAt < 50 || !this.players.has(this.sessionId)) return
    this.lastInputAt = time
    matchService.sendInput({ ...this.controls, sequence: ++this.sequence })
    this.controls.ability = false
  }
}
