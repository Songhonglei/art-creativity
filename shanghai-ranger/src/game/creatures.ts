import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ellipsoid, box, taperedTube, batchRigidParts, canvasTexture } from './materials';
import type { Materials } from './materials';
import type { Pet, MonsterKind, Skin, Weapon } from './types';
import type { Simulation } from './simulation';
import { attackPose, dodgePose } from './combat';
import { petSkin } from './pets';
import { createCorgiAnatomy, createShibaAnatomy } from './petModels';

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
  const root = new THREE.Group(), body = new THREE.Group(); root.name = `hunter:${skin}`; body.name = 'hunterBody'; root.add(body);
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
  const weaponRoot = new THREE.Group(); weaponRoot.name = 'weaponGrip'; weaponRoot.position.set(.24, 1.12, -.39); weaponRoot.rotation.z = -.43; body.add(weaponRoot);
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
  const umbrellaCanopy = new THREE.Mesh(new THREE.ConeGeometry(.2, .8, 8, 2), umbrellaFabric); umbrellaCanopy.name = 'umbrellaCanopy'; umbrellaCanopy.position.y = .83; umbrellaCanopy.castShadow = true; umbrella.add(umbrellaCanopy);
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
  const armDirection = new THREE.Vector3(), armDown = new THREE.Vector3(0, -1, 0);
  batchRigidParts(body, [cape]); [...legs, ...arms].forEach(joint => batchRigidParts(joint as THREE.Group));
  return {
    root,
    update(sim: Simulation, t: number, dt: number) {
      const p = sim.player; root.position.x = p.x; root.position.z = p.z; root.rotation.y = p.facing;
      const speed = p.sprinting ? 12 : 8, stride = p.moving ? .57 : 0;
      legs.forEach((leg, i) => { leg.rotation.x = Math.sin(t * speed + i * Math.PI) * stride; });
      arms.forEach((arm, i) => { arm.rotation.set(Math.sin(t * speed + i * Math.PI + Math.PI) * stride * .65, 0, i ? .06 : -.06); });
      body.position.y = p.moving ? Math.abs(Math.sin(t * speed)) * .04 : Math.sin(t * 2) * .006;
      const dodge = p.dodgeTime > 0 ? dodgePose(p.dodgeTime, p.dodgeSide, p.dodgeDuration) : null;
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, dodge ? dodge.lean : p.sprinting ? .15 : 0, 18, dt);
      body.rotation.z = sim.dead ? 1.4 : dodge?.roll ?? 0;
      body.rotation.y = 0;
      if (dodge) { body.position.y = dodge.crouch; legs[0].rotation.x = -dodge.stride * p.dodgeSide; legs[1].rotation.x = dodge.stride * p.dodgeSide; arms.forEach(arm => { arm.rotation.x = -.6; }); }
      if (p.attackTime > 0) {
        const pose = attackPose(p.attackWeapon, p.attackHeavy, p.combo, p.attackDuration - p.attackTime);
        weaponRoot.position.set(pose.weaponX, pose.weaponY, pose.weaponZ); weaponRoot.rotation.set(pose.rotateX, pose.rotateY, pose.rotateZ);
        // Keep the grip within arm reach, and make the hand follow the weapon rather than float beside it.
        armDirection.subVectors(weaponRoot.position, arms[1].position).clampLength(0, .6);
        weaponRoot.position.copy(arms[1].position).add(armDirection);
        body.rotation.set(pose.bodyX, pose.bodyY, pose.bodyZ); body.position.y += pose.crouch;
        arms[1].quaternion.setFromUnitVectors(armDown, armDirection.normalize()); arms[0].rotation.x = pose.leftArm;
        if (p.attackHeavy) { armDirection.subVectors(weaponRoot.position, arms[0].position).normalize(); arms[0].quaternion.setFromUnitVectors(armDown, armDirection); }
        umbrellaCanopy.scale.set(1 + pose.canopy * 2.7, 1 - pose.canopy * .58, 1 + pose.canopy * 2.7);
      } else { weaponRoot.position.set(.24, 1.12, -.39); weaponRoot.rotation.set(0, 0, -.43); body.rotation.y = 0; }
      weaponModels.forEach((model, weapon) => { model.visible = sim.progress.weapon === weapon; });
      if (p.attackTime <= 0) umbrellaCanopy.scale.set(1, 1, 1);
      for (let i = 0; i < capePos.count; i++) {
        const y = originalCape[i * 3 + 1], x = originalCape[i * 3], f = (capeHeight / 2 - y) / capeHeight;
        capePos.setZ(i, originalCape[i * 3 + 2] + Math.sin(t * 3.6 + x * 7 + f * 4) * .05 * f - (p.moving ? f * f * .2 : 0));
      }
      capePos.needsUpdate = true; capeGeometry.computeVertexNormals();
    },
  };
}

/** Scene, turntable and gallery share these exact species-specific models. */
export function createPet(pet: Pet, skinId = '') {
  const skin = petSkin(pet, skinId), root = new THREE.Group();
  const anatomy = pet === 'shiba' ? createShibaAnatomy() : pet === 'corgi' ? createCorgiAnatomy() : createCatAnatomy();
  root.add(anatomy);
  const bodyY = pet === 'shiba' ? .475 : pet === 'corgi' ? .285 : .33;
  const outfit = new THREE.Group(); outfit.name = 'pet-outfit'; root.add(outfit);
  dressPet(outfit, pet, skin.id, bodyY);
  root.userData.designParts = outfit.userData.designParts;
  root.name = `pet-${pet}-${skin.id}`; root.userData.pet = pet; root.userData.skin = skin.id;
  root.scale.setScalar(1.16); batchRigidParts(outfit); return root;
}

function createCatAnatomy() {
  const root=new THREE.Group(),fur=standard('#df8b3f',.96),stripe=standard('#a85b27',.96),cream=standard('#f0dfc2',.96);
  const eye=standard('#191b22',.2),glint=new THREE.MeshBasicMaterial({color:'#fff8e8'}),nose=standard('#30272a',.38),pink=standard('#d89591',.9),y=.33;
  ellipsoid(root,fur,[0,y,-.03],[.17,.15,.3]);ellipsoid(root,fur,[0,y+.025,.2],[.16,.16,.16]);
  ellipsoid(root,cream,[0,y-.075,.13],[.12,.09,.18]);ellipsoid(root,fur,[0,y+.15,.31],[.125,.115,.115]);
  ellipsoid(root,cream,[0,y+.10,.38],[.085,.065,.065]);ellipsoid(root,nose,[0,y+.13,.435],[.021,.018,.018]);
  for(let i=0;i<3;i++)ellipsoid(root,stripe,[0,y+.13,.11-i*.14],[.11,.025,.055]);
  for(const side of[-1,1]){
    const ear=new THREE.Mesh(new THREE.ConeGeometry(.05,.115,4),fur);ear.position.set(side*.075,y+.28,.31);ear.rotation.z=side*-.1;root.add(ear);
    const inner=new THREE.Mesh(new THREE.ConeGeometry(.028,.07,4),pink);inner.position.set(side*.075,y+.275,.327);root.add(inner);
    ellipsoid(root,eye,[side*.052,y+.17,.41],[.021,.023,.017]);ellipsoid(root,glint,[side*.045,y+.18,.424],[.006,.007,.005]);
    for(const z of[-.16,.16]){capsule(root,fur,[side*.095,.18,z],.035,.16);ellipsoid(root,cream,[side*.095,.04,z+.025],[.04,.038,.055]);}
    for(const offset of[-.015,.015])root.add(taperedTube([v(side*.06,y+.09+offset,.426),v(side*.15,y+.10+offset,.43)],[.002,.001],cream,3,2));
  }
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.105,.018,6,14),standard('#337d83',.6));collar.position.set(0,y+.08,.24);collar.rotation.x=Math.PI/2.7;root.add(collar);
  const tag=new THREE.Mesh(new THREE.OctahedronGeometry(.028),standard('#d2ac59',.35,.55));tag.position.set(0,y+.015,.34);root.add(tag);
  root.add(taperedTube([v(0,y+.06,-.28),v(.03,y+.20,-.38),v(.10,y+.34,-.37),v(.15,y+.35,-.31)],[.034,.030,.025,.018],fur,6,12));
  root.name='anatomy-orangeCat';batchRigidParts(root);return root;
}

/** Additive outfit construction: each rank retains and upgrades the previous rank's garment classes. */
function dressPet(root: THREE.Group, pet: Pet, id: string, y: number) {
  const definition=petSkin(pet,id),rank=definition.level;
  const parts:string[]=[];root.userData.designParts=parts;
  const cloth=standard(definition.colors[0],.88),accent=standard(definition.colors[1],.75),trim=standard(definition.colors[2],.48,.35);
  const gold=standard('#caa14e',.42,.56),cream=standard('#eee0bf',.9),leather=standard('#4c3b31',.85);
  cloth.side=accent.side=trim.side=THREE.DoubleSide;
  const tile=(m:THREE.Material,p:number[],size:number[],name:string)=>{parts.push(name);return panel(root,m,p,size,.012);};
  const ring=(m:THREE.Material,p:number[],radius:number,tube:number,name:string)=>{
    parts.push(name);const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,5,16),m);mesh.position.set(p[0],p[1],p[2]);mesh.castShadow=true;root.add(mesh);return mesh;
  };
  const fabric=(m:THREE.Material,vertices:number[],name:string)=>{
    parts.push(name);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const line=(m:THREE.Material,points:number[][],radius:number,name:string)=>{
    parts.push(name);root.add(taperedTube(points.map(p=>v(p[0],p[1],p[2])),points.map(()=>radius),m,4,Math.max(4,points.length*3)));
  };
  const jewel=(p:number[],size:number,name:string)=>{
    parts.push(name);const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(size),gold);mesh.position.set(p[0],p[1],p[2]);mesh.scale.z=.45;root.add(mesh);
  };
  /** Curved textile fitted over the back, with hanging sides and a shaped hem. */
  const coat=(m:THREE.Material,width:number,length:number,drop:number,name:string,lift=0)=>{
    const sections=[{z:.19,w:width*.75,base:.015,rise:.18},{z:-.025,w:width,base:-drop,rise:.21+drop},{z:-length*.65,w:width*.98,base:-drop-.015,rise:.20+drop},{z:-length,w:width*.78,base:-drop*.85,rise:.16+drop*.85}];
    const points:number[]=[];
    const at=(i:number,j:number)=>{const s=sections[i],a=-Math.PI/2+j*Math.PI/6;return[Math.sin(a)*s.w,y+s.base+Math.cos(a)*s.rise+lift,s.z];};
    for(let i=0;i<sections.length-1;i++)for(let j=0;j<6;j++)points.push(...at(i,j),...at(i+1,j),...at(i,j+1),...at(i,j+1),...at(i+1,j),...at(i+1,j+1));
    fabric(m,points,name);
    for(const side of[-1,1])line(trim,sections.map(s=>[side*s.w,y+s.base+lift,s.z]),rank===10?.009:.006,`${name}-hem`);
    line(trim,[[-width*.78,y-drop*.85+lift,-length],[0,y+.16+lift,-length],[width*.78,y-drop*.85+lift,-length]],.007,`${name}-rear-edge`);
    return (z:number)=>{
      for(let i=1;i<sections.length;i++)if(z>=sections[i].z){const a=sections[i-1],b=sections[i],t=(a.z-z)/(a.z-b.z);return y+lift+THREE.MathUtils.lerp(a.base+a.rise,b.base+b.rise,t);}
      const last=sections[sections.length-1];return y+lift+last.base+last.rise;
    };
  };
  const scarf=(long=false)=>{
    const neckY=pet==='shiba'?y+.14:y+.085,neckZ=pet==='shiba'?.255:.28;
    const collar=ring(cloth,[0,neckY,neckZ],pet==='corgi'?.13:.105,.018,'neck-scarf');collar.rotation.x=.25;
    fabric(cloth,[-.10,neckY-.02,neckZ+.075,.10,neckY-.02,neckZ+.075,0,neckY-.15,neckZ+.095],'front-scarf');
    if(long)fabric(cloth,[-.11,neckY-.01,.20,-.19,y+.12,-.13,-.25,y+.035,-.27,-.11,neckY-.01,.20,-.25,y+.035,-.27,-.18,y+.16,-.09],'scarf-tail');
  };
  const bottle=(x:number,z:number,name:string)=>{
    parts.push(name);const body=new THREE.Mesh(new THREE.CylinderGeometry(.034,.032,.14,8),accent);body.position.set(x,y+.075,z);root.add(body);
    tile(trim,[x,y+.155,z],[.041,.022,.041],`${name}-cap`);tile(cloth,[x,y+.065,z+.03],[.054,.045,.014],`${name}-band`);
  };
  if(pet!=='orangeCat'){
    const collar=ring(rank===1?standard('#337d83',.7):leather,[0,y+.12,pet==='shiba'?.245:.27],pet==='shiba'?.10:.135,.014,'everyday-collar');collar.rotation.x=.18;
    jewel([0,y+.04,.35],.023,'everyday-tag');
  }
  if(rank===1)return;

  if(pet==='orangeCat'){
    // Lv4 foundation: scarf and talisman remain present underneath later outfits.
    scarf();jewel([0,y-.025,.365],.028,'peace-talisman');
    if(rank===4){for(const side of[-1,1])ring(trim,[side*.019,y+.005,.37],.018,.006,'peace-knot');return;}
    // Lv7 complete guardian vest and breastplate.
    coat(cloth,.205,.285,.085,'guardian-jacket');
    for(const side of[-1,1]){
      const shoulder=tile(accent,[side*.145,y+.145,.12],[.09,.045,.18],'guardian-shoulder');shoulder.rotation.z=side*-.28;
      tile(trim,[side*.18,y+.045,.10],[.025,.075,.04],'guardian-fastener');
      tile(accent,[side*.12,y-.035,.23],[.065,.09,.08],'guardian-sleeve');
    }
    tile(leather,[0,y+.015,.335],[.145,.15,.025],'breastplate-backing');
    const shield=tile(rank===10?gold:trim,[0,y+.02,.355],[.12,.125,.025],'guardian-breastplate');shield.rotation.z=Math.PI/4;
    jewel([0,y+.02,.38],.033,'guardian-crest');
    if(rank===7)return;
    // Lv10 keeps the entire jacket, plate and sleeves, then adds ceremonial tailoring.
    const capeTop=coat(cloth,.235,.34,.12,'brocade-cape',.035);
    for(const side of[-1,1]){
      const shoulder=tile(gold,[side*.155,y+.18,.115],[.11,.03,.185],'gold-layered-pauldrons');shoulder.rotation.z=side*-.25;
      tile(cloth,[side*.105,y+.13,.255],[.055,.115,.025],'ceremonial-standing-collar');
      parts.push('guardian-bell');ellipsoid(root,gold,[side*.085,y-.075,.38],[.028,.032,.028]);ring(leather,[side*.085,y-.075,.405],.017,.003,'bell-seam');
      line(gold,[[side*.12,y+.21,.13],[side*.165,y+.18,-.06],[side*.17,y+.09,-.25]],.007,'cape-braid');
    }
    for(const z of[-.06,-.18,-.28]){parts.push('brocade-back-inlay');const pin=new THREE.Mesh(new THREE.OctahedronGeometry(.025),gold);pin.scale.y=.20;pin.position.set(0,capeTop(z)+.003,z);root.add(pin);}
  }else if(pet==='corgi'){
    // The expedition kit keeps the harness, two supply panniers and their white patches.
    for(const side of[-1,1])line(cloth,[[side*.15,y-.045,.22],[side*.14,y+.17,.045],[-side*.14,y+.17,-.20]],.019,'cross-harness');
    tile(trim,[0,y+.195,.045],[.065,.025,.055],'harness-buckle');
    if(rank===4){bottle(.235,-.10,'water-flask');return;}
    coat(cloth,.215,.30,.025,'supply-saddle-pad');
    const center=.225,w=rank===10?.14:.12,h=rank===10?.22:.18,depth=rank===10?.32:.275;
    for(const side of[-1,1]){
      tile(cloth,[side*center,y+.025,-.075],[w,h,depth],'supply-pannier');
      tile(accent,[side*center,y+h/2+.035,-.075],[w+.015,.035,depth+.012],'pannier-lid');
      const x=side*(center+w/2+.008);
      tile(cream,[x,y+.025,-.065],[.01,.085,.025],'supply-cross-vertical');tile(cream,[x,y+.025,-.065],[.012,.025,.085],'supply-cross-horizontal');
      tile(leather,[side*center,y+.055,-.17],[w+.02,.11,.025],'reinforced-pack-strap');
      tile(trim,[x,y+.065,-.17],[.018,.04,.045],'pack-buckle');
      if(rank===10){line(trim,[[x,y-h/2+.025,.07],[x,y-h/2+.025,-.23],[x,y+h/2+.025,-.23]],.005,'pack-edge-piping');}
    }
    bottle(.255,.15,'water-flask');
    if(rank===7)return;
    bottle(-.255,.15,'second-water-flask');
    parts.push('rolled-expedition-blanket');const roll=new THREE.Mesh(new THREE.CylinderGeometry(.061,.061,.36,10),accent);roll.rotation.z=Math.PI/2;roll.position.set(0,y+.25,-.18);root.add(roll);
    for(const side of[-1,1]){const binding=ring(leather,[side*.105,y+.25,-.18],.064,.008,'blanket-binding');binding.rotation.y=Math.PI/2;tile(trim,[side*.105,y+.315,-.18],[.034,.015,.04],'blanket-clasp');}
    tile(accent,[0,y+.24,.045],[.11,.065,.095],'sealed-ration-tin');line(trim,[[-.052,y+.275,.045],[.052,y+.275,.045]],.006,'ration-tin-clasp');
  }else{
    scarf(true);
    const compass=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.013,12),gold);compass.rotation.x=Math.PI/2;compass.position.set(0,y+.06,.36);root.add(compass);parts.push('compass-medallion');
    const needle=tile(accent,[0,y+.06,.37],[.012,.047,.008],'compass-needle');needle.rotation.z=.55;
    if(rank===4)return;
    coat(cloth,.202,rank===10?.32:.285,rank===10?.125:.10,'detective-tailored-coat');
    for(const side of[-1,1]){
      const hem=y-(rank===10?.135:.105);
      fabric(cloth,[side*.015,y+.11,.353,side*.115,y+.12,.295,side*.135,hem,.325,side*.015,y+.11,.353,side*.135,hem,.325,side*.012,hem,.375],'double-breasted-front');
      fabric(accent,[side*.025,y+.115,.362,side*.115,y+.13,.302,side*.075,y-.015,.374],'detective-lapel');
      line(trim,[[side*.012,y+.10,.368],[side*.012,hem,.38],[side*.13,hem,.33]],rank===10?.006:.004,'coat-front-piping');
      for(const height of (rank===10?[.015,-.05,-.105]:[.005,-.065]))jewel([side*.04,y+height,.38],rank===10?.011:.008,'coat-buttons');
      tile(leather,[side*.205,y-.045,-.08],[.035,.11,.135],'detective-pocket');
      tile(trim,[side*.225,y-.02,-.065],[.012,.018,.035],'pocket-clasp');
    }
    // Both ranks retain a fitted deerstalker; the top rank adds a band, stitch and insignia.
    parts.push('deerstalker-crown');ellipsoid(root,cloth,[0,.807,.27],[.13,.047,.12]);
    for(const z of[.16,.39]){const brim=tile(leather,[0,.786,z],[.185,.015,.08],'deerstalker-brim');brim.rotation.x=z>.3?.12:-.12;}
    for(const x of[-.065,0,.065])line(accent,[[x,.82,.18],[x,.852,.27],[x,.82,.36]],.004,'deerstalker-check-stitch');
    for(const side of[-1,1])tile(cloth,[side*.12,.79,.255],[.027,.06,.09],'deerstalker-ear-flap');
    if(rank===7)return;
    const mantleTop=coat(cloth,.23,.23,.035,'inspector-shoulder-mantle',.048);
    for(const side of[-1,1]){
      const epaulette=tile(accent,[side*.15,y+.19,.14],[.08,.028,.13],'inspector-epaulette');epaulette.rotation.z=side*-.22;
      jewel([side*.15,y+.21,.16],.018,'epaulette-pin');
      tile(trim,[side*.16,y-.05,.17],[.06,.035,.035],'sleeve-rank-band');
    }
    line(gold,[[-.118,.816,.21],[0,.842,.175],[.118,.816,.21]],.007,'deerstalker-gold-band');
    tile(accent,[0,.811,.383],[.04,.055,.018],'hat-insignia-backing');jewel([0,.818,.399],.018,'hat-insignia');jewel([-.063,y+.04,.365],.035,'inspector-breast-badge');
    ring(gold,[.067,.714,.414],.025,.004,'monocle-rim');line(gold,[[.09,.71,.414],[.135,.62,.35],[.10,.54,.33]],.0028,'monocle-chain');
    for(const z of[-.025,-.15])tile(gold,[0,mantleTop(z)+.003,z],[.045,.012,.045],'mantle-back-fastener');
  }
}
