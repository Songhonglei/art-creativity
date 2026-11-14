import type { Gender, Skin } from '../game/types';
/** Build-time renders of createHunter; no extra runtime WebGL context or divergent SVG avatar. */
export function HeroPortrait({ skin, gender = 'male' }: { skin: Skin; gender?: Gender }) {
  return <img className="hero-portrait" src={`./assets/hero/portrait-${skin}-${gender}.webp`} alt={gender === 'female' ? '棕色长马尾的夜鹰' : '短发夜鹰'} draggable={false}/>;
}
