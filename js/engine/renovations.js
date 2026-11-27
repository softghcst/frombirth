// Renovations to a home the player owns: what fits, who does the work, and how well (data/renovations.js).
//
//   asset.renovations = [{ id, year, by, tier, result: 'great'|'good'|'poor', k }]
//
// `k` is what the work added to the home's worth (a share, folded into its quality), so taking it out again takes
// exactly that away. Owned homes only, apartments included; a rented home is the landlord's to change.
import { store, player, country, log, milestone } from '../state.js';
import { fmtMoney, localMoney } from '../util.js';
import { rng } from '../rng.js';
import { keyedDice } from './keyedDice.js';
import { book } from './ledger.js';
import { properties, revalue, placeOf } from './realEstate.js';
import { RENOVATIONS, RENOVATION_BY_ID, SPACE, CONTRACTOR_TIERS, REMOVE_COST, COMFORT_CAP } from '../data/renovations.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const assetOf = (id) => properties().find((a) => a.id === id) ?? null;
export const renovationsOf = (a) => (a.renovations ??= []);
/** A renovation's description, by id. */
export const info = (id) => RENOVATION_BY_ID[id];
const has = (a, id) => renovationsOf(a).some((r) => r.id === id);

/** How many renovations the home has room for: its kind, and one more for each extension built on. */
export const spaceOf = (a) => (SPACE[a.catalogId] ?? 2) + renovationsOf(a).filter((r) => RENOVATION_BY_ID[r.id]?.space === -1).length;
/** How many it has. An extension takes no room of its own: it is the room. */
export const usedOf = (a) => renovationsOf(a).filter((r) => RENOVATION_BY_ID[r.id]?.space !== -1).length;

/** Whether a renovation exists in this year at all. */
const inEra = (r, year = store.state.year) => (!r.from || year >= r.from) && (!r.until || year <= r.until);

/** Every renovation the game knows, for this home: whether it can be added, and if not, why not. Only the ones of this era are listed. */
export function options(a) {
  const room = spaceOf(a) - usedOf(a);
  return RENOVATIONS.filter((r) => inEra(r)).map((r) => {
    let why = '';
    if (!r.fits.includes(a.catalogId)) why = 'There is no room for it in a home like this.';
    else if (has(a, r.id)) why = 'Already done.';
    else if (r.space !== -1 && room <= 0) why = `No space left: this home has room for ${spaceOf(a)}.`;
    return { r, ok: !why, why };
  });
}
/** Only what would really fit this home (the rest is not offered at all). */
export const fitting = (a) => options(a).filter((x) => x.r.fits.includes(a.catalogId));

/** The firms that work where the home is: one of each kind, by their own names, the same every time. */
export function contractors(a) {
  const city = a.city ?? player().city;
  const d = keyedDice(`contractors/${a.countryId ?? player().countryId}/${city}`);
  return CONTRACTOR_TIERS.map((t) => ({ id: t.id, name: d.pick(t.names), stars: Math.round((t.stars[0] + d.next() * (t.stars[1] - t.stars[0])) * 10) / 10, price: t.price, odds: t.odds, say: t.say }));
}

/** What the work costs with this contractor, in everyday money. */
export function quote(a, renoId, tierId = 'solid') {
  const r = RENOVATION_BY_ID[renoId];
  const t = CONTRACTOR_TIERS.find((x) => x.id === tierId) ?? CONTRACTOR_TIERS[1];
  const floor = localMoney(r.min, placeOf(a));
  return Math.round(Math.max(a.value * r.cost, floor) * t.price);
}

/** How the work turns out, on this contractor's odds. A poor job runs over budget or is shoddy. */
function roll(t) {
  const x = rng.next();
  if (x < t.odds.great) return 'great';
  if (x < t.odds.great + t.odds.good) return 'good';
  return 'poor';
}
/**
 * What the work adds to the home's worth: more for great work, little for shoddy. Never as much as was paid for it
 * (at most 90%), however cheap the firm or lucky the job, so renovating is never a way to make money.
 */
const valueFor = (r, how, paid, worth) => Math.min(how === 'great' ? r.value * 1.3 : how === 'good' ? r.value : r.value * 0.3, worth > 0 ? 0.9 * paid / worth : 0);
function setK(a, entry, k) {
  a.quality = a.quality / (1 + (entry.k ?? 0)) * (1 + k);
  entry.k = k;
  revalue(a);
}

/** Adds a renovation, now: paid, done, and how well depends on who did it. */
export function addRenovation(assetId, renoId, tierId) {
  const p = player();
  const c = country();
  const a = assetOf(assetId);
  if (!a) return result(false, 'You do not own that home.', 'neutral');
  const opt = options(a).find((x) => x.r.id === renoId);
  if (!opt) return result(false, 'That is not something you can do to this home now.', 'neutral');
  if (!opt.ok) return result(false, opt.why, 'neutral');
  const r = opt.r;
  const firm = contractors(a).find((x) => x.id === tierId);
  if (!firm) return result(false, 'Choose who does the work.', 'neutral');
  const cost = quote(a, renoId, tierId);
  if (p.finance.cash < cost) return result(false, `${firm.name} would charge ${fmtMoney(cost, c)}. You have ${fmtMoney(Math.max(0, p.finance.cash), c)}.`, 'neutral');
  p.finance.cash -= cost;
  let how = roll(firm);
  let extra = 0;
  // A poor job is one of two things: the bill grows, or the work is not good. Short of money for the overrun, it is the work.
  if (how === 'poor' && rng.chance(0.5)) {
    extra = Math.round(cost * 0.25);
    if (p.finance.cash >= extra) { p.finance.cash -= extra; how = 'good'; } else extra = 0;
  }
  const entry = { id: r.id, year: store.state.year, by: firm.name, tier: firm.id, result: how, k: 0, paid: cost };
  const worth = a.value;
  renovationsOf(a).push(entry);
  setK(a, entry, valueFor(r, how, cost, worth));
  if (how === 'poor') a.condition = Math.max(0, a.condition - 5);
  a.renovatedYear = store.state.year; // a post can point at it (engine/digital/content.js)
  if (renovationsOf(a).length === 1) milestone(`Renovated your ${lower(a.name)}.`, 'money');
  const where = `the ${lower(a.name)}`;
  const text = how === 'great' ? `${firm.name} finished the ${lower(r.name)} at ${where}, and it is better than the plans: beautiful work. It cost ${fmtMoney(cost, c)}.`
    : how === 'poor' ? `${firm.name} finished the ${lower(r.name)} at ${where}, after a fashion. The work is shoddy: it adds little, and it will need fixing. It cost ${fmtMoney(cost, c)}.`
      : extra ? `${firm.name} finished the ${lower(r.name)} at ${where}, but over budget: ${fmtMoney(cost + extra, c)} in the end, not ${fmtMoney(cost, c)}.`
        : `${firm.name} finished the ${lower(r.name)} at ${where}: good, solid work, for ${fmtMoney(cost, c)}.`;
  log(text, 'system', how === 'poor' ? 'bad' : 'good');
  book({ cat: 'housing', src: 'action', desc: `${r.name}: ${a.name}` });
  return { ...result(true, text, how === 'poor' ? 'bad' : extra ? 'neutral' : 'good'), how, cost: cost + extra };
}

/** Has shoddy work done again, by whoever the player chooses. It costs less than starting over, and can go wrong again. */
export function fixRenovation(assetId, renoId, tierId) {
  const p = player();
  const c = country();
  const a = assetOf(assetId);
  const entry = a && renovationsOf(a).find((x) => x.id === renoId);
  if (!entry) return result(false, 'There is nothing like that to fix.', 'neutral');
  if (entry.result !== 'poor') return result(false, 'That work is fine as it is.', 'neutral');
  const firm = contractors(a).find((x) => x.id === tierId);
  if (!firm) return result(false, 'Choose who does the work.', 'neutral');
  const cost = fixCost(a, renoId, tierId);
  if (p.finance.cash < cost) return result(false, `${firm.name} would charge ${fmtMoney(cost, c)} to put it right.`, 'neutral');
  p.finance.cash -= cost;
  const how = roll(firm);
  const r = RENOVATION_BY_ID[renoId];
  const worth = a.value / (1 + (entry.k ?? 0));
  Object.assign(entry, { by: firm.name, tier: firm.id, result: how, fixed: store.state.year, paid: (entry.paid ?? cost) + cost });
  setK(a, entry, valueFor(r, how, entry.paid, worth));
  book({ cat: 'housing', src: 'action', desc: `Putting right the ${lower(r.name)}: ${a.name}` });
  const text = how === 'poor' ? `${firm.name} had a go at the ${lower(r.name)}, for ${fmtMoney(cost, c)}. It is still not right.`
    : `${firm.name} put the ${lower(r.name)} right${how === 'great' ? ', and then some' : ''}, for ${fmtMoney(cost, c)}.`;
  log(text, 'system', how === 'poor' ? 'bad' : 'good');
  return result(how !== 'poor', text, how === 'poor' ? 'bad' : 'good');
}
export const fixCost = (a, renoId, tierId) => Math.round(quote(a, renoId, tierId) * 0.4);

/** Takes a renovation out: it costs a little, frees the space, and takes away what it added to the home's worth. */
export function removeRenovation(assetId, renoId) {
  const p = player();
  const c = country();
  const a = assetOf(assetId);
  const entry = a && renovationsOf(a).find((x) => x.id === renoId);
  if (!entry) return result(false, 'There is nothing like that to take out.', 'neutral');
  const r = RENOVATION_BY_ID[renoId];
  if (r.space === -1 && usedOf(a) > spaceOf(a) - 1) return result(false, 'Take something else out first: without the extension there would not be room for all of it.', 'neutral');
  const cost = removeCost(a, renoId);
  if (p.finance.cash < cost) return result(false, `Taking it out would cost ${fmtMoney(cost, c)}.`, 'neutral');
  p.finance.cash -= cost;
  setK(a, entry, 0);
  a.renovations = renovationsOf(a).filter((x) => x !== entry);
  book({ cat: 'housing', src: 'action', desc: `Taking out the ${lower(r.name)}: ${a.name}` });
  const text = `The ${lower(r.name)} is gone from the ${lower(a.name)}. Taking it out cost ${fmtMoney(cost, c)}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}
export const removeCost = (a, renoId) => Math.round(quote(a, renoId, 'solid') * REMOVE_COST);

/** The mood a home's renovations add each year, while you live there. Shoddy work adds nothing; all of it together, at most COMFORT_CAP. */
export const comfortOf = (a) => Math.min(COMFORT_CAP, renovationsOf(a).reduce((t, x) => t + (x.result === 'poor' ? 0 : RENOVATION_BY_ID[x.id]?.comfort ?? 0), 0));
/** What the renovations add to (or, solar panels, take off) the running costs, as a share of worth. */
export const upkeepOf = (a) => renovationsOf(a).reduce((t, x) => t + (RENOVATION_BY_ID[x.id]?.upkeep ?? 0), 0);
/** The names of what has been done, for the property screen. */
export const doneList = (a) => renovationsOf(a).map((x) => `${RENOVATION_BY_ID[x.id]?.name ?? x.id}${x.result === 'poor' ? ' (shoddy)' : x.result === 'great' ? ' (beautiful work)' : ''}`);
