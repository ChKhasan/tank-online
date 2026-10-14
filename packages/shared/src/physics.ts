import type { MapObstacle } from './types.js'

export const WORLD_SIZE = 6144
export const TANK_RADIUS = 34

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeVector(x: number, y: number) {
  const length = Math.hypot(x, y)
  if (length <= 1) return { x, y }
  return { x: x / length, y: y / length }
}

export function circleIntersectsRect(
  x: number,
  y: number,
  radius: number,
  obstacle: Pick<MapObstacle, 'x' | 'y' | 'width' | 'height'>,
) {
  const closestX = clamp(x, obstacle.x - obstacle.width / 2, obstacle.x + obstacle.width / 2)
  const closestY = clamp(y, obstacle.y - obstacle.height / 2, obstacle.y + obstacle.height / 2)
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2
}

export function canMoveTo(x: number, y: number, obstacles: readonly MapObstacle[]) {
  if (x < TANK_RADIUS || y < TANK_RADIUS || x > WORLD_SIZE - TANK_RADIUS || y > WORLD_SIZE - TANK_RADIUS) return false
  return !obstacles.some((obstacle) => circleIntersectsRect(x, y, TANK_RADIUS, obstacle))
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  return (ax - bx) ** 2 + (ay - by) ** 2
}

/** Shared collision integration for server simulation and client prediction.
 * Small substeps prevent fast vehicles crossing thin walls between frames. */
export function advanceTank(position: { x: number; y: number }, moveX: number, moveY: number, speed: number, seconds: number, obstacles: readonly MapObstacle[]) {
  const direction = normalizeVector(moveX, moveY)
  const steps = Math.max(1, Math.ceil(seconds * 60))
  const dx = direction.x * speed * seconds / steps, dy = direction.y * speed * seconds / steps
  let { x, y } = position
  for (let i = 0; i < steps; i++) {
    if (canMoveTo(x + dx, y, obstacles)) x += dx
    if (canMoveTo(x, y + dy, obstacles)) y += dy
  }
  return { x, y }
}
