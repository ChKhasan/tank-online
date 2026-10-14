import { hash, verify } from '@node-rs/argon2'
import { matchMaker } from '@colyseus/core'
import { CATALOG, TANK_IDS, type AuthResponse, type TankId } from '@tank-online/shared'
import { gameStore } from '../storage/game-store.js'
import { createAccessToken, createRefreshToken, hashRefreshToken, verifyAccessToken, type AuthIdentity } from '../auth/token.js'

const COOKIE = 'tank_refresh'
const NICKNAME = /^[\p{L}\p{N}_-]{3,16}$/u
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' }
}

async function issueSession(res: any, identity: AuthIdentity): Promise<AuthResponse> {
  const refreshToken = createRefreshToken()
  await gameStore.saveSession({
    userId: identity.userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  })
  res.cookie(COOKIE, refreshToken, cookieOptions())
  const profile = await gameStore.findById(identity.userId)
  if (!profile) throw new Error('Profile not found')
  return { accessToken: await createAccessToken(identity), profile: gameStore.publicProfile(profile) }
}

async function requireAuth(req: any, res: any, next: () => void) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Access token kerak.' })
    res.locals.identity = await verifyAccessToken(token)
    next()
  } catch {
    res.status(401).json({ message: 'Session tugagan. Qayta kiring.' })
  }
}

export function registerHttpRoutes(app: any) {
  app.get('/health', (_req: any, res: any) => res.json({ ok: true, service: 'tank-online-server', timestamp: new Date().toISOString() }))
  app.get('/api/catalog', (_req: any, res: any) => res.json(CATALOG))
  app.get('/api/rooms', async (_req: any, res: any) => {
    const rooms = await matchMaker.query({ name: 'battle' })
    res.json(rooms.map((room) => ({
      roomId: room.roomId,
      clients: room.clients,
      maxClients: room.maxClients,
      mode: room.metadata?.mode ?? 'tdm',
      mapId: room.metadata?.mapId ?? 'railworks',
      phase: room.metadata?.phase ?? 'waiting',
      private: false,
    })))
  })

  app.post('/api/auth/guest', async (req: any, res: any) => {
    const nickname = String(req.body?.nickname ?? '').trim()
    if (!NICKNAME.test(nickname)) return res.status(400).json({ message: 'Nickname 3–16 harf, raqam, _ yoki - bo‘lsin.' })
    const profile = await gameStore.createGuest(nickname)
    res.status(201).json(await issueSession(res, { userId: profile.id, nickname, isGuest: true }))
  })

  app.post('/api/auth/register', async (req: any, res: any) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase()
      const password = String(req.body?.password ?? '')
      const nickname = String(req.body?.nickname ?? '').trim()
      if (!EMAIL.test(email) || password.length < 8 || !NICKNAME.test(nickname)) {
        return res.status(400).json({ message: 'Email, 8+ belgili parol va to‘g‘ri nickname kiriting.' })
      }
      if (await gameStore.findByEmail(email)) return res.status(409).json({ message: 'Bu email allaqachon ishlatilgan.' })
      let guestId: string | null = null
      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '')
      if (bearer) guestId = (await verifyAccessToken(bearer).catch(() => null))?.userId ?? null
      const profile = await gameStore.register(guestId, email, await hash(password), nickname)
      res.status(201).json(await issueSession(res, { userId: profile.id, nickname, isGuest: false }))
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Akkaunt yaratilmadi.' })
    }
  })

  app.post('/api/auth/login', async (req: any, res: any) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    const user = await gameStore.findByEmail(email)
    if (!user?.passwordHash || !(await verify(user.passwordHash, password))) {
      return res.status(401).json({ message: 'Email yoki parol xato.' })
    }
    res.json(await issueSession(res, { userId: user.id, nickname: user.nickname, isGuest: false }))
  })

  app.post('/api/auth/refresh', async (req: any, res: any) => {
    const refresh = req.cookies?.[COOKIE]
    if (!refresh) return res.status(401).json({ message: 'Refresh token yo‘q.' })
    const userId = await gameStore.consumeSession(hashRefreshToken(refresh))
    const user = userId ? await gameStore.findById(userId) : null
    if (!user) return res.status(401).json({ message: 'Session tugagan.' })
    res.json({ accessToken: await createAccessToken({ userId: user.id, nickname: user.nickname, isGuest: user.isGuest }), profile: gameStore.publicProfile(user) })
  })

  app.post('/api/auth/logout', async (req: any, res: any) => {
    const refresh = req.cookies?.[COOKIE]
    if (refresh) await gameStore.deleteSession(hashRefreshToken(refresh))
    res.clearCookie(COOKIE, { path: '/' }).status(204).end()
  })

  app.get('/api/profile/me', requireAuth, async (_req: any, res: any) => {
    const identity = res.locals.identity as AuthIdentity
    const user = await gameStore.findById(identity.userId)
    if (!user) return res.status(404).json({ message: 'Profil topilmadi.' })
    res.json(gameStore.publicProfile(user))
  })

  app.patch('/api/profile/me', requireAuth, async (req: any, res: any) => {
    const identity = res.locals.identity as AuthIdentity
    const nickname = req.body?.nickname ? String(req.body.nickname).trim() : undefined
    const favoriteTank = req.body?.favoriteTank as TankId | undefined
    if (nickname && !NICKNAME.test(nickname)) return res.status(400).json({ message: 'Nickname noto‘g‘ri.' })
    if (favoriteTank && !TANK_IDS.includes(favoriteTank)) return res.status(400).json({ message: 'Tank noto‘g‘ri.' })
    const profile = await gameStore.updateProfile(identity.userId, { nickname, favoriteTank })
    if (!profile) return res.status(404).json({ message: 'Profil topilmadi.' })
    res.json(profile)
  })
}
