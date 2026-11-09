import * as THREE from 'three';

export type UrbanKind = 'skyscraper' | 'office' | 'lane' | 'wutong' | 'campus';
export type UrbanSurface = 'glass' | 'residence' | 'stone' | 'brick' | 'trim' | 'dark' | 'roof' | 'glow' | 'accent';
export type UrbanBuckets = Record<UrbanSurface, THREE.BufferGeometry[]>;

export interface UrbanBuildingSpec {
  x: number; z: number; y: number;
  halfWidth: number; halfDepth: number; height: number;
  kind: UrbanKind; variant: number; surface?: 0 | 1 | 2 | 3;
}

export function createUrbanBuckets(): UrbanBuckets {
  return { glass: [], residence: [], stone: [], brick: [], trim: [], dark: [], roof: [], glow: [], accent: [] };
}

/** Function-generated architectural parts, merged by surface by the caller. */
export function appendUrbanBuilding(buckets: UrbanBuckets, spec: UrbanBuildingSpec) {
  const { x, z, y, kind, variant } = spec;
  const w = spec.halfWidth, d = spec.halfDepth, h = spec.height;
  const surfaces: UrbanSurface[] = ['glass', 'residence', 'stone', 'brick'];
  const wall = surfaces[spec.surface ?? (kind === 'campus' || kind === 'lane' ? 3 : kind === 'skyscraper' ? 0 : variant % 3)];
  const add = (surface: UrbanSurface, geometry: THREE.BufferGeometry) => { buckets[surface].push(geometry); };
  const box = (surface: UrbanSurface, px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz); geometry.translate(px, py, pz); add(surface, geometry);
  };
  const cylinder = (surface: UrbanSurface, px: number, py: number, pz: number, top: number, bottom: number, height: number, sides = 8) => {
    const geometry = new THREE.CylinderGeometry(top, bottom, height, sides); geometry.translate(px, py, pz); add(surface, geometry);
  };
  const hipRoof = (py: number, roofHeight: number, scale = 1.12, px = x, pz = z) => {
    const geometry = new THREE.ConeGeometry(1, roofHeight, 4); geometry.rotateY(Math.PI / 4);
    geometry.scale(w * scale, 1, d * scale); geometry.translate(px, py + roofHeight / 2, pz); add('roof', geometry);
  };
  const frontWindows = (surface: UrbanSurface, floors: number, columns: number, startY = 2.2) => {
    for (let floor = 0; floor < floors; floor++) for (let column = 0; column < columns; column++) {
      const px = x + (column - (columns - 1) / 2) * Math.min(2.1, w * 1.45 / Math.max(1, columns - 1));
      box(surface, px, y + startY + floor * 2.75, z + d + .035, Math.min(1.15, w / columns), 1.05, .07);
    }
  };

  // A continuous, readable street-level base anchors every archetype.
  box(kind === 'skyscraper' || kind === 'office' ? 'stone' : 'trim', x, y + .32, z, w * 2.12, .64, d * 2.12);

  if (kind === 'skyscraper') {
    const lower = h * .58, middle = h * .28, crown = h - lower - middle;
    box('glass', x, y + lower / 2, z, w * 2, lower, d * 2);
    box('glass', x, y + lower + middle / 2, z, w * 1.58, middle, d * 1.58);
    box('glass', x, y + lower + middle + crown / 2, z, w * 1.12, crown, d * 1.12);
    box('stone', x, y + 1.25, z, w * 2.16, 2.5, d * 2.16);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box('trim', x + sx * w * .94, y + lower / 2, z + sz * d * .94, .16, lower, .16);
      box('accent', x + sx * w * .73, y + lower + middle / 2, z + sz * d * .73, .1, middle, .1);
    }
    for (let floor = 7; floor < lower; floor += 8) box('dark', x, y + floor, z, w * 2.025, .16, d * 2.025);
    box('accent', x, y + lower - .15, z, w * 2.06, .34, d * 2.06);
    box('trim', x, y + h + .12, z, w * 1.2, .3, d * 1.2);
    box('glow', x, y + h - .45, z + d * .57, w * .85, .12, .08);
    cylinder('trim', x, y + h + 2.1, z, .045, .12, 4.1, 6);
    cylinder('glow', x, y + h + 4.25, z, .12, .12, .22, 8);
    return;
  }

  if (kind === 'office') {
    const main = h * .82, upper = h - main;
    box(wall, x, y + main / 2, z, w * 2, main, d * 2);
    box(wall, x, y + main + upper / 2, z, w * 1.62, upper, d * 1.62);
    box('stone', x, y + 1.1, z, w * 2.12, 2.2, d * 2.12);
    for (let floor = 4.2; floor < main; floor += 4.1) box('trim', x, y + floor, z, w * 2.04, .14, d * 2.04);
    for (const sx of [-1, 1]) box('dark', x + sx * w * .82, y + main / 2, z + d * 1.005, .13, main * .92, .09);
    box('trim', x, y + h + .12, z, w * 1.75, .3, d * 1.75);
    box('dark', x - w * .35, y + h + .62, z, 1.45, .85, 1.15);
    box('dark', x + w * .34, y + h + .45, z - d * .2, 1.1, .55, .9);
    if (variant % 2 === 0) box('glow', x, y + 2.65, z + d + .07, w * 1.2, .18, .08);
    return;
  }

  if (kind === 'lane') {
    box(wall, x, y + h / 2, z, w * 2, h, d * 2);
    box('stone', x, y + .48, z + d + .08, w * 2.06, .96, .16);
    box('trim', x, y + h - .25, z, w * 2.06, .22, d * 2.06);
    hipRoof(y + h, 1.35 + variant % 2 * .35);
    box('dark', x, y + 1.15, z + d + .09, 1.05, 2.3, .18);
    for (const sx of [-1, 1]) box('stone', x + sx * .69, y + 1.2, z + d + .14, .22, 2.4, .26);
    box('stone', x, y + 2.43, z + d + .14, 1.65, .24, .28);
    frontWindows('glow', Math.max(1, Math.floor((h - 2.6) / 2.5)), Math.max(2, Math.floor(w / 1.7)), 3.05);
    box('dark', x + w * .55, y + h + 1.15, z - d * .3, .48, 1.5, .48);
    box('trim', x, y + .12, z + d + .48, 1.8, .24, .9);
    if (variant % 2 === 1) box('accent', x - w * .65, y + h * .65, z + d + .17, .7, .55, .34);
    return;
  }

  if (kind === 'wutong') {
    box(wall, x, y + h / 2, z, w * 2, h, d * 2);
    box('stone', x, y + 1.15, z, w * 2.06, 2.3, d * 2.06);
    for (let floor = 3; floor < h; floor += 2.9) box('trim', x, y + floor, z, w * 2.025, .12, d * 2.025);
    const floors = Math.max(2, Math.floor((h - 2.8) / 2.75));
    frontWindows('glow', floors, Math.max(2, Math.floor(w / 2)), 3.6);
    for (let floor = 0; floor < floors; floor++) {
      const py = y + 3.05 + floor * 2.75;
      box('dark', x, py, z + d + .42, w * 1.45, .16, .88);
      box('trim', x, py + .48, z + d + .83, w * 1.45, .07, .07);
      for (const sx of [-1, 1]) box('trim', x + sx * w * .68, py + .25, z + d + .82, .055, .5, .055);
    }
    box('glow', x, y + 1.15, z + d + .1, w * 1.25, 1.55, .12);
    box('accent', x, y + 2.18, z + d + .55, w * 1.65, .16, 1.15);
    box('roof', x, y + h + .12, z, w * 2.1, .32, d * 2.1);
    box('dark', x + w * .5, y + h + .52, z - d * .25, .8, .75, .8);
    return;
  }

  // Campus: brick teaching blocks, a columned porch and a small clock/stair tower.
  box('brick', x, y + h / 2, z, w * 2, h, d * 2);
  box('stone', x, y + .72, z, w * 2.08, 1.44, d * 2.08);
  for (let floor = 3.2; floor < h; floor += 3.1) box('trim', x, y + floor, z, w * 2.035, .18, d * 2.035);
  frontWindows('glow', Math.max(2, Math.floor((h - 2) / 3)), Math.max(3, Math.floor(w / 1.6)), 2.6);
  box('stone', x, y + 1.65, z + d + .75, w * 1.3, .28, 1.65);
  for (const sx of [-1, 1]) for (const offset of [.32, .78]) cylinder('trim', x + sx * w * offset, y + 1.45, z + d + 1.1, .1, .13, 2.9, 8);
  box('roof', x, y + h + .12, z, w * 2.1, .32, d * 2.1);
  const towerX = x + (variant % 2 ? -1 : 1) * w * .55;
  box('brick', towerX, y + (h + 3.2) / 2, z, w * .52, h + 3.2, d * .72);
  box('trim', towerX, y + h + 3.25, z, w * .62, .28, d * .82);
  cylinder('accent', towerX, y + h + 1.8, z + d * .37, .32, .32, .08, 16);
  hipRoof(y + h + 3.35, 1.25, .45, towerX, z);
}
