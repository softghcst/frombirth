// Which real law governs a question in a case, in a country and a year (data/realLaw.js). The newest law in force
// wins; a law that had not yet been made does not apply, so a case in 1955 is argued under the law of 1955.
import { store } from '../state.js';
import { REAL_LAWS, COURT_HISTORY } from '../data/realLaw.js';

const yearNow = () => store.state?.year ?? 2026;

/** Every listed law on a topic in force in a country in a year, newest first. */
export function lawsFor(topic, countryId, year = yearNow()) {
  return REAL_LAWS.filter((l) => l.topic === topic && l.countryIds.includes(countryId) && l.from <= year && (l.until ?? Infinity) >= year).sort((a, b) => b.from - a.from);
}
/** The law that governs a topic now, or null where Pathways does not list one. */
export const governing = (topic, countryId, year = yearNow()) => lawsFor(topic, countryId, year)[0] ?? null;

/**
 * Whether evidence can be left out on a ground, under the law in force: an unlawful search, or a confession taken by
 * coercion or without the warnings and counsel the law requires. Null when the law is not listed (the game's own rule).
 * @returns {{allowed:boolean, law:Object, why:string}|null}
 */
export function exclusion(ground, countryId, year = yearNow()) {
  const topic = ground === 'unlawful_search' ? 'search' : ground === 'coerced' ? 'confession' : null;
  if (!topic) return null;
  const law = governing(topic, countryId, year);
  if (!law) return null;
  const allowed = law.excludes === true || (law.excludes === 'coerced' && ground === 'coerced');
  return { allowed, law, why: allowed ? `${law.name}: ${law.summary}` : `${law.name}. ${law.note ?? law.summary}` };
}

/** Whether a divorce here and now needs proof of fault. Null where the law is not listed. */
export function divorceNeedsFault(countryId, year = yearNow()) {
  const law = governing('divorce', countryId, year);
  if (law) return { fault: law.nofault === false, law }; // 'facts' (England 1971-2022): fault or separation, either will do
  const first = REAL_LAWS.filter((l) => l.topic === 'divorce' && l.countryIds.includes(countryId)).sort((a, b) => a.from - b.from)[0];
  return first && year < first.from ? { fault: true, law: null, note: first.note } : null;
}

/** The topics the law decides in a case, from what is in it. */
function topicsOf(c) {
  const t = [];
  if (c.kind === 'criminal') {
    t.push('burden');
    if (c.evidence.some((e) => e.basis === 'unlawful_search')) t.push('search');
    if (c.evidence.some((e) => e.basis === 'coerced')) t.push('confession');
    if (c.evidence.some((e) => e.basis === 'suggestive_lineup')) t.push('identification');
    t.push('hearsay', c.role === 'prosecution' ? 'disclosure' : 'counsel');
    if (c.jury) t.push('jury');
  }
  if (c.templateId === 'divorce') t.push('divorce');
  if (['custody', 'divorce', 'dependency'].includes(c.templateId)) t.push('custody');
  if (c.templateId === 'dismissal') t.push('retaliation');
  if (c.templateId === 'trademark') t.push('trademark');
  if (c.templateId === 'police_conduct') t.push('force');
  if (c.templateId === 'removal') t.push('removal');
  if (c.fee?.model === 'contingency' || (c.kind === 'family' && c.countryId === 'us')) t.push('contingency');
  return t;
}
/** The real laws that govern a case, as it stands in its country and year: [{ topic, law }]. */
export function caseLaws(c, year = yearNow()) {
  return topicsOf(c).map((topic) => ({ topic, laws: lawsFor(topic, c.countryId, year) })).filter((x) => x.laws.length).flatMap((x) => x.laws.map((law) => ({ topic: x.topic, law })));
}

/**
 * The history behind legal education and the bar in a country and year, shown as context. The game records no
 * ethnicity for anyone and will not guess it from how someone looks, so these are told, not applied to the player.
 */
export function eraNotes(countryId, year = yearNow()) {
  const out = [];
  if (countryId === 'us' && year < 1950) out.push('Until Sweatt v. Painter (1950), many state law schools refused to admit Black students, and segregation shaped the profession for decades after.');
  if (countryId === 'us' && year < 1964) out.push('The Civil Rights Act of 1964 had not yet outlawed discrimination in employment, including by law firms.');
  if (year < 1900) out.push('Most lawyers still learned by reading the law in a practicing lawyer\'s office rather than at a law school.');
  return out;
}

/** A court's name in its era, where it changed (England's Assizes, the US immigration courts). */
export function courtName(countryId, kind, year = yearNow()) {
  const list = COURT_HISTORY[countryId]?.[kind];
  return list?.find(([from]) => year >= from)?.[1] ?? null;
}
