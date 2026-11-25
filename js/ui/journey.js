// The journey, between "Go" and getting there: a map of the world, home and the destination pinned, and the plane (or
// the ship, the train, the car) following its route between them, by way of any stops. Shown when a trip begins
// (js/ui/globalLife.js) and on the way to a honeymoon. A tap skips it; with reduced motion it is shown still, briefly.
import { coords, parsePlace, placeName } from '../engine/geo.js';
import { store } from '../state.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const n1 = (x) => Math.round(x * 10) / 10;

/** What is moving, by how it travels: its picture (drawn about the origin, facing right), and a word for it. */
const VEHICLES = {
  air: { verb: 'Flying', icon: '<path d="M-9 0 L6 -1.2 L9 0 L6 1.2z" fill="#FFFFFF" stroke="#23140f" stroke-width=".6"/><path d="M-1 0 L-5 -6 L-2.6 -6 L3 0 L-2.6 6 L-5 6z" fill="#FFFFFF" stroke="#23140f" stroke-width=".6"/><path d="M-8.5 0 L-10.5 -3 L-9 -3 L-6.5 0 L-9 3 L-10.5 3z" fill="#FFFFFF" stroke="#23140f" stroke-width=".5"/>' },
  sea: { verb: 'Sailing', icon: '<path d="M-8 1 h16 l-3 4 h-10z" fill="#FFFFFF" stroke="#23140f" stroke-width=".6"/><rect x="-5" y="-2.5" width="9" height="3.5" rx=".6" fill="#FFFFFF" stroke="#23140f" stroke-width=".5"/><rect x="-2" y="-5.5" width="3" height="3" fill="#E2557A" stroke="#23140f" stroke-width=".4"/><path d="M-7 1.6 h14" stroke="#3E6FB8" stroke-width=".6"/>' },
  land: { verb: 'Driving', icon: '<path d="M-7 1 q0 -3 2.5 -3.4 l2 -2.6 h5 l2 2.6 q2.5 .4 2.5 3.4 v1.5 h-14z" fill="#E2557A" stroke="#23140f" stroke-width=".6"/><circle cx="-4" cy="2.6" r="1.6" fill="#2A2A30"/><circle cx="4" cy="2.6" r="1.6" fill="#2A2A30"/>' },
  rail: { verb: 'By train', icon: '<rect x="-8" y="-3" width="16" height="6" rx="2" fill="#3E6FB8" stroke="#23140f" stroke-width=".6"/><rect x="-6" y="-1.6" width="3" height="2" fill="#CFE6F7"/><rect x="-1.5" y="-1.6" width="3" height="2" fill="#CFE6F7"/><rect x="3" y="-1.6" width="3" height="2" fill="#CFE6F7"/>' },
};

/** Where a place sits on the 360 x 180 grid of the land map (x from the date line, y from the north pole). */
const at = (place) => { const c = coords(place.countryId, place.city); return c ? { x: c.lon + 180, y: 90 - c.lat } : null; };

/**
 * The journey, as a scene. Resolves once it has been seen (or skipped).
 * @param {{stops:{countryId:string, city?:string}[], over?:'air'|'sea'|'land'|'rail', title?:string}} o
 *   stops: home first, the destination last, with any changes of plane or ports of call between.
 */
export async function openJourney(o) {
  const stops = (o.stops ?? []).filter(Boolean).map((s) => (typeof s === 'string' ? parsePlace(s) : s));
  const pts = stops.map(at);
  if (pts.length < 2 || pts.some((x) => !x)) return; // nowhere to draw it: on with the trip
  const { LAND_PATH } = await import('../data/worldLand.js');
  // Unwrap across the date line, so a flight over the Pacific goes the short way.
  for (let i = 1; i < pts.length; i++) { while (pts[i].x - pts[i - 1].x > 180) pts[i].x -= 360; while (pts[i - 1].x - pts[i].x > 180) pts[i].x += 360; }
  const over = o.over ?? 'air';
  const lift = over === 'air' ? 0.22 : over === 'sea' ? 0.12 : 0.06;
  // Each leg an arc, bowed toward the nearer pole as a long flight is.
  let d = `M${n1(pts[0].x)} ${n1(pts[0].y)}`;
  const ctrl = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i];
    const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len; let ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; } // bow upward on the map (northward)
    const c = { x: (a.x + b.x) / 2 + nx * len * lift, y: (a.y + b.y) / 2 + ny * len * lift };
    ctrl.push(c);
    d += ` Q${n1(c.x)} ${n1(c.y)} ${n1(b.x)} ${n1(b.y)}`;
  }
  // Frame the route, with room around it, at the screen's shape.
  const all = [...pts, ...ctrl];
  let x0 = Math.min(...all.map((p) => p.x)); let x1 = Math.max(...all.map((p) => p.x));
  let y0 = Math.min(...all.map((p) => p.y)); let y1 = Math.max(...all.map((p) => p.y));
  // The screen's own shape (tall on a phone), so nothing is cropped away.
  const aspect = typeof innerWidth === 'number' && innerWidth > 0 ? Math.min(2.2, Math.max(0.5, innerHeight / innerWidth)) : 0.75;
  // Wide enough for the whole route, even if that shows sea above and below the world.
  const w = Math.max(70, (x1 - x0) * 1.55, ((y1 - y0) * 1.5 + 30) / aspect); const h = w * aspect;
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  x0 = cx - w / 2;
  y0 = h >= 190 ? 90 - h / 2 : Math.min(Math.max(cy - h / 2 - h * 0.04, -5), 185 - h);
  const k = w / 140; // the size of things on the map, in map units
  const veh = VEHICLES[over] ?? VEHICLES.air;
  const from = stops[0]; const to = stops[stops.length - 1];
  const yr = store.state?.year;
  const fromName = placeName(from.countryId, from.city, yr); const toName = placeName(to.countryId, to.city, yr);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const secs = reduced ? 0.01 : Math.min(4.2, 2.4 + pts.length * 0.4);
  const pin = (p, label, home) => `<g transform="translate(${n1(p.x)} ${n1(p.y)}) scale(${n1(k * 100) / 100})">
      <circle r="5" fill="${home ? '#FFFFFF' : '#E2557A'}" stroke="#23140f" stroke-width="1.2"/><circle r="2" fill="${home ? '#3E6FB8' : '#FFFFFF'}"/>
      <text y="${home ? 14 : -9}" text-anchor="middle" font-size="7" font-weight="700" font-family="system-ui, sans-serif" fill="#23140f" stroke="#FFFFFF" stroke-width="2.4" paint-order="stroke">${esc(label)}</text></g>`;
  const mid = pts.slice(1, -1).map((p) => `<circle cx="${n1(p.x)}" cy="${n1(p.y)}" r="${n1(k * 2.4)}" fill="#FFFFFF" stroke="#23140f" stroke-width="${n1(k * 0.8)}"/>`).join('');
  const root = document.createElement('div');
  root.className = `journey-screen${reduced ? ' sv-still' : ''}`;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `${veh.verb} from ${fromName} to ${toName}`);
  root.innerHTML = `
    <div class="journey-head"><strong>${esc(o.title ?? `${veh.verb} to ${toName}`)}</strong><span>${esc(fromName)} → ${esc(toName)}</span></div>
    <svg class="journey-map" viewBox="${n1(x0)} ${n1(y0)} ${n1(w)} ${n1(w * aspect)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="jr-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FCBEA"/><stop offset="1" stop-color="#5FA9D6"/></linearGradient>
        <path id="jr-land" d="${LAND_PATH}"/></defs>
      <rect x="${n1(x0 - 10)}" y="${n1(Math.min(-20, y0 - 10))}" width="${n1(w + 20)}" height="${n1(Math.max(220, h + 40))}" fill="url(#jr-sea)"/>
      ${[-360, 0, 360].map((dx) => `<use href="#jr-land" x="${dx}" fill="#CFE3B0" stroke="#7FA36A" stroke-width="${n1(k * 0.35)}" stroke-linejoin="round"/>`).join('')}
      <path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${n1(k * 1.4)}" stroke-dasharray="${n1(k * 2.5)} ${n1(k * 2)}" stroke-linecap="round" opacity=".9" class="journey-trail" pathLength="100"/>
      ${mid}${pin(pts[0], fromName.split(',')[0], true)}${pin(pts[pts.length - 1], toName.split(',')[0], false)}
      <g class="journey-vehicle"><g transform="scale(${n1(k * 1.3 * 100) / 100})">${veh.icon}</g>
        <animateMotion dur="${secs}s" fill="freeze" rotate="${over === 'air' ? 'auto' : '0'}" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .35 1" path="${d}"/></g>
    </svg>
    <p class="journey-skip">${reduced ? '' : 'Tap to skip'}</p>`;
  document.body.appendChild(root);
  root.style.setProperty('--journey-secs', `${secs}s`);
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; root.classList.add('journey-out'); setTimeout(() => { root.remove(); resolve(); }, reduced ? 0 : 350); };
    root.addEventListener('click', finish);
    root.addEventListener('keydown', (e) => { if (['Enter', ' ', 'Escape'].includes(e.key)) finish(); });
    root.tabIndex = -1; root.focus?.({ preventScroll: true });
    setTimeout(finish, reduced ? 1200 : secs * 1000 + 900);
  });
}

/** How a trip travels, for the scene: by air, by sea, by rail or by road. */
export function overOf(mode) {
  if (!mode) return 'air';
  if (/air|jet/.test(mode)) return 'air';
  if (/ship|sail|ferry|cruise|steam/.test(mode)) return 'sea';
  if (/rail/.test(mode)) return 'rail';
  return 'land';
}
