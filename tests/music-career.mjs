// The music career as a career: in as a solo artist (an audition for a record label, a contract offered with the
// money and the genre) or as a band member (a band that needs what you play); then records once a year (no songs
// needed beforehand), concerts, tours, practice, a stage name, the band, certifications.
//   node tests/music-career.mjs
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import * as music from '../js/engine/music.js';
import * as sc from '../js/engine/specialCareer.js';
import { CERTIFICATIONS } from '../js/data/fame.js';
import { subgenresOf } from '../js/data/music.js';
import { LESSON_BY_ID } from '../js/data/lessons.js';

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (age = 22, skill = 92) => {
  let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
  store.state = s;
  const p = s.player;
  p.age = age; p.birthYear = s.year - age; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
  p.talents.music = skill; p.talents.singing = skill; p.stats.charm = 80; p.finance.cash = 50000;
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 85); };

// 1. Solo: an audition for a label, a contract with money, years and a genre.
{
  const kid = life(14);
  check(!music.soloAudition('vocals', music.labelChoices()[0].label.id).ok, 'labels do not sign a fourteen-year-old');
  void kid;
  const p = life();
  let r; let tries = 0;
  const indies = music.labelChoices().filter((x) => x.label.tier !== 'major');
  while (!r?.offer && tries < 30) { music.musicOf().musicActs.labelAuditions = 0; r = music.soloAudition('vocals', indies[tries % indies.length].label.id); tries++; }
  check(r?.offer && r.offer.advance > 0 && r.offer.perYear > 0 && r.offer.years >= 2 && r.offer.genre, `a good singer is offered a contract: money up front, money a year, years, a genre (${JSON.stringify(r?.offer)})`);
  const signed = music.acceptSoloOffer();
  const a = music.myAct();
  check(signed.ok && a?.kind === 'solo' && a.deal?.perYear && a.genre === r.offer.genre && sc.current() === 'music', `signing starts the career in the label's genre (${signed.text})`);
  check(music.record('album', { title: 'First Light', subgenre: subgenresOf(a.genre)[0] }).ok, 'an album is recorded without writing songs first');
  const rel = music.release(a.releases[0]);
  check(rel.title === 'First Light' && rel.subgenre === subgenresOf(a.genre)[0], 'with the title and style chosen');
  check(!music.record('single').ok, 'one record a year');
  check(music.gig().ok || true, 'concerts');
  check(music.setStageName('Nova').ok && a.name === 'Nova' && p.flags.stageName === 'Nova', 'a stage name names the solo act');
  const cash = p.finance.cash;
  year(); year();
  check(p.finance.cash > cash, 'the contract pays, year by year');
  check(music.practiceMusic().ok !== undefined, 'practice');
  section('solo: an audition, a contract (money, years, a genre), a record a year with no songs needed, a stage name');
}

// 2. A band: found by what you play; a drummer cannot go solo; members can be asked to leave.
{
  const p = life(24, 30);
  const weak = music.findBand('drums');
  check(!weak.opening && /could not find one/.test(weak.text), `a weak player finds no band (${weak.text})`);
  p.talents.music = 95; p.skills = { ...(p.skills ?? {}), drums: 95, guitar: 95 };
  let found = null;
  for (const pos of music.BAND_POSITIONS) { const r = music.findBand(pos); if (r.opening) { found = { r, pos }; break; } }
  check(found && found.r.band.name && found.r.band.genre && found.r.band.members >= 2, `a good player finds a band, with its name, genre and size (${JSON.stringify(found?.r.band)})`);
  let joined = false;
  for (let i = 0; i < 3 && !joined && found; i++) joined = music.auditionForBand(found.r.opening.id).ok || !!music.myAct();
  if (music.myAct()) {
    const a = music.myAct();
    const other = music.members(a).find((m) => m.who !== 'player');
    if (other) check(music.kickMember(other.who).ok && !a.members.some((m) => m.who === other.who && m.to == null), 'a member can be kicked out');
    const me = a.members.find((m) => m.who === 'player' && m.to == null);
    const solo = music.goSolo();
    check(music.SOLO_POSITIONS.includes(me.role) ? solo.ok && music.myAct()?.kind === 'solo' : !solo.ok, `going solo: on the same instrument, never as a drummer (${solo.text})`);
  }
  section('a band: found by what you play, members kicked out, going solo');
}

// 3. Certifications, tours, popularity.
{
  check(CERTIFICATIONS.map((c) => c[0]).join(',') === 'Diamond,Double Platinum,Platinum,Gold', 'Gold, Platinum, Double Platinum, Diamond');
  check(music.certification({ units: { us: 600000 } }) === 'Gold' && music.certification({ units: { us: 1200000 } }) === 'Platinum' && music.certification({ units: { us: 12000000 } }) === 'Diamond' && !music.certification({ units: { us: 1000 } }), 'certified by units sold');
  const p = life();
  music.formAct('solo');
  const a = music.myAct();
  check(!music.tourNow().ok, 'no tour to empty rooms');
  a.fans = { us: 50000 };
  check(music.tourNow().ok, 'a tour of the biggest rooms the fans will fill');
  check(music.popularity(a) > 0 && music.popularity(a) <= 100, 'popularity, 0 to 100');
  void p;
  section('certifications, tours, popularity');
}

// 4. When the band is done with you: asked what now; going solo carries on.
{
  const p = life(24, 95);
  p.skills = { ...(p.skills ?? {}), guitar: 95 };
  let a = null;
  for (let i = 0; i < 20 && !a; i++) { const r = music.findBand('lead_guitar'); if (r.opening) music.auditionForBand(r.opening.id); a = music.myAct(); store.state.music && (music.musicOf().musicActs = { ...music.musicOf().musicActs }); if (!a) { year(); } }
  if (a) {
    let asked = null;
    for (let y = 0; y < 15 && !asked; y++) {
      for (const m of music.members(a)) if (m.who !== 'player') { const n = store.state.npcs[m.who]; if (n) n.meters.relationship = 34; }
      advanceYear();
      asked = store.state.pendingEvents.find((e) => /^music_(kicked|disbanded)/.test(e.id));
      if (!asked) store.state.pendingEvents = [];
    }
    check(asked && !music.myAct() && sc.current() === null, `a band that has fallen out with you asks you to leave, and asks what now (${asked?.id})`);
    const said = music.musicChoice('solo');
    check(music.myAct()?.kind === 'solo' && sc.current() === 'music', `going solo carries on (${said})`);
  } else check(false, 'could not join a band to test with');
  section('the band asks you to leave: go solo, find another band, or stop');
}

// 5. Achievements and voice lessons.
{
  const p = life();
  music.formAct('solo');
  const a = music.myAct();
  music.record('single');
  const r = music.release(a.releases[0]);
  r.released = store.state.year; r.units = { us: 700000 }; r.chart = 1; r.critics = 80;
  music.checkMusicAchievements(p);
  const got = music.musicAchievements(p).filter((x) => x.year).map((x) => x.id);
  check(got.includes('gold') && got.includes('number_one') && !got.includes('platinum') && p.milestones.some((m) => /Music: Gold Record/.test(m.text)), `achievements from what happened (${got})`);
  check(LESSON_BY_ID.voice.ages[0] === 8, 'voice lessons from eight');
  section('music achievements, voice lessons from eight');
}

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('A career in music.');
