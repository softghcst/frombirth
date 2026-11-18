// Modeling. A model is represented by an agency, goes to castings, and is
// booked or not; every booking goes into a portfolio, and the portfolio, not
// a number, is what the next client looks at. The model's pay is the career's
// (engine/career.js, 'modeling'); bookings shape performance and fame, and are
// never paid a second time here.
//
//   state.ent.orgs: kind 'model_agency'
//   p.fame.model = { agencyId, portfolio:[{ year, kind, client, city, countryId, prestige }], castings:{ age, list:[Casting], went } }
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { MODEL_AGENCY_NAMES, FASHION_HOUSES, MAGAZINES, BOOKINGS, FASHION_CAPITALS, BRANDS, ORG_WORDS } from '../data/fame.js';
import { ent, workOf } from './entertainment.js';
import { gain, regard } from './fame.js';
import { registerEmployer } from './employers.js';
import { makeNpc } from './npcFactory.js';
import { rollTerms, look as lookFor, offered, clearOffer, triesLeft, askLowerCut } from './agents.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
export const isModel = (p = player()) => p.career?.careerId === 'modeling';

export function modelOf(p = player()) {
  const f = workOf(p);
  f.model ??= { agencyId: null, portfolio: [], castings: { age: null, list: [], went: 0 } };
  return f.model;
}

/** A country's model agencies, made once. Two in the capital: one top, one ordinary. */
export function agencies(countryId) {
  const E = ent();
  E.modelAgencies ??= {};
  if (!E.modelAgencies[countryId]) {
    const c = COUNTRIES[countryId];
    const city = c.place?.capital ?? c.cities[0];
    E.modelAgencies[countryId] = [85, 55, 40].map((rep) => {
      const name = rng.pick(MODEL_AGENCY_NAMES).replace('{W}', rng.pick(ORG_WORDS)).replace('{S}', rng.pick(c.names.last)).replace('{C}', city);
      const e = registerEmployer({ name, family: 'arts', tracks: ['modeling'], countryId, city, owned: false });
      const o = { id: `org_m${(E.seq += 1).toString(36)}`, kind: 'model_agency', name, countryId, city, reputation: rep, employerId: e.id, staff: [], history: [], founded: year() - rng.int(5, 50) };
      E.orgs[o.id] = o;
      return o.id;
    });
  }
  const list = E.modelAgencies[countryId].map((id) => ent().orgs[id]);
  // Each agency is run by a head booker with their own cut and pull, and has models on its books.
  for (const o of list) {
    if (o.bookerId && store.state.npcs[o.bookerId]) continue;
    const tier = o.reputation >= 75 ? 'top' : o.reputation >= 50 ? 'mid' : 'small';
    const b = makeNpc({ role: 'performer', countryId, age: rng.int(30, 60), relationship: rng.int(40, 55) });
    b.occupation = 'model booker';
    b.flags.agent = { kind: 'model', orgId: o.id, agency: o.name, tier, standard: o.reputation - 10, clients: [], ...rollTerms(tier, 'model') };
    for (let k = 0; k < rng.int(2, 4); k++) {
      const m = makeNpc({ role: 'performer', countryId, age: rng.int(18, 34) });
      m.occupation = 'model';
      m.flags.star = { kind: 'model', fame: Math.round(clamp(rng.around(o.reputation - 30, 12))), born: year() - m.age, credits: [], skill: {}, agentId: b.id,
        covers: [rng.pick(MAGAZINES)], campaigns: [rng.pick([...BRANDS, ...FASHION_HOUSES])] };
      store.state.npcs[m.id] = m;
      b.flags.agent.clients.push(m.id);
    }
    store.state.npcs[b.id] = b;
    o.bookerId = b.id;
  }
  return list;
}
export const booker = (o) => (o?.bookerId ? store.state.npcs[o.bookerId] : null);
/** The cut the player's agency takes of their modeling pay, and its pull. */
export const agencyTerms = (p = player()) => { const m = p.fame?.model; return m?.agencyId ? m.terms ?? null : null; };

/** How a model reads in a casting: presence, and how they carry themselves. */
export const look = (p = player()) => Math.round(clamp(p.stats.charm * 0.6 + p.stats.health * 0.2 + (p.talents.dance ?? 50) * 0.2 - Math.max(0, p.age - 28) * 1.2));
const book = (m) => m.portfolio.reduce((s, x) => s + x.prestige, 0);

/** Agencies that would take the player on, best first. */
export function agenciesWilling(p = player()) {
  const m = modelOf(p);
  return agencies(p.countryId).filter((a) => look(p) + Math.min(20, book(m) / 15) >= a.reputation - 10);
}

export function joinAgency(orgId) {
  const p = player();
  if (!isModel(p)) return result(false, 'You need to be working as a model.', 'neutral');
  const a = agenciesWilling(p).find((x) => x.id === orgId);
  if (!a) return result(false, 'They pass. Not now.');
  const b = booker(a);
  const m = modelOf(p);
  m.agencyId = a.id;
  m.terms = { npcId: b?.id ?? null, commission: b?.flags.agent.commission ?? 0.2, clout: b?.flags.agent.clout ?? 1, since: year() };
  if (b) { b.flags.agent.clients.push('player'); if (!p.npcIds.includes(b.id)) { p.npcIds.push(b.id); b.role = 'colleague'; } b.flags.title = `Your booker at ${a.name}`; }
  clearOffer('model', p);
  milestone(`Signed with ${a.name}.`, 'career');
  return result(true, `${a.name} will represent you, for ${Math.round(m.terms.commission * 100)}% of what you earn modeling. Castings come through them now.`);
}

/** Looks for an agency: one at a time, with their cut and their models, twice a year. */
export function findModelAgency() {
  const p = player();
  if (!isModel(p)) return result(false, 'You need to be working as a model.', 'neutral');
  const willing = agenciesWilling(p).filter((o) => o.id !== modelOf(p).agencyId).map(booker).filter(Boolean);
  const r = lookFor('model', willing, p);
  if (r.error) return result(false, r.error, 'neutral');
  if (r.none) return result(false, 'No agency will take you on yet. A stronger book changes that.', 'neutral');
  return result(true, `${r.agent.flags.agent.agency} would represent you, for ${Math.round(r.agent.flags.agent.commission * 100)}%.`, 'neutral');
}
export const agencyOnOffer = () => offered('model');
export const agencyTriesLeft = () => triesLeft('model');
export function passOnAgency() { clearOffer('model'); return result(true, 'You say no.', 'neutral'); }
export function signOfferedAgency() { const n = offered('model'); if (!n) return result(false, 'No agency is on offer.', 'neutral'); if (modelOf().agencyId) leaveAgency(); return joinAgency(n.flags.agent.orgId); }
export function leaveAgency() {
  const p = player();
  const m = modelOf(p);
  if (!m.agencyId) return result(false, 'You have no agency.', 'neutral');
  const b = store.state.npcs[m.terms?.npcId];
  if (b?.flags.agent) b.flags.agent.clients = b.flags.agent.clients.filter((c) => c !== 'player');
  m.agencyId = null; m.terms = null;
  return result(true, 'You leave the agency.', 'neutral');
}
export const askAgencyCut = () => { const p = player(); const r = askLowerCut('model', modelOf(p).terms, book(modelOf(p)) / 8, p); if (r.dropped) leaveAgency(); return r; };

/** This year's castings: what the agency sends, and what is open to anyone. */
export function castings(p = player()) {
  const m = modelOf(p);
  if (m.castings.age === p.age) return m.castings.list;
  const ag = ent().orgs[m.agencyId];
  const rep = ag?.reputation ?? 30;
  const kinds = Object.entries(BOOKINGS).filter(([, b]) => b.prestige <= rep + 25 + book(m) / 20);
  const list = Array.from({ length: ag ? 5 : 2 }, () => {
    const [kind, b] = rng.pick(kinds);
    const abroad = b.abroad && rng.chance(rep / 100) ? rng.pick(Object.keys(FASHION_CAPITALS).filter((c) => COUNTRIES[c])) : null;
    const client = kind === 'editorial' || kind === 'cover' ? rng.pick(MAGAZINES) : kind === 'runway' ? rng.pick(FASHION_HOUSES) : rng.pick([...BRANDS, ...FASHION_HOUSES]);
    const countryId = abroad ?? p.countryId;
    const wants = rng.pick(Object.keys(APPROACHES));
    return { id: `cast_${(ent().seq += 1).toString(36)}`, kind, client, countryId, city: abroad ? FASHION_CAPITALS[abroad] : COUNTRIES[p.countryId].cities[0], prestige: b.prestige, bar: b.bar, status: 'open',
      wants, brief: rng.pick(BRIEFS[wants]) };
  });
  m.castings = { age: p.age, list, went: 0 };
  return list;
}

/** How a model can play a casting. The client's brief hints at what they want; it does not say. */
export const APPROACHES = {
  poise: { label: 'Poised and still', sub: 'Let the clothes do the talking.' },
  energy: { label: 'All energy', sub: 'Movement, attitude, a big walk.' },
  warmth: { label: 'Warm and open', sub: 'Smile; be someone people would like to know.' },
  edge: { label: 'Something strange', sub: 'An unusual angle, a look nobody expects.' },
};
const BRIEFS = {
  poise: ['"Quiet luxury. Nothing should move that does not need to."', '"We want stillness. A portrait, not a performance."'],
  energy: ['"It is a sportswear story. Make us believe you could run in it."', '"Big, loud, joyful. Summer."'],
  warmth: ['"Family brand. The woman next door, the man next door, at their best."', '"We need someone the customer trusts."'],
  edge: ['"The designer hates pretty."', '"Make it strange. We have seen beautiful."'],
};

/** The chance of being booked: the look against the client's bar, the agency, the book, and reading the brief right. */
export function castingOdds(c, approach, p = player()) {
  const m = modelOf(p);
  const ag = ent().orgs[m.agencyId];
  const read = approach ? (approach === c.wants ? 0.2 : -0.12) : 0; // reading the brief right is half the job
  return clamp(0.35 + (look(p) - c.bar) / 30 + (ag ? (ag.reputation - 50) / 200 + ((m.terms?.clout ?? 1) - 1) * 0.1 : -0.1) + Math.min(0.15, book(m) / 1500) + read, 0.04, 0.92);
}

/** Goes to a casting and plays it one way. Three a year at most around everything else. */
export function attendCasting(id, approach = null) {
  const p = player();
  const m = modelOf(p);
  if (!isModel(p)) return result(false, 'You need to be working as a model.', 'neutral');
  const c = castings(p).find((x) => x.id === id);
  if (!c || c.status !== 'open') return result(false, 'That casting has gone.', 'neutral');
  if (m.castings.went >= 3) return result(false, 'You have been to all the castings you can this year.', 'neutral');
  m.castings.went += 1;
  const ag = ent().orgs[m.agencyId];
  const odds = castingOdds(c, approach, p);
  c.played = approach;
  if (!rng.chance(odds)) {
    c.status = 'lost';
    const miss = approach && approach !== c.wants ? ` Afterward your booker says they wanted something more ${APPROACHES[c.wants].label.toLowerCase()}.` : '';
    return result(false, `${rng.pick(['They went with someone else.', 'You wait three hours, walk for ninety seconds, and hear nothing.', '"Not quite the look this season."'])}${miss}`);
  }
  c.status = 'booked';
  const entry = { year: year(), kind: c.kind, client: c.client, city: c.city, countryId: c.countryId, prestige: c.prestige };
  m.portfolio.push(entry);
  const name = BOOKINGS[c.kind].name;
  if (m.portfolio.length === 1) milestone(`First booking: ${name.toLowerCase()} for ${c.client}.`, 'career');
  if (c.kind === 'cover') milestone(`On the cover of ${c.client}.`, 'fame');
  gain({ audience: 'fashion', amount: c.prestige / 12, abroad: c.countryId !== p.countryId ? [c.countryId] : [], reach: 0.5, lasting: c.kind === 'cover' ? 0.4 : 0.15, why: `${name.toLowerCase()} for ${c.client}` }, p);
  if (c.prestige >= 60) gain({ audience: 'public', amount: c.prestige / 30, why: c.client }, p);
  p.career.performance = clamp(p.career.performance + c.prestige / 8);
  return result(true, `Booked: ${name.toLowerCase()} for ${c.client}${c.countryId !== p.countryId ? ` in ${c.city}` : ''}.`);
}

/** Once a year. The agency drops a model who stops working; portfolios age. */
export function tickModeling() {
  const p = player();
  const lines = [];
  const m = p.fame?.model;
  if (!m) return lines;
  if (!isModel(p) && m.agencyId) { leaveAgency(); return lines; }
  const recent = m.portfolio.filter((x) => x.year >= year() - 2);
  if (m.agencyId && m.portfolio.length && !recent.length) {
    lines.push(`${ent().orgs[m.agencyId]?.name} has let you go: no bookings in two years.`);
    leaveAgency();
  }
  if (recent.some((x) => x.kind === 'cover' || x.kind === 'campaign')) regard({ favor: 1, why: 'a face people like' }, p);
  return lines;
}

export const portfolio = (p = player()) => [...(p.fame?.model?.portfolio ?? [])].reverse();
