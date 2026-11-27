// More of the teenage years: a best friend chosen (the game's own "Best friend" title, which schooling.js also gives),
// prom (a date, or friends; an outfit; and what comes after the dance), and peer pressure (an offer from a real friend,
// and what the player does about it). The actions are on people's pages (engine/together.js 'bestFriend', 'bffDay',
// 'prom'); the yearly step offers the pressure; the scenes are data/events/teenYears.js.
//
//   p.prom = { year, dateId | 'friends', outfit, went, after }        p.flags.pressure = { yes, no }
// Pressure is offered on keyed dice of its own, once a world year, so 3-, 6- and 12-month turns come to the same years.
import { store, player, milestone } from '../state.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { keyedDice } from './keyedDice.js';
import { storyBeat } from './storyDirector.js';
import { remember } from './conditions.js';
import { recordEvent } from './chronicle.js';
import { houseRules, earlierCurfew, ruleSetter } from './houseRules.js';
import { COUNTRIES } from '../data/countries.js';

const S = () => store.state;
const npc = (id) => S().npcs[id] ?? null;
const bump = (n, d) => { if (n) n.meters.relationship = clamp(n.meters.relationship + d); };
const word = (n, m, f, x) => (n?.gender === 'male' ? m : n?.gender === 'female' ? f : x);
const dice = (tag) => keyedDice(`teen/${S().slotId ?? ''}/${player().id}/${S().year}/${tag}`);

// ---------- A best friend ----------

/** The player's best friend, if they have one. */
export const bestFriend = (p = player()) => p.npcIds.map(npc).find((n) => n?.alive && n.flags.title === 'Best friend') ?? null;
/** Someone who could be the player's best friend: a friend or classmate near their age, already close. */
export const couldBeBest = (n, p = player()) => !!n?.alive && ['friend', 'classmate'].includes(n.role) && Math.abs(n.age - p.age) <= 3 && n.meters.relationship >= 55 && n.flags.title !== 'Best friend';

/** Makes this friend the best friend: there is only ever one. */
export function chooseBestFriend(n) {
  const p = player();
  for (const x of p.npcIds.map(npc)) if (x?.flags.title === 'Best friend' && x.id !== n.id) delete x.flags.title;
  if (n.role === 'classmate') n.role = 'friend';
  n.flags.title = 'Best friend';
  n.flags.bestSince = S().year;
  bump(n, 8);
  remember(n, 'bestFriend', `Became your best friend when you were ${p.age}.`);
  recordEvent({ key: `teen:best:${n.id}`, type: 'best_friend', title: `${n.firstName} became your best friend`, people: [n.id], significance: 1, privacy: 'private' });
  return `You and ${n.firstName} make it official, the way you do at ${p.age}: a pact, a secret handshake, and a photo that will embarrass you both for years.`;
}

// ---------- Prom ----------

export const PROM_AGE = 17;
export const OUTFITS = [
  { value: 'borrowed', label: 'Something borrowed and altered', cost: 40, joy: 2 },
  { value: 'mall', label: 'A new outfit from the mall', cost: 160, joy: 5 },
  { value: 'special', label: 'Something properly special', cost: 450, joy: 8 },
];
export const prom = (p = player()) => (p.prom?.year === S().year ? p.prom : null);
/** Prom is for a senior in high school, once. */
export const promOpen = (p = player()) => p.age === PROM_AGE && !!p.education?.enrolled && p.education.stage === 'high' && !prom(p)?.dateId;

/** The outfit's price, here; paid by the family when the player lives at home. */
export const outfitCost = (o, p = player()) => localMoney(o.cost, COUNTRIES[p.countryId]);

/** Going to prom with someone: a partner says yes; a friend comes as friends; a classmate may say yes. */
export function goToPromWith(n, outfitId) {
  const p = player();
  const o = OUTFITS.find((x) => x.value === outfitId) ?? OUTFITS[0];
  const d = dice(`prom/${n.id}`);
  const asFriends = n.role === 'friend';
  const yes = n.role === 'partner' ? d.chance(0.95) : asFriends ? true : d.chance(clamp((n.meters.relationship - 30) / 60 + (p.stats.charm - 50) / 200, 0.05, 0.9));
  if (!yes) {
    p.stats.mood = clamp(p.stats.mood - 5);
    return { ok: true, text: `${n.firstName} is going with someone else. ${word(n, 'He', 'She', 'They')} ${word(n, 'is', 'is', 'are')} nice about it, which almost makes it worse.`, tone: 'bad' };
  }
  const family = p.flags.livesWithParents && !!ruleSetter(p);
  const cost = outfitCost(o, p);
  if (!family) p.finance.cash -= Math.min(p.finance.cash, cost);
  p.prom = { year: S().year, dateId: asFriends ? 'friends' : n.id, with: n.id, outfit: o.value, went: false, after: null };
  bump(n, 6);
  p.stats.mood = clamp(p.stats.mood + o.joy);
  storyBeat('teen_prom_night', { them: n.id }, { source: 'teen' });
  return `${asFriends ? `You and ${n.firstName} decide to go as a group, with the rest of your friends.` : `${n.firstName} says yes. You both pretend to be calm about it.`} ${o.label}${family ? ', which your family pays for' : `, for ${fmtMoney(cost, COUNTRIES[p.countryId])}`}.`;
}

// ---------- Peer pressure ----------

export const PRESSURES = ['drink', 'vape', 'dare', 'skip'];

/** Once a world year, a teenager may be offered something by a friend: never invented, always someone they know. */
export function tickTeenYears() {
  const p = player();
  if (!p.alive || p.age < 14 || p.age > 17 || p.legal?.incarceration) return;
  const d = dice('pressure');
  if (!d.chance(0.4)) return;
  const pals = p.npcIds.map(npc).filter((n) => n?.alive && ['friend', 'classmate'].includes(n.role) && Math.abs(n.age - p.age) <= 2);
  if (!pals.length) return;
  const kind = d.pick(PRESSURES);
  storyBeat(`teen_pressure_${kind}`, { them: d.pick(pals).id }, { source: 'teen' });
}

/** Choices in the teen scenes (data/events/teenYears.js): 'pressure_<kind>:<choice>' or 'prom:<after>'. */
export function teenYearsChoice(value, cast = {}) {
  const p = player();
  const [story, choice] = String(value).split(':');
  const them = npc(cast.them);
  const d = dice(`choice/${story}/${choice}`);
  if (story === 'prom') {
    const x = prom(p);
    if (!x || x.went) return '';
    x.went = true; x.after = choice;
    milestone('Went to prom.', 'school');
    recordEvent({ key: `teen:prom:${p.id}`, type: 'prom', title: 'Prom night', people: [x.with].filter(Boolean), significance: 1, privacy: 'private' });
    if (choice === 'home') return 'Home before curfew, happy, with your shoes in your hand.';
    if (choice === 'diner') { bump(them, 4); return 'Pancakes at the all-night diner at three in the morning, still dressed up. The best part of the whole night.'; }
    if (d.chance(0.35) && houseRules()) { earlierCurfew('the prom after-party'); bump(ruleSetter(), -5); return 'The after-party, at a house whose owners are away. The police come at two; your parents at two fifteen. Your curfew is an hour earlier now.'; }
    p.stats.mood = clamp(p.stats.mood + 4);
    return 'The after-party, at a house whose owners are away. You watch the sun come up from the roof.';
  }
  if (story.startsWith('pressure')) {
    const kind = story.split('_')[1];
    const pr = (p.flags.pressure ??= { yes: 0, no: 0 });
    if (choice !== 'yes') {
      pr.no++;
      p.hidden.karma = clamp(p.hidden.karma + 1);
      if (choice === 'leave') bump(them, -3);
      if (choice === 'adult') { bump(ruleSetter(), 4); bump(them, -8); return 'You tell an adult. It is not a popular move, and it is the right one.'; }
      return 'You say no. Nobody actually cares as much as you feared.';
    }
    pr.yes++;
    bump(them, 4);
    if (kind === 'drink' || kind === 'vape') p.stats.health = clamp(p.stats.health - 2);
    if (kind === 'dare') p.hidden.karma = clamp(p.hidden.karma - 3);
    if (kind === 'skip' && p.education) p.education.gpa = Math.max(0, (p.education.gpa ?? 2.5) - 0.05);
    if (d.chance(0.3) && houseRules()) {
      earlierCurfew(kind === 'skip' ? 'skipping school' : kind === 'dare' ? 'a dare that went wrong' : 'coming home smelling of it');
      bump(ruleSetter(), -5);
      return 'You get caught. Your curfew is an hour earlier now, and it will take a while to earn it back.';
    }
    return 'Nobody finds out. This time.';
  }
  return '';
}

