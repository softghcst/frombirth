// Who the player is and who they love: orientation, gender, coming out,
// transition (social, legal and medical), and how the people around them
// respond. Family can be accepting, unsure or not accepting; over the years
// most can come round, and a few never do.
//
// On the player:
//   p.orientation        'straight' | 'gay' | 'bisexual' | 'pansexual' | 'asexual'
//   p.gender             the gender they live as today
//   p.flags.bornAs       the gender on their birth certificate
//   p.flags.trueGender   set at birth for a transgender character: who they really are
//   p.flags.identity     { knows, outOrientation, outGender, hrtAge, top, bottom, legal, names:[...] }
// On each person:  npc.flags.acceptance  0–100, and npc.flags.stubborn (never changes)
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { careCost } from './medical.js';
import { roleLabel } from './relationships.js';
import { addCondition } from './health.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const ORIENTATIONS = [
  { id: 'straight', name: 'Straight', weight: 86 },
  { id: 'gay', name: 'Gay', weight: 5 },
  { id: 'bisexual', name: 'Bisexual', weight: 5.5 },
  { id: 'pansexual', name: 'Pansexual', weight: 1.5 },
  { id: 'asexual', name: 'Asexual', weight: 2 },
];
export const GENDERS = [{ id: 'female', name: 'Female' }, { id: 'male', name: 'Male' }, { id: 'nonbinary', name: 'Non-binary' }];
/** Roughly how many people are transgender, for everyone the game generates. */
export const TRANS_RATE = 0.012;
/** Base units. Medical costs go through the country's health system like any other treatment. */
export const COSTS = { name: 150, legal: 250, hrtYear: 1200, top: 9000, bottom: 26000 };
export const AGES = { comeOut: 12, socialTransition: 4, hrt: 16, surgery: 18, legal: 18, nameAlone: 18 };

export const orientationName = (id) => ORIENTATIONS.find((o) => o.id === id)?.name ?? 'Straight';
/** "a woman", or "a girl" for someone under 18. */
export const genderName = (id, age = player().age) => ({ female: age < 18 ? 'a girl' : 'a woman', male: age < 18 ? 'a boy' : 'a man', nonbinary: 'non-binary' })[id] ?? id;
export const rollOrientation = () => rng.weighted(ORIENTATIONS, (o) => o.weight).id;

const ident = () => (player().flags.identity ??= { knows: false, outOrientation: false, outGender: false, hrtAge: null, top: false, bottom: false, legal: false, names: [] });
export const identity = () => ident();
export const bornAs = () => player().flags.bornAs ?? player().gender;
export const isTrans = () => bornAs() !== player().gender || (!!player().flags.trueGender && player().flags.trueGender !== bornAs());
/** Which genders someone is drawn to, as the romance engine's 'men' | 'women' | null (anyone). */
export function attractedTo(orientation, gender) {
  if (orientation === 'straight') return gender === 'male' ? 'women' : gender === 'female' ? 'men' : null;
  if (orientation === 'gay') return gender === 'male' ? 'men' : gender === 'female' ? 'women' : null;
  return null;
}

// ---------- How people take it ----------

/** The people whose opinion is felt: family, a partner, close friends. */
const circle = () => livingNpcs().filter((n) => ['parent', 'grandparent', 'sibling', 'spouse', 'partner', 'child', 'grandchild', 'friend', 'relative', 'inlaw'].includes(n.role));

/** Someone's acceptance score, rolled the first time it matters and then remembered. */
export function acceptanceOf(npc) {
  if (npc.flags.acceptance == null) {
    let score = rng.around(52, 52) + (npc.meters.generosity - 50) / 4 - (npc.meters.crazy - 40) / 6;
    if (npc.role === 'grandparent') score -= 14;
    if (npc.role === 'friend' || npc.role === 'sibling' || npc.role === 'child' || npc.role === 'grandchild') score += 12;
    if (npc.orientation && npc.orientation !== 'straight') score += 30;
    if (npc.flags.trans) score += 30;
    npc.flags.acceptance = Math.round(clamp(score));
    // Some people will not be moved, whatever happens.
    npc.flags.stubborn = npc.flags.acceptance < 35 ? rng.chance(0.5) : npc.flags.acceptance < 62 && rng.chance(0.15);
  }
  return npc.flags.acceptance;
}
export const stance = (npc) => (acceptanceOf(npc) >= 62 ? 'accepting' : acceptanceOf(npc) >= 35 ? 'unsure' : 'not accepting');
/** What to show on someone's profile, once the player is out to them. */
export const stanceLabel = (npc) => (npc.flags.knows ? { accepting: 'Accepting', unsure: 'Unsure', 'not accepting': npc.flags.stubborn && npc.flags.triedTalking >= 2 ? 'Will not accept it' : 'Not accepting' }[stance(npc)] : '');

/** Tells everyone in the player's circle, and applies how each takes it. */
function tellEveryone(what) {
  const p = player();
  const taken = { accepting: [], unsure: [], 'not accepting': [] };
  for (const n of circle()) {
    const s = stance(n);
    n.flags.knows = true;
    taken[s].push(n);
    n.meters.relationship = clamp(n.meters.relationship + (s === 'accepting' ? rng.int(6, 12) : s === 'unsure' ? rng.int(-4, 2) : -rng.int(14, 26)));
    n.lastInteractionAge = p.age;
  }
  const list = (ns) => ns.map((n) => `${roleLabel(n).toLowerCase()} ${n.firstName}`).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const parts = [];
  if (taken.accepting.length) parts.push(`Your ${list(taken.accepting)} ${taken.accepting.length === 1 ? 'hugs you and says nothing has changed' : 'are behind you completely'}.`);
  if (taken.unsure.length) parts.push(`Your ${list(taken.unsure)} ${taken.unsure.length === 1 ? 'goes quiet and needs' : 'go quiet and need'} time.`);
  if (taken['not accepting'].length) parts.push(`Your ${list(taken['not accepting'])} ${taken['not accepting'].length === 1 ? 'takes' : 'take'} it badly.`);
  if (!parts.length) parts.push('There was nobody close enough to tell.');
  p.stats.mood = clamp(p.stats.mood + 6 + taken.accepting.length * 2 - taken['not accepting'].length * 4);
  p.hidden.willpower = clamp(p.hidden.willpower + 3);
  return `${what} ${parts.join(' ')}`;
}

/** New people who join the circle after the player is out simply know. */
function informNewcomers() {
  const id = ident();
  if (!id.outOrientation && !id.outGender) return;
  for (const n of circle()) if (!n.flags.knows) { n.flags.knows = true; acceptanceOf(n); }
}

// ---------- Orientation ----------

export const canComeOut = () => player().age >= AGES.comeOut && player().orientation !== 'straight' && !ident().outOrientation;

export function comeOut() {
  const p = player();
  if (!canComeOut()) return result(false, 'There is nothing to tell right now.', 'neutral');
  ident().outOrientation = true;
  const text = tellEveryone(`You tell the people closest to you that you are ${orientationName(p.orientation).toLowerCase()}.`);
  log(text, 'system', 'neutral');
  milestone('Came out.', 'life');
  return result(true, text, 'neutral');
}

/** The player can decide for themselves who they are drawn to, at any age from 12. */
export function setOrientation(id) {
  const p = player();
  if (!ORIENTATIONS.some((o) => o.id === id)) return result(false, 'That is not on the list.', 'neutral');
  p.orientation = id;
  p.flags.interestedIn = attractedTo(id, p.gender);
  ident().outOrientation = false;
  const text = `You understand yourself a little better: you are ${orientationName(id).toLowerCase()}.`;
  log(text);
  return result(true, text, 'neutral');
}

// ---------- Gender ----------

export const canTransition = () => player().age >= AGES.socialTransition;

/** Living as the gender you are. Told to everyone at once; the avatar and the game follow. */
export function liveAs(gender) {
  const p = player();
  if (!canTransition() || gender === p.gender) return result(false, 'Nothing would change.', 'neutral');
  p.flags.bornAs ??= p.gender;
  p.gender = gender;
  ident().knows = true;
  ident().outGender = gender !== p.flags.bornAs;
  p.flags.interestedIn = attractedTo(p.orientation, gender);
  const text = tellEveryone(gender === p.flags.bornAs ? `You tell everyone you are going back to living as ${genderName(gender)}.`
    : `You tell the people closest to you that you are ${genderName(gender)}, and that this is how you will live from now on.`);
  log(text, 'system', 'neutral');
  if (ident().outGender) milestone(`Came out as ${gender === 'nonbinary' ? 'non-binary' : `transgender, and began living as ${genderName(gender)}`}.`, 'life');
  return result(true, text, 'neutral');
}

const parentBacks = () => livingNpcs().some((n) => n.role === 'parent' && stance(n) === 'accepting');

/** A new first name. Adults pay a fee; a child needs a parent who is on their side. */
export function changeName(name) {
  const p = player();
  const c = country();
  const clean = String(name ?? '').trim().slice(0, 20);
  if (!clean || clean === p.firstName) return result(false, 'That is the name you already have.', 'neutral');
  if (p.age < AGES.nameAlone) {
    if (!parentBacks()) return result(false, 'At your age it takes a parent\'s signature, and neither of yours will sign.', 'neutral');
  } else {
    const fee = localMoney(COSTS.name, c);
    if (p.finance.cash < fee) return result(false, `The paperwork costs ${fmtMoney(fee, c)}. You do not have it.`, 'neutral');
    p.finance.cash -= fee;
  }
  p.flags.birthName ??= p.firstName;
  ident().names.push(p.firstName);
  const old = p.firstName;
  p.firstName = clean;
  p.stats.mood = clamp(p.stats.mood + 6);
  // People on your side use it from the first day. The others take their time, or refuse.
  const slow = circle().filter((n) => n.flags.knows && stance(n) === 'not accepting').map((n) => n.firstName);
  const text = `You are ${clean} now. ${old} is a name on old paperwork.${slow.length ? ` ${slow.join(' and ')} still ${slow.length === 1 ? 'uses' : 'use'} the old one.` : ''}`;
  log(text, 'system', 'good');
  milestone(`Changed name from ${old} to ${clean}.`, 'life');
  return result(true, text);
}

export const canChangeLegalGender = () => player().age >= AGES.legal && isTrans() && !ident().legal;
export function changeLegalGender() {
  const p = player();
  const c = country();
  const fee = localMoney(COSTS.legal, c);
  if (!canChangeLegalGender()) return result(false, 'There is nothing to change.', 'neutral');
  if (p.finance.cash < fee) return result(false, `The court fee is ${fmtMoney(fee, c)}. You do not have it.`, 'neutral');
  p.finance.cash -= fee;
  ident().legal = true;
  p.stats.mood = clamp(p.stats.mood + 8);
  const text = `A clerk stamps a form, and your passport, your licence and your birth certificate now say what you have always known. It cost ${fmtMoney(fee, c)}.`;
  log(text, 'system', 'good');
  milestone('Changed legal gender.', 'life');
  return result(true, text);
}

// ---------- Medical transition ----------

export const hrtCost = () => careCost(COSTS.hrtYear);
export const canStartHrt = () => {
  const p = player();
  return isTrans() && !ident().hrtAge && p.age >= AGES.hrt && !p.legal.incarceration;
};
export function startHrt() {
  const p = player();
  const c = country();
  if (!canStartHrt()) return result(false, 'That is not open to you right now.', 'neutral');
  if (p.age < 18 && !parentBacks()) return result(false, 'Under 18, the clinic needs a parent to consent, and neither of yours will.', 'neutral');
  const cost = hrtCost();
  if (p.finance.cash < cost && p.age >= 18) return result(false, `The first year costs ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  if (p.age >= 18) p.finance.cash -= cost;
  ident().hrtAge = p.age;
  p.stats.mood = clamp(p.stats.mood + 12);
  const text = 'You start hormone therapy. The changes will be slow, over years, and the first one is that you can breathe.';
  log(text, 'system', 'good');
  milestone('Started hormone therapy.', 'life');
  return result(true, text);
}
export function stopHrt() {
  if (!ident().hrtAge) return result(false, 'You are not on hormones.', 'neutral');
  ident().hrtAge = null;
  const text = 'You stop hormone therapy.';
  log(text);
  return result(true, text, 'neutral');
}

/** Surgeries open to the player: 'top' and 'bottom', each done once. */
export function surgeryOptions() {
  const p = player();
  const c = country();
  if (!isTrans() || p.age < AGES.surgery || p.legal.incarceration) return [];
  const id = ident();
  return [
    { id: 'top', name: 'Top surgery', done: id.top, cost: careCost(COSTS.top) },
    { id: 'bottom', name: 'Bottom surgery', done: id.bottom, cost: careCost(COSTS.bottom), needsHrt: !id.hrtAge || p.age - id.hrtAge < 1 },
  ].map((s) => ({ ...s, affordable: p.finance.cash >= s.cost, waitingList: c.freeHealthcare }));
}

export function haveSurgery(which) {
  const p = player();
  const c = country();
  const s = surgeryOptions().find((x) => x.id === which);
  if (!s || s.done) return result(false, 'That is not available to you.', 'neutral');
  if (s.needsHrt) return result(false, 'The surgeons ask for at least a year on hormones first.', 'neutral');
  if (p.flags.transSurgeryAge === p.age) return result(false, 'You are still healing. Give it a year.', 'neutral');
  if (p.finance.cash < s.cost) return result(false, `It costs ${fmtMoney(s.cost, c)}. You do not have it.`, 'neutral');
  // Public systems pay, and make you wait.
  if (s.waitingList && rng.chance(0.55)) {
    p.flags.transSurgeryAge = p.age;
    const text = 'You are on the waiting list. It did not come up this year; you keep your place for the next.';
    log(text);
    return result(false, text, 'neutral');
  }
  p.finance.cash -= s.cost;
  p.flags.transSurgeryAge = p.age;
  ident()[which] = true;
  p.counters.surgeries = (p.counters.surgeries ?? 0) + 1;
  if (which === 'bottom') p.hidden.fertility = 0;
  p.stats.mood = clamp(p.stats.mood + (which === 'top' ? 14 : 16));
  let text = `${s.name} went as planned. ${which === 'top' ? 'When the dressings come off, you stand in front of the mirror for a long time.' : 'The recovery is long, and at the end of it your body is your own.'}${s.cost ? ` It cost ${fmtMoney(s.cost, c)}.` : ''}`;
  if (rng.chance(0.06)) {
    p.stats.health = clamp(p.stats.health - rng.int(6, 14));
    addCondition('flu');
    text += ' There was an infection afterwards, and a slow few months.';
  }
  log(text, 'system', 'good');
  milestone(`Had ${s.name.toLowerCase()}.`, 'life');
  return result(true, text);
}

// ---------- Talking it through ----------

export const canTalk = (npc) => npc.flags.knows && stance(npc) !== 'accepting' && npc.flags.talkedAge !== player().age;

/** A real conversation with someone who has not come round. It can help, do nothing, or make it worse. */
export function talkItThrough(npcId) {
  const p = player();
  const n = store.state.npcs[npcId];
  if (!n || !canTalk(n)) return result(false, 'There is nothing new to say this year.', 'neutral');
  n.flags.talkedAge = p.age;
  n.flags.triedTalking = (n.flags.triedTalking ?? 0) + 1;
  n.lastInteractionAge = p.age;
  if (n.flags.stubborn) {
    n.meters.relationship = clamp(n.meters.relationship - 4);
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `You try again with ${n.firstName}. They will not hear it. Some people do not change, and it is not because you said it wrong.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  const chance = clamp(0.45 + (p.stats.charm - 50) / 200 + (n.meters.relationship - 50) / 150, 0.15, 0.9);
  if (rng.chance(chance)) {
    const before = stance(n);
    n.flags.acceptance = clamp(n.flags.acceptance + rng.int(10, 22));
    n.meters.relationship = clamp(n.meters.relationship + 6);
    const now = stance(n);
    const text = now === 'accepting' && before !== 'accepting'
      ? `You and ${n.firstName} talk until late. At the door they hold on to you a moment longer than usual. They have come round.`
      : `${n.firstName} listens, properly, for the first time. They are not there yet, and they are trying.`;
    if (now === 'accepting' && before !== 'accepting') p.stats.mood = clamp(p.stats.mood + 8);
    log(text, 'system', 'good');
    return result(true, text);
  }
  const text = `The conversation with ${n.firstName} goes in circles. Nothing is worse, and nothing is better.`;
  log(text);
  return result(false, text, 'neutral');
}

// ---------- The yearly step ----------

export function tickIdentity() {
  const p = player();
  const id = ident();
  const c = country();
  informNewcomers();
  if (p.flags.trueGender && !id.knows && p.age >= (p.flags.realiseAge ?? 8)) {
    id.knows = true;
    log(`For as long as you can remember, something has not fitted, and now you have the words for it: you are ${genderName(p.flags.trueGender)}. Nobody else knows yet. When you are ready, it is under Self, then Identity.`, 'system', 'neutral');
  }

  // Hormones are paid for each year, and the body follows over time.
  if (id.hrtAge != null && p.age > id.hrtAge) {
    const cost = hrtCost();
    if (p.age >= 18 && p.finance.cash < cost) {
      id.hrtAge = null;
      p.stats.mood = clamp(p.stats.mood - 12);
      log(`You could not afford your hormones this year (${fmtMoney(cost, c)}) and had to stop.`, 'system', 'bad');
    } else {
      if (p.age >= 18) p.finance.cash -= cost;
      p.stats.mood = clamp(p.stats.mood + 2);
      p.hidden.fertility = clamp(p.hidden.fertility - 12);
    }
  }
  // Living as someone you are not wears on a person.
  if (p.flags.trueGender && p.flags.trueGender !== p.gender && id.knows && p.age >= 10) p.stats.mood = clamp(p.stats.mood - 3);

  // The people who know: some come round with time, the stubborn do not, and distance grows where they will not.
  if (!id.outOrientation && !id.outGender) return;
  for (const n of circle()) {
    if (!n.flags.knows) continue;
    const before = stance(n);
    if (before === 'accepting') continue;
    if (!n.flags.stubborn) {
      const close = n.lastInteractionAge >= p.age - 1;
      if (rng.chance(close ? 0.3 : 0.1)) n.flags.acceptance = clamp(n.flags.acceptance + rng.int(3, 10));
    }
    const now = stance(n);
    if (now === 'accepting') {
      n.meters.relationship = clamp(n.meters.relationship + 10);
      p.stats.mood = clamp(p.stats.mood + 6);
      log(`Your ${roleLabel(n).toLowerCase()} ${n.firstName} has come round. They tell you so, awkwardly, and mean it.`, 'system', 'good');
    } else if (now === 'not accepting') {
      n.meters.relationship = clamp(n.meters.relationship - 3);
    }
  }
}
