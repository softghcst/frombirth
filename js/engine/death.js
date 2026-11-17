// Mortality maths and the end of a life: the will, the estate and its tax,
// who inherits, and the epitaphs the life earned.
import { eraMortality } from './history.js';
import { COUNTRIES } from '../data/countries.js';
import { settleEstate } from './currency.js';
import { rng } from '../rng.js';
import { styledName } from './royalty.js';
import { uid, localMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { netWorth } from './finance.js';
import { addToGraveyard, deleteSlot, saveGame } from '../save.js';
import { stageLabel } from './education.js';
import { roleLabel } from './relationships.js';
import { heirs } from './legacy.js';
import { onDeath as digitalLegacy } from './digital/legacy.js';
import { careQuality } from './living.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { EPITAPHS, ESTATE_ALLOWANCE } from '../data/epitaphs.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/**
 * Yearly chance of dying, given age and a 0–100 health value. `shift` is how
 * many years younger (or older) than their age someone's body behaves:
 * the constitution they were born with, plus how they look after themselves.
 */
export function mortalityChance(age, health, shift = 0) {
  // Historical Eras: earlier eras shorten old age and add risk at working ages (engine/history.js). Nothing in the present.
  const era = eraMortality(age);
  shift += era.shift;
  const base = 0.0004 + era.extra + Math.min(0.6, Math.exp((age - 95.5 - shift) / 8.5) * 0.3);
  return Math.min(0.95, base * (1.75 - health / 100 * 1.1));
}

/** A newborn's constitution, in years: most are near 0, a few are built to last. */
export function rollLongevity(inherited = 0) {
  const lucky = rng.chance(0.06) ? rng.int(4, 8) : 0;
  return Math.round(Math.max(-10, Math.min(18, rng.around(0, 11) + lucky + inherited * 0.5)));
}

/** Years added or taken off by the way the player lives. */
function careShift(p) {
  let s = 0;
  if (p.flags.checkupAge >= p.age - 2) s += 1.5; // regular check-ups
  if (p.flags.funActs?.gym && p.flags.funActs.age >= p.age - 1) s += 1; // keeps active
  if (p.stats.mood >= 60) s += 1;
  if (p.stats.mood < 25) s -= 2;
  if (p.conditions.some((c) => c.chronic && !c.treated)) s -= 2; // an untreated long-term illness
  s += (careQuality() - 84) / 7; // the standard of care within reach, which money can buy
  return s;
}

const ACCIDENTS = ['a traffic accident', 'a fall', 'a house fire', 'drowning', 'a freak accident'];

/** Rolls the yearly death check. @returns {?string} cause, or null if alive */
export function rollDeath() {
  const p = player();
  const worst = [...p.conditions].sort((a, b) => b.severity - a.severity)[0];
  if (p.stats.health <= 0) return worst ? worst.name.replace(/^an? /, '') : 'failing health';
  if (p.legal.incarceration?.deathRow && p.legal.incarceration.served >= 2 && rng.chance(0.1)) return 'execution';
  if (p.flags.birthDeath) { delete p.flags.birthDeath; return 'complications after childbirth'; }
  if (p.flags.warDeath) { delete p.flags.warDeath; return 'wounds received in the war'; }
  if (!rng.chance(mortalityChance(p.age, p.stats.health, (p.flags.longevity ?? 0) + careShift(p)))) return null;
  if (worst && worst.severity >= 45 && rng.chance(0.7)) return worst.name.replace(/^an? /, '');
  return p.age >= 100 ? 'great old age' : p.age >= 70 ? 'old age' : rng.pick(ACCIDENTS);
}

function lastOccupation(p) {
  if (p.politics) return p.politics.title;
  const top = (p.flags.offices ?? []).reduce((a, b) => (b.tier > (a?.tier ?? 0) ? b : a), null);
  if (top && top.tier >= 4) return `Former ${top.title}`;
  if (p.career.title) return p.career.title;
  if (p.career.retired) return 'Retired';
  const last = p.career.history[p.career.history.length - 1];
  if (last) return `Former ${last.title}`;
  if (p.education.enrolled) return `Student (${stageLabel(p.education.stage).toLowerCase()})`;
  return p.age < 5 ? 'Infant' : 'Unemployed';
}

const people = () => player().npcIds.map((id) => store.state.npcs[id]).filter(Boolean);
const living = (role) => people().filter((n) => n.alive && n.role === role);

// ---------- The will ----------
//
// p.flags.will = { mode, heirs?: [npc ids], items?: { asset id: npc id } }
//   mode 'family'  the default: a spouse takes half, the children share the rest
//        'named'   the people in `heirs`, in equal shares
//        'charity' everything is given away
// `items` says who gets a particular property or vehicle. Nothing is sold at
// death: property and vehicles pass to the heirs as they are, mortgage and all.
// Only investments are cashed in, and estate tax is paid out of the cash.

export const canWriteWill = () => player().age >= 18;

/** People the player could name in a will. */
export const willCandidates = () => people().filter((n) => n.alive
  && ['spouse', 'partner', 'child', 'grandchild', 'greatgrandchild', 'sibling', 'parent', 'niece', 'inlaw', 'relative', 'friend'].includes(n.role));

/** The will as it stands, tidied: old formats are read, and the dead drop out. */
export function currentWill() {
  let w = player().flags.will;
  if (typeof w === 'string') w = { mode: w === 'charity' ? 'charity' : w === 'buried' ? 'buried' : 'family' };
  if (w?.mode === 'person') w = { mode: 'named', heirs: [w.npcId] };
  w = { mode: w?.mode ?? 'family', heirs: (w?.heirs ?? []).filter((id) => store.state.npcs[id]?.alive), items: { ...(w?.items ?? {}) } };
  if (w.mode === 'named' && !w.heirs.length) w.mode = 'family';
  return w;
}

/** With no will naming anyone: a spouse takes half, the children share the rest. */
function familyShares() {
  const spouse = living('spouse')[0];
  const kids = living('child');
  if (spouse && kids.length) return [[spouse, 0.5], ...kids.map((k) => [k, 0.5 / kids.length])];
  if (spouse) return [[spouse, 1]];
  for (const role of ['child', 'grandchild', 'sibling', 'parent']) {
    const group = living(role);
    if (group.length) return group.map((n) => [n, 1 / group.length]);
  }
  return [];
}

/** Who inherits and what fraction of the money each gets. */
export function willHeirs() {
  const w = currentWill();
  if (w.mode === 'charity' || w.mode === 'buried') return [];
  if (w.mode === 'named') return w.heirs.map((id) => [store.state.npcs[id], 1 / w.heirs.length]);
  return familyShares();
}

export function willSummary() {
  const w = currentWill();
  if (w.mode === 'charity') return 'Everything goes to charity.';
  if (w.mode === 'buried') return 'Your cash is buried in the garden. Only the map knows where.';
  const heirs = willHeirs();
  if (!heirs.length) return 'You have no family to leave it to. It would go to the state.';
  if (w.mode === 'named') return heirs.length === 1 ? `Everything goes to ${heirs[0][0].firstName} ${heirs[0][0].lastName}.` : `Shared equally between ${names(heirs.map(([n]) => n))}.`;
  return 'No will written: a spouse takes half and your children share the rest.';
}
const names = (list) => list.map((n) => n.firstName).join(', ').replace(/, ([^,]*)$/, ' and $1');

function saveWill(w, text) {
  player().flags.will = w;
  const line = `${text} ${willSummary()}`;
  log(line);
  return result(true, line, 'neutral');
}

/** Sets the will to the family default or to charity. */
export function writeWill(mode, npcId) {
  if (!canWriteWill()) return result(false, 'You are too young to make a will.', 'neutral');
  if (mode === 'person') return addHeir(npcId, true);
  return saveWill({ mode: mode === 'charity' ? 'charity' : 'family', heirs: [], items: currentWill().items }, 'You signed a new will.');
}

/** Names someone in the will. `only` makes them the sole heir. */
export function addHeir(npcId, only = false) {
  if (!canWriteWill()) return result(false, 'You are too young to make a will.', 'neutral');
  const n = store.state.npcs[npcId];
  if (!willCandidates().some((x) => x.id === npcId)) return result(false, 'You cannot name them.', 'neutral');
  const w = currentWill();
  // Naming people starts from whoever would have inherited anyway, so they can be taken off one by one.
  const base = only ? [] : w.mode === 'named' ? w.heirs : familyShares().map(([x]) => x.id);
  return saveWill({ mode: 'named', heirs: [...new Set([...base, npcId])], items: w.items }, `You added ${n.firstName} to your will.`);
}

/** Takes someone out of the will. Taking out the last person returns it to the family default. */
export function removeHeir(npcId) {
  const n = store.state.npcs[npcId];
  const w = currentWill();
  const base = w.mode === 'named' ? w.heirs : familyShares().map(([x]) => x.id);
  const heirs = base.filter((id) => id !== npcId);
  const items = Object.fromEntries(Object.entries(w.items).filter(([, id]) => id !== npcId));
  return saveWill({ mode: heirs.length ? 'named' : 'family', heirs, items }, `You cut ${n?.firstName ?? 'them'} out of your will.`);
}

/** Says who gets one property or vehicle. They must be an heir. */
export function assignItem(assetId, npcId) {
  const w = currentWill();
  const a = player().assets.find((x) => x.id === assetId);
  const n = store.state.npcs[npcId];
  if (!a || !willHeirs().some(([x]) => x.id === npcId)) return result(false, 'They are not in your will.', 'neutral');
  player().flags.will = { ...w, items: { ...w.items, [assetId]: npcId } };
  const text = `The ${a.name.charAt(0).toLowerCase() + a.name.slice(1)} will go to ${n.firstName}.`;
  log(text);
  return result(true, text, 'neutral');
}

/** Property and vehicles: the things that are handed on as they are. */
export const keepsakes = () => player().assets.filter((a) => a.kind === 'property' || a.kind === 'vehicle');
const equity = (a) => a.value * (a.units ?? 1) - (a.mortgage?.principal ?? 0);

/**
 * What would happen to everything the player owns if they died today.
 * Amounts are in local currency.
 *   gross: everything, less debts · liquid: cash and investments, less loans
 *   tax: estate tax, paid from the liquid part only (nothing is sold to meet it)
 *   shares: each heir's cash and the property and vehicles they receive
 */
export function estatePlan() {
  const p = player();
  const c = country();
  const gross = netWorth(store.state);
  const kept = keepsakes();
  const liquid = gross - kept.reduce((s, a) => s + equity(a), 0);
  const plan = { gross, liquid, tax: 0, net: 0, charity: 0, toState: 0, shares: [] };
  const will = currentWill();
  const item = (a) => ({ id: a.id, name: a.name, kind: a.kind, value: equity(a) });
  if (gross <= 0 && !kept.length) return plan;
  if (will.mode === 'charity') return { ...plan, net: gross, charity: Math.max(0, gross), given: kept.map(item) }; // gifts to charity are not taxed
  if (will.mode === 'buried') return { ...plan, lost: Math.max(0, liquid), ...(kept.length ? distribute(plan, familyShares(), kept, will, 0, item) : {}) };
  // Estate tax by place: property abroad is taxed by the country it stands in; everything else where the player lived.
  const away = {};
  for (const a of kept) if (a.kind === 'property' && a.countryId && a.countryId !== c.id && COUNTRIES[a.countryId]) away[a.countryId] = (away[a.countryId] ?? 0) + Math.max(0, equity(a));
  const abroad = Object.values(away).reduce((s, v) => s + v, 0);
  const due = [{ countryId: c.id, rate: c.estateTax, amount: Math.round(Math.max(0, gross - abroad - localMoney(ESTATE_ALLOWANCE, c)) * c.estateTax) },
    ...Object.entries(away).map(([id, v]) => ({ countryId: id, rate: COUNTRIES[id].estateTax, amount: Math.round(v * COUNTRIES[id].estateTax) }))].filter((d) => d.amount > 0);
  const owed = due.reduce((s, d) => s + d.amount, 0);
  plan.tax = Math.max(0, Math.min(liquid, owed));
  // Paid from cash and investments only; if that does not cover it, each country takes its share of what there is.
  plan.taxBy = due.map((d) => ({ ...d, name: COUNTRIES[d.countryId].name, amount: owed > plan.tax ? Math.round(d.amount * plan.tax / owed) : d.amount }));
  plan.net = gross - plan.tax;
  const split = willHeirs();
  if (!split.length) return { ...plan, toState: plan.net, given: kept.map(item) };
  return { ...plan, ...distribute(plan, split, kept, will, Math.max(0, liquid - plan.tax), item) };
}

/** Shares out the cash by fraction, and each property and vehicle to one heir. */
function distribute(plan, split, kept, will, cash, item) {
  const shares = split.map(([n, part]) => ({ npcId: n.id, name: `${n.firstName} ${n.lastName}`, role: roleLabel(n),
    amount: Math.round(cash * part), items: [] }));
  if (!shares.length) return { shares };
  kept.forEach((a, i) => {
    // Named in the will, or else: the home to the first heir, the rest in turn.
    const to = shares.find((s) => s.npcId === will.items[a.id]) ?? (a.id === player().homeId ? shares[0] : shares[i % shares.length]);
    to.items.push(item(a));
  });
  return { shares };
}

// ---------- Epitaphs ----------

/** The facts of a life that epitaphs are judged on. Money is in base units. */
function lifeSummary(p, plan) {
  const scale = country().currency.scale;
  const all = people();
  const k = p.counters;
  const jobs = [...p.career.history];
  if (p.career.careerId) jobs.push({ careerId: p.career.careerId, title: p.career.title, from: p.age - p.career.yearsInRole, to: p.age });
  const top = (j, back = 0) => { const lv = CAREER_BY_ID[j.careerId]?.levels; return !!lv && lv.slice(lv.length - 1 - back).some((l) => l.title === j.title); };
  const married = all.filter((n) => n.marriedAtAge != null && n.role === 'spouse');
  return {
    age: p.age, worth: plan.gross / scale, donated: k.donated, gambled: k.gambled, leftToCharity: plan.charity / scale,
    fame: p.hidden.fame, karma: p.hidden.karma, intellect: p.stats.intellect,
    crimes: k.crimes, kills: k.kills, convictions: p.legal.record.filter((r) => r.convicted).length,
    yearsJailed: k.yearsJailed, escapes: k.escapes, diedInside: !!p.legal.incarceration,
    spouses: k.spouses, everMarried: k.spouses > 0, exes: all.filter((n) => n.role === 'ex').length,
    marriedYears: Math.max(0, ...married.map((n) => p.age - n.marriedAtAge)),
    children: all.filter((n) => n.role === 'child').length,
    descendants: all.filter((n) => ['child', 'grandchild', 'greatgrandchild'].includes(n.role)).length,
    jobsHeld: k.jobsHeld, reachedTop: jobs.some((j) => top(j)),
    stageStar: jobs.some((j) => ['mt_performer', 'actor', 'singer'].includes(j.careerId) && top(j, 1)),
    healerYears: jobs.filter((j) => ['doctor', 'nurse'].includes(j.careerId)).reduce((s, j) => s + (j.to - j.from), 0),
    degrees: p.education.degrees.map((d) => d.type),
    followers: Math.max(0, p.social.followers - p.social.boughtFollowers), countries: k.countriesLived,
    visited: new Set([...(p.flags.visited ?? []), ...(p.flags.passport ?? []).map((x) => x.id)]).size,
    generation: p.generation ?? 1, earned: p.finance.lifetimeEarned / scale, livesSaved: k.livesSaved ?? 0,
    properties: p.assets.filter((a) => a.kind === 'property').length, vehicles: p.assets.filter((a) => a.kind === 'vehicle').length,
    greatGrandchildren: all.filter((n) => n.role === 'greatgrandchild').length,
    talents: Object.values(p.talents).filter((v) => v >= 80).length, music: p.talents.music ?? 0,
    childStar: !!p.flags.childStar || !!p.flags.childActor, lifeSentence: (p.legal.incarceration?.yearsLeft ?? 0) >= 50,
    neverMoved: k.countriesLived === 1 && !(p.flags.visited ?? []).length, holidays: k.holidays ?? 0,
    surgeries: k.surgeries ?? 0, mood: p.stats.mood, health: p.stats.health,
    reigned: !!p.flags.reigned, abdicated: !!p.flags.abdicated, consort: p.royal?.by === 'marriage' && ['monarch', 'heir', 'royal'].includes(p.royal.rank),
    bornTitled: p.royal?.by === 'birth', honoured: !!p.flags.honouredAs, lostTitle: !!p.flags.lostTitle && !p.royal,
    marriedRoyal: !!p.flags.marriedRoyal, image: p.royal?.image ?? 0,
    topOffice: Math.max(0, p.politics?.tier ?? 0, ...(p.flags.offices ?? []).map((o) => o.tier)), yearsInOffice: k.yearsInOffice ?? 0,
    electionsWon: k.electionsWon ?? 0, electionsLost: k.electionsLost ?? 0, ruledAlone: !!p.flags.ruledAlone,
    removedFromOffice: !!p.flags.removedFromOffice, approval: p.politics?.approval ?? 0,
  };
}

/** Ids of every epitaph a life earned, the defining one first. */
export const earnedEpitaphs = (summary) => EPITAPHS.filter((e) => e.earned(summary)).map((e) => e.id);

// ---------- The end ----------

/** Ends the current life and files it in the graveyard. */
export function die(cause) {
  const state = store.state;
  const p = player();
  const c = country();
  if (!p.alive) return store.lastObituary;
  settleEstate(); // money held in other currencies is counted once, in one currency
  const plan = estatePlan(); // settled before anything else changes
  const summary = lifeSummary(p, plan);
  p.alive = false;
  digitalLegacy(state); // accounts become memorials; nothing new is posted in their name
  log(`You died of ${cause} at age ${p.age}.`, 'system', 'bad');

  for (const s of plan.shares) {
    const n = state.npcs[s.npcId];
    if (n.life) n.life.savings += s.amount; else n.savings = (n.savings ?? 0) + s.amount;
    // The property and vehicles themselves, kept whole: whoever carries on as this person owns them.
    const things = s.items.map((it) => JSON.parse(JSON.stringify(p.assets.find((a) => a.id === it.id))));
    if (things.length) {
      n.inheritance = { assets: [...(n.inheritance?.assets ?? []), ...things] };
      n.holdings = [...(n.holdings ?? []), ...things.map((a) => a.name)];
    }
  }
  if (plan.charity) p.counters.donated += Math.round(plan.charity / c.currency.scale);

  const spouse = people().find((n) => n.role === 'spouse');
  /** @type {import('../types.js').GraveyardEntry} */
  const entry = {
    id: uid('grave'),
    fullName: styledName(p),
    gender: p.gender,
    ageAtDeath: p.age,
    birthYear: p.birthYear,
    deathYear: state.year,
    causeOfDeath: cause,
    netWorth: plan.gross,
    countryId: p.countryId,
    city: p.city,
    lastOccupation: lastOccupation(p),
    epitaphIds: earnedEpitaphs(summary),
    childrenCount: summary.children,
    grandchildrenCount: summary.descendants - summary.children,
    spouseName: spouse ? `${spouse.firstName} ${spouse.lastName}` : null,
    lifetimeEarned: p.finance.lifetimeEarned,
    estate: plan,
    milestones: p.milestones,
    counters: p.counters,
    generation: p.generation,
    continuedAs: null,
  };
  addToGraveyard(entry);
  // While there is someone to carry on as, the save is kept so the choice survives a refresh.
  state.legacy = { graveId: entry.id };
  if (heirs(state).length) saveGame(state); else deleteSlot(state.slotId, true);
  store.lastObituary = entry;
  return entry;
}
