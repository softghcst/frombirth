// Checks the family's animals: one record each, kept for good; ownership, care
// and home kept apart; moments written once; the album, the timeline and the
// profiles; and the record crossing from one generation to the next.
// Run with: node tests/animals.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc, makePet } = await import('../js/engine/npcFactory.js');
const { tickRelationships, interact, canGetPet } = await import('../js/engine/relationships.js');
const { getPet } = await import('../js/engine/children.js');
const { applyEffects } = await import('../js/engine/effects.js');
const { getEvent, resolveChoice } = await import('../js/engine/eventEngine.js');
const { die } = await import('../js/engine/death.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { emigrate } = await import('../js/engine/emigration.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { addNpc, animalHealth } = await import('../js/data/events/helpers.js');
const { SPECIES, EVENT_TYPES, BREEDS } = await import('../js/data/animals.js');
const zoo = await import('../js/engine/animals.js');
const { createNav, backLabel } = await import('../js/ui/animalNav.js');
const { animalPortraitSvg } = await import('../js/ui/animalPortrait.js');

rng.seed(20261117);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const S = () => store.state;
const P = () => store.state.player;
const pets = () => P().npcIds.map((id) => S().npcs[id]).filter((n) => n?.role === 'pet');
const clean = (where) => { const bad = zoo.audit(); check(!bad.length, `${where}: the record is unsound: ${bad.join('; ')}`); };
const snap = (a) => JSON.stringify(a);

/** A life with (or without) animals in the family at birth, and parents alive. */
function born(withPets = true) {
  for (;;) {
    store.state = createLife({ countryId: 'us', city: 'Chicago' });
    if (P().royal) continue;
    if ((pets().length > 0) === withPets) return P();
  }
}
/** The same life, grown up and living alone, with money. */
function grown(age = 30, withPets = false) {
  const p = born(withPets);
  p.age = age; p.birthYear = S().year; S().year += age;
  for (const n of Object.values(S().npcs)) n.age += age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = 500000; p.finance.loans = [];
  zoo.reconcile();
  return p;
}
const adopt = () => { const before = pets().length; const r = getPet(); check(r.ok && pets().length === before + 1, `adopting should work: ${r.text}`); return zoo.animalById(pets().at(-1).id); };
const addKin = (role, age, extra = {}) => { const n = makeNpc({ role, countryId: P().countryId, age, lastName: P().lastName, ...extra }); S().npcs[n.id] = n; P().npcIds.push(n.id); return n; };
const lastOf = (type, id) => zoo.eventsOf(id).filter((e) => e.type === type).at(-1);

// ---------- 1. Identity: one record per animal, the same on every load ----------
let p = born(true);
let pet = pets()[0];
let a = zoo.animalById(pet.id);
check(!!a && a.id === pet.id && a.name === pet.firstName && !!SPECIES[a.speciesId], 'an animal in the family at birth is on the record, under its own id');
check(zoo.allAnimals().length === pets().length, 'one record for each animal, no more');
check(a.appearance.coat && Object.keys(a.temperament).length === SPECIES[a.speciesId].temperament.length, 'it has looks and a temperament of its own');
check(Object.values(a.temperament).every((v) => v >= 0 && v <= 100), 'temperament stays in range');
const before = snap(a);
check(zoo.register(pet) === a && snap(zoo.animalById(pet.id)) === before && zoo.allAnimals().length === pets().length, 'entering the same animal twice changes nothing');
zoo.reconcile(); zoo.reconcile();
check(snap(zoo.animalById(pet.id)) === before, 'bringing the record up to date twice changes nothing');
check(animalPortraitSvg(a) === animalPortraitSvg(JSON.parse(before)) && animalPortraitSvg(a).includes('<svg'), 'its portrait is drawn the same way every time');
{ // Same species and breed, different individuals.
  // (these are drawn and thrown away: the record is put back as it was afterwards)
  const keep = JSON.stringify(S().animals); const lines = JSON.stringify(S().journal);
  const temper = new Set(); const looks = new Set();
  for (let i = 0; i < 40; i++) { const n = makePet('us', 'Test'); n.species = 'dog'; const r = zoo.register(n, { origin: 'family' }); temper.add(snap(r.temperament)); looks.add(snap(r.appearance)); delete S().animals.byId[n.id]; }
  check(temper.size >= 38 && looks.size >= 10, `forty dogs are forty individuals (${temper.size} temperaments, ${looks.size} looks)`);
  const labs = []; for (let i = 0; i < 400 && labs.length < 12; i++) { const n = makePet('us', 'T'); n.species = 'dog'; const r = zoo.register(n, { origin: 'family' }); if (r.breedId === 'labrador') labs.push(r.temperament.sociability); delete S().animals.byId[n.id]; }
  check(labs.length >= 6 && Math.max(...labs) - Math.min(...labs) > 25, 'breed does not decide temperament');
  check(Object.values(BREEDS).every((list) => list.some((b) => b.mix)), 'every species with breeds has animals of no particular breed');
  S().animals = JSON.parse(keep); S().journal = JSON.parse(lines);
  a = zoo.animalById(pet.id);
}
clean('identity');
section('identity: one record per animal, looks and temperament of its own, stable');

// ---------- 2. Ownership, care and home are separate things ----------
const owner = zoo.ownerOf(a);
check(owner.id !== p.id && S().npcs[owner.id]?.role === 'parent', 'the family\'s animal belongs to a parent, not to the newborn');
check(zoo.primaryOf(a).id === owner.id && zoo.homeOf(a).hh === 'parents' && zoo.livesWithPlayer(a.id), 'a parent looks after it, in the family home, where the player also lives');
check(!zoo.caregiversOf(a).some((c) => c.who.id === p.id), 'a baby is not a caregiver');
check(zoo.bondOf(a, p.id) === pet.meters.relationship && zoo.bondOf(a, owner.id) != null && Object.keys(a.bonds).length >= 2, 'each person has their own bond with it');
const met = lastOf('met', a.id);
check(!!met && met.story && S().journal.some((j) => j.animal?.ev === met.id && j.text === met.story), 'the line in the life story that introduces it is tied to the moment on record');
// A child takes in a stray: the parent owns it, the child helps.
p = born(false); p.age = 9; S().year += 9;
let ctx = { cast: {} };
applyEffects([addNpc('pet', 'pet')], ctx);
a = zoo.animalById(ctx.cast.pet);
check(!!a && a.origin.how === 'found' && zoo.ownerOf(a).id !== p.id && zoo.primaryOf(a).id !== p.id, 'a child\'s stray is owned and mainly kept by a parent');
check(zoo.helpersOf(a).some((r) => r.id === p.id), 'the child is recorded as helping with its care');
check(zoo.familyLink(a).includes('partly yours'), `the album says whose it is (${zoo.familyLink(a)})`);
// An adult adopts: fee paid once, owner and caregiver are the adopter.
p = grown(30);
let cash = p.finance.cash;
a = adopt();
check(cash - p.finance.cash === a.origin.fee && a.origin.fee > 0 && a.origin.how === 'shelter', 'the adoption fee is taken once and recorded');
check(zoo.ownerOf(a).id === p.id && zoo.primaryOf(a).id === p.id && zoo.homeOf(a).hh === 'player', 'the adopter owns it, keeps it, and it lives with them');
const adopted = lastOf('adopted', a.id);
check(!!adopted && S().journal.at(-1).animal?.ev === adopted.id && adopted.people.some((r) => r.id === p.id), 'the adoption is a moment on record, told in the life story');
cash = p.finance.cash; zoo.register(S().npcs[a.id], { origin: 'shelter', fee: 999 }); zoo.reconcile();
check(p.finance.cash === cash && zoo.eventsOf(a.id).filter((e) => e.type === 'adopted').length === 1, 'nothing is charged or recorded twice');
// Someone joins the household and starts helping; the owner does not change.
const wife = addKin('spouse', 29);
zoo.reconcile();
check(zoo.helpersOf(a).some((r) => r.id === wife.id) && zoo.ownerOf(a).id === p.id && zoo.bondOf(a, wife.id) != null, 'a spouse helps with care and has a bond of their own; ownership is unchanged');
{ const hers = zoo.bondOf(a, wife.id); S().npcs[a.id].meters.relationship = 12; zoo.reconcile();
  check(zoo.bondOf(a, p.id) === 12 && zoo.bondOf(a, wife.id) === hers, 'one person\'s bond changing does not change another\'s'); }
clean('ownership');
section('ownership, caregiving and home are recorded separately');

// ---------- 3. Things done together: training, the vet ----------
p = grown(30);
do { a = adopt(); } while (a.speciesId !== 'dog' && canGetPet());
if (a.speciesId !== 'dog') { S().npcs[a.id].species = 'dog'; a.speciesId = 'dog'; }
pet = S().npcs[a.id];
check(zoo.animalActions(a.id).some((x) => x.id === 'train'), 'a dog can be trained');
check(!zoo.train(a.id, 'stepup').ok, 'a dog is not asked to do what a parrot does');
let r = zoo.train(a.id, 'sit');
const bond0 = pet.meters.relationship;
check(r.ok && a.training.sit.progress > 0 && a.training.sit.sessions === 1, 'a session makes progress');
check(!zoo.train(a.id, 'sit').ok && !zoo.train(a.id, 'come').ok && a.training.sit.sessions === 1, 'one session a year, however often it is asked for');
let years = 1;
while (a.training.sit.progress < 100 && years < 12) { p.age += 1; S().year += 1; zoo.train(a.id, 'sit'); years += 1; }
const learned = lastOf('trained', a.id);
check(a.training.sit.progress === 100 && a.training.sit.learnedYear === S().year && years >= 2, `learning takes more than one session (${years})`);
check(!!learned && learned.sig === 2 && S().journal.some((j) => j.animal?.ev === learned.id), 'the first lesson learned is a milestone, told in the life story');
check(!zoo.train(a.id, 'sit').ok && pet.meters.relationship >= bond0, 'what is learned stays learned; working together does not harm the bond');
p.age += 1; S().year += 1;
// The vet scene from the game, with the first choice (pay for the vet).
const vetScene = getEvent('pet_poorly');
cash = p.finance.cash;
const out = (() => { rng.seed(5); return resolveChoice(vetScene, 0, { pet: a.id }); })();
check(a.health.length === 1 && a.health[0].kind === 'vet' && a.health[0].cost > 0 && cash - p.finance.cash === a.health[0].cost, 'a vet visit is on the health record, and paid for once');
const rec = lastOf('recovery', a.id);
check(!!rec && a.health[0].eventId === rec.id && S().journal.at(-1).animal?.ev === rec.id && S().journal.at(-1).text === out.text, 'the recovery is a moment on record, tied to the line that tells it');
check(zoo.healthAccess(a.id) === 'full', 'the owner can read the health record');
applyEffects([animalHealth('pet', { kind: 'illness', note: 'x', recovered: true })], { cast: { pet: a.id } });
check(a.health.length === 2 && a.health[1].cost === 0 && zoo.eventsOf(a.id).filter((e) => e.type === 'recovery').length === 1, 'an illness that never reached a vet is a line in the record, not a milestone, and costs nothing');
clean('training and health');
section('training: species-appropriate, gradual, once a year; vet visits recorded and paid once');

// ---------- 4. Death: the profile is kept, and survives a reload ----------
const name = a.name; const id = a.id;
pet.age = pet.lifespan; rng.seed(7);
tickRelationships(); zoo.tickAnimals();
a = zoo.animalById(id);
check(!S().npcs[id].alive && a.status === 'deceased' && a.died === S().year && a.ageAtDeath === S().npcs[id].age, 'an animal that dies is recorded as having died, when, and how old');
const death = lastOf('died', id);
check(!!death && S().journal.filter((j) => j.animal?.ev === death.id).length === 1 && death.memories.some((m) => m.who.id === p.id), 'its death is told once in the life story, and remembered');
check(zoo.ownerOf(a) === null && zoo.primaryOf(a) === null && zoo.homeOf(a) === null && a.ownerships.length && a.homes.length, 'who owned it and where it lived are history now, not lost');
check(a.training.sit.progress === 100 && a.health.length === 2 && zoo.eventsOf(id).length >= 4, 'what it learned, its health record and its moments are all still there');
check(zoo.albumAnimals(S(), { show: 'remembered' }).some((x) => x.id === id) && !zoo.albumAnimals(S(), { show: 'living' }).some((x) => x.id === id), 'the album shows it among the remembered');
check(zoo.lifeDates(a).includes(String(a.died)) && !zoo.animalActions(id).length, 'the archived profile shows its dates and offers nothing that needs a living animal');
r = zoo.memorialize(id);
check(r.ok && a.memorial?.year === S().year && !zoo.memorialize(id).ok && zoo.eventsOf(id).filter((e) => e.type === 'memorial').length === 1, 'a memorial can be made, once');
const living = adopt();
const count = zoo.allAnimals().length; const events = S().animals.events.length;
const frozen = snap(S().animals);
check(saveGame(S()), 'the life saves');
store.state = loadGame(S().slotId);
check(snap(S().animals) === frozen && zoo.allAnimals().length === count && S().animals.events.length === events, 'a reload brings back the same record: no animal or moment lost, added or changed');
check(zoo.animalById(id).name === name && zoo.animalById(id).status === 'deceased' && zoo.animalById(living.id).status === 'living', 'the dead are still dead and the living still living');
check(S().journal.filter((j) => j.animal).every((j) => zoo.eventById(j.animal.ev)?.animalId === j.animal.id), 'every tied line in the life story still points at its moment');
tickRelationships(); zoo.tickAnimals(); zoo.tickAnimals();
check(zoo.eventsOf(id).filter((e) => e.type === 'died').length === 1, 'a death is not recorded again in later years');
clean('death and reload');
section('death: the profile, history and memories are kept, and survive a save and reload');

// ---------- 5. The household: leaving home, moving, a keeper dying ----------
p = born(true); p.age = 18; S().year += 18; for (const n of Object.values(S().npcs)) n.age = Math.min(n.age + 3, (n.lifespan ?? 99) - 2);
zoo.reconcile();
a = zoo.animalById(pets()[0].id);
p.flags.livesWithParents = false; zoo.reconcile();
check(zoo.homeOf(a).hh === 'parents' && !zoo.livesWithPlayer(a.id) && zoo.ownerOf(a).id !== p.id, 'the family\'s animal stays in the family home when the player moves out');
check(!!lastOf('stayed', a.id) && S().npcs[a.id]?.alive && !zoo.householdAnimals().length, 'that is a moment on record; the animal is still in the player\'s life, not in their household');
zoo.reconcile();
check(zoo.eventsOf(a.id).filter((e) => e.type === 'stayed').length === 1, 'and it is recorded once');
check(zoo.healthAccess(a.id) === 'summary' || zoo.caregiversOf(a).some((c) => c.who.id === p.id), 'someone who never looked after it sees only a summary of its health');
// The owner dies: care passes to someone who can take it, and the animal is never without a keeper.
const first = zoo.ownerOf(a);
S().npcs[first.id].alive = false; zoo.reconcile();
const second = zoo.ownerOf(a);
check(!!second && second.id !== first.id && zoo.primaryOf(a).id === second.id && a.ownerships.length === 2 && a.ownerships[0].to === S().year, `care passes on when the owner dies (to ${second?.name})`);
check(!!lastOf('care', a.id) && lastOf('care', a.id).people.some((x) => x.id === first.id), 'the hand-over is a moment on record, naming both people');
for (const n of Object.values(S().npcs)) if (n.role !== 'pet') n.alive = false;
p.age = 12; zoo.reconcile(); // nobody left who could take it, and the player is a child
check(a.status === 'living' && zoo.ownerOf(a)?.name === 'a rescue organisation' && !S().npcs[a.id] && !a.inCircle && !!lastOf('rehomed', a.id), 'with nobody to take it, it is rehomed through a rescue: gone from the player\'s life, kept on the record');
check(zoo.albumAnimals().some((x) => x.id === a.id) && zoo.eventsOf(a.id).length >= 4, 'it is still in the album, with its history');
const gone = a; gone.born = S().year - 1; gone.lifespan = Math.max(gone.lifespan, 3); const until = gone.born + gone.lifespan;
while (S().year < until) { S().year += 1; zoo.tickAnimals(); }
check(gone.status === 'deceased' && gone.died === until && zoo.eventsOf(gone.id).filter((e) => e.type === 'died').length === 1, 'an animal that left the family still grows old and dies where it is, once');
clean('household');
// Moving house and country with one's own animal.
p = grown(35); a = adopt();
p.city = 'Boston'; zoo.reconcile();
check(zoo.homeOf(a).city === 'Boston' && a.homes.length === 2 && lastOf('moved', a.id)?.sig === 2, 'an animal moves city with its household, and the old home is kept as history');
cash = p.finance.cash; rng.seed(11);
const went = emigrate('ca', { forced: true });
zoo.reconcile();
check(went.ok && zoo.homeOf(a).countryId === 'ca' && lastOf('moved', a.id).sig === 3 && S().npcs[a.id].flags.abroad !== 'us', 'it comes abroad with the household');
check(a.id === pets()[0].id && zoo.allAnimals().length === 1 && a.homes.length === 3, 'the same animal, not a new one, with three homes on record');
p = born(true); p.age = 25; S().year += 25; p.finance.cash = 1e6; for (const n of Object.values(S().npcs)) if (n.role === 'pet') n.age = 3;
zoo.reconcile(); p.flags.livesWithParents = false; zoo.reconcile();
a = zoo.animalById(pets()[0].id);
emigrate('ca', { forced: true }); zoo.reconcile();
check(S().npcs[a.id].flags.abroad === 'us' && zoo.homeOf(a).countryId === 'us' && zoo.homeOf(a).hh === 'parents', 'the family\'s animal does not emigrate with a grown child: it stays with its owner');
clean('moving');
section('household: staying behind, moving, care passing on, rehoming; never without a keeper');

// ---------- 6. Across generations ----------
p = grown(60);
const spouse = addKin('spouse', 58);
const son = addKin('child', 32, { gender: 'male' }); son.parentIds = [spouse.id];
const old = adopt(); const oldNpc = S().npcs[old.id];
const young = adopt(); const mine = adopt();
zoo.train(mine.id, zoo.trainingOf(mine)[0]?.id ?? 'x');
oldNpc.age = oldNpc.lifespan; rng.seed(3); tickRelationships(); zoo.tickAnimals();
check(zoo.animalById(old.id).status === 'deceased', 'setup: one animal has died');
// The son already looks after one of them; the other is closest to the spouse.
zoo.animalById(mine.id).care.push({ who: { id: son.id, name: `${son.firstName} ${son.lastName}` }, role: 'helper', from: S().year, to: null });
zoo.animalById(mine.id).bonds[son.id] = { name: `${son.firstName} ${son.lastName}`, value: 91 };
for (const c of zoo.animalById(mine.id).care) if (c.who.id === spouse.id) c.to = S().year;
const was = { ids: zoo.allAnimals().map((x) => x.id).sort(), events: S().animals.events.length, oldSnap: snap({ ...zoo.animalById(old.id) }), playerId: p.id, playerName: `${p.firstName} ${p.lastName}`,
  gen: p.generation ?? 1, bondSon: zoo.bondOf(zoo.animalById(mine.id), son.id), bondSpouse: zoo.bondOf(zoo.animalById(young.id), spouse.id), stories: zoo.storyOfGeneration(p.generation ?? 1).length };
die('old age');
check(zoo.ownerOf(zoo.animalById(young.id)).id === spouse.id && zoo.ownerOf(zoo.animalById(mine.id)).id === son.id, 'when the player dies, each living animal gets a keeper: one stays with the spouse, one goes to the son who already helped');
check(!zoo.audit().length, `the record is sound at the moment of death: ${zoo.audit().join('; ')}`);
check(heirs().some((n) => n.id === son.id), 'setup: the son can carry on');
const next = continueAs(son.id);
store.state = next; p = P();
check(!!next && snap(zoo.allAnimals().map((x) => x.id).sort()) === snap(was.ids), 'switching generations loses no animal and adds none');
check(S().animals.events.length >= was.events && new Set(S().animals.events.map((e) => e.id)).size === S().animals.events.length, 'no moment is lost or repeated');
const ancestor = Object.values(S().npcs).find((n) => !n.alive && n.firstName === was.playerName.split(' ')[0] && n.role === 'parent');
const gOld = zoo.animalById(old.id); const gYoung = zoo.animalById(young.id); const gMine = zoo.animalById(mine.id);
check(!!ancestor && gOld.status === 'deceased' && !S().npcs[old.id] && gOld.ownerships[0].who.id === ancestor.id && gOld.ownerships[0].who.name === was.playerName, 'the animal that died keeps its profile; its owner is now the heir\'s late parent');
check(gOld.ageAtDeath === JSON.parse(was.oldSnap).ageAtDeath && gOld.died === JSON.parse(was.oldSnap).died && snap(gOld.appearance) === snap(JSON.parse(was.oldSnap).appearance), 'its dates and looks are unchanged');
check(zoo.eventsOf(old.id).every((e) => e.gen === was.gen && e.narrator.id === ancestor.id) && zoo.storyOfGeneration(was.gen).length === was.stories, 'its moments still belong to the life they were lived in, and the lines that told them are kept');
check(zoo.eventsOf(old.id).some((e) => e.memories.some((m) => m.who.id === ancestor.id)), 'what the parent remembered is still theirs');
check(zoo.ownerOf(gMine).id === p.id && S().npcs[mine.id]?.role === 'pet' && zoo.livesWithPlayer(mine.id) && S().npcs[mine.id].meters.relationship === was.bondSon && zoo.bondOf(gMine, p.id) === was.bondSon, 'the animal that came to the heir is theirs now, with the bond they already had');
check(zoo.ownerOf(gYoung).id === spouse.id && S().npcs[young.id]?.role === 'pet' && !zoo.livesWithPlayer(young.id) && zoo.bondOf(gYoung, spouse.id) === was.bondSpouse, 'the animal that stayed with the surviving parent is not handed to the heir: it is still theirs, and still in the heir\'s life');
check(gMine.ownerships.length === 2 && gMine.ownerships[0].who.id === ancestor.id && gMine.ownerships[0].to != null && gMine.training && Object.keys(gMine.training).length === 1, 'ownership, care and training history cross over intact');
check(zoo.familyLink(gOld).includes(ancestor.firstName) && zoo.healthAccess(old.id) === 'summary' && zoo.healthAccess(mine.id) === 'full', `a descendant sees whose animal it was (${zoo.familyLink(gOld)}), and only a summary of health records that were never theirs`);
check(zoo.storyIndex(zoo.eventsOf(old.id)[0].id) === -1, 'moments from the earlier life are read from that life\'s story, not the heir\'s');
clean('after the generation changed');
for (let i = 0; i < 3; i++) { S().year += 1; p.age += 1; tickRelationships(); zoo.tickAnimals(); }
clean('three years into the next life');
check(snap(zoo.allAnimals().map((x) => x.id).sort()) === snap(was.ids), 'and still nobody has been lost');
// Nobody to take it: rehomed, still on the record, and the heir's life starts without it.
p = grown(70); for (const n of Object.values(S().npcs)) n.alive = false;
const kid = addKin('child', 9); const orphan = adopt();
die('old age');
check(zoo.ownerOf(zoo.animalById(orphan.id))?.name === 'a rescue organisation', 'with no adult in the family, the animal is rehomed when its owner dies');
store.state = continueAs(kid.id);
check(!!S() && zoo.animalById(orphan.id)?.status === 'living' && !S().npcs[orphan.id] && zoo.albumAnimals().some((x) => x.id === orphan.id), 'it is not in the child\'s life, and it is still in the family album');
clean('rehomed across a generation');
section('generations: no animal, keeper, bond, moment or memory is lost; animals are not handed to the heir by default');

// ---------- 7. The album and the timeline ----------
store.state = next; p = P();
const album = zoo.albumAnimals();
check(album.length === was.ids.length && album.every((x) => S().animals.byId[x.id] === x), 'every animal in the album is a saved animal, by id');
check(album.findIndex((x) => x.status !== 'living') >= album.filter((x) => x.status === 'living').length, 'the living come first, then the remembered');
const shownLiving = zoo.albumAnimals(S(), { show: 'living' }); const shownGone = zoo.albumAnimals(S(), { show: 'remembered' });
check(shownLiving.every((x) => x.status === 'living') && shownGone.every((x) => x.status === 'deceased') && shownLiving.length + shownGone.length === album.length, 'living and remembered are told apart correctly');
check(zoo.albumAnimals(S(), { species: gOld.speciesId }).every((x) => x.speciesId === gOld.speciesId), 'the album can be filtered by kind');
for (const x of album) {
  check(zoo.caregiversOf(x).length > 0 && zoo.caregiversOf(x).every((c) => c.who.name), `${x.name}: its caregivers are named`);
  check(zoo.familyLink(x).length > 0 && zoo.lifeDates(x).length > 0 && zoo.describeLooks(x).length >= 3 && zoo.temperamentWords(x).length === Math.min(3, Object.keys(x.temperament).length), `${x.name}: the card has what it needs`);
  check(zoo.caregiversOf(x).filter((c) => c.known).every((c) => c.who.id === p.id || S().npcs[c.who.id]), `${x.name}: a caregiver shown as someone to open is someone in the player's life`);
}
const line = zoo.timeline();
check(line.length === S().animals.events.length && line.every((e, i) => i === 0 || line[i - 1].year <= e.year), 'the timeline is every moment on record, in order');
check(line.every((e) => zoo.animalById(e.animalId) && EVENT_TYPES[e.type] && e.text && e.narrator?.name), 'every moment names a saved animal, is of a known kind, and says whose life it was in');
check(zoo.timeline(S(), { type: 'died' }).every((e) => e.type === 'died') && zoo.timeline(S(), { animalId: old.id }).every((e) => e.animalId === old.id) && zoo.timeline(S(), { animalId: old.id }).length === zoo.eventsOf(old.id).length, 'the timeline can be filtered by kind and by animal');
check(line.filter((e) => e.story && e.gen === (p.generation ?? 1)).every((e) => zoo.storyIndex(e.id) >= 0), 'moments from this life can be found in this life\'s story');
check(new Set(line.map((e) => e.k)).size === line.length, 'no moment appears twice');
const key = zoo.playerHome().key;
check(zoo.houseChronicle(key).every((e) => e.home === key) && zoo.householdAnimals().every((x) => zoo.homeOf(x).key === key), 'the chronicle of a house holds what happened under that roof');
section('album and timeline: saved animals only, living and remembered, moments from the record');

// ---------- 8. Finding one's way: every way in opens the right animal, and back restores the screen ----------
for (const x of album) check(zoo.animalById(x.id) === x && (!S().npcs[x.id] || S().npcs[x.id].firstName === x.name), `${x.name}: its id opens its own profile`);
const nav = createNav();
nav.open('archive');
nav.open('album', {}, { tab: 'timeline' });
nav.remember({ type: 'died', animal: old.id, open: 'ae_3', scroll: 412 });
nav.open('profile', { animalId: old.id }, { tab: 'overview' });
nav.remember({ tab: 'memories', open: 'ae_7', scroll: 96 });
nav.open('chronicle', { key });
check(nav.depth() === 4 && nav.top().screen === 'chronicle' && backLabel(nav.under(), (i) => zoo.animalById(i)?.name) === `Back to ${gOld.name}`, 'the way back names where it leads');
let back = nav.back();
check(back.screen === 'profile' && back.params.animalId === old.id && back.ui.tab === 'memories' && back.ui.open === 'ae_7' && back.ui.scroll === 96, 'going back returns to the same animal, tab, open memory and place on the page');
// Leaving for a person's profile or the life story does not disturb where one was.
nav.remember({ scroll: 140 }); const kept = snap(nav.top());
check(snap(nav.top()) === kept, 'leaving for a person\'s profile or the life story keeps the place');
back = nav.back();
check(back.screen === 'album' && back.ui.tab === 'timeline' && back.ui.type === 'died' && back.ui.animal === old.id && back.ui.open === 'ae_3' && back.ui.scroll === 412, 'and back again returns to the album as it was left: view, filters, open moment, scroll');
check(nav.back().screen === 'archive' && nav.back() === null && nav.depth() === 0 && backLabel(nav.under()) === 'Close', 'the road ends where it began');
section('navigation: ids open the right profile; going back restores the screen as it was left');

// ---------- 9. Lives saved before the record existed ----------
p = grown(40);
const legacyLive = makePet('us', p.lastName, 80); const legacyDead = makePet('us', p.lastName, 60);
legacyDead.alive = false; legacyDead.age = 11;
for (const n of [legacyLive, legacyDead]) { S().npcs[n.id] = n; p.npcIds.push(n.id); }
delete S().animals; for (const j of S().journal) delete j.animal;
saveGame(S());
const raw = JSON.parse(disk.get(`pathways.slot.${S().slotId}`)); delete raw.animals; disk.set(`pathways.slot.${S().slotId}`, JSON.stringify(raw));
store.state = loadGame(S().slotId); p = P();
const m1 = zoo.animalById(legacyLive.id); const m2 = zoo.animalById(legacyDead.id);
check(!!m1 && !!m2 && zoo.allAnimals().length === 2, 'an old save loads, and each animal in it is entered once');
check(m1.name === legacyLive.firstName && m1.status === 'living' && zoo.ageOf(m1) === legacyLive.age && zoo.bondOf(m1, p.id) === 80 && zoo.ownerOf(m1).id === p.id, 'names, ages, bonds and ownership carry over');
check(m2.status === 'deceased' && m2.ageAtDeath === 11 && m2.died === null && zoo.lifeDates(m2).includes('not recorded'), 'an animal that had already died keeps its place, with no date invented for it');
check(!S().animals.events.length && m1.origin.how === 'unknown' && !m1.health.length && !Object.keys(m1.training).length && zoo.breedLabel(m1) !== 'Golden Retriever', 'no adoption, vet visit, training or pedigree is made up for them');
saveGame(S()); store.state = loadGame(S().slotId);
check(zoo.allAnimals().length === 2 && !S().animals.events.length, 'loading again adds nothing');
clean('an old save');
section('old saves: animals carried over once, with nothing invented');

// ---------- 10. Whole lives, year by year ----------
let lives = 0; let seen = 0; let moments = 0; let switches = 0;
for (let i = 0; i < 6; i++) {
  rng.seed(900 + i);
  store.state = createLife({ countryId: ['us', 'gb', 'jp', 'br', 'de', 'in'][i] });
  let ids = new Set(zoo.allAnimals().map((x) => x.id));
  for (let y = 0; y < 170; y++) {
    advanceYear();
    while (S().pendingEvents.length) { const pe = S().pendingEvents.shift(); const ev = getEvent(pe.id); if (ev && P().alive) resolveChoice(ev, 0, pe.cast); }
    if (!P().alive) {
      const heir = heirs()[0];
      if (!heir) break;
      const before6 = zoo.allAnimals().length;
      store.state = continueAs(heir.id); switches += 1;
      check(zoo.allAnimals().length === before6, `life ${i}: a generation change lost or added an animal`);
    }
    const pl = P();
    // Somebody to carry on as, so the record is carried across generations too.
    if (pl.age === 30 && !heirs().length) { const c = addKin('child', 1); c.parentIds = []; }
    if (pl.age >= 18 && canGetPet() && rng.chance(0.25)) { pl.finance.cash += 5000; getPet(); }
    for (const n of pets().filter((x) => x.alive)) { if (rng.chance(0.5)) interact(n.id, 'spendTime'); const t = zoo.trainingOf(zoo.animalById(n.id)).find((s) => s.progress < 100); if (t && rng.chance(0.5)) zoo.train(n.id, t.id); }
    const bad = zoo.audit();
    if (bad.length) { check(false, `life ${i}, year ${S().year}: ${bad.join('; ')}`); break; }
    const now = new Set(zoo.allAnimals().map((x) => x.id));
    if (![...ids].every((x) => now.has(x))) { check(false, `life ${i}, year ${S().year}: an animal vanished from the record`); break; }
    ids = now;
  }
  lives += 1; seen += zoo.allAnimals().length; moments += S().animals.events.length;
  check(zoo.allAnimals().every((x) => x.status !== 'living' || zoo.ownerOf(x)), `life ${i}: a living animal has no owner`);
  check(new Set(S().animals.events.map((e) => e.k)).size === S().animals.events.length, `life ${i}: a moment was recorded twice`);
}
check(seen >= 12 && moments >= 30 && switches >= 2, `the long run saw enough to mean something (${seen} animals, ${moments} moments, ${switches} generation changes)`);
section(`whole lives: ${lives} families, ${seen} animals, ${moments} moments, ${switches} generation changes, the record sound every year`);

for (const line2 of ok) console.log(`ok   ${line2}`);
if (problems.length) {
  for (const x of problems) console.log(`FAIL ${x}`);
  process.exit(1);
}
console.log('The family\'s animals are all accounted for.');
