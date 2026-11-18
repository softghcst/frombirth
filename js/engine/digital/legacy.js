// Digital legacy: what happens to someone's accounts when they die, how the
// digital world passes to the next generation along with the rest of the
// family's story, and what descendants are allowed to see.
//
// The rule, the same as the Life Story's: public things stay public, things
// shared with the family stay with the family, and private messages stay
// private — after death as before it.
import { store } from '../../state.js';
import { world, recordEvent, charOf } from './core.js';
import { accountsOf, canSee } from './accounts.js';

/** At death: accounts become memorials (no new activity), plans and deals end, history is kept whole. */
export function onDeath(state = store.state) {
  const d = state.digital;
  if (!d) return;
  const p = state.player;
  for (const acc of Object.values(d.accounts)) {
    if (acc.ownerId !== p.id) continue;
    if (acc.status === 'active' || acc.status === 'deactivated') { acc.status = 'memorial'; acc.memorialYear = state.year; }
  }
  for (const s of d.streams) if (s.ownerId === p.id && s.status === 'scheduled') s.status = 'cancelled';
  for (const c of Object.values(d.contracts)) if (c.ownerId === p.id && ['offered', 'negotiating', 'active'].includes(c.status)) c.status = 'ended';
  for (const x of Object.values(d.projects)) if (x.ownerId === p.id && !['published', 'archived'].includes(x.status)) x.unfinished = true;
}

/** Every reference to a character id inside the digital world, rewritten. */
function remap(d, from, to) {
  if (!from || !to || from === to) return;
  const swap = (id) => (id === from ? to : id);
  for (const a of Object.values(d.accounts)) { a.ownerId = swap(a.ownerId); a.guardianId = swap(a.guardianId); }
  for (const x of Object.values(d.posts)) { x.authorId = swap(x.authorId); x.aboutIds = (x.aboutIds ?? []).map(swap); x.likedBy = (x.likedBy ?? []).map(swap); for (const c of x.comments) c.authorId = swap(c.authorId); if (x.source?.npcId) x.source.npcId = swap(x.source.npcId); }
  for (const t of Object.values(d.threads)) { t.participants = t.participants.map(swap); t.ownerId = swap(t.ownerId); t.admins = (t.admins ?? []).map(swap); t.left = (t.left ?? []).map(swap); for (const m of t.messages) m.from = swap(m.from); }
  for (const e of d.events) { e.charIds = e.charIds.map(swap); e.ownerId = swap(e.ownerId); }
  for (const m of d.memberships) m.charId = swap(m.charId);
  for (const c of Object.values(d.communities)) { c.keyMembers = c.keyMembers.map(swap); c.moderators = c.moderators.map(swap); }
  for (const x of Object.values(d.projects)) { x.ownerId = swap(x.ownerId); x.collaborators = x.collaborators.map(swap); }
  for (const s of d.streams) { s.ownerId = swap(s.ownerId); s.collaborators = s.collaborators.map(swap); }
  for (const c of Object.values(d.contracts)) c.ownerId = swap(c.ownerId);
  for (const c of Object.values(d.controversies)) c.charId = swap(c.charId);
  for (const s of d.safety) if (s.charId) s.charId = swap(s.charId);
  for (const o of d.offers) o.fromId = swap(o.fromId);
  for (const m of d.matches) m.npcId = swap(m.npcId);
  for (const dev of d.devices) dev.ownerId = swap(dev.ownerId);
  for (const key of ['reputation', 'wellbeing']) if (d[key][from]) { d[key][to] = d[key][from]; delete d[key][from]; }
}

/** Ids of every person the digital world refers to. */
function referenced(d) {
  const ids = new Set();
  for (const a of Object.values(d.accounts)) ids.add(a.ownerId);
  for (const t of Object.values(d.threads)) t.participants.forEach((id) => ids.add(id));
  for (const e of d.events) e.charIds.forEach((id) => ids.add(id));
  for (const c of Object.values(d.communities)) c.keyMembers.forEach((id) => ids.add(id));
  for (const x of Object.values(d.posts)) for (const c of x.comments) if (c.authorId) ids.add(c.authorId);
  return ids;
}

/**
 * Carries the digital world into the heir's game. Called by legacy.continueAs
 * after it has built the new state. The dead player's accounts, posts and
 * memories now belong to their ancestor record; the heir's own accounts (if
 * they had any as an NPC) become the player's. People the archive refers to
 * are kept, so every portrait still opens a real person.
 * @param {object} old   the finished life's state
 * @param {object} next  the heir's new state
 * @param {string} heirNpcId  the heir's id as an NPC in the old state
 * @param {string} ancestorId  the dead player's id as an NPC in the new state
 */
export function carryOver(old, next, heirNpcId, ancestorId) {
  const d = old.digital;
  if (!d) return;
  next.digital = d;
  onDeath(old);
  const op = old.player;
  remap(d, op.id, ancestorId);
  remap(d, heirNpcId, next.player.id);
  // Devices do not pass down; the heir owns what they owned as themselves.
  d.devices = d.devices.filter((x) => x.ownerId === next.player.id);
  // Private conversations of the dead are sealed. They still exist, and are counted, but nobody reads them.
  for (const t of Object.values(d.threads)) {
    if (t.participants.includes(ancestorId) && !t.participants.includes(next.player.id)) t.sealed = true;
  }
  d.archive.ancestors.push({
    id: ancestorId, name: `${op.firstName} ${op.lastName}`, born: op.birthYear, died: old.year, generation: op.generation ?? 1,
    accounts: Object.values(d.accounts).filter((a) => a.ownerId === ancestorId).map((a) => a.id),
    milestones: op.milestones.map((m) => ({ ...m })), heirId: next.player.id,
  });
  // Everyone the archive mentions stays a real, openable person.
  for (const id of referenced(d)) {
    if (next.npcs[id] || id === next.player.id) continue;
    const n = old.npcs[id];
    if (n) { next.npcs[id] = n; n.flags = { ...n.flags, archived: true }; }
  }
  d.time = { year: null, used: 0 };
  d.acts = { year: null };
  d.matches = d.matches.filter((m) => m.stage === 'dating');
  d.offers = [];
}

/** The ancestors whose digital lives are in the family archive, most recent first. */
export const ancestors = () => [...(world().archive?.ancestors ?? [])].reverse();

/**
 * What the player may see of an ancestor's digital life: public posts and
 * things shared with the family; never their private messages or accounts
 * that were never public. Sealed conversations are counted, not opened.
 */
export function archiveOf(ancestorId) {
  const d = world();
  const entry = d.archive.ancestors.find((a) => a.id === ancestorId);
  if (!entry) return null;
  const accounts = Object.values(d.accounts).filter((a) => a.ownerId === ancestorId && a.status !== 'deleted');
  const shown = accounts.filter((a) => a.visibility === 'public' || Object.values(d.posts).some((x) => x.accountId === a.id && x.familyShared));
  const posts = Object.values(d.posts).filter((x) => x.authorId === ancestorId && canSee(store.state.player.id, x, { archive: 'family' }))
    .sort((a, b) => a.year - b.year);
  const memories = d.events.filter((e) => e.charIds.includes(ancestorId) && e.visibility !== 'private');
  const sealed = Object.values(d.threads).filter((t) => t.sealed && t.participants.includes(ancestorId)).length;
  const hiddenAccounts = accounts.length - shown.length;
  const projects = Object.values(d.projects).filter((x) => x.ownerId === ancestorId && x.status === 'published' && d.posts[x.postId] && canSee(store.state.player.id, d.posts[x.postId], { archive: 'family' }));
  const communities = d.memberships.filter((m) => m.charId === ancestorId).map((m) => ({ m, c: d.communities[m.communityId] })).filter((x) => x.c);
  return { entry, person: charOf(ancestorId), accounts: shown, posts, memories, sealed, hiddenAccounts, projects, communities };
}

/** An heir's choice about an ancestor's memorial account. The account's history is kept either way. */
export function memorialChoice(accountId, choice) {
  const acc = world().accounts[accountId];
  if (!acc || acc.status !== 'memorial') return { ok: false, text: 'That is not a memorial account.', tone: 'neutral' };
  if (!world().archive.ancestors.some((a) => a.id === acc.ownerId)) return { ok: false, text: 'Only family can decide that.', tone: 'neutral' };
  acc.memorial = { choice, by: store.state.player.id, year: store.state.year };
  if (choice === 'close') acc.visibility = 'private';
  const who = charOf(acc.ownerId);
  recordEvent({ kind: 'memorial', charIds: [store.state.player.id, acc.ownerId], platformId: acc.platformId, summary: choice === 'close' ? `You closed ${who?.firstName ?? 'your relative'}'s old account to the public. The family still has it.` : `You kept ${who?.firstName ?? 'your relative'}'s account up as a memorial, for anyone who wants to remember.`, visibility: 'family', once: `memorial_${acc.id}`, tone: 'neutral' });
  return { ok: true, text: 'Done.', tone: 'good' };
}

export { accountsOf };
