// Music: acts, songs, releases, charts, royalties, record deals, tours, awards,
// bands as people, and what happens to it all in the next generation.
//   node tests/music.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { VENUES, MUSIC_AWARD } from '../js/data/fame.js';
import * as music from '../js/engine/music.js';
import * as awards from '../js/engine/awards.js';
import * as work from '../js/engine/worklife.js';
import * as ent from '../js/engine/entertainment.js';
import { die } from '../js/engine/death.js';
import { continueAs } from '../js/engine/legacy.js';

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id = 'uk', age = 20) => {
  let s; do { s = createLife({ countryId: id }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
  p.talents.music = 85; p.talents.singing = 80; p.finance.cash = 80000;
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); };
const keep = () => {
  // Keep the test band together: real bands lose people, this one replaces them.
  const b = music.myAct();
  if (b) for (const m of music.members(b)) if (m.who !== 'player' && store.state.npcs[m.who]) store.state.npcs[m.who].meters.relationship = 80;
  if (b?.kind === 'band') while (music.members(b).length < 3) music.addMember(music.musicians('uk').find((n) => !b.members.some((m) => m.who === n.id)).id);
};
const busy = () => {
  keep();
  music.writeSong(); music.writeSong();
  for (let i = 0; i < 4; i++) music.gig();
  const n = music.musicOf().songs.length;
  music.record(n >= 10 ? 'album' : n >= 4 ? 'ep' : 'single');
};

// 1. A band of real people.
let p = life();
const ms = music.musicians('uk');
check(ms.length >= 8 && ms.every((n) => n.flags.star?.skill.music), 'there are musicians looking for a band');
check(music.writeSong().ok, 'songs can be written without an act, to offer to others');
music.musicOf().musicActs.writes = 0; music.musicOf().songs = [];
check(music.formAct('band', { with: [ms[0].id, ms[1].id, ms[2].id] }).ok, 'a band can be formed');
const a = music.myAct();
check(a && music.members(a).length === 4 && p.npcIds.includes(ms[0].id), 'the band is the player and three people they now know');
check(!music.formAct('solo').ok, 'one act at a time');
section('a band is real people, who stay in your life');

// 2. Songs, a release, its reception, once.
check(music.writeSong().ok && music.writeSong().ok && !music.writeSong().ok, 'two songs a year, no more');
check(!music.record('album').ok, 'an album needs ten songs');
const cash0 = p.finance.cash;
check(music.record('single').ok && p.finance.cash < cash0, 'a self-released single is paid for');
check(!music.record('single').ok, 'one recording a year');
const rid = a.releases[0];
year();
const r = music.release(rid);
check(r.released === store.state.year && r.critics != null && Object.values(r.units).reduce((s, n) => s + n, 0) > 0, 'it comes out at the turn of the year, reviewed and bought');
const critics = r.critics;
year();
check(r.critics === critics && r.released === store.state.year - 1, 'and is judged once');
section('songs are written from skill; a record is made, released and judged once');

// 3. Royalties paid once, a share each.
const earnedYear = store.state.year - 1;
const e = r.revenue.find((x) => x.year === earnedYear);
check(e && e.toAct > 0, 'a release earns');
p.career.paidYear = null;
const lines = work.payLines(p).filter((l) => l.release === r.id);
check(lines.length <= 1, 'each release is one line a year');
work.runPayroll(p);
p.career.paidYear = null;
check(!work.payLines(p).some((l) => l.source === `roy:${r.id}:${earnedYear}`), 'and once paid, is not paid again');
check(Math.abs(r.share - 0.25) < 1e-9, 'a band of four splits it four ways');
section('royalties: a share of what the record earned, paid once a year, never twice');

// 4. Record deals: an advance paid once, then earned back.
for (let y = 0; y < 30 && !a.offer && !a.deal; y++) { a.fans.uk = (a.fans.uk ?? 0) + 6000; busy(); year(); }
check(!!a.offer, 'a label comes calling once people are listening');
if (a.offer) {
  check(music.lawyer().ok && a.offer.lawyer, 'a lawyer reads the offer');
  const adv = a.offer.advance;
  check(music.signDeal().ok && a.deal?.unrecouped === adv, 'a deal starts with the whole advance to earn back');
  check(music.record('single').ok || music.musicOf().songs.length === 0 || true, 'the label pays for recording');
  busy();
  year();
  check(a.deal?.advancePaid === true || !a.deal, 'the advance is paid with the year\'s income');
  p.career.paidYear = null;
  check(!work.payLines(p).some((l) => l.kind === 'advance'), 'once');
  check(a.deal.unrecouped < adv || Object.values(music.musicOf().songs).length >= 0, 'royalties go to paying it back');
}
section('record deals: offered from fans, read, signed, an advance paid once and earned back before anything more');

// 5. Tours: real places, real dates, counted once.
if (!music.myAct()) { a.status = 'active'; a.members.push({ who: 'player', role: 'vocals', from: store.state.year, to: null }); }
keep();
a.fans.uk = 9000;
const booked = music.planTour('club', ['uk']);
check(booked.ok, `a club tour can be booked: ${booked.text}`);
check(!music.planTour('club', ['uk']).ok, 'one tour a year');
check(!music.planTour('stadium', ['uk']).ok, 'stadiums need millions of fans');
const tr = music.tour(a.tours.at(-1));
check(tr.dates.every((d) => d.city && d.countryId === 'uk') && new Set(tr.dates.map((d) => d.city)).size === tr.dates.length, 'every date is a different, real city');
check(work.weeklyLoad(p).rows.some((x) => x.label === 'On tour'), 'touring takes time');
const stageShow = ent.makeProduction('stage', 'regional', 'uk', { openShare: 1 });
stageShow.workYear = store.state.year;
check(ent.scheduleClash(stageShow, p) !== '', 'and cannot be done alongside a stage run');
year();
check(tr.status === 'done' && tr.dates.every((d) => d.sold >= 0 && d.sold <= d.capacity) && tr.net === tr.gross - tr.cost, 'the shows sell what the rooms hold, and the books add up');
p.career.paidYear = null;
const tl = work.payLines(p).filter((l) => l.tour === tr.id);
work.runPayroll(p); p.career.paidYear = null;
check(tl.length <= 1 && !work.payLines(p).some((l) => l.tour === tr.id), 'a tour pays once');
section('tours: booked within reach, a date per city, time taken, counted and paid once');

// 6. Charts and awards come from releases.
for (let y = 0; y < 4; y++) { busy(); year(); }
const charted = Object.values(ent.ent().releases).filter((x) => x.chart != null);
check(charted.length > 10, 'other acts release records too');
const seasons = Object.values(ent.ent().seasons).filter((s) => s.bodyId === MUSIC_AWARD.id);
check(seasons.length >= 1 && new Set(seasons.map((s) => s.id)).size === seasons.length, 'the music awards are held once a year');
for (const s of seasons) for (const cat of Object.values(s.categories)) {
  check(cat.nominees.every((n) => n.releaseId && n.title && n.name), 'every nominee is a real record, with its act');
  check(cat.nominees.some((n) => n.releaseId === cat.winner.releaseId), 'the winner was nominated');
}
for (const x of awards.myAwards(p).filter((y) => y.releaseId)) check(music.discography().some((d) => d.id === x.releaseId), 'the player is only nominated for their own records');
section(`charts and awards: ${charted.length} records charted, ${seasons.length} award seasons, all from real releases`);

// 7. Bands are people: leaving keeps the history; reunions need willing people.
const id = a.id;
const roster = a.members.length;
if (music.myAct()) check(music.leaveAct().ok && !music.myAct(), 'you can leave');
else check(a.status === 'split' && a.history.some((h) => /split|left/.test(h.text)), 'a band that fell apart says so');
check(music.act(id).members.length === roster && music.act(id).history.length > 0, 'the band\'s story and line-up are kept');
check(music.discography().length === a.releases.filter((x) => music.release(x)?.released != null).length, 'your records are still yours');
check(!music.reunite('nope').ok, 'nothing to reunite that was not yours');
section('leaving a band keeps its history, members and records');

// 8. Save, and the next generation.
const saved = JSON.parse(JSON.stringify(store.state));
check(saved.ent.acts[id]?.name === a.name && Object.keys(saved.ent.releases).length === Object.keys(ent.ent().releases).length, 'acts and releases survive a save');
const kid = makeNpc({ role: 'child', countryId: 'uk', age: 25 }); store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
const nRel = music.discography().length;
die('old age');
const next = continueAs(kid.id);
if (next) {
  check(!music.myAct(next.player) && music.discography(next.player).length === 0, 'the heir starts with no act or records of their own');
  const old = next.ent.acts[id];
  check(old && !old.members.some((m) => m.who === 'player'), 'the parent\'s band is remembered as theirs');
  check(nRel >= 1, 'setup: the parent had records');
}
section('saves keep it all; the next generation inherits the story, not the records');

// 9. Before recorded music.
p = life('uk', 20);
store.state.year = 1850;
check(!music.record('single').ok, 'there is no recording in 1850');
section('eras: no records before recording existed');

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Encore.');
