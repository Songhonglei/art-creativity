import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ellipsoid, box, taperedTube, batchRigidParts, canvasTexture } from './materials';
import type { Materials } from './materials';
import type { Pet, MonsterKind, Skin, Weapon } from './types';
import type { Simulation } from './simulation';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const standard = (color: string, roughness = .82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

interface MonsterModel { root: THREE.Group; update(sim: Simulation, t: number, dt: number, target?: Simulation['monster']): void }

function panel(parent: THREE.Object3D, material: THREE.Material, pos: number[], size: number[], radius = .035) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius), material);
  mesh.position.set(pos[0], pos[1], pos[2]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function capsule(parent: THREE.Object3D, material: THREE.Material, pos: number[], radius: number, length: number) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material);
  mesh.position.set(pos[0], pos[1], pos[2]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function quadruped(m: Materials, color: string, opts: { ears: 'cat' | 'dog'; tail: 'cat' | 'dog'; size: number; mask?: boolean; belly?: string; stripe?: string }): MonsterModel {
  const fur = standard(color, .96), bellyMat = standard(opts.belly ?? '#c6b9a4', .98);
  const stripeMat = standard(opts.stripe ?? color, .98), pink = standard('#d89591', .9), noseMat = standard('#24232a', .42);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // Three overlapping volumes give a chest, ribcage and hindquarters instead of one pill.
  ellipsoid(body, fur, [0, .73, -.13], [.34, .32, .59]);
  ellipsoid(body, fur, [0, .78, .35], [.32, .37, .34]);
  ellipsoid(body, fur, [0, .72, -.54], [.37, .36, .3]);
  ellipsoid(body, bellyMat, [0, .56, .23], [.25, .22, .39]);
  ellipsoid(body, fur, [0, .91, .52], [.2, .27, .22]);
  if (opts.stripe) for (let i = 0; i < 4; i++) ellipsoid(body, stripeMat, [0, .98 - Math.abs(i - 1.5) * .035, .3 - i * .24], [.25, .035, .07]);
  const head = new THREE.Group(); head.position.set(0, 1.02, .68); body.add(head);
  ellipsoid(head, fur, [0, 0, 0], [.23, .22, .21]);
  ellipsoid(head, bellyMat, [0, -.09, .13], [.16, .11, .13]);
  ellipsoid(head, bellyMat, [-.095, -.055, .17], [.09, .085, .09]);
  ellipsoid(head, bellyMat, [.095, -.055, .17], [.09, .085, .09]);
  ellipsoid(head, noseMat, [0, -.025, .245], [.042, .03, .028]);
  for (const side of [-1, 1]) {
    ellipsoid(head, m.eye, [side * .105, .045, .183], [.042, .047, .032]);
    ellipsoid(head, standard('#f6e6b0', .25), [side * .098, .057, .209], [.011, .013, .008]);
    if (opts.ears === 'cat') {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.09, .21, 4), fur); ear.position.set(side * .13, .22, -.01); ear.rotation.z = side * -.12; head.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(.048, .12, 4), pink); inner.position.set(side * .13, .215, .025); inner.rotation.z = side * -.12; head.add(inner);
    } else {
      const ear = ellipsoid(head, stripeMat, [side * .2, .015, -.015], [.075, .19, .07]); ear.rotation.z = side * .35;
    }
  }
  if (opts.mask) ellipsoid(head, noseMat, [0, .045, .115], [.21, .12, .13]);
  const legs: THREE.Group[] = [];
  for (const sx of [-.24, .24]) for (const sz of [-.43, .36]) {
    const leg = new THREE.Group(); leg.position.set(sx, .61, sz); body.add(leg); legs.push(leg);
    capsule(leg, fur, [0, -.18, 0], .075, .24);
    capsule(leg, fur, [0, -.43, .025], .055, .22);
    ellipsoid(leg, bellyMat, [0, -.58, .065], [.085, .06, .12]);
  }
  const tail = new THREE.Group(); tail.position.set(0, .85, -.68); body.add(tail);
  tail.add(taperedTube(opts.tail === 'cat' ? [v(0, 0, 0), v(.04, .28, -.25), v(.13, .58, -.28)] : [v(0, 0, 0), v(0, .22, -.28), v(.06, .4, -.36)], [.052, .036, .009], fur, 7, 12));
  batchRigidParts(body); batchRigidParts(head); legs.forEach(l => batchRigidParts(l));
  root.scale.setScalar(opts.size);
  return {
    root,
    update(sim: Simulation, t: number, dt: number, target?: Simulation['monster']) {
      const s = target ?? sim.monster; root.position.set(s.x, root.position.y, s.z); root.rotation.y = s.facing;
      const moving = s.action === 'stalk' || s.action === 'charge', rate = s.action === 'charge' ? 14 : 6;
      legs.forEach((l, j) => { l.rotation.x = moving ? Math.sin(t * rate + j * Math.PI * .5) * .52 : 0; });
      body.rotation.z = THREE.MathUtils.damp(body.rotation.z, s.action === 'dead' ? -1.35 : 0, 3, dt);
      body.position.y = s.action === 'dead' ? -.3 : Math.sin(t * 3.2) * .025;
      head.rotation.x = s.action === 'windup' ? -.35 : Math.sin(t * 1.3) * .05;
      tail.rotation.y = Math.sin(t * 4.2) * .28;
    },
  };
}

interface HumanoidOpts { jacket: string; helmet?: boolean; hood?: boolean; bat?: boolean; knife?: boolean; belly?: boolean | string; briefcase?: boolean; goldChain?: boolean; stripes?: string; cap?: boolean; tie?: boolean; faceMask?: boolean }
function humanoid(m: Materials, opts: HumanoidOpts): MonsterModel {
  const jacket = standard(opts.jacket, .88), pants = standard('#293041', .95), skin = standard('#c99372', .88);
  const shirt = standard(opts.belly ? '#ded9ca' : '#7789a0', .88), shoe = standard('#202531', .65);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.32, .25, .62, 8), jacket); torso.scale.z = .68; torso.position.set(0, 1.3, 0); torso.castShadow = true; body.add(torso);
  panel(body, shirt, [0, 1.35, .175], [.24, .43, .07]);
  for (const side of [-1, 1]) { const lapel = panel(body, jacket, [side * .13, 1.43, .22], [.14, .35, .055]); lapel.rotation.z = side * .16; }
  if (opts.belly) ellipsoid(body, standard(typeof opts.belly === 'string' ? opts.belly : '#ded9ca', .86), [0, 1.16, .11], [.28, .25, .17]);
  if (opts.tie) { const tie = panel(body, standard('#a63b46', .58), [0, 1.29, .225], [.065, .32, .035], .015); tie.rotation.x = .06; }
  if (opts.stripes) for (const side of [-1, 1]) panel(body, new THREE.MeshBasicMaterial({ color: opts.stripes }), [side * .22, 1.36, .14], [.035, .45, .04], .01);
  panel(body, standard('#3a2d2b', .85), [0, .98, .01], [.53, .1, .35]);
  const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .16, .96, 0); body.add(leg);
    capsule(leg, pants, [0, -.22, 0], .12, .3); capsule(leg, pants, [0, -.56, .015], .095, .28);
    panel(leg, shoe, [0, -.83, .085], [.22, .16, .36], .055);
    leg.name = side < 0 ? 'leftLeg' : 'rightLeg'; legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(side * .35, 1.52, 0); body.add(arm);
    capsule(arm, jacket, [side * .015, -.16, 0], .105, .22);
    capsule(arm, jacket, [side * .025, -.42, .035], .085, .22);
    ellipsoid(arm, skin, [side * .025, -.61, .055], [.085, .1, .075]);
    arm.name = side < 0 ? 'leftArm' : 'rightArm'; arms.push(arm);
  }
  capsule(body, skin, [0, 1.68, 0], .075, .08);
  ellipsoid(body, skin, [0, 1.85, .025], [.145, .18, .14]);
  ellipsoid(body, standard('#27232a', .95), [0, 1.96, -.015], [.15, .1, .145]);
  ellipsoid(body, skin, [0, 1.84, .16], [.035, .05, .035]);
  for (const side of [-1, 1]) { ellipsoid(body, m.dark, [side * .058, 1.89, .151], [.018, .014, .012]); const brow = box(body, m.dark, [side * .058, 1.925, .15], [.055, .012, .015]); brow.rotation.z = side * -.12; }
  if (opts.faceMask) panel(body, standard('#19202c', .9), [0, 1.79, .12], [.24, .12, .09]);
  if (opts.helmet) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * .63), standard('#c93f54', .32, .35)); helm.position.set(0, 1.91, 0); body.add(helm);
    panel(body, standard('#152235', .18, .25), [0, 1.86, .17], [.25, .09, .045]);
    panel(body, new THREE.MeshBasicMaterial({ color: '#4fe4e8' }), [0, 2.015, .02], [.045, .11, .22], .015);
  } else if (opts.cap) {
    ellipsoid(body, standard('#773a4d', .85), [0, 1.985, -.005], [.16, .085, .15]);
    panel(body, standard('#773a4d', .85), [0, 1.94, .2], [.25, .035, .17], .015);
  } else if (opts.hood) {
    ellipsoid(body, jacket, [0, 1.89, -.085], [.21, .25, .16]);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.18, .035, 7, 18, Math.PI * 1.45), jacket); rim.position.set(0, 1.86, .04); rim.rotation.z = -.68; body.add(rim);
  }
  if (opts.goldChain) { const chain = new THREE.Mesh(new THREE.TorusGeometry(.13, .018, 6, 16, Math.PI * 1.35), m.gold); chain.position.set(0, 1.54, .15); chain.rotation.set(1.22, 0, -.55); body.add(chain); }
  if (opts.bat) { const bat = new THREE.Group(); bat.position.set(.04, -.59, .09); bat.rotation.set(.8, 0, -.35); arms[1].add(bat); capsule(bat, standard('#8b5b36', .72), [0, .27, 0], .055, .56); }
  if (opts.knife) { const knife = panel(arms[1], m.metal, [.02, -.7, .18], [.045, .32, .055], .012); knife.rotation.x = .5; }
  if (opts.briefcase) { panel(body, standard('#573b30', .72), [.48, .68, .03], [.34, .43, .13], .04); const handle = new THREE.Mesh(new THREE.TorusGeometry(.08, .018, 6, 12, Math.PI), m.gold); handle.position.set(.48, .93, .03); body.add(handle); }
  batchRigidParts(body); legs.forEach(j => batchRigidParts(j)); arms.forEach(j => batchRigidParts(j));
  return {
    root,
    update(sim: Simulation, t: number, dt: number, target?: Simulation['monster']) {
      const s = target ?? sim.monster; root.position.set(s.x, root.position.y, s.z); root.rotation.y = s.facing;
      const moving = s.action === 'stalk' || s.action === 'charge', rate = s.action === 'charge' ? 11 : 5.4, stride = moving ? .52 : 0;
      legs.forEach((leg, i) => { leg.rotation.x = Math.sin(t * rate + i * Math.PI) * stride; });
      arms.forEach((arm, i) => { arm.rotation.x = moving ? Math.sin(t * rate + i * Math.PI + Math.PI) * stride * .6 : Math.sin(t * 1.2 + i) * .035; });
      body.position.y = Math.abs(Math.sin(t * rate)) * (moving ? .045 : .006);
      body.rotation.z = THREE.MathUtils.damp(body.rotation.z, s.action === 'dead' ? 1.45 : 0, 3, dt);
      body.rotation.x = s.action === 'windup' ? -.22 : 0;
    },
  };
}

function ebike(m: Materials, neon?: string): MonsterModel {
  const frame = standard('#347b8c', .38, .5), rubber = standard('#181d28', .82), chrome = standard('#a9b6c6', .25, .8);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const wheelGeo = new THREE.TorusGeometry(.4, .075, 8, 20), wheels: THREE.Mesh[] = [];
  for (const z of [-.72, .72]) {
    const w = new THREE.Mesh(wheelGeo, rubber); w.position.set(0, .4, z); body.add(w); wheels.push(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .07, 12), chrome); hub.rotation.z = Math.PI / 2; hub.position.set(0, .4, z); body.add(hub);
    for (let i = 0; i < 5; i++) { const spoke = box(body, m.darkMetal, [0, .4, z], [.025, .48, .025]); spoke.rotation.x = i * Math.PI / 5; }
  }
  body.add(taperedTube([v(0, .48, -.66), v(0, .75, -.15), v(0, .92, .5)], [.075, .09, .06], frame, 8, 10));
  body.add(taperedTube([v(0, .52, .68), v(0, 1.15, .42)], [.055, .045], frame, 8, 4));
  panel(body, standard('#263447', .75), [0, .93, -.45], [.44, .16, .62], .07);
  panel(body, standard('#d6a83c', .72), [0, 1.13, -.9], [.55, .54, .48], .055);
  panel(body, standard('#fff0bf', .55), [0, 1.14, -1.15], [.38, .09, .025], .01);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .65, 8), chrome); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.19, .43); body.add(bar);
  for (const side of [-1, 1]) { panel(body, rubber, [side * .32, 1.19, .43], [.14, .07, .08]); const mirror = ellipsoid(body, chrome, [side * .28, 1.43, .4], [.07, .05, .025]); void mirror; box(body, chrome, [side * .26, 1.32, .4], [.018, .22, .018]); }
  const headlight = panel(body, new THREE.MeshBasicMaterial({ color: '#fff1ba' }), [0, 1.02, .7], [.22, .14, .08], .04); void headlight;
  panel(body, new THREE.MeshBasicMaterial({ color: '#ff4b5f' }), [0, .85, -.92], [.2, .07, .05], .02);
  if (neon) { const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), new THREE.MeshBasicMaterial({ color: neon, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = .05; body.add(glow); }
  batchRigidParts(body);
  return {
    root,
    update(sim: Simulation, _t: number, dt: number, target?: Simulation['monster']) {
      const s = target ?? sim.monster; root.position.set(s.x, root.position.y, s.z); root.rotation.y = s.facing;
      const moving = s.action === 'stalk' || s.action === 'charge'; wheels.forEach(w => { w.rotation.x += (moving ? (s.action === 'charge' ? 22 : 8) : 0) * dt; });
      body.rotation.z = THREE.MathUtils.damp(body.rotation.z, s.action === 'dead' ? 1.2 : 0, 3, dt);
      body.rotation.x = s.action === 'windup' ? -.16 : 0; body.position.y = s.action === 'dead' ? -.2 : 0;
    },
  };
}

function scooterRacer(m: Materials): MonsterModel {
  const model = humanoid(m, { jacket: '#344d68', helmet: true, stripes: '#43e1df' });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), new THREE.MeshBasicMaterial({ color: '#37e0ff', transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false })); neon.rotation.x = -Math.PI / 2; neon.position.y = .04; model.root.add(neon);
  panel(model.root, standard('#28354a', .45, .4), [0, .18, .2], [.34, .1, .95], .04);
  for (const z of [-.35, .75]) { const wheel = new THREE.Mesh(new THREE.TorusGeometry(.16, .045, 7, 14), m.dark); wheel.position.set(0, .16, z); model.root.add(wheel); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .72, 7), m.metal); pole.position.set(0, .52, .68); pole.rotation.x = -.3; model.root.add(pole);
  return model;
}

export function createMonster(kind: MonsterKind, m: Materials): MonsterModel {
  switch (kind) {
    case 'cat': return quadruped(m, '#596274', { ears: 'cat', tail: 'cat', size: 1.02, belly: '#c1c0bd', stripe: '#363c4c' });
    case 'dog': return quadruped(m, '#80654d', { ears: 'dog', tail: 'dog', size: 1.18, mask: true, belly: '#c5ac8c', stripe: '#554338' });
    case 'ebike': return ebike(m);
    case 'racer': return scooterRacer(m);
    case 'hooligan': return humanoid(m, { jacket: '#83465b', cap: true, bat: true, belly: '#ded9ca', goldChain: true });
    case 'robber': return humanoid(m, { jacket: '#34453f', hood: true, knife: true, faceMask: true });
    case 'official': return humanoid(m, { jacket: '#3b4d6c', belly: true, tie: true, briefcase: true, goldChain: true });
  }
}

const HUNTER_PALETTES = {
  nightwatch: { coat: '#28475f', dark: '#1d3247', lining: '#3f8d91', ivory: '#d9d5c5', leather: '#744b35', accent: '#bd8d4e', glow: '#73d9d4', cape: '#315875' },
  magnolia: { coat: '#d8d2bd', dark: '#878b87', lining: '#8f3648', ivory: '#f3ead7', leather: '#673d42', accent: '#d2ac59', glow: '#f0c979', cape: '#c9c3ae' },
  neon: { coat: '#29263e', dark: '#151a29', lining: '#784dba', ivory: '#abb4c9', leather: '#262336', accent: '#596b91', glow: '#3fe2dc', cape: '#27233d' },
} as const;

function capeTexture(skin: Skin) {
  const palette = HUNTER_PALETTES[skin];
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = palette.cape; ctx.fillRect(0, 0, s, s);
    const gradient = ctx.createLinearGradient(0, 0, s, 0); gradient.addColorStop(0, 'rgba(8,14,28,.42)'); gradient.addColorStop(.5, 'rgba(255,255,255,.08)'); gradient.addColorStop(1, 'rgba(8,14,28,.42)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = palette.glow; ctx.lineWidth = skin === 'magnolia' ? 5 : 9; ctx.strokeRect(13, 13, s - 26, s - 26);
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 3; ctx.strokeRect(27, 27, s - 54, s - 54);
    ctx.save(); ctx.translate(s / 2, s * .42);
    if (skin === 'magnolia') {
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * Math.PI * 2 / 5); ctx.fillStyle = i % 2 ? palette.ivory : palette.glow; ctx.beginPath(); ctx.ellipse(0, -31, 17, 35, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = palette.lining; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    } else if (skin === 'neon') {
      ctx.strokeStyle = palette.glow; ctx.lineWidth = 8; for (const offset of [-30, 0, 30]) { ctx.beginPath(); ctx.moveTo(offset - 28, 45); ctx.lineTo(offset + 28, -45); ctx.stroke(); }
      ctx.strokeStyle = palette.lining; ctx.lineWidth = 3; ctx.strokeRect(-54, -54, 108, 108);
    } else {
      ctx.rotate(Math.PI / 4); ctx.fillStyle = '#17354d'; ctx.fillRect(-47, -47, 94, 94); ctx.strokeStyle = palette.accent; ctx.lineWidth = 6; ctx.strokeRect(-47, -47, 94, 94); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = palette.glow; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(23, 0); ctx.lineTo(0, 26); ctx.lineTo(-23, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (let y = 0; y < s; y += 3) { ctx.fillStyle = y % 6 ? 'rgba(255,255,255,.018)' : 'rgba(0,0,0,.035)'; ctx.fillRect(0, y, s, 1); }
  }, 256);
}

export function createHunter(m: Materials, skin: Skin = 'nightwatch') {
  const palette = HUNTER_PALETTES[skin];
  const root = new THREE.Group(), body = new THREE.Group(); root.name = `hunter:${skin}`; root.add(body);
  const coat = standard(palette.coat, .82), coatDark = standard(palette.dark, .9), lining = standard(palette.lining, .8);
  const ivory = standard(palette.ivory, .78), leather = standard(palette.leather, .76), bronze = standard(palette.accent, .34, .62);
  const glow = new THREE.MeshStandardMaterial({ color: palette.glow, emissive: palette.glow, emissiveIntensity: skin === 'neon' ? 1.15 : .5, roughness: .45 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.32, .245, .64, 10), coat); torso.scale.z = .7; torso.position.set(0, 1.31, 0); torso.castShadow = true; body.add(torso);
  panel(body, ivory, [0, 1.42, .17], [.25, .38, .08]);
  panel(body, coatDark, [0, 1.36, .225], [.36, .34, .07]);
  for (const side of [-1, 1]) {
    const lapel = panel(body, lining, [side * .13, 1.48, .255], [.12, .35, .045]); lapel.rotation.z = side * .22;
    panel(body, bronze, [side * .19, 1.27, .26], [.035, .035, .025], .01);
  }
  panel(body, glow, [0, 1.43, .275], [.065, .065, .025], .018).rotation.z = Math.PI / 4;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(.145, .047, 8, 20), ivory); scarf.position.set(0, 1.67, .01); scarf.rotation.x = Math.PI / 2; body.add(scarf);
  body.add(taperedTube([v(-.11, 1.65, -.12), v(-.2, 1.42, -.25), v(-.16, 1.18, -.28)], [.045, .035, .008], lining, 7, 10));
  panel(body, leather, [0, .99, .01], [.54, .105, .36]);
  panel(body, bronze, [0, .99, .21], [.12, .1, .045], .018);
  for (const side of [-1, 1]) panel(body, leather, [side * .25, .94, .12], [.14, .18, .12], .03);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .155, .96, 0); body.add(leg);
    capsule(leg, coatDark, [0, -.21, 0], .115, .3);
    panel(leg, leather, [0, -.48, .02], [.2, .16, .19], .04);
    capsule(leg, coat, [0, -.61, .015], .09, .25);
    panel(leg, coatDark, [0, -.84, .09], [.22, .18, .37], .055);
    panel(leg, glow, [0, -.915, .11], [.19, .022, .29], .008);
    leg.name = side < 0 ? 'leftLeg' : 'rightLeg';
    const arm = new THREE.Group(); arm.position.set(side * .345, 1.54, 0); body.add(arm);
    capsule(arm, coat, [side * .015, -.15, 0], .1, .22);
    panel(arm, coatDark, [side * .02, -.005, 0], [.22, .13, .25], .055);
    panel(arm, bronze, [side * .02, .055, 0], [.19, .025, .22], .01);
    capsule(arm, lining, [side * .02, -.4, .025], .08, .22);
    panel(arm, leather, [side * .02, -.43, .09], [.15, .18, .075], .025);
    ellipsoid(arm, coatDark, [side * .02, -.59, .055], [.085, .095, .075]);
    arm.name = side < 0 ? 'leftArm' : 'rightArm'; arm.rotation.z = side * .06;
  }
  capsule(body, m.face, [0, 1.71, 0], .07, .07);
  ellipsoid(body, m.face, [0, 1.88, .025], [.14, .175, .135]);
  ellipsoid(body, standard('#1b2532', .88), [0, 1.99, -.005], [.145, .085, .135]);
  ellipsoid(body, standard('#1b2532', .9), [0, 1.88, -.105], [.14, .15, .07]);
  for (const side of [-1, 1]) ellipsoid(body, m.eye, [side * .052, 1.91, .15], [.018, .013, .01]);
  panel(body, lining, [0, 1.805, .125], [.22, .105, .075], .025);
  ellipsoid(body, m.face, [0, 1.86, .158], [.03, .045, .028]);
  // A small folded hood behind the neck, not a sphere enclosing the whole head.
  ellipsoid(body, coatDark, [0, 1.74, -.15], [.22, .15, .13]);
  const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(.19, .028, 7, 18, Math.PI * 1.2), lining); hoodRim.position.set(0, 1.77, -.13); hoodRim.rotation.set(1.25, 0, -.62); body.add(hoodRim);
  if (skin === 'magnolia') {
    for (const side of [-1, 1]) {
      const shoulder = panel(body, ivory, [side * .35, 1.54, -.015], [.3, .13, .32], .045); shoulder.rotation.z = side * -.14;
      panel(body, bronze, [side * .35, 1.59, .04], [.25, .035, .24], .01);
      panel(body, coat, [side * .19, .76, -.045], [.25, .52, .22], .035);
    }
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal / 5 * Math.PI * 2;
      const flower = ellipsoid(body, ivory, [Math.sin(angle) * .055, 1.43 + Math.cos(angle) * .055, .292], [.035, .055, .018]); flower.rotation.z = -angle;
    }
    ellipsoid(body, bronze, [0, 1.43, .314], [.025, .025, .015]);
    body.add(taperedTube([v(.24, 1.01, .19), v(.3, .82, .23), v(.27, .63, .2)], [.022, .018, .008], lining, 6, 8));
  } else if (skin === 'neon') {
    panel(body, glow, [0, 1.9, .164], [.27, .055, .035], .014);
    for (const side of [-1, 1]) {
      const shoulder = panel(body, coatDark, [side * .36, 1.54, -.01], [.29, .16, .3], .025); shoulder.rotation.z = side * -.2;
      panel(body, glow, [side * .36, 1.59, .09], [.22, .025, .1], .008);
      panel(body, glow, [side * .17, .48, .12], [.025, .55, .025], .006);
    }
    panel(body, lining, [0, 1.06, .22], [.48, .055, .045], .01);
  }
  const capeHeight = skin === 'neon' ? .72 : 1.06, capeWidth = skin === 'magnolia' ? 1.02 : skin === 'neon' ? .82 : .91;
  const capeGeometry = new THREE.PlaneGeometry(capeWidth, capeHeight, 12, 16), capePos = capeGeometry.attributes.position;
  for (let i = 0; i < capePos.count; i++) {
    const x = capePos.getX(i), y = capePos.getY(i), f = (capeHeight / 2 - y) / capeHeight;
    capePos.setXYZ(i, x * (.72 + f * .48), y, Math.cos(x * 12) * .025 - f * f * .13);
  }
  const cape = new THREE.Mesh(capeGeometry, new THREE.MeshStandardMaterial({ map: capeTexture(skin), roughness: .88, side: THREE.DoubleSide })); cape.position.set(0, skin === 'neon' ? 1.22 : 1.06, -.245); cape.castShadow = true; body.add(cape);
  const originalCape = Float32Array.from(capePos.array);
  const weaponRoot = new THREE.Group(); weaponRoot.position.set(.24, 1.12, -.39); weaponRoot.rotation.z = -.43; body.add(weaponRoot);
  const weaponModels = new Map<Weapon, THREE.Group>();
  const tactical = new THREE.Group(); weaponRoot.add(tactical); weaponModels.set('crowbar', tactical);
  const carbon = standard('#202b36', .42, .5), steel = standard('#aebdca', .25, .78);
  panel(tactical, carbon, [0, .57, 0], [.082, 1.12, .082], .018);
  panel(tactical, steel, [0, 1.15, 0], [.105, .13, .105], .016);
  panel(tactical, steel, [0, .02, 0], [.1, .09, .1], .014);
  panel(tactical, leather, [0, .16, 0], [.115, .34, .115], .025);
  for (let i = 0; i < 5; i++) panel(tactical, bronze, [0, .035 + i * .064, 0], [.12, .014, .12], .004);
  panel(tactical, glow, [0, .39, 0], [.1, .035, .1], .008);
  const baton = new THREE.Group(); weaponRoot.add(baton); weaponModels.set('baton', baton);
  panel(baton, leather, [0, .08, 0], [.12, .34, .12], .025);
  panel(baton, steel, [0, .52, 0], [.073, .64, .073], .012);
  panel(baton, m.metal, [0, .96, 0], [.048, .36, .048], .009);
  panel(baton, steel, [0, 1.17, 0], [.075, .075, .075], .015);
  for (let i = 0; i < 4; i++) panel(baton, coatDark, [0, -.03 + i * .07, 0], [.126, .018, .126], .004);
  const batonRing = new THREE.Mesh(new THREE.TorusGeometry(.074, .014, 6, 12), glow); batonRing.rotation.x = Math.PI / 2; batonRing.position.y = .28; baton.add(batonRing);
  const umbrella = new THREE.Group(); weaponRoot.add(umbrella); weaponModels.set('umbrella', umbrella);
  panel(umbrella, steel, [0, .55, 0], [.045, 1.38, .045], .009);
  const umbrellaFabric = standard(skin === 'magnolia' ? '#813d50' : '#30365b', .72, .08);
  const umbrellaCanopy = new THREE.Mesh(new THREE.ConeGeometry(.2, .8, 8, 2), umbrellaFabric); umbrellaCanopy.position.y = .83; umbrellaCanopy.castShadow = true; umbrella.add(umbrellaCanopy);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    umbrella.add(taperedTube([v(0, 1.24, 0), v(Math.cos(angle) * .14, .82, Math.sin(angle) * .14), v(Math.cos(angle) * .19, .43, Math.sin(angle) * .19)], [.008, .012, .007], i % 2 ? bronze : glow, 5, 5));
  }
  const umbrellaTip = new THREE.Mesh(new THREE.ConeGeometry(.035, .18, 8), steel); umbrellaTip.position.y = 1.32; umbrella.add(umbrellaTip);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.12, .028, 7, 16, Math.PI * 1.35), leather); handle.position.set(.095, -.17, 0); handle.rotation.z = -.35; umbrella.add(handle);
  panel(umbrella, glow, [0, .39, 0], [.09, .045, .09], .01);
  const strap = panel(body, leather, [0, 1.36, -.21], [.075, .68, .045]); strap.rotation.z = -.6;
  [tactical, baton, umbrella].forEach(model => batchRigidParts(model));
  // Local warm/cool fill keeps the character readable without flattening the night scene.
  const warm = new THREE.PointLight('#ffc58f', 9, 5.5, 2); warm.position.set(1.2, 2.6, 1.8); root.add(warm);
  const rim = new THREE.PointLight(palette.glow, 7, 4.5, 2); rim.position.set(-1, 1.9, -1.2); root.add(rim);
  root.scale.setScalar(1.04);
  const legs = [body.getObjectByName('leftLeg')!, body.getObjectByName('rightLeg')!], arms = [body.getObjectByName('leftArm')!, body.getObjectByName('rightArm')!];
  batchRigidParts(body, [cape]); [...legs, ...arms].forEach(joint => batchRigidParts(joint as THREE.Group));
  return {
    root,
    update(sim: Simulation, t: number, dt: number) {
      const p = sim.player; root.position.x = p.x; root.position.z = p.z; root.rotation.y = p.facing;
      const speed = p.sprinting ? 12 : 8, stride = p.moving ? .57 : 0;
      legs.forEach((leg, i) => { leg.rotation.x = Math.sin(t * speed + i * Math.PI) * stride; });
      arms.forEach((arm, i) => { arm.rotation.x = Math.sin(t * speed + i * Math.PI + Math.PI) * stride * .65; });
      body.position.y = p.moving ? Math.abs(Math.sin(t * speed)) * .04 : Math.sin(t * 2) * .006;
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, p.dodgeTime > 0 ? -Math.sin((.44 - p.dodgeTime) / .44 * Math.PI) * 1.6 : p.sprinting ? .15 : 0, 15, dt);
      body.rotation.z = sim.dead ? 1.4 : 0;
      if (p.attackTime > 0) {
        weaponRoot.position.set(.36, 1.24, .05); weaponRoot.rotation.set(Math.sin(p.attackTime * 8) * 1.4, Math.sin(p.attackTime * 9) * 1.9, -1.25);
        arms[1].rotation.x = -1.6; body.rotation.y = Math.sin(p.attackTime * 9) * .6;
      } else { weaponRoot.position.set(.24, 1.12, -.39); weaponRoot.rotation.set(0, 0, -.43); body.rotation.y = 0; }
      weaponModels.forEach((model, weapon) => { model.visible = sim.progress.weapon === weapon; });
      const opening = sim.progress.weapon === 'umbrella' && p.attackTime > 0 ? 1 : 0;
      umbrellaCanopy.scale.set(1 + opening * 1.65, 1 - opening * .58, 1 + opening * 1.65);
      for (let i = 0; i < capePos.count; i++) {
        const y = originalCape[i * 3 + 1], x = originalCape[i * 3], f = (capeHeight / 2 - y) / capeHeight;
        capePos.setZ(i, originalCape[i * 3 + 2] + Math.sin(t * 3.6 + x * 7 + f * 4) * .05 * f - (p.moving ? f * f * .2 : 0));
      }
      capePos.needsUpdate = true; capeGeometry.computeVertexNormals();
    },
  };
}

/** Modern city pets with readable markings, collars and separate paws. */
export function createPet(pet: Pet) {
  const root = new THREE.Group(), darkEye = standard('#191b22', .2), glint = new THREE.MeshBasicMaterial({ color: '#fff8e8' });
  const nose = standard('#30272a', .38), pink = standard('#d89591', .9), cream = standard('#f0dfc2', .96);
  const isCat = pet === 'orangeCat', isCorgi = pet === 'corgi';
  const fur = standard(isCat ? '#df8b3f' : isCorgi ? '#d5a05b' : '#bd7841', .96), marking = standard(isCat ? '#a85b27' : '#f0e5cf', .96);
  const legHeight = isCorgi ? .1 : .16, bodyY = isCorgi ? .29 : .33;
  ellipsoid(root, fur, [0, bodyY, -.03], [.17, .15, .3]);
  ellipsoid(root, fur, [0, bodyY + .025, .2], [.16, .16, .16]);
  ellipsoid(root, cream, [0, bodyY - .075, .13], [.12, .09, .18]);
  ellipsoid(root, fur, [0, bodyY + .15, .31], [.125, .115, .115]);
  ellipsoid(root, cream, [0, bodyY + .1, .38], [.085, .065, .065]);
  ellipsoid(root, nose, [0, bodyY + .13, .435], [.021, .016, .014]);
  if (isCorgi) ellipsoid(root, cream, [0, bodyY + .22, .335], [.035, .09, .06]);
  if (isCat) for (let i = 0; i < 3; i++) ellipsoid(root, marking, [0, bodyY + .13, .11 - i * .14], [.11, .025, .055]);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(isCorgi ? .057 : .05, isCorgi ? .14 : .115, 4), fur); ear.position.set(side * .075, bodyY + .28, .31); ear.rotation.z = side * -.1; root.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.028, .07, 4), pink); inner.position.set(side * .075, bodyY + .275, .327); root.add(inner);
    ellipsoid(root, darkEye, [side * .052, bodyY + .17, .41], [.021, .023, .017]);
    ellipsoid(root, glint, [side * .045, bodyY + .18, .424], [.006, .007, .005]);
    for (const z of [-.16, .16]) {
      capsule(root, fur, [side * .095, legHeight + .04, z], .032, legHeight);
      ellipsoid(root, cream, [side * .095, .04, z + .025], [.04, .038, .055]);
    }
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.105, .018, 6, 14), standard('#337d83', .6)); collar.position.set(0, bodyY + .08, .24); collar.rotation.x = Math.PI / 2.7; root.add(collar);
  const tag = new THREE.Mesh(new THREE.OctahedronGeometry(.028), standard('#d2ac59', .35, .55)); tag.position.set(0, bodyY + .015, .34); root.add(tag);
  if (pet === 'shiba') {
    const tail = new THREE.Mesh(new THREE.TorusGeometry(.09, .032, 7, 16, Math.PI * 1.65), fur); tail.position.set(0, bodyY + .14, -.3); tail.rotation.set(.35, 0, 1.1); root.add(tail);
    ellipsoid(root, cream, [.075, bodyY + .19, -.31], [.037, .037, .037]);
  } else root.add(taperedTube([v(0, bodyY + .06, -.28), v(.03, bodyY + .25, -.4), v(.08, bodyY + .39, -.42)], [.032, .024, .006], isCat ? fur : cream, 6, 9));
  root.scale.setScalar(1.16); batchRigidParts(root); return root;
}
