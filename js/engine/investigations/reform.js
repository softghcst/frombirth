// National police reform: laws a country's legislature passes that change policing everywhere in it. A player who
// holds a seat in the national legislature, or leads the government (engine/politics.js), can put a measure forward;
// it passes or fails on a vote. Otherwise reforms come in their own time, more likely after a wrongful conviction or
// a misconduct case has come to light.
//
// Each measure changes what the engine does, in that country, from the year it passed:
//   bodycams       recordings of interviews and stops: pressing a witness is on camera, and brings a complaint
//   decertify      a national record of officers dismissed for misconduct: they cannot be hired by another department
//   independent    complaints about officers are decided by an independent body, not the department
//   force          a national use-of-force standard: de-escalation is trained and expected (academy and patrol)
import { store, player } from '../../state.js';
import { W, rec, now, year, me, result, seeded, note } from './core.js';
import * as k from '../cases.js';

export const MEASURES = {
  bodycams: { name: 'Body cameras for officers', text: 'Officers record their stops and interviews; recordings are kept as evidence.', from: 2005 },
  decertify: { name: 'A national register of dismissed officers', text: 'An officer dismissed for misconduct loses their certification and cannot be hired by another department.', from: 1960 },
  independent: { name: 'Independent investigation of complaints', text: 'Complaints about officers are decided by an independent body, not the officers\' own department.', from: 1960 },
  force: { name: 'A national use-of-force standard', text: 'De-escalation first; force only when necessary and proportionate, and reported every time.', from: 1960 },
};
const R = () => { const w = W(); w.reform ??= {}; return w.reform; };
/** The reforms in force in a country, by measure, with the year each passed. */
export const reformsIn = (countryId) => R()[countryId] ?? {};
export const inForce = (countryId, measure) => !!reformsIn(countryId)[measure];

function pass(countryId, measure, by) {
  R()[countryId] ??= {};
  if (R()[countryId][measure]) return false;
  R()[countryId][measure] = { year: year(), by };
  return true;
}
/** Whether the player can put a measure to the national legislature now. */
export function canPropose(p = player()) {
  return ['seat', 'head'].includes(p.politics?.officeId) ? '' : 'Only a member of the national legislature or the head of government can put a measure forward.';
}
/** Puts a measure to a vote, once a year. The head of government carries more votes than one member. */
export function propose(measure, p = player()) {
  const why = canPropose(p);
  if (why) return result(false, why, 'neutral');
  const m = MEASURES[measure];
  if (!m || year() < m.from) return result(false, 'That is not a measure that can be put forward now.', 'neutral');
  if (inForce(p.countryId, measure)) return result(false, 'It is already law.', 'neutral');
  p.politics.reformYear ??= {};
  if (p.politics.reformYear[year()]) return result(false, 'You put a measure forward this year already.', 'neutral');
  p.politics.reformYear[year()] = measure;
  const pressure = scandals(p.countryId);
  const chance = (p.politics.officeId === 'head' ? 0.55 : 0.3) + pressure * 0.1;
  if (!seeded(`${p.countryId}/${measure}/${year()}/vote`).chance(Math.min(0.85, chance))) return result(true, `${m.name}: the measure failed on the vote. It may be tried again another year.`, 'neutral');
  pass(p.countryId, measure, me(p));
  note(`${m.name} became law, on a measure you put forward.`, 'career', { key: `reform:${measure}`, milestone: `Passed ${m.name.toLowerCase()}`, significance: 2, log: false });
  return result(true, `${m.name} is law. ${m.text}`);
}
/** Wrongful convictions and substantiated misconduct that came to light in recent years: pressure for reform. */
function scandals(countryId) {
  const wrongful = Object.values(k.J().incidents).filter((i) => i.countryId === countryId && i.wrongful).length;
  const misconduct = Object.values(W().complaints).filter((c) => c.finding === 'substantiated' && c.decided >= now() - 60).length;
  return Math.min(3, wrongful + Math.floor(misconduct / 2));
}
/** The year: a reform may pass without the player, more likely after scandals. */
export function reformYear(p = player()) {
  const out = [];
  const c = p.countryId;
  const roll = seeded(`${c}/reform/${year()}`);
  const chance = 0.03 + scandals(c) * 0.04;
  if (!roll.chance(chance)) return out;
  const open = Object.entries(MEASURES).filter(([id, m]) => year() >= m.from && !inForce(c, id));
  if (!open.length) return out;
  const [id, m] = roll.pick(open);
  if (pass(c, id, null)) out.push(`National police reform: ${m.name.toLowerCase()} became law. ${m.text}`);
  return out;
}
/** For the Public Safety page and the officer: what is in force here. */
export function reformList(countryId = player().countryId) {
  return Object.entries(MEASURES).map(([id, m]) => ({ id, ...m, passed: reformsIn(countryId)[id]?.year ?? null, available: year() >= m.from }));
}
/** Whether an officer's certification was revoked (dismissed for misconduct after the register came in). */
export function decertified(p = player()) {
  const r = rec(p);
  const reg = reformsIn(p.countryId).decertify;
  return !!reg && !!r?.discipline?.some((d) => d.dismissed && d.year >= reg.year);
}
