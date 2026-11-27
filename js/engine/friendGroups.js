// Friend groups as records: a named group of real friends, with who is in it, when it formed, where it came from, and
// what happened to it. Built on the friend circles the game already had (engine/together.js: flags.circle on each
// friend, player.flags.circles), which say who is in a group; this keeps the group's own story. Teenagers at school
// fall into one naturally; anyone can make one by introducing friends to each other.
//
//   player.friendGroups[circleId] = { id, name, formed, from: 'school'|'friends', school, members:[ids], at:'school'|'after school',
//                                     status:'together'|'drifted', history:[{ year, text }] }
//
// Groups change as people do: someone moves away, falls out, drifts off, or the group outlasts school. Nobody is put in
// a group they were not in; an old circle becomes a record with only what it already said. Once a world year, keyed dice.
import { store, player, log } from '../state.js';
import { keyedDice } from './keyedDice.js';
import { remember } from './conditions.js';

const S = () => store.state;
const npc = (id) => S().npcs[id] ?? null;
const FRIENDLY = ['friend', 'classmate'];
const mine = (p) => p.npcIds.map(npc).filter((n) => n?.alive && FRIENDLY.includes(n.role));
const groups = (p = player()) => (p.friendGroups ??= {});
export const friendGroups = (p = player()) => Object.values(groups(p));
export const activeGroups = (p = player()) => friendGroups(p).filter((g) => g.status === 'together');
export const groupOf = (n, p = player()) => (n?.flags?.circle ? groups(p)[n.flags.circle] ?? null : null);
const atSchool = (p) => p.education?.enrolled && ['middle', 'high', 'secondary'].includes(p.education.stage);

/** A name for a group, from what its members share. */
function nameFor(members) {
  const interests = members.map((n) => n.flags.interest).filter(Boolean);
  const top = interests.sort((a, b) => interests.filter((x) => x === b).length - interests.filter((x) => x === a).length)[0];
  return top ? `The ${top} crowd` : 'The lunch table';
}

/** Keeps each group's record true to who is in it now: joins, departures, drifting apart, outlasting school. */
export function syncGroups(p = player()) {
  const year = S().year;
  for (const [id, since] of Object.entries(p.flags.circles ?? {})) {
    const g = (groups(p)[id] ??= { id, name: null, formed: typeof since === 'number' ? since : year, from: 'friends', school: null, members: [], at: 'friends', status: 'together', history: [] });
    const now = mine(p).filter((n) => n.flags.circle === id);
    g.name ??= nameFor(now);
    const was = new Set(g.members);
    for (const n of now) if (!was.has(n.id)) g.history.push({ year, text: `${n.firstName} joined.` });
    for (const oldId of g.members) if (!now.some((n) => n.id === oldId)) { const n = npc(oldId); g.history.push({ year, text: `${n?.firstName ?? 'Someone'} ${!n?.alive ? 'died' : n.flags.abroad ? 'moved abroad' : 'drifted away from the group'}.` }); }
    g.members = now.map((n) => n.id);
    if (g.status === 'together' && g.members.length < 2) { g.status = 'drifted'; g.history.push({ year, text: 'The group drifted apart.' }); }
    if (g.from === 'school' && g.at === 'school' && !atSchool(p) && g.status === 'together') { g.at = 'after school'; g.history.push({ year, text: 'School ended. The group did not.' }); }
  }
}

/** Once a world year: friends who move away leave their group; a teenager at school falls in with a group of friends. */
export function tickFriendGroups() {
  const p = player();
  if (!p?.alive) return;
  // Someone who lives abroad now is no longer part of the everyday group (still a friend).
  for (const n of mine(p)) if (n.flags.circle && n.flags.abroad && groups(p)[n.flags.circle]?.at !== 'friends') delete n.flags.circle;
  const d = keyedDice(`groups/${S().slotId}/${p.id}/${S().year}`);
  if (atSchool(p) && p.age >= 12 && p.age <= 17 && !activeGroups(p).some((g) => g.from === 'school')) {
    const close = mine(p).filter((n) => !n.flags.circle && n.meters.relationship >= 55 && Math.abs(n.age - p.age) <= 2)
      .sort((a, b) => b.meters.relationship - a.meters.relationship).slice(0, 4);
    if (close.length >= 3 && d.chance(0.5)) formGroup(close, 'school');
  }
  syncGroups(p);
}

/** A group forms from real friends. */
export function formGroup(members, from = 'friends') {
  const p = player();
  const id = `circle_${members[0].id}`;
  for (const n of members) n.flags.circle = id;
  (p.flags.circles ??= {})[id] = S().year;
  const g = (groups(p)[id] = { id, name: nameFor(members), formed: S().year, from, school: from === 'school' ? p.education.schoolName ?? null : null,
    members: members.map((n) => n.id), at: from === 'school' ? 'school' : 'friends', status: 'together', history: [{ year: S().year, text: `${members.map((n) => n.firstName).join(', ')} and you became a group.` }] });
  for (const n of members) remember(n, 'groupFormed', `Became part of your group of friends, ${S().year}.`);
  log(`You and ${members.map((n) => n.firstName).join(', ')} have become a group: ${g.name.toLowerCase()}.`, 'system', 'good');
  return g;
}

/** Everyone in the group, together: a hang-out, or a study session. */
export function groupActivity(circleId, kind = 'hangout') {
  const p = player();
  const g = groups(p)[circleId];
  if (!g || g.status !== 'together') return { ok: false, text: 'That group is not together any more.', tone: 'neutral' };
  const members = g.members.map(npc).filter((n) => n?.alive);
  const d = keyedDice(`group-act/${S().slotId}/${p.id}/${S().year}/${circleId}/${kind}`);
  for (const n of members) { n.meters.relationship = Math.min(100, n.meters.relationship + d.int(2, 5)); n.lastInteractionAge = p.age; }
  if (kind === 'study') p.stats.intellect = Math.min(100, p.stats.intellect + 1);
  p.stats.mood = Math.min(100, p.stats.mood + 3);
  g.history.push({ year: S().year, text: kind === 'study' ? 'A study session that was mostly talking.' : 'A night with the whole group.' });
  const names = members.map((n) => n.firstName).join(', ');
  return { ok: true, text: kind === 'study' ? `You, ${names}: books open, snacks out. Some of it went in.` : d.pick([`You, ${names}: pizza, a film nobody watched, and a joke that will last years.`, `The whole group, at ${members[0].firstName}'s. Nobody wanted to go home.`]), tone: 'good' };
}
