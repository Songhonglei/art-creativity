import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AdaptiveQuality } from './performance';
import { PetFollower } from './petFollower';
import { SceneryBatches } from './scenery';
describe('自动画质与缓存', () => {
  it('持续慢帧降级，短尖峰和后台节流不触发，用户可关闭', () => {
    const q = new AdaptiveQuality('high'); for (let i = 0; i < 4; i++) q.sample(100); expect(q.current).toBe('high');
    for (let i = 0; i < 110; i++) q.sample(50); expect(q.current).toBe('balanced');
    for (let i = 0; i < 100; i++) q.sample(1000); expect(q.current).toBe('balanced');
    q.reset('high', false); for (let i = 0; i < 1000; i++) q.sample(60); expect(q.current).toBe('high');
  });
  it('恢复有冷却和上限，不会超过用户选择', () => {
    const q = new AdaptiveQuality('balanced'); for (let i = 0; i < 110; i++) q.sample(50); expect(q.current).toBe('low');
    for (let i = 0; i < 500; i++) q.sample(16); expect(q.current).toBe('low');
    for (let i = 0; i < 2000; i++) q.sample(16); expect(q.current).toBe('balanced');
  });
  it('宠物绕墙缓存路线，不穿障碍；区域变化后重算；暂停不搜索', () => {
    const boxes = [{ x: 0, z: 0, halfWidth: 2, halfDepth: 3 }], follower = new PetFollower(), player = { x: 8, z: 0 };
    let p = { x: -6, z: 0 };
    for (let i = 0; i < 300; i++) { p = follower.follow(p, player, 1 / 60, [], boxes, 1); expect(Math.abs(p.x) >= 2.299 || Math.abs(p.z) >= 3.299).toBe(true); }
    expect(p.x).toBeGreaterThan(3); expect(follower.searches).toBeLessThan(20);
    const n = follower.searches; follower.follow({ x: -6, z: 0 }, player, 0, [], boxes, 2); expect(follower.searches).toBe(n);
    follower.follow({ x: -6, z: 0 }, player, 1 / 60, [], boxes, 2); expect(follower.searches).toBeGreaterThan(n);
  });
  it('静态按区合批保留变换，动态对象不参与，远处树切换简化造型', () => {
    const root = new THREE.Group(), mat = new THREE.MeshStandardMaterial(); mat.name = 'scenery-tree-leaf';
    for (const x of [1, 3]) { const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat); mesh.position.set(x, 4, 0); root.add(mesh); }
    const dynamic = new THREE.Mesh(new THREE.BoxGeometry(), mat); root.add(dynamic);
    const batches = new SceneryBatches(root, [dynamic]); expect(dynamic.parent).toBe(root); expect(root.children.length).toBe(3);
    batches.update({ x: 0, z: 0 }, 'high'); const nearTriangles = root.children.filter(o => o.visible && o !== dynamic).reduce((n, o) => n + (o as THREE.Mesh).geometry.attributes.position.count / 3, 0);
    batches.update({ x: 200, z: 200 }, 'low'); const farTriangles = root.children.filter(o => o.visible && o !== dynamic).reduce((n, o) => n + (o as THREE.Mesh).geometry.attributes.position.count / 3, 0); expect(farTriangles).toBeLessThan(nearTriangles);
  });
});
