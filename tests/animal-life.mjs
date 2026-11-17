// Checks the rest of life with animals: the people at the shelter, the vet and the
// club; classes; behaviour problems; landlords; outings and the pet show; custody
// after a break-up; leasing and selling horses; reptiles and licences; the sides of
// a bond; businesses with books of their own; and stories that take years.
// Run with: node tests/animal-life.mjs
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
const { SPECIES } = await import('../js/data/animals.js');
const zoo = await import('../js/engine/animals.js');
const care = await import('../js/engine/animalCare.js');
const horse = await import('../js/engine/equestrian.js');
const life = await import('../js/engine/animalLife.js');
const biz = await import('../js/engine/animalBusiness.js');
const arcs = await import('../js/engine/animalArcs.js');
const { incomeTax } = await import('../js/engine/finance.js');
const { tickRelationships } = await import('../js/engine/relationships.js');
const tickAll = () => tickRelationships();

rng.seed(5150);
const problems = []; const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const S = () => store.state; const P = () => store.state.player;
const audits = () => [...zoo.audit(), ...care.auditCare(), ...horse.auditRiding(), ...biz.auditBusinesses()];
const clean = (where) => { const bad = audits(); check(!bad.length, `${where}: unsound: ${bad.slice(0, 5).join('; ')}`); };
const addKin = (role, age, extra = {}) => { const n = makeNpc({ role, countryId: P().countryId, age, lastName: P().lastName, ...extra }); S().npcs[n.id] = n; P().npcIds.push(n.id); return n; };
const lastOf = (type, id) => zoo.eventsOf(id).filter((e) => e.type === type).at(-1);
const year = (n = 1) => { for (let i = 0; i < n; i++) { S().year += 1; P().age += 1; for (const x of Object.values(S().npcs)) if (x.alive) x.age += 1; } };
function adult(age = 30, cash = 300000, country = 'us') {
  for (;;) { store.state = createLife({ countryId: country }); if (!P().royal && !P().npcIds.some((id) => S().npcs[id].role === 'pet')) break; }
  const p = P(); p.age = age; p.birthYear = S().year; S().year += age;
  for (const n of Object.values(S().npcs)) n.age += age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.finance.cash = cash; p.finance.loans = [];
  zoo.reconcile(); const l = care.rentalPolicy(); if (l) l.kind = 'any';
  return p;
}
const house = (catalogId) => { const a = { id: `asset_${catalogId}`, kind: 'property', catalogId, name: `Test ${catalogId}`, value: 1, purchasePrice: 1, condition: 80 }; P().assets.push(a); P().homeId = a.id; zoo.reconcile(); };
function waiting(species, tweak = () => {}) {
  const sh = care.shelter(); care.shelterAnimals();
  const sp = SPECIES[species];
  const a = zoo.register({ id: `an_t_${species}_${Math.random().toString(36).slice(2, 8)}`, firstName: sp.names[0], species, age: 2, lifespan: sp.lifespan[1], alive: true, meters: { relationship: 50 } }, { stock: sh, origin: 'shelter' });
  a.appearance.size = 'small'; tweak(a);
  return a;
}
const own = (species, tweak) => { const a = waiting(species, tweak); const r = care.adopt(a.id); if (!r.ok) throw new Error(r.text); return a; };

// ---------- 1. The people at these places ----------
let p = adult();
let a = own('dog');
const sh = care.shelter();
const helper = S().npcs[sh.met?.[2]];
check(helper && `${helper.firstName} ${helper.lastName}` === sh.staff[2].name && p.npcIds.includes(helper.id) && helper.flags.title.includes(sh.name), 'adopting introduces the person who handles adoptions, as a person in the player\'s life');
const b2 = own('cat');
check(sh.met[2] === helper.id && Object.values(S().npcs).filter((n) => n.flags.tag === `staff:${sh.id}:2`).length === 1, 'the second time, it is the same person, not a new one');
care.vetVisit(a.id, 'wellness'); year(); care.vetVisit(a.id, 'wellness');
const cl = care.clinic();
const vets = a.health.map((h) => h.vet);
check(vets.length === 2 && vets[0] === vets[1] && S().npcs[cl.met[a.vetIndex]] && `${S().npcs[cl.met[a.vetIndex]].firstName} ${S().npcs[cl.met[a.vetIndex]].lastName}` === vets[0], 'an animal is seen by the same vet each year, and the vet is a person in the player\'s life');
year(30); tickAll(); check(S().npcs[helper.id] && p.npcIds.includes(helper.id), 'people met through animals do not drift out of the player\'s life like old classmates');
clean('staff');
section('staff: shelter, vet and club people are real, persistent people');

// ---------- 2. Classes ----------
p = adult(); a = own('dog', (x) => { x.born = S().year; });
let offers = life.coursesFor(a.id);
check(offers.find((x) => x.id === 'puppy') && !offers.find((x) => x.id === 'puppy').why && offers.find((x) => x.id === 'agility').why, 'a puppy can go to puppy class, not agility');
check(!life.coursesFor(own('fish').id).length && life.coursesFor(own('cat').id).some((x) => x.id === 'clicker'), 'fish do not go to classes; cats can be clicker-trained');
let cash = p.finance.cash;
let r = life.enrol(a.id, 'puppy');
const trainer = S().npcs[life.club().met?.[0]];
check(r.ok && cash - p.finance.cash === offers.find((x) => x.id === 'puppy').price && ['name', 'sit', 'come'].every((k) => a.training[k]?.progress > 0) && trainer, 'a year of puppy class moves several skills on at once, is paid once, and the trainer is someone the player now knows');
check(!life.enrol(a.id, 'puppy').ok && cash - p.finance.cash === offers.find((x) => x.id === 'puppy').price, 'one year of a course at a time');
for (let i = 0; i < 4 && !['name', 'sit', 'come'].every((k) => a.training[k].progress >= 100); i++) { year(); life.enrol(a.id, 'puppy'); }
check(['name', 'sit', 'come'].every((k) => a.training[k].progress >= 100) && lastOf('trained', a.id), 'finishing a course is a milestone');
for (let i = 0; i < 6 && !(a.training.come.progress >= 100 && a.training.stay?.progress >= 100); i++) { year(); life.enrol(a.id, 'obedience'); }
year(); S().npcs[a.id].age = 3; r = life.enrol(a.id, 'agility');
check(r.ok && a.training.agility?.progress > 0 && zoo.trainingOf(a).some((s) => s.id === 'agility' && s.classOnly) && !zoo.train(a.id, 'agility').ok, 'agility is learned in a class, not at home, and shows among what the dog is learning');
clean('classes');
section('classes: right for the age and species, several skills at once, paid once a year, with a real trainer');

// ---------- 3. Behaviour ----------
p = adult(); a = own('dog'); a.behaviour = { id: 'separation', since: S().year, progress: 0 };
const trust0 = zoo.bondDetail(a, p.id).trust;
r = life.helpWith(a.id, 'scold');
check(r.ok && a.behaviour.progress === 0 && zoo.bondDetail(a, p.id).trust < trust0, 'telling an animal off makes it warier, and does not help');
check(!life.helpWith(a.id, 'trainer').ok, 'one kind of help a year');
let years2 = 0;
while (!a.behaviour.resolved && years2 < 8) { year(); life.helpWith(a.id, 'trainer'); years2 += 1; }
check(a.behaviour.resolved && years2 >= 2 && lastOf('trained', a.id)?.text.includes('Distress when left alone'.toLowerCase()), `with a behaviourist it gets better, over years (${years2}), and getting past it is recorded`);
check(zoo.bondDetail(a, p.id).trust > trust0 - 12 && life.behaviourOf(a) === null, 'patient help rebuilds trust');
// It starts from temperament, not at random.
let started = 0; let wrong = 0;
for (let i = 0; i < 40; i++) {
  p = adult(); const d = own('dog', (x) => { x.temperament.activity = 90; x.temperament.sociability = 90; x.temperament.affection = 30; x.temperament.confidence = 70; }); const c2 = own('cat', (x) => { x.temperament.activity = 20; x.temperament.confidence = 80; x.temperament.sensitivity = 20; });
  year(); S().pendingEvents = []; life.tickLife();
  if (d.behaviour) started += 1; if (c2.behaviour) wrong += 1;
  if (d.behaviour) check(S().pendingEvents.some((e) => e.id === 'animal_behaviour' && e.cast.pet === d.id && e.cast.words.problem), 'a new problem brings a scene that says what it is');
}
check(started > 5 && wrong === 0, `problems come from an animal's nature (${started} lively dogs, ${wrong} calm cats)`);
clean('behaviour');
section('behaviour: from temperament, kind help works slowly, anger makes it worse');

// ---------- 4. Landlords, kit, licences ----------
p = adult(); const lease = care.rentalPolicy(); lease.kind = 'none';
let d = waiting('dog');
check(!care.adoptionCheck(d.id).ok && /tenancy does not allow/.test(care.adoptionCheck(d.id).problems.join()), 'a landlord who allows no animals means no adoption');
lease.kind = 'small';
check(!care.adoptionCheck(d.id).ok && care.adoptionCheck(waiting('hamster').id).ok && care.adoptionCheck(waiting('cat').id).ok, 'cats and caged animals only means no dog');
lease.kind = 'any';
cash = p.finance.cash; care.adopt(d.id); const dep = care.ledgerOf(null).filter((t) => t.kind === 'deposit');
check(dep.length === 1 && P().inventory.some((x) => x.forAnimal === d.id), 'a pet deposit is paid once for the tenancy, and the kit is kept');
care.adopt(waiting('cat').id);
check(care.ledgerOf(null).filter((t) => t.kind === 'deposit').length === 1, 'and not again for a second animal');
// Moving to a new rental with a dog: the player finds a landlord who will take it, and pays for it.
p.flags.rentalSince = S().year + 1; year(); const l2 = care.rentalPolicy();
check(l2.kind === 'any', 'a household with a dog only moves somewhere that takes dogs');
cash = p.finance.cash; care.tickCare();
check(!l2.premium || care.ledgerOf(null).some((t) => t.kind === 'pet rent'), 'where it took some persuading, the rent is a little higher');
house('house'); check(care.rentalPolicy() === null, 'in a home of one\'s own there is no landlord');
{ const q = adult(30, 300000, 'nz'); const sn = waiting('corn_snake'); check(!care.adoptionCheck(sn.id).ok && q, 'a snake cannot be kept where the law forbids it'); }
{ const q = adult(30, 300000, 'au'); const sn = waiting('corn_snake'); const chk = care.adoptionCheck(sn.id); cash = q.finance.cash;
  check(chk.ok && chk.notes.some((x) => /licence/.test(x)) && care.adopt(sn.id).ok && sn.permit && care.ledgerOf(sn.id).filter((t) => t.kind === 'permit').length === 1, 'where a licence is needed, it is paid for once with the adoption');
  check(!care.vetServices(sn.id).some((s) => s.id === 'vaccination') && !life.coursesFor(sn.id).length && zoo.trainingOf(sn).length === 0, 'a snake is not vaccinated, trained or taken to class'); }
{ adult(); const t = waiting('tortoise'); check(!care.adoptionCheck(t.id).ok && care.adoptionCheck(t.id).problems.some((x) => /garden/.test(x)), 'a tortoise needs a garden'); house('house'); check(care.adoptionCheck(t.id).ok && care.adoptionCheck(t.id).notes.some((x) => /outlive/.test(x)), 'and its owner is told it may outlive them'); }
clean('landlords');
section('housing: landlords\' rules, deposits once, kit kept; licences and bans for reptiles');

// ---------- 5. Outings and the pet show ----------
p = adult(); a = own('dog');
const outs = life.outingsFor(a.id);
check(outs.some((o) => o.id === 'park') && !life.outingsFor(own('fish').id).length, 'a dog can go to the park; a fish cannot');
const b0 = S().npcs[a.id].meters.relationship;
r = life.outing(a.id, 'park');
check(r.ok && S().npcs[a.id].meters.relationship > b0 && !life.outing(a.id, 'park').ok, 'an outing brings them closer, once a year');
let metSomeone = false;
for (let i = 0; i < 12 && !metSomeone; i++) { year(); life.outing(a.id, 'park'); metSomeone = p.npcIds.some((x) => S().npcs[x]?.flags.tag === 'dogpark'); }
check(metSomeone && p.npcIds.filter((x) => S().npcs[x]?.flags.tag === 'dogpark').length === 1, 'sooner or later the dog park makes a friend, and only one');
cash = p.finance.cash; r = life.enterPetShow(a.id);
const show = life.petShow();
check(r.ok && show.entries[a.id] && !life.enterPetShow(a.id).ok && care.ledgerOf(a.id).filter((t) => t.kind === 'pet show').length === 1 && care.ledgerOf(a.id).every((t) => t.amount >= 0), 'the pet show is entered once a year, for a small fee, and pays no prize');
saveGame(S()); store.state = loadGame(S().slotId);
check(life.petShow().entries[a.id].place === show.entries[a.id].place, 'its result survives a reload');
clean('outings');
section('outings and the pet show: once a year, bring animals and people together, never money');

// ---------- 6. Families ----------
p = adult(); const wife = addKin('spouse', 30); zoo.reconcile(); a = own('dog'); zoo.reconcile();
zoo.nudgeBond(a, wife.id, { value: 30 });
wife.role = 'ex'; zoo.reconcile(); S().pendingEvents = []; life.tickLife();
const ev = S().pendingEvents.find((e) => e.id === 'animal_custody');
check(ev && ev.cast.pet === a.id && ev.cast.ex === wife.id, 'when a marriage ends, the question of the dog comes up');
r = life.custody(a.id, wife.id, 'give');
check(zoo.ownerOf(a).id === wife.id && zoo.primaryOf(a).id === wife.id && !zoo.livesWithPlayer(a.id) && lastOf('care', a.id), 'given up in the split: the dog is the ex\'s now, and it is recorded');
S().pendingEvents = []; life.tickLife();
check(!S().pendingEvents.some((e) => e.id === 'animal_custody'), 'the question is asked once');
p = adult(); const h2 = addKin('spouse', 30); zoo.reconcile(); a = own('cat'); zoo.reconcile(); h2.role = 'ex'; zoo.reconcile();
life.custody(a.id, h2.id, 'share');
check(zoo.ownerOf(a).id === p.id && a.visits?.who.id === h2.id, 'shared: the animal stays, and the ex still sees it');
for (let i = 0; i < 30; i++) {
  for (;;) { store.state = createLife({ countryId: 'us' }); if (!P().royal) break; }
  if (!P().npcIds.some((id) => S().npcs[id].role === 'pet' && S().npcs[id].species === 'dog')) continue;
  if (!P().npcIds.some((id) => S().npcs[id].role === 'sibling')) continue;
  const sib = P().npcIds.map((id) => S().npcs[id]).find((n) => n.role === 'sibling');
  P().age = 11; S().year += 11; sib.age = 13; zoo.reconcile();
  for (let k = 0; k < 6 && !S().pendingEvents.some((e) => e.id === 'whose_turn'); k++) { S().year += 1; P().age += 1; S().pendingEvents = []; S().animals.lifeYear = null; life.tickLife(); }
  const e = S().pendingEvents.find((x) => x.id === 'whose_turn');
  if (e) { const before = sib.meters.relationship; resolveChoice(getEvent('whose_turn'), 2, e.cast); check(sib.meters.relationship < before, 'insisting it is your sibling\'s turn costs something'); break; }
}
clean('families');
section('families: custody after a split, decided once and recorded; siblings argue about the dog');

// ---------- 7. Leasing and selling horses ----------
p = adult(30, 600000);
for (let i = 0; i < 8; i++) { year(); horse.takeLessons(horse.riderLevel() >= 25 ? 'dressage' : 'hacking'); }
let h = horse.horsesForSale().find((x) => horse.backed(x) && zoo.stageOf(x) !== 'senior' && horse.horseCheck(x.id).ok);
const owner0 = zoo.ownerOf(h);
cash = p.finance.cash; r = horse.leaseHorse(h.id);
check(r.ok && cash - p.finance.cash === horse.leaseFee(h) && zoo.ownerOf(h) === owner0 && owner0.org && zoo.primaryOf(h).id === p.id && S().npcs[h.id] && horse.leasedBy(h), 'a leased horse stays the yard\'s; the player looks after it and pays the lease');
check(horse.horseActions(h).some((x) => x.id === 'ride') && !horse.horseActions(h).some((x) => x.id === 'sellHorse') && horse.mounts().some((m) => m.id === h.id), 'the player can ride it and compete on it, but not sell it');
check(!horse.horsesForSale().some((x) => x.id === h.id), 'while leased it is not for sale to anyone else');
year(); cash = p.finance.cash; horse.tickEquestrian(); horse.tickEquestrian();
check(cash - p.finance.cash === horse.leaseFee(h) && care.ledgerOf(h.id).filter((t) => t.kind === 'lease').length === 2, 'the lease renews once a year');
r = horse.endLease(h.id);
check(r.ok && !S().npcs[h.id] && h.forSale && zoo.homeOf(h).key === horse.stable().id && h.status === 'living' && zoo.albumAnimals().some((x) => x.id === h.id), 'when it ends the horse stays at the yard, for sale again, and in the family album');
{ const prev = h.id; h = horse.horsesForSale().find((x) => x.id !== prev && horse.horseCheck(x.id).ok) ?? horse.horsesForSale().find((x) => horse.horseCheck(x.id).ok);
  h.born = S().year - 8; for (const sk of SPECIES[h.speciesId].training) h.training[sk.id] = { progress: 100, sessions: 1, firstYear: h.born, learnedYear: h.born + 3, by: null }; }
horse.buyHorse(h.id); S().npcs[h.id].age = 8;
check(!horse.sellable(h).ok, 'a horse cannot be sold the year it was bought');
year(); const paid = care.ledgerOf(h.id).filter((t) => t.kind !== 'sale').reduce((s, t) => s + t.amount, 0);
const offer = horse.sellable(h);
cash = p.finance.cash; r = horse.sellHorse(h.id);
check(r.ok && p.finance.cash - cash === offer.price && !S().npcs[h.id] && h.status === 'living' && zoo.ownerOf(h).name && !zoo.ownerOf(h).id && lastOf('placed', h.id), 'sold to a private buyer: paid once, the horse leaves the player\'s life and stays on the record');
check(!horse.sellHorse(h.id).ok && care.ledgerOf(h.id).filter((t) => t.kind === 'sale').length === 1 && offer.price < paid, `it cannot be sold twice, and selling recovers less than it cost (${offer.price} of ${paid})`);
clean('leasing and selling');
section('horses: leased a year at a time, sold once and for less than they cost');

// ---------- 8. Businesses ----------
p = adult(30, 200000);
check(!biz.canStart('riding').ok && !biz.canStart('boarding').ok && !biz.canStart('grooming').ok && biz.canStart('petcare').ok, 'a riding school, kennels or salon need the right experience and land; pet sitting does not');
cash = p.finance.cash; r = biz.start('petcare');
let firm = biz.businesses()[r.id];
check(r.ok && cash - p.finance.cash === biz.canStart('grooming').cost || (r.ok && cash > p.finance.cash), 'opening costs the owner the start-up money');
check(!biz.start('petcare').ok, 'one of each kind');
const before = p.finance.cash;
let total = 0; let drawn = 0;
for (let i = 0; i < 12; i++) { year(); biz.tickBusinesses(); biz.tickBusinesses(); if (firm.closed) break; if (firm.cash > 0) { const take = firm.cash; drawn += take; biz.draw(firm.id, take); } }
total = firm.books.reduce((s, y) => s + y.profit, 0);
check(firm.books.length >= 3 && new Set(firm.books.map((y) => y.year)).size === firm.books.length, 'the business has one set of books a year, once');
check(firm.books.every((y) => y.profit <= y.revenue * 0.6) && firm.books.every((y) => !y.clients || y.clients <= 12 * (1 + firm.staff)), 'margins are modest and clients are limited by the hands available');
check(p.finance.cash - before <= drawn && (firm.draws ?? []).length > 0 && firm.draws.every((x) => x.tax === incomeTax(x.amount)), 'money reaches the owner only by drawing it, and each draw is taxed as income');
// Running it into the ground.
p = adult(30, 0); house('country'); p.flags.animalExperience = true; p.finance.cash = 100000;
r = biz.start('boarding'); firm = biz.businesses()[r.id]; p.finance.cash = 0; biz.setStaff(firm.id, 4); biz.setEffort(firm.id, 'easy');
for (let i = 0; i < 6 && !firm.closed; i++) { year(); biz.tickBusinesses(); }
check(firm.closed && /ran out of money/.test(firm.closed.why) && firm.cash === 0, 'a business that cannot pay its way, and is not rescued, closes');
check(S().npcs[firm.staffNpc] && /Used to work/.test(S().npcs[firm.staffNpc].flags.title), 'the person who worked there is still someone the player knows');
// A smallholding: its animals are a flock, and it lives or dies by their welfare.
p = adult(35, 300000); house('country'); r = biz.start('farm'); firm = biz.businesses()[r.id]; biz.invest(firm.id, 20000);
check(firm.livestock.hens > 0 && !zoo.allAnimals().length, 'a smallholding\'s flock is counted, not kept as pets');
check(!biz.stock(firm.id, 'goats', 50).ok, 'the land carries only so many');
biz.stock(firm.id, 'goats', 6);
for (let i = 0; i < 5; i++) { year(); biz.tickBusinesses(); }
const goodWelfare = firm.books.at(-1).welfare;
biz.stock(firm.id, 'sheep', 30); biz.stock(firm.id, 'hens', 48); biz.setEffort(firm.id, 'easy');
for (let i = 0; i < 4 && !firm.closed; i++) { year(); biz.tickBusinesses(); }
const after = firm.books.at(-1);
check(after.welfare < goodWelfare, `overstocked and neglected, the animals fare worse (${goodWelfare} → ${after.welfare})`);
// Inheritance.
p = adult(60, 300000); const kid = addKin('child', 30); r = biz.start('petcare'); firm = biz.businesses()[r.id]; year(); biz.tickBusinesses();
die('old age'); store.state = continueAs(kid.id);
check(biz.businesses()[firm.id].owner.id === P().id && !biz.businesses()[firm.id].closed && biz.myBusinesses().length === 1, 'an adult heir inherits the business');
clean('businesses');
section('businesses: their own books, modest margins, owner draws taxed, closure when they fail, welfare matters, inherited');

// ---------- 9. Bonds ----------
p = adult(); a = own('dog'); const w2 = addKin('spouse', 30); zoo.reconcile();
const d0 = zoo.bondDetail(a, p.id); const dw = zoo.bondDetail(a, w2.id);
check(d0 && dw && ['value', 'trust', 'comfort'].every((k) => typeof d0[k] === 'number'), 'each person\'s bond has attachment, trust and comfort');
for (let i = 0; i < 5; i++) { year(); S().animals.tickYear = null; zoo.tickAnimals(); }
check(zoo.bondDetail(a, p.id).comfort > d0.comfort && zoo.bondDetail(a, w2.id).comfort > dw.comfort, 'living together makes an animal used to people');
zoo.nudgeBond(a, p.id, { trust: -30 });
check(zoo.bondDetail(a, p.id).trust < d0.trust && zoo.bondDetail(a, w2.id).trust === dw.trust, 'one person losing an animal\'s trust does not touch another\'s');
section('bonds: attachment, trust and comfort, separately for each person');

// ---------- 10. Stories that take years ----------
p = adult(30); a = own('dog', (x) => { x.temperament.confidence = 20; });
year(); S().pendingEvents = []; arcs.tickArcs();
check(S().pendingEvents.some((e) => e.id === 'arc_rescue_nervous' && e.cast.pet === a.id), 'a year on, a nervous rescue\'s story continues');
const t0 = zoo.bondDetail(a, p.id).trust;
resolveChoice(getEvent('arc_rescue_nervous'), 0, { pet: a.id });
check(zoo.bondDetail(a, p.id).trust > t0, 'giving it space builds trust');
for (let i = 0; i < 5; i++) { year(); S().pendingEvents = []; arcs.tickArcs(); }
check(lastOf('settled', a.id) && arcs.arcsOf(a.id).find((x) => x.type === 'settling').done, 'and in time it settles: a moment on record, the story finished');
check(zoo.eventsOf(a.id).filter((e) => e.type === 'settled').length === 1, 'once');
// Remembrance.
p = adult(); a = own('dog'); S().npcs[a.id].meters.relationship = 90; zoo.reconcile(); S().npcs[a.id].alive = false; zoo.reconcile();
year(); S().pendingEvents = []; arcs.tickArcs();
const rem = S().pendingEvents.find((e) => e.id === 'arc_remembrance');
check(rem && rem.cast.pet === a.id && rem.cast.words.pet === a.name, 'a year after a beloved animal dies, they are remembered');
resolveChoice(getEvent('arc_remembrance'), 1, rem.cast);
check(zoo.eventsOf(a.id).some((e) => e.type === 'memorial') && S().journal.at(-1).animal?.id === a.id, 'the remembering is on record and tied to the life story');
year(); S().pendingEvents = []; arcs.tickArcs(); check(!S().pendingEvents.some((e) => e.id === 'arc_remembrance'), 'and is not repeated');
// A lifelong bond.
p = adult(); a = own('cat'); a.homes.find((h) => h.hh === 'player').from = S().year - 9; zoo.nudgeBond(a, p.id, { value: 60, comfort: 60 }); S().npcs[a.id].meters.relationship = 95;
zoo.reconcile(); S().pendingEvents = []; S().animals.arcYear = null; arcs.tickArcs();
check(lastOf('bond', a.id)?.sig === 3, 'years of closeness are noticed, once');
// The instructor's suggestion.
p = adult(20, 200000); for (let i = 0; i < 5; i++) { year(); horse.takeLessons('hacking'); } for (const k of Object.keys(p.riding.skills)) p.riding.skills[k] = 45;
S().pendingEvents = []; S().animals.arcYear = null; arcs.tickArcs();
const sug = S().pendingEvents.find((e) => e.id === 'arc_instructor_suggests');
check(sug && S().npcs[sug.cast.teacher]?.flags.tag === 'riding', 'a rider who is ready is told so, by the instructor they know');
resolveChoice(getEvent('arc_instructor_suggests'), 0, sug.cast);
check(p.riding.record.length === 1, 'and saying yes means riding in a show');
clean('arcs');
section('story arcs: begin from the record, continue across years, end once');

// ---------- 11. Whole lives with everything switched on ----------
let seen = 0; let scenes = 0; let firms = 0;
for (let i = 0; i < 4; i++) {
  rng.seed(12000 + i);
  store.state = createLife({ countryId: ['us', 'uk', 'au', 'de'][i] });
  for (let y = 0; y < 140; y++) {
    advanceYear();
    while (S().pendingEvents.length) { const pe = S().pendingEvents.shift(); const e2 = getEvent(pe.id); if (e2 && P().alive) { if (e2.category === 'animals') scenes += 1; const ok2 = e2.choices.map((c, k) => k).filter((k) => !e2.choices[k].requires?.length); resolveChoice(e2, rng.pick(ok2), pe.cast); } }
    if (!P().alive) { const hr = heirs()[0]; if (!hr) break; store.state = continueAs(hr.id); }
    const pl = P();
    if (pl.age === 30 && !heirs().length) { const k = addKin('child', 1); k.parentIds = []; }
    if (pl.age >= 18) {
      pl.finance.cash += 3000;
      if (rng.chance(0.15)) { const s2 = care.shelterAnimals().find((x) => care.adoptionCheck(x.id).ok); if (s2) care.adopt(s2.id); }
      for (const x of zoo.allAnimals().filter((q) => q.status === 'living' && S().npcs[q.id])) {
        if (rng.chance(0.3)) { const o = life.outingsFor(x.id).find((q) => !q.done); if (o) life.outing(x.id, o.id); }
        if (rng.chance(0.2)) { const c3 = life.coursesFor(x.id).find((q) => q.ok); if (c3) life.enrol(x.id, c3.id); }
        if (life.behaviourOf(x) && rng.chance(0.5)) life.helpWith(x.id, 'environment');
        if (rng.chance(0.2)) life.enterPetShow(x.id);
      }
      if (pl.age === 35 && biz.canStart('petcare').ok) { biz.start('petcare'); firms += 1; }
      for (const b of biz.myBusinesses()) if (b.cash > 0 && rng.chance(0.5)) biz.draw(b.id, Math.floor(b.cash / 2));
    }
    const bad = audits();
    if (bad.length) { check(false, `life ${i}, year ${S().year}: ${bad.slice(0, 4).join('; ')}`); break; }
  }
  seen += zoo.allAnimals().length;
}
check(seen >= 10 && scenes >= 10 && firms >= 1, `the long run saw enough (${seen} animals, ${scenes} animal scenes, ${firms} businesses)`);
section(`whole lives: 4 families, ${seen} animals, ${scenes} animal scenes, every record sound every year`);

for (const line of ok) console.log(`ok   ${line}`);
if (problems.length) { for (const x of problems) console.log(`FAIL ${x}`); process.exit(1); }
console.log('Life with animals holds together.');
