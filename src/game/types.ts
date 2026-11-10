export type Weather = '晴夜' | '雾霾' | '暴雨';
export type Weapon = 'baton' | 'crowbar' | 'umbrella';
export type Skin = 'nightwatch' | 'magnolia' | 'neon' | 'wutong-warden' | 'riverside-sentinel' | 'shanghai-paragon';
export type Gender = 'male' | 'female';
export type Pet = 'orangeCat' | 'corgi' | 'shiba';
export type PetAttribute = 'guard' | 'vigor' | 'specialty';
export interface PetGrowth { level: number; xp: number; attributes: Record<PetAttribute, number>; trait: 'first' | 'second' | null; skin: string }
export type MonsterKind = 'cat' | 'dog' | 'ebike' | 'racer' | 'hooligan' | 'robber' | 'official';
export type MonsterAction = 'idle' | 'stalk' | 'windup' | 'charge' | 'recover' | 'stagger' | 'guard' | 'dead';
export type ResourceKind = 'clue' | 'snack' | 'parts' | 'event';
export interface Point { x: number; z: number }
export type CityFeatureKind = 'store' | 'taxi' | 'youth' | 'park' | 'bridge' | 'river';
export interface CityFeature extends Point { kind: CityFeatureKind; label: string }
export interface Resource extends Point { id: string; kind: ResourceKind; collected: boolean }
export interface Progress {
  version: 3; parts: number; cash: number; level: number;
  weapon: Weapon; hunts: number; pet: Pet; skin: Skin; gender?: Gender;
  pets: Record<Pet, PetGrowth>; weaponLevel: number;
  patrol?: PatrolCheckpoint;
}
export interface SavedMonster extends Point {
  facing: number; health: number; maxHealth: number; action: MonsterAction; timer: number;
  enraged: boolean; chargeX: number; chargeZ: number; attackCount: number; kind: MonsterKind;
}
export interface SavedStreetEnemy extends SavedMonster { id: number; slot: number; respawn: number; attackDone: boolean }
export interface PetEffects {
  autoCooldown: number; shield: number; shieldTime: number; economyTime: number;
  markTime: number; markTarget: number | null; markHits: number; markSecond: boolean;
  guideTime: number; guideTarget: string | null; guideChained: boolean;
}
export interface PatrolCheckpoint {
  hunt: number; phase: Snapshot['questPhase']; tracked: number; time: number; weather: Weather; weatherTime: number;
  player: Point & { health: number; stamina: number; invulnerable: number; facing: number };
  monster: SavedMonster; street: SavedStreetEnemy[]; streetSerial: number; streetDefeated: number;
  resources: Resource[]; potions: number; petCooldown: number; healingCooldown: number;
  rescueAvailable: boolean; rescueTime: number; dead: boolean; death: { source: string; damage: number } | null;
  effects: PetEffects; rewarded: string[];
  retryOrigin?: Point; recoveryProtection?: number;
}
export type Soundscape = 'neon' | 'jazz' | 'river' | 'radio';
export interface StreetThreat extends Point {
  id: number; kind: MonsterKind; name: string; health: number; maxHealth: number;
  action: MonsterAction; facing: number; distance: number;
}
export interface Encounter {
  name: string; health: number; maxHealth: number; action: MonsterAction;
  enraged: boolean; elite: boolean; street: boolean;
}
export interface Settings {
  sound: boolean; volume: number; soundscape: Soundscape; quality: 'high' | 'balanced' | 'low'; sensitivity: number; reducedMotion: boolean; enemyHealthBars: boolean;
}
export interface GameEvent {
  type: 'hit' | 'hurt' | 'attack' | 'dodge' | 'gather' | 'roar' | 'victory' | 'weather' | 'heal' | 'forge' | 'step' | 'pet' | 'fall' | 'revive';
  value?: number; x?: number; z?: number; kind?: MonsterKind; heavy?: boolean; blocked?: boolean; weapon?: Weapon;
}
export interface Notification { id: number; title: string; description: string; kind: 'info' | 'success' | 'warning' }
export interface Snapshot {
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  health: number; maxHealth: number; stamina: number; potions: number;
  monsterHealth: number; monsterMaxHealth: number; monsterAction: MonsterAction;
  monsterDistance: number; monsterName: string; monsterTitle: string; monsterEnraged: boolean;
  weather: Weather; weatherProgress: number; time: number; tracked: number;
  questPhase: 'tracking' | 'hunting' | 'harvest' | 'complete';
  player: Point; monster: Point; facing: number; heading: number; combat: boolean; dead: boolean;
  locked: boolean; sprinting: boolean; attacking: boolean; dodging: boolean; cooldown: number;
  interact: { id: string; label: string; detail: string } | null;
  progress: Progress; resources: Resource[]; notifications: Notification[]; combo: number;
  questDistrict: string; questReward: number; monsterElite: boolean; targetRevealed: boolean;
  petCooldown: number; petSkillName: string;
  petSkillAvailable: boolean; rescueAvailable: boolean; rescueTime: number; petShield: number; petEconomy: number;
  death: { source: string; damage: number } | null;
  streetThreats: StreetThreat[]; streetActive: number; streetDefeated: number;
  encounter: Encounter | null;
  recoveryProtection: number;
}
export interface InputState { x: number; z: number; sprint: boolean }
