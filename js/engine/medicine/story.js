// The medical Story Director: the beats of a medical life, each told once, at the moment it is true.
// Every beat reads the real state (training, posts, practices, this year's actual patients) and casts
// real people; a specialty beat is about one of this year's real cases, which the player then works in
// My Medical Career. One beat a year at most, on top of the hospital life scenes (engine/medicine/drama.js).
//
// Beats told elsewhere, at their own moment: the interview, the anatomy exam, the patient you remember,
// choosing a specialty, residency interviews, Match Day and the first night (training.js); an offer from
// another hospital, a research opportunity, the mentor retiring, the department's need for a leader
// (drama.js, ladder.js).
import { store, player } from '../../state.js';
import { CASE_BY_ID } from '../../data/medicineCases.js';
import { SPECIALTY_BY_ID } from '../../data/medicine.js';
import { med, year, storyOnce, currentSpecialty } from './core.js';
import { caseload, roleNow } from './cases.js';
import { hospital } from './hospitals.js';
import { practices, practiceOptions } from './practice.js';

const npc = (id) => (id ? store.state.npcs[id] : null);
const thisYear = (m, p) => (roleNow(m, p) ? caseload(m, p) : []);
/** One of this year's cases whose fixture is in a specialty (or matches a test), with its patient's first name. */
function caseFor(m, p, test) {
  const c = thisYear(m, p).find((x) => x.status !== 'closed' && test(CASE_BY_ID[x.fixtureId], x));
  if (!c) return null;
  const fx = CASE_BY_ID[c.fixtureId];
  return { words: { patient: npc(c.patientId)?.firstName ?? 'A patient', label: fx.label.toLowerCase(), caseId: c.id } };
}
const inSpec = (...ids) => (fx) => fx.specialty.some((s) => ids.includes(s));

/** The beats, in the order they are considered. `when` returns the scene's cast, or null. */
const BEATS = [
  // Hospital life
  ['med_first_patient', (p, m) => (m.experience.cases === 0 ? caseFor(m, p, () => true) : null)],
  ['med_unexpected_result', (p, m) => caseFor(m, p, (fx) => fx.tests.some((t) => t.value === 'useful') && fx.differential.length >= 3)],
  ['med_senior_advice', (p, m) => { const s = npc(m.people.mentorId) ?? npc(m.people.supervisorIds[0]); return m.training && s?.alive ? { mentor: s.id } : null; }],
  ['med_patient_returned', (p, m) => { const c = thisYear(m, p).find((x) => x.followOf); return c ? { words: { patient: npc(c.patientId)?.firstName ?? 'A patient' } } : null; }],
  ['med_challenging_dx', (p, m) => caseFor(m, p, (fx) => ['complex', 'high'].includes(fx.tier))],
  ['med_consultation', (p, m) => caseFor(m, p, (fx) => fx.plans.some((x) => x.refer && x.quality === 'best'))],
  ['med_handoff', (p, m) => (m.training?.pgy >= 1 && m.experience.years >= 1 ? {} : null)],
  ['med_case_conference', (p, m) => (m.job && hospital(m.job.hospitalId)?.teaching ? {} : null)],
  // Specialties: each about a real case of this year
  ['med_beat_or', (p, m) => (SPECIALTY_BY_ID[currentSpecialty(m)]?.surgical ? caseFor(m, p, (fx) => fx.plans.some((x) => x.procedure)) : null)],
  ['med_beat_athlete', (p, m) => caseFor(m, p, inSpec('ortho', 'ortho_sports'))],
  ['med_beat_child', (p, m) => caseFor(m, p, (fx) => fx.guardian && inSpec('pediatrics', 'family', 'peds_surgery')(fx))],
  ['med_beat_emergency', (p, m) => caseFor(m, p, inSpec('emergency', 'trauma'))],
  ['med_beat_long_term', (p, m) => caseFor(m, p, (fx) => inSpec('psychiatry')(fx) || !!fx.followUp)],
  ['med_beat_newborn', (p, m) => caseFor(m, p, (fx) => inSpec('pediatrics', 'neonatology')(fx) && fx.ages?.[0] === 0)],
  ['med_beat_pregnancy', (p, m) => caseFor(m, p, inSpec('obgyn', 'mfm'))],
  ['med_beat_scan', (p, m) => caseFor(m, p, inSpec('radiology'))],
  ['med_beat_foot', (p, m) => caseFor(m, p, inSpec('podiatry', 'foot_ankle'))],
  ['med_beat_specialist', (p, m) => caseFor(m, p, (fx) => SPECIALTY_BY_ID[fx.specialty[0]]?.kind === 'fellowship' && !SPECIALTY_BY_ID[fx.specialty[0]].surgical)],
  // Career
  ['med_chief_resident', (p, m) => (m.training?.chief ? {} : null)],
  ['med_invite_teach', (p, m) => (m.job && hospital(m.job.hospitalId)?.teaching && !(m.research?.taught) ? {} : null)],
  ['med_clinic_idea', (p, m) => (!m.clinicIds.length && m.job && year() - m.job.since >= 3 && practiceOptions(m, p).some((o) => !o.block) ? {} : null)],
  ['med_first_month_practice', (p, m) => { const b = practices(m)[0]; return b && b.years <= 1 ? { words: { clinic: b.name } } : null; }],
  ['med_first_hire', (p, m) => { const b = practices(m)[0]; return b && !b.staff.length ? { words: { clinic: b.name } } : null; }],
  ['med_practice_growing', (p, m) => { const b = practices(m).find((x) => x.reputation >= 60 && x.sites === 1 && (x.last?.profit ?? 0) > 0); return b ? { words: { clinic: b.name } } : null; }],
  ['med_hard_year', (p, m) => { const b = practices(m).find((x) => (x.last?.profit ?? 0) < 0); return b ? { words: { clinic: b.name } } : null; }],
  ['med_new_chapter', (p, m) => (p.age >= 60 && (m.job || m.clinicIds.length) ? {} : null)],
];

/** Tells this year's beat, if one is due. Once a year; each beat once in a life. */
export function storyYear(p = player(), m = med(p)) {
  if (!m || m.scenes.storyYear === year()) return null;
  for (const [id, when] of BEATS) {
    if (m.scenes[`story:${id}`]) continue;
    const cast = when(p, m);
    if (!cast) continue;
    m.scenes.storyYear = year();
    storyOnce(id, cast, m);
    return id;
  }
  return null;
}

export const STORY_BEATS = BEATS.map(([id]) => id);
