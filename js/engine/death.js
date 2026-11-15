// Mortality maths and the end of a life: the will, the estate and its tax,
// who inherits, and the epitaphs the life earned.
import { rng } from '../rng.js';
import { uid, localMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { netWorth } from './finance.js';
import { addToGraveyard, deleteSlot, saveGame } from '../save.js';
import { stageLabel } from './education.js';
import { roleLabel } from './relationships.js';
import { heirs } from './legacy.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { EPITAPHS, ESTATE_ALLOWANCE } from '../data/epitaphs.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/**
 * Yearly chance of dying, given age and a 0–100 health value. `shift` is how
 * many years younger (or older) than their age someone's body behaves:
 * the constitution they were born with, plus how they look after themselves.
 */
export function mortalityChance(age, health, shift = 0) {
  const base = 0.0004 + Math.min(0.6, Math.exp((age - 95.5 - shift) / 8.5) * 0.3);
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
  return s;
}

const ACCIDENTS = ['a traffic accident', 'a fall', 'a house fire', 'drowning', 'a freak accident'];

/** Rolls the yearly death check. @returns {?string} cause, or null if alive */
export function rollDeath() {
  const p = player();
  const worst = [...p.conditions].sort((a, b) => b.severity - a.severity)[0];
  if (p.stats.health <= 0) return worst ? worst.name.replace(/^an? /, '') : 'failing health';
  if (!rng.chance(mortalityChance(p.age, p.stats.health, (p.flags.longevity ?? 0) + careShift(p)))) return null;
  if (worst && worst.severity >= 45 && rng.chance(0.7)) return worst.name.replace(/^an? /, '');
  return p.age >= 100 ? 'great old age' : p.age >= 70 ? 'old age' : rng.pick(ACCIDENTS);
}

function lastOccupation(p) {
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

export const canWriteWill = () => player().age >= 18;

/** People the player could leave everything to. */
export const willCandidates = () => people().filter((n) => n.alive
  && ['spouse', 'partner', 'child', 'grandchild', 'sibling', 'parent', 'niece', 'friend'].includes(n.role));

/** @returns {{mode:'family'|'person'|'charity', npcId?:string}} */
export function currentWill() {
  let w = player().flags.will;
  if (typeof w === 'string') w = { mode: w === 'charity' ? 'charity' : w === 'buried' ? 'buried' : 'family' };
  if (w?.mode === 'person' && !store.state.npcs[w.npcId]?.alive) return { mode: 'family' };
  return w ?? { mode: 'family' };
}

export function willSummary() {
  const w = currentWill();
  if (w.mode === 'charity') return 'Everything goes to charity.';
  if (w.mode === 'buried') return 'Your cash is buried in the garden. Only the map knows where.';
  if (w.mode === 'person') { const n = store.state.npcs[w.npcId]; return `Everything goes to ${n.firstName} ${n.lastName}.`; }
  return familyShares().length ? 'Shared among your closest family.' : 'You have no family to leave it to. It would go to the state.';
}

export function writeWill(mode, npcId) {
  const p = player();
  if (!canWriteWill()) return result(false, 'You are too young to make a will.', 'neutral');
  if (mode === 'person' && !willCandidates().some((n) => n.id === npcId)) return result(false, 'You cannot name them.', 'neutral');
  p.flags.will = mode === 'person' ? { mode, npcId } : { mode };
  const text = `You signed a new will. ${willSummary()}`;
  log(text);
  return result(true, text, 'neutral');
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

/**
 * What would happen to everything the player owns if they died today.
 * Amounts are in local currency.
 * @returns {{gross:number, tax:number, net:number, charity:number, toState:number,
 *            shares:{npcId:string, name:string, role:string, amount:number}[]}}
 */
export function estatePlan() {
  const c = country();
  const gross = netWorth(store.state);
  const plan = { gross, tax: 0, net: 0, charity: 0, toState: 0, shares: [] };
  if (gross <= 0) return plan;
  const will = currentWill();
  if (will.mode === 'charity') return { ...plan, net: gross, charity: gross }; // gifts to charity are not taxed
  if (will.mode === 'buried') return { ...plan, lost: gross }; // nobody ever finds it
  plan.tax = Math.round(Math.max(0, gross - localMoney(ESTATE_ALLOWANCE, c)) * c.estateTax);
  plan.net = gross - plan.tax;
  const split = will.mode === 'person' ? [[store.state.npcs[will.npcId], 1]] : familyShares();
  if (!split.length) return { ...plan, toState: plan.net };
  plan.shares = split.map(([n, part]) => ({ npcId: n.id, name: `${n.firstName} ${n.lastName}`, role: roleLabel(n),
    amount: Math.round(plan.net * part) }));
  return plan;
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
  const plan = estatePlan(); // settled before anything else changes
  const summary = lifeSummary(p, plan);
  p.alive = false;
  log(`You died of ${cause} at age ${p.age}.`, 'system', 'bad');

  for (const s of plan.shares) {
    const n = state.npcs[s.npcId];
    if (n.life) n.life.savings += s.amount; else n.savings = (n.savings ?? 0) + s.amount;
  }
  if (plan.charity) p.counters.donated += Math.round(plan.charity / c.currency.scale);

  const spouse = people().find((n) => n.role === 'spouse');
  /** @type {import('../types.js').GraveyardEntry} */
  const entry = {
    id: uid('grave'),
    fullName: `${p.firstName} ${p.lastName}`,
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
  if (heirs(state).length) saveGame(state); else deleteSlot(state.slotId);
  store.lastObituary = entry;
  return entry;
}
