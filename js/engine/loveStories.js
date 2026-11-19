// The stories that grow out of real relationships (engine/bonds.js keeps the relationships; this decides which of the
// things that could be said this year are said). Each story has a test of the world as it actually is: these two
// people, this history. A story whose test fails cannot be told, whatever the settings; nothing is made up to tell one.
// At most a couple are told in a year, however long a turn is; each is told once per relationship unless it says
// otherwise, and a "no" is remembered.
//
//   state.bonds.told = { [story id + '/' + who]: year }     state.settings.drama = 'low'|'balanced'|'high'
//   state.settings.sensitiveFamily = true to allow the teenage pregnancy storyline (off unless turned on)
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { remember } from './conditions.js';
import { book } from './ledger.js';
import * as love from './romance.js';
import * as bonds from './bonds.js';
import { guardians } from './childhood.js';
import { decide } from './pregnancyChoice.js';

const npcOf = (id) => store.state.npcs[id];
const bump = (npc, d) => { if (npc) npc.meters.relationship = clamp(npc.meters.relationship + d); };
const told = () => ((store.state.bonds ??= { seq: 0, list: {} }).told ??= {});
export const DRAMA = { low: { chance: 0.35, most: 1 }, balanced: { chance: 0.6, most: 1 }, high: { chance: 0.85, most: 2 } };
export const dramaOf = () => (DRAMA[store.state.settings?.drama] ? store.state.settings.drama : 'balanced');
export const sensitiveOn = () => store.state.settings?.sensitiveFamily === true;
const LAVISH = 3000;

/** The stories, each with who it could be about now (or nobody). `again`: years before it may be told of them again. */
const STORIES = [
  { id: 'other_address', who: () => bonds.others().filter((b) => npcOf(b.npcId).flags.housedIn && bonds.since(b.start) >= 1) },
  { id: 'gift_meaning', who: () => [...bonds.others(), ...(bonds.primary() ? [bonds.primary()] : [])].filter((b) => b.gifts.some((g) => g.year >= store.state.year - 1 && g.cost >= localMoney(LAVISH, country()))) },
  { id: 'anniversary_hidden', again: 4, who: () => bonds.others().filter((b) => b.secret && bonds.since(b.start) >= 1 && love.partner()) },
  { id: 'unexpected_feelings', who: () => bonds.others().filter((b) => b.type === 'fwb' && b.arc.feelings && !b.arc.feelingsAnswered) },
  { id: 'are_we_exclusive', who: () => { const m = bonds.primary(); const n = m && npcOf(m.npcId); return m && n.role === 'partner' && !n.flags.engaged && m.exclusive == null && !m.open && bonds.since(m.start) >= 1 && bonds.heart(n).commitment >= 40 ? [m] : []; } },
  { id: 'something_different', again: 5, who: () => { const m = bonds.primary(); return m && npcOf(m.npcId).meters.relationship < 45 && !m.arc.rebuilding ? [m] : []; } },
  { id: 'more_than_friends', again: 6, people: true, who: () => (love.partner() ? [] : livingNpcs().filter((n) => n.role === 'friend' && player().npcIds.includes(n.id) && bonds.eligible(n) && !bonds.bondWith(n.id) && n.meters.relationship >= 78 && bonds.heart(n).commitment >= 50)) },
  { id: 'one_night_again', people: true, who: () => bonds.bonds().filter((b) => b.type === 'onenight' && bonds.since(b.start) >= 1 && bonds.since(b.start) <= 6 && npcOf(b.npcId)?.alive && !bonds.bondWith(b.npcId) && bonds.eligible(npcOf(b.npcId))).map((b) => npcOf(b.npcId)) },
  { id: 'one_more_chance', people: true, who: () => (love.partner() ? [] : bonds.bonds().filter((b) => b.type === 'primary' && b.status === 'ended' && bonds.since(b.end) >= 2 && npcOf(b.npcId)?.alive && npcOf(b.npcId).role === 'ex' && npcOf(b.npcId).meters.relationship >= 30 && bonds.heart(npcOf(b.npcId)).forgiving >= 45).map((b) => npcOf(b.npcId))) },
  { id: 'old_love', people: true, who: () => bonds.bonds().filter((b) => b.type !== 'primary' && b.type !== 'onenight' && b.status === 'ended' && b.end.why !== 'they died' && bonds.since(b.end) >= 5 && npcOf(b.npcId)?.alive && !bonds.bondWith(b.npcId)).map((b) => npcOf(b.npcId)) },
];

/** Once a year: of the stories that are true this year, one or two are told. */
export function tickLoveStories() {
  const p = player();
  teenYear();
  if (p.age < bonds.ADULT) return;
  const d = DRAMA[dramaOf()];
  const year = store.state.year;
  const can = [];
  for (const s of STORIES) {
    for (const x of s.who()) {
      const npc = s.people ? x : npcOf(x.npcId);
      if (!npc?.alive) continue;
      const key = `${s.id}/${npc.id}`;
      const last = told()[key];
      if (last === 'closed' || (last != null && (!s.again || year - last < s.again))) continue;
      can.push({ s, npc, key });
    }
  }
  let n = 0;
  for (const c of can.map((x) => [rng.next(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x)) {
    if (n >= d.most || !rng.chance(d.chance)) continue;
    told()[c.key] = year;
    store.state.pendingEvents.push({ id: `love_${c.s.id}`, cast: { them: c.npc.id } });
    n++;
  }
}

/** A choice in one of these scenes (data/events/stories/love.js). @returns {string} what they do with it */
export function loveChoice(value, cast) {
  const p = player();
  const c = country();
  const [story, choice] = value.split(':');
  if (story === 'pregnancy') return decide(choice, cast);
  if (story.startsWith('teen')) return teenChoice(story, choice, cast);
  const npc = npcOf(cast.them);
  if (!npc?.alive) return '';
  const h = bonds.heart(npc);
  const b = bonds.bondWith(npc.id) ?? bonds.pastWith(npc.id).at(-1) ?? null;
  const say = (text, key = 'talk') => { if (b) b.history.push({ year: store.state.year, month: store.state.month ?? 0, age: p.age, key, text }); return text; };
  const close = () => { told()[`${story}/${npc.id}`] = 'closed'; };
  switch (story) {
    case 'other_address': {
      const a = p.assets.find((x) => x.id === npc.flags.housedIn);
      if (choice === 'reconsider') { if (a) bonds.unhouse(a.id); return say(`${npc.firstName} packs in an afternoon, and leaves the keys on the table.`); }
      if (choice === 'longterm') { bump(npc, 3); if (h.commitment >= 55) { b.arc.wantsHome = store.state.year; return say(`${npc.firstName} says what has been on their mind: living in a place that could be taken away is not a home.`); } return say(`${npc.firstName} is content: it suits them, for as long as it suits you both.`); }
      bump(npc, 2);
      return say(choice === 'review' ? 'You go through it together: who pays what, and what happens if things change.' : 'Nothing changes, and nobody minds.');
    }
    case 'gift_meaning': {
      if (choice === 'serious') { bump(npc, 6); if (b && b.type !== 'primary' && b.secret && h.commitment >= 50) b.arc.answerDue ??= store.state.year + 1; return say(`${npc.firstName} had hoped so, and now will expect you to mean it.`); }
      if (choice === 'gift') { bump(npc, h.commitment >= 60 ? -4 : 2); return say(h.commitment >= 60 ? `"Only a gift." ${npc.firstName} puts it back in its box.` : `${npc.firstName} is relieved: they did not want it to be a promise.`); }
      return say(`You say nothing much. ${npc.firstName} lets it go.`);
    }
    case 'anniversary_hidden': {
      if (choice === 'celebrate') { bump(npc, 6); (b.acts[store.state.year] ??= {}).time = ((b.acts[store.state.year].time) ?? 0) + 1; return say('A dinner in a town where nobody knows either of you.'); }
      if (choice === 'secrecy') { bump(npc, 2); if (!b.arc.complicated) { b.arc.complicated = { year: store.state.year, choice: null }; store.state.pendingEvents.push({ id: 'romance_complicated_001', cast: { them: npc.id } }); } return say(`${npc.firstName} has been waiting for you to bring it up.`); }
      if (choice === 'commitments') { bump(npc, -4); return say(`You spend the day where you are expected to be. ${npc.firstName} says they understand.`); }
      bonds.end(npc.id, 'ended on the anniversary');
      return `${npc.firstName} is not surprised that it is today you say it.`;
    }
    case 'unexpected_feelings': {
      b.arc.feelingsAnswered = store.state.year;
      if (choice === 'romance') return love.partner() ? say(`You tell ${npc.firstName} you cannot offer that while you are with someone else. They nod.`) : bonds.makeOfficial(npc.id).text;
      if (choice === 'friends') { b.status = 'ended'; b.end = { year: store.state.year, month: store.state.month ?? 0, age: p.age, why: 'back to friends' }; bump(npc, h.commitment >= 70 ? -8 : -2); return say(h.commitment >= 70 ? `${npc.firstName} agrees, and for a while is busy whenever you ring.` : `${npc.firstName} agrees. It is a little awkward, and then it is not.`, 'ended'); }
      if (choice === 'end') { bonds.end(npc.id, 'ended when feelings changed'); return ''; }
      if (h.commitment >= 60 && rng.chance(0.5)) { b.status = 'ended'; b.end = { year: store.state.year, month: store.state.month ?? 0, age: p.age, why: 'they wanted more' }; bump(npc, -6); return say(`${npc.firstName} cannot go on as before, feeling as they do. They end the arrangement and keep the friendship.`, 'ended'); }
      return say(`${npc.firstName} says they can live with that. You agree to say so if it stops being true.`);
    }
    case 'are_we_exclusive': {
      const m = bonds.primary();
      if (!m || m.npcId !== npc.id) return '';
      if (choice === 'yes') { m.exclusive = true; bump(npc, 6); m.history.push({ year: store.state.year, month: 0, age: p.age, key: 'exclusive', text: 'You agreed: only each other.' }); return `${npc.firstName} smiles. "Good. So did I."`; }
      if (choice === 'open') { npc.flags.acts = { ...(npc.flags.acts ?? {}), talkOpen: undefined }; return bonds.discussOpen(npc.id).text; }
      bump(npc, -5); m.arc.notYet = store.state.year;
      return h.commitment >= 70 ? `${npc.firstName} goes quiet. They had thought you were past that question.` : `${npc.firstName} shrugs. "All right. Tell me when you know."`;
    }
    case 'something_different': {
      if (choice === 'counseling') {
        const cost = localMoney(1500, c);
        if (p.finance.cash < cost) return 'You cannot afford it just now, and say so. Saying so helps a little.';
        p.finance.cash -= cost; book({ cat: 'health', src: 'action', desc: 'Couples counseling' });
        bump(npc, 8); const m = bonds.primary(); if (m) m.trust = clamp(m.trust + 5);
        return `Six sessions (${fmtMoney(cost, c)}). You say things in that room you had not said at home.`;
      }
      bump(npc, { talk: 6, time: 4, stress: 2 }[choice] ?? 0);
      return { talk: `It takes most of a night. ${npc.firstName} says they are glad you asked.`, time: 'A weekend with the phones off.', stress: `You tell ${npc.firstName} what has been weighing on you. It was not them.` }[choice] ?? '';
    }
    case 'more_than_friends': {
      if (choice === 'romance') { npc.flags.wasRole = npc.role; npc.role = 'partner'; npc.flags.since = p.age; bump(npc, 8); remember(npc, 'askedOut', 'You were friends first, and then one day it was said.'); bonds.primary(); milestone(`You and ${npc.firstName} became a couple.`, 'family'); return `You and ${npc.firstName} are together. It turns out everyone else already thought so.`; }
      if (choice === 'casual') { npc.flags.acts = { ...(npc.flags.acts ?? {}) }; delete npc.flags.acts.ask_fwb; return bonds.propose(npc.id, 'fwb').text; }
      if (choice === 'time') { told()[`${story}/${npc.id}`] = store.state.year - 4; return `${npc.firstName} says there is no hurry.`; }
      bump(npc, -3); close();
      return `${npc.firstName} takes it well. You are friends, and it is not mentioned again.`;
    }
    case 'one_night_again': {
      close();
      if (choice === 'friends') { if (['acquaintance', 'coworker', 'colleague'].includes(npc.role)) { npc.flags.wasRole = npc.role; npc.role = 'friend'; } bump(npc, 8); return `Coffee, and an hour of talk about everything else. ${npc.firstName} is good company.`; }
      if (choice === 'casual') { npc.flags.acts = { ...(npc.flags.acts ?? {}) }; delete npc.flags.acts.ask_casual; return bonds.propose(npc.id, 'casual').text; }
      return `You wish ${npc.firstName} well, and mean it.`;
    }
    case 'one_more_chance': {
      if (choice === 'no') { close(); bump(npc, -4); return `You tell ${npc.firstName} that it is better left where it is.`; }
      if (choice === 'friends') { close(); bump(npc, 6); return `Not that. But you can be in each other's lives again, and you are.`; }
      npc.role = 'partner'; npc.flags.since = p.age; npc.flags.engaged = false; bump(npc, 10);
      const m = bonds.primary();
      m.trust = 50; m.arc.secondChance = store.state.year;
      m.history.push({ year: store.state.year, month: 0, age: p.age, key: 'again', text: 'You decided to try again.' });
      remember(npc, 'again', 'You tried again.');
      milestone(`You and ${npc.firstName} got back together.`, 'family');
      return `You and ${npc.firstName} try again, knowing what you both know.`;
    }
    case 'old_love': {
      if (choice === 'decline') { close(); return `You do not answer. ${npc.firstName} does not write again.`; }
      if (choice === 'ask') { bump(npc, 2); return `${npc.firstName} says they only wanted to know that you were all right.`; }
      bump(npc, 6);
      return `You meet ${npc.firstName} for coffee. You are both older. It is easy, and it is only coffee.`;
    }
    default: return '';
  }
}

// ---------- Fifteen to seventeen: a pregnancy, as something that happens to a family ----------
//
// Off unless the player turns sensitive family storylines on. It is never the result of anything the player chose to
// do: there is no such action. Where a teenager has a boyfriend or girlfriend of their own age, the story may, rarely,
// begin with the news itself. What follows is about who to tell, school, and what to do: the choices are the young
// person's, school goes on, nobody is married off, and the child (if there is one) is a child like any other.

// How a young person looks after themselves: health class, a talk at home, a private visit to a doctor. All of it is
// care and information, never a way of causing anything; each lowers the chance the storyline can begin, the doctor's
// most. A visit is free for a young person, and kept private.
const SAFETY = {
  class: { label: 'Health class at school', text: 'In health class you learn how bodies work, and how to look after yourself. You pay attention.', factor: 0.6 },
  talk: { label: 'Talk with a parent', text: 'You ask {who} the things you have not known how to ask. They answer plainly, and are glad you did.', factor: 0.75 },
  care: { label: 'See a doctor, privately', text: 'You see a doctor on your own. Everything is private. You leave knowing what you can do to stay safe, and with what you need to.', factor: 0.15 },
};
const safe = () => (player().flags.teenSafe ??= {});
const holds = (id) => safe()[id] != null && (id !== 'talk' || store.state.year - safe().talk <= 1); // a talk lasts a couple of years
const safetyFactor = () => Object.entries(SAFETY).reduce((f, [id, a]) => f * (holds(id) ? a.factor : 1), 1);

/** What a 14 to 17-year-old can do to look after themselves, and whether it is done. */
export function teenSafety() {
  const p = player();
  if (p.age < 14 || p.age > 17) return [];
  return Object.entries(SAFETY).map(([id, a]) => ({ id, label: a.label,
    done: id === 'talk' ? safe().talk === store.state.year : safe()[id] != null,
    why: id === 'talk' && !guardians().length ? 'nobody to ask' : '' }));
}
export function doTeenSafety(id) {
  const p = player();
  const a = SAFETY[id];
  const opt = teenSafety().find((o) => o.id === id);
  if (!a || !opt) return { ok: false, text: 'That is not for you now.', tone: 'neutral' };
  if (opt.done) return { ok: false, text: 'You have done that already.', tone: 'neutral' };
  if (opt.why) return { ok: false, text: 'There is nobody at home to ask.', tone: 'neutral' };
  let who = '';
  if (id === 'talk') { const g = rng.pick(guardians()); bump(g, 3); who = g.firstName; }
  safe()[id] = store.state.year;
  p.stats.mood = clamp(p.stats.mood + 2);
  const text = a.text.replace('{who}', who);
  log(text, 'system', 'good');
  return { ok: true, text, tone: 'good' };
}

function teenYear() {
  const p = player();
  if (!sensitiveOn() || p.age < 15 || p.age > 17 || p.flags.pregnancy || p.flags.teenPregnancy) return;
  const other = love.partner();
  if (!other || other.age >= 18 || other.age < 15) return;
  const sexes = [p.flags.bornAs ?? p.gender, other.flags?.bornAs ?? other.gender].sort().join('+');
  if (sexes !== 'female+male') return;
  if (!rng.chance({ low: 0.01, balanced: 0.02, high: 0.04 }[dramaOf()] * safetyFactor())) return;
  p.flags.teenPregnancy = { year: store.state.year, otherId: other.id, told: [], school: null, plan: null };
  p.flags.pregnancy = { dueAge: p.age + 1, otherId: other.id, teen: true };
  store.state.pendingEvents.push({ id: 'teen_life_changing', cast: { them: other.id, words: { who: (p.flags.bornAs ?? p.gender) === 'female' ? 'You are pregnant.' : `${other.firstName} is pregnant.` } } });
}

function teenChoice(story, choice, cast) {
  const p = player();
  const t = p.flags.teenPregnancy;
  if (!t) return '';
  const next = (id) => store.state.pendingEvents.push({ id, cast });
  if (story === 'teenNews') {
    t.first = choice;
    next('teen_who_to_tell');
    return { doctor: 'The nurse is kind, and practical, and tells you nothing has to be decided today.', adult: 'You find the words, somehow.', support: 'A helpline. A calm voice, a list of what there is, and a number to call back.', time: 'You carry it by yourself for a few days. It does not get lighter.' }[choice] ?? '';
  }
  if (story === 'teenTell') {
    next('teen_school');
    if (choice === 'nobody') return 'You tell nobody yet. It is yours to tell, when you are ready.';
    const who = choice === 'parent' ? guardians() : [];
    t.told.push(choice);
    if (!who.length) return choice === 'counselor' ? 'The school counselor listens to all of it, and says it will stay in that room.' : 'They listen to all of it.';
    // Each parent is who they are: some hold you, some need time. Neither is the end of it.
    const lines = who.map((g) => { const warm = rng.chance(clamp(0.45 + (g.meters.relationship - 50) / 120 + (g.meters.generosity - 50) / 200, 0.1, 0.92)); bump(g, warm ? 4 : -8); (t.family ??= {})[g.id] = warm ? 'with you' : 'needs time'; return warm ? `${g.firstName} holds you for a long time, and says you will manage this together.` : `${g.firstName} cannot speak to you for a day. They are frightened, and it comes out as anger.`; });
    return lines.join(' ');
  }
  if (story === 'teenSchool') {
    t.school = choice;
    if (choice === 'support') p.hidden.discipline = clamp(p.hidden.discipline + 1);
    next('teen_parenthood');
    return { stay: 'You stay where you are. Some people stare for a week, and then it is somebody else\'s turn.', accommodate: 'The school arranges it: appointments, a lighter timetable near the end, exams when you can sit them.', support: 'A teacher goes through the year with you, and makes a plan that still ends in your exams.', other: 'A smaller school for the last months, with a nursery down the corridor. You will sit the same exams.' }[choice] ?? '';
  }
  if (story === 'teenPlan') {
    if (choice === 'end') { t.plan = 'end'; return decide((p.flags.bornAs ?? p.gender) === 'female' ? 'end' : 'wantend', cast); }
    t.plan = choice;
    const mother = (p.flags.bornAs ?? p.gender) === 'female';
    if (choice === 'adoption') return mother ? 'You speak to an adoption agency. It is your decision until the papers are signed, and after the birth you may still change your mind.' : 'It is her decision, and she is considering adoption. You tell her you will stand by what she decides.';
    if (choice === 'help') { t.help = true; return 'There is more help than you knew: a clinic, a young parents\' group, money that is there to be claimed.'; }
    return mother ? 'You are going to be a parent. You are frightened, and you have decided.' : 'She has decided to keep the baby. You tell her you will be there.';
  }
  return '';
}

/** After a birth: a child placed for adoption goes to another family, and is not the player's child to raise. */
export function teenAfterBirth() {
  const p = player();
  const t = p.flags.teenPregnancy;
  if (!t || t.done || p.flags.pregnancy) return;
  t.done = store.state.year;
  const kids = Object.values(store.state.npcs).filter((n) => n.role === 'child' && n.age <= 1 && (n.parentIds ?? []).includes(t.otherId) && p.npcIds.includes(n.id));
  if (t.plan === 'adoption' && (p.flags.bornAs ?? p.gender) === 'female') {
    for (const k of kids) { k.flags.placed = store.state.year; k.role = 'relative'; k.flags.title = 'Your child, placed for adoption'; p.npcIds.splice(p.npcIds.indexOf(k.id), 1); }
    if (kids.length) { log('The baby goes home with the family you chose for them. You are told you may write.', 'system', 'neutral'); milestone('Placed a child for adoption.', 'family'); }
  }
  if (p.education && t.school && !p.education.enrolled && p.education.stage === 'high' && !p.education.expelled) p.education.enrolled = true; // school goes on
}
