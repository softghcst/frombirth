// A royal child's education: where they are taught (palace tutors, the
// family's boarding school, or a day school among other children), the
// lessons nobody else has (protocol, the constitution, diplomacy, languages,
// cadet training), and what they decide to do when the family's
// expectations and their own plans part ways.
// None of this overrides ordinary school: a royal child still has classmates,
// marks, clubs and rivals (engine/schooling.js), and a title earns nothing
// at a university's admissions office (engine/admissions.js).
//
//   p.flags.royalSchool    'palace' | 'boarding' | 'day'   chosen at ten; the family keeps to it
//   p.flags.royalLessons   { lessonId: years }              one a year, from eight to seventeen
//   p.flags.lessonAge      the age of the last one
//   p.flags.royalPath      'expected' | 'own' | 'service' | 'undecided'   what was said at seventeen
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, log, milestone, npcsByRole } from '../state.js';
import { ROYAL_LESSONS } from '../data/education.js';
import { SPOKEN } from '../data/skills.js';
import { isRoyalFamily, shiftImage } from './royalty.js';
import * as sch from './schooling.js';
import { catalogue } from './university.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** A royal child by birth, still at the age when the palace decides things. */
export const royalChild = (p = player()) => isRoyalFamily() && p.royal?.by === 'birth' && !p.royal.waiting && p.age < 18;

/** Yearly: the scenes that come with a royal childhood. */
export function tickRoyalEducation() {
  const p = player();
  if (!royalChild(p)) return;
  if (p.age === 10 && !p.flags.royalSchool) store.state.pendingEvents.push({ id: 'royal_schooling', cast: {} });
  if (p.age === 17 && !p.flags.royalPath) store.state.pendingEvents.push({ id: 'royal_expectations', cast: { words: { uni: familyUniversity().name } } });
}

/** The university the house has always used: the oldest in the country. Kept on the dynasty. */
export function familyUniversity(p = player()) {
  const d = store.state.dynasties?.[p.royal?.countryId ?? p.countryId];
  const unis = catalogue(p.countryId);
  const known = d?.university ? unis.find((u) => u.id === d.university) : null;
  if (known) return known;
  const u = unis.find((x) => x.kind === 'ancient') ?? unis[0];
  if (d && u) d.university = u.id;
  return u;
}

// ---------- Lessons ----------

export function lessonOptions() {
  const p = player();
  const done = p.flags.royalLessons ?? {};
  return ROYAL_LESSONS.map((l) => ({ ...l, years: done[l.id] ?? 0, why: p.age < (l.from ?? 8) ? `From ${l.from}.` : '' }));
}
export const lessonTaken = () => player().flags.lessonAge === player().age;

/** One lesson a year. A child who hates a subject learns less of it, and minds. */
export function takeLesson(id) {
  const p = player();
  const l = ROYAL_LESSONS.find((x) => x.id === id);
  if (!royalChild(p) || !l) return result(false, 'These lessons are for the royal children.', 'neutral');
  if (p.age < (l.from ?? 8)) return result(false, `Not before ${l.from}.`, 'neutral');
  if (lessonTaken()) return result(false, 'The palace timetable has room for one of these a year.', 'neutral');
  p.flags.lessonAge = p.age;
  const done = (p.flags.royalLessons ??= {});
  done[l.id] = (done[l.id] ?? 0) + 1;
  // Whether this child takes to it: their own nature, not their rank.
  const keen = clamp(0.5 + ((l.factor ? l.factor.split('.').reduce((o, k) => o?.[k], p) : 50) - 50) / 100, 0.15, 0.9);
  const took = rng.chance(keen);
  const scale = took ? 1 : 0.5;
  for (const [path, v] of Object.entries(l.gains ?? {})) {
    const [box, key] = path.split('.');
    p[box][key] = clamp(p[box][key] + Math.round(v * scale));
  }
  if (!took) p.stats.mood = clamp(p.stats.mood - 4);
  let extra = '';
  if (l.id === 'etiquette') shiftImage(took ? 2 : 1);
  if (l.id === 'constitution') p.counters.polExp = Math.min(40, (p.counters.polExp ?? 0) + 1);
  if (l.id === 'languages') {
    const lang = pickLanguage(p);
    if (lang) { p.skills[lang] = clamp((p.skills[lang] ?? 0) + (took ? 14 : 7)); extra = ` This year: ${cap(lang)}.`; }
  }
  if (l.id === 'cadets' && done.cadets === 2) { p.flags.cadet = true; milestone('Completed cadet training.', 'life'); }
  const text = `${took ? l.good : l.bad}${extra}`;
  log(text, 'system', took ? 'good' : 'neutral');
  return result(true, text, took ? 'good' : 'neutral');
}
/** The language a royal child is taught next: the one they have started, or one spoken where the family most often visits. */
function pickLanguage(p) {
  const started = Object.keys(SPOKEN).filter((k) => (p.skills[k] ?? 0) > 0 && (p.skills[k] ?? 0) < 90);
  if (started.length) return started[0];
  const fresh = Object.keys(SPOKEN).filter((k) => !SPOKEN[k].includes(p.countryId) && !(p.skills[k] > 0));
  return fresh.length ? rng.pick(fresh) : null;
}

// ---------- The scenes ----------

export function decide(value) {
  const p = player();
  switch (value) {
    case 'royalTutors': case 'royalBoarding': case 'royalDay': {
      const kind = { royalTutors: 'palace', royalBoarding: 'boarding', royalDay: 'public' }[value];
      p.flags.royalSchool = { royalTutors: 'palace', royalBoarding: 'boarding', royalDay: 'day' }[value];
      if (value === 'royalDay') shiftImage(3);
      const e = p.education;
      // Most of the change comes at the next stage; a child already past primary moves now.
      if (sch.atSchool(p) && e.stage !== 'elementary') { sch.enter(e.stage, kind); return ''; }
      return value === 'royalTutors' ? 'From next year, your lessons will be in the palace schoolroom, with two companions chosen for you.'
        : value === 'royalBoarding' ? 'From next year, you will board, like your parent before you.'
          : 'From next year, you will go to the local school, with a protection officer at the back of every classroom.';
    }
    case 'expectFollow': {
      p.flags.royalPath = 'expected';
      shiftImage(2);
      for (const n of npcsByRole('parent')) n.meters.relationship = clamp(n.meters.relationship + 5);
      return `The palace lets it be known that you hope to go up to ${familyUniversity().name}. Whether they take you is up to them: there is no special entrance for the family.`;
    }
    case 'expectOwn': {
      p.flags.royalPath = 'own';
      p.stats.mood = clamp(p.stats.mood + 6);
      for (const n of npcsByRole('parent')) n.meters.relationship = clamp(n.meters.relationship + (rng.chance(0.5) ? -6 : 2));
      shiftImage(rng.chance(0.5) ? 2 : -2);
      return 'The newspapers have opinions. Your family has more of them. The applications are yours to make.';
    }
    case 'expectService': {
      p.flags.royalPath = 'service';
      p.flags.cadet = true;
      p.stats.health = clamp(p.stats.health + 3);
      p.hidden.discipline = clamp(p.hidden.discipline + 4);
      shiftImage(4);
      milestone('Joined the armed forces for a year before university.', 'life');
      return 'A year in uniform first, as many of your family have done. University can wait.';
    }
    case 'expectWait': p.flags.royalPath = 'undecided'; return 'Your grandmother says that is not an answer. You agree that it is not.';
    default: return undefined;
  }
}

/** The school kind the family picks for a royal child at each stage, honouring the choice made at ten. */
export function preferredKind(stage) {
  const p = player();
  const w = p.flags.royalSchool;
  if (!royalChild(p) || !w) return null;
  const kind = w === 'palace' ? 'palace' : w === 'boarding' ? 'boarding' : 'public';
  return stage === 'elementary' && kind === 'boarding' ? null : kind;
}
