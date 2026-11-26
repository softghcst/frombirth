// Hospitals and investigations. A person hurt in a crime is taken to a real hospital of the city; a player physician
// working there may be the one who treats them. The police may ask for medical information, and get it only lawfully:
// with the patient's consent, or with a court order on a proper basis. The hospital shares documented findings, not
// the whole chart; nothing here makes a diagnosis. Medical care is decided by the medical side, the case by the courts.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import * as k from '../cases.js';
import { cityEmployers } from '../employers.js';
import { W, rec, now, year, me, result, seeded, regard, grow, nameOfId } from './core.js';
import { investigation, incidentOf } from './casework.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const INJURY = ['robbery', 'family', 'homicide', 'collision'];
const med = (p) => p.medicine ?? null;
/** The person hurt in a case who is alive to be treated, if any. */
export function patientOf(inv) {
  const f = inv?.file;
  if (!f || !INJURY.includes(f.template)) return null;
  const id = f.template === 'robbery' ? f.reportingId : f.victimId;
  return npc(id)?.alive ? id : null;
}
/** The hospital a case's injured person was taken to: the player's own, when they work at one in the city. */
export function hospitalFor(inv, p = player()) {
  const f = inv.file;
  if (f.hospitalId) return f.hospitalId;
  const inc = incidentOf(inv);
  const mine = med(p)?.job?.hospitalId;
  let list = [];
  try { list = cityEmployers(inc.countryId, inc.city).filter((e) => e.family === 'health'); } catch { list = []; }
  const own = mine && (store.state.jobs?.employers?.[mine]?.city === inc.city) ? mine : null;
  f.hospitalId = own ?? (list.length ? seeded(`${inv.id}/hospital`).pick(list).id : null);
  return f.hospitalId;
}

// ---------- The police side ----------

export const ASK = {
  consent: 'Ask the patient for consent to share their medical findings',
  order: 'Ask a judge for an order for the medical findings',
  informal: 'Ask someone at the hospital to tell you, informally',
};
/** A request for medical information in a case: lawful ways only get an answer. */
export function requestMedical(invId, how, p = player()) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f || f.leadId !== me(p)) return result(false, 'This case is not yours.', 'neutral');
  const pt = patientOf(inv);
  if (!pt) return result(false, 'Nobody in this case was treated at a hospital who could be asked.', 'neutral');
  if (f.medical) return result(false, 'The medical findings are in the file already.', 'neutral');
  hospitalFor(inv, p);
  if (how === 'informal') {
    regard('ethics', -4);
    f.log.push({ at: now(), text: 'Asked hospital staff for a patient\'s information informally. They refused, as they must.' });
    return result(true, 'The nurse you asked says no, and reports the request to the hospital\'s privacy officer. Patient records are not shared over a coffee.', 'bad');
  }
  const roll = seeded(`${inv.id}/medical/${how}`);
  const yes = how === 'consent' ? roll.chance(0.75) : (k.J().incidents[inv.incidentId]?.offenseId !== 'theft' && roll.chance(0.8));
  if (!yes) { f.log.push({ at: now(), text: how === 'consent' ? `${nm(pt)} declined to share their medical information. That is their right.` : 'The judge refused the order: the file does not show why the medical information is needed.' }); return result(true, how === 'consent' ? `${nm(pt)} does not want their records shared. That is their right, and it proves nothing.` : 'The judge refuses the order.', 'neutral'); }
  // The hospital shares what was documented about the injuries in this incident: not the chart, and no new diagnosis.
  const h = store.state.jobs?.employers?.[f.hospitalId];
  f.medical = { at: now(), how, hospitalId: f.hospitalId };
  f.log.push({ at: now(), text: `${h?.name ?? 'The hospital'} shared the documented injuries from that night${how === 'consent' ? `, with ${nm(pt)}'s consent` : ', under a court order'}: consistent with the account given. Nothing else from the record.` });
  grow('law', 1);
  return result(true, `${h?.name ?? 'The hospital'} sends the documented findings on the injuries from that night, and nothing more.`);
}

// ---------- The physician's side ----------

/** For a player physician: a patient from a real case at their hospital, and the police's request about them. */
export function hospitalYear(p = player()) {
  const m = med(p);
  const here = m?.job?.hospitalId;
  if (!here || !p.alive) return [];
  W().medRequests ??= {};
  if (Object.values(W().medRequests).some((x) => x.doctorId === me(p) && x.status === 'open')) return [];
  const inv = Object.values(k.J().investigations).find((x) => x.file && !x.file.outcome && patientOf(x) && hospitalFor(x, p) === here && !Object.values(W().medRequests).some((r) => r.invId === x.id));
  if (!inv) return [];
  const id = `mr_${inv.id}`;
  W().medRequests[id] = { id, invId: inv.id, patientId: patientOf(inv), doctorId: me(p), detectiveId: inv.file.leadId, status: 'open', at: now() };
  return [`${nm(patientOf(inv))}, hurt in ${inv.file.title}, was brought in to your hospital. A detective is asking about them.`];
}
export const myRequests = (p = player()) => Object.values(W().medRequests ?? {}).filter((x) => x.doctorId === me(p) && x.status === 'open');
export const ANSWER = {
  consent: 'Treat them; tell the detective you can share findings only with the patient\'s consent or a court order',
  chart: 'Treat them, and hand the detective the full chart',
};
export function answerRequest(id, how, p = player()) {
  const q = W().medRequests?.[id];
  if (!q || q.status !== 'open' || q.doctorId !== me(p)) return result(false, 'That request is closed.', 'neutral');
  q.status = 'answered'; q.how = how;
  const inv = investigation(q.invId);
  if (how === 'consent') {
    p.career.performance = clamp((p.career.performance ?? 50) + 2);
    const ok = seeded(`${id}/consent`).chance(0.75);
    if (ok && inv?.file && !inv.file.medical) { inv.file.medical = { at: now(), how: 'consent', hospitalId: inv.file.hospitalId }; inv.file.log.push({ at: now(), text: `With ${nm(q.patientId)}'s consent, the treating physician shared the documented injuries. Nothing else from the record.` }); }
    return result(true, ok ? `You treat ${nm(q.patientId)}, and ask them. They agree; the detective gets the documented findings on the injuries, and nothing else.` : `You treat ${nm(q.patientId)}, and ask them. They say no. The detective will need a court order, if a court will give one.`);
  }
  // The whole chart to the police, without consent or an order: a breach of the patient's privacy.
  p.career.performance = clamp((p.career.performance ?? 50) - 15);
  p.flags.privacyBreach = (p.flags.privacyBreach ?? 0) + 1;
  const n = npc(q.patientId); if (n) n.meters.relationship = clamp(n.meters.relationship - 25);
  if (inv?.file) inv.file.log.push({ at: now(), text: 'The full medical chart was handed to the police without consent or an order. The defense will ask how it was obtained.' });
  return result(true, `You hand over the whole chart. The hospital's privacy officer finds out; it goes to the medical board, and ${nm(q.patientId)} files a complaint.`, 'bad');
}
