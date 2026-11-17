// The Story Director's digital arcs. Each is found in saved state — a friend
// who drifted away years ago, a teenager who has been practising, an
// ancestor's old channel — and offered as an ordinary scene, at most one a
// year. The choices are resolved here, against the same engines the rest of
// Digital Life uses.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { PLATFORM_BY_ID } from '../../data/digital.js';
import { world, charOf, recordEvent, result } from './core.js';
import { platformOpen, accessFor, techAvailable } from './tech.js';
import { accountOn, activeAccountsOf, follow, createAccount, cleanHandle, handleTaken } from './accounts.js';
import { publish } from './content.js';
import { threadWith, npcUses } from './messaging.js';
import { joinPlatform } from './npc.js';
import { respond, openControversies, openSafety, handleSafety } from './reputation.js';
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
  const found = reconnectCandidate() ?? firstVideoCandidate() ?? ancestorCandidate();
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

/** A teenager who has been practising music, with a way to film it and somewhere to put it. */
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
