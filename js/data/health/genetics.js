// Inheritance settings for engine/health/heredity.js.
//
// Complex conditions (ADHD, depression, bipolar disorder and the rest) use a
// liability model: everyone carries a genetic value for each shared factor and
// for each condition, inherited as the parents' average plus a random share of
// their own. A genetic value raises or lowers a likelihood; it never decides an
// outcome on its own. The coefficients are game tuning chosen so that
// conditions cluster in families about as much as twin and family studies
// describe in broad terms. They are not risk figures for any real person, and
// a heritability estimate is never used as anyone's chance of anything.
//
// Single-gene conditions follow their real inheritance pattern. Variant
// frequencies are rounded from MedlinePlus Genetics and describe populations of
// mostly European ancestry, where most of the data comes from.

/** Shared genetic factors: conditions that run in families together. */
export const CLUSTERS = {
  internalizing: 'Depression and anxiety',
  psychosis_mood: 'Bipolar disorder and psychosis',
  emotion: 'Emotional sensitivity',
  neurodev: 'Neurodevelopmental',
  learning: 'Learning differences',
  ocd: 'Obsessive-compulsive',
  eating: 'Eating disorders',
};

/**
 * pattern: 'dominant' | 'recessive' | 'x' (X-linked recessive) | 'mito' (mitochondrial)
 * freq: share of chromosomes (or mitochondria) carrying the variant in the founding population.
 * denovo: chance per birth of a new variant arising (dominant conditions).
 * penetrance: chance an affected genotype shows the condition, by sex where it differs.
 */
export const GENES = {
  cf: { condition: 'cystic_fibrosis', pattern: 'recessive', freq: 0.02, penetrance: 1, carrierName: 'a cystic fibrosis carrier' },
  hd: { condition: 'huntingtons', pattern: 'dominant', freq: 0.00005, denovo: 0.000002, penetrance: 1 },
  f8: { condition: 'hemophilia_a', pattern: 'x', freq: 0.0002, penetrance: 1, carrierName: 'a hemophilia carrier' },
  opn: { condition: 'color_vision', pattern: 'x', freq: 0.08, penetrance: 1, carrierName: 'a carrier of color vision deficiency' },
  lhon: { condition: 'lhon', pattern: 'mito', freq: 0.0003, penetrance: { male: 0.5, female: 0.1 } },
  fgfr3: { condition: 'achondroplasia', pattern: 'dominant', freq: 0.000004, denovo: 0.00003, penetrance: 1 },
};
