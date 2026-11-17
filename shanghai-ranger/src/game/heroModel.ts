import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { attackPose, dodgePose } from './combat';
import { RECOVERY, recoveryPose } from './recovery';
import type { Materials } from './materials';
import type { Simulation } from './simulation';
import type { Gender, Skin, Weapon } from './types';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const palettes = {
  nightwatch: ['#28475f', '#1d3247', '#3f8d91', '#d9d5c5', '#744b35', '#bd8d4e'],
  magnolia: ['#d8d2bd', '#565964', '#8f3648', '#f3ead7', '#673d42', '#d2ac59'],
  neon: ['#29263e', '#151a29', '#784dba', '#abb4c9', '#262336', '#5eaaa9'],
  'wutong-warden': ['#214b48', '#243c50', '#426963', '#ded7bf', '#73513a', '#bd985f'],
  'riverside-sentinel': ['#203a56', '#192e44', '#377b7d', '#e0d7bd', '#584536', '#c3aa76'],
  'shanghai-paragon': ['#172d40', '#182532', '#713e49', '#e7ddc7', '#4b3639', '#cfab66'],
} as const;
function mat(color: string, roughness = .85, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, p: number[], name = '') {
  const object = new THREE.Mesh(geometry, material); object.position.set(p[0], p[1], p[2]); object.name = name; object.castShadow = object.receiveShadow = true; parent.add(object); return object;
}
function sphere(parent: THREE.Object3D, material: THREE.Material, p: number[], scale: number[], name = '') {
  const object = mesh(parent, new THREE.SphereGeometry(1, Math.max(...scale) > .1 ? 16 : 10, Math.max(...scale) > .1 ? 12 : 8), material, p, name); object.scale.set(scale[0], scale[1], scale[2]); return object;
}
function tile(parent: THREE.Object3D, material: THREE.Material, p: number[], size: number[], name = '') {
  return mesh(parent, new RoundedBoxGeometry(size[0], size[1], size[2], 1, Math.min(.025, ...size.map(n => n * .2))), material, p, name);
}
function line(parent: THREE.Object3D, material: THREE.Material, points: number[][], radius: number, name = '') {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => v(p[0], p[1], p[2]))), Math.max(4, points.length * 3), radius, 5, false), material, [0, 0, 0], name);
}
/** Hero resources are private. Merge by rigid joint/material, releasing every source geometry. */
function batch(group: THREE.Group, deep = false, exclude: THREE.Object3D[] = []) {
  const buckets = new Map<boolean, THREE.Mesh[]>();
  group.updateMatrixWorld(true);
  const visit = (object: THREE.Object3D) => {
    if (exclude.includes(object)) return;
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.material.transparent && !object.material.map) {
      const metal = object.material.metalness > .4, list = buckets.get(metal) ?? []; list.push(object); buckets.set(metal, list);
    }
    if (deep) object.children.forEach(visit);
  };
  [...group.children].forEach(visit);
  const inverse = group.matrixWorld.clone().invert();
  for (const [metal, objects] of buckets) {
    const pieces = objects.map(o => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const color = (o.material as THREE.MeshStandardMaterial).color, colors = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.setAttribute('surfaceRoughness', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill((o.material as THREE.MeshStandardMaterial).roughness), 1)); return g;
    });
    const joined = mergeGeometries(pieces); pieces.forEach(g => g.dispose());
    if (!joined) throw new Error('主角模型合批失败');
    objects.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
    const surface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: metal ? .38 : .80, metalness: metal ? .68 : 0, side: THREE.DoubleSide });
    // Preserve cloth/leather/eye roughness inside a single rigid draw, without extra materials.
    surface.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float surfaceRoughness;\nvarying float vSurfaceRoughness;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfaceRoughness = surfaceRoughness;');
      shader.fragmentShader = 'varying float vSurfaceRoughness;\n' + shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vSurfaceRoughness, 0.04, 1.0);');
    };
    surface.customProgramCacheKey = () => 'hero-surface-roughness-v1';
    mesh(group, joined, surface, [0, 0, 0], metal ? 'metal-trim' : 'fabric-and-anatomy');
  }
}
export function disposeHero(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
  materials.forEach(m => Object.values(m).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }));
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

/** Shared by world, portrait and fitting room; size/collisions never depend on outfit or gender. */
export function createHunter(_materials: Materials | null, skin: Skin = 'nightwatch', gender: Gender = 'male') {
  const colors = palettes[skin], rank = skin === 'shanghai-paragon' ? 10 : skin === 'riverside-sentinel' ? 7 : skin === 'wutong-warden' ? 4 : 1;
  const coat = mat(colors[0]), dark = mat(colors[1]), lining = mat(colors[2]), ivory = mat(colors[3]), leather = mat(colors[4], .67), brass = mat(colors[5], .38, .68);
  const skinMat = mat('#c99d7e', .8), hair = mat(gender === 'female' ? '#714d36' : '#202733', .9), hairLight = mat(gender === 'female' ? '#9e7350' : '#394150');
  const ink = mat('#25252b', .6), white = mat('#eee5d5', .5), iris = mat(gender === 'female' ? '#79553d' : '#4f6069', .4);
  const jade = mat('#79bcb2', .38, .25);
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group();
  root.name = `hunter:${skin}:${gender}`; body.name = 'hunterBody'; head.name = 'heroHead'; root.add(body); body.add(head); head.position.y = 1.88;
  const parts: string[] = ['tailored-torso', 'lapels', 'waistcoat', 'gloves', 'boots', 'jointed-elbows', 'jointed-knees'];
  root.userData = { skin, gender, rank, designParts: parts };
  const torso = mesh(body, new THREE.CylinderGeometry(.30, .235, .62, 16), coat, [0, 1.31, 0]); torso.scale.z = .71;
  tile(body, ivory, [0, 1.43, .177], [.22, .34, .05]); tile(body, lining, [0, 1.30, .202], [.26, .36, .045]);
  for (const side of [-1, 1]) {
    const lapel = tile(body, coat, [side * .143, 1.48, .226], [.11, .30, .03]); lapel.rotation.z = side * .22;
    tile(body, brass, [side * .04, 1.51, .25], [.012, .12, .009]);
    for (let i = 0; i < (rank >= 4 ? 4 : 3); i++) sphere(body, brass, [side * .078, 1.40 - i * .075, .233], [.012, .012, .007]);
    tile(body, leather, [side * .254, .96, -.03], [.115, .17, .105]); tile(body, brass, [side * .254, 1.00, .025], [.035, .035, .012]);
  }
  tile(body, leather, [0, 1.00, 0], [.51, .09, .35]); tile(body, brass, [0, 1.00, .195], [.085, .07, .026]); tile(body, dark, [0, 1.00, .214], [.05, .04, .012]);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.105, .026, 6, 16), lining); collar.rotation.x = Math.PI / 2; collar.position.y = 1.65; body.add(collar);
  sphere(body, skinMat, [0, 1.72, 0], [.064, .09, .062]);
  // Refined face, shared jaw/nose/ears; eye surface follows the curved face rather than a flat card.
  sphere(head, skinMat, [0, 0, .015], [.142, .177, .134]); sphere(head, skinMat, [0, -.082, .041], [.096, .075, .098]);
  sphere(head, skinMat, [0, -.016, .142], [.025, .043, .027]); sphere(head, skinMat, [0, -.041, .155], [.025, .019, .019]);
  line(head, leather, [[-.029, -.093, .135], [0, -.097, .14], [.027, -.091, .135]], .003);
  for (const side of [-1, 1]) {
    sphere(head, skinMat, [side * .142, -.005, -.006], [.026, .047, .027]);
    const eye = new THREE.Group(); eye.name = `${side < 0 ? 'left' : 'right'}Eye`; eye.position.set(side * .060, .034, .128); eye.rotation.y = side * .32; head.add(eye);
    const w = gender === 'female' ? .039 : .031, h = gender === 'female' ? .023 : .017;
    const almond = new THREE.Shape(); almond.moveTo(-w, 0); almond.quadraticCurveTo(-w * .35, h * 1.5, w, 0); almond.quadraticCurveTo(w * .15, -h * 1.35, -w, 0); mesh(eye, new THREE.ShapeGeometry(almond, 12), white, [0, 0, .003]); sphere(eye, iris, [side * -.002, 0, .011], [h * .64, h * .82, .004]);
    sphere(eye, ink, [side * -.002, 0, .0148], [h * .29, h * .54, .002]); sphere(eye, white, [-.004, .006, .017], [.004, .004, .002]);
    line(eye, ink, [[-w, 0, .002], [-w * .45, h * .88, .010], [w * .42, h * .88, .010], [w, .001, .002]], .0028);
    line(eye, skinMat, [[-w, -.001, .002], [0, -h * .83, .011], [w, 0, .002]], .0025);
    line(eye, hair, [[-w, h + .014, -.003], [0, h + .023, .002], [w, h + .013, -.003]], .004);
  }
  // Cap follows the scalp; swept fringe stays above the eyes.
  const cap = mesh(head, new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * .49), hair, [0, .038, -.008]); cap.scale.set(.147, .15, .142);
  sphere(head, hair, [0, .035, -.095], [.14, .135, .063]);
  if (gender === 'female') {
    for (let i = 0; i < 3; i++) line(head, i === 1 ? hairLight : hair, [[-.10 + i * .018, .138, .027], [-.025 + i * .02, .137, .094], [.055 + i * .02, .096, .119]], .005);
  } else for (let i = 0; i < 5; i++) line(head, i % 2 ? hairLight : hair, [[-.11 + i * .041, .119, .031], [-.10 + i * .041, .111, .106], [-.085 + i * .034, .087, .125]], .008);

  const pony = new THREE.Group(); pony.name = 'ponytail'; head.add(pony);
  if (gender === 'female') {
    parts.push('chestnut-long-ponytail');
    sphere(pony, hair, [0, .105, -.12], [.066, .064, .068]);
    const path = new THREE.CatmullRomCurve3([v(0, .11, -.16), v(0, .06, -.29), v(.018, -.12, -.44), v(.025, -.35, -.63), v(.01, -.55, -.60)]);
    const geometry = new THREE.TubeGeometry(path, 18, .057, 9, false), pos = geometry.attributes.position;
    // Narrow the end while retaining an opaque outer shell clear of neck/hood/cape.
    for (let i = 0; i < pos.count; i++) { const t = Math.floor(i / 10) / 18, center = path.getPointAt(t), point = v(pos.getX(i), pos.getY(i), pos.getZ(i)); point.sub(center).multiplyScalar(1 - t * .69).add(center); pos.setXYZ(i, point.x, point.y, point.z); }
    geometry.computeVertexNormals(); mesh(pony, geometry, hair, [0, 0, 0]);
    line(pony, hairLight, [[-.025, .11, -.20], [-.025, .01, -.34], [-.016, -.20, -.55], [.006, -.47, -.63]], .005);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(.055, .009, 5, 12), leather); tie.position.set(0, .09, -.17); pony.add(tie); batch(pony);
  }
  if (skin === 'neon') {
    parts.push('split-lenses', 'temples', 'nose-bridge');
    const glass = new THREE.MeshPhysicalMaterial({ color: '#9bd5cd', transparent: true, opacity: .12, roughness: .25, metalness: .05, depthWrite: false });
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(-.043, .012); shape.lineTo(-.025, .030); shape.lineTo(.032, .025); shape.lineTo(.045, .004); shape.lineTo(.025, -.026); shape.lineTo(-.025, -.022); shape.closePath();
      const lens = mesh(head, new THREE.ShapeGeometry(shape), glass, [side * .062, .034, .151]); lens.rotation.y = side * .30;
      const frame = shape.getPoints(12).map(p => [p.x, p.y, .002]); frame.push(frame[0]); const frameRoot = new THREE.Group(); frameRoot.position.copy(lens.position); frameRoot.rotation.copy(lens.rotation); head.add(frameRoot); line(frameRoot, brass, frame, .0035); 
      line(head, brass, [[side * .104, .05, .135], [side * .143, .046, .05], [side * .146, .01, -.027]], .0035);
      tile(head, jade, [side * .125, .049, .095], [.015, .012, .017]);
    }
    line(head, brass, [[-.018, .044, .158], [0, .050, .168], [.018, .044, .158]], .003); 
  }

  const arms: { upper: THREE.Group; lower: THREE.Group; shoulder: THREE.Vector3 }[] = [], legs: { upper: THREE.Group; lower: THREE.Group }[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(), shin = new THREE.Group(); leg.name = side < 0 ? 'leftLeg' : 'rightLeg'; shin.name = 'knee'; leg.position.set(side * .155, .96, 0); shin.position.y = -.43; leg.add(shin); body.add(leg); legs.push({ upper: leg, lower: shin });
    const thigh = mesh(leg, new THREE.CylinderGeometry(.105, .085, .43, 12), dark, [0, -.215, 0]); thigh.scale.z = .92;
    sphere(shin, dark, [0, 0, 0], [.088, .086, .083]);
    mesh(shin, new THREE.CylinderGeometry(.079, .068, .34, 12), leather, [0, -.20, 0]); tile(shin, leather, [0, -.445, .065], [.185, .145, .31]);
    tile(shin, dark, [0, -.508, .066], [.19, .028, .315]); tile(shin, brass, [side * .071, -.20, .039], [.024, .025, .02]);
    if (rank >= 4) { tile(shin, coat, [0, -.035, .077], [.13, .12, .045]); tile(shin, brass, [0, -.064, .105], [.09, .012, .012]); }
    if (rank === 10) { tile(shin, ivory, [0, -.18, .073], [.12, .17, .034]); tile(shin, brass, [0, -.19, .095], [.012, .14, .012]); }
    const upper = new THREE.Group(), lower = new THREE.Group(), shoulder = v(side * .35, 1.54, 0); upper.position.copy(shoulder); upper.name = side < 0 ? 'leftArm' : 'rightArm'; lower.name = side < 0 ? 'leftElbow' : 'rightElbow'; body.add(upper, lower); arms.push({ upper, lower, shoulder });
    const sleeve = mesh(upper, new THREE.CylinderGeometry(.10, .078, .28, 12), coat, [0, -.14, 0]); sleeve.scale.z = .95;
    sphere(lower, coat, [0, 0, 0], [.078, .075, .076]); mesh(lower, new THREE.CylinderGeometry(.077, .058, .25, 12), coat, [0, -.125, 0]);
    tile(lower, leather, [0, -.20, .028], [.13, .105, .12]); sphere(lower, leather, [0, -.30, .015], [.067, .078, .057]); sphere(lower, leather, [-side * .047, -.292, .05], [.027, .045, .027]);
    tile(lower, brass, [0, -.17, .092], [.076, .014, .012]);
    const wrist = new THREE.Group(); wrist.name = side < 0 ? 'leftWrist' : 'rightWrist'; wrist.position.set(0, -.30, 0); lower.add(wrist);
    if (rank === 10) { tile(lower, ivory, [0, -.14, -.01], [.139, .05, .12]); tile(lower, jade, [0, -.14, .061], [.027, .026, .012]); }
    const shoulderPad = tile(upper, rank === 10 ? brass : dark, [0, .008, -.013], [.22, .105, .25]); shoulderPad.rotation.z = side * -.12;
    if (rank >= 4) tile(upper, rank === 10 ? ivory : lining, [side * .015, .054, -.015], [.22, .03, .25]);
    if (rank === 10) tile(upper, brass, [side * .025, .080, -.015], [.19, .024, .22]);
    // Separate outer/inner panels travel with their thigh; an open centre preserves stride clearance.
    if (skin !== 'neon') {
      const length = rank >= 7 ? .65 : rank >= 4 ? .48 : .46;
      const verts: number[] = [], uv: number[] = [], indices: number[] = [];
      const point = (row: number, i: number) => {
        const a = i / 10 * Math.PI, f = row / 4;
        // Front hems cover the knee; the rear vent is raised to clear a bent calf.
        const backVent = Math.max(0, -Math.cos(a)) * .19 * f;
        return [side * (-.112 + Math.sin(a) * (.31 + f * .03)), .025 - f * length + backVent, Math.cos(a) * (.19 + f * .035) - .018];
      };
      for (let row = 0; row <= 4; row++) for (let i = 0; i <= 10; i++) { verts.push(...point(row, i)); uv.push(i / 10, row / 4); if (row < 4 && i < 10) { const n = row * 11 + i; indices.push(n, n + 11, n + 1, n + 1, n + 11, n + 12); } }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
      mesh(leg, geometry, coat, [0, 0, 0], 'curved-coat-panel');
      line(leg, brass, Array.from({ length: 11 }, (_, i) => point(4, i)), .004);
      line(leg, lining, [point(0, 0), point(2, 0), point(4, 0)], rank === 10 ? .017 : .010);
      if (rank === 10) line(leg, ivory, [point(0, 2), point(2, 2), point(4, 2)], .022);

    }
    [upper, lower, leg, shin].forEach(group => batch(group));
  }
  // Short shoulder mantles and long split drapes stay behind the arm/leg movement envelope.
  const capes: THREE.Group[] = [];
  const weave = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const nx = (x - 64) / 64, ny = y / 128, wave = Math.sin(nx * 8 + ny * 10);
    const motif = rank >= 7 ? ny > .22 && ny < .72 && Math.abs(wave * .025 + ny % .12 - .06) < .006 : rank >= 4 ? Math.abs(Math.abs(nx) - (1 - ny) * .48) < .014 && ny > .15 && ny < .75 : skin === 'magnolia' ? Math.abs(Math.sin(Math.atan2(ny - .45, nx) * 5) * .18 - Math.hypot(nx * .6, ny - .45)) < .012 : false;
    const shade = motif ? 174 : 246 + ((x + y) % 3) * 3, n = (y * 128 + x) * 4; weave[n] = shade; weave[n + 1] = shade; weave[n + 2] = shade; weave[n + 3] = 255;
  }
  const wovenTexture = new THREE.DataTexture(weave, 128, 128); wovenTexture.colorSpace = THREE.SRGBColorSpace; wovenTexture.needsUpdate = true;

  const capePanel = (top: number, bottom: number, halfWidth: number, z: number, material: THREE.Material, split: boolean) => {
    for (const side of [-1, 1]) {
      const group = new THREE.Group(); group.name = 'capePanel'; group.userData.longDrape = bottom < 1; body.add(group); capes.push(group);
      const inner = split ? .035 : .006, outer = halfWidth;
      const pts = [side * inner, top, z, side * outer, top - .06, z, side * inner, bottom + .02, z - .055, side * outer, bottom, z - .055];
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); geo.setIndex([0, 2, 1, 1, 2, 3]); geo.computeVertexNormals();
      const cloth = material.clone() as THREE.MeshStandardMaterial; cloth.map = wovenTexture; cloth.side = THREE.DoubleSide; mesh(group, geo, cloth, [0, 0, 0]);
      line(group, brass, [[side * outer, top - .06, z - .003], [side * outer, bottom, z - .058], [side * inner, bottom + .02, z - .058]], .005);
      batch(group);
    }
  };
  capePanel(1.58, skin === 'neon' ? 1.02 : rank >= 7 ? .50 : .68, rank >= 7 ? .35 : .29, -.28, coat, true);
  if (skin === 'nightwatch') {
    parts.push('folded-hood'); sphere(body, dark, [0, 1.61, -.16], [.18, .077, .12]);
    line(body, lining, [[-.15, 1.62, -.20], [0, 1.58, -.26], [.15, 1.62, -.20]], .013);
  }
  if (rank >= 4) {
    parts.push('short-mantle', 'tool-case', 'knee-guards'); capePanel(1.58, 1.24, .36, -.305, lining, false);
    tile(body, leather, [-.29, 1.16, -.08], [.08, .17, .09]); tile(body, brass, [-.29, 1.25, -.08], [.07, .018, .08]);
    // Subtle species-independent leaves/water embroidery on the back, fixed to the upper panel.
    for (const side of [-1, 1]) line(body, rank === 10 ? brass : dark, [[0, 1.48, -.317], [side * .08, 1.41, -.325], [side * .16, 1.43, -.329]], .004);
  }
  if (rank >= 7) {
    parts.push('double-mantle', 'long-split-coat', 'pocket-chain', 'twin-pouches');
    for (const side of [-1, 1]) { const standing = tile(body, rank === 10 ? ivory : coat, [side * .095, 1.63, .025], [.052, .10, .15]); standing.rotation.z = side * .12; tile(body, brass, [side * .095, 1.65, .106], [.024, .025, .014]); }
    capePanel(1.60, 1.39, .38, -.34, coat, false);
    line(body, brass, [[.06, 1.18, .24], [.15, 1.04, .251], [.26, 1.12, .21]], .006);
    for (const side of [-1, 1]) tile(body, lining, [side * .24, .96, .075], [.13, .15, .09]);
  }
  if (rank === 10) {
    parts.push('layered-shoulder-guards', 'ivory-chest-panel', 'ceremonial-cuffs', 'greaves', 'long-tailored-drape');
    tile(body, ivory, [0, 1.41, .25], [.24, .24, .025]);
    for (const side of [-1, 1]) { tile(body, brass, [side * .13, 1.42, .272], [.012, .24, .012]); tile(body, jade, [side * .22, 1.55, .12], [.035, .035, .025]); }
    line(body, brass, [[-.06, 1.2, .24], [-.13, 1.11, .26], [-.24, 1.15, .21]], .005);
    capePanel(1.56, .35, .38, -.365, coat, true);
  }
  // Small, fitted chest crests; no clock faces, bridge trusses or dense landmark ornaments.
  if (skin === 'magnolia' || rank === 10) {
    parts.push('magnolia-pin'); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const petal = sphere(body, ivory, [-.09 + Math.sin(a) * .027, 1.49 + Math.cos(a) * .027, .287], [.014, .025, .008]); petal.rotation.z = -a; }
    sphere(body, brass, [-.09, 1.49, .30], [.012, .012, .008]);
  } else if (skin === 'wutong-warden') {
    parts.push('wutong-leaf-pin'); const leaf = new THREE.Shape();
    const outline = [[0,.038],[-.012,.020],[-.029,.029],[-.024,.009],[-.039,.003],[-.020,-.010],[-.014,-.030],[0,-.021],[.014,-.030],[.020,-.010],[.039,.003],[.024,.009],[.029,.029],[.012,.020]];
    outline.forEach(([x,y],i)=>i ? leaf.lineTo(x,y) : leaf.moveTo(x,y)); leaf.closePath();
    mesh(body,new THREE.ExtrudeGeometry(leaf,{depth:.006,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:1,steps:1}),brass,[-.09,1.48,.27]);
    line(body,dark,[[-.09,1.447,.28],[-.09,1.51,.28]],.002);
  } else if (skin === 'riverside-sentinel') {
    parts.push('river-crest'); tile(body,brass,[-.09,1.48,.27],[.073,.057,.014]);
    for(const dy of[-.012,.012]) line(body,jade,[[-.118,1.48+dy,.280],[-.103,1.489+dy,.280],[-.085,1.475+dy,.280],[-.062,1.483+dy,.280]],.0025);
  } else { const pin = tile(body, brass, [-.09, 1.48, .27], [.038, .045, .016]); pin.rotation.z = Math.PI / 4; }
  batch(head, true, [pony]); batch(body);
  // The grip and both hands use the same two-link solver, including heavy attacks.
  const weaponRoot = new THREE.Group(); weaponRoot.name = 'weaponGrip'; body.add(weaponRoot);
  const weapons = createWeapons(weaponRoot, dark, leather, brass, jade, skin); 
  const down = v(0, -1, 0), direction = new THREE.Vector3(), elbow = new THREE.Vector3(), target = new THREE.Vector3();
  const solveArm = (index: number, point: THREE.Vector3) => {
    const arm = arms[index], a = .28, b = .30;
    direction.subVectors(point, arm.shoulder); const d = THREE.MathUtils.clamp(direction.length(), .08, a + b - .008); direction.normalize();
    const along = (a * a - b * b + d * d) / (2 * d), height = Math.sqrt(Math.max(0, a * a - along * along));
    const bend = v(index ? .8 : -.8, -.2, -.65).addScaledVector(direction, -v(index ? .8 : -.8, -.2, -.65).dot(direction)).normalize();
    elbow.copy(arm.shoulder).addScaledVector(direction, along).addScaledVector(bend, height);
    target.copy(arm.shoulder).addScaledVector(direction, d);
    arm.upper.quaternion.setFromUnitVectors(down, elbow.clone().sub(arm.shoulder).normalize()); arm.lower.position.copy(elbow); arm.lower.quaternion.setFromUnitVectors(down, target.clone().sub(elbow).normalize());
    return target.clone();
  };
  const used = new Set<THREE.Material>(); root.traverse(o => { if (o instanceof THREE.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => used.add(m)); });
  [coat, dark, lining, ivory, leather, brass, skinMat, hair, hairLight, ink, white, iris, jade].forEach(m => { if (!used.has(m)) m.dispose(); });
  const floorBounds = new THREE.Box3(), pieceBounds = new THREE.Box3();
  const collectFloorBounds = (object: THREE.Object3D) => {
    if (object === weaponRoot || !object.visible) return;
    if (object instanceof THREE.Mesh) { if (!object.geometry.boundingBox) object.geometry.computeBoundingBox(); pieceBounds.copy(object.geometry.boundingBox!).applyMatrix4(object.matrixWorld); floorBounds.union(pieceBounds); }
    object.children.forEach(collectFloorBounds);
  };
  root.scale.setScalar(1.04);
  return {
    root,
    update(sim: Simulation, t: number, dt: number, recovery?: { death: number; rise: number; reducedMotion: boolean }) {
      const p = sim.player, reduced = recovery?.reducedMotion ?? false;
      root.position.x = p.x; root.position.z = p.z; root.rotation.y = p.facing;
      body.position.set(0, p.moving ? Math.abs(Math.sin(t * 8)) * .025 : 0, 0); body.rotation.set(p.sprinting ? .12 : 0, 0, 0);
      const stride = p.moving ? .48 : 0, rate = p.sprinting ? 12 : 8;
      legs.forEach((l, i) => { const swing = Math.sin(t * rate + i * Math.PI); l.upper.rotation.set(swing * stride, 0, 0); l.lower.rotation.x = Math.max(0, -swing) * stride * .8; });
      const dodge = p.dodgeTime > 0 ? dodgePose(p.dodgeTime, p.dodgeSide, p.dodgeDuration) : null;
      if (dodge) { body.rotation.set(dodge.lean, 0, dodge.roll); body.position.y = dodge.crouch; legs.forEach((l, i) => { l.upper.rotation.x = dodge.stride * (i ? 1 : -1) * p.dodgeSide; l.lower.rotation.x = .25; }); }
      const pose = p.attackTime > 0 ? attackPose(p.attackWeapon, p.attackHeavy, p.combo, p.attackDuration - p.attackTime) : null;
      weaponRoot.rotation.set(pose?.rotateX ?? .12, pose?.rotateY ?? 0, pose?.rotateZ ?? -.36);
      const desired = pose ? v(pose.weaponX, pose.weaponY, pose.weaponZ) : v(.43, .98, .20);
      // A minimum forward clearance keeps a sweeping hand/shaft outside the chest volume.
      if (pose) desired.z = Math.max(.28, desired.z);
      if (pose && p.attackHeavy) {
        const offset = v(0, -.11, 0).applyEuler(weaponRoot.rotation), correction = new THREE.Vector3();
        // Project into the intersection of both arms' reach, accounting for the second grip.
        for (let i = 0; i < 8; i++) {
          correction.subVectors(desired, arms[1].shoulder).clampLength(0, .565); desired.copy(arms[1].shoulder).add(correction);
          correction.copy(desired).add(offset).sub(arms[0].shoulder).clampLength(0, .565); desired.copy(arms[0].shoulder).add(correction).sub(offset);
        }
      }
      weaponRoot.position.copy(solveArm(1, desired));
      const left = pose && p.attackHeavy ? v(0, -.11, 0).applyEuler(weaponRoot.rotation).add(weaponRoot.position) : v(-.38, 1.00, p.moving ? Math.sin(t * rate) * .1 : .12);
      solveArm(0, left);
      if (pose) { body.rotation.set(pose.bodyX, pose.bodyY * .65, pose.bodyZ); body.position.y += pose.crouch; }
      if (sim.dead || (recovery && recovery.rise < RECOVERY.riseSeconds)) {
        const fallen = recoveryPose(sim.dead, recovery?.death ?? RECOVERY.deathSeconds, recovery?.rise ?? RECOVERY.riseSeconds, reduced);
        body.position.set(fallen.x, fallen.y, 0); body.rotation.set(fallen.leanX, 0, fallen.leanZ);
        legs.forEach((l, i) => { l.upper.rotation.x = fallen.bend * (i ? -.55 : 1); l.lower.rotation.x = fallen.bend * .5; });
        weaponRoot.position.copy(solveArm(1, v(sim.dead ? .22 : .40, 1.00, .24))); solveArm(0, v(-.37, 1.00, .21)); weaponRoot.rotation.set(sim.dead ? -fallen.leanX : -.3, 0, sim.dead ? -Math.PI / 2 - fallen.leanZ + .12 : -.75);
      }
      weapons.models.forEach((model, id) => { model.visible = id === sim.progress.weapon; });
      weapons.canopy.scale.set(1 + (pose?.canopy ?? 0) * 2.7, 1 - (pose?.canopy ?? 0) * .58, 1 + (pose?.canopy ?? 0) * 2.7);
      capes.forEach((cape, i) => { cape.rotation.x = reduced ? 0 : (p.moving ? -.035 : 0) + Math.sin(t * 3 + i) * .008; cape.position.z = cape.userData.longDrape ? p.moving || dodge ? -.10 : pose ? -.08 : 0 : 0; });
      pony.rotation.set(reduced ? 0 : Math.sin(t * 2.6) * .012, reduced ? 0 : Math.sin(t * 2.1) * .022, 0);
      root.updateMatrixWorld(true);
      // Floor is relative to the current terrain, including bridges. Ignore the weapon's swept
      // bounds so a downward swing cannot lift the entire character off the ground.
      floorBounds.makeEmpty(); collectFloorBounds(body);
      const plane = root.position.y + .012;
      if (floorBounds.min.y < plane) body.position.y += (plane - floorBounds.min.y) / root.scale.y;
      void dt;
    },
  };
}

function createWeapons(root: THREE.Group, dark: THREE.Material, leather: THREE.Material, brass: THREE.Material, jade: THREE.Material, skin: Skin) {
  const steel = mat('#aebdca', .27, .78), models = new Map<Weapon, THREE.Group>();
  for (const id of ['crowbar', 'baton', 'umbrella'] as Weapon[]) { const group = new THREE.Group(); group.name = id; models.set(id, group); root.add(group); }
  const tactical = models.get('crowbar')!, baton = models.get('baton')!, umbrella = models.get('umbrella')!;
  tile(tactical, dark, [0, .57, 0], [.075, 1.12, .075]); tile(tactical, leather, [0, .10, 0], [.105, .28, .105]);
  for (const y of [.02, .36, 1.16]) tile(tactical, steel, [0, y, 0], [.09, .07, .09]);
  for (let i = 0; i < 4; i++) tile(tactical, brass, [0, .02 + i * .061, 0], [.11, .012, .11]);
  tile(baton, leather, [0, .08, 0], [.11, .30, .11]);
  for (const [y, h, w] of [[.51, .65, .065], [.96, .34, .043], [1.16, .06, .07]]) tile(baton, steel, [0, y, 0], [w, h, w]);
  tile(baton, jade, [0, .27, 0], [.09, .025, .09]);
  tile(umbrella, steel, [0, .55, 0], [.035, 1.38, .035]);
  const canopy = mesh(umbrella, new THREE.ConeGeometry(.18, .78, 10, 2), mat(skin === 'magnolia' ? '#813d50' : '#30365b'), [0, .83, 0], 'umbrellaCanopy');
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(umbrella, brass, [[0, 1.22, 0], [Math.cos(a) * .13, .82, Math.sin(a) * .13], [Math.cos(a) * .18, .44, Math.sin(a) * .18]], .004); }
  const handle = mesh(umbrella, new THREE.TorusGeometry(.10, .023, 6, 14, Math.PI * 1.35), leather, [.08, -.15, 0]); handle.rotation.z = -.35;
  // Leave the animated canopy outside rigid batches.
  umbrella.remove(canopy); [tactical, baton, umbrella].forEach(group => batch(group)); umbrella.add(canopy);
  return { models, canopy };
}
