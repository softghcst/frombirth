// Education across a family and across a life: the record each generation
// leaves (schools, degrees, prizes, the teacher who mattered), what the
// next generation finds when it walks into the same buildings, and the ways
// school and university come back later, in politics.
// The schools and universities themselves persist in state.schools and
// state.universities; this keeps the family's side of them.
//
//   state.familyRecord   [{ name, gen, born, died, schools, degrees, honors, mentor, first }]
//     one entry per generation played, written when the story passes to an heir
//   school.funding       how much better or worse a state school is taught than its kind, moved by policy
//   p.flags.patronId     the politician whose office took the player on as an intern
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, livingNpcs, log } from '../state.js';
import { PROGRAMS, TRADE_BY_ID } from '../data/schools.js';
import { MAJOR_BY_ID } from '../data/majors.js';

const yearNow = () => store.state.year;
const ROLL = /prize|award|scholarship|captain|President of|Head of|Licensed|Doctor|first in (the|your) family|Valedictorian|Chair of|Editor of|elected/i;

// ---------- The family's record ----------

function degreeLabel(d) {
  if (d.type === 'high') return d.award ?? 'School-leaving qualification';
  if (d.type === 'university') return `${MAJOR_BY_ID[d.majorId]?.name ?? 'A degree'}${d.school ? `, ${d.school}` : ''}`;
  if (d.type === 'apprenticeship') return `${TRADE_BY_ID[d.majorId]?.name ?? 'A trade'}, ${d.via === 'technical' ? 'technical college' : 'apprenticeship'}`;
  if (d.type === 'doctorate') return `Doctorate${d.thesis ? `: "${d.thesis}"` : ''}`;
  return PROGRAMS[d.type]?.label ?? d.type;
}

/** One person's education, as the family will remember it. */
export function record(p = player(), st = store.state) {
  const e = p.education;
  const born = p.birthYear ?? st.year - p.age;
  const mentors = Object.values(st.npcs).filter((n) => ['teacher', 'professor', 'supervisor'].includes(n.flags?.tag) && (n.meters?.relationship ?? 0) >= 60)
    .sort((a, b) => b.meters.relationship - a.meters.relationship);
  const m = mentors[0];
  return {
    name: `${p.firstName} ${p.lastName}`, gen: p.generation ?? 1, born, died: p.alive === false ? st.year : null,
    schools: [...new Set((e.history ?? []).map((h) => h.name).filter((x) => x && x !== 'Home'))],
    degrees: e.degrees.map((d) => ({ label: degreeLabel(d), year: born + (d.age ?? 18), type: d.type, school: d.school ?? null })),
    honors: (p.milestones ?? []).filter((x) => ROLL.test(x.text)).slice(0, 6).map((x) => x.text),
    mentor: m ? `${m.flags.title ?? 'A teacher'}: ${m.firstName} ${m.lastName}` : null,
    first: !!p.flags.firstGraduate,
  };
}

/** Written when the story passes on. */
export function passOn(old, next) {
  next.familyRecord = [...(old.familyRecord ?? []), record(old.player, old)].slice(-12);
}

/** The whole record, with the living player last and their children's schooling noted. */
export function familyRecord() {
  const p = player();
  const mine = { ...record(p), current: true };
  const kids = livingNpcs().filter((n) => n.role === 'child' && n.life?.edu).map((n) => {
    const e = n.life.edu;
    const where = (e.schools ?? []).map((x) => x.name);
    const uni = store.state.universities?.[e.uniId]?.name;
    return { name: `${n.firstName} ${n.lastName}`, age: n.age, schools: where, uni, degrees: e.degrees.filter((d) => d !== 'high') };
  });
  return { past: store.state.familyRecord ?? [], mine, kids };
}

/** Who in the family went to this university before, and when. */
export function familyAt(uniName) {
  const p = player();
  const gen = p.generation ?? 1;
  return (store.state.familyRecord ?? []).filter((r) => r.degrees.some((d) => d.school === uniName)).map((r) => {
    const back = gen - r.gen;
    const d = r.degrees.find((x) => x.school === uniName);
    return { name: r.name, year: d.year, who: back === 1 ? 'parent' : back === 2 ? 'grandparent' : back === 3 ? 'great-grandparent' : 'ancestor' };
  });
}
/** On arriving at a university the family knows. */
export function arriveAt(uniName) {
  const seen = familyAt(uniName);
  if (!seen.length) return;
  const last = seen[seen.length - 1];
  log(`Your ${last.who}, ${last.name}, graduated from ${uniName} in ${last.year}. The name is on the roll in the library, ${yearNow() - last.year} years before yours.`, 'system', 'good');
}

// ---------- What policy does to schools ----------

/**
 * Yearly: each state school's funding moves, a little at a time, toward
 * what national and local government now spend on it. The same decisions
 * the politics engine records (the education lever nationally, the
 * clinics-and-schools lever in a town) are the only inputs.
 */
export function tickSchoolFunding() {
  const st = store.state;
  const p = player();
  const mine = new Set([p.education.place?.schoolId, ...livingNpcs().filter((n) => n.role === 'child').map((n) => n.life?.edu?.schoolId)].filter(Boolean));
  for (const s of Object.values(st.schools ?? {})) {
    if (s.kind !== 'public') continue;
    const w = st.polities?.[s.countryId];
    const target = (w?.policies?.tuition ?? 0) * 0.05 + (w?.local?.[s.city]?.services ?? 0) * 0.03;
    const was = s.funding ?? 0;
    const step = Math.sign(target - was) * Math.min(0.01, Math.abs(target - was));
    s.funding = Math.round((was + step) * 1000) / 1000;
    const said = s.fundingSaid ?? 0;
    if (Math.abs(s.funding - said) >= 0.04) {
      s.fundingSaid = s.funding;
      if (mine.has(s.id)) {
        log(s.funding > said ? `At ${s.name}, the money the government promised has arrived: two new teachers, and the science block is finally being rebuilt.`
          : `At ${s.name}, classes are bigger this year. Two teachers who left have not been replaced, and there is no money for books.`, 'system', s.funding > said ? 'good' : 'bad');
      }
    }
  }
}

// ---------- School and university, later, in politics ----------

/**
 * When a rival politician is needed, one may be someone the player was at
 * school with, especially someone who sat on the school council.
 * @returns {{name, gender, born, school, council}|null}
 */
export function schoolmate(partyMatters = false) {
  const p = player();
  const st = store.state;
  const council = (p.counters?.polExp ?? 0) >= 3;
  if (!rng.chance(council ? 0.4 : 0.15)) return null;
  const born = st.year - p.age;
  const used = new Set(Object.values(st.polities ?? {}).flatMap((w) => Object.values(w.figures)).map((f) => f.name));
  const pool = (st.alumni ?? []).filter((a) => Math.abs(a.born - born) <= 2 && !used.has(`${a.firstName} ${a.lastName}`) && st.year - a.born >= 25);
  if (!pool.length) return null;
  const keen = pool.filter((a) => a.interest === 'government' || (a.clubs ?? []).some((c) => c === 'council' || c === 'debate'));
  const a = rng.pick(keen.length && rng.chance(0.75) ? keen : pool);
  st.alumni.splice(st.alumni.indexOf(a), 1);
  return { name: `${a.firstName} ${a.lastName}`, gender: a.gender, born: a.born, school: st.schools?.[a.schoolId]?.name ?? 'school', council: keen.includes(a), partyMatters };
}
/** Makes a new political figure out of a former classmate. */
export function asSchoolmate(f) {
  const m = schoolmate();
  if (!m) return f;
  Object.assign(f, { name: m.name, gender: m.gender, born: m.born, schoolmate: m.school });
  f.history.push({ year: yearNow(), text: m.council ? `Sat on the school council at ${m.school}, where ${player().firstName} ${player().lastName} was in the same year.` : `Was at ${m.school} in the same year as ${player().firstName} ${player().lastName}.` });
  f.t.ambition = Math.max(f.t.ambition, 60);
  return f;
}

/** Old friends and an old patron, when the player stands for office. @returns {{boost:number, lines:string[]}} */
export function backers() {
  const p = player();
  const lines = [];
  let boost = 0;
  const pal = livingNpcs().find((n) => n.role === 'friend' && n.meters.relationship >= 60 && n.flags.metAt && (n.flags.clubs ?? []).some((c) => c === 'council' || c === 'debate'));
  if (pal) { boost += 2; lines.push(`${pal.firstName} ${pal.lastName}, who sat on the school council with you, is knocking on doors for you.`); }
  const w = store.state.polities?.[p.countryId];
  const patron = w?.figures?.[p.flags.patronId];
  if (patron && patron.died == null && !patron.retired) {
    const m = p.flags.party;
    const mine = m && m.countryId === p.countryId ? m.partyId : null;
    if (!mine || mine === patron.partyId) { boost += 3; lines.push(`${patron.name}, whose office took you on as an intern, has endorsed you.`); }
  }
  return { boost, lines };
}

/** A legislative internship: in the office of a sitting politician, for students who have shown an interest. */
export function legislativePosting(countryId) {
  const p = player();
  const w = store.state.polities?.[countryId];
  if (!w) return null;
  const polsci = ['political_science', 'history', 'law', 'journalism', 'criminal_justice'].includes(p.education.majorId);
  if (!polsci && (p.counters?.polExp ?? 0) < 3) return null;
  const sitting = Object.values(w.figures).filter((f) => f.died == null && !f.retired && ['minister', 'backbench', 'leader', 'deputy', 'head'].includes(f.post));
  if (!sitting.length) return null;
  const f = rng.pick(sitting);
  return { employer: `the office of ${f.name}`, title: 'Legislative intern', figureId: f.id };
}
/** After a legislative internship that went well, the politician remembers. */
export function servedIntern(figureId, went) {
  const p = player();
  const w = store.state.polities?.[p.countryId];
  const f = w?.figures?.[figureId];
  if (!f) return '';
  f.metPlayer = true;
  f.history.push({ year: yearNow(), text: `Took ${p.firstName} ${p.lastName} on as a summer intern.` });
  p.counters.polExp = Math.min(40, (p.counters.polExp ?? 0) + 3);
  if (went >= 60) { p.flags.patronId = f.id; return ` ${f.name.split(' ')[0]} says to get in touch if you ever stand for anything.`; }
  return '';
}
