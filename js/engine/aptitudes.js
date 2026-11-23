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
const ART = [['skills.painting', 0.35], ['skills.drawing', 0.35], ['skills.photography', 0.2], ['talents.art', 0.5]];

/** School subjects (data/education.js). */
export const SUBJECT_EDGE = { technology: TECH, math: NUMBERS, science: LAB, literature: WORDS, art: ART };
/** Degree subjects (data/majors.js). */
export const MAJOR_EDGE = {
  computer_science: [...TECH, ['skills.math', 0.2], ['talents.science', 0.2]],
  engineering: [['skills.robotics', 0.4], ['skills.math', 0.3], ['talents.science', 0.3], ['talents.tech', 0.3]],
  mathematics: NUMBERS, finance: [['skills.math', 0.4], ['talents.science', 0.3]],
  chemistry: LAB, biology: LAB, nursing: [['talents.science', 0.3]],
  english: WORDS, journalism: WORDS, communications: [['skills.writing', 0.4], ['talents.writing', 0.3]],
  art: ART,
};
/** Kinds of work: a job's family (data/occupations.js), or the job itself (data/careers.js). */
export const WORK_EDGE = { tech: TECH, software: TECH, science: LAB, media: WORDS, arts: ART };

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
