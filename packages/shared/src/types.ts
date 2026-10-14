export const TANK_IDS = [
  'scout',
  'assault',
  'heavy',
  'sniper',
  'artillery',
  'destroyer',
  'engineer',
  'support',
  'flame',
  'shock',
] as const

export type TankId = (typeof TANK_IDS)[number]
export type TeamId = 'azure' | 'ember'
export type MapId = 'railworks' | 'green_ruins' | 'sunflare_depot'
export type GameMode = 'tdm' | 'base_capture'
export type BattlePhase = 'waiting' | 'countdown' | 'active' | 'finished'

export interface InputFrame {
  sequence: number
  moveX: number
  moveY: number
  aimAngle: number
  fire: boolean
  ability: boolean
}

export interface TankConfig {
  id: TankId
  name: string
  role: string
  description: string
  maxHp: number
  speed: number
  damage: number
  reloadMs: number
  projectileSpeed: number
  abilityName: string
  abilityDescription: string
  abilityCooldownMs: number
  weight: number
  accent: number
  accentCss: string
}

export interface MapObstacle {
  id: string
  kind: 'warehouse' | 'house' | 'rock' | 'tree' | 'wall' | 'crate' | 'barrel' | 'toilet' | 'train' | 'container' | 'car'
  x: number
  y: number
  width: number
  height: number
  destructible?: boolean
  explosive?: boolean
  hp?: number
}

export interface MapConfig {
  id: MapId
  name: string
  kicker: string
  description: string
  palette: readonly [number, number, number]
  spawnAzure: readonly [number, number][]
  spawnEmber: readonly [number, number][]
  baseAzure: readonly [number, number]
  baseEmber: readonly [number, number]
  obstacles: readonly MapObstacle[]
}

export interface CatalogResponse {
  tanks: TankConfig[]
  maps: Pick<MapConfig, 'id' | 'name' | 'kicker' | 'description'>[]
  modes: { id: GameMode; name: string; description: string }[]
}

export interface PublicProfile {
  id: string
  nickname: string
  email: string | null
  isGuest: boolean
  level: number
  xp: number
  credits: number
  matches: number
  wins: number
  favoriteTank: TankId
}

export interface AuthResponse {
  accessToken: string
  profile: PublicProfile
}

export interface RoomJoinOptions {
  accessToken: string
  tankId: TankId
  mapId: MapId
  mode: GameMode
  private?: boolean
}

export interface RoomSummary {
  roomId: string
  clients: number
  maxClients: number
  mode: GameMode
  mapId: MapId
  phase: BattlePhase
  private: boolean
}

export interface BattleEvent {
  type: 'hit' | 'destroyed' | 'respawn' | 'ability' | 'objective' | 'matchEnded' | 'ping'
  sourceId?: string
  targetId?: string
  value?: number
  label?: string
  x?: number
  y?: number
}
