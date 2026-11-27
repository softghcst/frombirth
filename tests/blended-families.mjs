// Blended families (engine/blended.js, engine/kinship.js): parents who separate while the player is growing up, the
// care arrangement, a parent's new partner, step-siblings and half-siblings. The vertical slice: a child with two
// parents and a real household; the parents separate; one moves to a home of their own; a new partner, a wedding,
// a step-sister and a half-brother; Age Up by three months and by six; save and reload; nobody duplicated.
// Run with: node tests/blended-families.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k), get length() { return disk.size; }, key: (i) => [...disk.keys()][i] ?? null };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { advanceTurn, setStep } = await import('../js/engine/turns.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { roleLabel } = await import('../js/engine/relationships.js');
const { resolveChoice } = await import('../js/engine/eventEngine.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const N = await import('../js/engine/neighborhood.js');
const K = await import('../js/engine/kinship.js');
const B = await import('../js/engine/blended.js');
const T = await import('../js/engine/together.js');
const chron = await import('../js/engine/chronicle.js');

rng.seed(818);
const problems = [];
let passed = 0;
const check = (c, m) => { if (c) passed++; else { problems.push(m); console.log(` ✗ ${m}`); } };

const people = () => store.state.player.npcIds.map((id) => store.state.npcs[id]).filter(Boolean);
const of = (role) => people().filter((n) => n.role === role);
const household = () => { const H = N.hoods(); return H.cur ? H.hhs[H.cur.hh].m : []; };
const year = () => { store.state.pendingEvents = []; advanceYear(); };

/** A child of seven with two parents together, in the United States now, living at home. */
function child(age = 7, countryId = 'us') {
  let s;
  do { s = createLife({ countryId }); } while (s.player.royal || s.player.flags.parentsStatus !== 'together' || s.npcIds?.length === 0
    || Object.values(s.npcs).filter((n) => n.role === 'parent').length !== 2);
  store.state = s;
  for (let i = 0; i < age; i++) { s.player.stats.health = 95; year(); s.player.alive = true; s.player.legal.incarceration = null; s.player.legal.pending = null; }
  // Nobody separated or met anyone by chance on the way here: the slice does it by hand.
  s.player.flags.parentsStatus = 'together';
  for (const n of of('parent')) { n.alive = true; delete n.flags.livesApart; }
  return s.player;
}

// ---------- 1. Kinship from the records ----------
{
  const p = child(7);
  const parents = of('parent');
  check(p.family?.v === 1, 'a new life has its family record');
  check(p.family.bioParentIds.length === 2 && parents.every((n) => p.family.bioParentIds.includes(n.id)), 'the parents the life was born to are written down');
  check(p.family.legalParentIds.join() === p.family.bioParentIds.join(), 'and they are its legal parents');
  for (const s of of('sibling')) {
    check(K.siblingKind(p, s) === (s.flags.twin ? 'twin' : 'full'), `${s.firstName}, born to the same parents, is a full sibling`);
  }
  check(parents.every((n) => K.isBioParent(n) && K.isLegalParent(n)), 'both parents are biological and legal parents');
}

// ---------- 2. The vertical slice ----------
const p = child(7);
const [mom, dad] = [of('parent').find((n) => n.gender === 'female'), of('parent').find((n) => n.gender === 'male')];
const startIds = new Set(p.npcIds);
check(household().includes(mom.id) && household().includes(dad.id), 'before: both parents live in the family household');
const familyHh = N.hoods().cur.hh;

B.separateParents(mom, dad, { legal: 'divorce', court: false });
const a = B.arrangement();
check(p.flags.parentsStatus === 'separated', 'the parents have separated');
check(a && a.primaryId === mom.id && a.otherId === dad.id, 'a care arrangement: mainly with one parent, time with the other');
check(!!B.SCHEDULES[a.schedule], `with a schedule (${a.schedule})`);
check(a.jurisdiction === 'us' && a.simplified === false && a.history.length === 1, 'the arrangement records where it was made, and its history');
check(store.state.npcs[dad.id] === dad && dad.alive && dad.role === 'parent', 'the father is the same person, still a parent');
check(p.family.bioParentIds.includes(dad.id) && p.family.legalParentIds.includes(dad.id), 'and still the biological and legal father');
check(!household().includes(dad.id) && household().includes(mom.id), 'he no longer lives in the family household; she does');
const dadHh = N.hoods().hhs[dad.flags.hh];
check(!!dadHh && dadHh.m.includes(dad.id) && !!dadHh.home && N.hoods().homes[dadHh.home].hh === dadHh.id, 'he lives in a home of his own, a real household on the map');
check(N.hoods().cur.hh === familyHh, 'the child stays in the same family household');
check(Object.values(N.hoods().hhs).filter((h) => h.m.includes(N.hoods().cur && `@${p.id}`) || h.me).length >= 1, 'the child is one resident, in one household');
check(chron.events((e) => e.type === 'family_separation').length === 1, 'the separation is a canonical event, once');
check(store.state.pendingEvents.some((e) => e.id === 'blend_separation'), 'the separation scene is waiting');
check(K.livesApart(dad) && !K.livesApart(mom), 'the household rule knows who lives apart');
check(B.seenOften(dad) === ['shared', 'weekends'].includes(a.schedule), 'time with the father counts as seeing him, under the schedule');

// Answering the scene.
const sep = store.state.pendingEvents.find((e) => e.id === 'blend_separation');
const sepEv = EVENT_BY_ID.blend_separation;
resolveChoice(sepEv, 0, sep.cast);
store.state.pendingEvents = [];

// A new partner for the mother, with a daughter; a wedding; a half-brother.
const partner = B.meetParentPartner(mom, { kids: 1 });
const stepSis = of('stepsibling')[0];
check(partner.role === 'stepparent' && partner.flags.partnerOf === mom.id && !partner.flags.married, 'the mother\'s partner is in the family, not yet married');
check(roleLabel(partner) === 'Your mother\'s partner', `labeled as her partner (${roleLabel(partner)})`);
check(!!stepSis && stepSis.parentIds?.[0] === partner.id && stepSis.flags.stepVia === partner.id, 'the partner\'s daughter is a real person, with her own parent');
check(K.siblingKind(p, stepSis) === 'step', 'she is a step-sibling, not a half-sibling');
check(!K.isBioParent(partner) && !K.isLegalParent(partner), 'a step-parent is neither a biological nor a legal parent');
check(!household().includes(partner.id), 'the partner does not live with the child yet');

B.moveIn(partner, mom);
stepSis.flags.liveIn = true;
N.syncHousehold();
check(household().includes(partner.id) && household().includes(stepSis.id), 'after moving in: the partner and her daughter live in the family household');
check(roleLabel(partner).startsWith('Step'), `a step-parent once they live together (${roleLabel(partner)})`);
check(B.marryParent(partner, mom) && partner.flags.married, 'the mother remarries');
check(chron.events((e) => e.type === 'wedding' && e.people.includes(partner.id)).length === 1, 'the wedding is a canonical event');
const half = B.halfSibling(mom, partner);
check(half.role === 'sibling' && half.flags.half === mom.id && half.parentIds.includes(mom.id) && half.parentIds.includes(partner.id), 'their baby is a half-sibling, through the mother');
check(K.siblingKind(p, half) === 'half', 'kinship: half');
check(K.siblingKind(stepSis, half) === 'half', 'and the step-sister\'s half-sibling too, through her parent');
check(roleLabel(half).startsWith('Half-'), `labeled as a half-sibling (${roleLabel(half)})`);
check(K.kinNote(half) === 'Same mother', `the family tree says how (${K.kinNote(half)})`);

// Things to do with the step-family.
const acts = (n) => T.BONDS.filter((b) => b.roles.includes(n.role)).map((b) => b.id);
check(acts(partner).includes('stepTime') && acts(stepSis).includes('stepSibTime'), 'there are things to do with a step-parent and a step-sibling');
check(T.BONDS.find((b) => b.id === 'seeMore').if(dad) && !T.BONDS.find((b) => b.id === 'seeMore').if(mom), 'asking to see a parent more is for the one who lives apart');

// Age Up by three months, then six.
const before = { ids: [...p.npcIds].sort().join(), cash: p.finance.cash };
store.state.settings = { ...(store.state.settings ?? {}), step: 3 };
store.state.month = 0;
store.state.pendingEvents = []; advanceTurn();
check(B.arrangement()?.primaryId === mom.id && !household().includes(dad.id), 'three months on: the arrangement and household stand');
store.state.settings.step = 6;
store.state.pendingEvents = []; advanceTurn();
const ids = p.npcIds;
check(new Set(ids).size === ids.length, 'nobody is listed twice');
check(of('stepparent').filter((n) => n.flags.partnerOf === mom.id && !n.flags.former).length <= 1, 'one current partner for the mother, at most');
check(Object.values(store.state.npcs).filter((n) => n.firstName === half.firstName && n.lastName === half.lastName && n.age <= 2).length === 1, 'the half-brother exists once');
check(p.family.separations.length === 1, 'one separation, however the turns were cut');

// Save and reload.
saveGame(store.state);
const back = loadGame(store.state.slotId);
store.state = back;
const P = back.player;
const n2 = (id) => back.npcs[id];
check(P.family.arrangement.primaryId === mom.id && n2(dad.id).flags.livesApart, 'after reload: the arrangement and who lives apart');
check(n2(partner.id).role === 'stepparent' && n2(partner.id).flags.married, 'the step-parent and the marriage');
check(K.siblingKind(P, n2(stepSis.id)) === 'step' && K.siblingKind(P, n2(half.id)) === 'half', 'step- and half-siblings, still told apart');
check(P.family.bioParentIds.includes(dad.id), 'the father is still the father');
check(chron.events((e) => e.type === 'family_separation').length === 1, 'still one separation in the record');
check([...startIds].every((id) => back.npcs[id]), 'everyone from the start of the slice is still there');

// ---------- 3. The yearly engine: separations happen, and only where and when they can ----------
{
  let seen = 0; let inItaly1960 = 0;
  for (let i = 0; i < 40; i++) {
    const q = child(3);
    for (let y = 0; y < 12; y++) { year(); q.alive = true; if (q.flags.parentsStatus === 'separated') break; }
    if (q.family.separations.length) seen++;
  }
  check(seen > 0 && seen < 40, `some families separate over the years, not all (${seen} of 40)`);
  // No divorce in Italy before 1970: separations there are rare, and never a divorce.
  for (let i = 0; i < 20; i++) {
    let s; do { s = createLife({ countryId: 'it', year: 1955 }); } while (s.player.royal || s.player.flags.parentsStatus !== 'together');
    store.state = s;
    for (let y = 0; y < 12; y++) { s.player.stats.health = 95; year(); s.player.alive = true; }
    if (s.player.family.separations.some((x) => x.legal === 'divorce' && x.year < 1970)) inItaly1960++;
  }
  check(inItaly1960 === 0, 'nobody divorces in Italy before divorce was legal there');
}

// ---------- 4. A parent who dies: the child goes to the other parent, still one child ----------
{
  const q = child(9);
  const [m, d] = [of('parent').find((n) => n.gender === 'female'), of('parent').find((n) => n.gender === 'male')];
  B.separateParents(m, d);
  m.alive = false;
  year();
  const arr = q.family.arrangement;
  check(arr.primaryId === d.id && !d.flags.livesApart, 'when the parent the child lives with dies, the child goes to the other parent');
  check(arr.history.some((h) => h.why === 'a parent died'), 'the arrangement remembers why');
}

// ---------- 4b. Parents who cannot agree: family court, and child support ----------
{
  const q = child(12);
  const C = await import('../js/engine/familyCourt.js');
  const { J } = await import('../js/engine/cases.js');
  const [m, d] = [of('parent').find((n) => n.gender === 'female'), of('parent').find((n) => n.gender === 'male')];
  d.income = 60000; d.savings = 10000; m.savings = 5000; d.meters.relationship = 50; // not close enough for shared care: support is due
  B.separateParents(m, d, { court: true });
  const arr = q.family.arrangement;
  const c = C.openFamilyCase(q);
  check(c && J().family[c.id] === c && c.stage === 'mediation' && arr.caseId === c.id && arr.basis === 'temporary order', 'a custody case, in the justice record, with the arrangement temporary meanwhile');
  check(!!store.state.npcs[c.judgeId], 'its judge is a real person');
  check(arr.support?.payerId === d.id && arr.support.amountYear === 9000, `the parent who moved out pays support: 15% of income (${arr.support?.amountYear})`);
  const heard = store.state.pendingEvents.find((e) => e.id === 'blend_custody_heard');
  check(!!heard, 'at twelve, the court asks the child');
  resolveChoice(EVENT_BY_ID.blend_custody_heard, 1, heard.cast); // "I want to live with {leaving}"
  check(c.heard?.wish === d.id && c.heard.age === 12, 'and what they said is on the case');
  // Money does not decide it: the same case, with the father very rich, comes out the same.
  const snap = JSON.stringify(store.state);
  const mSav0 = m.savings;
  year();
  const decided = { primary: q.family.arrangement.primaryId, by: C.familyCases(q)[0].decision?.by };
  check(C.familyCases(q)[0].stage === 'decided' && ['agreement', 'judge'].includes(decided.by), `a year on, decided (${decided.by})`);
  check(['agreed in mediation', 'court order'].includes(q.family.arrangement.basis), 'and the arrangement says how');
  check(chron.events((e) => e.type === 'family_court').length >= 1, 'a canonical event');
  const supportNow = q.family.arrangement.support;
  const payee = store.state.npcs[supportNow?.payeeId];
  check(supportNow && supportNow.paid > 0 && (payee.id === m.id ? payee.savings > mSav0 : true), 'support was paid, from one household to the other');
  const rich = JSON.parse(snap); store.state = rich;
  for (const n of Object.values(rich.npcs)) if (n.id === d.id) { n.savings = 1e9; n.wealth = 100; n.meters.money = 100; }
  year();
  check(rich.player.family.arrangement.primaryId === decided.primary, 'a rich parent does not win by being rich: the same decision');
}

// ---------- 4c. An appeal, and asking the court to look again ----------
{
  const q = child(13);
  const C = await import('../js/engine/familyCourt.js');
  const [m, d] = [of('parent').find((n) => n.gender === 'female'), of('parent').find((n) => n.gender === 'male')];
  m.meters.relationship = 80; d.meters.relationship = 80;
  B.separateParents(m, d, { court: true });
  const c = C.openFamilyCase(q);
  c.heard = { wish: d.id, age: 13 };
  store.state.pendingEvents = [];
  year();
  // Whatever was decided, make it a judge's decision that went against what the child said, so there is a ground.
  c.decision.by = 'judge'; c.decision.primaryId = m.id;
  if (q.family.arrangement.primaryId !== m.id) { q.family.arrangement.primaryId = m.id; q.family.arrangement.otherId = d.id; m.flags.livesApart = false; d.flags.livesApart = true; }
  delete c.appeal;
  const ap = C.appealDecision(c, d.id);
  check(ap && ap.court && ap.grounds.length === 1 && /twelve/.test(ap.grounds[0]), `an appeal, to the appeal court, on a real ground (${ap?.grounds})`);
  check(!C.appealDecision(c, d.id) || c.appeal === ap, 'appealed once');
  year();
  check(['upheld', 'overturned'].includes(c.appeal.outcome), `decided a year on (${c.appeal.outcome})`);
  check(c.appeal.outcome === 'upheld' ? q.family.arrangement.primaryId === m.id : q.family.arrangement.primaryId === d.id, 'and the arrangement follows the appeal court');
  // At fourteen, the child asks the court to look again.
  const other = store.state.npcs[q.family.arrangement.otherId];
  let asked = B.askCourtToLookAgain(other.id);
  if (/too new/.test(asked.text)) { year(); asked = B.askCourtToLookAgain(store.state.npcs[q.family.arrangement.otherId].id); } // an overturned decision is a new one
  check(asked.ok, `a teenager can ask the court to look again (${asked.text})`);
  check(!B.askCourtToLookAgain(store.state.npcs[q.family.arrangement.otherId].id).ok, 'once at a time');
  year();
  const rv = C.familyCases(q)[0].reviews.at(-1);
  check(['changed', 'unchanged'].includes(rv.outcome), `the court looked again (${rv.outcome})`);
  const wanted = rv.wish;
  check(rv.outcome === 'changed' ? q.family.arrangement.primaryId === wanted : q.family.arrangement.primaryId !== wanted, 'and where the child lives follows it');
}

// ---------- 4d. A life begun in adoption (engine/origins.js): birth parents and adoptive parents kept apart ----------
{
  let s; let rec = null;
  for (let i = 0; i < 8 && !rec; i++) { s = createLife({ countryId: 'us', origin: 'birth' }); rec = Object.values(s.origins?.records ?? {}).find((r) => r.adopteeId === s.player.id && r.legal === 'adoption'); }
  if (rec) {
    store.state = s;
    const q = s.player;
    const home = q.npcIds.map((id) => s.npcs[id]).filter((n) => n?.role === 'parent');
    check(q.family.bioParentIds.join() === rec.birthParentIds.join(), 'an adopted child\'s biological parents are the birth parents on the record');
    check(home.length && home.every((n) => q.family.legalParentIds.includes(n.id) && K.isLegalParent(n) && !K.isBioParent(n)), 'the parents who raise them are their legal parents, not their biological ones');
    const sib = q.npcIds.map((id) => s.npcs[id]).find((n) => n?.role === 'sibling' && !n.flags.birthKin);
    if (sib) check(K.siblingKind(q, sib) === 'adoptive', `a brother or sister in the adoptive family is an adoptive sibling (${K.siblingKind(q, sib)})`);
  } else check(false, 'a life begun in adoption could be made');
}

// ---------- 5. Old saves: brothers and sisters without parent links ----------
{
  const q = child(5);
  for (const s of of('sibling')) delete s.parentIds;
  delete q.family;
  B.migrateFamilyLife(store.state);
  B.migrateFamilyLife(store.state); // twice: nothing changes the second time
  check(q.family.v === 1 && of('sibling').every((s) => s.flags.half === true || s.parentIds?.length === q.family.bioParentIds.length), 'old siblings get the parents they were born to');
  check(!of('stepparent').length && !q.family.separations.length && !q.family.arrangement, 'nothing is invented: no step-parent, no separation, no arrangement');
}

if (problems.length) { console.log(`PROBLEMS:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`${passed} checks passed. Blended families hold together: one child, two homes, a step-family and a half-sibling, through turns and a reload.`);
