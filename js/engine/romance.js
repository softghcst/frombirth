// Romance: meeting people, dating, engagement, weddings (with or without a
// prenup), break-ups and divorce.
import { fromAbroad, rollsRoots } from './economy.js';
import { may } from './rules.js';
import { rng } from '../rng.js';
import * as crown from './royalty.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { COUNTRIES } from '../data/countries.js';
import { remember } from './conditions.js';
import { spendAction, roleLabel } from './relationships.js';
import { conceive, canConceive } from './children.js';
import { ensureLife } from './npcLives.js';
import { netWorth } from './finance.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const bump = (npc, d) => { npc.meters.relationship = clamp(npc.meters.relationship + d); };
const npcOf = (id) => store.state.npcs[id];

export const DATING_AGE = 14;
export const ADULT = 18;
const MAX_SEARCHES = 3;

/** Costs in base units. */
export const DATE_COST = 120;
export const RINGS = [
  { id: 'plain', name: 'A plain band', cost: 400, bonus: 0 },
  { id: 'fine', name: 'A fine ring', cost: 4000, bonus: 0.1 },
  { id: 'dazzling', name: 'A dazzling ring', cost: 25000, bonus: 0.2 },
];
export const WEDDINGS = [
  { id: 'registry', name: 'Registry office and a pub lunch', cost: 600, joy: 3 },
  { id: 'classic', name: 'A proper wedding', cost: 14000, joy: 9 },
  { id: 'lavish', name: 'The wedding of the year', cost: 70000, joy: 15 },
];
export const DIVORCE_FEE = 4000;

export const spouse = () => npcsByRole('spouse')[0];
export const partner = () => spouse() ?? npcsByRole('partner')[0];
export const interest = () => player().flags.interestedIn ?? null;
export const setInterest = (v) => { player().flags.interestedIn = v; };

function searches() {
  const p = player();
  if (p.flags.loveActs?.age !== p.age) p.flags.loveActs = { age: p.age, met: 0 };
  return p.flags.loveActs;
}

export const canLookForLove = () => {
  const p = player();
  return p.age >= DATING_AGE && !partner() && !p.legal.incarceration;
};

/** Teenagers date people their own age; adults date adults. */
function ageFits(npc) {
  const p = player();
  if (p.age < ADULT) return npc.age >= DATING_AGE && npc.age < ADULT && Math.abs(npc.age - p.age) <= 2;
  return npc.age >= ADULT;
}

/** Where the player can go looking, by age. */
export function meetingPlaces() {
  const adult = player().age >= ADULT;
  return [
    { id: 'friends', name: 'Through friends', desc: 'Someone a friend thinks you would like.' },
    ...(adult ? [{ id: 'app', name: 'A dating app', desc: 'A lot of profiles. Some of them accurate.' },
      { id: 'out', name: 'A night out', desc: 'Whoever catches your eye across the room.' }]
      : [{ id: 'school', name: 'Around school', desc: 'Someone from a different class.' }]),
  ];
}

/**
 * Finds someone the player might ask out. They are not part of the player's
 * life until askOutStranger succeeds.
 * @returns {{ok:false, text:string}|{ok:true, npc:object, blurb:string}}
 */
export function meetSomeone(place) {
  const p = player();
  const s = searches();
  if (s.met >= MAX_SEARCHES) return result(false, 'You have met enough new people for one year.', 'neutral');
  s.met += 1;
  const want = interest();
  const gender = want === 'men' ? 'male' : want === 'women' ? 'female' : rng.pick(['male', 'female']);
  const age = p.age < ADULT ? clamp(p.age + rng.int(-1, 1), DATING_AGE, ADULT - 1)
    : Math.max(ADULT, p.age + rng.int(-Math.min(6, p.age - ADULT), 8));
  const surnames = COUNTRIES[p.countryId].names.last.filter((n) => n !== p.lastName);
  const npc = makeNpc({ role: 'partner', countryId: p.countryId, gender, age, relationship: rng.int(48, 62),
    lastName: rng.pick(surnames) });
  // Someone who would go out with the player is, by definition, drawn to people like them.
  npc.orientation = npc.gender === p.gender ? rng.pick(['gay', 'gay', 'bisexual', 'pansexual']) : rng.pick(['straight', 'straight', 'straight', 'bisexual']);
  if (p.age >= ADULT && rollsRoots('partnerFromAbroad')) fromAbroad(npc, p.countryId);
  if (place === 'app') npc.meters.charm = clamp(npc.meters.charm - rng.int(0, 15)); // profiles flatter
  ensureLife(npc);
  const m = npc.meters;
  const job = npc.life.job ? `works as ${/^[aeiou]/i.test(npc.occupation) ? 'an' : 'a'} ${npc.occupation}` : npc.life.edu.yearsLeft > 0 ? 'is still studying' : npc.age < 18 ? 'is at school' : 'is between jobs';
  const blurb = [
    m.charm >= 70 ? 'very easy on the eye' : m.charm >= 45 ? 'pleasant-looking' : 'not much to look at, with a lovely laugh',
    m.intellect >= 70 ? 'sharp as a tack' : m.intellect >= 45 ? 'good company' : 'not a big reader',
    job,
    m.crazy >= 70 ? 'and a little intense' : 'and seems steady',
  ].join(', ');
  return { ok: true, npc, blurb };
}

/** Asks out someone from meetSomeone. On a yes they join the player's life. */
export function askOutStranger(npc) {
  const p = player();
  const chance = clamp(0.5 + (p.stats.charm - npc.meters.charm) / 140, 0.08, 0.92);
  if (!rng.chance(chance)) {
    p.stats.mood = clamp(p.stats.mood - 3);
    const text = `You asked ${npc.firstName} out. They let you down gently.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  store.state.npcs[npc.id] = npc;
  p.npcIds.push(npc.id);
  npc.lastInteractionAge = p.age;
  npc.flags.since = p.age;
  p.stats.mood = clamp(p.stats.mood + 8);
  const text = `${npc.firstName} said yes. You are seeing each other.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/**
 * Romantic things the player can do with this person right now.
 * @returns {{id:string, label:string, danger?:boolean}[]}
 */
export function romanceActions(npc) {
  const p = player();
  const adults = p.age >= ADULT && npc.age >= ADULT;
  const a = [];
  if (['friend', 'classmate', 'coworker', 'ex'].includes(npc.role) && !partner() && p.age >= DATING_AGE && ageFits(npc)) {
    a.push({ id: 'askOut', label: 'Ask out' });
  }
  if ((npc.role === 'partner' || npc.role === 'spouse') && !p.legal.incarceration) {
    a.push({ id: 'date', label: npc.role === 'spouse' ? 'Plan a night out together' : 'Go on a date' });
    if (adults) a.push({ id: 'hookUp', label: 'Spend the night together' });
  }
  if (npc.role === 'partner') {
    if (adults && !npc.flags.engaged) a.push({ id: 'propose', label: 'Propose' });
    if (npc.flags.engaged) a.push({ id: 'wedding', label: 'Plan the wedding' });
    a.push({ id: 'breakUp', label: npc.flags.engaged ? 'Call off the engagement' : 'Break up', danger: true });
  }
  if (npc.role === 'spouse') a.push({ id: 'divorce', label: 'File for divorce', danger: true });
  return a;
}

export function askOut(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  if (!spendAction(npc, 'askOut')) return result(false, `You already asked ${npc.firstName} this year.`, 'neutral');
  const chance = clamp(0.15 + (npc.meters.relationship - 40) / 90 + (p.stats.charm - 50) / 160, 0.05, 0.9);
  if (!rng.chance(chance)) {
    bump(npc, -8);
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `You asked ${npc.firstName} out. "I think of you as a friend." It is a long walk home.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  npc.flags.wasRole = npc.role;
  npc.role = 'partner';
  ensureLife(npc);
  npc.flags.since = p.age;
  bump(npc, 10);
  p.stats.mood = clamp(p.stats.mood + 10);
  remember(npc, 'askedOut', 'You were friends first, and then you asked.');
  const text = `You asked ${npc.firstName} out, and they had been hoping you would. You are together.`;
  log(text, 'system', 'good');
  return result(true, text);
}

export function goOnDate(npcId) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const cost = localMoney(DATE_COST, c);
  if (p.age >= ADULT && p.finance.cash < cost) return result(false, 'You cannot afford a night out.', 'neutral');
  if (!spendAction(npc, 'date')) return result(false, 'You have already had your big night out this year.', 'neutral');
  if (p.age >= ADULT) p.finance.cash -= cost;
  const went = rng.chance(0.8);
  bump(npc, went ? rng.int(6, 12) : -3);
  p.stats.mood = clamp(p.stats.mood + (went ? 6 : -2));
  const text = went ? `You and ${npc.firstName} had a night neither of you wanted to end.`
    : `The restaurant lost your booking and it rained. ${npc.firstName} was polite about it.`;
  log(text, 'system', went ? 'good' : 'neutral');
  return result(went, text, went ? 'good' : 'neutral');
}

export function hookUp(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  if (p.age < ADULT || npc.age < ADULT) return result(false, 'Not at your age.');
  if (!spendAction(npc, 'hookUp')) return result(false, 'Not again this year.', 'neutral');
  bump(npc, rng.int(3, 8));
  p.stats.mood = clamp(p.stats.mood + 6);
  let text = `You and ${npc.firstName} spent the night together.`;
  if (canConceive(npc) && !p.flags.pregnancy && rng.chance(0.04 * p.hidden.fertility / 70)) {
    text += ` ${conceive(npc, false)}`;
  }
  log(text, 'system', 'good');
  return result(true, text);
}

export function propose(npcId, ringId) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const ring = RINGS.find((r) => r.id === ringId);
  const cost = localMoney(ring.cost, c);
  if (p.finance.cash < cost) return result(false, 'You cannot afford that ring.', 'neutral');
  if (!spendAction(npc, 'propose')) return result(false, `You already proposed to ${npc.firstName} this year.`, 'neutral');
  p.finance.cash -= cost;
  const chance = clamp((npc.meters.relationship - 45) / 45 + ring.bonus, 0.02, 0.97);
  if (!rng.chance(chance)) {
    p.finance.cash += Math.round(cost * 0.6); // the jeweller takes it back, at a loss
    bump(npc, -15);
    p.stats.mood = clamp(p.stats.mood - 12);
    const text = `You got down on one knee. ${npc.firstName} said they were not ready. The jeweler gave you some of the money back.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  npc.flags.engaged = true;
  bump(npc, 8);
  p.stats.mood = clamp(p.stats.mood + 15);
  const text = `You got down on one knee with ${ring.name.toLowerCase()}. ${npc.firstName} said yes before you finished the sentence.`;
  log(text, 'system', 'good');
  milestone(`Got engaged to ${npc.firstName} ${npc.lastName}.`, 'family');
  return result(true, text);
}

/** How wealthy the other person is, in local money. Used for settlements. */
const theirWealth = (npc) => (npc.life ? Math.max(0, npc.life.savings) : localMoney(npc.meters.money ** 2 * 45, country()));

/** Asks for a prenup. They may refuse, and asking always costs a little. */
export function askForPrenup(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  const richer = theirWealth(npc) > p.finance.cash;
  const chance = clamp(0.55 + (npc.meters.relationship - 70) / 100 + (richer ? 0.3 : -0.15) - (npc.meters.crazy - 50) / 250, 0.05, 0.95);
  bump(npc, -4);
  if (rng.chance(chance)) {
    const text = `${npc.firstName} read the prenup twice and signed it.`;
    log(text);
    return result(true, text, 'neutral');
  }
  bump(npc, -8);
  const text = `${npc.firstName} pushed the prenup back across the table. "If we are planning the divorce, why are we planning the wedding?"`;
  log(text, 'system', 'bad');
  return result(false, text);
}

export function marry(npcId, weddingId, prenup) {
  const p = player();
  const c = country();
  const npc = npcOf(npcId);
  const w = WEDDINGS.find((x) => x.id === weddingId);
  if (!npc.flags.engaged) return result(false, 'You are not engaged.', 'neutral');
  { const legal = may('marry', { partner: npc }); if (!legal.ok) return result(false, legal.why, 'neutral'); }
  const royalMatch = !!npc.flags.royal;
  let cost = localMoney(w.cost, c);
  if (!royalMatch && p.finance.cash < cost) return result(false, 'You cannot afford that wedding.', 'neutral');
  // Marrying into a royal family needs the palace's consent, and the palace can say no.
  const palace = royalMatch ? crown.consent(npc) : null;
  if (palace && !palace.ok) { log(palace.text, 'system', 'bad'); return result(false, palace.text, 'bad'); }
  if (palace && !palace.leaves) cost = 0; // a royal wedding is paid for by the crown
  if (p.finance.cash < cost) return result(false, 'You cannot afford that wedding.', 'neutral');
  p.finance.cash -= cost;
  npc.role = 'spouse';
  npc.flags.engaged = false;
  npc.marriedAtAge = p.age;
  npc.prenup = !!prenup || (!!palace && !palace.leaves); // the palace's lawyers always insist
  npc.lastInteractionAge = p.age;
  bump(npc, w.joy);
  p.stats.mood = clamp(p.stats.mood + 15);
  p.counters.spouses += 1;
  if (p.flags.livesWithParents) p.flags.livesWithParents = false;
  remember(npc, 'weddingDay', `You married them with ${w.name.toLowerCase()}.`);
  const wed = `${crown.npcName(npc)} ${npc.lastName}`;
  const after = palace ? crown.afterWedding(npc, palace.leaves) : crown.afterMarryingOut(npc);
  const text = palace && !palace.leaves
    ? `${palace.text} You married ${wed} in the cathedral, under a marriage contract drawn up by the palace's lawyers.${after}`
    : `${palace ? `${palace.text} ` : ''}You married ${wed}: ${w.name.toLowerCase()}${prenup ? ', with a prenup in the drawer' : ''}. It cost ${fmtMoney(cost, c)}.${after}`;
  log(text, 'system', 'good');
  milestone(`Married ${wed}.`, 'family');
  return result(true, text);
}

export function breakUp(npcId) {
  const p = player();
  const npc = npcOf(npcId);
  const wasEngaged = npc.flags.engaged;
  npc.role = 'ex';
  npc.flags.engaged = false;
  npc.meters.relationship = Math.max(5, npc.meters.relationship - 40);
  p.stats.mood = clamp(p.stats.mood - 8);
  const text = wasEngaged ? `You called off the engagement to ${npc.firstName}.` : `You broke up with ${npc.firstName}.`;
  log(text, 'system', 'bad');
  return result(true, text, 'neutral');
}

/** What a divorce would move between the two of you. Positive means you pay. */
export function settlement(npcId) {
  const npc = npcOf(npcId);
  if (npc.prenup) return 0;
  return Math.round((Math.max(0, netWorth(store.state)) - theirWealth(npc)) / 2);
}

function endMarriage(npc, yours) {
  const p = player();
  const c = country();
  const owed = settlement(npc.id);
  const fee = localMoney(DIVORCE_FEE, c);
  p.finance.cash -= owed + fee;
  if (npc.life) npc.life.savings += owed;
  npc.role = 'ex';
  npc.flags.wasSpouse = true;
  npc.meters.relationship = Math.min(npc.meters.relationship, 15);
  p.stats.mood = clamp(p.stats.mood - 15);
  for (const kid of npcsByRole('child')) if (kid.age < 18) bump(kid, -8);
  const money = npc.prenup ? 'The prenup held: you each kept what was yours.'
    : owed > 0 ? `Everything was split down the middle: you paid ${fmtMoney(owed, c)}.`
      : owed < 0 ? `Everything was split down the middle: you received ${fmtMoney(-owed, c)}.` : 'There was nothing to split.';
  const text = `${yours ? `You divorced ${npc.firstName}` : `${npc.firstName} divorced you`}. ${money} The lawyers took ${fmtMoney(fee, c)}.${crown.afterDivorce(npc)}`;
  log(text, 'system', 'bad');
  milestone(`Divorced ${npc.firstName} ${npc.lastName}.`, 'family');
  return text;
}

export function divorce(npcId) {
  const p = player();
  // Where there is no divorce, only an annulment: costly, once a year, and usually refused.
  if (!may('divorce').ok) {
    const fee = localMoney(DIVORCE_FEE * 2, country());
    if (p.flags.annulAge === p.age) return result(false, 'The court has heard you this year. You can petition again next year.', 'neutral');
    if (p.finance.cash < fee) return result(false, `${may('divorce').why} The petition costs ${fmtMoney(fee, country())}, and you do not have it.`, 'neutral');
    p.flags.annulAge = p.age;
    p.finance.cash -= fee;
    if (!rng.chance(0.3)) {
      const text = `${may('divorce').why} You petitioned for one. It cost ${fmtMoney(fee, country())}, and the court refused.`;
      log(text, 'system', 'bad');
      return result(false, text);
    }
    return result(true, `The court annulled the marriage. ${endMarriage(npcOf(npcId), true)}`, 'neutral');
  }
  return result(true, endMarriage(npcOf(npcId), true), 'neutral');
}

/** Yearly: relationships that have gone cold end themselves. */
export function tickRomance() {
  const p = player();
  for (const npc of [...npcsByRole('partner'), ...npcsByRole('spouse')]) {
    bump(npc, rng.int(-3, 2));
    if (npc.meters.relationship >= 22 || !rng.chance(0.5)) continue;
    if (npc.role === 'spouse') endMarriage(npc, false);
    else {
      npc.role = 'ex';
      npc.flags.engaged = false;
      p.stats.mood = clamp(p.stats.mood - 10);
      log(`${npc.firstName} ended things with you.`, 'system', 'bad');
    }
  }
}

export { roleLabel };
