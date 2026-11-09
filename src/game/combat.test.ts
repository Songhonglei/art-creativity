import { describe, expect, it, vi } from 'vitest';
import { attackPose, attackSpec, DODGE, dodgePose } from './combat';
import { chooseDodge } from './dodge';
import { Simulation, DEFAULT_PROGRESS } from './simulation';
import type { GameEvent, Weapon } from './types';

const idle = { x: 0, z: 0, sprint: false };
function advance(sim: Simulation, seconds: number) { let t = seconds; while (t > 1e-7) { const dt = Math.min(.01, t); sim.tick(dt, idle); t -= dt; } }
function fixture(weapon: Weapon = 'crowbar') {
  const events: GameEvent[] = [], sim = new Simulation({ ...DEFAULT_PROGRESS, level: 3, weapon }, e => events.push(e));
  sim.streetEnemies = []; sim.player.x = 0; sim.player.z = 0; sim.player.facing = 0;
  sim.monster.x = 0; sim.monster.z = 2.3; sim.monster.action = 'idle'; sim.monster.timer = 99;
  sim.tracked = 3; sim.questPhase = 'hunting'; sim.combat = true;
  return { sim, events };
}

describe('武器动作与命中时机', () => {
  it('三种武器的轻重击分别有不同的接触姿态，并完整收势', () => {
    const poses = [];
    for (const weapon of ['crowbar', 'baton', 'umbrella'] as const) for (const heavy of [false, true]) {
      const spec = attackSpec(weapon, heavy);
      expect(spec.impact).toBeGreaterThan(0); expect(spec.impact).toBeLessThan(spec.duration); expect(spec.cooldown).toBeGreaterThanOrEqual(spec.duration);
      const pose = attackPose(weapon, heavy, 1, spec.impact); poses.push(JSON.stringify(pose));
      const ending = attackPose(weapon, heavy, 1, spec.duration), start = attackPose(weapon, heavy, 1, 0);
      for (const key of Object.keys(start) as (keyof typeof start)[]) expect(ending[key]).toBeCloseTo(start[key], 8);
    }
    expect(new Set(poses).size).toBe(6);
  });
  it('重击蓄力比轻击更长，战术伞只有重击展开伞面', () => {
    for (const weapon of ['crowbar', 'baton', 'umbrella'] as const) expect(attackSpec(weapon, true).impact).toBeGreaterThan(attackSpec(weapon, false).impact);
    expect(attackPose('umbrella', false, 1, .12).canopy).toBe(0);
    expect(attackPose('umbrella', true, 1, .32).canopy).toBe(1);
  });
  it('连击交替出招，第三段伸缩棍使用横扫', () => {
    expect(attackPose('crowbar', false, 1, .14).rotateY).toBe(-attackPose('crowbar', false, 2, .14).rotateY);
    expect(attackPose('baton', false, 3, .09).rotateZ).not.toBe(attackPose('baton', false, 1, .09).rotateZ);
  });
  it('蓄力不扣敌人血，接触时只结算一次重击与反馈', () => {
    const { sim, events } = fixture(); const hp = sim.monster.health;
    expect(sim.attack(true)).toBe(true); expect(sim.monster.health).toBe(hp);
    advance(sim, .35); expect(sim.monster.health).toBe(hp);
    advance(sim, .02); expect(sim.monster.health).toBeLessThan(hp);
    const hitHp = sim.monster.health; advance(sim, .5); expect(sim.monster.health).toBe(hitHp);
    expect(events.filter(e => e.type === 'hit')).toHaveLength(1);
    expect(events.find(e => e.type === 'hit')).toMatchObject({ heavy: true, weapon: 'crowbar' });
  });
  it('挥中时重新检查距离和墙体，目标离开或隔墙不会遥控命中', () => {
    for (const blocked of [false, true]) {
      const { sim } = fixture(); const hp = sim.monster.health; sim.attack(true);
      if (blocked) sim.boxColliders = [{ x: 0, z: 1.2, halfWidth: 3, halfDepth: .1 }]; else sim.monster.z = 10;
      advance(sim, .4); expect(sim.monster.health).toBe(hp);
    }
  });
  it('闪避或实际受伤可以中断蓄力，被中断的攻击不再结算', () => {
    for (const cancel of ['dodge', 'hurt'] as const) {
      const { sim, events } = fixture(); const hp = sim.monster.health; sim.attack(true);
      if (cancel === 'dodge') sim.dodge(); else sim.hurt(10);
      advance(sim, .6); expect(sim.monster.health).toBe(hp); expect(events.some(e => e.type === 'hit')).toBe(false);
    }
  });
  it('菜单暂停冻结蓄力，继续后恰好结算一次', () => {
    const { sim, events } = fixture(); sim.attack(true); sim.paused = true; advance(sim, 1);
    expect(events.some(e => e.type === 'hit')).toBe(false); expect(sim.player.attackTime).toBe(1);
    sim.paused = false; advance(sim, .4); expect(events.filter(e => e.type === 'hit')).toHaveLength(1);
  });
  it('出招时不可换武器，重新夜巡清除未完成攻击', () => {
    const { sim } = fixture(); sim.combat = false; sim.attack(true); expect(sim.equip('baton')).toBe(false);
    sim.newHunt(); expect(sim.player.attackTime).toBe(0); expect(sim.player.attackHeavy).toBe(false);
  });
  it('格挡与重击反馈不同，重击仍可破防', () => {
    const { sim, events } = fixture(); sim.monster.action = 'guard'; sim.attack(); advance(sim, .16);
    expect(events.find(e => e.type === 'hit')).toMatchObject({ blocked: true, heavy: false });
    advance(sim, .6); sim.monster.action = 'guard'; sim.monster.timer = 99; sim.attack(true); advance(sim, .37);
    expect(sim.monster.action).toBe('stagger'); expect(events.filter(e => e.type === 'hit')[1]).toMatchObject({ heavy: true, blocked: false });
  });
});

describe('站姿后撤闪避与空间选择', () => {
  it('无遮挡时左右后方均可选，概率源决定方向', () => {
    const left = chooseDodge({ x: 0, z: 0 }, 0, [], [], () => 0)!, right = chooseDodge({ x: 0, z: 0 }, 0, [], [], () => .999)!;
    expect(left.x).toBeLessThan(0); expect(right.x).toBeGreaterThan(0); expect(left.z).toBeLessThan(0); expect(right.z).toBeLessThan(0);
  });
  it('左后方堵住时优先右后方，不被随机结果带进墙里', () => {
    const boxes = [{ x: -1, z: -1.5, halfWidth: .7, halfDepth: .8 }];
    expect(chooseDodge({ x: 0, z: 0 }, 0, [], boxes, () => 0)?.side).toBe(1);
  });
  it('两侧均堵住时不耗体力、不赠送原地无敌', () => {
    const { sim } = fixture(); sim.boxColliders = [{ x: 0, z: -1.2, halfWidth: 5, halfDepth: .7 }];
    expect(sim.dodge()).toBe(false); expect(sim.player.stamina).toBe(100); expect(sim.player.invulnerable).toBe(0);
  });
  it('后方空间不足时缩短后撤，运动方向与角色朝向一致', () => {
    const { sim } = fixture(); sim.boxColliders = [{ x: 0, z: -2.5, halfWidth: 5, halfDepth: .25 }];
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(sim.dodge()).toBe(true); expect(sim.player.dodgeDuration).toBeLessThan(DODGE.duration);
    advance(sim, .4); expect(sim.player.x).toBeLessThan(0); expect(sim.player.z).toBeLessThan(0); expect(sim.player.z).toBeGreaterThan(-1.92);
    rng.mockRestore();
  });
  it('闪避幅度保持站姿，左右倾斜相反而不翻倒', () => {
    for (let t = 0; t <= DODGE.duration; t += .02) {
      const a = dodgePose(t, -1), b = dodgePose(t, 1);
      expect(Math.abs(a.lean)).toBeLessThanOrEqual(.15); expect(Math.abs(a.roll)).toBeLessThanOrEqual(.17); expect(a.roll).toBe(-b.roll);
    }
  });
  it('闪避不会缩短已有宠物保护时间', () => {
    const { sim } = fixture(); sim.player.invulnerable = 2;
    expect(sim.dodge()).toBe(true); expect(sim.player.invulnerable).toBe(2);
  });
});
