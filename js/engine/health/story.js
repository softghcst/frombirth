// Health in the wider life: milestones (private by default), what other people
// know, the health of the people around the player, family medical history,
// and the hooks story events use.
//
// Privacy rules, in one place:
//   - Diagnoses, therapy, medication and care plans are private to the player.
//   - The player can tell a particular person, or share a condition into the
//     family medical history. Nothing else spreads it.
//   - Descendants see family history (conditions shared, and inherited
//     conditions families generally know about), never therapy or prescriptions.
//   - Group members' disclosures are never stored on them.
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { remember } from '../conditions.js';
import { roleLabel } from '../relationships.js';
import { CONDITIONS, CONDITION_BY_ID, MENTAL, nameIn } from '../../data/health/conditions.js';
import { GENES } from '../../data/health/genetics.js';
import { healthOf, lifeNote, presentConditions, diagnosisFor } from './record.js';
import { genomeOf, hazardMultiplier, bornWith, isBiological, carrierOf, affected } from './heredity.js';
import { now, seeded, charge, priceOf } from './util.js';
import { clamp } from '../../util.js';
import { THERAPY_BY_ID } from '../../data/health/therapies.js';
import { MED_BY_ID } from '../../data/health/medications.js';
import { serviceOptions, seekAssessment } from './care.js';
import { requestAccommodation } from './access.js';
import { admit } from './hospital.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

// ---------- Milestones ----------

/**
 * A health moment in the Life Story. Private unless the player shares it.
 * Recorded once per thing it is about, so reloading never repeats it.
 */
export function healthMilestone(text, ref, p = player(), o = {}) {
  const key = `${ref.type}:${ref.id}:${text}`;
  if (p.milestones.some((m) => m.key === key)) return;
  p.milestones.push({ age: p.age, text, kind: 'health', private: true, shareable: !!o.shareable, ref, key, wk: now(p) });
}

/** Milestones anyone other than the player may see: the obituary, the title screen, descendants. */
export const publicMilestones = (list = []) => list.filter((m) => !m.private || m.shared);

export function shareMilestone(key, on = true, p = player()) {
  const m = p.milestones.find((x) => x.key === key);
  if (!m) return result(false, 'Not found.', 'neutral');
  m.shared = on;
  return result(true, on ? 'This will be part of the story others can read.' : 'Private again.', 'neutral');
}

// ---------- Telling people ----------

/** Tell one person about a diagnosis. They remember that you trusted them with it. */
export function tell(npcId, dxId, p = player()) {
  const h = healthOf(p);
  const dx = h.diagnoses.find((d) => d.id === dxId);
  const npc = store.state.npcs[npcId];
  if (!dx || !npc?.alive) return result(false, 'Not possible.', 'neutral');
  const rec = h.conditions.find((c) => c.id === dx.underlyingId);
  if (rec.disclosedTo.includes(npcId)) return result(false, `${npc.firstName} already knows.`, 'neutral');
  rec.disclosedTo.push(npcId);
  rec.visibility = 'shared_by_choice';
  const warm = npc.meters.relationship >= 45 || rng.chance(0.75);
  npc.meters.relationship = Math.min(100, npc.meters.relationship + (warm ? 4 : -2));
  remember(npc, `toldHealth_${dx.conditionId}`, 'You trusted them with something about your health.');
  const text = warm ? `${npc.firstName} listens, asks what helps, and thanks you for telling them.` : `${npc.firstName} does not quite know what to say. It is a start.`;
  log(`You told ${npc.firstName} about your ${dx.name.toLowerCase()}. ${text}`, 'system', warm ? 'good' : 'neutral');
  return result(true, text, warm ? 'good' : 'neutral');
}

/** Include a condition (only the fact of it) in the family medical history descendants can see. */
export function shareWithFamily(recId, on = true, p = player()) {
  const rec = healthOf(p).conditions.find((c) => c.id === recId);
  if (!rec) return result(false, 'Not found.', 'neutral');
  rec.sharedWithFamily = on;
  return result(true, on ? 'It will appear in your family\'s medical history: the condition, not your notes.' : 'Removed from the family history.', 'neutral');
}

// ---------- The health of other people ----------

const CLOSE = ['parent', 'sibling', 'grandparent', 'child', 'grandchild', 'spouse', 'partner', 'relative', 'niece'];

/**
 * A lighter health record for important people: which conditions they have,
 * whether they were diagnosed, and whether they have told the player. Worked
 * out once for their life so far (seeded, so it is the same on every load),
 * then year by year.
 */
export function npcHealth(npc) {
  if (!npc || npc.role === 'pet' || npc.role === 'clinician' || npc.role === 'groupmate') return null;
  if (npc.health?.v) return npc.health;
  const g = genomeOf(npc);
  const r = seeded('npcHealth', npc.id);
  const conds = [];
  const born = store.state.year - npc.age;
  const add = (id, age) => {
    const def = CONDITION_BY_ID[id];
    const year = born + age;
    const named = !!nameIn(def, Math.max(year, store.state.year - 5));
    const diagnosed = named && r.chance(['sensory', 'mobility', 'genetic'].includes(def.group) ? 0.95 : 0.6);
    const knownToFamily = ['sensory', 'mobility', 'genetic'].includes(def.group) || (diagnosed && r.chance(0.35));
    conds.push({ id, age, diagnosed, shared: knownToFamily });
  };
  for (const id of bornWith(g, npc.id)) add(id, CONDITION_BY_ID[id].onset.shows?.[0] ?? 0);
  for (let a = 0; a <= npc.age; a++) for (const def of CONDITIONS) {
    if (def.onset.kind !== 'hazard' || a < def.onset.ages[0] || a > def.onset.ages[1] || conds.some((c) => c.id === def.id)) continue;
    if (r.chance(def.onset.rate * hazardMultiplier(g, def.id))) add(def.id, a);
  }
  // Conditions present from birth that show later (a child's ADHD at six, Huntington's at forty) are kept,
  // and only count once they have begun (see begun()).
  npc.health = { v: 1, conds, last: npc.age };
  return npc.health;
}

/**
 * Once a year, for the people closest to the player: new conditions begin,
 * some are diagnosed, and some are shared. A shared diagnosis can become a
 * scene about supporting them, never about becoming their therapist.
 */
export function tickPeopleHealth(p = player()) {
  for (const id of p.npcIds) {
    const n = store.state.npcs[id];
    if (!n?.alive || !CLOSE.includes(n.role)) continue;
    const h = npcHealth(n);
    if (!h || h.last >= n.age) continue;
    h.last = n.age;
    const g = genomeOf(n);
    npcCareYear(n, h);
    const queue = (id, cast) => { if (!store.state.pendingEvents.some((e) => e.id === id)) store.state.pendingEvents.push({ id, cast }); };
    // A child of the player's begins to show a difference present from birth: their parent notices first.
    if (n.role === 'child' && n.age < 18) {
      for (const c of h.conds) {
        const def = CONDITION_BY_ID[c.id];
        if (c.age !== n.age || c.noticed || def.group !== 'neurodev' || !nameIn(def, store.state.year)) continue;
        c.noticed = true;
        queue('child_noticed', { kid: n.id });
        n.flags.noticedHealth = c.id;
      }
    }
    // A partner living with a condition they have shared: some years are harder than others.
    if (['partner', 'spouse'].includes(n.role) && h.conds.some((c) => c.shared && MENTAL.includes(CONDITION_BY_ID[c.id].group) && c.age <= n.age) && rng.chance(0.25)) {
      queue('partner_hard_stretch', { love: n.id });
    }
    for (const def of CONDITIONS) {
      if (def.onset.kind !== 'hazard' || n.age < def.onset.ages[0] || n.age > def.onset.ages[1] || h.conds.some((c) => c.id === def.id)) continue;
      if (!rng.chance(def.onset.rate * hazardMultiplier(g, def.id))) continue;
      const diagnosed = !!nameIn(def, store.state.year) && rng.chance(0.55);
      const c = { id: def.id, age: n.age, diagnosed, shared: false };
      h.conds.push(c);
      // Telling is their choice; closeness makes it likelier.
      if (diagnosed && MENTAL.includes(def.group) && n.meters.relationship >= 55 && rng.chance(0.5)) {
        c.shared = true;
        c.sharedAt = store.state.year;
        if (!store.state.pendingEvents.some((e) => e.id === 'loved_one_shares')) store.state.pendingEvents.push({ id: 'loved_one_shares', cast: { who: n.id } });
        n.flags.sharedHealth = def.id;
      } else if (diagnosed && !MENTAL.includes(def.group) && n.meters.relationship >= 40) {
        c.shared = true;
        log(`${n.firstName} tells you they have been diagnosed with ${nameIn(def, store.state.year)}.`, 'system', 'neutral');
      }
    }
  }
}

// ---------- Care for the people around the player ----------

/** What care someone could get for a condition this year, in a few words, or null if none existed yet. */
function careFor(def) {
  const year = store.state.year;
  const t = (def.care?.therapies ?? []).map((id) => THERAPY_BY_ID[id]).find((x) => x && year >= x.from && x.kind !== 'peer');
  const m = Object.values(MED_BY_ID).find((x) => x.uses[def.id] && year >= (x.fromFor?.[def.id] ?? x.from));
  if (!t && !m) return null;
  return [t?.name.toLowerCase(), m ? (def.group === 'chronic' ? 'medicine' : 'medication') : null].filter(Boolean).join(' and ');
}

/**
 * A year of someone else's health: whether they get care for what they have,
 * and what it does. Encouragement from the player (or going with them) makes
 * seeking care likelier; it is always their decision.
 */
function npcCareYear(n, h) {
  const year = store.state.year;
  for (const c of begun(n)) {
    const def = CONDITION_BY_ID[c.id];
    if (!c.diagnosed || c.remitted || def.neurotype || ['sensory', 'mobility'].includes(def.group)) continue;
    if (!c.care) {
      const what = careFor(def);
      const push = (n.flags.encouraged >= year - 1 ? 0.25 : 0) + (n.flags.goWith === year ? 0.4 : 0);
      if (what && rng.chance(0.3 + push)) {
        c.care = { since: year, what };
        if (c.shared && push) log(`${n.firstName} has started ${what} for their ${def.short}.`, 'system', 'good');
      }
    }
    const care = !!c.care;
    if (MENTAL.includes(def.group) && rng.chance((def.remit ?? 0.2) * (care ? 1.6 : 0.6))) { c.remitted = year; continue; }
    if (def.id === 'cancer') {
      if (care && rng.chance(0.45)) { c.remitted = year; if (c.shared) log(`${n.firstName}'s cancer treatment has worked: they are in remission.`, 'system', 'good'); continue; }
      n.meters.health = clamp(n.meters.health - (care ? 3 : 8));
    } else if (def.harm) n.meters.health = clamp(n.meters.health - Math.round(def.harm * (care ? 0.25 : 0.8)));
  }
}

/** Things the player can do for someone who has shared a condition they are not getting help with. */
export function npcCareActions(npc) {
  if (!npc?.alive || !npc.health?.v) return [];
  const untreated = knownHealth(npc).some((c) => c.diagnosed && !c.care && !c.remitted && careFor(CONDITION_BY_ID[c.id]));
  if (!untreated) return [];
  const out = [{ id: 'encourageCare', label: 'Encourage them to get support' }];
  if (npc.meters.relationship >= 50 && player().age >= 16) out.push({ id: 'goWithCare', label: 'Offer to go with them to an appointment' });
  return out;
}

export function encourageCare(npcId) {
  const n = store.state.npcs[npcId];
  const year = store.state.year;
  if (!n?.alive) return result(false, 'Not possible.', 'neutral');
  if (n.flags.encouraged === year) return result(false, `You have already talked to ${n.firstName} about it this year.`, 'neutral');
  n.flags.encouraged = year;
  const well = n.meters.relationship >= 45;
  n.meters.relationship = clamp(n.meters.relationship + (well ? 2 : -3));
  return result(true, well ? `${n.firstName} listens, and says they will think about it. It is their decision; you have made it easier.` : `${n.firstName} bristles a little. Maybe another time, and another way.`, well ? 'good' : 'neutral');
}

export function goWithCare(npcId) {
  const n = store.state.npcs[npcId];
  const year = store.state.year;
  if (!n?.alive) return result(false, 'Not possible.', 'neutral');
  if (n.flags.goWith === year) return result(false, 'You have already offered.', 'neutral');
  n.flags.goWith = year; n.flags.encouraged = year;
  n.meters.relationship = clamp(n.meters.relationship + 4);
  // Going together often turns "one day" into an appointment this year.
  for (const c of knownHealth(n)) {
    const what = careFor(CONDITION_BY_ID[c.id]);
    if (c.diagnosed && !c.care && !c.remitted && what && rng.chance(0.6)) { c.care = { since: year, what }; return result(true, `You sit with ${n.firstName} in the waiting room. They come out with a plan: ${what}.`, 'good'); }
  }
  return result(true, `${n.firstName} is touched that you offered. They are not ready yet, and say so.`, 'neutral');
}

/** What the player may see of someone's health on their profile: only what they have shared. */
export function npcHealthLines(npc) {
  return knownHealth(npc).map((c) => {
    const def = CONDITION_BY_ID[c.id];
    const name = nameIn(def, store.state.year) ?? def.name;
    const state = c.remitted ? 'In remission' : c.care ? `Getting ${c.care.what} since ${c.care.since}` : c.diagnosed ? (def.neurotype ? 'Part of who they are' : 'Not getting support at the moment') : 'Not diagnosed';
    return [name.charAt(0).toUpperCase() + name.slice(1), state];
  });
}

/** What the player knows of an NPC's health: only what has been shared. */
export const begun = (npc) => (npcHealth(npc)?.conds ?? []).filter((c) => c.age <= npc.age);
export const knownHealth = (npc) => begun(npc).filter((c) => c.shared);

// ---------- Family medical history ----------

/**
 * Relevant family history for the player: biological relatives only, and only
 * what is known in the family. Adoptive and step relatives are family in every
 * other sense and appear in the tree; their health does not bear on the
 * player's inheritance, so it is not listed here.
 */
export function familyHistory(p = player()) {
  const rows = [];
  const people = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n && ['parent', 'grandparent', 'sibling', 'child', 'grandchild', 'relative'].includes(n.role));
  for (const n of people) {
    if (!isBiological(n) && n.role === 'parent') { rows.push({ npcId: n.id, who: `${roleLabel(n)} ${n.firstName}`, step: true, conds: [] }); continue; }
    if (n.adopted || (n.role === 'child' && n.adopted)) continue;
    const conds = knownHealth(n).map((c) => ({ id: c.id, name: nameIn(CONDITION_BY_ID[c.id], store.state.year) ?? CONDITION_BY_ID[c.id].name, age: c.age }));
    rows.push({ npcId: n.id, who: `${roleLabel(n)} ${n.firstName}`, alive: n.alive, conds, ancestor: !!n.flags.ancestor });
  }
  const parents = people.filter((n) => n.role === 'parent' && isBiological(n));
  const unknown = [];
  if (!parents.some((n) => (n.flags.bornAs ?? n.gender) === 'male')) unknown.push('Your father\'s side of the family');
  if (!parents.some((n) => (n.flags.bornAs ?? n.gender) === 'female')) unknown.push('Your mother\'s side of the family');
  return { rows, unknown, screening: screening(rows, p) };
}

/** Testing and earlier assessment worth considering, given what is known in the family. */
function screening(rows, p) {
  const known = new Set(rows.flatMap((r) => r.conds.map((c) => c.id)));
  const out = [];
  for (const [key, gene] of Object.entries(GENES)) {
    if (!known.has(gene.condition)) continue;
    const done = healthOf(p).genetic.tested[key];
    const predictive = gene.pattern === 'dominant';
    if (predictive && p.age < 18) continue;
    out.push({ key, condition: gene.condition, name: CONDITION_BY_ID[gene.condition].name, kind: predictive ? 'predictive' : 'carrier', done: done?.result ?? null,
      text: predictive ? 'A predictive genetic test, with counselling before and after. Some people want to know; many decide not to. Both are reasonable.' : 'A carrier test: whether you carry a variant you could pass on, and what that would mean.' });
  }
  for (const id of ['adhd', 'autism', 'bipolar_1', 'bipolar_2', 'mdd']) if (known.has(id)) out.push({ key: `aware_${id}`, condition: id, name: CONDITION_BY_ID[id].name, kind: 'awareness', text: `It runs in families to a degree. It is no reason to expect it, only a reason to ask for an assessment sooner if things fit.` });
  return out;
}

/** A genetic test after counselling. The result is the player's alone. */
export function geneTest(key, p = player()) {
  const h = healthOf(p);
  const gene = GENES[key];
  if (!gene) return result(false, 'Unknown test.', 'neutral');
  if (h.genetic.tested[key]) return result(false, 'You have already had that test.', 'neutral');
  if (store.state.year < 1993 && key === 'hd') return result(false, 'There is no reliable test for this yet.', 'neutral');
  charge(`gene:${key}`, 600, { what: 'Genetic counselling and test' });
  const g = genomeOf(p);
  const has = affected(g, key, seeded('pen', key, p.id)) || (gene.pattern === 'dominant' && (g.a[key] ?? []).some((x) => x));
  const res = gene.pattern === 'dominant' ? (has ? 'has the variant' : 'does not have the variant') : carrierOf(g, key) ? 'carrier' : has ? 'affected' : 'not a carrier';
  h.genetic.tested[key] = { result: res, wk: now(p) };
  const text = {
    'has the variant': 'The counsellor goes through it slowly. You carry the variant. It says nothing about who you are, or the life you have still to live, and support is there when you want it.',
    'does not have the variant': 'You do not carry the variant. The counsellor makes sure you have someone to talk to: relief can be complicated too.',
    carrier: `You are ${gene.carrierName}. It does not affect your own health. It matters for children only if their other parent is a carrier too, and the counsellor explains how.`,
    'not a carrier': 'You are not a carrier.',
    affected: 'The test confirms what you already knew.',
  }[res];
  return result(true, text, 'neutral');
}

/** For a descendant: a person's shareable health history, without notes, therapy or prescriptions. */
export function legacySummary(p) {
  const h = p.health;
  if (!h) return { v: 1, conds: [], last: p.age };
  return { v: 1, last: p.age, conds: h.conditions.filter((c) => c.status !== 'historical').map((c) => ({ id: c.conditionId, age: c.onsetAge,
    diagnosed: !!h.diagnoses.find((d) => d.underlyingId === c.id && d.status === 'active'),
    shared: c.sharedWithFamily || ['sensory', 'mobility', 'genetic'].includes(CONDITION_BY_ID[c.conditionId].group) })) };
}

// ---------- Event hooks ----------

/**
 * The `health` effect in story events (data/events/health.js). Only these
 * actions exist; an event can never prescribe, diagnose or end treatment.
 * @returns {string} a note to add to the outcome text, or ''
 */
export function healthEffect(v, ctx = {}) {
  const p = player();
  const h = healthOf(p);
  switch (v.do) {
    case 'note': lifeNote(v.topic, v.text, p); return '';
    case 'skill': {
      const k = v.skill;
      if (h.skills[k] != null) h.skills[k] = Math.min(100, Math.round((h.skills[k] + (v.amount ?? 1)) * 10) / 10);
      lifeNote(v.topic ?? 'skill', v.text ?? 'using a skill in a hard moment', p);
      return '';
    }
    case 'stress': h.wellbeing.stress = Math.max(0, Math.min(100, h.wellbeing.stress + v.delta)); return '';
    case 'seek': {
      if (h.appointments.some((a) => a.status === 'booked' && a.kind === 'assessment')) return 'You already have an appointment coming up.';
      const concern = v.concern === 'auto' ? autoConcern(p) : v.concern;
      const opt = serviceOptions(concern, p).find((o) => !o.referral);
      if (!opt) return 'There is nowhere nearby to go for this yet.';
      const r = seekAssessment(concern, opt.facilityId, opt.profession, p);
      if (r.ok && v.urgent) { const a = r.appt; a.wk = now(p) + 1; }
      return r.ok ? r.text : '';
    }
    case 'sensitive': h.settings.sensitive = v.value; return '';
    case 'tell': {
      // Telling someone in a scene: the first diagnosis they do not know about yet, and only that.
      const npc = store.state.npcs[ctx.cast?.[v.with]];
      const dx = h.diagnoses.find((d) => d.status === 'active' && !(h.conditions.find((c) => c.id === d.underlyingId)?.disclosedTo ?? []).includes(npc?.id));
      if (!npc || !dx) return '';
      tell(npc.id, dx.id, p);
      return '';
    }
    case 'admit': admit(v.reason, {}, p); return '';
    case 'accommodate': {
      const r = requestAccommodation(v.setting, v.type, v.need, p);
      return r.ok ? '' : r.text;
    }
    case 'childAssess': {
      // A parent arranges an assessment for their child. What is found is the child's, and recorded on them.
      const kid = store.state.npcs[ctx.cast?.[v.with]];
      const c = kid ? npcHealth(kid)?.conds.find((x) => x.id === kid.flags.noticedHealth) : null;
      if (!c) return '';
      c.diagnosed = true; c.shared = true;
      kid.flags.support = c.id;
      return `The assessment finds ${nameIn(CONDITION_BY_ID[c.id], store.state.year)}. It explains a lot, and it changes nothing about who ${kid.firstName} is. School puts support in place.`;
    }
    default: return '';
  }
}

/** Which kind of assessment fits what is going on, for a scene that does not say. */
function autoConcern(p) {
  const recs = presentConditions(p.health).filter((c) => !diagnosisFor(c, p.health) && CONDITION_BY_ID[c.conditionId].group === 'neurodev');
  if (recs.some((c) => CONDITION_BY_ID[c.conditionId].learning && CONDITION_BY_ID[c.conditionId].learning !== 'language')) return 'learning';
  if (recs.some((c) => c.conditionId === 'adhd')) return 'attention';
  return recs.length ? 'development' : 'mental';
}

/** Paths story events can test (see SPECIAL in engine/conditions.js). */
export const HEALTH_PATHS = {
  /** Domains where something unrecognised is affecting daily life. */
  healthSigns: (p) => {
    if (!p.health) return [];
    const out = new Set();
    for (const rec of presentConditions(p.health)) {
      if (diagnosisFor(rec, p.health) || rec.burden < 30 || (rec.showsAge != null && p.age < rec.showsAge)) continue;
      out.add(CONDITION_BY_ID[rec.conditionId].group);
    }
    return [...out];
  },
  diagnosed: (p) => (p.health ? p.health.diagnoses.filter((d) => d.status === 'active').map((d) => d.conditionId) : []),
  inCare: (p) => !!p.health && (p.health.therapies.some((c) => c.status === 'active') || p.health.trials.some((t) => ['active', 'adjusted', 'under_review'].includes(t.status))),
  sensitiveOk: (p) => (p.health?.settings.sensitive ?? 'full') === 'full',
  hardStretch: (p) => !!p.health && presentConditions(p.health).some((c) => MENTAL.includes(CONDITION_BY_ID[c.conditionId].group) && c.burden >= 70),
  wheelchairBarrier: (p) => !!p.health && presentConditions(p.health).some((c) => (CONDITION_BY_ID[c.conditionId].supports ?? []).includes('wheelchair')),
  /** Came through a hard stretch in the last year: a mental health condition went into remission. */
  recovering: (p) => !!p.health && p.health.conditions.some((c) => MENTAL.includes(CONDITION_BY_ID[c.conditionId].group) && c.remissionWk != null && now(p) - c.remissionWk <= 52 && diagnosisFor(c, p.health)),
  /** A diagnosis nobody in the player's life has been told about yet. */
  untold: (p) => !!p.health && p.health.diagnoses.some((d) => d.status === 'active' && !(p.health.conditions.find((c) => c.id === d.underlyingId)?.disclosedTo ?? []).length),
  /** Deaf or hard of hearing. */
  hearing: (p) => !!p.health && presentConditions(p.health).some((c) => ['deaf', 'hearing_loss'].includes(c.conditionId) && (c.showsAge == null || p.age >= c.showsAge)),
  /** Some sensory needs in everyday life (autistic, or sensory needs recorded). */
  sensory: (p) => !!p.health && (presentConditions(p.health).some((c) => c.conditionId === 'autism' && diagnosisFor(c, p.health)) || !!p.health.supports.needs.sensory?.self),
  /** A care decision is waiting for the player. */
  decisionWaiting: (p) => !!p.health && p.health.proposals.some((x) => x.status === 'open'),
};

/** A price for display. */
export const testPrice = () => priceOf(600);
