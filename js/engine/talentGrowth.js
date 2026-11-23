// A talent is two things: the gift someone is born with (p.potential, hidden, inherited from both parents) and how good
// they are at it now (p.talents, what the bars show). Everyone starts low, a baby in single figures whatever their
// gift; the years bring a talent on by themselves, toward about half of the gift by adulthood, and lessons, clubs,
// training and work take it the rest of the way. A gift is not known at first: it shows itself, a hint and then for
// certain, sooner for a child who tries the thing they are good at.
//   p.potential = { music, sports, ... }        p.flags.found = { [talent]: 'hint' | 'known' }
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log, milestone } from '../state.js';
import { TALENTS, TALENT_BY_ID } from '../data/talents.js';

/** How much of a gift shows by this age with no particular effort. */
export function maturity(age) {
  const pts = [[0, 0.06], [3, 0.14], [6, 0.24], [10, 0.34], [14, 0.44], [18, 0.52], [22, 0.56]];
  if (age >= 22) return 0.56;
  for (let i = 1; i < pts.length; i++) if (age <= pts[i][0]) { const [a0, m0] = pts[i - 1]; const [a1, m1] = pts[i]; return m0 + (m1 - m0) * (age - a0) / (a1 - a0); }
  return 0.56;
}

/** Where someone of this age with these gifts would be, with no practice to speak of. */
export function startTalents(potential, age) {
  const out = {};
  for (const [k, v] of Object.entries(potential)) out[k] = Math.round(clamp(v * maturity(age) + rng.int(0, 3)));
  return out;
}

/** The gift, for systems that need what someone could become rather than what they are now (a sport's ceiling, how fast a skill comes). */
export const gift = (p, key) => (p.potential?.[key] ?? p.talents?.[key] ?? 0);
/** Gifts of note (65 and up): what a natural at something is a natural at. */
export const giftsOf = (p) => Object.entries(p.potential ?? p.talents ?? {}).filter(([, v]) => v >= 65).map(([k]) => k);

/** An older save has only one number per talent: it becomes the gift too, and nothing the player has is lowered. */
export function ensurePotential(p = player()) {
  if (p.potential) { for (const k of Object.keys(p.talents)) p.potential[k] ??= p.talents[k]; return p.potential; }
  p.potential = { ...p.talents };
  return p.potential;
}

/** How a gift feels before it is known. */
const HINT = { music: 'musically inclined', sports: 'athletically inclined', acting: 'drawn to performing', singing: 'that singing comes easily to you',
  dance: 'a feel for rhythm in you', art: 'artistically inclined', writing: 'that you have a way with words', tech: 'good with machines and gadgets',
  science: 'that numbers and how things work make sense to you' };

/**
 * Once a year: each talent comes on toward where the years alone would bring it (never down), and a gift not yet known
 * may show itself, at most one a year: first a hint, later for certain. Trying the thing helps it show.
 */
export function tickTalents(p = player()) {
  const pot = ensurePotential(p);
  const found = (p.flags.found ??= {});
  const practiced = {};
  for (const [k, g] of Object.entries(pot)) {
    const natural = g * maturity(p.age);
    const now = p.talents[k] ?? 0;
    practiced[k] = now > natural + 3;
    if (now < natural) p.talents[k] = Math.round(clamp(now + Math.max(1, (natural - now) * 0.4)));
  }
  if (p.age < 3 || p.age > 40) return;
  const candidates = TALENTS.filter((t) => !t.hidden && (pot[t.id] ?? 0) >= 65 && found[t.id] !== 'known');
  for (const t of candidates.map((x) => [rng.next(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x)) {
    const stage = found[t.id];
    const chance = (stage ? 0.3 : 0.12) + (practiced[t.id] ? 0.3 : 0) + (p.age >= 18 ? 0.1 : 0);
    if (!rng.chance(chance)) continue;
    if (!stage) { found[t.id] = 'hint'; log(`You feel slightly more ${HINT[t.id] ?? `inclined toward ${t.name.toLowerCase()}`}.`, 'system', 'good'); }
    else { found[t.id] = 'known'; log(`It is clear now: you have a natural gift for ${t.name.toLowerCase()}.`, 'system', 'good'); milestone(`Found a natural gift for ${t.name.toLowerCase()}.`, 'life'); }
    return;
  }
}

/** For the Talents screen: what the player has noticed about themselves. */
export function noticed(p = player()) {
  const found = p.flags.found ?? {};
  return Object.entries(found).map(([id, stage]) => ({ id, name: TALENT_BY_ID[id]?.name ?? id, stage,
    text: stage === 'known' ? `A natural gift for ${(TALENT_BY_ID[id]?.name ?? id).toLowerCase()}` : `You feel ${HINT[id] ?? 'inclined toward it'}` }));
}
