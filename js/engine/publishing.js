// Books. A manuscript is written over sessions of real work, sent to
// publishers (who judge it on its quality, and on the author's name), or
// published by the author. A book comes out at the turn of the year, is
// reviewed once, sells, makes the bestseller list or not, and earns royalties
// that tail off. Rival authors publish too, and a prize judges the year.
//
//   state.ent.books[id] = { id, title, kind, genre, author:'player'|npcId|null, authorName, countryId, quality, written,
//                           status:'manuscript'|'offered'|'published', publisherId, advance, royalty, unrecouped, advancePaid,
//                           released, critics, units:{cc:n}, list (best weekly place) , revenue:[{year, gross, toAuthor}], paid:[], first, awards:[] }
//   p.fame.writing = { draft:{ kind, genre, sessions, q } | null, books:[ids], acts:{ age, sessions } }
//
// Money: an advance once, then royalties after the advance is earned back,
// each a payroll line paid once. A writer whose career is 'author' is paid by
// their books once they have one out; the career's own salary stops then.
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage } from '../util.js';
import { store, player, country, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { BOOK_GENRES, BOOK_KINDS, PUBLISHER_NAMES, BOOK_WORDS, BOOK_DEAL, ORG_WORDS } from '../data/fame.js';
import { levelOf } from './skills.js';
import { ent, workOf, article } from './entertainment.js';
import { gain, regard, fameOf, exists } from './fame.js';
import { registerEmployer } from './employers.js';
import { makeNpc } from './npcFactory.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
const B = () => { const E = ent(); E.books ??= {}; E.publishers ??= {}; return E; };
const nextId = (pre) => `${pre}_${(ent().seq += 1).toString(36)}`;
export const book = (id) => B().books[id] ?? null;
const units = (b) => Object.values(b.units).reduce((s, n) => s + n, 0);

export function writingOf(p = player()) {
  const f = workOf(p);
  f.writing ??= { draft: null, books: [], acts: { age: null, sessions: 0, queries: 0 } };
  if (f.writing.acts.age !== p.age) f.writing.acts = { age: p.age, sessions: 0, queries: 0 };
  return f.writing;
}
export const published = (p = player()) => writingOf(p).books.map(book).filter((b) => b?.released != null);

/** A country's publishers, made once: two big houses, two small presses. */
export function publishers(countryId) {
  const E = B();
  if (!E.publishers[countryId]) {
    const c = COUNTRIES[countryId];
    E.publishers[countryId] = ['big', 'big', 'small', 'small'].map((tier) => {
      const city = c.place?.capital ?? c.cities[0];
      const name = rng.pick(PUBLISHER_NAMES).replace('{W}', rng.pick(ORG_WORDS)).replace('{S}', rng.pick(c.names.last)).replace('{S2}', rng.pick(c.names.last)).replace('{C}', city);
      const e = registerEmployer({ name, family: 'media', tracks: ['publishing'], countryId, city, owned: false });
      const o = { id: nextId('org'), kind: 'publisher', name, countryId, city, tier, reputation: tier === 'big' ? rng.int(65, 90) : rng.int(35, 65), employerId: e.id, staff: [], history: [], founded: year() - rng.int(10, 150) };
      E.orgs[o.id] = o;
      return o.id;
    });
  }
  return E.publishers[countryId].map((id) => ent().orgs[id]);
}

/** How well the player writes: mind, practice, and the craft of writing. */
export const craft = (p = player()) => Math.round(clamp(p.stats.intellect * 0.5 + levelOf('writing') * 0.4 + (p.hidden.discipline ?? 50) * 0.1));
/** A title no book on record already has. */
function titleFor() {
  const used = new Set(Object.values(B().books).map((b) => b.title));
  for (let i = 0; i < 60; i++) { const t = `${rng.pick(BOOK_WORDS.a)} ${rng.pick(BOOK_WORDS.b)}`; if (!used.has(t)) return t; }
  return `${rng.pick(BOOK_WORDS.a)} ${rng.pick(BOOK_WORDS.b)}, ${rng.pick(BOOK_WORDS.c)}`;
}

/** Starts a manuscript. A memoir needs a life people want to read about. */
export function startDraft(kind, genre) {
  const p = player();
  const w = writingOf(p);
  if (!exists('publishing')) return result(false, 'There is no book trade yet.', 'neutral');
  if (p.age < 14) return result(false, 'You are too young to write a book anyone will publish.', 'neutral');
  if (w.draft) return result(false, 'Finish the book you are writing first.', 'neutral');
  if (!BOOK_KINDS[kind]) return result(false, 'Not a kind of book.', 'neutral');
  w.draft = { kind, genre: kind === 'memoir' ? 'memoir' : kind === 'poetry' ? 'poetry' : genre ?? rng.pick(BOOK_GENRES), sessions: 0, q: 0, started: year() };
  return result(true, kind === 'memoir' ? 'You begin to write down your life.' : `You begin a ${BOOK_KINDS[kind].name.toLowerCase()}.`, 'neutral');
}

/** A season of work on the draft. Three a year. */
export function writeSession() {
  const p = player();
  const w = writingOf(p);
  if (!w.draft) return result(false, 'Start a book first.', 'neutral');
  if (w.acts.sessions >= 3) return result(false, 'You have written all you can this year.', 'neutral');
  w.acts.sessions += 1;
  const d = w.draft;
  d.q += clamp(craft(p) + rng.around(0, 12));
  d.sessions += 1;
  p.stats.intellect = clamp(p.stats.intellect + 0.3);
  const need = BOOK_KINDS[d.kind].sessions;
  if (d.sessions < need) return result(true, `${need - d.sessions} more ${need - d.sessions === 1 ? 'season' : 'seasons'} of work before it is a book.`, 'neutral');
  const quality = Math.round(d.q / d.sessions);
  const b = { id: nextId('book'), title: titleFor(), kind: d.kind, genre: d.genre, author: 'player', authorName: `${p.firstName} ${p.lastName}`, countryId: p.countryId, quality, written: year(),
    status: 'manuscript', publisherId: null, advance: 0, royalty: 0, unrecouped: 0, advancePaid: true, released: null, critics: null, units: {}, list: null, revenue: [], paid: [], first: !published(p).length && !w.books.length, awards: [], offers: [] };
  B().books[b.id] = b;
  w.books.push(b.id);
  w.draft = null;
  milestone(`Finished writing ${b.title}.`, 'career');
  return result(true, `${b.title} is finished. ${quality >= 75 ? 'It is good, and you know it.' : quality >= 55 ? 'It is a real book.' : 'It is finished, which is something.'}`);
}

/** Sends a finished manuscript out. Publishers answer on the book, and on the name on it. */
export function submit(bookId) {
  const p = player();
  const w = writingOf(p);
  const b = book(bookId);
  if (!b || b.author !== 'player' || b.status !== 'manuscript') return result(false, 'There is nothing to send.', 'neutral');
  if (w.acts.queries >= 2) return result(false, 'You have sent it out twice this year; the answers take time.', 'neutral');
  w.acts.queries += 1;
  const f = fameOf(p);
  const name = b.kind === 'memoir' ? Math.max(f.headline ?? p.hidden.fame ?? 0, 0) : (f.audiences.literary ?? 0) * 0.6 + (p.hidden.fame ?? 0) * 0.2;
  const c = COUNTRIES[p.countryId];
  b.offers = publishers(p.countryId).filter((pub) => {
    const bar = pub.tier === 'big' ? 66 : 50;
    return rng.chance(clamp(0.2 + (b.quality + name * 0.5 - bar) / 40, 0.02, 0.92));
  }).map((pub) => ({ publisherId: pub.id, advance: Math.round(localWage((pub.tier === 'big' ? 9000 : 2500) * (1 + Math.max(0, b.quality - 55) / 15 + name / 12) * rng.around(1, 0.2), c)),
    royalty: Math.round((BOOK_DEAL.royalty[0] + rng.next() * (BOOK_DEAL.royalty[1] - BOOK_DEAL.royalty[0])) * 100) / 100 }));
  if (!b.offers.length) return result(false, b.kind === 'memoir' && name < 25 ? 'Every publisher says the same, more kindly or less: who are you?' : 'Rejections, all of them. Some are kind.');
  b.status = 'offered';
  return result(true, `${b.offers.length} ${b.offers.length === 1 ? 'publisher wants' : 'publishers want'} ${b.title}.`);
}

/** Takes an offer: the book comes out at the turn of the year. */
export function acceptOffer(bookId, publisherId) {
  const b = book(bookId);
  const o = b?.offers.find((x) => x.publisherId === publisherId);
  if (!o) return result(false, 'That offer is not open.', 'neutral');
  Object.assign(b, { status: 'published', publisherId, advance: o.advance, royalty: o.royalty, unrecouped: o.advance, advancePaid: false, signed: year(), offers: [] });
  const pub = ent().orgs[publisherId];
  milestone(`Sold ${b.title} to ${pub.name}.`, 'career');
  return result(true, `${pub.name} will publish ${b.title}. The ${fmtMoney(o.advance, country())} advance is paid with this year's income; royalties come once it is earned back.`);
}

/** Puts it out yourself: cheap, yours, and hard to find. */
export function selfPublish(bookId) {
  const p = player();
  const b = book(bookId);
  if (!b || b.author !== 'player' || !['manuscript', 'offered'].includes(b.status)) return result(false, 'There is nothing to publish.', 'neutral');
  const cost = Math.round(localWage(800, country()));
  if (p.finance.cash < cost) return result(false, `Editing and a cover cost ${fmtMoney(cost, country())}.`, 'neutral');
  p.finance.cash -= cost;
  Object.assign(b, { status: 'published', publisherId: null, offers: [], signed: year() });
  return result(true, `You publish ${b.title} yourself, for ${fmtMoney(cost, country())}. It comes out at the turn of the year.`);
}

// ---------- The year ----------

function rivals(countryId) {
  const E = B();
  const c = COUNTRIES[countryId];
  for (let i = 0; i < 14; i++) {
    const n = makeNpc({ role: 'performer', countryId, age: rng.int(28, 75) });
    const kind = rng.pick(['novel', 'novel', 'novel', 'nonfiction', 'memoir', 'poetry']);
    const b = { id: nextId('book'), title: titleFor(), kind, genre: kind === 'novel' ? rng.pick(BOOK_GENRES.filter((g) => !['memoir', 'poetry'].includes(g))) : kind, author: null, authorName: `${n.firstName} ${n.lastName}`,
      countryId, quality: Math.round(clamp(rng.around(64, 14))), written: year() - 1, status: 'published', publisherId: rng.pick(publishers(countryId)).id, released: null, critics: null, units: {}, list: null,
      revenue: [], paid: [], first: rng.chance(0.2), awards: [], reach: Math.round(10 ** rng.around(4, 0.6)) };
    E.books[b.id] = b;
  }
  void c;
}

function release(b) {
  const pub = ent().orgs[b.publisherId];
  b.released = year();
  b.critics = Math.round(clamp(b.quality + rng.around(0, 9)));
  const push = pub ? (pub.tier === 'big' ? 2.2 : 1.2) : 0.35;
  let base;
  if (b.author === 'player') {
    const p = player();
    const f = fameOf(p);
    const name = (f.audiences.literary ?? 0) + (b.kind === 'memoir' ? (p.hidden.fame ?? 0) * 1.5 : (p.hidden.fame ?? 0) * 0.3);
    base = (200 + (b.quality - 40) ** 2 * 3 + name ** 2 * 1.5) * push;
  } else base = b.reach * push * (b.quality / 60);
  b.units = { [b.countryId]: Math.round(base * rng.around(1, 0.3)) };
  if (pub?.tier === 'big' && b.critics >= 70) for (const cc of Object.keys(COUNTRIES).filter((x) => x !== b.countryId).sort(() => rng.next() - 0.5).slice(0, rng.int(1, 5))) b.units[cc] = Math.round(b.units[b.countryId] * rng.around(0.15, 0.08));
}

function earn(b) {
  const age = year() - b.released;
  const total = Object.entries(b.units).reduce((s, [cc, n]) => s + localWage(BOOK_DEAL.unitValue, COUNTRIES[cc]) * n, 0);
  const gross = Math.round(total * (age === 0 ? 1 : 0.3 * Math.pow(0.65, age - 1)));
  if (age > 0 && gross < localWage(20, COUNTRIES[b.countryId])) return;
  let toAuthor = Math.round(gross * (b.publisherId ? b.royalty : BOOK_DEAL.selfShare));
  if (b.publisherId && b.unrecouped > 0) { const back = Math.min(b.unrecouped, toAuthor); b.unrecouped -= back; toAuthor -= back; }
  b.revenue.push({ year: year() - 1, gross, toAuthor });
}

/** Once a year, before payroll. @returns {string[]} */
export function tickPublishing() {
  const p = player();
  const lines = [];
  if (!exists('publishing')) return lines;
  const E = B();
  const w = writingOf(p);
  if (w.books.length || Object.keys(E.books).length) rivals(p.countryId);
  for (const b of Object.values(E.books)) {
    if (b.status !== 'published' || b.released != null || (b.signed ?? b.written) >= year()) continue;
    release(b);
    if (b.author !== 'player') continue;
    const n = units(b);
    lines.push(`${b.title} is out. ${b.critics >= 75 ? 'The reviews are glowing' : b.critics >= 55 ? 'The reviews are kind' : b.critics >= 40 ? 'The reviews are mixed' : 'The reviews are unkind'}; ${n.toLocaleString('en-US')} copies in its first months.`);
    gain({ audience: 'literary', amount: Math.min(20, Math.sqrt(n) / 6) * (0.5 + b.critics / 100), abroad: Object.keys(b.units).filter((c) => c !== p.countryId), reach: 0.4, lasting: 0.4, why: b.title }, p);
    regard({ credibility: (b.critics - 60) / 8, why: b.title }, p);
    article({ kind: 'review', about: 'player', accuracy: 'verified', text: `${b.title}, by ${b.authorName}: ${b.critics >= 75 ? 'remarkable' : b.critics >= 55 ? 'well worth reading' : b.critics >= 40 ? 'uneven' : 'a disappointment'}.` });
    if (b.first) milestone(`Published your first book: ${b.title}.`, 'career');
    p.career.performance = clamp(Math.round((p.career.performance ?? 50) * 0.5 + b.critics * 0.5));
  }
  // The bestseller list: this year's books, by copies.
  const fresh = Object.values(E.books).filter((b) => b.released === year() && b.countryId === p.countryId).sort((a, b) => units(b) - units(a));
  fresh.slice(0, 10).forEach((b, i) => { b.list = i + 1; });
  for (const b of fresh.filter((x) => x.author === 'player' && x.list)) { lines.push(`${b.title} reached number ${b.list} on the bestseller list.`); milestone(`${b.title}: number ${b.list} on the bestseller list.`, 'fame'); }
  for (const id of w.books) { const b = book(id); if (b?.released != null) earn(b); }
  // Forget rivals' books after a few years, unless an award keeps their names on the record (seasons hold them).
  const mine = new Set(w.books);
  for (const [id, b] of Object.entries(E.books)) if (!mine.has(id) && !b.keep && b.released != null && b.released < year() - 3) delete E.books[id];
  return lines;
}

/** Payroll lines: advances, once; royalties, once a year each. */
export function bookLines(p = player()) {
  const lived = year() - 1;
  const out = [];
  for (const id of writingOf(p).books) {
    const b = book(id);
    if (!b) continue;
    if (b.publisherId && !b.advancePaid && b.signed === lived) out.push({ source: `badv:${b.id}`, label: `Advance for ${b.title}`, gross: b.advance, kind: 'advance' });
    const e = b.revenue.find((x) => x.year === lived);
    if (e?.toAuthor > 0 && !b.paid.includes(lived)) out.push({ source: `book:${b.id}:${lived}`, label: `Royalties: ${b.title}`, gross: e.toAuthor, book: b.id });
  }
  return out;
}
export function markBooksPaid(p = player()) {
  const lived = year() - 1;
  for (const id of writingOf(p).books) {
    const b = book(id);
    if (!b) continue;
    if (b.signed === lived) b.advancePaid = true;
    if (b.revenue.some((x) => x.year === lived) && !b.paid.includes(lived)) b.paid.push(lived);
  }
}

/** Every book the player has had published, oldest first. */
export const bibliography = (p = player()) => published(p).sort((a, b) => a.released - b.released);
