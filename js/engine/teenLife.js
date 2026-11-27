// Deeper Teenage Life (12-17): the house rules (a curfew that follows how strict the parent is, and what happens when it
// is broken), being grounded (which now actually keeps a teenager in), a best friend, nights out, peer pressure, prom
// and the after-party, and a learner's permit with supervised driving that counts toward the test (engine/vehicles.js
// reads p.flags.drivePractice). School itself, cliques, clubs and part-time work stay where they are
// (schoollife.js, cliques.js, clubs.js, partTime.js); this is the life around them.
//
//   LF().teen = { curfew: hour, negotiated: year, grounded: { until: month, why } | null, bestFriendId,
//                 nights: { turnKey }, pressure: { yes, no }, prom: { year, dateId, outfit, after } | null,
//                 permit: { since, hours } | null, acted: { key: turnKey } }
import { store, log, milestone } from '../state.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { storyBeat } from './storyDirector.js';
import { drivingTestAge, hasLicense } from './vehicles.js';
import { LF, lived, nowMonth, ageIn, recordEvent, dice, onMonth, done, fail } from './livingFamilies.js';

const S = () => store.state;
const T = (state = S()) => LF(state).teen;
const turnKey = (state = S()) => `${state.year}:${state.month ?? 0}`;
const bump = (n, d) => { if (n) n.meters.relationship = clamp(n.meters.relationship + d); };
const known = (state) => state.player.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive);
export const TEEN = [12, 17];
export const isTeen = (state = S()) => state.player.age >= TEEN[0] && state.player.age <= TEEN[1];

/** Whoever sets the rules at home: a guardian in care, the parent the player lives with, or either parent. */
export function rulesBy(state = S()) {
  const p = state.player;
  if (p.flags.care?.guardianId) return state.npcs[p.flags.care.guardianId] ?? null;
  const withId = LF(state).blended.custody?.with;
  const parents = known(state).filter((n) => n.role === 'parent');
  return (withId && parents.find((n) => n.id === withId)) ?? parents.sort((a, b) => (b.strictness ?? 50) - (a.strictness ?? 50))[0] ?? null;
}
const strictness = (state) => rulesBy(state)?.strictness ?? 50;

/** The curfew, as an hour of the night (21 is 9 pm): stricter parents, earlier; older teenagers, later. */
export function curfew(state = S()) {
  const p = state.player;
  const t = T(state);
  const base = 22 + Math.round((50 - strictness(state)) / 25) + (p.age >= 16 ? 1 : 0) - (p.age <= 13 ? 1 : 0);
  return clamp(base + (t.curfewBonus ?? 0), 20, 25);
}
export const curfewText = (h) => (h >= 24 ? (h === 24 ? 'midnight' : `${h - 24} am`) : `${h > 12 ? h - 12 : h} pm`);

/** Grounded now? Also honors a grounding set by the older sneak-out action (engine/together.js: groundedYear). */
export function grounded(state = S()) {
  const t = T(state);
  if (t.grounded && t.grounded.until > lived(state)) return t.grounded;
  if (state.player.flags.groundedYear === state.year && state.player.age < 18) return { until: nowMonth(state) + 1, why: 'sneaking out' };
  return null;
}
function ground(state, months, why) {
  const t = T(state);
  const until = Math.max(t.grounded?.until ?? 0, nowMonth(state) + months);
  t.grounded = { until, why };
  recordEvent(state, 'grounded', [state.player.id], `Grounded for ${months === 1 ? 'a month' : `${months} months`}: ${why}.`);
}

/** The friends a teenager could go out with or choose as a best friend: friends and classmates near their age. */
export function friends(state = S()) {
  const p = state.player;
  return known(state).filter((n) => ['friend', 'classmate', 'stepsibling'].includes(n.role) && Math.abs(n.age - p.age) <= 3 && n.age >= 10);
}
export const bestFriend = (state = S()) => {
  const id = T(state).bestFriendId;
  const n = id && state.npcs[id];
  return n?.alive && state.player.npcIds.includes(n.id) ? n : known(state).find((x) => x.flags.title === 'Best friend') ?? null;
};

const once = (state, key) => {
  const t = T(state);
  const k = turnKey(state);
  t.acted ??= {};
  if (t.acted[key] === k) return false;
  t.acted[key] = k;
  return true;
};

// ---------- The house rules ----------

/** Ask for a later curfew. Once a year; how it goes depends on trust and how strict they are. */
export function negotiateCurfew(state = S()) {
  const p = state.player;
  const t = T(state);
  const parent = rulesBy(state);
  if (!isTeen(state)) return fail('Curfews are for teenagers living at home.');
  if (!parent) return fail('There is nobody at home setting a curfew.');
  if (t.negotiated === state.year) return fail('You already argued that one this year.');
  t.negotiated = state.year;
  const trust = parent.meters.trust ?? parent.meters.relationship;
  const d = dice(state, 'teen', 'curfew', state.year);
  const chance = clamp(0.45 + (trust - 50) / 100 - (strictness(state) - 50) / 120 - (grounded(state) ? 0.3 : 0), 0.05, 0.9);
  if (d.chance(chance)) {
    t.curfewBonus = (t.curfewBonus ?? 0) + 1;
    bump(parent, 2);
    const text = `${parent.firstName} agrees to ${curfewText(curfew(state))}, "as long as you answer your phone".`;
    log(text, 'family', 'good');
    return done(text);
  }
  bump(parent, -2);
  const text = `${parent.firstName} says ${curfewText(curfew(state))} is late enough. Nothing you say moves it.`;
  log(text, 'family', 'neutral');
  return fail(text);
}

/**
 * A night out with friends. 'curfew': home on time; 'late': stay out past it, and perhaps get caught. Not while
 * grounded (sneaking out is its own choice).
 */
export function nightOut(state = S(), how = 'curfew', friendId = null) {
  const p = state.player;
  if (!isTeen(state) || p.age < 13) return fail('Nights out start at 13.');
  if (p.legal?.incarceration) return fail('Not from where you are.');
  const g = grounded(state);
  if (g && how !== 'sneak') return fail(`You are grounded (${g.why}).`);
  if (!once(state, 'night')) return fail('You have been out already this season.');
  const pal = (friendId && state.npcs[friendId]) || bestFriend(state) || friends(state)[0] || null;
  const d = dice(state, 'teen', 'night', how, lived(state));
  const parent = rulesBy(state);
  if (pal) { bump(pal, 5); pal.lastInteractionAge = p.age; }
  p.stats.mood = clamp(p.stats.mood + 5);
  if (how === 'curfew') {
    bump(parent, 1);
    const text = `${pal ? `You and ${pal.firstName}` : 'You'} get chips and walk the long way home, and you are in the door by ${curfewText(curfew(state))}.`;
    log(text, 'teen', 'good');
    return done(text);
  }
  const caught = d.chance(clamp(0.25 + (strictness(state) - 50) / 120 + (how === 'sneak' ? 0.15 : 0), 0.1, 0.8));
  if (!caught) {
    p.stats.mood = clamp(p.stats.mood + 3);
    const text = how === 'sneak' ? `You climb out of the window at eleven and back in at two. Nobody stirs.` : `It is one in the morning when you get in. The house is dark. You got away with it.`;
    log(text, 'teen', 'good');
    return done(text);
  }
  const months = how === 'sneak' ? 3 : 1;
  if (parent) { bump(parent, -6); if (parent.meters.trust != null) parent.meters.trust = clamp(parent.meters.trust - 10); }
  ground(state, months, how === 'sneak' ? 'sneaking out' : 'breaking curfew');
  p.stats.mood = clamp(p.stats.mood - 6);
  const text = `${parent ? parent.firstName : 'Someone'} is sitting up waiting when you get in. ${how === 'sneak' ? 'Sneaking out while grounded' : 'Two hours past curfew'}: grounded for ${months === 1 ? 'a month' : `${months} months`}.`;
  log(text, 'teen', 'bad');
  return fail(text, 'bad');
}

/** Makes one friend the best friend (the game's existing title for it). */
export function chooseBestFriend(npcId, state = S()) {
  const n = state.npcs[npcId];
  if (!n?.alive || !friends(state).includes(n)) return fail('They are not someone you can call your best friend yet.');
  if (n.meters.relationship < 50) return fail(`You are not that close to ${n.firstName} yet.`);
  for (const x of known(state)) if (x.flags.title === 'Best friend' && x.id !== n.id) delete x.flags.title;
  if (n.role === 'classmate') n.role = 'friend';
  n.flags.title = 'Best friend';
  T(state).bestFriendId = n.id;
  bump(n, 6);
  const text = `${n.firstName} is your best friend. You both just know it.`;
  log(text, 'teen', 'good');
  recordEvent(state, 'best_friend', [state.player.id, n.id], text);
  return done(text);
}

/** Time with the best friend: once a season. */
export function bestFriendTime(state = S()) {
  const n = bestFriend(state);
  if (!n) return fail('Choose a best friend first.');
  if (!once(state, 'bff')) return fail('You have spent this season together already.');
  const d = dice(state, 'teen', 'bff', lived(state));
  bump(n, d.int(4, 8));
  n.lastInteractionAge = state.player.age;
  state.player.stats.mood = clamp(state.player.stats.mood + 4);
  const text = d.pick([`You and ${n.firstName} make a playlist for a road trip neither of you can drive on yet.`, `A whole Saturday at ${n.firstName}'s, talking about everything and nothing.`, `${n.firstName} tells you a secret, and you keep it.`]);
  log(text, 'teen', 'good');
  return done(text);
}

// ---------- Prom ----------

export const PROM_AGE = 17;
export const PROM_OUTFITS = [
  { id: 'borrowed', name: 'Something borrowed and altered', cost: 40, joy: 2 },
  { id: 'store', name: 'A new outfit from the mall', cost: 160, joy: 5 },
  { id: 'designer', name: 'Something properly special', cost: 450, joy: 8 },
];
export const prom = (state = S()) => { const x = T(state).prom; return x?.year === state.year ? x : null; };
export const promOpen = (state = S()) => state.player.age === PROM_AGE && state.player.education?.enrolled && state.player.education.stage === 'high';

/** Ask someone to prom: a partner, a friend or a classmate. */
export function askToProm(npcId, state = S()) {
  const p = state.player;
  if (!promOpen(state)) return fail('Prom is for seniors in high school.');
  const n = state.npcs[npcId];
  if (!n?.alive) return fail('They are not around.');
  const t = T(state);
  if (prom(state)?.dateId) return fail('You already have a date.');
  if (prom(state)?.asked?.includes(n.id)) return fail(`You already asked ${n.firstName}.`);
  const x = t.prom = prom(state) ?? { year: state.year, asked: [] };
  x.asked.push(n.id);
  const d = dice(state, 'teen', 'prom', n.id, state.year);
  const chance = n.role === 'partner' ? 0.95 : clamp((n.meters.relationship - 30) / 60 + (p.stats.charm - 50) / 200, 0.05, 0.9);
  if (!d.chance(chance)) {
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `${n.firstName} says they are going with someone else. They are nice about it, which almost makes it worse.`;
    log(text, 'teen', 'bad');
    return fail(text, 'bad');
  }
  x.dateId = n.id;
  bump(n, 6);
  const text = `${n.firstName} says yes. You both pretend to be calm about it.`;
  log(text, 'teen', 'good');
  return done(text);
}
/** Go with friends instead of a date. */
export function promWithFriends(state = S()) {
  if (!promOpen(state)) return fail('Prom is for seniors in high school.');
  const x = T(state).prom = prom(state) ?? { year: state.year, asked: [] };
  x.dateId = 'friends';
  const text = 'You and your friends decide to go as a group. It is the best decision anyone makes all year.';
  log(text, 'teen', 'good');
  return done(text);
}
export function promOutfit(outfitId, state = S()) {
  const p = state.player;
  const o = PROM_OUTFITS.find((x) => x.id === outfitId);
  const x = prom(state);
  if (!o || !x?.dateId) return fail('Find a date, or friends to go with, first.');
  if (x.outfit) return fail('You have an outfit already.');
  const c = COUNTRIES[p.countryId];
  const cost = localMoney(o.cost, c);
  const parentPays = p.flags.livesWithParents && rulesBy(state);
  if (!parentPays && p.finance.cash < cost) return fail(`That costs ${fmtMoney(cost, c)}.`);
  if (!parentPays) p.finance.cash -= cost;
  x.outfit = o.id;
  p.stats.mood = clamp(p.stats.mood + o.joy);
  const text = `${o.name}${parentPays ? ', which your family pays for' : `, for ${fmtMoney(cost, c)}`}. You look, everyone agrees, incredible.`;
  log(text, 'teen', 'good');
  return done(text);
}
/** Prom night itself: the dance, and what comes after. */
export function goToProm(after, state = S()) {
  const p = state.player;
  const x = prom(state);
  if (!x?.dateId || !x.outfit) return fail('You need a date (or friends) and an outfit.');
  if (x.went) return fail('Prom is over. It was a night.');
  if (grounded(state)) return fail('Grounded on prom night. Of all the nights.');
  x.went = true;
  x.after = after;
  const d = dice(state, 'teen', 'promnight', state.year);
  const date = x.dateId !== 'friends' ? state.npcs[x.dateId] : null;
  if (date) bump(date, 8);
  p.stats.mood = clamp(p.stats.mood + 8);
  let text = `Prom: ${date ? `you and ${date.firstName}` : 'you and your friends'} dance until your feet hurt.`;
  if (after === 'home') text += ' Then home, happy, before curfew.';
  else if (after === 'diner') text += ' Then pancakes at the all-night diner, still dressed up, at three in the morning.';
  else {
    const caught = d.chance(0.35);
    text += ' Then the after-party, at a house whose owners are away.';
    if (caught) { ground(state, 1, 'the prom after-party'); text += ' The police come at two. Your parents come at two fifteen. Grounded.'; bump(rulesBy(state), -5); }
  }
  log(text, 'teen', 'good');
  milestone('Went to prom.', 'school');
  recordEvent(state, 'prom', [p.id, ...(date ? [date.id] : [])], text);
  return done(text);
}

// ---------- Driving ----------

export const permitAge = () => Math.max(14, drivingTestAge() - 1);
export const permit = (state = S()) => T(state).permit ?? null;
export function getPermit(state = S()) {
  const p = state.player;
  if (hasLicense()) return fail('You already have your license.');
  if (p.age < permitAge()) return fail(`A learner's permit is from ${permitAge()}.`);
  if (permit(state)) return fail('You have your permit.');
  T(state).permit = { since: lived(state), hours: 0 };
  const text = 'You pass the written test and get your learner\'s permit: you can drive with a licensed adult beside you.';
  log(text, 'teen', 'good');
  recordEvent(state, 'permit', [p.id], text);
  return done(text);
}
/** Supervised driving with a parent: hours toward the test, and practice the test counts. Once a season. */
export function practiceDriving(state = S()) {
  const p = state.player;
  const pm = permit(state);
  if (!pm) return fail('Get your learner\'s permit first.');
  if (hasLicense()) return fail('You have your license.');
  const adult = rulesBy(state) ?? known(state).find((n) => n.role === 'stepparent' || n.role === 'grandparent');
  if (!adult) return fail('There is no licensed adult to drive with.');
  if (!once(state, 'drive')) return fail('You have driven with them this season.');
  pm.hours += 10;
  p.flags.drivePractice = (p.flags.drivePractice ?? 0) + 1;
  bump(adult, 2);
  const text = `Ten hours behind the wheel with ${adult.firstName} this season. ${pm.hours >= 40 ? 'You are ready for the test.' : `${pm.hours} hours so far.`}`;
  log(text, 'teen', 'good');
  return done(text);
}

// ---------- Each month ----------

const PRESSURES = ['drink', 'vape', 'dare', 'skip'];
onMonth('teen', (state, m) => {
  const p = state.player;
  const t = T(state);
  if (t.grounded && t.grounded.until <= m && !t.grounded.told) {
    t.grounded.told = true;
    log('You are not grounded any more.', 'teen', 'good');
  }
  const age = ageIn(state, m);
  if (age < 14 || age > 17 || p.legal?.incarceration || !p.alive) return;
  const d = dice(state, 'teen', 'month', m);
  // Peer pressure: a few times a year, someone offers something.
  if (d.chance(0.04)) {
    const kind = d.pick(PRESSURES);
    const pal = d.pick(friends(state)) ?? null;
    if (pal) storyBeat(`fl_pressure_${kind}`, { them: pal.id }, { source: 'family' });
  }
  // A best friend's own drama, now and then.
  const bf = bestFriend(state);
  if (bf && d.chance(0.012)) storyBeat('fl_bff_trouble', { them: bf.id }, { source: 'family' });
});

/** Choices in the teen scenes (data/events/stories/familyLife.js). */
export function teenChoice(story, choice, cast, state = S()) {
  const p = state.player;
  const t = T(state);
  const them = state.npcs[cast.them];
  const d = dice(state, 'teen', 'choice', story, lived(state));
  t.pressure ??= { yes: 0, no: 0 };
  if (story.startsWith('pressure_')) {
    const kind = story.slice(9);
    if (choice === 'no' || choice === 'leave' || choice === 'adult') {
      t.pressure.no++;
      p.hidden.karma = clamp(p.hidden.karma + 1);
      if (them && choice === 'leave') bump(them, -3);
      if (choice === 'adult') { bump(rulesBy(state), 4); if (them) bump(them, -8); }
      return choice === 'adult' ? 'You tell an adult. It is not a popular move, and it is the right one.' : 'You say no. Nobody actually cares as much as you feared.';
    }
    t.pressure.yes++;
    if (them) bump(them, 4);
    p.stats.mood = clamp(p.stats.mood + 2);
    if (kind === 'drink' || kind === 'vape') p.stats.health = clamp(p.stats.health - 2);
    if (kind === 'skip') p.education.gpa = Math.max(0, (p.education.gpa ?? 2.5) - 0.05);
    if (kind === 'dare') p.hidden.karma = clamp(p.hidden.karma - 3);
    if (d.chance(0.3)) { ground(state, 2, kind === 'skip' ? 'skipping school' : kind === 'dare' ? 'a dare that went wrong' : 'coming home smelling of it'); bump(rulesBy(state), -5); return 'You get caught. Grounded for two months.'; }
    return 'Nobody finds out. This time.';
  }
  if (story === 'bff_trouble') {
    if (!them) return '';
    if (choice === 'listen') { bump(them, 8); return `You listen to ${them.firstName} for two hours. It helps.`; }
    if (choice === 'advice') { bump(them, d.chance(0.6) ? 5 : -3); return 'You tell them what you would do. They half take it.'; }
    bump(them, -6);
    return 'You change the subject. They notice.';
  }
  return '';
}
