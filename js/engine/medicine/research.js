// Research and teaching: an academic side to a medical career. Teaching students, supervising
// residents (engine/medicine/ladder.js), research projects that take years, papers that may or
// may not be accepted, conferences, a faculty appointment and running a residency program.
//
// Nothing here is a breakthrough on demand: a project needs a hospital that does research, years
// of work and a research skill to match, and even then a paper can be turned down.
//
//   m.research = { projects: [{ id, field, start, progress }], papers: [{ year, field, venue }], talks, taught, faculty, director }
import { clamp } from '../../util.js';
import { player, log } from '../../state.js';
import { M, med, year, grow, note, result, roll, once, currentSpecialty, specialtyName } from './core.js';
import { hospital } from './hospitals.js';

const R = (m) => (m.research ??= { projects: [], papers: [], talks: 0, taught: 0, faculty: false, director: false });
const where = (m) => m.training?.hospitalId ?? m.job?.hospitalId ?? null;

/** What the physician can do this year, with why not. */
export function researchOptions(m = med(), p = player()) {
  if (!m) return [];
  const r = R(m);
  const h = where(m) ? hospital(where(m)) : null;
  const academic = !!h?.teaching;
  const done = (k) => m.acted.year === year() && !!m.acted[k];
  return [
    { id: 'teach', name: 'Teach medical students', block: !academic ? 'Needs a post at a teaching hospital.' : m.training && m.training.pgy < 2 ? 'Teaching starts after your first year.' : done('teach') ? 'Done this year.' : '' },
    { id: 'project', name: 'Join a research project', block: !h || h.resources < 70 ? 'Needs a hospital that does research.' : r.projects.length >= 2 ? 'Two projects at once is plenty.' : done('project') ? 'Done this year.' : '' },
    { id: 'present', name: 'Present at a conference', block: !r.papers.length ? 'Needs published work to present.' : done('present') ? 'Done this year.' : '' },
    { id: 'faculty', name: 'Apply for a faculty position', block: r.faculty ? 'You hold one.' : !m.job ? 'Needs an attending post.' : !academic ? 'Needs a teaching hospital.' : r.papers.length < 2 ? 'Needs at least two published papers.' : done('faculty') ? 'Applied this year.' : '' },
    { id: 'director', name: 'Apply to direct the residency program', block: r.director ? 'You direct it.' : !r.faculty ? 'Needs a faculty position.' : (r.taught < 4) ? 'Needs years of teaching first.' : m.skills.leadership < 55 ? 'Needs more leadership.' : done('director') ? 'Applied this year.' : '' },
  ];
}

/** Does one of them. */
export function doResearch(id) {
  const p = player();
  const m = M();
  const o = researchOptions(m, p).find((x) => x.id === id);
  if (!o) return result(false, 'There is no such thing to do.', 'neutral');
  if (o.block) return result(false, o.block, 'neutral');
  once(id, m);
  const r = R(m);
  switch (id) {
    case 'teach':
      r.taught += 1; grow('communication', 1.5, m); grow('leadership', 1, m);
      return result(true, 'You take a group of students through the wards every week. By the end of the year one of them asks you to be their advisor.');
    case 'project': {
      const field = currentSpecialty(m) ?? 'internal';
      r.projects.push({ id: `rp_${year()}_${r.projects.length}`, field, start: year(), progress: 0 });
      grow('research', 2, m);
      return result(true, `You join a ${specialtyName(field).toLowerCase()} research project. It will take years, and may come to nothing.`, 'neutral');
    }
    case 'present':
      r.talks += 1; grow('communication', 1, m); grow('research', 1, m); grow('leadership', 0.5, m);
      return result(true, 'Fifteen minutes, a hall of four hundred people, and three questions afterward. One of them was hard, and you answered it honestly.');
    case 'faculty': {
      const chance = clamp(0.25 + (m.skills.research - 50) / 100 + r.papers.length * 0.05 + r.taught * 0.03, 0.05, 0.85);
      if (!roll(chance)) return result(false, 'The appointments committee chose another candidate this year.');
      r.faculty = true;
      note('Appointed to the medical school faculty.', 'career', { key: 'faculty', milestone: 'Appointed to a medical school faculty.' });
      return result(true, 'You are appointed to the faculty: an assistant professor, with teaching and research written into your job.');
    }
    case 'director': {
      if (!roll(clamp(0.2 + (m.skills.leadership - 55) / 100 + r.taught * 0.02, 0.05, 0.7))) return result(false, 'Another faculty member was chosen to direct the program.');
      r.director = true;
      note('Became residency program director.', 'career', { key: 'program_director', milestone: 'Became a residency program director.' });
      return result(true, 'You now run the residency program: recruiting, teaching, and answering for every resident\'s training.');
    }
    default: return result(false, 'Nothing happens.', 'neutral');
  }
}

/** A research year: projects move by skill and resources; a finished one is submitted, and may be published. */
export function researchYear() {
  const m = med();
  if (!m?.research) return;
  const r = m.research;
  const h = where(m) ? hospital(where(m)) : null;
  for (const pr of [...r.projects]) {
    pr.progress += Math.round(15 + m.skills.research / 4 + ((h?.resources ?? 50) - 50) / 5);
    if (pr.progress < 100) continue;
    r.projects = r.projects.filter((x) => x !== pr);
    if (roll(clamp(0.35 + (m.skills.research - 50) / 80, 0.1, 0.85))) {
      r.papers.push({ year: year(), field: pr.field, venue: m.skills.research >= 75 ? 'a leading journal' : 'a specialty journal' });
      grow('research', 3, m);
      note(`Published research in ${specialtyName(pr.field).toLowerCase()}.`, 'career', { key: `paper:${pr.id}` });
    } else log('Your research paper was turned down by the journal. The reviewers want more data; the project is over for now.', 'system', 'neutral');
  }
  if (r.director) grow('leadership', 1, m);
}
