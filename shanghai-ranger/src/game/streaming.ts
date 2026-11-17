import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, noise, pavementTexture, riverX } from './materials';
import { CHUNK_SIZE, chunkCoordinate, districtLayout, isAuthoredChunk, nearbyChunkKeys } from './districts';
import { facadeTexture } from './facade';
import { appendUrbanBuilding, createUrbanBuckets } from './architecture';
import type { UrbanSurface } from './architecture';
import type { BoxCollider, CircleCollider } from './collision';
import type { Simulation } from './simulation';
import type { Point, Settings } from './types';

interface ActiveChunk { key: string; group: THREE.Group; detail: Settings['quality'] }
const geometry = (g: THREE.BufferGeometry, list: THREE.BufferGeometry[]) => { list.push(g); return g; };

/**
 * Deterministic district streaming. The handcrafted centre remains intact; only outer
 * chunks are generated near-first (at most two per frame), then geometry/colliders are reclaimed.
 */
export class DistrictStreamer {
  private active = new Map<string, ActiveChunk>();
  private pending: string[] = [];
  private layouts = new Map<string, ReturnType<typeof districtLayout>>();
  private job: { key: string; iterator: Generator<void> } | null = null;
  private maxWorkMs = 0;
  private lastWorkMs = 0;
  private lastX = Number.NaN;
  private lastZ = Number.NaN;
  private materials: THREE.Material[];
  private buildingMaterials: THREE.MeshStandardMaterial[];
  private urbanMaterials: Record<UrbanSurface, THREE.Material>;
  private groundMaterial: THREE.MeshStandardMaterial;
  private roadMaterial = new THREE.MeshStandardMaterial({ color: '#292e3a', roughness: .96 });
  private trimMaterial = new THREE.MeshStandardMaterial({ color: '#687386', roughness: .7, metalness: .16 });
  private darkMaterial = new THREE.MeshStandardMaterial({ color: '#252b38', roughness: .78, metalness: .18 });
  private roofMaterial = new THREE.MeshStandardMaterial({ color: '#242c38', roughness: .92 });
  private glowMaterial = new THREE.MeshStandardMaterial({ color: '#f0cf92', emissive: '#ffc875', emissiveIntensity: 1.05, roughness: .5 });
  private accentMaterial = new THREE.MeshStandardMaterial({ color: '#b88c54', emissive: '#6d4627', emissiveIntensity: .35, roughness: .5, metalness: .35 });
  private paintMaterial = new THREE.MeshStandardMaterial({ color: '#c4bb96', roughness: .86 });
  private barkMaterial = new THREE.MeshStandardMaterial({ color: '#716c60', roughness: .98 });
  private leafMaterials = ['#365c48', '#4d7452', '#2b4c40'].map(color => new THREE.MeshStandardMaterial({ color, roughness: .96, flatShading: true }));
  private lampMaterial = new THREE.MeshStandardMaterial({ color: '#ffdb9b', emissive: '#ffc66d', emissiveIntensity: 1.25 });
  private waterMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vPos;uniform float uTime;void main(){vec3 p=position;p.y+=sin(p.x*.7+p.z*.4+uTime*1.8)*.035;vPos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: 'varying vec3 vPos;uniform float uTime;void main(){float w=sin(vPos.z*4.+uTime*3.+sin(vPos.x*2.))*.5+.5;float g=pow(w,18.);vec3 c=mix(vec3(.025,.07,.12),vec3(.09,.2,.25),w*.25)+vec3(.22,.42,.5)*g*.3;gl_FragColor=vec4(c,.88);}',
  });
  private radius = 2;
  private detail: Settings['quality'] = 'high';

  constructor(private root: THREE.Group, private simulation: Simulation) {
    const pavement = pavementTexture(); pavement.repeat.set(6, 6);
    this.groundMaterial = new THREE.MeshStandardMaterial({ map: pavement, roughness: .97, vertexColors: true });
    this.buildingMaterials = ([
      { seed: 107, style: 'glass' as const, color: '#9fb4c8' },
      { seed: 211, style: 'residence' as const, color: '#b3b5bf' },
      { seed: 307, style: 'stone' as const, color: '#c2b39d' },
      { seed: 419, style: 'brick' as const, color: '#c69a85' },
    ]).map(({ seed, style, color }) => {
      const texture = facadeTexture(seed, .36, style);
      return new THREE.MeshStandardMaterial({ map: texture.map, emissiveMap: texture.emissive, emissive: '#f4d5a7', emissiveIntensity: .66, color, roughness: style === 'glass' ? .5 : .9, metalness: style === 'glass' ? .14 : 0 });
    });
    this.urbanMaterials = {
      glass: this.buildingMaterials[0], residence: this.buildingMaterials[1], stone: this.buildingMaterials[2], brick: this.buildingMaterials[3],
      trim: this.trimMaterial, dark: this.darkMaterial, roof: this.roofMaterial, glow: this.glowMaterial, accent: this.accentMaterial,
    };
    this.materials = [this.groundMaterial, ...this.buildingMaterials, this.roadMaterial, this.trimMaterial, this.darkMaterial, this.roofMaterial, this.glowMaterial, this.accentMaterial, this.paintMaterial, this.barkMaterial, ...this.leafMaterials, this.lampMaterial, this.waterMaterial];
  }

  get stats() { return { loaded: this.active.size, pending: this.pending.length + (this.job ? 1 : 0), lastWorkMs: this.lastWorkMs, maxWorkMs: this.maxWorkMs, detail: this.detail, center: `${this.lastX},${this.lastZ}` }; }
  updateTime(time: number) { this.waterMaterial.uniforms.uTime.value = time; }

  setQuality(quality: Settings['quality'], software: boolean) {
    if (this.detail !== quality) { this.job?.iterator.return(undefined); this.job = null; }
    this.detail = quality; this.radius = quality === 'low' || software && quality !== 'high' ? 1 : 2;
    this.lastX = Number.NaN; this.lastZ = Number.NaN;
  }

  update(player: Point, _immediate = false) {
    const cx = chunkCoordinate(player.x), cz = chunkCoordinate(player.z);
    if (cx !== this.lastX || cz !== this.lastZ) {
      this.lastX = cx; this.lastZ = cz;
      const desired = new Set(nearbyChunkKeys(player.x, player.z, this.radius));
      if (this.job && !desired.has(this.job.key)) { this.job.iterator.return(undefined); this.job = null; }
      for (const key of this.layouts.keys()) if (!desired.has(key)) {
        const chunk = this.active.get(key); if (chunk) this.unload(chunk);
        else { this.simulation.removeChunkColliders(key); this.layouts.delete(key); }
      }
      for (const key of desired) {
        const [x, z] = key.split(',').map(Number); if (!isAuthoredChunk(x, z) && !this.layouts.has(key)) this.prepare(key, x, z);
      }
      this.pending = [...desired].filter(key => {
        const [x, z] = key.split(',').map(Number);
        return !isAuthoredChunk(x, z) && this.job?.key !== key && (!this.active.has(key) || this.active.get(key)!.detail !== this.detail);
      }).sort((a, b) => {
        const [ax, az] = a.split(',').map(Number), [bx, bz] = b.split(',').map(Number);
        return (ax - cx) ** 2 + (az - cz) ** 2 - ((bx - cx) ** 2 + (bz - cz) ** 2);
      });
    }
    const start = performance.now();
    for (let steps = 0; steps < 32 && (this.job || this.pending.length); steps++) {
      if (!this.job) { const key = this.pending.shift()!; this.job = { key, iterator: this.load(key) }; }
      if (this.job.iterator.next().done) this.job = null;
      if (performance.now() - start >= 3) break;
    }
    this.lastWorkMs = performance.now() - start; this.maxWorkMs = Math.max(this.maxWorkMs, this.lastWorkMs);
  }

  /** Logical obstacles precede visual generation and survive detail rebuilds. */
  private prepare(key: string, cx: number, cz: number) {
    const source = districtLayout(cx, cz);
    const buildings = source.buildings.filter(b => !this.simulation.boxColliders.some(other => Math.abs(other.x - b.x) < other.halfWidth + b.halfWidth + .7 && Math.abs(other.z - b.z) < other.halfDepth + b.halfDepth + .7));
    const layout = { ...source, buildings }, circles: CircleCollider[] = [], boxes: BoxCollider[] = [];
    for (const b of buildings) { const y = groundHeight(b.x, b.z) - .35; boxes.push({ x: b.x, z: b.z, halfWidth: b.halfWidth * 1.06, halfDepth: b.halfDepth * 1.06, minY: y, maxY: y + b.height + 3 }); }
    for (const t of layout.trees) { const y = groundHeight(t.x, t.z); circles.push({ x: t.x, z: t.z, radius: .3 * t.scale, minY: y, maxY: y + 3.1 * t.scale }); }
    for (const [dx, dz] of [[-3.1, -20], [3.1, 20], [-20, 3.1], [20, -3.1]]) { const x = cx * CHUNK_SIZE + dx, z = cz * CHUNK_SIZE + dz, y = groundHeight(x, z); circles.push({ x, z, radius: .18, minY: y, maxY: y + 4.42 }); }
    const side = Math.abs(cx * 7 + cz * 11) % 2 ? 1 : -1;
    if (['wutong', 'campus', 'office', 'skyscraper'].includes(layout.kind)) for (const offset of layout.kind === 'wutong' || layout.kind === 'campus' ? [-13, 13] : [-14, 14]) circles.push({ x: cx * CHUNK_SIZE + side * (layout.kind === 'wutong' || layout.kind === 'campus' ? 5.25 : 5.15), z: cz * CHUNK_SIZE + offset, radius: .48 });
    this.layouts.set(key, layout); this.simulation.addChunkColliders(key, circles, boxes);
  }

  private *load(key: string): Generator<void> {
    if (this.active.get(key)?.detail === this.detail) return;
    const [cx, cz] = key.split(',').map(Number), centerX = cx * CHUNK_SIZE, centerZ = cz * CHUNK_SIZE;
    const group = new THREE.Group(); group.name = `district:${key}`;
    const layout = this.layouts.get(key)!, circles: CircleCollider[] = [], boxes: BoxCollider[] = [];
    const urban = createUrbanBuckets(), trim: THREE.BufferGeometry[] = [], paint: THREE.BufferGeometry[] = [];
    const bark: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[][] = [[], [], []], poles: THREE.BufferGeometry[] = [], lamps: THREE.BufferGeometry[] = [], water: THREE.BufferGeometry[] = [];

    let complete = false;
    try {
    yield;
    const groundGeo = new THREE.PlaneGeometry(CHUNK_SIZE + .04, CHUNK_SIZE + .04, 12, 12); groundGeo.rotateX(-Math.PI / 2);
    const positions = groundGeo.attributes.position, colors: number[] = [], low = new THREE.Color('#647082'), high = new THREE.Color('#8993a0');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + centerX, z = positions.getZ(i) + centerZ;
      positions.setY(i, groundHeight(x, z));
      const color = low.clone().lerp(high, noise(x * .05 + 12, z * .05 + 13)); colors.push(color.r, color.g, color.b);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, this.groundMaterial); ground.position.set(centerX, .025, centerZ); ground.receiveShadow = true; group.add(ground);

    yield;
    const addBox = (list: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, h: number, d: number) => {
      const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); geometry(g, list);
    };
    // Two continuous avenues per chunk; short segments follow the subtle terrain.
    for (let n = -4; n < 4; n++) {
      const offset = (n + .5) * 6;
      const vertical = new THREE.BoxGeometry(8, .025, 6.08); vertical.translate(centerX, groundHeight(centerX, centerZ + offset) + .028, centerZ + offset); geometry(vertical, trim);
      const horizontal = new THREE.BoxGeometry(6.08, .026, 8); horizontal.translate(centerX + offset, groundHeight(centerX + offset, centerZ) + .03, centerZ); geometry(horizontal, trim);
      if (n % 2 === 0) {
        addBox(paint, centerX, groundHeight(centerX, centerZ + offset) + .05, centerZ + offset, .1, .02, 2.1);
        addBox(paint, centerX + offset, groundHeight(centerX + offset, centerZ) + .052, centerZ, 2.1, .02, .1);
      }
    }
    // The road batch uses its own material; extract the just-added avenue pieces from trim.
    const roadGeos = trim.splice(0, 16);

    for (const b of layout.buildings) {
      const y = groundHeight(b.x, b.z) - .35;
      appendUrbanBuilding(urban, { x: b.x, z: b.z, y, halfWidth: b.halfWidth, halfDepth: b.halfDepth, height: b.height, kind: layout.kind, variant: b.variant, surface: b.style });
      boxes.push({ x: b.x, z: b.z, halfWidth: b.halfWidth * 1.06, halfDepth: b.halfDepth * 1.06, minY: y, maxY: y + b.height + 3 });
      yield;
    }
    for (const [i, tree] of layout.trees.entries()) {
      const y = groundHeight(tree.x, tree.z), s = tree.scale;
      const trunk = new THREE.CylinderGeometry(.13 * s, .23 * s, 3.1 * s, 7); trunk.translate(tree.x, y + 1.55 * s, tree.z); geometry(trunk, bark);
      for (let k = 0; k < (this.detail === 'low' ? 1 : 3); k++) {
        const crown = new THREE.IcosahedronGeometry(1, this.detail === 'low' ? 0 : 1); crown.scale((1.05 + k * .14) * s, (.75 + k * .06) * s, (1 + k * .1) * s);
        crown.translate(tree.x + (k - 1) * .62 * s, y + (3.25 + (k % 2) * .55) * s, tree.z + (k === 1 ? -.4 : .2) * s); geometry(crown, leaves[(i + k) % leaves.length]);
      }
      circles.push({ x: tree.x, z: tree.z, radius: .3 * s, minY: y, maxY: y + 3.1 * s });
      yield;
    }
    for (const [dx, dz] of [[-3.1, -20], [3.1, 20], [-20, 3.1], [20, -3.1]]) {
      const x = centerX + dx, z = centerZ + dz, y = groundHeight(x, z);
      const pole = new THREE.CylinderGeometry(.065, .1, 4.2, 6); pole.translate(x, y + 2.1, z); geometry(pole, poles);
      const lamp = new THREE.SphereGeometry(.16, 7, 5); lamp.translate(x, y + 4.25, z); geometry(lamp, lamps);
      circles.push({ x, z, radius: .18, minY: y, maxY: y + 4.42 });
    }
    // Neighbourhood-specific street life, merged into the same batches as the architecture.
    const side = (Math.abs(cx * 7 + cz * 11) % 2) ? 1 : -1;
    if (layout.kind === 'wutong' || layout.kind === 'campus') {
      for (const offset of [-13, 13]) {
        const x = centerX + side * 5.25, z = centerZ + offset, y = groundHeight(x, z);
        addBox(urban.accent, x, y + .48, z, .62, .12, 1.65);
        addBox(urban.dark, x, y + .24, z - .57, .48, .48, .1);
        addBox(urban.dark, x, y + .24, z + .57, .48, .48, .1);
        addBox(urban.accent, x + side * .25, y + .87, z, .1, .68, 1.65);
        circles.push({ x, z, radius: .48 });
      }
    }
    if (layout.kind === 'lane') {
      for (const offset of [-12, 11]) {
        const x = centerX - side * 4.75, z = centerZ + offset, y = groundHeight(x, z);
        addBox(urban.dark, x, y + 1.55, z, .1, 3.1, .1);
        addBox(urban.accent, x, y + 2.65, z, .72, 1.05, .16);
        addBox(urban.glow, x, y + 2.67, z - side * .1, .52, .72, .05);
        addBox(paint, x + side * .6, y + .08, z, 1.1, .12, 1.8);
      }
    }
    if (layout.kind === 'office' || layout.kind === 'skyscraper') {
      for (const offset of [-14, 14]) {
        const x = centerX + side * 5.15, z = centerZ + offset, y = groundHeight(x, z);
        addBox(urban.dark, x, y + .32, z, .85, .64, 1.5);
        const shrub = new THREE.IcosahedronGeometry(.72, 1); shrub.scale(.62, .72, 1.05); shrub.translate(x, y + .91, z); geometry(shrub, leaves[1]);
        circles.push({ x, z, radius: .48 });
      }
    }
    if (layout.kind === 'campus') {
      for (let i = 0; i < 3; i++) {
        const x = centerX - side * 5.1, z = centerZ - 4 + i * .75, y = groundHeight(x, z);
        const rack = new THREE.TorusGeometry(.32, .035, 5, 12, Math.PI); rack.rotateY(Math.PI / 2); rack.translate(x, y + .34, z); geometry(rack, trim);
      }
    }
    for (let z = centerZ - CHUNK_SIZE / 2; z < centerZ + CHUNK_SIZE / 2; z += 6) {
      addBox(water, riverX(z + 3), -.48, z + 3, 12.4, .025, 6.15);
    }

    const batch = (geos: THREE.BufferGeometry[], material: THREE.Material, shadows = true) => {
      if (!geos.length) return;
      const merged = mergeGeometries(geos); geos.forEach(g => g.dispose());
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = shadows; mesh.receiveShadow = shadows; group.add(mesh);
    };
    for (const surface of Object.keys(urban) as UrbanSurface[]) { batch(urban[surface], this.urbanMaterials[surface], surface !== 'glow'); yield; }
    batch(roadGeos, this.roadMaterial, false); batch(trim, this.trimMaterial); batch(paint, this.paintMaterial, false);
    batch(bark, this.barkMaterial); leaves.forEach((geos, i) => batch(geos, this.leafMaterials[i]));
    batch(poles, this.trimMaterial); batch(lamps, this.lampMaterial, false); batch(water, this.waterMaterial, false);
    const previous = this.active.get(key); if (previous) this.unload(previous, false);
    this.root.add(group); this.active.set(key, { key, group, detail: this.detail }); complete = true;
    } finally {
      if (!complete) {
        for (const list of [...Object.values(urban), trim, paint, bark, ...leaves, poles, lamps, water]) list.forEach(g => g.dispose());
        group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      }
    }
  }

  private unload(chunk: ActiveChunk, release = true) {
    this.root.remove(chunk.group); if (release) { this.simulation.removeChunkColliders(chunk.key); this.layouts.delete(chunk.key); }
    chunk.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    this.active.delete(chunk.key);
  }

  dispose() {
    this.job?.iterator.return(undefined); this.job = null;
    for (const key of this.layouts.keys()) this.simulation.removeChunkColliders(key); this.layouts.clear();
    for (const chunk of this.active.values()) this.unload(chunk);
    this.pending = [];
    const textures = new Set<THREE.Texture>();
    for (const material of this.materials) {
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
      material.dispose();
    }
    textures.forEach(texture => texture.dispose());
  }
}
