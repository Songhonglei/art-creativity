import * as THREE from 'three';
import { box, ellipsoid, groundHeight, riverX, batchRigidParts, canvasTexture } from './materials';
import type { Simulation } from './simulation';
import { rotatedBoxBounds } from './collision';
import type { CityFeature, CityFeatureKind } from './types';

const mat = (color: string, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glow = (color: string, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .45 });

function sign(text: string, color = '#8ff5df', background = '#102b31') {
  const texture = canvasTexture((ctx, size) => {
    ctx.fillStyle = background; ctx.fillRect(0, 0, size, size / 3);
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.strokeRect(5, 5, size - 10, size / 3 - 10);
    ctx.fillStyle = color; ctx.font = '700 48px GameChineseSans, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 6 + 2);
  }, 512);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
}

function convenienceStore(root: THREE.Group, simulation: Simulation, x: number, z: number, rotation = 0) {
  const group = new THREE.Group(); group.position.set(x, groundHeight(x, z), z); group.rotation.y = rotation; root.add(group);
  const wall = mat('#d7d5c7', .92), trim = mat('#177b70', .65), dark = mat('#18303a', .55, .2);
  box(group, wall, [0, 1.65, 0], [4.8, 3.3, 3.3]);
  box(group, trim, [0, 3.12, 1.72], [5.05, .48, .18]);
  box(group, dark, [0, 1.35, 1.68], [4.25, 2.25, .12]);
  const glass = glow('#6db4b6', .3); glass.transparent = true; glass.opacity = .72;
  for (const sx of [-1.25, 1.25]) box(group, glass, [sx, 1.35, 1.77], [1.55, 1.85, .06]);
  box(group, glow('#f3d58c', .75), [0, 1.3, 1.79], [.85, 1.95, .07]);
  for (let i = 0; i < 7; i++) box(group, i % 2 ? mat('#e7e0c9') : trim, [-2.1 + i * .7, 2.55, 2.05], [.7, .12, 1.05]);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.75, 1.05), sign('24  便利店')); board.position.set(0, 3.55, 1.82); group.add(board);
  const inside = new THREE.PointLight('#b8ffe4', 3.5, 7, 2); inside.position.set(0, 2, 2.1); group.add(inside);
  for (let i = 0; i < 3; i++) box(group, mat(['#e59c55', '#70a6c8', '#b95f64'][i]), [-1.6 + i * .35, .35, 2.15], [.28, .7, .35]);
  batchRigidParts(group);
  simulation.boxColliders.push({ x, z, ...rotatedBoxBounds(2.55, 1.8, rotation), minY: groundHeight(x, z), maxY: groundHeight(x, z) + 4.1 });
}

function taxi(root: THREE.Group, simulation: Simulation, x: number, z: number, rotation = 0) {
  const group = new THREE.Group(); group.position.set(x, groundHeight(x, z) + .04, z); group.rotation.y = rotation; root.add(group);
  const yellow = mat('#d9a62b', .38, .25), dark = mat('#151d28', .3, .35), chrome = mat('#aab8bd', .25, .75);
  box(group, yellow, [0, .62, 0], [1.85, .65, 3.75]);
  box(group, yellow, [0, 1.08, -.2], [1.65, .55, 2.05]);
  box(group, dark, [0, 1.16, .88], [1.48, .43, .08]);
  box(group, dark, [0, 1.16, -1.25], [1.48, .43, .08]);
  for (const side of [-1, 1]) {
    box(group, dark, [side * .84, 1.13, -.18], [.06, .4, 1.65]);
    box(group, chrome, [side * .94, .68, 0], [.04, .12, 2.75]);
    for (const wz of [-1.18, 1.18]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .22, 12), dark); wheel.rotation.z = Math.PI / 2; wheel.position.set(side * .96, .42, wz); group.add(wheel);
    }
    box(group, glow('#fff0ba', 1.3), [side * .58, .69, 1.9], [.38, .2, .06]);
    box(group, glow('#ef5555', .8), [side * .6, .67, -1.9], [.34, .18, .06]);
  }
  box(group, glow('#f8dd7b', .9), [0, 1.55, -.18], [.72, .26, .38]);
  const topper = new THREE.Mesh(new THREE.PlaneGeometry(.62, .2), sign('TAXI', '#17231f', '#f5d86e')); topper.position.set(0, 1.56, .02); group.add(topper);
  for (let i = 0; i < 7; i++) box(group, i % 2 ? dark : mat('#eee6d2'), [-.77 + i * .25, .82, 1.895], [.22, .11, .025]);
  batchRigidParts(group);
  simulation.boxColliders.push({ x, z, ...rotatedBoxBounds(1.1, 2.05, rotation), minY: groundHeight(x, z), maxY: groundHeight(x, z) + 1.7 });
}

function drunkenYouth(root: THREE.Group, simulation: Simulation, x: number, z: number) {
  const group = new THREE.Group(); group.position.set(x, groundHeight(x, z), z); root.add(group);
  const jacket = mat('#684b78'), trousers = mat('#283143'), skin = mat('#c38f72');
  ellipsoid(group, jacket, [0, 1.05, 0], [.31, .48, .22]);
  ellipsoid(group, skin, [.08, 1.68, .02], [.2, .23, .2]);
  for (const side of [-1, 1]) {
    const leg = box(group, trousers, [side * .14, .42, 0], [.18, .78, .2]); leg.rotation.z = side * .08;
    const arm = box(group, jacket, [side * .35, 1.02, .03], [.16, .7, .18]); arm.rotation.z = side * .35;
  }
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .38, 8), glow('#5da783', .2)); bottle.position.set(.57, .73, .06); bottle.rotation.z = -.25; group.add(bottle);
  box(group, mat('#69717a'), [-.65, .45, -.25], [.75, .12, 1.6]);
  box(group, mat('#454c57'), [-.65, .22, -.75], [.62, .45, .12]); box(group, mat('#454c57'), [-.65, .22, .25], [.62, .45, .12]);
  batchRigidParts(group); simulation.colliders.push({ x, z, radius: .45 });
  return group;
}

function park(root: THREE.Group, simulation: Simulation) {
  const x = -17, z = -36, y = groundHeight(x, z), group = new THREE.Group(); root.add(group);
  const lawn = mat('#365f4b', 1), path = mat('#9a9380', .95), hedge = mat('#294c3c', 1), bark = mat('#645b4d', 1);
  box(group, lawn, [x, y + .025, z], [19, .05, 16]);
  box(group, path, [x, y + .06, z], [2, .06, 16]); box(group, path, [x, y + .065, z], [19, .06, 1.7]);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) box(group, hedge, [x - 8 + i * 4, y + .38, z + side * 7.4], [3.1, .7, .65]);
  const leafMaterials = ['#3f7251', '#557f51', '#315e48'].map(c => mat(c, 1));
  [[-7, -5], [7, -5], [-7, 5], [7, 5], [-5, 0], [5, 1]].forEach(([dx, dz], i) => {
    const tx = x + dx, tz = z + dz, ty = groundHeight(tx, tz);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, 3.3, 7), bark); trunk.position.set(tx, ty + 1.65, tz); group.add(trunk);
    for (let k = 0; k < 3; k++) ellipsoid(group, leafMaterials[(i + k) % 3], [tx + (k - 1) * .55, ty + 3.5 + (k % 2) * .45, tz], [1.15, 1, 1.05]);
    simulation.colliders.push({ x: tx, z: tz, radius: .45, minY: ty, maxY: ty + 3.3 });
  });
  for (const dx of [-4, 4]) {
    box(group, mat('#8b6648'), [x + dx, y + .52, z + 2.2], [2.2, .14, .55]);
    box(group, mat('#424a51'), [x + dx, y + .25, z + 2.2], [1.7, .5, .35]);
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .9), sign('梧桐口袋公园', '#e8d695', '#244c3b')); board.position.set(x, y + 2.15, z + 7.7); group.add(board);
  box(group, bark, [x, y + 1.1, z + 7.65], [.12, 2.2, .12]);
  const pondMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(position.x*5.+uTime*2.)*.025;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float uTime;void main(){float w=sin(vUv.x*38.+uTime*2.+sin(vUv.y*24.))*.5+.5;float edge=smoothstep(0.,.15,vUv.x)*smoothstep(0.,.15,vUv.y)*smoothstep(0.,.15,1.-vUv.x)*smoothstep(0.,.15,1.-vUv.y);vec3 c=mix(vec3(.035,.12,.16),vec3(.18,.42,.43),pow(w,8.));gl_FragColor=vec4(c,edge*.85);}',
  });
  const pond = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.8, 18, 12), pondMaterial); pond.rotation.x = -Math.PI / 2; pond.position.set(x - 4.8, y + .09, z - 2.6); group.add(pond);
  batchRigidParts(group); // The pond retains its own material and is not merged with opaque geometry.
  return pondMaterial;
}

function modernBridge(root: THREE.Group) {
  const z = -12, group = new THREE.Group(); group.position.set(riverX(z), 0, z); root.add(group);
  const steel = mat('#718292', .45, .6), concrete = mat('#626d78', .85), light = glow('#8edce4', 1.2);
  box(group, concrete, [0, 1.12, 0], [20, .52, 4.4]);
  for (const side of [-2.05, 2.05]) {
    box(group, steel, [0, 1.75, side], [20, .12, .12]);
    for (let i = -9; i <= 9; i += 2) box(group, light, [i, 1.86, side], [.18, .12, .18]);
  }
  for (const tx of [-4.2, 4.2]) {
    box(group, steel, [tx, 5.1, 0], [.4, 8, .55]);
    box(group, light, [tx, 9.15, 0], [.55, .35, .7]);
    for (const side of [-1.85, 1.85]) for (const dx of [-6, -3, 3, 6]) {
      const start = new THREE.Vector3(tx, 8.5, 0), end = new THREE.Vector3(tx + dx, 1.85, side);
      const length = start.distanceTo(end), cable = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, length, 5), steel);
      cable.position.copy(start).lerp(end, .5); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()); group.add(cable);
    }
  }
  batchRigidParts(group);
}

export function createCityLife(root: THREE.Group, simulation: Simulation) {
  const features: CityFeature[] = [];
  const add = (kind: CityFeatureKind, label: string, x: number, z: number) => features.push({ kind, label, x, z });
  convenienceStore(root, simulation, -9, 24); add('store', '便利店', -9, 24);
  convenienceStore(root, simulation, 5, -45, Math.PI); add('store', '便利店', 5, -45);
  taxi(root, simulation, 3.5, 27); add('taxi', '出租车', 3.5, 27);
  taxi(root, simulation, 6, -29, Math.PI / 2); add('taxi', '出租车', 6, -29);
  const youths = [drunkenYouth(root, simulation, -6, 16), drunkenYouth(root, simulation, -13, -8)];
  add('youth', '醉酒少年', -6, 16); add('youth', '醉酒少年', -13, -8);
  const pondMaterial = park(root, simulation); add('park', '梧桐口袋公园', -17, -36);
  modernBridge(root); add('bridge', '江湾步行大桥', riverX(-12), -12);
  add('river', '黄浦江水声', riverX(12), 12);
  return {
    features, dynamicRoots: youths,
    update(t: number) {
      pondMaterial.uniforms.uTime.value = t;
      youths.forEach((youth, i) => { youth.rotation.z = Math.sin(t * 1.25 + i * 2.1) * .055; youth.rotation.y = Math.sin(t * .37 + i) * .22; });
    },
  };
}
