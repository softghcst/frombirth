// School, as a book: where the player is at school and how they are doing in
// each subject, who is there with them, and every school they have been to.
// Rules: engine/schooling.js. Everything shown comes from the saved life.
import { player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import * as sch from '../engine/schooling.js';
import { gradingNote } from '../engine/grades.js';
import { KIND_BY_ID } from '../data/education.js';
import { roleLabel } from '../engine/relationships.js';
import { avatarSvg } from './avatar.js';
import { meterHtml } from './meter.js';
import { openModal, pickModal, messageModal } from './modals.js';

const face = (n) => avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: 60 });
const person = (n, side) => `<div class="row dyn-row"><div class="avatar">${face(n)}</div>
  <div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(side)}</small></div>
  <div class="side">${Math.round(n.meters.relationship)}%</div></div>`;

function pageOverview(v) {
  const p = player();
  if (!v.school) return `<p class="muted">${p.age < 5 ? 'School has not started yet.' : 'You are not at school.'}</p>`;
  const kind = v.kind;
  return `<div class="kv"><span>School</span><span><strong>${esc(v.school.kind === 'home' ? 'Taught at home' : v.school.name)}</strong></span></div>
    <div class="kv"><span>Kind</span><span>${esc(kind.name)}</span></div>
    <div class="kv"><span>Stage</span><span>${esc(v.stageName)}, year ${v.year}</span></div>
    ${v.school.kind !== 'home' ? `<div class="kv"><span>Head</span><span>${esc(v.school.head)}</span></div><div class="kv"><span>Founded</span><span>${v.school.founded}</span></div>` : ''}
    <div class="kv"><span>Fees</span><span>${v.fee ? `${fmtMoney(v.fee, country())} a year, paid by your family` : 'None'}</span></div>
    <div class="kv"><span>Overall</span><span>${v.overall ?? 'No marks yet'}</span></div>
    <div class="kv"><span>Days skipped this year</span><span>${v.absences}</span></div>
    <p class="muted" style="margin:8px 0">${esc(kind.blurb)} ${esc(gradingNote(v.grading))} School here ends at 18 with ${/^[aeiou]/i.test(v.leaving) && !/s$/.test(v.leaving) ? 'an' : /s$/.test(v.leaving) ? '' : 'a'} ${esc(v.leaving)}.</p>
    ${v.family.length ? `<p class="dyn-reach">${esc(v.family.join(', '))} ${v.family.length === 1 ? 'was' : 'were'} here before you.</p>` : ''}
    ${meterHtml('Effort', v.effort, true)}
    ${sch.choices().length ? '<button class="btn" data-move style="margin-top:10px;width:100%">Ask to change schools</button>' : ''}`;
}

function pageSubjects(v) {
  if (!v.subjects.length) return '<p class="muted">No subjects yet.</p>';
  return `<p class="muted" style="margin-bottom:8px">A mark comes from ability, work, interest, attendance and teaching together. ${v.focus ? '' : 'You can give one subject extra attention each year.'}</p>
    ${v.subjects.map((s) => `<div class="card sub-card ${v.focus === s.id ? 'on' : ''}">
      <div class="sub-head"><strong>${esc(s.name)}</strong><span class="sub-mark">${s.mark ?? '–'}</span></div>
      ${meterHtml('Interest', s.interest, true)}
      ${s.why ? `<p class="muted">Last year: ${esc(s.why)}.</p>` : ''}
      ${s.teacher ? `<p class="muted">Taught by ${esc(s.teacher.firstName)} ${esc(s.teacher.lastName)}, who is ${esc(sch.teacherLine(s.teacher))}.</p>` : ''}
      <button class="btn" data-focus="${s.id}" ${v.focus === s.id ? 'disabled' : ''}>${v.focus === s.id ? 'Getting your extra attention this year' : 'Give this extra attention this year'}</button>
    </div>`).join('')}`;
}

function pagePeople(v) {
  const old = v.friends.filter((n) => n.alive);
  return `${v.teachers.length ? `<div class="section-label">Teachers</div>${v.teachers.map((t) => person(t, `${t.flags.title} · ${sch.teacherLine(t)}`)).join('')}` : ''}
    <div class="section-label">Your class</div>
    ${v.classmates.length ? v.classmates.map((n) => person(n, `Age ${n.age}`)).join('') : '<p class="muted">Nobody else is in your class.</p>'}
    ${old.length ? `<div class="section-label">Friends from school</div>${old.map((n) => person(n, `${roleLabel(n)} · met at ${n.flags.metAt}`)).join('')}` : ''}
    <p class="muted" style="margin-top:8px">Spend time with any of them from the People tab. Friends you make here stay your friends when school ends.</p>`;
}

function pageHistory(v) {
  const p = player();
  const degrees = p.education.degrees.filter((d) => d.type !== 'high');
  if (!v.history.length && !degrees.length) return '<p class="muted">Nothing yet.</p>';
  const how = { completed: 'completed', 'moved on': 'moved up', left: 'left early', expelled: 'expelled' };
  return v.history.map((h) => `<div class="dyn-event"><span class="num">${h.from}–${h.to ?? ''}</span><span><strong>${esc(h.kind === 'home' ? 'Taught at home' : h.name)}</strong><br>${esc(h.stageName)} · ${esc(KIND_BY_ID[h.kind].name)}${h.to != null ? ` · ${how[h.how] ?? 'left'}${h.mark ? `, ${sch.mark(h.mark)}` : ''}` : ' · now'}</span></div>`).join('')
    + degrees.map((d) => `<div class="dyn-event"><span class="num">${d.age}</span><span><strong>${esc(d.school ?? d.type)}</strong><br>GPA ${d.gpa.toFixed(2)}</span></div>`).join('');
}

/** Opens the school book. `onChange` is called when something the player did changes the life. */
export function openSchool(onChange) {
  const tabs = [['overview', 'School'], ['subjects', 'Subjects'], ['people', 'People'], ['history', 'History']];
  let tab = 'overview';
  const m = openModal(`
    <div class="dyn-head"><div><div class="eyebrow">Education</div><h2>School</h2></div>
      <button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="dyn-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
    <div class="dyn-body" data-body></div>`, { dismissable: true });
  m.el.classList.add('dyn-modal');
  const body = m.el.querySelector('[data-body]');
  function draw(keep = false) {
    const v = sch.view();
    const top = body.scrollTop;
    m.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    body.innerHTML = tab === 'overview' ? pageOverview(v) : tab === 'subjects' ? pageSubjects(v) : tab === 'people' ? pagePeople(v) : pageHistory(v);
    body.scrollTop = keep ? top : 0;
  }
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; return draw(); }
    const f = e.target.closest('[data-focus]');
    if (f) { sch.setFocus(f.dataset.focus); onChange?.(); return draw(true); }
    if (e.target.closest('[data-move]')) {
      const kind = await pickModal({ title: 'Ask to change schools', cancel: 'Never mind', body: 'You can ask once at each stage of school. Your family decides, and friends you have made stay your friends.',
        options: sch.choices().map((k) => ({ value: k.id, label: k.name, sub: k.why || `${k.blurb} ${k.fee}`, disabled: !!k.why })) });
      if (!kind) return undefined;
      const r = sch.askToMove(kind);
      onChange?.();
      await messageModal({ body: r.text, tone: r.tone });
      return draw();
    }
    return undefined;
  });
  draw();
}
