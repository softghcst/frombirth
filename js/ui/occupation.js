// The Occupation Hub: one place for a working life. Current jobs, the people
// at work, the job market, offers and recruiters, part-time work, freelancing,
// special careers, the military, qualifications, history and retirement.
// Every section reads the engine; every button does something.
import { player, country, store } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREERS, CAREER_BY_ID } from '../data/careers.js';
import { FAMILIES, FAMILY_BY_ID } from '../data/occupations.js';
import { CERTS } from '../data/schools.js';
import { RATES, AVAILABILITY } from '../data/freelance.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { meterHtml } from './meter.js';
import { avatarSvg } from './avatar.js';
import * as career from '../engine/career.js';
import * as market from '../engine/employers.js';
import * as hiring from '../engine/hiring.js';
import * as work from '../engine/worklife.js';
import * as place from '../engine/workplace.js';
import * as side from '../engine/sideJobs.js';
import * as pt from '../engine/partTime.js';
import * as free from '../engine/freelance.js';
import * as recruit from '../engine/recruiters.js';
import * as record from '../engine/careerRecord.js';
import { roleLabel } from '../engine/relationships.js';
import { rule } from '../engine/rules.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const money = (n, c = country()) => fmtMoney(n, c);
const years = (n) => `${n} ${n === 1 ? 'year' : 'years'}`;
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
const face = (n) => `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters.relationship, label: n.firstName })}</div>`;
const person = (n, side = '') => `<button type="button" class="row world-row" data-act="colleague" data-arg="${n.id}">${face(n)}
  <div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(roleLabel(n))}${n.occupation ? ` · ${esc(n.occupation)}` : ''}${n.flags.mentor ? ' · mentor' : ''}</small></div>
  <div class="side">${side || `${Math.round(n.meters.relationship)}%`}</div></button>`;

const SECTIONS = [
  ['now', 'Current jobs'], ['workplace', 'Workplace'], ['find', 'Find a job'], ['offers', 'Offers & recruiters'], ['parttime', 'Part-time'],
  ['freelance', 'Freelance'], ['special', 'Special careers'], ['military', 'Military'], ['quals', 'Qualifications'], ['history', 'History'], ['retire', 'Retirement'],
];

/** Which sections make sense for this person now. */
function sectionsFor(p) {
  const law = work.workLaw();
  const c = work.career();
  return SECTIONS.filter(([id]) => {
    if (id === 'workplace') return !!c.employerId;
    if (['find', 'offers'].includes(id)) return p.age >= law.workAge;
    if (id === 'parttime') return p.age >= Math.min(law.workAge, 15);
    if (id === 'freelance') return p.age >= 12;
    if (id === 'military') return p.age >= 16;
    if (id === 'retire') return p.age >= 45 || c.retired;
    if (id === 'special') return p.age >= 5;
    return true;
  });
}

/**
 * Opens the hub. api: the tab api ({ changed }) so the rest of the screen updates too.
 * @param {{changed:Function}} api
 * @param {string} [start] a section id
 */
export function openOccupation(api, start = 'now') {
  const st = { section: start, scope: 'here', family: null, kind: 'all', eligibleOnly: true };
  const modal = openModal('<div data-occ></div>', { dismissable: true });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-occ]');

  const render = () => {
    const p = player();
    const list = sectionsFor(p);
    if (!list.some(([id]) => id === st.section)) st.section = 'now';
    root.innerHTML = `
      <h2 style="margin-top:0">Work</h2>
      <div class="world-groups" role="tablist" aria-label="Sections">${list.map(([id, label]) => `<button type="button" role="tab" class="world-group av-chip ${id === st.section ? 'on' : ''}" aria-selected="${id === st.section}" data-sec="${id}">${esc(label)}</button>`).join('')}</div>
      <div style="margin-top:10px">${VIEWS[st.section](p, st)}</div>
      <div class="btn-stack" style="margin-top:12px"><button type="button" class="btn" data-close>Close</button></div>`;
  };
  const refresh = () => { api.changed(); render(); };
  const say = async (r) => { refresh(); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); render(); };

  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) { modal.close(); return; }
    const sec = t.closest('[data-sec]');
    if (sec) { st.section = sec.dataset.sec; render(); modal.el.scrollTop = 0; return; }
    const b = t.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) await fn(b.dataset.arg, { st, say, refresh, render, api, close: () => modal.close() });
  });
  render();
  return modal;
}

// ---------- Views ----------

function jobCard(p) {
  const c = work.career();
  const car = CAREER_BY_ID[c.careerId];
  if (!car) {
    const why = c.retired ? `Retired${c.retiredAge ? ` at ${c.retiredAge}` : ''}.` : p.age < work.workLaw().workAge ? 'Too young for ordinary work.' : 'Not in a full-time job.';
    return `<div class="card"><h3>Main job</h3><p class="muted">${esc(why)}</p>${c.benefit ? kv([['Unemployment benefit', `${money(c.benefit.amount)} this year`]]) : ''}</div>`;
  }
  const e = market.employer(c.employerId);
  const step = career.nextStep();
  const away = work.onLeave(c);
  return `<div class="card"><h3>${esc(c.title)}</h3>
    ${kv([
    ...(e ? [['Employer', `${e.name}, ${e.city}`]] : [['Working', car.type === 'freelance' ? 'For yourself' : '—']]),
    ['Field', `${car.name} · ${FAMILY_BY_ID[car.family]?.name ?? ''}`],
    [car.type === 'freelance' ? 'Earnings this year' : car.payModel === 'hourly' ? 'Pay (at contracted hours)' : 'Salary', `${money(c.salary)} a year${car.payModel === 'commission' ? ' + commission' : car.payModel === 'tips' ? ' + tips' : ''}`],
    ['Hours', `${c.hours}${c.extra > 0 ? ` + ${c.extra} overtime` : c.extra < 0 ? ` − ${-c.extra}` : ''} a week · ${car.schedule.replace('_', '-')}${c.remote !== 'none' ? ` · ${c.remote === 'remote' ? 'from home' : 'hybrid'}` : ''}`],
    ['In this role', years(c.yearsInRole)],
    ...(away ? [['On leave', away]] : []),
    ...(c.military ? [['Service', `${c.military.branch} · ${c.military.deployments} deployments${c.military.honours ? ` · ${c.military.honours} honours` : ''}`]] : []),
    ...(c.missions ? [['Space missions', String(c.missions)]] : []),
    ['Next step', step ? `${step.title}${step.missing.length ? `: needs ${step.missing.join(' and ')}` : step.yearsLeft > 0 ? `, in about ${years(step.yearsLeft)} with good reviews` : ', when a seat opens and a good review lands'}` : 'You are at the top.'],
  ])}
    <div style="margin-top:8px">${meterHtml('Performance', c.performance, true)}${meterHtml('Satisfaction', c.satisfaction, true)}${meterHtml('Stress', c.stress, true)}</div>
    ${work.benefits().length ? `<div class="section-label">Benefits</div><p style="margin:4px 0">${esc(work.benefits().join(' · '))}</p>` : ''}
  </div>`;
}

function mainActions(p) {
  const c = work.career();
  const car = CAREER_BY_ID[c.careerId];
  if (!car) return '';
  const lat = place.lateralOptions();
  return `<div class="btn-stack">
    ${btn('harder', 'Work harder this year', { sub: 'Effort shows most when there is room to improve. It costs you.' })}
    ${btn('slack', 'Take it easy this year')}
    ${car.type !== 'freelance' ? btn('raise', 'Ask for a raise') : ''}
    ${car.type !== 'freelance' && car.levels[c.level + 1] ? btn('promo', 'Put yourself forward for promotion') : ''}
    ${lat.length ? btn('lateral', 'Move across to another track', { sub: lat.map((x) => x.name).join(', ') }) : ''}
    ${btn('hours', 'Change your hours')}
    ${car.remote !== 'none' && car.type !== 'freelance' ? btn('remote', 'Ask to work from home') : ''}
    ${btn('leave', 'Take leave')}
    ${btn('values', 'What matters to you in work', { sub: c.values.length ? c.values.join(', ') : 'Not said yet' })}
    ${btn('quitmain', 'Resign', { cls: 'danger' })}
  </div>`;
}

const VIEWS = {
  now(p) {
    const c = work.career();
    const load = work.weeklyLoad();
    const sides = side.allSides();
    const fl = free.freelanceSummary();
    const last = c.lastPay;
    return `${jobCard(p)}${mainActions(p)}
      ${sides.length ? `<div class="card"><h3>Part-time</h3>${kv(sides.map((s) => [s.title, `${s.place ? `${s.place} · ` : ''}${s.hours ?? 12} h/week · ${money(s.salary)} a year`]))}</div>` : ''}
      ${fl.services ? `<div class="card"><h3>Freelance</h3>${kv([['Services offered', String(fl.services)], ['Active contracts', `${fl.active.length} (${fl.hours} h/week)`], ['Due on completion', money(fl.due)], ['Completed, ever', String(fl.done)]])}</div>` : ''}
      <div class="card"><h3>Your week: ${esc(load.word.toLowerCase())}</h3>${load.rows.length ? kv(load.rows.map((r) => [r.label, `${r.hours} h`])) + kv([['Total', `${load.total} hours a week`]]) : '<p class="muted">Nothing booked.</p>'}
        ${p.age < 18 && p.age >= work.workLaw().workAge ? `<p class="muted" style="margin-top:6px">Under 18, the law here allows ${work.workLaw().minorHours} hours of paid work a week in term time.</p>` : ''}</div>
      ${last?.lines?.length ? `<div class="card"><h3>Last year's pay</h3>${kv(last.lines.map((l) => [l.label, money(l.gross)]))}${kv([['Gross', money(last.gross)], ...(last.tax != null ? [['Tax', money(last.tax)], ['Take-home', money(last.gross - last.tax)]] : [])])}</div>` : ''}`;
  },

  workplace(p) {
    const c = work.career();
    const e = market.employer(c.employerId);
    if (!e) return '<p class="empty">You are not working for an employer.</p>';
    const t = place.team();
    const cult = market.cultureOf(e);
    return `<div class="card"><h3>${esc(e.name)}</h3>${kv([['What they do', market.describe(e)], ['Culture', `${cult.label}: ${cult.blurb}`], ['Reputation', `${market.reputation(e)}/100`],
      ['Finances', e.health >= 70 ? 'Doing well' : e.health >= 40 ? 'Steady' : e.health >= 20 ? 'Struggling' : 'In trouble'], ['Founded', String(e.founded)]])}
      ${e.history.length ? `<div class="section-label">Recently</div>${e.history.slice(-5).reverse().map((h) => `<p style="margin:3px 0">${h.year}: ${esc(h.text)}</p>`).join('')}` : ''}</div>
      ${t.boss ? `<div class="section-label">${esc(t.boss.flags.title ?? 'Boss')}</div>${person(t.boss)}` : ''}
      ${t.coworkers.length ? `<div class="section-label">Coworkers</div>${t.coworkers.map((n) => person(n)).join('')}` : ''}
      ${t.reports.length ? `<div class="section-label">Your team</div>${t.reports.map((n) => person(n)).join('')}` : ''}
      ${t.mentors.length ? `<div class="section-label">Mentors</div>${t.mentors.map((n) => person(n)).join('')}` : ''}
      ${t.former.length ? `<div class="section-label">People you used to work with (${t.former.length})</div>${t.former.slice(0, 8).map((n) => person(n, n.flags.workedWith ? esc(n.flags.workedWith) : '')).join('')}` : ''}`;
  },

  find(p, st) {
    const posts = market.board({ scope: st.scope, family: st.family, partTime: st.kind === 'full' ? false : st.kind === 'part' ? true : null });
    const views = posts.map((x) => hiring.postingView(x.id)).filter((v) => v && (!st.eligibleOnly || v.eligible));
    const chip = (key, val, label) => `<button type="button" class="world-group av-chip ${st[key] === val ? 'on' : ''}" data-act="filter" data-arg="${key}:${val}">${esc(label)}</button>`;
    return `<p class="muted" style="margin:0 0 6px">Openings come from real employers and stay up until someone takes them. Other people are applying too.</p>
      <div class="world-groups">${chip('scope', 'here', p.city)}${chip('scope', 'country', 'Whole country')}${chip('scope', 'remote', 'Remote')}</div>
      <div class="world-groups">${chip('kind', 'all', 'All')}${chip('kind', 'full', 'Full-time')}${chip('kind', 'part', 'Part-time')}${chip('eligibleOnly', true, 'You qualify')}${chip('eligibleOnly', false, 'Everything')}
        <button type="button" class="world-group av-chip ${st.family ? 'on' : ''}" data-act="family">${esc(st.family ? FAMILY_BY_ID[st.family].name : 'Any field')}</button></div>
      <p class="muted" style="margin:6px 0">${views.length} ${views.length === 1 ? 'opening' : 'openings'}</p>
      <div class="world-list">${views.slice(0, 60).map((v) => `<button type="button" class="row world-row" data-act="posting" data-arg="${v.post.id}">
        <div class="main"><strong>${esc(v.post.title)}</strong><small>${esc(v.employer.name)} · ${esc(v.post.city)}${v.post.remote !== 'none' ? ` · ${v.post.remote}` : ''}${v.post.partTime ? ` · ${v.post.hours} h/week` : ''}</small>
        <small>${v.eligible ? (v.note ? esc(v.note) : 'You can apply.') : esc(v.reasons[0])}</small></div>
        <div class="side">${money(v.post.pay[0], COUNTRIES[v.post.countryId])}<br>–${money(v.post.pay[1], COUNTRIES[v.post.countryId])}</div></button>`).join('') || '<p class="empty">Nothing matching right now. New openings appear every year.</p>'}</div>`;
  },

  offers() {
    const offers = hiring.offers();
    const leads = recruit.leads();
    return `<div class="section-label">Job offers</div>
      ${offers.length ? offers.map((o) => `<div class="card"><h3>${esc(o.title)}</h3>${kv([['Employer', market.employer(o.employerId)?.name ?? '—'], ['Pay', `${money(o.salary, COUNTRIES[market.employer(o.employerId)?.countryId ?? player().countryId])} a year`], ['Hours', `${o.hours} a week${o.remote !== 'none' ? ` · ${o.remote}` : ''}`],
        ['Benefits', hiring.offerTerms(o).benefits.join(', ') || '—']])}
        <div class="btn-stack" style="margin-top:8px">${btn('accept', 'Accept', { cls: 'primary', arg: o.id })}
        ${['salary', 'hours', 'remote', 'time'].map((w) => btn('negotiate', { salary: 'Ask for more money', hours: 'Ask for fewer hours', remote: 'Ask to work from home', time: 'Ask for time to decide' }[w], { arg: `${o.id}:${w}`, disabled: !!o.asked[w] })).join('')}
        ${btn('declineoffer', 'Decline', { arg: o.id })}</div></div>`).join('') : '<p class="muted">No offers on the table.</p>'}
      <div class="section-label">Recruiters and contacts</div>
      ${leads.length ? leads.map((l) => `<div class="card"><p style="margin:0 0 6px">${esc(l.text)}</p>
        <div class="btn-stack">${btn('leaddetails', 'Ask for details', { arg: l.id })}${btn('leadapply', 'Go for it', { cls: 'primary', arg: l.id })}${btn('leadrefer', 'Put a friend forward instead', { arg: l.id })}${btn('leaddecline', 'Decline', { arg: l.id })}</div></div>`).join('')
    : '<p class="muted">No recruiter has been in touch. A good record and a few years of experience bring them.</p>'}`;
  },

  parttime(p) {
    const held = side.allSides();
    const opts = pt.canWorkPartTime() ? pt.jobOptions() : [];
    return `${held.length ? `<div class="card"><h3>Your part-time work</h3>${held.map((s) => `${kv([[s.title, `${s.hours ?? 12} h/week · ${money(s.salary)} a year`]])}<div class="btn-stack" style="margin:6px 0">${s.slot ? btn('cover', 'Cover an extra shift') : ''}${btn('quitside', `Leave: ${s.title}`, { cls: 'danger', arg: s.id })}</div>`).join('')}</div>` : ''}
      <p class="muted">A few hours a week, around school, study, another job, or retirement. Part-time openings at employers are on "Find a job" too.</p>
      ${opts.map((j) => btn('takept', j.title, { arg: j.id, disabled: !j.available, sub: j.available ? `At ${j.place}. ${j.hours} hours a week, ${money(j.pay)} a year.${j.campus ? ' Students only.' : ''}` : j.reason })).join('') || '<p class="empty">You have as much part-time work as you can take on.</p>'}`;
  },

  freelance(p) {
    const svc = free.services();
    const f = work.career().freelance;
    const inq = Object.keys(f.services).length && f.hoursOffered ? free.inquiries() : [];
    const active = f.contracts.filter((k) => k.status === 'active');
    return `<p class="muted" style="margin:0 0 6px">Set what you offer and at what price. Clients write once a year; each job you take uses the hours you set aside, and is paid when it is done.</p>
      ${btn('availability', `Hours a week for freelance work: ${f.hoursOffered}`)}
      ${inq.length ? `<div class="section-label">Inquiries this year</div>${inq.map((q) => `<div class="card"><p style="margin:0">${esc(q.client)}${q.regular ? ' (a regular)' : ''}: ${esc(q.serviceName.toLowerCase())}, about ${q.hours} hours, ${money(q.fee)}.</p>
        <div class="btn-stack" style="margin-top:6px">${btn('inqaccept', 'Take it on', { cls: 'primary', arg: q.id })}${btn('inqcounter', 'Ask for more', { arg: q.id, disabled: q.countered })}${btn('inqdecline', 'Pass', { arg: q.id })}</div></div>`).join('')}` : ''}
      ${active.length ? `<div class="section-label">In progress</div>${active.map((k) => `${kv([[`${k.serviceName} for ${k.client}`, `${k.hours} h · ${money(k.fee)}`]])}${btn('gigcancel', 'Drop this job', { arg: k.id, cls: 'danger' })}`).join('')}` : ''}
      <div class="section-label">Services</div>
      ${svc.map((s) => btn('service', `${s.offered ? '✓ ' : ''}${s.name}`, { arg: s.id, disabled: !!s.block && !s.offered,
    sub: s.block && !s.offered ? s.block : s.offered ? `${money(s.hourly)}/hour · reputation ${s.rep}% · ${s.done} done · ${s.clients} regular clients` : `Going rate about ${money(free.hourly(s, 'market'))} an hour.` })).join('')}
      <div class="section-label">One-off gigs</div>
      ${career.canGig() ? btn('gigs', 'Quick one-off jobs', { sub: 'A couple a year, paid on the day.' }) : '<p class="muted">Not yet.</p>'}`;
  },

  special(p) {
    const groups = [
      ['Acting', ['child_actor', 'actor', 'mt_performer', 'voice', 'stunts', 'casting', 'directing']],
      ['Music and dance', ['singer', 'orchestra', 'music_prod', 'dance']],
      ['Sport', ['athlete', 'coaching']],
      ['Modelling and media', ['modelling', 'influencer', 'broadcast']],
      ['Writing', ['author', 'screenwriting']],
      ['Space', ['astronaut']],
    ];
    const pol = p.politics ? `You hold office as ${p.politics.title}.` : 'Running for office goes through elections, not job applications: see Politics on the Work tab.';
    return `<p class="muted" style="margin:0 0 6px">Careers with their own way in: auditions, portfolios, selection boards. They use the same pay, hours and record as any job.</p>
      ${groups.map(([name, ids]) => `<div class="section-label">${esc(name)}</div>${ids.map((id) => CAREER_BY_ID[id]).filter(Boolean).map((t) => {
    const why = career.unmet(t);
    const mine = work.career().careerId === t.id;
    return btn('special', `${t.name}: ${t.levels[0].title}`, { arg: t.id, disabled: mine || !!why.length, sub: mine ? 'Your current work.' : why.length ? why[0] : { audition: 'By audition.', portfolio: 'Show your work.', interview: 'Selection interview.' }[t.hire] ?? '' });
  }).join('')}`).join('')}
      <div class="section-label">Politics</div><p class="muted">${esc(pol)}</p>
      ${career.fame() >= 10 ? btn('fame', `Use your fame (${career.fame()}%)`) : ''}`;
  },

  military(p) {
    const c = work.career();
    const branches = career.branchesHere();
    const conscript = rule('conscription', p.countryId);
    const ranks = (id) => CAREER_BY_ID[id].levels.map((_, i) => career.localTitle(CAREER_BY_ID[id], i, c.military?.branch ?? branches[0])).join(' → ');
    return `${c.military ? `<div class="card"><h3>Your service</h3>${kv([['Branch', c.military.branch], ['Rank', c.title], ['Years served', String(c.yearsInField)], ['Deployments', String(c.military.deployments)], ['Honours', String(c.military.honours ?? 0)],
      ['Pension', CAREER_BY_ID[c.careerId].pensionAfter ? `After ${CAREER_BY_ID[c.careerId].pensionAfter} years' service` : '—']])}</div>` : ''}
      ${p.flags.veteran ? '<p class="muted">You are a veteran. Some employers in public safety, government and logistics look on that kindly.</p>' : ''}
      <div class="card"><h3>The armed forces of ${esc(country().name)}</h3>${kv([['Branches', branches.join(', ')], ['Service', conscript ? 'Compulsory' : 'Voluntary'], ['Enlisted ranks', ranks('enlisted')], ['Officer ranks', ranks('officer')]])}</div>
      ${!c.military ? `<div class="btn-stack">${['enlisted', 'officer'].map((id) => { const why = career.unmet(CAREER_BY_ID[id]); return btn('enlist', id === 'enlisted' ? 'Enlist' : 'Apply for officer training', { arg: id, disabled: !!why.length, sub: why[0] ?? `Selection: fitness, discipline and an interview. Branch: one of ${branches.length}.` }); }).join('')}</div>` : ''}`;
  },

  quals(p) {
    const degrees = p.education.degrees;
    const open = CAREERS.filter((t) => !t.branchOnly && t.type !== 'military' && !career.unmet(t, { ignoreCurrent: true }).length).length;
    const certs = CERTS.filter((x) => !degrees.some((d) => d.type === 'certificate' && d.majorId === x.id));
    const r = hiring.resume();
    return `<div class="card"><h3>Your résumé</h3>${kv([
      ...r.education.map((x) => ['Education', x]), ...r.licences.map((x) => ['Licensed', x]), ...r.internships.map((x) => ['Internship', x]),
      ...r.jobs.map((x) => ['Experience', x]), ...r.service.map((x) => ['Service', x]), ...r.honours.map((x) => ['Honour', x]),
      ['Strengths', r.strengths.join(', ') || '—']])}</div>
      <div class="card"><h3>What it opens</h3><p style="margin:0">You meet the requirements for ${open} of ${CAREERS.filter((t) => !t.branchOnly && t.type !== 'military').length} kinds of work that hire from outside.</p>
      ${certs.length ? `<div class="section-label">A one-year certificate would open</div>${kv(certs.map((x) => [x.name, CAREER_BY_ID[x.opens]?.name ?? x.opens]))}` : ''}
      <p class="muted" style="margin-top:6px">To study (a degree, a certificate, an apprenticeship, part-time alongside work), use "Plan what comes next" on the Work tab.</p></div>
      <div class="card"><h3>Experience by field</h3>${kv(Object.entries(work.career().experience).filter(([id]) => CAREER_BY_ID[id]).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, y]) => [CAREER_BY_ID[id].name, years(Math.round(y))])) || '<p class="muted">None yet.</p>'}</div>`;
  },

  history(p) {
    const line = record.timeline(p);
    const fam = record.familyCareers().filter((r) => !r.current);
    const c = work.career();
    return `<div class="card"><h3>Working life</h3>${line.length ? line.map((h) => `<div class="kv"><span>${esc(h.title)}${h.employer ? `, ${esc(h.employer)}` : ''}${h.kind && h.kind !== 'job' ? ' (part-time)' : ''}</span><span>${h.from}–${h.current ? 'now' : h.to}${h.exit ? ` · ${esc(h.exit)}` : ''}</span></div>`).join('') : '<p class="muted">No jobs yet.</p>'}</div>
      <div class="card"><h3>Milestones</h3>${c.achievements.length ? c.achievements.map((a) => `<div class="kv"><span>${esc(a.name)}</span><span>Age ${a.age}</span></div>`).join('') : '<p class="muted">None yet. They come from the record: years served, promotions, people helped, second starts.</p>'}</div>
      ${fam.length ? `<div class="card"><h3>The family at work</h3>${fam.map((r) => `<div class="contact"><strong>${esc(r.name)} (${r.born}–${r.died ?? ''})</strong><small>${esc(r.topTitle ?? 'No recorded work')}${r.achievements.length ? ` · ${esc(r.achievements.slice(0, 3).join(', '))}` : ''}</small>
        <p style="margin:2px 0">${r.jobs.slice(-4).map((j) => `${esc(j.title)}${j.employer ? ` at ${esc(j.employer)}` : ''} (${j.from}–${j.to})`).join('; ') || ''}</p></div>`).join('')}</div>` : ''}`;
  },

  retire(p) {
    const c = work.career();
    const age = rule('retirementAge', p.countryId);
    return `<div class="card"><h3>Retirement</h3>${kv([['State pension age here', String(age)], ['Your age', String(p.age)],
      ...(c.retired ? [['Pension', `${money(c.pensionPerYear)} a year`]] : [['Pension if you retired now', career.canRetire() ? `${money(career.pensionEstimate())} a year` : 'Not yet eligible'], ['Employer pension saved', money(c.pensionPot)]])])}</div>
      <div class="btn-stack">${!c.retired && career.canRetire() ? btn('retire', 'Retire', { cls: 'primary' }) : ''}
      ${c.careerId && !c.retired ? btn('hours', 'Ease down: fewer hours', { sub: 'Partial retirement, if your employer agrees.' }) : ''}
      ${c.retired ? btn('gotofind', 'Go back to work', { sub: 'Your pension keeps being paid.' }) : ''}
      ${c.retired ? btn('gotofree', 'Consult or freelance', { sub: 'Your experience is worth something to people.' }) : ''}</div>
      <p class="muted" style="margin-top:8px">Retirement keeps your record, your milestones and the people you worked with.</p>`;
  },
};

// ---------- Actions ----------

async function interview(questions) {
  const out = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = await pickModal({ title: `Question ${i + 1} of ${questions.length}`, body: q.q, cancel: 'Say nothing', options: q.a.map((x) => ({ value: x, label: x.t })) });
    out.push(a ?? { t: '', s: 0 });
  }
  return out;
}

/** The whole application for an opening: interview or audition, then the offer. */
async function applyTo(id, ctx, o = {}) {
  const start = hiring.apply(id);
  if (start.kind === 'blocked') return messageModal({ body: start.text });
  let answers = [];
  if (start.kind === 'interview') answers = await interview(start.questions);
  else if (start.kind === 'audition') {
    const piece = await pickModal({ title: 'The audition', body: 'You get one piece. Choose what shows you at your best.', cancel: 'Walk out',
      options: start.pieces.map((x, i) => ({ value: i, label: x.t, sub: x.bonus ? 'A risk. If it comes off, they will remember you.' : '' })) });
    if (piece == null) return undefined;
    answers = [piece];
  }
  const r = hiring.decide(id, answers, o);
  ctx.refresh();
  await messageModal({ body: r.text, tone: r.tone });
  if (r.offer) { ctx.st.section = 'offers'; ctx.render(); }
  return undefined;
}

const ACTIONS = {
  harder: (_, x) => x.say(career.workHarder()),
  slack: (_, x) => x.say(career.slackOffAtWork()),
  raise: (_, x) => x.say(career.askForRaise()),
  promo: (_, x) => x.say(place.applyForPromotion()),
  async lateral(_, x) {
    const id = await pickModal({ title: 'Move across', body: 'A different ladder at the same employer, with the same people. You start at its first rung.',
      options: place.lateralOptions().map((o) => ({ value: o.id, label: `${o.name}: ${o.title}`, sub: career.unmet(CAREER_BY_ID[o.id], { lateral: true }).filter((r) => !/current job/.test(r))[0] ?? '' })) });
    if (id) await x.say(place.moveAcross(id));
  },
  async hours(_, x) {
    const v = await pickModal({ title: 'Your hours', body: 'Overtime pays time and a half where you are paid by the hour. Fewer hours means less pay, if they agree.',
      options: [{ value: 5, label: 'Five more hours a week' }, { value: 10, label: 'Ten more hours a week' }, { value: -8, label: 'Eight fewer hours a week' }, { value: -16, label: 'Go part-time (sixteen fewer)' }, { value: 0, label: 'Back to my contracted hours' }] });
    if (v == null) return;
    await x.say(v === 0 ? work.normalHours() : work.changeHours(v));
  },
  async remote(_, x) {
    const m = await pickModal({ title: 'Working from home', options: [{ value: 'hybrid', label: 'Some days at home' }, { value: 'remote', label: 'Fully from home' }] });
    if (m) await x.say(work.askRemote(m));
  },
  async leave(_, x) {
    const k = await pickModal({ title: 'Take leave', body: 'What you are owed depends on where you live and who you work for.',
      options: [{ value: 'vacation', label: 'Use your holiday' }, { value: 'sick', label: 'Sick leave' }, { value: 'parental', label: 'Parental leave' }, { value: 'sabbatical', label: 'A year\'s sabbatical (unpaid)' }] });
    if (k) await x.say(work.takeLeave(k));
  },
  async values(_, x) {
    const all = ['stability', 'creativity', 'service', 'autonomy', 'prestige', 'excitement', 'community', 'outdoors', 'craft', 'care'];
    const chosen = [];
    for (let i = 0; i < 3; i++) {
      const v = await pickModal({ title: `What matters to you? (${i + 1} of 3)`, body: 'Work that offers these will satisfy you more, whatever it pays.', cancel: i ? 'That is enough' : 'Cancel',
        options: all.filter((a) => !chosen.includes(a)).map((a) => ({ value: a, label: a[0].toUpperCase() + a.slice(1) })) });
      if (!v) break;
      chosen.push(v);
    }
    if (chosen.length) await x.say(work.setValues(chosen));
  },
  async quitmain(_, x) {
    if (await confirmModal({ title: 'Resign?', body: 'You will lose your salary. The people stay in your life; your record stays.', yes: 'Resign', danger: true })) await x.say(career.quitCareer());
  },
  async retire(_, x) {
    if (await confirmModal({ title: 'Retire?', body: `You would stop work on a pension of about ${money(career.pensionEstimate())} a year. You can still work part-time, freelance, or go back later.`, yes: 'Retire' })) await x.say(career.retire());
  },
  async colleague(id, x) {
    const n = store.state.npcs[id];
    if (!n) return;
    const opts = place.colleagueActions(n);
    const what = await pickModal({ title: `${n.firstName} ${n.lastName}`, body: `${roleLabel(n)}${n.occupation ? `, ${n.occupation}` : ''}. Relationship ${Math.round(n.meters.relationship)}%.`,
      options: opts.map((o) => ({ value: o.id, label: o.label, disabled: o.done, sub: o.done ? 'Not again this year.' : '' })) });
    if (!what) return;
    let how;
    if (what === 'review') how = await pickModal({ title: 'Their review', options: [{ value: 'generous', label: 'Generous' }, { value: 'fair', label: 'Fair and honest' }, { value: 'tough', label: 'Tough' }] });
    if (what === 'review' && !how) return;
    await x.say(place.withColleague(id, what, how));
  },
  filter(arg, x) {
    const [k, v] = arg.split(':');
    x.st[k] = v === 'true' ? true : v === 'false' ? false : v;
    x.render();
  },
  async family(_, x) {
    const f = await pickModal({ title: 'Which field?', options: [{ value: '', label: 'Any field' }, ...FAMILIES.filter((y) => y.id !== 'military').map((y) => ({ value: y.id, label: y.name }))] });
    if (f == null) return;
    x.st.family = f || null;
    x.render();
  },
  async posting(id, x) {
    const v = hiring.postingView(id);
    if (!v) return;
    const cty = COUNTRIES[v.post.countryId];
    const body = `${v.employer.name}, ${v.post.city}. ${market.describe(v.employer)}. ${v.culture.blurb} Pays ${money(v.post.pay[0], cty)}–${money(v.post.pay[1], cty)} a year for ${v.post.hours} hours a week${v.post.remote !== 'none' ? ` (${v.post.remote})` : ''}. They ask for about ${years(v.want)} of relevant experience; you have ${v.have}.${v.eligible ? '' : ` ${v.reasons.join(' ')}`}`;
    const go = await pickModal({ title: v.post.title, body, cancel: 'Back', options: [{ value: 'apply', label: v.post.partTime ? 'Apply for the part-time job' : 'Apply', disabled: !v.eligible, sub: v.eligible ? v.note : v.reasons[0] }] });
    if (go) await applyTo(id, x);
  },
  accept: async (id, x) => {
    const o = hiring.offers().find((y) => y.id === id);
    const post = market.posting(o?.postingId);
    if (post && (post.countryId !== player().countryId || post.city !== player().city)) {
      const sure = await confirmModal({ title: 'This means moving', body: post.countryId !== player().countryId ? `The job is in ${COUNTRIES[post.countryId].name}. You would emigrate, and a visa can still be refused.` : `The job is in ${post.city}. You would move there.`, yes: 'Move and accept' });
      if (!sure) return;
      return x.say(recruit.moveForOffer(o, hiring.accept));
    }
    return x.say(hiring.accept(id));
  },
  negotiate: (arg, x) => { const [id, w] = arg.split(':'); return x.say(hiring.negotiate(id, w)); },
  declineoffer: (id, x) => x.say(hiring.decline(id)),
  leaddetails: (id, x) => x.say(recruit.details(id)),
  async leadapply(id, x) {
    const check = recruit.moveCheck(id);
    if (!check.ok) return messageModal({ body: check.text });
    if (check.text && !(await confirmModal({ title: 'Go for it?', body: check.text, yes: 'Apply' }))) return undefined;
    const l = recruit.leads().find((y) => y.id === id);
    return applyTo(l.postingId, x, { bonus: l.bonus, via: l.from });
  },
  async leadrefer(id, x) {
    const f = await pickModal({ title: 'Who would you put forward?', options: recruit.referable().map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: roleLabel(n) })) });
    if (f) await x.say(recruit.referFriend(id, f));
  },
  leaddecline: (id, x) => x.say(recruit.declineLead(id)),
  cover: (_, x) => x.say(pt.coverShift()),
  async quitside(id, x) { if (await confirmModal({ title: 'Leave this job?', body: 'You will lose the income.', yes: 'Leave', danger: true })) await x.say(pt.quitJob(id)); },
  takept: (id, x) => x.say(pt.takeJob(id)),
  async availability(_, x) {
    const h = await pickModal({ title: 'Hours a week for freelance work', options: AVAILABILITY.map((v) => ({ value: v, label: v ? `${v} hours` : 'None' })) });
    if (h != null) await x.say(free.setAvailability(h));
  },
  async service(id, x) {
    const s = free.services().find((y) => y.id === id);
    const choice = await pickModal({ title: s.name, body: s.offered ? `Reputation ${s.rep}%. Higher prices put off some clients; a strong reputation carries them.` : 'Set your price to start.',
      options: [...RATES.map((r) => ({ value: r.id, label: `${r.label}: ${money(free.hourly(s, r.id))} an hour`, disabled: s.offered && s.rateId === r.id })), ...(s.offered ? [{ value: 'stop', label: 'Stop offering this' }] : [])] });
    if (!choice) return;
    await x.say(choice === 'stop' ? free.withdraw(id) : free.offer(id, choice));
  },
  inqaccept: (id, x) => x.say(free.acceptInquiry(id)),
  inqcounter: (id, x) => x.say(free.counterOffer(id)),
  inqdecline: (id, x) => x.say(free.declineInquiry(id)),
  async gigcancel(id, x) { if (await confirmModal({ title: 'Drop this job?', body: 'You will not be paid, and the client will tell people.', yes: 'Drop it', danger: true })) await x.say(free.cancelContract(id)); },
  async gigs(_, x) {
    const id = await pickModal({ title: 'One-off gigs', body: 'Paid on the day. The better you are at it, the more it pays.', options: career.gigOptions().map((g) => ({ value: g.id, label: g.name, disabled: !g.available, sub: g.available ? `Pays about ${money(g.pay)}.` : g.reason })) });
    if (id) await x.say(career.doGig(id));
  },
  async fame(_, x) {
    const id = await pickModal({ title: `Fame: ${career.fame()}%`, body: 'The more famous you are, the more these pay. They can go wrong in public.', options: career.fameOptions().map((a) => ({ value: a.id, label: a.name, disabled: !a.available, sub: a.reason })) });
    if (id) await x.say(career.doFameAction(id));
  },
  special: (id, x) => specialApply(id, x),
  enlist: (id, x) => specialApply(id, x),
  gotofind: (_, x) => { x.st.section = 'find'; x.render(); },
  gotofree: (_, x) => { x.st.section = 'freelance'; x.render(); },
};

/** Special careers and the military have their own way in: an audition, a portfolio, a selection board. */
async function specialApply(id, x) {
  const start = career.startApplication(id);
  if (start.kind === 'blocked') return messageModal({ body: start.text });
  let answers = [];
  if (start.kind === 'offer') {
    if (!(await confirmModal({ title: 'A standing offer', body: start.text, yes: 'Take it', no: 'Not now' }))) return undefined;
  } else if (start.kind === 'interview') {
    answers = (await interview(start.questions)).map((a) => a.s ?? 0);
  } else if (start.kind === 'audition') {
    const piece = await pickModal({ title: 'The audition', body: 'You get one piece. Choose what shows you at your best.', cancel: 'Walk out',
      options: start.pieces.map((p, i) => ({ value: i, label: p.t, sub: p.bonus ? 'A risk. If it comes off, they will remember you.' : '' })) });
    if (piece == null) return undefined;
    answers = [piece];
  }
  return x.say(career.finishApplication(id, answers));
}

