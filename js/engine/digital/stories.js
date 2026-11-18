// The Story Director's digital arcs. Each is found in saved state — a friend
// who drifted away years ago, a teenager who has been practicing, an
// ancestor's old channel — and offered as an ordinary scene, at most one a
// year. The choices are resolved here, against the same engines the rest of
// Digital Life uses.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { PLATFORM_BY_ID, TOPIC_BY_ID } from '../../data/digital.js';
import { world, charOf, recordEvent, result } from './core.js';
import { platformOpen, accessFor, techAvailable } from './tech.js';
import { accountOn, activeAccountsOf, follow, createAccount, cleanHandle, handleTaken, account } from './accounts.js';
import { publish } from './content.js';
import { threadWith, npcUses } from './messaging.js';
import { joinPlatform } from './npc.js';
import { respond, openControversies, openSafety, handleSafety, takeBreak, setNotifications, wellbeing as wellbeingOf } from './reputation.js';
import { goFullTime, acceptCollab, declineOffer } from './creator.js';
import { volunteerModerate, meetInPerson } from './community.js';
import { quitCareer } from '../career.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { localMoney } from '../../util.js';
import { country } from '../../state.js';
import { archiveOf } from './legacy.js';

const arcs = () => world().arcs;
const queued = (id) => store.state.pendingEvents.some((e) => e.id === id);
const queue = (id, cast = {}) => { store.state.pendingEvents.push({ id, cast }); };

/** Picks this year's digital scene, if any. */
export function tickStories() {
  const p = player();
  const a = arcs();
  if (p.legal?.incarceration || store.state.pendingEvents.some((e) => e.id.startsWith('digital_'))) return;
  // Something that needs answering comes first.
  const cv = openControversies().find((c) => !a[`cv:${c.id}`]);
  if (cv) { a[`cv:${cv.id}`] = store.state.year; return queue('digital_controversy', { words: { what: cv.text } }); }
  const bully = openSafety().find((s) => s.kind === 'bullying' && !a[`safe:${s.id}`]);
  if (bully) { a[`safe:${bully.id}`] = store.state.year; return queue('digital_bullying', { words: { safety: bully.id } }); }
  if (a.lastYear === store.state.year || rng.chance(0.45)) return undefined;
  const found = [reconnectCandidate, firstVideoCandidate, ancestorCandidate, ...ARCS].reduce((f, fn) => f ?? fn(), null);
  if (!found) return undefined;
  a.lastYear = store.state.year;
  a[found.key] = store.state.year;
  return queue(found.id, found.cast);
}

/** A childhood friend or classmate who drifted away at least five years ago and is now findable online. */
function reconnectCandidate() {
  const p = player();
  if (p.age < 18) return null;
  const mine = activeAccountsOf(p.id).find((acc) => PLATFORM_BY_ID[acc.platformId].type === 'personal');
  if (!mine) return null;
  const old = Object.values(store.state.npcs).filter((n) => n.alive && n.flags?.drifted && !p.npcIds.includes(n.id)
    && store.state.year - n.flags.drifted.year >= 5 && !arcs()[`reconnect:${n.id}`]);
  for (const n of old) {
    let theirs = accountOn(n.id, mine.platformId);
    if (!theirs && npcUses(n, PLATFORM_BY_ID[mine.platformId].tech)) theirs = joinPlatform(n, PLATFORM_BY_ID[mine.platformId]);
    if (theirs) return { id: 'digital_reconnect', key: `reconnect:${n.id}`, cast: { friend: n.id, words: { platform: PLATFORM_BY_ID[mine.platformId].name, years: String(store.state.year - n.flags.drifted.year) } } };
  }
  return null;
}

/** A teenager who has been practicing music, with a way to film it and somewhere to put it. */
function firstVideoCandidate() {
  const p = player();
  if (p.age < 13 || p.age > 19 || arcs().firstVideo) return null;
  const gift = Math.max(p.talents.music ?? 0, p.talents.singing ?? 0, p.talents.dance ?? 0);
  if (gift < 55) return null;
  if (Object.values(world().posts).some((x) => x.authorId === p.id && /video/.test(x.format))) return null;
  const pl = ['vista', 'spinnet', 'hearth'].map((id) => PLATFORM_BY_ID[id]).find((x) => platformOpen(x.id) && p.age >= x.minAge);
  if (!pl || !accessFor('video')) return null;
  const what = (p.talents.music ?? 0) >= gift ? 'playing' : (p.talents.singing ?? 0) >= gift ? 'singing' : 'dancing';
  return { id: 'digital_first_video', key: 'firstVideo', cast: { words: { platform: pl.name, what, pl: pl.id } } };
}

/** An ancestor's archived posts, waiting in the family archive. */
function ancestorCandidate() {
  for (const anc of world().archive.ancestors) {
    if (arcs()[`ancestor:${anc.id}`]) continue;
    const view = archiveOf(anc.id);
    if (view && (view.posts.length || view.memories.length) && charOf(anc.id)) return { id: 'digital_ancestor', key: `ancestor:${anc.id}`, cast: { ancestor: anc.id } };
  }
  return null;
}

// ---------- Longer arcs, each found in what has actually happened ----------

const once = (key) => !arcs()[key];
const yearsOf = (acc) => store.state.year - (acc.creator?.since ?? acc.createdYear);
const mine = () => activeAccountsOf(player().id);

const ARCS = [
  // A channel becomes established: a choice about what it is for.
  () => {
    const acc = mine().find((a) => a.creator && ['established', 'public'].includes(a.creator.stage) && !a.creator.retired);
    if (!acc || player().age < 18 || player().career?.careerId === 'influencer' || !once(`crossroads:${acc.id}`)) return null;
    return { id: 'digital_creator_crossroads', key: `crossroads:${acc.id}`, cast: { words: { handle: `@${acc.handle}`, acc: acc.id } } };
  },
  // Two years of every spare hour on content.
  () => {
    const w = world().wellbeing[player().id] ?? {};
    const heavy = (w.heavyYears ?? 0) >= 2 && mine().some((a) => a.creator && !a.creator.retired);
    if (!heavy || !once(`burnout:${store.state.year - (store.state.year % 5)}`)) return null;
    return { id: 'digital_creator_burnout', key: `burnout:${store.state.year - (store.state.year % 5)}`, cast: {} };
  },
  // Decades in, later in life: whether to stop.
  () => {
    const acc = mine().find((a) => a.creator && !a.creator.retired && yearsOf(a) >= 10);
    if (!acc || player().age < 50 || !once(`stepback:${acc.id}`)) return null;
    return { id: 'digital_creator_stepback', key: `stepback:${acc.id}`, cast: { words: { handle: `@${acc.handle}`, years: String(yearsOf(acc)), acc: acc.id } } };
  },
  // The attention after a post spreads.
  () => {
    const hit = Object.values(world().posts).find((x) => x.authorId === player().id && x.outcome === 'viral' && x.year >= store.state.year - 1);
    return hit && once('viralAfter') ? { id: 'digital_viral_after', key: 'viralAfter', cast: {} } : null;
  },
  // A bigger creator — a real person — reaches out.
  () => {
    const o = world().offers.find((x) => x.kind === 'collab' && x.status === 'open' && charOf(x.fromId)?.flags?.creator && !arcs()[`breakthrough:${x.id}`]);
    return o ? { id: 'digital_breakthrough', key: `breakthrough:${o.id}`, cast: { creator: o.fromId, words: { topic: TOPIC_BY_ID[o.topic]?.name.toLowerCase() ?? 'video', offer: o.id } } } : null;
  },
  // A recruiter's message, from this year's record.
  () => {
    const e = world().events.find((x) => x.kind === 'recruited' && x.year === store.state.year);
    const career = player().career?.careerId ? CAREER_BY_ID[player().career.careerId] : null;
    return e && career && once(`recruiter:${e.id}`) ? { id: 'digital_recruiter', key: `recruiter:${e.id}`, cast: { words: { platform: PLATFORM_BY_ID.guildhall.name, field: career.name.toLowerCase(), career: career.id } } } : null;
  },
  // A trusted community member is asked to help run it.
  () => {
    const m = world().memberships.find((x) => x.charId === player().id && !x.leftYear && x.role === 'member' && x.standing >= 55 && store.state.year - x.sinceYear >= 2 && player().age >= 16 && once(`modinvite:${x.communityId}`));
    const c = m && world().communities[m.communityId];
    return c ? { id: 'digital_moderator_invite', key: `modinvite:${c.id}`, cast: { words: { community: c.name, cid: c.id } } } : null;
  },
  // An online friend suggests meeting: adults only.
  () => {
    const p = player();
    if (p.age < 18) return null;
    const n = p.npcIds.map((id) => store.state.npcs[id]).find((x) => x?.alive && x.flags?.metOnline && x.age >= 18 && x.meters.relationship >= 55 && !world().events.some((e) => e.kind === 'met_online_friend' && e.charIds.includes(x.id)) && once(`meet:${x.id}`));
    return n ? { id: 'digital_meet_friend', key: `meet:${n.id}`, cast: { friend: n.id } } : null;
  },
  // A partner who lives abroad.
  () => {
    const p = player();
    const n = p.npcIds.map((id) => store.state.npcs[id]).find((x) => x?.alive && ['partner', 'spouse'].includes(x.role) && typeof x.flags?.abroad === 'string' && x.flags.abroad !== p.countryId);
    return n && techAvailable('video_call') && once(`distance:${n.id}:${store.state.year - (store.state.year % 4)}`) ? { id: 'digital_long_distance', key: `distance:${n.id}:${store.state.year - (store.state.year % 4)}`, cast: { partner: n.id } } : null;
  },
  // Decades later: the old posts.
  () => {
    const p = player();
    const old = Object.values(world().posts).filter((x) => x.authorId === p.id && !x.removed && store.state.year - x.year >= 25);
    return p.age >= 55 && old.length && once('oldPosts') ? { id: 'digital_old_posts', key: 'oldPosts', cast: { words: { years: String(store.state.year - Math.min(...old.map((x) => x.year))) } } } : null;
  },
  // A child's school photography project.
  () => {
    const p = player();
    const kid = p.npcIds.map((id) => store.state.npcs[id]).find((x) => x?.alive && x.role === 'child' && x.age >= 8 && x.age <= 16 && once(`kidproject:${x.id}`));
    return kid && accessFor('photo') ? { id: 'digital_child_project', key: `kidproject:${kid.id}`, cast: { kid: kid.id } } : null;
  },
];

/** Resolves a choice in a digital scene. Returns the note added to the outcome text. */
export function decide(value, cast) {
  const p = player();
  const [arc, choice] = value.split(':');
  if (arc === 'reconnect') {
    const n = charOf(cast.friend);
    if (!n?.alive) return 'But they are gone.';
    const mine = activeAccountsOf(p.id).find((acc) => PLATFORM_BY_ID[acc.platformId].type === 'personal');
    const theirs = mine ? accountOn(n.id, mine.platformId) : null;
    if (choice === 'message') {
      // The same person as before, back in the player's life, with their history intact.
      if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);
      n.role = 'friend';
      delete n.flags.drifted;
      n.meters.relationship = clamp(Math.max(n.meters.relationship, 30) + rng.int(10, 20));
      n.lastInteractionAge = p.age;
      if (mine && theirs) { follow(mine.id, theirs.id, { quiet: true }); follow(theirs.id, mine.id, { quiet: true }); }
      const t = threadWith(n.id);
      t.messages.push({ id: `${t.id}_r1`, from: p.id, year: store.state.year, age: p.age, text: 'Is this really you? It has been years!', channel: theirs ? `dm:${theirs.platformId}` : 'letter' });
      t.messages.push({ id: `${t.id}_r2`, from: n.id, year: store.state.year, age: p.age, text: `It is! I think about our old days all the time. We have to catch up properly.`, channel: theirs ? `dm:${theirs.platformId}` : 'letter' });
      t.lastYear = store.state.year;
      recordEvent({ kind: 'reconnection', charIds: [p.id, n.id], platformId: theirs?.platformId, ref: { type: 'npc', id: n.id }, summary: `You reconnected with ${n.firstName} ${n.lastName} after years apart.`, visibility: 'family', milestoneText: `Reconnected online with ${n.firstName}, an old friend.`, once: `reconnect_${n.id}` });
      return `${n.firstName} wrote back within the hour. It was as if no time had passed.`;
    }
    if (choice === 'follow') {
      if (mine && theirs) follow(mine.id, theirs.id);
      return `You follow ${n.firstName} now. Their life scrolls past now and then.`;
    }
    return '';
  }
  if (arc === 'video') {
    const plId = cast.words?.pl;
    if (choice === 'post') {
      let acc = accountOn(p.id, plId);
      if (!acc) {
        let h = cleanHandle(`${p.firstName}${p.lastName}`.toLowerCase()).replace(/[^a-z0-9_.]/g, '').slice(0, 16) || 'me';
        while (handleTaken(plId, h)) h = `${h.slice(0, 14)}${rng.int(10, 99)}`;
        const made = createAccount({ platformId: plId, handle: h, visibility: p.age < 16 ? 'private' : 'public' });
        if (!made.ok) return made.text;
        acc = made.account;
      }
      const topic = cast.words?.what === 'singing' ? 'singing' : cast.words?.what === 'dancing' ? 'dance' : 'music';
      const r = publish({ accountId: acc.id, format: PLATFORM_BY_ID[plId].formats.includes('long_video') ? 'long_video' : 'short_video', topic, text: `Me, ${cast.words?.what}. Be nice.` });
      return r.text;
    }
    p.stats.mood = clamp(p.stats.mood + 1);
    return '';
  }
  if (arc === 'ancestor') {
    const n = charOf(cast.ancestor);
    if (choice === 'watch') {
      recordEvent({ kind: 'legacy_viewed', charIds: [p.id, cast.ancestor], summary: `You spent an evening with ${n?.firstName ?? 'your ancestor'}'s old posts, and met someone you only half knew.`, visibility: 'family', once: `viewed_${cast.ancestor}` });
      p.stats.mood = clamp(p.stats.mood + 3);
      return 'You can find them again in Digital Life, under Digital History.';
    }
    return '';
  }
  const w = cast.words ?? {};
  if (arc === 'crossroads') {
    const acc = account(w.acc);
    if (!acc?.creator) return '';
    if (choice === 'fulltime') return goFullTime(acc.id).text;
    if (choice === 'step') { acc.creator.routine = null; acc.creator.paused = store.state.year; return 'The channel stays up. You will post when, and if, you want to.'; }
    return '';
  }
  if (arc === 'burnout') {
    if (choice === 'break') return takeBreak().text;
    if (choice === 'less') { for (const a of mine()) if (a.creator?.routine) a.creator.routine.perYear = Math.max(1, Math.floor(a.creator.routine.perYear / 2)); wellbeingOf().heavyYears = 0; return 'Your routines are halved.'; }
    p.stats.mood = clamp(p.stats.mood - 5); p.stats.health = clamp(p.stats.health - 2);
    return 'You are more tired than ever.';
  }
  if (arc === 'stepback') {
    const acc = account(w.acc);
    if (choice !== 'stop' || !acc?.creator) return '';
    acc.creator.routine = null;
    acc.creator.retired = store.state.year;
    if (p.career?.careerId === 'influencer') quitCareer();
    recordEvent({ kind: 'creator_retired', charIds: [p.id], platformId: acc.platformId, ref: { type: 'account', id: acc.id }, summary: `After ${store.state.year - acc.creator.since} years, you stopped making content for @${acc.handle}. The videos are still there.`, visibility: 'public', milestoneText: 'Stopped creating content professionally.', once: `retired_${acc.id}` });
    return '';
  }
  if (arc === 'viral') {
    if (choice === 'quiet') return setNotifications('off').text;
    if (choice === 'private') { for (const a of mine()) if (PLATFORM_BY_ID[a.platformId].privacy.includes('private')) a.visibility = 'private'; return 'Everything you post is for people you approve, for now.'; }
    p.stats.mood = clamp(p.stats.mood + (p.traits.includes('worrier') ? -1 : 3));
    return '';
  }
  if (arc === 'breakthrough') return choice === 'yes' ? acceptCollab(w.offer).text : declineOffer(w.offer).text;
  if (arc === 'recruiter') {
    if (choice === 'no' && p.flags.referrals?.[w.career] != null) delete p.flags.referrals[w.career];
    return '';
  }
  if (arc === 'moderate') return choice === 'yes' ? volunteerModerate(w.cid).text : '';
  if (arc === 'meetfriend') return choice === 'yes' ? meetInPerson(cast.friend).text : '';
  if (arc === 'distance') {
    const n = charOf(cast.partner);
    if (!n?.alive) return '';
    if (choice === 'calls') { n.meters.relationship = clamp(n.meters.relationship + 5); n.lastInteractionAge = p.age; return 'It is hard, and it is working.'; }
    if (choice === 'visit') {
      const cost = localMoney(1200, country());
      if (p.finance.cash < cost) return 'You could not afford the flight this year.';
      p.finance.cash -= cost; n.meters.relationship = clamp(n.meters.relationship + 10); n.lastInteractionAge = p.age;
      recordEvent({ kind: 'distance_visit', charIds: [p.id, n.id], summary: `You flew to see ${n.firstName}. A week together after months of screens.`, visibility: 'family' });
      return '';
    }
    n.meters.relationship = clamp(n.meters.relationship - 10);
    return '';
  }
  if (arc === 'oldposts') {
    const old = Object.values(world().posts).filter((x) => x.authorId === p.id && !x.removed && store.state.year - x.year >= 20 && ['photo', 'short_video', 'long_video'].includes(x.format));
    if (choice === 'share') for (const x of old) x.familyShared = true;
    recordEvent({ kind: 'old_posts', charIds: [p.id], summary: choice === 'share' ? `You shared ${old.length || 'some'} old photos and videos with the family. The grandchildren had questions about the clothes.` : 'You spent an evening with your own old posts.', visibility: 'family', once: `oldposts_${p.id}` });
    return '';
  }
  if (arc === 'kidproject') {
    const kid = charOf(cast.kid);
    if (!kid?.alive || choice !== 'help') return '';
    kid.meters.relationship = clamp(kid.meters.relationship + 6);
    kid.memories ??= [];
    if (!kid.memories.some((m) => m.key === 'photoProject')) kid.memories.push({ key: 'photoProject', text: 'You helped with their school photography project.', age: p.age });
    recordEvent({ kind: 'helped_child_project', charIds: [p.id, kid.id], summary: `You helped ${kid.firstName} with a school photography project.`, visibility: 'family', once: `kidproject_${kid.id}` });
    return '';
  }
  if (arc === 'cv') {
    const cv = openControversies()[0];
    return cv ? respond(cv.id, choice).text : '';
  }
  if (arc === 'safe') {
    const s = openSafety().find((x) => x.id === cast.words?.safety);
    return s ? handleSafety(s.id, choice).text : '';
  }
  return '';
}

export { result, techAvailable };
