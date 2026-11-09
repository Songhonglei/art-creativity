import * as THREE from 'three';
import { Simulation, SAVE_KEY, readProgress, angleDelta, clamp } from './simulation';
import { groundHeight, makeMaterials, canvasTexture } from './materials';
import type { Materials } from './materials';
import { createMonster, createHunter, createPet } from './creatures';
import { World } from './world';
import { followPet, resolveCircle, cameraClearDistance } from './collision';
import { GameAudio } from './audio';
import type { GameEvent, MonsterKind, Pet, Settings, Skin, Snapshot } from './types';

export type Shortcut = 'map' | 'guide' | 'forge' | 'settings' | 'help' | 'escape';
interface EngineCallbacks { snapshot: (s: Snapshot) => void; ready: () => void; error: (s: string) => void; shortcut: (key: Shortcut) => void; progress: (n: number) => void }
interface DamageText { element: HTMLDivElement; position: THREE.Vector3; life: number }
const pixelRatio = (settings: Settings, software: boolean) => Math.min(window.devicePixelRatio,
  software ? settings.quality === 'high' ? .8 : settings.quality === 'balanced' ? .65 : .5
    : settings.quality === 'high' ? 1.5 : settings.quality === 'balanced' ? 1 : .8);

export class Engine {
  simulation: Simulation;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene = new THREE.Scene();
  audio = new GameAudio();
  settings: Settings;
  yaw = -.07; pitch = .07; cameraDistance = 8.2;
  private world: World;
  private hunter: ReturnType<typeof createHunter>;
  private hunters = new Map<Skin, ReturnType<typeof createHunter>>();
  private monster: ReturnType<typeof createMonster>;
  private monsters = new Map<MonsterKind, ReturnType<typeof createMonster>>();
  private streetModels = new Map<string, ReturnType<typeof createMonster>>();
  private streetSlots: (ReturnType<typeof createMonster> | undefined)[] = [];
  private streetKinds: MonsterKind[] = [];
  private companion: THREE.Group;
  private companions = new Map<Pet, THREE.Group>();
  private keys = new Set<string>();
  private touch = { x: 0, z: 0, sprint: false };
  private pointer = { dragging: false, x: 0, y: 0, moved: false };
  private container: HTMLDivElement;
  private callbacks: EngineCallbacks;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private materials: Materials;
  private raf = 0; private lastTime = 0; private hudTimer = 0; private elapsed = 0; private shake = 0; private stepTimer = 0; private moodTimer = 0; private cityAudioTimer = 0;
  private damage: DamageText[] = [];
  private target = new THREE.Vector3(); private desiredCamera = new THREE.Vector3(); private projected = new THREE.Vector3();
  private targetMarker: HTMLDivElement;
  private dangerRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private slash: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private loading = false;
  private pausedFrame = 0;
  private softwareRenderer = false;
  private contactShadows: THREE.Mesh[] = [];

  constructor(container: HTMLDivElement, settings: Settings, callbacks: EngineCallbacks) {
    this.container = container; this.callbacks = callbacks; this.settings = settings;
    let saved: string | null = null; try { saved = localStorage.getItem(SAVE_KEY); } catch { /* Storage may be unavailable. */ }
    this.simulation = new Simulation(readProgress(saved), e => this.onEvent(e), p => localStorage.setItem(SAVE_KEY, JSON.stringify(p)));
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const gl = this.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.softwareRenderer = Boolean(debug && /swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    this.renderer.setPixelRatio(pixelRatio(settings, this.softwareRenderer));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = !this.softwareRenderer && settings.quality === 'high'; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '沪上游侠：上海夜色街区。W A S D 移动，点击或 J 攻击，空格键闪避。');
    this.renderer.domElement.tabIndex = 0; container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(54, 1, .1, 600);
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => callbacks.progress(15 + Math.round(loaded / total * 70));
    manager.onLoad = () => { if (!this.disposed) { this.loading = false; callbacks.progress(100); callbacks.ready(); } };
    manager.onError = () => { if (!this.disposed) this.simulation.notify('贴图加载不全', '部分材质未能加载，不影响巡逻。'); };
    this.loading = true;
    const materials = makeMaterials(); this.materials = materials; this.world = new World(this.scene, materials, this.simulation, new THREE.TextureLoader(manager));
    if (this.softwareRenderer) { this.world.sun.shadow.mapSize.set(1024, 1024); }
    this.world.setQuality(settings, this.softwareRenderer);
    this.hunter = createHunter(materials, this.simulation.progress.skin); this.hunters.set(this.simulation.progress.skin, this.hunter);
    this.monster = createMonster(this.simulation.monster.kind, materials); this.monsters.set(this.simulation.monster.kind, this.monster);
    this.companion = createPet(this.simulation.progress.pet); this.companions.set(this.simulation.progress.pet, this.companion);
    this.scene.add(this.hunter.root, this.monster.root, this.companion);
    if (this.softwareRenderer) {
      const texture = canvasTexture((ctx, size) => { const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2); g.addColorStop(0, 'rgba(10,14,24,.65)'); g.addColorStop(.4, 'rgba(10,14,24,.38)'); g.addColorStop(1, 'rgba(10,14,24,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); }, 64);
      for (const scale of [[1.8, 2.5], [7, 10], [1.2, 1.5]]) {
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(scale[0], scale[1]), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
        shadow.rotation.x = -Math.PI / 2; this.scene.add(shadow); this.contactShadows.push(shadow);
      }
    }
    this.companion.position.set(-2, 0, 21);
    this.dangerRing = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.84, 80), new THREE.MeshBasicMaterial({ color: '#ff7a9c', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); this.dangerRing.rotation.x = -Math.PI / 2; this.scene.add(this.dangerRing);
    this.slash = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.9, 40, 1, 0, Math.PI * 1.25), new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); this.scene.add(this.slash);
    this.targetMarker = document.createElement('div'); this.targetMarker.className = 'world-target'; this.targetMarker.innerHTML = '<span class="target-diamond"></span><span class="target-distance"></span>'; container.appendChild(this.targetMarker);
    if (typeof ResizeObserver !== 'undefined') { this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(container); }
    else window.addEventListener('resize', this.resize);
    this.resize();
    this.updateCamera(.1, true);
    this.bindEvents(); this.audio.setVolume(settings.volume, settings.sound); this.audio.setSoundscape(settings.soundscape);
    callbacks.snapshot(this.simulation.snapshot());
    if (new URLSearchParams(location.search).has('qa')) Object.defineProperty(window, '__originalQa', { configurable: true, get: () => ({
      snapshot: this.simulation.snapshot(), player: { ...this.simulation.player },
      pet: { x: this.companion.position.x, z: this.companion.position.z },
      circles: this.simulation.colliders.map(c => ({ ...c })), boxes: this.simulation.boxColliders.map(b => ({ ...b })),
      stream: this.world.streamingStats,
      audio: this.audio.audioDebug,
      cityFeature: this.world.nearestCityFeature(this.simulation.player),
      appearance: { skin: this.simulation.progress.skin, weapon: this.simulation.progress.weapon, pet: this.simulation.progress.pet, model: this.hunter.root.name, monsterVisible: this.monster.root.visible, streetModels: this.streetModels.size, streetVisible: this.streetSlots.filter(model => model?.root.visible).length, streetKinds: [...this.streetKinds] },
      street: this.simulation.streetEnemies.map(enemy => ({ ...enemy })),
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, targetDistance: this.camera.position.distanceTo(this.target) },
      render: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures },
      placePlayer: (x: number, z: number) => { this.simulation.player.x = x; this.simulation.player.z = z; this.world.updateStreaming(this.simulation.player, true); },
      placePet: (x: number, z: number) => { this.companion.position.x = x; this.companion.position.z = z; },
      setView: (yaw: number, pitch: number, distance: number) => { this.yaw = yaw; this.pitch = pitch; this.cameraDistance = distance; this.updateCamera(.1, true); },
      attack: () => { this.simulation.attack(); this.publish(); },
      interact: () => { this.simulation.interact(); this.publish(); },
      petSkill: () => { this.simulation.petSkill(); this.publish(); },
      step: (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) this.simulation.tick(1 / 60, { x: 0, z: 0, sprint: false }); this.publish(); },
      freeze: () => { this.simulation.paused = true; },
    }) });

    void Promise.resolve().then(() => { if (!this.disposed) { this.loading = false; callbacks.progress(100); callbacks.ready(); } });
    this.raf = requestAnimationFrame(this.loop);
  }
  private resize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h); this.camera.aspect = w / h;
    this.camera.fov = w / h < .7 ? 65 : w / h > 1.65 && h < 600 ? 57 : 52;
    this.camera.updateProjectionMatrix();
  }
  private bindEvents() {
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur); document.addEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown); window.addEventListener('pointermove', this.pointerMove); window.addEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.addEventListener('contextmenu', this.contextMenu); this.renderer.domElement.addEventListener('wheel', this.wheel, { passive: false });
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
  }
  private keyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.target instanceof HTMLButtonElement && ['Space', 'Enter'].includes(e.code)) return;
    const shortcuts: Record<string, Shortcut> = { KeyM: 'map', KeyG: 'guide', KeyF: 'forge', KeyH: 'help', Escape: 'escape' };
    if (shortcuts[e.code] && !e.repeat) { e.preventDefault(); this.callbacks.shortcut(shortcuts[e.code]); return; }
    if (this.simulation.paused) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    this.audio.unlock(); this.keys.add(e.code);
    if (e.repeat) return;
    switch (e.code) { case 'Space': this.simulation.dodge(); break; case 'KeyJ': this.simulation.attack(); break; case 'KeyK': this.simulation.attack(true); break; case 'KeyE': this.simulation.interact(); break; case 'KeyR': case 'Digit1': this.simulation.heal(); break; case 'KeyQ': this.simulation.toggleLock(); break; case 'KeyC': this.simulation.petSkill(); break; }
    this.publish();
  };
  private keyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private blur = () => { this.keys.clear(); this.touch = { x: 0, z: 0, sprint: false }; this.pointer.dragging = false; };
  private visibility = () => { this.blur(); this.lastTime = 0; };
  private pointerDown = (e: PointerEvent) => { if (this.simulation.paused) return; this.audio.unlock(); this.pointer = { dragging: true, x: e.clientX, y: e.clientY, moved: false }; if (e.button === 2) this.simulation.attack(true); };
  private pointerMove = (e: PointerEvent) => {
    if (!this.pointer.dragging || this.simulation.paused) return;
    const dx = e.clientX - this.pointer.x, dy = e.clientY - this.pointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) this.pointer.moved = true;
    if (this.pointer.moved) { this.yaw -= dx * .004 * this.settings.sensitivity; this.pitch = clamp(this.pitch + dy * .0024 * this.settings.sensitivity, -.05, .72); }
    this.pointer.x = e.clientX; this.pointer.y = e.clientY;
  };
  private pointerUp = (e: PointerEvent) => { if (this.pointer.dragging && !this.pointer.moved && e.button === 0 && !this.simulation.paused) this.simulation.attack(); this.pointer.dragging = false; };
  private contextMenu = (e: Event) => e.preventDefault();
  private wheel = (e: WheelEvent) => { e.preventDefault(); this.cameraDistance = clamp(this.cameraDistance + e.deltaY * .01, 5.5, 17); };
  private contextLost = (e: Event) => { e.preventDefault(); this.setPaused(true); this.callbacks.error('图形连接中断，请重新加载。已强化的装备和存档都还在。'); };

  private onEvent(e: GameEvent) {
    this.audio.play(e);
    if (e.type === 'hurt' || e.type === 'hit') { this.shake = e.type === 'hurt' ? .16 : .08; }
    if (e.type === 'hit' && this.container) {
      const element = document.createElement('div'); element.className = 'damage-number'; element.textContent = String(e.value); this.container.appendChild(element);
      this.damage.push({ element, position: new THREE.Vector3(e.x ?? 0, groundHeight(e.x ?? 0, e.z ?? 0) + 4.5, e.z ?? 0), life: 1.15 });
    }
    if (e.type === 'weather') this.audio.setWeather(this.simulation.weather);
  }
  private loop = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) { this.lastTime = 0; return; }
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, .25) : 1 / 60; this.lastTime = now;
    if (this.loading) return;
    const sim = this.simulation;
    this.world.updateStreaming(sim.player);
    if (sim.paused) { this.pausedFrame += dt; if (this.pausedFrame < .15) return; this.pausedFrame = 0; }
    if (!sim.paused && !this.loading) {
      this.elapsed += dt;
      const right = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.touch.x;
      const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - this.touch.z;
      const input = { x: right * Math.cos(this.yaw) - forward * Math.sin(this.yaw), z: -right * Math.sin(this.yaw) - forward * Math.cos(this.yaw), sprint: this.touch.sprint || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
      for (let remaining = dt; remaining > 0; remaining -= .025) sim.tick(Math.min(.025, remaining), input);
      this.stepTimer += dt; if (sim.player.moving && this.stepTimer > (sim.player.sprinting ? .29 : .43)) { this.audio.play({ type: 'step' }); this.stepTimer = 0; }
    }
    const visualDt = sim.paused ? 0 : dt, t = this.elapsed;
    this.world.update(sim, t, visualDt);
    this.moodTimer += dt; if (this.moodTimer > .5) { this.audio.setMood(sim.weather, sim.combat, sim.player.health / sim.maxHealth < .3, sim.questDistrict); this.moodTimer = 0; }
    this.cityAudioTimer += dt;
    if (this.cityAudioTimer > .15) { const feature = this.world.nearestCityFeature(sim.player); this.audio.setCityFeature(feature.kind, feature.distance); this.cityAudioTimer = 0; }
    this.audio.updateCity(dt);
    this.hunter.update(sim, t, visualDt); this.monster.update(sim, t, visualDt);
    this.monster.root.visible = sim.targetRevealed;
    sim.streetEnemies.forEach((enemy, slot) => {
      if (this.streetKinds[slot] !== enemy.kind || !this.streetSlots[slot]) {
        if (this.streetSlots[slot]) this.streetSlots[slot]!.root.visible = false;
        const key = `${slot}:${enemy.kind}`;
        let model = this.streetModels.get(key);
        if (!model) { model = createMonster(enemy.kind, this.materials); this.streetModels.set(key, model); this.scene.add(model.root); }
        this.streetSlots[slot] = model; this.streetKinds[slot] = enemy.kind;
      }
      const model = this.streetSlots[slot]!;
      model.update(sim, t, visualDt, enemy);
      model.root.position.y = groundHeight(enemy.x, enemy.z);
      model.root.visible = enemy.health > 0 || enemy.respawn > 0;
    });
    if (this.contactShadows.length > 1) this.contactShadows[1].visible = sim.targetRevealed;
    this.hunter.root.position.y = groundHeight(sim.player.x, sim.player.z); this.monster.root.position.y = groundHeight(sim.monster.x, sim.monster.z);
    const petBefore = { x: this.companion.position.x, z: this.companion.position.z };
    const petNext = followPet(petBefore, sim.player, visualDt, sim.colliders, sim.boxColliders);
    this.companion.position.x = petNext.x; this.companion.position.z = petNext.z;
    const petMoveX = petNext.x - petBefore.x, petMoveZ = petNext.z - petBefore.z;
    if (Math.hypot(petMoveX, petMoveZ) > .0001) this.companion.rotation.y = Math.atan2(petMoveX, petMoveZ);
    this.companion.position.y = groundHeight(petNext.x, petNext.z) + (sim.player.moving ? Math.abs(Math.sin(t * 9)) * .14 : 0);
    this.contactShadows.forEach((shadow, i) => { const actor = [this.hunter.root, this.monster.root, this.companion][i]; shadow.position.copy(actor.position); shadow.position.y += .06; shadow.rotation.z = -actor.rotation.y; });
    const warning = [sim.monster, ...sim.streetEnemies].filter(m => m.health > 0 && m.action === 'windup').sort((a, b) => Math.hypot(a.x - sim.player.x, a.z - sim.player.z) - Math.hypot(b.x - sim.player.x, b.z - sim.player.z))[0];
    const m = warning ?? sim.monster; this.dangerRing.position.set(m.x, groundHeight(m.x, m.z) + .09, m.z); this.dangerRing.material.opacity = warning ? .3 + Math.sin(t * 12) * .15 : 0;
    this.slash.position.set(sim.player.x, groundHeight(sim.player.x, sim.player.z) + 1.1, sim.player.z); this.slash.rotation.set(-Math.PI * .43, sim.player.facing, t * 9); this.slash.material.opacity = sim.player.attackTime > 0 ? Math.max(0, Math.sin(sim.player.attackTime * 6)) * .25 : 0;
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera); this.updateMarkers(dt);
    this.hudTimer += dt; if (this.hudTimer > .1) { this.publish(); this.hudTimer = 0; }
  };
  private updateCamera(dt: number, instant = false) {
    const p = this.simulation.player, m = this.simulation.monster;
    if (this.simulation.locked && m.health > 0) { const desired = Math.atan2(p.x - m.x, p.z - m.z); this.yaw += angleDelta(this.yaw, desired) * Math.min(1, dt * 3); }
    const y = groundHeight(p.x, p.z);
    this.target.set(p.x, y + 1.55, p.z);
    const dist = this.cameraDistance + (p.sprinting ? .45 : 0), height = 2.45 + this.pitch * 8.5;
    this.desiredCamera.set(p.x + Math.sin(this.yaw) * dist, y + height, p.z + Math.cos(this.yaw) * dist);
    this.desiredCamera.y = Math.max(this.desiredCamera.y, groundHeight(this.desiredCamera.x, this.desiredCamera.z) + 1.2);
    const clearDistance = cameraClearDistance(p, this.desiredCamera, dist, this.simulation.boxColliders);
    if (clearDistance < dist) {
      this.desiredCamera.x = p.x + Math.sin(this.yaw) * clearDistance;
      this.desiredCamera.z = p.z + Math.cos(this.yaw) * clearDistance;
      this.desiredCamera.y = Math.max(y + 1.65, y + height * Math.max(.55, clearDistance / dist));
    }
    const blend = instant || clearDistance < this.camera.position.distanceTo(this.target) * .55 ? 1 : 1 - Math.exp(-dt * (clearDistance < dist ? 18 : 7));
    this.camera.position.lerp(this.desiredCamera, blend);
    if (!this.settings.reducedMotion && this.shake > 0) { this.camera.position.x += (Math.random() - .5) * this.shake; this.camera.position.y += (Math.random() - .5) * this.shake; }
    this.shake = Math.max(0, this.shake - dt * .5);
    this.camera.lookAt(this.target);
  }
  private updateMarkers(dt: number) {
    const width = this.container.clientWidth, height = this.container.clientHeight, sim = this.simulation;
    const show = sim.targetRevealed && sim.monster.health > 0 && !sim.dead;
    this.projected.set(sim.monster.x, groundHeight(sim.monster.x, sim.monster.z) + 6.4, sim.monster.z).project(this.camera);
    this.targetMarker.style.display = show && this.projected.z < 1 && Math.abs(this.projected.x) < .94 && Math.abs(this.projected.y) < .9 ? 'flex' : 'none';
    this.targetMarker.style.transform = `translate(${(this.projected.x * .5 + .5) * width}px,${(-this.projected.y * .5 + .5) * height}px) translate(-50%,-100%)`;
    this.targetMarker.classList.toggle('is-locked', sim.locked);
    this.targetMarker.children[1].textContent = `${Math.round(Math.hypot(sim.player.x - sim.monster.x, sim.player.z - sim.monster.z))} 米`;
    this.damage = this.damage.filter(d => {
      if (!sim.paused) d.life -= dt;
      if (d.life <= 0) { d.element.remove(); return false; }
      d.position.y += dt * .75; this.projected.copy(d.position).project(this.camera);
      d.element.style.transform = `translate(${(this.projected.x * .5 + .5) * width}px,${(-this.projected.y * .5 + .5) * height}px)`;
      d.element.style.opacity = String(Math.min(1, d.life * 2)); return true;
    });
  }
  publish() { const snapshot = this.simulation.snapshot(); snapshot.heading = ((-this.yaw * 180 / Math.PI) % 360 + 360) % 360; this.callbacks.snapshot(snapshot); }
  setPaused(paused: boolean) { this.simulation.paused = paused; this.keys.clear(); this.pointer.dragging = false; this.touch = { x: 0, z: 0, sprint: false }; this.publish(); }
  setSettings(settings: Settings) {
    const renderChanged = this.settings.quality !== settings.quality || this.settings.reducedMotion !== settings.reducedMotion;
    this.settings = settings; this.audio.setVolume(settings.volume, settings.sound); this.audio.setSoundscape(settings.soundscape);
    if (!renderChanged) return;
    this.renderer.setPixelRatio(pixelRatio(settings, this.softwareRenderer));
    this.renderer.shadowMap.enabled = !this.softwareRenderer && settings.quality === 'high';
    this.world.setQuality(settings, this.softwareRenderer); this.resize();
  }
  setTouch(x: number, z: number, sprint = false) { this.touch = { x, z, sprint }; }
  action(action: 'attack' | 'heavy' | 'dodge' | 'heal' | 'interact' | 'lock' | 'pet') {
    this.audio.unlock(); const sim = this.simulation;
    if (action === 'attack') sim.attack(); else if (action === 'heavy') sim.attack(true); else if (action === 'dodge') sim.dodge(); else if (action === 'heal') sim.heal(); else if (action === 'interact') sim.interact(); else if (action === 'pet') sim.petSkill(); else sim.toggleLock();
    this.publish();
  }
  private rebuildMonster() {
    this.monster.root.visible = false;
    const kind = this.simulation.monster.kind;
    let monster = this.monsters.get(kind);
    if (!monster) { monster = createMonster(kind, this.materials); this.monsters.set(kind, monster); this.scene.add(monster.root); }
    monster.root.visible = true; this.monster = monster;
    if (this.contactShadows.length > 1) this.contactShadows[1].visible = true;
  }
  /** Swap the complete urban outfit; cached models avoid rebuilding geometry on every wardrobe visit. */
  setSkin(skin: Skin) {
    if (skin === this.simulation.progress.skin) return;
    this.hunter.root.visible = false;
    let hunter = this.hunters.get(skin);
    if (!hunter) { hunter = createHunter(this.materials, skin); this.hunters.set(skin, hunter); this.scene.add(hunter.root); }
    hunter.root.visible = true; this.hunter = hunter;
    this.simulation.setSkin(skin); this.publish();
  }
  /** Cache each complete companion so repeated selections never leak GPU resources. */
  setPet(pet: Pet) {
    if (pet === this.simulation.progress.pet) return;
    this.companion.visible = false;
    let companion = this.companions.get(pet);
    if (!companion) { companion = createPet(pet); this.companions.set(pet, companion); this.scene.add(companion); }
    companion.visible = true; this.companion = companion;
    const petStart = resolveCircle({ x: this.simulation.player.x - 2, z: this.simulation.player.z + 1 }, .3, this.simulation.colliders, this.simulation.boxColliders);
    this.companion.position.set(petStart.x, groundHeight(petStart.x, petStart.z), petStart.z);
    this.simulation.setPet(pet);
    this.publish();
  }
  /** Return both hero and companion to the handcrafted camp without a long cross-map pet path. */
  returnToCamp() {
    if (this.simulation.combat) return;
    this.simulation.player.x = -18; this.simulation.player.z = 31.2;
    const petStart = resolveCircle({ x: -20.2, z: 32.3 }, .3, this.simulation.colliders, this.simulation.boxColliders);
    this.companion.position.set(petStart.x, groundHeight(petStart.x, petStart.z), petStart.z);
    this.world.updateStreaming(this.simulation.player, true);
    this.simulation.rest(); this.updateCamera(.1, true); this.publish();
  }
  reset() {
    this.blur(); this.simulation.newHunt(); this.yaw = -.07; this.pitch = .07; this.elapsed = 0; this.shake = 0;
    this.damage.forEach(d => d.element.remove()); this.damage = [];
    this.rebuildMonster();
    this.companion.position.set(-2, groundHeight(-2, 21), 21); this.audio.setWeather('晴夜');
    this.world.updateStreaming(this.simulation.player, true);
    this.updateCamera(.1, true); this.publish();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.world.dispose(); this.resizeObserver?.disconnect(); window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur); document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pointermove', this.pointerMove); window.removeEventListener('pointerup', this.pointerUp);
    const canvas = this.renderer.domElement; canvas.removeEventListener('pointerdown', this.pointerDown); canvas.removeEventListener('contextmenu', this.contextMenu); canvas.removeEventListener('wheel', this.wheel); canvas.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) { geometries.add(object.geometry); const ms = Array.isArray(object.material) ? object.material : [object.material]; ms.forEach((m: THREE.Material) => materials.add(m)); } });
    materials.forEach(m => { Object.values(m).forEach(v => { if (v instanceof THREE.Texture) textures.add(v); }); if (m instanceof THREE.ShaderMaterial) Object.values(m.uniforms).forEach(u => { if (u.value instanceof THREE.Texture) textures.add(u.value); }); m.dispose(); });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose(); this.renderer.forceContextLoss(); this.audio.dispose();
    this.damage.forEach(d => d.element.remove()); this.targetMarker.remove(); canvas.remove();
  }
}
