// The record of a working life: every job with its employer and dates,
// experience by kind of work, career milestones earned from that record, and
// the family's working history across generations.
//
//   p.career.history       [{ careerId, title, from, to, exit, kind?, employerId?, employer?, city?, countryId?, level? }]
//                          ages, not years; kind: 'job' (default) | 'parttime' | 'side' | 'office'
//   p.career.achievements  [{ id, name, text, age, year }]  each earned once, never removed
//   state.careerRecord     [{ name, gen, born, died, jobs[], achievements[], topTitle, retired, colleagues[] }]
//                          one entry per generation played, written when the story passes to an heir
//
// Milestones are worked out from the record itself. Overlapping periods are
// merged before years are counted, so a job recorded twice, or two jobs at
// once, never count double.
import { store, player, livingNpcs, log, milestone } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { FAMILY_BY_ID } from '../data/occupations.js';
import { ensureCareer } from './worklife.js';
import { employer } from './employers.js';
import { inherit } from './business.js';

const MANAGER = /manager|director|head |head$|chief|lead\b|supervisor|principal|captain|foreman|partner|superintendent|dean|governor|postmaster|chair/i;
const OWNER = /owner|contractor|founder|agency head|firm owner/i;

/** Every main job, past and present, with the years it covered. */
export function jobsOf(p = player()) {
  const c = ensureCareer(p.career);
  const out = c.history.filter((h) => CAREER_BY_ID[h.careerId] && (h.kind ?? 'job') === 'job');
  if (c.careerId) out.push({ careerId: c.careerId, title: c.title, from: p.age - c.yearsInRole, to: p.age, level: c.level, employerId: c.employerId, current: true });
  return out;
}

/** Years covered by a set of [from, to] periods, overlaps counted once. */
export function unionYears(periods) {
  const sorted = periods.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let end = -Infinity;
  for (const [a, b] of sorted) {
    if (b <= end) continue;
    total += b - Math.max(a, end);
    end = b;
  }
  return total;
}

/** Years in each career family, merged. */
export function yearsByFamily(p = player()) {
  const by = {};
  for (const j of jobsOf(p)) (by[CAREER_BY_ID[j.careerId].family] ??= []).push([j.from, j.to]);
  return Object.fromEntries(Object.entries(by).map(([f, ps]) => [f, unionYears(ps)]));
}

/** The longest unbroken stretch at one employer. */
function longestAtOneEmployer(p) {
  const jobs = jobsOf(p).filter((j) => j.employerId).sort((a, b) => a.from - b.from);
  let best = 0;
  let run = null;
  for (const j of jobs) {
    if (run && run.id === j.employerId && j.from <= run.to + 0) run.to = Math.max(run.to, j.to);
    else run = { id: j.employerId, from: j.from, to: j.to };
    best = Math.max(best, run.to - run.from);
  }
  return best;
}

/** The families earlier generations worked in. */
function ancestorFamilies(st = store.state) {
  const fams = new Set();
  for (const r of st.careerRecord ?? []) for (const j of r.jobs) if (CAREER_BY_ID[j.careerId]) fams.add(CAREER_BY_ID[j.careerId].family);
  return fams;
}

/**
 * Career milestones. Each test reads the saved record and returns the text to
 * show when it is earned, or nothing.
 */
export const ACHIEVEMENTS = [
  { id: 'first_paycheck', name: 'First Paycheck', test: (p, c) => (c.lastPay?.gross > 0 || c.history.length) && 'Earned your first wage.' },
  { id: 'first_promotion', name: 'Moving Up', test: (p, c) => (c.promotions ?? 0) >= 1 && 'Promoted for the first time.' },
  { id: 'first_manager', name: 'In Charge', test: (p) => jobsOf(p).some((j) => MANAGER.test(j.title)) && 'Took on a role leading other people.' },
  { id: 'career_explorer', name: 'Career Explorer', test: (p) => Object.values(yearsByFamily(p)).filter((y) => y >= 1).length >= 4 && 'Worked in four different fields.' },
  { id: 'ten_year', name: 'Ten-Year Veteran', test: (p) => longestAtOneEmployer(p) >= 10 && 'Ten unbroken years with one employer.' },
  { id: 'industry_veteran', name: 'Industry Veteran', test: (p) => unionYears(jobsOf(p).map((j) => [j.from, j.to])) >= 35 && 'Thirty-five years of working life.' },
  { id: 'reinvention', name: 'Career Reinvention', test: (p) => {
    const fams = Object.entries(yearsByFamily(p)).filter(([, y]) => y >= 3).map(([f]) => f);
    const late = jobsOf(p).some((j) => j.from >= 30 && fams.includes(CAREER_BY_ID[j.careerId].family) && j.to - j.from >= 3
      && jobsOf(p).some((k) => k.to <= j.from + 1 && CAREER_BY_ID[k.careerId].family !== CAREER_BY_ID[j.careerId].family && k.to - k.from >= 5));
    return late && 'Built a second career in a different field.';
  } },
  { id: 'trade_master', name: 'From Apprentice to Master', test: (p) => p.education.degrees.some((d) => d.type === 'apprenticeship')
    && jobsOf(p).some((j) => CAREER_BY_ID[j.careerId].family === 'trades' && j.level >= CAREER_BY_ID[j.careerId].levels.length - 2) && 'Served an apprenticeship and rose to the top of the trade.' },
  { id: 'public_servant', name: 'Lifelong Public Servant', test: (p) => {
    const y = yearsByFamily(p);
    return unionYears(jobsOf(p).filter((j) => ['government', 'safety', 'military', 'education'].includes(CAREER_BY_ID[j.careerId].family)).map((j) => [j.from, j.to])) >= 25
      && (y.government || y.safety || y.military || y.education) && 'Twenty-five years in public service.';
  } },
  { id: 'creative_breakthrough', name: 'Creative Breakthrough', test: (p) => jobsOf(p).some((j) => { const car = CAREER_BY_ID[j.careerId]; return ['arts', 'media'].includes(car.family) && car.fame && j.level >= car.fame.from; }) && 'Your creative work made your name.' },
  { id: 'entrepreneur', name: 'Entrepreneurial Spirit', test: (p) => (jobsOf(p).some((j) => OWNER.test(j.title)) || (p.businesses ?? []).some((b) => b.years >= 3 && b.foundedAge != null)) && 'Ran a business of your own.' },
  { id: 'employer', name: 'On the Payroll', test: (p) => (p.businesses ?? []).some((b) => b.status === 'open' && b.staff.length + b.others >= 8) && 'Your business gives eight people their living.' },
  { id: 'sold_up', name: 'Sold Up', test: (p) => (p.businesses ?? []).some((b) => b.status === 'sold' && b.years >= 3) && 'Built a business and sold it.' },
  { id: 'family_firm', name: 'The Family Firm', test: (p) => (p.businesses ?? []).some((b) => b.status === 'family' || b.history.some((h) => /passed to/.test(h.text))) && 'A business passed from one generation to the next.' },
  { id: 'second_wind', name: 'Second Wind', test: (p) => (p.businesses ?? []).some((b) => b.status === 'failed') && (p.businesses ?? []).some((b) => b.status === 'open' && b.years >= 2 && (b.last?.profit ?? 0) > 0) && 'Lost one business, and made a success of the next.' },
  { id: 'independent', name: 'Independent Professional', test: (p, c) => (c.freelance?.done ?? 0) >= 25 && 'Completed twenty-five freelance contracts.' },
  { id: 'mentor', name: 'Mentor', test: (p, c) => c.mentees.filter((m) => m.promoted).length >= 3 && 'Helped three junior colleagues move up.' },
  { id: 'second_career', name: 'Second Career', test: (p, c) => c.unretired && 'Went back to work after retiring.' },
  { id: 'service_to_civilian', name: 'From Service to Civilian Life', test: (p) => { const y = yearsByFamily(p); return (y.military ?? 0) >= 4 && Object.entries(y).some(([f, n]) => f !== 'military' && n >= 2) && 'Served, then made a civilian career.'; } },
  { id: 'family_tradition', name: 'Family Tradition', test: (p) => {
    const fams = ancestorFamilies();
    const parentJobs = livingNpcs().concat(Object.values(store.state.npcs).filter((n) => !n.alive)).filter((n) => ['parent', 'grandparent'].includes(n.role) && n.occupation)
      .map((n) => n.occupation.toLowerCase());
    const mine = jobsOf(p).filter((j) => j.to - j.from >= 3);
    const shared = mine.some((j) => fams.has(CAREER_BY_ID[j.careerId].family)
      || CAREER_BY_ID[j.careerId].levels.some((l) => parentJobs.some((o) => o.replace(/^retired /, '') === l.title.toLowerCase())));
    return shared && 'Followed a parent or grandparent into their line of work.';
  } },
  { id: 'lifes_work', name: 'A Life\'s Work', test: (p, c) => c.retired && unionYears(jobsOf(p).map((j) => [j.from, j.to])) >= 30 && 'Retired after thirty years and more of work.' },
];

/** Twenty years in one family of work: a career collection, one per family. */
const collection = (family) => ({ id: `collection_${family}`, name: `20 Years in ${FAMILY_BY_ID[family]?.name ?? family}`,
  test: (p) => (yearsByFamily(p)[family] ?? 0) >= 20 && `Twenty years in ${(FAMILY_BY_ID[family]?.name ?? family).toLowerCase()}.` });

/** Checks the record and awards anything newly earned. @returns {object[]} new achievements */
export function checkAchievements(p = player()) {
  const c = ensureCareer(p.career);
  const have = new Set(c.achievements.map((a) => a.id));
  const fresh = [];
  const tests = [...ACHIEVEMENTS, ...Object.keys(yearsByFamily(p)).map(collection)];
  for (const a of tests) {
    if (have.has(a.id)) continue;
    const text = a.test(p, c);
    if (!text) continue;
    const got = { id: a.id, name: a.name, text, age: p.age, year: store.state.year };
    c.achievements.push(got);
    fresh.push(got);
    if (p === player()) {
      log(`Career milestone: ${a.name}. ${text}`, 'system', 'good');
      milestone(`${a.name}: ${text}`, 'career');
    }
  }
  return fresh;
}

/** One line per job, oldest first, for the history screen. */
export function timeline(p = player()) {
  const c = ensureCareer(p.career);
  const all = [...c.history];
  if (c.careerId) all.push({ careerId: c.careerId, title: c.title, from: p.age - c.yearsInRole, to: null, employer: employer(c.employerId)?.name, city: employer(c.employerId)?.city, current: true });
  if (c.partTime) all.push({ careerId: c.partTime.jobId, title: c.partTime.title, from: c.partTime.since, to: null, employer: c.partTime.place, kind: 'parttime', current: true });
  for (const s of c.sides) all.push({ careerId: s.careerId, title: s.title, from: s.since, to: null, employer: employer(s.employerId)?.name, kind: 'side', current: true });
  return all.sort((a, b) => a.from - b.from);
}

// ---------- Across generations ----------

/** One person's working life, as the family will remember it. */
export function record(p = player(), st = store.state) {
  const c = ensureCareer(p.career);
  const born = p.birthYear ?? st.year - p.age;
  const jobs = jobsOf(p).map((j) => ({ careerId: j.careerId, title: j.title, employer: j.employer ?? employer(j.employerId)?.name ?? null,
    city: j.city ?? employer(j.employerId)?.city ?? null, from: born + j.from, to: born + j.to }));
  const colleagues = Object.values(st.npcs).filter((n) => ['coworker', 'colleague', 'boss'].includes(n.role) || n.flags?.workedWith)
    .filter((n) => (n.meters?.relationship ?? 0) >= 70).slice(0, 5).map((n) => `${n.firstName} ${n.lastName}`);
  const top = [...jobs].sort((a, b) => (CAREER_BY_ID[b.careerId]?.levels.findIndex((l) => l.title === b.title) ?? 0) - (CAREER_BY_ID[a.careerId]?.levels.findIndex((l) => l.title === a.title) ?? 0))[0];
  return { name: `${p.firstName} ${p.lastName}`, gen: p.generation ?? 1, born, died: p.alive === false ? st.year : null, jobs,
    businesses: (p.businesses ?? []).map((b) => ({ name: b.name, from: b.founded, years: b.years, status: b.status })),
    achievements: c.achievements.map((a) => a.name), topTitle: top?.title ?? null, retired: !!c.retired, colleagues };
}

/** Written when the story passes on (engine/legacy.js). */
export function passOn(old, next, heir) {
  next.careerRecord = [...(old.careerRecord ?? []), record(old.player, old)].slice(-12);
  next.jobs = old.jobs; // the employers, and their histories, are the same world
  // A business goes to the heir who was named, or to a child. Ownership, not the manager's chair.
  return heir ? inherit(old.player, next.player, heir, next.npcs) : [];
}

/** The family's working history, with the living player last. */
export const familyCareers = () => [...(store.state.careerRecord ?? []), { ...record(), current: true }];
