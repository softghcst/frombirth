// A person's heritage (js/data/heritage.js), as the face generator uses it: a share of one or more heritages, saved on
// appearance.inherited.heritage as { id: share } with shares summing to 1. Strangers take theirs from where they are
// born; a child's is the average of its parents'; what anyone is born with is drawn from the blend of their heritages'
// leanings (featureWeights), never limited to it.
import { rng } from '../rng.js';
import { HERITAGE_BY_ID, HERITAGE_IDS, COUNTRY_HERITAGE, DEFAULT_BY_GROUP } from '../data/heritage.js';
import { place } from '../data/world.js';
import { SKIN_TONE_IDS } from '../avatarPalettes.js';

const round = (x) => Math.round(x * 1000) / 1000;

/**
 * Heritage's own dice. They are seeded from the game's dice (js/rng.js) without moving them on, so everything else drawn
 * when a person is made comes out exactly as it did before heritage: their face shapes, their name, their life. The seed
 * is the game's dice state and `salt`, the use (a place, a partner, a face), so the same game always gives the same
 * heritage; never a running count, which would differ between two plays of one life.
 * @param {string} salt
 */
export function heritageDice(salt) {
  let h = 2166136261;
  for (const ch of String(salt)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = (Math.imul(rng.state() ^ 0x9e3779b9, 2654435761) ^ h) >>> 0 || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next, chance: (p) => next() < p,
    weighted(items, fn) {
      const w = items.map((i) => Math.max(0, fn(i))); const total = w.reduce((a, b) => a + b, 0);
      if (total <= 0) return items[0];
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) { roll -= w[i]; if (roll < 0) return items[i]; }
      return items[items.length - 1];
    },
  };
}

/** Hair colors people are born with (the rest of HAIR_COLORS are dyes). */
export const NATURAL_HAIR = ['black', 'dark_brown', 'brown', 'light_brown', 'auburn', 'ginger', 'dark_blonde', 'blonde'];

/** A heritage in the saved form, or null if it names nothing known. Shares are rescaled to sum to 1. */
export function cleanHeritage(h) {
  if (!h || typeof h !== 'object') return null;
  const entries = Object.entries(h).filter(([id, s]) => HERITAGE_BY_ID[id] && Number(s) > 0);
  const total = entries.reduce((t, [, s]) => t + Number(s), 0);
  if (!total) return null;
  return Object.fromEntries(entries.map(([id, s]) => [id, round(Number(s) / total)]));
}

/** The mix of people born in a place: [weight, heritage] pairs (DEFAULT_BY_GROUP for places not listed). */
export function placeMix(countryId) {
  if (COUNTRY_HERITAGE[countryId]) return COUNTRY_HERITAGE[countryId];
  let group = null;
  try { group = place(countryId)?.group ?? null; } catch { group = null; }
  return DEFAULT_BY_GROUP[group] ?? DEFAULT_BY_GROUP.Europe;
}

/** A heritage for someone born in a place, drawn from who is born there. */
export function heritageFor(countryId) {
  const [, h] = heritageDice(`place:${countryId}`).weighted(placeMix(countryId), (e) => e[0]);
  return cleanHeritage(typeof h === 'string' ? { [h]: 1 } : h);
}

/** A child's heritage: half of each parent's (a parent whose heritage is unknown passes on the other's). */
export function blendHeritage(a, b) {
  const x = cleanHeritage(a); const y = cleanHeritage(b);
  if (!x || !y) return x ?? y ?? null;
  const out = {};
  for (const [id, s] of Object.entries(x)) out[id] = (out[id] ?? 0) + s / 2;
  for (const [id, s] of Object.entries(y)) out[id] = (out[id] ?? 0) + s / 2;
  return cleanHeritage(out);
}

/** One heritage of a mix, drawn by its share (a grandparent of a half-and-half parent has one or the other). */
export function oneOf(h) {
  const x = cleanHeritage(h);
  if (!x) return null;
  return { [heritageDice(`one:${Object.keys(x).join(',')}`).weighted(Object.keys(x), (id) => x[id])]: 1 };
}

/** The largest share of a heritage, for showing it in a word or two. */
export const mainHeritage = (h) => {
  const x = cleanHeritage(h);
  return x ? Object.entries(x).sort((p, q) => q[1] - p[1])[0][0] : null;
};

/** A heritage in words: "East Asian", or "Korean and Nigerian" style mixes as "East Asian and Sub-Saharan African". */
export function heritageLabel(h) {
  const x = cleanHeritage(h);
  if (!x) return null;
  const ids = Object.entries(x).sort((p, q) => q[1] - p[1] || HERITAGE_BY_ID[p[0]].label.localeCompare(HERITAGE_BY_ID[q[0]].label)).filter(([, s]) => s >= 0.2).map(([id]) => HERITAGE_BY_ID[id].label);
  return ids.length <= 1 ? ids[0] ?? HERITAGE_BY_ID[mainHeritage(x)].label : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/**
 * How likely each value of a feature ('skin', 'hairColor', 'hairTexture', 'eyeColor') is for someone of this heritage:
 * each heritage's leanings, weighted by its share. Values none of them name get a small chance, so nothing is ruled out.
 * @param {object} h a heritage
 * @param {string} key
 * @param {string[]} values every value the feature can take
 * @returns {Object<string,number>|null} null for an unknown heritage
 */
export function featureWeights(h, key, values) {
  const x = cleanHeritage(h);
  if (!x) return null;
  const w = Object.fromEntries(values.map((v) => [v, 0]));
  for (const [id, share] of Object.entries(x)) {
    const table = HERITAGE_BY_ID[id][key] ?? {};
    const total = Object.values(table).reduce((t, n) => t + n, 0) || 1;
    for (const [v, n] of Object.entries(table)) if (v in w) w[v] += share * n / total;
  }
  // Anything else, now and then: hair and eye colors a little more often than a skin tone far from the heritage's own.
  const rare = key === 'skin' ? 0.0008 : 0.0008;
  for (const v of values) w[v] += rare;
  return w;
}

// ---------- Family roots: where a family comes from, as places ----------

/** The share a heritage has among people born in a place (0 to 1). */
export function shareIn(countryId, heritageId) {
  const mix = placeMix(countryId);
  const total = mix.reduce((t, [w]) => t + w, 0) || 1;
  return mix.reduce((t, [w, h]) => t + w * (typeof h === 'string' ? (h === heritageId ? 1 : 0) : (h[heritageId] ?? 0)), 0) / total;
}

/** Below this share, a heritage counts as having come from elsewhere: the family's roots are abroad. */
const LOCAL = 0.05;

/** A country where a heritage is common, drawn by how common it is there: a homeland for a family that came from it. */
export function homeland(heritageId, salt = '') {
  const places = Object.keys(COUNTRY_HERITAGE).map((id) => [id, shareIn(id, heritageId)]).filter(([, s]) => s >= 0.5);
  if (!places.length) return null;
  return heritageDice(`home:${heritageId}:${salt}`).weighted(places, ([, s]) => s ** 3)[0];
}

/**
 * The roots of someone with no known family, born in a place: that place for each part of their heritage common there;
 * for a part that is not, a homeland where it is (their family came from there). Most important first.
 * @returns {string[]} country ids
 */
export function rootsFor(heritage, countryId) {
  const x = cleanHeritage(heritage);
  if (!x || !countryId) return countryId ? [countryId] : [];
  const out = [];
  for (const [id] of Object.entries(x).sort((p, q) => q[1] - p[1])) {
    const r = shareIn(countryId, id) >= LOCAL ? countryId : homeland(id, countryId) ?? countryId;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

/** A child's roots: both parents', in turn, at most four. */
export function blendRoots(a, b) {
  const x = Array.isArray(a) ? a : []; const y = Array.isArray(b) ? b : [];
  const out = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) for (const r of [x[i], y[i]]) if (r && !out.includes(r)) out.push(r);
  return out.slice(0, 4);
}

/**
 * The heritage a player's designed face most likely comes from, given where they are born: each heritage weighed by how
 * common it is there and by how well it explains the face's skin, hair and eyes. A face like the people of the place
 * gets their heritage; one unlike them, the heritage it looks like (their family came from elsewhere).
 * @param {{skin:string, hairColor:string, hairTexture:string, eyeColor:string}} inherited
 */
export function inferHeritage(inherited, countryId, values) {
  const weights = HERITAGE_IDS.map((id) => {
    const one = { [id]: 1 };
    let w = Math.max(shareIn(countryId, id), 0.01);
    for (const [key, list] of Object.entries(values)) {
      const v = inherited?.[key];
      if (!v) continue;
      const f = featureWeights(one, key, list);
      w *= f[v] / Object.values(f).reduce((t, n) => t + n, 0);
    }
    return w;
  });
  const id = heritageDice(`infer:${countryId}`).weighted(HERITAGE_IDS, (h) => weights[HERITAGE_IDS.indexOf(h)]);
  return { [id]: 1 };
}

/** Every value of each colored feature a face is born with, for inferHeritage. */
export const FACE_VALUES = {
  skin: SKIN_TONE_IDS,
  hairColor: NATURAL_HAIR,
  hairTexture: ['straight', 'wavy', 'curly', 'coily'],
  eyeColor: ['dark_brown', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray'],
};
