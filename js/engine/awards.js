// Awards. Each award body (data/fame.js AWARD_BODIES) holds one season a year
// for each place it covers: it looks at what was released or opened that year,
// nominates the best, and chooses a winner, once. The season is stored and never
// decided again; a nomination stays on the record whether or not it won.
//
//   state.ent.seasons['bodyId:scope:year'] = { id, bodyId, scope, year, ceremony, categories: { catId: { name, nominees:[Nominee], winner } } }
//   Nominee: { who: npcId|'player'|null, productionId, idx|null, score }
//   production.awards: [{ seasonId, catId, won }]
import { rng } from '../rng.js';
import { store, player, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { AWARD_BODIES, NOMINEES } from '../data/fame.js';
import { ent, production, article } from './entertainment.js';
import { gain, regard } from './fame.js';

const year = () => store.state.year;

/** The name a body goes by where it is held. */
export const bodyName = (body, scope) => (body.scope === 'national' ? `${body.name} (${COUNTRIES[scope]?.name ?? scope})` : body.name);

/**
 * Holds a body's season for a year, if it has not been held. The work judged is what
 * was released or opened that year. @returns {?object} the season
 */
export function holdSeason(body, scope, forYear) {
  const E = ent();
  const id = `${body.id}:${scope}:${forYear}`;
  if (E.seasons[id]) return E.seasons[id]; // decided once, kept
  if (forYear < body.founded) return null;
  const eligible = Object.values(E.productions).filter((p) => p.reception?.year === forYear && (body.scope === 'international' || p.countryId === scope));
  const season = { id, bodyId: body.id, scope, year: forYear, ceremony: forYear + 1, categories: {} };
  for (const [catId, name, kinds, roleKinds, tiers] of body.categories) {
    const pool = [];
    for (const p of eligible) {
      if (!kinds.includes(p.kind) || !tiers.includes(p.tier)) continue;
      // Names are kept with the nomination, so the archive reads true even after a production is forgotten.
      const name = (who) => (who === 'player' ? `${player().firstName} ${player().lastName}` : who ? `${store.state.npcs[who]?.firstName ?? ''} ${store.state.npcs[who]?.lastName ?? ''}`.trim() : null);
      if (roleKinds === 'production') pool.push({ who: null, name: null, productionId: p.id, title: p.title, idx: null, score: p.reception.critics + p.reception.audience * 0.15 });
      else for (const r of p.cast) if (r.who && roleKinds.includes(r.kind) && r.score != null) pool.push({ who: r.who, name: name(r.who), productionId: p.id, title: p.title, idx: r.idx, score: r.score + p.reception.critics * 0.2 });
    }
    if (pool.length < 2) continue;
    const nominees = pool.sort((a, b) => b.score - a.score).slice(0, NOMINEES).map((n) => ({ ...n, score: Math.round(n.score) }));
    // The winner: usually the strongest, not always; voters are people.
    const floor = nominees[nominees.length - 1].score;
    const winner = nominees[rng.weighted(nominees.map((n, i) => ({ i, w: Math.max(1, n.score - floor + 6) })), (x) => x.w).i];
    season.categories[catId] = { name, nominees, winner: { who: winner.who, productionId: winner.productionId, idx: winner.idx } };
    for (const n of nominees) {
      const prod = production(n.productionId);
      prod.awards.push({ seasonId: id, catId, won: n === winner }); // a winning production is kept; a nominee's name and title live on in the season
    }
  }
  E.seasons[id] = season;
  return season;
}

/** Once a year: every body that exists holds its season for last year's work. @returns {string[]} */
export function tickAwards() {
  const p = player();
  const lines = [];
  const forYear = year() - 1;
  const scopes = new Set([p.countryId, ...Object.values(ent().productions).map((x) => x.countryId)]);
  for (const body of AWARD_BODIES) {
    const places = body.scope === 'international' ? ['world'] : [...scopes];
    for (const scope of places) {
      const before = !!ent().seasons[`${body.id}:${scope}:${forYear}`];
      const s = holdSeason(body, scope, forYear);
      if (!s || before) continue;
      for (const [catId, cat] of Object.entries(s.categories)) {
        const mine = cat.nominees.find((n) => n.who === 'player');
        if (!mine) continue;
        const prod = production(mine.productionId);
        const won = cat.winner.who === 'player';
        const text = won ? `You won ${cat.name} at the ${bodyName(body, scope)} for ${prod.title}.` : `You were nominated for ${cat.name} at the ${bodyName(body, scope)} for ${prod.title}.`;
        lines.push(text);
        milestone(won ? `Won ${cat.name}, ${bodyName(body, scope)}, for ${prod.title}.` : `Nominated for ${cat.name}, ${bodyName(body, scope)}, for ${prod.title}.`, 'fame');
        gain({ audience: body.medium === 'stage' ? 'theatre' : body.medium, amount: won ? 10 : 4, lasting: won ? 0.9 : 0.4, abroad: body.scope === 'international' ? prod.abroad : [], reach: 0.5, why: `${won ? 'winning' : 'a nomination for'} ${cat.name}` }, p);
        regard({ credibility: won ? 8 : 3, why: cat.name }, p);
        article({ kind: won ? 'award' : 'nomination', productionId: prod.id, about: 'player', accuracy: 'verified', text });
      }
    }
  }
  return lines;
}

/** Every nomination and win the player has had, newest first. */
export function myAwards(p = player()) {
  const out = [];
  for (const s of Object.values(ent().seasons)) for (const [catId, cat] of Object.entries(s.categories)) {
    const n = cat.nominees.find((x) => x.who === 'player');
    if (n) out.push({ season: s, catId, cat, productionId: n.productionId, won: cat.winner.who === 'player', body: AWARD_BODIES.find((b) => b.id === s.bodyId) });
  }
  return out.sort((a, b) => b.season.year - a.season.year);
}
