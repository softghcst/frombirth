// School and study, online: the school's own systems, study groups with real
// classmates, a portfolio of finished work, and digital skills learned along
// the way. Popularity online is never an academic qualification: nothing here
// reads a follower count.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { world, charOf, acts, result, recordEvent, spendHours } from './core.js';
import { techAvailable, accessFor } from './tech.js';
import { account, activeAccountsOf } from './accounts.js';
import { literacy } from './creator.js';

/** What the school offers online, by era: nothing, email, or a portal with grades and homework. */
export function schoolSystems(p = player()) {
  if (!p.education?.enrolled) return null;
  const portal = techAvailable('web') && techAvailable('email');
  const email = techAvailable('email');
  if (!email) return { kind: 'paper', text: 'School news comes home on paper, in the bottom of a bag.' };
  return { kind: portal ? 'portal' : 'email', text: portal ? 'The school portal has your marks, homework and messages from teachers.' : 'The school emails home about trips and the school calendar.', gpa: p.education.gpa, absences: p.education.absences };
}

/** Classmates who could study together online. */
export const studyMates = () => player().npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'classmate');

/**
 * An online study group with classmates, once a year. Helps a little with
 * marks, more for those who put the work in, and brings classmates closer.
 */
export function studyGroup() {
  const p = player();
  if (!p.education?.enrolled) return result(false, 'You are not studying.');
  if (!(techAvailable('instant') || techAvailable('email')) || !accessFor('web')) return result(false, 'There is no way to study together online yet.');
  if (acts().studyGroup) return result(false, 'Your study group already met this year.');
  if (!spendHours(12)) return result(false, 'No spare time left this year.');
  acts().studyGroup = true;
  const mates = studyMates().slice(0, 4);
  const gain = Math.round(clamp(0.02 + (p.education.effort ?? 50) / 1500 + p.stats.intellect / 2500 + rng.around(0, 0.02), 0, 0.12) * 100) / 100;
  p.education.gpa = Math.round(Math.min(4, p.education.gpa + gain) * 100) / 100;
  for (const n of mates) { n.meters.relationship = clamp(n.meters.relationship + rng.int(2, 4)); n.lastInteractionAge = p.age; }
  literacy(p.id, 2);
  return result(true, `${mates.length ? `You, ${mates.map((n) => n.firstName).join(', ')}` : 'You and a few people from your course'} studied together online through the year.${gain > 0 ? ' Your marks crept up.' : ''}`, 'good');
}

// ---------- Portfolio ----------

/** Finished work the player has chosen to show, on one account. */
export function portfolio(accountId) {
  const a = account(accountId);
  return (a?.portfolio ?? []).map((id) => world().projects[id]).filter(Boolean);
}

export function addToPortfolio(accountId, projectId) {
  const a = account(accountId);
  const x = world().projects[projectId];
  if (!a || a.ownerId !== player().id || a.status !== 'active') return result(false, 'That is not one of your accounts.');
  if (!x || x.ownerId !== player().id || !['ready', 'published'].includes(x.status)) return result(false, 'Only finished work can go in a portfolio.');
  a.portfolio ??= [];
  if (a.portfolio.includes(projectId)) return result(false, 'It is already there.');
  a.portfolio.push(projectId);
  if (a.portfolio.length === 1) recordEvent({ kind: 'portfolio', charIds: [player().id], platformId: a.platformId, ref: { type: 'account', id: a.id }, summary: `You put together a portfolio of your work, starting with ${x.title}.`, visibility: 'public', once: `portfolio_${player().id}` });
  return result(true, `${x.title} is in your portfolio.`, 'good');
}

/** How strong the player's best portfolio is, 0–1: the quality of the work in it, not who has seen it. */
export function portfolioStrength(charId = player().id) {
  let best = 0;
  for (const a of activeAccountsOf(charId)) {
    const items = portfolio(a.id).filter((x) => x.quality >= 0.5);
    if (items.length >= 2) best = Math.max(best, items.reduce((s, x) => s + x.quality, 0) / items.length);
  }
  return best;
}

/** Digital skills, for the profile: grown with use, never inferred from money or age. */
export const literacyOf = (charId = player().id) => Math.round(world().wellbeing[charId]?.literacy ?? 10);

export { charOf };
