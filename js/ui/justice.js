// The justice system on screen: a case from arrest to sentence, the case file,
// the player's legal status and history, civil claims, and the duties of the
// legal professions. The open case is saved after every step, so closing the
// app mid-case resumes where it left off.
import { store, player, country, npcsByRole } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import * as law from '../engine/justice.js';
import * as k from '../engine/cases.js';
import * as civil from '../engine/civil.js';
import * as jobs from '../engine/legalCareers.js';
import { appealCase } from '../engine/prison.js';
import { OFFENSE_BY_ID, SYSTEMS, SANCTIONS, EVIDENCE, courtsFor } from '../data/justice.js';
import { rng } from '../rng.js';
import { messageModal, pickModal, confirmModal, openModal } from './modals.js';
import { openNpc } from './tabs/people.js';

const cty = () => country();
const offName = (c) => OFFENSE_BY_ID[c.charges[0].offenseId].name;
const person = (id, api) => {
  if (!id) return '<span class="muted">none</span>';
  if (id === player().id) return 'You';
  const n = k.person(id);
  return n ? `<button class="person-link" data-person="${esc(id)}">${esc(n.firstName)} ${esc(n.lastName)}</button>` : 'someone no longer known';
};
const bindPeople = (el, api, after) => el.addEventListener('click', (e) => {
  const id = e.target.closest('[data-person]')?.dataset.person;
  if (!id) return;
  const n = k.person(id);
  if (n) { after?.(); openNpc(n, api, { readOnly: true }); }
});

// ---------- From arrest to sentence ----------

/** Runs any open case to its end. Safe to call when there is none. */
export async function runJustice(api) {
  for (let guard = 0; guard < 12; guard++) {
    const c = law.pendingCase();
    if (!c) return;
    if (c.stage === 'charged') await bail(c, api);
    else if (c.stage === 'pretrial') await counsel(c, api);
    else if (c.stage === 'plea') { if (await plead(c, api) === 'pause') return; }
    else if (c.stage === 'trial' || c.stage === 'mistrial') {
      const r = k.trial(c);
      await finish(c, r.lines, api);
    } else return;
  }
}

async function bail(c, api) {
  const b = k.bailHearing(c);
  api.changed();
  const sys = SYSTEMS[c.systemId];
  await messageModal({ eyebrow: `${c.court} · first hearing`, title: `Charged with ${offName(c).toLowerCase()}`,
    body: `${b.text} Being charged is not being guilty: that is for the court to decide. Cases here are decided ${sys.factFinder === 'jury' ? 'by a jury for serious charges, by a judge otherwise' : sys.factFinder === 'mixed' ? 'by professional and lay judges together' : 'by judges'}.` });
  if (b.decision !== 'bail') { if (b.decision === 'remand') k.remand(c); api.changed(); return; }
  const c2 = cty();
  const family = [...npcsByRole('parent'), ...npcsByRole('spouse'), ...npcsByRole('partner')].filter((n) => n.meters.relationship >= 50 && (n.savings ?? 0) >= b.amount);
  const who = await pickModal({ title: `Bail: ${fmtMoney(b.amount, c2)}`, body: 'Bail is returned at the end of the case, as long as the conditions are kept.',
    cancel: 'Wait in custody',
    options: [{ value: player().id, label: 'Pay it yourself', disabled: player().finance.cash < b.amount, sub: `You have ${fmtMoney(player().finance.cash, c2)}.` },
      ...family.map((n) => ({ value: n.id, label: `Ask ${n.firstName}`, sub: 'They decide.' }))] });
  if (who && (who === player().id || rng.chance(0.8))) k.postBail(c, who);
  if (who && who !== player().id && c.bail.status !== 'held') await messageModal({ body: `${k.nameOf(who)} said no.` });
  if (c.bail.status !== 'held') k.remand(c);
  api.changed();
}

async function counsel(c, api) {
  const c2 = cty();
  const opts = k.counselOptions(c);
  const pick = await pickModal({ title: 'Who will defend you?', body: `The charge is ${offName(c).toLowerCase()}. Lawyers are people: the same one can act for you again. A dearer lawyer has more time, not a guarantee.`,
    cancel: 'Decide later',
    options: opts.map((o) => ({ value: o, label: o.label, disabled: !o.ok, sub: `${o.blurb ?? ''}${o.cost ? ` ${fmtMoney(o.cost, c2)}.` : o.tier === 'public' ? ' Free.' : ''}${o.why ? ` ${o.why}` : ''}`.trim() })) });
  const chosen = pick ?? opts.find((o) => o.tier === 'public' && o.ok) ?? opts.find((o) => o.tier === 'self');
  k.appoint(c, chosen.tier, chosen.npcId);
  api.changed();
}

async function plead(c, api) {
  const sys = SYSTEMS[c.systemId];
  const file = k.caseFile(c);
  const lines = file.map((e) => `• ${e.kind}${e.against ? '' : ' (points elsewhere)'}: ${e.reliability}.`).join(' ');
  const view = await pickModal({ title: 'Your case', body: `${k.advice(c)} Evidence: ${lines}`, cancel: 'Back',
    options: [{ value: 'file', label: 'Read the whole case file' }, { value: 'go', label: 'Decide how to plead' }] });
  if (view === 'file') { openCaseFile(c.id, api); return 'pause'; }
  if (view !== 'go') { await messageModal({ body: 'Your case is saved. It carries on when you come back to it, or when the year ends.' }); return 'pause'; }
  const o = k.offer(c);
  const plea = await pickModal({ title: 'How do you plead?', body: k.pleaTerms(c), cancel: 'Plead not guilty',
    options: [
      { value: 'notGuilty', label: 'Not guilty', sub: sys.factFinder === 'jury' ? 'A trial. The prosecution must prove it.' : 'The court examines the evidence and decides.' },
      { value: 'guilty', label: 'Guilty', sub: sys.plea === 'limited' ? 'The court still examines the case, and takes your admission into account.' : 'No trial. A conviction, and a lighter sentence.' },
      ...(o ? [{ value: 'deal', label: 'Accept the prosecution\'s offer', sub: `${o.text} A judge must approve it.` }] : []),
    ] });
  const r = k.enterPlea(c, plea ?? 'notGuilty');
  api.changed();
  if (c.stage === 'plea') { await messageModal({ body: r.lines.join(' ') }); return; }
  await finish(c, r.lines, api);
}
async function finish(c, lines, api) {
  law.afterVerdict(c);
  api.changed();
  const s = k.J().sentences[c.sentenceId];
  const outcome = c.stage === 'sentenced' ? `Sentence: ${k.describe(s)}.${s.fine ? ` A fine of ${fmtMoney(s.fine, cty())}.` : ''}`
    : c.stage === 'acquitted' ? 'You are free to go. An acquittal is not a conviction, and the record says so.' : 'The case is over.';
  await messageModal({ eyebrow: 'The verdict', title: c.stage === 'sentenced' ? 'Guilty' : c.stage === 'acquitted' ? 'Not guilty' : 'Case dropped',
    body: `${lines.join(' ')} ${outcome}`, tone: c.stage === 'sentenced' ? 'bad' : 'good' });
}

// ---------- The case file ----------

/** Everything about one case: who, what, every hearing, the outcome. */
export function openCaseFile(caseId, api) {
  const c = k.J().cases[caseId];
  if (!c) return messageModal({ body: 'This record is older than the court records: only the outcome was kept.' });
  const s = k.J().sentences[c.sentenceId];
  const sys = SYSTEMS[c.systemId];
  const mine = c.defendantId === player().id;
  const grounds = mine ? k.appealGrounds(c) : [];
  const c2 = cty();
  const pays = k.paymentsFor(c.id);
  const ev = k.caseFile(c).map((e) => `<div class="kv"><span>${esc(e.kind)}</span><span>${esc(e.summary)} <em class="muted">${esc(e.reliability)}${e.excluded ? ', excluded' : ''}</em></span></div>`).join('');
  const m = openModal(`
    <h2>${esc(offName(c))}</h2>
    <p class="muted">Case ${esc(c.id.replace('case_', 'No. '))} · ${esc(c.court)} · ${esc(c2.name)} · ${esc(sys.name)}</p>
    <div class="section-label">People</div>
    <div class="kv"><span>Defendant</span><span>${person(c.defendantId)}</span></div>
    <div class="kv"><span>Judge</span><span>${person(c.judgeId)}</span></div>
    <div class="kv"><span>Prosecutor</span><span>${person(c.prosecutorId)}</span></div>
    <div class="kv"><span>Defence</span><span>${c.defenceTier === 'self' ? 'Represented themselves' : person(c.defenceId)}</span></div>
    <div class="section-label">Evidence</div>${ev || '<p class="muted">None on file.</p>'}
    <div class="section-label">Hearings</div>
    ${c.hearings.map((h) => `<div class="kv"><span>${h.year}</span><span>${esc(h.text)}</span></div>`).join('')}
    ${s ? `<div class="section-label">Sentence</div><div class="kv"><span>${esc(SANCTIONS[s.type] ?? s.type)}</span><span>${esc(k.describe(s))} · ${esc(s.status)}</span></div>
      ${s.modifications.map((x) => `<div class="kv"><span>${x.year}</span><span>${esc(x.why)}</span></div>`).join('')}` : ''}
    ${pays.length ? `<div class="section-label">Money</div>${pays.map((t) => `<div class="kv"><span>${esc(t.kind.replace(/_/g, ' '))}</span><span>${esc(fmtMoney(t.amount, c2))} · ${esc(t.status)}</span></div>`).join('')}` : ''}
    <div class="btn-stack" style="margin-top:14px">
      ${grounds.map((g) => `<button class="btn" data-appeal="${g.id}">Appeal: ${esc(g.name.toLowerCase())}</button>`).join('')}
      <button class="btn" data-close>Close</button>
    </div>`, { dismissable: true });
  bindPeople(m.el, api, () => m.close());
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const g = e.target.closest('[data-appeal]')?.dataset.appeal;
    if (!g) return undefined;
    m.close();
    const r = appealCase(c.id, g);
    api.changed();
    return messageModal({ eyebrow: courtsFor(c.countryId).appeal, body: r.text, tone: r.tone });
  });
  return m;
}

// ---------- Legal status, history and claims ----------

/** The Legal matters card in Pursuits. */
export function legalCard() {
  const p = player();
  const l = law.legal();
  const sup = l.supervision;
  const recs = l.record;
  const claims = civil.openClaims();
  const pending = law.pendingCase();
  if (!recs.length && !sup && !claims.length && !pending && !l.history.length && p.age < 18) return '';
  return `<div class="card"><h3>Legal matters</h3>
    <div class="kv"><span>Status</span><span>${esc(law.status())}</span></div>
    ${pending ? `<div class="kv"><span>Open case</span><span>${esc(offName(pending))} · ${esc(pending.court)}</span></div>` : ''}
    ${sup ? `<div class="kv"><span>Supervision</span><span>until ${sup.until}: ${esc(sup.conditions.join('; ').toLowerCase())}</span></div>` : ''}
    ${recs.map((r) => `<button class="row" data-case="${esc(r.caseId)}"><div class="main"><strong>${esc(r.offense ?? OFFENSE_BY_ID[r.crimeId]?.name ?? r.crimeId)}</strong>
      <small>Age ${r.age} · ${esc(outcomeWords(r))}</small></div></button>`).join('')}
    ${claims.map((x) => `<button class="row" data-claim="${esc(x.id)}"><div class="main"><strong>${esc(x.name)}</strong><small>Civil · ${esc(x.court)} · ${esc(x.stage)}</small></div></button>`).join('')}
    <div class="btn-stack" style="margin-top:10px">
      ${pending ? '<button class="btn primary" data-legal="resume">Go back to your case</button>' : ''}
      ${law.sealOptions().length ? '<button class="btn" data-legal="seal">Apply to seal a record</button>' : ''}
      ${civil.claimOptions().length ? '<button class="btn" data-legal="claim">Bring a civil claim</button>' : ''}
      ${l.history.length ? '<button class="btn" data-legal="history">Your legal history</button>' : ''}
    </div></div>`;
}
function outcomeWords(r) {
  const base = r.exonerated ? 'exonerated' : r.pardoned ? 'convicted, later pardoned' : r.outcome === 'diversion completed' ? 'diverted, no conviction'
    : r.outcome === 'diverted' ? 'diversion programme' : r.convicted ? `convicted${r.sentenceYears ? `, ${r.sentenceYears} yr` : r.sentenceType ? `, ${SANCTIONS[r.sentenceType] ?? r.sentenceType}` : ''}` : r.outcome ?? 'not convicted';
  return `${base}${r.sealed ? ' · sealed' : ''}${r.juvenile ? ' · juvenile' : ''}${r.legacy ? ' · older record' : ''}`;
}

/** Handles clicks inside the Legal matters card. Returns true if it handled one. */
export function legalClick(e, api) {
  const caseId = e.target.closest('[data-case]')?.dataset.case;
  if (caseId) { openCaseFile(caseId, api); return true; }
  const claimId = e.target.closest('[data-claim]')?.dataset.claim;
  if (claimId) { openClaim(claimId, api); return true; }
  const act = e.target.closest('[data-legal]')?.dataset.legal;
  if (!act) return false;
  ({ resume: () => api.justice(), seal: () => seal(api), claim: () => newClaim(api), history: () => history(api) })[act]();
  return true;
}

async function seal(api) {
  const id = await pickModal({ title: 'Seal a record', body: 'A sealed record is hidden from most employers. It is not erased: the history stays true.',
    options: law.sealOptions().map((o) => ({ value: o.caseId, label: o.label, disabled: !o.ok, sub: o.why || 'Eligible now.' })) });
  if (!id) return;
  const r = law.sealRecord(id);
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function newClaim(api) {
  const kind = await pickModal({ title: 'Bring a civil claim', body: `A civil claim is about money owed, not about crime. There is a filing fee of ${fmtMoney(Math.round(civil.FILING_FEE * cty().currency.scale), cty())}.`,
    options: civil.claimOptions().map((o) => ({ value: o.id, label: o.name, disabled: !o.ok, sub: o.why || o.blurb })) });
  if (!kind) return;
  const r = civil.bringClaim(kind);
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
  if (r.claim) await openClaim(r.claim.id, api);
}

async function openClaim(id, api) {
  const c = k.J().civil[id];
  const acts = civil.claimActions(c);
  const pick = await pickModal({ title: c.name, body: `${c.history.map((h) => `${h.year}: ${h.text}`).join(' ')} The claim is ${fmtMoney(c.claim, cty())}.`,
    cancel: 'Close', options: acts.map((a) => ({ value: a.id, label: a.label })) });
  if (!pick) return;
  const r = civil.actOnClaim(id, pick);
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
  if (!['decided', 'settled', 'withdrawn'].includes(c.stage)) await openClaim(id, api);
}

function history(api) {
  const h = law.legal().history;
  const m = openModal(`<h2>Legal history</h2>
    ${[...h].reverse().map((x) => `<div class="kv"><span>${x.year}${x.age != null ? ` · age ${x.age}` : ''}</span><span>${esc(x.text)}${x.caseId && k.J().cases[x.caseId] ? ` <button class="person-link" data-file="${esc(x.caseId)}">case file</button>` : ''}</span></div>`).join('')}
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const f = e.target.closest('[data-file]')?.dataset.file;
    if (f) { m.close(); openCaseFile(f, api); }
    return undefined;
  });
}

// ---------- The legal professions ----------

/** Buttons for the player's legal job, if they have one. */
export const dutyButtons = () => jobs.duties().map((d) => [`duty:${d.id}`, d.done ? `${d.label} · done this year` : d.label, d.done]);

export async function runDuty(id, api) {
  const flows = { investigate, defend: () => brief('defend', api), prosecute: () => brief('prosecute', api), preside, shift };
  await flows[id](api);
  api.changed();
}

async function investigate(api) {
  const inv = jobs.openInvestigationBrief();
  if (!inv) return messageModal({ body: 'You have worked your case for this year.' });
  const inc = k.J().incidents[inv.incidentId];
  for (let step = 0; step < 6; step++) {
    const file = inv.evidenceIds.map((id) => k.J().evidence[id]).map((e) => `${EVIDENCE[e.kind].name}: ${e.summary}${e.retracted ? ' (withdrawn)' : ''}`).join(' · ');
    const act = await pickModal({ title: `${OFFENSE_BY_ID[inc.offenseId].name} in ${inc.city}`, body: file || 'An empty file.', cancel: 'Leave it for now',
      options: jobs.detectiveOptions(inv).map((o) => ({ value: o.id, label: o.label, sub: o.sub })) });
    if (!act) return undefined;
    const r = jobs.detectiveAct(inv, act);
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
    if (r.done) return r.caseId ? openCaseFile(r.caseId, api) : undefined;
  }
  return undefined;
}

async function brief(side, api) {
  const c = jobs.openCourtBrief(side);
  if (!c) return messageModal({ body: 'Your diary is full for this year.' });
  const file = k.caseFile(c).map((e) => `${e.kind}: ${e.reliability}${e.against ? '' : ' (points elsewhere)'}`).join(' · ');
  const choice = await pickModal({ title: `${side === 'defend' ? 'Defending' : 'Prosecuting'} ${k.nameOf(c.defendantId)}`,
    body: `Charged with ${offName(c).toLowerCase()} in the ${c.court}. Evidence: ${file}.`, cancel: side === 'defend' ? 'Fight it at trial' : 'Prosecute as charged',
    options: jobs.counselChoices(c).map((o) => ({ value: o.id, label: o.label, sub: o.sub })) });
  let r = jobs.argue(c, choice ?? (side === 'defend' ? 'trial' : 'proceed'));
  if (!r.ok && r.tone === 'neutral' && c.stage === 'plea') { await messageModal({ body: r.text }); r = jobs.argue(c, 'trial'); }
  await messageModal({ body: r.text, tone: r.tone });
  return openCaseFile(c.id, api);
}

async function preside(api) {
  const c = jobs.openBench();
  if (!c) return messageModal({ body: 'Your list is full for this year.' });
  const admit = {};
  for (const r of jobs.rulingsNeeded(c)) {
    if (r.mustExclude) { await messageModal({ eyebrow: 'A ruling', body: `${r.summary} It was obtained unlawfully, and the law here requires it to be left out. You exclude it.` }); continue; }
    const yes = await confirmModal({ title: 'Admit this evidence?', body: `${r.summary} It was obtained without lawful authority. The law here leaves it to your judgment, and the Court of Appeal may review it.`, yes: 'Admit it', no: 'Exclude it' });
    admit[r.id] = !!yes;
  }
  const t = jobs.hear(c, admit);
  if (c.stage !== 'convicted') {
    jobs.acquittedHere(c);
    await messageModal({ eyebrow: c.court, body: `${t.lines.join(' ')}` });
    return openCaseFile(c.id, api);
  }
  const range = jobs.sentencingRange(c);
  const type = await pickModal({ title: `Sentencing: ${range.offense.name}`, body: `${t.lines.join(' ')} The law allows: ${range.ladder.map((x) => SANCTIONS[x]).join(', ')}.`,
    cancel: 'Leave it to the guidelines', options: range.ladder.map((x) => ({ value: x, label: SANCTIONS[x][0].toUpperCase() + SANCTIONS[x].slice(1) })) });
  let years;
  if (type === 'custody') {
    const [lo, hi] = range.custody;
    const opts = [...new Set([Math.max(1, lo), Math.round((lo + hi) / 2), hi])];
    years = await pickModal({ title: 'How long?', body: `Between ${Math.max(1, lo)} and ${hi} years.`, options: opts.map((y) => ({ value: y, label: `${y} year${y === 1 ? '' : 's'}` })) });
  }
  const r = jobs.passSentence(c, type ?? range.ladder[0], years);
  await messageModal({ body: r.text });
  return openCaseFile(c.id, api);
}

async function shift() {
  const sh = jobs.shift();
  if (!sh) return messageModal({ body: 'You have done your shifts for this year.' });
  const id = await pickModal({ title: 'On the wing', body: sh.text, cancel: 'Do nothing', options: sh.choices.map((x) => ({ value: x.id, label: x.label })) });
  const r = jobs.handleShift(sh, id ?? 'ignore');
  return messageModal({ body: r.text, tone: r.tone });
}
