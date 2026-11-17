import type { CSSProperties } from 'react';
import type { Pet } from '../game/types';
type Kind = 'attack' | 'heavy' | 'dodge' | 'heal' | 'camp' | Pet;
/** One stroke grammar. Heavy impact, lock crosshair and pet abilities remain distinct at 20px. */
export function ActionIcon({ kind, size = 24, style }: { kind: Kind; size?: number; style?: CSSProperties }) {
  const paths: Record<Kind, React.ReactNode> = {
    attack: <><path d="m6 19 11-11M14 5l5 5M5 16l3 3M4 5c5-3 11-1 14 3"/><path d="m17 3 4 1-1 4"/></>,
    heavy: <><path d="m5 20 10-10M10 6l4-4 8 8-4 4zM3 11l3 2M11 19l2 3M4 4l3 3"/><path d="M2 16h3M17 19v3"/></>,
    dodge: <><circle cx="15" cy="5" r="2"/><path d="m13 9-4 4 3 3-4 5M13 9l4 4 4-1M12 16l5 4M3 9h5M3 9l2-2M3 9l2 2"/></>,
    heal: <><path d="M5 7h14l-2 14H7zM4 7h16M14 7l2-5M9 12h6"/><circle cx="10" cy="17" r=".6"/><circle cx="14" cy="17" r=".6"/></>,
    camp: <><path d="M3 12h18c-1 6-5 9-9 9s-8-3-9-9ZM8 3c-2 2 2 3 0 5M13 2c-2 2 2 4 0 6M18 3c-2 2 2 3 0 5M8 22h8"/></>,
    orangeCat: <><path d="M4 10 3 3l6 3M20 10l1-7-6 3M5 10c0-5 14-5 14 0v4c0 6-14 6-14 0zM9 12h.01M15 12h.01"/><path d="m12 13 5 2v3l-5 4-5-4v-3z"/></>,
    corgi: <><path d="M5 9 3 3l6 3M19 9l2-6-6 3M5 10c0-5 14-5 14 0v4c0 6-14 6-14 0zM8 11h.01M16 11h.01"/><path d="m13 11-4 6h4l-2 5 6-7h-4z"/></>,
    shiba: <><path d="m5 9-1-6 6 3M19 9l1-6-6 3M5 10c0-5 14-5 14 0v4c0 6-14 6-14 0zM8 11h.01M16 11h.01"/><circle cx="15" cy="17" r="4"/><path d="m18 20 3 3m-6-8-1 3 3-1"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[kind]}</svg>;
}
