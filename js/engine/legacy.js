// Carrying on: when a life ends, the player can step into the life of one of
// their children (or, with no children left, a grandchild). The heir keeps the
// schooling, job, savings, partner and children they already had, and the
// rest of the family is re-drawn around them.
import { idolWork } from './kpop.js';
import { handOver as handOverHoods } from './neighborhood.js';
import { held } from './citizenship.js';
import { archivePerson, archiveIdOf } from './chronicle.js';
import { ensureGlobal } from './globalLife.js';
import { leaveName, carryCareer } from './kin.js';
import { rng } from '../rng.js';
import { inheritStanding } from './royalty.js';
import { uid, clamp, theCountry } from '../util.js';
import { store } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { SCHOOL_STAGES, PROGRAMS } from '../data/schools.js';
import { ensureLife } from './npcLives.js';
import { takeOverJob } from './career.js';
import { ensure as ensureSchool } from './schooling.js';
import { schoolModel } from '../data/education.js';
import { stageFor } from './grades.js';
import { convertMoney } from './emigration.js';
import { SCHEMA_VERSION, getGraveyard } from '../save.js';
import { ledgerOf } from './ledger.js';
import { carryTrust } from './trusts.js';
import { carryTraditions } from './moments.js';
import { rollLongevity } from './death.js';
import { normalize } from '../avatar/catalog.js';
import { cloneAppearance } from '../avatar/inherit.js';
import { attractedTo } from './identity.js';
import { passOn } from './edlegacy.js';
import { genomeOf } from './health/heredity.js';
import { npcHealth } from './health/story.js';
import { heirHealth, legacySummary } from './health/index.js';
import { carryOver } from './digital/legacy.js';
import { handOver as handOverAnimals, staysInFamily, settleOnDeath as settleAnimals } from './animals.js';
import { passOn as carryCareers } from './careerRecord.js';
import { handOver as handOverSports } from './sportsLife.js';
import { rate as fxRate } from './currency.js';

const byGender = (n, m, f, other) => (n.gender === 'male' ? m : n.gender === 'female' ? f : other);
const round2 = (n) => Math.round(n * 100) / 100;

/** Who the player could continue as: living children, else living grandchildren. Oldest first. */
export function heirs(state = store.state) {
  const all = state.player.npcIds.map((id) => state.npcs[id]).filter((n) => n?.alive);
  const kids = all.filter((n) => n.role === 'child');
  return (kids.length ? kids : all.filter((n) => n.role === 'grandchild')).sort((a, b) => b.age - a.age);
}

/** School and degrees, in the shape the player's education uses. */
function schooling(h, atHome) {
  const e = h.life.edu;
  const a = h.age;
  const gpa = round2(e.gpa || 2.5);
  const leaving = schoolModel(store.state.player.countryId).leaving;
  const degrees = e.degrees.map((t) => (t === 'high' ? { type: 'high', gpa, age: 18, award: leaving }
    : t === 'university' ? { type: 'university', majorId: e.majorId, gpa, age: 22, ...(store.state.universities?.[e.uniId] ? { school: store.state.universities[e.uniId].name } : {}) }
      : t === 'apprenticeship' ? { type: 'apprenticeship', majorId: e.trade, gpa, age: 21 }
        : { type: t, gpa, age: 26 }));
  const edu = { stage: 'none', enrolled: false, yearInStage: 0, gpa: a >= 6 ? gpa : 0, effort: 50, absences: 0,
    clique: null, clubs: [], majorId: null, funding: null, housing: atHome ? 'home' : 'apartment', roommateId: null,
    housingAid: false, degrees, expelled: false, droppedOut: false,
    // The schools they went to as a child, kept for the family's record.
    // (one still at school is re-enrolled at the current one, which adds it again)
    history: (a < 18 ? (e.schools ?? []).slice(0, -1) : e.schools ?? []).map((s, i, all) => ({ schoolId: null, name: s.name, kind: s.kind, stage: null, stageName: '', from: s.from, to: all[i + 1]?.from ?? Math.min(a, 18), how: 'completed' })) };
  if (a < 18) {
    const stage = stageFor(a, schoolModel(store.state.player.countryId).stages, 99) ?? [...SCHOOL_STAGES].reverse().find((s) => s.start <= a);
    if (stage) Object.assign(edu, { stage: stage.id, enrolled: true, yearInStage: a - stage.start });
    // The school they were already at, if it is for this stage.
    if (e.schoolId) edu.joinSchoolId = e.schoolId;
    return edu;
  }
  if (e.yearsLeft > 0 && PROGRAMS[e.stage]) {
    return Object.assign(edu, { stage: e.stage, enrolled: true,
      yearInStage: Math.max(0, PROGRAMS[e.stage].years - e.yearsLeft),
      majorId: e.stage === 'apprenticeship' ? e.trade : e.majorId,
      funding: PROGRAMS[e.stage].tuition ? 'loan' : null, housing: atHome ? 'home' : 'dorm' });
  }
  if (!degrees.some((d) => d.type === 'high')) degrees.unshift({ type: 'high', gpa, age: 18, award: leaving });
  edu.stage = degrees[degrees.length - 1].type;
  return edu;
}

/** The dead player, as a relative of the heir. */
function asAncestor(old, role, year) {
  return { id: uid('npc'), firstName: old.firstName, lastName: old.lastName, gender: old.gender, age: old.age,
    alive: false, role, meters: { relationship: 80, money: 50, crazy: old.hidden.crazy, intellect: old.stats.intellect,
      charm: old.stats.charm, health: 0, generosity: 50 },
    appearance: cloneAppearance(old.appearance), traits: [...old.traits], occupation: ((idolWork(old)?.current ? idolWork(old).title : null) ?? old.career.title ?? 'retired').toLowerCase(),
    talents: { ...old.talents }, lastInteractionAge: -1, flags: { diedYear: year, ancestor: true, wasPlayer: old.id, archiveId: archiveIdOf(old), ...publicRecord(old) },
    // The same person, for the family's history: where they were born and lived.
    bornIn: old.birthCountryId, birthCity: old.birthCity ?? null,
    places: (old.locations ?? []).map((l) => ({ countryId: l.countryId, city: l.city ?? null, from: l.from ?? null, to: l.to ?? year, homes: [...(l.homes ?? [])] })),
    citizenships: (old.citizenships ?? []).map((c) => ({ ...c })),
    // What a descendant may know of their health: shared conditions and inherited ones, never notes or prescriptions.
    genome: old.genome, health: legacySummary(old) };
}

/**
 * What of a life's legal history the family can find later: convictions that
 * were not sealed or juvenile, acquittals, exonerations. The rest stays private.
 */
function publicRecord(old) {
  const shown = (old.legal?.record ?? []).filter((r) => !r.juvenile && !r.sealed);
  if (!shown.length) return {};
  const ids = new Set(shown.map((r) => r.caseId));
  return { tag: 'recordedAncestor', record: shown.map((r) => ({ ...r })),
    legalHistory: (old.legal.history ?? []).filter((h) => !h.caseId || ids.has(h.caseId)).map((h) => ({ ...h })) };
}

/** Turns someone with a life of their own into a parent of the heir. */
function asParent(n, step) {
  const L = n.life;
  n.income = L?.job?.salary ?? L?.pension ?? n.income ?? 0;
  n.savings = Math.max(0, L?.savings ?? n.savings ?? 0);
  n.wealth = n.meters.money;
  n.strictness ??= rng.int(25, 75);
  n.occupation ??= 'retired';
  delete n.life;
  if (step) { n.flags.title = byGender(n, 'Stepfather', 'Stepmother', 'Step-parent'); n.flags.step = true; }
}

/**
 * Works out everyone's place in the heir's family.
 * @returns {Object<string,string>} npc id -> new role (people left out are dropped)
 */
function newRoles(old, h) {
  const roles = {};
  const all = old.player.npcIds.map((id) => old.npcs[id]).filter((n) => n && n.id !== h.id);
  const mine = (n) => n.parentIds?.includes(h.id);
  const myKids = new Set(all.filter(mine).map((n) => n.id));
  const parents = new Set(h.parentIds ?? []);
  const sharesParent = (n) => (n.parentIds ?? []).some((id) => parents.has(id));

  for (const n of all) {
    let role = null;
    if (n.role === 'pet') continue; // decided below, by who keeps them now
    if (n.role === 'inlaw' && n.flags.partnerOf === h.id) role = n.flags.former ? 'ex' : h.life.married ? 'spouse' : 'partner';
    else if (mine(n)) role = 'child';
    else if ((n.parentIds ?? []).some((id) => myKids.has(id))) role = 'grandchild';
    else if (h.role === 'child') {
      // A child of the same parent by somebody else is a half-sibling (engine/bonds.js).
      if (n.role === 'child') { role = 'sibling'; if (parents.size && n.parentIds?.length && !sharesParent(n)) n.flags.half = true; }
      else if (parents.has(n.id) || n.role === 'spouse') role = 'parent';
      else if (n.role === 'parent') role = 'grandparent';
      else if (n.role === 'sibling') role = 'relative';
      else if (n.role === 'inlaw') role = 'inlaw';
      else if (n.role === 'grandchild' || n.role === 'greatgrandchild') role = 'niece';
    } else { // the heir is a grandchild
      if (parents.has(n.id)) role = 'parent';
      else if (n.role === 'grandchild') role = sharesParent(n) ? 'sibling' : 'relative';
      else if (n.role === 'child') role = 'relative';
      else if (n.role === 'spouse') role = 'grandparent';
    }
    // The dead are kept only where the family tree would miss them.
    if (role && !n.alive && !['parent', 'grandparent', 'sibling', 'child'].includes(role)) role = null;
    if (role) roles[n.id] = role;
  }
  // In-laws stay only while the relative they came with is still family.
  for (const n of all) {
    if (roles[n.id] === 'inlaw' && !['sibling', 'child'].includes(roles[n.flags.partnerOf])) delete roles[n.id];
  }
  // An animal stays in the heir's life only if the heir, or someone still in their family, is the one keeping it.
  // The rest are not lost: the family's record of them goes across whole (animals.handOver).
  for (const n of all) if (n.role === 'pet' && n.alive && staysInFamily(old, n.id, h.id, roles)) roles[n.id] = 'pet';
  return roles;
}

const CLOSENESS = { parent: [60, 90], sibling: [45, 85], spouse: [65, 92], partner: [60, 85], child: [70, 95],
  grandchild: [60, 90], grandparent: [50, 85], pet: [60, 90], ex: [10, 35] };

/** The heir's own past, retold in the first person for their journal. */
function pastEntries(h) {
  return (h.life.history ?? []).filter((x) => !/^says /.test(x.text)).map((x) => ({ age: x.age, kind: 'system', tone: 'neutral',
    text: `You ${x.text.replace(/^was /, 'were ').replace(/\b(his|her|their) (job|ambition|own)\b/g, 'your $2')}.` }));
}

/**
 * Builds a new game in which the player is the given child or grandchild.
 * Must be called while the finished life is still in the store.
 * @returns {import('../types.js').GameState}
 */
export function continueAs(npcId) {
  const old = store.state;
  const op = old.player;
  const h = old.npcs[npcId];
  if (!h?.alive || !heirs(old).some((n) => n.id === npcId)) return null;
  ensureLife(h);
  const L = h.life;
  settleAnimals(old); // already done when the life ended; this covers lives that ended before animals had a record
  const roles = newRoles(old, h);
  const lost = h.role === 'child' ? byGender(op, 'father', 'mother', 'parent') : byGender(op, 'grandfather', 'grandmother', 'grandparent');

  // Family, re-drawn around the heir.
  const npcs = {};
  // Genomes and health are worked out in the old life, where the family is known.
  genomeOf(op); genomeOf(h); npcHealth(h);
  const ancestor = asAncestor(op, h.role === 'child' ? 'parent' : 'grandparent', old.year);
  npcs[ancestor.id] = ancestor;
  for (const [id, role] of Object.entries(roles)) {
    const n = old.npcs[id];
    const was = n.role;
    n.role = role;
    n.memories = [];
    n.lastInteractionAge = h.age;
    delete n.flags.title;
    const [lo, hi] = CLOSENESS[role] ?? [35, 65];
    n.meters.relationship = rng.int(lo, hi);
    if (role === 'parent') asParent(n, h.role === 'child' && (h.parentIds ?? []).length > 0 && !h.parentIds.includes(n.id));
    if (role === 'relative') {
      delete n.life;
      n.flags.title = was === 'grandchild' ? 'Cousin' : byGender(n, 'Uncle', 'Aunt', 'Parent\'s sibling');
    }
    if (role === 'niece' && was === 'greatgrandchild') n.flags.title = byGender(n, 'Great-nephew', 'Great-niece', 'Sibling\'s grandchild');
    if (role === 'spouse') { n.marriedAtAge = Math.max(18, h.age - (L.together ?? 0)); n.prenup = false; }
    if (role === 'ex') n.flags.wasSpouse = true;
    if (['spouse', 'partner', 'ex'].includes(role)) { delete n.flags.partnerOf; delete n.flags.married; delete n.flags.former; }
    if (role === 'child') n.parentIds = (n.parentIds ?? []).filter((x) => x !== h.id);
    npcs[id] = n;
  }

  const parentsAlive = Object.values(npcs).some((n) => n.alive && n.role === 'parent');
  const atHome = h.age < 18;
  const debt = L.savings < 0 ? -L.savings : 0;
  const rolled = () => clamp(Math.round(rng.around(50, 30)));

  const assetIds = {}; // an inherited house is the same house: what happened in it stays attached to it
  /** @type {import('../types.js').Character} */
  const player = {
    id: uid('pc'), firstName: h.firstName, lastName: h.lastName, gender: h.gender, age: h.age,
    birthYear: old.year - h.age, countryId: op.countryId, city: op.city, birthCountryId: h.bornIn ?? op.countryId,
    citizenships: (h.citizenships ?? held(h).map((j) => ({ jurisdictionId: j, acquisitionType: 'birth', acquiredAt: old.year - h.age }))).map((x) => ({ ...x })),
    stats: { mood: 45, health: h.meters.health, intellect: h.meters.intellect, charm: h.meters.charm },
    hidden: { karma: h.hidden?.karma ?? rolled(), discipline: h.hidden?.discipline ?? rolled(), willpower: h.hidden?.willpower ?? rolled(),
      fertility: h.hidden?.fertility ?? rolled(), fame: Math.round(op.hidden.fame * 0.3), crazy: h.meters.crazy },
    talents: { music: 20, sports: 20, acting: 20, crime: 10, singing: 20, dance: 20, ...h.talents },
    traits: [...(h.traits ?? [])], traitSources: {}, birth: [], conditions: [],
    appearance: cloneAppearance(normalize(h.appearance, h.id)),
    education: schooling(h, atHome),
    career: { careerId: null, title: null, level: 0, salary: 0, performance: 50, yearsInRole: 0, yearsInField: 0,
      coworkerIds: [], bossId: null, partTime: null, history: [], retired: !!L.retired,
      pensionPerYear: L.retired ? L.pension ?? 0 : 0, military: null },
    finance: { cash: Math.max(0, L.savings), pension: 0, lifetimeEarned: 0, lifetimeTaxPaid: 0,
      loans: debt ? [{ id: uid('loan'), kind: 'personal', principal: debt, rate: 0.08, yearsLeft: 8 }] : [] },
    // A home keeps its identity from one owner to the next: the family's history (and its animals) point at it.
    assets: (h.inheritance?.assets ?? []).map((a) => { const id = a.id ?? uid('asset'); assetIds[a.id] = id; return { ...a, id }; }), inventory: [], homeId: null,
    npcIds: Object.keys(npcs),
    legal: { record: [], incarceration: null, heat: 0 },
    social: { handle: null, followers: 0, posts: 0, viral: 0, boughtFollowers: 0 },
    flags: { livesWithParents: atHome, parentsStatus: parentsAlive ? 'together' : 'gone', longevity: rollLongevity(op.flags.longevity ?? 0) },
    milestones: [{ age: 0, text: `Born to ${op.firstName} ${op.lastName}.`, kind: 'life' }],
    counters: { crimes: 0, kills: 0, donated: 0, gambled: 0, yearsJailed: 0, escapes: 0, livesSaved: 0,
      spouses: Object.values(roles).filter((r) => r === 'spouse').length, jobsHeld: 0, countriesLived: 1 },
    alive: true, generation: (op.generation ?? 1) + 1,
    orientation: h.orientation ?? 'straight', skills: {},
  };
  // Who the heir is in the family's history: the same person they were as a relative.
  player.archiveId = archiveIdOf(h);
  player.birthCity = h.birthCity ?? null;
  player.documents = (h.documents ?? []).map((d) => ({ ...d, holderId: player.id }));
  player.authorizations = (h.authorizations ?? []).map((a) => ({ ...a, personId: player.id }));
  player.stays = (h.stays ?? []).map((x) => ({ ...x }));
  if (h.places?.length) player.locations = h.places.map((l) => ({ countryId: l.countryId, city: l.city ?? null, from: l.from ?? null, ...(l.to != null ? { to: l.to } : {}), reason: null, derived: !!l.derived, homes: [] }));
  player.flags.bornAs = h.flags.bornAs ?? h.gender;
  player.flags.interestedIn = attractedTo(player.orientation, h.gender);
  player.flags.gifts = Object.entries(player.talents).filter(([, v]) => v >= 70).map(([k]) => k);
  if (h.flags.transitioned || h.flags.cameOut) {
    player.flags.identity = { knows: true, outOrientation: !!h.flags.cameOut, outGender: !!h.flags.transitioned, hrtAge: null, top: false, bottom: false, legal: false, names: h.flags.formerName ? [h.flags.formerName] : [] };
    if (h.flags.formerName) player.flags.birthName = h.flags.formerName;
  }
  player.milestones.push({ age: h.age, text: `Lost ${op.firstName}, and carried the family on.`, kind: 'family' });

  const entry = (text, tone = 'neutral') => ({ age: h.age, text, kind: 'system', tone });
  const next = {
    // The next generation lives in the same world as the last: the same weather (engine/disasters.js).
    worldId: old.worldId ?? old.timeline?.root ?? old.slotId,
    schemaVersion: SCHEMA_VERSION, spelling: 'us', slotId: uid('life'), createdAt: Date.now(), updatedAt: Date.now(), year: old.year,
    player, npcs, journal: pastEntries(h), market: old.market, eventHistory: [], pendingEvents: [],
    rngSeed: rng.state(), settings: old.settings ?? { theme: 'auto' },
  };
  // The family's shared record goes on: every event, and the person whose life has ended, archived with their places and papers.
  next.canon = old.canon ?? { events: [] };
  next.archive = old.archive ?? { people: {} };
  next.today = `${old.year}-01-01`;
  archivePerson(op, { died: old.year, parents: op.archiveParents ?? [], more: {
    trips: (op.travel?.trips ?? []).filter((t) => t.status === 'completed').map((t) => ({ id: t.id, type: t.type, countryId: t.destination.countryId, city: t.destination.city, depart: t.depart, ret: t.ret })),
    languages: Object.entries(op.skills ?? {}).filter(([k, v]) => ['spanish', 'french', 'japanese', 'mandarin', 'german', 'korean', 'portuguese', 'arabic', 'sign_language'].includes(k) && v >= 40).map(([k]) => k) } });
  player.archiveParents = [archiveIdOf(op)];
  store.state = next;
  heirHealth(next, h);
  handOverAnimals(old, next, { ancestorId: ancestor.id, heirId: h.id, assetIds });
  handOverHoods(old, next, h.id); // the same neighborhoods, the same neighbors (engine/neighborhood.js)
  if (old.sports) handOverSports(old, next, { ancestorId: ancestor.id, heirId: h.id });
  // The people who work in the family's businesses are the same people: they carry on, outside the heir's own circle.
  for (const b of op.businesses ?? []) for (const x of [...(b.staff ?? []), ...(b.partners ?? [])]) if (old.npcs[x.id] && !npcs[x.id]) npcs[x.id] = old.npcs[x.id];
  const firmLines = carryCareers(old, next, h); // the family's working history, the same employers, and any business left to this heir

  // An heir who was living in another country carries on there.
  const abroad = typeof h.flags.abroad === 'string' && COUNTRIES[h.flags.abroad] ? h.flags.abroad : null;
  const moved = abroad && abroad !== op.countryId;
  if (moved) {
    player.countryId = abroad; // where they live now; where they were born does not change
    player.flags.arrivedYear = h.flags.movedYear ?? old.year;
    player.city = rng.pick(COUNTRIES[abroad].cities);
  }
  if (L.job && !h.flags.royal) takeOverJob(L.job, L.yearsWorked ?? 0);
  if (moved) {
    const rate = fxRate(COUNTRIES[op.countryId].currency.code, COUNTRIES[abroad].currency.code); // today's rate, as the estate was taxed
    convertMoney(rate);
    player.career.salary = Math.round(player.career.salary * rate);
    for (const n of Object.values(npcs)) {
      if (n.flags.abroad === abroad) n.flags.abroad = false;
      else if (!n.flags.abroad && n.role !== 'child' && n.role !== 'spouse' && n.role !== 'pet') n.flags.abroad = op.countryId;
    }
  }

  // The justice system is the same system: its records, its places and its people carry on.
  if (old.justice) {
    next.justice = old.justice;
    for (const id of old.justice.people) if (old.npcs[id] && !npcs[id]) npcs[id] = old.npcs[id];
  }
  // What the family had, and what became of it: a summary only. The private detail of an ancestor's accounts is not passed on.
  const grave = getGraveyard().find((g) => g.id === old.legacy?.graveId);
  const fromCur = COUNTRIES[op.countryId].currency.code;
  next.familyMoney = [...(old.familyMoney ?? []), {
    name: `${op.firstName} ${op.lastName}`, born: op.birthYear, died: old.year, graveId: grave?.id ?? null, generation: op.generation ?? 1, cur: fromCur,
    netWorth: grave?.estate?.gross ?? null, earned: Math.round(op.finance.lifetimeEarned), tax: grave?.estate?.tax ?? 0, charity: grave?.estate?.charity ?? 0,
    milestones: op.milestones.filter((m) => m.kind === 'money').map((m) => ({ age: m.age, text: m.text })),
    homes: op.assets.filter((a) => a.kind === 'property').map((a) => a.name),
    shares: (grave?.estate?.shares ?? []).map((s) => ({ name: s.name, role: s.role, amount: s.amount, items: s.items.map((it) => it.name), you: s.npcId === h.id })),
    outside: (grave?.estate?.outside ?? []).map((o) => ({ name: o.name, amount: o.amount, how: o.how, you: o.to === h.id })),
    businesses: (op.businesses ?? []).filter((b) => b.status === 'open' || b.status === 'family').map((b) => b.name),
  }];
  // The heir's own books open with what they really have: their savings, and their share of the estate, named as such.
  const share = grave?.estate?.shares?.find((s) => s.npcId === h.id)?.amount ?? 0;
  ledgerOf(next, { desc: `Your own savings, and what ${op.firstName} left you`,
    inheritance: Math.round(share * (moved ? fxRate(COUNTRIES[op.countryId].currency.code, COUNTRIES[abroad].currency.code) : 1)) });
  if (share > 0 || player.assets.length) player.milestones.push({ age: h.age, text: `Inherited from ${op.firstName}.`, kind: 'money' });
  carryTrust(old, next, h.id, `${op.firstName} ${op.lastName}`);
  carryTraditions(old, next, h.id); // the family's traditions go on with the family // a trust still being held for them stays held
  if (h.flags.moneySense) player.flags.moneySense = h.flags.moneySense; // what allowance taught them
  if (player.finance.lifetimeEarned > 0 || player.career.salary) player.flags.firstPay = true;

  // The schools of the world are the same schools: the next generation may sit in the same classrooms.
  passOn(old, next);
  // The eras carry on with the year: the heir's money is already in this year's terms.
  if (old.era) next.era = { ...old.era, applied: { year: old.year, countryId: next.player.countryId } };
  // The family's digital world carries on too: the dead player's accounts become their memorial and archive.
  carryOver(old, next, npcId, ancestor.id);
  if (old.schools) next.schools = old.schools;
  if (old.universities) next.universities = old.universities;
  if (player.education.enrolled && !PROGRAMS[player.education.stage]) ensureSchool();

  const c = COUNTRIES[player.countryId];
  next.journal.push(
    entry(`Your ${lost} ${op.firstName} has died. The story is yours now: you are ${h.firstName} ${h.lastName}, age ${h.age}, of ${player.city}, ${theCountry(c.name)}.`, 'bad'),
    entry(player.career.title ? `You work as ${/^[aeiou]/i.test(player.career.title) ? 'an' : 'a'} ${player.career.title.toLowerCase()}.`
      : player.education.enrolled ? 'You are still studying.' : h.age < 5 ? 'You are too young to understand what has happened.'
        : player.career.retired ? 'You are retired.' : 'You are not working at the moment.'),
  );
  if (atHome && !parentsAlive) next.journal.push(entry('With no parent left, relatives have taken you in.', 'bad'));
  if ((op.flags.offices ?? []).some((o) => o.tier >= 3) || (op.politics?.tier ?? 0) >= 3 || op.flags.politicalFamily) player.flags.politicalFamily = true;
  for (const l of firmLines) next.journal.push(entry(l, 'good'));
  leaveName(op, player);
  const crownLine = inheritStanding(old, h);
  if (crownLine) next.journal.push(entry(crownLine, 'good'));
  // An heir who was already in politics carries on from where they were.
  const officeLine = carryCareer(h);
  if (officeLine) next.journal.push(entry(officeLine, 'good'));
  ensureGlobal(next);
  return next;
}
