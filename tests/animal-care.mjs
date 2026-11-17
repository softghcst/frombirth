// Checks looking after animals: shelters whose animals stay the same between
// visits, what a household can take on, adoption, fostering, giving one up,
// what it all costs, the vet, insurance, and illness.
// Run with: node tests/animal-care.mjs
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
const { SPECIES, VET_SERVICES } = await import('../js/data/animals.js');
const zoo = await import('../js/engine/animals.js');
const care = await import('../js/engine/animalCare.js');

rng.seed(424242);
const problems = []; const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const S = () => store.state; const P = () => store.state.player;
const snap = (x) => JSON.stringify(x);
const clean = (where) => { const bad = [...zoo.audit(), ...care.auditCare()]; check(!bad.length, `${where}: unsound: ${bad.join('; ')}`); };
const addKin = (role, age, extra = {}) => { const n = makeNpc({ role, countryId: P().countryId, age, lastName: P().lastName, ...extra }); S().npcs[n.id] = n; P().npcIds.push(n.id); return n; };
const lastOf = (type, id) => zoo.eventsOf(id).filter((e) => e.type === type).at(-1);
/** A grown adult living alone in a rented flat, with no animals and some money. */
function adult(age = 30, cash = 200000, country = 'us') {
  for (;;) { store.state = createLife({ countryId: country }); if (!P().royal && !P().npcIds.some((id) => S().npcs[id].role === 'pet')) break; }
  const p = P(); p.age = age; p.birthYear = S().year; S().year += age;
  for (const n of Object.values(S().npcs)) n.age += age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = cash; p.finance.loans = [];
  zoo.reconcile();
  return p;
}
/** Gives the player a home of a given kind. */
const house = (catalogId) => { const a = { id: `asset_${catalogId}`, kind: 'property', catalogId, name: `Test ${catalogId}`, value: 1, purchasePrice: 1, condition: 80 }; P().assets.push(a); P().homeId = a.id; zoo.reconcile(); };
const stockOf = (species) => care.shelterAnimals().filter((a) => a.speciesId === species);
/** Puts an animal of a given kind in the local shelter, so a check does not depend on who happens to be there. */
function waiting(species, tweak = () => {}) {
  const sh = care.shelter(); care.shelterAnimals();
  const sp = SPECIES[species];
  const a = zoo.register({ id: `an_test_${species}_${Math.random().toString(36).slice(2, 8)}`, firstName: sp.names[0], species, age: 2, lifespan: sp.lifespan[1], alive: true, meters: { relationship: 50 } }, { stock: sh, origin: 'shelter' });
  tweak(a);
  return a;
}

// ---------- 1. Shelters: the same animals, visit after visit ----------
let p = adult();
const sh = care.shelter();
const first = care.shelterAnimals();
check(sh.name && sh.staff.length === 3 && sh.staff.every((x) => x.name && x.role) && first.length >= 4 && first.length <= sh.capacity, 'the city has a shelter, with people, and animals waiting');
check(snap(care.shelterAnimals().map((a) => a.id)) === snap(first.map((a) => a.id)) && care.shelter() === sh, 'looking again shows the same animals, not new ones');
check(first.every((a) => a.family === false && !a.inCircle && !S().npcs[a.id] && zoo.ownerOf(a).org === sh.id && SPECIES[a.speciesId] && a.origin.history), 'each is a real record: a species, a history, owned by the shelter, in nobody\'s life');
check(!zoo.allAnimals().length && !zoo.albumAnimals().length && zoo.everyAnimal().length === first.length, 'animals waiting in a shelter are not in the family album');
check(first.every((a) => zoo.ageOf(a) < a.lifespan && Object.keys(a.temperament).length && a.appearance.coat), 'each has an age, looks and a temperament');
const frozen = snap(S().animals);
saveGame(S()); store.state = loadGame(S().slotId); p = P();
check(snap(S().animals) === frozen, 'the shelter and its animals survive a save and reload unchanged');
const keepId = care.shelterAnimals()[0].id; const keepLooks = snap(zoo.animalById(keepId).appearance);
S().year += 1; p.age += 1;
const later = care.shelterAnimals();
check(later.length >= 4 && later.every((a) => zoo.ageOf(a) < a.lifespan), 'a year on, there are still animals waiting');
check(first.filter((a) => zoo.animalById(a.id)).every((a) => later.some((x) => x.id === a.id)) && (!zoo.animalById(keepId) || snap(zoo.animalById(keepId).appearance) === keepLooks), 'the ones still there are the same individuals; the rest found homes');
{ const q = adult(30, 200000, 'nz'); check(!care.shelterAnimals().some((a) => a.speciesId === 'ferret') && q, 'a shelter does not hold animals that are against the law where it is'); }
clean('shelters');
section('shelters: persistent animals, real records, survive reload, not in the album');

// ---------- 2. Whether a household can take an animal ----------
p = adult(30);
let dog = waiting('dog', (a) => { a.appearance.size = 'large'; a.temperament.activity = 90; });
let c = care.adoptionCheck(dog.id);
check(!c.ok && c.problems.some((x) => /garden/.test(x)), 'a large, tireless dog is refused to a flat with no garden');
dog.temperament.activity = 30;
check(care.adoptionCheck(dog.id).ok, 'a quiet dog of the same size is not: size alone decides nothing');
dog.temperament.activity = 90; house('house');
check(care.adoptionCheck(dog.id).ok && care.homeSpace() === 'yard', 'with a garden, the tireless one can come');
p.age = 15; check(!care.adoptionCheck(dog.id).ok && !care.adopt(dog.id).ok && !zoo.animalById(dog.id).inCircle, 'a child cannot sign for an animal'); p.age = 30;
p.finance.cash = 10; c = care.adoptionCheck(dog.id);
check(!c.ok && c.problems.some((x) => /fee/.test(x)), 'someone who cannot cover the fee and the first months is refused');
p.finance.cash = c.fee + c.yearly; check(care.adoptionCheck(dog.id).ok, 'an ordinary amount of money is enough: it is not a test of wealth');
{ const q = adult(30, 200000, 'nz'); const f = waiting('ferret'); check(!care.adoptionCheck(f.id).ok && care.adoptionCheck(f.id).problems.some((x) => /against the law/.test(x)) && q, 'the law of the country is respected'); }
p = adult(30);
const many = []; for (let i = 0; i < 6; i++) { const a = waiting('cat'); const r = care.adopt(a.id); if (r.ok) many.push(a); }
check(many.length >= 2 && many.length <= 4 && care.careCapacity().free < 0.7, `a household cannot take unlimited animals (${many.length} cats, then no more)`);
const sp = addKin('spouse', 30); zoo.reconcile();
check(care.careCapacity().total > 2, 'another adult in the house means more hands');
clean('checks');
section('adoption checks: room, hands, the law and the first months; never wealth');

// ---------- 3. Adoption: the same animal, the fee once ----------
p = adult(30);
dog = waiting('dog', (a) => { a.appearance.size = 'small'; });
const before = { looks: snap(dog.appearance), temper: snap(dog.temperament), born: dog.born, name: dog.name };
const cash0 = p.finance.cash; const fee = care.adoptionCheck(dog.id).fee;
let r = care.adopt(dog.id);
let a = zoo.animalById(dog.id);
check(r.ok && a === dog && S().npcs[dog.id]?.role === 'pet' && S().npcs[dog.id].firstName === before.name && S().npcs[dog.id].species === 'dog', 'the adopted animal is the one that was chosen: same record, same id');
check(snap(a.appearance) === before.looks && snap(a.temperament) === before.temper && a.born === before.born, 'its looks, temperament and age did not change on the way home');
check(cash0 - p.finance.cash === fee && care.ledgerOf(a.id).length === 1 && care.ledgerOf(a.id)[0].kind === 'adoption' && care.ledgerOf(a.id)[0].currency === 'USD', 'the fee is taken once, and is in the ledger with its currency');
check(!care.adopt(dog.id).ok && cash0 - p.finance.cash === fee, 'it cannot be adopted, or paid for, twice');
check(a.family === true && zoo.ownerOf(a).id === p.id && zoo.primaryOf(a).id === p.id && zoo.livesWithPlayer(a.id) && a.ownerships[0].who.org && a.ownerships[0].to === S().year, 'it is the player\'s now; its time at the shelter is history');
check(!care.shelterAnimals().some((x) => x.id === a.id) && zoo.albumAnimals().some((x) => x.id === a.id), 'it has left the shelter and joined the album');
check(!!lastOf('adopted', a.id) && S().journal.some((j) => j.animal?.ev === lastOf('adopted', a.id).id) && lastOf('adopted', a.id).text.includes(care.shelter().name), 'the adoption is on record, told in the life story, naming the shelter');
check(S().npcs[a.id].meters.relationship <= 70, 'a new animal does not arrive fully bonded');
// A second animal: introductions.
const cat = waiting('cat'); const ham = waiting('hamster');
const look = care.outlook(cat);
check(look.length === 1 && look[0].other.id === a.id && look[0].text.length > 10 && care.adoptionCheck(cat.id).notes.length >= 1, 'before a second animal comes home, the household is told how the first is likely to take it');
care.adopt(cat.id); care.adopt(ham.id);
const pairs = care.companionsOf(a);
check(pairs.length === 2 && pairs.find((x) => x.other.id === ham.id).word === 'kept safely apart' && pairs.find((x) => x.other.id === cat.id).value < 75, 'the dog and cat start out unsure; the dog and hamster are kept apart');
const v0 = care.companionsOf(a).find((x) => x.other.id === cat.id).value;
for (let i = 0; i < 12; i++) { S().year += 1; p.age += 1; care.tickCare(); care.tickCare(); }
const v1 = care.companionsOf(a).find((x) => x.other.id === cat.id);
check(v1.value > v0 && v1.value <= 85 && care.companionsOf(a).find((x) => x.other.id === ham.id).value <= 25, 'over the years the dog and cat grow used to each other; hunter and prey never share a room');
check(zoo.timeline(S(), { type: 'companions' }).length <= 1 && (v1.value < 75 || zoo.timeline(S(), { type: 'companions' }).length === 1), 'a friendship between two animals is recorded once');
clean('adoption');
section('adoption: same individual, fee once, ownership passes, introductions gradual');

// ---------- 4. What it costs ----------
p = adult(30, 50000); dog = waiting('dog', (x) => { x.appearance.size = 'small'; }); care.adopt(dog.id); a = dog;
S().year += 1; p.age += 1;
const cost = care.yearlyCost(a);
let cash = p.finance.cash; care.tickCare();
check(cash - p.finance.cash === cost.care && cost.care > 0 && cost.insurance === 0, 'a year of care is charged to the owner');
care.tickCare(); S().animals.careYear = null; care.tickCare();
check(cash - p.finance.cash === cost.care && care.ledgerOf(a.id).filter((t) => t.kind === 'care').length === 1, 'the same year is never charged twice, however it is asked');
check(S().journal.some((j) => /cost .* this year/.test(j.text)), 'the cost is told in the life story');
r = care.setRoutine(a.id, 'enriched');
check(r.ok && care.yearlyCost(a).care > cost.care, 'a richer routine costs more');
S().year += 1; p.age += 1; p.finance.cash = 40; care.tickCare();
check(p.finance.cash === 0 && a.stretched === S().year && S().npcs[a.id].alive, 'with no money, what there is goes on the animal, nothing more is taken, and it is not lost');
const fam = adult(30); { const kidPet = waiting('cat'); p = P(); p.age = 30; care.adopt(kidPet.id); const par = zoo.animalById(kidPet.id); par.ownerships.at(-1).who = { id: 'someone', name: 'Someone Else' }; check(!care.paysFor(par) && fam, 'someone who does not own an animal does not pay for it'); par.ownerships.at(-1).who = zoo.tools.ref(S(), p.id); }
clean('costs');
section('costs: charged once a year to the owner, in the ledger, never below zero');

// ---------- 5. The vet ----------
p = adult(30, 100000); dog = waiting('dog', (x) => { x.appearance.size = 'small'; }); care.adopt(dog.id); a = dog;
const cl = care.clinic();
check(cl.name && cl.vets.length === 3 && care.clinic() === cl, 'the city has a vet\'s surgery, with named staff, and it is the same one each time');
let svcs = care.vetServices(a.id);
check(svcs.some((s) => s.id === 'wellness') && svcs.some((s) => s.id === 'vaccination') && !svcs.some((s) => s.id === 'senior') && svcs.every((s) => s.price > 0), 'a young dog is offered a check-up and vaccinations, not a senior screen');
const fish = waiting('fish'); const hamster = waiting('hamster'); care.adopt(fish.id); care.adopt(hamster.id);
check(!care.vetServices(fish.id).length && !care.vetServices(hamster.id).some((s) => s.id === 'vaccination') && care.vetServices(hamster.id).some((s) => s.id === 'wellness'), 'a fish is not taken to the vet and a hamster is not vaccinated');
cash = p.finance.cash; const price = svcs.find((s) => s.id === 'wellness').price;
r = care.vetVisit(a.id, 'wellness');
check(r.ok && cash - p.finance.cash === price && a.health.length === 1 && a.health[0].service === 'wellness' && a.health[0].cost === price && a.health[0].clinic === cl.name && cl.vets.some((v) => v.name === a.health[0].vet) && a.lastCheck === S().year, 'a check-up is paid for, and recorded with the surgery and the vet who did it');
check(!care.vetVisit(a.id, 'wellness').ok && cash - p.finance.cash === price && a.health.length === 1, 'the same visit cannot be made, or paid for, twice in a year');
check(care.vetVisit(a.id, 'vaccination').ok && a.vaccinated === S().year && !care.vetVisit(a.id, 'spa').ok, 'vaccinations are recorded; a service that does not exist is refused');
saveGame(S()); store.state = loadGame(S().slotId); p = P(); a = zoo.animalById(a.id);
check(a.health.length === 2 && !care.vetVisit(a.id, 'wellness').ok, 'after a reload the record is the same and the visit still cannot be repeated');
clean('vet');
section('vet: a real surgery, species-appropriate services, paid once, recorded');

// ---------- 6. Illness, emergencies and insurance ----------
let q = care.insuranceQuote(a.id);
check(q.available && q.premium > 0 && !care.insuranceQuote(fish.id).available, 'a dog can be insured; nobody insures a fish');
cash = p.finance.cash; r = care.insure(a.id);
check(r.ok && cash - p.finance.cash === q.premium && a.insurance && !care.insure(a.id).ok, 'the first premium is paid once');
S().year += 1; p.age += 1; a.lastCheck = S().year;
// The scene: unwell, taken to the vet. The dice are loaded so the treatment works.
rng.seed(1); cash = p.finance.cash;
let out = resolveChoice(getEvent('animal_unwell'), 0, { pet: a.id });
let bill = care.ledgerOf(a.id).find((t) => t.kind === 'treatment'); let back = care.ledgerOf(a.id).find((t) => t.refOf === bill?.id);
check(!!bill && bill.amount > 0 && a.health.at(-1).service === 'treatment' && a.health.at(-1).txId === bill.id, 'treatment is billed once and recorded against the bill');
check(!!back && -back.amount > 0 && -back.amount < bill.amount && -back.amount === Math.round((bill.amount - a.insurance.deductible) * a.insurance.rate), 'the insurance pays back its share of the bill, after the excess, and never more than the bill');
check(cash - p.finance.cash === bill.amount + back.amount && /insurance paid back/.test(out.text), 'the player is out of pocket by exactly the difference, and is told');
if (a.health.at(-1).recovered) check(!!lastOf('recovery', a.id) && S().journal.at(-1).animal?.ev === lastOf('recovery', a.id).id, 'a recovery is a moment on record, tied to the line that tells it');
const n0 = care.ledgerOf(a.id).length;
care.sceneChoice({ do: 'treat', kind: 'treatment', costBase: 420 }, { pet: a.id });
check(care.ledgerOf(a.id).length === n0, 'the same illness in the same year is not billed or paid out again');
S().year += 1; p.age += 1; cash = p.finance.cash; care.vetVisit(a.id, 'wellness');
check(!care.ledgerOf(a.id).some((t) => t.refOf && care.ledgerOf(a.id).find((x) => x.id === t.refOf)?.kind === 'vet'), 'routine care is not covered');
// An emergency that is not survived: the animal's death is recorded properly.
let died = false;
for (let i = 0; i < 40 && !died; i++) {
  p = adult(30, 100000); const d2 = waiting('dog', (x) => { x.appearance.size = 'small'; }); care.adopt(d2.id);
  rng.seed(100 + i); resolveChoice(getEvent('animal_emergency'), 1, { pet: d2.id });
  if (zoo.animalById(d2.id).status === 'deceased') {
    died = true;
    check(!S().npcs[d2.id].alive && lastOf('died', d2.id) && zoo.animalById(d2.id).health.at(-1).kind === 'illness' && S().journal.filter((j) => j.animal?.ev === lastOf('died', d2.id).id).length === 1, 'an emergency left untreated can end in a death, recorded once like any other');
    clean('after an emergency death');
  }
}
check(died, 'waiting out an emergency is dangerous');
let lived = 0; let lost = 0;
for (let i = 0; i < 60; i++) { p = adult(30, 100000); const d3 = waiting('dog', (x) => { x.appearance.size = 'small'; }); care.adopt(d3.id); rng.seed(500 + i); resolveChoice(getEvent('animal_emergency'), 0, { pet: d3.id }); if (zoo.animalById(d3.id).status === 'living') lived += 1; else lost += 1; }
check(lived > lost * 2 && lost > 0, `the emergency vet usually saves them, and not always (${lived} lived, ${lost} did not)`);
p = adult(30, 100000); const olddog = waiting('dog', (x) => { x.appearance.size = 'small'; x.born = S().year - 13; x.lifespan = 14; }); care.adopt(olddog.id);
check(!care.insuranceQuote(olddog.id).available && care.vetServices(olddog.id).some((s) => s.id === 'senior'), 'an old animal cannot start a policy, and is offered a senior screen');
clean('illness and insurance');
section('illness: treatment billed once, insurance pays its share once, outcomes uncertain, deaths recorded');

// ---------- 7. Fostering ----------
p = adult(30, 100000); let fo = waiting('cat');
cash = p.finance.cash; r = care.foster(fo.id); a = zoo.animalById(fo.id);
check(r.ok && cash === p.finance.cash && S().npcs[a.id] && a.foster && zoo.ownerOf(a).org === care.shelter().id && !zoo.ownerOf(a).id && zoo.primaryOf(a).id === p.id && zoo.livesWithPlayer(a.id), 'a fostered animal lives with the player, who looks after it; it still belongs to the rescue, and no fee is paid');
check(!!lastOf('fostered', a.id) && zoo.albumAnimals().some((x) => x.id === a.id) && zoo.familyLink(a).length > 0, 'fostering is on record and the animal is in the album');
check(care.vetServices(a.id).every((s) => s.price === 0) && !care.insuranceQuote(a.id).available && !care.rehomeOptions(a.id).length, 'the rescue pays the vet; the fosterer cannot insure it or give it away');
S().year += 1; p.age += 1; S().pendingEvents = []; rng.seed(9); care.tickCare();
check(S().pendingEvents.some((e) => e.id === 'foster_review' && e.cast.pet === a.id), 'after a year the placement comes up for review');
const pend = snap(S().pendingEvents); saveGame(S()); store.state = loadGame(S().slotId); p = P(); a = zoo.animalById(a.id);
check(snap(S().pendingEvents) === pend, 'the review is still waiting after a reload, not rolled again');
cash = p.finance.cash; out = resolveChoice(getEvent('foster_review'), 0, { pet: a.id });
check(!a.foster && zoo.ownerOf(a).id === p.id && cash - p.finance.cash === care.ledgerOf(a.id).find((t) => t.kind === 'adoption').amount && lastOf('adopted', a.id) && a.fostered?.adopted, 'the fosterer can apply to adopt: then it is theirs, for the usual fee, paid once');
fo = waiting('dog', (x) => { x.appearance.size = 'small'; }); care.foster(fo.id); a = zoo.animalById(fo.id); const mood = p.stats.mood;
out = resolveChoice(getEvent('foster_review'), 2, { pet: a.id });
check(!S().npcs[a.id] && !a.inCircle && !a.foster && a.fostered && a.status === 'living' && (lastOf('placed', a.id) || lastOf('rehomed', a.id)) && zoo.albumAnimals().some((x) => x.id === a.id) && p.stats.mood <= mood, 'when the placement ends the animal goes to a home or back to wait; the family keeps the record, and it is felt');
fo = waiting('rabbit'); care.foster(fo.id); a = zoo.animalById(fo.id);
addKin('child', 25); die('old age');
check(!zoo.ownerOf(a).id && zoo.primaryOf(a).name === care.shelter().name && a.status === 'living' && !a.foster, 'if the fosterer dies, the animal goes back to the rescue, not to an heir');
clean('fostering');
section('fostering: cared for but not owned, reviewed, adopted only by applying, never inherited');

// ---------- 8. Giving an animal up ----------
p = adult(40, 100000); const sib = addKin('sibling', 38); sib.meters.relationship = 80;
dog = waiting('dog', (x) => { x.appearance.size = 'small'; }); care.adopt(dog.id); a = dog;
const opts = care.rehomeOptions(a.id);
check(opts.some((o) => o.value === sib.id) && opts.some((o) => o.value === 'shelter'), 'an owner who cannot keep an animal can ask family, or a rescue');
const idBefore = snap([a.id, a.appearance, a.temperament]); const m0 = p.stats.mood;
r = care.rehome(a.id, sib.id);
check(r.ok && zoo.ownerOf(a).id === sib.id && zoo.primaryOf(a).id === sib.id && !zoo.livesWithPlayer(a.id) && S().npcs[a.id]?.alive && snap([a.id, a.appearance, a.temperament]) === idBefore, 'rehomed with a relative: the same animal, a new owner, still in the player\'s life');
check(p.stats.mood < m0 && lastOf('care', a.id).people.some((x) => x.id === sib.id) && a.ownerships.filter((o) => o.who.id).length === 2 && !care.paysFor(a), 'it is not free of feeling, it is on record, and the old owner no longer pays');
check(!care.rehomeOptions(a.id).length && !care.rehome(a.id, 'shelter').ok, 'someone who no longer owns an animal cannot give it away again');
const cat2 = waiting('cat'); care.adopt(cat2.id); const karma = p.hidden.karma;
r = care.rehome(cat2.id, 'shelter');
check(r.ok && !S().npcs[cat2.id] && zoo.animalById(cat2.id).status === 'living' && care.shelterAnimals().some((x) => x.id === cat2.id) && zoo.albumAnimals().some((x) => x.id === cat2.id) && p.hidden.karma < karma, 'given to a rescue: it waits there for a new home, the family keeps the record, and it weighs on the one who did it');
// Coming back for it: the same animal, the same record, adopted again.
{ S().year += 1; p.age += 1; const n = care.ledgerOf(cat2.id).length; const again = care.adopt(cat2.id); const rec = zoo.animalById(cat2.id);
  check(again.ok && S().npcs[cat2.id] && rec.inCircle && zoo.ownerOf(rec).id === p.id && care.ledgerOf(cat2.id).length === n + 1 && zoo.eventsOf(cat2.id).filter((e) => e.type === 'adopted').length >= 1, 'an animal once given up can be taken back: the same record carries on');
  clean('taken back'); care.rehome(cat2.id, 'shelter'); }
S().year += 8; care.shelterAnimals();
check(zoo.animalById(cat2.id) && (zoo.animalById(cat2.id).status === 'deceased' || !care.shelterAnimals().some((x) => x.id === cat2.id) || zoo.homeOf(zoo.animalById(cat2.id))), 'years later its record is still there, wherever it went');
clean('rehoming');
section('rehoming: identity kept, ownership passes, never deleted, never free');

// ---------- 9. A child asks for an animal ----------
let asked = 0; let got = 0;
for (let i = 0; i < 30; i++) {
  for (;;) { store.state = createLife({ countryId: 'us' }); if (!P().royal && !P().npcIds.some((id) => S().npcs[id].role === 'pet')) break; }
  p = P(); p.age = 9; S().year += 9; zoo.reconcile(); rng.seed(700 + i);
  // Half the families are hard up, half are comfortable: the answer follows from that.
  for (const n of Object.values(S().npcs)) if (n.role === 'parent') { n.wealth = i % 2 ? 60 : 10; n.meters.money = n.wealth; }
  const res = care.familyAdopts(); asked += 1;
  if (res.ok) {
    got += 1; a = zoo.animalById(res.animalId);
    check(zoo.ownerOf(a).id !== p.id && S().npcs[zoo.ownerOf(a).id].role === 'parent' && zoo.helpersOf(a).some((x) => x.id === p.id) && S().npcs[a.id] && zoo.eventsOf(a.id).filter((e) => e.type === 'adopted').length === 1, 'when the family adopts because a child asked, a parent owns it and the child helps');
    check(!care.ledgerOf(a.id).length, 'and the child is not charged');
  }
  delete S().animals.pending;
}
check(got > 0 && got < asked, `asking does not always get a yes (${got} of ${asked})`);
section('children: the adults decide, own the animal, and may say no');

// ---------- 10. Whole lives ----------
let seen = 0; let spent = 0; let scenes = 0;
for (let i = 0; i < 5; i++) {
  rng.seed(3000 + i);
  store.state = createLife({ countryId: ['us', 'uk', 'jp', 'br', 'de'][i] });
  for (let y = 0; y < 150; y++) {
    advanceYear();
    while (S().pendingEvents.length) { const pe = S().pendingEvents.shift(); const ev = getEvent(pe.id); if (ev && P().alive) { if (ev.category === 'animals') scenes += 1; resolveChoice(ev, rng.int(0, ev.choices.length - 1) % ev.choices.length, pe.cast); } }
    if (!P().alive) { const heir = heirs()[0]; if (!heir) break; store.state = continueAs(heir.id); }
    const pl = P();
    if (pl.age === 30 && !heirs().length) { const k = addKin('child', 1); k.parentIds = []; }
    if (pl.age >= 18 && rng.chance(0.2)) {
      pl.finance.cash += 3000;
      const stock = care.shelterAnimals().filter((x) => care.adoptionCheck(x.id).ok);
      if (stock.length) { if (rng.chance(0.25)) care.foster(stock[0].id); else care.adopt(stock[0].id); }
    }
    for (const x of zoo.householdAnimals()) { if (rng.chance(0.4)) care.vetVisit(x.id, 'wellness'); if (rng.chance(0.05) && care.insuranceQuote(x.id).available) care.insure(x.id); if (rng.chance(0.02)) { const o = care.rehomeOptions(x.id); if (o.length) care.rehome(x.id, o[0].value); } }
    const bad = [...zoo.audit(), ...care.auditCare()];
    if (bad.length) { check(false, `life ${i}, year ${S().year}: ${bad.slice(0, 4).join('; ')}`); break; }
  }
  seen += zoo.allAnimals().length; spent += (S().animals.ledger ?? []).reduce((s, t) => s + t.amount, 0);
  check((S().animals.ledger ?? []).reduce((s, t) => s + t.amount, 0) >= 0, `life ${i}: animals made money`);
}
check(seen >= 15 && spent > 0 && scenes >= 5, `the long run saw enough (${seen} animals, ${scenes} animal scenes)`);
section(`whole lives: 5 families, ${seen} animals, ${scenes} animal scenes, the record and the ledger sound every year`);

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const x of problems) console.log(`FAIL ${x}`); process.exit(1); }
console.log('The animals are looked after, and the books balance.');
