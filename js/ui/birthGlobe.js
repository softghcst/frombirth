// The birth globe: at the start of a life, the world spins, slows, and turns to the place the player is born; a pin
// drops on it, and a card names the country and the city. For a random life the card also says how rare that is: the
// country's share of the world's babies (data/births.js), only for show, since the country itself was drawn at random.
// "Be Born" starts the life. A tap skips the spin; with reduced motion the globe is shown already there. It can be
// turned off in Settings (kept in this browser, like Haptics).
import { esc } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { birthOdds } from '../data/births.js';
import { coords } from '../engine/geo.js';
import { RAD, rings, drawGlobe, stars, flagsShown } from './globe.js';

export const BIRTH_GLOBE_KEY = 'frombirth.birthGlobe';
/** Whether a life begins with the globe. On by default; kept in this browser for every life. */
export function birthGlobeOn() {
  try { return localStorage.getItem(BIRTH_GLOBE_KEY) !== 'off'; } catch { return true; }
}
export function setBirthGlobe(on) {
  try { if (on) localStorage.removeItem(BIRTH_GLOBE_KEY); else localStorage.setItem(BIRTH_GLOBE_KEY, 'off'); } catch { /* storage unavailable */ }
}


const SPIN_MS = 4400; // spinning down and turning to the place
const ZOOM_MS = 2600; // the last part of it: closing in
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/**
 * Shows the globe for a new life. Resolves when the player presses "Be Born".
 * @param {object} state the new life (createLife)
 * @param {{designed?: boolean}} o designed: the player chose the country, so no odds are shown
 */
export async function openBirthGlobe(state, o = {}) {
  const p = state.player;
  const c = COUNTRIES[p.birthCountryId ?? p.countryId] ?? COUNTRIES[p.countryId];
  const at = coords(c.id, p.city) ?? { lat: 0, lon: 0 };
  const land = await rings();
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const odds = o.designed ? null : birthOdds(c.id);
  const root = document.createElement('div');
  root.className = 'birth-globe';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `Born in ${c.name}`);
  const pct = odds ? (odds.pct >= 1 ? odds.pct.toFixed(1) : odds.pct >= 0.01 ? odds.pct.toFixed(2) : odds.pct.toFixed(4)) : '';
  root.innerHTML = `<canvas class="bg-canvas" aria-hidden="true"></canvas>
    <div class="bg-pin" aria-hidden="true"><i></i><i></i><span><svg viewBox="0 0 32 46" width="34" height="49"><path d="M16 45 C13 33 3 26 3 15 a13 13 0 0 1 26 0 c0 11 -10 18 -13 30z" fill="#E8434F" stroke="#7A1420" stroke-width="2"/><circle cx="16" cy="15" r="5.5" fill="#FFF4E8"/></svg></span></div>
    <p class="bg-hint">${reduced ? '' : 'Tap to skip'}</p>
    <section class="bg-card" aria-live="polite">
      <p class="bg-eyebrow">${o.designed ? 'You chose to be born in' : 'You are born in'}</p>
      <h2 class="bg-country">${flagsShown() ? `<span class="bg-flag">${c.flag}</span>` : ''}${esc(c.name)}</h2>
      <p class="bg-city">${esc(p.city)} · ${state.year}</p>
      ${odds ? `<div class="bg-odds"><span class="bg-rarity bg-${odds.rarity.tone}">${esc(odds.rarity.name)}</span>
        <p><strong>${pct}%</strong> of the world's babies are born here${odds.oneIn > 1 ? `: about 1 in ${odds.oneIn.toLocaleString('en-US')}` : ''}.</p></div>` : ''}
      <button type="button" class="btn primary big bg-born" data-born>Be Born</button>
    </section>`;
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
  const wide = () => w > 760;
  // Where the globe sits when it has landed: to the left of the card on a wide screen, above it on a phone.
  const center = () => (wide() ? { cx: w * 0.36, cy: h * 0.5 } : { cx: w * 0.5, cy: h * 0.36 });
  const base = () => Math.min(w, h) * 0.34;
  const t0 = performance.now();
  let done = reduced;
  let raf = 0;
  function frame(now) {
    const t = done ? SPIN_MS + ZOOM_MS : now - t0;
    const spin = easeOut(clamp01(t / SPIN_MS));
    const zoom = easeInOut(clamp01((t - (SPIN_MS - ZOOM_MS * 0.5)) / ZOOM_MS));
    // Two and a half turns, slowing to the place; tipping from a view of the equator to its latitude.
    const lon0 = at.lon + 900 * (1 - spin);
    const lat0 = 12 + (at.lat * 0.9 - 12) * spin;
    const c0 = { cx: w * 0.5, cy: h * 0.46 }; const c1 = center();
    const cx = c0.cx + (c1.cx - c0.cx) * zoom; const cy = c0.cy + (c1.cy - c0.cy) * zoom;
    const r = base() * (1 + (wide() ? 2.1 : 2.3) * zoom);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sky, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGlobe(ctx, land, { cx, cy, r, lon0, lat0 });
    // The place itself sits a little off center when the latitude is not fully tipped to: where it is on the globe.
    const off = (at.lat - lat0) * RAD;
    const pin = root.querySelector('.bg-pin');
    pin.style.left = `${cx}px`; pin.style.top = `${cy - Math.sin(off) * r}px`;
    if (t >= SPIN_MS + ZOOM_MS * 0.5) land_();
    if (t < SPIN_MS + ZOOM_MS * 0.5 + 50) raf = requestAnimationFrame(frame);
  }
  let landed = false;
  function land_() {
    if (landed) return;
    landed = true;
    root.classList.add('bg-landed');
    root.querySelector('.bg-hint').textContent = '';
    setTimeout(() => root.querySelector('[data-born]')?.focus?.({ preventScroll: true }), reduced ? 0 : 900);
  }
  const skip = () => { if (landed) return; done = true; cancelAnimationFrame(raf); frame(performance.now()); };
  const onResize = () => { size(); if (landed || done) { done = true; frame(performance.now()); } };
  window.addEventListener('resize', onResize);
  raf = requestAnimationFrame(frame);
  if (reduced) frame(performance.now());
  await new Promise((resolve) => {
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-born]')) { resolve(); return; }
      skip();
    });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' || (e.key === 'Enter' && !landed)) skip(); });
    root.tabIndex = -1; root.focus?.({ preventScroll: true });
  });
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize);
  // The life is drawn underneath straight away (the caller plays it when this resolves); the globe fades out over it.
  root.classList.add('bg-out');
  setTimeout(() => root.remove(), reduced ? 0 : 450);
}
