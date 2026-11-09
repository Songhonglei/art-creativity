import type { BoxCollider, CircleCollider } from './collision';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const CAMERA = { distance: 8.2, minDistance: 4, maxDistance: 17, pitch: .2, minPitch: -.12, maxPitch: 1.12, radius: .28 };
export interface Position3 { x: number; y: number; z: number }
interface Contact { id: number; x: number; y: number; type: string; button: number }
interface GestureContact extends Contact { startX: number; startY: number; moved: boolean; multi: boolean }

/** Only contacts that started on the scene belong here; HUD/joystick contacts never enter. */
export class CameraGesture {
  yaw = -.07;
  pitch = CAMERA.pitch;
  distance = CAMERA.distance;
  manualRemaining = 0;
  private contacts = new Map<number, GestureContact>();
  get active() { return this.contacts.size > 0; }
  get count() { return this.contacts.size; }

  begin(contact: Contact) {
    if (this.contacts.has(contact.id) || this.contacts.size >= 2 ||
      (contact.type !== 'touch' && contact.button !== 0 && contact.button !== 2)) return false;
    // Mixing mouse/pen with a touch gesture cannot produce a meaningful pinch.
    if (this.active && (contact.type !== 'touch' || [...this.contacts.values()][0].type !== 'touch')) return false;
    this.contacts.set(contact.id, { ...contact, startX: contact.x, startY: contact.y, moved: false, multi: this.active });
    if (this.contacts.size > 1) this.contacts.forEach(p => { p.multi = true; });
    return true;
  }

  move(id: number, x: number, y: number, sensitivity: number, viewport: number) {
    const p = this.contacts.get(id); if (!p) return;
    if (this.contacts.size === 2) {
      const other = [...this.contacts.values()].find(c => c.id !== id)!;
      const before = Math.hypot(p.x - other.x, p.y - other.y), after = Math.hypot(x - other.x, y - other.y);
      if (before > 12 && after > 12) this.zoom(before / after);
      p.x = x; p.y = y;
      return;
    }
    if (!p.moved && Math.hypot(x - p.startX, y - p.startY) < (p.type === 'touch' ? 9 : 5)) return;
    const scale = Math.PI * 1.3 / Math.max(320, viewport) * sensitivity;
    this.yaw = Math.atan2(Math.sin(this.yaw - (x - p.x) * scale), Math.cos(this.yaw - (x - p.x) * scale));
    this.pitch = clamp(this.pitch + (y - p.y) * scale * .65, CAMERA.minPitch, CAMERA.maxPitch);
    p.x = x; p.y = y; p.moved = true; this.manualRemaining = 1.6;
  }

  end(id: number, cancelled = false): 'attack' | 'heavy' | null {
    const p = this.contacts.get(id); if (!p) return null;
    this.contacts.delete(id);
    if (p.moved || p.multi) this.manualRemaining = 1.6;
    // Continuing with the remaining finger starts from its current position, with no jump or tap.
    this.contacts.forEach(c => { c.startX = c.x; c.startY = c.y; });
    if (cancelled || p.moved || p.multi) return null;
    return p.button === 2 ? 'heavy' : 'attack';
  }

  zoom(factor: number) { this.distance = clamp(this.distance * factor, CAMERA.minDistance, CAMERA.maxDistance); this.manualRemaining = 1.6; }
  cancel() { this.contacts.clear(); }
  reset(facing: number) { this.cancel(); this.yaw = Math.atan2(Math.sin(facing + Math.PI), Math.cos(facing + Math.PI)); this.pitch = CAMERA.pitch; this.distance = CAMERA.distance; this.manualRemaining = 0; }
  followLock(desired: number, dt: number) {
    this.manualRemaining = Math.max(0, this.manualRemaining - dt);
    if (this.active || this.manualRemaining > 0) return;
    const delta = Math.atan2(Math.sin(desired - this.yaw), Math.cos(desired - this.yaw));
    this.yaw += delta * (1 - Math.exp(-dt * 3));
  }
}

function cylinderEntry(from: Position3, to: Position3, circle: CircleCollider, padding: number) {
  const dx = to.x - from.x, dz = to.z - from.z, ox = from.x - circle.x, oz = from.z - circle.z;
  const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - (circle.radius + padding) ** 2;
  let enter = 0, exit = 1;
  if (a < 1e-8) { if (c > 0) return 1; }
  else {
    const discriminant = b * b - 4 * a * c; if (discriminant < 0) return 1;
    const root = Math.sqrt(discriminant);
    enter = Math.max(enter, (-b - root) / (2 * a)); exit = Math.min(exit, (-b + root) / (2 * a));
  }
  const dy = to.y - from.y, lo = circle.minY! - padding, hi = circle.maxY! + padding;
  if (Math.abs(dy) < 1e-8) { if (from.y < lo || from.y > hi) return 1; }
  else { const t0 = (lo - from.y) / dy, t1 = (hi - from.y) / dy; enter = Math.max(enter, Math.min(t0, t1)); exit = Math.min(exit, Math.max(t0, t1)); }
  return enter <= exit && exit > 1e-7 ? enter : 1;
}

/** A true spherical orbit keeps the chosen radius at every elevation. */
export function orbitPosition(target: Position3, yaw: number, pitch: number, distance: number): Position3 {
  const horizontal = Math.cos(pitch) * distance;
  return { x: target.x + Math.sin(yaw) * horizontal, y: target.y + Math.sin(pitch) * distance, z: target.z + Math.cos(yaw) * horizontal };
}

function boxEntry(from: Position3, to: Position3, box: BoxCollider, radius: number) {
  if (Math.min(from.x, to.x) > box.x + box.halfWidth + radius || Math.max(from.x, to.x) < box.x - box.halfWidth - radius ||
    Math.min(from.z, to.z) > box.z + box.halfDepth + radius || Math.max(from.z, to.z) < box.z - box.halfDepth - radius) return 1;
  let enter = 0, exit = 1;
  for (const [origin, delta, lo, hi] of [
    [from.x, to.x - from.x, box.x - box.halfWidth - radius, box.x + box.halfWidth + radius],
    [from.y, to.y - from.y, (box.minY ?? -Infinity) - radius, (box.maxY ?? Infinity) + radius],
    [from.z, to.z - from.z, box.z - box.halfDepth - radius, box.z + box.halfDepth + radius],
  ]) {
    if (Math.abs(delta) < 1e-8) { if (origin < lo || origin > hi) return 1; continue; }
    const a = (lo - origin) / delta, b = (hi - origin) / delta;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return 1;
  }
  return exit > 1e-7 ? enter : 1;
}

/** Sweep a small camera volume against height-aware city bounds and the ground/bridge surface.
 * Reused for the desired AND interpolated position, so smoothing cannot cut through corners.
 * Circles only participate when their actual vertical bounds are known (landmark towers).
 */
export function cameraSafeFraction(from: Position3, to: Position3, boxes: BoxCollider[], circles: CircleCollider[], floor: (x: number, z: number) => number, radius = CAMERA.radius) {
  let fraction = 1;
  for (const box of boxes) fraction = Math.min(fraction, boxEntry(from, to, box, radius));
  for (const circle of circles) {
    if (circle.minY === undefined || circle.maxY === undefined) continue;
    fraction = Math.min(fraction, cylinderEntry(from, to, circle, radius));
  }
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.max(1, Math.ceil(length / .3));
  for (let i = 1; i <= steps; i++) {
    const t = Math.min(fraction, i / steps), x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
    if (from.y + (to.y - from.y) * t < floor(x, z) + radius) {
      let lo = Math.max(0, t - 1 / steps), hi = t;
      for (let j = 0; j < 7; j++) {
        const mid = (lo + hi) / 2;
        if (from.y + (to.y - from.y) * mid < floor(from.x + (to.x - from.x) * mid, from.z + (to.z - from.z) * mid) + radius) hi = mid; else lo = mid;
      }
      fraction = lo; break;
    }
    if (t >= fraction) break;
  }
  return Math.max(0, fraction - (fraction < 1 && length > 0 ? .02 / length : 0));
}
