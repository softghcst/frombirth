// Making things for an audience: creator channels, content projects,
// livestreams, collaborations with other creators, sponsorships, and the
// money. Every payment goes through the Finance Engine's tax and lifetime
// totals, and every payment has a ledger record so it can never be paid twice.
import { rng } from '../../rng.js';
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { COUNTRIES } from '../../data/countries.js';
import { PLATFORM_BY_ID, PROJECT_BY_ID, PROJECT_KINDS, SPONSORS, SPONSOR_BY_ID, TRENDS, TOPIC_BY_ID, CREATOR_STAGES, FORMATS } from '../../data/digital.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { incomeTax } from '../finance.js';
import { hire, unmet } from '../career.js';
import { makeNpc } from '../npcFactory.js';
import { ensureLife } from '../npcLives.js';
import { world, newId, charOf, isPlayer, acts, result, recordEvent, spendHours, hoursLeft, reputation, adjustReputation, LIMITS } from './core.js';
import { accessFor, platformOpen, openPlatforms, devicesOf } from './tech.js';
import { account, accountsOf, activeAccountsOf, accountOn, followerCount, makeAccount, handleTaken, cleanHandle, follow } from './accounts.js';
import { qualityOf } from './content.js';
import { bond } from './messaging.js';

/** Projects move only along these lines. */
export const TRANSITIONS = {
  planned: ['in_progress', 'archived'],
  in_progress: ['in_progress', 'editing', 'archived'],
  editing: ['ready', 'archived'],
  ready: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};
function move(project, to) {
  if (!TRANSITIONS[project.status]?.includes(to)) throw new Error(`A project cannot go from ${project.status} to ${to}`);
  project.status = to;
  project.history.push({ year: store.state.year, status: to });
}

// ---------- Channels ----------

/** Platforms that support creators: an audience of followers. */
export const creatorPlatforms = () => openPlatforms().filter((pl) => pl.audience === 'followers');

/** Turns an account into a creator channel. A choice, not an automatic step. */
export function startChannel(accountId, pathway) {
  const p = player();
  const acc = account(accountId);
  if (!acc || !isPlayer(acc.ownerId) || acc.status !== 'active') return result(false, 'That is not one of your active accounts.');
  if (PLATFORM_BY_ID[acc.platformId].audience !== 'followers') return result(false, 'That kind of service has no audience to make things for.');
  if (acc.creator) return result(false, 'That is already a creator channel.');
  if (!TOPIC_BY_ID[pathway]) return result(false, 'Choose what the channel is about.');
  acc.creator = { pathway, stage: 'hobbyist', since: store.state.year, monetized: false, stageHistory: [{ year: store.state.year, stage: 'hobbyist' }] };
  if (acc.visibility !== 'public' && PLATFORM_BY_ID[acc.platformId].privacy.includes('public')) acc.visibility = 'public';
  recordEvent({ kind: 'creator_start', charIds: [p.id], platformId: acc.platformId, ref: { type: 'account', id: acc.id }, summary: `You started making ${TOPIC_BY_ID[pathway].name.toLowerCase()} content on ${PLATFORM_BY_ID[acc.platformId].name} as @${acc.handle}.`, visibility: 'public', once: `creator_${acc.id}` });
  return result(true, `@${acc.handle} is a creator channel now, about ${TOPIC_BY_ID[pathway].name.toLowerCase()}. It is public, so people can find it.`, 'good');
}

export const channels = (charId = player().id) => accountsOf(charId).filter((a) => a.creator);

/** Can this channel earn money? Adults only, on platforms that pay, with enough of an audience, in good standing. */
export function monetizeBlocks(acc) {
  const p = charOf(acc.ownerId);
  const pl = PLATFORM_BY_ID[acc.platformId];
  const why = [];
  if (!pl.monetize.ads && !pl.monetize.subs && !pl.monetize.tips) why.push(`${pl.name} does not pay creators.`);
  if (p.age < 18) why.push('Creator payments are for adults.');
  if (followerCount(acc) < pl.monetize.minAudience) why.push(`${pl.name} pays once a channel has ${pl.monetize.minAudience.toLocaleString('en-US')} followers.`);
  if (store.state.year - acc.createdYear < 1) why.push('The account has to be at least a year old.');
  if (reputation(acc.ownerId).credibility < 25) why.push('The platform will not pay an account with a record of breaking its rules.');
  return why;
}
export function monetize(accountId) {
  const acc = account(accountId);
  if (!acc?.creator || !isPlayer(acc.ownerId)) return result(false, 'That is not one of your channels.');
  const why = monetizeBlocks(acc);
  if (why.length) return result(false, why[0]);
  acc.creator.monetized = true;
  acc.creator.monetizedYear = store.state.year;
  return result(true, `${PLATFORM_BY_ID[acc.platformId].name} will share ad money with @${acc.handle} from now on.`, 'good');
}

/**
 * Where a creator stands. Worked out from what has actually happened —
 * how long they have kept at it, their audience, whether they live on it —
 * not from a follower count alone.
 */
export function stageOf(acc) {
  const p = charOf(acc.ownerId);
  const posts = acc.postIds.map((id) => world().posts[id]).filter((x) => x && !x.removed);
  const years = new Set(posts.map((x) => x.year)).size;
  const f = followerCount(acc);
  const rep = reputation(acc.ownerId);
  const paidDeals = Object.values(world().contracts).some((c) => c.accountId === acc.id && c.status === 'paid');
  if (rep.recognition >= 70 || f >= 1000000) return 'public';
  if (isPlayer(acc.ownerId) && p.career?.careerId === 'influencer') return 'fulltime';
  if ((f >= 5000 || paidDeals) && years >= 2) return 'established';
  if (posts.length >= 8 && f >= 100 && years >= 1) return 'growing';
  return 'hobbyist';
}

function updateStage(acc) {
  const next = stageOf(acc);
  if (next === acc.creator.stage) return;
  const order = CREATOR_STAGES.map((s) => s.id);
  const up = order.indexOf(next) > order.indexOf(acc.creator.stage);
  acc.creator.stage = next;
  acc.creator.stageHistory.push({ year: store.state.year, stage: next });
  const name = CREATOR_STAGES.find((s) => s.id === next).name;
  if (up && isPlayer(acc.ownerId)) recordEvent({ kind: 'creator_milestone', charIds: [acc.ownerId], platformId: acc.platformId, ref: { type: 'account', id: acc.id }, summary: `@${acc.handle} is now an ${/^[aeiou]/i.test(name) ? '' : ''}${name.toLowerCase()} channel, with ${followerCount(acc).toLocaleString('en-US')} followers.`, visibility: 'public', milestoneText: `Became ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name.toLowerCase()} on ${PLATFORM_BY_ID[acc.platformId].name}.`, once: `stage_${acc.id}_${next}` });
}

/**
 * Making content one's job: through the Occupation Engine's own creator
 * career, so the work tab, pay reviews and career history all know about it.
 * While it is the player's job, its salary is the channel's ordinary ad
 * income: the channel's ad revenue is not paid a second time.
 */
export function goFullTime(accountId) {
  const acc = account(accountId);
  if (!acc?.creator || !isPlayer(acc.ownerId)) return result(false, 'That is not one of your channels.');
  if (!['established', 'public'].includes(acc.creator.stage)) return result(false, 'Living on it takes an established channel first.');
  const career = CAREER_BY_ID.influencer;
  const why = unmet(career).filter((x) => typeof x === 'string');
  if (why.length) return result(false, why[0]);
  const f = followerCount(acc);
  const level = f >= 2000000 ? 3 : f >= 200000 ? 2 : f >= 10000 ? 1 : 0;
  hire(career, level, 60, 'channel');
  acc.creator.fullTimeYear = store.state.year;
  updateStage(acc);
  return result(true, `You made it official: making ${TOPIC_BY_ID[acc.creator.pathway].name.toLowerCase()} content for @${acc.handle} is your job now.`, 'good');
}

/** Making something is practice: a session on a project moves the matching skill or talent a little. */
const PRACTICE = { music: 'talents.music', singing: 'talents.singing', dance: 'talents.dance', acting: 'talents.acting', sports: 'talents.sports', cooking: 'skills.cooking', art: 'skills.photography', books: 'skills.writing', gaming: 'skills.coding' };
function practise(p, topic) {
  const path = PRACTICE[topic];
  if (!path) return;
  const [group, key] = path.split('.');
  p[group] ??= {};
  p[group][key] = clamp((p[group][key] ?? 0) + (group === 'talents' ? 0.5 : 1));
}

// ---------- Projects ----------

/**
 * Starts a project. Projects are the player's own work: nothing is published,
 * and no money comes in, until they choose to publish it.
 */
export function createProject({ kind, topic, title, collaboratorIds = [], budget = 0 }) {
  const p = player();
  const k = PROJECT_BY_ID[kind];
  if (!k) return result(false, 'Choose what kind of project it is.');
  if (!TOPIC_BY_ID[topic]) return result(false, 'Choose what it is about.');
  if (!accessFor(FORMATS[k.format].needs === 'web' ? 'web' : FORMATS[k.format].needs)) return result(false, `You need a device that can make ${k.name.toLowerCase()}s.`);
  const active = Object.values(world().projects).filter((x) => x.ownerId === p.id && ['planned', 'in_progress', 'editing'].includes(x.status));
  if (active.length >= 3) return result(false, 'You have three projects going already. Finish one first.');
  const cost = localMoney(k.cost + budget, country());
  if (p.finance.cash < cost) return result(false, `This needs ${fmtMoney(cost, country())} for materials and gear.`);
  p.finance.cash -= cost;
  const collab = collaboratorIds.filter((id) => charOf(id)?.alive);
  const project = {
    id: newId('proj'), ownerId: p.id, kind, topic, title: String(title ?? '').trim().slice(0, 60) || `${k.name} about ${TOPIC_BY_ID[topic].name.toLowerCase()}`,
    status: 'planned', sessions: 0, quality: 0, collaborators: collab, spent: cost, createdYear: store.state.year, history: [{ year: store.state.year, status: 'planned' }],
    postId: null, offerId: null,
  };
  world().projects[project.id] = project;
  return result(true, `New project: ${project.title}.`, 'good', { project });
}

/** One working session. Skill, gear and collaborators decide how good the result is. */
export function workOn(projectId) {
  const p = player();
  const x = world().projects[projectId];
  if (!x || x.ownerId !== p.id) return result(false, 'That is not your project.');
  if (!['planned', 'in_progress'].includes(x.status)) return result(false, x.status === 'editing' ? 'It is ready for editing.' : 'There is nothing left to film or write.');
  const k = PROJECT_BY_ID[x.kind];
  const h = Math.round(k.hours / k.sessions);
  if (!spendHours(h)) return result(false, `A session takes ${h} hours. You have ${hoursLeft()} left this year.`);
  move(x, 'in_progress');
  x.sessions += 1;
  const gear = devicesOf(p.id).filter((d) => ['camera', 'microphone', 'webcam'].includes(d.type)).length * 0.04;
  const help = x.collaborators.map(charOf).filter(Boolean).reduce((s, n) => s + ((n.talents?.[{ music: 'music', singing: 'singing', acting: 'acting', dance: 'dance', sports: 'sports' }[x.topic]] ?? n.meters?.intellect ?? 40) / 100) * 0.06, 0);
  const q = qualityOf(p.id, x.topic, k.format);
  x.quality = Math.round(clamp((x.quality * (x.sessions - 1) + q) / x.sessions + gear + help, 0.02, 0.98) * 1000) / 1000;
  literacy(p.id, 1);
  practise(p, x.topic);
  if (x.sessions >= k.sessions) move(x, 'editing');
  return result(true, x.status === 'editing' ? `You finished the last session on ${x.title}. It needs editing.` : `A good session on ${x.title}.`, 'good');
}

/** Editing turns raw work into something finished. A careful edit lifts it a little. */
export function edit(projectId) {
  const p = player();
  const x = world().projects[projectId];
  if (!x || x.ownerId !== p.id || x.status !== 'editing') return result(false, 'There is nothing to edit.');
  const h = Math.max(2, Math.round(PROJECT_BY_ID[x.kind].hours * 0.25));
  if (!spendHours(h)) return result(false, `Editing takes ${h} hours. You have ${hoursLeft()} left this year.`);
  x.quality = Math.min(0.98, Math.round((x.quality + 0.05 + (accessFor('edit') ? 0.03 : 0)) * 1000) / 1000);
  move(x, 'ready');
  return result(true, `${x.title} is finished. It will keep until you decide where, or whether, to publish it.`, 'good');
}

export function archiveProject(projectId) {
  const x = world().projects[projectId];
  if (!x || !isPlayer(x.ownerId)) return result(false, 'That is not your project.');
  if (x.status === 'archived') return result(false, 'Already archived.');
  move(x, 'archived');
  return result(true, `${x.title} is archived.`, 'neutral');
}

export const projectsOf = (charId = player().id) => Object.values(world().projects).filter((x) => x.ownerId === charId);

// ---------- Livestreams ----------

/** Plans a stream for later in the year. */
/** Gear the player owns that helps a stream: a webcam and lights, a good microphone, a good camera. */
export const streamGear = () => devicesOf(player().id).filter((d) => ['webcam', 'microphone', 'camera', 'presence_set'].includes(d.type));

export function planStream({ accountId, topic, collaboratorIds = [], equipment = [], when = 'this' }) {
  const p = player();
  const acc = account(accountId);
  if (!acc || !isPlayer(acc.ownerId) || acc.status !== 'active') return result(false, 'That is not one of your active accounts.');
  const pl = PLATFORM_BY_ID[acc.platformId];
  if (!pl.formats.includes('livestream')) return result(false, `${pl.name} does not do live video.`);
  if (!platformOpen(pl.id)) return result(false, `${pl.name} is not running.`);
  if (p.age < pl.minAge) return result(false, `Streaming on ${pl.name} is for ${pl.minAge} and over.`);
  if (!accessFor('stream')) return result(false, 'You need a device that can stream.');
  if (world().streams.some((s) => s.ownerId === p.id && s.status === 'scheduled')) return result(false, 'You already have a stream planned.');
  const gear = (Array.isArray(equipment) ? equipment : [equipment]).filter((id) => streamGear().some((d) => d.id === id));
  const s = { id: newId('live'), ownerId: p.id, accountId: acc.id, platformId: pl.id, topic: TOPIC_BY_ID[topic] ? topic : 'life', collaborators: collaboratorIds.filter((id) => charOf(id)?.alive),
    equipment: gear, status: 'scheduled', year: store.state.year, scheduledYear: store.state.year + (when === 'next' ? 1 : 0), result: null };
  world().streams.push(s);
  return result(true, `Stream planned on ${pl.name}: ${TOPIC_BY_ID[s.topic].name.toLowerCase()}${s.collaborators.length ? `, with ${s.collaborators.map((id) => charOf(id).firstName).join(' and ')}` : ''}.`, 'good', { stream: s });
}

/** Goes live. The audience is worked out once and recorded with the stream. */
export function broadcast(streamId) {
  const p = player();
  const s = world().streams.find((x) => x.id === streamId);
  if (!s || s.ownerId !== p.id || s.status !== 'scheduled') return result(false, 'There is no stream planned.');
  if ((s.scheduledYear ?? s.year) > store.state.year) return result(false, `This stream is planned for ${s.scheduledYear}.`);
  const acc = account(s.accountId);
  if (!acc || acc.status !== 'active' || !platformOpen(s.platformId)) return result(false, 'That account cannot go live right now.');
  if (!accessFor('stream')) return result(false, 'You need a device that can stream.');
  const a = acts();
  if ((a.streams ?? 0) >= 6) return result(false, 'Six streams in a year is plenty.');
  if (!spendHours(FORMATS.livestream.hours + 2)) return result(false, 'A stream takes about ten hours with the preparation. You do not have that left this year.');
  a.streams = (a.streams ?? 0) + 1;
  const gearBoost = (s.equipment ?? []).map((id) => world().devices.find((d) => d.id === id)).filter(Boolean).reduce((x, d) => x + ({ webcam: 0.05, microphone: 0.06, camera: 0.04, presence_set: 0.05 }[d.type] ?? 0), 0);
  const q = Math.min(0.98, qualityOf(p.id, s.topic, 'livestream') + gearBoost);
  const rep = reputation(p.id);
  const friends = s.collaborators.map((id) => accountOn(id, s.platformId)).filter(Boolean);
  const base = acc.followers.length * 0.5 + acc.audience * (0.01 + 0.04 * q) + friends.reduce((x, f) => x + f.audience * 0.02 + f.followers.length * 0.3, 0);
  const peak = Math.max(1, Math.round((base + q * 12 + rep.recognition) * rng.around(1, 0.3)));
  const total = Math.round(peak * rng.around(2.5, 0.6));
  const newFollowers = Math.round(total * (0.01 + 0.04 * q));
  acc.audience += newFollowers;
  const mon = acc.creator?.monetized && !monetizeBlocks(acc).length && PLATFORM_BY_ID[s.platformId].monetize.tips;
  const tipsGross = mon ? localMoney(total * rng.around(0.06, 0.03) * (0.5 + q), country()) : 0;
  s.status = 'done';
  s.result = { peak, total, newFollowers, quality: q, tipsGross, year: store.state.year };
  if (tipsGross > 0) pay({ accountId: acc.id, kind: 'tips', gross: tipsGross, fee: PLATFORM_BY_ID[s.platformId].monetize.fee, ref: `tips:${s.id}` });
  for (const id of s.collaborators) { const n = charOf(id); if (n?.meters && p.npcIds.includes(id)) { n.meters.relationship = clamp(n.meters.relationship + 3); n.lastInteractionAge = p.age; } else if (n?.flags?.digitalOnly) bond(n, 8); }
  p.stats.mood = clamp(p.stats.mood + (q > 0.5 ? 3 : peak < 5 ? -2 : 1));
  literacy(p.id, 2);
  const text = peak < 5 ? `You went live to a nearly empty room: ${peak} watching at the most. You played anyway.` : `You were live for three hours. ${peak.toLocaleString('en-US')} watching at the peak, ${total.toLocaleString('en-US')} in all${newFollowers ? `, ${newFollowers.toLocaleString('en-US')} new followers` : ''}${tipsGross ? `, and ${fmtMoney(tipsGross, country())} in tips` : ''}.`;
  recordEvent({ kind: 'first_stream', charIds: [p.id, ...s.collaborators], platformId: s.platformId, ref: { type: 'stream', id: s.id }, summary: `Your first livestream, on ${PLATFORM_BY_ID[s.platformId].name}. ${text}`, visibility: 'public', milestoneText: 'Went live for the first time.', once: `first_stream_${p.id}` }) ?? log(text);
  return result(true, text, peak < 5 ? 'neutral' : 'good', { stream: s });
}

export function cancelStream(streamId) {
  const s = world().streams.find((x) => x.id === streamId && x.status === 'scheduled');
  if (!s) return result(false, 'There is no stream planned.');
  s.status = 'cancelled';
  return result(true, 'Stream cancelled.', 'neutral');
}

// ---------- Collaborations ----------

/** Another creator, a real person kept in the world: made once and remembered. */
function creatorNpc(platformId, topic) {
  const p = player();
  const n = makeNpc({ role: 'contact', countryId: rng.chance(0.7) ? p.countryId : rng.pick(Object.keys(COUNTRIES)), age: Math.max(18, p.age + rng.int(-6, 8)), relationship: rng.int(40, 55) });
  n.flags.digitalOnly = true;
  n.flags.creator = topic;
  n.flags.interest = topic;
  if (n.bornIn !== p.countryId) n.flags.abroad = n.bornIn;
  n.talents = n.talents ?? {};
  ensureLife(n);
  store.state.npcs[n.id] = n;
  let h = cleanHandle(`${n.firstName}${TOPIC_BY_ID[topic].name.split(' ')[0]}`).replace(/[^A-Za-z0-9_.]/g, '');
  while (handleTaken(platformId, h)) h = `${h.slice(0, 16)}${rng.int(10, 99)}`;
  const acc = makeAccount(n.id, platformId, h, { visibility: 'public', interests: [topic], audience: rng.int(800, 40000) });
  acc.creator = { pathway: topic, stage: 'growing', since: store.state.year - rng.int(1, 6), monetized: true, stageHistory: [] };
  return n;
}

export const offers = () => world().offers.filter((o) => o.status === 'open' && o.year >= store.state.year - 1);

export function acceptCollab(offerId) {
  const o = world().offers.find((x) => x.id === offerId && x.kind === 'collab' && x.status === 'open');
  if (!o) return result(false, 'That offer is no longer open.');
  const k = PROJECT_KINDS.find((x) => x.id === (o.topic === 'music' || o.topic === 'singing' ? 'recital' : 'short'));
  const r = createProject({ kind: k.id, topic: o.topic, title: `${k.name} with ${charOf(o.fromId).firstName}`, collaboratorIds: [o.fromId] });
  if (!r.ok) return r;
  r.project.offerId = o.id;
  o.status = 'accepted';
  o.projectId = r.project.id;
  return result(true, `You and ${charOf(o.fromId).firstName} are making something together. Work on it in Creator Studio.`, 'good', { project: r.project });
}
export function declineOffer(offerId) {
  const o = world().offers.find((x) => x.id === offerId && x.status === 'open');
  if (!o) return result(false, 'That offer is no longer open.');
  o.status = 'declined';
  return result(true, 'You said no, politely.', 'neutral');
}

/** When a collaboration is published, both audiences meet: some of theirs follow the player. */
export function settleCollab(post) {
  const x = Object.values(world().projects).find((pr) => pr.postId === post.id && pr.offerId);
  if (!x || x.collabSettled) return;
  x.collabSettled = true;
  const p = player();
  const mine = account(post.accountId);
  for (const id of x.collaborators) {
    const n = charOf(id);
    const theirs = accountOn(id, post.platformId);
    if (theirs && mine) {
      const crossed = Math.round(theirs.audience * (0.01 + 0.05 * post.quality));
      mine.audience += crossed;
      post.metrics.followerDelta += crossed;
      follow(mine.id, theirs.id, { quiet: true }); follow(theirs.id, mine.id, { quiet: true });
    }
    if (n?.flags?.digitalOnly) bond(n, 12);
    else if (n?.meters) n.meters.relationship = clamp(n.meters.relationship + 5);
    recordEvent({ kind: 'collaboration', charIds: [p.id, id], platformId: post.platformId, ref: { type: 'post', id: post.id }, summary: `You and ${n.firstName} ${n.lastName} published ${x.title} together.`, visibility: 'public', once: `collab_${x.id}` });
  }
  // A paid collaboration is paid on publication, by contract, once.
  const offer = world().offers.find((o) => o.id === x.offerId);
  if (offer?.fee) pay({ accountId: post.accountId, kind: 'collaboration', gross: offer.fee, fee: 0, ref: `collab:${offer.id}` });
}

// ---------- Sponsorships ----------

export const contracts = (charId = player().id) => Object.values(world().contracts).filter((c) => c.ownerId === charId);

/** Offers a deal from a sponsor whose customers match the channel. Sponsors care about trust and fit, not only numbers. */
function sponsorOffer(acc) {
  const p = charOf(acc.ownerId);
  const rep = reputation(acc.ownerId);
  const fits = SPONSORS.filter((s) => s.topics.includes(acc.creator.pathway));
  if (!fits.length || rep.credibility < 35) return null;
  const past = Object.values(world().contracts).filter((c) => c.accountId === acc.id);
  if (past.some((c) => ['offered', 'negotiating', 'active'].includes(c.status))) return null;
  if (past.some((c) => c.status === 'expired' && store.state.year - c.year < 3)) return null;
  const s = rng.pick(fits);
  const f = followerCount(acc);
  const fee = localMoney(Math.max(150, f * 0.015 * s.budget * (0.6 + rep.credibility / 150) * (0.7 + rep.loyalty / 200)), COUNTRIES[p.countryId]);
  const posts = f > 100000 ? 3 : f > 10000 ? 2 : 1;
  const c = { id: newId('deal'), sponsorId: s.id, ownerId: acc.ownerId, accountId: acc.id, year: store.state.year, deadline: store.state.year + 1,
    deliverables: { posts, done: 0, disclosedAll: true, postIds: [] }, fee, currency: COUNTRIES[p.countryId].currency.code, disclosure: true,
    restrictions: `No posts for a competing ${s.blurb} brand while the deal runs.`, status: 'offered', negotiated: false, paidYear: null };
  world().contracts[c.id] = c;
  return c;
}

export function negotiate(contractId) {
  const c = world().contracts[contractId];
  if (!c || c.status !== 'offered' || !isPlayer(c.ownerId)) return result(false, 'There is nothing to negotiate.');
  if (c.negotiated) return result(false, 'You already pushed back once.');
  c.negotiated = true;
  const rep = reputation(c.ownerId);
  if (rng.chance(clamp(0.25 + rep.credibility / 200, 0.2, 0.75))) {
    const was = c.fee;
    c.fee = Math.round(c.fee * rng.around(1.18, 0.05));
    return result(true, `${SPONSOR_BY_ID[c.sponsorId].name} agreed: ${fmtMoney(c.fee, country())}, up from ${fmtMoney(was, country())}.`, 'good');
  }
  if (rng.chance(0.3)) { c.status = 'declined'; c.withdrawn = true; return result(false, `${SPONSOR_BY_ID[c.sponsorId].name} decided to work with someone else.`, 'neutral'); }
  return result(false, `${SPONSOR_BY_ID[c.sponsorId].name} said the offer stands as it is.`, 'neutral');
}

export function acceptDeal(contractId) {
  const c = world().contracts[contractId];
  if (!c || c.status !== 'offered' || !isPlayer(c.ownerId)) return result(false, 'That offer is not open.');
  if (player().age < 18) return result(false, 'Sponsorship contracts are for adults.');
  c.status = 'active';
  c.acceptedYear = store.state.year;
  // The time to deliver runs from signing, not from when the offer arrived.
  c.deadline = Math.max(c.deadline, store.state.year + 1);
  return result(true, `Deal signed with ${SPONSOR_BY_ID[c.sponsorId].name}: ${c.deliverables.posts} sponsored ${c.deliverables.posts === 1 ? 'post' : 'posts'}, labelled as paid, by the end of next year. ${fmtMoney(c.fee, country())} when they are done.`, 'good');
}
export function declineDeal(contractId) {
  const c = world().contracts[contractId];
  if (!c || c.status !== 'offered') return result(false, 'That offer is not open.');
  c.status = 'declined';
  return result(true, 'Declined.', 'neutral');
}
/** Ends a deal early. Allowed before anything is delivered; nothing is paid. */
export function endDeal(contractId) {
  const c = world().contracts[contractId];
  if (!c || c.status !== 'active') return result(false, 'There is no active deal.');
  if (c.deliverables.done > 0) return result(false, 'Part of it is delivered already: the contract has to run its course.');
  c.status = 'ended';
  adjustReputation(c.ownerId, 'credibility', -1, `Pulled out of a deal with ${SPONSOR_BY_ID[c.sponsorId].name}`);
  return result(true, 'You and the sponsor parted ways. Nothing is owed either way.', 'neutral');
}

/** Called when a post is published under a contract. */
export function deliver(post) {
  const c = world().contracts[post.contractId];
  if (!c || c.status !== 'active') return;
  c.deliverables.done += 1;
  c.deliverables.postIds.push(post.id);
  if (!post.disclosed) c.deliverables.disclosedAll = false;
}

// ---------- Money ----------

/**
 * Pays a creator. Gross, the platform's cut, production costs, tax and net
 * are all recorded; the net reaches the bank through the Finance Engine's
 * tax rules and lifetime totals. A ledger key is paid at most once.
 */
export function pay({ accountId, kind, gross, fee = 0, expenses = 0, ref }) {
  const d = world();
  if (d.ledger.some((x) => x.ref === ref)) return null;
  const acc = account(accountId);
  const owner = charOf(acc.ownerId);
  if (!isPlayer(acc.ownerId)) { d.ledger.push({ id: newId('pay'), ref, year: store.state.year, accountId, kind, gross, platformFee: 0, expenses: 0, tax: 0, net: 0, npc: true }); return null; }
  const platformFee = Math.round(gross * fee);
  const taxable = Math.max(0, gross - platformFee - expenses);
  const tax = Math.round(incomeTax(taxable, COUNTRIES[owner.countryId]));
  const net = gross - platformFee - expenses - tax;
  owner.finance.cash += net + expenses; // production costs were paid when they were incurred
  owner.finance.lifetimeEarned += taxable;
  owner.finance.lifetimeTaxPaid += tax;
  const row = { id: newId('pay'), ref, year: store.state.year, accountId, kind, gross, platformFee, expenses, tax, net, currency: COUNTRIES[owner.countryId].currency.code };
  d.ledger.push(row);
  if (d.ledger.length > LIMITS.ledger) d.ledger.shift();
  if (!d.ledger.some((x) => x.ref !== ref && !x.npc && x.accountId && charOf(account(x.accountId)?.ownerId) === owner)) {
    recordEvent({ kind: 'first_income', charIds: [owner.id], platformId: acc.platformId, ref: { type: 'ledger', id: row.id }, summary: `The first money you ever made from your content: ${fmtMoney(net, country())} after the platform's cut and tax.`, visibility: 'family', milestoneText: 'Earned money from your content for the first time.', once: `first_income_${owner.id}` });
  }
  return row;
}

/** The ledger rows for a character's channels. */
export const ledgerOf = (charId = player().id) => world().ledger.filter((x) => !x.npc && account(x.accountId)?.ownerId === charId);

/** The year's creator business: stages, ad and subscription money, deals paid or lapsed, new offers, trends. */
export function tickCreators() {
  const d = world();
  const p = player();
  const y = store.state.year;
  for (const acc of channels(p.id)) {
    if (acc.status !== 'active') continue;
    updateStage(acc);
    const pl = PLATFORM_BY_ID[acc.platformId];
    // Ad money for last year's views, once. Not while the creator career pays the player for the same channel.
    if (acc.creator.monetized && !monetizeBlocks(acc).length && p.career?.careerId !== 'influencer') {
      const views = acc.postIds.map((id) => d.posts[id]).filter((x) => x && x.year === y - 1 && x.metrics && x.audience === 'public').reduce((s, x) => s + x.metrics.views, 0);
      const adGross = pl.monetize.ads ? localMoney(views / 1000 * 2.2, country()) : 0;
      const subs = pl.monetize.subs ? Math.round(followerCount(acc) * 0.0015 * (reputation(p.id).loyalty / 50)) : 0;
      const subGross = localMoney(subs * 4 * 12 * 0.5, country());
      const expenses = Object.values(d.projects).filter((x) => x.ownerId === p.id && x.createdYear === y - 1).reduce((s, x) => s + x.spent, 0);
      if (adGross > 0) pay({ accountId: acc.id, kind: 'ads', gross: adGross, fee: pl.monetize.fee, expenses: Math.min(expenses, adGross * 0.5), ref: `ads:${acc.id}:${y - 1}` });
      if (subGross > 0) pay({ accountId: acc.id, kind: 'subscriptions', gross: subGross, fee: pl.monetize.fee, ref: `subs:${acc.id}:${y - 1}` });
    }
    // A collaboration offer from another creator, now and then, once a channel is going.
    if (['growing', 'established', 'fulltime', 'public'].includes(acc.creator.stage) && !offers().some((o) => o.kind === 'collab') && rng.chance(0.25)) {
      const friend = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.alive && accountOn(n.id, acc.platformId)?.creator?.pathway === acc.creator.pathway);
      const from = friend ?? (rng.chance(0.6) ? creatorNpc(acc.platformId, acc.creator.pathway) : null);
      if (from) {
        // Established creators with a brand behind them sometimes pay for the work; friends never do.
        const fee = !friend && ['established', 'fulltime', 'public'].includes(acc.creator.stage) && p.age >= 18 && rng.chance(0.4) ? localMoney(Math.max(200, followerCount(acc) * 0.01), country()) : 0;
        d.offers.push({ id: newId('offer'), kind: 'collab', fromId: from.id, accountId: acc.id, topic: acc.creator.pathway, year: y, status: 'open', fee });
        log(`${from.firstName} ${from.lastName}, who makes ${TOPIC_BY_ID[acc.creator.pathway].name.toLowerCase()} content on ${pl.name}, asked if you would like to make something together.`, 'system', 'good');
      }
    }
    if (p.age >= 18 && followerCount(acc) >= 1000 && rng.chance(0.35)) {
      const c = sponsorOffer(acc);
      if (c) log(`${SPONSOR_BY_ID[c.sponsorId].name} offered @${acc.handle} a sponsorship: ${fmtMoney(c.fee, country())} for ${c.deliverables.posts} ${c.deliverables.posts === 1 ? 'post' : 'posts'}.`, 'system', 'good');
    }
  }
  for (const acc of channels(p.id).filter((a) => a.status === 'active')) {
    const pl = PLATFORM_BY_ID[acc.platformId];
    // Merchandise: sold to the people who stick around, with the cost of making it taken off.
    if (acc.creator.merch && p.age >= 18) {
      const units = Math.round(followerCount(acc) * 0.0015 * (reputation(p.id).loyalty / 50) * rng.around(1, 0.3));
      if (units > 0) pay({ accountId: acc.id, kind: 'merch', gross: localMoney(units * 25, country()), fee: 0.05, expenses: localMoney(units * 12, country()), ref: `merch:${acc.id}:${y - 1}` });
    }
    // Affiliate links, always labelled: a small share of what the audience bought through last year's posts.
    if (acc.creator.monetized && p.age >= 18) {
      const views = acc.postIds.map((id) => d.posts[id]).filter((x) => x?.affiliate && x.year === y - 1 && x.metrics).reduce((s, x) => s + x.metrics.views, 0);
      if (views > 0) pay({ accountId: acc.id, kind: 'affiliate', gross: localMoney(views * 0.004, country()), fee: 0, ref: `aff:${acc.id}:${y - 1}` });
    }
    // Licensing: someone wants to use a good, well-seen piece of work, and pays once for it.
    const good = acc.postIds.map((id) => d.posts[id]).find((x) => x && !x.removed && x.audience === 'public' && x.quality >= 0.7 && x.metrics?.views >= 800 && x.source?.type === 'project' && !d.offers.some((o) => o.kind === 'license' && o.postId === x.id));
    if (good && p.age >= 18 && rng.chance(0.25)) {
      d.offers.push({ id: newId('offer'), kind: 'license', postId: good.id, accountId: acc.id, fee: localMoney(Math.max(150, good.metrics.views * 0.05), country()), year: y, status: 'open', from: rng.pick(['a television producer', 'a small film company', 'an advertising agency', 'a school textbook publisher']) });
      log(`Someone wants to license "${good.text}" from @${acc.handle}.`, 'system', 'good');
    }
    // A routine the player set: the posts get made as the year goes, time allowing.
    if (acc.creator.routine && pl && platformOpen(pl.id)) runRoutine(acc);
    // Good work that reached new people can lead somewhere.
    const hit = acc.postIds.map((id) => d.posts[id]).find((x) => x && x.year === y - 1 && ['reach', 'viral'].includes(x.outcome));
    if (hit && !offers().some((o) => o.kind === 'collab') && rng.chance(0.3)) {
      const from = creatorNpc(acc.platformId, acc.creator.pathway);
      d.offers.push({ id: newId('offer'), kind: 'collab', fromId: from.id, accountId: acc.id, topic: acc.creator.pathway, year: y, status: 'open', fee: 0, fromPost: hit.id });
      log(`${from.firstName} ${from.lastName} saw your post that took off and asked about making something together.`, 'system', 'good');
    }
  }
  // Deals: paid when delivered, lapsed when not.
  for (const c of Object.values(d.contracts)) {
    if (c.ownerId !== p.id) continue;
    if (c.status === 'active' && c.deliverables.done >= c.deliverables.posts) {
      c.status = 'completed';
      const row = pay({ accountId: c.accountId, kind: 'sponsorship', gross: c.fee, fee: 0, ref: `deal:${c.id}` });
      if (row) { c.status = 'paid'; c.paidYear = y; adjustReputation(p.id, 'credibility', 1, `Delivered a deal for ${SPONSOR_BY_ID[c.sponsorId].name}`); log(`${SPONSOR_BY_ID[c.sponsorId].name} paid ${fmtMoney(c.fee, country())} for the sponsored posts: ${fmtMoney(row.net, country())} after tax.`, 'system', 'good'); }
      if (!c.deliverables.disclosedAll && rng.chance(0.4)) {
        // Hidden advertising, found out: this is real conduct, so it is recorded as verified.
        const cvId = newId('cv');
        world().controversies[cvId] = { id: cvId, ref: `deal:${c.id}`, charId: p.id, kind: 'undisclosed_ad', status: 'verified', truth: true, year: y, response: null, resolvedYear: null, text: `People noticed that your posts for ${SPONSOR_BY_ID[c.sponsorId].name} were paid for and never said so.` };
        adjustReputation(p.id, 'credibility', -8, 'Sponsored posts that were not labelled as ads');
        log(`People noticed that your posts for ${SPONSOR_BY_ID[c.sponsorId].name} were paid for and never said so.`, 'system', 'bad');
      }
    } else if (['active', 'offered'].includes(c.status) && y > c.deadline) {
      c.status = c.status === 'active' ? 'expired' : 'declined';
      if (c.status === 'expired') { adjustReputation(p.id, 'credibility', -3, `Missed the deadline on a deal with ${SPONSOR_BY_ID[c.sponsorId].name}`); log(`Your deal with ${SPONSOR_BY_ID[c.sponsorId].name} lapsed unfinished. No payment, and they will remember.`, 'system', 'bad'); }
    }
  }
  tickTrends();
}

/** Each running platform has a trend or two; each lasts a year or two. Joining in is never required. */
function tickTrends() {
  const d = world();
  const y = store.state.year;
  d.trends = d.trends.filter((t) => t.endYear >= y - 3);
  for (const pl of openPlatforms().filter((x) => ['shortvideo', 'video', 'personal'].includes(x.type))) {
    if (d.trends.some((t) => t.platformId === pl.id && t.endYear >= y)) continue;
    if (!rng.chance(0.6)) continue;
    const t = rng.pick(TRENDS);
    d.trends.push({ id: newId('trend'), defId: t.id, platformId: pl.id, name: t.name, topics: t.topics, text: t.text, startYear: y, endYear: y + rng.int(0, 1) });
  }
}
/** A creator's routine: a few posts a year, made automatically while time allows. Optional, and stopped any time. */
export function setRoutine(accountId, routine) {
  const acc = account(accountId);
  if (!acc?.creator || !isPlayer(acc.ownerId)) return result(false, 'That is not one of your channels.');
  if (!routine) { acc.creator.routine = null; return result(true, 'Routine stopped. You will post when you feel like it.', 'neutral'); }
  const pl = PLATFORM_BY_ID[acc.platformId];
  const format = pl.formats.includes(routine.format) ? routine.format : pl.formats.find((f) => f !== 'livestream');
  const perYear = Math.max(1, Math.min(24, Math.round(Number(routine.perYear) || 6)));
  acc.creator.routine = { perYear, format, topic: TOPIC_BY_ID[routine.topic] ? routine.topic : acc.creator.pathway };
  return result(true, `Routine set: ${perYear} ${FORMATS[format].name.toLowerCase()}${perYear === 1 ? '' : 's'} a year about ${TOPIC_BY_ID[acc.creator.routine.topic].name.toLowerCase()}, about ${perYear * FORMATS[format].hours} hours.`, 'good');
}
function runRoutine(acc) {
  const r = acc.creator.routine;
  let made = 0;
  for (let i = 0; i < r.perYear; i++) { const res = publishRoutine(acc, r); if (!res.ok) break; made += 1; }
  if (made) log(`Your routine on @${acc.handle}: ${made} ${made === 1 ? 'post' : 'posts'} this year${made < r.perYear ? `, fewer than planned: there was not the time` : ''}.`);
}
// content.publish, handed over by tick.js at start-up: content imports this module, so it cannot be imported here directly.
var publisher = null; // eslint-disable-line no-var
function publishRoutine(acc, r) { return publisher ? publisher({ accountId: acc.id, format: r.format, topic: r.topic, routine: true }) : { ok: false }; }
export function useRoutinePublisher(fn) { publisher = fn; }

/** Starts selling merchandise. Costs a setup fee; sales come in yearly, through the ledger. */
export function startMerch(accountId) {
  const p = player();
  const acc = account(accountId);
  if (!acc?.creator || !isPlayer(acc.ownerId)) return result(false, 'That is not one of your channels.');
  if (p.age < 18) return result(false, 'Selling things is for adults.');
  if (acc.creator.merch) return result(false, 'You already sell merchandise.');
  if (!['growing', 'established', 'fulltime', 'public'].includes(acc.creator.stage) || followerCount(acc) < 500) return result(false, 'Merchandise needs an audience that wants it: a growing channel with 500 followers or more.');
  const cost = localMoney(1500, country());
  if (p.finance.cash < cost) return result(false, `Designs, samples and a shop cost ${fmtMoney(cost, country())}.`);
  p.finance.cash -= cost;
  acc.creator.merch = { since: store.state.year, setup: cost };
  return result(true, `You opened a shop for @${acc.handle}. Sales come in through the year.`, 'good');
}

export function answerLicense(offerId, yes) {
  const o = world().offers.find((x) => x.id === offerId && x.kind === 'license' && x.status === 'open');
  if (!o) return result(false, 'That offer is no longer open.');
  if (!yes) { o.status = 'declined'; return result(true, 'You kept it to yourself.', 'neutral'); }
  o.status = 'accepted';
  const row = pay({ accountId: o.accountId, kind: 'licensing', gross: o.fee, fee: 0, ref: `license:${o.id}` });
  return result(true, `You licensed it to ${o.from} for ${fmtMoney(o.fee, country())}${row ? ` (${fmtMoney(row.net, country())} after tax)` : ''}.`, 'good');
}

export const currentTrends = (platformId) => world().trends.filter((t) => t.endYear >= store.state.year && (!platformId || t.platformId === platformId));

/** Digital skills grow with use. Kept per character; never a stand-in for intelligence. */
export function literacy(charId, delta) {
  const w = world().wellbeing;
  w[charId] ??= {};
  w[charId].literacy = clamp((w[charId].literacy ?? 10) + delta);
  return w[charId].literacy;
}
