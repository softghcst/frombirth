// The journey, between "Go" and getting there, on the same globe a life begins on (js/ui/globe.js): home and the
// destination pinned, the route drawn round the curve of the Earth by way of any stops, and the plane (or the ship,
// the train, the car) flying it while the globe turns to follow. A flight starts with its boarding pass, and a seat by
// the window or on the aisle in economy and business; halfway there it may have a moment, by cabin and seat
// (engine/flight.js). Shown when a trip begins (js/ui/globalLife.js) and on the way to a honeymoon; turned off in
// Settings ("Journey scenes"). A tap skips ahead (but a moment waits for its answer); with reduced motion it is still.
import { esc } from '../util.js';
import { coords, parsePlace, placeName } from '../engine/geo.js';
import { store } from '../state.js';
import { rings, drawGlobe, stars, project, vec, slerp, between, latLon, RAD } from './globe.js';

export const JOURNEY_KEY = 'frombirth.journeyScenes';
/** Whether a trip begins with its journey scene. On by default; kept in this browser for every life. */
export function journeyScenesOn() {
  try { return localStorage.getItem(JOURNEY_KEY) !== 'off'; } catch { return true; }
}
export function setJourneyScenes(on) {
  try { if (on) localStorage.removeItem(JOURNEY_KEY); else localStorage.setItem(JOURNEY_KEY, 'off'); } catch { /* storage unavailable */ }
}

const VERB = { air: 'Flying', sea: 'Sailing', land: 'Driving', rail: 'By train' };
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** The craft, drawn about the origin facing +x, about two units long. */
function drawCraft(ctx, over, livery, shadow = false) {
  ctx.lineJoin = 'round';
  // As a shadow: the same shape, flat and dark, without outlines.
  const ink = (color) => (shadow ? 'rgba(0, 0, 0, .26)' : color);
  const fills = new Proxy(ctx, { set(t, k, v) { t[k] = k === 'fillStyle' ? ink(v) : k === 'strokeStyle' ? (shadow ? 'rgba(0, 0, 0, 0)' : v) : v; return true; }, get(t, k) { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
  ctx = fills;
  if (over === 'air') {
    ctx.fillStyle = '#F7F9FC'; ctx.strokeStyle = '#1E2A44'; ctx.lineWidth = 0.05;
    // Wings and tailplane, swept back.
    for (const s of [1, -1]) {
      ctx.beginPath(); ctx.moveTo(0.22, 0.06 * s); ctx.lineTo(-0.28, 0.95 * s); ctx.lineTo(-0.46, 0.95 * s); ctx.lineTo(-0.24, 0.06 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.72, 0.04 * s); ctx.lineTo(-0.98, 0.36 * s); ctx.lineTo(-1.08, 0.36 * s); ctx.lineTo(-0.94, 0.04 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Engines under the wings.
      ctx.fillStyle = '#C9D2E0'; ctx.beginPath(); ctx.ellipse(-0.08, 0.4 * s, 0.17, 0.065, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#F7F9FC';
    }
    // The fuselage, nose to tail, with a stripe in the livery and a line of windows.
    ctx.beginPath(); ctx.moveTo(1.02, 0); ctx.quadraticCurveTo(0.95, 0.12, 0.7, 0.12); ctx.lineTo(-0.92, 0.09); ctx.quadraticCurveTo(-1.12, 0, -0.92, -0.09); ctx.lineTo(0.7, -0.12); ctx.quadraticCurveTo(0.95, -0.12, 1.02, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = livery; ctx.fillRect(-0.9, -0.025, 1.6, 0.05);
    ctx.fillStyle = '#2B3A5C'; ctx.beginPath(); ctx.ellipse(0.86, 0, 0.07, 0.06, 0, 0, Math.PI * 2); ctx.fill(); // the cockpit
    ctx.fillStyle = livery; ctx.beginPath(); ctx.moveTo(-0.78, 0); ctx.lineTo(-1.06, 0.05); ctx.lineTo(-1.06, -0.05); ctx.closePath(); ctx.fill(); // the tail fin, edge on
  } else if (over === 'sea') {
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#1E2A44'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(1, 0); ctx.quadraticCurveTo(0.6, 0.32, -0.9, 0.3); ctx.lineTo(-0.95, -0.3); ctx.quadraticCurveTo(0.6, -0.32, 1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#D7E4F2'; ctx.fillRect(-0.6, -0.18, 1.1, 0.36);
    ctx.fillStyle = livery; ctx.beginPath(); ctx.ellipse(-0.2, 0, 0.14, 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (over === 'rail') {
    ctx.strokeStyle = '#1E2A44'; ctx.lineWidth = 0.05;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 0 ? livery : '#3E6FB8'; ctx.beginPath(); ctx.roundRect(0.35 - i * 0.62, -0.16, 0.56, 0.32, 0.08); ctx.fill(); ctx.stroke(); }
  } else {
    ctx.fillStyle = livery; ctx.strokeStyle = '#1E2A44'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.roundRect(-0.7, -0.32, 1.4, 0.64, 0.22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#CFE6F7'; ctx.fillRect(0.1, -0.24, 0.28, 0.48);
  }
}

/** A map pin, its point on (x, y). */
function drawPin(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0, 0, 0, .25)'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.strokeStyle = '#3A1018'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-3, -11, -12, -15, -12, -25); ctx.arc(0, -25, 12, Math.PI, 0); ctx.bezierCurveTo(12, -15, 3, -11, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFF4E8'; ctx.beginPath(); ctx.arc(0, -25, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * The journey, as a scene. Resolves once it has been seen (or skipped), after any moment in the air is answered.
 * @param {{stops:{countryId:string, city?:string}[], over?:'air'|'sea'|'land'|'rail', title?:string, tripId?:string, onChange?:Function}} o
 *   stops: home first, the destination last, with any changes of plane or ports of call between. tripId: a booked
 *   trip, for its boarding pass and its moment in the air.
 */
export async function openJourney(o) {
  const stops = (o.stops ?? []).filter(Boolean).map((s) => (typeof s === 'string' ? parsePlace(s) : s));
  const at = stops.map((s) => coords(s.countryId, s.city));
  if (at.length < 2 || at.some((x) => !x)) return; // nowhere to draw it: on with the trip
  const land = await rings();
  const flight = o.tripId && (o.over ?? 'air') === 'air' ? await import('../engine/flight.js') : null;
  const pass = flight?.boardingPass(o.tripId) ?? null;
  const over = o.over ?? 'air';
  const pts = at.map((c) => vec(c.lat, c.lon));
  const legs = pts.slice(1).map((b, i) => between(pts[i], b));
  const total = legs.reduce((s, x) => s + x, 0) || 1e-6;
  /** The point a fraction t of the way along the whole route. */
  const along = (t) => {
    let d = clamp01(t) * total;
    for (let i = 0; i < legs.length; i++) { if (d <= legs[i] || i === legs.length - 1) return slerp(pts[i], pts[i + 1], legs[i] ? Math.min(1, d / legs[i]) : 1); d -= legs[i]; }
    return pts.at(-1);
  };
  const yr = store.state?.year;
  const from = stops[0]; const to = stops.at(-1);
  const fromName = placeName(from.countryId, from.city, yr); const toName = placeName(to.countryId, to.city, yr);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const livery = ['#E2557A', '#3E6FB8', '#2E9E6B', '#E39B2D', '#7956A0'][(from.countryId.charCodeAt(0) + from.countryId.charCodeAt(1)) % 5];
  const verb = VERB[over] ?? VERB.air;
  const root = document.createElement('div');
  root.className = 'journey-screen jg';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `${verb} from ${fromName} to ${toName}`);
  const code = (s) => esc(s.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase());
  root.innerHTML = `<canvas class="jg-canvas" aria-hidden="true"></canvas>
    <div class="journey-head"><strong>${esc(o.title ?? `${verb} to ${toName}`)}</strong><span>${esc(fromName)} → ${esc(toName)}</span></div>
    ${pass ? `<section class="jg-card jg-pass" data-pass>
      <p class="jg-eyebrow">Boarding pass · ${esc(pass.number)}</p>
      <div class="jg-route"><div><b>${code(pass.from)}</b><small>${esc(pass.from)}</small></div><span aria-hidden="true">✈</span><div><b>${code(pass.to)}</b><small>${esc(pass.to)}</small></div></div>
      <div class="jg-meta"><span>${esc(pass.cabinName)}</span><span data-seat>${pass.seat ? `Seat ${esc(pass.seat)}` : 'Seat: choose'}</span>${pass.hours ? `<span>${pass.hours} h</span>` : ''}</div>
      ${pass.chooseSeat ? `<p class="jg-ask">Where would you like to sit?</p><div class="jg-seats"><button type="button" class="btn" data-side="window">Window</button><button type="button" class="btn" data-side="aisle">Aisle</button></div>`
        : '<button type="button" class="btn primary jg-board" data-board>Board</button>'}
    </section>` : ''}
    <section class="jg-card jg-moment" data-moment hidden></section>
    <p class="journey-skip">${reduced ? '' : 'Tap to skip'}</p>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const sky = document.createElement('canvas');
  let w = 0; let h = 0; let dpr = 1;
  const size = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = root.clientWidth; h = root.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    sky.width = canvas.width; sky.height = canvas.height;
    const s = sky.getContext('2d'); s.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = s.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#070B1F'); bg.addColorStop(1, '#1A1440');
    s.fillStyle = bg; s.fillRect(0, 0, w, h); stars(s, w, h);
  };
  size();
  // How close the globe comes: a long flight shows half the world, a short hop the region.
  const zoom = Math.max(1, Math.min(2.6, 1 + 1.8 * (1 - Math.min(1, total / 2.2))));
  const fly = reduced ? 0 : Math.min(7200, 4200 + total * 900);
  const route = Array.from({ length: 160 }, (_, i) => along(i / 159));

  // ---------- The frame ----------
  let progress = 0; // along the route, 0 to 1
  let landedAt = null;
  function frame(now) {
    const p = smooth(progress);
    const here = along(p);
    const ll = latLon(here);
    const view = { cx: w * 0.5, cy: h * (w > 760 ? 0.52 : 0.46), r: Math.min(w, h) * 0.36 * zoom, lon0: ll.lon, lat0: ll.lat * 0.92 };
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(sky, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGlobe(ctx, land, view);
    // The route: ahead, a faint dashed line; behind, the contrail.
    const proj = route.map((v) => project(v, view));
    const cut = Math.round(p * (route.length - 1));
    const line = (a, b, style, width, dash) => {
      ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.setLineDash(dash);
      ctx.beginPath(); let on = false;
      for (let i = a; i <= b; i++) { const q = proj[i]; if (q.front > 0.02) { if (on) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); on = true; } else on = false; }
      ctx.stroke(); ctx.restore();
    };
    line(cut, route.length - 1, 'rgba(255, 255, 255, .55)', 2, [6, 7]);
    line(0, cut, 'rgba(255, 255, 255, .35)', 7, []);
    line(0, cut, '#FFFFFF', 2.4, []);
    // The stops on the way, home, and (once there) the destination.
    for (const [i, v] of pts.entries()) {
      const q = project(v, view);
      if (q.front <= 0) continue;
      if (i === 0) { ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#23140f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3E6FB8'; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      else if (i < pts.length - 1) { ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#23140f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    const dest = project(pts.at(-1), view);
    if (landedAt != null && dest.front > 0) {
      const k = Math.min(1, (now - landedAt) / 450);
      const drop = (1 - (1 - k) ** 3) * 1;
      drawPin(ctx, dest.x, dest.y - (1 - drop) * 60, 1.1, '#E8434F');
      const ring = ((now - landedAt) % 1600) / 1600;
      ctx.strokeStyle = `rgba(255, 226, 122, ${0.9 * (1 - ring)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dest.x, dest.y, 6 + ring * 30, 0, Math.PI * 2); ctx.stroke();
    } else if (dest.front > 0) {
      ctx.fillStyle = '#E8434F'; ctx.strokeStyle = '#3A1018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dest.x, dest.y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // The craft, turned along its way, with its shadow on the world below.
    if (landedAt == null || now - landedAt < 300) {
      const me = project(here, view);
      const ahead = project(along(Math.min(1, p + 0.01)), view);
      const behind = project(along(Math.max(0, p - 0.01)), view);
      const heading = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) || 0;
      const s = Math.max(16, Math.min(30, Math.min(w, h) / 26)) * (over === 'air' ? 1 : 0.8);
      const lift = over === 'air' ? Math.sin(Math.PI * clamp01(p)) * 10 + 4 : 2;
      const fade = landedAt != null ? 1 - (now - landedAt) / 300 : 1;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(me.x + lift, me.y + lift * 1.2); ctx.rotate(heading); ctx.scale(s, s);
      drawCraft(ctx, over, livery, true); ctx.restore();
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(me.x, me.y); ctx.rotate(heading); ctx.scale(s, s);
      if (over === 'sea') { ctx.strokeStyle = 'rgba(255, 255, 255, .75)'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(-0.9, 0.25); ctx.lineTo(-2.2, 0.75); ctx.moveTo(-0.9, -0.25); ctx.lineTo(-2.2, -0.75); ctx.stroke(); }
      drawCraft(ctx, over, livery); ctx.restore();
    }
  }

  // ---------- The phases: boarding, flying, the moment, landed ----------
  let phase = pass ? 'pass' : 'fly';
  let raf = 0; let t0 = 0; let base = 0; let finish;
  const momentAt = 0.5;
  let moment = null;
  const card = (sel) => root.querySelector(sel);
  function run(now) {
    if (phase === 'fly') {
      progress = clamp01(base + (fly ? (now - t0) / fly : 1));
      if (moment && progress >= momentAt) { progress = momentAt; showMoment(); }
      else if (progress >= 1) { phase = 'landed'; landedAt = now; card('.journey-skip').textContent = ''; setTimeout(() => finish?.(), reduced ? 900 : 1700); }
    }
    frame(now);
    raf = requestAnimationFrame(run);
  }
  function takeOff() {
    card('[data-pass]')?.classList.add('jg-gone');
    if (flight && o.tripId) { const m = flight.flightMoment(o.tripId); if (m) moment = m; }
    phase = 'fly'; base = progress; t0 = performance.now();
  }
  function showMoment() {
    phase = 'moment';
    const m = moment; moment = null;
    const box = card('[data-moment]');
    box.hidden = false;
    box.innerHTML = `<p class="jg-eyebrow">Halfway to ${esc(toName.split(',')[0])}</p><p class="jg-text">${esc(m.text)}</p>
      <div class="jg-choices">${m.choices.map((c, i) => `<button type="button" class="btn" data-choice="${i}">${esc(c)}</button>`).join('')}</div>`;
  }
  function answered(r) {
    const box = card('[data-moment]');
    const changes = (r.changes ?? []).map((c) => `<span class="${c.delta > 0 ? 'up' : 'down'}">${esc(c.label)} ${c.delta > 0 ? '+' : '−'}${c.money ? '' : ''}${Math.abs(Math.round(c.delta)).toLocaleString('en-US')}</span>`).join('');
    box.innerHTML = `<p class="jg-text">${esc(r.text)}</p>${changes ? `<div class="jg-changes">${changes}</div>` : ''}<button type="button" class="btn primary" data-onward>Fly on</button>`;
    o.onChange?.();
  }
  if (reduced) { progress = 0; }
  if (phase === 'fly') takeOff();
  raf = requestAnimationFrame(run);
  const onResize = () => size();
  window.addEventListener('resize', onResize);
  await new Promise((resolve) => {
    finish = () => { if (phase === 'done') return; phase = 'done'; resolve(); };
    root.addEventListener('click', (e) => {
      const side = e.target.closest('[data-side]');
      if (side && phase === 'pass') {
        const r = flight.chooseSeat(o.tripId, side.dataset.side);
        card('[data-seat]').textContent = r.ok ? r.text.split(',')[0] : r.text;
        root.querySelectorAll('[data-side]').forEach((b) => { b.disabled = true; b.classList.toggle('primary', b === side); });
        o.onChange?.();
        setTimeout(takeOff, reduced ? 0 : 700);
        return;
      }
      if (e.target.closest('[data-board]') && phase === 'pass') { takeOff(); return; }
      const ch = e.target.closest('[data-choice]');
      if (ch && phase === 'moment') { answered(flight.chooseFlightMoment(o.tripId, Number(ch.dataset.choice))); return; }
      if (e.target.closest('[data-onward]') && phase === 'moment') { card('[data-moment]').hidden = true; phase = 'fly'; base = progress; t0 = performance.now() - (fly * 0); return; }
      if (e.target.closest('.jg-card')) return; // the cards' own buttons only
      // A tap skips ahead: boarding takes the window, flying goes to the moment or the landing, landed goes on.
      if (phase === 'pass') { if (pass.chooseSeat) { flight.chooseSeat(o.tripId, 'window'); o.onChange?.(); } takeOff(); base = moment ? momentAt - 0.001 : 1; return; }
      if (phase === 'fly') { base = moment ? momentAt : 1; t0 = performance.now(); return; }
      if (phase === 'landed') finish();
    });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && phase === 'landed') finish(); });
    root.tabIndex = -1; root.focus?.({ preventScroll: true });
  });
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize);
  root.classList.add('journey-out');
  setTimeout(() => root.remove(), reduced ? 0 : 350);
}

/** How a trip travels, for the scene: by air, by sea, by rail or by road. */
export function overOf(mode) {
  if (!mode) return 'air';
  if (/air|jet/.test(mode)) return 'air';
  if (/ship|sail|ferry|cruise|steam/.test(mode)) return 'sea';
  if (/rail/.test(mode)) return 'rail';
  return 'land';
}
void RAD;
