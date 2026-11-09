import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function random(seed: number) {
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const fract = (n: number) => n - Math.floor(n);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
export function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}
export function fbm(x: number, y: number) { return noise(x, y) * .55 + noise(x * 2.1, y * 2.1) * .27 + noise(x * 4.3, y * 4.3) * .12 + noise(x * 8.1, y * 8.1) * .06; }
export const riverX = (z: number) => 25 + 8 * Math.sin(z * .033) + 3 * Math.sin(z * .082);
export function groundHeight(x: number, z: number) {
  // A city plaza: nearly flat paving, with the Huangpu river cutting a bed to the east.
  const n = (fbm(x * .03 + 12, z * .03 + 8) - .5) * .55;
  const bed = 1 - THREE.MathUtils.smoothstep(Math.abs(x - riverX(z)), 2.5, 7.5);
  const streetLevel = n + .1 - bed * 1.6;
  const bridgeX = 1 - THREE.MathUtils.smoothstep(Math.abs(x - riverX(z)), 7.2, 9.4);
  const bridgeZ = Math.max(1 - THREE.MathUtils.smoothstep(Math.abs(z - 30), 1.4, 2.3), 1 - THREE.MathUtils.smoothstep(Math.abs(z + 12), 1.8, 3));
  return THREE.MathUtils.lerp(streetLevel, 1.4, bridgeX * bridgeZ);
}

export function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!; draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Night-city pavement: dark asphalt slabs, faint lane paint, manhole discs. */
export function pavementTexture() {
  return canvasTexture((ctx, s) => {
    const rng = random(20261107);
    ctx.fillStyle = '#31343e'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { const g = 40 + rng() * 40; ctx.fillStyle = `rgba(${g},${g + 3},${g + 12},${.14 + rng() * .2})`; ctx.fillRect(rng() * s, rng() * s, 1 + rng() * 3, 1 + rng() * 2); }
    ctx.strokeStyle = 'rgba(16,18,26,.85)'; ctx.lineWidth = 2;
    for (let y = 0; y <= s; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
    for (let x = 0; x <= s; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(200,205,220,.05)'; ctx.lineWidth = 1;
    for (let y = 2; y <= s; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
    for (let i = 0; i < 5; i++) { const x = rng() * s, y = rng() * s; ctx.fillStyle = '#23252d'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(150,155,170,.25)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }, 512);
}

export function makeMaterials() {
  const rng = random(1209);
  const skinTexture = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#2c2f3a'; ctx.fillRect(0, 0, s, s);
    for (let row = -1; row < 29; row++) for (let col = -1; col < 23; col++) {
      const x = col * 25 + (row % 2) * 12.5, y = row * 19, variation = rng();
      const shade = Math.floor(96 + variation * 38);
      const gradient = ctx.createLinearGradient(x, y - 8, x, y + 9);
      gradient.addColorStop(0, `rgb(${shade + 22},${shade + 24},${shade + 34})`);
      gradient.addColorStop(.45, `rgb(${shade + 4},${shade + 6},${shade + 16})`);
      gradient.addColorStop(1, `rgb(${shade - 20},${shade - 18},${shade - 8})`);
      ctx.fillStyle = gradient; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const px = x + Math.cos(a) * (11.5 + rng()), py = y + Math.sin(a) * (9 + rng()); if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,22,32,.5)'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (let i = 0; i < 24000; i++) { ctx.fillStyle = rng() > .5 ? 'rgba(190,200,225,.08)' : 'rgba(12,14,22,.14)'; ctx.fillRect(rng() * s, rng() * s, 1, 1); }
  });
  skinTexture.repeat.set(2, 2);
  const fabric = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#232c3e'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) { ctx.strokeStyle = i % 4 ? 'rgba(10,14,24,.2)' : 'rgba(120,140,190,.1)'; ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke(); }
    for (let i = 0; i < 20000; i++) { ctx.fillStyle = `rgba(6,9,16,${rng() * .2})`; ctx.fillRect(rng() * s, rng() * s, 1 + rng() * 3, 1); }
    ctx.strokeStyle = '#5f7fb8'; ctx.lineWidth = 4; ctx.strokeRect(17, 17, s - 34, s - 34);
    ctx.setLineDash([4, 5]); ctx.lineWidth = 2; ctx.strokeRect(26, 26, s - 52, s - 52);
  });
  const skin = new THREE.MeshStandardMaterial({ map: skinTexture, bumpMap: skinTexture, bumpScale: .1, roughness: .89, color: '#c9d2e8' });
  const armor = new THREE.MeshStandardMaterial({ map: skinTexture, bumpMap: skinTexture, bumpScale: .16, roughness: .88, color: '#8b94b0' });
  const belly = new THREE.MeshStandardMaterial({ map: skinTexture, roughness: .95, color: '#9aa2bd' });
  const bone = new THREE.MeshStandardMaterial({ color: '#cfd4e2', roughness: .63, map: skinTexture });
  const horn = new THREE.MeshStandardMaterial({ color: '#c4cade', roughness: .57, map: skinTexture, bumpMap: skinTexture, bumpScale: .05 });
  const metal = new THREE.MeshStandardMaterial({ color: '#96a2b8', metalness: .75, roughness: .31 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#2e3340', metalness: .6, roughness: .5 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c8a45e', metalness: .7, roughness: .4 });
  const leather = new THREE.MeshStandardMaterial({ color: '#232833', map: fabric, roughness: .93 });
  const cloth = new THREE.MeshStandardMaterial({ map: fabric, color: '#8fa0c4', roughness: .98, side: THREE.DoubleSide });
  const darkCloth = new THREE.MeshStandardMaterial({ color: '#1d2331', roughness: 1 });
  const face = new THREE.MeshStandardMaterial({ color: '#c99e7e', roughness: .9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#171a24', roughness: .95 });
  const eye = new THREE.MeshStandardMaterial({ color: '#7fd8ff', emissive: '#2f9fd8', emissiveIntensity: .9, roughness: .23 });
  return { skin, armor, belly, bone, horn, metal, darkMetal, gold, leather, cloth, darkCloth, face, dark, eye };
}
export type Materials = ReturnType<typeof makeMaterials>;

const sphereGeometry = new THREE.SphereGeometry(1, 24, 18);
const mediumSphereGeometry = new THREE.SphereGeometry(1, 16, 12);
const smallSphereGeometry = new THREE.SphereGeometry(1, 10, 8);
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
export function ellipsoid(parent: THREE.Object3D, material: THREE.Material, pos: number[], scale: number[], rotation = 0) {
  const mesh = new THREE.Mesh(sizeGeometry(scale), material); mesh.position.set(pos[0], pos[1], pos[2]); mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.rotation.x = rotation; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function sizeGeometry(scale: number[]) {
  const size = Math.max(...scale);
  return size > 1 ? sphereGeometry : size > .35 ? mediumSphereGeometry : smallSphereGeometry;
}
export function box(parent: THREE.Object3D, material: THREE.Material, pos: number[], scale: number[]) {
  const mesh = new THREE.Mesh(boxGeometry, material); mesh.position.set(pos[0], pos[1], pos[2]); mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function taperedTube(points: THREE.Vector3[], radii: number[], material: THREE.Material, sides = 10, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points), frames = curve.computeFrenetFrames(segments, false);
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, point = curve.getPointAt(t), f = t * (radii.length - 1), j = Math.min(Math.floor(f), radii.length - 2);
    const radius = THREE.MathUtils.lerp(radii[j], radii[j + 1], f - j);
    for (let k = 0; k <= sides; k++) {
      const a = k / sides * Math.PI * 2;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      const v = point.clone().addScaledVector(normal, radius); vertices.push(v.x, v.y, v.z); uv.push(k / sides, t);
      if (i < segments && k < sides) { const n = i * (sides + 1) + k; indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

/** Batch rigid pieces while leaving animated joints and cloth independent. */
export function batchRigidParts(group: THREE.Group, exclude: THREE.Object3D[] = []) {
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const object of group.children) {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || exclude.includes(object)) continue;
    const batch = batches.get(object.material) ?? []; batch.push(object); batches.set(object.material, batch);
  }
  for (const [material, objects] of batches) {
    if (objects.length < 2) continue;
    const geometries = objects.map(object => {
      object.updateMatrix();
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrix);
      if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      return geometry;
    });
    const merged = mergeGeometries(geometries);
    if (merged) {
      objects.forEach(object => group.remove(object));
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    geometries.forEach(geometry => geometry.dispose());
  }
}
