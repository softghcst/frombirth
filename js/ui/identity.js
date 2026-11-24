// Screens for identity (orientation, gender, name, transition) and for
// practicing skills. The Self tab opens these.
import { faceGenderOf } from '../avatar/render.js';
import { player, country } from '../state.js';
import { fmtMoney, esc } from '../util.js';
import * as who from '../engine/identity.js';
import * as skill from '../engine/skills.js';
import { messageModal, pickModal, confirmModal, inputModal } from './modals.js';
import { meterHtml } from './meter.js';
import { openAppearanceEditor } from '../avatar/editor.js';

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

/** The lines shown on the Self tab's Identity card. */
export function identityRows() {
  const p = player();
  const id = who.identity();
  const trans = who.isTrans() && (id.knows || id.outGender);
  const gender = (p.age < 18 ? { female: 'Girl', male: 'Boy', nonbinary: 'Non-binary' } : { female: 'Woman', male: 'Man', nonbinary: 'Non-binary' })[p.gender];
  const rows = [['Gender', trans && p.gender !== who.bornAs() ? `${gender} (transgender)` : gender]];
  const journey = who.questLine();
  if (journey) rows.push([journey.startsWith('Questioning') ? 'Exploring' : 'Inside', journey.replace(/^Questioning: /, '').replace(/^./, (x) => x.toUpperCase())]);
  if (p.age >= 12) rows.push(['Sexuality', `${who.orientationName(p.orientation)}${p.orientation !== 'straight' ? (id.outOrientation ? ', out' : ', not out') : ''}`]);
  if (id.hrtAge != null) rows.push(['Hormone therapy', `Since age ${id.hrtAge}`]);
  if (id.top || id.bottom) rows.push(['Surgery', [id.top ? 'top' : '', id.bottom ? 'bottom' : ''].filter(Boolean).join(' and ')]);
  if (id.legal) rows.push(['Legal gender', 'Changed']);
  if (id.names.length) rows.push(['Former name', id.names[0]]);
  return rows;
}

export async function openIdentity(api) {
  const p = player();
  const c = country();
  const id = who.identity();
  const options = [];
  const q = who.quest();
  if (q.stage === 'questioning') options.push({ value: 'explore', label: 'Keep exploring your gender', sub: 'Try something, and see how it feels.' });
  else if (who.canQuestion()) options.push({ value: 'question', label: 'Explore your gender', sub: q.stage === 'settled' ? 'You asked before and had your answer. You can always ask again.' : 'Wonder about it, and try things. There is no wrong answer.' });
  if (who.canTransition() && (who.discovered() || q.stage === 'questioning' || q.stage === 'settled')) options.push({ value: 'gender', label: 'Live as a different gender', sub: 'Tell the people around you who you are.' });
  options.push({ value: 'name', label: 'Change your first name', sub: p.age >= who.AGES.nameAlone ? `${fmtMoney(Math.round(who.COSTS.name * c.currency.scale), c)} in paperwork.` : 'Under 18, a parent on your side has to sign.' });
  if (p.age >= who.AGES.comeOut) options.push({ value: 'orientation', label: 'Sexuality', sub: `Now: ${who.orientationName(p.orientation).toLowerCase()}.` });
  if (who.canComeOut()) options.push({ value: 'comeout', label: 'Come out', sub: 'Tell your family and friends. They will each take it their own way.' });
  if (who.canStartHrt()) options.push({ value: 'hrt', label: 'Start hormone therapy', sub: `${fmtMoney(who.hrtCost(), c)} a year.${p.age < 18 ? ' Needs a parent\'s consent.' : ''}` });
  if (id.hrtAge != null) options.push({ value: 'stophrt', label: 'Stop hormone therapy' });
  for (const s of who.surgeryOptions()) {
    options.push({ value: `surgery:${s.id}`, label: s.name, disabled: s.done || !s.affordable || !!s.needsHrt,
      sub: s.done ? 'Done.' : s.needsHrt ? 'Needs a year on hormones first.' : `${fmtMoney(s.cost, c)}.${s.waitingList ? ' There is a waiting list.' : ''}` });
  }
  if (who.canChangeLegalGender()) options.push({ value: 'legal', label: 'Change your legal gender', sub: `${fmtMoney(Math.round(who.COSTS.legal * c.currency.scale), c)} court fee.` });

  const pick = await pickModal({ title: 'Identity', body: 'Who you are is yours to decide, and to share when you are ready.', options });
  if (!pick) return undefined;
  if (pick === 'question') { await report(api, who.startQuestioning()); return openExplore(api); }
  if (pick === 'explore') return openExplore(api);
  if (pick === 'gender') {
    const g = await pickModal({ title: 'Live as', options: who.GENDERS.filter((x) => x.id !== p.gender).map((x) => ({ value: x.id, label: { female: 'A woman', male: 'A man', nonbinary: 'Non-binary' }[x.id] })) });
    if (!g) return undefined;
    const sure = await confirmModal({ title: 'Tell everyone?', body: 'Your family and friends will each respond in their own way. Some may need time. A few may never accept it.', yes: 'Tell them' });
    return sure ? report(api, who.liveAs(g)) : undefined;
  }
  if (pick === 'name') {
    const name = await inputModal({ title: 'A new name', label: 'First name', value: '', maxLength: 20 });
    return name ? report(api, who.changeName(name)) : undefined;
  }
  if (pick === 'orientation') {
    const o = await pickModal({ title: 'You are', options: who.ORIENTATIONS.map((x) => ({ value: x.id, label: x.name, disabled: x.id === p.orientation })) });
    return o ? report(api, who.setOrientation(o)) : undefined;
  }
  if (pick === 'comeout') return report(api, who.comeOut());
  if (pick === 'hrt') return report(api, who.startHrt());
  if (pick === 'stophrt') return report(api, who.stopHrt());
  if (pick === 'legal') return report(api, who.changeLegalGender());
  return report(api, who.haveSurgery(pick.split(':')[1]));
}

/** Questioning: things to try, one at a time, two a year. */
async function openExplore(api) {
  const p = player();
  const c = country();
  const q = who.quest();
  if (q.stage !== 'questioning') return undefined;
  const opts = who.exploreOptions();
  const pick = await pickModal({ title: 'Exploring', body: `${who.questLine().replace(/^Questioning: /, '').replace(/^./, (x) => x.toUpperCase())}. Two things a year.`, cancel: 'Back',
    options: [...opts.map((o) => ({ value: o.id, label: o.label, disabled: !!o.why, sub: o.why ? o.why.replace(/^./, (x) => x.toUpperCase()) : o.cost ? fmtMoney(o.cost, c) : '' })),
      { value: 'stop', label: 'Stop exploring for now' }] });
  if (!pick) return undefined;
  if (pick === 'stop') return report(api, who.stopQuestioning());
  if (opts.find((o) => o.id === pick)?.look) {
    const next = await openAppearanceEditor({ title: 'A different look', appearance: p.appearance, age: p.age, gender: p.gender, face: faceGenderOf(p), seed: p.id, scope: 'style', confirm: 'Try it' });
    if (next) p.appearance = next;
  }
  return report(api, who.explore(pick));
}

/** The Skills card on the Self tab. */
/** The skills the player practices. `inner`: without a card of its own, to sit inside another (Self, Talents and skills). */
export function skillsCard({ inner = false } = {}) {
  if (!skill.canPractise()) return '';
  const mine = skill.practiced();
  const left = skill.sessionsLeft();
  const body = `${mine.length ? mine.map((s) => meterHtml(`${s.name} · ${s.levelName}`, s.level, true)).join('') : '<p class="muted">You have not taken anything up yet.</p>'}
    <button class="btn" data-practice style="margin-top:10px" ${left <= 0 ? 'disabled' : ''}>Practice Skills</button>
    <p class="muted" style="margin:6px 0 0;font-size:0.85rem">${left > 0 ? `${left} ${left === 1 ? 'session' : 'sessions'} left this year.` : 'No sessions left this year.'}</p>`;
  return inner ? `<div class="section-label">Skills</div>${body}` : `<div class="card"><h3>Skills</h3>${body}</div>`;
}

export async function openPractice(api) {
  const p = player();
  const c = country();
  const groups = skill.skillOptions();
  const group = await pickModal({ title: 'Practice', body: `${skill.sessionsLeft()} sessions left this year. Things you have a gift for come faster.`,
    options: groups.map((g) => {
      const going = g.skills.filter((s) => s.started);
      return { value: g.id, label: g.name, sub: going.length ? going.map((s) => `${s.name} ${s.level}%`).join(' · ') : `${g.skills.length} to choose from.` };
    }) });
  if (!group) return undefined;
  const id = await pickModal({ title: groups.find((g) => g.id === group).name,
    body: group === 'language' ? 'A language spoken well makes it easier to move to a country where it is used and to find work there, counts with employers anywhere, and helps a leader abroad. Living in a country teaches its language slowly.' : undefined,
    options: groups.find((g) => g.id === group).skills.map((s) => ({ value: s.id, label: s.name, disabled: !!s.tooYoung || s.mastered,
      sub: s.tooYoung ? `From age ${s.tooYoung}.` : `${s.level}% · ${s.levelName}${s.natural ? ' · you have a gift for this' : ''}` })) });
  if (!id) return undefined;
  const how = await pickModal({ title: 'How?', options: [
    { value: 'self', label: 'Practice on your own', sub: 'Free.' },
    { value: 'lesson', label: 'Take lessons', sub: skill.familyPays(p) ? 'Your family pays. You learn half as much again.' : `${fmtMoney(skill.lessonCost(), c)}. You learn half as much again.` },
  ] });
  return how ? report(api, skill.practice(id, how === 'lesson')) : undefined;
}

export { esc };
