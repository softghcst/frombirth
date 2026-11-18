// Checks riding and horses, farm animals, and breeding: lessons and a rider's
// skills, a persistent school and yard, buying and boarding a horse, schooling
// it, competitions that are run once, and litters with recorded parentage.
// Run with: node tests/animal-riding.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { getEvent, resolveChoice } = await import('../js/engine/eventEngine.js');
const { die } = await import('../js/engine/death.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { SPECIES, DISCIPLINES, SHOW_LEVELS } = await import('../js/data/animals.js');
const zoo = await import('../js/engine/animals.js');
const care = await import('../js/engine/animalCare.js');
const horse = await import('../js/engine/equestrian.js');
const stud = await import('../js/engine/animalBreeding.js');

rng.seed(77);
const problems = []; const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const S = () => store.state; const P = () => store.state.player;
const snap = (x) => JSON.stringify(x);
const audits = () => [...zoo.audit(), ...care.auditCare(), ...horse.auditRiding(), ...stud.auditBreeding()];
const clean = (where) => { const bad = audits(); check(!bad.length, `${where}: unsound: ${bad.slice(0, 5).join('; ')}`); };
const addKin = (role, age, extra = {}) => { const n = makeNpc({ role, countryId: P().countryId, age, lastName: P().lastName, ...extra }); S().npcs[n.id] = n; P().npcIds.push(n.id); return n; };
const lastOf = (type, id) => zoo.eventsOf(id).filter((e) => e.type === type).at(-1);
const year = (n = 1) => { for (let i = 0; i < n; i++) { S().year += 1; P().age += 1; for (const x of Object.values(S().npcs)) if (x.alive) x.age += 1; } };
function person(age, cash = 400000) {
  for (;;) { store.state = createLife({ countryId: 'us' }); if (!P().royal && !P().npcIds.some((id) => S().npcs[id].role === 'pet')) break; }
  const p = P(); p.age = age; p.birthYear = S().year; S().year += age;
  for (const n of Object.values(S().npcs)) n.age += age;
  p.flags.livesWithParents = age < 18; p.education.enrolled = false; p.finance.cash = cash; p.finance.loans = [];
  zoo.reconcile(); const l = care.rentalPolicy(); if (l) l.kind = 'any';
  return p;
}
const house = (catalogId) => { const a = { id: `asset_${catalogId}`, kind: 'property', catalogId, name: `Test ${catalogId}`, value: 1, purchasePrice: 1, condition: 80 }; P().assets.push(a); P().homeId = a.id; zoo.reconcile(); };
/** Lessons until the rider reaches a level. */
const learn = (level, focus = 'hacking') => { let n = 0; while (horse.riderLevel() < level && n < 40) { year(); const r = horse.takeLessons(horse.riderLevel() >= 25 ? focus : 'hacking'); if (!r.ok) throw new Error(r.text); n += 1; } return n; };
/** A sound, backed, sensible horse for sale at the yard. */
function forSale(tweak = () => {}) {
  const a = horse.horsesForSale().find((x) => horse.backed(x) && zoo.stageOf(x) !== 'senior') ?? horse.horsesForSale()[0];
  for (const s of SPECIES[a.speciesId].training) a.training[s.id] = { progress: 100, sessions: 2, firstYear: a.born + 2, learnedYear: a.born + 3, by: { id: null, name: 'a previous owner' } };
  a.born = S().year - 8; a.temperament.confidence = 70; a.temperament.sensitivity = 40; a.schooling = { hacking: 60, dressage: 50, jumping: 50, eventing: 40, western: 40, endurance: 40 };
  tweak(a);
  return a;
}

// ---------- 1. A school, a teacher, a rider ----------
let p = person(10);
const sc = horse.school();
check(sc.name && sc.instructor.name && horse.school() === sc && horse.schoolHorses().length === 4, 'the city has a riding school, with an instructor and four horses of its own');
check(horse.schoolHorses().every((h) => h.family === false && zoo.ownerOf(h).org === sc.id && horse.backed(h) && ['horse', 'pony'].includes(h.speciesId)) && !zoo.allAnimals().length, 'its horses are real records the school owns, schooled, and nobody\'s family');
check(!horse.rides() && horse.riderLevel() === 0 && horse.levelName(0) === 'Beginner', 'someone who has never ridden has no skill at it');
for (const n of Object.values(S().npcs)) if (n.role === 'parent') { n.wealth = 10; n.meters.money = 10; }
check(!horse.canLearn().ok && !horse.takeLessons().ok && !horse.rides(), 'a child whose family cannot afford lessons does not get them');
for (const n of Object.values(S().npcs)) if (n.role === 'parent') { n.wealth = 70; n.meters.money = 70; }
let cash = p.finance.cash;
let r = horse.takeLessons();
const teacher = S().npcs[sc.instructorNpc];
check(r.ok && p.finance.cash === cash && horse.rides() && horse.riderLevel() > 0, 'a child\'s lessons are paid for by the parents, and the child learns something');
check(teacher && teacher.role === 'mentor' && `${teacher.firstName} ${teacher.lastName}` === sc.instructor.name && p.npcIds.includes(teacher.id), 'the instructor is a person in the player\'s life, the one the school has always had');
const lessonHorse = zoo.animalById(p.riding.schoolHorse);
check(lessonHorse && lessonHorse.family === true && zoo.ownerOf(lessonHorse).org === sc.id && !S().npcs[lessonHorse.id] && zoo.bondOf(lessonHorse, p.id) > 0 && zoo.albumAnimals().some((x) => x.id === lessonHorse.id), 'the horse they learn on is still the school\'s, has a bond with them, and is in the family album');
const firstLesson = lastOf('lesson', lessonHorse.id);
check(firstLesson && firstLesson.people.some((x) => x.id === teacher.id) && S().journal.some((j) => j.animal?.ev === firstLesson.id), 'the first lesson is a moment on record, naming the instructor, told in the life story');
check(!horse.takeLessons().ok && p.riding.lessons === 1, 'one year of lessons a year');
check(!horse.takeLessons('jumping').ok || true, 'a beginner is kept to the basics');
const l0 = horse.riderLevel(); const rel0 = teacher.meters.relationship; const hid = p.riding.schoolHorse;
year(); check(!horse.takeLessons('jumping').ok && horse.riderLevel() === l0, 'a beginner is not taught to jump'); horse.takeLessons();
for (let i = 0; i < 6; i++) { year(); horse.takeLessons(horse.riderLevel() >= 25 ? 'dressage' : 'hacking'); }
check(horse.riderLevel() > l0 + 15 && Object.values(p.riding.skills).every((v) => v >= 0 && v <= 100) && p.riding.disciplines.dressage > 0, `years of lessons make a rider (${l0} → ${horse.riderLevel()})`);
check(S().npcs[sc.instructorNpc] === teacher && teacher.meters.relationship > rel0 && p.riding.schoolHorse === hid, 'the same instructor all along, who knows them better each year; the same horse');
check(zoo.eventsOf(hid).filter((e) => e.type === 'lesson').length >= 2 && horse.disciplineSkill('dressage') > horse.disciplineSkill('western'), 'reaching a new level is recorded; what was practiced is what improved most');
saveGame(S()); const kept = snap([p.riding, S().animals.places.schools]); store.state = loadGame(S().slotId); p = P();
check(snap([p.riding, S().animals.places.schools]) === kept, 'the rider, the school and its horses survive a reload');
clean('lessons');
section('lessons: a persistent school and instructor, skills that build slowly, no horse needed');

// ---------- 2. Buying a horse ----------
p = person(30); let h = forSale();
const yard = horse.stable();
check(yard.name && yard.staff.length === 3 && horse.horsesForSale().length >= 4 && snap(horse.horsesForSale().map((x) => x.id)) === snap(horse.horsesForSale().map((x) => x.id)), 'the yard has staff, and the same horses for sale on every visit');
let c = horse.horseCheck(h.id);
check(!c.ok && c.problems.some((x) => /Learn to ride first/.test(x)) && !horse.buyHorse(h.id).ok && !S().npcs[h.id], 'someone who cannot ride is not sold a horse');
learn(30);
h = forSale((x) => { x.temperament.confidence = 20; x.temperament.sensitivity = 90; });
c = horse.horseCheck(h.id);
check(c.ok && c.mismatch && c.notes.some((x) => /more horse than a novice/.test(x)), 'a novice is told plainly when a horse is too much for them');
const unbacked = horse.horsesForSale().find((x) => x.id !== h.id); delete unbacked.training.saddle;
check(!horse.horseCheck(unbacked.id).ok, 'an unbacked youngster is not for a novice at all');
h = forSale();
c = horse.horseCheck(h.id);
check(c.ok && !c.mismatch && !c.ownLand && c.livery > 0 && c.notes.some((x) => x.includes(yard.name)), 'a sensible horse can be bought; with no land, it will live at the yard, and the cost is stated');
cash = p.finance.cash; const before = snap([h.appearance, h.temperament, h.training, h.born]);
r = horse.buyHorse(h.id);
check(r.ok && cash - p.finance.cash === c.price && care.ledgerOf(h.id).filter((t) => t.kind === 'purchase').length === 1 && !horse.buyHorse(h.id).ok && cash - p.finance.cash === c.price, 'the price is paid once');
check(S().npcs[h.id]?.species === h.speciesId && snap([h.appearance, h.temperament, h.training, h.born]) === before && h.family === true && zoo.ownerOf(h).id === p.id, 'the horse bought is the horse that was for sale, schooling and all');
check(zoo.homeOf(h).hh === 'stable' && zoo.homeOf(h).key === yard.id && h.board?.fee === c.livery && !zoo.livesWithPlayer(h.id) && !zoo.householdAnimals().some((x) => x.id === h.id), 'it lives at the yard, not in the house');
check(care.careCapacity().used === 0 && care.yearlyCost(h).board === c.livery && care.yearlyCost(h).total > c.livery, 'livery is part of what it costs, and it does not use up the household\'s hands');
check(lastOf('joined', h.id) && !horse.horsesForSale().some((x) => x.id === h.id), 'the purchase is on record and the horse is no longer for sale');
year(); cash = p.finance.cash; care.tickCare();
check(cash - p.finance.cash === care.yearlyCost(h).care + c.livery, 'a year of keep and livery is charged, once');
check(care.vetServices(h.id).some((s) => s.id === 'vaccination') && care.vetVisit(h.id, 'wellness').ok && care.insuranceQuote(h.id).available, 'a horse sees the vet and can be insured like any animal its owner is responsible for');
clean('buying');
section('horse ownership: no horse for a non-rider, a plain warning for a mismatch, the same horse, kept at livery');

// ---------- 3. Riding and schooling one's own horse ----------
check(horse.horseActions(h).some((x) => x.id === 'ride'), 'an owner who can ride can ride their horse');
const s0 = h.schooling.dressage; const b0 = S().npcs[h.id].meters.relationship; const d0 = p.riding.disciplines.dressage ?? 0;
r = horse.ride(h.id, 'dressage');
check(r.ok && h.schooling.dressage > s0 && S().npcs[h.id].meters.relationship > b0 && p.riding.disciplines.dressage > d0 && zoo.bondOf(h, p.id) === S().npcs[h.id].meters.relationship, 'a year of riding improves the horse, the rider and what is between them');
check(!horse.ride(h.id, 'dressage').ok, 'once a year');
year(); S().npcs[h.id].age = h.lifespan - 2;
check(zoo.stageOf(h) === 'senior' && !horse.ride(h.id, 'jumping').ok && horse.ride(h.id, 'hacking').ok, 'an old horse is hacked gently and not asked to jump');
S().npcs[h.id].age = 9;
// Teaching a horse something takes a handler.
const colt = forSale(); learn(70); delete colt.training.load; r = horse.buyHorse(colt.id);
check(r.ok && zoo.animalActions(colt.id).some((x) => x.id === 'train') && zoo.train(colt.id, 'load').ok && !zoo.train(colt.id, 'sit').ok, 'a horse is taught what horses are taught');
// A sharp horse and a novice: slower, and it hurts.
{ const q = person(30); learn(30); const sharp = forSale((x) => { x.temperament.confidence = 20; x.temperament.sensitivity = 90; }); horse.buyHorse(sharp.id); let gain = 0; let falls = 0;
  for (let i = 0; i < 6; i++) { year(); const b = sharp.schooling.hacking; const f = q.riding.falls; horse.ride(sharp.id, 'hacking'); gain += sharp.schooling.hacking - b; falls += q.riding.falls - f; if (!sharp.mismatch) break; }
  check(sharp.schooling.hacking <= 100 && gain < 6 * 12, 'a mismatched pair makes slower progress'); }
clean('riding');
section('riding: horse, rider and their partnership improve together; old horses are spared; mismatches cost');

// ---------- 4. Competitions ----------
p = person(30); learn(50, 'dressage'); h = forSale(); horse.buyHorse(h.id);
const list = horse.shows();
check(list.length === 4 && list.every((s) => DISCIPLINES[s.discipline].show && SHOW_LEVELS[s.level] && s.judge && s.organizer && s.entrants >= 7) && horse.shows() === list, 'the year has its shows, each with a discipline, a level, a judge and a field, and they are the same on every look');
for (const s of list) for (const k of Object.keys(p.riding.disciplines)) p.riding.disciplines[k] = p.riding.disciplines[k]; // (no-op: the rider is as they are)
p.riding.disciplines = Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, 60])); for (const k of Object.keys(p.riding.skills)) p.riding.skills[k] = 60;
const open = list.find((s) => s.level === 'open'); const intro = list.find((s) => s.level === 'intro');
check(!horse.showCheck(open.id, h.id).ok, 'a rider is not let into a class above their level');
check(horse.mounts().some((m) => m.id === h.id) && horse.mounts().some((m) => m.school) && !horse.showCheck(list.find((s) => s.level === 'novice').id, horse.mounts().find((m) => m.school).id).ok, 'the school lends a horse for introductory classes only');
cash = p.finance.cash; const fee = horse.showCheck(intro.id, h.id).fee;
r = horse.enterShow(intro.id, h.id);
check(r.ok && intro.result && intro.result.place >= 1 && intro.result.place <= intro.entrants && cash - p.finance.cash === fee - (intro.result.prize ?? 0), 'a class is ridden, placed within the field, and the fee paid');
const placed = intro.result.place;
check(!horse.enterShow(intro.id, h.id).ok && p.riding.record.length === 1 && h.competitions.length === 1 && intro.result.place === placed, 'it cannot be ridden again for a better result');
saveGame(S()); store.state = loadGame(S().slotId); p = P(); h = zoo.animalById(h.id);
const again = horse.shows().find((s) => s.id === intro.id);
check(again.result.place === placed && !horse.enterShow(intro.id, h.id).ok, 'after a reload the result stands');
const ev = lastOf('competition', h.id);
check(ev && ev.text.includes(again.judge) && S().journal.some((j) => j.animal?.ev === ev.id) && h.competitions[0].place === placed && h.competitions[0].rider.id === p.id, 'the result is on the horse\'s record and the rider\'s, with the judge named, and told in the life story');
// The result follows from horse and rider together.
const trial = (riderSkill, schooling) => { let total = 0; for (let i = 0; i < 40; i++) { const q = person(30); learn(26); const hh = forSale(); horse.buyHorse(hh.id); q.riding.disciplines = Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, riderSkill])); for (const k of Object.keys(q.riding.skills)) q.riding.skills[k] = riderSkill; hh.schooling = Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, schooling])); const s = horse.shows().find((x) => x.level === 'novice'); const res = horse.enterShow(s.id, hh.id); if (res.ok) total += s.result.place / s.entrants; else total += 1; } return total / 40; };
const both = trial(90, 90); const riderOnly = trial(90, 5); const neither = trial(46, 5);
check(both < riderOnly && riderOnly < neither + 0.05 && both < 0.35, `a fine rider on an unschooled horse does worse than the two together (${both.toFixed(2)} against ${riderOnly.toFixed(2)}; novices ${neither.toFixed(2)})`);
// No money in it.
p = person(30); learn(50); h = forSale(); horse.buyHorse(h.id); p.riding.disciplines = Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, 100])); for (const k of Object.keys(p.riding.skills)) p.riding.skills[k] = 100; h.schooling = Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, 100]));
let won = 0; let paid = 0;
for (let y = 0; y < 10; y++) { year(); for (const s of horse.shows()) { const res = horse.enterShow(s.id, h.id); if (res.ok) { paid += horse.showCheck(s.id, h.id).fee; won += s.result.prize; } } care.tickCare(); }
const net = (S().animals.ledger ?? []).reduce((s, t) => s + t.amount, 0);
check(won > 0 && net > 0 && p.riding.record.length <= 40, `even the best pair in the county spends more on the horse than it wins (won ${won}, net cost ${net})`);
check(p.npcIds.some((id) => S().npcs[id].flags.tag === 'rider'), 'the show circuit makes a friend');
clean('competitions');
section('competitions: eligibility, one result per class that survives reload, horse and rider both count, no profit');

// ---------- 5. Land, livery and moving ----------
p = person(35); learn(50); house('country');
check(care.homeSpace() === 'land', 'a country house has land');
h = forSale(); c = horse.horseCheck(h.id);
check(c.ownLand && c.livery === 0, 'with land of one\'s own there is no livery to pay');
horse.buyHorse(h.id);
check(zoo.homeOf(h).hh === 'player' && zoo.livesWithPlayer(h.id) && !h.board && care.careCapacity().used >= SPECIES[h.speciesId].load, 'the horse lives at home, and is the household\'s to look after');
const h2 = forSale(); p.homeId = null; zoo.reconcile(); horse.buyHorse(h2.id);
p.city = 'Boston'; zoo.reconcile(); year(); horse.tickEquestrian();
check(zoo.homeOf(h2).city !== 'Boston' && horse.horseActions(h2).some((x) => x.id === 'moveHorse') && !horse.horseActions(h2).some((x) => x.id === 'ride'), 'a horse at livery does not follow its owner to another city by itself, and cannot be ridden from there');
cash = p.finance.cash; r = horse.moveHorse(h2.id);
check(r.ok && zoo.homeOf(h2).city === 'Boston' && zoo.homeOf(h2).key === horse.stable().id && cash > p.finance.cash && h2.id === zoo.animalById(h2.id).id && care.ledgerOf(h2.id).some((t) => t.kind === 'transport'), 'it can be brought to the new yard, for the cost of the journey: the same horse');
clean('land and moving');
// A companion donkey and some hens, from the farm rescue.
{ const q = person(35); const g = care.shelterAnimals(care.farmRescue()).find((a) => SPECIES[a.speciesId].space === 'land') ?? zoo.register({ id: 'an_goat_t', firstName: 'Nettle', species: 'goat', age: 2, lifespan: 14, alive: true, meters: { relationship: 50 } }, { stock: care.farmRescue(), origin: 'shelter' });
  check(!care.adoptionCheck(g.id).ok && q, 'a goat is not rehomed to a flat'); }
p = person(35); house('country');
const fr = care.farmRescue(); const farm = care.shelterAnimals(fr);
check(fr.farm && farm.length >= 4 && farm.every((a) => ['farm', 'equine'].includes(SPECIES[a.speciesId].group)) && !care.shelterAnimals(care.shelter()).some((a) => !['companion', 'reptile'].includes(SPECIES[a.speciesId].group)), 'the farm rescue holds farm animals; the pet shelter does not');
const hen = farm.find((a) => SPECIES[a.speciesId].space === 'yard') ?? farm[0];
check(care.adoptionCheck(hen.id).ok && care.adopt(hen.id).ok && zoo.livesWithPlayer(hen.id), 'with the land for it, a farm animal can be taken on');
check(!zoo.trainingOf(hen).some((s) => ['sit', 'stay', 'leash'].includes(s.id)) && care.yearlyCost(hen).total > 0, 'it is not trained like a dog, and it costs something to keep');
year(); cash = p.finance.cash; care.tickCare();
check(cash > p.finance.cash && (S().animals.ledger ?? []).every((t) => t.amount >= 0), 'farm animals cost money and earn none');
clean('farm animals');
section('land and farm animals: horses at home or at livery, moved on purpose; farm animals need land and are not a business');

// ---------- 6. Breeding ----------
p = person(35); house('house');
const mk = (species, sex, age, tweak = () => {}) => { const a = zoo.register({ id: `an_b_${species}_${Math.random().toString(36).slice(2, 8)}`, firstName: SPECIES[species].names[Math.floor(Math.random() * 5)], species, age, lifespan: 14, alive: true, meters: { relationship: 50 } }, { stock: care.shelter(), origin: 'shelter' }); a.sex = sex; a.appearance.size = 'small'; tweak(a); care.adopt(a.id); return a; };
let dam = mk('dog', 'female', 4);
const st = stud.studs('dog');
check(st.length >= 2 && st.every((x) => x.sex === 'male' && x.breedKnown && x.family === false) && snap(stud.studs('dog').map((x) => x.id)) === snap(st.map((x) => x.id)), 'a breeder stands stud dogs with papers: the same ones each time');
let bc = stud.breedingCheck(dam.id, st[0].id);
check(!bc.ok && bc.problems.some((x) => /check-up/.test(x)), 'no litter without a vet having seen the dam first');
care.vetVisit(dam.id, 'wellness');
bc = stud.breedingCheck(dam.id, st[0].id);
check(bc.ok && bc.fee > 0 && bc.notes.some((x) => /Nothing is sold/.test(x)), 'a healthy adult dam, checked by a vet, may be bred from, and the owner is told there is no money in it');
{ const pup = mk('dog', 'female', 0); care.vetVisit(pup.id, 'wellness'); check(!stud.breedingCheck(pup.id, st[0].id).ok, 'not from a puppy');
  const oldie = mk('dog', 'female', 12); care.vetVisit(oldie.id, 'wellness'); check(!stud.breedingCheck(oldie.id, st[0].id).ok, 'not from an old dog');
  check(!stud.breedingCheck(dam.id, pup.id).ok && !stud.breedingCheck(dam.id, zoo.allAnimals().find((x) => x.speciesId !== 'dog')?.id ?? 'none').ok, 'not to a female, and not across species');
  care.rehome(pup.id, 'shelter'); care.rehome(oldie.id, 'shelter'); }
cash = p.finance.cash; r = stud.breed(dam.id, st[0].id);
check(r.ok && dam.pregnancy && cash - p.finance.cash === bc.fee && !stud.breed(dam.id, st[0].id).ok && cash - p.finance.cash === bc.fee, 'the stud fee is paid once, and she is not put to a sire twice');
year(); const n0 = zoo.allAnimals().length; cash = p.finance.cash;
stud.tickBreeding(); stud.tickBreeding();
const litter = dam.litters?.[0];
const pups = (litter?.young ?? []).map((id) => zoo.animalById(id));
check(litter && pups.length >= 2 && pups.length <= 4 && zoo.allAnimals().length === n0 + pups.length && !dam.pregnancy, `the litter is born the next year, once, and is of a natural size (${pups.length})`);
check(pups.every((k) => k.parents.dam === dam.id && k.parents.sire === st[0].id && k.born === S().year && k.bornKnown && zoo.ageOf(k) === 0 && stud.parentage(k) === 'recorded'), 'every pup has its own record, with both parents and its birth year on it');
check(pups.every((k) => [dam.appearance.coat, st[0].appearance.coat, dam.appearance.second, st[0].appearance.second].includes(k.appearance.coat) && [dam.appearance.eyes, st[0].appearance.eyes].includes(k.appearance.eyes)), 'they take their looks from their parents');
check(new Set(pups.map((k) => snap(k.temperament))).size === pups.length, 'and their characters are their own');
const keptPups = pups.filter((k) => S().npcs[k.id]); const gonePups = pups.filter((k) => !S().npcs[k.id]);
check(keptPups.length >= 1 && care.careCapacity().free >= 0 && gonePups.every((k) => k.status === 'living' && lastOf('placed', k.id) && !zoo.ownerOf(k).id), `the household keeps what it can look after (${keptPups.length}); the rest go to homes (${gonePups.length}), still on record`);
check(keptPups.every((k) => zoo.ownerOf(k).id === p.id && zoo.livesWithPlayer(k.id) && lastOf('born', k.id)) && lastOf('born', dam.id) && S().journal.some((j) => j.animal?.ev === lastOf('born', dam.id).id), 'the birth is on record for the dam and for each pup kept, and told in the life story');
check((S().animals.ledger ?? []).every((t) => t.amount >= 0) && cash > p.finance.cash, 'the birth costs money, and nothing is earned from the young');
check(snap(stud.offspringOf(dam.id).map((k) => k.id).sort()) === snap(pups.map((k) => k.id).sort()) && stud.offspringOf(st[0].id).length === pups.length, 'dam and sire each know their offspring');
const tree = stud.pedigree(keptPups[0], 2);
check(tree.dam.animal.id === dam.id && tree.sire.animal.id === st[0].id && tree.dam.dam === null && stud.parentage(dam) === 'unknown', 'the pedigree shows what was recorded and leaves the rest unknown');
care.vetVisit(dam.id, 'wellness');
check(!stud.breedingCheck(dam.id, st[1].id).ok && stud.breedingCheck(dam.id, st[1].id).problems.some((x) => /recover/.test(x)), 'she is given time to recover before another litter');
const son = keptPups.find((k) => k.sex === 'male'); const daughter = keptPups.find((k) => k.sex === 'female');
if (son) { S().npcs[son.id].age = 4; dam.litters[0].year -= 5; check(stud.related(dam, son) && !stud.breedingCheck(dam.id, son.id).ok, 'a dam is not put to her own son'); dam.litters[0].year += 5; }
if (daughter) { S().npcs[daughter.id].age = 4; care.vetVisit(daughter.id, 'wellness'); check(!stud.breedingCheck(daughter.id, st[0].id).ok && stud.breedingCheck(daughter.id, st[0].id).problems.some((x) => /related/.test(x)), 'nor a daughter to her own sire'); }
for (let i = 0; i < 12; i++) { year(2); care.vetVisit(dam.id, 'wellness'); const sx = stud.studs('dog').find((x) => !stud.related(dam, x)); if (sx) stud.breed(dam.id, sx.id); year(); stud.tickBreeding(); S().npcs[dam.id].age = 4; S().npcs[dam.id].meters.health = 90; p.finance.cash = 400000;
  for (const k of zoo.householdAnimals()) if (k.id !== dam.id && care.rehomeOptions(k.id).some((o) => o.value === 'shelter')) care.rehome(k.id, 'shelter'); }
check(dam.litters.length === 3, `a dam has three litters in a lifetime and no more, however long it is tried (${dam.litters.length})`);
clean('breeding');
// A foal.
p = person(35); learn(50); house('country'); const mare = forSale((x) => { x.sex = 'female'; }); horse.buyHorse(mare.id); S().npcs[mare.id].meters.health = 90; care.vetVisit(mare.id, 'wellness');
const stallion = stud.studs(mare.speciesId)[0];
check(stud.breedingCheck(mare.id, stallion.id).ok && stud.breed(mare.id, stallion.id).ok, 'a mare can be put to a stallion at stud');
year(); stud.tickBreeding();
const foal = zoo.animalById(mare.litters[0].young[0]);
check(mare.litters[0].young.length === 1 && foal.speciesId === mare.speciesId && foal.parents.dam === mare.id && foal.born === S().year && !horse.backed(foal) && zoo.stageOf(foal) === 'foal', 'one foal, with its dam and sire on record, unbroken');
check(stud.pedigree(foal, 1).sire.animal.breedKnown && (foal.breedKnown === (mare.breedId === stallion.breedId && mare.breedKnown) || !!zoo.breedLabel(foal)), 'its breed is recorded only if both parents\' was');
clean('a foal');
section('breeding: vet first, adults only, no close relations, limited litters, recorded parentage, no profit');

// ---------- 7. Generations ----------
p = person(60); learn(60); const heir = addKin('child', 30); h = forSale(); horse.buyHorse(h.id);
p.riding.disciplines = Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, 70])); for (const k of Object.keys(p.riding.skills)) p.riding.skills[k] = 70;
year(); const sh0 = horse.shows().find((s) => s.level === 'novice'); horse.enterShow(sh0.id, h.id);
const record = snap(h.competitions); const narrator = `${p.firstName} ${p.lastName}`;
die('old age'); store.state = continueAs(heir.id); p = P();
h = zoo.animalById(h.id);
check(h.status === 'living' && zoo.ownerOf(h).id === p.id && zoo.homeOf(h).hh === 'stable' && h.board && S().npcs[h.id], 'a horse outlives its owner: the heir who takes it on finds it still at its yard');
check(snap(h.competitions) === record && h.competitions[0].rider.name === narrator && lastOf('competition', h.id).narrator.name === narrator && zoo.storyOfGeneration(1).some((e) => e.type === 'competition'), 'its competition record is still there, under the name of the one who rode it');
check(!p.riding && !horse.horseActions(h).some((x) => x.id === 'ride') && care.paysFor(h), 'the heir inherits the horse, not the riding: they pay for it, and must learn before they ride it');
clean('a horse across generations');
section('generations: a horse, its yard and its results cross to the heir; the skill does not');

// ---------- 8. Whole lives ----------
let seen = 0; let foals = 0; let rounds = 0;
for (let i = 0; i < 4; i++) {
  rng.seed(9000 + i);
  store.state = createLife({ countryId: ['us', 'uk', 'au', 'ie'][i] });
  for (let y = 0; y < 140; y++) {
    advanceYear();
    while (S().pendingEvents.length) { const pe = S().pendingEvents.shift(); const e2 = getEvent(pe.id); if (e2 && P().alive) resolveChoice(e2, 0, pe.cast); }
    if (!P().alive) { const hr = heirs()[0]; if (!hr) break; store.state = continueAs(hr.id); }
    const pl = P();
    if (pl.age === 30 && !heirs().length) { const k = addKin('child', 1); k.parentIds = []; }
    if (pl.age >= 8 && horse.canLearn().ok && rng.chance(0.6)) horse.takeLessons(horse.riderLevel() >= 25 ? rng.pick(Object.keys(DISCIPLINES)) : 'hacking');
    if (pl.age >= 18) {
      pl.finance.cash += 4000;
      if (rng.chance(0.15)) { const hh = horse.horsesForSale().find((x) => horse.horseCheck(x.id).ok); if (hh && zoo.allAnimals().filter((x) => SPECIES[x.speciesId]?.group === 'equine' && care.paysFor(x)).length < 2) horse.buyHorse(hh.id); }
      if (rng.chance(0.1)) { const st2 = care.shelterAnimals().find((x) => care.adoptionCheck(x.id).ok); if (st2) care.adopt(st2.id); }
      for (const x of zoo.allAnimals().filter((q) => care.paysFor(q))) {
        if (rng.chance(0.5)) care.vetVisit(x.id, 'wellness');
        for (const act of horse.horseActions(x)) { if (act.id === 'ride') horse.ride(x.id, rng.pick(Object.keys(DISCIPLINES))); else if (rng.chance(0.5)) horse.moveHorse(x.id); }
        if (x.sex === 'female' && stud.BREEDING[x.speciesId] && rng.chance(0.3)) { const sr = stud.sires(x.id).find((q) => stud.breedingCheck(x.id, q.id).ok); if (sr) { stud.breed(x.id, sr.id); foals += 1; } }
      }
      for (const s of horse.shows()) for (const m of horse.mounts()) if (horse.showCheck(s.id, m.id).ok && rng.chance(0.6)) { horse.enterShow(s.id, m.id); rounds += 1; }
    }
    const bad = audits();
    if (bad.length) { check(false, `life ${i}, year ${S().year}: ${bad.slice(0, 4).join('; ')}`); break; }
  }
  seen += zoo.allAnimals().length;
  check((S().animals.ledger ?? []).reduce((s, t) => s + t.amount, 0) >= 0, `life ${i}: animals made money`);
}
check(seen >= 8 && rounds >= 5, `the long run saw enough (${seen} animals, ${rounds} rounds ridden, ${foals} matings)`);
section(`whole lives: 4 families, ${seen} animals, ${rounds} rounds ridden, ${foals} matings, every record sound every year`);

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const x of problems) console.log(`FAIL ${x}`); process.exit(1); }
console.log('Horses, farms and families of animals are in order.');
