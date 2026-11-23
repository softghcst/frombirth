// How a university decides, and what help with the cost it offers. Pure
// functions with no imports, so the rules can be tested on their own
// (tests/admissions.mjs).
//
// An applicant, as an admissions office sees them:
//   { mark, predicted, advanced, recs, activities, statement, audition, athlete, need, firstInFamily, legacy, transfer }
//     mark        marks from school or college, 0–4 (predicted: school is not finished yet)
//     advanced    how many advanced courses bear on the subject, 0–2
//     recs        recommendations from teachers who know them, 0–2
//     activities  what they did outside lessons, 0–100
//     statement   how the personal statement reads, -1..2
//     audition    performance on the day, 0–100, for courses entered by audition
//     need        0 comfortable, 1 getting by, 2 struggling
//     attempts    times they have already applied to this very place for this subject (0 the first time)
//     priorBest   their best audition there before, so a panel can see whether they have grown
// An institution: { bar, squeeze, auditionBar, open, contextual, legacy, sport, merit, needAid, arts }
//     bar         the mark its entrants usually have
//     squeeze     how many good applicants it turns away for want of room: meeting the bar is not enough there
// General ability is not an input: an office sees the record, not the mind behind it.

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** How far luck can swing an answer, ±: a panel's mood on the day counts for more where a few places are won in a room. */
export const luckRange = (inst, major) => (major?.audition ? 0.15 + 0.07 * (inst.rigor ?? 0.5) : 0.15);

/**
 * One application, decided.
 * @param {number} [luck]  about -0.15..0.15: more applicants than places some years, fewer in others
 * @returns {{outcome:'accepted'|'conditional'|'waitlisted'|'deferred'|'rejected', score:number, condition?:number, reasons:string[]}}
 */
export function assess(a, inst, major, luck = 0) {
  const reasons = [];
  if (inst.open) return { outcome: 'accepted', score: 1, reasons: ['It takes everyone who applies.'] };
  // Some places will consider a weaker record than a course usually asks for.
  const floor = Math.max(0, (major.minGpa ?? 0) - 0.3 - (inst.lenient ?? 0));
  if (a.mark < floor) return { outcome: 'rejected', score: -1, reasons: [`Your marks are below the least this course will consider.`] };
  let score;
  if (major.audition) {
    // A place on a performance course is won in the room. Marks only have to be good enough.
    const margin = ((a.audition ?? 0) - (inst.auditionBar ?? 60)) / 40;
    score = margin + a.recs * 0.1;
    reasons.push(margin >= 0.15 ? 'The panel liked what it saw in the audition.' : margin >= -0.1 ? 'The audition was good, in a year of good auditions.' : 'The panel wanted more from the audition.');
    // Panels see the same faces again. Someone who comes back better is remembered for it; coming back unchanged is not held against them.
    if (a.attempts > 0) {
      const grown = (a.audition ?? 0) - (a.priorBest ?? a.audition ?? 0);
      score += clamp(grown / 80, -0.04, 0.1) + 0.03;
      reasons.push(grown >= 4 ? 'The panel remembered you from before, and saw how much you had grown.' : 'The panel remembered you from before.');
    }
  } else {
    const margin = (a.mark - inst.bar) * 1.6;
    score = margin + a.advanced * 0.12 + a.recs * 0.12 + (a.activities - 40) / 200 + a.statement * 0.06 + (a.skill ?? 0) * 0.15;
    reasons.push(margin >= 0.2 ? 'Your marks are above what it usually takes.' : margin >= -0.15 ? 'Your marks are about what it usually takes.' : 'Your marks are below what it usually takes.');
    if (a.advanced) reasons.push('Your advanced courses counted.');
    if ((a.skill ?? 0) >= 0.3 && a.skillWhat) reasons.push(`What you can already do counted: ${a.skillWhat}.`);
    if (a.activities >= 65) reasons.push('What you did outside lessons counted.');
    if (a.statement >= 2) reasons.push('Your personal statement was remembered.');
    else if (a.statement < 0) reasons.push('Your personal statement did not help.');
  }
  if (a.recs) reasons.push(a.recs > 1 ? 'Two teachers wrote for you, warmly.' : 'A teacher wrote for you, warmly.');
  if (inst.contextual && (a.need >= 2 || a.firstInFamily)) { score += 0.15; reasons.push('It weighed what you had to work with, not only what you got.'); }
  if (inst.legacy && a.legacy) { score += 0.08; reasons.push('Your family\'s history there was noticed.'); }
  if (inst.sport && a.athlete) { score += 0.7; reasons.push('The coach asked for you.'); }
  if (a.transfer) { score += 0.1; reasons.push('Two finished years of college count for something.'); }
  // Historical Eras: in earlier years universities took far fewer students.
  const access = a.access ?? 1;
  if (access < 1) { score -= (1 - access) * 0.45; reasons.push('Universities take very few students in these years.'); }
  score = Math.round((score - (inst.squeeze ?? 0) + luck) * 100) / 100;
  if ((inst.squeeze ?? 0) >= 0.2 && score < 0.12 && a.mark >= inst.bar) reasons.push('It turns away far more good applicants than it takes.');
  if (luck <= -0.1) reasons.push('It had far more applicants than places this year.');
  let outcome = score >= 0.12 ? 'accepted' : score >= -0.06 ? 'waitlisted' : 'rejected';
  // A strong record that just missed is sometimes asked to try again rather than turned away.
  if (outcome === 'rejected' && score >= -0.14 && a.mark >= inst.bar) outcome = 'deferred';
  if (outcome === 'accepted' && a.predicted && !major.audition) {
    return { outcome: 'conditional', score, condition: Math.max(round1(floor + 0.3), round1(inst.bar - 0.4)), reasons };
  }
  return { outcome, score, reasons };
}

/** Whether a conditional offer is met by the final marks. A near miss is sometimes waved through. */
export const meets = (condition, finalMark, luck = 0) => finalMark >= condition || (finalMark >= condition - 0.15 && luck > 0.05);

/**
 * Help with the cost that comes with an offer.
 * @returns {{parts:{kind:string, fraction:number}[], fraction:number, housing:boolean, keep:number}}
 *   fraction: the share of tuition waived, 0–1. keep: the mark that must be kept up for the merit part (0 if none).
 */
export function aid(a, inst, major, score) {
  const parts = [];
  if (inst.merit && score >= 0.45) parts.push({ kind: 'merit', fraction: score >= 0.8 ? inst.merit : inst.merit / 2 });
  // A signed athletic scholarship (engine/recruiting.js) is paid wherever it was signed, Division I to NAIA; Division III and
  // the Ivies give none, so their offers carry no fraction.
  if (a.athlete && (a.athleticFraction ?? (inst.sport ? 0.75 : 0)) > 0) parts.push({ kind: 'athletic', fraction: a.athleticFraction ?? 0.75 });
  if (inst.arts && major.audition && (a.audition ?? 0) >= 80) parts.push({ kind: 'arts', fraction: 0.5 });
  // Only the largest award for what the applicant can do is given; help for need is on top of it.
  parts.sort((x, y) => y.fraction - x.fraction);
  const best = parts.slice(0, 1);
  if (inst.needAid && a.need >= 1) best.push({ kind: 'need', fraction: a.need >= 2 ? inst.needAid : inst.needAid / 2 });
  const fraction = Math.min(1, Math.round(best.reduce((s, x) => s + x.fraction, 0) * 100) / 100);
  return { parts: best, fraction, housing: fraction >= 1 && best.some((x) => x.kind !== 'need') && score >= 0.8, keep: best.some((x) => x.kind === 'merit') ? 2.5 : 0 };
}

/** How an application looks before it is sent, with no luck in it. */
export function outlook(a, inst, major) {
  const r = assess({ ...a, predicted: false }, inst, major, 0);
  if (inst.open) return 'Open to all';
  return r.score >= 0.35 ? 'Likely' : r.score >= 0.12 ? 'A fair chance' : r.score >= -0.14 ? 'A reach' : 'A long shot';
}

// ---------- What the numbers add up to ----------

/** A reference field of applicants: marks, audition, recommendations, each with how common it is among those who apply. */
const FIELD = {
  marks: [[2.2, 1], [2.6, 2], [2.9, 3], [3.2, 3], [3.5, 2], [3.8, 1]],
  audition: [[45, 1], [55, 2], [65, 3], [72, 3], [80, 2], [88, 1.2], [95, 0.5]],
  recs: [[0, 1], [1, 1.4], [2, 0.6]],
};

/**
 * The share of the usual applicants an institution says yes to for a course, from the same rules that decide a real
 * application (no random numbers: it is the average over a fixed field). A waiting list counts for a third of a place.
 */
export function acceptanceRate(inst, major) {
  if (inst.open) return 1;
  const lucks = [-1, -0.5, 0, 0.5, 1].map((x) => x * luckRange(inst, major));
  let yes = 0;
  let all = 0;
  for (const [mark, wm] of FIELD.marks) for (const [aud, wa] of (major.audition ? FIELD.audition : [[null, 1]])) for (const [recs, wr] of FIELD.recs) {
    const w = wm * wa * wr;
    for (const luck of lucks) {
      const o = assess({ mark, predicted: false, advanced: 0, recs, activities: 45, statement: 0, audition: aud, athlete: false, need: 0, firstInFamily: false, legacy: false, transfer: false, attempts: 0 }, inst, major, luck).outcome;
      yes += w * (o === 'accepted' ? 1 : o === 'waitlisted' ? 0.3 : 0);
      all += w;
    }
  }
  return yes / all;
}

/** Where an applicant stands with a place, in the words applicants use: a reach, a match or a safety. */
export function fitOf(a, inst, major) {
  if (inst.open) return 'safety';
  const r = assess({ ...a, predicted: false }, inst, major, 0);
  return r.score >= 0.35 ? 'safety' : r.score >= 0.12 ? 'match' : 'reach';
}

/** The chance, 0–1, that this applicant is offered a place, averaged over the luck a year can bring (a waiting list counts a third). */
export function chanceOf(a, inst, major) {
  if (inst.open) return 1;
  const range = luckRange(inst, major);
  let yes = 0;
  const N = 21;
  for (let i = 0; i < N; i++) {
    const o = assess({ ...a, predicted: false }, inst, major, ((i / (N - 1)) * 2 - 1) * range).outcome;
    yes += o === 'accepted' ? 1 : o === 'waitlisted' ? 0.3 : 0;
  }
  return yes / N;
}
