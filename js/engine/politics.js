// Politics: running for office, elections, governing, and being thrown out.
//
// On the player:
//   p.politics = { officeId, title, tier, termLeft, terms, approval, since, salary, ruler? }
//     approval  0–100, what the voters (or the party) think of how the job is being done
//     ruler     true once elections have been done away with
//   p.counters.polExp        experience that counts with voters: student council, debating, study, years served
//   p.counters.electionsWon / electionsLost / yearsInOffice
//   p.flags.offices          every office held: [{ title, tier, from, to }]
import { rng } from '../rng.js';
import { clamp, localMoney, localWage, fmtMoney, theCountry } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { SYSTEMS, OFFICES, PLATFORMS, BUDGETS, MOVES, ACTIONS, ACTIONS_PER_YEAR, REMOVAL } from '../data/politics.js';
import { ROYAL_RANKS } from '../data/royalty.js';
import { incomeTax } from './finance.js';
import { quitCareer } from './career.js';
import * as world from './polity.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const system = (c = country()) => SYSTEMS[c.id] ?? { kind: 'none' };
export const inOffice = () => player().politics ?? null;
export const isDemocracy = (c = country()) => ['presidential', 'parliamentary'].includes(system(c).kind);

/** What an office is called in a country. */
export function officeTitle(id, c = country()) {
  const s = system(c);
  return { council: s.kind === 'party' ? 'Local Party Committee Member' : 'City Councillor',
    mayor: s.kind === 'party' ? 'City Party Secretary' : 'Mayor', seat: s.seat, region: s.region, head: s.head }[id] ?? null;
}

/** The offices that exist in this country, lowest first. */
export const offices = (c = country()) => (system(c).kind === 'none' ? []
  : OFFICES.filter((o) => officeTitle(o.id, c)).map((o) => ({ ...o, title: officeTitle(o.id, c) })));

const convictions = (p) => p.legal.record.filter((r) => r.convicted && !r.juvenile).length;
const highestHeld = (p) => Math.max(0, ...(p.flags.offices ?? []).map((o) => o.tier), p.politics?.tier ?? 0);

/** Why the player cannot stand for an office right now, or '' if they can. */
export function barrier(o) {
  const p = player();
  const c = country();
  const s = system(c);
  if (p.legal.incarceration) return 'You cannot campaign from a cell.';
  if (p.royal && !p.royal.waiting && ROYAL_RANKS.includes(p.royal.rank)) return 'The royal family stays out of politics. You would have to give up your place first.';
  if (p.age < o.minAge) return `You must be ${o.minAge}.`;
  if (p.politics?.ruler) return 'You have done away with elections.';
  if (p.politics?.officeId === o.id) return 'You hold this office.';
  if (o.id === 'head' && s.nativeOnly && p.birthCountryId !== c.id) return `Only someone born in ${theCountry(c.name)} may hold this office.`;
  if (p.flags.campaignAge === p.age) return 'You have already fought one campaign this year.';
  // Offices are filled on a calendar, and a campaign is fought in the year before the vote.
  if (s.kind !== 'party' && !world.inSeason(o.id, c.id)) return `The next election for this office is in ${world.nextElection(o.id, c.id)}. Campaigning opens the year before.`;
  if (p.finance.cash < localMoney(o.cost, c)) return `Standing costs at least ${fmtMoney(localMoney(o.cost, c), c)}.`;
  return '';
}

/** The ladder as the Work tab shows it. */
export function ladder() {
  const c = country();
  return offices(c).map((o) => ({ id: o.id, title: o.title, tier: o.tier, blocked: barrier(o),
    cost: localMoney(o.cost, c), salary: localWage(o.salary, c), term: o.term, fullTime: o.fullTime, odds: oddsLabel(o),
    electionYear: world.nextElection(o.id, c.id), opponent: world.opponentFor(o.id, c.id)?.name ?? null }));
}

/** How the voters see the player before a campaign begins, as a rough score. */
function standing(o) {
  const p = player();
  const s = system();
  const held = highestHeld(p);
  let score = o.base;
  if (s.kind === 'party') {
    // No voters to charm: the committee wants loyalty, patience and usefulness.
    score += (p.hidden.discipline - 50) * 0.25 + (p.stats.intellect - 50) * 0.15 + (p.stats.charm - 50) * 0.08;
  } else {
    score += (p.stats.charm - 50) * 0.25 + (p.stats.intellect - 50) * 0.1 + p.hidden.fame * 0.08 + (p.hidden.karma - 50) * 0.08;
  }
  score += Math.min(10, (p.counters.polExp ?? 0) * 0.4);
  // Each rung climbed makes the next one believable; skipping rungs is a long shot.
  score += held ? 4 + Math.min(2, held - o.tier + 1) * 6 : -(o.tier - 1) * 5;
  if (p.politics) score += (p.politics.approval - 50) * 0.25;
  else if (p.flags.lastApproval != null) score += (p.flags.lastApproval - 50) * 0.2;
  score -= convictions(p) * 14;
  if (p.flags.removedFromOffice) score -= 10;
  if (p.flags.politicalFamily) score += 5;
  if (p.royal && !ROYAL_RANKS.includes(p.royal.rank) && !p.royal.waiting) score += 3;
  if (s.rigged && !p.politics) score -= 18;
  score += world.partyBacking(o.tier);
  return score;
}

function oddsLabel(o) {
  const s = standing(o);
  return s >= 52 ? 'yours to lose' : s >= 43 ? 'a good chance' : s >= 35 ? 'an even fight' : s >= 26 ? 'an uphill fight' : 'a very long shot';
}

export const platforms = () => PLATFORMS.map((x) => ({ id: x.id, name: x.name }));
export const budgets = (officeId) => {
  const c = country();
  const o = OFFICES.find((x) => x.id === officeId);
  return BUDGETS.map((b) => ({ id: b.id, name: b.name, desc: b.desc, cost: localMoney(o.cost * b.times, c), affordable: player().finance.cash >= localMoney(o.cost * b.times, c) }));
};
export const moves = () => MOVES.filter((m) => system().kind !== 'party' || !['rally', 'debate', 'babies', 'smear'].includes(m.id))
  .map((m) => ({ id: m.id, name: system().kind === 'party' && m.id === 'buy' ? 'Send gifts to the committee' : system().kind === 'party' && m.id === 'doors' ? 'Volunteer for every thankless task' : m.name, risky: !!(m.dirty || m.illegal) }));

function takeOffice(o, approval = 55) {
  const p = player();
  const c = country();
  leave('moved up', true);
  if (o.fullTime && p.career.careerId) quitCareer();
  // The term runs to the next election for the office, whenever in the cycle it was won.
  const next = world.nextElection(o.id, c.id);
  const termLeft = next ? Math.max(1, next - store.state.year - 1 + (o.id === 'seat' || o.id === 'head' ? world.polity(c.id).calendar.term : 4)) : o.term;
  p.politics = { officeId: o.id, title: o.title, tier: o.tier, termLeft, terms: 1, approval, since: p.age, salary: localWage(o.salary, c) };
  if (o.id === 'head') world.seatPlayer(c.id);
  p.flags.officeCountry = c.id;
  p.hidden.fame = clamp(Math.max(p.hidden.fame, o.tier * 16) + 4);
  if (o.tier === 5) p.flags.ledCountry = true;
  milestone(`Became ${o.title}${o.tier >= 5 ? ` of ${theCountry(c.name)}` : ''}.`, o.tier >= 4 ? 'fame' : 'career');
}

/** Ends the current office and writes it into the record. */
function leave(why, quiet = false) {
  const p = player();
  const k = p.politics;
  if (!k) return;
  (p.flags.offices ??= []).push({ title: k.ruler ? `${k.title} for Life` : k.title, tier: k.tier, from: k.since, to: p.age });
  p.flags.lastApproval = k.approval;
  delete p.politics;
  if (!quiet) milestone(`Left office as ${k.title}: ${why}.`, 'career');
}

/**
 * Fights an election (or, in a one-party state, seeks the committee's nod).
 * @param {string} officeId
 * @param {{platform:string, budget:string, moves:string[]}} plan
 */
export function campaign(officeId, plan) {
  const p = player();
  const c = country();
  const s = system(c);
  const o = offices(c).find((x) => x.id === officeId);
  if (!o) return result(false, 'There is no such office here.', 'neutral');
  const why = barrier(o);
  if (why) return result(false, why, 'neutral');
  const budget = BUDGETS.find((b) => b.id === plan.budget) ?? BUDGETS[0];
  const cost = localMoney(o.cost * budget.times, c);
  if (p.finance.cash < cost) return result(false, 'You cannot afford that campaign.', 'neutral');
  p.finance.cash -= cost;
  p.flags.campaignAge = p.age;

  let score = standing(o) + budget.boost;
  const notes = [];
  // What the voters want this year is only known once the votes are in.
  const mood = rng.pick(PLATFORMS.filter((x) => !x.silly)).id;
  const platform = PLATFORMS.find((x) => x.id === plan.platform) ?? PLATFORMS[0];
  if (s.kind !== 'party') {
    if (platform.silly) { score -= 6; p.hidden.fame = clamp(p.hidden.fame + 4); notes.push('The pony pledge made the news everywhere, though not always kindly.'); }
    else if (platform.id === mood) { score += 7; notes.push(`"${platform.name}" turned out to be exactly what people wanted to hear.`); }
  }
  let caught = false;
  for (const id of (plan.moves ?? []).slice(0, 2)) {
    const m = MOVES.find((x) => x.id === id);
    if (!m) continue;
    let gain = rng.int(m.boost[0], m.boost[1]);
    if (m.factor) gain += ((m.factor === 'discipline' ? p.hidden.discipline : p.stats[m.factor]) - 50) / 8;
    if (m.karma) p.hidden.karma = clamp(p.hidden.karma + m.karma);
    if (m.illegal) {
      // Easier to get away with where it is how things are done.
      if (rng.chance(clamp(0.55 - c.living.graft / 150, 0.08, 0.5))) { caught = true; gain = -20; p.legal.heat = clamp(p.legal.heat + 35); notes.push('The envelopes were filmed changing hands. The police would like a word.'); }
      else notes.push(m.text);
    } else if (m.dirty && gain < 0) notes.push('The attack adverts were so nasty that people felt sorry for your opponent.');
    else notes.push(m.text);
    score += gain;
  }

  // The other candidate, the weather on polling day, and everything else nobody controls.
  const rival = world.opponentFor(officeId, c.id);
  const rivalParty = rival ? world.party(world.polity(c.id), rival.partyId) : null;
  // A rival with charm and a clean name is harder to beat.
  const opponent = 50 + rng.int(-14, 14) + rng.int(-10, 10) + (rival ? (rival.t.charisma - 55) / 8 : 0);
  const share = Math.round(clamp(50 + (score - opponent) * 0.6, 4, 96));
  const won = share > 50 || (share === 50 && rng.chance(0.5));
  const votes = won && share <= 50 ? 51 : !won && share >= 50 ? 49 : share;
  p.counters.polExp = (p.counters.polExp ?? 0) + 1;
  const told = notes.length ? ` ${notes.join(' ')}` : '';
  let text;
  if (won) {
    p.counters.electionsWon = (p.counters.electionsWon ?? 0) + 1;
    takeOffice(o, caught ? 40 : clamp(48 + (votes - 50) * 0.8, 45, 75));
    p.stats.mood = clamp(p.stats.mood + 14);
    text = s.kind === 'party'
      ? `The committee met behind closed doors, and your name came out. You are ${o.title}.${told} The campaign cost ${fmtMoney(cost, c)}.`
      : `You beat ${rival ? `${rival.name}${rivalParty ? ` of ${world.the(rivalParty)}` : ''}` : 'your opponent'} with ${votes}% of the vote. You are ${o.title}${o.tier >= 5 ? ` of ${theCountry(c.name)}` : ''}.${told} The campaign cost ${fmtMoney(cost, c)}.`;
    world.recordRace(rival, `Lost the race for ${o.title} to ${p.firstName} ${p.lastName}, ${100 - votes}% to ${votes}%.`);
    if (o.fullTime) text += ' It is a full-time job, and you have left your old one.';
  } else {
    p.counters.electionsLost = (p.counters.electionsLost ?? 0) + 1;
    p.stats.mood = clamp(p.stats.mood - 10);
    text = s.kind === 'party'
      ? `The committee chose someone else for ${o.title}. You applaud with everyone else.${told} It cost you ${fmtMoney(cost, c)}.`
      : `You lost to ${rival ? `${rival.name}${rivalParty ? ` of ${world.the(rivalParty)}` : ''}` : 'your opponent'}, with ${votes}% of the vote${s.rigged ? ', by the official count' : ''}.${told} The campaign cost ${fmtMoney(cost, c)}.`;
    world.recordRace(rival, `Beat ${p.firstName} ${p.lastName} for ${o.title}, ${100 - votes}% to ${votes}%.`);
  }
  log(text, 'system', won ? 'good' : 'bad');
  return result(won, text);
}

// ---------- In office ----------

function acts() {
  const p = player();
  if (p.flags.officeActs?.age !== p.age) p.flags.officeActs = { age: p.age, done: 0 };
  return p.flags.officeActs;
}
export const actionsLeft = () => ACTIONS_PER_YEAR - acts().done;
export function actionOptions() {
  const k = inOffice();
  const c = country();
  if (!k) return [];
  return ACTIONS.filter((a) => k.tier >= a.tier && !(a.seize && k.ruler) && !(a.pardon && !player().legal.record.length && !player().legal.heat))
    .map((a) => ({ id: a.id, name: a.name, risky: !!(a.graft || a.seize),
      note: a.graft ? `Worth about ${fmtMoney(localMoney(k.tier * 30000, c), c)} to you, if nobody finds out.` : a.seize ? 'No more elections. If it fails, it is treason.' : a.debt ? 'Popular now. The bill comes later.' : a.lasting ? 'Unpopular now. It pays off in a few years.' : '' }));
}

/** Moves approval, clamped. */
export function shiftApproval(delta) {
  const k = inOffice();
  if (k) k.approval = Math.round(clamp(k.approval + delta));
}

export function govern(id) {
  const p = player();
  const c = country();
  const k = inOffice();
  const a = ACTIONS.find((x) => x.id === id);
  if (!k || !a || k.tier < a.tier) return result(false, 'That is not in your power.', 'neutral');
  if (actionsLeft() <= 0) return result(false, 'There are only so many hours in a year of government.', 'neutral');
  acts().done += 1;
  let text = a.text;
  let tone = 'neutral';
  if (a.seize) {
    const chance = clamp((100 - c.living.stability) / 140 + (k.approval - 50) / 120 + (p.hidden.willpower - 50) / 300, 0.03, 0.75);
    if (rng.chance(chance)) {
      k.ruler = true; k.termLeft = 99; k.title = `${k.title} for Life`;
      p.hidden.karma = clamp(p.hidden.karma - 25);
      p.flags.ruledAlone = true;
      text = `Parliament is sent home, the courts are told to mind their business, and the next election is postponed until further notice. You are ${k.title}.`;
      milestone('Did away with elections and ruled alone.', 'fame');
      tone = 'bad';
    } else {
      leave('removed for trying to seize power');
      p.flags.removedFromOffice = true;
      p.legal.heat = clamp(p.legal.heat + 70);
      p.hidden.karma = clamp(p.hidden.karma - 15);
      p.stats.mood = clamp(p.stats.mood - 20);
      text = 'The army stays in its barracks, the judges do not blink, and by morning you are out of office and under investigation for treason.';
      tone = 'bad';
    }
  } else if (a.graft) {
    const take = localMoney(k.tier * rng.int(20000, 40000), c);
    p.finance.cash += take;
    p.hidden.karma = clamp(p.hidden.karma - 8);
    p.counters.crimes += 1;
    if (rng.chance(clamp(0.5 - c.living.graft / 160, 0.06, 0.45))) {
      shiftApproval(-22); p.legal.heat = clamp(p.legal.heat + 30);
      text = `${a.text} ${fmtMoney(take, c)} finds its way to you, and three weeks later the whole story finds its way to a newspaper.`;
      tone = 'bad';
    } else text = `${a.text} ${fmtMoney(take, c)} finds its way to you. Nobody asks.`;
  } else {
    const change = rng.int(a.approval[0], a.approval[1]);
    shiftApproval(change);
    if (a.karma) p.hidden.karma = clamp(p.hidden.karma + a.karma);
    if (a.mood) p.stats.mood = clamp(p.stats.mood + a.mood);
    if (a.debt) k.debt = (k.debt ?? 0) + 1;
    if (a.lasting) k.reforms = [...(k.reforms ?? []), p.age + rng.int(2, 4)];
    if (a.pardon) { p.legal.record = []; p.legal.heat = 0; p.legal.pending = null; p.hidden.karma = clamp(p.hidden.karma - 10); }
    tone = change > 0 ? 'good' : change < 0 ? 'bad' : 'neutral';
  }
  log(text, 'system', tone);
  return result(tone !== 'bad', text, tone);
}

export function resign() {
  const k = inOffice();
  if (!k) return result(false, 'You hold no office.', 'neutral');
  const text = k.ruler ? 'You hand back the powers you took, call an election, and do not stand in it. Nobody quite believes it.' : `You have resigned as ${k.title}.`;
  leave('resigned');
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** Standing again at the end of a term. The record in office decides most of it. */
export function reElection() {
  const p = player();
  const c = country();
  const k = inOffice();
  if (!k) return result(false, '', 'neutral');
  const o = offices(c).find((x) => x.id === k.officeId);
  const s = system(c);
  const share = Math.round(clamp(50 + (k.approval - 48) * 0.7 + rng.int(-6, 6) + (s.rigged ? 12 : 0), 5, 95));
  if (share > 50) {
    k.terms += 1; k.termLeft = o.term;
    p.counters.electionsWon = (p.counters.electionsWon ?? 0) + 1;
    const text = s.kind === 'party' ? `The committee renews your appointment as ${k.title}.` : `You are re-elected as ${k.title} with ${share}% of the vote.`;
    return result(true, text);
  }
  p.counters.electionsLost = (p.counters.electionsLost ?? 0) + 1;
  p.stats.mood = clamp(p.stats.mood - 12);
  const text = s.kind === 'party' ? `The committee thanks you for your service as ${k.title}, and gives the post to someone younger.` : `You are voted out, with ${Math.min(share, 49)}% of the vote. You have until Friday to clear your desk.`;
  leave('voted out');
  return result(false, text);
}

/** Thrown out mid-term: impeached, recalled, lost a confidence vote, or toppled. */
export function removed(how) {
  const p = player();
  const k = inOffice();
  if (!k) return;
  leave(how);
  p.flags.removedFromOffice = true;
  p.stats.mood = clamp(p.stats.mood - 15);
}

/** The word for being thrown out, by office and system. */
export function removalWord() {
  const k = inOffice();
  const s = system();
  if (!k) return 'removal';
  if (k.ruler) return 'uprising';
  if (s.kind === 'party') return 'party disciplinary hearing';
  if (k.tier === 5) return s.kind === 'presidential' ? 'impeachment' : 'vote of no confidence';
  return k.tier >= 3 ? 'ethics inquiry' : 'recall vote';
}

/** Yearly: experience, pay, what the voters make of the year, and the end of terms. */
export function tickPolitics() {
  const p = player();
  const c = country();
  // What counts later: student council, debating, the right degree.
  const clubs = p.education.enrolled ? p.education.clubs ?? [] : [];
  if (clubs.includes('council')) p.counters.polExp = Math.min(30, (p.counters.polExp ?? 0) + 2);
  if (clubs.includes('debate')) p.counters.polExp = Math.min(30, (p.counters.polExp ?? 0) + 1);
  if (!p.flags.polDegree && p.education.degrees.some((d) => ['political_science', 'law'].includes(d.majorId) || d.type === 'law')) {
    p.flags.polDegree = true;
    p.counters.polExp = (p.counters.polExp ?? 0) + 6;
  }

  const k = inOffice();
  if (!k) return;
  // An office belongs to a country: leave, or be locked up, and it is gone.
  const here = offices(c).find((x) => x.id === k.officeId);
  if (!here || (p.flags.officeCountry ?? c.id) !== c.id) { leave('left the country'); log('Having left the country, you have given up your office.', 'system', 'neutral'); return; }
  if (p.legal.incarceration) { removed('sent to prison'); log(`You have been removed as ${k.title}. It is hard to govern from a cell.`, 'system', 'bad'); return; }

  const pay = k.salary - incomeTax(k.salary, c);
  p.finance.cash += pay;
  p.finance.lifetimeEarned += pay;
  p.finance.lifetimeTaxPaid += k.salary - pay;
  p.counters.yearsInOffice = (p.counters.yearsInOffice ?? 0) + 1;
  p.counters.polExp = Math.min(40, (p.counters.polExp ?? 0) + 1);
  log(`Your salary as ${k.title} came to ${fmtMoney(pay, c)} after tax.`);

  const done = p.flags.officeActs?.age === p.age - 1 ? p.flags.officeActs.done : 0;
  if (!done) { shiftApproval(-5); log('You did little with your office this year, and people noticed.', 'system', 'bad'); }
  k.approval = Math.round(k.approval + (50 - k.approval) * 0.1);
  if (k.debt && rng.chance(0.3 * k.debt)) { k.debt = 0; shiftApproval(-9); log('The tax cuts have to be paid for. Services are cut, and people blame you.', 'system', 'bad'); }
  if (k.reforms?.some((age) => age <= p.age)) { k.reforms = k.reforms.filter((age) => age > p.age); shiftApproval(9); log('The reform everyone hated is working. Some of them even admit it.', 'system', 'good'); }
  if (p.legal.record.some((x) => x.convicted && x.age === p.age - 1)) shiftApproval(-30);
  if (c.living.crisis && k.tier === 5) shiftApproval(-3);

  const pend = store.state.pendingEvents;
  if (k.ruler) {
    // Nobody votes a ruler out. They are pushed.
    if (rng.chance(clamp(0.03 + (55 - k.approval) / 250 + (c.living.stability - 40) / 600, 0.02, 0.3))) pend.push({ id: 'pol_uprising', cast: {} });
    return;
  }
  if (k.approval < REMOVAL) { pend.push({ id: 'pol_removal_vote', cast: {} }); return; }
  k.termLeft -= 1;
  if (k.termLeft <= 0) {
    const limit = k.officeId === 'head' ? system(c).limit : 0;
    if (limit && k.terms >= limit) {
      leave('served the full term the constitution allows');
      log(`Your time as ${k.title} is up: the constitution allows no more. You leave by the front door, to applause.`, 'system', 'good');
    } else pend.push({ id: 'pol_term_ends', cast: {} });
  }
}

/** For the grave and the header: the office held now. */
export const officeLine = (p = player()) => (p.politics ? `${p.politics.title}${p.politics.tier >= 5 ? ` of ${theCountry(country().name)}` : ''}` : '');
