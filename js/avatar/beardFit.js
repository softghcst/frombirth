// Fitting a beard to the jaw it is worn on.
//
// Every beard is drawn on the template face. Scaled to a head by its width alone, a beard that follows
// the template's jaw stops short of a broad, round jaw (bare skin between the beard and the jawline) and
// spills past a narrow one. The build script measures the outline of each beard and the jaw of each
// head, row by row (their `shape` and `jaw` in the manifest), and this works out, for one beard on one
// head, how far to stretch it across the face so its outer edge meets that head's jaw. A stretched beard
// is also clipped to the face (js/CharacterAvatar.js), so where the two outlines differ it never shows
// past the jawline.
//
// Only a beard that follows the jaw (a chinstrap, stubble, muttonchops, a goatee's straps) is fitted, and
// only ever stretched, never narrowed. A full beard, drawn to stand out past the jaw, and a mustache or
// soul patch, which never reaches it, are left exactly as drawn. Nothing is special-cased by part: a new beard or head only needs measuring (run the script).
import { PART_BY_ID, AVATAR_TEMPLATE as T } from '../avatarManifest.js';

/**
 * The limits of the fit:
 *   reach     a beard follows the jaw if, fitted plainly, it comes within this share of the jaw somewhere
 *             along it; one that stays further inside is a mustache, goatee or soul patch
 *   volume    a beard that, fitted plainly, stands out past the jaw by more than this share somewhere along
 *             it is a full beard, drawn bigger than the face on purpose
 *   least     the narrowest part of a beard that is compared with the jaw (template units from the
 *             center line): the tapering tip of a chin beard says nothing about the jaw
 *   reaches   the share of the beard's rows along the jaw that are stretched to meet it: the rest, its
 *             narrowest (a tuft, a notch in the outline), do not decide how far the whole beard stretches
 *   lap       how far past the jaw's edge a beard is stretched, as a share of its width, so no skin
 *             shows between beard and jawline (the clip trims the rest)
 *   stretch   the most a beard is stretched, relative to the plain fit
 *   earClear  rows this far below the ear lobes are compared, so the ears never count as jaw
 * Whether a beard follows the jaw is decided once for the beard, on every adult head (the middle one decides),
 * so a style is never fitted on one face and left as drawn on the next.
 */
export const BEARD_FIT = { reach: 0.8, volume: 0.3, least: 30, reaches: 0.75, lap: 0.04, stretch: 1.3, earClear: 14 };

const STEP = T.featureStep ?? 2;
const cache = new Map();
const kinds = new Map();

/** The head's half-width either side of its center at row y (in its own coordinates), or null. */
function jawAt(jaw, cx, y) {
  const i = Math.round((y - jaw.y) / STEP);
  if (i < 0 || i >= jaw.L.length || jaw.L[i] == null) return null;
  return { L: cx - jaw.L[i], R: jaw.R[i] - cx };
}

/**
 * One beard against one head's jaw. For each row of the beard that lies on the jaw (below the ears, above the
 * chin), the stretch that would carry the beard's edge exactly to the jaw on that side, as a share of the
 * plain fit (the head's width ratio): below 1, the beard already stands out past the jaw there.
 * -> { needs (sorted), wr, hr } or null if either has not been measured.
 */
function against(shape, head) {
  const fit = head?.fit;
  if (!fit || !head.jaw || !shape) return null;
  const wr = fit.w / T.face.w;
  const hr = (fit.chin - fit.top) / (T.face.chin - T.face.top);
  const at = (y) => fit.top + (y - T.face.top) * hr; // a row of the template face, on this head: chin to chin
  const needs = [];
  shape.L.forEach((l, i) => {
    if (l == null) return;
    const y = at(shape.y + i * STEP);
    if (y < fit.lobe + BEARD_FIT.earClear || y > fit.chin - 2) return;
    const jaw = jawAt(head.jaw, fit.cx, y);
    if (!jaw) return;
    for (const [beard, edge] of [[256 - l, jaw.L], [shape.R[i] - 256, jaw.R]]) {
      if (beard >= BEARD_FIT.least && edge > 0) needs.push(edge / beard / wr);
    }
  });
  return needs.length ? { needs: needs.sort((a, b) => a - b), wr, hr } : null;
}

/** Whether a beard follows the jaw: on the middle adult head, it comes close to the jaw but not far past it. */
export function followsJaw(beardId) {
  if (kinds.has(beardId)) return kinds.get(beardId);
  const shape = PART_BY_ID[beardId]?.shape;
  const closest = Object.values(PART_BY_ID).filter((p) => p.jaw && p.tags?.age === 'adult')
    .map((h) => against(shape, h)?.needs[0]).filter((v) => v != null).sort((a, b) => a - b);
  const mid = closest[Math.floor(closest.length / 2)];
  const out = mid != null && mid * BEARD_FIT.reach <= 1 && mid >= 1 - BEARD_FIT.volume;
  kinds.set(beardId, out);
  return out;
}

/**
 * How one beard is drawn on one head.
 * @returns {{sx:number, sy:number, hugs:boolean}} the horizontal and vertical scale from the template face
 *   onto this head, about the mouth (see fitTransforms in js/CharacterAvatar.js); `hugs` is whether the
 *   beard was stretched to the jaw. Any other beard keeps the plain fit: the head's width ratio both ways.
 */
export function beardFit(beardId, headId) {
  const key = `${beardId}|${headId}`;
  if (cache.has(key)) return cache.get(key);
  const head = PART_BY_ID[headId];
  const wr = head?.fit ? head.fit.w / T.face.w : 1;
  let out = { sx: wr, sy: wr, hugs: false };
  const m = followsJaw(beardId) ? against(PART_BY_ID[beardId].shape, head) : null;
  if (m) {
    const need = m.needs[Math.max(0, Math.ceil(m.needs.length * BEARD_FIT.reaches) - 1)] * (1 + BEARD_FIT.lap);
    // A beard that already reaches this jaw is left as drawn: beards are only ever stretched, never narrowed.
    if (need > 1) out = { sx: wr * Math.min(BEARD_FIT.stretch, need), sy: m.hr, hugs: true };
  }
  cache.set(key, out);
  return out;
}
