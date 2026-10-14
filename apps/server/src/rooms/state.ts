import { MapSchema, Schema, type } from '@colyseus/schema'

export class PlayerState extends Schema {
  @type('string') userId = ''
  @type('string') nickname = ''
  @type('string') tankId = 'assault'
  @type('string') team = 'azure'
  @type('number') x = 0
  @type('number') y = 0
  @type('number') angle = 0
  @type('number') turretAngle = 0
  @type('number') movementSpeed = 170
  @type('number') hp = 1000
  @type('number') maxHp = 1000
  @type('number') kills = 0
  @type('number') deaths = 0
  @type('number') abilityReadyAt = 0
  @type('number') abilityActiveUntil = 0
  @type('number') shield = 0
  @type('boolean') alive = true
  @type('boolean') connected = true
}

export class ProjectileState extends Schema {
  @type('string') ownerId = ''
  @type('string') team = ''
  @type('string') kind = 'shell'
  @type('number') x = 0
  @type('number') y = 0
  @type('number') vx = 0
  @type('number') vy = 0
  @type('number') damage = 0
  @type('number') ttl = 0
  @type('number') radius = 8
}

export class DestructibleState extends Schema {
  @type('string') kind = 'crate'
  @type('number') hp = 100
  @type('boolean') destroyed = false
}

export class BattleState extends Schema {
  @type('string') phase = 'waiting'
  @type('string') mode = 'tdm'
  @type('string') mapId = 'railworks'
  @type('number') tick = 0
  @type('number') serverTime = 0
  @type('number') countdownMs = 15_000
  @type('number') timeRemainingMs = 600_000
  @type('number') azureScore = 0
  @type('number') emberScore = 0
  @type('number') captureAzure = 0
  @type('number') captureEmber = 0
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>()
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>()
  @type({ map: DestructibleState }) destructibles = new MapSchema<DestructibleState>()
}
