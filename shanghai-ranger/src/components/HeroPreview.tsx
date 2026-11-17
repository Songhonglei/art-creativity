import { useEffect, useRef, useState } from 'react';
import { ArrowClockwise, CaretLeft } from '@phosphor-icons/react';
import * as THREE from 'three';
import { createHunter, disposeHero } from '../game/heroModel';
import { Simulation, DEFAULT_PROGRESS, WEAPONS } from '../game/simulation';
import { attackSpec } from '../game/combat';
import type { Gender, Skin, Weapon } from '../game/types';
type Action = 'idle' | 'walk' | 'run' | 'light' | 'heavy' | 'dodge-left' | 'dodge-right' | 'fall' | 'rise';
type View = { render: () => void; setModel: (skin: Skin, gender: Gender) => void; setAngle: (angle: number) => void; angle: number; sim: Simulation; model: ReturnType<typeof createHunter> | null; raf: number; pose: (action: Action, elapsed: number, weapon: Weapon) => void };

export function HeroPreview({ skin, gender = 'male', weapon: equipped, reducedMotion }: { skin: Skin; gender?: Gender; weapon: Weapon; reducedMotion: boolean }) {
  const host = useRef<HTMLDivElement>(null), view = useRef<View | null>(null), pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const [error, setError] = useState(false), [action, setAction] = useState<Action>('idle'), [weapon, setWeapon] = useState(equipped), [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const container = host.current; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor('#172832'); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.domElement.setAttribute('aria-hidden', 'true'); container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(33, 1, .1, 15);
    scene.add(new THREE.HemisphereLight('#d8efed', '#725944', 2.5));
    const key = new THREE.DirectionalLight('#ffe4bd', 3); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight('#83bbcd', 2); rim.position.set(-2, 2, -3); scene.add(rim);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(.69, .74, .04, 48), new THREE.MeshStandardMaterial({ color: '#304751', roughness: .9 })); stage.position.y = -.025; scene.add(stage);
    camera.position.set(0, 1.55, 4.7); camera.lookAt(0, 1.1, 0);
    let available = true;
    const sim = new Simulation({ ...DEFAULT_PROGRESS, level: 10, gender, skin });
    const render = () => { if (available && !document.hidden) renderer.render(scene, camera); };
    const current: View = {
      render, sim, model: null, raf: 0, angle: .12,
      setAngle(angle) { this.angle = angle; container.dataset.angle = String(angle); if (this.model) this.model.root.rotation.y = angle; render(); },
      setModel(nextSkin, nextGender) { if (this.model) { scene.remove(this.model.root); disposeHero(this.model.root); } this.model = createHunter(null, nextSkin, nextGender); scene.add(this.model.root); this.pose('idle', 0, equipped); },
      pose(mode, elapsed, nextWeapon) {
        if (!this.model) return;
        sim.progress.weapon = nextWeapon; sim.player.facing = this.angle; sim.player.x = sim.player.z = 0; sim.player.moving = mode === 'walk' || mode === 'run'; sim.player.sprinting = mode === 'run';
        sim.player.attackTime = 0; sim.player.dodgeTime = 0; sim.dead = mode === 'fall';
        if (mode === 'light' || mode === 'heavy') { const spec = attackSpec(nextWeapon, mode === 'heavy'); sim.player.attackWeapon = nextWeapon; sim.player.attackHeavy = mode === 'heavy'; sim.player.attackDuration = spec.duration; sim.player.attackTime = Math.max(.001, spec.duration - elapsed % spec.duration); sim.player.combo = 1; }
        if (mode.startsWith('dodge')) { sim.player.dodgeDuration = .36; sim.player.dodgeTime = .36 - elapsed % .36; sim.player.dodgeSide = mode === 'dodge-left' ? -1 : 1; }
        const zoom = container.dataset.focus === 'true', falling = mode === 'fall';
        camera.position.set(falling ? .95 : 0, zoom ? 1.97 : 1.55, zoom ? 1.08 : falling ? 5.4 : 4.7); camera.lookAt(falling ? .95 : 0, zoom ? 1.94 : falling ? .65 : 1.1, 0);
        this.model.update(sim, elapsed, 1 / 60, { death: Math.min(1.5, elapsed), rise: mode === 'rise' ? Math.min(.6, elapsed) : .6, reducedMotion }); render();
        container.dataset.pose = mode; container.dataset.skin = nextSkinName(this.model.root.name); container.dataset.triangles = String(renderer.info.render.triangles); container.dataset.calls = String(renderer.info.render.calls);
      },
    };
    view.current = current;
    const resize = () => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); render(); };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; observer?.observe(container); window.addEventListener('resize', resize); resize();
    const lost = (e: Event) => { e.preventDefault(); available = false; cancelAnimationFrame(current.raf); setError(true); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    const visible = () => { if (document.hidden) { cancelAnimationFrame(current.raf); setAction('idle'); } else current.pose('idle', 0, sim.progress.weapon); }; document.addEventListener('visibilitychange', visible);
    // The camera is owned by this preview; it cannot change the game's orbit.
    container.addEventListener('hero-focus', () => { const zoom = container.dataset.focus === 'true'; camera.position.set(0, zoom ? 1.97 : 1.55, zoom ? 1.08 : 4.7); camera.lookAt(0, zoom ? 1.94 : 1.1, 0); render(); });
    return () => { cancelAnimationFrame(current.raf); observer?.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visible); renderer.domElement.removeEventListener('webglcontextlost', lost); if (current.model) disposeHero(current.model.root); stage.geometry.dispose(); stage.material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); view.current = null; };
    // Model/weapon changes use the existing renderer below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { view.current?.setModel(skin, gender); setAction('idle'); }, [skin, gender]);
  useEffect(() => {
    const current = view.current; if (!current) return;
    cancelAnimationFrame(current.raf); const start = performance.now();
    const frame = () => { if (document.hidden) return; const elapsed = (performance.now() - start) / 1000; current.pose(action, elapsed, weapon); if (action !== 'idle' && elapsed < 2.8) current.raf = requestAnimationFrame(frame); else if (action !== 'idle') setAction('idle'); };
    frame(); return () => cancelAnimationFrame(current.raf);
  }, [action, weapon, skin, gender, reducedMotion]);
  const turn = (delta: number) => { const current = view.current; if (current) current.setAngle(current.angle + delta); };
  return <div className="hero-preview-wrap">
    <div className="hero-model-preview" ref={host} role="img" aria-label="主角真实三维试穿，拖动或用按钮旋转" data-focus={focus}
      onPointerDown={e => { if (e.button !== 0) return; pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (pointer.current?.id !== e.pointerId) return; if (Math.abs(e.clientX - pointer.current.x) < Math.abs(e.clientY - pointer.current.y)) return; turn((e.clientX - pointer.current.x) * .012); pointer.current.x = e.clientX; pointer.current.y = e.clientY; }}
      onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }} onLostPointerCapture={() => { pointer.current = null; }}>
      {error && <p className="preview-error" role="status">3D 预览暂不可用。可继续选衣，关闭衣橱后重试。</p>}
      <span className="preview-tag">试穿 · 不改变当前穿戴</span>
    </div>
    <div className="hero-view-controls"><button aria-label="向左旋转主角" onClick={() => turn(-Math.PI / 6)}><CaretLeft size={18}/></button><button onClick={() => view.current?.setAngle(0)}>正面</button><button onClick={() => view.current?.setAngle(Math.PI / 2)}>侧面</button><button onClick={() => view.current?.setAngle(Math.PI)}>背面</button><button aria-label="主角预览归位" onClick={() => { view.current?.setAngle(.12); setAction('idle'); }}><ArrowClockwise size={18}/></button></div>
    <details className="preview-details"><summary>兵器与动作预览</summary><div className="preview-options"><label>兵器<select aria-label="预览兵器" value={weapon} onChange={e => setWeapon(e.target.value as Weapon)}>{WEAPONS.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>动作<select aria-label="预览动作" value={action} onChange={e => setAction(e.target.value as Action)}>{[['idle','站立'],['walk','行走'],['run','疾跑'],['light','普攻'],['heavy','重击'],['dodge-left','左后闪避'],['dodge-right','右后闪避'],['fall','倒地'],['rise','起身']].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
    <button className="face-focus-button" aria-pressed={focus} onClick={() => { if (!host.current) return; host.current.dataset.focus = String(!focus); host.current.dispatchEvent(new Event('hero-focus')); setFocus(!focus); }}>{focus ? '查看全身' : '查看眉眼'}</button></details>
  </div>;
}
const nextSkinName = (name: string) => name.split(':')[1];
