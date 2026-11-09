import type { CityFeatureKind, Weather } from './types';

export type AmbientKind = 'rain' | 'wind' | 'store' | 'taxi' | 'youth' | 'park' | 'river' | 'animal';
export interface AmbientCue { kind: AmbientKind; level: number; variant: number; animal: 'cat' | 'dog' | null }
const ranges: Partial<Record<CityFeatureKind, number>> = { store: 7.5, taxi: 10, youth: 7, park: 14, river: 16, bridge: 16 };
const intervals: Record<AmbientKind, [number, number]> = {
  rain: [10, 18], wind: [22, 38], store: [28, 48], taxi: [20, 38], youth: [20, 35], park: [16, 32], river: [26, 45], animal: [18, 32],
};

/** Countdown only while playing. Eligible sources compete for one sparse, shared sound slot. */
export class AmbienceScheduler {
  private timers = new Map<AmbientKind, number>();
  private quiet = 0;
  city: CityFeatureKind | null = null; distance = Infinity;
  animal: 'cat' | 'dog' | null = null; animalDistance = Infinity;
  weather: Weather = '晴夜'; combat = false;
  constructor(private random: () => number = Math.random) {}
  setCity(kind: CityFeatureKind | null, distance: number) { this.city = kind; this.distance = distance; }
  setAnimal(kind: 'cat' | 'dog' | null, distance: number) { this.animal = kind; this.animalDistance = distance; }
  levels(): Partial<Record<AmbientKind, number>> {
    const levels: Partial<Record<AmbientKind, number>> = {};
    if (this.weather === '暴雨') levels.rain = 1;
    else if (this.weather === '雾霾') levels.wind = .7;
    const range = this.city ? ranges[this.city] : undefined;
    if (range && this.distance >= 0 && this.distance < range) {
      const kind = this.city === 'bridge' ? 'river' : this.city as AmbientKind;
      levels[kind] = (1 - this.distance / range) ** 2;
    }
    if (!this.combat && this.animal && this.animalDistance >= 0 && this.animalDistance < 14) levels.animal = (1 - this.animalDistance / 14) ** 2;
    return levels;
  }
  reset() { this.timers.clear(); this.quiet = 0; }
  update(dt: number): AmbientCue | null {
    if (dt <= 0) return null;
    dt = Math.min(dt, .25); // A resumed/background frame never generates a backlog.
    const levels = this.levels();
    for (const kind of this.timers.keys()) if (!levels[kind]) this.timers.delete(kind);
    this.quiet = Math.max(0, this.quiet - dt);
    const ready: AmbientKind[] = [];
    for (const kind of Object.keys(levels) as AmbientKind[]) {
      if (!this.timers.has(kind)) this.timers.set(kind, kind === 'rain' ? 4 + this.random() * 4 : 7 + this.random() * 7);
      const remaining = this.timers.get(kind)! - dt; this.timers.set(kind, remaining);
      if (remaining <= 0) ready.push(kind);
    }
    if (this.quiet > 0 || !ready.length) return null;
    const kind = ready[Math.min(ready.length - 1, Math.floor(this.random() * ready.length))], [min, max] = intervals[kind];
    this.timers.set(kind, min + this.random() * (max - min)); this.quiet = 4 + this.random() * 3;
    return { kind, level: levels[kind]! * (this.combat ? .35 : 1), variant: this.random(), animal: kind === 'animal' ? this.animal : null };
  }
}
