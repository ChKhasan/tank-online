// A relative endpoint keeps HTTP and WebSocket traffic on the browser's origin.
export function resolveServerUrl(configured: string | undefined, pageUrl?: string): string {
  const page = new URL(pageUrl ?? 'http://localhost:5173')
  if (configured?.trim()) return new URL(configured.trim(), page.origin).href.replace(/\/$/, '')
  page.port = '2567'
  return page.origin
}
