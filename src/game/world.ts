import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, riverX, noise, fbm, random, canvasTexture, pavementTexture, taperedTube, ellipsoid, box, batchRigidParts } from './materials';
import type { Materials } from './materials';
import type { Simulation } from './simulation';
import { facadeTexture } from './facade';
import { appendUrbanBuilding, createUrbanBuckets } from './architecture';
import type { UrbanKind, UrbanSurface } from './architecture';
import { DistrictStreamer } from './streaming';
import { createCityLife } from './cityLife';
import type { Settings } from './types';

const vertexSky = `varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const fragmentSky = `
varying vec3 vWorld; uniform vec3 uTop;uniform vec3 uHorizon;uniform float uTime;uniform float uStorm;uniform sampler2D uCloud;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,n=0.;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+5.2;a*=.5;}return n;}
void main(){
 vec3 d=normalize(vWorld-cameraPosition);float y=max(d.y,0.);vec3 col=mix(uHorizon,uTop,pow(y,.38));
 vec3 moon=normalize(vec3(-.6,.34,-.6));float s=max(dot(d,moon),0.);
 col+=vec3(.34,.42,.66)*pow(s,90.)*(1.-uStorm*.85);
 col+=vec3(.5,.58,.8)*pow(s,900.)*(1.-uStorm);
 // Neon city glow hugging the horizon.
 col+=vec3(.5,.22,.4)*pow(1.-y,7.)*(.5+uStorm*.1);
 col+=vec3(.1,.34,.44)*pow(1.-y,3.5)*.35;
 vec2 uv=d.xz/(y+.28)*1.4+vec2(uTime*.003,0.);float clouds=texture2D(uCloud,uv*.12).r;
 float cover=smoothstep(.47-uStorm*.13,.73,clouds)*smoothstep(.015,.14,y);
 col=mix(col,mix(vec3(.16,.19,.3),vec3(.1,.12,.17),uStorm),cover*.8);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

/** Mottled plane-tree (梧桐) bark: olive / grey / tan camo patches. */
function barkTexture() {
  return canvasTexture((ctx, s) => {
    const rng = random(97);
    ctx.fillStyle = '#6a6357'; ctx.fillRect(0, 0, s, s);
    const tones = ['#8a8578', '#6f7a66', '#9c9484', '#5c554a', '#7d7568', '#a8a191'];
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = tones[rng() * tones.length | 0];
      ctx.globalAlpha = .55 + rng() * .4;
      ctx.beginPath(); ctx.ellipse(rng() * s, rng() * s, 5 + rng() * 13, 9 + rng() * 20, rng() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 24; i++) { ctx.fillStyle = 'rgba(40,36,30,.4)'; ctx.fillRect(rng() * s, 0, 1 + rng() * 2, s); }
  }, 128);
}

export class World {
  root = new THREE.Group();
  sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
  grass: THREE.InstancedMesh;
  grassShader: { uniforms: Record<string, { value: unknown }> } | null = null;
  water: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  amberMotes: THREE.Points;
  rain: THREE.LineSegments;
  motes: THREE.Points;
  resourceModels = new Map<string, THREE.Group>();
  campFire: THREE.PointLight;
  private weatherBlend = 0;
  private birds: THREE.Group[] = [];
  private animals: THREE.Group[] = [];
  private rainPositions: Float32Array;
  private scoutPositions: Float32Array;
  private rng = random(41);
  private scene: THREE.Scene;
  private streaming: DistrictStreamer;
  private cityLife: ReturnType<typeof createCityLife>;
  private skyColors = { top: new THREE.Color('#0a0f24'), horizon: new THREE.Color('#273054') };
  private stormTop = new THREE.Color('#131722');
  private stormHorizon = new THREE.Color('#3a4258');
  private clearFog = new THREE.Color('#182238');
  private stormFog = new THREE.Color('#2b3346');
  private baseGrassCount = 0;
  private reducedMotion = false;

  constructor(scene: THREE.Scene, materials: Materials, simulation: Simulation, _loader: THREE.TextureLoader) {
    this.scene = scene; scene.add(this.root);
    scene.fog = new THREE.FogExp2('#182238', .0038);
    const clouds = canvasTexture((ctx, size) => {
      const image = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const n = Math.floor(fbm(x / size * 9, y / size * 9) * 255), i = (y * size + x) * 4; image.data[i] = image.data[i + 1] = image.data[i + 2] = n; image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    }, 256); clouds.colorSpace = THREE.NoColorSpace;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
      vertexShader: vertexSky, fragmentShader: fragmentSky, side: THREE.BackSide, depthWrite: false,
      uniforms: { uTop: { value: this.skyColors.top.clone() }, uHorizon: { value: this.skyColors.horizon.clone() }, uTime: { value: 0 }, uStorm: { value: 0 }, uCloud: { value: clouds } },
    })); scene.add(this.sky);
    this.ambient = new THREE.HemisphereLight('#667aa8', '#282234', 3.05); scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#c3d3ff', 3.05); this.sun.position.set(-48, 65, 35); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.camera.left = -43; this.sun.shadow.camera.right = 43;
    this.sun.shadow.camera.top = 43; this.sun.shadow.camera.bottom = -43; this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 175;
    this.sun.shadow.normalBias = .07; this.sun.shadow.bias = -.0003; this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#e2a279', 1.05); fill.position.set(20, 15, -40); scene.add(fill);
    const streetBounce = new THREE.DirectionalLight('#5ebbc1', .65); streetBounce.position.set(-12, 8, 28); scene.add(streetBounce);

    // Plaza pavement.
    const pavement = pavementTexture();
    const groundMat = new THREE.MeshStandardMaterial({ map: pavement, roughness: .96, vertexColors: true });
    const terrainGeo = new THREE.PlaneGeometry(340, 340, 120, 120); terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position, colors = [];
    const low = new THREE.Color('#647082'), high = new THREE.Color('#8993a0');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, groundHeight(x, z));
      const c = low.clone().lerp(high, noise(x * .05 + 12, z * .05 + 13)); colors.push(c.r, c.g, c.b);
    }
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrainGeo.computeVertexNormals();
    const ground = new THREE.Mesh(terrainGeo, groundMat); ground.receiveShadow = true; this.root.add(ground);
    this.createStreetDetails();

    this.createSkyline(simulation);
    this.createLandmarks(materials, simulation);
    this.createBollards(simulation);
    this.createTrees();
    this.createStreetLamps(simulation);
    for (const [x, z] of [[-28, -29], [-34, 5], [38, -49], [43, 17], [-19, -51], [-60, -20], [62, -26], [-41, 31], [7, -77], [51, 54], [-10, 14], [13, 7], [-12, -8], [12, 32]]) simulation.colliders.push({ x, z, radius: .4 });
    this.grass = this.createGrass(); this.baseGrassCount = this.grass.count; this.root.add(this.grass);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(230, 280, 64, 88), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uStorm: { value: 0 } },
      vertexShader: `varying vec3 vPos;uniform float uTime;void main(){vec3 p=position;float ripple=sin(p.x*.72+p.y*.31+uTime*1.7)*.055+sin(p.y*1.1-uTime*2.2)*.025;p.z+=ripple;vec4 world=modelMatrix*vec4(p,1.);vPos=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `varying vec3 vPos;uniform float uTime;uniform float uStorm;void main(){
        float river=25.+8.*sin(vPos.z*.033)+3.*sin(vPos.z*.082);float d=abs(vPos.x-river);if(d>6.2)discard;
        float wave=sin(vPos.x*7.+vPos.z*3.+uTime*1.8)*sin(vPos.z*9.-uTime)*.5+.5;
        float flow=sin(vPos.z*4.2+uTime*3.1+sin(vPos.x*2.3+uTime)*1.4)*.5+.5;
        float crossWave=sin(vPos.x*11.-vPos.z*2.4-uTime*2.6)*.5+.5;
        float glint=pow(wave,18.);float streak=pow(flow,22.)*pow(crossWave,3.);
        vec3 col=mix(vec3(.025,.065,.105),vec3(.075,.17,.21),wave*.32+flow*.12);
        col+=glint*.16+vec3(.25,.52,.58)*streak*.32;col+=vec3(.4,.18,.32)*glint*.25;
        float shore=smoothstep(4.7,5.7,d)*(1.-smoothstep(5.7,6.2,d));col+=vec3(.25,.38,.4)*shore*(.25+flow*.45);
        float a=(1.-smoothstep(5.5,6.2,d))*.88;gl_FragColor=vec4(col*(1.-uStorm*.25),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    })); this.water.rotation.x = -Math.PI / 2; this.water.position.y = -.55; this.root.add(this.water);
    this.scoutPositions = new Float32Array(70 * 3);
    const scoutGeo = new THREE.BufferGeometry(); scoutGeo.setAttribute('position', new THREE.BufferAttribute(this.scoutPositions, 3));
    const particle = canvasTexture(ctx => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(.12, 'rgba(255,220,150,.9)'); g.addColorStop(.5, 'rgba(255,190,90,.13)'); g.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); }, 64);
    this.amberMotes = new THREE.Points(scoutGeo, new THREE.PointsMaterial({ map: particle, color: '#ffd27a', size: .27, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9 })); this.root.add(this.amberMotes);
    const motePositions = new Float32Array(180 * 3); for (let i = 0; i < 180; i++) { motePositions[i * 3] = (this.rng() - .5) * 95; motePositions[i * 3 + 1] = this.rng() * 9 + .3; motePositions[i * 3 + 2] = (this.rng() - .5) * 80; }
    const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    this.motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: particle, color: '#9db4e8', size: .095, transparent: true, opacity: .5, depthWrite: false })); this.root.add(this.motes);
    this.rainPositions = new Float32Array(850 * 6); for (let i = 0; i < 850; i++) { const x = (this.rng() - .5) * 75, y = this.rng() * 26, z = (this.rng() - .5) * 75; this.rainPositions.set([x, y, z, x - .3, y - 1, z], i * 6); }
    const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#9fb4d8', transparent: true, opacity: 0, depthWrite: false })); this.root.add(this.rain);
    this.createResources(simulation, materials);
    this.campFire = this.createCamp(materials, simulation);
    this.createWildlife();
    this.cityLife = createCityLife(this.root, simulation);
    this.streaming = new DistrictStreamer(this.root, simulation);
    this.streaming.update(simulation.player, true);
  }

  updateStreaming(player: { x: number; z: number }, immediate = false) { this.streaming.update(player, immediate); }
  get streamingStats() { return this.streaming.stats; }
  get cityFeatures() { return this.cityLife.features; }
  nearestCityFeature(player: { x: number; z: number }) {
    const river = { kind: 'river' as const, label: '黄浦江水声', x: riverX(player.z), z: player.z };
    const features = [...this.cityLife.features.filter(feature => feature.kind !== 'river'), river];
    return features.map(feature => ({ ...feature, distance: Math.hypot(feature.x - player.x, feature.z - player.z) })).sort((a, b) => a.distance - b.distance)[0];
  }
  setQuality(settings: Settings, software: boolean) {
    const quality = settings.quality;
    const grassRatio = quality === 'high' ? software ? .55 : 1 : quality === 'balanced' ? .55 : .25;
    this.grass.count = Math.max(1, Math.floor(this.baseGrassCount * grassRatio));
    this.motes.visible = quality !== 'low';
    this.rain.geometry.setDrawRange(0, quality === 'high' ? 1700 : quality === 'balanced' ? 1000 : 560);
    this.streaming.setQuality(quality, software);
    this.reducedMotion = settings.reducedMotion;
  }
  dispose() { this.streaming.dispose(); }

  private createStreetDetails() {
    const paintGeos: THREE.BufferGeometry[] = [];
    for (let z = -74; z < 76; z += 5.2) {
      const x = 3 + Math.sin(z * .045) * 6, stripe = new THREE.BoxGeometry(.11, .025, 1.9);
      stripe.translate(x, groundHeight(x, z) + .035, z); paintGeos.push(stripe);
    }
    for (let i = 0; i < 8; i++) {
      const z = 18.2 + i * .55, x = 3 + Math.sin(z * .045) * 6, stripe = new THREE.BoxGeometry(5.4, .028, .27);
      stripe.translate(x, groundHeight(x, z) + .045, z); paintGeos.push(stripe);
    }
    const paint = new THREE.Mesh(mergeGeometries(paintGeos)!, new THREE.MeshStandardMaterial({ color: '#c8bd94', roughness: .82 }));
    paint.receiveShadow = true; this.root.add(paint); paintGeos.forEach(g => g.dispose());
  }

  /** Five architectural languages share material batches, not one repeated box silhouette. */
  private createSkyline(simulation: Simulation) {
    const facadeMaterials = ([
      { seed: 7, style: 'glass' as const, color: '#a7b9c9' },
      { seed: 19, style: 'residence' as const, color: '#b6b7bd' },
      { seed: 53, style: 'stone' as const, color: '#c4b9a9' },
      { seed: 83, style: 'brick' as const, color: '#c79582' },
    ]).map(({ seed, style, color }) => {
      const texture = facadeTexture(seed, style === 'glass' ? .36 : .32, style);
      return new THREE.MeshStandardMaterial({ map: texture.map, emissiveMap: texture.emissive, emissive: style === 'glass' ? '#b8e7ef' : '#ffe0b2', emissiveIntensity: .7, color, roughness: style === 'glass' ? .48 : .9, metalness: style === 'glass' ? .16 : 0 });
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#7b8290', roughness: .64, metalness: .28 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#252c3b', roughness: .8, metalness: .16 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#252b35', roughness: .94 });
    const glowMat = new THREE.MeshStandardMaterial({ color: '#f0cf92', emissive: '#ffc875', emissiveIntensity: 1.1, roughness: .5 });
    const accentMat = new THREE.MeshStandardMaterial({ color: '#b68d55', emissive: '#60452c', emissiveIntensity: .35, roughness: .5, metalness: .4 });
    const materials: Record<UrbanSurface, THREE.Material> = {
      glass: facadeMaterials[0], residence: facadeMaterials[1], stone: facadeMaterials[2], brick: facadeMaterials[3],
      trim: trimMat, dark: darkMat, roof: roofMat, glow: glowMat, accent: accentMat,
    };
    const buckets = createUrbanBuckets();
    // x, z, half-width, height. Landmarks retain their own handcrafted models.
    const blocks: number[][] = [[-41, -73, 7, 34], [-54, -80, 9, 44], [-65, -91, 6, 30], [-27, -96, 7, 24], [-83, -61, 10, 28], [-99, -102, 14, 46], [47, -86, 8, 30], [61, -90, 7, 36], [71, -96, 10, 32], [95, -74, 12, 42], [24, -125, 12, 26], [-13, -139, 18, 50], [-95, -149, 22, 66], [80, -150, 20, 58], [-130, -90, 22, 56], [132, -125, 24, 60], [-72, 26, 8, 18], [76, 17, 10, 22], [-46, 56, 8, 16], [50, 67, 11, 20], [-110, -30, 14, 38], [110, -40, 16, 48], [-60, 96, 12, 24], [20, 100, 14, 30], [-100, 60, 10, 26], [90, 80, 12, 34]];
    blocks.forEach(([x, z, w, sourceHeight], i) => {
      let kind: UrbanKind = 'office';
      if (x > 30 && z < -20) kind = 'skyscraper';
      else if (z > 70 && x < 0) kind = 'campus';
      else if (z > 15 && x < -20) kind = x < -55 ? 'wutong' : 'lane';
      const h = kind === 'skyscraper' ? sourceHeight * 1.35 + 12
        : kind === 'lane' ? 6 + (i % 3) * 1.2
          : kind === 'wutong' ? 9 + (i % 4) * 1.8
            : kind === 'campus' ? 12 + (i % 2) * 3 : Math.max(17, sourceHeight);
      const surface = (kind === 'skyscraper' ? 0 : kind === 'campus' || kind === 'lane' ? 3 : i % 3) as 0 | 1 | 2 | 3;
      appendUrbanBuilding(buckets, { x, z, y: groundHeight(x, z) - .5, halfWidth: w, halfDepth: w, height: h, kind, variant: i % 4, surface });
      simulation.boxColliders.push({ x, z, halfWidth: w * 1.06, halfDepth: w * 1.06 });
    });
    for (const surface of Object.keys(buckets) as UrbanSurface[]) {
      const geos = buckets[surface];
      if (!geos.length) continue;
      const merged = mergeGeometries(geos); geos.forEach(g => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, materials[surface]); mesh.castShadow = surface !== 'glow'; mesh.receiveShadow = surface !== 'glow'; this.root.add(mesh);
    }
  }

  /** Signature Shanghai landmarks. */
  private createLandmarks(m: Materials, simulation: Simulation) {
    const steel = new THREE.MeshStandardMaterial({ color: '#5c667f', metalness: .5, roughness: .55 });
    const pearl = new THREE.MeshStandardMaterial({ color: '#c05a9e', emissive: '#ff5fc0', emissiveIntensity: .55, roughness: .35 });
    const pearlGlow = new THREE.MeshBasicMaterial({ color: '#ff7ad0' });
    const lujiazui = new THREE.Group(); this.root.add(lujiazui);
    // 东方明珠 Oriental Pearl Tower (east of the river).
    const pearlTower = new THREE.Group(); pearlTower.position.set(40, groundHeight(40, -30), -30); lujiazui.add(pearlTower);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.75, 1.15, 30, 10), steel); shaft.position.y = 15; shaft.castShadow = true; pearlTower.add(shaft);
    const big = new THREE.Mesh(new THREE.SphereGeometry(3.1, 20, 14), pearl); big.position.y = 14.5; pearlTower.add(big);
    const small = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12), pearl); small.position.y = 23; pearlTower.add(small);
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.42, 8, 6), pearlGlow); const a = i / 6 * Math.PI * 2; s.position.set(Math.cos(a) * 2.1, 10.5, Math.sin(a) * 2.1); pearlTower.add(s); }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 2.6, 10), steel); base.position.y = 1.3; pearlTower.add(base);
    simulation.colliders.push({ x: 40, z: -30, radius: 3.6 });
    // 上海中心 Shanghai Tower (stacked twisting tiers).
    const tower = new THREE.Group(); tower.position.set(55, groundHeight(55, -48), -48); lujiazui.add(tower);
    for (let i = 0; i < 7; i++) { const r = 2.6 - i * .3; const tier = new THREE.Mesh(new THREE.CylinderGeometry(r - .25, r, 6.4, 12), steel); tier.position.y = 3.2 + i * 6.3; tier.rotation.y = i * .32; tier.castShadow = true; tower.add(tier); }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(.08, .3, 4, 6), steel); spire.position.y = 48; tower.add(spire);
    simulation.colliders.push({ x: 55, z: -48, radius: 2.8 });
    // 环球金融中心 SWFC (twin pillars + crown).
    const swfc = new THREE.Group(); swfc.position.set(43, groundHeight(43, -66), -66); lujiazui.add(swfc);
    for (const sx of [-1.5, 1.5]) { const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 30, 4.4), steel); pillar.position.set(sx, 15, 0); pillar.castShadow = true; swfc.add(pillar); }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 4.4), steel); crown.position.y = 31.5; swfc.add(crown);
    simulation.boxColliders.push({ x: 43, z: -66, halfWidth: 2.6, halfDepth: 2.2 });
    // 金茂大厦 Jin Mao (setback pagoda tiers).
    const jinmao = new THREE.Group(); jinmao.position.set(60, groundHeight(60, -34), -34); lujiazui.add(jinmao);
    for (let i = 0; i < 6; i++) { const w = 5 - i * .68; const tier = new THREE.Mesh(new THREE.BoxGeometry(w, 5.4, w), steel); tier.position.y = 2.7 + i * 5.3; tier.castShadow = true; jinmao.add(tier); }
    simulation.boxColliders.push({ x: 60, z: -34, halfWidth: 2.5, halfDepth: 2.5 });
    [pearlTower, tower, swfc, jinmao].forEach(group => batchRigidParts(group));
    // 外滩万国建筑群 The Bund — colonial row on the west bank.
    const bund = new THREE.Group(); this.root.add(bund);
    const bundTex = facadeTexture(31, .46, 'stone');
    const bundMat = new THREE.MeshStandardMaterial({ map: bundTex.map, emissiveMap: bundTex.emissive, emissive: '#ffd9a0', emissiveIntensity: .65, color: '#d0bea5', roughness: .92 });
    const bundTrim = new THREE.MeshStandardMaterial({ color: '#a89478', roughness: .84 });
    for (let i = 0; i < 7; i++) {
      const z = -52 + i * 10.5, h = 8 + (i % 3) * 2.4, y = groundHeight(13.5, z);
      const bld = new THREE.Mesh(new THREE.BoxGeometry(6, h, 8), bundMat); bld.position.set(13.5, y + h / 2, z); bld.castShadow = true; bund.add(bld);
      box(bund, bundTrim, [13.5, y + .28, z], [6.45, .56, 8.4]);
      box(bund, bundTrim, [13.5, y + h - .18, z], [6.5, .36, 8.45]);
      for (const side of [-1, 1]) {
        for (const dz of [-3, 0, 3]) box(bund, bundTrim, [13.5 + side * 3.08, y + h * .48, z + dz], [.18, h * .88, .24]);
        for (let floor = 3.2; floor < h - 1; floor += 3.2) box(bund, bundTrim, [13.5 + side * 3.1, y + floor, z], [.16, .14, 8.15]);
      }
      const pediment = new THREE.Mesh(new THREE.CylinderGeometry(0, 3.4, 1.8, 4), bundTrim); pediment.position.set(13.5, y + h + .9, z); pediment.rotation.y = Math.PI / 4; bund.add(pediment);
      simulation.boxColliders.push({ x: 13.5, z, halfWidth: 3.25, halfDepth: 4.22 });
    }
    batchRigidParts(bund);
    // 外白渡桥 Waibaidu Bridge — steel truss arches over the river.
    const bridge = new THREE.Group(); bridge.position.set(riverX(30), 0, 30); this.root.add(bridge);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(15, .7, 3.4), steel); deck.position.y = 1.1; bridge.add(deck);
    for (const side of [-1.6, 1.6]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(5.4, .22, 6, 22, Math.PI), steel);
      arch.position.set(0, 1.1, side); arch.rotation.y = Math.PI / 2; bridge.add(arch);
      for (let i = -3; i <= 3; i++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.6, 5), steel); post.position.set(i * 1.5, 2.2, side); bridge.add(post); }
    }
    batchRigidParts(bridge);
    // 石库门 Shikumen lane near the night market.
    const shikumenMat = new THREE.MeshStandardMaterial({ color: '#4a4f60', roughness: .95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#23262f', roughness: .9 });
    for (let i = 0; i < 4; i++) {
      const x = -27 + (i % 2) * 7, z = 38 + Math.floor(i / 2) * 8;
      const house = new THREE.Group(); house.position.set(x, groundHeight(x, z), z); this.root.add(house);
      box(house, shikumenMat, [0, 2.2, 0], [5.4, 4.4, 4.6]);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 3.6, 1.6, 4), roofMat); roof.position.y = 5.2; roof.rotation.y = Math.PI / 4; roof.scale.set(1.06, 1, .92); roof.castShadow = true; house.add(roof);
      box(house, m.dark, [0, 1.1, 2.32], [1.2, 2.2, .12]);
      box(house, new THREE.MeshStandardMaterial({ color: '#d9b96c', emissive: '#ffca6a', emissiveIntensity: .7 }), [-1.6, 2.6, 2.32], [.8, 1, .1]);
      box(house, new THREE.MeshStandardMaterial({ color: '#d9b96c', emissive: '#ffca6a', emissiveIntensity: .7 }), [1.6, 2.6, 2.32], [.8, 1, .1]);
      simulation.boxColliders.push({ x, z, halfWidth: 2.7, halfDepth: 2.3 });
    }
    // Neon signboards along the pedestrian street, each with a glowing glyph.
    const neon = [
      { c: '#ff4fd8', glyph: '串' }, { c: '#37e0ff', glyph: '面' },
      { c: '#ffd24a', glyph: '当' }, { c: '#7dff9a', glyph: '酒' },
    ];
    const glyphTexture = (color: string, glyph: string) => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 192;
      const g = cv.getContext('2d')!;
      g.fillStyle = '#0c0f1c'; g.fillRect(0, 0, 64, 192);
      g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(5, 5, 54, 182);
      g.fillStyle = color; g.font = '400 46px NightTitle, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) g.fillText(glyph, 32, 46 + i * 56);
      const t = new THREE.CanvasTexture(cv); t.anisotropy = 2; return t;
    };
    neon.forEach((n, i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 5.4, 6), steel);
      const x = -8 + i * 6.5, z = -8 + (i % 2) * 22;
      pole.position.set(x, groundHeight(x, z) + 2.7, z); this.root.add(pole);
      simulation.colliders.push({ x, z, radius: .14 });
      const tex = glyphTexture(n.c, n.glyph);
      const frameMat = new THREE.MeshStandardMaterial({ color: '#141828', roughness: .6, metalness: .35 });
      const faceMat = new THREE.MeshBasicMaterial({ map: tex });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(.9, 3, .28), [frameMat, frameMat, frameMat, frameMat, faceMat, faceMat]);
      sign.position.set(x, groundHeight(x, z) + 4.6, z); this.root.add(sign);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, .8, .24), frameMat);
      bar.position.set(x, groundHeight(x, z) + 3.3, z); this.root.add(bar);
      const barFace = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .6), faceMat.clone());
      (barFace.material as THREE.MeshBasicMaterial).map!.repeat.set(1, .33); (barFace.material as THREE.MeshBasicMaterial).map!.offset.set(0, .33);
      barFace.position.set(x, groundHeight(x, z) + 3.3, z + .13); this.root.add(barFace);
    });
  }

  /** Stone bollards guarding the plaza (was: boulders). */
  private createBollards(simulation: Simulation) {
    const mat = new THREE.MeshStandardMaterial({ color: '#454a5c', roughness: .9 });
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 90; i++) {
      const x = (this.rng() - .5) * 185, z = (this.rng() - .5) * 175;
      if (Math.abs(x) < 15 && z > -30 && z < 31) continue;
      if (Math.abs(x - riverX(z)) < 9) continue;
      const h = .5 + this.rng() * .5, r = .22 + this.rng() * .18;
      const g = new THREE.CylinderGeometry(r * .8, r, h, 7);
      g.translate(x, groundHeight(x, z) + h / 2 - .06, z); geos.push(g);
      simulation.colliders.push({ x, z, radius: r + .05 });
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos)!, mat); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh); geos.forEach(g => g.dispose());
  }

  private createGrass() {
    const geometry = new THREE.PlaneGeometry(.06, 1, 1, 2); geometry.translate(0, .5, 0);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * .95)); p.setZ(i, y * y * .23); }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: '#3c5c46', side: THREE.DoubleSide, roughness: 1 });
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = { value: 0 }; shader.uniforms.uWind = { value: 1 }; this.grassShader = shader;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;uniform float uWind;varying float vBlade;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vBlade=position.y;vec4 base=instanceMatrix*vec4(0.,0.,0.,1.);
        float wind=sin(base.x*.35+base.z*.24+uTime*1.7)*.11+sin(base.x*.7-base.z*.32+uTime*2.8)*.055;
        transformed.x+=wind*position.y*position.y*uWind;transformed.z+=wind*position.y*.4;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBlade;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.28,.38,.3),vec3(.95,1.05,.85),sqrt(vBlade));');
    };
    const count = 7000, mesh = new THREE.InstancedMesh(geometry, material, count), dummy = new THREE.Object3D(); let n = 0;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = (this.rng() - .5) * 150, z = (this.rng() - .5) * 145;
      const pathX = 3 + Math.sin(z * .045) * 6, river = Math.abs(x - riverX(z));
      const density = fbm(x * .13 + 4, z * .13 + 7);
      if (river < 6.5 || Math.abs(x - pathX) < (2.2 + this.rng() * 2.4) || this.rng() > density * 1.35) continue;
      const height = .09 + this.rng() * .2;
      dummy.position.set(x, groundHeight(x, z) - .03, z); dummy.rotation.set(0, this.rng() * Math.PI * 2, (this.rng() - .5) * .2);
      dummy.scale.set(.8 + this.rng() * .7, height, 1); dummy.updateMatrix(); mesh.setMatrixAt(n, dummy.matrix);
      c.setHSL(.27 + this.rng() * .12, .3 + this.rng() * .2, .3 + this.rng() * .22); mesh.setColorAt(n, c); n++;
    }
    mesh.count = n; mesh.receiveShadow = true; mesh.frustumCulled = false; return mesh;
  }

  /** Plane trees with crooked trunks, branching silhouettes and faceted, layered crowns. */
  private createTrees() {
    const bark = barkTexture();
    const trunkMat = new THREE.MeshStandardMaterial({ map: bark, color: '#c6bdab', roughness: .95 });
    const leafMats = ['#3c654d', '#527a54', '#315846', '#68865a', '#294b40'].map(color =>
      new THREE.MeshStandardMaterial({ color, roughness: .92, flatShading: true })
    );
    const lightMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
    const positions = [[-28, -29, 1.2], [-34, 5, 1.1], [38, -49, 1.4], [43, 17, 1], [-19, -51, .85], [-60, -20, 1.2], [62, -26, 1.5], [-41, 31, 1.2], [7, -77, .95], [51, 54, 1.4], [-10, 14, 1.05], [13, 7, 1.15], [-12, -8, .95], [12, 32, 1.1]];
    positions.forEach(([x, z, s], idx) => {
      const group = new THREE.Group(); group.position.set(x, groundHeight(x, z), z); this.root.add(group);
      const rng = random(200 + idx * 13), lean = (rng() - .5) * .35 * s;
      group.add(taperedTube([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * .25, 1.35 * s, .04 * s),
        new THREE.Vector3(lean, 2.75 * s, -.08 * s), new THREE.Vector3(lean * .7, 3.65 * s, 0),
      ], [.25 * s, .21 * s, .14 * s, .07 * s], trunkMat, 8, 10));
      const crownAnchors: THREE.Vector3[] = [];
      for (let b = 0; b < 6; b++) {
        const a = b / 6 * Math.PI * 2 + rng() * .5, reach = (1.05 + rng() * .7) * s;
        const start = new THREE.Vector3(lean * .75, (2.45 + rng() * .75) * s, 0);
        const mid = new THREE.Vector3(Math.cos(a) * reach * .48, start.y + .48 * s, Math.sin(a) * reach * .48);
        const end = new THREE.Vector3(Math.cos(a) * reach, (3.75 + rng() * .65) * s, Math.sin(a) * reach);
        group.add(taperedTube([start, mid, end], [.1 * s, .065 * s, .018 * s], trunkMat, 6, 6));
        crownAnchors.push(end);
      }
      crownAnchors.push(new THREE.Vector3(lean * .5, 4.65 * s, 0));
      crownAnchors.forEach((anchor, p) => {
        const clusters = p === crownAnchors.length - 1 ? 3 : 2;
        for (let k = 0; k < clusters; k++) {
          const geo = new THREE.IcosahedronGeometry(1, 1);
          const leaf = new THREE.Mesh(geo, leafMats[(p + k + (rng() * 2 | 0)) % leafMats.length]);
          leaf.position.copy(anchor).add(new THREE.Vector3((rng() - .5) * .75 * s, (rng() - .5) * .55 * s, (rng() - .5) * .75 * s));
          leaf.scale.set((.75 + rng() * .42) * s, (.6 + rng() * .35) * s, (.72 + rng() * .44) * s);
          leaf.rotation.set(rng() * .6, rng() * Math.PI, rng() * .4); leaf.castShadow = true; leaf.receiveShadow = true; group.add(leaf);
        }
      });
      batchRigidParts(group);
      if (idx < 2) {
        const lights = new THREE.Group(); group.add(lights);
        for (let k = 0; k < 26; k++) {
          const f = k / 26, a = f * Math.PI * 6, r = (1.05 + f * .5) * s;
          ellipsoid(lights, lightMat, [Math.cos(a) * r, (3.25 + f * 1.8) * s, Math.sin(a) * r], [.04 * s, .04 * s, .04 * s]);
        }
        batchRigidParts(lights);
      }
    });
  }

  /** Street lamps along the pedestrian street: merged poles + warm heads + glow points. */
  private createStreetLamps(simulation: Simulation) {
    const poleMat = new THREE.MeshStandardMaterial({ color: '#2c3242', metalness: .4, roughness: .6 });
    const headMat = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffca7a', emissiveIntensity: 1.4 });
    const poleGeos: THREE.BufferGeometry[] = [], headGeos: THREE.BufferGeometry[] = [], glowPos: number[] = [];
    for (let i = 0; i < 9; i++) {
      const z = -56 + i * 14, side = i % 2 ? 1 : -1;
      const x = 3 + Math.sin(z * .045) * 6 + side * 4.2;
      const y = groundHeight(x, z);
      const pole = new THREE.CylinderGeometry(.07, .1, 4.4, 6); pole.translate(x, y + 2.2, z); poleGeos.push(pole);
      const arm = new THREE.CylinderGeometry(.045, .045, 1.1, 5); arm.rotateZ(Math.PI / 2 - side * .5);
      arm.translate(x - side * .5, y + 4.35, z); poleGeos.push(arm);
      const head = new THREE.SphereGeometry(.17, 8, 6); head.translate(x - side, y + 4.55, z); headGeos.push(head);
      glowPos.push(x - side, y + 4.55, z);
      simulation.colliders.push({ x, z, radius: .24 });
    }
    const poles = new THREE.Mesh(mergeGeometries(poleGeos)!, poleMat); poles.castShadow = true; this.root.add(poles);
    const heads = new THREE.Mesh(mergeGeometries(headGeos)!, headMat); this.root.add(heads);
    poleGeos.forEach(g => g.dispose()); headGeos.forEach(g => g.dispose());
    const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
    const glowTex = canvasTexture((ctx, s) => {
      const g2 = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g2.addColorStop(0, 'rgba(255,214,150,.9)'); g2.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, s, s);
    }, 64);
    const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({ map: glowTex, size: 2.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.root.add(glow);
  }

  private createResources(sim: Simulation, m: Materials) {
    for (const r of sim.resources) {
      const group = new THREE.Group(); group.position.set(r.x, groundHeight(r.x, r.z) + .025, r.z); this.root.add(group); this.resourceModels.set(r.id, group);
      if (r.kind === 'clue') {
        // 可疑痕迹: dusty footprints + a dropped cigarette butt.
        const trackMaterial = new THREE.MeshBasicMaterial({ color: '#8d8262', transparent: true, opacity: .7, depthWrite: false });
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const toe = new THREE.Mesh(new THREE.CircleGeometry(.12, 10), trackMaterial); toe.rotation.x = -Math.PI / 2; toe.scale.set(.65, 1.5, 1); toe.position.set(side * .29 + (i - 1) * .15, .005, (side === 1 ? .3 : 0) + Math.abs(i - 1) * .13); group.add(toe);
        }
        const butt = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .16, 6), new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: .8 }));
        butt.rotation.z = Math.PI / 2; butt.rotation.y = .7; butt.position.set(.5, .03, -.3); group.add(butt);
        const ember = new THREE.Mesh(new THREE.SphereGeometry(.022, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff7a3c' })); ember.position.set(.58, .03, -.34); group.add(ember);
      } else if (r.kind === 'snack') {
        // 奶茶补给: boba cup with dome lid and straw.
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(.16, .12, .42, 12), new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: .55 }));
        cup.position.y = .24; cup.castShadow = true; group.add(cup);
        const tea = new THREE.Mesh(new THREE.CylinderGeometry(.145, .145, .1, 12), new THREE.MeshStandardMaterial({ color: '#c9925a', roughness: .4 }));
        tea.position.y = .4; group.add(tea);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(.155, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfd6e4', roughness: .25, transparent: true, opacity: .85 }));
        dome.position.y = .45; group.add(dome);
        const straw = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .34, 6), new THREE.MeshStandardMaterial({ color: '#ff4fd8', roughness: .5 }));
        straw.position.set(.06, .6, 0); straw.rotation.z = -.18; group.add(straw);
      } else if (r.kind === 'event') {
        // 街坊求助：遗落的手提包与一盏暖色求助灯。
        box(group, m.leather, [0, .28, 0], [.52, .5, .25]);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(.16, .025, 6, 14, Math.PI), m.gold);
        handle.position.set(0, .57, 0); group.add(handle);
        const beacon = new THREE.Mesh(new THREE.TorusGeometry(.48, .025, 6, 28), new THREE.MeshBasicMaterial({ color: '#8fd8ce', transparent: true, opacity: .72 }));
        beacon.rotation.x = -Math.PI / 2; beacon.position.y = .035; group.add(beacon);
      } else {
        box(group, m.darkMetal, [0, .14, 0], [.5, .28, .4]);
        for (let i = 0; i < 5; i++) {
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .18, 6), m.metal);
          bolt.position.set((this.rng() - .5) * .7, .32, (this.rng() - .5) * .5); bolt.rotation.set(this.rng() * 1.2, 0, this.rng()); group.add(bolt);
        }
        const gear = new THREE.Mesh(new THREE.TorusGeometry(.14, .05, 6, 12), m.gold); gear.position.set(.2, .38, .1); gear.rotation.x = Math.PI / 2; group.add(gear);
      }
    }
  }

  /** 城隍庙夜市大排档 — the night-market stall that acts as base camp. */
  private createCamp(m: Materials, simulation: Simulation) {
    const camp = new THREE.Group(); camp.position.set(-18, groundHeight(-18, 29), 29); this.root.add(camp);
    const stallMat = new THREE.MeshStandardMaterial({ color: '#5c4a52', roughness: .9 });
    const counter = box(camp, stallMat, [0, .75, 0], [3.4, 1.5, 1.4]);
    void counter;
    simulation.boxColliders.push({ x: -18, z: 29, halfWidth: 1.7, halfDepth: .7 });
    // Striped awning on poles.
    const awningMat = new THREE.MeshStandardMaterial({ color: '#a44848', roughness: .85, side: THREE.DoubleSide });
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.2, 4, 1), awningMat);
    awning.position.set(0, 2.6, .4); awning.rotation.x = -.42; awning.castShadow = true; camp.add(awning);
    for (const sx of [-1.85, 1.85]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 2.7, 6), m.darkMetal); pole.position.set(sx, 1.35, 1.15); camp.add(pole); }
    // Warm paper lanterns on a string.
    const lanternMat = new THREE.MeshBasicMaterial({ color: '#ff9a4d' });
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(.21, 10, 8), lanternMat);
      l.position.set(-2 + i, 2.9 - Math.sin(i / 4 * Math.PI) * -.16 + .06 * Math.sin(i * 2), 1.5); l.scale.y = .82; camp.add(l);
    }
    // Steaming pot, stools, crates.
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.4, .35, .4, 12), m.darkMetal); pot.position.set(-.9, 1.7, 0); camp.add(pot);
    for (let i = 0; i < 3; i++) { const stool = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .42, 8), m.leather); stool.position.set(-1.4 + i * 1.4, .21, 2.2); camp.add(stool); }
    box(camp, m.leather, [2.6, .3, .4], [.7, .6, .6]); box(camp, m.leather, [2.7, .25, 1.2], [.6, .5, .5]);
    const steam = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#cfd8ee', transparent: true, opacity: .3 })); steam.position.set(-.9, 2.1, 0); camp.add(steam);
    const light = new THREE.PointLight('#ffb35c', 6, 9, 2); light.position.set(0, 2.2, 1); camp.add(light); return light;
  }

  private createWildlife() {
    for (let i = 0; i < 8; i++) {
      const bird = new THREE.Group(), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([-.7, 0, 0, -.12, .07, .12, 0, 0, 0, 0, 0, 0, .12, .07, .12, .7, 0, 0], 3));
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#8b93ad', side: THREE.DoubleSide })); bird.add(mesh); this.root.add(bird); this.birds.push(bird);
    }
    // Stray cats slinking around the market when the weather is calm.
    const catMat = new THREE.MeshStandardMaterial({ color: '#3a3f4e', roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const a = new THREE.Group();
      ellipsoid(a, catMat, [0, .34, 0], [.16, .15, .34]);
      ellipsoid(a, catMat, [0, .46, .36], [.12, .11, .11]);
      for (const sx of [-.05, .05]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.035, .08, 4), catMat); ear.position.set(sx, .57, .36); a.add(ear); }
      a.add(taperedTube([new THREE.Vector3(0, .4, -.32), new THREE.Vector3(0, .55, -.5), new THREE.Vector3(.06, .72, -.6)], [.03, .02, .006], catMat, 5, 8));
      for (const sx of [-.09, .09]) for (const sz of [-.18, .18]) ellipsoid(a, catMat, [sx, .13, sz], [.035, .13, .035]);
      batchRigidParts(a); a.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; }); this.root.add(a); this.animals.push(a);
    }
  }

  update(sim: Simulation, t: number, dt: number) {
    const storm = sim.weather === '暴雨' ? 1 : sim.weather === '雾霾' ? .43 : 0;
    this.weatherBlend = THREE.MathUtils.damp(this.weatherBlend, storm, .5, dt);
    const w = this.weatherBlend;
    this.sky.material.uniforms.uTime.value = t; this.sky.material.uniforms.uStorm.value = w;
    this.sky.position.set(sim.player.x, 0, sim.player.z);
    this.sky.material.uniforms.uTop.value.copy(this.skyColors.top).lerp(this.stormTop, w);
    this.sky.material.uniforms.uHorizon.value.copy(this.skyColors.horizon).lerp(this.stormHorizon, w);
    (this.scene.fog as THREE.FogExp2).color.copy(this.clearFog).lerp(this.stormFog, w);
    (this.scene.fog as THREE.FogExp2).density = .0038 + w * .0048;
    this.sun.intensity = 3.05 - w * 1.8; this.ambient.intensity = 3.05 - w * .65;
    this.sun.position.set(sim.player.x - 48, 65, sim.player.z + 35); this.sun.target.position.set(sim.player.x, 0, sim.player.z);
    if (this.grassShader) { this.grassShader.uniforms.uTime.value = this.reducedMotion ? 0 : t; this.grassShader.uniforms.uWind.value = this.reducedMotion ? .25 : 1 + w * 3; }
    this.water.material.uniforms.uTime.value = t; this.water.material.uniforms.uStorm.value = w;
    this.cityLife.update(t); this.streaming.updateTime(this.reducedMotion ? t * .25 : t);
    const next = sim.resources.find(r => r.kind === 'clue' && !r.collected);
    const end = next && sim.questPhase === 'tracking' ? next : sim.targetRevealed ? sim.monster : sim.player;
    for (let i = 0; i < 70; i++) {
      const f = ((i / 70 + t * .032) % 1), x = THREE.MathUtils.lerp(sim.player.x, end.x, f) + Math.sin(t * 2 + i * 3.7) * .3, z = THREE.MathUtils.lerp(sim.player.z, end.z, f) + Math.cos(t * 1.4 + i * 2.1) * .35;
      this.scoutPositions[i * 3] = x; this.scoutPositions[i * 3 + 1] = groundHeight(x, z) + .3 + Math.sin(i * .31 + t) * .17; this.scoutPositions[i * 3 + 2] = z;
    }
    this.amberMotes.geometry.attributes.position.needsUpdate = true;
    this.amberMotes.visible = !sim.combat && sim.questPhase !== 'complete' && (sim.questPhase === 'tracking' ? Boolean(next) : sim.targetRevealed);
    this.motes.rotation.y = t * .004;
    (this.rain.material as THREE.LineBasicMaterial).opacity = Math.max(0, w - .6) * .68;
    this.rain.position.set(sim.player.x, 0, sim.player.z);
    if (w > .6) { for (let i = 0; i < 850; i++) { const n = i * 6; this.rainPositions[n + 1] -= dt * 20; this.rainPositions[n + 4] -= dt * 20; if (this.rainPositions[n + 1] < 0) { this.rainPositions[n + 1] = 26; this.rainPositions[n + 4] = 25; } } this.rain.geometry.attributes.position.needsUpdate = true; }
    for (const r of sim.resources) {
      const model = this.resourceModels.get(r.id);
      if (model) { model.visible = !r.collected; model.position.set(r.x, groundHeight(r.x, r.z) + .025, r.z); }
    }
    this.campFire.intensity = 5 + Math.sin(t * 13) * .8 + Math.sin(t * 21) * .5;
    this.birds.forEach((b, i) => { b.position.set(Math.cos(t * .038 + i * .6) * 38, 22 + Math.sin(i * 3) * 6, Math.sin(t * .038 + i * .6) * 26 - 48); b.rotation.y = -t * .038 - i * .6; b.children[0].rotation.z = Math.sin(t * 3 + i) * .08; });
    this.animals.forEach((a, i) => { const x = -21 - i * 2.4 + Math.sin(t * .025 + i) * 3, z = -19 - i * 4; a.position.set(x, groundHeight(x, z), z); a.rotation.y = Math.sin(t * .05 + i) * .4 - 1; a.visible = w < .7; });
  }
}
