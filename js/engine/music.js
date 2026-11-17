// Music: acts (a solo artist, or a band of persistent people), songs written
// from real skill, releases with their own reception and charts, gigs and
// tours with real dates and takings, record deals with advances that have to
// be earned back, royalties that tail off, and rival acts doing all of it too.
//
//   state.ent.acts:     { id: Act }       Act: { id, name, genre, kind:'solo'|'band', countryId, formed, members:[{ who, role, from, to }],
//                                                status:'active'|'hiatus'|'split', fans:{ cc: n }, deal, releases[], tours[], history[], npc }
//   state.ent.releases: { id: Release }   Release: { id, title, actId, type, songs, quality, made, released, labelId, units:{cc:n}, critics,
//                                                     chart, revenue[{year, gross, toAct}], paid[], first, share }
//   state.ent.tours:    { id: Tour }      Tour: { id, actId, title, scale, year, dates:[{ countryId, city, capacity, sold, gross }], cost, net, weeks, status }
//   p.fame.acts:  [actIds]  every act the player has been in;  p.fame.songs: [{ q, written }]  songs not yet released
//
// Money: an act's takings are split between its members; the player's share
// is paid through payroll, once per source per year. A label's advance is paid
// once, and the act's royalties go to paying it back before anything more is paid.
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage, uid } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { MUSIC_GENRES, BAND_WORDS, SONG_WORDS, RELEASE_TYPES, VENUES, LABEL_NAMES, MUSIC_DEAL, ORG_WORDS } from '../data/fame.js';
import { makeNpc } from './npcFactory.js';
import { resolve } from './conditions.js';
import { levelOf } from './skills.js';
import { ent, workOf, orgsOf, article, commitments } from './entertainment.js';
import { gain, regard, exists } from './fame.js';
import { registerEmployer } from './employers.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
const K = (base, c = country()) => Math.round(localWage(base, c));
const M = () => { const E = ent(); E.acts ??= {}; E.releases ??= {}; E.tours ??= {}; E.musicians ??= {}; E.labels ??= {}; return E; };
const nextId = (prefix) => `${prefix}_${(ent().seq += 1).toString(36)}`;
export const act = (id) => M().acts[id] ?? null;
export const release = (id) => M().releases[id] ?? null;
export const tour = (id) => M().tours[id] ?? null;
const fanTotal = (a) => Object.values(a.fans).reduce((s, v) => s + v, 0);
const members = (a, y = year()) => a.members.filter((m) => m.from <= y && (m.to == null || m.to >= y));

function musicOf(p = player()) {
  const f = workOf(p);
  f.acts ??= [];
  f.songs ??= [];
  f.musicActs ??= { age: null, gigs: 0, writes: 0 };
  if (f.musicActs.age !== p.age) f.musicActs = { age: p.age, gigs: 0, writes: 0 };
  return f;
}
/** The act the player is in now, if any. */
export const myAct = (p = player()) => musicOf(p).acts.map(act).find((a) => a && a.status !== 'split' && a.members.some((m) => m.who === 'player' && m.to == null)) ?? null;

// ---------- Skill ----------

/** How well someone writes songs, and performs them. */
export const songwriting = (p = player()) => Math.round(p.talents.music * 0.5 + levelOf('writing') * 0.3 + p.talents.singing * 0.2);
export const performing = (p = player()) => Math.round(Math.max(p.talents.singing, p.talents.music) * 0.7 + Math.min(p.talents.singing, p.talents.music) * 0.3);
const npcPerf = (n) => { const s = n?.flags.star?.skill ?? {}; return Math.round(((s.singing ?? 50) + (s.music ?? s.acting ?? 50)) / 2); };
function actPerf(a) {
  const ms = members(a);
  if (!ms.length) return 40;
  return Math.round(ms.reduce((s, m) => s + (m.who === 'player' ? performing() : npcPerf(store.state.npcs[m.who])), 0) / ms.length);
}

// ---------- People and labels ----------

function musician(countryId, o = {}) {
  const age = o.age ?? rng.int(18, 50);
  const n = makeNpc({ role: 'performer', countryId, age, relationship: rng.int(40, 60) });
  const base = clamp(rng.around(o.level ?? 55, 15), 20, 96);
  n.flags.star = { skill: { singing: Math.round(clamp(base + rng.int(-15, 10))), music: Math.round(clamp(base + rng.int(-8, 8))), acting: 40, dance: 40, charm: Math.round(base) },
    born: year() - age, fame: 0, credits: [], kind: 'musician' };
  n.occupation = 'musician';
  store.state.npcs[n.id] = n;
  return n;
}
/** Musicians looking for a band, in a country. */
export function musicians(countryId) {
  const E = M();
  const alive = (E.musicians[countryId] ?? []).filter((id) => store.state.npcs[id]?.alive);
  while (alive.length < 14) alive.push(musician(countryId).id);
  E.musicians[countryId] = alive;
  return alive.map((id) => store.state.npcs[id]);
}
/** A country's record labels, made once. */
export function labels(countryId) {
  const E = M();
  if (!E.labels[countryId]) {
    const c = COUNTRIES[countryId];
    E.labels[countryId] = ['major', 'major', 'indie', 'indie'].map((tier, i) => {
      const city = i < 2 ? (c.place?.capital ?? c.cities[0]) : rng.pick(c.cities);
      const name = rng.pick(LABEL_NAMES).replace('{W}', rng.pick(ORG_WORDS)).replace('{C}', city).replace('{S}', rng.pick(c.names.last));
      const e = registerEmployer({ name, family: 'arts', tracks: ['music_prod', 'marketing'], countryId, city, owned: false });
      const o = { id: nextId('org'), kind: 'label', name, countryId, city, tier, founded: year() - rng.int(3, 60), reputation: tier === 'major' ? rng.int(65, 90) : rng.int(35, 70), employerId: e.id, staff: [], history: [] };
      E.orgs[o.id] = o;
      (E.byCountry[countryId] ??= []).push(o.id);
      return o.id;
    });
  }
  return E.labels[countryId].map((id) => ent().orgs[id]);
}

// ---------- Acts ----------

const actName = () => (rng.chance(0.5) ? `The ${rng.pick(BAND_WORDS.a)} ${rng.pick(BAND_WORDS.b)}` : `${rng.pick(BAND_WORDS.a)} ${rng.pick(BAND_WORDS.b)}`);

/** Starts a solo career, or a band with chosen musicians. */
export function formAct(kind, o = {}) {
  const p = player();
  const f = musicOf(p);
  if (!exists('concert')) return result(false, 'There is no way to make a living from music here yet.', 'neutral');
  if (p.age < 12) return result(false, 'You are too young to form an act.', 'neutral');
  if (myAct(p)) return result(false, `You are already in ${myAct(p).name}.`, 'neutral');
  const E = M();
  const a = { id: nextId('act'), name: kind === 'solo' ? `${p.firstName} ${p.lastName}` : (o.name || actName()).slice(0, 40), genre: o.genre ?? rng.pick(MUSIC_GENRES), kind, countryId: p.countryId,
    formed: year(), members: [{ who: 'player', role: kind === 'solo' ? 'solo' : 'vocals', from: year(), to: null }], status: 'active', fans: { [p.countryId]: 20 }, deal: null, releases: [], tours: [], history: [], npc: false };
  for (const id of o.with ?? []) a.members.push({ who: id, role: rng.pick(['guitar', 'bass', 'drums', 'keys']), from: year(), to: null });
  for (const m of a.members) if (m.who !== 'player') bringIn(store.state.npcs[m.who], a);
  E.acts[a.id] = a;
  f.acts.push(a.id);
  a.history.push({ year: year(), text: kind === 'solo' ? `${a.name} began performing.` : `${a.name} was formed.` });
  milestone(kind === 'solo' ? 'Started performing your own music.' : `Formed a band: ${a.name}.`, 'fame');
  return result(true, kind === 'solo' ? 'You start performing as yourself. A notebook of songs, a few open-mic nights, and a long road.' : `${a.name} is a band. You rehearse in someone's garage, too loudly.`);
}

function bringIn(n, a) {
  const p = player();
  if (!n) return;
  if (!p.npcIds.includes(n.id)) { n.role = 'colleague'; p.npcIds.push(n.id); }
  n.flags.title = `In ${a.name} with you`;
  n.flags.workedWith = a.name;
  n.age = year() - (n.flags.star?.born ?? year() - n.age);
  n.lastInteractionAge = p.age;
}

/** Takes on a new member (from the musicians looking for a band). */
export function addMember(npcId) {
  const a = myAct();
  if (!a || a.kind !== 'band') return result(false, 'You need a band first.', 'neutral');
  if (members(a).length >= 6) return result(false, 'The band is big enough.', 'neutral');
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'They are not available.', 'neutral');
  a.members.push({ who: n.id, role: rng.pick(['guitar', 'bass', 'drums', 'keys', 'backing vocals']), from: year(), to: null });
  bringIn(n, a);
  a.history.push({ year: year(), text: `${n.firstName} ${n.lastName} joined.` });
  return result(true, `${n.firstName} ${n.lastName} joins ${a.name}.`);
}

/** Leaves the act. Its history, members and releases are kept; a band carries on without you if enough of it is left. */
export function leaveAct() {
  const a = myAct();
  if (!a) return result(false, 'You are not in an act.', 'neutral');
  const me = a.members.find((m) => m.who === 'player' && m.to == null);
  me.to = year();
  const left = members(a).filter((m) => m.who !== 'player');
  if (a.kind === 'solo' || left.length < 2) { a.status = 'split'; a.history.push({ year: year(), text: a.kind === 'solo' ? 'Stopped performing.' : `${a.name} split up.` }); }
  else { a.history.push({ year: year(), text: 'You left the band.' }); a.npc = true; }
  return result(true, a.status === 'split' ? `${a.name} is over. The records are still the records.` : `You leave ${a.name}. They carry on without you.`, 'neutral');
}

export function hiatus(on) {
  const a = myAct();
  if (!a) return result(false, 'You are not in an act.', 'neutral');
  a.status = on ? 'hiatus' : 'active';
  a.history.push({ year: year(), text: on ? 'Went on hiatus.' : 'Came back from hiatus.' });
  return result(true, on ? `${a.name} takes a break. Nobody says how long for.` : `${a.name} is back.`, 'neutral');
}

/** Gets an old band back together, if enough of them are alive and willing. */
export function reunite(actId) {
  const p = player();
  const a = act(actId);
  if (!a || a.status !== 'split' || !musicOf(p).acts.includes(actId)) return result(false, 'There is nothing to reunite.', 'neutral');
  if (myAct(p)) return result(false, 'Leave your current act first.', 'neutral');
  const old = [...new Set(a.members.filter((m) => m.who !== 'player').map((m) => m.who))].map((id) => store.state.npcs[id]).filter((n) => n?.alive);
  const willing = old.filter((n) => rng.chance(clamp(0.3 + (n.meters.relationship - 50) / 80, 0.05, 0.9)));
  if (a.kind === 'band' && willing.length < 1) return result(false, 'You ring round. Nobody is interested.');
  a.status = 'active';
  a.members.push({ who: 'player', role: a.kind === 'solo' ? 'solo' : 'vocals', from: year(), to: null });
  for (const n of willing) a.members.push({ who: n.id, role: 'band', from: year(), to: null });
  a.history.push({ year: year(), text: `${a.name} got back together.` });
  milestone(`${a.name} reunited.`, 'fame');
  return result(true, `${a.name} is back${willing.length ? `, with ${willing.map((n) => n.firstName).join(' and ')}` : ''}.`);
}

// ---------- Songs and releases ----------

/** Writes a song. Two a year at most: songs take time. */
export function writeSong() {
  const p = player();
  const f = musicOf(p);
  if (!myAct(p)) return result(false, 'Form an act first, solo or a band.', 'neutral');
  if (f.musicActs.writes >= 2) return result(false, 'You have written what you have in you this year.', 'neutral');
  f.musicActs.writes += 1;
  const q = Math.round(clamp(songwriting(p) + rng.around(0, 14)));
  f.songs.push({ q, written: year() });
  p.talents.music = clamp(p.talents.music + 0.5);
  return result(true, q >= 80 ? 'You write something you know is good the moment it is finished.' : q >= 55 ? 'A solid song. It will find its place.' : 'A song. Not every song is a good one.');
}

const songTitle = () => `${rng.pick(SONG_WORDS.a)} ${rng.pick(SONG_WORDS.b)}`;
/** A title the act has not used before. */
function freshTitle(a, long) {
  const used = new Set(a.releases.map((id) => release(id)?.title));
  for (let i = 0; i < 40; i++) { const t = long && rng.chance(0.5) ? `${songTitle()} and Other Songs` : songTitle(); if (!used.has(t)) return t; }
  return `${songTitle()} (${year()})`;
}

/** Records and puts out a release from the best songs the player has. It comes out at the turn of the year. */
export function record(type) {
  const p = player();
  const f = musicOf(p);
  const a = myAct(p);
  const t = RELEASE_TYPES[type];
  if (!a || a.status !== 'active') return result(false, 'You need an active act.', 'neutral');
  if (!exists('recording')) return result(false, 'Music cannot be recorded yet.', 'neutral');
  if (f.songs.length < t.songs) return result(false, `${{ single: 'A single', ep: 'An EP', album: 'An album' }[type]} needs ${t.songs} ${t.songs === 1 ? 'song' : 'songs'}; you have ${f.songs.length} ready.`, 'neutral');
  if (Object.values(M().releases).some((r) => r.actId === a.id && r.made === year())) return result(false, 'You are already recording this year.', 'neutral');
  const label = a.deal ? ent().orgs[a.deal.labelId] : null;
  const cost = label ? 0 : K(t.cost);
  if (p.finance.cash < cost) return result(false, `Recording it yourself costs ${fmtMoney(cost, country())}.`, 'neutral');
  p.finance.cash -= cost;
  const songs = f.songs.sort((x, y) => y.q - x.q).splice(0, t.songs);
  const quality = Math.round(songs.reduce((s, x) => s + x.q, 0) / songs.length * 0.65 + actPerf(a) * 0.35);
  const r = { id: nextId('rel'), title: freshTitle(a, type !== 'single'), actId: a.id, type, songs: t.songs, quality,
    made: year(), released: null, labelId: label?.id ?? null, units: {}, critics: null, chart: null, revenue: [], paid: [], first: !a.releases.length, share: 1 / Math.max(1, members(a).length) };
  M().releases[r.id] = r;
  a.releases.push(r.id);
  return result(true, `You record ${r.title}. ${label ? `${label.name} will put it out.` : 'You put it out yourself.'} It comes out at the turn of the year.`);
}

/** A gig in town: a little money, a few more people who know the songs. */
export function gig() {
  const p = player();
  const f = musicOf(p);
  const a = myAct(p);
  if (!a || a.status !== 'active') return result(false, 'You need an active act.', 'neutral');
  if (f.musicActs.gigs >= 4) return result(false, 'You have played what you can around your other commitments this year.', 'neutral');
  f.musicActs.gigs += 1;
  const venue = fanTotal(a) >= VENUES.club.fans ? VENUES.club : VENUES.bar;
  const crowd = Math.round(Math.min(venue.capacity, 15 + (a.fans[p.countryId] ?? 0) * 0.04 + rng.int(0, 40)));
  const good = rng.chance(clamp(0.4 + (actPerf(a) - 50) / 80, 0.1, 0.95));
  const pay = Math.round(K(venue.price * crowd * 0.5) * (a.kind === 'band' ? 1 / members(a).length : 1));
  p.finance.cash += pay;
  p.finance.lifetimeEarned += pay;
  a.fans[p.countryId] = Math.round((a.fans[p.countryId] ?? 0) + crowd * (good ? 0.3 : 0.08));
  gain({ audience: 'music', amount: good ? 0.5 : 0.1, why: 'a gig' }, p);
  return result(good, good ? `You play to ${crowd} people, and they want an encore. Your share: ${fmtMoney(pay, country())}.` : `${crowd} people, most of them talking. Your share: ${fmtMoney(pay, country())}.`);
}

// ---------- Tours ----------

/** Where an act could tour, at a scale: places with enough fans. */
export function tourPlaces(a, scale) {
  const v = VENUES[scale];
  return Object.entries(a.fans).filter(([, n]) => n >= v.fans * 0.25).map(([cc]) => cc).filter((cc) => COUNTRIES[cc]);
}

/** Plans a tour for this year. It takes weeks, and cannot clash with other work. */
export function planTour(scale, countries) {
  const p = player();
  const a = myAct(p);
  const v = VENUES[scale];
  if (!a || a.status !== 'active') return result(false, 'You need an active act.', 'neutral');
  if (fanTotal(a) < v.fans) return result(false, `${v.name} need about ${v.fans.toLocaleString('en-US')} fans; you have ${fanTotal(a).toLocaleString('en-US')}.`, 'neutral');
  if (Object.values(M().tours).some((t) => t.actId === a.id && t.year === year())) return result(false, 'You are already touring this year.', 'neutral');
  const busy = commitments(year(), p).filter((x) => ['stage', 'musical', 'tv'].includes(x.kind));
  if (busy.length) return result(false, `You are committed to ${busy[0].title} this year.`, 'neutral');
  const places = (countries?.length ? countries : [p.countryId]).filter((c) => tourPlaces(a, scale).includes(c) || c === p.countryId).slice(0, 6);
  // Dates run one after another, city to city: never two shows on one night in two places.
  const dates = places.flatMap((cc) => COUNTRIES[cc].cities.slice(0, cc === p.countryId ? 5 : 2).map((city) => ({ countryId: cc, city, capacity: v.capacity, sold: null, gross: null })));
  const t = { id: nextId('tour'), actId: a.id, title: `${a.name}: ${rng.pick(SONG_WORDS.a)} ${rng.pick(SONG_WORDS.b)} Tour`, scale, year: year(), dates, cost: null, net: null, weeks: Math.ceil(dates.length / 3), status: 'booked', paid: [] };
  M().tours[t.id] = t;
  a.tours.push(t.id);
  return result(true, `${t.title}: ${dates.length} dates in ${[...new Set(dates.map((d) => d.countryId))].map((c) => COUNTRIES[c].name).join(', ')}, over about ${t.weeks} weeks. The shows happen this year; the takings are counted at the end of it.`);
}

/** Weeks of the year the player's tours take. */
export const tourWeeks = (y = year(), p = player()) => Object.values(M().tours).filter((t) => t.year === y && musicOf(p).acts.includes(t.actId) && members(act(t.actId), y).some((m) => m.who === 'player')).reduce((s, t) => s + t.weeks, 0);

function runTour(t) {
  const a = act(t.actId);
  const v = VENUES[t.scale];
  let gross = 0;
  for (const d of t.dates) {
    const here = a.fans[d.countryId] ?? 0;
    const perCity = here / Math.max(1, t.dates.filter((x) => x.countryId === d.countryId).length);
    const want = perCity * (0.08 + rng.next() * 0.1) + rng.int(0, 60);
    d.sold = Math.round(Math.min(d.capacity, want));
    d.gross = Math.round(localWage(v.price, COUNTRIES[d.countryId]) * d.sold);
    gross += Math.round(d.gross * (COUNTRIES[t.dates[0].countryId] === COUNTRIES[d.countryId] ? 1 : 1));
    a.fans[d.countryId] = Math.round(here + d.sold * 0.35);
  }
  const homeC = COUNTRIES[a.countryId];
  t.cost = Math.round(localWage(v.cost, homeC) * t.dates.length);
  t.gross = gross;
  t.net = gross - t.cost;
  t.status = 'done';
  return t;
}

// ---------- Record deals ----------

/** Offers from labels, made once a year for an act people are listening to. */
function maybeDealOffer(a) {
  if (a.deal || a.npc || a.status !== 'active') return;
  const fans = fanTotal(a);
  if (fans < 2500 || !rng.chance(clamp(fans / 60000, 0.05, 0.6))) return;
  const ls = labels(a.countryId);
  const l = fans > 40000 ? ls.find((x) => x.tier === 'major') : rng.pick(ls);
  const c = COUNTRIES[a.countryId];
  a.offer = { labelId: l.id, advance: Math.round(localWage(Math.min(400000, 3000 + fans * 0.9), c)), royalty: Math.round((MUSIC_DEAL.royalty[0] + rng.next() * (MUSIC_DEAL.royalty[1] - MUSIC_DEAL.royalty[0])) * 100) / 100,
    albums: rng.int(2, 3), year: year(), asked: false, lawyer: false };
  a.history.push({ year: year(), text: `${l.name} offered a record deal.` });
}

/** A lawyer reads the offer: what it means, and whether it is ordinary. */
export function lawyer() {
  const p = player();
  const a = myAct(p);
  if (!a?.offer) return result(false, 'There is no offer to read.', 'neutral');
  const fee = K(1200);
  if (p.finance.cash < fee) return result(false, `A lawyer would cost ${fmtMoney(fee, country())}.`, 'neutral');
  p.finance.cash -= fee;
  a.offer.lawyer = true;
  const o = a.offer;
  const fair = o.royalty >= 0.18 ? 'better than most' : o.royalty >= 0.16 ? 'ordinary' : 'on the low side';
  return result(true, `The lawyer reads it for ${fmtMoney(fee, country())}: ${Math.round(o.royalty * 100)}% royalties, which is ${fair}; ${o.albums} albums owed; the label owns the recordings. The ${fmtMoney(o.advance, COUNTRIES[a.countryId])} advance is paid back out of your royalties before you see any more.`, 'neutral');
}

export function negotiateDeal() {
  const a = myAct();
  if (!a?.offer || a.offer.asked) return result(false, a?.offer ? 'You have already asked.' : 'There is no offer.', 'neutral');
  a.offer.asked = true;
  if (rng.chance(0.08)) { a.offer = null; return result(false, 'The label lost interest.'); }
  if (!rng.chance(a.offer.lawyer ? 0.6 : 0.35)) return result(false, '"Those are our terms."', 'neutral');
  a.offer.royalty = Math.round((a.offer.royalty + 0.02) * 100) / 100;
  return result(true, `They move to ${Math.round(a.offer.royalty * 100)}% royalties.`);
}

export function signDeal() {
  const p = player();
  const a = myAct(p);
  if (!a?.offer) return result(false, 'There is no offer.', 'neutral');
  const o = a.offer;
  a.deal = { labelId: o.labelId, royalty: o.royalty, albumsOwed: o.albums, advance: o.advance, unrecouped: o.advance, signed: year(), advancePaid: false };
  a.offer = null;
  const l = ent().orgs[o.labelId];
  a.history.push({ year: year(), text: `Signed to ${l.name}.` });
  milestone(`Signed a record deal with ${l.name}.`, 'fame');
  return result(true, `${a.name} is signed to ${l.name}. The advance is paid with this year's income; your royalties pay it back first.`);
}
export function declineDeal() { const a = myAct(); if (a) a.offer = null; return result(true, 'You stay independent.', 'neutral'); }

// ---------- Pay ----------

/** The player's share of everything their acts earned in the year just lived, once each. */
export function musicLines(p = player()) {
  const lived = year() - 1;
  const out = [];
  for (const id of musicOf(p).acts) {
    const a = act(id);
    if (!a) continue;
    const mine = (y) => a.members.some((m) => m.who === 'player' && m.from <= y && (m.to == null || m.to >= y));
    // The advance, once.
    if (a.deal && !a.deal.advancePaid && a.deal.signed === lived && mine(lived)) out.push({ source: `adv:${a.id}`, label: `Advance from ${ent().orgs[a.deal.labelId]?.name}`, gross: Math.round(a.deal.advance / Math.max(1, members(a, lived).length)), act: a.id, kind: 'advance' });
    // Royalties: each release's share of what it earned that year, after the advance is paid back.
    for (const rid of a.releases) {
      const r = release(rid);
      const e = r?.revenue.find((x) => x.year === lived);
      if (!e || !e.toAct || r.paid.includes(lived) || !mine(r.made)) continue;
      out.push({ source: `roy:${r.id}:${lived}`, label: `Royalties: ${r.title}`, gross: Math.round(e.toAct * r.share), release: r.id, year: lived });
    }
    for (const tid of a.tours) {
      const t = tour(tid);
      if (!t || t.year !== lived || t.paid.includes(lived) || !mine(lived) || t.net <= 0) continue;
      out.push({ source: `tour:${t.id}`, label: `${t.title}`, gross: Math.round(t.net / Math.max(1, members(a, lived).length)), tour: t.id });
    }
  }
  return out;
}
export function markMusicPaid(p = player()) {
  const lived = year() - 1;
  for (const id of musicOf(p).acts) {
    const a = act(id);
    if (!a) continue;
    if (a.deal && a.deal.signed === lived) a.deal.advancePaid = true;
    for (const rid of a.releases) { const r = release(rid); if (r && r.revenue.some((x) => x.year === lived) && !r.paid.includes(lived)) r.paid.push(lived); }
    for (const tid of a.tours) { const t = tour(tid); if (t && t.year === lived && !t.paid.includes(lived)) t.paid.push(lived); }
  }
}

// ---------- The year ----------

/** A release comes out: judged once, charted once, earning from then on. */
function releaseNow(r) {
  const a = act(r.actId);
  const label = ent().orgs[r.labelId];
  r.released = year();
  r.critics = Math.round(clamp(r.quality + rng.around(0, 10)));
  const fans = fanTotal(a);
  const push = label ? (label.tier === 'major' ? 2.2 : 1.4) : 1;
  const typeK = { single: 0.6, ep: 0.8, album: 1 }[r.type];
  const reach = label?.tier === 'major' ? COUNTRIES[a.countryId] && Object.keys(COUNTRIES).filter((c) => c !== a.countryId).sort(() => rng.next() - 0.5).slice(0, rng.int(2, 8)) : [];
  const home = Math.round((fans * (0.2 + r.quality / 200) + (r.quality ** 2) * 0.6 * push) * typeK * rng.around(1, 0.3));
  r.units = { [a.countryId]: home };
  for (const c of reach) r.units[c] = Math.round(home * (0.05 + rng.next() * 0.2) * (r.quality / 80));
  for (const [c, n] of Object.entries(r.units)) a.fans[c] = Math.round((a.fans[c] ?? 0) + n * 0.25);
  return reach;
}

/** What each release earns this year; most of it in the first, then less each year. */
function earn(r) {
  const a = act(r.actId);
  const age = year() - r.released;
  const total = Object.entries(r.units).reduce((s, [c, n]) => s + localWage(MUSIC_DEAL.unitValue, COUNTRIES[c]) * n, 0);
  const gross = Math.round(total * (age === 0 ? 1 : 0.35 * Math.pow(0.6, age - 1)));
  if (gross < localWage(20, COUNTRIES[a.countryId]) && age > 0) return; // the catalogue's tail, too small to count
  let toAct = r.labelId ? Math.round(gross * (a.deal?.royalty ?? 0.16)) : Math.round(gross * MUSIC_DEAL.independent);
  if (r.labelId && a.deal && a.deal.unrecouped > 0) { const back = Math.min(a.deal.unrecouped, toAct); a.deal.unrecouped -= back; toAct -= back; }
  r.revenue.push({ year: year() - 1, gross, toAct });
}

function charts(countryId) {
  const out = Object.values(M().releases).filter((r) => r.released === year() && act(r.actId)?.countryId === countryId).sort((x, y) => (y.units[countryId] ?? 0) - (x.units[countryId] ?? 0));
  out.forEach((r, i) => { if (i < 40) r.chart = i + 1; });
}

/** Rival acts make records too: a crowded field, a few of them very good and very popular. */
function rivals(countryId) {
  const E = M();
  const theirs = Object.values(E.acts).filter((a) => a.npc && a.countryId === countryId && a.status === 'active' && !members(a).some((m) => m.who === 'player'));
  for (let i = theirs.filter((a) => !a.members.some((m) => m.who === 'player')).length; i < 24; i++) {
    const level = rng.pick([50, 58, 66, 74, 82, 90]);
    const lead = musician(countryId, { level });
    const solo = rng.chance(0.4);
    const a = { id: nextId('act'), name: solo ? `${lead.firstName} ${lead.lastName}` : actName(), genre: rng.pick(MUSIC_GENRES), kind: solo ? 'solo' : 'band', countryId, formed: year() - rng.int(0, 15),
      members: [{ who: lead.id, role: solo ? 'solo' : 'vocals', from: year(), to: null }], status: 'active', fans: { [countryId]: Math.round(10 ** rng.around(2.5 + level / 25, 0.6)) }, deal: null, releases: [], tours: [], history: [], npc: true };
    E.acts[a.id] = a;
    theirs.push(a);
  }
  for (const a of theirs) {
    // Acts fade: a few stop each year, and new ones take their place next year.
    if (rng.chance(0.04)) { a.status = 'split'; continue; }
    if (!rng.chance(0.6)) continue;
    const type = rng.pick(['single', 'single', 'ep', 'album', 'album']);
    const lead = members(a).find((m) => m.who !== 'player');
    if (!lead) { a.status = 'split'; continue; }
    const q = Math.round(clamp(npcPerf(store.state.npcs[lead.who]) + rng.around(0, 10)));
    const big = fanTotal(a) > 50000;
    const r = { id: nextId('rel'), title: freshTitle(a, type !== 'single'), actId: a.id, type, songs: RELEASE_TYPES[type].songs, quality: q, made: year() - 1, released: null, labelId: big || rng.chance(0.5) ? labels(countryId)[big ? 0 : rng.int(0, 3)].id : null,
      units: {}, critics: null, chart: null, revenue: [], paid: [], first: !a.releases.length, share: 1 };
    E.releases[r.id] = r;
    a.releases.push(r.id);
  }
}

/** Once a year, before payroll. @returns {string[]} */
export function tickMusic() {
  const p = player();
  const E = M();
  const lines = [];
  if (!exists('concert')) return lines;
  rivals(p.countryId);
  // Releases recorded last year come out.
  for (const r of Object.values(E.releases)) {
    if (r.released != null || r.made >= year()) continue;
    const reach = releaseNow(r);
    const a = act(r.actId);
    const mine = musicOf(p).acts.includes(a.id) && a.members.some((m) => m.who === 'player' && m.from <= r.made);
    if (mine) {
      const units = Object.values(r.units).reduce((s, n) => s + n, 0);
      gain({ audience: 'music', amount: Math.min(25, Math.sqrt(units) / 8) * (0.5 + r.critics / 100), abroad: Object.keys(r.units).filter((c) => c !== a.countryId), reach: 0.4, lasting: 0.25, why: r.title }, p);
      regard({ credibility: (r.critics - 60) / 10, why: r.title }, p);
      article({ kind: 'review', about: 'player', accuracy: 'verified', text: `${a.name}, ${r.title}: ${r.critics >= 75 ? 'a record that will last' : r.critics >= 55 ? 'well worth a listen' : r.critics >= 40 ? 'patchy' : 'a misstep'}.` });
      if (r.labelId && a.deal && r.type === 'album') a.deal.albumsOwed = Math.max(0, a.deal.albumsOwed - 1);
      lines.push(`${r.title} is out. ${r.critics >= 70 ? 'Critics love it' : r.critics >= 50 ? 'Critics are warm' : 'Critics are cool'}; ${units.toLocaleString('en-US')} people bought or streamed it in its first weeks${reach.length ? `, in ${reach.length + 1} countries` : ''}.`);
      if (r.first) milestone(`Released your first record: ${r.title}.`, 'fame');
    }
  }
  charts(p.countryId);
  for (const r of Object.values(E.releases)) {
    const a = act(r.actId);
    if (r.released != null && r.released <= year() && musicOf(p).acts.includes(r.actId)) earn(r); // only the player's acts' money is followed
    if (r.chart && r.released === year() && musicOf(p).acts.includes(a.id) && a.members.some((m) => m.who === 'player' && m.from <= r.made)) {
      lines.push(`${r.title} entered the chart at number ${r.chart}.`);
      if (!p.milestones.some((m) => /entered the chart/.test(m.text))) milestone(`${r.title} entered the chart at number ${r.chart}.`, 'fame');
    }
  }
  // Tours played last year are counted.
  for (const t of Object.values(E.tours)) {
    if (t.status !== 'booked' || t.year >= year()) continue;
    runTour(t);
    const a = act(t.actId);
    if (musicOf(p).acts.includes(a.id)) {
      const sold = t.dates.reduce((s, d) => s + d.sold, 0);
      lines.push(`${t.title}: ${t.dates.length} shows, ${sold.toLocaleString('en-US')} tickets sold, ${t.net >= 0 ? `${fmtMoney(t.net, COUNTRIES[a.countryId])} made` : `${fmtMoney(-t.net, COUNTRIES[a.countryId])} lost`} after costs.`);
      gain({ audience: 'music', amount: Math.min(12, Math.sqrt(sold) / 12), abroad: [...new Set(t.dates.map((d) => d.countryId))].filter((c) => c !== a.countryId), reach: 0.6, lasting: 0.15, why: t.title }, p);
      // A loss comes out of the members' pockets.
      if (t.net < 0) p.finance.cash += Math.round(t.net / Math.max(1, members(a, t.year).length));
      if (!p.milestones.some((m) => /tour/i.test(m.text))) milestone(`Toured: ${t.title}.`, 'fame');
    }
  }
  // Bands are people: some fall out, some leave.
  const a = myAct(p);
  if (a?.kind === 'band') {
    for (const m of members(a).filter((x) => x.who !== 'player')) {
      const n = store.state.npcs[m.who];
      if (!n?.alive) { m.to = year(); continue; }
      if (n.meters.relationship < 30 || rng.chance(0.04)) {
        m.to = year();
        a.history.push({ year: year(), text: `${n.firstName} ${n.lastName} left.` });
        lines.push(`${n.firstName} ${n.lastName} has left ${a.name}${n.meters.relationship < 30 ? ' after one argument too many' : ' to do something else'}.`);
      }
    }
    if (members(a).length < 2) { a.status = 'split'; a.history.push({ year: year(), text: `${a.name} split up.` }); lines.push(`${a.name} is finished. The records are still the records.`); }
  }
  if (a) maybeDealOffer(a);
  // A deal ends when its albums are delivered.
  if (a?.deal && a.deal.albumsOwed <= 0) { a.history.push({ year: year(), text: `Finished the deal with ${ent().orgs[a.deal.labelId]?.name}.` }); a.deal = null; lines.push(`${a.name} has delivered every album the deal asked for, and is free.`); }
  // Old rival records are forgotten; the player's acts' are kept.
  const keep = new Set(musicOf(p).acts.flatMap((id) => act(id)?.releases ?? []));
  for (const [id, r] of Object.entries(E.releases)) if (!keep.has(id) && r.released != null && r.released < year() - 4) delete E.releases[id];
  return lines;
}

/** Everything the player has recorded, oldest first. */
export const discography = (p = player()) => musicOf(p).acts.flatMap((id) => (act(id)?.releases ?? []).map(release)).filter((r) => r && r.released != null).sort((x, y) => x.released - y.released);
export { musicOf, members, fanTotal };
