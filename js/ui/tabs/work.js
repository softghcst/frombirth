// Work & School tab. Phase 3 and 4 add the actions; this shows current standing.
import { player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { stageLabel } from '../../engine/education.js';

export default {
  id: 'work', title: 'Work & School', short: 'Work',
  icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  render(el) {
    const p = player();
    const c = country();
    const e = p.education;
    const k = p.career;

    const school = e.stage === 'none'
      ? '<p class="muted">You have not started school yet.</p>'
      : `
        <div class="kv"><span>Stage</span><span>${esc(stageLabel(e.stage))}</span></div>
        <div class="kv"><span>Status</span><span>${e.enrolled ? `Enrolled, year ${e.yearInStage + 1}` : e.expelled ? 'Expelled' : e.droppedOut ? 'Dropped out' : 'Finished'}</span></div>
        <div class="kv"><span>GPA</span><span>${e.gpa ? e.gpa.toFixed(2) : 'No grades yet'}</span></div>
        ${e.degrees.map((d) => `<div class="kv"><span>Completed</span><span>${esc(stageLabel(d.type))}, age ${d.age}</span></div>`).join('')}`;

    const job = k.title
      ? `
        <div class="kv"><span>Role</span><span>${esc(k.title)}</span></div>
        <div class="kv"><span>Salary</span><span>${fmtMoney(k.salary, c)} / year</span></div>
        <div class="kv"><span>Performance</span><span>${Math.round(k.performance)}%</span></div>
        <div class="kv"><span>Years in role</span><span>${k.yearsInRole}</span></div>`
      : `<p class="muted">${p.age < 15 ? 'You are too young to work.' : k.retired ? 'You are retired.' : 'You do not have a job.'}</p>`;

    const past = k.history.length
      ? k.history.map((h) => `<div class="kv"><span>${esc(h.title)}</span><span>Age ${h.from}–${h.to}</span></div>`).join('')
      : '<p class="muted">No past jobs.</p>';

    el.innerHTML = `
      <div class="card"><h3>Education</h3>${school}</div>
      <div class="card"><h3>Career</h3>${job}</div>
      <div class="card"><h3>Work history</h3>${past}</div>`;
  },
};
