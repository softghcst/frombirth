// The summer: one program a year for a child or teenager (9 to 17). Camps teach (coding, space, engineering, law);
// competitions are entered and placed in (a science fair, a robotics competition, a math olympiad, a debate
// tournament), against a field that gets stronger at the higher levels. Wins and places are kept as awards, which count
// on university applications (engine/university.js profile), and on a life's record (milestones).
//
//   p.flags.summer = { age }     the summer already spent, by age
//   p.flags.awards = [{ name, place, year, age, kind }]
import { rng } from '../rng.js';
import { clamp, fmtMoney, localMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { applyMods } from './genetics.js';
import { wealthTier } from './living.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const val = (p, path) => path.split('.').reduce((o, k) => o?.[k], p) ?? 0;

/**
 * The programs. camp: what a summer teaches. contest: what decides a place ({ path: weight }), and what gets someone in
 * (`needs`: a club, or a skill). cost: in base units, paid by the family for a child.
 */
export const SUMMER = [
  { id: 'coding_camp', name: 'Coding Camp', emoji: '💻', ages: [9, 17], cost: 900, blurb: 'Two weeks of building games and apps, and a demo day for the parents.',
    camp: { skills: { coding: 6, math: 1 } } },
  { id: 'space_camp', name: 'Space Camp', emoji: '🚀', ages: [9, 15], cost: 1200, blurb: 'Rocket launches, a simulator, and astronaut ice cream.',
    camp: { skills: { science: 4, math: 2 }, stats: { mood: 4 } } },
  { id: 'engineering_camp', name: 'Engineering Summer Program', emoji: '🛠️', ages: [13, 17], cost: 1500, blurb: 'At a university: build a bridge, a circuit, and a robot arm, and stay in the dorms.',
    camp: { skills: { robotics: 4, math: 3, science: 2 } } },
  { id: 'law_camp', name: 'Law Summer Institute', emoji: '⚖️', ages: [13, 17], cost: 800, blurb: 'A week in a real courthouse: mock trials, a judge, and a closing argument of your own.',
    camp: { skills: { public_speaking: 5, writing: 2 } } },
  { id: 'science_fair', name: 'Science Fair', emoji: '🧪', ages: [9, 17], cost: 50, blurb: 'A project of your own, a tri-fold board, and judges with clipboards.',
    contest: { 'skills.science': 0.5, 'stats.intellect': 0.4, 'skills.math': 0.1 }, practice: { skills: { science: 3 } } },
  { id: 'robotics_comp', name: 'Robotics Competition', emoji: '🤖', ages: [11, 17], cost: 150, blurb: 'Your team, your robot, and a crowded arena where something always breaks.',
    needs: { club: 'robotics', skill: 'robotics' }, contest: { 'skills.robotics': 0.5, 'skills.coding': 0.25, 'stats.intellect': 0.25 }, practice: { skills: { robotics: 3, coding: 1 } } },
  { id: 'math_olympiad', name: 'Math Olympiad', emoji: '➗', ages: [10, 17], cost: 30, blurb: 'Four and a half hours, six problems, and no calculator.',
    contest: { 'skills.math': 0.55, 'stats.intellect': 0.45 }, practice: { skills: { math: 3 } } },
  { id: 'debate_tournament', name: 'Debate Tournament', emoji: '🎤', ages: [12, 17], cost: 80, blurb: 'Round after round, both sides of every motion, and a final in front of everyone.',
    needs: { club: 'debate|mock_trial|model_un', skill: 'public_speaking' }, contest: { 'skills.public_speaking': 0.5, 'stats.charm': 0.25, 'stats.intellect': 0.25 }, practice: { skills: { public_speaking: 3 } } },
];
export const SUMMER_BY_ID = Object.fromEntries(SUMMER.map((s) => [s.id, s]));

/** The level a competitor reaches, by how well they placed before: local, then state (or region), then national. */
const LEVELS = ['City', 'State', 'National'];
const levelOf = (p, id) => Math.min(2, (p.flags.awards ?? []).filter((a) => a.kind === id && a.place <= 2).length);

const costOf = (s) => localMoney(s.cost, country());
const done = (p) => p.flags.summer?.age === p.age;

/** The programs open this summer, with why any cannot be done. */
export function summerOptions(p = player()) {
  return SUMMER.filter((s) => p.age >= s.ages[0] - 1 && p.age <= s.ages[1]).map((s) => {
    let why = '';
    if (p.legal?.incarceration) why = 'Not from where you are.';
    else if (p.age < s.ages[0]) why = `From age ${s.ages[0]}.`;
    else if (done(p)) why = 'You have had your summer this year.';
    else if (s.needs && !String(s.needs.club).split('|').some((c) => p.education?.clubs?.includes(c)) && val(p, `skills.${s.needs.skill}`) < 25) why = 'Needs the team: join the club first.';
    else if (p.age >= 18 && p.finance.cash < costOf(s)) why = `Costs ${fmtMoney(costOf(s), country())}.`;
    else if (p.age < 18 && costOf(s) > localMoney(300, country()) && wealthTier() === 'poor') why = 'Your family cannot afford it this year.';
    return { id: s.id, name: s.name, emoji: s.emoji, blurb: s.blurb, cost: costOf(s), contest: !!s.contest, level: s.contest ? LEVELS[levelOf(p, s.id)] : null, why };
  });
}

/** Spends the summer on a program: a camp teaches; a competition is placed in. */
export function goToSummer(id, p = player()) {
  const s = SUMMER_BY_ID[id];
  const opt = summerOptions(p).find((o) => o.id === id);
  if (!s || !opt) return result(false, 'That is not open to you.', 'neutral');
  if (opt.why) return result(false, opt.why, 'neutral');
  p.flags.summer = { age: p.age, id };
  if (p.age >= 18) p.finance.cash -= opt.cost;
  // A summer of it takes something out of you, more for a contest.
  p.career.stress = Math.round(clamp((p.career.stress ?? 30) + (s.contest ? 4 : 2)));
  if (s.camp) {
    applyMods(p, s.camp);
    const text = `You spent the summer at ${s.name.toLowerCase()}. ${s.blurb}`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  applyMods(p, s.practice ?? {});
  const level = levelOf(p, id);
  const mine = Object.entries(s.contest).reduce((t, [path, w]) => t + val(p, path) * w, 0);
  // The field: stronger at each level. A place needs the score to beat it, with the luck of the day.
  const field = 58 + level * 10;
  const score = mine + rng.around(0, 9);
  const place = score >= field + 22 ? 1 : score >= field + 14 ? 2 : score >= field + 8 ? 3 : 0;
  const event = `${LEVELS[level]} ${s.name}`;
  if (!place) {
    const text = `You competed in the ${event} and did not place. You learned a lot about what the winners did.`;
    log(text, 'system', 'neutral');
    return result(true, text, 'neutral');
  }
  const word = ['', '1st place', '2nd place', '3rd place'][place];
  (p.flags.awards ??= []).push({ name: `${word}, ${event}`, place, kind: id, level, year: p.age, age: p.age });
  p.stats.mood = clamp(p.stats.mood + (place === 1 ? 8 : 4));
  if (place === 1) milestone(`Won the ${event}.`, 'education');
  const text = place === 1 ? `You won the ${event}!${level < 2 ? ` Next year: the ${LEVELS[level + 1]} level.` : ' The best in the country.'}` : `${word} at the ${event}. A medal, a certificate, and a photo in the school newsletter.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Awards won, for applications: how many, and how many firsts. */
export function awardsOf(p = player()) {
  const list = p.flags.awards ?? [];
  return { count: list.length, firsts: list.filter((a) => a.place === 1).length, national: list.some((a) => a.level === 2), list };
}

/**
 * Asks a coach, adviser or teacher for a recommendation letter, for university applications. One who thinks well of
 * the student (relationship 60+) writes a strong one, and it counts; otherwise they politely decline.
 */
export function askForRecommendation(people, p = player()) {
  if (p.flags.recAskedAge === p.age) return result(false, 'You asked this year already.', 'neutral');
  p.flags.recAskedAge = p.age;
  const best = people.filter((n) => n?.alive && !n.flags.wouldRecommend).sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
  if (!best) return result(false, 'Everyone who could write you one already has.', 'neutral');
  const who = `${best.firstName} ${best.lastName}`;
  if (best.meters.relationship >= 60) {
    best.flags.wouldRecommend = true;
    const text = `${who}, your ${String(best.flags.title ?? 'teacher').toLowerCase()}, says yes at once, and writes a letter that makes you sound like someone worth taking a chance on. It will count on your applications.`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  return result(false, `${who} says they do not know you well enough yet to write a strong letter. Get to know them better first.`, 'neutral');
}
