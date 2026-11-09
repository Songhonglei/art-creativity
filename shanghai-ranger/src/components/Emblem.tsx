export function Emblem({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="27" stroke="currentColor" />
    {/* Skyline: Pearl Tower + towers + bridge line */}
    <g stroke="currentColor" strokeWidth="2">
      <path d="M12 44V36l4-3 4 3v8M22 44V30h4v14M40 44V28l2-6 2 6v16" />
      <path d="M30 44V34m0-6v-2" />
      <circle cx="30" cy="30" r="3.4" />
      <path d="M46 44V32h5v12M8 44h48" />
    </g>
    <path d="M8 32H2m60 0h-6M32 2v6m0 48v6" stroke="currentColor" />
  </svg>;
}
export function MonsterGlyph() {
  return <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="M18 4 33 12v12L18 32 3 24V12Z" stroke="currentColor" strokeWidth="2" />
    <path d="M18 11v10m0 0-6-5m6 5 6-5" stroke="currentColor" strokeWidth="2" />
  </svg>;
}

export function WeaponArt({ type }: { type: string }) {
  return <svg viewBox="0 0 240 220" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {type === 'armor'
        ? <><path d="M60 70 91 47h58l31 23-19 89H79Z" /><path d="m80 79 40 21 40-21M79 114l41 18 41-18M97 52l23 22 23-22" /><circle cx="120" cy="111" r="8" /></>
        : type === 'umbrella'
          ? <><path d="M112 183 139 37" /><path d="m102 98 63-22-29-42Z" /><path d="m102 98 15-37 17 8 14-35M107 179c-3 23 24 25 28 5" /><path d="m129 130 22-8" strokeWidth="6" /></>
          : type === 'baton'
            ? <><path d="m84 176 66-128" /><path d="m106 143 12 7M124 107l10 6M140 74l10 6" /><path d="M74 186l18 10M82 176l16 9M90 166l14 8" /><path d="m151 47 8-13" strokeWidth="7" /></>
            : <><path d="m83 172 69-127" strokeWidth="8" /><path d="m148 50 10-17" strokeWidth="11" /><path d="M76 183l16 10M82 172l16 10M88 160l16 10M94 149l16 10" /><path d="m105 128 10 6" stroke="#e8c76a" /></>}
    </g>
  </svg>;
}

export function SkinArt({ type }: { type: 'nightwatch' | 'magnolia' | 'neon' }) {
  const palette = type === 'magnolia' ? { coat: '#d8d2bd', dark: '#878b87', lining: '#8f3648', glow: '#f0c979' }
    : type === 'neon' ? { coat: '#29263e', dark: '#151a29', lining: '#784dba', glow: '#3fe2dc' }
      : { coat: '#28475f', dark: '#1d3247', lining: '#3f8d91', glow: '#73d9d4' };
  return <svg viewBox="0 0 160 190" fill="none" aria-hidden="true">
    <circle cx="80" cy="87" r="66" fill={palette.glow} fillOpacity=".06" stroke={palette.glow} strokeOpacity=".22" />
    <path d={type === 'neon' ? 'M48 77 31 121l25 8 8-45M112 77l17 44-25 8-8-45' : 'M48 75 28 151l38 9 8-76M112 75l20 76-38 9-8-76'} fill={palette.coat} stroke={palette.glow} strokeOpacity=".55" />
    <path d="M58 76h44l12 63-24 7-10-52-10 52-24-7Z" fill={palette.coat} stroke={palette.dark} strokeWidth="2" />
    <path d="m63 78 17 22 17-22M80 100v42" stroke={palette.lining} strokeWidth="5" />
    <path d="m57 139-4 34h19l8-32 8 32h19l-4-34" fill={palette.dark} stroke={palette.glow} strokeOpacity=".35" />
    <circle cx="80" cy="53" r="20" fill="#c99372" />
    <path d="M59 54c0-25 42-27 43-3l-8-8-27 1-4 18Z" fill={palette.dark} />
    <path d="M63 60h34v9H63Z" fill={type === 'neon' ? palette.glow : palette.lining} fillOpacity={type === 'neon' ? 1 : .85} />
    {type === 'magnolia' && <g fill={palette.glow}>{[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx="80" cy="112" rx="4" ry="9" transform={`rotate(${i * 72} 80 112) translate(0 -7)`} />)}</g>}
    {type === 'neon' && <path d="m47 91 15 4M113 91l-15 4M53 151h13M94 151h13" stroke={palette.glow} strokeWidth="3" />}
  </svg>;
}

/** Shanghai skyline silhouette used on the welcome screen. */
export function SkylineArt() {
  return <svg viewBox="0 0 440 250" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="2">
      <path d="M20 230V150h30v80M60 230V120h26v110M92 230V160h20v70" />
      <path d="M120 230V100h24v130M150 230V140h28v90" />
      <path d="M186 230V150h34v80" />
      <path d="M228 230V60l8-24 8 24v170" />
      <circle cx="236" cy="96" r="16" /><circle cx="236" cy="132" r="9" />
      <path d="M232 220v-30m8 30v-30" />
      <path d="M262 230V90h22v140M290 230V70l6-16 6 16v160" />
      <path d="M312 230V100h18v130M336 230V120h24v110" />
      <path d="M366 230V150h26v80M398 230V110h22v120" />
      <path d="M8 230h424" />
      <path d="M120 230c40-26 96-26 136 0" strokeDasharray="4 5" />
    </g>
    <g fill="currentColor">
      <rect x="26" y="158" width="5" height="7" /><rect x="38" y="172" width="5" height="7" />
      <rect x="66" y="130" width="5" height="7" /><rect x="76" y="150" width="5" height="7" />
      <rect x="126" y="112" width="5" height="7" /><rect x="136" y="136" width="5" height="7" />
      <rect x="156" y="150" width="5" height="7" /><rect x="166" y="170" width="5" height="7" />
      <rect x="266" y="100" width="5" height="7" /><rect x="274" y="126" width="5" height="7" />
      <rect x="318" y="112" width="5" height="7" /><rect x="342" y="130" width="5" height="7" />
      <rect x="404" y="122" width="5" height="7" /><rect x="412" y="150" width="5" height="7" />
    </g>
  </svg>;
}
