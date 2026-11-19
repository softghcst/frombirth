// Keeping in touch: letters, telephone calls, texts, direct messages and
// group chats, through whatever the era and the two people involved have.
// Every thread is between existing characters; replies come from who those
// people are and what has actually happened to them, never invented news.
import { rng } from '../../rng.js';
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { PLATFORM_BY_ID, TECH_BY_ID } from '../../data/digital.js';
import { roleLabel, spendAction } from '../relationships.js';
import { world, newId, charOf, isPlayer, firstOf, acts, result, recordEvent, spendHours, LIMITS } from './core.js';
import { adoption, techAvailable, accessFor, platformOpen } from './tech.js';
import { accountOn, account, blocks, activeAccountsOf, makeAccount, handleTaken } from './accounts.js';

export const FAMILY = ['parent', 'grandparent', 'sibling', 'child', 'grandchild', 'greatgrandchild', 'niece', 'relative', 'inlaw', 'spouse', 'partner'];
const ADULT = 18;

/** A stable per-person number in [0,1) — who is the type to pick up a new gadget — without touching the game's dice. */
export function lean(id, salt) {
  let h = 2166136261;
  for (const ch of `${id}|${salt}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Whether an NPC uses a technology. More people do as it spreads; older people
 * often come to it later, but plenty do come to it.
 */
export function npcUses(npc, techId) {
  if (!npc?.alive) return false;
  const t = TECH_BY_ID[techId];
  if (!t) return false;
  if (t.from <= -1000) return true;
  const where = typeof npc.flags?.abroad === 'string' ? npc.flags.abroad : player().countryId;
  const share = adoption(techId, store.state.year, where);
  if (share <= 0) return false;
  if (npc.age < (techId === 'smartphone' || techId === 'mobile' ? 10 : 8) && t.digital) return false;
  const late = npc.age >= 65 ? 0.6 : npc.age >= 50 ? 0.85 : 1;
  const keen = npc.traits?.some((x) => ['restless', 'radiant', 'bookish'].includes(x)) ? 1.1 : 1;
  return lean(npc.id, techId) < share * late * keen;
}

/**
 * The ways the player can reach someone this year, best first.
 * @returns {{id:string, name:string, tech:string, cost:number, hours:number, warmth:number, platformId?:string, why?:string}[]}
 */
export function channels(npcId) {
  const p = player();
  const npc = charOf(npcId);
  if (!npc?.alive || npc.role === 'pet') return [];
  const away = typeof npc.flags?.abroad === 'string' && npc.flags.abroad !== p.countryId;
  const out = [];
  // Online: both on the same messaging service.
  for (const acc of activeAccountsOf(p.id)) {
    const pl = PLATFORM_BY_ID[acc.platformId];
    if (!pl.messaging || !platformOpen(pl.id)) continue;
    const theirs = accountOn(npc.id, pl.id);
    if (!theirs || blocks(acc, theirs) || theirs.messages === 'nobody') continue;
    if (out.some((o) => o.platformId === pl.id)) continue;
    out.push({ id: `dm:${pl.id}`, name: `Message on ${pl.name}`, tech: pl.tech, cost: 0, hours: 1, warmth: 1, platformId: pl.id });
  }
  if (techAvailable('video_call') && accessFor('video', p.id) && npcUses(npc, 'video_call')) out.push({ id: 'video_call', name: 'Video call', tech: 'video_call', cost: 0, hours: 2, warmth: 1.4 });
  if (techAvailable('mobile') && accessFor('text', p.id) && npcUses(npc, 'mobile')) out.push({ id: 'text', name: 'Text message', tech: 'mobile', cost: 0, hours: 1, warmth: 0.8 });
  if (techAvailable('landline') && (accessFor('call', p.id) || p.flags.livesWithParents) && (npcUses(npc, 'landline') || npcUses(npc, 'mobile'))) out.push({ id: 'call', name: away ? 'Long-distance call' : 'Telephone call', tech: 'landline', cost: away && !techAvailable('video_call') ? 40 : 0, hours: 1, warmth: 1.2 });
  if (techAvailable('email') && accessFor('web', p.id) && npcUses(npc, 'email') && !out.some((o) => o.id.startsWith('dm:'))) out.push({ id: 'email', name: 'Email', tech: 'email', cost: 0, hours: 1, warmth: 0.9 });
  if (away && techAvailable('telegraph') && !techAvailable('mobile')) out.push({ id: 'telegram', name: 'Telegram', tech: 'telegraph', cost: 15, hours: 1, warmth: 0.6 });
  if (p.age >= 6) out.push({ id: 'letter', name: away ? 'Letter overseas' : 'Write a letter', tech: techAvailable('post') ? 'post' : 'letter', cost: away ? 4 : 1, hours: 2, warmth: 1.3 });
  return out;
}

/** What the player might want to say. Some need both people to be adults, or a particular kind of relationship. */
export function intents(npcId) {
  const p = player();
  const npc = charOf(npcId);
  const list = [
    { id: 'catch_up', label: 'Catch up' },
    { id: 'share_news', label: 'Share some news', needs: () => p.milestones.some((m) => m.age >= p.age - 1 && m.kind !== 'digital') },
    { id: 'plans', label: 'Make plans to meet', needs: () => p.age >= 10 },
    { id: 'invite', label: 'Invite them to something', needs: () => p.age >= 8 },
    { id: 'birthday', label: 'Send birthday wishes' },
    { id: 'support', label: 'Ask how they are really doing', needs: () => p.age >= 12 },
    { id: 'romance', label: 'Something sweet', needs: () => ['partner', 'spouse'].includes(npc?.role) && p.age >= ADULT && npc.age >= ADULT },
    { id: 'anniversary', label: 'Send anniversary wishes', needs: () => npc?.role === 'spouse' && npc.marriedAtAge != null },
    { id: 'us', label: 'Talk about how things are between you', needs: () => p.age >= 12 && ['partner', 'spouse', 'friend', 'sibling', 'parent'].includes(npc?.role) },
    { id: 'photo', label: 'Send a photo', needs: () => !!accessFor('photo') },
    { id: 'vent', label: 'Complain about people at work or school', needs: () => p.age >= 12 },
  ];
  return list.filter((x) => !x.needs || x.needs());
}

/** Contact the player is not allowed to start: protections for a young player, and people who have shut the door. */
export function contactBlock(npcId) {
  const p = player();
  const npc = charOf(npcId);
  if (!npc?.alive) return 'They are gone.';
  if (npc.role === 'pet') return 'Pets do not read.';
  const knownOffline = p.npcIds.includes(npc.id) && !npc.flags?.digitalOnly;
  if (p.age < ADULT && npc.age >= ADULT && !knownOffline && !FAMILY.includes(npc.role)) {
    return 'You do not know this adult outside the internet. Talk to a parent or another adult you trust first.';
  }
  if (npc.flags?.blockedPlayer) return `${npc.firstName} has blocked you.`;
  return null;
}

/** Finds or opens the one-to-one thread with someone, whatever the channel. One thread per person, so the history stays together. */
export function threadWith(npcId) {
  const d = world();
  const p = player();
  let t = Object.values(d.threads).find((x) => x.kind === 'dm' && x.participants.length === 2 && x.participants.includes(p.id) && x.participants.includes(npcId));
  if (!t) {
    t = { id: newId('th'), kind: 'dm', name: null, participants: [p.id, npcId], ownerId: p.id, messages: [], muted: false, status: 'active', unread: 0, createdYear: store.state.year, lastYear: store.state.year, visibility: 'private' };
    d.threads[t.id] = t;
  }
  return t;
}

function addMessage(t, from, text, channel, o = {}) {
  const m = { id: newId('msg'), from, year: store.state.year, age: player().age, text, channel, ...o };
  t.messages.push(m);
  if (t.messages.length > LIMITS.messagesPerThread) {
    // Messages the life story points at are kept; the oldest ordinary ones go.
    const keep = new Set(world().events.filter((e) => e.ref?.type === 'message').map((e) => e.ref.id));
    const i = t.messages.findIndex((x) => !keep.has(x.id));
    if (i >= 0) t.messages.splice(i, 1);
  }
  t.lastYear = store.state.year;
  if (!isPlayer(from) && !t.muted) t.unread += 1;
  return m;
}

const OPEN = {
  catch_up: ['How are you? It has been a while.', 'Thinking of you. What is new?', 'Just checking in.'],
  share_news: (p) => { const m = [...p.milestones].reverse().find((x) => x.kind !== 'digital'); return [`I wanted you to hear it from me: ${m ? m.text.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) : 'things are good'}.`]; },
  plans: ['Are you free sometime soon? I would love to see you.', 'Let us actually make a plan this time.'],
  invite: ['Come along on Saturday? It will not be the same without you.', 'I have two tickets. Interested?'],
  birthday: ['Happy birthday! Hope this year is a good one.', 'Many happy returns!'],
  support: ['How are you really doing? You can tell me.', 'You have been on my mind. Everything all right?'],
  romance: ['Thinking about you.', 'Cannot wait to see you tonight.', 'Still the best thing that ever happened to me.'],
  anniversary: ['Happy anniversary. I would choose you again.', 'Another year. Still my favorite person.'],
  us: ['Can we talk about us? I feel like we have drifted a bit.', 'I just want to make sure we are all right.'],
  photo: ['Look what I saw today!', 'Thought you would like this one.', 'Found this old photo of us.'],
  vent: ['I cannot stand some of the people I deal with. Honestly.', 'Can I just complain for a minute? Everyone is driving me up the wall.'],
};

/**
 * The other person's answer: shaped by how close they are, their nature and
 * what is really going on in their life (the latest line of their own
 * history), and never a made-up development.
 */
function replyFrom(npc, intent) {
  const fond = npc.meters?.relationship ?? 50;
  const p = player();
  const recent = npc.life?.history?.filter((h) => h.year >= store.state.year - 1 && !/^says /.test(h.text)).slice(-1)[0];
  const news = recent ? ` Big year here: I ${recent.text.replace(/^was /, 'was ').replace(/\b(his|her|their)\b/g, 'my')}.` : '';
  if (fond < 20 || npc.role === 'enemy') return { text: rng.pick(['Why are you messaging me?', '…', 'I would rather not.']), warm: false };
  if (npc.role === 'ex' && fond < 45) return { text: rng.pick(['Hi. I am doing fine, thanks.', 'Please do not.']), warm: false };
  if (npc.traits?.includes('worrier') && intent === 'support') return { text: `Honestly, it has been a lot. Thank you for asking. It means more than you know.${news}`, warm: true };
  const shortReplies = npc.traits?.includes('steady') || npc.traits?.includes('stubborn');
  const by = {
    catch_up: [`So good to hear from you!${news}`, `Ha, I was just thinking about you.${news}`],
    share_news: ['That is wonderful news! I am so happy for you.', `Congratulations, ${p.firstName}!`],
    plans: fond >= 45 ? ['Yes! Name the day.', 'I would love that.'] : ['Maybe. I am pretty busy at the moment.'],
    invite: fond >= 40 ? ['Count me in.', 'Absolutely.'] : ['I will see if I can make it.'],
    birthday: ['Thank you! You remembered.', 'Aw, thank you!'],
    support: [`I am all right, mostly.${news} Thank you for asking.`, 'Better for hearing from you.'],
    romance: ['Same. Always.', '❤', 'Come home soon.'],
    anniversary: ['Happy anniversary, love. Here is to many more.', '❤ Every year better.'],
    us: fond >= 55 ? ['We are good. Better than good. But thank you for asking.', 'I have felt it too. Let us make time for each other.'] : ['Honestly? I am not sure. We should talk properly.'],
    photo: ['Ha! I love it.', 'Oh, that takes me back.', 'Beautiful.'],
    vent: ['Ugh, I know exactly what you mean.', 'Vent away. I am listening.'],
  }[intent] ?? ['Thanks for the message.'];
  const text = shortReplies ? by[0].split('.')[0] + '.' : rng.pick(by);
  return { text, warm: true };
}

/**
 * Gets in touch with someone through a channel. Counts as time together for
 * the relationship (so a friend abroad does not fade), at most once a year
 * per person and channel.
 */
export function contact(npcId, channelId, intent = 'catch_up') {
  const p = player();
  const npc = charOf(npcId);
  const blocked = contactBlock(npcId);
  if (blocked) return result(false, blocked);
  const ch = channels(npcId).find((c) => c.id === channelId);
  if (!ch) return result(false, 'You have no way to reach them like that.');
  if (!intents(npcId).some((i) => i.id === intent)) return result(false, 'That would not be appropriate.');
  if (p.legal?.incarceration && ch.id !== 'letter') return result(false, 'From inside, letters are all you have.');
  const cost = localMoney(ch.cost, country());
  if (p.finance.cash < cost) return result(false, `That costs ${fmtMoney(cost, country())}.`);
  if (npc.flags) {
    npc.flags.acts ??= {};
    if (npc.flags.acts[`contact:${ch.id}`] === p.age) return result(false, `You already reached out to ${npc.firstName} that way this year.`);
  }
  if (!spendHours(ch.hours)) return result(false, 'No spare time left this year.');
  if (npc.flags) npc.flags.acts[`contact:${ch.id}`] = p.age;
  p.finance.cash -= cost;
  const t = threadWith(npcId);
  const opener = typeof OPEN[intent] === 'function' ? OPEN[intent](p) : OPEN[intent];
  addMessage(t, p.id, rng.pick(opener), ch.id, { intent });
  const reply = replyFrom(npc, intent);
  // Letters take a while; the reply is still part of this year.
  addMessage(t, npc.id, reply.text, ch.id);
  t.unread = 0;
  let gain = 0;
  if (npc.meters && p.npcIds.includes(npc.id)) {
    gain = reply.warm ? Math.round(rng.int(2, 5) * ch.warmth) : -1;
    npc.meters.relationship = clamp(npc.meters.relationship + gain);
    npc.lastInteractionAge = p.age;
    spendAction(npc, 'message');
  }
  if (npc.flags?.digitalOnly) bond(npc, reply.warm ? 6 : 1);
  // Talking about the relationship is a risk when things are not good: it can clear the air, or start a row.
  if (intent === 'us' && npc.meters && p.npcIds.includes(npc.id) && npc.meters.relationship < 55) {
    const cleared = rng.chance(0.5 + p.stats.charm / 300);
    npc.meters.relationship = clamp(npc.meters.relationship + (cleared ? 6 : -6));
    addMessage(t, npc.id, cleared ? 'Thank you for saying it. I am glad we talked.' : 'I do not think a message is the place for this.', ch.id);
  }
  // An invitation or a plan they say yes to is a real plan: it happens next year, if both of you are still able.
  if (['plans', 'invite'].includes(intent) && reply.warm && p.npcIds.includes(npc.id)) {
    world().plans ??= [];
    if (!world().plans.some((x) => x.npcId === npc.id && x.status === 'pending')) world().plans.push({ id: newId('plan'), npcId: npc.id, kind: intent, made: store.state.year, status: 'pending' });
  }
  // A meaningful message from family is kept: once per person.
  if (reply.warm && FAMILY.includes(npc.role) && (npc.meters?.relationship ?? 0) >= 80 && ['support', 'share_news', 'birthday'].includes(intent)) {
    recordEvent({ kind: 'family_message', charIds: [p.id, npc.id], ref: { type: 'message', id: t.messages[t.messages.length - 1].id }, summary: `A message from your ${roleLabel(npc).toLowerCase()} ${npc.firstName} that you kept: "${reply.text}"`, visibility: 'family', once: `family_message_${npc.id}`, tone: 'good' });
  }
  const how = { letter: 'You wrote to', telegram: 'You sent a telegram to', call: 'You called', video_call: 'You video-called', text: 'You texted', email: 'You emailed' }[ch.id] ?? 'You messaged';
  return result(reply.warm, `${how} ${npc.firstName}. "${reply.text}"`, reply.warm ? 'good' : 'neutral', { thread: t, gain });
}

/** Familiarity with someone known only online. At a point, they are a friend in the full sense. */
export function bond(npc, delta) {
  const p = player();
  npc.flags.familiarity = clamp((npc.flags.familiarity ?? 0) + delta);
  if (npc.flags.familiarity >= 30 && !p.npcIds.includes(npc.id) && npc.flags.digitalOnly) {
    // The same person, from now on in the player's life: no copy is made.
    npc.role = 'friend';
    npc.flags.metOnline = npc.flags.community ?? true;
    delete npc.flags.digitalOnly;
    npc.meters.relationship = clamp(Math.max(npc.meters.relationship, 55));
    npc.lastInteractionAge = p.age;
    p.npcIds.push(npc.id);
    recordEvent({ kind: 'online_friend', charIds: [p.id, npc.id], ref: { type: 'npc', id: npc.id }, summary: `You and ${npc.firstName} ${npc.lastName}, whom you met online, have become real friends.`, visibility: 'family', milestoneText: Object.values(world().events).some((e) => e.kind === 'online_friend') ? undefined : 'Made your first friend online.', once: `online_friend_${npc.id}` });
    return true;
  }
  return false;
}

// ---------- Group chats ----------

export const GROUP_TYPES = [
  { id: 'family', name: 'Family', roles: ['parent', 'grandparent', 'sibling', 'child', 'grandchild', 'spouse', 'partner', 'relative', 'niece', 'inlaw'] },
  { id: 'friends', name: 'Friends', roles: ['friend', 'partner'] },
  { id: 'school', name: 'School friends', roles: ['classmate', 'friend'] },
  { id: 'work', name: 'Coworkers', roles: ['coworker', 'boss', 'mentor'] },
  { id: 'hobby', name: 'Hobby club', roles: ['friend', 'classmate', 'coworker'] },
];

/** Platforms the player can start a group on, and who could be in it. */
export function groupOptions() {
  const p = player();
  return activeAccountsOf(p.id).map((a) => PLATFORM_BY_ID[a.platformId]).filter((pl) => pl.groups && platformOpen(pl.id))
    .map((pl) => ({ platform: pl, people: p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role !== 'pet' && accountOn(n.id, pl.id) && !contactBlock(n.id)) }));
}

/** Starts a group conversation. The player owns it and is its admin. */
export function createGroup({ platformId, name, type = 'friends', memberIds }) {
  const p = player();
  const opt = groupOptions().find((o) => o.platform.id === platformId);
  if (!opt) return result(false, 'You need an account on a service with group chats.');
  const ok = (memberIds ?? []).filter((id) => opt.people.some((n) => n.id === id));
  if (!ok.length) return result(false, 'Nobody you chose is on that service.');
  const clean = String(name ?? '').trim().slice(0, 40) || GROUP_TYPES.find((g) => g.id === type)?.name || 'Group';
  const t = { id: newId('th'), kind: 'group', name: clean, groupType: type, platformId, participants: [p.id, ...ok], ownerId: p.id, admins: [p.id], messages: [], muted: false, status: 'active', unread: 0, createdYear: store.state.year, lastYear: store.state.year, visibility: 'private', left: [] };
  world().threads[t.id] = t;
  addMessage(t, p.id, `Made a group so we can all keep in touch.`, `group:${platformId}`);
  const first = ok.map((id) => charOf(id)).find((n) => (n.meters?.relationship ?? 0) >= 40);
  if (first) addMessage(t, first.id, rng.pick(['Finally!', 'Love this.', 'Who is bringing snacks to the next one?']), `group:${platformId}`);
  t.unread = 0;
  return result(true, `You started "${clean}" with ${ok.length} ${ok.length === 1 ? 'other person' : 'others'}.`, 'good', { thread: t });
}

/** The player writes to a group. Members who are around reply; close ones grow a little closer, once a year. */
export function sendToGroup(threadId, intent = 'catch_up') {
  const p = player();
  const t = world().threads[threadId];
  if (!t || t.kind !== 'group' || !t.participants.includes(p.id)) return result(false, 'You are not in that group.');
  if (!platformOpen(t.platformId)) return result(false, `${PLATFORM_BY_ID[t.platformId].name} has shut down. The group lives on only in memory.`);
  if (!spendHours(1)) return result(false, 'No spare time left this year.');
  const opener = typeof OPEN[intent] === 'function' ? OPEN[intent](p) : OPEN[intent] ?? OPEN.catch_up;
  addMessage(t, p.id, rng.pick(opener), `group:${t.platformId}`, { intent });
  const others = t.participants.filter((id) => id !== p.id).map(charOf).filter((n) => n?.alive);
  const answering = others.filter((n) => rng.chance(0.35 + (n.meters?.relationship ?? 40) / 200)).slice(0, 3);
  const first = acts()[`group:${t.id}`] !== true;
  acts()[`group:${t.id}`] = true;
  for (const n of answering) {
    addMessage(t, n.id, replyFrom(n, intent).text, `group:${t.platformId}`);
    if (first && n.meters && p.npcIds.includes(n.id)) { n.meters.relationship = clamp(n.meters.relationship + 1); n.lastInteractionAge = p.age; }
  }
  t.unread = 0;
  return result(true, answering.length ? `${answering.map((n) => n.firstName).join(', ')} replied.` : 'Nobody has replied yet.', answering.length ? 'good' : 'neutral', { thread: t });
}

export function inviteToGroup(threadId, npcId) {
  const p = player();
  const t = world().threads[threadId];
  if (!t || !t.admins?.includes(p.id)) return result(false, 'Only the group\'s admin can add people.');
  if (t.participants.includes(npcId)) return result(false, 'They are already in it.');
  const opt = groupOptions().find((o) => o.platform.id === t.platformId);
  if (!opt?.people.some((n) => n.id === npcId)) return result(false, 'They are not on that service, or cannot be added.');
  t.participants.push(npcId);
  addMessage(t, npcId, 'Thanks for adding me!', `group:${t.platformId}`);
  return result(true, `${firstOf(npcId)} joined "${t.name}".`, 'good');
}

export function leaveGroup(threadId) {
  const p = player();
  const t = world().threads[threadId];
  if (!t || t.kind !== 'group' || !t.participants.includes(p.id)) return result(false, 'You are not in that group.');
  t.participants = t.participants.filter((id) => id !== p.id);
  t.left = [...(t.left ?? []), p.id];
  t.status = 'left';
  return result(true, `You left "${t.name}". The messages up to now are still yours to read.`, 'neutral');
}

export function muteThread(threadId, on = true) {
  const t = world().threads[threadId];
  if (!t) return result(false, 'No such conversation.');
  t.muted = on;
  if (on) t.unread = 0;
  return result(true, on ? 'Muted. You will not be told about new messages.' : 'Unmuted.', 'neutral');
}

export function markRead(threadId) { const t = world().threads[threadId]; if (t) t.unread = 0; }

/**
 * Threads the player can read: their own conversations only. Nobody else's
 * private messages are ever listed, whoever the player is.
 */
export function inbox() {
  const p = player();
  return Object.values(world().threads)
    .filter((t) => t.participants.includes(p.id) || t.left?.includes(p.id))
    .sort((a, b) => b.lastYear - a.lastYear || b.messages.length - a.messages.length);
}

/** Plans made by message, kept (or not) the following year. */
export function tickPlans() {
  const p = player();
  for (const x of world().plans ?? []) {
    if (x.status !== 'pending' || x.made >= store.state.year) continue;
    const n = charOf(x.npcId);
    const far = typeof n?.flags?.abroad === 'string' && n.flags.abroad !== p.countryId;
    if (!n?.alive || !p.npcIds.includes(n.id) || p.legal?.incarceration) { x.status = 'fell_through'; continue; }
    if (far && p.age < ADULT) { x.status = 'fell_through'; log(`The plan with ${n.firstName} never quite happened: too far away.`); continue; }
    x.status = 'kept';
    n.meters.relationship = clamp(n.meters.relationship + rng.int(3, 6));
    n.lastInteractionAge = p.age;
    n.memories ??= [];
    if (!n.memories.some((mm) => mm.key === `plan_${x.id}`)) n.memories.push({ key: `plan_${x.id}`, text: x.kind === 'invite' ? 'You invited them along, and they came.' : 'The two of you made a plan, and kept it.', age: p.age });
    log(`You and ${n.firstName} ${x.kind === 'invite' ? 'went to the thing you invited them to' : 'finally got together, as planned'}.`, 'system', 'good');
  }
}

/** Family and close friends remember birthdays, and spouses anniversaries. A few messages a year, never a flood. */
export function tickGreetings() {
  const p = player();
  if (!COMM_DIGITAL()) return;
  let sent = 0;
  const people = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role !== 'pet' && n.meters.relationship >= 60 && !contactBlock(n.id))
    .sort((a, b) => b.meters.relationship - a.meters.relationship);
  for (const n of people) {
    if (sent >= 3) break;
    const ch = channels(n.id).find((c) => c.id.startsWith('dm:') || c.id === 'text');
    if (!ch || !rng.chance(n.role === 'spouse' || n.role === 'parent' ? 0.7 : 0.25)) continue;
    const t = threadWith(n.id);
    const anniv = n.role === 'spouse' && n.marriedAtAge != null && (p.age - n.marriedAtAge) > 0 && (p.age - n.marriedAtAge) % 5 === 0;
    addMessage(t, n.id, anniv ? `${p.age - n.marriedAtAge} years married today. I would do it all again.` : rng.pick(['Happy birthday! Hope it is a lovely one.', `Happy birthday, ${p.firstName}!`, 'Many happy returns. Call me later?']), ch.id, { greeting: anniv ? 'anniversary' : 'birthday' });
    sent += 1;
  }
}
const COMM_DIGITAL = () => techAvailable('mobile') || techAvailable('instant');

/**
 * Helps an older relative or friend get online: setting up a phone, showing them how. Older people
 * can learn this as well as anyone; some just need someone to sit with them the first time.
 */
export function helpOnline(npcId, platformId) {
  const p = player();
  const n = charOf(npcId);
  if (!n?.alive || !p.npcIds.includes(npcId)) return result(false, 'They are not in your life.');
  if (accountOn(npcId, platformId)) return result(false, `${n.firstName} is already there.`);
  const pl = PLATFORM_BY_ID[platformId];
  if (!pl || !platformOpen(platformId)) return result(false, 'That service is not running.');
  if (n.age < pl.minAge) return result(false, `${n.firstName} is too young for ${pl.name}.`);
  if (acts()[`help:${npcId}`]) return result(false, 'You already spent an afternoon on this with them this year.');
  if (!spendHours(4)) return result(false, 'No spare time left this year.');
  acts()[`help:${npcId}`] = true;
  const willing = n.meters.relationship >= 40 && rng.chance(0.55 + n.meters.relationship / 250);
  if (!willing) return result(false, `${n.firstName} listened politely and said they would think about it.`, 'neutral');
  n.flags.helpedOnline = store.state.year;
  n.meters.relationship = clamp(n.meters.relationship + 4);
  n.lastInteractionAge = p.age;
  const h = `${n.firstName}.${n.lastName}`.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 16);
  let handle = h.length >= 3 ? h : `${h}fam`;
  while (handleTaken(platformId, handle)) handle = `${handle.slice(0, 14)}${rng.int(10, 99)}`;
  const acc = makeAccount(n.id, platformId, handle, { visibility: pl.privacy.includes('friends') ? 'friends' : pl.privacy[0] });
  const mine = accountOn(p.id, platformId);
  if (mine) { acc.following.push(mine.id); mine.followers.push(acc.id); }
  recordEvent({ kind: 'helped_online', charIds: [p.id, n.id], platformId, summary: `You spent an afternoon helping ${n.firstName} get set up on ${pl.name}. Their first message was to you.`, visibility: 'family', once: `helped_${n.id}_${platformId}` });
  return result(true, `${n.firstName} is on ${pl.name} now, and very pleased about it.`, 'good');
}

/** The year's group chatter, from people with real news. At most two messages a group a year; muted groups stay quiet. */
export function tickGroups() {
  const p = player();
  for (const t of Object.values(world().threads)) {
    if (t.kind !== 'group' || t.status !== 'active' || !platformOpen(t.platformId)) continue;
    let said = 0;
    for (const id of t.participants) {
      if (said >= 2 || id === p.id) continue;
      const n = charOf(id);
      if (!n?.alive) continue;
      const news = n.life?.history?.find((h) => h.year === store.state.year && /graduat|married|baby|promoted|qualified|started work|achieved|moved/.test(h.text));
      if (news) {
        addMessage(t, n.id, `News from me: I ${news.text.replace(/\b(his|her|their)\b/g, 'my')}!`, `group:${t.platformId}`, { canonical: { npcId: n.id, year: news.year } });
        said += 1;
      }
    }
    if (!said && rng.chance(0.3)) {
      const n = t.participants.map(charOf).filter((x) => x?.alive && !isPlayer(x.id))[0];
      if (n) addMessage(t, n.id, rng.pick(['Are we still on for next month?', 'Saw this and thought of you all.', 'Happy new year, everyone!']), `group:${t.platformId}`);
    }
    if (t.unread && !t.muted && t.unread >= 2 && t.notifyYear !== store.state.year) { t.notifyYear = store.state.year; log(`New messages in "${t.name}".`); }
  }
}

export { account };
