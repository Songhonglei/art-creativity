import { useId } from 'react';
import type { Snapshot } from '../game/types';
import { CHUNK_SIZE, chunkCoordinate, chunkKey, districtLayout, isAuthoredChunk } from '../game/districts';
import type { UrbanKind } from '../game/architecture';
import { riverX } from '../game/materials';

const DISTRICT_COLORS: Record<UrbanKind, string> = {
  skyscraper: '#527795', office: '#59657e', lane: '#87584f', wutong: '#5e7458', campus: '#806474',
};

export function WorldMap({ snapshot, large = false }: { snapshot: Snapshot; large?: boolean }) {
  const id = useId().replace(/:/g, ''), scale = 1.58, center = { x: 150, y: 147 };
  const toMap = (x: number, z: number) => ({ x: center.x + (x - snapshot.player.x) * scale, y: center.y + (z - snapshot.player.z) * scale });
  const nextClue = snapshot.resources.find(r => r.kind === 'clue' && !r.collected);
  const objective = snapshot.questPhase === 'tracking' && nextClue ? nextClue
    : snapshot.targetRevealed && snapshot.questPhase !== 'complete' ? snapshot.monster : null;
  const rawObjective = objective ? toMap(objective.x, objective.z) : null;
  const objectiveDistance = rawObjective ? Math.hypot(rawObjective.x - center.x, rawObjective.y - center.y) : 0;
  const marker = rawObjective && objectiveDistance > 123 ? {
    x: center.x + (rawObjective.x - center.x) / objectiveDistance * 123,
    y: center.y + (rawObjective.y - center.y) / objectiveDistance * 123,
  } : rawObjective;
  const cx = chunkCoordinate(snapshot.player.x), cz = chunkCoordinate(snapshot.player.z), chunks: { x: number; z: number }[] = [];
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) chunks.push({ x: cx + dx, z: cz + dz });
  const roads: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const i of [-2, -1, 0, 1, 2]) {
    const vertical = toMap((cx + i) * CHUNK_SIZE, snapshot.player.z).x;
    const horizontal = toMap(snapshot.player.x, (cz + i) * CHUNK_SIZE).y;
    roads.push({ x1: vertical, y1: 0, x2: vertical, y2: 300 }, { x1: 0, y1: horizontal, x2: 300, y2: horizontal });
  }
  const riverPoints: string[] = [];
  for (let z = snapshot.player.z - 105; z <= snapshot.player.z + 105; z += 7) {
    const point = toMap(riverX(z), z); riverPoints.push(`${point.x},${point.y}`);
  }
  const camp = toMap(-18, 29);
  const label = (x: number, z: number, text: string, dx = 0, dy = 0) => {
    const p = toMap(x, z);
    return <text key={text} x={p.x + dx} y={p.y + dy} textAnchor="middle" stroke="#151a2b" strokeWidth="2" paintOrder="stroke">{text}</text>;
  };
  const route = objective ? [
    toMap(snapshot.player.x, snapshot.player.z),
    toMap(Math.round(snapshot.player.x / CHUNK_SIZE) * CHUNK_SIZE, snapshot.player.z),
    toMap(Math.round(snapshot.player.x / CHUNK_SIZE) * CHUNK_SIZE, objective.z),
    toMap(objective.x, objective.z),
  ].map(p => `${p.x},${p.y}`).join(' ') : '';
  const objectiveName = snapshot.questPhase === 'tracking' ? '下一处线索' : snapshot.targetRevealed ? snapshot.monsterName : '尚未调查的目标';
  const aria = objective ? `上海动态夜巡地图。${objectiveName}距离你 ${Math.round(snapshot.questPhase === 'tracking' && nextClue ? Math.hypot(nextClue.x - snapshot.player.x, nextClue.z - snapshot.player.z) : snapshot.monsterDistance)} 米。` : '上海动态夜巡地图。本轮委托已完成。';
  return <svg viewBox="0 0 300 300" className={large ? 'world-map large-map' : 'world-map'} role="img" aria-label={aria}>
    <defs>
      <radialGradient id={`${id}paper`}><stop stopColor="#2b3350" /><stop offset=".75" stopColor="#20263d" /><stop offset="1" stopColor="#171b2d" /></radialGradient>
      <clipPath id={`${id}clip`}><circle cx="150" cy="150" r="139" /></clipPath>
      <pattern id={`${id}grid`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#8fa3d8" strokeOpacity=".1" strokeWidth=".6" /></pattern>
    </defs>
    <circle cx="150" cy="150" r="145" fill="#101322" fillOpacity=".85" stroke="#7d8cbd" strokeOpacity=".6" strokeWidth=".7" />
    <g clipPath={`url(#${id}clip)`}>
      <circle cx="150" cy="150" r="140" fill={`url(#${id}paper)`} />
      {chunks.map(({ x, z }) => {
        const layout = districtLayout(x, z);
        return <g key={chunkKey(x, z)}>
          {!isAuthoredChunk(x, z) && layout.buildings.map((b, i) => {
            const p = toMap(b.x, b.z);
            return <rect key={i} x={p.x - b.halfWidth * scale} y={p.y - b.halfDepth * scale} width={b.halfWidth * 2 * scale} height={b.halfDepth * 2 * scale} rx="1.5" fill={DISTRICT_COLORS[layout.kind]} stroke="#b4c0d6" strokeOpacity=".2" strokeWidth=".6" />;
          })}
        </g>;
      })}
      {roads.map((line, i) => <line key={i} {...line} stroke="#9db1e8" strokeOpacity=".19" strokeWidth="9" />)}
      <polyline points={riverPoints.join(' ')} fill="none" stroke="#101a30" strokeWidth="17" />
      <polyline points={riverPoints.join(' ')} fill="none" stroke="#40538c" strokeOpacity=".8" strokeWidth="9" />
      <circle cx="150" cy="150" r="140" fill={`url(#${id}grid)`} />
      {route && <polyline points={route} fill="none" stroke="#f0cf7e" strokeOpacity=".72" strokeWidth="1.5" strokeDasharray="4 4" />}
      {snapshot.resources.filter(r => !r.collected && r.kind !== 'clue').map(r => {
        const p = toMap(r.x, r.z), color = r.kind === 'snack' ? '#ffb7e2' : r.kind === 'event' ? '#81d8ca' : '#e8d9a8';
        return <g key={r.id} transform={`translate(${p.x} ${p.y})`}><circle r={r.kind === 'event' ? 4.5 : 3.5} fill={color} stroke="#0d1020" strokeWidth="1" />{r.kind === 'event' && <path d="M-2 0h4M0-2v4" stroke="#142b32" strokeWidth="1" />}</g>;
      })}
      <g transform={`translate(${camp.x} ${camp.y})`} stroke="#ffe9c9" strokeWidth="1.4" fill="#a44848"><path d="M-6 5 0-6 6 5Z" /><path d="M0-3V5" /></g>
      {snapshot.streetThreats.filter(threat => threat.health > 0).map(threat => {
        const p = toMap(threat.x, threat.z);
        return <g key={threat.id} transform={`translate(${p.x} ${p.y})`}><circle r="5.2" fill="#be704f" stroke="#ffd2a4" strokeWidth=".8" /><circle r="1.6" fill="#fff1d0" /><title>{threat.name} · 街区游荡目标</title></g>;
      })}
      {marker && objective && <g transform={`translate(${marker.x} ${marker.y})`}>
        <circle r="10" fill={objective === nextClue ? '#776738' : '#8d4a48'} stroke="#ffe0a8" strokeWidth="1" />
        {objective === nextClue ? <path d="M0-6 5 0 0 6-5 0Z" fill="#ffe0a8" /> : <path d="m-5-5 2 6 3 5 3-5 2-6-5 3Z" fill="#ffd7ab" />}
        {large && objectiveDistance > 123 && <text x="13" y="3" fill="#ffd7ab" fontSize="8" stroke="#151a2b" strokeWidth="2" paintOrder="stroke">{Math.round(objective === nextClue ? Math.hypot(objective.x - snapshot.player.x, objective.z - snapshot.player.z) : snapshot.monsterDistance)}m</text>}
      </g>}
      <g transform={`translate(${center.x} ${center.y}) rotate(${-snapshot.facing * 180 / Math.PI})`}><circle r="10" fill="#dfe6ff" fillOpacity=".15" /><path d="M0 7-4-5 0-2 4-5Z" fill="#f4ecff" stroke="#141830" strokeWidth="1" /></g>
      {large && <g fontFamily="Manrope" fill="#dfe6ff" fontSize="7" letterSpacing="1">
        {Math.abs(snapshot.player.x) < 170 && Math.abs(snapshot.player.z) < 170 && <>{label(13.5, -10, '外滩 THE BUND', 12, -8)}{label(-18, 42, '城隍庙夜市', -16, 13)}{label(49, -45, '陆家嘴', 12, -12)}{label(-10, 5, '南京路', -10, 15)}</>}
      </g>}
    </g>
    <circle cx="150" cy="150" r="139" fill="none" stroke="#aebadd" strokeOpacity=".45" strokeWidth=".8" />
    <path d="M150 1v8M150 291v8M1 150h8M291 150h8" stroke="#c4d0f2" strokeWidth="1" />
    <text x="150" y="24" textAnchor="middle" fontFamily="Manrope" fontSize="11" fill="#f2f4ff" fontWeight="700">北</text>
    {large && <text x="150" y="282" textAnchor="middle" fontFamily="GameChineseDisplay, sans-serif" fontSize="8" fill="#e8c76a">委托 · {snapshot.questDistrict}</text>}
  </svg>;
}
