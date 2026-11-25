// My Passport: the player's passport as a little book to leaf through. The first page is the photo page (who they
// are, which country issued it, when it runs out); the pages after it hold a stamp for every border crossed, in the
// order it happened: each trip abroad, each move to another country. Read-only: it shows what the save already holds.
import { isoDate } from '../engine/birthday.js';
import { player } from '../state.js';
import { esc } from '../util.js';
import { openModal } from './modals.js';
import { avatarSvg } from './avatar.js';
import { COUNTRIES } from '../data/countries.js';
import * as travel from '../engine/travel.js';
import * as docs from '../engine/documents.js';
import { held } from '../engine/citizenship.js';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const stampDate = (d) => (d ? `${d.slice(8, 10)} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '');
/** Ink colors for stamps: one per country, always the same. */
const INKS = ['#2f5d9e', '#a1323b', '#2e7a52', '#6b3f99', '#b0631c', '#1f7a7a', '#8a2f6b', '#4a5a1e'];
const hash = (s) => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const SHAPES = ['round', 'rect', 'oval'];
export const STAMPS_PER_PAGE = 4;

/** Every stamp in the player's passport, oldest first: trips abroad from the trip log, moves and older visits from the passport record. */
export function stamps(p = player()) {
  const out = [];
  const home = p.countryId;
  for (const t of travel.trips(['completed']).slice().reverse()) {
    // A cruise: a stamp for each country it called at, dated the day it was there.
    for (const c of t.type === 'cruise' ? travel.portCalls(t) : []) {
      if (c.countryId === home || out.some((x) => x.key === `${t.id}:${c.countryId}`)) continue;
      out.push({ countryId: c.countryId, city: c.port, date: c.date, kind: 'visit', key: `${t.id}:${c.countryId}` });
    }
    if (!t.destination || t.destination.countryId === t.origin?.countryId) continue;
    out.push({ countryId: t.destination.countryId, city: t.destination.city, date: t.arrived ?? t.depart, out: t.ret, kind: 'visit', key: t.id });
  }
  for (const s of p.flags.passport ?? []) {
    if (s.kind === 'visit' && out.some((x) => x.countryId === s.id && (s.date ? x.date === s.date : Number(x.date.slice(0, 4)) === s.year))) continue;
    if (s.kind === 'visit' && !s.year) continue;
    out.push({ countryId: s.id, city: null, date: s.year ? `${s.year}-01-01` : null, kind: s.kind, key: `${s.id}:${s.kind}:${s.year}`, yearOnly: true });
  }
  return out.filter((x) => COUNTRIES[x.countryId] && x.countryId !== home || x.kind === 'moved')
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
}

function stampHtml(s) {
  const c = COUNTRIES[s.countryId];
  const h = hash(s.key);
  const ink = INKS[hash(s.countryId) % INKS.length];
  const shape = SHAPES[hash(s.countryId) % SHAPES.length];
  const tilt = ((h % 17) - 8);
  const word = s.kind === 'moved' ? 'RESIDENT' : s.kind === 'born' ? 'BORN' : 'ADMITTED';
  const when = s.yearOnly ? (s.date ? s.date.slice(0, 4) : '') : stampDate(s.date);
  return `<div class="pp-stamp pp-${shape}" style="--ink:${ink};transform:rotate(${tilt}deg)" role="img" aria-label="${esc(`${c.name}${s.city ? `, ${s.city}` : ''}: ${word.toLowerCase()} ${when}`)}">
    <span class="pp-flag" aria-hidden="true">${c.flag}</span>
    <strong>${esc(c.name.toUpperCase())}</strong>
    ${s.city ? `<small>${esc(s.city.toUpperCase())}</small>` : ''}
    <em>${word}</em><b>${esc(when)}</b></div>`;
}

/** Opens the passport, at the photo page. */
export function openPassportBook() {
  const p = player();
  const current = docs.passports(p).find((d) => d.status === 'valid') ?? docs.passports(p).slice(-1)[0] ?? null;
  const issuer = COUNTRIES[current?.issuer ?? held(p)[0] ?? p.countryId];
  const list = stamps(p);
  const pageCount = 1 + Math.max(1, Math.ceil(list.length / STAMPS_PER_PAGE));
  let page = 0;
  const photoPage = () => `
    <div class="pp-page pp-photo">
      <div class="pp-pic">${avatarSvg({ appearance: p.appearance, age: p.age, gender: p.gender, seed: p.id })}</div>
      <dl>
        <dt>Surname</dt><dd>${esc(p.lastName.toUpperCase())}</dd>
        <dt>Given names</dt><dd>${esc(p.firstName.toUpperCase())}</dd>
        <dt>Nationality</dt><dd>${issuer ? `${issuer.flag} ${esc(issuer.name.toUpperCase())}` : '—'}</dd>
        <dt>Born</dt><dd>${esc(p.birthday ? stampDate(isoDate(p.birthYear, p.birthday.m, p.birthday.d)) : String(p.birthYear))} · ${esc((COUNTRIES[p.birthCountryId]?.name ?? '').toUpperCase())}</dd>
        <dt>Expires</dt><dd>${current ? esc(stampDate(current.expiresOn)) : 'NOT ISSUED YET'}</dd>
      </dl>
      <p class="pp-mrz" aria-hidden="true">P&lt;${esc((issuer?.id ?? 'XXX').toUpperCase())}${esc(p.lastName.toUpperCase().replace(/[^A-Z]/g, ''))}&lt;&lt;${esc(p.firstName.toUpperCase().replace(/[^A-Z]/g, ''))}&lt;&lt;&lt;&lt;&lt;&lt;</p>
    </div>`;
  const stampPage = (n) => {
    const mine = list.slice((n - 1) * STAMPS_PER_PAGE, n * STAMPS_PER_PAGE);
    return `<div class="pp-page pp-visas"><div class="pp-pagehead">VISAS · ${n}</div>
      ${mine.length ? `<div class="pp-grid">${mine.map(stampHtml).join('')}</div>` : '<p class="pp-empty">No stamps yet. Every trip abroad gets one.</p>'}</div>`;
  };
  const draw = () => {
    m.el.querySelector('[data-pp-body]').innerHTML = page === 0 ? photoPage() : stampPage(page);
    m.el.querySelector('[data-pp-count]').textContent = page === 0 ? `${list.length} ${list.length === 1 ? 'stamp' : 'stamps'} · ${new Set(list.map((s) => s.countryId)).size} countries` : `Page ${page} of ${pageCount - 1}`;
    m.el.querySelector('[data-pp-prev]').disabled = page === 0;
    m.el.querySelector('[data-pp-next]').disabled = page >= pageCount - 1;
    m.el.querySelectorAll('[data-pp-dot]').forEach((d, i) => d.classList.toggle('on', i === page));
  };
  const m = openModal(`
    <h2 class="pick-title"><span class="pick-emoji" aria-hidden="true">🛂</span>My Passport</h2>
    <div class="pp-book" data-pp-body></div>
    <p class="muted pp-count" data-pp-count></p>
    <div class="pp-dots" aria-hidden="true">${Array.from({ length: pageCount }, (_, i) => `<span data-pp-dot></span>`).join('')}</div>
    <div class="btn-row"><button class="btn" data-pp-prev>‹ Previous</button><button class="btn" data-pp-next>Next ›</button></div>
    <button class="btn primary" data-ok style="width:100%;margin-top:10px">Close</button>`, { dismissable: true, back: false });
  const go = (d) => { page = Math.max(0, Math.min(pageCount - 1, page + d)); draw(); };
  m.el.querySelector('[data-pp-prev]').onclick = () => go(-1);
  m.el.querySelector('[data-pp-next]').onclick = () => go(1);
  m.el.querySelector('[data-ok]').onclick = () => m.close();
  // A swipe turns the page, as in a real book.
  let x0 = null;
  const book = m.el.querySelector('[data-pp-body]');
  book.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  book.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); x0 = null; });
  draw();
  return m;
}
