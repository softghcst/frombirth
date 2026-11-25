// The wedding venues as illustrated backdrops (400 x 300): painted like a cartoon's backgrounds, with light, depth and
// shading, a horizon and a vanishing point in the middle (200, 150), and the couple's chosen color in the décor.
// The couple's portraits sit in front, low and in the middle, so the detail is kept to the sky, the far wall and the
// two sides. Used by js/ui/weddingPlanner.js.

const W = 400;
const H = 300;
const HZ = 150; // the horizon
const LINE = 'rgba(40, 28, 30, .55)';

const lin = (id, stops, x2 = 0, y2 = 1, x1 = 0, y1 = 0) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
const n1 = (x) => Math.round(x * 10) / 10;

/** How far apart things are at height y on the ground: 0 at the horizon, 1 at the bottom edge. */
const depth = (y) => (y - HZ) / (H - HZ);

/** A white folding chair with a bow in the couple's color, its seat at (x, y), at scale s. */
function chair(x, y, s, hex) {
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s * 100) / 100})">
    <ellipse cx="0" cy="13" rx="11" ry="2.5" fill="#000" opacity=".12"/>
    <path d="M-8 -2V12M8 -2V12M-7 -22V-2M7 -22V-2" stroke="#D8D2CA" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="-9" y="-24" width="18" height="12" rx="3" fill="#FFFFFF" stroke="${LINE}" stroke-width="1"/>
    <path d="M-6 -20h12M-6 -16h12" stroke="#E9E4DD" stroke-width="1.4"/>
    <rect x="-10" y="-3" width="20" height="4.5" rx="2" fill="#FFFFFF" stroke="${LINE}" stroke-width="1"/>
    <path d="M0 -24l-6 -4 1 6zM0 -24l6 -4 -1 6z" fill="${hex}" stroke="${LINE}" stroke-width=".8"/><circle cy="-24" r="1.8" fill="${hex}" stroke="${LINE}" stroke-width=".8"/>
  </g>`;
}

/** Rows of chairs either side of the aisle, nearer rows larger and wider apart. */
function chairs(hex, rows = [182, 204, 232, 266], perSide = 3) {
  return rows.map((y) => {
    const d = depth(y); const s = 0.35 + d * 1.05; const aisle = 10 + d * 58; const step = 26 * s;
    return Array.from({ length: perSide }, (_, k) => chair(200 - aisle - (k + 0.5) * step, y, s, hex) + chair(200 + aisle + (k + 0.5) * step, y, s, hex)).join('');
  }).join('');
}

/** The aisle: a runner narrowing to the horizon, with petals in the couple's color. */
function aisle(fill, hex, from = HZ + 6) {
  const half = (y) => 3 + depth(y) * 44;
  const petals = Array.from({ length: 22 }, (_, i) => {
    const y = from + 8 + ((i * 37) % 130); const hw = half(y) + 6; const x = 200 + (((i * 53) % 100) / 50 - 1) * hw;
    return `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(1 + depth(y) * 2.4)}" ry="${n1(0.6 + depth(y) * 1.4)}" fill="${i % 3 ? hex : '#FFFFFF'}" opacity=".9" transform="rotate(${(i * 47) % 180} ${n1(x)} ${n1(y)})"/>`;
  }).join('');
  return `<path d="M${200 - half(from)} ${from} L${200 + half(from)} ${from} L${200 + half(H)} ${H} L${200 - half(H)} ${H}z" fill="${fill}" opacity=".92"/>
    <path d="M${200 - half(from)} ${from} L${200 - half(H)} ${H}M${200 + half(from)} ${from} L${200 + half(H)} ${H}" stroke="${hex}" stroke-width="2" opacity=".7"/>${petals}`;
}

/** A soft, fluffy cloud, centered at (x, y), w wide. */
function cloud(x, y, w, fill = '#FFFFFF', shade = '#DCE7F2', a = 1) {
  const r = w / 5;
  return `<g opacity="${a}"><ellipse cx="${x}" cy="${y + r * 0.35}" rx="${w / 2}" ry="${r * 0.75}" fill="${shade}"/>
    <circle cx="${x - w * 0.22}" cy="${y}" r="${r}" fill="${fill}"/><circle cx="${x + w * 0.02}" cy="${y - r * 0.55}" r="${r * 1.25}" fill="${fill}"/>
    <circle cx="${x + w * 0.26}" cy="${y + r * 0.05}" r="${r * 0.95}" fill="${fill}"/><ellipse cx="${x}" cy="${y + r * 0.3}" rx="${w / 2.1}" ry="${r * 0.6}" fill="${fill}"/></g>`;
}

/** A palm tree, rooted at (x, y), h tall, leaning (+ right, - left). */
function palm(id, x, y, h, lean) {
  const tx = x + lean; const ty = y - h;
  const rings = Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10; const px = x + lean * t * t; const py = y - h * t; return `<path d="M${n1(px - 4.5 + t * 1.5)} ${n1(py)} q${n1(4.5 - t * 1.5)} 2.5 ${n1(9 - t * 3)} 0" fill="none" stroke="#6E4A2E" stroke-width="1.2" opacity=".6"/>`; }).join('');
  const frond = (ang, len) => {
    const a = (ang * Math.PI) / 180; const ex = tx + Math.cos(a) * len; const ey = ty + Math.sin(a) * len * 0.7 + len * 0.25;
    const mx = tx + Math.cos(a) * len * 0.5; const my = ty + Math.sin(a) * len * 0.35 - len * 0.12;
    return `<path d="M${tx} ${ty} Q${n1(mx)} ${n1(my - 6)} ${n1(ex)} ${n1(ey)} Q${n1(mx)} ${n1(my + 5)} ${tx} ${ty}z" fill="url(#${id}-leaf)" stroke="#2F5E33" stroke-width="1"/>`;
  };
  return `<path d="M${x - 6} ${y} Q${x + lean * 0.3} ${y - h * 0.5} ${tx - 2.5} ${ty} L${tx + 2.5} ${ty} Q${x + lean * 0.3 + 6} ${y - h * 0.5} ${x + 6} ${y}z" fill="url(#${id}-trunk)" stroke="${LINE}" stroke-width="1"/>${rings}
    ${[200, 235, 270, 305, 340, 15, 160].map((g, i) => frond(g, 34 + (i % 3) * 6)).join('')}
    <circle cx="${tx - 3}" cy="${ty + 4}" r="3.2" fill="#6B4A2A"/><circle cx="${tx + 3}" cy="${ty + 5}" r="3.2" fill="#5A3D22"/>`;
}

/** A tiki torch at (x, y), h tall, its flame glowing. */
const torch = (id, x, y, h) => `<path d="M${x} ${y}V${y - h}" stroke="#7A5233" stroke-width="3" stroke-linecap="round"/><rect x="${x - 3.5}" y="${y - h - 7}" width="7" height="8" rx="2" fill="#8C6239"/>
  <circle cx="${x}" cy="${y - h - 12}" r="14" fill="url(#${id}-glow)"/><path d="M${x} ${y - h - 20} q5 7 0 11 q-5 -4 0 -11z" fill="#FFB43C"/><path d="M${x} ${y - h - 15} q2.5 4 0 6 q-2.5 -2 0 -6z" fill="#FFF0A8"/>`;

/** A round, layered tree crown with its trunk, at (x, y) (the foot of the trunk), r across. */
const tree = (x, y, r, dark, mid, light, trunk = '#7A5233') => `<rect x="${x - r * 0.09}" y="${y - r * 0.9}" width="${r * 0.18}" height="${r * 0.9}" fill="${trunk}"/>
  <circle cx="${x}" cy="${y - r * 1.25}" r="${r * 0.62}" fill="${dark}"/><circle cx="${x - r * 0.35}" cy="${y - r * 1.05}" r="${r * 0.45}" fill="${dark}"/><circle cx="${x + r * 0.38}" cy="${y - r * 1.08}" r="${r * 0.46}" fill="${dark}"/>
  <circle cx="${x - r * 0.12}" cy="${y - r * 1.38}" r="${r * 0.42}" fill="${mid}"/><circle cx="${x + r * 0.22}" cy="${y - r * 1.2}" r="${r * 0.34}" fill="${mid}"/><circle cx="${x - r * 0.22}" cy="${y - r * 1.5}" r="${r * 0.18}" fill="${light}"/>`;

/** A row of glowing bulbs hanging between two points, sagging in the middle. */
function lights(id, x1, y1, x2, y2, sag, n) {
  const pt = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + sag * 4 * t * (1 - t)];
  const bulbs = Array.from({ length: n }, (_, i) => { const [x, y] = pt((i + 0.5) / n); return `<circle cx="${n1(x)}" cy="${n1(y + 3)}" r="7" fill="url(#${id}-bulb)"/><circle cx="${n1(x)}" cy="${n1(y + 3)}" r="2.2" fill="#FFF4C2" stroke="#8A6A2A" stroke-width=".6"/>`; }).join('');
  const [mx, my] = pt(0.5);
  return `<path d="M${x1} ${y1} Q${n1(mx)} ${n1(my + sag * 1)} ${x2} ${y2}" fill="none" stroke="#3B3030" stroke-width="1.2"/>${bulbs}`;
}

/** Bunting in the couple's color and white, between two points. */
function bunting(x1, y1, x2, y2, sag, n, hex) {
  const pt = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + sag * 4 * t * (1 - t)];
  const flags = Array.from({ length: n }, (_, i) => { const [ax, ay] = pt(i / n); const [bx, by] = pt((i + 0.8) / n); return `<path d="M${n1(ax)} ${n1(ay)} L${n1(bx)} ${n1(by)} L${n1((ax + bx) / 2)} ${n1((ay + by) / 2 + 11)}z" fill="${i % 2 ? '#FFFFFF' : hex}" stroke="${LINE}" stroke-width=".8"/>`; }).join('');
  const [mx, my] = pt(0.5);
  return `<path d="M${x1} ${y1} Q${n1(mx)} ${n1(my + sag)} ${x2} ${y2}" fill="none" stroke="#3B3030" stroke-width="1"/>${flags}`;
}

/**
 * How full the vases are, from the flowers chosen: a few small wild flowers, an armful of roses, or a great spill of
 * peonies and orchids. Set by venueScene for the scene being drawn.
 */
const BOUQUETS = {
  wild: { k: 0.85, at: [[-10, -34], [0, -40], [10, -34], [-4, -30], [6, -29]] },
  roses: { k: 1, at: [[-14, -36], [-6, -40], [2, -38], [10, -40], [16, -34], [-10, -30], [8, -30], [0, -44]] },
  peonies: { k: 1.2, at: [[-18, -34], [-12, -42], [-4, -46], [4, -44], [12, -42], [18, -34], [-14, -28], [-6, -34], [2, -36], [10, -32], [16, -26], [-2, -28], [6, -50], [-8, -50]] },
};
let bouquet = BOUQUETS.roses;

/** A tall vase of flowers in the couple's color, at (x, y), at scale s. */
const flowers = (x, y, s, hex) => `<g transform="translate(${x} ${y}) scale(${n1(s * bouquet.k * 100) / 100})"><ellipse cx="0" cy="2" rx="12" ry="3" fill="#000" opacity=".15"/>
  <path d="M-7 0 L-9 -22 h18 L7 0z" fill="#F4F1EC" stroke="${LINE}" stroke-width="1"/><path d="M-4 -22 q-8 -10 -12 -14M4 -22 q8 -10 12 -14M0 -22v-12" stroke="#4E8A45" stroke-width="2" fill="none"/>
  ${bouquet.at.map(([fx, fy], i) => `<circle cx="${fx}" cy="${fy}" r="${i % 3 ? 5 : 6}" fill="${i % 4 === 1 ? '#FFFFFF' : hex}" stroke="${LINE}" stroke-width=".8"/>`).join('')}</g>`;

const VENUES = {
  beach(hex) {
    const id = 'ws-beach';
    return `<defs>${lin(`${id}-sky`, [[0, '#45306E'], [0.38, '#9A4F86'], [0.72, '#EE8A6C'], [1, '#FFC98C']])}${rad(`${id}-sun`, [[0, '#FFF6C8'], [0.6, '#FFD27A'], [1, '#FFB35C']])}
      ${rad(`${id}-halo`, [[0, '#FFE9B0', 0.75], [1, '#FFE9B0', 0]])}${lin(`${id}-sea`, [[0, '#F3A985'], [0.25, '#6E93B8'], [1, '#2D6390']])}${lin(`${id}-sand`, [[0, '#F7E2B8'], [1, '#E6BF86']])}
      ${lin(`${id}-trunk`, [[0, '#9A6A43'], [1, '#6E4A2E']], 1, 0)}${lin(`${id}-leaf`, [[0, '#7CC46E'], [1, '#3F8A45']])}${rad(`${id}-glow`, [[0, '#FFD27A', 0.8], [1, '#FFB35C', 0]])}
      <clipPath id="${id}-above"><rect width="${W}" height="${HZ}"/></clipPath></defs>
      <rect width="${W}" height="${HZ}" fill="url(#${id}-sky)"/>
      <circle cx="200" cy="${HZ}" r="110" fill="url(#${id}-halo)"/>
      <g clip-path="url(#${id}-above)"><circle cx="200" cy="${HZ + 6}" r="38" fill="url(#${id}-sun)"/></g>
      ${cloud(78, 62, 70, '#F7B3A6', '#C98299', 0.85)}${cloud(318, 48, 84, '#F9C0A8', '#C98299', 0.85)}${cloud(250, 92, 46, '#FBCFB2', '#D99C9C', 0.7)}
      <rect y="${HZ}" width="${W}" height="42" fill="url(#${id}-sea)"/>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${200 - (34 - i * 4)}" y="${HZ + 3 + i * 5}" width="${(34 - i * 4) * 2}" height="1.6" rx=".8" fill="#FFE7A8" opacity="${0.85 - i * 0.1}"/>`).join('')}
      <path d="M0 168 q25 -3 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity=".35"/>
      <path d="M0 190 q20 -6 40 -2 t40 1 t40 -2 t40 2 t40 -1 t40 2 t40 -2 t40 1 t40 -1 t40 2V300H0z" fill="url(#${id}-sand)"/>
      <path d="M0 190 q20 -6 40 -2 t40 1 t40 -2 t40 2 t40 -1 t40 2 t40 -2 t40 1 t40 -1 t40 2" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".75"/>
      ${[[40, 250], [90, 270], [330, 248], [365, 280], [300, 288]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2" fill="#D9AE72" opacity=".6"/>`).join('')}
      ${aisle('#FFFFFF', hex, 192)}${chairs(hex, [206, 230, 262])}
      ${palm(id, 26, 300, 170, 22)}${palm(id, 374, 300, 150, -26)}${palm(id, 340, 236, 86, -10)}
      ${torch(id, 70, 250, 46)}${torch(id, 330, 250, 46)}`;
  },

  garden(hex) {
    const id = 'ws-garden';
    const stripes = Array.from({ length: 9 }, (_, i) => { const a = -1 + i * 0.25; const b = a + 0.125; return `<path d="M${200 + a * 40} ${HZ} L${200 + b * 40} ${HZ} L${200 + b * 900} ${H} L${200 + a * 900} ${H}z" fill="#FFFFFF" opacity=".07"/>`; }).join('');
    const bloom = (x, y, c, r = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="rgba(60,30,40,.35)" stroke-width=".6"/>`;
    const hedge = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2.2}" fill="url(#${id}-hedge)" stroke="#3E6E35" stroke-width="1"/>${Array.from({ length: Math.round(w / 9) }, (_, i) => bloom(x + 6 + i * 9 + (i % 2) * 3, y + 6 + (i * 7) % (h - 10), [hex, '#FFFFFF', '#FFD36E', '#F28CA8'][i % 4], 3)).join('')}`;
    return `<defs>${lin(`${id}-sky`, [[0, '#8EC8EE'], [1, '#E8F6FF']])}${lin(`${id}-lawn`, [[0, '#9AD27F'], [1, '#5DA247']])}${lin(`${id}-hedge`, [[0, '#6FAE5E'], [1, '#4A8A3E']])}</defs>
      <rect width="${W}" height="${HZ}" fill="url(#${id}-sky)"/>
      ${cloud(70, 48, 80)}${cloud(300, 34, 96)}${cloud(196, 70, 44, '#FFFFFF', '#DCE7F2', 0.8)}
      <path d="M0 ${HZ} q20 -18 40 -10 q18 -16 40 -6 q20 -14 42 -4 q24 -18 46 -6 q22 -12 44 -2 q22 -16 46 -4 q20 -14 42 -6 q22 -16 44 -4 q18 -10 56 -4V${HZ}z" fill="#A9CF98"/>
      ${tree(46, HZ + 2, 34, '#5E9A50', '#77B565', '#9ACF84')}${tree(352, HZ + 2, 38, '#5E9A50', '#77B565', '#9ACF84')}${tree(300, HZ, 22, '#6CA85C', '#86C072', '#A6D891')}
      <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#${id}-lawn)"/>${stripes}
      ${aisle('#F7F3EA', hex)}${chairs(hex)}
      ${hedge(-10, 196, 64, 34)}${hedge(346, 196, 64, 34)}${hedge(-20, 250, 70, 44)}${hedge(350, 250, 70, 44)}
      ${flowers(74, 182, 0.7, hex)}${flowers(326, 182, 0.7, hex)}
      <path d="M126 70 q4 -6 8 0 q4 -6 8 0" fill="none" stroke="#5A4A6A" stroke-width="1.2"/><path d="M270 92 q3 -5 6 0 q3 -5 6 0" fill="none" stroke="#5A4A6A" stroke-width="1.2"/>`;
  },

  chapel(hex) {
    const id = 'ws-chapel';
    const pew = (y, left) => { const d = depth(y); const s = 0.4 + d; const a = 12 + d * 56; const w = 120 * s; const x = left ? 200 - a - w : 200 + a;
      return `<rect x="${n1(x)}" y="${n1(y - 16 * s)}" width="${n1(w)}" height="${n1(14 * s)}" rx="${n1(2 * s)}" fill="url(#${id}-pew)" stroke="${LINE}" stroke-width="1"/><rect x="${n1(x)}" y="${n1(y - 3 * s)}" width="${n1(w)}" height="${n1(5 * s)}" fill="#6B3F24"/>
        <rect x="${n1(left ? x + w - 6 * s : x)}" y="${n1(y - 22 * s)}" width="${n1(6 * s)}" height="${n1(24 * s)}" rx="${n1(2 * s)}" fill="#7B4A2A"/>${flowers(n1(left ? x + w - 3 * s : x + 3 * s), n1(y - 22 * s), n1(s * 0.32), hex)}`; };
    const window = (x, y, w, h, flip) => `<path d="M${x} ${y + h} V${y + w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 V${y + h}z" fill="url(#${id}-glass)" stroke="#5A3E2E" stroke-width="2"/>
      <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h * 0.55} H${x + w}" stroke="#5A3E2E" stroke-width="1.4"/><circle cx="${x + w / 2}" cy="${y + w / 2 + 2}" r="${w / 5}" fill="#F7D774" stroke="#5A3E2E" stroke-width="1"/>
      <path d="M${x + (flip ? 0 : w)} ${y + h * 0.3} L${flip ? x - 80 : x + w + 80} ${H} L${flip ? x - 10 : x + w + 10} ${H}z" fill="#FFF6D8" opacity=".16"/>`;
    const rose = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M200 54 L${n1(200 + Math.cos(a) * 26)} ${n1(54 + Math.sin(a) * 26)} A26 26 0 0 1 ${n1(200 + Math.cos(a + Math.PI / 6) * 26)} ${n1(54 + Math.sin(a + Math.PI / 6) * 26)}z" fill="${['#7FB5E0', '#F28CA8', '#F7D774', '#8E6BC2'][i % 4]}" stroke="#5A3E2E" stroke-width="1"/>`; }).join('');
    return `<defs>${lin(`${id}-wall`, [[0, '#E8D6BF'], [1, '#F6ECDD']])}${lin(`${id}-floor`, [[0, '#A8774E'], [1, '#7A5032']])}${lin(`${id}-pew`, [[0, '#9A633C'], [1, '#6E4226']])}
      ${lin(`${id}-glass`, [[0, '#8EC1EA'], [0.4, '#F3A6C0'], [0.7, '#F7D774'], [1, '#8E6BC2']])}${rad(`${id}-candle`, [[0, '#FFE7A0', 0.9], [1, '#FFD06A', 0]])}${rad(`${id}-lightfall`, [[0, '#FFF6D8', 0.5], [1, '#FFF6D8', 0]])}</defs>
      <rect width="${W}" height="${H}" fill="url(#${id}-wall)"/>
      <path d="M0 0 L120 40 L120 ${HZ} L0 ${H}z" fill="#E2CDB2"/><path d="M400 0 L280 40 L280 ${HZ} L400 ${H}z" fill="#E2CDB2"/>
      <path d="M120 40 Q200 -10 280 40" fill="none" stroke="#C8AD8C" stroke-width="5"/><path d="M60 0 Q200 -40 340 0" fill="none" stroke="#C8AD8C" stroke-width="6"/>
      <rect x="120" y="40" width="160" height="${HZ - 40}" fill="#F3E6D3"/>
      <circle cx="200" cy="54" r="34" fill="url(#${id}-lightfall)"/><circle cx="200" cy="54" r="28" fill="#5A3E2E"/>${rose}<circle cx="200" cy="54" r="7" fill="#FFF3C0" stroke="#5A3E2E" stroke-width="1"/>
      ${window(20, 40, 34, 92, false)}${window(346, 40, 34, 92, true)}${window(130, 76, 18, 52, false)}${window(252, 76, 18, 52, true)}
      <path d="M120 ${HZ} L280 ${HZ} L400 ${H} L0 ${H}z" fill="url(#${id}-floor)"/>
      ${Array.from({ length: 7 }, (_, i) => `<path d="M${140 + i * 20} ${HZ} L${-40 + i * 80} ${H}" stroke="#6B4429" stroke-width="1" opacity=".35"/>`).join('')}
      ${aisle('#B23A48', hex, HZ)}
      ${[168, 186, 210, 240, 276].map((y) => pew(y, true) + pew(y, false)).join('')}
      ${[[96, 128], [304, 128]].map(([x, y]) => `<path d="M${x} ${y + 40}V${y}" stroke="#C9A24A" stroke-width="2.5"/><path d="M${x - 8} ${y + 40}h16" stroke="#C9A24A" stroke-width="3"/><rect x="${x - 2}" y="${y - 12}" width="4" height="12" fill="#FFFBEF"/><circle cx="${x}" cy="${y - 16}" r="12" fill="url(#${id}-candle)"/><path d="M${x} ${y - 21} q3 4 0 6 q-3 -2 0 -6z" fill="#FFB43C"/>`).join('')}`;
  },

  ballroom(hex) {
    const id = 'ws-ballroom';
    const ys = [HZ, 158, 168, 181, 198, 220, 250, 290, 340];
    const xAt = (k, y) => 200 + k * (12 + depth(y) * 120);
    const tiles = [];
    for (let r = 0; r < ys.length - 1; r++) for (let k = -10; k < 10; k++) if ((r + k) % 2 === 0) tiles.push(`<path d="M${n1(xAt(k, ys[r]))} ${ys[r]} L${n1(xAt(k + 1, ys[r]))} ${ys[r]} L${n1(xAt(k + 1, ys[r + 1]))} ${ys[r + 1]} L${n1(xAt(k, ys[r + 1]))} ${ys[r + 1]}z" fill="#2E2235" opacity=".55"/>`);
    const chandelier = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cy="18" r="46" fill="url(#${id}-glow)"/><path d="M0 -40V2" stroke="#C9A24A" stroke-width="2"/>
      <path d="M-30 14 Q0 34 30 14" fill="none" stroke="#C9A24A" stroke-width="3"/><path d="M-20 4 Q0 18 20 4" fill="none" stroke="#C9A24A" stroke-width="2.5"/><ellipse cy="2" rx="8" ry="4" fill="#E8C563"/>
      ${[-30, -15, 0, 15, 30].map((cx) => `<path d="M${cx} ${16 - Math.abs(cx) / 4}v-8" stroke="#C9A24A" stroke-width="1.5"/><circle cx="${cx}" cy="${6 - Math.abs(cx) / 4}" r="3" fill="#FFF3C0"/>`).join('')}
      ${[-24, -12, 0, 12, 24].map((cx) => `<path d="M${cx} ${20 - Math.abs(cx) / 6}l-2 6h4z" fill="#DDF0FF" stroke="#9FB8CC" stroke-width=".5"/>`).join('')}</g>`;
    const window = (x, w) => `<path d="M${x} 130 V40 a${w / 2} ${w / 2} 0 0 1 ${w} 0 V130z" fill="url(#${id}-night)" stroke="#C9A24A" stroke-width="3"/>
      <path d="M${x + w / 2} ${40 - w / 2} V130 M${x} 85 H${x + w}" stroke="#C9A24A" stroke-width="1.5"/><circle cx="${x + w * 0.7}" cy="56" r="1.4" fill="#FFF"/><circle cx="${x + w * 0.3}" cy="70" r="1" fill="#FFF"/>
      <path d="M${x - 8} ${26 - w / 3} Q${x + 4} 80 ${x - 4} 140 L${x - 14} 140 Q${x - 10} 70 ${x - 14} ${22 - w / 3}z" fill="url(#${id}-drape)"/><path d="M${x + w + 8} ${26 - w / 3} Q${x + w - 4} 80 ${x + w + 4} 140 L${x + w + 14} 140 Q${x + w + 10} 70 ${x + w + 14} ${22 - w / 3}z" fill="url(#${id}-drape)"/>`;
    const table = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="22" rx="30" ry="6" fill="#000" opacity=".25"/><path d="M-30 0 Q-32 18 -26 22 L26 22 Q32 18 30 0z" fill="#FBF8F2" stroke="${LINE}" stroke-width="1"/>
      <ellipse rx="30" ry="7" fill="#FFFFFF" stroke="${LINE}" stroke-width="1"/>${flowers(0, 2, 0.45, hex)}<circle cx="-16" cy="-2" r="2.5" fill="#FFE7A0"/><circle cx="16" cy="-2" r="2.5" fill="#FFE7A0"/></g>`;
    return `<defs>${lin(`${id}-wall`, [[0, '#4A2C5C'], [1, '#6E4682']])}${lin(`${id}-floor`, [[0, '#E9DCC8'], [1, '#C9B293']])}${lin(`${id}-night`, [[0, '#1E2A55'], [1, '#3E4E8A']])}
      ${lin(`${id}-drape`, [[0, '#8E2F4A'], [0.5, '#B54A66'], [1, '#7A2440']], 1, 0)}${rad(`${id}-glow`, [[0, '#FFEFB8', 0.75], [1, '#FFD87A', 0]])}${lin(`${id}-col`, [[0, '#EDE2F0'], [0.5, '#FFFFFF'], [1, '#D7C8DE']], 1, 0)}</defs>
      <rect width="${W}" height="${H}" fill="url(#${id}-wall)"/>
      <path d="M0 108 H400" stroke="#C9A24A" stroke-width="2" opacity=".6"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${8 + i * 50}" y="114" width="40" height="30" rx="2" fill="none" stroke="#C9A24A" stroke-width="1" opacity=".35"/>`).join('')}
      ${window(36, 40)}${window(324, 40)}${window(150, 26)}${window(224, 26)}
      ${[[10, 18], [370, 18]].map(([x, w]) => `<rect x="${x}" y="0" width="${w}" height="${HZ}" fill="url(#${id}-col)" stroke="${LINE}" stroke-width="1"/><rect x="${x - 4}" y="${HZ - 10}" width="${w + 8}" height="10" fill="#E2D3E8"/>`).join('')}
      <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#${id}-floor)"/>${tiles.join('')}
      <ellipse cx="200" cy="${HZ + 30}" rx="150" ry="16" fill="#FFF6D8" opacity=".18"/>
      ${chandelier(110, 38, 0.8)}${chandelier(290, 38, 0.8)}${chandelier(200, 10, 1)}
      ${aisle('#FFFFFF', hex)}
      ${table(52, 196, 0.8)}${table(348, 196, 0.8)}${table(26, 250, 1.1)}${table(374, 250, 1.1)}`;
  },

  castle(hex) {
    const id = 'ws-castle';
    const tower = (x, w, top, roof) => `<rect x="${x}" y="${top}" width="${w}" height="${HZ - top + 2}" fill="url(#${id}-stone)" stroke="${LINE}" stroke-width="1"/>
      <path d="M${x - 4} ${top} L${x + w / 2} ${top - roof} L${x + w + 4} ${top}z" fill="url(#${id}-roof)" stroke="${LINE}" stroke-width="1"/>
      <path d="M${x + w / 2} ${top - roof} v-14" stroke="#5A4A3A" stroke-width="1.2"/><path d="M${x + w / 2} ${top - roof - 14} l14 4 -14 4z" fill="${hex}" stroke="${LINE}" stroke-width=".8"/>
      <path d="M${x + w / 2 - 5} ${top + 30} v-8 a5 5 0 0 1 10 0 v8z" fill="#3A3550"/><path d="M${x + w / 2 - 5} ${top + 62} v-8 a5 5 0 0 1 10 0 v8z" fill="#FFD87A" opacity=".85"/>`;
    const banner = (x, y) => `<path d="M${x} ${y} h16 v34 l-8 -6 -8 6z" fill="${hex}" stroke="${LINE}" stroke-width="1"/><path d="M${x + 8} ${y + 8} l3 6 h-6z" fill="#F7D774"/>`;
    const blocks = Array.from({ length: 6 }, (_, r) => Array.from({ length: 22 }, (_, k) => `<rect x="${(k * 20 + (r % 2) * 10) - 10}" y="${70 + r * 13}" width="19" height="12" fill="none" stroke="#A99FB8" stroke-width=".8" opacity=".6"/>`).join('')).join('');
    return `<defs>${lin(`${id}-sky`, [[0, '#7FB2E6'], [1, '#E3EFFB']])}${lin(`${id}-stone`, [[0, '#D6CFE0'], [1, '#B3AAC3']])}${lin(`${id}-roof`, [[0, '#D0607E'], [1, '#9A3A5A']], 1, 0)}
      ${lin(`${id}-grass`, [[0, '#9CCB84'], [1, '#5E9C4A']])}${lin(`${id}-mtn`, [[0, '#9AA9CC'], [1, '#C7D2EA']])}</defs>
      <rect width="${W}" height="${HZ}" fill="url(#${id}-sky)"/>${cloud(70, 30, 70)}${cloud(320, 24, 60, '#FFFFFF', '#DCE7F2', 0.9)}
      <path d="M0 110 L50 70 L95 100 L150 56 L210 96 L260 62 L320 98 L370 68 L400 86 V${HZ} H0z" fill="url(#${id}-mtn)"/>
      <path d="M140 66 l10 -10 10 12z M250 72 l10 -10 10 12z" fill="#FFFFFF" opacity=".85"/>
      <rect x="0" y="70" width="${W}" height="${HZ - 68}" fill="url(#${id}-stone)"/>${blocks}
      <path d="M0 70 ${Array.from({ length: 20 }, (_, k) => `h10 v-10 h10 v10`).join(' ')}" fill="url(#${id}-stone)" stroke="${LINE}" stroke-width="1"/>
      <path d="M170 ${HZ} v-46 a30 30 0 0 1 60 0 v46z" fill="#4A3A2E" stroke="${LINE}" stroke-width="1.5"/><path d="M178 ${HZ} v-42 a22 22 0 0 1 44 0 v42" fill="none" stroke="#2E241C" stroke-width="2"/>
      ${tower(-6, 52, 28, 40)}${tower(354, 52, 28, 40)}${tower(112, 34, 46, 30)}${tower(254, 34, 46, 30)}
      ${banner(64, 82)}${banner(320, 82)}${banner(150, 84)}${banner(234, 84)}
      <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#${id}-grass)"/>
      ${aisle('#E8E1D6', hex)}${chairs(hex)}
      ${[[38, 228, 1], [362, 228, 1], [70, 184, 0.6], [330, 184, 0.6]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="4" rx="14" ry="3" fill="#000" opacity=".15"/><path d="M-10 4 L-8 -10 h16 L10 4z" fill="#C9C1D6" stroke="${LINE}" stroke-width="1"/><path d="M0 -10 L-12 -44 L0 -60 L12 -44z" fill="#4E8A45" stroke="#2F5E33" stroke-width="1"/><path d="M0 -60 L-6 -44 L0 -14" stroke="#6FAE5E" stroke-width="2" fill="none"/></g>`).join('')}`;
  },

  vineyard(hex) {
    const id = 'ws-vineyard';
    const rows = Array.from({ length: 14 }, (_, i) => { const k = i - 6.5; return `<path d="M${200 + k * 9} ${HZ + 6} Q${200 + k * 40} ${HZ + 60} ${200 + k * 110} ${H}" fill="none" stroke="#5E7D3A" stroke-width="${3 + Math.abs(k) * 0.4}" stroke-dasharray="${6 + Math.abs(k)} 5" opacity=".9"/>`; }).join('');
    const cypress = (x, y, h) => `<path d="M${x} ${y} q-${h / 6} -${h * 0.5} 0 -${h} q${h / 6} ${h * 0.5} 0 ${h}z" fill="url(#${id}-cyp)" stroke="#23421F" stroke-width="1"/>`;
    return `<defs>${lin(`${id}-sky`, [[0, '#F4B36A'], [0.6, '#FFD9A0'], [1, '#FFF1D6']])}${rad(`${id}-sun`, [[0, '#FFF6D0'], [0.5, '#FFE08A', 0.9], [1, '#FFC86A', 0]])}
      ${lin(`${id}-far`, [[0, '#B79AC0'], [1, '#D7BFCF']])}${lin(`${id}-mid`, [[0, '#B9C77E'], [1, '#93A85E']])}${lin(`${id}-near`, [[0, '#C7B26E'], [1, '#9C8650']])}${lin(`${id}-cyp`, [[0, '#2F5A2C'], [1, '#4E7E45']], 1, 0)}</defs>
      <rect width="${W}" height="${HZ}" fill="url(#${id}-sky)"/><circle cx="92" cy="${HZ - 26}" r="70" fill="url(#${id}-sun)"/>
      ${cloud(300, 40, 70, '#FFF3DC', '#F2C98E', 0.85)}
      <path d="M0 126 Q60 104 130 120 T260 112 T400 120 V${HZ}H0z" fill="url(#${id}-far)"/>
      <path d="M0 ${HZ} Q50 124 110 136 Q170 146 220 134 Q300 118 400 138 V${HZ + 10} H0z" fill="url(#${id}-mid)"/>
      <path d="M44 132 l18 -12 18 12z" fill="#C8643E" stroke="${LINE}" stroke-width="1"/><rect x="48" y="132" width="28" height="14" fill="#F3E2C6" stroke="${LINE}" stroke-width="1"/><rect x="58" y="137" width="6" height="9" fill="#7A5233"/><rect x="68" y="135" width="5" height="5" fill="#FFD87A"/>
      ${cypress(94, 140, 40)}${cypress(104, 141, 30)}${cypress(318, 134, 44)}${cypress(330, 136, 32)}
      <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#${id}-near)"/>${rows}
      ${aisle('#F5EBDA', hex)}${chairs(hex, [200, 226, 260])}
      <path d="M14 ${H} V96 M386 ${H} V96" stroke="#7A5233" stroke-width="7"/><path d="M6 96 H60 M340 96 H394" stroke="#7A5233" stroke-width="6"/>
      ${lights(id, 14, 98, 186, 66, 26, 7)}${lights(id, 214, 66, 386, 98, 26, 7)}
      <defs>${rad(`${id}-bulb`, [[0, '#FFF1B0', 0.9], [1, '#FFD87A', 0]])}</defs>
      ${[[36, 262], [364, 262]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 26}" rx="22" ry="5" fill="#000" opacity=".18"/><path d="M${x - 18} ${y} q-3 14 0 28 h36 q3 -14 0 -28z" fill="#8C5A34" stroke="${LINE}" stroke-width="1"/><path d="M${x - 19} ${y + 7} h38 M${x - 19} ${y + 21} h38" stroke="#5A3A22" stroke-width="2"/>${flowers(x, y, 0.7, hex)}`).join('')}`;
  },

  backyard(hex) {
    const id = 'ws-backyard';
    const pickets = Array.from({ length: 30 }, (_, i) => `<path d="M${i * 14 - 4} ${HZ + 2} V${HZ - 24} l5 -6 5 6 V${HZ + 2}z" fill="#F7F2E8" stroke="#C9BFAF" stroke-width="1"/>`).join('');
    return `<defs>${lin(`${id}-sky`, [[0, '#6E8FC6'], [0.55, '#C7B6D8'], [1, '#FFD3B0']])}${lin(`${id}-lawn`, [[0, '#8CC775'], [1, '#55963F']])}${lin(`${id}-siding`, [[0, '#BFD9EA'], [1, '#9EC1DA']])}
      ${rad(`${id}-bulb`, [[0, '#FFF1B0', 0.95], [1, '#FFD87A', 0]])}${rad(`${id}-win`, [[0, '#FFE7A0'], [1, '#F2B860']])}</defs>
      <rect width="${W}" height="${HZ}" fill="url(#${id}-sky)"/>${cloud(250, 46, 60, '#F6DCE6', '#C9A6C6', 0.8)}<circle cx="320" cy="34" r="1.2" fill="#FFF"/><circle cx="140" cy="22" r="1" fill="#FFF"/>
      <path d="M-10 ${HZ - 10} V56 L54 22 L118 56 V${HZ - 10}z" fill="url(#${id}-siding)" stroke="${LINE}" stroke-width="1.2"/>${Array.from({ length: 8 }, (_, i) => `<path d="M-10 ${64 + i * 10}H118" stroke="#8FB2CC" stroke-width="1"/>`).join('')}
      <path d="M-14 58 L54 18 L122 58" fill="none" stroke="#6E5A6A" stroke-width="5"/><rect x="18" y="66" width="30" height="26" fill="url(#${id}-win)" stroke="#FFFFFF" stroke-width="3"/><path d="M33 66v26M18 79h30" stroke="#FFFFFF" stroke-width="2"/>
      <rect x="62" y="84" width="22" height="${HZ - 94}" fill="#7A5A6A" stroke="#FFFFFF" stroke-width="2"/>
      ${tree(352, HZ - 6, 58, '#4F8A47', '#68A55C', '#8AC27A')}${tree(300, HZ - 2, 26, '#5E9A50', '#77B565', '#9ACF84')}
      ${pickets}<path d="M0 ${HZ - 14} H400" stroke="#C9BFAF" stroke-width="2"/>
      <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#${id}-lawn)"/>
      ${aisle('#F7F3EA', hex)}${chairs(hex)}
      ${lights(id, 0, 30, 200, 52, 18, 8)}${lights(id, 200, 52, 400, 24, 18, 8)}
      ${bunting(120, 70, 280, 70, 16, 10, hex)}
      ${[[30, 280], [370, 280]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 8}" rx="18" ry="4" fill="#000" opacity=".18"/><path d="M${x - 14} ${y - 20} L${x - 10} ${y + 6} H${x + 10} L${x + 14} ${y - 20}z" fill="#C8643E" stroke="${LINE}" stroke-width="1"/>${flowers(x, y - 20, 0.75, hex)}`).join('')}`;
  },

  courthouse(hex) {
    const id = 'ws-hall';
    const column = (x, w) => `<rect x="${x}" y="22" width="${w}" height="${HZ - 26}" fill="url(#${id}-col)" stroke="${LINE}" stroke-width="1"/>${Array.from({ length: 4 }, (_, i) => `<path d="M${x + (i + 1) * w / 5} 26 V${HZ - 6}" stroke="#D5CABB" stroke-width="1"/>`).join('')}
      <rect x="${x - 5}" y="14" width="${w + 10}" height="10" rx="2" fill="#EDE5D8" stroke="${LINE}" stroke-width="1"/><rect x="${x - 5}" y="${HZ - 8}" width="${w + 10}" height="10" rx="2" fill="#EDE5D8" stroke="${LINE}" stroke-width="1"/>`;
    const flag = (x, colors) => `<path d="M${x} ${HZ + 4} V40" stroke="#C9A24A" stroke-width="2.5"/><circle cx="${x}" cy="38" r="3" fill="#E8C563"/>
      <path d="M${x} 44 q14 6 26 0 v28 q-12 6 -26 0z" fill="${colors[0]}" stroke="${LINE}" stroke-width="1"/><path d="M${x} 53 q14 6 26 0 v9 q-12 6 -26 0z" fill="${colors[1]}"/>`;
    const ys = [HZ, 162, 178, 200, 230, 272, 330];
    const xAt = (k, y) => 200 + k * (16 + depth(y) * 130);
    const tiles = [];
    for (let r = 0; r < ys.length - 1; r++) for (let k = -8; k < 8; k++) tiles.push(`<path d="M${n1(xAt(k, ys[r]))} ${ys[r]} L${n1(xAt(k + 1, ys[r]))} ${ys[r]} L${n1(xAt(k + 1, ys[r + 1]))} ${ys[r + 1]} L${n1(xAt(k, ys[r + 1]))} ${ys[r + 1]}z" fill="${(r + k) % 2 ? '#E7DFD2' : '#D6CBBB'}" stroke="#C3B6A3" stroke-width=".6"/>`);
    return `<defs>${lin(`${id}-wall`, [[0, '#EFE7DA'], [1, '#E2D7C6']])}${lin(`${id}-col`, [[0, '#F3EDE3'], [0.5, '#FFFFFF'], [1, '#DCD2C3']], 1, 0)}${lin(`${id}-win`, [[0, '#CFE6F7'], [1, '#F2F8FD']])}${rad(`${id}-sun`, [[0, '#FFF8DE', 0.6], [1, '#FFF8DE', 0]])}</defs>
      <rect width="${W}" height="${H}" fill="url(#${id}-wall)"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${i * 70 - 10}" y="0" width="66" height="12" fill="#E6DCCB" stroke="#D2C5B1" stroke-width="1"/>`).join('')}
      <path d="M150 128 V44 a50 50 0 0 1 100 0 V128z" fill="url(#${id}-win)" stroke="#BFAF96" stroke-width="3"/><path d="M200 -6 V128 M150 86 H250 M175 0 V128 M225 0 V128" stroke="#BFAF96" stroke-width="1.6"/>
      <circle cx="200" cy="70" r="60" fill="url(#${id}-sun)"/>
      <circle cx="200" cy="30" r="15" fill="#E8C563" stroke="#A68A3A" stroke-width="2"/><circle cx="200" cy="30" r="9" fill="none" stroke="#A68A3A" stroke-width="1.5"/><path d="M200 23 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z" fill="#A68A3A"/>
      ${column(18, 30)}${column(352, 30)}${column(104, 22)}${column(274, 22)}
      ${flag(64, ['#3A5A9A', '#FFFFFF'])}${flag(310, [hex, '#FFFFFF'])}
      ${tiles.join('')}
      ${aisle('#8E2F4A', hex)}
      ${[[44, 238], [356, 238]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 26}" rx="22" ry="5" fill="#000" opacity=".15"/><path d="M${x - 12} ${y + 4} L${x - 9} ${y + 26} h18 L${x + 12} ${y + 4}z" fill="#B88A5A" stroke="${LINE}" stroke-width="1"/>
        <circle cx="${x}" cy="${y - 22}" r="22" fill="#5E9A50"/><circle cx="${x - 12}" cy="${y - 8}" r="14" fill="#4F8A47"/><circle cx="${x + 12}" cy="${y - 10}" r="15" fill="#68A55C"/><circle cx="${x + 4}" cy="${y - 34}" r="11" fill="#7DB86E"/>`).join('')}
      ${[200, 224].map((y) => { const d = depth(y); const s = 0.4 + d; const a = 14 + d * 54; return [-1, 1].map((side) => `<rect x="${n1(side < 0 ? 200 - a - 80 * s : 200 + a)}" y="${n1(y - 14 * s)}" width="${n1(80 * s)}" height="${n1(12 * s)}" rx="${n1(2 * s)}" fill="#8C5A34" stroke="${LINE}" stroke-width="1"/>`).join(''); }).join('')}`;
  },
};

/** The illustrated backdrop for a venue, in the couple's color `hex`, its vases filled with the `flowers` chosen. */
export function venueScene(venue, hex = '#F6B8C8', flowers = 'roses') {
  const draw = VENUES[venue] ?? VENUES.garden;
  bouquet = BOUQUETS[flowers] ?? BOUQUETS.roses;
  return `<svg class="sv-room" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${draw(hex)}
    <rect width="${W}" height="${H}" fill="url(#ws-vignette)"/><defs>${rad('ws-vignette', [[0.55, '#000000', 0], [1, '#000000', 0.22]], 0.5, 0.45, 0.75)}</defs></svg>`;
}

export const VENUE_IDS = Object.keys(VENUES);
