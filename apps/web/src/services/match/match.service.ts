import { Client, type Room } from '@colyseus/sdk'
import type { BattleEvent, GameMode, InputFrame, MapId, RoomJoinOptions, RoomSummary, TankId } from '@tank-online/shared'
import { authService, SERVER_URL } from '../auth/auth.service'
import { NetworkClock } from './network-clock'

export type BattleStateLike = any

class MatchService {
  readonly clock = new NetworkClock()
  private latencyTimer?: ReturnType<typeof setInterval>
  private readonly client = new Client(SERVER_URL)
  private room: Room<any, BattleStateLike> | null = null
  private stateListeners = new Set<(state: BattleStateLike, sessionId: string) => void>()
  private eventListeners = new Set<(event: BattleEvent) => void>()
  private statusListeners = new Set<(status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void>()

  get activeRoom() {
    return this.room
  }

  private async options(tankId: TankId, mapId: MapId, mode: GameMode): Promise<RoomJoinOptions> {
    return { accessToken: await authService.ensureFreshToken(), tankId, mapId, mode }
  }

  async quickMatch(tankId: TankId, mapId: MapId, mode: GameMode) {
    this.emitStatus('connecting')
    return this.attach(await this.client.joinOrCreate('battle', await this.options(tankId, mapId, mode)))
  }

  async createPrivate(tankId: TankId, mapId: MapId, mode: GameMode) {
    this.emitStatus('connecting')
    return this.attach(await this.client.create('private_battle', { ...await this.options(tankId, mapId, mode), private: true }))
  }

  async joinByCode(code: string, tankId: TankId, mapId: MapId, mode: GameMode) {
    this.emitStatus('connecting')
    return this.attach(await this.client.joinById(code.trim().toUpperCase(), await this.options(tankId, mapId, mode)))
  }

  async listRooms(): Promise<RoomSummary[]> {
    const response = await fetch(`${SERVER_URL}/api/rooms`)
    if (!response.ok) throw new Error('Xonalar ro‘yxati olinmadi.')
    return response.json() as Promise<RoomSummary[]>
  }

  private attach(room: Room<any, BattleStateLike>) {
    clearInterval(this.latencyTimer)
    this.clock.reset()
    this.room = room
    room.onMessage('latency', (message: { sentAt: number; serverTime: number }) => {
      if (this.room === room) this.clock.observe(message.sentAt, performance.now(), message.serverTime)
    })
    const measure = () => room.send('latency', { sentAt: performance.now() })
    this.latencyTimer = setInterval(measure, 2000)
    measure()
    localStorage.setItem('tank_reconnect_token', room.reconnectionToken)
    room.onStateChange((state) => this.stateListeners.forEach((listener) => listener(state, room.sessionId)))
    room.onMessage<BattleEvent>('*', (messageType, event) => {
      if (messageType === 'event') this.eventListeners.forEach((listener) => listener(event))
    })
    room.onDrop(() => {
      clearInterval(this.latencyTimer)
      this.emitStatus('reconnecting')
      void this.reconnect(room.reconnectionToken)
    })
    room.onReconnect(() => this.emitStatus('connected'))
    room.onLeave(() => { if (this.room === room) { clearInterval(this.latencyTimer); this.emitStatus('disconnected') } })
    this.emitStatus('connected')
    return room
  }

  private async reconnect(token: string) {
    try {
      this.attach(await this.client.reconnect(token))
    } catch {
      this.emitStatus('disconnected')
    }
  }

  sendInput(input: InputFrame) {
    this.room?.send('input', input)
  }

  sendPing(x: number, y: number, label = 'Diqqat') {
    this.room?.send('ping', { x, y, label })
  }

  subscribeState(listener: (state: BattleStateLike, sessionId: string) => void) {
    this.stateListeners.add(listener)
    if (this.room?.state) listener(this.room.state, this.room.sessionId)
    return () => this.stateListeners.delete(listener)
  }

  subscribeEvent(listener: (event: BattleEvent) => void) {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  subscribeStatus(listener: (status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void) {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private emitStatus(status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') {
    this.statusListeners.forEach((listener) => listener(status))
  }

  async leave() {
    clearInterval(this.latencyTimer)
    if (this.room) await this.room.leave(true)
    this.room = null
    localStorage.removeItem('tank_reconnect_token')
  }
}

export const matchService = new MatchService()
