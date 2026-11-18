// Keeping a nose clear of the eyes it is worn with.
//
// Every nose and every pair of eyes is drawn to fit the same boxes on the template face, so some
// pairs crowd each other: a broad nose under eyes whose inner corners sweep down, a tall bridge
// between eyes set close. The build script measures the outline of each (their `shape` in the
// manifest), and this works out, for one face, the smallest change that leaves a clear gap between
// them: the nose a little smaller, set a little lower, or the eyes a touch further apart. Nothing is
// special-cased by part: a new nose or pair of eyes only needs measuring (run the script).
import { PART_BY_ID, AVATAR_TEMPLATE as T } from '../avatarManifest.js';

/**
 * What is asked for, and how far a face may be changed to get it (template units, on a full-size face):
 *   gap       the clear space wanted between the lines of the nose and the eyes
 *   skin      the clear space wanted between the nose's patch of skin and the eyes (it would hide them)
 *   shrink    how small a nose may be made, in steps
 *   drop      how far down it may be moved, and `floor`, the line its bottom edge stays above (clear of the mouth)
 *   apart     how much further apart each eye may be set
 *   cost      what each change costs: the cheapest set of changes that clears the gap is used
 */
export const NOSE_FIT = { gap: 4, skin: 1, shrink: [1, 0.96, 0.92, 0.88, 0.84, 0.8], drop: [0, 1.5, 3, 4.5], floor: 354, apart: [0, 1, 2, 3],
  cost: { shrink: 100, drop: 3, apart: 3.5 } };

const STEP = T.featureStep ?? 2;
const rows = (list, y0) => (list ?? []).map((v, i) => (v == null ? null : [v, y0 + i * STEP + 0.5])).filter(Boolean);

/** The space between two outlines: the eyes' inner edge and the nose's outer edge. Below zero, they overlap. */
function space(eye, nose, tol) {
  let least = Infinity;
  for (const [ex, ey] of eye) for (const [nx, ny] of nose) {
    const dx = ex - nx, dy = Math.abs(ey - ny);
    const d = dx >= 0 ? Math.hypot(dx, Math.max(0, dy - tol)) : dy <= tol ? dx : dy - tol;
    if (d < least) least = d;
  }
  return least;
}

const cache = new Map();

/**
 * How one nose is adjusted for one pair of eyes on one face.
 * @param {string} eyesId
 * @param {string} noseId
 * @param {{s:number, eyeS:number, noseS:number, eyeY:number, noseY:number, apart:number}} g  where the renderer
 *   puts them: the face's scale, the scale of the eyes and of the nose, the height of each one's anchor, and
 *   how far apart the eyes are set (template units)
 * @returns {{k:number, drop:number, apart:number}} scale the nose by k, move it down by `drop` (in the
 *   picture's units), set each eye `apart` further out (template units)
 */
export function noseFit(eyesId, noseId, g) {
  const eyes = PART_BY_ID[eyesId]?.shape, nose = PART_BY_ID[noseId]?.shape;
  const none = { k: 1, drop: 0, apart: 0 };
  if (!eyes?.inner || !nose?.ink) return none;
  const key = [eyesId, noseId, g.s, g.eyeS, g.noseS, g.eyeY, g.noseY, g.apart].map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join('|');
  if (cache.has(key)) return cache.get(key);
  const F = NOSE_FIT;
  const eyeRows = rows(eyes.inner, eyes.y), ink = rows(nose.ink, nose.y), all = rows(nose.all, nose.y);
  const eyeAt = (apart) => eyeRows.map(([x, y]) => [g.eyeS * (x + g.apart + apart), g.eyeY + g.eyeS * (y - T.anchor.eyes)]);
  const noseAt = (list, k, drop) => list.map(([x, y]) => [g.noseS * k * x, g.noseY + drop + g.noseS * k * (y - T.anchor.nose)]);
  const room = Math.max(0, F.floor - nose.bottom);
  const tries = [];
  for (const k of F.shrink) for (const d of F.drop) for (const a of F.apart) if (d <= room) tries.push({ k, drop: d * g.s, apart: a, cost: (1 - k) * F.cost.shrink + d * F.cost.drop + a * F.cost.apart });
  tries.sort((a, b) => a.cost - b.cost);
  let best = null;
  for (const t of tries) {
    const e = eyeAt(t.apart);
    // How far short of what is wanted this leaves the face (zero: clear).
    const short = Math.max(0, F.gap * g.s - space(e, noseAt(ink, t.k, t.drop), STEP * g.eyeS), F.skin * g.s - space(e, noseAt(all, t.k, t.drop), STEP * g.eyeS));
    if (!best || short < best.short - 0.05) best = { ...t, short };
    if (short === 0) break;
  }
  const fit = best ? { k: best.k, drop: Math.round(best.drop * 100) / 100, apart: best.apart } : none;
  cache.set(key, fit);
  return fit;
}

/** The clear space between a nose's lines and the eyes, as noseFit sees it (for the tests). */
export function noseGap(eyesId, noseId, g, fit = { k: 1, drop: 0, apart: 0 }) {
  const eyes = PART_BY_ID[eyesId].shape, nose = PART_BY_ID[noseId].shape;
  const e = rows(eyes.inner, eyes.y).map(([x, y]) => [g.eyeS * (x + g.apart + fit.apart), g.eyeY + g.eyeS * (y - T.anchor.eyes)]);
  const n = rows(nose.ink, nose.y).map(([x, y]) => [g.noseS * fit.k * x, g.noseY + fit.drop + g.noseS * fit.k * (y - T.anchor.nose)]);
  return space(e, n, STEP * g.eyeS);
}
