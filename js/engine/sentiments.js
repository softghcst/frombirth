// Sentiments: what the player feels about a particular person, and why (data/sentiments.js). Grateful to the aunt
// who sent money the year everything went wrong; hurt by the friend who did not come to the wedding; betrayed by a
// partner who cheated. Each has a strength that fades a little every year (faster for a forgiving person), and while
// it lasts it changes how fast closeness drifts and how an argument goes. A hard feeling can be talked through:
// "Clear the air", once a year.
//
//   npc.sentiments = [{ kind, why, strength, peak, since }]   at most MOST_PER_PERSON, strongest kept
import { store, player, log } from '../state.js';
import { rng } from '../rng.js';
import { SENTIMENTS, MOST_PER_PERSON, FROM_MEMORY } from '../data/sentiments.js';
import { traitK } from './traits.js';

const clamp = (n) => Math.max(0, Math.min(100, n));
export const sentimentsOf = (npc) => (npc?.sentiments ?? []).filter((s) => s.strength > 0 && SENTIMENTS[s.kind]);
/** The strongest feeling about someone, for their profile, or null. */
export const strongest = (npc) => [...sentimentsOf(npc)].sort((a, b) => b.strength - a.strength)[0] ?? null;
export const hasSentiment = (npc, kind) => sentimentsOf(npc).some((s) => s.kind === kind);
const hard = (s) => SENTIMENTS[s.kind]?.tone === 'bad';

/**
 * The player comes to feel something about someone. The same feeling again is renewed (never weakened); a new one
 * beyond the limit pushes out the weakest.
 */
export function feel(npc, kind, why, strength = 60) {
  if (!npc || npc.role === 'pet' || !SENTIMENTS[kind] || npc.id === player()?.id) return null;
  const list = (npc.sentiments ??= []);
  const had = list.find((s) => s.kind === kind);
  if (had) { had.strength = Math.max(had.strength, clamp(strength)); had.peak = Math.max(had.peak ?? 0, had.strength); had.why = why; had.since = store.state.year; return had; }
  const s = { kind, why, strength: clamp(strength), peak: clamp(strength), since: store.state.year };
  list.push(s);
  list.sort((a, b) => b.strength - a.strength);
  if (list.length > MOST_PER_PERSON) list.length = MOST_PER_PERSON;
  return s;
}
/** Lets a feeling go, now. */
export function letGo(npc, kind) {
  if (npc?.sentiments) npc.sentiments = npc.sentiments.filter((s) => s.kind !== kind);
}

/** Called whenever someone remembers something about the player (engine/conditions.js): some of it leaves a feeling too. */
export function fromMemory(npc, key) {
  const f = FROM_MEMORY[key];
  if (f) feel(npc, f[0], f[2], f[1]);
}

/** How fast closeness to someone drifts, given the feelings about them (1: as usual). */
export const decayK = (npc) => sentimentsOf(npc).reduce((k, s) => k * (s.strength >= 25 ? SENTIMENTS[s.kind].decayK ?? 1 : 1), 1);
/** How much an argument with someone costs, given the feelings about them. */
export const argueK = (npc) => sentimentsOf(npc).reduce((k, s) => k * (SENTIMENTS[s.kind].argueK ?? 1), 1);

/** The line for their profile: "Hurt: they did not come to your wedding (3 years ago)". Short, one line. */
export function profileLine(npc) {
  const s = strongest(npc);
  if (!s) return '';
  const ago = store.state.year - s.since;
  return `${SENTIMENTS[s.kind].name}: ${s.why}${ago >= 1 ? ` (${ago === 1 ? 'a year' : `${ago} years`} ago)` : ''}`;
}
export const toneOf = (s) => SENTIMENTS[s?.kind]?.tone ?? 'neutral';

/** Once a year: every feeling fades a little; someone forgiving lets go a third faster. Hard ones that fade are told. */
export function tickSentiments() {
  const p = player();
  if (!p?.alive) return;
  const gone = [];
  for (const id of p.npcIds) {
    const npc = store.state.npcs[id];
    if (!npc?.sentiments?.length) continue;
    if (!npc.alive) { npc.sentiments = []; continue; }
    const forgiving = (npc.flags?.heart?.forgiving ?? 50) >= 65 ? 4 / 3 : 1;
    for (const s of npc.sentiments) {
      s.strength = Math.max(0, Math.round(s.strength - (SENTIMENTS[s.kind]?.fade ?? 8) * forgiving));
      if (!s.strength && hard(s) && (s.peak ?? 0) >= 40) gone.push(npc.firstName); // only something that mattered is told
    }
    npc.sentiments = npc.sentiments.filter((s) => s.strength > 0);
  }
  if (gone.length) log(`Time did its work: whatever was between you and ${gone.length === 1 ? gone[0] : `${gone.slice(0, -1).join(', ')} and ${gone.at(-1)}`} has faded.`, 'system', 'neutral');
}

/** Whether there is something to talk through with someone. */
export const canClearAir = (npc) => sentimentsOf(npc).some(hard);

/**
 * Talks a hard feeling through. It may go well (the feeling goes, and they come closer) or not (it is raw again). A
 * hothead finds it harder; a gentle soul, and someone close, easier. Betrayal is the hardest of all.
 * @returns {{ ok:boolean, text:string, tone:string }}
 */
export function clearTheAir(npc) {
  const p = player();
  const s = [...sentimentsOf(npc)].filter(hard).sort((a, b) => b.strength - a.strength)[0];
  if (!s) return { ok: false, text: 'There is nothing between you to clear.', tone: 'neutral' };
  const chance = Math.max(0.1, Math.min(0.85, 0.4 + (npc.meters.relationship - 50) / 150 + (p.stats.charm - 50) / 300
    - (traitK('argueK', p) - 1) + (p.traits?.includes('gentle') ? 0.1 : 0) - (s.kind === 'betrayed' ? 0.15 : 0) - s.strength / 400));
  const name = npc.firstName;
  if (rng.chance(chance)) {
    letGo(npc, s.kind);
    npc.meters.relationship = clamp(npc.meters.relationship + 6);
    const text = s.kind === 'guilty' ? `You told ${name} you were sorry, properly this time. They heard it. It is lighter now.`
      : `You and ${name} talked it through: ${s.why}. It took a while, and some of it was hard to hear. It is behind you now.`;
    return { ok: true, text, tone: 'good' };
  }
  s.strength = clamp(s.strength + 10);
  npc.meters.relationship = clamp(npc.meters.relationship - 4);
  return { ok: true, text: `You tried to talk to ${name} about it. It came out wrong, and now it is raw again.`, tone: 'bad' };
}
