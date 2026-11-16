// Reigning, and the fate of the monarchy itself.
//
// What a monarch may do depends on the kind of monarchy (data/royalty.js
// `type`, or d.type once a ruler has given powers away):
//   'ceremonial' / 'constitutional'  the crown advises, encourages and warns;
//       using more than that is a constitutional crisis
//   'executive' / 'absolute'         the crown governs, and answers for it
//
// d.standing (0–100) is the country's support for having a monarchy at all.
// A reigning player's own approval feeds it, and so do their acts. If it
// stays low the question is put to the country, and the monarchy can be
// abolished: d.status = 'abolished'. The family lives on as private people,
// the head of the house is whoever would have reigned, and now and then a
// country asks its royal house back.
import { rng } from '../rng.js';
import { clamp, theCountry } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { MONARCHIES, POWERS, POWERS_PER_YEAR } from '../data/royalty.js';
import * as dyn from './dynasty.js';
import * as fame from './reputation.js';
import { destinations, emigrate } from './emigration.js';
import { counsel } from './household.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const typeOf = (d) => d.type ?? MONARCHIES[d.countryId].type;
export const governs = (d) => ['executive', 'absolute'].includes(typeOf(d));
export const abolished = (d) => d?.status === 'abolished';
const TYPE_WORDS = { ceremonial: 'a ceremonial monarchy: the crown has no part in government', constitutional: 'a constitutional monarchy: the crown advises, and parliament governs',
  executive: 'an executive monarchy: the crown governs alongside an elected parliament', absolute: 'an absolute monarchy: the crown governs' };
export const typeWords = (d) => TYPE_WORDS[typeOf(d)];

/** Moves the country's support for the monarchy. */
export function shiftSupport(delta, d = dyn.house(player().royal?.countryId ?? country().id)) {
  if (!d) return;
  // Devotion is hard to add to: the more a country already loves its crown, the less each good deed moves it.
  const step = delta > 0 ? Math.max(1, Math.round(delta * Math.min(1, (100 - d.standing) / 45))) : delta;
  d.standing = Math.round(clamp(d.standing + step));
}
export const supportWord = (d) => (d.standing >= 70 ? 'The country is devoted to the crown' : d.standing >= 50 ? 'Most of the country is content to have a monarchy'
  : d.standing >= 33 ? 'The country is divided about the monarchy' : 'Most of the country would rather be a republic');

// ---------- Affairs of state ----------

function acts() {
  const p = player();
  if (p.flags.stateActs?.age !== p.age) p.flags.stateActs = { age: p.age, done: 0 };
  return p.flags.stateActs;
}
export const powersLeft = () => POWERS_PER_YEAR - acts().done;
export const canGovern = () => !!player().royal?.reigning && player().age >= 18 && !player().legal.incarceration;
/** What a reigning player may do this year, for the kind of monarchy they reign over. */
export function powerOptions() {
  const d = dyn.house(player().royal.countryId);
  const kind = governs(d) ? 'rule' : 'advise';
  return POWERS.filter((x) => x.kind === kind).map((x) => ({ id: x.id, name: x.name, note: x.note, risky: !!x.risky }));
}

export function usePower(id) {
  const p = player();
  if (!canGovern()) return result(false, 'That is not in your power.', 'neutral');
  if (powersLeft() <= 0) return result(false, 'The red boxes are done for the year.', 'neutral');
  const d = dyn.house(p.royal.countryId);
  const x = POWERS.find((q) => q.id === id && q.kind === (governs(d) ? 'rule' : 'advise'));
  if (!x) return result(false, 'That is not in your power.', 'neutral');
  acts().done += 1;
  // Some acts can go either way, on the monarch's own qualities.
  let good = true;
  if (x.risky) good = rng.chance(clamp(x.risky.base + (p.stats[x.risky.stat] - 50) / 120 + (p.royal.image - 50) / 200 + counsel(), 0.08, 0.92));
  const o = good ? x : { ...x, ...x.fail };
  if (o.support) shiftSupport(o.support, d);
  if (o.image) fame.shift('image', o.image, x.name.toLowerCase());
  if (o.family) fame.shift('family', o.family, x.name.toLowerCase());
  if (o.press) fame.shift('press', o.press, x.name.toLowerCase());
  if (o.karma) p.hidden.karma = clamp(p.hidden.karma + o.karma);
  if (o.mood) p.stats.mood = clamp(p.stats.mood + o.mood);
  if (good && x.gives) {
    // Power handed over is not handed back.
    d.type = x.gives;
    dyn.chronicle(d, `${dyn.nameOf(d, dyn.playerPerson(d))} gave the elected parliament the power to govern.`, [dyn.playerPerson(d).id]);
    milestone('Gave up the power to govern, and kept the throne.', 'fame');
  } else if (good && x.chronicle) dyn.chronicle(d, `${dyn.nameOf(d, dyn.playerPerson(d))} ${x.chronicle}.`, [dyn.playerPerson(d).id]);
  const tone = (o.support ?? 0) + (o.image ?? 0) >= 0 ? 'good' : 'bad';
  log(o.text, 'system', tone);
  return result(tone === 'good', o.text, tone);
}

// ---------- The end of a monarchy, and after ----------

/** The monarchy is abolished. The family become private people; the house and its history remain. */
export function abolish(d = dyn.house(player().royal?.countryId ?? country().id)) {
  if (!d || abolished(d)) return;
  const p = player();
  const year = store.state.year;
  const last = dyn.monarchOf(d);
  const name = dyn.nameOf(d, last);
  const reign = d.reigns.find((r) => r.to == null);
  if (reign) reign.to = year;
  d.status = 'abolished';
  d.abolishedYear = year;
  dyn.chronicle(d, `The monarchy was abolished. ${name} was the last to reign, and ${theCountry(COUNTRIES[d.countryId].name)} became a republic.`, [last.id]);
  const mine = p.royal && ['monarch', 'heir', 'royal'].includes(p.royal.rank) && p.royal.countryId === d.countryId;
  if (mine) {
    p.flags.formerRoyal = { countryId: d.countryId, year, was: p.royal.reigning ? 'monarch' : p.royal.by };
    delete p.royal;
    p.flags.lostTitle = true;
    p.stats.mood = clamp(p.stats.mood - 20);
    milestone(`Saw the monarchy of ${theCountry(COUNTRIES[d.countryId].name)} abolished.`, 'life');
    store.state.pendingEvents.push({ id: 'after_the_crown', cast: {} });
  }
  // The people the player knows lose their titles with everyone else.
  for (const x of Object.values(d.people)) {
    const npc = x.npcId ? store.state.npcs[x.npcId] : null;
    if (npc) { delete npc.flags.royal; if (npc.alive && /royal|monarch|heir to|consort/.test(npc.occupation ?? '')) npc.occupation = 'former royal'; }
  }
}

/** The country asks its royal house back. The head of the house reigns. */
export function restore(d = dyn.house(player().flags.formerRoyal?.countryId ?? country().id)) {
  if (!d || !abolished(d)) return '';
  const p = player();
  const year = store.state.year;
  delete d.status;
  d.standing = Math.max(d.standing, 58);
  d.reigns.push({ id: d.monarchId, from: year, to: null });
  const head = dyn.monarchOf(d);
  dyn.chronicle(d, `The monarchy was restored after ${year - d.abolishedYear} years, and ${dyn.nameOf(d, head)} took the throne.`, [head.id]);
  const me = dyn.playerPerson(d);
  if (head.isPlayer && p.countryId !== d.countryId) { emigrate(d.countryId, { forced: true }); delete p.flags.exile; }
  if (me && me.blood && !me.out && p.countryId === d.countryId) {
    p.royal = { countryId: d.countryId, rank: 'royal', by: 'birth', line: null, image: 62, reigning: false };
    delete p.flags.formerRoyal;
  }
  return dyn.nameOf(d, head);
}

/** Leaving for good, with what can be carried: the visa is waved through, as it is for the fallen. */
export function goIntoExile() {
  const options = destinations().filter((x) => (x.living?.stability ?? 0) >= 60);
  const to = rng.pick(options.length ? options : destinations());
  const r = emigrate(to.id, { forced: true });
  if (r.ok) { player().flags.exile = { since: store.state.year, from: player().flags.formerRoyal?.countryId }; milestone(`Went into exile in ${theCountry(to.name)}.`, 'life'); }
  return r;
}

/**
 * Yearly, for the house of the country the player lives in (or once reigned in).
 * Returns nothing; queues scenes and writes to the journal as needed.
 */
export function tickReign(d) {
  const p = player();
  const year = store.state.year;
  const pend = store.state.pendingEvents;
  const inFamily = !!p.royal && ['monarch', 'heir', 'royal'].includes(p.royal.rank) && p.royal.countryId === d.countryId;

  if (abolished(d)) {
    // A republic that is going badly remembers its kings.
    const c = COUNTRIES[d.countryId];
    const longing = clamp((62 - (c.living?.stability ?? 70)) / 400 + (year - d.abolishedYear > 12 ? 0.012 : 0), 0.004, 0.08);
    if (year - d.abolishedYear < 6 || !rng.chance(longing)) return;
    const head = dyn.monarchOf(d);
    if (head.isPlayer) { if (p.age >= 16) pend.push({ id: 'restoration_offer', cast: {} }); return; }
    const who = restore(d);
    if (p.countryId === d.countryId && p.age >= 8) log(`After ${year - d.abolishedYear} years as a republic, the country has voted to bring back the monarchy. ${who} is on the throne.`, 'system', 'neutral');
    return;
  }

  // Left alone, feeling about the crown settles back towards the middle.
  d.standing = Math.round(d.standing + (55 - d.standing) * 0.07);
  // What the monarch is like shows in how the country feels about the crown.
  const monarch = dyn.monarchOf(d);
  if (monarch.isPlayer && p.royal?.reigning) {
    shiftSupport(Math.round((p.royal.image - 52) / 12), d);
    const done = p.flags.stateActs?.age === p.age - 1 ? p.flags.stateActs.done : 0;
    if (governs(d) && !done && p.age >= 18) { shiftSupport(-3, d); log('You left the business of government untouched all year. Things drifted.', 'system', 'bad'); }
  } else {
    shiftSupport(Math.round((monarch.t.charisma - 50) / 40 + rng.int(-1, 1)), d);
  }

  // The question of a republic.
  if (d.standing >= 27) { d.doubt = 0; return; }
  d.doubt = (d.doubt ?? 0) + 1;
  if (d.doubt < 2 || d.referendumYear === year) return;
  d.referendumYear = year;
  if (inFamily && p.age >= 16) { pend.push({ id: p.royal.reigning ? 'referendum_crown' : 'referendum_family', cast: {} }); return; }
  // Nobody the player is can sway it: the country decides.
  if (rng.chance(0.55)) {
    abolish(d);
    if (p.countryId === d.countryId && p.age >= 8) log(`The country has voted to abolish the monarchy. ${theCountry(c0(d)).replace(/^the/, 'The')} is a republic.`, 'system', 'neutral');
  } else {
    d.standing = 40; d.doubt = 0;
    if (p.countryId === d.countryId && p.age >= 8) log('A referendum on the monarchy was held. The crown survived it, narrowly.', 'system', 'neutral');
  }
}
const c0 = (d) => COUNTRIES[d.countryId].name;

/** How a referendum the player has campaigned in comes out. `push` is what their campaign added. */
export function referendum(push = 0) {
  const p = player();
  const d = dyn.house(p.royal?.countryId ?? country().id);
  const lean = d.standing + push + rng.int(-8, 8);
  const share = Math.round(clamp(50 + (lean - 34) * 0.9, 18, 82));
  if (share > 50) {
    d.standing = Math.max(d.standing, 42); d.doubt = 0;
    dyn.chronicle(d, `A referendum on the monarchy was held. ${share}% voted to keep it.`, []);
    return `${share}% vote to keep the monarchy. It is not love, but it is a mandate.`;
  }
  abolish(d);
  return `${100 - share}% vote for a republic. The monarchy is abolished.`;
}
