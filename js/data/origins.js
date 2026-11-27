// Adoption, birth families and identity: the rules of each place and time, and the backgrounds an adoption can have.
// Used by engine/origins.js. Nothing here is drawn by itself; the engine decides what is true and when.
//
// The rules are simplified. The United States profile is the researched one; every other place gets a conservative
// default until someone researches it. Notes on sources are next to each figure.

/**
 * The first year legal adoption (a permanent, court-made parent and child relationship) exists in a place.
 * Before it, a child could be raised by relatives or other carers, but not legally adopted.
 *  - United States: Massachusetts Adoption of Children Act, 1851, the first modern adoption statute; other states followed.
 *  - England and Wales: Adoption of Children Act 1926, in force 1 January 1927. Scotland followed in 1930.
 *  - Everywhere else: 1950, a conservative default (many countries legislated earlier; some much later).
 */
export const ADOPTION_FROM = { us: 1851, uk: 1927 };
export const DEFAULT_ADOPTION_FROM = 1950;

/** The age at which an adoptee can ask for their own records without a parent or guardian: 18 in most places. */
export const RECORDS_AGE = 18;

/**
 * Who can see an adult adoptee's original birth record, by place and the year they ask.
 *   open         the adoptee may have their original birth certificate on request
 *   conditional  open, except where a birth parent has filed to have their name withheld, or asks for contact through an intermediary
 *   restricted   sealed: identifying details only with a court order, through an intermediary, or by mutual consent
 *
 * United States: the law is made state by state. Records were sealed in most states from the 1930s to the 1960s; by the
 * early 2020s about a dozen states gave adult adoptees unrestricted access to the original birth certificate and about
 * ten more gave access with conditions. A life's adoption is placed, without naming it, in a state of one kind or the
 * other, fixed for that life; the shares below change with the year the request is made, as states changed their laws.
 * England and Wales: adult adoptees have had a right to their birth record since the Children Act 1975 (with
 * counseling for adoptions made before 12 November 1975). The Adoption Contact Register opened in 1991.
 */
export function recordsAccessShares(countryId, year) {
  if (countryId === 'us') {
    if (year < 1940) return { open: 70, conditional: 0, restricted: 30 }; // before sealing became usual: often open, but scattered
    if (year < 2000) return { open: 8, conditional: 10, restricted: 82 };
    if (year < 2015) return { open: 14, conditional: 16, restricted: 70 };
    return { open: 28, conditional: 22, restricted: 50 };
  }
  if (countryId === 'uk') return year >= 1976 ? { open: 100, conditional: 0, restricted: 0 } : { open: 0, conditional: 0, restricted: 100 };
  return { open: 0, conditional: 0, restricted: 100 };
}

/** What the search services are, and from when they exist in a place. A service that does not exist yet is not offered. */
export const SERVICES = {
  // A mutual consent registry: a match is made only if both people have registered. US: the International Soundex
  // Reunion Registry (1975) and state registries from the 1980s. England and Wales: the Adoption Contact Register (1991).
  registry: { us: 1975, uk: 1991, other: null },
  // An intermediary (a confidential intermediary, the agency's post-adoption service): asks the other person first.
  intermediary: { us: 1960, uk: 1976, other: 1980 },
  // Consumer DNA testing with relative matching: 23andMe began in late 2007, AncestryDNA in 2012. Large enough
  // databases to find close relatives came in the 2010s.
  dna: { us: 2008, uk: 2010, other: 2013 },
};
export const serviceFrom = (service, countryId) => SERVICES[service][countryId] ?? SERVICES[service].other;

/** The kinds of origin a new life can start with (the life designer's "Family origin"). */
export const ORIGINS = {
  standard: { label: 'Standard family', desc: 'Born into the family that raises you.' },
  birth: { label: 'Adopted at birth', desc: 'Placed with your adoptive family as a newborn.' },
  childhood: { label: 'Adopted during childhood', desc: 'Your adoption happens when you are small, after a start somewhere else.' },
  kinship: { label: 'Raised by relatives', desc: 'A grandparent or aunt brings you up, by adoption or guardianship.' },
  surprise: { label: 'Surprise me', desc: 'Any of these, at plausible odds.' },
};
/** "Surprise me": most lives are still born into the family that raises them. */
export const SURPRISE = { standard: 55, birth: 22, childhood: 10, kinship: 13 };

/**
 * Why a child was adopted: possible circumstances, never judgments. `when`: 'birth' (placed as a newborn) and/or
 * 'childhood'. `mother`: the birth mother's age range at the birth. `known`: how the adoptive parents were told it,
 * for the child (non-identifying). Serious harm is rare, and told without detail.
 */
export const REASONS = {
  young_plan: { weight: 20, when: ['birth'], mother: [16, 21], known: 'Your birth mother was very young when you were born, and made an adoption plan for you.' },
  voluntary_plan: { weight: 24, when: ['birth'], mother: [20, 38], known: 'Your birth parents decided, with an adoption agency, that adoption was the right plan for you.' },
  instability: { weight: 12, when: ['birth', 'childhood'], mother: [19, 36], known: 'Your birth family was going through a hard time with money and housing, and made a plan for you to be adopted.' },
  health: { weight: 9, when: ['birth', 'childhood'], mother: [20, 40], known: 'Your birth mother was facing serious health problems and could not look after a child.' },
  parent_died: { weight: 4, when: ['childhood'], mother: [19, 38], known: 'A parent in your birth family died when you were small.' },
  could_not_care: { weight: 5, when: ['childhood'], mother: [18, 36], known: 'A court decided your birth family could not care for you safely at the time. Your file does not say more than that.' },
  incarcerated: { weight: 4, when: ['birth'], mother: [19, 36], known: 'Your birth mother was serving a prison sentence when you were born. The file does not say what for.' },
  after_foster: { weight: 6, when: ['childhood'], mother: [18, 34], known: 'You lived with a foster family for a while before your adoption was made final.' },
  unknown: { weight: 8, when: ['birth', 'childhood'], mother: [17, 38], known: 'Little is written down about why. The agency\'s file is short.' },
};

/** How the contact arrangement is described. */
export const CONTACT = {
  open: { label: 'Open', desc: 'Letters, photos and some visits with your birth family, agreed between the families.' },
  mediated: { label: 'Mediated', desc: 'Letters and updates are passed on by the agency; names and addresses are not shared.' },
  closed: { label: 'Closed', desc: 'Confidential. Identifying details were not shared between the families.' },
  unknown: { label: 'Not recorded', desc: 'Nobody wrote down what was agreed about contact.' },
  lapsed: { label: 'No longer active', desc: 'There was an arrangement once. It has not been kept up.' },
};

/** The odds of each contact arrangement, by the kind of adoption and the year it was made (US practice moved from closed to open). */
export function contactShares(kind, year) {
  if (kind === 'kinship') return { open: 90, mediated: 5, closed: 0, unknown: 5 };
  if (year < 1970) return { open: 2, mediated: 3, closed: 80, unknown: 15 };
  if (year < 1995) return kind === 'childhood' ? { open: 15, mediated: 30, closed: 45, unknown: 10 } : { open: 15, mediated: 25, closed: 55, unknown: 5 };
  return kind === 'childhood' ? { open: 25, mediated: 40, closed: 30, unknown: 5 } : { open: 45, mediated: 30, closed: 20, unknown: 5 };
}

/** How the adoptive parents talk about it, by era: openly from the start is the advice from the 1980s on. */
export function tellingShares(year) {
  if (year < 1960) return { early: 25, gradual: 25, limited: 25, late: 25 };
  if (year < 1985) return { early: 45, gradual: 25, limited: 18, late: 12 };
  return { early: 65, gradual: 22, limited: 9, late: 4 };
}

/** What curiosity can be. Not a meter of happiness: each is simply where someone is. */
export const CURIOSITY = {
  none: 'Not currently curious',
  mild: 'Mildly curious',
  exploring: 'Actively exploring',
  searching: 'Searching',
  break: 'Taking a break',
  content: 'Comfortable with what you know',
};

/** What each kind of birth relative is called, by gender. */
export const KIN_WORDS = {
  mother: ['Birth mother', 'Birth mother', 'Birth mother'],
  father: ['Birth father', 'Birth father', 'Birth father'],
  sibling: ['Birth brother', 'Birth sister', 'Birth sibling'],
  half: ['Half-brother (birth family)', 'Half-sister (birth family)', 'Half-sibling (birth family)'],
  grandparent: ['Birth grandfather', 'Birth grandmother', 'Birth grandparent'],
  aunt: ['Uncle (birth family)', 'Aunt (birth family)', 'Relative (birth family)'],
};
export const kinWord = (kin, gender) => (KIN_WORDS[kin] ?? KIN_WORDS.aunt)[gender === 'male' ? 0 : gender === 'female' ? 1 : 2];
