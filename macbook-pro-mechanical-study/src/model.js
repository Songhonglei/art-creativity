import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const C = {
  aluminum: 0x8c9292,
  aluminumDark: 0x555c5d,
  edge: 0xb8bdbb,
  graphite: 0x171c1d,
  black: 0x090d0e,
  board: 0x16211e,
  chip: 0x252c2b,
  copper: 0x8f5c3e,
  gold: 0xc4a76a,
  glass: 0x101819,
  accent: 0xc8f56a,
};

export const PART_INFO = [
  { id: 'display', index: '01', name: '显示组件', en: 'DISPLAY ASSEMBLY', category: '外部结构', material: '14.2 英寸玻璃 / 铝', note: '2025 款 M5 机型的屏幕、窄边框、刘海与上盖。' },
  { id: 'keyboard', index: '02', name: '键盘组件', en: 'KEYBOARD DECK', category: '输入交互', material: '全高功能键 / Touch ID', note: '逐键建模；物理键盘输入会联动对应键帽。' },
  { id: 'unibody', index: '03', name: '轻薄铝机身', en: 'UNIBODY CHASSIS', category: '外部结构', material: '31.26 × 22.12 cm 外形', note: '按 2025 款外形比例重建，压缩侧壁与堆叠厚度。' },
  { id: 'logic', index: '04', name: '主板基板', en: 'LOGIC BOARD', category: '核心硬件', material: '基板 / 供电 / 连接器', note: 'M5 单风扇布局下的板级走线与连接关系。' },
  { id: 'soc', index: '05', name: 'M5 处理器 SoC', en: 'M5 SYSTEM ON CHIP', category: '核心硬件', material: 'CPU / GPU / 神经网络引擎', note: '独立展示 M5 封装，便于观察处理器与散热模组的关系。' },
  { id: 'memory', index: '06', name: '统一内存', en: 'UNIFIED MEMORY', category: '核心硬件', material: '内存封装', note: '独立研究组件；与实际封装的连接关系经过简化。' },
  { id: 'storage', index: '07', name: 'SSD 存储', en: 'SSD STORAGE', category: '核心硬件', material: 'NAND / 控制器区域', note: '独立展示存储封装，不对应特定容量配置。' },
  { id: 'thermal', index: '08', name: '单风扇散热模组', en: 'SINGLE-FAN THERMAL', category: '核心硬件', material: '风扇 / 热管 / 鳍片', note: '按 2025 款 M5 的右侧单风扇与弧形热管布局重建。' },
  { id: 'battery', index: '09', name: '电池组', en: 'BATTERY ARRAY', category: '核心硬件', material: '六分区电池外形', note: '六个电池分区与中央触控板连接区域。' },
  { id: 'trackpad', index: '10', name: 'Force Touch 触控板', en: 'FORCE TOUCH TRACKPAD', category: '输入交互', material: '玻璃 / 触觉反馈层', note: '大面积触控面与下方触觉反馈区域。' },
  { id: 'speakers', index: '11', name: '键盘侧扬声器', en: 'KEYBOARD-SIDE SPEAKERS', category: '核心硬件', material: '六扬声器系统 / 侧格栅', note: '发声区域与键盘两侧对齐，不延伸至掌托下侧。' },
  { id: 'bottom', index: '12', name: '底盖', en: 'BOTTOM COVER', category: '外部结构', material: '薄铝盖 / 脚垫', note: '底部覆盖件、脚垫与紧固件位置。' },
  { id: 'hinge', index: '13', name: '铰链组件', en: 'HINGE ASSEMBLY', category: '外部结构', material: '金属轴 / 连接座', note: '显示组件与机身之间的转轴和连接关系。' },
  { id: 'magsafe', index: '14', name: 'MagSafe 3 磁吸充电', en: 'MAGSAFE 3 · LEFT', category: '接口', material: '五触点磁吸接口', note: '机身左后侧；独立金属外框、黑色内腔与五个触点。' },
  { id: 'usbcLeft1', index: '15', name: '雷雳 4 / USB‑C ①', en: 'THUNDERBOLT 4 · LEFT 01', category: '接口', material: 'USB‑C / 24 触点结构', note: '左侧第一个雷雳 4 接口，支持充电、数据与显示输出。' },
  { id: 'usbcLeft2', index: '16', name: '雷雳 4 / USB‑C ②', en: 'THUNDERBOLT 4 · LEFT 02', category: '接口', material: 'USB‑C / 24 触点结构', note: '左侧第二个雷雳 4 接口，椭圆金属套筒与中央舌片。' },
  { id: 'usbcRight', index: '17', name: '雷雳 4 / USB‑C ③', en: 'THUNDERBOLT 4 · RIGHT', category: '接口', material: 'USB‑C / 24 触点结构', note: '机身右侧的第三个雷雳 4 接口。' },
  { id: 'hdmi', index: '18', name: 'HDMI 接口', en: 'HDMI · RIGHT REAR', category: '接口', material: '梯形金属套筒 / 19 触点', note: '右后侧梯形 HDMI 口，包含上下触点排。' },
  { id: 'headphone', index: '19', name: '3.5 mm 耳机接口', en: 'HEADPHONE JACK · LEFT', category: '接口', material: '圆形金属套筒 / 音频触点', note: '左侧圆形音频接口，包含金属套筒与内部音频触点。' },
  { id: 'sdxc', index: '20', name: 'SDXC 读卡器', en: 'SDXC CARD SLOT · RIGHT', category: '接口', material: '卡槽 / 触点排', note: '右侧长条形 SDXC 卡槽与内部触点。' },
];

function material(color, roughness = 0.55, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, mat, radius = 0.08, segments = 3) {
  const geo = radius > 0
    ? new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, w / 2, h / 2, d / 2))
    : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radius, height, mat, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function place(parent, child, x = 0, y = 0, z = 0) {
  child.position.set(x, y, z);
  parent.add(child);
  return child;
}

const textureCache = new Map();
function labelTexture(text, options = {}) {
  const key = `${text}|${options.dark ? 1 : 0}|${options.wide ? 1 : 0}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = options.wide ? 256 : 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = options.dark ? '#c7ceca' : '#171c1d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.dark ? '#202726' : '#d8ded9';
  ctx.font = `${text.length > 6 ? 18 : text.length > 2 ? 22 : 34}px "SFMono-Regular", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

function screenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0c1213';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(770, 450, 30, 770, 450, 570);
  glow.addColorStop(0, '#54735a');
  glow.addColorStop(0.38, '#243a31');
  glow.addColorStop(1, '#0c1213');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(199,245,106,.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.strokeStyle = '#c8f56a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(768, 442, 236, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,245,106,.35)';
  ctx.beginPath(); ctx.arc(768, 442, 294, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e7ede6';
  ctx.font = '500 44px "Avenir Next", sans-serif';
  ctx.fillText('MECHANICAL STUDY', 76, 830);
  ctx.fillStyle = '#c8f56a';
  ctx.font = '26px monospace';
  ctx.fillText('MBP—14  /  2025 · M5', 78, 878);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeDisplay() {
  const g = new THREE.Group();
  place(g, box(31.26, 20.8, 0.42, material(C.aluminumDark, 0.28, 0.82), 0.4, 5));
  place(g, box(30.96, 20.46, 0.075, material(C.black, 0.38), 0.45, 4), 0, 0, 0.225);
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture(), roughness: 0.22, metalness: 0.05,
    emissive: 0x17221d, emissiveIntensity: 0.32,
  });
  place(g, box(29.86, 19.12, 0.035, screenMat, 0.22, 3), 0, -0.3, 0.28);
  place(g, box(3.7, 0.72, 0.06, material(C.black, 0.28), 0.18, 3), 0, 9.35, 0.32);
  const cam = cylinder(0.105, 0.025, material(0x182e32, 0.18, 0.4), 20);
  cam.rotation.x = Math.PI / 2;
  place(g, cam, 0, 9.36, 0.36);
  return g;
}

function makeUnibody() {
  const g = new THREE.Group();
  place(g, box(31.26, 1.05, 22.12, material(C.aluminum, 0.3, 0.85), 0.5, 6));
  place(g, box(30.72, 0.08, 21.56, material(C.aluminumDark, 0.42, 0.65), 0.46, 4), 0, 0.515, 0);
  place(g, box(3.4, 0.16, 0.12, material(C.graphite, 0.5), 0.06), 0, 0.12, 11.04);
  const roundedOpening = (w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return new THREE.ShapeGeometry(s);
  };
  const rimMat = material(0x9ba19f, 0.28, 0.85);
  const cavityMat = material(C.black, 0.76);
  const tongueMat = material(0x303835, 0.58, 0.15);
  const flushMesh = (geometry, side, z, mat, offset = 0, interfaceId = null) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.rotation.y = side * Math.PI / 2;
    mesh.userData.interfaceId = interfaceId;
    place(g, mesh, side * (15.635 + offset), 0, z);
  };
  const flushRect = (side, z, w, h, r, innerW, innerH, innerR, interfaceId) => {
    flushMesh(roundedOpening(w, h, r), side, z, rimMat, 0, interfaceId);
    flushMesh(roundedOpening(innerW, innerH, innerR), side, z, cavityMat, 0.006, interfaceId);
  };
  flushRect(-1, -7.4, 2.35, 0.7, 0.28, 1.92, 0.3, 0.13, 'magsafe');
  for (let i = 0; i < 5; i++) flushMesh(new THREE.CircleGeometry(0.05, 16), -1, -7.4 + (i - 2) * 0.28, material(C.gold, 0.3, 0.8), 0.012, 'magsafe');
  [-4.6, -2.2].forEach((z, index) => {
    const id = index === 0 ? 'usbcLeft1' : 'usbcLeft2';
    flushRect(-1, z, 1.5, 0.62, 0.28, 1.23, 0.36, 0.17, id);
    flushMesh(roundedOpening(0.94, 0.075, 0.03), -1, z, tongueMat, 0.012, id);
  });
  flushRect(1, -3.5, 1.5, 0.62, 0.28, 1.23, 0.36, 0.17, 'usbcRight');
  flushMesh(roundedOpening(0.94, 0.075, 0.03), 1, -3.5, tongueMat, 0.012, 'usbcRight');
  flushMesh(new THREE.ShapeGeometry(hdmiShape(2.35, 0.86)), 1, -6.7, rimMat, 0, 'hdmi');
  flushMesh(new THREE.ShapeGeometry(hdmiShape(1.98, 0.58)), 1, -6.7, cavityMat, 0.006, 'hdmi');
  flushRect(1, -0.2, 3.35, 0.5, 0.14, 3.02, 0.17, 0.07, 'sdxc');
  flushMesh(new THREE.CircleGeometry(0.52, 40), -1, 0.7, rimMat, 0, 'headphone');
  flushMesh(new THREE.CircleGeometry(0.4, 40), -1, 0.7, cavityMat, 0.006, 'headphone');
  const holeGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.022, 8);
  const holes = new THREE.InstancedMesh(holeGeo, material(0x252b2b, 0.65), 144);
  const dummy = new THREE.Object3D();
  let i = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      for (let n = 0; n < 24; n++) {
        dummy.position.set(side * (13.65 + row * 0.29), 0.565, -7.9 + n * 0.34);
        dummy.updateMatrix(); holes.setMatrixAt(i++, dummy.matrix);
      }
    }
  }
  g.add(holes);
  return g;
}

const KEY_ROWS = [
  [
    ['esc', 'Escape'], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`]), ['●', 'TouchID'],
  ],
  [['`', 'Backquote'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((i) => [`${i}`, `Digit${i}`]), ['-', 'Minus'], ['=', 'Equal'], ['delete', 'Backspace', 1.5]],
  [['tab', 'Tab', 1.5], ...'QWERTYUIOP'.split('').map((k) => [k, `Key${k}`]), ['[', 'BracketLeft'], [']', 'BracketRight'], ['\\', 'Backslash']],
  [['caps', 'CapsLock', 1.75], ...'ASDFGHJKL'.split('').map((k) => [k, `Key${k}`]), [';', 'Semicolon'], ["'", 'Quote'], ['return', 'Enter', 1.75]],
  [['shift', 'ShiftLeft', 2.25], ...'ZXCVBNM'.split('').map((k) => [k, `Key${k}`]), [',', 'Comma'], ['.', 'Period'], ['/', 'Slash'], ['shift', 'ShiftRight', 2.25]],
  [['fn', 'Fn'], ['ctrl', 'ControlLeft'], ['opt', 'AltLeft'], ['cmd', 'MetaLeft', 1.25], ['', 'Space', 5], ['cmd', 'MetaRight', 1.25], ['opt', 'AltRight'], ['◀', 'ArrowLeft'], ['↑↓', 'Arrows'], ['▶', 'ArrowRight']],
];

function makeKeyboard(keyMap) {
  const g = new THREE.Group();
  place(g, box(27.2, 0.14, 10.65, material(C.graphite, 0.6), 0.38, 4), 0, -0.03, 0);
  const unit = 1.7;
  KEY_ROWS.forEach((row, rowIndex) => {
    const total = row.reduce((sum, item) => sum + (item[2] || 1), 0);
    let cursor = -total * unit / 2;
    row.forEach(([label, code, units = 1]) => {
      const w = units * unit - 0.15;
      const x = cursor + units * unit / 2;
      cursor += units * unit;
      const z = -4.25 + rowIndex * 1.58;
      const h = 1.28;
      const addCap = (capCode, capLabel, capZ = z, capD = h) => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.56, metalness: 0.06,
          map: labelTexture(capLabel || ' '), emissive: 0x000000,
        });
        const cap = box(w, 0.24, capD, mat, 0.13, 3);
        cap.castShadow = false;
        cap.userData.keyCode = capCode;
        cap.userData.keyLabel = capLabel;
        cap.userData.restY = 0.16;
        cap.userData.press = 0;
        place(g, cap, x, 0.16, capZ);
        if (!keyMap.has(capCode)) keyMap.set(capCode, []);
        keyMap.get(capCode).push(cap);
      };
      if (code === 'Arrows') {
        addCap('ArrowUp', '↑', z - 0.32, 0.56);
        addCap('ArrowDown', '↓', z + 0.32, 0.56);
      } else addCap(code, label);
    });
  });
  return g;
}

function makeLogicBoard(rand) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const outline = [
    [-12.3, -2.8], [-8.6, -2.8], [-7.7, -1.45], [-4.2, -1.45], [-3.5, -2.65],
    [3.6, -2.65], [4.5, -1.3], [8.5, -1.3], [9.5, -2.75], [12.1, -2.75],
    [12.1, 1.15], [10.3, 1.15], [9.4, 3.05], [5.5, 3.05], [4.6, 1.5],
    [-4.7, 1.5], [-5.8, 2.75], [-9.5, 2.75], [-10.35, 1.45], [-12.3, 1.45],
  ];
  outline.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
  shape.closePath();
  const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.04, bevelSegments: 2 });
  boardGeo.rotateX(-Math.PI / 2);
  const board = new THREE.Mesh(boardGeo, material(C.board, 0.58, 0.2));
  board.castShadow = true; board.receiveShadow = true;
  g.add(board);
  place(g, box(5.7, 0.07, 3.9, material(0x39423c, 0.45, 0.45), 0.12), 0, 0.2, 0.1);
  place(g, box(4.9, 0.06, 3.1, material(C.black, 0.65), 0.08), 0, 0.25, 0.1);
  [-5.2, 5.2].forEach((x) => place(g, box(3.2, 0.07, 3.0, material(0x303a35, 0.52, 0.25), 0.08), x, 0.2, 0.3));
  const shieldMat = material(0x68716b, 0.36, 0.72);
  place(g, box(3.25, 0.12, 2.15, shieldMat, 0.1), -9.25, 0.46, 0.5);
  place(g, box(2.75, 0.12, 1.55, shieldMat.clone(), 0.09), 9.25, 0.46, 0.6);
  place(g, box(3.6, 0.1, 0.82, material(0x4c5550, 0.4, 0.65), 0.07), -7.9, 0.4, -1.65);
  [[-6.2, 2.25, 2.2], [1.8, 2.05, 2.8], [7.1, 2.3, 1.65]].forEach(([x, z, w]) => {
    place(g, box(w, 0.18, 0.48, material(0x151b19, 0.62), 0.04), x, 0.27, z);
    place(g, box(w * 0.82, 0.05, 0.22, material(C.gold, 0.38, 0.72), 0.02), x, 0.39, z);
  });
  const chipGeo = new THREE.BoxGeometry(1, 1, 1);
  const chips = new THREE.InstancedMesh(chipGeo, material(C.chip, 0.62, 0.12), 64);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 8), material(0x727a70, 0.45, 0.5), 44);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 64; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (5.8 + rand() * 5.2);
    const z = -1.1 + rand() * 3.2;
    dummy.position.set(x, 0.28, z);
    dummy.scale.set(0.3 + rand() * 0.75, 0.14 + rand() * 0.2, 0.25 + rand() * 0.65);
    dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); chips.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 44; i++) {
    dummy.position.set(-10.8 + rand() * 21.6, 0.29, -2.5 + rand() * 0.65);
    dummy.scale.setScalar(0.7 + rand() * 0.6); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); caps.setMatrixAt(i, dummy.matrix);
  }
  g.add(chips, caps);
  for (let i = 0; i < 9; i++) {
    place(g, box(1.4, 0.35, 0.5, material(i % 3 === 0 ? 0x6a7168 : 0x262d2b, 0.55), 0.04), -9.8 + i * 2.45, 0.26, -2.85);
  }
  const screwMat = material(C.gold, 0.35, 0.75);
  [[-11, 2.4], [11, 2.4], [-5, -1.2], [5, -1.2], [0, 2.1]].forEach(([x, z]) => {
    const s = cylinder(0.2, 0.09, screwMat, 16); place(g, s, x, 0.25, z);
  });
  return g;
}

function makeThermal() {
  const g = new THREE.Group();
  const fan = new THREE.Group();
  fan.position.set(8.7, 0, 0.15);
  place(fan, box(6.9, 0.4, 6.25, material(0x1c2222, 0.6, 0.1), 1.2, 5));
  place(fan, cylinder(2.58, 0.4, material(C.black, 0.75), 48), 0, 0.1, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.1, 8, 48), material(0x424a48, 0.45, 0.45));
  ring.rotation.x = Math.PI / 2; place(fan, ring, 0, 0.34, 0);
  const bladeGeo = new RoundedBoxGeometry(0.28, 0.07, 1.65, 2, 0.07);
  const blades = new THREE.InstancedMesh(bladeGeo, material(0x343b3a, 0.52), 32);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2;
    dummy.position.set(Math.sin(a) * 1.4, 0.35, Math.cos(a) * 1.4);
    dummy.rotation.set(0, a + 0.48, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix);
  }
  fan.add(blades);
  place(fan, cylinder(0.74, 0.2, material(0x2e3534, 0.42, 0.3), 40), 0, 0.4, 0);
  place(fan, cylinder(0.11, 0.22, material(C.edge, 0.3, 0.8), 20), 0, 0.43, 0);
  g.add(fan);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.4, 0.4, -0.2), new THREE.Vector3(-0.8, 0.48, -1.85),
    new THREE.Vector3(3.2, 0.48, -2.05), new THREE.Vector3(8.7, 0.42, -0.25),
  ]);
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.22, 10, false), material(C.copper, 0.33, 0.78));
  pipe.castShadow = true; g.add(pipe);
  place(g, box(6.1, 0.18, 3.5, material(0x303735, 0.45, 0.5), 0.16), -1.3, 0.22, 0.05);
  const mountMat = material(C.gold, 0.34, 0.76);
  [[-3.9, -1.35], [1.3, -1.35], [-3.9, 1.45], [1.3, 1.45]].forEach(([x, z]) => {
    place(g, cylinder(0.17, 0.12, mountMat, 16), x, 0.37, z);
  });
  [[-2.65, -2.3], [2.65, -2.3], [2.65, 2.3]].forEach(([x, z]) => {
    place(fan, cylinder(0.15, 0.12, mountMat, 16), x, 0.32, z);
  });
  place(g, box(2.2, 0.09, 0.48, material(0x171d1b, 0.65), 0.04), 5.7, 0.18, 2.8);
  place(g, box(0.65, 0.13, 0.58, material(C.copper, 0.4, 0.65), 0.04), 4.75, 0.22, 2.8);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.085, 0.28, 1.2), material(0x4e5550, 0.4, 0.65), 28);
  for (let i = 0; i < 28; i++) {
    dummy.position.set(3.1 + i * 0.34, 0.08, -3.35); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); fins.setMatrixAt(i, dummy.matrix);
  }
  g.add(fins);
  return g;
}

function makeBattery() {
  const g = new THREE.Group();
  const cellMat = material(0x202625, 0.68, 0.05);
  const cells = [
    [-8.2, -2.9, 5.4, 5.4], [-8.2, 3.05, 5.4, 5.4],
    [8.2, -2.9, 5.4, 5.4], [8.2, 3.05, 5.4, 5.4],
    [-2.5, 0.1, 4.55, 10.8], [2.5, 0.1, 4.55, 10.8],
  ];
  cells.forEach(([x, z, w, d], i) => {
    const cell = box(w, 0.46, d, cellMat.clone(), 0.25, 4);
    place(g, cell, x, 0, z);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 0.8, 3.2), 0.72), new THREE.MeshBasicMaterial({
      map: labelTexture(`CELL 0${i + 1}`), transparent: true, opacity: 0.68, depthWrite: false,
    }));
    tag.rotation.x = -Math.PI / 2; place(g, tag, x, 0.245, z);
  });
  place(g, box(0.55, 0.14, 10.6, material(0x090d0d, 0.72), 0.08), 0, 0.18, 0.1);
  place(g, box(4.5, 0.14, 0.72, material(C.board, 0.58, 0.2), 0.06), 0, 0.24, -5.45);
  for (const x of [-0.95, 0, 0.95]) place(g, box(0.52, 0.12, 0.34, material(C.chip, 0.55), 0.03), x, 0.35, -5.45);
  for (const x of [-6.1, 6.1]) {
    place(g, box(2.45, 0.06, 1.05, material(C.copper, 0.42, 0.58), 0.05), x, 0.26, -5.65);
    place(g, box(1.35, 0.15, 0.42, material(0x111715, 0.65), 0.04), x, 0.31, -6.12);
  }
  place(g, box(1.05, 0.07, 4.15, material(C.copper, 0.42, 0.58), 0.05), 0, 0.28, -3.65);
  place(g, box(1.4, 0.14, 0.48, material(0x121816, 0.65), 0.04), 0, 0.32, -5.7);
  return g;
}

function makeTrackpad() {
  const g = new THREE.Group();
  place(g, box(14.1, 0.22, 8.3, material(C.aluminumDark, 0.38, 0.72), 0.22, 4));
  place(g, box(13.65, 0.09, 7.86, material(0x555f5e, 0.24, 0.35), 0.2, 4), 0, 0.145, 0);
  for (const x of [-4.7, 0, 4.7]) place(g, box(2.8, 0.18, 4.9, material(0x202725, 0.58, 0.15), 0.18), x, -0.19, 0.25);
  place(g, box(1.05, 0.07, 2.35, material(C.copper, 0.42, 0.58), 0.05), 0, -0.08, -4.35);
  place(g, box(1.4, 0.14, 0.46, material(0x121816, 0.65), 0.04), 0, -0.04, -5.45);
  return g;
}

function makeSpeakers() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.position.set(side * 13.7, 0, -3.85);
    place(s, box(1.7, 0.3, 9.3, material(0x202625, 0.58), 0.42, 4));
    for (let i = 0; i < 3; i++) {
      const z = -2.8 + i * 2.8;
      place(s, box(1.52, 0.16, 2.42, material(0x2b3230, 0.56), 0.32, 4), 0, 0.1, z);
      place(s, cylinder(0.53, 0.12, material(0x646d69, 0.36, 0.62), 28), 0, 0.23, z);
      place(s, cylinder(0.34, 0.14, material(0x151a1a, 0.62), 28), 0, 0.28, z);
      place(s, cylinder(0.08, 0.16, material(C.gold, 0.38, 0.72), 16), 0, 0.32, z);
    }
    place(s, box(0.5, 0.09, 1.1, material(C.copper, 0.42, 0.58), 0.04), -side * 0.58, 0.12, -4.45);
    place(s, box(0.62, 0.14, 0.42, material(0x111715, 0.65), 0.04), -side * 0.58, 0.16, -4.92);
    g.add(s);
  }
  return g;
}

function makeChipPack(kind) {
  const g = new THREE.Group();
  const isSoc = kind === 'soc';
  const count = isSoc ? 1 : 2;
  const packageW = isSoc ? 5.1 : 2.85;
  const packageD = isSoc ? 3.8 : 3.25;
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : (i ? 1 : -1) * 1.72;
    place(g, box(packageW + 0.35, 0.12, packageD + 0.35, material(0x39473b, 0.5, 0.35), 0.1), x, 0, 0);
    place(g, box(packageW, isSoc ? 0.26 : 0.2, packageD, material(isSoc ? 0x454d48 : C.chip, 0.38, 0.42), 0.12), x, 0.18, 0);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(isSoc ? 2.2 : 2.35, isSoc ? 1.3 : 0.7), new THREE.MeshBasicMaterial({
      map: labelTexture(isSoc ? 'M5' : kind === 'memory' ? 'UNIFIED' : 'NAND', { dark: true, wide: !isSoc }),
    }));
    tag.rotation.x = -Math.PI / 2; place(g, tag, x, isSoc ? 0.32 : 0.29, 0);
  }
  const contactCount = isSoc ? 32 : 24;
  const contacts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.04, 0.22), material(C.gold, 0.35, 0.8), contactCount * 2);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < contactCount; i++) {
    const span = isSoc ? 4.5 : 5.8;
    for (const side of [-1, 1]) {
      dummy.position.set(-span / 2 + i * span / (contactCount - 1), -0.08, side * (packageD / 2 + 0.23));
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      contacts.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
    }
  }
  g.add(contacts);
  return g;
}

function portBacking(g, w, h) {
  place(g, box(w + 0.45, h + 0.4, 0.16, material(C.board, 0.55, 0.2), 0.1), 0, 0, -0.3);
  place(g, box(w * 0.62, h * 0.42, 0.18, material(C.copper, 0.4, 0.65), 0.04), 0, 0, -0.42);
}

function makeMagSafe() {
  const g = new THREE.Group(); portBacking(g, 2.35, 0.7);
  place(g, box(2.35, 0.7, 0.42, material(C.edge, 0.25, 0.88), 0.28, 5));
  place(g, box(1.92, 0.3, 0.07, material(C.black, 0.72), 0.13, 4), 0, 0, 0.24);
  for (let i = 0; i < 5; i++) {
    const pin = cylinder(0.065, 0.055, material(C.gold, 0.28, 0.82), 16);
    pin.rotation.x = Math.PI / 2; place(g, pin, (i - 2) * 0.28, 0, 0.3);
  }
  return g;
}

function makeUSBCPort() {
  const g = new THREE.Group(); portBacking(g, 1.5, 0.62);
  place(g, box(1.5, 0.62, 0.46, material(C.edge, 0.24, 0.9), 0.28, 6));
  place(g, box(1.23, 0.36, 0.065, material(C.black, 0.75), 0.17, 5), 0, 0, 0.26);
  place(g, box(0.94, 0.075, 0.11, material(0x3b4440, 0.5, 0.2), 0.03), 0, 0, 0.32);
  const contacts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.025, 0.045), material(C.gold, 0.3, 0.82), 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 12; i++) {
    for (const side of [-1, 1]) {
      dummy.position.set((i - 5.5) * 0.073, side * 0.047, 0.385);
      dummy.updateMatrix(); contacts.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
    }
  }
  g.add(contacts);
  return g;
}

function hdmiShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, h / 2); s.lineTo(w / 2, h / 2); s.lineTo(w / 2, -h * 0.08);
  s.lineTo(w * 0.35, -h / 2); s.lineTo(-w * 0.35, -h / 2); s.lineTo(-w / 2, -h * 0.08); s.closePath();
  return s;
}

function makeHDMIPort() {
  const g = new THREE.Group(); portBacking(g, 2.35, 0.86);
  const outer = new THREE.Mesh(new THREE.ExtrudeGeometry(hdmiShape(2.35, 0.86), {
    depth: 0.38, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.025, bevelSegments: 2,
  }), material(C.edge, 0.26, 0.86));
  outer.position.z = -0.05; outer.castShadow = true; g.add(outer);
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(hdmiShape(1.98, 0.58)), material(C.black, 0.72));
  inner.position.z = 0.37; g.add(inner);
  const contacts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.035, 0.045), material(C.gold, 0.3, 0.82), 19);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 19; i++) {
    const row = i < 10 ? 0 : 1; const n = row === 0 ? i : i - 10; const count = row === 0 ? 10 : 9;
    dummy.position.set((n - (count - 1) / 2) * 0.17, row === 0 ? 0.14 : -0.12, 0.415);
    dummy.updateMatrix(); contacts.setMatrixAt(i, dummy.matrix);
  }
  g.add(contacts);
  return g;
}

function makeHeadphonePort() {
  const g = new THREE.Group(); portBacking(g, 1.15, 1.15);
  place(g, box(1.15, 1.15, 0.42, material(C.aluminumDark, 0.3, 0.8), 0.32, 5));
  const well = cylinder(0.43, 0.4, material(C.black, 0.75), 40); well.rotation.x = Math.PI / 2;
  place(g, well, 0, 0, 0.18);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.085, 10, 40), material(C.edge, 0.24, 0.9));
  place(g, ring, 0, 0, 0.4);
  for (const r of [0.13, 0.23]) {
    const contact = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 28), material(C.gold, 0.3, 0.82));
    place(g, contact, 0, 0, 0.41);
  }
  return g;
}

function makeSDXCPort() {
  const g = new THREE.Group(); portBacking(g, 3.35, 0.5);
  place(g, box(3.35, 0.5, 0.42, material(C.edge, 0.26, 0.86), 0.14, 4));
  place(g, box(3.02, 0.17, 0.065, material(C.black, 0.75), 0.07, 3), 0, 0, 0.25);
  const contacts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.06, 0.08), material(C.gold, 0.3, 0.82), 9);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 9; i++) {
    dummy.position.set((i - 4) * 0.25, 0, 0.32); dummy.updateMatrix(); contacts.setMatrixAt(i, dummy.matrix);
  }
  g.add(contacts);
  return g;
}

function makeBottom() {
  const g = new THREE.Group();
  place(g, box(30.96, 0.12, 21.82, material(C.aluminum, 0.35, 0.82), 0.5, 5));
  place(g, box(15.2, 0.05, 10.2, material(C.aluminumDark, 0.48, 0.6), 0.2), 0, 0.085, 0.5);
  for (const x of [-12.8, 12.8]) {
    for (const z of [-8.2, 8.2]) {
      place(g, cylinder(0.74, 0.18, material(C.graphite, 0.78), 32), x, -0.17, z);
    }
  }
  const screwMat = material(0x4a514f, 0.35, 0.75);
  [[-14.2, -9.8], [14.2, -9.8], [-14.2, 9.8], [14.2, 9.8], [-7, 10.1], [7, 10.1], [-7, -10.1], [7, -10.1]].forEach(([x, z]) => {
    place(g, cylinder(0.13, 0.06, screwMat, 12), x, 0.075, z);
  });
  return g;
}

function makeHinge() {
  const g = new THREE.Group();
  const hingeMat = material(0x414947, 0.3, 0.8);
  const barrel = cylinder(0.48, 24.8, hingeMat, 32);
  barrel.rotation.z = Math.PI / 2;
  g.add(barrel);
  for (const x of [-10.6, 10.6]) {
    place(g, box(3.4, 0.52, 1.6, material(C.aluminumDark, 0.36, 0.72), 0.15), x, -0.25, 0.2);
    place(g, cylinder(0.18, 0.58, material(C.gold, 0.35, 0.7), 16), x, 0.1, 0.2);
  }
  return g;
}

const TRANSFORMS = {
  display:  { home: [[0, 10.33, -13.96], [-20, 0, 0], 1], exploded: [[0, 13.2, -17], [-20, 0, 0], 1], tile: [[-31.5, 0.45, -12.7], [-90, 0, 0], 0.74] },
  keyboard: { home: [[0, 0.59, -3.65], [0, 0, 0], 1], exploded: [[0, 10.6, -3.65], [0, 0, 0], 1], tile: [[-3, 0.5, -19], [0, 0, 0], 0.68] },
  unibody:  { home: [[0, 0, 0], [0, 0, 0], 1], exploded: [[0, 0, 0], [0, 0, 0], 1], tile: [[31.5, 0.45, 13], [0, 0, 0], 0.7] },
  logic:    { home: [[0, -0.18, -4.7], [0, 0, 0], 1], exploded: [[0, 4.7, -4.7], [0, 0, 0], 1], tile: [[-3, 0.5, -7], [0, 0, 0], 0.88] },
  soc:      { home: [[0, 0.19, -4.6], [0, 0, 0], 1], exploded: [[0, 6.8, 2.2], [0, 0, 0], 1], tile: [[14, 0.5, -21], [0, 0, 0], 0.85] },
  memory:   { home: [[-5.2, 0.17, -4.4], [0, 0, 0], 1], exploded: [[-6.2, 6.1, 1.5], [0, 0, 0], 1], tile: [[23, 0.5, -21], [0, 0, 0], 0.85] },
  storage:  { home: [[5.2, 0.17, -4.4], [0, 0, 0], 1], exploded: [[6.2, 5.7, 1.5], [0, 0, 0], 1], tile: [[33, 0.5, -21], [0, 0, 0], 0.85] },
  thermal:  { home: [[0, -0.12, -6.6], [0, 0, 0], 1], exploded: [[0, 8.2, 4.8], [0, 0, 0], 1], tile: [[-3, 0.5, 2], [0, 0, 0], 0.82] },
  battery:  { home: [[0, 0.12, 4.25], [0, 0, 0], 1], exploded: [[0, 2.8, 4.25], [0, 0, 0], 1], tile: [[-3, 0.5, 15.5], [0, 0, 0], 0.72] },
  trackpad: { home: [[0, 0.47, 6.7], [0, 0, 0], 1], exploded: [[0, 4.1, 6.7], [0, 0, 0], 1], tile: [[32, 0.5, -3], [0, 0, 0], 0.82] },
  speakers: { home: [[0, 0.05, 0], [0, 0, 0], 1], exploded: [[0, 2.4, 0], [0, 0, 0], 1], tile: [[32, 0.5, -13.5], [0, 0, 0], 0.52] },
  bottom:   { home: [[0, -0.6, 0], [0, 0, 0], 1], exploded: [[0, -3.3, 0], [0, 0, 0], 1], tile: [[-31.5, 0.45, 13.5], [0, 0, 0], 0.64] },
  hinge:    { home: [[0, 0.52, -10.35], [0, 0, 0], 1], exploded: [[0, 1.9, -11.2], [0, 0, 0], 1], tile: [[-3, 0.5, -12.3], [0, 0, 0], 1] },
  magsafe:  { home: [[-15.1, 0, -7.4], [0, -90, 0], 1], exploded: [[-17.2, 3.7, -7.4], [0, -90, 0], 1.15], tile: [[-5, 0.6, 24], [-90, 0, 0], 1.35] },
  usbcLeft1:{ home: [[-15.1, 0, -4.6], [0, -90, 0], 1], exploded: [[-17.2, 4.2, -4.6], [0, -90, 0], 1.15], tile: [[3, 0.6, 24], [-90, 0, 0], 1.6] },
  usbcLeft2:{ home: [[-15.1, 0, -2.2], [0, -90, 0], 1], exploded: [[-17.2, 4.2, -2.2], [0, -90, 0], 1.15], tile: [[10, 0.6, 24], [-90, 0, 0], 1.6] },
  usbcRight:{ home: [[15.1, 0, -3.5], [0, 90, 0], 1], exploded: [[17.2, 4.2, -3.5], [0, 90, 0], 1.15], tile: [[17, 0.6, 24], [-90, 0, 0], 1.6] },
  hdmi:     { home: [[15.1, 0, -6.7], [0, 90, 0], 1], exploded: [[17.2, 3.7, -6.7], [0, 90, 0], 1.15], tile: [[26, 0.6, 24], [-90, 0, 0], 1.25] },
  headphone:{ home: [[-15.1, 0, 0.7], [0, -90, 0], 1], exploded: [[-17.2, 3.7, 0.7], [0, -90, 0], 1.15], tile: [[-15, 0.6, 24], [-90, 0, 0], 1.5] },
  sdxc:     { home: [[15.1, 0, -0.2], [0, 90, 0], 1], exploded: [[17.2, 3.7, -0.2], [0, 90, 0], 1.15], tile: [[37, 0.6, 24], [-90, 0, 0], 1.25] },
};

function eulerQuaternion(degrees) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(degrees[0]), THREE.MathUtils.degToRad(degrees[1]), THREE.MathUtils.degToRad(degrees[2]),
  ));
}

export function createMacBook(rand) {
  const root = new THREE.Group();
  root.name = 'MacBook Pro 14 — reference study';
  const keyMap = new Map();
  const builders = {
    display: makeDisplay,
    keyboard: () => makeKeyboard(keyMap),
    unibody: makeUnibody,
    logic: () => makeLogicBoard(rand),
    soc: () => makeChipPack('soc'),
    memory: () => makeChipPack('memory'),
    storage: () => makeChipPack('storage'),
    thermal: makeThermal,
    battery: makeBattery,
    trackpad: makeTrackpad,
    speakers: makeSpeakers,
    bottom: makeBottom,
    hinge: makeHinge,
    magsafe: makeMagSafe,
    usbcLeft1: makeUSBCPort,
    usbcLeft2: makeUSBCPort,
    usbcRight: makeUSBCPort,
    hdmi: makeHDMIPort,
    headphone: makeHeadphonePort,
    sdxc: makeSDXCPort,
  };
  const parts = PART_INFO.map((info) => {
    const group = builders[info.id]();
    group.name = info.name;
    group.userData.partId = info.id;
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.userData.partId = info.id;
      if (obj.material && !obj.isInstancedMesh) {
        obj.material = obj.material.clone();
        obj.material.userData.baseOpacity = obj.material.opacity;
        obj.material.userData.baseEmissive = obj.material.emissive?.clone() || null;
      }
      obj.userData.filterAlpha = 1;
    });
    const t = TRANSFORMS[info.id];
    const states = {};
    for (const key of ['home', 'exploded', 'tile']) {
      const [position, rotation, scale] = t[key];
      states[key] = {
        position: new THREE.Vector3(...position),
        quaternion: eulerQuaternion(rotation),
        scale: new THREE.Vector3().setScalar(scale),
      };
    }
    group.position.copy(states.home.position);
    group.quaternion.copy(states.home.quaternion);
    group.scale.copy(states.home.scale);
    root.add(group);
    return { info, group, states, filterTarget: 1 };
  });
  return { root, parts, keyMap };
}
