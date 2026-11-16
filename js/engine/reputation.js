// How a royal is seen: by the public, by their own family, and by the press.
// Three separate things, moved by different choices, each with a record of
// why it last changed.
//
// On p.royal:
//   image    public approval, 0–100 (the meter that has always been there)
//   family   how the family regards the player: duty done, wishes respected
//   press    how the newspapers treat them: warm, wary or hostile
//   stories  what is being talked about now: [{ label, truth, heat, year }]
//              truth  whether it actually happened (a rumour is not a fact,
//                     and denying a rumour works where denying the truth may not)
//              heat   how loud it still is; it fades each year
//   why      the last few changes, newest last: [{ year, what, delta, text }]
import { clamp } from '../util.js';
import { store, player, log } from '../state.js';

const NAMES = { image: 'Public approval', family: 'Family approval', press: 'The press' };

/** The player's reputation, with anything missing filled in (older saves). Null for a commoner. */
export function rep() {
  const r = player().royal;
  if (!r || !['monarch', 'heir', 'royal'].includes(r.rank)) return null;
  r.family ??= r.by === 'marriage' ? 45 : 60;
  r.press ??= 55;
  r.stories ??= [];
  r.why ??= [];
  return r;
}

/**
 * Moves one of the three, and remembers why.
 * @param {'image'|'family'|'press'} what
 * @param {number} delta
 * @param {string} [text]  the reason, in a few words: "reports of lavish spending"
 * @returns {number} how far it actually moved
 */
export function shift(what, delta, text) {
  const r = rep();
  if (!r || !delta) return 0;
  const before = r[what];
  // The better liked someone already is, the less each good deed adds.
  const d = what === 'image' && delta > 0 ? Math.max(1, Math.round(delta * Math.min(1, (100 - r.image) / 55))) : delta;
  r[what] = Math.round(clamp(before + d));
  const moved = r[what] - before;
  if (moved && text) {
    r.why.push({ year: store.state.year, what, delta: moved, text });
    if (r.why.length > 14) r.why.splice(0, r.why.length - 14);
  }
  return moved;
}

/** Something the newspapers have got hold of. `truth` is whether it really happened. */
export function addStory(label, truth, heat) {
  const r = rep();
  if (!r) return;
  const had = r.stories.find((s) => s.label === label);
  if (had) { had.heat = clamp(had.heat + heat); had.truth = had.truth || truth; return; }
  r.stories.push({ label, truth: !!truth, heat: clamp(heat), year: store.state.year });
}

/** Turns the loudest current story up or down (a good answer cools it; a bad one feeds it). */
export function coolStory(delta) {
  const r = rep();
  const s = r?.stories.reduce((a, b) => (b.heat > (a?.heat ?? -1) ? b : a), null);
  if (s) s.heat = clamp(s.heat + delta);
}

export const loudest = () => rep()?.stories.reduce((a, b) => (b.heat > (a?.heat ?? -1) ? b : a), null) ?? null;

/** What the screens show. */
export function summary() {
  const r = rep();
  if (!r) return null;
  const word = (v, hi, mid, lo, worst) => (v >= 72 ? hi : v >= 50 ? mid : v >= 30 ? lo : worst);
  return {
    meters: [
      { id: 'image', name: NAMES.image, value: r.image, word: word(r.image, 'adored', 'liked well enough', 'out of favour', 'in disgrace') },
      { id: 'family', name: NAMES.family, value: r.family, word: word(r.family, 'the family is proud of you', 'the family is content', 'the family is uneasy about you', 'the family has closed ranks against you') },
      { id: 'press', name: NAMES.press, value: r.press, word: word(r.press, 'the newspapers are on your side', 'the newspapers are fair to you', 'the newspapers are looking for a story', 'the newspapers have turned on you') },
    ],
    stories: [...r.stories].sort((a, b) => b.heat - a.heat).map((s) => ({ ...s, loud: s.heat >= 50 ? 'on every front page' : s.heat >= 22 ? 'still being talked about' : 'nearly forgotten' })),
    why: [...r.why].reverse().map((w) => ({ ...w, name: NAMES[w.what] })),
  };
}

/**
 * Yearly, for a member of the royal family. `dutiesDone` is how many public
 * duties they carried out in the year just ended.
 */
export function tickReputation(dutiesDone) {
  const p = player();
  const r = rep();
  if (!r || p.age < 18) return;
  // The family notices who turns up.
  if (!dutiesDone) shift('family', -5, 'no public duties all year');
  else if (dutiesDone >= 3) shift('family', 3, 'a full year of public duties');
  // Stories fade, and while they are loud they cost something.
  let noise = 0;
  for (const s of r.stories) { noise += s.heat; s.heat = Math.round(s.heat * 0.55 - 2); }
  r.stories = r.stories.filter((s) => s.heat > 4);
  if (noise >= 40) { shift('image', -Math.min(8, Math.round(noise / 14)), 'a story that would not go away'); shift('press', -4, 'a story that would not go away'); }
  // Left alone, each drifts back towards the middle.
  r.family = Math.round(r.family + (58 - r.family) * 0.06);
  r.press = Math.round(r.press + (55 - r.press) * 0.1);
  // A hostile press colours everything; a friendly one helps a little.
  if (r.press < 30) shift('image', -2, 'a hostile press');
  else if (r.press >= 75) shift('image', 1, 'a friendly press');
  // A family that has closed ranks makes itself felt.
  if (r.family < 20 && !p.flags.familyFrost) {
    p.flags.familyFrost = true;
    log('The family has stopped inviting you to things. Your allowance has been halved "until matters improve".', 'system', 'bad');
  } else if (r.family >= 40 && p.flags.familyFrost) {
    p.flags.familyFrost = false;
    log('The family has thawed. You are back on the balcony, and your allowance is restored.', 'system', 'good');
  }
}
