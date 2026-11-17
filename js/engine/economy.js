// The world moves without the player: economies turn, crises begin and end,
// the news reports it, and people the player knows move away and come back.
//
// What changes is kept in the save (state.world) and never written back to
// the reference data. data/living.js reads crisis and inflation through
// the hook installed here, so every part of the game sees the same world.
import { rng } from '../rng.js';
import { clamp, theCountry } from '../util.js';
import { store, player, livingNpcs, log } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { LIVING, BASE_LIVING, dynamic } from '../data/living.js';
import { SPOKEN } from '../data/skills.js';
import { FREE_MOVEMENT } from '../data/immigration.js';
import { PHASES, TURN, WORLD_DOWNTURN, CRISIS_END, CRISIS_START, CRISIS_FX, MOVES, ROOTS, NEWS_MAX } from '../data/economy.js';
import { SINGLE } from '../data/citizenship.js';
import { surnameFor } from '../data/countries.js';

const world = () => (store.state.world ??= { places: {}, news: [] });
const entry = (id) => (world().places[id] ??= { phase: 'steady', since: store.state.year });
const The = (id) => theCountry(COUNTRIES[id].name).replace(/^the/, 'The');
const the = (id) => theCountry(COUNTRIES[id].name);

// data/living.js asks here what has changed in this life.
dynamic.read = (id, key) => {
  const e = store.state?.world?.places?.[id];
  return e && key in e ? e[key] : undefined;
};

/** How a country's economy is doing: 'boom' | 'steady' | 'slump'. */
export const phaseOf = (id = player().countryId) => store.state?.world?.places?.[id]?.phase ?? 'steady';
export const phase = (id) => PHASES[phaseOf(id)];
/** What the economy does to the odds of being hired, and of being laid off, where the player lives. */
export const hiringClimate = () => phase().hiring;
export const layoffChance = () => phase().layoff;
/** What it adds to this year's move in house prices. */
export const housingDrift = () => phase().housing;
/** The same, for any country. */
export const housingDriftIn = (id) => PHASES[phaseOf(id)].housing;
/** Where a currency is being pulled, as an offset from its usual rate: weaker in a slump or a crisis. */
export function fxBias(code) {
  if (!store.state?.world) return 0;
  const users = COUNTRY_LIST.filter((c) => c.currency.code === code);
  const home = users.find((c) => !c.place?.parentId) ?? users[0];
  if (!home) return 0;
  return PHASES[phaseOf(home.id)].fx + (CRISIS_FX[LIVING[home.id].crisis] ?? 0) - (CRISIS_FX[BASE_LIVING[home.id].crisis] ?? 0);
}

// ---------- News ----------

/** Places the player has a reason to care about. */
export function ties(p = player()) {
  const out = new Set([p.countryId, p.birthCountryId]);
  for (const c of p.citizenships ?? []) if (!c.lostAt && COUNTRIES[c.jurisdictionId]) out.add(c.jurisdictionId);
  for (const n of livingNpcs()) if (typeof n.flags.abroad === 'string' && COUNTRIES[n.flags.abroad] && n.role !== 'ex') out.add(n.flags.abroad);
  for (const a of p.assets) if (a.kind === 'property' && a.countryId) out.add(a.countryId);
  return out;
}

/** Records something that happened in the world. The player hears of it if it is somewhere that matters to them. */
export function post(placeId, kind, text, tone = 'neutral', journal = true) {
  const w = world();
  w.news.push({ year: store.state.year, placeId, kind, text });
  if (w.news.length > NEWS_MAX) w.news.shift();
  // Children do not follow the news, and not everything is worth a line in a life.
  if (journal && player().age >= 12 && (placeId == null || ties().has(placeId))) log(text, 'system', tone);
}

/** The news, newest first, with what touches the player marked. */
export function news(limit = 40) {
  const mine = ties();
  return [...(store.state.world?.news ?? [])].reverse().slice(0, limit).map((n) => ({ ...n, yours: n.placeId == null || mine.has(n.placeId),
    flag: n.placeId ? COUNTRIES[n.placeId]?.flag ?? '' : '🌍' }));
}

/** How things stand where the player lives, in a sentence. */
export function outlook(id = player().countryId) {
  const e = store.state.world?.places?.[id];
  const ph = PHASES[e?.phase ?? 'steady'];
  return { phase: e?.phase ?? 'steady', name: ph.name, since: e?.since ?? null,
    line: { boom: 'Work is easy to find and house prices are rising.', steady: 'Neither boom nor bust.', slump: 'Jobs are scarce, layoffs are common and house prices are falling.' }[e?.phase ?? 'steady'] };
}

// ---------- The year ----------

function turn(id, to, quiet) {
  const e = entry(id);
  if (e.phase === to) return;
  e.phase = to;
  e.since = store.state.year;
  // Every turn everywhere would bury the rest of the news: report the ones that touch the player, and a few others.
  if (!quiet && (ties().has(id) || rng.chance(0.05))) post(id, 'economy', `${The(id)}: ${PHASES[to].start.charAt(0).toLowerCase()}${PHASES[to].start.slice(1)}`, to === 'slump' ? 'bad' : to === 'boom' ? 'good' : 'neutral', to !== 'steady');
}

/** Yearly: economies turn, crises begin and end. */
export function tickEconomy() {
  const year = store.state.year;
  // Now and then trouble crosses every border at once.
  if (rng.chance(WORLD_DOWNTURN.chance)) {
    let n = 0;
    for (const c of COUNTRY_LIST) if (phaseOf(c.id) !== 'slump' && rng.chance(WORLD_DOWNTURN.share)) { turn(c.id, 'slump', true); n += 1; }
    post(null, 'economy', `A financial crisis has spread around the world. ${n} economies are in recession${phaseOf() === 'slump' ? `, ${the(player().countryId)} among them` : ''}.`, 'bad');
    return;
  }
  for (const c of COUNTRY_LIST) {
    const now = phaseOf(c.id);
    const settled = year - (store.state.world?.places?.[c.id]?.since ?? -99) >= 2; // nothing turns twice in two years
    const roll = rng.next();
    let acc = 0;
    for (const [to, chance] of Object.entries(TURN[now])) {
      // A country in crisis does not boom, and falls more easily.
      const k = LIVING[c.id].crisis ? (to === 'boom' ? 0 : to === 'slump' ? 1.5 : 0.7) : 1;
      acc += chance * k;
      if (settled && roll < acc) { turn(c.id, to); break; }
    }
    // Crises.
    const L = LIVING[c.id];
    const e = world().places[c.id];
    if (L.crisis) {
      const [chance, line] = CRISIS_END[L.crisis] ?? [0, ''];
      const began = e?.crisisSince ?? year - 5;
      if (year - began >= 2 && rng.chance(chance)) {
        const was = L.crisis;
        Object.assign(entry(c.id), { crisis: null, crisisSince: null });
        // Runaway prices calm down, though not all the way at once.
        if (was === 'inflation' || was === 'collapse') entry(c.id).inflation = BASE_LIVING[c.id].inflation === 'extreme' ? 'high' : BASE_LIVING[c.id].inflation;
        post(c.id, 'crisis', line.replace('{place}', the(c.id)), 'good');
      }
    } else if (L.stability < CRISIS_START.below && rng.chance(CRISIS_START.chance)) {
      const kind = rng.pick(Object.keys(CRISIS_START.kinds));
      Object.assign(entry(c.id), { crisis: kind, crisisSince: year });
      if (kind === 'inflation') entry(c.id).inflation = 'extreme';
      turn(c.id, 'slump', true);
      post(c.id, 'crisis', CRISIS_START.kinds[kind].replace('{place}', the(c.id)), 'bad');
    }
  }
}

// ---------- People who move ----------

/** Where someone leaving a country would go: better pay, a language they share, a border they may cross freely. */
function destinationFor(fromId) {
  const tongues = Object.entries(SPOKEN).filter(([, ids]) => ids.includes(fromId)).flatMap(([, ids]) => ids);
  const area = FREE_MOVEMENT.find((a) => a.members.includes(fromId));
  const options = COUNTRY_LIST.filter((c) => c.id !== fromId && !LIVING[c.id].crisis && LIVING[c.id].wage >= LIVING[fromId].wage * 0.8);
  if (!options.length) return null;
  const weights = options.map((c) => LIVING[c.id].wage * (tongues.includes(c.id) ? 3 : 1) * (area?.members.includes(c.id) ? 2.5 : 1) * (phaseOf(c.id) === 'boom' ? 1.5 : phaseOf(c.id) === 'slump' ? 0.5 : 1));
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) { roll -= weights[i]; if (roll <= 0) return options[i].id; }
  return options[options.length - 1].id;
}

/**
 * Yearly: brothers, sisters, friends and grown children have lives of
 * their own. Some move abroad; some of those abroad come back, or come to
 * where the player is.
 */
export function tickMoves() {
  const p = player();
  const here = p.countryId;
  for (const n of livingNpcs()) {
    if (!MOVES.roles.includes(n.role) || n.age < MOVES.ages[0] || n.age > MOVES.ages[1] || n.flags.royal || n.flags.inPrison) continue;
    const where = typeof n.flags.abroad === 'string' && COUNTRIES[n.flags.abroad] ? n.flags.abroad : here;
    const who = `${n.role === 'friend' ? 'Your friend' : n.role === 'sibling' ? `Your ${n.gender === 'male' ? 'brother' : n.gender === 'female' ? 'sister' : 'sibling'}` : n.role === 'child' ? `Your ${n.gender === 'male' ? 'son' : n.gender === 'female' ? 'daughter' : 'child'}` : 'Your grandchild'} ${n.firstName}`;
    if (where === here) {
      // Children still at home, and anyone studying, stay put.
      if ((n.role === 'child' && n.age < 22) || n.life?.edu?.yearsLeft > 0) continue;
      const k = (LIVING[here].crisis ? MOVES.crisisK : 1) * (phaseOf(here) === 'slump' ? MOVES.slumpK : 1) * (n.life?.partnerId || n.life?.kids ? 0.5 : 1);
      if (!rng.chance(MOVES.leave * k)) continue;
      const to = destinationFor(here);
      if (!to) continue;
      n.flags.abroad = to;
      n.flags.movedYear = store.state.year;
      if (n.life?.job) n.life.job.salary = Math.round(n.life.job.salary * LIVING[to].wage / LIVING[here].wage); // still counted in the player's money
      log(`${who} has moved to ${the(to)}${LIVING[here].crisis ? ', to get away from what is happening here' : n.life?.job ? ' for work' : ''}. You can fly out to see them.`, 'system', 'neutral');
    } else if (n.meters.relationship >= 70 && rng.chance(MOVES.joinYou)) {
      n.flags.abroad = false;
      n.meters.relationship = clamp(n.meters.relationship + 6);
      log(`${who} has moved to ${the(here)}, to be nearer to you.`, 'system', 'good');
    } else if (n.flags.movedYear != null && rng.chance(MOVES.comeBack * (LIVING[where].crisis ? 3 : 1))) {
      // Home, for them, is where they left from; it is only "back" if the player is still there.
      const home = n.bornIn && COUNTRIES[n.bornIn] ? n.bornIn : here;
      if (home === here) { n.flags.abroad = false; log(`${who} has come home from ${the(where)}.`, 'system', 'good'); } else if (home !== where) { n.flags.abroad = home; }
      delete n.flags.movedYear;
    }
  }
}

// ---------- Roots somewhere else ----------

const pickName = (id, gender) => { const names = COUNTRIES[id].names; return rng.pick(names[gender] ?? names.female); };

/**
 * Makes someone a person who grew up in another country: their name, where
 * they were born, and the citizenship they hold. If `settled`, they have
 * also taken the citizenship of the country they live in, where both allow it.
 * @returns {string} the id of the country they are from
 */
export function fromAbroad(n, hereId, { settled = false, keepSurname = false, year = store.state?.year ?? 0 } = {}) {
  const from = rng.pick(COUNTRY_LIST.filter((c) => c.id !== hereId && (c.place?.nationalityOf ?? c.id) !== (COUNTRIES[hereId].place?.nationalityOf ?? hereId))).id;
  const issuerOf = (id) => COUNTRIES[id].place?.nationalityOf ?? id;
  n.bornIn = from;
  n.firstName = pickName(from, n.gender);
  if (!keepSurname) n.lastName = surnameFor(from, rng.pick(COUNTRIES[from].names.last), n.gender);
  n.flags.from = from;
  n.citizenships = [{ jurisdictionId: issuerOf(from), acquisitionType: 'birth', acquiredAt: year - n.age }];
  // Someone long settled has usually naturalised, unless either country allows only one nationality.
  if (settled && !SINGLE.has(issuerOf(from)) && !SINGLE.has(issuerOf(hereId))) n.citizenships.push({ jurisdictionId: issuerOf(hereId), acquisitionType: 'naturalisation', acquiredAt: year - Math.min(10, Math.max(1, n.age - 20)) });
  return from;
}
/** Whether a newly made family, or someone newly met, has roots abroad. */
export const rollsRoots = (kind) => rng.chance(ROOTS[kind]);

/**
 * Yearly, for a child: now and then the family emigrates, far more often
 * from a country in crisis. Returns where to, or null.
 */
export function familyLeaves() {
  const p = player();
  if (p.age < 2 || p.age >= 17 || p.royal || p.legal.incarceration) return null;
  const parents = livingNpcs().filter((n) => n.role === 'parent' && !n.flags.abroad);
  if (!parents.length) return null;
  if (!rng.chance(ROOTS.familyLeaves * (LIVING[p.countryId].crisis ? ROOTS.familyLeavesCrisisK : 1))) return null;
  // A parent who came from somewhere may go back; otherwise wherever a family like theirs would go.
  const back = parents.map((n) => n.bornIn).find((id) => id && id !== p.countryId && COUNTRIES[id] && !LIVING[id].crisis);
  return back && rng.chance(0.5) ? back : destinationFor(p.countryId);
}
