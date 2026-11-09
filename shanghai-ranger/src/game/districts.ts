import { random } from './materials';
import type { Point } from './types';
import type { UrbanKind } from './architecture';

export const CHUNK_SIZE = 48;
export const STREAM_RADIUS = 2;
export const chunkCoordinate = (value: number) => Math.floor((value + CHUNK_SIZE / 2) / CHUNK_SIZE);
export const chunkKey = (x: number, z: number) => `${x},${z}`;
export const isAuthoredChunk = (x: number, z: number) => Math.abs(x) <= 1 && Math.abs(z) <= 1;

export interface DistrictBuilding extends Point {
  halfWidth: number;
  halfDepth: number;
  height: number;
  style: 0 | 1 | 2 | 3;
  variant: number;
}
export interface DistrictTree extends Point { scale: number }
export interface DistrictLayout { kind: UrbanKind; buildings: DistrictBuilding[]; trees: DistrictTree[] }

const layoutCache = new Map<string, DistrictLayout>();
export const LAYOUT_CACHE_LIMIT = 256;
export const districtLayoutCacheSize = () => layoutCache.size;

/** Three-by-three chunk macro districts keep a neighbourhood coherent instead of mixing every style per block. */
export function districtKind(cx: number, cz: number): UrbanKind {
  if (isAuthoredChunk(cx, cz)) {
    if (cx > 0 && cz < 0) return 'skyscraper';
    if (cz > 0 && cx < 0) return 'lane';
    return 'wutong';
  }
  const kinds: UrbanKind[] = ['skyscraper', 'office', 'lane', 'wutong', 'campus'];
  const mx = Math.floor(cx / 3), mz = Math.floor(cz / 3);
  return kinds[Math.abs(Math.imul(mx, 73856093) ^ Math.imul(mz, 19349663) ^ 0x5a17) % kinds.length];
}

/** Stable city blocks: crossing back into an unloaded district restores the same layout. */
export function districtLayout(cx: number, cz: number): DistrictLayout {
  const key = chunkKey(cx, cz), cached = layoutCache.get(key);
  if (cached) return cached;
  const rng = random((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x51f15e) | 0);
  const kind = districtKind(cx, cz), buildings: DistrictBuilding[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // Campus quadrangles and tower plots deliberately leave more open space.
    if ((kind === 'campus' && sx === 1 && sz === 1) || (kind === 'skyscraper' && rng() < .22) || (kind === 'office' && rng() < .08)) continue;
    const wide = kind === 'lane' || kind === 'campus';
    const halfWidth = (wide ? 4.8 : 4.1) + rng() * (kind === 'skyscraper' ? 2.1 : 1.35);
    const halfDepth = (wide ? 3.9 : 4.1) + rng() * (kind === 'skyscraper' ? 2.1 : 1.35);
    const height = kind === 'skyscraper' ? 43 + rng() * 43
      : kind === 'office' ? 18 + rng() * 21
        : kind === 'lane' ? 5.4 + rng() * 3.2
          : kind === 'wutong' ? 8.5 + rng() * 6.5 : 10 + rng() * 6;
    const style = (kind === 'skyscraper' ? 0 : kind === 'campus' || kind === 'lane' ? (rng() < .72 ? 3 : 2) : kind === 'office' ? (rng() < .58 ? 0 : 1) : (rng() < .55 ? 1 : 2)) as 0 | 1 | 2 | 3;
    buildings.push({
      x: cx * CHUNK_SIZE + sx * 12 + (rng() - .5) * 1.6,
      z: cz * CHUNK_SIZE + sz * 12 + (rng() - .5) * 1.6,
      halfWidth, halfDepth, height, style, variant: Math.floor(rng() * 4),
    });
  }
  const treeOffsets = kind === 'wutong' || kind === 'campus'
    ? [[-4.5, -19], [4.5, -10], [-4.5, 10], [4.5, 19], [-19, 4.5], [-10, -4.5], [10, -4.5], [19, 4.5]]
    : [[-4.7, -18], [4.7, 18], [-18, 4.7], [18, -4.7]];
  const trees: DistrictTree[] = treeOffsets.map(([x, z]) => ({
    x: cx * CHUNK_SIZE + x, z: cz * CHUNK_SIZE + z, scale: (kind === 'wutong' ? .95 : .72) + rng() * .42,
  }));
  const layout = { kind, buildings, trees };
  layoutCache.set(key, layout);
  if (layoutCache.size > LAYOUT_CACHE_LIMIT) {
    const oldest = layoutCache.keys().next().value;
    if (oldest) layoutCache.delete(oldest);
  }
  return layout;
}

export function nearbyChunkKeys(x: number, z: number, radius = STREAM_RADIUS) {
  const cx = chunkCoordinate(x), cz = chunkCoordinate(z), keys: string[] = [];
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) keys.push(chunkKey(cx + dx, cz + dz));
  return keys;
}

const districtNames: Record<UrbanKind, string[]> = {
  skyscraper: ['浦东云际', '滨江金融城', '北外滩天际线'],
  office: ['静安商务带', '虹桥写字楼', '人民广场商务区'],
  lane: ['虹口老弄堂', '老城厢巷陌', '石库门街坊'],
  wutong: ['衡复梧桐区', '徐汇梧桐里', '长宁梧桐路'],
  campus: ['杨浦大学城', '松江大学城', '闵行书香街区'],
};
export const districtKindLabel: Record<UrbanKind, string> = { skyscraper: '摩天大楼', office: '普通写字楼', lane: '老弄堂', wutong: '梧桐区', campus: '大学城' };

export function districtName(x: number, z: number) {
  const cx = chunkCoordinate(x), cz = chunkCoordinate(z);
  if (!isAuthoredChunk(cx, cz)) {
    const kind = districtKind(cx, cz), names = districtNames[kind];
    const index = Math.abs(Math.imul(Math.floor(cx / 3), 17) ^ Math.imul(Math.floor(cz / 3), 31)) % names.length;
    return names[index];
  }
  if (x > -35 && x < 24 && z > 20 && z < 58) return '城隍庙商圈';
  if (x > 5 && x < 23 && z > -62 && z < 20) return '外滩历史街区';
  if (x > 30 && z < -20) return '陆家嘴天际线';
  if (x < -35 && z > 65) return '杨浦大学城';
  if (x < -40 && z > 15) return '衡复梧桐区';
  return '梧桐夜巷';
}
