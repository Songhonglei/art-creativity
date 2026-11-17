import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Point, Settings } from './types';

interface Batch { full: THREE.Mesh; far?: THREE.Mesh; bounds: THREE.Box3; casts: boolean }
/** Static objects only, grouped spatially so frustum culling remains useful.
 * Animated actors, resource pickups and shader/transparent surfaces stay separate. */
export class SceneryBatches {
  private batches: Batch[] = [];
  private point = new THREE.Vector3();
  constructor(root: THREE.Group, excluded: THREE.Object3D[]) {
    const skip = new Set(excluded), groups = new Map<string, THREE.Mesh[]>();
    root.updateMatrixWorld(true);
    const center = new THREE.Vector3();
    const visit = (node: THREE.Object3D) => {
      if (skip.has(node)) return;
      if (node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh) && !Array.isArray(node.material) && !node.material.transparent && !(node.material instanceof THREE.ShaderMaterial)) {
        node.geometry.computeBoundingBox(); node.geometry.boundingBox!.getCenter(center).applyMatrix4(node.matrixWorld);
        let materialKey = node.material.uuid;
        if (!Object.values(node.material).some(value => value instanceof THREE.Texture)) {
          const data = node.material.toJSON(); delete data.uuid; delete data.metadata; delete data.name;
          materialKey = JSON.stringify(data);
        }
        const key = `${Math.floor(center.x / 48)},${Math.floor(center.z / 48)}:${materialKey}:${node.material.name.startsWith('scenery-tree')}:${node.castShadow}:${node.receiveShadow}`;
        const list = groups.get(key) ?? []; list.push(node); groups.set(key, list);
      }
      node.children.forEach(visit);
    };
    visit(root);
    const disposed = new Set<THREE.BufferGeometry>();
    for (const objects of groups.values()) {
      const first = objects[0], material = first.material as THREE.Material, tree = material.name.startsWith('scenery-tree');
      if (objects.length < 2 && !tree) continue;
      const geos = objects.map(o => {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g;
      });
      const merged = mergeGeometries(geos); geos.forEach(g => g.dispose()); if (!merged) continue;
      const full = new THREE.Mesh(merged, first.material); full.castShadow = first.castShadow; full.receiveShadow = first.receiveShadow;
      merged.computeBoundingBox(); const bounds = merged.boundingBox!.clone();
      objects.forEach(o => { o.removeFromParent(); disposed.add(o.geometry); }); root.add(full);
      let far: THREE.Mesh | undefined;
      if (tree) {
        const proxies = objects.map(o => {
          const b = o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
          const leaf = material.name.endsWith('leaf'), g = leaf ? new THREE.IcosahedronGeometry(1, 0) : new THREE.CylinderGeometry(.14, .23, 1, 5);
          g.scale(leaf ? size.x / 2 : 1, size.y / (leaf ? 2 : 1), leaf ? size.z / 2 : 1); g.translate(c.x, c.y, c.z);
          if (!g.index) return g; const plain = g.toNonIndexed(); g.dispose(); return plain;
        });
        const geometry = mergeGeometries(proxies); proxies.forEach(g => g.dispose());
        if (geometry) { far = new THREE.Mesh(geometry, first.material); far.receiveShadow = true; far.visible = false; root.add(far); }
      }
      this.batches.push({ full, far, bounds, casts: first.castShadow });
    }
    disposed.forEach(g => g.dispose());
  }
  update(player: Point, quality: Settings['quality']) {
    this.point.set(player.x, 1, player.z);
    const near = quality === 'low' ? 18 : quality === 'balanced' ? 32 : 55;
    for (const batch of this.batches) {
      const distance = batch.bounds.distanceToPoint(this.point), detailed = !batch.far || distance < near;
      batch.full.visible = detailed; if (batch.far) batch.far.visible = !detailed;
      batch.full.castShadow = batch.casts && detailed && distance < 32;
    }
  }
}
