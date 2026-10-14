import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { registerHttpRoutes } from './http/auth-routes.js'
import { gameStore } from './storage/game-store.js'
import { BattleRoom, LobbyRoom, PrivateBattleRoom } from './rooms/battle-room.js'

const port = Number(process.env.PORT ?? 2567)
const host = process.env.HOST ?? '0.0.0.0'
const webOrigins = new Set(
  (process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function isAllowedOrigin(origin?: string) {
  if (!origin || webOrigins.has(origin)) return true
  if (process.env.NODE_ENV === 'production') return false

  try {
    const url = new URL(origin)
    const host = url.hostname
    const isPrivateHost = host === 'localhost'
      || host === '127.0.0.1'
      || host.startsWith('10.')
      || host.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    return isPrivateHost && url.port === '5173'
  } catch {
    return false
  }
}

const gameServer = new Server({
  transport: new WebSocketTransport(),
  beforeListen: () => gameStore.boot(),
  express: (rawApp) => {
    const app = rawApp as any
    app.use(cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    }))
    app.use(express.json({ limit: '64kb' }))
    app.use(cookieParser())
    registerHttpRoutes(app)
  },
  greet: false,
})

gameServer.define('lobby', LobbyRoom)
gameServer.define('battle', BattleRoom)
gameServer.define('private_battle', PrivateBattleRoom)

await gameServer.listen(port, host)
console.info(`[server] Tank Online listening on ${host}:${port}`)
