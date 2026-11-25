// A baby's inked footprints: left foot, then right, each big toe on the inside, like a print taken at the hospital.
// The ink is uneven (darker where the foot pressed, lighter where it lifted), the edges a little rough, and the skin's
// creases show through as fine white lines. Each baby's feet are their own (from their id): a little wider or slimmer,
// the creases where they fall. Sized by how long the baby was. Used on the hospital tag (ui/birthTag.js).

let serial = 0;

/** Draws from a string: the same every time. */
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A baby's right foot, in a 42 × 76 box: slim, the ball wider than the heel, a gentle waist, the big toe on the left
// (the inside); the toes are separate little dots above the ball.
const SOLE = 'M20 74C14 74 11.5 69 12 63c.5-6 2-10 2-15 0-5-4-9-4.5-16C9 23 14 17.5 21 17.5c7.5 0 12 5.5 11.5 13.5-.5 8-4 14-5 21-1 7 .5 22-7.5 22Z';
const TOES = [[13.4, 10.6, 4.1, 4.7], [20.4, 7.8, 2.4, 2.6], [25.4, 8.3, 2.1, 2.3], [29.5, 10.6, 1.9, 2.1], [32.5, 14, 1.7, 1.8]];

/** Fine white creases, where they fall on this foot: curving lines across the sole, some branching off at a slant. */
function creases(r) {
  const out = [];
  // A smooth line through the points: each corner rounded off on the way to the next.
  const curve = (pts) => pts.reduce((d, [x, y], i) => {
    if (!i) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = pts[i - 1];
    return `${d} Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + x) / 2).toFixed(1)} ${((py + y) / 2).toFixed(1)}`;
  }, '') + ` L${pts.at(-1)[0].toFixed(1)} ${pts.at(-1)[1].toFixed(1)}`;
  for (let i = 0; i < 9; i++) {
    let y = 21 + r() * 50;
    const slope = (r() - 0.5) * 0.5;
    const pts = [];
    for (let x = 7 + r() * 6; x < 35 - r() * 6; x += 2.5 + r() * 2.5) { pts.push([x, y]); y += slope * 2.5 + (r() - 0.5) * 2.2; }
    if (pts.length > 2) out.push({ d: curve(pts), w: 0.25 + r() * 0.5, o: 0.4 + r() * 0.45 });
    // Now and then a crease branches off at a slant.
    if (pts.length > 3 && r() < 0.5) {
      const [bx, by] = pts[1 + Math.floor(r() * (pts.length - 2))];
      const dir = r() < 0.5 ? -1 : 1;
      const br = [[bx, by]];
      for (let j = 1; j < 4; j++) br.push([bx + dir * j * (2 + r() * 1.5), by + j * (2.5 + r() * 2)]);
      out.push({ d: curve(br), w: 0.25 + r() * 0.3, o: 0.35 + r() * 0.35 });
    }
  }
  return out;
}

/**
 * The two footprints, as SVG. `lengthIn` sizes them; `seed` (the baby's id) makes them that baby's own.
 * @param {{lengthIn?:number, seed?:string, width?:number, ink?:string}} o
 */
export function inkFeet({ lengthIn = 19.7, seed = 'x', width = 110, ink = '#16171f' } = {}) {
  const n = ++serial;
  const r = seeded(`feet:${seed}`);
  const k = Math.max(0.86, Math.min(1.14, lengthIn / 19.7));
  const slim = 0.86 + r() * 0.2; // some babies' feet are slimmer than others
  const foot = (left) => {
    const tilt = (left ? -1 : 1) * (4 + r() * 7);
    const dy = r() * 5;
    const lines = creases(r).map((c) => `<path d="${c.d}" stroke-width="${c.w.toFixed(2)}" opacity="${c.o.toFixed(2)}"/>`).join('');
    const place = left ? `translate(46 ${(2 + dy).toFixed(1)}) scale(-1 1)` : `translate(50 ${dy.toFixed(1)})`;
    const shape = `translate(21 0) scale(${slim.toFixed(3)} 1) translate(-21 0)`;
    return `<g transform="${place} rotate(${tilt.toFixed(1)} 21 42) ${shape}">
      <g filter="url(#ink-${n})" fill="${ink}"><path d="${SOLE}"/>${TOES.map(([x, y, rx, ry]) => `<ellipse cx="${(x + (r() - 0.5) * 0.8).toFixed(1)}" cy="${(y + (r() - 0.5) * 0.8).toFixed(1)}" rx="${rx}" ry="${ry}"/>`).join('')}</g>
      <g clip-path="url(#sole-${n})" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${lines}</g></g>`;
  };
  const w = Math.round(width * k);
  const s = Math.floor(r() * 999);
  return `<svg class="ink-feet" viewBox="0 0 96 84" width="${w}" height="${Math.round(w * 84 / 96)}" role="img" aria-label="Footprints">
    <defs>
      <clipPath id="sole-${n}"><path d="${SOLE}"/></clipPath>
      <filter id="ink-${n}" x="-12%" y="-12%" width="124%" height="124%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${s}" result="edge"/>
        <feDisplacementMap in="SourceGraphic" in2="edge" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="rough"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="${s + 1}" result="blot"/>
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.3" result="tone"/>
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${s + 2}" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.9" result="speck"/>
        <feComposite in="tone" in2="speck" operator="arithmetic" k1="1" result="mask"/>
        <feComposite in="rough" in2="mask" operator="in"/>
      </filter>
    </defs>
    ${foot(true)}${foot(false)}</svg>`;
}
