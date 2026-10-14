import { randomBytes, randomUUID } from 'node:crypto'
import { Room } from '@colyseus/core'
import type { Client } from '@colyseus/core'
import {
  ABILITIES, MAPS, TANKS, TANK_IDS, WORLD_SIZE, advanceTank, clamp, distanceSquared,
  type BattleEvent, type GameMode, type InputFrame, type MapId, type MapObstacle, type RoomJoinOptions, type TankId, type TeamId,
} from '@tank-online/shared'
import { verifyAccessToken, type AuthIdentity } from '../auth/token.js'
import { BattleState, DestructibleState, PlayerState, ProjectileState } from './state.js'

interface RoomMetadata {
  mode: GameMode
  mapId: MapId
  phase: string
  private: boolean
}

interface RuntimePlayer {
  input: InputFrame
  lastInputAt: number
  lastShotAt: number
  respawnAt: number
  invulnerableUntil: number
  turboUntil: number
  fortifiedUntil: number
  armorBrokenUntil: number
  slowedUntil: number
  empowered: boolean
  nextAbilityPulse: number
  barrageShots: number
  mines: string[]
}

type BattleRoomDefinition = { state: BattleState; metadata: RoomMetadata }

const EMPTY_INPUT: InputFrame = { sequence: 0, moveX: 0, moveY: 0, aimAngle: 0, fire: false, ability: false }
const isMap = (value: unknown): value is MapId => ['railworks', 'green_ruins', 'sunflare_depot'].includes(String(value))
const isMode = (value: unknown): value is GameMode => ['tdm', 'base_capture'].includes(String(value))
const isTank = (value: unknown): value is TankId => TANK_IDS.includes(value as TankId)

export class BattleRoom extends Room<BattleRoomDefinition> {
  state = new BattleState()
  private readonly runtime = new Map<string, RuntimePlayer>()
  private matchStartedAt = 0
  private nextProjectile = 0
  private activeObstacles: readonly MapObstacle[] | null = null

  async onCreate(options: Partial<RoomJoinOptions> = {}) {
    this.maxClients = 16
    this.maxMessagesPerSecond = 45
    this.patchRate = 50
    this.state.mapId = isMap(options.mapId) ? options.mapId : 'railworks'
    this.state.mode = isMode(options.mode) ? options.mode : 'tdm'
    this.state.timeRemainingMs = this.state.mode === 'tdm' ? 600_000 : 720_000
    const isPrivate = Boolean(options.private)
    await this.setMatchmaking({
      metadata: { mode: this.state.mode as GameMode, mapId: this.state.mapId as MapId, phase: this.state.phase, private: isPrivate },
      private: isPrivate,
    })
    this.seedDestructibles()
    this.onMessage('input', (client, message: InputFrame) => this.receiveInput(client, message))
    this.onMessage('latency', (client, message: { sentAt?: number }) => {
      if (Number.isFinite(message?.sentAt)) client.send('latency', { sentAt: message.sentAt, serverTime: Date.now() })
    })
    this.onMessage('ping', (client, message: { x: number; y: number; label?: string }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return
      this.broadcast('event', { type: 'ping', sourceId: client.sessionId, x: clamp(Number(message.x), 0, WORLD_SIZE), y: clamp(Number(message.y), 0, WORLD_SIZE), label: String(message.label ?? 'Diqqat').slice(0, 20) } satisfies BattleEvent)
    })
    this.setFixedTimestep((context) => this.simulate(context.dt * 1000), 20)
  }

  async onAuth(_client: Client, options: RoomJoinOptions) {
    if (!options?.accessToken) throw new Error('Access token required')
    return verifyAccessToken(options.accessToken)
  }

  async onJoin(client: Client, options: RoomJoinOptions) {
    const auth = client.auth as AuthIdentity
    const tankId = isTank(options.tankId) ? options.tankId : 'assault'
    const team = this.pickTeam(tankId)
    const spawn = this.pickSpawn(team)
    const config = TANKS[tankId]
    const player = new PlayerState()
    Object.assign(player, {
      userId: auth.userId, nickname: auth.nickname, tankId, team,
      x: spawn[0], y: spawn[1], hp: config.maxHp, maxHp: config.maxHp, movementSpeed: config.speed,
    })
    this.state.players.set(client.sessionId, player)
    this.runtime.set(client.sessionId, {
      input: { ...EMPTY_INPUT }, lastInputAt: Date.now(), lastShotAt: 0, respawnAt: 0,
      invulnerableUntil: Date.now() + 2000, turboUntil: 0, fortifiedUntil: 0,
      armorBrokenUntil: 0, slowedUntil: 0, empowered: false, mines: [], nextAbilityPulse: 0, barrageShots: 0,
    })
  }

  onDrop(client: Client) {
    const player = this.state.players.get(client.sessionId)
    if (player) player.connected = false
    this.allowReconnection(client, 30)
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId)
    if (player) player.connected = true
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId)
    this.runtime.delete(client.sessionId)
  }

  protected generatePrivateCode() {
    return randomBytes(5).toString('base64url').replace(/[-_]/g, 'X').slice(0, 6).toUpperCase()
  }

  private receiveInput(client: Client, value: InputFrame) {
    const runtime = this.runtime.get(client.sessionId)
    if (!runtime || !value || !Number.isFinite(value.sequence) || value.sequence <= runtime.input.sequence) return
    runtime.input = {
      sequence: Math.floor(value.sequence),
      moveX: clamp(Number(value.moveX) || 0, -1, 1),
      moveY: clamp(Number(value.moveY) || 0, -1, 1),
      aimAngle: Number.isFinite(value.aimAngle) ? value.aimAngle : 0,
      fire: Boolean(value.fire),
      // Preserve a pulse when multiple input packets arrive before one tick.
      ability: runtime.input.ability || Boolean(value.ability),
    }
    runtime.lastInputAt = Date.now()
  }

  private simulate(dtMs: number) {
    const now = Date.now()
    this.state.serverTime = now
    this.state.tick += 1
    this.updatePhase(dtMs, now)
    for (const [sessionId, player] of this.state.players) {
      const runtime = this.runtime.get(sessionId)
      if (!runtime) continue
      if (!player.alive) {
        if (now >= runtime.respawnAt) this.respawn(player, runtime)
        continue
      }
      const input = now - runtime.lastInputAt > 500 ? EMPTY_INPUT : runtime.input
      this.movePlayer(player, runtime, input, dtMs / 1000, now)
      player.turretAngle = input.aimAngle
      if (input.fire) this.fire(sessionId, player, runtime, now)
      if (input.ability) this.useAbility(sessionId, player, runtime, now)
      runtime.input.ability = false
      this.updateAbility(sessionId, player, runtime, now)
    }
    this.updateProjectiles(dtMs / 1000, now)
    if (this.state.phase === 'active' && this.state.mode === 'base_capture') this.updateCapture(dtMs)
  }

  private updatePhase(dtMs: number, now: number) {
    if (this.state.phase === 'waiting' && this.clients.length >= 2) {
      this.state.phase = 'countdown'
      this.state.countdownMs = 15_000
      void this.updateMetadata()
    } else if (this.state.phase === 'countdown') {
      this.state.countdownMs = Math.max(0, this.state.countdownMs - dtMs)
      if (this.state.countdownMs === 0) {
        this.state.phase = 'active'
        this.matchStartedAt = now
        void this.updateMetadata()
      }
    } else if (this.state.phase === 'active') {
      this.state.timeRemainingMs = Math.max(0, this.state.timeRemainingMs - dtMs)
      if (this.state.timeRemainingMs === 0 || this.state.azureScore >= 40 || this.state.emberScore >= 40) this.finishMatch()
    }
  }

  private async updateMetadata() {
    await this.setMetadata({ ...this.metadata, phase: this.state.phase }, true)
  }

  private movePlayer(player: PlayerState, runtime: RuntimePlayer, input: InputFrame, dt: number, now: number) {
    const config = TANKS[player.tankId as TankId]
    let speed = config.speed
    if (runtime.turboUntil > now) speed *= ABILITIES.scout.power
    if (runtime.slowedUntil > now) speed *= 0.4
    player.movementSpeed = speed
    if (!this.activeObstacles) this.activeObstacles = MAPS[this.state.mapId as MapId].obstacles.filter(o => !this.state.destructibles.get(o.id)?.destroyed)
    const next = advanceTank(player, input.moveX, input.moveY, speed, dt, this.activeObstacles)
    player.x = next.x; player.y = next.y
    if (input.moveX || input.moveY) player.angle = Math.atan2(input.moveY, input.moveX)
  }

  private fire(sessionId: string, player: PlayerState, runtime: RuntimePlayer, now: number, angle = player.turretAngle, multiplier = 1) {
    const config = TANKS[player.tankId as TankId]
    if (now - runtime.lastShotAt < config.reloadMs * (runtime.fortifiedUntil > now ? 0.6 : 1)) return
    runtime.lastShotAt = now
    const empowered = runtime.empowered
    runtime.empowered = false
    this.spawnProjectile(sessionId, player, angle, config.damage * multiplier * (empowered ? 1.5 : 1), config.projectileSpeed, 'shell')
  }

  private spawnProjectile(ownerId: string, player: PlayerState, angle: number, damage: number, speed: number, kind: string, ttl = 2200) {
    const projectile = new ProjectileState()
    Object.assign(projectile, {
      ownerId, team: player.team, kind, x: player.x + Math.cos(angle) * 52, y: player.y + Math.sin(angle) * 52,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, ttl, radius: kind === 'mine' ? 26 : 8,
    })
    const id = `${this.state.tick}-${this.nextProjectile++}`
    this.state.projectiles.set(id, projectile)
    return id
  }

  private useAbility(sessionId: string, player: PlayerState, runtime: RuntimePlayer, now: number) {
    const config = TANKS[player.tankId as TankId]
    const ability = ABILITIES[player.tankId as TankId]
    if (!player.alive || now < player.abilityReadyAt || this.state.phase === 'finished') return
    player.abilityReadyAt = now + config.abilityCooldownMs
    player.abilityActiveUntil = now + ability.durationMs
    runtime.nextAbilityPulse = now
    switch (player.tankId as TankId) {
      case 'scout': runtime.turboUntil = player.abilityActiveUntil; break
      case 'assault': runtime.fortifiedUntil = player.abilityActiveUntil; break
      case 'heavy': player.shield = ability.power; break
      case 'sniper': this.spawnProjectile(sessionId, player, player.turretAngle, ability.power, 1500, 'deadeye'); break
      case 'artillery':
        runtime.barrageShots = 3
        break
      case 'destroyer':
        this.spawnProjectile(sessionId, player, player.turretAngle, ability.power, 1000, 'breaker')
        break
      case 'engineer': {
        runtime.mines = runtime.mines.filter(id => this.state.projectiles.has(id))
        for (const offset of [-0.9, 0, 0.9]) {
          const angle = player.angle + Math.PI + offset
          const mineId = this.spawnProjectile(sessionId, player, angle, ability.power, 0, 'mine', 30_000)
          const mine = this.state.projectiles.get(mineId)!
          mine.x = clamp(player.x + Math.cos(angle) * 100, 35, WORLD_SIZE - 35)
          mine.y = clamp(player.y + Math.sin(angle) * 100, 35, WORLD_SIZE - 35)
          runtime.mines.push(mineId)
        }
        while (runtime.mines.length > 6) this.state.projectiles.delete(runtime.mines.shift()!)
        break
      }
      case 'support':
        for (const ally of this.state.players.values()) {
          if (ally.team === player.team && ally.alive && distanceSquared(ally.x, ally.y, player.x, player.y) < ability.radius ** 2) {
            ally.hp = Math.min(ally.maxHp, ally.hp + ability.power)
          }
        }
        break
      case 'flame':
        break
      case 'shock':
        for (const [id, enemy] of this.state.players) {
          if (enemy.team !== player.team && enemy.alive && distanceSquared(enemy.x, enemy.y, player.x, player.y) < ability.radius ** 2) {
            const targetRuntime = this.runtime.get(id)
            if (targetRuntime && targetRuntime.invulnerableUntil <= now) {
              targetRuntime.slowedUntil = now + 5000
              this.damagePlayer(sessionId, id, enemy, targetRuntime, ability.power, now)
            }
          }
        }
        break
    }
    this.broadcast('event', { type: 'ability', sourceId: sessionId, label: config.abilityName, x: player.x, y: player.y, value: ability.radius } satisfies BattleEvent)
  }

  private updateAbility(id: string, player: PlayerState, runtime: RuntimePlayer, now: number) {
    if (player.abilityActiveUntil <= now) {
      if (player.tankId === 'heavy') player.shield = 0
      runtime.barrageShots = 0
      return
    }
    if (now < runtime.nextAbilityPulse) return
    if (player.tankId === 'flame') {
      for (const offset of [-0.25, -0.12, 0, 0.12, 0.25]) this.spawnProjectile(id, player, player.turretAngle + offset, ABILITIES.flame.power, 660, 'flame', 550)
      runtime.nextAbilityPulse = now + 200
    }
    if (player.tankId === 'artillery' && runtime.barrageShots > 0) {
      const offset = (runtime.barrageShots - 2) * 0.16
      this.spawnProjectile(id, player, player.turretAngle + offset, ABILITIES.artillery.power, 620, 'artillery', 1450)
      runtime.barrageShots--
      runtime.nextAbilityPulse = now + 550
    }
  }

  private detonate(projectile: ProjectileState, now: number) {
    const radius = ABILITIES.artillery.radius
    this.broadcast('event', { type: 'ability', x: projectile.x, y: projectile.y, value: radius, label: 'Shell impact' } satisfies BattleEvent)
    for (const [id, target] of this.state.players) {
      const runtime = this.runtime.get(id)
      const distance = Math.sqrt(distanceSquared(target.x, target.y, projectile.x, projectile.y))
      if (!runtime || !target.alive || target.team === projectile.team || runtime.invulnerableUntil > now || distance > radius) continue
      this.damagePlayer(projectile.ownerId, id, target, runtime, projectile.damage * (1 - distance / radius * 0.65), now)
    }
    for (const obstacle of MAPS[this.state.mapId as MapId].obstacles) {
      if (obstacle.destructible && distanceSquared(obstacle.x, obstacle.y, projectile.x, projectile.y) < radius ** 2) this.damageObstacle(obstacle.id, projectile.damage, obstacle.x, obstacle.y)
    }
  }

  private updateProjectiles(dt: number, now: number) {
    const map = MAPS[this.state.mapId as MapId]
    for (const [projectileId, projectile] of this.state.projectiles) {
      projectile.ttl -= dt * 1000
      if (projectile.kind !== 'mine') {
        projectile.x += projectile.vx * dt
        projectile.y += projectile.vy * dt
      }
      if (projectile.ttl <= 0 || projectile.x < 0 || projectile.y < 0 || projectile.x > WORLD_SIZE || projectile.y > WORLD_SIZE) {
        if (projectile.kind === 'artillery') this.detonate(projectile, now)
        this.state.projectiles.delete(projectileId)
        continue
      }
      const hitObstacle = map.obstacles.find((obstacle) => {
        const active = !this.state.destructibles.get(obstacle.id)?.destroyed
        return active && projectile.x >= obstacle.x - obstacle.width / 2 && projectile.x <= obstacle.x + obstacle.width / 2 && projectile.y >= obstacle.y - obstacle.height / 2 && projectile.y <= obstacle.y + obstacle.height / 2
      })
      if (hitObstacle && projectile.kind !== 'mine') {
        if (projectile.kind === 'artillery') this.detonate(projectile, now)
        else this.damageObstacle(hitObstacle.id, projectile.damage, projectile.x, projectile.y)
        this.state.projectiles.delete(projectileId)
        continue
      }
      for (const [targetId, target] of this.state.players) {
        if (!target.alive || target.team === projectile.team || targetId === projectile.ownerId) continue
        const radius = projectile.kind === 'mine' ? 54 : 38
        if (distanceSquared(target.x, target.y, projectile.x, projectile.y) > radius ** 2) continue
        const targetRuntime = this.runtime.get(targetId)
        if (!targetRuntime || targetRuntime.invulnerableUntil > now) continue
        if (projectile.kind === 'artillery') this.detonate(projectile, now)
        else this.damagePlayer(projectile.ownerId, targetId, target, targetRuntime, projectile.damage, now)
        if (projectile.kind === 'breaker') targetRuntime.armorBrokenUntil = now + 8000
        this.state.projectiles.delete(projectileId)
        break
      }
    }
  }

  private damageObstacle(id: string, amount: number, x: number, y: number) {
    const state = this.state.destructibles.get(id)
    if (!state || state.destroyed) return
    state.hp -= amount
    if (state.hp <= 0) {
      state.destroyed = true
      this.activeObstacles = null
      const obstacle = MAPS[this.state.mapId as MapId].obstacles.find((item) => item.id === id)
      if (obstacle?.explosive) {
        for (const [targetId, target] of this.state.players) {
          if (!target.alive || distanceSquared(target.x, target.y, x, y) > 190 ** 2) continue
          const runtime = this.runtime.get(targetId)
          if (runtime) this.damagePlayer('', targetId, target, runtime, 260, Date.now())
        }
      }
    }
  }

  private damagePlayer(sourceId: string, targetId: string, target: PlayerState, runtime: RuntimePlayer, rawDamage: number, now: number) {
    let damage = rawDamage
    if (runtime.invulnerableUntil > now || !target.alive) return
    if (runtime.fortifiedUntil > now) damage *= ABILITIES.assault.power
    if (runtime.armorBrokenUntil > now) damage *= 1.35
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, damage)
      target.shield -= absorbed
      damage -= absorbed
    }
    target.hp = Math.max(0, target.hp - Math.round(damage))
    this.broadcast('event', { type: 'hit', sourceId, targetId, value: Math.round(damage) } satisfies BattleEvent)
    if (target.hp > 0) return
    target.alive = false
    target.abilityActiveUntil = 0
    target.deaths += 1
    runtime.respawnAt = now + 5000
    const killer = this.state.players.get(sourceId)
    if (killer) {
      killer.kills += 1
      if (killer.team === 'azure') this.state.azureScore += 1
      else this.state.emberScore += 1
    }
    this.broadcast('event', { type: 'destroyed', sourceId, targetId } satisfies BattleEvent)
  }

  private respawn(player: PlayerState, runtime: RuntimePlayer) {
    const spawn = this.pickSpawn(player.team as TeamId)
    player.x = spawn[0]
    player.y = spawn[1]
    player.hp = player.maxHp
    player.shield = 0
    player.abilityActiveUntil = 0
    runtime.turboUntil = 0; runtime.fortifiedUntil = 0; runtime.armorBrokenUntil = 0; runtime.slowedUntil = 0; runtime.barrageShots = 0
    player.alive = true
    runtime.invulnerableUntil = Date.now() + 2000
  }

  private updateCapture(dtMs: number) {
    const map = MAPS[this.state.mapId as MapId]
    let azureAtEmber = 0
    let emberAtAzure = 0
    for (const player of this.state.players.values()) {
      if (!player.alive) continue
      if (player.team === 'azure' && distanceSquared(player.x, player.y, map.baseEmber[0], map.baseEmber[1]) < 300 ** 2) azureAtEmber += 1
      if (player.team === 'ember' && distanceSquared(player.x, player.y, map.baseAzure[0], map.baseAzure[1]) < 300 ** 2) emberAtAzure += 1
    }
    this.state.captureAzure = clamp(this.state.captureAzure + (azureAtEmber > emberAtAzure ? dtMs : -dtMs * 0.5), 0, 20_000)
    this.state.captureEmber = clamp(this.state.captureEmber + (emberAtAzure > azureAtEmber ? dtMs : -dtMs * 0.5), 0, 20_000)
    if (this.state.captureAzure >= 20_000) { this.state.azureScore = 40; this.finishMatch() }
    if (this.state.captureEmber >= 20_000) { this.state.emberScore = 40; this.finishMatch() }
  }

  private finishMatch() {
    if (this.state.phase === 'finished') return
    this.state.phase = 'finished'
    const winner = this.state.azureScore === this.state.emberScore ? 'draw' : this.state.azureScore > this.state.emberScore ? 'azure' : 'ember'
    this.broadcast('event', { type: 'matchEnded', label: winner } satisfies BattleEvent)
    void this.updateMetadata()
  }

  private seedDestructibles() {
    for (const obstacle of MAPS[this.state.mapId as MapId].obstacles) {
      if (!obstacle.destructible) continue
      const state = new DestructibleState()
      state.kind = obstacle.kind
      state.hp = obstacle.hp ?? 300
      this.state.destructibles.set(obstacle.id, state)
    }
  }

  private pickTeam(tankId: TankId): TeamId {
    let azure = 0
    let ember = 0
    for (const player of this.state.players.values()) {
      const weight = TANKS[player.tankId as TankId].weight
      if (player.team === 'azure') azure += weight
      else ember += weight
    }
    const joiningWeight = TANKS[tankId].weight
    return azure + joiningWeight <= ember + joiningWeight ? 'azure' : 'ember'
  }

  private pickSpawn(team: TeamId): readonly [number, number] {
    const spawns = team === 'azure' ? MAPS[this.state.mapId as MapId].spawnAzure : MAPS[this.state.mapId as MapId].spawnEmber
    return spawns[this.state.players.size % spawns.length] ?? spawns[0]!
  }
}

export class PrivateBattleRoom extends BattleRoom {
  async onCreate(options: Partial<RoomJoinOptions> = {}) {
    this.roomId = this.generatePrivateCode()
    await super.onCreate({ ...options, private: true })
  }
}

export class LobbyRoom extends Room {
  maxClients = 100
}
