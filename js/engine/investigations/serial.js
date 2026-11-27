// Bigger homicide cases.
//
//   a series      one person behind deaths in several cities. Each death is its own case, in its own city's
//                 agency, with its own detective; what links them is the same person, the same method and the
//                 evidence each case gathered. Comparing cases (a national database of violent crime) shows the link;
//                 then the evidence the other agencies found is shared into the player's file, and a federal task
//                 force may join. Nothing is linked that is not really linked.
//   a handoff     open cases pass from a detective who leaves to a colleague, with the file as it is. A player
//                 detective inherits a case whose lead has died or retired: the predecessor's work is in the file.
import { store, player } from '../../state.js';
import { COUNTRIES } from '../../data/countries.js';
import * as k from '../cases.js';
import { W, rec, now, year, me, result, seeded, working, nameOfId } from './core.js';
import { agency, agencyOf, kindsIn } from './agencies.js';
import { openCase, investigation, incidentOf, caseStatus } from './casework.js';
import { formTaskForce } from './drama.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const series = () => { const w = W(); w.series ??= {}; return w.series; };
export const seriesOf = (inv) => (inv?.file?.seriesId ? series()[inv.file.seriesId] : null);

/** A homicide the player leads may turn out to be one of several: the same person, in other cities. */
export function seriesYear(p = player()) {
  const r = rec(p);
  if (!working(r) || !(r.job.detective || r.family === 'federal')) return [];
  if (Object.values(series()).some((s) => s.ownerId === me(p) && s.status === 'open')) return [];
  const inv = r.caseIds.map(investigation).find((x) => x?.file?.template === 'homicide' && !x.file.outcome && !x.file.seriesId && incidentOf(x)?.truth?.hypothesis === 'stranger');
  if (!inv || !seeded(`${inv.id}/series`).chance(0.35)) return [];
  const perp = incidentOf(inv).truth.perpetratorId;
  const cities = (COUNTRIES[p.countryId]?.cities ?? []).filter((c) => c !== incidentOf(inv).city).slice(0, 2);
  if (!perp || !cities.length) return [];
  const id = `series_${inv.id}`;
  const caseIds = [inv.id];
  for (const city of cities) {
    const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, city);
    const det = Object.values(a.units).flatMap((u) => u.memberIds).find((x) => npc(x)?.alive);
    const other = openCase('homicide', { ownerId: a.id, lead: det, truth: 'stranger', perpId: perp, city, countryId: p.countryId });
    other.file.seriesId = id;
    caseIds.push(other.id);
  }
  inv.file.seriesId = id;
  series()[id] = { id, ownerId: me(p), perpId: perp, caseIds, opened: now(), status: 'open', linked: false };
  return [];
}
/** Compares the case with others across the country: the database shows what is really alike. */
export function compareCases(invId, p = player()) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f || f.leadId !== me(p)) return result(false, 'This case is not yours.', 'neutral');
  if (f.compared) return result(false, 'You have compared it already.', 'neutral');
  f.compared = now();
  const s = seriesOf(inv);
  if (!s) return result(true, 'You send the details to the national database of violent crime. Nothing else in the country is like it.', 'neutral');
  s.linked = now();
  const others = s.caseIds.filter((x) => x !== invId).map(investigation).filter(Boolean);
  for (const o of others) {
    // What the other agency's case gathered is shared into this one, as the records it is.
    for (const it of o.file.items) if (it.evidenceId && !inv.evidenceIds.includes(it.evidenceId)) inv.evidenceIds.push(it.evidenceId);
    f.leads.push({ id: `link_${o.id}`, text: `${o.file.title}, in ${incidentOf(o).city}: the same method, the same kind of victim. ${nm(o.file.leadId)} is the detective there.`, why: 'A database of violent crime', status: 'open', at: now() });
    o.file.log.push({ at: now(), text: `Linked to ${f.title} by ${p.firstName} ${p.lastName}.` });
  }
  if (!f.poi.includes(s.perpId) && inv.evidenceIds.some((e) => k.J().evidence[e]?.pointsTo === s.perpId)) f.poi.push(s.perpId);
  let tf = '';
  if (p.countryId === 'us' && !f.taskForceId) { const res = formTaskForce(invId, 'fbi'); if (res.ok) tf = ' The FBI joins, through a task force: one case file, shared.'; }
  return result(true, `The database returns ${others.length} other case${others.length === 1 ? '' : 's'}: ${others.map((o) => incidentOf(o).city).join(' and ')}. The same method. The other detectives share what they found.${tf}`);
}

/** A homicide whose detective has died or retired passes to the player, with the file as it is. */
export function inheritYear(p = player()) {
  const r = rec(p);
  if (!working(r) || !r.job.detective || !r.job.agencyId) return [];
  const mine = r.caseIds.map(investigation).filter((x) => x?.file && !x.file.outcome && caseStatus(x) !== 'cold');
  if (mine.length >= 3) return [];
  const gone = (id) => { const n = npc(id); return !n?.alive || n.flags?.justice?.retired; };
  const inv = Object.values(k.J().investigations).find((x) => x.agencyId === r.job.agencyId && x.file && !x.file.outcome && x.file.leadId && x.file.leadId !== me(p) && gone(x.file.leadId) && ['homicide', 'missing'].includes(x.file.template));
  if (!inv) return [];
  const from = inv.file.leadId;
  inv.file.handoff = [...(inv.file.handoff ?? []), { from, to: me(p), at: now(), why: npc(from)?.alive ? 'retired' : 'died' }];
  inv.file.leadId = me(p);
  inv.investigatorIds = [me(p), ...inv.investigatorIds.filter((x) => x !== me(p))];
  r.caseIds.push(inv.id);
  inv.file.log.push({ at: now(), text: `${nm(from)} ${npc(from)?.alive ? 'retired' : 'died'}; the case passed to ${p.firstName} ${p.lastName}. Everything ${nm(from)} did is in the file.` });
  return [`You inherit ${inv.file.title} from ${nm(from)}. Their work is in the file: read it before you redo it.`];
}
