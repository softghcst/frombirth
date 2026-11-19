// My Neighborhood: the people and places around the player (engine/neighborhood.js, engine/neighborhoodLife.js).
//
// One hub with seven sections, and pages that open on top of it: a household, a home (its chronicle), and a
// neighborhood (its chronicle). Each page opened is a step (ui/animalNav.js): going back returns to the step before as it
// was left, with its section and scroll position. People open in the ordinary Character Profile. Someone the player has
// not met is shown only as anyone on the street would see them: the household's name, who lives there, roughly.
import { store, player } from '../state.js';
import { esc, fmtMoney, cap } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { PROFILES, VENUES } from '../data/neighborhoods.js';
import * as N from '../engine/neighborhood.js';
import * as L from '../engine/neighborhoodLife.js';
import * as Talk from '../engine/neighborhoodTalk.js';
import { avatarSvg } from './avatar.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { createNav } from './animalNav.js';
import { roleLabel } from '../engine/relationships.js';
import { archiveIdOf } from '../engine/chronicle.js';

const nav = createNav();
let api = null;
let modal = null;
let onLeave = null;
const hooks = { openPerson: null };
export const connect = (h) => Object.assign(hooks, h);

export const SECTIONS = [['overview', 'Overview'], ['home', 'My home'], ['neighbors', 'Neighbors'], ['community', 'Community'], ['places', 'Local places'], ['activities', 'Things to do'], ['history', 'History']];

const S = () => store.state;
const C = () => COUNTRIES[player().countryId];
const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`;
const label = (t) => `<div class="section-label">${esc(t)}</div>`;
const empty = (t) => `<p class="empty">${esc(t)}</p>`;
const row = (attrs, glyph, title, sub, side = '') => `<button class="row" ${attrs}><div class="avatar glyph">${glyph}</div><div class="main"><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${side ? `<div class="side">${esc(side)}</div>` : ''}</button>`;
const face = (n) => `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters.relationship })}</div>`;
const personRow = (n, sub, side = '') => `<button class="row" data-person="${n.id}">${face(n)}<div class="main"><strong>${esc(`${n.firstName} ${n.lastName}`)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${side ? `<div class="side">${esc(side)}</div>` : ''}</button>`;
const btn = (attrs, text, o = {}) => `<button class="btn${o.danger ? ' danger' : ''}" ${attrs} ${o.disabled ? 'disabled' : ''}>${esc(text)}</button>`;
const year = (t) => N.yearOf(t);
const known = (id) => !!S().npcs[id]?.alive && player().npcIds.includes(id);
/** Roughly how old someone looks, for a neighbor the player has not met. */
const looks = (r) => {
  const a = N.ageOf(r, S());
  const who = r.g === 'male' ? (a < 13 ? 'a boy' : a < 18 ? 'a teenage boy' : 'a man') : r.g === 'female' ? (a < 13 ? 'a girl' : a < 18 ? 'a teenage girl' : 'a woman') : (a < 18 ? 'a child' : 'an adult');
  if (a < 2) return 'a baby';
  if (a < 18) return `${who} of about ${Math.max(2, Math.round(a))}`;
  return `${who} in their ${a >= 80 ? 'eighties or older' : `${Math.floor(a / 10) * 10}s`}`;
};
const relWord = (n) => (n.role === 'friend' ? 'Friend' : n.role === 'neighbor' ? (n.meters.relationship >= 45 ? 'Friendly neighbor' : 'Acquaintance') : roleLabel(n));

// ---------- The hub ----------

function hub(step) {
  const p = player();
  N.settle(S());
  const home = N.currentHome(S());
  const tab = step.ui.tab ?? 'overview';
  if (!home) {
    return { title: 'My Neighborhood', sub: 'The people and places around you.', tabs: null, body: `<div class="card">${empty(p.legal?.incarceration ? 'You are inside. The neighborhood will be there when you get out.' : 'Where you live now, there are no neighbors in the ordinary sense.')}</div>${historyTab()}` };
  }
  const H = N.hoods(S());
  const hood = H.list[home.h];
  const body = { overview, home: homeTab, neighbors, community, places, activities, history: historyTab }[tab]?.(home, hood, step) ?? '';
  return { title: 'My Neighborhood', sub: `${hood.name}, ${hood.city} · the people and places around you`, tabs: SECTIONS, tab, body };
}

function overview(home, hood) {
  const H = N.hoods(S());
  const block = H.blocks[home.b];
  const pr = PROFILES[hood.p];
  const near = N.around(S(), home.id).filter((x) => x.prox.near >= 3);
  const people = N.knownIn(S(), hood.id).sort((a, b) => b.meters.relationship - a.meters.relationship).slice(0, 4);
  const recent = N.chronicle(S(), hood.id).filter((x) => x.k !== 'player_in').slice(-4).reverse();
  const coming = (H.plans[hood.id]?.ev ?? []).filter((e) => e.k === 'event' && e.m >= (S().month ?? 0)).length;
  const st = L.standing(S(), hood.id);
  const g = hood.g;
  const measure = (v) => (v >= 70 ? 'good' : v >= 45 ? 'fair' : 'limited');
  return `<div class="card">
      ${kv('Neighborhood', esc(hood.name))}
      ${kv('City', esc(`${hood.city}, ${COUNTRIES[hood.c].name}`))}
      ${kv('Kind of place', esc(pr.name))}
      ${kv('Your home', esc(`${N.homeTypeName(home.t, hood.c)}, ${home.label}, ${block.name}`))}
      ${kv('Living there since', String(year(H.cur.since)))}
      ${kv('Households close by', String(near.filter((x) => x.hh).length))}
      <p class="muted" style="margin-top:8px">Neighborhood names in the game are made up.</p>
    </div>
    <div class="card"><h3>What it is like</h3>
      ${kv('What homes cost', hood.cost >= 1.25 ? 'Dear' : hood.cost >= 0.95 ? 'About average for the city' : 'Cheaper than most')}
      ${kv('Parks and open space', measure(g.parks))}
      ${kv('Getting about', S().year < 1890 ? 'On foot, mostly' : measure(g.transit))}
      ${kv('Shops and services', measure(g.amenities))}
      ${kv('Neighbors doing things together', measure(g.cohesion))}
      ${kv('Upkeep', measure(g.upkeep))}
      ${(() => { const c = hood.costs ?? []; const five = c.find(([y]) => y === S().year - 5) ?? c[0]; if (!five || five[0] >= S().year - 1) return ''; const d = hood.cost / five[1]; return kv(`Prices since ${five[0]}`, d >= 1.1 ? 'Up a lot' : d >= 1.03 ? 'Up a little' : d <= 0.9 ? 'Down a lot' : d <= 0.97 ? 'Down a little' : 'About the same'); })()}
      <p class="muted" style="margin-top:8px">These describe the place, not the people in it.</p></div>
    <div class="card"><h3>People you know here</h3>${people.length ? people.map((n) => personRow(n, relWord(n), `${Math.round(n.meters.relationship)}%`)).join('') : empty('Nobody yet. Try saying hello.')}</div>
    <div class="card"><h3>Lately</h3>${recent.length ? recent.map((x) => `<p class="body">${year(x.t)}: ${esc(x.text)}</p>`).join('') : empty('Nothing much has happened yet.')}
      ${coming ? `<p class="muted">Something is planned in the neighborhood later this year.</p>` : ''}</div>
    <div class="card"><h3>How you are known</h3>${kv('Familiarity', esc(st.familiarity))}${kv('Helping out', esc(st.reliability))}${kv('Joining in', esc(st.involvement))}${kv('Disagreements', esc(st.trouble))}
      ${kv('Think well of you', `${st.thinkWell} ${st.thinkWell === 1 ? 'person' : 'people'}`)}${st.thinkBadly ? kv('Think less of you', String(st.thinkBadly)) : ''}
      <p class="muted" style="margin-top:6px">Each person goes by what they have seen or been told. See Community for what is going round.</p></div>`;
}

/** The street or the building, drawn from where the homes really are. */
function plan(home) {
  const H = N.hoods(S());
  const block = H.blocks[home.b];
  const cell = (h) => {
    const hh = h.hh ? H.hhs[h.hh] : null;
    const mine = h.id === home.id;
    const name = mine ? 'You' : hh ? hh.n : 'Empty';
    return `<button class="hood-cell${mine ? ' mine' : ''}${hh ? '' : ' empty'}" ${hh && !mine ? `data-hh="${hh.id}"` : mine ? 'data-set="tab:home"' : `data-home="${h.id}"`} title="${esc(h.label)}"><small>${esc(h.label.replace('Apartment ', ''))}</small><span>${esc(name)}</span></button>`;
  };
  const homes = block.homes.map((id) => H.homes[id]);
  if (block.kind === 'building') {
    const floors = [...new Set(homes.map((h) => h.fl))].sort((a, b) => b - a);
    return `<div class="hood-plan building" aria-label="${esc(block.name)}">${floors.map((f) => `<div class="hood-floor"><em>${f === 1 ? 'Ground' : `Floor ${f}`}</em>${homes.filter((h) => h.fl === f).map(cell).join('')}</div>`).join('')}</div>`;
  }
  return `<div class="hood-plan street" aria-label="${esc(block.name)}">${homes.map(cell).join('')}<div class="hood-road">${esc(block.name)}</div></div>`;
}

function homeTab(home, hood) {
  const H = N.hoods(S());
  const block = H.blocks[home.b];
  const hh = H.hhs[H.cur.hh];
  const rm = L.roommate(S());
  const rmOpt = L.roommateOptions(S());
  const moving = L.homesToRent(S());
  const mgr = block.mgr ? H.res[block.mgr] : null;
  const asset = home.asset ? player().assets.find((a) => a.id === home.asset) : null;
  const owner = home.own === 'player' ? 'You' : home.own === 'family' ? 'Your family' : block.ll ?? 'A landlord';
  return `<div class="card"><h3>${esc(home.label)}</h3>
      ${kv('Home', esc(N.homeTypeName(home.t, hood.c)))}
      ${kv(block.kind === 'building' ? 'Building' : 'Street', esc(block.name))}
      ${kv('Owned by', esc(owner))}
      ${asset ? kv('Worth', esc(fmtMoney(asset.value, C()))) : ''}
      ${kv('Who lives here', esc(N.living(S(), hh).map((ref) => N.personOf(S(), ref)?.name).filter(Boolean).join(', ') || 'You'))}
      ${kv('Getting in', N.stepFree(S(), home) ? 'Level, no steps' : block.kind === 'building' && home.fl > 1 ? (block.lift ? 'By lift' : 'Stairs only: no lift') : 'Steps at the door')}
      ${N.needsStepFree(S()) && !N.stepFree(S(), home) ? `<p class="muted">The steps are a barrier for you here. Adaptations can be made through My Health${N.groundFloorOption(S()) ? ', or the landlord can move you to an empty ground-floor home' : ''}.</p>${N.groundFloorOption(S()) ? btn('data-groundfloor', 'Ask for the ground-floor home') : ''}` : ''}
      ${btn(`data-home="${home.id}"`, 'The history of this home')}</div>
    ${block.kind === 'building' ? `<div class="card"><h3>My building</h3>
      ${kv('Floors', String(block.fl))}${kv('Lift', block.lift ? 'Yes' : 'No')}${block.renovated ? kv('Done up', String(block.renovated)) : ''}
      ${kv('Run by', esc(block.condo ? 'The owners, together' : block.ll ?? 'A landlord'))}
      ${mgr ? kv('Building manager', esc(known(mgr.id) ? `${mgr.f} ${mgr.l}` : `Someone from the ${mgr.l} household`)) : ''}
      ${kv('Shared spaces', esc(cap((block.areas ?? []).join(' and ')) || 'The stairs'))}</div>` : ''}
    <div class="card"><h3>${block.kind === 'building' ? 'The building' : 'The street'}</h3>${plan(home)}<p class="muted" style="margin-top:6px">Tap a home to see who lives there.</p></div>
    ${N.dwelling(S())?.kind === 'rent' && player().age >= 18 ? `<div class="card"><h3>Living arrangements</h3>
      ${rm ? `${personRow(rm, 'Roommate: you split the rent')}${btn('data-endroommate', 'End the arrangement')}`
    : rmOpt.ok ? `<p class="muted">Share the rent with someone: a friend, or someone who answers a notice.</p>${btn('data-roommate', 'Find a roommate')}` : `<p class="muted">${esc(rmOpt.why)}</p>`}
      ${moving.length ? `<div style="margin-top:10px">${btn('data-moveto', 'Rent somewhere else in the city')}</div>` : ''}</div>` : ''}`;
}

function householdRows(home) {
  const H = N.hoods(S());
  const list = N.around(S(), home.id).filter((x) => x.hh && x.prox.near >= 2);
  return list.map((x) => {
    const people = x.hh.m.map((id) => H.res[id] ?? S().npcs[id]).filter(Boolean);
    const met = people.filter((r) => known(r.id)).map((r) => r.f ?? r.firstName);
    return row(`data-hh="${x.hh.id}"`, x.hh.me || x.hh.fam ? '🏡' : '🏠', `The ${x.hh.n} household`, `${cap(x.prox.word)} · ${x.home.label} · ${N.composition(S(), x.hh)}${met.length ? ` · you know ${met.join(' and ')}` : ''}`);
  }).join('');
}

function neighbors(home, hood, step) {
  const show = step.ui.show ?? 'near';
  const seg = `<div class="chips zoo-filter" role="group">${[['near', 'Close by'], ['known', 'People you know'], ['all', 'Whole neighborhood']].map(([v, t]) => `<button class="chip ${v === show ? 'on' : ''}" aria-pressed="${v === show}" data-set="show:${v}">${t}</button>`).join('')}</div>`;
  if (show === 'known') {
    const people = N.knownIn(S(), hood.id).sort((a, b) => b.meters.relationship - a.meters.relationship);
    const former = N.knownIn(S(), hood.id, { current: false }).filter((n) => !people.includes(n) && n.flags.movedAway);
    return `${seg}<div class="card">${people.length ? people.map((n) => personRow(n, `${relWord(n)} · ${N.proximity(S(), home.id, N.hoods(S()).hhs[N.hoods(S()).res[n.id]?.hh]?.home).word}`, `${Math.round(n.meters.relationship)}%`)).join('') : empty('You have not met anyone here yet.')}</div>
      ${former.length ? `<div class="card"><h3>Former neighbors</h3>${former.map((n) => personRow(n, `Moved to ${n.flags.movedAway.to === 'abroad' ? 'another country' : n.flags.movedAway.to}`)).join('')}</div>` : ''}`;
  }
  if (show === 'all') {
    const H = N.hoods(S());
    const all = Object.values(H.hhs).filter((hh) => hh.home && H.homes[hh.home].h === hood.id && N.living(S(), hh).length);
    return `${seg}<div class="card">${all.map((hh) => row(`data-hh="${hh.id}"`, hh.me || hh.fam ? '🏡' : '🏠', `The ${hh.n} household`, `${H.homes[hh.home].label}, ${H.blocks[H.homes[hh.home].b].name} · ${N.composition(S(), hh)}`)).join('') || empty('Nobody.')}</div>`;
  }
  return `${seg}<div class="card">${householdRows(home) || empty('No neighbors close by.')}</div>`;
}

function community(home, hood) {
  const H = N.hoods(S());
  const events = N.chronicle(S(), hood.id).filter((x) => ['event', 'tradition', 'attended', 'hosted'].includes(x.k)).slice(-10).reverse();
  const o = L.hostOptions(S());
  const groups = H.groups.filter((g) => g.h === hood.id && g.to == null);
  const disputes = H.disputes.filter((d) => d.h === hood.id && d.status === 'open');
  return `<div class="card"><h3>Community events</h3>${events.length ? events.map((x) => `<p class="body">${year(x.t)}${x.t % 12 ? `, ${N.MONTHS[x.t % 12]}` : ''}: ${esc(x.text)}</p>`).join('') : empty('Nothing yet. Neighbors organize things now and then; you will hear when they do.')}</div>
    ${(() => { const k = Talk.knownAbout(S(), hood.id); return `<div class="card"><h3>What people here know about you</h3>${k.length ? k.slice(0, 8).map((x) => `<p class="body">${esc(cap(`you ${x.text}`))}. <small class="muted">${x.truth ? '' : 'Not true: a rumor. '}${x.saw ? `${x.saw} saw it` : ''}${x.saw && x.heard ? ', ' : ''}${x.heard ? `${x.heard} heard it` : ''}.</small></p>`).join('') : empty('Nothing yet: people know what they see.')}<p class="muted">Only what people could have seen or been told. Nobody here knows your health or your private life.</p></div>`; })()}
    <div class="card"><h3>Host something</h3>${o.kinds.length ? `<p class="muted">Pick what, who and how much. Guests may say no.</p>${btn('data-host', o.done ? 'Hosted already this time' : 'Plan a gathering', { disabled: o.done || !o.guests.length })}${o.guests.length ? '' : '<p class="muted">Get to know some neighbors first.</p>'}` : empty('Not yet: you are too young to host.')}</div>
    ${groups.length ? `<div class="card"><h3>Friend groups</h3>${groups.map((g) => `<p class="body"><strong>${esc(cap(g.name))}</strong>: ${esc(g.m.map((ref) => (N.isPlayerRef(ref) ? 'you' : S().npcs[ref]?.firstName)).filter(Boolean).join(', '))}, since ${year(g.since)}.</p>`).join('')}</div>` : ''}
    ${disputes.length ? `<div class="card"><h3>Not settled yet</h3>${disputes.map((d) => `<p class="body">With ${esc(`${H.res[d.res]?.f ?? ''} ${H.res[d.res]?.l ?? ''}`)}: ${esc(d.kind)} (${year(d.t)}). Old disagreements fade.</p>`).join('')}</div>` : ''}`;
}

function places() {
  const list = L.places(S());
  if (!list.length) return `<div class="card">${empty('Nothing within walking distance.')}</div>`;
  return `<div class="card">${list.map((v) => `<div class="hood-venue">
      ${row(`data-visit="${v.id}"`, { cafe: '☕', restaurant: '🍽️', bakery: '🥖', grocery: '🧺', corner: '🏪', bookshop: '📚', barber: '💈', market: '🧺', hardware: '🔧', pharmacy: '💊', laundromat: '🧺', gym: '🏋️', cinema: '🎬', bar: '🍺', library: '📖', playground: '🛝', park: '🌳', community: '🏛️', church: '🏛️', school: '🏫', video: '📼', netcafe: '🖥️' }[v.k] ?? '📍',
    v.name, `${v.mine ? 'Your business' : v.kind}${!v.mine && v.owner?.name ? ` · run by ${v.owner.name}` : ''}${v.regular >= 4 ? ' · you are a regular' : ''} · ${v.sf ? 'step-free' : 'steps at the door'}`, v.visited ? 'Been' : v.canVisit ? 'Visit' : '')}
      ${v.canWork ? btn(`data-work="${v.id}"`, 'Ask about work') : ''}</div>`).join('')}</div>`;
}

function activities() {
  const list = L.activities(S());
  return `<div class="card"><h3>Around the neighborhood</h3><p class="muted">Once each, every turn.</p>${list.map((a) => row(`data-act="${a.id}" ${a.ok && !a.done ? '' : 'aria-disabled="true"'}`, a.done ? '✓' : '•', a.label, a.ok ? a.sub : a.why, a.done ? 'Done' : '')).join('')}</div>`;
}

function historyTab() {
  const list = N.placesWeCalledHome(S());
  const me = archiveIdOf(player());
  const revisit = L.placesToRevisit(S());
  const byPerson = new Map();
  for (const x of list) { if (!byPerson.has(x.who)) byPerson.set(x.who, []); byPerson.get(x.who).push(x); }
  const H = N.hoods(S());
  return `${revisit.length ? `<div class="card"><h3>Go back</h3>${revisit.map((x) => row(`data-revisit="${x.hood}"`, '🚶', x.name, x.mine ? (x.childhood ? 'The street you grew up on' : `Where you lived, ${x.from}–${x.to}`) : `Where ${x.who} lived, ${x.from}–${x.to}`)).join('')}</div>` : ''}
    <div class="card"><h3>Places we've called home</h3>${list.length ? [...byPerson.entries()].map(([who, xs]) => `${label(who === me ? 'You' : xs[0].name ?? 'Family')}${xs.map((x) => row(`data-hood="${x.hood}"`, x.current ? '🏡' : '🏠', `${x.hoodName}, ${x.city}`, `${x.years} · ${x.type ?? 'Home'}, ${x.label ?? ''}${x.with?.length ? ` · with ${x.with.slice(0, 3).join(', ')}` : ''}${x.knew?.length ? ` · knew ${x.knew.slice(0, 3).map((k) => k.name).join(', ')}` : ''}`)).join('')}`).join('') : empty('No homes on record yet.')}</div>
    <div class="card"><h3>Neighborhoods</h3>${Object.values(H.list).filter((h) => H.past.some((x) => x.hood === h.id)).map((h) => row(`data-hood="${h.id}"`, '🗺️', h.name, `${h.city} · ${PROFILES[h.p].name}`)).join('') || empty('None yet.')}</div>`;
}

// ---------- Pages ----------

function household(step) {
  const H = N.hoods(S());
  const hh = H.hhs[step.params.hhId];
  if (!hh) return { title: 'Household', body: empty('Nobody lives there now.') };
  const home = hh.home ? H.homes[hh.home] : null;
  const here = N.currentHome(S());
  const prox = home && here ? N.proximity(S(), here.id, home.id).word : '';
  const people = hh.m.map((ref) => ({ ref, r: H.res[ref], n: S().npcs[ref] })).filter((x) => x.r || x.n);
  const rows = people.map(({ ref, r, n }) => {
    if (N.isPlayerRef(ref)) return '';
    if (known(ref)) {
      const acts = r ? L.neighborActions(S(), ref) : [];
      return `<div class="hood-person">${personRow(n, `${relWord(n)} · ${n.age}${n.occupation ? ` · ${n.occupation}` : n.flags.retired ? ' · retired' : ''}`, `${Math.round(n.meters.relationship)}%`)}
        <div class="btn-pair">${acts.map((a) => btn(`data-nact="${ref}:${a.id}"`, a.label, { disabled: a.done })).join('')}</div></div>`;
    }
    if (!r || r.dead) return '';
    const acts = L.neighborActions(S(), ref);
    const heard = Talk.impression(S(), ref).known;
    return `<div class="hood-person">${row('aria-disabled="true"', '👤', r.seen >= 2 ? `${r.f} ${r.l}` : cap(looks(r)), `${r.seen >= 2 ? `You know each other by sight · ${looks(r)}` : 'You have not met'}${heard.length ? ` · has heard you ${Talk.factText(heard[heard.length - 1])}` : ''}`)}
      <div class="btn-pair">${acts.map((a) => btn(`data-nact="${ref}:${a.id}"`, a.label, { disabled: a.done })).join('')}</div></div>`;
  }).join('');
  return { title: `The ${hh.n} household`, sub: [home?.label, prox, home ? N.homeTypeName(home.t, H.list[home.h].c) : null].filter(Boolean).join(' · '), body: `
    <div class="card">${kv('Who lives here', esc(N.composition(S(), hh)))}${kv('Here since', String(year(hh.from)))}${hh.pet ? kv('Animals', esc(`${hh.pet.n}, a ${hh.pet.s}`)) : ''}
      ${home ? btn(`data-home="${home.id}"`, 'The history of this home') : ''}</div>
    <div class="card">${rows || empty('Nobody you can see.')}</div>` };
}

function homePage(step) {
  const h = N.homeHistory(S(), step.params.homeId);
  if (!h) return { title: 'A home', body: empty('No record.') };
  return { title: `${h.home.label}, ${h.block.name}`, sub: `${h.hood.name}, ${h.hood.city} · ${N.homeTypeName(h.home.t, h.hood.c)}`, body: `
    <div class="card">${kv('Owned by', esc(h.owner))}${kv('Lived in now by', esc(h.home.hh ? `The ${N.hoods(S()).hhs[h.home.hh].n} household` : 'Nobody'))}</div>
    <div class="card"><h3>Who has lived here</h3>${h.households.length ? h.households.slice().reverse().map((o) => `<p class="body"><strong>${esc(o.mine ? `Your family (${o.n})` : `The ${o.n} household`)}</strong>, ${year(o.from)}–${o.to == null ? 'now' : year(o.to)}${o.left ? ` (${esc(o.left)})` : ''}${o.people.length ? `<br><small class="muted">${esc(o.mine || o.people.length <= 4 ? o.people.join(', ') : `${o.people.length} people`)}</small>` : ''}</p>`).join('') : empty('The records begin with you.')}
      <p class="muted">The record starts from when the game first knew this home; nobody is invented for the years before.</p></div>
    ${h.events.length ? `<div class="card"><h3>What happened here</h3>${h.events.slice().reverse().map((x) => `<p class="body">${year(x.t)}: ${esc(x.text)}</p>`).join('')}</div>` : ''}` };
}

function hoodPage(step) {
  const H = N.hoods(S());
  const hood = H.list[step.params.hoodId];
  if (!hood) return { title: 'Neighborhood', body: empty('No record.') };
  const log = N.chronicle(S(), hood.id);
  const family = N.placesWeCalledHome(S()).filter((x) => x.hood === hood.id);
  const people = N.knownIn(S(), hood.id, { current: false });
  const homes = [...new Set(family.map((x) => x.home))];
  return { title: hood.name, sub: `Neighborhood Chronicle · every street has a story · ${hood.city}`, body: `
    <div class="card">${kv('City', esc(`${hood.city}, ${COUNTRIES[hood.c].name}`))}${kv('Kind of place', esc(PROFILES[hood.p].name))}${kv('Goes back to', `about ${hood.est}`)}${kv('People living there now', String(N.residentsOf(S(), hood.id).length))}</div>
    ${family.length ? `<div class="card"><h3>Your family here</h3>${family.map((x) => `<p class="body">${esc(x.name ?? '')}: ${esc(x.label ?? '')}, ${x.years}</p>`).join('')}${homes.map((id) => btn(`data-home="${id}"`, `The history of ${H.homes[id]?.label ?? 'the home'}`)).join('')}</div>` : ''}
    ${people.length ? `<div class="card"><h3>People you know from here</h3>${people.map((n) => personRow(n, `${relWord(n)}${n.flags.movedAway ? ` · moved to ${n.flags.movedAway.to === 'abroad' ? 'another country' : n.flags.movedAway.to}` : ''}`)).join('')}</div>` : ''}
    <div class="card"><h3>Chronicle</h3>${log.length ? log.slice().reverse().slice(0, 60).map((x) => `<p class="body">${year(x.t)}: ${esc(x.text)}</p>`).join('') : empty('Nothing recorded yet.')}</div>` };
}

const SCREENS = { hub, household, home: homePage, hood: hoodPage };
const BACK = { hub: 'Back to My Neighborhood', household: 'Back to the household', home: 'Back to the home', hood: 'Back to the neighborhood' };
const backText = (step) => (step ? BACK[step.screen] ?? 'Back' : 'Close');

// ---------- Showing and acting ----------

const bodyEl = () => modal?.el.querySelector('[data-body]');
const note = (extra = {}) => nav.remember({ scroll: bodyEl()?.scrollTop ?? 0, ...extra });
function shut() { modal?.close(); modal = null; }
function closeAll() { shut(); nav.clear(); const f = onLeave; onLeave = null; f?.(); }

function show() {
  shut();
  const step = nav.top();
  if (!step) return;
  const s = SCREENS[step.screen](step);
  modal = openModal(`
    <div class="dyn-head"><div><h2>${esc(s.title)}</h2>${s.sub ? `<p class="muted zoo-sub">${esc(s.sub)}</p>` : ''}</div>
      <button class="icon-btn" data-x aria-label="Close">✕</button></div>
    ${s.tabs ? `<div class="zoo-tabs" role="tablist">${s.tabs.map(([id, t]) => `<button role="tab" aria-selected="${id === s.tab}" class="${id === s.tab ? 'on' : ''}" data-set="tab:${id}">${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="dyn-body" data-body>${s.body}</div>
    <div class="btn-stack zoo-foot"><button class="btn" data-back>${esc(backText(nav.under()))}</button></div>`, { dismissable: true, onDismiss: () => { modal = null; nav.clear(); } });
  modal.el.classList.add('dyn-modal', 'zoo-modal', 'hood-modal');
  modal.el.dataset.screen = step.screen;
  modal.el.addEventListener('click', onClick);
  const b = bodyEl();
  if (b) b.scrollTop = step.ui.scroll ?? 0;
}

async function report(r) {
  api?.changed?.();
  shut();
  await messageModal({ body: r.text, tone: r.tone });
  show();
}

async function planGathering() {
  const o = L.hostOptions(S());
  shut();
  const kind = await pickModal({ title: 'What kind of gathering?', options: o.kinds.map((k) => ({ value: k.id, label: k.name, sub: `About ${fmtMoney(k.cost, C())}, up to ${k.max} guests` })) });
  if (!kind) return show();
  const max = o.kinds.find((k) => k.id === kind).max;
  const guests = [];
  for (;;) {
    const left = o.guests.filter((g) => !guests.includes(g.id));
    if (!left.length || guests.length >= max) break;
    const pick = await pickModal({ title: guests.length ? `Anyone else? (${guests.length} invited)` : 'Who do you invite?', options: [...(guests.length ? [{ value: '__done', label: 'That is everyone' }] : []), ...left.map((g) => ({ value: g.id, label: g.name, sub: `${g.near ? 'Neighbor' : 'Friend'} · ${g.rel}%` }))] });
    if (!pick) return show();
    if (pick === '__done') break;
    guests.push(pick);
  }
  if (!guests.length) return show();
  const budget = await pickModal({ title: 'How much do you spend?', options: [{ value: 'modest', label: 'Keep it simple', sub: fmtMoney(o.kinds.find((k) => k.id === kind).cost, C()) }, { value: 'generous', label: 'Push the boat out', sub: fmtMoney(Math.round(o.kinds.find((k) => k.id === kind).cost * 1.8), C()) }] });
  if (!budget) return show();
  return report(L.host(kind, guests, budget));
}

async function onClick(e) {
  const hit = (attr) => e.target.closest(`[${attr}]`);
  let el;
  if (hit('data-x')) return closeAll();
  if (hit('data-back')) { nav.back(); return nav.top() ? show() : closeAll(); }
  if ((el = hit('data-set'))) { e.preventDefault(); const [k, v] = el.dataset.set.split(':'); note({ [k]: v, ...(k === 'tab' ? { scroll: 0 } : {}) }); return show(); }
  if ((el = hit('data-person'))) {
    e.preventDefault();
    const npc = S().npcs[el.dataset.person];
    if (!npc || !hooks.openPerson) return undefined;
    note(); shut();
    return hooks.openPerson(npc, api, () => show(), { readOnly: !player().npcIds.includes(npc.id) });
  }
  const open = (screen, params) => { e.preventDefault(); note(); nav.open(screen, params); return show(); };
  if ((el = hit('data-hh'))) return open('household', { hhId: el.dataset.hh });
  if ((el = hit('data-home'))) return open('home', { homeId: el.dataset.home });
  if ((el = hit('data-hood'))) return open('hood', { hoodId: el.dataset.hood });
  note();
  if ((el = hit('data-nact'))) { const [id, a] = el.dataset.nact.split(':'); return report(L.neighborAct(id, a)); }
  if ((el = hit('data-act'))) return report(L.doActivity(el.dataset.act));
  if ((el = hit('data-visit'))) return report(L.visitPlace(el.dataset.visit));
  if ((el = hit('data-work'))) return report(L.askForWork(el.dataset.work));
  if ((el = hit('data-revisit'))) return report(L.revisit(el.dataset.revisit));
  if (hit('data-groundfloor')) return report(L.moveToGroundFloor());
  if (hit('data-host')) return planGathering();
  if (hit('data-endroommate')) { shut(); if (!await confirmModal({ title: 'End the arrangement?', body: 'They move out, and you pay the whole rent again.', yes: 'End it' })) return show(); return report(L.endRoommate()); }
  if (hit('data-roommate')) {
    shut();
    const o = L.roommateOptions(S());
    const pick = await pickModal({ title: 'Find a roommate', body: 'They share the rent and the kitchen.', options: [...o.people.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `Friend · ${Math.round(n.meters.relationship)}%` })), { value: '__new', label: 'Put up a notice', sub: 'Someone you have not met' }] });
    if (!pick) return show();
    return report(L.takeRoommate(pick === '__new' ? null : pick));
  }
  if (hit('data-moveto')) {
    shut();
    const list = L.homesToRent(S());
    const pick = await pickModal({ title: 'Rent somewhere else in the city', body: 'Moving costs a little; your friends stay your friends.', options: list.map((x, i) => ({ value: String(i), label: x.name ?? `Somewhere ${x.profile.toLowerCase()}`, sub: `${x.profile}${x.known ? ' · a neighborhood you know' : ''} · ${x.cost >= 1.25 ? 'dear' : x.cost >= 0.95 ? 'average rents' : 'cheaper'}` })) });
    if (pick == null) return show();
    return report(L.moveTo(list[Number(pick)]));
  }
  return undefined;
}

/** Opens My Neighborhood at a section. `back` is called when it is closed. */
export function openNeighborhood(tabApi, tab = 'overview', back = null) {
  api = tabApi;
  onLeave = back;
  nav.clear();
  nav.open('hub', {}, { tab });
  show();
}
/** Opens the chronicle of one neighborhood (from Places I've Lived, or the Family Archive). */
export function openHoodChronicle(tabApi, hoodId, back = null) {
  api = tabApi;
  onLeave = back;
  nav.clear();
  nav.open('hood', { hoodId });
  show();
}

/** A row for the Pursuits tab. */
export function neighborhoodSub() {
  const home = N.currentHome(S());
  if (!home) return 'Where you live';
  const hood = N.hoods(S()).list[home.h];
  const known = N.knownIn(S(), hood.id).length;
  return `${hood.name}, ${hood.city}${known ? ` · you know ${known} ${known === 1 ? 'neighbor' : 'neighbors'}` : ''}`;
}
export const internals = { nav, SCREENS, show: () => show() };
