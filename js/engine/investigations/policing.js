// Policing and public accountability: what government decides about the police, and what a chief
// can decide inside a department. Each has its own authority and no more: a mayor or council sets
// the budget (engine/local.js `safety`, with the country's own police policy, read through
// engine/policy.js) and may create a civilian oversight board; a chief sets the department's
// priorities; a county sheriff is elected. None of them decides a case, and none of them commands
// a court or a prosecutor.
//
// Contested questions (a civilian review board) are shown with the arguments people actually make
// on both sides; no position is the right answer by default, and the outcome is a vote.
//
//   agency.budget     { year, level: -1|0|1, words }       read each year from policy
//   agency.priority   { year, focus, by }                  the chief's focus for the year
//   agency.oversight  { board: boolean, since, history[] } a civilian oversight board, if the city made one
//   agency.elections  [{ year, winnerId, votes }]          for an elected sheriff
import { clamp } from '../../util.js';
import { store, player, log } from '../../state.js';
import { policingShift } from '../policy.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { promote, hire } from '../career.js';
import { W, I, rec, now, year, me, result, note, grow, regard, seeded, reputationOf, nameOfId } from './core.js';
import { agency, agencyOf, kindsIn, staffer } from './agencies.js';

const npc = (id) => store.state.npcs[id] ?? null;

/** The budget a department works with this year, from the policies in force where it is. */
export function budgetOf(a) {
  if (!a) return { level: 0, words: 'steady' };
  if (a.budget?.year === year()) return a.budget;
  const shift = policingShift(a.countryId);
  const level = shift >= 0.03 ? 1 : shift <= -0.03 ? -1 : 0;
  a.budget = { year: year(), level, words: level > 0 ? 'increased' : level < 0 ? 'cut' : 'steady' };
  return a.budget;
}

export const FOCUS = {
  training: { name: 'Training', sub: 'Better academies and in-service training.' },
  investigations: { name: 'Investigations', sub: 'More hours for detectives\' caseloads.' },
  community: { name: 'Community relations', sub: 'Officers who know the people on their beat.' },
  technology: { name: 'Laboratory and technology', sub: 'Faster laboratory work.' },
};
/** The department's focus this year: set by the chief, or (when the chief is not the player) their own choice. */
export function priorityOf(a) {
  if (!a) return null;
  if (a.priority?.year === year()) return a.priority.focus;
  if (a.chiefId !== me()) a.priority = { year: year(), focus: seeded(`${a.id}/focus/${year()}`).pick(Object.keys(FOCUS)), by: a.chiefId };
  return a.priority?.year === year() ? a.priority.focus : null;
}
/** A chief sets the department's focus, once a year. */
export function setPriority(focus) {
  const r = rec();
  const a = agency(r?.job?.agencyId);
  if (!a || a.chiefId !== me()) return result(false, 'Only the chief sets the department\'s priorities.', 'neutral');
  if (!FOCUS[focus]) return result(false, 'Choose a focus.', 'neutral');
  if (a.priority?.year === year() && a.priority.by === me()) return result(false, 'The year\'s priorities are set.', 'neutral');
  a.priority = { year: year(), focus, by: me() };
  grow('leadership', 3);
  return result(true, `The department's priority this year: ${FOCUS[focus].name.toLowerCase()}. ${FOCUS[focus].sub}`);
}

/** Months a laboratory request takes here, given the budget and the department's focus. */
export function labMonths(ownerId, months) {
  const a = agency(ownerId);
  if (!a) return months;
  const b = budgetOf(a).level;
  const tech = priorityOf(a) === 'technology' ? 1 : 0;
  return Math.max(1, months - b - tech);
}
/** Extra hours a detective has for each case this year, given the department's focus and budget. */
export function hoursBonus(ownerId) {
  const a = agency(ownerId);
  if (!a) return 0;
  return (priorityOf(a) === 'investigations' ? 2 : 0) + budgetOf(a).level;
}
/** What the academy gains from the department's training focus and budget. */
export function trainingBonus(ownerId) {
  const a = agency(ownerId);
  if (!a) return 0;
  return (priorityOf(a) === 'training' ? 5 : 0) + budgetOf(a).level * 3;
}

// ---------- A civilian oversight board ----------

export const BOARD_ARGUMENTS = {
  for: ['Independent review of complaints builds public trust, especially where it has been low.', 'People outside the department may see patterns the department misses.', 'Complainants may come forward who would not to the police themselves.'],
  against: ['Reviewers without police experience may misjudge what officers faced.', 'It adds cost and can duplicate the department\'s own professional standards unit.', 'Officers may become more cautious in ways that are not always good for the public.'],
};
/**
 * Proposes (or proposes ending) a civilian oversight board for the city's police. Only a mayor or a council member
 * can propose it; the council votes. A chief may testify for or against; a chief cannot decide it.
 */
export function proposeBoard(create = true) {
  const p = player();
  if (!['council', 'mayor'].includes(p.politics?.officeId)) return result(false, 'Only the mayor or a council member can put this to the council.', 'neutral');
  const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
  a.oversight ??= { board: false, since: null, history: [] };
  if (a.oversight.board === create) return result(false, create ? 'There is a board already.' : 'There is no board to end.', 'neutral');
  if (a.oversight.history.some((h) => h.year === year())) return result(false, 'The council has voted on this already this year.', 'neutral');
  const roll = seeded(`${a.id}/board/${year()}`);
  const support = 0.45 + (p.stats.charm - 50) / 300 + (p.politics.officeId === 'mayor' ? 0.08 : 0) + roll.next() * 0.2 - 0.1;
  const passed = support >= 0.5;
  a.oversight.history.push({ year: year(), proposal: create ? 'create' : 'end', passed, by: me() });
  if (passed) { a.oversight.board = create; a.oversight.since = create ? year() : null; }
  note(`${create ? 'Proposed a civilian oversight board' : 'Proposed ending the civilian oversight board'}: the council ${passed ? 'agreed' : 'voted it down'}.`, 'politics', { log: false });
  return result(true, `The council voted ${passed ? 'for' : 'against'} it.${passed && create ? ' Complaints about officers will now be reviewed by a board of residents, alongside the department.' : ''}`, 'neutral');
}
/** Who decides a complaint about an officer: the department's own unit, or the civilian board where there is one. */
export const reviewerFor = (agencyId) => (agency(agencyId)?.oversight?.board ? 'board' : 'department');

// ---------- An elected sheriff ----------

/** Whether the player can stand for sheriff this year: a county agency, an election year, enough experience. */
export function sheriffBlock(p = player()) {
  const r = rec(p);
  if (p.countryId !== 'us') return 'Sheriffs are elected in the United States.';
  if (!r?.job || r.family !== 'police') return 'Stand from inside law enforcement.';
  if (r.stats.years < 8) return 'Voters expect years of service first.';
  if (year() % 4 !== 0) return `The next election for sheriff is in ${year() + (4 - (year() % 4))}.`;
  const a = agencyOf('county', p.countryId, p.city);
  if (a.chiefId === me()) return 'You are the sheriff.';
  if ((a.elections ?? []).some((e) => e.year === year())) return 'This year\'s election has been held.';
  return '';
}
/** Stands for sheriff. The voters decide; the incumbent has an advantage. */
export function runForSheriff() {
  const p = player();
  const r = I();
  const block = sheriffBlock(p);
  if (block) return result(false, block, 'neutral');
  const a = agencyOf('county', p.countryId, p.city);
  const roll = seeded(`${a.id}/sheriff/${year()}/${me()}`);
  const mine = reputationOf(r) * 0.4 + p.stats.charm * 0.4 + r.skills.leadership * 0.2 + roll.int(-12, 12);
  const theirs = 58 + roll.int(-10, 10);
  const won = mine > theirs;
  const share = clamp(Math.round(50 + (mine - theirs) / 2), 20, 80);
  a.elections = [...(a.elections ?? []), { year: year(), winnerId: won ? me() : a.chiefId, share }];
  if (!won) return result(true, `You lost the election for sheriff to ${nameOfId(a.chiefId)}, with ${share}% of the vote.`, 'neutral');
  const old = npc(a.chiefId);
  if (old) { old.occupation = 'Former sheriff'; if (old.flags.justice) old.flags.justice.retired = year(); }
  a.chiefId = me();
  a.chiefSince = year();
  r.job = { ...r.job, agencyId: a.id, employerId: a.employerId, rank: 'chief', rankSince: year(), detective: false };
  p.career.employerId = a.employerId;
  if (p.career.careerId !== 'police') hire(CAREER_BY_ID.police, 3, 70, 'election', { employerId: a.employerId });
  while (p.career.level < 3 && promote()) { /* the payroll follows the office */ }
  p.career.title = 'Sheriff';
  regard('leadership', 5);
  note(`Elected sheriff with ${share}% of the vote.`, 'career', { key: `sheriff:${a.id}:${year()}`, milestone: 'Elected sheriff.', significance: 3 });
  return result(true, `You won, with ${share}% of the vote. You are the sheriff: you run the office; you do not run the courts or the prosecutor.`);
}
