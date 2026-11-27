// Explore the World: the travel, papers, immigration and family-geography
// screens, in one hub with a back stack of its own. Every screen reads the
// engine (travel, documents, relocation, globalStory); nothing here keeps a
// copy of the world. Each view remembers its own filters, scroll position and
// what was expanded, so going deeper (a home, a person, their memories) and
// coming back finds things as they were left.
import { faceGenderOf } from '../avatar/render.js';
import { store, player, country, livingNpcs } from '../state.js';
import { esc, fmtMoney, theCountry } from '../util.js';
import { openModal, messageModal, confirmModal, tripSceneModal } from './modals.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { FILTERS, MODE_BY_ID, STAY_BY_ID } from '../data/travel.js';
import { SKILLS, LEVELS } from '../data/skills.js';
import { CABINS } from '../data/activities.js';
import { STATEROOM_BY_ID, VIEW_BY_ID, DECKS, CRUISE_LINE_BY_ID, ITINERARY_BY_ID } from '../data/cruises.js';
import * as travel from '../engine/travel.js';
import * as docs from '../engine/documents.js';
import * as reloc from '../engine/relocation.js';
import * as story from '../engine/globalStory.js';
import * as cit from '../engine/citizenship.js';
import * as imm from '../engine/immigration.js';
import * as move from '../engine/emigration.js';
import * as chron from '../engine/chronicle.js';
import { languagesOf, fluency, languageNote } from '../engine/languages.js';
import { placeName, project, coords, capitalCity, jurisdictionAt } from '../engine/geo.js';
import { avatarSvg } from './avatar.js';
import { openPassportBook } from './passportBook.js';
import { cover as healthCover } from '../engine/systems.js';
import { getEra } from '../engine/history.js';
import * as creds from '../engine/credentials.js';
import * as bizAbroad from '../engine/businessAbroad.js';
import * as fam from '../engine/familyMove.js';
import * as bizEngine from '../engine/business.js';
const regFor = (q) => creds.REGULATED[q.careerId] ?? {};
import { COORDINATES } from '../data/coordinates.js';

const SECTIONS = [
  ['discover', 'Discover'], ['plan', 'Plan a Trip'], ['trips', 'My Trips'], ['documents', 'Passport & Documents'],
  ['immigration', 'Immigration'], ['lived', 'Places I\'ve Lived'], ['languages', 'Languages & Culture'], ['journal', 'Travel Memories'],
];
const TITLES = { discover: 'Discover', destination: 'Destination', plan: 'Plan a Trip', trips: 'My Trips', trip: 'Trip', documents: 'My Documents & Citizenship', immigration: 'Immigration',
  lived: 'Places I\'ve Lived', residence: 'A place I lived', languages: 'Languages & Culture', journal: 'My Travel Journal', story: 'Our Global Story', person: 'Person', house: 'House Chronicle', event: 'Life Story', lifestory: 'Life Story', place: 'Place' };

// The back stack and each view's remembered state. Kept per saved life.
const NAV = { slot: null, stack: [], ui: {} };
let context = null;
const CONTEXT = () => (context ??= Object.values(COORDINATES).flatMap((r) => Object.values(r.cities)));
// The land outline (Natural Earth, data/land.js) is loaded the first time a map is drawn.
let land = null;
let landLoading = null;
const loadLand = (then) => { landLoading ??= import('../data/land.js').then((m) => { land = m.LAND; }).catch(() => { land = ''; }); landLoading.then(then); };
const uiOf = (key) => (NAV.ui[key] ??= {});
const keyOf = (v) => `${v.view}:${v.params?.id ?? ''}`;

const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${b}</span></div>`;
const kvt = (a, b) => kv(a, esc(b));
const chip = (label, on, attrs) => `<button type="button" class="av-chip world-group ${on ? 'on' : ''}" aria-pressed="${!!on}" ${attrs}>${esc(label)}</button>`;
const btn = (label, attrs, cls = '') => `<button type="button" class="btn ${cls}" ${attrs}>${esc(label)}</button>`;
const money = (n) => fmtMoney(n, country());
const flag = (id) => COUNTRIES[id]?.flag ?? '';
const nameOf = (id) => COUNTRIES[id]?.name ?? id;
/**
 * The cruise planner's steps, kept calm: each choice is a short list until it is made, then one line that opens again
 * to change it. Descriptions show only for what is chosen.
 */
const picked = (label, value, body, open = false) => `<details class="gl-pick" ${open ? 'open' : ''}><summary><span class="muted">${esc(label)}</span> <strong>${esc(value)}</strong> <span class="gl-change">Change</span></summary>${body}</details>`;
const option = (field, name, id, on, title, sub = '', disabled = false) => `<label class="gl-radio"><input type="radio" name="${name}" data-cruise="${field}" value="${id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="gl-opt"><strong>${esc(title)}</strong>${sub ? `<small class="muted">${esc(sub)}</small>` : ''}</span></label>`;
function cruiseStep(trip) {
  const c = trip.cruise ?? {};
  const lines = travel.cruiseLines(trip);
  const line = CRUISE_LINE_BY_ID[c.line];
  const lineList = lines.map((l) => option('line', 'cline', l.id, c.line === l.id, l.name, `${l.tier}${l.kids === 'adults' ? ', 18 and over' : ''}`)).join('');
  if (!lines.length) return '<div class="card gl-step"><h3>2 · Cruise</h3><p class="muted">No cruise lines sail in this period.</p></div>';
  if (!line) return `<div class="card gl-step"><h3>2 · Cruise</h3>${lineList}</div>`;
  const list = travel.sailings(trip);
  const open = list.filter((it) => !it.why);
  const closed = list.filter((it) => it.why);
  const it = list.find((x) => x.id === c.itin);
  const sailList = `${open.map((x) => option('itin', 'citin', x.id, c.itin === x.id, x.name, `${x.nights} nights from ${x.portName.replace(/, .*$/, '')}${x.oneWay ? ', one way' : ''}`)).join('')}
    ${closed.length ? `<details class="gl-more"><summary class="muted">${closed.length} not sailing on these dates</summary>${closed.map((x) => `<p class="muted gl-why"><strong>${esc(x.name)}</strong>: ${esc(x.why)}</p>`).join('')}</details>` : ''}`;
  return `<div class="card gl-step"><h3>2 · Cruise</h3>
    ${picked('Line', line.name, lineList)}
    <p class="muted gl-note">${esc(line.blurb)}</p>
    ${it ? `${picked('Sailing', `${it.name}, ${it.nights} nights`, sailList)}<p class="muted gl-note">From ${esc(it.portName)}. ${esc(it.ports.length ? it.ports.join(' · ') : 'Days at sea')}.</p>` : `<div class="section-label">Sailings</div>${sailList}`}
  </div>`;
}
function stateroomStep(trip) {
  const c = trip.cruise ?? {};
  if (!c.itin) return '';
  const room = STATEROOM_BY_ID[c.room];
  const list = travel.staterooms(trip).map((r) => option('room', 'croom', r.id, c.room === r.id, r.name)).join('');
  if (!room) return `<div class="card gl-step"><h3>7 · Stateroom</h3>${list}<p class="muted gl-note">Prices are for two sharing.</p></div>`;
  return `<div class="card gl-step"><h3>7 · Stateroom</h3>
    ${picked('Room', room.name, list)}
    <p class="muted gl-note">${esc(room.blurb)} Sleeps ${room.sleeps}.</p>
    <div class="gl-pair">${room.views.length > 1 ? `<label class="field">View <select data-cruise="view">${room.views.map((v) => `<option value="${v}" ${c.view === v ? 'selected' : ''}>${esc(VIEW_BY_ID[v].name)}</option>`).join('')}</select></label>` : ''}
    <label class="field">Deck <select data-cruise="deck">${DECKS.map((d) => `<option value="${d.id}" ${c.deck === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label></div></div>`;
}
/** Short names for the extras' chips. */
/** The bill, with a cruise's many charges folded into one line that opens to show them all. */
function billLines(lines, trip) {
  if (trip.type !== 'cruise') return lines;
  const cruise = lines.filter((l) => l.kind === 'cruise');
  if (cruise.length < 2) return lines;
  const at = lines.indexOf(cruise[0]);
  const rest = lines.filter((l) => l.kind !== 'cruise');
  rest.splice(at, 0, { label: 'Cruise, fees and extras', amount: cruise.reduce((s2, l) => s2 + l.amount, 0), group: cruise });
  return rest;
}
const EXTRA_SHORT = { drinks: 'Drinks package', soda: 'Soft drinks', dining: 'Specialty dining', wifi_basic: 'Wi-Fi', wifi_stream: 'Streaming Wi-Fi', excursions: 'Shore excursions' };
function onboardStep(trip) {
  const c = trip.cruise ?? {};
  const it = ITINERARY_BY_ID[c.itin];
  if (!it || !c.room) return '';
  const extras = travel.cruiseExtras(trip);
  const inc = extras.filter((e) => e.included);
  const wifiOn = c.extras.some((id) => /^wifi/.test(id)) && !extras.some((e) => /^wifi/.test(e.id) && e.included);
  const ashore = c.extras.includes('excursions') || extras.some((e) => e.id === 'excursions' && e.included);
  const notes = [c.extras.includes('drinks') ? `Every adult in the room needs it (drinking age ${travel.drinkingAge(it)}).` : '', wifiOn ? 'Wi-Fi is per device.' : ''].filter(Boolean).join(' ');
  return `<div class="card gl-step"><h3>8 · Extras</h3>
    <p class="muted gl-note">Meals, shows and pools are in the fare.${inc.length ? ` ${esc(CRUISE_LINE_BY_ID[c.line].name)} also includes ${esc(inc.map((e) => (EXTRA_SHORT[e.id] ?? e.name).toLowerCase()).join(', '))}.` : ''}</p>
    <div class="chips">${extras.filter((e) => !e.included).map((e) => chip(EXTRA_SHORT[e.id] ?? e.name, c.extras.includes(e.id), `data-cruise="extra" data-value="${e.id}"`)).join('')}</div>
    ${notes ? `<p class="muted gl-note">${esc(notes)}</p>` : ''}
    ${wifiOn ? `<label class="field">Devices <select data-cruise="devices">${[1, 2, 3, 4, 5, 6].map((d) => `<option ${c.devices === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
    ${ashore && it.ports.length ? `<div class="section-label">Excursions</div><div class="chips">${it.ports.map((port, i) => chip(port.replace(/ \(.*\)$/, ''), c.ports.includes(i), `data-cruise="port" data-value="${i}"`)).join('')}</div>` : ''}
  </div>`;
}

const STATUS = { draft: 'Draft', confirmed: 'Booked', in_progress: 'Away now', completed: 'Completed', canceled: 'Canceled', disrupted: 'Disrupted',
  submitted: 'Submitted', under_review: 'Under review', review_requested: 'Review requested', approved: 'Approved', refused: 'Refused', withdrawn: 'Withdrawn', expired: 'Expired', used: 'Used' };
const HOW = { birth: 'by birth', descent: 'through a parent', naturalization: 'by naturalization', restoration: 'restored' };

/**
 * Opens the hub.
 * @param {object} api  the shell's api (changed, ...)
 * @param {{view?:string, params?:object}} [start]
 */
/** The way there, as a scene: home, any changes of plane or ports of call, and the destination, on a map. */
export async function journeyOf(trip) {
  try {
    const { openJourney, overOf } = await import('./journey.js');
    const legs = trip.itinerary?.out ?? [];
    const stops = legs.length ? [legs[0].from, ...legs.map((l) => l.to)] : [trip.origin, trip.destination];
    if (trip.type === 'cruise') stops.push(...travel.portCalls(trip).map((x) => ({ countryId: x.countryId, city: x.port })));
    const kind = { honeymoon: 'Off on the honeymoon', vacation: 'Off on vacation', getaway: 'A weekend away', business: 'Off on business' }[trip.type];
    await openJourney({ stops, over: trip.type === 'cruise' ? 'sea' : overOf(legs[0]?.mode ?? trip.mode), title: kind });
  } catch { /* no map: on with the trip */ }
}

/**
 * Off on a booked trip, now: the journey on a map, its moments one at a time, each answered, then home, with a notice
 * of how it went (and, home from a honeymoon, the postcard). Also how a honeymoon booked with the wedding begins.
 * @returns {Promise<{ok:boolean, text?:string}>}
 */
export async function goOnTrip(api, id, changed = () => api?.changed?.()) {
  const start = travel.beginTrip(id);
  if (!start.ok) return start;
  changed();
  const trip = start.trip;
  await journeyOf(trip); // the plane (or ship, train, car) on its way there, on a map (js/ui/journey.js)
  const scenes = travel.tripScenes(trip);
  let previous = null;
  for (const [i, sc] of scenes.entries()) {
    const index = await tripSceneModal({ eyebrow: `${trip.destination.city ?? ''} · ${i + 1} of ${scenes.length}`, text: sc.text, choices: sc.choices, previous });
    previous = travel.chooseTripScene(id, sc.id, index);
    changed();
  }
  const end = travel.finishTrip(id);
  changed();
  await messageModal({ title: end.title, body: end.text, tone: end.tone, changes: end.changes, previous });
  if (trip.type === 'honeymoon' || trip.honeymoon) { const { honeymoonPostcard } = await import('./weddingPlanner.js'); await honeymoonPostcard(api, trip); changed(); }
  return { ok: true };
}

export function openExplore(api, start = {}) {
  const p = player();
  if (NAV.slot !== store.state.slotId) { NAV.slot = store.state.slotId; NAV.stack = []; NAV.ui = {}; }
  if (start.view) NAV.stack = [{ view: start.view, params: start.params ?? {}, scroll: 0 }];
  if (!NAV.stack.length) NAV.stack = [{ view: travel.whereabouts().away ? 'trips' : 'discover', params: {}, scroll: 0 }];
  const modal = openModal('<div data-gl></div>', { dismissable: true, full: true, title: 'Explore the World' });
  modal.el.classList.add('world-modal', 'gl-modal');
  const root = modal.el.querySelector('[data-gl]');
  const top = () => NAV.stack[NAV.stack.length - 1];

  const go = (view, params = {}) => { top().scroll = modal.el.scrollTop; NAV.stack.push({ view, params, scroll: 0 }); render(0); };
  const back = () => { if (NAV.stack.length > 1) { NAV.stack.pop(); render(top().scroll); } };
  const section = (view) => { top().scroll = modal.el.scrollTop; NAV.stack = [{ view, params: {}, scroll: 0 }]; render(0); };
  const changed = () => { api?.changed?.(); render(modal.el.scrollTop); };
  const tell = async (r) => { changed(); await messageModal({ title: r.title, body: r.text, tone: r.tone, changes: r.changes }); render(modal.el.scrollTop); };

  function render(scroll = 0) {
    const v = top();
    const ui = uiOf(keyOf(v));
    const where = travel.whereabouts();
    const body = (VIEWS[v.view] ?? VIEWS.discover)(v.params ?? {}, ui);
    const isRoot = NAV.stack.length === 1;
    root.innerHTML = `
      <div class="gl-head">
        ${isRoot ? '' : btn('← Back', 'data-back', 'small')}
        ${v.view === 'story' ? '<h2 style="margin:6px 0 0">Our Global Story</h2>' : ''}
        <p class="muted" style="margin:0">${v.view === 'story' ? 'How the family has lived across places and generations.' : ''}</p>
        <p class="gl-where">${where.away ? `✈ Away: ${esc(where.name)}. Home is still ${esc(placeName(p.countryId, p.city, store.state.year))}.` : `At home in ${esc(placeName(p.countryId, p.city, store.state.year))} · ${esc(docs.today())}`}</p>
        ${(() => { const era = getEra(store.state.year); if (era.id === 'now') return ''; const papers = { open: 'No passports or visas are asked for, and anyone may go and settle where they like.', controls: 'Passports are required, and most borders want a visa.', modern: 'Passports and visas as in the modern world, by the rules of the time.' }[docs.eraOf().id]; return `<p class="muted gl-era">${esc(era.name)} (${esc(era.short)}). ${esc(papers)} Travel is by what exists in ${store.state.year}.</p>`; })()}
      </div>
      ${v.view === 'story' ? '' : `<nav class="world-groups gl-nav" aria-label="Sections">${SECTIONS.map(([id, label]) => chip(label, rootOf(v.view) === id, `data-section="${id}"`)).join('')}</nav>`}
      <div class="section-label">${esc(TITLES[v.view] ?? '')}</div>
      <div class="gl-body">${body}</div>
      <div class="btn-stack" style="margin-top:14px">${btn('Close', 'data-close')}</div>`;
    modal.el.scrollTop = scroll;
    bind(v, ui);
  }

  const rootOf = (view) => ({ destination: 'discover', trip: 'trips', residence: 'lived', house: 'lived', person: 'lived', event: 'lived', lifestory: 'lived', place: 'lived' }[view] ?? view);

  // ---------- Views ----------

  const VIEWS = {
    discover(params, ui) {
      const list = travel.discover(ui.filter ?? '');
      return `<div class="world-groups">${chip('All', !ui.filter, 'data-filter=""')}${FILTERS.map(([id, label]) => chip(label, ui.filter === id, `data-filter="${id}"`)).join('')}</div>
        <p class="muted">${list.length} places. Prices are for a week.</p>
        <div class="world-list">${list.map((d) => `<button type="button" class="row world-row" data-dest="${d.id}" data-city="${esc(d.city)}">
          <div class="world-flag" aria-hidden="true">${d.flag}</div>
          <div class="main"><strong>${esc(d.city)}, ${esc(d.name)}</strong>
            <small>${esc([d.climate, `${d.km.toLocaleString('en-US')} km`, `about ${d.costWord}`, d.entry, d.kin.length ? `${d.kin.join(', ')} live${d.kin.length === 1 ? 's' : ''} here` : '', d.reachable ? '' : 'no way to get there in this period'].filter(Boolean).join(' · '))}</small></div>
        </button>`).join('')}</div>`;
    },

    destination({ id, city }) {
      const d = travel.destination(id, city);
      const e = d.entry;
      return `<div class="world-head"><div class="world-flag big">${d.flag}</div><div><h2 style="margin:0">${esc(d.city)}</h2><p class="muted" style="margin:0">${esc(d.name)}</p></div></div>
        <div class="card"><h3>Overview</h3>${kvt('Distance', `${(d.km ?? 0).toLocaleString('en-US')} km from home`)}${kvt('Climate', d.climate ?? '—')}${kvt('Now', d.season ?? '—')}${kvt('Languages', d.languages.join(', '))}${languageNote(id) ? `<p class="muted">${esc(languageNote(id))}</p>` : ''}${kvt('Currency', d.currency)}${kvt('A week, for one', money(d.weekCost))}
          <label class="field" style="margin-top:8px">City <select data-destcity>${d.cities.map((c) => `<option ${c === d.city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
        <div class="card"><h3>Entry requirements</h3>${e ? `${kvt('For you', e.name)}${e.days ? kvt('Longest stay', `${e.days} days${e.rolling ? ` in any ${e.rolling}` : ''}`) : ''}<p class="muted">${esc(e.why)} Simplified game rules, not travel advice.</p>` : '<p class="muted">No border to cross.</p>'}</div>
        <div class="card"><h3>Getting there</h3>${d.modes.length ? d.modes.map((m) => kvt(m.name, `${m.hours < 48 ? `${Math.round(m.hours)} hours` : `${Math.round(m.hours / 24)} days`}`)).join('') : '<p class="muted">No way to make this journey in this period.</p>'}</div>
        <div class="card"><h3>Where to stay</h3><p>${esc(d.stays.join(' · '))}</p></div>
        <div class="card"><h3>Things to do</h3><p>${esc(d.activities.join(' · '))}</p></div>
        ${d.kin.length ? `<div class="card"><h3>People you know here</h3>${d.kin.map((k) => `<button type="button" class="tree-row" data-npcperson="${k.id}"><strong>${esc(k.name)}</strong></button>`).join('')}</div>` : ''}
        <div class="btn-stack">${btn('Plan a trip here', `data-planhere="${id}" data-city="${esc(d.city)}"`, 'primary')}</div>`;
    },

    plan({ id }, ui) {
      const drafts = travel.trips(['draft']);
      const trip = id ? travel.tripById(id) : null;
      if (!trip) {
        return `<p class="muted">Plan first; nothing is paid until you book.</p>
          <div class="btn-stack">${btn('Start a new plan', 'data-newplan', 'primary')}</div>
          ${drafts.length ? `<div class="section-label">Plans in progress</div>${drafts.map((t) => `<button type="button" class="tree-row" data-openplan="${t.id}"><strong>${esc(travel.tripCard(t).type)}: ${esc(travel.tripCard(t).where)}</strong><small>${esc(t.depart)} to ${esc(t.ret)}</small></button>`).join('')}` : ''}`;
      }
      if (trip.status !== 'draft') return VIEWS.trip({ id: trip.id }, ui);
      const p = player();
      const types = travel.tripTypes(trip.destination?.countryId);
      const dest = trip.destination;
      const modes = dest ? travel.modesFor(trip.origin, dest, docs.yearOf(trip.depart)) : [];
      const cruise = trip.type === 'cruise';
      const stays = dest ? travel.stayOptions(trip) : [];
      const acts = dest ? travel.activityOptions(trip) : [];
      const q = travel.quote(trip);
      const kin = travel.familyPayer();
      const payHow = travel.payMode(trip);
      const kinWho = kin ? kin.who.replace(/^Your/, 'your') : '';
      const bad = travel.problems(trip);
      const entry = travel.entryCheck(trip);
      const going = travel.going(trip).map((x) => docs.personById(x.id)).filter(Boolean);
      const m = MODE_BY_ID[trip.mode];
      const legs = m && dest ? travel.journey(trip.origin, dest, m, trip.depart, trip.cabin).legs : [];
      const y = store.state.year;
      return `
        <div class="card gl-step"><h3>1 · Kind of trip</h3>
          <select data-planfield="type" aria-label="Kind of trip">${types.map((t) => `<option value="${t.id}" ${t.id === trip.type ? 'selected' : ''} ${t.why ? 'disabled' : ''}>${esc(t.group)}: ${esc(t.name)}${t.why ? ` (${esc(t.why)})` : ''}</option>`).join('')}</select></div>
        ${cruise ? cruiseStep(trip) : `<div class="card gl-step"><h3>2 · From and to</h3>${kvt('From', placeName(trip.origin.countryId, trip.origin.city))}
          <label class="field">Country <select data-planfield="country"><option value="">Choose…</option>${COUNTRY_LIST.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}" ${dest?.countryId === c.id ? 'selected' : ''}>${c.flag} ${esc(c.name)}</option>`).join('')}</select></label>
          ${dest ? `<label class="field">City <select data-planfield="city">${COUNTRIES[dest.countryId].cities.map((c) => `<option ${c === dest.city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>` : ''}</div>`}
        <div class="card gl-step"><h3>3 · Dates</h3>
          <div class="gl-dates"><label class="field">Leave <input type="date" data-planfield="depart" value="${esc(trip.depart)}" min="${docs.today()}" max="${y + 1}-12-31"></label>
          ${cruise ? '' : `<label class="field">Return <input type="date" data-planfield="ret" value="${esc(trip.ret)}" min="${esc(trip.depart)}" max="${docs.yearOf(trip.depart)}-12-31"></label>`}</div>
          <p class="muted">${cruise ? (trip.cruise?.sail ? `Sails ${esc(trip.cruise.sail)}, back ${esc(trip.ret)}.${trip.cruise.sail !== trip.depart ? ' You leave a day early.' : ''}` : 'The sailing you choose sets how long.') : `${docs.daysBetween(trip.depart, trip.ret)} nights. It is ${esc(docs.today())}; a trip ends in the year it starts.`}</p></div>
        <div class="card gl-step"><h3>4 · Who is going</h3>
          ${trip.travelers.map((x) => { const who = docs.personById(x.id); return who ? kv(x.status === 'organizer' ? 'You' : `${who.firstName}`, `${esc(({ organizer: 'Organizer', accepted: 'Coming', declined: 'Not coming', stayed: 'Could not come' })[x.status] ?? x.status)}${x.reason && x.status !== 'organizer' ? ` <small class="muted">${esc(x.reason)}</small>` : ''}${x.status !== 'organizer' ? ` <button type="button" class="btn small" data-uninvite="${x.id}">Remove</button>` : ''}`) : ''; }).join('')}
          ${dest ? `<details ${ui.inviteOpen ? 'open' : ''} data-toggle="inviteOpen"><summary>Invite someone</summary>${travel.invitable(trip).map((n) => `<button type="button" class="tree-row" data-invite="${n.id}"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(n.age)} · they decide for themselves</small></button>`).join('') || '<p class="muted">Nobody else to ask.</p>'}</details>` : ''}</div>
        ${dest ? `<div class="card gl-step"><h3>5 · ${cruise ? 'Getting to the port' : 'Getting there'}</h3>
          ${modes.length ? modes.map((x) => { const j = travel.journey(trip.origin, dest, x, trip.depart, trip.cabin); return `<label class="gl-radio"><input type="radio" name="mode" data-planfield="mode" value="${x.id}" ${trip.mode === x.id ? 'checked' : ''}> ${esc(x.name)} <small class="muted">${j.hours < 48 ? `${Math.round(j.hours)} h` : `${Math.round(j.hours / 24)} days`}${x.accessible ? '' : ' · no step-free help'}</small></label>`; }).join('') : '<p class="muted">No way to make this journey in this period.</p>'}
          ${m?.cabins ? `<select data-planfield="cabin" aria-label="Cabin">${CABINS.map((k) => `<option value="${k.id}" ${trip.cabin === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>` : ''}
          ${legs.length ? `<div class="gl-legs">${legs.map((l) => `<p>${esc(l.from.city)} ${esc(l.depart.date)} ${esc(l.depart.time)} → ${esc(l.to.city)} ${esc(l.arrive.date)} ${esc(l.arrive.time)} <small class="muted">local times · ${l.km.toLocaleString('en-US')} km</small></p>`).join('')}</div>` : ''}
          <label class="gl-radio"><input type="checkbox" data-needs ${p.flags.travelNeeds?.stepFree ? 'checked' : ''}> I need step-free access</label></div>
        <div class="card gl-step"><h3>6 · Passports and Visas</h3>
          ${entry.some((x) => x.sorted?.length) ? '<p class="muted">🛂 Passports and visas are sorted for you when you book. The fees go on the bill.</p>' : ''}
          ${entry.length ? entry.map((x) => `<div class="gl-entry ${x.ok ? 'ok' : ''}"><strong>${esc(x.name)}</strong>: ${esc(x.rule.name)}${x.ok ? ' ✓' : ''}
            ${x.sorted?.length ? `<small class="muted">${x.sorted.length > 1 ? 'Passport and visa' : /passport/.test(x.sorted[0]) ? 'Passport' : 'Visa'}: sorted when you book</small>` : ''}
            ${x.problems.map((pr) => `<small>${esc(pr)}</small>`).join('')}
            ${x.mayApply && x.needs === 'passport' ? btn('Apply for a passport', `data-passport="${x.id}" data-issuer="${x.rule.nationality ?? cit.held(docs.personById(x.id))[0]}"`, 'small') : ''}
            ${x.mayApply && x.needs && x.needs !== 'passport' ? btn(`Apply: ${x.rule.name}`, `data-applyentry="${x.id}"`, 'small') : ''}</div>`).join('') : '<p class="muted">No border to cross.</p>'}
          <p class="muted">A visitor may not work.</p></div>
        ${cruise ? stateroomStep(trip) : m?.includesStay ? '' : `<div class="card gl-step"><h3>7 · Where to stay</h3>${stays.map((s) => `<label class="gl-radio"><input type="radio" name="stay" data-planfield="stay" value="${s.id}" ${trip.stay === s.id ? 'checked' : ''}> ${esc(s.name)}${s.accessible ? '' : ' <small class="muted">not step-free</small>'}</label>`).join('')}</div>`}
        ${cruise ? onboardStep(trip) : `<div class="card gl-step"><h3>8 · Things to do</h3><div class="chips">${acts.map((a) => chip(`${a.name}${a.liked ? ' ★' : ''}`, trip.activities.includes(a.id), `data-act="${a.id}"`)).join('')}</div><p class="muted">★ something you love. Unplanned things can be done there too.</p></div>`}
        <div class="card gl-step"><h3>9 · Paying</h3>
          <select data-planfield="payment" aria-label="Who pays">${travel.paymentOptions().map((o) => `<option value="${o.id}" ${payHow === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
          ${payHow === 'family' ? (trip.familyAnswer ? `<p class="gl-answer">${esc(trip.familyAnswer.text)}</p>${travel.canAskFamilyAgain(trip) ? btn(`Ask ${kinWho} again`, `data-askfamily="${trip.id}"`, 'small') : ''}` : `<p class="muted">They might say yes, or help with some of it, or say no.</p>${trip.destination ? btn(`Ask ${kinWho}`, `data-askfamily="${trip.id}"`, 'small') : ''}`) : ''}
          <label class="gl-radio"><input type="checkbox" data-planfield="insurance" ${trip.insurance ? 'checked' : ''}> Travel insurance</label>
          <div class="gl-bill">${billLines(q.lines, trip).map((l) => (l.group ? `<details class="gl-more"><summary>${kv(l.label, esc(money(l.amount)))}</summary>${l.group.map((g) => kvt(g.label, money(g.amount))).join('')}</details>` : kvt(`${l.label}${l.payer === 'employer' ? ' (employer)' : l.payer && !['organizer', 'player'].includes(l.payer) ? ` (${docs.personById(l.payer)?.firstName})` : ''}`, money(l.amount)))).join('')}
          ${q.family ? kvt(`${kin.who} ${kin.plural ? 'pay' : 'pays'}`, money(q.family)) : ''}${kv('You pay', `<strong>${esc(money(q.organizer))}</strong>`)}${q.employer ? kvt('Your employer pays', money(q.employer)) : ''}</div>
          </div>` : ''}
        ${bad.length ? `<div class="card gl-problems"><h3>Before booking</h3>${bad.map((b) => `<p>• ${esc(b)}</p>`).join('')}</div>` : ''}
        <div class="btn-stack">${btn(`Book${bad.length || !q.organizer ? '' : ` for ${money(q.organizer)}`}`, `data-book="${trip.id}" ${bad.length ? 'disabled' : ''}`, 'primary')}${btn('Discard this plan', `data-discard="${trip.id}"`)}</div>
        ${going.length > 1 ? `<p class="muted">${going.length} traveling.</p>` : ''}`;
    },

    trips() {
      const list = travel.trips();
      const group = (title, rows) => (rows.length ? `<div class="section-label">${esc(title)}</div>${rows.map((t) => { const c = travel.tripCard(t); return `<button type="button" class="row world-row" data-trip="${t.id}"><div class="world-flag">${c.flag}</div><div class="main"><strong>${esc(c.type)}: ${esc(c.where)}</strong><small>${esc(c.depart)} to ${esc(c.ret)} · ${esc(STATUS[c.status])}${c.travelers.length > 1 ? ` · with ${esc(c.travelers.filter((x) => !x.you && x.status === 'accepted').map((x) => x.name).join(', '))}` : ''}</small></div></button>`; }).join('')}` : '');
      return `${group('Away now', list.filter((t) => t.status === 'in_progress'))}${group('Booked', list.filter((t) => t.status === 'confirmed'))}${group('Plans', list.filter((t) => t.status === 'draft'))}
        ${group('Past trips', list.filter((t) => ['completed', 'canceled', 'disrupted'].includes(t.status)))}
        ${list.length ? '' : '<p class="empty">No trips yet.</p>'}<div class="btn-stack">${btn('Plan a trip', 'data-newplan', 'primary')}${btn('🛂 My Passport and Stamps', 'data-passportbook')}</div>`;
    },

    trip({ id }, ui) {
      const t = travel.tripById(id);
      if (!t) return '<p class="empty">That trip is not in this life.</p>';
      const c = travel.tripCard(t);
      const away = t.status === 'in_progress';
      const acts = away ? travel.activityOptions(t) : [];
      return `<div class="world-head"><div class="world-flag big">${c.flag}</div><div><h2 style="margin:0">${esc(c.where)}</h2><p class="muted" style="margin:0">${esc(c.type)} · ${esc(STATUS[c.status])}</p></div></div>
        <div class="card"><h3>The trip</h3>${kvt('Dates', `${c.depart} to ${c.ret}`)}${c.mode ? kvt('Travel', c.mode) : ''}${c.stay ? kvt(t.status === 'completed' ? 'Stayed' : 'Staying', c.stay) : ''}${(() => { const kinPaid = (t.bookings ?? []).filter((b) => b.payer === 'parent').reduce((sum, b) => sum + b.amount, 0); return `${kinPaid ? kvt('Your family paid', money(kinPaid)) : ''}${c.spent || !kinPaid ? kvt('Your share', money(c.spent)) : ''}`; })()}
          ${c.itinerary ? `<details ${ui.legs ? 'open' : ''} data-toggle="legs"><summary>Journey</summary>${[...c.itinerary.out, ...c.itinerary.back].map((l) => `<p>${esc(l.from.city)} ${esc(l.depart.date)} ${esc(l.depart.time)} → ${esc(l.to.city)} ${esc(l.arrive.date)} ${esc(l.arrive.time)}</p>`).join('')}</details>` : ''}
          ${c.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join('')}</div>
        <div class="card"><h3>Travelers</h3>${c.travelers.map((x) => `<button type="button" class="tree-row" ${x.you ? '' : `data-npcperson="${x.id}"`}><strong>${esc(x.name)}</strong><small>${esc(x.relation)} · ${esc(x.status === 'organizer' ? 'organizer' : x.status === 'accepted' ? 'came' : x.status === 'stayed' ? 'could not come' : 'did not come')}</small></button>`).join('')}</div>
        ${t.status === 'confirmed' && c.planned.length ? `<div class="card"><h3>The plan</h3><div class="chips">${c.planned.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>` : ''}
        ${c.done.length ? `<div class="card"><h3>${away ? 'Done so far' : 'What you did'}</h3>${c.done.map((d) => kvt(d.date ?? '', `${d.name}${d.liked ? ' ★' : ''}`)).join('')}</div>` : ''}
        ${c.memories.length ? `<div class="card"><h3>Memories</h3>${c.memories.map((e) => `<button type="button" class="tree-row" data-event="${e.id}"><strong>${esc(e.title)}</strong><small>${esc(e.text ?? '')}</small></button>`).join('')}</div>` : ''}
        ${away ? `<div class="card"><h3>While you are here</h3><p class="muted">${travel.daysLeft(t)} days left.</p>${acts.map((a) => `<button type="button" class="tree-row" data-doact="${a.id}" ${t.done.some((d) => d.id === a.id) || a.days > travel.daysLeft(t) ? 'disabled' : ''}><strong>${esc(a.name)}${a.liked ? ' ★' : ''}</strong><small>${a.cost ? esc(money(a.costLocal)) : 'Free'} · ${a.days ? `${a.days} day${a.days > 1 ? 's' : ''}` : 'an evening'}${t.activities.includes(a.id) ? ' · paid for' : ''}</small></button>`).join('')}</div>
          <div class="btn-stack">${btn('Come home', `data-home="${t.id}"`, 'primary')}</div>` : ''}
        ${t.status === 'confirmed' ? `<div class="btn-stack">${docs.yearOf(t.depart) === store.state.year ? btn('Leave Now', `data-depart="${t.id}"`, 'primary') : `<p class="muted">Leaves in ${docs.yearOf(t.depart)}.</p>`}${btn('Cancel This Trip', `data-cancel="${t.id}"`, 'danger')}</div>` : ''}`;
    },

    documents(params, ui) {
      const d = docs.documentsView();
      const p = player();
      const paper = cit.papers(p);
      const nat = paper.naturalization;
      const tab = ui.tab ?? 'citizenship';
      const tabs = [['citizenship', 'Citizenship'], ['passports', 'Passports'], ['visas', 'Visas'], ['residence', 'Residence'], ['applications', 'Applications'], ['history', 'Immigration history']];
      let body = '';
      if (tab === 'citizenship') body = `<div class="card"><h3>Born</h3>${kvt('Birthplace', placeName(p.birthCountryId, p.birthCity, p.birthYear))}</div>
        ${paper.citizenships.map((c) => `<div class="card"><h3>${c.flag} ${esc(c.name)}</h3>${kvt('How', c.how)}${kvt('Since', c.since ?? 'birth')}${kvt('Status', c.lost ? `Ended ${c.lost}` : 'Held')}</div>`).join('')}
        <div class="card"><h3>Becoming a citizen where you live</h3><p>${esc(nat.possible ? `You can apply. ${nat.outlook}` : nat.why)}</p>${nat.possible ? btn('Apply for citizenship', 'data-naturalize', 'primary') : ''}</div>`;
      if (tab === 'passports') body = d.people.map((x) => `<div class="card"><h3>${esc(x.name)}${x.you ? '' : ' (your child)'}</h3>
        ${x.passports.length ? x.passports.map((pp) => kv(`${pp.flag} ${esc(pp.name)}`, `${esc(pp.word)} · ${esc(pp.issuedOn)} to ${esc(pp.expiresOn)}${pp.status === 'valid' ? ` <button type="button" class="btn small" data-lost="${x.id}" data-doc="${pp.id}">Report lost</button>` : ''}`)).join('') : '<p class="muted">No passport.</p>'}
        ${x.nationalities.map((n) => `<p>${n.flag} ${esc(n.name)}: ${n.quote.possible ? btn(`${n.quote.renewal ? 'Renew' : 'Apply'} (${money(n.quote.fee)}, ${n.quote.years} years)`, `data-passport="${x.id}" data-issuer="${n.id}"`, 'small') : `<small class="muted">${esc(n.quote.why)}</small>`}</p>`).join('')}</div>`).join('')
        + '';
      if (tab === 'visas') body = d.people.map((x) => `<div class="card"><h3>${esc(x.name)}</h3>${x.authorizations.length ? x.authorizations.map((a) => kvt(`${a.name}: ${a.place}`, `${STATUS[a.status] ?? a.status} · ${a.validFrom} to ${a.validUntil} · ${a.permitted.join(', ')}`)).join('') : '<p class="muted">None.</p>'}</div>`).join('')
        + '';
      if (tab === 'residence') { const r = paper.residency; body = `<div class="card"><h3>${r.flag} ${esc(r.name)}</h3>${kvt('Status', r.word)}${r.status !== 'citizen' ? kvt('Since', r.since) : ''}${imm.statusLine(p) ? kvt('Permission', imm.statusLine(p)) : ''}${kvt('Work', r.workAuthorized ? 'Allowed' : 'Not allowed')}${kvt('Health care', healthCover(p).how)}${kvt('Tax residence (game rule)', `${nameOf(p.countryId)}: where you live`)}</div>${(() => { const house = imm.household(p).filter((h) => !h.citizen || r.status !== 'citizen'); return house.length ? `<div class="card"><h3>Your household here</h3>${house.map((h) => kvt(`${h.name}${h.role === 'child' ? `, ${h.age}` : ''}`, h.status)).join('')}</div>` : ''; })()}`; }
      if (tab === 'applications') body = d.applications.length ? d.applications.map((a) => `<div class="card"><h3>${esc({ passport: 'Passport', eta: 'Electronic authorization', evisa: 'e-Visa', visa: 'Visitor visa', study: 'Student visa', on_arrival: 'Visa on arrival', relocation: 'Moving abroad' }[a.kind] ?? a.kind)}: ${esc(a.place)}</h3>
          ${kvt('For', a.who)}${kvt('Submitted', a.submittedYear)}${kvt('Status', STATUS[a.status] ?? a.status)}${['submitted', 'review_requested'].includes(a.status) ? kvt('Decision', `when ${a.decideYear} begins`) : ''}${a.reason ? `<p class="muted">${esc(a.reason)}</p>` : ''}
          ${a.status === 'refused' && a.kind !== 'eta' && a.kind !== 'relocation' && !(a.reviews >= 1) ? btn('Ask for a review', `data-review="${a.id}"`, 'small') : ''}${['submitted'].includes(a.status) && a.kind !== 'relocation' ? btn('Withdraw', `data-withdraw="${a.id}"`, 'small') : ''}</div>`).join('') : '<p class="empty">No applications.</p>';
      if (tab === 'history') body = `<div class="card">${story.placesLived().map((l) => kvt(`${l.from ?? '?'}${l.to ? `–${l.to}` : l.current ? ' to now' : ''}`, `${l.flag} ${l.city ? `${l.city}, ` : ''}${l.jurisdiction.name}${l.reason ? ` · ${l.reason}` : ''}`)).join('')}</div>`;
      return `<div class="btn-stack" style="margin-bottom:12px">${btn('🛂 Open My Passport', 'data-passportbook', 'primary')}</div>
        <div class="world-groups">${tabs.map(([id, label]) => chip(label, tab === id, `data-tab="${id}"`)).join('')}</div>${body}`;
    },

    immigration(params, ui) {
      const p = player();
      const cases = reloc.cases().slice().reverse();
      const dest = ui.dest;
      const ways = dest ? move.routes(dest) : [];
      const live = cases.filter((a) => ['submitted', 'review_requested', 'approved'].includes(a.status) && !a.used);
      return `
        <div class="card"><h3>Residence status</h3>${kvt(nameOf(p.countryId), cit.STATUS_WORDS[cit.residency(p).status])}${imm.statusLine(p) ? `<p class="muted">${esc(imm.statusLine(p))}</p>` : ''}</div>
        ${live.map((a) => {
          const steps = reloc.checklist(a.id);
          const opts = reloc.housingOptions(a);
          const pets = move.travelPlan(a.jurisdictionId);
          return `<div class="card"><h3>Moving to ${flag(a.jurisdictionId)} ${esc(nameOf(a.jurisdictionId))}</h3>${kvt('Route', a.routeName)}${kvt('Status', STATUS[a.status])}
            <div class="section-label">Moving checklist</div>${steps.map((s) => `<p class="gl-check ${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${esc(s.label)} ${s.note ? `<small class="muted">${esc(s.note)}</small>` : ''}</p>`).join('')}
            ${a.status === 'approved' ? `
              <label class="field">City <select data-arr="city" data-case="${a.id}">${COUNTRIES[a.jurisdictionId].cities.map((c) => `<option ${c === a.city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
              <label class="field">Housing <select data-arr="housing" data-case="${a.id}"><option value="">Choose…</option>${opts.map((o) => `<option value="${o.id}" ${a.arrangements.housing === o.id ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
              <label class="field">Money <select data-arr="money" data-case="${a.id}"><option value="">Choose…</option>${[['0', 'Change it all'], ['0.25', 'Leave a quarter behind'], ['0.5', 'Leave half behind']].map(([v2, l]) => `<option value="${v2}" ${a.arrangements.money != null && String(a.arrangements.money) === v2 ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              ${pets.length ? `<label class="field">Your animals (${esc(pets.map((t) => t.a.name).join(', '))}) <select data-arr="animals" data-case="${a.id}"><option value="">Choose…</option>${pets.some((t) => t.ok) ? `<option value="bring" ${a.arrangements.animals === 'bring' ? 'selected' : ''}>Bring those who can come (${money(pets.reduce((s2, t) => s2 + t.cost, 0))})</option>` : ''}<option value="leave" ${a.arrangements.animals === 'leave' ? 'selected' : ''}>Find them homes here</option></select></label>` : ''}
              <label class="field">Journey <select data-arr="travel" data-case="${a.id}"><option value="">Choose…</option>${travel.modesFor({ countryId: p.countryId, city: p.city }, { countryId: a.jurisdictionId, city: a.city }, store.state.year).map((m) => `<option value="${esc(m.name.toLowerCase())}" ${a.arrangements.travel === m.name.toLowerCase() ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
              ${fam.childrenMoving(a.jurisdictionId).map((c) => ({ c, s: fam.consent(a.jurisdictionId, c) })).filter((x) => x.s.needed).map(({ c, s }) => `<div class="gl-route"><strong>${esc(c.firstName)}, ${c.age}</strong><small>${esc(s.otherParent.firstName)} is ${esc(c.firstName)}'s other parent and is not coming. A child does not move country without their agreement or a court's.</small>
                ${s.status === 'unasked' ? btn(`Ask ${s.otherParent.firstName}`, `data-consent="${c.id}" data-dest="${a.jurisdictionId}"`, 'small') : ''}
                ${s.status === 'refused' ? btn(`Ask a court (${money(Math.round(fam.COURT_COST * country().currency.scale))})`, `data-court="${c.id}" data-dest="${a.jurisdictionId}" data-reason="${a.routeId}"`, 'small') : ''}
                ${['refused', 'court_refused', 'unasked'].includes(s.status) ? btn(`${c.firstName} stays with ${s.otherParent.firstName}`, `data-staychild="${c.id}" data-dest="${a.jurisdictionId}"`, 'small') : `<small>${esc({ agreed: 'Agreed.', court_allowed: 'The court allowed it.', staying: `Staying with ${s.otherParent.firstName}.` }[s.status] ?? '')}</small>`}</div>`).join('')}
              <div class="btn-stack">${btn('Complete the move', `data-complete="${a.id}"`, 'primary')}</div>` : ''}</div>`;
        }).join('')}
        <div class="card"><h3>Explore countries</h3><select data-dest aria-label="Country"><option value="">Choose a country…</option>${COUNTRY_LIST.filter((c) => c.id !== p.countryId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}" ${dest === c.id ? 'selected' : ''}>${c.flag} ${esc(c.name)}</option>`).join('')}</select>
          ${dest ? `<div class="section-label">Immigration options</div>${languageNote(dest) ? `<p class="muted">${esc(languageNote(dest))}</p>` : ''}${ways.map((r) => `<div class="gl-route ${r.eligible ? '' : 'closed'}"><strong>${esc(r.name)}</strong><small>${esc(r.blurb)}</small><small>${esc(r.eligible ? `${r.outlook} ${r.fee ? money(r.fee) : 'No fee'}${r.years ? ` · ${r.years} years, then renewed or ended` : ''}. You arrive as: ${cit.STATUS_WORDS[r.status] ?? r.status}.` : r.why)}</small>
            ${r.eligible ? btn(['right', 'free'].includes(r.id) ? 'Start arranging the move' : `Apply (${money(Math.round(r.fee * 0.2))} now)`, `data-applymove="${r.id}"`, 'small') : ''}</div>`).join('')}
            <div class="section-label">Family relocation</div><p>Coming: ${esc(move.household(dest).map((n) => n.firstName).join(', ') || 'only you')}.</p>
            ${move.askable().map((x) => `<button type="button" class="tree-row" data-ask="${x.npc.id}" ${x.asked ? 'disabled' : ''}><strong>Ask ${esc(x.npc.firstName)}</strong><small>${x.coming ? 'Has said yes' : x.asked ? 'Has said no' : 'They decide for themselves'}</small></button>`).join('')}` : ''}</div>
        <div class="card"><h3>Work and study abroad</h3>
          ${(() => { const qs = creds.qualifications(); return qs.length ? `<div class="section-label">Your qualifications</div>${qs.map((q) => `<div class="gl-route ${q.here ? '' : 'closed'}"><strong>${esc(q.name)}</strong>
            <small>${esc(q.here ? `Recognized in ${nameOf(p.countryId)}: you can practice here.` : `Recognized in ${q.practice.map(nameOf).join(', ') || 'nowhere yet'}; not yet in ${nameOf(p.countryId)}.`)}</small>
            ${q.here ? '' : `<small>${esc(q.open ? (q.open.status === 'pending' ? `With ${q.body}: decided when the year turns.` : `Adaptation year with ${q.body}.`) : q.mutual ? `Under the ${q.mutual}, ${q.body} registers it on application.` : `${q.body.replace(/^./, (x) => x.toUpperCase())} decides: a full license, a supervised year${regFor(q).exam ? ' and an exam' : ''}, or a refusal. ${q.language.needed ? `They ask for the language at level ${q.language.needed}; you have ${Math.round(q.language.have)}.` : ''}`)}</small>
            ${q.open ? '' : btn(`Apply for recognition (${money(q.fee)})`, `data-recognize="${q.profession}"`, 'small')}`}</div>`).join('')}
            ` : ''; })()}</div>
        ${(() => {
          const mine = bizAbroad.businessesAbroad();
          const types = bizEngine.startOptions().filter((t) => !t.solo);
          const bt = ui.bizType ?? types.find((t) => !t.block)?.id ?? types[0]?.id;
          const bc = ui.bizCountry ?? null;
          const city = bc ? (ui.bizCity && COUNTRIES[bc].cities.includes(ui.bizCity) ? ui.bizCity : capitalCity(bc)) : null;
          const block = bc ? bizAbroad.abroadBlock(bt, bc) : '';
          const q = bc && !block ? bizAbroad.quoteAbroad(bt, bc, city) : null;
          const home = bizEngine.openBusinesses().filter((b) => b.countryId === p.countryId && b.reputation >= 60 && bizEngine.managerOf(b));
          return `<div class="card"><h3>Business abroad</h3>
            ${mine.length ? mine.map((b) => kvt(`${b.name}, ${b.city}`, `${nameOf(b.countryId)} · ${b.staff} staff${b.manager ? ` · run by ${b.manager}` : ''}${b.profit != null ? ` · last year ${b.profit >= 0 ? 'profit' : 'loss'} ${fmtMoney(Math.abs(b.profit), COUNTRIES[b.countryId])}` : ''}`)).join('') : '<p class="muted">You own no business abroad.</p>'}
            <div class="section-label">Start one in another country</div>
            <label class="field">Kind <select data-bizf="bizType">${types.map((t) => `<option value="${t.id}" ${t.id === bt ? 'selected' : ''} ${t.block ? 'disabled' : ''}>${esc(t.name)}${t.block ? ` (${esc(t.block)})` : ''}</option>`).join('')}</select></label>
            <label class="field">Country <select data-bizf="bizCountry"><option value="">Choose…</option>${COUNTRY_LIST.filter((c) => c.id !== p.countryId).sort((a, b2) => a.name.localeCompare(b2.name)).map((c) => `<option value="${c.id}" ${bc === c.id ? 'selected' : ''}>${c.flag} ${esc(c.name)}</option>`).join('')}</select></label>
            ${bc ? `<label class="field">City <select data-bizf="bizCity">${COUNTRIES[bc].cities.map((c) => `<option ${c === city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>` : ''}
            ${block ? `<p class="muted">${esc(block)}</p>` : q ? `<p class="muted">About ${esc(money(q.fromCash))} of your money (${esc(fmtMoney(q.total, COUNTRIES[bc]))} there): the premises, the registration, and a manager's first months. Its accounts are kept and taxed there. It gives no right to live there.</p>${btn('Open it', `data-bizstart="${bt}" data-bizcountry="${bc}" data-bizcity="${esc(city)}"`, 'small')}` : ''}
            ${home.length ? `<div class="section-label">A branch abroad</div>${home.map((b) => `<p>${esc(b.name)}: ${bc ? btn(`Open a branch in ${city}`, `data-bizbranch="${b.id}" data-bizcountry="${bc}" data-bizcity="${esc(city)}"`, 'small') : '<small class="muted">Choose a country above.</small>'}</p>`).join('')}` : ''}
            </div>`;
        })()}
        <div class="card"><h3>Citizenship pathways</h3><p class="muted">${esc(cit.naturalization(p).possible ? 'You can apply for citizenship where you live (Passport & Documents).' : cit.naturalization(p).why)} Permanent residence is not citizenship; marriage shortens the wait and grants nothing by itself.</p></div>
        ${cases.filter((a) => !live.includes(a)).length ? `<div class="card"><h3>Earlier applications</h3>${cases.filter((a) => !live.includes(a)).map((a) => kvt(`${nameOf(a.jurisdictionId)}, ${a.submittedYear}`, `${a.routeName}: ${STATUS[a.used ? 'used' : a.status]}`)).join('')}</div>` : ''}`;
    },

    lived() {
      const list = story.placesLived();
      return `<p class="muted">Every place became part of your story.</p>${list.map((l) => `<button type="button" class="row world-row" data-residence="${l.index}"><div class="world-flag">${l.flag}</div>
        <div class="main"><strong>${esc(l.city ? `${l.city}, ` : '')}${esc(l.jurisdiction.name)}</strong><small>${esc(`${l.from ?? '?'}${l.to ? `–${l.to}` : l.current ? ' to now' : ''}`)}${l.reason ? ` · ${esc(l.reason)}` : ''}${l.derived ? ' · from older records' : ''}</small></div></button>`).join('')}
        <div class="btn-stack" style="margin-top:10px">${btn('Our Global Story', 'data-story', 'primary')}</div>`;
    },

    residence({ id }) {
      const l = story.placesLived()[Number(id)];
      if (!l) return '<p class="empty">Not found.</p>';
      return `<div class="world-head"><div class="world-flag big">${l.flag}</div><div><h2 style="margin:0">${esc(l.city ?? l.name)}</h2><p class="muted" style="margin:0">${esc(l.jurisdiction.name)}${l.jurisdiction.historical ? ` (now ${esc(l.name)})` : ''}</p></div></div>
        <div class="card">${kvt('From', l.from ?? 'not recorded')}${kvt('To', l.to ?? (l.current ? 'now' : 'not recorded'))}${kvt('Why', l.reason ?? 'not recorded')}${l.derived ? '<p class="muted">From older records: some details were never kept.</p>' : ''}</div>
        ${l.move ? `<div class="card"><h3>The move</h3><button type="button" class="tree-row" data-event="${l.move.id}"><strong>${esc(l.move.title)}</strong><small>${esc(l.move.text ?? '')}</small></button></div>` : ''}
        ${l.homes.length ? `<div class="card"><h3>Homes</h3>${l.homes.map((h) => `<button type="button" class="tree-row" data-house="${h.id}"><strong>${esc(h.name)}</strong><small>${esc(h.city ?? '')} · ${h.owned ? 'still yours' : 'no longer the family\'s'}</small></button>`).join('')}</div>` : ''}
        ${l.neighborhoods?.length ? `<div class="card"><h3>Neighborhoods</h3>${l.neighborhoods.map((h) => `<button type="button" class="tree-row" data-hoodlink="${h.id}"><strong>${esc(h.name)}</strong><small>Open its chronicle</small></button>`).join('')}</div>` : ''}
        ${l.people.length ? `<div class="card"><h3>Who came</h3><p>${esc(l.people.join(', '))}</p></div>` : ''}
        ${l.memories.length ? `<div class="card"><h3>Remembered from here</h3>${l.memories.map((e) => `<button type="button" class="tree-row" data-event="${e.id}"><strong>${esc(e.title)}</strong><small>${e.year}</small></button>`).join('')}</div>` : ''}
        ${(() => { const friends = livingNpcs().filter((n) => n.places?.some((pl) => pl.countryId === l.countryId) && ['friend', 'bestfriend', 'sibling', 'parent', 'grandparent', 'colleague', 'exclassmate'].includes(n.role)); return friends.length ? `<div class="card"><h3>People from here</h3>${friends.map((n) => `<button type="button" class="tree-row" data-npcperson="${n.id}"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${typeof n.flags.abroad === 'string' ? `in ${esc(nameOf(n.flags.abroad))}` : `in ${esc(nameOf(player().countryId))}`}</small></button>`).join('')}</div>` : ''; })()}`;
    },

    languages() {
      const p = player();
      const langs = SKILLS.filter((s) => s.group === 'language');
      const word = (v) => [...LEVELS].reverse().find(([min]) => v >= min)?.[1] ?? 'Beginner';
      const logs = p.languageLog ?? [];
      const known = langs.filter((l) => (p.skills?.[l.id] ?? 0) > 0);
      const native = languagesOf(p.birthCountryId);
      const s = p.flags.settling;
      return `<div class="card"><h3>Languages</h3>${kvt('First language', native.length ? native.map((id) => langs.find((l) => l.id === id)?.name).join(', ') : `the language of ${nameOf(p.birthCountryId)}`)}
          ${known.filter((l) => !native.includes(l.id)).map((l) => kv(esc(l.name), `${esc(word(p.skills[l.id]))} <small class="muted">${Math.round(p.skills[l.id])}/100</small>`)).join('') || '<p class="muted">No other languages yet.</p>'}
          <p class="muted">Where you live: ${esc(fluency(p.countryId, p) || 'no other language needed')}. Proficiency grows with time and use: lessons, living somewhere, family. Nobody is fluent after one trip.</p></div>
        ${logs.length ? `<div class="card"><h3>How you learned</h3>${logs.slice(-12).reverse().map((x) => kvt(`${x.year}`, `${langs.find((l) => l.id === x.lang)?.name ?? x.lang}: ${x.source}`)).join('')}</div>` : ''}
        <div class="card"><h3>Culture and belonging</h3>${s ? `<p>Still settling into ${esc(nameOf(s.countryId))}, since ${s.since}. It takes some people longer than others; friends nearby help.</p>` : ''}
          ${chron.events((e) => e.type === 'belonging' && e.subject === chron.archiveIdOf(p)).map((e) => kvt(String(e.year), e.title)).join('') || (s ? '' : '')}
          ${kvt('Countries lived in', String(new Set(story.placesLived().map((l) => l.countryId)).size))}</div>`;
    },

    journal(params, ui) {
      const p = player();
      const done = travel.trips(['completed']);
      const tab = ui.tab ?? 'timeline';
      const tabs = [['timeline', 'Timeline'], ['map', 'Map'], ['country', 'By country'], ['year', 'By year'], ['companions', 'By companion'], ['favorites', 'Favorite memories'], ['collection', 'Collection']];
      const row = (t) => { const c = travel.tripCard(t); return `<button type="button" class="row world-row" data-trip="${t.id}"><div class="world-flag">${c.flag}</div><div class="main"><strong>${esc(c.where)}</strong><small>${esc(c.depart)} · ${esc(c.type)}${c.travelers.length > 1 ? ` · with ${esc(c.travelers.filter((x) => !x.you && x.status === 'accepted').map((x) => x.name).join(', '))}` : ''}</small></div></button>`; };
      const groupBy = (f) => { const m = new Map(); for (const t of done) for (const k of [].concat(f(t))) { if (!m.has(k)) m.set(k, []); m.get(k).push(t); } return m; };
      let body = '';
      if (tab === 'timeline') body = done.map(row).join('') || '<p class="empty">No trips yet. The places you go will be kept here.</p>';
      if (tab === 'map') body = mapSvg(story.globalStory({ person: chron.archiveIdOf(p), kinds: ['visited'] }), ui);
      if (tab === 'country') body = [...groupBy((t) => nameOf(t.destination.countryId))].map(([k, v]) => `<div class="section-label">${esc(k)}</div>${v.map(row).join('')}`).join('');
      if (tab === 'year') body = [...groupBy((t) => t.depart.slice(0, 4))].map(([k, v]) => `<div class="section-label">${esc(k)}</div>${v.map(row).join('')}`).join('');
      if (tab === 'companions') body = [...groupBy((t) => { const xs = t.travelers.filter((x) => x.status === 'accepted').map((x) => docs.personById(x.id)?.firstName).filter(Boolean); return xs.length ? xs : ['On your own']; })].map(([k, v]) => `<div class="section-label">${esc(k)}</div>${v.map(row).join('')}`).join('');
      if (tab === 'favorites') body = chron.events((e) => e.tripId && e.significance >= 2 && chron.visible(e)).reverse().map((e) => `<button type="button" class="tree-row" data-event="${e.id}"><strong>${esc(e.title)}</strong><small>${e.year}${e.text ? ` · ${esc(e.text)}` : ''}</small></button>`).join('') || '<p class="empty">Nothing yet.</p>';
      if (tab === 'collection') {
        const col = travel.collection();
        body = `<div class="card">${kvt('Countries', String(col.countries.length))}${kvt('Cities', String(col.cities))}${col.favorite ? kvt('Most visited', `${col.favorite.flag} ${col.favorite.name}`) : ''}</div>
          <div class="passport">${col.countries.map((e, i) => `<div class="stamp" style="transform:rotate(${[-3, 2, -1, 3, -2, 1][i % 6]}deg)"><span class="flag">${e.flag}</span><strong>${esc(e.name)}</strong><small>${e.legacy ? 'An older record' : `First ${esc(String(e.first))}${e.visits > 1 ? ` · ${e.visits} visits` : ''}`}</small></div>`).join('')}</div>
          
          <div class="card"><h3>Achievements</h3>${travel.achievements().map((a) => kv(`${a.year ? '★' : '☆'} ${esc(a.name)}`, `<small>${esc(a.year ? `${a.year}` : a.desc)}</small>`)).join('')}</div>`;
      }
      return `<p class="muted">The places you've been. The memories you've made.</p><div class="world-groups">${tabs.map(([id, label]) => chip(label, tab === id, `data-tab="${id}"`)).join('')}</div>${body}`;
    },

    story(params, ui) {
      const f = { generation: ui.generation ?? null, person: ui.person ?? null, country: ui.country ?? null, from: ui.from ?? null, to: ui.to ?? null, kinds: ui.kinds ?? [] };
      const s = story.globalStory(f);
      const all = story.globalStory({});
      const people = all.people.filter((x) => f.generation == null || x.generation === f.generation);
      const g0 = player().generation ?? 1;
      const genWord = (g) => (g === g0 ? 'Your generation' : g < g0 ? `${g0 - g === 1 ? 'Parents' : g0 - g === 2 ? 'Grandparents' : `${g0 - g} generations up`}` : `${g - g0 === 1 ? 'Children' : g - g0 === 2 ? 'Grandchildren' : `${g - g0} generations down`}`);
      const kinds = [['born', 'Birthplaces'], ['lived', 'Residences'], ['visited', 'Trips'], ['moved', 'Moves']];
      return `
        <div class="world-groups">${chip('All generations', f.generation == null, 'data-gen=""')}${all.generations.map((g) => chip(genWord(g), f.generation === g, `data-gen="${g}"`)).join('')}</div>
        <div class="world-groups">${kinds.map(([k, l]) => chip(l, !f.kinds.length || f.kinds.includes(k), `data-kind="${k}"`)).join('')}</div>
        <div class="gl-dates"><label class="field">Person <select data-sf="person"><option value="">Everyone</option>${people.map((x) => `<option value="${esc(x.id)}" ${f.person === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="field">Country <select data-sf="country"><option value="">Everywhere</option>${all.countries.map((c) => `<option value="${c}" ${f.country === c ? 'selected' : ''}>${flag(c)} ${esc(nameOf(c))}</option>`).join('')}</select></label></div>
        <div class="gl-dates"><label class="field">From year <input type="number" data-sf="from" value="${f.from ?? ''}" inputmode="numeric"></label><label class="field">To year <input type="number" data-sf="to" value="${f.to ?? ''}" inputmode="numeric"></label></div>
        ${mapSvg(s, ui)}
        ${ui.marker ? (() => { const m = s.markers.find((x) => x.key === ui.marker); return m ? `<div class="card"><h3>${flag(m.countryId)} ${esc(m.name)}</h3>${m.items.map((i) => `<button type="button" class="tree-row" ${i.eventId ? `data-event="${i.eventId}"` : i.tripId ? `data-trip="${i.tripId}"` : `data-person="${esc(i.person)}"`}><strong>${esc(i.name ?? '')}</strong><small>${esc({ born: 'Born here', lived: 'Lived here', visited: 'Visited', moved: 'Moved here' }[i.kind])}${i.year ? `, ${i.year}` : ''}${i.to ? `–${i.to}` : ''}</small></button>${(i.homes ?? []).map((h) => `<button type="button" class="tree-row" data-house="${h}" style="padding-left:28px"><strong>A home here</strong><small>Open its chronicle</small></button>`).join('')}`).join('')}</div>` : ''; })() : ''}
        <div class="card"><h3>Highlights</h3>${kvt('Moves between countries', String(s.international.length))}${kvt('Children born', String(s.births.length))}${kvt('Family reunions', String(s.reunions.length))}${kvt('Countries', String(s.countries.length))}</div>
        <div class="section-label">Timeline</div>
        ${s.timeline.map((i, n) => `<details class="gl-tl" ${ui.open === n ? 'open' : ''} data-tl="${n}"><summary>${esc(String(i.year ?? '?'))} · ${esc(i.name ?? '')}: ${esc({ born: 'born', lived: 'lived', visited: 'visited', moved: 'moved' }[i.kind])} ${esc(i.where)}</summary>
          <div class="btn-row" style="flex-wrap:wrap;margin:6px 0">${btn('The person', `data-person="${esc(i.person)}"`, 'small')}${i.eventId ? btn('The move', `data-event="${i.eventId}"`, 'small') : ''}${i.tripId ? btn('The trip', `data-trip="${i.tripId}"`, 'small') : ''}${(i.homes ?? []).map((h) => btn('The home', `data-house="${h}"`, 'small')).join('')}</div></details>`).join('') || '<p class="empty">Nothing matches.</p>'}
        `;
    },

    person({ id }) {
      const h = story.personHistory(id);
      if (!h) return '<p class="empty">That person is not in this family\'s record.</p>';
      const n = h.npcId ? store.state.npcs[h.npcId] : null;
      const age = n ? n.age : h.kind === 'player' ? player().age : h.died && h.born?.year ? h.died - h.born.year : 40;
      return `<div class="world-head"><div class="avatar">${h.appearance ? avatarSvg({ age, gender: n?.gender ?? (h.kind === 'player' ? player().gender : 'female'), ...(h.kind === 'player' && !n ? { face: faceGenderOf(player()) } : {}), appearance: h.appearance, seed: h.npcId ?? h.id, label: h.firstName }) : ''}</div>
          <div><h2 style="margin:0">${esc(h.name)}</h2><p class="muted" style="margin:0">${esc(h.relation ?? '')}${h.alive === false ? ' · died' : ''}</p></div></div>
        <div class="card"><h3>Places</h3>${kvt('Born', h.bornName)}${h.places.map((l) => kvt(`${l.from ?? '?'}${l.to ? `–${l.to}` : ''}`, `${l.flag} ${l.city ? `${l.city}, ` : ''}${l.jurisdiction.name}${l.derived ? ' (older record)' : ''}`)).join('')}</div>
        ${h.citizenship.length ? `<div class="card"><h3>Nationality</h3>${h.citizenship.map((c) => kvt(c.name, `${HOW[c.how] ?? c.how ?? ''}${c.lost ? `, until ${c.lost}` : ''}`)).join('')}${h.applicationsPrivate ? '<p class="muted">Their applications and papers are private.</p>' : ''}</div>` : ''}
        ${h.shared.length || h.memories.length ? `<div class="card"><h3>Shared memories</h3>${h.shared.map((e) => `<button type="button" class="tree-row" data-event="${e.id}"><strong>${esc(e.title)}</strong><small>${e.year}</small></button>`).join('')}${h.memories.map((m) => kvt(`When you were ${m.age}`, m.text)).join('')}</div>` : ''}
        <div class="btn-stack">${btn('Their Life Story', `data-lifestory="${esc(h.id)}"`)}${n?.alive ? btn('Open their profile', `data-profile="${n.id}"`) : ''}</div>`;
    },

    lifestory({ id }) {
      const h = story.personHistory(id);
      if (!h) return '<p class="empty">Not found.</p>';
      return `<h3>${esc(h.name)}</h3>${h.events.map((e) => `<button type="button" class="tree-row" data-event="${e.id}"><strong>${e.year} · ${esc(e.title)}</strong><small>${esc(e.text ?? '')}</small></button>`).join('') || '<p class="empty">Nothing recorded yet.</p>'}
        ${h.kind === 'player' ? `<div class="section-label">Milestones</div>${player().milestones.slice(-20).map((m) => kvt(`Age ${m.age}`, m.text)).join('')}` : ''}`;
    },

    event({ id }) {
      const e = chron.eventById(id);
      if (!e || !chron.visible(e)) return '<p class="empty">This is private.</p>';
      return `<div class="card"><h3>${esc(e.title)}</h3>${kvt('When', `${e.date ?? e.year}`)}${e.place ? kvt('Where', placeName(e.place.countryId, e.place.city, e.year)) : ''}${e.from ? kvt('From', placeName(e.from.countryId, e.from.city, e.year)) : ''}${e.text ? `<p>${esc(e.text)}</p>` : ''}</div>
        <div class="card"><h3>People</h3>${e.people.map((x) => `<button type="button" class="tree-row" data-person="${esc(x)}"><strong>${esc(story.personName(x) ?? 'Someone')}</strong></button>`).join('')}</div>
        ${e.tripId ? `<div class="btn-stack">${btn('The trip', `data-trip="${e.tripId}"`)}</div>` : ''}${e.propertyId ? `<div class="btn-stack">${btn('The home', `data-house="${e.propertyId}"`)}</div>` : ''}`;
    },

    house({ id }) {
      const h = story.homeChronicle(id);
      if (!h) return '<p class="empty">Not found.</p>';
      return `<div class="card"><h3>${esc(h.name)}</h3>${kvt('Where', h.where)}${kvt('Owner', h.owner)}${kvt('Lived in now', h.livedInNow ? 'Yes, by you' : h.let ? 'Let to tenants' : 'No')}${h.bought ? kvt('Bought', String(h.bought)) : ''}
        </div>
        <div class="card"><h3>Who lived here</h3>${h.residents.map((r) => `<button type="button" class="tree-row" data-person="${esc(r.id)}"><strong>${esc(r.name)}</strong><small>${r.from ?? '?'}${r.to ? `–${r.to}` : r.current ? ' to now' : ''}</small></button>`).join('') || '<p class="muted">No residents recorded.</p>'}</div>
        ${h.neighborhood ? `<div class="card"><h3>Where it stands</h3>${kvt('Neighborhood', h.neighborhood.name)}${kvt('Street', h.neighborhood.street)}<button type="button" class="tree-row" data-hoodlink="${h.neighborhood.id}"><strong>The neighborhood's chronicle</strong><small>Every street has a story</small></button></div>` : ''}
        ${h.households?.length ? `<div class="card"><h3>Every household that lived here</h3>${h.households.map((o) => kvt(o.name, `${o.from}–${o.to ?? 'now'}`)).join('')}</div>` : ''}
        ${h.events.length ? `<div class="card"><h3>What happened here</h3>${h.events.map((e) => `<button type="button" class="tree-row" data-event="${e.id}"><strong>${esc(e.title)}</strong><small>${e.year}</small></button>`).join('')}</div>` : ''}`;
    },
  };

  // ---------- The map ----------

  function mapSvg(s, ui) {
    const W = 360; const H = 180;
    const pts = s.markers.map((m) => ({ ...m, ...project(m.lat, m.lon, W, H) }));
    let vb = [0, 0, W, H];
    if (ui.zoom && pts.length) {
      const xs = pts.map((q) => q.x); const ys = pts.map((q) => q.y);
      const pad = 14; const x0 = Math.max(0, Math.min(...xs) - pad); const y0 = Math.max(0, Math.min(...ys) - pad);
      const w = Math.min(W - x0, Math.max(60, Math.max(...xs) - x0 + pad)); const h = Math.min(H - y0, Math.max(30, Math.max(...ys) - y0 + pad, w / 2));
      vb = [x0, y0, w, h];
    }
    const k = vb[2] / W; // keep markers the same size on screen whatever the zoom
    const grid = [];
    for (let lon = -150; lon <= 150; lon += 30) { const x = project(0, lon, W, H).x; grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`); }
    for (let lat = -60; lat <= 60; lat += 30) { const y = project(lat, 0, W, H).y; grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`); }
    // Context: every city the game knows, faintly. Real positions only: no outlines are drawn that the data does not have.
    if (land == null) loadLand(() => { if (root.isConnected && root.querySelector('.gl-map')) render(modal.el.scrollTop); });
    // Land from Natural Earth; until it has loaded (or if it cannot), every city the game knows, faintly.
    const context = land ? `<path d="${land}" class="gl-land" stroke-width="${0.25 * k}"/>`
      : CONTEXT().map((c) => { const q = project(c[0], c[1], W, H); return `<circle cx="${q.x}" cy="${q.y}" r="${0.7 * k}" class="gl-ctx"/>`; }).join('');
    // A move more than half the world apart is drawn the short way, off one edge and on at the other.
    const seg = (a, b) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="gl-move" stroke-width="${0.8 * k}" stroke-dasharray="${2 * k} ${1.2 * k}"/>`;
    const lines = s.lines.map((l) => {
      const a = project(l.from.lat, l.from.lon, W, H); const b = project(l.to.lat, l.to.lon, W, H);
      if (Math.abs(b.x - a.x) <= W / 2) return seg(a, b);
      const bx = b.x > a.x ? b.x - W : b.x + W; // b, moved one world over
      const edge = a.x < bx ? W : 0;
      const t = (edge === W ? W - a.x : a.x) / Math.abs(bx - a.x);
      const y = a.y + (b.y - a.y) * t;
      return seg(a, { x: edge === W ? W : 0, y }) + seg({ x: edge === W ? 0 : W, y }, b);
    }).join('');
    const marks = pts.map((m) => `<g class="gl-mark ${ui.marker === m.key ? 'on' : ''} ${m.approx ? 'approx' : ''}" data-marker="${esc(m.key)}" tabindex="0" role="button" aria-label="${esc(m.name)}"><circle cx="${m.x}" cy="${m.y}" r="${Math.min(4.5, 2.2 + m.items.length * 0.3) * k}" stroke-width="${0.7 * k}"/><title>${esc(m.name)}: ${m.items.length}</title></g>`).join('');
    return `<div class="gl-mapwrap"><svg class="gl-map" viewBox="${vb.join(' ')}" role="group" aria-label="Map of places in the family's history. The same places are listed in the timeline below."><rect x="0" y="0" width="${W}" height="${H}" class="gl-sea"/><g class="gl-grid">${grid.join('')}</g>${context}${lines}${marks}</svg>
      <div class="btn-row" style="margin-top:6px">${btn(ui.zoom ? 'Whole world' : 'Fit to our places', 'data-zoom', 'small')}</div></div>
      <div class="gl-legend muted">${pts.length ? `${pts.length} ${pts.length === 1 ? 'place' : 'places'}. Tap one to see what happened there.` : 'No places match.'}</div>`;
  }

  // ---------- Actions ----------

  function bind(v, ui) {
    root.querySelector('[data-close]').onclick = () => modal.close();
    const b = root.querySelector('[data-back]'); if (b) b.onclick = back;
    root.onclick = async (e) => {
      const t = (sel) => e.target.closest(sel);
      let x;
      if ((x = t('[data-section]'))) return section(x.dataset.section);
      if ((x = t('[data-filter]'))) { ui.filter = x.dataset.filter || ''; return render(0); }
      if ((x = t('[data-tab]'))) { ui.tab = x.dataset.tab; return render(modal.el.scrollTop); }
      if ((x = t('[data-dest]')) && x.tagName === 'BUTTON') return go('destination', { id: x.dataset.dest, city: x.dataset.city });
      if ((x = t('[data-planhere]'))) { const trip = travel.startPlan(); travel.updatePlan(trip.id, { destination: { countryId: x.dataset.planhere, city: x.dataset.city } }); return go('plan', { id: trip.id }); }
      if (t('[data-newplan]')) { const trip = travel.startPlan(); return go('plan', { id: trip.id }); }
      if ((x = t('[data-openplan]'))) return go('plan', { id: x.dataset.openplan });
      if ((x = t('[data-invite]'))) { const r = travel.invite(v.params.id, x.dataset.invite); ui.inviteOpen = true; return tell(r); }
      if ((x = t('[data-uninvite]'))) { travel.uninvite(v.params.id, x.dataset.uninvite); return changed(); }
      if ((x = t('[data-cruise][data-value]')) && v.view === 'plan' && x.tagName !== 'SELECT') { travel.updatePlan(v.params.id, { cruise: { [x.dataset.cruise]: x.dataset.value } }); return render(modal.el.scrollTop); }
      if ((x = t('[data-act]')) && v.view === 'plan') { const trip = travel.tripById(v.params.id); const id = x.dataset.act; travel.updatePlan(trip.id, { activities: trip.activities.includes(id) ? trip.activities.filter((a) => a !== id) : [...trip.activities, id] }); return render(modal.el.scrollTop); }
      if ((x = t('[data-passport]'))) return tell(docs.applyPassport(x.dataset.passport, x.dataset.issuer));
      if ((x = t('[data-applyentry]'))) { const trip = travel.tripById(v.params.id); return tell(docs.applyEntry(x.dataset.applyentry, trip.destination.countryId, { from: trip.depart, to: trip.ret, purpose: { visit: 'visit', business: 'business', study: 'study' }[travel.tripTypes().find((k) => k.id === trip.type).purpose], tripId: trip.id, cost: travel.quote(trip).organizer })); }
      if ((x = t('[data-askfamily]'))) return tell(travel.askFamily(x.dataset.askfamily));
      if ((x = t('[data-book]'))) { const r = travel.confirm(x.dataset.book); if (r.ok) { NAV.stack[NAV.stack.length - 1] = { view: 'trip', params: { id: x.dataset.book }, scroll: 0 }; } return tell(r); }
      if ((x = t('[data-discard]'))) { if (await confirmModal({ title: 'Discard this plan?', body: 'Nothing has been paid.', yes: 'Discard' })) { travel.discardPlan(x.dataset.discard); NAV.stack = [{ view: 'plan', params: {}, scroll: 0 }]; changed(); } return undefined; }
      if ((x = t('[data-trip]'))) { const trip = travel.tripById(x.dataset.trip); return trip ? go(trip.status === 'draft' ? 'plan' : 'trip', { id: trip.id }) : undefined; }
      // Going is instant: the whole trip is taken, and a notice says how it went.
      if (t('[data-passportbook]')) return openPassportBook();
      if ((x = t('[data-depart]'))) {
        // Off on the trip: its moments one at a time, each answered, then home.
        const r = await goOnTrip(api, x.dataset.depart, changed);
        if (!r.ok) return tell(r);
        return render(modal.el.scrollTop);
      }
      if ((x = t('[data-doact]'))) return tell(travel.doActivity(v.params.id, x.dataset.doact));
      if ((x = t('[data-home]'))) return tell(travel.comeHome(x.dataset.home));
      if ((x = t('[data-cancel]'))) { if (await confirmModal({ title: 'Cancel this trip?', body: 'What comes back depends on what was booked and how soon it is.', yes: 'Cancel the trip', no: 'Keep it', danger: true })) return tell(travel.cancel(x.dataset.cancel)); return undefined; }
      if ((x = t('[data-lost]'))) { if (await confirmModal({ title: 'Report this passport lost?', body: 'It can no longer be used. Your citizenship is not affected.', yes: 'Report it' })) return tell(docs.reportLost(x.dataset.lost, x.dataset.doc)); return undefined; }
      if ((x = t('[data-review]'))) return tell(docs.requestReview(x.dataset.review));
      if ((x = t('[data-withdraw]'))) return tell(docs.withdraw(x.dataset.withdraw));
      if (t('[data-naturalize]')) { const n = cit.naturalization(); if (await confirmModal({ title: 'Apply for citizenship?', yes: 'Apply', body: `The fee is ${money(n.fee)}, and there is a test. ${n.outlook}` })) return tell(cit.naturalize()); return undefined; }
      if ((x = t('[data-applymove]'))) { const r = reloc.applyToMove(ui.dest, x.dataset.applymove); return tell(r); }
      if ((x = t('[data-ask]'))) return tell(move.askToCome(x.dataset.ask));
      if ((x = t('[data-consent]'))) return tell(fam.askConsent(x.dataset.dest, x.dataset.consent));
      if ((x = t('[data-court]'))) { if (await confirmModal({ title: 'Ask a court?', body: 'The court decides on the child\'s interests. Lawyers cost money, and the other parent will not thank you.', yes: 'Apply to the court' })) return tell(fam.askCourt(x.dataset.dest, x.dataset.court, x.dataset.reason)); return undefined; }
      if ((x = t('[data-staychild]'))) return tell(fam.letStay(x.dataset.dest, x.dataset.staychild));
      if ((x = t('[data-recognize]'))) return tell(creds.applyRecognition(x.dataset.recognize));
      if ((x = t('[data-bizstart]'))) { if (await confirmModal({ title: 'Open a business abroad?', body: 'The money goes now. A manager runs it; you own it from here.', yes: 'Open it' })) return tell(bizAbroad.startAbroad(x.dataset.bizstart, x.dataset.bizcountry, x.dataset.bizcity)); return undefined; }
      if ((x = t('[data-bizbranch]'))) return tell(bizAbroad.openBranchAbroad(x.dataset.bizbranch, x.dataset.bizcountry, x.dataset.bizcity));
      if ((x = t('[data-complete]'))) { if (await confirmModal({ title: 'Make the move?', body: 'This is the move itself: your home changes, and your old life stays where it is.', yes: 'Move' })) return tell(reloc.completeMove(x.dataset.complete)); return undefined; }
      if ((x = t('[data-residence]'))) return go('residence', { id: x.dataset.residence });
      if (t('[data-story]')) return go('story', {});
      if ((x = t('[data-house]'))) return go('house', { id: x.dataset.house });
      if ((x = t('[data-hoodlink]'))) { const { openHoodChronicle } = await import('./neighborhood.js'); return openHoodChronicle(api, x.dataset.hoodlink); }
      if ((x = t('[data-person]'))) return go('person', { id: x.dataset.person });
      if ((x = t('[data-npcperson]'))) { const n = store.state.npcs[x.dataset.npcperson]; return n ? go('person', { id: chron.archiveIdOf(n) }) : undefined; }
      if ((x = t('[data-event]'))) return go('event', { id: x.dataset.event });
      if ((x = t('[data-lifestory]'))) return go('lifestory', { id: x.dataset.lifestory });
      if ((x = t('[data-profile]'))) { const { openNpc } = await import('./tabs/people.js'); return openNpc(store.state.npcs[x.dataset.profile], api); }
      if ((x = t('[data-marker]'))) { ui.marker = ui.marker === x.dataset.marker ? null : x.dataset.marker; return render(modal.el.scrollTop); }
      if (t('[data-zoom]')) { ui.zoom = !ui.zoom; return render(modal.el.scrollTop); }
      if ((x = t('[data-gen]'))) { ui.generation = x.dataset.gen === '' ? null : Number(x.dataset.gen); ui.person = null; ui.marker = null; return render(modal.el.scrollTop); }
      if ((x = t('[data-kind]'))) { const all = ['born', 'lived', 'visited', 'moved']; const cur = ui.kinds?.length ? ui.kinds : all; const k = x.dataset.kind; ui.kinds = cur.includes(k) ? cur.filter((y) => y !== k) : [...cur, k]; if (!ui.kinds.length || ui.kinds.length === all.length) ui.kinds = []; ui.marker = null; return render(modal.el.scrollTop); }
      return undefined;
    };
    // Markers on the map work from the keyboard too: Enter or Space, like a button.
    root.onkeydown = (e) => {
      const m = e.target.closest?.('[data-marker]');
      if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ui.marker = ui.marker === m.dataset.marker ? null : m.dataset.marker; render(modal.el.scrollTop); }
    };
    root.onchange = (e) => {
      const el = e.target;
      if (el.dataset.cruise && el.dataset.value == null && v.view === 'plan') { travel.updatePlan(v.params.id, { cruise: { [el.dataset.cruise]: el.value } }); return render(modal.el.scrollTop); }
      const f = el.dataset.planfield;
      if (f && v.view === 'plan') {
        const id = v.params.id;
        const trip = travel.tripById(id);
        if (f === 'country') travel.updatePlan(id, { destination: el.value ? { countryId: el.value } : null });
        else if (f === 'city') travel.updatePlan(id, { destination: { countryId: trip.destination.countryId, city: el.value } });
        else if (f === 'insurance') travel.updatePlan(id, { insurance: el.checked });
        else if (f === 'depart') { const nights = docs.daysBetween(trip.depart, trip.ret); travel.updatePlan(id, trip.type === 'cruise' ? { depart: el.value } : { depart: el.value, ret: docs.addDays(el.value, Math.max(1, nights)) }); }
        else travel.updatePlan(id, { [f]: el.value });
        return render(modal.el.scrollTop);
      }
      if (el.hasAttribute('data-needs')) { const p = player(); p.flags.travelNeeds = { ...(p.flags.travelNeeds ?? {}), stepFree: el.checked }; return render(modal.el.scrollTop); }
      if (el.hasAttribute('data-destcity')) { v.params.city = el.value; return render(modal.el.scrollTop); }
      if (el.hasAttribute('data-dest') && el.tagName === 'SELECT') { ui.dest = el.value || null; return render(modal.el.scrollTop); }
      const arr = el.dataset.arr;
      if (arr) {
        const id = el.dataset.case;
        if (arr === 'money') { if (el.value !== '') reloc.arrange(id, { money: Number(el.value) }); }
        else if (el.value) reloc.arrange(id, { [arr]: el.value });
        return changed();
      }
      if (el.dataset.bizf) { ui[el.dataset.bizf] = el.value || null; return render(modal.el.scrollTop); }
      const sf = el.dataset.sf;
      if (sf) { ui[sf] = el.value === '' ? null : (['from', 'to'].includes(sf) ? Number(el.value) : el.value); ui.marker = null; return render(modal.el.scrollTop); }
      return undefined;
    };
    root.ontoggle = undefined;
    for (const d of root.querySelectorAll('details[data-toggle]')) d.addEventListener('toggle', () => { ui[d.dataset.toggle] = d.open; });
    for (const d of root.querySelectorAll('details[data-tl]')) d.addEventListener('toggle', () => { if (d.open) ui.open = Number(d.dataset.tl); else if (ui.open === Number(d.dataset.tl)) ui.open = null; });
  }

  render(top().scroll ?? 0);
  return modal;
}

/** The family archive's way in: Our Global Story. */
export const openGlobalStory = (api) => openExplore(api, { view: 'story' });
export { theCountry, jurisdictionAt };
