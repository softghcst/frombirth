// Police unions. Each department's officers have a union (an association or federation), with a representative who
// is a real colleague and a contract that runs for three years. An officer may join (dues each year) or not.
//
// What a union does here, and what it does not:
//   - it bargains the contract: pay, training, and what happens to disciplinary records (kept, or removed after some
//     years). The representative's or the chief's stance, when the player holds either post, shapes it;
//   - it may vote for work to rule when talks stall (officers do exactly what the rules require, no more: cases get
//     fewer hours). Police may not strike in the countries modeled (a simplified rule, shown as such);
//   - it represents a member in a disciplinary process. The finding follows the evidence and is never changed; a
//     dismissal may go to arbitration, which sometimes reduces it to a suspension.
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { store, player, country } from '../../state.js';
import { rec, I, now, year, me, result, regard, grow, seeded, working, note, nameOfId } from './core.js';
import { agency, staffer } from './agencies.js';
import { budgetOf } from './policing.js';

const nm = (id) => nameOfId(id);
const UNION_NAME = { us: (a) => `${a.city} Police Officers' Association`, uk: () => 'the Police Federation', ca: (a) => `${a.city} Police Association`, au: () => 'the Police Association',
  de: () => 'the Gewerkschaft der Polizei', fr: () => 'Alliance Police nationale', jp: () => 'the officers\' mutual association', it: () => 'the SIULP police union', es: () => 'the JUPOL police union', br: (a) => `the civil police union of ${a.city}`, in: () => 'the police welfare association', mx: () => 'the police mutual association', kr: () => 'the police workplace council' };
/** What a union may do, by country (simplified rules, unverified). Nowhere modeled may police strike. */
const STRIKE_NOTE = {
  default: 'Police may not strike here (a simplified rule): the strongest action open to the union is working to rule.',
  uk: 'Police officers may not strike by law, and may not join a trade union; the Police Federation speaks for them instead.',
  de: 'Police are civil servants (Beamte) and may not strike; the union bargains and campaigns instead.',
  in: 'Police may not form trade unions; welfare associations speak for officers instead.',
  jp: 'Police may not form unions or strike in Japan; a mutual association looks after officers.',
  br: 'Police strikes are unlawful; some have happened all the same, and the courts have ruled against them.',
  kr: 'Police may not form unions; a workplace council represents officers.',
};
export const strikeNote = (countryId) => STRIKE_NOTE[countryId] ?? STRIKE_NOTE.default;
export const NO_STRIKE = STRIKE_NOTE.default;

/** A department's union, made once and kept: its name, its representative, its contract. */
export function unionOf(a) {
  if (!a) return null;
  if (!a.union) {
    const name = (UNION_NAME[a.countryId] ?? ((x) => `the ${x.city} police officers' union`))(a);
    a.union = { name, repId: null, contract: { from: year(), until: year() + 3, raise: 3, records: 'kept', training: false }, history: [], action: null };
  }
  const u = a.union;
  if (!u.repId || !store.state.npcs[u.repId]?.alive) {
    if (u.repId !== me()) u.repId = staffer(a.countryId, 'officer', 'Union representative', { agencyId: a.id, rank: 'sergeant' }).id;
  }
  return u;
}
const myAgency = (p = player()) => { const r = rec(p); return r?.job?.agencyId && r.family === 'police' ? agency(r.job.agencyId) : null; };
export const membership = (p = player()) => rec(p)?.union ?? null;

/** Joins the department's union: dues each year, representation in a disciplinary process, a vote. */
export function join(p = player()) {
  const r = rec(p);
  const a = myAgency(p);
  if (!working(r) || !a) return result(false, 'Only a serving officer of a department can join its union.', 'neutral');
  if (r.union?.member) return result(false, 'You are a member.', 'neutral');
  const u = unionOf(a);
  r.union = { member: true, since: year(), agencyId: a.id, rep: false };
  return result(true, `You join ${u.name}. Dues come out of your pay each year. ${nm(u.repId)} is your representative.`);
}
export function leave(p = player()) {
  const r = rec(p);
  if (!r?.union?.member) return result(false, 'You are not a member.', 'neutral');
  if (r.union.rep) { const u = unionOf(agency(r.union.agencyId)); if (u) u.repId = null; }
  r.union = { ...r.union, member: false, rep: false, left: year() };
  return result(true, 'You leave the union. No dues, no representative, no vote.', 'neutral');
}
/** Stands for union representative: colleagues vote, on years in and how they see you. */
export function standForRep(p = player()) {
  const r = rec(p);
  if (!r?.union?.member) return result(false, 'Members choose their representative from among themselves.', 'neutral');
  if (r.union.rep) return result(false, 'You are the representative.', 'neutral');
  if (year() - r.union.since < 4) return result(false, 'Members want someone who has been in the union some years.', 'neutral');
  if (r.union.stood === year()) return result(false, 'The vote was this year.', 'neutral');
  r.union.stood = year();
  const win = seeded(`${me(p)}/rep/${year()}`).chance(0.25 + r.rep.teamwork / 200 + r.skills.leadership / 300);
  if (!win) return result(true, 'Your colleagues chose someone else this time.', 'neutral');
  const u = unionOf(agency(r.union.agencyId));
  u.repId = me(p);
  r.union.rep = year();
  note(`Elected union representative for ${u.name}.`, 'career', { key: `unionrep:${year()}`, milestone: 'Elected union representative' });
  return result(true, `Elected. You represent your colleagues in ${u.name}: their contract, and their side of any disciplinary process.`);
}

// ---------- The contract ----------

/** Talks this year, when the contract ends and the player is at the table (representative or chief). */
export function talks(p = player()) {
  const r = rec(p);
  const a = r?.union?.rep ? agency(r.union.agencyId) : myAgency(p);
  if (!a) return null;
  const u = unionOf(a);
  if (u.contract.until > year()) return null;
  const side = u.repId === me(p) ? 'union' : a.chiefId === me(p) ? 'management' : null;
  return side ? { a, u, side } : null;
}
const STANCES = {
  union: { pay: 'Hold out for pay', training: 'Trade some pay for training and wellbeing support', records: 'Ask for disciplinary records to be removed after three years' },
  management: { accept: 'Agree a fair raise', resist: 'Hold the line on pay', accountability: 'Keep disciplinary records, and add body cameras' },
};
export const stancesFor = (side) => Object.entries(STANCES[side]).map(([id, label]) => ({ id, label }));
/** The player's stance at the table; the other side answers, and the contract is agreed (or the talks stall). */
export function bargain(stance, p = player()) {
  const t = talks(p);
  if (!t) return result(false, 'There are no talks you are part of this year.', 'neutral');
  const { a, u, side } = t;
  if (!STANCES[side][stance]) return result(false, 'That is not on the table.', 'neutral');
  const tight = budgetOf(a).level < 0;
  const roll = seeded(`${a.id}/talks/${year()}`);
  const c = { from: year(), until: year() + 3, raise: tight ? 2 : 3, records: u.contract.records, training: false, bodycams: u.contract.bodycams ?? false };
  let stalled = false;
  let text = '';
  if (side === 'union') {
    if (stance === 'pay') { stalled = tight && roll.chance(0.6); c.raise = stalled ? u.contract.raise : tight ? 3 : 5; text = stalled ? 'The city says there is no money. The talks stall.' : `A ${c.raise}% raise.`; }
    if (stance === 'training') { c.raise = tight ? 1 : 2; c.training = true; text = 'A smaller raise, and real training and wellbeing support.'; grow('leadership', 2); }
    if (stance === 'records') { c.records = 'removed after three years'; text = 'Disciplinary records will be removed after three years. Some colleagues are grateful; the oversight board is not.'; regard('integrity', -3); }
  } else {
    if (stance === 'accept') { c.raise = tight ? 2 : 4; text = `A ${c.raise}% raise, agreed.`; }
    if (stance === 'resist') { stalled = roll.chance(0.5); c.raise = stalled ? u.contract.raise : 1; text = stalled ? 'The union will not sign. The talks stall.' : 'A 1% raise. The union signs, unhappily.'; }
    if (stance === 'accountability') { c.records = 'kept'; c.bodycams = true; c.raise = tight ? 2 : 3; text = 'Records are kept, body cameras come in, and the raise is fair.'; regard('integrity', 2); grow('leadership', 2); }
  }
  if (stalled) { u.stalled = year(); u.history.push({ year: year(), text: 'Talks stalled.' }); return result(true, text, 'neutral'); }
  agree(a, u, c);
  return result(true, `${text} The contract runs until ${c.until}.`);
}
function agree(a, u, c) {
  u.contract = c;
  u.stalled = null;
  u.history.push({ year: year(), text: `A contract to ${c.until}: a ${c.raise}% raise${c.training ? ', training and wellbeing support' : ''}${c.bodycams ? ', body cameras' : ''}; disciplinary records ${c.records}.` });
  // Members of the department get the raise.
  const p = player();
  const r = rec(p);
  if (r?.job?.agencyId === a.id && p.career?.salary) p.career.salary = Math.round(p.career.salary * (1 + c.raise / 100));
}
/** A vote on working to rule, when talks have stalled. */
export function vote(how, p = player()) {
  const r = rec(p);
  const a = agency(r?.union?.agencyId);
  const u = a && unionOf(a);
  if (!r?.union?.member || !u?.stalled) return result(false, 'There is no vote.', 'neutral');
  if (r.union.voted === year()) return result(false, 'You have voted.', 'neutral');
  r.union.voted = year();
  const yes = seeded(`${a.id}/vote/${year()}`).chance(how === 'yes' ? 0.65 : 0.4);
  if (!yes) return result(true, 'The vote fails. Officers keep working as usual while the talks go on.', 'neutral');
  u.action = year();
  u.history.push({ year: year(), text: 'Members voted to work to rule.' });
  return result(true, `The vote passes. Officers work to rule: exactly what the rules require, no more. Cases get fewer hours. ${NO_STRIKE}`, 'neutral');
}
/** Whether a department is working to rule this year (casework.workLeft reads it). */
export const workingToRule = (agencyId) => agency(agencyId)?.union?.action === year();

/** The year: dues; a contract that ends without the player at the table is agreed anyway; stalled talks settle. */
export function unionYear(p = player()) {
  const r = rec(p);
  const out = [];
  const a = myAgency(p);
  if (!a) return out;
  const u = unionOf(a);
  if (r.union?.member && working(r)) {
    const dues = localMoney(700, country());
    p.finance.cash -= dues;
    if (r.union.rep) grow('leadership', 1);
  }
  if (u.contract.until <= year() && !talks(p) || u.stalled && u.stalled < year()) {
    const tight = budgetOf(a).level < 0;
    agree(a, u, { from: year(), until: year() + 3, raise: tight ? 2 : 3, records: u.contract.records, training: false, bodycams: u.contract.bodycams ?? false });
    out.push(`${u.name.charAt(0).toUpperCase()}${u.name.slice(1)} agreed a new contract: a ${u.contract.raise}% raise.`);
  }
  return out;
}

/**
 * Representation in a disciplinary process (oversight.js). The finding is the evidence's; a dismissal may go to
 * arbitration, which sometimes reduces it. Records removed by the contract do not count as a prior record.
 */
export function represent(c, r) {
  if (!r?.union?.member) return { action: c.action, note: null };
  const u = unionOf(agency(r.union.agencyId));
  if (c.action !== 'dismissal') return { action: c.action, note: `${u ? nm(u.repId) : 'The union representative'} sat with you through the process.` };
  const reduced = seeded(`${c.id}/arbitration`).chance(0.35);
  return reduced ? { action: 'suspension and a final warning', note: 'The union took the dismissal to arbitration. The arbitrator upheld the finding, and reduced the dismissal to a suspension.' }
    : { action: 'dismissal', note: 'The union took the dismissal to arbitration. The arbitrator upheld it.' };
}
/** Substantiated findings that count as a prior record, under the department's contract. */
export function priorRecord(r) {
  const u = agency(r?.job?.agencyId)?.union;
  const purge = u?.contract?.records === 'removed after three years';
  return r.discipline.filter((d) => d.finding === 'substantiated' && (!purge || d.year >= year() - 3));
}
export { fmtMoney };
