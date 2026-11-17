// Therapy: courses of individual and group treatment with persistent
// clinicians and groups, held week by week on the care calendar.
//
// Progress comes only from sessions actually attended and skills actually
// practised. It is gradual and uneven; a hard week is a setback, never a loss of
// what has been learned. No number of sessions "cures" anything: a course helps
// to the extent it fits the person, and skills keep helping after it ends.
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { clamp } from '../../util.js';
import { makeNpc } from '../npcFactory.js';
import { THERAPY_BY_ID, DBT_MODULES, MODULE_BY_ID } from '../../data/health/therapies.js';
import { CONDITION_BY_ID } from '../../data/health/conditions.js';
import { PROFESSIONS } from '../../data/health/providers.js';
import { healthOf, presentConditions, lifeNote } from './record.js';
import { canOffer } from './rules.js';
import { facility, facilitiesHere, facilityDef, clinicianAt, clinicianName, joinCareTeam, addComponent, setComponent, waitWeeks, turnsUp } from './care.js';
import { now, seeded, charge, priceOf, rel, hashOf } from './util.js';
import { healthMilestone } from './story.js';
import { rehabProgress, inHospital, admit } from './hospital.js';
import { cancerOutcome } from './course.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
export const DBT4 = DBT_MODULES.map((m) => m.id);

// ---------- Groups ----------

function world() { store.state.care ??= { facilities: {}, groups: {} }; return store.state.care; }

/**
 * The group for a therapy at a facility: one standing group, with stable
 * facilitators and members, running its cycle whether or not the player is in it.
 */
export function groupAt(therapyId, f) {
  const w = world();
  const id = `grp_${f.id}_${therapyId}`;
  if (w.groups[id]) return w.groups[id];
  const t = THERAPY_BY_ID[therapyId];
  const r = seeded('group', id);
  const facilitators = [];
  if (t.kind !== 'peer') {
    const pro = t.by.find((b) => facilityDef(f).staff.includes(b)) ?? t.by[0];
    const lead = clinicianAt(f, pro, { dbt: !!t.dbt });
    if (lead) facilitators.push(lead.id);
    const co = clinicianAt(f, pro, { dbt: !!t.dbt, exclude: lead ? [lead.id] : [], another: true });
    if (co && co.id !== lead?.id) facilitators.push(co.id);
  }
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  w.groups[id] = { id, therapyId, facilityId: f.id, facilitatorIds: facilitators, day: r.pick(days), evening: r.chance(0.6),
    startWk: now() - r.int(0, 23), memberIds: [], size: r.int(5, 8) };
  return w.groups[id];
}

/** The DBT module a group is teaching in a given week. */
export function moduleAt(group, wk = now()) {
  const t = THERAPY_BY_ID[group.therapyId];
  if (!t.cycle) return null;
  const len = t.cycle.reduce((s, [, n]) => s + n, 0);
  let pos = ((wk - group.startWk) % len + len) % len;
  for (const [id, n] of t.cycle) { if (pos < n) return { id, weekIn: pos + 1, of: n }; pos -= n; }
  return null;
}

/** Fellow members appear as people in the player's life. What they share in the group stays in the group. */
function meetMembers(group, p = player()) {
  if (group.memberIds.length) return;
  const f = facility(group.facilityId);
  const n = Math.max(3, group.size - 1);
  for (let i = 0; i < n; i++) {
    const m = makeNpc({ role: 'groupmate', countryId: f.countryId, age: clamp(p.age + rng.int(-8, 14), 16, 80), relationship: rng.int(30, 50) });
    m.flags.metAt = group.id;
    m.flags.metWhere = `${THERAPY_BY_ID[group.therapyId].short} at ${f.name}`;
    store.state.npcs[m.id] = m;
    group.memberIds.push(m.id);
    p.npcIds.push(m.id);
  }
}

// ---------- Finding a therapist ----------

/**
 * Therapists and groups that could offer this therapy here, now, for this need.
 * Each is a real, persistent clinician (or group) at a real facility.
 */
export function findProviders(therapyId, conditionId = null, p = player()) {
  const t = THERAPY_BY_ID[therapyId];
  const out = [];
  for (const f of facilitiesHere(p)) {
    const def = facilityDef(f);
    if (t.kind === 'peer') { if (f.defId === 'community') out.push({ facilityId: f.id, facility: f.name, kind: f.kind, group: true, providerId: null, cost: 0, wait: 1, ok: true, why: '' }); continue; }
    if (t.dbt && !def.dbt && f.defId !== 'private') continue;
    const pro = t.by.find((b) => def.staff.includes(b));
    if (!pro) continue;
    if (t.format === 'group') {
      const g = groupAt(therapyId, f);
      const lead = store.state.npcs[g.facilitatorIds[0]];
      const ok = canOffer(therapyId, conditionId, lead, p);
      out.push({ facilityId: f.id, facility: f.name, kind: f.kind, group: true, groupId: g.id, providerId: lead?.id, provider: lead ? clinicianName(lead) : '',
        when: `${g.day} ${g.evening ? 'evenings' : 'afternoons'}`, cost: priceOf(t.cost, f.fee), wait: waitWeeks(f), ok: ok.ok, why: ok.why });
      continue;
    }
    const doc = clinicianAt(f, pro, { dbt: !!t.dbt });
    if (!doc) continue;
    const ok = canOffer(therapyId, conditionId, doc, p);
    out.push({ facilityId: f.id, facility: f.name, kind: f.kind, group: false, providerId: doc.id, provider: clinicianName(doc), profession: PROFESSIONS[pro].name,
      approach: doc.flags.clinician.approach, years: doc.flags.clinician.years, cost: priceOf(t.cost, f.fee), wait: waitWeeks(f), ok: ok.ok, why: ok.why });
  }
  return out;
}

// ---------- Starting, pausing, ending ----------

/**
 * Starts a course. `recIds` are the underlying conditions (or support needs) it
 * is for; with no diagnosis a course can still be for a need, where the
 * therapy allows it (DBT skills are offered for emotional difficulties without
 * a BPD diagnosis, for example).
 */
export function startTherapy({ therapyId, facilityId, providerId, dxId, need }, p = player()) {
  const h = healthOf(p);
  const t = THERAPY_BY_ID[therapyId];
  const f = facility(facilityId);
  if (!t || !f) return result(false, 'That is not available here.', 'neutral');
  const dx = dxId ? h.diagnoses.find((d) => d.id === dxId && d.status === 'active') : null;
  const conditionId = dx?.conditionId ?? null;
  if (h.therapies.some((c) => c.therapyId === therapyId && ['active', 'paused'].includes(c.status))) return result(false, `You are already in ${t.short}.`, 'neutral');
  let group = null;
  let doc = store.state.npcs[providerId] ?? null;
  if (t.format === 'group') { group = groupAt(therapyId, f); doc = store.state.npcs[group.facilitatorIds[0]] ?? null; }
  const ok = canOffer(therapyId, conditionId, doc, p);
  if (!ok.ok) return result(false, ok.why, 'neutral');
  const recIds = dx ? [dx.underlyingId] : presentConditions(h).filter((c) => t.for.includes(c.conditionId)).map((c) => c.id);
  const fit = seeded('therapy', p.id, therapyId);
  const course = {
    id: `ther_${hashOf(p.id, therapyId, now(p), h.therapies.length).toString(36)}`,
    therapyId, facilityId, providerId: doc?.id ?? null, groupId: group?.id ?? null, diagnosisIds: dx ? [dx.id] : [], conditionIds: recIds,
    need: need ?? (dx ? null : 'support'), startWk: now(p), nextWk: now(p) + waitWeeks(f), status: 'active', sessions: [], attended: 0, missed: 0,
    progress: 0, fit: Math.round(fit.range(0.35, 0.85) * 100) / 100, compat: Math.round(fit.range(0.4, 1) * 100) / 100,
    providers: doc ? [{ id: doc.id, from: now(p) }] : [], moduleDone: {}, history: [{ wk: now(p), text: `Referred to ${t.name}${doc ? ` with ${clinicianName(doc)}` : ''} at ${f.name}.` }],
  };
  h.therapies.push(course);
  if (doc) joinCareTeam(doc, p);
  // Most cancer treatment begins with surgery: a short planned stay.
  if (t.id === 'cancer_treatment' && (h.conditions.find((x) => x.id === recIds[0])?.stage ?? 2) <= 3) { course.nextWk = Math.max(course.nextWk, now(p) + 2); admit('surgery', { conditionId: 'cancer' }, p); }
  if (group) { for (const id of group.facilitatorIds) joinCareTeam(store.state.npcs[id], p); }
  addComponent('therapy', course.id, t.name, conditionId ?? (recIds[0] ? h.conditions.find((c) => c.id === recIds[0])?.conditionId : null), dx?.id ?? null, p);
  const first = t.dbt && t.format !== 'group' ? 'The first sessions are about what you want from your life and whether DBT is the right fit.' : group ? `The group meets on ${group.day} ${group.evening ? 'evenings' : 'afternoons'}.` : '';
  const text = `${t.name} is arranged${doc ? ` with ${clinicianName(doc)}` : ''} at ${f.name}, starting ${rel(course.nextWk)}. ${first}`.trim();
  log(text, 'system', 'good');
  if (!h.therapies.some((c) => c !== course && THERAPY_BY_ID[c.therapyId].kind === 'therapy')) healthMilestone(`Began ${t.name.toLowerCase()}.`, { type: 'therapy', id: course.id }, p);
  else if (t.id === 'dbt_group') healthMilestone('Started DBT skills training.', { type: 'therapy', id: course.id }, p);
  return result(true, text, 'good', { course });
}

export function pauseTherapy(id, p = player()) {
  const c = healthOf(p).therapies.find((x) => x.id === id && x.status === 'active');
  if (!c) return result(false, 'Nothing to pause.', 'neutral');
  c.status = 'paused'; c.history.push({ wk: now(p), text: 'Paused.' });
  setComponent(c.id, 'paused', 'Paused.', p);
  return result(true, 'Paused. You can pick it up again; what you have learned stays with you.', 'neutral');
}
export function resumeTherapy(id, p = player()) {
  const c = healthOf(p).therapies.find((x) => x.id === id && x.status === 'paused');
  if (!c) return result(false, 'Nothing to resume.', 'neutral');
  if (!c.providerId && !c.groupId) return result(false, 'You need a new therapist first.', 'neutral');
  c.status = 'active'; c.nextWk = now(p) + 1; c.history.push({ wk: now(p), text: 'Resumed.' });
  setComponent(c.id, 'active', 'Resumed.', p);
  return result(true, `Back on the calendar from ${rel(c.nextWk)}.`, 'good');
}
export function endTherapy(id, why = 'Ended by choice.', p = player()) {
  const c = healthOf(p).therapies.find((x) => x.id === id && ['active', 'paused'].includes(x.status));
  if (!c) return result(false, 'Nothing to end.', 'neutral');
  c.status = 'ended'; c.endWk = now(p); c.history.push({ wk: now(p), text: why });
  setComponent(c.id, 'discontinued', why, p);
  return result(true, 'Ended. The record of it stays, and you can come back to therapy whenever you want.', 'neutral');
}

/** A different therapist at the same service, or another one. Nothing in the record is lost. */
export function changeTherapist(id, p = player()) {
  const h = healthOf(p);
  const c = h.therapies.find((x) => x.id === id && ['active', 'paused'].includes(x.status));
  if (!c || c.groupId) return result(false, 'There is no individual therapist to change.', 'neutral');
  const t = THERAPY_BY_ID[c.therapyId];
  const f = facility(c.facilityId);
  const pro = t.by.find((b) => facilityDef(f).staff.includes(b));
  const next = clinicianAt(f, pro, { dbt: !!t.dbt, exclude: c.providers.map((x) => x.id), another: true });
  if (!next || next.id === c.providerId) return result(false, 'There is nobody else at this service. You could try another service.', 'neutral');
  const old = store.state.npcs[c.providerId];
  c.providers.at(-1).to = now(p);
  c.providers.push({ id: next.id, from: now(p) });
  c.providerId = next.id;
  c.compat = Math.round(seeded('compat', p.id, next.id).range(0.45, 1) * 100) / 100;
  c.history.push({ wk: now(p), text: `Changed therapist from ${clinicianName(old)} to ${clinicianName(next)}.` });
  joinCareTeam(next, p);
  return result(true, `From your next session you will see ${clinicianName(next)}, who has your notes. Finding the right fit is part of good care.`, 'good');
}

// ---------- Sessions ----------

/** One week of therapy: each course whose session falls this week. */
export function therapyWeek(p = player()) {
  const h = healthOf(p);
  const w = now(p);
  if (inHospital(p)) return; // sessions wait until they are home
  for (const c of h.therapies) {
    if (c.status !== 'active' || w < c.nextWk) continue;
    const t = THERAPY_BY_ID[c.therapyId];
    const doc = store.state.npcs[c.providerId];
    if (t.kind !== 'peer' && !doc?.alive) { c.status = 'paused'; c.history.push({ wk: w, text: 'Paused: the therapist is no longer available.' }); continue; }
    c.nextWk = w + (t.kind === 'peer' ? 2 : t.id === 'tfp' ? 1 : 1);
    session(c, t, doc, p);
  }
  practice(p);
}

function session(c, t, doc, p) {
  const h = healthOf(p);
  const w = now(p);
  const n = c.attended + c.missed + 1;
  const group = c.groupId ? world().groups[c.groupId] : null;
  const mod = group ? moduleAt(group, w) : null;
  const rapport = doc ? doc.meters.relationship : 60;
  const came = turnsUp(p, (rapport - 50) / 500);
  const s = { n, wk: w, attended: came, module: mod?.id ?? null, note: '' };
  if (!came) {
    c.missed += 1;
    s.note = 'Missed.';
    c.sessions.push(s);
    trim(c);
    return;
  }
  if (group) meetMembers(group, p);
  const f = facility(c.facilityId);
  s.paid = charge(`sess:${c.id}:${n}`, t.cost, { fee: f?.fee ?? 1, what: `${t.short} session` });
  c.attended += 1;
  if (doc) {
    doc.lastInteractionAge = p.age;
    // Rapport grows with time, more where the fit is good; a professional relationship, nothing more.
    doc.meters.relationship = clamp(doc.meters.relationship + (c.compat - 0.55) * 8 + 1);
  }
  const engage = clamp(0.55 + rapport / 250 + (h.wellbeing.energy - 50) / 400, 0.3, 1.1);
  const gain = (1 / t.sessions) * 2.4 * engage * (0.6 + c.fit * 0.6);
  c.progress = Math.round(clamp(c.progress + gain * (1 - c.progress), 0, 1) * 1000) / 1000;
  // Skills: a group teaches the module of the week; individual DBT coaches all four; others build what they build.
  const sk = h.skills;
  const up = (k, amt) => { sk[k] = Math.round(clamp(sk[k] + amt * (1 - sk[k] / 100) * engage) * 10) / 10; };
  if (t.id === 'dbt_group' && mod) { up(mod.id, mod.id === 'mindfulness' ? 3.2 : 4.6); }
  else if (t.id === 'dbt') { for (const k of DBT4) up(k, 1); const weakest = DBT4.reduce((a, b) => (sk[a] <= sk[b] ? a : b)); up(weakest, 1.2); }
  else for (const k of t.builds) up(k, 3);
  s.note = sessionNote(c, t, mod, p);
  if (c.rehabGoals) { const g = rehabProgress(c, engage, p); const next = c.rehabGoals.find((x) => !x.metWk); s.note = g ? `Goal reached: ${g.text.toLowerCase()}.` : next ? `Working on: ${next.text.toLowerCase()}.` : s.note; }
  c.sessions.push(s);
  trim(c);
  // Module milestones: once a group has taught a module the player mostly attended, it is theirs.
  if (group && mod && mod.weekIn === mod.of && mod.id !== 'mindfulness') {
    const block = c.sessions.filter((x) => x.module === mod.id && x.wk > w - mod.of - 1);
    if (block.filter((x) => x.attended).length >= Math.ceil(mod.of / 2) && !c.moduleDone[mod.id]) {
      c.moduleDone[mod.id] = w;
      c.history.push({ wk: w, text: `Completed the ${MODULE_BY_ID[mod.id].name.toLowerCase()} module.` });
      healthMilestone(`Completed a DBT skills module: ${MODULE_BY_ID[mod.id].name.toLowerCase()}.`, { type: 'module', id: c.id }, p);
    }
  }
  if (c.attended >= t.sessions && c.status === 'active') {
    c.status = 'completed'; c.endWk = w;
    if (t.id === 'cancer_treatment') for (const id of c.conditionIds) { const rec = h.conditions.find((x) => x.id === id); if (rec) cancerOutcome(rec, c, p); }
    c.history.push({ wk: w, text: 'Completed the course.' });
    setComponent(c.id, 'completed', 'Course completed.', p);
    log(`You finished ${t.name.toLowerCase()}${doc ? ` with ${clinicianName(doc)}` : ''}. What you practised there goes with you.`, 'system', 'good');
    if (t.dbt) healthMilestone(`Completed ${t.name.toLowerCase()}.`, { type: 'therapy', id: c.id }, p);
  }
}

const trim = (c) => { if (c.sessions.length > 80) c.sessions.splice(0, c.sessions.length - 80); };

/**
 * A short note of what a session covered. It only ever refers to things that
 * really happened in this life (the health record's life notes); nothing is
 * invented to give a session something to talk about.
 */
function sessionNote(c, t, mod, p) {
  const h = healthOf(p);
  const recent = h.lifeNotes.find((x) => !x.discussed && now(p) - x.wk <= 10);
  if (recent && t.kind === 'therapy') recent.discussed = true;
  const topic = recent && t.kind === 'therapy' ? ` Talked through ${recent.text}` : '';
  if (t.id === 'dbt') return `Diary card review.${topic || ' Looked at the week\'s hardest moment and what might help next time.'}`;
  if (t.id === 'dbt_group' && mod) return `${MODULE_BY_ID[mod.id].name}, week ${mod.weekIn} of ${mod.of}: ${MODULE_BY_ID[mod.id].skills[(mod.weekIn - 1) % MODULE_BY_ID[mod.id].skills.length]}. Homework set.`;
  if (t.kind === 'peer') return 'Went along, listened, and said a little.';
  if (t.kind === 'allied') return 'Worked on your goals.';
  return `Session ${c.attended}.${topic || ' Reviewed the week and the practice in between.'}`;
}

/** Between sessions: skills grow only when they are practised. */
function practice(p) {
  const h = healthOf(p);
  const active = h.therapies.filter((c) => c.status === 'active' && THERAPY_BY_ID[c.therapyId].dbt && c.sessions.at(-1)?.attended);
  if (!active.length) return;
  const mod = active.map((c) => (c.groupId ? moduleAt(world().groups[c.groupId]) : null)).find(Boolean);
  const k = mod?.id ?? 'mindfulness';
  if (rng.chance(0.7)) h.skills[k] = Math.round(clamp(h.skills[k] + 0.5 * (1 - h.skills[k] / 100)) * 10) / 10;
}

// ---------- Effects ----------

/** How much a course is helping one condition (0–1), from progress and fit. */
export function therapyEffect(c, rec, p = player()) {
  const t = THERAPY_BY_ID[c.therapyId];
  if (!t || c.attended === 0) return 0;
  const forIt = c.conditionIds.includes(rec.id) || t.for.includes(rec.conditionId);
  if (!forIt) return 0;
  if (t.dbt) return 0.12 * c.progress * (c.status === 'active' ? 1 : 0.5); // the rest of DBT's effect comes through the skills
  if (t.kind === 'peer') return c.status === 'active' ? 0.04 : 0;
  const keep = c.status === 'active' ? 1 : ['completed', 'ended', 'paused'].includes(c.status) ? 0.6 : 0;
  return clamp(c.fit * 0.75 * c.progress * keep, 0, 0.6);
}

/** What practised skills do for a condition, whether or not a course is running. Counted once. */
export function skillsEffect(rec, p = player()) {
  const s = healthOf(p).skills;
  const avg4 = DBT4.reduce((a, k) => a + s[k], 0) / 4;
  switch (CONDITION_BY_ID[rec.conditionId]?.group) {
    case 'personality': return clamp(0.7 * avg4 / 100, 0, 0.6);
    case 'mood': case 'anxiety': case 'trauma': case 'eating': case 'ocd':
      return clamp(0.25 * Math.max(s.coping, s.regulation, s.distress) / 100, 0, 0.25);
    case 'neurodev': return clamp(0.3 * Math.max(s.organisation, s.communication, s.study, s.independence) / 100, 0, 0.3);
    case 'mobility': case 'sensory': case 'genetic': return clamp(0.2 * s.independence / 100, 0, 0.2);
    default: return 0;
  }
}

/** Life is not linear: now and then a hard week. Skills stay; the week is just hard. */
export function setbacks(p = player()) {
  const h = healthOf(p);
  for (const rec of presentConditions(h)) {
    const g = CONDITION_BY_ID[rec.conditionId].group;
    if (!['personality', 'mood', 'anxiety'].includes(g) || rec.status !== 'active') continue;
    if (!rng.chance(0.012)) continue;
    rec.spike = (rec.spike ?? 0) + rng.int(8, 16);
    if (h.therapies.some((c) => c.status === 'active')) lifeNote('hard_week', 'a hard week, and what got you through it');
  }
}

/** For the DBT Journey: the player's DBT courses and the group they are in. */
export function dbtState(p = player()) {
  const h = healthOf(p);
  const individual = h.therapies.filter((c) => c.therapyId === 'dbt');
  const groupCourses = h.therapies.filter((c) => c.therapyId === 'dbt_group');
  const current = groupCourses.find((c) => c.status === 'active');
  const group = current ? world().groups[current.groupId] : null;
  return { individual, groupCourses, group, module: group ? moduleAt(group) : null, skills: Object.fromEntries(DBT4.map((k) => [k, h.skills[k]])) };
}

export const groupOf = (id) => world().groups[id];
