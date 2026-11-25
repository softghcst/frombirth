// The medical career engine (Pathways Medical Career Engine). One yearly step, run after the
// working year (engine/yearProcessor.js 'medicine'): school and training years, the posts of a
// qualified physician, the year's patients, private practice and hospital life. Runs once per
// world year, so 3-, 6- and 12-month Age Ups give the same career.
//
//   core.js       records, migration, skills and reputation
//   training.js   premed, medical school, the Match, residency, fellowships, license, boards
//   hospitals.js  hospitals and departments over the city's health employers
//   ladder.js     attending to chief medical officer
//   cases.js      patients and the operating room
//   practice.js   private practice on the business engine
//   drama.js      mentors, rivals, friends, romance, leadership, patients who come back
import { store, player } from '../../state.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { med, reputationOf, migrateMedicine, medicalFamily, storyOnce } from './core.js';
import { tickTraining, premedOpen } from './training.js';
import { postYear, claimsYear } from './ladder.js';
import { caseload, closeYear } from './cases.js';
import { practiceYear } from './practice.js';
import { researchYear } from './research.js';
import { dramaYear, hospitalYear } from './drama.js';
import { storyYear } from './story.js';

export * from './core.js';
export const MEDICAL_CAREERS = ['doctor', 'surgery', 'psychiatry', 'podiatrist'];

/** Whether the medical engine runs this player's job (the career engine then pays it, but does not review it). */
export function medicineRuns(careerId, p = player()) {
  // A doctor from an older save at the first level, with no post recorded, stays with the career engine.
  return MEDICAL_CAREERS.includes(careerId) && !!(p.medicine?.training || p.medicine?.job);
}

/**
 * Why a medical career cannot be applied to from the job board, or '': physicians are placed by
 * residency programs and appointed by hospitals (My Medical Career), not hired cold.
 */
export function medicalBlock(careerId, p = player()) {
  if (!MEDICAL_CAREERS.includes(careerId)) return '';
  const degree = p.education.degrees.some((d) => d.type === 'medical' || d.type === 'podiatric');
  if (!degree && !p.medicine) return '';
  return 'Physicians are placed by residency programs and appointed by hospitals: see My Medical Career.';
}

/** The yearly step. */
export function tickMedicine() {
  const p = player();
  if (!p.alive) return;
  let m = med(p);
  // A graduate from before this engine, or someone working as a doctor without a record, gets one (core.migrateMedicine).
  // A child of a doctor's family wonders, once, whether medicine is for them (data/events/stories/medicine.js).
  if (p.age >= 13 && p.age <= 17 && !p.flags.medFamilyScene) {
    const fam = medicalFamily(p);
    if (fam) {
      p.flags.medFamilyScene = true;
      store.state.pendingEvents.push({ id: 'med_family_calling', cast: { words: { relative: fam.name, what: fam.what.toLowerCase(), how: fam.archived ? 'in the photographs in the Family Archive' : 'at the kitchen table, tired after a long shift' } } });
    }
  }
  // The medical school interview: for a premed student who has done the groundwork, once.
  if (m && premedOpen(p)) {
    const pm = m.premed;
    if (pm.service + pm.exposure + pm.research + pm.letters + pm.exam >= 2) storyOnce('med_school_interview', {}, m);
  }
  const studying = p.education.enrolled && ['medical', 'podiatric'].includes(p.education.stage);
  if (!m && !studying && !p.education.degrees.some((d) => ['medical', 'podiatric'].includes(d.type))) return;
  if (!m && !studying) { migrateMedicine(store.state); m = med(p); }
  closeYear(m);
  tickTraining();
  m = med(p);
  if (!m) return;
  postYear();
  hospitalYear();
  claimsYear(p, m);
  practiceYear();
  researchYear();
  m.reputation = reputationOf(m);
  caseload(m, p); // this year's patients, made now so the year's count is fixed
  dramaYear();
  storyYear(p, m);
  if (p.career.careerId && !CAREER_BY_ID[p.career.careerId]) p.career.careerId = null;
}
