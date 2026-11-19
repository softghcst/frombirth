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
import { AWARD_BODIES, NOMINEES, MUSIC_AWARD, BOOK_AWARD } from '../data/fame.js';
import { act, release } from './music.js';
import { book } from './publishing.js';
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

/**
 * The music awards: judged on releases that came out that year, anywhere. A nominee is
 * an act; the player is nominated with it if they were in it when the record was made.
 */
export function holdMusicSeason(forYear) {
  const E = ent();
  const body = MUSIC_AWARD;
  const id = `${body.id}:world:${forYear}`;
  if (E.seasons[id]) return E.seasons[id];
  if (forYear < body.founded || !E.releases) return null;
  const eligible = Object.values(E.releases).filter((r) => r.released === forYear && r.critics != null && Object.values(r.units).reduce((s, n) => s + n, 0) >= 5000); // records enough people heard
  const season = { id, bodyId: body.id, scope: 'world', year: forYear, ceremony: forYear + 1, categories: {} };
  for (const [catId, name, kind] of body.categories) {
    const pool = eligible.filter((r) => (kind === 'first' ? r.first : r.type === kind)).map((r) => {
      const a = act(r.actId);
      const units = Object.values(r.units).reduce((s, n) => s + n, 0);
      const mine = a && a.members.some((m) => m.who === 'player' && m.from <= r.made && (m.to == null || m.to >= r.made));
      return { who: mine ? 'player' : (a?.members[0]?.who ?? null), name: a?.name ?? '', releaseId: r.id, productionId: null, title: r.title, idx: null, score: r.critics * 0.7 + Math.log10(units + 1) * 8 };
    });
    if (pool.length < 2) continue;
    const nominees = pool.sort((a, b) => b.score - a.score).slice(0, NOMINEES).map((n) => ({ ...n, score: Math.round(n.score) }));
    const floor = nominees[nominees.length - 1].score;
    const winner = nominees[rng.weighted(nominees.map((n, i) => ({ i, w: Math.max(1, n.score - floor + 6) })), (x) => x.w).i];
    season.categories[catId] = { name, nominees, winner: { who: winner.who, releaseId: winner.releaseId, productionId: null, idx: null } };
    for (const n of nominees) { const r = release(n.releaseId); (r.awards ??= []).push({ seasonId: id, catId, won: n === winner }); }
  }
  E.seasons[id] = season;
  return season;
}

/** The book prize, in a country: books that came out there that year, judged mostly on the reviews. */
export function holdBookSeason(countryId, forYear) {
  const E = ent();
  const body = BOOK_AWARD;
  const id = `${body.id}:${countryId}:${forYear}`;
  if (E.seasons[id]) return E.seasons[id];
  if (forYear < body.founded || !E.books) return null;
  const eligible = Object.values(E.books).filter((b) => b.released === forYear && b.countryId === countryId && b.critics != null);
  const season = { id, bodyId: body.id, scope: countryId, year: forYear, ceremony: forYear + 1, categories: {} };
  for (const [catId, name, kinds] of body.categories) {
    const pool = eligible.filter((b) => (kinds === 'first' ? b.first : kinds.includes(b.kind))).map((b) => ({ who: b.author, name: b.authorName, bookId: b.id, productionId: null, title: b.title, idx: null,
      score: b.critics + Math.log10(Object.values(b.units).reduce((s, n) => s + n, 0) + 1) * 2 }));
    if (pool.length < 2) continue;
    const nominees = pool.sort((a, b) => b.score - a.score).slice(0, NOMINEES).map((n) => ({ ...n, score: Math.round(n.score) }));
    const floor = nominees[nominees.length - 1].score;
    const winner = nominees[rng.weighted(nominees.map((n, i) => ({ i, w: Math.max(1, n.score - floor + 6) })), (x) => x.w).i];
    season.categories[catId] = { name, nominees, winner: { who: winner.who, bookId: winner.bookId, productionId: null, idx: null } };
    for (const n of nominees) { const b = book(n.bookId); if (b) { b.awards.push({ seasonId: id, catId, won: n === winner }); if (n === winner) b.keep = true; } }
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
        gain({ audience: body.medium === 'stage' ? 'theater' : body.medium, amount: won ? 10 : 4, lasting: won ? 0.9 : 0.4, abroad: body.scope === 'international' ? prod.abroad : [], reach: 0.5, why: `${won ? 'winning' : 'a nomination for'} ${cat.name}` }, p);
        regard({ credibility: won ? 8 : 3, why: cat.name }, p);
        article({ kind: won ? 'award' : 'nomination', productionId: prod.id, about: 'player', accuracy: 'verified', text });
      }
    }
  }
  const before = !!ent().seasons[`${MUSIC_AWARD.id}:world:${forYear}`];
  const ms = holdMusicSeason(forYear);
  if (ms && !before) for (const cat of Object.values(ms.categories)) {
    const mine = cat.nominees.find((n) => n.who === 'player');
    if (!mine) continue;
    const won = cat.winner.releaseId === mine.releaseId;
    const text = won ? `${mine.name} won ${cat.name} at the ${MUSIC_AWARD.name} for ${mine.title}.` : `${mine.name} was nominated for ${cat.name} at the ${MUSIC_AWARD.name} for ${mine.title}.`;
    lines.push(text);
    milestone(text, 'fame');
    gain({ audience: 'music', amount: won ? 10 : 4, lasting: won ? 0.9 : 0.4, reach: 0.5, why: `${won ? 'winning' : 'a nomination for'} ${cat.name}` }, p);
    regard({ credibility: won ? 8 : 3, why: cat.name }, p);
    article({ kind: won ? 'award' : 'nomination', about: 'player', accuracy: 'verified', text });
  }
  const bkey = `${BOOK_AWARD.id}:${p.countryId}:${forYear}`;
  const bBefore = !!ent().seasons[bkey];
  const bs = holdBookSeason(p.countryId, forYear);
  if (bs && !bBefore) for (const cat of Object.values(bs.categories)) {
    const mine = cat.nominees.find((n) => n.who === 'player');
    if (!mine) continue;
    const won = cat.winner.bookId === mine.bookId;
    const text = won ? `${mine.title} won the ${BOOK_AWARD.name} for ${cat.name}.` : `${mine.title} was shortlisted for the ${BOOK_AWARD.name} for ${cat.name}.`;
    lines.push(text);
    milestone(text, 'fame');
    gain({ audience: 'literary', amount: won ? 12 : 5, lasting: won ? 0.9 : 0.4, reach: 0.5, why: `${won ? 'winning' : 'a shortlisting for'} the ${BOOK_AWARD.name}` }, p);
    regard({ credibility: won ? 10 : 4, why: BOOK_AWARD.name }, p);
    article({ kind: won ? 'award' : 'nomination', about: 'player', accuracy: 'verified', text });
  }
  forget(p);
  return lines;
}

/** Old ceremonies are forgotten unless the family was in them: the player, or anyone on the family record. */
function forget(p) {
  const E = ent();
  const family = new Set(['player', ...(store.state.careerRecord ?? []).map((r) => r.npcId).filter(Boolean),
    ...p.npcIds.filter((id) => ['parent', 'grandparent', 'child', 'grandchild', 'spouse', 'sibling'].includes(store.state.npcs[id]?.role))]);
  for (const [id, s] of Object.entries(E.seasons)) {
    if (s.year >= year() - 6) continue;
    if (Object.values(s.categories).some((c) => c.nominees.some((n) => family.has(n.who)))) continue;
    delete E.seasons[id];
  }
}

/** Every nomination and win the player has had, newest first. */
export function myAwards(p = player()) {
  const out = [];
  for (const s of Object.values(ent().seasons)) for (const [catId, cat] of Object.entries(s.categories)) {
    const n = cat.nominees.find((x) => x.who === 'player');
    if (n) out.push({ season: s, catId, cat, productionId: n.productionId, releaseId: n.releaseId ?? null, bookId: n.bookId ?? null, title: n.title, won: n.releaseId ? cat.winner.releaseId === n.releaseId : n.bookId ? cat.winner.bookId === n.bookId : cat.winner.who === 'player', body: [...AWARD_BODIES, MUSIC_AWARD, BOOK_AWARD].find((b) => b.id === s.bodyId) });
  }
  return out.sort((a, b) => b.season.year - a.season.year);
}
