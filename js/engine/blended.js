// Blended Families & Stepparents. A child's parents can part while they are growing up, and either can meet someone
// new: a stepparent, who may bring children of their own (stepsiblings), and in time a half-sibling. Where a child
// lives after a separation is a custody arrangement, which a teenager can ask to change. As an adult, marrying someone
// with children makes the player a stepparent; a stepchild can be adopted with the other parent's consent.
//
// Everyone here is a real NPC with a role the rest of the game already knows ('stepparent', 'stepsibling',
// 'stepchild'; a half-sibling is a 'sibling' with flags.half, as legacy.js has always made them), so the stories that
// were waiting for them (engine/familyStories.js: stepparent_new, stepchild_trust, blended_family) can now be told.
//
//   LF().blended = { custody: { with, other, kind:'sole'|'shared', since, asked } | null, split: month | null,
//                    acted: { [key]: turnKey } }
//   stepparent:  npc.flags.stepOf = parentId, npc.flags.inHome (lives with the player's household), npc.flags.since
//   stepsibling: npc.flags.stepVia = stepparentId
//   stepchild:   npc.parentIds = [spouseId], npc.flags.stepVia = spouseId
import { store, player, log, milestone } from '../state.js';
import { clamp } from '../util.js';
import { makeNpc } from './npcFactory.js';
import { storyBeat } from './storyDirector.js';
import { LF, lived, ageIn, recordEvent, dice, withDice, onMonth, done, fail } from './livingFamilies.js';

const S = () => store.state;
const B = (state = S()) => LF(state).blended;
const parents = (state = S()) => state.player.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === 'parent');
const living = (state, role) => state.player.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && n.role === role);
const turnKey = (state = S()) => `${state.year}:${state.month ?? 0}`;
const bump = (n, d) => { n.meters.relationship = clamp(n.meters.relationship + d); };

function addPerson(state, npc) {
  state.npcs[npc.id] = npc;
  state.player.npcIds.push(npc.id);
  npc.lastInteractionAge = state.player.age;
  return npc;
}

/** The parent the player lives with, and the one they visit, after a separation. */
export function custody(state = S()) {
  const c = B(state).custody;
  if (!c) return null;
  const w = state.npcs[c.with];
  const o = state.npcs[c.other];
  return { ...c, withNpc: w?.alive ? w : null, otherNpc: o?.alive ? o : null };
}
export const stepparents = (state = S()) => living(state, 'stepparent');
export const stepsiblings = (state = S()) => living(state, 'stepsibling');
export const stepchildren = (state = S()) => living(state, 'stepchild');
export const halfSiblings = (state = S()) => living(state, 'sibling').filter((n) => n.flags.half);

// ---------- A separation ----------

/**
 * The player's parents separate. Custody goes, as courts most often decide, to one parent with time with the other,
 * or is shared. Never while the player is in someone else's care, or once they are grown up.
 */
export function separateParents(state = S(), d = dice(state, 'blended', 'split', lived(state))) {
  const p = state.player;
  const [a, b] = parents(state);
  if (!a || !b || p.flags.parentsStatus !== 'together') return fail('Your parents are not together.');
  const mother = [a, b].find((n) => n.gender === 'female') ?? a;
  const father = mother === a ? b : a;
  const roll = d.next();
  const kind = roll < 0.18 ? 'shared' : 'sole';
  const withNpc = roll < 0.18 ? mother : roll < 0.78 ? mother : father;
  const other = withNpc === mother ? father : mother;
  p.flags.parentsStatus = 'separated';
  B(state).split = lived(state);
  B(state).custody = { with: withNpc.id, other: other.id, kind, since: lived(state), asked: null };
  for (const n of [a, b]) { n.flags.partnerId = null; n.flags.separatedAt = lived(state); }
  bump(a, -4); bump(b, -4);
  p.stats.mood = clamp(p.stats.mood - (p.age < 12 ? 10 : 14));
  const where = kind === 'shared' ? `You will split your time between them, a week at each.` : `You live with your ${withNpc.gender === 'male' ? 'father' : 'mother'}, and see your ${other.gender === 'male' ? 'father' : 'mother'} every other weekend.`;
  const text = `Your parents sit you down together: they are separating. ${where}`;
  log(text, 'family', 'bad');
  milestone('Your parents separated.', 'family');
  recordEvent(state, 'parents_separated', [p.id, a.id, b.id], text);
  storyBeat('fl_parents_split', { mom: mother.id, dad: father.id }, { source: 'family', must: true });
  return done(text, 'bad');
}

/** A teenager asks to live with their other parent. Courts listen more as a child gets older. Once a year. */
export function askToMove(state = S()) {
  const p = state.player;
  const c = custody(state);
  if (!c?.otherNpc) return fail('There is no other home to move to.');
  if (p.age < 12) return fail('From age 12 you can ask where you want to live.');
  if (c.asked === state.year) return fail('You asked this year already. Give it time.');
  B(state).custody.asked = state.year;
  const d = dice(state, 'blended', 'ask', state.year);
  const pull = (c.otherNpc.meters.relationship - (c.withNpc?.meters.relationship ?? 50)) / 200;
  const chance = clamp(0.25 + (p.age - 12) * 0.12 + pull, 0.1, 0.95, 0);
  if (!d.chance(Math.min(0.95, chance))) {
    if (c.withNpc) bump(c.withNpc, -6);
    const text = `You asked to go and live with your ${c.otherNpc.gender === 'male' ? 'father' : 'mother'}. The answer, for now, is no. It hurt ${c.withNpc?.firstName ?? 'them'} that you asked.`;
    log(text, 'family', 'bad');
    return fail(text, 'bad');
  }
  B(state).custody = { ...B(state).custody, with: c.otherNpc.id, other: c.withNpc?.id ?? null, kind: 'sole', since: lived(state) };
  bump(c.otherNpc, 8);
  if (c.withNpc) bump(c.withNpc, -8);
  // Whoever lives with the parent now lives with the player; the other household does not.
  for (const s of [...stepparents(state), ...stepsiblings(state)]) s.flags.inHome = homeOf(state, s) === B(state).custody.with;
  const text = `You move in with your ${c.otherNpc.gender === 'male' ? 'father' : 'mother'}. A bag, a box, and a different bedroom.`;
  log(text, 'family', 'neutral');
  recordEvent(state, 'custody_changed', [p.id, c.otherNpc.id], text);
  return done(text, 'neutral');
}

/** Which parent's household a step relative belongs to. */
function homeOf(state, n) {
  if (n.role === 'stepparent') return n.flags.stepOf;
  const via = state.npcs[n.flags.stepVia];
  return via?.flags.stepOf ?? null;
}

/** Time with the parent the player does not live with: once a turn. */
export function visitOtherParent(state = S()) {
  const c = custody(state);
  if (!c?.otherNpc) return fail('There is no other parent to visit.');
  const key = `visit:${turnKey(state)}`;
  if (B(state).acted?.visit === key) return fail('You have seen them this season already.');
  (B(state).acted ??= {}).visit = key;
  bump(c.otherNpc, 6);
  c.otherNpc.lastInteractionAge = state.player.age;
  state.player.stats.mood = clamp(state.player.stats.mood + 3);
  const text = `A weekend at your ${c.otherNpc.gender === 'male' ? 'father' : 'mother'}'s: takeaway, a film, the spare room that is yours.`;
  log(text, 'family', 'good');
  return done(text);
}

// ---------- Someone new ----------

/** A separated or single parent meets someone, who becomes the player's stepparent (with any children they have). */
export function parentRemarries(state = S(), parent, d = dice(state, 'blended', 'meet', parent.id, lived(state))) {
  const p = state.player;
  if (!parent?.alive || parent.role !== 'parent') return fail('No parent.');
  if (stepparents(state).some((s) => s.flags.stepOf === parent.id)) return fail('They are already with someone.');
  const gender = parent.gender === 'male' ? (d.chance(0.95) ? 'female' : 'male') : (d.chance(0.95) ? 'male' : 'female');
  const step = withDice(state, `step/${parent.id}/${lived(state)}`, () => addPerson(state, makeNpc({ role: 'stepparent', countryId: p.countryId, gender, age: Math.max(22, parent.age + d.int(-6, 6)), relationship: 30 + d.int(0, 25) })));
  step.flags.stepOf = parent.id;
  step.flags.since = lived(state);
  const c = B(state).custody;
  step.flags.inHome = p.flags.livesWithParents && (!c || c.with === parent.id || p.flags.parentsStatus === 'single');
  parent.flags.partnerId = step.id;
  // Some bring children of their own.
  const kids = [];
  if (d.chance(0.45)) {
    const n = d.chance(0.35) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const kid = withDice(state, `stepkid/${step.id}/${i}`, () => addPerson(state, makeNpc({ role: 'stepsibling', countryId: p.countryId, lastName: step.lastName, age: clamp(p.age + d.int(-6, 6), 0, 25), relationship: 25 + d.int(0, 30) })));
      kid.parentIds = [step.id];
      kid.flags.stepVia = step.id;
      kid.flags.inHome = step.flags.inHome && kid.age < 18;
      kids.push(kid);
    }
  }
  const pw = parent.gender === 'male' ? 'father' : 'mother';
  const text = `Your ${pw} has met someone: ${step.firstName} ${step.lastName}.${kids.length ? ` ${step.firstName} has ${kids.length === 1 ? `a ${kids[0].gender === 'male' ? 'son' : 'daughter'}, ${kids[0].firstName} (${kids[0].age})` : `two children, ${kids[0].firstName} and ${kids[1].firstName}`}.` : ''}${step.flags.inHome ? ` Before long, ${step.firstName}${kids.length ? ' and the children' : ''} move in.` : ''}`;
  log(text, 'family', 'neutral');
  milestone(`Gained a stepparent: ${step.firstName} ${step.lastName}.`, 'family');
  recordEvent(state, 'stepparent', [p.id, parent.id, step.id, ...kids.map((k) => k.id)], text);
  if (kids.length) recordEvent(state, 'stepsiblings', [p.id, ...kids.map((k) => k.id)], `${kids.map((k) => k.firstName).join(' and ')} became your step${kids.length > 1 ? 'siblings' : kids[0].gender === 'male' ? 'brother' : 'sister'}.`);
  storyBeat('fl_stepparent_meet', { step: step.id, parent: parent.id }, { source: 'family', must: true });
  return done(text, 'neutral', { stepId: step.id, kids: kids.map((k) => k.id) });
}

/** A parent and stepparent have a baby: the player's half-sibling. */
function halfSiblingBorn(state, parent, step) {
  const p = state.player;
  const baby = withDice(state, `half/${step.id}/${lived(state)}`, () => addPerson(state, makeNpc({ role: 'sibling', countryId: p.countryId, lastName: parent.lastName, age: 0, relationship: 55 })));
  baby.parentIds = [parent.id, step.id];
  baby.flags.half = true;
  baby.flags.inHome = !!step.flags.inHome;
  const text = `Your ${parent.gender === 'male' ? 'father' : 'mother'} and ${step.firstName} have a baby: ${baby.firstName}, your half-${baby.gender === 'male' ? 'brother' : 'sister'}.`;
  log(text, 'family', 'good');
  milestone(`Half-${baby.gender === 'male' ? 'brother' : 'sister'} ${baby.firstName} was born.`, 'family');
  recordEvent(state, 'half_sibling', [p.id, parent.id, step.id, baby.id], text);
  return baby;
}

// ---------- The player's own actions with a step relative ----------

/** What the player can do with a step relative (shown on their profile and in Family Life). */
export function stepActions(npc, state = S()) {
  const p = state.player;
  const acted = (B(state).acted ??= {});
  const key = turnKey(state);
  const used = (id) => acted[`${id}/${npc.id}`] === key;
  const out = [];
  if (npc.role === 'stepparent') {
    out.push({ id: 'fl:step:know', label: `Get to know ${npc.firstName}`, why: used('know') ? 'Done this season' : '' });
    if (!npc.flags.calledParent && npc.meters.relationship >= 70 && p.age < 30) out.push({ id: 'fl:step:call', label: `Call ${npc.firstName} ${npc.gender === 'male' ? '"Dad"' : '"Mom"'}` });
    if (p.age >= 10 && p.age < 18) out.push({ id: 'fl:step:push', label: 'Tell them they are not your parent', danger: true });
  }
  if (npc.role === 'stepsibling') {
    out.push({ id: 'fl:step:hang', label: `Do something with ${npc.firstName}`, why: used('hang') ? 'Done this season' : '' });
    if (npc.flags.inHome && p.age < 18) out.push({ id: 'fl:step:room', label: 'Sort out sharing the house' });
  }
  if (npc.role === 'stepchild') {
    out.push({ id: 'fl:step:bond', label: `Spend time with ${npc.firstName}`, why: used('bond') ? 'Done this season' : '' });
    if (npc.age < 18 && !npc.flags.adoptAsked) out.push({ id: 'fl:step:adopt', label: `Adopt ${npc.firstName}`, why: npc.meters.relationship < 60 ? 'Get closer first' : '' });
  }
  return out;
}

/** Does one of stepActions. */
export function stepAct(id, npc, state = S()) {
  const p = state.player;
  const acted = (B(state).acted ??= {});
  const key = turnKey(state);
  const once = (k) => { if (acted[`${k}/${npc.id}`] === key) return false; acted[`${k}/${npc.id}`] = key; return true; };
  const d = dice(state, 'blended', id, npc.id, lived(state));
  npc.lastInteractionAge = p.age;
  switch (id) {
    case 'know': {
      if (!once('know')) return fail('You have done that this season.');
      const g = d.int(3, 8);
      bump(npc, g);
      const text = d.chance(0.5) ? `You let ${npc.firstName} drive you to practice and, somewhere on the ring road, you talk properly for the first time.` : `${npc.firstName} asks about your week and actually listens to the answer.`;
      log(text, 'family', 'good');
      return done(text);
    }
    case 'call': {
      npc.flags.calledParent = true;
      bump(npc, 12);
      const text = `The first time you say it, ${npc.firstName} has to look away for a moment.`;
      log(text, 'family', 'good');
      recordEvent(state, 'step_named', [p.id, npc.id], text);
      return done(text);
    }
    case 'push': {
      bump(npc, -12);
      p.stats.mood = clamp(p.stats.mood + 2);
      const text = `"You are not my parent." ${npc.firstName} says that is true, quietly, and leaves the room.`;
      log(text, 'family', 'bad');
      return done(text, 'bad');
    }
    case 'hang': {
      if (!once('hang')) return fail('You have done that this season.');
      const good = d.chance(0.65 + (npc.meters.relationship - 50) / 200);
      bump(npc, good ? d.int(4, 9) : -d.int(2, 5));
      const text = good ? `You and ${npc.firstName} end up laughing at the same stupid video. Something shifts.` : `${npc.firstName} plainly would rather be anywhere else.`;
      log(text, 'family', good ? 'good' : 'neutral');
      return done(text, good ? 'good' : 'neutral');
    }
    case 'room': {
      const good = d.chance(0.6);
      bump(npc, good ? 6 : -6);
      const text = good ? `You agree a timetable for the bathroom, and a shelf each. It is almost civilized.` : `It ends in a shouting match about a charger, and a parent in the doorway.`;
      log(text, 'family', good ? 'good' : 'bad');
      return done(text, good ? 'good' : 'bad');
    }
    case 'bond': {
      if (!once('bond')) return fail('You have done that this season.');
      bump(npc, d.int(4, 9));
      p.stats.mood = clamp(p.stats.mood + 2);
      const text = npc.age < 12 ? `You build something enormous with ${npc.firstName} out of cardboard. It takes all afternoon.` : `You drive ${npc.firstName} somewhere and they forget to put headphones in.`;
      log(text, 'family', 'good');
      return done(text);
    }
    case 'adopt': return adoptStepchild(npc, state);
    default: return fail('Nothing happens.');
  }
}

/** Adopting a stepchild: their other parent must consent (or be gone), and the child, if old enough, must want it. */
export function adoptStepchild(npc, state = S()) {
  const p = state.player;
  if (npc.role !== 'stepchild' || npc.age >= 18) return fail('Only a stepchild under 18 can be adopted.');
  if (npc.meters.relationship < 60) return fail(`${npc.firstName} is not ready for that.`);
  npc.flags.adoptAsked = state.year;
  const d = dice(state, 'blended', 'adopt', npc.id);
  if (npc.age >= 12 && !d.chance(0.5 + (npc.meters.relationship - 60) / 80)) {
    const text = `You ask ${npc.firstName} how they would feel about it. They say they need to think, and that their other parent is still their parent.`;
    log(text, 'family', 'neutral');
    return fail(text);
  }
  if (!d.chance(0.6)) {
    const text = `${npc.firstName}'s other parent will not consent, and without that the court cannot go ahead.`;
    log(text, 'family', 'bad');
    return fail(text, 'bad');
  }
  npc.role = 'child';
  npc.adopted = true;
  npc.flags.stepAdopted = true;
  npc.lastName = p.lastName;
  bump(npc, 10);
  const text = `In a short hearing in a small courtroom, the judge signs the order. ${npc.firstName} is legally your child.`;
  log(text, 'family', 'good');
  milestone(`Adopted stepchild ${npc.firstName}.`, 'family');
  recordEvent(state, 'stepchild_adopted', [p.id, npc.id], text);
  return done(text);
}

/** When the player marries: a spouse with children from before brings them into the family as stepchildren. */
export function onMarriage(spouse, state = S()) {
  if (!spouse || spouse.flags.stepKidsChecked) return [];
  spouse.flags.stepKidsChecked = true;
  const d = dice(state, 'blended', 'spousekids', spouse.id);
  const chance = clamp((spouse.age - 24) * 0.03, 0, 0.4, 0);
  if (!d.chance(Math.min(0.4, Math.max(0, chance)))) return [];
  const n = d.chance(0.3) ? 2 : 1;
  const kids = [];
  for (let i = 0; i < n; i++) {
    const kid = withDice(state, `stepchild/${spouse.id}/${i}`, () => addPerson(state, makeNpc({ role: 'stepchild', countryId: state.player.countryId, lastName: spouse.lastName, age: d.int(1, Math.max(1, Math.min(17, spouse.age - 20))), relationship: 35 + d.int(0, 25) })));
    kid.parentIds = [spouse.id];
    kid.flags.stepVia = spouse.id;
    kids.push(kid);
  }
  const text = `Marrying ${spouse.firstName} means ${kids.length === 1 ? `${kids[0].firstName} (${kids[0].age}), ${spouse.firstName}'s ${kids[0].gender === 'male' ? 'son' : 'daughter'}` : `${kids[0].firstName} and ${kids[1].firstName}, ${spouse.firstName}'s children`}, ${kids.length === 1 ? 'is' : 'are'} now your family too.`;
  log(text, 'family', 'neutral');
  recordEvent(state, 'stepchildren', [state.player.id, spouse.id, ...kids.map((k) => k.id)], text);
  return kids;
}

// ---------- Each month ----------

onMonth('blended', (state, m) => {
  const p = state.player;
  const d = (...k) => dice(state, 'blended', ...k, m);
  // Children grow up: a stepsibling who has left home, a stepparent of a parent who has died.
  for (const s of stepparents(state)) {
    const parent = state.npcs[s.flags.stepOf];
    if (!parent?.alive && s.flags.inHome == null) s.flags.inHome = false;
  }
  for (const k of stepsiblings(state)) if (k.age >= 19 && k.flags.inHome) k.flags.inHome = false;
  // A stepchild whose parent is no longer the player's spouse becomes a former stepchild.
  for (const k of stepchildren(state)) {
    const via = state.npcs[k.flags.stepVia];
    if (!via || via.role !== 'spouse' || !via.alive) {
      if (via && !via.alive) continue; // a widowed stepparent stays one
      k.role = 'relative';
      k.flags.title = 'Former stepchild';
      recordEvent(state, 'stepchild_former', [p.id, k.id], `${k.firstName} is your former stepchild now.`);
    }
  }
  if (ageIn(state, m) >= 18 || p.flags.care || !p.alive) return;
  // Parents together may part (about one family in seventy each year, more in the first years than later).
  if (p.flags.parentsStatus === 'together' && parents(state).length === 2 && d('split').chance(0.0011)) separateParents(state, d('splitHow'));
  // A separated or single parent may meet someone, a year or more after a separation.
  const b = B(state);
  if (['separated', 'single'].includes(p.flags.parentsStatus) && (b.split == null || m - b.split >= 12)) {
    for (const parent of parents(state)) {
      if (parent.age > 62 || stepparents(state).some((s) => s.flags.stepOf === parent.id)) continue;
      if (d('meet', parent.id).chance(0.0045)) parentRemarries(state, parent, d('meetHow', parent.id));
    }
  }
  // A parent and stepparent may have a baby.
  for (const s of stepparents(state)) {
    const parent = state.npcs[s.flags.stepOf];
    const mother = parent?.gender === 'female' ? parent : s.gender === 'female' ? s : null;
    if (!parent?.alive || !mother || mother.age > 43 || m - (s.flags.since ?? m) < 9) continue;
    if (halfSiblings(state).some((h) => h.parentIds?.includes(s.id) && h.age < 2)) continue;
    if (d('baby', s.id).chance(0.0035)) halfSiblingBorn(state, parent, s);
  }
});

/** Choices in the family scenes (data/events/stories/familyLife.js). */
export function blendedChoice(story, choice, cast, state = S()) {
  const p = state.player;
  if (story === 'parents_split') {
    const c = custody(state);
    if (choice === 'questions') { p.stats.mood = clamp(p.stats.mood + 3); return 'They answer what they can. Some of it, they say, they do not know yet either.'; }
    if (choice === 'blame') { if (c?.withNpc) bump(c.withNpc, -4); if (c?.otherNpc) bump(c.otherNpc, -4); return 'You say it is their fault. Neither of them argues.'; }
    p.stats.mood = clamp(p.stats.mood - 2);
    return 'You go to your room and put your headphones on.';
  }
  if (story === 'stepparent_meet') {
    const step = state.npcs[cast.step];
    if (!step) return '';
    if (choice === 'welcome') { bump(step, 10); return `${step.firstName} looks relieved.`; }
    if (choice === 'polite') { bump(step, 3); return 'You are polite. It is a start.'; }
    bump(step, -8);
    const parent = state.npcs[cast.parent];
    if (parent) bump(parent, -4);
    return 'You make it very clear you are not interested.';
  }
  return '';
}
