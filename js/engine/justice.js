// Crime and the courts: committing a crime, police heat, arrest, choosing a
// lawyer, pleading, the verdict, and being sent down.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { resolve } from './conditions.js';
import { makeNpc } from './npcFactory.js';
import { fire } from './career.js';
import { leaveForPrison } from './education.js';
import { CRIMES, CRIME_BY_ID, LAWYERS, LIFE_SENTENCE, COLD_CASE_YEARS } from '../data/crimes.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const legal = () => {
  const l = player().legal;
  l.unsolved ??= [];
  return l;
};

export const isJailed = () => !!player().legal.incarceration;
/** Adult convictions. Juvenile records are sealed. */
export const convictions = () => player().legal.record.filter((r) => r.convicted && !r.juvenile);

// ---------- Committing a crime ----------

export function successChance(crime) {
  let chance = crime.base;
  for (const [path, w] of Object.entries(crime.factors)) chance += w * ((Number(resolve(path)) || 0) - 50) / 100;
  return clamp(chance - legal().heat / 400, 0.03, 0.95);
}

/** Crimes open to the player now, with a plain-words read on the odds. */
export function crimeOptions() {
  const p = player();
  return CRIMES.filter((c) => p.age >= c.minAge).map((c) => {
    const chance = successChance(c);
    return { id: c.id, name: c.name, target: !!c.target,
      odds: chance >= 0.7 ? 'good' : chance >= 0.45 ? 'fair' : chance >= 0.25 ? 'poor' : 'terrible',
      stakes: c.minor ? 'A fine or a short sentence if caught.' : `${c.sentence[0]} to ${c.sentence[1] >= LIFE_SENTENCE ? 'life' : `${c.sentence[1]} years`} if convicted.` };
  });
}
export const canCommitCrimes = () => player().age >= 8 && !isJailed() && !legal().pending;

/** People the player could turn on. */
export const targets = () => player().npcIds.map((id) => store.state.npcs[id])
  .filter((n) => n?.alive && n.role !== 'pet' && n.age >= 18);

/**
 * @param {string} crimeId
 * @param {string} [targetId]  for crimes against a person
 * @returns {{ok:boolean, text:string, tone:string, arrested:boolean}}
 */
export function commitCrime(crimeId, targetId) {
  const p = player();
  const c = country();
  const crime = CRIME_BY_ID[crimeId];
  const l = legal();
  if (!canCommitCrimes() || p.age < crime.minAge) return { ...result(false, 'You cannot do that now.', 'neutral'), arrested: false };
  const victim = store.state.npcs[targetId];
  p.counters.crimes += 1;
  p.hidden.karma = clamp(p.hidden.karma + crime.karma);
  p.talents.crime = clamp(p.talents.crime + 2);

  if (rng.chance(successChance(crime))) {
    const loot = localMoney(rng.int(crime.loot[0], crime.loot[1]), c);
    p.finance.cash += loot;
    l.heat = clamp(l.heat + crime.heat);
    l.unsolved.push({ crimeId, age: p.age, victim: victim?.firstName });
    let text = crime.done;
    if (victim) {
      victim.alive = false;
      p.counters.kills += 1;
      text = `${victim.firstName} ${victim.lastName} is dead. ${crime.done}`;
    }
    if (loot) text += ` You are ${fmtMoney(loot, c)} richer.`;
    log(text, 'system', 'neutral');
    return { ...result(true, text, 'neutral'), arrested: false };
  }

  // It went wrong. Either you are caught on the spot, or you get away with nothing.
  if (crime.danger && rng.chance(crime.danger)) p.stats.health = clamp(p.stats.health - rng.int(15, 35));
  if (rng.chance(clamp(crime.caught + l.heat / 300, 0, 0.97))) {
    const text = `${crime.failed} You are under arrest.`;
    log(text, 'system', 'bad');
    arrest(crimeId, true, victim?.firstName);
    return { ...result(false, text), arrested: true };
  }
  l.heat = clamp(l.heat + Math.round(crime.heat / 2));
  const text = `${crime.failed} You run, and get away with nothing.`;
  log(text, 'system', 'bad');
  return { ...result(false, text), arrested: false };
}

/** Yearly: heat cools, cold cases close, and old crimes sometimes catch up. */
export function tickCrime() {
  const p = player();
  const l = legal();
  l.unsolved = l.unsolved.filter((u) => u.crimeId === 'murder' || p.age - u.age < COLD_CASE_YEARS);
  if (!isJailed() && !l.pending && l.unsolved.length && rng.chance(l.heat / 280)) {
    const worst = l.unsolved.sort((a, b) => CRIME_BY_ID[b.crimeId].severity - CRIME_BY_ID[a.crimeId].severity)[0];
    l.unsolved = l.unsolved.filter((u) => u !== worst);
    log(`There is a knock at the door. The police have been building a case, and they have come for you: ${CRIME_BY_ID[worst.crimeId].charge}, ${p.age - worst.age || 'less than a'} year${p.age - worst.age === 1 ? '' : 's'} ago.`, 'system', 'bad');
    arrest(worst.crimeId, false, worst.victim);
  }
  l.heat = Math.max(0, l.heat - 10);
}

// ---------- Arrest and trial ----------

/** Opens a case. It stays open (and saved) until the verdict. */
export function arrest(crimeId, redHanded, victim) {
  const l = legal();
  l.pending = { crimeId, age: player().age, evidence: redHanded ? 0.85 : 0.55, lawyer: null, skill: 0, victim: victim ?? null };
  l.heat = Math.max(0, l.heat - 20);
}
export const pendingCase = () => legal().pending ?? null;

/** @returns {{id, name, blurb, cost:number, affordable:boolean}[]} */
export function lawyerOptions() {
  const p = player();
  return LAWYERS.map((x) => {
    const cost = localMoney(x.cost, country());
    return { id: x.id, name: x.name, blurb: x.blurb, cost, affordable: p.finance.cash >= cost };
  });
}

export function hireLawyer(id) {
  const p = player();
  const x = LAWYERS.find((y) => y.id === id);
  const cost = localMoney(x.cost, country());
  if (p.finance.cash < cost) return result(false, 'You cannot afford them.', 'neutral');
  p.finance.cash -= cost;
  const c = pendingCase();
  c.lawyer = id;
  c.skill = x.skill ?? Math.round(p.stats.intellect * 0.55);
  const text = id === 'self' ? 'You will speak for yourself.' : `${x.name} takes your case${cost ? ` for ${fmtMoney(cost, country())}` : ''}.`;
  log(text);
  return result(true, text, 'neutral');
}

/** How a not-guilty plea is likely to go, in plain words. */
export function trialOutlook() {
  const chance = acquittalChance();
  return chance >= 0.6 ? 'Your lawyer likes your chances.' : chance >= 0.35 ? 'It could go either way.' : 'The evidence against you is strong.';
}

function acquittalChance() {
  const p = player();
  const c = pendingCase();
  return clamp(0.12 + c.skill / 100 * 0.75 - c.evidence * 0.5 + (p.hidden.karma - 50) / 400 - convictions().length * 0.05, 0.03, 0.9);
}

/**
 * Ends the case. plea is 'guilty' (certain conviction, lighter sentence) or
 * 'notGuilty' (a trial).
 * @returns {{ok:boolean, text:string, tone:string, years:number}}
 */
export function enterPlea(plea) {
  const p = player();
  const cty = country();
  const l = legal();
  const c = l.pending;
  const crime = CRIME_BY_ID[c.crimeId];
  const juvenile = p.age < 18;
  const acquit = acquittalChance();
  l.pending = null;

  if (plea === 'notGuilty' && rng.chance(acquit)) {
    l.record.push({ crimeId: c.crimeId, age: p.age, convicted: false, sentenceYears: 0, juvenile });
    p.stats.mood = clamp(p.stats.mood + 10);
    const text = 'Not guilty. You walk out of the courtroom a free person.';
    log(text, 'system', 'good');
    return { ...result(true, text), years: 0 };
  }

  // Convicted. A plea, a good lawyer and a clean record all shorten the sentence.
  const priors = convictions().length;
  let years = crime.sentence[0] + (crime.sentence[1] - crime.sentence[0]) * rng.next() * (1 - c.skill / 250);
  if (plea === 'guilty') years *= 0.6;
  years = Math.round(years + priors);
  if (crime.minor && priors === 0) years = 0;
  l.record.push({ crimeId: c.crimeId, age: p.age, convicted: true, sentenceYears: years, juvenile });
  const how = plea === 'guilty' ? 'You pleaded guilty.' : 'Guilty.';

  if (years <= 0) {
    const fine = localMoney(crime.fine ?? 500, cty);
    p.finance.cash -= fine;
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `${how} The court fined you ${fmtMoney(fine, cty)} and gave you community service. ${juvenile ? 'Your record is sealed when you turn 18.' : 'You now have a criminal record.'}`;
    log(text, 'system', 'bad');
    return { ...result(false, text), years: 0 };
  }
  const term = years >= LIFE_SENTENCE ? 'life' : `${years} year${years === 1 ? '' : 's'}`;
  const text = `${how} You were sentenced to ${term}${juvenile ? ' in juvenile detention' : ' in prison'}.`;
  log(text, 'system', 'bad');
  imprison(years, crime.severity);
  return { ...result(false, text), years };
}

// ---------- Custody ----------

export function imprison(years, severity = 2) {
  const p = player();
  const juvenile = p.age < 18;
  const term = juvenile ? Math.max(1, Math.min(years, 18 - p.age)) : years;
  if (p.career.careerId) fire('dismissed');
  if (p.career.partTime) p.career.partTime = null;
  leaveForPrison();
  p.legal.incarceration = { facility: juvenile ? 'juvenile' : 'prison',
    security: juvenile ? 'min' : severity >= 4 ? 'max' : severity >= 3 ? 'med' : 'min',
    yearsLeft: term, total: term, served: 0, respect: 20, conduct: 55, gangId: null, escapeAttempts: 0 };
  p.stats.mood = clamp(p.stats.mood - 15);
  if (!juvenile) {
    const mate = makeNpc({ role: 'cellmate', countryId: p.countryId, gender: p.gender === 'female' ? 'female' : 'male',
      age: rng.int(20, 60), relationship: rng.int(30, 55) });
    store.state.npcs[mate.id] = mate;
    p.npcIds.push(mate.id);
    log(`Your cellmate is ${mate.firstName} ${mate.lastName}.`);
  }
  if (!p.flags.beenInside) { p.flags.beenInside = true; milestone(juvenile ? 'Sent to juvenile detention.' : 'Sent to prison.', 'crime'); }
}

export function release(how = 'You served your sentence and walked out of the gate.') {
  const p = player();
  for (const mate of npcsByRole('cellmate')) {
    if (mate.meters.relationship >= 60) mate.role = 'friend';
    else { p.npcIds = p.npcIds.filter((id) => id !== mate.id); delete store.state.npcs[mate.id]; }
  }
  p.legal.incarceration = null;
  p.stats.mood = clamp(p.stats.mood + 15);
  log(how, 'system', 'good');
}
