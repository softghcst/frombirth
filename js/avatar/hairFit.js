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

const cache = new Map();

/** The picture every portrait is drawn in unless a screen asks for its own: [x, y, size] of the 512 frame. */
export const FRAME = { x: -14, y: T.frameTop, size: 540 };
/** How far a narrow or broad adult face may be brought towards the average, as zoom. */
const ZOOM = [0.95, 1.07];
const faceArea = (fit) => fit.w * (fit.chin - fit.top);
const ADULTS = Object.values(PART_BY_ID).filter((p) => p.fit && p.tags?.age === 'adult');
const AVERAGE_FACE = ADULTS.reduce((s, p) => s + faceArea(p.fit), 0) / Math.max(1, ADULTS.length);

/**
 * The picture for one head. Adult heads differ a good deal in size (the narrowest is a fifth
 * narrower than the broadest), so each is zoomed a little towards the average: faces then fill
 * the same share of a portrait, and differ in shape, not in how far away they seem. The eye line
 * and the centre of the face stay exactly where they are. Children keep the plain picture, so a
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
  // A baby's hair is set on the head, with no opening for the face to fit: its own outline is laid on the head's (fitTuft).
  const tuft = PART_BY_ID[hairId]?.tags?.age === 'baby';
  if (head?.fit) out = tuft && hair?.XL && head.edge ? fitTuft(hair, head.edge, head.fit, YOUNG_DROP[headId] ?? 0) : hair && head.edge && !tuft ? solve(hair, head.edge, head.fit, LIMITS, frameFor(headId).y) : plain(head.fit);
  cache.set(key, out);
  return out;
}

const plain = (fit) => ({ sx: fit.w / T.face.w, sy: fit.w / T.face.w, tx: fit.cx, ty: fit.top, squash: 1, line: fit.top });

/** How far down the face a little one's features sit (STAGE_FEATURES.drop in CharacterAvatar.js), for finding their brows. */
const YOUNG_DROP = { head_00_baby: 0.05, head_00_toddler: 0.04 };
/** What fitTuft aims for, in frame units: hair laps this far outside the head, ends this far below the eye line at most, and its fringe stays this far above the brows. */
export const TUFT = { lap: 2, eye: 6, fringe: 16 };

/**
 * Sets a baby's hairstyle on a head. The styles are drawn to one width whatever they are (a cap of hair, or a small
 * cap between two wide puffs), on a head shaped unlike the game's, so no one scale suits them all: each is laid
 * against this head's outline instead. Row by row down the style, its silhouette should reach the edge of the head
 * (no strip of scalp between hair and outline, at the crown or the temples) and lap just over it; what stands above
 * the head (a curl, a fountain, puffs) is free. The hair ends by the brows and its fringe stays clear of them, and it
 * keeps its drawn proportions as far as that allows. A pure function of the two measurements, like solve().
 */
function fitTuft(hair, head, fit, drop) {
  const faceH = fit.chin - fit.top;
  const hr = faceH / (T.face.chin - T.face.top);
  const browY = fit.top + (T.anchor.eyebrows - T.face.top) * hr + drop * faceH;
  const eyeY = fit.top + (T.anchor.eyes - T.face.top) * hr + drop * faceH;
  const rows = hair.XL.length;
  const tall = hair.bottom - hair.X0;
  const cap = hair.X0 + tall * 0.45;
  const w = fit.w / T.face.w;
  const cost = (sx, sy, ty) => {
    let c = 0;
    let side = 0;
    let n = 0;
    for (let i = 0; i < rows; i++) {
      const ay = hair.X0 + i * hair.XS;
      const y = ty + sy * (ay - T.face.top);
      if (y < fit.top || y > fit.earTop - 6) continue; // above the head, anything goes; below the ear's top, the ear is in the way
      const weight = ay > hair.bottom - tall * 0.2 ? 0.15 : 1; // the ends of the hair taper in
      const l = at(head.L, R0, RSTEP, y);
      const r = at(head.R, R0, RSTEP, y);
      for (const [reach, edge] of [[hair.XL[i], fit.cx - l], [hair.XR[i], r - fit.cx]]) {
        if (reach == null) continue;
        const gap = edge + TUFT.lap - sx * reach;
        side += gap > 0 ? weight * gap * gap : 0.08 * Math.min(-gap, 14) ** 2;
        n += weight;
      }
    }
    // The average over the rows that lie on the head, so that a style is not squashed to have fewer of them.
    if (n) c += 30 * side / n;
    else c += 1e6; // nothing on the head at all
    // The hair sits down on the scalp: wherever it has an under-edge over the head, that edge is on the skin, not above it.
    for (let j = 0; j < CN; j++) {
      if (hair.T?.[j] == null || hair.T[j] < cap) continue; // not what stands up above the head (a fountain's tips)
      const x = fit.cx + sx * (C0 + j * CSTEP - 256);
      const over = Math.abs(x - fit.cx);
      // Over the brows and eyes, the hair's under-edge (a fringe, a lock) stays clear of the brows.
      if (over < fit.w * 0.3) { const d = ty + sy * (hair.T[j] - T.face.top) - (browY - TUFT.fringe); if (d > 0) c += 6 * d * d; }
      if (over > fit.w * 0.22) continue; // further out, puffs and pigtails hang free of the head
      const skull = at(head.T, C0, CSTEP, x);
      if (skull == null) continue;
      const d = skull + OVERLAP - (ty + sy * (hair.T[j] - T.face.top));
      if (d > 0) c += 2 * d * d;
    }
    // Side locks may come down beside the eyes, no further.
    const low = ty + sy * (hair.bottom - T.face.top) - (eyeY + TUFT.eye);
    if (low > 0) c += 3 * low * low;
    // Keep the style's own proportions: a little wider than tall suits a little one's head, not flattened.
    return c + 6000 * Math.log(sx / sy / 1.08) ** 2;
  };
  let best = null;
  const search = (a0, a1, b0, b1, y0, y1, step, dy) => {
    for (let sx = a0; sx <= a1 + 1e-9; sx += step) for (let sy = b0; sy <= b1 + 1e-9; sy += step) for (let ty = y0; ty <= y1; ty += dy) {
      const c = cost(sx, sy, ty);
      if (!best || c < best.c - 1e-9) best = { sx, sy, ty, c };
    }
  };
  // Within reason: a style is never drawn more than about a quarter bigger or smaller than the head's own scale.
  search(w * 0.95, w * 1.28, w * 0.8, w * 1.28, fit.top - 100, fit.top + 12, 0.03, 3);
  search(Math.max(w * 0.95, best.sx - 0.03), Math.min(w * 1.28, best.sx + 0.03), Math.max(w * 0.8, best.sy - 0.03), Math.min(w * 1.28, best.sy + 0.03), best.ty - 3, best.ty + 3, 0.01, 1);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { sx: r3(best.sx), sy: r3(best.sy), tx: fit.cx, ty: r3(best.ty), squash: 1, line: fit.top };
}

function solve(hair, head, fit, lim = LIMITS, frameTop = T.frameTop) {
  const base = plain(fit);
  const faceH = fit.chin - fit.top;
  const hr = faceH / (T.face.chin - T.face.top);
  // Where the brows and the eyes are on this head (as CharacterAvatar places them).
  const browTop = fit.top + (T.anchor.eyebrows - T.face.top) * hr - 14 * Math.sqrt(base.sx * hr);
  const eyeY = fit.top + (T.anchor.eyes - T.face.top) * hr;
  const eyeReach = fit.w * 0.36;
  // Rows that can show a gap at the temples: below the curve of the crown, above the ears.
  const rows = [];
  for (let i = 0; i < RN; i++) if (typeof hair.L[i] === 'number' || typeof hair.R[i] === 'number') rows.push(i);
  const cols = [];
  for (let j = 0; j < CN; j++) if (hair.T[j] != null && hair.T[j] <= 250) cols.push(j);
  const mid = Math.floor(CN / 2);
  const centre = [mid - 3, mid - 2, mid - 1, mid, mid + 1, mid + 2, mid + 3].map((j) => hair.T[j]).filter((v) => v != null);
  const hairline = centre.length ? Math.min(...centre) : null;

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
  let reach = REACH.ear;
  const cost = (sx, sy, tx, ty) => {
    let c = 0;
    const bald = bare(sx, sy, tx, ty) - Math.max(0, bareAsDrawn);
    if (bald > 0) c += 4 * bald * bald;
    for (const i of sides ? rows : []) {
      const y = ty + sy * (R0 + i * RSTEP - T.face.top);
      if (y < fit.top + 18 || y > fit.earTop - reach) continue;
      const hl = skull(head.L, y, fit.earTop);
      const hrx = skull(head.R, y, fit.earTop);
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
    // Hair closing in over the eyes.
    const hy = T.face.top + (eyeY - ty) / sy;
    const l = at(hair.L, R0, RSTEP, hy);
    const r = at(hair.R, R0, RSTEP, hy);
    if (l != null && l !== r) { const d = tx + sx * (l - 256) - (fit.cx - eyeReach); if (d > 0) c += 0.15 * Math.min(d, 14) ** 2; }
    if (r != null && l !== r) { const d = fit.cx + eyeReach - (tx + sx * (r - 256)); if (d > 0) c += 0.15 * Math.min(d, 14) ** 2; }
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
  // First the whole side of the head, down to where the ear begins. Where that cannot be closed (a style cut in
  // above the ear), only the temples, as far as the style allows; and where not even that, see above.
  if (sideGap(hair, head, fit, best, REACH.ear) > 2) {
    reach = REACH.temple;
    run();
    if (sideGap(hair, head, fit, best, REACH.temple) > 2) { sides = false; run(); }
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  // A tall style is flattened above the crown, just enough to stay inside the picture.
  const line = fit.top - 6;
  const top = best.ty + best.sy * (hair.top - T.face.top);
  const room = line - frameTop;
  const squash = top < frameTop ? Math.max(0.62, room / (line - top)) : 1;
  return { sx: r3(best.sx), sy: r3(best.sy), tx: r3(best.tx), ty: r3(best.ty), squash: r3(squash), line };
}

/** How far above the top of the ear the sides of the head are looked at: right down to the ear, or the temples only. */
const REACH = { ear: 3, temple: 14 };
/** The edge of the skull at a height: as measured, but never read across the step out to the ear. */
function skull(col, y, earTop) {
  if (y < earTop - 12) return at(col, R0, RSTEP, y); // well above the ear: the crown curves fast, and is read as it is
  const i = Math.max(0, Math.min(col.length - 2, Math.floor((y - R0) / RSTEP)));
  const a = col[i];
  const b = col[i + 1];
  return a != null && b != null && Math.abs(b - a) > 8 ? a : at(col, R0, RSTEP, y);
}

/** The widest strip of background between the hair's inner edges and the head, at the temples. */
function sideGap(hair, head, fit, f, reach = REACH.temple) {
  let side = 0;
  for (let i = 0; i < RN; i++) {
    const y = f.ty + f.sy * (R0 + i * RSTEP - T.face.top);
    if (y < fit.top + 18 || y > fit.earTop - reach) continue;
    const hl = skull(head.L, y, fit.earTop);
    const hr = skull(head.R, y, fit.earTop);
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
