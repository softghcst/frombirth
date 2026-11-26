// School, as a book: where the player is at school and how they are doing in
// each subject, who is there with them, and every school they have been to.
// Rules: engine/schooling.js. Everything shown comes from the saved life.
import { summerOptions, goToSummer, askForRecommendation } from '../engine/summer.js';
import { titleCase } from './titles.js';
import { player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { fitBars, fitBar } from './fitBars.js';
import * as sch from '../engine/schooling.js';
import * as life from '../engine/schoollife.js';
import { gradingNote } from '../engine/grades.js';
import { KIND_BY_ID } from '../data/education.js';
import { roleLabel } from '../engine/relationships.js';
import { avatarSvg } from './avatar.js';
import { meterHtml } from './meter.js';
import { openModal, pickModal, messageModal, confirmModal } from './modals.js';
import { store, livingNpcs } from '../state.js';
import * as edu from '../engine/education.js';
import * as cliques from '../engine/cliques.js';
import { navRow, icon } from './kit.js';
import * as clubLife from '../engine/clubs.js';
import { clubTitle } from '../data/clubs.js';
import { openClubs } from './leisure.js';
import { CLUB_BY_ID as SCHOOL_CLUB } from '../data/schools.js';
import { MAX_CLUBS, CLIQUE_BY_ID } from '../data/schools.js';

/** Before a try-out: you, and what they look for, as two bars. Resolves true to go ahead. */
const tryoutAsk = (name, bars, needLabel) => confirmModal({ title: `Tryouts: ${name}`, body: 'How you measure up right now. It can still go either way on the day.',
  html: fitBars({ ...bars, youLabel: 'Your Level', needLabel }), yes: 'Try Out', no: 'Not Now' });

const face = (n) => avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: 60 });


function pageSubjects(v) {
  if (!v.subjects.length) return '<p class="muted">No subjects yet.</p>';
  return `
    ${life.canChooseCourses() ? '<button class="btn primary" data-courses style="width:100%;margin-bottom:10px">Choose your courses for these last years</button>' : ''}
    ${v.subjects.map((s) => `<div class="card sub-card ${v.focus === s.id ? 'on' : ''}">
      <div class="sub-head"><strong>${esc(s.name)}${s.advanced ? ' <small>(advanced)</small>' : ''}</strong><span class="sub-mark">${s.mark ?? '–'}</span></div>
      ${meterHtml('Interest', s.interest, true)}
      ${s.why ? `<p class="muted">Last year: ${esc(s.why)}.</p>` : ''}
      ${s.teacher ? `<p class="muted">Taught by ${esc(s.teacher.firstName)} ${esc(s.teacher.lastName)}, who is ${esc(sch.teacherLine(s.teacher))}.</p>` : ''}
      <button class="btn" data-focus="${s.id}" ${v.focus === s.id ? 'disabled' : ''}>${v.focus === s.id ? 'Getting your extra attention this year' : 'Give this extra attention this year'}</button>
    </div>`).join('')}`;
}



function pageHistory(v) {
  const p = player();
  const degrees = p.education.degrees.filter((d) => d.type !== 'high');
  if (!v.history.length && !degrees.length) return '<p class="muted">Nothing yet.</p>';
  const how = { completed: 'completed', 'moved on': 'moved up', left: 'left early', expelled: 'expelled' };
  return v.history.map((h) => `<div class="dyn-event"><span class="num">${h.from}–${h.to ?? ''}</span><span><strong>${esc(h.kind === 'home' ? 'Taught at home' : h.name)}</strong><br>${esc(h.stageName)} · ${esc(KIND_BY_ID[h.kind].name)}${h.to != null ? ` · ${how[h.how] ?? 'left'}${h.mark ? `, ${sch.mark(h.mark)}` : ''}` : ' · now'}</span></div>`).join('')
    + degrees.map((d) => `<div class="dyn-event"><span class="num">${d.age}</span><span><strong>${esc(d.school ?? d.type)}</strong><br>${esc(sch.degreeMark(d.gpa, d.countryId))}</span></div>`).join('');
}

/** Choosing courses for the last years of school: electives, then any at the advanced level. */
async function chooseCourses(onChange) {
  const o = life.courseOptions();
  const chosen = [];
  for (let i = 0; i < o.pick; i++) {
    const pick = await pickModal({ title: `Elective ${i + 1} of ${o.pick}`, cancel: 'Never mind', body: `Everyone takes ${o.core.map((x) => x.name.toLowerCase()).join(', ')}. Choose three more.`,
      options: o.electives.filter((x) => !chosen.includes(x.id)).map((x) => ({ value: x.id, label: x.name })) });
    if (!pick) return;
    chosen.push(pick);
  }
  const advanced = [];
  for (let i = 0; i < o.advanced; i++) {
    const pool = [...o.core, ...o.electives.filter((x) => chosen.includes(x.id))].filter((x) => !advanced.includes(x.id));
    const pick = await pickModal({ title: 'Take a subject at the advanced level?', cancel: 'No more', body: 'Harder work, but it counts for more with colleges.', options: pool.map((x) => ({ value: x.id, label: x.name })) });
    if (!pick) break;
    advanced.push(pick);
  }
  const r = life.chooseCourses(chosen, advanced);
  onChange?.();
  await messageModal({ body: r.text, tone: r.tone });
}

const SPORT_ICON = 'trophy';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** A sport as people there say it: in the United States, American football is just football. */
const sportName = (x) => (player().countryId === 'us' && x === 'American football' ? 'football' : x);

/** What each club action looks like. */
const ACT_ICON = { practice: 'calendar', help: 'people', feature: 'star', event: 'trophy', friend: 'heart', lead: 'id' };
const STAT_WORDS = { dance: 'dance', singing: 'singing', music: 'music', acting: 'acting', sports: 'sports', health: 'health', charm: 'charm', intellect: 'smarts', mood: 'happiness', karma: 'kindness', discipline: 'discipline' };
/** "dance and health go up": what a year in the club does, from its data. */
function gives(id) {
  const y = SCHOOL_CLUB[id]?.yearly ?? {};
  const keys = [...Object.keys(y.talents ?? {}), ...Object.keys(y.stats ?? {}), ...Object.keys(y.hidden ?? {})].map((k) => STAT_WORDS[k] ?? k);
  return keys.length ? `your ${keys.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${keys.length > 1 ? 'go' : 'goes'} up.` : '';
}

/** The list of clubs and teams: the ones you are in first, then everything you could join or try out for. */
function pageActivitiesHub() {
  const p = player();
  const e = p.education;
  const a = life.activities();
  const mine = a.clubs.map((c) => `<div class="card sub-card"><div class="sub-head"><strong>${esc(c.kind === 'sport' ? `${cap(sportName(a.sport ?? a.sports[0] ?? 'school'))} team` : c.name)}</strong><span>${esc(c.role)}</span></div>
      ${meterHtml('Your standing in it', c.standing, true)}
      ${gives(c.id) ? `<p class="muted" style="margin:4px 0 8px">Each year: ${esc(gives(c.id))}</p>` : ''}
      ${c.mates?.length ? `<p class="muted" style="margin:0 0 6px">With ${esc(c.mates.slice(0, 3).map((n) => n.firstName).join(', ').replace(/, ([^,]*)$/, ' and $1'))}${c.mates.length > 3 ? ` and ${c.mates.length - 3} more` : ''} from your class.</p>` : ''}
      ${c.record?.length ? `<p class="muted" style="margin:0 0 6px">🏅 ${esc(c.record.map((r) => `${r.text.charAt(0).toUpperCase()}${r.text.slice(1)} (age ${r.age})`).join(' · '))}</p>` : ''}
      ${life.clubActions(c.id).length ? `<div class="section-label" style="margin-top:6px">This year</div><div class="btn-stack club-acts">${life.clubActions(c.id).map((x) => `<button class="btn" data-club-act="${esc(c.id)}:${x.id}" ${x.done ? 'disabled' : ''}>${icon(ACT_ICON[x.id] ?? 'star')}${esc(x.label)}${x.done ? ' · done' : ''}</button>`).join('')}</div>` : ''}
      <button class="btn danger" data-leave-club="${esc(c.id)}" style="margin-top:14px">Leave ${esc(c.kind === 'sport' ? 'the Team' : 'the Club')}</button></div>`).join('');
  const opts = edu.clubOptions().filter((c) => !c.joined && c.id !== 'sports_team');
  const team = edu.clubOptions().find((c) => c.id === 'sports_team');
  const full = e.clubs.length >= MAX_CLUBS;
  const sports = team ? life.sportsHere().filter((x) => !(e.clubs.includes('sports_team') && x === (a.sport ?? ''))) : [];
  const row = (attr, label, sub, ico) => navRow({ attrs: attr, label, sub, ico });
  return `${mine ? `<div class="section-label">Yours</div>${mine}` : ''}
    <div class="section-label">${full ? `You have time for ${MAX_CLUBS}. Leave one to join another.` : 'Join or try out'}</div>
    <div class="nav-group">${sports.map((x) => row(`data-team="${esc(x)}"`, `${cap(sportName(x))} team`, e.clubs.includes('sports_team') ? 'Switch to this team' : 'Try out for the team', SPORT_ICON)).join('')}
    ${opts.map((c) => row(`data-join="${esc(c.id)}"`, c.name, c.chance >= 1 ? (c.blurb || 'Open to everyone') : `Try-out${c.blurb ? ` · ${c.blurb}` : ''}`, 'star')).join('')}</div>
    ${outsideSchool()}`;
}

/**
 * Clubs and classes outside school (engine/clubs.js: the scouts, a running club, a pottery class), kept here with the
 * school's own while the player is at school, so all of their clubs are in one place. After school they are in Pursuits.
 */
function outsideSchool() {
  const p = player();
  if (p.age < 6 || p.age > clubLife.CLUB_AGE_LIMIT || p.legal.incarceration) return '';
  const mine = clubLife.memberships();
  return `<div class="section-label">Outside School</div>
    <div class="nav-group">${mine.map((m) => navRow({ attrs: `data-outclub="${esc(m.id)}"`, label: clubTitle(m.club), sub: m.rankName === 'Member' ? `Member${m.years ? ` · ${m.years} ${m.years === 1 ? 'year' : 'years'}` : ''}` : m.rankName, ico: 'people' })).join('')}
      ${navRow({ attrs: 'data-outclub="find"', label: 'Find a Club or Class', sub: 'The scouts, a running club, pottery and more, near home', ico: 'compass' })}</div>`;
}

/** The people who could write a college recommendation: a club's coach, director or adviser, and teachers. */
const recommenders = () => livingNpcs().filter((n) => ['coach', 'director', 'adviser', 'teacher'].includes(n.flags.tag));

/** Your class: the teacher(s) and classmates, how you get on, and a tap to spend time with any of them. */
function pageClass(v) {
  const bar = (n, title) => `<button type="button" class="row world-row" data-person="${esc(n.id)}"><div class="avatar">${face(n)}</div>
    <div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}${title ? ` <small>(${esc(title)})</small>` : ''}</strong>${meterHtml('Relationship', Math.round(n.meters.relationship), true)}</div></button>`;
  return `${v.teachers.map((t) => bar(t, t.flags.title ?? 'Teacher')).join('')}${v.classmates.map((n) => bar(n, n.flags.title === 'Best friend' ? 'Best friend' : '')).join('') || '<p class="muted">No classmates yet.</p>'}`;
}

/** The cliques: who each is for and how you fit, one tap for the ways in. */
function pageCliques() {
  return `<p class="muted">Popularity ${cliques.popularity()}%</p>
    <div class="nav-group">${cliques.cliqueList().map((c) => navRow({ attrs: `data-clique="${esc(c.id)}"`, label: c.current ? `${c.name} · yours` : c.name, sub: c.desc, ico: 'people' })).join('')}</div>`;
}

/** Opens the school. `onChange` is called when something the player did changes the life. */
export function openSchool(onChange) {
  const stack = ['hub'];
  const m = openModal('<div data-school></div>', { dismissable: true });
  m.el.classList.add('dyn-modal');
  const root = m.el.querySelector('[data-school]');
  const TITLES = { hub: 'School', activities: 'Activities', class: 'Class', cliques: 'Cliques', subjects: 'Subjects', history: 'Your school years' };
  function hub(v) {
    const p = player();
    const e = p.education;
    const teen = cliques.inCliqueYears();
    const rows = [];
    const add = (id, label, sub, ico, tone = '') => rows.push(navRow({ attrs: `data-go="${id}"`, label, sub, ico, tone }));
    // What you are part of comes first: your team, and your crowd.
    const mine = [];
    if (e.clubs?.includes('sports_team')) { const a = life.activities(); const c = a.clubs.find((x) => x.id === 'sports_team'); mine.push(navRow({ attrs: 'data-go="team"', label: `${cap(sportName(a.sport ?? a.sports[0] ?? 'school'))} team`, sub: `Performance ${Math.round(c?.standing ?? 0)}%`, ico: 'trophy' })); }
    if (teen && e.clique) mine.push(navRow({ attrs: 'data-go="cliques"', label: CLIQUE_BY_ID[e.clique]?.name ?? 'Your crowd', sub: 'Your clique', ico: 'people' }));
    if (v.school && sch.choices().length) add('move', 'Change schools', v.kind.id === 'private' ? 'Ask to go to a public school' : 'Ask to go to a private school', 'school');
    if (edu.canJoinClubs()) add('activities', 'Activities', e.clubs.length ? `${e.clubs.length} of ${MAX_CLUBS}` : 'Clubs and sports teams', 'trophy');
    if (v.school) add('class', 'Class', 'Your teacher and classmates', 'people');
    if (teen) add('cliques', 'Cliques', e.clique ? `You sit with the ${CLIQUE_BY_ID[e.clique]?.name.toLowerCase() ?? ''}` : 'Find your crowd', 'people');
    if (v.subjects.length) add('subjects', 'Subjects', life.canChooseCourses() ? 'Choose your courses' : 'Marks and teachers', 'book');
    if (teen) add('dance', 'School dance', 'Once a year', 'star');
    if (e.enrolled && e.stage === 'high') add('party', 'House party', 'Throw one while your parents are away', 'star');
    if (e.enrolled && p.age <= 18) add('nurse', 'Nurse', 'Visit the school nurse', 'health');
    // A child far ahead of their class: moving up a year, or finishing early for college.
    if (!edu.skipBlock(p)) add('skipgrade', 'Skip a Grade', 'You are far ahead of your class: ask to move up a year', 'star', 'peach');
    if (!edu.earlyCollegeBlock(p)) add('early', 'Start College Early', 'Finish school now, years ahead of your friends', 'school', 'peach');
    if (summerOptions(p).length) add('summer', 'Summer Programs', p.flags.summer?.age === p.age ? 'Done for this year' : 'Camps and competitions', 'star');
    if (e.enrolled && p.age >= 15 && recommenders().length) add('rec', 'Ask for a Recommendation', 'A letter from a coach or teacher, for college', 'letter');
    add('history', 'Your school years', 'Every school, and what you left with', 'archive');
    return `${v.school ? `<div class="card"><h3>${esc(v.school.kind === 'home' ? 'Taught at home' : v.school.name)}</h3>
        <p class="muted" style="margin:0 0 6px">${esc(v.kind.name)} · ${esc(v.stageName)}, year ${v.year}</p>
        ${meterHtml('Grades', Math.round(Math.min(100, (e.gpa ?? 2.5) / 4 * 100)), true)}
        ${teen ? meterHtml('Popularity', cliques.popularity(), true) : ''}</div>` : `<p class="muted">${p.age < 5 ? 'School has not started yet.' : 'You are not at school.'}</p>`}
      ${mine.length ? `<div class="nav-group">${mine.join('')}</div>` : ''}
      <div class="section-label">Activities</div>
      <div class="nav-group">${rows.join('')}</div>
      ${e.enrolled && p.age >= 6 ? `<div class="btn-pair" style="margin-top:10px"><button class="btn" data-do="study">Study harder</button><button class="btn" data-do="slack">Slack off</button></div>` : ''}
      ${e.enrolled && p.age >= 10 ? '<div class="btn-pair"><button class="btn" data-do="skip">Skip school</button></div>' : ''}
      ${edu.canDropOut() ? '<div class="btn-pair"><button class="btn danger" data-do="drop">Drop out</button></div>' : ''}`;
  }
  function draw(keep = false) {
    const v = sch.view();
    const page = stack.at(-1);
    const top = m.el.scrollTop;
    const body = page === 'hub' ? hub(v) : page === 'activities' ? pageActivitiesHub() : page === 'class' ? pageClass(v) : page === 'cliques' ? pageCliques()
      : page === 'subjects' ? `${life.canChooseCourses() ? '<button class="btn primary" data-courses style="width:100%;margin-bottom:10px">Choose your courses</button>' : ''}${pageSubjects(v)}` : pageHistory(v);
    root.innerHTML = `${stack.length > 1 ? '<button type="button" class="btn small" data-back style="margin-bottom:8px">‹ School</button>' : ''}
      <div class="eyebrow">Education</div><h2 style="margin-top:4px">${TITLES[page]}</h2><div class="dyn-body">${body}</div>`;
    m.el.scrollTop = keep ? top : 0;
  }
  const say = async (r) => { onChange?.(); draw(true); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); draw(true); };
  m.el.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (t.closest('[data-close]')) return m.close();
    if (t.closest('[data-back]')) { stack.pop(); return draw(); }
    const go = t.closest('[data-go]')?.dataset.go;
    if (go === 'move') {
      const kind = await pickModal({ title: 'Change schools', cancel: 'Never mind', body: 'Ask your family. They decide, and your friends stay your friends.',
        options: sch.choices().map((k) => ({ value: k.id, label: titleCase(k.name), sub: k.why || `${k.blurb} ${k.fee}`, disabled: !!k.why })) });
      return kind ? say(sch.askToMove(kind)) : undefined;
    }
    if (go === 'dance') return say(cliques.schoolDance());
    if (go === 'party') return say(cliques.houseParty());
    if (go === 'team') {
      const a = life.activities();
      const c = a.clubs.find((x) => x.id === 'sports_team');
      if (!c) return undefined;
      const years = Math.max(0, player().age - (c.since ?? player().age)) + 1;
      const practice = life.clubActions('sports_team').find((x) => x.id === 'practice');
      const pick = await pickModal({ title: `${cap(sportName(a.sport ?? a.sports[0]))} team`,
        body: `${c.role}. ${years} ${years === 1 ? 'season' : 'seasons'} on the team, about ${8 + Math.round((c.standing ?? 0) / 10)} hours a week. Performance ${Math.round(c.standing ?? 0)}%.`,
        options: [{ value: 'practice', label: 'Practice harder', disabled: !!practice?.done, sub: practice?.done ? 'Done this year' : '' }, { value: 'quit', label: 'Quit the team' }] });
      if (pick === 'practice') return say(life.clubAct('sports_team', 'practice'));
      if (pick === 'quit') return say(edu.quitClub('sports_team'));
      return undefined;
    }
    if (go === 'nurse') return say(cliques.nurse());
    if (go === 'skipgrade') return say(edu.skipGrade());
    if (go === 'rec') return say(askForRecommendation(recommenders()));
    if (go === 'summer') {
      const pick = await pickModal({ title: 'Summer Programs', body: 'One a summer. Camps teach; competitions are placed in, and wins count on college applications.',
        options: summerOptions(player()).map((o) => ({ value: o.id, label: `${o.emoji} ${o.name}${o.level ? ` (${o.level} level)` : ''}`, sub: o.why || `${o.blurb}${o.cost && player().age >= 18 ? ` ${fmtMoney(o.cost, country())}.` : ''}`, disabled: !!o.why })) });
      if (pick) return say(goToSummer(pick));
      return;
    }
    if (go === 'early') return say(edu.startCollegeEarly());
    if (go) { stack.push(go); return draw(); }
    const act = t.closest('[data-do]')?.dataset.do;
    if (act === 'study') return say(edu.studyHard());
    if (act === 'slack') return say(edu.slackOff());
    if (act === 'skip') return say(edu.skipSchool());
    if (act === 'drop') {
      const sure = await confirmModal({ title: 'Drop out?', body: 'You will leave without a diploma and cannot go back. Your parents will not be pleased.', yes: 'Drop out', danger: true });
      if (sure) { await say(edu.dropOut()); m.close(); }
      return undefined;
    }
    const focus = t.closest('[data-focus]')?.dataset.focus;
    if (focus) { sch.setFocus(focus); onChange?.(); return draw(true); }
    if (t.closest('[data-courses]')) { await chooseCourses(onChange); return draw(); }
    const ca = t.closest('[data-club-act]');
    if (ca && !ca.disabled) { const [club, a] = ca.dataset.clubAct.split(':'); return say(life.clubAct(club, a)); }
    const leave = t.closest('[data-leave-club]')?.dataset.leaveClub;
    if (leave) return say(edu.quitClub(leave));
    const join = t.closest('[data-join]')?.dataset.join;
    if (join) {
      // A try-out first shows how you measure up: two bars, no odds. It can still go either way on the day.
      const c = edu.clubOptions().find((x) => x.id === join);
      if (c?.bars && !(await tryoutAsk(c.name, c.bars, 'Club Wants'))) return undefined;
      return say(edu.joinClub(join));
    }
    const out = t.closest('[data-outclub]')?.dataset.outclub;
    if (out) { await openClubs({ changed: () => onChange?.() }, out); return draw(true); }
    const team = t.closest('[data-team]')?.dataset.team;
    if (team) {
      const e = player().education;
      if (e.clubs.includes('sports_team')) { life.setSport(team); return say({ ok: true, text: `You switched to the ${sportName(team)} team.`, tone: 'good' }); }
      const bars = edu.clubOptions().find((x) => x.id === 'sports_team')?.bars;
      if (bars && !(await tryoutAsk(`${cap(sportName(team))} team`, bars, 'Coach Wants'))) return undefined;
      const r = edu.joinClub('sports_team');
      if (r.ok) life.setSport(team);
      return say(r.ok ? { ...r, text: `You made the ${sportName(team)} team.` } : r);
    }
    const who = t.closest('[data-person]')?.dataset.person;
    if (who) {
      const n = store.state.npcs[who];
      if (n) { const { openNpc } = await import('./tabs/people.js'); openNpc(n, { changed: () => { onChange?.(); draw(true); } }); }
      return undefined;
    }
    const cq = t.closest('[data-clique]')?.dataset.clique;
    if (cq) {
      const c = cliques.cliqueList().find((x) => x.id === cq);
      const pick = await pickModal({ title: c.name, body: `${c.desc} ${c.who}${c.leader ? ` ${c.leader.firstName} ${c.leader.lastName} runs it.` : ''}${c.why && !c.current ? ` Right now: ${c.why}.` : ''}`,
        options: c.current ? [{ value: 'leave', label: 'Stop sitting with them' }]
          : cq === 'loners' ? [{ value: 'ask', label: 'Keep to yourself' }]
            : [{ value: 'ask', label: 'Ask to join them', html: fitBar('How You Fit', c.fit * 100) }, { value: 'hangout', label: 'Start hanging out with them' },
              { value: 'compliment', label: `Compliment ${c.leader?.firstName ?? 'their leader'}` }, { value: 'insult', label: `Insult ${c.leader?.firstName ?? 'their leader'}` }] });
      return pick ? say(cliques.cliqueAct(cq, pick)) : undefined;
    }
    return undefined;
  });
  draw();
}
