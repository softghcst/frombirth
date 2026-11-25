// A physician's posts after training: attending, senior attending, medical director, chief of a
// service, department chair, chief medical officer. Pay runs through the ordinary career payroll
// (the rank maps to a level of the doctor, surgery, psychiatry or podiatry career); the medical
// engine decides the rank, by a yearly review built from how the physician practices.
//
// A leadership post needs a seat to be free and a selection; it is offered, never automatic, and
// the player may say no. Leaving the hospital (quitting, being let go, taking another job) ends
// the post; another hospital can be applied to from My Medical Career.
import { clamp } from '../../util.js';
import { store, player, log } from '../../state.js';
import { RANKS, SPECIALTY_BY_ID } from '../../data/medicine.js';
import { promote, endJob } from '../career.js';
import { employer, chronicle } from '../employers.js';
import { M, med, year, grow, note, result, roll, reputationOf, once, specialtyName, currentSpecialty, qualified } from './core.js';
import { hospital, deptOf, deptHead, workplacesFor, careerFor, levelFor } from './hospitals.js';
import { retitle, startPost } from './training.js';

const ORDER = ['attending', 'senior', 'director', 'chief', 'chair', 'cmo'];
/** What each step up asks: years at the rank below, reputation, leadership, and the kind of hospital. */
const STEPS = {
  senior: { from: 'attending', years: 5, rep: 52, lead: 0, odds: 0.45 },
  director: { from: 'senior', years: 3, rep: 58, lead: 45, odds: 0.22, leader: true },
  chief: { from: 'director', years: 3, rep: 62, lead: 55, odds: 0.18, leader: true },
  chair: { from: 'chief', years: 4, rep: 68, lead: 62, odds: 0.12, leader: true, kinds: ['academic', 'childrens'] },
  cmo: { from: 'chief', years: 5, rep: 70, lead: 68, odds: 0.08, leader: true },
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

/** The yearly review of a post: the rank's years, reputation, and a step up when a seat opens. */
export function postYear() {
  const p = player();
  const m = med();
  if (!m?.job) return;
  if (p.career.employerId !== m.job.hospitalId) {
    const e = employer(m.job.hospitalId);
    note(`Left ${e?.name ?? 'the hospital'} after ${year() - m.job.since} years.`, 'career', { log: false });
    m.job = null;
    return;
  }
  if (m.job.since === year()) return; // taken this year: the first review comes next year
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
    if (years < step.years || m.reputation < step.rep || m.skills.leadership < step.lead) continue;
    if (!roll(step.odds + (m.reputation - step.rep) / 200)) continue;
    if (!step.leader) { takeRank(p, m, step.id); log(`You were made ${p.career.title.toLowerCase()}.`, 'system', 'good'); return; }
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
