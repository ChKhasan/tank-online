import { describe, expect, it } from 'vitest'
import { resolveServerUrl } from './server-url'

describe('server URL', () => {
  it('preserves direct development connections', () => {
    expect(resolveServerUrl(undefined, 'http://172.16.16.33:5173/')).toBe('http://172.16.16.33:2567')
  })
  it('uses the current LAN host and Docker port for the proxy', () => {
    expect(resolveServerUrl('/backend', 'http://172.16.16.33:8080/garage')).toBe('http://172.16.16.33:8080/backend')
  })
  it('preserves HTTPS for secure WebSocket connections', () => {
    expect(resolveServerUrl('/backend', 'https://tank.example/')).toBe('https://tank.example/backend')
  })
  it('supports an explicit external server', () => {
    expect(resolveServerUrl('https://game.example/', 'https://tank.example/')).toBe('https://game.example')
  })
  it('supports node-side imports without window', () => {
    expect(resolveServerUrl(undefined)).toBe('http://localhost:2567')
  })
})
