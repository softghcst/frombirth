// A baby's inked footprints: left foot, then right, each big toe on the inside, mottled like ink on paper, a little
// different for every baby (from their id) and sized by how long they were at birth. Used on the birth announcement
// and the hospital tag (ui/birthTag.js).

let serial = 0;

/** Draws from a string: the same every time. */
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A right foot's print, in a 40 × 84 box: big toe on the left (the inside), the arch curving in on that side.
const SOLE = 'M21 82C11 82 7 74 8.5 65c1-8 6.5-13 6.5-20 0-6-7-10-7-18C8 17 16 12 25 13.5c10 1.5 14 9 12.5 18-1.5 10-5.5 16-5.5 26 0 10-1 24.5-11 24.5Z';
const TOES = [[13.5, 6.5, 5.6, 6.6], [22, 4, 3.3, 3.9], [27.8, 5.6, 2.8, 3.3], [32.4, 8.6, 2.4, 2.9], [35.8, 12.8, 2.1, 2.5]];
// Creases in the skin, left white by the ink.
const CREASES = ['M12 29c5 1 9 4 14 2s7-2 9 0', 'M11 38c4 3 9 1 13 3s6 0 8-2', 'M15 50c3-2 7 1 10-1s4-1 6 1', 'M14 60c4 2 8 0 12 2', 'M12 22c4-3 8-2 12-4s7 0 10 2', 'M17 70c3 2 6 1 9 2', 'M20 34c1 6 3 11 2 18', 'M27 22c-2 7-1 14 1 20']; 

/**
 * The two footprints, as SVG. `lengthIn` sizes them; `seed` (the baby's id) makes them that baby's own.
 * @param {{lengthIn?:number, seed?:string, width?:number, ink?:string}} o
 */
export function inkFeet({ lengthIn = 19.7, seed = 'x', width = 110, ink = '#1d1f29' } = {}) {
  const n = ++serial;
  const r = seeded(`feet:${seed}`);
  const k = Math.max(0.86, Math.min(1.14, lengthIn / 19.7));
  const foot = (left) => {
    const tilt = (left ? -1 : 1) * (6 + r() * 8);
    const dy = r() * 6;
    const creases = CREASES.filter(() => r() < 0.8).map((d) => `<path d="${d}"/>`).join('');
    const place = left ? `translate(${4 + 40} ${4 + dy}) scale(-1 1)` : `translate(${50} ${dy})`;
    return `<g transform="${place} rotate(${tilt.toFixed(1)} 22 46)">
      <g filter="url(#ink-${n})" fill="${ink}"><path d="${SOLE}"/>${TOES.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('')}</g>
      <g fill="none" stroke="#fff" stroke-width="0.7" stroke-linecap="round" opacity="0.8">${creases}</g></g>`;
  };
  const w = Math.round(width * k);
  return `<svg class="ink-feet" viewBox="0 0 96 96" width="${w}" height="${w}" role="img" aria-label="Footprints">
    <defs><filter id="ink-${n}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="${Math.floor(r() * 999)}" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 3.05" result="holes"/>
      <feComposite in="SourceGraphic" in2="holes" operator="in"/></filter></defs>
    ${foot(true)}${foot(false)}</svg>`;
}
