// Casework: the case file an investigator works, on top of the justice system's own records.
//
// One case, one identity. A case is an incident and an investigation in engine/cases.js
// (store.state.justice). Its file is a field on that same investigation (inv.file), so the
// prosecutor's charge, the defense's disclosure, the court's verdict and any appeal all belong to it.
//
// Every clue has a source. When a case is made, its facts are set from what actually happened
// (the incident's truth): the scene, the records, what each witness saw and how well, what a
// laboratory could find. These are the case's clues. Each step the investigator takes reveals the
// clues that step can reach, once; doing it again finds nothing new. Nothing is invented later
// to help: what is not there cannot be found.
//
// The file keeps these apart:
//   fact        a confirmed record (scene documentation, a laboratory result, a verified record)
//   claim       what someone says (a witness can be sure and wrong)
//   hypothesis  an explanation being weighed; its standing follows the clues found, not the truth
//   question    what is still unknown
// The truth itself (inc.truth) is never part of the file and never shown.
import { clamp } from '../../util.js';
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { COUNTRIES } from '../../data/countries.js';
import { OFFENSE_BY_ID, EVIDENCE } from '../../data/justice.js';
import { TEMPLATES, HYPOTHESES, LAB, LAB_RESULTS, WITNESS_QUESTIONS, SPECIALTIES, STREETS, SHOPS, FEDERAL } from '../../data/investigations.js';
import { techAvailable } from '../digital/tech.js';
import * as k from '../cases.js';
import { I, rec, W, now, at, year, me, nextId, result, note, grow, regard, seeded, skillAvg, reputationOf, dateWords, nameOfId } from './core.js';
import { agency, office, lab, prosecutorFor, staffer, ownerName } from './agencies.js';
import { meet } from './careers.js';
import { labMonths, hoursBonus } from './policing.js';
import { lawyerOnIt, lawCaseFor } from './legal.js';
import { realBusiness, neighborWitness, placeCase } from './local.js';
import { workingToRule } from './unions.js';
import { inForce } from './reform.js';
import { relatives, checkConflict, markAncestor } from './family.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);
const first = (id) => npc(id)?.firstName ?? 'They';
export const fileOf = (inv) => inv?.file ?? null;
export const investigation = (id) => k.J().investigations[id] ?? null;
export const incidentOf = (inv) => k.J().incidents[inv.incidentId];
const TERMINAL = ['sentenced', 'acquitted', 'dismissed', 'quashed'];

// ---------- Making a case ----------

/** Which explanation is true, by template. Weighted; the file never learns which. */
const TRUTH = {
  burglary: { outsider: 0.5, insider: 0.32, misreport: 0.18 },
  robbery: { stranger: 0.55, known: 0.3, misreport: 0.15 },
  homicide: { known: 0.55, stranger: 0.25, not_homicide: 0.2 },
  missing: { voluntary: 0.55, accident: 0.3, harm: 0.15 },
  fraud: { insider: 0.5, error: 0.35, outsider: 0.15 },
  cyber: { outsider: 0.6, insider: 0.25, error: 0.15 },
};
const NO_CRIME = ['misreport', 'not_homicide', 'voluntary', 'accident', 'error'];

/** Templates the player can be given: by specialty, era (no online fraud before the web) and seniority. */
export function templatesFor(specialty, p = player()) {
  const r = rec(p);
  return Object.entries(TEMPLATES).filter(([, t]) => {
    if (t.tech && !techAvailable(t.tech, year(), p.countryId)) return false;
    if (t.federalOnly) return false; // a federal agency's own cases, never a police unit's
    if (t.minRank === 'senior_detective' && !['senior_detective', 'detective_sergeant', 'detective_lieutenant', 'agent', 'senior_agent', 'supervisory'].includes(r?.job?.rank) && (r?.stats.completed ?? 0) < 3) return false;
    if (specialty === 'general' || specialty === 'major') return !t.inquiry || specialty === 'general';
    return t.specialty === specialty || (specialty === 'property' && t.offenseId === 'burglary') || (specialty === 'special_victims' && t.specialty === 'family') || (specialty === 'major' && ['robbery', 'homicide', 'arson'].includes(t.specialty));
  }).map(([id]) => id);
}

/**
 * Opens a case of a template for the player (or an NPC investigator), with its people, its scene
 * and its clues set from what happened.
 * @param {string} tid  a key of TEMPLATES
 * @param {{ownerId?:string, lead?:string, countryId?:string, city?:string, truth?:string, title?:string, place?:string}} [o]
 */
export function openCase(tid, o = {}) {
  const p = player();
  const t = TEMPLATES[tid];
  const countryId = o.countryId ?? p.countryId;
  const city = o.city ?? p.city;
  const r = seeded(`${countryId}/${city}/${tid}/${k.J().seq}`);
  const truth = o.truth ?? pickWeighted(t.pack ? t.truth : TRUTH[tid], r);
  const civ = (o2 = {}) => k.civilian(countryId, { kind: 'civilian', ...o2 });
  // The people: who reported it, who saw what, who is close to it.
  const reporting = civ({ age: r.int(30, 66), occupation: t.place === 'business' ? 'Business owner' : undefined });
  const insider = t.pack ? civ({ age: t.insiderAge ? r.int(...t.insiderAge) : r.int(22, 58), occupation: t.insider }) : ['burglary', 'fraud', 'cyber'].includes(tid) ? civ({ age: r.int(22, 55), occupation: tid === 'fraud' ? 'Bookkeeper' : 'Employee' })
    : ['robbery', 'homicide'].includes(tid) ? civ({ age: r.int(20, 60) }) : null;
  // A witness may be a real resident of one of the city's neighborhoods: the same person the player could meet (local.js).
  const key = `${countryId}/${city}/${tid}/${k.J().seq}`;
  const neighbor = o.neighbors !== false && seeded(`${key}/nb`).chance(0.5) ? neighborWitness(countryId, city, key, [reporting.id, insider?.id].filter(Boolean)) : null;
  const witnesses = [neighbor ?? civ(), ...(r.chance(0.6) ? [civ()] : [])];
  const missingPerson = tid === 'missing' ? civ({ age: r.int(19, 70) }) : null;
  const victim = tid === 'homicide' || tid === 'family' || t.shared === 'collision' ? civ({ age: r.int(22, 75) }) : tid === 'robbery' ? reporting : null;
  // Who did it, if anyone did.
  let perp = null;
  if (t.pack) perp = t.perp[truth] === 'insider' ? insider : t.perp[truth] === 'stranger' ? civ({ age: r.int(18, 55) }) : null;
  else if (!NO_CRIME.includes(truth)) perp = ['insider', 'known'].includes(truth) ? insider : truth === 'harm' ? civ({ age: r.int(20, 55) }) : civ({ age: r.int(18, 50) });
  // One person behind several cases (a series: serial.js) is the same person in each.
  if (o.perpId && perp && store.state.npcs[o.perpId]?.alive) perp = store.state.npcs[o.perpId];
  const offenseId = t.offenseId ?? (truth === 'harm' ? 'assault' : 'theft');
  const inc = k.createIncident({ offenseId, perpetratorId: perp?.id ?? null, victimId: victim?.id, countryId, city, witnessIds: witnesses.map((w) => w.id) });
  inc.participants = inc.participants.filter((x) => x.id);
  inc.truth.hypothesis = truth;
  inc.truth.noCrime = !perp;
  inc.template = tid;
  if (missingPerson) inc.truth.missingId = missingPerson.id;
  // The investigation record (the same shape engine/cases.js keeps), with the file on it.
  const owner = o.ownerId ?? rec(p)?.job?.agencyId ?? rec(p)?.job?.officeId ?? null;
  const lead = o.lead ?? me();
  const inv = { id: k.newId('inv'), incidentId: inc.id, agencyId: owner, investigatorIds: [lead], suspectIds: [], witnessIds: witnesses.map((w) => w.id), evidenceIds: [],
    stage: 'active', opened: year(), years: 0, events: [], outcome: null };
  k.J().investigations[inv.id] = inv;
  inc.reported = true;
  inc.investigationId = inv.id;
  // A business case happens at a real employer of the city, when there is one that fits (local.js).
  const employer = !o.place && !o.title && !t.places ? realBusiness(tid, countryId, city, key) : null;
  const place = o.place ?? employer?.name ?? (t.places ? r.pick(t.places) : t.place === 'business' ? r.pick(SHOPS) : r.pick(STREETS));
  const title = o.title ?? (tid === 'missing' ? t.title(place, nm(missingPerson.id)) : t.title(place));
  const partnerId = lead === me() ? rec(p)?.people.partnerId ?? null : null;
  const file = {
    v: 1, template: tid, title, specialty: t.specialty, place, opened: now(), due: now() + t.months, leadId: lead, partnerId, supervisorId: lead === me() ? rec(p)?.people.supervisorId ?? null : null,
    reportingId: reporting.id, victimId: victim?.id ?? null, missingId: missingPerson?.id ?? null,
    people: [], clues: [], items: [], witnesses: {}, hypotheses: {}, leads: [], labs: [], auths: [], log: [], done: {}, work: {},
    report: null, referral: null, courtCaseId: null, testimony: null, outcome: null, cleared: [], poi: [], taskForceId: null, coldSince: null, reopened: [],
  };
  inv.file = file;
  const add = (id, role) => { if (id && !file.people.some((x) => x.id === id && x.role === role)) file.people.push({ id, role }); };
  add(reporting.id, tid === 'missing' ? 'family' : tid === 'robbery' ? 'victim' : 'reporting');
  if (victim && victim !== reporting) add(victim.id, 'victim');
  if (missingPerson) add(missingPerson.id, 'missing');
  for (const w of witnesses) add(w.id, 'witness');
  for (const h of t.hypotheses) file.hypotheses[h] = { key: h, text: t.hyp?.[h] ?? HYPOTHESES[h] };
  if (t.pack) buildPack(inc, inv, file, t, truth, { reporting, insider, witnesses, perp, victim, r });
  else buildClues(inc, inv, file, t, truth, { reporting, insider, witnesses, perp, victim, missingPerson, r });
  if (t.sensitive) file.sensitive = true;
  file.log.push({ at: now(), text: `Case opened: ${title}. ${t.scene}` });
  placeCase(inv, { employer });
  inv.events.push({ year: year(), text: `Reported. ${lead === me() ? 'The file is yours.' : `${nm(lead)} is assigned.`}` });
  // Facts known from the moment the report is taken.
  reveal(inv, 'report');
  return inv;
}
function pickWeighted(table, r) {
  let x = r.next();
  for (const [k2, w] of Object.entries(table)) { if ((x -= w) <= 0) return k2; }
  return Object.keys(table)[0];
}

/**
 * The clues a case has, set once from what happened. Each is reached by one step (`via`), says what
 * it says (`text`), is a fact or a claim, and bears on the hypotheses (`supports`, `against`). Some
 * point to a person (`pointsTo`), which becomes evidence (engine/cases.js) when found.
 */
function buildClues(inc, inv, f, t, truth, x) {
  const C = (via, kind, text, o = {}) => f.clues.push({ id: `c${f.clues.length + 1}`, via, kind, text, supports: o.supports ?? [], against: o.against ?? [], decisive: !!o.decisive,
    pointsTo: o.pointsTo ?? null, evKind: o.evKind ?? null, sourceId: o.sourceId ?? null, confidence: o.confidence ?? null, limitation: o.limitation ?? null, accurate: o.accurate ?? true,
    lead: o.lead ?? null, item: o.item ?? null, found: false, at: null, excludes: o.excludes ?? null, poi: o.poi ?? null, needsAuth: !!o.needsAuth });
  const { reporting, insider, witnesses, perp, missingPerson, r } = x;
  const tid = f.template;
  const eraOk = (kind) => !(kind === 'cctv' && year() < 1995) && !(kind === 'digital' && !techAvailable('pc', year(), inc.countryId));
  const item = (label, kind, pointsTo, disciplines) => {
    if (!eraOk(kind)) return null;
    const ev = k.addEvidence(inc, kind, pointsTo, { lawful: true });
    const flaw = r.chance(0.1);
    const it = { id: `x${f.items.length + 1}`, label, kind, evidenceId: ev.id, disciplines: disciplines.filter((d) => year() >= LAB[d].from && (!LAB[d].tech || techAvailable(LAB[d].tech, year(), inc.countryId))),
      collected: null, custody: [], integrity: flaw ? 'gap' : 'ok', examined: false };
    f.items.push(it);
    return it;
  };
  // What the report and the first look show, for every case.
  C('report', 'fact', `${nm(reporting.id)} made the report on ${dateWords(now())}.`);
  if (tid === 'burglary') {
    C('report', 'claim', `${first(reporting.id)} says equipment worth a good deal is missing and the rear door was forced overnight.`, { sourceId: reporting.id, confidence: 0.9, supports: ['outsider', 'insider'] });
    C('scene', 'fact', truth === 'misreport' ? 'The damage to the rear door frame is old: dust and paint lie in the marks.' : truth === 'insider' ? 'The rear door was forced from inside the building, not from the alley.' : 'Tool marks on the rear door frame were made from the alley side.',
      truth === 'misreport' ? { supports: ['misreport'], against: ['outsider'], decisive: false } : truth === 'insider' ? { supports: ['insider'], against: ['outsider'] } : { supports: ['outsider'], against: ['misreport'] });
    C('specialist', 'fact', truth === 'insider' ? 'The alarm was turned off with a valid staff code at 1:12 a.m., and on again at 1:40.' : truth === 'misreport' ? 'The alarm logged no entry at all that night.' : 'The alarm sensor on the rear door was cut; no code was used.',
      truth === 'insider' ? { supports: ['insider'], against: ['outsider'], decisive: true } : truth === 'misreport' ? { supports: ['misreport'], against: ['outsider', 'insider'] } : { supports: ['outsider'], against: ['insider'] });
    const glove = item('A glove left in the alley', 'physical', truth === 'outsider' ? perp.id : truth === 'insider' ? insider.id : null, ['fingerprints', 'dna']);
    if (glove) C(`lab:${glove.id}`, 'fact', '', { item: glove.id, pointsTo: truth === 'misreport' ? null : perp?.id, evKind: 'forensic' });
    const cam = item('Footage from the building opposite', 'cctv', perp?.id ?? null, ['video']);
    if (cam) C(`lab:${cam.id}`, 'fact', '', { item: cam.id, pointsTo: perp?.id ?? null, evKind: 'cctv' });
    C('poi', 'claim', `${first(insider.id)}, who works there and has a key, says they were at home all night.`, { sourceId: insider.id, confidence: 0.8, against: truth === 'insider' ? [] : ['insider'], accurate: truth !== 'insider', poi: insider.id });
    f.poi.push(insider.id);
    C('records', 'fact', truth === 'insider' ? `The staff code used that night belongs to ${nm(insider.id)}.` : truth === 'misreport' ? 'The insurer has a claim for the same equipment from last year.' : 'A pawn shop logged items matching the missing equipment two days later.',
      truth === 'insider' ? { supports: ['insider'], pointsTo: insider.id, evKind: 'documents', needsAuth: true } : truth === 'misreport' ? { supports: ['misreport'], against: ['outsider', 'insider'], decisive: true } : { supports: ['outsider'], pointsTo: perp.id, evKind: 'documents', lead: 'pawn' });
  }
  if (tid === 'robbery') {
    C('report', 'claim', `${first(reporting.id)} says a man took their bag on the street and ran.`, { sourceId: reporting.id, confidence: 0.85, supports: ['stranger', 'known'] });
    C('scene', 'fact', 'The bag was found empty two streets away.', { supports: ['stranger', 'known'], against: ['misreport'] });
    if (truth === 'misreport') C('records', 'fact', 'The bag\'s cards were used by its owner the next morning, in another city.', { supports: ['misreport'], against: ['stranger', 'known'], decisive: true });
    else C('records', 'fact', truth === 'known' ? `Phone records show ${nm(insider.id)} near the street that evening.` : 'A card from the bag was used at a gas station that night.', { supports: [truth], pointsTo: perp.id, evKind: truth === 'known' ? 'digital' : 'financial', needsAuth: truth === 'known' });
    const cam = item('Street camera footage', 'cctv', perp?.id ?? null, ['video']);
    if (cam) C(`lab:${cam.id}`, 'fact', '', { item: cam.id, pointsTo: perp?.id ?? null, evKind: 'cctv' });
    C('poi', 'claim', `${first(insider.id)}, an acquaintance the victim mentioned, says they were at work.`, { sourceId: insider.id, confidence: 0.7, accurate: truth !== 'known', against: truth === 'known' ? [] : ['known'], poi: insider.id });
    f.poi.push(insider.id);
  }
  if (tid === 'homicide') {
    C('report', 'fact', `${nm(x.victim.id)} was found dead at home by ${nm(reporting.id)}.`);
    C('scene', 'fact', truth === 'not_homicide' ? 'No sign of a struggle or forced entry; medication on the table.' : 'Signs of a struggle in the hallway; the back door was unlocked.', truth === 'not_homicide' ? { supports: ['not_homicide'] } : { supports: ['known', 'stranger'], against: ['not_homicide'] });
    C('examiner', 'fact', truth === 'not_homicide' ? 'Medical examiner: cause of death, an overdose of a prescribed medicine; manner of death, accident.' : 'Medical examiner: cause of death, blunt force injury; manner of death, homicide.',
      truth === 'not_homicide' ? { supports: ['not_homicide'], against: ['known', 'stranger'], decisive: true } : { supports: ['known', 'stranger'], against: ['not_homicide'], decisive: true });
    const trace = item('Material recovered from the hallway', 'physical', perp?.id ?? null, ['dna', 'fingerprints', 'trace']);
    if (trace) C(`lab:${trace.id}`, 'fact', '', { item: trace.id, pointsTo: perp?.id ?? null, evKind: 'forensic' });
    const phone = item('The victim\'s phone', 'digital', truth === 'known' ? perp.id : null, ['digital']);
    if (phone) C(`lab:${phone.id}`, 'fact', '', { item: phone.id, pointsTo: truth === 'known' ? perp.id : null, evKind: 'digital' });
    C('poi', 'claim', `${first(insider.id)}, who argued with the victim last month, says they had not seen them in weeks.`, { sourceId: insider.id, confidence: 0.75, accurate: truth !== 'known', against: truth === 'known' ? [] : ['known'], poi: insider.id });
    f.poi.push(insider.id);
    C('records', 'fact', truth === 'known' ? `A neighbor's doorbell camera recorded ${nm(insider.id)} arriving that evening.` : truth === 'stranger' ? 'A stranger was seen trying door handles on the street that night.' : 'The victim\'s pharmacy records show a recent change of dose.',
      truth === 'known' ? { supports: ['known'], pointsTo: insider.id, evKind: 'cctv' } : truth === 'stranger' ? { supports: ['stranger'] } : { supports: ['not_homicide'] });
  }
  if (tid === 'missing') {
    C('report', 'claim', `${first(reporting.id)} says ${nm(missingPerson.id)} has not been seen for three days and would never just leave.`, { sourceId: reporting.id, confidence: 0.9, against: ['voluntary'] });
    C('urgency', 'fact', `${first(missingPerson.id)} is an adult, has no medical needs on record, and took their wallet and phone charger.`, { supports: ['voluntary'] });
    C('records', 'fact', truth === 'voluntary' ? `${first(missingPerson.id)}'s bank card was used at a bus station in another city.` : truth === 'accident' ? 'A hospital admitted an unidentified adult the night they went missing.' : 'Their phone was last on near the river, and has been off since.',
      truth === 'voluntary' ? { supports: ['voluntary'], against: ['harm'], decisive: true } : truth === 'accident' ? { supports: ['accident'], decisive: true } : { supports: ['harm', 'accident'], against: ['voluntary'] });
    C('family', 'claim', truth === 'voluntary' ? `${first(reporting.id)} admits there had been arguments at home, and talk of starting again somewhere else.` : `${first(reporting.id)} says ${first(missingPerson.id)} had been happy lately.`, { sourceId: reporting.id, confidence: 0.8, supports: truth === 'voluntary' ? ['voluntary'] : [] });
    C('search', 'fact', truth === 'harm' ? 'The search found their bag by the river path.' : 'The search of the places they usually go found nothing.', truth === 'harm' ? { supports: ['harm'], pointsTo: null } : {});
  }
  if (tid === 'fraud' || tid === 'cyber') {
    const money = tid === 'fraud' ? 'the company accounts' : 'customer accounts';
    C('report', 'claim', `${first(reporting.id)} says money has gone missing from ${money}.`, { sourceId: reporting.id, confidence: 0.8, supports: ['insider', 'outsider'] });
    C('records', 'fact', truth === 'error' ? 'Reconciling the ledgers: the missing sum was moved between two of the company\'s own accounts and recorded twice.' : truth === 'insider' ? 'Reconciling the ledgers: small payments went to an account nobody at the company recognized, approved with a staff login.' : 'The transfers came from logins in another country, after a wave of fake password-reset emails.',
      truth === 'error' ? { supports: ['error'], against: ['insider', 'outsider'], decisive: true } : truth === 'insider' ? { supports: ['insider'], against: ['error'] } : { supports: ['outsider'], against: ['error', 'insider'] });
    C('specialist', 'fact', truth === 'insider' ? `The receiving account is held in the name of a relative of ${nm(insider.id)}.` : truth === 'outsider' ? 'The receiving accounts were opened with stolen identities; the trail leaves the country.' : 'An auditor confirms the books were badly kept, but every sum is accounted for.',
      truth === 'insider' ? { supports: ['insider'], pointsTo: insider.id, evKind: 'financial', needsAuth: true } : truth === 'outsider' ? { supports: ['outsider'], pointsTo: perp.id, evKind: 'financial' } : { supports: ['error'], decisive: true });
    const books = item(tid === 'fraud' ? 'The company\'s ledgers and bank statements' : 'Server and account logs', tid === 'fraud' ? 'financial' : 'digital', perp?.id ?? null, tid === 'fraud' ? ['financial'] : ['digital']);
    if (books) C(`lab:${books.id}`, 'fact', '', { item: books.id, pointsTo: perp?.id ?? null, evKind: tid === 'fraud' ? 'financial' : 'digital' });
    C('poi', 'claim', `${first(insider.id)}, who keeps the books, says the accounts have been a mess for years and nothing was taken.`, { sourceId: insider.id, confidence: 0.7, accurate: truth !== 'insider', supports: ['error'], poi: insider.id });
    f.poi.push(insider.id);
  }
  // Witnesses: each saw something, or nothing, and may be wrong while sure of it.
  for (const w of witnesses) {
    const accurate = r.chance(0.72);
    const limitation = r.pick(['it was dark', 'it was from across the street', 'it was only a few seconds', null]);
    const confidence = Math.round((0.5 + r.next() * 0.5) * 100) / 100;
    const saw = sawText(tid, truth, accurate, w, perp, insider, missingPerson);
    f.witnesses[w.id] = { id: w.id, accurate, confidence, limitation, willing: Math.round((0.5 + r.next() * 0.5) * 100) / 100, asked: [], statements: [], respect: 0 };
    C(`q:${w.id}:observed`, 'claim', saw.text, { sourceId: w.id, confidence, accurate, supports: saw.supports, pointsTo: saw.pointsTo, evKind: 'witness', limitation });
    C(`q:${w.id}:timeline`, 'claim', `${first(w.id)} puts it ${saw.time}.`, { sourceId: w.id, confidence: confidence * 0.8, accurate });
    C(`q:${w.id}:uncertainty`, 'claim', limitation ? `${first(w.id)} admits ${limitation}.` : `${first(w.id)} had a clear view and says so.`, { sourceId: w.id, confidence: 1, limitation });
    C(`q:${w.id}:more`, 'claim', saw.more, { sourceId: w.id, confidence: confidence * 0.9, accurate, supports: saw.moreSupports ?? [] });
  }
}
/** Builds a case pack's clues (data/investigations.js PACKS): the same rules as buildClues, written as data. */
function buildPack(inc, inv, f, t, truth, x) {
  const { reporting, insider, witnesses, perp, victim, r } = x;
  const fill = (txt) => txt.replace(/\{owner\}/g, nm(reporting.id)).replace(/\{insider\}/g, nm(insider.id)).replace(/\{perp\}/g, perp ? nm(perp.id) : 'someone');
  const pick = (v) => (v && !Array.isArray(v) && typeof v === 'object' ? v[truth] : v);
  const who = (v) => (v === 'insider' ? insider.id : v === 'perp' ? perp?.id ?? null : null);
  const push = (c) => f.clues.push({ id: `c${f.clues.length + 1}`, found: false, at: null, excludes: null, lead: null, item: null, accurate: true, confidence: null, limitation: null, sourceId: null, poi: null, needsAuth: false, decisive: false, supports: [], against: [], pointsTo: null, evKind: null, ...c });
  for (const c of t.clues) {
    const text = c.by ? c.by[truth] : c.text;
    if (!text) continue;
    push({ via: c.via, kind: c.kind, text: fill(text), supports: pick(c.supports) ?? [], against: pick(c.against) ?? [], decisive: !!pick(c.decisive), needsAuth: !!pick(c.needsAuth),
      pointsTo: who(pick(c.pointsTo)), evKind: pick(c.evKind) ?? null, sourceId: c.source === 'owner' ? reporting.id : c.via === 'victim' ? victim?.id ?? null : null, confidence: c.confidence ?? null });
  }
  for (const it0 of t.items) {
    const pointsTo = who(it0.pointsTo);
    if (it0.kind === 'cctv' && year() < 1995) continue;
    const ev = k.addEvidence(inc, it0.kind, pointsTo, { lawful: true });
    const it = { id: `x${f.items.length + 1}`, label: it0.label, kind: it0.kind, evidenceId: ev.id, disciplines: it0.disciplines.filter((d) => year() >= LAB[d].from && (!LAB[d].tech || techAvailable(LAB[d].tech, year(), inc.countryId))),
      collected: null, custody: [], integrity: r.chance(0.1) ? 'gap' : 'ok', examined: false };
    f.items.push(it);
    push({ via: `lab:${it.id}`, kind: 'fact', text: '', item: it.id, pointsTo, evKind: 'forensic' });
  }
  const accurate = t.poi.accurate.includes(truth);
  push({ via: 'poi', kind: 'claim', text: fill(t.poi.text), sourceId: insider.id, confidence: 0.75, accurate, poi: insider.id, against: accurate ? [] : [] });
  f.poi.push(insider.id);
  for (const w of witnesses) {
    const right = r.chance(0.72);
    const limitation = r.pick(['it was dark', 'it was from across the street', 'it was only a few seconds', null]);
    const confidence = Math.round((0.5 + r.next() * 0.5) * 100) / 100;
    const other = Object.keys(t.truth).find((x2) => x2 !== truth);
    const said = right ? truth : other;
    f.witnesses[w.id] = { id: w.id, accurate: right, confidence, limitation, willing: Math.round((0.5 + r.next() * 0.5) * 100) / 100, asked: [], statements: [], respect: 0 };
    push({ via: `q:${w.id}:observed`, kind: 'claim', text: `${first(w.id)} ${fill(t.witness.saw[said])}.`, sourceId: w.id, confidence, accurate: right, supports: t.witness.supports[said] ?? [], pointsTo: who(t.witness.pointsTo?.[said]), evKind: 'witness', limitation });
    push({ via: `q:${w.id}:timeline`, kind: 'claim', text: `${first(w.id)} is fairly sure of the time.`, sourceId: w.id, confidence: confidence * 0.8, accurate: right });
    push({ via: `q:${w.id}:uncertainty`, kind: 'claim', text: limitation ? `${first(w.id)} admits ${limitation}.` : `${first(w.id)} had a clear view and says so.`, sourceId: w.id, confidence: 1, limitation });
    push({ via: `q:${w.id}:more`, kind: 'claim', text: `${first(w.id)} has nothing else they are sure of.`, sourceId: w.id, confidence: 0.5, accurate: right });
  }
  if (victim) f.people.push({ id: victim.id, role: 'victim' });
}
function sawText(tid, truth, accurate, w, perp, insider, missing) {
  const who = (id) => nm(id);
  const T = {
    burglary: () => (accurate ? (truth === 'outsider' ? { text: `${first(w.id)} saw someone carrying boxes into a van in the alley around 2 a.m.`, supports: ['outsider'], time: 'at about 2 in the morning', more: 'The van had no markings, and the driver wore a cap.' }
      : truth === 'insider' ? { text: `${first(w.id)} saw a light on in the building after closing, and ${who(insider.id)}'s car outside.`, supports: ['insider'], pointsTo: insider.id, time: 'after 1 in the morning', more: 'The car left before 2.' }
        : { text: `${first(w.id)} saw the owner loading equipment into his own car the week before.`, supports: ['misreport'], time: 'a week before the report', more: 'They thought nothing of it at the time.' })
      : { text: `${first(w.id)} is sure they saw ${who(insider.id)} near the door that night.`, supports: ['insider'], pointsTo: insider.id, time: 'around midnight', more: 'They did not see anyone carry anything.' }),
    robbery: () => (accurate && truth !== 'misreport' ? { text: `${first(w.id)} saw the robbery: a young man, a gray hooded top, running toward the station.`, supports: [truth], pointsTo: perp?.id ?? null, time: 'just after 8 in the evening', more: 'He dropped something by the crossing.' }
      : { text: `${first(w.id)} heard shouting but saw nobody running.`, supports: truth === 'misreport' ? ['misreport'] : [], time: 'around 8', more: 'They are not sure it was the same evening.' }),
    homicide: () => (accurate && truth !== 'not_homicide' ? { text: `${first(w.id)} heard raised voices from the house that evening.`, supports: ['known'], time: 'around 9 at night', more: truth === 'known' ? `One of the voices sounded like ${who(insider.id)}.` : 'They did not recognize the voices.', moreSupports: truth === 'known' ? ['known'] : ['stranger'] }
      : { text: `${first(w.id)} saw nothing unusual and heard nothing.`, supports: truth === 'not_homicide' ? ['not_homicide'] : [], time: 'all evening', more: 'The house was quiet, as it usually was.' }),
    missing: () => (accurate ? { text: truth === 'voluntary' ? `${first(w.id)} saw ${who(missing.id)} with a packed bag at the bus stop.` : truth === 'accident' ? `${first(w.id)} saw ${who(missing.id)} cycling home in the rain, late.` : `${first(w.id)} saw ${who(missing.id)} arguing with someone by the river path.`,
      supports: [truth], time: 'the evening they were last seen', more: truth === 'harm' ? 'The other person was taller, in a dark coat.' : 'They seemed in a hurry.' }
      : { text: `${first(w.id)} thinks they saw ${who(missing.id)} in town the next day.`, supports: ['voluntary'], time: 'the following afternoon', more: 'They only saw them from behind.' }),
    fraud: () => ({ text: accurate ? (truth === 'insider' ? `${first(w.id)}, a colleague, noticed ${who(insider.id)} staying late at month end, alone at the accounts.` : `${first(w.id)}, a colleague, says the bookkeeping has been chaotic since the old system was replaced.`) : `${first(w.id)}, a colleague, suspects ${who(insider.id)} but has nothing specific.`,
      supports: accurate ? [truth === 'insider' ? 'insider' : 'error'] : ['insider'], pointsTo: accurate && truth === 'insider' ? insider.id : null, time: 'over the last six months', more: 'Nobody checked the reconciliations.' }),
    cyber: () => ({ text: accurate ? (truth === 'outsider' ? `${first(w.id)}, a customer, received an email asking them to reset their password the day before.` : `${first(w.id)}, a customer, noticed the charge came from the shop itself.`) : `${first(w.id)}, a customer, blames the shop's staff.`,
      supports: accurate ? [truth === 'outsider' ? 'outsider' : truth] : ['insider'], time: 'the week of the transfers', more: 'Several people they know had the same email.' }),
  };
  return T[tid]();
}

// ---------- Working a case ----------

/** Steps an investigator can take on this file now, with why each is (or is not) open. */
export function steps(inv) {
  const f = inv.file;
  if (f?.review?.status === 'open') return reviewSteps(inv);
  if (!f || ['closed', 'charged', 'cold', 'resolved'].includes(caseStatus(inv))) return [];
  const out = [];
  const open = (id, label, sub, o = {}) => { if (!f.done[id]) out.push({ id, label, sub, ...o }); };
  open('scene', f.template === 'missing' ? 'Review the missing person report and their circumstances' : 'Examine the scene documentation', 'Photographs, sketches and the first officers\' notes.');
  const tpl = TEMPLATES[f.template];
  if (tpl.pack) {
    const vias = [...new Set(f.clues.map((c) => c.via))].filter((v) => !['report', 'records', 'poi'].includes(v) && !v.startsWith('q:') && !v.startsWith('lab:') && v !== 'scene');
    const L = { specialist: ['Consult a specialist', 'Another pair of trained eyes.'], support: ['Arrange support for the person harmed', 'An advocate: safety, support and their choices come first.'],
      victim: ['Ask whether the person harmed wants to give an account', 'Only if they choose to. Choosing not to is not evidence of anything.'], examiner: ['Ask for the medical report, with consent', 'What the injuries are consistent with.'] };
    for (const v of vias) if (L[v] && (v !== 'victim' || f.done.support)) open(v, L[v][0], L[v][1]);
  } else if (f.template === 'missing') { open('urgency', 'Assess the urgency', 'Age, health, what they took, anything that suggests danger.'); open('family', 'Talk with the family', 'Gently: they are frightened.'); open('search', 'Coordinate a search of the places they go', 'Volunteers and officers.'); }
  else if (f.template === 'homicide') open('examiner', 'Review the medical examiner\'s findings', 'Cause and manner of death are the examiner\'s to determine.');
  else open('specialist', f.template === 'fraud' || f.template === 'cyber' ? 'Ask a specialist to review the records' : 'Consult the crime scene specialist', 'Another pair of trained eyes.');
  for (const [wid, w] of Object.entries(f.witnesses)) {
    if (!npc(wid)?.alive) continue;
    const left = Object.keys(WITNESS_QUESTIONS).filter((q) => !w.asked.includes(q) && (q !== 'inconsistency' || contradictions(inv).length));
    if (left.length) out.push({ id: `interview:${wid}`, label: `Interview ${nm(wid)}`, sub: `A witness. ${w.asked.length ? `Asked ${w.asked.length} question${w.asked.length === 1 ? '' : 's'} so far.` : 'Not yet interviewed.'}`, interview: true });
  }
  for (const id of f.poi) if (!f.done[`poi:${id}`] && !f.cleared.includes(id) && npc(id)?.alive) out.push({ id: `poi:${id}`, label: `Ask ${nm(id)} for a voluntary interview`, sub: 'They may decline, and may have a lawyer present. Declining proves nothing.' });
  if (!f.done.timeline && found(f).filter((c) => c.kind === 'claim').length >= 2) open('timeline', 'Reconstruct the timeline', 'Line up every account and record by time.');
  const rc = f.clues.find((c) => c.via === 'records');
  if (rc && !f.done.records) {
    const needs = rc.needsAuth && !f.auths.some((a) => a.kind === 'records' && a.decision === 'granted');
    open('records', needs ? 'Request the protected records (needs a court order)' : 'Request the relevant records', needs ? 'Phone, bank or access records need a judge\'s authorization first.' : 'Records that need no special authority.', { needsAuth: needs });
  }
  if (rc?.needsAuth && !f.auths.some((a) => a.kind === 'records')) out.push({ id: 'auth:records', label: 'Ask a judge for a records order', sub: 'The judge needs a lawful basis from what the file already shows.' });
  for (const it of f.items) if (!it.examined) for (const d of it.disciplines) if (!f.labs.some((l) => l.itemId === it.id && l.discipline === d)) out.push({ id: `lab:${it.id}:${d}`, label: `Send ${it.label.toLowerCase()} for ${LAB[d].name.toLowerCase().replace(/\bdna\b/g, "DNA")}`, sub: `About ${LAB[d].months} months. Results are not always conclusive.`, lab: true });
  return out;
}
const found = (f) => f.clues.filter((c) => c.found);
/** Whether there is work left this year on this case: a caseload is finite. */
export function workLeft(inv) {
  const f = inv.file;
  const used = f.work[year()] ?? 0;
  const cap = Math.max(3, 6 + Math.round(skillAvg(['management', 'planning']) / 25) + hoursBonus(inv.agencyId));
  // Extra hours this year: support approved, a partner's routine work, a task force; and this year's priority (workplace.js).
  const r = rec();
  const pri = r?.priority?.year === year() && r.caseIds.includes(inv.id) ? (r.priority.invId === inv.id ? 2 : -1) : 0;
  const rule = workingToRule(inv.agencyId) ? -2 : 0; // the union is working to rule (unions.js)
  return Math.max(0, cap + (f.extra?.[year()] ?? 0) + pri + rule - used);
}
const spend = (f) => { f.work[year()] = (f.work[year()] ?? 0) + 1; };

/** Reveals the clues a step reaches, once each; makes found clues that point to a person into evidence. */
function reveal(inv, via, o = {}) {
  const f = inv.file;
  const inc = incidentOf(inv);
  const out = [];
  for (const c of f.clues.filter((x) => x.via === via && !x.found)) {
    c.found = true;
    c.at = now();
    if (c.pointsTo && c.evKind) {
      const ev = k.addEvidence(inc, c.evKind === 'witness' ? 'witness' : c.evKind, c.pointsTo, { sourceId: c.sourceId, lawful: o.lawful ?? true, summary: c.text });
      if (c.evKind === 'witness') ev.reliability = Math.round(ev.reliability * (c.limitation ? 0.8 : 1) * 100) / 100;
      c.evidenceId = ev.id;
      inv.evidenceIds.push(ev.id);
      if (!f.poi.includes(c.pointsTo) && c.pointsTo !== f.reportingId) f.poi.push(c.pointsTo);
    }
    if (c.lead) f.leads.push({ id: c.lead, text: c.text, why: 'Found in the records', status: 'open', at: now() });
    if (c.excludes) clear(inv, c.excludes, c.text);
    out.push(c);
  }
  review(inv);
  return out;
}
/** Names a person of interest a suspect only when the evidence against them is more than thin; clears those it does not fit. */
function review(inv) {
  const f = inv.file;
  inv.suspectIds = f.poi.filter((id) => !f.cleared.includes(id) && k.strength(inv.evidenceIds, id) >= 0.3);
  // A hypothesis ruled out by a decisive fact clears the person it alone pointed to.
  const st = standings(inv);
  if (st.insider?.status === 'ruled out' || st.known?.status === 'ruled out') for (const c of f.clues.filter((x) => x.poi && x.found)) clear(inv, c.poi, `The evidence does not fit ${nm(c.poi)}.`);
  if (inv.suspectIds.length && inv.stage === 'active') inv.stage = 'suspect';
}
function clear(inv, id, why) {
  const f = inv.file;
  if (!id || f.cleared.includes(id)) return;
  f.cleared.push(id);
  f.log.push({ at: now(), text: `${nm(id)} is no longer a person of interest. ${why}` });
  inv.suspectIds = inv.suspectIds.filter((x) => x !== id);
  if (f.leadId === me()) { const r = I(); r.stats.cleared += 1; regard('integrity', 1); }
}

/**
 * How each hypothesis stands on the clues found: facts count more than claims, a claim counts by
 * the witness's stated confidence, and a decisive fact against an explanation rules it out. With
 * nothing found, every explanation is open; once the evidence speaks, they are not equal.
 */
export function standings(inv) {
  const f = inv.file;
  const out = {};
  for (const h of Object.keys(f.hypotheses)) {
    let s = 0; let out_ = false; const why = [];
    for (const c of found(f)) {
      const w = c.kind === 'fact' ? 2 : (c.confidence ?? 0.6);
      if (c.supports.includes(h)) { s += w; why.push(`+ ${c.text}`); }
      if (c.against.includes(h)) { s -= w; why.push(`− ${c.text}`); if (c.decisive && c.kind === 'fact') out_ = true; }
    }
    const status = out_ ? 'ruled out' : s >= 4 ? 'strongly supported' : s >= 1.5 ? 'supported' : s <= -1.5 ? 'weakened' : 'open';
    out[h] = { key: h, text: f.hypotheses[h].text, score: Math.round(s * 10) / 10, status, why };
  }
  return out;
}
/** Pairs of found clues that cannot both be right (a witness against a record, two witnesses at odds). */
export function contradictions(inv) {
  const f = inv.file;
  const fs = found(f);
  const pairs = [];
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    const a = fs[i]; const b = fs[j];
    const clash = a.supports.some((h) => b.against.includes(h)) || b.supports.some((h) => a.against.includes(h))
      || (a.pointsTo && b.pointsTo && a.pointsTo !== b.pointsTo && a.kind !== b.kind);
    if (clash && (a.kind === 'claim' || b.kind === 'claim')) pairs.push([a, b]);
  }
  return pairs;
}

/**
 * Takes one step on a case. Interviews ask which question; laboratory requests are dated.
 * @returns {{ok, text, tone, found?:object[]}}
 */
export function act(invId, stepId, o = {}) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f) return result(false, 'There is no such file.', 'neutral');
  if (!canWork(inv)) return result(false, 'This case is not yours to work.', 'neutral');
  if (workLeft(inv) <= 0) return result(false, 'There are no more hours for this case this year. Age Up, or ask for support.', 'neutral');
  const [kind, a, b] = stepId.split(':');
  let res;
  if (kind === 'interview') res = interview(inv, a, o.question);
  else if (kind === 'poi') res = poiInterview(inv, a, o.choice);
  else if (kind === 'lab') res = requestLab(inv, a, b);
  else if (kind === 'auth') res = requestAuth(inv, a);
  else {
    if (f.done[kind]) return result(false, 'You have done that. Doing it again would find nothing new.', 'neutral');
    if (kind === 'records' && f.clues.find((c) => c.via === 'records')?.needsAuth && !f.auths.some((x) => x.kind === 'records' && x.decision === 'granted')) return result(false, 'Those records need a judge\'s order first.', 'neutral');
    f.done[kind] = now();
    // The person harmed decides whether to give an account. Declining is their right, and it is not evidence that nothing happened.
    if (kind === 'victim' && !seeded(`${inv.id}/victim`).chance(0.6)) {
      f.log.push({ at: now(), text: 'The person harmed does not want to give an account now. That is their choice; support stays open to them.' });
      spend(f);
      return result(true, 'The person harmed does not want to give an account now. That is their choice, and it does not mean nothing happened. Support stays open to them, and the case goes on with what else there is.', 'neutral');
    }
    const got = reveal(inv, kind);
    const skills = { scene: ['observation', 'evidence'], specialist: ['evidence', 'forensic'], examiner: ['evidence', 'forensic'], timeline: ['timeline', 'reasoning'], records: ['planning', 'financial'], urgency: ['planning'], family: ['interviewing'], search: ['planning', 'teamwork'] }[kind] ?? ['reasoning'];
    for (const s of skills) grow(s, 2);
    let text = got.length ? got.map((c) => c.text).join(' ') : 'Nothing new.';
    if (kind === 'timeline') { const cx = contradictions(inv); text = cx.length ? `The timeline does not line up: ${cx[0][0].text.replace(/\.$/, '')} — but ${cx[0][1].text.charAt(0).toLowerCase()}${cx[0][1].text.slice(1)}` : 'The accounts line up in time. Nothing contradicts anything else, yet.'; f.done.timelineResult = text; }
    f.log.push({ at: now(), text: `${stepWords(kind)}. ${text}` });
    res = result(true, text, got.length ? 'good' : 'neutral', { found: got });
  }
  if (res.ok) spend(f);
  return res;
}
const stepWords = (kind) => ({ scene: 'Reviewed the scene documentation', specialist: 'Consulted a specialist', examiner: 'Reviewed the medical examiner\'s findings', timeline: 'Reconstructed the timeline',
  records: 'Obtained the records', urgency: 'Assessed the urgency', family: 'Spoke with the family', search: 'Coordinated a search' }[kind] ?? 'Took a step');
export function canWork(inv, p = player()) {
  const r = rec(p);
  if (!r?.job || r.retired) return false;
  return inv.investigatorIds.includes(me(p)) || (inv.file?.taskForceId && W().taskForces[inv.file.taskForceId]?.memberIds.includes(me(p)));
}

/** A witness interview: one question at a time. Respect gets better answers; pressure gets worse ones. */
export function interview(inv, wid, q) {
  const f = inv.file;
  const w = f.witnesses[wid];
  if (!w || !npc(wid)?.alive) return result(false, 'They cannot be interviewed.', 'neutral');
  if (!WITNESS_QUESTIONS[q]) return result(false, 'Choose a question.', 'neutral');
  if (w.asked.includes(q)) return result(false, 'You asked that already. Asking again would only put words in their mouth.', 'neutral');
  if (w.willing < 0.25) return result(false, `${nm(wid)} does not want to talk to you any more.`, 'neutral');
  w.asked.push(q);
  grow('interviewing', 2);
  if (WITNESS_QUESTIONS[q].improper) {
    // Pressure produces a name, not the truth, and the court will hear how it was got.
    w.willing = Math.max(0, w.willing - 0.35);
    regard('ethics', -3);
    const c = f.clues.find((x) => x.via === `q:${wid}:observed`);
    const named = f.poi[0] ?? null;
    if (named) {
      const ev = k.addEvidence(incidentOf(inv), 'witness', named, { sourceId: wid, reliability: 0.2, summary: `${nm(wid)}, pressed hard, gave ${nm(named)}'s name.` });
      ev.tainted = 'leading';
      // Where body cameras are the law, the interview is recorded: the pressure is on camera, and a complaint follows (reform.js).
      if (inForce(incidentOf(inv).countryId, 'bodycams') && !f.recorded) { f.recorded = true; ev.recorded = true; complain(inv, 'conduct', 'A recorded interview shows a witness pressed until their account changed.'); }
      inv.evidenceIds.push(ev.id);
    }
    f.log.push({ at: now(), text: `Pressed ${nm(wid)} hard. ${named ? 'They gave a name, but it was the one you suggested.' : 'They shut down.'}` });
    if (c && !c.found) w.statements.push({ at: now(), q, text: 'Under pressure, the account changed to fit the question.' });
    return result(true, `${nm(wid)} gave you a name, the one you led them to. A defense lawyer will make much of how this statement was taken, and the witness trusts you less.`, 'bad');
  }
  if (q === 'inconsistency') {
    const cx = contradictions(inv).find(([a, b]) => a.sourceId === wid || b.sourceId === wid) ?? contradictions(inv)[0];
    const self = f.clues.find((x) => x.via === `q:${wid}:observed`);
    const t = self && !self.accurate ? `${nm(wid)} thinks again. "I was sure. But it was ${self.limitation ?? 'quick'}... I could be wrong about who it was."` : `${nm(wid)} holds to their account, calmly, and explains what they saw.`;
    if (self && !self.accurate) { self.confidence = Math.min(self.confidence ?? 0.5, 0.3); const ev = k.J().evidence[self.evidenceId]; if (ev) ev.reliability = Math.min(ev.reliability, 0.2); }
    w.statements.push({ at: now(), q, text: t });
    f.log.push({ at: now(), text: `Asked ${nm(wid)} about ${cx ? 'an inconsistency' : 'their account'}. ${t}` });
    return result(true, t, 'neutral');
  }
  const got = reveal(inv, `q:${wid}:${q}`);
  w.respect += 1;
  w.willing = Math.min(1, w.willing + 0.05);
  // A respectful interview helps: the witness remembers being treated well (engine/investigations/drama.js may call on them years later).
  const n = npc(wid);
  if (n) { n.meters.relationship = clamp(n.meters.relationship + 2); (n.flags.invMemory ??= []).push({ year: year(), invId: inv.id, by: me(), respectful: true }); }
  const text = got.length ? got.map((c) => c.text).join(' ') : `${nm(wid)} has nothing to add.`;
  w.statements.push({ at: now(), q, text });
  f.log.push({ at: now(), text: `Interviewed ${nm(wid)} (${WITNESS_QUESTIONS[q].label.toLowerCase()}). ${text}` });
  return result(true, text, 'neutral', { found: got });
}

/**
 * A voluntary interview with a person of interest. Rights first: they are told they need not answer
 * and may have a lawyer. They may decline; that proves nothing. There is no forceful option.
 */
export function poiInterview(inv, id, choice = 'account') {
  const f = inv.file;
  if (f.done[`poi:${id}`]) return result(false, 'They have given their account.', 'neutral');
  f.done[`poi:${id}`] = now();
  grow('law', 2);
  grow('interviewing', 2);
  const r = seeded(`${inv.id}/poi/${id}`);
  const clue = f.clues.find((c) => c.via === 'poi' && c.poi === id);
  if (r.chance(0.3)) {
    f.log.push({ at: now(), text: `${nm(id)} was told of their rights and declined to be interviewed, on their lawyer's advice.` });
    return result(true, `${nm(id)} was told they did not have to answer, and chose not to, on their lawyer's advice. That is their right; it is not evidence of anything.`, 'neutral');
  }
  if (clue) { clue.found = true; clue.at = now(); }
  // An account that holds up clears them; one that does not, will be tested against the records.
  if (clue?.accurate) clear(inv, id, 'Their account was checked and holds up.');
  f.log.push({ at: now(), text: `${nm(id)} gave a voluntary account, with their rights explained. ${clue?.text ?? ''}` });
  review(inv);
  return result(true, `${clue?.text ?? `${nm(id)} answered your questions.`}${clue?.accurate ? ' Their account checks out: they are no longer a person of interest.' : ' Their account will be tested against the records.'}`, 'neutral');
}

/** Asks a judge to authorize access to protected records. The judge decides on what the file already lawfully shows. */
export function requestAuth(inv, kind) {
  const f = inv.file;
  if (f.auths.some((x) => x.kind === kind)) return result(false, 'That request has been decided.', 'neutral');
  const top = f.poi.filter((id) => !f.cleared.includes(id)).map((id) => ({ id, s: k.strength(inv.evidenceIds.filter((e) => k.J().evidence[e]?.lawful && !k.J().evidence[e]?.tainted), id) })).sort((a, b) => b.s - a.s)[0];
  const st = standings(inv);
  const basis = (top?.s ?? 0) + Object.values(st).filter((h) => h.status.includes('supported')).length * 0.1;
  const judge = k.pick(k.bench(incidentOf(inv).countryId).judges);
  const granted = basis >= 0.4;
  f.auths.push({ id: nextId('auth'), kind, at: now(), judgeId: judge.id, basis: Math.round(basis * 100) / 100, decision: granted ? 'granted' : 'refused', subjectId: top?.id ?? null });
  grow('law', 3);
  f.log.push({ at: now(), text: `Asked ${nm(judge.id)} for a records order: ${granted ? 'granted' : 'refused, for want of a lawful basis'}.` });
  return result(true, granted ? `${nm(judge.id)} granted the order. You can request the records now.` : `${nm(judge.id)} refused: the file does not yet show a lawful basis. A reputation is not a reason; evidence is.`, granted ? 'good' : 'neutral');
}

/**
 * Sends an item to the laboratory. The result is decided now, from the item (what it really is),
 * the discipline (some are inconclusive more often) and the analyst, and is released on its date.
 */
export function requestLab(inv, itemId, discipline) {
  const f = inv.file;
  const it = f.items.find((x) => x.id === itemId);
  const d = LAB[discipline];
  if (!it || !d || !it.disciplines.includes(discipline)) return result(false, 'That examination is not possible here.', 'neutral');
  if (f.labs.some((l) => l.itemId === itemId && l.discipline === discipline)) return result(false, 'That request is with the laboratory.', 'neutral');
  const owner = inv.agencyId;
  const l = lab(agencyLab(owner));
  const analystId = l ? l.analystIds[0] : null;
  if (!it.collected) { it.collected = now(); it.custody.push({ at: now(), by: me(), act: 'collected and logged' }); }
  it.custody.push({ at: now(), by: me(), act: `sent to the laboratory for ${d.name.toLowerCase()}` });
  if (analystId) it.custody.push({ at: now(), by: analystId, act: 'received at the laboratory' });
  const ev = k.J().evidence[it.evidenceId];
  const r = seeded(`${inv.id}/${itemId}/${discipline}`);
  const skill = (npc(analystId)?.flags.justice?.skill ?? 60) / 100;
  const conclusive = r.chance(d.conclusive * (0.8 + skill * 0.4) * (it.integrity === 'gap' ? 0.85 : 1));
  let outcome = 'inconclusive';
  if (!conclusive) outcome = r.chance(0.3) ? 'unable' : r.chance(0.3) ? 'more' : 'inconclusive';
  else outcome = ev.pointsTo ? 'links' : 'excludes';
  const req = { id: nextId('labreq'), itemId, discipline, requested: now(), due: now() + labMonths(owner, d.months), analystId, outcome, status: 'pending', labId: l?.id ?? null };
  f.labs.push(req);
  grow('forensic', 2);
  f.log.push({ at: now(), text: `Sent ${it.label.toLowerCase()} for ${d.name.toLowerCase()}. Expected by ${dateWords(req.due)}.` });
  return result(true, `The laboratory has ${it.label.toLowerCase()}. ${nm(analystId)} will report on it by ${dateWords(req.due)}.`, 'neutral');
}
const agencyLab = (ownerId) => agency(ownerId)?.labId ?? office(ownerId)?.labId ?? Object.values(W().labs)[0]?.id ?? null;

/** Laboratory reports whose date has come. A report says what the evidence shows, and its limits. */
export function settleLabs(inv) {
  const f = inv.file;
  if (!f) return [];
  const out = [];
  for (const req of f.labs.filter((x) => x.status === 'pending' && x.due <= now())) {
    req.status = 'reported';
    req.reported = now();
    const it = f.items.find((x) => x.id === req.itemId);
    const ev = k.J().evidence[it.evidenceId];
    const d = LAB[req.discipline];
    const clue = f.clues.find((c) => c.via === `lab:${it.id}`);
    let text;
    if (req.outcome === 'links' && ev.pointsTo) {
      const known = f.poi.includes(ev.pointsTo) || f.people.some((x) => x.id === ev.pointsTo);
      text = known ? `${d.name}: the ${it.label.toLowerCase()} is consistent with ${nm(ev.pointsTo)}. Consistent is not proof: it is one piece of evidence, with the method's known limits.`
        : `${d.name}: the ${it.label.toLowerCase()} gives a usable profile that matches nobody in the case so far. A database comparison names ${nm(ev.pointsTo)}, a person not yet connected to the case.`;
      ev.summary = text;
      // What the court weighs is the laboratory's finding, as the kind of evidence it is (a DNA comparison, not a glove).
      if (EVIDENCE[d.evidence] && ev.kind !== d.evidence) { ev.kind = d.evidence; ev.reliability = Math.max(ev.reliability, EVIDENCE[d.evidence].reliability[0]); }
      if (!inv.evidenceIds.includes(ev.id)) inv.evidenceIds.push(ev.id);
      if (!f.poi.includes(ev.pointsTo)) f.poi.push(ev.pointsTo);
      if (clue) { clue.found = true; clue.at = now(); clue.text = text; clue.supports = supportsFor(f, ev.pointsTo); }
      it.examined = true;
      req.result = 'consistent';
    } else if (req.outcome === 'excludes') {
      text = `${d.name}: nothing on the ${it.label.toLowerCase()} links it to anyone in the case. It does not show what happened; it rules out a link.`;
      req.result = 'inconsistent';
      it.examined = true;
      if (clue) { clue.found = true; clue.at = now(); clue.text = text; }
    } else {
      req.result = req.outcome === 'unable' ? 'unable' : req.outcome === 'more' ? 'more' : 'inconclusive';
      text = `${d.name}: ${LAB_RESULTS[req.result].toLowerCase()}.${req.result === 'more' ? ' Another discipline may do better.' : ''}`;
      if (req.result === 'more') { it.examined = false; }
    }
    if (it.integrity === 'gap') text += ' The evidence log is missing one transfer signature; the defense may question the chain of custody.';
    req.text = text;
    it.custody.push({ at: now(), by: req.analystId, act: `examined: ${LAB_RESULTS[req.result].toLowerCase()}` });
    f.log.push({ at: now(), text: `Laboratory report: ${text}` });
    out.push(text);
  }
  if (out.length) review(inv);
  return out;
}
/** Which hypotheses a laboratory link to a person supports, by who that person is in the case. */
function supportsFor(f, id) {
  const insiderClue = f.clues.find((c) => c.via === 'poi' && c.poi === id);
  if (insiderClue) return Object.keys(f.hypotheses).filter((h) => ['insider', 'known'].includes(h));
  return Object.keys(f.hypotheses).filter((h) => ['outsider', 'stranger', 'harm'].includes(h));
}

// ---------- The report, the prosecutor, the court ----------

/**
 * Writes the case report. It must include everything found, including what helps the defense: an
 * honest report lists the inconsistent statement too. Leaving it out is possible and is misconduct;
 * it is never rewarded (see settleCourt).
 * @param {'complete'|'omit'} how
 */
export function writeReport(invId, how = 'complete') {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f || !canWork(inv)) return result(false, 'This case is not yours.', 'neutral');
  // What cuts the other way: an account that does not fit, or one that clears someone.
  const exculpatory = found(f).filter((c) => c.kind === 'claim' && (!c.accurate || c.against.length > 0));
  f.report = { at: now(), complete: how !== 'omit', omitted: how === 'omit' ? exculpatory.map((c) => c.id) : [], quality: Math.round(skillAvg(['writing', 'reasoning', 'evidence'])) };
  grow('writing', 3);
  if (how === 'omit') { regard('ethics', -10); regard('integrity', -10); f.log.push({ at: now(), text: 'Wrote the case report, leaving out statements that did not fit.' }); return result(true, 'The report is written. It leaves out what did not fit. The law requires that the defense be told of it; that duty does not go away because a report is silent.', 'bad'); }
  regard('reports', 2);
  regard('integrity', 1);
  f.log.push({ at: now(), text: 'Wrote the case report, including every statement and result, for and against.' });
  return result(true, 'The report is written: every fact, every account, and every result, including those that cut the other way.');
}

/**
 * Refers the case to a prosecutor, who decides whether to charge. A detective recommends; the
 * prosecutor decides; the court finds. Thresholds come from engine/cases.js.
 */
export function refer(invId, suspectId) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f || !canWork(inv)) return result(false, 'This case is not yours.', 'neutral');
  if (!f.report) return result(false, 'Write the case report first: the prosecutor reads the file, not a summary.', 'neutral');
  if (f.cleared.includes(suspectId)) return result(false, 'The evidence has cleared them.', 'neutral');
  if (f.referral?.decision === 'charged') return result(false, 'Charges were filed already.', 'neutral');
  const usable = inv.evidenceIds.filter((id) => { const e = k.J().evidence[id]; return e && e.lawful && !e.tainted; });
  const s = k.strength(usable, suspectId);
  const tainted = inv.evidenceIds.some((id) => k.J().evidence[id]?.tainted && k.J().evidence[id].pointsTo === suspectId);
  const pros = npc(f.referral?.prosecutorId) ?? prosecutorFor(inv.agencyId, incidentOf(inv).countryId);
  I().people.prosecutorId = pros.id;
  const r = I();
  r.stats.referred += 1;
  grow('law', 2);
  if (s >= k.CHARGE_AT) {
    const c = k.openCaseFor(inv, suspectId);
    c.prosecutorId = pros.id;
    c.evidenceIds = [...usable, ...inv.evidenceIds.filter((id) => !usable.includes(id))];
    c.trialDue = now() + 6;
    c.investigatorId = me();
    f.courtCaseId = c.id;
    f.referral = { at: now(), prosecutorId: pros.id, suspectId, decision: 'charged', strength: Math.round(s * 100) / 100 };
    r.stats.charged += 1;
    f.log.push({ at: now(), text: `${nm(pros.id)} filed charges against ${nm(suspectId)}. The court date is ${dateWords(c.trialDue)}.` });
    note(`Referred a case to the prosecutor: ${nm(pros.id)} filed charges.`, 'career', { log: false });
    return result(true, `${nm(pros.id)} has charged ${nm(suspectId)}. Charged is not guilty: the court will decide, from ${dateWords(c.trialDue)}.${tainted ? ' The statement you pressed out of a witness was left out of the charge.' : ''}`, 'neutral');
  }
  const needs = [];
  if (!usable.some((id) => ['forensic', 'cctv', 'digital', 'financial', 'documents'].includes(k.J().evidence[id]?.kind) && k.J().evidence[id]?.pointsTo === suspectId)) needs.push('independent evidence (a record, footage or a laboratory result), not only what witnesses say');
  if (contradictions(inv).length && !f.done.timeline) needs.push('an explanation of the conflicting accounts');
  if (tainted) needs.push('a statement taken properly: the one you have was led');
  const decision = s >= 0.35 ? 'more' : 'declined';
  f.referral = { at: now(), prosecutorId: pros.id, suspectId, decision, strength: Math.round(s * 100) / 100, needs };
  if (decision === 'declined') { r.stats.declined += 1; inv.stage = 'active'; }
  f.log.push({ at: now(), text: `${nm(pros.id)} ${decision === 'more' ? 'asked for more before charging' : 'declined to charge'}: ${needs.join('; ') || 'the evidence is too weak'}.` });
  return result(true, decision === 'more' ? `${nm(pros.id)} wants more before charging anyone: ${needs.join('; ') || 'stronger evidence'}.` : `${nm(pros.id)} declined to charge. The evidence does not support it. Declining can be the right outcome.`, 'neutral');
}

/** Prepares testimony for a court date: what is said must match the file. */
export function testify(invId, how) {
  const inv = investigation(invId);
  const f = inv?.file;
  const c = f && k.J().cases[f.courtCaseId];
  if (!c || TERMINAL.includes(c.stage)) return result(false, 'There is no hearing to testify at.', 'neutral');
  if (f.testimony) return result(false, 'You have prepared.', 'neutral');
  f.testimony = { at: now(), how };
  I().stats.court += 1;
  grow('law', 2);
  if (how === 'overstate') { regard('integrity', -4); return result(true, 'You plan to say the evidence is stronger than it is. Cross-examination is built for exactly that.', 'bad'); }
  regard('reliability', 2);
  if (how === 'limits') regard('integrity', 2);
  return result(true, how === 'limits' ? 'You will explain what the evidence shows, and what it does not: the inconclusive results too.' : 'You will go through the investigation as it is recorded in the file.');
}

/**
 * Cross-examination of the investigator, on the stand. The defense asks what the file can answer: the custody of the
 * evidence, how witnesses were questioned, what the laboratory could not say, whether anyone else was looked at.
 * The file is the record: an answer it contradicts is found out, and the court weighs the investigator's evidence
 * with that in mind. An honest answer about a weakness costs less than a denial.
 */
export function crossQuestions(inv) {
  const f = inv.file;
  const ev = (k.J().cases[f.courtCaseId]?.evidenceIds ?? []).map((id) => k.J().evidence[id]).filter(Boolean);
  return [
    { id: 'custody', q: '"Was every transfer of the evidence signed for?"', weak: f.items.some((it) => it.integrity === 'gap'),
      options: [['Say what the log shows, gap included', 'honest'], ['Say the chain of custody was complete', 'deny']] },
    { id: 'pressure', q: '"Did you put pressure on any witness?"', weak: ev.some((e) => e.tainted),
      options: [['Answer it straight', 'honest'], ['Say no, never', 'deny']] },
    { id: 'lab', q: '"Did the laboratory ever fail to reach a conclusion in this case?"', weak: f.labs.some((l) => l.status === 'reported' && l.result !== 'consistent' && l.result !== 'excluded'),
      options: [['Say which results were inconclusive', 'honest'], ['Say the science was clear throughout', 'deny']] },
    { id: 'others', q: '"Did you look seriously at anyone other than my client?"', weak: f.poi.filter((x) => x !== k.J().cases[f.courtCaseId]?.defendantId).length === 0 && !f.cleared.length,
      options: [['Say who else was looked at, and why they were cleared, or that nobody was', 'honest'], ['Say everyone was considered', 'deny']] },
  ];
}
export function crossExamination(invId, answers = {}) {
  const inv = investigation(invId);
  const f = inv?.file;
  const c = f && k.J().cases[f.courtCaseId];
  if (!c || TERMINAL.includes(c.stage)) return result(false, 'There is no trial to give evidence at.', 'neutral');
  if (f.cross) return result(false, 'You have given your evidence.', 'neutral');
  const lines = [];
  let caught = 0;
  let owned = 0;
  for (const x of crossQuestions(inv)) {
    const a = answers[x.id] ?? 'honest';
    if (a === 'deny' && x.weak) { caught += 1; lines.push(`${x.q} You deny it. Defense counsel reads from your own file. The jury watches you.`); }
    else if (x.weak) { owned += 1; lines.push(`${x.q} You say what happened. It is not good for the case, and it is true.`); }
    else lines.push(`${x.q} The file answers for you, and you say so.`);
  }
  f.cross = { at: now(), caught, owned, answers };
  I().stats.court += 1;
  grow('law', 2);
  if (caught) {
    // The investigator's word is worth less now: the court weighs their evidence that way (settleCourt reads testimony).
    f.testimony = { ...(f.testimony ?? {}), at: now(), how: 'overstate' };
    regard('integrity', -5 * caught); regard('reliability', -4 * caught);
    if (caught >= 2 && seeded(`${inv.id}/perjury`).chance(0.5)) complain(inv, 'testimony', 'Testimony at trial contradicted the investigator\'s own case file.');
    return result(true, lines.join(' '), 'bad', { lines });
  }
  regard('reliability', 2 + owned); regard('integrity', owned);
  return result(true, lines.join(' '), 'good', { lines });
}

/** A court date that has come: the court decides (engine/cases.js), with testimony and disclosure as they happened. */
export function settleCourt(inv) {
  const f = inv.file;
  const c = f?.courtCaseId && k.J().cases[f.courtCaseId];
  if (!c) return null;
  // A lawyer working the case (engine/investigations/legal.js) takes it through court; the court waits for them.
  if (lawyerOnIt(c.id)) return null;
  // A lawyer has finished it: the court's decision is on the case, and the investigation records it once.
  if (TERMINAL.includes(c.stage)) return f.outcome || !lawCaseFor(c.id) ? null : courtOutcome(inv, c);
  if ((c.trialDue ?? 0) > now()) return null;
  const r = rec();
  // Disclosure: what the report left out reaches the defense one way or another; when it does, the case cannot go on.
  if (f.report?.omitted.length && seeded(`${inv.id}/disclosure`).chance(0.65)) {
    k.move(c, 'dismissed', 'Dismissed: evidence favorable to the defense was not disclosed.');
    c.verdict = { outcome: 'dismissed', year: year() };
    f.outcome = { kind: 'dismissed', at: now(), why: 'disclosure' };
    if (f.leadId === me() && r) { r.stats.dismissed += 1; complain(inv, 'disclosure', 'Evidence favorable to the defense was left out of the case report.'); }
    f.log.push({ at: now(), text: 'The court dismissed the case: the defense was not told of statements in the investigation that did not fit.' });
    return 'dismissed';
  }
  if (f.cross?.caught || f.testimony?.how === 'overstate' && !f.cross && seeded(`${inv.id}/cross`).chance(0.6)) {
    for (const id of c.evidenceIds) { const e = k.J().evidence[id]; if (e && e.pointsTo === c.defendantId) e.reliability = Math.round(e.reliability * 0.7 * 100) / 100; }
    if (r) regard('reliability', -6);
    f.log.push({ at: now(), text: 'Under cross-examination, the investigator\'s account went beyond the file. The court weighed the evidence with that in mind.' });
  }
  // Statements taken by pressure are challenged, and the court decides whether to hear them.
  for (const id of c.evidenceIds) { const e = k.J().evidence[id]; if (e?.tainted) { e.admissible = false; c.rulings.push({ evidenceId: id, challenged: true, admitted: false, year: year() }); } }
  for (let i = 0; i < 8 && !TERMINAL.includes(c.stage); i++) k.runToEnd(c);
  return courtOutcome(inv, c);
}
/** Records the court's decision in the case file, and in the lead investigator's record. */
function courtOutcome(inv, c) {
  const f = inv.file;
  const r = rec();
  const convicted = c.stage === 'sentenced';
  f.outcome = { kind: convicted ? 'convicted' : c.stage === 'acquitted' ? 'acquitted' : c.stage, at: now() };
  const inc = incidentOf(inv);
  if (convicted && inc.truth.perpetratorId !== c.defendantId) inc.wrongful = true;
  if (f.leadId === me() && r) {
    if (convicted) r.stats.convicted += 1; else if (c.stage === 'acquitted') r.stats.acquitted += 1; else r.stats.dismissed += 1;
    r.stats.completed += 1;
  }
  f.log.push({ at: now(), text: `The court's decision: ${convicted ? `${nm(c.defendantId)} was convicted.` : c.stage === 'acquitted' ? `${nm(c.defendantId)} was acquitted.` : 'the case ended without a conviction.'}` });
  return f.outcome.kind;
}

/** Resolves a case that needs no prosecution (a missing person found, a report that was mistaken, no crime). */
export function resolve(invId, finding) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f || !canWork(inv)) return result(false, 'This case is not yours.', 'neutral');
  const st = standings(inv);
  const h = st[finding];
  if (!h) return result(false, 'That is not one of the explanations in this file.', 'neutral');
  if (!['supported', 'strongly supported'].includes(h.status)) return result(false, 'The evidence does not yet support closing the case on that basis.', 'neutral');
  const truth = incidentOf(inv).truth.hypothesis;
  const right = truth === finding;
  f.outcome = { kind: 'resolved', finding, at: now(), right };
  inv.stage = 'closed';
  inv.outcome = 'resolved';
  const r = I();
  r.stats.completed += 1;
  grow('reasoning', 3);
  regard('skill', right ? 3 : -2);
  if (f.template === 'missing') {
    const m = npc(f.missingId);
    const fam = npc(f.reportingId);
    if (right && m && fam) fam.meters.relationship = clamp(fam.meters.relationship + 15);
    const words = { voluntary: `${nm(f.missingId)} was found safe, living in another city by choice. They are an adult; where they live is theirs to share or not. Their family was told they are safe.`,
      accident: `${nm(f.missingId)} was found in a hospital, recovering from an accident.`, harm: `${nm(f.missingId)} was found, hurt; the case continues as an assault investigation.` }[finding];
    f.log.push({ at: now(), text: right ? words : 'Closed on the evidence available. Something about it may not be the whole story.' });
    return result(true, right ? words : 'You closed the inquiry on what the evidence showed. If more comes to light, it can be reopened.', right ? 'good' : 'neutral');
  }
  f.log.push({ at: now(), text: `Closed: ${HYPOTHESES[finding]}` });
  return result(true, `Closed: ${HYPOTHESES[finding].toLowerCase()} ${right ? '' : 'If more comes to light, it can be reopened.'}`, 'neutral');
}
/** Sets a case aside: open, inactive. After years with nothing new, it becomes a cold case; its records are kept whole. */
export function suspend(invId) {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f || !canWork(inv)) return result(false, 'This case is not yours.', 'neutral');
  inv.stage = 'suspended';
  f.inactive = now();
  f.log.push({ at: now(), text: 'Set aside for lack of leads. It stays open.' });
  return result(true, 'The case is inactive, not closed. Everything in the file is kept.', 'neutral');
}

/** Where a case stands, in plain words. */
export function caseStatus(inv) {
  const f = inv.file;
  if (f?.review?.status === 'open') return 'under review';
  if (f?.coldSince && !f.reopened.some((x) => x.at >= f.coldSince)) return 'cold';
  if (f?.outcome) return f.outcome.kind === 'resolved' ? 'resolved' : 'closed';
  if (f?.courtCaseId) return 'charged';
  if (inv.stage === 'suspended') return 'inactive';
  if (f?.labs.some((l) => l.status === 'pending')) return 'awaiting laboratory';
  if (f?.referral?.decision === 'more') return 'with the prosecutor';
  return inv.suspectIds.length ? 'suspect evaluation' : 'active';
}

/** Progress for any case the calendar has moved past: laboratory reports, court dates, cold cases. */
export function settleCase(inv) {
  const out = settleLabs(inv);
  const court = settleCourt(inv);
  if (court) out.push(`Court: ${court}.`);
  const f = inv.file;
  if (f && inv.stage === 'suspended' && !f.coldSince && f.inactive != null && now() - f.inactive >= 36) {
    f.coldSince = now();
    f.log.push({ at: now(), text: 'Classified as a cold case. All records, evidence and statements are preserved.' });
    if (f.leadId === me() && rec()) rec().stats.cold += 1;
  }
  return out;
}

/** Cold cases where something new is possible now: a laboratory discipline that did not exist when it went cold. */
export function coldCandidates(countryId = player().countryId) {
  return Object.values(k.J().investigations).filter((inv) => inv.file?.coldSince && incidentOf(inv).countryId === countryId).map((inv) => {
    const f = inv.file;
    const newer = f.items.filter((it) => !it.examined).flatMap((it) => Object.entries(LAB).filter(([id, d]) => d.kinds.includes(it.kind) && year() >= d.from && !it.disciplines.includes(id)).map(([id]) => ({ item: it.id, discipline: id })));
    return { inv, newer };
  }).filter((x) => x.newer.length);
}
/** Reopens a cold case: the original history stays as it was; the reopening is added to it. */
export function reopen(invId) {
  const inv = investigation(invId);
  const f = inv?.file;
  const r = I();
  if (!f?.coldSince) return result(false, 'That case is not cold.', 'neutral');
  if (!r.job || r.retired) return result(false, 'Only a serving investigator can reopen a case.', 'neutral');
  const fresh = coldCandidates().find((x) => x.inv.id === invId)?.newer ?? [];
  for (const n of fresh) { const it = f.items.find((x) => x.id === n.item); if (!it.disciplines.includes(n.discipline)) it.disciplines.push(n.discipline); }
  f.reopened.push({ at: now(), by: me(), why: fresh.length ? `${LAB[fresh[0].discipline].name} is available now.` : 'Reviewed.' });
  inv.stage = 'active';
  if (!inv.investigatorIds.includes(me())) inv.investigatorIds.push(me());
  f.formerLeadId ??= f.leadId;
  f.leadId = me();
  markAncestor(inv); // a case an ancestor led (family.js)
  checkConflict(inv);
  r.stats.reopened += 1;
  if (!r.caseIds.includes(inv.id)) r.caseIds.push(inv.id);
  f.log.push({ at: now(), text: `Reopened by ${nm(me())}. The original file, from ${dateWords(f.opened)}, is kept as it was.` });
  note(`Reopened a cold case: ${f.title}.`, 'career', { log: false });
  return result(true, `You reopened ${f.title}, first investigated ${Math.floor((now() - f.opened) / 12)} years ago. Every statement, item and decision from then is still in the file.`);
}

// ---------- Assignment and the year ----------

/** Assigns the player a new case, if their caseload allows. A detective in training gets supporting work, not a murder. */
export function assignCase(p = player()) {
  const r = rec(p);
  if (!r?.job || r.retired) return null;
  const active = r.caseIds.map(investigation).filter((inv) => inv && ['active', 'suspect', 'with the prosecutor', 'awaiting laboratory', 'suspect evaluation'].includes(caseStatus(inv)) && !inv.file?.outcome);
  if (active.length >= 3) return null;
  const unit = r.job.specialty ?? 'general';
  const fed = r.family === 'federal';
  // Each federal agency works its own jurisdiction: the FBI fraud, cybercrime, corruption, violent crime; the DEA drugs; the ATF firearms and arson.
  const FED_POOL = { fbi: ['fraud', 'cyber', 'robbery', 'corruption', 'homicide'], dea: ['drugs'], atf: ['firearms', 'arson'], usms: ['fugitive'], usss: ['counterfeit', 'fraud', 'cyber'], hsi: ['drugs', 'firearms', 'fraud'], irs: ['tax', 'fraud'] };
  const pool = fed ? (FED_POOL[r.job.agencyKind] ?? FED_POOL.fbi).filter((t) => !TEMPLATES[t].tech || techAvailable(TEMPLATES[t].tech, year(), p.countryId)) : templatesFor(unit);
  if (!pool.length) return null;
  const roll = seeded(`${me(p)}/assign/${year()}/${r.caseIds.length}`);
  const tid = roll.pick(pool);
  const inv = openCase(tid, { ownerId: r.job.agencyId ?? r.job.officeId });
  if (fed) inv.file.federal = r.job.agencyKind;
  // A relative of the player's, living in the city, may be among the people a case touches (family.js decides what follows).
  const fam = [...relatives(p)].map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age >= 16);
  if (fam.length && seeded(`${inv.id}/family`).chance(0.08)) { const n = seeded(`${inv.id}/family/who`).pick(fam); inv.file.people.push({ id: n.id, role: 'witness' }); }
  r.caseIds.push(inv.id);
  checkConflict(inv, p);
  r.stats.assigned += 1;
  inv.file.log.push({ at: now(), text: `Assigned to ${nm(me(p))}${r.people.partnerId ? ` with ${nm(r.people.partnerId)}` : ''}.` });
  if (r.people.partnerId) meet(r.people.partnerId, npc(r.people.partnerId)?.flags.title ?? 'Detective partner');
  return inv;
}

/** A complaint against the investigator, opened by the agency (engine/investigations/oversight.js decides it). */
function complain(inv, kind, text) {
  const w = W();
  const id = nextId('complaint');
  w.complaints[id] = { id, subjectId: me(), kind, text, invId: inv.id, opened: now(), status: 'open', finding: null, investigatorId: null, due: now() + 4, true: true };
}

/** Everything the player's cases need from the calendar. Called from the year and whenever the hub opens. */
export function settleAll(p = player()) {
  const r = rec(p);
  if (!r) return [];
  const out = [];
  for (const id of r.caseIds) { const inv = investigation(id); if (inv?.file) out.push(...settleCase(inv)); }
  return out;
}

// ---------- Conviction review ----------
//
// A case that ended in a conviction can be looked at again when something new can be tested: a
// laboratory method that was not used, on evidence that was kept. Nothing is overturned here. A
// result that points elsewhere goes, through the prosecutor's conviction review, to the appeal
// court as new evidence (engine/cases.js fileAppeal), which decides. The original verdict stays in
// the record; any later decision is added to it.

/** Convictions where kept evidence could now be tested in a way it was not. */
export function reviewCandidates(countryId = player().countryId) {
  return Object.values(k.J().investigations).filter((inv) => {
    const c = inv.file?.courtCaseId && k.J().cases[inv.file.courtCaseId];
    return c && c.stage === 'sentenced' && incidentOf(inv).countryId === countryId && !inv.file.review;
  }).map((inv) => ({ inv, newer: newerTests(inv) })).filter((x) => x.newer.length).sort((a, b) => (b.inv.file.publicAttention ?? 0) - (a.inv.file.publicAttention ?? 0));
}
function newerTests(inv) {
  const used = new Set(inv.file.labs.map((l) => `${l.itemId}:${l.discipline}`));
  return inv.file.items.flatMap((it) => Object.entries(LAB).filter(([id, d]) => d.kinds.includes(it.kind) && year() >= d.from && (!d.tech || techAvailable(d.tech, year(), incidentOf(inv).countryId)) && !used.has(`${it.id}:${id}`))
    .map(([id]) => ({ item: it.id, discipline: id })));
}
/** Opens a review of a conviction: the kept items may be tested again. The conviction stands meanwhile. */
export function openReview(invId) {
  const inv = investigation(invId);
  const f = inv?.file;
  const r = I();
  if (!f || !reviewCandidates(incidentOf(inv).countryId).some((x) => x.inv.id === invId)) return result(false, 'There is nothing new that could be tested in that case.', 'neutral');
  if (!r.job || r.retired) return result(false, 'Only a serving investigator can open a review.', 'neutral');
  const tests = newerTests(inv);
  for (const t of tests) { const it = f.items.find((x) => x.id === t.item); if (!it.disciplines.includes(t.discipline)) it.disciplines.push(t.discipline); it.examined = false; }
  f.review = { at: now(), by: me(), status: 'open', outcome: null };
  f.formerLeadId ??= f.leadId;
  markAncestor(inv);
  if (!inv.investigatorIds.includes(me())) inv.investigatorIds.push(me());
  if (!r.caseIds.includes(inv.id)) r.caseIds.push(inv.id);
  f.log.push({ at: now(), text: `Review opened by ${nm(me())}. The conviction stands while it is reviewed; the original file is kept as it was.` });
  return result(true, `You opened a review of ${f.title}. ${tests.map((t) => LAB[t.discipline].name).join(', ')} can be tried on what was kept. The conviction stands unless a court says otherwise.`, 'neutral');
}
/** Laboratory steps for a case under review (the only steps a review takes). */
export function reviewSteps(inv) {
  const f = inv.file;
  if (f?.review?.status !== 'open') return [];
  const out = [];
  for (const it of f.items) for (const d of it.disciplines) if (!f.labs.some((l) => l.itemId === it.id && l.discipline === d)) out.push({ id: `lab:${it.id}:${d}`, label: `Test ${it.label.toLowerCase()}: ${LAB[d].name.toLowerCase().replace(/\bdna\b/g, "DNA")}`, sub: `About ${LAB[d].months} months.`, lab: true });
  return out;
}
/**
 * Sends the review to the prosecutor's conviction review. Only a result reported during the review that
 * points to someone other than the person convicted is new evidence; the appeal court then decides.
 */
export function referReview(invId) {
  const inv = investigation(invId);
  const f = inv?.file;
  const c = f?.courtCaseId && k.J().cases[f.courtCaseId];
  if (!f?.review || f.review.status !== 'open' || !c) return result(false, 'There is no open review.', 'neutral');
  const fresh = f.labs.filter((l) => l.status === 'reported' && l.reported >= f.review.at && l.result === 'consistent').map((l) => k.J().evidence[f.items.find((x) => x.id === l.itemId).evidenceId]).find((e) => e?.pointsTo && e.pointsTo !== c.defendantId);
  const pros = npc(f.referral?.prosecutorId) ?? prosecutorFor(inv.agencyId, incidentOf(inv).countryId);
  if (!fresh) {
    f.review.status = 'closed';
    f.review.outcome = 'no new evidence';
    f.log.push({ at: now(), text: `${nm(pros.id)}'s conviction review found nothing that changes the case. The conviction stands.` });
    return result(true, `${nm(pros.id)} reviewed the results: nothing in them points away from ${nm(c.defendantId)}. A review is not a retrial; the conviction stands.`, 'neutral');
  }
  c.fresh = fresh.id;
  const res = k.fileAppeal(c, 'new_evidence', c.defenseId);
  f.review.status = 'closed';
  f.review.outcome = res?.outcome ?? 'dismissed';
  f.review.decided = now();
  if (res?.outcome === 'exonerated') {
    const r = I();
    r.stats.cleared += 1;
    regard('integrity', 4);
    if (!f.poi.includes(fresh.pointsTo)) f.poi.push(fresh.pointsTo);
    inv.stage = 'active';
    f.outcome = null; // the investigation into who did it is open again, with everything that was learned
    note(`A conviction reviewed: ${nm(c.defendantId)} was exonerated.`, 'career', { key: `exoneration:${c.id}`, milestone: 'A review you opened cleared a wrongly convicted person.', significance: 2, log: false });
  }
  f.log.push({ at: now(), text: `${nm(pros.id)} put the new result before the appeal court, which decided: ${f.review.outcome}. The original verdict remains on the record, with this decision beside it.` });
  return result(true, res?.outcome === 'exonerated' ? `The appeal court quashed ${nm(c.defendantId)}'s conviction on the new evidence. The case is open again: someone else did this.` : `The appeal court heard the new result and dismissed the appeal. The conviction stands.`, res?.outcome === 'exonerated' ? 'good' : 'neutral');
}
