// How a hairstyle is fitted to one particular head.
//
// Every hairstyle and every head has been measured by
// scripts/build-avatar-manifest.py (their `edge` in the manifest):
//   hair  L, R  row by row, the inner edges of the hair either side of the opening the face shows through
//               (null: no hair on that side; both 256: the hair covers the middle of the face on that row)
//         T     column by column, the hairline: where the hair that starts above the forehead ends
//         O     column by column, the outline of the crown: where that hair begins
//         top   the highest point of the style
//   head  L, R  row by row, the edges of the head;  T  column by column, the top of the skull
// Rows and columns are the same for both (AVATAR_TEMPLATE.profile), in the 512 frame.
//
// The renderer starts from the plain fit (the style scaled by the width of
// the head, hung from the top of it) and then corrects it for this head:
//   - no background may show between hair and scalp, at the temples or over the crown;
//   - hair that covers the top of the head goes on covering it: no move may bare the scalp;
//   - a fringe should not sit on the eyebrows, nor hair close in over the eyes, where a small move avoids it;
//   - otherwise the style is left as drawn.
// The answer is a pure function of the two measurements, so the same person
// is drawn the same way on every screen, and a new hairstyle or head needs
// nothing but to be measured.
import { PART_BY_ID, AVATAR_TEMPLATE as T } from '../avatarManifest.js';

const [R0, RSTEP, RN] = T.profile.rows;
const [C0, CSTEP, CN] = T.profile.cols;
/** Hair should lap this far onto the skin, so no hairline is drawn edge to edge with the scalp. */
const OVERLAP = 3;
/** How far the corrections may go: scale, relative to the plain fit, and shifts in frame units. */
export const LIMITS = { scale: [0.86, 1.16], up: 16, down: 40, across: 10 };

/** A measured profile, read between its samples. */
function at(values, start, step, v) {
  const f = (v - start) / step;
  const i = Math.max(0, Math.min(values.length - 2, Math.floor(f)));
  const a = values[i];
  const b = values[i + 1];
  if (a == null || b == null) return a ?? b;
  return a + (b - a) * Math.max(0, Math.min(1, f - i));
}

/**
 * The cost of hair reaching d units past the eyes: gentle at first, then rising steadily. It used to stop rising
 * at 14, so on a broad face (cherubic, pixie, the kid) where a style closed in further than that, no small move
 * made things any better and the fitter left it hanging over the eyes.
 */
const overEye = (d) => (d <= 0 ? 0 : 0.15 * Math.min(d, 14) ** 2 + 4.2 * Math.max(0, d - 14));

/** How far the hair's inner edges reach past either eye ([left, right], frame units; 0 or less: clear) for fit f. */
function overEyes(hair, fit, f) {
  const hr = (fit.chin - fit.top) / (T.face.chin - T.face.top);
  const eyeY = fit.top + (T.anchor.eyes - T.face.top) * hr;
  const eyeReach = fit.w * 0.36;
  const hy = T.face.top + (eyeY - f.ty) / f.sy;
  const l = at(hair.L, R0, RSTEP, hy);
  const r = at(hair.R, R0, RSTEP, hy);
  // No hair at the eye line on a side, or hair right across the face (both edges at the center): nothing to measure.
  const open = l === r;
  return [l == null || open ? 0 : f.tx + f.sx * (l - 256) - (fit.cx - eyeReach), r == null || open ? 0 : fit.cx + eyeReach - (f.tx + f.sx * (r - 256))];
}

/**
 * How much of the eyes a style is meant to cover, as a share of the face's width: what it still covers when
 * fitted to the reference head, the one every hairstyle is checked on first. A lock swept across one eye covers
 * it there too and is left alone; hair that only closes in on a broader face is not.
 */
const REFERENCE_HEAD = 'head_17_dimple_oval';
const allowances = new Map();
function eyeAllowance(hairId, hair) {
  if (allowances.has(hairId)) return allowances.get(hairId);
  const ref = PART_BY_ID[REFERENCE_HEAD];
  let out = null;
  if (ref?.edge && ref.fit) {
    const f = solve(hair, ref.edge, ref.fit, LIMITS, frameFor(REFERENCE_HEAD).y);
    const [l, r] = overEyes(hair, ref.fit, f);
    out = { l: Math.max(0, l) / ref.fit.w, r: Math.max(0, r) / ref.fit.w };
  }
  allowances.set(hairId, out);
  return out;
}

const cache = new Map();

/** The picture every portrait is drawn in unless a screen asks for its own: [x, y, size] of the 512 frame. */
export const FRAME = { x: -14, y: T.frameTop, size: 540 };
/** How far a narrow or broad adult face may be brought toward the average, as zoom. */
const ZOOM = [0.95, 1.07];
const faceArea = (fit) => fit.w * (fit.chin - fit.top);
const ADULTS = Object.values(PART_BY_ID).filter((p) => p.fit && p.tags?.age === 'adult');
const AVERAGE_FACE = ADULTS.reduce((s, p) => s + faceArea(p.fit), 0) / Math.max(1, ADULTS.length);

/**
 * The picture for one head. Adult heads differ a good deal in size (the narrowest is a fifth
 * narrower than the broadest), so each is zoomed a little toward the average: faces then fill
 * the same share of a portrait, and differ in shape, not in how far away they seem. The eye line
 * and the center of the face stay exactly where they are. Children keep the plain picture, so a
 * toddler's head stays bigger than a ten-year-old's.
 * @returns {{x:number, y:number, size:number}}
 */
export function frameFor(headId) {
  const head = PART_BY_ID[headId];
  if (!head?.fit || head.tags?.age !== 'adult') return FRAME;
  const zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], Math.sqrt(AVERAGE_FACE / faceArea(head.fit))));
  const size = Math.round(FRAME.size / zoom * 10) / 10;
  const hr = (head.fit.chin - head.fit.top) / (T.face.chin - T.face.top);
  const eyeY = head.fit.top + (T.anchor.eyes - T.face.top) * hr;
  // Where the eye line and the middle of the face sit in the plain picture, as shares of it.
  const eyeShare = (T.anchor.eyes - FRAME.y) / FRAME.size;
  return { x: Math.round((head.fit.cx - size / 2) * 10) / 10, y: Math.round((eyeY - eyeShare * size) * 10) / 10, size };
}

/**
 * The fit of one hairstyle on one head.
 * @returns {{sx:number, sy:number, tx:number, ty:number, squash:number, line:number}|null}
 *   a point (x, y) of the hair artwork is drawn at (tx + sx * (x - 256), ty + sy * (y - T.face.top));
 *   `squash` (1 or less) is how much hair above `line` is flattened so a tall style stays in the picture.
 */
export function hairFit(hairId, headId) {
  const key = `${hairId}|${headId}`;
  if (cache.has(key)) return cache.get(key);
  const hair = PART_BY_ID[hairId]?.edge;
  const head = PART_BY_ID[headId];
  let out = null;
  // A baby's hair is a tuft set on top of the head, with no opening for the face to fit: it stays as placed.
  const tuft = PART_BY_ID[hairId]?.tags?.age === 'baby';
  if (head?.fit) out = hair && head.edge && !tuft ? solve(hair, head.edge, head.fit, LIMITS, frameFor(headId).y, headId === REFERENCE_HEAD ? null : eyeAllowance(hairId, hair)) : plain(head.fit);
  cache.set(key, out);
  return out;
}

const plain = (fit) => ({ sx: fit.w / T.face.w, sy: fit.w / T.face.w, tx: fit.cx, ty: fit.top, squash: 1, line: fit.top });

function solve(hair, head, fit, lim = LIMITS, frameTop = T.frameTop, allow = null) {
  const base = plain(fit);
  const faceH = fit.chin - fit.top;
  const hr = faceH / (T.face.chin - T.face.top);
  // Where the brows and the eyes are on this head (as CharacterAvatar places them).
  const browTop = fit.top + (T.anchor.eyebrows - T.face.top) * hr - 14 * Math.sqrt(base.sx * hr);
  // Rows that can show a gap at the temples: below the curve of the crown, above the ears.
  const rows = [];
  for (let i = 0; i < RN; i++) if (typeof hair.L[i] === 'number' || typeof hair.R[i] === 'number') rows.push(i);
  const cols = [];
  for (let j = 0; j < CN; j++) if (hair.T[j] != null && hair.T[j] <= 250) cols.push(j);
  const mid = Math.floor(CN / 2);
  const center = [mid - 3, mid - 2, mid - 1, mid, mid + 1, mid + 2, mid + 3].map((j) => hair.T[j]).filter((v) => v != null);
  const hairline = center.length ? Math.min(...center) : null;

  // How far the scalp shows above the hair, over the crown.
  const crown = [];
  for (let j = 0; j < CN; j++) if (hair.O?.[j] != null) crown.push(j);
  const bare = (sx, sy, tx, ty) => {
    let worst = 0;
    for (const j of crown) {
      const x = tx + sx * (C0 + j * CSTEP - 256);
      if (Math.abs(x - fit.cx) > fit.w * 0.3) continue;
      const skull = at(head.T, C0, CSTEP, x);
      if (skull != null) worst = Math.max(worst, ty + sy * (hair.O[j] - T.face.top) - (skull - 2));
    }
    return worst;
  };
  // A style that leaves the crown bare as drawn (a parting, a shaved side) is allowed what it already shows.
  const bareAsDrawn = bare(base.sx, base.sy, base.tx, base.ty);
  let sides = true;
  const cost = (sx, sy, tx, ty) => {
    let c = 0;
    const bald = bare(sx, sy, tx, ty) - Math.max(0, bareAsDrawn);
    if (bald > 0) c += 4 * bald * bald;
    for (const i of sides ? rows : []) {
      const y = ty + sy * (R0 + i * RSTEP - T.face.top);
      if (y < fit.top + 18 || y > fit.earTop - 14) continue;
      const hl = at(head.L, R0, RSTEP, y);
      const hrx = at(head.R, R0, RSTEP, y);
      if (hl == null) continue;
      const l = hair.L[i];
      const r = hair.R[i];
      if (l != null && l !== r) { const d = hl + OVERLAP - (tx + sx * (l - 256)); if (d > 0) c += d * d; }
      if (r != null && l !== r) { const d = tx + sx * (r - 256) - (hrx - OVERLAP); if (d > 0) c += d * d; }
    }
    for (const j of cols) {
      const x = tx + sx * (C0 + j * CSTEP - 256);
      if (Math.abs(x - fit.cx) > fit.w * 0.4) continue;
      const skull = at(head.T, C0, CSTEP, x);
      if (skull == null) continue;
      const d = skull + OVERLAP - (ty + sy * (hair.T[j] - T.face.top));
      if (d > 0) c += d * d;
    }
    if (hairline != null) {
      // A fringe on the eyebrows.
      const d = ty + sy * (hairline - T.face.top) - (browTop - 2);
      if (d > 0) c += 0.5 * Math.min(d, 20) ** 2;
    }
    // Hair closing in over the eyes, beyond what the style covers on the reference head (a lock swept over one eye is meant to).
    const [dl, dr] = overEyes(hair, fit, { sx, sy, tx, ty });
    if (allow) c += overEye(dl - allow.l * fit.w) + overEye(dr - allow.r * fit.w);
    else c += 0.15 * Math.min(Math.max(0, dl), 14) ** 2 + 0.15 * Math.min(Math.max(0, dr), 14) ** 2;
    // Leave the style as it was drawn unless there is a reason not to.
    const a = sx / base.sx - 1;
    const b = sy / base.sy - 1;
    return c + (a / 0.04) ** 2 + (b / 0.04) ** 2 + ((a - b) / 0.05) ** 2 + ((ty - base.ty) / 5) ** 2 + ((tx - base.tx) / 4) ** 2;
  };

  let best;
  const run = () => {
  best = { ...base, c: cost(base.sx, base.sy, base.tx, base.ty) };
  // Nothing to correct: the plain fit stands, exactly.
  if (best.c > 0.001) {
    const [lo, hi] = lim.scale;
    // A coarse look over everything allowed, then a closer one round the best of it.
    const search = (a0, a1, b0, b1, y0, y1, step, dyStep) => {
      for (let a = a0; a <= a1 + 1e-9; a += step) {
        for (let b = b0; b <= b1 + 1e-9; b += step) {
          for (let dy = y0; dy <= y1; dy += dyStep) {
            const c = cost(base.sx * a, base.sy * b, base.tx, base.ty + dy);
            if (c < best.c - 1e-9) best = { sx: base.sx * a, sy: base.sy * b, tx: base.tx, ty: base.ty + dy, c };
          }
        }
      }
    };
    search(lo, hi, lo, hi, -lim.up, lim.down, 0.04, 4);
    const a = best.sx / base.sx;
    const b = best.sy / base.sy;
    const dy = best.ty - base.ty;
    search(Math.max(lo, a - 0.03), Math.min(hi, a + 0.03), Math.max(lo, b - 0.03), Math.min(hi, b + 0.03), Math.max(-lim.up, dy - 3), Math.min(lim.down, dy + 3), 0.01, 1);
    for (let dx = -lim.across; dx <= lim.across; dx += 1) {
      const c = cost(best.sx, best.sy, base.tx + dx, best.ty);
      if (c < best.c - 1e-9) best = { ...best, tx: base.tx + dx, c };
    }
  }
  };
  run();
  // Strands that still hang clear of the head after all that are meant to (a loose lock, a side
  // sweep): the style is fitted again without trying to close them, so it is not pulled out of shape.
  if (sideGap(hair, head, fit, best) > 2) { sides = false; run(); }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  // A tall style is flattened above the crown, just enough to stay inside the picture.
  const line = fit.top - 6;
  const top = best.ty + best.sy * (hair.top - T.face.top);
  const room = line - frameTop;
  const squash = top < frameTop ? Math.max(0.62, room / (line - top)) : 1;
  return { sx: r3(best.sx), sy: r3(best.sy), tx: r3(best.tx), ty: r3(best.ty), squash: r3(squash), line };
}

/** The widest strip of background between the hair's inner edges and the head, at the temples. */
function sideGap(hair, head, fit, f) {
  let side = 0;
  for (let i = 0; i < RN; i++) {
    const y = f.ty + f.sy * (R0 + i * RSTEP - T.face.top);
    if (y < fit.top + 18 || y > fit.earTop - 14) continue;
    const hl = at(head.L, R0, RSTEP, y);
    const hr = at(head.R, R0, RSTEP, y);
    const l = hair.L[i];
    const r = hair.R[i];
    if (hl == null || l === r) continue;
    if (l != null) side = Math.max(side, hl - (f.tx + f.sx * (l - 256)));
    if (r != null) side = Math.max(side, f.tx + f.sx * (r - 256) - hr);
  }
  return side;
}

/**
 * How far the scalp shows above the hair over the crown, in frame units (0 or less: covered).
 * For tests and for checking new artwork.
 */
export function crownBare(hairId, headId, f = hairFit(hairId, headId)) {
  const hair = PART_BY_ID[hairId]?.edge;
  const head = PART_BY_ID[headId];
  if (!hair?.O || !head?.edge || !f) return 0;
  let worst = -Infinity;
  for (let j = 0; j < CN; j++) {
    if (hair.O[j] == null) continue;
    const x = f.tx + f.sx * (C0 + j * CSTEP - 256);
    if (Math.abs(x - head.fit.cx) > head.fit.w * 0.3) continue;
    const skull = at(head.edge.T, C0, CSTEP, x);
    if (skull != null) worst = Math.max(worst, f.ty + f.sy * (hair.O[j] - T.face.top) - (skull - 2));
  }
  return worst === -Infinity ? 0 : Math.round(worst * 10) / 10;
}

/** The plain fit: the style scaled by the width of the head and hung from the top of it, uncorrected. */
export const plainFit = (headId) => (PART_BY_ID[headId]?.fit ? plain(PART_BY_ID[headId].fit) : null);

/**
 * For repairing artwork (scripts/refit-hair.mjs): the fit of a hairstyle on a head with far wider
 * limits than the game allows itself, to find where a badly placed file should have been put.
 */
export function wideFit(hairId, headId, limits) {
  const head = PART_BY_ID[headId];
  return solve(PART_BY_ID[hairId].edge, head.edge, head.fit, limits);
}

/**
 * What is wrong with a fit, in frame units: the widest strip of background
 * between hair and scalp at the temples and over the crown. For tests and
 * for checking new artwork.
 */
export function fitGaps(hairId, headId, f = hairFit(hairId, headId)) {
  const hair = PART_BY_ID[hairId]?.edge;
  const head = PART_BY_ID[headId];
  if (!hair || !head?.edge || !f) return { side: 0, top: 0 };
  const fit = head.fit;
  const side = sideGap(hair, head.edge, fit, f);
  let top = 0;
  for (let j = 0; j < CN; j++) {
    const x = f.tx + f.sx * (C0 + j * CSTEP - 256);
    if (hair.T[j] == null || hair.T[j] > 250 || Math.abs(x - fit.cx) > fit.w * 0.4) continue;
    const skull = at(head.edge.T, C0, CSTEP, x);
    if (skull != null) top = Math.max(top, skull - (f.ty + f.sy * (hair.T[j] - T.face.top)));
  }
  return { side: Math.round(side * 10) / 10, top: Math.round(top * 10) / 10 };
}
