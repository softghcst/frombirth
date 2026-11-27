// What the career screens are called: the player's job title while they are in the work ("Detective", "Family
// physician", "Public defender"), the field while they are not yet ("Law Enforcement", "Medicine", "Law"), and the
// school while they are training for it ("Law School", "Medical School", "Police Academy").
import { player } from '../state.js';
import { titleCase } from './titles.js';
import { trackOf } from '../engine/lawPractice.js';
import { med } from '../engine/medicine/core.js';
import { rec } from '../engine/investigations/core.js';
import { INVESTIGATIVE } from '../engine/investigations/index.js';

const job = (p) => titleCase(String(p.career?.title ?? '').replace(/^./, (x) => x.toUpperCase()));

/** @param {'law'|'medicine'|'investigations'} field */
export function screenName(field, p = player()) {
  if (field === 'law') {
    const t = trackOf(p);
    if (t === 'own') return 'Your Law Practice';
    if (t && p.career?.title) return job(p);
    if (p.education?.enrolled && p.education.stage === 'law') return 'Law School';
    return 'Law';
  }
  if (field === 'medicine') {
    const m = med(p);
    if ((m?.job || m?.training) && p.career?.title) return job(p);
    if (m?.clinicIds?.length) return 'Your Practice';
    if (p.education?.enrolled && ['medical', 'podiatric'].includes(p.education.stage)) return 'Medical School';
    return 'Medicine';
  }
  const r = rec(p);
  if (r?.academy?.status === 'enrolled') return 'Police Academy';
  if (r?.job && p.career?.title && (INVESTIGATIVE.includes(p.career.careerId) || ['pi', 'forensics'].includes(p.career.careerId))) return job(p);
  return 'Law Enforcement';
}
