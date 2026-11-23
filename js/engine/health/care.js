// Places, people and appointments: clinics that persist in each city, the
// clinicians who work in them (ordinary Pathways NPCs, kept for life), booking
// and attending appointments, assessment, diagnosis and the care plan.
import { rng } from '../../rng.js';
import { store, player, country, log } from '../../state.js';
import { makeNpc } from '../npcFactory.js';
import { FACILITIES, FACILITY_BY_ID, PROFESSIONS, APPROACHES, VISIT_COST } from '../../data/health/providers.js';
import { CONDITION_BY_ID, MENTAL, nameIn } from '../../data/health/conditions.js';
import { THERAPY_BY_ID } from '../../data/health/therapies.js';
import { MED_BY_ID } from '../../data/health/medications.js';
import { SYMPTOMS } from '../../data/health/symptoms.js';
import { healthOf, presentConditions, diagnosisFor, note, activeDiagnoses } from './record.js';
import { mayDiagnose, professionExists, canOffer, optionsFor } from './rules.js';
import { now, seeded, charge, priceOf, rel, when, hashOf } from './util.js';
import { dailyFunctioning } from './course.js';
import { inHospital } from './hospital.js';
import { seeNow } from './index.js';
import { healthMilestone } from './story.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---------- Facilities ----------

function world() {
  store.state.care ??= { facilities: {}, groups: {} };
  return store.state.care;
}

/**
 * The health facilities in the player's city that exist this year. Each is made
 * the first time it is needed and kept from then on, with its staff.
 */
export function facilitiesHere(p = player()) {
  const w = world();
  const out = [];
  for (const def of FACILITIES) {
    if (store.state.year < def.from) continue;
    if (def.dbt && store.state.year < 1995) continue;
    const id = `fac_${p.countryId}_${slug(p.city)}_${def.id}`;
    w.facilities[id] ??= { id, defId: def.id, name: def.name(p.city), kind: def.kind, countryId: p.countryId, city: p.city,
      public: def.public, fee: def.fee ?? 1, opened: store.state.year, staff: {} };
    out.push(w.facilities[id]);
  }
  return out;
}
export const facility = (id) => world().facilities[id];
export const facilityDef = (f) => FACILITY_BY_ID[f?.defId];

/** How long the wait is for a first appointment, in weeks. Public services wait longer; private ones cost more. */
export function waitWeeks(f) {
  const def = facilityDef(f);
  const base = def?.waits ?? (f.public ? 3 : 1);
  return Math.max(1, Math.round(base * (f.public ? 1 : 0.4)));
}

// ---------- Clinicians ----------

/** A clinician who works at this facility, made on first need and kept for the rest of the life. */
export function clinicianAt(f, profession, o = {}) {
  const def = facilityDef(f);
  if (!def.staff.includes(profession) || !professionExists(profession)) return null;
  const ids = (f.staff[profession] ??= []);
  const ok = (n) => n?.alive && n.flags.clinician?.facilityId === f.id && !n.flags.clinician.retired && (!o.dbt || n.flags.clinician.dbt);
  const have = ids.map((id) => store.state.npcs[id]).filter(ok);
  if (have.length && !o.another) return o.exclude ? have.find((n) => !o.exclude.includes(n.id)) ?? null : have[0];
  if (have.length >= 3) return have.find((n) => !(o.exclude ?? []).includes(n.id)) ?? null;
  const pro = PROFESSIONS[profession];
  const years = rng.int(3, 28);
  const npc = makeNpc({ role: 'clinician', countryId: f.countryId, age: 26 + years + rng.int(0, 6), relationship: 40 });
  npc.occupation = pro.career;
  npc.flags.clinician = { profession, facilityId: f.id, facilities: [f.id], dbt: !!(o.dbt || (def.dbt && ['psychologist', 'therapist'].includes(profession))),
    approach: rng.pick(APPROACHES), years, qual: pro.qual, since: store.state.year - years };
  store.state.npcs[npc.id] = npc;
  ids.push(npc.id);
  return npc;
}

/** Clinicians join the player's life (their People list, their aging) once they are caring for them. */
export function joinCareTeam(npc, p = player()) {
  if (!npc) return;
  const h = healthOf(p);
  if (!p.npcIds.includes(npc.id)) p.npcIds.push(npc.id);
  if (!h.careTeam.includes(npc.id)) h.careTeam.push(npc.id);
  npc.lastInteractionAge = p.age;
}

/** "Dr. Okafor" or "Sam Okafor": how a clinician is named in the health screens. */
export function clinicianName(npc) {
  if (!npc) return 'a clinician';
  const t = PROFESSIONS[npc.flags.clinician?.profession]?.title;
  return t ? `${t} ${npc.lastName}` : `${npc.firstName} ${npc.lastName}`;
}
export const professionName = (npc) => PROFESSIONS[npc?.flags?.clinician?.profession]?.name ?? 'Clinician';

/** Clinicians move on: retirements, and now and then a move to another clinic. Identities and records stay. */
export function tickClinicians(p = player()) {
  const h = healthOf(p);
  for (const id of h.careTeam) {
    const n = store.state.npcs[id];
    if (!n?.flags.clinician || !n.alive) continue;
    const c = n.flags.clinician;
    if (c.retired) continue;
    if (n.age >= 67 && rng.chance(0.35)) {
      c.retired = true;
      handOver(n, 'retired');
      continue;
    }
    if (rng.chance(0.03)) {
      const others = facilitiesHere(p).filter((f) => f.id !== c.facilityId && facilityDef(f).staff.includes(c.profession));
      if (!others.length) continue;
      const to = rng.pick(others);
      c.facilityId = to.id;
      c.facilities.push(to.id);
      (to.staff[c.profession] ??= []).push(n.id);
      log(`${clinicianName(n)} has moved to ${to.name}. Your appointments move with them.`, 'system', 'neutral');
    }
  }
  for (const id of h.careTeam) { const n = store.state.npcs[id]; if (n && !n.alive && !n.flags.clinician?.handedOver) handOver(n, 'died'); }
}

/** Someone else at the clinic takes over. The history stays with the patient. */
function handOver(gone, why) {
  const p = player();
  const h = healthOf(p);
  gone.flags.clinician.handedOver = true;
  const f = facility(gone.flags.clinician.facilityId);
  const next = f ? clinicianAt(f, gone.flags.clinician.profession, { dbt: gone.flags.clinician.dbt, exclude: [gone.id], another: true }) : null;
  let moved = 0;
  for (const t of h.therapies) if (t.providerId === gone.id && t.status === 'active') { t.providerId = next?.id ?? null; t.history.push({ wk: now(), text: `${clinicianName(gone)} ${why === 'died' ? 'died' : 'retired'}; ${next ? `${clinicianName(next)} took over` : 'care paused'}.` }); moved++; if (!next) t.status = 'paused'; }
  for (const t of h.trials) if (t.prescriberId === gone.id && ['active', 'adjusted', 'under_review', 'tapering'].includes(t.status)) { t.prescriberId = next?.id ?? t.prescriberId; moved++; }
  if (next && moved) joinCareTeam(next, p);
  if (moved) log(`${clinicianName(gone)} ${why === 'died' ? 'has died' : 'has retired'}. ${next ? `${clinicianName(next)} has taken over your care, with all your notes.` : 'The clinic will be in touch about who takes over.'}`, 'system', 'neutral');
}

// ---------- Appointments ----------

/**
 * Books an appointment. Nothing happens until its week comes round (in the
 * weekly care tick), and nothing is paid until it is attended.
 */
export function book(kind, o, p = player()) {
  const h = healthOf(p);
  const f = facility(o.facilityId);
  const at = o.wk ?? now(p) + (o.wait ?? waitWeeks(f));
  if (o.ref && h.appointments.some((a) => a.ref === o.ref && a.kind === kind && a.status === 'booked')) {
    return h.appointments.find((a) => a.ref === o.ref && a.kind === kind && a.status === 'booked');
  }
  const appt = { id: `appt_${hashOf(p.id, kind, at, h.appointments.length).toString(36)}`, kind, wk: at, facilityId: o.facilityId, providerId: o.providerId,
    ref: o.ref ?? null, concern: o.concern ?? null, status: 'booked', fee: f?.fee ?? 1, booked: now(p), note: o.note ?? '' };
  h.appointments.push(appt);
  const n = store.state.npcs[o.providerId];
  if (n) joinCareTeam(n, p);
  return appt;
}

export const upcoming = (h = healthOf()) => h.appointments.filter((a) => a.status === 'booked').sort((a, b) => a.wk - b.wk);

/** Cancels a booked appointment. Nothing is charged; the slot goes to someone else. */
export function cancel(apptId) {
  const h = healthOf();
  const a = h.appointments.find((x) => x.id === apptId && x.status === 'booked');
  if (!a) return result(false, 'There is no such appointment.', 'neutral');
  a.status = 'canceled';
  return result(true, 'Canceled. You can book again whenever you are ready.', 'neutral');
}

/** Moves an appointment back by some weeks. */
export function reschedule(apptId, weeks = 2) {
  const h = healthOf();
  const a = h.appointments.find((x) => x.id === apptId && x.status === 'booked');
  if (!a) return result(false, 'There is no such appointment.', 'neutral');
  a.wk = Math.max(now() + 1, a.wk + weeks);
  return result(true, `Moved to ${when(a.wk)}.`, 'neutral');
}

/** Whether the player turns up this week. Busy lives and hard weeks both get in the way. */
export function turnsUp(p = player(), extra = 0) {
  const h = healthOf(p);
  const busy = (p.career.careerId ? 0.04 : 0) + (p.education.enrolled ? 0.03 : 0) + (careHours(p) > 4 ? 0.06 : 0);
  const low = (100 - h.wellbeing.energy) / 900;
  return rng.chance(Math.max(0.55, 0.95 - busy - low + extra));
}

/** Hours a week of care the player is committed to. More than a busy week holds means more missed sessions. */
export function careHours(p = player()) {
  const h = healthOf(p);
  return h.therapies.filter((t) => t.status === 'active').reduce((s, t) => s + (THERAPY_BY_ID[t.therapyId].format === 'group' ? 2.5 : 1), 0);
}

/** Runs the appointments that fall this week. */
export function resolveAppointments(p = player()) {
  const h = healthOf(p);
  const out = [];
  const away = inHospital(p);
  for (const a of h.appointments) {
    if (a.status !== 'booked' || a.wk > now(p)) continue;
    if (away) { a.wk = away.endWk; continue; } // it waits until they are home
    const npc = store.state.npcs[a.providerId];
    if (!npc?.alive) { a.status = 'canceled'; a.note = 'The clinician was no longer available.'; continue; }
    if (!turnsUp(p, a.kind === 'assessment' ? 0.04 : 0)) {
      a.status = 'missed';
      a.outcome = 'You missed it. The clinic offered another date.';
      // A missed appointment is rebooked, not lost.
      const again = book(a.kind, { facilityId: a.facilityId, providerId: a.providerId, ref: a.ref, concern: a.concern, wait: 2 }, p);
      again.note = 'Rebooked after a missed appointment.';
      if (a.kind === 'monitoring') (h.trials.find((t) => t.id === a.ref) ?? {}).monitorMissed = ((h.trials.find((t) => t.id === a.ref)?.monitorMissed) ?? 0) + 1;
      continue;
    }
    out.push(attended(a, npc, p));
  }
  return out;
}

function attended(a, npc, p) {
  a.status = 'attended';
  a.paid = charge(`appt:${a.id}`, VISIT_COST[a.kind === 'specialist' ? 'assessment' : a.kind] ?? VISIT_COST.review, { fee: a.fee, what: `${a.kind} with ${clinicianName(npc)}` });
  npc.lastInteractionAge = p.age;
  npc.meters.relationship = Math.min(100, npc.meters.relationship + 2);
  return a;
}

/**
 * An appointment the player chose to go to happens now, in this year: Pathways
 * moves a year at a time, so asking for an assessment or a talk with a
 * prescriber resolves straight away (the wait is part of the story, not
 * something to sit through). Follow-ups and checks that come round on their own
 * still happen through the year, when it is lived (Age Up).
 */
export function attendNow(a, p = player()) {
  const npc = store.state.npcs[a.providerId];
  if (!npc?.alive || a.status !== 'booked') return null;
  a.wk = Math.max(a.booked ?? 0, now(p));
  return attended(a, npc, p);
}

// ---------- Seeking care ----------

/** The kinds of concern someone can bring, and the services that see them. */
/**
 * What a person can seek an assessment for. minAge: nobody takes a baby to a psychologist about how they have been
 * feeling; hearing, sight and physical problems are seen from birth, communication and routines from two.
 */
export const MENTAL_CARE_AGE = 5;
export const CONCERNS = {
  mental: { minAge: 5, label: 'How I have been feeling', groups: MENTAL, services: [['primary', 'gp'], ['mental', 'psychiatrist'], ['mental', 'psychologist'], ['private', 'psychologist'], ['psychiatry', 'psychiatrist']] },
  attention: { minAge: 5, label: 'Attention, focus and organization', groups: ['neurodev', 'mood', 'anxiety'], services: [['mental', 'psychiatrist'], ['psychiatry', 'psychiatrist'], ['private', 'psychologist'], ['hospital', 'pediatrician']] },
  development: { minAge: 2, label: 'Communication, senses and routines', groups: ['neurodev'], services: [['mental', 'psychologist'], ['private', 'psychologist'], ['hospital', 'pediatrician'], ['rehab', 'speech_therapist']] },
  learning: { minAge: 5, label: 'Reading, writing or numbers', groups: ['neurodev'], services: [['learning', 'educational_psychologist'], ['private', 'psychologist']] },
  senses: { minAge: 0, label: 'Hearing or sight', groups: ['sensory', 'genetic'], services: [['hospital', 'audiologist'], ['hospital', 'ophthalmologist']] },
  body: { minAge: 0, label: 'A physical health problem', groups: ['chronic', 'mobility', 'genetic'], services: [['primary', 'gp'], ['hospital', 'cardiologist'], ['hospital', 'oncologist'], ['hospital', 'neurologist'], ['hospital', 'doctor']] },
};

/** The concerns a person is old enough to seek help for. */
export const concernsFor = (p = player()) => Object.entries(CONCERNS).filter(([, c]) => p.age >= c.minAge).map(([id]) => id);

/** Where a concern can be taken now, with the wait and the price. */
export function serviceOptions(concern, p = player()) {
  if (p.age < (CONCERNS[concern]?.minAge ?? 0)) return [];
  const fs = facilitiesHere(p);
  const out = [];
  for (const [defId, profession] of CONCERNS[concern].services) {
    const f = fs.find((x) => x.defId === defId);
    if (!f || !professionExists(profession)) continue;
    // Some public specialist services take patients only on referral (the player's primary care doctor can refer).
    const referral = f.public && defId !== 'primary' && !['community', 'learning'].includes(defId) && !h_hasReferral(p, concern, profession) && p.age >= 18;
    out.push({ facilityId: f.id, facility: f.name, kind: f.kind, profession, professionName: PROFESSIONS[profession].name,
      wait: waitWeeks(f), cost: priceOf(VISIT_COST.assessment, f.fee), referral });
  }
  return out;
}
const h_hasReferral = (p, concern, profession) => (healthOf(p).referrals ?? []).some((r) => r.concern === concern && r.profession === profession && r.status === 'open');

/** Book an assessment for a concern at a service. Under-16s are taken by a parent. */
export function seekAssessment(concern, facilityId, profession, p = player()) {
  const h = healthOf(p);
  if (p.age < (CONCERNS[concern]?.minAge ?? 0)) return result(false, `Not at ${p.age}: this is from age ${CONCERNS[concern].minAge}.`, 'neutral');
  const opt = serviceOptions(concern, p).find((o) => o.facilityId === facilityId && o.profession === profession);
  if (!opt) return result(false, 'That service is not available here.', 'neutral');
  if (opt.referral) return result(false, 'This service sees people on referral. Your primary care doctor can refer you.', 'neutral');
  if (h.appointments.some((a) => a.status === 'booked' && a.kind === 'assessment' && a.concern === concern)) return result(false, 'You already have an assessment booked for this.', 'neutral');
  const f = facility(facilityId);
  const doc = clinicianAt(f, profession);
  if (!doc) return result(false, 'There is nobody there who can see you for this.', 'neutral');
  const appt = book('assessment', { facilityId, providerId: doc.id, concern }, p);
  const ref = (h.referrals ?? []).find((r) => r.concern === concern && r.profession === profession && r.status === 'open');
  if (ref) ref.status = 'used';
  for (const rec of presentConditions(h)) if (rec.dx === 'none' && CONCERNS[concern].groups.includes(CONDITION_BY_ID[rec.conditionId].group)) rec.dx = 'under_assessment';
  const wait = appt.wk - now(p);
  const who = p.age < 16 ? 'Your parents take you to see' : 'You see';
  const outcome = seeNow(appt, p);
  return result(true, `${who} ${clinicianName(doc)}, ${PROFESSIONS[profession].name.toLowerCase()} at ${f.name}${wait > 2 ? `, after a wait of ${wait} weeks` : ''}. ${outcome}`, 'good', { appt });
}

// ---------- Assessment and diagnosis ----------

/**
 * A clinician's assessment. It looks at what has actually been happening, for
 * how long, and what else could explain it, and comes to one of:
 * a diagnosis, more than one, a referral on, "come back in a few weeks", or no
 * diagnosis at all. It never diagnoses from a single bad day.
 */
export function assess(appt, p = player()) {
  const h = healthOf(p);
  const doc = store.state.npcs[appt.providerId];
  const pro = doc.flags.clinician.profession;
  const concern = CONCERNS[appt.concern] ?? CONCERNS.mental;
  const r = seeded('assess', appt.id);
  const year = store.state.year;
  const found = [];
  const refer = [];
  const wait = [];
  const considered = new Set();
  for (const rec of presentConditions(h)) {
    const def = CONDITION_BY_ID[rec.conditionId];
    if (!concern.groups.includes(def.group) || diagnosisFor(rec, h)) continue;
    if (rec.showsAge != null && p.age < rec.showsAge) continue; // not yet showing in daily life
    considered.add(def.id);
    const weeks = now(p) - Math.max(rec.onsetWk, rec.showsAge != null ? (p.birthYear + rec.showsAge) * 52 : 0);
    if (!nameIn(def, year)) { rec.dx = 'none'; note(rec, 'Assessed; the clinician described the experiences, but there was no recognized name for them at the time.'); continue; }
    if ((def.diagnose.minAge ?? 0) > p.age) { wait.push(rec); note(rec, 'Assessed; too young for this to be diagnosed with confidence. Support offered instead.'); continue; }
    if (def.diagnose.weeks && weeks < def.diagnose.weeks) { wait.push(rec); rec.dx = 'suspected'; note(rec, 'Assessed; the clinician wants to see how things go before deciding.'); continue; }
    if (rec.status === 'in_remission' && rec.burden < 15) continue;
    // Bipolar disorder seen only in a low phase looks like depression. The record can be revised later.
    let label = def.id;
    if (['bipolar_1', 'bipolar_2'].includes(def.id) && !rec.seenHigh) label = 'mdd';
    if (!mayDiagnose(pro, label, year)) { refer.push(rec); rec.dx = 'suspected'; continue; }
    const skill = 0.82 + (doc.flags.clinician.years - 10) / 200;
    if (!r.chance(skill)) { rec.dx = 'suspected'; wait.push(rec); note(rec, 'Assessed; not clear yet.'); continue; }
    found.push({ rec, label });
  }
  const results = [];
  for (const { rec, label } of found) {
    const def = CONDITION_BY_ID[label];
    stage(rec);
    const dx = { id: `dx_${appt.id}_${rec.conditionId}`, conditionId: label, underlyingId: rec.id, status: 'active', wk: now(p), providerId: doc.id,
      name: dxName(def, rec, year), certainty: label !== rec.conditionId ? 'probable' : 'confirmed', reviewWk: now(p) + 26,
      history: [{ wk: now(p), text: `Diagnosed by ${clinicianName(doc)} after an assessment.` }] };
    h.diagnoses.push(dx);
    rec.dx = 'diagnosed';
    note(rec, `Diagnosed as ${dx.name}.`);
    results.push(dx);
  }
  // Experiences with no condition behind them: sleep, stress, a hard stretch.
  const ordinary = [];
  if (h.wellbeing.sleep < 45) ordinary.push('not enough sleep');
  if (h.wellbeing.stress > 70) ordinary.push('a great deal of stress');
  let text;
  if (results.length) {
    text = `${clinicianName(doc)} listened, asked a lot of questions, and went through your history. Their conclusion: ${results.map((d) => d.name).join(' and ')}.`
      + (results.some((d) => d.certainty === 'probable') ? ' They will review it as time goes on.' : '')
      + (CONDITION_BY_ID[results[0].conditionId].neurotype ? ' It is a description of how your mind works, not something wrong with you.' : '');
    for (const d of results) healthMilestone(`Received a diagnosis: ${d.name}.`, { type: 'diagnosis', id: d.id }, p);
  } else if (refer.length) {
    const want = refer.map((x) => CONDITION_BY_ID[x.conditionId].diagnose.by.find((b) => b !== pro && professionExists(b) && b !== 'gp'))[0];
    const to = want ?? (refer.some((x) => ['bpd', 'bipolar_1', 'bipolar_2', 'schizophrenia', 'adhd', 'autism'].includes(x.conditionId)) ? 'psychiatrist' : 'psychologist');
    (h.referrals ??= []).push({ concern: appt.concern, profession: to, wk: now(p), by: doc.id, status: 'open' });
    text = `${clinicianName(doc)} thinks this needs a specialist and has referred you to a ${PROFESSIONS[to].name.toLowerCase()}. You can book that now.`;
  } else if (wait.length) {
    text = `${clinicianName(doc)} took you seriously, and wants to see you again before reaching any conclusion. A review is booked.`;
    book('assessment', { facilityId: appt.facilityId, providerId: doc.id, concern: appt.concern, wait: 8 }, p);
  } else {
    text = `${clinicianName(doc)} went through everything carefully and did not find a condition to diagnose.${ordinary.length ? ` They think ${ordinary.join(' and ')} explains a lot of it, and talked through what might help.` : ' They said to come back if things change.'}`;
  }
  h.assessments.push({ id: `as_${appt.id}`, wk: now(p), providerId: doc.id, facilityId: appt.facilityId, concern: appt.concern,
    considered: [...considered], outcome: results.length ? 'diagnosed' : refer.length ? 'referred' : wait.length ? 'review' : 'no_diagnosis',
    diagnosisIds: results.map((d) => d.id), text });
  appt.outcome = text;
  log(text, 'system', results.length ? 'neutral' : 'neutral');
  return { text, diagnoses: results };
}

/**
 * A second opinion, or a review in the light of new evidence: a diagnosis can
 * be revised, and the old one is kept, marked as revised.
 */
export function reviseDiagnosis(dx, toConditionId, by, why, p = player()) {
  const h = healthOf(p);
  dx.status = 'revised';
  dx.history.push({ wk: now(p), text: `Revised: ${why}` });
  const def = CONDITION_BY_ID[toConditionId];
  const next = { id: `dx_r_${dx.id}_${toConditionId}`, conditionId: toConditionId, underlyingId: dx.underlyingId, status: 'active', wk: now(p), providerId: by?.id ?? null,
    name: nameIn(def, store.state.year), certainty: 'confirmed', revises: dx.id, reviewWk: now(p) + 26,
    history: [{ wk: now(p), text: `Diagnosis revised from ${dx.name}. ${why}` }] };
  h.diagnoses.push(next);
  dx.revisedTo = next.id;
  // The care plan follows the diagnosis: parts written for the old one are flagged for review.
  for (const plan of h.plans) for (const c of plan.components) if (c.diagnosisId === dx.id) { c.diagnosisId = next.id; c.conditionId = toConditionId; c.history.push({ wk: now(p), text: 'Diagnosis revised; reviewed.' }); }
  return next;
}

/** Ask for a second opinion: another qualified clinician assesses again. Nothing is lost either way. */
export function secondOpinion(dxId, p = player()) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => d.id === dxId && d.status === 'active');
  if (!dx) return result(false, 'There is no such diagnosis.', 'neutral');
  const first = store.state.npcs[dx.providerId];
  const pro = ['mood', 'anxiety', 'personality', 'psychotic', 'trauma', 'ocd', 'eating'].includes(CONDITION_BY_ID[dx.conditionId].group) ? 'psychiatrist' : first?.flags.clinician.profession ?? 'psychiatrist';
  const f = facilitiesHere(p).find((x) => facilityDef(x).staff.includes(pro) && x.id !== first?.flags.clinician.facilityId) ?? facilitiesHere(p).find((x) => facilityDef(x).staff.includes(pro));
  if (!f) return result(false, 'There is nobody else nearby who can give one.', 'neutral');
  const doc = clinicianAt(f, pro, { exclude: first ? [first.id] : [], another: true });
  const appt = book('review', { facilityId: f.id, providerId: doc.id, ref: `second:${dx.id}`, wait: waitWeeks(f) }, p);
  const said = seeNow(appt, p);
  return result(true, `You see ${clinicianName(doc)} at ${f.name} for a second opinion. Asking is ordinary; good clinicians expect it. ${said}`, 'good');
}

/** Resolves a second-opinion visit: agree, or revise, by what is actually there. */
export function resolveSecondOpinion(appt, p = player()) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => `second:${d.id}` === appt.ref);
  const doc = store.state.npcs[appt.providerId];
  if (!dx || dx.status !== 'active') return 'Nothing to review.';
  const rec = h.conditions.find((c) => c.id === dx.underlyingId);
  if (rec && rec.conditionId !== dx.conditionId && (rec.seenHigh || !['bipolar_1', 'bipolar_2'].includes(rec.conditionId)) && mayDiagnose(doc.flags.clinician.profession, rec.conditionId)) {
    const next = reviseDiagnosis(dx, rec.conditionId, doc, `${clinicianName(doc)} found that ${CONDITION_BY_ID[rec.conditionId].short} fits better.`, p);
    return `${clinicianName(doc)} sees it differently: ${next.name}. Your earlier diagnosis stays in your record, marked as revised.`;
  }
  dx.history.push({ wk: now(p), text: `Second opinion from ${clinicianName(doc)}: agreed.` });
  return `${clinicianName(doc)} agrees with the diagnosis, and says why. It helps to hear it twice.`;
}

/** A cancer's stage is fixed when it is found: the longer it went unnoticed, the further on. */
function stage(rec) {
  if (rec.conditionId !== 'cancer' || rec.stage) return;
  rec.stage = Math.max(1, Math.min(4, 1 + Math.floor((now() - rec.onsetWk) / 45)));
}
const dxName = (def, rec, year) => `${nameIn(def, year)}${rec.stage ? ` (stage ${rec.stage})` : ''}`;

/**
 * A condition found by a clinician outside a booked assessment: in hospital
 * after an emergency, by a primary care doctor after a scene, or at a check-up. Recorded with the
 * clinician who found it.
 */
export function foundByDoctor(rec, defId, profession, p = player(), how = 'found') {
  const h = healthOf(p);
  if (diagnosisFor(rec, h)) return null;
  const f = facilitiesHere(p).find((x) => x.defId === defId) ?? facilitiesHere(p).find((x) => x.defId === 'hospital');
  const doc = f && (clinicianAt(f, profession) ?? clinicianAt(f, 'doctor') ?? clinicianAt(f, 'gp'));
  const def = CONDITION_BY_ID[rec.conditionId];
  if (!doc || !nameIn(def, store.state.year)) return null;
  stage(rec);
  const dx = { id: `dx_f_${rec.id}`, conditionId: rec.conditionId, underlyingId: rec.id, status: 'active', wk: now(p), providerId: doc.id,
    name: dxName(def, rec, store.state.year), certainty: 'confirmed', reviewWk: now(p) + 26, history: [{ wk: now(p), text: `${how === 'screen' ? 'Found at a check-up' : 'Found'} by ${clinicianName(doc)}.` }] };
  h.diagnoses.push(dx);
  rec.dx = 'diagnosed';
  note(rec, `Diagnosed as ${dx.name}.`);
  joinCareTeam(doc, p);
  return dx;
}

/**
 * Screening at a check-up: high blood pressure and diabetes show up on routine
 * tests; from fifty, some cancers are found early by screening programs.
 * Things a check-up finds that need a specialist become a referral.
 * @returns {string[]} what was found, in plain words
 */
export function screen(p = player()) {
  const h = healthOf(p);
  const found = [];
  for (const rec of presentConditions(h)) {
    const def = CONDITION_BY_ID[rec.conditionId];
    const s = def.diagnose.screen;
    if (!s || diagnosisFor(rec, h) || (typeof s === 'number' && p.age < s) || store.state.year < 1960) continue;
    if (rec.conditionId === 'cancer') {
      if (!seeded('screen', p.id, rec.id, store.state.year).chance(0.45)) continue;
      (h.referrals ??= []).push({ concern: 'body', profession: 'oncologist', wk: now(p), status: 'open' });
      found.push('something on a screening test that a specialist should look at');
      continue;
    }
    const dx = foundByDoctor(rec, 'primary', 'gp', p, 'screen');
    if (dx) found.push(dx.name.toLowerCase());
  }
  return found;
}

// ---------- The care plan ----------

/** The person's care plan: one coordinated plan across all their diagnoses. */
export function carePlan(p = player()) {
  const h = healthOf(p);
  let plan = h.plans.find((x) => x.status !== 'completed');
  if (!plan) {
    plan = { id: `plan_${p.id.slice(-6)}_${h.plans.length}`, status: 'new', createdWk: now(p), reviewWk: now(p) + 26, goals: [], components: [], history: [{ wk: now(p), text: 'Care plan started.' }] };
    h.plans.push(plan);
  }
  return plan;
}

/** Adds a part to the care plan (a therapy, a medicine, monitoring, an accommodation). */
export function addComponent(kind, refId, label, conditionId, diagnosisId, p = player()) {
  const plan = carePlan(p);
  const c = { id: `pc_${refId}`, kind, refId, label, conditionId, diagnosisId, status: 'active', since: now(p), history: [{ wk: now(p), text: 'Added to the plan.' }] };
  plan.components.push(c);
  plan.status = 'active';
  plan.history.push({ wk: now(p), text: `Added: ${label}.` });
  return c;
}
export function setComponent(refId, status, text, p = player()) {
  for (const plan of healthOf(p).plans) for (const c of plan.components) if (c.refId === refId && c.status !== status) {
    c.status = status; c.history.push({ wk: now(p), text }); plan.history.push({ wk: now(p), text: `${c.label}: ${text}` });
    if (plan.status === 'active') plan.status = 'modified';
  }
}

/** Goals a person can choose for their plan, measured from what actually happens. */
export const GOALS = {
  sleep: { text: 'Sleep better', met: (h) => h.wellbeing.sleep >= 65 },
  steady: { text: 'Feel steadier day to day', met: (h, p) => maxBurden(h, MENTAL) < 30 },
  relationships: { text: 'Calmer, closer relationships', met: (h) => h.skills.interpersonal >= 50 },
  return: { text: 'Get back to the things I care about', met: (h, p) => dailyFunctioning(p) >= 72 },
  work: { text: 'Manage work or study well', met: (h, p) => (p.career.careerId || p.education.enrolled) && dailyFunctioning(p) >= 70 },
  skills: { text: 'Learn skills for hard moments', met: (h) => h.skills.distress >= 45 && h.skills.regulation >= 45 },
  routine: { text: 'Build routines that work for me', met: (h) => h.skills.organization >= 45 },
  independence: { text: 'Do more things my own way', met: (h) => h.skills.independence >= 45 },
};
const maxBurden = (h, groups) => Math.max(0, ...presentConditions(h).filter((c) => groups.includes(CONDITION_BY_ID[c.conditionId].group)).map((c) => c.burden));

export function setGoals(ids, p = player()) {
  const plan = carePlan(p);
  for (const id of ids) if (GOALS[id] && !plan.goals.some((g) => g.id === id)) plan.goals.push({ id, text: GOALS[id].text, status: 'working', since: now(p) });
  plan.history.push({ wk: now(p), text: 'Goals agreed.' });
}

/** Goals are met by what happens in the life, not by attendance. */
export function checkGoals(p = player()) {
  const h = healthOf(p);
  for (const plan of h.plans) for (const g of plan.goals) {
    if (g.status !== 'working') continue;
    if (GOALS[g.id].met(h, p)) {
      g.status = 'met'; g.metWk = now(p);
      plan.history.push({ wk: now(p), text: `Goal met: ${g.text}.` });
      healthMilestone(`Reached a personal care goal: ${g.text.toLowerCase()}.`, { type: 'goal', id: g.id }, p);
    }
  }
}

/** What a newly diagnosed person can be offered, for the care-options screen. */
export function careOptions(dxId, p = player()) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => d.id === dxId);
  if (!dx) return { therapies: [], meds: false };
  const def = CONDITION_BY_ID[dx.conditionId];
  const fs = facilitiesHere(p);
  const therapies = [];
  for (const tid of def.care.therapies ?? []) {
    const t = THERAPY_BY_ID[tid];
    if (!t) continue;
    for (const f of fs) {
      const prof = t.by.find((b) => facilityDef(f).staff.includes(b));
      if (t.kind !== 'peer' && !prof) continue;
      if (t.dbt && !facilityDef(f).dbt && !(f.defId === 'private')) continue;
      if (t.kind === 'peer' && f.defId !== 'community') continue;
      const probe = t.kind === 'peer' ? null : { flags: { clinician: { profession: prof, dbt: !!t.dbt } } };
      const ok = canOffer(tid, dx.conditionId, probe, p);
      therapies.push({ therapyId: tid, name: t.name, facilityId: f.id, facility: f.name, profession: prof, ok: ok.ok, why: ok.why,
        cost: priceOf(t.cost, f.fee), format: t.format, kind: t.kind, blurb: t.blurb });
      break;
    }
  }
  const prescriber = activeDiagnoses(h).length ? prescriberFor(dx.conditionId, p) : null;
  const meds = def.care.meds && prescriber ? optionsFor(dx.conditionId, prescriber, p).length > 0 : false;
  return { therapies, meds, medsWhy: def.care.meds ? (meds ? '' : 'No medicine can be offered for this here and now.') : dx.conditionId === 'bpd' ? 'No medicine treats BPD itself; therapy is the treatment.' : 'Medicine is not part of the usual care for this.' };
}

/** A clinician who can prescribe for this condition: someone already caring for the player if possible. */
export function prescriberFor(conditionId, p = player()) {
  const h = healthOf(p);
  // Professions that can prescribe something used for this condition; a child's ADHD is a specialist's.
  const usable = Object.values(MED_BY_ID).filter((m) => m.uses[conditionId]);
  let need = [...new Set(usable.flatMap((m) => m.by.filter((b) => (PROFESSIONS[b]?.prescribes ?? []).includes(m.family))))];
  if (conditionId === 'adhd' && p.age < 18) need = need.filter((b) => b !== 'gp');
  const team = h.careTeam.map((id) => store.state.npcs[id]).filter((n) => n?.alive && !n.flags.clinician?.retired && need.includes(n.flags.clinician?.profession));
  if (team.length) return team[0];
  for (const pro of need) for (const f of facilitiesHere(p)) { const d = clinicianAt(f, pro); if (d) return d; }
  return null;
}
