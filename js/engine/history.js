// History happens to lives in the past (data/history.js): depressions and
// recessions turn the economy, wars become crises at home and call-up papers
// at the door, conscription comes and goes with the law, and the moments
// everyone remembers reach the news. A life that begins in the present has
// none of this behind it to meet.
import { store, player } from '../state.js';
import { rng } from '../rng.js';
import { HISTORY, PRESENT } from '../data/history.js';
import { setPlace, post } from './economy.js';
import { rule, enact } from './rules.js';
import { COUNTRIES } from '../data/countries.js';

const inPlace = (ev, id) => ev.places === 'all' || ev.places.includes(id);
const places = (ev) => (ev.places === 'all' ? Object.keys(COUNTRIES) : ev.places.filter((id) => COUNTRIES[id]));

/** What history has under way in a year, for a country. */
export const underWay = (year = store.state.year, id = player().countryId) => HISTORY.filter((ev) => inPlace(ev, id) && year >= ev.year && year <= (ev.until ?? ev.year));

/** Once a year. @returns {string[]} */
export function tickHistory() {
  const st = store.state;
  const year = st.year;
  if (year > PRESENT) return [];
  const p = player();
  const lines = [];
  st.history ??= { seen: [] };
  // A life begun in the middle of something (a war, a draft) finds it already under way: no headline, but the law and the economy as they were.
  const first = !st.history.started;
  st.history.started = true;
  for (const ev of HISTORY) {
    const key = `${ev.kind}:${ev.year}:${Array.isArray(ev.places) ? ev.places.join(',') : 'all'}`;
    const active = year >= ev.year && year <= (ev.until ?? ev.year);
    const here = inPlace(ev, p.countryId);
    // The year it begins: it is in the news, and the world changes.
    if ((year === ev.year || (first && active)) && !st.history.seen.includes(key)) {
      st.history.seen.push(key);
      if ((here || ev.places === 'all') && year === ev.year) { post(here ? p.countryId : null, ev.kind === 'news' ? 'world' : 'crisis', ev.text, ev.kind === 'news' ? 'neutral' : 'bad'); lines.push(ev.text); }
      if (ev.kind === 'conscription' || ev.kind === 'draft') for (const id of places(ev)) if (!rule('conscription', id)) { enact(id, 'conscription', true, 'the government'); (st.history.drafted ??= []).push(`${key}:${id}`); }
      if (ev.mood && here) p.stats.mood = Math.max(0, p.stats.mood + ev.mood);
    }
    // While it lasts.
    if (active) {
      if (ev.kind === 'slump') for (const id of places(ev)) setPlace(id, { phase: 'slump' });
      if (ev.kind === 'war') for (const id of places(ev)) setPlace(id, { phase: 'slump', crisis: 'war' });
      // Men of fighting age are called up, at home or to fight abroad.
      if ((ev.kind === 'war' || ev.kind === 'draft') && here && p.gender === 'male' && p.age >= 18 && p.age <= (ev.maxAge ?? (ev.kind === 'war' ? 45 : 26)) && !p.legal.incarceration
        && !(p.flags.calledUp ?? []).includes(key) && rng.chance(ev.kind === 'war' ? 0.7 : (ev.maxAge ?? 26) >= 40 ? 0.75 : 0.25)) {
        (p.flags.calledUp ??= []).push(key);
        st.pendingEvents.push({ id: 'call_up_papers', cast: {} });
      }
    }
    // The year after it ends.
    if (ev.until != null && year === ev.until + 1) {
      if (ev.end && (here || ev.places === 'all')) { post(here ? p.countryId : null, 'crisis', ev.end, 'good'); lines.push(ev.end); }
      if (ev.kind === 'war') for (const id of places(ev)) if (!HISTORY.some((o) => o !== ev && o.kind === 'war' && inPlace(o, id) && year >= o.year && year <= (o.until ?? o.year))) setPlace(id, { phase: 'steady', crisis: null });
      if (ev.kind === 'slump') for (const id of places(ev)) setPlace(id, { phase: 'steady' });
      if (ev.kind === 'conscription' || ev.kind === 'draft') {
        for (const id of places(ev)) {
          const still = HISTORY.some((o) => o !== ev && ['conscription', 'draft'].includes(o.kind) && inPlace(o, id) && year >= o.year && year <= (o.until ?? o.year));
          if (!still && (st.history.drafted ?? []).some((d) => d.endsWith(`:${id}`))) { enact(id, 'conscription', false, 'the government'); st.history.drafted = st.history.drafted.filter((d) => !d.endsWith(`:${id}`)); }
        }
      }
    }
  }
  return lines; // economy.post has already put each in the journal and the news
}
