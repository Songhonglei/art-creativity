import { combatLevel } from './heroProgress';
import type { MonsterAction, MonsterKind, PatrolCheckpoint, PetEffects, Progress, SavedMonster, SavedStreetEnemy } from './types';
const kinds: MonsterKind[] = ['cat', 'dog', 'ebike', 'racer', 'hooligan', 'robber', 'official'];
const actions: MonsterAction[] = ['idle', 'stalk', 'windup', 'charge', 'recover', 'stagger', 'guard', 'dead'];
const finite = (n: unknown, fallback = 0, min = 0, max = 1e9) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
const position = (p: { x?: number; z?: number } | undefined, x = 0, z = 20) => ({ x: finite(p?.x, x, -1e6, 1e6), z: finite(p?.z, z, -1e6, 1e6) });
export const emptyPetEffects = (): PetEffects => ({ autoCooldown: 0, shield: 0, shieldTime: 0, economyTime: 0, markTime: 0, markTarget: null, markHits: 0, markSecond: false, guideTime: 0, guideTarget: null, guideChained: false });
function monster(value: SavedMonster): SavedMonster {
  return { ...position(value), kind: kinds.includes(value.kind) ? value.kind : 'cat', facing: finite(value.facing, 0, -1e6, 1e6),
    health: finite(value.health, 0, 0, 100000), maxHealth: finite(value.maxHealth, 420, 1, 100000), action: actions.includes(value.action) ? value.action : 'idle', timer: finite(value.timer, 1, 0, 10),
    enraged: value.enraged === true, chargeX: finite(value.chargeX, 0, -1, 1), chargeZ: finite(value.chargeZ, 0, -1, 1), attackCount: Math.floor(finite(value.attackCount)) };
}
/** Validate a bounded checkpoint independently of the user's permanent progression. */
export function readCheckpoint(raw: unknown, progress: Progress): PatrolCheckpoint | undefined {
  if (!raw || typeof raw !== 'object') return;
  const c = raw as PatrolCheckpoint, phase = c.phase;
  if (!['tracking', 'hunting', 'harvest', 'complete'].includes(phase) || !c.player || !c.monster || !Array.isArray(c.resources)) return;
  const hunt = Math.floor(finite(c.hunt, -1));
  if (hunt !== progress.hunts - (phase === 'complete' ? 1 : 0) || hunt < 0) return;
  if (c.monster.kind !== kinds[hunt % kinds.length]) return;
  const maxHealth = 100 + (combatLevel(progress.level) - 1) * 18, e = c.effects ?? emptyPetEffects();
  const effects: PetEffects = {
    autoCooldown: finite(e.autoCooldown, 0, 0, 45), shield: finite(e.shield, 0, 0, maxHealth * .12), shieldTime: finite(e.shieldTime, 0, 0, 4), economyTime: finite(e.economyTime, 0, 0, 8),
    markTime: finite(e.markTime, 0, 0, 12), markTarget: e.markTarget === -1 ? -1 : typeof e.markTarget === 'number' ? Math.floor(finite(e.markTarget)) : null,
    markHits: Math.floor(finite(e.markHits, 0, 0, 2)), markSecond: e.markSecond === true,
    guideTime: finite(e.guideTime, 0, 0, 16), guideTarget: typeof e.guideTarget === 'string' ? e.guideTarget.slice(0, 32) : null, guideChained: e.guideChained === true,
  };
  return {
    hunt, phase, tracked: Math.floor(finite(c.tracked, 0, 0, 3)), time: finite(c.time),
    weather: c.weather === '暴雨' || c.weather === '雾霾' ? c.weather : '晴夜', weatherTime: finite(c.weatherTime, 0, 0, 100),
    player: { ...position(c.player), facing: finite(c.player.facing, Math.PI, -1e6, 1e6), health: finite(c.player.health, maxHealth, 0, maxHealth), stamina: finite(c.player.stamina, 100, 0, 100), invulnerable: finite(c.player.invulnerable, 0, 0, 4) },
    monster: monster(c.monster), street: Array.isArray(c.street) ? c.street.slice(0, 3).filter(m => m && typeof m === 'object').map((m, slot): SavedStreetEnemy => ({ ...monster(m), id: Math.floor(finite(m.id)), slot, respawn: finite(m.respawn, 0, 0, 10), attackDone: m.attackDone === true })) : [],
    streetSerial: Math.floor(finite(c.streetSerial, 3)), streetDefeated: Math.floor(finite(c.streetDefeated)),
    resources: c.resources.slice(0, 10).filter(r => r && typeof r.id === 'string' && ['clue', 'snack', 'parts', 'event'].includes(r.kind)).map(r => ({ ...position(r), id: r.id.slice(0, 32), kind: r.kind, collected: r.collected === true })),
    potions: Math.floor(finite(c.potions, 5, 0, 9)), petCooldown: finite(c.petCooldown, 0, 0, 24), healingCooldown: finite(c.healingCooldown, 0, 0, 1.5),
    rescueAvailable: c.rescueAvailable === true, rescueTime: finite(c.rescueTime, 0, 0, .7), dead: c.dead === true,
    death: c.death && typeof c.death.source === 'string' ? { source: c.death.source.slice(0, 50), damage: Math.round(finite(c.death.damage, 0, 0, 100000)) } : null,
    effects, rewarded: Array.isArray(c.rewarded) ? [...new Set(c.rewarded.filter(s => typeof s === 'string').map(s => s.slice(0, 64)))].slice(-2048) : [],
    retryOrigin: c.retryOrigin && Number.isFinite(c.retryOrigin.x) && Number.isFinite(c.retryOrigin.z) && Math.abs(c.retryOrigin.x) <= 1e6 && Math.abs(c.retryOrigin.z) <= 1e6 ? position(c.retryOrigin) : undefined,
    recoveryProtection: finite(c.recoveryProtection, 0, 0, 2),
  };
}
