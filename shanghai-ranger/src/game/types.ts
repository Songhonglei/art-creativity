export type Weather = '晴夜' | '雾霾' | '暴雨';
export type Weapon = 'baton' | 'crowbar' | 'umbrella';
export type Skin = 'nightwatch' | 'magnolia' | 'neon';
export type Pet = 'orangeCat' | 'corgi' | 'shiba';
export type MonsterKind = 'cat' | 'dog' | 'ebike' | 'racer' | 'hooligan' | 'robber' | 'official';
export type MonsterAction = 'idle' | 'stalk' | 'windup' | 'charge' | 'recover' | 'stagger' | 'guard' | 'dead';
export type ResourceKind = 'clue' | 'snack' | 'parts' | 'event';
export interface Point { x: number; z: number }
export type CityFeatureKind = 'store' | 'taxi' | 'youth' | 'park' | 'bridge' | 'river';
export interface CityFeature extends Point { kind: CityFeatureKind; label: string }
export interface Resource extends Point { id: string; kind: ResourceKind; collected: boolean }
export interface Progress {
  version: 2; parts: number; cash: number; level: number;
  weapon: Weapon; hunts: number; pet: Pet; skin: Skin;
  petLevel: number; weaponLevel: number;
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
  sound: boolean; volume: number; soundscape: Soundscape; quality: 'high' | 'balanced' | 'low'; sensitivity: number; reducedMotion: boolean;
}
export interface GameEvent {
  type: 'hit' | 'hurt' | 'attack' | 'dodge' | 'gather' | 'roar' | 'victory' | 'weather' | 'heal' | 'forge' | 'step' | 'pet';
  value?: number; x?: number; z?: number; kind?: MonsterKind;
}
export interface Notification { id: number; title: string; description: string; kind: 'info' | 'success' | 'warning' }
export interface Snapshot {
  saveStatus: 'idle' | 'saved' | 'failed';
  health: number; maxHealth: number; stamina: number; potions: number;
  monsterHealth: number; monsterMaxHealth: number; monsterAction: MonsterAction;
  monsterDistance: number; monsterName: string; monsterTitle: string; monsterEnraged: boolean;
  weather: Weather; weatherProgress: number; time: number; tracked: number;
  questPhase: 'tracking' | 'hunting' | 'harvest' | 'complete';
  player: Point; monster: Point; facing: number; heading: number; combat: boolean; dead: boolean;
  locked: boolean; sprinting: boolean; attacking: boolean; cooldown: number;
  interact: { id: string; label: string; detail: string } | null;
  progress: Progress; resources: Resource[]; notifications: Notification[]; combo: number;
  questDistrict: string; questReward: number; monsterElite: boolean; targetRevealed: boolean;
  petCooldown: number; petSkillName: string;
  streetThreats: StreetThreat[]; streetActive: number; streetDefeated: number;
  encounter: Encounter | null;
}
export interface InputState { x: number; z: number; sprint: boolean }
