import { useEffect, useRef, useState } from 'react';
import { ArrowClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react';
import * as THREE from 'three';
import { createPet } from '../game/creatures';
import type { Pet } from '../game/types';

function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
/** One on-demand WebGL preview, shared by all skin cards. No idle animation loop. */
export function PetPreview({ pet, skin }: { pet: Pet; skin: string }) {
  const host = useRef<HTMLDivElement>(null), view = useRef<{ scene: THREE.Scene; render: () => void; model: THREE.Group | null } | null>(null);
  const [error, setError] = useState(false), pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor('#15222e'); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    renderer.domElement.setAttribute('aria-hidden','true'); container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(33, 1, .1, 10); camera.position.set(1.50,1.08,2.10); camera.lookAt(0,.43,0);
    scene.add(new THREE.HemisphereLight('#e0f2f3','#5d4938',2.3));
    const key = new THREE.DirectionalLight('#ffe4b7',3.2); key.position.set(1,2,2); scene.add(key);
    const rim = new THREE.DirectionalLight('#83c0d6',1.7); rim.position.set(-2,1,-1); scene.add(rim);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(.53,.56,.035,40),new THREE.MeshStandardMaterial({color:'#293c46',roughness:.9})); stage.position.y=-.01; scene.add(stage);
    let available = true;
    const render = () => { if (document.hidden || !available) return; renderer.render(scene,camera); };
    const resize = () => { const w=container.clientWidth,h=container.clientHeight; if(!w||!h)return; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); render(); };
    view.current={scene,render,model:null};
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(container); window.addEventListener('resize',resize);
    const lost=(event:Event)=>{event.preventDefault();available=false;setError(true);}; renderer.domElement.addEventListener('webglcontextlost',lost);
    const visible=()=>render();document.addEventListener('visibilitychange',visible); resize();
    return()=>{ observer?.disconnect(); window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visible);renderer.domElement.removeEventListener('webglcontextlost',lost);disposeModel(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();view.current=null; };
  },[]);
  useEffect(()=>{
    const v=view.current;if(!v)return;
    if(v.model){v.scene.remove(v.model);disposeModel(v.model);}
    const model=createPet(pet,skin);model.rotation.y=.15;v.scene.add(model);v.model=model;v.render();
  },[pet,skin]);
  const rotate=(angle:number)=>{const v=view.current;if(v?.model){v.model.rotation.y+=angle;v.render();}};
  return <div className="pet-preview-wrap"><div className="pet-model-preview" ref={host} role="img" aria-label="宠物当前皮肤的三维预览，可用下方按钮旋转"
    onPointerDown={e=>{if(e.button!==0)return;pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture?.(e.pointerId);}}
    onPointerMove={e=>{if(pointer.current?.id!==e.pointerId)return;if(Math.abs(e.clientX-pointer.current.x)<Math.abs(e.clientY-pointer.current.y))return;rotate((e.clientX-pointer.current.x)*.015);pointer.current.x=e.clientX;pointer.current.y=e.clientY;}}
    onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}} onLostPointerCapture={()=>{pointer.current=null;}}>
    {error&&<p className="preview-error">3D 预览暂不可用，可关闭宠物页后重试。</p>}
  </div><div className="pet-preview-controls"><button aria-label="向左旋转宠物" onClick={()=>rotate(-Math.PI/6)}><CaretLeft size={18}/></button><span>拖动查看造型</span><button aria-label="宠物预览归位" onClick={()=>{const v=view.current;if(v?.model){v.model.rotation.y=.15;v.render();}}}><ArrowClockwise size={17}/></button><button aria-label="向右旋转宠物" onClick={()=>rotate(Math.PI/6)}><CaretRight size={18}/></button></div></div>;
}
