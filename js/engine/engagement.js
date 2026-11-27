// Dating, Engagement & Marriage: the stages a relationship moves through (dating, exclusive, serious, living together,
// engaged, married), the time it has lasted, the talk that makes it exclusive, an engagement with a wedding date, the
// engagement party, meeting the in-laws, cold feet, and the day itself (planned in the existing wedding planner,
// ui/weddingPlanner.js; romance.js stays the authority on proposing and marrying, with may('marry') and the palace).
// After a spouse dies, the player is widowed, and that is recorded and shown.
//
//   LF().love = { engagements: { [npcId]: { since, weddingMonth, party, told, married } },
//                 widowed: [{ npcId, since, ready }], acted: {} }
//   npc.flags.datingSince (month), npc.flags.exclusive, npc.flags.livesTogether (the one flag everything reads;
//   together.js wrote livingTogether, and both are now set: see the repair in familyLife.js)
import { store, log } from '../state.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { storyBeat } from './storyDirector.js';
import { onMarriage } from './blended.js';
import { LF, lived, nowMonth, recordEvent, dice, onMonth, done, fail, engagementOk } from './livingFamilies.js';

const S = () => store.state;
const L = (state = S()) => { const l = LF(state).love; l.engagements ??= {}; l.widowed ??= []; l.acted ??= {}; return l; };
const turnKey = (state = S()) => `${state.year}:${state.month ?? 0}`;
const bump = (n, d) => { if (n) n.meters.relationship = clamp(n.meters.relationship + d); };
const mine = (state) => state.player.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive);

export const STAGES = ['dating', 'exclusive', 'serious', 'living together', 'engaged', 'married'];
export const STAGE_NAMES = { dating: 'Dating', exclusive: 'Exclusive', serious: 'Serious', 'living together': 'Living together', engaged: 'Engaged', married: 'Married' };

/** The partner or spouse the player is with now (the one the game treats as theirs). */
export const current = (state = S()) => mine(state).find((n) => n.role === 'spouse') ?? mine(state).find((n) => n.role === 'partner') ?? null;

/** How long they have been together, in months. */
export function monthsTogether(npc, state = S()) {
  if (npc.flags.datingSince == null) npc.flags.datingSince = lived(state) - Math.max(0, state.player.age - (npc.flags.since ?? state.player.age)) * 12;
  return Math.max(0, nowMonth(state) - npc.flags.datingSince);
}
/** The stage a relationship has reached, read from what the game records. */
export function stageOf(npc, state = S()) {
  if (!npc) return null;
  if (npc.role === 'spouse') return 'married';
  if (npc.role !== 'partner') return null;
  if (npc.flags.engaged) return 'engaged';
  if (npc.flags.livesTogether) return 'living together';
  if (npc.flags.exclusive && monthsTogether(npc, state) >= 12 && npc.meters.relationship >= 70) return 'serious';
  if (npc.flags.exclusive) return 'exclusive';
  return 'dating';
}
/** What could come next, for the Love screen. */
export function nextStep(npc, state = S()) {
  const st = stageOf(npc, state);
  return { dating: 'Talk about being exclusive.', exclusive: 'Give it time: a year together, and real closeness, makes it serious.', serious: 'Moving in together, or a proposal.',
    'living together': 'A proposal, when you are both ready.', engaged: engagement(npc, state)?.weddingMonth != null ? 'The wedding.' : 'Set a date for the wedding.', married: '' }[st] ?? '';
}

/** "So what are we?": asking to be exclusive. Once a season. */
export function defineRelationship(npcId, state = S()) {
  const n = state.npcs[npcId];
  if (!n?.alive || n.role !== 'partner') return fail('That is a conversation for a partner.');
  if (n.flags.exclusive) return fail('You are already exclusive.');
  const l = L(state);
  if (l.acted[`dtr/${n.id}`] === turnKey(state)) return fail('Give it a little time before you ask again.');
  l.acted[`dtr/${n.id}`] = turnKey(state);
  const d = dice(state, 'love', 'dtr', n.id, lived(state));
  const chance = clamp(0.3 + (n.meters.relationship - 50) / 60 + Math.min(0.2, monthsTogether(n, state) / 30), 0.05, 0.95);
  if (!d.chance(chance)) {
    bump(n, -3);
    const text = `${n.firstName} says they like how things are, and would rather not put a name on it yet.`;
    log(text, 'love', 'neutral');
    return fail(text);
  }
  n.flags.exclusive = true;
  bump(n, 6);
  const text = `"Just us, then." ${n.firstName} deletes the app in front of you.`;
  log(text, 'love', 'good');
  recordEvent(state, 'exclusive', [state.player.id, n.id], `You and ${n.firstName} became exclusive.`);
  return done(text);
}

/** Meeting their family. Once; it can go well or badly. */
export function meetTheirFamily(npcId, state = S()) {
  const n = state.npcs[npcId];
  if (!n?.alive || !['partner', 'spouse'].includes(n.role)) return fail('Meet whose family?');
  if (n.flags.metTheirFamily) return fail('You have met them.');
  n.flags.metTheirFamily = true;
  const d = dice(state, 'love', 'inlaws', n.id);
  const good = d.chance(clamp(0.45 + (state.player.stats.charm - 50) / 100, 0.1, 0.9));
  bump(n, good ? 6 : -2);
  const text = good ? `Sunday lunch with ${n.firstName}'s family. Their mother sends you home with leftovers, which ${n.firstName} says is unheard of.` : `Lunch with ${n.firstName}'s family. Their father asks what you earn before the soup.`;
  log(text, 'love', good ? 'good' : 'neutral');
  recordEvent(state, 'met_inlaws', [state.player.id, n.id], text);
  return done(text, good ? 'good' : 'neutral');
}

/** How much a partner's own view of marriage shifts a proposal's odds (romance.propose asks). */
export const marriageView = (npc) => ({ yes: 0.1, someday: 0, no: -0.3 }[npc?.flags?.views?.marriage] ?? 0);

// ---------- Engagement ----------

export function engagement(npc, state = S()) {
  const e = L(state).engagements[npc?.id];
  return e && !e.married && !e.ended ? e : null;
}
/** Sets the wedding date: 3 to 24 months from now. */
export function setWeddingDate(npcId, months, state = S()) {
  const n = state.npcs[npcId];
  const e = n && engagement(n, state);
  if (!e) return fail('You are not engaged.');
  const ok = engagementOk(state, state.player.id, n.id);
  if (!ok.ok) return ok;
  months = clamp(Math.round(months), 3, 24);
  e.weddingMonth = nowMonth(state) + months;
  e.told = false;
  bump(n, 3);
  const text = `You set a date: ${months} months from now. ${n.firstName} writes it on the calendar in pen.`;
  log(text, 'love', 'good');
  recordEvent(state, 'wedding_date', [state.player.id, n.id], text);
  return done(text);
}
/** The engagement party. Once. */
export function engagementParty(npcId, state = S()) {
  const p = state.player;
  const n = state.npcs[npcId];
  const e = n && engagement(n, state);
  if (!e) return fail('You are not engaged.');
  if (e.party) return fail('You have had the party.');
  const c = COUNTRIES[p.countryId];
  const cost = localMoney(600, c);
  if (p.finance.cash < cost) return fail(`A party costs about ${fmtMoney(cost, c)}.`);
  p.finance.cash -= cost;
  e.party = nowMonth(state);
  bump(n, 6);
  p.stats.mood = clamp(p.stats.mood + 6);
  for (const x of mine(state)) if (['parent', 'sibling', 'friend', 'grandparent'].includes(x.role)) bump(x, 2);
  const text = `An engagement party in the back room of a restaurant: speeches, a cake, and both families in one place for the first time. It cost ${fmtMoney(cost, c)}.`;
  log(text, 'love', 'good');
  recordEvent(state, 'engagement_party', [p.id, n.id], text);
  return done(text);
}
/** Calls the engagement off (the existing breakUp ends the relationship; this only ends the engagement). */
export function callOffEngagement(npcId, state = S()) {
  const n = state.npcs[npcId];
  const e = n && engagement(n, state);
  if (!e) return fail('You are not engaged.');
  e.ended = nowMonth(state);
  n.flags.engaged = false;
  bump(n, -20);
  state.player.stats.mood = clamp(state.player.stats.mood - 8);
  const text = `You call off the engagement. ${n.firstName} gives the ring back without a word. You are still together, for now.`;
  log(text, 'love', 'bad');
  recordEvent(state, 'engagement_off', [state.player.id, n.id], text);
  return done(text, 'bad');
}

// ---------- Widowhood ----------

export const widowed = (state = S()) => L(state).widowed.filter((w) => !w.over);
export function visitGrave(state = S()) {
  const w = widowed(state).at(-1);
  if (!w) return fail('There is no grave to visit.');
  const l = L(state);
  if (l.acted.grave === turnKey(state)) return fail('You went this season.');
  l.acted.grave = turnKey(state);
  state.player.stats.mood = clamp(state.player.stats.mood + 3);
  const n = state.npcs[w.npcId];
  const text = `You take flowers to ${n ? n.firstName : 'them'}, and tell them about your week.`;
  log(text, 'love', 'neutral');
  return done(text, 'neutral');
}
export function readyToLoveAgain(state = S()) {
  const w = widowed(state).at(-1);
  if (!w) return fail('');
  if (nowMonth(state) - w.since < 6) return fail('It is too soon. Give yourself time.');
  w.over = nowMonth(state);
  const text = 'One morning you realize you have been happy, for a whole day, without feeling guilty. Maybe, one day, there could be someone again.';
  log(text, 'love', 'good');
  recordEvent(state, 'grief_eased', [state.player.id], text);
  return done(text);
}

// ---------- Each month ----------

onMonth('love', (state, m) => {
  const p = state.player;
  const l = L(state);
  for (const n of mine(state)) {
    if (n.role === 'partner') {
      if (n.flags.datingSince == null) monthsTogether(n, state);
      // The move-in flag the game reads everywhere (together.js used to write only livingTogether).
      if (n.flags.livingTogether && !n.flags.livesTogether) n.flags.livesTogether = true;
      if (n.flags.engaged && !l.engagements[n.id]) l.engagements[n.id] = { since: m, weddingMonth: null, party: null, told: false };
    }
    // A new marriage (this year or last) may bring stepchildren; marriages from before these features never do.
    if (n.role === 'spouse' && !n.flags.stepKidsChecked && n.marriedAtAge != null && p.age - n.marriedAtAge <= 1) onMarriage(n, state);
    const e = l.engagements[n.id];
    if (!e || e.married || e.ended) continue;
    if (n.role === 'spouse') {
      e.married = m;
      recordEvent(state, 'married', [p.id, n.id], `You married ${n.firstName}.`);
      continue;
    }
    if (n.role !== 'partner' || !n.flags.engaged) { e.ended = m; continue; }
    const d = dice(state, 'love', 'month', n.id, m);
    if (e.weddingMonth != null && m + 1 >= e.weddingMonth && !e.told) {
      e.told = true;
      log(`Your wedding day with ${n.firstName} has come. (Plan it from Family Life, or from ${n.firstName}'s page.)`, 'love', 'good');
      storyBeat('fl_wedding_day', { them: n.id }, { source: 'family', must: true });
    }
    if (e.weddingMonth != null && m - e.weddingMonth === 6) { bump(n, -10); log(`The date you set came and went six months ago. ${n.firstName} has stopped mentioning the wedding.`, 'love', 'bad'); }
    if (n.meters.relationship < 65 && d.chance(0.015)) storyBeat('fl_cold_feet', { them: n.id }, { source: 'family' });
  }
  // A spouse who has died: the player is widowed.
  for (const id of p.npcIds) {
    const n = state.npcs[id];
    if (!n || n.alive || n.role !== 'spouse' || l.widowed.some((w) => w.npcId === n.id)) continue;
    l.widowed.push({ npcId: n.id, since: m });
    p.flags.widowed = { npcId: n.id, since: m };
    const word = p.gender === 'male' ? 'widower' : p.gender === 'female' ? 'widow' : 'widowed';
    recordEvent(state, 'widowed', [p.id, n.id], `${n.firstName} died, and you became a ${word}.`);
  }
});

/** Choices in the love scenes. */
export function loveSceneChoice(story, choice, cast, state = S()) {
  const n = state.npcs[cast.them];
  if (!n?.alive) return '';
  const e = engagement(n, state);
  if (story === 'cold_feet') {
    if (choice === 'talk') { bump(n, 8); return `You talk it all through, the money and the fear and the rest. ${n.firstName} is still in.`; }
    if (choice === 'postpone') { if (e?.weddingMonth != null) e.weddingMonth += 6; bump(n, -2); return 'You agree to push the date back six months. It feels like a relief, which is its own kind of worrying.'; }
    return callOffEngagement(n.id, state).text;
  }
  if (story === 'wedding_day') {
    if (choice === 'postpone' && e) { e.weddingMonth = nowMonth(state) + 6; e.told = false; bump(n, -4); return 'You postpone. Six more months.'; }
    return `Then it is time to plan it: open ${n.firstName}'s page or Family Life → Love.`;
  }
  return '';
}

/** Marks the engagement on the date it began (called by the Love screen after a proposal). */
export function startEngagement(npc, state = S()) {
  if (!npc?.flags.engaged) return null;
  const l = L(state);
  l.engagements[npc.id] ??= { since: lived(state), weddingMonth: null, party: null, told: false };
  return l.engagements[npc.id];
}
