// Practising skills: instruments, performing, sport, crafts and languages.
// A few sessions a year; each one moves a progress bar, faster for someone
// with a natural gift for it and slower as they near mastery.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { SKILLS, SKILL_BY_ID, SKILL_GROUPS, PRACTICE_PER_YEAR, LESSON_COST, LEVELS } from '../data/skills.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

function acts() {
  const p = player();
  if (p.flags.skillActs?.age !== p.age) p.flags.skillActs = { age: p.age, used: 0 };
  return p.flags.skillActs;
}
const book = () => (player().skills ??= {});

export const canPractise = () => player().age >= 3 && !player().legal.incarceration;
export const sessionsLeft = () => PRACTICE_PER_YEAR - acts().used;
/** How far along the player is, 0 to 100. Talent-based skills read the talent itself. */
export const levelOf = (id) => {
  const s = SKILL_BY_ID[id];
  return Math.round(s.talent ? player().talents[s.talent] ?? 0 : book()[id] ?? 0);
};
export const levelName = (level) => [...LEVELS].reverse().find(([min]) => level >= min)[1];

/** How quickly this person picks this skill up: 1 is ordinary, up to about 2.2 for a born natural. */
export function aptitude(id) {
  const p = player();
  const s = SKILL_BY_ID[id];
  const gifts = p.flags.gifts ?? [];
  const key = s.talent ?? s.helps;
  let k = 1;
  if (key && gifts.includes(key)) k += 0.8; // born with a gift for exactly this
  if (key) k += Math.max(0, (p.talents[key] ?? 0) - 50) / 125; // talent in the family of the skill
  if (s.stat === 'intellect' || s.group === 'language') k += Math.max(0, p.stats.intellect - 60) / 100;
  k += (p.hidden.discipline - 50) / 250;
  if (p.age < 12) k += 0.15; // children soak things up
  return Math.max(0.5, k);
}

/** Skills on offer, grouped, with where the player stands on each. */
export function skillOptions() {
  const p = player();
  return SKILL_GROUPS.map((g) => ({ ...g, skills: SKILLS.filter((s) => s.group === g.id).map((s) => {
    const level = levelOf(s.id);
    return { id: s.id, name: s.name, level, levelName: levelName(level), started: level > 0 && (!!s.talent || s.id in book()),
      tooYoung: p.age < s.minAge ? s.minAge : 0, natural: aptitude(s.id) >= 1.7, mastered: level >= 100 };
  }) }));
}

/** Skills with a progress bar to show: everything practised at least once. */
export const practised = () => SKILLS.filter((s) => (s.talent ? (player().flags.practised ?? []).includes(s.id) : s.id in book()))
  .map((s) => ({ id: s.id, name: s.name, level: levelOf(s.id), levelName: levelName(levelOf(s.id)) }));

export const lessonCost = () => localMoney(LESSON_COST, country());

/**
 * One practice session. `lesson` pays a teacher for half as much again.
 * @returns {{ok:boolean, text:string, tone:string, gained?:number}}
 */
export function practise(id, lesson = false) {
  const p = player();
  const c = country();
  const s = SKILL_BY_ID[id];
  if (!s || !canPractise()) return result(false, 'You cannot practice now.', 'neutral');
  if (p.age < s.minAge) return result(false, `You need to be ${s.minAge} to start ${s.name.toLowerCase()}.`, 'neutral');
  if (sessionsLeft() <= 0) return result(false, 'You have practiced as much as you can this year.', 'neutral');
  const before = levelOf(id);
  if (before >= 100) return result(false, `There is nothing left to learn about ${s.name.toLowerCase()}. You could teach it.`, 'neutral');
  const cost = lesson ? lessonCost() : 0;
  if (lesson && p.age >= 16 && p.finance.cash < cost) return result(false, `A lesson costs ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  if (lesson && p.age >= 16) p.finance.cash -= cost; // a child's lessons are paid for at home
  acts().used += 1;

  const k = aptitude(id);
  const gained = Math.max(1, Math.round(rng.int(4, 7) * k * (lesson ? 1.5 : 1) * (1 - before / 135)));
  const after = Math.min(100, before + gained);
  if (s.talent) {
    p.talents[s.talent] = after;
    p.flags.practised = [...new Set([...(p.flags.practised ?? []), id])];
  } else {
    book()[id] = after;
    if (s.helps) p.talents[s.helps] = clamp((p.talents[s.helps] ?? 0) + Math.max(1, Math.round(gained / 4)));
  }
  if (s.stat) p.stats[s.stat] = clamp(p.stats[s.stat] + (rng.chance(0.5) ? 1 : 0));
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  p.stats.mood = clamp(p.stats.mood + 1);

  const what = s.name.toLowerCase();
  const natural = k >= 1.7 ? ' It comes to you as if you had always known it.' : k < 0.8 ? ' It does not come easily.' : '';
  let text = `${lesson ? `You took lessons in ${what}` : before === 0 ? `You took up ${what}` : `You practiced ${what}`}: ${before}% to ${after}%.${natural}`;
  if (levelName(after) !== levelName(before) && after < 100) text += ` You would call yourself ${levelName(after).toLowerCase()} now.`;
  if (after >= 100) {
    text += ` You have mastered it.`;
    milestone(`Mastered ${what}.`, 'life');
    p.stats.mood = clamp(p.stats.mood + 8);
  }
  log(text, 'system', 'good');
  return { ...result(true, text), gained: after - before };
}
