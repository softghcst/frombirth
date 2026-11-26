// The same cases, seen from other careers. A forensic scientist (the 'forensics' track) receives real
// laboratory requests from investigations NPC detectives are working, and decides how the
// examination is done and reported; the detective, the prosecutor and the defense read the report
// they write. A journalist can report on what is public: cases in open court, never case files.
//
// These are partial integrations, on purpose: the forensic scientist's work is one request at a time
// on the bench, and the journalist's is the public record. Medical examiners appear in a homicide file
// as findings (casework.js: cause and manner of death, kept apart); a player physician cannot yet issue them.
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { LAB, LAB_RESULTS } from '../../data/investigations.js';
import * as k from '../cases.js';
import { rec, W, now, year, me, nextId, result, seeded, nameOfId } from './core.js';
import { agencyOf, kindsIn, lab } from './agencies.js';
import { openCase, investigation, incidentOf } from './casework.js';
import { publicRecord } from './views.js';
import { afterReport } from './forensicLab.js';

const npc = (id) => store.state.npcs[id] ?? null;
const nm = (id) => nameOfId(id);

/**
 * A case worked by a detective who is not the player, taken through the real court process: the kind of case a
 * reporter covers. Its clues are found by that detective's ordinary work; the court decides as for any case.
 */
export function npcCourtCase(p = player()) {
  const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
  const det = Object.values(a.units)[0].memberIds.find((id) => store.state.npcs[id]?.alive);
  const inv = openCase('burglary', { ownerId: a.id, lead: det, truth: 'insider' });
  const inc = incidentOf(inv);
  for (const c of inv.file.clues.filter((x) => ['scene', 'specialist', 'records'].includes(x.via))) {
    c.found = true; c.at = now();
    if (c.pointsTo && c.evKind) { const ev = k.addEvidence(inc, c.evKind, c.pointsTo, { lawful: true, summary: c.text }); inv.evidenceIds.push(ev.id); }
  }
  inv.file.report = { at: now(), complete: true, omitted: [] };
  const suspect = inv.file.poi[0];
  if (k.strength(inv.evidenceIds, suspect) < k.CHARGE_AT) return null;
  const c = k.openCaseFor(inv, suspect);
  inv.file.courtCaseId = c.id;
  for (let i = 0; i < 8 && !['sentenced', 'acquitted', 'dismissed'].includes(c.stage); i++) k.runToEnd(c);
  inv.file.outcome = { kind: c.stage === 'sentenced' ? 'convicted' : c.stage, at: now() };
  return inv;
}

/** The player's bench, as a forensic scientist: requests waiting on them. */
export function bench(p = player()) {
  const w = W();
  w.bench ??= {};
  return Object.values(w.bench).filter((b) => b.analystId === me(p));
}

/** Once a year, a forensic scientist's laboratory sends them a request from a real case an NPC detective is working. */
export function pressYear(p = player()) {
  if (p.career?.careerId !== 'journalist' || !p.alive) return;
  if (publicCases(p).length >= 3 && year() % 2) return;
  npcCourtCase(p);
}
export function benchYear(p = player()) {
  if (p.career?.careerId !== 'forensics' || !p.alive) return;
  if (bench(p).some((b) => b.status === 'open')) return;
  const a = agencyOf(kindsIn(p.countryId)[0], p.countryId, p.city);
  const det = a.units[Object.keys(a.units)[0]].memberIds.find((id) => npc(id)?.alive);
  const inv = openCase('burglary', { ownerId: a.id, lead: det });
  const it = inv.file.items.find((x) => x.disciplines.length) ;
  if (!it) return;
  const discipline = it.disciplines[0];
  const id = nextId('bench');
  W().bench[id] = { id, invId: inv.id, itemId: it.id, discipline, analystId: me(p), status: 'open', steps: [], received: now(), detectiveId: det };
  it.custody.push({ at: now(), by: det, act: 'collected and logged' }, { at: now(), by: me(p), act: 'received at the laboratory' });
}

/** What the scientist does with a request: each once. */
export const BENCH_STEPS = {
  condition: { label: 'Review the evidence condition and its custody record' },
  method: { label: 'Choose a suitable method for the material' },
  quality: { label: 'Run the quality controls' },
  limits: { label: 'Assess what the result can and cannot show' },
};
export function benchStep(id, step) {
  const b = W().bench?.[id];
  if (!b || b.status !== 'open' || b.analystId !== me()) return result(false, 'That request is not on your bench.', 'neutral');
  if (b.steps.includes(step)) return result(false, 'Done already.', 'neutral');
  b.steps.push(step);
  const inv = investigation(b.invId);
  const it = inv.file.items.find((x) => x.id === b.itemId);
  const text = { condition: it.integrity === 'gap' ? 'The custody log is missing one transfer signature. You note it in your report: it goes to the defense too.' : 'The item is sealed and its custody record is complete.',
    method: `${LAB[b.discipline].name} suits this material.`, quality: 'The controls ran as expected.', limits: 'You write down what the method cannot tell anyone: it compares material, it does not say how it got there.' }[step];
  return result(true, text, 'neutral');
}
/**
 * Reports a finding. What the material shows was fixed when it was collected; the scientist decides
 * how carefully it is examined and how honestly it is reported. Overstating a result is never rewarded.
 * @param {'careful'|'overstate'} how
 */
export function benchReport(id, how = 'careful') {
  const b = W().bench?.[id];
  if (!b || b.status !== 'open' || b.analystId !== me()) return result(false, 'That request is not on your bench.', 'neutral');
  if (!b.steps.includes('method')) return result(false, 'Choose a method first.', 'neutral');
  const inv = investigation(b.invId);
  const f = inv.file;
  const it = f.items.find((x) => x.id === b.itemId);
  const ev = k.J().evidence[it.evidenceId];
  const p = player();
  const careful = b.steps.includes('quality') && b.steps.includes('limits');
  const r = seeded(`${b.id}/result`);
  const conclusive = r.chance(LAB[b.discipline].conclusive * (careful ? 1.1 : 0.85));
  const outcome = conclusive ? (ev.pointsTo ? 'consistent' : 'inconsistent') : 'inconclusive';
  const shown = how === 'overstate' && outcome === 'inconclusive' ? 'consistent' : outcome;
  let text = `${LAB[b.discipline].name}: ${LAB_RESULTS[shown].toLowerCase()}.`;
  if (shown === 'consistent' && ev.pointsTo) text = `${LAB[b.discipline].name}: the ${it.label.toLowerCase()} is consistent with ${nm(ev.pointsTo)}.${careful ? ' The report sets out the method\'s limits.' : ''}`;
  if (how === 'overstate' && outcome === 'inconclusive') { ev.overstated = true; ev.reliability = Math.min(ev.reliability, 0.3); p.career.performance = clamp(p.career.performance - 10); }
  else p.career.performance = clamp(p.career.performance + (careful ? 5 : 1));
  // The report joins the same case file the detective reads (casework.js), as any laboratory report does.
  f.labs.push({ id: nextId('labreq'), itemId: it.id, discipline: b.discipline, requested: b.received, due: now(), analystId: me(), outcome: outcome === 'consistent' ? 'links' : outcome === 'inconsistent' ? 'excludes' : 'inconclusive',
    status: 'reported', result: shown, text, reported: now(), byPlayer: true, overstated: how === 'overstate' && outcome === 'inconclusive' });
  if (shown === 'consistent' && ev.pointsTo && !inv.evidenceIds.includes(ev.id)) inv.evidenceIds.push(ev.id);
  it.custody.push({ at: now(), by: me(), act: `examined: ${LAB_RESULTS[shown].toLowerCase()}` });
  f.log.push({ at: now(), text: `Laboratory report from ${p.firstName} ${p.lastName}: ${text}` });
  b.status = 'reported';
  afterReport(b, how);
  return result(true, how === 'overstate' && outcome === 'inconclusive' ? 'You reported a result the work did not support. If it is tested in court, it will not hold, and neither will your credibility.' : `Reported to ${nm(b.detectiveId)}: ${text}`, how === 'overstate' && outcome === 'inconclusive' ? 'bad' : 'good');
}

/** What a journalist can find: the public record of cases in court where they live. Never a case file. */
export function publicCases(p = player()) {
  return Object.values(k.J().investigations).filter((inv) => inv.file && incidentOf(inv).countryId === p.countryId).map(publicRecord).filter(Boolean);
}

// ---------- Journalism: working a story ----------
//
// A journalist works from what is public (the court's record of a case) and from people who choose to talk.
// They never see case files, sealed records or privileged material. A story can be well sourced or not; a
// claim that was not verified may be wrong, and needs a correction when it is. A careful story can draw
// public attention to a case; it decides nothing, and it does not make a review or an arrest happen.

const stories = () => { const w = W(); w.stories ??= {}; return w.stories; };
export const myStories = (p = player()) => Object.values(stories()).filter((s) => s.byId === me(p));
/** Starts a story on a case in the public record. */
export function startStory(caseId) {
  const p = player();
  if (p.career?.careerId !== 'journalist') return result(false, 'That is a journalist\'s work.', 'neutral');
  const inv = Object.values(k.J().investigations).find((x) => x.file?.courtCaseId === caseId);
  if (!inv || !publicRecord(inv)) return result(false, 'There is no public record of that case.', 'neutral');
  if (myStories(p).some((s) => s.caseId === caseId && !s.published)) return result(false, 'You are already working on it.', 'neutral');
  const id = nextId('story');
  stories()[id] = { id, caseId, invId: inv.id, byId: me(p), steps: [], sources: [], published: null, accuracy: 0, claims: [], correction: null };
  return result(true, `You opened a file on ${publicRecord(inv).title}. What you can use: the public record, and people willing to talk.`, 'neutral');
}
export const STORY_STEPS = {
  records: { label: 'Read the public court record', sub: 'Charges, hearings and the outcome.' },
  sources: { label: 'Talk to people willing to talk', sub: 'Witnesses, neighbors, family: only those who agree.' },
  comment: { label: 'Ask the agency and the defense for comment', sub: 'They may decline; say so if they do.' },
  verify: { label: 'Verify every claim against a second source', sub: 'Slower, and the story is right.' },
  standards: { label: 'Review the story against editorial standards', sub: 'What is fact, what is someone\'s account, who should not be named.' },
  sealed: { label: 'Get hold of the police case file', restricted: 'Case files, sealed records and what a client told their lawyer are not available to a reporter. Asking an officer to leak them puts both of you in the wrong.' },
};
export function storyStep(id, step) {
  const s = stories()[id];
  const d = STORY_STEPS[step];
  if (!s || s.byId !== me() || s.published) return result(false, 'That story is not open.', 'neutral');
  if (!d) return result(false, 'Nothing to do.', 'neutral');
  if (d.restricted) return result(false, d.restricted, 'neutral');
  if (s.steps.includes(step)) return result(false, 'Done already.', 'neutral');
  s.steps.push(step);
  const inv = investigation(s.invId);
  const c = k.J().cases[s.caseId];
  const pub = publicRecord(inv);
  if (step === 'records') { s.claims.push({ text: `${pub.defendant} was charged with ${(pub.charge ?? 'an offense').toLowerCase()}; the outcome: ${pub.outcome}.`, sourced: true }); return result(true, s.claims.at(-1).text, 'neutral'); }
  if (step === 'sources') {
    const willing = Object.values(inv.file.witnesses).filter((w) => w.willing >= 0.5 && store.state.npcs[w.id]?.alive);
    if (!willing.length) return result(true, 'Nobody connected to the case wants to talk to a reporter. That is their right.', 'neutral');
    const w = willing[0];
    const own = inv.file.clues.find((x) => x.via === `q:${w.id}:observed`);
    s.sources.push(w.id);
    s.claims.push({ text: own?.text ?? `${nm(w.id)} says they remember the night well.`, sourced: false, accurate: own?.accurate ?? true });
    return result(true, `${nm(w.id)} agreed to talk: ${s.claims.at(-1).text} (Their own account. It may be mistaken.)`, 'neutral');
  }
  if (step === 'standards') {
    // Accounts are attributed as accounts; people the law protects (the person harmed in a family case) are not named.
    for (const cl of s.claims) if (!cl.sourced) cl.attributed = true;
    s.protected = inv.file.sensitive ? true : false;
    return result(true, `Every account is attributed to the person who gave it${s.protected ? '; the person harmed is not named' : ''}. What is fact and what is memory is clear on the page.`, 'neutral');
  }
  if (step === 'comment') { s.claims.push({ text: 'The agency said it does not comment on individual cases; the defense said the record speaks for itself.', sourced: true }); return result(true, s.claims.at(-1).text, 'neutral'); }
  for (const cl of s.claims) if (!cl.sourced && cl.accurate !== false) cl.sourced = true; // verified against a second source
  const wrong = s.claims.filter((cl) => cl.accurate === false);
  return result(true, wrong.length ? 'Checking against a second source, one account does not hold up: a witness was sure, and wrong. It stays out, or is reported as one person\'s memory.' : 'Every claim checks out against a second source.', 'neutral');
}
/**
 * Publishes. What was not verified is published as a claim; what was wrong will need a correction. A careful story
 * about a conviction may bring public attention to it (which a review can then take up), never more.
 */
export function publishStory(id) {
  const s = stories()[id];
  if (!s || s.byId !== me() || s.published) return result(false, 'That story is not open.', 'neutral');
  if (!s.steps.includes('records')) return result(false, 'Start with the public record.', 'neutral');
  const verified = s.steps.includes('verify');
  const keep = verified ? s.claims.filter((cl) => cl.accurate !== false) : s.claims;
  s.published = now();
  // A wrong account published as someone's account (attributed) is not the paper's error; published as fact, it is.
  s.accuracy = keep.every((cl) => cl.accurate !== false || cl.attributed) ? (verified ? 'verified' : 'accurate, unverified') : 'contains an error';
  const p = player();
  p.career.performance = clamp((p.career.performance ?? 50) + (s.accuracy === 'verified' ? 5 : s.accuracy === 'contains an error' ? -6 : 1));
  const inv = investigation(s.invId);
  const c = k.J().cases[s.caseId];
  if (verified && c?.stage === 'sentenced') inv.file.publicAttention = year();
  // A careful story about an open case can bring someone forward: a lead for the investigator, never a fact or an arrest.
  if (verified && !['sentenced', 'acquitted', 'dismissed', 'quashed'].includes(c?.stage) && seeded(`${s.id}/lead`).chance(0.4)) {
    inv.file.leads.push({ id: `story_${s.id}`, text: 'After the story ran, a reader called the station: they saw something that night and never told anyone. It needs checking.', why: 'A published story', status: 'open', at: now() });
    s.lead = true;
  }
  if (verified) { s.verifiedCount = true; const n = myStories(p).filter((x) => x.accuracy === 'verified').length; if (n >= 3 && (p.career.level ?? 0) >= 3 && !/Investigative/.test(p.career.title)) p.career.title = 'Investigative editor'; }
  return result(true, s.accuracy === 'contains an error' ? 'Published. One claim in it was wrong: a witness\'s memory reported as fact. A correction is owed.' : `Published (${s.accuracy}).${inv.file.publicAttention === year() ? ' Readers are asking questions about the conviction; whether anyone reviews it is for the authorities.' : ''}`, s.accuracy === 'contains an error' ? 'bad' : 'good');
}
/** Runs a correction for a story that got something wrong. */
export function correctStory(id) {
  const s = stories()[id];
  if (!s?.published || s.accuracy !== 'contains an error' || s.correction) return result(false, 'There is nothing to correct.', 'neutral');
  s.correction = now();
  const p = player();
  p.career.performance = clamp((p.career.performance ?? 50) + 3);
  return result(true, 'The correction ran, as prominently as the error. Readers trust a paper that corrects itself.');
}

// ---------- The editor's desk ----------
//
// An editor (the journalism track's editor rank) reads reporters' drafts before they run. A draft may report a
// witness's memory as fact; sending it back for verification is the job. Running it means a correction later.
const drafts = () => { const w = W(); w.drafts ??= {}; return w.drafts; };
export const myDrafts = (p = player()) => Object.values(drafts()).filter((d) => d.editorId === me(p) && d.status === 'waiting');
export function editorYear(p = player()) {
  if (p.career?.careerId !== 'journalist' || (p.career.level ?? 0) < 3 || myDrafts(p).length) return [];
  const pub = publicCases(p)[0];
  if (!pub) return [];
  const reporter = Object.values(store.state.npcs).find((n) => n.alive && n.occupation === 'Court reporter') ?? null;
  const id = nextId('draft');
  const r = seeded(`${id}/draft`);
  drafts()[id] = { id, editorId: me(p), reporterId: reporter?.id ?? null, title: pub.title, unverified: r.chance(0.6), wrong: r.chance(0.4), status: 'waiting', at: now() };
  return [`A reporter's draft on ${pub.title} is waiting for you.`];
}
export function editDraft(id, how) {
  const d = drafts()[id];
  if (!d || d.status !== 'waiting' || d.editorId !== me()) return result(false, 'That draft is not on your desk.', 'neutral');
  d.status = how;
  const p = player();
  if (how === 'back') { p.career.performance = clamp((p.career.performance ?? 50) + 3); return result(true, d.unverified ? 'You send it back: one account is reported as fact, and needs a second source. It runs a week later, right.' : 'You send it back for one more check. It was right already; it runs a little later.'); }
  if (d.unverified && d.wrong) { p.career.performance = clamp((p.career.performance ?? 50) - 6); d.correction = now(); return result(true, 'It runs. One account in it was wrong, and stated as fact. The paper prints a correction under your name as editor.', 'bad'); }
  return result(true, 'It runs as written.', 'neutral');
}
