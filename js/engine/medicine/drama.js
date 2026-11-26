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
import { askOut, partner, breakUp } from '../romance.js';
import { recordEvent } from '../chronicle.js';
import { endJob } from '../career.js';
import { M, med, year, grow, note, result, roll, once, currentSpecialty, reputationOf } from './core.js';
import { answerOffer } from './ladder.js';
import { startPost } from './training.js';
import { doResearch } from './research.js';
import { practices } from './practice.js';
import * as biz from '../business.js';
import { employer, chronicle } from '../employers.js';
import { SPECIALTY_BY_ID, DEPARTMENTS } from '../../data/medicine.js';
import { workplacesFor, hospital, hospitalsIn } from './hospitals.js';
import { staffOf } from '../workplace.js';
import { citiesOf, relocate, moveCost } from '../cities.js';
import { changeHours, takeLeave } from '../worklife.js';
import { storyBeat, dramaSetting } from '../storyDirector.js';
import { familyPatientChoice } from './healthLink.js';
import { kinAilmentChoice } from '../health/kinAilments.js';
import { startCare } from '../health/kincare.js';

export const DRAMA = { low: 0.25, balanced: 0.6, high: 1 };
/** The drama setting is the life's own (Settings, Story drama): the same for hospital life as for every other story. */
export function setDrama(level) {
  if (!(level in DRAMA)) return result(false, 'There is no such setting.', 'neutral');
  (store.state.settings ??= {}).drama = level;
  return result(true, `Story drama: ${level}. It paces every storyline in this life; patients fare the same either way.`, 'neutral');
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
  // A department head and someone in their department; an employer and someone who works for them.
  const h = m?.job ? hospital(m.job.hospitalId) : null;
  if (h && Object.values(h.heads).includes(n.id) && n.life?.job?.employerId === m.job.hospitalId) return false;
  if (h && ['chief', 'chair', 'cmo', 'ceo', 'director'].includes(m.job.rank) && n.life?.job?.employerId === m.job.hospitalId) return false;
  if (n.flags.employeeOf && (player().businesses ?? []).some((b) => b.id === n.flags.employeeOf)) return false;
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
  // Two hospitals, one relationship: a partner who is also a physician is offered a post in another city.
  const love = partner();
  if (love && (m.job || t) && ['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(love.life?.job?.careerId) && !m.partnerOffer && roll(0.2)) {
    const away = citiesOf(p.countryId).filter((c) => c.name !== p.city);
    if (away.length) {
      const city = rng.pick(away).name;
      const at = hospitalsIn(p.countryId, city).find(({ h: oh }) => oh.kind !== 'clinic');
      if (at) { m.partnerOffer = { npcId: love.id, hospitalId: at.e.id, city, year: year() }; out.push({ id: 'med_partner_offer', cast: { peer: love.id, words: { hospital: at.e.name, city } } }); }
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
  // Drug companies paying doctors to speak at conferences abroad: a postwar practice, from about the mid-1950s.
  if (m.job && year() >= 1955) out.push({ id: 'med_industry_gift', cast: {} });
  if (t || m.job) out.push({ id: 'med_alter_record', cast: {} });
  // Relationships at work, and their consequences years later.
  const hereNow = m.job?.hospitalId ?? t?.hospitalId;
  const ex = p.npcIds.map(npc).find((n) => n?.alive && n.role === 'ex' && n.life?.job?.employerId === hereNow);
  if (ex) out.push({ id: 'med_former_partner', cast: { peer: ex.id } });
  if (pt && pt.life?.job?.employerId === hereNow && (p.career.stress ?? 0) >= 60) out.push({ id: 'med_couple_schedules', cast: { peer: pt.id } });
  const struggling = ps.find((n) => !n.flags.medHelpedYear && (n.flags.medStruggling || roll(0.2)));
  if (struggling) out.push({ id: 'med_colleague_struggling', cast: { peer: struggling.id } });
  const back = [...m.people.friendIds, ...m.people.colleagueIds].map(npc).find((n) => n?.alive && n.flags.medLeftYear && year() - n.flags.medLeftYear >= 5 && n.life?.job && hereNow);
  if (back) out.push({ id: 'med_friend_returns', cast: { peer: back.id } });
  const senior = [...m.people.supervisorIds].map(npc).find((n) => n?.alive && n.life?.job?.employerId === hereNow && n.age >= p.age + 8);
  if (senior && roll(0.08)) out.push({ id: 'med_boundary', cast: { mentor: senior.id } });
  const fellOut = m.people.supervisorIds.map(npc).find((n) => n?.alive && (n.memories ?? []).some((x) => x.key === 'medDisagreed') && !n.flags.medReconciled && m.experience.years >= 6);
  if (fellOut) out.push({ id: 'med_reconcile', cast: { mentor: fellOut.id } });
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
    storyBeat('med_staffing_shortage', { words: { hospital: e.name } }, { source: 'medicine' });
  } else if (r < 0.22) {
    chronicle(e, `${e.name} cut its budget across departments.`);
    storyBeat('med_budget_dispute', { words: { hospital: e.name } }, { source: 'medicine' });
  } else if (r < 0.27) {
    const missing = Object.keys(DEPARTMENTS).filter((d) => !h.depts.includes(d) && !['nicu', 'peds_surgery'].includes(d));
    if (missing.length && h.kind !== 'clinic') {
      const d = rng.pick(missing);
      h.depts.push(d);
      chronicle(e, `${e.name} founded a department of ${DEPARTMENTS[d]}.`);
      log(`${e.name} founded a new department: ${DEPARTMENTS[d]}.`, 'system', 'neutral');
    }
  }
  // A department chief retires now and then, and a successor is chosen from the department's senior physicians
  // (or offered to the player, if they are eligible: engine/medicine/ladder.js answers the offer).
  const dept = SPECIALTY_BY_ID[currentSpecialty(m)]?.dept;
  const headId = dept ? h.heads[dept] : null;
  const head = headId ? npc(headId) : null;
  if (head?.alive && head.age >= 60 && roll(0.12)) {
    head.flags.title = `Retired chief of ${DEPARTMENTS[dept]}`;
    if (head.life?.job) head.life.job = null;
    const eligible = m.job && ['senior', 'director'].includes(m.job.rank) && m.skills.leadership >= 55 && m.reputation >= 60;
    if (eligible) {
      m.offer = { rank: 'chief', year: year(), hospitalId: id };
      delete h.heads[dept];
      chronicle(e, `${head.firstName} ${head.lastName} retired as chief of ${DEPARTMENTS[dept]}; the search for a successor began.`);
      log(`${head.firstName} ${head.lastName} has retired as chief of ${DEPARTMENTS[dept]}, and the hospital has asked you to succeed them. Answer from My Medical Career.`, 'system', 'good');
    } else {
      const pool = staffOf(e).filter((n) => n.alive && n.id !== head.id && ['doctor', 'surgery', 'psychiatry', 'podiatrist'].includes(n.life?.job?.careerId) && (n.life.job.level ?? 0) >= 1);
      const next = pool.sort((a, b) => (b.meters.intellect ?? 0) - (a.meters.intellect ?? 0))[0] ?? null;
      if (next) {
        h.heads[dept] = next.id; next.flags.title = `Chief of ${DEPARTMENTS[dept]}`; next.life.job.level = 3;
        // What happened between them before matters now (the actual memory, never an invented one).
        if ((next.memories ?? []).some((x) => x.key === 'medHelped')) log(`${next.firstName} ${next.lastName}, the new chief, has not forgotten that you helped them through a hard year. Their door is open to you.`, 'system', 'good');
        else if (m.people.rivalIds.includes(next.id)) log(`${next.firstName} ${next.lastName}, your old rival, is your new chief. You are polite to each other.`, 'system', 'neutral');
      } else delete h.heads[dept];
      chronicle(e, `${head.firstName} ${head.lastName} retired as chief of ${DEPARTMENTS[dept]}${next ? `; ${next.firstName} ${next.lastName} succeeds them` : ''}.`);
      log(`${head.firstName} ${head.lastName} retired as chief of your department${next ? `. ${next.firstName} ${next.lastName} was chosen to succeed them` : ''}.`, 'system', 'neutral');
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
    n.flags.medLeftYear = year();
    chronicle(e, `${n.firstName} ${n.lastName} left for ${other.e.name}.`);
    log(`${n.firstName} ${n.lastName} has taken a post at ${other.e.name}, in ${city}. The farewell drinks run late.`, 'system', 'neutral');
  }
}

/** Queues this year's hospital scenes, as often as the drama setting asks. Once a year. */
export function dramaYear() {
  const p = player();
  const m = med();
  if (!m || (!m.training && !m.job && !m.clinicIds.length)) return;
  const rate = DRAMA[dramaSetting()] ?? DRAMA.balanced;
  const list = eligible(p, m).filter((x) => (m.scenes[x.id] ?? -99) < year() - 2);
  if (!list.length) return;
  const n = rate >= 1 ? 2 : roll(rate) ? 1 : 0;
  // A disclosure or a thank-you comes whatever the setting: they are about patients, not drama.
  const must = list.filter((x) => ['med_disclosure', 'med_grateful', 'med_strain', 'med_offer_away', 'med_partner_offer'].includes(x.id));
  const rest = list.filter((x) => !must.includes(x)).sort(() => rng.next() - 0.5).slice(0, n);
  for (const x of [...must.slice(0, 2), ...rest]) {
    m.scenes[x.id] = year();
    storyBeat(x.id, x.cast, { source: 'medicine', must: must.includes(x) });
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
        return mentor?.alive ? `${mentor.firstName} listens, then helps you rearrange the next month.` : 'Someone senior in the program makes time for you, and a colleague swaps two of your nights.';
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
    case 'partnerOffer': {
      const o = m.partnerOffer;
      m.partnerOffer = null;
      const love = npc(o?.npcId);
      if (!o || !love?.alive) return '';
      if (how === 'follow') {
        // Moving together: the partner takes the post; the player looks for one there (it is not guaranteed).
        love.life.job.employerId = o.hospitalId;
        p.finance.cash += moveCost();
        const r = relocate(o.city);
        if (!r.ok) { p.finance.cash -= moveCost(); return `The move fell through: ${r.text}`; }
        love.meters.relationship = clamp(love.meters.relationship + 10);
        const spec = currentSpecialty(m);
        const there = spec ? workplacesFor(spec, p.countryId, o.city).find(({ e: oe }) => oe.id !== o.hospitalId) ?? workplacesFor(spec, p.countryId, o.city)[0] : null;
        if (there && m.job && roll(0.6)) { startPost(spec, there.e.id, m.job.rank); return `You move to ${o.city} together. ${there.e.name} has a post for you too.`; }
        if (m.job) { m.job = null; endJob('moved with their partner'); }
        return `You move to ${o.city} together, and leave your post. You will need to find one there: My Medical Career, Find a Post.`;
      }
      if (how === 'stay') { love.meters.relationship = clamp(love.meters.relationship - 4); return `${love.firstName} turns it down. It was their decision, and they made it; it still stings a little.`; }
      if (how === 'talk') { love.meters.relationship = clamp(love.meters.relationship + 3); return `You talk it through for a week. ${love.firstName} decides to wait for something closer to home.`; }
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
      if (how === 'argue') { const sup = npc(m.people.supervisorIds[0]); if (sup?.alive) remember(sup, 'medDisagreed', `Disagreed with you, sharply, in front of the team (${year()}).`); }
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
      if (how === 'decline') { grow('integrity', 1, m); return 'Your prescribing stays yours.'; }
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
    case 'story':
      if (how === 'teach') return doResearch('teach').text;
      if (how === 'expand') { const b = practices(m).find((x) => x.sites === 1); return b ? biz.expand(b).text : ''; }
      return '';
    case 'boundary': {
      // A senior colleague's unwanted attention. Setting a boundary or reporting it never costs the player anything;
      // there is no option to trade it for a career favor, because there is no such thing.
      if (!who) return '';
      who.flags.medBoundary = year();
      if (how === 'report') {
        who.flags.disciplined = (who.flags.disciplined ?? 0) + 1;
        who.meters.relationship = clamp(who.meters.relationship - 20);
        (store.state.medicine.reports ??= []).push({ npcId: who.id, year: year(), by: 'player' });
        return 'The hospital takes it seriously. A formal process begins, and you are kept out of their supervision from now on.';
      }
      who.meters.relationship = clamp(who.meters.relationship - 8);
      return 'You say it plainly. They step back, and it does not happen again.';
    }
    case 'help': {
      if (!who) return '';
      who.flags.medHelpedYear = year();
      if (how === 'yes') {
        who.meters.relationship = clamp(who.meters.relationship + 15);
        remember(who, 'medHelped', `You helped them through a hard year at ${employer(m.job?.hospitalId ?? m.training?.hospitalId)?.name ?? 'the hospital'} (${year()}).`);
        recordEvent({ key: `med:helped:${who.id}`, kind: 'medical_relationship', text: `Helped ${who.firstName} ${who.lastName} through a hard year.`, privacy: 'private', people: [who.id] });
        (m.people.allyIds ??= []).push(who.id);
        grow('teamwork', 1.5, m);
      }
      return '';
    }
    case 'exColleague':
      if (how === 'civil' && who) { who.meters.relationship = clamp(who.meters.relationship + 6); grow('professionalism', 1, m); }
      if (how === 'distance' && who) who.meters.relationship = clamp(who.meters.relationship - 4);
      return '';
    case 'schedules':
      if (how === 'talk' && who) { who.meters.relationship = clamp(who.meters.relationship + 8); p.career.stress = clamp((p.career.stress ?? 50) - 6); }
      return '';
    case 'reconcile':
      if (who) { who.flags.medReconciled = true; if (how === 'yes') { who.meters.relationship = clamp(who.meters.relationship + 15); remember(who, 'medReconciled', `Made peace with you, years after a disagreement (${year()}).`); } }
      return '';
    case 'familyPatient': return familyPatientChoice(how, npc(cast.who), startCare, cast.words?.condId);
    case 'familyAilment':
      // A relative's broken bone or bad flu: seen properly, a look and some advice, or treating family yourself (a boundary).
      if (how === 'seen') grow('professionalism', 1, m);
      if (how === 'self') grow('integrity', -1, m);
      return kinAilmentChoice(how, npc(cast.who), cast.words?.ailmentId);
    case 'calling':
      if (how === 'drawn') p.flags.medCalling = true;
      return '';
    default: return '';
  }
}


// ---------- Colleagues: what the player can do with the people of hospital life ----------

/** The actions open with a colleague, by who they are to the player. */
export function colleagueActions(npcId) {
  const m = med();
  const n = npc(npcId);
  if (!m || !alive(n)) return [];
  const done = (k) => m.acted.year === year() && !!m.acted[`col:${npcId}:${k}`];
  const out = [
    { id: 'time', label: 'Spend time together' },
    { id: 'career', label: 'Discuss your careers' },
    { id: 'gift', label: 'Give a small gift' },
  ];
  if (m.people.rivalIds.includes(npcId)) out.push({ id: 'reconcile', label: 'Try to make peace' });
  if (n.role === 'partner' || n.role === 'spouse') out.push({ id: 'talk', label: 'Discuss the relationship' }, { id: 'end', label: 'End the relationship' });
  else if (romanceAllowed(n, m) && n.meters.relationship >= 60) out.push({ id: 'date', label: 'Ask them on a date' });
  if (n.role === 'ex' || n.flags.medBoundary || n.meters.relationship < 30) out.push({ id: 'boundaries', label: 'Set boundaries' });
  return out.map((x) => ({ ...x, done: done(x.id) }));
}

/** Does one of them, once a year with each person. */
export function withColleague(npcId, action) {
  const p = player();
  const m = M();
  const n = npc(npcId);
  if (!alive(n)) return result(false, 'They are not someone you work with.', 'neutral');
  const o = colleagueActions(npcId).find((x) => x.id === action);
  if (!o) return result(false, 'That is not something you can do with them now.', 'neutral');
  if (!once(`col:${npcId}:${action}`, m)) return result(false, 'Not again this year.', 'neutral');
  const bump = (d) => { n.meters.relationship = clamp(n.meters.relationship + d); };
  switch (action) {
    case 'time': bump(6); p.stats.mood = clamp(p.stats.mood + 2); return result(true, `You and ${n.firstName} get dinner after a long shift. You talk about everything except work.`);
    case 'career': bump(4); grow('leadership', 0.5, m); return result(true, `${n.firstName} is honest about where they want to go, and asks the same of you. You both leave with something to think about.`);
    case 'gift': bump(3); return result(true, `A small thing, for no reason: ${n.firstName} is pleased. (A gift is kindness; it buys nothing, and nobody here would sell anything for one.)`);
    case 'reconcile': {
      if (!roll(clamp((n.meters.relationship + 30) / 100, 0.2, 0.85))) { bump(2); return result(false, `${n.firstName} listens, and is not ready. Perhaps another year.`); }
      m.people.rivalIds = m.people.rivalIds.filter((x) => x !== npcId);
      if (n.flags.title === 'Rival') n.flags.title = 'Colleague';
      bump(12); remember(n, 'medReconciled', `Made peace with you after years of rivalry (${year()}).`);
      return result(true, `You and ${n.firstName} agree that the rivalry has run its course. It is a relief to both of you.`);
    }
    case 'date': {
      if (!romanceAllowed(n, m)) return result(false, 'It would not be right: one of you has power over the other here.', 'neutral');
      const r = askOut(npcId);
      return r;
    }
    case 'talk': bump(5); p.career.stress = clamp((p.career.stress ?? 50) - 4); return result(true, `You talk about schedules, nights on call, and what each of you needs. It helps.`);
    case 'end': return breakUp(npcId);
    case 'boundaries': n.flags.medBoundary = year(); return result(true, `You tell ${n.firstName}, plainly and calmly, where the line is. They hear it.`, 'neutral');
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}
