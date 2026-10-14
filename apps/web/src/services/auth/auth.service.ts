import type { AuthResponse, PublicProfile, TankId } from '@tank-online/shared'
import { resolveServerUrl } from '../../shared/config/server-url'

const SERVER_URL = resolveServerUrl(import.meta.env.VITE_SERVER_URL, typeof window === 'undefined' ? undefined : window.location.href)

export class SessionExpiredError extends Error {}

class AuthService {
  private accessToken = localStorage.getItem('tank_access_token') ?? ''
  private pendingRefresh: Promise<AuthResponse> | null = null

  get token() {
    return this.accessToken
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${SERVER_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        ...init.headers,
      },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Server bilan aloqa xatosi.' }))
      if (response.status === 401) throw new SessionExpiredError('Sessiya tugagan. Iltimos, qayta kiring.')
      throw new Error(error.message ?? 'So‘rov bajarilmadi.')
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }

  private accept(auth: AuthResponse) {
    this.accessToken = auth.accessToken
    localStorage.setItem('tank_access_token', auth.accessToken)
    localStorage.setItem('tank_profile', JSON.stringify(auth.profile))
    return auth
  }

  guest(nickname: string) {
    return this.request<AuthResponse>('/api/auth/guest', { method: 'POST', body: JSON.stringify({ nickname }) }).then((auth) => this.accept(auth))
  }

  login(email: string, password: string) {
    return this.request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }).then((auth) => this.accept(auth))
  }

  register(email: string, password: string, nickname: string) {
    return this.request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, nickname }) }).then((auth) => this.accept(auth))
  }

  async refresh() {
    if (!this.pendingRefresh) {
      this.pendingRefresh = this.request<AuthResponse>('/api/auth/refresh', { method: 'POST' })
        .then((auth) => this.accept(auth)).finally(() => { this.pendingRefresh = null })
    }
    return this.pendingRefresh
  }

  async ensureFreshToken() {
    // This only schedules renewal. Signature and expiry validation remain on
    // the server; a decoded client claim never grants access.
    let expiresAt = 0
    try {
      const payload = this.accessToken.split('.')[1]!
      expiresAt = Number(JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).exp) * 1000
    } catch { /* Missing/malformed tokens require a valid refresh session. */ }
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now() + 60_000) await this.refresh()
    return this.accessToken
  }

  profile() {
    return this.request<PublicProfile>('/api/profile/me')
  }

  updateProfile(patch: { nickname?: string; favoriteTank?: TankId }) {
    return this.request<PublicProfile>('/api/profile/me', { method: 'PATCH', body: JSON.stringify(patch) })
  }

  async logout() {
    await this.request<void>('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    this.accessToken = ''
    localStorage.removeItem('tank_access_token')
    localStorage.removeItem('tank_profile')
  }

  restoreProfile(): PublicProfile | null {
    try {
      return JSON.parse(localStorage.getItem('tank_profile') ?? 'null') as PublicProfile | null
    } catch {
      return null
    }
  }
}

export const authService = new AuthService()
export { SERVER_URL }
