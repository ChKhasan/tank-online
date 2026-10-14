import Phaser from 'phaser'
import { WORLD_SIZE, type MapConfig } from '@tank-online/shared'

export function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296 }
}

/** Baked world-space terrain. Adjacent chunks sample identical noise fields:
 * no checkerboard seams, no per-frame pixel work, ~36 MB at full map size. */
export function drawTerrain(scene: Phaser.Scene, map: MapConfig) {
  const random = seededRandom(412)
  const field = Float32Array.from({ length: 130 * 130 }, random)
  const noise = (x: number, y: number, size: number) => {
    const gx = x / size, gy = y / size, ix = Math.floor(gx), iy = Math.floor(gy)
    const sx = gx - ix, sy = gy - iy, u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy)
    const a = field[iy * 130 + ix]!, b = field[iy * 130 + ix + 1]!
    const c = field[(iy + 1) * 130 + ix]!, d = field[(iy + 1) * 130 + ix + 1]!
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v
  }
  const desert = map.id === 'sunflare_depot'
  const soil = desert ? [157, 133, 95] : [121, 111, 87]
  const grass = desert ? [124, 119, 75] : [78, 88, 55]
  const [ax, ay] = map.baseAzure, [bx, by] = map.baseEmber
  for (let cy = 0; cy < WORLD_SIZE; cy += 1024) for (let cx = 0; cx < WORLD_SIZE; cx += 1024) {
    const key = `terrain-${map.id}-${cx}-${cy}`
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, 512, 512)!
      const ctx = texture.context, pixels = ctx.createImageData(512, 512)
      for (let py = 0; py < 512; py++) for (let px = 0; px < 512; px++) {
        const x = cx + px * 2, y = cy + py * 2
        const broad = noise(x, y, 320), fine = noise(x, y, 64)
        const t = Phaser.Math.Clamp((x - ax) / (bx - ax), 0, 1)
        const roadY = ay + (by - ay) * t + Math.sin(t * Math.PI * 4) * 115
        const dist = Math.abs(y - roadY)
        const cross = Math.abs(x - (3072 + Math.sin(y / 650) * 180))
        const road = 1 - Phaser.Math.Clamp((Math.min(dist, cross) - 90 + fine * 40) / 100, 0, 1)
        const moss = Phaser.Math.Clamp((broad - (desert ? 0.57 : 0.39)) * 2.6, 0, 0.9) * (1 - road)
        const grain = random() * 16 - 8 + (fine - 0.5) * 20
        const rut = road * (Math.abs(dist - 54) < 9 || Math.abs(dist - 16) < 8 ? -17 : 6)
        const i = (py * 512 + px) * 4
        for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = soil[channel]! * (1 - moss) + grass[channel]! * moss + grain + rut
        pixels.data[i + 3] = 255
      }
      ctx.putImageData(pixels, 0, 0); texture.refresh()
    }
    scene.add.image(cx, cy, key).setOrigin(0).setScale(2).setDepth(-1000)
  }
  // Draw small static details directly into the existing terrain chunks.
  // Keeping thousands of Graphics ellipse commands alive costs CPU every frame.
  const g = new TerrainPainter(scene, map.id)
  // Shell craters, displaced earth, puddles and shattered masonry.
  for (let variant = 0; variant < 6; variant++) {
    const key = `crater-${variant}`
    if (scene.textures.exists(key)) continue
    const texture = scene.textures.createCanvas(key, 256, 256)!
    const ctx = texture.context, detail = seededRandom(variant * 19 + 47)
    ctx.translate(128, 128); ctx.scale(1, 0.85)
    const halo = ctx.createRadialGradient(0, 0, 25, 0, 0, 120)
    halo.addColorStop(0, '#352e23bb'); halo.addColorStop(0.6, '#493e2c66'); halo.addColorStop(1, '#493e2c00')
    ctx.fillStyle = halo; ctx.fillRect(-128, -145, 256, 290)
    ctx.beginPath()
    for (let j = 0; j <= 64; j++) {
      const angle = j / 64 * Math.PI * 2, r = 66 + detail() * 15
      if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
    }
    ctx.closePath()
    const hollow = ctx.createRadialGradient(7, -17, 6, 0, 0, 84)
    hollow.addColorStop(0, '#302c23ef'); hollow.addColorStop(0.48, '#494134eb'); hollow.addColorStop(0.8, '#766348d9'); hollow.addColorStop(1, '#b29c7060')
    ctx.fillStyle = hollow; ctx.fill()
    for (let j = 0; j < 240; j++) {
      const angle = detail() * Math.PI * 2, r = 55 + detail() * 46
      ctx.fillStyle = j % 3 ? '#c1aa773d' : '#2e2b2359'
      ctx.fillRect(Math.cos(angle) * r, Math.sin(angle) * r, 1 + detail() * 5, 1 + detail() * 3)
    }
    texture.refresh()
  }
  for (let i = 0; i < 260; i++) {
    const x = random() * WORLD_SIZE, y = random() * WORLD_SIZE, r = 18 + random() * 48
    scene.add.image(x, y, `crater-${i % 6}`).setDisplaySize(r * 4, r * 3.6).setRotation(random()).setDepth(-940).setAlpha(0.85)
    for (let j = 0; j < 8; j++) {
      const angle = random() * Math.PI * 2, d = r * (1 + random())
      g.fillStyle(j % 2 ? 0xc2b59a : 0x746851, 0.75)
      g.fillRect(x + Math.cos(angle) * d, y + Math.sin(angle) * d, 3 + random() * 7, 2 + random() * 5)
    }
  }
  for (let i = 0; i < 7200; i++) {
    const x = random() * WORLD_SIZE, y = random() * WORLD_SIZE
    g.fillStyle(i % 3 ? 0xd0c3a1 : 0x514b3a, 0.3)
    g.fillEllipse(x, y, 2 + random() * 7, 2 + random() * 4)
    if (i % 8 === 0) {
      g.lineStyle(2, desert ? 0x8e8958 : 0x606e40, 0.7)
      for (let j = 0; j < 4; j++) g.lineBetween(x + j * 4, y, x - 3 + j * 6, y - 8 - random() * 12)
    }
  }
  // Railway sleepers sit below rails; tracks align with the actual train cars.
  if (map.id === 'railworks') for (const train of map.obstacles.filter(o => o.kind === 'train')) {
    g.fillStyle(0x8b8777, 0.6); g.fillRect(0, train.y - 127, WORLD_SIZE, 254)
    for (let x = 0; x < WORLD_SIZE; x += 40) {
      g.fillStyle(0x514333, 1); g.fillRect(x, train.y - 103, 14, 206)
      g.fillStyle(0x9b8769, 0.5); g.fillRect(x, train.y - 103, 3, 206)
    }
    for (const side of [-1, 1]) {
      g.lineStyle(9, 0x3d3c35); g.lineBetween(0, train.y + side * 74, WORLD_SIZE, train.y + side * 74)
      g.lineStyle(3, 0xc4bfa9); g.lineBetween(0, train.y + side * 74 - 2, WORLD_SIZE, train.y + side * 74 - 2)
    }
  }
  g.refresh()
}

class TerrainPainter {
  private fill = '#000'
  private stroke = '#000'
  private width = 1
  constructor(private scene: Phaser.Scene, private mapId: string) {}
  fillStyle(color: number, alpha = 1) { this.fill = this.color(color, alpha); return this }
  lineStyle(width: number, color: number, alpha = 1) { this.width = width; this.stroke = this.color(color, alpha); return this }
  private color(color: number, alpha: number) { return `rgba(${color >> 16 & 255},${color >> 8 & 255},${color & 255},${alpha})` }
  private paint(x: number, y: number, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const left = Math.max(0, Math.floor(x / 1024)), top = Math.max(0, Math.floor(y / 1024))
    const right = Math.min(5, Math.floor((x + w) / 1024)), bottom = Math.min(5, Math.floor((y + h) / 1024))
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const texture = this.scene.textures.get(`terrain-${this.mapId}-${col * 1024}-${row * 1024}`) as Phaser.Textures.CanvasTexture
      const ctx = texture.context
      ctx.save(); ctx.setTransform(0.5, 0, 0, 0.5, -col * 512, -row * 512)
      ctx.fillStyle = this.fill; ctx.strokeStyle = this.stroke; ctx.lineWidth = this.width
      draw(ctx); ctx.restore()
    }
  }
  fillRect(x: number, y: number, w: number, h: number) { this.paint(x, y, w, h, ctx => ctx.fillRect(x, y, w, h)) }
  fillEllipse(x: number, y: number, w: number, h: number) {
    this.paint(x - w / 2, y - h / 2, w, h, ctx => { ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill() })
  }
  lineBetween(x: number, y: number, bx: number, by: number) {
    this.paint(Math.min(x, bx) - this.width, Math.min(y, by) - this.width, Math.abs(bx - x) + this.width * 2, Math.abs(by - y) + this.width * 2, ctx => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.stroke() })
  }
  refresh() {
    for (let y = 0; y < WORLD_SIZE; y += 1024) for (let x = 0; x < WORLD_SIZE; x += 1024) (this.scene.textures.get(`terrain-${this.mapId}-${x}-${y}`) as Phaser.Textures.CanvasTexture).refresh()
  }
}
