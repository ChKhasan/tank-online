export class NetworkClock {
  rtt = 0
  private offset: number | null = null
  private bestRtt = Infinity
  observe(sentAt: number, receivedAt: number, serverTime: number) {
    const rtt = receivedAt - sentAt
    if (!Number.isFinite(rtt) || !Number.isFinite(serverTime) || rtt < 0 || rtt > 5000) return
    this.rtt = Math.round(rtt)
    // Low-latency samples give the least biased estimate of clock offset.
    if (rtt <= this.bestRtt + 10) {
      this.offset = serverTime - (sentAt + receivedAt) / 2
      this.bestRtt = Math.min(this.bestRtt, rtt)
    }
  }
  localTime(serverTime: number, receivedAt: number) {
    if (this.offset === null || !serverTime) return receivedAt
    return Math.min(receivedAt, Math.max(receivedAt - 1000, serverTime - this.offset))
  }
  reset() { this.offset = null; this.rtt = 0; this.bestRtt = Infinity }
}
