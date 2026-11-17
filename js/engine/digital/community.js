// Online communities and the people met in them, and online dating. A few
// members of each community are real, persistent people the player can get to
// know; everyone else is a member count. Friendships and romances that start
// here continue in the ordinary Relationship and Romance engines, with the
// same person.
import { rng } from '../../rng.js';
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { COUNTRIES } from '../../data/countries.js';
import { COMMUNITIES, COMMUNITY_BY_ID, PLATFORM_BY_ID, TOPIC_BY_ID } from '../../data/digital.js';
import { makeNpc } from '../npcFactory.js';
import { ensureLife } from '../npcLives.js';
import { interest, partner, askOutStranger } from '../romance.js';
import { world, newId, charOf, acts, result, recordEvent, spendHours } from './core.js';
import { platformOpen, platformActivity } from './tech.js';
import { accountOn, makeAccount, follow, cleanHandle, handleTaken } from './accounts.js';
import { bond, contactBlock } from './messaging.js';

const ADULT = 18;

/** Communities that exist this year: their platform has to be running. */
export function communities() {
  const d = world();
  for (const def of COMMUNITIES) {
    if (!platformOpen(def.platform)) continue;
    if (!d.communities[def.id]) {
      d.communities[def.id] = {
        id: def.id, platformId: def.platform, topic: def.topic, name: def.local ? `${player().city} ${def.name}` : def.name, rules: def.rules,
        memberCount: Math.round((def.size || 800) * Math.max(0.05, platformActivity(def.platform))), keyMembers: [], moderators: [],
        events: [], history: [{ year: store.state.year, text: 'You first came across it.' }], createdYear: store.state.year, local: !!def.local,
      };
    }
  }
  return Object.values(d.communities).filter((c) => platformOpen(c.platformId) || membership(c.id));
}

export const membership = (communityId, charId = player().id) => world().memberships.find((m) => m.communityId === communityId && m.charId === charId && !m.leftYear) ?? null;
export const myCommunities = () => world().memberships.filter((m) => m.charId === player().id && !m.leftYear).map((m) => ({ m, c: world().communities[m.communityId] })).filter((x) => x.c);

/** A persistent member: a real person, created once and kept. Ages close to the player's, so a young player meets other young people. */
function newMember(c) {
  const p = player();
  const lo = p.age < ADULT ? Math.max(13, p.age - 2) : Math.max(ADULT, p.age - 10);
  const hi = p.age < ADULT ? Math.min(17, p.age + 2) : p.age + 12;
  const abroad = rng.chance(0.35);
  const from = abroad ? rng.pick(Object.keys(COUNTRIES).filter((id) => id !== p.countryId)) : p.countryId;
  const npc = makeNpc({ role: 'contact', countryId: from, age: rng.int(lo, hi), relationship: rng.int(35, 55) });
  npc.flags.digitalOnly = true;
  npc.flags.community = c.id;
  npc.flags.interest = c.topic;
  if (from !== p.countryId) npc.flags.abroad = from;
  npc.lastInteractionAge = p.age;
  ensureLife(npc);
  store.state.npcs[npc.id] = npc;
  const handle = uniqueHandle(c.platformId, `${npc.firstName}${rng.pick(['_', '.', ''])}${TOPIC_BY_ID[c.topic]?.name.split(' ')[0].toLowerCase() ?? 'fan'}${rng.int(1, 99)}`);
  makeAccount(npc.id, c.platformId, handle, { visibility: 'public', interests: [c.topic] });
  c.keyMembers.push(npc.id);
  return npc;
}

function uniqueHandle(platformId, base) {
  let h = cleanHandle(base).replace(/[^A-Za-z0-9_.]/g, '').slice(0, 18) || 'member';
  while (handleTaken(platformId, h)) h = `${h.slice(0, 16)}${rng.int(10, 99)}`;
  return h;
}

/** Joins a community. Needs an account on its platform. */
export function join(communityId) {
  const p = player();
  const c = world().communities[communityId] ?? communities().find((x) => x.id === communityId);
  if (!c) return result(false, 'That community is not around.');
  if (!platformOpen(c.platformId)) return result(false, `${PLATFORM_BY_ID[c.platformId].name} is not running.`);
  if (!accountOn(p.id, c.platformId)) return result(false, `You need a ${PLATFORM_BY_ID[c.platformId].name} account first.`);
  if (membership(c.id)) return result(false, 'You are already a member.');
  world().memberships.push({ id: newId('mem'), communityId: c.id, charId: p.id, sinceYear: store.state.year, role: 'member', posts: 0, standing: 10, leftYear: null });
  c.memberCount += 1;
  while (c.keyMembers.filter((id) => charOf(id)?.alive).length < 3) newMember(c);
  c.history.push({ year: store.state.year, text: `${p.firstName} joined.` });
  return result(true, `You joined ${c.name}. ${c.memberCount.toLocaleString('en-US')} members. The rules: ${c.rules}`, 'good');
}

export function leave(communityId) {
  const m = membership(communityId);
  if (!m) return result(false, 'You are not a member.');
  m.leftYear = store.state.year;
  const c = world().communities[communityId];
  c.memberCount = Math.max(0, c.memberCount - 1);
  c.moderators = c.moderators.filter((id) => id !== player().id);
  return result(true, `You left ${c.name}. The friends you made there are still your friends.`, 'neutral');
}

export const PARTICIPATION = [
  { id: 'discuss', label: 'Join a discussion', hours: 3 },
  { id: 'ask', label: 'Ask a question', hours: 2 },
  { id: 'help', label: 'Answer someone\'s question', hours: 3 },
  { id: 'share', label: 'Share something you made', hours: 4, needsWork: true },
];

/** Takes part. Mostly it is pleasant; sometimes it is where a friendship starts. A few times a year per community. */
export function participate(communityId, kind = 'discuss') {
  const p = player();
  const m = membership(communityId);
  const c = world().communities[communityId];
  if (!m || !c) return result(false, 'You are not a member.');
  if (!platformOpen(c.platformId)) return result(false, `${PLATFORM_BY_ID[c.platformId].name} is not running.`);
  const how = PARTICIPATION.find((x) => x.id === kind) ?? PARTICIPATION[0];
  const work = how.needsWork ? Object.values(world().projects).find((x) => x.ownerId === p.id && ['ready', 'published'].includes(x.status) && !x.sharedIn?.includes(c.id)) : null;
  if (how.needsWork && !work) return result(false, 'You have nothing finished to share yet.');
  const a = acts();
  a[`comm:${c.id}`] = (a[`comm:${c.id}`] ?? 0) + 1;
  if (a[`comm:${c.id}`] > 4) return result(false, `You have spent plenty of time in ${c.name} this year.`);
  if (!spendHours(how.hours)) return result(false, 'No spare time left this year.');
  m.posts += 1;
  m.standing = clamp(m.standing + (kind === 'help' ? 6 : kind === 'share' ? 7 : 3));
  if (work) work.sharedIn = [...(work.sharedIn ?? []), c.id];
  p.stats.mood = clamp(p.stats.mood + 1);
  const people = c.keyMembers.map(charOf).filter((n) => n?.alive);
  const who = rng.pick(people);
  let text = { discuss: `You got into a long, friendly argument in ${c.name}.`, ask: 'People were kinder about your question than you expected.', help: 'Someone thanked you for the answer.', share: `You shared ${work?.title ?? 'your work'} in ${c.name}.` }[kind];
  if (who && rng.chance(0.75)) {
    const became = bond(who, rng.int(5, 11));
    const closeEnough = !contactBlock(who.id);
    text += became ? ` You and ${who.firstName} have been talking so much you would call them a friend now.` : ` ${who.firstName} (@${accountOn(who.id, c.platformId)?.handle ?? 'someone'}) replied${closeEnough ? ', and you got talking' : ''}.`;
    const mine = accountOn(p.id, c.platformId);
    const theirs = accountOn(who.id, c.platformId);
    if (mine && theirs && !mine.following.includes(theirs.id)) { follow(mine.id, theirs.id, { quiet: true }); if (rng.chance(0.6)) follow(theirs.id, mine.id, { quiet: true }); }
  }
  return result(true, text, 'good');
}

/** Community events: an online gathering any member can attend, or, for adults in the same country, a meetup. Once a year. */
export function attendEvent(communityId) {
  const p = player();
  const m = membership(communityId);
  const c = world().communities[communityId];
  if (!m || !c) return result(false, 'You are not a member.');
  if (acts()[`event:${c.id}`]) return result(false, 'You already went to this year\'s gathering.');
  const local = p.age >= ADULT && !p.legal?.incarceration;
  if (!spendHours(local ? 10 : 4)) return result(false, 'No spare time left this year.');
  acts()[`event:${c.id}`] = true;
  const kind = local ? 'meetup' : 'online';
  c.events.push({ year: store.state.year, kind, attendees: [p.id] });
  m.standing = clamp(m.standing + 5);
  const people = c.keyMembers.map(charOf).filter((n) => n?.alive && (kind === 'online' || !n.flags.abroad));
  for (const n of people) bond(n, kind === 'meetup' ? rng.int(8, 14) : rng.int(3, 7));
  const text = kind === 'meetup'
    ? `${c.name} held a meetup. ${people.length ? `${people.map((n) => n.firstName).join(' and ')} came, and it was strange and lovely to see faces behind the usernames.` : 'It was smaller than expected, but good.'}`
    : `${c.name} held an online gathering. ${people.length ? `You spent most of it talking to ${people[0].firstName}.` : 'You mostly listened.'}`;
  recordEvent({ kind: 'community_gathering', charIds: [p.id, ...people.map((n) => n.id)], platformId: c.platformId, ref: { type: 'community', id: c.id }, summary: text, visibility: 'family', once: `gathering_${c.id}_${p.id}` }) ?? log(text);
  return result(true, text, 'good');
}

/** A trusted, long-standing member can be asked to help moderate. It takes time every year. */
export function volunteerModerate(communityId) {
  const p = player();
  const m = membership(communityId);
  const c = world().communities[communityId];
  if (!m || !c) return result(false, 'You are not a member.');
  if (m.role === 'moderator') return result(false, 'You already moderate.');
  if (m.standing < 55 || store.state.year - m.sinceYear < 2) return result(false, 'Moderators are people the community has known and trusted for a while.');
  if (p.age < 16) return result(false, 'Moderators have to be 16 or over.');
  m.role = 'moderator';
  c.moderators.push(p.id);
  c.history.push({ year: store.state.year, text: `${p.firstName} became a moderator.` });
  recordEvent({ kind: 'moderator', charIds: [p.id], platformId: c.platformId, ref: { type: 'community', id: c.id }, summary: `You became a moderator of ${c.name}.`, visibility: 'family', once: `mod_${c.id}_${p.id}` });
  return result(true, `You are a moderator of ${c.name} now. It will take a few hours every year.`, 'good');
}

/** Meeting an online friend in person: adults only, and the friend has to be someone the player really knows by now. */
export function meetInPerson(npcId) {
  const p = player();
  const n = charOf(npcId);
  if (!n?.alive || !n.flags.metOnline) return result(false, 'That is not someone you met online.');
  if (p.age < ADULT || n.age < ADULT) return result(false, 'Meeting someone from the internet is for adults, in a public place, with someone you trust knowing where you are.');
  if (acts()[`meet:${n.id}`]) return result(false, 'You already met up this year.');
  const abroad = typeof n.flags.abroad === 'string' && n.flags.abroad !== p.countryId;
  const cost = localMoney(abroad ? 900 : 60, country());
  if (p.finance.cash < cost) return result(false, `${abroad ? `Getting to ${COUNTRIES[n.flags.abroad].name}` : 'A day out'} would cost ${fmtMoney(cost, country())}.`);
  if (!spendHours(abroad ? 30 : 6)) return result(false, 'No spare time left this year.');
  p.finance.cash -= cost;
  acts()[`meet:${n.id}`] = true;
  n.meters.relationship = clamp(n.meters.relationship + rng.int(6, 12));
  n.lastInteractionAge = p.age;
  const text = abroad ? `You travelled to ${COUNTRIES[n.flags.abroad].name} to meet ${n.firstName} in person at last. They were exactly like their messages, and taller.` : `You met ${n.firstName} for coffee, in person, after all this time online.`;
  recordEvent({ kind: 'met_online_friend', charIds: [p.id, n.id], ref: { type: 'npc', id: n.id }, summary: text, visibility: 'family', once: `met_${n.id}` });
  return result(true, text, 'good');
}

// ---------- Online dating ----------

export const DATING = 'kindling';

/** What stops the player using online dating right now ([] when nothing does). */
export function datingBlocks() {
  const p = player();
  const why = [];
  if (p.age < ADULT) why.push('Online dating is for adults.');
  if (!accountOn(p.id, DATING)) why.push(`You need a ${PLATFORM_BY_ID[DATING].name} profile.`);
  if (partner()) why.push('You are already with someone.');
  return why;
}

/** How well two people suit each other on paper. Real chemistry is decided when they meet. */
function compatibility(n) {
  const p = player();
  const mine = accountOn(p.id, DATING)?.interests ?? [];
  const shared = n.flags.interest && mine.includes(n.flags.interest) ? 0.2 : 0;
  const traits = (n.traits ?? []).filter((t) => p.traits.includes(t)).length * 0.1;
  const age = 1 - Math.min(1, Math.abs(n.age - p.age) / 20);
  const near = n.flags.abroad ? -0.15 : 0.1;
  return clamp(0.3 + shared + traits + age * 0.25 + near + rng.around(0, 0.1), 0, 1);
}

/** Up to three new matches a year: adults, of the gender the player is interested in, near where they live. */
export function findMatches() {
  const p = player();
  const block = datingBlocks();
  if (block.length) return result(false, block[0]);
  if (acts().matched) return result(false, 'You have looked through everyone new this year.');
  if (!spendHours(3)) return result(false, 'No spare time left this year.');
  acts().matched = true;
  const want = interest() ?? 'everyone';
  const made = [];
  for (let i = 0; i < 3; i++) {
    if (!rng.chance(0.55 + p.stats.charm / 300)) continue;
    const gender = want === 'men' ? 'male' : want === 'women' ? 'female' : rng.pick(['male', 'female']);
    const n = makeNpc({ role: 'contact', countryId: p.countryId, gender, age: Math.max(ADULT, p.age + rng.int(-5, 6)), relationship: rng.int(40, 55) });
    n.orientation = n.gender === p.gender ? rng.pick(['gay', 'bisexual']) : rng.pick(['straight', 'straight', 'bisexual']);
    n.flags.digitalOnly = true;
    n.flags.dating = true;
    n.flags.interest = rng.pick(['music', 'cooking', 'travel', 'books', 'sports', 'gaming', 'art']);
    n.lastInteractionAge = p.age;
    ensureLife(n);
    store.state.npcs[n.id] = n;
    world().matches.push({ id: newId('match'), npcId: n.id, year: store.state.year, stage: 'matched', compat: Math.round(compatibility(n) * 100) / 100, chats: 0 });
    made.push(n);
  }
  return made.length
    ? result(true, `${made.length} new ${made.length === 1 ? 'match' : 'matches'}: ${made.map((n) => `${n.firstName}, ${n.age}`).join('; ')}.`, 'good', { npcs: made })
    : result(false, 'Nobody new this time. It happens.', 'neutral');
}

export const openMatches = () => world().matches.filter((m) => ['matched', 'talking'].includes(m.stage) && charOf(m.npcId)?.alive);

/** Messaging a match. People get to know each other slowly; some drift off. Twice a year per match. */
export function chat(matchId) {
  const m = world().matches.find((x) => x.id === matchId);
  if (!m || !['matched', 'talking'].includes(m.stage)) return result(false, 'That conversation is over.');
  const n = charOf(m.npcId);
  if (datingBlocks().length) return result(false, datingBlocks()[0]);
  const key = `chat:${m.id}`;
  acts()[key] = (acts()[key] ?? 0) + 1;
  if (acts()[key] > 2) return result(false, 'Give it some time before you message again.');
  if (!spendHours(1)) return result(false, 'No spare time left this year.');
  m.chats += 1;
  if (rng.chance(0.15 * (1 - m.compat))) { m.stage = 'ended'; return result(false, `${n.firstName} stopped replying.`, 'neutral'); }
  m.stage = 'talking';
  n.flags.familiarity = clamp((n.flags.familiarity ?? 0) + rng.int(6, 12));
  const topic = n.flags.interest;
  return result(true, rng.pick([`You and ${n.firstName} traded stories about ${topic}.`, `${n.firstName} is funny in writing. You are getting to know each other.`, `A long conversation with ${n.firstName}, mostly about nothing, which is a good sign.`]), 'good');
}

/** Meeting a match in person. Only after talking for a while. If it goes well, the Romance engine takes it from here. */
export function meetMatch(matchId) {
  const p = player();
  const m = world().matches.find((x) => x.id === matchId);
  if (!m || m.stage !== 'talking') return result(false, 'Talk for a while before you meet.');
  if (m.chats < 2) return result(false, 'Talk a little more first.');
  if (datingBlocks().length) return result(false, datingBlocks()[0]);
  const n = charOf(m.npcId);
  const cost = localMoney(60, country());
  if (p.finance.cash < cost) return result(false, `A first date costs about ${fmtMoney(cost, country())}.`);
  if (!spendHours(4)) return result(false, 'No spare time left this year.');
  p.finance.cash -= cost;
  if (!rng.chance(clamp(0.25 + m.compat * 0.6, 0.15, 0.85))) {
    m.stage = 'ended';
    return result(false, `You met ${n.firstName} for a drink. Nice enough, but the spark was not there for either of you.`, 'neutral');
  }
  m.stage = 'met';
  // The Romance engine decides from here, with the same person.
  n.role = 'partner';
  delete n.flags.digitalOnly;
  n.flags.metOnline = DATING;
  const r = askOutStranger(n);
  if (!r.ok) { n.role = 'contact'; n.flags.digitalOnly = true; m.stage = 'ended'; return result(false, `The date went well, but ${n.firstName} was not looking for anything serious.`, 'neutral'); }
  m.stage = 'dating';
  recordEvent({ kind: 'digital_romance', charIds: [p.id, n.id], platformId: DATING, ref: { type: 'npc', id: n.id }, summary: `You met ${n.firstName} ${n.lastName} on ${PLATFORM_BY_ID[DATING].name}. After weeks of messages, a first date, and now you are seeing each other.`, visibility: 'family', once: `romance_${n.id}` });
  return result(true, `You met ${n.firstName} at last, and it went well. You are seeing each other.`, 'good');
}

export function unmatch(matchId) {
  const m = world().matches.find((x) => x.id === matchId);
  if (!m) return result(false, 'No such match.');
  m.stage = 'ended';
  return result(true, 'Unmatched.', 'neutral');
}

/** The year in communities: membership counts follow the platform, moderators put in their hours, people age. */
export function tickCommunities() {
  for (const c of Object.values(world().communities)) {
    const def = COMMUNITY_BY_ID[c.id];
    const target = Math.round((def?.size || 800) * Math.max(0.02, platformActivity(c.platformId)));
    c.memberCount = Math.max(0, Math.round(c.memberCount + (target - c.memberCount) * 0.3));
    if (!platformOpen(c.platformId) && !c.closedYear) { c.closedYear = store.state.year; c.history.push({ year: store.state.year, text: `${PLATFORM_BY_ID[c.platformId].name} shut down, and ${c.name} with it. Its threads are archived.` }); }
  }
  const mod = world().memberships.filter((m) => m.charId === player().id && m.role === 'moderator' && !m.leftYear);
  for (const m of mod) {
    const d = world();
    if (d.time.year !== store.state.year) d.time = { year: store.state.year, used: 0 };
    d.time.used += 15;
  }
}
