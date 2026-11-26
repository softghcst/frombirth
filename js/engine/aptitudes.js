// What someone can already do, counted where it should count: coding learned in lessons or practiced at home helps in
// Technology at school, with a computer science degree and admission to one, and in getting work in tech. The same for
// math and science, writing and art. Each edge is 0 (nothing beyond the ordinary) to 1 (a real head start), read from
// skills (data/skills.js) and talents (data/talents.js); none ever counts against anyone.
import { player } from '../state.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { talentWord } from '../data/talents.js';

const TECH = [['skills.coding', 0.6], ['skills.robotics', 0.3], ['talents.tech', 0.4]];
const NUMBERS = [['skills.math', 0.5], ['skills.chess', 0.2], ['talents.science', 0.5]];
const LAB = [['skills.science', 0.5], ['skills.math', 0.2], ['talents.science', 0.5]];
const WORDS = [['skills.writing', 0.6], ['talents.writing', 0.5]];
const LAW = [['skills.public_speaking', 0.5], ['skills.writing', 0.35], ['skills.chess', 0.1], ['talents.writing', 0.35], ['talents.acting', 0.2], ['talents.persuasion', 0.4]];
const ART = [['skills.painting', 0.35], ['skills.drawing', 0.35], ['skills.photography', 0.2], ['talents.art', 0.5]];
// A gift points somewhere beyond the stage: science toward medicine, acting toward a courtroom or a bedside, sport
// toward the uniformed services (the same map is written out for players in data/talents.js, leadsTo).
const MEDICINE = [['skills.science', 0.3], ['talents.science', 0.5], ['talents.acting', 0.1], ['talents.art', 0.1]];
const HANDS = [...MEDICINE.slice(0, 2), ['talents.art', 0.3]]; // a steady, careful hand: surgery, dentistry
const CARE = [['talents.science', 0.35], ['talents.acting', 0.1]];
const NEWS = [...WORDS, ['skills.public_speaking', 0.2], ['talents.acting', 0.15], ['talents.singing', 0.05]];
const ON_AIR = [['skills.public_speaking', 0.4], ['talents.acting', 0.4], ['talents.persuasion', 0.2], ['talents.singing', 0.15], ['talents.writing', 0.2]];
const DETECTIVE = [['talents.science', 0.25], ['talents.writing', 0.2], ['talents.crime', 0.25], ['talents.tech', 0.1], ['talents.sports', 0.1]];
const BODY = [['skills.martial_arts', 0.3], ['skills.swimming', 0.2], ['talents.sports', 0.5]];
const MOVEMENT = [...BODY, ['talents.dance', 0.3]];
const TEACHING = [['talents.writing', 0.15], ['talents.science', 0.15], ['talents.acting', 0.1], ['talents.persuasion', 0.15]];
const PITCH = [['skills.writing', 0.3], ['talents.writing', 0.3], ['talents.art', 0.2], ['talents.acting', 0.2], ['talents.persuasion', 0.3]];
const POLITICS = [['skills.public_speaking', 0.4], ['skills.writing', 0.2], ['talents.persuasion', 0.5], ['talents.writing', 0.2], ['talents.acting', 0.15]];
const SELLING = [['talents.persuasion', 0.5], ['talents.acting', 0.15]];

/** School subjects (data/education.js). */
export const SUBJECT_EDGE = { technology: TECH, math: NUMBERS, science: LAB, literature: WORDS, art: ART };
/** Degree subjects (data/majors.js). */
export const MAJOR_EDGE = {
  computer_science: [...TECH, ['skills.math', 0.2], ['talents.science', 0.2]],
  engineering: [['skills.robotics', 0.4], ['skills.math', 0.3], ['talents.science', 0.3], ['talents.tech', 0.3]],
  mathematics: NUMBERS, finance: [['skills.math', 0.4], ['talents.science', 0.3]],
  chemistry: LAB, biology: LAB, nursing: CARE, psychology: [['talents.science', 0.2], ['talents.writing', 0.2], ['talents.acting', 0.1]],
  forensic_science: [...LAB, ['talents.crime', 0.1]], criminology: DETECTIVE, cybersecurity: [...TECH, ['talents.crime', 0.1]],
  english: WORDS, journalism: WORDS, communications: [['skills.writing', 0.4], ['talents.writing', 0.3], ['talents.persuasion', 0.3]],
  art: ART, theater: [['talents.acting', 0.6]], music: [['talents.music', 0.6]], dance: [['talents.dance', 0.6]],
  political_science: POLITICS, criminal_justice: LAW, history: [...LAW.slice(0, 2)],
};
/** Kinds of work: a job's family (data/occupations.js), or the job itself (data/careers.js). */
export const WORK_EDGE = { tech: TECH, software: TECH, science: LAB, media: NEWS, arts: ART, law: LAW, lawyer: LAW,
  engineer: [['skills.robotics', 0.4], ['skills.math', 0.4], ['talents.science', 0.3], ['talents.tech', 0.3]],
  // Medicine and care
  doctor: MEDICINE, dentist: HANDS, surgery: HANDS, dental_hyg: HANDS, pharmacist: LAB, vet: MEDICINE, scientist: LAB,
  nurse: CARE, health: CARE, physio: [...CARE, ['talents.sports', 0.2], ['talents.dance', 0.1]],
  // Words and the news
  journalist: NEWS, author: WORDS, broadcast: ON_AIR, pr: PITCH, marketing: PITCH, policy: [...WORDS, ['talents.science', 0.15]],
  political_staff: POLITICS, diplomacy: POLITICS, sales: SELLING, recruitment: SELLING, talent_agency: SELLING, fin_advice: SELLING, screenwriting: WORDS, tech_writing: [...WORDS, ['talents.tech', 0.2]],
  photography: ART, graphic: ART, animation: [...ART, ['talents.tech', 0.2]], gamedev: [...TECH, ['talents.art', 0.2]],
  // Investigation, the uniformed services and the body
  detective: DETECTIVE, forensics: [...LAB, ['talents.crime', 0.1]], cyber: [...TECH, ['talents.crime', 0.1]],
  military: BODY, police: [...BODY, ['talents.crime', 0.15]], firefighter: BODY, safety: BODY, sport: MOVEMENT, fitness: MOVEMENT,
  modeling: [['talents.modeling', 0.6], ['talents.dance', 0.15], ['talents.acting', 0.15]],
  // Teaching
  teacher: TEACHING, education: TEACHING, academic: [['talents.science', 0.25], ['talents.writing', 0.25]],
};

const read = (p, path) => path.split('.').reduce((o, k) => o?.[k], p) ?? 0;

/** How much of a head start, 0 to 1, from a list of [what, weight]. Below 20 counts for nothing. */
export function edgeFrom(list, p = player()) {
  if (!list) return 0;
  const sum = list.reduce((t, [path, w]) => t + Math.max(0, read(p, path) - 20) / 80 * w, 0);
  return Math.min(1, Math.round(sum * 100) / 100);
}
export const subjectEdge = (subjectId, p = player()) => edgeFrom(SUBJECT_EDGE[subjectId], p);
export const majorEdge = (majorId, p = player()) => edgeFrom(MAJOR_EDGE[majorId], p);
export const workEdge = (career, p = player()) => edgeFrom(WORK_EDGE[career?.id] ?? WORK_EDGE[career?.family], p);

/** The strongest thing behind an edge, in words ("coding", "a gift for technology"), for the reasons people are given. */
export function strongest(list, p = player()) {
  if (!list) return '';
  const best = list.map(([path, w]) => [path, Math.max(0, read(p, path) - 20) * w]).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] <= 0) return '';
  const [group, id] = best[0].split('.');
  return group === 'skills' ? (SKILL_BY_ID[id]?.name ?? id).toLowerCase() : `a gift for ${talentWord(id)}`;
}

/**
 * Where a gift puts someone on the first day of a career with skills of its own: a gift for science starts a medical
 * student ahead in clinical judgment, a gift for acting a law student ahead in the courtroom. Each skill lists the
 * talents that help it; the best one counts, from nothing at 50 up to `most` points at 100.
 */
export const GIFT_START = {
  medicine: { reasoning: ['science'], technical: ['art', 'science'], communication: ['acting', 'persuasion'], research: ['science', 'writing'] },
  law: { research: ['writing'], courtroom: ['acting', 'persuasion'], negotiation: ['persuasion', 'acting'], clients: ['persuasion'] },
  journalism: { writing: ['writing'], reporting: ['writing'], interviewing: ['acting', 'persuasion'], broadcast: ['acting', 'singing', 'persuasion'] },
  investigations: { reasoning: ['science'], evidence: ['science'], writing: ['writing'], interviewing: ['acting', 'persuasion'], observation: ['crime', 'art'],
    digital: ['tech'], financial: ['science'], forensic: ['science'] },
};
export function giftStart(system, p = player(), most = 12) {
  const out = {};
  for (const [skill, ids] of Object.entries(GIFT_START[system] ?? {})) {
    const best = Math.max(...ids.map((id) => p.talents?.[id] ?? 0));
    const pts = Math.round(Math.max(0, best - 50) / 50 * most);
    if (pts > 0) out[skill] = pts;
  }
  return out;
}
/** Adds a gift's head start to a skill table made just now. */
export function addGifts(skills, system, p = player(), most = 12) {
  for (const [k, n] of Object.entries(giftStart(system, p, most))) if (k in skills) skills[k] = Math.min(100, skills[k] + n);
  return skills;
}
