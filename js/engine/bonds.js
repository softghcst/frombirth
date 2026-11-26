// Relationships between adults that are not the one partner the romance engine keeps (engine/romance.js): dating
// casually, friends with benefits, one night, a relationship kept private; and the terms of the main one (exclusive, not
// yet discussed, or open by agreement). A person can have several at once, each its own record with its own history.
//
// Three things are kept apart throughout:
//   what a relationship is      its type and whether it is kept private (`secret`)
//   what was agreed             the main relationship's `exclusive` (true, false, or null: never discussed) and `open`
//   who knows                   `knows[npcId] = { level: 'suspects'|'knows', year, how, fromId? }`, person by person
//                               (fromId: who told them, when somebody did)
// An affair is not a type. It is a relationship that breaks an exclusivity the main partner was actually promised and
// has not agreed to change (isAffair). A private relationship with no such promise broken is only private.
//
// Everything here is between adults (18 and over, both), and the other person always answers for themselves: they can
// say no to a proposal, to a night, to a gift, and they can leave. Nothing is described: a night together is a line.
//
//   state.bonds = { seq, list: { id: bond } }
//   bond = { id, npcId, type: 'primary'|'casual'|'fwb'|'secret'|'onenight', status: 'active'|'ended', start: { year, month, age },
//            end?: { year, month, age, why }, exclusive, open, secret, trust, knows, history: [{ year, month, age, key, text }],
//            gifts: [{ year, id, name, cost }], acts: { [year]: { time, intimate, gift, trip } }, arc: {}, promise }
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { remember } from './conditions.js';
import { spendAction, countAction } from './relationships.js';
import { conceive, canConceive } from './children.js';
import * as contra from './health/contraception.js';
import { ensureLife } from './npcLives.js';
import { book } from './ledger.js';
import * as love from './romance.js';
import { ROMANTIC_GIFTS } from '../data/gifts.js';
import { SUPPORT } from '../data/money.js';
import { holidayOptions } from './activities.js';

export const ADULT = 18;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const S = () => (store.state.bonds ??= { seq: 0, list: {} });
const npcOf = (id) => store.state.npcs[id];
const bump = (npc, d) => { npc.meters.relationship = clamp(npc.meters.relationship + d); };
const now = () => ({ year: store.state.year, month: store.state.month ?? 0, age: player().age });
/** Years (with months) since a moment. */
export const since = (t) => store.state.year - t.year + ((store.state.month ?? 0) - (t.month ?? 0)) / 12;
export const TYPES = { primary: 'Partner', casual: 'Dating casually', fwb: 'Friends with benefits', secret: 'Private relationship', onenight: 'One night' };

/** What this person wants from love, their own and lasting: drawn once, kept with them. */
export function heart(npc) {
  return (npc.flags.heart ??= { casual: rng.int(0, 100), secrecy: rng.int(0, 100), commitment: rng.int(0, 100), forgiving: rng.int(0, 100) });
}

// ---------- Records ----------

export const bonds = () => Object.values(S().list);
export const bondWith = (npcId) => bonds().find((b) => b.npcId === npcId && b.status === 'active') ?? null;
export const pastWith = (npcId) => bonds().filter((b) => b.npcId === npcId && b.status === 'ended');
/** The other relationships going on now (not the main one). */
export const others = () => bonds().filter((b) => b.status === 'active' && b.type !== 'primary' && npcOf(b.npcId)?.alive);

function make(npc, type, o = {}) {
  const st = S();
  const id = `bond_${(st.seq += 1).toString(36)}`;
  const b = { id, npcId: npc.id, type, status: 'active', start: now(), exclusive: null, open: false, secret: false, trust: 70, knows: {}, history: [], gifts: [], acts: {}, arc: {}, promise: null, ...o };
  st.list[id] = b;
  return b;
}
function note(b, key, text) { b.history.push({ ...now(), key, text }); }
function did(b, what) { const a = (b.acts[store.state.year] ??= {}); a[what] = (a[what] ?? 0) + 1; }
const actsThisYear = (b) => Object.values(b.acts[store.state.year] ?? {}).reduce((s, n) => s + n, 0);

/**
 * The main relationship's own record: made the first time it is needed. A marriage or an engagement is exclusive (that
 * was promised); a couple who are only dating have not discussed it until they do (null), which is not a promise.
 */
export function primary() {
  const npc = love.partner();
  if (!npc) return null;
  let b = bonds().find((x) => x.npcId === npc.id && x.status === 'active');
  if (!b) b = make(npc, 'primary', { exclusive: npc.role === 'spouse' || npc.flags.engaged ? true : null, start: { year: store.state.year - Math.max(0, player().age - (npc.flags.since ?? player().age)), month: 0, age: npc.flags.since ?? player().age } });
  else if (b.type !== 'primary') b.type = 'primary';
  if (b.exclusive == null && !b.open && (npc.role === 'spouse' || npc.flags.engaged)) b.exclusive = true;
  return b;
}
/** Whether the main partner was promised exclusivity, and has not agreed otherwise. */
export const promised = () => { const m = primary(); return !!m && m.exclusive === true && !m.open; };
/** An affair: this relationship breaks a promise of exclusivity that the main partner has not released. */
export const isAffair = (b) => b.type !== 'primary' && promised();
/** What to call it: by what it is, and "affair" only when it is one. */
export function label(b) {
  if (b.type === 'primary') return TYPES.primary;
  if (b.status === 'active' && isAffair(b)) return 'Affair';
  return b.secret && b.type !== 'secret' ? `${TYPES[b.type]} (private)` : TYPES[b.type];
}

// ---------- Who knows ----------

/** What this person knows of that relationship: null, 'suspects' or 'knows'. The two in it know. */
export const knowledge = (b, npcId) => (npcId === b.npcId ? 'knows' : b.knows[npcId]?.level ?? null);
function learn(b, npc, level, how, fromId = null) {
  const had = b.knows[npc.id]?.level;
  if (had === 'knows' || (had === 'suspects' && level === 'suspects')) return false;
  b.knows[npc.id] = { level, year: store.state.year, how, ...(fromId ? { fromId } : {}) };
  return true;
}

// ---------- Who may, and whether they will ----------

const FAMILY = ['parent', 'sibling', 'child', 'grandparent', 'grandchild', 'cousin', 'aunt', 'uncle', 'niece', 'nephew', 'inlaw', 'stepparent', 'stepchild', 'pet'];
/** Two adults, both free to answer for themselves: not family, not someone who works under the player. */
export function eligible(npc) {
  const p = player();
  return !!npc && npc.alive && p.age >= ADULT && npc.age >= ADULT && !p.legal.incarceration && !FAMILY.includes(npc.role) && !npc.flags.report && !npc.flags.clinician
    && (!love.interest() || love.interest() === 'everyone' || !npc.gender || love.interest() === npc.gender || npc.role === 'partner' || npc.role === 'spouse' || !!bondWith(npc.id));
}
const theirOwn = (npc) => !!(npc.life?.partnerId && npcOf(npc.life.partnerId)?.alive) || !!npc.flags.partnerOf;

/** How likely this person is to say yes to this, being who they are. */
export function willing(npc, type) {
  const p = player();
  const h = heart(npc);
  let c = (npc.meters.relationship - 35) / 70 + (p.stats.charm - 50) / 200;
  if (type === 'casual') c += (h.casual - 50) / 120;
  if (type === 'fwb') c += (h.casual - 50) / 100 - (h.commitment - 50) / 250;
  if (type === 'onenight') c += (h.casual - 60) / 90 - 0.1;
  if (type === 'secret') c += (h.secrecy - 50) / 90;
  // Someone with a partner of their own, or asked to be the other one in somebody's marriage, thinks hard.
  if (theirOwn(npc)) c -= 0.35;
  if (love.partner() && love.partner().id !== npc.id) c -= promised() ? 0.15 + (50 - h.secrecy) / 200 : 0.05;
  return clamp(c, 0.03, 0.9);
}

// ---------- Beginning ----------

const ASK = {
  casual: { label: 'Suggest dating casually', yes: (n) => `You and ${n} agree to see each other, with no promises either way.`, no: (n) => `${n} would rather not.` },
  fwb: { label: 'Suggest friends with benefits', yes: (n) => `You and ${n} talk it through, and agree: friends first, and this as well, for as long as it suits you both.`, no: (n) => `${n} thinks it would spoil the friendship.` },
  secret: { label: 'Begin a private romance', yes: (n) => `You and ${n} begin seeing each other, and agree to keep it to yourselves.`, no: (n) => `${n} is not willing to be somebody's secret.` },
  onenight: { label: 'Spend one night together', yes: (n) => `You and ${n} spent the night together. Nothing was promised.`, no: (n) => `${n} laughs, kindly, and says no.` },
};

/** Asks this person for one of the arrangements. They answer for themselves, and may answer no. */
export function propose(npcId, type) {
  const p = player();
  const npc = npcOf(npcId);
  if (!ASK[type]) return result(false, 'That is not something to ask.', 'neutral');
  if (!eligible(npc)) return result(false, 'That is not open to the two of you.', 'neutral');
  if (bondWith(npcId)) return result(false, `You and ${npc.firstName} have an understanding already.`, 'neutral');
  if (type === 'fwb' && npc.role !== 'friend') return result(false, 'That is something to ask a friend.', 'neutral');
  if (!spendAction(npc, `ask_${type}`)) return result(false, `You have asked ${npc.firstName} this year already.`, 'neutral');
  const h = heart(npc);
  if (!rng.chance(willing(npc, type))) {
    bump(npc, type === 'onenight' ? -3 : -5);
    const why = type !== 'onenight' && h.commitment > 70 ? `${npc.firstName} wants something that is only the two of you, or nothing.`
      : type === 'secret' && h.secrecy < 35 ? `${npc.firstName} is not comfortable keeping it secret.` : ASK[type].no(npc.firstName);
    log(why, 'system', 'neutral');
    return result(false, why, 'neutral');
  }
  ensureLife(npc);
  const cheating = promised();
  const b = make(npc, type, { secret: type === 'secret' || cheating });
  let text = ASK[type].yes(npc.firstName);
  note(b, 'began', text);
  bump(npc, type === 'onenight' ? 3 : 8);
  p.stats.mood = clamp(p.stats.mood + 5);
  if (type === 'onenight') {
    did(b, 'intimate');
    text += maybeConceive(npc, b);
    b.status = 'ended'; b.end = { ...now(), why: 'one night' };
  } else {
    remember(npc, `bond_${type}`, { casual: 'You began seeing each other, casually.', fwb: 'You became friends with benefits.', secret: 'You began seeing each other in private.' }[type]);
  }
  if (cheating) { p.flags.hadAffair = true; p.counters && (p.counters.affairs = (p.counters.affairs ?? 0) + 1); p.hidden.karma = clamp(p.hidden.karma - 6); }
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Being together ----------

/**
 * Contraception is kept in the health record (engine/health/contraception.js): specific methods, or, for a life from
 * before methods existed, an unspecified "birth control" assumed until the player chooses. These two keep the old switch.
 */
export const birthControl = () => { const c = contra.cx(); return c.legacyDefault || contra.active().length > 0; };
export function setBirthControl(on) { return contra.legacySwitch(!!on); }
function maybeConceive(npc, b) {
  const p = player();
  if (!canConceive(npc) || p.flags.pregnancy) return '';
  // A night is a real exposure: the chance without anything (7% at fertility 70) is lowered by what is in place now.
  // A broken condom, or no method when the player is not planning a pregnancy, brings the emergency contraception
  // decision first; the night's own roll is drawn now, as always, and settled by that decision (engine/health/contraception.js).
  const risk = contra.actRisk(p);
  const would = rng.chance(0.07 * risk.mult * p.hidden.fertility / 70);
  if (risk.offerEc) { contra.recordExposure({ npcId: npc.id, bondId: b.id, failed: risk.failed, would }, p); return risk.failed ? ' The condom broke.' : ''; }
  if (!would) return '';
  const said = conceive(npc, false);
  b.pregnancy = { year: store.state.year, month: store.state.month ?? 0 };
  note(b, 'pregnancy', said);
  return ` ${said}`;
}

/** A night together, if they want one too. As often as you both like; nothing is owed for anything given before. */
export function intimate(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  const b = bondWith(npcId) ?? (love.partner()?.id === npcId ? primary() : null);
  if (!b || !eligible(npc)) return result(false, 'That is not open to the two of you.', 'neutral');
  const first = countAction(npc, 'intimate') === 1;
  // Their answer, tonight: how things are between you, not what you have given them.
  if (npc.meters.relationship < 25 || !rng.chance(clamp(0.55 + (npc.meters.relationship - 40) / 120, 0.2, 0.95))) {
    const text = `${npc.firstName} is not in the mood, and says so.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  did(b, 'intimate');
  bump(npc, first ? rng.int(2, 6) : rng.int(0, 2));
  p.stats.mood = clamp(p.stats.mood + (first ? 6 : 2));
  const text = `You and ${npc.firstName} spent the night together.${maybeConceive(npc, b)}`;
  log(text, 'system', 'good');
  return result(true, text);
}

export function spendTime(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  const b = bondWith(npcId);
  if (!b || !npc?.alive) return result(false, 'There is nothing between you now.', 'neutral');
  if (!spendAction(npc, 'bondTime')) return result(false, `You have had your time with ${npc.firstName} this year.`, 'neutral');
  did(b, 'time');
  bump(npc, rng.int(3, 7));
  p.stats.mood = clamp(p.stats.mood + 4);
  const text = b.type === 'fwb' ? `You and ${npc.firstName} spent a day the way you did before any of this: as friends.` : `You and ${npc.firstName} stole an afternoon together.`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Gifts ----------

/** The gifts that can be bought now, here: with what they cost. */
export function giftsFor() {
  const c = country();
  return ROMANTIC_GIFTS.filter((g) => store.state.year >= (g.from ?? 0)).map((g) => ({ ...g, price: localMoney(g.cost, c) }));
}
/** How much this person cares for this kind of thing (their own taste, kept). */
function taste(npc, kind) { const t = (heart(npc).taste ??= {}); return (t[kind] ??= rng.int(0, 100)); }

/**
 * Buys a gift and gives it. They may not take it; if they do it is theirs, and the money is spent once. A gift is a
 * gift: it buys no feeling and no night, and what it means to them depends on them.
 */
export function give(npcId, giftId) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const g = giftsFor().find((x) => x.id === giftId);
  const b = bondWith(npcId) ?? (love.partner()?.id === npcId ? primary() : null);
  if (!g || !npc?.alive || !b || p.age < ADULT || npc.age < ADULT) return result(false, 'That is not something you can give them.', 'neutral');
  if (p.finance.cash < g.price) return result(false, `You cannot afford ${g.name}.`, 'neutral');
  if (!spendAction(npc, 'bondGift')) return result(false, `You have given ${npc.firstName} something this year already.`, 'neutral');
  const h = heart(npc);
  // Too much, too soon, from someone they have made no promises to: some people hand it back.
  if (g.cost >= 3000 && b.type !== 'primary' && since(b.start) < 1 && rng.chance(0.25 + (h.commitment - 50) / 200)) {
    const text = `${npc.firstName} looks at ${g.name} for a long moment, and gives it back. "It is too much. I cannot take this."`;
    note(b, 'giftDeclined', text);
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  p.finance.cash -= g.price;
  book({ cat: 'giftOut', src: 'action', desc: `${g.name[0].toUpperCase()}${g.name.slice(1)} for ${npc.firstName}` });
  (npc.flags.keepsakes ??= []).push({ id: g.id, name: g.name, value: g.price, year: store.state.year, fromId: p.id });
  b.gifts.push({ year: store.state.year, id: g.id, name: g.name, cost: g.price });
  did(b, 'gift');
  const liked = taste(npc, g.kind);
  const meant = Math.round(clamp(1 + liked / 14 + Math.log10(g.cost) - (g.cost >= 3000 && h.commitment < 30 ? 2 : 0), 1, 11));
  bump(npc, meant);
  const text = `You gave ${npc.firstName} ${g.name} (${fmtMoney(g.price, c)}). ${liked >= 65 ? 'It is exactly the kind of thing they love.' : liked <= 30 ? 'They thank you, and put it away.' : 'They are pleased.'}`;
  note(b, 'gift', text);
  remember(npc, `gift_${g.id}_${store.state.year}`, `You gave them ${g.name}.`);
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Cars and homes: who owns, and who lives there ----------
//
// Owning and living somewhere are different things. A home the player owns and lets someone live in is still the
// player's (asset.occupant = { npcId, since }): it stays in their estate. A car or a home given away is the other
// person's from then on (npc.flags.owned), and is no part of the player's estate.

const assetOf = (id) => player().assets.find((a) => a.id === id);
/** What could be made over to someone: owned outright, not the player's own home, with nobody renting it. */
export const givable = () => player().assets.filter((a) => ['vehicle', 'property'].includes(a.kind) && !a.mortgage && !a.loan && !a.tenant && a.id !== player().homeId);
/** Homes someone could be given to live in: the player's, empty, and not where the player lives. */
export const spareHomes = () => player().assets.filter((a) => a.kind === 'property' && !a.tenant && !a.occupant && a.id !== player().homeId);
export const TRANSFER_FEE = 0.01;

/** Makes a car or a home over to them: theirs, for good, if they will take it. The lawyers are paid once. */
export function transfer(npcId, assetId) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const a = assetOf(assetId);
  const b = bondWith(npcId) ?? (love.partner()?.id === npcId ? primary() : null);
  if (!a || !npc?.alive || !b || p.age < ADULT || npc.age < ADULT) return result(false, 'That is not something you can give them.', 'neutral');
  if (a.mortgage || a.loan) return result(false, `There is still money owed on ${a.name}. A thing with a loan on it cannot be given away: pay it off first.`, 'neutral');
  if (a.tenant) return result(false, 'There is a tenant in it.', 'neutral');
  if (a.id === p.homeId) return result(false, 'You live there. Move out first.', 'neutral');
  const fee = Math.round(a.value * TRANSFER_FEE);
  if (p.finance.cash < fee) return result(false, `The transfer costs ${fmtMoney(fee, c)} in fees, which you do not have.`, 'neutral');
  if (!spendAction(npc, 'bondTransfer')) return result(false, `You have made something over to ${npc.firstName} this year already.`, 'neutral');
  if (b.type !== 'primary' && since(b.start) < 1 && rng.chance(0.3 + (heart(npc).commitment - 50) / 200)) {
    const text = `${npc.firstName} will not take ${a.name}. "I do not want to owe you that."`;
    note(b, 'giftDeclined', text);
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  p.assets.splice(p.assets.indexOf(a), 1);
  p.finance.cash -= fee;
  if (a.occupant) delete a.occupant;
  if (npc.flags.housedIn === a.id) delete npc.flags.housedIn;
  (npc.flags.owned ??= []).push({ ...a, givenYear: store.state.year, fromId: p.id });
  // A will cannot leave what is no longer the player's.
  if (p.flags.will?.items?.[a.id]) delete p.flags.will.items[a.id];
  book({ cat: 'giftOut', src: 'action', desc: `${a.name} made over to ${npc.firstName}` });
  b.gifts.push({ year: store.state.year, id: a.id, name: a.name, cost: a.value, asset: a.kind });
  did(b, 'gift');
  bump(npc, Math.round(clamp(4 + taste(npc, a.kind) / 20, 3, 9)));
  const text = `${a.name} is ${npc.firstName}'s now, in their name (${fmtMoney(fee, c)} in fees). It is theirs whatever happens between you.`;
  note(b, 'transfer', text);
  remember(npc, `given_${a.id}`, `You gave them ${a.name}.`);
  log(text, 'system', 'good');
  milestone(`Gave ${a.name} to ${npc.firstName}.`, 'money');
  return result(true, text);
}

/** Lets them live in a home the player owns. It stays the player's. */
export function house(npcId, assetId) {
  const npc = npcOf(npcId);
  const a = assetOf(assetId);
  const b = bondWith(npcId);
  if (!a || a.kind !== 'property' || !npc?.alive || !b) return result(false, 'That is not open to the two of you.', 'neutral');
  if (!spareHomes().includes(a)) return result(false, 'That home is not free.', 'neutral');
  if (npc.flags.housedIn) return result(false, `${npc.firstName} is living in a place of yours already.`, 'neutral');
  if (theirOwn(npc) || rng.chance(clamp((40 - npc.meters.relationship) / 60, 0, 0.6))) {
    const text = `${npc.firstName} thanks you, and would rather keep their own place.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  a.occupant = { npcId, since: store.state.year };
  npc.flags.housedIn = a.id;
  did(b, 'gift');
  bump(npc, 5);
  const text = `${npc.firstName} moves into ${a.name}. It is still yours: the deed, the taxes and the repairs.`;
  note(b, 'housed', text);
  log(text, 'system', 'good');
  return result(true, text);
}
/** Asks them to leave it. */
export function unhouse(assetId) {
  const a = assetOf(assetId);
  const npc = a?.occupant ? npcOf(a.occupant.npcId) : null;
  if (!a?.occupant) return result(false, 'Nobody is living there.', 'neutral');
  delete a.occupant;
  if (npc) { delete npc.flags.housedIn; if (npc.alive) bump(npc, -10); const b = bondWith(npc.id) ?? pastWith(npc.id).at(-1); if (b) note(b, 'unhoused', `You asked them to leave ${a.name}.`); }
  const text = `${npc?.firstName ?? 'They'} moved out of ${a.name}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

// ---------- Going away together ----------

/** Trips two can take from here (not the long flights: those are planned in Travel). */
export const tripsFor = () => holidayOptions().filter((h) => h.kind !== 'flight').map((h) => ({ ...h, cost: Math.round(h.cost * 1.6), affordable: player().finance.cash >= Math.round(h.cost * 1.6) }));
/** A trip for two, paid for once. It may go well or badly; it promises nothing. */
export function trip(npcId, tripId) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const b = bondWith(npcId) ?? (love.partner()?.id === npcId ? primary() : null);
  const t = tripsFor().find((x) => x.id === tripId);
  if (!t || !npc?.alive || !b || p.age < ADULT || npc.age < ADULT) return result(false, 'That trip is not on offer.', 'neutral');
  if (p.finance.cash < t.cost) return result(false, 'You cannot afford that trip for two.', 'neutral');
  if (!spendAction(npc, 'bondTrip')) return result(false, `You have been away with ${npc.firstName} this year.`, 'neutral');
  if (npc.meters.relationship < 35) { const text = `${npc.firstName} does not want to go away with you just now.`; log(text, 'system', 'neutral'); return result(false, text, 'neutral'); }
  p.finance.cash -= t.cost;
  book({ cat: 'travel', src: 'action', desc: `${t.name}, with ${npc.firstName}` });
  did(b, 'trip'); did(b, 'trip'); // days together, away: seen by more people than an evening is
  const went = rng.chance(0.8);
  bump(npc, went ? rng.int(5, 10) : -4);
  p.stats.mood = clamp(p.stats.mood + (went ? 8 : -2));
  const text = went ? `${t.name} with ${npc.firstName} (${fmtMoney(t.cost, c)}): the kind of days you will both remember.` : `${t.name} with ${npc.firstName} (${fmtMoney(t.cost, c)}). You argued on the second day about where this is going, and came home early.`;
  note(b, 'trip', text);
  remember(npc, `trip_${store.state.year}`, went ? 'You went away together.' : 'You went away together, and argued.');
  log(text, 'system', went ? 'good' : 'neutral');
  return result(went, text, went ? 'good' : 'neutral');
}

// ---------- Children, and the households they live in ----------

/** The player's children whose other parent is this person. */
export const childrenWith = (npcId) => Object.values(store.state.npcs).filter((n) => n.role === 'child' && (n.parentIds ?? []).includes(npcId));
/** Two children of the player by different other parents are half-siblings. */
export const halfSiblings = (x, y) => !!(x?.parentIds?.length && y?.parentIds?.length && x.id !== y.id && !x.parentIds.some((id) => y.parentIds.includes(id)));

/**
 * A child born of a relationship where the two do not live together lives with their mother. If that is not the
 * player, the player owes support for the child from then on: an obligation paid each year like any other
 * (engine/family.js), not a gift. Who has been told about the child is its own question.
 */
function newChildren(b, npc) {
  const p = player();
  for (const kid of childrenWith(npc.id)) {
    if (kid.flags.household) continue;
    const together = npc.role === 'spouse' || npc.flags.livesTogether;
    const withMother = !together && (p.flags.bornAs ?? p.gender) === 'male';
    kid.flags.household = withMother ? npc.id : 'player';
    (b.childIds ??= []).push(kid.id);
    note(b, 'child', `${kid.firstName} was born.`);
    if (!withMother) continue;
    kid.flags.livesWith = npc.id;
    const mine = (p.career.salary || 0) + (p.career.partTime?.salary || 0);
    const amount = Math.round(mine * SUPPORT.childShare);
    if (amount > 0) {
      const list = (p.finance.support ??= []);
      list.push({ id: `sup${list.length + 1}_${store.state.year}`, npcId: npc.id, name: `${npc.firstName} ${npc.lastName}`, since: store.state.year, kind: 'child', dir: 'pay', amount, until: store.state.year + 18 - kid.age, childId: kid.id });
      log(`${kid.firstName} lives with ${npc.firstName}. You pay ${fmtMoney(amount, country())} a year toward them until they are grown.`, 'system', 'neutral');
    } else log(`${kid.firstName} lives with ${npc.firstName}.`, 'system', 'neutral');
  }
}
/** Whether this person has been told that this child is the player's. A child kept from a partner stays kept. */
export function knowsOfChild(kid, npcId) {
  if ((kid.parentIds ?? []).includes(npcId)) return true;
  const b = bonds().find((x) => (x.childIds ?? []).includes(kid.id));
  if (!b || !b.secret) return true;
  return knowledge(b, npcId) === 'knows';
}

// ---------- The terms of the main relationship ----------

/** "Are we exclusive?": asked and answered, and what was agreed is kept. */
export function discussExclusive(npcId) {
  const npc = npcOf(npcId);
  const m = primary();
  if (!m || m.npcId !== npcId) return result(false, 'That is a conversation for your partner.', 'neutral');
  if (!spendAction(npc, 'talkExclusive')) return result(false, 'You have had that conversation this year.', 'neutral');
  if (m.exclusive === true && !m.open) return result(true, `You and ${npc.firstName} are exclusive, and both know it.`, 'neutral');
  m.exclusive = true; m.open = false;
  bump(npc, 4);
  const text = `You and ${npc.firstName} agree: only each other.`;
  note(m, 'exclusive', text);
  log(text, 'system', 'good');
  return result(true, text);
}
/** Asking to open the relationship. They may agree, and then seeing others breaks nothing; they may not. */
export function discussOpen(npcId) {
  const npc = npcOf(npcId);
  const m = primary();
  if (!m || m.npcId !== npcId) return result(false, 'That is a conversation for your partner.', 'neutral');
  if (!spendAction(npc, 'talkOpen')) return result(false, 'You have had that conversation this year.', 'neutral');
  const h = heart(npc);
  if (rng.chance(clamp((h.casual - 55) / 80 + (npc.meters.relationship - 60) / 200, 0.03, 0.8))) {
    m.open = true; m.exclusive = false;
    const text = `${npc.firstName} thinks about it for a week, and agrees: you may each see other people, and tell each other the truth about it.`;
    note(m, 'opened', text);
    for (const b of others()) { learn(b, npc, 'knows', 'you told them, by agreement'); b.secret = b.type === 'secret'; }
    log(text, 'system', 'good');
    return result(true, text);
  }
  bump(npc, -6);
  const text = `${npc.firstName} does not want that, and is hurt that you asked.`;
  note(m, 'openRefused', text);
  log(text, 'system', 'bad');
  return result(false, text);
}

// ---------- Ending, and making it the main one ----------

export function end(npcId, why = 'you ended it') {
  const npc = npcOf(npcId);
  const b = bondWith(npcId);
  if (!b || b.type === 'primary') return result(false, 'There is nothing of that kind between you.', 'neutral');
  b.status = 'ended'; b.end = { ...now(), why };
  if (npc?.alive) bump(npc, b.type === 'fwb' ? -4 : -12);
  const text = b.type === 'fwb' ? `You and ${npc.firstName} agree to go back to being friends.` : `You ended things with ${npc.firstName}.`;
  note(b, 'ended', text);
  if (npc) remember(npc, `bond_ended_${b.id}`, 'It ended between you.');
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}
function theyEnd(b, text, why) {
  const npc = npcOf(b.npcId);
  b.status = 'ended'; b.end = { ...now(), why };
  note(b, 'ended', text);
  if (npc?.alive) { bump(npc, -8); remember(npc, `bond_ended_${b.id}`, 'They ended it with you.'); }
  player().stats.mood = clamp(player().stats.mood - 6);
  log(text, 'system', 'bad');
}

/** With nobody else in the way, this becomes the relationship: the same people, the same history. */
export function makeOfficial(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  const b = bondWith(npcId);
  if (!b || b.type === 'primary' || !eligible(npc)) return result(false, 'That is not open to the two of you.', 'neutral');
  if (love.partner()) return result(false, `You are with ${love.partner().firstName}.`, 'neutral');
  if (!spendAction(npc, 'makeOfficial')) return result(false, 'You have asked this year already.', 'neutral');
  if (!rng.chance(clamp((npc.meters.relationship - 30) / 60 + (heart(npc).commitment - 40) / 150, 0.05, 0.95))) {
    const text = `${npc.firstName} likes things as they are.`;
    note(b, 'officialRefused', text);
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  npc.flags.wasRole = npc.role; npc.role = 'partner'; npc.flags.since = p.age;
  b.type = 'primary'; b.secret = false; b.exclusive = true; b.promise = null;
  bump(npc, 8);
  const text = `You and ${npc.firstName} are together, properly, and everyone may know it.`;
  note(b, 'official', text);
  log(text, 'system', 'good');
  milestone(`You and ${npc.firstName} became a couple.`, 'family');
  return result(true, text);
}

// ---------- What can be done with this person, now ----------

/** @returns {{id:string, label:string, danger?:boolean}[]} */
export function bondActions(npc) {
  const p = player();
  if (p.age < ADULT || !npc?.alive || npc.age < ADULT) return [];
  const a = [];
  const b = bondWith(npc.id);
  const main = love.partner()?.id === npc.id;
  if (main) {
    const m = primary();
    if (m.exclusive !== true && !m.open) a.push({ id: 'bondExclusive', label: 'Discuss being exclusive' });
    if (!m.open) a.push({ id: 'bondOpen', label: 'Discuss opening the relationship' });
    a.push({ id: 'bondGift', label: 'Buy them something special' });
    if (others().some((o) => knowledge(o, npc.id) !== 'knows') && promised()) a.push({ id: 'bondConfess', label: 'Tell them the truth', danger: true });
  } else if (b) {
    a.push({ id: 'bondTime', label: b.type === 'fwb' ? 'Spend time as friends' : 'Spend time together' }, { id: 'bondIntimate', label: 'Be intimate' }, { id: 'bondGift', label: 'Give a gift' }, { id: 'bondTrip', label: 'Go away together' });
    if (npc.flags.housedIn) a.push({ id: 'bondUnhouse', label: 'Ask them to move out of your property', danger: true });
    else if (spareHomes().length) a.push({ id: 'bondHouse', label: 'Offer them a home of yours to live in' });
    if (!love.partner()) a.push({ id: 'bondOfficial', label: b.type === 'fwb' ? 'Explore a romance' : 'Become a couple' });
    a.push({ id: 'bondEnd', label: b.type === 'fwb' ? 'End the arrangement' : 'End it', danger: true });
  } else if (eligible(npc) && ['friend', 'classmate', 'coworker', 'colleague', 'ex', 'acquaintance', 'neighbor'].includes(npc.role)) {
    if (love.partner()) a.push({ id: 'askSecret', label: ASK.secret.label });
    else a.push({ id: 'askCasual', label: ASK.casual.label });
    if (npc.role === 'friend') a.push({ id: 'askFwb', label: ASK.fwb.label });
    a.push({ id: 'askOneNight', label: ASK.onenight.label });
  }
  if ((main || b) && givable().length) a.push({ id: 'bondTransfer', label: 'Make a car or a home over to them' });
  if (main) a.push({ id: 'bondTrip', label: 'Go away together' });
  if (main || b) a.push({ id: 'bondControl', label: 'Birth control & family planning' });
  return a;
}

/** For a profile: what this is, since when, who knows, and what has happened. */
export function summary(npc) {
  const b = bondWith(npc.id) ?? pastWith(npc.id).at(-1) ?? null;
  if (!b || (b.type === 'primary' && !b.history.length && b.exclusive == null)) return null;
  const m = b.type === 'primary';
  return { bond: b, label: b.status === 'ended' ? `${TYPES[b.type]} (over)` : label(b), since: b.start.year,
    terms: m ? (b.open ? 'Open, by agreement' : b.exclusive === true ? 'Exclusive' : 'Exclusivity never discussed') : null,
    knownBy: Object.entries(b.knows).map(([id, k]) => ({ name: npcOf(id)?.firstName ?? 'Someone', level: k.level, how: k.how })),
    history: b.history.slice(-8), gifts: b.gifts, trust: m && b.trust < 70 ? b.trust : null };
}

// ---------- The truth, and what the partner does with it ----------

/** Telling the main partner oneself. */
export function confess(npcId) {
  const npc = npcOf(npcId);
  const m = primary();
  if (!m || m.npcId !== npcId) return result(false, 'There is nobody to tell.', 'neutral');
  const hidden = others().filter((o) => knowledge(o, npcId) !== 'knows');
  if (!hidden.length) return result(false, 'There is nothing they do not know.', 'neutral');
  for (const o of hidden) learn(o, npc, 'knows', 'you told them yourself');
  return result(true, facing(m, hidden[0], 'truth', true), 'neutral');
}

/**
 * What the partner does, knowing: by who they are, how things stood, and what the player says now. They may leave; they
 * may need time; they may try again; nobody has to forgive.
 * @param {'truth'|'another'|'boundaries'|'separate'} choice
 */
export function facing(m, b, choice, confessed = false) {
  const p = player();
  const mainNpc = npcOf(m.npcId);
  const other = npcOf(b.npcId);
  const h = heart(mainNpc);
  m.arc.found = { year: store.state.year, bondId: b.id, choice, confessed };
  remember(mainNpc, 'cheated', confessed ? 'You were unfaithful, and told them yourself.' : 'You were unfaithful, and they found out.');
  note(m, 'found', `${mainNpc.firstName} learned about ${other?.firstName ?? 'the other relationship'}.`);
  m.trust = clamp(m.trust - (confessed ? 35 : 50));
  bump(mainNpc, confessed ? -25 : -40);
  p.stats.mood = clamp(p.stats.mood - 10);
  const leave = (text) => { love.leftBy(mainNpc.id); note(m, 'left', text); m.status = 'ended'; m.end = { ...now(), why: 'they left' }; milestone(`${mainNpc.firstName} left you.`, 'family'); return text; };
  if (choice === 'separate') return leave(`You do not ask ${mainNpc.firstName} to stay, and they do not.`);
  if (choice === 'boundaries') {
    if (rng.chance(clamp((h.casual - 60) / 90 + (h.forgiving - 50) / 200, 0.02, 0.5))) {
      m.open = true; m.exclusive = false;
      const text = `${mainNpc.firstName} is quiet for a long time. "You should have asked me first. But I would rather know than not." You agree new terms: no more secrets.`;
      note(m, 'opened', text);
      return text;
    }
    return leave(`${mainNpc.firstName} hears "different arrangement" and hears only that you want both. They leave.`);
  }
  // Staying together: how forgiving they are, how much was there, whether they were told or found out, what is offered.
  const stay = clamp(0.2 + (h.forgiving - 50) / 110 + (mainNpc.meters.relationship - 30) / 160 + (confessed ? 0.12 : 0) + (choice === 'another' ? 0.12 : 0) + (mainNpc.role === 'spouse' ? 0.08 : 0), 0.04, 0.85);
  if (choice === 'another' && b.status === 'active') { b.status = 'ended'; b.end = { ...now(), why: 'ended to save the other' }; note(b, 'ended', 'You ended it.'); if (other?.alive) bump(other, -15); }
  if (!rng.chance(stay)) return leave(`${mainNpc.firstName} listens to all of it, and then packs a bag. Sorry is not enough.`);
  m.arc.rebuilding = { since: store.state.year };
  const text = h.forgiving >= 60 ? `${mainNpc.firstName} cries, and shouts, and in the end says they are not ready to give up on you. It will take a long time.`
    : `${mainNpc.firstName} asks for time. They do not leave, and they do not forgive you. Not yet.`;
  note(m, 'staying', text);
  return text;
}

// ---------- A Complicated Romance, and what follows it (scenes: data/events/stories/bonds.js) ----------

const queue = (id, cast) => { store.state.pendingEvents.push({ id, cast }); };

/** A choice made in one of the scenes. @returns {string} what happens, told after the scene's own line */
export function bondChoice(value, cast) {
  const p = player();
  const npc = npcOf(cast.them ?? cast.love);
  if (!npc) return '';
  const [scene, choice] = value.split(':');
  if (scene === 'truth' || scene === 'questions') {
    const m = primary();
    const b = bonds().find((x) => x.id === cast.words?.bondId) ?? others()[0];
    if (!m || !b) return '';
    if (scene === 'questions') {
      if (choice === 'truth') { learn(b, npcOf(m.npcId), 'knows', 'you told them when they asked'); return facing(m, b, 'truth', true); }
      if (choice === 'end') { end(b.npcId, 'ended before it was found'); delete b.knows[m.npcId]; return `You end it with ${npcOf(b.npcId).firstName} that week. ${npcOf(m.npcId).firstName} stops asking.`; }
      // Reassured: the doubt stays a doubt, and a lie has been told.
      p.hidden.karma = clamp(p.hidden.karma - 4);
      m.arc.lied = store.state.year;
      return `${npcOf(m.npcId).firstName} wants to believe you, and for now does.`;
    }
    return facing(m, b, choice, false);
  }
  const b = bondWith(npc.id);
  if (!b) return `${npc.firstName} has already gone their own way.`;
  const h = heart(npc);
  b.arc[scene] = { year: store.state.year, choice };
  if (scene === 'complicated') {
    if (choice === 'honest') {
      bump(npc, 5);
      b.arc.answerDue = store.state.year + 1;
      const text = h.commitment >= 55 ? `${npc.firstName} listens. "Then think about it properly. I will ask you again, and I will need an answer."` : `${npc.firstName} says it helps to have it said out loud. Neither of you knows yet what you want.`;
      note(b, 'talk', text);
      return text;
    }
    if (choice === 'public') {
      bump(npc, 8);
      b.promise = { year: store.state.year, what: 'public' };
      const text = `You tell ${npc.firstName} you are ready for people to know, soon. They take your hand. "Soon, then. I am going to hold you to that."`;
      note(b, 'promise', text);
      return text;
    }
    if (choice === 'notReady') {
      bump(npc, -8);
      if (h.commitment >= 70 && rng.chance(0.5)) { theyEnd(b, `${npc.firstName} nods slowly. "Then this is not for me any more." They end it, without anger.`, 'they wanted more'); return b.history.at(-1).text; }
      b.arc.cooling = h.commitment >= 45;
      const text = h.commitment < 45 ? `${npc.firstName} shrugs. "All right. I only wanted to know." Things go on as they were.` : `${npc.firstName} says they need time to think about whether this is enough.`;
      note(b, 'talk', text);
      return text;
    }
    end(npc.id, 'ended after the conversation');
    b.arc.respectful = true;
    return `${npc.firstName} is sad, and not surprised. You part without saying anything you will regret.`;
  }
  if (scene === 'promise') {
    if (choice === 'keep') return goPublic(b, npc);
    if (choice === 'change') {
      bump(npc, -5);
      b.promise = { year: store.state.year, what: 'public', moved: true };
      const text = `${npc.firstName} hears you out. "Once more. Not a third time."`;
      note(b, 'talk', text);
      return text;
    }
    bump(npc, -12);
    b.promise = null;
    if (rng.chance(0.3 + h.commitment / 200)) { theyEnd(b, `"You said soon." ${npc.firstName} does not wait any longer.`, 'a promise not kept'); return b.history.at(-1).text; }
    const text = `${npc.firstName} says they understand. They do not sound as if they do.`;
    note(b, 'talk', text);
    return text;
  }
  if (scene === 'answer') {
    b.arc.answerDue = null;
    if (choice === 'commit') return love.partner() ? goPublic(b, npc) : makeOfficial(npc.id).text;
    if (choice === 'asIs') {
      if (h.commitment >= 60 && rng.chance(0.45)) { theyEnd(b, `${npc.firstName} had hoped for a different answer, and says so, and goes.`, 'they wanted more'); return b.history.at(-1).text; }
      bump(npc, -4);
      const text = `${npc.firstName} accepts it. Whether for good, neither of you can say.`;
      note(b, 'talk', text);
      return text;
    }
    end(npc.id, 'ended when they asked for an answer');
    return `You tell ${npc.firstName} the truth: that you cannot give them what they want.`;
  }
  return '';
}
/** Keeping the promise: with a partner who was promised otherwise, that means telling them. */
function goPublic(b, npc) {
  b.promise = null;
  const m = primary();
  if (!m) return makeOfficial(npc.id).text;
  if (promised()) { learn(b, npcOf(m.npcId), 'knows', 'you told them yourself'); return `You keep your word to ${npc.firstName}. ${facing(m, b, 'truth', true)}`; }
  b.secret = false;
  learn(b, npcOf(m.npcId), 'knows', 'you told them');
  note(b, 'public', 'It is no longer a secret.');
  return `You stop hiding it. ${npc.firstName} is somebody in your life, and people may know.`;
}

// ---------- The year ----------

/**
 * Once a year (engine/yearProcessor.js), whatever the length of a turn: so advancing three months at a time brings no
 * more scenes and no more chances of being found out than a year at once.
 */
export function tickBonds() {
  const p = player();
  if (p.age < ADULT) return;
  const year = store.state.year;
  const m = primary();
  const mainNpc = m ? npcOf(m.npcId) : null;
  for (const b of bonds().filter((x) => x.status === 'active' && x.type !== 'primary')) {
    const npc = npcOf(b.npcId);
    if (!npc?.alive) { b.status = 'ended'; b.end = { ...now(), why: 'they died' }; continue; }
    newChildren(b, npc);
    const h = heart(npc);
    const last = b.acts[year - 1] ? Object.values(b.acts[year - 1]).reduce((s, n) => s + n, 0) : 0;
    bump(npc, last ? rng.int(-2, 2) : rng.int(-9, -3));
    const years = since(b.start);
    // They have their own life: neglected, or wanting what this is not, they go.
    if (npc.meters.relationship < 22 && rng.chance(0.6)) { theyEnd(b, `${npc.firstName} stopped answering, and then told you plainly: it is over.`, 'it went cold'); continue; }
    if (b.arc.cooling && year > (b.arc.complicated?.year ?? year) && rng.chance(0.25 + h.commitment / 250)) { theyEnd(b, `${npc.firstName} has met someone who wants what they want. They tell you kindly, and they go.`, 'a different future'); continue; }
    // A promise made, and the year gone by.
    if (b.promise && year > b.promise.year && !b.arc[`promise${b.promise.year}`]) { b.arc[`promise${b.promise.year}`] = true; queue('bond_promise', { them: npc.id }); continue; }
    if (b.arc.answerDue && year >= b.arc.answerDue) { queue('bond_answer', { them: npc.id }); b.arc.answerDue = null; continue; }
    // A Complicated Romance: someone kept private for a year or more, who wants to know where it is going. Once.
    if (b.secret && !b.arc.complicated && years >= 1 && (h.commitment >= 40 || h.secrecy < 50) && rng.chance(0.3 + h.commitment / 200)) {
      b.arc.complicated = { year, choice: null };
      queue('romance_complicated_001', { them: npc.id });
    }
    // Friends with benefits: now and then one of the two starts to feel more. It is said, not assumed.
    if (b.type === 'fwb' && !b.arc.feelings && years >= 1 && npc.meters.relationship >= 65 && rng.chance(0.1 + h.commitment / 400)) {
      b.arc.feelings = { year };
      note(b, 'feelings', `${npc.firstName} admits this has come to mean more to them than it was supposed to.`);
      log(`${npc.firstName} admits this has come to mean more to them than it was supposed to.`, 'system', 'neutral');
    }
    if (mainNpc && promised()) discovery(b, npc, m, mainNpc, last);
  }
  // Children of the main relationship too; and a home sold from under someone is no longer where they live.
  if (m && mainNpc) newChildren(m, mainNpc);
  for (const n of livingNpcs()) if (n.flags.housedIn && !p.assets.some((a) => a.id === n.flags.housedIn && a.occupant?.npcId === n.id)) delete n.flags.housedIn;
  // Trust, after it was broken: slowly back if nothing more is hidden, or they go after all.
  if (m && mainNpc && m.arc.rebuilding) {
    const hiding = others().some((o) => isAffair(o) && knowledge(o, mainNpc.id) !== 'knows');
    m.trust = clamp(m.trust + (hiding ? -4 : rng.int(5, 10) + Math.round((heart(mainNpc).forgiving - 50) / 12)));
    if (m.trust >= 60) { m.arc.rebuilding = null; m.arc.rebuilt = year; note(m, 'rebuilt', 'It is not what it was. It is something you both chose again.'); log(`${mainNpc.firstName} laughed at something you said this year, the old way. It has taken a long time.`, 'system', 'good'); }
    else if (year - m.arc.rebuilding.since >= 2 && m.trust < 35 && rng.chance(0.4)) { love.leftBy(mainNpc.id); m.status = 'ended'; m.end = { ...now(), why: 'trust did not come back' }; note(m, 'left', 'They tried. It did not come back.'); log(`${mainNpc.firstName} tried, and could not get past it. They have left.`, 'system', 'bad'); }
  }
}

/**
 * How a hidden relationship comes to be known: only through things that happened and people who could have seen or been
 * told. Somebody in the player's life sees them together; somebody who knows tells; the partner at home notices; the
 * person kept secret, promised a change and not given it, says so themselves. Suspecting is not knowing.
 */
function discovery(b, npc, m, mainNpc, seen) {
  if (knowledge(b, mainNpc.id) === 'knows') return;
  const p = player();
  const tell = (how, fromId) => { if (learn(b, mainNpc, 'knows', how, fromId)) queue('bond_truth', { love: mainNpc.id, them: npc.id, words: { bondId: b.id, how } }); };
  // Someone who already knows may say so: more readily the less they care for the player.
  for (const [id, k] of Object.entries(b.knows)) {
    const w = npcOf(id);
    if (!w?.alive || id === mainNpc.id || k.level !== 'knows' || k.year >= store.state.year) continue;
    if (rng.chance(clamp(0.15 + (50 - w.meters.relationship) / 150, 0.03, 0.6))) return tell(`${w.firstName} told them`, w.id);
  }
  // The one kept secret, given a promise that was not kept.
  if (b.arc.promise?.choice === 'explain' && heart(npc).secrecy < 35 && rng.chance(0.25)) return tell(`${npc.firstName} told them`, npc.id);
  if (!seen) return;
  // Seen together by somebody from the rest of the player's life.
  const circle = livingNpcs().filter((n) => p.npcIds.includes(n.id) && n.id !== npc.id && n.id !== mainNpc.id && n.age >= 16 && ['friend', 'sibling', 'parent', 'coworker', 'colleague', 'inlaw'].includes(n.role));
  if (circle.length && rng.chance(Math.min(0.3, 0.05 * seen))) {
    const w = rng.pick(circle);
    learn(b, w, seen >= 3 ? 'knows' : 'suspects', seen >= 3 ? `saw you with ${npc.firstName}` : `saw something, and wondered`);
  }
  // At home: late evenings, a gift that was not for them. A doubt, not proof.
  if (rng.chance(Math.min(0.25, 0.04 * seen * (mainNpc.flags.livesTogether || mainNpc.role === 'spouse' ? 1.5 : 1))) && learn(b, mainNpc, 'suspects', 'noticed something')) {
    queue('bond_questions', { love: mainNpc.id, them: npc.id, words: { bondId: b.id } });
  }
}
