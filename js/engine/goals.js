// Life goals (data/goals.js): one chosen at a time, from 16. Each step is read from what the game already keeps, once a
// year and whenever the goal screen is opened; a step reached stays reached. All four, and the goal's reward is earned:
// a small, lasting edge (read with the traits, engine/traits.js, never counted among them), and a line in the life story.
//
//   p.goals = { current: goalId | null, progress: { [goalId]: { done: { [step]: age } } }, finished: [{ id, age, year }], badges: [rewardId], told16 }
//
// Switching goals keeps what was reached on each, so nothing done is lost.
import { store, player, country, log, milestone } from '../state.js';
import { localMoney } from '../util.js';
import { netWorth } from './finance.js';
import { levelOf } from './skills.js';
import { SKILLS } from '../data/skills.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { OFFICES } from '../data/politics.js';
import { GOALS, GOAL_BY_ID, BADGE_BY_ID, GOAL_AGE } from '../data/goals.js';
import { applyMods } from './genetics.js';
import { myAthlete } from './sports.js';
import { myAwards } from './awards.js';

const G = (p = player()) => (p.goals ??= { current: null, progress: {}, finished: [], badges: [] });
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

// ---------- What the game already knows ----------

const mine = (p, roles) => Object.values(store.state.npcs).filter((n) => p.npcIds.includes(n.id) && roles.includes(n.role));
const spouseNow = (p) => mine(p, ['spouse']).find((n) => n.alive);
const level = (p) => p.career?.level ?? 0;
const inField = (p, list) => !!p.career?.careerId && list.includes(p.career.careerId);
const topLevel = (id) => Math.max(0, (CAREER_BY_ID[id]?.levels?.length ?? 1) - 1);
const officeTier = (p) => OFFICES.find((o) => o.id === p.politics?.officeId)?.tier ?? 0;
const countriesSeen = (p) => new Set([...(p.flags.visited ?? []), ...(p.trips ?? []).filter((t) => !t.refused).map((t) => t.countryId),
  ...(p.travel?.trips ?? []).filter((t) => t.status === 'completed').map((t) => t.destination?.countryId)].filter((c) => c && c !== p.birthCountryId)).size;
const ended = (p) => mine(p, ['ex']).some((n) => n.flags?.wasSpouse) || mine(p, ['spouse']).some((n) => !n.alive) || (p.counters?.spouses ?? 0) >= 2;
const sportLevel = (p) => {
  const sports = Object.values(myAthlete()?.sports ?? {});
  if (sports.some((e) => e.level === 'pro' || e.contractId || e.proYear)) return 2;
  return sports.some((e) => e.status === 'active' && e.level && e.level !== 'recreational') ? 1 : 0;
};

/** Each check: whether this step is reached now. `n` is the step's threshold. */
const CHECKS = {
  married: (p) => (p.counters?.spouses ?? 0) >= 1 || !!spouseNow(p),
  partnered: (p) => mine(p, ['partner', 'spouse', 'ex']).length > 0,
  children: (p, n) => mine(p, ['child']).length >= n,
  grandchildren: (p, n) => mine(p, ['grandchild']).length >= n,
  worth: (p, n) => netWorth(store.state) >= localMoney(n, country()),
  skill: (p, n) => SKILLS.some((s) => levelOf(s.id) >= n),
  countries: (p, n) => countriesSeen(p) >= n,
  livedAbroad: (p) => (p.counters?.countriesLived ?? 1) >= 2,
  degree: (p, n) => (p.education?.degrees ?? []).some((d) => (n === 'graduate' ? ['graduate', 'law', 'medical', 'podiatric', 'doctorate'].includes(d.type) : n === 'university' ? ['university', 'graduate', 'doctorate'].includes(d.type) : d.type === n)),
  field: (p, list) => inField(p, list),
  rank: (p, [list, n]) => inField(p, list) && level(p) >= n,
  top: (p, list) => inField(p, list) && level(p) >= topLevel(p.career.careerId) && topLevel(p.career.careerId) > 0,
  promotions: (p, n) => (p.career?.promotions ?? 0) >= n,
  donated: (p, n) => (p.counters?.donated ?? 0) >= localMoney(n, country()),
  karma: (p, n) => (p.hidden?.karma ?? 0) >= n,
  office: (p, n) => officeTier(p) >= n,
  hostTradition: () => (store.state.traditions ?? []).some((t) => t.status === 'active' && t.hostId === 'you'),
  tradition: (p, n) => (store.state.traditions ?? []).some((t) => t.participants?.includes('you') && t.count >= n),
  traditions: (p, n) => (store.state.traditions ?? []).filter((t) => t.status === 'active' && t.participants?.includes('you')).length >= n,
  businesses: (p, n) => (p.businesses ?? []).filter((b) => !b.closed && !b.sold && b.status !== 'closed' && b.status !== 'sold').length >= n,
  fame: (p, n) => (p.hidden?.fame ?? 0) >= n,
  sportLevel: (p, n) => sportLevel(p) >= n,
  awards: (p, n) => myAwards(p).length >= n,
  marriedYears: (p, n) => { const s = spouseNow(p); return !!s && s.marriedAtAge != null && p.age - s.marriedAtAge >= n; },
  romances: (p, n) => mine(p, ['partner', 'spouse', 'ex']).length >= n,
  singleAt: (p, n) => p.age >= n && (p.counters?.spouses ?? 0) === 0 && !spouseNow(p),
  loveEnded: (p) => ended(p),
  loveAgain: (p) => ended(p) && mine(p, ['partner', 'spouse']).some((n) => n.alive),
  remarried: (p) => (p.counters?.spouses ?? 0) >= 2,
};
const reached = (p, step) => { try { return !!CHECKS[step[1]]?.(p, step[2]); } catch { return false; } };

// ---------- The goal ----------

/** Whether goals are open to this person yet. */
export const goalsOpen = (p = player()) => !!p?.alive && p.age >= GOAL_AGE;
export const currentGoal = (p = player()) => GOAL_BY_ID[G(p).current] ?? null;
export const badges = (p = player()) => (p.goals?.badges ?? []).map((id) => BADGE_BY_ID[id]).filter(Boolean);
export const finished = (p = player()) => G(p).finished.map((f) => ({ ...f, goal: GOAL_BY_ID[f.id] }));

/** A goal's steps, with which are reached (and at what age). */
export function stepsOf(goalId, p = player()) {
  const g = GOAL_BY_ID[goalId];
  const done = G(p).progress[goalId]?.done ?? {};
  return g.steps.map((s, i) => ({ text: s[0], done: done[i] != null, age: done[i] }));
}
/** Every goal, for the choosing screen: whether it can be chosen, and how far along it already is. */
export function choices(p = player()) {
  const fin = new Set(G(p).finished.map((f) => f.id));
  return GOALS.map((g) => ({ goal: g, finished: fin.has(g.id), current: G(p).current === g.id, reached: stepsOf(g.id, p).filter((s) => s.done).length }));
}

/** Sets the goal to work toward. What was reached on any goal is kept. */
export function chooseGoal(goalId, p = player()) {
  if (!goalsOpen(p)) return result(false, `Life goals open at ${GOAL_AGE}.`, 'neutral');
  const g = GOAL_BY_ID[goalId];
  if (!g) return result(false, 'There is no such goal.', 'neutral');
  if (G(p).finished.some((f) => f.id === goalId)) return result(false, 'You have done that one already.', 'neutral');
  G(p).current = goalId;
  log(`Your life goal: ${g.name}. ${g.blurb}`, 'system', 'good');
  const lines = checkGoal(p);
  return result(true, [`Your life goal is ${g.name}.`, ...lines].join(' '));
}

/**
 * Marks the steps of the current goal reached now, and finishes it when all are. Returns what was reached, as lines.
 * Called once a year, and when a goal is chosen.
 */
export function checkGoal(p = player()) {
  const g = currentGoal(p);
  if (!g || !p.alive) return [];
  const pr = (G(p).progress[g.id] ??= { done: {} });
  const lines = [];
  g.steps.forEach((s, i) => {
    if (pr.done[i] != null || !reached(p, s)) return;
    pr.done[i] = p.age;
    const left = g.steps.length - Object.keys(pr.done).length;
    const text = `${g.name}: ${s[0].charAt(0).toLowerCase()}${s[0].slice(1)}.${left ? ` ${left} step${left === 1 ? '' : 's'} to go.` : ''}`;
    lines.push(text);
    log(text, 'system', 'good');
    p.stats.mood = Math.min(100, p.stats.mood + 3);
  });
  if (Object.keys(pr.done).length === g.steps.length) {
    G(p).finished.push({ id: g.id, age: p.age, year: store.state.year });
    G(p).current = null;
    G(p).badges.push(g.reward.id);
    applyMods(p, { stats: g.reward.stats ?? {} });
    milestone(`Achieved a life goal: ${g.name}.`, 'life');
    const text = `You did it: ${g.name}. You have earned something that stays with you: ${g.reward.name}. ${g.reward.desc} Choose another goal when you are ready (Self).`;
    log(text, 'system', 'good');
    lines.push(text);
  }
  return lines;
}

/** Once a year: the current goal's steps, and at 16, word that goals are open. */
export function tickGoals() {
  const p = player();
  if (!p?.alive) return;
  if (p.age >= GOAL_AGE && !G(p).told16 && !G(p).current) {
    G(p).told16 = true;
    log('You can choose a life goal now: something to work toward, with a reward at the end. See Self.', 'system', 'good');
  }
  checkGoal(p);
}

/** For the tests. */
export const internals = { CHECKS, reached };
