import { describe, expect, it, vi } from 'vitest';
import { Simulation, DEFAULT_PROGRESS, readProgress, ROSTER, WEATHER_DURATION, distance, huntSite, monsterBehavior } from './simulation';
import { followPet, resolveCircle } from './collision';
import { CHUNK_SIZE, LAYOUT_CACHE_LIMIT, chunkCoordinate, districtKind, districtLayout, districtLayoutCacheSize, districtName, nearbyChunkKeys } from './districts';
import { riverX } from './materials';
import { cameraSafeFraction } from './camera';

const idle = { x: 0, z: 0, sprint: false };
function advance(sim: Simulation, seconds: number) { for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.tick(1 / 60, idle); }
function reveal(sim: Simulation) { sim.tracked = 3; sim.questPhase = 'hunting'; }
function closeToTarget(sim: Simulation) { reveal(sim); sim.combat = true; sim.player.x = sim.monster.x; sim.player.z = sim.monster.z + 2.4; sim.player.facing = Math.PI; }

function strike(sim: Simulation, heavy = false) {
  const accepted = sim.attack(heavy);
  if (accepted) advance(sim, sim.player.attackImpact + .001);
  return accepted;
}

describe('本地存档', () => {
  it('损坏的存档安全回退，畸形进度被钳制', () => {
    expect(readProgress('{bad')).toEqual(DEFAULT_PROGRESS);
    const p = readProgress(JSON.stringify({ version: 2, weapon: 'invalid', level: 90, hunts: -1, cash: 'many', parts: -20, pet: 'dragon' }));
    expect(p.weapon).toBe('crowbar');
    expect(p.level).toBe(5);
    expect(p.hunts).toBe(0);
    expect(p.parts).toBe(0);
    expect(p.cash).toBe(350);
    expect(p.pet).toBe('orangeCat');
    const migrated = readProgress(JSON.stringify({ version: 1, parts: 7, cash: 900, level: 2, hunts: 3, pet: 'corgi', weapon: 'baton' }));
    expect(migrated).toMatchObject({ version: 2, parts: 7, cash: 900, level: 2, hunts: 3, pet: 'corgi', weapon: 'baton', petLevel: 1, weaponLevel: 0 });
    expect(readProgress(JSON.stringify({ ...DEFAULT_PROGRESS, skin: 'invalid' })).skin).toBe('nightwatch');
    expect(readProgress(JSON.stringify({ ...DEFAULT_PROGRESS, weapon: 'umbrella' })).weapon).toBe('crowbar');
  });
  it('长柄战术伞三级解锁，低等级不能装备，解锁后伤害与存档一致', () => {
    const save = vi.fn(), sim = new Simulation(undefined, undefined, save);
    expect(sim.equip('umbrella')).toBe(false);
    expect(sim.progress.weapon).toBe('crowbar');
    sim.progress.level = 3;
    expect(sim.equip('umbrella')).toBe(true);
    expect(sim.progress.weapon).toBe('umbrella');
    expect(sim.attackDamage).toBe(64);
    expect(save).toHaveBeenCalledTimes(1);
    expect(readProgress(JSON.stringify(sim.progress)).weapon).toBe('umbrella');
  });
  it('三套侠客皮肤均可切换并通过本地存档恢复', () => {
    const save = vi.fn(), sim = new Simulation(undefined, undefined, save);
    for (const skin of ['magnolia', 'neon', 'nightwatch'] as const) {
      expect(sim.setSkin(skin)).toBe(true);
      expect(sim.progress.skin).toBe(skin);
      expect(readProgress(JSON.stringify(sim.progress)).skin).toBe(skin);
    }
    expect(save).toHaveBeenCalledTimes(3);
  });
  it('翻找零件堆增加零件且每处只能翻一次，并触发存档', () => {
    const save = vi.fn(), sim = new Simulation(undefined, undefined, save), parts = sim.resources.find(r => r.kind === 'parts')!;
    sim.player.x = parts.x; sim.player.z = parts.z;
    expect(sim.interact()).toBe(true);
    expect(sim.progress.parts).toBe(4);
    expect(save).toHaveBeenCalledTimes(1);
    expect(sim.interact()).toBe(false);
    expect(sim.progress.parts).toBe(4);
  });
});

describe('游侠移动与动作', () => {
  it('斜向移动归一化，暂停时整个模拟冻结', () => {
    const sim = new Simulation(), start = { ...sim.player };
    sim.tick(.05, { x: 1, z: 1, sprint: false });
    expect(distance(start, sim.player)).toBeCloseTo(4.5 * .05, 5);
    const before = sim.snapshot(); sim.paused = true; sim.tick(.05, { x: 1, z: 0, sprint: true });
    expect(sim.snapshot()).toEqual(before);
    expect(sim.attack()).toBe(false); expect(sim.dodge()).toBe(false); expect(sim.interact()).toBe(false);
  });
  it('闪避消耗体力，无敌帧内免伤', () => {
    const sim = new Simulation(); sim.setPet('corgi');
    expect(sim.dodge()).toBe(true); expect(sim.player.stamina).toBe(77);
    sim.hurt(23); expect(sim.player.health).toBe(sim.maxHealth);
    advance(sim, .7); sim.hurt(23); expect(sim.player.health).toBe(sim.maxHealth - 23);
    sim.player.stamina = 10; expect(sim.dodge()).toBe(false);
  });
  it('满血不浪费奶茶，冷却内不能连喝', () => {
    const sim = new Simulation();
    expect(sim.heal()).toBe(false); expect(sim.potions).toBe(5);
    sim.player.health = 20; expect(sim.heal()).toBe(true); expect(sim.player.health).toBe(68); expect(sim.potions).toBe(4);
    expect(sim.heal()).toBe(false); expect(sim.potions).toBe(4);
    advance(sim, 1.6); expect(sim.heal()).toBe(true); expect(sim.player.health).toBe(sim.maxHealth);
  });
  it('查看痕迹记录线索并消耗该痕迹', () => {
    const sim = new Simulation(), clue = sim.resources.find(r => r.kind === 'clue')!;
    sim.player.x = clue.x; sim.player.z = clue.z;
    expect(sim.getInteraction()?.label).toBe('查看可疑痕迹');
    expect(sim.interact()).toBe(true);
    expect(sim.tracked).toBe(1); expect(clue.collected).toBe(true);
  });
  it('大排档休息回满状态并推进天气', () => {
    const sim = new Simulation();
    sim.player.x = -18; sim.player.z = 29; sim.player.health = 30; sim.potions = 1;
    expect(sim.interact()).toBe(true);
    expect(sim.player.health).toBe(sim.maxHealth); expect(sim.potions).toBe(5);
    expect(sim.weather).toBe('雾霾');
  });
  it('侠客不会被建筑障碍物卡住', () => {
    const sim = new Simulation(); sim.colliders = [{ x: 0, z: 19, radius: 1 }];
    for (let i = 0; i < 30; i++) sim.tick(1 / 60, { x: 0, z: -1, sprint: false });
    expect(Math.hypot(sim.player.x, sim.player.z - 19)).toBeGreaterThanOrEqual(1.28 - 1e-8);
    expect(sim.player.z).toBeGreaterThan(19);
  });
  it('矩形建筑墙面会挡住人物，不再能穿过外滩和石库门占地', () => {
    const sim = new Simulation(); sim.player.x = 0; sim.player.z = 22;
    sim.boxColliders = [{ x: 0, z: 19, halfWidth: 2, halfDepth: 1 }];
    for (let i = 0; i < 60; i++) sim.tick(1 / 60, { x: 0, z: -1, sprint: false });
    expect(sim.player.z).toBeGreaterThanOrEqual(20.34 - 1e-7);
    expect(sim.player.z).toBeLessThan(21);
  });
  it('闪避也不能越过建筑墙体', () => {
    const sim = new Simulation(); sim.player.x = 0; sim.player.z = 21.5;
    sim.boxColliders = [{ x: 0, z: 19, halfWidth: 2, halfDepth: 1 }];
    sim.tick(1 / 60, { x: 0, z: -1, sprint: false }); sim.dodge(); advance(sim, .7);
    expect(sim.player.z).toBeGreaterThanOrEqual(20.34 - 1e-7);
  });
  it('怪物挤压后仍会重新校验人物与建筑的间距', () => {
    const sim = new Simulation(); sim.player.x = 0; sim.player.z = 20.5;
    sim.boxColliders = [{ x: 0, z: 19, halfWidth: 2, halfDepth: 1 }];
    sim.monster.x = 0; sim.monster.z = 22.5; sim.monster.health = 0;
    sim.tick(1 / 60, idle);
    expect(sim.player.z).toBeGreaterThanOrEqual(20.34 - 1e-7);
  });
});

describe('建筑碰撞与宠物绕行', () => {
  it('镜头在建筑前收缩，无遮挡时保留完整距离', () => {
    const boxes = [{ x: 0, z: 4, halfWidth: 3, halfDepth: 2 }];
    expect(cameraSafeFraction({ x: 0, y: 2, z: 0 }, { x: 0, y: 3, z: 10 }, boxes, [], () => 0) * 10).toBeLessThan(4);
    expect(cameraSafeFraction({ x: 10, y: 2, z: 0 }, { x: 10, y: 3, z: 10 }, boxes, [], () => 0) * 10).toBe(10);
  });
  const boxes = [{ x: 0, z: 0, halfWidth: 2, halfDepth: 2 }];
  it('建筑角落和误落在墙内的坐标都会被推出', () => {
    const outside = resolveCircle({ x: .2, z: .4 }, .34, [], boxes);
    expect(Math.abs(outside.x) >= 2.34 || Math.abs(outside.z) >= 2.34).toBe(true);
    const corner = resolveCircle({ x: 2.1, z: 2.1 }, .34, [], boxes);
    expect(Math.hypot(corner.x - 2, corner.z - 2)).toBeGreaterThanOrEqual(.34 - 1e-7);
  });
  it('宠物沿建筑外侧绕到主角身边，全程不进入墙体', () => {
    let pet = { x: -4, z: 0 }; const player = { x: 4, z: -2.2 };
    for (let i = 0; i < 600; i++) {
      pet = followPet(pet, player, 1 / 60, [], boxes);
      const inside = Math.abs(pet.x) < 2 + .3 - 1e-6 && Math.abs(pet.z) < 2 + .3 - 1e-6;
      expect(inside).toBe(false);
    }
    expect(distance(pet, { x: player.x - 2.2, z: player.z + 1.1 })).toBeLessThan(.8);
  });
  it('低帧率下宠物跟随也不会隧穿建筑', () => {
    const pet = followPet({ x: 0, z: 3 }, { x: 0, z: -4 }, .25, [], boxes);
    expect(Math.abs(pet.z) >= 2.3 - 1e-7 || Math.abs(pet.x) >= 2.3 - 1e-7).toBe(true);
  });
});

describe('动态街区', () => {
  it('城市包含五种连贯风貌，高度与街区类型匹配', () => {
    const kinds = new Set<string>();
    for (let cx = -9; cx <= 9; cx++) for (let cz = -9; cz <= 9; cz++) {
      if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) continue;
      const layout = districtLayout(cx, cz);
      kinds.add(layout.kind);
      expect(layout.kind).toBe(districtKind(cx, cz));
      expect(layout.buildings.length).toBeGreaterThan(0);
      for (const building of layout.buildings) {
        if (layout.kind === 'skyscraper') expect(building.height).toBeGreaterThan(40);
        if (layout.kind === 'lane') expect(building.height).toBeLessThan(9);
        if (layout.kind === 'campus') expect([2, 3]).toContain(building.style);
      }
    }
    expect(kinds).toEqual(new Set(['skyscraper', 'office', 'lane', 'wutong', 'campus']));
    expect(districtKind(-4, 3)).toBe('skyscraper');
    expect(['浦东云际', '滨江金融城', '北外滩天际线']).toContain(districtName(-192, 144));
    expect(districtName(49, -45)).toBe('陆家嘴天际线');
  });
  it('人物可以越过旧版东西南北硬边界', () => {
    const east = new Simulation(); east.player.x = 68; east.player.z = 0;
    for (let i = 0; i < 60; i++) east.tick(1 / 60, { x: 1, z: 0, sprint: false });
    expect(east.player.x).toBeGreaterThan(69);
    const south = new Simulation(); south.player.x = 0; south.player.z = 58;
    for (let i = 0; i < 60; i++) south.tick(1 / 60, { x: 0, z: 1, sprint: false });
    expect(south.player.z).toBeGreaterThan(59);
  });
  it('同一街区卸载重进后布局确定，不同街区不会简单复制', () => {
    expect(districtLayout(3, -2)).toEqual(districtLayout(3, -2));
    expect(districtLayout(3, -2)).not.toEqual(districtLayout(4, -2));
    for (const b of districtLayout(3, -2).buildings) {
      expect(Math.abs(b.x - 3 * CHUNK_SIZE)).toBeLessThan(CHUNK_SIZE / 2);
      expect(Math.abs(b.z + 2 * CHUNK_SIZE)).toBeLessThan(CHUNK_SIZE / 2);
    }
    expect(nearbyChunkKeys(0, 0)).toHaveLength(25);
    expect(nearbyChunkKeys(73, 20)).toContain('2,0');
    expect(chunkCoordinate(-73)).toBe(-2);
  });
  it('街区碰撞回收不影响手工核心区障碍', () => {
    const sim = new Simulation(), fixed = { x: 1, z: 1, radius: 1 };
    sim.colliders = [fixed]; sim.boxColliders = [];
    const streamed = { x: 99, z: 99, halfWidth: 4, halfDepth: 5 };
    sim.addChunkColliders('2,2', [], [streamed]);
    expect(sim.boxColliders).toContain(streamed);
    sim.removeChunkColliders('2,2');
    expect(sim.boxColliders).toHaveLength(0);
    expect(sim.colliders).toEqual([fixed]);
  });
});

describe('城中祸害遭遇战', () => {
  it('第一夜的目标是野猫，前摇蓄力后才能造成伤害', () => {
    const sim = new Simulation();
    expect(sim.monster.kind).toBe('cat'); expect(sim.monster.health).toBe(420);
    reveal(sim); sim.player.x = sim.monster.x; sim.player.z = sim.monster.z + 6;
    advance(sim, 2); expect(sim.combat).toBe(true); expect(sim.player.health).toBe(sim.maxHealth);
    advance(sim, 2.5); expect(sim.player.health).toBeLessThan(sim.maxHealth);
  });
  it('超出攻击范围不扣血，且尊重攻击冷却', () => {
    const sim = new Simulation();
    expect(sim.attack()).toBe(true); expect(sim.monster.health).toBe(420);
    expect(sim.attack()).toBe(false);
    advance(sim, .7);
    closeToTarget(sim); strike(sim); expect(sim.monster.health).toBeLessThan(420);
    const hp = sim.monster.health; strike(sim); expect(sim.monster.health).toBe(hp);
  });
  it('攻击需要面向目标且不能隔着建筑命中', () => {
    const sim = new Simulation(); closeToTarget(sim); sim.player.facing = 0; strike(sim); expect(sim.monster.health).toBe(420);
    advance(sim, .7); sim.player.facing = Math.PI; sim.boxColliders = [{ x: sim.monster.x, z: sim.monster.z + 1.2, halfWidth: 2, halfDepth: .2 }];
    sim.attackCooldown = 0; strike(sim); expect(sim.monster.health).toBe(420);
    sim.boxColliders = []; advance(sim, .7); closeToTarget(sim); strike(sim); expect(sim.monster.health).toBeLessThan(420);
  });
  it('冲撞受击只产生有限击退，不会持续推动玩家', () => {
    const sim = new Simulation(); sim.player.x = 0; sim.player.z = 0;
    sim.monster.x = 0; sim.monster.z = -1; sim.hurt(23, sim.monster);
    advance(sim, .25); const displacement = Math.hypot(sim.player.x, sim.player.z);
    expect(displacement).toBeGreaterThan(.5); expect(displacement).toBeLessThan(1.3);
    advance(sim, .5); expect(Math.hypot(sim.player.x, sim.player.z)).toBeCloseTo(displacement, 1);
  });
  it('目标收势时重击有加成并打出硬直', () => {
    const normal = new Simulation(), opening = new Simulation();
    for (const sim of [normal, opening]) closeToTarget(sim);
    opening.monster.action = 'recover'; strike(normal, true); strike(opening, true);
    expect(opening.monster.health).toBeLessThan(normal.monster.health);
    expect(opening.monster.action).toBe('stagger');
  });
  it('受伤后拉开距离即可脱战，不会每帧重开战斗', () => {
    const sim = new Simulation(); sim.monster.health = 300; sim.combat = true; sim.player.x = -60; sim.player.z = 55;
    sim.streetEnemies.forEach((enemy, i) => { enemy.x = -60; enemy.z = 85 + i * 2; enemy.action = 'idle'; });
    sim.tick(.016, idle); expect(sim.combat).toBe(false);
    const notices = sim.notifications.length; advance(sim, 1);
    expect(sim.combat).toBe(false); expect(sim.notifications.length).toBe(notices);
  });
  it('收缴只结算一次，奖励落袋，升级保留到新的一夜', () => {
    const save = vi.fn(), sim = new Simulation(undefined, undefined, save);
    closeToTarget(sim); sim.monster.health = 10; strike(sim);
    expect(sim.questPhase).toBe('harvest'); expect(sim.monster.action).toBe('dead');
    expect(sim.interact()).toBe(true);
    expect(sim.questPhase).toBe('complete');
    expect(sim.progress.hunts).toBe(1);
    expect(sim.progress.cash).toBe(1150);
    expect(sim.progress.parts).toBe(6);
    expect(sim.interact()).toBe(false); expect(sim.progress.parts).toBe(6);
    expect(sim.levelUp()).toBe(true);
    expect(sim.progress.level).toBe(2); expect(sim.progress.parts).toBe(2); expect(sim.progress.cash).toBe(750);
    expect(sim.levelUp()).toBe(false);
    sim.newHunt();
    expect(sim.progress.level).toBe(2);
    expect(sim.monster.health).toBe(ROSTER[1].hp + 60);
    expect(sim.monster.kind).toBe('dog');
    expect(sim.questPhase).toBe('tracking');
    expect(sim.player.health).toBe(sim.maxHealth);
    expect(save).toHaveBeenCalled();
  });
  it('战败不丢材料，重整旗鼓再战', () => {
    const sim = new Simulation(); sim.progress.parts = 9; sim.hurt(500);
    expect(sim.dead).toBe(true); expect(sim.attack()).toBe(false);
    sim.newHunt();
    expect(sim.dead).toBe(false); expect(sim.player.health).toBe(sim.maxHealth);
    expect(sim.progress.parts).toBe(9);
  });
});

describe('都市天象', () => {
  it('晴夜→雾霾→暴雨循环，晴夜奶茶摊重新出摊', () => {
    const sim = new Simulation();
    sim.resources.find(r => r.kind === 'snack')!.collected = true;
    sim.weatherTime = WEATHER_DURATION - .01; sim.tick(.02, idle);
    expect(sim.weather).toBe('雾霾');
    sim.cycleWeather(); expect(sim.weather).toBe('暴雨');
    sim.cycleWeather(); expect(sim.weather).toBe('晴夜');
    expect(sim.resources.find(r => r.kind === 'snack')!.collected).toBe(false);
  });
  it('雾霾天气体力恢复更慢但仍可恢复', () => {
    const clear = new Simulation(), haze = new Simulation();
    haze.weather = '雾霾'; clear.player.stamina = 10; haze.player.stamina = 10;
    advance(clear, 2); advance(haze, 2);
    expect(haze.player.stamina).toBeGreaterThan(10);
    expect(haze.player.stamina).toBeLessThan(clear.player.stamina);
  });
  it('简化升级：侠义等级封顶 5 级，攻防随等级成长', () => {
    const progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS)) as typeof DEFAULT_PROGRESS;
    progress.parts = 100; progress.cash = 10000;
    const sim = new Simulation(progress);
    expect(sim.maxHealth).toBe(100); expect(sim.attackDamage).toBe(44);
    expect(sim.levelUp()).toBe(true);
    expect(sim.maxHealth).toBe(118); expect(sim.attackDamage).toBe(57);
    expect(sim.player.health).toBe(118);
    for (let i = 0; i < 10; i++) sim.levelUp();
    expect(sim.progress.level).toBe(5);
    expect(sim.maxHealth).toBe(172);
    expect(sim.levelUp()).toBe(false);
  });
  it('装备切换与宠物选择都会写回存档', () => {
    const save = vi.fn(), sim = new Simulation(undefined, undefined, save);
    expect(sim.equip('baton')).toBe(true);
    expect(sim.progress.weapon).toBe('baton'); expect(sim.attackDamage).toBe(30);
    expect(sim.setPet('shiba')).toBe(true);
    expect(sim.progress.pet).toBe('shiba');
    expect(save).toHaveBeenCalled();
    const restored = readProgress(JSON.stringify(sim.progress));
    expect(restored.pet).toBe('shiba'); expect(restored.weapon).toBe('baton');
  });
});


describe('第二轮：跨城区委托与成长', () => {
  it('调查完成前目标不会受伤或被锁定', () => {
    const sim = new Simulation(); sim.player.x = sim.monster.x; sim.player.z = sim.monster.z + 2.4; sim.player.facing = Math.PI;
    sim.toggleLock(); expect(sim.locked).toBe(false);
    strike(sim); expect(sim.monster.health).toBe(sim.monster.maxHealth); advance(sim, .7);
    for (const clue of sim.resources.filter(r => r.kind === 'clue')) { sim.player.x = clue.x; sim.player.z = clue.z; expect(sim.interact()).toBe(true); }
    expect(sim.targetRevealed).toBe(true); sim.player.x = sim.monster.x; sim.player.z = sim.monster.z + 2.4; sim.player.facing = Math.PI; sim.attackCooldown = 0;
    strike(sim); expect(sim.monster.health).toBeLessThan(sim.monster.maxHealth);
  });
  it('后续夜晚轮换五种城区，并使用确定性的道路交汇点', () => {
    const expected = ['lane', 'office', 'campus', 'skyscraper', 'wutong'];
    expected.forEach((kind, index) => {
      const site = huntSite(index + 1); expect(site.kind).toBe(kind); expect(huntSite(index + 1)).toEqual(site);
      expect(Math.max(Math.abs(site.x), Math.abs(site.z))).toBeGreaterThanOrEqual(CHUNK_SIZE * 2); expect(site.name.length).toBeGreaterThan(2);
    });
    const progress = { ...DEFAULT_PROGRESS, hunts: 1 }, sim = new Simulation(progress), site = huntSite(1);
    expect(sim.questDistrict).toBe(site.name); expect(sim.resources[0]).toMatchObject({ x: site.x, z: site.z + 15 });
    sim.progress.hunts = 2; sim.newHunt(); const next = huntSite(2);
    expect(sim.resources[0]).toMatchObject({ x: next.x, z: next.z + 15 }); expect(sim.petCooldown).toBe(0);
  });
  it('街坊求助有独立交互与区域奖励，且只能办理一次', () => {
    const sim = new Simulation(), event = sim.resources.find(r => r.kind === 'event')!; sim.player.x = event.x; sim.player.z = event.z;
    expect(sim.getInteraction()?.label).toBe('帮助街坊'); expect(sim.interact()).toBe(true);
    expect(sim.progress.cash).toBe(510); expect(sim.progress.parts).toBe(3); expect(event.collected).toBe(true);
    expect(sim.interact()).toBe(false); expect(sim.progress.cash).toBe(510);
  });
  it('三种宠物主动技都有实际效果与冷却', () => {
    const sim = new Simulation(); sim.player.health = 50;
    expect(sim.petSkill()).toBe(true); expect(sim.player.health).toBe(64); expect(sim.player.invulnerable).toBeGreaterThan(1); expect(sim.petCooldown).toBe(24);
    expect(sim.petSkill()).toBe(false);
    sim.setPet('corgi'); sim.petCooldown = 0; sim.player.stamina = 10; expect(sim.petSkill()).toBe(true); expect(sim.player.stamina).toBe(54);
    sim.setPet('shiba'); sim.petCooldown = 0; expect(sim.petSkill()).toBe(true); expect(sim.notifications.at(-1)?.title).toBe('柴犬寻踪');
  });
  it('橘猫被动减伤、宠物训练和兵器精修会消耗材料并存档', () => {
    const guarded = new Simulation(); guarded.hurt(23); expect(guarded.player.health).toBe(80);
    const save = vi.fn(), progress = { ...DEFAULT_PROGRESS, parts: 50, cash: 10000 }, sim = new Simulation(progress, undefined, save);
    expect(sim.trainPet()).toBe(true); expect(sim.progress).toMatchObject({ petLevel: 2, parts: 47, cash: 9500 });
    const damage = sim.attackDamage; expect(sim.refineWeapon()).toBe(true);
    expect(sim.progress).toMatchObject({ weaponLevel: 1, parts: 43, cash: 8900 }); expect(sim.attackDamage).toBe(damage + 5); expect(save).toHaveBeenCalledTimes(2);
  });
  it('第四夜是精英委托，血量与现金、零件悬赏同步提高', () => {
    const progress = { ...DEFAULT_PROGRESS, hunts: 3 }, sim = new Simulation(progress);
    expect(sim.elite).toBe(true); expect(sim.questReward).toBe(1650); expect(sim.monster.maxHealth).toBe(Math.round(sim.nextMonsterHealth * 1.3));
    closeToTarget(sim); sim.monster.health = 10; strike(sim); expect(sim.questPhase).toBe('harvest'); expect(sim.interact()).toBe(true);
    expect(sim.progress.cash).toBe(2000); expect(sim.progress.parts).toBe(8);
  });
});

describe('第二轮：敌人行为差异', () => {
  it('行为分组覆盖七类目标', () => {
    expect(ROSTER.map(entry => monsterBehavior(entry.kind))).toEqual(['skirmisher', 'skirmisher', 'vehicle', 'vehicle', 'bruiser', 'bruiser', 'elite']);
  });
  it('地痞格挡减免普攻，重击可以破防并打出硬直', () => {
    const normal = new Simulation({ ...DEFAULT_PROGRESS, hunts: 4 }), heavy = new Simulation({ ...DEFAULT_PROGRESS, hunts: 4 });
    closeToTarget(normal); closeToTarget(heavy); normal.monster.action = heavy.monster.action = 'guard';
    strike(normal); expect(normal.monster.maxHealth - normal.monster.health).toBe(15);
    strike(heavy, true); expect(heavy.monster.action).toBe('stagger'); expect(heavy.monster.timer).toBeGreaterThan(1.9);
    expect(heavy.monster.maxHealth - heavy.monster.health).toBeGreaterThan(normal.monster.maxHealth - normal.monster.health);
  });
  it('车辆高速撞墙会收势不住，进入长硬直', () => {
    const sim = new Simulation({ ...DEFAULT_PROGRESS, hunts: 2 }); reveal(sim); sim.combat = true;
    sim.monster.x = 0; sim.monster.z = 0; sim.monster.action = 'charge'; sim.monster.timer = 1; sim.monster.chargeX = 0; sim.monster.chargeZ = -1;
    sim.player.x = 0; sim.player.z = 20; sim.boxColliders = [{ x: 0, z: -1.5, halfWidth: 3, halfDepth: 1 }];
    sim.tick(.05, idle); expect(sim.monster.action).toBe('stagger'); expect(sim.monster.timer).toBeGreaterThan(2.4);
  });
  it('脱战只恢复四分之一最大气血，不会瞬间回满', () => {
    const sim = new Simulation(); reveal(sim); sim.combat = true; sim.monster.health = 300; sim.player.x = -60; sim.player.z = 55;
    sim.tick(.016, idle); expect(sim.combat).toBe(false); expect(sim.monster.health).toBe(405);
  });
});

describe('第一轮：有界街区缓存', () => {
  it('大量经过不同街区后布局缓存仍有硬上限', () => {
    for (let i = 0; i < 300; i++) districtLayout(10 + i, 20);
    expect(districtLayoutCacheSize()).toBeLessThanOrEqual(LAYOUT_CACHE_LIMIT);
    expect(districtLayout(3, -2)).toEqual(districtLayout(3, -2));
  });
});


describe('持续街区夜巡', () => {
  it('街区游荡目标无需调查即可攻击，前摇阶段不会无预警扣血', () => {
    const sim = new Simulation(), enemy = sim.streetEnemies[0];
    sim.player.x = 0; sim.player.z = 0; sim.player.facing = 0;
    enemy.x = 0; enemy.z = 4.5; enemy.action = 'stalk'; enemy.timer = 0;
    const health = sim.player.health; sim.tick(.016, idle);
    expect(enemy.action).toBe('windup'); expect(sim.player.health).toBe(health);
    enemy.z = 1.5; enemy.health = 100; strike(sim);
    expect(enemy.health).toBeLessThan(100); expect(sim.tracked).toBe(0); expect(sim.targetRevealed).toBe(false);
  });

  it('制伏游荡目标获得小额奖励、延时补位，且不增加主委托计数', () => {
    const save = vi.fn(), sim = new Simulation(undefined, undefined, save), enemy = sim.streetEnemies[0];
    sim.player.x = 0; sim.player.z = 0; sim.player.facing = 0;
    sim.streetEnemies.forEach((other, i) => { other.x = 0; other.z = 42 + i * 2; other.action = 'idle'; });
    enemy.x = 0; enemy.z = 1.4; enemy.health = 10; enemy.action = 'recover';
    const cash = sim.progress.cash, id = enemy.id;
    strike(sim);
    expect(sim.streetDefeated).toBe(1); expect(sim.progress.cash).toBeGreaterThan(cash);
    expect(sim.progress.hunts).toBe(0); expect(sim.questPhase).toBe('tracking'); expect(save).toHaveBeenCalled();
    expect(sim.streetEnemies).toHaveLength(3); expect(sim.snapshot().streetActive).toBe(2);
    advance(sim, 5.2);
    expect(sim.streetEnemies).toHaveLength(3); expect(sim.streetEnemies[0].id).not.toBe(id);
    expect(sim.streetEnemies[0].health).toBeGreaterThan(0); expect(sim.progress.hunts).toBe(0);
  });

  it('远离旧区域后游荡目标会在附近安全重定位，且数量始终封顶三个', () => {
    const sim = new Simulation(); sim.player.x = 0; sim.player.z = 20;
    sim.boxColliders.push({ x: -12, z: 20, halfWidth: 3, halfDepth: 3 });
    const oldIds = sim.streetEnemies.map(enemy => enemy.id);
    sim.streetEnemies.forEach(enemy => { enemy.x = 80; enemy.z = 80; });
    sim.tick(.016, idle);
    expect(sim.streetEnemies).toHaveLength(3);
    sim.streetEnemies.forEach((enemy, i) => {
      expect(enemy.id).not.toBe(oldIds[i]); expect(Math.hypot(enemy.x - sim.player.x, enemy.z - sim.player.z)).toBeLessThan(30);
      expect(Math.abs(enemy.x - riverX(enemy.z))).toBeGreaterThanOrEqual(8.7);
      expect(sim.boxColliders.some(b => Math.abs(enemy.x - b.x) < b.halfWidth && Math.abs(enemy.z - b.z) < b.halfDepth)).toBe(false);
    });
    advance(sim, 30); expect(sim.streetEnemies).toHaveLength(3);
  });
});
