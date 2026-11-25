// Hospital life: the people a physician trains and works with, and what happens between them.
// Mentors, rivals, friends, competition for chief resident and fellowships, romance between
// colleagues, leadership offers, and the patients who come back into a life years later.
//
// Every person here is an ordinary NPC (the same people the People tab shows), met through the
// workplace (engine/workplace.js). The characters are the game's own.
//
// Rules the scenes keep:
//   - Romance is only ever offered between consenting adult peers. Never with someone the player
//     supervises or is supervised by, and never with a patient (patients are not people the player
//     "knows": see engine/medicine/cases.js).
//   - The drama setting (low, balanced, high) changes how often these scenes come, never how
//     patients fare: no scene here touches a case's outcome.
//   - A grateful former patient appears only as "a former patient"; nothing of their case reaches
//     the life story.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player, log } from '../../state.js';
import { remember } from '../conditions.js';
import { askOut, partner } from '../romance.js';
import { M, med, year, grow, note, result, roll, once, currentSpecialty, reputationOf } from './core.js';
import { answerOffer } from './ladder.js';
import { startPost } from './training.js';
import { doResearch } from './research.js';
import { employer, chronicle } from '../employers.js';
import { SPECIALTY_BY_ID, DEPARTMENTS } from '../../data/medicine.js';
import { workplacesFor, hospital, hospitalsIn } from './hospitals.js';
import { citiesOf, relocate, moveCost } from '../cities.js';
import { changeHours, takeLeave } from '../worklife.js';

export const DRAMA = { low: 0.25, balanced: 0.6, high: 1 };
export function setDrama(level) {
  if (!(level in DRAMA)) return result(false, 'There is no such setting.', 'neutral');
  M().drama = level;
  return result(true, `Hospital drama: ${level}. Patients fare the same either way.`, 'neutral');
}

const npc = (id) => (id ? store.state.npcs[id] : null);
const alive = (n) => n?.alive && player().npcIds.includes(n.id);
const peers = (m) => m.people.colleagueIds.map(npc).filter((n) => alive(n) && n.flags.medRole === 'peer');
const supervisors = (m) => m.people.supervisorIds.map(npc).filter(alive);

/** Whether two people could be together without a power problem: adults, peers, nobody supervising the other. */
export function romanceAllowed(n, m = med()) {
  const p = player();
  if (!n || n.age < 18 || p.age < 18) return false;
  if (n.flags.patient || n.flags.medRole === 'supervisor' || m?.people.supervisorIds.includes(n.id)) return false;
  if (n.flags.medRole === 'trainee') return false; // someone the player supervises
  if (['spouse', 'partner', 'parent', 'child', 'sibling'].includes(n.role)) return false;
  return !partner();
}

/** The scenes that could come this year, given who is around. */
function eligible(p, m) {
  const out = [];
  const t = m.training;
  const ps = peers(m);
  const sup = supervisors(m)[0];
  if ((t || m.job) && sup && !m.people.mentorId && sup.meters.relationship >= 45) out.push({ id: 'med_mentor', cast: { mentor: sup.id } });
  if (ps.length && !m.people.rivalIds.length && (t?.pgy ?? 0) >= 1) out.push({ id: 'med_rival', cast: { rival: rng.pick(ps).id } });
  const friend = ps.find((n) => !m.people.friendIds.includes(n.id) && !m.people.rivalIds.includes(n.id));
  if (friend) out.push({ id: 'med_friend', cast: { peer: friend.id } });
  const crush = ps.find((n) => romanceAllowed(n, m) && !m.people.rivalIds.includes(n.id) && !n.flags.medAsked);
  if (crush && !partner() && p.age >= 22) out.push({ id: 'med_romance', cast: { peer: crush.id } });
  const rival = npc(m.people.rivalIds[0]);
  if (t?.kind === 'residency' && t.pgy >= t.years - 1 && alive(rival)) out.push({ id: 'med_competition', cast: { rival: rival.id } });
  const recent = (m.caseIds ?? []).map((id) => store.state.medicine?.cases?.[id]).filter((c) => c && c.status === 'closed' && c.year >= year() - 1 && c.outcome?.points < 40 && !c.disclosed);
  if (recent.length) out.push({ id: 'med_disclosure', cast: { words: { caseId: recent[0].id } } });
  // Strain: a hard year is met with support, never pushed through for a reward.
  if ((m.training || m.job) && (p.career.stress ?? 0) >= 80) out.push({ id: 'med_strain', cast: {} });
  // An offer from a hospital in another city, for an established attending.
  if (m.job && year() - m.job.since >= 3 && !m.awayOffer && roll(0.25)) {
    const spec = currentSpecialty(m);
    const away = citiesOf(p.countryId).filter((c) => c.name !== p.city).flatMap((c) => workplacesFor(spec, p.countryId, c.name).map((x) => ({ ...x, city: c.name })));
    if (away.length) {
      const o = rng.pick(away);
      m.awayOffer = { hospitalId: o.e.id, city: o.city, year: year() };
      out.push({ id: 'med_offer_away', cast: { words: { hospital: o.e.name, city: o.city } } });
    }
  }
  // The old team, years later.
  const first = m.completed[0];
  const old = [...m.people.friendIds, ...m.people.colleagueIds].map(npc).find((n) => n?.alive);
  if (first && year() - first.to >= 10 && old) out.push({ id: 'med_reunion', cast: { peer: old.id, words: { hospital: first.hospital ?? 'the hospital' } } });
  // The wider catalog of hospital life: people, judgment and ethics.
  const peer = rng.pick(ps.length ? ps : [null]);
  const friendNow = m.people.friendIds.map(npc).find(alive);
  const spec = SPECIALTY_BY_ID[currentSpecialty(m)];
  if (t && peer) out.push({ id: 'med_talked_about', cast: { peer: peer.id } });
  if (spec?.surgical && (t || m.job)) out.push({ id: 'med_or_disagreement', cast: {} });
  if (t && sup && peer) out.push({ id: 'med_attending_choice', cast: { mentor: sup.id, peer: peer.id, words: { chosen: roll(clamp(reputationOf(m) / 100, 0.2, 0.8)) ? 'you' : 'them' } } });
  if (t && friendNow && t.pgy >= 2) out.push({ id: 'med_friend_pressure', cast: { peer: friendNow.id } });
  if (m.job && roll(0.15)) out.push({ id: 'med_new_chief', cast: {} });
  const pt = partner();
  if (pt && (m.job || t) && pt.flags.workedWith && pt.flags.workedWith === employer(m.job?.hospitalId ?? t?.hospitalId)?.name && !pt.flags.medDisclosed) out.push({ id: 'med_work_relationship', cast: { peer: pt.id } });
  if (friendNow && (m.job || t)) out.push({ id: 'med_colleague_leaving', cast: { peer: friendNow.id } });
  if (m.job && friendNow) out.push({ id: 'med_friend_promoted', cast: { peer: friendNow.id } });
  const mentorNow = npc(m.people.mentorId);
  if (alive(mentorNow) && mentorNow.age >= 63 && !mentorNow.flags.medRetired) out.push({ id: 'med_mentor_retiring', cast: { mentor: mentorNow.id } });
  const sad = (m.caseIds ?? []).map((id) => store.state.medicine?.cases?.[id]).find((c) => c?.status === 'closed' && c.year >= year() - 1 && c.outcome?.result === 'poor' && c.outcome.points >= 60);
  if (sad) out.push({ id: 'med_family_answers', cast: {} });
  if (m.job && hospital(m.job.hospitalId)?.teaching && !(m.research?.projects?.length)) out.push({ id: 'med_research_offer', cast: {} });
  if (m.job && year() - m.job.since >= 3) out.push({ id: 'med_department_divided', cast: {} });
  if (m.job) out.push({ id: 'med_industry_gift', cast: {} });
  if (t || m.job) out.push({ id: 'med_alter_record', cast: {} });
  const thanks = (m.grateful ?? []).find((g) => g.year <= year() - 3 && !g.thanked);
  if (thanks) out.push({ id: 'med_grateful', cast: { words: { label: thanks.label.toLowerCase(), key: `${thanks.patientId}` } } });
  return out;
}

/**
 * The hospital goes on living whether or not the player does anything: it grows or tightens its
 * belt, opens departments, and colleagues make their own choices (some leave for other posts).
 * Each event is written in the hospital's own chronicle (engine/employers.js), never invented twice.
 */
export function hospitalYear() {
  const p = player();
  const m = med();
  const id = m?.job?.hospitalId ?? m?.training?.hospitalId;
  if (!id) return;
  const e = employer(id);
  const h = hospital(e);
  if (!e || !h) return;
  const seen = (h.events ??= {});
  if (seen[year()]) return;
  seen[year()] = true;
  const r = rng.next();
  if (r < 0.08) {
    h.resources = clamp(h.resources + 5);
    chronicle(e, `${e.name} opened a new wing.`);
    log(`${e.name} opened a new wing this year: more beds, newer equipment.`, 'system', 'good');
  } else if (r < 0.16) {
    h.resources = clamp(h.resources - 4);
    chronicle(e, `${e.name} went through a year of staff shortages.`);
    store.state.pendingEvents.push({ id: 'med_staffing_shortage', cast: { words: { hospital: e.name } } });
  } else if (r < 0.22) {
    chronicle(e, `${e.name} cut its budget across departments.`);
    store.state.pendingEvents.push({ id: 'med_budget_dispute', cast: { words: { hospital: e.name } } });
  } else if (r < 0.27) {
    const missing = Object.keys(DEPARTMENTS).filter((d) => !h.depts.includes(d) && !['nicu', 'peds_surgery'].includes(d));
    if (missing.length && h.kind !== 'clinic') {
      const d = rng.pick(missing);
      h.depts.push(d);
      chronicle(e, `${e.name} founded a department of ${DEPARTMENTS[d]}.`);
      log(`${e.name} founded a new department: ${DEPARTMENTS[d]}.`, 'system', 'neutral');
    }
  }
  // Colleagues decide for themselves: now and then one takes a post elsewhere in the country.
  for (const n of [...m.people.colleagueIds, ...m.people.friendIds].map(npc)) {
    if (!n?.alive || n.life?.job?.employerId !== id || n.id === m.people.mentorId || !roll(0.06)) continue;
    const away = citiesOf(e.countryId).filter((c) => c.name !== e.city);
    if (!away.length) continue;
    const city = rng.pick(away).name;
    const other = hospitalsIn(e.countryId, city).find(({ h: oh }) => oh.kind !== 'clinic');
    if (!other) continue;
    n.life.job.employerId = other.e.id;
    e.staff = e.staff.filter((x) => x !== n.id);
    other.e.staff.push(n.id);
    n.flags.workedWith = other.e.name;
    chronicle(e, `${n.firstName} ${n.lastName} left for ${other.e.name}.`);
    log(`${n.firstName} ${n.lastName} has taken a post at ${other.e.name}, in ${city}. The farewell drinks run late.`, 'system', 'neutral');
  }
}

/** Queues this year's hospital scenes, as often as the drama setting asks. Once a year. */
export function dramaYear() {
  const p = player();
  const m = med();
  if (!m || (!m.training && !m.job && !m.clinicIds.length)) return;
  const rate = DRAMA[m.drama] ?? DRAMA.balanced;
  const list = eligible(p, m).filter((x) => (m.scenes[x.id] ?? -99) < year() - 2);
  if (!list.length) return;
  const n = rate >= 1 ? 2 : roll(rate) ? 1 : 0;
  // A disclosure or a thank-you comes whatever the setting: they are about patients, not drama.
  const must = list.filter((x) => ['med_disclosure', 'med_grateful', 'med_strain', 'med_offer_away'].includes(x.id));
  const rest = list.filter((x) => !must.includes(x)).sort(() => rng.next() - 0.5).slice(0, n);
  for (const x of [...must.slice(0, 2), ...rest]) {
    m.scenes[x.id] = year();
    store.state.pendingEvents.push({ id: x.id, cast: x.cast });
  }
}

/** Asks for support in a hard year: once a year, from a mentor or the program. Never a weakness. */
export function requestSupport() {
  const m = M();
  if (!once('support', m)) return result(false, 'You have asked this year; the support is in place.', 'neutral');
  return result(true, medicineChoice('strain:support'), 'good');
}

/** What a hospital scene's choice does (effect type 'medicine', engine/effects.js). */
export function medicineChoice(value, cast = {}) {
  const p = player();
  const m = M();
  const [what, how] = String(value).split(':');
  const who = npc(cast.mentor ?? cast.rival ?? cast.peer);
  switch (what) {
    case 'mentor':
      if (how === 'yes' && who) {
        m.people.mentorId = who.id;
        who.flags.mentor = true;
        who.flags.title = 'Mentor';
        who.meters.relationship = clamp(who.meters.relationship + 12);
        remember(who, 'medMentor', 'They took you on as a mentee during your training.');
        grow('reasoning', 2, m); grow('professionalism', 1, m);
        note(`${who.firstName} ${who.lastName} became your mentor.`, 'people', { log: false });
        return '';
      }
      return '';
    case 'rival':
      if (!who) return '';
      if (how === 'compete') { m.people.rivalIds.push(who.id); who.flags.title = 'Rival'; who.meters.relationship = clamp(who.meters.relationship - 10); grow('reasoning', 1, m); return ''; }
      if (how === 'ally') { m.people.friendIds.push(who.id); who.meters.relationship = clamp(who.meters.relationship + 10); grow('teamwork', 2, m); return ''; }
      return '';
    case 'friend':
      if (who && how === 'yes') { m.people.friendIds.push(who.id); who.meters.relationship = clamp(who.meters.relationship + 12); grow('teamwork', 1, m); }
      return '';
    case 'romance': {
      if (!who) return '';
      who.flags.medAsked = true;
      if (how !== 'ask') return '';
      if (!romanceAllowed(who, m)) return 'You think better of it: it would not be fair to either of you.';
      // They answer for themselves (engine/romance.js): yes makes them a partner like anyone else.
      const r = askOut(who.id);
      if (!r.ok) return '';
      note(`Began seeing ${who.firstName} ${who.lastName}, a colleague.`, 'people', { log: false });
      return 'You agree to keep it out of the hospital.';
    }
    case 'compete':
      if (how === 'fair') { grow('integrity', 1, m); grow('reasoning', 1, m); return ''; }
      if (how === 'undercut') { grow('integrity', -4, m); grow('professionalism', -2, m); if (who) who.meters.relationship = clamp(who.meters.relationship - 20); return 'It works, for now. People noticed.'; }
      return '';
    case 'disclose': {
      const c = store.state.medicine?.cases?.[cast.words?.caseId];
      if (c) c.disclosed = true;
      if (how === 'yes') { grow('integrity', 3, m); grow('communication', 1, m); return 'The family is upset, and grateful you told them. The hospital reviews it, fairly.'; }
      grow('integrity', -5, m);
      if (roll(0.35)) { m.discipline.push({ year: year(), what: 'A case review found an outcome that was not disclosed to the family.' }); return 'Months later the review finds it. The silence is what goes on your record.'; }
      return '';
    }
    case 'grateful': {
      const g = (m.grateful ?? []).find((x) => `${x.patientId}` === cast.words?.key);
      if (g) g.thanked = true;
      p.stats.mood = clamp(p.stats.mood + 8);
      return '';
    }
    case 'offer': return answerOffer(how === 'yes').text;
    case 'skill': {
      // A story beat's lesson: 'skill:<name>:<amount>' (and the premed interview, 'skill:interview:<amount>').
      const [, by] = String(value).split(':').slice(1);
      if (how === 'interview') { m.premed.letters = Math.round((m.premed.letters + Number(by)) * 10) / 10; return ''; }
      if (how in m.skills) grow(how, Number(by), m);
      return '';
    }
    case 'strain': {
      if (how === 'support') {
        p.career.stress = clamp((p.career.stress ?? 50) - 15);
        const mentor = npc(m.people.mentorId);
        if (mentor?.alive) mentor.meters.relationship = clamp(mentor.meters.relationship + 4);
        grow('professionalism', 1, m);
        return mentor?.alive ? `${mentor.firstName} listens, then helps you rearrange the next month.` : 'The program\'s wellbeing service finds you an hour a week, and a colleague swaps two of your nights.';
      }
      if (how === 'hours') return changeHours(-10).text;
      if (how === 'leave') return takeLeave('vacation').text;
      return '';
    }
    case 'away': {
      const o = m.awayOffer;
      if (!o) return '';
      m.awayOffer = null;
      if (how === 'accept') {
        const spec = currentSpecialty(m);
        const rank = m.job?.rank ?? 'attending';
        p.finance.cash += moveCost();
        const r = relocate(o.city);
        if (!r.ok) { p.finance.cash -= moveCost(); return `The move fell through: ${r.text}`; }
        startPost(spec, o.hospitalId, rank);
        return `You move to ${o.city} and start at the new hospital.`;
      }
      if (how === 'negotiate') {
        if (roll(0.5)) { p.career.salary = Math.round(p.career.salary * 1.08); return 'Your hospital matches part of the offer to keep you. You stay, better paid.'; }
        return 'Your hospital will not match it. You stay, for now.';
      }
      if (how === 'family') { const pt = partner(); if (pt) pt.meters.relationship = clamp(pt.meters.relationship + 6); p.stats.mood = clamp(p.stats.mood + 4); }
      return '';
    }
    case 'reunion':
      if (how === 'go' && who) { who.meters.relationship = clamp(who.meters.relationship + 12); p.stats.mood = clamp(p.stats.mood + 5); }
      return '';
    case 'talk': {
      // The rest of the hospital catalog: 'talk:<what>'. Relationships and skills move by how the player treats people.
      const by = { congratulate: ['teamwork', 1, 6], resent: ['professionalism', -1, -8], learn: ['reasoning', 1.5, 4], speak: ['reasoning', 1.5, 0], defer: [null, 0, 0],
        argue: ['professionalism', -2, 0], ask: ['professionalism', 1, 3], honest: ['communication', 1.5, 5], distance: [null, 0, -6], welcome: ['teamwork', 1, 0],
        encourage: ['integrity', 0.5, 8], stay: [null, 0, -2], farewell: ['communication', 1, 10], mediate: ['leadership', 2, 0], side: ['leadership', 0.5, 0],
        family: ['communication', 2, 0], letter: ['communication', 0.5, 0] }[how];
      if (!by) return '';
      if (by[0]) grow(by[0], by[1], m);
      if (who && by[2]) who.meters.relationship = clamp(who.meters.relationship + by[2]);
      if (how === 'farewell' && who) { who.flags.medRetired = true; who.flags.title = 'Mentor (retired)'; }
      if (how === 'learn' && who) remember(who, 'medTaught', 'Taught you what everyone was talking about.');
      return '';
    }
    case 'disclose_partner':
      if (who) who.flags.medDisclosed = true;
      if (how === 'yes') { grow('professionalism', 1, m); return 'The department moves your rotas so neither of you is ever in charge of the other. Nobody makes a fuss.'; }
      grow('integrity', -1, m);
      return '';
    case 'research':
      if (how === 'join') return doResearch('project').text;
      return '';
    case 'gift':
      if (how === 'decline') { grow('integrity', 1, m); return 'You decline. Your prescribing stays yours.'; }
      grow('integrity', -3, m);
      if (roll(0.3)) { m.discipline.push({ year: year(), what: 'Accepted hospitality from a company whose products you prescribe, against hospital policy.' }); return 'A compliance review finds it. It goes on your record.'; }
      return 'The trip is lovely. You notice, later, how often their name comes to mind.';
    case 'record':
      if (how === 'refuse') { grow('integrity', 3, m); grow('professionalism', 1, m); return 'You refuse, and say why. The note stays as it was written; the review is fair.'; }
      grow('integrity', -6, m);
      if (roll(0.5)) { m.discipline.push({ year: year(), what: 'Altered a medical record after the fact.' }); return 'The audit trail shows the change. Altering a record is a serious matter, and it is treated as one.'; }
      return 'Nobody notices. You do.';
    case 'politics': {
      // Institutional pressure, met one way or another; none of it is a shortcut.
      const by = { cover: ['teamwork', 1.5], escalate: ['leadership', 1.5], cut: ['management', 1], protect: ['leadership', 1], data: ['management', 1.5] }[how];
      if (by) grow(by[0], by[1], m);
      if (how === 'cover') p.career.stress = clamp((p.career.stress ?? 50) + 6);
      return '';
    }
    case 'calling':
      if (how === 'drawn') p.flags.medCalling = true;
      return '';
    default: return '';
  }
}

