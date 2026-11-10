import { moveCircle } from './collision';
import type { BoxCollider, CircleCollider } from './collision';
import type { Point } from './types';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** Check the whole corridor, including poles and rounded building corners. */
export function clearPetRoute(a: Point, b: Point, circles: CircleCollider[], boxes: BoxCollider[]) {
  const d = distance(a, b), steps = Math.max(1, Math.ceil(d / .5)); let p = { ...a };
  for (let i = 0; i < steps; i++) {
    const delta = { x: (b.x - a.x) / steps, z: (b.z - a.z) / steps }, next = moveCircle(p, delta, .22, circles, boxes);
    if (Math.hypot(next.x - p.x - delta.x, next.z - p.z - delta.z) > .025) return false;
    p = next;
  }
  return true;
}
/** Bounded local A*: long journeys display a safe first segment, then update as the hero moves. */
export function petRoute(start: Point, target: Point, circles: CircleCollider[], boxes: BoxCollider[]): Point[] {
  const distanceToGoal = distance(start, target), span = Math.min(24, distanceToGoal);
  if (distanceToGoal < .5) return [{ ...target }];
  const goal = { x: start.x + (target.x - start.x) / distanceToGoal * span, z: start.z + (target.z - start.z) / distanceToGoal * span };
  if (clearPetRoute(start, goal, circles, boxes)) return [start, goal];
  const step = 1.5, key = (x: number, z: number) => `${x},${z}`;
  type Node = Point & { gx: number; gz: number; g: number; parent?: Node };
  const first: Node = { ...start, gx: 0, gz: 0, g: 0 }, open: Node[] = [first], best = new Map<string, number>([[key(0, 0), 0]]);
  let closest = first;
  for (let visited = 0; open.length && visited < 1400; visited++) {
    let index = 0;
    for (let i = 1; i < open.length; i++) if (open[i].g + distance(open[i], goal) < open[index].g + distance(open[index], goal)) index = i;
    const node = open.splice(index, 1)[0];
    if (distance(node, goal) < distance(closest, goal)) closest = node;
    if (distance(node, goal) < step * 1.5 && clearPetRoute(node, goal, circles, boxes)) { closest = { ...goal, gx: 0, gz: 0, g: node.g + distance(node, goal), parent: node }; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const gx = node.gx + dx, gz = node.gz + dz;
      if (Math.abs(gx) > 23 || Math.abs(gz) > 23) continue;
      const next = { x: start.x + gx * step, z: start.z + gz * step, gx, gz, g: node.g + Math.hypot(dx, dz) * step, parent: node };
      if ((best.get(key(gx, gz)) ?? Infinity) <= next.g || !clearPetRoute(node, next, circles, boxes)) continue;
      best.set(key(gx, gz), next.g); open.push(next);
    }
  }
  if (distance(closest, goal) >= distance(first, goal) - 1) return [];
  const path: Point[] = []; let node: Node | undefined = closest;
  while (node) { path.unshift({ x: node.x, z: node.z }); node = node.parent; }
  const simplified = [path[0]];
  for (let i = 1; i < path.length;) { let end = path.length - 1; while (end > i && !clearPetRoute(path[i - 1], path[end], circles, boxes)) end--; simplified.push(path[end]); i = end + 1; }
  return simplified;
}
export function routeFootprints(route: Point[], count = 28) {
  const points: Point[] = [];
  for (let i = 1; i < route.length && points.length < count; i++) {
    const a = route[i - 1], b = route[i], n = Math.max(1, Math.ceil(distance(a, b) / .8));
    for (let j = 1; j <= n && points.length < count; j++) points.push({ x: a.x + (b.x - a.x) * j / n, z: a.z + (b.z - a.z) * j / n });
  }
  return points;
}
