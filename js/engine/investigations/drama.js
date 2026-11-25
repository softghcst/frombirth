// The people around the work, and the stories between them: partners, mentors, supervisors,
// classmates, rivals, the witnesses who remember how they were treated, task forces, and the cases
// that stay with an investigator. Every scene here is queued from the saved records (a real offer,
// a real partner, a real case); firsts happen once; at most two a year. Nothing here changes what
// happened in a case; scenes change people, standing and choices.
import { clamp } from '../../util.js';
import { store, player, log } from '../../state.js';
import { SPECIALTIES, FEDERAL, LAB_RESULTS } from '../../data/investigations.js';
import { W, I, rec, now, year, me, nextId, result, note, grow, regard, seeded, reputationOf } from './core.js';
import { agency, office, officeOf, staffer } from './agencies.js';
import { acceptAcademy, declineOffer, meet } from './careers.js';
import { investigation, incidentOf, caseStatus, coldCandidates, reopen, standings } from './casework.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => (npc(id) ? `${npc(id).firstName} ${npc(id).lastName}` : 'someone');
const live = (id) => !!npc(id)?.alive;

/** Queues a scene once (or once per key), with words for its text. */
function queue(r, id, words, key = id) {
  if (r.scenes[key]) return false;
  const st = store.state;
  if (st.pendingEvents.filter((x) => x.id.startsWith('inv_')).length >= 2) return false;
  if (st.pendingEvents.some((x) => x.id === id)) return false;
  r.scenes[key] = year();
  st.pendingEvents.push({ id, cast: { words } });
  return true;
}

/** This year's stories, from what the records show. */
export function dramaYear(p = player()) {
  const r = rec(p);
  if (!r) return;
  const j = r.job;
  const offer = r.apps.find((a) => a.kind === 'police' && a.status === 'offer');
  if (offer) queue(r, 'inv_acceptance', { agency: agency(offer.ownerId)?.name ?? 'the department', app: offer.id }, `acceptance:${offer.id}`);
  if (r.academy?.status === 'enrolled' && r.academy.classmateIds?.[0] && live(r.academy.classmateIds[0])) queue(r, 'inv_first_day', { classmate: nm(r.academy.classmateIds[0]) }, `firstday:${r.academy.start}`);
  if (r.stage === 'field' && live(r.people.ftoId)) { queue(r, 'inv_mentor', { fto: nm(r.people.ftoId) }, `mentor:${r.people.ftoId}`) || queue(r, 'inv_field_eval', { fto: nm(r.people.ftoId) }, `eval:${r.people.ftoId}`); }
  if (['probation', 'officer'].includes(r.stage) && !j?.detective) { queue(r, 'inv_first_report', {}, 'firstreport') || queue(r, 'inv_difficult_conversation', {}, 'difficult'); }
  const a = agency(j?.agencyId);
  if (a && r.stage === 'officer' && !j.detective) {
    const v = a.vacancies.find((x) => x.kind === 'detective' && x.status === 'open' && x.year === year());
    if (v) queue(r, 'inv_detective_opens', { unit: SPECIALTIES[v.unit].name.toLowerCase() }, `vacancy:${year()}`);
  }
  if (live(r.people.partnerId)) queue(r, 'inv_new_partner', { partner: nm(r.people.partnerId) }, `partner:${r.people.partnerId}`);
  // Cases.
  const cases = r.caseIds.map(investigation).filter((inv) => inv?.file);
  const first = cases[0];
  if (first) queue(r, 'inv_first_lead', { case: first.file.title, partner: r.people.partnerId ? nm(r.people.partnerId) : 'your sergeant' }, 'firstcase');
  for (const inv of cases) {
    const f = inv.file;
    const w = { case: f.title };
    const lab = f.labs.find((l) => l.status === 'reported' && l.reported >= now() - 12 && !r.scenes[`lab:${l.id}`]);
    if (lab && queue(r, 'inv_lab_arrives', { ...w, result: LAB_RESULTS[lab.result].toLowerCase() }, `lab:${lab.id}`)) continue;
    if (f.referral?.decision === 'more' && queue(r, 'inv_prosecutor_more', { ...w, prosecutor: nm(f.referral.prosecutorId) }, `more:${inv.id}`)) continue;
    if (f.cleared.length && queue(r, 'inv_doesnt_fit', { ...w, cleared: nm(f.cleared[0]) }, `fit:${inv.id}`)) { queue(r, 'inv_cleared', w, `cleared:${inv.id}`); continue; }
    const changed = Object.values(f.witnesses).find((x) => x.statements.some((s) => s.q === 'inconsistency') && f.clues.some((c) => c.sourceId === x.id && !c.accurate));
    if (changed && queue(r, 'inv_witness_changes', { ...w, witness: nm(changed.id) }, `changes:${inv.id}`)) continue;
    if (!f.outcome && !f.report && now() > f.due && queue(r, 'inv_report_due', w, `due:${inv.id}`)) continue;
    if (f.outcome && queue(r, 'inv_closed', w, `closed:${inv.id}`)) continue;
    if (caseStatus(inv) === 'cold' && queue(r, 'inv_cold', w, `cold:${inv.id}`)) continue;
    if (f.courtCaseId && !f.outcome && queue(r, 'inv_reporter', { ...w, reporter: nm(reporterFor(inv)) }, `press:${inv.id}`)) continue;
    if (['homicide', 'missing'].includes(f.template) && !f.outcome && year() > Math.floor(f.opened / 12) && queue(r, 'inv_family_answers', w, `family:${inv.id}`)) continue;
    const divided = Object.values(standings(inv)).filter((h) => h.status.includes('supported')).length >= 2;
    if (divided && queue(r, 'inv_case_divides', w, `divide:${inv.id}`)) continue;
    // A witness from an earlier case who remembers being treated decently.
    const old = Object.values(store.state.npcs).find((n) => n.alive && n.flags.invMemory?.some((m) => m.by === me() && m.respectful && m.invId !== inv.id) && !f.witnesses[n.id]);
    if (old && !f.outcome && seeded(`${inv.id}/${old.id}`).chance(0.3) && queue(r, 'inv_witness_remembered', { ...w, witness: nm(old.id), witnessId: old.id, invId: inv.id }, `remembered:${inv.id}`)) continue;
  }
  if (j && cases.length && !cases.some((inv) => !inv.file.outcome) && cases.length >= 3) {
    const old = cases.find((inv) => caseStatus(inv) === 'cold' && now() - inv.file.coldSince >= 60);
    if (old) queue(r, 'inv_stayed_with_you', { case: old.file.title }, `stayed:${old.id}`);
  }
  const cold = j && (j.specialty === 'cold' || j.detective || r.family === 'federal') ? coldCandidates(p.countryId)[0] : null;
  if (cold) queue(r, 'inv_breakthrough', { case: cold.inv.file.title, years: String(Math.floor((now() - cold.inv.file.opened) / 12)), invId: cold.inv.id }, `breakthrough:${cold.inv.id}`);
  // Federal.
  const fed = r.apps.find((x) => x.kind === 'federal' && x.status === 'pending' && x.stages.find((s) => s.id === 'background')?.due <= now() + 3);
  if (fed) queue(r, 'inv_background', { agency: FEDERAL[fed.agency].short, app: fed.id }, `bg:${fed.id}`);
  if (r.pendingMove && j?.officeId) {
    queue(r, 'inv_field_office', { office: office(j.officeId)?.name }, `office:${j.officeId}`);
    const spouse = p.npcIds.map(npc).find((n) => n?.alive && n.role === 'spouse');
    if (spouse) queue(r, 'inv_two_careers', { spouse: spouse.firstName }, `twocareers:${j.officeId}`);
  }
  if (r.family === 'federal' && ['senior_agent', 'supervisory'].includes(j?.rank) && reputationOf(r) >= 65) queue(r, 'inv_hq_offer', {}, `hq:${j.rank}`);
  // People.
  const partner = npc(r.people.partnerId);
  if (partner?.alive && j) {
    const since = r.scenes[`partner:${partner.id}`] ?? year();
    if (year() - since >= 8) queue(r, 'inv_longtime_partner', { partner: nm(partner.id), years: String(year() - since) }, `long:${partner.id}`);
    if (seeded(`${partner.id}/promo/${year()}`).chance(0.08) && year() - since >= 3) queue(r, 'inv_partner_promoted', { partner: nm(partner.id), partnerId: partner.id }, `promo:${partner.id}`);
    if (partner.meters.relationship < 45 && seeded(`${partner.id}/pressure/${year()}`).chance(0.3)) queue(r, 'inv_friendship_pressure', { partner: nm(partner.id) }, `pressure:${partner.id}`);
  }
  const sup = npc(r.people.supervisorId);
  if (sup?.alive && j && seeded(`${sup.id}/hard`).chance(0.3)) queue(r, 'inv_difficult_supervisor', { supervisor: nm(sup.id) }, `sup:${sup.id}`);
  const mentor = npc(r.people.mentorId);
  if (mentor?.alive && mentor.age >= 58 && j) queue(r, 'inv_mentor_retiring', { mentor: nm(mentor.id), mentorId: mentor.id }, `retire:${mentor.id}`);
  const classmate = r.people.classmateIds.map(npc).find((n) => n?.alive);
  if (classmate && r.academy?.graduated && now() - r.academy.graduated >= 60) queue(r, 'inv_academy_friend', { classmate: nm(classmate.id), classmateId: classmate.id }, `classmate:${classmate.id}`);
  if (a && a.chiefSince === year() && a.chiefId !== me()) queue(r, 'inv_new_chief', { agency: a.name, chief: nm(a.chiefId) }, `chief:${a.chiefId}`);
  const complaint = Object.values(W().complaints).find((c) => c.subjectId === me() && c.status === 'open');
  if (complaint) queue(r, 'inv_complaint', {}, `complaint:${complaint.id}`);
  if (!j && r.stats.years >= 8 && !r.license) queue(r, 'inv_job_offer', {}, 'pioffer');
}
function reporterFor(inv) {
  const w = W();
  w.reporters ??= {};
  const key = inv.agencyId ?? 'x';
  if (!live(w.reporters[key])) w.reporters[key] = staffer(player().countryId, 'staff', 'Court reporter', { role: 'reporter' }).id;
  return w.reporters[key];
}

/** What a choice in one of these scenes does. Returns a line to add, or null. */
export function invChoice(value, cast = {}) {
  const p = player();
  const r = I();
  const [what, how] = value.split(':');
  const w = cast.words ?? {};
  const partner = npc(r.people.partnerId);
  switch (what) {
    case 'offer': { const app = r.apps.find((x) => x.id === w.app); if (!app) return null; return (how === 'accept' ? acceptAcademy(app.id) : declineOffer(app.id)).text; }
    case 'firstday': { const c = npc(r.academy?.classmateIds?.[0]); if (how === 'friend' && c) { c.meters.relationship = clamp(c.meters.relationship + 15); grow('teamwork', 3); } else grow('law', 3); return null; }
    case 'mentor': { const m = npc(r.people.ftoId); if (m) m.meters.relationship = clamp(m.meters.relationship + (how === 'listen' ? 10 : -6)); if (how === 'listen') { grow('writing', 3); r.people.mentorId = r.people.ftoId; } return null; }
    case 'eval': if (how === 'learn') { grow('writing', 4); grow('timeline', 3); } else regard('teamwork', -3); return null;
    case 'report': if (how === 'clean') { grow('writing', 3); regard('reports', 3); } else { regard('reports', -3); grow('writing', 1); } return null;
    case 'talk': grow('interviewing', how === 'calm' ? 4 : 2); if (how === 'calm') regard('skill', 1); return null;
    case 'vacancy': if (how === 'prepare') { grow('reasoning', 3); grow('evidence', 3); } return null;
    case 'partner': if (partner) partner.meters.relationship = clamp(partner.meters.relationship + (how === 'work' ? 12 : 2)); grow('teamwork', how === 'work' ? 4 : 1); return null;
    case 'case': grow(how === 'read' ? 'evidence' : 'teamwork', 3); return null;
    case 'witness': grow('interviewing', how === 'thank' ? 3 : 1); return null;
    case 'lab': grow('forensic', how === 'discuss' ? 4 : 1); return null;
    case 'pros': if (how === 'ask') grow('law', 3); else regard('teamwork', -3); return null;
    case 'fit': if (how === 'accept') { regard('integrity', 3); grow('reasoning', 3); } return null;
    case 'due': if (how === 'write') { regard('reliability', 3); grow('writing', 2); } else regard('reliability', -1); return null;
    case 'change': if (how === 'disclose') { regard('integrity', 4); regard('ethics', 3); return 'The prosecutor has it, and so will the defense. The case is what it is.'; }
      regard('ethics', -10); regard('integrity', -10); return 'It is not in the file. It still happened.';
    case 'cleared': regard('integrity', 2); return null;
    case 'closed': if (how === 'note') regard('reports', 2); return null;
    case 'cold': if (how === 'reopen' && w.invId) return reopen(w.invId).text; return null;
    case 'bg': if (how === 'omit') { const app = r.apps.find((x) => x.id === w.app); const s = app?.stages.find((x) => x.id === 'background'); if (s) { s.pass = false; s.score = Math.min(s.score, 30); } return 'Background investigators found what you left out. Not what it was: that you left it out.'; }
      regard('integrity', 2); return null;
    case 'office': return null;
    case 'tf': if (how === 'join') { grow('interagency', 5); grow('teamwork', 2); } return null;
    case 'jur': if (how === 'share') { grow('interagency', 4); regard('teamwork', 2); } else regard('teamwork', -2); return null;
    case 'hq': if (how === 'yes') r.hqList = year(); return null;
    case 'promo': { const pt = npc(w.partnerId); if (pt) { pt.flags.title = 'Detective sergeant'; pt.occupation = 'Detective sergeant'; pt.meters.relationship = clamp(pt.meters.relationship + (how === 'glad' ? 8 : -4)); r.people.supervisorId = pt.id; r.people.formerPartnerIds.push(pt.id);
      const a = agency(r.job?.agencyId); const u = a?.units?.[r.job?.specialty]; const next = u?.memberIds.find((id) => id !== me() && id !== pt.id && live(id)) ?? (a ? staffer(a.countryId, 'detective', 'Detective', { agencyId: a.id }).id : null);
      if (next) { r.people.partnerId = next; meet(next, 'Detective partner'); } } return null; }
    case 'divide': if (how === 'evidence') { grow('reasoning', 3); regard('leadership', 2); } return null;
    case 'sup': { const s = npc(r.people.supervisorId); if (s) s.meters.relationship = clamp(s.meters.relationship + (how === 'talk' ? 6 : 0)); if (how === 'endure') p.stats.health = clamp(p.stats.health - 2); return null; }
    case 'retire': { const m = npc(w.mentorId); if (m) { m.flags.title = 'Retired, your mentor'; m.occupation = `Retired ${(m.occupation ?? 'officer').toLowerCase()}`; if (m.flags.justice) m.flags.justice.retired = year(); m.meters.relationship = clamp(m.meters.relationship + 8); } return null; }
    case 'friend': { const c = npc(w.classmateId); if (c) { c.meters.relationship = clamp(c.meters.relationship + (how === 'meet' ? 12 : 4)); if (!p.npcIds.includes(c.id)) p.npcIds.push(c.id); c.role = c.role === 'official' ? 'friend' : c.role; } return null; }
    case 'move': { const s = p.npcIds.map(npc).find((n) => n?.alive && n.role === 'spouse'); if (s) s.meters.relationship = clamp(s.meters.relationship + (how === 'talk' ? 4 : -10)); return null; }
    case 'chief': return null;
    case 'complaint': regard('reliability', how === 'cooperate' ? 1 : 0); return null;
    case 'long': if (partner) partner.meters.relationship = clamp(partner.meters.relationship + 6); return null;
    case 'offer': return null;
    case 'pressure': if (how === 'honest') { regard('integrity', 5); if (partner) partner.meters.relationship = clamp(partner.meters.relationship - 5); return null; }
      regard('integrity', -12); regard('ethics', -8); { const id = nextId('complaint'); W().complaints[id] = { id, subjectId: me(), kind: 'fabrication', text: 'Your account of an incident was found to match a colleague\'s word for word, and not the recording.', invId: null, opened: now(), due: now() + 6, status: 'open', true: true }; }
      return 'Two accounts that match word for word draw attention.';
    case 'stayed': return null;
    case 'press': if (how === 'leak') { regard('ethics', -8); const id = nextId('complaint'); W().complaints[id] = { id, subjectId: me(), kind: 'confidentiality', text: 'Details of a case before the court reached a newspaper.', invId: null, opened: now(), due: now() + 4, status: 'open', true: true }; } else regard('reliability', 1); return null;
    case 'family': grow('interviewing', 2); regard('reliability', 1); return null;
    case 'remembered': { const inv = investigation(w.invId); const n = npc(w.witnessId); if (inv?.file && n) { inv.file.people.push({ id: n.id, role: 'witness' }); inv.file.log.push({ at: now(), text: `${nm(n.id)}, who helped on an earlier case, came forward.` }); } return null; }
    default: return null;
  }
}

/** Partners, mentors and supervisors keep their identities: one who dies or retires is replaced by a real colleague, and the old one stays in history. */
export function peopleYear(p = player()) {
  const r = rec(p);
  if (!r?.job) return;
  for (const key of ['partnerId', 'supervisorId']) {
    const id = r.people[key];
    if (!id || live(id) && !npc(id)?.flags.justice?.retired) continue;
    if (key === 'partnerId') r.people.formerPartnerIds.push(id);
    const a = agency(r.job.agencyId);
    const o = office(r.job.officeId);
    const next = key === 'partnerId'
      ? (a?.units?.[r.job.specialty]?.memberIds.find((x) => x !== me() && x !== id && live(x)) ?? o?.agentIds.find((x) => x !== id && live(x)))
      : (a?.units?.[r.job.specialty]?.headId ?? o?.supervisorIds[0]);
    r.people[key] = next ?? null;
    if (next) { meet(next, key === 'partnerId' ? (r.family === 'federal' ? 'Special agent' : 'Detective partner') : (r.family === 'federal' ? 'Supervisory special agent' : 'Detective sergeant')); log(`${nm(id)} ${live(id) ? 'has retired' : 'has died'}. ${nm(next)} works with you now.`, 'system', 'neutral'); }
  }
  // A chief who retires is replaced; the department changes leadership.
  const a = agency(r.job.agencyId);
  if (a && a.chiefId !== me() && (!live(a.chiefId) || npc(a.chiefId)?.flags.justice?.retired)) { a.chiefId = staffer(a.countryId, 'officer', 'Chief of police', { agencyId: a.id, rank: 'chief', age: 50 }).id; a.chiefSince = year(); }
}

/**
 * A task force: when a case crosses into a federal agency's jurisdiction (a robbery series, a fraud across
 * state lines), agencies work one case together. It is the same investigation, never a copy: the task force
 * lists the agencies, the members and the case, and members may work the file (casework.canWork).
 */
export function formTaskForce(invId, federalKey = 'fbi') {
  const inv = investigation(invId);
  const f = inv?.file;
  if (!f) return result(false, 'There is no such case.', 'neutral');
  if (f.taskForceId) return result(false, 'A task force is already working it.', 'neutral');
  const inc = incidentOf(inv);
  if (inc.countryId !== 'us') return result(false, 'Federal task forces are only modeled in the United States.', 'neutral');
  const o = officeOf(federalKey, inc.city);
  const agentId = o.agentIds.find(live);
  const tf = { id: nextId('tf'), leadAgency: federalKey, ownerIds: [inv.agencyId, o.id], caseIds: [inv.id], memberIds: [...new Set([...inv.investigatorIds, agentId])],
    basis: 'A pattern across jurisdictions brings the case within federal jurisdiction.', formed: now(), status: 'active', leaderId: o.supervisorIds[0] };
  W().taskForces[tf.id] = tf;
  f.taskForceId = tf.id;
  f.log.push({ at: now(), text: `A task force was formed with ${o.name}: one case file, shared. ${nm(agentId)} joins it.` });
  if (inv.investigatorIds.includes(me())) { meet(agentId, `Task force agent, ${FEDERAL[federalKey].short}`); grow('interagency', 3); }
  return result(true, `${o.name} joins the case through a task force. It is still one case, with one file.`);
}
