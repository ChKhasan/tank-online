import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const token = (exp: number) => `header.${btoa(JSON.stringify({ exp }))}.signature`
beforeEach(() => { vi.resetModules(); localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe('access token renewal before room join', () => {
  it('reuses a fresh token without network traffic', async () => {
    const valid = token(Date.now() / 1000 + 900)
    localStorage.setItem('tank_access_token', valid)
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const { authService } = await import('./auth.service')
    expect(await authService.ensureFreshToken()).toBe(valid)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('refreshes an expired token once for simultaneous joins', async () => {
    localStorage.setItem('tank_access_token', token(1))
    const renewed = token(Date.now() / 1000 + 900)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ accessToken: renewed, profile: { nickname: 'Tester' } }) })
    vi.stubGlobal('fetch', fetchMock)
    const { authService } = await import('./auth.service')
    expect(await Promise.all([authService.ensureFreshToken(), authService.ensureFreshToken()])).toEqual([renewed, renewed])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1].credentials).toBe('include')
  })
  it('signals reauthentication when the refresh session is gone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Expired' }) }))
    const { authService, SessionExpiredError } = await import('./auth.service')
    await expect(authService.ensureFreshToken()).rejects.toBeInstanceOf(SessionExpiredError)
  })
})
