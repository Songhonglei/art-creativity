import type { Point, Progress } from './types';
import type { BoxCollider, CircleCollider } from './collision';
import { resolveCircle, hasLineOfSight } from './collision';
import { riverX } from './materials';

export const RECOVERY = { deathSeconds: 1.5, transitionSeconds: .3, riseSeconds: .6, protectionSeconds: 2 } as const;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

export function availableRecoveryUpgrade(p: Progress): 'level' | 'weapon' | null {
  if (p.level < 5 && p.parts >= 3 + p.level && p.cash >= p.level * 400) return 'level';
  if (p.weaponLevel < 3 && p.parts >= 4 + p.weaponLevel * 3 && p.cash >= 600 + p.weaponLevel * 500) return 'weapon';
  return null;
}

export function recoveryHint(source: string) {
  if (source.includes('电驴') || source.includes('鬼火')) return '冲撞时向侧后方闪避，等它停下或撞上障碍再反击。';
  if (source.includes('地痞') || source.includes('强盗')) return '留出闪避的体力；它举手格挡时，用重击破防。';
  if (source.includes('贪官')) return '别连续贪刀；先闪过冲撞，等它收势再出手。';
  if (source.includes('猫') || source.includes('狗')) return '先闪过扑击，等它落地停顿，再用重击反击。';
  return '留出闪避的体力，先避开攻击，再抓住停顿反击。';
}

/** Bounded search: reject water, obstacles and immediate aggro; keep a route back. */
export function findRecoveryPoint(origin: Point, threats: Point[], circles: CircleCollider[], boxes: BoxCollider[], facing = 0): Point | null {
  for (const radius of [18, 24, 30, 36]) for (let i = 0; i < 24; i++) {
    const angle = facing + Math.PI + i * Math.PI / 12;
    const p = { x: origin.x + Math.sin(angle) * radius, z: origin.z + Math.cos(angle) * radius };
    if (Math.abs(p.x - riverX(p.z)) < 9 || threats.some(t => distance(t, p) < 16)) continue;
    if ((origin.x - riverX(origin.z)) * (p.x - riverX(p.z)) < 0) continue;
    if (distance(p, resolveCircle(p, .7, circles, boxes)) > .01) continue;
    if (!hasLineOfSight(p, origin, boxes, .4)) continue;
    return p;
  }
  return null;
}

export function recoveryPose(dead: boolean, deathElapsed: number, riseElapsed: number, reducedMotion: boolean) {
  const ease = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };
  const fall = dead ? reducedMotion ? 1 : ease(deathElapsed / .35) : 0;
  const rise = !dead && riseElapsed < RECOVERY.riseSeconds ? reducedMotion ? 0 : 1 - ease(riseElapsed / RECOVERY.riseSeconds) : 0;
  return { x: -.15 * fall, y: .43 * fall - .24 * rise, leanZ: -1.42 * fall, leanX: .12 * fall + .24 * rise, bend: .5 * fall + .65 * rise };
}
