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

// A baby's right foot, in a 40 × 72 box: short and chubby, a round heel nearly as wide as the ball, hardly any arch
// (a baby's is a pad of fat), and little round toes tucked close, the big toe on the left (the inside).
const SOLE = 'M20.5 70C10 70 5.5 62.5 6.5 54c.8-6.5 4.5-9.5 4.5-14 0-4.5-4.5-7.5-4.5-14.5C6.5 17 13.5 12.5 22 13c9.5.5 14.5 7 14 15-.4 7.5-3.2 12.5-3.2 19.5 0 8.5 1.7 22.5-12.3 22.5Z';
const TOES = [[12.8, 8.2, 4.5, 4.9], [19.8, 5.6, 2.7, 2.9], [24.8, 6, 2.4, 2.6], [29.3, 7.9, 2.1, 2.3], [32.9, 11, 1.9, 2]];
// The soft creases of a baby's foot, left white by the ink.
const CREASES = ['M10 24c4 2.5 9 2.5 14 .5s7.5-1 10 1', 'M9.5 31c4 2.5 9 2 13.5 1s6 0 8.5 1', 'M12 42c3 1.5 7 .5 10 1.5s4 .5 6-.5', 'M11 55c4 2 9 1 13 2', 'M14 63c3 1.5 7 1 10 0', 'M16 36c3 1 6 1 9 0'];

/**
 * The two footprints, as SVG. `lengthIn` sizes them; `seed` (the baby's id) makes them that baby's own.
 * @param {{lengthIn?:number, seed?:string, width?:number, ink?:string}} o
 */
export function inkFeet({ lengthIn = 19.7, seed = 'x', width = 110, ink = '#1d1f29' } = {}) {
  const n = ++serial;
  const r = seeded(`feet:${seed}`);
  const k = Math.max(0.86, Math.min(1.14, lengthIn / 19.7));
  const foot = (left) => {
    const tilt = (left ? -1 : 1) * (5 + r() * 7);
    const dy = r() * 6;
    const creases = CREASES.filter(() => r() < 0.8).map((d) => `<path d="${d}"/>`).join('');
    const place = left ? `translate(${4 + 40} ${3 + dy}) scale(-1 1)` : `translate(${50} ${dy})`;
    return `<g transform="${place} rotate(${tilt.toFixed(1)} 21 40)">
      <g filter="url(#ink-${n})" fill="${ink}"><path d="${SOLE}"/>${TOES.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('')}</g>
      <g fill="none" stroke="#fff" stroke-width="0.7" stroke-linecap="round" opacity="0.8">${creases}</g></g>`;
  };
  const w = Math.round(width * k);
  return `<svg class="ink-feet" viewBox="0 0 96 84" width="${w}" height="${Math.round(w * 84 / 96)}" role="img" aria-label="Footprints">
    <defs><filter id="ink-${n}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="${Math.floor(r() * 999)}" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 3.05" result="holes"/>
      <feComposite in="SourceGraphic" in2="holes" operator="in"/></filter></defs>
    ${foot(true)}${foot(false)}</svg>`;
}
