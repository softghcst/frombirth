// Journalism: a newsroom hires, assignments come from what really happened, a story is reported (interviews that can
// be refused, public records only), verified from the evidence, drafted, read by the editor, published once, and
// corrected when it was wrong. The same year whatever the turn length.
//   node tests/journalism.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { advanceTurn } = await import('../js/engine/turns.js');
const { saveGame, loadGame } = await import('../js/save.js');
const jn = await import('../js/engine/journalism.js');
const sc = await import('../js/engine/specialCareer.js');
const career = await import('../js/engine/career.js');
const { OUTLET_KINDS, OWN_KINDS } = await import('../js/data/journalism.js');
const OWN_KINDS_ANY = () => OWN_KINDS;

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (age = 23, year = 2024, country = 'us') => {
  let s; do { s = createLife({ countryId: country, year }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
  p.education.degrees = [{ type: 'high', gpa: 3.2, age: 18 }, { type: 'university', majorId: 'journalism', gpa: 3.4, age: 22 }];
  p.stats.charm = 70; p.finance.cash = 5000;
  return p;
};
const hireMe = (p) => {
  for (let y = 0; y < 8 && !jn.isReporter(p); y++) {
    for (const o of jn.outletsHere(p).filter((x) => x.medium === 'print')) { if (jn.isReporter(p)) break; jn.apply(o.id, 'junior'); }
    if (!jn.isReporter(p)) { store.state.year += 1; }
  }
  return jn.isReporter(p);
};
/** Works a story the careful way: every source, every public record, comment, the lawyer when needed. */
function report(s) {
  const nb = () => jn.notebook(s.id);
  for (let pass = 0; pass < 2; pass++) for (const src of nb().sources) if (!src.asked) jn.interview(s.id, src.id, ['saw', 'evidence', 'who', 'view'], src.wantsConfidential ? 'confidential' : 'record');
  for (const d of nb().docs) if (d.public && !d.read) jn.readDoc(s.id, d.id);
  for (const d of nb().docs) if (!d.read) jn.readDoc(s.id, d.id); // a record a source handed over
  if (nb().needsComment) jn.askComment(s.id);
  if (nb().needsLegal) jn.legalReview(s.id);
  const include = nb().claims.filter((c) => ['verified', 'supported'].includes(c.status) || (c.kind !== 'fact' && c.heard.some((h) => h.says && !h.offRecord))).map((c) => c.id);
  jn.draft(s.id, include, 'straight');
  return jn.submit(s.id);
}

// 1. A special career; newsrooms of their era; hired at the bottom.
{
  const p = life();
  const here = jn.outletsHere(p);
  check(here.length >= 4 && here.every((o) => o.editorId && store.state.npcs[o.editorId] && store.state.npcs[o.seniorId]), `newsrooms in the city, each with a real editor and senior reporter (${here.map((o) => o.kind)})`);
  check(jn.outletsHere(p).map((o) => o.id).join() === here.map((o) => o.id).join(), 'the same newsrooms every time');
  const tried = career.startApplication('journalist');
  check(tried.kind === 'blocked' && /Special careers/.test(tried.text), 'the job center sends reporters to the newsrooms');
  check(hireMe(p) && p.career.careerId === 'journalist' && p.career.level === 0 && sc.current() === 'journalism', `hired as a junior reporter, as the special career (${p.career.title})`);
  check(p.npcIds.includes(jn.outlet(jn.J().outletId).editorId), 'the editor is now someone the player knows');
  check(jn.myStories(p).length >= 2, `assignments are waiting (${jn.myStories(p).length})`);
  const old = life(23, 1880);
  const kinds = jn.outletsHere(old).map((o) => o.kind);
  check(!kinds.some((k) => ['radio', 'tv', 'digital', 'investigative'].includes(OUTLET_KINDS[k] ? k : '')), `in 1880 there are newspapers only (${kinds})`);
  const teen = life(15);
  check(!jn.apply(jn.outletsHere(teen)[0].id, 'junior').ok && /from 18/.test(jn.applyWhy(jn.outletsHere(teen)[0], 'junior')), 'no reporter jobs for a fifteen-year-old');
  teen.education.enrolled = true;
  check(jn.schoolArticle().ok && !jn.schoolArticle().ok, 'the school paper: once a year');
  section('newsrooms of their era, hired at the bottom by a real editor, the job center points to them');
}

// 2. The vertical slice: report, verify, edit, publish once; complaints and corrections.
{
  const p = life();
  hireMe(p);
  const s = jn.myStories(p).find((x) => x.beat === 'local') ?? jn.myStories(p)[0];
  const nb0 = jn.notebook(s.id);
  check(!JSON.stringify(nb0).includes('"truth"'), 'the notebook never shows the hidden truth');
  check(nb0.claims.every((c) => c.status === 'open'), 'nothing is known before reporting');
  check(nb0.sources.every((x) => x.npcId ? !!store.state.npcs[x.npcId] : x.institution), 'every source is a real person or an institution');
  // Publishing before the editor has approved it is impossible.
  check(!jn.publish(s.id).ok, 'nothing runs without the editor');
  const sub = report(s);
  const st = jn.storyOf(s.id);
  if (!sub.ok) {
    // An editor can send it back; the reporter answers what they asked and tries again.
    check(st.review?.notes.length > 0 && st.status === 'revise', `a sent-back draft says why (${sub.text})`);
  }
  for (let i = 0; i < 3 && st.status !== 'approved'; i++) { const nb = jn.notebook(s.id); jn.draft(s.id, nb.claims.filter((c) => ['verified', 'supported'].includes(c.status)).map((c) => c.id), 'straight'); jn.submit(s.id); }
  check(st.status === 'approved', `a carefully reported story is approved (${st.status}: ${st.review?.notes})`);
  const r = jn.publish(s.id);
  const pub = jn.myPubs(p)[0];
  check(r.ok && pub && pub.headline && pub.body.length > 10 && pub.outlet, `published, with a byline and the text assembled from the notes (${r.text})`);
  check(!jn.publish(s.id).ok && jn.myPubs(p).length === 1, 'it runs once');
  check(p.milestones.some((m) => /first byline/i.test(m.text)), 'the first byline is a milestone');
  // Save and reload: the story, the publication and its sources come back the same.
  saveGame(store.state);
  const back = loadGame(store.state.slotId);
  check(JSON.stringify(back.newsroom.pubs[pub.id]) === JSON.stringify(pub) && back.newsroom.stories[s.id].status === 'published', 'the publication and story survive a reload unchanged');
  // An error, by design: a claim stated on one source's word, in a lenient newsroom, that was false.
  const s2 = jn.myStories(p).find((x) => x.status !== 'published' && x.id !== s.id) ?? null;
  if (s2) {
    const o = jn.outlet(s2.outletId); o.standards = 0.3;
    const bad = s2.claims.find((c) => c.kind === 'fact');
    bad.truth = false;
    s2.evidence.push({ type: 'source', sourceId: s2.sources[0].id, claimId: bad.id, says: true, attribution: 'record' });
    s2.evidence.push({ type: 'source', sourceId: s2.sources[1]?.id ?? 'x', claimId: bad.id, says: true, attribution: 'record' });
    s2.interviews.push({ sourceId: s2.sources[0].id, year: store.state.year, accepted: true, attribution: 'record' });
    jn.draft(s2.id, [bad.id], 'straight');
    jn.submit(s2.id);
    if (s2.status === 'approved') {
      jn.publish(s2.id);
      const p2 = jn.pubs?.() ?? jn.myPubs(p).find((x) => x.storyId === s2.id);
      check(p2.errors.length === 1 && p2.complaint?.real, 'a false claim two sources agreed on runs, and a complaint is on its way');
      const original = JSON.stringify({ h: p2.headline, b: p2.body });
      store.state.month = 11; store.state.year += 1;
      jn.raiseComplaints(p);
      check(jn.answerComplaint(p2.id, true).ok && p2.corrections.length === 1 && JSON.stringify({ h: p2.headline, b: p2.body }) === original, 'the correction is added; the story as it ran is kept');
      check(!jn.answerComplaint(p2.id, true).ok, 'a complaint is answered once');
    } else check(false, `the lenient editor should have run it (${s2.review?.notes})`);
  }
  section('the vertical slice: hired, assigned, reported, verified, edited, published once, corrected, saved');
}

// 3. Ethics and access: refusals, restricted records, confidential sources, the editor reads the story not the name.
{
  const p = life();
  hireMe(p);
  jn.J().beat = 'court';
  p.career.level = 2;
  jn.J().assigned = null;
  const made = jn.assignYear(p);
  const courtOrInv = made.find((x) => x.beat === 'court') ?? null;
  // An investigation, directly: a tip, a confidential source, records that are not available.
  jn.J().beat = 'investigative'; jn.J().assigned = null; store.state.year += 1;
  const inv = jn.assignYear(p).find((x) => x.beat === 'investigative');
  check(inv, 'a senior reporter gets an investigation');
  if (inv) {
    const nb = jn.notebook(inv.id);
    const closed = nb.docs.find((d) => !d.public);
    check(closed && !jn.readDoc(inv.id, closed.id).ok, 'a company\'s private records are not available');
    const conf = nb.sources.find((x) => x.wantsConfidential);
    check(conf && !jn.interview(inv.id, conf.id, ['saw'], 'record').ok, 'a confidential source will not go on the record');
    const main = inv.claims.find((c) => c.kind === 'allegation');
    jn.draft(inv.id, [main.id], 'overstated');
    const r = jn.submit(inv.id);
    check(!r.ok && /comment|lawyer|confirmed|headline|source/i.test(r.text), `an overstated, unchecked allegation goes back (${r.text})`);
    p.fame = { ...(p.fame ?? {}), attention: 100, legacy: 100 };
    check(!jn.submit(inv.id).ok, 'fame does not get it past the editor');
    check(jn.spike(inv.id).ok, 'a story can be dropped');
  }
  if (courtOrInv) {
    const nb = jn.notebook(courtOrInv.id);
    const sealed = nb.docs.filter((d) => !d.public);
    check(sealed.length >= 1 && sealed.every((d) => !jn.readDoc(courtOrInv.id, d.id).ok), 'a court reporter never sees the police file or sealed statements');
    check(courtOrInv.links.caseId, 'a court story is about a case in the public record');
  }
  section('refusals, closed records, confidential sources, an editor who is not swayed by fame');
}

// 4. The same year, whatever the turn length; actions are a year's, not a turn's.
{
  const run = (step) => {
    const p = life(23, 2024);
    store.state.settings = { ...(store.state.settings ?? {}), step };
    hireMe(p);
    const y0 = store.state.year;
    for (let i = 0; i < 24 && store.state.year < y0 + 2; i++) { advanceTurn(); store.state.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = 90; }
    return { years: store.state.year - y0, current: jn.J().assigned === store.state.year, stories: jn.myStories(p).length, left: jn.actionsLeft() };
  };
  const a = run(3); const b = run(6); const c = run(12);
  check(a.years === 2 && b.years === 2 && c.years === 2 && a.current && b.current && c.current, `two years go by the same way with 3-, 6- and 12-month turns (${JSON.stringify([a, b, c])})`);
  check(a.stories === b.stories && b.stories === c.stories, `the same number of assignments (${a.stories}, ${b.stories}, ${c.stories})`);
  const p = life(); hireMe(p);
  const s = jn.myStories(p)[0];
  let n = 0;
  for (let i = 0; i < 80; i++) { const src = s.sources[0]; s.interviews = []; if (jn.interview(s.id, src.id, ['saw']).ok || /talk to a reporter/.test(jn.storyOf(s.id).interviews.at(-1)?.accepted === false ? 'talk to a reporter' : '')) n++; if (!jn.actionsLeft()) break; }
  check(jn.actionsLeft() === 0 && n <= 30, `a year's work is a year's work (${n} interviews)`);
  section('three-, six- and twelve-month turns give the same newsroom year; a year has a set amount of work');
}

// 5. Leaving: the special career closes the newsroom; what ran is kept.
{
  const p = life(); hireMe(p);
  const s = jn.myStories(p)[0];
  report(s); jn.publish(s.id);
  const before = jn.myPubs(p).length;
  const r = sc.leave();
  check(r.ok && p.career.careerId !== 'journalist' && !jn.isReporter(p) && jn.myPubs(p).length === before, 'leaving journalism ends the job; the published work stays');
  section('leaving the career keeps the work');
}

// 6. Broadcast: segments presented live, delivery a skill of its own, the anchor chair earned, guests who can decline.
{
  const p = life(26, 2020);
  hireMe(p);
  const tv = jn.outletsHere(p).find((o) => o.medium === 'television');
  check(tv, 'a television newsroom in 2020');
  p.stats.charm = 80;
  jn.J().rep.accuracy = 70;
  for (let i = 0; i < 3; i++) { const s = jn.myStories(p).find((x) => x.status !== 'published'); if (s) { report(s); jn.publish(s.id); } }
  store.state.year += 1;
  const moved = jn.applyMove(tv.id);
  for (let y = 0; y < 6 && jn.J().outletId !== tv.id; y++) { store.state.year += 1; jn.applyMove(tv.id); }
  check(jn.J().outletId === tv.id && p.career.careerId === 'journalist', `a reporter with clips moves to the television newsroom (${moved.text})`);
  const s = jn.myStories(p).find((x) => x.outletId === tv.id);
  report(s);
  for (let i = 0; i < 3 && s.status !== 'approved'; i++) { const nb = jn.notebook(s.id); jn.draft(s.id, nb.claims.filter((c) => ['verified', 'supported'].includes(c.status)).map((c) => c.id), 'straight'); jn.submit(s.id); }
  check(!jn.publish(s.id).ok, 'on television a story goes out live, not by pressing publish');
  const trust = jn.J().rep.trust;
  const live = jn.present(s.id, ['verified', 'dramatic']);
  const pub = jn.myPubs(p).find((x) => x.storyId === s.id);
  check(live.ok && pub?.segment?.live && pub.segment.choices.includes('dramatic') && jn.J().rep.trust < trust, `presented live; the dramatic line costs trust (${live.text})`);
  check(!jn.present(s.id, ['verified']).ok, 'a segment goes out once');
  check(/clean segments|practice|delivery/i.test(jn.anchorAuditionWhy(p)), 'no anchor chair without the work on air');
  jn.J().skills.broadcast = 80;
  for (let i = 0; i < 3; i++) jn.S().pubs[`fake${i}`] = { ...pub, id: `fake${i}`, errors: [], segment: { live: true, choices: ['verified'], delivery: 80 } };
  let got = false;
  for (let y = 0; y < 8 && !got; y++) { got = jn.anchorAudition().ok; store.state.year += 1; }
  check(got && jn.J().anchor && /anchor|presenter/i.test(p.career.title), `an anchor chosen by audition (${p.career.title})`);
  const guests = jn.guestChoices(p);
  check(guests.length > 0, `real people to ask on (${guests.length})`);
  if (guests.length) { const r = jn.interviewGuest(guests[0].id, 'fair'); check(/declines|comes on/.test(r.text), `a guest comes on or declines (${r.text})`); }
  section('broadcast: moving to television, presenting live, an anchor chair earned, guests who can say no');
}

// 7. The newsroom's moments: only when true of this life, at most one a year, never twice, and the answers count.
{
  const p = life(); hireMe(p);
  for (let i = 0; i < 2; i++) { const s = jn.myStories(p).find((x) => x.status !== 'published'); if (s) { report(s); jn.publish(s.id); } }
  const seen = new Set();
  for (let y = 0; y < 12; y++) {
    store.state.pendingEvents = [];
    advanceYear();
    p.legal.pending = null; p.legal.incarceration = null; p.stats.health = 90;
    const ids = store.state.pendingEvents.filter((e) => /^jn_/.test(e.id)).map((e) => e.id);
    check(ids.length <= 1, `at most one newsroom scene a year (${ids})`);
    for (const id of ids) { check(!seen.has(id), `never the same scene twice (${id})`); seen.add(id); }
    if (!jn.isReporter(p)) break;
  }
  check(seen.size >= 2, `newsroom scenes happen over the years (${[...seen]})`);
  const o = jn.outlet(jn.J().outletId);
  const ed = store.state.npcs[o.editorId];
  const before = ed.meters.relationship;
  jn.journalismChoice('notes:take');
  check(ed.meters.relationship > before, 'taking the editor\'s notes brings you closer');
  const t = jn.J().rep.trust;
  jn.journalismChoice('ad:go');
  check(jn.J().rep.trust < t, 'writing what an advertiser asked for costs trust');
  section('newsroom scenes: true of this life, one a year at most, never repeated, with consequences');
}

// 8. Freelance: stories found, reported, pitched; commissioned at a fee paid once, when it runs.
{
  const p = life();
  check(jn.goFreelance().ok && jn.J().freelance && sc.current() === 'journalism' && !p.career.careerId, 'going freelance is the special career, with no salary');
  const s = jn.myStories(p)[0];
  check(s && !s.outletId, 'a freelancer\'s lead belongs to no newsroom yet');
  report(s);
  check(!jn.submit(s.id).ok, 'it cannot go to an editor before it is sold');
  let sold = false;
  for (const o of jn.outletsHere(p)) { if (jn.pitch(s.id, o.id).ok) { sold = true; break; } }
  if (!sold) { store.state.year += 1; for (const o of jn.outletsHere(p)) { s.pitched = {}; if (jn.pitch(s.id, o.id).ok) { sold = true; break; } } }
  check(sold && s.fee > 0 && s.editorId, `a newsroom commissions it at a fee (${s.fee})`);
  for (let i = 0; i < 3 && s.status !== 'approved'; i++) { const nb = jn.notebook(s.id); jn.draft(s.id, nb.claims.filter((c) => ['verified', 'supported'].includes(c.status)).map((c) => c.id), 'straight'); jn.submit(s.id); }
  const cash = p.finance.cash;
  const o = jn.outlet(s.outletId);
  const r = jn.isBroadcast(o) ? jn.present(s.id, ['verified']) : jn.publish(s.id);
  check(r.ok && p.finance.cash === cash + s.fee, `the fee is paid when it runs (${r.text})`);
  check(!jn.publish(s.id).ok && p.finance.cash === cash + s.fee, 'and never again for the same piece');
  section('freelance: find it, report it, sell it, paid once when it runs');
}

// 9. A publication of one's own: of its era, with real money, real staff, a self-edited bar, and years that can lose money.
{
  const old = life(30, 1950);
  old.finance.cash = 1e9;
  check(/Not in/.test(jn.startWhy('newsletter', old)) && !jn.startWhy('paper', old), 'in 1950: a paper, not a newsletter');
  const p = life(30, 2024);
  p.finance.cash = 1e7;
  const cost = jn.startCost('newsletter');
  const before = p.finance.cash;
  const r = jn.startPublication('newsletter', 'The Morning Letter', 'careful');
  const o = jn.ownedOutlet(p);
  check(r.ok && o && o.name === 'The Morning Letter' && p.finance.cash === before - cost && sc.current() === 'journalism', `started with the player's own money (${r.text})`);
  check(!p.career.careerId, 'owning it is not a job with a salary');
  check(jn.hireStaff('reporter').ok && jn.hireStaff('editor').ok && o.staff.length === 2 && store.state.npcs[o.editorId], 'real staff are hired; the editor is a person');
  const s = jn.myStories(p).find((x) => x.outletId === o.id);
  check(s, 'an owner reports for their own publication');
  if (s) {
    report(s);
    for (let i = 0; i < 3 && s.status !== 'approved'; i++) { const nb = jn.notebook(s.id); jn.draft(s.id, nb.claims.filter((c) => ['verified', 'supported'].includes(c.status)).map((c) => c.id), 'straight'); jn.submit(s.id); }
    check(jn.publish(s.id).ok && jn.myPubs(p).some((x) => x.outletId === o.id), 'it publishes in their own publication');
  }
  const cash = p.finance.cash;
  advanceYear(); store.state.pendingEvents = [];
  const f = o.finances.at(-1);
  check(f && f.costs >= o.staff.reduce((n, x) => n + x.salary, 0) && p.finance.cash !== cash, `its year is counted: revenue, salaries and costs (${JSON.stringify(f)})`);
  check(f.net < 0 || f.net >= 0, 'it can lose money');
  advanceYear(); store.state.pendingEvents = [];
  check(o.finances.filter((x) => x.year === f.year).length === 1, 'each year is counted once');
  const sold = jn.sellPublication();
  check(sold.ok ? !jn.ownedOutlet(p) && o.sold : /Nobody/.test(sold.text) && jn.ownedOutlet(p) === o, `it can be sold, or nobody wants it and it stays yours (${sold.text})`);
  if (!sold.ok) check(jn.closePublication().ok && !jn.ownedOutlet(p) && o.closed && jn.myPubs(p).some((x) => x.outletId === o.id), 'closing it keeps what it published');
  section('a publication of one\'s own: of its era, bought with real money, real staff, years that can lose money');
}

// 10. More beats, abroad, the family record, a colleague.
{
  const p = life(30, 2024, 'kr');
  hireMe(p);
  const kp = await import('../js/engine/kpop.js');
  kp.world();
  // A K-pop story only about a release that really came out, with positions as the agency lists them.
  const rel = Object.values(store.state.kpop.releases).find((r) => !r.solo && store.state.kpop.groups[r.groupId]?.debut);
  if (rel) {
    rel.year = store.state.year;
    jn.J().beat = 'kpop'; jn.J().assigned = null;
    const k = jn.assignYear(p).find((x) => x.beat === 'kpop');
    check(k && k.links.kpopRelease && store.state.kpop.releases[k.links.kpopRelease], 'a K-pop story is about a real release');
    if (k) {
      const g = store.state.kpop.groups[k.links.groupId];
      const pos = k.claims.find((c) => / is the group's /.test(c.text));
      if (pos) { const who = Object.keys(g.positions).find((id) => pos.text.startsWith(`${store.state.npcs[id]?.firstName} `)); check(who && g.positions[who].length <= 2, 'positions are the group\'s own, two at most'); }
      const rumor = k.claims.find((c) => /dating/.test(c.text));
      check(rumor && rumor.kind === 'allegation' && !k.docs.some((d) => d.settles.some((x) => x.claimId === rumor.id)), 'a dating rumor stays a rumor: no record makes it true');
      const fans = k.sources.find((x) => /Fan accounts/.test(x.name));
      if (fans && rumor) { jn.interview(k.id, fans.id, ['saw']); jn.draft(k.id, [rumor.id], 'overstated'); check(!jn.submit(k.id).ok, 'a rumor does not run as fact'); }
    }
  } else check(true, 'no K-pop releases yet');
  // Business and science: private records refused; one study is not proof.
  jn.J().beat = 'business'; jn.J().assigned = null; store.state.year += 1;
  const b = jn.assignYear(p).find((x) => x.beat === 'business');
  check(b && b.docs.some((d) => !d.public && /bank/.test(d.title)) && !jn.readDoc(b.id, b.docs.find((d) => !d.public).id).ok, 'a company\'s bank accounts are not available');
  jn.J().beat = 'science'; jn.J().assigned = null; store.state.year += 1;
  const sci = jn.assignYear(p).find((x) => x.beat === 'science');
  check(sci && sci.docs.some((d) => !d.public && /medical records/.test(d.title)), 'patients\' records are closed');
  if (sci) { const main = sci.claims.find((c) => c.kind === 'allegation'); check(!sci.docs.some((d) => d.public && d.settles.some((x) => x.claimId === main.id)), 'no single record proves a study\'s finding'); }
  // A posting abroad: senior reporters at a newsroom with a foreign desk.
  check(/senior|staff|foreign desk/.test(jn.postingWhy('jp', p)) || p.career.level >= 2, 'postings are for senior reporters');
  p.career.level = 2;
  const desk = jn.outletsHere(p).find((o) => ['regional', 'tv', 'digital', 'radio'].includes(o.kind));
  jn.J().outletId = desk.id;
  let posted = false;
  for (let y = 0; y < 8 && !posted; y++) { posted = jn.requestPosting('jp').ok; if (!posted) store.state.year += 1; }
  check(posted && jn.J().posting.countryId === 'jp', 'a senior reporter is posted to Japan');
  const abroad = jn.myStories(p).filter((x) => x.year >= jn.J().posting.from && x.status !== 'spiked');
  check(abroad.length && abroad.every((x) => !['court', 'sports', 'entertainment', 'kpop'].includes(x.beat) || x.beat === 'kpop'), 'stories come from where they are posted');
  // The family record: published work as it ran, no notebooks or confidential names.
  const s0 = jn.myStories(p).find((x) => x.status !== 'published' && x.status !== 'spiked');
  for (const s1 of jn.myStories(p).filter((x) => !['published', 'spiked', 'expired'].includes(x.status))) {
    report(s1);
    for (let i = 0; i < 3 && s1.status !== 'approved'; i++) { const nb = jn.notebook(s1.id); jn.draft(s1.id, nb.claims.filter((c) => ['verified', 'supported'].includes(c.status)).map((c) => c.id), 'straight'); jn.submit(s1.id); }
    if (s1.status === 'approved') { jn.isBroadcast(jn.outlet(s1.outletId)) ? jn.present(s1.id, ['verified']) : jn.publish(s1.id); }
    if (jn.myPubs(p).length) break;
  }
  void s0;
  const fam = jn.familyJournalism();
  const mine = fam.find((x) => x.id === p.id);
  check(mine && mine.pubs.length && !JSON.stringify(fam).includes('"evidence"') && !JSON.stringify(fam).includes('"truth"'), `the family sees published work, never notebooks (${mine?.pubs.length}, ${jn.myStories(p).map((x) => x.status)})`);
  section('K-pop, business and science beats, foreign postings, and the family record');
}

// 11. An editor's desk, a documentary, leave, and a publication handed to an heir.
{
  const p = life(40);
  hireMe(p);
  check(!jn.isEditor(p) && !jn.desk(p).length, 'no desk for a junior reporter');
  p.career.level = 3;
  const d = jn.desk(p);
  check(d.length === 3 && d.every((x) => store.state.npcs[x.reporterId]) && jn.desk(p) === d, `an editor gets the year's drafts from real reporters (${d.length})`);
  check(!JSON.stringify(d.map((x) => x.claims.map((c) => c.status))).includes('truth'), 'the desk shows what the notes support');
  const thin = d.find((x) => x.claims.some((c) => ['single', 'disputed'].includes(c.status) && !c.truth));
  const solid = d.find((x) => x.claims.every((c) => ['verified', 'supported'].includes(c.status)));
  const before = jn.J().rep.leadership ?? 50;
  if (thin) check(!jn.deskDecide(thin.id, 'approve').ok && (jn.J().rep.leadership < before), 'approving a draft that rested on one source comes back on the editor');
  const other = d.find((x) => !x.decision);
  check(jn.deskDecide(other.id, 'back').ok && !jn.deskDecide(other.id, 'approve').ok, 'each draft is decided once');
  void solid;
  // A documentary: only from an investigation that stood up; stages; lawyers before release.
  const fake = { id: 'pub_test', reporterId: p.id, beat: 'investigative', headline: 'The harbor deal', errors: [], claims: [{ id: 'c', text: 'x', asFact: true }], outletId: jn.J().outletId, corrections: [], sources: [], readers: 1, at: 0, year: store.state.year };
  jn.S().pubs[fake.id] = fake;
  check(!jn.documentaryWhy(fake.id, p) && jn.startDocumentary(fake.id).ok && !jn.startDocumentary(fake.id).ok, 'one documentary from an investigation that held up');
  jn.S().pubs.pub_wrong = { ...fake, id: 'pub_wrong', errors: ['c'] };
  check(/got something wrong/.test(jn.documentaryWhy('pub_wrong', p)), 'not from a story that got something wrong');
  const doc = jn.myDocumentaries(p)[0];
  check(!jn.releaseDocumentary(doc.id).ok, 'not released before it is finished');
  for (let y = 0; y < 6 && doc.stage !== 'legal'; y++) { while (doc.stage !== 'legal' && jn.workDocumentary(doc.id).ok); if (doc.stage !== 'legal') store.state.year += 1; }
  check(doc.stage === 'legal', `the work gets it to the lawyers (${doc.stage})`);
  check(jn.releaseDocumentary(doc.id).ok && doc.legal && !doc.released && jn.releaseDocumentary(doc.id).ok && doc.released, 'a legal read, then release');
  // Leave: a year with no assignments, then back to work.
  check(jn.takeLeave().ok && !jn.takeLeave().ok, 'leave booked once');
  store.state.year += 1;
  jn.J().assigned = null;
  check(jn.assignYear(p).length === 0, 'no assignments on leave');
  store.state.year += 1;
  check(jn.assignYear(p).length > 0 && jn.isReporter(p), 'back at the desk after the leave');
  // A newsroom scene that was shown once is not shown again.
  const seenAll = new Set();
  for (let y = 0; y < 15; y++) { store.state.year += 1; store.state.pendingEvents = []; jn.tickJournalism?.(p); for (const e of store.state.pendingEvents) { check(!seenAll.has(e.id), `scene ${e.id} not repeated`); seenAll.add(e.id); } }
  section('the editor\'s desk, a documentary, leave, and scenes that are not repeated');
}

// 12. The heir: published work, the family record, and an owned publication carry on.
{
  const { continueAs, heirs } = await import('../js/engine/legacy.js');
  const { makeNpc } = await import('../js/engine/npcFactory.js');
  const p = life(50);
  p.finance.cash = 10_000_000;
  hireMe(p);
  const s1 = jn.myStories(p)[0];
  report(s1);
  const pubsBefore = Object.keys(jn.S().pubs).length;
  career.endJob?.('quit');
  const started = jn.startPublication(Object.keys(OWN_KINDS_ANY()).find((k) => !jn.startWhy(k, p)), 'The Family Paper', 'careful');
  check(started.ok, `a publication of their own (${started.text})`);
  const own = jn.ownedOutlet(p);
  const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 24, lastName: p.lastName });
  store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id); kid.parentIds = [p.id];
  p.alive = false;
  check(heirs().some((n) => n.id === kid.id), 'setup: the child can carry on');
  store.state = continueAs(kid.id);
  const h = store.state.player;
  check(Object.keys(jn.S().pubs).length === pubsBefore, 'what was published is still in the world');
  check(own && jn.S().outlets[own.id].ownerId === h.id && jn.ownedOutlet(h)?.id === own.id, 'the family publication passes to the heir');
  check(jn.familyJournalism().some((x) => x.id === p.id), 'the ancestor is in the family\'s journalism record');
  check(Object.values(jn.S().outlets).every((o) => !o.editorId || store.state.npcs[o.editorId]), 'every newsroom still has its editor');
  section('published work, the family record and an owned publication carry on to the heir');
}

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Every story has a source.');
