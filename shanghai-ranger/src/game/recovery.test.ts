import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROGRESS, Simulation, CAMP, distance, readProgress } from './simulation';
import { availableRecoveryUpgrade, findRecoveryPoint, recoveryHint, recoveryPose, RECOVERY } from './recovery';
import { riverX } from './materials';

const idle = { x: 0, z: 0, sprint: false };
function fallen() {
  const event = vi.fn(), save = vi.fn();
  const sim = new Simulation(undefined, event, save);
  sim.rescueAvailable = false; sim.player.x = -40; sim.player.z = -20;
  sim.hurt(1000, sim.monster);
  return { sim, event, save };
}
const reload = (sim: Simulation) => { sim.persist(); return new Simulation(readProgress(JSON.stringify(sim.progress))); };

describe('v0.9.5 死亡与安全恢复', () => {
  it('死亡只触发一次表现，冻结时间、天气和宠物计时，所有战斗动作无效', () => {
    const { sim, event } = fallen(); sim.petCooldown = 12;
    const before = [sim.time, sim.weatherTime, sim.monster.timer, sim.petCooldown];
    for (let i = 0; i < 100; i++) sim.tick(.05, idle);
    sim.hurt(1000); expect(event.mock.calls.filter(([e]) => e.type === 'fall')).toHaveLength(1);
    expect([sim.time, sim.weatherTime, sim.monster.timer, sim.petCooldown]).toEqual(before);
    expect(sim.attack()).toBe(false); expect(sim.dodge()).toBe(false); expect(sim.heal()).toBe(false); expect(sim.petSkill()).toBe(false);
  });
  it('再战恢复英雄、保留收益、调查、领取标记与经验，不能重复提交', () => {
    const { sim, event, save } = fallen();
    sim.tracked = 2; sim.resources[0].collected = true; sim.progress.cash = 1234; sim.progress.parts = 19;
    sim.awardPetXp('clue-1', 8); const growth = JSON.stringify(sim.progress.pets);
    const resources = JSON.stringify(sim.resources), weather = [sim.time, sim.weatherTime, sim.weather];
    Object.assign(sim.player, { attackTime: 1, dodgeTime: .4, knockbackTime: .3, combo: 3, moving: true, sprinting: true });
    expect(sim.retryEncounter()).toBe(true);
    expect(sim.player).toMatchObject({ health: sim.maxHealth, stamina: 100, attackTime: 0, dodgeTime: 0, knockbackTime: 0, combo: 0, moving: false, sprinting: false });
    expect(sim.tracked).toBe(2); expect(sim.questPhase).toBe('tracking');
    expect(sim.progress).toMatchObject({ cash: 1234, parts: 19, hunts: 0 });
    expect(JSON.stringify(sim.resources)).toBe(resources); expect(JSON.stringify(sim.progress.pets)).toBe(growth);
    expect([sim.time, sim.weatherTime, sim.weather]).toEqual(weather);
    const writes = save.mock.calls.length;
    expect(sim.retryEncounter()).toBe(false); expect(save.mock.calls).toHaveLength(writes);
    expect(event.mock.calls.filter(([e]) => e.type === 'revive')).toHaveLength(1);
    sim.awardPetXp('clue-1', 8); expect(JSON.stringify(sim.progress.pets)).toBe(growth);
  });
  it('奶茶补到至少5杯，更多的保留；宠物冷却/增益不刷新，只恢复原公共救援', () => {
    for (const potions of [0, 2, 8]) {
      const { sim } = fallen(); sim.potions = potions; sim.petCooldown = 13; sim.petEffects.autoCooldown = 27; sim.petEffects.guideTime = 5;
      const effects = { ...sim.petEffects }; sim.retryEncounter();
      expect(sim.potions).toBe(Math.max(5, potions)); expect(sim.rescueAvailable).toBe(true);
      expect(sim.petCooldown).toBe(13); expect(sim.petEffects).toEqual(effects);
    }
  });
  it('主目标满血并重置招式/暴怒，敌人不能处于上一条冲撞', () => {
    const { sim } = fallen(); sim.tracked = 3; sim.questPhase = 'hunting';
    Object.assign(sim.monster, { health: 12, action: 'charge', enraged: true, timer: .2, attackCount: 7 });
    sim.retryEncounter();
    expect(sim.monster).toMatchObject({ health: sim.monster.maxHealth, action: 'idle', enraged: false, attackCount: 0, chargeX: 0, chargeZ: 0 });
    expect(sim.streetEnemies.every(m => m.health <= 0 || m.action === 'idle')).toBe(true);
    expect(sim.tracked).toBe(3); expect(sim.questPhase).toBe('hunting');
  });
  for (const phase of ['harvest', 'complete'] as const) it(`${phase}保留已制伏目标，不回退或重复发奖`, () => {
    const { sim } = fallen(); sim.monster.health = 0; sim.monster.action = 'dead'; sim.tracked = 3; sim.questPhase = phase;
    sim.progress.hunts = phase === 'complete' ? 1 : 0;
    const cash = sim.progress.cash; sim.retryEncounter();
    expect(sim.monster.health).toBe(0); expect(sim.questPhase).toBe(phase); expect(sim.progress.cash).toBe(cash);
    if (phase === 'harvest') {
      sim.player.x = sim.monster.x; sim.player.z = sim.monster.z;
      expect(sim.interact()).toBe(true); const paid = sim.progress.cash; sim.interact(); expect(sim.progress.cash).toBe(paid);
    }
  });
  it('落点远离敌人且不在水中；保护期不掉血，暂停不消耗保护', () => {
    const { sim } = fallen(); sim.retryEncounter();
    for (const m of [...sim.streetEnemies, sim.monster]) if (m.health > 0) expect(distance(sim.player, m)).toBeGreaterThanOrEqual(16);
    expect(Math.abs(sim.player.x - riverX(sim.player.z))).toBeGreaterThanOrEqual(9);
    sim.hurt(1000); expect(sim.player.health).toBe(sim.maxHealth);
    sim.paused = true; sim.tick(.05, idle); expect(sim.recoveryProtection).toBe(2);
    sim.paused = false; sim.tick(.05, idle); expect(sim.recoveryProtection).toBeCloseTo(1.95);
  });
  it('全部堵住时回真实营地并给出恢复提示', () => {
    const { sim } = fallen(); sim.boxColliders = [{ x: -40, z: -20, halfWidth: 100, halfDepth: 100 }];
    expect(sim.retryEncounter()).toBe(true); expect(sim.player).toMatchObject(CAMP);
    expect(sim.notifications.some(n => n.title === '已回到安全营地')).toBe(true);
  });
  it('死亡与恢复检查点兼容刷新，不借刷新重复补满', () => {
    const { sim } = fallen(); const restored = reload(sim);
    expect(restored.dead).toBe(true); expect(restored.retryOrigin).toEqual(sim.retryOrigin);
    restored.retryEncounter(); restored.player.health = 47; restored.rescueAvailable = false; restored.petCooldown = 11;
    const active = reload(restored); expect(active.dead).toBe(false); expect(active.player.health).toBe(47);
    expect(active.rescueAvailable).toBe(false); expect(active.petCooldown).toBe(11); expect(active.retryEncounter()).toBe(false);
  });
  it('旧v3死亡存档缺少新字段仍可恢复；无效锚点安全回退', () => {
    const { sim } = fallen(); sim.persist(); delete sim.progress.patrol!.retryOrigin; delete sim.progress.patrol!.recoveryProtection;
    const old = new Simulation(sim.progress); expect(old.dead).toBe(true); expect(old.retryEncounter()).toBe(true);
    sim.progress.patrol!.retryOrigin = { x: Infinity, z: 1e10 };
    expect(readProgress(JSON.stringify(sim.progress)).patrol?.retryOrigin).toBeUndefined();
  });
  it('写入失败保留恢复状态，重试保存不会重新复活或重复奖励', () => {
    let fail = true; const event = vi.fn();
    const sim = new Simulation(undefined, event, () => { if (fail) throw Error('quota'); });
    sim.rescueAvailable = false; sim.hurt(1000); sim.retryEncounter(); expect(sim.saveStatus).toBe('failed');
    const cash = sim.progress.cash; sim.player.health = 43; fail = false; sim.retrySave();
    expect(sim.player.health).toBe(43); expect(sim.progress.cash).toBe(cash); expect(sim.saveStatus).toBe('saved');
    expect(event.mock.calls.filter(([e]) => e.type === 'revive')).toHaveLength(1);
  });
  it('旧宠物救援没有变成战败：0.7秒后站起且仍消耗原有次数', () => {
    const event = vi.fn(), sim = new Simulation(undefined, event); sim.hurt(1000);
    expect(sim.dead).toBe(false); expect(sim.rescueTime).toBe(.7);
    for (let i = 0; i < 15; i++) sim.tick(.05, idle);
    expect(sim.player.health).toBe(30); expect(sim.rescueAvailable).toBe(false);
    expect(event.mock.calls.some(([e]) => e.type === 'fall')).toBe(false);
  });
});

describe('恢复建议、落点与表现边界', () => {
  it('仅有足够材料才提示强化，区分侠义和兵器入口', () => {
    expect(availableRecoveryUpgrade(DEFAULT_PROGRESS)).toBeNull();
    expect(availableRecoveryUpgrade({ ...DEFAULT_PROGRESS, parts: 4, cash: 400 })).toBe('level');
    expect(availableRecoveryUpgrade({ ...DEFAULT_PROGRESS, level: 5, parts: 4, cash: 600 })).toBe('weapon');
    expect(availableRecoveryUpgrade({ ...DEFAULT_PROGRESS, level: 5, weaponLevel: 3, parts: 999, cash: 9999 })).toBeNull();
  });
  it('提示匹配车辆、扑击、格挡与未知死因', () => {
    expect(recoveryHint('无牌电驴')).toContain('侧后方'); expect(recoveryHint('野猫')).toContain('扑击');
    expect(recoveryHint('持刀强盗')).toContain('破防'); expect(recoveryHint('')).toContain('体力');
  });
  it('有限落点搜索拒绝障碍和包围，不把主角推到墙外当成合法位置', () => {
    expect(findRecoveryPoint({ x: -60, z: 0 }, [], [], [{ x: -60, z: 0, halfWidth: 50, halfDepth: 50 }])).toBeNull();
    const p = findRecoveryPoint({ x: -60, z: 0 }, [{ x: -60, z: -18 }], [], []);
    expect(p).not.toBeNull(); expect(distance(p!, { x: -60, z: -18 })).toBeGreaterThanOrEqual(16);
  });
  it('沿江恢复保持在同一岸，避免复活后额外绕路找桥', () => {
    const origin = { x: riverX(0) - 9.1, z: 0 };
    const point = findRecoveryPoint(origin, [], [], [], -Math.PI / 2);
    expect(point).not.toBeNull();
    expect(point!.x - riverX(point!.z)).toBeLessThan(0);
  });
  it('倒地和起身姿态连续、边界有界；减少动态保持稳定姿态', () => {
    expect(RECOVERY.deathSeconds).toBe(1.5);
    expect(recoveryPose(true, 0, .6, false).leanZ).toBeCloseTo(0);
    expect(recoveryPose(true, .2, .6, false).leanZ).toBeLessThan(0);
    expect(recoveryPose(true, 1.5, .6, false).leanZ).toBe(-1.42);
    expect(recoveryPose(false, 0, 0, false).y).toBe(-.24);
    expect(recoveryPose(false, 0, .6, false).y).toBe(0);
    expect(recoveryPose(true, 0, .6, true)).toEqual(recoveryPose(true, 1.5, .6, true));
    expect(recoveryPose(false, 0, 0, true).y).toBe(0);
  });
});
