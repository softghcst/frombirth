// The fame profile: who knows a person, through what, where, how warmly, and
// for how long. One profile per character; every route to recognition (a
// film, an album, a title, a throne, a following) feeds it, and none replaces
// another's record of what was actually done.
//
//   p.fame = {
//     audiences: { theater, film, tv, music, sports, literary, fashion, digital, public },  0–100 among each, at home
//     regions:   { countryId: 0–100 },   how known they are in each country, all audiences together
//     attention: 0–100   the present noise; falls quickly without new work
//     legacy:    0–100   what lasts; rises with real achievements, falls slowly, never below what was earned
//     favor:    0–100   how warmly the public regards them (50 is neutral)
//     credibility: 0–100 how the industry rates their work
//     family:    0–100   recognition that comes only from relatives (a famous parent)
//     privacy:   'open' | 'guarded' | 'private'
//     headline,          the last value written to hidden.fame (see reconcile)
//     provenance,        where an old save's single fame figure went, if it had one
//     log: [{ year, audience, delta, why }]  the latest changes and their causes
//   }
//
// p.hidden.fame stays: the one number the rest of the game reads (royalty,
// politics, social media, campaigns). It is now worked out from the profile.
// Systems that still nudge it directly are reconciled once a year: the change
// is credited to the general public, at home, with its cause recorded.
import { clamp } from '../util.js';
import { store, player } from '../state.js';
import { AUDIENCES, MEDIA_ERAS } from '../data/fame.js';

const AUD = Object.keys(AUDIENCES);

/** The profile, made if missing. A save from before keeps its single figure, credited to the public at home. */
export function fameOf(p = player()) {
  if (p.fame) return p.fame;
  const old = Math.round(p.hidden?.fame ?? 0);
  p.fame = { audiences: Object.fromEntries(AUD.map((a) => [a, 0])), regions: {}, attention: 0, legacy: 0, favor: 50, credibility: 0, family: 0,
    privacy: 'guarded', headline: old, provenance: null, log: [] };
  if (old > 0) {
    // No works are invented to explain it: it is recorded as recognition from before the profile existed.
    p.fame.audiences.public = old;
    p.fame.regions[p.countryId] = old;
    p.fame.legacy = Math.round(old * 0.6);
    p.fame.attention = Math.round(old * 0.5);
    p.fame.provenance = { migratedFrom: old, year: store.state?.year ?? null, note: 'Recognition carried over from before the fame profile existed.' };
  }
  return p.fame;
}

/** Whether a medium exists yet in the game's world. */
export const exists = (medium, year = store.state?.year ?? 2000) => year >= (MEDIA_ERAS[medium] ?? 0);

function note(f, audience, delta, why) {
  if (!delta) return;
  f.log.push({ year: store.state?.year ?? null, audience, delta: Math.round(delta * 10) / 10, why });
  if (f.log.length > 40) f.log.splice(0, f.log.length - 40);
}

/**
 * Recognition from something that happened.
 * @param {object} o
 *   audience  which audience notices (AUDIENCES key)
 *   amount    how much (0–100 scale; diminishing as recognition rises)
 *   countryId where it happened (default: where the player lives)
 *   reach     0–1: how far it travels beyond that country (international distribution, tours)
 *   abroad    countries it reached, if known (otherwise none: reach alone is not enough to be known somewhere)
 *   lasting   0–1: how much of it becomes legacy
 *   why       the cause, kept in the profile's log
 */
export function gain(o, p = player()) {
  const f = fameOf(p);
  const audience = AUDIENCES[o.audience] ? o.audience : 'public';
  const room = (v) => (o.amount >= 0 ? (100 - v) / 100 : v / 100);
  const add = (v, x) => Math.round(clamp(v + x * room(v)) * 10) / 10;
  const amount = o.amount;
  f.audiences[audience] = add(f.audiences[audience], amount);
  // The general public hears a little of every audience's news, more of the biggest ones.
  if (audience !== 'public') f.audiences.public = add(f.audiences.public, amount * AUDIENCES[audience].weight * 0.35);
  const home = o.countryId ?? p.countryId;
  f.regions[home] = add(f.regions[home] ?? 0, amount * (0.4 + AUDIENCES[audience].weight * 0.4));
  for (const c of o.abroad ?? []) f.regions[c] = add(f.regions[c] ?? 0, amount * (o.reach ?? 0.3) * (0.2 + AUDIENCES[audience].weight * 0.2)); // being known abroad is slower than at home
  f.attention = add(f.attention, amount * 0.8);
  // What lasts builds slowly, and more slowly the more there already is: "historic" takes a lifetime of work.
  if (o.lasting && amount > 0) f.legacy = Math.round(clamp(f.legacy + amount * o.lasting * 0.4 * ((100 - f.legacy) / 100) ** 2) * 10) / 10;
  else if (o.lasting) f.legacy = add(f.legacy, amount * o.lasting * 0.5);
  note(f, audience, amount, o.why ?? '');
  return refresh(p);
}

/** How the public feels; how the industry rates the work. */
export function regard({ favor = 0, credibility = 0, why = '' }, p = player()) {
  const f = fameOf(p);
  f.favor = Math.round(clamp(f.favor + favor) * 10) / 10;
  f.credibility = Math.round(clamp(f.credibility + credibility * (credibility > 0 ? (100 - f.credibility) / 100 : 1)) * 10) / 10;
  if (favor) note(f, 'favor', favor, why);
  if (credibility) note(f, 'credibility', credibility, why);
  return f;
}

/** Recognition in a country, and the figure the rest of the game reads (hidden.fame). */
export function recognitionIn(countryId, p = player()) {
  const f = fameOf(p);
  const own = f.regions[countryId] ?? 0;
  const lasting = f.legacy * (countryId === p.countryId || own > 0 ? 0.6 : 0.25);
  return Math.round(clamp(Math.max(own, lasting, f.family * 0.5)));
}

/** Recomputes the headline figure and writes it to hidden.fame. */
export function refresh(p = player()) {
  const f = fameOf(p);
  const here = recognitionIn(p.countryId, p);
  const value = Math.round(clamp(here * 0.75 + f.attention * 0.25));
  f.headline = value;
  p.hidden.fame = value;
  return f;
}

/**
 * Systems written before the profile change hidden.fame directly (a coronation, an election, a viral post).
 * Once a year, whatever they did since the last refresh is credited to the general public at home.
 */
export function reconcile(p = player()) {
  const f = fameOf(p);
  const delta = (p.hidden.fame ?? 0) - (f.headline ?? 0);
  if (Math.abs(delta) >= 1) {
    const why = p.royal && !p.royal.waiting ? 'public life as a royal' : p.politics ? 'public office' : 'public life';
    if (delta > 0) gain({ audience: 'public', amount: delta * 1.1, lasting: p.royal || p.politics ? 0.5 : 0.2, why }, p);
    else { f.attention = clamp(f.attention + delta); note(f, 'public', delta, why); }
  }
  return refresh(p);
}

/**
 * Once a year: attention fades fast, recognition slowly, legacy hardly at all, and
 * never below what the record has earned. @returns {string[]} journal lines
 */
export function tickFameProfile(p = player()) {
  reconcile(p);
  const f = fameOf(p);
  const lines = [];
  const before = scope(p).id;
  f.attention = Math.round(f.attention * 0.62 * 10) / 10;
  const floor = (v) => Math.max(v * 0.9, f.legacy * 0.7);
  for (const a of AUD) f.audiences[a] = Math.round(Math.min(f.audiences[a], floor(f.audiences[a])) * 10) / 10;
  for (const c of Object.keys(f.regions)) {
    f.regions[c] = Math.round(Math.min(f.regions[c], floor(f.regions[c])) * 10) / 10;
    if (f.regions[c] < 0.5) delete f.regions[c];
  }
  f.legacy = Math.round(f.legacy * 0.995 * 10) / 10;
  f.family = Math.round(f.family * 0.96 * 10) / 10;
  f.favor = Math.round((f.favor + (50 - f.favor) * 0.08) * 10) / 10; // feelings cool toward neutral
  refresh(p);
  const after = scope(p).id;
  if (before !== after && SCOPES.findIndex((s) => s.id === after) > SCOPES.findIndex((s) => s.id === before)) lines.push(`You are ${scope(p).name.toLowerCase()} now.`);
  return lines;
}

/** Descriptions of how widely known someone is, from the data, never assigned. */
export const SCOPES = [
  { id: 'unknown', name: 'Unknown' },
  { id: 'emerging', name: 'Emerging' },
  { id: 'local', name: 'Locally recognized' },
  { id: 'national', name: 'Nationally recognized' },
  { id: 'international', name: 'Internationally recognized' },
  { id: 'historic', name: 'Historically influential' },
];
export function scope(p = player()) {
  const f = fameOf(p);
  const home = recognitionIn(p.countryId, p);
  const abroad = Object.entries(f.regions).filter(([c, v]) => c !== p.countryId && v >= 30).length;
  const id = f.legacy >= 85 ? 'historic' : abroad >= 3 && home >= 40 ? 'international' : home >= 35 ? 'national' : home >= 12 ? 'local' : home >= 4 || f.attention >= 8 ? 'emerging' : 'unknown';
  return SCOPES.find((s) => s.id === id);
}

/** The audiences someone is best known to, strongest first. */
export const topAudiences = (p = player(), n = 3) => Object.entries(fameOf(p).audiences).filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([id, v]) => ({ id, name: AUDIENCES[id].name, value: Math.round(v) }));

/** Countries where someone is known, strongest first. */
export const topRegions = (p = player(), n = 6) => Object.entries(fameOf(p).regions).filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).slice(0, n);

/**
 * Recognition a child is born into, or an heir carries on with: the family's name, not their work.
 * Nothing else passes: no audiences, no credits, no credibility.
 */
export function inherited(fromLegacy, fromHeadline) {
  return Math.round(clamp(Math.max(fromLegacy * 0.5, fromHeadline * 0.35)));
}
export function startWithFamilyName(p, value) {
  const f = fameOf(p);
  f.family = Math.max(f.family, value);
  refresh(p);
  return f;
}

/**
 * Someone born into public life. A royal is known to the public from birth, in their own country; an
 * aristocrat's name is known, which is recognition through family, not their own.
 */
export function bornKnown(p, value, kind) {
  p.hidden.fame = 0;
  const f = fameOf(p);
  if (kind === 'royal') {
    f.audiences.public = value;
    f.regions[p.countryId] = value;
    f.attention = value;
    f.legacy = Math.round(value * 0.4);
    note(f, 'public', value, 'born into the royal family');
  } else f.family = Math.max(f.family, value * 2);
  return refresh(p);
}
