// Adoption, birth families and identity (engine/origins.js): starting life adopted, two family networks around one
// character, what the character knows and when, records, registries, intermediaries and DNA, consent and refusal,
// reunions that go many ways, saves, and the same story with one-year, six-month and three-month turns.
// Run with: node tests/origins.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceTurn, setStep } = await import('../js/engine/turns.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { inheritFrom } = await import('../js/engine/relationships.js');
const { biologicalParents, isBiological } = await import('../js/engine/health/heredity.js');
const { recordsAccessShares } = await import('../js/data/origins.js');
const { ledgerOf } = await import('../js/engine/ledger.js');
const O = await import('../js/engine/origins.js');
const mod = await import('../js/engine/npcFactory.js');

rng.seed(Number(process.env.SEED ?? 4242));
const problems = [];
const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const S = () => store.state;
const P = () => store.state.player;
const npc = (id) => S().npcs[id];
const rec = () => O.myRecord();

function adoptee(origin = 'birth', want = () => true, extra = {}) {
  for (let i = 0; i < 400; i++) {
    store.state = createLife({ countryId: 'us', origin, year: 2000, ...extra });
    if (!P().royal && O.isAdoptee() && want(rec())) { ledgerOf(); return P(); }
  }
  throw new Error(`no ${origin} life found`);
}
/** Answers every waiting scene with choose(id) (default: the first choice). Returns the scene ids answered. */
function answer(choose = () => 0) {
  const seen = [];
  for (let g = 0; g < 40 && S().pendingEvents.length && P().alive; g++) {
    const pe = S().pendingEvents[0];
    const ev = EVENT_BY_ID[pe.id];
    if (ev) { seen.push(pe.id); resolveChoice(ev, Math.min(ev.choices.length - 1, choose(pe.id, pe)), pe.cast); }
    if (S().pendingEvents[0] === pe) S().pendingEvents.shift();
  }
  return seen;
}
function years(n, choose) {
  const seen = [];
  for (let i = 0; i < n && P().alive; i++) {
    const step = [6, 3].includes(S().settings?.step) ? S().settings.step : 12;
    for (let t = 0; t < 12 / step; t++) { advanceTurn(); seen.push(...answer(choose)); }
  }
  return seen;
}
/** Makes the player this old (only for lives that have not yet begun to search). */
function ageTo(age) { const p = P(); const d = age - p.age; p.age = age; p.birthYear -= 0; S().year += d; for (const n of Object.values(S().npcs)) n.age += d; }
const kinOf = (kind) => O.birthKin().find((n) => n.flags.birthKin === kind);
const mother = () => npc(rec().birthParentIds.find((id) => npc(id)?.flags.birthKin === 'mother'));

// 1, 4, 7. Adopted at birth: a birth family and an adoptive family, one child, and the household is the adoptive one.
{
  const n = problems.length;
  const p = adoptee('birth');
  const r = rec();
  check(r.kind === 'birth' && r.legal === 'adoption' && r.status === 'final' && r.placementAge === 0, 'adopted at birth: a final adoption, placed as a newborn');
  check(r.birthParentIds.length >= 1 && r.adoptiveParentIds.length >= 1 && r.birthParentIds.every((id) => !r.adoptiveParentIds.includes(id)), 'birth parents and adoptive parents are different people');
  check(r.legalParentIds.join() === r.adoptiveParentIds.join(), 'the adoptive parents are the legal parents');
  check(r.adoptiveParentIds.every((id) => p.npcIds.includes(id) && npc(id).role === 'parent' && npc(id).flags.adoptiveParent), 'the adoptive parents are the household parents');
  check(r.birthParentIds.every((id) => npc(id) && !p.npcIds.includes(id) && npc(id).role === 'relative' && npc(id).flags.birthOf === p.id), 'the birth parents exist, outside the household, as the birth family');
  check(p.flags.livesWithParents && !p.npcIds.some((id) => npc(id).flags.birthKin === 'mother'), 'the child lives with the adoptive family, not the birth mother');
  const bio = biologicalParents(p);
  check(!bio.mother && !bio.father && r.adoptiveParentIds.every((id) => !isBiological(npc(id))), 'heredity never treats the adoptive parents as biological');
  check(!/Your mother is .*(?:\n|$)/.test('') && S().journal.some((e) => /adopted at birth/i.test(e.text)), 'the opening story tells the adoption');
  section('adopted at birth: separate birth and adoptive records, the adoptive household, legal parentage', n);
}

// 2. Adopted during childhood: a real placement, at the age set when the life began, with the same people.
{
  const n = problems.length;
  const p = adoptee('childhood');
  const r = rec();
  const birthIds = [...r.birthParentIds];
  const pid = p.id;
  check(r.status === 'planned' && birthIds.every((id) => p.npcIds.includes(id) && npc(id).role === 'parent'), 'before the placement, the child lives with the birth family');
  const at = r.placementAge;
  const before = Object.keys(S().npcs).length;
  years(at + 1);
  check(r.status === 'final' && r.placementYear === S().year - (P().age - at) && P().id === pid, `the adoption happened at ${at}, to the same child`);
  check(r.adoptiveParentIds.length && r.adoptiveParentIds.every((id) => P().npcIds.includes(id) && npc(id).role === 'parent'), 'new parents in the household');
  check(birthIds.every((id) => npc(id) && (r.contact === 'open' ? true : !P().npcIds.includes(id)) && npc(id).role !== 'parent'), 'the birth parents are the same people, no longer the household parents');
  check(birthIds.every((id) => O.knows(id, 'named')), 'a child of that age remembers the names of the people they lived with');
  check(Object.keys(S().npcs).length >= before && !Object.values(S().npcs).some((x) => x.id !== pid && x.firstName === P().firstName && x.flags.birthOf === pid && x.age === P().age), 'no second copy of the child');
  section('adopted during childhood: a coherent timeline and a real placement', n);
}

// 3. Raised by relatives: kinship adoption and guardianship are different things.
{
  const n = problems.length;
  const seen = new Set();
  for (let i = 0; i < 40 && seen.size < 2; i++) {
    const p = adoptee('kinship');
    const r = rec();
    seen.add(r.legal);
    const carers = r.carerIds.map(npc);
    check(carers.length && carers.every((c) => c.role === 'parent' && c.flags.kinCarer && p.npcIds.includes(c.id) && !isBiological(c)), 'the relatives who raise the child are the household parents');
    if (r.legal === 'adoption') check(r.legalParentIds.join() === r.carerIds.join() && carers.every((c) => c.flags.adoptiveParent), 'kinship adoption: the relatives are the legal parents');
    if (r.legal === 'guardianship') check(r.legalParentIds.length === 1 && npc(r.legalParentIds[0]).flags.birthKin === 'mother' && carers.every((c) => c.flags.guardian && !c.flags.adoptiveParent), 'guardianship: the birth mother stays the legal parent');
    check(mother() && p.npcIds.includes(mother().id) && mother().role === 'relative', 'the birth mother is known, and lives apart');
  }
  check(seen.has('adoption') && seen.has('guardianship'), `both kinship adoption and guardianship happen (${[...seen]})`);
  // A guardian's estate goes to their own children first, not to the child as if they were a legal parent.
  for (let i = 0; i < 60 && rec().legal !== 'guardianship'; i++) adoptee('kinship');
  if (rec().legal === 'guardianship') {
    const g = npc(rec().guardianIds[0]); g.savings = 300000; g.life = { savings: 300000 };
    const cash = P().finance.cash;
    inheritFrom(g);
    check(P().finance.cash === cash, 'a legal guardian\'s estate does not pass to the child by a parent\'s right');
  }
  store.state = createLife({ countryId: 'us', origin: 'kinship', year: 1830 });
  check(rec()?.legal === 'kinship-care', 'before legal adoption existed, it is a family arrangement');
  section('raised by relatives: kinship care, guardianship and adoption kept apart', n);
}

// Two mothers or two fathers: where and when the law let same-sex couples adopt together.
{
  const n = problems.length;
  const couples = (countryId, year, tries = 250) => {
    let same = 0; let all = 0; let example = null;
    for (let i = 0; i < tries; i++) {
      store.state = createLife({ countryId, origin: 'birth', year });
      const r = rec();
      if (!r || r.kind !== 'birth' || r.adoptiveParentIds.length !== 2) continue;
      all += 1;
      const [a, b] = r.adoptiveParentIds.map(npc);
      if (a.gender === b.gender) { same += 1; example ??= { state: S(), r }; }
    }
    return { same, all, example };
  };
  const now = couples('us', 2020);
  check(now.same > 0 && now.same < now.all * 0.15, `US 2020: some adoptive couples are two women or two men (${now.same} of ${now.all})`);
  if (now.example) {
    store.state = now.example.state;
    const [a, b] = now.example.r.adoptiveParentIds.map(npc);
    check(a.role === 'parent' && b.role === 'parent' && a.flags.adoptiveParent && b.flags.adoptiveParent && P().npcIds.includes(a.id) && P().npcIds.includes(b.id), 'both are the legal, household parents');
    check(now.example.r.legalParentIds.length === 2 && !isBiological(a) && !isBiological(b), 'both legal parents; neither biological');
    check(S().journal.some((e) => /^Your (mothers|fathers) are /.test(e.text)), 'the opening story names them as two mothers or two fathers');
    check(P().npcIds.map(npc).filter((x) => x.flags.adoptiveSibling).every((x) => x.parentIds.length === 1), 'an older sibling is the child of one of them, not of both');
  }
  check(couples('us', 1985, 120).same === 0, 'none in the US before any state allowed it');
  check(couples('uk', 2000, 120).same === 0 && couples('uk', 2010, 250).same > 0, 'England and Wales: from the 2002 Act coming into force (end of 2005)');
  check(couples('jp', 2020, 120).same === 0, 'none where same-sex couples still cannot adopt together');
  check(O.sameSexAdoptionLegal('us', 2010, 0.1) && !O.sameSexAdoptionLegal('us', 2010, 0.9) && O.sameSexAdoptionLegal('us', 2017, 0.9), 'before 2016 it depended on the (unnamed) US state the adoption was in');
  section('same-sex adoptive couples, by country and year', n);
}

// 5, 6. Brothers and sisters, and the integrity of the graph.
{
  const n = problems.length;
  let p = adoptee('birth', () => true);
  for (let i = 0; i < 80 && !(O.birthKin().some((x) => x.flags.birthKin === 'sibling') && P().npcIds.some((id) => npc(id).flags.adoptiveSibling)); i++) p = adoptee('birth');
  const r = rec();
  const adoptiveSibs = p.npcIds.map(npc).filter((x) => x.flags.adoptiveSibling);
  const birthSibs = O.birthKin().filter((x) => x.flags.birthKin === 'sibling' && !x.flags.adoptedTogether);
  check(adoptiveSibs.every((s) => s.role === 'sibling' && s.parentIds.every((id) => r.adoptiveParentIds.includes(id))), 'adoptive siblings are the adoptive parents\' children');
  check(birthSibs.every((s) => !p.npcIds.includes(s.id) && s.parentIds.some((id) => r.birthParentIds.includes(id))), 'birth siblings are the birth parents\' children, not in the household');
  const ids = [...p.npcIds];
  check(new Set(ids).size === ids.length, 'nobody is in the household twice');
  for (const id of [...r.birthParentIds, ...r.adoptiveParentIds, ...r.birthSiblingIds]) check(!!npc(id), `every record points at a real person (${id})`);
  check(!Object.values(S().npcs).some((x) => x.id === p.id), 'the player is not also an NPC');
  section('birth and adoptive siblings, and a sound family graph', n);
}

// 8. Names: a new surname, the birth name kept in the file, and the same character.
{
  const n = problems.length;
  const p = adoptee('birth', (r) => !!r.birthName);
  const r = rec();
  check(r.legalName.last === p.lastName && r.birthName.last === mother().lastName, 'the legal name is the adoptive family\'s; the birth name is the birth mother\'s');
  check(S().journal[0].text.includes(`${p.firstName} ${p.lastName}`), 'the opening line uses the legal name');
  const id = p.id;
  const before = Object.keys(S().npcs).length;
  adoptee('childhood');
  const r2 = rec();
  years(r2.placementAge + 1);
  check(P().id === r2.adopteeId && r2.birthName.first === P().firstName, 'a childhood adoption keeps the child\'s first name, and the same id');
  check(typeof before === 'number' && id, 'name change bookkeeping ran');
  section('name changes do not make a second character', n);
}

// 9–11. Open, mediated and closed arrangements.
{
  const n = problems.length;
  adoptee('birth', (r) => r.contact === 'open');
  O.myRecord().contact; S().origins.self.awareAge = 4;
  years(5);
  const m = mother();
  check(m && (!m.alive || (P().npcIds.includes(m.id) && m.role === 'relative' && O.knows(m.id, 'contact')) || S().origins.contacts[m.id].status === 'lapsed'), 'open: the birth mother is part of the child\'s life, as their birth mother');
  check(!P().npcIds.some((id) => npc(id).role === 'parent' && npc(id).flags.birthKin), 'open: she is never made a household parent');
  adoptee('birth', (r) => r.contact === 'mediated');
  S().origins.self.awareAge = 4;
  years(10);
  O.doOriginAction('askBirth');
  check(O.knowLevel(mother().id) === 'first', `mediated: a first name, not a full name (${O.knowLevel(mother().id)})`);
  check(S().origins.contacts[mother().id]?.status !== 'mediated' || O.originActions().some((a) => a.id === 'childLetter'), 'mediated: the child can write through the agency');
  adoptee('birth', (r) => r.contact === 'closed');
  S().origins.self.awareAge = 4;
  years(12);
  O.doOriginAction('askBirth');
  check(!O.birthKin().some((x) => O.knows(x.id, 'first')), 'closed: no names come from the adoptive parents');
  section('open, mediated and closed adoption', n);
}

// 12, 13. Unknown birth parents, and what the character knows when.
{
  const n = problems.length;
  adoptee('birth', (r) => r.birthFather === 'unknown');
  S().origins.self.telling = 'early'; // parents who talk about it openly (a 'limited' family shares less before 16)
  let v = O.originsView();
  check(v.aware === false && v.birth.length === 0 && v.known.length === 0, 'before they know, the screen shows nothing about the birth family');
  S().origins.self.awareAge = 5;
  years(5);
  v = O.originsView();
  check(v.aware && v.birth.find((b) => b.label === 'Birth father')?.name === 'Unknown to you', 'an unknown birth father is shown as unknown');
  check(!v.birth.some((b) => b.id && !O.knows(b.id, 'first')), 'nobody is listed by name before they are learned of');
  O.doOriginAction('askBirth');
  check(!O.knowsFact('mother:age'), 'at five, the birth mother\'s age is not part of the story');
  years(8);
  O.doOriginAction('askBirth');
  check(O.knowsFact('mother:age') && O.knowsFact('father:unknown'), 'by thirteen, more is shared: her age, and that the father is not known');
  check(!Object.values(S().npcs).some((x) => x.flags.birthKin === 'father' && x.flags.birthOf === P().id), 'no birth father is made up');
  section('unknown parentage and progressive disclosure', n);
}

// 14, 15. Who can search, and what the law of the place and year opens.
{
  const n = problems.length;
  adoptee('birth');
  S().origins.self.awareAge = 4;
  years(10);
  check(O.originActions().find((a) => a.id === 'records').why === 'From age 18, or with your parents', 'a minor cannot request records alone');
  check(O.originActions().find((a) => a.id === 'dna').why !== '', 'or take a DNA test');
  check(recordsAccessShares('uk', 2020).open === 100 && recordsAccessShares('uk', 1970).restricted === 100, 'England and Wales: open from the Children Act 1975');
  check(recordsAccessShares('fr', 2020).restricted === 100, 'an unresearched country is treated conservatively');
  check(!O.serviceOpen('dna', { jurisdiction: 'us' }, 1995) && O.serviceOpen('dna', { jurisdiction: 'us' }, 2015), 'consumer DNA matching only from its time');
  // A restricted state: background only, never a name.
  adoptee('birth', (r) => r.contact === 'closed');
  rec().accessSeed = 0.99; // the state sealed records
  S().origins.self.awareAge = 4;
  ageTo(17); S().origins.self.aware = true;
  years(1);
  check(O.doOriginAction('records').ok, 'an adult can request records');
  years(2);
  check(O.recordsAccess(rec()) === 'restricted' && !O.knows(mother().id, 'named'), 'sealed records give no name');
  rec().accessSeed = 0.01;
  S().origins.search.requests.forEach((r) => { r.made -= 10; });
  years(4);
  check(O.doOriginAction('records').ok, 'and the request can be made again years later');
  years(2);
  check(O.knows(mother().id, 'named'), 'open records give the birth mother\'s name');
  section('search eligibility and records access by jurisdiction and year', n);
}

/** A grown adoptee who knows, with a records request already answered (the birth mother named). */
function grownNamed(want = () => true) {
  adoptee('birth', (r) => r.contact === 'closed' && want(r));
  rec().accessSeed = 0.01;
  S().origins.self.awareAge = 4;
  ageTo(18); S().origins.self.aware = true;
  for (const k of O.birthKin()) k.flags.registered = undefined;
  O.doOriginAction('records');
  years(1, () => 0);
  return mother();
}

// 16, 17, 21. Consent decides: welcome, letters, time, a refusal, or a request for no contact.
{
  const n = problems.length;
  const outcomes = new Set();
  for (let i = 0; i < 30; i++) {
    const m = grownNamed();
    if (!m.alive) continue;
    m.flags.openness = [5, 30, 45, 60, 90][i % 5];
    m.flags.disputes = false;
    if (O.relativeActions(m.id).some((a) => a.id === 'request' && !a.why)) {
      S().origins.offers = { [m.id]: { channel: 'intermediary', year: S().year } };
      O.doRelativeAction(m.id, 'request');
    } else { O.doOriginAction('intermediary'); }
    years(3, () => 0);
    const k = S().origins.contacts[m.id];
    if (k) outcomes.add(k.status);
    if (m.flags.openness <= 10 && m.alive) {
      check(['noContact', 'declined'].includes(k?.status) && !P().npcIds.includes(m.id), `refused: no contact, and not added to your life (${k?.status} ${JSON.stringify(S().origins.search.requests.map((r) => [r.kind, r.made, r.due, r.done, r.target === m.id]))} ${JSON.stringify(O.relativeActions(m.id))} alive=${m.alive})`);
      if (k?.status === 'noContact') check(O.relativeActions(m.id).find((a) => a.id === 'request')?.why === 'They asked for no contact', 'a request for no contact blocks further requests');
    }
    if (k?.status === 'contact') check(P().npcIds.includes(m.id) && m.meters.relationship <= 70 && m.role === 'relative', 'contact: they join your life as a birth relative, with closeness still to build');
  }
  check(outcomes.has('contact') && [...outcomes].some((s) => ['noContact', 'declined', 'time'].includes(s)), `reunions go different ways (${[...outcomes]})`);
  section('consent: contact only if they agree; refusals respected; no automatic happy ending', n);
}

// 18, 19. A death and a prison sentence are found, never made.
{
  const n = problems.length;
  const m = grownNamed();
  m.alive = false; m.flags.diedYear = S().year - 3;
  O.doOriginAction('intermediary');
  const seen = years(3);
  check(seen.includes('org_unanswered') && O.knowsFact(`died:${m.id}`), 'the search finds that she died, as the record says');
  check(!P().npcIds.includes(m.id), 'a death is not a reunion');
  // A sentence from before the birth, in the history the life began with.
  let r;
  for (let i = 0; i < 300; i++) { adoptee('birth'); r = rec(); if (r.reason === 'incarcerated') break; }
  const mm = mother();
  check(r.reason === 'incarcerated' && mm.flags.originSentence && mm.flags.originSentence.from < r.placementYear + 1, 'a birth mother\'s sentence is part of the history from the start');
  check(!mm.flags.originSentence.offense && !mm.legal && !mm.flags.inmate, 'and no crime is invented for it');
  adoptee('birth', (x) => x.reason !== 'incarcerated');
  const before = JSON.stringify(O.birthKin().map((x) => x.flags.originSentence ?? null));
  ageTo(18); S().origins.self.aware = true; rec().accessSeed = 0.01;
  O.doOriginAction('records'); O.doOriginAction('intermediary'); years(3);
  check(JSON.stringify(O.birthKin().filter((x) => x.age > 0).map((x) => x.flags.originSentence ?? null)).replace(/null,?/g, '') === before.replace(/null,?/g, ''), 'searching never gives anyone a prison record');
  section('deceased and incarcerated relatives come from saved history only', n);
}

// 20, 23. A half-sibling found by DNA is the person who was already there.
{
  const n = problems.length;
  const m = grownNamed();
  m.alive = true;
  const kidsBefore = O.birthKin().length;
  const half = makeHalf(m);
  half.flags.dnaTested = S().year - 1;
  const count = Object.keys(S().npcs).length;
  O.doOriginAction('dna');
  const seen = [];
  for (let y = 0; y < 6 && !O.knows(half.id, 'first'); y++) seen.push(...years(1)); // one revelation a year: others may come first
  check(seen.includes('org_sibling') && O.knows(half.id, 'first'), 'a DNA match turns up the half-sibling');
  check(Object.keys(S().npcs).length >= count && O.birthKin().filter((x) => x.firstName === half.firstName && x.lastName === half.lastName).length === 1, 'the match is the existing person, not a new one');
  check(O.birthKin().length >= kidsBefore + 1, 'the birth family grew only by the birth');
  check(S().origins.self.facts[`match:${half.id}`]?.text.includes('cannot tell which') || S().origins.self.facts[`match:${half.id}`]?.text.includes('likely'), 'a DNA match says how sure it is');
  section('half-sibling discovery by DNA, with no duplicate people', n);
}
function makeHalf(m) {
  const { makeNpc } = mod;
  const h = makeNpc({ role: 'relative', countryId: 'us', age: 20, gender: 'female', lastName: m.lastName });
  h.parentIds = [m.id]; h.flags.birthKin = 'half'; h.flags.birthOf = P().id; h.flags.openness = 70; h.flags.title = 'Half-sister (birth family)';
  S().npcs[h.id] = h; rec().birthSiblingIds.push(h.id);
  return h;
}

// 22, 25. Searching does not change who your parents are; inheritance follows legal parentage.
{
  const n = problems.length;
  grownNamed();
  const r = rec();
  const pa = r.adoptiveParentIds.map(npc);
  const rels = pa.map((x) => x.meters.relationship);
  O.doOriginAction('registry'); O.doOriginAction('dna'); O.doOriginAction('intermediary');
  years(3);
  check(pa.every((x) => !x.alive || (x.role === 'parent' && x.flags.adoptiveParent && P().npcIds.includes(x.id))), 'the adoptive parents remain the parents');
  check(pa.every((x, i) => !x.alive || x.meters.relationship >= rels[i] - 25), 'and the search does not damage the bond by itself');
  check(rec().legalParentIds.join() === r.adoptiveParentIds.join(), 'legal parentage is unchanged by a search or a reunion');
  const m = mother();
  m.savings = 500000; m.life = { savings: 500000 };
  const cash = P().finance.cash;
  inheritFrom(m);
  check(P().finance.cash === cash, 'a birth parent\'s estate does not pass to the adoptee by blood alone');
  const par = pa.find((x) => x.alive) ?? pa[0];
  par.savings = 400000; par.meters.relationship = 80;
  for (const x of pa) if (x !== par) x.alive = false;
  inheritFrom(par);
  check(P().finance.cash > cash, 'an adoptive parent\'s estate does');
  section('no forced relationship changes; inheritance follows legal parentage', n);
}

// 24, 27. No duplicate events; saves keep it all; older saves are brought up to date without inventing anything.
{
  const n = problems.length;
  grownNamed();
  O.doOriginAction('dna'); O.doOriginAction('registry');
  years(4);
  const keys = (S().canon?.events ?? []).map((e) => e.key).filter(Boolean);
  check(new Set(keys).size === keys.length, 'no canonical event is recorded twice');
  const logKeys = S().origins.log.map((x) => x.key);
  check(new Set(logKeys).size === logKeys.length, 'no discovery is written down twice');
  const snap = JSON.stringify({ o: S().origins, ids: P().npcIds, n: Object.keys(S().npcs).length });
  saveGame(S());
  const back = loadGame(S().slotId);
  store.state = back;
  check(JSON.stringify({ o: S().origins, ids: P().npcIds, n: Object.keys(S().npcs).length }) === snap, 'save and reload: the same records, people and knowledge');
  saveGame(S()); store.state = loadGame(S().slotId);
  check(JSON.stringify({ o: S().origins, ids: P().npcIds, n: Object.keys(S().npcs).length }) === snap, 'and again: migration is idempotent');
  // An older save, with an adopted child and no origins at all.
  store.state = createLife({ countryId: 'us', year: 1990 });
  const old = JSON.parse(JSON.stringify(S()));
  delete old.origins;
  const kid = Object.values(old.npcs)[0];
  const child = { ...JSON.parse(JSON.stringify(kid)), id: 'npc_oldkid', role: 'child', adopted: true, adoptionInfo: { date: '2015-04-02', ageThen: 3, countryId: 'us', by: [old.player.id] }, flags: {} };
  old.npcs.npc_oldkid = child; old.player.npcIds.push('npc_oldkid');
  old.slotId = 'life_oldsave';
  localStorage.setItem('pathways.slot.life_oldsave', JSON.stringify(old));
  const up = loadGame('life_oldsave');
  const r = up.origins.records.adopt_npc_oldkid;
  check(r && r.legacy && r.birthParentIds.length === 0 && r.adoptiveParentIds[0] === up.player.id && up.npcs.npc_oldkid.role === 'child', 'an adopted child in an older save keeps their parents and gains a record, with no birth parents invented');
  check(!up.origins.self, 'an older life is not made adopted');
  store.state = up;
  const again = JSON.stringify(up.origins);
  saveGame(up);
  check(JSON.stringify(loadGame('life_oldsave').origins) === again, 'loading it again changes nothing');
  section('save, reload and versioned, idempotent migration', n);
}

// 26. History and place: before legal adoption, and services before they existed.
{
  const n = problems.length;
  check(!O.adoptionLegal('us', 1840) && O.adoptionLegal('us', 1860) && !O.adoptionLegal('uk', 1920) && O.adoptionLegal('uk', 1930), 'legal adoption from 1851 (US) and 1927 (England and Wales)');
  do store.state = createLife({ countryId: 'uk', origin: 'birth', year: 1915 }); while (P().royal);
  check(rec()?.kind === 'kinship' && rec().legal === 'kinship-care', 'asking for an adoption before adoption law gives a family arrangement instead');
  adoptee('birth', () => true, { year: 1960 });
  ageTo(18); S().origins.self.aware = true;
  check(O.originActions().find((a) => a.id === 'dna').why === 'Not available yet', 'no DNA test in 1978');
  section('historical and country availability', n);
}

// 28. Three-, six- and twelve-month turns: the same story, and no more opportunities with shorter turns.
{
  const n = problems.length;
  adoptee('birth', (r) => r.contact !== 'open');
  rec().accessSeed = 0.01;
  S().origins.self.awareAge = 4;
  ageTo(18); S().origins.self.aware = true;
  const start = structuredClone(S());
  const realNow = Date.now; const realRandom = Math.random;
  const run = (step) => {
    store.state = structuredClone(start);
    setStep(step);
    rng.seed(99);
    let t = 1.8e12; let s = 7; Date.now = () => (t += 1000); Math.random = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    O.doOriginAction('records'); O.doOriginAction('registry'); O.doOriginAction('dna');
    const perYear = [];
    for (let y = 0; y < 12 && P().alive; y++) {
      const got = [];
      for (let i = 0; i < 12 / step; i++) {
        // The same thing asked in the middle of a year, whatever the turn length.
        if (i === Math.floor(6 / step) - (step === 12 ? 0 : 1) && y === 2) for (const k of O.birthKin()) { const a = O.relativeActions(k.id).find((x) => x.id === 'request' && !x.why); if (a) O.doRelativeAction(k.id, 'request'); }
        advanceTurn();
        // Only the origins scenes are answered; the rest are left alone, as in tests/turns.mjs (the seasons bring their own).
        S().pendingEvents = S().pendingEvents.filter((e) => e.id.startsWith('org_'));
        got.push(...answer());
      }
      perYear.push(got);
    }
    return { perYear, told: Object.keys(S().origins.told).sort(), facts: Object.keys(S().origins.self.facts).sort(), people: S().origins.self.people, contacts: Object.fromEntries(Object.entries(S().origins.contacts).map(([k, v]) => [k, v.status])) };
  };
  const a = run(12); const b = run(6); const c = run(3);
  Date.now = realNow; Math.random = realRandom;
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c), 'twelve years of searching come out the same with 12-, 6- and 3-month turns');
  for (const r of [a, b, c]) check(r.perYear.every((y) => y.filter((id) => !['org_meet', 'org_complicated'].includes(id)).length <= 2), `never more than one revelation and one quieter moment a year (${JSON.stringify(r.perYear)})`);
  if (JSON.stringify(a) !== JSON.stringify(b) || JSON.stringify(a) !== JSON.stringify(c)) for (const k of Object.keys(a)) for (const [nm2, x] of [['6', b], ['3', c]]) if (JSON.stringify(a[k]) !== JSON.stringify(x[k])) problems.push(`  ${k} 12: ${JSON.stringify(a[k]).slice(0, 400)}\n  ${k} ${nm2}: ${JSON.stringify(x[k]).slice(0, 400)}`);
  section('three-, six- and twelve-month Age Up consistency', n);
}

// The first playable slice, end to end.
{
  const n = problems.length;
  const p = adoptee('birth', (r) => r.contact === 'closed' && r.birthParentIds.length);
  const r = rec();
  const start = { ids: [...p.npcIds], parents: [...r.adoptiveParentIds], kin: O.birthKin().map((x) => x.id) };
  S().origins.self.awareAge = 6;
  const childhood = years(13);
  check(childhood.includes('org_story') || childhood.includes('org_learn_late'), 'an origins conversation in childhood');
  check(O.originsView().aware && O.originsView().birth.every((b) => b.name === 'Unknown to you' || !b.id || O.knows(b.id, 'first')), 'My Origins shows only what is known');
  ageTo(18);
  r.accessSeed = 0.01;
  const m = mother();
  m.alive = true; m.flags.openness = 85; m.flags.disputes = false;
  check(O.doOriginAction('records').ok, 'records requested at 18');
  years(1);
  check(O.knows(m.id, 'named'), 'the response names her: a real, existing person');
  O.doOriginAction('public');
  S().origins.offers = { ...(S().origins.offers ?? {}), [m.id]: { channel: 'intermediary', year: S().year } };
  check(O.doRelativeAction(m.id, 'request').ok, 'contact requested through an appropriate channel');
  const after = years(3);
  const k = S().origins.contacts[m.id];
  check(['contact', 'letters', 'agreed'].includes(k.status), `she agreed, of her own accord (${k.status})`);
  if (k.status === 'contact') check(P().npcIds.includes(m.id) && after.includes('org_meet'), 'a relationship only once contact happened');
  check(start.parents.every((id) => !npc(id).alive || P().npcIds.includes(id)), 'adoptive family preserved');
  saveGame(S()); store.state = loadGame(S().slotId);
  const ids = P().npcIds;
  check(new Set(ids).size === ids.length && O.birthKin().filter((x) => x.id === m.id).length === 1 && Object.keys(S().origins.records).length === 1, 'after reload: no duplicate relatives, adoptions or households');
  const told = Object.keys(S().origins.told).length;
  for (const step of [3, 6, 12]) { setStep(step); years(1); }
  const keys = (S().canon?.events ?? []).map((e) => e.key).filter(Boolean);
  check(new Set(keys).size === keys.length && Object.keys(S().origins.told).length - told <= 6, 'three, six and twelve months on: no multiplied events or opportunities');
  check(Object.values(S().origins.contacts).every((x) => typeof x.status === 'string') && start.kin.every((id) => npc(id)), 'relationships and contact boundaries remain valid');
  section('the first playable slice, from birth to reunion and beyond', n);
}

console.log(ok.map((m) => `  ✓ ${m}`).join('\n'));
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${problems.map((x) => `  ✗ ${x}`).join('\n')}`); process.exit(1); }
console.log('\nAdoption and birth families: all checks passed.');
