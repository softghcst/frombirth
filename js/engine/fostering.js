// Foster Care & Guardianship, from the carer's side (the player as a child in care is engine/guardianship.js, which
// this does not touch). An adult can apply to foster: a home study and training, then approval. Placements are offered
// by the agency; a child placed is a real NPC ('fosterchild') with a reason they are in care, a plan, and a birth
// family they may see. A placement ends in reunification, adoption (the child becomes the player's own, as
// children.js adopts), long-term guardianship, a move elsewhere, or aging out at 18. Separately, a relative's child
// whose parent cannot cope can come to live with the player as kinship care, and the player can then ask the court for
// legal guardianship. The agency pays a monthly allowance toward each child's keep.
//
//   LF().care = { carer: { status:'none'|'applying'|'approved'|'closed', applied, approved, training, capacity },
//                 placements: [{ id, childId, kind:'foster'|'kinship'|'guardianship', start, plan, reason, visits,
//                                 end, outcome }], owed, acted: {} }
import { store, log, milestone } from '../state.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { makeNpc } from './npcFactory.js';
import { birthdayFor, dateNow } from './birthday.js';
import { adoptionInfoFor } from './birthTag.js';
import { storyBeat } from './storyDirector.js';
import { LF, lived, nowMonth, ageIn, recordEvent, dice, withDice, onMonth, done, fail, careOk } from './livingFamilies.js';
import { recordPlayerAdoption } from './origins.js';

const S = () => store.state;
const K = (state = S()) => { const c = LF(state).care; c.carer ??= { status: 'none', training: 0, capacity: 1 }; c.placements ??= []; c.owed ??= 0; c.acted ??= {}; return c; };
const turnKey = (state = S()) => `${state.year}:${state.month ?? 0}`;
const bump = (n, d) => { if (n) n.meters.relationship = clamp(n.meters.relationship + d); };
export const FOSTER_AGE = 21;
/** The agency's allowance toward a child's keep, base units a month. */
export const ALLOWANCE = 450;
export const REASONS = [
  { id: 'neglect', text: 'their parent could not look after them properly', back: 0.45 },
  { id: 'addiction', text: 'their mother is in treatment for addiction', back: 0.55 },
  { id: 'illness', text: 'their father is in the hospital, with nobody else to step in', back: 0.75 },
  { id: 'prison', text: 'their only parent is in prison', back: 0.35 },
  { id: 'abandoned', text: 'they were left alone, and nobody came back', back: 0.1 },
  { id: 'violence', text: 'it was not safe for them at home', back: 0.25 },
];

export const carer = (state = S()) => K(state).carer;
export const placements = (state = S(), open = true) => K(state).placements.filter((x) => !open || x.end == null);
export const childOf = (x, state = S()) => state.npcs[x.childId] ?? null;

/** Why the player cannot apply to foster now, or ''. */
export function whyNotFoster(state = S()) {
  const p = state.player;
  if (p.age < FOSTER_AGE) return `Foster carers must be ${FOSTER_AGE} or older.`;
  if (p.legal?.incarceration) return 'Not from where you are.';
  if (p.flags.livesWithParents) return 'You need a home of your own, with a room for a child.';
  if ((p.legal?.record ?? []).some((r) => r.violent || r.kind === 'violent')) return 'A record of violence rules it out.';
  const s = carer(state).status;
  if (s === 'applying') return 'Your application is being assessed.';
  if (s === 'approved') return '';
  return '';
}
export function applyToFoster(state = S()) {
  const p = state.player;
  const why = whyNotFoster(state);
  if (why) return fail(why);
  const c = carer(state);
  if (c.status === 'approved') return fail('You are an approved foster carer.');
  c.status = 'applying';
  c.applied = nowMonth(state);
  const text = 'You fill in the application to become a foster carer. A social worker will visit for the home study: references, checks, and long conversations about your own childhood.';
  log(text, 'care', 'neutral');
  recordEvent(state, 'foster_applied', [p.id], text);
  return done(text, 'neutral');
}
/** Training: up to three sessions, one a season, before or after approval. Better-prepared carers' placements go better. */
export function training(state = S()) {
  const c = carer(state);
  if (!['applying', 'approved'].includes(c.status)) return fail('Apply to foster first.');
  if (c.training >= 3) return fail('You have done all the training on offer.');
  const k = K(state);
  if (k.acted.training === turnKey(state)) return fail('One session a season.');
  k.acted.training = turnKey(state);
  c.training += 1;
  const what = ['Trauma and attachment: why a child may test you hardest when they feel safest.', 'Working with birth families: contact visits, and what to say when a child asks why.', 'Caring for teenagers: independence, risk, and keeping a door open.'][c.training - 1];
  const text = `Training session ${c.training} of 3. ${what}`;
  log(text, 'care', 'good');
  return done(text);
}
export function setCapacity(n, state = S()) {
  const c = carer(state);
  if (c.status !== 'approved') return fail('Only an approved carer can say how many children they can take.');
  c.capacity = clamp(Math.round(n), 1, 3);
  return done(`You tell the agency you can take up to ${c.capacity} ${c.capacity === 1 ? 'child' : 'children'} at a time.`);
}
export function stopFostering(state = S()) {
  const c = carer(state);
  if (c.status !== 'approved' && c.status !== 'applying') return fail('You are not a foster carer.');
  if (placements(state).some((x) => x.kind === 'foster')) return fail('Not while a child is placed with you.');
  c.status = 'closed';
  return done('You tell the agency you are stepping back from fostering. They thank you, and mean it.', 'neutral');
}

/** A child placed with the player: a real NPC, with a reason and a plan. */
function place(state, d, offer) {
  const p = state.player;
  const child = withDice(state, `foster/${offer.key}`, () => {
    const n = makeNpc({ role: 'fosterchild', countryId: p.countryId, age: offer.age, relationship: 25 + d.int(0, 20) });
    state.npcs[n.id] = n;
    p.npcIds.push(n.id);
    n.lastInteractionAge = p.age;
    return n;
  });
  const ok = careOk(state, child.id, p.id);
  if (!ok.ok) return ok;
  child.birthday ??= birthdayFor(child.id);
  child.stats = { mood: 45, health: child.meters.health, intellect: child.meters.intellect, charm: child.meters.charm };
  const reason = REASONS.find((r) => r.id === offer.reason);
  const x = { id: `place_${child.id}`, childId: child.id, kind: 'foster', start: nowMonth(state), plan: offer.plan, reason: reason.id, visits: 0, end: null, outcome: null };
  K(state).placements.push(x);
  child.flags.placement = x.id;
  child.flags.title = 'Foster child';
  const text = `${child.firstName}, ${child.age}, arrives with a social worker and a bin bag of clothes. They are with you because ${reason.text}. The plan is ${offer.plan >= 24 ? 'long-term' : `about ${offer.plan} months`}.`;
  log(text, 'care', 'neutral');
  milestone(`Fostered ${child.firstName}.`, 'family');
  recordEvent(state, 'placement', [p.id, child.id], text);
  return done(text, 'neutral', { childId: child.id });
}

/** Accept or turn down an offered placement (from the agency's call). */
export function answerOffer(yes, state = S()) {
  const k = K(state);
  const offer = k.offer;
  if (!offer) return fail('There is no placement on offer.');
  k.offer = null;
  if (!yes) return done('You tell the agency not this time. They understand: they will call again.', 'neutral');
  return place(state, dice(state, 'care', 'place', offer.key), offer);
}

// ---------- Actions with a child in care ----------

export function careActions(npc, state = S()) {
  const x = placements(state).find((y) => y.childId === npc.id);
  if (!x) return [];
  const used = (id) => K(state).acted[`${id}/${npc.id}`] === turnKey(state);
  const out = [
    { id: 'fl:care:time', label: `Spend time with ${npc.firstName}`, why: used('time') ? 'Done this season' : '' },
    { id: 'fl:care:school', label: 'Go to the school meeting', why: npc.age < 5 || used('school') ? (npc.age < 5 ? 'Not at school yet' : 'Done this season') : '' },
  ];
  if (x.kind === 'foster' && x.reason !== 'abandoned') out.push({ id: 'fl:care:visit', label: 'Take them to see their birth family', why: used('visit') ? 'Done this season' : '' });
  if (x.kind === 'foster' && npc.meters.relationship >= 60 && npc.age < 18) out.push({ id: 'fl:care:adopt', label: `Ask to adopt ${npc.firstName}`, why: nowMonth(state) - x.start < 6 ? 'After six months together' : '' });
  if (x.kind === 'kinship') out.push({ id: 'fl:care:guardian', label: 'Apply for legal guardianship', why: nowMonth(state) - x.start < 6 ? 'After six months together' : '' });
  return out;
}
export function careAct(id, npc, state = S()) {
  const p = state.player;
  const k = K(state);
  const x = placements(state).find((y) => y.childId === npc.id);
  if (!x) return fail('They are not in your care.');
  const once = (key) => { if (k.acted[`${key}/${npc.id}`] === turnKey(state)) return false; k.acted[`${key}/${npc.id}`] = turnKey(state); return true; };
  const d = dice(state, 'care', id, npc.id, lived(state));
  const trained = carer(state).training;
  npc.lastInteractionAge = p.age;
  if (id === 'time') {
    if (!once('time')) return fail('You have done that this season.');
    bump(npc, d.int(3, 7) + trained);
    npc.stats && (npc.stats.mood = clamp(npc.stats.mood + 4));
    const text = d.pick([`You teach ${npc.firstName} to make pancakes. The first three are a disaster. The fourth is perfect.`, `${npc.firstName} lets you read them a story, and is asleep before the end.`, `A Saturday at the park. ${npc.firstName} laughs, really laughs, for the first time since they came.`]);
    log(text, 'care', 'good');
    return done(text);
  }
  if (id === 'school') {
    if (!once('school')) return fail('You have done that this season.');
    bump(npc, 4);
    const text = `You sit on a tiny chair across from ${npc.firstName}'s teacher. You leave with a plan, and a teacher who knows someone is watching out for them.`;
    log(text, 'care', 'good');
    return done(text);
  }
  if (id === 'visit') {
    if (!once('visit')) return fail('You have done that this season.');
    x.visits += 1;
    const good = d.chance(0.6 + trained * 0.05);
    bump(npc, good ? 5 : -2);
    const text = good ? `A contact visit at the family center. ${npc.firstName} holds on to their parent for a long time at the end.` : `Their parent does not come. ${npc.firstName} waits by the window for forty minutes, and then says it does not matter.`;
    log(text, 'care', good ? 'good' : 'bad');
    return done(text, good ? 'good' : 'bad');
  }
  if (id === 'adopt') return adoptFromCare(npc, state);
  if (id === 'guardian') return seekGuardianship(npc, state);
  return fail('Nothing happens.');
}

function closePlacement(state, x, outcome, text) {
  x.end = nowMonth(state);
  x.outcome = outcome;
  const n = childOf(x, state);
  if (n) delete n.flags.placement;
  recordEvent(state, `care_${outcome}`, [state.player.id, x.childId], text);
}
/** Adopting a child from care: the agency and a court agree; they become the player's child for good. */
export function adoptFromCare(npc, state = S()) {
  const p = state.player;
  const x = placements(state).find((y) => y.childId === npc.id && y.kind === 'foster');
  if (!x) return fail('They are not fostered with you.');
  if (nowMonth(state) - x.start < 6) return fail('The agency will consider it after six months together.');
  if (npc.meters.relationship < 60) return fail(`${npc.firstName} needs to feel settled first.`);
  const d = dice(state, 'care', 'adopt', npc.id);
  const back = REASONS.find((r) => r.id === x.reason)?.back ?? 0.4;
  if (x.visits >= 2 && back >= 0.5 && d.chance(0.6)) {
    const text = `The agency says no, for now: the plan is still for ${npc.firstName} to go home, and their parent is doing everything asked of them.`;
    log(text, 'care', 'neutral');
    return fail(text);
  }
  npc.role = 'child';
  npc.adopted = true;
  npc.lastName = p.lastName;
  delete npc.flags.title;
  npc.adoptionInfo = adoptionInfoFor(npc, { date: dateNow(), countryId: p.countryId, city: p.city, by: [p.id] });
  npc.flags.adoptionCard = 'new';
  npc.flags.fromCare = true;
  recordPlayerAdoption(npc, [p.id]); // the adoption's own record (engine/origins.js)
  bump(npc, 10);
  p.hidden.karma = clamp(p.hidden.karma + 6);
  const text = `The court makes it final. ${npc.firstName} is your child now, and takes your name. They ask if they can stay up late to celebrate. Of course they can.`;
  closePlacement(state, x, 'adopted', text);
  log(text, 'care', 'good');
  milestone(`Adopted ${npc.firstName} from foster care.`, 'family');
  return done(text);
}
/** Kinship care becomes legal guardianship: a court order, with a fee. */
export function seekGuardianship(npc, state = S()) {
  const p = state.player;
  const x = placements(state).find((y) => y.childId === npc.id && y.kind === 'kinship');
  if (!x) return fail('They are not living with you under kinship care.');
  if (nowMonth(state) - x.start < 6) return fail('The court will hear it after six months.');
  const c = COUNTRIES[p.countryId];
  const fee = localMoney(800, c);
  if (p.finance.cash < fee) return fail(`The court fees come to ${fmtMoney(fee, c)}.`);
  p.finance.cash -= fee;
  x.kind = 'guardianship';
  npc.flags.guardian = p.id;
  bump(npc, 5);
  const text = `The family court grants you legal guardianship of ${npc.firstName}. You can sign the school forms now, and the doctor's. It cost ${fmtMoney(fee, c)}.`;
  log(text, 'care', 'good');
  milestone(`Became ${npc.firstName}'s legal guardian.`, 'family');
  recordEvent(state, 'guardianship', [p.id, npc.id], text);
  return done(text);
}

/** Takes a relative's child in (from the kinship scene). */
export function takeInRelative(childId, state = S()) {
  const p = state.player;
  const n = state.npcs[childId];
  const ok = careOk(state, childId, p.id);
  if (!ok.ok) return ok;
  if (placements(state).some((x) => x.childId === childId)) return fail('They already live with you.');
  const x = { id: `kin_${childId}_${nowMonth(state)}`, childId, kind: 'kinship', start: nowMonth(state), plan: 24, reason: 'family', visits: 0, end: null, outcome: null };
  K(state).placements.push(x);
  n.flags.livesWith = 'player';
  n.flags.placement = x.id;
  bump(n, 8);
  const text = `${n.firstName} comes to live with you. Their things fit in two suitcases. You clear a room.`;
  log(text, 'care', 'good');
  milestone(`Took in ${n.firstName}.`, 'family');
  recordEvent(state, 'kinship', [p.id, n.id], text);
  return done(text);
}

// ---------- Each month ----------

onMonth('care', (state, m) => {
  const p = state.player;
  const k = K(state);
  const c = k.carer;
  const d = (...key) => dice(state, 'care', ...key, m);
  // The home study takes three months; approval depends on the checks and how the conversations went.
  if (c.status === 'applying' && m - c.applied >= 3) {
    const okd = d('approve').chance(clamp(0.6 + (p.hidden.karma - 50) / 150 + c.training * 0.08, 0.2, 0.97));
    c.status = okd ? 'approved' : 'none';
    if (okd) c.approved = m;
    const text = okd ? 'The fostering panel approves you. You are a foster carer now, and the agency may call at any hour.' : 'The panel decides not to approve you this time. You can apply again.';
    log(text, 'care', okd ? 'good' : 'bad');
    recordEvent(state, okd ? 'foster_approved' : 'foster_refused', [p.id], text);
  }
  const open = placements(state);
  // The allowance toward each fostered or kinship child's keep.
  const country = COUNTRIES[p.countryId];
  for (const x of open) k.owed += localMoney(ALLOWANCE * (x.kind === 'foster' ? 1 : 0.6), country); // guardianship and kinship: a smaller allowance
  // An approved carer with room is offered placements, every few months.
  if (c.status === 'approved' && !k.offer && open.filter((x) => x.kind === 'foster').length < (c.capacity ?? 1) && p.alive && !p.legal?.incarceration && d('offer').chance(0.18)) {
    const r = d('offerHow');
    const reason = r.pick(REASONS).id;
    k.offer = { key: `${m}`, age: r.int(0, 16), reason, plan: r.pick([6, 9, 12, 18, 24]), made: m };
    storyBeat('fl_placement_offer', { words: { age: String(k.offer.age) } }, { source: 'family', must: true });
  }
  if (k.offer && m - k.offer.made > 2) k.offer = null; // the agency found someone else
  // Each placement moves on: aging out, the plan's end (home, adoption, or a longer stay), a bad turn.
  for (const x of open) {
    const n = childOf(x, state);
    if (!n?.alive) { closePlacement(state, x, 'ended', 'The placement ended.'); continue; }
    if (n.age >= 18) {
      const text = `${n.firstName} turns 18 and ages out of care. ${n.meters.relationship >= 60 ? 'They stay in touch, and come for Sunday dinner.' : 'They leave with a box of things and your number.'}`;
      if (x.kind === 'foster') { n.role = n.meters.relationship >= 50 ? 'relative' : 'friend'; n.flags.title = 'Former foster child'; }
      closePlacement(state, x, 'aged_out', text);
      log(text, 'care', 'neutral');
      continue;
    }
    if (x.kind !== 'foster') continue;
    if (m - x.start >= x.plan) {
      const back = REASONS.find((y) => y.id === x.reason)?.back ?? 0.4;
      const home = d('home', x.id).chance(clamp(back + x.visits * 0.05, 0, 0.9));
      if (home) {
        const text = `${n.firstName}'s parent has done everything the court asked. ${n.firstName} goes home. You pack their things with them, and both of you cry.`;
        n.role = 'relative'; n.flags.title = 'Former foster child'; n.meters.relationship = clamp(n.meters.relationship + 5);
        closePlacement(state, x, 'reunified', text);
        log(text, 'care', 'good');
      } else {
        x.plan += 12;
        storyBeat('fl_care_review', { them: n.id }, { source: 'family', must: true });
      }
    } else if (n.meters.relationship < 15 && d('breakdown', x.id).chance(0.08)) {
      const text = `It is not working, and everyone can see it. The agency moves ${n.firstName} to another home. You keep their drawing on the fridge.`;
      n.role = 'relative'; n.flags.title = 'Former foster child';
      closePlacement(state, x, 'moved', text);
      log(text, 'care', 'bad');
    }
  }
  // A relative's child whose parent cannot cope: once in a long while, family asks the player to step in.
  if (ageIn(state, m) >= 25 && !p.legal?.incarceration && !p.flags.livesWithParents && d('kin').chance(0.0015)) {
    const kids = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive && ['niece', 'grandchild'].includes(n.role) && n.age < 16 && !placements(state).some((x) => x.childId === n.id));
    const kid = d('kinWho').pick(kids);
    if (kid) storyBeat('fl_kinship', { them: kid.id }, { source: 'family', must: true });
  }
});

/** The year's allowance, paid at the turn of the year (a yearly step, booked with the rest). */
export function payAllowance(state = S()) {
  const k = K(state);
  if (!k.owed) return 0;
  const paid = Math.round(k.owed);
  state.player.finance.cash += paid;
  k.owed = 0;
  log(`The fostering allowance for the year comes to ${fmtMoney(paid, COUNTRIES[state.player.countryId])}.`, 'care', 'neutral');
  return paid;
}

/** Choices in the care scenes. */
export function careChoice(story, choice, cast, state = S()) {
  const n = cast.them ? state.npcs[cast.them] : null;
  if (story === 'placement_offer') return answerOffer(choice === 'yes', state).text;
  if (story === 'kinship') {
    if (!n) return '';
    if (choice === 'yes') return takeInRelative(n.id, state).text;
    if (choice === 'help') { state.player.finance.cash -= Math.min(state.player.finance.cash, localMoney(500, COUNTRIES[state.player.countryId])); bump(n, 2); return 'You send money and call every week. Another relative takes them in.'; }
    return `You cannot take ${n.firstName} in. They go into foster care, two towns away.`;
  }
  if (story === 'care_review') {
    const x = n && placements(state).find((y) => y.childId === n.id);
    if (!x) return '';
    if (choice === 'longterm') { x.plan += 24; bump(n, 5); return `You tell the review you will keep ${n.firstName} for as long as they need. They look at you as if checking you mean it.`; }
    if (choice === 'adopt') return adoptFromCare(n, state).text;
    return 'The plan stays as it is, for another year.';
  }
  return '';
}
