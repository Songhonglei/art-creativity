import { disposeHero } from './heroModel';
import * as THREE from 'three';
import { Simulation, SAVE_KEY, readProgress, clamp, ROSTER } from './simulation';
import { groundHeight, makeMaterials, canvasTexture } from './materials';
import type { Materials } from './materials';
import { createMonster, createHunter, createPet } from './creatures';
import { World } from './world';
import { followPet, resolveCircle, hasLineOfSight } from './collision';
import { CAMERA, CameraGesture, orbitPosition, cameraSafeFraction } from './camera';
import { GameAudio } from './audio';
import { routeFootprints } from './petNavigation';
import type { GameEvent, MonsterKind, Pet, Point, Progress, Settings, Gender, Skin, Snapshot } from './types';
import { RECOVERY } from './recovery';

export type Shortcut = 'map' | 'guide' | 'forge' | 'settings' | 'help' | 'pets' | 'escape';
interface EngineCallbacks { snapshot: (s: Snapshot) => void; ready: () => void; error: (s: string) => void; shortcut: (key: Shortcut) => void; progress: (n: number) => void }
interface DamageText { element: HTMLDivElement; position: THREE.Vector3; life: number }
const pixelRatio = (settings: Settings, software: boolean) => Math.min(window.devicePixelRatio,
  software ? settings.quality === 'high' ? .8 : settings.quality === 'balanced' ? .65 : .5
    : settings.quality === 'high' ? 1.5 : settings.quality === 'balanced' ? 1 : .8);

export class Engine {
  simulation: Simulation;
  readonly storageLabel: string;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene = new THREE.Scene();
  audio = new GameAudio();
  settings: Settings;
  private orbit = new CameraGesture();
  get yaw() { return this.orbit.yaw; }
  set yaw(value: number) { this.orbit.yaw = value; }
  get pitch() { return this.orbit.pitch; }
  set pitch(value: number) { this.orbit.pitch = clamp(value, CAMERA.minPitch, CAMERA.maxPitch); }
  get cameraDistance() { return this.orbit.distance; }
  set cameraDistance(value: number) { this.orbit.distance = clamp(value, CAMERA.minDistance, CAMERA.maxDistance); }
  private world: World;
  private hunter: ReturnType<typeof createHunter>;
  private hunters = new Map<string, ReturnType<typeof createHunter>>();
  private monster: ReturnType<typeof createMonster>;
  private monsters = new Map<MonsterKind, ReturnType<typeof createMonster>>();
  private streetModels = new Map<string, ReturnType<typeof createMonster>>();
  private streetSlots: (ReturnType<typeof createMonster> | undefined)[] = [];
  private streetKinds: MonsterKind[] = [];
  private companion: THREE.Group;
  private companions = new Map<string, THREE.Group>();
  private companionKey = '';
  private petFootprints = new THREE.InstancedMesh(new THREE.SphereGeometry(.10, 6, 4), new THREE.MeshBasicMaterial({ color: '#62d8df', toneMapped: false }), 28);
  private petMarker = new THREE.Mesh(new THREE.OctahedronGeometry(.14), new THREE.MeshBasicMaterial({ color: '#8cdee4', wireframe: true }));
  private supplyMarker = new THREE.Mesh(new THREE.OctahedronGeometry(.12), new THREE.MeshBasicMaterial({ color: '#ead29a' }));
  private petShield = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#e2c77a', transparent: true, opacity: .16, wireframe: true, depthWrite: false }));
  private lastPetRoute: Point[] | null = null;
  private petMatrix = new THREE.Object3D();
  private keys = new Set<string>();
  private touch = { x: 0, z: 0, sprint: false };
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
  private hitBurst: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private hitLife = 0; private hitDuration = .2; private hitHeavy = false;
  private hitReactions: { x: number; z: number; life: number; heavy: boolean }[] = [];
  private enemyBars: HTMLDivElement[] = [];
  private loading = false;
  private pausedFrame = 0;
  private softwareRenderer = false;
  private contactShadows: THREE.Mesh[] = [];
  private deathElapsed = 0; private riseElapsed = RECOVERY.riseSeconds as number;
  private recoveryRing = new THREE.Mesh(new THREE.RingGeometry(.75, .78, 48), new THREE.MeshBasicMaterial({ color: '#8bcfc0', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  private systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(container: HTMLDivElement, settings: Settings, callbacks: EngineCallbacks, storage?: { progress: Progress; save: (progress: Progress) => void | Promise<void>; label: string }) {
    this.container = container; this.callbacks = callbacks; this.settings = settings;
    let saved: string | null = null;
    if (!storage) { try { saved = localStorage.getItem(SAVE_KEY); } catch { /* The App normally provides its validated storage adapter. */ } }
    this.storageLabel = storage?.label ?? '本机浏览器';
    this.simulation = new Simulation(storage?.progress ?? readProgress(saved), e => this.onEvent(e), storage?.save ?? (p => localStorage.setItem(SAVE_KEY, JSON.stringify(p))));
    // App releases the initial pause after loading and the welcome/recovery screen.
    this.simulation.paused = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const gl = this.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.softwareRenderer = Boolean(debug && /swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    this.renderer.setPixelRatio(pixelRatio(settings, this.softwareRenderer));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = !this.softwareRenderer && settings.quality === 'high'; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '沪上游侠：拖动场景环顾，滚轮或双指缩放。W A S D 或左下摇杆移动，点击或 J 攻击，空格键闪避，V 镜头归位。');
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
    this.hunter = createHunter(materials, this.simulation.progress.skin, this.simulation.progress.gender); this.hunters.set(`${this.simulation.progress.skin}:${this.simulation.progress.gender ?? 'male'}`, this.hunter);
    this.monster = createMonster(this.simulation.monster.kind, materials); this.monsters.set(this.simulation.monster.kind, this.monster);
    this.companionKey = `${this.simulation.progress.pet}:${this.simulation.petGrowth.skin}`;
    this.companion = createPet(this.simulation.progress.pet, this.simulation.petGrowth.skin); this.companions.set(this.companionKey, this.companion);
    this.petFootprints.count = 0; this.petFootprints.frustumCulled = false; this.petMarker.visible = this.supplyMarker.visible = this.petShield.visible = false;
    this.scene.add(this.petFootprints, this.petMarker, this.supplyMarker, this.petShield);
    this.scene.add(this.hunter.root, this.monster.root, this.companion);
    this.recoveryRing.rotation.x = -Math.PI / 2; this.recoveryRing.visible = false; this.scene.add(this.recoveryRing);
    if (this.softwareRenderer) {
      const texture = canvasTexture((ctx, size) => { const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2); g.addColorStop(0, 'rgba(10,14,24,.65)'); g.addColorStop(.4, 'rgba(10,14,24,.38)'); g.addColorStop(1, 'rgba(10,14,24,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); }, 64);
      for (const scale of [[1.8, 2.5], [7, 10], [1.2, 1.5]]) {
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(scale[0], scale[1]), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
        shadow.rotation.x = -Math.PI / 2; this.scene.add(shadow); this.contactShadows.push(shadow);
      }
    }
    this.companion.position.set(this.simulation.player.x - 2, 0, this.simulation.player.z + 1);
    this.dangerRing = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.84, 80), new THREE.MeshBasicMaterial({ color: '#ff7a9c', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); this.dangerRing.rotation.x = -Math.PI / 2; this.scene.add(this.dangerRing);
    this.slash = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.9, 40, 1, 0, Math.PI * 1.25), new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); this.scene.add(this.slash);
    this.hitBurst = new THREE.Mesh(new THREE.RingGeometry(.18, .26, 20), new THREE.MeshBasicMaterial({ color: '#ffd796', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); this.scene.add(this.hitBurst);
    for (let i = 0; i < 4; i++) {
      const bar = document.createElement('div'); bar.className = 'enemy-healthbar';
      bar.innerHTML = '<span class="enemy-bar-name"></span><span class="enemy-bar-track"><i></i></span>';
      bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.style.display = 'none';
      container.appendChild(bar); this.enemyBars.push(bar);
    }
    this.targetMarker = document.createElement('div'); this.targetMarker.className = 'world-target'; this.targetMarker.innerHTML = '<span class="target-diamond"></span><span class="target-distance"></span>'; container.appendChild(this.targetMarker);
    if (typeof ResizeObserver !== 'undefined') { this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(container); }
    else window.addEventListener('resize', this.resize);
    this.resize();
    this.updateCamera(.1, true);
    this.bindEvents(); this.audio.setVolume(settings.volume, settings.sound); this.audio.setSoundscape(settings.soundscape); this.audio.setWeather(this.simulation.weather);
    callbacks.snapshot(this.simulation.snapshot());
    if (new URLSearchParams(location.search).has('qa')) Object.defineProperty(window, '__originalQa', { configurable: true, get: () => ({
      snapshot: this.simulation.snapshot(), player: { ...this.simulation.player },
      pet: { x: this.companion.position.x, z: this.companion.position.z },
      circles: this.simulation.colliders.map(c => ({ ...c })), boxes: this.simulation.boxColliders.map(b => ({ ...b })),
      stream: this.world.streamingStats,
      audio: this.audio.audioDebug,
      cityFeature: this.world.nearestCityFeature(this.simulation.player),
      appearance: { gender: this.simulation.progress.gender ?? 'male', heroModels: this.hunters.size, skin: this.simulation.progress.skin, weapon: this.simulation.progress.weapon, pet: this.simulation.progress.pet, petSkin: this.simulation.petGrowth.skin, petModel: this.companion.name, petModels: this.companions.size, petFootprints: this.petFootprints.count, petMarkVisible: this.petMarker.visible, model: this.hunter.root.name, monsterVisible: this.monster.root.visible, streetModels: this.streetModels.size, streetVisible: this.streetSlots.filter(model => model?.root.visible).length, streetKinds: [...this.streetKinds] },
      street: this.simulation.streetEnemies.map(enemy => ({ ...enemy })),
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, yaw: this.yaw, pitch: this.pitch, distance: this.cameraDistance, contacts: this.orbit.count, target: this.target.clone(), targetDistance: this.camera.position.distanceTo(this.target), safeFraction: cameraSafeFraction(this.target, this.camera.position, this.simulation.boxColliders, this.simulation.colliders, groundHeight) },
      render: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures },
      placePlayer: (x: number, z: number) => { this.simulation.player.x = x; this.simulation.player.z = z; this.world.updateStreaming(this.simulation.player, true); },
      placePet: (x: number, z: number) => { this.companion.position.x = x; this.companion.position.z = z; },
      setView: (yaw: number, pitch: number, distance: number) => { this.yaw = yaw; this.pitch = pitch; this.cameraDistance = distance; this.updateCamera(.1, true); },
      attack: () => { this.simulation.attack(); this.publish(); },
      interact: () => { this.simulation.interact(); this.publish(); },
      petSkill: () => { this.simulation.petSkill(); this.publish(); },
      step: (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) this.simulation.tick(1 / 60, { x: 0, z: 0, sprint: false }); this.publish(); },
      heroModel: () => this.hunter.root,
      setSkin: (skin: Skin) => this.setSkin(skin),
      freeze: () => { this.simulation.paused = true; },
    }) });

    void Promise.resolve().then(() => { if (!this.disposed) { this.loading = false; callbacks.progress(100); callbacks.ready(); } });
    this.raf = requestAnimationFrame(this.loop);
  }
  private resize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h) return;
    this.releaseCameraPointers(); this.touch = { x: 0, z: 0, sprint: false };
    this.renderer.setSize(w, h); this.camera.aspect = w / h;
    this.camera.fov = w / h < .7 ? 65 : w / h > 1.65 && h < 600 ? 57 : 52;
    this.camera.updateProjectionMatrix();
  }
  private bindEvents() {
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur); window.addEventListener('pagehide', this.checkpoint); document.addEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown); window.addEventListener('pointermove', this.pointerMove); window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('pointercancel', this.pointerCancel); this.renderer.domElement.addEventListener('lostpointercapture', this.pointerCancel);
    this.renderer.domElement.addEventListener('contextmenu', this.contextMenu); this.renderer.domElement.addEventListener('wheel', this.wheel, { passive: false });
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
  }
  private keyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); this.callbacks.shortcut('escape'); return; }
    if (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.target instanceof HTMLButtonElement && ['Space', 'Enter'].includes(e.code)) return;
    const shortcuts: Record<string, Shortcut> = { KeyM: 'map', KeyG: 'guide', KeyF: 'forge', KeyH: 'help', KeyP: 'pets', Escape: 'escape' };
    if (shortcuts[e.code] && !e.repeat) { e.preventDefault(); this.callbacks.shortcut(shortcuts[e.code]); return; }
    if (this.simulation.paused) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    this.audio.unlock(); this.keys.add(e.code);
    if (e.repeat) return;
    switch (e.code) { case 'Space': this.simulation.dodge(); break; case 'KeyJ': this.simulation.attack(); break; case 'KeyK': this.simulation.attack(true); break; case 'KeyE': this.simulation.interact(); break; case 'KeyR': case 'Digit1': this.simulation.heal(); break; case 'KeyQ': this.simulation.toggleLock(); break; case 'KeyC': this.simulation.petSkill(); break; case 'KeyV': this.resetCamera(); break; }
    this.publish();
  };
  private keyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private releaseCameraPointers() {
    this.orbit.cancel();
    for (const id of this.capturedPointers) {
      if (this.renderer.domElement.hasPointerCapture?.(id)) this.renderer.domElement.releasePointerCapture(id);
    }
    this.capturedPointers.clear();
  }
  private capturedPointers = new Set<number>();
  private blur = () => { this.keys.clear(); this.touch = { x: 0, z: 0, sprint: false }; this.releaseCameraPointers(); };
  private checkpoint = () => this.simulation.persist();
  private visibility = () => { this.blur(); this.lastTime = 0; if (document.hidden) this.simulation.persist(); };
  private pointerDown = (e: PointerEvent) => {
    if (this.simulation.paused) return;
    if (!this.orbit.begin({ id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button })) return;
    e.preventDefault(); this.audio.unlock();
    // Window listeners remain the fallback on WebViews without pointer capture.
    try { this.renderer.domElement.setPointerCapture?.(e.pointerId); this.capturedPointers.add(e.pointerId); } catch { /* The contact may already have ended. */ }
  };
  private pointerMove = (e: PointerEvent) => {
    if (this.simulation.paused) return;
    this.orbit.move(e.pointerId, e.clientX, e.clientY, this.settings.sensitivity, Math.min(this.container.clientWidth, this.container.clientHeight));
  };
  private finishPointer(e: PointerEvent, cancelled: boolean) {
    // Include the last coordinates even if the browser coalesced the final move.
    if (!cancelled && !this.simulation.paused) this.pointerMove(e);
    const action = this.orbit.end(e.pointerId, cancelled || this.simulation.paused);
    this.capturedPointers.delete(e.pointerId);
    if (this.renderer.domElement.hasPointerCapture?.(e.pointerId)) this.renderer.domElement.releasePointerCapture(e.pointerId);
    if (action) this.action(action);
  }
  private pointerUp = (e: PointerEvent) => this.finishPointer(e, false);
  private pointerCancel = (e: PointerEvent) => this.finishPointer(e, true);
  private contextMenu = (e: Event) => e.preventDefault();
  private wheel = (e: WheelEvent) => {
    e.preventDefault(); if (this.simulation.paused) return;
    const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.container.clientHeight : 1);
    this.orbit.zoom(Math.exp(clamp(pixels * .0015, -.7, .7)));
  };
  private contextLost = (e: Event) => { e.preventDefault(); this.setPaused(true); this.loading = true; this.callbacks.error('图形连接中断，请重新加载。已保存的进度可以恢复。'); };

  private onEvent(e: GameEvent) {
    if (e.type === 'fall') {
      this.deathElapsed = 0; this.shake = 0; this.hitLife = 0; this.hitReactions = []; this.blur();
      this.simulation.paused = true; this.audio.setEnvironmentActive(false);
      this.damage.forEach(d => d.element.remove()); this.damage = [];
    }
    if (e.type === 'revive') this.riseElapsed = 0;
    this.audio.play(e, e.x !== undefined && e.z !== undefined ? Math.hypot(e.x - this.simulation.player.x, e.z - this.simulation.player.z) : 0);
    if (e.type === 'hurt' || e.type === 'hit') { this.shake = e.type === 'hurt' ? .16 : e.heavy ? .14 : .045; }
    if (e.type === 'hit' && this.container) {
      const element = document.createElement('div'); element.className = `damage-number${e.heavy ? ' heavy-hit' : ''}${e.blocked ? ' blocked-hit' : ''}`; element.textContent = `${e.blocked ? '格挡 ' : e.heavy ? '重击 ' : ''}${e.value}`; this.container.appendChild(element);
      const height = e.kind === 'cat' || e.kind === 'dog' ? 1.5 : 2.3;
      this.damage.push({ element, position: new THREE.Vector3(e.x ?? 0, groundHeight(e.x ?? 0, e.z ?? 0) + height, e.z ?? 0), life: 1.15 });
      this.hitHeavy = Boolean(e.heavy); this.hitDuration = e.heavy ? .26 : .17; this.hitLife = this.hitDuration;
      this.hitBurst.position.set(e.x ?? 0, groundHeight(e.x ?? 0, e.z ?? 0) + height * .65, e.z ?? 0);
      this.hitBurst.material.color.set(e.blocked ? '#b4d5ff' : e.heavy ? '#ffc773' : '#def9ff');
      this.hitReactions.push({ x: e.x ?? 0, z: e.z ?? 0, life: .2, heavy: Boolean(e.heavy) }); this.hitReactions = this.hitReactions.slice(-4);
    }
    if (e.type === 'weather') this.audio.setWeather(this.simulation.weather);
  }
  private loop = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) { this.lastTime = 0; return; }
    const dt = this.lastTime ? clamp((now - this.lastTime) / 1000, 0, .25) : 1 / 60; this.lastTime = now;
    if (this.loading) return;
    const sim = this.simulation;
    if (sim.dead) this.deathElapsed = Math.min(RECOVERY.deathSeconds, this.deathElapsed + dt);
    else if (!sim.paused) this.riseElapsed = Math.min(RECOVERY.riseSeconds, this.riseElapsed + dt);
    if (!sim.dead) this.world.updateStreaming(sim.player);
    if (sim.paused && (!sim.dead || this.deathElapsed >= RECOVERY.deathSeconds)) { this.pausedFrame += dt; if (this.pausedFrame < .15) return; this.pausedFrame = 0; }
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
    if (this.cityAudioTimer > .15) {
      const feature = this.world.nearestCityFeature(sim.player); this.audio.setCityFeature(feature.kind, feature.distance);
      const animals = [...sim.streetEnemies, ...(sim.targetRevealed ? [sim.monster] : [])]
        .filter(enemy => enemy.health > 0 && (enemy.kind === 'cat' || enemy.kind === 'dog'))
        .map(enemy => ({ kind: enemy.kind, distance: Math.hypot(enemy.x - sim.player.x, enemy.z - sim.player.z) })).sort((a, b) => a.distance - b.distance);
      const animal = animals[0];
      this.audio.setNearbyCreature(animal?.kind === 'cat' || animal?.kind === 'dog' ? animal.kind : null, animal?.distance ?? Infinity);
      this.cityAudioTimer = 0;
    }
    this.audio.updateCity(dt);
    const reducedMotion = this.settings.reducedMotion || this.systemReducedMotion.matches;
    this.hunter.root.position.y = groundHeight(sim.player.x, sim.player.z);
    this.hunter.update(sim, t, visualDt, { death: this.deathElapsed, rise: this.riseElapsed, reducedMotion }); this.monster.update(sim, t, visualDt);
    this.recoveryRing.visible = !sim.dead && !reducedMotion && sim.recoveryProtection > 0;
    this.recoveryRing.position.set(sim.player.x, groundHeight(sim.player.x, sim.player.z) + .07, sim.player.z);
    this.recoveryRing.scale.setScalar(1 + Math.min(1, this.riseElapsed / RECOVERY.riseSeconds) * .65);
    this.recoveryRing.material.opacity = .34 * Math.min(1, sim.recoveryProtection / .7);
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
    this.hitReactions.forEach(hit => {
      const actor = Math.hypot(sim.monster.x - hit.x, sim.monster.z - hit.z) < 1 ? this.monster
        : this.streetSlots[sim.streetEnemies.findIndex(enemy => Math.hypot(enemy.x - hit.x, enemy.z - hit.z) < 1)];
      if (actor?.root.children[0]) actor.root.children[0].rotation.x -= hit.life / .2 * (hit.heavy ? .25 : .1);
      hit.life -= visualDt;
    });
    this.hitReactions = this.hitReactions.filter(hit => hit.life > 0);
    if (this.contactShadows.length > 1) this.contactShadows[1].visible = sim.targetRevealed;
    this.monster.root.position.y = groundHeight(sim.monster.x, sim.monster.z);
    this.syncCompanion();
    const petBefore = { x: this.companion.position.x, z: this.companion.position.z };
    const petNext = followPet(petBefore, sim.player, visualDt * (sim.rescueTime > 0 ? 3 : 1), sim.colliders, sim.boxColliders);
    this.companion.position.x = petNext.x; this.companion.position.z = petNext.z;
    const petMoveX = petNext.x - petBefore.x, petMoveZ = petNext.z - petBefore.z;
    if (Math.hypot(petMoveX, petMoveZ) > .0001) this.companion.rotation.y = Math.atan2(petMoveX, petMoveZ);
    this.companion.position.y = groundHeight(petNext.x, petNext.z) + (sim.player.moving ? Math.abs(Math.sin(t * 9)) * .14 : 0) + (sim.petAnimation > 0 && !this.settings.reducedMotion ? Math.sin(sim.petAnimation / .7 * Math.PI) * .18 : 0);
    this.companion.rotation.z = sim.rescueTime > 0 ? -.15 : 0;
    this.updatePetVisuals(t);
    this.contactShadows.forEach((shadow, i) => { const actor = [this.hunter.root, this.monster.root, this.companion][i]; shadow.position.copy(actor.position); shadow.position.y += .06; shadow.rotation.z = -actor.rotation.y; });
    const warning = [sim.monster, ...sim.streetEnemies].filter(m => m.health > 0 && m.action === 'windup').sort((a, b) => Math.hypot(a.x - sim.player.x, a.z - sim.player.z) - Math.hypot(b.x - sim.player.x, b.z - sim.player.z))[0];
    const m = warning ?? sim.monster; this.dangerRing.position.set(m.x, groundHeight(m.x, m.z) + .09, m.z); this.dangerRing.material.opacity = !sim.dead && warning ? .3 + Math.sin(t * 12) * .15 : 0;
    const p = sim.player, swingTime = p.attackDuration - p.attackTime - p.attackImpact;
    this.slash.position.set(p.x + Math.sin(p.facing) * .7, groundHeight(p.x, p.z) + 1.1, p.z + Math.cos(p.facing) * .7);
    this.slash.rotation.set(p.attackWeapon === 'crowbar' && p.attackHeavy ? 0 : -Math.PI * .45, p.facing + (p.attackWeapon === 'crowbar' && p.attackHeavy ? Math.PI / 2 : 0), p.combo % 2 ? -.3 : .3);
    this.slash.scale.setScalar(p.attackHeavy ? 1.12 : .72);
    this.slash.material.color.set(p.attackHeavy ? '#ffd18c' : p.attackWeapon === 'umbrella' ? '#dfbfff' : '#bfe6ff');
    this.slash.material.opacity = p.attackTime > 0 && swingTime > -.045 && swingTime < .16 ? Math.sin((swingTime + .045) / .205 * Math.PI) * (p.attackHeavy ? .65 : .3) : 0;
    if (!sim.paused) this.hitLife = Math.max(0, this.hitLife - dt);
    const burst = this.hitLife / this.hitDuration; this.hitBurst.material.opacity = sim.dead ? 0 : burst * .8;
    this.hitBurst.scale.setScalar((1 - burst) * (this.hitHeavy ? 6 : 3) + 1); this.hitBurst.quaternion.copy(this.camera.quaternion);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera); this.updateMarkers(dt);
    this.hudTimer += dt; if (this.hudTimer > .1) { this.publish(); this.hudTimer = 0; }
  };
  private updateCamera(dt: number, instant = false) {
    const p = this.simulation.player, m = this.simulation.monster;
    if (this.simulation.locked && m.health > 0) this.orbit.followLock(Math.atan2(p.x - m.x, p.z - m.z), dt);
    const y = groundHeight(p.x, p.z);
    this.target.set(p.x, y + 1.55, p.z);
    const position = orbitPosition(this.target, this.yaw, this.pitch, this.cameraDistance + (p.sprinting ? .45 : 0));
    this.desiredCamera.set(position.x, position.y, position.z);
    const fraction = cameraSafeFraction(this.target, this.desiredCamera, this.simulation.boxColliders, this.simulation.colliders, groundHeight);
    this.desiredCamera.lerp(this.target, 1 - fraction);
    const blend = instant || fraction < 1 ? 1 : 1 - Math.exp(-dt * 7);
    this.camera.position.lerp(this.desiredCamera, blend);
    if (!this.settings.reducedMotion && !this.systemReducedMotion.matches && this.shake > 0) { this.camera.position.x += (Math.random() - .5) * this.shake; this.camera.position.y += (Math.random() - .5) * this.shake; }
    const safe = cameraSafeFraction(this.target, this.camera.position, this.simulation.boxColliders, this.simulation.colliders, groundHeight);
    this.camera.position.lerp(this.target, 1 - safe);
    this.shake = Math.max(0, this.shake - dt * .5);
    this.camera.lookAt(this.target);
  }
  private updateMarkers(dt: number) {
    const width = this.container.clientWidth, height = this.container.clientHeight, sim = this.simulation;
    const show = sim.targetRevealed && sim.monster.health > 0 && !sim.dead;
    this.projected.set(sim.monster.x, groundHeight(sim.monster.x, sim.monster.z) + (sim.monster.kind === 'cat' || sim.monster.kind === 'dog' ? 2.2 : 2.9), sim.monster.z).project(this.camera);
    this.targetMarker.style.display = show && this.projected.z < 1 && Math.abs(this.projected.x) < .94 && Math.abs(this.projected.y) < .9 ? 'flex' : 'none';
    this.targetMarker.style.transform = `translate(${(this.projected.x * .5 + .5) * width}px,${(-this.projected.y * .5 + .5) * height}px) translate(-50%,-100%)`;
    this.targetMarker.classList.toggle('is-locked', sim.locked);
    this.targetMarker.children[1].textContent = `${Math.round(Math.hypot(sim.player.x - sim.monster.x, sim.player.z - sim.monster.z))} 米`;
    const enemies = [...sim.streetEnemies, sim.monster];
    this.enemyBars.forEach((bar, i) => {
      const enemy = enemies[i], main = i === 3, distance = Math.hypot(enemy.x - sim.player.x, enemy.z - sim.player.z);
      const labelHeight = enemy.kind === 'cat' || enemy.kind === 'dog' ? 1.7 : 2.35;
      this.projected.set(enemy.x, groundHeight(enemy.x, enemy.z) + labelHeight, enemy.z).project(this.camera);
      const visible = this.settings.enemyHealthBars && !sim.dead && enemy.health > 0 && (!main || sim.targetRevealed) && distance < 30 && this.projected.z > -1 && this.projected.z < 1 && Math.abs(this.projected.x) < .9 && Math.abs(this.projected.y) < .7 && hasLineOfSight(sim.player, enemy, sim.boxColliders);
      bar.style.display = visible ? 'flex' : 'none'; if (!visible) return;
      bar.style.transform = `translate(${(this.projected.x * .5 + .5) * width}px,${(-this.projected.y * .5 + .5) * height}px) translate(-50%,-100%)`;
      bar.children[0].textContent = main ? sim.monsterName : (ROSTER.find(entry => entry.kind === enemy.kind)?.name ?? '游荡目标');
      (bar.children[1].children[0] as HTMLElement).style.transform = `scaleX(${enemy.health / enemy.maxHealth})`;
      bar.setAttribute('aria-label', `${bar.children[0].textContent}气血`); bar.setAttribute('aria-valuemax', String(enemy.maxHealth)); bar.setAttribute('aria-valuenow', String(Math.ceil(enemy.health)));
    });
    this.damage = this.damage.filter(d => {
      if (!sim.paused) d.life -= dt;
      if (d.life <= 0) { d.element.remove(); return false; }
      d.position.y += dt * .75; this.projected.copy(d.position).project(this.camera);
      d.element.style.transform = `translate(${(this.projected.x * .5 + .5) * width}px,${(-this.projected.y * .5 + .5) * height}px)`;
      d.element.style.opacity = String(Math.min(1, d.life * 2)); return true;
    });
  }
  private updatePetVisuals(t: number) {
    const sim = this.simulation;
    if (this.lastPetRoute !== sim.petGuide) {
      this.lastPetRoute = sim.petGuide;
      const points = routeFootprints(sim.petGuide); this.petFootprints.count = points.length;
      points.forEach((p, i) => {
        const next=points[Math.min(i+1,points.length-1)], previous=points[Math.max(0,i-1)], yaw=Math.atan2(next.x-previous.x,next.z-previous.z), offset=i%2?.10:-.10;
        this.petMatrix.position.set(p.x+Math.cos(yaw)*offset,groundHeight(p.x,p.z)+.10,p.z-Math.sin(yaw)*offset);
        this.petMatrix.scale.set(.7,.16,1.25); this.petMatrix.rotation.set(0,yaw,0); this.petMatrix.updateMatrix(); this.petFootprints.setMatrixAt(i,this.petMatrix.matrix);
      });
      this.petFootprints.instanceMatrix.needsUpdate = true;
    }
    this.petFootprints.visible = sim.petEffects.guideTime > 0 && !sim.dead;
    const target = sim.markedTarget;
    this.petMarker.visible = Boolean(sim.petEffects.markTime > 0 && target && target.health > 0 && !sim.dead);
    if (target) { this.petMarker.position.set(target.x, groundHeight(target.x,target.z) + (target.kind === 'cat' || target.kind === 'dog' ? 1.5 : 2.2),target.z); this.petMarker.rotation.y = this.settings.reducedMotion ? 0 : t; }
    const supply = sim.petSupply; this.supplyMarker.visible = Boolean(supply && !supply.collected && sim.petEffects.guideTime > 0 && !sim.dead);
    if (supply) this.supplyMarker.position.set(supply.x,groundHeight(supply.x,supply.z)+.9,supply.z);
    this.petShield.visible = !sim.dead && (sim.petEffects.shield > 0 || sim.rescueTime > 0);
    this.petShield.position.set(sim.player.x,groundHeight(sim.player.x,sim.player.z)+1,sim.player.z); this.petShield.scale.set(.65,1,.65);
  }
  publish() { const snapshot = this.simulation.snapshot(); snapshot.heading = ((-this.yaw * 180 / Math.PI) % 360 + 360) % 360; this.callbacks.snapshot(snapshot); }
  setPaused(paused: boolean) { if (paused && !this.simulation.paused) this.simulation.persist(); this.simulation.paused = paused; this.audio.setEnvironmentActive(!paused); this.blur(); this.publish(); }
  resetCamera() {
    this.releaseCameraPointers();
    const sim = this.simulation;
    this.orbit.reset(sim.locked && sim.monster.health > 0 ? Math.atan2(sim.monster.x - sim.player.x, sim.monster.z - sim.player.z) : sim.player.facing);
    this.updateCamera(.1, true); this.publish();
  }
  setSettings(settings: Settings) {
    const renderChanged = this.settings.quality !== settings.quality || this.settings.reducedMotion !== settings.reducedMotion;
    this.settings = settings; this.audio.setVolume(settings.volume, settings.sound); this.audio.setSoundscape(settings.soundscape);
    this.updateMarkers(0);
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
  /** Cache at most two complete outfits; private resources can be safely evicted. */
  private syncHunter() {
    const { skin, gender = 'male' } = this.simulation.progress, key = `${skin}:${gender}`;
    if (this.hunter.root.name === `hunter:${skin}:${gender}`) return;
    this.hunter.root.visible = false;
    let hunter = this.hunters.get(key);
    if (!hunter) { hunter = createHunter(this.materials, skin, gender); this.hunters.set(key, hunter); this.scene.add(hunter.root); }
    hunter.root.visible = true; this.hunter = hunter;
    for (const [oldKey, old] of this.hunters) if (this.hunters.size > 2 && oldKey !== key) { this.scene.remove(old.root); disposeHero(old.root); this.hunters.delete(oldKey); }
  }
  setSkin(skin: Skin) { if (!this.simulation.setSkin(skin)) return false; this.syncHunter(); this.publish(); return true; }
  setGender(gender: Gender) { if (!this.simulation.setGender(gender)) return false; this.syncHunter(); this.publish(); return true; }
  /** A bounded cache of at most twelve authored companion outfits. */
  private syncCompanion() {
    const sim = this.simulation, key = `${sim.progress.pet}:${sim.petGrowth.skin}`;
    if (key === this.companionKey) return;
    const position = this.companion.position.clone(), rotation = this.companion.rotation.clone(); this.companion.visible = false;
    let model = this.companions.get(key);
    if (!model) { model = createPet(sim.progress.pet, sim.petGrowth.skin); this.companions.set(key, model); this.scene.add(model); }
    this.companion = model; this.companion.position.copy(position); this.companion.rotation.copy(rotation); this.companion.visible = true; this.companionKey = key;
  }
  setPet(pet: Pet) { if (this.simulation.setPet(pet)) { this.syncCompanion(); this.publish(); } }
  setPetSkin(pet: Pet, skin: string) { if (this.simulation.setPetSkin(pet,skin)) { this.syncCompanion(); this.publish(); } }
  returnToCamp() {
    if (!this.simulation.returnToCamp()) return;
    this.blur();
    this.world.updateStreaming(this.simulation.player, true);
    const start = resolveCircle({ x: -20.2, z: 32.3 }, .3, this.simulation.colliders, this.simulation.boxColliders);
    this.companion.position.set(start.x, groundHeight(start.x,start.z), start.z);
    this.audio.setWeather(this.simulation.weather); this.updateCamera(.1,true); this.publish();
  }
  retryEncounter() {
    if (!this.simulation.dead) return false;
    this.blur();
    this.world.updateStreaming(this.simulation.recoveryOrigin, true);
    if (!this.simulation.retryEncounter()) return false;
    this.world.updateStreaming(this.simulation.player, true);
    const p = this.simulation.player;
    const start = resolveCircle({ x: p.x - 2.2, z: p.z + 1.1 }, .3, this.simulation.colliders, this.simulation.boxColliders);
    this.companion.position.set(start.x, groundHeight(start.x, start.z), start.z);
    this.yaw = p.facing + Math.PI; this.pitch = CAMERA.pitch; this.cameraDistance = CAMERA.distance;
    this.shake = this.hitLife = 0; this.hitReactions = [];
    this.damage.forEach(d => d.element.remove()); this.damage = [];
    this.updateCamera(.1, true); this.publish(); return true;
  }
  reset() {
    if (this.simulation.dead) { this.retryEncounter(); return; }
    if (this.simulation.questPhase !== 'complete') return;
    this.blur(); this.simulation.newHunt(); this.yaw = -.07; this.pitch = CAMERA.pitch; this.cameraDistance = CAMERA.distance; this.elapsed = 0; this.shake = 0;
    this.damage.forEach(d => d.element.remove()); this.damage = []; this.hitLife = 0; this.hitReactions = [];
    this.rebuildMonster();
    this.companion.position.set(-2, groundHeight(-2, 21), 21); this.audio.setWeather('晴夜');
    this.world.updateStreaming(this.simulation.player, true);
    this.updateCamera(.1, true); this.publish();
  }
  dispose() {
    this.disposed = true; this.blur(); cancelAnimationFrame(this.raf); this.world.dispose(); this.resizeObserver?.disconnect(); window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur); window.removeEventListener('pagehide', this.checkpoint); document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pointermove', this.pointerMove); window.removeEventListener('pointerup', this.pointerUp);
    window.removeEventListener('pointercancel', this.pointerCancel); this.renderer.domElement.removeEventListener('lostpointercapture', this.pointerCancel);
    const canvas = this.renderer.domElement; canvas.removeEventListener('pointerdown', this.pointerDown); canvas.removeEventListener('contextmenu', this.contextMenu); canvas.removeEventListener('wheel', this.wheel); canvas.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) { geometries.add(object.geometry); const ms = Array.isArray(object.material) ? object.material : [object.material]; ms.forEach((m: THREE.Material) => materials.add(m)); } });
    materials.forEach(m => { Object.values(m).forEach(v => { if (v instanceof THREE.Texture) textures.add(v); }); if (m instanceof THREE.ShaderMaterial) Object.values(m.uniforms).forEach(u => { if (u.value instanceof THREE.Texture) textures.add(u.value); }); m.dispose(); });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose(); this.renderer.forceContextLoss(); this.audio.dispose();
    this.damage.forEach(d => d.element.remove()); this.enemyBars.forEach(bar => bar.remove()); this.targetMarker.remove(); canvas.remove();
  }
}
