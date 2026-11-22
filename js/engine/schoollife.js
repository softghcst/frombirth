// The life of a school beyond lessons: who the classmates are and what they
// care about, the player's friendship group, clubs and teams with seasons,
// roles and results, productions with auditions, course choices in the last
// stage, final exams, and the scenes that grow out of all of it.
// Marks and the school itself are in engine/schooling.js.
//
// On classmates (NPCs): flags.interest (one of INTERESTS), flags.clubs [clubId], flags.note (their latest news)
// On the player:
//   p.education.clubLife  { clubId: { since, standing 0–100, role: 'member' | 'leader', record: [..] } }
//   p.education.sport     the sport played on the school team
//   p.education.courses   { electives: [subjectId], advanced: [subjectId] }   chosen for the last stage of school
//   p.education.examPlan  how the final exams are being prepared for
//   p.education.standing  0–100: how the school at large sees the player. Not the same thing as being happy there.
//   p.flags.performances  [{ year, age, show, role, where }]   every production appeared in, for good
//   p.flags.athlete       { sport, seasons, best, captain, awards: [..], recruited }
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, npcsByRole, livingNpcs, log, milestone } from '../state.js';
import { CLUB_BY_ID } from '../data/schools.js';
import { LEAVING_AGE } from '../data/education.js';
import { INTERESTS, CIRCLES, SPORTS, ELECTIVES, CORE_HIGH, PLAYS, CLUB_KIND, CLUB_INTEREST, SUBJECT_BY_ID } from '../data/education.js';
import * as sch from './schooling.js';
import { schoolSeason } from './sports.js';
import { idolOf } from './kpop.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const mates = () => npcsByRole('classmate').filter((n) => n.flags.schoolId);
const full = (n) => `${n.firstName} ${n.lastName}`;
const rel = (n, d) => { n.meters.relationship = Math.round(clamp(n.meters.relationship + d)); n.lastInteractionAge = player().age; };
const mood = (d) => { const p = player(); p.stats.mood = clamp(p.stats.mood + d); };
/** Sends a scene. The people in it are named in the scene itself as well, so it still reads right if one of them has since left. */
function pend(id, cast) {
  const words = { ...(cast.words ?? {}) };
  for (const [k, v] of Object.entries(cast)) { const n = typeof v === 'string' ? store.state.npcs[v] : null; if (n && !(k in words)) words[k] = n.firstName; }
  (player().education.sceneAt ??= {})[id] = player().age;
  store.state.pendingEvents.push({ id, cast: { ...cast, words } });
}
/** Whether a scene has been used too recently to come up again. */
const fresh = (id, years = 3) => player().age - (player().education.sceneAt?.[id] ?? -99) >= years;
const val = (p, path) => Math.max(...path.split('|').map((one) => one.split('.').reduce((o, k) => o?.[k], p) ?? 0));

// ---------- Classmates as people ----------

/** Gives a classmate the things that make them someone: what they care about, and what they do after lessons. */
function flesh(n) {
  if (n.flags.interest) return;
  n.flags.interest = rng.pick(INTERESTS).id;
  const fits = Object.keys(CLUB_INTEREST).filter((id) => CLUB_INTEREST[id] === n.flags.interest || rng.chance(0.08));
  n.flags.clubs = fits.slice(0, 2);
}
export const interestName = (n) => INTERESTS.find((i) => i.id === n.flags.interest)?.name ?? '';
/** The circle someone moves in at school: where their interest puts them. */
export const circleOf = (n) => CIRCLES.find((c) => c.interests.includes(n.flags.interest)) ?? CIRCLES[CIRCLES.length - 1];

/** The player's friendship group: the classmates they are close to, who mostly know each other through something shared. */
export function group() {
  const p = player();
  const close = mates().filter((n) => n.meters.relationship >= 52).sort((a, b) => b.meters.relationship - a.meters.relationship).slice(0, 5);
  const shared = {};
  for (const n of close) for (const c of n.flags.clubs ?? []) if (p.education.clubs.includes(c)) shared[c] = (shared[c] ?? 0) + 1;
  const top = Object.entries(shared).sort((a, b) => b[1] - a[1])[0];
  const circles = {};
  for (const n of close) { const c = circleOf(n).id; circles[c] = (circles[c] ?? 0) + 1; }
  const circle = CIRCLES.find((c) => c.id === Object.entries(circles).sort((a, b) => b[1] - a[1])[0]?.[0]);
  return { members: close, through: top ? CLUB_BY_ID[top[0]].name.toLowerCase() : null, circle: close.length >= 2 ? circle : null };
}
/** How the school at large sees the player, in words. */
export function standingWord(p = player()) {
  const s = p.education.standing ?? 50;
  return s >= 75 ? 'Everybody knows you, and most of them like you' : s >= 58 ? 'Well liked' : s >= 40 ? 'Known to your own crowd' : s >= 25 ? 'Keeps to yourself' : 'On the outside of things';
}

// ---------- Clubs, teams and productions ----------

const lifeOf = (id) => { const e = player().education; e.clubLife ??= {}; return (e.clubLife[id] ??= { since: player().age, standing: 12, role: 'member', record: [] }); };
/** What the leader of a club is called. */
export const leaderTitle = (id) => ({ sport: 'Captain', stage: 'Company lead', council: 'President', press: 'Editor' })[CLUB_KIND[id]] ?? 'President';
export const sportsHere = () => SPORTS[player().countryId] ?? SPORTS.default;
export function setSport(name) {
  if (!sportsHere().includes(name)) return result(false, 'That is not played here.', 'neutral');
  player().education.sport = name;
  return result(true, `You are playing ${name} for the school.`, 'neutral');
}

/** A season on the school team: how the team did, how the player did, and what came of it. */
function season(id, life) {
  const p = player();
  const e = p.education;
  e.sport ??= sportsHere()[0];
  const a = (p.flags.athlete ??= { sport: e.sport, seasons: 0, best: 0, captain: false, awards: [] });
  a.sport = e.sport;
  // Sports the athletic engine knows are played through it: the school's team, coach, league and record are kept
  // (engine/sports.js), and the season itself is played with the rest of the athletic year.
  const engine = schoolSeason(e.sport);
  if (engine != null) { life.record.push({ age: p.age, text: `${e.sport} season`, rating: engine }); return engine; }
  const skill = p.talents.sports;
  const rating = Math.round(clamp(skill * 0.7 + p.stats.health * 0.15 + p.hidden.discipline * 0.15 + rng.int(-10, 10)));
  const games = 10;
  const wins = Math.round(clamp((45 + rng.int(-22, 22) + (rating - 50) / 3) / 10, 0, games));
  a.seasons += 1; a.best = Math.max(a.best, rating);
  life.record.push({ age: p.age, text: `${wins} wins in ${games}`, rating });
  let text = `Your ${e.sport} season: the team won ${wins} of ${games}. ${rating >= 80 ? 'You were the best player on the pitch most weeks.' : rating >= 60 ? 'You held your place and played well.' : rating >= 40 ? 'You were in and out of the side.' : 'You spent most of it on the bench.'}`;
  if (wins >= 8 && rng.chance(0.5)) { text += ' You won the league.'; milestone(`Won the school ${e.sport} league.`, 'education'); mood(6); }
  if (rating >= 82 && rng.chance(0.5)) { a.awards.push({ age: p.age, what: 'Player of the season' }); text += ' You were voted player of the season.'; }
  // The people who look for talent come to watch the oldest players, and only the best of them.
  if (p.age >= 16 && !a.recruited && rating >= 78 && skill >= 72 && rng.chance(0.5)) {
    a.recruited = { age: p.age, sport: e.sport };
    text += ' A university coach was at the last game, and asked for your name.';
    milestone(`Scouted by a university ${e.sport} coach.`, 'education');
  }
  log(text, 'system', wins >= 6 ? 'good' : 'neutral');
  return rating;
}

/** A year in a club that competes: a tournament, a concert, a fair. */
function compete(id, life) {
  const p = player();
  const club = CLUB_BY_ID[id];
  const taught = Object.keys(club.yearly?.talents ?? {}).map((k) => `talents.${k}`);
  const paths = Object.keys(club.tryout?.factors ?? {}).length ? Object.keys(club.tryout.factors) : taught.length ? taught : ['stats.intellect'];
  const skill = paths.reduce((s, k) => s + val(p, k), 0) / paths.length;
  const score = Math.round(clamp(skill * 0.75 + life.standing * 0.15 + rng.int(-12, 14)));
  const what = { debate: 'the debating tournament', chess: 'the chess championship', science_club: 'the science fair', coding: 'the programming contest', band: 'the band competition', choir: 'the choral festival', dance_class: 'the dance showcase', art_club: 'the art exhibition', environment: 'the environmental challenge', paper: 'the school press awards', volunteers: 'the volunteering awards' }[id] ?? 'the regional competition';
  const place = score >= 85 ? 'won' : score >= 70 ? 'reached the final of' : score >= 50 ? 'did respectably at' : 'went out early in';
  life.record.push({ age: p.age, text: `${place} ${what}`, rating: score });
  log(`With the ${club.name.toLowerCase()}, you ${place} ${what}.`, 'system', score >= 70 ? 'good' : 'neutral');
  if (score >= 85) { milestone(`Won ${what}.`, 'education'); mood(5); }
  return score;
}

/** Clubs that put people in front of an audience: time in them builds stage presence. */
const PERFORMING = new Set(['drama', 'youth_theater', 'musical_theater', 'dance_class', 'choir', 'band']);
/** Stage presence (shown with the idol skills, engine/kpop.js) grows from performing anywhere, more slowly near the top. */
function presence(by) { const i = idolOf(player()); i.stage = clamp(i.stage + by * Math.max(0.15, (100 - i.stage) / 100)); }

function makeLeader(id, life) {
  const p = player(); const e = p.education; const kind = CLUB_KIND[id];
  life.role = 'leader';
  if (kind === 'sport') (p.flags.athlete ??= { awards: [] }).captain = true;
  if (kind === 'council' || id === 'debate') p.counters.polExp = Math.min(30, (p.counters.polExp ?? 0) + 2);
  e.standing = clamp((e.standing ?? 50) + 6);
  milestone(`Became ${leaderTitle(id).toLowerCase()} of the ${CLUB_BY_ID[id].name.toLowerCase()}.`, 'education');
}

// ---------- What the player can do in a club ----------

/** This year's record of what the player has done in each club: each thing once a year. */
const clubDone = (id) => { const p = player(); const e = p.education; e.clubActs ??= {}; if (e.clubActs.age !== p.age) e.clubActs = { age: p.age }; return (e.clubActs[id] ??= {}); };

/** The things the player can do in one of their clubs this year. */
export function clubActions(id) {
  const p = player();
  const e = p.education;
  if (!e.clubs?.includes(id) || p.legal?.incarceration) return [];
  const life = lifeOf(id);
  const done = clubDone(id);
  const kind = CLUB_KIND[id];
  const out = [
    { id: 'practice', label: kind === 'sport' ? 'Train extra' : PERFORMING.has(id) ? 'Rehearse extra' : 'Put in extra work', done: !!done.practice },
    { id: 'help', label: kind === 'sport' ? 'Help the coach' : 'Help run things', done: !!done.help },
  ];
  if (PERFORMING.has(id) && p.age >= 7) out.push({ id: 'feature', label: id === 'choir' ? 'Ask for a solo' : id === 'band' ? 'Ask to play a solo' : id === 'dance_class' ? 'Ask for a featured spot' : 'Ask for a bigger part', done: !!done.feature });
  if (life.role === 'member' && p.age >= 12 && life.standing >= 40) out.push({ id: 'lead', label: `Stand for ${leaderTitle(id).toLowerCase()}`, done: !!done.lead });
  return out;
}

/** Does one of them. Each moves the player's standing in the club, and what the club is about. */
export function clubAct(id, action) {
  const p = player();
  const e = p.education;
  const club = CLUB_BY_ID[id];
  if (!clubActions(id).some((a) => a.id === action)) return result(false, 'That is not open to you here.', 'neutral');
  const done = clubDone(id);
  if (done[action]) return result(false, 'You have done that this year already.', 'neutral');
  done[action] = true;
  const life = lifeOf(id);
  const stand = (d) => { life.standing = Math.round(clamp(life.standing + d)); };
  const name = club.name.toLowerCase();
  const inClub = mates().filter((n) => n.flags.clubs?.includes(id));
  switch (action) {
    case 'practice': {
      for (const [k, v] of Object.entries(club.yearly?.talents ?? {})) p.talents[k] = clamp((p.talents[k] ?? 0) + Math.max(1, Math.round(v / 2)));
      for (const [k, v] of Object.entries(club.yearly?.stats ?? {})) p.stats[k] = clamp((p.stats[k] ?? 0) + Math.max(1, Math.round(v / 2)));
      stand(rng.int(4, 8) + (e.priority === 'activities' ? 2 : 0));
      if (PERFORMING.has(id)) presence(2);
      return result(true, `Extra hours with the ${name}, long after everyone else has gone home. You are better for it, and people noticed.`);
    }
    case 'help': {
      stand(rng.int(5, 9));
      for (const n of inClub) rel(n, 4);
      e.standing = clamp((e.standing ?? 50) + 1);
      return result(true, `You set up, stayed late, and did the jobs nobody wants. The ${name} runs better with you in it${inClub.length ? `, and ${inClub[0].firstName} says so` : ''}.`);
    }
    case 'feature': {
      const taught = Object.keys(club.yearly?.talents ?? {});
      const skill = taught.length ? taught.reduce((s, k) => s + (p.talents[k] ?? 0), 0) / taught.length : p.stats.charm;
      const chance = clamp(0.2 + (skill - 40) / 100 + (life.standing - 30) / 150, 0.1, 0.9);
      if (rng.chance(chance)) {
        stand(8); presence(4); mood(5);
        life.record.push({ age: p.age, text: id === 'choir' || id === 'band' ? 'a solo at the concert' : id === 'dance_class' ? 'a featured spot in the showcase' : 'a bigger part this year' });
        return result(true, id === 'choir' ? 'You got the solo. Your knees shook for the first line, and then they did not.' : id === 'band' ? 'Sixteen bars, alone, with everyone watching. You nailed it.' : id === 'dance_class' ? 'Front and center in the showcase. You hit every mark.' : 'A bigger part, and you make it your own.');
      }
      stand(-1); presence(1); mood(-3);
      return result(false, `Not this time: it went to someone with more experience. You were told to ask again next year, and you will.`, 'neutral');
    }
    case 'lead': {
      const title = leaderTitle(id).toLowerCase();
      const chance = clamp((life.standing - 30) / 60 + (p.stats.charm - 50) / 200, 0.1, 0.9);
      if (rng.chance(chance)) { makeLeader(id, life); mood(8); return result(true, `You stood for ${title} of the ${name}, and won. It is yours to run now.`); }
      stand(-3); mood(-5);
      return result(false, `You stood for ${title} of the ${name}. Someone else got it, this time. Your standing will count for more next year.`, 'bad');
    }
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}

/** Everything the player's clubs did this year, and whether any of them now looks to the player. */
function clubsYear() {
  const p = player();
  const e = p.education;
  let staged = false;
  for (const id of e.clubs) {
    const kind = CLUB_KIND[id];
    if (!kind || p.age < 9) continue;
    const life = lifeOf(id);
    let rating = 50;
    if (kind === 'sport') rating = season(id, life);
    else if (kind === 'stage') {
      // One production a year, and it begins with an audition.
      if (!staged && !e.audition && p.age < LEAVING_AGE) { staged = true; const rival = mates().filter((n) => n.flags.clubs?.includes(id) || n.flags.interest === 'theater')[0] ?? mates()[0]; e.audition = { club: id, play: rng.pick(PLAYS), rivalId: rival?.id ?? null }; pend('school_audition', { ...(rival ? { rival: rival.id } : {}), words: { play: e.audition.play, club: CLUB_BY_ID[id].name.toLowerCase(), ...(rival ? {} : { rival: 'Someone in the year above' }) } }); }
      rating = (p.talents.acting + p.talents.singing) / 2;
    } else if (kind !== 'council') rating = compete(id, life);
    else rating = p.stats.charm;
    life.standing = Math.round(clamp(life.standing + 6 + (rating - 50) / 6 + (e.priority === 'activities' ? 4 : 0)));
    if (PERFORMING.has(id)) presence(1.5);
    if (life.role === 'member' && life.standing >= 60 && p.age >= 14 && rng.chance(0.4)) {
      makeLeader(id, life);
      log(`The ${CLUB_BY_ID[id].name.toLowerCase()} has chosen you as its ${leaderTitle(id).toLowerCase()}.`, 'system', 'good');
    }
  }
  for (const id of Object.keys(e.clubLife ?? {})) if (!e.clubs.includes(id)) e.clubLife[id].left ??= p.age;
}

// ---------- Courses, and the last exams ----------

/** Whether courses can be chosen now: once, in the last stage of school. */
export const canChooseCourses = () => { const e = player().education; return sch.atSchool() && e.stage === 'high' && !e.courses; };
export const courseOptions = () => ({ core: CORE_HIGH.map((id) => SUBJECT_BY_ID[id]), electives: ELECTIVES.map((id) => SUBJECT_BY_ID[id]), pick: 3, advanced: 2 });
/**
 * Chooses the courses for the last stage of school: three electives beside
 * the core, and up to two subjects taken at the advanced level.
 */
export function chooseCourses(electives, advanced = []) {
  const e = player().education;
  if (!canChooseCourses()) return result(false, 'Your courses are already set.', 'neutral');
  const el = [...new Set(electives)].filter((id) => ELECTIVES.includes(id)).slice(0, 3);
  if (el.length < 3) return result(false, 'Choose three electives.', 'neutral');
  const adv = [...new Set(advanced)].filter((id) => CORE_HIGH.includes(id) || el.includes(id)).slice(0, 2);
  e.courses = { electives: el, advanced: adv };
  for (const [id, s] of Object.entries(e.subjects)) s.done = !(CORE_HIGH.includes(id) || el.includes(id));
  const text = `Your courses are set: ${el.map((id) => SUBJECT_BY_ID[id].name.toLowerCase()).join(', ')} beside the core${adv.length ? `, with ${adv.map((id) => SUBJECT_BY_ID[id].name.toLowerCase()).join(' and ')} at the advanced level` : ''}.`;
  log(text);
  return result(true, text, 'neutral');
}
/** What a subject's level does to its mark and to the work: advanced courses are harder, and count for more later. */
export const advancedPenalty = (subjectId) => (player().education.courses?.advanced.includes(subjectId) ? 0.3 : 0);
/** What the plan for the final exams adds to the last year's marks, and why. */
export function examEdge() {
  const p = player();
  const plan = p.education.examPlan;
  if (!plan) return { add: 0, why: '' };
  if (plan === 'steady') return { add: 0.25, why: 'you revised steadily for months' };
  if (plan === 'cram') return rng.chance(clamp(0.35 + (p.stats.intellect - 50) / 150, 0.1, 0.8)) ? { add: 0.3, why: 'three weeks of cramming somehow held' } : { add: -0.2, why: 'you crammed, and it fell out of your head in the exam hall' };
  return { add: (p.stats.intellect - 60) / 100, why: 'you trusted what you already knew' };
}

// ---------- The year ----------

/** Yearly, for a child at school: the clubs, the class's own news, and at most one scene that grows out of it. */
export function tickSchoolLife() {
  const p = player();
  const e = p.education;
  if (!sch.atSchool(p)) return;
  const class_ = mates();
  for (const n of class_) flesh(n);
  e.standing = Math.round(clamp((e.standing ?? 50) + (p.stats.charm - 50) / 25 + (p.hidden.karma - 50) / 50 + (class_.filter((n) => n.meters.relationship >= 55).length - 2) + (50 - (e.standing ?? 50)) * 0.05));
  clubsYear();
  // The last year of high school: a nomination for prom royalty, likelier the more popular you are. Once.
  if (e.stage === 'high' && p.age === 17 && !e.prom && rng.chance(clamp(0.12 + ((e.standing ?? 50) - 50) / 100 + (p.stats.charm - 50) / 200, 0.04, 0.6))) {
    e.prom = { age: p.age, nominated: true };
    pend('prom_royalty', { words: { title: p.gender === 'male' ? 'king' : p.gender === 'female' ? 'queen' : 'royalty', school: sch.school()?.name ?? 'your school' } });
  }

  // Classmates have lives of their own: one of them has news most years.
  for (const n of class_) delete n.flags.note;
  const one = class_.length ? rng.pick(class_) : null;
  if (one && p.age >= 8) {
    const other = class_.find((x) => x.id !== one.id);
    one.flags.note = rng.pick([`has taken up ${interestName(one).toLowerCase()} seriously`, p.age >= 13 && other ? `is going out with ${other.firstName}` : `is inseparable from ${other?.firstName ?? 'a cousin'} this year`, 'has a new baby brother at home', 'broke an arm falling off a wall', `won a prize for ${interestName(one).toLowerCase()}`, 'is having a hard year at home']);
  }

  // One scene a year at most, chosen from what is actually true of this class. None on the way out of the door.
  if (p.age >= LEAVING_AGE) return;
  const last = SUBJECTS_LAST(p);
  if (last && !e.examPlan) { pend('final_exams', {}); return; }
  const best = livingNpcs().find((n) => n.flags.title === 'Best friend' && n.role === 'classmate');
  const cold = class_.filter((n) => n.meters.relationship < 38).sort((a, b) => a.meters.relationship - b.meters.relationship)[0];
  const warm = class_.filter((n) => n.meters.relationship >= 45);
  const teacher = sch.teachers().find((t) => t.meters.relationship >= 52 && (e.subjects?.[t.flags.teaches]?.interest ?? 0) >= 58 && !t.flags.believed);
  const pool = [];
  // Someone who was making the player's life hard and has since left the school takes the trouble with them.
  if (e.bullied && !store.state.npcs[e.bullied.id]) delete e.bullied;
  if (e.bullied) pool.push(['school_bullied', { bully: e.bullied.id, words: { again: 'It has not stopped. ' } }, 5]);
  if (p.age >= 7 && p.age <= 12 && warm.length && fresh('class_birthday', 2)) pool.push(['class_birthday', { mate: rng.pick(warm).id }, 2]);
  if (best && p.age >= 9 && p.age <= 16 && rng.chance(0.07)) pool.push(['best_friend_moves', { mate: best.id }, 4]);
  if (warm.length >= 2 && p.age >= 11 && fresh('friends_quarrel', 4)) pool.push(['friends_quarrel', { one: warm[0].id, two: warm[1].id }, 1]);
  if (cold && p.age >= 12 && rng.chance(0.3) && fresh('school_rumor', 4)) pool.push(['school_rumor', { mate: cold.id }, 2]);
  if (cold && p.age >= 8 && p.age <= 15 && !e.bullied && rng.chance(0.12)) pool.push(['school_bullied', { bully: cold.id, words: { again: '' } }, 3]);
  if (teacher) pool.push(['teacher_believes', { teacher: teacher.id, words: { subject: SUBJECT_BY_ID[teacher.flags.teaches].name.toLowerCase() } }, 3]);
  if (p.age >= 13 && rng.chance(0.05) && sch.teachers()[0]) pool.push(['cheating_accused', { teacher: sch.teachers()[0].id, words: { subject: SUBJECT_BY_ID[sch.teachers()[0].flags.teaches].name.toLowerCase() } }, 3]);
  if (p.age >= 15 && p.age <= 17 && warm.length && e.dancedAt !== p.age) pool.push(['school_dance', { mate: warm.slice().sort((a, b) => b.meters.relationship - a.meters.relationship)[0].id }, 3]);
  if (!pool.length || !rng.chance(0.75)) return;
  const pick = rng.weighted(pool, (x) => x[2]);
  pend(pick[0], pick[1]);
}
/** Whether this is the last year of school. */
const SUBJECTS_LAST = (p) => p.education.stage === 'high' && p.age === 17;

// ---------- What the player chose ----------

/** A choice in one of the scenes above. @returns {string} what happened */
export function decide(what, cast = {}) {
  const p = player();
  const e = p.education;
  const n = store.state.npcs[cast.mate ?? cast.bully ?? cast.teacher ?? cast.rival ?? cast.one];
  const say = (text) => text;
  switch (what) {
    case 'startOk': return say('');
    case 'promSmart': case 'promLooks': case 'promStrong': case 'promFunny': {
      // The pitch that matches who you are works best; popularity carries every one of them.
      const lean = { promSmart: p.stats.intellect, promLooks: p.stats.charm, promStrong: (p.stats.health + (p.talents.sports ?? 0)) / 2, promFunny: (p.stats.charm + (p.talents.acting ?? 0)) / 2 }[what];
      const won = rng.chance(clamp(0.15 + (lean - 50) / 90 + ((e.standing ?? 50) - 50) / 120, 0.05, 0.85));
      const title = cast.words?.title ?? 'royalty';
      e.prom = { age: p.age, won };
      if (!won) { mood(-3); return say(`The speech goes fine. Someone else is crowned prom ${title}, and you clap for them like you mean it.`); }
      e.standing = clamp((e.standing ?? 50) + 8); mood(12);
      milestone(`Crowned prom ${title} at ${cast.words?.school ?? 'school'}.`, 'education');
      return say(`The envelope is opened, and it is your name. You are prom ${title}. The crown is a little too big, and you keep it forever.`);
    }
    case 'firstHello': e.firstDay = true; if (n) rel(n, 14); return say(`${n?.firstName ?? 'Someone'} says hello back. By lunchtime you are sharing a table.`);
    case 'firstHide': e.firstDay = true; mood(-3); return say('The day is very long. Nobody is unkind. You get through it.');
    case 'partyGo': if (n) rel(n, 10); mood(5); e.standing = clamp((e.standing ?? 50) + 2); return say(`Cake, a game that gets out of hand, and a party bag. ${n?.firstName ?? 'Your friend'} is glad you came.`);
    case 'partySkip': if (n) rel(n, -6); return say(`${n?.firstName ?? 'Your friend'} notices that you were not there.`);
    case 'moveWrite': if (n) { n.role = 'friend'; n.flags.metAt = sch.school()?.name; n.flags.away = true; delete n.flags.schoolId; rel(n, 4); } mood(-6); return say(`You promise to write, and you do. ${n?.firstName} is still your friend, from further away.`);
    case 'moveDrift': if (n) { rel(n, -15); n.flags.away = true; n.role = 'friend'; n.flags.metAt = sch.school()?.name; delete n.flags.schoolId; delete n.flags.title; } mood(-8); return say(`There is a last afternoon, and then an empty desk. You mean to keep in touch.`);
    case 'sideOne': case 'sideTwo': {
      const a = store.state.npcs[what === 'sideOne' ? cast.one : cast.two];
      const b = store.state.npcs[what === 'sideOne' ? cast.two : cast.one];
      if (a) rel(a, 9); if (b) rel(b, -12);
      return say(`${a?.firstName} is grateful. ${b?.firstName} does not speak to you for the rest of the semester.`);
    }
    case 'sideNone': {
      const a = store.state.npcs[cast.one]; const b = store.state.npcs[cast.two];
      if (rng.chance(0.4 + p.stats.charm / 250)) { if (a) rel(a, 4); if (b) rel(b, 4); return say('You get them into the same room and refuse to leave until they are talking. It works, more or less.'); }
      if (a) rel(a, -3); if (b) rel(b, -3);
      return say('You stay out of it. Both of them think you should have taken their side.');
    }
    case 'rumorConfront': if (rng.chance(0.35 + p.stats.charm / 200)) { if (n) rel(n, 6); e.standing = clamp((e.standing ?? 50) + 4); return say(`You ask ${n?.firstName} about it, quietly, face to face. It stops.`); } if (n) rel(n, -8); e.standing = clamp((e.standing ?? 50) - 3); return say('It turns into a scene in the hallway, and now everyone has heard it.');
    case 'rumorIgnore': mood(-4); return say('You say nothing. In two weeks the school is talking about something else.');
    case 'rumorTell': { const t = sch.teachers()[0]; if (t && t.flags.skill >= 45) { if (t) rel(t, 4); return say(`${t.firstName} ${t.lastName} deals with it without making it worse. That is rarer than it should be.`); } mood(-3); return say('A teacher gives the whole class a talk about kindness. Everybody knows why.'); }
    case 'bullyTeacher': { const t = sch.teachers().sort((a, b) => b.flags.skill - a.flags.skill)[0]; delete e.bullied; if (t) rel(t, 6); mood(4); return say(`${t ? `${t.firstName} ${t.lastName}` : 'A teacher'} listens to all of it, writes it down, and acts: parents are called in, seats are moved, and someone checks on you every week. It stops.`); }
    case 'bullyParents': { delete e.bullied; for (const par of npcsByRole('parent')) rel(par, 5); mood(3); return say('You tell them at the kitchen table. They are angrier than you expected, on your behalf. They go to the school the next morning, and things change.'); }
    case 'bullyStand': if (rng.chance(0.3 + p.hidden.willpower / 250)) { delete e.bullied; e.standing = clamp((e.standing ?? 50) + 5); mood(5); return say('Your voice shakes, but you say it in front of everyone. It stops.'); } e.bullied = { id: n?.id }; mood(-8); return say('It does not work. It gets worse for a while.');
    case 'bullyEndure': e.bullied = { id: n?.id }; mood(-10); p.stats.health = clamp(p.stats.health - 2); return say('You tell nobody. You find routes through the building that avoid them. It goes on.');
    case 'teacherYes': if (n) { rel(n, 10); n.flags.believed = true; n.flags.wouldRecommend = true; const s = e.subjects?.[n.flags.teaches]; if (s) s.interest = clamp(s.interest + 12); } p.stats.intellect = clamp(p.stats.intellect + 2); return say(`You take the extra work. ${n?.firstName} ${n?.lastName} treats you like someone who might be good at this, and it turns out you might.`);
    case 'teacherNo': if (n) n.flags.believed = true; return say('You say you are too busy. The offer is not made twice.');
    case 'cheatCalm': if (n && rng.chance(0.4 + n.flags.skill / 150)) { rel(n, 3); return say(`You show your working, line by line. ${n.firstName} ${n.lastName} apologizes, in front of the class.`); } e.absences += 1; mood(-6); return say('You explain. You are not believed, and the mark is struck out. Later the real culprit is found, and nobody says sorry.');
    case 'cheatAngry': if (n) rel(n, -10); mood(-4); return say('You say exactly what you think. You are right, and you are in detention.');
    case 'cheatAccept': mood(-8); p.hidden.willpower = clamp(p.hidden.willpower - 2); return say('You take the punishment for something you did not do, because arguing seemed worse.');
    case 'danceAsk': {
      e.dancedAt = p.age;
      if (n && rng.chance(clamp(0.25 + (n.meters.relationship - 45) / 90 + (p.stats.charm - 50) / 200, 0.1, 0.9))) { rel(n, 12); mood(8); milestone(`Went to the school dance with ${full(n)}.`, 'life'); return say(`${n.firstName} says yes before you have finished asking. You dance badly together all night.`); }
      mood(-5); if (n) rel(n, -2); return say(`${n?.firstName ?? 'They'} is kind about it, and says no. You go anyway, and it is fine.`);
    }
    case 'danceFriends': e.dancedAt = p.age; for (const m of mates().filter((x) => x.meters.relationship >= 50)) rel(m, 4); mood(6); milestone('Went to the school dance with friends.', 'life'); return say('You go as a gang, take over a corner of the hall, and stay until the lights come on.');
    case 'danceHome': e.dancedAt = p.age; mood(-1); return say('You stay in. You see the photographs the next day.');
    case 'examSteady': e.examPlan = 'steady'; mood(-4); p.hidden.discipline = clamp(p.hidden.discipline + 2); return say('A schedule on the wall, and you keep to it. It is dull, and it works.');
    case 'examCram': e.examPlan = 'cram'; mood(2); return say('You will do it all in the last three weeks. You always have.');
    case 'examTrust': e.examPlan = 'trust'; mood(4); return say('You decide that you know what you know.');
    case 'auditionSafe': case 'auditionBold': return audition(what === 'auditionBold');
    case 'gradParty': for (const m of livingNpcs().filter((x) => x.flags.metAt && x.role === 'friend')) rel(m, 5); mood(8); return say('You stay until the sun comes up, and promise each other things.');
    case 'gradFamily': for (const par of npcsByRole('parent')) rel(par, 8); mood(5); return say('A table for the whole family, and a toast that goes on too long. They are proud of you.');
    case 'gradQuiet': mood(2); return say('You walk home on your own through streets you have known all your life.');
    default: return '';
  }
}

/** The audition, the casting, and the show. The part goes to whoever suits it, which is not always the player. */
function audition(bold) {
  const p = player();
  const e = p.education;
  const a = e.audition;
  if (!a) return '';
  delete e.audition;
  const rival = store.state.npcs[a.rivalId];
  const skill = p.talents.acting * 0.6 + p.talents.singing * 0.2 + p.stats.charm * 0.2;
  const mine = skill + (bold ? rng.int(-16, 18) : rng.int(-6, 8)) + (lifeOf(a.club).standing - 30) / 8;
  if (rival) rival.flags.stage ??= Math.round(clamp(rng.around(60, 28)));
  // The named rival is not the only other person in the room: somebody good always turns up.
  const theirs = Math.max((rival?.flags.stage ?? 55) + rng.int(-8, 10), rng.around(58, 24));
  const role = mine >= theirs && mine >= 64 ? 'the lead' : mine >= 50 ? 'a supporting part' : mine >= 34 ? 'the ensemble' : null;
  const where = sch.school()?.name ?? 'school';
  if (!role) { mood(-6); p.talents.acting = clamp(p.talents.acting + 1); return `The cast list goes up on Friday, and your name is not on it.${rival ? ` ${rival.firstName} has the lead.` : ''} You paint scenery instead, and learn something from the wings.`; }
  (p.flags.performances ??= []).push({ year: store.state.year, age: p.age, show: a.play, role, where });
  const gain = role === 'the lead' ? 6 : role === 'a supporting part' ? 4 : 2;
  presence(gain);
  p.talents.acting = clamp(p.talents.acting + gain);
  p.stats.charm = clamp(p.stats.charm + 1);
  lifeOf(a.club).record.push({ age: p.age, text: `${role} in ${a.play}` });
  for (const m of mates().filter((x) => x.flags.clubs?.includes(a.club))) rel(m, 4);
  mood(role === 'the lead' ? 9 : 5);
  if (role === 'the lead') { e.standing = clamp((e.standing ?? 50) + 5); milestone(`Played the lead in ${a.play} at ${where}.`, 'education'); if (rival) rel(rival, -5); }
  return `The cast list goes up on Friday: you have ${role} in ${a.play}.${role !== 'the lead' && rival ? ` ${rival.firstName} has the lead, and is good.` : ''} Six weeks of rehearsals, three nights, and on the last one you do not want it to end.`;
}

/** After leaving school with a qualification: the day itself. */
export function graduationDay(gpa) {
  const top = gpa >= 3.7;
  pend('graduation_day', { words: { honors: top ? 'Your name is read out first, with the prize for the year. ' : '' } });
}

/** The data for the Activities page of the school book. */
export function activities() {
  const p = player();
  const e = p.education;
  return {
    clubs: e.clubs.map((id) => { const l = lifeOf(id); return { id, name: CLUB_BY_ID[id].name, kind: CLUB_KIND[id] ?? null, role: l.role === 'leader' ? leaderTitle(id) : 'Member', standing: l.standing, since: l.since, record: [...l.record].reverse().slice(0, 4), mates: mates().filter((n) => n.flags.clubs?.includes(id)) }; }),
    sport: e.sport ?? null, sports: sportsHere(), athlete: p.flags.athlete ?? null, performances: [...(p.flags.performances ?? [])].reverse(), standing: standingWord(p), courses: e.courses ?? null,
  };
}
