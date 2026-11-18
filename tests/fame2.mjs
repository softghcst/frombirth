// The rest of public life: sport (fame only from results), modelling, books,
// celebrity brands, famous people's own lives, comebacks, and the family record.
//   node tests/fame2.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { CAREER_BY_ID } from '../js/data/careers.js';
import { SPORTS, WORLD_GAMES } from '../js/data/fame.js';
import { hire } from '../js/engine/career.js';
import * as sports from '../js/engine/sports.js';
import * as modelling from '../js/engine/modelling.js';
import * as pub from '../js/engine/publishing.js';
import * as celebs from '../js/engine/celebs.js';
import * as fame from '../js/engine/fame.js';
import * as ent from '../js/engine/entertainment.js';
import * as work from '../js/engine/worklife.js';
import * as biz from '../js/engine/business.js';
import { die } from '../js/engine/death.js';
import { continueAs } from '../js/engine/legacy.js';

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'uk', age = 22) => {
  let s; do { s = createLife({ countryId: id }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false; p.finance.cash = 60000;
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 88); };

// 1. Sport: a league whose every match is played, and fame only from what happened.
let p = life('uk', 20);
check(!sports.chooseSport('football').ok, 'only a professional athlete takes up a professional sport');
p.talents.sports = 90;
hire(CAREER_BY_ID.athlete, 2, 70, 'offer');
check(sports.chooseSport('football').ok && p.sport.teamId, 'an athlete signs for a club');
const f0 = fame.fameOf(p).audiences.sports;
const before = sports.career(p).length;
const careerFame = fame.fameOf(p).log.filter((l) => /starter|player/i.test(l.why)).length;
let playing = 0;
for (let y = 0; y < 5; y++) {
  // Clubs lay players off; this one keeps finding another.
  if (!sports.isAthlete(p)) { hire(CAREER_BY_ID.athlete, 2, 70, 'offer'); sports.chooseSport('football'); }
  playing += 1;
  year();
  if (p.sport.offer) sports.acceptTransfer();
}
const L = store.state.sports.leagues[p.sport.leagueId];
check(sports.career(p).length === before + playing, `a season for every year played (${sports.career(p).length} of ${playing})`);
check(store.state.jobs.employers[p.career.employerId]?.name === sports.team(L.id, p.sport.teamId)?.name || !sports.isAthlete(p), 'the club is the employer');
for (const s of L.seasons) {
  const games = s.table.reduce((n, r) => n + r[1] + r[2] + r[3], 0) / 2;
  const n = L.teams.length;
  check(games === n * (n - 1) / 2 * SPORTS.football.rounds, `every match in ${s.year} is played once (${games})`);
  check(s.table.reduce((n, r) => n + r[4], 0) === s.table.reduce((n, r) => n + r[5], 0), 'goals for equal goals against');
  check(s.champion === s.table[0][0], 'the champion tops the table');
}
check(new Set(L.seasons.map((s) => s.year)).size === L.seasons.length, 'no season is played twice');
check(fame.fameOf(p).audiences.sports > f0, 'playing makes a name with sports fans');
check(fame.fameOf(p).log.every((l) => l.audience !== 'sports' || /season|caps|year/.test(l.why) || l.why === 'results'), 'every bit of sports fame comes from a season played');
check(fame.fameOf(p).log.filter((l) => /starter|player/i.test(l.why)).length === careerFame, 'the career gives no fame of its own: only results do');
check(!work.payLines(p).some((l) => /sport|season|team/i.test(l.source)), 'sport pays nothing extra: the club wage is the career\'s');
section(`sport: ${L.seasons.length} seasons of the ${L.name}, every match played, fame only from results`);

// Individual sports: events and the World Games every four years.
p = life('us', 20);
p.talents.sports = 92;
hire(CAREER_BY_ID.athlete, 3, 70, 'offer');
sports.chooseSport('tennis');
for (let y = 0; y < 5; y++) year();
const C = store.state.sports.circuits[p.sport.div === 'women' ? 'tennis:women' : 'tennis'];
check(C.seasons.every((s) => s.events.length >= SPORTS.tennis.events && s.ranking.length > 0), 'a tennis year is its events and a ranking');
check(C.seasons.every((s) => !!s.games === (s.year % WORLD_GAMES.every === 0)), 'the World Games come every four years, and only then');
check(p.sport.titles.every((t) => C.seasons.some((s) => s.events.some((e) => e.name === t.name && e.winner.who === 'player'))), 'every title the player holds is an event they won');
// Retiring.
p.career.careerId = null;
year();
check(p.sport.retiredYear != null, 'leaving the career ends the playing days, on the record');
const seasonsDone = p.sport.seasons.length;
year();
check(p.sport.seasons.length === seasonsDone, 'a retired player plays no more seasons');
section('individual sport: tournaments, rankings, World Games every four years, retirement');

// Before the sport existed.
store.state.year = 1870;
p.sport = null; p.career.careerId = 'athlete';
check(!sports.chooseSport('football').ok && !sports.chooseSport('basketball').ok, 'no professional football or basketball in 1870');
section('eras: no league before the sport was played professionally');

// 2. Modelling: an agency, castings, a portfolio.
p = life('uk', 20);
p.stats.charm = 82;
check(!modelling.attendCasting('x').ok, 'not a model, no castings');
hire(CAREER_BY_ID.modelling, 0, 60, 'offer');
const willing = modelling.agenciesWilling(p);
check(willing.length > 0 && modelling.joinAgency(willing[0].id).ok, 'an agency takes a model with the look');
const list = modelling.castings(p);
check(list.length >= 3, 'the agency sends castings');
for (const c of list) modelling.attendCasting(c.id);
check(modelling.modelOf(p).castings.went === 3, 'three castings a year');
const booked = list.filter((c) => c.status === 'booked').length;
check(modelling.portfolio(p).length === booked, 'every booking is in the portfolio');
check(!work.payLines(p).some((l) => /cast|model/i.test(l.source)), 'bookings are the career\'s work, not paid twice');
section(`modelling: an agency, castings, ${booked} bookings in the portfolio`);

// 3. Books.
p = life('uk', 30);
p.stats.intellect = 92;
hire(CAREER_BY_ID.author, 0, 60, 'offer');
check(pub.startDraft('novel', 'crime').ok && !pub.startDraft('poetry').ok, 'one book at a time');
for (let i = 0; i < 3; i++) pub.writeSession();
check(!pub.writeSession().ok && pub.writingOf(p).draft, 'three seasons of writing a year; a novel takes four');
year();
check(pub.writeSession().ok && !pub.writingOf(p).draft, 'and then it is a book');
const bid = pub.writingOf(p).books[0];
let tries = 0;
while (pub.book(bid).status === 'manuscript' && tries < 8) { pub.submit(bid); if (pub.book(bid).status === 'manuscript') { pub.writingOf(p).acts.queries = 0; } tries += 1; }
const b = pub.book(bid);
if (b.status === 'offered') pub.acceptOffer(bid, b.offers[0].publisherId); else pub.selfPublish(bid);
check(b.status === 'published', 'a finished book is published, by a publisher or the author');
year();
check(b.released === store.state.year && b.critics != null, 'it comes out at the turn of the year and is reviewed once');
const crit = b.critics;
year();
check(b.critics === crit, 'once');
const lived = store.state.year - 1;
p.career.paidYear = null;
check(!work.payLines(p).some((l) => l.source === `book:${b.id}:${lived}` || l.source === `badv:${b.id}`), 'royalties and the advance are paid once, with the year\'s income');
check(!work.payLines(p).some((l) => l.source === 'main'), 'a published author is paid by their books, not by a salary as well');
const titles = Object.values(ent.ent().books).map((x) => x.title);
check(new Set(titles).size === titles.length, 'no two books on record share a title');
const seasons = Object.values(ent.ent().seasons).filter((s) => s.bodyId === 'lantern');
check(seasons.length >= 1 && seasons.every((s) => Object.values(s.categories).every((c) => c.nominees.some((n) => n.bookId === c.winner.bookId))), 'the book prize is held, and its winners were shortlisted');
section(`books: written over time, sent out, published, reviewed once, paid once; ${seasons.length} prize seasons`);

// A memoir sells on the name.
const memoirOf = (fameLevel) => {
  p = life('uk', 45);
  p.stats.intellect = 70;
  fame.gain({ audience: 'tv', amount: fameLevel, lasting: 1, why: 'a long career on television' }, p);
  pub.startDraft('memoir');
  pub.writeSession(); pub.writeSession();
  const id = pub.writingOf(p).books[0];
  pub.selfPublish(id);
  year();
  return Object.values(pub.book(id).units).reduce((s, n) => s + n, 0);
};
const unknown = memoirOf(0);
const famous = memoirOf(70);
check(famous > unknown * 3, `a famous person's memoir sells on the name (${famous} vs ${unknown})`);
section('memoirs: the name sells the book');

// 4. Celebrity brands.
p = life('uk', 30);
const label = biz.startOptions().find((t) => t.id === 'fashion_label');
check(label && label.block, 'a fashion label needs a famous name');
fame.gain({ audience: 'fashion', amount: 70, lasting: 1, why: 'campaigns' }, p);
fame.gain({ audience: 'public', amount: 60, lasting: 1, why: 'campaigns' }, p);
check(!biz.startOptions().find((t) => t.id === 'fashion_label').block, 'a famous person can start one');
const pull = biz.starPull(p);
fame.fameOf(p).favour = 10;
check(pull > 1 && biz.starPull(p) < pull, 'it sells on the name, and on whether people like them');
section('celebrity brands: need a name, sell on it and on goodwill');

// 5. Famous lives, and the player's arc.
p = life('uk', 25);
ent.pool('uk');
for (const n of ent.pool('uk').slice(0, 20)) n.flags.star.fame = 60;
for (let y = 0; y < 8; y++) year();
const told = Object.values(store.state.npcs).filter((n) => n.flags?.star?.story?.length);
check(told.length > 0, 'famous people have lives of their own');
for (const n of told) {
  const s = n.flags.star;
  if (s.partner && s.partner !== 'private') check(store.state.npcs[s.partner]?.flags.star.partner === n.id, 'a celebrity marriage is recorded on both sides');
}
check(celebs.news(20).every((a) => store.state.npcs[a.about]), 'celebrity news is about real people in the world');
check(ent.ent().articles.filter((a) => a.kind === 'celeb').every((a) => typeof a.true === 'boolean'), 'what is reported and what is true are kept apart');
section(`famous lives: ${told.length} people with stories of their own`);

p = life('uk', 30);
fame.gain({ audience: 'film', amount: 80, lasting: 0.1, why: 'a hit' }, p);
fame.gain({ audience: 'public', amount: 70, lasting: 0.1, why: 'a hit' }, p);
let offered = false;
for (let y = 0; y < 14 && !offered; y++) { year(); offered = celebs.comebackOffers(p).length > 0; }
check(offered && celebs.phaseName(p) === 'Out of the spotlight', 'fame fades, and comeback offers come');
if (offered) {
  check(celebs.takeComeback('reality').ok, 'a reality show can be taken');
  const fee = fame.fameOf(p).arc.paid[0].fee;
  const cash = p.finance.cash;
  year();
  check(fame.fameOf(p).arc.paid[0].done, 'its fee is paid with the year\'s income');
  p.career.paidYear = null;
  check(!work.payLines(p).some((l) => l.source.startsWith('reality:')), 'once');
  check(fee > 0 && p.finance.cash !== cash, 'and it is money');
}
section('the arc: a rise, a fade, offers of a way back');

// 6. The family record.
p = life('uk', 40);
p.stats.intellect = 90;
pub.startDraft('poetry'); pub.writeSession(); pub.writeSession();
const pid = pub.writingOf(p).books[0];
pub.selfPublish(pid);
year();
const kid = makeNpc({ role: 'child', countryId: 'uk', age: 20 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
die('old age');
const next = continueAs(kid.id);
if (next) {
  const rec = next.careerRecord.at(-1);
  check(rec.npcId && next.ent.books[pid]?.author === rec.npcId, 'the parent\'s book is theirs on the family record, linked to them');
  check(!pub.published(next.player).length, 'and is not the heir\'s');
}
section('the family record: what each generation did stays theirs');

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Fame, in every form, from the work.');
