import * as THREE from 'three';
/** Actor instances own their geometry. Palette materials shared with the world
 * must survive cache eviction; private materials/textures can be reclaimed. */
export function disposeActor(root: THREE.Object3D, shared: Set<THREE.Material>) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!shared.has(m)) materials.add(m); } });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => { Object.values(m).forEach(v => { if (v instanceof THREE.Texture) textures.add(v); }); m.dispose(); }); textures.forEach(t => t.dispose()); root.removeFromParent();
}
