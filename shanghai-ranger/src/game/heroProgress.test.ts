import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_PROGRESS, Simulation, readProgress } from './simulation';
import { HERO_MAX_LEVEL, SKINS, heroUpgradeCost, skinUnlocked } from './heroProgress';
import { availableRecoveryUpgrade } from './recovery';
import { createHunter, disposeHero } from './heroModel';
import { attackSpec } from './combat';
import type { Gender, Skin, Weapon } from './types';
const fixture = (level = 1) => new Simulation(structuredClone({ ...DEFAULT_PROGRESS, level, parts: 100, cash: 20000 }));

describe('v1 侠义与换装', () => {
  it('九次升级合计72零件18000元，满级与重复点击不再扣款', () => {
    const sim = fixture();
    for (let l = 1; l < HERO_MAX_LEVEL; l++) { const before = { ...sim.progress }, cost = heroUpgradeCost(l); expect(sim.levelUp()).toBe(true); expect(sim.progress.parts).toBe(before.parts - cost.parts); expect(sim.progress.cash).toBe(before.cash - cost.cash); }
    expect(sim.progress.parts).toBe(28); expect(sim.progress.cash).toBe(2000); const before = structuredClone(sim.progress); expect(sim.levelUp()).toBe(false); expect(sim.progress).toEqual(before);
  });
  it('资源不足不扣费，6–10升级不回血、不增长攻防', () => {
    const insufficient = fixture(); insufficient.progress.parts = 0; const before = structuredClone(insufficient.progress); expect(insufficient.levelUp()).toBe(false); expect(insufficient.progress).toEqual(before);
    const sim = fixture(5); sim.player.health = 23;
    const damage = sim.attackDamage, health = sim.maxHealth;
    for (let i = 0; i < 5; i++) { expect(sim.levelUp()).toBe(true); expect(sim.attackDamage).toBe(damage); expect(sim.maxHealth).toBe(health); expect(sim.player.health).toBe(23); }
  });
  for (const level of [1, 3, 4, 5, 6, 7, 9, 10]) it(`Lv${level}的免费门槛与规则层、存档层一致`, () => {
    for (const skin of SKINS) {
      const sim = fixture(level), unlocked = level >= skin.level;
      expect(skinUnlocked(skin.id, level)).toBe(unlocked); expect(sim.setSkin(skin.id)).toBe(unlocked);
      expect(readProgress(JSON.stringify({ ...sim.progress, skin: skin.id })).skin).toBe(unlocked ? skin.id : 'nightwatch');
    }
    expect(fixture(level).setSkin('dragon' as Skin)).toBe(false);
  });
  it('旧档1/3/4/5保留原衣和checkpoint，缺失/坏性别回退男性', () => {
    for (const level of [1, 3, 4, 5]) for (const skin of SKINS.slice(0, 3)) {
      const sim = fixture(level); sim.progress.skin = skin.id; sim.player.health = 37; sim.petCooldown = 12; sim.rescueAvailable = false; sim.persist();
      const raw = { ...sim.progress, gender: 'invalid' }, loaded = readProgress(JSON.stringify(raw));
      expect(loaded.level).toBe(level); expect(loaded.skin).toBe(skin.id); expect(loaded.gender).toBe('male'); expect(loaded.patrol?.player.health).toBe(37); expect(loaded.patrol?.petCooldown).toBe(12); expect(loaded.patrol?.rescueAvailable).toBe(false);
    }
  });
  it('性别和皮肤不改身体属性、调查、冷却和救援，失败保存可原样重试', () => {
    let fail = true, stored = '';
    const sim = new Simulation(structuredClone({ ...DEFAULT_PROGRESS, level: 10 }), undefined, p => { if (fail) throw Error('quota'); stored = JSON.stringify(p); });
    sim.player.health = 34; sim.petCooldown = 12; sim.rescueAvailable = false; sim.tracked = 2;
    const stats = [sim.maxHealth, sim.attackDamage];
    expect(sim.setGender('female')).toBe(true); expect(sim.setSkin('shanghai-paragon')).toBe(true); expect(sim.saveStatus).toBe('failed');
    expect([sim.maxHealth, sim.attackDamage]).toEqual(stats); expect(sim.player.health).toBe(34); expect(sim.petCooldown).toBe(12); expect(sim.rescueAvailable).toBe(false);
    fail = false; sim.retrySave(); const loaded = readProgress(stored); expect(loaded.gender).toBe('female'); expect(loaded.skin).toBe('shanghai-paragon'); expect(loaded.patrol?.tracked).toBe(2);
  });
  it('交战、倒地、救援、恢复保护及出招都不能绕过换装/性别限制', () => {
    for (const block of ['combat', 'dead', 'rescue', 'protection', 'attack', 'dodge']) {
      const sim = fixture(10); if (block === 'combat') sim.combat = true; if (block === 'dead') sim.dead = true; if (block === 'rescue') sim.rescueTime = .5; if (block === 'protection') sim.recoveryProtection = 1; if (block === 'attack') sim.player.attackTime = .2; if (block === 'dodge') sim.player.dodgeTime = .2;
      expect(sim.setSkin('magnolia')).toBe(false); expect(sim.setGender('female')).toBe(false); expect(sim.progress.skin).toBe('nightwatch');
    }
  });
  it('6级以后死亡页仅推荐有效的兵器精修，不推荐外观升级', () => {
    for (const level of [5, 6, 10]) { const p = fixture(level).progress; expect(availableRecoveryUpgrade(p)).toBe('weapon'); p.weaponLevel = 3; expect(availableRecoveryUpgrade(p)).toBe(null); }
  });
  it('5/6/10级街头目标、护甲减伤、读档血上限一致', () => {
    const sims = [5, 6, 10].map(fixture);
    sims.forEach(s => { s.player.health = 999; s.persist(); });
    expect(sims.map(s => readProgress(JSON.stringify(s.progress)).patrol?.player.health)).toEqual([172, 172, 172]);
    expect(sims.map(s => s.streetEnemies.map(e => e.maxHealth))).toEqual([sims[0].streetEnemies.map(e => e.maxHealth), sims[0].streetEnemies.map(e => e.maxHealth), sims[0].streetEnemies.map(e => e.maxHealth)]);
    sims.forEach(s => { s.player.health = 172; s.hurt(40); }); expect(sims.map(s => s.player.health)).toEqual([147,147,147]);
  });
});

describe('主角真实关节与资源预算', () => {
  for (const skin of SKINS) for (const gender of ['male', 'female'] as Gender[]) it(`${skin.id}:${gender} 三武器/动作采样有限数值，脚下无持续穿地`, () => {
    const model = createHunter(null, skin.id, gender), sim = fixture(10); sim.player.x = sim.player.z = sim.player.facing = 0;
    expect(model.root.getObjectByName('leftElbow')).toBeTruthy(); expect(model.root.getObjectByName('knee')).toBeTruthy();
    for (const weapon of ['crowbar', 'baton', 'umbrella'] as Weapon[]) {
      sim.progress.weapon = weapon;
      for (const combo of [1, 2, 3]) for (const heavy of [false, true]) for (let frame = 0; frame <= 12; frame++) {
        const spec = attackSpec(weapon, heavy); sim.player.attackWeapon = weapon; sim.player.attackHeavy = heavy; sim.player.combo = combo; sim.player.attackDuration = spec.duration; sim.player.attackTime = spec.duration * (1 - frame / 12);
        model.update(sim, frame / 12, 1 / 60); model.root.updateMatrixWorld(true);
        model.root.traverse(o => expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true));
        expect(new THREE.Box3().setFromObject(model.root).min.y).toBeGreaterThanOrEqual(-.002);
        const grip = model.root.getObjectByName('weaponGrip')!, rightWrist = model.root.getObjectByName('rightWrist')!.getWorldPosition(new THREE.Vector3());
        expect(rightWrist.distanceTo(grip.getWorldPosition(new THREE.Vector3()))).toBeLessThan(.012);
        if (heavy && sim.player.attackTime > 0) expect(model.root.getObjectByName('leftWrist')!.getWorldPosition(new THREE.Vector3()).distanceTo(grip.localToWorld(new THREE.Vector3(0, -.11, 0)))).toBeLessThan(.025);
      }
    }
    sim.player.attackTime = 0; sim.dead = true; model.update(sim, 0, 1 / 60, { death: 1.5, rise: .6, reducedMotion: false }); expect(new THREE.Box3().setFromObject(model.root).min.y).toBeGreaterThanOrEqual(-.002);
    for (const floor of [-.4, 1.4]) {
      model.root.position.y = floor; model.update(sim, 0, 1 / 60, { death: 1.5, rise: .6, reducedMotion: false });
      expect(new THREE.Box3().setFromObject(model.root).min.y).toBeGreaterThanOrEqual(floor + .009);
    }
    let triangles = 0, calls = 0; model.root.traverse(o => { if (o instanceof THREE.Mesh) { triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; calls++; } }); expect(triangles).toBeLessThanOrEqual(skin.level === 1 ? 18000 : skin.level === 4 ? 22000 : skin.level === 7 ? 26000 : 30000);
    let visibleCalls = 0; const countVisible = (o: THREE.Object3D) => { if (!o.visible) return; if (o instanceof THREE.Mesh) visibleCalls++; o.children.forEach(countVisible); }; countVisible(model.root); expect(visibleCalls).toBeLessThanOrEqual(40); void calls;
    disposeHero(model.root);
  });
  it('高级服装类别逐级保留，10级包含7级和4级的全部类别', () => {
    const models = SKINS.slice(3).map(skin => createHunter(null, skin.id));
    const parts = models.map(m => (m.root.userData.designParts as string[]).filter(part => !['wutong-leaf-pin', 'river-crest'].includes(part)));
    for (const part of parts[0]) expect(parts[1]).toContain(part);
    for (const part of parts[1]) expect(parts[2]).toContain(part);
    models.forEach(m => disposeHero(m.root));
  });
});
