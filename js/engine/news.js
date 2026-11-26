// The news: a country's invented newspapers and broadcasters, and what they
// have reported. Kept on the political world of the country:
//   w.press  [{ id, name, kind: 'broadsheet' | 'tabloid' | 'broadcaster', lean }]
//            lean: +1 sympathetic to the left, -1 to the right, 0 to neither
//   w.news   [{ year, outlet, text, tone, you }]   the most recent 80 items; `you`: about the player
// An outlet that leans the player's way reports them kindly; one that does
// not, does not. No outlet here is, or is based on, a real one.
import { rng } from '../rng.js';
import { store } from '../state.js';
import { OUTLETS, HEADLINES } from '../data/news.js';

/** The outlets of a country, made the first time they are needed. */
export function press(w) {
  if (!w.press) {
    const side = rng.chance(0.5) ? 1 : -1;
    const pick = (kind, taken) => rng.pick(OUTLETS[kind].filter((n) => !taken.includes(n)));
    const a = pick('broadsheet', []);
    w.press = [{ id: 'n1', name: a, kind: 'broadsheet', lean: side }, { id: 'n2', name: pick('broadsheet', [a]), kind: 'broadsheet', lean: -side },
      { id: 'n3', name: pick('tabloid', []), kind: 'tabloid', lean: rng.chance(0.5) ? 1 : -1 }, { id: 'n4', name: pick('broadcaster', []), kind: 'broadcaster', lean: 0 }];
  }
  return w.press;
}

/** Adds an item to the country's news. */
export function post(w, text, o = {}) {
  const outlet = o.outlet ?? press(w).find((x) => x.kind === 'broadcaster');
  (w.news ??= []).push({ year: store.state.year, outlet: outlet.name, text, tone: o.tone ?? 'neutral', you: !!o.you, ...(o.kind ? { kind: o.kind } : {}) });
  if (w.news.length > 80) w.news.shift();
}

/** Which way the player leans, as the press sees it: by the party they belong to. */
function leaning(w) {
  const m = store.state.player.flags.party;
  const pa = m && m.countryId === w.countryId ? w.parties.find((x) => x.id === m.partyId) : null;
  if (!pa) return 0;
  const v = (pa.positions.tax ?? 0) + (pa.positions.services ?? 0) - (pa.positions.order ?? 0) / 2;
  return v > 0.5 ? 1 : v < -0.5 ? -1 : 0;
}

/**
 * Reports something the player did. One outlet that likes them and one that
 * does not each run it their own way; a scandal is led by whoever dislikes them most.
 * @param {string} kind  a key of HEADLINES
 * @param {Object<string,string|number>} words  what to fill the headline with
 */
export function report(w, kind, words = {}) {
  const set = HEADLINES[kind];
  if (!set) return;
  const side = leaning(w);
  const p = store.state.player;
  const fill = (t) => t.replace(/\{(\w+)\}/g, (all, k) => (k === 'name' ? `${p.firstName} ${p.lastName}` : k === 'last' ? p.lastName : words[k] ?? all)).replace(/^./, (ch) => ch.toUpperCase());
  const papers = press(w).filter((x) => x.kind !== 'broadcaster');
  const friend = papers.find((x) => side && x.lean === side) ?? null;
  const foe = papers.find((x) => side && x.lean === -side) ?? papers.find((x) => x.kind === 'tabloid');
  if (set.plain) post(w, fill(rng.pick(set.plain)), { tone: set.tone, you: true, kind });
  if (friend && set.kind) post(w, fill(rng.pick(set.kind)), { outlet: friend, tone: set.tone, you: true, kind });
  if (foe && set.harsh) post(w, fill(rng.pick(set.harsh)), { outlet: foe, tone: set.tone, you: true, kind });
}

/** The news as the screen shows it: newest first, grouped by year. */
export function feed(w) {
  const years = [];
  for (const n of [...(w.news ?? [])].reverse()) {
    let y = years[years.length - 1];
    if (!y || y.year !== n.year) { y = { year: n.year, items: [] }; years.push(y); }
    y.items.push(n);
  }
  return years;
}
