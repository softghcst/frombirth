// My Investigations: "Follow the evidence. Find the truth." One place for an investigative life,
// from preparing to apply to a department to running a private agency: recruitment, the academy,
// patrol, detective selection, cases (each a file with its own tabs), the team, the career record,
// federal applications, private work, a forensic scientist's bench, professional standards and the
// public record. Every section reads the investigations engine (engine/investigations); every case
// is read through its role-based view (views.js), so nothing here shows what the character cannot know.
import { player, country, store } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { meterHtml } from './meter.js';
import { SKILLS, SPECIALTIES, FEDERAL, WITNESS_QUESTIONS, PI_SERVICES, AGENCY_KINDS, STUDY, coverageOf, SOURCES } from '../data/investigations.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { rec, I, reputationOf, dateWords, now, working, legacies } from '../engine/investigations/core.js';
import * as C from '../engine/investigations/careers.js';
import * as A from '../engine/investigations/agencies.js';
import * as W from '../engine/investigations/casework.js';
import * as V from '../engine/investigations/views.js';
import * as PI from '../engine/investigations/private.js';
import * as O from '../engine/investigations/oversight.js';
import * as X from '../engine/investigations/crossover.js';
import * as FM from '../engine/investigations/forensicMed.js';
import * as PO from '../engine/investigations/policing.js';
import * as WP from '../engine/investigations/workplace.js';
import * as LO from '../engine/investigations/local.js';
import * as FL from '../engine/investigations/forensicLab.js';
import * as UN from '../engine/investigations/unions.js';
import * as RF from '../engine/investigations/reform.js';
import * as FP from '../engine/investigations/forensicPsych.js';
import { LAB } from '../data/investigations.js';
const FL_LAB = (id) => LAB[id]?.name ?? id;
import * as biz from '../engine/business.js';
import { settle, investigationsOpen, familyInvestigativeLegacy } from '../engine/investigations/index.js';

export { investigationsOpen };
const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}</button>`;
const card = (title, body) => `<div class="card"><h3>${esc(title)}</h3>${body}</div>`;
const muted = (t) => `<p class="muted">${esc(t)}</p>`;
const stack = (b) => `<div class="btn-stack" style="margin-top:10px">${b}</div>`;
const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => (npc(id) ? `${npc(id).firstName} ${npc(id).lastName}` : '—');

const STAGE_WORDS = { none: 'Not in the profession', applying: 'Applying', academy: 'At the academy', field: 'In field training', probation: 'On probation', officer: 'Serving officer',
  detective: 'Detective', federal_training: 'Federal academy', agent: 'Special agent', former: 'Formerly in the profession', retired: 'Retired' };

/** Which sections this person has: a recruit does not see a federal caseload; a private investigator does not see police tools. */
function sectionsFor(p, r) {
  const out = [['overview', 'Overview']];
  const police = !r?.family || r.family === 'police';
  if (police && !(r?.job && r.family === 'federal')) out.push(['agency', r?.job ? 'My Agency' : 'Departments']);
  if (p.countryId === 'us' && p.age >= 21) out.push(['federal', 'Federal agencies']);
  if (r?.caseIds?.length) out.push(['cases', 'Active Cases'], ['archive', 'Case Archive']);
  if (r?.job?.detective || r?.family === 'federal') out.push(['cold', 'Cold Cases'], ['reviews', 'Conviction Reviews']);
  if (r && Object.values(r.people).some((v) => (Array.isArray(v) ? v.length : v))) out.push(['team', 'Team']);
  if (r) out.push(['career', 'Career Progress']);
  if (p.age >= 21) out.push(['private', 'Private Investigation']);
  if (p.career?.careerId === 'forensics') out.push(['bench', 'Laboratory Bench']);
  if (FP.psychRecord(p)?.active || p.education.degrees.some((d) => d.type === 'doctorate' && d.majorId === 'psychology')) out.push(['psych', 'Forensic Psychology']);
  if (r?.job?.specialty === 'professional_standards' || O.complaints().some((c) => c.subjectId === p.id || c.assignedTo === p.id)) out.push(['standards', 'Professional Standards']);
  if (p.career?.careerId === 'journalist') out.push(['press', 'Courtroom Connections'], ['stories', 'My Stories']);
  if (FM.examinerNow(p) || FM.referrals('death', p).length) out.push(['death', 'Death Investigations']);
  if (FM.evaluatorNow(p) || FM.referrals('competency', p).length) out.push(['competency', 'Competency Evaluations']);
  if (r?.family !== 'federal' && (A.agency(r?.job?.agencyId)?.chiefId === p.id || ['council', 'mayor', 'seat', 'head'].includes(p.politics?.officeId) || (r?.stats.years ?? 0) >= 8)) out.push(['policy', 'Public Safety']);
  if (legacies().length) out.push(['legacy', 'Family Legacy']);
  return out;
}

const MAJOR_NAME = (id) => MAJOR_BY_ID[id]?.name ?? (id === 'law' ? 'Law' : id);
/** The ways into the work, what each asks, and which of the player's studies count. */
function waysIn(p) {
  const mine = (path) => C.studied(path, p);
  const list = (ids) => ids.filter((id) => MAJOR_BY_ID[id] || id === 'law').map(MAJOR_NAME).join(', ');
  const held = (path) => (mine(path).length ? ` You have: ${mine(path).map(MAJOR_NAME).join(', ')}.` : '');
  const rows = [
    ['Police officer', `A high school diploma and 21 or older, then the academy. A degree is not required to start, but it helps with the entrance assessment and the academy. Useful studies: ${list(STUDY.police)}.${held('police')}`],
    ['Detective', `Three years as an officer, then selection for a seat in a unit. Studies that help: ${list(STUDY.detective)}; some units favor their own (accounting for fraud, cybersecurity for cybercrime).${held('detective')}`],
    ['Senior ranks', 'Captain, deputy chief, chief and detective lieutenant ask for a bachelor\'s degree. Many officers study part-time while serving.'],
    ...(p.countryId === 'us' ? [['Federal agent (FBI, DEA, ATF)', `A bachelor's degree is required, and for the FBI professional experience too. Valued backgrounds: accounting and finance, technology, law, languages, science, criminal justice.${C.backgrounds(p).length ? ` Yours: ${C.backgrounds(p).join(', ').replace(/_/g, ' ')}.` : ''}`]] : []),
    ['Private investigator', `A license, after years of related work; a relevant degree (${list(STUDY.pi)}) shortens it by a year.${held('pi')}`],
  ];
  return card('Ways in', kv(rows) + muted('In the game, as in many places, police work is open without a degree; leadership and federal work favor those who studied. University planning is under School.'));
}

const VIEWS = {
  overview(p, r) {
    const cov = coverageOf(p.countryId);
    let out = card('Follow the evidence. Find the truth.', kv([
      ['Where you stand', STAGE_WORDS[r?.stage ?? 'none']],
      ...(r?.job ? [['Employer', A.ownerName(r.job.agencyId ?? r.job.officeId) ?? '—'], ['Rank', p.career.title ?? '—']] : []),
      ...(r ? [['Professional reputation', `${reputationOf(r)} / 100`], ['Years of service', String(r.stats.years)]] : []),
      ['Jurisdiction', cov === 'full' ? 'Modeled in depth (municipal, county, state, federal, private)' : 'Simplified: one national or regional police service, no federal careers'],
    ]) + muted('Investigative careers here are gameplay. Agency rules are simplified and not verified against the agencies themselves.'));
    if (!r?.job) out += waysIn(p);
    if (!r?.job) {
      out += card('Getting ready', muted('Before applying: study, train, write, and see the work for yourself. Each once a year.')
        + stack(Object.entries(C.PREP).map(([id, d]) => btn(`prep`, d.label, { arg: id })).join('')));
    }
    const pending = (r?.apps ?? []).filter((a) => ['pending', 'offer'].includes(a.status));
    if (pending.length) out += card('Applications', pending.map((a) => kv([[a.kind === 'federal' ? FEDERAL[a.agency].name : a.kind === 'license' ? 'Private investigator license' : A.ownerName(a.ownerId),
      a.status === 'offer' ? 'Offer waiting' : `Decision by ${dateWords(a.kind === 'federal' ? a.stages.find((s) => !s.known)?.due ?? a.decisionDue : a.due)}`]])
      + (a.status === 'offer' ? stack(btn(a.kind === 'federal' ? 'acceptFed' : 'acceptAcademy', 'Accept', { arg: a.id }) + btn('decline', 'Decline', { arg: a.id })) : '')).join(''));
    if (r?.academy?.status === 'enrolled') {
      const ac = r.academy;
      out += card(ac.federal ? FEDERAL[ac.federal].academy : `${A.ownerName(ac.ownerId)} academy`, kv([['Runs to', dateWords(ac.end)], ['Classmate', nm(ac.classmateIds?.[0])]])
        + Object.entries(ac.marks).map(([k, v]) => meterHtml(k.replace('deescalation', 'De-escalation').replace(/^./, (c) => c.toUpperCase()), Math.min(100, v * 50), true)).join('')
        + stack(Object.entries(C.ACADEMY).map(([id, d]) => btn('academy', d.label, { arg: id })).join('')));
    }
    if (r?.pendingMove) out += card('Your assignment', muted(`You are posted to ${r.pendingMove}.`) + stack(btn('report', `Move to ${r.pendingMove} and report for duty`)));
    return out;
  },
  agency(p, r) {
    let out = '';
    if (!r?.job) {
      for (const a of A.agenciesHere(p)) {
        const no = C.policeUnmet(a, p);
        const d = AGENCY_KINDS[a.kind];
        out += card(a.name, kv([['Kind', d.name], ['Academy', `${d.academyMonths} months`], ['Field training', `${d.fieldMonths} months`], ['Minimum age', String(d.minAge)], ...(d.maxAge ? [['Maximum age', String(d.maxAge)]] : [])])
          + (a.simplified ? muted('Simplified: this country\'s police recruitment is not modeled in detail.') : '')
          + (no.length ? muted(no[0]) : stack(btn('applyPolice', 'Submit an application', { arg: a.id }))));
      }
      return out || muted('There is no police agency recruiting here.');
    }
    const a = A.agency(r.job.agencyId);
    if (!a) return muted('Your agency record is being set up. It will appear after the next Age Up.');
    out += card(a.name, kv([['Your rank', p.career.title], ['Chief', nm(a.chiefId)], ['Units', Object.keys(a.units).map((u) => SPECIALTIES[u].name).join(', ')]]));
    if (['field', 'probation', 'officer'].includes(r.stage) && !r.job.detective) {
      out += card(r.stage === 'officer' ? 'On patrol' : 'Field training', (r.people.ftoId ? kv([['Field training officer', nm(r.people.ftoId)]]) : '') + kv([...(r.job.probationEnd && r.stage !== 'officer' ? [['Probation ends', dateWords(r.job.probationEnd)]] : [])])
        + stack(Object.entries(C.PATROL).map(([id, d]) => btn('patrol', d.label, { arg: id })).join('')));
    }
    if (r.stage === 'officer' || r.job.detective) {
      const no = C.detectiveUnmet(p);
      const vac = A.vacancies(a, 'detective');
      out += card(r.job.detective ? 'Unit transfers' : 'Detective selection', (no.length ? muted(no[0]) : vac.length ? vac.map((v) => kv([[SPECIALTIES[v.unit].name, SPECIALTIES[v.unit].years ? `Needs ${SPECIALTIES[v.unit].years} years as a detective` : 'Open to qualified officers']])
        + stack(btn('applyDetective', `Apply for ${SPECIALTIES[v.unit].name.toLowerCase()}`, { arg: v.id }))).join('') : muted('No detective seats are open this year.')));
    }
    if (r.family === 'police' && !['academy'].includes(r.stage)) {
      const un = UN.unionOf(a);
      const mem = UN.membership(p);
      const t = UN.talks(p);
      out += card('The union', kv([['Union', un.name], ['Representative', un.repId === p.id ? 'You' : nm(un.repId)], ['Contract', `to ${un.contract.until}: ${un.contract.raise}% raise; disciplinary records ${un.contract.records}${un.contract.bodycams ? '; body cameras' : ''}`],
        ['You', mem?.member ? `A member since ${mem.since}` : 'Not a member'], ...(un.stalled ? [['Talks', 'Stalled']] : []), ...(un.action === store.state.year ? [['This year', 'Working to rule']] : [])])
        + muted(UN.NO_STRIKE)
        + stack((mem?.member ? btn('unionLeave', 'Leave the union') + (mem.rep ? '' : btn('unionRep', 'Stand for representative')) + (un.stalled && mem.voted !== store.state.year ? btn('unionVote', 'Vote on working to rule') : '') : btn('unionJoin', 'Join the union'))
          + (t ? btn('bargain', t.side === 'union' ? 'Bargain for your colleagues' : 'Bargain for the department') : '')));
    }
    const hoodsHere = LO.meetingsHere(p);
    if (!['academy'].includes(r.stage) && hoodsHere.length) {
      out += card('Community meetings', muted('Each neighborhood meets once a year. Listening earns trust; a tip from a meeting is a lead to check, never a fact.')
        + hoodsHere.map((h) => kv([[h.name, `Trust in the police here: ${r.community?.[h.id] ?? 50} / 100`]]) + stack(btn('meeting', 'Go to the meeting', { arg: h.id }))).join(''));
    }
    return out;
  },
  federal(p, r) {
    return Object.entries(FEDERAL).map(([key, d]) => {
      const no = C.federalUnmet(key, p);
      const src = SOURCES[d.source];
      return card(d.name, kv([['Jurisdiction', d.jurisdiction.join(', ').replace(/_/g, ' ')], ['Training', `${d.academy}, about ${d.academyMonths} months`],
        ['Eligibility (simplified)', `US citizen, ${d.eligibility.minAge}–${d.eligibility.maxAge}, a bachelor's degree${d.eligibility.experienceYears ? `, ${d.eligibility.experienceYears} years of professional work` : ''}`]])
        + muted(`Modeled on ${src.org} (${src.url}); not verified against it.`)
        + (no.length ? muted(no[0]) : stack(btn('applyFed', `Apply to the ${d.short}`, { arg: key }))));
    }).join('');
  },
  cases(p, r) {
    const list = r.caseIds.map(W.investigation).filter((inv) => inv?.file && ((!inv.file.outcome && W.caseStatus(inv) !== 'cold') || inv.file.review?.status === 'open'));
    if (!list.length) return muted('No active cases. New cases are assigned as the year turns, within a manageable caseload.');
    const many = WP.openCases(p).length >= 2;
    const caseload = card('Your caseload', muted('Set one case as this year\'s priority, ask your supervisor for help on a heavy one, or hand the routine work to your partner. Judgment calls stay with you.'));
    return caseload + list.map((inv) => {
      const v = V.view(inv, 'investigator');
      const live = WP.openCases(p).includes(inv);
      const pri = r.priority?.year === store.state.year && r.priority.invId === inv.id;
      const tf = inv.file.taskForceId && store.state.investigations.taskForces[inv.file.taskForceId];
      return card(v.title, kv([['Kind', v.kind], ['Status', v.status], ['Agency', v.agency], ['Opened', v.opened], ['Hours left this year', String(W.workLeft(inv))], ...(pri ? [['This year', 'The priority']] : []), ...(tf ? [['Task force', tf.status === 'active' ? 'Active' : 'Ended']] : [])])
        + stack(btn('openCase', 'Open the case file', { arg: inv.id })
          + (live && many && !pri ? btn('prioritize', 'Make it the priority', { arg: inv.id }) : '')
          + (live ? btn('support', 'Ask for support', { arg: inv.id }) : '')
          + (live && r.people.partnerId ? btn('delegate', 'Hand the routine work to your partner', { arg: inv.id }) : '')
          + (live && tf?.status === 'active' ? btn('tfMeet', 'Task force meeting', { arg: inv.id }) : '')));
    }).join('');
  },
  archive(p, r) {
    const list = r.caseIds.map(W.investigation).filter((inv) => inv?.file && (inv.file.outcome || W.caseStatus(inv) === 'cold'));
    return list.length ? list.map((inv) => card(inv.file.title, kv([['Outcome', W.caseStatus(inv) === 'cold' ? 'Cold: kept open, inactive' : inv.file.outcome.kind], ['Opened', dateWords(inv.file.opened)]]) + stack(btn('openCase', 'Read the file', { arg: inv.id })))).join('') : muted('Nothing in the archive yet.');
  },
  cold(p) {
    const list = W.coldCandidates(p.countryId);
    return list.length ? list.map(({ inv, newer }) => card(inv.file.title, kv([['First investigated', dateWords(inv.file.opened)], ['What is new', newer.map((n) => n.discipline).join(', ')]]) + stack(btn('reopen', 'Reopen the case', { arg: inv.id })))).join('')
      : muted('No cold case has anything new that could be tested yet.');
  },
  reviews(p) {
    const list = W.reviewCandidates(p.countryId);
    return card('About reviews', muted('A conviction can be looked at again when kept evidence could be tested in a way it was not. The conviction stands while it is reviewed; only a court can set it aside.'))
      + (list.length ? list.map(({ inv, newer }) => card(inv.file.title, kv([['Investigated', dateWords(inv.file.opened)], ['Could now be tried', [...new Set(newer.map((n) => n.discipline))].join(', ')]]) + stack(btn('openReview', 'Open a review', { arg: inv.id })))).join('') : muted('No conviction here has kept evidence that could be tested in a new way.'));
  },
  legacy() {
    return legacies().map((x) => card(`${x.name}${x.died ? ` (died ${x.died})` : ''}`, kv([['Years of service', String(x.years ?? '—')], ['Units', (x.units ?? []).map((u) => SPECIALTIES[u]?.name ?? u).join(', ') || '—'], ...(x.license ? [['License', x.license]] : []), ...(x.retired ? [['Retired', String(x.retired)]] : [])])
      + x.history.slice(-10).map((h) => kv([[String(h.year), h.text]])).join('') + muted('The public career only. Case files and witness statements are not part of a family\'s record.'))).join('');
  },
  team(p, r) {
    const rows = [['partnerId', 'Partner'], ['supervisorId', 'Supervisor'], ['ftoId', 'Field training officer'], ['mentorId', 'Mentor'], ['prosecutorId', 'Prosecutor'], ['rivalId', 'Rival']]
      .filter(([k]) => r.people[k]).map(([k, label]) => kv([[label, `${nm(r.people[k])}${npc(r.people[k])?.alive ? '' : ' (died)'}`]]) + (npc(r.people[k])?.alive ? stack(btn('profile', `Open ${npc(r.people[k]).firstName}'s profile`, { arg: r.people[k] })) : ''));
    const past = [...new Set(r.people.formerPartnerIds)].map((id) => kv([['Former partner', nm(id)]]));
    const cls = r.people.classmateIds.map((id) => kv([['Academy classmate', nm(id)]]));
    return card('The people you work with', rows.join('') + past.join('') + cls.join('') || muted('Nobody yet.'));
  },
  career(p, r) {
    const st = r.stats;
    const promos = C.promotionOptions(p);
    return card('Professional record', kv([['Reputation', `${reputationOf(r)} / 100`], ['Years of service', String(st.years)], ['Cases assigned', st.unknownBefore ? `${st.assigned} (earlier casework not recorded)` : String(st.assigned)],
      ['Cases completed', String(st.completed)], ['Referred to a prosecutor', String(st.referred)], ['Charged', String(st.charged)], ['Charges declined', String(st.declined)], ['Convictions', String(st.convicted)],
      ['Acquittals', String(st.acquitted)], ['People cleared by the evidence', String(st.cleared)], ['Cold cases reopened', String(st.reopened)], ['Court appearances', String(st.court)],
      ['Discipline', r.discipline.length ? r.discipline.map((d) => `${d.year}: ${d.finding}`).join('; ') : 'None']]) + muted('Arrests and convictions are not the measure: thorough, lawful, honest work is.'))
      + card('Skills', Object.entries(SKILLS).map(([k, s]) => meterHtml(s.name, Math.round(r.skills[k]), true)).join(''))
      + (promos.length ? card('Promotion', promos.map((x) => kv([[x.name, x.block || x.how]]) + (x.block ? '' : stack(btn('promote', `Apply for ${x.name.toLowerCase()}`, { arg: x.id })))).join('')) : '')
      + (r.stats.awards?.length ? card('Honors', r.stats.awards.map((a) => kv([[String(a.year), a.name]])).join('')) : '')
      + (r.family === 'federal' && r.job?.officeId && !r.retired ? card('Moves within the agency', kv([['Field office', A.office(r.job.officeId)?.name ?? '—'], ['Squad', WP.SQUADS[r.job.agencyKind]?.find(([id]) => id === r.job.squad)?.[1] ?? 'General'],
        ...(r.move ? [['Last request', `${r.move.kind === 'office' ? `Transfer to ${r.move.target}` : 'A squad place'}: ${r.move.status === 'pending' ? `answer by ${dateWords(r.move.due)}` : r.move.status}`]] : [])])
        + stack(btn('transfer', 'Ask for a transfer to another field office') + btn('squad', 'Apply for a squad'))) : '')
      + (r.retired ? card('After retiring', muted('Experience is worth something after the badge is handed in.') + WP.secondOptions(p).map((x) => kv([[x.name, x.block || x.text]]) + (x.block ? '' : stack(btn('second', x.id === 'memoir' ? 'Write it' : 'Take it up', { arg: x.id })))).join('')) : '')
      + card('Career history', r.history.slice().reverse().slice(0, 20).map((h) => kv([[String(h.year), h.text]])).join('') || muted('Nothing yet.'));
  },
  private(p, r) {
    let out = '';
    const rule = C.piLicenseRule(p.countryId);
    const no = C.licenseUnmet(p);
    out += card('License', C.licensed(p) ? kv([['Held', rule.name]]) + muted('A license gives no police powers.') : kv([['Needs', `${rule.experienceYears} years of related work, age ${rule.minAge}, a clean record${rule.exam ? ', an exam' : ''}`]])
      + (rule.simplified ? muted('Simplified: licensing here is not modeled in detail.') : '') + (no.length ? muted(no[0]) : stack(btn('applyLicense', 'Apply for a license'))));
    if (C.licensed(p)) {
      const mine = PI.agencies(p);
      if (!mine.length) out += card('Your own agency', muted('Open a licensed agency: it is a business, with staff, rent and clients who may say no.') + stack(btn('openAgency', 'Open an investigation agency')));
      for (const b of mine) {
        const offers = PI.clientsFor(b);
        out += card(b.name, kv([['Cash', fmtMoney(b.cash, country())], ['Reputation', String(Math.round(b.reputation))], ['Fees', `${Math.round(b.investigations.rate * 100)}% of the usual rate`]])
          + offers.map((o) => kv([[nm(o.clientId), `${PI_SERVICES[o.service].name}: ${fmtMoney(o.fee, country())}`]]) + stack(btn('client', 'Take the work', { arg: `${b.id}|${o.id}` }) + btn('noClient', 'Turn it down', { arg: `${b.id}|${o.id}` }))).join('')
          + stack(btn('rate', 'Set fees', { arg: b.id })));
      }
    }
    const posts = WP.corporatePosts(p);
    if (r?.job?.corporate) out += card('Corporate investigations', kv([['Employer', p.career.title.replace(/^Corporate investigator, /, '')]]) + muted('Internal matters for the company. No police powers: nobody has to talk to you, and a crime is for the company to report.'));
    else if (posts.length) out += card('Corporate investigations', muted('Companies hire investigators for internal matters: expense fraud, missing stock, complaints. A salary instead of fees.')
      + posts.map((e) => kv([[e.name, 'Investigations team']]) + stack(btn('corporate', 'Apply and join', { arg: e.id }))).join(''));
    for (const q of PI.inquiries(p).filter((x) => x.status === 'open')) {
      out += card(`${PI_SERVICES[q.service].name} for ${nm(q.clientId)}`, kv([...(q.kind === 'corporate' ? [['About', q.about]] : [['Fee', fmtMoney(q.fee, country())]]), ['Done', q.steps.join(', ') || 'nothing yet'], ['Findings', q.findings.join(' ') || 'none yet']])
        + (q.assignedTo ? muted(`${nm(q.assignedTo)} is working it, and will report by ${dateWords(q.assignedDue)}.`)
          : stack(Object.entries(PI.PI_STEPS).map(([id, d]) => btn('piStep', d.label, { arg: `${q.id}|${id}`, cls: d.restricted ? 'danger' : '' })).join('') + btn('piDone', 'Deliver the findings and close', { arg: q.id })
            + (biz.business(q.businessId) && biz.staffOf(biz.business(q.businessId)).length ? btn('piAssign', 'Give it to a member of staff', { arg: q.id }) : ''))));
    }
    return out;
  },
  psych(p) {
    const F = FP.psychRecord(p);
    if (!F?.active) { const why = FP.psychBlock(p); return card('Forensic psychology', muted('Consultations for detectives, risk assessments for the parole board, and care for officers after critical incidents. A psychologist describes behavior and risk; others decide.') + (why ? muted(why) : stack(btn('psychStart', 'Take up forensic practice')))); }
    const work = FP.openWork(p);
    const LABEL = { consult: 'Consultation', risk: 'Risk assessment for the parole board', officer: 'An officer after a critical incident' };
    return card('Your practice', kv([['Position', p.career.title], ['Careful work', String(F.careful)], ['Overreach', String(F.overreach)], ['Confidentiality breaches', String(F.breaches)]]))
      + (work.length ? work.map((w) => card(LABEL[w.kind], kv([[w.kind === 'consult' ? 'Case' : 'Person', w.kind === 'consult' ? (store.state.justice.investigations[w.invId]?.file?.title ?? '—') : nm(w.personId)]])
        + stack(FP.OPTIONS[w.kind].map(([label, v]) => btn('psychWork', label, { arg: `${w.id}|${v}`, cls: ['name', 'impression', 'report'].includes(v) ? 'danger' : '' })).join('')))).join('') : muted('No work waiting. Referrals come as the year turns.'));
  },
  bench(p) {
    const L = FL.labRecord(p);
    const list = FL.queue(p);
    const tested = L?.proficiency.find((x) => x.year === store.state.year);
    let head = L ? card('Your laboratory', kv([['Position', p.career.title], ['Discipline', L.discipline ? FL_LAB(L.discipline) : 'Not chosen yet'], ['Accreditation', L.accredited ? 'Accredited' : 'Under review'],
      ['Waiting on your bench', String(list.length)], ['Overdue', String(list.filter((b) => b.overdue).length)], ['Reports written', String(L.reports)], ['Order of work', L.policy === 'serious' ? 'Serious cases first' : 'In the order they came']])
      + stack((L.discipline ? '' : btn('specialize', 'Choose a discipline'))
        + (tested ? '' : btn('proficiency', 'Sit this year\'s proficiency test'))
        + btn('labPolicy', L.policy === 'serious' ? 'Work them in order instead' : 'Put serious cases first', { arg: L.policy === 'serious' ? 'age' : 'serious' }))) : '';
    for (const { b, inv, c } of FL.courtDates(p)) {
      const it = inv.file.items.find((x) => x.id === b.itemId);
      head += card(`In court: ${inv.file.title}`, kv([['Your report', `${it?.label ?? 'an item'}: ${FL_LAB(b.discipline)}`], ['Defendant', nm(c.defendantId)]]) + muted('You explain what the laboratory found. The court decides what it means.') + stack(btn('labTestify', 'Take the stand', { arg: b.id })));
    }
    return head + (list.length ? list.map((b) => { const inv = W.investigation(b.invId); const it = inv.file.items.find((x) => x.id === b.itemId);
      return card(`${it.label} (${inv.file.title})`, kv([['Requested by', nm(b.detectiveId)], ['Examination', FL_LAB(b.discipline)], ...(b.due ? [['Due', `${dateWords(b.due)}${b.overdue ? ' (overdue)' : ''}`]] : []), ['Done', b.steps.join(', ') || 'nothing yet']])
        + stack(Object.entries(X.BENCH_STEPS).map(([id, d]) => btn('bench', d.label, { arg: `${b.id}|${id}` })).join('') + btn('benchReport', 'Report the finding as it is', { arg: `${b.id}|careful` }) + btn('benchReport', 'Report it as stronger than it is', { arg: `${b.id}|overstate`, cls: 'danger' }))); }).join('')
      : muted('Nothing on your bench. Requests arrive as the year turns.'));
  },
  standards(p) {
    const mine = O.complaints().filter((c) => c.subjectId === p.id);
    const work = O.complaints().filter((c) => c.assignedTo === p.id && c.status === 'open');
    return (mine.length ? card('Complaints about you', mine.map((c) => kv([[c.text, c.status === 'open' ? `Being investigated, decided by ${dateWords(c.due)}` : `${c.finding}${c.action && c.action !== 'none' ? ` (${c.action})` : ''}`]])).join('')) : '')
      + work.map((c) => card(`Complaint about ${nm(c.subjectId)}`, muted(c.text) + kv(c.evidence.map((e) => [O.IA_STEPS[e.step].label, e.text]))
        + stack(Object.entries(O.IA_STEPS).map(([id, d]) => btn('ia', d.label, { arg: `${c.id}|${id}` })).join('') + ['substantiated', 'unsubstantiated', 'insufficient evidence', 'training issue'].map((f) => btn('iaDecide', `Find: ${f}`, { arg: `${c.id}|${f}` })).join('')))).join('');
  },
  death(p) {
    const list = FM.referrals('death', p);
    return list.length ? list.slice().reverse().map((d) => { const inv = W.investigation(d.invId); const tox = FM.toxicology(d.id);
      return card(inv.file.title, kv([['Referred by', nm(d.detectiveId)], ['Status', d.status === 'signed' ? `Signed: cause, ${FM.CAUSES[d.report.cause].toLowerCase()}; manner, ${FM.MANNERS[d.report.manner].toLowerCase()}` : 'Open'], ['Done', d.steps.join(', ') || 'nothing yet'], ...(d.tox ? [['Toxicology', tox ?? `Expected ${dateWords(d.tox.due)}`]] : [])])
        + muted('Cause of death and manner of death are different findings. An examination cannot say who was involved.')
        + (d.status === 'open' ? stack(Object.entries(FM.DEATH_STEPS).map(([id, x]) => btn('death', x.label, { arg: `${d.id}|${id}` })).join('') + btn('signDeath', 'Sign the report', { arg: d.id })) : '')); }).join('')
      : muted('No referrals yet. They come from the investigating agencies as the year turns.');
  },
  competency(p) {
    const list = FM.referrals('competency', p);
    return list.length ? list.slice().reverse().map((e) => { const c = store.state.justice.cases[e.caseId];
      return card(`Competency: ${nm(c.defendantId)}`, kv([['Court', c.court], ['Status', e.status === 'reported' ? `Reported: ${e.opinion.replace('_', ' ')}` : 'Open'], ['Done', e.steps.join(', ') || 'nothing yet']])
        + muted('You work for the court, not as their therapist. A diagnosis is not evidence of guilt or danger; the question is only whether they can follow the proceedings and help their lawyer.')
        + (e.status === 'open' ? stack(Object.entries(FM.EVAL_STEPS).map(([id, x]) => btn('evalStep', x.label, { arg: `${e.id}|${id}` })).join('') + ['competent', 'not_competent', 'more_time'].map((o) => btn('evalReport', `Report: ${o.replace('_', ' ')}`, { arg: `${e.id}|${o}` })).join('')) : '')); }).join('')
      : muted('No court referrals yet.');
  },
  policy(p, r) {
    const a = r?.job?.agencyId ? A.agency(r.job.agencyId) : A.agencyOf(A.kindsIn(p.countryId)[0], p.countryId, p.city);
    const b = PO.budgetOf(a);
    const focus = PO.priorityOf(a);
    let out = card(a.name, kv([['Budget this year', b.words], ['Priority', focus ? PO.FOCUS[focus].name : 'none set'], ['Civilian oversight board', a.oversight?.board ? `Yes, since ${a.oversight.since}` : 'No'], ['Chief', a.chiefId === p.id ? 'You' : nm(a.chiefId)]])
      + muted('The budget is set by the mayor and the country\'s policy (Politics). A chief runs the department; neither commands the courts or the prosecutor.'));
    if (a.chiefId === p.id) out += card('Set this year\'s priority', stack(Object.entries(PO.FOCUS).map(([id, x]) => btn('focus', `${x.name}: ${x.sub}`, { arg: id })).join('')));
    if (['council', 'mayor'].includes(p.politics?.officeId)) out += card('A civilian oversight board', '<p><b>For:</b></p>' + PO.BOARD_ARGUMENTS.for.map((x) => `<p>• ${esc(x)}</p>`).join('') + '<p><b>Against:</b></p>' + PO.BOARD_ARGUMENTS.against.map((x) => `<p>• ${esc(x)}</p>`).join('')
      + stack(btn('board', a.oversight?.board ? 'Propose ending the board' : 'Propose creating a board', { arg: a.oversight?.board ? 'end' : 'create' })));
    const reforms = RF.reformList(p.countryId).filter((x) => x.available);
    const canPropose = !RF.canPropose(p);
    out += card('National police reform', reforms.map((x) => kv([[x.name, x.passed ? `Law since ${x.passed}` : 'Not law']]) + muted(x.text)
      + (canPropose && !x.passed ? stack(btn('reform', 'Put it to the legislature', { arg: x.id })) : '')).join('') + (canPropose ? '' : muted('Laws for the whole country are passed by its legislature. A member, or the head of government, can put a measure forward.')));
    if (p.countryId === 'us' && r?.family === 'police') { const why = PO.sheriffBlock(p); out += card('Run for sheriff', why ? muted(why) : stack(btn('sheriff', 'Stand for election as sheriff'))); }
    return out;
  },
  stories(p) {
    const open = X.publicCases(p).filter((c) => !X.myStories(p).some((s) => s.caseId === c.caseId));
    return X.myStories(p).slice().reverse().map((s) => card(`Story: ${W.investigation(s.invId).file.title}`, kv([['Done', s.steps.join(', ') || 'nothing yet'], ['Status', s.published ? `Published (${s.accuracy})${s.correction ? ', corrected' : ''}` : 'In progress']])
      + s.claims.map((cl) => `<p>• ${esc(cl.text)} <span class="muted">${cl.sourced ? '(sourced)' : '(one person\'s account)'}</span></p>`).join('')
      + stack(s.published ? (s.accuracy === 'contains an error' && !s.correction ? btn('correct', 'Run a correction', { arg: s.id }) : '') : Object.entries(X.STORY_STEPS).map(([id, x]) => btn('storyStep', x.label, { arg: `${s.id}|${id}`, cls: x.restricted ? 'danger' : '' })).join('') + btn('publish', 'Publish', { arg: s.id })))).join('')
      + (open.length ? card('Cases in court you could cover', open.map((c) => kv([[c.title, c.outcome]]) + stack(btn('startStory', 'Work on a story', { arg: c.caseId }))).join('')) : '');
  },
  press(p) {
    const list = X.publicCases(p);
    return list.length ? card('Cases in the public record', list.map((c) => kv([[c.title, `${c.defendant}: ${c.outcome}`]])).join('') + muted('Only what happened in open court. Case files, witness statements and sealed records are not public.')) : muted('No cases in court here yet.');
  },
};

// ---------- The case file ----------

const TABS = [['overview', 'Overview'], ['notebook', 'Notebook'], ['people', 'People'], ['evidence', 'Evidence'], ['statements', 'Witness Statements'], ['lab', 'Laboratory'], ['legal', 'Legal Review'], ['court', 'Court'], ['actions', 'Investigative Actions']];
function caseTabs(v) {
  return TABS.filter(([id]) => (id === 'lab' ? v.labs.length || v.items.length : id === 'court' ? !!v.court : id === 'statements' ? v.claims.length : true));
}
const CASE_VIEWS = {
  overview: (v) => card(v.title, kv([['Kind', v.kind], ['Agency', v.agency], ['Status', v.status], ['Lead investigator', v.lead], ...(v.partner ? [['Partner', v.partner]] : []), ['Opened', v.opened]])),
  notebook: (v) => card('Known facts', v.facts.map((f) => `<p>• ${esc(f.text)}</p>`).join('') || muted('Only the report so far.'))
    + card('Reported claims', v.claims.map((c) => `<p>• ${esc(c.text)} <span class="muted">(${esc(c.by)}${c.confidence != null ? `, says they are ${c.confidence >= 0.8 ? 'sure' : c.confidence >= 0.5 ? 'fairly sure' : 'unsure'}` : ''})</span></p>`).join('') || muted('No statements yet.'))
    + card('Hypotheses', v.hypotheses.map((h) => kv([[h.text, h.status]])).join('') + muted('These follow what has been found. A strong claim is not a fact.'))
    + (v.contradictions.length ? card('Contradictions', v.contradictions.map(([a, b]) => `<p>• ${esc(a)} <b>but</b> ${esc(b)}</p>`).join('')) : '')
    + card('Open questions', muted(v.hypotheses.filter((h) => h.status === 'open').map((h) => `Is it that ${h.text.charAt(0).toLowerCase()}${h.text.slice(1)}`).join(' ') || 'None that the evidence leaves open.')),
  people: (v) => card('People in the case', v.people.map((x) => kv([[x.name, x.role]])).join('') + muted('A person of interest is not a suspect, and a suspect is not guilty.')),
  evidence: (v) => card('Items', v.items.map((it) => kv([[it.label, `${it.kind}${it.integrity === 'gap' ? ' · custody gap' : ''}`]]) + (it.custody.length ? `<p class="muted">${it.custody.map(esc).join('<br>')}</p>` : muted('Not yet collected.'))).join('') || muted('No physical items.')),
  statements: (v) => card('Statements', v.claims.map((c) => kv([[c.by, c.text]])).join('')),
  lab: (v) => card('Laboratory requests', v.labs.map((l) => kv([[`${l.item}: ${l.discipline}`, l.status === 'reported' ? l.text : `Expected ${l.due}`]])).join('') || muted('Nothing sent yet.')),
  legal: (v) => card('Authorizations', v.auths.map((a) => kv([[`${a.kind} order (${a.at})`, `${a.decision}, by ${a.judge}`]])).join('') || muted('None requested.'))
    + card('Report and prosecutor', kv([['Case report', v.report ? (v.report.complete ? `Complete, ${v.report.at}` : `Written, ${v.report.at}`) : 'Not written'], ['Referral', v.referral ? `${v.referral.decision} by ${v.referral.prosecutor}${v.referral.needs?.length ? `: ${v.referral.needs.join('; ')}` : ''}` : 'Not referred']])),
  court: (v) => card('Court', kv([['Defendant', v.court.defendant], ['Stage', v.court.stage], ...(v.court.due ? [['Court date', v.court.due]] : [])]) + muted('The court decides. The investigator gives evidence; they do not prosecute.')),
  actions: (v, inv) => {
    const st = W.steps(inv);
    const left = W.workLeft(inv);
    let b = st.map((s) => btn(s.interview ? 'interview' : 'step', s.label, { arg: `${inv.id}|${s.id}`, disabled: left <= 0 })).join('');
    if (!inv.file.outcome && !inv.file.courtCaseId) {
      b += btn('writeReport', 'Write the case report (complete)', { arg: `${inv.id}|complete` }) + btn('writeReport', 'Write the report, leaving out what does not fit', { arg: `${inv.id}|omit`, cls: 'danger' });
      for (const id of inv.suspectIds) b += btn('refer', `Refer ${nm(id)} to the prosecutor`, { arg: `${inv.id}|${id}` });
      b += btn('resolve', 'Close the case on what the evidence shows', { arg: inv.id }) + btn('suspend', 'Set the case aside (stays open)', { arg: inv.id });
    }
    if (inv.file.review?.status === 'open') b += btn('referReview', 'Send the review to the prosecutor\'s conviction review', { arg: inv.id });
    if (v.court && !inv.file.cross && !inv.file.outcome) b += btn('crossExam', 'Take the stand: cross-examination', { arg: inv.id });
    if (v.court && !inv.file.testimony && !inv.file.outcome) b += btn('testify', 'Prepare to testify: as recorded', { arg: `${inv.id}|record` }) + btn('testify', 'Prepare to testify: including the limits', { arg: `${inv.id}|limits` }) + btn('testify', 'Prepare to testify: make it sound stronger', { arg: `${inv.id}|overstate`, cls: 'danger' });
    return card('What you can do', muted(`${left} hours of work left on this case this year.`) + stack(b || muted('Nothing more to do on this file now.')));
  },
};
function openCaseFile(api, invId, refreshHub) {
  const st = { tab: 'overview' };
  const modal = openModal('<div data-case></div>', { dismissable: true });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-case]');
  const render = () => {
    const inv = W.investigation(invId);
    const v = V.view(inv, 'investigator');
    if (!v) { root.innerHTML = muted('This file is not yours to read.') + stack('<button type="button" class="btn" data-close>Close</button>'); return; }
    const tabs = caseTabs(v);
    root.innerHTML = `<h2 style="margin-top:0">${esc(v.title)}</h2>
      <div class="world-groups" role="tablist" aria-label="Case file">${tabs.map(([id, label]) => `<button type="button" role="tab" class="world-group av-chip ${id === st.tab ? 'on' : ''}" aria-selected="${id === st.tab}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>
      <div style="margin-top:10px">${CASE_VIEWS[st.tab](v, inv)}</div>${stack('<button type="button" class="btn" data-close>Close the file</button>')}`;
  };
  const say = async (r) => { api.changed(); refreshHub(); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); render(); };
  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) { modal.close(); return; }
    const tab = t.closest('[data-tab]');
    if (tab) { st.tab = tab.dataset.tab; render(); return; }
    const b = t.closest('[data-act]');
    if (!b || b.disabled) return;
    const [id, x] = (b.dataset.arg ?? '').split('|');
    const act = b.dataset.act;
    if (act === 'interview') {
      const wid = x.split(':')[1];
      const inv = W.investigation(id);
      const asked = inv.file.witnesses[wid]?.asked ?? [];
      const opts = Object.entries(WITNESS_QUESTIONS).filter(([q]) => !asked.includes(q) && (q !== 'inconsistency' || W.contradictions(inv).length));
      const pick = await pickModal({ title: `Interview ${nm(wid)}`, body: 'One question at a time. People remember more when they are not rushed.', options: opts.map(([q, d]) => ({ value: q, label: d.label, sub: d.sub })) });
      if (pick) await say(W.act(id, x, { question: pick }));
    } else if (act === 'step') await say(W.act(id, x));
    else if (act === 'writeReport') await say(W.writeReport(id, x));
    else if (act === 'referReview') await say(W.referReview(id));
    else if (act === 'refer') await say(W.refer(id, x));
    else if (act === 'testify') await say(W.testify(id, x));
    else if (act === 'crossExam') {
      const inv = W.investigation(id);
      const answers = {};
      for (const q of W.crossQuestions(inv)) {
        const a = await pickModal({ title: 'Cross-examination', body: `Defense counsel: ${q.q}`, options: q.options.map(([label, value]) => ({ value, label })) });
        if (!a) return;
        answers[q.id] = a;
      }
      await say(W.crossExamination(id, answers));
    }
    else if (act === 'suspend') { if (await confirmModal({ title: 'Set the case aside?', body: 'It stays open, inactive. After three years with nothing new, it becomes a cold case.', yes: 'Set it aside' })) await say(W.suspend(id)); }
    else if (act === 'resolve') {
      const v = V.view(W.investigation(id), 'investigator');
      const pick = await pickModal({ title: 'Close on which explanation?', body: 'Only one the evidence supports.', options: v.hypotheses.map((h) => ({ value: h.key, label: h.text, sub: h.status, disabled: !h.status.includes('supported') })) });
      if (pick) await say(W.resolve(id, pick));
    }
  });
  render();
}

// ---------- The hub ----------

const ACTIONS = {
  psychStart: (a, x) => x.say(FP.startPractice()),
  psychWork: (a, x) => { const [id, v] = a.split('|'); return x.say(FP.doWork(id, v)); },
  reform: (a, x) => x.say(RF.propose(a)),
  unionJoin: (a, x) => x.say(UN.join()),
  unionLeave: (a, x) => x.say(UN.leave()),
  unionRep: (a, x) => x.say(UN.standForRep()),
  unionVote: async (a, x) => {
    const how = await pickModal({ title: 'Work to rule?', body: 'Officers would do exactly what the rules require, and no more. Cases would get fewer hours.', options: [{ value: 'yes', label: 'Vote yes' }, { value: 'no', label: 'Vote no' }] });
    if (how) await x.say(UN.vote(how));
  },
  bargain: async (a, x) => {
    const t = UN.talks();
    const s = t && await pickModal({ title: 'The contract talks', body: t.side === 'union' ? 'You speak for your colleagues.' : 'You speak for the department.', options: UN.stancesFor(t.side).map((o) => ({ value: o.id, label: o.label })) });
    if (s) await x.say(UN.bargain(s));
  },
  specialize: async (a, x) => {
    const id = await pickModal({ title: 'Choose a discipline', body: 'Most of your requests will be in it. You can still be sent others.', options: FL.disciplinesNow().map((d) => ({ value: d.id, label: d.name })) });
    if (id) await x.say(FL.specialize(id));
  },
  proficiency: async (a, x) => {
    const how = await pickModal({ title: 'The proficiency test', body: 'A blind sample. Nobody tells you the answer.', options: [
      { value: 'careful', label: 'Work it like casework', sub: 'Every control, every note.' },
      { value: 'quick', label: 'Get through it quickly', sub: 'There is a backlog.' },
      { value: 'peek', label: 'Ask a colleague what the answer is', sub: 'It would be easy.' }] });
    if (how) await x.say(FL.proficiency(how));
  },
  labPolicy: (a, x) => x.say(FL.setPolicy(a)),
  labTestify: async (a, x) => {
    const answers = {};
    for (const q of FL.FORENSIC_CROSS) {
      const v = await pickModal({ title: 'Cross-examination', body: `Defense counsel: ${q.q}`, options: q.options.map(([label, value]) => ({ value, label })) });
      if (!v) return;
      answers[q.id] = v;
    }
    await x.say(FL.testify(a, answers));
  },
  corporate: (a, x) => x.say(WP.joinCorporate(a)),
  meeting: async (a, x) => {
    const how = await pickModal({ title: 'The community meeting', body: 'A church hall, folding chairs, a microphone that works some of the time.', options: [
      { value: 'listen', label: 'Mostly listen, and write it down', sub: 'What worries people here.' },
      { value: 'present', label: 'Present the year\'s figures', sub: 'Numbers, and a few questions.' },
      { value: 'defend', label: 'Defend the department on every complaint', sub: 'Nobody gets an inch.' }] });
    if (how) await x.say(LO.communityMeeting(a, how));
  },
  prioritize: (a, x) => x.say(WP.prioritize(a)),
  support: (a, x) => x.say(WP.requestSupport(a)),
  delegate: (a, x) => x.say(WP.delegate(a)),
  tfMeet: async (a, x) => {
    const how = await pickModal({ title: 'The task force meets', body: 'Two agencies, one case. How does your side work with theirs?', options: [
      { value: 'share', label: 'Put everything on the table', sub: 'Leads and records shared both ways; the work divided.' },
      { value: 'deconflict', label: 'Agree who does what', sub: 'Nobody interviews the same person twice.' },
      { value: 'hold', label: 'Keep your best leads to yourselves', sub: 'Credit stays with the department, if it works.' }] });
    if (how) await x.say(WP.taskForceMeeting(a, how));
  },
  transfer: async (a, x) => {
    const here = A.office(rec().job.officeId)?.city;
    const city = await pickModal({ title: 'Ask for a transfer', body: 'The agency decides on its needs and your record. It takes about six months.', options: A.federalCities().filter((c) => c !== here).map((c) => ({ value: c, label: c })) });
    if (city) await x.say(WP.requestMove('office', city));
  },
  squad: async (a, x) => {
    const r = rec();
    const sq = await pickModal({ title: 'Apply for a squad', body: 'Squads take agents whose background suits the work.', options: (WP.SQUADS[r.job.agencyKind] ?? []).filter(([id]) => id !== r.job.squad).map(([id, label]) => ({ value: id, label })) });
    if (sq) await x.say(WP.requestMove('squad', sq));
  },
  second: async (a, x) => {
    if (a !== 'memoir') return x.say(WP.takeSecond(a));
    const how = await pickModal({ title: 'Your memoir', body: 'What goes in it?', options: [
      { value: 'public', label: 'The work, from the public record', sub: 'What happened in court, and what the job was like. People in the cases stay private.' },
      { value: 'files', label: 'What was in the case files', sub: 'Statements and details people gave in trust. It would sell.' }] });
    if (how) await x.say(WP.takeSecond('memoir', how));
  },
  piAssign: async (a, x) => {
    const q = store.state.investigations.inquiries[a];
    const staff = biz.staffOf(biz.business(q.businessId));
    const who = await pickModal({ title: 'Give it to staff', body: 'They work it with lawful steps only, by its due date. How well depends on them.', options: staff.map((s) => ({ value: s.id, label: `${s.npc.firstName} ${s.npc.lastName}` })) });
    if (who) await x.say(WP.assignInquiry(a, who));
  },
  prep: (a, x) => x.say(C.prepare(a)),
  applyPolice: (a, x) => x.say(C.applyPolice(a)),
  acceptAcademy: (a, x) => x.say(C.acceptAcademy(a)),
  acceptFed: (a, x) => x.say(C.acceptFederal(a)),
  decline: (a, x) => x.say(C.declineOffer(a)),
  academy: (a, x) => x.say(C.academyAct(a)),
  patrol: (a, x) => x.say(C.patrol(a)),
  applyDetective: (a, x) => x.say(C.applyDetective(a)),
  applyFed: (a, x) => x.say(C.applyFederal(a)),
  report: (a, x) => x.say(C.reportToOffice()),
  promote: (a, x) => x.say(C.seekPromotion(a)),
  openCase: (a, x) => openCaseFile(x.api, a, x.render),
  reopen: (a, x) => x.say(W.reopen(a)),
  death: (a, x) => { const [d, s2] = a.split('|'); return x.say(FM.deathStep(d, s2)); },
  signDeath: async (a, x) => { const cause = await pickModal({ title: 'Cause of death', options: Object.entries(FM.CAUSES).map(([v, l]) => ({ value: v, label: l })) }); if (!cause) return; const manner = await pickModal({ title: 'Manner of death', body: 'A separate finding from the cause.', options: Object.entries(FM.MANNERS).map(([v, l]) => ({ value: v, label: l })) }); if (manner) await x.say(FM.signDeathReport(a, cause, manner)); },
  evalStep: (a, x) => { const [e, s2] = a.split('|'); return x.say(FM.evalStep(e, s2)); },
  evalReport: (a, x) => { const [e, o] = a.split('|'); return x.say(FM.reportCompetency(e, o)); },
  focus: (a, x) => x.say(PO.setPriority(a)),
  board: (a, x) => x.say(PO.proposeBoard(a === 'create')),
  sheriff: (a, x) => x.say(PO.runForSheriff()),
  startStory: (a, x) => x.say(X.startStory(a)),
  storyStep: (a, x) => { const [s2, st] = a.split('|'); return x.say(X.storyStep(s2, st)); },
  publish: (a, x) => x.say(X.publishStory(a)),
  correct: (a, x) => x.say(X.correctStory(a)),
  openReview: (a, x) => x.say(W.openReview(a)),
  profile: async (a, x) => { const { openNpc } = await import('./tabs/people.js'); openNpc(store.state.npcs[a], x.api); },
  applyLicense: (a, x) => x.say(C.applyLicense()),
  openAgency: (a, x) => x.say(PI.openAgency()),
  client: (a, x) => { const [b, o] = a.split('|'); return x.say(PI.acceptClient(b, o)); },
  noClient: (a, x) => { const [b, o] = a.split('|'); return x.say(PI.declineClient(b, o)); },
  rate: async (a, x) => { const pick = await pickModal({ title: 'Set fees', options: [0.8, 1, 1.25, 1.5].map((v) => ({ value: String(v), label: `${Math.round(v * 100)}% of the usual rate` })) }); if (pick) await x.say(PI.setRate(a, Number(pick))); },
  piStep: (a, x) => { const [q, s] = a.split('|'); return x.say(PI.inquiryStep(q, s)); },
  piDone: (a, x) => x.say(PI.completeInquiry(a)),
  bench: (a, x) => { const [b, s] = a.split('|'); return x.say(X.benchStep(b, s)); },
  benchReport: (a, x) => { const [b, how] = a.split('|'); return x.say(X.benchReport(b, how)); },
  ia: (a, x) => { const [c, s] = a.split('|'); return x.say(O.iaStep(c, s)); },
  iaDecide: (a, x) => { const [c, f] = a.split('|'); return x.say(O.iaDecide(c, f)); },
};

/** Opens My Investigations. */
export function openInvestigations(api, start = 'overview') {
  const st = { section: start };
  const lines = settle(player()); // anything whose date has come, made known before the page is drawn
  const modal = openModal('<div data-inv></div>', { dismissable: true });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-inv]');
  const render = () => {
    const p = player();
    const r = rec(p);
    const list = sectionsFor(p, r);
    if (!list.some(([id]) => id === st.section)) st.section = 'overview';
    root.innerHTML = `<h2 style="margin-top:0"><span aria-hidden="true">🕵️</span> My Investigations</h2><p class="muted" style="margin-top:-6px">Follow the evidence. Find the truth.</p>
      <div class="world-groups" role="tablist" aria-label="Sections">${list.map(([id, label]) => `<button type="button" role="tab" class="world-group av-chip ${id === st.section ? 'on' : ''}" aria-selected="${id === st.section}" data-sec="${id}">${esc(label)}</button>`).join('')}</div>
      <div style="margin-top:10px">${VIEWS[st.section](p, r)}</div>
      ${stack('<button type="button" class="btn" data-close>Close</button>')}`;
  };
  const say = async (res) => { api.changed(); render(); if (res?.text) await messageModal({ body: res.text, tone: res.tone }); render(); };
  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) { modal.close(); return; }
    const sec = t.closest('[data-sec]');
    if (sec) { st.section = sec.dataset.sec; render(); modal.el.scrollTop = 0; return; }
    const b = t.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) await fn(b.dataset.arg, { st, say, render, api });
  });
  render();
  if (lines.length) messageModal({ body: lines.join(' '), tone: 'neutral' });
  return modal;
}

/** Family Archive → Law enforcement legacy: each investigative career in the family, and the cases that reached a court. */
export function openInvestigativeLegacy() {
  const list = familyInvestigativeLegacy();
  const body = list.map((x) => card(`${x.name}${x.you ? ' · you' : x.died ? ` (died ${x.died})` : ''}`,
    kv([['Years of service', String(x.years ?? '—')], ['Units', x.units.map((u) => SPECIALTIES[u]?.name ?? u).join(', ') || '—'], ...(x.license ? [['License', x.license]] : []), ...(x.retired ? [['Retired', String(x.retired)]] : [])])
    + x.history.slice(-10).map((h) => kv([[String(h.year), h.text]])).join('')
    + (x.cases.length ? `<div class="eyebrow">Cases that went to court</div>${x.cases.slice(-12).map((c) => kv([[String(c.year), `${c.title}: ${c.outcome}`]])).join('')}` : ''))).join('');
  return openModal(`<div class="eyebrow">Professional legacy</div><h2>Law enforcement in the family</h2>
    ${body || '<p class="empty">Nobody in the family has served as an officer, detective, agent or investigator yet.</p>'}
    <p class="muted">The public career and the court record only. Case files, witnesses and statements are not part of a family's record.</p>`, { dismissable: true });
}
