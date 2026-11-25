// Hereditary health: genomes, predisposition, and what is present at birth.
//
// Four things are kept apart, as the design asks:
//   1. the genome (what was inherited)              person.genome
//   2. predisposition (a likelihood, never a fate)  liability() and hazardMultiplier()
//   3. onset (whether and when a condition begins)  engine/health/course.js
//   4. diagnosis (whether anyone recognizes it)     engine/health/care.js
//
// All genetic randomness is seeded from the person's own id, so a genome is the
// same every time it is worked out, before or after a reload. Inheritance
// follows biological parents only: adoption, fostering and step-families shape
// upbringing and support, never genes.
import { store, player } from '../../state.js';
import { CONDITIONS, CONDITION_BY_ID } from '../../data/health/conditions.js';
import { GENES, CLUSTERS } from '../../data/health/genetics.js';
import { seeded, probit } from './util.js';

const HERITABLE = CONDITIONS.filter((c) => c.heredity);
const SQRT_HALF = Math.SQRT1_2;

const sexOf = (person) => (person?.flags?.bornAs ?? person?.gender) === 'male' ? 'male' : (person?.flags?.bornAs ?? person?.gender) === 'female' ? 'female' : (person?.gender === 'male' ? 'male' : 'female');

/** A genome for someone whose parents the game does not know. Same id, same genome. */
export function founderGenome(id, sex) {
  const r = seeded('founder', id);
  const g = {};
  for (const k of Object.keys(CLUSTERS)) g[k] = r.normal();
  for (const c of HERITABLE) g[c.id] = r.normal();
  const a = {};
  for (const [key, gene] of Object.entries(GENES)) {
    if (gene.pattern === 'mito') continue;
    const copies = gene.pattern === 'x' && sex === 'male' ? 1 : 2;
    a[key] = Array.from({ length: copies }, () => (r.chance(gene.freq) ? 1 : 0));
  }
  const mt = {};
  for (const [key, gene] of Object.entries(GENES)) if (gene.pattern === 'mito') mt[key] = r.chance(gene.freq) ? 1 : 0;
  return { v: 1, sex, g, a, mt, founder: true };
}

/**
 * A child's genome from two biological parents' genomes. Either parent may be
 * missing (unknown): a stand-in founder takes their place.
 */
export function childGenome(mother, father, childId, sex) {
  const r = seeded('child', childId);
  const m = mother ?? founderGenome(`${childId}:m`, 'female');
  const f = father ?? founderGenome(`${childId}:f`, 'male');
  const g = {};
  // Polygenic values: the parents' average, plus the half that each child draws afresh.
  for (const k of Object.keys(m.g)) g[k] = ((m.g[k] ?? 0) + (f.g[k] ?? 0)) / 2 + r.normal() * SQRT_HALF;
  const a = {};
  for (const [key, gene] of Object.entries(GENES)) {
    if (gene.pattern === 'mito') continue;
    const fromMother = r.pick(m.a[key] ?? [0, 0]);
    if (gene.pattern === 'x') {
      // A son's only X comes from his mother; a daughter gets her father's X as well.
      a[key] = sex === 'male' ? [fromMother] : [fromMother, (f.a[key] ?? [0])[0]];
    } else {
      a[key] = [fromMother, r.pick(f.a[key] ?? [0, 0])];
    }
    // New variants: rare, and mostly in dominant conditions such as achondroplasia.
    if (gene.denovo && r.chance(gene.denovo)) a[key][0] = 1;
  }
  const mt = {};
  for (const key of Object.keys(m.mt ?? {})) mt[key] = m.mt[key]; // mitochondria come from the mother
  return { v: 1, sex, g, a, mt };
}

/** The biological parents of the player or an NPC, as people (not genomes), where known. */
export function biologicalParents(person) {
  const state = store.state;
  const p = player();
  if (person === p || person?.id === p.id) {
    const parents = p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.role === 'parent' && isBiological(n));
    return { mother: parents.find((n) => sexOf(n) === 'female') ?? null, father: parents.find((n) => sexOf(n) === 'male') ?? null };
  }
  if (person?.adopted) return { mother: null, father: null };
  const mine = (role) => p.npcIds.map((id) => state.npcs[id]).filter((n) => n?.role === role);
  // The player's parents: their own parents are the grandparents on that side.
  if (person?.role === 'parent' && isBiological(person)) {
    const side = sexOf(person) === 'female' ? 'maternal' : 'paternal';
    const gp = mine('grandparent').filter((n) => n.flags?.side === side);
    return { mother: gp.find((x) => sexOf(x) === 'female') ?? null, father: gp.find((x) => sexOf(x) === 'male') ?? null };
  }
  // Brothers and sisters share the player's parents (half-siblings share one).
  if (person?.role === 'sibling') {
    const bio = mine('parent').filter(isBiological);
    const keep = person.flags?.half ? bio.filter((x) => x.id === person.flags.half) : bio;
    return { mother: keep.find((x) => sexOf(x) === 'female') ?? null, father: keep.find((x) => sexOf(x) === 'male') ?? null };
  }
  const ids = person?.parentIds ?? [];
  const known = ids.map((id) => state.npcs[id]).filter(Boolean);
  // The player's own children: the player is a parent, and the other parent is in parentIds.
  if (person?.role === 'child' && !person.adopted) known.push(p);
  return { mother: known.find((x) => sexOf(x) === 'female') ?? null, father: known.find((x) => sexOf(x) === 'male') ?? null };
}

export const isBiological = (n) => !n.adopted && !n.flags?.step && !/^Step/.test(n.flags?.title ?? '');

/**
 * Anyone's genome. Worked out once and kept; for someone whose parents are
 * known, it is inherited from theirs.
 */
export function genomeOf(person) {
  if (!person) return null;
  if (person.genome?.v) return person.genome;
  const sex = sexOf(person);
  const { mother, father } = biologicalParents(person);
  const guard = person.genome = { v: 0 }; // breaks loops in odd family data
  const m = mother && mother !== person ? genomeOf(mother) : null;
  const f = father && father !== person ? genomeOf(father) : null;
  person.genome = (m?.v || f?.v) ? childGenome(m?.v ? m : null, f?.v ? f : null, person.id, sex) : founderGenome(person.id, sex);
  void guard;
  return person.genome;
}

/** Genetic value for one condition: its shared factor and its own part. */
export function liability(genome, conditionId) {
  const def = CONDITION_BY_ID[conditionId];
  if (!def?.heredity || !genome?.g) return 0;
  const { cluster, share } = def.heredity;
  return Math.sqrt(share) * (genome.g[cluster] ?? 0) + Math.sqrt(1 - share) * (genome.g[conditionId] ?? 0);
}

/**
 * How much a genetic value scales the yearly chance of a later-onset condition.
 * Normalized so the population average is unchanged: exp(b·z − b²/2).
 */
export function hazardMultiplier(genome, conditionId) {
  const def = CONDITION_BY_ID[conditionId];
  const b = def?.heredity?.b;
  if (!b) return 1;
  return Math.exp(b * liability(genome, conditionId) - (b * b) / 2);
}

/**
 * Conditions present from birth: neurodevelopmental conditions by the
 * liability-threshold model, single-gene conditions by genotype. Returns ids.
 * Environment is the rest of the liability, drawn from the person's id.
 */
export function bornWith(genome, id) {
  const r = seeded('birth', id);
  const out = [];
  for (const def of CONDITIONS) {
    if (def.onset.kind !== 'birth') continue;
    const h2 = def.heredity?.h2 ?? 0;
    const L = Math.sqrt(h2) * (h2 ? liability(genome, def.id) : 0) + Math.sqrt(1 - h2) * r.normal();
    if (L > probit(1 - def.onset.prevalence)) out.push(def.id);
  }
  const genes = [];
  for (const [key, gene] of Object.entries(GENES)) if (affected(genome, key, r)) genes.push(gene.condition);
  // Kept in the order they were found; inherited single-gene conditions are kept first when some must go.
  const kept = fewer([...genes, ...out]);
  return [...out, ...genes].filter((id) => kept.includes(id));
}

/** Learning differences: reading, numbers, handwriting, language. */
const LEARNING = ['dyslexia', 'dyscalculia', 'dysgraphia', 'dld'];
/**
 * Keeps what one person is born with to a believable handful: at most one learning difference, two developmental
 * conditions and three in all. Inherited single-gene conditions come first, so families still match.
 */
export function fewer(ids) {
  const out = [];
  for (const id of [...new Set(ids)]) {
    const def = CONDITION_BY_ID[id];
    if (LEARNING.includes(id) && out.some((x) => LEARNING.includes(x))) continue;
    if (def?.group === 'neurodev' && out.filter((x) => CONDITION_BY_ID[x]?.group === 'neurodev').length >= 2) continue;
    if (out.length >= 3) break;
    out.push(id);
  }
  return out;
}

/** Whether a genotype shows a single-gene condition. */
export function affected(genome, key, r = seeded('pen', key)) {
  const gene = GENES[key];
  if (!genome) return false;
  if (gene.pattern === 'mito') {
    if (!genome.mt?.[key]) return false;
    const pen = typeof gene.penetrance === 'number' ? gene.penetrance : gene.penetrance[genome.sex] ?? 0.1;
    return r.chance(pen);
  }
  const al = genome.a?.[key] ?? [];
  const n = al.reduce((s, x) => s + x, 0);
  if (gene.pattern === 'dominant') return n >= 1;
  if (gene.pattern === 'recessive') return n >= 2;
  if (gene.pattern === 'x') return genome.sex === 'male' ? n >= 1 : n >= 2;
  return false;
}

/** Carrier status for recessive and X-linked variants (shown only after a test). */
export function carrierOf(genome, key) {
  const gene = GENES[key];
  const n = (genome?.a?.[key] ?? []).reduce((s, x) => s + x, 0);
  if (gene.pattern === 'recessive') return n === 1;
  if (gene.pattern === 'x') return genome.sex === 'female' && n === 1;
  return false;
}
