// Radio and television: the shared screens and speakers of the twentieth
// century, through the same technology registry as everything else. Evenings
// around the set with the household, the first set in the house, and the odd
// broadcast that everyone remembers where they were for.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player, log } from '../../state.js';
import { MONARCHIES } from '../../data/royalty.js';
import { world, acts, result, recordEvent } from './core.js';
import { techAvailable, devicesOf, householdHas } from './tech.js';

export const PROGRAMMES = {
  radio: [
    { id: 'news', label: 'The news and current affairs', effect: { intellect: 2 } },
    { id: 'music', label: 'Music programmes', effect: { music: 1, mood: 2 } },
    { id: 'drama', label: 'Radio plays and serials', effect: { acting: 1, mood: 2 } },
    { id: 'sport', label: 'Sport commentary', effect: { sports: 1, mood: 2 } },
    { id: 'children', label: 'Children\'s hour', effect: { mood: 3 }, maxAge: 12 },
  ],
  tv: [
    { id: 'news', label: 'The evening news', effect: { intellect: 2 } },
    { id: 'serial', label: 'The serial everyone is following', effect: { mood: 3 } },
    { id: 'documentary', label: 'Documentaries', effect: { intellect: 3 } },
    { id: 'sport', label: 'The big match', effect: { sports: 1, mood: 2 } },
    { id: 'variety', label: 'Variety shows and music', effect: { music: 1, dance: 1, mood: 2 } },
    { id: 'cartoons', label: 'Cartoons', effect: { mood: 3 }, maxAge: 12 },
  ],
};
const KIND = { radio: { tech: 'radio', device: 'radio_set', name: 'radio', verb: 'listened to' }, tv: { tech: 'television', device: 'tv_set', name: 'television', verb: 'watched' } };

/** The people the player lives with, who gather round the set too. */
function household() {
  const p = player();
  return p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role !== 'pet' && !n.flags?.abroad && (
    ['spouse'].includes(n.role) || (n.role === 'child' && n.age < 18) || (p.flags.livesWithParents && ['parent', 'sibling'].includes(n.role))));
}

/** Where the player can listen or watch: their own set, the family's, or someone else's. */
export function setFor(kind) {
  const k = KIND[kind];
  if (!techAvailable(k.tech)) return null;
  if (devicesOf(player().id).some((d) => d.type === k.device)) return 'own';
  if (householdHas(k.device)) return 'home';
  return 'elsewhere'; // a neighbour's, a café, the window of a shop
}

/** The radio and television activities open this year. */
export function broadcastOptions() {
  const p = player();
  if (p.legal?.incarceration || p.age < 3) return [];
  return ['radio', 'tv'].filter((k) => setFor(k)).map((k) => ({
    id: k, label: k === 'radio' ? (setFor(k) === 'elsewhere' ? 'Listen to the radio at a neighbour\'s' : 'Listen to the radio') : (setFor(k) === 'elsewhere' ? 'Watch television somewhere that has one' : 'Watch television'),
    done: !!acts()[`bc:${k}`], programmes: PROGRAMMES[k].filter((x) => !x.maxAge || p.age <= x.maxAge),
  }));
}

/** A year of evenings with the radio or the television. With others at home, it brings the household closer. */
export function tuneIn(kind, programmeId) {
  const p = player();
  const k = KIND[kind];
  const opt = broadcastOptions().find((o) => o.id === kind);
  if (!opt) return result(false, `There is no ${k.name} here yet.`);
  if (opt.done) return result(false, `You have already spent the year's evenings with the ${k.name}.`);
  const prog = opt.programmes.find((x) => x.id === programmeId) ?? opt.programmes[0];
  acts()[`bc:${kind}`] = true;
  const e = prog.effect;
  if (e.intellect) p.stats.intellect = clamp(p.stats.intellect + e.intellect);
  if (e.mood) p.stats.mood = clamp(p.stats.mood + e.mood);
  for (const t of ['music', 'acting', 'sports', 'dance']) if (e[t]) p.talents[t] = clamp((p.talents[t] ?? 0) + e[t]);
  const where = setFor(kind);
  const people = where === 'elsewhere' ? [] : household();
  for (const n of people) { n.meters.relationship = clamp(n.meters.relationship + rng.int(2, 4)); n.lastInteractionAge = p.age; }
  const with_ = people.length ? `, ${people.length === 1 ? `with ${people[0].firstName}` : 'with the household gathered round'}` : where === 'elsewhere' ? ', crowded in with the neighbours' : ', on your own';
  const text = `You ${k.verb} ${prog.label.charAt(0).toLowerCase()}${prog.label.slice(1)} through the year${with_}.`;
  log(text, 'system', 'good');
  return result(true, text, 'good');
}

/** Moments people remembered for the rest of their lives: generic to the country, never about anyone real. */
const BROADCASTS = [
  { id: 'space', tech: 'television', from: 1960, text: 'the first live pictures from space' },
  { id: 'final', tech: 'radio', from: 1925, text: 'the cup final that went to extra time' },
  { id: 'election', tech: 'radio', from: 1925, text: 'the election-night count, into the small hours' },
  { id: 'storm', tech: 'radio', from: 1925, text: 'the bulletins through the night of the great storm' },
  { id: 'coronation', tech: 'television', from: 1950, text: 'the coronation, on a set borrowed for the day', monarchy: true },
  { id: 'peace', tech: 'radio', from: 1925, text: 'the announcement that the fighting was over' },
  { id: 'olympics', tech: 'television', from: 1956, text: 'the night the country won gold' },
];

/**
 * The year in broadcasting: the first set coming into the house, and now and
 * then a broadcast that everyone who heard it remembers.
 */
export function tickBroadcast() {
  const p = player();
  const d = world();
  for (const kind of ['radio', 'tv']) {
    const k = KIND[kind];
    const where = setFor(kind);
    if ((where === 'own' || where === 'home') && p.age >= 4) {
      recordEvent({ kind: `first_${kind}`, charIds: [p.id, ...household().map((n) => n.id)], summary: kind === 'radio' ? 'The first radio came into the house. Everyone sat closer to it than they needed to.' : 'A television arrived at home. For a week nobody could talk about anything else.', visibility: 'family', once: `first_${kind}_${p.id}`, milestoneText: kind === 'radio' ? 'The first radio in the house.' : 'The first television in the house.' });
    }
  }
  if (p.age < 5 || !rng.chance(0.12)) return;
  const monarchy = !!MONARCHIES[p.countryId];
  const seen = new Set(d.events.filter((e) => e.kind === 'broadcast').map((e) => e.ref?.id));
  const pool = BROADCASTS.filter((b) => techAvailable(b.tech) && store.state.year >= b.from && !seen.has(b.id) && (!b.monarchy || monarchy));
  if (!pool.length) return;
  const b = rng.pick(pool);
  const people = household();
  for (const n of people) {
    n.memories ??= [];
    if (!n.memories.some((m) => m.key === `broadcast_${b.id}`)) n.memories.push({ key: `broadcast_${b.id}`, text: `You listened to ${b.text} together.`.replace('listened to', b.tech === 'television' ? 'watched' : 'listened to'), age: p.age });
  }
  recordEvent({ kind: 'broadcast', charIds: [p.id, ...people.map((n) => n.id)], ref: { type: 'broadcast', id: b.id }, summary: `Everyone remembers where they were for ${b.text}. You were ${people.length ? 'at home, with your family' : 'with whoever was nearest'}.`, visibility: 'family', tone: 'neutral' });
}
