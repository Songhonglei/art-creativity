import type { Weapon } from './types';

export interface AttackSpec { duration: number; impact: number; cooldown: number; range: number }
export function attackSpec(weapon: Weapon, heavy: boolean): AttackSpec {
  if (heavy) return weapon === 'crowbar' ? { duration: 1, impact: .36, cooldown: 1.2, range: 3.35 }
    : weapon === 'baton' ? { duration: .76, impact: .24, cooldown: .95, range: 3.35 }
      : { duration: .94, impact: .32, cooldown: 1.15, range: 3.7 };
  return weapon === 'crowbar' ? { duration: .55, impact: .14, cooldown: .66, range: 2.75 }
    : weapon === 'baton' ? { duration: .38, impact: .09, cooldown: .4, range: 2.75 }
      : { duration: .46, impact: .12, cooldown: .54, range: 3.1 };
}

export interface AttackPose {
  bodyX: number; bodyY: number; bodyZ: number; crouch: number;
  leftArm: number;
  weaponX: number; weaponY: number; weaponZ: number;
  rotateX: number; rotateY: number; rotateZ: number; canopy: number;
}
const rest: AttackPose = { bodyX: 0, bodyY: 0, bodyZ: 0, crouch: 0, leftArm: 0,
  weaponX: .24, weaponY: 1.12, weaponZ: -.39, rotateX: 0, rotateY: 0, rotateZ: -.43, canopy: 0 };

/** Authored preparation/contact/recovery poses; the contact keyframe is the damage timestamp. */
export function attackPose(weapon: Weapon, heavy: boolean, combo: number, elapsed: number): AttackPose {
  const spec = attackSpec(weapon, heavy), side = combo % 2 ? 1 : -1;
  let load: Partial<AttackPose>, hit: Partial<AttackPose>;
  if (weapon === 'crowbar') {
    load = heavy ? { bodyX: -.12, bodyY: -.22, crouch: -.12, leftArm: -2.2, weaponX: .1, weaponY: 1.93, weaponZ: -.12, rotateX: -.7, rotateZ: -.12 }
      : { bodyY: -.4 * side, leftArm: -.5, weaponX: .55 * side, weaponY: 1.4, weaponZ: .1, rotateX: .5, rotateY: -.8 * side, rotateZ: -1.1 * side };
    hit = heavy ? { bodyX: .32, bodyY: .18, crouch: -.16, leftArm: -1.15, weaponX: .1, weaponY: 1.05, weaponZ: .7, rotateX: 2.05, rotateZ: -.12 }
      : { bodyX: .12, bodyY: .48 * side, leftArm: -.5, weaponX: -.3 * side, weaponY: 1.18, weaponZ: .65, rotateX: 1.45, rotateY: 1.1 * side, rotateZ: -.7 * side };
  } else if (weapon === 'baton') {
    load = heavy ? { bodyY: -.75, bodyZ: -.12, crouch: -.12, leftArm: -.9, weaponX: .6, weaponY: 1.05, weaponZ: -.25, rotateX: 1.3, rotateY: -1.1, rotateZ: -1.4 }
      : { bodyY: -.15 * side, leftArm: -.7, weaponX: .28, weaponY: 1.2, weaponZ: -.08, rotateX: 1.2, rotateZ: -.12 };
    hit = heavy ? { bodyY: .8, bodyX: .13, crouch: -.08, leftArm: -.6, weaponX: -.48, weaponY: 1.18, weaponZ: .6, rotateX: 1.55, rotateY: 1.4, rotateZ: -1.4 }
      : { bodyY: .24 * side, bodyX: .12, leftArm: -.8, weaponX: .12 * side, weaponY: 1.3, weaponZ: .72, rotateX: 1.57, rotateY: combo === 3 ? .85 : .08 * side, rotateZ: combo === 3 ? -1.2 : -.12 };
  } else {
    load = heavy ? { bodyY: -.55, crouch: -.1, leftArm: -1.1, weaponX: .52, weaponY: 1.55, weaponZ: .15, rotateX: .95, rotateY: -.65, rotateZ: -.85, canopy: 1 }
      : { bodyY: -.18, leftArm: -.75, weaponX: .25, weaponY: 1.22, weaponZ: -.15, rotateX: 1.15, rotateZ: -.1 };
    hit = heavy ? { bodyY: .58, bodyX: .15, leftArm: -1.2, weaponX: -.22, weaponY: 1.35, weaponZ: .65, rotateX: 1.35, rotateY: .9, rotateZ: -.9, canopy: 1 }
      : { bodyY: .2, bodyX: .15, leftArm: -.9, weaponX: .16, weaponY: 1.25, weaponZ: .85, rotateX: 1.57, rotateY: .1 * side, rotateZ: -.1 };
  }
  const ready = { ...rest, ...load }, contact = { ...rest, ...hit };
  const times = [0, spec.impact * .7, spec.impact, spec.impact + .07, spec.duration];
  const poses = [rest, ready, contact, contact, rest];
  const t = Math.max(0, Math.min(spec.duration, elapsed));
  let index = 0; while (index < 3 && t > times[index + 1]) index++;
  const u = Math.max(0, Math.min(1, (t - times[index]) / (times[index + 1] - times[index]))), blend = u * u * (3 - 2 * u);
  const pose = { ...rest };
  for (const key of Object.keys(rest) as (keyof AttackPose)[]) pose[key] = poses[index][key] + (poses[index + 1][key] - poses[index][key]) * blend;
  return pose;
}

export const DODGE = { duration: .36, distance: 3.25, speed: 3.25 / .36 };
export function dodgePose(remaining: number, side: number, duration = DODGE.duration) {
  const pulse = Math.sin(Math.max(0, Math.min(1, 1 - remaining / duration)) * Math.PI);
  return { lean: .14 * pulse, roll: -.16 * side * pulse, crouch: -.16 * pulse, stride: .55 * pulse };
}
