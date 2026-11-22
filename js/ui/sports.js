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
import * as extras from '../engine/sportsExtras.js';
import { colorsOf, numbersOf } from '../engine/teamIdentity.js';
import { decommit, gradeOf, GRADE_NAMES } from '../engine/recruiting.js';
import * as draft from '../engine/draft.js';
import * as bb from '../engine/baseball.js';
import { classOf, eligibility as collegeLeft } from '../engine/college.js';
import { DIVISIONS } from '../data/sports.js';
import { jerseySvg, jerseyDot, inkOn } from './jersey.js';
import { fmtMark } from '../engine/sportsPlay.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { createNav } from './animalNav.js';
import { navRow } from './kit.js';
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
const bar = (v) => `<div class="mini" style="width:100%"><i class="fill ${v >= 68 ? 'high' : v >= 40 ? 'mid' : 'low'}" style="width:${Math.max(2, Math.min(100, v))}%"></i></div>`;
/** Why nobody in the player's division can be paid to play a sport this year. */
function proClosed(sport) {
  const div = sp.divisionOf();
  const y = sp.proYears(sport, div);
  const who = div === 'women' && sport.womenProFrom !== undefined ? 'No woman' : 'Nobody';
  if (y.from == null) return `${who} is paid to play it: there is no professional league for the ${sp.DIVISION_NAME[div].toLowerCase()} game.`;
  if (y.until && store.state.year > y.until) return `The women's professional league closed in ${y.until}. Nobody has started another.`;
  return `${who} is paid to play it yet (from ${y.from}).`;
}
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
  return `<div class="card"><h3>Every athlete starts somewhere.</h3><p class="muted">Pick a sport.</p>
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
    ${a.arcs.length ? `${label('Your story')}${a.arcs.slice(-4).reverse().map((x) => `<p><strong>${x.letter ? `${esc(x.letter)} · ` : ''}${esc(x.title)}</strong> <span class="muted">(${x.year})</span><br>${esc(x.text)}</p>`).join('')}` : ''}
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
    <p class="muted">Up to three at a time.</p>
    ${menu.filter((x) => !x.playing).map((x) => `<button class="row" data-take="${x.sport.id}" ${x.ok ? '' : 'disabled'}><div class="avatar glyph">${glyph(x.sport.id)}</div>
      <div class="main"><strong>${esc(x.sport.name)}</strong><small>${esc(x.ok ? `${x.popular ? 'Popular here · ' : ''}${x.sport.kind === 'team' ? 'Team sport' : x.sport.kind === 'racket' ? 'Singles and doubles' : 'Individual'}${x.sport.adaptive ? ' · adaptive' : ''}` : x.text)}</small></div></button>`).join('')}`;
}

function training() {
  const active = sp.activeSports();
  if (!active.length) return empty('You are not playing anything right now.');
  const left = sp.EXTRA_PER_YEAR - (S().acts.year === store.state.year ? S().acts.extra : 0);
  return `
    ${active.map((e) => {
    const sport = sportOf(e.id);
    const coach = sp.coachOf(e.coachId);
    return `<div class="card"><h3>${esc(sport.name)}</h3>
      ${kv('Plan', `${esc(PLANS[e.plan.type]?.name ?? 'Balanced')}, ${e.plan.hours} h a week`)}
      ${kv('Coach', coach ? `<a href="#" data-coach="${coach.id}">${esc(coach.name)}</a>` : 'None')}
      ${kv('Private coach', e.privateCoachId ? `<a href="#" data-coach="${e.privateCoachId}">${esc(sp.coachOf(e.privateCoachId).name)}</a>` : 'None')}
      ${e.mentorId ? kv('Mentor', `<a href="#" data-person="${e.mentorId}">${esc(store.state.npcs[e.mentorId]?.firstName ?? '')}</a>`) : ''}
      ${kv('Fatigue', e.fatigue >= 70 ? 'Worn out' : e.fatigue >= 45 ? 'Tired' : 'Fresh')}
      <div class="btn-stack" style="margin-top:8px"><button class="btn" data-plan="${e.id}">Change the plan</button><button class="btn" data-extra="${e.id}" ${left > 0 ? '' : 'disabled'}>Extra session</button>
        ${e.contractId ? '' : e.privateCoachId ? `<button class="btn" data-dropcoach="${e.id}">Stop the private coaching</button>` : `<button class="btn" data-hirecoach="${e.id}">Hire a private coach</button>`}</div>
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
  return `
    ${Object.values(a.sports).map((e) => `<div class="card"><h3>${esc(sportOf(e.id).name)}</h3>
      ${kv('Pathways Rating', `${e.pr} · ${sp.prWord(e.pr)}`)}
      ${kv('Record', `${e.wins} won · ${e.losses} lost${e.draws ? ` · ${e.draws} drawn` : ''}`)}
      ${kv('Titles', String(e.titles.length))}
      ${Object.entries(e.best ?? {}).map(([k, v]) => { const ev = sportOf(e.id).events?.find((x) => x[0] === k); return ev ? kv(`Best ${ev[1]}`, fmtMark(ev, v)) : ''; }).join('')}
      ${Object.entries(e.rivals ?? {}).filter(([, x]) => x.met >= 2).slice(0, 4).map(([n, x]) => kv(`Against ${n}`, `${x.won} of ${x.met}`)).join('')}
    </div>`).join('')}`;
}

/** College, the draft and the minors: where the player stands, what the mock drafts say, and the drafts they were in. */
function draftSection() {
  const st = store.state;
  const p = player();
  const out = [];
  for (const e of sp.activeSports()) {
    const D = draft.draftOf(st, e.id);
    const sport = sportOf(e.id);
    if (e.college && sp.orgOf(e.orgId)?.kind === 'college') {
      const left = collegeLeft(st, e);
      out.push(`${label(`College ${sport.name.toLowerCase()}`)}${kv('Class', esc(classOf(st, e)))}${kv('Division', esc(DIVISIONS[e.college.division]?.name ?? e.college.division))}${kv('Eligibility', `${left.seasons} ${left.seasons === 1 ? 'season' : 'seasons'} left, ${left.years} ${left.years === 1 ? 'year' : 'years'} on the clock`)}${e.college.nil.length ? kv('NIL deals', esc(money(e.college.nil.reduce((s, x) => s + x.amount, 0)))) : ''}`);
    }
    if (e.bb?.lines.length) out.push(baseballSection(st, e));
    if (e.intl) out.push(intlSection(st, e));
    if (e.trades?.length) out.push(`${label(`${sport.name}: trades`)}${e.trades.map((t) => kv(String(t.year), `${esc(t.from)} → ${esc(t.to)}, for ${esc(t.for)}${t.deadline ? ' · at the trade deadline' : ''}${t.vetoed ? ' · you refused' : ''}`)).join('')}`);
    if (e.youth && (e.youth.scholar || e.youth.released)) out.push(`${label(`${sport.name}: the academy`)}${e.youth.scholar ? kv(p.countryId === 'uk' ? 'Scholarship' : 'Youth contract', `${e.youth.scholar.from}–${e.youth.scholar.until}`) : kv('Released', String(e.youth.released))}`);
    if (e.asia && D && (e.proYear || e.asia.service || e.asia.served || e.asia.exempt)) {
      const n = e.proYear ? st.year - e.proYear : 0;
      const sv = e.asia.service ? `${e.asia.service.kind === 'sangmu' ? 'Serving, with Sangmu' : 'Serving'} until ${e.asia.service.until}` : e.asia.served ? 'Served' : e.asia.exempt ? `Exempt: ${e.asia.exempt}` : p.countryId === 'kr' && p.gender === 'male' ? 'Due before 28' : '';
      out.push(`${label(`${D.name}: the way abroad`)}${e.proYear ? kv('Seasons as a professional', String(n)) : ''}
        ${kv('Posting', D.posting ? `After ${D.posting} seasons, with the club's consent` : "With the club's consent")}
        ${kv('Free agency abroad', `After ${D.freeAgency} seasons`)}
        ${e.asia.posted.map((x) => kv(`Posting, ${x.year}`, x.to ? `Signed with ${esc(x.to)}` : x.consent ? 'Posted' : 'The club said no')).join('')}
        ${sv ? kv('Military service', esc(sv)) : ''}`);
    }
    if (!D) continue;
    const el = draft.eligible(st, e, D);
    const grade = draft.draftGrade(st, e);
    const pick = draft.projectedPick(grade);
    const drafts = Object.values(st.sports?.drafts ?? {}).filter((d) => d.sport === e.id && d.player).sort((a, b) => b.year - a.year);
    const size = drafts[0]?.size ?? 30;
    out.push(`${label(`${sport.name} draft`)}
      ${e.contractId ? '' : kv('Eligible', el.ok ? `Yes${el.declare ? ', if you declare' : ''}` : esc(el.why))}
      ${e.contractId ? '' : kv('Mock drafts', pick <= D.rounds * size ? `Round ${draft.roundOf(pick, size)}, around pick ${pick}` : 'Not projected to be picked')}
      ${e.draft?.rights ? kv('Rights held by', `${esc(e.draft.rights.club)} until ${e.draft.rights.until}`) : ''}
      ${e.minor ? kv('Minor leagues', `${esc((e.minor.ladder ?? D.minors)[e.minor.level])}: ${esc(sp.orgOf(e.minor.orgId)?.name ?? '')}`) : ''}
      ${drafts.map((d) => `<details class="card"><summary><strong>${d.year} draft</strong> · ${d.player.undrafted ? 'not picked' : `you went in round ${d.player.round}, pick ${d.player.pick}, to ${esc(sp.teamOf(d.player.teamId)?.name ?? '')}`}</summary>
        ${d.lottery.length ? `<p class="muted">Lottery: ${d.lottery.map((x) => `${esc(sp.teamOf(x.teamId)?.name ?? '')} ${x.from}→${x.to}`).join(', ')}</p>` : ''}
        ${draft.draftBoard(st, d, 1).map((x) => `<div class="kv"><span>${x.pick}. ${x.mine ? '<strong>You</strong>' : esc(x.name)} <small class="muted">${x.mine ? '' : esc([x.pos, x.school].filter(Boolean).join(' · '))}</small></span><span>${esc(x.team)}</span></div>`).join('')}</details>`).join('')}`);
  }
  return out.join('');
}

/** Baseball's own record (engine/baseball.js): the lines, the totals, the honors, the roster rules, the Hall of Fame. */
function baseballSection(st, e) {
  const R = e.bb;
  const C = R.career;
  const pro = R.lines.filter((x) => !['other', 'school'].includes(x.level));
  const shown = (pro.length ? pro : R.lines).slice(-6).reverse();
  const k = e.contractId ? st.sports.contracts[e.contractId] : null;
  const avg = C.AB ? (C.H / C.AB).toFixed(3).replace(/^0/, '') : null;
  const era = C.IP ? (C.ER * 9 / C.IP).toFixed(2) : null;
  return `${label('Baseball: the record')}
    ${R.role ? kv('Role', `${R.role[0].toUpperCase()}${R.role.slice(1)}${R.twoWay ? ', and a hitter: a two-way player' : ''}`) : R.twoWay ? kv('Role', 'A two-way player: hitting and pitching') : ''}
    ${shown.map((x) => kv(`${x.year} · ${esc(x.level === 'other' ? x.team : x.level)}`, `${x.G ?? x.GP} games · ${esc(bb.lineText(x))}${x.capped ? ' · innings limit' : ''}`)).join('')}
    ${C.seasons ? kv(`Big league career (${C.seasons} ${C.seasons === 1 ? 'season' : 'seasons'})`, [avg ? `${avg}, ${C.H.toLocaleString('en-US')} hits, ${C.HR} home runs, ${C.RBI.toLocaleString('en-US')} RBI, ${C.SB} stolen bases` : '', era ? `${C.W}–${C.L}, ${C.SV} saves, ${era} ERA, ${C.K.toLocaleString('en-US')} strikeouts` : ''].filter(Boolean).join(' · ')) : ''}
    ${R.allStar.length ? kv('All-Star', `${R.allStar.length} ${R.allStar.length === 1 ? 'time' : 'times'} (${R.allStar.slice(-6).join(', ')})`) : ''}
    ${R.derby.length ? kv('Home Run Derby', `${R.derby.length} ${R.derby.length === 1 ? 'appearance' : 'appearances'}${R.derby.some((x) => x.won) ? `, won ${R.derby.filter((x) => x.won).map((x) => x.year).join(', ')}` : ''}`) : ''}
    ${R.honors.map((x) => kv(String(x.year), esc(x.what))).join('')}
    ${R.feats.map((x) => kv(String(x.year), esc(`${x.what[0].toUpperCase()}${x.what.slice(1)}`))).join('')}
    ${R.classic.length ? kv('World Baseball Classic', R.classic.map((x) => `${x.year}: ${x.result}`).join(' · ')) : ''}
    ${R.winters.length ? kv('Winter ball', `${R.winters.length} ${R.winters.length === 1 ? 'winter' : 'winters'}, last with ${esc(R.winters.at(-1).team)}${R.winter === 'always' ? ' · every winter' : ''}`) : ''}
    ${k && (R.fortyMan || R.options?.length) ? kv('Roster', `${R.fortyMan ? 'On the 40-man roster' : 'Not on the 40-man roster'}${R.options?.length ? ` · ${R.options.length} of 3 option years used` : ''}${R.rule5 ? ' · a Rule 5 pick: must stay in the big leagues all season' : ''}`) : ''}
    ${k?.optOut || k?.noTrade ? kv('Contract', [k.optOut ? `opt-out in ${k.optOut}` : '', k.noTrade ? 'no-trade clause' : ''].filter(Boolean).join(' · ')) : ''}
    ${R.summer.length ? kv('Summer league', `${R.summer.length} ${R.summer.length === 1 ? 'summer' : 'summers'} with wooden bats`) : ''}
    ${R.adviser && !e.proYear ? kv('Draft adviser', 'Yes: 4% of a signing bonus') : ''}
    ${R.hall ? kv('Hall of Fame', R.hall.elected ? `Elected in ${R.hall.elected} with ${R.hall.votes.at(-1).pct}% of the vote` : `${R.hall.votes.map((v) => `${v.year}: ${v.pct}%`).slice(-4).join(' · ')}${R.hall.dropped ? ' · off the ballot' : ' · 75% needed'}`) : ''}`;
}

/** An international signing (engine/international.js): the trainer, the handshake deal, the bonus, the minors. */
function intlSection(st, e) {
  const X = e.intl;
  const p = player();
  const T = X.trainer;
  return `${label(`${sportOf(e.id).name}: international signing`)}
    ${X.signed ? kv('Signed', `${esc(X.signed.club)}, ${X.signed.year} · ${money(X.signed.bonus)} bonus${X.signed.toTrainer ? ` (${money(X.signed.toTrainer)} to your trainer)` : ''}`)
      : kv('Can sign', p.countryId === 'cu' && !X.left ? 'Only after leaving Cuba' : p.age < 16 ? 'From January 15 after you turn 16' : 'Now, as a free agent')}
    ${T ? kv('Trainer', `${esc(T.name)} since ${T.since} · ${T.fullTime ? 'full time' : 'around school'} · takes ${Math.round(T.cut * 100)}% of the bonus`) : ''}
    ${X.deal ? kv('Handshake deal', `${esc(X.deal.club)}: ${money(X.deal.amount)} (not binding)`) : ''}
    ${X.fellThrough.map((f) => kv(`Fell through, ${f.year}`, esc(f.why))).join('')}
    ${X.signed && X.english != null ? kv('English', X.english >= 60 ? 'Fluent enough for interviews' : X.english >= 35 ? 'Getting by' : 'A few words') : ''}
    ${X.remit === 'yearly' ? kv('Money home', '15% of your salary each year') : ''}
    ${e.minor?.ladder ? kv('Minor leagues', `${esc(e.minor.ladder[e.minor.level])}: ${esc(sp.orgOf(e.minor.orgId)?.name ?? '')}`) : ''}`;
}

/** Recruiting: how the services rate the player, who has offered, and where they are committed or signed. */
function recruitingSection() {
  const p = player();
  const list = sp.activeSports().filter((e) => e.recruit && (e.recruit.stars || e.recruit.offers.length));
  if (!list.length) return '';
  return list.map((e) => {
    const R = e.recruit;
    const g = gradeOf(p);
    const pr = (o) => `${DIVISIONS[o.division]?.name ?? o.division} · ${o.fraction >= 1 ? 'full scholarship' : o.fraction > 0 ? `${Math.round(o.fraction * 100)}% of tuition` : 'no athletic scholarship'}`;
    return `${label(`Recruiting: ${sportOf(e.id).name}`)}
      ${kv('Rating', R.stars ? `${'★'.repeat(R.stars)} · number ${R.rank} in your class` : 'Not rated yet')}
      ${g ? kv('Year', `${GRADE_NAMES[g]} (grade ${g})`) : ''}
      ${kv('Status', R.signed ? `Signed with ${esc(R.offers.find((o) => o.id === R.signed)?.name ?? '')}` : R.commit ? `Committed to ${esc(R.offers.find((o) => o.id === R.commit)?.name ?? '')} (not binding)` : 'Uncommitted')}
      ${R.offers.length ? R.offers.map((o) => kv(esc(o.name), `${esc(pr(o))}${o.pulled ? ' · withdrawn' : ''}${R.visits.includes(o.id) ? ' · visited' : ''}`)).join('') : empty('No offers yet. Coaches can offer from junior year.')}
      ${R.commit && !R.signed ? `<div class="btn-stack"><button class="btn" data-decommit="${e.id}">Decommit</button></div>` : ''}`;
  }).join('');
}

function career() {
  const dec = life.openDecisions();
  const ks = life.contractsOf();
  const p = player();
  const a = sp.myAthlete();
  return `${label('Decisions')}${dec.length ? dec.map((d) => `<div class="card"><p>${esc(d.text)}</p><div class="btn-stack">${d.options.map((o) => `<button class="btn" data-answer="${d.id}:${o.id}">${esc(o.label)}</button>`).join('')}</div></div>`).join('') : empty('Nothing waiting.')}
    ${recruitingSection()}
    ${draftSection()}
    ${label('Contracts')}${ks.length ? ks.map((k) => kv(`${k.kind === 'pro' ? 'Playing' : k.kind === 'sponsor' ? 'Sponsor' : 'Agent'}: ${k.name}`, `${k.from}${k.to ? `–${k.to}` : ''} · ${k.status}${k.kind === 'agent' && k.share ? ` · takes ${Math.round(k.share * 100)}%` : ''}${k.salary ? ` · ${money(k.salary)} a year` : k.amount ? ` · ${money(k.amount)} a year` : ''}`)).join('') : empty('None.')}
    ${(() => { const moves = Object.values(a?.sports ?? {}).flatMap((e) => (e.abroad ?? []).map((m) => ({ ...m, sportId: e.id }))); return moves.length ? `${label('Moves abroad')}${moves.map((m) => kv(`${m.year}: ${sp.orgOf(m.orgId)?.name ?? 'A club'}`, esc(`${COUNTRIES[m.countryId]?.name ?? ''} · ${sportOf(m.sportId).name} · fee ${money(m.fee)}`))).join('')}` : ''; })()}
    ${squadSection()}
    ${boxingSection()}
    ${gamesSection()}
    ${agentSection()}
    ${label('Division')}
    ${kv('You play in', `${esc(sp.DIVISION_NAME[sp.divisionOf()])} competition`)}
    
    ${sp.choosesDivision(p) ? `<div class="btn-stack">${['women', 'men'].filter((d) => d !== sp.divisionOf()).map((d) => `<button class="btn" data-division="${d}">Compete in the ${esc(sp.DIVISION_NAME[d].toLowerCase())} division</button>`).join('')}</div>` : ''}
    ${label('The way up')}
    ${sp.activeSports().map((e) => { const sport = sportOf(e.id); const route = sp.proPath(sport, p.countryId); return kv(sport.name, esc(!sp.proYears(sport).open ? proClosed(sport) : route === 'draft' ? 'Professional teams draft from school and university.' : route === 'tour' ? 'Professionals play a tour for prize money.' : route === 'none' ? 'No professional league: the best compete for their country.' : 'Clubs sign players, often from their academies.') + (sp.hasCollegeSport(sport, p.countryId) ? ' Universities here recruit, with scholarships.' : '')); }).join('')}
    ${label('After playing')}
    <div class="btn-stack">${sp.activeSports().map((e) => `<button class="btn" data-retire="${e.id}">Retire from ${esc(sportOf(e.id).name.toLowerCase())}</button>`).join('')}
      ${p.age >= 18 && !a.coaching ? Object.values(a.sports).map((e) => `<button class="btn" data-coachjob="${e.id}">Coach ${esc(sportOf(e.id).name.toLowerCase())}</button>`).join('') : ''}</div>
    ${a.coaching ? kv('Coaching', `${esc(sportOf(a.coaching.sportId).name)} since ${a.coaching.since}`) : ''}`;
}

/** The squad a coach runs: the table last season, tactics, training, and who starts. */
function squadSection() {
  const sq = extras.squadOf();
  if (!sq) return '';
  const last = sq.c.seasons.at(-1);
  const xi = new Set(extras.lineup(sq).map((x) => x.id));
  const btns = (set, key, cur, attr) => `<div class="chips zoo-filter" role="group">${Object.entries(set).map(([k, v]) => `<button class="chip ${k === cur ? 'on' : ''}" aria-pressed="${k === cur}" ${attr}="${k}">${esc(v.name)}</button>`).join('')}</div>`;
  return `${label(`Coaching ${sq.org.name}`)}
    ${last ? kv(`${last.year} season`, esc(`${last.place}${['th', 'st', 'nd', 'rd'][last.place] ?? 'th'} of ${last.of} · ${last.w}-${last.d}-${last.l}`)) : `<p class="muted">Your first season starts this year.</p>`}
    ${sq.c.warned ? '<p class="muted">The board expect better this season.</p>' : ''}
    <p class="muted" style="margin:6px 0 2px">How the side plays: ${esc(extras.TACTICS[sq.c.tactics].blurb)}</p>${btns(extras.TACTICS, 'tactics', sq.c.tactics, 'data-tactic')}
    <p class="muted" style="margin:6px 0 2px">Training: ${esc(extras.TRAINING[sq.c.training].blurb)}</p>${btns(extras.TRAINING, 'training', sq.c.training, 'data-training')}
    <p class="muted" style="margin:6px 0 2px">Tap a player to leave them out or bring them back.</p>
    ${[...sq.team.roster].filter((x) => !x.player).sort((a2, b2) => b2.rating - a2.rating).map((x) => `<button class="row" data-bench="${esc(x.id)}"><div class="main"><strong>${esc(x.name)}</strong><small>${esc(`${x.pos ? `${(sq.sport.positions ?? []).find((q) => q[0] === x.pos)?.[1] ?? x.pos} · ` : ''}rated ${x.rating}${x.age ? ` · ${x.age}` : ''}`)}</small></div><div class="side">${xi.has(x.id) ? 'Starts' : sq.c.benched.includes(x.id) ? 'Left out' : 'Bench'}</div></button>`).join('')}`;
}
/** A boxer's record: wins, losses, knockouts, rank, belts. */
function boxingSection() {
  const e = sp.entryOf('boxing');
  const b = e?.boxing;
  if (!b) return '';
  return `${label('In the ring')}
    ${kv('Record', esc(`${b.record.w}-${b.record.l}, ${b.record.ko} by knockout`))}
    ${kv('Division', esc(b.weight))}
    ${kv('Standing', esc(b.title ? `${extras.BELT.body} champion · ${b.title.defenses} ${b.title.defenses === 1 ? 'defense' : 'defenses'}` : `Ranked ${b.rank}`))}
    ${b.titles.map((t) => kv(`${t.year}: ${t.weight} title`, esc(t.lost ? `held until ${t.lost}${t.defenses ? `, ${t.defenses} defenses` : ''}` : 'held'))).join('')}
    ${b.fights.slice(-4).reverse().map((f) => kv(`${f.year} · ${f.opp}`, esc(`${f.won ? 'Won' : 'Lost'} ${f.how}${f.title ? ` · ${f.title}` : ''}`))).join('')}`;
}
/** The national side at the World Games. */
function gamesSection() {
  const rows = Object.values(sp.myAthlete()?.sports ?? {}).flatMap((e) => (e.gamesTeams ?? []).filter((t) => t.picked).map((t) => ({ ...t, sportId: e.id })));
  if (!rows.length) return '';
  return `${label('World Games, with the national side')}${rows.map((t) => kv(`${t.year} · ${sportOf(t.sportId).name}`, esc(`${t.medal ? `${t.medal[0].toUpperCase()}${t.medal.slice(1)}` : `Out in the ${t.place.toLowerCase()}`} · ${t.rounds.map((r) => `${r.score.join('–')} v ${COUNTRIES[r.opp]?.name ?? r.opp}${r.how}`).join(', ')}`))).join('')}`;
}

/** The player's sports agent, or the search for one: the same agents as under My Fame → Representation. */
function agentSection() {
  if (!life.wantsSportsAgent()) return '';
  const mine = life.myAgent();
  const n = mine ? store.state.npcs[mine.npcId] : null;
  const offer = life.sportsAgentOnOffer();
  const left = life.sportsAgentTriesLeft();
  const pull = (c) => (c >= 1.25 ? 'a lot of pull' : c >= 0.9 ? 'some pull' : 'not much pull');
  const books = (x) => { const list = (x.flags.agent?.clients ?? []).map((id) => store.state.npcs[id]).filter((c) => c && c.alive !== false).slice(0, 4);
    return list.length ? `<p class="muted">Also represents: ${list.map((c) => esc(`${c.firstName} ${c.lastName} (${c.occupation ?? 'athlete'})`)).join(', ')}.</p>` : ''; };
  return `${label('Agent')}
    ${n ? `${kv(`${n.firstName} ${n.lastName}`, esc(`${mine.agency ? `${mine.agency} · ` : ''}takes ${Math.round(mine.commission * 100)}% · ${pull(mine.clout)}`))}${books(n)}
      <div class="btn-stack"><button class="btn" data-sagent="cut">Ask for a smaller cut</button><button class="btn" data-sagent="drop">Part ways</button></div>`
      : '<p class="muted">Agents take three to ten per cent.</p>'}
    ${offer ? `<div class="card"><h3>${esc(`${offer.firstName} ${offer.lastName}`)}</h3>${kv('Agency', esc(offer.flags.agent.agency))}${kv('Their cut', `${Math.round(offer.flags.agent.commission * 100)}%`)}${kv('Pull with clubs and brands', pull(offer.flags.agent.clout))}${books(offer)}
      <div class="btn-stack"><button class="btn primary" data-sagent="sign">Sign with them</button><button class="btn" data-sagent="find" ${left <= 0 ? 'disabled' : ''}>Look for another (${left} left this year)</button><button class="btn" data-sagent="pass">Say no</button></div></div>`
      : `<div class="btn-stack"><button class="btn" data-sagent="find" ${left <= 0 ? 'disabled' : ''}>${n ? 'Look for a different agent' : 'Look for an agent'} (${left > 0 ? `${left} ${left === 1 ? 'look' : 'looks'} left this year` : 'none left this year'})</button></div>`}`;
}

function health() {
  const a = sp.myAthlete();
  const open = a.injuries.filter((x) => x.status === 'out');
  return `${label('Injuries')}
    ${open.length ? open.map((x) => kv(`${x.name} (${sportOf(x.sportId).name})`, `${x.rehab ? esc(x.rehab === 'physio' ? 'Physiotherapy' : x.rehab === 'rush' ? 'Playing through it' : 'Resting') : 'No plan yet'} · ${x.left >= 1 ? 'a long way to go' : x.left >= 0.4 ? 'months to go' : 'nearly there'}`)).join('') : empty('Fit to play.')}
    ${a.injuries.filter((x) => x.status !== 'out').slice(-6).reverse().map((x) => kv(`${x.year}: ${x.name}`, `healed ${x.healed}${x.setbacks ? `, after ${x.setbacks} ${x.setbacks === 1 ? 'setback' : 'setbacks'}` : ''}`)).join('')}
    ${label('Mind')}
    
    ${kv('Confidence', bar(a.confidence))}${kv('Motivation', bar(a.motivation))}
    ${a.support ? kv('Sports psychologist', `${a.support} ${a.support === 1 ? 'year' : 'years'} of sessions`) : ''}
    ${a.integrity?.caught ? kv('Integrity', `Banned in ${a.integrity.caught}`) : a.integrity?.reported ? kv('Integrity', 'Reported an approach to cheat') : ''}`;
}

function moneySection() {
  const a = sp.myAthlete();
  // This life's payments only, in this life's money: an earlier generation's are theirs.
  const cur = C().currency.code;
  const paid = Object.entries(S().paid).filter(([, x]) => x.cat && (x.personId ? x.personId === player().id : (x.gen ?? 1) === (player().generation ?? 1)) && x.cur === cur).sort((x, y) => y[1].year - x[1].year);
  const sum = (cat) => paid.filter(([, x]) => x.cat === cat).reduce((s, [, x]) => s + x.amount, 0);
  const name = { prizeMoney: 'Prize money', sponsorship: 'Sponsorship', sport: 'Fees, coaching, kit and agents', health: 'Treatment' };
  return `
    ${kv('Prize money, all time', money(sum('prizeMoney')))}
    ${kv('Sponsorship, all time', money(sum('sponsorship')))}
    ${kv('Spent on sport, all time', money(-sum('sport') - sum('health')))}
    ${kv('Fame in sport', `${Math.round(a.fame)} of 100`)}
    ${label('Payments')}
    ${paid.length ? paid.slice(0, 30).map(([, x]) => kv(`${x.year} · ${name[x.cat] ?? x.cat}`, money(x.amount))).join('') : empty('None yet.')}`;
}

function legacySection() {
  const all = Object.values(S().athletes).sort((x, y) => x.gen - y.gen || x.born - y.born);
  return `
    ${all.length ? all.map((a) => row(`data-athlete="${a.id}"`, '🏅', a.name + (a.id === player().id ? ' (you)' : a.light && a.relation ? ` (${a.relation})` : ''), `Generation ${a.gen} · ${Object.values(a.sports).map((e) => sportOf(e.id).name).join(', ') || 'no sport'}`,
    `${Object.values(a.sports).reduce((s, e) => s + e.titles.length, 0)} titles`)).join('') : empty('No athletes in the family yet.')}`;
}

// ---------- Profiles ----------

function sportProfile(step) {
  const e = sp.entryOf(step.params.sportId, step.params.personId ?? player().id);
  const sport = sportOf(step.params.sportId);
  if (!e) return { title: sport.name, body: empty('No record.') };
  const mine = (step.params.personId ?? player().id) === player().id;
  if (!Object.keys(e.skills).length) {
    return { title: sport.name, sub: `${levelName(e.level)} · from ${e.since}`, body: `
      ${kv('Highest level', esc(levelName(e.level)))}${kv('Seasons', String(e.seasonsPlayed))}${kv('Status', e.status === 'active' ? 'Still playing' : `Stopped in ${e.stoppedYear ?? e.retiredYear ?? '—'}`)}
      ${label('Titles')}${e.titles.length ? e.titles.map((t) => kv(String(t.year), esc(t.name))).join('') : empty('None recorded.')}
      ` };
  }
  return { title: sport.name, sub: `${levelName(e.level)} · since ${e.since} · PR ${e.pr}`, body: `
    ${label('Skills')}
    ${sport.skills.map(([k, n]) => kv(n, `${sp.skillWord(e.skills[k])} (${Math.round(e.skills[k])})${mine ? ` <small class="muted">of ${e.ceiling[k]}</small>` : ''}`)).join('')}
    ${label('Seasons by year')}
    ${Object.entries(e.stats).sort((x, y) => y[0] - x[0]).map(([y, st]) => kv(y, esc(Object.entries(st).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ') || '—'))).join('') || empty('Nothing recorded yet.')}
    ${label('Titles')}${e.titles.length ? e.titles.map((t) => kv(String(t.year), esc(t.name))).join('') : empty('None yet.')}
    ${label('Awards')}${(e.awards ?? []).length ? e.awards.map((a) => (a.seasonId ? `<a href="#" class="kv" data-season="${a.seasonId}"><span>${a.year}</span><span>${esc(a.kind === 'team' ? `${a.league}: ${a.name}` : a.name)}</span></a>` : kv(String(a.year), esc(a.name)))).join('') : empty('None yet.')}
    ${label('Clubs')}${e.history.map((h) => kv(`${h.year}${h.to ? `–${h.to}` : ''}`, esc(h.name))).join('') || empty('None.')}
    ${shared(sp.momentsOf(step.params.personId ?? player().id).filter((m) => m.sportId === e.id && m.sig >= 2))}
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
    <div class="jersey-pair">${jerseySvg(colorsOf(org), '', 52, `${t.name} home jersey`)}${jerseySvg({ home: colorsOf(org).away, away: colorsOf(org).home }, '', 52, `${t.name} away jersey`)}<small class="muted">Home and away. Names, colors and numbers can be changed in Settings → Teams and jerseys.</small></div>
    ${coach ? row(`data-coach="${coach.id}"`, '🧢', coach.name, `Coach · ${coach.style}`) : ''}
    ${label('Roster')}${numbersOf(t).roster.slice().sort((x, y) => y.rating - x.rating).map((x) => `<div class="kv"><span><span class="tm-num" style="background:${colorsOf(org).home};color:${inkOn(colorsOf(org).home)}">${x.num}</span>${x.npcId || (x.id === player().id) ? `<a href="#" ${x.id === player().id ? '' : `data-person="${x.npcId}"`}>${esc(x.name)}${x.id === player().id ? ' (you)' : ''}</a>` : esc(x.name)}</span><span>${esc(pos(x.pos))} · ${x.rating}</span></div>`).join('')}
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
    ${t.map((x, i) => `<div class="kv"><span>${i + 1}. ${jerseyDot(colorsOf(sp.orgOf(sp.teamOf(x.teamId)?.orgId)))}${x.teamId === s.playerTeamId ? `<strong>${esc(name(x.teamId))}</strong>` : esc(name(x.teamId))}</span><span>${x.w}–${x.d ? `${x.d}–` : ''}${x.l} · ${x.pts} pts</span></div>`).join('')}
    ${s.awards ? `${label('Season awards')}${s.awards.map((a) => (a.team ? kv(a.name, esc(a.team.map((x) => (x.who === player().id || x.who === 'player' ? 'You' : x.name)).join(', '))) : kv(a.name, a.winner ? `${a.winner.who === 'player' ? '<strong>You</strong>' : esc(a.winner.name)}${a.winner.teamId ? ` <small class="muted">${esc(name(a.winner.teamId))}</small>` : ''}${a.winner.value != null ? ` · ${a.winner.value}${a.per ? ' a game' : ''}` : ''}` : 'Not awarded'))).join('')}` : ''}
    ${label('Playoffs')}${s.playoffs.map((f) => kv(f.label ?? f.round, `${esc(name(f.home))} ${f.score[0]}–${f.score[1]} ${esc(name(f.away))}${f.decider ? ' (after a decider)' : ''}`)).join('') || empty('None.')}
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
/** The people who shared these moments and are still known: each opens their profile, where their memories are. */
function shared(ms) {
  const ids = [...new Set(ms.flatMap((m) => m.people ?? []))].filter((id) => store.state.npcs[id]?.alive && player().npcIds.includes(id));
  return ids.length ? `${label('Who was there')}${ids.map((id) => { const n = store.state.npcs[id]; return row(`data-person="${id}"`, '👤', `${n.firstName} ${n.lastName}`, `${n.flags?.title ?? n.role} · ${(n.memories ?? []).filter((x) => x.key.startsWith('sport:')).length} shared memories`); }).join('')}` : '';
}
function athleteProfile(step) {
  const a = sp.athleteOf(step.params.athleteId);
  if (!a) return { title: 'Athlete', body: empty('No record.') };
  const ms = sp.momentsOf(a.id).filter((m) => m.sig >= 2);
  return { title: a.name, sub: `Born ${a.born} · generation ${a.gen}${a.died ? ` · died ${a.died}` : ''}`, body: `
    ${Object.values(a.sports).map((e) => row(`data-sport="${e.id}" data-who="${a.id}"`, glyph(e.id), sportOf(e.id).name, `${levelName(e.level)} · ${e.titles.length} titles`, `PR ${e.pr}`)).join('')}
    ${a.arcs.length ? `${label('Their story')}${a.arcs.map((x) => `<p><strong>${esc(x.title)}</strong> (${x.year}): ${esc(x.text)}</p>`).join('')}` : ''}
    ${label('Moments')}${ms.length ? ms.map(momentRow).join('') : empty('None recorded.')}
    ${shared(ms)}` };
}


// ---------- One sport: its page, practice, and the league ----------

/** The player's latest season in a sport, or null before the first is played. */
function latestSeason(e) {
  return e.seasons.map((id) => sp.seasonOf(id)).filter(Boolean).sort((a, b) => b.year - a.year)[0] ?? null;
}
/** The losing finalist, if the season had a final. */
function runnersUp(s) {
  const fin = s.playoffs?.[s.playoffs.length - 1];
  return fin?.score && s.champion ? (fin.home === s.champion ? fin.away : fin.home) : null;
}
/** A team's place in the season's final order: the champions first, the runners-up second, then the table. */
function rank(s, teamId, table) {
  if (s.champion === teamId) return 1;
  const ru = runnersUp(s);
  if (ru === teamId) return 2;
  const rest = table.filter((x) => x.teamId !== s.champion && x.teamId !== ru);
  return (s.champion ? 1 : 0) + (ru ? 1 : 0) + rest.findIndex((x) => x.teamId === teamId) + 1;
}
/** Where a team finished: Champions, Runners-up, or its place. */
function finish(s, teamId, table) {
  const r = rank(s, teamId, table);
  return s.champion === teamId ? 'Champions' : runnersUp(s) === teamId ? 'Runners-up' : ordinal(r);
}
const record = (x) => `${x.w}–${x.l}${x.d ? `–${x.d}` : ''}`;

/** A sport the player plays: how good they are, their team and where it stands, and everything to do. */
function sportDesk(step) {
  const e = sp.entryOf(step.params.sportId);
  const sport = sportOf(step.params.sportId);
  if (!e) return { title: sport.name, body: empty('You do not play this.') };
  const team = sp.teamOf(e.teamId);
  const org = sp.orgOf(team?.orgId ?? e.orgId);
  const s = sport.kind === 'team' ? latestSeason(e) : null;
  const table = s ? sp.standings(s) : null;
  const mine = table?.find((x) => x.teamId === s.playerTeamId);
  const left = sp.EXTRA_PER_YEAR - (S().acts.year === store.state.year ? S().acts.extra : 0);
  const ov = sp.overall(e);
  const rows = [];
  if (sport.kind === 'team') rows.push(navRow({ attrs: `data-league="${e.id}"`, label: 'League', sub: s ? `${s.name}: the standings` : 'The table, once your first season is played', ico: 'trophy' }));
  else rows.push(navRow({ attrs: 'data-gohub="rankings"', label: 'Rankings', sub: `Pathways Rating ${e.pr} · ${sp.prWord(e.pr)}`, ico: 'trophy' }));
  if (e.status === 'active') {
    rows.push(navRow({ attrs: `data-practice="${e.id}"`, label: 'Practice', sub: left > 0 ? `Work on one skill · ${left} ${left === 1 ? 'session' : 'sessions'} left this year` : 'Done for this year', ico: 'star' }));
    const fit = sp.fitnessScore(sp.fitnessOf());
    const tl = sp.TRAIN_PER_YEAR - (S().acts.year === store.state.year ? S().acts.train ?? 0 : 0);
    rows.push(navRow({ attrs: `data-train="${e.id}"`, label: 'Train', sub: `Fitness ${fit} · ${tl > 0 ? `${tl} ${tl === 1 ? 'session' : 'sessions'} left this year` : 'done for this year'}`, ico: 'health' }));
    rows.push(navRow({ attrs: `data-plan="${e.id}"`, label: 'Training Plan', sub: `${PLANS[e.plan.type]?.name ?? 'Balanced'}, ${e.plan.hours} h a week`, ico: 'calendar' }));
  }
  if (team) rows.push(navRow({ attrs: `data-team="${team.id}"`, label: sport.kind === 'team' ? 'Team' : 'Club', sub: 'The roster, the coach and the history', ico: 'people' }));
  if (sport.positions && e.status === 'active') rows.push(navRow({ attrs: `data-position="${e.id}"`, label: 'Position', sub: sport.positions.find((x) => x[0] === e.position)?.[1] ?? 'Choose one', ico: 'compass' }));
  rows.push(navRow({ attrs: `data-stats="${e.id}"`, label: 'Stats', sub: 'Your skills, seasons, titles and awards', ico: 'archive' }));
  if (e.status === 'active') rows.push(navRow({ attrs: `data-giveup="${e.id}"`, label: 'Stop Playing', sub: 'Your record is kept', ico: 'exit' }));
  return { title: sport.name, sub: `${levelName(e.level)}${org ? ` · ${org.name}` : ''}`, body: `
    <div class="card sd-head"><div class="sd-glyph" aria-hidden="true">${glyph(e.id)}</div><div class="sd-main">
      <strong>${esc(sp.skillWord(ov))}</strong>${bar(ov)}<small class="muted">Overall ${ov} · Pathways Rating ${e.pr}</small></div></div>
    ${team && sport.kind === 'team' ? `<button class="card sd-team" data-league="${e.id}"><div class="sd-glyph" aria-hidden="true">${jerseyDot(colorsOf(org))}</div><div class="sd-main">
      <strong>${esc(team.name)}${mine ? ` <span class="muted">(${rank(s, s.playerTeamId, table)}/${table.length})</span>` : ''}</strong>
      ${mine ? `<small>${esc(s.year)}: ${record(mine)} · ${esc(finish(s, s.playerTeamId, table))}</small>` : '<small class="muted">The season is played through the year.</small>'}
      <span class="sd-strength"><small>Team strength</small>${bar(org?.strength ?? 50)}</span></div></button>` : ''}
    ${label('Activities')}<div class="nav-group">${rows.join('')}</div>` };
}

/** Practice: every skill of the sport as a bar, and one to work on now. */
function practiceScreen(step) {
  const e = sp.entryOf(step.params.sportId);
  const sport = sportOf(step.params.sportId);
  const left = sp.EXTRA_PER_YEAR - (S().acts.year === store.state.year ? S().acts.extra : 0);
  const lowest = sport.skills.slice().sort((a, b) => (e.skills[a[0]] ?? 0) - (e.skills[b[0]] ?? 0))[0][0];
  const focus = step.ui.focus ?? lowest;
  return { title: 'Practice', sub: `Work on your ${sport.name.toLowerCase()} skills`, body: `
    <div class="card">${sport.skills.map(([k, n]) => `<div class="sd-skill"><span>${esc(n)}</span>${bar(e.skills[k] ?? 0)}<small>${Math.round(e.skills[k] ?? 0)}</small></div>`).join('')}
      <p class="muted" style="margin-top:6px">Each skill can grow up to what your body allows. Tired: ${e.fatigue >= 70 ? 'very' : e.fatigue >= 45 ? 'a little' : 'not at all'}.</p></div>
    <label class="field"><span>Pick your focus</span>
      <select data-focus>${sport.skills.map(([k, n]) => `<option value="${k}" ${k === focus ? 'selected' : ''}>${esc(n)} (${Math.round(e.skills[k] ?? 0)})</option>`).join('')}</select></label>
    <button class="btn primary" data-work="${e.id}" ${left > 0 && e.status === 'active' ? '' : 'disabled'} style="margin-top:10px">Work on It</button>
    <p class="muted" style="margin-top:6px">${left > 0 ? `${left} ${left === 1 ? 'session' : 'sessions'} left this year.` : 'No more sessions this year: the rest is in the training plan.'}</p>` };
}

/** Train: physical fitness, for every sport at once. Who you are and where you play, then four bars and a focus. */
function trainScreen(step) {
  const e = sp.entryOf(step.params.sportId);
  const sport = sportOf(step.params.sportId);
  const f = sp.fitnessOf();
  const left = sp.TRAIN_PER_YEAR - (S().acts.year === store.state.year ? S().acts.train ?? 0 : 0);
  const lowest = sp.FITNESS.slice().sort((a, b) => f[a[0]] - f[b[0]])[0][0];
  const focus = step.ui.focus ?? lowest;
  const pos = sport.positions?.find((x) => x[0] === e.position)?.[1];
  return { title: 'Train', sub: 'Work on your physical fitness', body: `
    <div class="card">${kv('Age', String(player().age))}${kv('Sport', esc(sport.name))}${pos ? kv('Position', esc(pos)) : ''}</div>
    <div class="card"><div class="sd-skill"><strong>Fitness</strong>${bar(sp.fitnessScore(f))}<small>${sp.fitnessScore(f)}</small></div>
      ${sp.FITNESS.map(([k, n]) => `<div class="sd-skill"><span>${esc(n)}</span>${bar(f[k])}<small>${f[k]}</small></div>`).join('')}
      <p class="muted" style="margin-top:6px">Fit athletes play better in every sport, and stay healthier.</p></div>
    <label class="field"><span>Pick your focus</span>
      <select data-focus>${sp.FITNESS.map(([k, n]) => `<option value="${k}" ${k === focus ? 'selected' : ''}>${esc(n)} (${f[k]})</option>`).join('')}</select></label>
    <button class="btn primary" data-dotrain ${left > 0 && e.status === 'active' ? '' : 'disabled'} style="margin-top:10px">Train</button>
    <p class="muted" style="margin-top:6px">${left > 0 ? `${left} ${left === 1 ? 'session' : 'sessions'} left this year.` : 'No more sessions this year.'}</p>` };
}

/** The league: every team in the player's latest season, best first, with its strength. */
function leagueScreen(step) {
  const e = sp.entryOf(step.params.sportId);
  const sport = sportOf(step.params.sportId);
  const s = latestSeason(e);
  if (!s) return { title: 'League', sub: sport.name, body: empty('Your first season is played through this year. The table appears once it is.') };
  const table = sp.standings(s);
  // The final order: the champions, the runners-up, then everyone else as the table had them.
  const order = table.slice().sort((a, b) => rank(s, a.teamId, table) - rank(s, b.teamId, table));
  return { title: s.name, sub: `${sport.name} · ${s.year}`, body: `
    ${order.map((x) => {
    const t = sp.teamOf(x.teamId); const org = sp.orgOf(t?.orgId); const me = x.teamId === s.playerTeamId;
    return `<button class="row sd-lrow ${me ? 'mine' : ''}" data-team="${x.teamId}"><div class="avatar glyph">${jerseyDot(colorsOf(org))}</div>
      <div class="main"><strong>${esc(t?.name ?? x.teamId)}</strong>
        <small><b>${esc(finish(s, x.teamId, table))}</b> · ${record(x)}${me ? ' · your team' : ''}</small><span class="sd-strength"><small>Strength</small>${bar(org?.strength ?? 50)}</span></div></button>`;
  }).join('')}
    <button class="btn" data-season="${s.id}" style="margin-top:10px">The Full Season</button>` };
}

const SCREENS = { hub, desk: sportDesk, practice: practiceScreen, train: trainScreen, league: leagueScreen, sport: sportProfile, team: teamProfile, coach: coachProfile, season: seasonProfile, event: eventProfile, athlete: athleteProfile };
const BACK = { hub: 'Back to My Athletics', desk: 'Back to the sport', practice: 'Back to practice', train: 'Back to training', league: 'Back to the league', sport: 'Back to the stats', team: 'Back to the team', coach: 'Back to the coach', season: 'Back to the season', event: 'Back to the event', athlete: 'Back to the athlete' };
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
  if ((el = hit('data-sport'))) {
    const who = el.dataset.who ?? step.params.athleteId ?? null;
    // A sport the player plays opens its page; anyone else's (or one given up) opens the record.
    const mine = (!who || who === player().id) && sp.entryOf(el.dataset.sport);
    return open(mine ? 'desk' : 'sport', { sportId: el.dataset.sport, personId: who });
  }
  if ((el = hit('data-gohub'))) { e.preventDefault(); while (nav.top() && nav.top().screen !== 'hub') nav.back(); if (!nav.top()) nav.open('hub', {}); nav.remember({ tab: el.dataset.gohub, scroll: 0 }); return show(); }
  if ((el = hit('data-stats'))) return open('sport', { sportId: el.dataset.stats, personId: null });
  if ((el = hit('data-practice'))) return open('practice', { sportId: el.dataset.practice });
  if ((el = hit('data-train'))) return open('train', { sportId: el.dataset.train });
  if ((el = hit('data-league'))) return open('league', { sportId: el.dataset.league });
  if ((el = hit('data-team')) && el.dataset.team) return open('team', { teamId: el.dataset.team });
  if ((el = hit('data-coach'))) return open('coach', { coachId: el.dataset.coach });
  if ((el = hit('data-season'))) return open('season', { seasonId: el.dataset.season });
  if ((el = hit('data-event'))) return open('event', { eventId: el.dataset.event });
  if ((el = hit('data-athlete'))) return open('athlete', { athleteId: el.dataset.athlete });
  note();
  if ((el = hit('data-take'))) return report(sp.takeUp(el.dataset.take));
  if ((el = hit('data-tryout'))) return report(sp.tryOut(el.dataset.tryout));
  if ((el = hit('data-leave'))) return report(sp.leaveClub(el.dataset.leave));
  if ((el = hit('data-decommit'))) { shut(); if (!await confirmModal({ title: 'Decommit?', body: 'Coaches move on quickly: the offer may not be there if you change your mind again.', yes: 'Decommit' })) return show(); await messageModal({ body: decommit(el.dataset.decommit, store.state).text }); return show(); }
  if ((el = hit('data-quitcollege'))) { shut(); if (!await confirmModal({ title: 'Leave the team?', body: 'An athletic scholarship is paid for playing. Leave the team and that part of your tuition is yours to pay from next year.', yes: 'Leave', danger: true })) return show(); return report(life.quitCollegeTeam(el.dataset.quitcollege)); }
  if ((el = hit('data-pair'))) return report(sp.findPartner(el.dataset.pair));
  if ((el = hit('data-unpair'))) return report(sp.endPartnership(el.dataset.unpair));
  if ((el = hit('data-primary'))) return report(sp.setPrimary(el.dataset.primary));
  if ((el = hit('data-giveup'))) { shut(); if (!await confirmModal({ title: 'Stop playing?', body: 'Your record is kept. You can take it up again later, though skills fade.', yes: 'Stop', danger: true })) return show(); return report(sp.giveUp(el.dataset.giveup)); }
  if ((el = hit('data-retire'))) { shut(); if (!await confirmModal({ title: 'Retire?', body: 'This ends your playing career in this sport, and any contract with it.', yes: 'Retire', danger: true })) return show(); return report(life.retire(el.dataset.retire)); }
  if ((el = hit('data-tactic'))) return report(extras.setTactics(el.dataset.tactic));
  if ((el = hit('data-training'))) return report(extras.setTraining(el.dataset.training));
  if ((el = hit('data-bench'))) return report(extras.toggleBench(el.dataset.bench));
  if ((el = hit('data-sagent'))) return report({ find: life.findSportsAgent, sign: life.signSportsAgent, pass: life.passOnSportsAgent, drop: life.dropSportsAgent, cut: life.askSportsAgentCut }[el.dataset.sagent]());
  if ((el = hit('data-division'))) return report(sp.setDivision(el.dataset.division));
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
  if ((el = hit('data-hirecoach'))) {
    shut();
    const sport = sportOf(el.dataset.hirecoach);
    const pick = await pickModal({ title: `A private ${sport.name.toLowerCase()} coach`, body: player().age >= 18 ? 'Paid by you, every year you keep them.' : 'Your family would pay.',
      options: sp.privateCoaches(sport.id).map((c) => ({ value: String(c.i), label: `${c.quality >= 75 ? 'Highly rated' : c.quality >= 55 ? 'Experienced' : 'Starting out'}: ${money(c.cost)} a year`, sub: sp.COACH_STYLE[c.style] })) });
    if (!pick) return show();
    return report(sp.hirePrivateCoach(sport.id, pick));
  }
  if ((el = hit('data-dropcoach'))) return report(sp.dropPrivateCoach(el.dataset.dropcoach));
  if ((el = hit('data-dotrain'))) {
    const focus = modal.el.querySelector('[data-focus]')?.value;
    note({ focus });
    return report(sp.trainFitness(focus));
  }
  if ((el = hit('data-work'))) {
    const skill = modal.el.querySelector('[data-focus]')?.value;
    note({ focus: skill });
    return report(sp.extraSession(el.dataset.work, skill));
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

/**
 * Opens a page of My Athletics from a line in the life story: { screen, id }. My Athletics is underneath it, so going
 * back lands on the hub, at the section that page belongs to.
 */
export function openAthleticsAt(tabApi, link, back = null) {
  api = tabApi;
  onLeave = back;
  nav.clear();
  const [screen, section] = link.screen.split(':');
  if (screen === 'hub') { nav.open('hub', {}, { tab: link.id ?? section ?? 'overview' }); return show(); }
  const tab = { season: 'competitions', event: 'competitions', team: 'teams', coach: 'training', sport: 'sports', athlete: 'legacy' }[screen] ?? 'overview';
  nav.open('hub', {}, { tab });
  const params = { season: { seasonId: link.id }, event: { eventId: link.id }, team: { teamId: link.id }, coach: { coachId: link.id }, sport: { sportId: link.id }, athlete: { athleteId: link.id } }[screen];
  if (params && SCREENS[screen]) nav.open(screen, params);
  return show();
}

/** A card for the Pursuits tab. */
export function athleticsCard() {
  const p = player();
  if (p.age < 4) return '';
  const a = sp.myAthlete();
  const active = sp.activeSports();
  const waiting = life.openDecisions().length;
  return `<div class="card"><h3>My Athletics</h3><p class="muted" style="margin-bottom:10px">${active.length ? esc(active.map((e) => `${sportOf(e.id).name} (${levelName(e.level).toLowerCase()})`).join(' · ')) : a ? 'Not playing right now.' : 'Pick a sport.'}${waiting ? ` · ${waiting} waiting for you` : ''}</p>
    <button class="btn" data-go="athletics">Open My Athletics</button></div>`;
}
export const internals = { nav, SCREENS, show: () => show(), INJURIES };
