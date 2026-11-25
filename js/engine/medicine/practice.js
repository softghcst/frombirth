// Private practice: a clinic a physician owns, run by the business engine (engine/business.js:
// its staff, cash, rent, expansion, partners and sale). This adds the medical side: which kind of
// practice the owner is qualified to open, a licensed physician at its head, and a reputation
// that follows how the owner practices.
//
//   business.medical = { practiceType, specialtyId, since }
//
// Who may own a practice: a physician (or podiatrist) who has finished residency in a specialty
// that practices outside a hospital, with a full license. Where the game's jurisdiction profile
// says practices are physician-owned (the US, Canada), that is the only route; the game invents no
// further rules.
import { clamp } from '../../util.js';
import { player, log } from '../../state.js';
import { PRACTICE_TYPES, jurisdiction } from '../../data/medicine.js';
import * as biz from '../business.js';
import { chronicle, employer } from '../employers.js';
import { M, med, year, note, result, reputationOf, qualified } from './core.js';

/** Practice types this physician is qualified to open. */
export function practiceOptions(m = med(), p = player()) {
  const q = new Set(qualified(m));
  return Object.entries(PRACTICE_TYPES).map(([id, t]) => {
    let block = '';
    if (!t.needs.some((s) => q.has(s))) block = `Needs completed training in ${t.needs.slice(0, 2).map((s) => s.replace('_', ' ')).join(' or ')}.`;
    else if (m.license.status !== 'full') block = 'Needs a full license to practice.';
    return { id, ...t, block, specialtyId: t.needs.find((s) => q.has(s)) ?? null };
  });
}

/** Why the medical-practice business cannot be started (engine/business.js asks), or ''. */
export function practiceBlock(p = player()) {
  const m = med(p);
  if (!m) return null; // no medical record: the business engine's own checks apply
  if (!practiceOptions(m, p).some((o) => !o.block)) return m.license.status !== 'full' ? 'A practice needs a physician with a full license.' : 'A private practice needs completed residency in a specialty that practices outside a hospital.';
  return '';
}

/** Opens a practice of a type, through the business engine. */
export function openPractice(typeId, name) {
  const p = player();
  const m = M();
  const o = practiceOptions(m, p).find((x) => x.id === typeId);
  if (!o) return result(false, 'There is no such practice.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  const title = name || `${p.lastName} ${o.name}`;
  const r = biz.start('clinic', title);
  if (!r.ok) return r;
  const b = biz.businesses(p).at(-1);
  b.medical = { practiceType: typeId, specialtyId: o.specialtyId, since: year() };
  b.reputation = clamp(Math.round(b.reputation * 0.5 + reputationOf(m) * 0.5));
  m.clinicIds.push(b.id);
  const e = employer(b.employerId);
  if (e) { e.medKind = 'clinic'; chronicle(e, `${p.firstName} ${p.lastName} opened ${title}, ${o.name.toLowerCase()}.`); }
  note(`Opened ${title}, ${o.name.toLowerCase()}.`, 'career', { key: `clinic:${b.id}`, milestone: `Opened a private practice: ${title}.`, significance: 2, log: false });
  return result(true, `${r.text} It is ${o.name.toLowerCase()}, with you as its physician.`);
}

/** The physician's practices still open. */
export const practices = (m = med()) => (m?.clinicIds ?? []).map((id) => biz.business(id)).filter((b) => b && b.status === 'open');

/** A practice's year, after the business engine's: the reputation follows the physician, and the license must hold. */
export function practiceYear() {
  const p = player();
  const m = med();
  if (!m) return;
  for (const b of practices(m)) {
    if (!b.medical) continue;
    const t = PRACTICE_TYPES[b.medical.practiceType];
    b.reputation = clamp(Math.round(b.reputation * 0.75 + reputationOf(m) * 0.25 * (t?.demand ?? 1)));
    if (m.license.status !== 'full' || m.license.countryId && m.license.countryId !== b.countryId) {
      b.quality = clamp(b.quality - 15);
      log(`${b.name} cannot see patients without a licensed physician. It is losing them.`, 'system', 'bad');
    }
  }
  m.clinicIds = m.clinicIds.filter((id) => biz.business(id));
}

/** Words about who may own a practice here, for the career page. */
export function ownershipNote(countryId = player().countryId) {
  const j = jurisdiction(countryId);
  return j.ownership === 'physician' ? 'Here a medical practice is owned by physicians.' : j.detail === 'simplified' ? 'Ownership rules here are simplified in the game.' : '';
}
