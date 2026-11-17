import type { Settings } from './types';
const ranks: Settings['quality'][] = ['low', 'balanced', 'high'];
/** Hysteresis avoids changing quality on a short spike or browser background throttle. */
export class AdaptiveQuality {
  current: Settings['quality'];
  private samples: number[] = [];
  private elapsed = 0;
  private cooldown = 0;
  constructor(public preferred: Settings['quality'], public automatic = true) { this.current = preferred; }
  reset(preferred: Settings['quality'], automatic: boolean) { this.preferred = preferred; this.automatic = automatic; this.current = preferred; this.samples = []; this.elapsed = this.cooldown = 0; }
  sample(milliseconds: number): boolean {
    if (!this.automatic || milliseconds <= 0 || milliseconds > 250) return false;
    this.elapsed += milliseconds; this.cooldown = Math.max(0, this.cooldown - milliseconds); this.samples.push(milliseconds);
    if (this.elapsed < 5000) return false;
    const average = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = []; this.elapsed = 0;
    if (this.cooldown) return false;
    const index = ranks.indexOf(this.current), cap = ranks.indexOf(this.preferred);
    if (average > 42 && index > 0) { this.current = ranks[index - 1]; this.cooldown = 15000; return true; }
    if (average < 22 && index < cap) { this.current = ranks[index + 1]; this.cooldown = 30000; return true; }
    return false;
  }
}

export const setStyle = (node: HTMLElement, property: 'display' | 'transform' | 'opacity', value: string) => { if (node.style[property] !== value) node.style[property] = value; };
export const setText = (node: Element, value: string) => { if (node.textContent !== value) node.textContent = value; };
export const setAttribute = (node: Element, name: string, value: string) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
