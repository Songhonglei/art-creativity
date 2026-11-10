import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createPet} from './creatures';
import {PET_IDS,PET_SKINS} from './pets';
const size=(o:THREE.Object3D)=>new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
function triangles(o:THREE.Object3D){let count=0;o.traverse(part=>{if(part instanceof THREE.Mesh)count+=(part.geometry.index?.count??part.geometry.attributes.position.count)/3;});return count;}
function dispose(o:THREE.Object3D){const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();o.traverse(p=>{if(p instanceof THREE.Mesh){gs.add(p.geometry);(Array.isArray(p.material)?p.material:[p.material]).forEach(m=>ms.add(m));}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}

describe('宠物独立建模与服装递进',()=>{
  it('柴犬与柯基的实际几何轮廓不同：更高、更紧凑，不能由换材质得到',()=>{
    const corgi=createPet('corgi'),shiba=createPet('shiba');
    const c=size(corgi.getObjectByName('anatomy-corgi')!),s=size(shiba.getObjectByName('anatomy-shiba')!);
    expect(s.y).toBeGreaterThan(c.y*1.15);expect(s.z).toBeLessThan(c.z*.95);expect(s.y/s.z).toBeGreaterThan(c.y/c.z*1.25);expect(s.x).toBeLessThan(c.x);
    expect(triangles(shiba.getObjectByName('anatomy-shiba')!)).not.toBe(triangles(corgi.getObjectByName('anatomy-corgi')!));dispose(corgi);dispose(shiba);
  });
  for(const pet of PET_IDS)it(`${pet} 4→7→10级实际服装几何细节与包覆不减少`,()=>{
    const models=PET_SKINS[pet].slice(1).map(s=>createPet(pet,s.id)),outfits=models.map(m=>m.getObjectByName('pet-outfit')!);
    const counts=outfits.map(triangles),bounds=outfits.map(size);
    expect(counts[1]).toBeGreaterThan(counts[0]*1.5);expect(counts[2]).toBeGreaterThan(counts[1]*1.15);
    expect(bounds[2].x).toBeGreaterThanOrEqual(bounds[1].x*.98);expect(bounds[2].z).toBeGreaterThanOrEqual(bounds[1].z*.98);
    const medium=new Set(models[1].userData.designParts as string[]),high=new Set(models[2].userData.designParts as string[]);
    for(const part of medium)expect(high.has(part),`10级丢失7级构件：${part}`).toBe(true);
    models.forEach(dispose);
  });
  it('十二套模型保持每只最多14个网格与12000个三角形的美术预算',()=>{for(const pet of PET_IDS)for(const skin of PET_SKINS[pet]){const m=createPet(pet,skin.id);let meshes=0;m.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});expect(meshes).toBeLessThanOrEqual(14);expect(triangles(m)).toBeLessThanOrEqual(12000);dispose(m);}});
  it('探长保留完整猎鹿帽和前襟，远行套装保留双侧补给包，金铃套装保留胸甲',()=>{
    for(const [pet,id,required]of [
      ['shiba','shiba-inspector',['deerstalker-crown','deerstalker-brim','double-breasted-front','detective-pocket','inspector-shoulder-mantle','monocle-rim']],
      ['corgi','corgi-expedition',['cross-harness','supply-pannier','supply-cross-vertical','water-flask','second-water-flask','rolled-expedition-blanket']],
      ['orangeCat','cat-golden-bell',['guardian-jacket','guardian-breastplate','guardian-sleeve','brocade-cape','gold-layered-pauldrons','guardian-bell']],
    ] as const){const model=createPet(pet,id);for(const name of required)expect(model.userData.designParts).toContain(name);dispose(model);}
  });
});
