import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createIcons, Box, Info, PanelLeft, Search, SearchX, Keyboard, MousePointer2,
  Crosshair, Focus, Scan, Play, Pause, RotateCcw, X, TriangleAlert, ChevronRight,
} from 'lucide';
import { createMacBook, PART_INFO } from './model.js';

const iconSet = { Box, Info, PanelLeft, Search, SearchX, Keyboard, MousePointer2, Crosshair, Focus, Scan, Play, Pause, RotateCcw, X, TriangleAlert, ChevronRight };
const $ = (selector) => document.querySelector(selector);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  progress: 0, targetProgress: 0, playing: false, selected: null,
  query: '', category: '全部', cameraFollow: true, ready: false,
};

const aboutDialog = $('#about-dialog');
$('#about-open').addEventListener('click', () => aboutDialog.showModal());
$('#about-close').addEventListener('click', () => aboutDialog.close());
aboutDialog.addEventListener('click', (event) => {
  const r = aboutDialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) aboutDialog.close();
});
$('#panel-toggle').addEventListener('click', () => {
  const hidden = $('#app').classList.toggle('left-panel-hidden');
  $('#panel-toggle').setAttribute('aria-pressed', String(hidden));
  window.dispatchEvent(new Event('resize'));
});

function fallbackMatches() {
  const normalize = (value) => value.toLowerCase().replace(/[‑–—]/g, '-');
  const q = normalize(state.query.trim());
  return PART_INFO.filter((info) => {
    const inCategory = state.category === '全部' || info.category === state.category;
    const aliases = info.id.startsWith('usbc') ? 'type-c usb c 雷电 thunderbolt' : info.id === 'storage' ? '硬盘 ssd nand' : '';
    const haystack = normalize(`${info.name} ${info.en} ${info.material} ${info.note} ${aliases}`);
    return inCategory && (!q || haystack.includes(q));
  });
}
function showWebGLFallback(reason) {
  state.playing = false;
  $('#loading').hidden = true;
  $('#webgl-fallback').hidden = false;
  $('#viewport').classList.add('webgl-unavailable');
  $('#app').classList.add('webgl-unavailable');
  if (reason) $('#webgl-fallback-reason').textContent = reason;
  ['#play-toggle', '#layout-progress', '#camera-mode'].forEach((selector) => { $(selector).disabled = true; });
  document.querySelectorAll('.stage-jump').forEach((button) => { button.disabled = true; });
  createIcons({ icons: iconSet });
}
function initFallbackIndex() {
  const list = $('#parts-list');
  const render = () => {
    const matches = fallbackMatches();
    list.innerHTML = matches.map((info) => `
      <button class="part-item ${state.selected === info.id ? 'active' : ''}" data-part="${info.id}" aria-pressed="${state.selected === info.id}">
        <span class="item-index">${info.index}</span><span><strong>${info.name}</strong><small>${info.en}</small></span><i data-lucide="chevron-right"></i>
      </button>`).join('');
    $('#part-count').textContent = `${String(matches.length).padStart(2, '0')} / ${PART_INFO.length}`;
    $('#empty-state').hidden = matches.length > 0;
    list.hidden = matches.length === 0;
    list.querySelectorAll('[data-part]').forEach((button) => button.addEventListener('click', () => select(button.dataset.part)));
    createIcons({ icons: iconSet });
  };
  const select = (id) => {
    const info = PART_INFO.find((part) => part.id === id);
    if (!info) return;
    state.selected = id;
    $('#inspector').classList.add('has-selection');
    $('#viewport').classList.add('has-selection');
    $('#inspector-empty').hidden = true;
    $('#inspector-content').hidden = false;
    $('#detail-index').textContent = info.index;
    $('#detail-category').textContent = info.category;
    $('#detail-name').textContent = info.name;
    $('#detail-en').textContent = info.en;
    $('#detail-note').textContent = info.note;
    $('#detail-material').textContent = info.material;
    render();
  };
  const clear = () => {
    state.selected = null;
    $('#inspector').classList.remove('has-selection');
    $('#viewport').classList.remove('has-selection');
    $('#inspector-empty').hidden = false;
    $('#inspector-content').hidden = true;
    render();
  };
  const reset = () => {
    state.query = ''; state.category = '全部'; $('#part-search').value = '';
    $('#category-filters').querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.category === '全部'));
    clear();
  };
  $('#part-search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  $('#category-filters').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    $('#category-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
    render();
  }));
  $('#clear-search').addEventListener('click', () => { reset(); $('#part-search').focus(); });
  $('#clear-focus').addEventListener('click', clear);
  $('#reset-button').addEventListener('click', reset);
  window.addEventListener('keydown', (event) => {
    const editing = /INPUT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable;
    if (event.key === '/' && !editing && !aboutDialog.open) { event.preventDefault(); $('#part-search').focus(); }
    if (editing || aboutDialog.open) return;
    if (event.key === 'Escape') clear();
    if (event.code === 'KeyR' && !event.repeat) reset();
  });
  window.__WEBGL_AVAILABLE__ = false;
  window.__getState = () => ({
    progress: 0, targetProgress: 0, playing: false, selected: state.selected,
    matches: fallbackMatches().length, cameraFollow: false, pressedKeys: [],
    drawCalls: 0, triangles: 0, fps: 0, pixelRatio: 0, webgl: false,
  });
  render();
}

let renderer;
try {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
  if (!context) {
    showWebGLFallback();
    initFallbackIndex();
  } else {
    renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'high-performance' });
    window.__WEBGL_AVAILABLE__ = true;
  }
} catch {
  showWebGLFallback();
  initFallbackIndex();
}

if (renderer) {
const wrap = $('#canvas-wrap');
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(wrap.clientWidth, wrap.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'MacBook Pro 14 三维机械研究模型');
renderer.domElement.setAttribute('role', 'img');

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x0b1011);
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 110, 280);
const camera = new THREE.PerspectiveCamera(42, wrap.clientWidth / wrap.clientHeight, 0.1, 600);
camera.position.set(34, 27, 40);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, -2);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 190;
controls.maxPolarAngle = Math.PI / 2 - 0.015;
controls.addEventListener('start', () => {
  if (state.ready) setCameraFollow(false);
});

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
room.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xcbd8d1, 0x18201c, 1.65));
const keyLight = new THREE.DirectionalLight(0xfff1dc, 3.2);
keyLight.position.set(-25, 42, 28);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
Object.assign(keyLight.shadow.camera, { left: -58, right: 58, top: 58, bottom: -58, near: 1, far: 130 });
keyLight.shadow.normalBias = 0.035;
scene.add(keyLight);
const fill = new THREE.DirectionalLight(0xb8d1cb, 1.15);
fill.position.set(32, 18, -28);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2),
  new THREE.ShaderMaterial({
    uniforms: { uBase: { value: SKY }, uLine: { value: new THREE.Color(0x27322e) }, uMajor: { value: new THREE.Color(0x35443b) } },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform vec3 uBase; uniform vec3 uLine; uniform vec3 uMajor; varying vec3 vWorld;
      float grid(vec2 p,float s){ vec2 q=p/s; vec2 w=fwidth(q); vec2 a=abs(fract(q-.5)-.5)/w; return 1.0-min(min(a.x,a.y),1.0); }
      void main(){
        float minor=grid(vWorld.xz,2.0)*.38; float major=grid(vWorld.xz,10.0)*.52;
        vec3 c=mix(uBase,uLine,minor); c=mix(c,uMajor,major);
        float fade=1.0-smoothstep(45.0,190.0,length(vWorld.xz));
        gl_FragColor=vec4(mix(uBase,c,fade),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }),
);
ground.position.y = -4.25;
scene.add(ground);
const shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(180, 180).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.24 }));
shadowGround.position.y = -4.22;
shadowGround.receiveShadow = true;
scene.add(shadowGround);

const frameMat = new THREE.LineBasicMaterial({ color: 0xc8f56a, transparent: true, opacity: 0 });
const framePoints = [new THREE.Vector3(-48, 0, -27), new THREE.Vector3(48, 0, -27), new THREE.Vector3(48, 0, 27), new THREE.Vector3(-48, 0, 27)];
const ratioFrame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(framePoints), frameMat);
ratioFrame.position.y = -4.12;
scene.add(ratioFrame);

let seed = 1402025;
function rand() {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
const model = createMacBook(rand);
scene.add(model.root);
const partMap = new Map(model.parts.map((part) => [part.info.id, part]));
model.parts.forEach((part) => {
  part.meshes = [];
  part.group.traverse((obj) => { if (obj.isMesh) part.meshes.push(obj); });
});

const selectionBounds = new THREE.Box3();
const selectionHelper = new THREE.Box3Helper(selectionBounds, 0xc8f56a);
selectionHelper.material.transparent = true;
selectionHelper.material.opacity = 0.65;
selectionHelper.visible = false;
scene.add(selectionHelper);

const labelRoot = $('#labels');
const compactLabels = {
  soc: 'M5 SoC', magsafe: 'MagSafe 3', usbcLeft1: 'USB‑C ①', usbcLeft2: 'USB‑C ②',
  usbcRight: 'USB‑C ③', hdmi: 'HDMI', headphone: '3.5 mm', sdxc: 'SDXC',
};
model.parts.forEach((part) => {
  const el = document.createElement('div');
  el.className = 'part-label';
  el.innerHTML = `<span>${part.info.index}</span>${compactLabels[part.info.id] || part.info.name}`;
  labelRoot.appendChild(el);
  part.label = el;
});

function refreshIcons() { createIcons({ icons: iconSet }); }
const list = $('#parts-list');
function matchingParts() {
  const normalize = (value) => value.toLowerCase().replace(/[‑–—]/g, '-');
  const q = normalize(state.query.trim());
  return model.parts.filter(({ info }) => {
    const inCategory = state.category === '全部' || info.category === state.category;
    const aliases = info.id.startsWith('usbc') ? 'type-c usb c 雷电 thunderbolt' : info.id === 'storage' ? '硬盘 ssd nand' : '';
    const haystack = normalize(`${info.name} ${info.en} ${info.material} ${info.note} ${aliases}`);
    return inCategory && (!q || haystack.includes(q));
  });
}
function renderPartList() {
  const matches = matchingParts();
  const ids = new Set(matches.map((part) => part.info.id));
  model.parts.forEach((part) => { part.filterTarget = ids.has(part.info.id) ? 1 : (state.query || state.category !== '全部' ? 0.1 : 1); });
  list.innerHTML = matches.map(({ info }) => `
    <button class="part-item ${state.selected === info.id ? 'active' : ''}" data-part="${info.id}" aria-pressed="${state.selected === info.id}">
      <span class="item-index">${info.index}</span><span><strong>${info.name}</strong><small>${info.en}</small></span><i data-lucide="chevron-right"></i>
    </button>`).join('');
  $('#part-count').textContent = `${String(matches.length).padStart(2, '0')} / ${model.parts.length}`;
  $('#empty-state').hidden = matches.length > 0;
  list.hidden = matches.length === 0;
  list.querySelectorAll('[data-part]').forEach((button) => button.addEventListener('click', () => selectPart(button.dataset.part)));
  refreshIcons();
}
renderPartList();
$('#part-search').addEventListener('input', (event) => { state.query = event.target.value; renderPartList(); invalidate(); });
$('#category-filters').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
  state.category = button.dataset.category;
  $('#category-filters').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === button));
  renderPartList();
  invalidate();
}));
$('#clear-search').addEventListener('click', () => {
  state.query = ''; state.category = '全部'; $('#part-search').value = '';
  $('#category-filters').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.category === '全部'));
  renderPartList(); $('#part-search').focus(); invalidate();
});

function setCameraFollow(value) {
  state.cameraFollow = value;
  $('#camera-mode').classList.toggle('manual', !value);
  $('#camera-mode-label').textContent = value ? '镜头跟随' : '自由观察';
  $('#camera-mode').setAttribute('aria-pressed', String(value));
  invalidate();
}
$('#camera-mode').addEventListener('click', () => setCameraFollow(!state.cameraFollow));

function updatePlayButton() {
  const button = $('#play-toggle');
  button.innerHTML = state.playing ? '<i data-lucide="pause"></i><span>暂停</span>' : '<i data-lucide="play"></i><span>自动播放</span>';
  button.classList.toggle('playing', state.playing);
  button.setAttribute('aria-label', state.playing ? '暂停' : '自动播放');
  refreshIcons();
}
function setPlaying(value) {
  if (value && state.targetProgress >= 0.999) {
    state.targetProgress = 0;
    if (reducedMotion) state.progress = 0;
  }
  state.playing = value;
  updatePlayButton();
  invalidate();
}
function setProgressTarget(value, manual = true) {
  state.targetProgress = clamp01(value);
  if (manual) {
    state.playing = false;
    setCameraFollow(true);
    updatePlayButton();
  }
  invalidate();
}
function selectPart(id, focus = true) {
  const part = partMap.get(id);
  if (!part) return;
  state.selected = id;
  $('#inspector').classList.add('has-selection');
  $('#viewport').classList.add('has-selection');
  selectionHelper.visible = true;
  $('#inspector-empty').hidden = true;
  $('#inspector-content').hidden = false;
  $('#detail-index').textContent = part.info.index;
  $('#detail-category').textContent = part.info.category;
  $('#detail-name').textContent = part.info.name;
  $('#detail-en').textContent = part.info.en;
  $('#detail-note').textContent = part.info.note;
  $('#detail-material').textContent = part.info.material;
  if (focus && !['display', 'keyboard', 'unibody', 'bottom', 'hinge'].includes(id) && state.targetProgress < 0.2) setProgressTarget(0.5);
  else if (focus) { state.playing = false; updatePlayButton(); }
  if (focus) setCameraFollow(true);
  renderPartList();
  invalidate();
}
function clearFocus() {
  state.selected = null;
  $('#inspector').classList.remove('has-selection');
  $('#viewport').classList.remove('has-selection');
  selectionHelper.visible = false;
  $('#inspector-empty').hidden = false;
  $('#inspector-content').hidden = true;
  setCameraFollow(true);
  renderPartList();
  invalidate();
}
$('#clear-focus').addEventListener('click', clearFocus);
$('#play-toggle').addEventListener('click', () => setPlaying(!state.playing));
$('#layout-progress').addEventListener('input', (event) => setProgressTarget(Number(event.target.value) / 1000));
document.querySelectorAll('.stage-jump').forEach((button) => button.addEventListener('click', () => setProgressTarget(Number(button.dataset.progress))));
$('#reset-button').addEventListener('click', resetStudy);
function resetStudy() {
  setPlaying(false);
  state.progress = 0; state.targetProgress = 0;
  state.query = ''; state.category = '全部'; $('#part-search').value = '';
  $('#category-filters').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.category === '全部'));
  model.keyMap.forEach((caps) => caps.forEach((cap) => { cap.userData.pressTarget = 0; }));
  clearFocus();
  setCameraFollow(true);
}

let toastTimer;
function triggerKey(code, label) {
  const caps = model.keyMap.get(code);
  if (!caps) return;
  caps.forEach((cap) => { cap.userData.pressTarget = 1; });
  const toast = $('#key-toast');
  toast.querySelector('strong').textContent = label || caps[0].userData.keyLabel || code;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 620);
  invalidate();
}
function releaseKey(code) {
  const caps = model.keyMap.get(code);
  if (caps) {
    caps.forEach((cap) => { cap.userData.pressTarget = 0; });
    invalidate();
  }
}
window.addEventListener('keydown', (event) => {
  const editing = /INPUT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable;
  if (event.key === '/' && !editing && !aboutDialog.open) {
    event.preventDefault(); $('#part-search').focus(); return;
  }
  if (editing || aboutDialog.open) return;
  if (model.keyMap.has(event.code)) {
    if (event.code === 'Space') event.preventDefault();
    triggerKey(event.code, event.key === ' ' ? 'SPACE' : event.key);
  }
  if (event.code === 'Space' && !event.repeat) setPlaying(!state.playing);
  if (event.code === 'KeyR' && !event.repeat) resetStudy();
  if (event.key === 'Escape') clearFocus();
});
window.addEventListener('keyup', (event) => releaseKey(event.code));
window.addEventListener('blur', () => model.keyMap.forEach((_, code) => releaseKey(code)));

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', (event) => { pointerStart = { x: event.clientX, y: event.clientY }; });
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(model.root.children, true).find((item) => item.object.userData.partId && (item.object.material?.opacity ?? 1) > 0.15);
  if (!hit) return;
  if (hit.object.userData.keyCode) {
    const code = hit.object.userData.keyCode;
    triggerKey(code, hit.object.userData.keyLabel || code);
    setTimeout(() => releaseKey(code), 180);
  }
  selectPart(hit.object.userData.interfaceId || hit.object.userData.partId);
});

const tempCenter = new THREE.Vector3();
const tempSize = new THREE.Vector3();
const cameraGoal = new THREE.Vector3();
const targetGoal = new THREE.Vector3();
const layoutA = new THREE.Vector3();
const layoutB = new THREE.Vector3();
const focusDirection = new THREE.Vector3();
function layoutCamera(p) {
  const aspect = camera.aspect;
  const fit = Math.max(1, 1.18 / aspect);
  if (p < 0.5) {
    const e = smooth(p * 2);
    layoutA.set(34 * fit, 27 * fit, 40 * fit);
    layoutB.set(43 * fit, 42 * fit, 51 * fit);
    cameraGoal.lerpVectors(layoutA, layoutB, e);
    targetGoal.set(0, THREE.MathUtils.lerp(5, 4.5, e), THREE.MathUtils.lerp(-2, -3, e));
  } else {
    const e = smooth((p - 0.5) * 2);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const topDistance = Math.max(54 / (2 * tan), 96 / (2 * tan * aspect)) * 1.1;
    cameraGoal.lerpVectors(layoutA.set(43 * fit, 42 * fit, 51 * fit), layoutB.set(0, topDistance, 0.01), e);
    targetGoal.lerpVectors(layoutA.set(0, 4.5, -3), layoutB.set(0, 0, 0), e);
  }
  const upBlend = smooth((p - 0.62) / 0.38);
  camera.up.set(0, 1 - upBlend, -upBlend).normalize();
}
function updateCamera(dt) {
  let cameraChanging = false;
  if (state.cameraFollow) {
    layoutCamera(state.progress);
    if (state.selected) {
      const part = partMap.get(state.selected);
      selectionBounds.setFromObject(part.group);
      selectionBounds.getCenter(tempCenter);
      selectionBounds.getSize(tempSize);
      const radius = Math.max(1, tempSize.length() * 0.5);
      const distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.32;
      if (state.progress > 0.86) focusDirection.set(0, 1, 0.001).normalize();
      else focusDirection.set(0.92, 0.72, 1.15).normalize();
      cameraGoal.copy(tempCenter).addScaledVector(focusDirection, distance);
      targetGoal.copy(tempCenter);
    }
    cameraChanging = camera.position.distanceToSquared(cameraGoal) + controls.target.distanceToSquared(targetGoal) > 0.000002;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.8);
    camera.position.lerp(cameraGoal, alpha);
    controls.target.lerp(targetGoal, alpha);
  }
  return controls.update() || cameraChanging;
}

function applyLayout(p) {
  model.parts.forEach((part) => {
    const first = p < 0.5;
    const a = first ? part.states.home : part.states.exploded;
    const b = first ? part.states.exploded : part.states.tile;
    const e = smooth(first ? p * 2 : (p - 0.5) * 2);
    part.group.position.lerpVectors(a.position, b.position, e);
    if (first && part.info.category === '接口') {
      const lift = smooth(e / 0.58);
      const outward = smooth((e - 0.34) / 0.66);
      part.group.position.y = THREE.MathUtils.lerp(a.position.y, b.position.y, lift);
      part.group.position.x = THREE.MathUtils.lerp(a.position.x, b.position.x, outward);
    }
    part.group.quaternion.slerpQuaternions(a.quaternion, b.quaternion, e);
    part.group.scale.lerpVectors(a.scale, b.scale, e);
  });
  frameMat.opacity = smooth((p - 0.65) / 0.35) * 0.38;
}
function updateFilters(dt) {
  let changing = false;
  const alpha = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
  model.parts.forEach((part) => part.meshes.forEach((mesh) => {
    if (!mesh.material) return;
    const mat = mesh.material;
    const base = mat.userData.baseOpacity ?? 1;
    const owner = mesh.userData.interfaceId ? partMap.get(mesh.userData.interfaceId) : part;
    const focusAlpha = state.selected && state.selected !== owner.info.id ? 0.18 : 1;
    const target = base * owner.filterTarget * focusAlpha;
    if (Math.abs(mat.opacity - target) > 0.0005) {
      changing = true;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, alpha);
    } else mat.opacity = target;
    mat.transparent = mat.opacity < 0.99 || base < 1;
    mat.depthWrite = mat.opacity > 0.45;
  }));
  return changing;
}
function updateKeys(dt) {
  let changing = false;
  const alpha = reducedMotion ? 1 : 1 - Math.exp(-dt * 25);
  model.keyMap.forEach((caps) => caps.forEach((cap) => {
    const target = cap.userData.pressTarget || 0;
    const current = cap.userData.press || 0;
    if (Math.abs(current - target) > 0.0005) {
      changing = true;
      cap.userData.press = THREE.MathUtils.lerp(current, target, alpha);
    } else cap.userData.press = target;
    cap.position.y = cap.userData.restY - cap.userData.press * 0.13;
    cap.material.emissive.set(0xc8f56a);
    cap.material.emissiveIntensity = cap.userData.press * 0.62;
  }));
  return changing;
}
function updateLabels() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const tiledOpacity = smooth((state.progress - 0.74) / 0.26);
  model.parts.forEach((part) => {
    tempCenter.set(0, 0, 0).applyMatrix4(part.group.matrixWorld).project(camera);
    const visible = tempCenter.z < 1 && (tiledOpacity > 0.01 || state.selected === part.info.id);
    const x = (tempCenter.x * 0.5 + 0.5) * w;
    const y = (-tempCenter.y * 0.5 + 0.5) * h;
    part.label.style.transform = `translate3d(${x}px,${y - 18}px,0) translate(-50%,-50%)`;
    part.label.style.opacity = visible ? String(state.selected === part.info.id ? 1 : tiledOpacity * part.filterTarget * 0.82) : '0';
    part.label.classList.toggle('selected', state.selected === part.info.id);
  });
}
const STAGES = [
  { index: '01', name: '整机形态', en: 'ASSEMBLED VIEW' },
  { index: '02', name: '结构爆炸', en: 'EXPLODED VIEW' },
  { index: '03', name: '俯视平铺', en: 'TOP-DOWN / 16:9' },
];
function updateUI() {
  const percent = Math.round(state.progress * 100);
  $('#progress-value').textContent = String(percent).padStart(3, '0');
  $('#layout-progress').value = String(Math.round(state.progress * 1000));
  $('#layout-progress').style.setProperty('--progress', `${percent}%`);
  const stageIndex = state.progress < 0.25 ? 0 : state.progress < 0.75 ? 1 : 2;
  const stage = STAGES[stageIndex];
  $('#stage-index').textContent = stage.index;
  $('#stage-name').textContent = stage.name;
  $('#stage-en').textContent = stage.en;
  document.querySelectorAll('.stage-jump').forEach((button, i) => button.classList.toggle('active', i === stageIndex));
  $('#view-ratio').classList.toggle('visible', state.progress > 0.78);
}

let lastFrameTime = 0, frameEMA = 16.7, renderCount = 0;
let frameRequest = 0, needsRender = true;
function invalidate() {
  needsRender = true;
  if (!frameRequest && !document.hidden) frameRequest = requestAnimationFrame(tick);
}
controls.addEventListener('change', invalidate);
function tick(now) {
  frameRequest = 0;
  const renderRequested = needsRender;
  needsRender = false;
  const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.08) : 1 / 60;
  lastFrameTime = now;
  frameEMA = frameEMA * 0.96 + dt * 1000 * 0.04;
  if (state.playing) {
    state.targetProgress = Math.min(1, state.targetProgress + dt / 18);
    if (state.targetProgress >= 1) setPlaying(false);
  }
  const previousProgress = state.progress;
  state.progress = reducedMotion ? state.targetProgress : THREE.MathUtils.lerp(state.progress, state.targetProgress, 1 - Math.exp(-dt * 7));
  if (Math.abs(state.progress - state.targetProgress) < 0.00005) state.progress = state.targetProgress;
  const progressChanging = state.progress !== state.targetProgress;
  const layoutChanged = previousProgress !== state.progress;
  if (layoutChanged) {
    applyLayout(state.progress);
    renderer.shadowMap.needsUpdate = true;
  }
  const filtersChanging = updateFilters(dt);
  const keysChanging = updateKeys(dt);
  if (keysChanging) renderer.shadowMap.needsUpdate = true;
  if (layoutChanged || keysChanging || renderRequested) model.root.updateMatrixWorld(true);
  if (state.selected) {
    selectionBounds.setFromObject(partMap.get(state.selected).group);
    selectionHelper.visible = true;
  }
  const cameraChanging = updateCamera(dt);
  if (layoutChanged || keysChanging) model.root.updateMatrixWorld(true);
  updateLabels();
  updateUI();
  if (renderRequested || needsRender || layoutChanged || filtersChanging || keysChanging || cameraChanging) {
    renderer.render(scene, camera);
    renderCount++;
  }
  if (!state.ready) {
    state.ready = true;
    $('#loading').classList.add('done');
    setTimeout(() => { $('#loading').hidden = true; }, 260);
    window.__SCENE_READY__ = true;
  }
  if (state.playing || progressChanging || filtersChanging || keysChanging || cameraChanging || needsRender) invalidate();
  else lastFrameTime = 0;
}
invalidate();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    lastFrameTime = 0;
  } else invalidate();
});
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  setPlaying(false);
  cancelAnimationFrame(frameRequest);
  frameRequest = 0;
  showWebGLFallback('图形上下文已中断。已暂停三维绘制；部件索引、搜索与详情仍可继续使用。');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  $('#webgl-fallback').hidden = true;
  $('#viewport').classList.remove('webgl-unavailable');
  $('#app').classList.remove('webgl-unavailable');
  ['#play-toggle', '#layout-progress', '#camera-mode'].forEach((selector) => { $(selector).disabled = false; });
  document.querySelectorAll('.stage-jump').forEach((button) => { button.disabled = false; });
  renderer.shadowMap.needsUpdate = true;
  invalidate();
});

const resize = () => {
  const w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.shadowMap.needsUpdate = true;
  invalidate();
};
new ResizeObserver(resize).observe(wrap);
window.addEventListener('resize', resize);

window.__seek = (t) => {
  const value = Number(t);
  setPlaying(false);
  state.targetProgress = state.progress = Number.isFinite(value) ? clamp01(value / 18) : 0;
  setCameraFollow(true);
  applyLayout(state.progress);
  renderer.shadowMap.needsUpdate = true;
  invalidate();
};
window.__setProgress = (p) => {
  setPlaying(false);
  state.targetProgress = state.progress = clamp01(Number(p));
  setCameraFollow(true);
  applyLayout(state.progress);
  renderer.shadowMap.needsUpdate = true;
  invalidate();
};
window.__getState = () => ({
  progress: state.progress, targetProgress: state.targetProgress, playing: state.playing,
  selected: state.selected, matches: matchingParts().length, cameraFollow: state.cameraFollow,
  pressedKeys: [...model.keyMap.entries()].filter(([, caps]) => caps.some((cap) => cap.userData.press > 0.2)).map(([code]) => code),
  drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  fps: Math.round(1000 / frameEMA), pixelRatio: renderer.getPixelRatio(),
  renderCount, idle: frameRequest === 0, webgl: true,
});
window.__play = () => setPlaying(true);
refreshIcons();
const timeParam = new URLSearchParams(location.search).get('t');
const progressParam = new URLSearchParams(location.search).get('p');
if (timeParam !== null) window.__seek(timeParam);
else if (progressParam !== null) window.__setProgress(progressParam);
}
