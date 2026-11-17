// Medication trials. Each one is a course of a medicine for one diagnosis,
// prescribed by an eligible clinician, that is evaluated over weeks, reviewed
// at follow-ups, and continued, adjusted, switched or stopped by a decision the
// clinician proposes and the player accepts. No trial is ever deleted.
//
// How a medicine works for a person is decided when the trial starts, from the
// person, the medicine and the condition (seeded, so a reload never re-rolls it),
// and then unfolds week by week: nothing is known at the first dose.
import { store, player, country, log } from '../../state.js';
import { clamp } from '../../util.js';
import { MED_BY_ID, medName } from '../../data/health/medications.js';
import { CONDITION_BY_ID } from '../../data/health/conditions.js';
import { VISIT_COST } from '../../data/health/providers.js';
import { healthOf } from './record.js';
import { canPrescribe, optionsFor } from './rules.js';
import { book, clinicianName, prescriberFor, addComponent, setComponent, facility, joinCareTeam, reviseDiagnosis as reviseDx } from './care.js';
import { now, seeded, charge, rel, hashOf } from './util.js';
import { healthMilestone } from './story.js';
import { findProviders, startTherapy } from './therapy.js';
import { setRehabGoals } from './hospital.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const LIVE = ['active', 'adjusted', 'under_review', 'tapering'];
export const isLive = (t) => LIVE.includes(t.status);
const TIER = { common: 0.3, 'less common': 0.1 };

export const RESPONSE_WORDS = {
  not_yet_evaluated: 'Not yet evaluated', early: 'Early days', improving: 'Starting to help', partial: 'Partial response',
  adequate: 'Helping well', insufficient: 'Not helping enough', poorly_tolerated: 'Side effects are a problem',
  under_review: 'Under review', adjusted: 'Adjusted', switched: 'Switched', discontinued: 'Stopped',
};

/** How a medicine will go for this person, decided once, at the start. */
function fitFor(p, med, rec) {
  const r = seeded('trial', p.id, med.id, rec?.conditionId ?? 'none');
  const u = r.next();
  const resp = med.response;
  const ceiling = u < resp.good ? r.range(0.55, 0.8) : u < resp.good + resp.partial ? r.range(0.25, 0.45) : r.range(0, 0.12);
  const lag = r.int(med.onset[0], med.onset[1]);
  const fade = r.chance(0.08) ? { at: r.int(30, 70), keep: 0.6 } : null;
  const effects = [];
  for (const e of med.effects) {
    if (e.adult && p.age < 18) continue;
    if (!r.chance(TIER[e.tier] ?? 0.1)) continue;
    const sev = r.chance(0.6) ? 1 : r.chance(0.7) ? 2 : 3;
    effects.push({ id: e.id, label: e.label, cat: e.cat, sev, until: e.fades ? r.int(2, 6) : null, urgent: !!e.urgent });
  }
  return { ceiling, lag, fade, effects, kind: u < resp.good ? 'good' : u < resp.good + resp.partial ? 'partial' : 'little' };
}

/** Weeks the trial has been running. A trial gives nothing before its start. */
export const weeksOn = (t, at = now()) => Math.max(0, Math.min(t.endWk ?? at, at) - t.startWk);

/** How much the medicine is helping at a given number of weeks (0–1), before attribution. */
export function benefitAt(t, weeks = weeksOn(t)) {
  const med = MED_BY_ID[t.medicationId];
  if (weeks <= t.fit.lag) return 0;
  const x = clamp((weeks - t.fit.lag) / Math.max(1, med.adequate), 0, 1);
  let b = t.fit.ceiling * x * x * (3 - 2 * x) + (t.boost ?? 0) * x;
  if (t.fit.fade && weeks >= t.fit.fade.at) b *= t.fit.fade.keep;
  if (t.status === 'tapering') b *= Math.max(0, 1 - (now() - t.taperFrom) / Math.max(1, t.taperEnd - t.taperFrom));
  return clamp(b * (t.adherence ?? 0.92), 0, 0.9);
}

/**
 * The share of a condition's burden this trial is lifting this week. A
 * medicine helps the condition it was prescribed for, and less so another
 * condition it is also used for. An antidepressant given for what was thought
 * to be depression does little for bipolar disorder, and can unsettle it.
 */
export function trialBenefit(t, rec, p = player()) {
  if (!isLive(t)) return 0;
  const med = MED_BY_ID[t.medicationId];
  const b = benefitAt(t);
  if (t.underlyingId === rec.id) {
    if (med.uses[rec.conditionId]) return b;
    if (['bipolar_1', 'bipolar_2'].includes(rec.conditionId) && med.family === 'antidepressant') return b * 0.35;
    return b * 0.3;
  }
  return med.uses[rec.conditionId] ? b * 0.5 : 0;
}

/** Side effects being felt now. */
export function effectsNow(t, weeks = weeksOn(t)) {
  if (!isLive(t)) return [];
  return t.fit.effects.filter((e) => (e.until == null || weeks < e.until) && e.sev - (t.eased?.[e.id] ?? 0) > 0)
    .map((e) => ({ ...e, sev: e.sev - (t.eased?.[e.id] ?? 0) }));
}
export const sideBurden = (t) => effectsNow(t).reduce((s, e) => s + e.sev, 0);

/** How the treatment is going, in the clinic's terms, judged only on what has been observed. */
export function classify(t) {
  const med = MED_BY_ID[t.medicationId];
  const w = weeksOn(t);
  const b = benefitAt(t, w);
  const side = sideBurden(t);
  if (effectsNow(t).some((e) => e.urgent) || side >= 4) return 'poorly_tolerated';
  if (w < Math.max(2, Math.round(med.adequate / 2))) return w <= t.fit.lag ? 'early' : b > 0.1 ? 'improving' : 'early';
  if (w < med.adequate) return b > 0.15 ? 'improving' : 'early';
  if (b >= 0.45) return side >= 3 ? 'poorly_tolerated' : 'adequate';
  if (b >= 0.18) return 'partial';
  return 'insufficient';
}

// ---------- Starting ----------

/**
 * Starts a trial. Only through a clinician's proposal the player has accepted;
 * the rule registry is checked again here, so nothing can skip it.
 */
export function startTrial({ medId, dxId, prescriberId, replacing, reason }, p = player()) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => d.id === dxId && d.status === 'active');
  const doc = store.state.npcs[prescriberId];
  if (!dx) return result(false, 'There is no current diagnosis for this.', 'neutral');
  const ok = canPrescribe({ medId, conditionId: dx.conditionId, prescriber: doc, replacing }, p);
  if (!ok.ok) return result(false, ok.why, 'neutral');
  const med = MED_BY_ID[medId];
  const rec = h.conditions.find((c) => c.id === dx.underlyingId);
  const id = `trial_${hashOf(p.id, medId, now(p), h.trials.length).toString(36)}`;
  if (h.trials.some((t) => t.id === id)) return result(false, 'Already started.', 'neutral');
  const t = {
    id, medicationId: medId, conditionId: dx.conditionId, diagnosisId: dx.id, underlyingId: dx.underlyingId, prescriberId: doc.id,
    startWk: now(p), status: 'active', responseState: 'not_yet_evaluated', fit: fitFor(p, med, rec), adherence: 0.92,
    reviews: [], reported: null, nextReviewWk: now(p) + (p.age < 25 && med.family === 'antidepressant' ? 2 : med.family === 'mood_stabiliser' ? 4 : 4),
    nextMonitorWk: med.monitoring ? now(p) + 1 : null, lastMonitorWk: null, monitorMissed: 0,
    replaces: replacing ?? null, replacedBy: null, endWk: null, changeReason: null, startReason: reason ?? 'Agreed with the prescriber.',
    history: [{ wk: now(p), text: `Started, prescribed by ${clinicianName(doc)}.` }],
  };
  h.trials.push(t);
  joinCareTeam(doc, p);
  addComponent('medication', t.id, medName(med, country().id), dx.conditionId, dx.id, p);
  if (med.monitoring) addComponent('monitoring', `mon_${t.id}`, `Monitoring: ${med.monitoring.what}`, dx.conditionId, dx.id, p);
  const first = t.nextReviewWk;
  bookReview(t, first, p);
  if (med.monitoring) book('monitoring', { facilityId: doc.flags.clinician.facilityId, providerId: doc.id, ref: t.id, wk: t.nextMonitorWk }, p);
  const text = `You start ${med.name.toLowerCase()}. ${clinicianName(doc)} explains that it usually takes ${med.onset[1] >= 4 ? 'several weeks' : 'a little while'} to know whether it helps, and that side effects, if any, often ease. A follow-up is booked ${rel(first)}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'good', { trial: t });
}

function bookReview(t, wk, p = player(), ref = t.id) {
  const doc = store.state.npcs[t.prescriberId];
  return book('review', { facilityId: doc.flags.clinician.facilityId, providerId: doc.id, ref, wk }, p);
}

// ---------- The weekly tick ----------

export function medWeek(p = player()) {
  const h = healthOf(p);
  const w = now(p);
  for (const t of h.trials) {
    if (!isLive(t)) continue;
    const weeks = weeksOn(t, w);
    // A prescription is paid for each four weeks it runs, once: never after it has ended.
    if (w > t.startWk || weeks === 0) charge(`rx:${t.id}:${Math.floor(weeks / 4)}`, VISIT_COST.prescription * 4, { what: `${MED_BY_ID[t.medicationId].name} prescription` });
    // Side effects touch sleep, energy and stress while they last.
    for (const e of effectsNow(t, weeks)) {
      if (e.cat === 'sleep') h.wellbeing.sleep = clamp(h.wellbeing.sleep - e.sev * 2);
      if (e.cat === 'fatigue') h.wellbeing.energy = clamp(h.wellbeing.energy - e.sev * 2);
      if (e.cat === 'gastro' || e.cat === 'restlessness') h.wellbeing.stress = clamp(h.wellbeing.stress + e.sev);
    }
    if (t.status !== 'under_review') {
      const s = classify(t);
      t.responseState = ['early', 'improving'].includes(s) || weeks < MED_BY_ID[t.medicationId].adequate ? (weeks ? s : 'not_yet_evaluated') : t.responseState === 'adjusted' && s !== 'poorly_tolerated' ? 'adjusted' : t.responseState;
    }
    if (t.status === 'tapering' && w >= t.taperEnd) {
      t.status = t.replacedBy ? 'switched' : 'discontinued';
      t.responseState = t.status;
      t.endWk = w;
      t.history.push({ wk: w, text: t.replacedBy ? 'Switch completed.' : 'Stopped, after a gradual reduction.' });
      setComponent(t.id, t.status === 'switched' ? 'completed' : 'discontinued', t.status === 'switched' ? 'Switched to another medicine.' : 'Stopped.', p);
      setComponent(`mon_${t.id}`, 'completed', 'No longer needed.', p);
      continue;
    }
    // Follow-ups and monitoring come round on their own; they are still appointments to attend.
    if (t.nextReviewWk != null && w >= t.nextReviewWk - 1 && !h.appointments.some((a) => a.ref === t.id && a.kind === 'review' && a.status === 'booked')) bookReview(t, Math.max(w, t.nextReviewWk), p);
    const med = MED_BY_ID[t.medicationId];
    if (med.monitoring && t.nextMonitorWk != null && w >= t.nextMonitorWk - 1 && !h.appointments.some((a) => a.ref === t.id && a.kind === 'monitoring' && a.status === 'booked')) {
      const doc = store.state.npcs[t.prescriberId];
      book('monitoring', { facilityId: doc.flags.clinician.facilityId, providerId: doc.id, ref: t.id, wk: Math.max(w, t.nextMonitorWk) }, p);
    }
  }
  // Coming off a medicine, even slowly, can bring a few unsettled weeks.
  for (const t of h.trials) if (t.offUntil && w <= t.offUntil) { h.wellbeing.sleep = clamp(h.wellbeing.sleep - 2); h.wellbeing.stress = clamp(h.wellbeing.stress + 2); }
}

/** Overdue checks put the prescription under review until they are done. */
export function monitoringOverdue(t, w = now()) {
  const med = MED_BY_ID[t.medicationId];
  if (!med.monitoring || !isLive(t)) return false;
  const last = t.lastMonitorWk ?? t.startWk;
  return w - last > med.monitoring.every + 6 || t.monitorMissed >= 2;
}

export function attendMonitoring(appt, p = player()) {
  const h = healthOf(p);
  const t = h.trials.find((x) => x.id === appt.ref);
  if (!t) return '';
  const med = MED_BY_ID[t.medicationId];
  t.lastMonitorWk = now(p);
  t.monitorMissed = 0;
  t.nextMonitorWk = now(p) + med.monitoring.every;
  if (t.status === 'under_review' && t.heldFor === 'monitoring') { t.status = 'active'; t.heldFor = null; }
  t.history.push({ wk: now(p), text: `Checked: ${med.monitoring.what}. All within range.` });
  return `Your ${med.monitoring.what} were checked. Everything is where it should be.`;
}

// ---------- Follow-ups ----------

/**
 * A follow-up with the prescriber. They look at how long it has been, what has
 * helped, what side effects there are, the other conditions, and what the
 * player wants, then propose what to do. The player decides.
 */
export function review(appt, p = player()) {
  const h = healthOf(p);
  const t = h.trials.find((x) => x.id === appt.ref);
  if (!t || !isLive(t)) return 'Nothing to review.';
  const doc = store.state.npcs[appt.providerId];
  const med = MED_BY_ID[t.medicationId];
  const w = weeksOn(t);
  const state = monitoringOverdue(t) ? 'under_review' : classify(t);
  const effects = effectsNow(t);
  const b = benefitAt(t);
  const felt = b >= 0.45 ? 'a real difference' : b >= 0.18 ? 'some difference' : b > 0.05 ? 'a little difference' : 'no difference yet';
  t.reported = { wk: now(p), benefit: felt, effects: effects.map((e) => e.label) };
  const rev = { wk: now(p), by: doc.id, weeks: w, state, benefit: felt, effects: effects.map((e) => e.label), decision: null };
  t.reviews.push(rev);
  t.responseState = state;
  const opts = [];
  const add = (id, label, sub, act) => opts.push({ id, label, sub, act });
  let rec = 'continue';
  let say;

  // A first high episode in someone being treated for depression changes the picture.
  const dx = h.diagnoses.find((d) => d.id === t.diagnosisId);
  const underlying = h.conditions.find((c) => c.id === t.underlyingId);
  if (dx?.flagged === 'high' && underlying?.seenHigh && ['bipolar_1', 'bipolar_2'].includes(underlying.conditionId) && doc.flags.clinician.profession === 'psychiatrist') {
    say = `${clinicianName(doc)} listens to what the last few weeks were like and says it changes things: this looks like ${CONDITION_BY_ID[underlying.conditionId].short}, not depression alone. An antidepressant on its own is not the right treatment for that.`;
    add('rethink', 'Agree to a new plan', 'The diagnosis is revised. A mood stabiliser is started and the antidepressant is reduced gradually.', { kind: 'bipolar_revision' });
    add('time', 'Ask for time to think', 'Nothing changes yet. Another appointment is booked.', { kind: 'later' });
    rec = 'rethink';
  } else if (state === 'under_review' && monitoringOverdue(t)) {
    t.status = 'under_review'; t.heldFor = 'monitoring';
    say = `${clinicianName(doc)} cannot keep prescribing ${med.name.toLowerCase()} safely without the regular ${med.monitoring.what} checks. One is booked for this week.`;
    book('monitoring', { facilityId: appt.facilityId, providerId: doc.id, ref: t.id, wk: now(p) + 1 }, p);
    add('ok', 'Book the check', 'The prescription continues once it is done.', { kind: 'continue' });
    rec = 'ok';
  } else if (state === 'early' || state === 'improving') {
    say = `It has been ${w} week${w === 1 ? '' : 's'}. ${clinicianName(doc)} says it is ${state === 'improving' ? 'starting to help, and' : 'too early to judge, and'} worth giving it more time${effects.length ? `; ${effects.map((e) => e.label.toLowerCase()).join(' and ')} often ease${effects.length === 1 ? 's' : ''} in the first weeks` : ''}.`;
    add('continue', 'Keep going', 'Another review in a few weeks.', { kind: 'continue' });
    if (effects.some((e) => e.sev >= 3 || e.urgent)) { add('switch', 'Ask about changing', 'The side effects are too much.', { kind: 'switch' }); rec = 'switch'; }
  } else if (state === 'adequate') {
    say = `${clinicianName(doc)} is pleased: ${med.name.toLowerCase()} is helping${effects.length ? `, and the ${effects[0].label.toLowerCase()} is manageable` : ''}. The plan is to carry on and review less often.`;
    add('continue', 'Carry on', 'Reviews every few months.', { kind: 'continue' });
    add('stop', 'Talk about stopping, some time', 'A gradual, supervised reduction when the time is right.', { kind: 'stop' });
  } else if (state === 'partial') {
    say = `After ${w} weeks there is ${felt}, but not as much as hoped${effects.length ? `, and ${effects.map((e) => e.label.toLowerCase()).join(' and ')}` : ''}. ${clinicianName(doc)} goes through the options with you.`;
    if (!t.adjusted) add('adjust', 'Adjust the current treatment', 'The prescriber adjusts it and reviews again. It may help more.', { kind: 'adjust' });
    add('switch', 'Try a different medicine', 'A supervised switch: the old one is reduced as the new one starts.', { kind: 'switch' });
    if (!h.therapies.some((c) => c.status === 'active' && c.conditionIds.includes(t.underlyingId))) add('therapy', 'Add talking therapy', 'Combined treatment often does more than either alone.', { kind: 'therapy' });
    add('continue', 'Give it longer', 'Nothing changes for now.', { kind: 'continue' });
    rec = t.adjusted ? 'switch' : 'adjust';
  } else if (state === 'insufficient') {
    say = `${w} weeks in, and there is ${felt}. That happens, and it is nobody\'s fault: this one has had a fair trial and is not the right fit. ${clinicianName(doc)} suggests a change.`;
    add('switch', 'Try a different medicine', 'A supervised switch.', { kind: 'switch' });
    if (!h.therapies.some((c) => c.status === 'active' && c.conditionIds.includes(t.underlyingId))) add('therapy', 'Focus on therapy instead', 'The medicine is reduced gradually; therapy is arranged.', { kind: 'therapy_stop' });
    add('stop', 'Stop it altogether', 'A gradual, supervised reduction.', { kind: 'stop' });
    rec = 'switch';
  } else {
    say = `${clinicianName(doc)} takes the side effects seriously: ${effects.map((e) => e.label.toLowerCase()).join(', ') || 'they have been hard going'}. Nobody should have to put up with that to feel better.`;
    if (!t.adjusted && !effects.some((e) => e.urgent)) add('ease', 'Adjust to ease the side effects', 'It may help a little less, and be easier to live with.', { kind: 'ease' });
    add('switch', 'Try a different medicine', 'A supervised switch.', { kind: 'switch' });
    add('stop', 'Stop it', 'A gradual, supervised reduction.', { kind: 'stop' });
    rec = effects.some((e) => e.urgent) ? 'switch' : t.adjusted ? 'switch' : 'ease';
  }
  // Follow-ups after this one.
  const gap = state === 'adequate' ? (t.reviews.filter((x) => x.state === 'adequate').length > 1 ? 26 : 12) : 4;
  t.nextReviewWk = now(p) + gap;
  const prop = { id: `prop_${t.id}_${t.reviews.length}`, kind: 'review', trialId: t.id, providerId: doc.id, wk: now(p), summary: say,
    options: opts, recommended: rec, status: 'open' };
  h.proposals = h.proposals.filter((x) => !(x.trialId === t.id && x.status === 'open'));
  if (opts.length === 1 && opts[0].act.kind === 'continue') { prop.status = 'accepted'; prop.chosen = 'continue'; rev.decision = 'continue'; }
  h.proposals.push(prop);
  if (h.settings.follow && prop.status === 'open') decide(prop.id, rec, p);
  return say;
}

/**
 * Asking the prescriber about medicine for a diagnosis: they consider it, and
 * propose options (or explain why not). Nothing starts without a yes.
 */
export function discussMedication(dxId, p = player()) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => d.id === dxId && d.status === 'active');
  if (!dx) return result(false, 'There is no current diagnosis for this.', 'neutral');
  const def = CONDITION_BY_ID[dx.conditionId];
  if (!def.care.meds) return result(false, dx.conditionId === 'bpd' ? 'No medicine treats BPD itself. Therapy is the treatment; if another condition comes with it, that can be treated in its own right.' : 'Medicine is not part of the usual care for this.', 'neutral');
  const doc = prescriberFor(dx.conditionId, p);
  if (!doc) return result(false, 'There is nobody nearby who can prescribe for this.', 'neutral');
  if (h.appointments.some((a) => a.ref === `start:${dx.id}` && a.status === 'booked')) return result(false, 'You already have that appointment.', 'neutral');
  const f = facility(doc.flags.clinician.facilityId);
  const appt = book('review', { facilityId: f.id, providerId: doc.id, ref: `start:${dx.id}`, wait: Math.min(3, f.public ? 3 : 1) }, p);
  return result(true, `You are seeing ${clinicianName(doc)} ${rel(appt.wk)} to talk about whether medicine might help.`, 'good');
}

/** The appointment where starting a medicine is discussed. */
export function considerStart(appt, p = player()) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => `start:${d.id}` === appt.ref && d.status === 'active');
  const doc = store.state.npcs[appt.providerId];
  if (!dx) return 'Nothing to discuss.';
  const choices = optionsFor(dx.conditionId, doc, p);
  if (!choices.length) {
    const why = canPrescribe({ medId: Object.keys(MED_BY_ID).find((m) => MED_BY_ID[m].uses[dx.conditionId]) ?? 'x', conditionId: dx.conditionId, prescriber: doc }, p).why;
    return `${clinicianName(doc)} explains that medicine is not something they can offer for this at the moment. ${why}`;
  }
  const tried = new Set(h.trials.filter((t) => t.diagnosisId === dx.id).map((t) => t.medicationId));
  const fresh = choices.filter((m) => !tried.has(m.id));
  const list = (fresh.length ? fresh : choices).slice(0, 3);
  const say = `${clinicianName(doc)} talks through what medicine could and could not do for ${CONDITION_BY_ID[dx.conditionId].short}, the common side effects, and how long it takes to tell. ${list[0].name} is what they would usually suggest first. It is your choice.`;
  h.proposals.push({ id: `prop_start_${dx.id}_${h.proposals.length}`, kind: 'start', dxId: dx.id, providerId: doc.id, wk: now(p), summary: say, status: 'open', recommended: list[0].id,
    options: [...list.map((m) => ({ id: m.id, label: `Start ${m.name.toLowerCase()}`, sub: `${m.cls}. ${m.uses[dx.conditionId] === 'first' ? 'A usual first choice.' : 'Also used.'}`, act: { kind: 'start', medId: m.id } })),
      { id: 'decline', label: 'Not now', sub: 'Carry on without medicine. You can ask again any time.', act: { kind: 'decline' } }] });
  if (h.settings.follow) decide(h.proposals.at(-1).id, list[0].id, p);
  return say;
}

/** The player's decision on an open proposal. */
export function decide(propId, optionId, p = player()) {
  const h = healthOf(p);
  const prop = h.proposals.find((x) => x.id === propId && x.status === 'open');
  if (!prop) return result(false, 'That decision has already been made.', 'neutral');
  const opt = prop.options.find((o) => o.id === optionId);
  if (!opt) return result(false, 'That is not one of the options.', 'neutral');
  const doc = store.state.npcs[prop.providerId];
  const t = h.trials.find((x) => x.id === prop.trialId);
  const rev = t?.reviews.at(-1);
  const done = (text, tone = 'good', extra) => { prop.status = 'accepted'; prop.chosen = optionId; if (rev) rev.decision = optionId; log(text, 'system', tone); return result(true, text, tone, extra); };
  switch (opt.act.kind) {
    case 'start': {
      const r = startTrial({ medId: opt.act.medId, dxId: prop.dxId, prescriberId: doc.id, reason: 'Chosen together with the prescriber.' }, p);
      if (!r.ok) return r;
      prop.status = 'accepted'; prop.chosen = optionId;
      return r;
    }
    case 'decline': prop.status = 'declined'; return result(true, 'You decide not to, for now. That is a reasonable choice, and the door stays open.', 'neutral');
    case 'later': prop.status = 'declined'; bookReview(t, now(p) + 2, p); return result(true, 'You take some time. Another appointment is booked.', 'neutral');
    case 'continue': t.history.push({ wk: now(p), text: 'Reviewed: carrying on.' }); return done(`You carry on with ${MED_BY_ID[t.medicationId].name.toLowerCase()}. Next review ${rel(t.nextReviewWk)}.`, 'neutral');
    case 'adjust': {
      t.adjusted = true;
      const r = seeded('adjust', t.id);
      t.boost = r.chance(0.5) ? r.range(0.1, 0.25) : r.range(0, 0.05);
      t.responseState = 'adjusted';
      t.history.push({ wk: now(p), text: `Adjusted by ${clinicianName(doc)}.` });
      t.nextReviewWk = now(p) + 4;
      setComponent(t.id, 'modified', 'Adjusted.', p);
      return done(`${clinicianName(doc)} adjusts the treatment. Another review in four weeks.`);
    }
    case 'ease': {
      t.adjusted = true;
      t.eased = Object.fromEntries(effectsNow(t).map((e) => [e.id, 1]));
      t.fit.ceiling = Math.max(0, t.fit.ceiling - 0.05);
      t.responseState = 'adjusted';
      t.history.push({ wk: now(p), text: 'Adjusted to ease side effects.' });
      t.nextReviewWk = now(p) + 4;
      setComponent(t.id, 'modified', 'Adjusted to ease side effects.', p);
      return done(`${clinicianName(doc)} adjusts the treatment to make it easier to live with. Another review in four weeks.`);
    }
    case 'switch': {
      const choices = optionsFor(t.conditionId, doc, p, { replacing: t.id }).filter((m) => m.id !== t.medicationId && !h.trials.some((x) => x.diagnosisId === t.diagnosisId && x.medicationId === m.id && ['insufficient', 'poorly_tolerated'].includes(x.reviews.at(-1)?.state)));
      if (!choices.length) return result(false, `${clinicianName(doc)} has no other medicine to offer for this here. A referral or therapy may be the next step.`, 'neutral');
      const next = opt.act.medId ? choices.find((m) => m.id === opt.act.medId) ?? choices[0] : choices[0];
      return switchTo(t, next.id, doc, prop, rev, p);
    }
    case 'therapy': prop.status = 'accepted'; prop.chosen = optionId; if (rev) rev.decision = optionId;
      return result(true, 'You and the prescriber agree to add talking therapy. You can choose a therapist in My Health.', 'good', { wantsTherapy: t.underlyingId });
    case 'therapy_stop': taper(t, 4, 'Agreed to focus on therapy instead.', p); prop.status = 'accepted'; prop.chosen = optionId;
      return result(true, `${MED_BY_ID[t.medicationId].name} is reduced gradually over the next month. Therapy can be arranged in My Health.`, 'neutral', { wantsTherapy: t.underlyingId });
    case 'stop': taper(t, 4, 'Agreed to stop, with a gradual reduction.', p);
      return done(`${clinicianName(doc)} sets out a gradual reduction over about a month, rather than stopping at once.`, 'neutral');
    case 'bipolar_revision': return bipolarRevision(t, doc, prop, p);
    case 'rehab': {
      const where = findProviders(opt.act.therapyId, opt.act.conditionId ?? null, p).find((x) => x.ok);
      if (!where) return result(false, 'There is no rehabilitation service nearby that can take you.', 'neutral');
      const dx = h.diagnoses.find((d) => d.status === 'active' && d.conditionId === opt.act.conditionId);
      const r = startTherapy({ therapyId: opt.act.therapyId, facilityId: where.facilityId, providerId: where.providerId, dxId: dx?.id, need: 'rehabilitation' }, p);
      if (!r.ok) return r;
      setRehabGoals(r.course, opt.act.goals);
      prop.status = 'accepted'; prop.chosen = optionId;
      return r;
    }
    default: return result(false, 'Unknown option.', 'neutral');
  }
}

/** A supervised change from one medicine to another. The first trial is kept, marked as switched. */
function switchTo(t, medId, doc, prop, rev, p) {
  const h = healthOf(p);
  const old = MED_BY_ID[t.medicationId];
  const r = startTrial({ medId, dxId: t.diagnosisId, prescriberId: doc.id, replacing: t.id, reason: `Switched from ${old.name.toLowerCase()} after a review.` }, p);
  if (!r.ok) return r;
  const why = rev?.state === 'poorly_tolerated' ? 'Side effects, after a review with the prescriber.' : rev?.state === 'partial' ? 'Partial response, after a review with the prescriber.' : 'Not enough benefit after a fair trial, at a review with the prescriber.';
  taper(t, 2, why, p);
  t.replacedBy = r.trial.id;
  r.trial.replaces = t.id;
  prop.status = 'accepted'; prop.chosen = 'switch';
  if (rev) rev.decision = 'switch';
  const text = `${clinicianName(doc)} sets out the change: ${old.name.toLowerCase()} is reduced over two weeks while ${MED_BY_ID[medId].name.toLowerCase()} begins. Your notes keep a record of both. A follow-up is booked ${rel(r.trial.nextReviewWk)}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'good', { trial: r.trial });
}

/** A gradual, supervised reduction. Stopping at once is never offered. */
function taper(t, weeks, why, p) {
  const med = MED_BY_ID[t.medicationId];
  t.status = 'tapering';
  t.taperFrom = now(p);
  t.taperEnd = now(p) + weeks;
  t.changeReason = why;
  t.history.push({ wk: now(p), text: `Gradual reduction began. ${why}` });
  // Even a slow reduction can bring a few unsettled weeks, more with some medicines than others.
  const r = seeded('stop', t.id);
  if (r.chance({ notable: 0.35, moderate: 0.15, low: 0.03 }[med.stopping] ?? 0.1)) {
    t.offUntil = t.taperEnd + r.int(1, 3);
    t.history.push({ wk: now(p), text: 'Some discontinuation symptoms while coming off: dizziness and poor sleep, easing over a few weeks.' });
  }
  setComponent(t.id, 'paused', 'Being reduced.', p);
}

/** Depression turns out to be bipolar disorder: revise, start a stabiliser, reduce the antidepressant. */
function bipolarRevision(t, doc, prop, p) {
  const h = healthOf(p);
  const underlying = h.conditions.find((c) => c.id === t.underlyingId);
  const dx = h.diagnoses.find((d) => d.id === t.diagnosisId);
  const next = reviseDx(dx, underlying.conditionId, doc, 'A high episode showed this was bipolar disorder all along.', p);
  // The antidepressant is reduced first; a stabiliser is started as its own trial for the revised diagnosis.
  taper(t, 3, 'Diagnosis revised to bipolar disorder: an antidepressant on its own is not the right treatment.', p);
  prop.status = 'accepted'; prop.chosen = 'rethink';
  const stab = optionsFor(next.conditionId, doc, p).find((m) => m.family === 'mood_stabiliser');
  const r = stab ? startTrial({ medId: stab.id, dxId: next.id, prescriberId: doc.id, reason: 'Started after the diagnosis was revised.' }, p) : null;
  const text = `Your diagnosis is revised to ${next.name}. ${MED_BY_ID[t.medicationId].name} is reduced gradually${r?.ok ? `, and you start ${stab.name.toLowerCase()}, with regular checks` : ''}. Your earlier diagnosis and treatment stay in your record.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

// ---------- Things the player can raise between reviews ----------

/** Report side effects: the prescriber brings the follow-up forward. */
export function reportSideEffects(trialId, p = player()) {
  const h = healthOf(p);
  const t = h.trials.find((x) => x.id === trialId && isLive(x));
  if (!t) return result(false, 'That medicine is not current.', 'neutral');
  const eff = effectsNow(t);
  t.reported = { wk: now(p), benefit: t.reported?.benefit ?? 'not yet clear', effects: eff.map((e) => e.label) };
  t.history.push({ wk: now(p), text: eff.length ? `Reported side effects: ${eff.map((e) => e.label.toLowerCase()).join(', ')}.` : 'Reported feeling unsure about it.' });
  const urgent = eff.some((e) => e.urgent);
  t.nextReviewWk = now(p) + (urgent ? 0 : 1);
  h.appointments.filter((a) => a.ref === t.id && a.kind === 'review' && a.status === 'booked').forEach((a) => { a.wk = Math.min(a.wk, t.nextReviewWk); });
  if (!h.appointments.some((a) => a.ref === t.id && a.kind === 'review' && a.status === 'booked')) bookReview(t, t.nextReviewWk, p);
  return result(true, urgent ? 'You call the clinic. With a rash like this they want to see you this week.' : `The clinic brings your follow-up forward to ${rel(t.nextReviewWk)}. In the meantime, keep taking it as prescribed unless they say otherwise.`, 'neutral');
}

/** Ask to talk about how it is going: limited improvement, doubts, preferences. */
export function discussResponse(trialId, p = player()) {
  const h = healthOf(p);
  const t = h.trials.find((x) => x.id === trialId && isLive(x));
  if (!t) return result(false, 'That medicine is not current.', 'neutral');
  if (h.appointments.some((a) => a.ref === t.id && a.kind === 'review' && a.status === 'booked' && a.wk <= now(p) + 2)) return result(false, 'You already have a follow-up coming up soon.', 'neutral');
  t.nextReviewWk = now(p) + 1;
  bookReview(t, t.nextReviewWk, p);
  return result(true, `A follow-up is booked ${rel(t.nextReviewWk)} to talk it through.`, 'neutral');
}

/** The trials for a diagnosis, oldest first: the full history, switched ones included. */
export const trialsFor = (dxId, h = healthOf()) => h.trials.filter((t) => t.diagnosisId === dxId).sort((a, b) => a.startWk - b.startWk);

/** When the second (or later) medicine settles well, the person has found a better fit. */
export function noticeBetterFit(p = player()) {
  const h = healthOf(p);
  for (const t of h.trials) {
    if (!t.replaces || t.betterNoted || !isLive(t)) continue;
    if (t.reviews.at(-1)?.state === 'adequate') {
      t.betterNoted = true;
      healthMilestone('Found a treatment that suits you better.', { type: 'trial', id: t.id }, p);
    }
  }
}

