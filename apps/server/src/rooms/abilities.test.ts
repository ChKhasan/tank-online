import { afterEach, describe, expect, it, vi } from 'vitest'
import { ABILITIES, MAPS, TANKS, canMoveTo, type TankId } from '@tank-online/shared'
import { BattleRoom } from './battle-room.js'
import { PlayerState } from './state.js'

// Exercise the actual room simulation, not a duplicate of the ability formulas.
function fixture(tankId: TankId) {
  const room = new BattleRoom()
  const internals = room as any
  vi.spyOn(room, 'broadcast').mockImplementation(() => undefined as any)
  room.state.phase = 'active'
  const player = new PlayerState()
  Object.assign(player, { tankId, x: 300, y: 300, team: 'azure', hp: TANKS[tankId].maxHp, maxHp: TANKS[tankId].maxHp })
  const runtime = { input: { sequence: 1, moveX: 0, moveY: 0, aimAngle: 0, fire: false, ability: false }, lastInputAt: 1000, lastShotAt: 0, respawnAt: 0, invulnerableUntil: 0, turboUntil: 0, fortifiedUntil: 0, armorBrokenUntil: 0, slowedUntil: 0, empowered: false, mines: [], nextAbilityPulse: 0, barrageShots: 0 }
  room.state.players.set('pilot', player)
  internals.runtime.set('pilot', runtime)
  return { room, internals, player, runtime, use: (now = 1000) => internals.useAbility('pilot', player, runtime, now) }
}

afterEach(() => vi.restoreAllMocks())

describe('server-controlled special abilities', () => {
  it('retains a short ability press until the next server tick', () => {
    const f = fixture('assault')
    const client = { sessionId: 'pilot' }
    f.internals.receiveInput(client, { ...f.runtime.input, sequence: 2, ability: true })
    f.internals.receiveInput(client, { ...f.runtime.input, sequence: 3, ability: false })
    expect(f.runtime.input.ability).toBe(true)
    f.internals.simulate(50)
    expect(f.player.abilityReadyAt).toBeGreaterThan(Date.now())
    expect(f.runtime.input.ability).toBe(false)
  })
  it.each(Object.keys(TANKS) as TankId[])('%s enforces cooldown and active duration', tankId => {
    const f = fixture(tankId)
    f.use()
    expect(f.player.abilityReadyAt).toBe(1000 + TANKS[tankId].abilityCooldownMs)
    expect(f.player.abilityActiveUntil).toBe(1000 + ABILITIES[tankId].durationMs)
    const count = f.room.state.projectiles.size
    f.use(1050)
    expect(f.room.state.projectiles.size).toBe(count)
    expect(f.player.abilityReadyAt).toBe(1000 + TANKS[tankId].abilityCooldownMs)
  })

  it('flame emits repeatedly, follows aim and stops after four seconds', () => {
    const f = fixture('flame'); f.use()
    f.internals.updateAbility('pilot', f.player, f.runtime, 1000)
    expect(f.room.state.projectiles.size).toBe(5)
    f.player.turretAngle = Math.PI / 2
    f.internals.updateAbility('pilot', f.player, f.runtime, 1200)
    expect(f.room.state.projectiles.size).toBe(10)
    expect([...f.room.state.projectiles.values()].at(-1)!.vy).toBeGreaterThan(600)
    f.internals.updateAbility('pilot', f.player, f.runtime, 5001)
    expect(f.room.state.projectiles.size).toBe(10)
  })

  it('artillery fires exactly three spaced explosive shells', () => {
    const f = fixture('artillery'); f.use()
    for (const now of [1000, 1200, 1550, 2100, 2300]) f.internals.updateAbility('pilot', f.player, f.runtime, now)
    expect(f.room.state.projectiles.size).toBe(3)
    expect([...f.room.state.projectiles.values()].every(p => p.kind === 'artillery')).toBe(true)
  })

  it('minefield places three and caps active mines at six', () => {
    const f = fixture('engineer')
    f.use(1000); f.use(12000); f.use(23000)
    expect(f.room.state.projectiles.size).toBe(6)
    expect(new Set([...f.room.state.projectiles.values()].map(p => `${p.x},${p.y}`)).size).toBe(3)
  })

  it('repair heals nearby allies but never opponents or above maximum HP', () => {
    const f = fixture('support'); f.player.hp = 900
    const ally = new PlayerState(); Object.assign(ally, { team: 'azure', x: 800, y: 300, hp: 200 })
    const enemy = new PlayerState(); Object.assign(enemy, { team: 'ember', x: 310, y: 300, hp: 200 })
    f.room.state.players.set('ally', ally); f.room.state.players.set('enemy', enemy)
    f.use()
    expect(f.player.hp).toBe(1000); expect(ally.hp).toBe(650); expect(enemy.hp).toBe(200)
  })

  it('heavy armor expires and cannot survive death/respawn', () => {
    const f = fixture('heavy'); f.use()
    expect(f.player.shield).toBe(850)
    f.internals.updateAbility('pilot', f.player, f.runtime, 9001)
    expect(f.player.shield).toBe(0)
    f.runtime.turboUntil = 99999
    f.internals.respawn(f.player, f.runtime)
    expect(f.runtime.turboUntil).toBe(0)
    expect(f.player.abilityActiveUntil).toBe(0)
  })

  it('finished matches and dead tanks cannot activate abilities', () => {
    const f = fixture('sniper'); f.player.alive = false; f.use()
    expect(f.room.state.projectiles.size).toBe(0)
    f.player.alive = true; f.room.state.phase = 'finished'; f.use()
    expect(f.player.abilityReadyAt).toBe(0)
  })

  it('sniper fires its special shot without waiting for the primary gun', () => {
    const f = fixture('sniper'); f.runtime.lastShotAt = 999; f.use()
    const shot = [...f.room.state.projectiles.values()][0]!
    expect(shot.kind).toBe('deadeye'); expect(shot.damage).toBe(700)
    expect(Math.hypot(shot.vx, shot.vy)).toBe(1500)
  })

  it('shock damages and slows only nearby unprotected enemies', () => {
    const f = fixture('shock')
    const enemy = new PlayerState(); Object.assign(enemy, { team: 'ember', x: 500, y: 300 })
    const runtime = { ...f.runtime }
    f.room.state.players.set('enemy', enemy); f.internals.runtime.set('enemy', runtime)
    f.use()
    expect(enemy.hp).toBe(800); expect(runtime.slowedUntil).toBe(6000)
    expect(f.player.hp).toBe(1000)
    const previous = enemy.x
    f.internals.movePlayer(enemy, runtime, { moveX: 1, moveY: 0 }, 0.05, 1050)
    expect(enemy.x - previous).toBeCloseTo(TANKS.assault.speed * 0.4 * 0.05)
  })

  it('artillery splash has falloff and does not damage the firing team', () => {
    const f = fixture('artillery'); f.use()
    f.internals.updateAbility('pilot', f.player, f.runtime, 1000)
    const shot = [...f.room.state.projectiles.values()][0]!
    const enemy = new PlayerState(); Object.assign(enemy, { team: 'ember', x: shot.x + 100, y: shot.y })
    f.room.state.players.set('enemy', enemy); f.internals.runtime.set('enemy', { ...f.runtime })
    f.internals.detonate(shot, 1100)
    expect(enemy.hp).toBeLessThan(1000); expect(enemy.hp).toBeGreaterThan(740)
    expect(f.player.hp).toBe(TANKS.artillery.maxHp)
  })
})

describe('denser maps', () => {
  it.each(Object.values(MAPS))('$name keeps all spawns clear and cover IDs unique', map => {
    expect(map.obstacles.length).toBeGreaterThan(100)
    expect(new Set(map.obstacles.map(o => o.id)).size).toBe(map.obstacles.length)
    for (const [x, y] of [...map.spawnAzure, ...map.spawnEmber]) expect(canMoveTo(x, y, map.obstacles)).toBe(true)
  })
})
