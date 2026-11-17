// The family's animals on screen: the album, the timeline, each animal's
// profile, the chronicle of a house, and the roads between them.
//
//   Family archive → Our Animal Family → an animal → its memories → the life story
//   Holdings → Household animals → an animal → shared memories → the house chronicle
//
// Every screen reads the family's record (engine/animals.js) as it stands;
// nothing shown here is kept anywhere else. Where the player is, and how each
// screen was left, is kept by animalNav.js, so going back returns to the same
// animal, tab, filters, open memory and place on the page.
import { store, player } from '../state.js';
import { esc, cap, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import * as zoo from '../engine/animals.js';
import * as rel from '../engine/relationships.js';
import * as care from '../engine/animalCare.js';
import { ROUTINES } from '../data/animals.js';
import { fmtMoney } from '../util.js';
import { confirmModal } from './modals.js';
import { speciesOf, TEMPERAMENT, EVENT_TYPES } from '../data/animals.js';
import { animalPortraitSvg } from './animalPortrait.js';
import { avatarSvg } from './avatar.js';
import { band, meterHtml } from './meter.js';
import { openModal, messageModal, pickModal } from './modals.js';
import { createNav, backLabel } from './animalNav.js';
import { openFamilyTree } from './familyTree.js';

const nav = createNav();
let modal = null;
let api = null;
/** Set by the People tab: how to open a person's profile, and the stat editor. */
const hooks = { openPerson: null, editStats: null };
export const connect = (h) => Object.assign(hooks, h);

// ---------- Pieces ----------

const you = (r) => r?.id === player().id;
const known = (r) => !!r?.id && !you(r) && !!store.state.npcs[r.id];
const first = (r) => (you(r) ? 'You' : r.name.split(' ')[0]);
const senior = (a) => a.status === 'living' ? zoo.stageOf(a) === 'senior' : (a.ageAtDeath ?? 0) >= a.lifespan * 0.65;

/** An animal's portrait. Those who have died are shown as an old photograph. */
export const animalFace = (a, cls = '') => `<div class="avatar zoo-face ${a.status === 'living' ? '' : 'gone'} ${cls}">${animalPortraitSvg(a, { senior: senior(a) })}</div>`;

function personFace(r) {
  const p = player();
  const n = you(r) ? p : store.state.npcs[r.id];
  if (!n) return `<div class="avatar glyph zoo-initial">${esc(r.name.charAt(0))}</div>`;
  return `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, label: r.name })}</div>`;
}
/** A person named on a record. Tapping someone still in the player's life opens their profile. */
function personChip(r, note = '') {
  if (!r) return '';
  const text = `${you(r) ? 'You' : esc(r.name)}${note ? ` · ${esc(note)}` : ''}`;
  return known(r) ? `<button class="chip link" data-person="${r.id}">${text}</button>` : `<span class="chip ${you(r) ? 'you' : ''}">${text}</span>`;
}
const span = (x) => (x.closed ? 'years not recorded' : `${x.from ?? 'earlier'} – ${x.to ?? 'now'}`);
const place = (h) => [h.city, h.countryId && COUNTRIES[h.countryId] ? theCountry(COUNTRIES[h.countryId].name) : null].filter(Boolean).join(', ');
const seg = (key, value, options) => `<div class="chips zoo-filter" role="group">${options.map(([v, label]) =>
  `<button class="chip pickable ${v === value ? 'on' : ''}" data-set="${key}:${esc(v)}" aria-pressed="${v === value}">${esc(label)}</button>`).join('')}</div>`;

/** One moment from the record. Tapping it opens who was there, what each remembers, and where it is told. */
function eventRow(e, ui, { showAnimal = true, chronicle = true } = {}) {
  const a = zoo.animalById(e.animalId);
  const t = EVENT_TYPES[e.type];
  const open = ui.open === e.id;
  const mine = e.gen === (player().generation ?? 1);
  const detail = !open ? '' : `
    <div class="zoo-detail">
      ${e.people.length ? `<div class="section-label">Who was there</div><div class="chips">${e.people.map((r) => personChip(r)).join('')}</div>` : ''}
      ${e.homeLabel ? `<div class="kv"><span>Where</span><span>${esc(e.homeLabel)}${e.place?.city ? `, ${esc(e.place.city)}` : ''}</span></div>` : ''}
      ${mine ? '' : `<div class="kv"><span>From the life of</span><span>${esc(e.narrator.name)}</span></div>`}
      ${e.memories.length ? `<div class="section-label">How it is remembered</div>${e.memories.map((m) =>
    `<p class="zoo-memory"><strong>${esc(first(m.who))}</strong> ${esc(you(m.who) ? m.you : m.they)}</p>`).join('')}` : ''}
      <div class="btn-stack">
        ${showAnimal ? `<button class="btn" data-animal="${a.id}" data-tab-to="memories" data-open-to="${e.id}">${esc(a.name)}'s profile</button>` : ''}
        ${e.story ? `<button class="btn" data-story="${e.id}">${mine ? 'Read it in your life story' : `Read it in ${esc(e.narrator.name.split(' ')[0])}'s life story`}</button>` : ''}
        ${chronicle && e.home && e.home !== 'rescue' && !e.home.startsWith('with:') ? `<button class="btn" data-chronicle="${esc(e.home)}">The chronicle of this house</button>` : ''}
      </div>
    </div>`;
  return `<div class="zoo-event ${open ? 'open' : ''}" data-ev="${e.id}">
    <button class="zoo-event-head" data-open="${e.id}" aria-expanded="${open}">
      <span class="glyph" aria-hidden="true">${t?.glyph ?? '•'}</span>
      <span class="main"><strong>${esc(zoo.eventLabel(e))}${showAnimal ? ` · ${esc(a.name)}` : ''}</strong><small>${esc(e.text)}</small></span>
      <span class="year">${e.year}</span>
    </button>${detail}</div>`;
}
const byYear = (events, row) => {
  let year = null;
  return events.map((e) => `${e.year !== year ? `<div class="section-label">${(year = e.year)}</div>` : ''}${row(e)}`).join('');
};

// ---------- Screens ----------
// Each returns { title, sub, tabs?, body }.

function archive() {
  const n = zoo.allAnimals().length;
  return { title: 'Family archive', sub: 'What the family keeps.', body: `
    <button class="row" data-go="album"><div class="avatar glyph">🐾</div>
      <div class="main"><strong>Our Animal Family</strong><small>Every paw print leaves a memory.</small></div>
      <div class="side">${n || ''}</div></button>
    <button class="row" data-go="tree"><div class="avatar glyph">🌳</div>
      <div class="main"><strong>Family tree</strong><small>Every relative, living or dead.</small></div></button>` };
}

function card(a) {
  const sp = speciesOf(a.speciesId);
  const home = zoo.homeOf(a) ?? a.homes[a.homes.length - 1];
  const carers = zoo.caregiversOf(a).slice(0, 4);
  const miles = zoo.milestonesOf(a.id).slice(-4);
  const breed = zoo.breedLabel(a);
  return `<article class="zoo-card ${a.status === 'living' ? '' : 'gone'}">
    <button class="zoo-portrait" data-animal="${a.id}" aria-label="Open ${esc(a.name)}'s profile">${animalFace(a)}</button>
    <div class="main">
      <button class="zoo-name" data-animal="${a.id}">${a.status === 'living' ? '' : '† '}${esc(a.name)}</button>
      <small>${esc(cap(sp.name))}${breed ? ` · ${esc(breed)}` : ''}</small>
      <small>${esc(zoo.lifeDates(a))}</small>
      ${home ? `<small>${a.status === 'living' ? 'Lives at' : 'Lived at'} ${esc(home.label.replace(/^The /, 'the ').replace(/^A /, 'a '))}${place(home) ? `, ${esc(place(home))}` : ''}</small>` : ''}
      <small class="zoo-link">${esc(zoo.familyLink(a))}</small>
      ${carers.length ? `<div class="chips">${carers.map((c) => personChip(c.who, c.current ? (c.role === 'primary' ? 'main caregiver' : 'helps') : 'formerly')).join('')}</div>` : ''}
      ${miles.length ? `<ul class="zoo-miles">${miles.map((e) => `<li><span>${e.year}</span> ${esc(zoo.eventLabel(e))}</li>`).join('')}</ul>`
    : '<small>In the family before these records were kept.</small>'}
    </div>
  </article>`;
}

function album(step) {
  const ui = step.ui;
  const view = ui.tab ?? 'album';
  const all = zoo.allAnimals();
  const speciesHere = [...new Set(all.map((a) => a.speciesId))];
  let body;
  if (!all.length) {
    body = `<p class="empty">No animal has shared this family's life yet.<br>When one does, it is kept here for good.</p>`;
  } else if (view === 'album') {
    const list = zoo.albumAnimals(store.state, { show: ui.show ?? 'all', species: ui.species ?? 'all' });
    body = `${seg('show', ui.show ?? 'all', [['all', `All ${all.length}`], ['living', 'Living'], ['remembered', 'Remembered']])}
      ${speciesHere.length > 1 ? seg('species', ui.species ?? 'all', [['all', 'Every kind'], ...speciesHere.map((s) => [s, cap(speciesOf(s).name)])]) : ''}
      ${list.length ? list.map(card).join('') : '<p class="empty">None to show with these filters.</p>'}`;
  } else {
    const events = zoo.timeline(store.state, { type: ui.type ?? 'all', animalId: ui.animal ?? 'all' });
    const types = [...new Set(zoo.timeline().map((e) => e.type))];
    const inIt = all.filter((a) => zoo.eventsOf(a.id).length);
    body = `${types.length > 1 ? seg('type', ui.type ?? 'all', [['all', 'Everything'], ...types.map((t) => [t, EVENT_TYPES[t].label])]) : ''}
      ${inIt.length > 1 ? seg('animal', ui.animal ?? 'all', [['all', 'Every animal'], ...inIt.map((a) => [a.id, a.name])]) : ''}
      ${events.length ? byYear(events, (e) => eventRow(e, ui)) : '<p class="empty">Nothing on record yet. Adoptions, first lessons, moves, recoveries and goodbyes are written here as they happen.</p>'}`;
  }
  return { title: 'Our Animal Family', sub: 'Every paw print leaves a memory.', tabs: [['album', 'Album'], ['timeline', 'Timeline']], tab: view, body };
}

const TABS = [['overview', 'Overview'], ['bond', 'Bond'], ['care', 'Care'], ['training', 'Training'], ['health', 'Health'], ['memories', 'Memories'], ['history', 'History']];

function profile(step) {
  const a = zoo.animalById(step.params.animalId);
  const ui = step.ui;
  const tab = ui.tab ?? 'overview';
  const sp = speciesOf(a.speciesId);
  const npc = store.state.npcs[a.id];
  const alive = a.status === 'living';
  const owner = zoo.ownerOf(a) ?? a.ownerships[a.ownerships.length - 1]?.who;
  const main = zoo.primaryOf(a);
  const home = zoo.homeOf(a) ?? a.homes[a.homes.length - 1];
  const breed = zoo.breedLabel(a);
  const kv = (rows) => rows.filter((r) => r && r[1]).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`).join('');
  const their = zoo.pronoun(a, 'their');

  const head = `<div class="zoo-hero">
      ${animalFace(a, 'big')}
      <div class="main"><small>${esc(cap(sp.name))}${breed ? ` · ${esc(breed)}` : ''}${a.sex ? ` · ${a.sex}` : ''}</small>
        <small>${esc(zoo.lifeDates(a))}${alive ? ` · ${esc(zoo.stageOf(a))}` : ''}</small>
        <small class="zoo-link">${esc(zoo.familyLink(a))}</small>
        ${alive ? '' : `<small>${a.memorial ? `Memorial made in ${a.memorial.year}` : 'Remembered in the family archive'}</small>`}</div>
    </div>`;

  const sections = {
    overview: () => {
      const o = a.origin;
      const came = { family: `Already in the household when ${esc(zoo.eventsOf(a.id)[0]?.narrator.name.split(' ')[0] ?? 'the family')} was born`, shelter: `Adopted from a shelter in ${esc(o.city ?? '')}, ${o.year}`,
        found: `Taken in, ${esc(o.city ?? '')}, ${o.year}`, unknown: 'Not recorded' }[o.how];
      return `<div class="section-label">About ${esc(a.name)}</div>
        ${kv([['Came to the family', came], o.fee ? ['Adoption fee', `${o.fee.toLocaleString('en-US')} ${esc(o.currency)}`] : null, ['Owner', owner ? personChip(owner) : 'Not recorded'],
    ['Main caregiver', alive && main ? personChip(main) : alive ? 'Not recorded' : ''], ['Home', home ? esc(home.label) : '']])}
        <div class="section-label">Appearance</div>
        <ul class="zoo-list">${zoo.describeLooks(a).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <div class="section-label">Personality</div>
        <div class="chips">${zoo.temperamentWords(a).map((w) => `<span class="chip">${esc(cap(w))}</span>`).join('')}</div>
        ${Object.entries(a.temperament).map(([d, v]) => `<div class="zoo-dim" role="img" aria-label="${esc(TEMPERAMENT[d].name)}: ${v} of 100"><span>${esc(cap(TEMPERAMENT[d].low))}</span><i><b style="left:${v}%"></b></i><span>${esc(cap(TEMPERAMENT[d].high))}</span></div>`).join('')}
        <p class="muted zoo-note">${esc(cap(their))} own character, not ${their} breed's.</p>`;
    },
    bond: () => {
      const carers = zoo.caregiversOf(a);
      const others = Object.entries(a.bonds).filter(([id]) => !carers.some((c) => c.who.id === id)).map(([id, b]) => ({ who: { id, name: b.name }, bond: b.value, other: true }));
      const row = (c) => {
        const what = c.other ? 'Family' : [owner?.id && c.who.id === owner.id ? (alive ? 'Owner' : 'Owner at the end') : '', c.role === 'primary' ? (c.current ? 'Main caregiver' : 'Was the main caregiver') : c.current ? 'Helps with care' : 'Helped with care', c.current ? '' : span(c)].filter(Boolean).join(' · ');
        const inner = `${personFace(c.who)}<div class="main"><strong>${you(c.who) ? 'You' : esc(c.who.name)}</strong><small>${esc(what)}</small></div>
          ${c.bond != null ? `<div class="side">${c.bond}%<div class="mini"><i class="fill ${band(c.bond)}" style="width:${c.bond}%"></i></div></div>` : ''}`;
        return known(c.who) ? `<button class="row" data-person="${c.who.id}">${inner}</button>` : `<div class="row">${inner}</div>`;
      };
      return `<p class="muted zoo-note">${esc(a.name)} ${alive ? 'has' : 'had'} a bond of ${their} own with each person.</p>
        ${[...carers, ...others].map(row).join('') || '<p class="empty">Nobody is on record.</p>'}
        ${care.companionsOf(a).length ? `<div class="section-label">Other animals</div>${care.companionsOf(a).map((x) => `<button class="row" data-animal="${x.other.id}">${animalFace(x.other)}
          <div class="main"><strong>${x.other.status === 'living' ? '' : '† '}${esc(x.other.name)}</strong><small>${esc(cap(x.word))} · since ${x.since}</small></div>
          <div class="side">${x.value}%<div class="mini"><i class="fill ${band(x.value)}" style="width:${x.value}%"></i></div></div></button>`).join('')}` : ''}`;
    },
    care: () => `
      ${kv([['Owner', owner ? personChip(owner) : 'Not recorded'], alive ? ['Main caregiver', main ? personChip(main) : 'Not recorded'] : null,
    alive && zoo.helpersOf(a).length ? ['Also helping', `<span class="chips end">${zoo.helpersOf(a).map((r) => personChip(r)).join('')}</span>`] : null,
    [alive ? 'Lives at' : 'Last home', home ? `${esc(home.label)}${place(home) ? `, ${esc(place(home))}` : ''}` : '']])}
      <p class="muted zoo-note">Who owns an animal, who looks after it day to day, and where it lives are kept as three separate things.</p>
      ${home && home.key !== 'rescue' && !home.key.startsWith('with:') ? `<div class="btn-stack"><button class="btn" data-chronicle="${esc(home.key)}">The chronicle of this house</button></div>` : ''}
      ${(() => {
    const c = COUNTRIES[player().countryId];
    if (a.foster) return `<div class="section-label">Foster placement</div>${kv([['For', esc(a.foster.name)], ['Since', String(a.foster.since)], ['Next review', String(a.foster.review)], ['Vet\'s bills', 'Paid by the rescue']])}`;
    if (!care.paysFor(a)) return '';
    const y = care.yearlyCost(a);
    return `<div class="section-label">What ${esc(a.name)} costs you</div>
        ${kv([['Routine', esc(ROUTINES[a.routine ?? 'standard'].name)], ['Food, supplies and everyday care', `${fmtMoney(y.care, c)} a year`], y.board ? ['Livery', `${fmtMoney(y.board, c)} a year`] : null,
      ['Insurance', a.insurance ? `${fmtMoney(y.insurance, c)} a year · pays ${Math.round(a.insurance.rate * 100)}% after ${fmtMoney(a.insurance.deductible, c)}` : 'Not insured'], ['Altogether', `<strong>${fmtMoney(y.total, c)} a year</strong>`]])}
        ${care.ledgerOf(a.id).length ? `<div class="section-label">Paid so far</div>${kv(Object.entries(care.ledgerOf(a.id).reduce((m, t) => ({ ...m, [t.kind]: (m[t.kind] ?? 0) + t.amount }), {})).map(([k, v]) => [cap(k), `${v < 0 ? '+' : ''}${Math.abs(v).toLocaleString('en-US')} ${esc(care.ledgerOf(a.id)[0].currency)}`]))}` : ''}`;
  })()}
      <div class="section-label">What a ${esc(sp.name)} needs</div>
      <ul class="zoo-list">${sp.needs.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <p class="muted zoo-note">${esc(sp.housing)}${alive && zoo.livesWithPlayer(a.id) ? ' Everyday care is seen to by the household without being asked.' : ''}</p>`,
    training: () => {
      const skills = zoo.trainingOf(a);
      if (!skills.length) return `<p class="empty">There is nothing a ${esc(sp.name)} needs to be taught.</p>`;
      return `${skills.map((s) => `<div class="zoo-skill"><div class="kv"><span>${esc(s.name)}</span><span>${s.progress >= 100 ? `Learned ${s.learnedYear}${s.by ? ` with ${esc(first(s.by))}` : ''}` : s.sessions ? `${s.sessions} ${s.sessions === 1 ? 'year' : 'years'} of practice` : 'Not started'}</span></div>
          <div class="pol-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.progress}" aria-label="${esc(s.name)}"><i class="fill ${s.progress >= 100 ? 'high' : 'mid'}" style="width:${s.progress}%"></i></div></div>`).join('')}
        <p class="muted zoo-note">Taught with food, praise and patience. Some of it takes more than a year.</p>`;
    },
    health: () => {
      const full = zoo.healthAccess(a.id) === 'full';
      const end = alive ? '' : kv([['Died', a.died ?? 'Year not recorded'], ['Age', String(a.ageAtDeath)]]);
      if (!full) return `${end}<p class="empty">${a.health.length ? `${a.health.length} ${a.health.length === 1 ? 'entry' : 'entries'} on record.` : 'Nothing on record.'}<br>The details ${alive ? 'are' : 'were'} kept by the people who looked after ${esc(a.name)}.</p>`;
      return `${alive && npc ? meterHtml('Health', npc.meters.health, true) : ''}${end}
        ${a.health.length ? `<div class="section-label">Record</div>${[...a.health].reverse().map((h) => `<div class="news-item"><small>${h.year} · ${h.kind === 'vet' ? 'Vet visit' : 'Illness'}${h.age != null ? ` · age ${h.age}` : ''}</small>${esc(h.note)}
          ${h.cost ? `<small>Cost ${h.cost.toLocaleString('en-US')} ${esc(h.currency)}${h.paidBy ? `, paid by ${you(h.paidBy) ? 'you' : esc(h.paidBy.name)}` : ''}</small>` : ''}</div>`).join('')}`
    : '<p class="empty">No vet visits or illnesses on record.</p>'}`;
    },
    memories: () => {
      const events = zoo.eventsOf(a.id).filter((e) => e.memories.length || e.story);
      return events.length ? byYear(events, (e) => eventRow(e, ui, { showAnimal: false }))
        : `<p class="empty">${a.origin.how === 'unknown' ? `${esc(a.name)} was part of the family before these records were kept.` : 'No memories on record yet.'}</p>`;
    },
    history: () => {
      const wins = zoo.eventsOf(a.id).filter((e) => e.type === 'trained' || e.type === 'achievement');
      const miles = zoo.milestonesOf(a.id);
      return `<div class="section-label">Homes</div>
        ${a.homes.map((h) => `<div class="kv"><span>${esc(span(h))}</span><span>${esc(h.label)}${place(h) ? `, ${esc(place(h))}` : ''}</span></div>`).join('')}
        <div class="section-label">Owners</div>
        ${a.ownerships.map((o) => `<div class="kv"><span>${esc(span(o))}${o.how && o.how !== 'unknown' ? ` · ${esc(o.how)}` : ''}</span><span>${personChip(o.who)}</span></div>`).join('')}
        <div class="section-label">Caregivers</div>
        ${a.care.map((c) => `<div class="kv"><span>${esc(span(c))} · ${c.role === 'primary' ? 'main' : 'helping'}</span><span>${personChip(c.who)}</span></div>`).join('')}
        <div class="section-label">Achievements</div>
        ${wins.length ? wins.map((e) => `<div class="kv"><span>${e.year}</span><span>${esc(e.text)}</span></div>`).join('') : '<p class="muted zoo-note">None on record.</p>'}
        <div class="section-label">Milestones</div>
        ${miles.length ? miles.map((e) => `<div class="kv"><span>${e.year} · ${esc(zoo.eventLabel(e))}</span><span>${esc(e.text)}</span></div>`).join('') : '<p class="muted zoo-note">None on record.</p>'}`;
    },
  };

  // What can be done: only what works, and only what suits the animal.
  const acts = [];
  if (alive && npc?.alive) {
    acts.push(...rel.basicActions(npc), ...zoo.animalActions(a.id));
    if (care.vetServices(a.id).some((x) => !x.done)) acts.push({ id: 'vet', label: 'Go to the vet' });
    if (care.paysFor(a)) acts.push({ id: 'routine', label: 'Change the care routine' });
    if (care.insuranceQuote(a.id).available) acts.push({ id: 'insure', label: 'Take out insurance' });
    if (a.insurance) acts.push({ id: 'uninsure', label: 'Cancel the insurance' });
    for (const f of care.fosterChoices(a)) acts.push({ id: `foster:${f.id}`, label: f.label });
    for (const x of extras.actions) acts.push(...x(a));
    if (care.rehomeOptions(a.id).length) acts.push({ id: 'rehome', label: `Find ${a.name} a new home`, danger: true });
    if (hooks.editStats) acts.push({ id: 'edit', label: 'Edit stats' });
  } else if (!alive && !a.memorial && player().age >= 5) acts.push({ id: 'memorial', label: 'Make a memorial' });
  const away = alive && !npc ? `<p class="muted zoo-note">${esc(a.name)} is no longer in your life. ${esc(cap(zoo.pronoun(a)))} is with ${esc(main?.name ?? 'someone else')} now.</p>` : '';

  return { title: `${alive ? '' : '† '}${a.name}`, sub: '', tabs: TABS, tab, body: `${head}${(sections[tab] ?? sections.overview)()}
    ${away}${acts.length ? `<div class="section-label">${alive ? 'Together' : 'Remembering'}</div><div class="btn-stack">${acts.map((x) => `<button class="btn ${x.danger ? 'danger' : ''}" data-act="${x.id}">${esc(x.label)}</button>`).join('')}</div>` : ''}` };
}

function chronicle(step) {
  const key = step.params.key;
  const events = zoo.houseChronicle(key);
  const lived = zoo.allAnimals().filter((a) => a.homes.some((h) => h.key === key));
  const label = lived.flatMap((a) => a.homes).find((h) => h.key === key)?.label ?? zoo.playerHome().label;
  const here = lived.filter((a) => a.status === 'living' && zoo.homeOf(a)?.key === key);
  const before = lived.filter((a) => !here.includes(a));
  const row = (a) => `<button class="row" data-animal="${a.id}">${animalFace(a)}<div class="main"><strong>${a.status === 'living' ? '' : '† '}${esc(a.name)}</strong><small>${esc(cap(speciesOf(a.speciesId).name))} · ${esc(zoo.lifeDates(a))}</small></div></button>`;
  return { title: 'House chronicle', sub: label, body: `
    ${here.length ? `<div class="section-label">Household animals</div>${here.map(row).join('')}` : ''}
    ${before.length ? `<div class="section-label">Lived here once</div>${before.map(row).join('')}` : ''}
    <div class="section-label">What happened here</div>
    ${events.length ? byYear(events, (e) => eventRow(e, step.ui, { chronicle: false })) : '<p class="empty">Nothing has been recorded under this roof yet.</p>'}
    <p class="muted zoo-note">The chronicle keeps what happened with the family's animals in this house.</p>` };
}

/** The animal lines from the life story of someone who came before. */
function story(step) {
  const lines = zoo.storyOfGeneration(step.params.gen);
  const who = lines[0]?.narrator.name ?? 'an earlier life';
  return { title: `${who.split(' ')[0]}'s life story`, sub: `The animals in the life of ${who}.`, body: lines.length
    ? byYear(lines, (e) => `<div class="zoo-event ${step.ui.open === e.id ? 'open' : ''}" data-ev="${e.id}"><button class="zoo-event-head" data-open="${e.id}"><span class="glyph" aria-hidden="true">${EVENT_TYPES[e.type].glyph}</span>
        <span class="main"><strong>Age ${e.age}</strong><small class="serif">${esc(e.story)}</small></span><span class="year">${e.year}</span></button>
        ${step.ui.open === e.id ? `<div class="zoo-detail"><div class="btn-stack"><button class="btn" data-animal="${e.animalId}" data-tab-to="memories" data-open-to="${e.id}">${esc(zoo.animalById(e.animalId).name)}'s profile</button></div></div>` : ''}</div>`)
    : '<p class="empty">Nothing was written down.</p>' };
}

const SCREENS = { archive, album, profile, chronicle, story };
/** What other files add to these screens: whole screens, things to do, and more for a profile. */
const extras = { actions: [], profile: [], doers: {}, acts: {} };
/**
 * @param {{screens?:Object<string,Function>, doers?:Object<string,Function>, actions?:Function, acts?:Object<string,Function>}} x
 *   screens  name -> (step) => { title, sub, tabs?, tab?, body }
 *   doers    what a button marked data-do="name" does: (dataset, ui) => void
 *   actions  (animal) => [{ id, label }] to offer on a living animal's profile      acts  id -> async (animal) => result
 */
export function extend(x) {
  Object.assign(SCREENS, x.screens ?? {});
  Object.assign(extras.doers, x.doers ?? {});
  Object.assign(extras.acts, x.acts ?? {});
  if (x.actions) extras.actions.push(x.actions);
}
/** For those files: the same moves these screens make. */
export const ui = { get api() { return api; }, nav, show: () => show(), shut: () => shut(), note: (x) => note(x), closeAll: () => closeAll(), animalFace, personChip: (r, n) => personChip(r, n), seg: (...x) => seg(...x), eventRow: (...x) => eventRow(...x) };

// ---------- Showing, and moving between ----------

const bodyEl = () => modal?.el.querySelector('[data-body]');
const note = (extra = {}) => nav.remember({ scroll: bodyEl()?.scrollTop ?? 0, ...extra });
function shut() { modal?.close(); modal = null; }
function closeAll() { shut(); nav.clear(); }

function show() {
  shut();
  const step = nav.top();
  if (!step) return;
  zoo.reconcile();
  if (step.screen === 'profile' && !zoo.animalById(step.params.animalId)) { nav.back(); return show(); }
  const s = SCREENS[step.screen](step);
  const back = backLabel(nav.under(), (id) => zoo.animalById(id)?.name);
  modal = openModal(`
    <div class="dyn-head"><div><h2>${esc(s.title)}</h2>${s.sub ? `<p class="muted zoo-sub">${esc(s.sub)}</p>` : ''}</div>
      <button class="icon-btn" data-x aria-label="Close">✕</button></div>
    ${s.tabs ? `<div class="zoo-tabs" role="tablist">${s.tabs.map(([id, label]) => `<button role="tab" aria-selected="${id === s.tab}" class="${id === s.tab ? 'on' : ''}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>` : ''}
    <div class="dyn-body" data-body>${s.body}</div>
    <div class="btn-stack zoo-foot"><button class="btn" data-back>${esc(back)}</button></div>`, { dismissable: true, onDismiss: () => { modal = null; nav.clear(); } });
  modal.el.classList.add('dyn-modal', 'zoo-modal');
  modal.el.dataset.screen = step.screen;
  modal.el.addEventListener('click', onClick);
  bodyEl().scrollTop = step.ui.scroll ?? 0;
  modal.el.querySelector('.zoo-tabs .on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
}
async function onClick(e) {
  const hit = (attr) => e.target.closest(`[${attr}]`);
  const step = nav.top();
  if (hit('data-x')) return closeAll();
  if (hit('data-back')) { nav.back(); return nav.top() ? show() : closeAll(); }
  let el;
  if ((el = hit('data-tab'))) { note({ tab: el.dataset.tab, scroll: 0, open: null }); return show(); }
  if ((el = hit('data-set'))) { const [k, v] = el.dataset.set.split(':'); note({ [k]: v, open: null }); return show(); }
  if ((el = hit('data-person'))) {
    const npc = store.state.npcs[el.dataset.person];
    if (!npc || !hooks.openPerson) return undefined;
    note(); shut();
    return hooks.openPerson(npc, api, () => show());
  }
  if ((el = hit('data-animal'))) {
    note();
    nav.open('profile', { animalId: el.dataset.animal }, { tab: el.dataset.tabTo ?? 'overview', open: el.dataset.openTo ?? null });
    return show();
  }
  if ((el = hit('data-story'))) return openStory(el.dataset.story);
  if ((el = hit('data-chronicle'))) { note(); nav.open('chronicle', { key: el.dataset.chronicle }); return show(); }
  if ((el = hit('data-open'))) { note({ open: step.ui.open === el.dataset.open ? null : el.dataset.open }); return show(); }
  if ((el = hit('data-go'))) {
    if (el.dataset.go === 'album') { note(); nav.open('album'); return show(); }
    note(); shut();
    return openFamilyTree((npc) => hooks.openPerson?.(npc, api, () => show()));
  }
  if ((el = hit('data-act'))) return act(step.params.animalId, el.dataset.act);
  if ((el = hit('data-do'))) return extras.doers[el.dataset.do]?.(el.dataset, step);
  return undefined;
}

/** From a memory to the place it is told: the player's own life story, or that of the one whose life it was. */
function openStory(eventId) {
  const ev = zoo.eventById(eventId);
  const a = zoo.animalById(ev.animalId);
  note({ open: eventId });
  if (ev.gen === (player().generation ?? 1) && zoo.storyIndex(eventId) >= 0 && api?.showStory) {
    shut();
    return api.showStory(eventId, { label: nav.top().screen === 'profile' ? `Back to ${a.name}` : backLabel(nav.top()), onBack: () => show() });
  }
  nav.open('story', { gen: ev.gen }, { open: eventId });
  return show();
}

async function act(id, what) {
  const a = zoo.animalById(id);
  const npc = store.state.npcs[id];
  note();
  let r;
  if (what === 'edit') { shut(); return hooks.editStats(api, npc, () => show()); }
  if (what === 'train') {
    shut();
    const skill = await pickModal({ title: `Practise with ${a.name}`, body: 'A year of short, kind sessions. Pick one thing to work on.',
      options: zoo.trainingOf(a).map((s) => ({ value: s.id, label: s.name, sub: s.progress >= 100 ? 'Learned' : s.progress ? `${s.progress}% of the way` : ['', 'Easy to begin with', 'Takes a while', 'Hard: expect it to take years'][s.difficulty], disabled: s.progress >= 100 })) });
    if (!skill) return show();
    r = zoo.train(id, skill);
  } else if (what === 'memorial') { shut(); r = zoo.memorialize(id);
  } else if (what === 'vet') {
    shut();
    const c = COUNTRIES[player().countryId]; const cl = care.clinic();
    const svc = await pickModal({ title: cl.name, body: `${cl.vets[0].name} and ${cl.vets[1].name} see ${a.name} here.`,
      options: care.vetServices(id).map((x) => ({ value: x.id, label: x.name, sub: x.done ? 'Done this year' : `${x.blurb} ${x.price ? fmtMoney(x.price, c) : 'Paid by the rescue'}`, disabled: x.done || !x.affordable })) });
    if (!svc) return show();
    r = care.vetVisit(id, svc);
  } else if (what === 'routine') {
    shut();
    const c = COUNTRIES[player().countryId];
    const pick = await pickModal({ title: `How ${a.name} is looked after`, body: 'Everyday care happens without being asked. This is how much goes into it.',
      options: Object.entries(ROUTINES).map(([k, v]) => ({ value: k, label: `${v.name}${(a.routine ?? 'standard') === k ? ' (now)' : ''}`, sub: `${v.blurb} ${fmtMoney(Math.round(care.yearlyCost({ ...a, routine: k }).care), c)} a year.` })) });
    if (!pick) return show();
    r = care.setRoutine(id, pick);
  } else if (what === 'insure') {
    shut();
    const c = COUNTRIES[player().countryId]; const q = care.insuranceQuote(id);
    const yes = await confirmModal({ title: `Insure ${a.name}?`, body: `${fmtMoney(q.premium, c)} a year. It pays ${Math.round(q.rate * 100)}% of illness and injury after the first ${fmtMoney(q.deductible, c)} of each bill, up to ${fmtMoney(q.yearCap, c)} a year. Check-ups, vaccinations and dental work are not covered.`, yes: 'Take the policy' });
    if (!yes) return show();
    r = care.insure(id);
  } else if (what === 'uninsure') { shut(); r = care.cancelInsurance(id);
  } else if (what.startsWith('foster:')) {
    shut();
    const kind = what.slice(7);
    const yes = await confirmModal(kind === 'adopt' ? { title: `Apply to adopt ${a.name}?`, body: `Fostering does not make ${a.name} yours: you apply like anyone else, and pay the adoption fee.`, yes: 'Apply' }
      : { title: `Let ${a.name} go?`, body: `${a.foster.name} will place ${zoo.pronoun(a, 'them')} with a permanent family if one is waiting. ${a.name} will leave your life; you keep the memories.`, yes: 'It is time', danger: true });
    if (!yes) return show();
    r = care.fosterDecision(id, kind);
  } else if (what === 'rehome') {
    shut();
    const to = await pickModal({ title: `A new home for ${a.name}`, body: `If you can no longer look after ${a.name}, someone else can. ${cap(zoo.pronoun(a))} will not understand why.`, options: care.rehomeOptions(id) });
    if (!to) return show();
    const sure = await confirmModal({ title: `Give ${a.name} up?`, body: 'This cannot be undone.', yes: `Give ${a.name} up`, danger: true });
    if (!sure) return show();
    r = care.rehome(id, to);
  } else if (extras.acts[what]) { shut(); r = await extras.acts[what](a); if (!r) return show();
  } else { shut(); r = rel.interact(id, what); }
  api?.changed();
  await messageModal({ body: r.text, tone: r.tone });
  return show();
}

// ---------- Ways in ----------

function start(tabApi, screen, params, ui) {
  api = tabApi;
  nav.clear();
  nav.open(screen, params, ui);
  show();
}

/** Family archive: the album and the tree. */
export const openFamilyArchive = (tabApi) => start(tabApi, 'archive');
/** Our Animal Family. */
export const openAnimalFamily = (tabApi, ui = {}) => start(tabApi, 'album', {}, ui);
/** One animal's profile, living or archived. `ui` may name the tab and a memory to show open. */
export const openAnimalProfile = (tabApi, animalId, ui = {}) => { zoo.reconcile(); if (zoo.animalById(animalId)) start(tabApi, 'profile', { animalId }, ui); };
/** The chronicle of the house the player lives in. */
export const openHouseChronicle = (tabApi, key = zoo.playerHome().key) => start(tabApi, 'chronicle', { key });

/** For the Holdings tab: the animals of the player's household, and the way into the chronicle. */
export function householdAnimalsHtml() {
  zoo.reconcile();
  const here = zoo.householdAnimals();
  const has = zoo.houseChronicle(zoo.playerHome().key).length;
  if (!here.length && !has) return '';
  return `<div class="section-label">Household animals</div>
    ${here.map((a) => `<button class="row" data-animal="${a.id}">${animalFace(a)}<div class="main"><strong>${esc(a.name)}</strong><small>${esc(cap(speciesOf(a.speciesId).name))} · ${esc(zoo.stageOf(a))} · ${esc(zoo.familyLink(a))}</small></div></button>`).join('') || '<p class="muted zoo-note">No animal lives here now.</p>'}
    <div class="btn-stack" style="margin-bottom:14px"><button class="btn" data-go="chronicle">House chronicle</button></div>`;
}
