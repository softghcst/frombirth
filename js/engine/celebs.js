// The famous: the lives of the game's well-known people go on whether the
// player is watching or not (marriages, children, scandals true and false,
// retirements, returns, deaths), and the player's own fame has a shape over
// time: rising, at its peak, fading, faded, and sometimes a comeback.
//
//   npc.flags.star.story = [{ year, text }]      what happened to them, in order
//   npc.flags.star.partner, .married, .retired, .retiredYear
//   p.fame.arc = { phase:'rising'|'peak'|'fading'|'faded'|'comeback', peak, since, offers:[{ kind, ... }], comebacks }
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage } from '../util.js';
import { store, player, country, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { ent, article } from './entertainment.js';
import { fameOf, gain, regard } from './fame.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
const full = (n) => `${n.firstName} ${n.lastName}`;
const ageOf = (n) => (n.flags.star?.born != null ? year() - n.flags.star.born : n.age);

/** The well-known people of a country (and the international circuits): the ones the papers write about. */
export function celebrities(countryId = player().countryId) {
  const st = store.state;
  const E = ent();
  const ids = new Set([
    ...(E.pool?.[countryId] ?? []),
    ...Object.values(E.acts ?? {}).filter((a) => a.npc && a.countryId === countryId).flatMap((a) => a.members.map((m) => m.who)),
    // Athletes the sports engine has made known (engine/sports.js: athletes are kept by person id, with their fame).
    ...Object.values(st.sports?.athletes ?? {}).filter((a) => a.fame >= 25 && a.countryId === countryId).map((a) => a.id),
  ]);
  return [...ids].map((id) => st.npcs[id]).filter((n) => n?.flags?.star && n.alive !== false && (n.flags.star.fame ?? 0) >= 25);
}

const tell = (n, text, o = {}) => {
  const s = n.flags.star;
  (s.story ??= []).push({ year: year(), text });
  if (s.story.length > 14) s.story.shift();
  article({ kind: 'celeb', about: n.id, accuracy: o.accuracy ?? 'verified', true: o.true ?? true, text: o.headline ?? text });
};

/** A year in famous lives. @returns {string[]} news the player would notice: people they know */
function lives(p) {
  const st = store.state;
  const lines = [];
  // Who is talked about rises with work; who is not, fades.
  const working = new Map();
  for (const x of Object.values(ent().productions)) if (x.workYear === year() - 1) for (const r of x.cast) if (r.who && r.who !== 'player') working.set(r.who, (working.get(r.who) ?? 0) + (r.kind === 'lead' ? 2 : 1));
  for (const n of Object.values(st.npcs)) {
    const s = n.flags?.star;
    if (!s || n.alive === false) continue;
    s.fame = Math.round(clamp((s.fame ?? 0) * 0.93 + (working.get(n.id) ?? 0) * 4 + (s.kind === 'athlete' && !s.retired ? 2 : 0)));
  }
  const famous = celebrities(p.countryId);
  for (const n of famous.sort(() => rng.next() - 0.5).slice(0, 8)) {
    const s = n.flags.star;
    const age = ageOf(n);
    const known = p.npcIds.includes(n.id);
    const roll = rng.next();
    let text = null;
    if (age >= 78 && rng.chance(0.25) && !known) {
      n.alive = false;
      n.flags.diedYear = year();
      text = `${full(n)} has died, aged ${age}. Tributes are pouring in.`;
      tell(n, text);
    } else if (!s.retired && (age >= 66 || (s.kind === 'athlete' && age >= 34)) && roll < 0.3) {
      s.retired = true; s.retiredYear = year();
      text = `${full(n)} has retired${s.kind === 'athlete' ? ' from sport' : ''}.`;
      tell(n, text);
    } else if (s.retired && year() - (s.retiredYear ?? year()) >= 3 && age < 75 && roll < 0.15) {
      s.retired = false; s.fame = Math.min(100, (s.fame ?? 0) + 15);
      text = `${full(n)} is coming out of retirement.`;
      tell(n, text);
    } else if (!s.married && age >= 22 && roll < 0.2) {
      const other = famous.find((m) => m !== n && !m.flags.star.married && ageOf(m) >= 22 && Math.abs(ageOf(m) - age) < 12 && m.id !== n.id);
      s.married = year();
      if (other && rng.chance(0.4)) {
        other.flags.star.married = year(); s.partner = other.id; other.flags.star.partner = n.id;
        text = `${full(n)} and ${full(other)} have married.`;
        tell(n, text); (other.flags.star.story ??= []).push({ year: year(), text });
      } else { s.partner = 'private'; text = `${full(n)} has married, quietly, away from the cameras.`; tell(n, text); }
    } else if (s.married && year() - s.married >= 2 && roll < 0.28) {
      const ex = st.npcs[s.partner];
      text = ex ? `${full(n)} and ${full(ex)} have separated.` : `${full(n)} has separated from their partner.`;
      tell(n, text);
      s.married = null; s.partner = null;
      if (ex?.flags.star) { ex.flags.star.married = null; ex.flags.star.partner = null; (ex.flags.star.story ??= []).push({ year: year(), text }); }
    } else if (s.married && age < 45 && roll < 0.4) {
      text = `${full(n)} has become a parent.`;
      tell(n, text);
    } else if (roll < 0.5) {
      // A scandal, which may not be true. What the paper says, and what happened, are kept apart.
      const real = rng.chance(0.45);
      const what = rng.pick(['a row on set', 'unpaid taxes', 'a secret affair', 'a drunken night out', 'treating staff badly']);
      s.fame = Math.min(100, (s.fame ?? 0) + 5);
      text = `Reports of ${what} involving ${full(n)}.`;
      tell(n, real ? `${text}` : `${text} (denied)`, { accuracy: real ? 'confirmed' : 'rumour', true: real, headline: text });
      if (!real && rng.chance(0.5)) (s.story).push({ year: year(), text: 'The reports were later shown to be false.' });
    }
    if (text && known) lines.push(text);
  }
  return lines;
}

// ---------- The player's arc ----------

const PHASE_NAME = { rising: 'On the way up', peak: 'At the height of it', fading: 'Fading from view', faded: 'Out of the spotlight', comeback: 'Back' };
export const phaseName = (p = player()) => PHASE_NAME[fameOf(p).arc?.phase] ?? null;

function arc(p) {
  const f = fameOf(p);
  const lines = [];
  const h = p.hidden.fame ?? 0;
  f.arc ??= { phase: null, peak: 0, since: year(), offers: [], comebacks: 0, low: 0 };
  const a = f.arc;
  const was = a.phase;
  a.peak = Math.max(a.peak, h);
  if (a.peak < 25) { a.phase = h > 3 ? 'rising' : null; return lines; }
  let phase;
  if (h >= a.peak * 0.85) phase = was === 'faded' ? 'comeback' : 'peak';
  else if (h >= a.peak * 0.55) phase = was === 'comeback' ? 'comeback' : was === 'faded' ? 'faded' : 'fading';
  else phase = 'faded';
  if (phase === 'faded' && was !== 'faded') {
    a.low = 0;
    lines.push('People have started asking what happened to you.');
    offerComebacks(p, a);
  }
  if (phase === 'faded') a.low += 1;
  if (was === 'faded' && h >= a.peak * 0.7) phase = 'comeback';
  if (phase === 'comeback' && was !== 'comeback') {
    a.comebacks += 1;
    a.offers = [];
    milestone('Made a comeback.', 'fame');
    article({ kind: 'feature', about: 'player', accuracy: 'verified', text: `The return of ${p.firstName} ${p.lastName}.` });
    lines.push('The papers are calling it a comeback.');
  }
  if (phase !== was) a.since = year();
  a.phase = phase === 'comeback' && year() - a.since > 3 ? 'peak' : phase;
  return lines;
}

function offerComebacks(p, a) {
  const c = country();
  a.offers = [{ kind: 'reality', fee: Math.round(localWage(25000 + a.peak * 1200, c)), year: year() }];
  if ((p.fame.credits ?? []).length >= 3 || (p.fame.legacy ?? 0) >= 20) a.offers.push({ kind: 'tribute', year: year() });
  a.offers.push({ kind: 'memoir', year: year() });
  const split = (p.fame.acts ?? []).map((id) => ent().acts?.[id]).find((x) => x?.status === 'split');
  if (split) a.offers.push({ kind: 'reunion', actId: split.id, year: year() });
}

export const comebackOffers = (p = player()) => fameOf(p).arc?.offers ?? [];

/** Takes a comeback offer. A reunion and a memoir are done through music and books; these two are done here. */
export function takeComeback(kind) {
  const p = player();
  const a = fameOf(p).arc;
  const o = a?.offers.find((x) => x.kind === kind);
  if (!o) return result(false, 'That offer has gone.', 'neutral');
  a.offers = a.offers.filter((x) => x !== o);
  if (kind === 'reality') {
    (a.paid ??= []).push({ year: year(), fee: o.fee });
    gain({ audience: 'tv', amount: 14, reach: 0.3, lasting: 0.05, why: 'a reality show' }, p);
    gain({ audience: 'public', amount: 10, lasting: 0.05, why: 'a reality show' }, p);
    regard({ credibility: -6, favour: rng.chance(0.5) ? 6 : -6, why: 'a reality show' }, p);
    milestone('Went on a reality show.', 'fame');
    return result(true, `Ten weeks in a house with cameras. Everyone has an opinion about you again. The fee, ${fmtMoney(o.fee, country())}, comes with this year's income.`, 'neutral');
  }
  if (kind === 'tribute') {
    gain({ audience: 'public', amount: 6, lasting: 0.9, why: 'a tribute evening' }, p);
    regard({ credibility: 6, favour: 5, why: 'a tribute' }, p);
    milestone('Honored at a tribute evening.', 'fame');
    return result(true, 'An evening of clips and speeches about your work. You do not quite know where to look.');
  }
  return result(false, 'That is done another way.', 'neutral');
}
export function declineComeback(kind) { const a = fameOf().arc; if (a) a.offers = a.offers.filter((x) => x.kind !== kind); return result(true, 'You let it pass.', 'neutral'); }

/** A reality show's fee, paid once with the year's income. */
export function comebackLines(p = player()) {
  const lived = year() - 1;
  return (p.fame?.arc?.paid ?? []).filter((x) => x.year === lived && !x.done).map((x) => ({ source: `reality:${lived}`, label: 'Reality show fee', gross: x.fee }));
}
export function markComebacksPaid(p = player()) { const lived = year() - 1; for (const x of p.fame?.arc?.paid ?? []) if (x.year === lived) x.done = true; }

/** Once a year, after the work is counted. */
export function tickCelebs() {
  const p = player();
  return [...lives(p), ...arc(p)];
}

/** Celebrity news: the latest stories about famous people. */
export const news = (n = 8) => ent().articles.filter((a) => a.kind === 'celeb' && store.state.npcs[a.about]).slice(-n).reverse();
