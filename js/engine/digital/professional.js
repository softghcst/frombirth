// The professional network. A profile there is the player's real record —
// their actual degrees and jobs — and what it can do is limited to what is
// real: a contact who works somewhere can put in a word for the player there;
// a recruiter can point them at a kind of job that exists. It never makes up
// a vacancy, and the Occupation Engine still decides who is hired.
import { idolWork } from '../kpop.js';
import { rng } from '../../rng.js';
import { store, player } from '../../state.js';
import { CAREER_BY_ID } from '../../data/careers.js';
import { charOf, acts, result, recordEvent, spendHours } from './core.js';
import { platformOpen } from './tech.js';
import { accountOn, connection } from './accounts.js';

export const PRO = 'guildhall';

/** The player's résumé, read from their education and career records. */
export function resume(charId = player().id) {
  const c = charOf(charId);
  if (!c?.education) return null;
  const degrees = (c.education.degrees ?? []).map((d) => ({ what: d.type, field: d.majorId ?? null, school: d.school ?? null, age: d.age }));
  const jobs = [...(c.career.history ?? []).map((h) => ({ title: h.title, from: h.from, to: h.to, careerId: h.careerId })),
    ...(c.career.careerId ? [{ title: c.career.title, from: c.age - (c.career.yearsInRole ?? 0), to: null, careerId: c.career.careerId, current: true }] : [])];
  // Idol work is work: on the CV with the rest (engine/kpop.js).
  const idol = c === player() ? idolWork(c) : null;
  if (idol?.current) jobs.push({ title: idol.title, from: idol.since != null ? c.age - (store.state.year - idol.since) : c.age, to: null, careerId: 'idol', current: true });
  return { degrees, jobs, skills: Object.entries(c.skills ?? {}).filter(([, v]) => v >= 40).map(([k]) => k) };
}

/** People who could refer the player: in their life, working, and connected to them professionally (or close). */
export function referralOptions() {
  const p = player();
  const mine = accountOn(p.id, PRO);
  if (!mine || !platformOpen(PRO)) return [];
  return p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.life?.job?.careerId && CAREER_BY_ID[n.life.job.careerId])
    .map((n) => {
      const theirs = accountOn(n.id, PRO);
      const linked = theirs && connection(mine, theirs) === 'mutual';
      return { npc: n, career: CAREER_BY_ID[n.life.job.careerId], linked, why: !linked && n.meters.relationship < 50 ? 'You are not connected, and not close enough to ask.' : '' };
    });
}

/** Asks someone to put in a word at their workplace. Helps an application there for a year; it does not create a job. */
export function askReferral(npcId) {
  const p = player();
  const opt = referralOptions().find((o) => o.npc.id === npcId);
  if (!opt) return result(false, 'They cannot refer you anywhere.');
  if (opt.why) return result(false, opt.why);
  if (acts()[`ref:${npcId}`]) return result(false, 'You already asked them this year.');
  if (!spendHours(1)) return result(false, 'No spare time left this year.');
  acts()[`ref:${npcId}`] = true;
  const n = opt.npc;
  const yes = rng.chance(Math.min(0.9, 0.2 + n.meters.relationship / 120 + (opt.linked ? 0.15 : 0)));
  if (!yes) return result(false, `${n.firstName} said they would rather not vouch for anyone at work just now.`, 'neutral');
  p.flags.referrals = { ...(p.flags.referrals ?? {}), [opt.career.id]: p.age };
  n.lastInteractionAge = p.age;
  const text = `${n.firstName} will put in a word for you if you apply in ${opt.career.name.toLowerCase()}, where they work as ${n.life.job.title.toLowerCase()}.`;
  recordEvent({ kind: 'referral', charIds: [p.id, n.id], platformId: PRO, ref: { type: 'npc', id: n.id }, summary: text, visibility: 'private' });
  return result(true, `${text} It will help for about a year.`, 'good');
}

/** Now and then a recruiter writes to someone with a strong record, about the kind of work they already do. */
export function tickProfessional() {
  const p = player();
  const mine = accountOn(p.id, PRO);
  if (!mine || !platformOpen(PRO) || !p.career?.careerId || p.career.performance < 70) return;
  if (!rng.chance(0.15)) return;
  const career = CAREER_BY_ID[p.career.careerId];
  if (!career) return;
  p.flags.referrals = { ...(p.flags.referrals ?? {}), [career.id]: p.age };
  recordEvent({ kind: 'recruited', charIds: [p.id], platformId: PRO, summary: `A recruiter found your ${PLATFORM_NAME} profile and wrote to you about ${career.name.toLowerCase()} roles. If you apply for one this year, they will put you forward.`, visibility: 'private', once: `recruit_${p.id}_${store.state.year}` });
}
const PLATFORM_NAME = 'Guildhall';
