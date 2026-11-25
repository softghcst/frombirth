// A physician's posts after training: attending, senior attending, medical director, chief of a
// service, department chair, chief medical officer. Pay runs through the ordinary career payroll
// (the rank maps to a level of the doctor, surgery, psychiatry or podiatry career); the medical
// engine decides the rank, by a yearly review built from how the physician practices.
//
// A leadership post needs a seat to be free and a selection; it is offered, never automatic, and
// the player may say no. Leaving the hospital (quitting, being let go, taking another job) ends
// the post; another hospital can be applied to from My Medical Career.
import { clamp } from '../../util.js';
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { makeNpc } from '../npcFactory.js';
import { remember } from '../conditions.js';
import { RANKS, SPECIALTY_BY_ID } from '../../data/medicine.js';
import { promote, endJob } from '../career.js';
import { employer, chronicle } from '../employers.js';
import { M, med, year, grow, note, result, roll, reputationOf, once, specialtyName, currentSpecialty, qualified } from './core.js';
import { hospital, deptOf, deptHead, workplacesFor, careerFor, levelFor } from './hospitals.js';
import { retitle, startPost } from './training.js';

const an = (w) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
const ORDER = ['attending', 'senior', 'director', 'chief', 'chair', 'cmo'];
/** What each step up asks: years at the rank below, reputation, leadership, and the kind of hospital. */
const STEPS = {
  senior: { from: 'attending', years: 5, rep: 52, lead: 0, odds: 0.45 },
  director: { from: 'senior', years: 3, rep: 58, lead: 45, odds: 0.22, leader: true },
  chief: { from: 'director', years: 3, rep: 62, lead: 55, odds: 0.18, leader: true },
  chair: { from: 'chief', years: 4, rep: 68, lead: 62, odds: 0.12, leader: true, kinds: ['academic', 'childrens'] },
  // A chief medical officer is chosen for running an organization, not for surgical fame: management counts.
  cmo: { from: 'chief', years: 5, rep: 70, lead: 68, mgmt: 65, odds: 0.08, leader: true },
};

/** The next step up from a rank, if this hospital has it. */
export function nextRank(job, h) {
  const opts = Object.entries(STEPS).filter(([, s]) => s.from === job.rank && (!s.kinds || s.kinds.includes(h.kind)));
  return opts.map(([id, s]) => ({ id, ...s }));
}

/** Takes a post offered by a hospital (or a leadership seat): the rank, the pay level, the title. */
function takeRank(p, m, rank) {
  const career = careerFor(m.job.specialtyId);
  const want = levelFor(rank, career);
  while (p.career.level < want && promote()) { /* the payroll level follows the rank */ }
  m.job.rank = rank;
  m.job.rankSince = year();
  retitle(p, m);
  if (ORDER.indexOf(rank) >= ORDER.indexOf(m.topRank ?? 'attending')) { m.topRank = rank; m.topTitle = p.career.title; }
  const e = employer(m.job.hospitalId);
  const h = hospital(e);
  // The people who were there at the start notice.
  const mentor = store.state.npcs[m.people.mentorId];
  if (RANKS[rank].leader && mentor?.alive) {
    mentor.meters.relationship = clamp(mentor.meters.relationship + 6);
    log(`${mentor.firstName} ${mentor.lastName}, your mentor from residency, sent a note: "I said you would."`, 'system', 'good');
  }
  if (['chief', 'chair'].includes(rank)) {
    // The person who held the seat steps aside (retires or moves on); the player takes it.
    const dept = deptOf(m.job.specialtyId);
    const old = deptHead(h, dept);
    old.flags.title = `Former chief of ${specialtyName(m.job.specialtyId)}`;
    if (old.life?.job) old.life.job = null;
    h.heads[dept] = p.id ?? 'player';
  }
  if (rank === 'cmo') h.cmoId = p.id ?? 'player';
  chronicle(e, `${p.firstName} ${p.lastName} became ${p.career.title.toLowerCase()}.`);
  note(`Became ${p.career.title.toLowerCase()} at ${e.name}.`, 'career', { key: `rank:${rank}:${e.id}`, milestone: `${p.career.title} at ${e.name}.`, significance: RANKS[rank].leader ? 2 : 1, log: false });
}

/** Who else wants a leadership seat: a rival at the same hospital first, then a senior colleague there. */
function contender(h, m) {
  const p = player();
  const here = (n) => n?.alive && n.life?.job?.employerId === h.id;
  const rival = (m.people.rivalIds ?? []).map((id) => store.state.npcs[id]).find(here);
  if (rival) return { npc: rival, rival: true, strength: clamp(0.3 + ((rival.meters.intellect ?? 50) - reputationOf(m)) / 150, 0.1, 0.6) };
  const senior = p.npcIds.map((id) => store.state.npcs[id]).find((n) => here(n) && n.flags.medRole !== 'trainee' && (n.life?.job?.level ?? 0) >= 1);
  return senior ? { npc: senior, rival: false, strength: 0.25 } : null;
}

/** Accepts or declines a leadership offer standing this year. */
export function answerOffer(accept) {
  const p = player();
  const m = M();
  const o = m.offer;
  if (!o || o.year !== year()) return result(false, 'There is no offer waiting.', 'neutral');
  m.offer = null;
  if (!accept) {
    note(`Declined the post of ${RANKS[o.rank].title.toLowerCase()}.`, 'career', { log: false });
    return result(true, `You thanked them and said no. The post of ${RANKS[o.rank].title.toLowerCase()} will go to someone else.`, 'neutral');
  }
  takeRank(p, m, o.rank);
  return result(true, `You accepted. You are now ${p.career.title.toLowerCase()}.`);
}

/**
 * An attending at a teaching hospital supervises residents: real people, met through the work,
 * whose year goes better or worse with the teaching. Romance with them is ruled out (engine/medicine/drama.js).
 */
function teach(p, m) {
  const h = hospital(m.job.hospitalId);
  if (!h?.teaching) return;
  const e = employer(h.id);
  let mine = (m.people.traineeIds ?? []).map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.life?.job?.employerId === h.id && n.flags.pgy <= 7);
  // Residents finish and move on; new ones arrive each year.
  for (const n of mine) n.flags.pgy = (n.flags.pgy ?? 1) + 1;
  for (const n of mine.filter((x) => x.flags.pgy > 4)) { n.flags.medRole = 'peer'; n.flags.title = 'Former resident'; if (n.life?.job) n.life.job.level = 1; }
  mine = mine.filter((x) => x.flags.pgy <= 4);
  while (mine.length < 2) {
    const n = makeNpc({ role: 'colleague', countryId: e.countryId, age: 26 + Math.floor(rng.next() * 4), relationship: 50 });
    n.flags.medRole = 'trainee'; n.flags.pgy = 1; n.flags.title = 'Resident you supervise'; n.flags.workedWith = e.name;
    n.occupation = 'resident doctor';
    n.life = { edu: { stage: 'done', gpa: 3.5, majorId: 'biology', trade: null, degrees: [], yearsLeft: 0 }, job: { careerId: 'doctor', level: 0, title: 'Resident doctor', salary: 0, years: 0, employerId: e.id },
      savings: 0, aspiration: null, partnerId: null, together: 0, married: false, kids: 0, history: [] };
    store.state.npcs[n.id] = n;
    if (!e.staff.includes(n.id)) e.staff.push(n.id);
    p.npcIds.push(n.id);
    mine.push(n);
  }
  m.people.traineeIds = mine.map((n) => n.id);
  for (const n of mine) n.meters.relationship = clamp(n.meters.relationship + (m.skills.communication - 50) / 10);
  grow('leadership', 1, m); grow('communication', 0.5, m);
}

/** Complaints and claims from a year ago are decided: dismissed where care met the standard, upheld where it did not. */
export function claimsYear(p = player(), m = med()) {
  if (!m) return;
  for (const c of (m.claims ?? []).filter((x) => x.status === 'open' && x.year < year())) {
    if (!c.below) { c.status = 'dismissed'; log('A claim brought by a patient\'s family was reviewed and dismissed: the care met the standard.', 'system', 'neutral'); continue; }
    c.status = 'upheld';
    m.discipline.push({ year: year(), what: 'A claim about a patient\'s care was upheld.' });
    const cost = Math.round(p.career.salary * 0.05);
    p.finance.cash -= cost;
    log(`A claim about a patient's care was upheld. Malpractice insurance paid most of it; your share was ${cost.toLocaleString('en-US')}, and it goes on your record.`, 'system', 'bad');
    p.stats.mood = clamp(p.stats.mood - 10);
  }
}

/** The yearly review of a post: the rank's years, reputation, and a step up when a seat opens. */
export function postYear() {
  const p = player();
  const m = med();
  if (!m?.job) return;
  if (p.career.employerId !== m.job.hospitalId) {
    const e = employer(m.job.hospitalId);
    if (p.career.retired) {
      // Retiring: the career as the family will remember it (engine/medicine/core.js physicianSummary).
      const total = m.experience.years;
      note(`Retired from medicine after ${total} years${m.topTitle ? `, ${an(m.topTitle.toLowerCase())}` : ''}.`, 'career',
        { key: 'retired', milestone: `Retired from medicine after ${total} years.`, significance: 2 });
      const mentor = store.state.npcs[m.people.mentorId];
      if (mentor?.alive) log(`${mentor.firstName} ${mentor.lastName}, who mentored you as a resident, came to your retirement dinner and gave the shortest speech of the night.`, 'system', 'good');
      m.stage = 'retired';
    } else note(`Left ${e?.name ?? 'the hospital'} after ${year() - m.job.since} years.`, 'career', { log: false });
    m.job = null;
    return;
  }
  if (m.job.since === year()) return; // taken this year: the first review comes next year
  teach(p, m);
  const h = hospital(m.job.hospitalId);
  m.experience.years += 1;
  grow('management', 1, m); grow('reasoning', 0.8, m);
  if (RANKS[m.job.rank]?.leader) { grow('leadership', 1.5, m); grow('management', 1, m); }
  m.reputation = reputationOf(m);
  // The yearly review: a weak record is a conversation, not a dismissal; a pattern of unsafe care is reported.
  const rv = m.yearReview?.year === year() - 1 ? m.yearReview : null;
  const q = rv?.n ? rv.quality / rv.n : 60;
  p.career.performance = clamp(Math.round(p.career.performance * 0.5 + (q * 0.5 + m.reputation * 0.5) * 0.5));
  if (rv?.n && q < 30) {
    m.discipline.push({ year: year(), what: 'A peer review of your cases found care below the standard expected.' });
    log('A peer review of your recent cases found care below the standard expected. It goes on your record, and you are asked to work with a mentor.', 'system', 'bad');
    if (m.discipline.filter((d) => d.year > year() - 5).length >= 3) {
      note('Lost hospital privileges after repeated peer reviews.', 'career');
      m.job = null;
      endJob('privileges withdrawn');
      return;
    }
  }
  // A leadership offer stands for the year; the player answers it from My Medical Career.
  if (m.offer && m.offer.year < year()) m.offer = null;
  const years = year() - (m.job.rankSince ?? m.job.since);
  for (const step of nextRank(m.job, h)) {
    if (years < step.years || m.reputation < step.rep || m.skills.leadership < step.lead || m.skills.management < (step.mgmt ?? 0)) continue;
    if (!roll(step.odds + (m.reputation - step.rep) / 200)) continue;
    if (!step.leader) { takeRank(p, m, step.id); log(`You were made ${p.career.title.toLowerCase()}.`, 'system', 'good'); return; }
    // A leadership seat has other candidates: a rival from residency who works here, or a colleague of long standing.
    const other = contender(h, m);
    if (other && roll(other.strength)) {
      other.npc.flags.title = RANKS[step.id].title;
      other.npc.occupation = RANKS[step.id].title.toLowerCase();
      if (other.npc.life?.job) other.npc.life.job.level = Math.max(other.npc.life.job.level ?? 0, 2);
      remember(other.npc, `medRank:${step.id}`, `Was chosen as ${RANKS[step.id].title.toLowerCase()} over you.`);
      log(`The post of ${RANKS[step.id].title.toLowerCase()} went to ${other.npc.firstName} ${other.npc.lastName}${other.rival ? ', your old rival from residency' : ''}. Your turn may come.`, 'system', 'neutral');
      return;
    }
    m.offer = { rank: step.id, year: year(), hospitalId: h.id };
    store.state.pendingEvents.push({ id: 'med_leadership_offer', cast: { words: { post: RANKS[step.id].title.toLowerCase(), hospital: employer(h.id).name } } });
    log(`${employer(h.id).name} has offered you the post of ${RANKS[step.id].title.toLowerCase()}. Answer from My Medical Career.`, 'system', 'good');
    return;
  }
}

/** Hospitals in the city where a qualified physician could apply for a post this year. */
export function postOptions(p = player(), m = med()) {
  const spec = currentSpecialty(m);
  if (!m || !spec || m.training || !qualified(m).length) return [];
  return workplacesFor(spec, p.countryId, p.city).map(({ e, h }) => ({ id: e.id, name: e.name, kind: h.kind, here: p.career.employerId === e.id,
    block: p.career.employerId === e.id ? 'You work here.' : m.license.status !== 'full' ? 'Needs a full license to practice.' : '' }));
}

/** Applies for an attending post at a hospital, once a year. Not guaranteed. */
export function applyForPost(hospitalId) {
  const p = player();
  const m = M();
  const o = postOptions(p, m).find((x) => x.id === hospitalId);
  if (!o) return result(false, 'That hospital has no post in your specialty.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  if (!once(`post:${hospitalId}`, m)) return result(false, 'You have already applied there this year.', 'neutral');
  const chance = clamp(0.4 + (reputationOf(m) - 50) / 80 + (m.boards.some((b) => b.passed) ? 0.1 : -0.05), 0.1, 0.9);
  if (!roll(chance)) return result(false, `${o.name} chose another candidate this year.`);
  const spec = currentSpecialty(m);
  startPost(spec, hospitalId, 'attending');
  return result(true, `${o.name} offered you a post, and you took it: ${p.career.title.toLowerCase()}.`);
}

/** Chooses a podiatric focus (diabetic foot, sports, reconstructive): reconstructive rearfoot surgery needs it. */
export function setFocus(focus) {
  const m = M();
  const s = SPECIALTY_BY_ID[currentSpecialty(m)];
  if (!s?.focus?.includes(focus)) return result(false, 'That is not a focus of your specialty.', 'neutral');
  if (m.focus && m.focus !== focus && !once('focus', m)) return result(false, 'You changed focus this year already.', 'neutral');
  m.focus = focus;
  return result(true, `Your practice now centers on ${focus.replace('_', ' ')}.`, 'neutral');
}

export { ORDER };
