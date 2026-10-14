import type { MapConfig, MapId, MapObstacle } from './types.js'

const line = (
  prefix: string,
  kind: MapObstacle['kind'],
  x: number,
  y: number,
  count: number,
  stepX: number,
  stepY: number,
  width: number,
  height: number,
  destructible = false,
): MapObstacle[] => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`,
  kind,
  x: x + index * stepX,
  y: y + index * stepY,
  width,
  height,
  destructible,
  hp: destructible ? 300 : undefined,
}))

const BASE_MAPS: Record<MapId, MapConfig> = {
  railworks: {
    id: 'railworks', name: 'Railworks District', kicker: 'Sector 07',
    description: 'Relslar, zanglagan vagonlar va tor ombor yo‘laklari.', palette: [0x1f3028, 0x35483b, 0xd49b37],
    spawnAzure: [[420, 1840], [520, 2048], [420, 2250], [720, 1700]],
    spawnEmber: [[3670, 1840], [3570, 2048], [3670, 2250], [3370, 2400]],
    baseAzure: [460, 2048], baseEmber: [3636, 2048],
    obstacles: [
      { id: 'warehouse-a', kind: 'warehouse', x: 1200, y: 740, width: 620, height: 360 },
      { id: 'warehouse-b', kind: 'warehouse', x: 2270, y: 3020, width: 680, height: 380 },
      { id: 'train-a', kind: 'train', x: 1960, y: 1430, width: 760, height: 150 },
      { id: 'train-b', kind: 'train', x: 2150, y: 2500, width: 760, height: 150 },
      ...line('rail-wall-a', 'wall', 980, 1850, 5, 180, 0, 130, 44, true),
      ...line('rail-wall-b', 'wall', 2410, 2220, 5, 180, 0, 130, 44, true),
      ...line('rail-crate', 'crate', 1550, 1030, 5, 120, 70, 70, 70, true),
      { id: 'fuel-a', kind: 'barrel', x: 1780, y: 1900, width: 52, height: 52, destructible: true, explosive: true, hp: 100 },
      { id: 'fuel-b', kind: 'barrel', x: 2340, y: 2140, width: 52, height: 52, destructible: true, explosive: true, hp: 100 },
      { id: 'wreck-a', kind: 'car', x: 940, y: 2800, width: 150, height: 82 },
      { id: 'wreck-b', kind: 'car', x: 3050, y: 1170, width: 150, height: 82 },
    ],
  },
  green_ruins: {
    id: 'green_ruins', name: 'Green Ruins', kicker: 'Overgrown town',
    description: 'O‘simlik bosgan uylar, butalar va buzilgan shahar devorlari.', palette: [0x263c2a, 0x466747, 0x9fcf52],
    spawnAzure: [[520, 620], [720, 520], [460, 850], [820, 820]],
    spawnEmber: [[3570, 3470], [3370, 3570], [3630, 3240], [3270, 3270]],
    baseAzure: [600, 650], baseEmber: [3496, 3446],
    obstacles: [
      { id: 'house-a', kind: 'house', x: 1040, y: 1160, width: 420, height: 360 },
      { id: 'house-b', kind: 'house', x: 2640, y: 900, width: 440, height: 330 },
      { id: 'house-c', kind: 'house', x: 2280, y: 2820, width: 500, height: 360 },
      ...line('green-tree-a', 'tree', 700, 2300, 7, 150, 120, 90, 90),
      ...line('green-wall-a', 'wall', 1450, 1980, 7, 170, 0, 130, 45, true),
      ...line('green-wall-b', 'wall', 2050, 1480, 5, 0, 160, 45, 120, true),
      { id: 'toilet-a', kind: 'toilet', x: 1540, y: 920, width: 75, height: 75, destructible: true, hp: 180 },
      { id: 'toilet-b', kind: 'toilet', x: 3100, y: 2500, width: 75, height: 75, destructible: true, hp: 180 },
      { id: 'rock-a', kind: 'rock', x: 1850, y: 2450, width: 250, height: 180 },
      { id: 'rock-b', kind: 'rock', x: 2470, y: 1780, width: 210, height: 170 },
    ],
  },
  sunflare_depot: {
    id: 'sunflare_depot', name: 'Sunflare Depot', kicker: 'Desert command',
    description: 'Quyoshli harbiy baza, konteyner labirinti va yonilg‘i zonasi.', palette: [0x3d3528, 0x6a5b3f, 0xffb13b],
    spawnAzure: [[520, 1800], [520, 2050], [520, 2300], [650, 2050]],
    spawnEmber: [[3570, 1800], [3570, 2050], [3570, 2300], [3420, 2050]],
    baseAzure: [520, 2050], baseEmber: [3570, 2050],
    obstacles: [
      { id: 'command', kind: 'warehouse', x: 1820, y: 1740, width: 470, height: 560 },
      ...line('container-a', 'container', 1040, 900, 6, 210, 0, 170, 85),
      ...line('container-b', 'container', 2060, 3060, 6, 210, 0, 170, 85),
      ...line('depot-crate-a', 'crate', 1260, 2520, 6, 110, 80, 70, 70, true),
      ...line('depot-wall-a', 'wall', 800, 1520, 5, 0, 160, 45, 120, true),
      ...line('depot-wall-b', 'wall', 3250, 1520, 5, 0, 160, 45, 120, true),
      { id: 'fuel-a', kind: 'barrel', x: 1700, y: 2700, width: 52, height: 52, destructible: true, explosive: true, hp: 100 },
      { id: 'fuel-b', kind: 'barrel', x: 1820, y: 2780, width: 52, height: 52, destructible: true, explosive: true, hp: 100 },
      { id: 'fuel-c', kind: 'barrel', x: 2900, y: 1300, width: 52, height: 52, destructible: true, explosive: true, hp: 100 },
      { id: 'rock-a', kind: 'rock', x: 1100, y: 3300, width: 240, height: 180 },
      { id: 'rock-b', kind: 'rock', x: 3000, y: 650, width: 230, height: 170 },
    ],
  },
}

// The first prototype used a compact 4096-unit arena. Keep the authored layout,
// but scale it into a broader battlefield so flanking routes and long-range tanks
// have room to matter without duplicating the hand-authored landmarks.
const BATTLEFIELD_SCALE = 1.5
const scalePoint = (point: readonly [number, number]): [number, number] => [
  point[0] * BATTLEFIELD_SCALE,
  point[1] * BATTLEFIELD_SCALE,
]

export const MAPS: Record<MapId, MapConfig> = Object.fromEntries(
  Object.entries(BASE_MAPS).map(([id, map]) => [id, {
    ...map,
    spawnAzure: map.spawnAzure.map(scalePoint),
    spawnEmber: map.spawnEmber.map(scalePoint),
    baseAzure: scalePoint(map.baseAzure),
    baseEmber: scalePoint(map.baseEmber),
    obstacles: map.obstacles.map((obstacle) => ({
      ...obstacle,
      x: obstacle.x * BATTLEFIELD_SCALE,
      y: obstacle.y * BATTLEFIELD_SCALE,
      width: obstacle.width * BATTLEFIELD_SCALE,
      height: obstacle.height * BATTLEFIELD_SCALE,
    })),
  }]),
) as unknown as Record<MapId, MapConfig>

export const MAP_LIST = Object.values(MAPS)

// Authored base camps and deterministic cover clusters. These are shared with
// the authoritative collision code, never client-only invisible barriers.
for (const map of MAP_LIST) {
  const obstacles = [...map.obstacles]
  map.obstacles = obstacles
  const safe = (x: number, y: number, w: number, h: number) =>
    [...map.spawnAzure, ...map.spawnEmber].every(([sx, sy]) => Math.hypot(x - sx, y - sy) > Math.max(w, h) / 2 + 180) &&
    [map.baseAzure, map.baseEmber].every(([sx, sy]) => Math.hypot(x - sx, y - sy) > Math.max(w, h) / 2 + 320) &&
    obstacles.every(o => Math.abs(o.x - x) > (o.width + w) / 2 + 95 || Math.abs(o.y - y) > (o.height + h) / 2 + 95)
  for (const [baseIndex, [bx, by]] of [map.baseAzure, map.baseEmber].entries()) {
    const camp: [MapObstacle['kind'], number, number, number, number][] = [
      ['house', 0, -540, 230, 170], ['car', 340, -300, 130, 66],
      ['crate', -310, -330, 72, 72], ['crate', -410, -330, 60, 60],
      ['barrel', 320, 360, 44, 44], ['toilet', -340, 380, 65, 65],
      ['wall', 80, 440, 230, 34], ['tree', -420, -120, 95, 95],
    ]
    for (const [i, [kind, dx, dy, width, height]] of camp.entries()) {
      const x = bx + dx, y = by + dy
      if (safe(x, y, width, height)) obstacles.push({ id: `camp-${baseIndex}-${i}`, kind, x, y, width, height, destructible: ['crate', 'barrel', 'wall', 'toilet'].includes(kind), hp: 240 })
    }
  }
  let seed = 9173
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  for (let i = 0; i < 260; i++) {
    const x = 180 + random() * 5784, y = 180 + random() * 5784
    const kinds: MapObstacle['kind'][] = map.id === 'green_ruins' ? ['tree', 'tree', 'house', 'wall', 'rock', 'crate'] : map.id === 'sunflare_depot' ? ['rock', 'crate', 'barrel', 'car', 'container', 'wall'] : ['tree', 'crate', 'car', 'wall', 'barrel', 'rock']
    const kind = kinds[i % kinds.length]!
    const width = kind === 'house' ? 230 : kind === 'container' ? 185 : kind === 'car' ? 135 : kind === 'wall' ? 170 : kind === 'barrel' ? 44 : 70 + random() * 50
    const height = kind === 'house' ? 185 : kind === 'wall' ? 35 : kind === 'car' || kind === 'container' ? 75 : width
    // Keep the two broad central crossing lanes open.
    if (Math.abs(x - 3072) < 290 || Math.abs(y - 3072) < 190 || !safe(x, y, width, height)) continue
    obstacles.push({ id: `cover-${i}`, kind, x, y, width, height, destructible: ['crate', 'wall', 'barrel'].includes(kind), explosive: kind === 'barrel', hp: kind === 'barrel' ? 120 : 300 })
  }
}
