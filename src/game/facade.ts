import { canvasTexture, random } from './materials';

export type FacadeStyle = 'glass' | 'residence' | 'stone' | 'brick';

/** Separate albedo and window-only emission keep walls readable instead of neon-glowing. */
export function facadeTexture(seed: number, litRatio: number, style: FacadeStyle = 'residence') {
  const draw = (emissive: boolean) => canvasTexture((ctx, s) => {
    const rng = random(seed);
    const base = style === 'glass' ? '#26384b' : style === 'stone' ? '#5c554e' : style === 'brick' ? '#674b47' : '#3e4654';
    ctx.fillStyle = emissive ? '#000000' : base; ctx.fillRect(0, 0, s, s);
    if (!emissive) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = style === 'glass' ? `rgba(105,145,165,${c % 2 ? .12 : .25})` : `rgba(225,213,190,${c % 2 ? .025 : .075})`;
        ctx.fillRect(c * s / 8, 0, s / 8 - 2, s);
      }
      for (let r = 0; r < 16; r++) { ctx.fillStyle = style === 'stone' ? 'rgba(25,24,28,.2)' : style === 'brick' ? 'rgba(220,193,164,.13)' : 'rgba(9,18,30,.25)'; ctx.fillRect(0, r * s / 16, s, 1); }
      if (style === 'brick') for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) {
        ctx.fillStyle = 'rgba(28,22,24,.14)'; ctx.fillRect(c * s / 8 + (r % 2) * s / 16, r * s / 16, 1, s / 16);
      }
    }
    const cols = style === 'glass' ? 10 : style === 'stone' ? 6 : 8;
    const rows = style === 'glass' ? 16 : style === 'stone' ? 8 : style === 'brick' ? 10 : 12, ww = s / cols, wh = s / rows;
    const neonColumn = style === 'glass' ? rng() * cols | 0 : -1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = rng() < litRatio, neon = c === neonColumn && r % 4 !== 0;
      const x = c * ww + ww * (style === 'glass' ? .1 : .2), y = r * wh + wh * .22;
      const width = ww * (style === 'glass' ? .78 : .58), height = wh * (style === 'glass' ? .68 : .5);
      if (lit || neon) {
        const warm = rng() > .32;
        ctx.fillStyle = neon ? '#3bb9c9' : warm ? '#efbd79' : '#8db9d5';
        ctx.fillRect(x, y, width, height);
        if (!emissive) { ctx.fillStyle = 'rgba(255,244,211,.22)'; ctx.fillRect(x, y, width, 1); }
      } else if (!emissive) {
        ctx.fillStyle = style === 'glass' ? '#142536' : '#252d39'; ctx.fillRect(x, y, width, height);
      }
      if (!emissive && style !== 'glass' && rng() < .24) {
        ctx.fillStyle = '#303642'; ctx.fillRect(c * ww + ww * .62, r * wh + wh * .67, ww * .2, wh * .13);
      }
    }
    ctx.fillStyle = emissive ? '#e8a65f' : '#9a7254'; ctx.fillRect(0, s - wh * 1.15, s, wh * .2);
    if (style !== 'stone') { ctx.fillStyle = emissive ? '#2d9eb0' : '#286273'; ctx.fillRect(0, s - wh * .84, s * .38, wh * .13); }
    if (!emissive) for (let i = 0; i < 1800; i++) { ctx.fillStyle = `rgba(8,12,18,${rng() * .18})`; ctx.fillRect(rng() * s, rng() * s, 1 + rng() * 2, 1); }
  }, 256);
  return { map: draw(false), emissive: draw(true) };
}
