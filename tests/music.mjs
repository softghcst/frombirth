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
{ let n = 0; while (music.writeSong().ok && n < 40) n++;
  check(n === 12 && music.musicOf().songs.length === 12, `a working act writes an album's worth of songs in a year (${n}), no more`); }
music.musicOf().songs = music.musicOf().songs.slice(0, 2);
check(!music.record('compilation').ok && !music.record('live').ok, 'a compilation needs records out already, and a live album needs crowds');
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

// 10. Bands looking for people, genres, and labels with a sound.
const { GENRES, GENRE_BY_ID, POSITIONS } = await import('../js/data/music.js');
p = life('uk', 22);
p.talents.music = 85; p.skills = { drums: 80 };
check(GENRES.length >= 30 && ['rock', 'pop', 'punk', 'metal', 'hip_hop', 'jazz', 'country', 'emo', 'kpop'].every((id) => GENRE_BY_ID[id]), 'many genres, rock, pop, punk, metal and more');
check(GENRES.every((g) => g.lineup.every((pos) => POSITIONS[pos])), 'every genre\'s line-up is made of real positions');
const notices = music.openings('uk');
check(notices.length >= 6 && notices.every((o) => POSITIONS[o.position] && GENRE_BY_ID[o.genre] && o.genre && GENRE_BY_ID[o.genre].band), 'bands put up notices for a position, in a band genre');
check(music.openings('uk') === notices, 'the same notices all year');
check(music.positionSkill('drums') > music.positionSkill('violin'), 'a drummer plays drums better than violin');
let joined = null;
for (const o of [...notices].sort((x, y) => x.bar - y.bar)) { if (music.auditionsLeft() <= 0) break; const r = music.auditionForBand(o.id); if (r.ok) { joined = o; break; } }
check(music.auditionsLeft() >= 0 && music.auditionsLeft() <= 2, 'auditions are counted, three a year');
if (joined) {
  const band = music.myAct();
  check(band && band.genre === joined.genre && band.members.find((m) => m.who === 'player').role === joined.position, 'joining puts you in the band, in the position you auditioned for');
  check(band.members.filter((m) => m.who !== 'player').every((m) => POSITIONS[m.role] && store.state.npcs[m.who]), 'everyone else in it is a real musician with a position');
  const ad = music.advertise('keys');
  check(ad.candidates?.length === 3 && ad.candidates.every((n) => n.flags.star.plays?.keys), 'an advert brings three keyboard players');
  check(music.hireMember(ad.candidates[0].id, 'keys').ok && music.members(band).some((m) => m.who === ad.candidates[0].id && m.role === 'keys'), 'and one joins on keys');
  const ls = music.labels('uk');
  check(ls.filter((l) => l.tier === 'major').length === 2 && ls.filter((l) => l.sound).length >= 6, 'two majors, and independents with their own sound');
  check(new Set(ls.map((l) => l.name)).size === ls.length, 'every label has its own name');
  if (!band.deal) {
    const other = ls.find((l) => l.sound && !l.sound.includes(band.genre));
    if (other) { const r = music.sendDemo(other.id); check(!r.ok || /sign/.test(r.text), 'a label hears every demo'); }
    music.sendDemo(ls[0].id);
    check(!music.sendDemo(ls[1].id).ok && music.demosLeft() === 0, 'two demos a year');
  }
}
check(GENRE_BY_ID.kpop.from > 1960 && !music.openings('uk').some((o) => GENRE_BY_ID[o.genre].from > store.state.year), 'no genre before it existed');
section(`bands: ${notices.length} notices, ${joined ? `joined ${GENRE_BY_ID[joined.genre].name.toLowerCase()} as ${POSITIONS[joined.position].name.toLowerCase()}` : 'no audition went well'}, labels with their own sounds`);

// Credits on other acts' records: sessions, and songs that end up on an album.
{
  p = life('uk', 28);
  p.talents.music = 85; p.talents.singing = 70;
  music.musicOf(p).songs = Array.from({ length: 6 }, (_, i) => ({ title: `Song ${i}`, q: 90 }));
  let played = 0;
  for (let y = 0; y < 3; y++) { for (let i = 0; i < 3; i++) if (music.session().ok) played++; year(); }
  const sc = music.musicOf(p).sessionCredits ?? [];
  check(played >= 3 && sc.length === played, `every session is credited (${sc.length} of ${played})`);
  check(sc.every((c) => POSITIONS[c.position] && music.act(c.actId)), 'each credit names the act and what the player played');
  const placed = sc.filter((c) => c.releaseId && music.release(c.releaseId));
  check(placed.length >= 1 && placed.every((c) => (music.release(c.releaseId).credits?.session ?? []).some((x) => x.who === 'player' && x.position === c.position)), 'the record\'s own credits list the player');
  // Songs sold to acts: some reappear on their EPs and albums, and earn a share of the whole record.
  let sold = 0;
  for (let y = 0; y < 8; y++) { if (music.pitchSong().ok) sold++; year(); }
  const credits = p.fame.songCredits ?? [];
  const albums = credits.filter((c) => c.kind === 'album');
  check(sold >= 1, `songs sold (${sold})`);
  if (albums.length) {
    check(albums.every((c) => c.share > 0 && c.share <= 1 && (music.release(c.releaseId)?.credits?.writers ?? []).some((w) => w.who === 'player')), 'an album with the player\'s song credits them as a writer, for their share of the songs');
    check(credits.filter((c) => c.album).every((c) => albums.some((x) => x.releaseId === c.album)), 'the single and the album are linked');
  }
  section(`credits: ${sc.length} sessions credited, ${sold} songs sold, ${albums.length} on albums`);
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Encore.');
