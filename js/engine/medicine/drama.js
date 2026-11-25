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
import { store, player } from '../../state.js';
import { remember } from '../conditions.js';
import { askOut, partner } from '../romance.js';
import { M, med, year, grow, note, result, roll } from './core.js';
import { answerOffer } from './ladder.js';

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
  const thanks = (m.grateful ?? []).find((g) => g.year <= year() - 3 && !g.thanked);
  if (thanks) out.push({ id: 'med_grateful', cast: { words: { label: thanks.label.toLowerCase(), key: `${thanks.patientId}` } } });
  return out;
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
  const must = list.filter((x) => ['med_disclosure', 'med_grateful'].includes(x.id));
  const rest = list.filter((x) => !must.includes(x)).sort(() => rng.next() - 0.5).slice(0, n);
  for (const x of [...must.slice(0, 1), ...rest]) {
    m.scenes[x.id] = year();
    store.state.pendingEvents.push({ id: x.id, cast: x.cast });
  }
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
    default: return '';
  }
}

