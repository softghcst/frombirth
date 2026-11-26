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

// ---------- What stands either side of the couple, and the postcard home ----------

/** The cake chosen, on a little stand (100 x 120), in the couple's color. */
export function cakeArt(cake, hex) {
  const stand = `<ellipse cx="50" cy="114" rx="30" ry="4" fill="#000" opacity=".18"/><path d="M38 112 h24 l-4 -10 h-16z" fill="#E9E2D6" stroke="${LINE}" stroke-width="1"/><ellipse cx="50" cy="101" rx="36" ry="5" fill="#FFFFFF" stroke="${LINE}" stroke-width="1"/>`;
  const tier = (y, w, h, i) => `<rect x="${50 - w / 2}" y="${y - h}" width="${w}" height="${h}" rx="4" fill="#FFFDF8" stroke="${LINE}" stroke-width="1"/>
    <path d="M${50 - w / 2} ${y - h + 5} q${w / 8} 6 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4} 0" fill="#FFFFFF" stroke="#E8E0D4" stroke-width="1.5"/>
    <rect x="${50 - w / 2}" y="${y - 6}" width="${w}" height="4" fill="${hex}" opacity=".95"/>${i % 2 ? `<circle cx="${50 - w / 2 + 6}" cy="${y - h + 8}" r="2.2" fill="#C8324A"/><circle cx="${50 + w / 2 - 6}" cy="${y - h + 8}" r="2.2" fill="#C8324A"/>` : ''}`;
  const bloom = (x, y, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${hex}" stroke="${LINE}" stroke-width=".7"/><circle cx="${x}" cy="${y}" r="${r / 3}" fill="#FFD36E"/>`;
  if (cake === 'cupcakes') {
    const cup = (x, y) => `<path d="M${x - 6} ${y} l2 9 h8 l2 -9z" fill="#E6C39A" stroke="${LINE}" stroke-width=".8"/><path d="M${x - 7} ${y} q0 -8 7 -9 q7 1 7 9z" fill="${hex}" stroke="${LINE}" stroke-width=".8"/><circle cx="${x}" cy="${y - 9}" r="1.8" fill="#C8324A"/>`;
    return `<svg viewBox="0 0 100 120" aria-hidden="true">${stand}<path d="M50 98V40" stroke="#D9CFBF" stroke-width="2"/><ellipse cx="50" cy="72" rx="26" ry="3.5" fill="#FFFFFF" stroke="${LINE}" stroke-width="1"/><ellipse cx="50" cy="46" rx="16" ry="3" fill="#FFFFFF" stroke="${LINE}" stroke-width="1"/>
      ${[[24, 90], [38, 90], [62, 90], [76, 90], [32, 63], [50, 63], [68, 63], [42, 37], [58, 37]].map(([x, y]) => cup(x, y)).join('')}${cup(50, 22)}</svg>`;
  }
  if (cake === 'showstopper') {
    const tiers = [[98, 64, 16], [82, 52, 15], [67, 42, 14], [53, 32, 13], [40, 22, 12]].map(([y, w, h], i) => tier(y, w, h, i)).join('');
    const cascade = [[70, 92], [64, 82], [58, 72], [56, 62], [50, 52], [46, 40], [52, 30], [30, 94], [36, 86]].map(([x, y], i) => bloom(x, y, i % 2 ? 3.4 : 4.4)).join('');
    return `<svg viewBox="0 0 100 120" aria-hidden="true">${stand}${tiers}${cascade}<path d="M50 28 v-8" stroke="#C9A24A" stroke-width="1.5"/><path d="M46 16 q4 -6 8 0 q-4 5 -8 0z" fill="#E8C563" stroke="#A68A3A" stroke-width=".8"/></svg>`;
  }
  // The three tiers: buttercream, a ribbon of the couple's color on each, berries, a flower on top.
  return `<svg viewBox="0 0 100 120" aria-hidden="true">${stand}${tier(98, 66, 22, 0)}${tier(76, 50, 20, 1)}${tier(56, 34, 18, 2)}${bloom(50, 36, 6)}${bloom(42, 39, 4)}${bloom(58, 39, 4)}</svg>`;
}

const person = (x, y, skin, suit, hair) => `<rect x="${x - 9}" y="${y}" width="18" height="30" rx="7" fill="${suit}" stroke="${LINE}" stroke-width="1"/><path d="M${x - 3} ${y} l3 8 3 -8z" fill="#FFFFFF"/>
  <circle cx="${x}" cy="${y - 8}" r="8" fill="${skin}" stroke="${LINE}" stroke-width="1"/><path d="M${x - 8} ${y - 9} q1 -9 8 -9 q7 0 8 9 q-4 -5 -8 -5 q-4 0 -8 5z" fill="${hair}"/>`;

/** Whoever is playing (100 x 120): a speaker for the playlist, a DJ, a band, a string quartet. */
export function bandArt(music) {
  const note = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 v-12 l8 -3 v12" fill="none" stroke="#3B3030" stroke-width="1.6"/><ellipse cx="-2" cy="0" rx="3" ry="2.2" fill="#3B3030"/><ellipse cx="6" cy="-3" rx="3" ry="2.2" fill="#3B3030"/></g>`;
  const floor = '<ellipse cx="50" cy="114" rx="40" ry="4" fill="#000" opacity=".16"/>';
  if (music === 'playlist') {
    return `<svg viewBox="12 18 76 100" aria-hidden="true">${floor}<rect x="32" y="56" width="36" height="58" rx="6" fill="#3D3A44" stroke="${LINE}" stroke-width="1"/><circle cx="50" cy="94" r="12" fill="#22202A" stroke="#6E6A78" stroke-width="2"/><circle cx="50" cy="94" r="4" fill="#6E6A78"/><circle cx="50" cy="70" r="6" fill="#22202A" stroke="#6E6A78" stroke-width="1.5"/>
      ${note(26, 46)}${note(64, 38, 0.8)}${note(44, 26, 0.7)}</svg>`;
  }
  if (music === 'dj') {
    return `<svg viewBox="12 18 76 100" aria-hidden="true">${floor}${person(50, 58, '#C68B5E', '#2E2A3A', '#2A1A12')}<path d="M40 48 q10 -14 20 0" fill="none" stroke="#E2557A" stroke-width="3"/><rect x="37" y="46" width="6" height="8" rx="2" fill="#E2557A"/><rect x="57" y="46" width="6" height="8" rx="2" fill="#E2557A"/>
      <path d="M14 80 h72 l-6 34 h-60z" fill="#4A3F5C" stroke="${LINE}" stroke-width="1"/><ellipse cx="34" cy="80" rx="12" ry="3" fill="#22202A"/><ellipse cx="66" cy="80" rx="12" ry="3" fill="#22202A"/><path d="M20 96 h60" stroke="#8E7AB5" stroke-width="2"/>${note(78, 50, 0.8)}</svg>`;
  }
  if (music === 'band') {
    return `<svg viewBox="12 18 76 100" aria-hidden="true">${floor}${person(28, 62, '#8D5A3B', '#3B3030', '#1E140E')}${person(72, 62, '#F1C7A0', '#7A2440', '#8A5A2A')}
      <path d="M34 72 q10 8 6 22 q-2 6 -8 4 q4 -10 -4 -18z" fill="#E8C563" stroke="#A68A3A" stroke-width="1"/><circle cx="31" cy="96" r="4" fill="#E8C563" stroke="#A68A3A" stroke-width="1"/>
      <path d="M86 112 V60" stroke="#6E6A78" stroke-width="2"/><rect x="83" y="52" width="6" height="10" rx="3" fill="#3B3030"/><path d="M78 76 l7 -14" stroke="#F1C7A0" stroke-width="3" stroke-linecap="round"/>${note(52, 36, 0.8)}</svg>`;
  }
  // The quartet: two violinists in black, bows raised.
  const violin = (x, y, flip) => `<g transform="translate(${x} ${y}) rotate(${flip ? 20 : -20})"><ellipse cx="0" cy="0" rx="6" ry="9" fill="#A0522D" stroke="${LINE}" stroke-width=".8"/><path d="M0 -9 v-12" stroke="#3B2416" stroke-width="2"/></g>
    <path d="M${x + (flip ? -14 : 14)} ${y - 16} L${x + (flip ? 10 : -10)} ${y + 6}" stroke="#D9CFBF" stroke-width="1.5"/>`;
  return `<svg viewBox="12 18 76 100" aria-hidden="true">${floor}${person(30, 64, '#E8B48C', '#22202A', '#4A2C1A')}${person(70, 64, '#6E4630', '#22202A', '#120C08')}${violin(38, 62, false)}${violin(62, 62, true)}${note(50, 34, 0.8)}</svg>`;
}

// ---------- The honeymoon postcard ----------

/** The little car the couple drive away in, "Just married" on the back, cans trailing, in their color. */
const car = (x, y, s, hex) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="12" rx="30" ry="4" fill="#000" opacity=".18"/>
  <path d="M-28 4 q0 -12 10 -13 l8 -10 q3 -3 8 -3 h16 q5 0 8 4 l6 9 q8 1 8 12 v4 h-64z" fill="${hex}" stroke="#23140f" stroke-width="1.6"/>
  <path d="M-8 -9 l5 -8 h10 v8z M9 -9 v-8 h6 l6 8z" fill="#CFE6F7" stroke="#23140f" stroke-width="1.2"/>
  <circle cx="-16" cy="8" r="6" fill="#2A2A30"/><circle cx="-16" cy="8" r="2.4" fill="#B9B9C2"/><circle cx="18" cy="8" r="6" fill="#2A2A30"/><circle cx="18" cy="8" r="2.4" fill="#B9B9C2"/>
  <rect x="-27" y="-1" width="14" height="5" rx="1" fill="#FFFFFF" stroke="#23140f" stroke-width=".6"/><text x="-20" y="2.8" text-anchor="middle" font-size="3.6" font-family="Georgia, serif" font-weight="700" fill="#C2456A">JUST MARRIED</text>
  <path d="M-28 4 l-10 6 M-28 6 l-14 10" stroke="#8A8A92" stroke-width=".8"/><rect x="-42" y="8" width="4" height="5" rx="1" fill="#C9CDD6" stroke="#23140f" stroke-width=".5"/><rect x="-47" y="14" width="4" height="5" rx="1" fill="#C9CDD6" stroke="#23140f" stroke-width=".5"/>
  <path d="M-4 -19 q4 -5 8 0 q-4 4 -8 0z" fill="#E2557A"/></g>`;

const sky = (id, a, b) => `${lin(`${id}-sky`, [[0, a], [1, b]])}`;
const sea = (id, a, b) => `${lin(`${id}-sea`, [[0, a], [1, b]])}`;
const hut = (x, y) => `<path d="M${x - 2} ${y + 13} v11 M${x + 12} ${y + 13} v11" stroke="#7A5233" stroke-width="2"/><rect x="${x - 4}" y="${y}" width="20" height="13" fill="#E9C48B" stroke="#23140f" stroke-width="1"/><rect x="${x + 3}" y="${y + 4}" width="6" height="9" fill="#8C6239"/><path d="M${x - 9} ${y + 1} L${x + 6} ${y - 12} L${x + 21} ${y + 1}z" fill="#C8963E" stroke="#23140f" stroke-width="1"/>`;
const sparkleSea = (y, n = 8) => Array.from({ length: n }, (_, i) => `<path d="M${18 + i * 37} ${y + (i % 3) * 9} h${10 + (i % 2) * 6}" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`).join('');
const pine = (x, y, h, c = '#3F6E45') => `<path d="M${x} ${y - h} l${h * 0.28} ${h * 0.45} h-${h * 0.12} l${h * 0.2} ${h * 0.35} h-${h * 0.14} l${h * 0.16} ${h * 0.2} h-${h * 0.8} l${h * 0.16} -${h * 0.2} h-${h * 0.14} l${h * 0.2} -${h * 0.35} h-${h * 0.12}z" fill="${c}" stroke="#23421F" stroke-width=".8"/>`;

/** Each place's picture (300 x 200), with what it is known for. */
const POSTCARDS = {
  'Bora Bora': (id, hex) => `<defs>${sky(id, '#6FB8EC', '#D8F0FF')}${sea(id, '#5FD6D2', '#1C8FB0')}${lin(`${id}-mtn`, [[0, '#4E8F4A'], [1, '#2F6A3A']])}${lin(`${id}-trunk`, [[0, '#9A6A43'], [1, '#6E4A2E']], 1, 0)}${lin(`${id}-leaf`, [[0, '#7CC46E'], [1, '#3F8A45']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(60, 96, 50)}${cloud(240, 84, 40)}
    <path d="M110 140 L140 70 L150 52 L160 64 L168 58 L188 110 L210 140z" fill="url(#${id}-mtn)" stroke="#23421F" stroke-width="1.2"/><path d="M150 52 L156 86 L146 120" fill="none" stroke="#3E7A3E" stroke-width="2"/>
    <rect y="138" width="300" height="62" fill="url(#${id}-sea)"/><ellipse cx="160" cy="142" rx="70" ry="5" fill="#9BEBE2" opacity=".8"/>${sparkleSea(160)}
    ${hut(40, 148)}${hut(70, 152)}${hut(100, 150)}<path d="M36 172 H124" stroke="#7A5233" stroke-width="3"/>${palm(id, 270, 200, 90, -18)}`,
  'the Maldives': (id, hex) => `<defs>${sky(id, '#7CC8F2', '#E6F7FF')}${sea(id, '#7FE3D8', '#1E9BC0')}${lin(`${id}-trunk`, [[0, '#9A6A43'], [1, '#6E4A2E']], 1, 0)}${lin(`${id}-leaf`, [[0, '#7CC46E'], [1, '#3F8A45']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(70, 100, 46)}${cloud(230, 92, 56)}
    <rect y="128" width="300" height="72" fill="url(#${id}-sea)"/><ellipse cx="200" cy="150" rx="70" ry="14" fill="#B8F2EA"/><ellipse cx="200" cy="150" rx="52" ry="9" fill="#FFF4D8" stroke="#E8D3A8" stroke-width="1"/>
    ${palm(id, 186, 150, 54, -10)}${palm(id, 214, 152, 46, 12)}${sparkleSea(176)}
    ${hut(30, 132)}${hut(62, 136)}${hut(94, 132)}<path d="M26 156 H120 M118 156 L150 146" stroke="#7A5233" stroke-width="3"/>
    <g transform="translate(250 186)"><path d="M0 0 q8 -6 16 0 q-8 6 -16 0z M16 0 l6 -4 v8z" fill="${hex}" stroke="#23140f" stroke-width=".8"/></g>`,
  Bali: (id, hex) => `<defs>${sky(id, '#F7A774', '#FFE6C2')}${lin(`${id}-rice`, [[0, '#9ED36E'], [1, '#5A9E3E']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/><circle cx="230" cy="92" r="24" fill="#FFE08A"/>
    <path d="M40 130 L110 64 L180 130z" fill="#8E86B0" stroke="#5E5680" stroke-width="1"/><path d="M96 78 l14 -14 14 14 -6 4 -8 -4 -8 6z" fill="#FFFFFF" opacity=".7"/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M-10 ${132 + i * 15} Q${80 + i * 10} ${118 + i * 15} 160 ${130 + i * 15} T310 ${126 + i * 15} V200 H-10z" fill="url(#${id}-rice)" stroke="#3F7A2E" stroke-width="1.2" opacity="${0.75 + i * 0.05}"/>`).join('')}
    ${[[188, 1], [248, -1]].map(([x, d]) => `<path d="M${x} 150 V112 h${d * 4} v-10 h${d * 4} v-10 h${d * 4} v-10 h${d * 4} v-10 h${d * 6} V150z" fill="#8A6A55" stroke="#23140f" stroke-width="1.2"/>
      <path d="M${x + d * 2} 124 h${d * 18} M${x + d * 6} 104 h${d * 12} M${x + d * 10} 86 h${d * 8}" stroke="#5E4636" stroke-width="1.2"/>`).join('')}
    <path d="M182 150 h72" stroke="#23140f" stroke-width="1.2"/><rect x="196" y="150" width="44" height="6" fill="#B8A27E" stroke="#23140f" stroke-width="1"/>
    ${[[178, 146], [258, 146]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${hex}" stroke="#23140f" stroke-width=".8"/>`).join('')}`,
  Santorini: (id, hex) => `<defs>${sky(id, '#6FB0EA', '#E3F2FF')}${sea(id, '#2F7FC0', '#1A4F8A')}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(240, 70, 50)}
    <rect y="120" width="300" height="80" fill="url(#${id}-sea)"/>${sparkleSea(140, 6)}<path d="M200 128 l10 -14 v14z M210 128 h18 l-4 6 h-14z" fill="#FFFFFF" stroke="#23140f" stroke-width=".8"/>
    <path d="M0 200 V96 Q60 84 130 110 Q150 140 160 200z" fill="#B8876A" stroke="#23140f" stroke-width="1"/>
    ${[[8, 92, 30, 22], [40, 100, 28, 20], [70, 106, 26, 20], [16, 118, 32, 22], [50, 124, 30, 20], [84, 128, 26, 22], [28, 146, 30, 22], [64, 150, 30, 20], [98, 154, 24, 20]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF" stroke="#C9C1B8" stroke-width="1"/><rect x="${x + w / 2 - 3}" y="${y + h - 9}" width="6" height="9" fill="#3E6FB8"/>`).join('')}
    ${[[22, 92], [62, 124], [92, 128]].map(([x, y]) => `<path d="M${x - 10} ${y} a10 10 0 0 1 20 0z" fill="#2E66C8" stroke="#23140f" stroke-width="1"/><path d="M${x} ${y - 10} v-5 M${x - 3} ${y - 13} h6" stroke="#23140f" stroke-width="1"/>`).join('')}
    ${[[120, 150], [126, 158], [114, 160], [132, 168]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${hex === '#FFFFFF' ? '#E2557A' : '#E2557A'}"/>`).join('')}`,
  Mauritius: (id, hex) => `<defs>${sky(id, '#82C6F0', '#EAF7FF')}${sea(id, '#5FD6D2', '#1C80B0')}${lin(`${id}-mtn`, [[0, '#4E8F4A'], [1, '#2F6A3A']])}${lin(`${id}-trunk`, [[0, '#9A6A43'], [1, '#6E4A2E']], 1, 0)}${lin(`${id}-leaf`, [[0, '#7CC46E'], [1, '#3F8A45']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(80, 86, 48)}
    <path d="M150 140 Q190 132 206 78 Q214 64 226 70 L250 108 Q262 126 300 132 V140z" fill="url(#${id}-mtn)" stroke="#23421F" stroke-width="1.2"/>
    <rect y="138" width="300" height="62" fill="url(#${id}-sea)"/>${sparkleSea(156)}<path d="M0 176 Q80 166 160 176 T300 172 V200 H0z" fill="#FFF0CC"/>
    <g transform="translate(90 150)"><path d="M0 0 h30 l-4 8 h-22z" fill="#FFFFFF" stroke="#23140f" stroke-width="1"/><path d="M14 0 v-26 l14 22z" fill="${hex}" stroke="#23140f" stroke-width="1"/></g>${palm(id, 34, 200, 76, 14)}`,
  'the Seychelles': (id, hex) => `<defs>${sky(id, '#7CC8F2', '#EAF8FF')}${sea(id, '#6FE0D4', '#1E9BC0')}${lin(`${id}-rock`, [[0, '#D7B8A8'], [1, '#9C7E74']])}${lin(`${id}-trunk`, [[0, '#9A6A43'], [1, '#6E4A2E']], 1, 0)}${lin(`${id}-leaf`, [[0, '#7CC46E'], [1, '#3F8A45']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(200, 80, 60)}
    <rect y="124" width="300" height="76" fill="url(#${id}-sea)"/>${sparkleSea(140)}<path d="M0 168 Q100 156 200 166 T300 160 V200 H0z" fill="#FFF6E0"/>
    <ellipse cx="60" cy="150" rx="46" ry="34" fill="url(#${id}-rock)" stroke="#6E5A54" stroke-width="1.2"/><ellipse cx="104" cy="160" rx="28" ry="22" fill="url(#${id}-rock)" stroke="#6E5A54" stroke-width="1.2"/><ellipse cx="236" cy="164" rx="32" ry="18" fill="url(#${id}-rock)" stroke="#6E5A54" stroke-width="1.2"/>
    <path d="M40 136 q10 -6 20 0 M80 152 q8 -4 16 0" stroke="#FFFFFF" stroke-width="1.5" opacity=".5" fill="none"/>${palm(id, 150, 172, 92, 30)}`,
  Fiji: (id, hex) => `<defs>${sky(id, '#F48C6C', '#FFD9A0')}${sea(id, '#E89A82', '#2A6E98')}${lin(`${id}-trunk`, [[0, '#9A6A43'], [1, '#6E4A2E']], 1, 0)}${lin(`${id}-leaf`, [[0, '#4E8A45'], [1, '#2F5E33']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/><circle cx="150" cy="128" r="30" fill="#FFD36E"/>
    <rect y="128" width="300" height="72" fill="url(#${id}-sea)"/>${sparkleSea(150, 6)}<ellipse cx="200" cy="132" rx="46" ry="8" fill="#3E5A3A"/>${palm(id, 196, 132, 44, -6)}${palm(id, 212, 132, 36, 10)}
    <path d="M60 170 q30 6 60 0 l-6 6 h-48z" fill="#7A5233" stroke="#23140f" stroke-width="1"/><path d="M90 170 v-24 l16 20z" fill="#FFF4E0" stroke="#23140f" stroke-width="1"/>
    <g transform="translate(262 168)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-12" rx="9" ry="13" fill="${hex}" stroke="#23140f" stroke-width="1" transform="rotate(${a})"/>`).join('')}<circle r="5" fill="#FFD36E" stroke="#23140f" stroke-width="1"/></g>`,
  Tulum: (id, hex) => `<defs>${sky(id, '#7CC8F2', '#EAF8FF')}${sea(id, '#6FE0D4', '#1E9BC0')}${lin(`${id}-stone`, [[0, '#E2D2B4'], [1, '#B8A27E']])}${lin(`${id}-trunk`, [[0, '#9A6A43'], [1, '#6E4A2E']], 1, 0)}${lin(`${id}-leaf`, [[0, '#7CC46E'], [1, '#3F8A45']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(240, 74, 50)}
    <rect y="130" width="300" height="70" fill="url(#${id}-sea)"/>${sparkleSea(150)}
    <path d="M0 200 V122 Q60 112 150 128 L190 200z" fill="#C8B48A" stroke="#23140f" stroke-width="1"/><path d="M0 140 Q60 128 150 140" stroke="#7DBA68" stroke-width="10" fill="none"/>
    <g fill="url(#${id}-stone)" stroke="#6E5A44" stroke-width="1"><rect x="40" y="104" width="90" height="16"/><rect x="50" y="90" width="70" height="14"/><rect x="62" y="74" width="46" height="16"/><rect x="72" y="62" width="26" height="12"/></g>
    <rect x="79" y="66" width="12" height="8" fill="#5A4A3A"/><rect x="62" y="108" width="8" height="12" fill="#5A4A3A"/><rect x="100" y="108" width="8" height="12" fill="#5A4A3A"/>${palm(id, 160, 200, 86, -16)}`,
  'the Coast Road': (id, hex) => `<defs>${sky(id, '#8AC4EE', '#EAF6FF')}${sea(id, '#4E9FCF', '#2A6E98')}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(70, 90, 50)}${cloud(220, 84, 40)}
    <rect y="120" width="300" height="80" fill="url(#${id}-sea)"/>${sparkleSea(136)}
    <path d="M140 200 L170 120 Q200 100 300 104 V200z" fill="#B8A07E" stroke="#23140f" stroke-width="1"/><path d="M180 200 Q200 150 230 132 Q260 116 300 116" fill="none" stroke="#5A5A62" stroke-width="14"/><path d="M180 200 Q200 150 230 132 Q260 116 300 116" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="5 5"/>
    <path d="M300 104 Q270 96 250 106" stroke="#7DBA68" stroke-width="6" fill="none"/>${car(206, 154, 0.9, hex)}<path d="M40 112 l8 -16 l8 16z" fill="#FFFFFF" stroke="#C8324A" stroke-width="1"/><rect x="42" y="112" width="12" height="16" fill="#FFFFFF" stroke="#C8324A" stroke-width="1"/>`,
  'the Mountains': (id, hex) => `<defs>${sky(id, '#7FB2E6', '#E3EFFB')}${lin(`${id}-mtn`, [[0, '#8E9CC2'], [1, '#5E6E9A']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(240, 74, 44)}
    <path d="M0 150 L60 80 L110 130 L170 62 L240 128 L300 92 V200 H0z" fill="url(#${id}-mtn)" stroke="#3E4E7A" stroke-width="1"/><path d="M50 92 l10 -12 10 12 -6 -2 -4 4 -4 -4z M160 74 l10 -12 10 12 -5 -2 -5 4 -5 -4z M290 100 l10 -8 v10z" fill="#FFFFFF"/>
    <path d="M0 160 Q150 140 300 160 V200 H0z" fill="#7DB86E"/>${[20, 40, 250, 272, 290].map((x, i) => pine(x, 174 - (i % 2) * 6, 34)).join('')}
    <path d="M90 200 Q140 170 160 150" fill="none" stroke="#5A5A62" stroke-width="16"/><path d="M90 200 Q140 170 160 150" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="5 5"/>${car(130, 172, 0.85, hex)}`,
  'the Lakes': (id, hex) => `<defs>${sky(id, '#F6B48C', '#FFE6C8')}${lin(`${id}-lake`, [[0, '#F2C2A0'], [1, '#4E86B8']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/><circle cx="150" cy="108" r="22" fill="#FFE08A"/>
    <path d="M0 118 L50 84 L100 110 L160 80 L220 112 L300 90 V124 H0z" fill="#8E86B0"/>
    <rect y="122" width="300" height="50" fill="url(#${id}-lake)"/>${sparkleSea(134, 7)}
    ${[10, 28, 46, 252, 270, 288].map((x, i) => pine(x, 128, 34 + (i % 2) * 8, '#2F5A3A')).join('')}
    <path d="M0 170 Q150 160 300 170 V200 H0z" fill="#6FA85C"/><path d="M60 200 Q120 180 240 178" fill="none" stroke="#5A5A62" stroke-width="12"/>${car(160, 180, 0.8, hex)}`,
  'the Desert Highway': (id, hex) => `<defs>${sky(id, '#F7B26A', '#FFE4B8')}${lin(`${id}-mesa`, [[0, '#D0703E'], [1, '#A04E2C']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/><circle cx="230" cy="100" r="26" fill="#FFE08A"/>
    <path d="M20 130 V100 h60 v30z M200 130 V92 h56 v38z" fill="url(#${id}-mesa)" stroke="#6E3A22" stroke-width="1"/><path d="M0 130 H300 V200 H0z" fill="#E8B878"/>
    <path d="M140 200 L148 130 H152 L160 200z" fill="#5A5A62"/><path d="M150 132 V200" stroke="#FFE08A" stroke-width="1.2" stroke-dasharray="4 5"/>
    ${[[60, 176, 1], [250, 170, 0.8], [96, 150, 0.6]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 20 V-20 a6 6 0 0 1 12 0 V20z M0 0 h-8 v-12 a4 4 0 0 1 8 0 M12 4 h8 v-14 a4 4 0 0 0 -8 0" fill="#5E9C4A" stroke="#2F5E33" stroke-width="1"/></g>`).join('')}${car(150, 178, 0.75, hex)}`,
  'Wine Country': (id, hex) => `<defs>${sky(id, '#F4B36A', '#FFF1D6')}${lin(`${id}-hill`, [[0, '#B9C77E'], [1, '#93A85E']])}${lin(`${id}-cyp`, [[0, '#2F5A2C'], [1, '#4E7E45']], 1, 0)}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/><circle cx="70" cy="110" r="24" fill="#FFE08A"/>
    <path d="M0 130 Q80 100 160 124 T300 116 V200 H0z" fill="url(#${id}-hill)"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${-20 + i * 44} 200 Q${60 + i * 30} 150 ${120 + i * 22} 128" fill="none" stroke="#5E7D3A" stroke-width="4" stroke-dasharray="7 5"/>`).join('')}
    <path d="M208 120 l14 -10 14 10z" fill="#C8643E" stroke="#23140f" stroke-width="1"/><rect x="211" y="120" width="22" height="12" fill="#F3E2C6" stroke="#23140f" stroke-width="1"/>
    ${[[246, 132, 30], [256, 134, 22]].map(([x, y, h]) => `<path d="M${x} ${y} q-${h / 6} -${h * 0.5} 0 -${h} q${h / 6} ${h * 0.5} 0 ${h}z" fill="url(#${id}-cyp)"/>`).join('')}${car(110, 178, 0.85, hex)}`,
  // For anywhere else: a city at dusk, a tropical beach, the mountains, a cruise ship.
  city: (id, hex) => `<defs>${sky(id, '#F2A07A', '#FFE0BC')}${lin(`${id}-river`, [[0, '#F3B69A'], [1, '#4E7FB0']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/><circle cx="220" cy="118" r="22" fill="#FFE08A" opacity=".9"/>
    <g stroke="#23140f" stroke-width="1" stroke-linejoin="round">
      ${[[10, 96, 24, '#8A7AA8'], [36, 110, 20, '#9E8CB8'], [58, 84, 26, '#7E6E9E'], [88, 120, 18, '#A898C4'], [108, 70, 22, '#6E5E8E'], [132, 104, 24, '#8A7AA8'], [158, 92, 20, '#9E8CB8'], [180, 112, 26, '#7E6E9E'], [208, 100, 22, '#8A7AA8'], [232, 80, 24, '#6E5E8E'], [258, 108, 22, '#9E8CB8'], [282, 96, 20, '#7E6E9E']].map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${150 - y}" fill="${c}"/>${Array.from({ length: Math.floor((150 - y) / 12) }, (_, r) => `<rect x="${x + 4}" y="${y + 6 + r * 12}" width="${w - 8}" height="4" fill="#FFE59A" opacity="${(r + x) % 3 ? 0.85 : 0.25}" stroke="none"/>`).join('')}`).join('')}
      <path d="M116 70 l3 -22 l3 22z" fill="#6E5E8E"/></g>
    <rect y="150" width="300" height="50" fill="url(#${id}-river)"/>${sparkleSea(162, 7)}
    <path d="M0 152 Q75 128 150 152 Q225 128 300 152" fill="none" stroke="#3B3030" stroke-width="3"/>${[30, 60, 90, 120, 180, 210, 240, 270].map((x) => `<path d="M${x} ${152 - Math.sin((x % 150) / 150 * Math.PI) * 24} V152" stroke="#3B3030" stroke-width="1.2"/>`).join('')}
    ${[[40, 140], [150, 132], [250, 140]].map(([x, y]) => `<circle cx="${x}" cy="${y - 8}" r="3" fill="${hex}" stroke="#23140f" stroke-width=".6"/>`).join('')}`,
  beach: (id, hex) => POSTCARDS['the Seychelles'](id, hex),
  mountains: (id, hex) => `<defs>${sky(id, '#7FB2E6', '#E3EFFB')}${lin(`${id}-mtn`, [[0, '#8E9CC2'], [1, '#5E6E9A']])}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${cloud(240, 74, 44)}
    <path d="M0 150 L60 80 L110 130 L170 62 L240 128 L300 92 V200 H0z" fill="url(#${id}-mtn)" stroke="#3E4E7A" stroke-width="1"/><path d="M50 92 l10 -12 10 12 -6 -2 -4 4 -4 -4z M160 74 l10 -12 10 12 -5 -2 -5 4 -5 -4z M290 100 l10 -8 v10z" fill="#FFFFFF"/>
    <path d="M0 160 Q150 140 300 160 V200 H0z" fill="#7DB86E"/>${[20, 40, 250, 272, 290].map((x, i) => pine(x, 174 - (i % 2) * 6, 34)).join('')}
    <g transform="translate(140 168)"><path d="M-16 0 l16 -14 16 14z" fill="${hex}" stroke="#23140f" stroke-width="1"/><rect x="-12" y="0" width="24" height="16" fill="#C98D5B" stroke="#23140f" stroke-width="1"/><rect x="-3" y="5" width="6" height="11" fill="#5A3A22"/><rect x="5" y="3" width="5" height="5" fill="#FFE08A"/></g>`,
  cruise: (id, hex) => `<defs>${sky(id, '#F79B7A', '#FFE3B3')}${sea(id, '#4FA8D0', '#1E6E98')}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/><circle cx="70" cy="120" r="26" fill="#FFD36E"/>${cloud(230, 70, 54, '#FFE9D8', '#E8B8A8', 0.9)}
    <rect y="128" width="300" height="72" fill="url(#${id}-sea)"/>${sparkleSea(150)}
    <g transform="translate(150 140)" stroke="#23140f" stroke-width="1.2" stroke-linejoin="round">
      <path d="M-92 0 h176 l-16 26 h-150z" fill="#FFFFFF"/><path d="M-90 8 h172" stroke="${hex}" stroke-width="5"/>
      <rect x="-70" y="-16" width="136" height="16" fill="#FFFFFF"/><rect x="-50" y="-30" width="96" height="14" fill="#FFFFFF"/><rect x="-26" y="-42" width="52" height="12" fill="#FFFFFF"/>
      <rect x="8" y="-60" width="12" height="18" fill="${hex}"/><rect x="8" y="-60" width="12" height="4" fill="#23140f"/>
      ${Array.from({ length: 12 }, (_, i) => `<circle cx="${-64 + i * 11}" cy="-8" r="2" fill="#7FB5E0" stroke-width=".5"/>`).join('')}${Array.from({ length: 8 }, (_, i) => `<circle cx="${-44 + i * 12}" cy="-23" r="2" fill="#7FB5E0" stroke-width=".5"/>`).join('')}</g>
    <path d="M40 176 q30 -6 60 0 M190 182 q30 -6 60 0" stroke="#FFFFFF" stroke-width="1.5" fill="none" opacity=".7"/>`,
  'Around the World': (id, hex) => `<defs>${sky(id, '#4A6AB0', '#A9CDF0')}${rad(`${id}-globe`, [[0, '#7FC6E8'], [1, '#2E7BB8']], 0.4, 0.35, 0.7)}</defs>
    <rect width="300" height="200" fill="url(#${id}-sky)"/>${[[30, 70], [270, 66], [90, 92], [210, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#FFF"/>`).join('')}
    <circle cx="150" cy="188" r="74" fill="url(#${id}-globe)" stroke="#23140f" stroke-width="1.5"/><path d="M104 150 q16 -10 26 4 q6 12 -6 20 q-14 4 -18 -8z M166 140 q18 2 24 16 q2 14 -12 20 q-12 -2 -10 -16z" fill="#7DBA68" stroke="#3F7A3A" stroke-width="1"/>
    <path d="M40 200 V150 M34 160 h12 M36 175 h8 M40 150 l-4 -20 h8z" stroke="#5A4A3A" stroke-width="2" fill="none"/><path d="M28 200 L40 130 L52 200z" fill="none" stroke="#5A4A3A" stroke-width="2"/>
    <path d="M240 200 L262 160 L284 200z" fill="#E2C27A" stroke="#8A6A3A" stroke-width="1"/>
    <g transform="translate(76 140)"><path d="M-12 0 h24 l-4 -6 h-16z M-9 -6 h18 l-3 -6 h-12z M-6 -12 h12 l-6 -8z" fill="#C8324A" stroke="#23140f" stroke-width=".8"/><rect x="-3" y="0" width="6" height="12" fill="#C8324A"/></g>
    <g transform="translate(220 150)"><rect x="-6" y="-26" width="12" height="40" fill="#E9D9B8" stroke="#8A6A3A" stroke-width="1"/><circle cx="0" cy="-16" r="4" fill="#FFF" stroke="#8A6A3A" stroke-width="1"/><path d="M-7 -26 l7 -10 7 10z" fill="#5E7D8A"/></g>
    <path d="M30 120 Q150 60 270 110" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="5 6"/><g transform="translate(256 104) rotate(24)"><path d="M-14 0 h26 l6 -3 v6 l-6 -3z M-2 0 l-8 -12 h5 l10 12z M-2 0 l-8 12 h5 l10 -12z" fill="#FFFFFF" stroke="#23140f" stroke-width="1"/></g>`,
};

/** The countries with a card of their own: their best-known coast or island. */
const COUNTRY_CARDS = { gr: 'Santorini', id: 'Bali', mx: 'Tulum', pf: 'Bora Bora', mv: 'the Maldives', fj: 'Fiji', mu: 'Mauritius', sc: 'the Seychelles' };

/**
 * Which picture a postcard from a place shows: the country's own, or by what kind of place it is (a cruise, a warm
 * coast, the mountains, a city). `lat` is the place's latitude, `coastal` whether it is on the sea.
 */
export function postcardArt({ countryId, cruise = false, lat = 40, coastal = true, alpine = false }) {
  if (cruise) return 'cruise';
  if (COUNTRY_CARDS[countryId]) return COUNTRY_CARDS[countryId];
  if (alpine) return 'mountains';
  if (coastal && Math.abs(lat) < 27) return 'beach';
  return 'city';
}

/**
 * The postcard (300 x 200): a cartoon of the place (`art`, a key of POSTCARDS), "Greetings from" and its name
 * (`title`) across the sky, a stamp in the couple's color.
 */
/**
 * The postcards painted for the game (assets/postcards/<code>.webp, from the prompts in assets/CHATGPT_POSTCARD_PROMPT.md):
 * a country's code, or a general card (city, beach, mountains, cruise). Listed here as each arrives; any other place
 * keeps its drawn card.
 */
export const POSTCARD_PHOTOS = new Set(['us', 'ca']);

export function postcardFront(art, title, hex, countryId = null) {
  const id = 'pc';
  const photo = [countryId, { 'the Seychelles': 'beach', 'the Maldives': 'beach' }[art] ?? art].find((k) => k && POSTCARD_PHOTOS.has(k));
  const draw = photo ? () => `<image href="./assets/postcards/${photo}.webp" width="300" height="200" preserveAspectRatio="xMidYMid slice"/>` : POSTCARDS[art] ?? POSTCARDS.city;
  const name = String(title).replace(/^the /, 'The ');
  const big = name.length > 14 ? 24 : 32;
  return `<svg viewBox="0 0 300 200" aria-hidden="true">${draw(id, hex)}
    <text x="20" y="34" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#FFFFFF" stroke="#23140f" stroke-width="3" paint-order="stroke">Greetings from</text>
    <text x="18" y="${34 + big}" font-family="Georgia, serif" font-weight="700" font-size="${big}" fill="${hex}" stroke="#23140f" stroke-width="4" paint-order="stroke" letter-spacing=".5">${name.replace(/&/g, '&amp;')}</text>
    <g transform="translate(256 10) rotate(6)"><rect width="34" height="40" fill="${hex}" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="3 2"/><rect width="34" height="40" fill="none" stroke="#23140f" stroke-width="1"/><path d="M17 27 c-9 -6 -10 -12 -6 -15 c3 -2 6 0 6 3 c0 -3 3 -5 6 -3 c4 3 3 9 -6 15z" fill="#FFFFFF"/></g>
    <g fill="none" stroke="#23140f" stroke-width="1" opacity=".35"><circle cx="246" cy="44" r="14"/><path d="M228 50 q8 -4 16 0 t16 0 t16 0 M228 56 q8 -4 16 0 t16 0 t16 0"/></g></svg>`;
}
