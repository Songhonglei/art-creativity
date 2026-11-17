/** Development-only evidence producer. Not imported by the application or included in ZIP. */
import * as THREE from 'three';
import { createHunter, disposeHero } from './heroModel';
import { SKINS } from './heroProgress';
import { DEFAULT_PROGRESS, Simulation } from './simulation';
import { attackSpec } from './combat';
import type { Gender, Skin, Weapon } from './types';

export async function renderEvidence() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(240, 300); renderer.setClearColor('#172832'); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(33, .8, .1, 15);
  scene.add(new THREE.HemisphereLight('#d8efed', '#725944', 2.5)); const light = new THREE.DirectionalLight('#ffe4bd', 3); light.position.set(2, 3, 4); scene.add(light); const rim = new THREE.DirectionalLight('#83bbcd', 2); rim.position.set(-2, 2, -3); scene.add(rim);
  const sim = new Simulation({ ...DEFAULT_PROGRESS, level: 10 }); sim.player.x = sim.player.z = 0;
  const files: { name: string; data: string }[] = [], stats: unknown[] = [];
  const setCamera = (focus = false) => { renderer.setSize(focus ? 240 : 240, focus ? 240 : 300); camera.aspect = focus ? 1 : .8; camera.position.set(0, focus ? 1.97 : 1.55, focus ? 1.09 : 5.2); camera.lookAt(0, focus ? 1.94 : 1.1, 0); camera.updateProjectionMatrix(); };
  const sheet = (cols: number, rows: number, width = 240, height = 326) => { const canvas = document.createElement('canvas'); canvas.width = cols * width; canvas.height = rows * height; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#111d2a'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '14px sans-serif'; return { canvas, ctx, put(index: number, label: string) { const x = index % cols * width, y = Math.floor(index / cols) * height; ctx.drawImage(renderer.domElement, x, y, width, height - 26); ctx.fillStyle = '#f2eadb'; ctx.fillText(label, x + 8, y + height - 8); } }; };
  const overview = sheet(6, 6), grey = sheet(3, 3); let ov = 0, gr = 0;
  for (const gender of ['male', 'female'] as Gender[]) for (const skin of SKINS) {
    const model = createHunter(null, skin.id, gender); scene.add(model.root); sim.progress.weapon = 'crowbar'; sim.dead = false; sim.player.moving = sim.player.sprinting = false; sim.player.attackTime = sim.player.dodgeTime = 0;
    for (const angle of [0, Math.PI / 2, Math.PI]) { setCamera(); sim.player.facing = angle; model.update(sim, 0, 1 / 60); renderer.render(scene, camera); overview.put(ov++, `${skin.id} ${gender} ${Math.round(angle * 180 / Math.PI)}°`); if (angle === 0) files.push({ name: `outfit-${skin.id}-${gender}.png`, data: renderer.domElement.toDataURL('image/png') }); }
    // Portraits are frozen renders of this same model, avoiding a third runtime WebGL context.
    setCamera(true); renderer.setClearColor('#172d40', 0); sim.player.facing = -.12; model.update(sim, 0, 1 / 60); renderer.render(scene, camera); files.push({ name: `portrait-${skin.id}-${gender}.png`, data: renderer.domElement.toDataURL('image/png') }); renderer.setClearColor('#172832');
    if (gender === 'female' || skin.id === 'neon') {
      const close = sheet(3, 1, 240, 266);
      for (const [index, angle] of [0, Math.PI / 4, Math.PI / 2].entries()) { setCamera(true); sim.player.facing = angle; model.update(sim, 0, 1 / 60); renderer.render(scene, camera); close.put(index, `${skin.name} · ${gender} · ${index * 45}°`); }
      files.push({ name: `face-${skin.id}-${gender}.png`, data: close.canvas.toDataURL('image/png') });
    }
    const poses = sheet(6, 6, 180, 240); let n = 0;
    for (const weapon of ['crowbar', 'baton', 'umbrella'] as Weapon[]) for (const mode of ['idle', 'walk', 'run', 'light-load', 'light-hit', 'heavy-load', 'heavy-hit', 'dodge-left', 'dodge-right', 'fall', 'rise', 'rescue']) {
      setCamera(); sim.progress.weapon = weapon; sim.player.facing = -.22; sim.dead = mode === 'fall'; sim.player.moving = mode === 'walk' || mode === 'run'; sim.player.sprinting = mode === 'run'; sim.player.attackTime = sim.player.dodgeTime = 0;
      if (mode.startsWith('light') || mode.startsWith('heavy')) { const heavy = mode.startsWith('heavy'), spec = attackSpec(weapon, heavy); sim.player.attackWeapon = weapon; sim.player.attackHeavy = heavy; sim.player.attackDuration = spec.duration; sim.player.attackTime = spec.duration - spec.impact * (mode.endsWith('load') ? .7 : 1); sim.player.combo = 1; }
      if (mode.startsWith('dodge')) { sim.player.dodgeTime = .18; sim.player.dodgeSide = mode === 'dodge-left' ? -1 : 1; }
      model.update(sim, .2, 1 / 60, { death: 1.5, rise: mode === 'rise' || mode === 'rescue' ? .25 : .6, reducedMotion: false }); if (mode === 'fall') { camera.position.set(.95, 1.55, 5.4); camera.lookAt(.95, .65, 0); } renderer.render(scene, camera); poses.put(n++, `${weapon} · ${mode}`);
      if (mode === 'idle') stats.push({ skin: skin.id, gender, weapon, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries });
    }
    files.push({ name: `actions-${skin.id}-${gender}.png`, data: poses.canvas.toDataURL('image/png') });
    if (gender === 'male' && skin.level > 1) { sim.dead = false; sim.player.attackTime = sim.player.dodgeTime = 0; sim.player.moving = false; sim.progress.weapon = 'crowbar'; scene.overrideMaterial = new THREE.MeshStandardMaterial({ color: '#bac6c6', roughness: .9, side: THREE.DoubleSide }); for (const angle of [0, Math.PI / 2, Math.PI]) { setCamera(); sim.player.facing = angle; model.update(sim, 0, 1 / 60); renderer.render(scene, camera); grey.put(gr++, `${skin.name} ${Math.round(angle * 180 / Math.PI)}°`); } scene.overrideMaterial.dispose(); scene.overrideMaterial = null; }
    scene.remove(model.root); disposeHero(model.root);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  files.push({ name: 'outfits-front-side-back.png', data: overview.canvas.toDataURL('image/png') }, { name: 'tiers-grey-silhouettes.png', data: grey.canvas.toDataURL('image/png') });
  const glError = renderer.getContext().getError(); renderer.dispose(); renderer.forceContextLoss(); return { files, stats, glError };
}
export type EvidenceSkin = Skin;
