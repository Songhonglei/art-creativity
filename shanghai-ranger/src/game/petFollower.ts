import { advancePet, pathClear, petFollowRoute, resolveCircle } from './collision';
import type { BoxCollider, CircleCollider } from './collision';
import type { Point } from './types';
export class PetFollower {
  searches = 0;
  private route: Point[] = [];
  private goal: Point | null = null;
  private revision = -1;
  private remaining = 0;
  reset() { this.route = []; this.goal = null; this.remaining = 0; this.revision = -1; }
  follow(current: Point, player: Point, dt: number, circles: CircleCollider[], boxes: BoxCollider[], revision: number): Point {
    if (dt <= 0) return current;
    const desired = resolveCircle({ x: player.x - 2.2, z: player.z + 1.1 }, .3, circles, boxes);
    if (pathClear(current, desired, circles, boxes, .3)) { this.route = []; return advancePet(current, player, desired, dt, circles, boxes); }
    this.remaining -= dt;
    while (this.route.length && Math.hypot(this.route[0].x - current.x, this.route[0].z - current.z) < .15) this.route.shift();
    const changed = !this.goal || Math.hypot(desired.x - this.goal.x, desired.z - this.goal.z) > 1.5 || revision !== this.revision;
    if (changed || this.remaining <= 0) {
      this.route = petFollowRoute(current, desired, circles, boxes); this.goal = desired; this.revision = revision; this.remaining = .7; this.searches++;
    }
    const target = this.route[0];
    if (!target || !pathClear(current, target, circles, boxes, .3)) { this.remaining = 0; return current; }
    return advancePet(current, player, target, dt, circles, boxes);
  }
}
