// Keeping a will in step with the people it names (engine/death.js keeps the will itself). When somebody named in it
// dies, the player is told once and asked whether to look at it again; nothing in the will is rewritten for them. A
// will may name an alternate for a beneficiary, who takes that share only if the beneficiary has died first. And the
// person the player means to carry on as (the playable heir) is a separate choice from who inherits what: if that
// person dies first, the player is told that too, and nobody is chosen in their place.
//
//   p.flags.will.alternates = { [beneficiary npc id]: alternate npc id }
//   p.flags.chosenHeir = npc id | null
//   p.flags.estate = { notices: [{ id, kind: 'beneficiary'|'heir'|'review', npcId?, reasons?, year, status: 'pending'|'later'|'done' }],
//                      seen: { kids, spouseId, homes } }   what the last look at the family found, to notice changes by
import { store, player, log } from '../state.js';
import { heirs as playable } from './legacy.js';
import { willCandidates, canWriteWill } from './death.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const npcOf = (id) => store.state.npcs[id];
const E = () => (player().flags.estate ??= { notices: [], seen: null });
const rawWill = () => { const w = player().flags.will; return w && typeof w === 'object' ? w : null; };
const name = (n) => (n ? `${n.firstName} ${n.lastName}` : 'someone');

// ---------- Alternates ----------

export const alternateOf = (npcId) => rawWill()?.alternates?.[npcId] ?? null;
/** Names (or with `altId` null, removes) the person who takes a beneficiary's place if they die first. */
export function setAlternate(npcId, altId) {
  const w = rawWill();
  if (!canWriteWill() || !w || !(w.heirs ?? []).includes(npcId) && !Object.values(w.items ?? {}).includes(npcId)) return result(false, 'They are not named in your will.', 'neutral');
  if (altId == null) { if (w.alternates) delete w.alternates[npcId]; return result(true, 'No alternate is named for them now.', 'neutral'); }
  if (altId === npcId || !willCandidates().some((n) => n.id === altId)) return result(false, 'You cannot name them as the alternate.', 'neutral');
  (w.alternates ??= {})[npcId] = altId;
  const text = `If ${npcOf(npcId).firstName} dies before you, ${npcOf(altId).firstName} takes their place in your will.`;
  log(text);
  return result(true, text, 'neutral');
}

// ---------- The playable heir ----------

/** Who the player has said they mean to carry on as, if they are still alive and could be. */
export function chosenHeir() {
  const id = player().flags.chosenHeir;
  const n = id ? npcOf(id) : null;
  return n?.alive && playable().some((h) => h.id === id) ? n : null;
}
/** Chooses who to carry on as, one day. Nothing to do with who inherits. */
export function chooseHeir(npcId) {
  if (npcId == null) { player().flags.chosenHeir = null; return result(true, 'You have chosen nobody to carry on as. You will be asked when the time comes.', 'neutral'); }
  if (!playable().some((h) => h.id === npcId)) return result(false, 'You could not carry on as them.', 'neutral');
  player().flags.chosenHeir = npcId;
  const text = `When your time comes, you mean to carry on as ${npcOf(npcId).firstName}. What they inherit is a matter for your will.`;
  log(text);
  return result(true, text, 'neutral');
}

// ---------- Notices ----------

export const notices = () => E().notices.filter((n) => n.status !== 'done');
const had = (kind, npcId) => E().notices.some((n) => n.kind === kind && n.npcId === npcId);
function add(n) { const e = E(); const x = { id: `est${e.notices.length + 1}`, year: store.state.year, status: 'pending', ...n }; e.notices.push(x); return x; }
/** Reviewed, or put off. Put off, it stays on the list and is not raised again by itself. */
export function resolveNotice(id, how) {
  const n = E().notices.find((x) => x.id === id);
  if (!n) return result(false, 'That has been dealt with.', 'neutral');
  n.status = how === 'later' ? 'later' : 'done';
  return result(true, how === 'later' ? 'It will keep. It is on your list.' : 'Noted as reviewed.', 'neutral');
}

/**
 * Once a year, whatever the length of a turn: anybody named in the will (to inherit, for a particular thing, or as an
 * alternate) who has died gets one notice, ever; so does the chosen heir. A change in the family that a will ought to
 * take account of (a child born, a marriage, a marriage ended, a home bought) raises one review notice, not one each,
 * and not while one is still waiting.
 */
export function tickEstate() {
  const p = player();
  if (p.age < 18) return;
  const w = rawWill();
  const queue = (id, cast) => store.state.pendingEvents.push({ id, cast });
  if (w) {
    const named = new Set([...(w.heirs ?? []), ...Object.values(w.items ?? {}), ...Object.values(w.alternates ?? {})]);
    for (const id of named) {
      const n = npcOf(id);
      if (!n || n.alive || had('beneficiary', id)) continue;
      const alt = npcOf(alternateOf(id));
      add({ kind: 'beneficiary', npcId: id, alternateId: alt?.alive ? alt.id : null });
      // (Named in words, not as a cast member: a scene whose cast has died is dropped before it is shown.)
      queue('will_beneficiary_died', { words: { gone: name(n), goneId: id, alt: alt?.alive ? `Your will names ${name(alt)} in their place.` : 'Your will names nobody in their place: as it stands, their share goes to the others named, or to the family.' } });
    }
  }
  const chosen = p.flags.chosenHeir ? npcOf(p.flags.chosenHeir) : null;
  if (chosen && !chosen.alive && !had('heir', chosen.id)) {
    add({ kind: 'heir', npcId: chosen.id });
    queue('heir_died', { words: { gone: name(chosen), goneId: chosen.id } });
  }
  // The family, as it is now against how it was when last looked at.
  const kids = Object.values(store.state.npcs).filter((n) => n.role === 'child' && p.npcIds.includes(n.id)).length;
  const spouseId = Object.values(store.state.npcs).find((n) => n.role === 'spouse' && n.alive && p.npcIds.includes(n.id))?.id ?? null;
  const homes = p.assets.filter((a) => a.kind === 'property').length;
  const e = E();
  const was = e.seen;
  e.seen = { kids, spouseId, homes };
  if (!was || !w) return;
  const reasons = [];
  if (kids > was.kids) reasons.push('a child was born');
  if (spouseId && spouseId !== was.spouseId) reasons.push('you married');
  if (!spouseId && was.spouseId) reasons.push(npcOf(was.spouseId)?.alive ? 'your marriage ended' : 'your spouse died');
  if (homes > was.homes) reasons.push('you bought property');
  if (!reasons.length) return;
  const open = e.notices.find((n) => n.kind === 'review' && n.status !== 'done');
  if (open) { open.reasons = [...new Set([...open.reasons, ...reasons])]; return; }
  add({ kind: 'review', reasons });
  queue('will_review', { words: { why: reasons.join(', and ') } });
}

/** A choice in one of the scenes (data/events/stories/estate.js). */
export function estateChoice(value, cast) {
  const [kind, how] = value.split(':');
  const n = [...E().notices].reverse().find((x) => x.kind === kind && x.status === 'pending' && (!cast.words?.goneId || x.npcId === cast.words.goneId));
  if (!n) return '';
  n.status = how === 'later' ? 'later' : 'review';
  if (how === 'later') return 'It stays as it is, and stays on your list.';
  return kind === 'heir' ? 'You can choose who to carry on as under Holdings, in your will.' : 'Your will is as you left it until you change it: you can do that under Holdings.';
}
