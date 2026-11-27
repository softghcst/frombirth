// Family court, for the player's own parents: when separating parents cannot agree where their child should live,
// the question goes to mediation, and failing that, to a judge. And child support: the parent the child does not
// mainly live with pays toward their keep. Both follow the separation in engine/blended.js.
//
// The case is kept with every other case, in the justice record (engine/cases.js), under J().family, with an id of its
// own; its judge is one of the country's judges (bench), a real person who ages and retires. The parents' lawyers are
// recorded by kind, not made up as people. The court decides on the child's welfare as the game can see it: where they
// have been living and doing well (continuity), each parent's bond with them, the distance between the two homes, and,
// from ten, what the child says (from twelve, strongly). Never on which parent has more money. A judge, not a lawyer,
// decides; mediation is the parents agreeing, with help.
//
//   J().family[id] = { id, kind:'custody', year, countryId, court, parents:[a,b], childId, judgeId, stage, mediation,
//                      heard:{ wish, age } | null, decision:{ primaryId, schedule, by:'agreement'|'judge', year } | null,
//                      history:[{ year, text }] }
//   arrangement.support = { payerId, payeeId, amountYear, since, paid, ended? }   (engine/blended.js arrangement)
import { clamp, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import * as k from './cases.js';
import { recordEvent } from './chronicle.js';
import { storyBeat } from './storyDirector.js';
import { keyedDice, onOwnDice } from './keyedDice.js';
import { rule } from './rules.js';

const npc = (id) => store.state.npcs[id] ?? null;
const S = () => store.state;
const dice = (tag) => keyedDice(`court/${S().slotId}/${S().player.id}/${S().year}/${tag}`);

/** What the court that decides where a child lives is called. */
export const familyCourtName = (countryId) => ({ au: 'Federal Circuit and Family Court', nz: 'Family Court', uk: 'Family Court', ie: 'District Court (family)', us: 'Family Court', ca: 'Family Court' })[countryId] ?? 'Family Court';

const families = () => (k.J().family ??= {});
export const familyCases = (p = player()) => Object.values(families()).filter((c) => c.childId === p.id);
export const openFamilyCase = (p = player()) => familyCases(p).find((c) => c.stage !== 'decided') ?? null;

/** Whether separating parents end up in court: more often where both are close to the child; never before courts did this. */
export function disputed(staying, leaving, year = S().year) {
  if (year < 1970) return false;
  const both = Math.min(staying.meters.relationship, leaving.meters.relationship);
  return dice(`disputed/${leaving.id}`).chance(both >= 60 ? 0.3 : both >= 45 ? 0.18 : 0.08);
}

/** Opens a case: the parents could not agree. The arrangement in place until it is decided is temporary. */
export function openCustodyCase(staying, leaving, arrangement) {
  const p = player();
  const judgeId = onOwnDice(`court-bench/${S().slotId}/${S().year}`, () => k.bench(p.countryId).judges[0]);
  const c = { id: k.newId('family'), kind: 'custody', year: S().year, countryId: p.countryId, court: familyCourtName(p.countryId),
    parents: [staying.id, leaving.id], childId: p.id, judgeId, stage: 'mediation', mediation: true, heard: null, decision: null,
    counsel: { [staying.id]: dice('counsel/a').pick(['a family lawyer', 'legal aid', 'no lawyer']), [leaving.id]: dice('counsel/b').pick(['a family lawyer', 'legal aid', 'no lawyer']) },
    history: [{ year: S().year, text: `${staying.firstName} and ${leaving.firstName} could not agree where ${p.firstName} should live. The case went to ${familyCourtName(p.countryId)}, starting with mediation.` }] };
  families()[c.id] = c;
  arrangement.basis = 'temporary order';
  arrangement.caseId = c.id;
  for (const id of c.parents) k.note(id, 'family', `A custody case at ${c.court}.`, c.id);
  log(`Your parents could not agree where you should live. It has gone to ${c.court}; until it is settled, you stay with ${staying.firstName}.`, 'system', 'neutral');
  if (p.age >= 10) storyBeat('blend_custody_heard', { staying: staying.id, leaving: leaving.id }, { source: 'family', must: true });
  return c;
}

/** The child says where they would like to live (from the scene). Heard from ten; weighed most from twelve. */
export function hearChild(wish) {
  const c = openFamilyCase();
  const p = player();
  if (!c || p.age < 10) return '';
  c.heard = { wish, age: p.age };
  c.history.push({ year: S().year, text: `The court heard from ${p.firstName}, then ${p.age}.` });
  const who = npc(wish);
  return who ? `You tell the court officer you would like to live with ${who.firstName}. They write it down, and say it will be listened to.` : 'You tell them you love them both, and want to see both. They write that down too.';
}

/** The year after a case opens: mediation settles it, or a judge decides. Once. */
export function tickFamilyCourt(arrangement, swapHome) {
  const c = openFamilyCase();
  if (!c || S().year <= c.year) return null;
  const p = player();
  const [a, b] = c.parents.map(npc);
  if (!a?.alive || !b?.alive) { c.stage = 'decided'; c.decision = { primaryId: (a?.alive ? a : b)?.id ?? null, by: 'events', year: S().year }; c.history.push({ year: S().year, text: 'The case ended without a decision.' }); return c; }
  const d = dice(`decide/${c.id}`);
  const score = (n) => {
    let s = (n.meters.relationship - 50) / 25;
    if (n.id === arrangement.primaryId) s += 0.8; // where the child has been living, and settled
    if (n.city && p.city && n.city !== p.city) s -= 0.6; // a move away from school and friends
    if (c.heard?.wish === n.id) s += c.heard.age >= 12 ? 1.6 : 0.8;
    if (c.heard && !c.heard.wish) s += 0; // both: the child wants both
    return s;
  };
  // Most cases settle in mediation; the rest a judge decides.
  const settled = d.chance(0.45);
  const best = score(a) >= score(b) ? a : b;
  const near = Math.abs(score(a) - score(b)) < 0.5 && a.city === b.city && S().year >= 1990;
  const schedule = near ? 'shared' : a.city !== b.city ? 'holidays' : 'weekends';
  c.stage = 'decided';
  c.decision = { primaryId: best.id, schedule, by: settled ? 'agreement' : 'judge', year: S().year };
  const judge = npc(c.judgeId);
  const how = settled ? 'In mediation, your parents agreed' : `${judge ? `Judge ${judge.lastName}` : 'The judge'} decided`;
  c.history.push({ year: S().year, text: `${how}: ${p.firstName} lives mainly with ${best.firstName}, ${schedule === 'shared' ? 'with shared care' : `seeing the other parent at ${schedule}`}.` });
  arrangement.basis = settled ? 'agreed in mediation' : 'court order';
  arrangement.schedule = schedule;
  if (best.id !== arrangement.primaryId) swapHome(arrangement, best, settled ? 'agreed in mediation' : 'court order');
  else arrangement.history.push({ year: S().year, primaryId: best.id, schedule, why: settled ? 'agreed in mediation' : 'court order' });
  log(`${how}: you will live mainly with ${best.firstName}${schedule === 'shared' ? ', and half the time with each of them' : ''}.${c.heard?.wish === best.id ? ' They listened to you.' : ''}`, 'system', 'neutral');
  recordEvent({ key: `court:${c.id}`, type: 'family_court', title: settled ? 'Your parents agreed where you would live' : 'A court decided where you would live', people: c.parents, significance: 2, privacy: 'private', caseId: c.id });
  return c;
}

// ---------- Child support ----------

/** Sets up what the parent who moved out pays toward the child's keep: a share of their income, where the law has it. */
export function setSupport(arrangement, payer, payee) {
  const p = player();
  if (S().year < 1950 || arrangement.schedule === 'shared') { delete arrangement.support; return null; }
  const income = payer.income ?? payer.life?.job?.salary ?? 0;
  const amountYear = Math.round(clamp(income * 0.15, 0, income * 0.3));
  if (!amountYear) return null;
  arrangement.support = { payerId: payer.id, payeeId: payee.id, amountYear, since: S().year, paid: 0 };
  return arrangement.support;
}

/** Once a year: the support is paid from one household to the other, until the child is grown. */
export function paySupport(arrangement) {
  const s = arrangement?.support;
  if (!s || s.ended) return null;
  const p = player();
  const payer = npc(s.payerId);
  const payee = npc(s.payeeId);
  if (p.age >= 18 || !payer?.alive || !payee?.alive) { s.ended = S().year; return null; }
  const paid = Math.min(s.amountYear, Math.max(0, payer.savings ?? 0) + Math.max(0, payer.income ?? 0));
  payer.savings = (payer.savings ?? 0) - paid;
  payee.savings = (payee.savings ?? 0) + paid;
  s.paid += paid;
  if (!s.told) { s.told = true; log(`${payer.firstName} pays ${fmtMoney(paid, country())} a year toward your keep.`, 'system', 'neutral'); }
  return paid;
}

