// Practicing skills: instruments, performing, sport, crafts and languages.
// A few sessions a year; each one moves a progress bar, faster for someone
// with a natural gift for it and slower as they near mastery.
import { gift } from './talentGrowth.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { player, country, log, milestone } from '../state.js';
import { guardians } from './childhood.js';
import { nativeLanguages } from './languages.js';
import { SKILLS, SKILL_BY_ID, SKILL_GROUPS, PRACTICE_PER_YEAR, LESSON_COST, LEVELS, SKILL_USES, SPOKEN } from '../data/skills.js';
import { COUNTRIES } from '../data/countries.js';

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
  if (key) k += Math.max(0, gift(p, key) - 50) / 125; // a gift in the family of the skill
  if (s.stat === 'intellect' || s.group === 'language') k += Math.max(0, p.stats.intellect - 60) / 100;
  k += (p.hidden.discipline - 50) / 250;
  if (p.age < 12) k += 0.15; // children soak things up
  return Math.max(0.5, k);
}

const placeNames = (ids) => ids.map((id) => COUNTRIES[id]?.name).filter(Boolean);
const listed = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
/** What a skill is good for, in a line (data/skills.js SKILL_USES). A language: where it is spoken, and what it opens. */
export function usesOf(id) {
  const s = SKILL_BY_ID[id];
  if (s?.group === 'language' && SPOKEN[id]) return `Spoken in ${listed(placeNames(SPOKEN[id]))}. Helps you move and find work there, and counts with employers anywhere.`;
  return SKILL_USES[id] ?? '';
}
/** What reaching a level in a language opens, said once when it is reached. */
function languageStep(s, before, after) {
  const where = listed(placeNames(SPOKEN[s.id] ?? []));
  if (!where) return '';
  if (before < 40 && after >= 40) return ` You can get by in ${s.name} now: living in ${where} would be much easier.`;
  if (before < 60 && after >= 60) return ` Your ${s.name} is good now: employers anywhere count it, and you could work in ${where}.`;
  if (before < 80 && after >= 80) return ` Your ${s.name} is excellent: you could translate, and pass for a local in ${where}.`;
  return '';
}

/** Skills on offer, grouped, with where the player stands on each. */
export function skillOptions() {
  const p = player();
  const natives = nativeLanguages(p); // a language spoken from birth is not one to learn
  return SKILL_GROUPS.map((g) => ({ ...g, skills: SKILLS.filter((s) => s.group === g.id).map((s) => {
    const level = levelOf(s.id);
    const native = s.group === 'language' && natives.includes(s.id);
    return { id: s.id, name: s.name, uses: usesOf(s.id), level, levelName: native ? 'Native' : levelName(level), started: level > 0 && (!!s.talent || s.id in book()),
      tooYoung: native ? 0 : p.age < s.minAge ? s.minAge : 0, natural: aptitude(s.id) >= 1.7, mastered: native || level >= 100, native };
  }) }));
}

/** Skills with a progress bar to show: everything practiced at least once. */
export const practiced = () => SKILLS.filter((s) => (s.talent ? (player().flags.practiced ?? []).includes(s.id) : s.id in book()))
  .map((s) => ({ id: s.id, name: s.name, level: levelOf(s.id), levelName: levelName(levelOf(s.id)) }));

export const lessonCost = () => localMoney(LESSON_COST, country());
/** Under 18 with a parent or guardian at home, lessons are the family's to pay for, and the price is theirs to worry about. */
export const familyPays = (p = player()) => p.age < 18 && guardians().length > 0;

/**
 * A year of lessons (engine/lessons.js) in a skill: it goes on the list of skills and moves on, about as far as a
 * session with a teacher. Talents grown by the lesson itself are not counted twice. @returns {{before:number, after:number}}
 */
export function learnFromLessons(id) {
  const p = player();
  const s = SKILL_BY_ID[id];
  if (!s) return null;
  const before = levelOf(id);
  if (s.talent) { p.flags.practiced = [...new Set([...(p.flags.practiced ?? []), id])]; return { before, after: levelOf(id) }; }
  const gained = Math.max(1, Math.round(rng.int(9, 13) * aptitude(id) * (1 - before / 135))); // a year of weekly lessons
  const after = Math.min(100, before + gained);
  book()[id] = after;
  return { before, after };
}

/**
 * One practice session. `lesson` pays a teacher for half as much again.
 * @returns {{ok:boolean, text:string, tone:string, gained?:number}}
 */
export function practice(id, lesson = false) {
  const p = player();
  const c = country();
  const s = SKILL_BY_ID[id];
  if (!s || !canPractise()) return result(false, 'You cannot practice now.', 'neutral');
  if (p.age < s.minAge) return result(false, `You need to be ${s.minAge} to start ${s.name.toLowerCase()}.`, 'neutral');
  if (sessionsLeft() <= 0) return result(false, 'You have practiced as much as you can this year.', 'neutral');
  const before = levelOf(id);
  if (before >= 100) return result(false, `There is nothing left to learn about ${s.name.toLowerCase()}. You could teach it.`, 'neutral');
  const cost = lesson ? lessonCost() : 0;
  const own = lesson && !familyPays(p);
  if (own && p.finance.cash < cost) return result(false, `A lesson costs ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  if (own) p.finance.cash -= cost; // a child's lessons are paid for at home, until 18
  acts().used += 1;

  const k = aptitude(id);
  // Taken up for the first time by someone who liked this sort of thing when small: a little further on, once
  // (engine/childhood.js). A head start, not a gift.
  const kind = s.group === 'instrument' || ['singing', 'music_theory', 'rap'].includes(id) ? 'music' : ['dance', 'yoga', 'martial_arts', 'sports'].includes(id) ? 'movement' : id === 'swimming' ? 'water' : id === 'writing' ? 'books' : id === 'public_speaking' ? 'people' : null;
  const head = before === 0 && kind && !(p.flags.earlyUsed ?? []).includes(id) ? (p.flags.childhood?.early?.[kind] ?? 0) : 0;
  if (head) p.flags.earlyUsed = [...(p.flags.earlyUsed ?? []), id];
  const gained = Math.max(1, Math.round(rng.int(4, 7) * k * (lesson ? 1.5 : 1) * (1 - before / 135))) + Math.min(6, head);
  const after = Math.min(100, before + gained);
  if (s.talent) {
    p.talents[s.talent] = after;
    p.flags.practiced = [...new Set([...(p.flags.practiced ?? []), id])];
  } else {
    book()[id] = after;
    if (s.helps) p.talents[s.helps] = clamp((p.talents[s.helps] ?? 0) + Math.max(1, Math.round(gained / 4)));
  }
  if (s.stat) p.stats[s.stat] = clamp(p.stats[s.stat] + (rng.chance(0.5) ? 1 : 0));
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  p.stats.mood = clamp(p.stats.mood + 1);

  const what = s.group === 'language' ? s.name : s.name.toLowerCase(); // "you practiced Italian", "you practiced piano"
  const natural = k >= 1.7 ? ' It comes to you as if you had always known it.' : k < 0.8 ? ' It does not come easily.' : '';
  let text = `${lesson ? `You took lessons in ${what}` : before === 0 ? `You took up ${what}` : `You practiced ${what}`}: ${before}% to ${after}%.${natural}`;
  if (levelName(after) !== levelName(before) && after < 100) text += ` You would call yourself ${levelName(after).toLowerCase()} now.`;
  if (s.group === 'language') text += languageStep(s, before, after);
  if (after >= 100) {
    text += ` You have mastered it.`;
    milestone(`Mastered ${what}.`, 'life');
    p.stats.mood = clamp(p.stats.mood + 8);
  }
  log(text, 'system', 'good');
  return { ...result(true, text), gained: after - before };
}
