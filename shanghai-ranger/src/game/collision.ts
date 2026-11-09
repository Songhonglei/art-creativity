import type { Point } from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

export interface CircleCollider extends Point { radius: number; minY?: number; maxY?: number }
export interface BoxCollider extends Point { halfWidth: number; halfDepth: number; minY?: number; maxY?: number }

export function rotatedBoxBounds(halfWidth: number, halfDepth: number, rotation: number) {
  const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
  return { halfWidth: c * halfWidth + s * halfDepth, halfDepth: s * halfWidth + c * halfDepth };
}

const point = (x: number, z: number): Point => ({ x, z });

/** Resolve a moving circle against round props and the actual rectangular building footprints. */
export function resolveCircle(position: Point, radius: number, circles: CircleCollider[], boxes: BoxCollider[]): Point {
  const result = point(position.x, position.z);
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const obstacle of circles) {
      const dx = result.x - obstacle.x, dz = result.z - obstacle.z, d = Math.hypot(dx, dz), minimum = obstacle.radius + radius;
      if (d < minimum - 1e-7) {
        const nx = d > 1e-5 ? dx / d : 0, nz = d > 1e-5 ? dz / d : 1;
        result.x = obstacle.x + nx * minimum; result.z = obstacle.z + nz * minimum; changed = true;
      }
    }
    for (const obstacle of boxes) {
      const left = obstacle.x - obstacle.halfWidth, right = obstacle.x + obstacle.halfWidth;
      const near = obstacle.z - obstacle.halfDepth, far = obstacle.z + obstacle.halfDepth;
      const closestX = clamp(result.x, left, right), closestZ = clamp(result.z, near, far);
      const dx = result.x - closestX, dz = result.z - closestZ, d = Math.hypot(dx, dz);
      if (d > 1e-7 && d < radius) {
        result.x = closestX + dx / d * radius; result.z = closestZ + dz / d * radius; changed = true;
      } else if (d <= 1e-7 && result.x >= left && result.x <= right && result.z >= near && result.z <= far) {
        const exits = [
          { gap: result.x - left, axis: 'x' as const, value: left - radius },
          { gap: right - result.x, axis: 'x' as const, value: right + radius },
          { gap: result.z - near, axis: 'z' as const, value: near - radius },
          { gap: far - result.z, axis: 'z' as const, value: far + radius },
        ].sort((a, b) => a.gap - b.gap);
        const exit = exits[0]; result[exit.axis] = exit.value; changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}

/** Substepped movement prevents a dodge or a long visual frame from tunnelling through a wall. */
export function moveCircle(position: Point, delta: Point, radius: number, circles: CircleCollider[], boxes: BoxCollider[]): Point {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / .18));
  let result = point(position.x, position.z);
  for (let i = 0; i < steps; i++) {
    result.x += delta.x / steps; result.z += delta.z / steps;
    result = resolveCircle(result, radius, circles, boxes);
  }
  return result;
}

export function segmentHitsBox(from: Point, to: Point, box: BoxCollider, padding: number) {
  const minX = box.x - box.halfWidth - padding, maxX = box.x + box.halfWidth + padding;
  const minZ = box.z - box.halfDepth - padding, maxZ = box.z + box.halfDepth + padding;
  const dx = to.x - from.x, dz = to.z - from.z;
  let enter = 0, exit = 1;
  for (const [origin, delta, min, max] of [[from.x, dx, minX, maxX], [from.z, dz, minZ, maxZ]]) {
    if (Math.abs(delta) < 1e-7) { if (origin < min || origin > max) return false; continue; }
    const a = (min - origin) / delta, b = (max - origin) / delta;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  // Touching the boundary at the start is safe when the segment heads away from it.
  return exit > 1e-7 && enter < 1 - 1e-7;
}

export function hasLineOfSight(from: Point, to: Point, boxes: BoxCollider[], padding = .05) {
  return !boxes.some(box => segmentHitsBox(from, to, box, padding));
}


function pathClear(from: Point, to: Point, circles: CircleCollider[], boxes: BoxCollider[], radius: number) {
  for (const box of boxes) if (segmentHitsBox(from, to, box, radius)) return false;
  for (const circle of circles) {
    const dx = to.x - from.x, dz = to.z - from.z, length2 = dx * dx + dz * dz;
    const t = length2 ? clamp(((circle.x - from.x) * dx + (circle.z - from.z) * dz) / length2, 0, 1) : 0;
    if (Math.hypot(from.x + dx * t - circle.x, from.z + dz * t - circle.z) < circle.radius + radius - 1e-7) return false;
  }
  return true;
}

/** Choose a visible corner when the direct route is blocked, then move with the same wall rules. */
export function followPet(current: Point, player: Point, dt: number, circles: CircleCollider[], boxes: BoxCollider[]): Point {
  const radius = .3, desired = resolveCircle(point(player.x - 2.2, player.z + 1.1), radius, circles, boxes);
  let target = desired;
  if (!pathClear(current, desired, circles, boxes, radius)) {
    const routeBoxes = boxes.filter(box =>
      (Math.abs(box.x - current.x) <= box.halfWidth + 28 && Math.abs(box.z - current.z) <= box.halfDepth + 28) ||
      (Math.abs(box.x - desired.x) <= box.halfWidth + 28 && Math.abs(box.z - desired.z) <= box.halfDepth + 28));
    const routeCircles = circles.filter(circle => distance(circle, current) < 32 + circle.radius || distance(circle, desired) < 32 + circle.radius);
    const corners: Point[] = [];
    for (const box of routeBoxes) {
      const margin = radius + .38;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        corners.push(point(box.x + sx * (box.halfWidth + margin), box.z + sz * (box.halfDepth + margin)));
      }
    }
    // A tiny visibility graph gives a stable multi-corner route instead of oscillating at one corner.
    const nodes = [current, desired, ...corners], costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = nodes.map(() => false);
    costs[0] = 0;
    for (let step = 0; step < nodes.length; step++) {
      let from = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited[i] && (from < 0 || costs[i] < costs[from])) from = i;
      if (from < 0 || !Number.isFinite(costs[from]) || from === 1) break;
      visited[from] = true;
      for (let to = 0; to < nodes.length; to++) {
        if (visited[to] || to === from || !pathClear(nodes[from], nodes[to], routeCircles, routeBoxes, radius)) continue;
        const cost = costs[from] + distance(nodes[from], nodes[to]);
        if (cost < costs[to]) { costs[to] = cost; previous[to] = from; }
      }
    }
    if (previous[1] >= 0) {
      const route: Point[] = []; let at = 1;
      while (at > 0) { route.push(nodes[at]); at = previous[at]; }
      route.reverse();
      while (route.length && distance(current, route[0]) < .08) route.shift();
      if (route.length) target = route[0];
    }
  }
  const far = distance(current, player), speed = far > 12 ? 10 : far > 7 ? 7.5 : 5.4;
  const blend = 1 - Math.exp(-Math.max(0, dt) * 5.2);
  const delta = point((target.x - current.x) * blend, (target.z - current.z) * blend);
  const length = Math.hypot(delta.x, delta.z), maximum = speed * Math.max(0, dt);
  if (length > maximum && length > 0) { delta.x *= maximum / length; delta.z *= maximum / length; }
  return moveCircle(current, delta, radius, circles, boxes);
}
