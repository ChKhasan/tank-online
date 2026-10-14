import { createHash, randomBytes } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'

export interface AuthIdentity {
  userId: string
  nickname: string
  isGuest: boolean
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'tank-online-local-development-secret')

export async function createAccessToken(identity: AuthIdentity) {
  return new SignJWT({ nickname: identity.nickname, isGuest: identity.isGuest })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AuthIdentity> {
  const { payload } = await jwtVerify(token, secret)
  if (!payload.sub || typeof payload.nickname !== 'string') throw new Error('Invalid access token')
  return { userId: payload.sub, nickname: payload.nickname, isGuest: Boolean(payload.isGuest) }
}

export function createRefreshToken() {
  return randomBytes(32).toString('base64url')
}

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
