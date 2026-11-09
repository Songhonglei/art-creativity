import { moveCircle } from './collision';
import type { BoxCollider, CircleCollider } from './collision';
import { DODGE } from './combat';
import type { Point } from './types';

/** Test both rear diagonals with the same swept movement used during the actual step. */
export function chooseDodge(position: Point, facing: number, circles: CircleCollider[], boxes: BoxCollider[], random: () => number = Math.random) {
  const routes = [-1, 1].map(side => {
    const angle = facing + Math.PI - side * .65, x = Math.sin(angle), z = Math.cos(angle);
    let end = { ...position };
    for (let traveled = 0; traveled < DODGE.distance - 1e-6; traveled += .12) {
      const step = Math.min(.12, DODGE.distance - traveled), expected = { x: end.x + x * step, z: end.z + z * step };
      const next = moveCircle(end, { x: x * step, z: z * step }, .34, circles, boxes);
      if (Math.hypot(next.x - expected.x, next.z - expected.z) > .015) break;
      end = next;
    }
    const clearance = Math.max(0, (end.x - position.x) * x + (end.z - position.z) * z);
    return { x, z, side, clearance };
  });
  const best = Math.max(...routes.map(r => r.clearance));
  const candidates = routes.filter(r => r.clearance >= .85 && r.clearance >= best * .7);
  if (!candidates.length) return null;
  const total = candidates.reduce((n, r) => n + r.clearance ** 2, 0);
  let roll = Math.max(0, Math.min(.999999, random())) * total;
  return candidates.find(r => { roll -= r.clearance ** 2; return roll < 0; }) ?? candidates[0];
}
