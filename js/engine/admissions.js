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
// An institution: { bar, squeeze, auditionBar, open, contextual, legacy, sport, merit, needAid, arts }
//     bar         the mark its entrants usually have
//     squeeze     how many good applicants it turns away for want of room: meeting the bar is not enough there
// General ability is not an input: an office sees the record, not the mind behind it.

const round1 = (n) => Math.round(n * 10) / 10;

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
  } else {
    const margin = (a.mark - inst.bar) * 1.6;
    score = margin + a.advanced * 0.12 + a.recs * 0.12 + (a.activities - 40) / 200 + a.statement * 0.06;
    reasons.push(margin >= 0.2 ? 'Your marks are above what it usually takes.' : margin >= -0.15 ? 'Your marks are about what it usually takes.' : 'Your marks are below what it usually takes.');
    if (a.advanced) reasons.push('Your advanced courses counted.');
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
