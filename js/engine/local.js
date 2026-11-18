// Local and regional government: what a mayor or the head of a region
// decides about their own patch, and what it does to life there.
//
// On the political world of a country:
//   w.local  { placeKey: { rates, services, safety, housing, budget } }
//     placeKey  a city's name for a mayor's decisions; 'region:<city>' for a regional government's
//     each level runs from -2 to 2, moved one step at a time, as national policy does
// The levels stay when the office-holder goes: the next one inherits them.
// What they do to daily life is read through engine/policy.js.
import * as law from './rules.js';
import { cityOf } from './cities.js';
import { post as econPost } from './economy.js';
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player } from '../state.js';
import { LOCAL_LEVERS } from '../data/parties.js';
import { tally } from './legislature.js';
import * as world from './polity.js';
import { post } from './news.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', more = {}) => ({ ok, text, tone, ...more });
const noise = (n) => (rng.next() * 2 - 1) * n;
const round = (n) => Math.round(n * 10) / 10;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Whether the office the player holds runs a place: a city or a region. */
export const runsPlace = () => ['mayor', 'region'].includes(player().politics?.officeId);
const keyFor = (p = player()) => (p.politics?.officeId === 'region' ? `region:${p.city}` : p.city);
const blank = () => ({ rates: 0, services: 0, safety: 0, housing: 0, budget: 0 });

/**
 * The council or assembly of the place. Its make-up follows the country's
 * parties, except that whoever won the office brought their own side in
 * with them: forty seats, eighteen of them the office-holder's party's.
 */
function chamber(w, mine) {
  const others = w.parties.filter((q) => q.id !== mine?.id);
  const total = others.reduce((s, q) => s + (w.seats[q.id] ?? 0), 0) || 1;
  const left = mine ? 22 : 40;
  const seats = {};
  let given = 0;
  others.forEach((q, i) => { const n = i === others.length - 1 ? left - given : Math.round(left * (w.seats[q.id] ?? 0) / total); seats[q.id] = Math.max(0, n); given += seats[q.id]; });
  if (mine) seats[mine.id] = 18;
  return seats;
}

/** The state of a place, made the first time it is needed. */
export function place(key = keyFor(), countryId = player().countryId) {
  const w = world.polity(countryId);
  w.local ??= {};
  return (w.local[key] ??= blank());
}
/** Local levels where the player lives: the city's, plus the region's. Used by engine/policy.js. */
export function levelsAt(p = player()) {
  const local = store.state?.polities?.[p.countryId]?.local;
  const a = local?.[p.city];
  const b = local?.[`region:${p.city}`];
  const sum = (k) => (a?.[k] ?? 0) + (b?.[k] ?? 0);
  return { rates: sum('rates'), services: sum('services'), safety: sum('safety'), housing: sum('housing') };
}

const WORDS = ['Cut to the bone', 'Squeezed', 'As it has long been', 'Generous', 'Lavish'];
/** The place's finances, for the budget screen. */
export function budgetView() {
  const p = player();
  const k = p.politics;
  const x = place();
  const region = k?.officeId === 'region';
  return { balance: x.budget, debt: null, floor: -3, presented: k?.localBudgetAge === p.age, fragile: false,
    push: `${region ? 'The assembly' : 'The council'} can throw it out, and the local paper would enjoy that. How hard will you push?`,
    title: region ? 'The region\'s money' : 'The city\'s money', eyebrow: region ? 'The regional budget' : 'The city budget',
    intro: `${region ? 'Regional' : 'Local'} taxes bring money in; everything else spends it. One step each way at most. ${region ? 'The regional assembly' : 'The council'} votes on the whole of it.`,
    rows: Object.entries(LOCAL_LEVERS).map(([id, L]) => ({ lever: id, name: cap(L.name), dept: '', minister: null, at: x[id], income: L.cost < 0, canRaise: x[id] < 2, canCut: x[id] > -2,
      words: id === 'rates' ? ['Very low', 'Low', 'As they have long been', 'High', 'Very high'] : WORDS })) };
}
export const balanceAfter = (changes) => round(place().budget - Object.entries(changes).reduce((s, [id, dir]) => s + LOCAL_LEVERS[id].cost * dir, 0));
export const voteOptions = () => [
  { id: 'none', name: 'Let it go to the vote', sub: 'Trust the arithmetic.' },
  world.membership(player().countryId) ? { id: 'whip', name: 'Lean on your own side', sub: 'Fewer rebels. They resent it.' } : null,
  { id: 'public', name: 'Take it to a public meeting first', sub: player().politics.approval >= 50 ? 'You are popular enough for it to count.' : 'You are not popular. It may count against you.' },
].filter(Boolean);

/**
 * Presents the year's budget for the place. The council (or assembly) is
 * made up as the national legislature is, and votes the same way.
 * @param {Object<string,number>} changes  lever → +1 or -1
 */
export function presentBudget(changes, move = 'none') {
  const p = player();
  const k = p.politics;
  if (!runsPlace()) return result(false, 'That is not in your power.', 'neutral');
  if (k.localBudgetAge === p.age) return result(false, 'This year\'s budget has already been presented.', 'neutral');
  const w = world.polity(p.countryId);
  const x = place();
  const list = Object.entries(changes).filter(([id, dir]) => LOCAL_LEVERS[id] && (dir === 1 || dir === -1) && Math.abs(x[id] + dir) <= 2);
  if (balanceAfter(Object.fromEntries(list)) < -3) return result(false, 'The treasurer will not sign it: the place cannot borrow that much.', 'neutral');
  k.localBudgetAge = p.age;
  const body = k.officeId === 'region' ? 'assembly' : 'council';
  if (!list.length) return result(true, `A budget that changes nothing. The ${body} nods it through.`, 'neutral');
  const wants = {};
  for (const [id, dir] of list) wants[LOCAL_LEVERS[id].follows] = Math.sign((wants[LOCAL_LEVERS[id].follows] ?? 0) + dir);
  for (const i of Object.keys(wants)) if (!wants[i]) delete wants[i];
  let t = null;
  if (w.kind !== 'party' && w.kind !== 'none' && w.parties.length) {
    const mine = world.membership(p.countryId);
    // Local politics is less tribal than national: the other parties will back a budget that is not far from what they want.
    t = tally(w.parties, chamber(w, mine), { wants }, { lead: mine?.id ?? null, partners: [], noise, whip: move === 'whip' ? 0.1 : 0, sway: 0.22 + (move === 'public' ? (k.approval - 50) / 150 : 0) + (mine ? 0 : 0.12) });
    if (move === 'whip') k.approval = Math.round(clamp(k.approval - 1));
    if (!t.passes) {
      k.approval = Math.round(clamp(k.approval - 4));
      return result(false, `Your budget is voted down by the ${body}, ${t.for} to ${t.against}. Last year's figures stand, and the local paper enjoys itself.`, 'bad',
        { tally: { for: t.for, against: t.against, need: t.need, rows: w.parties.filter((q) => t.byParty[q.id]).map((q) => ({ name: q.name, color: q.color, ...t.byParty[q.id] })) } });
    }
  }
  let liked = 0;
  const done = [];
  for (const [id, dir] of list) {
    const L = LOCAL_LEVERS[id];
    x[id] += dir;
    x.budget = round(x.budget - L.cost * dir);
    liked += L.cost < 0 ? -dir : dir;
    done.push(dir > 0 ? L.up : L.down);
  }
  k.approval = Math.round(clamp(k.approval + liked * 2));
  post(w, `${k.title} ${p.firstName} ${p.lastName} of ${p.city} has ${done.join('; ')}.`, { you: true });
  return result(true, `${t ? `The ${body} passes your budget, ${t.for} to ${t.against}.` : 'Your budget is adopted.'} You have ${done.join('; ')}. ${Object.entries(LOCAL_LEVERS).filter(([id]) => list.some(([q]) => q === id)).map(([id, L]) => L.feel(x[id])).join(' ')}`, 'good',
    { tally: t ? { for: t.for, against: t.against, need: t.need, rows: w.parties.filter((q) => t.byParty[q.id]).map((q) => ({ name: q.name, color: q.color, ...t.byParty[q.id] })) } : null });
}

/** Yearly, for whoever runs a place: books that do not balance catch up with them, and well-run places are noticed. */
export function tickLocal() {
  const p = player();
  const k = p.politics;
  if (!k || !runsPlace()) return [];
  const x = place();
  const lines = [];
  if (x.budget <= -2) { k.approval = Math.round(clamp(k.approval - 3)); lines.push({ text: `${k.officeId === 'region' ? 'The region' : p.city} is spending more than it raises, and the auditors have written to say so.`, tone: 'bad' }); }
  const neglected = ['services', 'safety', 'housing'].filter((id) => x[id] < 0).length;
  const cared = ['services', 'safety', 'housing'].filter((id) => x[id] > 0).length;
  k.approval = Math.round(clamp(k.approval + cared - neglected * 1.5));
  return lines;
}

// ---------- Regional law ----------
// The head of a region can change the laws a region controls (data/rules.js REGIONAL_POWERS: which ones depends on the country), in countries whose
// regions make law. The regional assembly votes as it does on the budget. What passes applies to everyone living
// in the region, until the region or the nation changes it again.

/** The region the player governs: its id for the rule engine, and its name. */
export function myRegion(p = player()) {
  if (p.politics?.officeId !== 'region') return null;
  const id = law.lawRegion(p.countryId, p.city);
  const name = cityOf(p.countryId, p.city).region ?? `the area around ${p.city}`;
  return { id, name };
}
/** What a region of the player's country may decide, in words. */
export function regionalPowersLine(p = player()) {
  const W = { deathPenalty: 'the death penalty', gambling: 'whether gambling is allowed', gamblingAge: 'the gambling age', drivingAge: 'the driving age', drinkingAge: 'the drinking age', alcohol: 'whether alcohol is allowed' };
  const list = law.regionalPowers(p.countryId).map((id) => W[id] ?? id);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] ?? 'nothing';
}
/** Whether the player can change regional law now, and if not, why. */
export function regionalLawBlock(p = player()) {
  if (p.politics?.officeId !== 'region') return 'Only the head of a region can change its laws.';
  if (!law.regionsLegislate(p.countryId)) return 'In this country the law is made nationally; regions cannot change it.';
  return '';
}
/** What could be changed, with how the vote looks. */
export function regionalLawOptions() {
  const p = player();
  const r = myRegion(p);
  if (!r || regionalLawBlock(p)) return [];
  const w = world.polity(p.countryId);
  const mine = world.membership(p.countryId);
  return law.regionalChoices(p.countryId, r.id).map((c) => {
    const t = w.parties.length ? tally(w.parties, chamber(w, mine), { wants: c.wants }, { lead: mine?.id ?? null, partners: [], noise: () => 0, sway: 0.22 + (mine ? 0 : 0.12) }) : null;
    return { ...c, name: cap(c.name), outlook: !t ? 'Yours to decide.' : t.for >= t.need + 4 ? 'The assembly looks likely to pass it.' : t.for >= t.need - 4 ? 'It would be close.' : 'The assembly is against it.' };
  });
}
/** Puts a regional law to the assembly. One a year. */
export function putRegionalLaw(ruleId, value, move = 'none') {
  const p = player();
  const k = p.politics;
  const block = regionalLawBlock(p);
  if (block) return result(false, block, 'neutral');
  if (k.regionalLawAge === p.age) return result(false, 'The assembly has dealt with your law for this year.', 'neutral');
  const r = myRegion(p);
  const c = law.regionalChoices(p.countryId, r.id).find((x) => x.rule === ruleId && x.value === value);
  if (!c) return result(false, 'That is already the law here.', 'neutral');
  k.regionalLawAge = p.age;
  const w = world.polity(p.countryId);
  const mine = world.membership(p.countryId);
  let t = null;
  if (w.kind !== 'party' && w.kind !== 'none' && w.parties.length) {
    t = tally(w.parties, chamber(w, mine), { wants: c.wants }, { lead: mine?.id ?? null, partners: [], noise, whip: move === 'whip' ? 0.1 : 0, sway: 0.22 + (move === 'public' ? (k.approval - 50) / 150 : 0) + (mine ? 0 : 0.12) });
    if (move === 'whip') k.approval = Math.round(clamp(k.approval - 1));
    if (!t.passes) {
      k.approval = Math.round(clamp(k.approval - 3));
      return result(false, `The assembly of ${r.name} voted down your law to ${c.name}, ${t.for} to ${t.against}.`, 'bad',
        { tally: { for: t.for, against: t.against, need: t.need, rows: w.parties.filter((q) => t.byParty[q.id]).map((q) => ({ name: q.name, color: q.color, ...t.byParty[q.id] })) } });
    }
  }
  const e = law.enactRegional(p.countryId, r.id, c.rule, c.value, cap(r.name), `${p.firstName} ${p.lastName}`);
  econPost(p.countryId, 'law', e.text, 'neutral', false);
  post(w, `${k.title} ${p.firstName} ${p.lastName}: ${e.text}`, { you: true });
  k.approval = Math.round(clamp(k.approval + c.liked));
  const shown = t ? { for: t.for, against: t.against, need: t.need, rows: w.parties.filter((q) => t.byParty[q.id]).map((q) => ({ name: q.name, color: q.color, ...t.byParty[q.id] })) } : null;
  return result(true, `${t ? `By ${t.for} votes to ${t.against}, the` : 'The'} assembly passed it: ${e.text} It is the law for everyone living in ${r.name}.${c.liked <= -3 ? ' It is not popular.' : c.liked >= 2 ? ' People here are pleased.' : ''}`, 'good', { tally: shown });
}
