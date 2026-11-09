import type { GameEvent, InputState, MonsterAction, MonsterKind, Notification, Pet, Point, Progress, Resource, Skin, Snapshot, Weather, Weapon } from './types';
import { moveCircle, resolveCircle, hasLineOfSight } from './collision';
import type { BoxCollider, CircleCollider } from './collision';
import { CHUNK_SIZE, districtKind, districtKindLabel, districtName } from './districts';
import { riverX } from './materials';
import type { UrbanKind } from './architecture';

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const WEATHER_DURATION = 100;
export const SAVE_KEY = 'shanghai-night-watch-v1';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const PETS: { id: Pet; name: string; desc: string; skill: string }[] = [
  { id: 'orangeCat', name: '橘猫', desc: '大橘为重，减伤护主', skill: '橘座守护' },
  { id: 'corgi', name: '柯基', desc: '短腿电臀，体力充沛', skill: '电臀冲刺' },
  { id: 'shiba', name: '柴犬', desc: '机警认路，嗅觉搜证', skill: '柴犬寻踪' },
];
export const PET_NAMES: Record<Pet, string> = { orangeCat: '橘座', corgi: '基哥', shiba: '柴大侠' };

export const ROSTER: { kind: MonsterKind; name: string; title: string; hp: number }[] = [
  { kind: 'cat', name: '野猫', title: '窜逃翻包的野猫', hp: 420 },
  { kind: 'dog', name: '不栓绳的野狗', title: '不栓绳还乱扑的野狗', hp: 560 },
  { kind: 'ebike', name: '无牌电驴', title: '逆行乱窜的无牌电驴', hp: 700 },
  { kind: 'racer', name: '鬼火少年', title: '深夜炸街的鬼火少年', hp: 860 },
  { kind: 'hooligan', name: '地痞流氓', title: '收保护费的地痞流氓', hp: 1020 },
  { kind: 'robber', name: '强盗', title: '持刀抢劫的强盗', hp: 1200 },
  { kind: 'official', name: '贪官', title: '连夜外逃的贪官', hp: 1460 },
];
export const WEAPONS: { id: Weapon; name: string; desc: string; unlockLevel: number }[] = [
  { id: 'crowbar', name: '碳纤维战术棍', desc: '沉稳重击 · 防滑握柄', unlockLevel: 1 },
  { id: 'baton', name: '钛合金伸缩棍', desc: '快速连击 · 三节伸缩', unlockLevel: 1 },
  { id: 'umbrella', name: '霓虹长柄战术伞', desc: '攻守均衡 · 侠义三级解锁', unlockLevel: 3 },
];
export const SKINS: { id: Skin; name: string; desc: string; palette: string[] }[] = [
  { id: 'nightwatch', name: '夜鹰巡衣', desc: '藏青长风衣 · 铜扣连帽', palette: ['#28475f', '#3f8d91', '#bd8d4e'] },
  { id: 'magnolia', name: '白玉兰礼装', desc: '月白长外套 · 酒红玉兰金饰', palette: ['#d8d2bd', '#8f3648', '#d2ac59'] },
  { id: 'neon', name: '霓虹行者', desc: '紫黑短披风 · 青色光导护目镜', palette: ['#29263e', '#3fe2dc', '#784dba'] },
];
export const weaponUnlocked = (weapon: Weapon, level: number) => (WEAPONS.find(w => w.id === weapon)?.unlockLevel ?? 99) <= level;

export interface HuntSite extends Point { kind: UrbanKind; name: string }
/** Each later commission uses a deterministic road junction in a different urban neighbourhood. */
export function huntSite(hunt: number): HuntSite {
  if (hunt === 0) return { x: 8, z: -12, kind: 'wutong', name: '梧桐夜巷' };
  const wanted: UrbanKind[] = ['lane', 'office', 'campus', 'skyscraper', 'wutong'];
  const kind = wanted[(hunt - 1) % wanted.length];
  for (let ring = 2; ring <= 6; ring++) {
    for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      const cx = dx + (hunt % 2), cz = dz - (hunt % 3);
      if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1 || districtKind(cx, cz) !== kind) continue;
      const x = cx * CHUNK_SIZE, z = cz * CHUNK_SIZE;
      return { x, z, kind, name: districtName(x, z) };
    }
  }
  return { x: 8, z: -12, kind, name: districtKindLabel[kind] };
}
export const monsterBehavior = (kind: MonsterKind) => kind === 'cat' || kind === 'dog' ? 'skirmisher'
  : kind === 'ebike' || kind === 'racer' ? 'vehicle' : kind === 'hooligan' || kind === 'robber' ? 'bruiser' : 'elite';

export const DEFAULT_PROGRESS: Progress = {
  version: 2, parts: 2, cash: 350, level: 1, weapon: 'crowbar', hunts: 0, pet: 'orangeCat', skin: 'nightwatch', petLevel: 1, weaponLevel: 0,
};
export function readProgress(raw: string | null): Progress {
  try {
    const p = JSON.parse(raw || 'null');
    if (!p || (p.version !== 2 && p.version !== 1)) return clone(DEFAULT_PROGRESS);
    const number = (n: unknown, fallback: number, max = 99999) => typeof n === 'number' && Number.isFinite(n) ? clamp(Math.floor(n), 0, max) : fallback;
    const level = clamp(number(p.level, 1), 1, 5);
    const requestedWeapon = p.weapon === 'baton' || p.weapon === 'umbrella' ? p.weapon as Weapon : 'crowbar';
    return {
      version: 2,
      parts: number(p.parts, 0), cash: number(p.cash, 350), level,
      weapon: weaponUnlocked(requestedWeapon, level) ? requestedWeapon : 'crowbar',
      hunts: number(p.hunts, 0, 999),
      pet: p.pet === 'corgi' || p.pet === 'shiba' ? p.pet : 'orangeCat',
      skin: p.skin === 'magnolia' || p.skin === 'neon' ? p.skin : 'nightwatch',
      petLevel: clamp(number(p.petLevel, 1), 1, 3), weaponLevel: clamp(number(p.weaponLevel, 0), 0, 3),
    };
  } catch { return clone(DEFAULT_PROGRESS); }
}

export interface StreetEnemy {
  id: number; slot: number; kind: MonsterKind; x: number; z: number; facing: number;
  health: number; maxHealth: number; action: MonsterAction; timer: number;
  enraged: false; chargeX: number; chargeZ: number; attackCount: number;
  respawn: number; attackDone: boolean;
}
export const STREET_SLOTS = 3;

export class Simulation {
  player = { x: 0, z: 20, facing: Math.PI, health: 100, stamina: 100, attackTime: 0, dodgeTime: 0, invulnerable: 0, sprinting: false, moving: false, combo: 0, knockbackTime: 0, knockbackX: 0, knockbackZ: 0 };
  monster = { x: 8, z: -12, facing: -0.85, health: 640, maxHealth: 640, action: 'idle' as MonsterAction, timer: 4, enraged: false, chargeX: 0, chargeZ: 0, attackCount: 0, kind: 'cat' as MonsterKind };
  progress: Progress;
  resources: Resource[] = [];
  streetEnemies: StreetEnemy[] = [];
  streetDefeated = 0;
  private streetSerial = 0;
  private streetEngaged = false;
  private mainCombat = false;
  colliders: CircleCollider[] = [];
  boxColliders: BoxCollider[] = [];
  potions = 5; time = 0; weather: Weather = '晴夜'; weatherTime = 0; tracked = 0;
  questPhase: Snapshot['questPhase'] = 'tracking'; dead = false; locked = false; paused = false; combat = false;
  saveStatus: Snapshot['saveStatus'] = 'idle';
  attackCooldown = 0; healingCooldown = 0; petCooldown = 0; notifications: Notification[] = [];
  private noticeId = 0;
  private noticeTimes = new Map<number, number>();
  private dodgeDirection = { x: 0, z: 1 };
  private lastInput: InputState = { x: 0, z: 0, sprint: false };
  private comboTimer = 0; private monsterHit = false; private idleHeal = 0;
  private event: (event: GameEvent) => void;
  private save: (progress: Progress) => void;
  private streamedColliders = new Map<string, { circles: Set<CircleCollider>; boxes: Set<BoxCollider> }>();

  constructor(progress?: Progress, event: (e: GameEvent) => void = () => { }, save: (p: Progress) => void = () => { }) {
    this.progress = progress ? clone(progress) : clone(DEFAULT_PROGRESS);
    this.event = event;
    this.save = progress => {
      try { save(progress); this.saveStatus = 'saved'; }
      catch { this.saveStatus = 'failed'; }
    };
    this.player.health = this.maxHealth;
    this.setMonsterForHunt(this.progress.hunts);
    this.resetResources();
    for (let slot = 0; slot < STREET_SLOTS; slot++) this.resetStreetEnemy(slot, true);
  }
  retrySave() { this.save(this.progress); return this.saveStatus === 'saved'; }
  get maxHealth() { return 100 + (this.progress.level - 1) * 18; }
  get rosterEntry() { return ROSTER[this.progress.hunts % ROSTER.length]; }
  get monsterName() { return this.rosterEntry.name; }
  get monsterTitle() { return this.rosterEntry.title; }
  get nextMonsterHealth() { return this.rosterEntry.hp + Math.floor(this.progress.hunts / ROSTER.length) * 220 + Math.min(this.progress.hunts % ROSTER.length, 4) * 60; }
  get attackDamage() { return (this.progress.weapon === 'crowbar' ? 44 : this.progress.weapon === 'umbrella' ? 38 : 30) + (this.progress.level - 1) * 13 + this.progress.weaponLevel * 5; }
  get questReward() { return Math.round((800 + this.progress.hunts * 100) * (this.elite ? 1.5 : 1)); }
  get elite() { return this.progress.hunts > 0 && (this.progress.hunts + 1) % 4 === 0 || this.rosterEntry.kind === 'official'; }
  get targetRevealed() { return this.tracked >= 3 || this.questPhase === 'harvest' || this.questPhase === 'complete'; }
  get questDistrict() { return huntSite(this.progress.hunts).name; }
  get petSkillName() { return PETS.find(p => p.id === this.progress.pet)?.skill ?? '宠物技能'; }
  private setMonsterForHunt(hunt: number) {
    const entry = ROSTER[hunt % ROSTER.length];
    this.monster.kind = entry.kind;
    this.monster.maxHealth = this.monster.health = Math.round((entry.hp + Math.floor(hunt / ROSTER.length) * 220 + Math.min(hunt % ROSTER.length, 4) * 60) * (this.elite ? 1.3 : 1));
    const site = huntSite(hunt); this.monster.x = site.x; this.monster.z = site.z - (hunt === 0 ? 0 : 9);
  }
  resetResources() {
    const site = huntSite(this.progress.hunts), remote = this.progress.hunts > 0;
    const clueX = remote ? site.x : 1.2, clueZ = remote ? site.z + 15 : 12.8;
    this.resources = [
      { id: 'clue-1', kind: 'clue', x: clueX, z: clueZ, collected: false },
      { id: 'clue-2', kind: 'clue', x: remote ? site.x + 1.5 : 3.6, z: remote ? site.z + 8 : 5.2, collected: false },
      { id: 'clue-3', kind: 'clue', x: remote ? site.x - 1 : 7.1, z: remote ? site.z + 1 : -2.3, collected: false },
      { id: 'snack-1', kind: 'snack', x: site.x - 3, z: site.z + 16, collected: false },
      { id: 'snack-2', kind: 'snack', x: site.x + 3, z: site.z + 5, collected: false },
      { id: 'snack-3', kind: 'snack', x: -12, z: -14, collected: false },
      { id: 'parts-1', kind: 'parts', x: site.x + 3, z: site.z + 17, collected: false },
      { id: 'parts-2', kind: 'parts', x: site.x - 3, z: site.z - 2, collected: false },
      { id: 'parts-3', kind: 'parts', x: 12, z: 28, collected: false },
      { id: 'event-1', kind: 'event', x: site.x + 3, z: site.z + 11, collected: false },
    ];
  }
  /** Streamed obstacles are removed by identity when their district leaves the active radius. */
  addChunkColliders(key: string, circles: CircleCollider[], boxes: BoxCollider[]) {
    this.removeChunkColliders(key);
    this.streamedColliders.set(key, { circles: new Set(circles), boxes: new Set(boxes) });
    this.colliders.push(...circles); this.boxColliders.push(...boxes);
  }
  removeChunkColliders(key: string) {
    const active = this.streamedColliders.get(key);
    if (!active) return;
    this.colliders = this.colliders.filter(c => !active.circles.has(c));
    this.boxColliders = this.boxColliders.filter(b => !active.boxes.has(b));
    this.streamedColliders.delete(key);
  }
  notify(title: string, description: string, kind: Notification['kind'] = 'info') {
    const id = ++this.noticeId;
    this.notifications = [...this.notifications.slice(-2), { id, title, description, kind }];
    this.noticeTimes.set(id, this.time);
  }
  tick(dt: number, input: InputState) {
    if (this.paused || this.dead) return;
    dt = clamp(dt, 0, 0.05); this.time += dt; this.weatherTime += dt;
    if (this.weatherTime >= WEATHER_DURATION) this.cycleWeather();
    this.lastInput = input;
    this.notifications = this.notifications.filter(n => {
      if (this.time - (this.noticeTimes.get(n.id) ?? 0) < 6) return true;
      this.noticeTimes.delete(n.id); return false;
    });
    const p = this.player;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt); this.healingCooldown = Math.max(0, this.healingCooldown - dt);
    this.petCooldown = Math.max(0, this.petCooldown - dt * (this.weather === '晴夜' ? 1.15 : 1));
    p.attackTime = Math.max(0, p.attackTime - dt); p.invulnerable = Math.max(0, p.invulnerable - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt); if (!this.comboTimer) p.combo = 0;
    const length = Math.hypot(input.x, input.z);
    p.moving = length > 0.05; p.sprinting = input.sprint && p.moving && p.stamina > 2 && !p.attackTime;
    const movement = { x: 0, z: 0 };
    if (p.dodgeTime > 0) {
      p.dodgeTime -= dt; movement.x = this.dodgeDirection.x * 13 * dt; movement.z = this.dodgeDirection.z * 13 * dt;
    } else if (p.knockbackTime > 0) {
      p.knockbackTime = Math.max(0, p.knockbackTime - dt);
      movement.x = p.knockbackX * dt; movement.z = p.knockbackZ * dt;
    } else if (p.moving) {
      const speed = (p.sprinting ? 7.8 : 4.5) * (p.attackTime ? 0.35 : 1);
      movement.x = input.x / Math.max(1, length) * speed * dt; movement.z = input.z / Math.max(1, length) * speed * dt;
      if (!this.locked) p.facing += angleDelta(p.facing, Math.atan2(input.x, input.z)) * Math.min(1, dt * 14);
    }
    const moved = moveCircle(p, movement, .34, this.colliders, this.boxColliders);
    p.x = moved.x; p.z = moved.z;
    if (this.locked && this.monster.health > 0) p.facing += angleDelta(p.facing, Math.atan2(this.monster.x - p.x, this.monster.z - p.z)) * Math.min(1, dt * 15);
    if (p.sprinting) p.stamina = Math.max(0, p.stamina - dt * 13);
    else if (p.dodgeTime <= 0 && !p.attackTime) p.stamina = Math.min(100, p.stamina + dt * (this.weather === '雾霾' ? 17 : 21) + dt * (this.progress.pet === 'corgi' ? this.progress.petLevel * 3 : 0));
    this.updateMonster(dt);
    this.updateStreetThreats(dt);
    this.combat = this.mainCombat || this.streetEngaged;
    if (this.monster.health > 0 && p.dodgeTime <= 0 && p.knockbackTime <= 0 && this.monster.action !== 'charge') {
      const dx = p.x - this.monster.x, dz = p.z - this.monster.z, d = Math.hypot(dx, dz);
      const minimum = this.monster.kind === 'ebike' || this.monster.kind === 'racer' ? 1.35 : 1.05;
      if (d < minimum) {
        const push = Math.min(.1, (minimum - d) * .22), angle = d > .001 ? Math.atan2(dx, dz) : p.facing + Math.PI;
        const separated = moveCircle(p, { x: Math.sin(angle) * push, z: Math.cos(angle) * push }, .34, this.colliders, this.boxColliders);
        p.x = separated.x; p.z = separated.z;
      }
    }
    const resolved = resolveCircle(p, .34, this.colliders, this.boxColliders);
    p.x = resolved.x; p.z = resolved.z;
    if (!this.combat && this.questPhase !== 'harvest') { this.idleHeal += dt; if (this.idleHeal > 10) p.health = Math.min(this.maxHealth, p.health + dt * 2); }
    else this.idleHeal = 0;
  }
  updateMonster(dt: number) {
    const m = this.monster, p = this.player, behavior = monsterBehavior(m.kind);
    if (m.health <= 0) { m.action = 'dead'; return; }
    if (this.combat && !this.streetEngaged) this.mainCombat = true;
    let dist = distance(m, p); m.timer -= dt;
    const toPlayer = Math.atan2(p.x - m.x, p.z - m.z);
    if (!this.mainCombat && this.targetRevealed && dist < 13) {
      this.mainCombat = true; this.questPhase = 'hunting';
      this.notify('目标现身', `${this.monsterTitle}盯上了你。看清前摇，侧身闪避！`, 'warning');
      m.action = 'stalk'; m.timer = 1.7; this.event({ type: 'roar', kind: m.kind });
    }
    if (!this.mainCombat) {
      if (m.timer < 0) { m.action = m.action === 'idle' ? 'stalk' : 'idle'; m.timer = m.action === 'idle' ? 6 : 3; }
      return;
    }
    if (m.health < m.maxHealth * (this.elite ? .55 : .4) && !m.enraged) {
      m.enraged = true; this.notify(this.elite ? '精英目标暴怒' : '它急眼了', '动作明显变快，等它收势的间隙再反击。', 'warning'); this.event({ type: 'roar', kind: m.kind });
    }
    const enrage = m.enraged ? 1.22 : 1, rain = this.weather === '暴雨' ? behavior === 'vehicle' ? 1.18 : 1.05 : 1;
    switch (m.action) {
      case 'idle': m.action = 'stalk'; m.timer = 1; break;
      case 'stalk': {
        const turn = behavior === 'vehicle' ? 1.15 : behavior === 'skirmisher' ? 3.6 : 2.4;
        m.facing += angleDelta(m.facing, toPlayer) * Math.min(1, dt * turn);
        const preferred = behavior === 'bruiser' ? 3.7 : behavior === 'vehicle' ? 7 : 4.4;
        if (dist > preferred) {
          const base = behavior === 'skirmisher' ? 3.1 : behavior === 'vehicle' ? 2.8 : behavior === 'elite' ? 2.9 : 2.3;
          const moved = moveCircle(m, { x: Math.sin(toPlayer) * dt * base * enrage * rain, z: Math.cos(toPlayer) * dt * base * enrage * rain }, .46, this.colliders, this.boxColliders);
          m.x = moved.x; m.z = moved.z;
        }
        if (m.timer <= 0 && dist < (behavior === 'vehicle' ? 22 : 14)) {
          if (behavior === 'bruiser' && m.attackCount % 3 === 2) { m.action = 'guard'; m.timer = 1.35; m.attackCount++; break; }
          m.action = 'windup'; m.timer = (behavior === 'skirmisher' ? .95 : behavior === 'vehicle' ? 1.4 : behavior === 'elite' ? .85 : 1.1) * (m.enraged ? .82 : 1);
          this.monsterHit = false; m.attackCount++; this.event({ type: 'roar', kind: m.kind });
        }
        break;
      }
      case 'guard':
        m.facing += angleDelta(m.facing, toPlayer) * Math.min(1, dt * 2);
        if (m.timer <= 0) { m.action = 'stalk'; m.timer = 1.2; }
        break;
      case 'windup':
        m.facing += angleDelta(m.facing, toPlayer) * Math.min(1, dt * (behavior === 'vehicle' ? .7 : 1.5));
        if (m.timer <= 0) {
          m.action = 'charge'; m.timer = behavior === 'vehicle' ? 1.05 : behavior === 'skirmisher' ? .58 : behavior === 'elite' ? .72 : .65;
          m.chargeX = Math.sin(m.facing); m.chargeZ = Math.cos(m.facing);
        }
        break;
      case 'charge': {
        const base = behavior === 'vehicle' ? 18 : behavior === 'skirmisher' ? 12 : behavior === 'elite' ? 14 : 10;
        const beforeX = m.x, beforeZ = m.z;
        const moved = moveCircle(m, { x: m.chargeX * dt * base * enrage * rain, z: m.chargeZ * dt * base * enrage * rain }, .46, this.colliders, this.boxColliders);
        m.x = moved.x; m.z = moved.z; dist = distance(m, p);
        const hitRange = behavior === 'vehicle' ? 2.15 : 1.85;
        if (dist < hitRange && !this.monsterHit) {
          const damage = behavior === 'skirmisher' ? 18 : behavior === 'vehicle' ? 26 : behavior === 'elite' ? 28 : 24;
          this.hurt(damage + (m.enraged ? 6 : 0), m); this.monsterHit = true;
        }
        const blocked = Math.hypot(moved.x - beforeX, moved.z - beforeZ) < base * dt * .25;
        if (blocked && behavior === 'vehicle') { m.action = 'stagger'; m.timer = 2.6; this.notify('撞上障碍了', '电驴收势不住，趁现在反击！', 'success'); }
        else if (m.timer <= 0) { m.action = 'recover'; m.timer = (behavior === 'vehicle' ? 2.8 : behavior === 'skirmisher' ? 1.8 : behavior === 'elite' ? 1.65 : 2.2) * (m.enraged ? .82 : 1); }
        break;
      }
      case 'recover': case 'stagger':
        if (m.timer <= 0) { m.action = 'stalk'; m.timer = m.enraged ? 1.1 : 1.8; }
        break;
    }
    if (dist > 38) {
      this.mainCombat = false; this.locked = false; m.action = 'idle'; m.timer = 5;
      m.health = Math.min(m.maxHealth, m.health + m.maxHealth * .25);
      this.notify('目标退回街区', '它恢复了部分状态。重新接近会再次开战，别用拉扯消耗它。');
    }
  }
  /** Three bounded, renewable street encounters keep a patrol active between commissions. */
  private resetStreetEnemy(slot: number, initial = false) {
    const serial = this.streetSerial++, entry = ROSTER[(serial * 2 + slot * 2 + Math.floor(serial / 3)) % 6];
    const p = this.player, seed = Math.abs(Math.sin((serial + 1) * 12.9898 + slot * 78.233));
    let point = { x: p.x - 12 - slot * 2, z: p.z - 7 + slot * 6 };
    for (let attempt = 0; attempt < 28; attempt++) {
      const angle = seed * Math.PI * 2 + attempt * 2.39996;
      const radius = 13 + (attempt % 6) * 2.6;
      const candidate = { x: p.x + Math.sin(angle) * radius, z: p.z + Math.cos(angle) * radius };
      if (Math.abs(candidate.x - riverX(candidate.z)) < 8.7) continue;
      if (this.boxColliders.some(b => Math.abs(candidate.x - b.x) < b.halfWidth + .7 && Math.abs(candidate.z - b.z) < b.halfDepth + .7)) continue;
      if (this.colliders.some(c => distance(candidate, c) < c.radius + .7)) continue;
      point = candidate; break;
    }
    const maxHealth = 150 + ROSTER.indexOf(entry) * 24 + (this.progress.level - 1) * 12;
    this.streetEnemies[slot] = {
      id: serial, slot, kind: entry.kind, x: point.x, z: point.z, facing: seed * Math.PI * 2,
      health: maxHealth, maxHealth, action: 'idle', timer: initial ? 1.2 + slot * .8 : 1,
      enraged: false, chargeX: 0, chargeZ: 0, attackCount: 0, respawn: 0, attackDone: false,
    };
  }
  private updateStreetThreats(dt: number) {
    const p = this.player;
    let nearby = false;
    for (const m of this.streetEnemies) {
      if (m.health <= 0) {
        m.respawn -= dt;
        if (m.respawn <= 0) this.resetStreetEnemy(m.slot);
        continue;
      }
      let dist = distance(m, p);
      if (dist > 54 && m.action !== 'windup' && m.action !== 'charge') { this.resetStreetEnemy(m.slot); continue; }
      if (dist < 10.5) nearby = true;
      m.timer -= dt;
      const behavior = monsterBehavior(m.kind), toPlayer = Math.atan2(p.x - m.x, p.z - m.z);
      if (dist > 13) { m.action = 'idle'; continue; }
      if (m.action === 'idle' || m.action === 'stalk') {
        m.action = 'stalk';
        m.facing += angleDelta(m.facing, toPlayer) * Math.min(1, dt * (behavior === 'vehicle' ? 1.4 : 3));
        if (dist > (behavior === 'vehicle' ? 4.5 : 2.2)) {
          const speed = behavior === 'skirmisher' ? 2.7 : behavior === 'vehicle' ? 2.4 : 2;
          const moved = moveCircle(m, { x: Math.sin(toPlayer) * dt * speed, z: Math.cos(toPlayer) * dt * speed }, .46, this.colliders, this.boxColliders);
          m.x = moved.x; m.z = moved.z;
        }
        if (m.timer <= 0 && dist < (behavior === 'vehicle' ? 11 : 6)) {
          m.action = 'windup'; m.timer = behavior === 'vehicle' ? 1.25 : behavior === 'skirmisher' ? .85 : 1;
          m.attackDone = false; m.attackCount++; this.event({ type: 'roar', kind: m.kind });
        }
      } else if (m.action === 'windup') {
        m.facing += angleDelta(m.facing, toPlayer) * Math.min(1, dt * (behavior === 'vehicle' ? .8 : 1.8));
        if (m.timer <= 0) {
          m.action = 'charge'; m.timer = behavior === 'vehicle' ? .8 : .48;
          m.chargeX = Math.sin(m.facing); m.chargeZ = Math.cos(m.facing);
        }
      } else if (m.action === 'charge') {
        const speed = behavior === 'vehicle' ? 12 : 8;
        const moved = moveCircle(m, { x: m.chargeX * speed * dt, z: m.chargeZ * speed * dt }, .46, this.colliders, this.boxColliders);
        m.x = moved.x; m.z = moved.z; dist = distance(m, p);
        if (dist < (behavior === 'vehicle' ? 1.9 : 1.55) && !m.attackDone) {
          this.hurt(behavior === 'vehicle' ? 15 : behavior === 'skirmisher' ? 9 : 12, m); m.attackDone = true;
        }
        if (m.timer <= 0) { m.action = 'recover'; m.timer = behavior === 'vehicle' ? 2.2 : 1.55; }
      } else if ((m.action === 'recover' || m.action === 'stagger' || m.action === 'guard') && m.timer <= 0) {
        m.action = 'stalk'; m.timer = 1.4;
      }
    }
    const wasEngaged = this.streetEngaged;
    this.streetEngaged = nearby || (wasEngaged && this.streetEnemies.some(m => m.health > 0 && distance(m, p) < 25));
    if (nearby && !wasEngaged) this.notify('街区有动静', '附近有游荡目标，制伏可获得小额谢礼；离开主委托也能继续夜巡。', 'warning');
    if (!this.streetEngaged) this.streetEnemies.forEach(m => { if (m.health > 0 && distance(m, p) > 16) { m.action = 'idle'; m.timer = 1; } });
  }
  attack(heavy = false) {
    const p = this.player;
    if (this.paused || this.dead || this.attackCooldown > 0 || p.dodgeTime > 0) return false;
    const cost = heavy ? 27 : 10;
    if (p.stamina < cost) { this.notify('喘口气', '体力不够了，先缓一缓再出手。', 'warning'); return false; }
    p.stamina -= cost;
    const faster = this.progress.weapon === 'baton', umbrella = this.progress.weapon === 'umbrella';
    this.attackCooldown = heavy ? 1.15 : faster ? 0.4 : umbrella ? .54 : 0.66; p.attackTime = heavy ? 0.85 : faster ? 0.38 : umbrella ? .46 : 0.55;
    p.combo = this.comboTimer > 0 ? p.combo % 3 + 1 : 1; this.comboTimer = 1.7;
    this.event({ type: 'attack', value: heavy ? 1 : 0 });
    const range = (heavy ? 3.35 : 2.75) + (umbrella ? .35 : 0);
    const candidates = [...this.streetEnemies, ...(this.targetRevealed ? [this.monster] : [])]
      .filter(m => m.health > 0 && distance(p, m) <= range && hasLineOfSight(p, m, this.boxColliders))
      .sort((a, b) => distance(p, a) - distance(p, b));
    const m = candidates.find(target => Math.abs(angleDelta(p.facing, Math.atan2(target.x - p.x, target.z - p.z))) <= (this.locked ? 1.5 : 1.2));
    if (!m) return true;
    const targetAngle = Math.atan2(m.x - p.x, m.z - p.z), street = 'slot' in m;
    p.facing += clamp(angleDelta(p.facing, targetAngle), -.32, .32);
    const weakness = m.action === 'recover' || m.action === 'stagger', guarded = m.action === 'guard';
    const damage = Math.round(this.attackDamage * (heavy ? 1.95 : 1) * (p.combo === 3 ? 1.35 : 1) * (weakness ? 1.3 : 1) * (guarded ? heavy ? .8 : .35 : 1));
    m.health = Math.max(0, m.health - damage); this.event({ type: 'hit', value: damage, x: m.x, z: m.z });
    if (guarded && heavy) { m.action = 'stagger'; m.timer = 2; this.notify('破防成功', '重击拆开架势，目标陷入硬直。', 'success'); }
    else if (heavy && weakness) { m.action = 'stagger'; m.timer = 2.3; }
    if (m.health <= 0) {
      m.action = 'dead'; this.locked = false;
      if (street) {
        const enemy = m as StreetEnemy;
        enemy.respawn = 5 + enemy.slot; this.streetDefeated++;
        const cash = 24 + ROSTER.findIndex(entry => entry.kind === m.kind) * 4, parts = this.streetDefeated % 2 === 0 ? 1 : 0;
        this.progress.cash += cash; this.progress.parts += parts; this.save(this.progress);
        this.notify('街区恢复清净', `+${cash} 现金${parts ? ' · +1 零件' : ''} · 稍后会有新的街区目标`, 'success');
      } else {
        this.mainCombat = false; this.questPhase = 'harvest';
        this.notify('制伏成功', '靠近目标，按 E 收缴赃物与奖励。', 'success');
      }
      this.combat = this.mainCombat || this.streetEnemies.some(enemy => enemy.health > 0 && distance(enemy, p) < 10.5);
      this.event({ type: 'victory' });
    } else if (street) { this.streetEngaged = true; this.combat = true; }
    return true;
  }
  dodge() {
    const p = this.player;
    if (this.paused || this.dead || p.dodgeTime > 0 || p.stamina < 23) return false;
    p.stamina -= 23; p.dodgeTime = 0.44; p.invulnerable = 0.6; p.attackTime = 0;
    const len = Math.hypot(this.lastInput.x, this.lastInput.z);
    this.dodgeDirection = len > 0.1 ? { x: this.lastInput.x / len, z: this.lastInput.z / len } : { x: -Math.sin(p.facing), z: -Math.cos(p.facing) };
    this.event({ type: 'dodge' }); return true;
  }
  hurt(amount: number, source?: Point) {
    if (this.player.invulnerable > 0 || this.dead) return;
    const petGuard = this.progress.pet === 'orangeCat' ? this.progress.petLevel * 3 : 0;
    this.player.health = Math.max(0, this.player.health - Math.max(5, amount - (this.progress.level - 1) * 3 - petGuard)); this.player.invulnerable = 0.8;
    if (source) {
      const angle = Math.atan2(this.player.x - source.x, this.player.z - source.z);
      this.player.knockbackTime = .2; this.player.knockbackX = Math.sin(angle) * 5.5; this.player.knockbackZ = Math.cos(angle) * 5.5;
      this.player.attackTime = 0;
    }
    this.event({ type: 'hurt', value: amount });
    if (this.player.health <= 0) { this.dead = true; this.locked = false; this.combat = false; this.mainCombat = false; this.streetEngaged = false; }
  }
  heal() {
    if (this.paused || this.dead || this.healingCooldown > 0) return false;
    if (!this.potions) { this.notify('奶茶喝完了', '去找路边的奶茶补给，回血续命。', 'warning'); return false; }
    if (this.player.health >= this.maxHealth) { this.notify('状态已满', '血气方刚，不需要奶茶。'); return false; }
    this.potions--; this.player.health = Math.min(this.maxHealth, this.player.health + 48); this.healingCooldown = 1.5;
    this.event({ type: 'heal' }); this.notify('吸了口奶茶', '恢复 48 点气血。', 'success'); return true;
  }
  petSkill() {
    if (this.paused || this.dead || this.petCooldown > 0) return false;
    const p = this.player, level = this.progress.petLevel;
    if (this.progress.pet === 'orangeCat') {
      p.health = Math.min(this.maxHealth, p.health + 8 + level * 6); p.invulnerable = Math.max(p.invulnerable, 1 + level * .25);
      this.notify('橘座守护', `恢复气血并短暂减伤 · 训练 ${level} 级`, 'success');
    } else if (this.progress.pet === 'corgi') {
      p.stamina = Math.min(100, p.stamina + 32 + level * 12); p.dodgeTime = 0; p.invulnerable = Math.max(p.invulnerable, .35);
      this.notify('电臀冲刺', '体力大幅恢复，马上再组织一轮进攻。', 'success');
    } else {
      const clue = this.resources.filter(r => r.kind === 'clue' && !r.collected).sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (clue) this.notify('柴犬寻踪', `可疑痕迹在${clue.z < p.z ? '北' : '南'}侧，约 ${Math.round(distance(clue, p))} 米。`, 'success');
      else this.notify('柴犬寻踪', `目标在${this.monster.z < p.z ? '北' : '南'}侧，约 ${Math.round(distance(this.monster, p))} 米。`, 'success');
      p.stamina = Math.min(100, p.stamina + 10);
    }
    this.petCooldown = Math.max(14, 27 - level * 3); this.event({ type: 'pet' }); return true;
  }
  trainPet() {
    const level = this.progress.petLevel, cost = { parts: level * 3, cash: level * 500 };
    if (level >= 3 || this.progress.parts < cost.parts || this.progress.cash < cost.cash) return false;
    this.progress.parts -= cost.parts; this.progress.cash -= cost.cash; this.progress.petLevel++;
    this.save(this.progress); this.event({ type: 'forge' }); this.notify('宠物训练完成', `${this.petSkillName}提升至 ${this.progress.petLevel} 级。`, 'success'); return true;
  }
  refineWeapon() {
    const level = this.progress.weaponLevel, cost = { parts: 4 + level * 3, cash: 600 + level * 500 };
    if (level >= 3 || this.progress.parts < cost.parts || this.progress.cash < cost.cash) return false;
    this.progress.parts -= cost.parts; this.progress.cash -= cost.cash; this.progress.weaponLevel++;
    this.save(this.progress); this.event({ type: 'forge' }); this.notify('兵器精修完成', `全部城市兵器伤害 +5 · 精修 ${this.progress.weaponLevel}/3`, 'success'); return true;
  }
  getInteraction(): Snapshot['interact'] {
    if (this.dead) return null;
    if (this.questPhase === 'harvest' && distance(this.player, this.monster) < 9) return { id: 'harvest', label: `制伏 · 收缴${this.monsterName}`, detail: '夺回赃物，领取街坊悬赏' };
    const near = this.resources.filter(r => !r.collected && distance(r, this.player) < 3.3).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
    if (near) {
      const eventNames = ['找回遗失证件', '护送晚归街坊', '清理占道杂物'];
      return {
        id: near.id,
        label: near.kind === 'clue' ? '查看可疑痕迹' : near.kind === 'snack' ? '拿一杯热奶茶' : near.kind === 'event' ? '帮助街坊' : '翻找零件堆',
        detail: near.kind === 'clue' ? `${this.monsterName} · 新鲜线索`
          : near.kind === 'snack' ? '补充奶茶储备 · 回血必备'
            : near.kind === 'event' ? `${eventNames[this.progress.hunts % eventNames.length]} · 额外街区谢礼`
              : '强化装备用的五金零件',
      };
    }
    if (distance(this.player, { x: -18, z: 29 }) < 6) return { id: 'camp', label: '在大排档坐下', detail: '回满气血与奶茶 · 顺便推进天气' };
    return null;
  }
  interact() {
    if (this.paused || this.dead) return false;
    const target = this.getInteraction(); if (!target) return false;
    if (target.id === 'harvest') {
      const reward = this.questReward, parts = this.elite ? 6 : 4;
      this.progress.parts += parts;
      this.progress.cash += reward; this.progress.hunts++; this.questPhase = 'complete';
      this.save(this.progress); this.event({ type: 'gather' });
      this.notify('收缴完成', `+${parts} 零件 · +${reward} 现金${parts > 4 ? ' · 精英悬赏加成' : ''}`, 'success'); return true;
    }
    if (target.id === 'camp') {
      if (this.combat) { this.notify('还没脱险', '先甩掉目标，再回来吃夜宵。', 'warning'); return false; }
      this.rest(); return true;
    }
    const resource = this.resources.find(r => r.id === target.id)!; resource.collected = true;
    if (resource.kind === 'clue') {
      this.tracked = Math.min(3, this.tracked + 1);
      this.notify(this.tracked === 3 ? '发现目标了' : '发现可疑痕迹', this.tracked === 3 ? '跟着金色光点走，目标就在附近。' : `线索收集 · ${this.tracked} / 3`, 'success');
      if (this.tracked === 3) this.questPhase = 'hunting';
    } else if (resource.kind === 'snack') {
      this.potions = Math.min(9, this.potions + 1); this.notify('奶茶到手', '+1 奶茶 · 战斗间隙回血用', 'success');
    } else if (resource.kind === 'event') {
      const cash = 160 + this.progress.hunts * 20;
      this.progress.cash += cash; this.progress.parts += 1;
      if (this.progress.hunts % 3 === 1) this.potions = Math.min(9, this.potions + 1);
      this.notify('街坊的事办妥了', `+${cash} 现金 · +1 零件${this.progress.hunts % 3 === 1 ? ' · +1 奶茶' : ''}`, 'success');
    } else { this.progress.parts += 2; this.notify('淘到好零件', '+2 零件 · 可以拿去强化了', 'success'); }
    this.event({ type: 'gather' }); this.save(this.progress); return true;
  }
  rest() {
    this.player.health = this.maxHealth; this.player.stamina = 100; this.potions = 5; this.cycleWeather();
    this.notify('吃碗热馄饨', '气血、体力、奶茶全部回满。', 'success');
  }
  cycleWeather() {
    const types: Weather[] = ['晴夜', '雾霾', '暴雨'];
    this.weather = types[(types.indexOf(this.weather) + 1) % 3]; this.weatherTime = 0; this.event({ type: 'weather' });
    if (this.weather === '晴夜') this.resources.filter(r => r.kind === 'snack').forEach(r => { r.collected = false; });
    this.notify(this.weather === '晴夜' ? '月色正好' : this.weather === '雾霾' ? '起雾了' : '暴雨倾盆',
      this.weather === '晴夜' ? '霓虹在潮润的空气里发光，奶茶摊又出摊了。' : this.weather === '雾霾' ? '雾气压低了能见度，别跟丢目标。' : '雨夜路滑，那帮家伙反而更猖狂。');
  }
  /** 简化升级：单一侠义等级，只消耗零件 + 现金。 */
  levelUp() {
    const level = this.progress.level;
    const cost = { parts: 3 + level, cash: level * 400 };
    if (level >= 5 || this.progress.parts < cost.parts || this.progress.cash < cost.cash) return false;
    this.progress.parts -= cost.parts; this.progress.cash -= cost.cash;
    this.progress.level++;
    this.player.health = Math.min(this.maxHealth, this.player.health + 18);
    this.save(this.progress); this.event({ type: 'forge' }); this.notify('侠义提升', `你的侠义等级升至 ${this.progress.level} 级，攻防兼备。`, 'success'); return true;
  }
  equip(weapon: Weapon) {
    if (this.combat || !weaponUnlocked(weapon, this.progress.level)) return false;
    this.progress.weapon = weapon; this.player.combo = 0; this.save(this.progress); return true;
  }
  setPet(pet: Pet) {
    this.progress.pet = pet; this.save(this.progress); return true;
  }
  setSkin(skin: Skin) {
    this.progress.skin = skin; this.save(this.progress); return true;
  }
  toggleLock() {
    if (this.monster.health <= 0 || this.dead || this.paused || !this.targetRevealed) return;
    this.locked = !this.locked; if (this.locked) this.notify('锁定目标', '盯住它周旋。再按 Q 解除锁定。');
  }
  newHunt() {
    this.player = { x: 0, z: 20, facing: Math.PI, health: this.maxHealth, stamina: 100, attackTime: 0, dodgeTime: 0, invulnerable: 0, sprinting: false, moving: false, combo: 0, knockbackTime: 0, knockbackX: 0, knockbackZ: 0 };
    this.monster = { x: 8, z: -12, facing: -0.85, health: 0, maxHealth: 0, action: 'idle', timer: 4, enraged: false, chargeX: 0, chargeZ: 0, attackCount: 0, kind: this.monster.kind };
    this.setMonsterForHunt(this.progress.hunts);
    this.potions = 5; this.dead = false; this.combat = false; this.mainCombat = false; this.streetEngaged = false; this.locked = false; this.questPhase = 'tracking'; this.tracked = 0;
    this.time = 0; this.weatherTime = 0; this.weather = '晴夜'; this.attackCooldown = 0; this.healingCooldown = 0; this.petCooldown = 0; this.comboTimer = 0;
    this.monsterHit = false; this.idleHeal = 0; this.dodgeDirection = { x: 0, z: 1 }; this.lastInput = { x: 0, z: 0, sprint: false };
    this.notifications = []; this.noticeTimes.clear(); this.resetResources();
    for (let slot = 0; slot < STREET_SLOTS; slot++) this.resetStreetEnemy(slot, true);
  }
  snapshot(): Snapshot {
    const nearestStreet = this.streetEnemies.filter(m => m.health > 0 && distance(m, this.player) < 26).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
    const mainEncounter = this.targetRevealed && this.monster.health > 0 && distance(this.monster, this.player) < 30;
    const encounter = nearestStreet && (!this.mainCombat || !mainEncounter) ? {
      name: `${ROSTER.find(entry => entry.kind === nearestStreet.kind)?.name ?? '街区目标'} · 游荡`, health: nearestStreet.health,
      maxHealth: nearestStreet.maxHealth, action: nearestStreet.action, enraged: false, elite: false, street: true,
    } : mainEncounter ? {
      name: this.monsterName, health: this.monster.health, maxHealth: this.monster.maxHealth,
      action: this.monster.action, enraged: this.monster.enraged, elite: this.elite, street: false,
    } : null;
    return {
      saveStatus: this.saveStatus,
      health: this.player.health, maxHealth: this.maxHealth, stamina: this.player.stamina, potions: this.potions,
      monsterHealth: this.monster.health, monsterMaxHealth: this.monster.maxHealth, monsterAction: this.monster.action,
      monsterDistance: distance(this.player, this.monster), monsterName: this.monsterName, monsterTitle: this.monsterTitle, monsterEnraged: this.monster.enraged,
      weather: this.weather, weatherProgress: this.weatherTime / WEATHER_DURATION, time: this.time, tracked: this.tracked,
      questPhase: this.questPhase, player: { x: this.player.x, z: this.player.z }, monster: { x: this.monster.x, z: this.monster.z },
      facing: this.player.facing, heading: 0, combat: this.combat, dead: this.dead, locked: this.locked, sprinting: this.player.sprinting,
      attacking: this.player.attackTime > 0, cooldown: this.attackCooldown, interact: this.getInteraction(), progress: clone(this.progress),
      resources: this.resources.map(r => ({ ...r })), notifications: [...this.notifications], combo: this.player.combo,
      questDistrict: this.questDistrict, questReward: this.questReward, monsterElite: this.elite, targetRevealed: this.targetRevealed,
      petCooldown: this.petCooldown, petSkillName: this.petSkillName,
      streetThreats: this.streetEnemies.map(m => ({
        id: m.id, kind: m.kind, name: ROSTER.find(entry => entry.kind === m.kind)?.name ?? '街区目标',
        x: m.x, z: m.z, facing: m.facing, health: m.health, maxHealth: m.maxHealth,
        action: m.action, distance: distance(m, this.player),
      })),
      streetActive: this.streetEnemies.filter(m => m.health > 0).length,
      streetDefeated: this.streetDefeated, encounter,
    };
  }
}
