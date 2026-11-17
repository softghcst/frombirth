// My Athletics: the player's sports, and every athletic record the family keeps.
//
// One hub with ten sections, and profiles that open on top of it: a sport, a team, a coach, a season, an event, and
// an athlete of an earlier generation. Each screen opened is a step (ui/animalNav.js); going back returns the step
// before exactly as it was left, with its section, filters and scroll position.
import { store, player } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { sportOf, PLANS, LOADS, LEVEL_NAMES, INJURIES } from '../data/sports.js';
import * as sp from '../engine/sports.js';
import * as life from '../engine/sportsLife.js';
import { fmtMark } from '../engine/sportsPlay.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { createNav } from './animalNav.js';
import { connect as connectAnimals } from './animals.js';

const nav = createNav();
let api = null;
let modal = null;
let onLeave = null;
const hooks = { openPerson: null };
export const connect = (h) => Object.assign(hooks, h);

export const SECTIONS = [['overview', 'Overview'], ['sports', 'Sports'], ['training', 'Training'], ['teams', 'Teams & clubs'], ['competitions', 'Competitions'],
  ['rankings', 'Rankings'], ['career', 'Career & offers'], ['health', 'Health & mind'], ['money', 'Money & fame'], ['legacy', 'Legacy']];

const S = () => sp.ensure(store.state);
const C = () => COUNTRIES[player().countryId];
const money = (v) => fmtMoney(v, C());
const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`;
const label = (t) => `<div class="section-label">${esc(t)}</div>`;
const empty = (t) => `<p class="empty">${esc(t)}</p>`;
const row = (attrs, glyph, title, sub, side = '') => `<button class="row" ${attrs}><div class="avatar glyph">${glyph}</div><div class="main"><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${side ? `<div class="side">${esc(side)}</div>` : ''}</button>`;
const GLYPH = { team: '⚽', racket: '🎾', golf: '⛳', race: '🏃', judged: '🤸', combat: '🥋', fitness: '💪' };
const glyph = (sportId) => (sportId === 'pickleball' ? '🏓' : sportId === 'basketball' || sportId === 'wheelchair_basketball' ? '🏀' : sportId === 'baseball' || sportId === 'softball' ? '⚾'
  : sportId === 'american_football' ? '🏈' : sportId === 'ice_hockey' ? '🏒' : sportId === 'cricket' ? '🏏' : sportId === 'swimming' || sportId === 'para_swimming' ? '🏊' : sportId === 'volleyball' ? '🏐' : sportId === 'cycling' ? '🚴' : GLYPH[sportOf(sportId)?.kind] ?? '🏅');
const seg = (key, value, options) => `<div class="chips zoo-filter" role="group">${options.map(([v, t]) => `<button class="chip ${String(v) === String(value) ? 'on' : ''}" aria-pressed="${String(v) === String(value)}" data-set="${key}:${v}">${esc(t)}</button>`).join('')}</div>`;
const bar = (v) => `<div class="mini" style="width:100%"><i class="fill ${v >= 68 ? 'good' : v >= 40 ? 'ok' : 'low'}" style="width:${Math.max(2, Math.min(100, v))}%"></i></div>`;
const levelName = (l) => LEVEL_NAMES[l] ?? (l === 'elite' ? 'National squad' : l);
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

// ---------- The hub ----------

function hub(step) {
  const tab = step.ui.tab ?? 'overview';
  const a = sp.myAthlete();
  const body = !a || !Object.keys(a.sports).length ? (tab === 'legacy' ? legacySection(step) : tab === 'sports' ? sportsSection(step) : emptyHub())
    : ({ overview, sports: sportsSection, training, teams, competitions, rankings, career, health, money: moneySection, legacy: legacySection }[tab] ?? overview)(step);
  return { title: 'My Athletics', sub: 'Your sports. Your journey. Your legacy.', tabs: SECTIONS, tab, body };
}
function emptyHub() {
  return `<div class="card"><h3>Every athlete starts somewhere.</h3><p class="muted">A kickabout in the park, a racket borrowed from a cousin, a first swimming lesson. Pick a sport to begin.</p>
    <button class="btn primary" data-set="tab:sports" style="margin-top:10px">Choose a sport</button></div>`;
}

function overview() {
  const p = player();
  const a = sp.myAthlete();
  const active = sp.activeSports();
  const dec = life.openDecisions();
  const recent = sp.momentsOf().slice(-6).reverse();
  return `
    ${dec.length ? `<div class="card"><h3>Waiting for you</h3>${dec.map((d) => row(`data-decide="${d.id}"`, '❗', d.text.split('. ')[0] + '.', sportOf(d.sportId)?.name ?? '')).join('')}</div>` : ''}
    ${label('Playing now')}
    ${active.length ? active.map((e) => row(`data-sport="${e.id}"`, glyph(e.id), sportOf(e.id).name + (e.id === a.primary ? ' · main sport' : ''),
    `${levelName(e.level)}${e.orgId ? ` · ${sp.orgOf(e.orgId)?.name}` : ''} · ${sp.skillWord(sp.overall(e))}`, `PR ${e.pr}`)).join('') : empty(a.retired ? `Retired from playing in ${a.retired.year}.` : 'You are not playing anything right now.')}
    ${label('How you are')}
    ${kv('Confidence', a.confidence >= 70 ? 'High' : a.confidence >= 45 ? 'Steady' : 'Low')}
    ${kv('Motivation', a.motivation >= 70 ? 'Loving it' : a.motivation >= 45 ? 'Keen' : a.motivation >= 30 ? 'Flagging' : 'Struggling')}
    ${kv('Fame in sport', a.fame >= 60 ? 'A household name' : a.fame >= 30 ? 'Known in the game' : a.fame >= 10 ? 'Known locally' : 'Unknown')}
    ${kv('Weekly training', `${sp.trainingHours()} hours`)}
    ${a.arcs.length ? `${label('Your story')}${a.arcs.slice(-3).reverse().map((x) => `<p><strong>${esc(x.title)}</strong> <span class="muted">(${x.year})</span><br>${esc(x.text)}</p>`).join('')}` : ''}
    ${label('Recently')}
    ${recent.length ? recent.map(momentRow).join('') : empty('Nothing yet.')}
    ${p.age < 5 ? '<p class="muted">Most sports start from five.</p>' : ''}`;
}
const momentRow = (m) => `<div class="kv"><span>${m.year} · age ${m.age}</span><span>${esc(m.text)}</span></div>`;

function sportsSection() {
  const menu = sp.sportsMenu();
  const a = sp.myAthlete();
  const mine = a ? Object.values(a.sports) : [];
  return `
    ${mine.length ? `${label('Your sports')}${mine.map((e) => row(`data-sport="${e.id}"`, glyph(e.id), sportOf(e.id).name, `${e.status === 'active' ? levelName(e.level) : e.status === 'retired' ? `Retired ${e.retiredYear}` : 'Stopped'} · since ${e.since}`, `PR ${e.pr}`)).join('')}` : ''}
    ${label('Take up a sport')}
    <p class="muted">Up to three at a time. Sports appear in the year they began to be played.</p>
    ${menu.filter((x) => !x.playing).map((x) => `<button class="row" data-take="${x.sport.id}" ${x.ok ? '' : 'disabled'}><div class="avatar glyph">${glyph(x.sport.id)}</div>
      <div class="main"><strong>${esc(x.sport.name)}</strong><small>${esc(x.ok ? `${x.popular ? 'Popular here · ' : ''}${x.sport.kind === 'team' ? 'Team sport' : x.sport.kind === 'racket' ? 'Singles and doubles' : 'Individual'}${x.sport.adaptive ? ' · adaptive' : ''}` : x.text)}</small></div></button>`).join('')}`;
}

function training() {
  const active = sp.activeSports();
  if (!active.length) return empty('You are not playing anything right now.');
  const left = sp.EXTRA_PER_YEAR - (S().acts.year === store.state.year ? S().acts.extra : 0);
  return `<p class="muted">Training happens through the year. More hours help, but each extra hour adds less than the one before, and tired bodies get hurt. ${left} extra ${left === 1 ? 'session' : 'sessions'} left this year.</p>
    ${active.map((e) => {
    const sport = sportOf(e.id);
    const coach = sp.coachOf(e.coachId);
    return `<div class="card"><h3>${esc(sport.name)}</h3>
      ${kv('Plan', `${esc(PLANS[e.plan.type]?.name ?? 'Balanced')}, ${e.plan.hours} h a week`)}
      ${kv('Coach', coach ? `<a href="#" data-coach="${coach.id}">${esc(coach.name)}</a>` : 'None')}
      ${kv('Fatigue', e.fatigue >= 70 ? 'Worn out' : e.fatigue >= 45 ? 'Tired' : 'Fresh')}
      <div class="btn-stack" style="margin-top:8px"><button class="btn" data-plan="${e.id}">Change the plan</button><button class="btn" data-extra="${e.id}" ${left > 0 ? '' : 'disabled'}>Extra session</button></div>
    </div>`;
  }).join('')}`;
}

function teams(step) {
  const active = sp.activeSports();
  if (!active.length) return empty('You are not playing anything right now.');
  return active.map((e) => {
    const sport = sportOf(e.id);
    const org = sp.orgOf(e.orgId);
    const team = sp.teamOf(e.teamId);
    const pair = sp.currentPartnership(e.id);
    const clubs = e.contractId ? [] : sp.clubsFor(e.id);
    return `<div class="card"><h3>${esc(sport.name)}</h3>
      ${org ? row(`data-team="${team?.id ?? ''}"`, glyph(e.id), team?.name ?? org.name, `${levelName(org.level)} · coach ${sp.coachOf(org.coachId)?.name ?? 'none'}`) : empty('No club.')}
      ${sport.positions ? kv('Position', `<a href="#" data-position="${e.id}">${esc(sport.positions.find((x) => x[0] === e.position)?.[1] ?? 'None')}</a>`) : ''}
      ${sport.kind === 'racket' ? (pair ? `${kv('Doubles partner', `<a href="#" data-person="${pair.b}">${esc(pair.bName)}</a> · chemistry ${pair.chemistry}`)}<button class="btn" data-unpair="${e.id}">End the partnership</button>` : `<button class="btn" data-pair="${e.id}">Find a doubles partner</button>`) : ''}
      ${clubs.length ? `${label('Try out')}${clubs.map((c) => `<button class="row" data-tryout="${c.org.id}" ${c.open ? '' : 'disabled'}><div class="avatar glyph">📋</div><div class="main"><strong>${esc(c.org.name)}</strong><small>${esc(levelName(c.org.level))} · ${esc(c.open ? `You need to show about ${c.bar}. You show ${sp.overall(e)}.` : c.why)}</small></div></button>`).join('')}` : ''}
      ${org && org.kind !== 'rec' && org.kind !== 'school' && !e.contractId ? `<button class="btn" data-leave="${e.id}">Leave ${esc(org.name)}</button>` : ''}
      ${org?.kind === 'college' ? `<button class="btn" data-quitcollege="${e.id}">Leave the university team</button>` : ''}
    </div>`;
  }).join('') + (step.ui.dummy ? '' : '');
}

function competitions(step) {
  const a = sp.myAthlete();
  const sportF = step.ui.sport ?? 'all';
  const kind = step.ui.kind ?? 'all';
  const sports = Object.keys(a.sports);
  const seasons = Object.values(a.sports).flatMap((e) => e.seasons.map((id) => S().seasons[id])).filter(Boolean);
  const events = Object.values(a.sports).flatMap((e) => e.events.map((id) => S().events[id])).filter(Boolean);
  let items = [...seasons.map((s) => ({ kind: 'season', year: s.year, sportId: s.sportId, s })), ...events.map((ev) => ({ kind: 'event', year: ev.year, sportId: ev.sportId, ev }))];
  if (sportF !== 'all') items = items.filter((x) => x.sportId === sportF);
  if (kind === 'titles') items = items.filter((x) => (x.s ? x.s.champion === x.s.playerTeamId : x.ev.place === 'Champion'));
  else if (kind !== 'all') items = items.filter((x) => x.kind === kind);
  items.sort((x, y) => y.year - x.year);
  return `${seg('sport', sportF, [['all', 'All sports'], ...sports.map((id) => [id, sportOf(id).name])])}
    ${seg('kind', kind, [['all', 'Everything'], ['season', 'Seasons'], ['event', 'Events'], ['titles', 'Titles']])}
    ${items.length ? items.slice(0, 80).map((x) => (x.s ? seasonRow(x.s) : eventRow(x.ev))).join('') : empty('Nothing here yet.')}`;
}
function seasonRow(s) {
  const t = sp.standings(s);
  const place = t.findIndex((x) => x.teamId === s.playerTeamId) + 1;
  return row(`data-season="${s.id}"`, glyph(s.sportId), s.name, `${ordinal(place)} of ${t.length}${s.champion === s.playerTeamId ? ' · champions' : ''}`, String(s.year));
}
function eventRow(ev) {
  return row(`data-event="${ev.id}"`, glyph(ev.sportId), ev.name, `${ev.place}${ev.mark ? ` · ${ev.mark}` : ''}${ev.prize ? ` · ${money(ev.prize)}` : ''}`, String(ev.year));
}

function rankings() {
  const a = sp.myAthlete();
  return `<p class="muted">The Pathways Rating (PR) is the game's own rating. It starts at 1000 and moves only with results.</p>
    ${Object.values(a.sports).map((e) => `<div class="card"><h3>${esc(sportOf(e.id).name)}</h3>
      ${kv('Pathways Rating', `${e.pr} · ${sp.prWord(e.pr)}`)}
      ${kv('Record', `${e.wins} won · ${e.losses} lost${e.draws ? ` · ${e.draws} drawn` : ''}`)}
      ${kv('Titles', String(e.titles.length))}
      ${Object.entries(e.best ?? {}).map(([k, v]) => { const ev = sportOf(e.id).events?.find((x) => x[0] === k); return ev ? kv(`Best ${ev[1]}`, fmtMark(ev, v)) : ''; }).join('')}
      ${Object.entries(e.rivals ?? {}).filter(([, x]) => x.met >= 2).slice(0, 4).map(([n, x]) => kv(`Against ${n}`, `${x.won} of ${x.met}`)).join('')}
    </div>`).join('')}`;
}

function career() {
  const dec = life.openDecisions();
  const ks = life.contractsOf();
  const p = player();
  const a = sp.myAthlete();
  return `${label('Decisions')}${dec.length ? dec.map((d) => `<div class="card"><p>${esc(d.text)}</p><div class="btn-stack">${d.options.map((o) => `<button class="btn" data-answer="${d.id}:${o.id}">${esc(o.label)}</button>`).join('')}</div></div>`).join('') : empty('Nothing waiting.')}
    ${label('Contracts')}${ks.length ? ks.map((k) => kv(`${k.kind === 'pro' ? 'Playing' : k.kind === 'sponsor' ? 'Sponsor' : 'Agent'}: ${k.name}`, `${k.from}${k.to ? `–${k.to}` : ''} · ${k.status}${k.salary ? ` · ${money(k.salary)} a year` : k.amount ? ` · ${money(k.amount)} a year` : ''}`)).join('') : empty('None.')}
    ${label('The way up')}
    ${sp.activeSports().map((e) => { const sport = sportOf(e.id); const route = sp.proPath(sport, p.countryId); return kv(sport.name, esc(store.state.year < sport.proFrom ? `Nobody is paid to play it yet (from ${sport.proFrom}).` : route === 'draft' ? 'Professional teams draft from school and university.' : route === 'tour' ? 'Professionals play a tour for prize money.' : route === 'none' ? 'No professional league: the best compete for their country.' : 'Clubs sign players, often from their academies.') + (sp.hasCollegeSport(sport, p.countryId) ? ' Universities here recruit, with scholarships.' : '')); }).join('')}
    ${label('After playing')}
    <div class="btn-stack">${sp.activeSports().map((e) => `<button class="btn" data-retire="${e.id}">Retire from ${esc(sportOf(e.id).name.toLowerCase())}</button>`).join('')}
      ${p.age >= 18 && !a.coaching ? Object.values(a.sports).map((e) => `<button class="btn" data-coachjob="${e.id}">Coach ${esc(sportOf(e.id).name.toLowerCase())}</button>`).join('') : ''}</div>
    ${a.coaching ? kv('Coaching', `${esc(sportOf(a.coaching.sportId).name)} since ${a.coaching.since}`) : ''}`;
}

function health() {
  const a = sp.myAthlete();
  const open = a.injuries.filter((x) => x.status === 'out');
  return `${label('Injuries')}
    ${open.length ? open.map((x) => kv(`${x.name} (${sportOf(x.sportId).name})`, `${x.rehab ? esc(x.rehab === 'physio' ? 'Physiotherapy' : x.rehab === 'rush' ? 'Playing through it' : 'Resting') : 'No plan yet'} · ${x.left >= 1 ? 'a long way to go' : x.left >= 0.4 ? 'months to go' : 'nearly there'}`)).join('') : empty('Fit to play.')}
    ${a.injuries.filter((x) => x.status !== 'out').slice(-6).reverse().map((x) => kv(`${x.year}: ${x.name}`, `healed ${x.healed}${x.setbacks ? `, after ${x.setbacks} ${x.setbacks === 1 ? 'setback' : 'setbacks'}` : ''}`)).join('')}
    ${label('Mind')}
    <p class="muted">How sport feels is part of how it goes. Pathways does not diagnose anyone: if it stops feeling right, talking to someone helps.</p>
    ${kv('Confidence', bar(a.confidence))}${kv('Motivation', bar(a.motivation))}
    ${a.support ? kv('Sports psychologist', `${a.support} ${a.support === 1 ? 'year' : 'years'} of sessions`) : ''}
    ${a.integrity?.caught ? kv('Integrity', `Banned in ${a.integrity.caught}`) : a.integrity?.reported ? kv('Integrity', 'Reported an approach to cheat') : ''}`;
}

function moneySection() {
  const a = sp.myAthlete();
  const paid = Object.entries(S().paid).filter(([, x]) => x.cat).sort((x, y) => y[1].year - x[1].year);
  const sum = (cat) => paid.filter(([, x]) => x.cat === cat).reduce((s, [, x]) => s + x.amount, 0);
  const name = { prizeMoney: 'Prize money', sponsorship: 'Sponsorship', sport: 'Fees, coaching, kit and agents', health: 'Treatment' };
  return `<p class="muted">A professional's wages are paid as a salary with the rest of your work. Prize money and sponsors are paid here. Each payment is made once.</p>
    ${kv('Prize money, all time', money(sum('prizeMoney')))}
    ${kv('Sponsorship, all time', money(sum('sponsorship')))}
    ${kv('Spent on sport, all time', money(-sum('sport') - sum('health')))}
    ${kv('Fame in sport', `${Math.round(a.fame)} of 100`)}
    ${label('Payments')}
    ${paid.length ? paid.slice(0, 30).map(([, x]) => kv(`${x.year} · ${name[x.cat] ?? x.cat}`, money(x.amount))).join('') : empty('None yet.')}`;
}

function legacySection() {
  const all = Object.values(S().athletes).sort((x, y) => x.gen - y.gen || x.born - y.born);
  return `<p class="muted">Every athlete in the family, kept for good. Skills and trophies are earned, never inherited.</p>
    ${all.length ? all.map((a) => row(`data-athlete="${a.id}"`, '🏅', a.name + (a.id === player().id ? ' (you)' : ''), `Generation ${a.gen} · ${Object.values(a.sports).map((e) => sportOf(e.id).name).join(', ') || 'no sport'}`,
    `${Object.values(a.sports).reduce((s, e) => s + e.titles.length, 0)} titles`)).join('') : empty('No athletes in the family yet.')}`;
}

// ---------- Profiles ----------

function sportProfile(step) {
  const e = sp.entryOf(step.params.sportId, step.params.personId ?? player().id);
  const sport = sportOf(step.params.sportId);
  if (!e) return { title: sport.name, body: empty('No record.') };
  const mine = (step.params.personId ?? player().id) === player().id;
  return { title: sport.name, sub: `${levelName(e.level)} · since ${e.since} · PR ${e.pr}`, body: `
    ${label('Skills')}<p class="muted">Each skill can grow towards a ceiling that comes from natural talent. Training moves it closer; it never goes past.</p>
    ${sport.skills.map(([k, n]) => kv(n, `${sp.skillWord(e.skills[k])} (${Math.round(e.skills[k])})${mine ? ` <small class="muted">of ${e.ceiling[k]}</small>` : ''}`)).join('')}
    ${label('Seasons by year')}
    ${Object.entries(e.stats).sort((x, y) => y[0] - x[0]).map(([y, st]) => kv(y, esc(Object.entries(st).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ') || '—'))).join('') || empty('Nothing recorded yet.')}
    ${label('Titles')}${e.titles.length ? e.titles.map((t) => kv(String(t.year), esc(t.name))).join('') : empty('None yet.')}
    ${label('Clubs')}${e.history.map((h) => kv(`${h.year}${h.to ? `–${h.to}` : ''}`, esc(h.name))).join('') || empty('None.')}
    ${mine && e.status === 'active' ? `<div class="btn-stack" style="margin-top:10px">${sp.myAthlete().primary !== e.id ? `<button class="btn" data-primary="${e.id}">Make this your main sport</button>` : ''}<button class="btn danger" data-giveup="${e.id}">Stop playing</button></div>` : ''}` };
}
function teamProfile(step) {
  const t = sp.teamOf(step.params.teamId);
  if (!t) return { title: 'Team', body: empty('No record.') };
  const org = sp.orgOf(t.orgId);
  const coach = sp.coachOf(org?.coachId);
  const sport = sportOf(t.sportId);
  const pos = (id) => sport.positions?.find((x) => x[0] === id)?.[1] ?? '';
  return { title: t.name, sub: `${levelName(org.level)} · ${org.city} · founded ${org.founded}`, body: `
    ${coach ? row(`data-coach="${coach.id}"`, '🧢', coach.name, `Coach · ${coach.style}`) : ''}
    ${label('Roster')}${t.roster.slice().sort((x, y) => y.rating - x.rating).map((x) => `<div class="kv"><span>${x.npcId || (x.id === player().id) ? `<a href="#" ${x.id === player().id ? '' : `data-person="${x.npcId}"`}>${esc(x.name)}${x.id === player().id ? ' (you)' : ''}</a>` : esc(x.name)}</span><span>${esc(pos(x.pos))} · ${x.rating}</span></div>`).join('')}
    ${label('History')}${t.history.slice(-12).reverse().map((h) => (h.seasonId ? `<a href="#" class="kv" data-season="${h.seasonId}"><span>${h.year}</span><span>${ordinal(h.place)}${h.champion ? ', champions' : ''}</span></a>` : kv(String(h.year), esc(h.text)))).join('') || empty('No seasons yet.')}` };
}
function coachProfile(step) {
  const c = sp.coachOf(step.params.coachId);
  if (!c) return { title: 'Coach', body: empty('No record.') };
  const n = store.state.npcs[c.id];
  return { title: c.name, sub: `${sportOf(c.sportId).name} coach`, body: `
    ${kv('Style', esc(sp.COACH_STYLE[c.style] ?? c.style))}
    ${kv('Best at', esc({ technical: 'Technique', physical: 'Fitness and strength', mental: 'Decisions and the mental side' }[c.specialty] ?? c.specialty))}
    ${kv('Standing', c.quality >= 80 ? 'One of the best' : c.quality >= 60 ? 'Well regarded' : c.quality >= 40 ? 'Solid' : 'Learning the job')}
    ${n ? kv('Between you', `${Math.round(n.meters.relationship)}%`) : ''}
    ${label('Career')}${c.history.map((h) => kv(String(h.year), esc(h.text))).join('')}
    ${n && n.alive && !c.self ? `<button class="btn" data-person="${c.id}" style="margin-top:10px">Talk to ${esc(c.name.split(' ')[0])}</button>` : ''}` };
}
function seasonProfile(step) {
  const s = sp.seasonOf(step.params.seasonId);
  if (!s) return { title: 'Season', body: empty('No record.') };
  const t = sp.standings(s);
  const name = (id) => sp.teamOf(id)?.name ?? id;
  const mineF = s.fixtures.filter((f) => f.home === s.playerTeamId || f.away === s.playerTeamId);
  return { title: s.name, sub: s.champion ? `Champions: ${name(s.champion)}` : 'No champion', body: `
    ${label('Table')}<p class="muted">Counted from completed games.</p>
    ${t.map((x, i) => `<div class="kv"><span>${i + 1}. ${x.teamId === s.playerTeamId ? `<strong>${esc(name(x.teamId))}</strong>` : esc(name(x.teamId))}</span><span>${x.w}–${x.d ? `${x.d}–` : ''}${x.l} · ${x.pts} pts</span></div>`).join('')}
    ${label('Playoffs')}${s.playoffs.map((f) => kv(f.round, `${esc(name(f.home))} ${f.score[0]}–${f.score[1]} ${esc(name(f.away))}${f.decider ? ' (after a decider)' : ''}`)).join('') || empty('None.')}
    ${label('Your games')}${mineF.map((f) => kv(`Round ${f.round}`, `${esc(name(f.home))} ${f.score[0]}–${f.score[1]} ${esc(name(f.away))}${f.me?.played ? ` · rated ${f.me.rating}` : ' · did not play'}`)).join('')}` };
}
function eventProfile(step) {
  const ev = sp.eventOf(step.params.eventId);
  if (!ev) return { title: 'Event', body: empty('No record.') };
  const pair = ev.partnershipId ? S().partnerships[ev.partnershipId] : null;
  return { title: ev.name, sub: `${ev.year} · ${levelName(ev.level)} · ${ev.place}`, body: `
    ${pair ? kv('Partner', `<a href="#" data-person="${pair.b}">${esc(pair.bName)}</a>`) : ''}
    ${ev.mark ? kv(ev.discipline ?? 'Result', `${esc(ev.mark)}${ev.pb ? ' · personal best' : ''}`) : ''}
    ${ev.rounds.map((r) => kv(r.round, `${r.won ? 'Beat' : 'Lost to'} ${esc(r.opp)} ${r.sets ? r.sets.map((x) => `${x[0]}–${x[1]}`).join(', ') : esc(r.how ?? '')} · PR ${r.pr >= 0 ? '+' : ''}${r.pr}`)).join('')}
    ${kv('Rating', `${ev.prBefore} → ${ev.prAfter}`)}
    ${ev.prize ? kv('Prize money', money(ev.prize)) : ''}` };
}
function athleteProfile(step) {
  const a = sp.athleteOf(step.params.athleteId);
  if (!a) return { title: 'Athlete', body: empty('No record.') };
  const ms = sp.momentsOf(a.id).filter((m) => m.sig >= 2);
  return { title: a.name, sub: `Born ${a.born} · generation ${a.gen}${a.died ? ` · died ${a.died}` : ''}`, body: `
    ${Object.values(a.sports).map((e) => row(`data-sport="${e.id}" data-who="${a.id}"`, glyph(e.id), sportOf(e.id).name, `${levelName(e.level)} · ${e.titles.length} titles`, `PR ${e.pr}`)).join('')}
    ${a.arcs.length ? `${label('Their story')}${a.arcs.map((x) => `<p><strong>${esc(x.title)}</strong> (${x.year}): ${esc(x.text)}</p>`).join('')}` : ''}
    ${label('Moments')}${ms.length ? ms.map(momentRow).join('') : empty('None recorded.')}` };
}

const SCREENS = { hub, sport: sportProfile, team: teamProfile, coach: coachProfile, season: seasonProfile, event: eventProfile, athlete: athleteProfile };
const BACK = { hub: 'Back to My Athletics', sport: 'Back to the sport', team: 'Back to the team', coach: 'Back to the coach', season: 'Back to the season', event: 'Back to the event', athlete: 'Back to the athlete' };
export const backText = (step) => (step ? BACK[step.screen] ?? 'Back' : 'Close');

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
  modal.el.classList.add('dyn-modal', 'zoo-modal', 'sport-modal');
  modal.el.dataset.screen = step.screen;
  modal.el.addEventListener('click', onClick);
  bodyEl().scrollTop = step.ui.scroll ?? 0;
}

async function report(r) {
  api?.changed?.();
  shut();
  await messageModal({ body: r.text, tone: r.tone });
  show();
}

async function onClick(e) {
  const hit = (attr) => e.target.closest(`[${attr}]`);
  const step = nav.top();
  let el;
  if (hit('data-x')) return closeAll();
  if (hit('data-back')) { nav.back(); return nav.top() ? show() : closeAll(); }
  if ((el = hit('data-set'))) { e.preventDefault(); const [k, v] = el.dataset.set.split(':'); note({ [k]: v, ...(k === 'tab' ? { scroll: 0 } : {}) }); return show(); }
  if ((el = hit('data-person'))) {
    e.preventDefault();
    const npc = store.state.npcs[el.dataset.person];
    if (!npc || !hooks.openPerson) return undefined;
    note(); shut();
    return hooks.openPerson(npc, api, () => show());
  }
  const open = (screen, params) => { e.preventDefault(); note(); nav.open(screen, params); return show(); };
  if ((el = hit('data-sport'))) return open('sport', { sportId: el.dataset.sport, personId: el.dataset.who ?? step.params.athleteId ?? null });
  if ((el = hit('data-team')) && el.dataset.team) return open('team', { teamId: el.dataset.team });
  if ((el = hit('data-coach'))) return open('coach', { coachId: el.dataset.coach });
  if ((el = hit('data-season'))) return open('season', { seasonId: el.dataset.season });
  if ((el = hit('data-event'))) return open('event', { eventId: el.dataset.event });
  if ((el = hit('data-athlete'))) return open('athlete', { athleteId: el.dataset.athlete });
  note();
  if ((el = hit('data-take'))) return report(sp.takeUp(el.dataset.take));
  if ((el = hit('data-tryout'))) return report(sp.tryOut(el.dataset.tryout));
  if ((el = hit('data-leave'))) return report(sp.leaveClub(el.dataset.leave));
  if ((el = hit('data-quitcollege'))) { shut(); if (!await confirmModal({ title: 'Leave the team?', body: 'An athletic scholarship is paid for playing. Leave the team and that part of your tuition is yours to pay from next year.', yes: 'Leave', danger: true })) return show(); return report(life.quitCollegeTeam(el.dataset.quitcollege)); }
  if ((el = hit('data-pair'))) return report(sp.findPartner(el.dataset.pair));
  if ((el = hit('data-unpair'))) return report(sp.endPartnership(el.dataset.unpair));
  if ((el = hit('data-primary'))) return report(sp.setPrimary(el.dataset.primary));
  if ((el = hit('data-giveup'))) { shut(); if (!await confirmModal({ title: 'Stop playing?', body: 'Your record is kept. You can take it up again later, though skills fade.', yes: 'Stop', danger: true })) return show(); return report(sp.giveUp(el.dataset.giveup)); }
  if ((el = hit('data-retire'))) { shut(); if (!await confirmModal({ title: 'Retire?', body: 'This ends your playing career in this sport, and any contract with it.', yes: 'Retire', danger: true })) return show(); return report(life.retire(el.dataset.retire)); }
  if ((el = hit('data-coachjob'))) return report(life.becomeCoach(el.dataset.coachjob));
  if ((el = hit('data-answer'))) { const [id, choice] = el.dataset.answer.split(':'); return report(life.answer(id, choice)); }
  if ((el = hit('data-decide'))) { note({ tab: 'career', scroll: 0 }); return show(); }
  if ((el = hit('data-position'))) {
    e.preventDefault(); shut();
    const sport = sportOf(el.dataset.position);
    const pick = await pickModal({ title: 'Your position', body: 'Where you play decides which skills matter most.', options: sport.positions.map(([id, n]) => ({ value: id, label: n })) });
    if (!pick) return show();
    return report(sp.setPosition(sport.id, pick));
  }
  if ((el = hit('data-plan'))) {
    shut();
    const type = await pickModal({ title: 'Training plan', body: 'What the year\'s training is for.', options: Object.entries(PLANS).map(([k, x]) => ({ value: k, label: x.name, sub: x.blurb })) });
    if (!type) return show();
    const hours = await pickModal({ title: 'How much', body: 'Hours a week. They come out of the same week as school, work and everything else.', options: LOADS.map((l) => ({ value: String(l.hours), label: `${l.name}: ${l.hours} h`, sub: l.blurb })) });
    if (!hours) return show();
    return report(sp.setPlan(el.dataset.plan, type, Number(hours)));
  }
  if ((el = hit('data-extra'))) {
    shut();
    const sport = sportOf(el.dataset.extra);
    const skill = await pickModal({ title: 'Extra session', body: 'A few focused hours on one thing.', options: sport.skills.map(([k, n]) => ({ value: k, label: n })) });
    if (!skill) return show();
    return report(sp.extraSession(sport.id, skill));
  }
  return undefined;
}

/** Opens My Athletics, at a section. `back` is called when it is closed (e.g. to return to the family archive). */
export function openAthletics(tabApi, tab = 'overview', back = null) {
  api = tabApi;
  onLeave = back;
  nav.clear();
  nav.open('hub', {}, { tab });
  show();
}
connectAnimals({ openAthletics });

/** A card for the Pursuits tab. */
export function athleticsCard() {
  const p = player();
  if (p.age < 4) return '';
  const a = sp.myAthlete();
  const active = sp.activeSports();
  const waiting = life.openDecisions().length;
  return `<div class="card"><h3>My Athletics</h3><p class="muted" style="margin-bottom:10px">${active.length ? esc(active.map((e) => `${sportOf(e.id).name} (${levelName(e.level).toLowerCase()})`).join(' · ')) : a ? 'Not playing anything right now.' : 'Every athlete starts somewhere.'}${waiting ? ` · ${waiting} waiting for you` : ''}</p>
    <button class="btn" data-go="athletics">Open My Athletics</button></div>`;
}
export const internals = { nav, SCREENS, show: () => show(), INJURIES };
