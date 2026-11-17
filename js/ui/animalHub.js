// Pets & Animals: the hub for everything the family does with animals, built
// on the same screens and the same way back as the album (ui/animals.js).
//
//   Pets & Animals → My animals → an animal
//                  → Adopt & rescue → a shelter → an animal waiting there → adopt or foster
//                  → Riding → lessons, the yard and its horses, the year's shows
//                  → Veterinary, Training, Memories
import { store, player } from '../state.js';
import { esc, cap, fmtMoney, localCost } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { speciesOf, TEMPERAMENT, DISCIPLINES, SHOW_LEVELS, RIDER_SKILLS } from '../data/animals.js';
import * as zoo from '../engine/animals.js';
import * as care from '../engine/animalCare.js';
import * as horse from '../engine/equestrian.js';
import * as stud from '../engine/animalBreeding.js';
import { extend, ui, animalFace, openScreen } from './animals.js';
import { messageModal, pickModal, confirmModal } from './modals.js';

const C = () => COUNTRIES[player().countryId];
const money = (n) => fmtMoney(n, C());
const kv = (rows) => rows.filter((r) => r && r[1] != null && r[1] !== '').map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`).join('');
const row = (a, sub, side = '', attr = `data-animal="${a.id}"`) => `<button class="row" ${attr}>${animalFace(a)}<div class="main"><strong>${a.status === 'living' ? '' : '† '}${esc(a.name)}</strong><small>${esc(sub)}</small></div>${side ? `<div class="side">${side}</div>` : ''}</button>`;
const go = (screen, label, sub, glyph, params = '') => `<button class="row" data-do="go" data-screen="${screen}" ${params}><div class="avatar glyph">${glyph}</div><div class="main"><strong>${esc(label)}</strong><small>${esc(sub)}</small></div></button>`;
const kind = (a) => `${cap(speciesOf(a.speciesId).name)}${zoo.breedLabel(a) ? ` · ${zoo.breedLabel(a)}` : ''}`;
const age = (a) => { const n = zoo.ageOf(a); return n < 1 ? 'under a year' : `${n} yr`; };
const mine = () => zoo.allAnimals().filter((a) => a.status === 'living' && a.inCircle && store.state.npcs[a.id]);
const notes = (xs, cls = '') => (xs.length ? `<ul class="zoo-list ${cls}">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

// ---------- The hub ----------

function hub() {
  const here = mine();
  const p = player();
  const c = C();
  const due = here.filter((a) => care.vetServices(a.id).some((s) => s.id === 'wellness' && !s.done));
  const fostering = here.filter((a) => a.foster);
  const spent = care.spentThisYear();
  return { title: 'Pets & Animals', sub: 'Every companion has a story.', body: `
    ${here.length ? `<div class="card"><h3>This year</h3>${kv([['Animals in your life', String(here.length)], ['In your household', String(zoo.householdAnimals().length)],
    ['Fostering', fostering.length ? esc(fostering.map((a) => a.name).join(', ')) : ''], ['Spent on them so far', spent ? money(spent) : ''],
    ['Due a check-up', due.length ? esc(due.map((a) => a.name).join(', ')) : ''], ['Room in the household', `${Math.max(0, care.careCapacity().free).toFixed(1)} of ${care.careCapacity().total.toFixed(1)}`]])}</div>`
    : `<p class="empty">${p.age < 18 ? 'There are no animals in your life yet. Any animal here would be the family\'s decision.' : 'There are no animals in your life yet.'}</p>`}
    ${go('mine', 'My animals', here.length ? here.map((a) => a.name).join(', ') : 'Nobody yet', '🐾')}
    ${go('adopt', 'Adopt & rescue', `${care.shelter().name}${p.age < 18 ? ' · for adults' : ''}`, '🏡')}
    ${here.length ? go('care', 'Animal care', 'Routines, costs and insurance', '🧺') : ''}
    ${here.length ? go('training', 'Training', 'What each animal has learned', '🎓') : ''}
    ${go('riding', 'Equestrian', horse.rides() ? `${horse.levelName(horse.riderLevel())} rider` : horse.school().name, '🏇')}
    ${here.length ? go('vet', 'Veterinary', care.clinic().name, '🩺') : ''}
    ${go('album', 'Animal memories', 'Our Animal Family: the album and the timeline', '📖')}
    <p class="muted zoo-note">Feeding, water, walks and the everyday are seen to without being asked. ${esc(c.name)} prices.</p>` };
}

function myAnimals() {
  const here = mine();
  const elsewhere = zoo.allAnimals().filter((a) => a.status === 'living' && !here.includes(a));
  const sub = (a) => `${kind(a)} · ${age(a)} · ${zoo.familyLink(a)}`;
  return { title: 'My animals', sub: 'Those who are part of your life now.', body: `
    ${here.length ? here.map((a) => row(a, sub(a), store.state.npcs[a.id] ? `${Math.round(store.state.npcs[a.id].meters.relationship)}%` : '')).join('') : '<p class="empty">Nobody yet.</p>'}
    ${elsewhere.length ? `<div class="section-label">Elsewhere</div>${elsewhere.map((a) => row(a, `${kind(a)} · ${zoo.familyLink(a)}`)).join('')}` : ''}` };
}

// ---------- Adopting ----------

function adopt() {
  const p = player();
  const shelters = [care.shelter(), care.farmRescue()];
  return { title: 'Adopt & rescue', sub: 'The animals waiting near you are the same ones from one visit to the next.', body: `
    ${p.age < 18 ? '<p class="muted zoo-note">You can look. Taking one home is for the adults of the house to decide.</p>' : ''}
    <div class="btn-stack" style="margin-bottom:10px"><button class="btn" data-do="volunteer" ${p.flags.volunteeredAge === p.age || p.age < 14 ? 'disabled' : ''}>Volunteer at ${esc(care.shelter().name)}${p.flags.volunteeredAge === p.age ? ' · done this year' : p.age < 14 ? ' · from age 14' : ''}</button></div>
    ${shelters.map((sh) => {
    const list = care.shelterAnimals(sh);
    return `<div class="section-label">${esc(sh.name)}</div>
      <p class="muted zoo-note">${esc(sh.staff.map((x) => `${x.name} (${x.role.toLowerCase()})`).join(', '))}. Founded ${sh.founded}.</p>
      ${list.length ? list.map((a) => row(a, `${kind(a)} · ${age(a)} · ${zoo.temperamentWords(a).slice(0, 2).join(', ')}`, care.adoptionCheck(a.id).ok ? '' : '<small>Not for you</small>', `data-do="go" data-screen="waiting" data-id="${a.id}"`)).join('') : '<p class="empty">Nobody is waiting just now.</p>'}`;
  }).join('')}` };
}

function waiting(step) {
  const a = zoo.animalById(step.params.id);
  if (!a || a.inCircle || a.status !== 'living') return { title: 'Gone', body: '<p class="empty">This animal has found a home.</p>' };
  const sp = speciesOf(a.speciesId);
  const chk = care.adoptionCheck(a.id); const fchk = care.adoptionCheck(a.id, { foster: true });
  const sh = chk.shelter;
  return { title: a.name, sub: `Waiting at ${sh.name}`, body: `
    <div class="zoo-hero">${animalFace(a, 'big')}<div class="main"><small>${esc(kind(a))}${a.sex ? ` · ${a.sex}` : ''}</small><small>About ${esc(age(a))} · ${esc(zoo.stageOf(a))}</small><small>${esc(a.origin.history ?? '')}</small></div></div>
    <div class="section-label">What ${esc(zoo.pronoun(a))} is like</div>
    <div class="chips">${zoo.temperamentWords(a).map((w) => `<span class="chip">${esc(cap(w))}</span>`).join('')}</div>
    ${Object.entries(a.temperament).slice(0, 5).map(([d, v]) => `<div class="zoo-dim"><span>${esc(cap(TEMPERAMENT[d].low))}</span><i><b style="left:${v}%"></b></i><span>${esc(cap(TEMPERAMENT[d].high))}</span></div>`).join('')}
    <div class="section-label">Appearance</div>${notes(zoo.describeLooks(a))}
    <div class="section-label">What ${esc(zoo.pronoun(a))} needs</div>${notes(sp.needs)}<p class="muted zoo-note">${esc(sp.housing)}</p>
    <div class="section-label">Taking ${esc(zoo.pronoun(a, 'them'))} home</div>
    ${kv([['Adoption fee', money(chk.fee)], ['A year of everyday care', `about ${money(chk.yearly)}`], ['Insurance', sp.insure ? 'Available' : 'Not sold for this animal']])}
    ${chk.problems.length ? `<div class="zoo-warn">${notes(chk.problems)}</div>` : ''}${notes(chk.notes)}
    <div class="btn-stack">
      ${chk.ok ? `<button class="btn primary" data-do="adopt" data-id="${a.id}">Adopt ${esc(a.name)} (${money(chk.fee)})</button>` : ''}
      ${fchk.ok && sp.group === 'companion' && !sh.farm ? `<button class="btn" data-do="foster" data-id="${a.id}">Foster ${esc(a.name)} for ${esc(sh.name)}</button>` : ''}
    </div>` };
}

// ---------- Care, training, the vet ----------

function careScreen() {
  const here = mine().filter((a) => care.paysFor(a) || a.foster);
  const total = here.reduce((s, a) => s + (a.foster ? care.yearlyCost(a).care : care.yearlyCost(a).total), 0);
  return { title: 'Animal care', sub: 'Everyday care is done for you. This is what goes into it.', body: `
    ${here.length ? here.map((a) => row(a, `${a.foster ? 'Fostering' : care.paysFor(a) ? ({ standard: 'Standard care', enriched: 'Extra enrichment', senior: 'Senior care' })[a.routine ?? 'standard'] : ''}${a.insurance ? ' · insured' : ''}${a.board ? ` · at ${a.board.name}` : ''}`, money(a.foster ? care.yearlyCost(a).care : care.yearlyCost(a).total), `data-animal="${a.id}" data-tab-to="care"`)).join('')
    + `<div class="kv" style="margin-top:6px"><span>Altogether, a year</span><span><strong>${money(total)}</strong></span></div>`
    : '<p class="empty">There are no animals you are responsible for.</p>'}
    <p class="muted zoo-note">If money runs short, what there is goes on the animals first, and the low-cost clinic and the food bank help with the rest.</p>` };
}
function training() {
  const here = mine().filter((a) => zoo.trainingOf(a).length);
  return { title: 'Training', sub: 'Short, kind sessions. A little each year.', body: here.length ? here.map((a) => {
    const t = zoo.trainingOf(a); const done = t.filter((x) => x.progress >= 100).length;
    return row(a, `${done} of ${t.length} learned${t.find((x) => x.progress > 0 && x.progress < 100) ? ` · working on ${t.find((x) => x.progress > 0 && x.progress < 100).name.toLowerCase()}` : ''}`, '', `data-animal="${a.id}" data-tab-to="training"`);
  }).join('') : '<p class="empty">None of your animals has anything to learn.</p>' };
}
function vet() {
  const cl = care.clinic();
  const here = mine().filter((a) => care.vetServices(a.id).length);
  return { title: cl.name, sub: `${cl.vets.map((v) => v.name).join(', ')}.${cl.lowCost ? ' Offers lower fees to those who need them.' : ''}`, body: here.length ? here.map((a) => {
    const s = care.vetServices(a.id); const open = s.filter((x) => !x.done);
    return row(a, `${a.lastCheck != null ? `Last check-up ${a.lastCheck}` : 'No check-up on record'}${a.vaccinated != null ? ` · vaccinated ${a.vaccinated}` : ''}`, open.length ? `${open.length} available` : 'Up to date', `data-animal="${a.id}" data-tab-to="health"`);
  }).join('') + '<p class="muted zoo-note">Open an animal to book a visit. Illness and emergencies are dealt with as they come.</p>' : '<p class="empty">None of your animals needs a vet you can book.</p>' };
}

// ---------- Riding ----------

function riding(step) {
  const p = player();
  const sc = horse.school(); const yard = horse.stable();
  const tab = step.ui.tab ?? 'school';
  const r = p.riding;
  const can = horse.canLearn();
  const lvl = horse.riderLevel();
  const bodies = {
    school: () => `
      <div class="card"><h3>${esc(sc.name)}</h3>${kv([['Instructor', `${esc(sc.instructor.name)}, teaching for ${sc.instructor.years} years`], ['A year of weekly lessons', `${money(localCost(1500 * sc.priceK, C()))}${p.age < 18 ? ' (for your parents to decide)' : ''}`]])}</div>
      ${r ? `<div class="card"><h3>You, in the saddle</h3>${kv([['Level', `${esc(horse.levelName(lvl))} (${lvl})`], ['Years of lessons', String(r.lessons)], ['Falls', String(r.falls)]])}
        ${Object.entries(RIDER_SKILLS).map(([k, n]) => `<div class="kv"><span>${esc(n)}</span><span>${r.skills[k]}</span></div>`).join('')}
        ${Object.keys(r.disciplines).length ? `<div class="section-label">Ways of riding</div>${Object.keys(r.disciplines).map((d) => `<div class="kv"><span>${esc(DISCIPLINES[d].name)}</span><span>${horse.disciplineSkill(d)}</span></div>`).join('')}` : ''}</div>` : '<p class="muted zoo-note">You have never ridden. You do not need a horse of your own to learn: the school\'s horses teach beginners.</p>'}
      <div class="btn-stack">${can.ok ? `<button class="btn primary" data-do="lessons">${r ? 'Take this year\'s lessons' : 'Start riding lessons'}</button>` : `<button class="btn" disabled>${esc(can.why)}</button>`}</div>
      <div class="section-label">The school's horses</div>${horse.schoolHorses(sc).map((a) => row(a, `${kind(a)} · ${age(a)}${r?.schoolHorse === a.id ? ' · the one you ride' : ''}`, '', zoo.allAnimals().includes(a) ? `data-animal="${a.id}"` : 'disabled')).join('')}`,
    yard: () => {
      const forSale = horse.horsesForSale();
      return `<div class="card"><h3>${esc(yard.name)}</h3>${kv([...yard.staff.map((x) => [x.role, esc(x.name)]), ['Livery, a year', money(horse.liveryFee())]])}</div>
        <div class="section-label">For sale</div>
        ${forSale.map((a) => { const chk = horse.horseCheck(a.id); return row(a, `${kind(a)} · ${age(a)} · ${horse.backed(a) ? 'ridden' : 'not yet backed'}`, `${money(chk.price)}${chk.ok ? '' : '<small>Not for you</small>'}`, `data-do="go" data-screen="horse" data-id="${a.id}"`); }).join('') || '<p class="empty">Nothing for sale.</p>'}`;
    },
    shows: () => {
      const list = horse.shows(); const mounts = horse.mounts();
      return `${list.map((s) => `<div class="card"><h3>${esc(s.name)}</h3>${kv([['Judge', esc(s.judge)], ['Organiser', esc(s.organiser)], ['Entries', String(s.entrants)], ['Entry fee', money(localCost(SHOW_LEVELS[s.level].fee, C()))], ['You need', `${SHOW_LEVELS[s.level].needs}+ in ${esc(DISCIPLINES[s.discipline].name.toLowerCase())} (you: ${horse.disciplineSkill(s.discipline)})`]])}
        ${s.result ? `<p class="zoo-note"><strong>${s.result.place === 1 ? 'Won' : `Placed ${s.result.place} of ${s.result.of}`}</strong> on ${esc(zoo.animalById(s.result.horseId)?.name ?? '')}.</p>`
    : `<div class="btn-stack">${mounts.map((m) => { const c = horse.showCheck(s.id, m.id); return `<button class="btn" data-do="enter" data-show="${s.id}" data-id="${m.id}" ${c.ok ? '' : 'disabled'}>Enter on ${esc(m.name)}${c.ok ? '' : ` · ${esc(c.problems[0])}`}</button>`; }).join('') || '<p class="muted zoo-note">You have no horse to enter on.</p>'}</div>`}</div>`).join('')}
      ${r?.record.length ? `<div class="section-label">Your results</div>${[...r.record].reverse().map((e) => `<div class="kv"><span>${e.year} · ${esc(e.horse)}</span><span>${e.place} of ${e.of}: ${esc(e.name)}</span></div>`).join('')}` : ''}`;
    },
  };
  return { title: 'Equestrian', sub: 'Lessons, horses and the show ring.', tabs: [['school', 'Lessons'], ['yard', 'Horses'], ['shows', 'Shows']], tab, body: bodies[tab]() };
}

function horseForSale(step) {
  const a = zoo.animalById(step.params.id);
  if (!a?.forSale || a.inCircle) return { title: 'Sold', body: '<p class="empty">This horse has been sold.</p>' };
  const chk = horse.horseCheck(a.id);
  return { title: a.name, sub: `For sale at ${horse.stable().name}`, body: `
    <div class="zoo-hero">${animalFace(a, 'big')}<div class="main"><small>${esc(kind(a))}${a.sex ? ` · ${a.sex}` : ''}</small><small>${esc(age(a))} · ${esc(zoo.stageOf(a))}</small><small>${esc(a.origin.history ?? '')}</small></div></div>
    <div class="chips">${zoo.temperamentWords(a).map((w) => `<span class="chip">${esc(cap(w))}</span>`).join('')}</div>
    <div class="section-label">Schooling</div>${zoo.trainingOf(a).map((s) => `<div class="kv"><span>${esc(s.name)}</span><span>${s.progress >= 100 ? 'Yes' : s.progress ? `${s.progress}%` : 'No'}</span></div>`).join('')}
    ${Object.entries(a.schooling ?? {}).map(([d, v]) => `<div class="kv"><span>${esc(DISCIPLINES[d].name)}</span><span>${v}</span></div>`).join('')}
    <div class="section-label">Buying</div>${kv([['Price', money(chk.price)], ['A year\'s keep', `about ${money(chk.yearly)}`]])}
    ${chk.problems.length ? `<div class="zoo-warn">${notes(chk.problems)}</div>` : ''}${notes(chk.notes)}
    ${chk.ok ? `<div class="btn-stack"><button class="btn primary" data-do="buy" data-id="${a.id}">Buy ${esc(a.name)} (${money(chk.price)})</button></div>` : ''}` };
}

// ---------- Pedigree ----------

function pedigreeScreen(step) {
  const a = zoo.animalById(step.params.id);
  const box = (t, label) => (t ? `<button class="zoo-ped" data-animal="${t.animal.id}">${animalFace(t.animal)}<span><small>${esc(label)}</small><strong>${esc(t.animal.name)}</strong><small>${esc(zoo.breedLabel(t.animal) || cap(speciesOf(t.animal.speciesId).name))}${t.animal.born != null ? ` · b. ${t.animal.born}` : ''}</small></span></button>`
    : `<div class="zoo-ped unknown"><span><small>${esc(label)}</small><strong>Not recorded</strong></span></div>`);
  const t = stud.pedigree(a, 2);
  const kids = stud.offspringOf(a.id);
  return { title: `${a.name}'s family`, sub: { recorded: 'Both parents on record.', part: 'One parent on record.', unknown: 'No parentage was recorded.' }[stud.parentage(a)], body: `
    <div class="zoo-tree">${box(t, 'This animal')}
      <div class="zoo-tree-row">${box(t.dam, 'Dam')}${box(t.sire, 'Sire')}</div>
      <div class="zoo-tree-row">${box(t.dam?.dam, 'Dam\'s dam')}${box(t.dam?.sire, 'Dam\'s sire')}${box(t.sire?.dam, 'Sire\'s dam')}${box(t.sire?.sire, 'Sire\'s sire')}</div></div>
    <p class="muted zoo-note">Only what was written down. A breed name alone is not a pedigree.</p>
    ${kids.length ? `<div class="section-label">Offspring</div>${kids.map((k) => row(k, `${kind(k)} · born ${k.born} · ${zoo.familyLink(k)}`)).join('')}` : ''}` };
}

// ---------- What the buttons do ----------

const tell = async (r) => { ui.api?.changed(); await messageModal({ body: r.text, tone: r.tone }); };
async function after(r, screenIfOk) {
  ui.note(); ui.shut();
  await tell(r);
  if (r.ok && r.animalId && screenIfOk === 'profile') { ui.nav.back(); ui.nav.open('profile', { animalId: r.animalId }); }
  ui.show();
}

extend({
  screens: { hub, mine: myAnimals, adopt, waiting, care: careScreen, training, vet, riding, horse: horseForSale, pedigree: pedigreeScreen },
  doers: {
    go: (d) => { ui.note(); if (d.screen === 'album') ui.nav.open('album'); else ui.nav.open(d.screen, d.id ? { id: d.id } : {}); ui.show(); },
    adopt: async (d) => {
      const a = zoo.animalById(d.id); const chk = care.adoptionCheck(d.id);
      ui.shut();
      const yes = await confirmModal({ title: `Adopt ${a.name}?`, body: `${money(chk.fee)} to ${chk.shelter.name}, and about ${money(chk.yearly)} a year after that. ${a.name} will be yours for the rest of ${zoo.pronoun(a, 'their')} life.`, yes: `Adopt ${a.name}` });
      if (!yes) return ui.show();
      return after(care.adopt(d.id), 'profile');
    },
    foster: async (d) => {
      const a = zoo.animalById(d.id);
      ui.shut();
      const yes = await confirmModal({ title: `Foster ${a.name}?`, body: `${a.name} would live with you until a permanent home is found. The rescue pays the vet's bills; ${a.name} remains theirs. Every year you will be asked how it is going.`, yes: 'Foster' });
      if (!yes) return ui.show();
      return after(care.foster(d.id), 'profile');
    },
    lessons: async () => {
      let focus = 'hacking';
      ui.shut();
      if (horse.riderLevel() >= 25) {
        focus = await pickModal({ title: 'What to work on this year', options: Object.entries(DISCIPLINES).map(([k, v]) => ({ value: k, label: v.name, sub: `${v.blurb} You: ${horse.disciplineSkill(k)}.` })) });
        if (!focus) return ui.show();
      }
      return after(horse.takeLessons(focus));
    },
    buy: async (d) => {
      const a = zoo.animalById(d.id); const chk = horse.horseCheck(d.id);
      ui.shut();
      const yes = await confirmModal({ title: `Buy ${a.name}?`, body: `${money(chk.price)}, then about ${money(chk.yearly)} a year${chk.ownLand ? '' : `, including livery at ${horse.stable().name}`}. A horse can live for thirty years.${chk.mismatch ? ` ${a.name} is more horse than you are rider, for now.` : ''}`, yes: `Buy ${a.name}` });
      if (!yes) return ui.show();
      return after(horse.buyHorse(d.id), 'profile');
    },
    volunteer: async () => { ui.note(); ui.shut(); await tell(care.volunteer()); ui.show(); },
    enter: async (d) => { ui.note(); ui.shut(); await tell(horse.enterShow(d.show, d.id)); ui.show(); },
  },
  actions: (a) => [
    ...horse.horseActions(a),
    ...(stud.BREEDING[a.speciesId] && a.sex === 'female' && care.paysFor(a) && !a.pregnancy && player().age >= 18 ? [{ id: 'breed', label: `Breed from ${a.name}` }] : []),
    ...(a.pregnancy ? [{ id: 'expecting', label: `${a.name} is expecting, due ${a.pregnancy.due}` }] : []),
    ...(stud.parentage(a) !== 'unknown' || stud.offspringOf(a.id).length ? [{ id: 'pedigree', label: 'Family tree' }] : []),
  ],
  acts: {
    ride: async (a) => {
      const d = await pickModal({ title: `A year riding ${a.name}`, options: Object.entries(DISCIPLINES).map(([k, v]) => ({ value: k, label: v.name, sub: horse.tooHard(a, k) ? `${a.name} is too old for this.` : `${v.blurb} ${a.name}: ${a.schooling?.[k] ?? 0}. You: ${horse.disciplineSkill(k)}.`, disabled: horse.tooHard(a, k) })) });
      return d ? horse.ride(a.id, d) : null;
    },
    moveHorse: async (a) => horse.moveHorse(a.id),
    breed: async (a) => {
      const sires = stud.sires(a.id);
      const id = await pickModal({ title: `A sire for ${a.name}`, body: 'Young that cannot stay will go to homes chosen with care. Nothing is sold.',
        options: sires.map((x) => { const c = stud.breedingCheck(a.id, x.id); return { value: x.id, label: `${x.name}${x.stud ? ' (at stud)' : ''}`, sub: c.ok ? `${zoo.breedLabel(x) || cap(speciesOf(x.speciesId).name)}, ${zoo.ageOf(x)} yr. ${c.fee ? `Stud fee ${money(c.fee)}. ` : ''}Birth and vet's care about ${money(c.birth)}.` : c.problems[0], disabled: !c.ok }; }) });
      return id ? stud.breed(a.id, id) : null;
    },
    expecting: async (a) => ({ ok: true, text: `${a.name} is expecting. The young are due next year.`, tone: 'neutral' }),
    pedigree: async (a) => { ui.nav.open('pedigree', { id: a.id }); ui.show(); return null; },
  },
});

/** Opens the hub. */
export const openAnimalHub = (tabApi) => openScreen(tabApi, 'hub');
