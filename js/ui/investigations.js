// My Investigations: "Follow the evidence. Find the truth." One place for an investigative life,
// from preparing to apply to a department to running a private agency: recruitment, the academy,
// patrol, detective selection, cases (each a file with its own tabs), the team, the career record,
// federal applications, private work, a forensic scientist's bench, professional standards and the
// public record. Every section reads the investigations engine (engine/investigations); every case
// is read through its role-based view (views.js), so nothing here shows what the character cannot know.
import { navRow } from './kit.js';
import { player, country, store } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { meterHtml } from './meter.js';
import { SKILLS, SPECIALTIES, FEDERAL, WITNESS_QUESTIONS, PI_SERVICES, AGENCY_KINDS, STUDY, coverageOf, SOURCES } from '../data/investigations.js';
import { MAJOR_BY_ID } from '../data/majors.js';
// Five skills to follow on screen, not sixteen: each is the average of the finer ones the engine keeps.
const SKILL_GROUPS = [
  ['Detective Work', ['observation', 'reasoning', 'evidence', 'timeline', 'planning']],
  ['Interviews & Reports', ['interviewing', 'writing']],
  ['Law & Ethics', ['law', 'ethics']],
  ['Teamwork & Leadership', ['teamwork', 'management', 'leadership', 'interagency']],
  ['Specialist Skills', ['financial', 'digital', 'forensic']],
];
/** The same five, named for the unit: a fraud detective follows money; a cold case detective reads old files. */
function skillNames(unit) {
  const n = SKILL_GROUPS.map(([name]) => name);
  const first = { homicide: 'Homicide Work', fraud: 'Following the Money', cyber: 'Digital Trails', cold: 'Reading Old Files', missing: 'Search & Urgency', special_victims: 'Trauma-Informed Work', organized: 'Building Networks', corruption: 'Following the Money', arson: 'Fire Scenes', professional_standards: 'Internal Inquiry' }[unit];
  if (first) n[0] = first;
  if (['special_victims', 'family', 'juvenile'].includes(unit)) n[1] = 'Careful Interviews & Reports';
  if (['fraud', 'cyber', 'corruption'].includes(unit)) n[4] = unit === 'cyber' ? 'Digital Evidence' : 'Financial Analysis';
  return n;
}
import { rec, I, reputationOf, dateWords, now, working, legacies } from '../engine/investigations/core.js';
import * as C from '../engine/investigations/careers.js';
import * as A from '../engine/investigations/agencies.js';
import * as W from '../engine/investigations/casework.js';
import * as RT from '../engine/investigations/routine.js';
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
import * as IG from '../engine/investigations/integrity.js';
import * as BK from '../engine/investigations/books.js';
import * as MD from '../engine/investigations/medical.js';
import * as AL from '../engine/investigations/allied.js';
import * as FA from '../engine/investigations/family.js';
import * as SE from '../engine/investigations/serial.js';
import * as UC from '../engine/investigations/undercover.js';
import * as WB from '../engine/investigations/wellbeing.js';
import * as TC from '../engine/investigations/truecrime.js';
import { LAB } from '../data/investigations.js';
const FL_LAB = (id) => LAB[id]?.name ?? id;
import * as biz from '../engine/business.js';
import { settle, investigationsOpen, familyInvestigativeLegacy } from '../engine/investigations/index.js';

export { investigationsOpen };
const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
/** Skills by plain names, for "what is holding you back". */
const SKILL_SAY = { writing: 'report writing', observation: 'observation', interviewing: 'interviewing', ethics: 'ethics', reasoning: 'reasoning', evidence: 'handling evidence', law: 'knowing the law', teamwork: 'teamwork', leadership: 'leadership', timeline: 'timelines' };

/**
 * "This year" at the top of My Investigations: where you stand, the next step and when, what is holding you back
 * (named), and the patrol work still open this year.
 */
function invThisYear(p, r) {
  const j = r?.job;
  if (!j) return '';
  const rows = [['Now', `${p.career.title ?? 'Officer'}${r.stats.years ? `, ${r.stats.years} year${r.stats.years === 1 ? '' : 's'} of service` : ''}`]];
  const holding = [];
  const acts = [];
  if (r.stage === 'academy') rows.push(['Next', r.academy?.end ? `Graduating from the academy, ${dateWords(r.academy.end)}` : 'Graduating from the academy']);
  else if (r.stage === 'field') {
    rows.push(['Next', `Your training officer signs off your field training${j.fieldEnd ? `: the review is ${dateWords(j.fieldEnd)}` : ''}`]);
    const weak = [...C.FTO_SKILLS].sort((a, b) => (r.skills[a] ?? 0) - (r.skills[b] ?? 0))[0];
    holding.push(`Your training officer looks at report writing, observation, interviewing and ethics. Your weakest is ${SKILL_SAY[weak]} (${Math.round(r.skills[weak] ?? 0)}).`);
    if (j.ftoExtensions) holding.push(`Field training has been extended ${j.ftoExtensions} time${j.ftoExtensions === 1 ? '' : 's'} (${C.FTO_EXTENSIONS} at most).`);
  } else if (r.stage === 'probation') rows.push(['Next', `A full police officer${j.probationEnd ? `, ${dateWords(j.probationEnd)}` : ''}`]);
  else {
    const promo = C.promotionOptions(p)[0];
    const det = !j.detective && r.family === 'police' ? C.detectiveUnmet(p) : null;
    if (det) rows.push(['Next', det.length ? 'Detective (selected from serving officers)' : 'Detective: you can apply now']);
    else if (promo) rows.push(['Next', `${promo.name}${promo.block ? '' : ': you can apply now'}`]);
    else rows.push(['Next', 'You are at the top of this path']);
    if (det?.length) holding.push(`For detective work: ${det.join(' ')}`);
    if (promo?.block && !det) holding.push(`For ${promo.name.toLowerCase()}: ${promo.block}`);
  }
  const left = C.patrolLeft(r);
  if (left.length && r.stage !== 'academy') {
    const weak = [...C.FTO_SKILLS].sort((a, b) => (r.skills[a] ?? 0) - (r.skills[b] ?? 0))[0];
    const best = left.find((x) => x.skills.includes(weak)) ?? left[0];
    holding.push(`${left.length} kind${left.length === 1 ? '' : 's'} of patrol work still open this year: they build the skills reviews look at.`);
    acts.push(btn('patrol', best.label, { arg: best.id }));
  }
  if (['field', 'probation', 'officer'].includes(r.stage) && !j.detective) acts.push(btn('autoPatrol', r.autoPatrol ? 'Patrol work: done for you (tap to choose it yourself)' : 'Let routine patrol work be done for you'));
  return `<div class="card this-year-card"><h3>This year</h3>${kv(rows)}${holding.length ? `<div class="section-label">What is holding you back</div>${holding.map((x) => `<p class="body" style="margin:4px 0">${esc(x)}</p>`).join('')}` : ''}${acts.length ? stack(acts.join('')) : ''}</div>`;
}

/** The parts of the police assessment, as the player reads them. */
const WHYNAME = { written: 'the written test', fitness: 'the fitness test', interview: 'the interview', background: 'the background check', medical: 'the medical' };
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
  if (IG.integrityOf(p) || !IG.postBlock('innocence', p) || !IG.postBlock('ciu', p)) out.push(['integrity', 'Innocence & Integrity Work']);
  if (BK.bookRole(p)) out.push(['books', 'Financial Review']);
  if (p.age >= 21) out.push(['allied', 'Related Careers']);
  if (p.medicine?.job?.hospitalId || MD.myRequests(p).length) out.push(['hospital', 'Hospital & Police']);
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

// First-time guidance: one short note at the top of a section the first time it is opened, until dismissed.
const HINTS = {
  overview: 'This is your investigative life at a glance. Each row below opens a part of it; new ones appear as your career opens them.',
  agency: 'Apply to a department here. Decisions take months; the academy and field training happen over real time as you Age Up.',
  federal: 'Federal agencies have their own rules: most want a degree and some professional experience. Each has its own academy and field offices.',
  cases: 'Your open cases. Each has limited hours a year: spend them on the steps that matter. Open a file to work it.',
  cold: 'Cold cases stay open, inactive. One can be reopened when a laboratory method it never had becomes available.',
  career: 'Your record: reputation is how the work is done, never how many arrests. Promotions need years, standing and a vacancy.',
  private: 'A license comes first; then you can open an agency. Private investigators have no police powers: lawful steps only.',
  policy: 'Budgets, oversight and reform are decided by mayors, councils and legislatures. A chief runs the department, not the courts.',
  allied: 'Careers that meet the same cases. Each has one piece of work a year, from real cases, people and courts.',
  integrity: 'Reviews of real convictions. A review is not a retrial: only a court can set a conviction aside.',
  bench: 'Requests from real cases. Do the quality steps, report what the result shows, and nothing more.',
};
const hintSeen = (id) => !!player().flags?.invHints?.[id];
const hint = (id) => (HINTS[id] && !hintSeen(id) ? `<div class="card" style="border-left:3px solid currentColor"><div class="eyebrow">How this works</div><p>${esc(HINTS[id])}</p>${stack(btn('hintOk', 'Got it', { arg: id }))}</div>` : '');
const CASE_HINT = 'A case file: the notebook keeps facts, claims and hypotheses apart. Investigative Actions are where the work is done; each step reveals what it can, once.';

const VIEWS = {
  overview(p, r) {
    const cov = coverageOf(p.countryId);
    let out = invThisYear(p, r) + card('Where you stand', kv([
      ['Status', STAGE_WORDS[r?.stage ?? 'none']],
      ...(r?.job ? [['Employer', A.ownerName(r.job.agencyId ?? r.job.officeId) ?? '—'], ['Rank', p.career.title ?? '—']] : []),
      ...(r ? [['Professional reputation', `${reputationOf(r)} / 100`], ['Years of service', String(r.stats.years)]] : []),
      ['Country rules', cov === 'full' ? 'Modeled in depth (municipal, county, state, federal, private)' : cov === 'regional' ? `This country's own police: ${A.kindsIn(p.countryId).map((k2) => AGENCY_KINDS[k2].name).join(', ')}` : 'Simplified: one national or regional police service, no federal careers'],
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
    for (const { inv, fam } of FA.relativeCases(p).slice(0, 2)) out += card(`${nm(fam[0].id)} is in a police case`, kv([['Case', inv.file.title], ['Their part', fam[0].role], ['Detective', nm(inv.file.leadId)]]) + muted('It is someone else\'s case. Family is family; the case is theirs.')
      + stack(btn('relative', 'Stay out of the case, and stand by them', { arg: `${inv.id}|support` }) + btn('relative', 'Stay out of it entirely', { arg: `${inv.id}|apart` }) + btn('relative', 'Call the detective and ask how it looks', { arg: `${inv.id}|favor`, cls: 'danger' })));
    for (const m of TC.invitations(p)) out += card(`A ${m.kind}: ${m.title}`, muted(m.as === 'investigator' ? 'They want you on it, as the investigator who worked the case.' : `They want you on it: ${m.ancestor} worked the case.`)
      + stack(btn('media', 'Take part, from the public record', { arg: `${m.id}|public` }) + btn('media', 'Decline', { arg: `${m.id}|decline` }) + btn('media', 'Tell them what was in the file', { arg: `${m.id}|file`, cls: 'danger' })));
    if (Object.keys(p.flags?.invHints ?? {}).length) out += stack(btn('hintsReset', 'Show the tips again'));
    const APP = { police: 'Police', detective: 'Detective seat', federal: 'Federal', license: 'License', promotion: 'Promotion' };
    const apps = (r?.apps ?? []).slice(-4).reverse();
    if (apps.length) out += card('Your applications', apps.map((a) => kv([[`${APP[a.kind] ?? 'Application'}: ${a.agency ? FEDERAL[a.agency]?.short : A.ownerName(a.ownerId)}`, a.status === 'pending' ? `Waiting: you hear by ${dateWords(a.decisionDue ?? a.due)}` : a.status === 'offer' ? 'Offered' : a.status === 'accepted' ? 'Accepted' : a.status === 'refused' ? `Not this time${a.why ? `: ${({ written: 'the written assessment', fitness: 'the fitness assessment', interview: 'the interview', background: 'the background check', medical: 'the medical' })[a.why] ?? a.why}` : ''}` : ({ not_selected: 'The panel chose someone else', selected: 'Selected', promoted: 'Promoted', passed_over: 'Someone else was promoted', granted: 'Granted', licensed: 'Licensed', declined: 'Declined' })[a.status] ?? 'Decided']])).join('')
      + (apps.some((a) => a.status === 'refused' && a.kind === 'police') && !apps.some((a) => a.status === 'pending' || a.status === 'offer') ? muted(`You can apply again: one application a year to each department. ${C.WHY_HELP[apps.find((a) => a.status === 'refused')?.why] ?? 'Preparing helps.'}`) + stack(btn('goDepartments', 'Apply again from Departments')) : ''));
    return out;
  },
  agency(p, r) {
    let out = '';
    if (!r?.job) {
      // Getting ready sits here too, where people apply (and apply again).
      out += card('Getting ready', muted('Before applying: study, train, write, and see the work for yourself. Each once a year, and it adds up.')
        + stack(Object.entries(C.PREP).map(([id, d]) => btn('prep', d.label, { arg: id })).join('')));
      for (const a of A.agenciesHere(p)) {
        const no = C.policeUnmet(a, p);
        const d = AGENCY_KINDS[a.kind];
        out += card(a.name, kv([['Kind', d.name], ['Academy', `${d.academyMonths} months`], ['Field training', `${d.fieldMonths} months`], ['Minimum age', String(d.minAge)], ...(d.maxAge ? [['Maximum age', String(d.maxAge)]] : [])])
          + (d.entry ? muted(d.entry) : '') + (d.prosecutor ? muted(`Charging decisions are made by ${d.prosecutor}.`) : '')
          + (a.simplified ? muted('Simplified: this country\'s police recruitment is not modeled in detail.') : '')
          + (no.length ? muted(no[0]) : `${(() => { const o = C.policeOdds(); return muted(`Your chances: ${o.words}.${o.weakest ? ` Your weakest part: ${WHYNAME[o.weakest]}.` : ''}`); })()}${stack(btn('applyPolice', 'Submit an application', { arg: a.id }))}`));
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
        + muted(UN.strikeNote(p.countryId))
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
      + card('Skills', SKILL_GROUPS.map(([, ids], i) => meterHtml(skillNames(r.job?.specialty)[i], Math.round(ids.reduce((t, k) => t + (r.skills[k] ?? 0), 0) / ids.length), true)).join(''))
      + (promos.length ? card('Promotion', promos.map((x) => kv([[x.name, x.block || x.how]]) + (x.block ? '' : stack(btn('promote', `Apply for ${x.name.toLowerCase()}`, { arg: x.id })))).join('')
        + (r.job && !r.retired && (r.stats.years ?? 0) >= 3 ? kv([['Leadership', `${Math.round(r.skills.leadership)} / 100`]]) + muted('Sergeant and above ask for leadership: it grows with mentoring newer colleagues, and with the years.') + stack(btn('mentor', 'Mentor a newer colleague')) : '')) : '')
      + (r.job && !r.retired ? card('Wellbeing', kv([['How the work weighs', WB.level(WB.strainOf(p))]]) + muted('The work takes something out of people. Support is confidential.')
        + stack(Object.entries(WB.SUPPORT).map(([id, d]) => btn('support2', d.label, { arg: id })).join('') + (r.wellbeing?.offered ? btn('medRetire', 'Take the medical retirement') : ''))) : '')
      + (r.undercover?.status === 'active' ? card('Undercover', kv([['Until', dateWords(r.undercover.end)], ['Recordings', String(r.undercover.recordings)]]) + muted('Record what people offer on their own. Pushing them to it is entrapment.')
        + stack(btn('ucRound', 'Stay in the role, within the rules', { arg: 'role' }) + btn('ucRound', 'Push them toward the deal', { arg: 'push', cls: 'danger' }))) : '')
      + (r.earned ? card('Pay beyond salary', kv([[`${r.earned.kind[0].toUpperCase()}${r.earned.kind.slice(1)}, ${r.earned.year}`, fmtMoney(r.earned.amount, country())]]) + muted(r.family === 'federal' ? 'Federal criminal investigators are paid a share of salary for being available beyond the workweek, instead of overtime.' : 'Overtime is paid for hours past the shift, once a year, from the work actually done.')) : '')
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
    const drafts = X.myDrafts(p).map((d) => card(`A draft: ${d.title}`, kv([['Reporter', d.reporterId ? nm(d.reporterId) : 'A reporter'], ['Sourcing', d.unverified ? 'One account is reported as fact, with one source' : 'Every claim has two sources']])
      + stack(btn('draft', 'Send it back for verification', { arg: `${d.id}|back` }) + btn('draft', 'Run it as written', { arg: `${d.id}|run` })))).join('');
    return drafts + (list.length ? card('Cases in the public record', list.map((c) => kv([[c.title, `${c.defendant}: ${c.outcome}`]])).join('') + muted('Only what happened in open court. Case files, witness statements and sealed records are not public.')) : muted('No cases in court here yet.'));
  },
  integrity(p) {
    const I = IG.integrityOf(p);
    if (!I) return card('Reviewing convictions', muted('Innocence organizations and prosecutors\' conviction integrity units review real convictions, one at a time, when kept evidence can be tested anew. The courts decide.')
      + Object.entries(IG.ORGS).map(([id, o]) => kv([[o.post, IG.postBlock(id, p) || `Open to ${o.who}`]]) + (IG.postBlock(id, p) ? '' : stack(btn('integrityJoin', `Join ${o.name}`, { arg: id })))).join(''));
    const open = IG.openMatters(p);
    return card(IG.ORGS[I.org].post, kv([['Since', String(I.since)], ['Convictions set aside', String(I.exonerations)], ['Reviews where the conviction stood', String(I.upheld)]]) + muted('A review is not a retrial. The conviction stands unless a court sets it aside, and the first verdict stays on the record.'))
      + (open.length ? open.map((m) => { const inv = W.investigation(m.invId); const c = store.state.justice.cases[m.caseId];
        return card(`${nm(c.defendantId)}: ${inv.file.title}`, kv([['Done', m.steps.join(', ') || 'nothing yet'], ...(m.lab ? [['Laboratory result due', dateWords(m.lab.due)]] : [])])
          + stack(Object.entries(IG.STEPS).filter(([id]) => !m.steps.includes(id) || id === 'refer').map(([id, label]) => btn('integrityStep', label, { arg: `${m.id}|${id}` })).join(''))); }).join('') : muted('No matter open. Requests for review come as the year turns.'));
  },
  more(p) {
    const list = sectionsFor(p, rec(p));
    const label = Object.fromEntries(list);
    const why = {
      federal: () => { const k2 = Object.keys(FEDERAL).find((x) => C.federalUnmet(x, p).length); return k2 ? C.federalUnmet(k2, p)[0] : ''; },
      private: () => C.licenseUnmet(p)[0] ?? '',
      integrity: () => IG.postBlock('innocence', p),
      allied: () => AL.alliedBlock(Object.keys(AL.ALLIED)[0], p),
    };
    return muted('Other careers in this world, and what each asks first. You can read about each one now.')
      + `<div class="nav-group">${laterPaths(p, list).map((id) => navRow({ attrs: `data-sec="${id}"`, label: label[id], sub: why[id]?.() || SECTION_INFO[id]?.[0] || '', ico: SECTION_INFO[id]?.[1] ?? 'sparkle' })).join('')}</div>`;
  },
  allied(p) {
    const A = AL.alliedOf(p);
    const mine = A && p.career?.careerId === `ally_${A.id}`;
    let out = mine ? card(AL.ALLIED[A.id].name, kv([['Position', p.career.title], ['Careful work', String(A.careful)], ['Misconduct', String(A.misconduct)]])) : '';
    for (const w of mine ? AL.openAllied(p) : []) out += card(w.words.charAt(0).toUpperCase() + w.words.slice(1), stack(AL.ALLIED[A.id].options.map((o) => btn('alliedDo', o.label, { arg: `${w.id}|${o.id}`, cls: o.good ? '' : 'danger' })).join('')));
    if (mine && !AL.openAllied(p).length) out += muted('No work waiting. It comes as the year turns.');
    out += card('Careers around the cases', muted('Analysts, probation officers, victim advocates, court reporters, inspectors general, compliance and insurance investigators: their work meets the same cases, people and courts.')
      + Object.entries(AL.ALLIED).filter(([id]) => !(mine && A.id === id)).map(([id, d]) => { const why = AL.alliedBlock(id, p); return kv([[d.name, why || 'Open to you']]) + (why ? '' : stack(btn('alliedTake', `Become a ${d.ranks[0].toLowerCase()}`, { arg: id }))); }).join(''));
    return out;
  },
  books(p) {
    const list = BK.engagements(p);
    const b = p.books;
    return card('Financial review', kv([['Your role', { corporate: 'Corporate accountant', audit: 'External auditor', forensic: 'Forensic accountant' }[BK.bookRole(p)]], ['Findings referred', String(b?.findings ?? 0)], ['Unfounded referrals', String(b?.unfounded ?? 0)]])
      + muted('A discrepancy is not proof of intent; a failed investment is not fraud. Records come only through your engagement, or a case.') + (b?.forensic ? '' : stack(btn('forensicAcct', 'Qualify in forensic accounting'))))
      + (list.length ? list.map((g) => card(`${g.company}: ${g.what}`, kv([['Done', g.steps.join(', ') || 'nothing yet']])
        + stack(Object.entries(BK.BOOK_STEPS).filter(([id]) => !g.steps.includes(id)).map(([id, label]) => btn('bookStep', label, { arg: `${g.id}|${id}` })).join('')
          + Object.entries(BK.CONCLUSIONS).map(([id, label]) => btn('bookEnd', `Findings: ${label.toLowerCase()}`, { arg: `${g.id}|${id}` })).join('')))).join('') : muted('No engagement open. Work comes as the year turns.'));
  },
  hospital(p) {
    const list = MD.myRequests(p);
    return card('Patients, and the police', muted('You treat the patient. Their records are theirs: findings go to the police only with the patient\'s consent or a court order.'))
      + (list.length ? list.map((q) => card(`${nm(q.patientId)}, brought in`, kv([['Asking', q.detectiveId ? nm(q.detectiveId) : 'A detective']])
        + stack(Object.entries(MD.ANSWER).map(([how, label]) => btn('medAnswer', label, { arg: `${q.id}|${how}`, cls: how === 'chart' ? 'danger' : '' })).join('')))).join('') : muted('No patient from a police case is waiting on you.'));
  },
};

// ---------- The case file ----------

const TABS = [['overview', 'Overview'], ['notebook', 'Notebook'], ['people', 'People'], ['evidence', 'Evidence'], ['statements', 'Witness Statements'], ['lab', 'Laboratory'], ['legal', 'Legal Review'], ['court', 'Court'], ['actions', 'Investigative Actions']];
function caseTabs(v) {
  return TABS.filter(([id]) => (id === 'lab' ? v.labs.length || v.items.length : id === 'court' ? !!v.court : id === 'statements' ? v.claims.length : true));
}
/** The case file on fewer pages: people with their statements, items with the laboratory, the legal review with court. */
const CASE_GROUPS = [['people', 'People & Statements', ['people', 'statements']], ['evidence', 'Evidence & Lab', ['evidence', 'lab']], ['legal', 'Legal & Court', ['legal', 'court']]];
function casePages(v) {
  const tabs = caseTabs(v);
  const out = [];
  const used = new Set();
  for (const [id, label] of tabs) {
    if (used.has(id)) continue;
    const g = CASE_GROUPS.find(([, , ids]) => ids.includes(id));
    const members = g ? tabs.filter(([x]) => g[2].includes(x)) : [[id, label]];
    members.forEach(([x]) => used.add(x));
    out.push({ id: g ? g[0] : id, label: g && members.length > 1 ? g[1] : members[0][1], members });
  }
  return out;
}
const CASE_VIEWS = {
  overview: (v, inv) => {
    const f = inv?.file;
    let out = card(v.title, kv([['Kind', v.kind], ['Agency', v.agency], ['Status', v.status], ['Lead investigator', v.lead], ...(v.partner ? [['Partner', v.partner]] : []), ['Opened', v.opened]]));
    if (f?.conflict?.status === 'open') out += card('Your family is in this case', kv(f.conflict.relatives.map((x) => [nm(x.id), x.role])) + muted('The rule is to step aside when a relative is involved. It protects the case as much as you.')
      + stack(btn('recuse', 'Tell your sergeant, and step aside', { arg: inv.id }) + btn('keepCase', 'Keep the case, and say nothing', { arg: inv.id, cls: 'danger' })));
    if (f?.handoff?.length) out += card('Who has had this case', f.handoff.map((h) => kv([[dateWords(h.at), `${nm(h.from) === '—' ? 'You' : nm(h.from)} to ${nm(h.to) === '—' ? 'you' : nm(h.to)} (${h.why})`]])).join('') + muted('Everything done before is in the file.'));
    if (SE.seriesOf(inv)?.linked) out += card('Linked cases', SE.seriesOf(inv).caseIds.filter((x) => x !== inv.id).map((x) => { const o = W.investigation(x); return kv([[o.file.title, nm(o.file.leadId)]]); }).join('') + muted('The same method in other cities. Each is its own case; the evidence is shared.'));
    const notes = FA.ancestorNotes(inv);
    if (notes) out += card(`${notes.name}'s notes`, muted(`${notes.name} led this case first. Their notes are in the file, in their hand.`) + notes.done.map((t) => `<p>• ${esc(t)}</p>`).join('')
      + (notes.open.length ? `<div class="eyebrow">Leads they left open</div>${notes.open.map((t) => `<p>• ${esc(t)}</p>`).join('')}` : '')
      + (f.oldPartnerAsked ? '' : stack(btn('oldPartner', `Find ${notes.name}'s old partner`, { arg: inv.id }))));
    return out;
  },
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
    const f = inv.file;
    const mine = f.leadId === player().id;
    const ground = RT.groundworkSteps(inv.id);
    // Grouped, so a long case reads as a few kinds of work rather than one long list.
    const groups = [];
    const add = (title, html, note = '') => { if (html) groups.push(`<div class="section-label">${esc(title)}</div>${note ? muted(note) : ''}${stack(html)}`); };
    const steps = st.filter((s) => ground.length <= 1 || !ground.some((g) => g.id === s.id));
    add('Investigate', (ground.length > 1 && left > 0 ? btn('groundwork', 'Do the groundwork', { arg: inv.id, cls: 'primary' }) : '')
      + steps.filter((s) => !String(s.id).startsWith('lab:')).map((s) => btn(s.interview ? 'interview' : 'step', s.label, { arg: `${inv.id}|${s.id}`, disabled: left <= 0 })).join(''), 'Scene, people and records. Each step reveals what it can, once.');
    add('Laboratory', steps.filter((s) => String(s.id).startsWith('lab:')).map((s) => btn('step', s.label, { arg: `${inv.id}|${s.id}`, disabled: left <= 0 })).join(''), 'Results come back on their own dates.');
    let tools = '';
    if (['drugs', 'firearms', 'robbery', 'counterfeit'].includes(f.template) && !f.outcome && mine) {
      if (!f.informantId) tools += btn('recruit', 'Recruit an informant, registered with your supervisor', { arg: `${inv.id}|register` }) + btn('recruit', 'Recruit an informant off the books', { arg: `${inv.id}|off`, cls: 'danger' });
      else { tools += btn('meetCI', 'Meet the informant', { arg: inv.id }); if (f.tip && !f.tip.corroborated) tools += btn('corroborate', 'Check the tip against independent evidence', { arg: inv.id }); }
      if (rec()?.undercover?.status !== 'active') tools += btn('undercover', 'Volunteer to go undercover on this case', { arg: inv.id });
    }
    if (['homicide', 'robbery'].includes(f.template) && !f.compared && !f.outcome && mine) tools += btn('compare', 'Compare it with cases across the country', { arg: inv.id });
    if (MD.patientOf(inv) && !f.medical && !f.outcome) for (const [how, label] of Object.entries(MD.ASK)) tools += btn('medical', label, { arg: `${inv.id}|${how}`, cls: how === 'informal' ? 'danger' : '' });
    add('Other tools', tools);
    let wrap = '';
    if (!f.outcome && !f.courtCaseId) {
      wrap += btn('writeReport', 'Write the case report (complete)', { arg: `${inv.id}|complete` }) + btn('writeReport', 'Write the report, leaving out what does not fit', { arg: `${inv.id}|omit`, cls: 'danger' });
      for (const id of inv.suspectIds) wrap += btn('refer', `Refer ${nm(id)} to the prosecutor`, { arg: `${inv.id}|${id}` });
      wrap += btn('resolve', 'Close the case on what the evidence shows', { arg: inv.id }) + btn('suspend', 'Set the case aside (stays open)', { arg: inv.id });
    }
    if (f.review?.status === 'open') wrap += btn('referReview', 'Send the review to the prosecutor\'s conviction review', { arg: inv.id });
    add('Wrapping up', wrap, f.outcome || f.courtCaseId ? '' : 'The report comes before a referral. The prosecutor decides on charges.');
    let court = '';
    if (v.court && !f.cross && !f.outcome) court += btn('crossExam', 'Take the stand: cross-examination', { arg: inv.id });
    if (v.court && !f.testimony && !f.outcome) court += btn('testify', 'Prepare to testify: as recorded', { arg: `${inv.id}|record` }) + btn('testify', 'Prepare to testify: including the limits', { arg: `${inv.id}|limits` }) + btn('testify', 'Prepare to testify: make it sound stronger', { arg: `${inv.id}|overstate`, cls: 'danger' });
    add('Court', court);
    return card('What you can do', muted(`${left} hours of work left on this case this year.`) + (groups.join('') || muted('Nothing more to do on this file now.')));
  },
};
function openCaseFile(api, invId, refreshHub) {
  // A case the player is working opens on its actions, where the work is done; a finished one on its overview.
  const inv0 = W.investigation(invId);
  const st = { tab: inv0?.file && !inv0.file.outcome && inv0.file.leadId === player().id ? 'actions' : 'overview' };
  const modal = openModal('<div data-case></div>', { dismissable: true, full: true, title: W.investigation(invId)?.file?.title ?? 'Case file' });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-case]');
  const render = () => {
    const inv = W.investigation(invId);
    const v = V.view(inv, 'investigator');
    if (!v) { root.innerHTML = muted('This file is not yours to read.') + stack('<button type="button" class="btn" data-close>Close</button>'); return; }
    const tabs = casePages(v);
    const tab = tabs.find((t) => t.id === st.tab) ?? tabs.find((t) => t.members.some(([x]) => x === st.tab)) ?? tabs[0];
    st.tab = tab.id;
    const page = tab.members.map(([x]) => CASE_VIEWS[x](v, inv)).join('');
    root.innerHTML = `
      <div class="world-groups" role="tablist" aria-label="Case file">${tabs.map((t) => `<button type="button" role="tab" class="world-group av-chip ${t.id === st.tab ? 'on' : ''}" aria-selected="${t.id === st.tab}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
      <div style="margin-top:10px">${hintSeen('case') ? '' : `<div class="card" style="border-left:3px solid currentColor"><div class="eyebrow">How this works</div><p>${esc(CASE_HINT)}</p>${stack(btn('hintCase', 'Got it'))}</div>`}${page}</div>${stack('<button type="button" class="btn" data-close>Close the file</button>')}`;
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
    else if (act === 'groundwork') await say(RT.groundwork(id));
    else if (act === 'writeReport') await say(W.writeReport(id, x));
    else if (act === 'referReview') await say(W.referReview(id));
    else if (act === 'refer') await say(W.refer(id, x));
    else if (act === 'testify') await say(W.testify(id, x));
    else if (act === 'hintCase') { const p0 = player(); p0.flags.invHints = { ...(p0.flags.invHints ?? {}), case: true }; render(); }
    else if (act === 'medical') await say(MD.requestMedical(id, x));
    else if (act === 'compare') await say(SE.compareCases(id));
    else if (act === 'recruit') await say(UC.recruit(id, x));
    else if (act === 'meetCI') await say(UC.meetInformant(id));
    else if (act === 'corroborate') await say(UC.corroborate(id));
    else if (act === 'undercover') await say(UC.goUndercover(id));
    else if (act === 'recuse') await say(FA.recuse(id));
    else if (act === 'keepCase') await say(FA.keepCase(id));
    else if (act === 'oldPartner') await say(FA.askOldPartner(id));
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
  mentor: (a, x) => x.say(WP.mentor()),
  goDepartments: (a, x) => { x.st.section = 'agency'; x.render(); },
  hintOk: (a, x) => { const p = player(); p.flags.invHints = { ...(p.flags.invHints ?? {}), [a]: true }; x.render(); },
  hintsReset: (a, x) => { player().flags.invHints = {}; x.say({ text: 'The tips will show again, once each.', tone: 'neutral' }); },
  media: (a, x) => { const [id, how] = a.split('|'); return x.say(TC.takePart(id, how)); },
  support2: (a, x) => x.say(WB.seekSupport(a)),
  medRetire: (a, x) => x.say(WB.medicalRetirement()),
  ucRound: (a, x) => x.say(UC.undercoverRound(a)),
  relative: (a, x) => { const [id, how] = a.split('|'); return x.say(FA.relativeChoice(id, how)); },
  alliedTake: (a, x) => x.say(AL.takeUp(a)),
  alliedDo: (a, x) => { const [id, o] = a.split('|'); return x.say(AL.doAllied(id, o)); },
  integrityJoin: (a, x) => x.say(IG.takePost(a)),
  integrityStep: (a, x) => { const [id, s] = a.split('|'); return x.say(IG.step(id, s)); },
  forensicAcct: (a, x) => x.say(BK.qualifyForensic()),
  bookStep: (a, x) => { const [id, s] = a.split('|'); return x.say(BK.bookStep(id, s)); },
  bookEnd: (a, x) => { const [id, s] = a.split('|'); return x.say(BK.concludeBooks(id, s)); },
  medAnswer: (a, x) => { const [id, s] = a.split('|'); return x.say(MD.answerRequest(id, s)); },
  draft: (a, x) => { const [id, s] = a.split('|'); return x.say(X.editDraft(id, s)); },
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
  autoPatrol: (_, x) => x.say(C.setAutoPatrol(!rec()?.autoPatrol)),
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
/** The home screen's groups: each section as a row, with what it is for, in an order a player can follow. */
const GROUPS = [
  ['Your work', ['cases', 'bench', 'death', 'competency', 'psych', 'books', 'hospital', 'stories', 'press', 'standards']],
  ['Your career', ['agency', 'career', 'team']],
  ['Case history', ['archive', 'cold', 'reviews']],
  ['Other paths', ['federal', 'private', 'integrity', 'allied']],
  ['The wider world', ['policy', 'legacy']],
];
const SECTION_INFO = {
  cases: ['Your open cases, and the hours each has left this year', 'briefcase'], bench: ['Requests from real cases, waiting on your bench', 'sparkle'],
  death: ['Deaths referred to you by investigators', 'health'], competency: ['Evaluations ordered by the courts', 'health'], psych: ['Consultations, risk assessments and care for officers', 'people'],
  books: ['Engagements on companies\' books', 'coin'], hospital: ['Patients from police cases, and what the police may know', 'health'],
  stories: ['Stories you are working on', 'news'], press: ['Cases in the public record, and reporters\' drafts', 'news'], standards: ['Complaints, and how they are decided', 'passport'],
  agency: ['Your department, detective seats, the union and community meetings', 'home'], career: ['Your record, promotions, wellbeing and honors', 'trophy'], team: ['Your partner, supervisor and the people you work with', 'people'],
  archive: ['Cases you finished', 'archive'], cold: ['Old cases that new science could reopen', 'archive'], reviews: ['Convictions whose kept evidence could be tested anew', 'archive'],
  federal: ['FBI, DEA, ATF, Marshals, Secret Service, HSI, IRS-CI', 'globe'], private: ['A license, your own agency, corporate work', 'id'],
  integrity: ['Reviewing convictions for an innocence organization or a prosecutor', 'passport'], allied: ['Analysts, probation, advocates, court reporters and more', 'people'],
  policy: ['Budgets, oversight, sheriffs and national reform', 'globe'], legacy: ['Your family\'s investigative careers', 'family'],
};
/** The other paths that are not open to the player now (their reasons are on the More careers screen). */
function laterPaths(p, list) {
  const have = new Set(list.map(([id]) => id));
  const r = rec(p);
  const open = {
    federal: () => r?.family === 'federal' || Object.keys(FEDERAL).some((k2) => !C.federalUnmet(k2, p).length),
    private: () => C.licensed(p) || !C.licenseUnmet(p).length || (r?.inquiryIds?.length ?? 0) > 0,
    integrity: () => !!IG.integrityOf(p) || !IG.postBlock('innocence', p) || !IG.postBlock('ciu', p),
    allied: () => !!AL.alliedOf(p) || Object.keys(AL.ALLIED).some((id) => !AL.alliedBlock(id, p)),
  };
  return Object.keys(open).filter((id) => have.has(id) && !open[id]());
}
/** The home screen: where the player stands, anything waiting on them, then every section as a row. */
function home(p, r, list) {
  const have = new Set(list.map(([id]) => id));
  const label = { ...Object.fromEntries(list), more: 'More careers' };
  const later = laterPaths(p, list);
  const groups = GROUPS.map(([name, ids]) => [name, ids.filter((id) => have.has(id) && !later.includes(id))]).filter(([, ids]) => ids.length);
  // Paths not open yet wait behind one row, so a new officer sees what they can do now.
  if (later.length) { const g = groups.find(([n]) => n === 'Other paths'); if (g) g[1].push('more'); else groups.push(['Other paths', ['more']]); }
  const sub = (id) => {
    if (id === 'more') return `${later.map((x) => label[x]).join(', ')}: not open to you yet`;
    if (id === 'cases' && r) { const open = r.caseIds.map(W.investigation).filter((inv) => inv?.file && !inv.file.outcome); return open.length ? `${open.length} open case${open.length === 1 ? '' : 's'}` : SECTION_INFO.cases[0]; }
    return SECTION_INFO[id]?.[0] ?? '';
  };
  return `${hint('overview')}${VIEWS.overview(p, r)}${groups.map(([name, ids]) => `<div class="section-label">${esc(name)}</div><div class="nav-group">${ids.map((id) => navRow({ attrs: `data-sec="${id}"`, label: label[id], sub: sub(id), ico: SECTION_INFO[id]?.[1] ?? 'sparkle' })).join('')}</div>`).join('')}`;
}

export function openInvestigations(api, start = 'overview') {
  const st = { section: start };
  const r0 = rec(player());
  // Anything whose date has come, and what the year decided while the page was closed, made known before it is drawn.
  const lines = [...(r0?.unread ?? []), ...settle(player())];
  if (r0) r0.unread = [];
  const modal = openModal('<div data-inv></div>', { dismissable: true, full: true, title: 'My Investigations' });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-inv]');
  const render = () => {
    const p = player();
    const r = rec(p);
    const list = sectionsFor(p, r);
    if (st.section !== 'more' && !list.some(([id]) => id === st.section)) st.section = 'overview';
    // The home screen lists every section; a section is a screen of its own, and Back (in the bar) returns home.
    const name = { ...Object.fromEntries(list), more: 'More careers' }[st.section];
    root.innerHTML = st.section === 'overview'
      ? `<p class="muted" style="margin-top:0"><span aria-hidden="true">🕵️</span> Follow the evidence. Find the truth.</p>${home(p, r, list)}`
      : `<button type="button" class="btn small" data-back>‹ My Investigations</button><h2 style="margin-top:0">${esc(name)}</h2>
        <div>${hint(st.section)}${VIEWS[st.section](p, r)}</div>`;
    root.innerHTML += stack('<button type="button" class="btn" data-close>Close</button>');
  };
  const say = async (res) => { api.changed(); render(); if (res?.text) await messageModal({ body: res.text, tone: res.tone }); render(); };
  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) { modal.close(); return; }
    if (t.closest('[data-back]')) { st.section = 'overview'; render(); modal.el.scrollTop = 0; return; }
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
