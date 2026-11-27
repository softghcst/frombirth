// The globe the game draws: the world's land (Natural Earth, js/data/worldLand.js) on a sphere, turned to face any
// place, lit from the upper left, in a night sky. Used where a life begins (js/ui/birthGlobe.js) and on a journey
// (js/ui/journey.js).
export const RAD = Math.PI / 180;

/**
 * Whether this device draws flag emoji as flags. Windows shows two letters instead ("HK"), so there the card leaves
 * the flag out. Checked once, by drawing a flag and looking for color.
 */
let FLAGS = null;
export function flagsShown() {
  if (FLAGS != null) return FLAGS;
  try {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.textBaseline = 'top'; x.font = '20px sans-serif'; x.fillText('\u{1F1EF}\u{1F1F5}', 0, 0); // the flag of Japan: red on white
    const d = x.getImageData(0, 0, 24, 24).data;
    let colored = false;
    for (let i = 0; i < d.length && !colored; i += 4) if (d[i + 3] > 0 && Math.abs(d[i] - d[i + 1]) > 60) colored = true;
    FLAGS = colored;
  } catch { FLAGS = true; }
  return FLAGS;
}
let RINGS = null;

/** The land outlines as rings of unit vectors on the sphere (from js/data/worldLand.js, x = lon + 180, y = 90 - lat). */
export async function rings() {
  if (RINGS) return RINGS;
  const { LAND_PATH } = await import('../data/worldLand.js');
  RINGS = LAND_PATH.split('M').filter(Boolean).map((part) => {
    const n = part.replace(/Z/g, '').trim().split(/[\s,]+/).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      const lon = (n[i] - 180) * RAD; const lat = (90 - n[i + 1]) * RAD;
      pts.push([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]);
    }
    return pts;
  }).filter((r) => r.length > 2);
  return RINGS;
}

/**
 * Draws the globe turned so that (lon0, lat0) faces the viewer, radius r, centerd at (cx, cy). Points on the far side
 * are pushed to the rim, which is enough to keep coastlines whole as they turn away.
 */
export function drawGlobe(ctx, land, { cx, cy, r, lon0, lat0 }) {
  const sl = Math.sin(lon0 * RAD); const cl = Math.cos(lon0 * RAD);
  const sp = Math.sin(lat0 * RAD); const cp = Math.cos(lat0 * RAD);
  // The atmosphere, then the sea, shaded from the light.
  const glow = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.18);
  glow.addColorStop(0, 'rgba(140, 200, 255, .55)'); glow.addColorStop(1, 'rgba(140, 200, 255, 0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2); ctx.fill();
  const sea = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  sea.addColorStop(0, '#6FC3F0'); sea.addColorStop(0.65, '#2F7FC4'); sea.addColorStop(1, '#174E8C');
  ctx.fillStyle = sea; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#9AD17F'; ctx.strokeStyle = '#4E8A45'; ctx.lineWidth = Math.max(0.6, r / 260); ctx.lineJoin = 'round';
  // Turn the globe: first about the pole by the longitude, then tip it by the latitude. [depth, right, up]: depth > 0
  // faces the viewer.
  const turn = ([x0, y0, z0]) => {
    const x1 = x0 * cl + y0 * sl; const y1 = -x0 * sl + y0 * cl;
    return [x1 * cp + z0 * sp, y1, -x1 * sp + z0 * cp];
  };
  const at = (p) => [cx + p[1] * r, cy - p[2] * r];
  // Where a coastline crosses the edge of the visible half: on the rim, between a point in front and one behind.
  const rim = (a, b) => { const t = a[0] / (a[0] - b[0]); const y = a[1] + (b[1] - a[1]) * t; const z = a[2] + (b[2] - a[2]) * t; const m = Math.hypot(y, z) || 1; return [0, y / m, z / m]; };
  const angle = (h) => Math.atan2(-h[2], h[1]);
  for (const ring of land) {
    const pts = ring.map(turn);
    const n = pts.length;
    const start = pts.findIndex((q) => q[0] >= 0);
    if (start < 0) continue; // wholly on the far side
    // Each landmass is cut where it goes over the rim: the land (fill) follows the rim round to where the coast comes
    // back (the shorter way), and the coast (stroke) is drawn only where it can be seen.
    const fill = new Path2D(); const coast = new Path2D();
    let [sx, sy] = at(pts[start]);
    fill.moveTo(sx, sy); coast.moveTo(sx, sy);
    let out = null;
    for (let k = 1; k <= n; k++) {
      const prev = pts[(start + k - 1) % n]; const q = pts[(start + k) % n];
      if (prev[0] >= 0 && q[0] >= 0) { [sx, sy] = at(q); fill.lineTo(sx, sy); coast.lineTo(sx, sy); }
      else if (prev[0] >= 0) { const h = rim(prev, q); [sx, sy] = at(h); fill.lineTo(sx, sy); coast.lineTo(sx, sy); out = angle(h); }
      else if (q[0] >= 0) {
        const h = rim(q, prev); const back = angle(h);
        let d = back - out; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        fill.arc(cx, cy, r, out, back, d < 0);
        [sx, sy] = at(h); coast.moveTo(sx, sy);
        const [qx, qy] = at(q); fill.lineTo(qx, qy); coast.lineTo(qx, qy);
      }
    }
    fill.closePath();
    ctx.fill(fill); ctx.stroke(coast);
  }
  // Light from the upper left; night falls off to the lower right.
  const shade = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.2, cx, cy, r * 1.05);
  shade.addColorStop(0, 'rgba(255, 255, 255, .18)'); shade.addColorStop(0.6, 'rgba(0, 0, 0, 0)'); shade.addColorStop(1, 'rgba(5, 15, 40, .45)');
  ctx.fillStyle = shade; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** A night sky of fixed stars, drawn once. */
export function stars(ctx, w, h) {
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < Math.round((w * h) / 2600); i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + rand() * 0.6})`;
    ctx.beginPath(); ctx.arc(rand() * w, rand() * h, rand() * 1.3 + 0.2, 0, Math.PI * 2); ctx.fill();
  }
}


/** A place on the sphere as a unit vector. */
export const vec = (lat, lon) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
/** A unit vector as { lat, lon } in degrees. */
export const latLon = ([x, y, z]) => ({ lat: Math.asin(Math.max(-1, Math.min(1, z))) / RAD, lon: Math.atan2(y, x) / RAD });
/** The angle between two places, in radians. */
export const between = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
/** The point a fraction t of the way along the great circle from a to b. */
export function slerp(a, b, t) {
  const w = between(a, b);
  if (w < 1e-6) return a;
  const s = Math.sin(w); const ka = Math.sin((1 - t) * w) / s; const kb = Math.sin(t * w) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}
/** Where a place is on screen, with the globe turned to (lon0, lat0), radius r, centered at (cx, cy); front > 0 is on the near side. */
export function project(v, { cx, cy, r, lon0, lat0 }) {
  const sl = Math.sin(lon0 * RAD); const cl = Math.cos(lon0 * RAD);
  const sp = Math.sin(lat0 * RAD); const cp = Math.cos(lat0 * RAD);
  const x1 = v[0] * cl + v[1] * sl; const y1 = -v[0] * sl + v[1] * cl;
  return { x: cx + y1 * r, y: cy - (-x1 * sp + v[2] * cp) * r, front: x1 * cp + v[2] * sp };
}
