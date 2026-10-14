import type { TankId } from '@tank-online/shared'

// Shared, original top-down vehicle artwork: the garage and battlefield use
// these same two layers, so hull and gun can rotate independently in combat.
export const VEHICLE_ART: Record<TankId, { length: number; width: number; gun: number; color: string; turret: 'round' | 'square' | 'wedge' }> = {
  scout: { length: 68, width: 43, gun: 39, color: '#8b8a60', turret: 'round' },
  assault: { length: 88, width: 60, gun: 57, color: '#747d58', turret: 'round' },
  heavy: { length: 108, width: 79, gun: 65, color: '#958367', turret: 'square' },
  sniper: { length: 90, width: 49, gun: 91, color: '#a29c7c', turret: 'wedge' },
  artillery: { length: 104, width: 66, gun: 71, color: '#807056', turret: 'square' },
  destroyer: { length: 98, width: 69, gun: 78, color: '#777f70', turret: 'wedge' },
  engineer: { length: 88, width: 65, gun: 36, color: '#ad9160', turret: 'square' },
  support: { length: 98, width: 63, gun: 41, color: '#80907c', turret: 'round' },
  flame: { length: 86, width: 70, gun: 45, color: '#9e7655', turret: 'round' },
  shock: { length: 91, width: 73, gun: 51, color: '#7d8587', turret: 'square' },
}

export function paintTank(ctx: CanvasRenderingContext2D, id: TankId, layer: 'body' | 'turret', team = '#b8cad0') {
  const spec = VEHICLE_ART[id]
  const l = spec.length, w = spec.width
  const rect = (x: number, y: number, width: number, height: number, fill: string, stroke = '#302f26') => {
    ctx.fillStyle = fill; ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, width, height)
  }
  const circle = (x: number, y: number, r: number, fill: string) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill()
    ctx.strokeStyle = '#34382d'; ctx.lineWidth = 2; ctx.stroke()
  }
  const poly = (points: number[][], fill: string) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x!, y!) : ctx.moveTo(x!, y!)); ctx.closePath()
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#34362a'; ctx.lineWidth = 2; ctx.stroke()
  }
  ctx.save()
  if (layer === 'body') {
    // Individually drawn steel tread links, worn edges and wheel hubs.
    for (const side of [-1, 1]) {
      const y = side * (w / 2 - 7)
      rect(-l / 2 - 3, y - 9, l + 6, 18, '#292c27')
      for (let x = -l / 2; x < l / 2; x += 6) {
        rect(x, y - 8, 3, 16, '#595a4d')
        ctx.fillStyle = '#93917b'; ctx.fillRect(x, y + side * 6, 3, 1)
      }
    }
    poly([[-l / 2 + 3, -w / 2 + 11], [l / 2 - 11, -w / 2 + 10], [l / 2 + 1, -w / 2 + 20], [l / 2 + 1, w / 2 - 20], [l / 2 - 11, w / 2 - 10], [-l / 2 + 3, w / 2 - 11]], spec.color)
    ctx.fillStyle = '#d8c59733'; ctx.fillRect(-l / 2 + 6, -w / 2 + 13, l - 23, 4)
    rect(-l / 2 + 8, -w / 2 + 18, 18, w - 36, '#444b3b')
    for (let x = -l / 2 + 11; x < -l / 2 + 24; x += 4) rect(x, -w / 2 + 20, 1, w - 40, '#a29c7a')
    // Camouflage bands are irregular and differ by chassis.
    poly([[-20, -w / 2 + 12], [-4, -w / 2 + 12], [16, w / 2 - 12], [1, w / 2 - 12]], '#454d3c66')
    for (const side of [-1, 1]) {
      rect(l / 2 - 12, side * (w / 2 - 17) - 3, 6, 6, '#e1d8ae')
      for (let x = -l / 2 + 6; x < l / 2 - 8; x += 12) circle(x, side * (w / 2 - 12), 1.4, '#c7bd92')
    }
    rect(-4, -w / 2 + 11, 7, 8, team)
    if (id === 'heavy') for (const side of [-1, 1]) rect(-l / 2 + 3, side * (w / 2 - 9) - 5, l - 4, 10, '#9b8d6e')
    if (id === 'engineer') {
      rect(36, -27, 12, 54, '#555343'); poly([[43, -40], [54, -36], [54, 36], [43, 40]], '#bfac77')
      rect(-43, -22, 18, 16, '#664a31'); rect(-43, 6, 18, 16, '#664a31')
    }
    if (id === 'flame') for (const side of [-1, 1]) { rect(-38, side * 20 - 7, 34, 14, '#704932'); rect(-28, side * 20 - 7, 3, 14, '#c1ac84') }
    if (id === 'support') { rect(-37, -20, 30, 40, '#b9b296'); rect(-31, -3, 18, 6, '#666f47'); rect(-25, -9, 6, 18, '#666f47') }
    if (id === 'artillery') { rect(-37, -21, 49, 42, '#332f25'); for (let i = 0; i < 5; i++) rect(-33 + i * 8, -18, 5, 14, '#b0a070') }
    if (id === 'shock') for (const side of [-1, 1]) rect(-39, side * 24 - 4, 39, 8, '#bdbaa5')
    if (id === 'scout') { ctx.strokeStyle = '#b5b795'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-21, -12); ctx.lineTo(-48, -33); ctx.stroke() }
    // Local scratches, not a flat fill.
    for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 2 ? '#ded1a54a' : '#252d2855'; ctx.fillRect((i * 17 % (l - 22)) - l / 2 + 9, (i * 11 % (w - 26)) - w / 2 + 13, 3, 1) }
  } else {
    const r = id === 'heavy' ? 25 : id === 'scout' ? 14 : 20
    circle(-2, 2, r + 3, '#292d2588')
    rect(5, -5, spec.gun - 5, 10, '#4e5345')
    rect(17, -4, spec.gun - 19, 2, '#b0ad88')
    rect(spec.gun - 8, -7, 12, 14, id === 'flame' ? '#6d3d25' : '#3b4036')
    if (id === 'shock') rect(10, 10, 39, 7, '#596258')
    if (spec.turret === 'round') circle(-1, 0, r, spec.color)
    else if (spec.turret === 'wedge') poly([[-24, -20], [11, -14], [26, -7], [26, 7], [11, 14], [-24, 20]], spec.color)
    else { rect(-r, -r + 3, r * 1.7, r * 2 - 6, spec.color); rect(8, -13, 15, 26, '#87866b') }
    circle(-7, -3, r * 0.4, '#515b45'); circle(-7, -3, r * 0.24, '#889071')
    ctx.strokeStyle = '#c5bc9266'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r + 3, -r + 7); ctx.lineTo(6, -r + 7); ctx.stroke()
    rect(-8, r - 8, 15, 4, team)
    if (id === 'sniper') { rect(-17, -20, 16, 5, '#545c43'); ctx.fillStyle = '#939777'; for (let i = 0; i < 7; i++) ctx.fillRect(i * 7, -8, 3, 16) }
    if (id === 'artillery') { rect(-20, -15, 36, 30, '#626c52'); rect(-5, -7, 46, 14, '#8d9271') }
    if (id === 'engineer') { rect(-7, -5, 37, 8, '#b19c64'); rect(25, -4, 6, 19, '#4b4e3e') }
  }
  ctx.restore()
}
